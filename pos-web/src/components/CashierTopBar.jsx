import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
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
  )
};

// Get initial user from localStorage
function getInitialUser() {
  const storedUser = localStorage.getItem('user');
  if (storedUser) {
    const userData = JSON.parse(storedUser);
    return { fullName: userData.fullName || 'Cashier', role: userData.role || 'cashier' };
  }
  return { fullName: 'Cashier', role: 'cashier' };
}

export default function CashierTopBar() {
  const location = useLocation();
  const navigate = useNavigate();
  const [user] = useState(getInitialUser);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);

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

  const navItems = [
    { id: 'pos', label: 'POS', icon: Icons.pos, path: '/pos' },
    { id: 'library', label: 'Library', icon: Icons.library, path: '/library/transactions' },
    { id: 'orders', label: 'Order Queue', icon: Icons.orders, path: '/orders' },
    { id: 'completed', label: 'Completed', icon: Icons.completed, path: '/orders/completed' }
  ];

  return (
    <>
      <header className="cashier-topbar">
        {/* Logo Section */}
        <div className="topbar-logo">
          <span className="logo-icon">☕</span>
          <div className="logo-text">
            <span className="logo-title">LIBRARY</span>
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

        {/* User Menu */}
        <div className="topbar-user">
          <button 
            className="user-menu-btn"
            onClick={() => setShowUserMenu(!showUserMenu)}
          >
            <div className="user-avatar">{user.fullName.charAt(0).toUpperCase()}</div>
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
                <button className="dropdown-item logout" onClick={handleLogoutClick}>
                  {Icons.logout}
                  <span>Log Out</span>
                </button>
              </div>
            </>
          )}
        </div>
      </header>

      {/* Logout Confirmation Modal */}
      {showLogoutModal && (
        <div className="logout-modal-overlay" onClick={handleLogoutCancel}>
          <div className="logout-modal" onClick={e => e.stopPropagation()}>
            <div className="logout-modal-icon">👋</div>
            <h3>Confirm Logout</h3>
            <p>Are you sure you want to log out of your account?</p>
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
