import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import '../styles/sidebar.css';
import logoImg from '../assets/logo.png';

// SVG Icons as components
const Icons = {
  dashboard: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7"></rect>
      <rect x="14" y="3" width="7" height="7"></rect>
      <rect x="14" y="14" width="7" height="7"></rect>
      <rect x="3" y="14" width="7" height="7"></rect>
    </svg>
  ),
  pos: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
      <line x1="8" y1="21" x2="16" y2="21"></line>
      <line x1="12" y1="17" x2="12" y2="21"></line>
    </svg>
  ),
  orders: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"></path>
      <rect x="9" y="3" width="6" height="4" rx="1"></rect>
      <path d="M9 12h6"></path>
      <path d="M9 16h6"></path>
    </svg>
  ),
  menu: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8h1a4 4 0 0 1 0 8h-1"></path>
      <path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"></path>
      <line x1="6" y1="1" x2="6" y2="4"></line>
      <line x1="10" y1="1" x2="10" y2="4"></line>
      <line x1="14" y1="1" x2="14" y2="4"></line>
    </svg>
  ),
  discounts: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="9" r="2"></circle>
      <circle cx="15" cy="15" r="2"></circle>
      <line x1="5" y1="19" x2="19" y2="5"></line>
      <rect x="2" y="2" width="20" height="20" rx="2"></rect>
    </svg>
  ),
  beeper: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="5" y="4" width="14" height="16" rx="2"></rect>
      <circle cx="12" cy="18" r="1"></circle>
      <path d="M9 8h6M9 12h6"></path>
      <path d="M8 2v2M16 2v2"></path>
    </svg>
  ),
  library: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
    </svg>
  ),
  users: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
      <circle cx="9" cy="7" r="4"></circle>
      <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
      <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
    </svg>
  ),
  reports: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10"></line>
      <line x1="12" y1="20" x2="12" y2="4"></line>
      <line x1="6" y1="20" x2="6" y2="14"></line>
    </svg>
  ),
  settings: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3"></circle>
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
    </svg>
  ),
  chevronRight: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6"></polyline>
    </svg>
  ),
  chevronLeft: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 18 9 12 15 6"></polyline>
    </svg>
  ),
  chevronRightSmall: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6"></polyline>
    </svg>
  ),
  logout: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
      <polyline points="16 17 21 12 16 7"></polyline>
      <line x1="21" y1="12" x2="9" y2="12"></line>
    </svg>
  ),
  hamburger: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="3" y1="12" x2="21" y2="12"></line>
      <line x1="3" y1="6" x2="21" y2="6"></line>
      <line x1="3" y1="18" x2="21" y2="18"></line>
    </svg>
  ),
  close: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18"></line>
      <line x1="6" y1="6" x2="18" y2="18"></line>
    </svg>
  ),
  cash: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1" y="4" width="22" height="16" rx="2" ry="2"></rect>
      <circle cx="12" cy="12" r="3"></circle>
      <line x1="1" y1="8" x2="4" y2="8"></line>
      <line x1="20" y1="8" x2="23" y2="8"></line>
      <line x1="1" y1="16" x2="4" y2="16"></line>
      <line x1="20" y1="16" x2="23" y2="16"></line>
    </svg>
  )
};

