import { useEffect, useState } from 'react';
import ActiveShifts from './ActiveShifts';
import ShiftHistory from './ShiftHistory';
import socketService from '../services/socketService';
import '../styles/cash-management.css';
import '../styles/reports.css'; /* Reuse tabs styling */

export default function CashManagement() {
  const [activeTab, setActiveTab] = useState('active');
  const [isRealtimeConnected, setIsRealtimeConnected] = useState(socketService.isConnected());

  useEffect(() => {
    const socket = socketService.connect();

    const handleConnect = () => setIsRealtimeConnected(true);
    const handleDisconnect = () => setIsRealtimeConnected(false);

    setIsRealtimeConnected(socketService.isConnected());
    socketService.on('connect', handleConnect);
    socketService.on('disconnect', handleDisconnect);

    return () => {
      socketService.off('connect', handleConnect);
      socketService.off('disconnect', handleDisconnect);
    };
  }, []);

  return (
    <div className="main-content cash-management-page">
      <div className="page-header-bar">
        <div>
          <h1 className="page-title">Cash Management</h1>
          <p className="page-subtitle">Manage open cashier shifts and view remittance history</p>
        </div>
        <div className={`realtime-status-badge ${isRealtimeConnected ? 'online' : 'offline'}`}>
          <span className="status-dot" aria-hidden="true"></span>
          Realtime {isRealtimeConnected ? 'Connected' : 'Disconnected'}
        </div>
      </div>

      <div className="report-tabs" style={{ marginBottom: '24px', width: 'max-content' }}>
        <button 
          className={'report-tab' + (activeTab === 'active' ? ' active' : '')}
          onClick={() => setActiveTab('active')}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="1" y="4" width="22" height="16" rx="2" ry="2"></rect>
            <circle cx="12" cy="12" r="3"></circle>
            <line x1="1" y1="8" x2="4" y2="8"></line>
            <line x1="20" y1="8" x2="23" y2="8"></line>
            <line x1="1" y1="16" x2="4" y2="16"></line>
            <line x1="20" y1="16" x2="23" y2="16"></line>
          </svg>
          Active Shifts
        </button>
        <button 
          className={'report-tab' + (activeTab === 'history' ? ' active' : '')}
          onClick={() => setActiveTab('history')}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
            <polyline points="14 2 14 8 20 8"></polyline>
            <line x1="16" y1="13" x2="8" y2="13"></line>
            <line x1="16" y1="17" x2="8" y2="17"></line>
          </svg>
          Shift History
        </button>
      </div>

      <div className="tab-pane">
        {activeTab === 'active' ? <ActiveShifts /> : <ShiftHistory />}
      </div>
    </div>
  );
}
