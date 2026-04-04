import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import api from '../api';
import socketService from '../services/socketService';
import logoImg from '../assets/logo.png';
import '../styles/cashier.css';

// SVG Icons
const Icons = {
  pos: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
      <line x1="8" y1="21" x2="16" y2="21"></line>
      <line x1="12" y1="17" x2="12" y2="21"></line>
    </svg>
  ),
  library: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
    </svg>
  ),
  orders: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"></path>
      <rect x="9" y="3" width="6" height="4" rx="1"></rect>
      <path d="M9 12h6"></path>
      <path d="M9 16h6"></path>
    </svg>
  ),
  completed: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
      <polyline points="22 4 12 14.01 9 11.01"></polyline>
    </svg>
  ),
  logout: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
      <polyline points="16 17 21 12 16 7"></polyline>
      <line x1="21" y1="12" x2="9" y2="12"></line>
    </svg>
  ),
  chevronDown: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 9 12 15 18 9"></polyline>
    </svg>
  ),
  clock: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"></circle>
      <polyline points="12 6 12 12 16 14"></polyline>
    </svg>
  )
};

// Get initial user from localStorage
function getInitialUser() {
  const storedUser = localStorage.getItem('user');
  if (storedUser) {
    const userData = JSON.parse(storedUser);
    return {
      fullName: userData.fullName || 'Cashier',
      role: userData.role || 'cashier',
      profileImage: userData.profileImage || null
    };
  }
  return { fullName: 'Cashier', role: 'cashier', profileImage: null };
}

