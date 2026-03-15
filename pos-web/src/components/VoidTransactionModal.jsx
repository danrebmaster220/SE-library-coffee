import React, { useState } from 'react';
import '../styles/pos.css'; // Assuming it shares POS styling
import api from '../api';

export default function VoidTransactionModal({ 
  isOpen, 
  onClose, 
  cartItems, 
  libraryBooking, 
  onConfirmVoid,
  isKioskOrder 
}) {
  const [selectedItemIds, setSelectedItemIds] = useState(new Set());
  const [voidLibrary, setVoidLibrary] = useState(false);
  const [adminUsername, setAdminUsername] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [voidReason, setVoidReason] = useState('');
  const [processing, setProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen) return null;

  const toggleItem = (itemId) => {
    setSelectedItemIds(prev => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectedItemIds.size === cartItems.length && (libraryBooking ? voidLibrary : true)) {
      setSelectedItemIds(new Set());
      setVoidLibrary(false);
    } else {
      setSelectedItemIds(new Set(cartItems.map(i => i.id)));
      if (libraryBooking) setVoidLibrary(true);
    }
  };

  const hasSelections = selectedItemIds.size > 0 || voidLibrary;

  const handleConfirm = async () => {
    setErrorMsg('');
    if (!hasSelections) {
      setErrorMsg('Please select at least one item to void.');
      return;
    }
    if (!voidReason.trim()) {
      setErrorMsg('Please provide a reason for voiding.');
      return;
    }

    // Require admin auth for Kiosk Orders
    if (isKioskOrder) {
      if (!adminUsername || !adminPassword) {
        setErrorMsg('Admin credentials are required to void kiosk items.');
        return;
      }
      setProcessing(true);
      try {
        const response = await api.post('/auth/verify-admin', {
          username: adminUsername,
          password: adminPassword
        });
        if (!response.data.valid) {
          setErrorMsg('Invalid admin credentials.');
          setProcessing(false);
          return;
        }
      } catch {
        setErrorMsg('Authentication failed.');
        setProcessing(false);
        return;
      }
    }

    setProcessing(true);
    // Send selections back to parent to execute removal
    onConfirmVoid({
      itemIds: Array.from(selectedItemIds),
      voidLibrary,
      reason: voidReason,
      adminUsername: isKioskOrder ? adminUsername : null
    });
    setProcessing(false);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal void-selection-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '600px', width: '90%' }}>
        <div className="modal-header" style={{ backgroundColor: '#e74c3c', color: 'white' }}>
          <h3>Void Items</h3>
          <button onClick={onClose} className="modal-close" style={{ color: 'white' }}>×</button>
        </div>
        
        <div className="modal-body">
          <p style={{ marginBottom: '15px', color: '#666' }}>Select the items you want to remove from this order.</p>
          
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '10px' }}>
            <button 
              type="button" 
              onClick={handleSelectAll}
              style={{ padding: '5px 10px', background: '#f0f0f0', border: '1px solid #ccc', borderRadius: '4px', cursor: 'pointer' }}
            >
              Select / Deselect All
            </button>
          </div>

          <div className="void-items-list" style={{ maxHeight: '250px', overflowY: 'auto', border: '1px solid #eee', borderRadius: '8px', padding: '10px', marginBottom: '20px' }}>
            {libraryBooking && (
              <label style={{ display: 'flex', alignItems: 'center', padding: '10px', borderBottom: '1px solid #eee', cursor: 'pointer', backgroundColor: voidLibrary ? '#ffebee' : 'transparent' }}>
                <input 
                  type="checkbox" 
                  checked={voidLibrary} 
                  onChange={() => setVoidLibrary(!voidLibrary)}
                  style={{ marginRight: '15px', transform: 'scale(1.2)' }}
                />
                <div style={{ flex: 1 }}>
                  <span style={{ fontWeight: 'bold' }}>Study Area Booking</span>
                  <div style={{ fontSize: '0.85em', color: '#666' }}>
                    {libraryBooking.table_name}, Seat {libraryBooking.seat_number} - {libraryBooking.duration_minutes} mins
                  </div>
                </div>
                <span style={{ fontWeight: 'bold' }}>₱{libraryBooking.amount.toFixed(2)}</span>
              </label>
            )}

            {cartItems.map(item => (
              <label key={item.id} style={{ display: 'flex', alignItems: 'center', padding: '10px', borderBottom: '1px solid #eee', cursor: 'pointer', backgroundColor: selectedItemIds.has(item.id) ? '#ffebee' : 'transparent' }}>
                <input 
                  type="checkbox" 
                  checked={selectedItemIds.has(item.id)}
                  onChange={() => toggleItem(item.id)}
                  style={{ marginRight: '15px', transform: 'scale(1.2)' }}
                />
                <div style={{ flex: 1 }}>
                  <span style={{ fontWeight: 'bold' }}>{item.quantity}x {item.name}</span>
                  {item.customizations && item.customizations.length > 0 && (
                    <div style={{ fontSize: '0.85em', color: '#666' }}>
                      {item.customizations.map(c => `+ ${c.option_name}`).join(', ')}
                    </div>
                  )}
                </div>
                <span style={{ fontWeight: 'bold' }}>₱{(item.total_price * item.quantity).toFixed(2)}</span>
              </label>
            ))}

            {cartItems.length === 0 && !libraryBooking && (
              <div style={{ padding: '20px', textAlign: 'center', color: '#999' }}>Cart is empty.</div>
            )}
          </div>

          {errorMsg && <div style={{ color: '#e74c3c', marginBottom: '15px', padding: '10px', backgroundColor: '#ffebee', borderRadius: '4px' }}>{errorMsg}</div>}

          {isKioskOrder && (
            <div className="void-auth-section" style={{ backgroundColor: '#f9f9f9', padding: '15px', borderRadius: '8px', marginBottom: '15px' }}>
              <h4 style={{ margin: '0 0 10px 0', fontSize: '14px', color: '#333' }}>Admin Authorization Required</h4>
              <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
                <input 
                  type="text" 
                  placeholder="Admin Username" 
                  value={adminUsername}
                  onChange={e => setAdminUsername(e.target.value)}
                  style={{ flex: 1, padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }}
                />
                <input 
                  type="password" 
                  placeholder="Admin Password" 
                  value={adminPassword}
                  onChange={e => setAdminPassword(e.target.value)}
                  style={{ flex: 1, padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }}
                />
              </div>
            </div>
          )}

          <div className="void-reason-section">
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', fontSize: '14px' }}>Reason for Voiding *</label>
            <input 
              type="text"
              placeholder="e.g. Customer changed mind, Item unavailable"
              value={voidReason}
              onChange={e => setVoidReason(e.target.value)}
              style={{ width: '100%', padding: '10px', border: '1px solid #ccc', borderRadius: '4px' }}
            />
          </div>
        </div>
        
        <div className="modal-footer" style={{ borderTop: '1px solid #eee', marginTop: '15px', paddingTop: '15px' }}>
          <button 
            onClick={onClose} 
            className="btn-cancel"
            disabled={processing}
          >
            Cancel
          </button>
          <button 
            onClick={handleConfirm}
            style={{ 
              backgroundColor: hasSelections ? '#e74c3c' : '#ccc', 
              color: 'white', 
              padding: '10px 20px', 
              border: 'none', 
              borderRadius: '4px', 
              fontWeight: 'bold',
              cursor: hasSelections && !processing ? 'pointer' : 'not-allowed'
            }}
            disabled={!hasSelections || processing}
          >
            {processing ? 'Processing...' : 'Confirm Void'}
          </button>
        </div>
      </div>
    </div>
  );
}
