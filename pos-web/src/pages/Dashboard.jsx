import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import api from '../api';
import '../styles/dashboard.css';

const CATEGORY_COLOR_PALETTE = ['#6F4E37', '#2E8B57', '#E67E22', '#C0392B', '#8E44AD', '#2980B9', '#16A085', '#D35400'];

const getCategoryColor = (name, index) => {
  if (index < CATEGORY_COLOR_PALETTE.length) return CATEGORY_COLOR_PALETTE[index];
  const label = String(name || 'Category');
  let hash = 0;
  for (let i = 0; i < label.length; i += 1) {
    hash = (hash * 31 + label.charCodeAt(i)) >>> 0;
  }
  const hue = hash % 360;
  return `hsl(${hue}, 56%, 44%)`;
};

export default function Dashboard() {
  const getInitialCompactChart = () => {
    if (typeof window === 'undefined') return false;
    return window.innerWidth < 900;
  };

  const [salesPeriod, setSalesPeriod] = useState('weekly');
  const [loading, setLoading] = useState(true);
  const [isCompactChart, setIsCompactChart] = useState(getInitialCompactChart);

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
    monthly: [],
    yearly: []
  });

  const [categorySales, setCategorySales] = useState([]);

  const mapCategoryRows = (rows) =>
    (rows || []).map((cat, index) => {
      const name = cat.category_name || cat.category || cat.name || `Category ${index + 1}`;
      return {
        name,
        sales: parseFloat(cat.total_sales) || 0,
        color: getCategoryColor(name, index)
      };
    });

  useEffect(() => {
    const loadDashboardData = async () => {
      try {
        setLoading(true);

        const [statsRes, salesChartRes] = await Promise.all([
          api.get('/dashboard/stats'),
          api.get('/dashboard/sales-chart')
        ]);

        setStats({
          todaySales: statsRes.data.todaySales || 0,
          totalOrders: statsRes.data.totalOrders || 0,
          pendingOrders: statsRes.data.pendingOrders || 0,
          preparingOrders: statsRes.data.preparingOrders || 0,
          readyOrders: statsRes.data.readyOrders || 0,
          customers: statsRes.data.uniqueCustomers || 0,
          avgOrderValue: statsRes.data.avgOrderValue || 0
        });

        setLibraryStatus({
          available: statsRes.data.librarySeats?.available || 0,
          occupied: statsRes.data.librarySeats?.occupied || 0,
          total: statsRes.data.librarySeats?.total || 0
        });

        setChartData({
          today: salesChartRes.data.today || [],
          weekly: salesChartRes.data.weekly || [],
          monthly: salesChartRes.data.monthly || [],
          yearly: salesChartRes.data.yearly || []
        });
      } catch (err) {
        console.error('Error loading dashboard:', err);
      } finally {
        setLoading(false);
      }
    };

    loadDashboardData();
    const interval = setInterval(loadDashboardData, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const loadCategory = async () => {
      try {
        const categoryRes = await api.get(
          `/dashboard/category-sales?period=${encodeURIComponent(salesPeriod)}`
        );
        setCategorySales(mapCategoryRows(categoryRes.data));
      } catch (err) {
        console.error('Error loading category sales:', err);
      }
    };
    loadCategory();
    const interval = setInterval(loadCategory, 30000);
    return () => clearInterval(interval);
  }, [salesPeriod]);

  useEffect(() => {
    const handleResize = () => {
      setIsCompactChart(window.innerWidth < 900);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Get current chart data based on selected period
  const getChartData = () => {
    switch (salesPeriod) {
      case 'today':
        return { data: chartData.today, labelKey: 'hour' };
      case 'monthly':
        return { data: chartData.monthly, labelKey: 'week' };
      case 'yearly':
        return { data: chartData.yearly, labelKey: 'month' };
      default:
        return { data: chartData.weekly, labelKey: 'day' };
    }
  };

  const { data: currentChartData, labelKey } = getChartData();

  const formatXAxisTick = (value, index) => {
    if (salesPeriod === 'today' && isCompactChart) {
      return index % 2 === 0 || index === currentChartData.length - 1 ? value : '';
    }
    return value;
  };

  // Format currency for tooltip
  const formatCurrency = (value) => `₱${Number(value).toLocaleString()}`;

  // Calculate total for category percentages
  const totalCategorySales = categorySales.reduce((sum, cat) => sum + cat.sales, 0);

  // APK download URL from latest EAS build
  const APK_DOWNLOAD_URL = 'https://expo.dev/artifacts/eas/9JgvhCYoMUukzsvVkEypjx.apk';

  if (loading) {
    return (
      <div className="main-content dashboard-simple">
        <div className="dashboard-header-simple">
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="main-content dashboard-simple">
      <div className="dashboard-header-simple">
        <h1 className="page-title">Dashboard</h1>
        <p className="page-subtitle">Overview of your business</p>
      </div>

      {/* APK Download Banner */}
      <a
        href={APK_DOWNLOAD_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="apk-download-banner"
      >
        <div className="apk-banner-marquee">
          <span className="apk-banner-text">
            📱 Download the Kiosk App (APK) &nbsp;&nbsp;&bull;&nbsp;&nbsp; 📱 Download the Kiosk App (APK) &nbsp;&nbsp;&bull;&nbsp;&nbsp; 📱 Download the Kiosk App (APK) &nbsp;&nbsp;&bull;&nbsp;&nbsp;
          </span>
          <span className="apk-banner-text">
            📱 Download the Kiosk App (APK) &nbsp;&nbsp;&bull;&nbsp;&nbsp; 📱 Download the Kiosk App (APK) &nbsp;&nbsp;&bull;&nbsp;&nbsp; 📱 Download the Kiosk App (APK) &nbsp;&nbsp;&bull;&nbsp;&nbsp;
          </span>
        </div>
      </a>

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
            <span className="stat-label">StudyHall</span>
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
              <button
                className={`period-btn ${salesPeriod === 'yearly' ? 'active' : ''}`}
                onClick={() => setSalesPeriod('yearly')}
              >
                Yearly
              </button>
            </div>
          </div>

          {/* Line Chart with Recharts */}
          <div className="line-chart-container" style={{ width: '100%', height: 280 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={currentChartData} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
                <defs>
                  <linearGradient id="salesGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8B5E3C" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#8B5E3C" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0ece8" vertical={false} />
                <XAxis
                  dataKey={labelKey}
                  tick={{ fontSize: isCompactChart ? 10 : 11, fill: '#999' }}
                  axisLine={{ stroke: '#eee' }}
                  tickLine={false}
                  interval={0}
                  tickMargin={isCompactChart ? 8 : 4}
                  tickFormatter={formatXAxisTick}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: '#999' }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(value) => {
                    if (value === 0) return '₱0';
                    if (value >= 1000) {
                      const k = value / 1000;
                      return k % 1 === 0 ? `₱${k}K` : `₱${k.toFixed(1)}K`;
                    }
                    return `₱${value}`;
                  }}
                />
                <Tooltip
                  formatter={(value) => [formatCurrency(value), 'Sales']}
                  contentStyle={{
                    backgroundColor: '#fff',
                    border: '1px solid #e0d5c9',
                    borderRadius: '10px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                    fontSize: '13px',
                    padding: '10px 14px'
                  }}
                  labelStyle={{ color: '#5d4037', fontWeight: 'bold', marginBottom: '4px' }}
                />
                <Area
                  type="monotone"
                  dataKey="sales"
                  stroke="#8B5E3C"
                  strokeWidth={2.5}
                  fill="url(#salesGradient)"
                  dot={{ r: 3, fill: '#6F4E37', stroke: '#fff', strokeWidth: 2 }}
                  activeDot={{ r: 5, fill: '#5D4037', stroke: '#fff', strokeWidth: 2 }}
                  animationDuration={1200}
                  animationEasing="ease-in-out"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="chart-card">
          <div className="chart-header">
            <h3>Sales by Category</h3>
            <div className="period-tabs">
              <button
                type="button"
                className={`period-btn ${salesPeriod === 'today' ? 'active' : ''}`}
                onClick={() => setSalesPeriod('today')}
              >
                Today
              </button>
              <button
                type="button"
                className={`period-btn ${salesPeriod === 'weekly' ? 'active' : ''}`}
                onClick={() => setSalesPeriod('weekly')}
              >
                Weekly
              </button>
              <button
                type="button"
                className={`period-btn ${salesPeriod === 'monthly' ? 'active' : ''}`}
                onClick={() => setSalesPeriod('monthly')}
              >
                Monthly
              </button>
              <button
                type="button"
                className={`period-btn ${salesPeriod === 'yearly' ? 'active' : ''}`}
                onClick={() => setSalesPeriod('yearly')}
              >
                Yearly
              </button>
            </div>
          </div>

          <div className="category-only-list">
            {categorySales.length === 0 && (
              <div className="legend-empty">No active menu categories found.</div>
            )}
            {categorySales.map((cat, index) => (
              <div key={index} className="legend-item">
                <span className="legend-dot" style={{ background: cat.color }}></span>
                <span className="legend-name">{cat.name}</span>
                <span className="legend-value">₱{cat.sales.toLocaleString()}</span>
                <span className="legend-percent">
                  {totalCategorySales > 0 ? ((cat.sales / totalCategorySales) * 100).toFixed(0) : 0}%
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="quick-actions">
        <h3>Quick Actions</h3>
        <div className="actions-row">
          <Link to="/pos" className="action-btn">New Order</Link>
          <Link to="/library/transactions" className="action-btn">StudyHall</Link>
          <Link to="/orders" className="action-btn">Orders</Link>
          <Link to="/menu" className="action-btn">Menu</Link>
          <Link to="/reports" className="action-btn">Reports</Link>
          <Link to="/config" className="action-btn">Settings</Link>
        </div>
      </div>
    </div>
  );
}
