import { useState, useEffect } from 'react';
import api from '../api';
import { printRefundReceipt } from '../services/webPrinter';
import '../styles/menu-management-styles/index.css';
import '../styles/void-transactions.css';

export default function VoidTransactions() {
  const [refundedOrders, setRefundedOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('refund');
  
  const [orderId, setOrderId] = useState('');
  const [refundReason, setRefundReason] = useState('');
  const [searchResult, setSearchResult] = useState(null);
  const [searchError, setSearchError] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);
  
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [adminUsername, setAdminUsername] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  
  const [showAlert, setShowAlert] = useState(false);
  const [alertData, setAlertData] = useState({ title: '', message: '', type: 'info' });

  const [historyPage, setHistoryPage] = useState(1);
  const [historySearch, setHistorySearch] = useState('');
  const historyRowsPerPage = 10;

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const refundedRes = await api.get('/pos/transactions/refunded');
      setRefundedOrders(refundedRes.data.transactions || refundedRes.data || []);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearchOrder = async () => {
    if (!orderId.trim()) {
      setSearchError('Please enter an Order ID');
      setSearchResult(null);
      return;
    }

    setSearchError('');
    setSearchLoading(true);
    
    let searchId = orderId.trim();
    
    if (searchId.toUpperCase().startsWith('ORD-')) {
      searchId = searchId.substring(4);
    } else if (searchId.toUpperCase().startsWith('LIB-')) {
      setSearchError('Library sessions cannot be refunded here. Use Library Management.');
      setSearchResult(null);
      setSearchLoading(false);
      return;
    }
    
    searchId = parseInt(searchId, 10);
    
    if (isNaN(searchId) || searchId <= 0) {
      setSearchError('Please enter a valid Order ID (e.g., ORD-000031 or 31)');
      setSearchResult(null);
      setSearchLoading(false);
      return;
    }
    
    try {
      const res = await api.get(`/pos/transactions/${searchId}`);
      if (res.data) {
        setSearchResult(res.data);
        setSearchError('');
      }
    } catch {
      setSearchError('Order not found with ID: ORD-' + String(searchId).padStart(6, '0'));
      setSearchResult(null);
    } finally {
      setSearchLoading(false);
    }
  };

  const canRefund = (status) => {
    return ['preparing', 'ready', 'completed'].includes(status);
  };

  const getStatusMessage = (status) => {
    switch (status) {
      case 'pending':
        return 'This order has not been paid yet. Use the POS Order Queue to void pending orders.';
      case 'voided':
        return 'This order has already been voided and cannot be refunded.';
      case 'refunded':
        return 'This order has already been refunded.';
      default:
        return '';
    }
  };

  const handleInitiateRefund = () => {
    if (!searchResult) {
      displayAlert('Error', 'Please search for an order first', 'error');
      return;
    }
    setRefundReason('');
    setAdminUsername('');
    setAdminPassword('');
    setAuthError('');
    setShowAuthModal(true);
  };

  const handleConfirmRefund = async () => {
    if (!adminUsername.trim() || !adminPassword.trim()) {
      setAuthError('Please enter admin credentials');
      return;
    }
    if (!refundReason.trim()) {
      setAuthError('Please enter a reason for the refund');
      return;
    }

    setIsProcessing(true);
    setAuthError('');

    try {
      const authRes = await api.post('/auth/verify-admin', {
        username: adminUsername,
        password: adminPassword
      });

      if (!authRes.data.success) {
        setAuthError('Invalid admin credentials');
        setIsProcessing(false);
        return;
      }

      const refundRes = await api.post('/pos/transactions/' + (searchResult.id || searchResult.transaction_id) + '/refund', {
        reason: refundReason,
        refunded_by: authRes.data.admin_id
      });

      setShowAuthModal(false);

      displayAlert(
        'Refund Successful', 
        'Order ORD-' + String(searchResult.id || searchResult.transaction_id).padStart(6, '0') + ' has been refunded.\nRefund Amount: P' + parseFloat(refundRes.data.refund_amount || searchResult.total_amount || searchResult.total || 0).toFixed(2), 
        'success'
      );

      try {
        await printRefundReceipt({
          transaction_id: searchResult.id || searchResult.transaction_id,
          order_number: searchResult.order_number,
          beeper_number: searchResult.beeper_number,
          order_type: searchResult.order_type,
          items: searchResult.items || [],
          subtotal: searchResult.subtotal,
          discount_amount: searchResult.discount_amount,
          discount_name: searchResult.discount_name,
          total_amount: searchResult.total_amount || searchResult.total,
          refund_reason: refundReason,
          refunded_by: adminUsername,
          created_at: searchResult.created_at,
          refunded_at: new Date().toISOString()
        });
      } catch (printErr) {
        console.log('Refund receipt print skipped:', printErr.message);
      }

      setSearchResult(null);
      setOrderId('');
      setRefundReason('');
      fetchData();
    } catch (error) {
      if (error.response?.status === 401) {
        setAuthError('Invalid admin credentials');
      } else {
        setAuthError(error.response?.data?.error || 'Failed to process refund');
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const displayAlert = (title, message, type = 'info') => {
    setAlertData({ title, message, type });
    setShowAlert(true);
  };

  const filteredRefundedOrders = refundedOrders.filter(order => {
    if (!historySearch.trim()) return true;
    const searchLower = historySearch.toLowerCase();
    const oid = String(order.order_number || order.transaction_id || order.id || '');
    const orderFormatted = 'ord-' + oid.padStart(6, '0');
    const beeper = String(order.beeper_number || '');
    const refundedBy = (order.refunded_by_name || '').toLowerCase();
    const reason = (order.refund_reason || '').toLowerCase();
    
    return (
      oid.includes(searchLower) ||
      orderFormatted.includes(searchLower) ||
      beeper.includes(searchLower) ||
      refundedBy.includes(searchLower) ||
      reason.includes(searchLower)
    );
  });

  useEffect(() => {
    setHistoryPage(1);
  }, [historySearch, refundedOrders]);

  const historyTotalPages = Math.ceil(filteredRefundedOrders.length / historyRowsPerPage);
  const historyStartIndex = (historyPage - 1) * historyRowsPerPage;
  const historyEndIndex = historyStartIndex + historyRowsPerPage;
  const paginatedRefundedOrders = filteredRefundedOrders.slice(historyStartIndex, historyEndIndex);

  const getHistoryPageNumbers = () => {
    const pages = [];
    const maxVisiblePages = 5;
    if (historyTotalPages <= maxVisiblePages) {
      for (let i = 1; i <= historyTotalPages; i++) pages.push(i);
    } else {
      if (historyPage <= 3) {
        for (let i = 1; i <= 4; i++) pages.push(i);
        pages.push('...');
        pages.push(historyTotalPages);
      } else if (historyPage >= historyTotalPages - 2) {
        pages.push(1);
        pages.push('...');
        for (let i = historyTotalPages - 3; i <= historyTotalPages; i++) pages.push(i);
      } else {
        pages.push(1);
        pages.push('...');
        for (let i = historyPage - 1; i <= historyPage + 1; i++) pages.push(i);
        pages.push('...');
        pages.push(historyTotalPages);
      }
    }
    return pages;
  };

  if (loading) {
    return <div className="loading-state">Loading...</div>;
  }

  return (
    <div className="main-content">
      <div className="page-header">
        <div>
          <h1 className="page-title">Refund Order</h1>
          <p className="page-subtitle">Process refunds for paid orders and view refund history</p>
        </div>
      </div>

      <div className="void-tabs">
        <button 
          className={'void-tab' + (activeTab === 'refund' ? ' active' : '')}
          onClick={() => setActiveTab('refund')}
        >
          Refund Order
        </button>
        <button 
          className={'void-tab' + (activeTab === 'history' ? ' active' : '')}
          onClick={() => setActiveTab('history')}
        >
          Refund History ({refundedOrders.length})
        </button>
      </div>

      {activeTab === 'refund' && (
        <div className="void-form-container">
          <div className="void-form-card refund-card">
            <h2 className="refund-title">Refund an Order</h2>
            <p className="void-instructions refund-instructions">
              Enter the Order ID to search for a paid order and process a refund. 
              Admin authentication is required to authorize all refunds.
            </p>

            <div className="void-form-group">
              <label>Order ID (Transaction ID)</label>
              <div className="search-input-group">
                <input
                  type="text"
                  value={orderId}
                  onChange={(e) => { setOrderId(e.target.value); setSearchError(''); setSearchResult(null); }}
                  placeholder="Enter order ID (e.g., ORD-000031 or 31)"
                  onKeyDown={(e) => e.key === 'Enter' && handleSearchOrder()}
                />
                <button className="search-btn" onClick={handleSearchOrder} disabled={searchLoading}>
                  {searchLoading ? 'Searching...' : 'Search'}
                </button>
              </div>
              {searchError && <span className="error-text">{searchError}</span>}
            </div>

            {searchResult && (
              <div className={'order-preview' + (!canRefund(searchResult.status) ? ' order-preview-disabled' : ' order-preview-refundable')}>
                <div className="order-preview-header">
                  <h3>
                    {canRefund(searchResult.status) ? 'Order Found — Eligible for Refund' : 'Order Found — Not Eligible'}
                  </h3>
                  <span className={'status-badge status-' + searchResult.status}>
                    {searchResult.status}
                  </span>
                </div>

                {!canRefund(searchResult.status) && (
                  <div className="refund-status-warning">
                    {getStatusMessage(searchResult.status)}
                  </div>
                )}

                <div className="order-preview-details">
                  <div className="preview-row">
                    <span>Order ID:</span>
                    <span className="order-id-badge">ORD-{String(searchResult.id || searchResult.transaction_id).padStart(6, '0')}</span>
                  </div>
                  <div className="preview-row">
                    <span>Order #:</span>
                    <span className="beeper-badge">{searchResult.beeper_number || '-'}</span>
                  </div>
                  <div className="preview-row">
                    <span>Status:</span>
                    <span className={'status-badge status-' + searchResult.status}>
                      {searchResult.status}
                    </span>
                  </div>
                  <div className="preview-row">
                    <span>Type:</span>
                    <span>{searchResult.order_type || '-'}</span>
                  </div>
                  <div className="preview-row">
                    <span>Date:</span>
                    <span>{new Date(searchResult.created_at).toLocaleString()}</span>
                  </div>
                </div>

                {searchResult.items && searchResult.items.length > 0 && (
                  <div className="refund-items-section">
                    <h4>Order Items</h4>
                    <div className="refund-items-list">
                      {searchResult.items.map((item, idx) => (
                        <div key={idx} className="refund-item-row">
                          <span className="refund-item-name">
                            {item.quantity}x {item.item_name || item.name}
                          </span>
                          <span className="refund-item-price">
                            P{parseFloat(item.total_price || item.unit_price * item.quantity || 0).toFixed(2)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="order-preview-details">
                  {searchResult.discount_amount > 0 && (
                    <div className="preview-row">
                      <span>Discount:</span>
                      <span className="discount-text">-P{parseFloat(searchResult.discount_amount).toFixed(2)}</span>
                    </div>
                  )}
                  <div className="preview-row total refund-total">
                    <span>Refund Amount:</span>
                    <span>P{parseFloat(searchResult.total_amount || searchResult.total || 0).toFixed(2)}</span>
                  </div>
                </div>
              </div>
            )}

            {searchResult && canRefund(searchResult.status) && (
              <button 
                className="refund-submit-btn"
                onClick={handleInitiateRefund}
              >
                Refund This Order
              </button>
            )}
          </div>
        </div>
      )}

      {activeTab === 'history' && (
        <>
          <div className="search-box" style={{marginBottom: '20px', position: 'relative', width: 'fit-content'}}>
            <svg className="search-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#a1887f'}}>
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
            <input
              type="text"
              className="search-input"
              placeholder="Search refunds..."
              value={historySearch}
              onChange={(e) => setHistorySearch(e.target.value)}
            />
          </div>

          <div className="table-container">
            {filteredRefundedOrders.length === 0 ? (
              <div className="empty-state">{historySearch ? 'No refunded transactions match your search' : 'No refunded transactions'}</div>
            ) : (
              <>
                <div className="table-scroll-wrapper">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Order ID</th>
                        <th>Order #</th>
                        <th>Items</th>
                        <th>Date/Time</th>
                        <th>Refund Amount</th>
                        <th>Refunded By</th>
                        <th>Reason</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedRefundedOrders.map(order => (
                        <tr key={order.transaction_id || order.id} className="refunded-row">
                          <td>ORD-{String(order.order_number || order.transaction_id || order.id).padStart(6, '0')}</td>
                          <td><strong>{order.beeper_number}</strong></td>
                          <td className="items-cell">
                            {order.items && order.items.length > 0 ? (
                              <div className="items-list">
                                {order.items.slice(0, 3).map((item, idx) => (
                                  <span key={idx} className="item-tag">
                                    {item.quantity}x {item.item_name}
                                  </span>
                                ))}
                                {order.items.length > 3 && (
                                  <span className="more-items">+{order.items.length - 3} more</span>
                                )}
                              </div>
                            ) : '-'}
                          </td>
                          <td>{order.refunded_at ? new Date(order.refunded_at).toLocaleString() : '-'}</td>
                          <td className="price-cell refund-amount">P{parseFloat(order.total_amount || order.total || 0).toFixed(2)}</td>
                          <td>{order.refunded_by_name || order.refunded_by_username || 'Admin'}</td>
                          <td className="reason-cell">{order.refund_reason || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              
              {historyTotalPages > 1 && (
                <div className="pagination-container">
                  <span className="pagination-info">
                    Showing {historyStartIndex + 1}-{Math.min(historyEndIndex, filteredRefundedOrders.length)} of {filteredRefundedOrders.length}
                  </span>
                  <button className="pagination-btn" onClick={() => setHistoryPage(1)} disabled={historyPage === 1}>&#171;</button>
                  <button className="pagination-btn" onClick={() => setHistoryPage(historyPage - 1)} disabled={historyPage === 1}>&#8249;</button>
                  {getHistoryPageNumbers().map((page, idx) => (
                    page === '...' ? (
                      <span key={'ellipsis-' + idx} className="pagination-ellipsis">...</span>
                    ) : (
                      <button key={page} className={historyPage === page ? 'pagination-btn active' : 'pagination-btn'} onClick={() => setHistoryPage(page)}>{page}</button>
                    )
                  ))}
                  <button className="pagination-btn" onClick={() => setHistoryPage(historyPage + 1)} disabled={historyPage === historyTotalPages}>&#8250;</button>
                  <button className="pagination-btn" onClick={() => setHistoryPage(historyTotalPages)} disabled={historyPage === historyTotalPages}>&#187;</button>
                </div>
              )}
            </>
          )}
          </div>
        </>
      )}

      {showAuthModal && (
        <div className="modal-overlay" onClick={() => !isProcessing && setShowAuthModal(false)}>
          <div className="modal auth-modal refund-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header refund-modal-header">
              <h2>Admin Authorization Required</h2>
              <button className="modal-close" onClick={() => !isProcessing && setShowAuthModal(false)}>&#10005;</button>
            </div>
            <div className="modal-body">
              <p className="auth-warning refund-auth-info">
                Refunding Order <strong>ORD-{String(searchResult?.id || searchResult?.transaction_id).padStart(6, '0')}</strong>
                <br />
                Order #: <strong>{searchResult?.beeper_number}</strong>
                <br />
                <span className="refund-amount-highlight">Refund Amount: P{parseFloat(searchResult?.total_amount || searchResult?.total || 0).toFixed(2)}</span>
              </p>
              
              <div className="form-group">
                <label>Reason for Refund <span style={{color: '#D97706'}}>*</span></label>
                <textarea
                  value={refundReason}
                  onChange={(e) => setRefundReason(e.target.value)}
                  placeholder="Enter the reason for refunding this order..."
                  rows={2}
                  disabled={isProcessing}
                  style={{width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #ddd', resize: 'none', fontFamily: 'inherit'}}
                />
              </div>

              <div className="form-group">
                <label>Admin Username</label>
                <input
                  type="text"
                  value={adminUsername}
                  onChange={(e) => setAdminUsername(e.target.value)}
                  placeholder="Enter admin username"
                  disabled={isProcessing}
                />
              </div>

              <div className="form-group">
                <label>Admin Password</label>
                <input
                  type="password"
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  placeholder="Enter admin password"
                  disabled={isProcessing}
                  onKeyDown={(e) => e.key === 'Enter' && refundReason.trim() && adminUsername.trim() && adminPassword.trim() && handleConfirmRefund()}
                />
              </div>

              {authError && <div className="auth-error">{authError}</div>}
            </div>
            <div className="modal-footer">
              <button 
                className="btn-secondary" 
                onClick={() => setShowAuthModal(false)}
                disabled={isProcessing}
              >
                Cancel
              </button>
              <button 
                className="btn-refund" 
                onClick={handleConfirmRefund}
                disabled={isProcessing || !refundReason.trim() || !adminUsername.trim() || !adminPassword.trim()}
              >
                {isProcessing ? 'Processing...' : 'Confirm Refund'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showAlert && (
        <div className="modal-overlay" onClick={() => setShowAlert(false)}>
          <div className={'modal alert-modal ' + alertData.type} onClick={e => e.stopPropagation()}>
            <div className="alert-icon">
              {alertData.type === 'success' ? String.fromCodePoint(0x2705) : alertData.type === 'error' ? String.fromCodePoint(0x274C) : String.fromCodePoint(0x2139, 0xFE0F)}
            </div>
            <h3>{alertData.title}</h3>
            <p style={{whiteSpace: 'pre-line'}}>{alertData.message}</p>
            <button className="btn-primary" onClick={() => setShowAlert(false)}>
              OK
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
