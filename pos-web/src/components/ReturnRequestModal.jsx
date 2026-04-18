import React, { useState, useEffect } from 'react';
import api from '../api';
import FilterSelectWrap from './FilterSelectWrap';
import { printRefundReceipt } from '../services/webPrinter';
import '../styles/pos.css'; // Utilizing existing CSS

export default function ReturnRequestModal({ 
  isOpen, 
  onClose, 
  transactionId,
  onRefundComplete
}) {
  const [step, setStep] = useState(1);
  const [transaction, setTransaction] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedItemIds, setSelectedItemIds] = useState(new Set());
  const [refundLibrary, setRefundLibrary] = useState(false);
  
  const [refundMethod, setRefundMethod] = useState(''); // 'cash' or 'item'
  const [reasonType, setReasonType] = useState('');
  const [otherReason, setOtherReason] = useState('');
  const [adminPin, setAdminPin] = useState('');
  
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
      setStep(1);
      setTransaction(null);
      setSelectedItemIds(new Set());
      setRefundLibrary(false);
      setRefundMethod('');
      setReasonType('');
      setOtherReason('');
      setAdminPin('');
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

  const handleProceed = () => {
    setErrorMsg('');
    if (!hasSelections) {
      setErrorMsg('Please select at least one item to refund.');
      return;
    }
    if (!refundMethod) {
      setErrorMsg('Please select a Refund Method (Cash or Item Replacement).');
      return;
    }
    setStep(2);
  };

  const handleConfirmRefund = async () => {
    setErrorMsg('');
    const finalReason = reasonType === 'Other - Please specify' ? otherReason : reasonType;
    if (!finalReason.trim()) {
      setErrorMsg('Please provide a reason for the refund.');
      return;
    }
    if (!/^\d{6}$/.test(adminPin)) {
      setErrorMsg('A valid 6-digit admin PIN is required to authorize a refund.');
      return;
    }

    setProcessing(true);
    try {
      // 1. Verify Admin
      const authRes = await api.post('/auth/verify-admin-pin', {
        admin_pin: adminPin
      });
      
      if (!authRes.data.valid) {
        setErrorMsg('Invalid admin PIN.');
        setProcessing(false);
        return;
      }

      // 2. Process Refund
      const selectedIds = Array.from(selectedItemIds);
      const refundRes = await api.post(`/pos/transactions/${transactionId}/refund`, {
        reason: finalReason,
        refundMethod: refundMethod,
        admin_pin: adminPin,
        refundedItems: selectedIds,
        refundLibrary
      });

      // 3. Print refund receipt (local print-server first, browser print fallback)
      try {
        let parsedBooking = null;
        if (transaction.library_booking) {
          try {
            parsedBooking = typeof transaction.library_booking === 'string'
              ? JSON.parse(transaction.library_booking)
              : transaction.library_booking;
          } catch {
            parsedBooking = null;
          }
        }

        const refundedItems = (transaction.items || [])
          .filter(item => selectedIds.includes(item.transaction_item_id))
          .map(item => ({
            item_name: item.item_name,
            quantity: Number(item.quantity) || 1,
            unit_price: Number(item.unit_price) || 0,
            total_price: (Number(item.quantity) || 1) * (Number(item.unit_price) || 0)
          }));

        if (refundLibrary && parsedBooking) {
          refundedItems.push({
            item_name: `Study Area Booking (Table ${parsedBooking.table_number || '-'}, Seat ${parsedBooking.seat_number || '-'})`,
            quantity: 1,
            unit_price: Number(parsedBooking.amount || parsedBooking.amount_paid || 0),
            total_price: Number(parsedBooking.amount || parsedBooking.amount_paid || 0)
          });
        }

        const subtotal = refundedItems.reduce((sum, item) => sum + (Number(item.total_price) || 0), 0);
        const refundTotal = Number(refundRes.data?.refund_amount);

        await printRefundReceipt({
          transaction_id: transaction.transaction_id,
          beeper_number: transaction.beeper_number,
          created_at: transaction.created_at,
          refunded_at: new Date().toISOString(),
          refunded_by: authRes.data?.admin_name || authRes.data?.name || '',
          refund_reason: finalReason,
          subtotal,
          discount_name: transaction.discount_name || '',
          discount_amount: 0,
          total_amount: Number.isFinite(refundTotal) ? refundTotal : subtotal,
          items: refundedItems
        });
      } catch (printErr) {
        console.error('Refund receipt print failed:', printErr);
      }

      // 4. Close & Refresh
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
      <div className="modal void-selection-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '550px', width: '90%' }}>
        <div className="modal-header">
          <h3 style={{ color: '#333' }}>Process Return/Refund</h3>
          <button onClick={onClose} className="modal-close" style={{ color: '#666' }} disabled={processing}>×</button>
        </div>
        
        <div className="modal-body" style={{ padding: '24px' }}>
          {loading ? (
            <div style={{ padding: '40px', textAlign: 'center' }}>Loading transaction details...</div>
          ) : transaction ? (
            <>
              {step === 1 ? (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px', color: '#666', borderBottom: '1px solid #eee', paddingBottom: '10px' }}>
                    <div><strong>Order #{transaction.beeper_number || transaction.transaction_id}</strong></div>
                    <div>{new Date(transaction.created_at).toLocaleString()}</div>
                  </div>

                  <p style={{ marginBottom: '10px', color: '#333', fontWeight: 'bold' }}>Select Items to Refund:</p>

                  <div className="void-items-list" style={{ maxHeight: '200px', overflowY: 'auto', border: '1px solid #eee', borderRadius: '8px', padding: '10px', marginBottom: '20px' }}>
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
                      <label key={item.transaction_item_id} style={{ display: 'flex', alignItems: 'center', padding: '10px', borderBottom: '1px solid #eee', cursor: 'pointer', backgroundColor: selectedItemIds.has(item.transaction_item_id) ? '#fff3e0' : 'transparent' }}>
                        <input 
                          type="checkbox" 
                          checked={selectedItemIds.has(item.transaction_item_id)}
                          onChange={() => toggleItem(item.transaction_item_id)}
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

                  <div className="refund-method-section" style={{ backgroundColor: '#f9f9f9', padding: '15px', borderRadius: '8px', border: '1px solid #eee' }}>
                    <p style={{ margin: '0 0 10px 0', fontWeight: 'bold', fontSize: '14px', color: '#333' }}>Refund Method <span style={{color:'red'}}>*</span></p>
                    <div style={{ display: 'flex', gap: '15px' }}>
                      <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', fontWeight: 'bold', padding: '10px 15px', border: '1px solid #ccc', borderRadius: '6px', flex: 1, backgroundColor: refundMethod === 'cash' ? '#fdebd0' : 'white', borderColor: refundMethod === 'cash' ? '#e67e22' : '#ccc' }}>
                        <input 
                          type="radio" 
                          name="refund-method" 
                          value="cash"
                          checked={refundMethod === 'cash'} 
                          onChange={() => setRefundMethod('cash')}
                          style={{ marginRight: '10px' }}
                        />
                        Cash Return
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', fontWeight: 'bold', padding: '10px 15px', border: '1px solid #ccc', borderRadius: '6px', flex: 1, backgroundColor: refundMethod === 'item' ? '#fdebd0' : 'white', borderColor: refundMethod === 'item' ? '#e67e22' : '#ccc' }}>
                        <input 
                          type="radio" 
                          name="refund-method" 
                          value="item"
                          checked={refundMethod === 'item'} 
                          onChange={() => setRefundMethod('item')}
                          style={{ marginRight: '10px' }}
                        />
                        Item Replacement
                      </label>
                    </div>
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
                  
                  <div style={{ width: '100%', maxWidth: '400px', marginBottom: '20px' }}>
                    <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', fontSize: '13px', color: '#333' }}>Reason for {refundMethod === 'cash' ? 'Refund' : 'Replacement'} <span style={{color:'red'}}>*</span></label>
                    <FilterSelectWrap fullWidth>
                      <select 
                        value={reasonType}
                        onChange={(e) => setReasonType(e.target.value)}
                        className="filter-select"
                        style={{ marginBottom: reasonType === 'Other - Please specify' ? '10px' : '0', boxSizing: 'border-box' }}
                      >
                        <option value="" disabled>Select a reason...</option>
                        <option value="Wrong item prepared">Wrong item prepared</option>
                        <option value="Defective product">Defective product</option>
                        <option value="Customer dissatisfied">Customer dissatisfied</option>
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

                  <div style={{ width: '100%', maxWidth: '400px', backgroundColor: '#f9f9f9', padding: '20px', borderRadius: '8px', border: '1px solid #eee' }}>
                    <h4 style={{ margin: '0 0 15px 0', fontSize: '14px', color: '#e67e22', textAlign: 'center' }}>Admin Authorization PIN</h4>
                    
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
            </>
          ) : (
            <div style={{ padding: '40px', textAlign: 'center', color: '#e74c3c' }}>Failed to load transaction.</div>
          )}

          {errorMsg && <div style={{ color: '#e74c3c', marginTop: '15px', padding: '10px', backgroundColor: '#ffebee', borderRadius: '6px', textAlign: 'center', fontSize: '13px' }}>{errorMsg}</div>}
        </div>
        
        <div className="modal-footer" style={{ borderTop: '1px solid #eee', marginTop: '10px', padding: '16px 24px', gap: '10px' }}>
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
                backgroundColor: hasSelections && refundMethod ? '#e67e22' : '#ccc', 
                color: 'white', 
                border: 'none', 
                borderRadius: '6px', 
                fontWeight: 'bold',
                cursor: hasSelections && refundMethod ? 'pointer' : 'not-allowed'
              }}
              disabled={!hasSelections || !refundMethod}
            >
              Proceed to Refund
            </button>
          ) : (
            <button 
              onClick={handleConfirmRefund}
              style={{ 
                flex: 1,
                backgroundColor: '#e67e22', 
                color: 'white', 
                border: 'none', 
                borderRadius: '6px', 
                fontWeight: 'bold',
                cursor: processing ? 'not-allowed' : 'pointer'
              }}
              disabled={processing}
            >
              {processing ? 'Processing...' : 'Complete Refund'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
