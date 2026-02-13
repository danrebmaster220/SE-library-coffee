import { useState, useEffect, useCallback } from 'react';
import api from '../api';
import '../styles/menu-management-styles/index.css';

export default function Beepers() {
  const [beeperConfig, setBeeperConfig] = useState({ total: 0, available: 0, in_use: 0 });
  const [newBeeperCount, setNewBeeperCount] = useState('');
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [showConfigModal, setShowConfigModal] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const configRes = await api.get('/pos/beepers/config');
      setBeeperConfig(configRes.data);
      setNewBeeperCount(String(configRes.data.total || 20));
    } catch (err) {
      console.error('Error loading beepers:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleUpdateCount = async () => {
    const count = parseInt(newBeeperCount);
    
    if (!count || count < 1 || count > 100) {
      alert('Beeper count must be between 1 and 100');
      return;
    }
    
    setUpdating(true);
    
    try {
      await api.put('/pos/beepers/config', { count });
      await fetchData();
      setShowConfigModal(false);
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to update beeper count');
    }
    
    setUpdating(false);
  };

  const openConfigModal = () => {
    setNewBeeperCount(String(beeperConfig.total));
    setShowConfigModal(true);
  };

  const closeConfigModal = () => {
    setShowConfigModal(false);
  };

  if (loading) {
    return (
      <div className="main-content">
        <div className="page-header-section">
          <div className="page-title-group">
            <h1 className="page-title">Beeper Management</h1>
            <p className="page-subtitle">Manage beeper inventory</p>
          </div>
        </div>
        <div className="loading-state">Loading...</div>
      </div>
    );
  }

  return (
    <div className="main-content">
      <div className="page-header-section">
        <div className="page-title-group">
          <h1 className="page-title">Beeper Management</h1>
          <p className="page-subtitle">Manage beeper inventory</p>
        </div>
      </div>

      {/* Stats Cards - matching Library Management style */}
      <div className="beeper-stats-row">
        <div className="beeper-stat-card stat-total">
          <div className="beeper-stat-value">{beeperConfig.total}</div>
          <div className="beeper-stat-label">TOTAL</div>
        </div>
        <div className="beeper-stat-card stat-available">
          <div className="beeper-stat-value">{beeperConfig.available}</div>
          <div className="beeper-stat-label">AVAILABLE</div>
        </div>
        <div className="beeper-stat-card stat-in-use">
          <div className="beeper-stat-value">{beeperConfig.in_use}</div>
          <div className="beeper-stat-label">IN USE</div>
        </div>
      </div>

      {/* Configure Button */}
      <div style={{ marginTop: '24px', marginBottom: '24px' }}>
        <button className="btn-primary-action" onClick={openConfigModal}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="3"></circle>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
          </svg>
          Configure Beepers
        </button>
      </div>

      {/* Instructions Card */}
      <div className="beeper-info-card">
        <p><strong>Total:</strong> The total number of beepers configured in your establishment</p>
        <p><strong>Available:</strong> Beepers ready to be assigned to new orders</p>
        <p><strong>In Use:</strong> Beepers currently assigned to active orders</p>
      </div>

      {/* Configure Beepers Modal */}
      {showConfigModal && (
        <div className="modal-overlay" onClick={closeConfigModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Configure Beepers</h2>
              <button className="modal-close" onClick={closeConfigModal}>×</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>Total Beeper Count (1-100)</label>
                <input 
                  type="number" 
                  min="1" 
                  max="100"
                  value={newBeeperCount}
                  onChange={(e) => setNewBeeperCount(e.target.value)}
                  placeholder="Enter beeper count"
                />
              </div>
              <p style={{ fontSize: '13px', color: '#666', marginTop: '8px' }}>
                Note: Beepers that are in use cannot be removed.
              </p>
            </div>
            <div className="modal-footer" style={{ justifyContent: 'center' }}>
              <button className="btn-secondary" onClick={closeConfigModal}>Cancel</button>
              <button className="btn-primary" onClick={handleUpdateCount} disabled={updating}>
                {updating ? 'Updating...' : 'Update Count'}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .beeper-stats-row {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 16px;
        }
        .beeper-stat-card {
          background: white;
          border-radius: 8px;
          padding: 24px;
          text-align: center;
          border-left: 4px solid #8B5A2B;
        }
        .beeper-stat-card.stat-total {
          border-left-color: #8B5A2B;
        }
        .beeper-stat-card.stat-available {
          border-left-color: #4CAF50;
        }
        .beeper-stat-card.stat-in-use {
          border-left-color: #FF9800;
        }
        .beeper-stat-value {
          font-size: 32px;
          font-weight: 600;
          color: #333;
          font-family: 'Playfair Display', serif;
        }
        .beeper-stat-label {
          font-size: 12px;
          color: #888;
          margin-top: 4px;
          letter-spacing: 0.5px;
        }
        .beeper-info-card {
          background: white;
          border-radius: 8px;
          padding: 20px 24px;
          border: 1px solid #e0e0e0;
        }
        .beeper-info-card p {
          margin: 0;
          padding: 6px 0;
          font-size: 14px;
          color: #555;
        }
        .beeper-info-card p strong {
          color: #333;
        }
        @media (max-width: 768px) {
          .beeper-stats-row {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}
