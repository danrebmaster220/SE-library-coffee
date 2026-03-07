import { useState, useEffect } from 'react';
import api from '../api';
import { printCustomerReceipt } from '../services/webPrinter';
import '../styles/settings.css';

export default function Config() {
  const [showPasswordPanel, setShowPasswordPanel] = useState(false);
  const [printers, setPrinters] = useState([]);
  const [printerConfig, setPrinterConfig] = useState({ printerName: '' });
  const [testResult, setTestResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileMessage, setProfileMessage] = useState(null);
  const [passwordMessage, setPasswordMessage] = useState(null);
  const [profileData, setProfileData] = useState({
    fullName: '',
    username: '',
    role: ''
  });
  const [passwords, setPasswords] = useState({
    oldPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  useEffect(() => {
    const loadData = async () => {
      try {
        const [configRes, printersRes, profileRes] = await Promise.all([
          api.get('/printer/config'),
          api.get('/printer/list'),
          api.get('/users/me/profile')
        ]);
        setPrinterConfig(configRes.data);
        setPrinters(printersRes.data.printers || []);
        setProfileData({
          fullName: profileRes.data.full_name || '',
          username: profileRes.data.username || '',
          role: profileRes.data.role_name || ''
        });
      } catch (err) {
        console.error('Error loading config:', err);
      }
    };
    loadData();
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

  const handleProfileUpdate = async () => {
    if (!profileData.fullName.trim()) {
      setProfileMessage({ success: false, message: 'Full name is required' });
      return;
    }
    
    setProfileLoading(true);
    setProfileMessage(null);
    try {
      await api.put('/users/me/profile', { full_name: profileData.fullName });
      
      // Update localStorage with new full name
      const storedUser = localStorage.getItem('user');
      if (storedUser) {
        const userData = JSON.parse(storedUser);
        userData.fullName = profileData.fullName;
        localStorage.setItem('user', JSON.stringify(userData));
        // Dispatch custom event to notify Sidebar
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
              <li><strong>Library Receipts</strong> - Print check-in/checkout receipts for library sessions</li>
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
          <div className="settings-form-group">
            <label>Full Name</label>
            <input 
              type="text" 
              value={profileData.fullName}
              onChange={(e) => setProfileData({...profileData, fullName: e.target.value})}
              placeholder="Enter your full name"
            />
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