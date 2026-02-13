import { useState, useEffect } from 'react';
import api from '../api';
import '../styles/menu-management-styles/index.css';
import '../styles/orders.css';

export default function OrderQueue() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    fetchOrders();
    const interval = setInterval(fetchOrders, 5000);
    return () => clearInterval(interval);
  }, []);

  const fetchOrders = async () => {
    try {
      const res = await api.get('/pos/orders');
      setOrders(res.data.orders || res.data || []);
    } catch (error) {
      console.error('Error fetching orders:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateOrderStatus = async (transactionId, status) => {
    try {
      await api.put(`/pos/transactions/${transactionId}/${status}`);
      fetchOrders();
    } catch (error) {
      console.error('Error updating order:', error);
    }
  };

  const filteredOrders = orders.filter(order => {
    if (filter === 'all') return ['pending', 'paid', 'preparing', 'ready'].includes(order.status);
    return order.status === filter;
  });

  const getStatusBadge = (status) => {
    const statusMap = {
      pending: { label: 'Pending Payment', class: 'status-pending' },
      paid: { label: 'Paid', class: 'status-paid' },
      preparing: { label: 'Preparing', class: 'status-preparing' },
      ready: { label: 'Ready', class: 'status-ready' },
      completed: { label: 'Completed', class: 'status-completed' },
      voided: { label: 'Voided', class: 'status-voided' }
    };
    return statusMap[status] || { label: status, class: '' };
  };

  if (loading) {
    return <div className="loading-state">Loading orders...</div>;
  }

  return (
    <div className="main-content">
      <div className="page-header">
        <div>
          <h1 className="page-title">Order Queue</h1>
          <p className="page-subtitle">Manage and track all orders</p>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="filter-tabs">
        {['all', 'pending', 'preparing', 'ready'].map(f => (
          <button
            key={f}
            className={`filter-tab ${filter === f ? 'active' : ''}`}
            onClick={() => setFilter(f)}
          >
            {f === 'all' ? 'All Orders' : f.charAt(0).toUpperCase() + f.slice(1)}
            <span className="filter-count">
              {f === 'all' 
                ? orders.filter(o => ['pending', 'paid', 'preparing', 'ready'].includes(o.status)).length
                : orders.filter(o => o.status === f || (f === 'preparing' && o.status === 'paid')).length
              }
            </span>
          </button>
        ))}
      </div>

      {/* Orders Grid */}
      <div className="orders-grid">
        {filteredOrders.length === 0 ? (
          <div className="empty-state">No orders found</div>
        ) : (
          filteredOrders.map(order => {
            const statusInfo = getStatusBadge(order.status);
            return (
              <div key={order.transaction_id} className={`order-card-large ${order.status}`}>
                <div className="order-header">
                  <div className="order-beeper-large">#{order.beeper_number}</div>
                  <span className={`status-badge ${statusInfo.class}`}>
                    {statusInfo.label}
                  </span>
                </div>

                <div className="order-meta">
                  <span className="order-type-badge">{order.order_type}</span>
                  <span className="order-time">
                    {new Date(order.created_at).toLocaleTimeString()}
                  </span>
                </div>

                <div className="order-items-list">
                  {order.items?.map((item, idx) => (
                    <div key={idx} className="order-item-row">
                      <span className="item-qty">{item.quantity}x</span>
                      <span className="item-name">{item.item_name}</span>
                      <span className="item-price">₱{parseFloat(item.total_price).toFixed(2)}</span>
                    </div>
                  ))}
                </div>

                <div className="order-total-row">
                  <span>Total</span>
                  <span className="order-total-amount">₱{parseFloat(order.total_amount).toFixed(2)}</span>
                </div>

                <div className="order-actions">
                  {order.status === 'pending' && (
                    <button className="btn-action btn-primary" disabled>
                      Awaiting Payment
                    </button>
                  )}
                  {(order.status === 'paid' || order.status === 'preparing') && (
                    <button 
                      className="btn-action btn-ready-action"
                      onClick={() => updateOrderStatus(order.transaction_id, 'ready')}
                    >
                      Mark Ready
                    </button>
                  )}
                  {order.status === 'ready' && (
                    <button 
                      className="btn-action btn-complete-action"
                      onClick={() => updateOrderStatus(order.transaction_id, 'complete')}
                    >
                      Complete Order
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
