# 🔌 Backend API Integration Guide

## Overview
This guide shows you exactly how the frontend expects the backend API to respond. Use this to build or verify your backend endpoints.

---

## 🔐 Authentication

### POST `/api/auth/login`

**Request:**
```json
{
  "username": "admin",
  "password": "admin123"
}
```

**Response (Success):**
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "full_name": "Administrator",
    "username": "admin",
    "role": "admin",
    "status": "active"
  }
}
```

**Response (Error):**
```json
{
  "success": false,
  "message": "Invalid credentials"
}
```

---

## 🛒 Orders

### GET `/api/orders/queue`
Get all pending/preparing orders

**Response:**
```json
{
  "success": true,
  "orders": [
    {
      "id": 1,
      "beeper_number": 3,
      "status": "pending",
      "total_amount": 350.00,
      "created_at": "2025-11-28T10:30:00Z",
      "items": [
        {
          "id": 1,
          "name": "Americano",
          "quantity": 2,
          "price": 150.00
        }
      ]
    }
  ]
}
```

### GET `/api/orders/ready`
Get orders ready for pickup

**Response:**
```json
{
  "success": true,
  "orders": [
    {
      "id": 2,
      "beeper_number": 7,
      "status": "ready",
      "items": [
        { "name": "Latte" },
        { "name": "Pasta" }
      ]
    }
  ]
}
```

### GET `/api/orders/completed?filter=today`
Get completed orders

**Query Parameters:**
- `filter`: today | yesterday | week | month

**Response:**
```json
{
  "success": true,
  "orders": [
    {
      "id": 3,
      "beeper_number": 12,
      "total_amount": 324.00,
      "payment_type": "cash",
      "completed_at": "2025-11-28T13:23:00Z"
    }
  ]
}
```

### POST `/api/orders/pay/:id`
Process payment for an order

**Request:**
```json
{
  "discount_id": 1,
  "cash_tendered": 400.00,
  "change_due": 76.00
}
```

**Response:**
```json
{
  "success": true,
  "message": "Payment processed successfully",
  "order_id": 1,
  "receipts_printed": ["customer", "barista", "kitchen"]
}
```

### PUT `/api/orders/status/:id`
Update order status

**Request:**
```json
{
  "status": "completed"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Order status updated"
}
```

### POST `/api/orders/reprint/:id`
Reprint receipt for completed order

**Response:**
```json
{
  "success": true,
  "message": "Receipt reprinted"
}
```

---

## 📋 Categories

### GET `/api/categories`

**Response:**
```json
{
  "success": true,
  "categories": [
    {
      "id": 1,
      "name": "Coffee-Based",
      "icon": "☕",
      "status": "active",
      "item_count": 5,
      "created_at": "2025-11-01T00:00:00Z"
    }
  ]
}
```

### POST `/api/categories`

**Request:**
```json
{
  "name": "Frappes",
  "icon": "🥤",
  "status": "active"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Category created",
  "category_id": 2
}
```

### PUT `/api/categories/:id`

**Request:**
```json
{
  "name": "Coffee Drinks",
  "icon": "☕",
  "status": "active"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Category updated"
}
```

### DELETE `/api/categories/:id`

**Response:**
```json
{
  "success": true,
  "message": "Category deleted"
}
```

---

## 🍔 Items

### GET `/api/items?category_id=1`

**Query Parameters:**
- `category_id`: Filter by category (optional)

**Response:**
```json
{
  "success": true,
  "items": [
    {
      "id": 1,
      "category_id": 1,
      "name": "Iced Americano",
      "description": "Cold espresso with water",
      "price": 150.00,
      "station": "barista",
      "status": "available",
      "created_at": "2025-11-01T00:00:00Z"
    }
  ]
}
```

### POST `/api/items`

**Request:**
```json
{
  "name": "Beef Burger",
  "category_id": 2,
  "description": "Juicy beef patty with cheese",
  "price": 210.00,
  "station": "kitchen",
  "status": "available"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Item created",
  "item_id": 5
}
```

### PUT `/api/items/:id`

**Request:**
```json
{
  "name": "Beef Burger",
  "description": "Updated description",
  "price": 220.00,
  "station": "kitchen",
  "status": "unavailable"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Item updated"
}
```

### DELETE `/api/items/:id`

**Response:**
```json
{
  "success": true,
  "message": "Item deleted"
}
```

---

## 🎫 Discounts

### GET `/api/discounts`

**Response:**
```json
{
  "success": true,
  "discounts": [
    {
      "id": 1,
      "name": "Senior Citizen",
      "percentage": 20,
      "status": "active",
      "created_at": "2025-11-01T00:00:00Z"
    },
    {
      "id": 2,
      "name": "PWD",
      "percentage": 20,
      "status": "active",
      "created_at": "2025-11-01T00:00:00Z"
    }
  ]
}
```

### POST `/api/discounts`

**Request:**
```json
{
  "name": "Employee",
  "percentage": 10,
  "status": "active"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Discount created",
  "discount_id": 3
}
```

### PUT `/api/discounts/:id`

**Request:**
```json
{
  "name": "Employee",
  "percentage": 15,
  "status": "active"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Discount updated"
}
```

### DELETE `/api/discounts/:id`

**Response:**
```json
{
  "success": true,
  "message": "Discount deleted"
}
```

---

## 📚 Library

### GET `/api/library/seats`

**Response:**
```json
{
  "success": true,
  "seats": [
    {
      "id": 1,
      "table_number": 1,
      "seat_number": 1,
      "status": "available"
    },
    {
      "id": 2,
      "table_number": 1,
      "seat_number": 2,
      "status": "occupied",
      "transaction_id": 5,
      "customer_id_name": "Juan Dela Cruz - DL12345",
      "start_time": "2025-11-28T10:00:00Z",
      "elapsed_minutes": 45,
      "remaining_minutes": 75
    }
  ]
}
```

### POST `/api/library/checkin`

**Request:**
```json
{
  "seat_id": 1,
  "customer_id_name": "Maria Santos - ID67890"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Check-in successful",
  "transaction_id": 6,
  "start_time": "2025-11-28T14:00:00Z",
  "initial_fee": 100.00
}
```

### POST `/api/library/extend/:transaction_id`

**Request:**
```json
{
  "minutes": 30
}
```

**Response:**
```json
{
  "success": true,
  "message": "Session extended by 30 minutes",
  "new_end_time": "2025-11-28T16:30:00Z",
  "extension_fee": 50.00
}
```

### POST `/api/library/checkout/:transaction_id`

**Request:**
```json
{
  "cash_tendered": 200.00,
  "change_due": 50.00
}
```

**Response:**
```json
{
  "success": true,
  "message": "Checkout successful",
  "total_amount": 150.00,
  "receipt_printed": true
}
```

---

## 👥 Users

### GET `/api/users`

**Response:**
```json
{
  "success": true,
  "users": [
    {
      "id": 1,
      "full_name": "Aishak Hassan",
      "username": "aishak",
      "role": "cashier",
      "status": "active",
      "created_at": "2025-11-01T00:00:00Z"
    }
  ]
}
```

### POST `/api/users`

**Request:**
```json
{
  "full_name": "Sarah Lee",
  "username": "sarah",
  "password": "password123",
  "role": "cashier",
  "status": "active"
}
```

**Response:**
```json
{
  "success": true,
  "message": "User created",
  "user_id": 5
}
```

### PUT `/api/users/:id`

**Request:**
```json
{
  "full_name": "Sarah Lee",
  "username": "sarah",
  "role": "admin",
  "status": "active"
}
```

**Response:**
```json
{
  "success": true,
  "message": "User updated"
}
```

### DELETE `/api/users/:id`

**Response:**
```json
{
  "success": true,
  "message": "User deleted"
}
```

### PUT `/api/users/:id/reset-password`

**Response:**
```json
{
  "success": true,
  "message": "Password reset to default",
  "new_password": "newpassword123"
}
```

---

## 📊 Reports

### GET `/api/reports/sales?range=daily&start=&end=`

**Query Parameters:**
- `range`: daily | weekly | monthly
- `start`: YYYY-MM-DD (optional)
- `end`: YYYY-MM-DD (optional)

**Response:**
```json
{
  "success": true,
  "today_sales": 6800.00,
  "weekly_sales": 42000.00,
  "monthly_sales": 175000.00,
  "total_orders": 45,
  "top_products": [
    {
      "rank": 1,
      "name": "Caramel Macchiato",
      "category": "Coffee-Based",
      "sales": 35650,
      "units": 256
    }
  ],
  "category_performance": [
    {
      "name": "Coffee-Based",
      "sales": 52000
    }
  ]
}
```

### GET `/api/reports/export?range=daily`

**Response:** CSV file download

---

## 🔌 Socket.IO Events

### Server → Client Events

**`update:order_queue`**
```javascript
// Emitted when order queue changes
socket.emit('update:order_queue', orders);
```

**`update:ready_orders`**
```javascript
// Emitted when ready orders change
socket.emit('update:ready_orders', orders);
```

**`update:library_seats`**
```javascript
// Emitted when library seats change
socket.emit('update:library_seats', seats);
```

### Client → Server Events

**`order:new`**
```javascript
socket.emit('order:new', { order_id: 1, beeper_number: 5 });
```

**`order:status_update`**
```javascript
socket.emit('order:status_update', { orderId: 1, status: 'ready' });
```

**`library:checkin`**
```javascript
socket.emit('library:checkin', { seat_id: 1 });
```

**`library:checkout`**
```javascript
socket.emit('library:checkout', { transaction_id: 5 });
```

---

## ⚙️ Configuration

### Frontend API URL
Located in `src/api.js`:
```javascript
const API_URL = 'http://localhost:3000/api';
```

### Socket.IO URL
Located in `src/services/socketService.js`:
```javascript
const SOCKET_URL = 'http://localhost:3000';
```

---

## 🔒 Authentication Headers

All API requests (except login) should include:
```javascript
headers: {
  'Authorization': `Bearer ${localStorage.getItem('token')}`
}
```

This is automatically handled by Axios interceptors (add in `src/api.js`):
```javascript
api.interceptors.request.use(config => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});
```

---

## 🧪 Testing the Integration

### 1. Start Backend
```bash
cd backend
npm start
```

### 2. Start Frontend
```bash
cd pos-web
npm run dev
```

### 3. Test Endpoints
Use Postman or Thunder Client to test each endpoint before connecting the frontend.

### 4. Check Console
Open browser console (F12) and watch for:
- ✅ API requests
- ✅ Socket.IO connection
- ❌ Any errors

---

## 🚨 Error Handling

The frontend expects errors in this format:
```json
{
  "success": false,
  "message": "Error description here"
}
```

HTTP status codes:
- `200`: Success
- `400`: Bad request
- `401`: Unauthorized
- `404`: Not found
- `500`: Server error

---

## ✅ Integration Checklist

- [ ] All routes return proper JSON format
- [ ] Authentication returns token
- [ ] Token is validated on protected routes
- [ ] Socket.IO server is running
- [ ] CORS is enabled for frontend URL
- [ ] Database is seeded with initial data
- [ ] Printer integration works
- [ ] All CRUD operations work
- [ ] Real-time events emit properly

---

**Ready to integrate!** Follow this guide to connect your backend API to the frontend. 🚀
