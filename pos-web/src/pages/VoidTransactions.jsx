import { useState, useEffect } from 'react';
import api from '../api';
import '../styles/menu-management-styles/index.css';
import '../styles/void-transactions.css';

export default function VoidTransactions() {
  const [voidedOrders, setVoidedOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('void'); // 'void' or 'history'
  const [currentUser, setCurrentUser] = useState(null);
  
  // Void form states
  const [orderId, setOrderId] = useState('');
  const [voidReason, setVoidReason] = useState('');
  const [searchResult, setSearchResult] = useState(null);
  const [searchError, setSearchError] = useState('');
  
  // Admin auth modal (only for cashiers)
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [adminUsername, setAdminUsername] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Confirmation modal (for admins)
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  
  // Alert modal
  const [showAlert, setShowAlert] = useState(false);
  const [alertData, setAlertData] = useState({ title: '', message: '', type: 'info' });

  // Pagination states for void history
  const [historyPage, setHistoryPage] = useState(1);
  const [historySearch, setHistorySearch] = useState('');
  const historyRowsPerPage = 10;

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem('user') || 'null');
    setCurrentUser(user);
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const voidedRes = await api.get('/pos/transactions/voided');
      setVoidedOrders(voidedRes.data.transactions || voidedRes.data || []);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Search for order by Transaction ID
  const handleSearchOrder = async () => {
    if (!orderId.trim()) {
      setSearchError('Please enter an Order ID');
      setSearchResult(null);
      return;
    }

    setSearchError('');
    
    // Parse the order ID - handle formats like "ORD-000031", "000031", or "31"
    let searchId = orderId.trim();
    
    // Remove ORD- or LIB- prefix if present
    if (searchId.toUpperCase().startsWith('ORD-')) {
      searchId = searchId.substring(4); // Remove "ORD-"
    } else if (searchId.toUpperCase().startsWith('LIB-')) {
      setSearchError('Library sessions cannot be voided here. Use Library Management.');
      setSearchResult(null);
      return;
    }
    
    // Remove leading zeros and convert to number
    searchId = parseInt(searchId, 10);
    
    if (isNaN(searchId) || searchId <= 0) {
      setSearchError('Please enter a valid Order ID (e.g., ORD-000031 or 31)');
      setSearchResult(null);
      return;
    }
    
    try {
      // Search by transaction ID
      const res = await api.get(`/pos/transactions/${searchId}`);
      if (res.data) {
        if (res.data.status === 'voided') {
          setSearchError('This order has already been voided');
          setSearchResult(null);
        } else if (res.data.status === 'completed') {
          // Allow voiding completed orders (past transactions)
          setSearchResult(res.data);
        } else {
          setSearchResult(res.data);
        }
      }
    } catch {
      setSearchError(`Order not found with ID: ORD-${String(searchId).padStart(6, '0')}`);
      setSearchResult(null);
    }
  };

  // Initiate void process
  const handleInitiateVoid = () => {
    if (!searchResult) {
      displayAlert('Error', 'Please search for an order first', 'error');
      return;
    }
    if (!voidReason.trim()) {
      displayAlert('Error', 'Please enter a reason for voiding', 'error');
      return;
    }
    
    // If admin, show simple confirmation. If cashier, require admin auth
    if (currentUser?.role === 'admin') {
      setShowConfirmModal(true);
    } else {
      setShowAuthModal(true);
      setAdminUsername('');
      setAdminPassword('');
      setAuthError('');
    }
  };

  // Admin direct confirmation (no credentials needed)
  const handleAdminConfirmVoid = async () => {
    setIsProcessing(true);
    try {
      await api.post(`/pos/transactions/${searchResult.id || searchResult.transaction_id}/void`, {
        reason: voidReason,
        voided_by: currentUser.user_id
      });

      setShowConfirmModal(false);
      setSearchResult(null);
      setOrderId('');
      setVoidReason('');
      displayAlert('Success', 'Order has been voided successfully', 'success');
      fetchData();
    } catch (error) {
      displayAlert('Error', error.response?.data?.error || 'Failed to void order', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  // Process void with admin credentials (for cashiers)
  const handleCashierConfirmVoid = async () => {
    if (!adminUsername.trim() || !adminPassword.trim()) {
      setAuthError('Please enter admin credentials');
      return;
    }

    setIsProcessing(true);
    setAuthError('');

    try {
      // Verify admin credentials
      const authRes = await api.post('/auth/verify-admin', {
        username: adminUsername,
        password: adminPassword
      });

      if (!authRes.data.success) {
        setAuthError('Invalid admin credentials');
        setIsProcessing(false);
        return;
      }

      // Process void
      await api.post(`/pos/transactions/${searchResult.id || searchResult.transaction_id}/void`, {
        reason: voidReason,
        voided_by: authRes.data.admin_id
      });

      setShowAuthModal(false);
      setSearchResult(null);
      setOrderId('');
      setVoidReason('');
      displayAlert('Success', 'Order has been voided successfully', 'success');
      fetchData();
    } catch (error) {
      if (error.response?.status === 401) {
        setAuthError('Invalid admin credentials');
      } else {
        setAuthError(error.response?.data?.error || 'Failed to void order');
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const displayAlert = (title, message, type = 'info') => {
    setAlertData({ title, message, type });
    setShowAlert(true);
  };

  // Filter voided orders based on search
  const filteredVoidedOrders = voidedOrders.filter(order => {
    if (!historySearch.trim()) return true;
    const searchLower = historySearch.toLowerCase();
    const orderId = String(order.order_number || order.transaction_id || order.id || '');
    const orderFormatted = `ord-${orderId.padStart(6, '0')}`;
    const beeper = String(order.beeper_number || '');
    const voidedBy = (order.voided_by_name || '').toLowerCase();
    const reason = (order.void_reason || '').toLowerCase();
    
    return (
      orderId.includes(searchLower) ||
      orderFormatted.includes(searchLower) ||
      beeper.includes(searchLower) ||
      voidedBy.includes(searchLower) ||
      reason.includes(searchLower)
    );
  });

  // Reset page when search changes
  useEffect(() => {
    setHistoryPage(1);
  }, [historySearch, voidedOrders]);

  // Pagination calculations
  const historyTotalPages = Math.ceil(filteredVoidedOrders.length / historyRowsPerPage);
  const historyStartIndex = (historyPage - 1) * historyRowsPerPage;
  const historyEndIndex = historyStartIndex + historyRowsPerPage;
  const paginatedVoidedOrders = filteredVoidedOrders.slice(historyStartIndex, historyEndIndex);

  // Generate page numbers helper
  const getHistoryPageNumbers = () => {
    const pages = [];
    const maxVisiblePages = 5;
    
    if (historyTotalPages <= maxVisiblePages) {
      for (let i = 1; i <= historyTotalPages; i++) {
        pages.push(i);
      }
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
          <h1 className="page-title">Void Transactions</h1>
          <p className="page-subtitle">Void orders and view voided transaction history</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="void-tabs">
        <button 
          className={`void-tab ${activeTab === 'void' ? 'active' : ''}`}
          onClick={() => setActiveTab('void')}
        >
          🚫 Void Order
        </button>
        <button 
          className={`void-tab ${activeTab === 'history' ? 'active' : ''}`}
          onClick={() => setActiveTab('history')}
        >
          📋 Void History ({voidedOrders.length})
        </button>
      </div>

      {/* Void Order Tab */}
      {activeTab === 'void' && (
        <div className="void-form-container">
          <div className="void-form-card">
            <h2>Void an Order</h2>
            <p className="void-instructions">
              Enter the unique Order ID to find and void an order. 
              {currentUser?.role === 'admin' 
                ? ' As an admin, you can void directly.' 
                : ' Admin authentication is required for cashiers.'}
            </p>

            {/* Search Order */}
            <div className="void-form-group">
              <label>Order ID (Transaction ID)</label>
              <div className="search-input-group">
                <input
                  type="text"
                  value={orderId}
                  onChange={(e) => setOrderId(e.target.value)}
                  placeholder="Enter order ID (e.g., ORD-000031 or 31)"
                  onKeyPress={(e) => e.key === 'Enter' && handleSearchOrder()}
                />
                <button className="search-btn" onClick={handleSearchOrder}>
                  🔍 Search
                </button>
              </div>
              {searchError && <span className="error-text">{searchError}</span>}
            </div>

            {/* Order Details */}
            {searchResult && (
              <div className="order-preview">
                <h3>Order Found</h3>
                <div className="order-preview-details">
                  <div className="preview-row">
                    <span>Order ID:</span>
                    <span className="order-id-badge">ORD-{String(searchResult.id || searchResult.transaction_id).padStart(6, '0')}</span>
                  </div>
                  <div className="preview-row">
                    <span>Order Number:</span>
                    <span>{searchResult.order_number || '-'}</span>
                  </div>
                  <div className="preview-row">
                    <span>Order #:</span>
                    <span className="beeper-badge">🔔 {searchResult.beeper_number || '-'}</span>
                  </div>
                  <div className="preview-row">
                    <span>Status:</span>
                    <span className={`status-badge status-${searchResult.status}`}>
                      {searchResult.status}
                    </span>
                  </div>
                  <div className="preview-row">
                    <span>Type:</span>
                    <span>{searchResult.order_type}</span>
                  </div>
                  <div className="preview-row">
                    <span>Date:</span>
                    <span>{new Date(searchResult.created_at).toLocaleString()}</span>
                  </div>
                  <div className="preview-row total">
                    <span>Total:</span>
                    <span>₱{parseFloat(searchResult.total_amount || searchResult.total || 0).toFixed(2)}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Void Reason */}
            {searchResult && (
              <div className="void-form-group">
                <label>Reason for Void <span className="required">*</span></label>
                <textarea
                  value={voidReason}
                  onChange={(e) => setVoidReason(e.target.value)}
                  placeholder="Enter the reason for voiding this order (e.g., Wrong order, Customer changed mind, Duplicate entry)..."
                  rows={2}
                />
              </div>
            )}

            {/* Void Button */}
            {searchResult && (
              <button 
                className="void-submit-btn"
                onClick={handleInitiateVoid}
                disabled={!voidReason.trim()}
              >
                🚫 Void This Order
              </button>
            )}
          </div>
        </div>
      )}

      {/* History Tab */}
      {activeTab === 'history' && (
        <>
          {/* Search Bar - Outside table container */}
          <div className="search-box" style={{marginBottom: '20px', position: 'relative', width: 'fit-content'}}>
            <svg className="search-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#a1887f'}}>
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
            <input
              type="text"
              className="search-input"
              placeholder="Search items..."
              value={historySearch}
              onChange={(e) => setHistorySearch(e.target.value)}
            />
          </div>

          <div className="table-container">
            {filteredVoidedOrders.length === 0 ? (
              <div className="empty-state">{historySearch ? 'No voided transactions match your search' : 'No voided transactions'}</div>
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
                        <th>Original Amount</th>
                        <th>Voided By</th>
                        <th>Reason</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedVoidedOrders.map(order => (
                        <tr key={order.transaction_id || order.id}>
                          <td>ORD-{String(order.order_number || order.transaction_id || order.id).padStart(6, '0')}</td>
                          <td><strong>🔔 {order.beeper_number}</strong></td>
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
                          <td>{order.voided_at ? new Date(order.voided_at).toLocaleString() : '-'}</td>
                          <td className="price-cell">₱{parseFloat(order.total_amount || order.total || 0).toFixed(2)}</td>
                          <td>{order.voided_by_name || 'Admin'}</td>
                          <td className="reason-cell">{order.void_reason || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              
              {historyTotalPages > 1 && (
                <div className="pagination-container">
                  <span className="pagination-info">
                    Showing {historyStartIndex + 1}-{Math.min(historyEndIndex, filteredVoidedOrders.length)} of {filteredVoidedOrders.length}
                  </span>
                  <button className="pagination-btn" onClick={() => setHistoryPage(1)} disabled={historyPage === 1}>«</button>
                  <button className="pagination-btn" onClick={() => setHistoryPage(historyPage - 1)} disabled={historyPage === 1}>‹</button>
                  {getHistoryPageNumbers().map((page, idx) => (
                    page === '...' ? (
                      <span key={`ellipsis-${idx}`} className="pagination-ellipsis">...</span>
                    ) : (
                      <button key={page} className={historyPage === page ? 'pagination-btn active' : 'pagination-btn'} onClick={() => setHistoryPage(page)}>{page}</button>
                    )
                  ))}
                  <button className="pagination-btn" onClick={() => setHistoryPage(historyPage + 1)} disabled={historyPage === historyTotalPages}>›</button>
                  <button className="pagination-btn" onClick={() => setHistoryPage(historyTotalPages)} disabled={historyPage === historyTotalPages}>»</button>
                </div>
              )}
            </>
          )}
          </div>
        </>
      )}

      {/* Admin Auth Modal */}
      {showAuthModal && (
        <div className="modal-overlay" onClick={() => setShowAuthModal(false)}>
          <div className="modal auth-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>🔐 Admin Authorization Required</h2>
              <button className="modal-close" onClick={() => setShowAuthModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              <p className="auth-warning">
                Voiding Order #{searchResult?.id} (Order #{searchResult?.beeper_number})
                <br />
                <strong>Amount: ₱{parseFloat(searchResult?.total || 0).toFixed(2)}</strong>
              </p>
              
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
                  onKeyPress={(e) => e.key === 'Enter' && handleCashierConfirmVoid()}
                />
              </div>

              {authError && <div className="auth-error">{authError}</div>}

              <div className="void-reason-preview">
                <strong>Void Reason:</strong> {voidReason}
              </div>
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
                className="btn-danger" 
                onClick={handleCashierConfirmVoid}
                disabled={isProcessing}
              >
                {isProcessing ? 'Processing...' : '🚫 Confirm Void'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Admin Confirmation Modal (No credentials needed) */}
      {showConfirmModal && (
        <div className="modal-overlay" onClick={() => setShowConfirmModal(false)}>
          <div className="modal confirm-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>⚠️ Confirm Void Order</h2>
              <button className="modal-close" onClick={() => setShowConfirmModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              <p className="auth-warning">
                Are you sure you want to void this order?
                <br /><br />
                <strong>Order ORD-{String(searchResult?.id || searchResult?.transaction_id).padStart(6, '0')}</strong>
                <br />
                Order #: {searchResult?.beeper_number}
                <br />
                <strong>Amount: ₱{parseFloat(searchResult?.total || 0).toFixed(2)}</strong>
              </p>
              
              <div className="void-reason-preview">
                <strong>Void Reason:</strong> {voidReason}
              </div>
            </div>
            <div className="modal-footer">
              <button 
                className="btn-secondary" 
                onClick={() => setShowConfirmModal(false)}
                disabled={isProcessing}
              >
                Cancel
              </button>
              <button 
                className="btn-danger" 
                onClick={handleAdminConfirmVoid}
                disabled={isProcessing}
              >
                {isProcessing ? 'Processing...' : '🚫 Confirm Void'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Alert Modal */}
      {showAlert && (
        <div className="modal-overlay" onClick={() => setShowAlert(false)}>
          <div className={`modal alert-modal ${alertData.type}`} onClick={e => e.stopPropagation()}>
            <div className="alert-icon">
              {alertData.type === 'success' ? '✅' : alertData.type === 'error' ? '❌' : 'ℹ️'}
            </div>
            <h3>{alertData.title}</h3>
            <p>{alertData.message}</p>
            <button className="btn-primary" onClick={() => setShowAlert(false)}>
              OK
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
