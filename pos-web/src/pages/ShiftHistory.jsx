import { useState, useEffect } from "react";
import api from "../api";
import socketService from '../services/socketService';
import FilterSelectWrap from "../components/FilterSelectWrap";
import "../styles/cash-management.css";

export default function ShiftHistory() {
  const [shifts, setShifts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [cashierFilter, setCashierFilter] = useState('');
  const [cashierOptions, setCashierOptions] = useState([]);
  const [selectedShift, setSelectedShift] = useState(null);
  const [historyPage, setHistoryPage] = useState(1);
  const rowsPerPage = 10;

  useEffect(() => {
    fetchHistory();
    fetchCashierOptions();

    const handleShiftUpdated = () => fetchHistory(false);
    window.addEventListener('shiftUpdated', handleShiftUpdated);

    socketService.connect();
    socketService.on('shift:updated', handleShiftUpdated);

    return () => {
      window.removeEventListener('shiftUpdated', handleShiftUpdated);
      socketService.off('shift:updated', handleShiftUpdated);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchHistory = async (resetPage = true, overrides = {}) => {
    try {
      setLoading(true);
      if (resetPage) {
        setHistoryPage(1);
      }

      const effectiveStartDate = overrides.startDate ?? startDate;
      const effectiveEndDate = overrides.endDate ?? endDate;
      const effectiveCashierFilter = overrides.cashierFilter ?? cashierFilter;

      let url = "/shifts/history";
      const params = [];
      if (effectiveStartDate) params.push(`start_date=${effectiveStartDate}`);
      if (effectiveEndDate) params.push(`end_date=${effectiveEndDate}`);
      if (effectiveCashierFilter) params.push(`user_id=${effectiveCashierFilter}`);
      if (params.length > 0) url += '?' + params.join('&');
      
      const response = await api.get(url);
      setShifts(response.data.shifts || []);
    } catch (error) {
      console.error("Error fetching shift history:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCashierOptions = async () => {
    try {
      const response = await api.get('/users');
      const users = Array.isArray(response.data) ? response.data : [];
      const staffUsers = users
        .filter((user) => {
          const role = String(user.role_name || '').toLowerCase();
          return role === 'cashier' || role === 'admin';
        })
        .filter((user) => String(user.status || '').toLowerCase() === 'active')
        .map((user) => ({
          user_id: user.user_id,
          full_name: user.full_name,
          username: user.username,
          role_name: user.role_name
        }));

      setCashierOptions(staffUsers);
    } catch (error) {
      console.error('Error fetching cashier options:', error);
      setCashierOptions([]);
    }
  };

  const getDifferenceClass = (diff) => {
    const val = parseFloat(diff);
    if (val === 0) return 'diff-exact';
    if (val > 0) return 'diff-overage';
    return 'diff-shortage';
  };

  const formatMoney = (value) => {
    const numeric = Number(value || 0);
    const amount = Number.isNaN(numeric) ? 0 : numeric;
    return `₱${amount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const getDifferenceLabel = (diff) => {
    const val = parseFloat(diff);
    if (val === 0) return 'Exact';
    if (val > 0) return `+${formatMoney(val)}`;
    return `-${formatMoney(Math.abs(val))}`;
  };

  const formatShiftDuration = (startTime, endTime) => {
    if (!startTime || !endTime) return '--';
    const start = new Date(startTime);
    const end = new Date(endTime);
    const diffMs = end - start;
    const hours = Math.floor(diffMs / 3600000);
    const minutes = Math.floor((diffMs % 3600000) / 60000);
    return `${hours}h ${minutes}m`;
  };

  const totalPages = Math.ceil(shifts.length / rowsPerPage);
  const startIndex = (historyPage - 1) * rowsPerPage;
  const endIndex = startIndex + rowsPerPage;
  const paginatedShifts = shifts.slice(startIndex, endIndex);

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
    <div className="shift-history-content">
      {/* Filters */}
      <div className="filter-bar">
        <div className="filter-group">
          <label>From:</label>
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </div>
        <div className="filter-group">
          <label>To:</label>
          <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        </div>
        <div className="filter-group">
          <label>Staff:</label>
          <FilterSelectWrap>
            <select className="filter-select-cashier" value={cashierFilter} onChange={(e) => setCashierFilter(e.target.value)}>
              <option value="">All Staff</option>
              {cashierOptions.map((staff) => (
                <option key={staff.user_id} value={staff.user_id}>
                  {staff.full_name || staff.username || `User #${staff.user_id}`}
                </option>
              ))}
            </select>
          </FilterSelectWrap>
        </div>
        <button type="button" className="btn-apply-filter" onClick={() => fetchHistory(true)}>Apply Filter</button>
        {(startDate || endDate || cashierFilter) && (
          <button
            className="btn-clear-filter"
            onClick={() => {
              setStartDate('');
              setEndDate('');
              setCashierFilter('');
              fetchHistory(true, { startDate: '', endDate: '', cashierFilter: '' });
            }}
          >
            Clear
          </button>
        )}
      </div>

      {loading ? (
        <div className="loading-state">Loading...</div>
      ) : shifts.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">📋</div>
          <h3>No Shift Records</h3>
          <p>No completed shifts found for the selected period.</p>
        </div>
      ) : (
        <>
          <div className="shifts-table-container">
            <table className="shifts-table">
              <thead>
                <tr>
                  <th>Cashier</th>
                  <th>Date</th>
                  <th>Duration</th>
                  <th>Starting Cash</th>
                  <th>Total Sales</th>
                  <th>Expected</th>
                  <th>Actual</th>
                  <th>Difference</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                {paginatedShifts.map((shift) => (
                  <tr key={shift.shift_id}>
                    <td>
                      <div className="cashier-cell">
                        <div className="cashier-avatar">{(shift.full_name || 'C').charAt(0).toUpperCase()}</div>
                        <div className="cashier-name">{shift.full_name}</div>
                      </div>
                    </td>
                    <td>
                      <div style={{ fontSize: '13px' }}>{new Date(shift.start_time).toLocaleDateString()}</div>
                      <div style={{ fontSize: '11px', color: '#999' }}>
                        {new Date(shift.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} — {shift.end_time ? new Date(shift.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--'}
                      </div>
                    </td>
                    <td>{formatShiftDuration(shift.start_time, shift.end_time)}</td>
                    <td>{formatMoney(shift.starting_cash)}</td>
                    <td className="sales-amount">{formatMoney(shift.total_sales)}</td>
                    <td>{formatMoney(shift.expected_cash)}</td>
                    <td>
                      {shift.actual_cash != null 
                        ? formatMoney(shift.actual_cash)
                        : <span style={{ color: '#999' }}>N/A</span>
                      }
                    </td>
                    <td>
                      {shift.cash_difference != null ? (
                        <span className={`diff-badge ${getDifferenceClass(shift.cash_difference)}`}>
                          {getDifferenceLabel(shift.cash_difference)}
                        </span>
                      ) : (
                        <span className="diff-badge diff-na">N/A</span>
                      )}
                    </td>
                    <td>
                      <button className="btn-view-details" onClick={() => setSelectedShift(shift)}>
                        View
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
              <button className="pagination-btn" onClick={() => setHistoryPage(1)} disabled={historyPage === 1}>«</button>
              <button className="pagination-btn" onClick={() => setHistoryPage(historyPage - 1)} disabled={historyPage === 1}>‹</button>
              {getPageNumbers(historyPage, totalPages).map((page, idx) => (
                page === '...' ? (
                  <span key={`ellipsis-${idx}`} className="pagination-ellipsis">...</span>
                ) : (
                  <button key={page} className={historyPage === page ? "pagination-btn active" : "pagination-btn"} onClick={() => setHistoryPage(page)}>{page}</button>
                )
              ))}
              <button className="pagination-btn" onClick={() => setHistoryPage(historyPage + 1)} disabled={historyPage === totalPages}>›</button>
              <button className="pagination-btn" onClick={() => setHistoryPage(totalPages)} disabled={historyPage === totalPages}>»</button>
            </div>
          )}
        </>
      )}

      {/* Detail Modal */}
      {selectedShift && (
        <div className="modal-overlay" onClick={() => setSelectedShift(null)}>
          <div className="modal-content detail-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Shift Detail</h3>
              <button className="modal-close" onClick={() => setSelectedShift(null)}>×</button>
            </div>
            <div className="modal-body">
              <div className="detail-grid">
                <div className="detail-row">
                  <span className="detail-label">Cashier</span>
                  <span className="detail-value">{selectedShift.full_name}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Shift Start</span>
                  <span className="detail-value">{new Date(selectedShift.start_time).toLocaleString()}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Shift End</span>
                  <span className="detail-value">{selectedShift.end_time ? new Date(selectedShift.end_time).toLocaleString() : 'N/A'}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Duration</span>
                  <span className="detail-value">{formatShiftDuration(selectedShift.start_time, selectedShift.end_time)}</span>
                </div>
                <hr />
                <div className="detail-row">
                  <span className="detail-label">Starting Cash</span>
                  <span className="detail-value">{formatMoney(selectedShift.starting_cash)}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Total Sales</span>
                  <span className="detail-value" style={{ color: '#2e7d32', fontWeight: '700' }}>{formatMoney(selectedShift.total_sales)}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Transactions</span>
                  <span className="detail-value">{selectedShift.total_transactions || 0}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Voids</span>
                  <span className="detail-value" style={{ color: '#e65100' }}>{selectedShift.total_voids || 0}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Refunds</span>
                  <span className="detail-value" style={{ color: '#c62828' }}>{formatMoney(selectedShift.total_refunds)}</span>
                </div>
                <hr />
                <div className="detail-row">
                  <span className="detail-label">Expected Cash</span>
                  <span className="detail-value" style={{ fontWeight: '700' }}>{formatMoney(selectedShift.expected_cash)}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Actual Cash</span>
                  <span className="detail-value" style={{ fontWeight: '700' }}>
                    {selectedShift.actual_cash != null
                      ? formatMoney(selectedShift.actual_cash)
                      : 'N/A'}
                  </span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Difference</span>
                  <span className={`detail-value diff-badge ${selectedShift.cash_difference != null ? getDifferenceClass(selectedShift.cash_difference) : 'diff-na'}`}>
                    {selectedShift.cash_difference != null
                      ? getDifferenceLabel(selectedShift.cash_difference)
                      : 'N/A'}
                  </span>
                </div>
                {selectedShift.notes && (
                  <>
                    <hr />
                    <div className="detail-row">
                      <span className="detail-label">Notes</span>
                      <span className="detail-value">{selectedShift.notes}</span>
                    </div>
                  </>
                )}
                {selectedShift.closed_by_name && (
                  <div className="detail-row">
                    <span className="detail-label">Closed By</span>
                    <span className="detail-value">{selectedShift.closed_by_name}</span>
                  </div>
                )}
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-cancel" onClick={() => setSelectedShift(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
