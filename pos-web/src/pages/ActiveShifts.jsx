import { useState, useEffect } from "react";
import api from "../api";
import socketService from '../services/socketService';
import "../styles/cash-management.css";

export default function ActiveShifts() {
  const [shifts, setShifts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [shiftPage, setShiftPage] = useState(1);
  const rowsPerPage = 10;

  useEffect(() => {
    fetchActiveShifts();

    const handleShiftUpdated = () => fetchActiveShifts();
    window.addEventListener('shiftUpdated', handleShiftUpdated);

    socketService.connect();
    socketService.on('shift:updated', handleShiftUpdated);

    // Refresh when returning to this tab/window so admin sees recent updates quickly.
    const handleWindowFocus = () => fetchActiveShifts();
    window.addEventListener('focus', handleWindowFocus);

    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchActiveShifts, 30000);

    return () => {
      clearInterval(interval);
      window.removeEventListener('shiftUpdated', handleShiftUpdated);
      window.removeEventListener('focus', handleWindowFocus);
      socketService.off('shift:updated', handleShiftUpdated);
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

  const formatMoney = (value) => {
    const numeric = Number(value || 0);
    const amount = Number.isNaN(numeric) ? 0 : numeric;
    return `₱${amount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
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
                  <th>Voided Orders</th>
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
                    <td>{formatMoney(shift.starting_cash)}</td>
                    <td className="sales-amount">{formatMoney(shift.total_sales)}</td>
                    <td>{shift.total_transactions || 0}</td>
                    <td>{shift.total_voids || 0}</td>
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

    </div>
  );
}
