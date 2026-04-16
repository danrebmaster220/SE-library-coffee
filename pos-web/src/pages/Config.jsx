import { useState, useEffect, useRef } from 'react';
import api from '../api';
import FilterSelectWrap from '../components/FilterSelectWrap';
import { printCustomerReceipt } from '../services/webPrinter';
import '../styles/settings.css';
import '../styles/menu.css';

const toMoney = (value) => {
  const numeric = Number(value);
  if (Number.isNaN(numeric)) return '0.00';
  return numeric.toFixed(2);
};

const formatScheduleDateTime = (value, timezone = 'Asia/Manila') => {
  if (!value) return '-';
  const normalized = String(value).includes('T') ? String(value) : String(value).replace(' ', 'T');
  const dt = new Date(`${normalized}+08:00`);
  if (Number.isNaN(dt.getTime())) return String(value);

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

const getScopeLabel = (schedule) => {
  if (!schedule) return 'BASE';
  if (schedule.price_scope === 'base') return 'BASE';

  const size = schedule.size_option_name ? `Size: ${schedule.size_option_name}` : 'Size: Any';
  const temp = schedule.temp_option_name ? `Temp: ${schedule.temp_option_name}` : 'Temp: Any';
  return `${size} | ${temp}`;
};

export default function Config() {
  const [showPasswordPanel, setShowPasswordPanel] = useState(false);
  const [printers, setPrinters] = useState([]);
  const [printerConfig, setPrinterConfig] = useState({ printerName: '' });
  const [testResult, setTestResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileMessage, setProfileMessage] = useState(null);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [profileSnapshot, setProfileSnapshot] = useState(null);
  const [passwordMessage, setPasswordMessage] = useState(null);
  const [isAdminUser, setIsAdminUser] = useState(false);
  const [priceDelayDays, setPriceDelayDays] = useState('3');
  const [priceDelayLoading, setPriceDelayLoading] = useState(false);
  const [priceDelayMessage, setPriceDelayMessage] = useState(null);
  const [pendingSchedules, setPendingSchedules] = useState([]);
  const [pendingSchedulesLoading, setPendingSchedulesLoading] = useState(false);
  const [pendingSchedulesMessage, setPendingSchedulesMessage] = useState(null);
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
    const stored = (() => {
      try {
        const raw = localStorage.getItem('user');
        return raw ? JSON.parse(raw) : null;
      } catch {
        return null;
      }
    })();

    const roleName = String(stored?.role || '').toLowerCase();
    const roleId = Number(stored?.role_id);
    const admin = roleName === 'admin' || roleId === 1;
    setIsAdminUser(admin);

    if (!admin) return;

    const loadPriceDelaySettings = async () => {
      try {
        const [settingsRes, pendingRes] = await Promise.all([
          api.get('/menu/price-update-settings'),
          api.get('/menu/price-schedules/pending?limit=200')
        ]);

        const delay = settingsRes?.data?.settings?.delay_days;
        if (delay != null) {
          setPriceDelayDays(String(delay));
        }

        setPendingSchedules(Array.isArray(pendingRes?.data?.schedules) ? pendingRes.data.schedules : []);
      } catch (err) {
        console.error('Error loading price update settings:', err);
      }
    };

    loadPriceDelaySettings();
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
        const nextProfileData = {
          firstName: d.first_name || '',
          middleName: d.middle_name || '',
          lastName: d.last_name || '',
          username: d.username || stored?.username || '',
          role: d.role_name || d.role || stored?.role || '',
          profileImage: d.profile_image ?? stored?.profileImage ?? null
        };

        setProfileData(nextProfileData);
        setProfileSnapshot(nextProfileData);
      } catch (err) {
        console.error('Error loading profile:', err);
        if (stored) {
          const fallbackProfileData = {
            firstName: '',
            middleName: '',
            lastName: '',
            username: stored.username || '',
            role: stored.role || '',
            profileImage: stored.profileImage ?? null
          };

          setProfileData(fallbackProfileData);
          setProfileSnapshot(fallbackProfileData);
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
    if (!isEditingProfile) return;

    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = () => {
      setProfileData((prev) => ({ ...prev, profileImage: reader.result }));
    };
    reader.readAsDataURL(file);
  };

  const handleProfileUpdate = async () => {
    if (!isEditingProfile) return;

    const normalizedProfileData = {
      ...profileData,
      firstName: profileData.firstName.trim(),
      middleName: profileData.middleName.trim(),
      lastName: profileData.lastName.trim()
    };

    if (!normalizedProfileData.firstName || !normalizedProfileData.lastName) {
      setProfileMessage({ success: false, message: 'First name and last name are required' });
      return;
    }

    setProfileLoading(true);
    setProfileMessage(null);
    try {
      await api.put('/users/me/profile', {
        first_name: normalizedProfileData.firstName,
        middle_name: normalizedProfileData.middleName || '',
        last_name: normalizedProfileData.lastName,
        profile_image: normalizedProfileData.profileImage
      });

      const display = [normalizedProfileData.firstName, normalizedProfileData.middleName, normalizedProfileData.lastName]
        .map((s) => (s && String(s).trim()) || '')
        .filter(Boolean)
        .join(' ');

      const storedUser = localStorage.getItem('user');
      if (storedUser) {
        const userData = JSON.parse(storedUser);
        userData.fullName = display;
        userData.profileImage = normalizedProfileData.profileImage || null;
        localStorage.setItem('user', JSON.stringify(userData));
        window.dispatchEvent(new Event('userUpdated'));
      }

      setProfileData(normalizedProfileData);
      setProfileSnapshot(normalizedProfileData);
      setIsEditingProfile(false);
      
      setProfileMessage({ success: true, message: 'Profile updated successfully!' });
    } catch (err) {
      setProfileMessage({ 
        success: false, 
        message: err.response?.data?.error || 'Failed to update profile' 
      });
    }
    setProfileLoading(false);
  };

  const handleStartProfileEdit = () => {
    setProfileMessage(null);
    setProfileSnapshot({ ...profileData });
    setIsEditingProfile(true);
  };

  const handleCancelProfileEdit = () => {
    if (profileSnapshot) {
      setProfileData({ ...profileSnapshot });
    }

    if (profileFileRef.current) {
      profileFileRef.current.value = '';
    }

    setProfileMessage(null);
    setIsEditingProfile(false);
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

  const handleSavePriceDelay = async () => {
    setPriceDelayLoading(true);
    setPriceDelayMessage(null);

    try {
      const delay = Number(priceDelayDays);
      await api.put('/menu/price-update-settings', { delay_days: delay });
      setPriceDelayMessage({ success: true, message: `Price update delay saved: ${delay} day(s)` });
    } catch (err) {
      setPriceDelayMessage({
        success: false,
        message: err.response?.data?.error || 'Failed to save price update delay'
      });
    } finally {
      setPriceDelayLoading(false);
    }
  };

  const refreshPendingSchedules = async () => {
    setPendingSchedulesLoading(true);
    setPendingSchedulesMessage(null);

    try {
      const res = await api.get('/menu/price-schedules/pending?limit=200');
      setPendingSchedules(Array.isArray(res?.data?.schedules) ? res.data.schedules : []);
    } catch (err) {
      setPendingSchedulesMessage({
        success: false,
        message: err.response?.data?.error || 'Failed to load pending schedules'
      });
    } finally {
      setPendingSchedulesLoading(false);
    }
  };

  const handleCancelPendingSchedule = async (schedule) => {
    if (!schedule?.schedule_id) return;

    const confirmCancel = window.confirm('Cancel this pending price update?');
    if (!confirmCancel) return;

    setPendingSchedulesMessage(null);
    try {
      await api.put(`/menu/price-schedules/${schedule.schedule_id}/cancel`, {
        reason: 'Cancelled from Config pending schedules manager'
      });

      setPendingSchedulesMessage({ success: true, message: 'Pending schedule cancelled.' });
      await refreshPendingSchedules();
    } catch (err) {
      setPendingSchedulesMessage({
        success: false,
        message: err.response?.data?.error || 'Failed to cancel pending schedule'
      });
    }
  };

  const handleReplacePendingSchedule = async (schedule) => {
    if (!schedule?.schedule_id) return;

    const input = window.prompt(
      `Enter new scheduled price for ${schedule.item_name}:`,
      String(schedule.scheduled_price ?? '')
    );

    if (input == null) return;

    const newPrice = Number(input);
    if (Number.isNaN(newPrice)) {
      setPendingSchedulesMessage({ success: false, message: 'Invalid price value.' });
      return;
    }

    setPendingSchedulesMessage(null);
    try {
      await api.put(`/menu/price-schedules/${schedule.schedule_id}/replace`, {
        scheduled_price: Number(newPrice.toFixed(2)),
        notes: 'Replaced from Config pending schedules manager'
      });

      setPendingSchedulesMessage({
        success: true,
        message: 'Pending schedule replaced. Effective date restarted based on current delay setting.'
      });
      await refreshPendingSchedules();
    } catch (err) {
      setPendingSchedulesMessage({
        success: false,
        message: err.response?.data?.error || 'Failed to replace pending schedule'
      });
    }
  };

  const lockedEditableFieldStyle = !isEditingProfile
    ? { backgroundColor: '#f5f5f5', cursor: 'not-allowed' }
    : undefined;

  return (
    <div className="main-content settings-container">
      <div className="page-header">
        <h1 className="page-title">System Configuration</h1>
        <p className="page-subtitle">Manage system settings</p>
      </div>

      {/* Printer Configuration Card */}
      <div className="settings-card settings-card-printer">
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
            <FilterSelectWrap fullWidth>
              <select 
                className="filter-select"
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
            </FilterSelectWrap>
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

      {isAdminUser && (
        <div className="settings-card settings-card-delay">
          <div className="settings-card-header">
            <span className="icon">⏱️</span>
            <h2>Price Update Delay</h2>
          </div>
          <div className="settings-card-body">
            <div className="settings-info-box">
              <h4>ℹ️ Effective Date Rule</h4>
              <p>
                Item price edits are automatically scheduled using PH time (Asia/Manila).
                The selected delay applies only to new updates and does not change already scheduled entries.
              </p>
            </div>

            <div className="settings-form-group">
              <label>Delay before price update becomes active</label>
              <FilterSelectWrap fullWidth>
                <select
                  className="filter-select"
                  value={priceDelayDays}
                  onChange={(e) => setPriceDelayDays(e.target.value)}
                >
                  <option value="3">3 days</option>
                  <option value="5">5 days</option>
                  <option value="7">7 days</option>
                </select>
              </FilterSelectWrap>
            </div>

            <div className="settings-actions">
              <button
                className="settings-btn settings-btn-primary"
                onClick={handleSavePriceDelay}
                disabled={priceDelayLoading}
              >
                {priceDelayLoading ? '⏳ Saving...' : '💾 Save Delay'}
              </button>
            </div>

            {priceDelayMessage && (
              <div className={`settings-status ${priceDelayMessage.success ? 'success' : 'error'}`}>
                <span className="icon">{priceDelayMessage.success ? '✅' : '❌'}</span>
                {priceDelayMessage.message}
              </div>
            )}
          </div>
        </div>
      )}

      {isAdminUser && (
        <div className="settings-card settings-card-pending">
          <div className="settings-card-header">
            <span className="icon">🗓️</span>
            <h2>Pending Price Schedules</h2>
          </div>
          <div className="settings-card-body">
            <div className="settings-info-box">
              <h4>ℹ️ Manage Pending Updates</h4>
              <p>
                Use <strong>Replace</strong> to submit a new price and restart the effective date countdown.
                Use <strong>Cancel</strong> to remove a pending schedule before it activates.
              </p>
            </div>

            <div className="settings-actions" style={{ marginBottom: '8px' }}>
              <button
                className="settings-btn settings-btn-secondary"
                onClick={refreshPendingSchedules}
                disabled={pendingSchedulesLoading}
              >
                {pendingSchedulesLoading ? '⏳ Refreshing...' : '🔄 Refresh Pending List'}
              </button>
            </div>

            {pendingSchedulesMessage && (
              <div className={`settings-status ${pendingSchedulesMessage.success ? 'success' : 'error'}`}>
                <span className="icon">{pendingSchedulesMessage.success ? '✅' : '❌'}</span>
                {pendingSchedulesMessage.message}
              </div>
            )}

            {pendingSchedules.length === 0 ? (
              <div className="settings-status success">
                <span className="icon">✅</span>
                No pending price schedules.
              </div>
            ) : (
              <div className="table-wrapper">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Item</th>
                      <th>Scope</th>
                      <th>Current</th>
                      <th>Scheduled</th>
                      <th>Effective At (PH)</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pendingSchedules.map((schedule) => (
                      <tr key={schedule.schedule_id}>
                        <td>{schedule.item_name}</td>
                        <td>{getScopeLabel(schedule)}</td>
                        <td>PHP {toMoney(schedule.current_price)}</td>
                        <td>PHP {toMoney(schedule.scheduled_price)}</td>
                        <td>{formatScheduleDateTime(schedule.effective_at, schedule.timezone || 'Asia/Manila')}</td>
                        <td>
                          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            <button
                              className="btn btn-secondary"
                              onClick={() => handleReplacePendingSchedule(schedule)}
                            >
                              Replace
                            </button>
                            <button
                              className="btn btn-danger"
                              onClick={() => handleCancelPendingSchedule(schedule)}
                            >
                              Cancel
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Personal Information Card */}
      <div className="settings-card settings-card-personal">
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
                onChange={(e) => {
                  if (!isEditingProfile) return;
                  setProfileData({ ...profileData, firstName: e.target.value });
                }}
                placeholder="First name"
                readOnly={!isEditingProfile}
                style={lockedEditableFieldStyle}
              />
            </div>
            <div className="settings-form-group">
              <label>Middle name (optional)</label>
              <input
                type="text"
                value={profileData.middleName}
                onChange={(e) => {
                  if (!isEditingProfile) return;
                  setProfileData({ ...profileData, middleName: e.target.value });
                }}
                placeholder="Middle name"
                readOnly={!isEditingProfile}
                style={lockedEditableFieldStyle}
              />
            </div>
          </div>
          <div className="settings-form-group">
            <label>Last name</label>
            <input
              type="text"
              value={profileData.lastName}
              onChange={(e) => {
                if (!isEditingProfile) return;
                setProfileData({ ...profileData, lastName: e.target.value });
              }}
              placeholder="Last name"
              readOnly={!isEditingProfile}
              style={lockedEditableFieldStyle}
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
                disabled={!isEditingProfile}
                className="file-input-hidden"
                id="profile-image-upload"
              />
              {profileData.profileImage ? (
                <div className="image-preview-box">
                  <img src={profileData.profileImage} alt="Profile" />
                  {isEditingProfile && (
                    <>
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
                    </>
                  )}
                </div>
              ) : (
                isEditingProfile ? (
                  <label htmlFor="profile-image-upload" className="upload-placeholder">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                      <polyline points="17 8 12 3 7 8"></polyline>
                      <line x1="12" y1="3" x2="12" y2="15"></line>
                    </svg>
                    <span>Choose Image</span>
                  </label>
                ) : (
                  <div className="upload-placeholder upload-placeholder-disabled" aria-disabled="true">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                      <polyline points="17 8 12 3 7 8"></polyline>
                      <line x1="12" y1="3" x2="12" y2="15"></line>
                    </svg>
                    <span>No Image</span>
                  </div>
                )
              )}
            </div>
          </div>
          <div className="settings-actions">
            {!isEditingProfile && (
              <button
                className="settings-btn settings-btn-primary"
                onClick={handleStartProfileEdit}
                disabled={profileLoading}
              >
                ✏️ Edit Profile
              </button>
            )}
            {isEditingProfile && (
              <>
                <button
                  className="settings-btn settings-btn-secondary"
                  onClick={handleCancelProfileEdit}
                  disabled={profileLoading}
                >
                  Cancel
                </button>
                <button
                  className="settings-btn settings-btn-primary"
                  onClick={handleProfileUpdate}
                  disabled={profileLoading}
                >
                  {profileLoading ? '⏳ Saving...' : '💾 Save'}
                </button>
              </>
            )}
          </div>

          {profileMessage && (
            <div className={`settings-status ${profileMessage.success ? 'success' : 'error'}`}>
              <span className="icon">{profileMessage.success ? '✅' : '❌'}</span>
              {profileMessage.message}
            </div>
          )}

          <div className="settings-divider"></div>

          {/* Account Security Section */}
          <h3 className="settings-subsection-title">
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