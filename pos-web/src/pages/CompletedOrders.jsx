import { useState, useEffect } from 'react';
import api from '../api';
import '../styles/menu.css';
import '../styles/orders.css';

export default function CompletedOrders() {
  const [completedOrders, setCompletedOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [printing, setPrinting] = useState(null);
  
  // Search and Pagination
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 10;

  const fetchCompletedOrders = async () => {
    try {
      const response = await api.get('/pos/transactions/completed');
      setCompletedOrders(response.data.transactions || []);
    } catch (error) {
      console.error('Error fetching completed orders:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCompletedOrders();
  }, []);

  // Filter orders based on search
  const filteredOrders = completedOrders.filter(function(order) {
    if (!searchTerm.trim()) return true;
    const search = searchTerm.toLowerCase();
    return (
      String(order.beeper_number).includes(search) ||
      (order.order_type && order.order_type.toLowerCase().includes(search)) ||
      (order.processed_by_name && order.processed_by_name.toLowerCase().includes(search)) ||
      String(order.total_amount).includes(search)
    );
  });

  // Pagination calculations
  const totalPages = Math.ceil(filteredOrders.length / rowsPerPage);
  const startIndex = (currentPage - 1) * rowsPerPage;
  const endIndex = startIndex + rowsPerPage;
  const paginatedOrders = filteredOrders.slice(startIndex, endIndex);

  // Generate page numbers
  const getPageNumbers = function() {
    var pages = [];
    var maxVisible = 5;
    var start = Math.max(1, currentPage - Math.floor(maxVisible / 2));
    var end = Math.min(totalPages, start + maxVisible - 1);
    if (end - start + 1 < maxVisible) {
      start = Math.max(1, end - maxVisible + 1);
    }
    for (var i = start; i <= end; i++) {
      pages.push(i);
    }
    return pages;
  };

  // Reset page when search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  };

  const handleReprintReceipt = async (transactionId) => {
    try {
      setPrinting(transactionId);
      await api.post(`/printer/reprint/${transactionId}`);
      alert('Receipt sent to printer!');
    } catch (error) {
      console.error('Print error:', error);
      alert('Failed to print receipt. Check printer connection.');
    } finally {
      setPrinting(null);
    }
  };

  if (loading) {
    return <div className="loading-state">Loading...</div>;
  }

  return (
    <div className="main-content">
      <div className="page-header">
        <div>
          <h1 className="page-title">Completed Orders</h1>
          <p className="page-subtitle">Today's completed transactions</p>
        </div>
      </div>

      {/* Search Bar - Outside table, similar to Void History */}
      {completedOrders.length > 0 && (
        <div className="search-box" style={{marginBottom: '20px', position: 'relative', width: 'fit-content'}}>
          <svg className="search-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#a1887f'}}>
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
          <input
            type="text"
            className="search-input"
            placeholder="Search by beeper, type, cashier..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      )}

      <div className="table-card" style={{ background: 'white', borderRadius: '16px', overflow: 'hidden', border: '2px solid #d7ccc8' }}>
        {completedOrders.length === 0 ? (
          <div style={{
            padding: '60px 40px',
            textAlign: 'center',
            color: '#8d6e63',
            fontSize: '16px',
            background: 'white',
            borderRadius: '16px'
          }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>✅</div>
            <div style={{ fontWeight: '600', marginBottom: '8px' }}>No completed orders today</div>
            <div style={{ fontSize: '14px', color: '#a1887f' }}>Completed orders will be listed here</div>
          </div>
        ) : filteredOrders.length === 0 ? (
          <div style={{
            padding: '60px 40px',
            textAlign: 'center',
            color: '#8d6e63',
            fontSize: '16px',
            background: 'white',
            borderRadius: '16px'
          }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔍</div>
            <div style={{ fontWeight: '600', marginBottom: '8px' }}>No orders found</div>
            <div style={{ fontSize: '14px', color: '#a1887f' }}>Try a different search term</div>
          </div>
        ) : (
          <>
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse', minWidth: '800px' }}>
                <thead style={{ background: '#f5f0e8' }}>
                  <tr>
                    <th style={{ padding: '16px 20px', textAlign: 'left', fontWeight: '700', color: '#3e2723', borderBottom: '2px solid #d7ccc8' }}>Order #</th>
                    <th style={{ padding: '16px 20px', textAlign: 'left', fontWeight: '700', color: '#3e2723', borderBottom: '2px solid #d7ccc8' }}>Order Type</th>
                    <th style={{ padding: '16px 20px', textAlign: 'left', fontWeight: '700', color: '#3e2723', borderBottom: '2px solid #d7ccc8' }}>Total</th>
                    <th style={{ padding: '16px 20px', textAlign: 'left', fontWeight: '700', color: '#3e2723', borderBottom: '2px solid #d7ccc8' }}>Cash</th>
                    <th style={{ padding: '16px 20px', textAlign: 'left', fontWeight: '700', color: '#3e2723', borderBottom: '2px solid #d7ccc8' }}>Change</th>
                    <th style={{ padding: '16px 20px', textAlign: 'left', fontWeight: '700', color: '#3e2723', borderBottom: '2px solid #d7ccc8' }}>Completed</th>
                    <th style={{ padding: '16px 20px', textAlign: 'left', fontWeight: '700', color: '#3e2723', borderBottom: '2px solid #d7ccc8' }}>Processed By</th>
                    <th style={{ padding: '16px 20px', textAlign: 'center', fontWeight: '700', color: '#3e2723', borderBottom: '2px solid #d7ccc8' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedOrders.map((order) => (
                    <tr key={order.transaction_id} style={{ borderBottom: '1px solid #e8e0d8' }}>
                      <td style={{ padding: '16px 20px' }}><strong style={{ color: '#3e2723' }}>#{order.beeper_number}</strong></td>
                      <td style={{ padding: '16px 20px' }}>
                        <span style={{
                          background: '#f5f0e8',
                          padding: '4px 12px',
                          borderRadius: '6px',
                          fontSize: '12px',
                          textTransform: 'uppercase',
                          fontWeight: '600',
                          color: '#5d4037',
                          border: '1px solid #d7ccc8'
                        }}>
                          {order.order_type}
                        </span>
                      </td>
                      <td style={{ padding: '16px 20px', fontWeight: '700', color: '#a1887f' }}>₱{parseFloat(order.total_amount).toFixed(2)}</td>
                      <td style={{ padding: '16px 20px', color: '#5d4037' }}>₱{parseFloat(order.cash_tendered || 0).toFixed(2)}</td>
                      <td style={{ padding: '16px 20px', color: '#5d4037' }}>₱{parseFloat(order.change_due || 0).toFixed(2)}</td>
                      <td style={{ padding: '16px 20px', color: '#8d6e63' }}>{formatTime(order.completed_at)}</td>
                      <td style={{ padding: '16px 20px', color: '#5d4037' }}>{order.processed_by_name || '-'}</td>
                      <td style={{ padding: '16px 20px', textAlign: 'center' }}>
                        <button
                          onClick={() => handleReprintReceipt(order.transaction_id)}
                          disabled={printing === order.transaction_id}
                          style={{
                            background: '#5d4037',
                            color: 'white',
                            border: 'none',
                            padding: '8px 16px',
                            borderRadius: '8px',
                            cursor: printing === order.transaction_id ? 'not-allowed' : 'pointer',
                            fontWeight: '600',
                            fontSize: '13px',
                            opacity: printing === order.transaction_id ? 0.6 : 1,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px'
                          }}
                        >
                          🖨️ {printing === order.transaction_id ? 'Printing...' : 'Reprint'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination - Only show when more than 1 page */}
            {totalPages > 1 && (
              <div className="pagination-container">
                <span className="pagination-info">
                  Showing {startIndex + 1} - {Math.min(endIndex, filteredOrders.length)} of {filteredOrders.length} orders
                </span>
                <div className="pagination-controls">
                  <button className="pagination-btn" onClick={() => setCurrentPage(1)} disabled={currentPage === 1} title="First Page">«</button>
                  <button className="pagination-btn" onClick={() => setCurrentPage(currentPage - 1)} disabled={currentPage === 1} title="Previous Page">‹</button>
                  {getPageNumbers().map(function(pageNum) {
                    return (
                      <button key={pageNum} className={currentPage === pageNum ? 'pagination-btn active' : 'pagination-btn'} onClick={() => setCurrentPage(pageNum)}>{pageNum}</button>
                    );
                  })}
                  <button className="pagination-btn" onClick={() => setCurrentPage(currentPage + 1)} disabled={currentPage === totalPages} title="Next Page">›</button>
                  <button className="pagination-btn" onClick={() => setCurrentPage(totalPages)} disabled={currentPage === totalPages} title="Last Page">»</button>
                </div>
              </div>
            )}

            {/* Single page info when only 1 page */}
            {totalPages === 1 && filteredOrders.length > 0 && (
              <div style={{
                padding: '12px 20px',
                background: '#f8f9fa',
                borderTop: '1px solid #e9ecef',
                fontSize: '14px',
                color: '#666'
              }}>
                Showing {filteredOrders.length} order{filteredOrders.length !== 1 ? 's' : ''}
              </div>
            )}
          </>
        )}
      </div>

      {completedOrders.length > 0 && (
        <div style={{ 
          marginTop: '20px', 
          padding: '20px 24px', 
          background: 'white', 
          borderRadius: '12px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          border: '2px solid #d7ccc8',
          flexWrap: 'wrap',
          gap: '16px'
        }}>
          <div style={{ color: '#5d4037', fontWeight: '500' }}>
            <strong>Total Transactions:</strong> {completedOrders.length}
          </div>
          <div style={{ fontSize: '20px', fontWeight: '700', color: '#3e2723' }}>
            Total Sales: <span style={{ color: '#a1887f' }}>₱{completedOrders.reduce((sum, o) => sum + parseFloat(o.total_amount), 0).toFixed(2)}</span>
          </div>
        </div>
      )}
    </div>
  );
}