export default function CashierTopBar() {
  const location = useLocation();
  const navigate = useNavigate();
  const [user, setUser] = useState(getInitialUser);

  useEffect(() => {
    const sync = async () => {
      try {
        const res = await api.get('/users/me/profile');
        const d = res.data;
        const display = d.display_name || d.full_name || '';
        setUser({
          fullName: display,
          role: d.role_name || 'cashier',
          profileImage: d.profile_image || null
        });
        const stored = localStorage.getItem('user');
        if (stored) {
          const u = JSON.parse(stored);
          u.fullName = display;
          u.profileImage = d.profile_image || null;
          localStorage.setItem('user', JSON.stringify(u));
        }
      } catch {
        /* ignore */
      }
    };
    sync();
    const onUserUpdated = () => setUser(getInitialUser());
    window.addEventListener('userUpdated', onUserUpdated);
    return () => window.removeEventListener('userUpdated', onUserUpdated);
  }, []);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  
  // Shift state
  const [activeShift, setActiveShift] = useState(null);
  const [showStartShiftModal, setShowStartShiftModal] = useState(false);
  const [showEndShiftModal, setShowEndShiftModal] = useState(false);
  const [startingCash, setStartingCash] = useState('');
  const [actualCash, setActualCash] = useState('');
  const [endShiftNotes, setEndShiftNotes] = useState('');
  const [shiftSummary, setShiftSummary] = useState(null);
  const [shiftLoading, setShiftLoading] = useState(true);
  const [startingShift, setStartingShift] = useState(false);
  const [endingShift, setEndingShift] = useState(false);

  // Check for active shift on mount
  useEffect(() => {
    checkActiveShift();

    const handleShiftUpdated = () => {
      checkActiveShift();
    };

    const handleSocketShiftUpdated = () => {
      // Reuse the existing global event refresh flow used by POS/Library pages.
      window.dispatchEvent(new Event('shiftUpdated'));
    };

    window.addEventListener('shiftUpdated', handleShiftUpdated);
    socketService.connect();
    socketService.on('shift:updated', handleSocketShiftUpdated);

    return () => {
      window.removeEventListener('shiftUpdated', handleShiftUpdated);
      socketService.off('shift:updated', handleSocketShiftUpdated);
    };
  }, []);

  const checkActiveShift = async () => {
    try {
      setShiftLoading(true);
      const response = await api.get('/shifts/my-active');
      if (response.data.shift) {
        setActiveShift(response.data.shift);
      } else {
        // No active shift found
        setActiveShift(null);
      }
    } catch (error) {
      console.error('Error checking active shift:', error);
    } finally {
      setShiftLoading(false);
    }
  };

  const handleStartShift = async () => {
    if (startingShift) return;

    try {
      setStartingShift(true);
      const cashVal = parseFloat(startingCash) || 0;
      const response = await api.post('/shifts/start', { starting_cash: cashVal });
      if (response.data.success) {
        setActiveShift(response.data.shift);
        setShowStartShiftModal(false);
        setStartingCash('');
        window.dispatchEvent(new Event('shiftUpdated'));
      }
    } catch (error) {
      console.error('Error starting shift:', error);
      alert(error.response?.data?.error || 'Failed to start shift');
    } finally {
      setStartingShift(false);
    }
  };

  const openEndShiftModal = async () => {
    setShowUserMenu(false);
    try {
      // Fetch fresh shift summary
      const response = await api.get('/shifts/my-active');
      if (response.data.shift) {
        setActiveShift(response.data.shift);
        setShiftSummary(response.data.shift);
        setShowEndShiftModal(true);
      }
    } catch (error) {
      console.error('Error fetching shift data:', error);
      alert('Failed to load shift data');
    }
  };

  const handleEndShift = async () => {
    if (endingShift) return;

    try {
      setEndingShift(true);
      const cashVal = parseFloat(actualCash) || 0;
      const response = await api.post('/shifts/end', { 
        actual_cash: cashVal,
        notes: endShiftNotes || null
      });
      if (response.data.success) {
        setActiveShift(null);
        setShowEndShiftModal(false);
        setActualCash('');
        setEndShiftNotes('');
        setShiftSummary(null);
        window.dispatchEvent(new Event('shiftUpdated'));
        // Clear active shift seamlessly
      }
    } catch (error) {
      console.error('Error ending shift:', error);
      alert(error.response?.data?.error || 'Failed to end shift');
    } finally {
      setEndingShift(false);
    }
  };

  const isActive = (path) => location.pathname === path;

  const handleLogoutClick = () => {
    setShowUserMenu(false);
    setShowLogoutModal(true);
  };

  const handleLogoutConfirm = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setShowLogoutModal(false);
    navigate('/login');
  };

  const handleLogoutCancel = () => {
    setShowLogoutModal(false);
  };

  const formatDuration = (startTime) => {
    if (!startTime) return '--';
    const start = new Date(startTime);
    const now = new Date();
    const diffMs = now - start;
    const hours = Math.floor(diffMs / 3600000);
    const minutes = Math.floor((diffMs % 3600000) / 60000);
    return `${hours}h ${minutes}m`;
  };

  // Cash input handler — only allow digits and one decimal
  const handleCashInput = (value, setter) => {
    if (value === '' || /^\d*\.?\d{0,2}$/.test(value)) {
      setter(value);
    }
  };

  const navItems = [
    { id: 'pos', label: 'POS', icon: Icons.pos, path: '/pos' },
    { id: 'library', label: 'StudyHall', icon: Icons.library, path: '/library/transactions' },
    { id: 'orders', label: 'Order Queue', icon: Icons.orders, path: '/orders' },
    { id: 'completed', label: 'Completed', icon: Icons.completed, path: '/orders/completed' }
  ];

  // Calculate expected and difference for display
  const expectedCash = shiftSummary 
    ? (parseFloat(shiftSummary.starting_cash) || 0) + (parseFloat(shiftSummary.total_sales) || 0) - (parseFloat(shiftSummary.total_refunds) || 0)
    : 0;
  const actualCashVal = parseFloat(actualCash) || 0;
  const cashDifference = actualCash !== '' ? actualCashVal - expectedCash : null;

  return (
    <>
      <header className="cashier-topbar">
        {/* Logo Section */}
        <div className="topbar-logo">
          <img src={logoImg} alt="Library Coffee Logo" className="topbar-logo-img" />
          <div className="logo-text">
            <span className="logo-title">THE LIBRARY</span>
            <span className="logo-subtitle">Coffee + Study</span>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="topbar-nav">
          {navItems.map((item) => (
            <Link
              key={item.id}
              to={item.path}
              className={`topbar-nav-item ${isActive(item.path) ? 'active' : ''}`}
            >
              <span className="nav-icon">{item.icon}</span>
              <span className="nav-label">{item.label}</span>
            </Link>
          ))}
        </nav>

        {/* Shift + User Menu */}
        <div className="topbar-user" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {/* Shift indicator */}
          {activeShift && !shiftLoading && (
            <div className="shift-indicator" style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '4px 10px', borderRadius: '20px',
              backgroundColor: 'rgba(76, 175, 80, 0.15)', color: '#4CAF50',
              fontSize: '12px', fontWeight: '600'
            }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#4CAF50', display: 'inline-block' }}></span>
              On Shift • {formatDuration(activeShift.start_time)}
            </div>
          )}

          {!activeShift && !shiftLoading && (
            <button 
              className="btn-start-shift" 
              onClick={() => setShowStartShiftModal(true)}
              style={{
                backgroundColor: '#ff9800', color: '#fff', border: 'none',
                padding: '6px 14px', borderRadius: '20px', fontSize: '12px',
                fontWeight: '600', cursor: 'pointer', display: 'flex',
                alignItems: 'center', gap: '6px'
              }}
            >
              💰 Start Shift
            </button>
          )}

          <button 
            className="user-menu-btn"
            onClick={() => setShowUserMenu(!showUserMenu)}
          >
            <div className="user-avatar">
              {user.profileImage ? (
                <img src={user.profileImage} alt="" />
              ) : (
                user.fullName.charAt(0).toUpperCase()
              )}
            </div>
            <div className="user-info">
              <span className="user-name">{user.fullName}</span>
              <span className="user-role">Cashier</span>
            </div>
            <span className={`user-chevron ${showUserMenu ? 'open' : ''}`}>
              {Icons.chevronDown}
            </span>
          </button>

          {/* Dropdown Menu */}
          {showUserMenu && (
            <>
              <div className="user-menu-overlay" onClick={() => setShowUserMenu(false)} />
              <div className="user-menu-dropdown">
                {activeShift && (
                  <button className="dropdown-item" onClick={openEndShiftModal} style={{ color: '#ff9800' }}>
                    {Icons.clock}
                    <span>End Shift</span>
                  </button>
                )}
                <button className="dropdown-item logout" onClick={handleLogoutClick}>
                  {Icons.logout}
                  <span>Log Out</span>
                </button>
              </div>
            </>
          )}
        </div>
      </header>

      {/* Start Shift Modal */}
      {showStartShiftModal && (
        <div className="logout-modal-overlay" onClick={startingShift ? undefined : () => setShowStartShiftModal(false)}>
          <div className="logout-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px', position: 'relative' }}>
            <button 
              onClick={() => setShowStartShiftModal(false)}
              disabled={startingShift}
              style={{
                position: 'absolute',
                top: '12px',
                right: '12px',
                background: 'none',
                border: 'none',
                fontSize: '24px',
                cursor: 'pointer',
                color: '#888',
                padding: '4px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                lineHeight: '1',
                transition: 'color 0.2s'
              }}
              onMouseOver={(e) => e.target.style.color = '#333'}
              onMouseOut={(e) => e.target.style.color = '#888'}
              title="Close"
              aria-label="Close modal"
            >
              &times;
            </button>
            <div className="logout-modal-icon">💰</div>
            <h3>Start New Shift</h3>
            <p style={{ marginBottom: '16px', color: '#666' }}>Enter the starting cash amount in your drawer.</p>
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontWeight: '600', marginBottom: '6px', fontSize: '14px', color: '#333' }}>Starting Cash (₱)</label>
              <input
                type="text"
                inputMode="decimal"
                value={startingCash}
                onChange={(e) => handleCashInput(e.target.value, setStartingCash)}
                placeholder="0.00"
                autoFocus
                disabled={startingShift}
                style={{
                  width: '100%', padding: '12px', fontSize: '18px', fontWeight: '600',
                  border: '2px solid #ddd', borderRadius: '10px', textAlign: 'center',
                  outline: 'none', boxSizing: 'border-box'
                }}
              />
            </div>
            <div className="logout-modal-actions">
              <button className="btn-confirm-logout" onClick={handleStartShift} disabled={startingShift}
                style={{ backgroundColor: '#4CAF50', width: '100%' }}
              >
                {startingShift ? (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
                      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" fill="none" opacity="0.25" />
                      <path d="M22 12a10 10 0 0 1-10 10" stroke="currentColor" strokeWidth="3" fill="none">
                        <animateTransform attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur="0.8s" repeatCount="indefinite" />
                      </path>
                    </svg>
                    Starting Shift...
                  </span>
                ) : (
                  'Start Shift'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* End Shift Modal */}
      {showEndShiftModal && shiftSummary && (
        <div className="logout-modal-overlay" onClick={() => setShowEndShiftModal(false)}>
          <div className="logout-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '480px', textAlign: 'left' }}>
            <div style={{ textAlign: 'center', marginBottom: '16px' }}>
              <div className="logout-modal-icon">📊</div>
              <h3 style={{ margin: '8px 0 4px' }}>End Shift Summary</h3>
              <p style={{ color: '#888', fontSize: '13px' }}>
                Shift started: {new Date(shiftSummary.start_time).toLocaleString()} ({formatDuration(shiftSummary.start_time)})
              </p>
            </div>

            {/* Summary Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '16px' }}>
              <div style={{ background: '#f5f7fa', borderRadius: '10px', padding: '12px', textAlign: 'center' }}>
                <div style={{ fontSize: '12px', color: '#888', marginBottom: '4px' }}>Total Sales</div>
                <div style={{ fontSize: '20px', fontWeight: '700', color: '#2e7d32' }}>₱{(parseFloat(shiftSummary.total_sales) || 0).toFixed(2)}</div>
              </div>
              <div style={{ background: '#f5f7fa', borderRadius: '10px', padding: '12px', textAlign: 'center' }}>
                <div style={{ fontSize: '12px', color: '#888', marginBottom: '4px' }}>Transactions</div>
                <div style={{ fontSize: '20px', fontWeight: '700', color: '#1565c0' }}>{shiftSummary.total_transactions || 0}</div>
              </div>
              <div style={{ background: '#f5f7fa', borderRadius: '10px', padding: '12px', textAlign: 'center' }}>
                <div style={{ fontSize: '12px', color: '#888', marginBottom: '4px' }}>Voids</div>
                <div style={{ fontSize: '20px', fontWeight: '700', color: '#e65100' }}>{shiftSummary.total_voids || 0}</div>
              </div>
              <div style={{ background: '#f5f7fa', borderRadius: '10px', padding: '12px', textAlign: 'center' }}>
                <div style={{ fontSize: '12px', color: '#888', marginBottom: '4px' }}>Refunds</div>
                <div style={{ fontSize: '20px', fontWeight: '700', color: '#c62828' }}>₱{(parseFloat(shiftSummary.total_refunds) || 0).toFixed(2)}</div>
              </div>
            </div>

            {/* Expected Cash */}
            <div style={{ background: '#e8f5e9', borderRadius: '10px', padding: '12px', marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: '12px', color: '#2e7d32' }}>Starting Cash</div>
                <div style={{ fontSize: '14px', fontWeight: '600', color: '#333' }}>₱{(parseFloat(shiftSummary.starting_cash) || 0).toFixed(2)}</div>
              </div>
              <div style={{ fontSize: '20px', color: '#999' }}>+</div>
              <div>
                <div style={{ fontSize: '12px', color: '#2e7d32' }}>Sales</div>
                <div style={{ fontSize: '14px', fontWeight: '600', color: '#333' }}>₱{(parseFloat(shiftSummary.total_sales) || 0).toFixed(2)}</div>
              </div>
              <div style={{ fontSize: '20px', color: '#999' }}>−</div>
              <div>
                <div style={{ fontSize: '12px', color: '#c62828' }}>Refunds</div>
                <div style={{ fontSize: '14px', fontWeight: '600', color: '#333' }}>₱{(parseFloat(shiftSummary.total_refunds) || 0).toFixed(2)}</div>
              </div>
              <div style={{ fontSize: '20px', color: '#999' }}>=</div>
              <div>
                <div style={{ fontSize: '12px', color: '#1565c0', fontWeight: '700' }}>Expected</div>
                <div style={{ fontSize: '16px', fontWeight: '700', color: '#1565c0' }}>₱{expectedCash.toFixed(2)}</div>
              </div>
            </div>

            {/* Actual Cash Input */}
            <div style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', fontWeight: '600', marginBottom: '6px', fontSize: '14px' }}>Actual Cash Count (₱)</label>
              <input
                type="text"
                inputMode="decimal"
                value={actualCash}
                onChange={(e) => handleCashInput(e.target.value, setActualCash)}
                placeholder="0.00"
                autoFocus
                style={{
                  width: '100%', padding: '12px', fontSize: '18px', fontWeight: '600',
                  border: '2px solid #ddd', borderRadius: '10px', textAlign: 'center',
                  outline: 'none', boxSizing: 'border-box'
                }}
              />
            </div>

            {/* Difference Display */}
            {cashDifference !== null && (
              <div style={{
                padding: '10px', borderRadius: '10px', marginBottom: '12px', textAlign: 'center',
                background: cashDifference === 0 ? '#e8f5e9' : cashDifference > 0 ? '#fff3e0' : '#ffebee',
                color: cashDifference === 0 ? '#2e7d32' : cashDifference > 0 ? '#e65100' : '#c62828',
                fontWeight: '700', fontSize: '16px'
              }}>
                {cashDifference === 0 ? '✅ Exact Match' : cashDifference > 0 
                  ? `⬆️ Overage: ₱${cashDifference.toFixed(2)}` 
                  : `⬇️ Shortage: ₱${Math.abs(cashDifference).toFixed(2)}`}
              </div>
            )}

            {/* Notes */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontWeight: '600', marginBottom: '6px', fontSize: '13px', color: '#666' }}>Notes (optional)</label>
              <textarea
                value={endShiftNotes}
                onChange={(e) => setEndShiftNotes(e.target.value)}
                placeholder="Any notes about this shift..."
                rows={2}
                style={{
                  width: '100%', padding: '10px', fontSize: '13px',
                  border: '1px solid #ddd', borderRadius: '8px', resize: 'none',
                  outline: 'none', boxSizing: 'border-box'
                }}
              />
            </div>

            {/* Actions */}
            <div className="logout-modal-actions">
              <button className="btn-cancel" onClick={() => setShowEndShiftModal(false)} disabled={endingShift}>
                Cancel
              </button>
              <button 
                className="btn-confirm-logout" 
                onClick={handleEndShift}
                disabled={actualCash === '' || endingShift}
                style={{ backgroundColor: (actualCash === '' || endingShift) ? '#ccc' : '#ff9800' }}
              >
                {endingShift ? (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
                      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" fill="none" opacity="0.25" />
                      <path d="M22 12a10 10 0 0 1-10 10" stroke="currentColor" strokeWidth="3" fill="none">
                        <animateTransform attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur="0.8s" repeatCount="indefinite" />
                      </path>
                    </svg>
                    Ending Shift...
                  </span>
                ) : (
                  'Confirm & End Shift'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Logout Confirmation Modal */}
      {showLogoutModal && (
        <div className="logout-modal-overlay" onClick={handleLogoutCancel}>
          <div className="logout-modal" onClick={e => e.stopPropagation()}>
            <div className="logout-modal-icon">👋</div>
            <h3>Confirm Logout</h3>
            <p>Are you sure you want to log out of your account?</p>
            {activeShift && (
              <p style={{ color: '#ff9800', fontSize: '13px', fontWeight: '600', marginTop: '8px' }}>
                ⚠️ You have an active shift. Please end your shift before logging out.
              </p>
            )}
            <div className="logout-modal-actions">
              <button className="btn-cancel" onClick={handleLogoutCancel}>
                Cancel
              </button>
              <button className="btn-confirm-logout" onClick={handleLogoutConfirm}>
                Yes, Log Out
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
