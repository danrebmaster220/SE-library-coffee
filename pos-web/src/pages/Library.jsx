import { useState, useEffect, useCallback } from 'react';
import api from '../api';
import Toast from '../components/Toast';
import '../styles/library.css';

// Format minutes into hours:minutes display
const formatTime = (minutes) => {
  if (minutes <= 0) return '0:00';
  const hrs = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hrs > 0) {
    return `${hrs}:${mins.toString().padStart(2, '0')}`;
  }
  return `${mins}m`;
};

export default function Library() {
  const [seats, setSeats] = useState([]);
  const [tables, setTables] = useState([]);
  const [showCheckinModal, setShowCheckinModal] = useState(false);
  const [showExtendModal, setShowExtendModal] = useState(false);
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [selectedSeat, setSelectedSeat] = useState(null);
  const [toast, setToast] = useState({ show: false, message: '', type: 'info' });

  const showToast = (message, type = 'info') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: '', type: 'info' }), 3000);
  };

  const fetchSeats = useCallback(async () => {
    try {
      const response = await api.get('/library/seats');
      const seatsData = response.data || [];
      setSeats(seatsData);
      
      // Dynamically group seats by table
      const tableNumbers = [...new Set(seatsData.map(s => s.table_number))].sort((a, b) => a - b);
      setTables(tableNumbers);
    } catch (error) {
      console.error('Error fetching seats:', error);
    }
  }, []);

  // Initial fetch + polling
  useEffect(() => {
    // Create an IIFE for initial fetch
    (async () => {
      await fetchSeats();
    })();
    
    // Poll every 10 seconds
    const interval = setInterval(() => {
      fetchSeats();
    }, 10000);
    return () => clearInterval(interval);
  }, [fetchSeats]);

  const handleSeatClick = (seat) => {
    setSelectedSeat(seat);
    if (seat.status === 'available') {
      setShowCheckinModal(true);
    } else if (seat.status === 'reserved') {
      showToast('This seat is reserved by a pending Kiosk order.', 'warning');
    } else if (seat.status === 'occupied') {
      // Show options: Extend or Checkout
      setShowExtendModal(true);
    } else if (seat.status === 'maintenance') {
      showToast('This seat is under maintenance', 'warning');
    }
  };

  // Dynamically group seats by table
  const groupedSeats = tables.map(tableNum => ({
    tableNum,
    seats: seats.filter(s => s.table_number === tableNum).sort((a, b) => a.seat_number - b.seat_number)
  }));

  // Count stats
  const availableCount = seats.filter(s => s.status === 'available').length;
  const occupiedCount = seats.filter(s => s.status === 'occupied').length;
  const reservedCount = seats.filter(s => s.status === 'reserved').length;
  const maintenanceCount = seats.filter(s => s.status === 'maintenance').length;

  return (
    <div className="main-content">
      <div className="page-header">
        <h2 className="page-title">LIBRARY MANAGEMENT → SEAT GRID</h2>
        <p className="subtitle">{tables.length} Tables × {seats.length} Total Seats</p>
        <div className="legend">
          <span className="legend-item"><span className="legend-dot available"></span> Available ({availableCount})</span>
          <span className="legend-item"><span className="legend-dot reserved"></span> Reserved ({reservedCount})</span>
          <span className="legend-item"><span className="legend-dot occupied"></span> Occupied ({occupiedCount})</span>
          {maintenanceCount > 0 && (
            <span className="legend-item"><span className="legend-dot maintenance"></span> Maintenance ({maintenanceCount})</span>
          )}
        </div>
      </div>

      {seats.length === 0 ? (
        <div className="empty-state">
          <p>No seats configured yet.</p>
          <p>Go to <strong>Library Management → Manage Tables</strong> to add tables and seats.</p>
        </div>
      ) : (
        <div className="tables-container">
          {groupedSeats.map(({ tableNum, seats: tableSeats }) => (
            <div key={tableNum} className="table-section">
              <h3 className="table-title">Table {tableNum}:</h3>
              <div className="seats-grid">
                {tableSeats.map(seat => (
                  <div
                    key={seat.seat_id}
                    className={`seat-box ${
                      seat.status === 'available' ? 'seat-available' : 
                      seat.status === 'reserved' ? 'seat-reserved' :
                      seat.status === 'occupied' ? (seat.remaining_minutes <= 10 ? 'seat-warning' : 'seat-occupied') : 
                      'seat-maintenance'
                    }`}
                    onClick={() => handleSeatClick(seat)}
                    title={seat.status === 'occupied' ? `${seat.customer_name || 'Customer'} - ${seat.remaining_minutes || 0} mins left` : seat.status}
                  >
                    <div className="seat-number">[{seat.seat_number}]</div>
                    {seat.status === 'occupied' && (
                      <div className="seat-timer">
                        {formatTime(seat.remaining_minutes || 0)}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="library-instructions">
        <p><strong>Tap occupied seat →</strong> View session / Extend / Checkout</p>
        <p><strong>Tap green seat →</strong> Check-in (Pay first)</p>
        <p><strong>Orange seat →</strong> Reserved by a pending Kiosk order</p>
        <p><span className="timer-note">⏱ Yellow seats = less than 10 mins remaining</span></p>
      </div>

      {/* Check-in Modal */}
      {showCheckinModal && selectedSeat && (
        <CheckinModal
          seat={selectedSeat}
          onClose={() => {
            setShowCheckinModal(false);
            setSelectedSeat(null);
          }}
          onSuccess={() => {
            fetchSeats();
            setShowCheckinModal(false);
            setSelectedSeat(null);
            showToast('Check-in successful!', 'success');
          }}
          showToast={showToast}
        />
      )}

      {/* Extend/Checkout Options Modal */}
      {showExtendModal && selectedSeat && (
        <ExtendOptionsModal
          seat={selectedSeat}
          onClose={() => {
            setShowExtendModal(false);
            setSelectedSeat(null);
          }}
          onExtend={() => {
            setShowExtendModal(false);
            setShowCheckoutModal(false);
          }}
          onCheckout={() => {
            setShowExtendModal(false);
            setShowCheckoutModal(true);
          }}
          onRefresh={fetchSeats}
          showToast={showToast}
        />
      )}

      {/* Checkout Modal */}
      {showCheckoutModal && selectedSeat && (
        <CheckoutModal
          seat={selectedSeat}
          onClose={() => {
            setShowCheckoutModal(false);
            setSelectedSeat(null);
          }}
          onSuccess={() => {
            fetchSeats();
            setShowCheckoutModal(false);
            setSelectedSeat(null);
            showToast('Checkout successful!', 'success');
          }}
          showToast={showToast}
        />
      )}

      {/* Toast Notification */}
      <Toast toast={toast} onClose={() => setToast({ show: false, message: '', type: 'info' })} />
    </div>
  );
}

// Check-in Modal - Prepaid Flow
function CheckinModal({ seat, onClose, onSuccess, showToast }) {
  const [customerID, setCustomerID] = useState('');
  const [selectedPackage, setSelectedPackage] = useState('2hr'); // Default to 2 hours
  const [cashTendered, setCashTendered] = useState('');

  // Pricing packages
  const packages = {
    '2hr': { minutes: 120, price: 100, label: '2 Hours' },
    '3hr': { minutes: 180, price: 150, label: '3 Hours' },
    '4hr': { minutes: 240, price: 200, label: '4 Hours' },
    '5hr': { minutes: 300, price: 250, label: '5 Hours' }
  };

  const selectedPrice = packages[selectedPackage].price;
  const change = cashTendered ? Math.max(0, parseFloat(cashTendered) - selectedPrice) : 0;

  const handleCheckin = async (e) => {
    e.preventDefault();

    if (!cashTendered || parseFloat(cashTendered) < selectedPrice) {
      showToast('Insufficient payment', 'error');
      return;
    }

    try {
      await api.post('/library/checkin', {
        seat_id: seat.seat_id,
        customer_name: customerID,
        duration_minutes: packages[selectedPackage].minutes,
        amount_paid: selectedPrice,
        cash_tendered: parseFloat(cashTendered)
      });
      onSuccess();
    } catch (error) {
      console.error('Check-in error:', error);
      showToast(error.response?.data?.error || 'Check-in failed', 'error');
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content library-modal" onClick={(e) => e.stopPropagation()}>
        <h3>CHECK-IN (Pay First)</h3>
        <hr />

        <form onSubmit={handleCheckin}>
          <div className="form-group">
            <label>Table: {seat.table_number}, Seat: {seat.seat_number}</label>
          </div>
          
          <div className="form-group">
            <label>Customer Name:</label>
            <input
              type="text"
              value={customerID}
              onChange={(e) => setCustomerID(e.target.value)}
              placeholder="Enter customer name"
              required
            />
          </div>

          <div className="package-selection">
            <label><strong>Select Duration Package:</strong></label>
            <div className="package-options">
              {Object.entries(packages).map(([key, pkg]) => (
                <label key={key} className={`package-option ${selectedPackage === key ? 'selected' : ''}`}>
                  <input
                    type="radio"
                    name="package"
                    value={key}
                    checked={selectedPackage === key}
                    onChange={() => setSelectedPackage(key)}
                  />
                  {pkg.label} - ₱{pkg.price}
                </label>
              ))}
            </div>
          </div>

          <div className="payment-section">
            <p className="total-due"><strong>Amount Due: ₱{selectedPrice}.00</strong></p>
            
            <div className="form-group">
              <label>Cash Tendered:</label>
              <input
                type="text"
                inputMode="decimal"
                value={cashTendered}
                onChange={(e) => { if (e.target.value === '' || /^\d*\.?\d{0,2}$/.test(e.target.value)) setCashTendered(e.target.value); }}
                placeholder="Enter amount"
                required
              />
            </div>
            
            <p className="change-display"><strong>Change: ₱{change.toFixed(2)}</strong></p>
          </div>

          <hr />

          <div className="modal-actions">
            <button type="submit" className="btn-confirm">
              ✓ Confirm & Start Timer
            </button>
            <button type="button" className="btn-cancel" onClick={onClose}>
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Extend Options Modal - Prepaid Extension
function ExtendOptionsModal({ seat, onClose, onCheckout, onRefresh, showToast }) {
  const [showExtendForm, setShowExtendForm] = useState(false);
  const [extendMinutes, setExtendMinutes] = useState(30);
  const [cashTendered, setCashTendered] = useState('');

  // Extension pricing
  const extensionOptions = {
    30: { price: 50, label: '+30 minutes' },
    60: { price: 100, label: '+1 hour' },
    90: { price: 150, label: '+1.5 hours' },
    120: { price: 200, label: '+2 hours' }
  };

  const extensionPrice = extensionOptions[extendMinutes].price;
  const change = cashTendered ? Math.max(0, parseFloat(cashTendered) - extensionPrice) : 0;

  const handleExtend = async () => {
    if (!cashTendered || parseFloat(cashTendered) < extensionPrice) {
      showToast('Insufficient payment for extension', 'error');
      return;
    }

    try {
      await api.post('/library/extend', {
        session_id: seat.session_id,
        minutes: extendMinutes,
        amount_paid: extensionPrice,
        cash_tendered: parseFloat(cashTendered)
      });
      showToast(`Extended by ${extendMinutes} minutes`, 'success');
      onRefresh();
      onClose();
    } catch (error) {
      console.error('Extend error:', error);
      showToast(error.response?.data?.error || 'Extension failed', 'error');
    }
  };

  if (showExtendForm) {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-content library-modal" onClick={(e) => e.stopPropagation()}>
          <h3>EXTEND SESSION (Pay to Add Time)</h3>
          <hr />

          <p><strong>Seat:</strong> Table {seat.table_number}, Seat {seat.seat_number}</p>
          <p className="remaining-time"><strong>⏱ Time Remaining:</strong> {seat.remaining_minutes || 0} mins</p>

          <div className="extend-options">
            <h4>Add Time:</h4>
            {Object.entries(extensionOptions).map(([mins, opt]) => (
              <label key={mins} className={`extend-option ${extendMinutes === parseInt(mins) ? 'selected' : ''}`}>
                <input
                  type="radio"
                  name="extend"
                  value={mins}
                  checked={extendMinutes === parseInt(mins)}
                  onChange={() => setExtendMinutes(parseInt(mins))}
                />
                {opt.label} - ₱{opt.price}
              </label>
            ))}
          </div>

          <div className="payment-section">
            <p className="total-due"><strong>Extension Fee: ₱{extensionPrice}.00</strong></p>
            
            <div className="form-group">
              <label>Cash Tendered:</label>
              <input
                type="text"
                inputMode="decimal"
                value={cashTendered}
                onChange={(e) => { if (e.target.value === '' || /^\d*\.?\d{0,2}$/.test(e.target.value)) setCashTendered(e.target.value); }}
                placeholder="Enter amount"
              />
            </div>
            
            <p className="change-display"><strong>Change: ₱{change.toFixed(2)}</strong></p>
          </div>

          <hr />

          <div className="modal-actions">
            <button className="btn-confirm" onClick={handleExtend}>
              ✓ Pay & Extend
            </button>
            <button className="btn-cancel" onClick={() => setShowExtendForm(false)}>
              Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content library-modal" onClick={(e) => e.stopPropagation()}>
        <h3>Session Details</h3>
        <hr />

        <p><strong>Table:</strong> {seat.table_number}</p>
        <p><strong>Seat:</strong> {seat.seat_number}</p>
        <p><strong>Customer:</strong> {seat.customer_name || 'N/A'}</p>
        <p><strong>Paid Minutes:</strong> {seat.paid_minutes || 0} mins</p>
        <p><strong>Time Elapsed:</strong> {seat.elapsed_minutes || 0} mins</p>
        <p className={`remaining-time ${(seat.remaining_minutes || 0) <= 10 ? 'warning' : ''}`}>
          <strong>⏱ Time Remaining:</strong> {seat.remaining_minutes || 0} mins
        </p>
        <p><strong>Total Paid:</strong> ₱{parseFloat(seat.amount_paid || 0).toFixed(2)}</p>

        <hr />

        <div className="modal-actions">
          <button className="btn-extend" onClick={() => setShowExtendForm(true)}>
            ➕ Extend Time
          </button>
          <button className="btn-checkout" onClick={onCheckout}>
            ✓ Checkout (Return ID)
          </button>
          <button className="btn-cancel" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// Checkout Modal - Prepaid: Just return ID, no payment needed
function CheckoutModal({ seat, onClose, onSuccess, showToast }) {
  const handleCheckout = async () => {
    try {
      await api.post('/library/checkout', {
        session_id: seat.session_id
      });
      onSuccess();
    } catch (error) {
      console.error('Checkout error:', error);
      showToast(error.response?.data?.error || 'Checkout failed', 'error');
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content library-modal" onClick={(e) => e.stopPropagation()}>
        <h3>CHECKOUT - Session Complete</h3>
        <hr />

        <div className="checkout-summary">
          <p><strong>Table:</strong> {seat.table_number}, <strong>Seat:</strong> {seat.seat_number}</p>
          <p><strong>Customer:</strong> {seat.customer_name || 'N/A'}</p>
          <p><strong>Start Time:</strong> {seat.start_time ? new Date(seat.start_time).toLocaleTimeString() : 'N/A'}</p>
          <p><strong>End Time:</strong> {new Date().toLocaleTimeString()}</p>
          
          <hr />
          
          <p><strong>Paid Minutes:</strong> {seat.paid_minutes || 0} mins</p>
          <p><strong>Total Used:</strong> {seat.elapsed_minutes || 0} mins</p>
          <p><strong>Amount Already Paid:</strong> ₱{parseFloat(seat.amount_paid || 0).toFixed(2)}</p>
        </div>

        <div className="checkout-notice">
          <p>✓ Payment was collected at check-in</p>
          <p>✓ Please return the customer's physical ID</p>
        </div>

        <hr />

        <div className="modal-actions">
          <button className="btn-confirm" onClick={handleCheckout}>
            ✓ Confirm Checkout & Return ID
          </button>
          <button className="btn-cancel" onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
