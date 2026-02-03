import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import '../styles/login.css';

export default function Login() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    username: '',
    password: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

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
        // Store user data and token
        localStorage.setItem('token', response.data.token);
        localStorage.setItem('user', JSON.stringify(response.data.user));
        
        // Navigate based on user role
        const userRole = response.data.user.role?.toLowerCase() || 'cashier';
        if (userRole === 'admin') {
          navigate('/dashboard');
        } else {
          navigate('/pos');
        }
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #f5f0e8 0%, #e8ddd0 100%)'
    }}>
      <div className="login-container">
        <div className="logo-container">
          <div style={{ fontSize: '48px', marginBottom: '10px' }}>☕</div>
          <div className="logo-text">the Library</div>
        </div>

        <h1>Welcome Back</h1>
        <p className="subtitle">Enter your credentials.</p>

        <form onSubmit={handleSubmit}>
          <div className="input-group">
            <input
              type="text"
              name="username"
              placeholder="Username"
              value={formData.username}
              onChange={handleChange}
              required
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
            />
          </div>

          {error && (
            <div style={{
              background: '#fee',
              color: '#c33',
              padding: '10px',
              borderRadius: '6px',
              marginBottom: '15px',
              fontSize: '13px'
            }}>
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
    </div>
  );
}