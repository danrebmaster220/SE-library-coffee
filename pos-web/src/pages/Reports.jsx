import { useState, useEffect, useRef, useCallback } from 'react';
import api from '../api';
import Toast from '../components/Toast';
import FilterSelectWrap from '../components/FilterSelectWrap';
import '../styles/reports.css';

export default function Reports() {
  // Tab state
  const [activeTab, setActiveTab] = useState('orders');
  
  // Common filters
  const [searchTerm, setSearchTerm] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [cashierFilter, setCashierFilter] = useState('');
  const [cashierOptions, setCashierOptions] = useState([]);
  const [loading, setLoading] = useState(false);
  
  // Export dropdown state
  const [showExportDropdown, setShowExportDropdown] = useState(false);
  const exportDropdownRef = useRef(null);
  
  // Toast notification state
  const [toast, setToast] = useState({ show: false, message: '', type: 'info' });
  
  // Orders report state
  const [ordersData, setOrdersData] = useState([]);
  const [orderTypeFilter, setOrderTypeFilter] = useState('');
  const [orderStatusFilter, setOrderStatusFilter] = useState('');
  
  // Sales report state
  const [salesData, setSalesData] = useState(null);
  const [salesDetails, setSalesDetails] = useState([]);
  
  // Library report state
  const [libraryData, setLibraryData] = useState([]);
  const [librarySummary, setLibrarySummary] = useState({ total_sessions: 0, total_revenue: 0, total_hours: 0 });
  const [sessionStatusFilter, setSessionStatusFilter] = useState('');

  // Audit report state
  const [auditData, setAuditData] = useState([]);
  const [auditActionFilter, setAuditActionFilter] = useState('');

  // Pagination states
  const [ordersPage, setOrdersPage] = useState(1);
  const [salesPage, setSalesPage] = useState(1);
  const [libraryPage, setLibraryPage] = useState(1);
  const [auditPage, setAuditPage] = useState(1);
  const rowsPerPage = 10;

  // Toast helper function
  const showToast = useCallback((message, type = 'info') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: '', type: 'info' }), 3000);
  }, []);

  // Set default dates to today
  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    setStartDate(weekAgo);
    setEndDate(today);
  }, []);

  useEffect(() => {
    fetchCashierOptions();
  }, []);

  // Fetch data when tab or filters change
  useEffect(() => {
    if (startDate && endDate) {
      fetchReportData();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, startDate, endDate]);

  // Close export dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (exportDropdownRef.current && !exportDropdownRef.current.contains(event.target)) {
        setShowExportDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchReportData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'orders') {
        await fetchOrdersReport();
      } else if (activeTab === 'sales') {
        await fetchSalesReport();
      } else if (activeTab === 'library') {
        await fetchLibraryReport();
      } else if (activeTab === 'audit') {
        await fetchAuditReport();
      }
    } catch (error) {
      console.error('Error fetching report:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchOrdersReport = async () => {
    try {
      const response = await api.get('/reports/orders', {
        params: {
          startDate,
          endDate,
          orderType: orderTypeFilter,
          status: orderStatusFilter,
          cashierUserId: cashierFilter || undefined
        }
      });
      setOrdersData(response.data.orders || []);
    } catch (error) {
      console.error('Error fetching orders report:', error);
      setOrdersData([]);
    }
  };

  const fetchSalesReport = async () => {
    try {
      const params = {
        startDate,
        endDate,
        cashierUserId: cashierFilter || undefined
      };
      console.log('Fetching sales report with params:', params);
      const [summaryRes, detailsRes] = await Promise.all([
        api.get('/reports/sales-summary', { params }),
        api.get('/reports/sales-details', { params })
      ]);
      console.log('Sales summary response:', summaryRes.data);
      console.log('Sales details response:', detailsRes.data);
      setSalesData(summaryRes.data);
      setSalesDetails(detailsRes.data || []);
    } catch (error) {
      console.error('Error fetching sales report:', error.response?.data || error.message);
    }
  };

  const fetchLibraryReport = async () => {
    try {
      console.log('Fetching library report with params:', {
        startDate,
        endDate,
        status: sessionStatusFilter,
        search: searchTerm,
        cashierUserId: cashierFilter || undefined
      });
      const response = await api.get('/reports/library', {
        params: {
          startDate,
          endDate,
          status: sessionStatusFilter,
          search: searchTerm,
          cashierUserId: cashierFilter || undefined
        }
      });
      console.log('Library report response:', response.data);
      setLibraryData(response.data.sessions || []);
      setLibrarySummary(response.data.summary || { total_sessions: 0, total_revenue: 0, total_hours: 0 });
    } catch (error) {
      console.error('Error fetching library report:', error.response?.data || error.message);
      setLibraryData([]);
      setLibrarySummary({ total_sessions: 0, total_revenue: 0, total_hours: 0 });
    }
  };

  const fetchAuditReport = async () => {
    try {
      const response = await api.get('/reports/audit-logs', {
        params: {
          startDate,
          endDate,
          action: auditActionFilter,
          staffUserId: cashierFilter || undefined,
          search: searchTerm,
          limit: 500
        }
      });

      setAuditData(response.data.logs || []);
    } catch (error) {
      console.error('Error fetching audit report:', error.response?.data || error.message);
      setAuditData([]);
    }
  };

  const handleApplyFilters = () => {
    fetchReportData();
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

  const handleExportExcel = async () => {
    try {
      const token = localStorage.getItem('token');
      const params = new URLSearchParams({
        startDate,
        endDate,
        type: activeTab
      });
      
      if (activeTab === 'orders') {
        if (orderTypeFilter) params.append('orderType', orderTypeFilter);
        if (orderStatusFilter) params.append('status', orderStatusFilter);
        if (cashierFilter) params.append('cashierUserId', cashierFilter);
      } else if (activeTab === 'sales') {
        if (cashierFilter) params.append('cashierUserId', cashierFilter);
      } else if (activeTab === 'library') {
        if (sessionStatusFilter) params.append('status', sessionStatusFilter);
        if (cashierFilter) params.append('cashierUserId', cashierFilter);
      } else if (activeTab === 'audit') {
        if (auditActionFilter) params.append('action', auditActionFilter);
        if (cashierFilter) params.append('staffUserId', cashierFilter);
        if (searchTerm) params.append('search', searchTerm);
      }

      // Use fetch with auth header to download the file
      const response = await fetch(`${api.defaults.baseURL}/reports/export?${params.toString()}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Export failed');
      }

      // Get the filename from the response headers
      const contentDisposition = response.headers.get('Content-Disposition');
      let filename = `report_${activeTab}_${startDate}_to_${endDate}.xlsx`;
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="?(.+)"?/);
        if (filenameMatch) {
          filename = filenameMatch[1];
        }
      }

      // Download the file
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      setShowExportDropdown(false);
    } catch (error) {
      console.error('Export error:', error);
      showToast('Failed to export report. Please try again.', 'error');
    }
  };

  const handleExportPDF = async () => {
    try {
      const token = localStorage.getItem('token');
      const params = new URLSearchParams({
        startDate,
        endDate,
        type: activeTab
      });
      
      if (activeTab === 'orders') {
        if (orderTypeFilter) params.append('orderType', orderTypeFilter);
        if (orderStatusFilter) params.append('status', orderStatusFilter);
        if (cashierFilter) params.append('cashierUserId', cashierFilter);
      } else if (activeTab === 'sales') {
        if (cashierFilter) params.append('cashierUserId', cashierFilter);
      } else if (activeTab === 'library') {
        if (sessionStatusFilter) params.append('status', sessionStatusFilter);
        if (cashierFilter) params.append('cashierUserId', cashierFilter);
      } else if (activeTab === 'audit') {
        if (auditActionFilter) params.append('action', auditActionFilter);
        if (cashierFilter) params.append('staffUserId', cashierFilter);
        if (searchTerm) params.append('search', searchTerm);
      }

      // Use fetch with auth header to download the file
      const response = await fetch(`${api.defaults.baseURL}/reports/export-pdf?${params.toString()}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Export failed');
      }

      // Get the filename from the response headers
      const contentDisposition = response.headers.get('Content-Disposition');
      let filename = `report_${activeTab}_${startDate}_to_${endDate}.pdf`;
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="?(.+)"?/);
        if (filenameMatch) {
          filename = filenameMatch[1];
        }
      }

      // Download the file
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      setShowExportDropdown(false);
    } catch (error) {
      console.error('PDF Export error:', error);
      showToast('Failed to export PDF. Please try again.', 'error');
    }
  };

  const formatCurrency = (amount) => {
    return `₱${parseFloat(amount || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('en-PH', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
  };

  const formatDateTime = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleString('en-PH', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatAuditAction = (action) => {
    if (!action) return '-';
    return String(action)
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (match) => match.toUpperCase());
  };

  const getAuditActionBadgeClass = (action) => {
    const normalized = String(action || '').toLowerCase();

    if (!normalized) return 'audit-other';

    if (normalized.includes('login') || normalized.includes('logout') || normalized.includes('auth')) {
      return 'audit-auth';
    }

    if (normalized.startsWith('shift_') || normalized.includes('shift')) {
      return 'audit-shift';
    }

    if (
      normalized.includes('order') ||
      normalized.includes('transaction') ||
      normalized.includes('payment') ||
      normalized.includes('checkout') ||
      normalized.includes('void') ||
      normalized.includes('refund')
    ) {
      return 'audit-order';
    }

    if (
      normalized.includes('item') ||
      normalized.includes('menu') ||
      normalized.includes('stock') ||
      normalized.includes('inventory')
    ) {
      return 'audit-inventory';
    }

    if (
      normalized.includes('user') ||
      normalized.includes('role') ||
      normalized.includes('permission') ||
      normalized.includes('admin')
    ) {
      return 'audit-admin';
    }

    if (
      normalized.includes('error') ||
      normalized.includes('fail') ||
      normalized.includes('denied') ||
      normalized.includes('blocked')
    ) {
      return 'audit-risk';
    }

    return 'audit-other';
  };

  const AUDIT_DETAIL_LABELS = {
    starting_cash: 'Starting Cash',
    expected_cash: 'Expected Cash',
    actual_cash: 'Actual Cash',
    cash_difference: 'Cash Difference',
    notes: 'Notes'
  };

  const formatAuditDetailKey = (key) => {
    if (!key) return '';
    if (AUDIT_DETAIL_LABELS[key]) return AUDIT_DETAIL_LABELS[key];

    return String(key)
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (match) => match.toUpperCase());
  };

  const formatAuditDetails = (details) => {
    if (!details) return '-';

    let parsed = details;
    if (typeof details === 'string') {
      try {
        parsed = JSON.parse(details);
      } catch {
        return details;
      }
    }

    if (typeof parsed !== 'object') {
      return String(parsed);
    }

    const hiddenKeys = new Set(['backfilled', 'target_user_id']);

    const preview = Object.entries(parsed)
      .filter(([key]) => !hiddenKeys.has(key))
      .slice(0, 3)
      .map(([key, value]) => `${formatAuditDetailKey(key)}: ${value}`)
      .join(' | ');

    return preview || '-';
  };

  const getAuditAffectedStaffLabel = (log) => {
    if (log?.affected_staff_full_name || log?.affected_staff_username) {
      const fullName = log.affected_staff_full_name || '';
      const username = log.affected_staff_username ? `@${log.affected_staff_username}` : '';
      return `${fullName} ${username}`.trim();
    }

    let parsed = log?.details_json;
    if (typeof parsed === 'string') {
      try {
        parsed = JSON.parse(parsed);
      } catch {
        return '-';
      }
    }

    const targetUserId = parsed?.target_user_id;
    if (!targetUserId) return '-';

    const matchedStaff = cashierOptions.find((staff) => Number(staff.user_id) === Number(targetUserId));
    if (matchedStaff) {
      return `${matchedStaff.full_name || matchedStaff.username || `User #${targetUserId}`}`;
    }

    return `User #${targetUserId}`;
  };

  // Filter data based on search term
  const filteredOrders = ordersData.filter(order => {
    const searchLower = searchTerm.toLowerCase();
    const orderId = String(order.transaction_id || order.order_id || '');
    const orderFormatted = `ord-${orderId.padStart(6, '0')}`;
    
    return (
      orderId.includes(searchLower) ||
      orderFormatted.includes(searchLower) ||
      String(order.beeper_number || '').includes(searchLower) ||
      (order.customer_name || '').toLowerCase().includes(searchLower)
    );
  });

  const filteredLibrary = libraryData.filter(session => {
    const searchLower = searchTerm.toLowerCase();
    const sessionId = String(session.session_id || '');
    const sessionFormatted = `lib-${sessionId.padStart(6, '0')}`;
    
    return (
      sessionId.includes(searchLower) ||
      sessionFormatted.includes(searchLower) ||
      (session.customer_name || '').toLowerCase().includes(searchLower) ||
      String(session.table_number || '').includes(searchLower)
    );
  });

  const filteredAudit = auditData.filter((log) => {
    if (!searchTerm) return true;

    const searchLower = searchTerm.toLowerCase();
    const actor = `${log.actor_full_name || ''} ${log.actor_username || ''}`.toLowerCase();
    const targetText = `${log.target_type || ''} ${log.target_id || ''}`.toLowerCase();
    const affectedStaffText = getAuditAffectedStaffLabel(log).toLowerCase();
    const actionText = String(log.action || '').toLowerCase();
    const ipText = String(log.ip_address || '').toLowerCase();

    return (
      actionText.includes(searchLower) ||
      actor.includes(searchLower) ||
      affectedStaffText.includes(searchLower) ||
      targetText.includes(searchLower) ||
      ipText.includes(searchLower)
    );
  });

  // Reset page when filter/search changes
  useEffect(() => {
    setOrdersPage(1);
  }, [searchTerm, ordersData, orderTypeFilter, orderStatusFilter, cashierFilter]);

  useEffect(() => {
    setSalesPage(1);
  }, [salesDetails, cashierFilter]);

  useEffect(() => {
    setLibraryPage(1);
  }, [searchTerm, libraryData, sessionStatusFilter, cashierFilter]);

  useEffect(() => {
    setAuditPage(1);
  }, [searchTerm, auditData, auditActionFilter, cashierFilter]);

  // Pagination calculations for Orders
  const ordersTotalPages = Math.ceil(filteredOrders.length / rowsPerPage);
  const ordersStartIndex = (ordersPage - 1) * rowsPerPage;
  const ordersEndIndex = ordersStartIndex + rowsPerPage;
  const paginatedOrders = filteredOrders.slice(ordersStartIndex, ordersEndIndex);

  // Pagination calculations for Sales
  const salesTotalPages = Math.ceil(salesDetails.length / rowsPerPage);
  const salesStartIndex = (salesPage - 1) * rowsPerPage;
  const salesEndIndex = salesStartIndex + rowsPerPage;
  const paginatedSales = salesDetails.slice(salesStartIndex, salesEndIndex);

  // Pagination calculations for Library
  const libraryTotalPages = Math.ceil(filteredLibrary.length / rowsPerPage);
  const libraryStartIndex = (libraryPage - 1) * rowsPerPage;
  const libraryEndIndex = libraryStartIndex + rowsPerPage;
  const paginatedLibrary = filteredLibrary.slice(libraryStartIndex, libraryEndIndex);

  // Pagination calculations for Audit
  const auditTotalPages = Math.ceil(filteredAudit.length / rowsPerPage);
  const auditStartIndex = (auditPage - 1) * rowsPerPage;
  const auditEndIndex = auditStartIndex + rowsPerPage;
  const paginatedAudit = filteredAudit.slice(auditStartIndex, auditEndIndex);

  // Generate page numbers helper function
  const getPageNumbers = (currentPage, totalPages) => {
    const pages = [];
    const maxVisiblePages = 5;
    
    if (totalPages <= maxVisiblePages) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      if (currentPage <= 3) {
        for (let i = 1; i <= 4; i++) pages.push(i);
        pages.push('...');
        pages.push(totalPages);
      } else if (currentPage >= totalPages - 2) {
        pages.push(1);
        pages.push('...');
        for (let i = totalPages - 3; i <= totalPages; i++) pages.push(i);
      } else {
        pages.push(1);
        pages.push('...');
        for (let i = currentPage - 1; i <= currentPage + 1; i++) pages.push(i);
        pages.push('...');
        pages.push(totalPages);
      }
    }
    return pages;
  };

  return (
    <div className="main-content">
      <div className="page-header-section">
        <div className="page-title-group">
          <h1 className="page-title">Reports</h1>
          <p className="page-subtitle">View and export your business reports</p>
        </div>
      </div>

      {/* Report Header with Tabs and Export Button */}
      <div className="report-header">
        <div className="report-tabs">
          <button 
            className={`report-tab ${activeTab === 'orders' ? 'active' : ''}`}
            onClick={() => setActiveTab('orders')}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
              <line x1="16" y1="13" x2="8" y2="13"></line>
              <line x1="16" y1="17" x2="8" y2="17"></line>
            </svg>
            Orders Reports
          </button>
          <button 
            className={`report-tab ${activeTab === 'sales' ? 'active' : ''}`}
            onClick={() => setActiveTab('sales')}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="1" x2="12" y2="23"></line>
              <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
            </svg>
            Sales Reports
          </button>
          <button 
            className={`report-tab ${activeTab === 'library' ? 'active' : ''}`}
            onClick={() => setActiveTab('library')}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
            </svg>
            StudyHall Reports
          </button>
          <button
            className={`report-tab ${activeTab === 'audit' ? 'active' : ''}`}
            onClick={() => setActiveTab('audit')}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2L4 6v6c0 5.55 3.84 10.74 8 12 4.16-1.26 8-6.45 8-12V6l-8-4z"></path>
              <path d="M9 12l2 2 4-4"></path>
            </svg>
            Audit Trail
          </button>
        </div>

        <div className="export-dropdown-container" ref={exportDropdownRef}>
          <button 
            className="btn-export" 
            onClick={() => setShowExportDropdown(!showExportDropdown)}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="7 10 12 15 17 10"></polyline>
              <line x1="12" y1="15" x2="12" y2="3"></line>
            </svg>
            Export
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="dropdown-arrow">
              <polyline points="6 9 12 15 18 9"></polyline>
            </svg>
          </button>
          {showExportDropdown && (
            <div className="export-dropdown-menu">
              <button className="export-dropdown-item" onClick={handleExportExcel}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                  <polyline points="14 2 14 8 20 8"></polyline>
                  <line x1="16" y1="13" x2="8" y2="13"></line>
                  <line x1="16" y1="17" x2="8" y2="17"></line>
                </svg>
                <span>Excel (.xlsx)</span>
              </button>
              <button className="export-dropdown-item" onClick={handleExportPDF}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                  <polyline points="14 2 14 8 20 8"></polyline>
                  <path d="M9 15v-2h6v2"></path>
                  <path d="M12 13v5"></path>
                </svg>
                <span>PDF (.pdf)</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Toolbar Section */}
      <div className="toolbar-section">
        <div className="toolbar-left">
          <div className="search-box">
            <svg className="search-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
            <input
              type="text"
              className="search-input"
              placeholder={
                activeTab === 'orders'
                  ? 'Search by order #...'
                  : activeTab === 'library'
                    ? 'Search by session or customer #...'
                    : activeTab === 'audit'
                      ? 'Search by actor, action, target, IP...'
                      : 'Search...'
              }
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {/* Date Range */}
          <div className="date-range-group">
            <input
              type="date"
              className="date-input"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
            <span className="date-separator">to</span>
            <input
              type="date"
              className="date-input"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>

          <div className="toolbar-filters-actions">
            {/* Conditional Filters based on active tab */}
            <FilterSelectWrap>
              <select
                className="filter-select filter-select--cashier"
                value={cashierFilter}
                onChange={(e) => setCashierFilter(e.target.value)}
              >
                <option value="">All Staff</option>
                {cashierOptions.map((staff) => (
                  <option key={staff.user_id} value={staff.user_id}>
                    {staff.full_name || staff.username || `User #${staff.user_id}`}
                  </option>
                ))}
              </select>
            </FilterSelectWrap>

            {activeTab === 'orders' && (
              <>
                <FilterSelectWrap>
                  <select
                    className="filter-select"
                    value={orderTypeFilter}
                    onChange={(e) => setOrderTypeFilter(e.target.value)}
                  >
                    <option value="">All Types</option>
                    <option value="dine-in">Dine In</option>
                    <option value="takeout">Take Out</option>
                  </select>
                </FilterSelectWrap>
                <FilterSelectWrap>
                  <select
                    className="filter-select"
                    value={orderStatusFilter}
                    onChange={(e) => setOrderStatusFilter(e.target.value)}
                  >
                    <option value="">All Status</option>
                    <option value="completed">Completed</option>
                    <option value="preparing">Preparing</option>
                    <option value="ready">Ready</option>
                    <option value="voided">Voided</option>
                    <option value="refunded">Refunded</option>
                  </select>
                </FilterSelectWrap>
              </>
            )}

            {activeTab === 'library' && (
              <FilterSelectWrap>
                <select
                  className="filter-select"
                  value={sessionStatusFilter}
                  onChange={(e) => setSessionStatusFilter(e.target.value)}
                >
                  <option value="">All Status</option>
                  <option value="completed">Completed</option>
                  <option value="active">Active</option>
                  <option value="voided">Voided</option>
                </select>
              </FilterSelectWrap>
            )}

            {activeTab === 'audit' && (
              <FilterSelectWrap>
                <select
                  className="filter-select"
                  value={auditActionFilter}
                  onChange={(e) => setAuditActionFilter(e.target.value)}
                >
                  <option value="">All Actions</option>
                  <option value="shift_started">Shift Started</option>
                  <option value="shift_ended">Shift Ended</option>
                  <option value="shift_force_closed">Shift Force Closed</option>
                </select>
              </FilterSelectWrap>
            )}

            <button type="button" className="btn-apply-filter" onClick={handleApplyFilters}>
              Apply Filter
            </button>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="summary-cards">
        {activeTab === 'orders' && (
          <>
            <div className="summary-card">
              <div className="summary-icon orders-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                  <polyline points="14 2 14 8 20 8"></polyline>
                </svg>
              </div>
              <div className="summary-info">
                <h4>Total Orders</h4>
                <p className="summary-value">{filteredOrders.length}</p>
              </div>
            </div>
            <div className="summary-card">
              <div className="summary-icon sales-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="12" y1="1" x2="12" y2="23"></line>
                  <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
                </svg>
              </div>
              <div className="summary-info">
                <h4>Total Revenue</h4>
                <p className="summary-value">{formatCurrency(filteredOrders.reduce((sum, o) => sum + parseFloat(o.total_amount || 0), 0))}</p>
              </div>
            </div>
            <div className="summary-card">
              <div className="summary-icon avg-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
                </svg>
              </div>
              <div className="summary-info">
                <h4>Avg. Order Value</h4>
                <p className="summary-value">
                  {formatCurrency(filteredOrders.length > 0 ? filteredOrders.reduce((sum, o) => sum + parseFloat(o.total_amount || 0), 0) / filteredOrders.length : 0)}
                </p>
              </div>
            </div>
          </>
        )}

        {activeTab === 'sales' && (
          <>
            <div className="summary-card">
              <div className="summary-icon sales-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="12" y1="1" x2="12" y2="23"></line>
                  <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
                </svg>
              </div>
              <div className="summary-info">
                <h4>Net Sales</h4>
                <p className="summary-value">{formatCurrency(salesData?.total_sales || 0)}</p>
              </div>
            </div>
            <div className="summary-card">
              <div className="summary-icon discount-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="8" y1="12" x2="16" y2="12"></line>
                </svg>
              </div>
              <div className="summary-info">
                <h4>Total Discounts</h4>
                <p className="summary-value">{formatCurrency(salesData?.total_discounts || 0)}</p>
              </div>
            </div>
            <div className="summary-card">
              <div className="summary-icon orders-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="1" y="4" width="22" height="16" rx="2" ry="2"></rect>
                  <line x1="1" y1="10" x2="23" y2="10"></line>
                </svg>
              </div>
              <div className="summary-info">
                <h4>Total Transactions</h4>
                <p className="summary-value">{salesData?.total_orders || 0}</p>
              </div>
            </div>
          </>
        )}

        {activeTab === 'library' && (
          <>
            <div className="summary-card">
              <div className="summary-icon library-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
                  <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
                </svg>
              </div>
              <div className="summary-info">
                <h4>Total Sessions</h4>
                <p className="summary-value">{librarySummary.total_sessions}</p>
              </div>
            </div>
            <div className="summary-card">
              <div className="summary-icon sales-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="12" y1="1" x2="12" y2="23"></line>
                  <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
                </svg>
              </div>
              <div className="summary-info">
                <h4>Total Revenue</h4>
                <p className="summary-value">{formatCurrency(librarySummary.total_revenue)}</p>
              </div>
            </div>
            <div className="summary-card">
              <div className="summary-icon time-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"></circle>
                  <polyline points="12 6 12 12 16 14"></polyline>
                </svg>
              </div>
              <div className="summary-info">
                <h4>Total Hours</h4>
                <p className="summary-value">{librarySummary.total_hours} hrs</p>
              </div>
            </div>
          </>
        )}

        {activeTab === 'audit' && (
          <>
            <div className="summary-card">
              <div className="summary-icon orders-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 2L4 6v6c0 5.55 3.84 10.74 8 12 4.16-1.26 8-6.45 8-12V6l-8-4z"></path>
                  <path d="M9 12l2 2 4-4"></path>
                </svg>
              </div>
              <div className="summary-info">
                <h4>Total Events</h4>
                <p className="summary-value">{filteredAudit.length}</p>
              </div>
            </div>
            <div className="summary-card">
              <div className="summary-icon avg-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                  <circle cx="8.5" cy="7" r="4"></circle>
                </svg>
              </div>
              <div className="summary-info">
                <h4>Unique Actors</h4>
                <p className="summary-value">
                  {new Set(filteredAudit.map((item) => item.actor_user_id).filter(Boolean)).size}
                </p>
              </div>
            </div>
            <div className="summary-card">
              <div className="summary-icon discount-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="8" y1="8" x2="16" y2="16"></line>
                  <line x1="16" y1="8" x2="8" y2="16"></line>
                </svg>
              </div>
              <div className="summary-info">
                <h4>Force Closures</h4>
                <p className="summary-value">
                  {filteredAudit.filter((item) => item.action === 'shift_force_closed').length}
                </p>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Data Table */}
      <div className="table-card">
        {loading ? (
          <div className="loading-state">Loading report data...</div>
        ) : (
          <>
            {/* Orders Report Table */}
            {activeTab === 'orders' && (
              filteredOrders.length === 0 ? (
                <div className="empty-state">
                  <p>No orders found for the selected date range.</p>
                </div>
              ) : (
                <>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Order #</th>
                        <th>Date/Time</th>
                        <th>Beeper</th>
                        <th>Order Type</th>
                        <th>Items</th>
                        <th>Subtotal</th>
                        <th>Discount</th>
                        <th>Total</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedOrders.map((order) => (
                        <tr key={order.transaction_id || order.order_id}>
                          <td className="order-id">ORD-{String(order.transaction_id || order.order_id).padStart(6, '0')}</td>
                          <td>{formatDateTime(order.created_at)}</td>
                          <td><span className="beeper-badge">{order.beeper_number || '-'}</span></td>
                          <td><span className={`type-badge ${order.order_type}`}>{order.order_type || '-'}</span></td>
                          <td>{order.item_count || order.items?.length || '-'}</td>
                          <td>{formatCurrency(order.subtotal)}</td>
                          <td className="discount-cell">{order.discount_amount > 0 ? `-${formatCurrency(order.discount_amount)}` : '-'}</td>
                          <td className="total-cell">{formatCurrency(order.total_amount)}</td>
                          <td>
                            <span className={`status-badge ${order.status || 'completed'}`}>
                              {order.status || 'Completed'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {ordersTotalPages > 1 && (
                    <div className="pagination-container">
                      <span className="pagination-info">
                        Showing {ordersStartIndex + 1}-{Math.min(ordersEndIndex, filteredOrders.length)} of {filteredOrders.length}
                      </span>
                      <button className="pagination-btn" onClick={() => setOrdersPage(1)} disabled={ordersPage === 1}>«</button>
                      <button className="pagination-btn" onClick={() => setOrdersPage(ordersPage - 1)} disabled={ordersPage === 1}>‹</button>
                      {getPageNumbers(ordersPage, ordersTotalPages).map((page, idx) => (
                        page === '...' ? (
                          <span key={`ellipsis-${idx}`} className="pagination-ellipsis">...</span>
                        ) : (
                          <button key={page} className={ordersPage === page ? 'pagination-btn active' : 'pagination-btn'} onClick={() => setOrdersPage(page)}>{page}</button>
                        )
                      ))}
                      <button className="pagination-btn" onClick={() => setOrdersPage(ordersPage + 1)} disabled={ordersPage === ordersTotalPages}>›</button>
                      <button className="pagination-btn" onClick={() => setOrdersPage(ordersTotalPages)} disabled={ordersPage === ordersTotalPages}>»</button>
                    </div>
                  )}
                </>
              )
            )}

            {/* Sales Report Table */}
            {activeTab === 'sales' && (
              salesDetails.length === 0 ? (
                <div className="empty-state">
                  <p>No sales data found for the selected date range.</p>
                </div>
              ) : (
                <>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Transactions</th>
                        <th>Gross Sales</th>
                        <th>Discounts</th>
                        <th>Net Sales</th>
                        <th>Avg Order</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedSales.map((row, idx) => (
                        <tr key={idx}>
                          <td>{formatDate(row.date)}</td>
                          <td>{row.transaction_count || 0}</td>
                          <td>{formatCurrency(row.gross_sales)}</td>
                          <td className="discount-cell">{row.total_discounts > 0 ? `-${formatCurrency(row.total_discounts)}` : '-'}</td>
                          <td className="total-cell">{formatCurrency(row.net_sales)}</td>
                          <td>{formatCurrency(row.avg_order_value)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {salesTotalPages > 1 && (
                    <div className="pagination-container">
                      <span className="pagination-info">
                        Showing {salesStartIndex + 1}-{Math.min(salesEndIndex, salesDetails.length)} of {salesDetails.length}
                      </span>
                      <button className="pagination-btn" onClick={() => setSalesPage(1)} disabled={salesPage === 1}>«</button>
                      <button className="pagination-btn" onClick={() => setSalesPage(salesPage - 1)} disabled={salesPage === 1}>‹</button>
                      {getPageNumbers(salesPage, salesTotalPages).map((page, idx) => (
                        page === '...' ? (
                          <span key={`ellipsis-${idx}`} className="pagination-ellipsis">...</span>
                        ) : (
                          <button key={page} className={salesPage === page ? 'pagination-btn active' : 'pagination-btn'} onClick={() => setSalesPage(page)}>{page}</button>
                        )
                      ))}
                      <button className="pagination-btn" onClick={() => setSalesPage(salesPage + 1)} disabled={salesPage === salesTotalPages}>›</button>
                      <button className="pagination-btn" onClick={() => setSalesPage(salesTotalPages)} disabled={salesPage === salesTotalPages}>»</button>
                    </div>
                  )}
                </>
              )
            )}

            {/* Library Report Table */}
            {activeTab === 'library' && (
              filteredLibrary.length === 0 ? (
                <div className="empty-state">
                  <p>No StudyHall sessions found for the selected date range.</p>
                </div>
              ) : (
                <>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Session #</th>
                        <th>Date</th>
                        <th>Table / Seat</th>
                        <th>Customer</th>
                        <th>Start Time</th>
                        <th>End Time</th>
                        <th>Duration</th>
                        <th>Amount Paid</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedLibrary.map((session) => (
                        <tr key={session.session_id}>
                          <td className="session-id">LIB-{String(session.session_id).padStart(6, '0')}</td>
                          <td>{formatDate(session.start_time)}</td>
                          <td><span className="table-badge">Table {session.table_number || '-'} - Seat {session.seat_number || session.seat_id}</span></td>
                          <td>{session.customer_name || '-'}</td>
                          <td>{new Date(session.start_time).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' })}</td>
                          <td>{session.end_time ? new Date(session.end_time).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' }) : '-'}</td>
                          <td>{session.total_minutes ? `${Math.floor(session.total_minutes / 60)}h ${session.total_minutes % 60}m` : '-'}</td>
                          <td className="total-cell">{formatCurrency(session.amount_paid)}</td>
                          <td>
                            <span className={`status-badge ${session.status}`}>
                              {session.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {libraryTotalPages > 1 && (
                    <div className="pagination-container">
                      <span className="pagination-info">
                        Showing {libraryStartIndex + 1}-{Math.min(libraryEndIndex, filteredLibrary.length)} of {filteredLibrary.length}
                      </span>
                      <button className="pagination-btn" onClick={() => setLibraryPage(1)} disabled={libraryPage === 1}>«</button>
                      <button className="pagination-btn" onClick={() => setLibraryPage(libraryPage - 1)} disabled={libraryPage === 1}>‹</button>
                      {getPageNumbers(libraryPage, libraryTotalPages).map((page, idx) => (
                        page === '...' ? (
                          <span key={`ellipsis-${idx}`} className="pagination-ellipsis">...</span>
                        ) : (
                          <button key={page} className={libraryPage === page ? 'pagination-btn active' : 'pagination-btn'} onClick={() => setLibraryPage(page)}>{page}</button>
                        )
                      ))}
                      <button className="pagination-btn" onClick={() => setLibraryPage(libraryPage + 1)} disabled={libraryPage === libraryTotalPages}>›</button>
                      <button className="pagination-btn" onClick={() => setLibraryPage(libraryTotalPages)} disabled={libraryPage === libraryTotalPages}>»</button>
                    </div>
                  )}
                </>
              )
            )}

            {/* Audit Report Table */}
            {activeTab === 'audit' && (
              filteredAudit.length === 0 ? (
                <div className="empty-state">
                  <p>No audit events found for the selected filters.</p>
                </div>
              ) : (
                <>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Log ID</th>
                        <th>Date/Time</th>
                        <th>Action</th>
                        <th>Actor</th>
                        <th>Affected Staff</th>
                        <th>Target</th>
                        <th>Details</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedAudit.map((log, idx) => {
                        const logDisplayId = filteredAudit.length - (auditStartIndex + idx);

                        return (
                        <tr key={log.audit_id}>
                          <td className="audit-id-cell">{logDisplayId}</td>
                          <td>{formatDateTime(log.created_at)}</td>
                          <td>
                            <span className={`status-badge audit-action-badge ${getAuditActionBadgeClass(log.action)}`}>
                              {formatAuditAction(log.action)}
                            </span>
                          </td>
                          <td>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                              <strong>{log.actor_full_name || 'System'}</strong>
                              <span style={{ fontSize: '12px', color: '#777' }}>
                                {log.actor_username ? `@${log.actor_username}` : 'unknown'}
                              </span>
                            </div>
                          </td>
                          <td>{getAuditAffectedStaffLabel(log)}</td>
                          <td>
                            {log.target_type
                              ? `${log.target_type}${log.target_id ? ` #${log.target_id}` : ''}`
                              : '-'}
                          </td>
                          <td style={{ maxWidth: '320px' }}>{formatAuditDetails(log.details_json)}</td>
                        </tr>
                      );})}
                    </tbody>
                  </table>
                  {auditTotalPages > 1 && (
                    <div className="pagination-container">
                      <span className="pagination-info">
                        Showing {auditStartIndex + 1}-{Math.min(auditEndIndex, filteredAudit.length)} of {filteredAudit.length}
                      </span>
                      <button className="pagination-btn" onClick={() => setAuditPage(1)} disabled={auditPage === 1}>«</button>
                      <button className="pagination-btn" onClick={() => setAuditPage(auditPage - 1)} disabled={auditPage === 1}>‹</button>
                      {getPageNumbers(auditPage, auditTotalPages).map((page, idx) => (
                        page === '...' ? (
                          <span key={`ellipsis-${idx}`} className="pagination-ellipsis">...</span>
                        ) : (
                          <button key={page} className={auditPage === page ? 'pagination-btn active' : 'pagination-btn'} onClick={() => setAuditPage(page)}>{page}</button>
                        )
                      ))}
                      <button className="pagination-btn" onClick={() => setAuditPage(auditPage + 1)} disabled={auditPage === auditTotalPages}>›</button>
                      <button className="pagination-btn" onClick={() => setAuditPage(auditTotalPages)} disabled={auditPage === auditTotalPages}>»</button>
                    </div>
                  )}
                </>
              )
            )}
          </>
        )}
      </div>

      {/* Toast Notification */}
      <Toast toast={toast} onClose={() => setToast({ show: false, message: '', type: 'info' })} />
    </div>
  );
}
