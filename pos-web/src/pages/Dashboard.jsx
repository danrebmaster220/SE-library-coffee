import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';
import '../styles/dashboard.css';

export default function Dashboard() {
  const [salesPeriod, setSalesPeriod] = useState('weekly');
  const [loading, setLoading] = useState(true);
  
  const [stats, setStats] = useState({
    todaySales: 0,
    totalOrders: 0,
    pendingOrders: 0,
    preparingOrders: 0,
    readyOrders: 0,
    customers: 0,
    avgOrderValue: 0
  });

  const [libraryStatus, setLibraryStatus] = useState({
    available: 0,
    occupied: 0,
    total: 0
  });

  const [chartData, setChartData] = useState({
    today: [],
    weekly: [],
    monthly: []
  });

  const [categorySales, setCategorySales] = useState([
    { name: 'Coffee', sales: 0, color: '#8B5A2B' },
    { name: 'Non-Coffee', sales: 0, color: '#D4A574' },
    { name: 'Food', sales: 0, color: '#F5DEB3' },
    { name: 'Library', sales: 0, color: '#DEB887' }
  ]);

  useEffect(() => {
    const loadDashboardData = async () => {
      try {
        setLoading(true);
        
        // Fetch all dashboard data in parallel
        const [statsRes, salesChartRes, categoryRes] = await Promise.all([
          api.get('/dashboard/stats'),
          api.get('/dashboard/sales-chart'),
          api.get('/dashboard/category-sales')
        ]);

        // Set stats
        setStats({
          todaySales: statsRes.data.todaySales || 0,
          totalOrders: statsRes.data.totalOrders || 0,
          pendingOrders: statsRes.data.pendingOrders || 0,
          preparingOrders: statsRes.data.preparingOrders || 0,
          readyOrders: statsRes.data.readyOrders || 0,
          customers: statsRes.data.uniqueCustomers || 0,
          avgOrderValue: statsRes.data.avgOrderValue || 0
        });

        // Set library status
        setLibraryStatus({
          available: statsRes.data.librarySeats?.available || 0,
          occupied: statsRes.data.librarySeats?.occupied || 0,
          total: statsRes.data.librarySeats?.total || 0
        });

        // Set chart data
        setChartData({
          today: salesChartRes.data.today || [],
          weekly: salesChartRes.data.weekly || [],
          monthly: salesChartRes.data.monthly || []
        });

        // Set category sales with colors
        const categoryColors = {
          'Coffee': '#8B5A2B',
          'Non-Coffee': '#D4A574',
          'Food': '#F5DEB3',
          'Library': '#DEB887'
        };
        
        const categories = (categoryRes.data || []).map(cat => ({
          name: cat.category,
          sales: parseFloat(cat.total_sales) || 0,
          color: categoryColors[cat.category] || '#999'
        }));
        
        if (categories.length > 0) {
          setCategorySales(categories);
        }

      } catch (err) {
        console.error('Error loading dashboard:', err);
      } finally {
        setLoading(false);
      }
    };

    loadDashboardData();
    
    // Refresh every 30 seconds
    const interval = setInterval(loadDashboardData, 30000);
    return () => clearInterval(interval);
  }, []);

  // Get current chart data based on selected period
  const getChartData = () => {
    switch (salesPeriod) {
      case 'today':
        return { data: chartData.today, labelKey: 'hour' };
      case 'monthly':
        return { data: chartData.monthly, labelKey: 'week' };
      default:
        return { data: chartData.weekly, labelKey: 'day' };
    }
  };

  const { data: currentChartData, labelKey } = getChartData();
  
  // Calculate max for chart scaling
  const maxSales = Math.max(...(currentChartData.map(item => item.sales || 0)), 1);

  if (loading) {
    return (
      <div className="main-content dashboard-simple">
        <div className="dashboard-header-simple">
          <h1>Dashboard</h1>
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="main-content dashboard-simple">
      <div className="dashboard-header-simple">
        <h1>Dashboard</h1>
        <p>Overview of your business</p>
      </div>

      <div className="stats-row">
        <div className="stat-card">
          <div className="stat-icon sales">P</div>
          <div className="stat-info">
            <span className="stat-label">Today's Sales</span>
            <span className="stat-value">P{stats.todaySales.toLocaleString()}</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon orders">O</div>
          <div className="stat-info">
            <span className="stat-label">Orders Today</span>
            <span className="stat-value">{stats.totalOrders}</span>
            <div className="stat-mini">
              <span className="pending">{stats.pendingOrders} pending</span>
              <span className="preparing">{stats.preparingOrders} preparing</span>
              <span className="ready">{stats.readyOrders} ready</span>
            </div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon library">L</div>
          <div className="stat-info">
            <span className="stat-label">Library</span>
            <span className="stat-value">{libraryStatus.available}/{libraryStatus.total}</span>
            <span className="stat-sub">seats available</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon customers">C</div>
          <div className="stat-info">
            <span className="stat-label">Customers</span>
            <span className="stat-value">{stats.customers}</span>
            <span className="stat-sub">Avg: P{stats.avgOrderValue.toFixed(2)}</span>
          </div>
        </div>
      </div>

      <div className="charts-row">
        <div className="chart-card">
          <div className="chart-header">
            <h3>Sales Overview</h3>
            <div className="period-tabs">
              <button 
                className={`period-btn ${salesPeriod === 'today' ? 'active' : ''}`}
                onClick={() => setSalesPeriod('today')}
              >
                Today
              </button>
              <button 
                className={`period-btn ${salesPeriod === 'weekly' ? 'active' : ''}`}
                onClick={() => setSalesPeriod('weekly')}
              >
                Weekly
              </button>
              <button 
                className={`period-btn ${salesPeriod === 'monthly' ? 'active' : ''}`}
                onClick={() => setSalesPeriod('monthly')}
              >
                Monthly
              </button>
            </div>
          </div>
          <div className="bar-chart-simple">
            {currentChartData.map((item, index) => (
              <div key={index} className="bar-col">
                <div className="bar-fill" style={{ height: item.sales > 0 ? ((item.sales / maxSales) * 100) + '%' : '4px' }}></div>
                <span className="bar-label">{item[labelKey]}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="chart-card">
          <h3>Sales by Category</h3>
          <div className="category-list">
            {categorySales.map((cat, index) => (
              <div key={index} className="category-row">
                <span className="cat-dot" style={{ background: cat.color }}></span>
                <span className="cat-name">{cat.name}</span>
                <span className="cat-value">P{cat.sales.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="quick-actions">
        <h3>Quick Actions</h3>
        <div className="actions-row">
          <Link to="/pos" className="action-btn">New Order</Link>
          <Link to="/library/transactions" className="action-btn">Library</Link>
          <Link to="/orders" className="action-btn">Orders</Link>
          <Link to="/menu" className="action-btn">Menu</Link>
          <Link to="/reports" className="action-btn">Reports</Link>
          <Link to="/config" className="action-btn">Settings</Link>
        </div>
      </div>
    </div>
  );
}
