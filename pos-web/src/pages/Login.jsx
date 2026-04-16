import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import '../styles/login.css';
import logoImg from '../assets/logo.png';

const parseScheduleDateValue = (value) => {
  if (!value) return null;

  const raw = String(value).trim();
  if (!raw) return null;

  // Treat schedule strings as PH wall-clock values, even when they arrive as ISO-like (e.g. ...Z).
  const strippedTimezone = raw
    .replace(/Z$/i, '')
    .replace(/([+-]\d{2}:\d{2})$/, '');
  const normalizedWallClock = strippedTimezone.includes('T')
    ? strippedTimezone
    : strippedTimezone.replace(' ', 'T');

  const manilaDate = new Date(`${normalizedWallClock}+08:00`);
  if (!Number.isNaN(manilaDate.getTime())) return manilaDate;

  const fallbackDate = new Date(raw);
  if (!Number.isNaN(fallbackDate.getTime())) return fallbackDate;

  return null;
};

const formatNoticeDateTime = (value, timezone = 'Asia/Manila') => {
  const dt = parseScheduleDateValue(value);
  if (!dt) return '-';

  return new Intl.DateTimeFormat('en-PH', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    timeZone: timezone || 'Asia/Manila'
  }).format(dt);
};

const toMoney = (value) => {
  const parsed = Number(value);
  return Number.isNaN(parsed)
    ? '0.00'
    : parsed.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const getNoticeScope = (schedule) => {
  if (!schedule || schedule.price_scope === 'base') return 'Base price';
  const size = schedule.size_option_name ? `Size: ${schedule.size_option_name}` : 'Size: Any';
  const temp = schedule.temp_option_name ? `Temp: ${schedule.temp_option_name}` : 'Temp: Any';
  return `${size} | ${temp}`;
};

export default function Login() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    username: '',
    password: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPriceNoticeModal, setShowPriceNoticeModal] = useState(false);
  const [priceNoticeData, setPriceNoticeData] = useState(null);

  // Auto-redirect if already logged in
  useEffect(() => {
    const token = localStorage.getItem('token');
    const storedUser = localStorage.getItem('user');
    if (token && storedUser) {
      try {
        const userData = JSON.parse(storedUser);
        if (userData?.mustChangePassword) {
          navigate('/force-password-change', { replace: true });
          return;
        }

        const role = userData.role?.toLowerCase() || 'cashier';
        if (role === 'admin') {
          navigate('/dashboard', { replace: true });
        } else {
          navigate('/pos', { replace: true });
        }
      } catch {
        // Invalid stored data, clear it
        localStorage.removeItem('token');
        localStorage.removeItem('user');
      }
    }
  }, [navigate]);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await api.post('/auth/login', formData);
      
      // Backend returns { token, user } on success
      if (response.data.token) {
        const mustChangePassword = Boolean(response.data?.user?.mustChangePassword);

        // Store user data and token
        localStorage.setItem('token', response.data.token);
        localStorage.setItem('user', JSON.stringify({
          ...response.data.user,
          mustChangePassword
        }));

        if (mustChangePassword) {
          navigate('/force-password-change', { replace: true });
          return;
        }
        
        // Navigate based on user role
        const userRole = response.data.user.role?.toLowerCase() || 'cashier';
        if (userRole === 'admin') {
          navigate('/dashboard');
        } else {
          try {
            const noticeRes = await api.get('/menu/price-update-notices?windowHours=24&maxItems=12');
            const notice = noticeRes?.data;

            if (notice?.has_notice) {
              setPriceNoticeData(notice);
              setShowPriceNoticeModal(true);
            } else {
              navigate('/pos');
            }
          } catch {
            navigate('/pos');
          }
        }
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-container">
        <div className="logo-container">
          <img src={logoImg} alt="The Library Coffee" />
        </div>

        <h1>Welcome Back</h1>
        <p className="subtitle">Enter your credentials.</p>

        <form onSubmit={handleSubmit} className="login-form">
          <div className="input-group">
            <input
              type="text"
              name="username"
              placeholder="Username"
              value={formData.username}
              onChange={handleChange}
              required
              autoComplete="username"
            />
          </div>

          <div className="input-group">
            <input
              type="password"
              name="password"
              placeholder="Password"
              value={formData.password}
              onChange={handleChange}
              required
              autoComplete="current-password"
            />
          </div>

          {error && (
            <div className="error-message">
              {error}
            </div>
          )}

          <button 
            type="submit" 
            className="login-button"
            disabled={loading}
          >
            {loading ? 'Logging in...' : 'LOG IN'}
          </button>
        </form>
      </div>

      {showPriceNoticeModal && (
        <div className="price-notice-overlay" role="dialog" aria-modal="true" aria-label="Price update notice">
          <div className="price-notice-modal">
            <h2>Price Update Notice</h2>
            <p className="price-notice-subtitle">
              There are pending price updates effective today and within the next 24 hours (PH time).
            </p>

            <div className="price-notice-summary">
              <span>Effective today: <strong>{Number(priceNoticeData?.effective_today_count || 0)}</strong></span>
              <span>Next 24h: <strong>{Number(priceNoticeData?.upcoming_24h_count || 0)}</strong></span>
            </div>

            <div className="price-notice-list">
              {(priceNoticeData?.schedules || []).map((row) => (
                <div key={row.schedule_id} className="price-notice-item">
                  <div className="price-notice-item-head">
                    <strong>{row.item_name}</strong>
                    <span>{getNoticeScope(row)}</span>
                  </div>
                  <div className="price-notice-item-body">
                    ₱{toMoney(row.current_price)} → ₱{toMoney(row.scheduled_price)}
                  </div>
                  <div className="price-notice-item-time">
                    Effective: {formatNoticeDateTime(row.effective_at, row.timezone || 'Asia/Manila')}
                  </div>
                </div>
              ))}
            </div>

            <div className="price-notice-actions">
              <button
                type="button"
                className="login-button"
                onClick={() => {
                  setShowPriceNoticeModal(false);
                  navigate('/pos');
                }}
              >
                Continue to POS
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}