import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import '../styles/force-password-change.css';

export default function ForcePasswordChange() {
  const navigate = useNavigate();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const rawUser = localStorage.getItem('user');

    if (!token || !rawUser) {
      navigate('/login', { replace: true });
      return;
    }

    try {
      const user = JSON.parse(rawUser);
      if (!user?.mustChangePassword) {
        navigate(user?.role?.toLowerCase() === 'admin' ? '/dashboard' : '/pos', { replace: true });
      }
    } catch {
      localStorage.removeItem('user');
      localStorage.removeItem('token');
      navigate('/login', { replace: true });
    }
  }, [navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    const trimmedCurrent = String(currentPassword || '').trim();
    const trimmedNext = String(newPassword || '').trim();
    const trimmedConfirm = String(confirmPassword || '').trim();

    if (!trimmedCurrent || !trimmedNext || !trimmedConfirm) {
      setError('All fields are required.');
      return;
    }

    if (trimmedNext.length < 6) {
      setError('New password must be at least 6 characters.');
      return;
    }

    if (trimmedNext !== trimmedConfirm) {
      setError('New password and confirm password do not match.');
      return;
    }

    if (trimmedCurrent === trimmedNext) {
      setError('New password must be different from current password.');
      return;
    }

    try {
      setSubmitting(true);
      await api.put('/users/me/password', {
        current_password: trimmedCurrent,
        new_password: trimmedNext
      });

      const rawUser = localStorage.getItem('user');
      if (rawUser) {
        try {
          const user = JSON.parse(rawUser);
          const updated = {
            ...user,
            mustChangePassword: false
          };
          localStorage.setItem('user', JSON.stringify(updated));
        } catch {
          // Ignore malformed local storage user payload.
        }
      }

      setSuccess('Password changed successfully. Redirecting...');

      const role = (() => {
        try {
          return JSON.parse(localStorage.getItem('user') || '{}')?.role?.toLowerCase() || 'cashier';
        } catch {
          return 'cashier';
        }
      })();

      setTimeout(() => {
        navigate(role === 'admin' ? '/dashboard' : '/pos', { replace: true });
      }, 900);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to change password.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="force-password-page">
      <div className="force-password-card">
        <h1>Password Update Required</h1>
        <p>
          For security, you must change your password before using the system.
        </p>

        <form onSubmit={handleSubmit} className="force-password-form">
          <label htmlFor="current-password">Current Password</label>
          <input
            id="current-password"
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            autoComplete="current-password"
            required
          />

          <label htmlFor="new-password">New Password</label>
          <input
            id="new-password"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            autoComplete="new-password"
            minLength={6}
            required
          />

          <label htmlFor="confirm-password">Confirm New Password</label>
          <input
            id="confirm-password"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            autoComplete="new-password"
            minLength={6}
            required
          />

          {error && <div className="force-password-error">{error}</div>}
          {success && <div className="force-password-success">{success}</div>}

          <button type="submit" disabled={submitting}>
            {submitting ? 'Updating...' : 'Update Password'}
          </button>
        </form>
      </div>
    </div>
  );
}
