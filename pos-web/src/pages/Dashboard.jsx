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

  // Calculate max for chart scaling with smart rounding
  const rawMaxSales = Math.max(...(currentChartData.map(item => item.sales || 0)), 1);

  // Smart rounding function for nice Y-axis values
  const getNiceMaxValue = (value) => {
    if (value <= 0) return 100;
    if (value <= 100) return Math.ceil(value / 20) * 20;
    if (value <= 500) return Math.ceil(value / 100) * 100;
    if (value <= 1000) return Math.ceil(value / 200) * 200;
    if (value <= 5000) return Math.ceil(value / 1000) * 1000;
    if (value <= 10000) return Math.ceil(value / 2000) * 2000;
    if (value <= 50000) return Math.ceil(value / 10000) * 10000;
    return Math.ceil(value / 20000) * 20000;
  };

  const maxSales = getNiceMaxValue(rawMaxSales);

  // Generate Y-axis labels (5 labels from 0 to max)
  const generateYAxisLabels = () => {
    const labels = [];
    for (let i = 0; i <= 4; i++) {
      const value = (maxSales / 4) * i;
      labels.push(value);
    }
    return labels.reverse(); // Top to bottom
  };

  const yAxisLabels = generateYAxisLabels();

  // Format value for Y-axis display (abbreviated)
  const formatYAxisLabel = (value) => {
    if (value === 0) return 'P0';
    if (value >= 1000) {
      const kValue = value / 1000;
      // Show decimal only if needed (e.g., 1.5K, but not 2.0K)
      return kValue % 1 === 0 ? `P${kValue}K` : `P${kValue.toFixed(1)}K`;
    }
    return `P${value}`;
  };

  // Format X-axis labels based on period
  const formatXAxisLabel = (item) => {
    const label = item[labelKey];

    if (salesPeriod === 'today') {
      // For hourly data, show abbreviated format
      // Convert "8AM" or "8 AM" to just "8A" or "2P"
      const hourMatch = label?.match(/(\d+)\s*(AM|PM)/i);
      if (hourMatch) {
        const hour = hourMatch[1];
        const period = hourMatch[2].toUpperCase();
        return `${hour}${period[0]}`;
      }
      return label;
    }

    if (salesPeriod === 'monthly') {
      // Convert "Week 1" to "W1"
      const weekMatch = label?.match(/Week\s*(\d+)/i);
      if (weekMatch) {
        return `W${weekMatch[1]}`;
      }
      return label?.replace(/Week\s*/i, 'W') || label;
    }

    if (salesPeriod === 'yearly') {
      // Months are already short (Jan, Feb, etc.) - just return first letter on mobile
      // This will be handled via CSS skip-on-mobile class
      return label;
    }

    // Weekly - days are already short (Mon, Tue, etc.)
    return label;
  };

  // Calculate total for donut chart percentages
  const totalCategorySales = categorySales.reduce((sum, cat) => sum + cat.sales, 0);

  // Generate SVG path for line chart
  const generateLinePath = () => {
    if (currentChartData.length === 0) return '';

    const width = 100;
    const height = 100;
    const padding = 5;
    const chartWidth = width - padding * 2;
    const chartHeight = height - padding * 2;

    const points = currentChartData.map((item, index) => {
      const x = padding + (index / (currentChartData.length - 1 || 1)) * chartWidth;
      const y = padding + chartHeight - ((item.sales || 0) / maxSales) * chartHeight;
      return { x, y };
    });

    // Create smooth curve path
    const linePath = points.reduce((path, point, index) => {
      if (index === 0) return `M ${point.x} ${point.y}`;
      return `${path} L ${point.x} ${point.y}`;
    }, '');

    // Create area path (for gradient fill)
    const areaPath = `${linePath} L ${padding + chartWidth} ${padding + chartHeight} L ${padding} ${padding + chartHeight} Z`;

    return { linePath, areaPath, points };
  };

  const { linePath, areaPath, points } = generateLinePath();

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
  const APK_DOWNLOAD_URL = 'https://expo.dev/artifacts/eas/fock8GHw3fbK5d1aiEu5ZV.apk';

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

          {/* Line Chart */}
          <div className="line-chart-container">
            {/* Y-axis labels */}
            <div className="y-axis-labels">
              {yAxisLabels.map((value, index) => (
                <span key={index} className="y-label">{formatYAxisLabel(value)}</span>
              ))}
            </div>

            {/* Chart area */}
            <div className="chart-area">
              <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="line-chart-svg">
                {/* Grid lines */}
                <defs>
                  <linearGradient id="areaGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="var(--caramel)" stopOpacity="0.3" />
                    <stop offset="100%" stopColor="var(--caramel)" stopOpacity="0.05" />
                  </linearGradient>
                </defs>

                {/* Horizontal grid lines */}
                {[0, 25, 50, 75, 100].map((y) => (
                  <line
                    key={y}
                    x1="0"
                    y1={5 + (y / 100) * 90}
                    x2="100"
                    y2={5 + (y / 100) * 90}
                    stroke="#eee"
                    strokeWidth="0.2"
                  />
                ))}

                {/* Area fill */}
                {areaPath && (
                  <path
                    d={areaPath}
                    fill="url(#areaGradient)"
                  />
                )}

                {/* Line */}
                {linePath && (
                  <path
                    d={linePath}
                    fill="none"
                    stroke="var(--caramel)"
                    strokeWidth="0.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                )}

                {/* Data points */}
                {points && points.map((point, index) => (
                  <circle
                    key={index}
                    cx={point.x}
                    cy={point.y}
                    r="0.8"
                    fill="var(--coffee-dark)"
                    stroke="white"
                    strokeWidth="0.2"
                  />
                ))}
              </svg>

              {/* X-axis labels */}
              <div className="line-chart-labels">
                {currentChartData.map((item, index) => (
                  <span
                    key={index}
                    className={`line-label ${(salesPeriod === 'today' || salesPeriod === 'yearly') && currentChartData.length > 8 ? 'skip-on-mobile' : ''}`}
                    data-index={index}
                  >
                    {formatXAxisLabel(item)}
                  </span>
                ))}
              </div>
            </div>
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
