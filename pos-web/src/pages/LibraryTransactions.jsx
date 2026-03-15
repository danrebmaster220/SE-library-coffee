import { useState, useEffect, useCallback, useRef } from 'react';
import api from '../api';
import socketService from '../services/socketService';
import { printLibraryCheckinReceipt, printLibraryExtensionReceipt } from '../services/webPrinter';
import Toast from '../components/Toast';
import '../styles/library.css';

export default function LibraryTransactions() {
  const [seats, setSeats] = useState([]);
  const [tables, setTables] = useState([]);
  const [activeSessions, setActiveSessions] = useState([]);
  const [sessionHistory, setSessionHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('grid'); // 'grid', 'list', 'history'
  
  const [showCheckinModal, setShowCheckinModal] = useState(false);
  const [showSessionModal, setShowSessionModal] = useState(false);
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [showWarningModal, setShowWarningModal] = useState(false);
  const [showVoidModal, setShowVoidModal] = useState(false);
  const [warningSession, setWarningSession] = useState(null);
  const [selectedSeat, setSelectedSeat] = useState(null);
  const [selectedSession, setSelectedSession] = useState(null);
  const [voidingSession, setVoidingSession] = useState(null);
  
  // History filters
  const [historyFilter, setHistoryFilter] = useState('all'); // 'all', 'completed', 'voided'
  
  // Search and Pagination for Session History
  const [historySearch, setHistorySearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 10;
  
  // Pagination for Active Sessions
  const [activeSessionsPage, setActiveSessionsPage] = useState(1);
  const activeRowsPerPage = 10;
  
  const [toast, setToast] = useState({ show: false, message: '', type: 'info' });
  const warningShownRef = useRef(new Set());

  // Get user role from localStorage
  const getUserRole = () => {
    try {
      const user = JSON.parse(localStorage.getItem('user'));
      return user?.role?.toLowerCase() || 'cashier';
    } catch {
      return 'cashier';
    }
  };
  const userRole = getUserRole();
  const isAdmin = userRole === 'admin';

  const showToast = useCallback((message, type = 'info') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: '', type: 'info' }), 3000);
  }, []);

  const fetchData = useCallback(async () => {
    try {
      const response = await api.get('/library/seats');
      const seatsData = response.data || [];
      setSeats(seatsData);
      
      // Build table info with names
      const tableMap = {};
      seatsData.forEach(s => {
        if (!tableMap[s.table_number]) {
          tableMap[s.table_number] = s.table_name || `Table ${s.table_number}`;
        }
      });
      const tableNumbers = Object.keys(tableMap).map(Number).sort((a, b) => a - b);
      setTables(tableNumbers.map(num => ({ table_number: num, table_name: tableMap[num] })));
      
      const active = seatsData
        .filter(s => s.status === 'occupied' && s.session_id)
        .map(s => ({
          session_id: s.session_id,
          seat_id: s.seat_id,
          table_number: s.table_number,
          table_name: s.table_name || `Table ${s.table_number}`,
          seat_number: s.seat_number,
          customer_name: s.customer_name,
          start_time: s.start_time,
          elapsed_minutes: s.elapsed_minutes || 0,
          remaining_minutes: s.remaining_minutes || 0,
          paid_minutes: s.paid_minutes || 120,
          amount_paid: s.amount_paid || 100,
          status: 'active'
        }));
      
      setActiveSessions(active);
      
      active.forEach(session => {
        const remaining = session.remaining_minutes;
        if (remaining <= 5 && remaining > 0 && !warningShownRef.current.has(session.session_id)) {
          warningShownRef.current.add(session.session_id);
          setWarningSession(session);
          setShowWarningModal(true);
        }
      });
      
    } catch (error) {
      console.error('Error fetching data:', error);
      showToast('Failed to load data', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  const fetchHistory = useCallback(async () => {
    try {
      const response = await api.get('/library/history', {
        params: { status: historyFilter !== 'all' ? historyFilter : undefined }
      });
      setSessionHistory(response.data || []);
      setCurrentPage(1); // Reset to first page when filter changes
    } catch (error) {
      console.error('Error fetching history:', error);
      showToast('Failed to load session history', 'error');
    }
  }, [historyFilter, showToast]);

  // Filter session history based on search term
  const filteredHistory = sessionHistory.filter(function(session) {
    if (!historySearch.trim()) return true;
    const search = historySearch.toLowerCase();
    const sessionId = 'lib-' + String(session.session_id).padStart(6, '0');
    return (
      sessionId.includes(search) ||
      (session.customer_name && session.customer_name.toLowerCase().includes(search)) ||
      ('table ' + session.table_number).toLowerCase().includes(search) ||
      ('seat ' + session.seat_number).toLowerCase().includes(search) ||
      (session.status && session.status.toLowerCase().includes(search))
    );
  });

  // Pagination calculations
  const totalPages = Math.ceil(filteredHistory.length / rowsPerPage);
  const startIndex = (currentPage - 1) * rowsPerPage;
  const endIndex = startIndex + rowsPerPage;
  const paginatedHistory = filteredHistory.slice(startIndex, endIndex);

  // Generate page numbers to display
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
  }, [historySearch]);

  // Active Sessions pagination calculations
  const activeTotalPages = Math.ceil(activeSessions.length / activeRowsPerPage);
  const activeStartIndex = (activeSessionsPage - 1) * activeRowsPerPage;
  const activeEndIndex = activeStartIndex + activeRowsPerPage;
  const paginatedActiveSessions = activeSessions.slice(activeStartIndex, activeEndIndex);

  // Generate page numbers for active sessions
  const getActivePageNumbers = function() {
    var pages = [];
    var maxVisible = 5;
    var start = Math.max(1, activeSessionsPage - Math.floor(maxVisible / 2));
    var end = Math.min(activeTotalPages, start + maxVisible - 1);
    if (end - start + 1 < maxVisible) {
      start = Math.max(1, end - maxVisible + 1);
    }
    for (var i = start; i <= end; i++) {
      pages.push(i);
    }
    return pages;
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000);
    
    const handleSeatLocked = (data) => {
      setSeats(prev => prev.map(s => 
        s.seat_id === data.seatId ? { ...s, status: 'occupied', temporary_lock: true } : s
      ));
    };

    const handleSeatReleased = (data) => {
      setSeats(prev => prev.map(s => 
        (s.seat_id === data.seatId || s.seat_id === data.seat_id) && s.temporary_lock 
          ? { ...s, status: 'available', temporary_lock: false } 
          : s
      ));
    };

    socketService.on('seat:locked', handleSeatLocked);
    socketService.on('seat:released', handleSeatReleased);
    
    return () => {
      clearInterval(interval);
      socketService.off('seat:locked', handleSeatLocked);
      socketService.off('seat:released', handleSeatReleased);
    };
  }, [fetchData]);

  useEffect(() => {
    if (viewMode === 'history') {
      fetchHistory();
    }
  }, [viewMode, historyFilter, fetchHistory]);

  const handleSeatClick = (seat) => {
    setSelectedSeat(seat);
    if (seat.status === 'available' && !seat.temporary_lock) {
      setShowCheckinModal(true);
    } else if (seat.temporary_lock) {
      showToast('This seat is currently being booked by a Kiosk customer.', 'warning');
      setSelectedSeat(null);
    } else if (seat.status === 'occupied') {
      const session = activeSessions.find(s => s.seat_id === seat.seat_id);
      if (session) {
        setSelectedSession(session);
        setShowSessionModal(true);
      } else {
        // Fallback for when session info isn't found
        showToast('Seat is occupied but session info is missing or still synchronizing.', 'warning');
        setSelectedSeat(null);
      }
    } else if (seat.status === 'maintenance') {
      showToast('This seat is under maintenance', 'warning');
      setSelectedSeat(null);
    }
  };

  const handleCheckin = async (customerName, cashTendered) => {
    if (!selectedSeat) return;
    const fee = 100; // ₱100 for first 2 hours
    try {
      const response = await api.post('/library/checkin', {
        seat_id: selectedSeat.seat_id,
        customer_name: customerName,
        duration_minutes: 120,  // Initial 2 hours
        amount_paid: fee,
        cash_tendered: cashTendered
      });
      showToast('Check-in successful!', 'success');
      
      // Print check-in receipt via print server
      if (response.data.receipt_data) {
        try {
          await printLibraryCheckinReceipt(response.data.receipt_data);
        } catch (printErr) {
          console.error('Receipt print failed:', printErr);
        }
      }
      
      setShowCheckinModal(false);
      setSelectedSeat(null);
      fetchData();
    } catch (error) {
      showToast(error.response?.data?.error || 'Check-in failed', 'error');
    }
  };

  const handleExtend = async (minutes) => {
    if (!selectedSession) return;
    try {
      const response = await api.post('/library/extend', {
        session_id: selectedSession.session_id,
        minutes
      });
      showToast('Session extended by ' + minutes + ' minutes', 'success');
      
      // Print extension receipt via print server
      if (response.data.receipt_data) {
        try {
          await printLibraryExtensionReceipt(response.data.receipt_data);
        } catch (printErr) {
          console.error('Extension receipt print failed:', printErr);
        }
      }
      
      setShowSessionModal(false);
      setSelectedSession(null);
      fetchData();
    } catch (error) {
      showToast(error.response?.data?.error || 'Extension failed', 'error');
    }
  };

  const handleCheckout = async () => {
    if (!selectedSession) return;
    try {
      await api.post('/library/checkout', {
        session_id: selectedSession.session_id
      });
      showToast('Checkout successful! ID returned to customer.', 'success');
      setShowCheckoutModal(false);
      setShowSessionModal(false);
      setSelectedSession(null);
      fetchData();
    } catch (error) {
      showToast(error.response?.data?.error || 'Checkout failed', 'error');
    }
  };

  const handleVoidSession = async (sessionId, reason, adminCredentials = null) => {
    if (!voidingSession) return false;
    try {
      await api.post('/library/void', {
        session_id: sessionId,
        reason: reason,
        admin_credentials: adminCredentials
      });
      showToast('Session voided successfully', 'success');
      setShowVoidModal(false);
      setVoidingSession(null);
      fetchData();
      if (viewMode === 'history') {
        fetchHistory();
      }
      return true;
    } catch (error) {
      showToast(error.response?.data?.error || 'Failed to void session', 'error');
      return false;
    }
  };

  const openVoidModal = (session) => {
    setVoidingSession(session);
    setShowVoidModal(true);
  };

  const calculateFee = (minutes) => {
    let fee = 100.00;
    if (minutes > 120) {
      fee += Math.ceil((minutes - 120) / 30) * 50;
    }
    return fee;
  };

  const formatTime = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('en-PH', { month: '2-digit', day: '2-digit', year: 'numeric' });
  };

  const formatDateTime = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleString('en-PH', { 
      month: '2-digit', day: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: true 
    });
  };

  const formatDuration = (minutes) => {
    if (!minutes) return '0 min';
    const hrs = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hrs > 0 ? hrs + 'h ' + mins + 'm' : mins + ' min';
  };

  const availableCount = seats.filter(s => s.status === 'available').length;
  const occupiedCount = seats.filter(s => s.status === 'occupied').length;
  const maintenanceCount = seats.filter(s => s.status === 'maintenance').length;
  const activeRevenue = activeSessions.reduce((sum, s) => sum + calculateFee(s.elapsed_minutes), 0);

  const groupedSeats = tables.map(table => ({
    tableNum: table.table_number,
    tableName: table.table_name,
    seats: seats.filter(s => s.table_number === table.table_number).sort((a, b) => a.seat_number - b.seat_number)
  }));

  if (loading) {
    return (
      <div className="main-content">
        <div className="page-header">
          <h2 className="page-title">Library Management</h2>
          <p className="page-subtitle">Transactions and Monitoring</p>
        </div>
        <div className="loading-state">Loading...</div>
      </div>
    );
  }

  return (
    <div className="main-content">
      <div className="page-header">
        <h2 className="page-title">Library Management</h2>
        <p className="page-subtitle">Transactions and Monitoring</p>
      </div>

      <div className="library-stats">
        <div className="stat-card stat-available">
          <div className="stat-value">{availableCount}</div>
          <div className="stat-label">Available</div>
        </div>
        <div className="stat-card stat-occupied">
          <div className="stat-value">{occupiedCount}</div>
          <div className="stat-label">Occupied</div>
        </div>
        {maintenanceCount > 0 && (
          <div className="stat-card stat-maintenance">
            <div className="stat-value">{maintenanceCount}</div>
            <div className="stat-label">Maintenance</div>
          </div>
        )}
        <div className="stat-card stat-revenue">
          <div className="stat-value">P{activeRevenue.toFixed(2)}</div>
          <div className="stat-label">Active Revenue</div>
        </div>
      </div>

      <div className="view-toggle-container">
        <div className="view-toggle">
          <button className={'toggle-btn ' + (viewMode === 'grid' ? 'active' : '')} onClick={() => setViewMode('grid')}>Seat Grid</button>
          <button className={'toggle-btn ' + (viewMode === 'list' ? 'active' : '')} onClick={() => setViewMode('list')}>Active Sessions</button>
          <button className={'toggle-btn ' + (viewMode === 'history' ? 'active' : '')} onClick={() => setViewMode('history')}>Session History</button>
        </div>
        {viewMode !== 'history' && (
          <div className="legend">
            <span className="legend-item"><span className="legend-dot available"></span> Available</span>
            <span className="legend-item"><span className="legend-dot occupied"></span> Occupied</span>
            {maintenanceCount > 0 && (<span className="legend-item"><span className="legend-dot maintenance"></span> Maintenance</span>)}
          </div>
        )}
        {viewMode === 'history' && (
          <div className="history-filters">
            <input 
              type="text" 
              placeholder="Search by ID, customer, table..." 
              value={historySearch}
              onChange={(e) => setHistorySearch(e.target.value)}
              className="history-search-input"
            />
            <select value={historyFilter} onChange={(e) => setHistoryFilter(e.target.value)} className="filter-select">
              <option value="all">All Sessions</option>
              <option value="completed">Completed</option>
              <option value="voided">Voided</option>
            </select>
          </div>
        )}
      </div>

      {viewMode === 'grid' && (
        <div className="seat-grid-container">
          {seats.length === 0 ? (
            <div className="empty-state"><p>No seats configured yet.</p><p>Go to Manage Tables to add tables and seats.</p></div>
          ) : (
            <div className="tables-grid">
              {groupedSeats.map(function(group) {
                return (
                  <div key={group.tableNum} className="table-section-compact">
                    <div className="table-header-compact">{group.tableName}</div>
                    <div className="seats-row">
                      {group.seats.map(function(seat) {
                        var seatClass = 'seat-item ';
                        if (seat.status === 'available') seatClass += 'seat-available';
                        else if (seat.status === 'occupied') seatClass += 'seat-occupied';
                        else seatClass += 'seat-maintenance';
                        return (
                          <div key={seat.seat_id} className={seatClass} onClick={function() { handleSeatClick(seat); }} title={seat.temporary_lock ? 'Being booked by Kiosk...' : seat.status === 'occupied' ? (seat.customer_name || 'Customer') + ' - ' + (seat.elapsed_minutes || 0) + ' mins' : seat.status}>
                            <span className="seat-number">{seat.seat_number}</span>
                            {seat.status === 'occupied' && seat.remaining_minutes <= 5 && seat.remaining_minutes > 0 && (<span className="warning-indicator">!</span>)}
                            {seat.temporary_lock && <span className="warning-indicator" style={{background: 'orange', color: 'white'}}>⏰</span>}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {viewMode === 'list' && (
        <div className="sessions-list-container">
          {activeSessions.length === 0 ? (
            <div className="empty-state"><p>No active sessions.</p></div>
          ) : (
            <>
              <table className="transactions-table">
                <thead><tr><th>Location</th><th>Customer</th><th>Start Time</th><th>Duration</th><th>Remaining</th><th>Amount</th><th>Actions</th></tr></thead>
                <tbody>
                  {paginatedActiveSessions.map(function(session) {
                    return (
                      <tr key={session.session_id} className={session.remaining_minutes <= 5 && session.remaining_minutes > 0 ? 'warning-row' : ''}>
                        <td>{session.table_name}, Seat {session.seat_number}</td>
                        <td>{session.customer_name || '-'}</td>
                        <td>{formatTime(session.start_time)}</td>
                        <td>{formatDuration(session.elapsed_minutes)}</td>
                        <td><span className={session.remaining_minutes <= 5 ? 'time-warning' : ''}>{formatDuration(session.remaining_minutes)}</span></td>
                        <td>P{calculateFee(session.elapsed_minutes).toFixed(2)}</td>
                        <td className="actions-cell">
                          <button className="btn-action" onClick={function() { setSelectedSession(session); setShowSessionModal(true); }}>Manage</button>
                          <button className="btn-void-small" style={{background: '#dc3545', color: 'white', border: 'none', padding: '8px 14px', borderRadius: '6px', fontWeight: '600', cursor: 'pointer'}} onClick={function() { openVoidModal(session); }}>Void</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              
              {activeTotalPages > 1 && (
                <div className="pagination-container">
                  <span className="pagination-info">
                    Showing {activeStartIndex + 1}-{Math.min(activeEndIndex, activeSessions.length)} of {activeSessions.length}
                  </span>
                  <button className="pagination-btn" onClick={function() { setActiveSessionsPage(1); }} disabled={activeSessionsPage === 1}>«</button>
                  <button className="pagination-btn" onClick={function() { setActiveSessionsPage(activeSessionsPage - 1); }} disabled={activeSessionsPage === 1}>‹</button>
                  {getActivePageNumbers().map(function(page) {
                    if (page === '...') {
                      return <span key={page + Math.random()} className="pagination-ellipsis">...</span>;
                    }
                    return (
                      <button key={page} className={activeSessionsPage === page ? 'pagination-btn active' : 'pagination-btn'} onClick={function() { setActiveSessionsPage(page); }}>{page}</button>
                    );
                  })}
                  <button className="pagination-btn" onClick={function() { setActiveSessionsPage(activeSessionsPage + 1); }} disabled={activeSessionsPage === activeTotalPages}>›</button>
                  <button className="pagination-btn" onClick={function() { setActiveSessionsPage(activeTotalPages); }} disabled={activeSessionsPage === activeTotalPages}>»</button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {viewMode === 'history' && (
        <div className="sessions-list-container">
          {filteredHistory.length === 0 ? (
            <div className="empty-state">
              <p>{historySearch ? 'No sessions found matching your search.' : 'No session history found.'}</p>
            </div>
          ) : (
            <>
              <div className="table-scroll-wrapper">
                <table className="transactions-table">
                  <thead>
                    <tr>
                      <th>Session #</th>
                      <th>Date</th>
                      <th>Location</th>
                      <th>Customer</th>
                      <th>Duration</th>
                      <th>Amount</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedHistory.map(function(session) {
                      return (
                        <tr key={session.session_id} className={session.status === 'voided' ? 'voided-row' : ''}>
                          <td className="session-id-cell">LIB-{String(session.session_id).padStart(6, '0')}</td>
                          <td>{formatDate(session.start_time)}</td>
                          <td>{session.table_name || `Table ${session.table_number}`}, Seat {session.seat_number}</td>
                          <td>{session.customer_name || '-'}</td>
                          <td>{formatDuration(session.total_minutes)}</td>
                          <td>₱{parseFloat(session.amount_paid || 0).toFixed(2)}</td>
                          <td>
                            <span className={'status-badge status-' + session.status}>
                              {session.status === 'voided' ? 'Voided' : 'Completed'}
                            </span>
                          </td>
                          <td className="actions-cell">
                            {session.status === 'completed' && (
                              <span className="no-action-text" style={{color: '#999', fontSize: '12px', fontStyle: 'italic'}}>—</span>
                            )}
                            {session.status === 'voided' && (
                              <span className="void-info" title={'Voided by: ' + (session.voided_by_name || 'Unknown') + '\nReason: ' + (session.void_reason || 'No reason')}>
                                ⓘ
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              
              {/* Pagination Controls */}
              {totalPages > 1 && (
                <div className="pagination-container">
                  <div className="pagination-info">
                    Showing {startIndex + 1} - {Math.min(endIndex, filteredHistory.length)} of {filteredHistory.length} sessions
                  </div>
                  <div className="pagination-controls">
                    <button 
                      className="pagination-btn" 
                      onClick={() => setCurrentPage(1)} 
                      disabled={currentPage === 1}
                      title="First Page"
                    >
                      «
                    </button>
                    <button 
                      className="pagination-btn" 
                      onClick={() => setCurrentPage(currentPage - 1)} 
                      disabled={currentPage === 1}
                      title="Previous Page"
                    >
                      ‹
                    </button>
                    
                    {getPageNumbers().map(function(pageNum) {
                      return (
                        <button
                          key={pageNum}
                          className={'pagination-btn pagination-number ' + (currentPage === pageNum ? 'active' : '')}
                          onClick={() => setCurrentPage(pageNum)}
                        >
                          {pageNum}
                        </button>
                      );
                    })}
                    
                    <button 
                      className="pagination-btn" 
                      onClick={() => setCurrentPage(currentPage + 1)} 
                      disabled={currentPage === totalPages}
                      title="Next Page"
                    >
                      ›
                    </button>
                    <button 
                      className="pagination-btn" 
                      onClick={() => setCurrentPage(totalPages)} 
                      disabled={currentPage === totalPages}
                      title="Last Page"
                    >
                      »
                    </button>
                  </div>
                </div>
              )}
              
              {/* Single page info */}
              {totalPages <= 1 && filteredHistory.length > 0 && (
                <div className="pagination-container">
                  <div className="pagination-info">
                    Showing {filteredHistory.length} session{filteredHistory.length !== 1 ? 's' : ''}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      <div className="library-instructions">
        <p><strong>Green seat:</strong> Tap to check-in customer</p>
        <p><strong>Red seat:</strong> Tap to view session / extend / checkout</p>
        <p><strong>Warning:</strong> Session has less than 5 minutes remaining</p>
      </div>

      {showCheckinModal && selectedSeat && <CheckinModal seat={selectedSeat} onClose={function() { setShowCheckinModal(false); setSelectedSeat(null); }} onSubmit={handleCheckin} />}
      {showSessionModal && selectedSession && <SessionModal session={selectedSession} onClose={function() { setShowSessionModal(false); setSelectedSession(null); }} onExtend={handleExtend} onCheckout={function() { setShowSessionModal(false); setShowCheckoutModal(true); }} calculateFee={calculateFee} formatDuration={formatDuration} formatTime={formatTime} />}
      {showCheckoutModal && selectedSession && <CheckoutModal session={selectedSession} onClose={function() { setShowCheckoutModal(false); setSelectedSession(null); }} onSubmit={handleCheckout} formatDuration={formatDuration} />}
      {showWarningModal && warningSession && <WarningModal session={warningSession} onClose={function() { setShowWarningModal(false); setWarningSession(null); }} onExtend={function(minutes) { setSelectedSession(warningSession); handleExtend(minutes); setShowWarningModal(false); setWarningSession(null); }} onCheckout={function() { setSelectedSession(warningSession); setShowWarningModal(false); setShowCheckoutModal(true); }} />}
      {showVoidModal && voidingSession && <VoidSessionModal session={voidingSession} onClose={function() { setShowVoidModal(false); setVoidingSession(null); }} onSubmit={handleVoidSession} formatDateTime={formatDateTime} isAdmin={isAdmin} />}

      <Toast toast={toast} onClose={function() { setToast({ show: false, message: '', type: 'info' }); }} />
    </div>
  );
}

function CheckinModal(props) {
  var seat = props.seat;
  var onClose = props.onClose;
  var onSubmit = props.onSubmit;
  
  const [customerName, setCustomerName] = useState('');
  const [cashTendered, setCashTendered] = useState('');
  const fee = 100; // Initial fee for 2 hours
  
  const change = cashTendered ? Math.max(0, parseFloat(cashTendered) - fee) : 0;
  const isValid = customerName.trim() && parseFloat(cashTendered) >= fee;

  function handleSubmit(e) {
    e.preventDefault();
    if (!isValid) return;
    onSubmit(customerName, parseFloat(cashTendered));
  }
  
  function handleQuickCash(amount) {
    setCashTendered(amount.toString());
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content library-modal" onClick={function(e) { e.stopPropagation(); }}>
        <h3>Check-in Customer</h3>
        <div className="modal-divider"></div>
        <form onSubmit={handleSubmit}>
          <div className="modal-info-row"><span className="info-label">Table:</span><span className="info-value">{seat.table_name || `Table ${seat.table_number}`}</span></div>
          <div className="modal-info-row"><span className="info-label">Seat:</span><span className="info-value">{seat.seat_number}</span></div>
          
          <div className="form-group">
            <label>Customer Name:</label>
            <input 
              type="text" 
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="Enter customer name" 
              required 
              autoFocus 
            />
          </div>
          
          <div className="checkout-total"><span>Initial Fee (2 hours):</span><span className="total-amount">P{fee.toFixed(2)}</span></div>
          
          <div className="form-group">
            <label>Cash Tendered:</label>
            <input 
              type="number" 
              value={cashTendered}
              onChange={(e) => setCashTendered(e.target.value)}
              placeholder="0.00" 
              min={fee}
              required
            />
          </div>
          
          <div className="quick-cash-buttons">
            <button type="button" className="quick-cash-btn exact-btn" onClick={() => handleQuickCash(fee)}>Exact</button>
            <button type="button" className="quick-cash-btn" onClick={() => handleQuickCash(100)}>₱100</button>
            <button type="button" className="quick-cash-btn" onClick={() => handleQuickCash(200)}>₱200</button>
            <button type="button" className="quick-cash-btn" onClick={() => handleQuickCash(500)}>₱500</button>
            <button type="button" className="quick-cash-btn" onClick={() => handleQuickCash(1000)}>₱1000</button>
          </div>
          
          {parseFloat(cashTendered) >= fee && (
            <div className="change-display">
              <span>Change:</span>
              <span className="change-amount">P{change.toFixed(2)}</span>
            </div>
          )}
          
          <div className="fee-info-box"><p><strong>Extension:</strong> P50.00 per 30 minutes</p></div>
          <div className="modal-divider"></div>
          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={!isValid}>Confirm Check-in</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function SessionModal(props) {
  var session = props.session;
  var onClose = props.onClose;
  var onExtend = props.onExtend;
  var onCheckout = props.onCheckout;
  var calculateFee = props.calculateFee;
  var formatDuration = props.formatDuration;
  var formatTime = props.formatTime;
  var fee = calculateFee(session.elapsed_minutes);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content library-modal session-modal" onClick={function(e) { e.stopPropagation(); }}>
        <h3>Session Details</h3>
        <div className="modal-divider"></div>
        <div className="session-details">
          <div className="detail-row"><span className="detail-label">Location:</span><span className="detail-value">{session.table_name || `Table ${session.table_number}`}, Seat {session.seat_number}</span></div>
          <div className="detail-row"><span className="detail-label">Customer:</span><span className="detail-value">{session.customer_name || '-'}</span></div>
          <div className="detail-row"><span className="detail-label">Start Time:</span><span className="detail-value">{formatTime(session.start_time)}</span></div>
          <div className="detail-row"><span className="detail-label">Duration:</span><span className="detail-value">{formatDuration(session.elapsed_minutes)}</span></div>
          <div className="detail-row"><span className="detail-label">Remaining:</span><span className={'detail-value ' + (session.remaining_minutes <= 5 ? 'time-warning' : '')}>{formatDuration(session.remaining_minutes)}</span></div>
        </div>
        <div className="fee-breakdown">
          <h4>Fee Calculation</h4>
          <div className="fee-row"><span>Base (first 2 hours):</span><span>P100.00</span></div>
          {session.elapsed_minutes > 120 && (<div className="fee-row"><span>Extension ({Math.ceil((session.elapsed_minutes - 120) / 30)} x 30min):</span><span>P{(Math.ceil((session.elapsed_minutes - 120) / 30) * 50).toFixed(2)}</span></div>)}
          <div className="fee-row total"><span>Total:</span><span>P{fee.toFixed(2)}</span></div>
        </div>
        <div className="extend-section">
          <h4>Extend Session:</h4>
          <div className="extend-buttons">
            <button className="btn-extend" onClick={function() { onExtend(30); }}>+30 min (P50)</button>
            <button className="btn-extend" onClick={function() { onExtend(60); }}>+60 min (P100)</button>
          </div>
        </div>
        <div className="modal-divider"></div>
        <div className="modal-actions">
          <button className="btn-secondary" onClick={onClose}>Close</button>
          <button className="btn-checkout" onClick={onCheckout}>Checkout and Return ID</button>
        </div>
      </div>
    </div>
  );
}

function CheckoutModal(props) {
  var session = props.session;
  var onClose = props.onClose;
  var onSubmit = props.onSubmit;
  var formatDuration = props.formatDuration;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content library-modal" onClick={function(e) { e.stopPropagation(); }}>
        <h3>Checkout - Return ID</h3>
        <div className="modal-divider"></div>
        <div className="modal-info-row"><span className="info-label">Location:</span><span className="info-value">{session.table_name || `Table ${session.table_number}`}, Seat {session.seat_number}</span></div>
        <div className="modal-info-row"><span className="info-label">Customer:</span><span className="info-value">{session.customer_name}</span></div>
        <div className="modal-info-row"><span className="info-label">Duration Used:</span><span className="info-value">{formatDuration(session.elapsed_minutes)}</span></div>
        <div className="modal-info-row"><span className="info-label">Time Paid:</span><span className="info-value">{formatDuration(session.paid_minutes || 120)}</span></div>
        
        <div className="checkout-note success">
          <strong>Ready to checkout!</strong><br/>
          The customer has already paid. Please return their ID.
        </div>
        
        <div className="modal-divider"></div>
        <div className="modal-actions">
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={onSubmit}>Return ID & Complete</button>
        </div>
      </div>
    </div>
  );
}

function WarningModal(props) {
  var session = props.session;
  var onClose = props.onClose;
  var onExtend = props.onExtend;
  var onCheckout = props.onCheckout;

  return (
    <div className="modal-overlay warning-overlay">
      <div className="modal-content library-modal warning-modal" onClick={function(e) { e.stopPropagation(); }}>
        <div className="warning-header"><span className="warning-icon">!</span><h3>Time Warning!</h3></div>
        <div className="modal-divider"></div>
        <div className="warning-content">
          <p className="warning-message"><strong>{session.table_name || `Table ${session.table_number}`}, Seat {session.seat_number}</strong> has <span className="time-highlight"> {session.remaining_minutes} minutes </span> remaining.</p>
          <p className="customer-info">Customer: {session.customer_name}</p>
        </div>
        <p className="warning-instruction">Please politely remind the customer and ask if they would like to extend their session.</p>
        <div className="modal-divider"></div>
        <div className="modal-actions warning-actions">
          <button className="btn-extend" onClick={function() { onExtend(30); }}>Extend +30 min</button>
          <button className="btn-extend" onClick={function() { onExtend(60); }}>Extend +60 min</button>
          <button className="btn-checkout" onClick={onCheckout}>Checkout Now</button>
          <button className="btn-secondary" onClick={onClose}>Dismiss</button>
        </div>
      </div>
    </div>
  );
}

function VoidSessionModal(props) {
  var session = props.session;
  var onClose = props.onClose;
  var onSubmit = props.onSubmit;
  var isAdmin = props.isAdmin;
  
  var _reasonState = useState('');
  var voidReason = _reasonState[0];
  var setVoidReason = _reasonState[1];
  var _loadingState = useState(false);
  var isVoiding = _loadingState[0];
  var setIsVoiding = _loadingState[1];
  var _usernameState = useState('');
  var adminUsername = _usernameState[0];
  var setAdminUsername = _usernameState[1];
  var _passwordState = useState('');
  var adminPassword = _passwordState[0];
  var setAdminPassword = _passwordState[1];
  var _errorState = useState('');
  var errorMessage = _errorState[0];
  var setErrorMessage = _errorState[1];
  
  // Handle both active sessions (session_id) and history sessions (id)
  var sessionId = session.session_id || session.id;
  
  // Cashiers need admin credentials to void
  var needsAdminAuth = !isAdmin;

  async function handleSubmit() {
    setErrorMessage('');
    if (!voidReason.trim()) {
      setErrorMessage('Please enter a reason for voiding this session.');
      return;
    }
    if (needsAdminAuth && (!adminUsername.trim() || !adminPassword.trim())) {
      setErrorMessage('Please enter admin credentials to authorize this void.');
      return;
    }
    setIsVoiding(true);
    var adminCredentials = needsAdminAuth ? { username: adminUsername, password: adminPassword } : null;
    var success = await onSubmit(sessionId, voidReason, adminCredentials);
    if (!success) {
      setIsVoiding(false);
    }
  }

  // Compact modal styles
  var modalStyle = {
    maxWidth: '480px',
    width: '95%',
    maxHeight: '90vh',
    display: 'flex',
    flexDirection: 'column',
    padding: '20px'
  };

  var headerStyle = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '12px'
  };

  var warningStyle = {
    background: '#fff3cd',
    border: '1px solid #ffc107',
    borderRadius: '6px',
    padding: '8px 12px',
    marginBottom: '12px',
    fontSize: '13px'
  };

  var detailsGridStyle = {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '4px 12px',
    fontSize: '13px',
    background: '#f8f9fa',
    borderRadius: '6px',
    padding: '10px 12px',
    marginBottom: '12px'
  };

  var inputStyle = {
    width: '100%',
    padding: '8px 10px',
    borderRadius: '6px',
    border: '1px solid #ced4da',
    fontSize: '13px',
    boxSizing: 'border-box'
  };

  return (
    <div className="modal-overlay" onClick={onClose} style={{display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
      <div className="modal-content library-modal void-modal" onClick={function(e) { e.stopPropagation(); }} style={modalStyle}>
        {/* Header */}
        <div style={headerStyle}>
          <h3 style={{color: '#dc3545', margin: 0, fontSize: '18px'}}>Void Library Session</h3>
          <button className="modal-close" onClick={onClose} style={{background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', color: '#fff', padding: '0', lineHeight: 1}}>×</button>
        </div>

        {/* Warning */}
        <div style={warningStyle}>
          <span style={{color: '#856404'}}><strong>⚠️ Warning:</strong> This action cannot be undone.</span>
        </div>
        
        {/* Session Details - Compact */}
        <div style={detailsGridStyle}>
          <div><strong>ID:</strong> LIB-{String(sessionId).padStart(6, '0')}</div>
          <div><strong>Customer:</strong> {session.customer_name}</div>
          <div><strong>Location:</strong> {session.table_name || `T${session.table_number}`}-S{session.seat_number}</div>
          <div><strong>Fee:</strong> ₱{session.total_fee ? parseFloat(session.total_fee).toFixed(2) : (100 + (session.elapsed_minutes > 120 ? Math.ceil((session.elapsed_minutes - 120) / 30) * 50 : 0)).toFixed(2)}</div>
        </div>

        {/* Reason Input */}
        <div style={{marginBottom: '12px'}}>
          <label style={{display: 'block', marginBottom: '4px', fontWeight: '600', color: '#495057', fontSize: '13px'}}>
            Reason for Voiding <span style={{color: '#dc3545'}}>*</span>
          </label>
          <textarea
            value={voidReason}
            onChange={function(e) { setVoidReason(e.target.value); }}
            placeholder="e.g., duplicate entry, customer complaint, system error..."
            rows="2"
            style={{...inputStyle, resize: 'none'}}
          />
        </div>

        {/* Admin Auth - Compact */}
        {needsAdminAuth && (
          <div style={{background: '#e3f2fd', border: '1px solid #90caf9', borderRadius: '6px', padding: '12px', marginBottom: '12px'}}>
            <div style={{fontSize: '13px', fontWeight: '600', color: '#1565c0', marginBottom: '8px'}}>🔐 Admin Authorization Required</div>
            <div style={{display: 'flex', gap: '10px'}}>
              <div style={{flex: 1}}>
                <input
                  type="text"
                  value={adminUsername}
                  onChange={function(e) { setAdminUsername(e.target.value); }}
                  placeholder="Admin username"
                  style={inputStyle}
                />
              </div>
              <div style={{flex: 1}}>
                <input
                  type="password"
                  value={adminPassword}
                  onChange={function(e) { setAdminPassword(e.target.value); }}
                  placeholder="Admin password"
                  style={inputStyle}
                />
              </div>
            </div>
          </div>
        )}

        {/* Error Message */}
        {errorMessage && (
          <div style={{background: '#ffebee', color: '#c62828', padding: '10px 12px', borderRadius: '6px', marginBottom: '12px', fontSize: '13px', border: '1px solid #ef9a9a'}}>
            {errorMessage}
          </div>
        )}

        {/* Action Buttons */}
        <div style={{display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: 'auto', paddingTop: '8px', borderTop: '1px solid #eee'}}>
          <button 
            className="btn-secondary" 
            onClick={onClose} 
            disabled={isVoiding}
            style={{padding: '10px 20px', borderRadius: '6px', border: '1px solid #ccc', background: '#fff', cursor: 'pointer', fontSize: '14px'}}
          >
            Cancel
          </button>
          <button 
            onClick={handleSubmit} 
            disabled={isVoiding || !voidReason.trim() || (needsAdminAuth && (!adminUsername.trim() || !adminPassword.trim()))}
            style={{
              background: isVoiding || !voidReason.trim() || (needsAdminAuth && (!adminUsername.trim() || !adminPassword.trim())) ? '#ccc' : '#dc3545',
              color: 'white',
              border: 'none',
              padding: '10px 24px',
              borderRadius: '6px',
              cursor: isVoiding || !voidReason.trim() || (needsAdminAuth && (!adminUsername.trim() || !adminPassword.trim())) ? 'not-allowed' : 'pointer',
              fontSize: '14px',
              fontWeight: '600'
            }}
          >
            {isVoiding ? 'Voiding...' : 'Void Session'}
          </button>
        </div>
      </div>
    </div>
  );
}
