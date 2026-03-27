import { io } from 'socket.io-client';
import environment from '../config/environment';

// Socket URL from environment configuration
const SOCKET_URL = environment.SOCKET_URL;

class SocketService {
  socket = null;

  connect() {
    if (!this.socket) {
      const token = localStorage.getItem('token');

      this.socket = io(SOCKET_URL, {
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionAttempts: 5,
        auth: token ? { token: `Bearer ${token}` } : undefined
      });

      this.socket.on('connect', () => {
        console.log('✅ Socket.IO connected');
      });

      this.socket.on('disconnect', () => {
        console.log('❌ Socket.IO disconnected');
      });

      this.socket.on('connect_error', (error) => {
        console.error('Socket connection error:', error);
      });
    }
    return this.socket;
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  // Order Events
  onOrderQueueUpdate(callback) {
    if (this.socket) {
      this.socket.on('update:order_queue', callback);
    }
  }

  onReadyOrdersUpdate(callback) {
    if (this.socket) {
      this.socket.on('update:ready_orders', callback);
    }
  }

  onOrderCompleted(callback) {
    if (this.socket) {
      this.socket.on('update:completed_orders', callback);
    }
  }

  emitOrderNew(orderData) {
    if (this.socket) {
      this.socket.emit('order:new', orderData);
    }
  }

  emitOrderStatusUpdate(orderId, status) {
    if (this.socket) {
      this.socket.emit('order:status_update', { orderId, status });
    }
  }

  // Library Events
  onLibrarySeatsUpdate(callback) {
    if (this.socket) {
      this.socket.on('update:library_seats', callback);
    }
  }

  emitLibraryCheckin(data) {
    if (this.socket) {
      this.socket.emit('library:checkin', data);
    }
  }

  emitLibraryCheckout(data) {
    if (this.socket) {
      this.socket.emit('library:checkout', data);
    }
  }

  emitLibraryExtend(data) {
    if (this.socket) {
      this.socket.emit('library:extend', data);
    }
  }

  // Beeper Events - Real-time beeper status updates
  onBeepersUpdate(callback) {
    if (this.socket) {
      this.socket.on('beepers:update', callback);
    }
  }

  emitBeeperStatusChange(data) {
    if (this.socket) {
      this.socket.emit('beeper:status-change', data);
    }
  }

  // Remove listeners
  removeAllListeners() {
    if (this.socket) {
      this.socket.removeAllListeners();
    }
  }

  removeListener(event) {
    if (this.socket) {
      this.socket.off(event);
    }
  }

  on(event, callback) {
    if (this.socket) {
      this.socket.on(event, callback);
    }
  }

  off(event, callback) {
    if (this.socket) {
      if (callback) {
        this.socket.off(event, callback);
      } else {
        this.socket.off(event);
      }
    }
  }

  isConnected() {
    return !!this.socket?.connected;
  }
}

const socketService = new SocketService();
export default socketService;
