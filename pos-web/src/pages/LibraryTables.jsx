import { useState, useEffect, useCallback } from 'react';
import api from '../api';
import Toast from '../components/Toast';
import '../styles/library.css';

export default function LibraryTables() {
  const [config, setConfig] = useState({ total_seats: 0, tables: [] });
  const [loading, setLoading] = useState(true);
  const [showAddTableModal, setShowAddTableModal] = useState(false);
  const [showEditTableModal, setShowEditTableModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showConfigureModal, setShowConfigureModal] = useState(false);
  const [selectedTable, setSelectedTable] = useState(null);
  const [newTableSeats, setNewTableSeats] = useState('8');
  const [newTableName, setNewTableName] = useState('');
  const [editSeatsCount, setEditSeatsCount] = useState('8');
  const [editTableName, setEditTableName] = useState('');
  const [configTables, setConfigTables] = useState('3');
  const [configSeatsPerTable, setConfigSeatsPerTable] = useState('8');
  const [toast, setToast] = useState({ show: false, message: '', type: 'info' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isConfiguring, setIsConfiguring] = useState(false);

  const showToast = useCallback((message, type = 'info') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: '', type: 'info' }), 3000);
  }, []);

  const fetchConfig = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('/library/config');
      setConfig(res.data);
    } catch (err) {
      console.error('Failed to fetch library config:', err);
      showToast('Failed to load configuration', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  const handleAddTable = async () => {
    const seats = parseInt(newTableSeats) || 1;
    if (seats < 1 || seats > 20) {
      showToast('Seats must be between 1 and 20', 'warning');
      return;
    }
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      await api.post('/library/tables', { seats, table_name: newTableName.trim() || null });
      showToast(`Table added with ${seats} seats`, 'success');
      setShowAddTableModal(false);
      setNewTableSeats('8');
      setNewTableName('');
      fetchConfig();
    } catch (err) {
      console.error('Failed to add table:', err);
      showToast(err.response?.data?.error || 'Failed to add table', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateTable = async () => {
    if (!selectedTable) return;
    
    // Validate table name
    if (!editTableName.trim()) {
      showToast('Table name is required', 'warning');
      return;
    }
    
    // Validate seat count
    const seats = parseInt(editSeatsCount) || 1;
    if (seats < 1 || seats > 20) {
      showToast('Seats must be between 1 and 20', 'warning');
      return;
    }
    
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      // Update table name
      await api.put(`/library/tables/${selectedTable.table_number}/name`, { table_name: editTableName.trim() });
      
      // Update seats if changed
      if (seats !== selectedTable.seats) {
        await api.put(`/library/tables/${selectedTable.table_number}/seats`, { seats });
      }
      
      showToast(`Table updated successfully`, 'success');
      setShowEditTableModal(false);
      setSelectedTable(null);
      setEditTableName('');
      setEditSeatsCount('8');
      fetchConfig();
    } catch (err) {
      console.error('Failed to update table:', err);
      showToast(err.response?.data?.error || 'Failed to update table', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteTable = async () => {
    if (!selectedTable || isDeleting) return;
    setIsDeleting(true);
    try {
      await api.delete(`/library/tables/${selectedTable.table_number}`);
      showToast(`Table ${selectedTable.table_number} removed`, 'success');
      setShowDeleteModal(false);
      setSelectedTable(null);
      fetchConfig();
    } catch (err) {
      console.error('Failed to delete table:', err);
      showToast(err.response?.data?.error || 'Failed to remove table', 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleConfigureAll = async () => {
    const tables = parseInt(configTables) || 1;
    const seatsPerTable = parseInt(configSeatsPerTable) || 1;
    if (tables < 1 || tables > 20 || seatsPerTable < 1 || seatsPerTable > 20) {
      showToast('Values must be between 1 and 20', 'warning');
      return;
    }
    if (isConfiguring) return;
    setIsConfiguring(true);
    try {
      await api.post('/library/config', { 
        tables, 
        seats_per_table: seatsPerTable 
      });
      showToast(`Library configured: ${tables} tables × ${seatsPerTable} seats`, 'success');
      setShowConfigureModal(false);
      fetchConfig();
    } catch (err) {
      console.error('Failed to configure library:', err);
      showToast(err.response?.data?.error || 'Failed to configure library', 'error');
    } finally {
      setIsConfiguring(false);
    }
  };

  const openEditTable = (table) => {
    setSelectedTable(table);
    setEditTableName(table.table_name || `Table ${table.table_number}`);
    setEditSeatsCount(String(table.seats));
    setShowEditTableModal(true);
  };

  const openDeleteTable = (table) => {
    setSelectedTable(table);
    setShowDeleteModal(true);
  };

  if (loading) {
    return (
      <div className="main-content">
        <div className="page-header">
          <h2 className="page-title">Library Management</h2>
          <p className="page-subtitle">Manage Tables</p>
        </div>
        <div className="loading-state">Loading configuration...</div>
      </div>
    );
  }

  return (
    <div className="main-content">
      <div className="page-header">
        <h2 className="page-title">Library Management</h2>
        <p className="page-subtitle">Manage Tables</p>
      </div>

      {/* Summary Stats */}
      <div className="library-stats">
        <div className="stat-card">
          <div className="stat-value">{config.tables.length}</div>
          <div className="stat-label">Total Tables</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{config.total_seats}</div>
          <div className="stat-label">Total Seats</div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="library-actions">
        <button className="btn-primary" onClick={() => setShowAddTableModal(true)}>
          Add New Table
        </button>
        <button className="btn-primary" onClick={() => setShowConfigureModal(true)}>
          Quick Configure
        </button>
      </div>

      {/* Tables Grid */}
      <div className="tables-management-grid">
        {config.tables.length === 0 ? (
          <div className="empty-state">
            <p>No tables configured yet.</p>
            <p>Click "Add New Table" or "Quick Configure" to get started.</p>
          </div>
        ) : (
          config.tables.map(table => (
            <div key={table.table_number} className="table-card">
              <div className="table-card-header">
                <h3>{table.table_name || `Table ${table.table_number}`}</h3>
                <span className="seat-count">{table.seats} seats</span>
              </div>
              <div className="table-card-visual">
                {Array.from({ length: table.seats }, (_, i) => (
                  <div key={i} className="mini-seat">{i + 1}</div>
                ))}
              </div>
              <div className="table-card-actions">
                <button className="btn-edit" onClick={() => openEditTable(table)}>
                  Edit
                </button>
                <button className="btn-delete" onClick={() => openDeleteTable(table)}>
                  Remove
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Add Table Modal */}
      {showAddTableModal && (
        <div className="modal-overlay" onClick={() => setShowAddTableModal(false)}>
          <div className="modal-content library-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '550px', width: '90%' }}>
            <div className="modal-header">
              <h3 className="modal-title" style={{ color: '#333' }}>Add New Table</h3>
              <button className="modal-close" onClick={() => setShowAddTableModal(false)} style={{ color: '#666' }}>×</button>
            </div>
            <div style={{ padding: '25px', width: '100%', boxSizing: 'border-box', margin: '0 auto' }}>
              <div className="form-group">
                <label>Table Name (optional):</label>
                <input
                  type="text"
                  placeholder={`Table ${config.tables.length + 1}`}
                  value={newTableName}
                  onChange={e => setNewTableName(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label>Number of Seats:</label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={newTableSeats}
                  onChange={e => { if (e.target.value === '' || /^\d{1,2}$/.test(e.target.value)) setNewTableSeats(e.target.value); }}
                />
              </div>
              <p className="modal-info">
                This will create "{newTableName.trim() || `Table ${config.tables.length + 1}`}" with {parseInt(newTableSeats) || 0} seats.
              </p>
              
              <div className="modal-actions" style={{ borderTop: 'none', paddingTop: 0 }}>
                <button className="btn-cancel" onClick={() => { setShowAddTableModal(false); setNewTableName(''); }} disabled={isSubmitting}>
                  Cancel
                </button>
                <button className="btn-confirm" onClick={handleAddTable} disabled={isSubmitting}>
                  {isSubmitting ? 'Adding...' : '✓ Add Table'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Table Modal (Combined Name + Seats) */}
      {showEditTableModal && selectedTable && (
        <div className="modal-overlay" onClick={() => setShowEditTableModal(false)}>
          <div className="modal-content library-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '550px', width: '90%' }}>
            <div className="modal-header">
              <h3 className="modal-title" style={{ color: '#333' }}>Edit Table</h3>
              <button className="modal-close" onClick={() => setShowEditTableModal(false)} style={{ color: '#666' }}>×</button>
            </div>
            <div style={{ padding: '25px', width: '100%', boxSizing: 'border-box', margin: '0 auto' }}>
              <div className="form-group">
                <label>Table Name:</label>
                <input
                  type="text"
                  placeholder={`Table ${selectedTable.table_number}`}
                  value={editTableName}
                  onChange={e => setEditTableName(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label>Number of Seats:</label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={editSeatsCount}
                  onChange={e => { if (e.target.value === '' || /^\d{1,2}$/.test(e.target.value)) setEditSeatsCount(e.target.value); }}
                />
              </div>
              
              <div className="modal-actions" style={{ borderTop: 'none', paddingTop: 0 }}>
                <button className="btn-cancel" onClick={() => { setShowEditTableModal(false); setEditTableName(''); setEditSeatsCount('8'); }} disabled={isSubmitting}>
                  Cancel
                </button>
                <button className="btn-confirm" onClick={handleUpdateTable} disabled={isSubmitting}>
                  {isSubmitting ? 'Updating...' : '✓ Update Table'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && selectedTable && (
        <div className="modal-overlay" onClick={() => setShowDeleteModal(false)}>
          <div className="modal-content library-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px', width: '90%' }}>
            <div className="modal-header">
              <h3 className="modal-title" style={{ color: '#ef4444' }}>⚠️ Remove Table</h3>
              <button className="modal-close" onClick={() => setShowDeleteModal(false)} style={{ color: '#666' }}>×</button>
            </div>
            <div style={{ padding: '25px', width: '100%', boxSizing: 'border-box', margin: '0 auto', textAlign: 'center' }}>
              <p>Are you sure you want to remove <strong>{selectedTable.table_name || `Table ${selectedTable.table_number}`}</strong>?</p>
              <p className="warning-text">This will delete all {selectedTable.seats} seats. This action cannot be undone.</p>
              
              <div className="modal-actions" style={{ borderTop: 'none', paddingTop: 0 }}>
                <button className="btn-cancel" onClick={() => setShowDeleteModal(false)} disabled={isDeleting}>
                  Cancel
                </button>
                <button className="btn-danger" onClick={handleDeleteTable} disabled={isDeleting}>
                  {isDeleting ? 'Removing...' : 'Yes, Remove Table'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Quick Configure Modal */}
      {showConfigureModal && (
        <div className="modal-overlay" onClick={() => setShowConfigureModal(false)}>
          <div className="modal-content library-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '550px', width: '90%' }}>
            <div className="modal-header">
              <h3 className="modal-title" style={{ color: '#333' }}>⚙️ Quick Configure Library</h3>
              <button className="modal-close" onClick={() => setShowConfigureModal(false)} style={{ color: '#666' }}>×</button>
            </div>
            <div style={{ padding: '25px', width: '100%', boxSizing: 'border-box', margin: '0 auto' }}>
              <p className="warning-text" style={{ textAlign: 'center', marginBottom: '20px' }}>
                ⚠️ This will replace ALL existing tables and seats!
              </p>
              <div className="form-group">
                <label>Number of Tables:</label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={configTables}
                  onChange={e => { if (e.target.value === '' || /^\d{1,2}$/.test(e.target.value)) setConfigTables(e.target.value); }}
                />
              </div>
              <div className="form-group">
                <label>Seats per Table:</label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={configSeatsPerTable}
                  onChange={e => { if (e.target.value === '' || /^\d{1,2}$/.test(e.target.value)) setConfigSeatsPerTable(e.target.value); }}
                />
              </div>
              <p className="modal-info" style={{ textAlign: 'center' }}>
                This will create {parseInt(configTables) || 0} tables × {parseInt(configSeatsPerTable) || 0} seats = <strong>{(parseInt(configTables) || 0) * (parseInt(configSeatsPerTable) || 0)} total seats</strong>
              </p>
              
              <div className="modal-actions" style={{ borderTop: 'none', paddingTop: 0 }}>
                <button className="btn-cancel" onClick={() => setShowConfigureModal(false)} disabled={isConfiguring}>
                  Cancel
                </button>
                <button className="btn-confirm" onClick={handleConfigureAll} disabled={isConfiguring}>
                  {isConfiguring ? 'Configuring...' : '✓ Apply Configuration'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      <Toast toast={toast} onClose={() => setToast({ show: false, message: '', type: 'info' })} />
    </div>
  );
}
