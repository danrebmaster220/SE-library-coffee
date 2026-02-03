import { useState, useEffect } from 'react';
import api from '../api';
import '../styles/menu.css';
import '../styles/orders.css';

export default function ReadyOrders() {
  const [readyOrders, setReadyOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchReadyOrders = async () => {
    try {
      const response = await api.get('/pos/orders');
      const orders = response.data.orders || [];
      setReadyOrders(orders.filter(o => o.status === 'ready'));
    } catch (error) {
      console.error('Error fetching ready orders:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReadyOrders();
    const interval = setInterval(fetchReadyOrders, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleCompleteOrder = async (transactionId) => {
    try {
      await api.put(`/pos/transactions/${transactionId}/complete`);
      fetchReadyOrders();
    } catch (error) {
      console.error('Error completing order:', error);
      alert('Failed to complete order');
    }
  };

  if (loading) {
    return <div className="loading-state">Loading...</div>;
  }

  return (
    <div className="main-content">
      <div className="page-header">
        <div>
          <h1 className="page-title">Ready Orders</h1>
          <p className="page-subtitle">Orders ready for customer pickup</p>
        </div>
      </div>

      <div className="orders-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px' }}>
        {readyOrders.length === 0 ? (
          <div style={{
            background: 'white',
            border: '2px dashed #d7ccc8',
            borderRadius: '16px',
            padding: '60px 40px',
            textAlign: 'center',
            color: '#8d6e63',
            fontSize: '16px',
            gridColumn: '1 / -1'
          }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔔</div>
            <div style={{ fontWeight: '600', marginBottom: '8px' }}>No orders ready for pickup</div>
            <div style={{ fontSize: '14px', color: '#a1887f' }}>Orders will appear here when they are marked as ready</div>
          </div>
        ) : (
          readyOrders.map((order) => (
            <div key={order.transaction_id} className="order-card-large ready" style={{
              background: 'white',
              borderRadius: '16px',
              padding: '20px',
              borderLeft: '5px solid #10b981',
              border: '2px solid #d7ccc8',
              boxShadow: '0 4px 20px rgba(0,0,0,0.05)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                <div style={{ fontSize: '32px', fontWeight: '700', color: '#3e2723' }}>#{order.beeper_number}</div>
                <span style={{ 
                  background: '#d1fae5', 
                  color: '#065f46', 
                  padding: '6px 14px', 
                  borderRadius: '20px',
                  fontSize: '12px',
                  fontWeight: '600',
                  border: '1px solid #6ee7b7'
                }}>
                  🔔 Ready
                </span>
              </div>

              <div style={{ 
                background: '#f5f0e8',
                borderRadius: '10px',
                padding: '15px',
                marginBottom: '15px'
              }}>
                {order.items?.map((item, idx) => (
                  <div key={idx} style={{ display: 'flex', gap: '10px', padding: '5px 0', alignItems: 'center' }}>
                    <span style={{ 
                      background: '#3e2723', 
                      color: 'white', 
                      padding: '2px 8px', 
                      borderRadius: '4px',
                      fontSize: '12px',
                      fontWeight: '600',
                      minWidth: '30px',
                      textAlign: 'center'
                    }}>{item.quantity}x</span>
                    <span style={{ color: '#3e2723' }}>{item.item_name}</span>
                  </div>
                ))}
              </div>

              <button 
                onClick={() => handleCompleteOrder(order.transaction_id)}
                style={{
                  width: '100%',
                  padding: '14px',
                  background: '#10b981',
                  color: 'white',
                  border: 'none',
                  borderRadius: '10px',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
                onMouseOver={(e) => e.target.style.background = '#059669'}
                onMouseOut={(e) => e.target.style.background = '#10b981'}
              >
                ✓ Complete Order
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
