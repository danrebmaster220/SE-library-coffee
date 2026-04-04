import { useState, useEffect, useRef } from 'react';
import api from '../api';
import { printCustomerReceipt } from '../services/webPrinter';
import '../styles/settings.css';
import '../styles/menu.css';

export default function Config() {
  const [showPasswordPanel, setShowPasswordPanel] = useState(false);
  const [printers, setPrinters] = useState([]);
  const [printerConfig, setPrinterConfig] = useState({ printerName: '' });
  const [testResult, setTestResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileMessage, setProfileMessage] = useState(null);
  const [passwordMessage, setPasswordMessage] = useState(null);
  const profileFileRef = useRef(null);
  const [profileData, setProfileData] = useState({
    firstName: '',
    middleName: '',
    lastName: '',
    username: '',
    role: '',
    profileImage: null
  });
  const [passwords, setPasswords] = useState({
    oldPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  useEffect(() => {
    const loadPrinters = async () => {
      try {
        const [configRes, printersRes] = await Promise.all([
          api.get('/printer/config'),
          api.get('/printer/list')
        ]);
        setPrinterConfig(configRes.data);
        setPrinters(printersRes.data.printers || []);
      } catch (err) {
        console.error('Error loading printer config:', err);
      }
    };
    loadPrinters();
  }, []);

  useEffect(() => {
    const readStoredUser = () => {
      try {
        const raw = localStorage.getItem('user');
        return raw ? JSON.parse(raw) : null;
      } catch {
        return null;
      }
    };

    const loadProfile = async () => {
      const stored = readStoredUser();
      try {
        const profileRes = await api.get('/users/me/profile');
        const d = profileRes.data;
        setProfileData({
          firstName: d.first_name || '',
          middleName: d.middle_name || '',
          lastName: d.last_name || '',
          username: d.username || stored?.username || '',
          role: d.role_name || d.role || stored?.role || '',
          profileImage: d.profile_image ?? stored?.profileImage ?? null
        });
      } catch (err) {
        console.error('Error loading profile:', err);
        if (stored) {
          setProfileData((prev) => ({
            ...prev,
            username: stored.username || prev.username,
            role: stored.role || prev.role,
            profileImage: stored.profileImage ?? prev.profileImage
          }));
        }
      }
    };
    loadProfile();
  }, []);

  const refreshPrinters = async () => {
    try {
      const response = await api.get('/printer/list');
      setPrinters(response.data.printers || []);
    } catch (err) {
      console.error('Error fetching printers:', err);
    }
  };

  const handlePrinterChange = async (printerName) => {
    try {
      await api.put('/printer/config', { printerName });
      setPrinterConfig({ ...printerConfig, printerName });
      setTestResult({ success: true, message: 'Printer configuration saved!' });
    } catch (err) {
      console.error('Printer config error:', err);
      setTestResult({ success: false, error: 'Failed to save printer configuration' });
    }
  };

  const handleTestPrint = async () => {
    setLoading(true);
    setTestResult(null);
    try {
      // Try local print server first (localhost:9100)
      try {
        const res = await fetch('http://localhost:9100/test', { 
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: '{}',
          signal: AbortSignal.timeout(5000)
        });
        const json = await res.json();
        if (json.success) {
          setTestResult({ success: true, message: 'Test receipt printed on POS-58!' });
          setLoading(false);
          return;
        }
      } catch {
        // Print server not running — fall back to web preview
        console.log('Local print server not available, using web preview');
      }

      // Fallback: Web-based test print preview
      const testData = {
        transaction_id: 999,
        beeper_number: 1,
        order_type: 'dine-in',
        subtotal: 150.00,
        discount_amount: 0,
        total_amount: 150.00,
        cash_tendered: 200.00,
        change_due: 50.00,
        created_at: new Date().toISOString(),
        cashier_name: 'Test Cashier',
        items: [
          { name: 'Americano (Hot)', quantity: 1, unit_price: 75.00, total_price: 75.00, customizations: [] },
          { name: 'Cafe Latte (Iced)', quantity: 1, unit_price: 75.00, total_price: 75.00, customizations: [] }
        ]
      };
      await printCustomerReceipt(testData);
      setTestResult({ success: true, message: 'Test receipt generated! Click Print in the dialog.' });
    } catch (err) {
      setTestResult({ success: false, error: err.message || 'Test print failed' });
    }
    setLoading(false);
  };

  const handleProfileImageChange = (e) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = () => {
      setProfileData((prev) => ({ ...prev, profileImage: reader.result }));
    };
    reader.readAsDataURL(file);
  };

  const handleProfileUpdate = async () => {
    if (!profileData.firstName.trim() || !profileData.lastName.trim()) {
      setProfileMessage({ success: false, message: 'First name and last name are required' });
      return;
    }

    setProfileLoading(true);
    setProfileMessage(null);
    try {
      await api.put('/users/me/profile', {
        first_name: profileData.firstName.trim(),
        middle_name: profileData.middleName.trim() || '',
        last_name: profileData.lastName.trim(),
        profile_image: profileData.profileImage
      });

      const display = [profileData.firstName, profileData.middleName, profileData.lastName]
        .map((s) => (s && String(s).trim()) || '')
        .filter(Boolean)
        .join(' ');

      const storedUser = localStorage.getItem('user');
      if (storedUser) {
        const userData = JSON.parse(storedUser);
        userData.fullName = display;
        userData.profileImage = profileData.profileImage || null;
        localStorage.setItem('user', JSON.stringify(userData));
        window.dispatchEvent(new Event('userUpdated'));
      }
      
      setProfileMessage({ success: true, message: 'Profile updated successfully!' });
    } catch (err) {
      setProfileMessage({ 
        success: false, 
        message: err.response?.data?.error || 'Failed to update profile' 
      });
    }
    setProfileLoading(false);
  };

  const handlePasswordChange = async () => {
    setPasswordMessage(null);
    
    if (!passwords.oldPassword || !passwords.newPassword || !passwords.confirmPassword) {
      setPasswordMessage({ success: false, message: 'All fields are required' });
      return;
    }
    
    if (passwords.newPassword !== passwords.confirmPassword) {
      setPasswordMessage({ success: false, message: 'New passwords do not match!' });
      return;
    }
    
    if (passwords.newPassword.length < 6) {
      setPasswordMessage({ success: false, message: 'New password must be at least 6 characters' });
      return;
    }
    
    try {
      await api.put('/users/me/password', {
        current_password: passwords.oldPassword,
        new_password: passwords.newPassword
      });
      setPasswordMessage({ success: true, message: 'Password changed successfully!' });
      setTimeout(() => {
        setShowPasswordPanel(false);
        setPasswords({ oldPassword: '', newPassword: '', confirmPassword: '' });
        setPasswordMessage(null);
      }, 1500);
    } catch (err) {
      setPasswordMessage({ 
        success: false, 
        message: err.response?.data?.error || 'Failed to change password' 
      });
    }
  };

  return (
    <div className="main-content settings-container">
      <div className="page-header">
        <h1 className="page-title">System Configuration</h1>
        <p className="page-subtitle">Manage system settings</p>
      </div>

      {/* Printer Configuration Card */}
      <div className="settings-card">
        <div className="settings-card-header">
          <span className="icon">🖨️</span>
          <h2>Printer Configuration</h2>
        </div>
        <div className="settings-card-body">
          {/* Info Box explaining the purpose */}
          <div className="settings-info-box">
            <h4>ℹ️ What is this for?</h4>
            <p>The printer configuration allows you to connect your <strong>thermal receipt printer</strong> to the POS system. This enables:</p>
            <ul>
              <li><strong>Customer Receipts</strong> - Print transaction receipts for customers</li>
              <li><strong>Barista/Kitchen Tickets</strong> - Print order tickets for staff preparation</li>
              <li><strong>StudyHall Receipts</strong> - Print check-in/checkout receipts for StudyHall sessions</li>
            </ul>
            <p>Select your printer from the dropdown and click "Test Print" to verify the connection.</p>
          </div>

          <div className="settings-form-grid">
            <div className="settings-form-group">
              <label>Printer Model</label>
              <input type="text" value="JK-5802H (58mm Thermal)" readOnly />
            </div>
            <div className="settings-form-group">
              <label>Interface</label>
              <input type="text" value="USB + Bluetooth" readOnly />
            </div>
          </div>

          <div className="settings-form-group">
            <label>Select Printer</label>
            <select 
              value={printerConfig.printerName}
              onChange={(e) => handlePrinterChange(e.target.value)}
            >
              <option value="">-- Select Printer --</option>
              {printers.map((printer, idx) => (
                <option key={idx} value={printer.Name}>
                  {printer.Name} {printer.PortName ? `(${printer.PortName})` : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="settings-actions">
            <button 
              className="settings-btn settings-btn-primary"
              onClick={handleTestPrint}
              disabled={loading}
            >
              {loading ? '⏳ Printing...' : '🖨️ Test Print'}
            </button>
            <button 
              className="settings-btn settings-btn-secondary"
              onClick={refreshPrinters}
            >
              🔄 Refresh Printers
            </button>
          </div>

          {testResult && (
            <div className={`settings-status ${testResult.success ? 'success' : 'error'}`}>
              <span className="icon">{testResult.success ? '✅' : '❌'}</span>
              {testResult.success 
                ? (testResult.message || 'Test print sent successfully!')
                : `Error: ${testResult.error}`
              }
            </div>
          )}
        </div>
      </div>

      {/* Personal Information Card */}
      <div className="settings-card">
        <div className="settings-card-header">
          <span className="icon">👤</span>
          <h2>Personal Information</h2>
        </div>
        <div className="settings-card-body">
          <div className="settings-form-grid">
            <div className="settings-form-group">
              <label>Username</label>
              <input 
                type="text" 
                value={profileData.username}
                readOnly
                style={{ backgroundColor: '#f5f5f5', cursor: 'not-allowed' }}
              />
            </div>
            <div className="settings-form-group">
              <label>Role</label>
              <input 
                type="text" 
                value={profileData.role}
                readOnly
                style={{ backgroundColor: '#f5f5f5', cursor: 'not-allowed' }}
              />
            </div>
          </div>
          <div className="settings-form-grid" style={{ marginBottom: '12px' }}>
            <div className="settings-form-group">
              <label>First name</label>
              <input
                type="text"
                value={profileData.firstName}
                onChange={(e) => setProfileData({ ...profileData, firstName: e.target.value })}
                placeholder="First name"
              />
            </div>
            <div className="settings-form-group">
              <label>Middle name (optional)</label>
              <input
                type="text"
                value={profileData.middleName}
                onChange={(e) => setProfileData({ ...profileData, middleName: e.target.value })}
                placeholder="Middle name"
              />
            </div>
          </div>
          <div className="settings-form-group">
            <label>Last name</label>
            <input
              type="text"
              value={profileData.lastName}
              onChange={(e) => setProfileData({ ...profileData, lastName: e.target.value })}
              placeholder="Last name"
            />
          </div>
          <div className="settings-form-group">
            <label>Profile photo (optional)</label>
            <div className="image-upload-box">
              <input
                type="file"
                ref={profileFileRef}
                accept="image/*"
                onChange={handleProfileImageChange}
                className="file-input-hidden"
                id="profile-image-upload"
              />
              {profileData.profileImage ? (
                <div className="image-preview-box">
                  <img src={profileData.profileImage} alt="Profile" />
                  <button
                    type="button"
                    className="change-image-btn"
                    onClick={() => profileFileRef.current?.click()}
                  >
                    Change Image
                  </button>
                  <button
                    type="button"
                    className="remove-image-btn"
                    onClick={() => {
                      setProfileData((p) => ({ ...p, profileImage: null }));
                      if (profileFileRef.current) profileFileRef.current.value = '';
                    }}
                  >
                    ×
                  </button>
                </div>
              ) : (
                <label htmlFor="profile-image-upload" className="upload-placeholder">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                    <polyline points="17 8 12 3 7 8"></polyline>
                    <line x1="12" y1="3" x2="12" y2="15"></line>
                  </svg>
                  <span>Choose Image</span>
                </label>
              )}
            </div>
          </div>
          <div className="settings-actions">
            <button 
              className="settings-btn settings-btn-primary"
              onClick={handleProfileUpdate}
              disabled={profileLoading}
            >
              {profileLoading ? '⏳ Saving...' : '💾 Update Profile'}
            </button>
          </div>

          {profileMessage && (
            <div className={`settings-status ${profileMessage.success ? 'success' : 'error'}`}>
              <span className="icon">{profileMessage.success ? '✅' : '❌'}</span>
              {profileMessage.message}
            </div>
          )}

          <div className="settings-divider"></div>

          {/* Account Security Section */}
          <h3 style={{ 
            fontFamily: "'Playfair Display', serif",
            fontSize: '16px',
            color: 'var(--coffee-dark)',
            marginBottom: '16px'
          }}>
            🔐 Account Security
          </h3>
          
          <div className="settings-form-group">
            <label>Current Password</label>
            <div className="password-change-row">
              <input type="password" value="********" readOnly />
              <button 
                className="settings-btn settings-btn-secondary"
                onClick={() => setShowPasswordPanel(true)}
              >
                Change Password
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Password Change Side Panel */}
      {showPasswordPanel && (
        <>
          <div 
            className="settings-panel-overlay" 
            onClick={() => setShowPasswordPanel(false)}
          />
          <div className="settings-side-panel">
            <h2>Change Password</h2>
            <p className="subtitle">Secure your account with a new password</p>
            
            <div className="settings-form-group">
              <label>Current Password</label>
              <input 
                type="password" 
                placeholder="Enter current password"
                value={passwords.oldPassword}
                onChange={(e) => setPasswords({...passwords, oldPassword: e.target.value})}
              />
            </div>
            <div className="settings-form-group">
              <label>New Password</label>
              <input 
                type="password" 
                placeholder="Enter new password (min 6 characters)"
                value={passwords.newPassword}
                onChange={(e) => setPasswords({...passwords, newPassword: e.target.value})}
              />
            </div>
            <div className="settings-form-group">
              <label>Confirm New Password</label>
              <input 
                type="password" 
                placeholder="Confirm new password"
                value={passwords.confirmPassword}
                onChange={(e) => setPasswords({...passwords, confirmPassword: e.target.value})}
              />
            </div>

            {passwordMessage && (
              <div className={`settings-status ${passwordMessage.success ? 'success' : 'error'}`}>
                <span className="icon">{passwordMessage.success ? '✅' : '❌'}</span>
                {passwordMessage.message}
              </div>
            )}
            
            <div className="settings-panel-actions">
              <button 
                className="settings-btn settings-btn-primary"
                onClick={handlePasswordChange}
              >
                💾 Save Password
              </button>
              <button 
                className="settings-btn settings-btn-secondary"
                onClick={() => {
                  setShowPasswordPanel(false);
                  setPasswords({ oldPassword: '', newPassword: '', confirmPassword: '' });
                  setPasswordMessage(null);
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}