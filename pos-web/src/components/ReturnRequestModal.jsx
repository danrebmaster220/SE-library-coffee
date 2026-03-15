import React, { useState, useEffect } from 'react';
import api from '../api';
import '../styles/pos.css'; // Utilizing existing CSS

export default function ReturnRequestModal({ 
  isOpen, 
  onClose, 
  transactionId,
  onRefundComplete
}) {
  const [transaction, setTransaction] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedItemIds, setSelectedItemIds] = useState(new Set());
  const [refundLibrary, setRefundLibrary] = useState(false);
  
  const [refundReason, setRefundReason] = useState('');
  const [adminUsername, setAdminUsername] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  
  const [processing, setProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    const fetchTransactionDetails = async () => {
      try {
        setLoading(true);
        const res = await api.get(`/pos/transactions/${transactionId}`);
        setTransaction(res.data);
      } catch (err) {
        setErrorMsg('Failed to load transaction details.');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    if (isOpen && transactionId) {
      fetchTransactionDetails();
    } else {
      // Reset state on close
      setTransaction(null);
      setSelectedItemIds(new Set());
      setRefundLibrary(false);
      setRefundReason('');
      setAdminUsername('');
      setAdminPassword('');
      setErrorMsg('');
      setLoading(true);
    }
  }, [isOpen, transactionId]);

  const toggleItem = (itemId) => {
    setSelectedItemIds(prev => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  };

  const hasSelections = selectedItemIds.size > 0 || refundLibrary;

  const handleConfirmRefund = async () => {
    setErrorMsg('');
    if (!hasSelections) {
      setErrorMsg('Please select at least one item to refund.');
      return;
    }
    if (!refundReason.trim()) {
      setErrorMsg('Please provide a reason for the refund.');
      return;
    }
    if (!adminUsername || !adminPassword) {
      setErrorMsg('Admin credentials are required to authorize a refund.');
      return;
    }

    setProcessing(true);
    try {
      // 1. Verify Admin
      const authRes = await api.post('/auth/verify-admin', {
        username: adminUsername,
        password: adminPassword
      });
      
      if (!authRes.data.valid) {
        setErrorMsg('Invalid admin credentials.');
        setProcessing(false);
        return;
      }

      // 2. Process Refund
      await api.post(`/pos/transactions/${transactionId}/refund`, {
        reason: refundReason,
        adminUsername,
        refundedItems: Array.from(selectedItemIds),
        refundLibrary
      });

      // 3. Close & Refresh
      onRefundComplete();
      onClose();
    } catch (err) {
      setErrorMsg(err.response?.data?.error || 'Failed to process refund.');
    } finally {
      setProcessing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={!processing ? onClose : undefined}>
      <div className="modal void-selection-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '600px', width: '90%' }}>
        <div className="modal-header" style={{ backgroundColor: '#e67e22', color: 'white' }}>
          <h3>Process Return/Refund</h3>
          <button onClick={onClose} className="modal-close" style={{ color: 'white' }} disabled={processing}>×</button>
        </div>
        
        <div className="modal-body">
          {loading ? (
            <div style={{ padding: '40px', textAlign: 'center' }}>Loading transaction details...</div>
          ) : transaction ? (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px', color: '#666', borderBottom: '1px solid #eee', paddingBottom: '10px' }}>
                <div><strong>Order #{transaction.beeper_number || transaction.transaction_id}</strong></div>
                <div>{new Date(transaction.created_at).toLocaleString()}</div>
              </div>

              <p style={{ marginBottom: '10px', color: '#333', fontWeight: 'bold' }}>Select Items to Refund:</p>

              <div className="void-items-list" style={{ maxHeight: '250px', overflowY: 'auto', border: '1px solid #eee', borderRadius: '8px', padding: '10px', marginBottom: '20px' }}>
                {transaction.library_booking && (
                  <label style={{ display: 'flex', alignItems: 'center', padding: '10px', borderBottom: '1px solid #eee', cursor: 'pointer', backgroundColor: refundLibrary ? '#fff3e0' : 'transparent' }}>
                    <input 
                      type="checkbox" 
                      checked={refundLibrary} 
                      onChange={() => setRefundLibrary(!refundLibrary)}
                      style={{ marginRight: '15px', transform: 'scale(1.2)' }}
                    />
                    <div style={{ flex: 1 }}>
                      <span style={{ fontWeight: 'bold' }}>Study Area Booking</span>
                      <div style={{ fontSize: '0.85em', color: '#666' }}>
                        {transaction.library_booking.table_name}, Seat {transaction.library_booking.seat_number}
                      </div>
                    </div>
                    <span style={{ fontWeight: 'bold' }}>₱{parseFloat(transaction.library_booking.amount || 0).toFixed(2)}</span>
                  </label>
                )}

                {transaction.items && transaction.items.map(item => {
                  const itemTotal = parseFloat(item.unit_price) * parseInt(item.quantity);
                  return (
                  <label key={item.order_item_id} style={{ display: 'flex', alignItems: 'center', padding: '10px', borderBottom: '1px solid #eee', cursor: 'pointer', backgroundColor: selectedItemIds.has(item.order_item_id) ? '#fff3e0' : 'transparent' }}>
                    <input 
                      type="checkbox" 
                      checked={selectedItemIds.has(item.order_item_id)}
                      onChange={() => toggleItem(item.order_item_id)}
                      style={{ marginRight: '15px', transform: 'scale(1.2)' }}
                    />
                    <div style={{ flex: 1 }}>
                      <span style={{ fontWeight: 'bold' }}>{item.quantity}x {item.item_name}</span>
                      {item.customizations && item.customizations.length > 0 && (
                        <div style={{ fontSize: '0.85em', color: '#666' }}>
                          {item.customizations.map(c => `+ ${c.option_name}`).join(', ')}
                        </div>
                      )}
                    </div>
                    <span style={{ fontWeight: 'bold' }}>₱{itemTotal.toFixed(2)}</span>
                  </label>
                )})}
              </div>

              {errorMsg && <div style={{ color: '#e74c3c', marginBottom: '15px', padding: '10px', backgroundColor: '#ffebee', borderRadius: '4px' }}>{errorMsg}</div>}

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

              <div className="void-reason-section">
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', fontSize: '14px' }}>Reason for Return/Refund *</label>
                <input 
                  type="text"
                  placeholder="e.g. Wrong item prepared, Defective product"
                  value={refundReason}
                  onChange={e => setRefundReason(e.target.value)}
                  style={{ width: '100%', padding: '10px', border: '1px solid #ccc', borderRadius: '4px' }}
                />
              </div>
            </>
          ) : (
            <div style={{ padding: '40px', textAlign: 'center', color: '#e74c3c' }}>Failed to load transaction.</div>
          )}
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
            onClick={handleConfirmRefund}
            style={{ 
              backgroundColor: hasSelections ? '#e67e22' : '#ccc', 
              color: 'white', 
              padding: '10px 20px', 
              border: 'none', 
              borderRadius: '4px', 
              fontWeight: 'bold',
              cursor: hasSelections && !processing ? 'pointer' : 'not-allowed'
            }}
            disabled={!hasSelections || processing}
          >
            {processing ? 'Processing...' : 'Complete Refund'}
          </button>
        </div>
      </div>
    </div>
  );
}
