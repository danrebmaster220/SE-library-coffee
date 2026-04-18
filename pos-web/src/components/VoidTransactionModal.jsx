import React, { useState } from 'react';
import '../styles/pos.css'; // Assuming it shares POS styling
import api from '../api';
import FilterSelectWrap from './FilterSelectWrap';

export default function VoidTransactionModal({ 
  isOpen, 
  onClose, 
  cartItems, 
  libraryBooking, 
  onConfirmVoid 
}) {
  const [step, setStep] = useState(1);
  const [selectedItemIds, setSelectedItemIds] = useState(new Set());
  const [voidLibrary, setVoidLibrary] = useState(false);
  const [adminPin, setAdminPin] = useState('');
  const [reasonType, setReasonType] = useState('');
  const [otherReason, setOtherReason] = useState('');
  const [processing, setProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen) return null;

  const formatMoney = (value) => {
    const numeric = Number(value || 0);
    const amount = Number.isNaN(numeric) ? 0 : numeric;
    return `₱${amount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

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

  const handleProceed = () => {
    setErrorMsg('');
    if (!hasSelections) {
      setErrorMsg('Please select at least one item to void.');
      return;
    }
    setStep(2);
  };

  const handleConfirm = async () => {
    setErrorMsg('');
    const finalReason = reasonType === 'Other - Please specify' ? otherReason : reasonType;
    if (!finalReason.trim()) {
      setErrorMsg('Please provide a reason for voiding.');
      return;
    }

    if (!/^\d{6}$/.test(adminPin)) {
      setErrorMsg('A valid 6-digit admin PIN is required to void items.');
      return;
    }
    
    setProcessing(true);
    try {
      const response = await api.post('/auth/verify-admin-pin', {
        admin_pin: adminPin
      });
      if (!response.data.valid) {
        setErrorMsg('Invalid admin PIN.');
        setProcessing(false);
        return;
      }
    } catch {
      setErrorMsg('Authentication failed.');
      setProcessing(false);
      return;
    }

    // Send selections back to parent to execute removal
    onConfirmVoid({
      itemIds: Array.from(selectedItemIds),
      voidLibrary,
      reason: finalReason,
      adminPin
    });
    setProcessing(false);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal void-selection-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '550px', width: '90%' }}>
        <div className="modal-header">
          <h3 style={{ color: '#333', margin: '0 auto' }}>Void Items</h3>
          <button onClick={onClose} className="modal-close" style={{ color: '#666', position: 'absolute', right: '15px' }}>×</button>
        </div>
        
        <div className="modal-body" style={{ padding: '24px' }}>
          {step === 1 ? (
            <>
              <p style={{ marginBottom: '15px', color: '#666', textAlign: 'center' }}>Select the items you want to remove from this order.</p>
              
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '10px' }}>
                <button 
                  type="button" 
                  onClick={handleSelectAll}
                  style={{ padding: '6px 12px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: '4px', cursor: 'pointer', fontSize: '13px' }}
                >
                  Select / Deselect All
                </button>
              </div>

              <div className="void-items-list" style={{ maxHeight: '250px', overflowY: 'auto', border: '1px solid #eee', borderRadius: '8px', padding: '10px', marginBottom: '10px' }}>
                {libraryBooking && (
                  <label style={{ display: 'flex', alignItems: 'center', padding: '10px', borderBottom: '1px solid #eee', cursor: 'pointer', backgroundColor: voidLibrary ? '#ffebee' : 'transparent' }}>
                    <input 
                      className="modal-check-input"
                      type="checkbox" 
                      checked={voidLibrary} 
                      onChange={() => setVoidLibrary(!voidLibrary)}
                      style={{ marginRight: '15px' }}
                    />
                    <div style={{ flex: 1 }}>
                      <span style={{ fontWeight: 'bold' }}>Study Area Booking</span>
                      <div style={{ fontSize: '0.85em', color: '#666' }}>
                        {libraryBooking.table_name}, Seat {libraryBooking.seat_number} - {libraryBooking.duration_minutes} mins
                      </div>
                    </div>
                    <span style={{ fontWeight: 'bold' }}>{formatMoney(libraryBooking.amount)}</span>
                  </label>
                )}

                {cartItems.map(item => (
                  <label key={item.id} style={{ display: 'flex', alignItems: 'center', padding: '10px', borderBottom: '1px solid #eee', cursor: 'pointer', backgroundColor: selectedItemIds.has(item.id) ? '#ffebee' : 'transparent' }}>
                    <input 
                      className="modal-check-input"
                      type="checkbox" 
                      checked={selectedItemIds.has(item.id)}
                      onChange={() => toggleItem(item.id)}
                      style={{ marginRight: '15px' }}
                    />
                    <div style={{ flex: 1 }}>
                      <span style={{ fontWeight: 'bold' }}>{item.quantity}x {item.name}</span>
                      {item.customizations && item.customizations.length > 0 && (
                        <div style={{ fontSize: '0.85em', color: '#666' }}>
                          {item.customizations.map(c => `+ ${c.option_name}`).join(', ')}
                        </div>
                      )}
                    </div>
                    <span style={{ fontWeight: 'bold' }}>{formatMoney(item.total_price * item.quantity)}</span>
                  </label>
                ))}

                {cartItems.length === 0 && !libraryBooking && (
                  <div style={{ padding: '20px', textAlign: 'center', color: '#999' }}>Cart is empty.</div>
                )}
              </div>
            </>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              {/* Arrow back button at top-left of content */}
              <div style={{ width: '100%', marginBottom: '16px' }}>
                <button 
                  onClick={() => setStep(1)} 
                  disabled={processing}
                  style={{ 
                    display: 'flex', alignItems: 'center', gap: '6px',
                    background: 'none', border: 'none', color: '#5d4037', 
                    cursor: processing ? 'not-allowed' : 'pointer',
                    fontSize: '14px', fontWeight: '600', padding: '4px 0'
                  }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="15 18 9 12 15 6"></polyline>
                  </svg>
                  Back
                </button>
              </div>

              <p style={{ marginBottom: '20px', color: '#555', fontWeight: 'bold' }}>Authorization Needed</p>
              
              <div style={{ width: '80%', marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', fontSize: '13px', color: '#333' }}>Reason for Voiding <span style={{color:'red'}}>*</span></label>
                <FilterSelectWrap fullWidth>
                  <select 
                    value={reasonType}
                    onChange={(e) => setReasonType(e.target.value)}
                    className="filter-select"
                    style={{ marginBottom: reasonType === 'Other - Please specify' ? '10px' : '0' }}
                  >
                    <option value="" disabled>Select a reason...</option>
                    <option value="Wrong item punched">Wrong item punched</option>
                    <option value="Customer changed mind">Customer changed mind</option>
                    <option value="Item unavailable">Item unavailable</option>
                    <option value="Test transaction">Test transaction</option>
                    <option value="Other - Please specify">Other - Please specify</option>
                  </select>
                </FilterSelectWrap>
                
                {reasonType === 'Other - Please specify' && (
                  <input 
                    type="text"
                    placeholder="Enter custom reason..."
                    value={otherReason}
                    onChange={e => setOtherReason(e.target.value)}
                    style={{ width: '100%', padding: '10px', border: '1px solid #ccc', borderRadius: '6px', fontSize: '14px', boxSizing: 'border-box' }}
                  />
                )}
              </div>

              <div style={{ width: '80%', backgroundColor: '#f9f9f9', padding: '15px', borderRadius: '8px', border: '1px solid #eee' }}>
                <h4 style={{ margin: '0 0 15px 0', fontSize: '14px', color: '#e74c3c', textAlign: 'center' }}>Admin Authorization PIN</h4>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <input 
                    type="password" 
                    placeholder="Enter 6-digit PIN" 
                    value={adminPin}
                    onChange={e => setAdminPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    inputMode="numeric"
                    maxLength={6}
                    style={{ width: '100%', padding: '10px', border: '1px solid #ccc', borderRadius: '6px', boxSizing: 'border-box' }}
                  />
                </div>
              </div>
            </div>
          )}

          {errorMsg && <div style={{ color: '#e74c3c', marginTop: '15px', padding: '10px', backgroundColor: '#ffebee', borderRadius: '6px', textAlign: 'center', fontSize: '13px' }}>{errorMsg}</div>}
        </div>
        
        <div className="modal-footer" style={{ borderTop: '1px solid #eee', marginTop: '10px', paddingTop: '15px', gap: '10px' }}>
          <button 
            onClick={onClose} 
            className="btn-cancel"
            style={{ flex: 1 }}
            disabled={processing}
          >
            Cancel
          </button>
          
          {step === 1 ? (
            <button 
              onClick={handleProceed}
              style={{ 
                flex: 1,
                backgroundColor: hasSelections ? '#e74c3c' : '#ccc', 
                color: 'white', 
                border: 'none', 
                borderRadius: '6px', 
                fontWeight: 'bold',
                cursor: hasSelections ? 'pointer' : 'not-allowed'
              }}
              disabled={!hasSelections}
            >
              Proceed to Void
            </button>
          ) : (
            <button 
              onClick={handleConfirm}
              style={{ 
                flex: 1,
                backgroundColor: '#e74c3c', 
                color: 'white', 
                border: 'none', 
                borderRadius: '6px', 
                fontWeight: 'bold',
                cursor: processing ? 'not-allowed' : 'pointer'
              }}
              disabled={processing}
            >
              {processing ? 'Processing...' : 'Confirm Void'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
