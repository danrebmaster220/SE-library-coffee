import { useState, useEffect } from "react";
import api from "../api";
import "../styles/cash-management.css";

export default function ActiveShifts() {
  const [shifts, setShifts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForceCloseModal, setShowForceCloseModal] = useState(false);
  const [selectedShift, setSelectedShift] = useState(null);
  const [forceCloseNotes, setForceCloseNotes] = useState('');
  const [forceClosing, setForceClosing] = useState(false);
  const [shiftPage, setShiftPage] = useState(1);
  const rowsPerPage = 10;

  useEffect(() => {
    fetchActiveShifts();

    const handleShiftUpdated = () => fetchActiveShifts();
    window.addEventListener('shiftUpdated', handleShiftUpdated);

    // Refresh when returning to this tab/window so admin sees recent updates quickly.
    const handleWindowFocus = () => fetchActiveShifts();
    window.addEventListener('focus', handleWindowFocus);

    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchActiveShifts, 30000);

    return () => {
      clearInterval(interval);
      window.removeEventListener('shiftUpdated', handleShiftUpdated);
      window.removeEventListener('focus', handleWindowFocus);
    };
  }, []);

  const fetchActiveShifts = async () => {
    try {
      const response = await api.get("/shifts/active");
      setShifts(response.data.shifts || []);
    } catch (error) {
      console.error("Error fetching active shifts:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatDuration = (startTime) => {
    const start = new Date(startTime);
    const now = new Date();
    const diffMs = now - start;
    const hours = Math.floor(diffMs / 3600000);
    const minutes = Math.floor((diffMs % 3600000) / 60000);
    return `${hours}h ${minutes}m`;
  };

  const openForceClose = (shift) => {
    setSelectedShift(shift);
    setForceCloseNotes('');
    setShowForceCloseModal(true);
  };

  const handleForceClose = async () => {
    if (!selectedShift || forceClosing) return;

    try {
      setForceClosing(true);
      await api.post(`/shifts/${selectedShift.shift_id}/force-close`, {
        notes: forceCloseNotes || 'Force-closed by admin'
      });
      setShowForceCloseModal(false);
      setSelectedShift(null);
      fetchActiveShifts();
      window.dispatchEvent(new Event('shiftUpdated'));
    } catch (error) {
      console.error("Error force-closing shift:", error);
      alert(error.response?.data?.error || 'Failed to force-close shift');
    } finally {
      setForceClosing(false);
    }
  };

  const totalPages = Math.ceil(shifts.length / rowsPerPage);
  const startIndex = (shiftPage - 1) * rowsPerPage;
  const endIndex = startIndex + rowsPerPage;
  const paginatedShifts = shifts.slice(startIndex, endIndex);

  useEffect(() => {
    const safeTotalPages = Math.max(1, Math.ceil(shifts.length / rowsPerPage));
    if (shiftPage > safeTotalPages) {
      setShiftPage(safeTotalPages);
    }
  }, [shifts, shiftPage]);

  const getPageNumbers = (page, pages) => {
    const result = [];
    const maxVisiblePages = 5;

    if (pages <= maxVisiblePages) {
      for (let i = 1; i <= pages; i++) result.push(i);
    } else if (page <= 3) {
      result.push(1, 2, 3, 4, '...', pages);
    } else if (page >= pages - 2) {
      result.push(1, '...', pages - 3, pages - 2, pages - 1, pages);
    } else {
      result.push(1, '...', page - 1, page, page + 1, '...', pages);
    }

    return result;
  };

  return (
    <div className="active-shifts-content">
      {loading ? (
        <div className="loading-state">Loading...</div>
      ) : shifts.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">🕐</div>
          <h3>No Active Shifts</h3>
          <p>No cashiers are currently on shift.</p>
        </div>
      ) : (
        <>
          <div className="shifts-table-container">
            <table className="shifts-table">
              <thead>
                <tr>
                  <th>Cashier</th>
                  <th>Start Time</th>
                  <th>Duration</th>
                  <th>Starting Cash</th>
                  <th>Running Sales</th>
                  <th>Transactions</th>
                  <th>Voids</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedShifts.map((shift) => (
                  <tr key={shift.shift_id}>
                    <td>
                      <div className="cashier-cell">
                        <div className="cashier-avatar">{(shift.full_name || 'C').charAt(0).toUpperCase()}</div>
                        <div>
                          <div className="cashier-name">{shift.full_name}</div>
                          <div className="cashier-username">@{shift.username}</div>
                        </div>
                      </div>
                    </td>
                    <td>{new Date(shift.start_time).toLocaleString()}</td>
                    <td>
                      <span className="duration-badge">{formatDuration(shift.start_time)}</span>
                    </td>
                    <td>₱{(parseFloat(shift.starting_cash) || 0).toFixed(2)}</td>
                    <td className="sales-amount">₱{(parseFloat(shift.total_sales) || 0).toFixed(2)}</td>
                    <td>{shift.total_transactions || 0}</td>
                    <td>{shift.total_voids || 0}</td>
                    <td>
                      <button className="btn-force-close" onClick={() => openForceClose(shift)}>
                        Force Close
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="pagination-container">
              <span className="pagination-info">
                Showing {startIndex + 1}-{Math.min(endIndex, shifts.length)} of {shifts.length}
              </span>
              <button className="pagination-btn" onClick={() => setShiftPage(1)} disabled={shiftPage === 1}>«</button>
              <button className="pagination-btn" onClick={() => setShiftPage(shiftPage - 1)} disabled={shiftPage === 1}>‹</button>
              {getPageNumbers(shiftPage, totalPages).map((page, idx) => (
                page === '...' ? (
                  <span key={`ellipsis-${idx}`} className="pagination-ellipsis">...</span>
                ) : (
                  <button key={page} className={shiftPage === page ? "pagination-btn active" : "pagination-btn"} onClick={() => setShiftPage(page)}>{page}</button>
                )
              ))}
              <button className="pagination-btn" onClick={() => setShiftPage(shiftPage + 1)} disabled={shiftPage === totalPages}>›</button>
              <button className="pagination-btn" onClick={() => setShiftPage(totalPages)} disabled={shiftPage === totalPages}>»</button>
            </div>
          )}
        </>
      )}

      {/* Force Close Modal */}
      {showForceCloseModal && selectedShift && (
        <div className="modal-overlay" onClick={forceClosing ? undefined : () => setShowForceCloseModal(false)}>
          <div className="modal-content force-close-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Force Close Shift</h3>
              <button className="modal-close" onClick={() => setShowForceCloseModal(false)} disabled={forceClosing}>×</button>
            </div>
            <div className="modal-body">
              <p style={{ marginBottom: '12px' }}>
                Force-close the shift for <strong>{selectedShift.full_name}</strong>?
              </p>
              <p style={{ fontSize: '13px', color: '#888', marginBottom: '16px' }}>
                Started: {new Date(selectedShift.start_time).toLocaleString()} ({formatDuration(selectedShift.start_time)})
              </p>
              <div className="form-group">
                <label>Reason / Notes</label>
                <textarea
                  value={forceCloseNotes}
                  onChange={(e) => setForceCloseNotes(e.target.value)}
                  placeholder="e.g., Power outage, cashier absent..."
                  rows={3}
                  disabled={forceClosing}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-cancel" onClick={() => setShowForceCloseModal(false)} disabled={forceClosing}>Cancel</button>
              <button className="btn-danger" onClick={handleForceClose} disabled={forceClosing}>
                {forceClosing ? (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
                      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" fill="none" opacity="0.25" />
                      <path d="M22 12a10 10 0 0 1-10 10" stroke="currentColor" strokeWidth="3" fill="none">
                        <animateTransform attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur="0.8s" repeatCount="indefinite" />
                      </path>
                    </svg>
                    Force Closing...
                  </span>
                ) : (
                  'Force Close Shift'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