export default function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const [openMenus, setOpenMenus] = useState({});
  const [user, setUser] = useState({ fullName: 'Admin', role: 'Manager' });
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Desktop collapsed state - persisted in localStorage
  const [desktopCollapsed, setDesktopCollapsed] = useState(() => {
    const saved = localStorage.getItem('sidebar-collapsed');
    return saved === 'true';
  });

  // Detect mobile vs desktop
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1025);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Persist desktop collapsed state
  useEffect(() => {
    localStorage.setItem('sidebar-collapsed', desktopCollapsed.toString());
    // Dispatch event so other components can react to sidebar changes
    window.dispatchEvent(new CustomEvent('sidebarToggled', { detail: { collapsed: desktopCollapsed } }));
  }, [desktopCollapsed]);

  // Load user data initially and listen for changes
  useEffect(() => {
    const loadUserData = () => {
      const storedUser = localStorage.getItem('user');
      if (storedUser) {
        const userData = JSON.parse(storedUser);
        setUser({ fullName: userData.fullName || 'Admin', role: userData.role || 'Manager' });
      }
    };
    
    loadUserData();
    
    const handleStorageChange = (e) => {
      if (e.key === 'user') {
        loadUserData();
      }
    };
    
    const handleUserUpdate = () => {
      loadUserData();
    };
    
    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('userUpdated', handleUserUpdate);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('userUpdated', handleUserUpdate);
    };
  }, []);

  useEffect(() => {
    const path = location.pathname;
    if (['/orders', '/orders/ready', '/orders/completed', '/orders/void'].some(p => path.startsWith(p))) {
      setOpenMenus(prev => ({ ...prev, orders: true }));
    }
    if (['/menu', '/menu/categories', '/menu/items'].includes(path)) {
      setOpenMenus(prev => ({ ...prev, menu: true }));
    }
    if (['/library', '/library/tables', '/library/transactions'].some(p => path.startsWith(p))) {
      setOpenMenus(prev => ({ ...prev, library: true }));
    }
  }, [location.pathname]);

  const isActive = (path) => location.pathname === path;
  const isGroupActive = (paths) => paths.some(p => location.pathname === p || location.pathname.startsWith(p));

  const toggleMenu = (menu) => {
    // On desktop collapsed, expand sidebar first when clicking dropdown
    if (!isMobile && desktopCollapsed) {
      setDesktopCollapsed(false);
      setOpenMenus(prev => ({ ...prev, [menu]: true }));
      return;
    }
    setOpenMenus(prev => ({ ...prev, [menu]: !prev[menu] }));
  };

  const handleLogoutClick = () => {
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

  const handleDesktopToggle = () => {
    setDesktopCollapsed(prev => !prev);
  };

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: 'dashboard', path: '/dashboard', type: 'link' },
    { id: 'pos', label: 'POS', icon: 'pos', path: '/pos', type: 'link' },
    {
      id: 'orders', label: 'Order Management', icon: 'orders', type: 'dropdown',
      paths: ['/orders', '/orders/ready', '/orders/completed', '/orders/void'],
      children: [
        { label: 'Order Queue', path: '/orders' },
        { label: 'Ready Orders', path: '/orders/ready' },
        { label: 'Completed', path: '/orders/completed' },
        { label: 'Refund Order', path: '/orders/void' }
      ]
    },
    {
      id: 'menu', label: 'Menu Management', icon: 'menu', type: 'dropdown',
      paths: ['/menu', '/menu/categories', '/menu/items', '/menu/customizations'],
      children: [
        { label: 'All Items', path: '/menu' },
        { label: 'Add Category', path: '/menu/categories' },
        { label: 'Add Item', path: '/menu/items' },
        { label: 'Customizations', path: '/menu/customizations' }
      ]
    },
    { id: 'discounts', label: 'Discounts', icon: 'discounts', path: '/discounts', type: 'link' },
    { id: 'beepers', label: 'Beeper Management', icon: 'beeper', path: '/beepers', type: 'link' },
    {
      id: 'library', label: 'Library Management', icon: 'library', type: 'dropdown',
      paths: ['/library/tables', '/library/transactions'],
      children: [
        { label: 'Transactions', path: '/library/transactions' },
        { label: 'Manage Tables', path: '/library/tables' }
      ]
    },
    { id: 'users', label: 'Staff Management', icon: 'users', path: '/users', type: 'link' },
    { id: 'cash', label: 'Cash Management', icon: 'cash', path: '/cash', type: 'link' },
    { id: 'reports', label: 'Reports', icon: 'reports', path: '/reports', type: 'link' },
    { id: 'settings', label: 'Settings', icon: 'settings', path: '/config', type: 'link' }
  ];

  // Determine sidebar class
  const isCollapsed = isMobile ? !mobileOpen : desktopCollapsed;

  return (
    <>
      <div className={`sidebar-overlay ${isMobile && mobileOpen ? 'active' : ''}`} onClick={() => setMobileOpen(false)} />
      
      {/* Mobile hamburger toggle */}
      <button className="sidebar-toggle" onClick={() => setMobileOpen(!mobileOpen)}>
        {mobileOpen ? Icons.close : Icons.hamburger}
      </button>

      <aside className={`sidebar ${isCollapsed ? 'collapsed' : ''}`}>
        {/* Desktop collapse toggle */}
        <button className="sidebar-collapse-btn" onClick={handleDesktopToggle} title={desktopCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
          {desktopCollapsed ? Icons.chevronRightSmall : Icons.chevronLeft}
        </button>

        <div className="sidebar-header">
          <div className="logo">
            <img src={logoImg} alt="Library Coffee Logo" className="logo-img" />
            <div className="logo-text">
              <h1>LIBRARY</h1>
              <p>Coffee + Study</p>
            </div>
          </div>
        </div>

        <nav className="sidebar-nav">
          {menuItems.map((item) => (
            <div key={item.id} className="nav-item-wrapper" data-tooltip={item.label}>
              {item.type === 'link' ? (
                <Link 
                  to={item.path} 
                  className={`nav-item ${isActive(item.path) ? 'active' : ''}`}
                  onClick={() => isMobile && setMobileOpen(false)}
                >
                  <span className="nav-icon">{Icons[item.icon]}</span>
                  <span className="nav-label">{item.label}</span>
                </Link>
              ) : (
                <>
                  <button 
                    className={`nav-item dropdown-toggle ${isGroupActive(item.paths) ? 'has-active-child' : ''}`}
                    onClick={() => toggleMenu(item.id)}
                  >
                    <span className="nav-icon">{Icons[item.icon]}</span>
                    <span className="nav-label">{item.label}</span>
                    <span className={`nav-arrow ${openMenus[item.id] ? 'open' : ''}`}>
                      {Icons.chevronRight}
                    </span>
                  </button>
                  <div className={`dropdown-menu ${openMenus[item.id] ? 'open' : ''}`}>
                    {item.children.map((child) => (
                      <Link 
                        key={child.path}
                        to={child.path} 
                        className={`dropdown-item ${isActive(child.path) ? 'active' : ''}`}
                        onClick={() => isMobile && setMobileOpen(false)}
                      >
                        <span>{child.label}</span>
                      </Link>
                    ))}
                  </div>
                </>
              )}
            </div>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="user-profile">
            <div className="user-avatar">{user.fullName.charAt(0).toUpperCase()}</div>
            <div className="user-info">
              <span className="user-name">{user.fullName}</span>
              <span className="user-role">{user.role}</span>
            </div>
          </div>
          <button className="logout-btn" onClick={handleLogoutClick}>
            <span>{Icons.logout}</span>
            <span>Log Out</span>
          </button>
        </div>
      </aside>

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
