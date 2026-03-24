import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
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
    monthly: [],
    yearly: []
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
          monthly: salesChartRes.data.monthly || [],
          yearly: salesChartRes.data.yearly || []
        });

        // Set category sales with distinct colors for better visibility
        const categoryColors = {
          'Coffee': '#6F4E37',      // Coffee brown
          'Non-Coffee': '#2E8B57',  // Sea green (teal)
          'Food': '#E67E22',        // Carrot orange
          'Library': '#3498DB'      // Bright blue
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
      case 'yearly':
        return { data: chartData.yearly, labelKey: 'month' };
      default:
        return { data: chartData.weekly, labelKey: 'day' };
    }
  };

  const { data: currentChartData, labelKey } = getChartData();

  // Format currency for tooltip
  const formatCurrency = (value) => `₱${Number(value).toLocaleString()}`;

  // Calculate total for donut chart percentages
  const totalCategorySales = categorySales.reduce((sum, cat) => sum + cat.sales, 0);

  // Generate donut chart segments
  const generateDonutSegments = () => {
    if (totalCategorySales === 0) return [];

    let cumulativePercent = 0;
    const segments = [];

    categorySales.forEach((cat) => {
      const percent = (cat.sales / totalCategorySales) * 100;
      const startAngle = (cumulativePercent / 100) * 360;
      const endAngle = ((cumulativePercent + percent) / 100) * 360;

      // SVG arc calculation
      const radius = 40;
      const innerRadius = 25;
      const centerX = 50;
      const centerY = 50;

      const startAngleRad = (startAngle - 90) * (Math.PI / 180);
      const endAngleRad = (endAngle - 90) * (Math.PI / 180);

      const x1 = centerX + radius * Math.cos(startAngleRad);
      const y1 = centerY + radius * Math.sin(startAngleRad);
      const x2 = centerX + radius * Math.cos(endAngleRad);
      const y2 = centerY + radius * Math.sin(endAngleRad);

      const x3 = centerX + innerRadius * Math.cos(endAngleRad);
      const y3 = centerY + innerRadius * Math.sin(endAngleRad);
      const x4 = centerX + innerRadius * Math.cos(startAngleRad);
      const y4 = centerY + innerRadius * Math.sin(startAngleRad);

      const largeArcFlag = percent > 50 ? 1 : 0;

      const pathData = `
        M ${x1} ${y1}
        A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2}
        L ${x3} ${y3}
        A ${innerRadius} ${innerRadius} 0 ${largeArcFlag} 0 ${x4} ${y4}
        Z
      `;

      segments.push({
        path: pathData,
        color: cat.color,
        name: cat.name,
        percent: percent.toFixed(1),
        sales: cat.sales
      });

      cumulativePercent += percent;
    });

    return segments;
  };

  const donutSegments = generateDonutSegments();

  // APK download URL from latest EAS build
  const APK_DOWNLOAD_URL = 'https://expo.dev/artifacts/eas/cXNTUr9k3YKVksTzZNAqYK.apk';

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
                  tick={{ fontSize: 11, fill: '#999' }}
                  axisLine={{ stroke: '#eee' }}
                  tickLine={false}
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
          <h3>Sales by Category</h3>

          {/* Donut Chart */}
          <div className="donut-chart-container">
            <div className="donut-chart-wrapper">
              <svg viewBox="0 0 100 100" className="donut-chart-svg">
                {donutSegments.map((segment, index) => (
                  <path
                    key={index}
                    d={segment.path}
                    fill={segment.color}
                    className="donut-segment"
                  />
                ))}
                {/* Center text */}
                <text x="50" y="47" textAnchor="middle" className="donut-center-value">
                  ₱{totalCategorySales.toLocaleString()}
                </text>
                <text x="50" y="56" textAnchor="middle" className="donut-center-label">
                  Total
                </text>
              </svg>
            </div>

            {/* Legend */}
            <div className="donut-legend">
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
