# 📡 Library Coffee + Study API Documentation

## Base URL
```
http://localhost:3000/api
```

## Authentication
Most endpoints require JWT authentication. Include the token in the Authorization header:
```
Authorization: Bearer YOUR_JWT_TOKEN
```

---

## 🔐 Authentication Endpoints

### POST /api/auth/login
Login with username and password

**Request:**
```json
{
  "username": "admin",
  "password": "password123"
}
```

**Response:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "username": "admin",
    "fullName": "Admin User",
    "role": "Admin"
  }
}
```

### POST /api/auth/register
Create new user (Admin only)

**Request:**
```json
{
  "full_name": "New User",
  "username": "newuser",
  "password": "securepass",
  "role_id": 2
}
```

### GET /api/auth/verify
Verify if token is valid

**Headers:** `Authorization: Bearer TOKEN`

**Response:**
```json
{
  "valid": true,
  "user": {
    "id": 1,
    "username": "admin",
    "fullName": "Admin User",
    "role": "Admin"
  }
}
```

---

## 🍕 Menu Management

### GET /api/menu/categories
Get all categories

**Response:**
```json
[
  {
    "category_id": 1,
    "name": "Coffee-Based Drinks",
    "status": "active",
    "created_at": "2024-01-01T00:00:00.000Z"
  }
]
```

### POST /api/menu/categories
Create category (Admin only)

**Request:**
```json
{
  "name": "New Category",
  "status": "active"
}
```

### PUT /api/menu/categories/:id
Update category (Admin only)

### DELETE /api/menu/categories/:id
Delete category (Admin only)

### GET /api/menu/items
Get all items (optional: filter by category_id)

**Query Params:** `?category_id=1`

**Response:**
```json
[
  {
    "item_id": 1,
    "category_id": 1,
    "name": "Cappuccino",
    "description": "Espresso with steamed milk",
    "price": 120.00,
    "station": "barista",
    "status": "available",
    "category_name": "Coffee-Based Drinks"
  }
]
```

### POST /api/menu/items
Create item (Admin only)

**Request:**
```json
{
  "category_id": 1,
  "name": "Flat White",
  "description": "Velvety microfoam",
  "price": 135.00,
  "station": "barista",
  "status": "available"
}
```

### PUT /api/menu/items/:id
Update item (Admin only)

### DELETE /api/menu/items/:id
Delete item (Admin only)

---

## 💰 Discounts

### GET /api/discounts
Get all discounts (Admin only)

**Response:**
```json
[
  {
    "discount_id": 1,
    "name": "Senior Citizen",
    "percentage": 20.00,
    "status": "active"
  }
]
```

### GET /api/discounts/active
Get active discounts (for POS payment modal)

### POST /api/discounts
Create discount (Admin only)

**Request:**
```json
{
  "name": "Holiday Special",
  "percentage": 15.00,
  "status": "active"
}
```

### PUT /api/discounts/:id
Update discount (Admin only)

### DELETE /api/discounts/:id
Delete discount (Admin only)

---

## 📦 Orders & POS

### POST /api/orders
Create order (from Kiosk - no auth required)

**Request:**
```json
{
  "items": [
    {
      "item_id": 1,
      "quantity": 2,
      "price": 120.00
    }
  ],
  "total_amount": 240.00
}
```

**Response:**
```json
{
  "message": "Order placed successfully!",
  "order_id": 15,
  "beeper_number": 7
}
```

### GET /api/orders/queue
Get pending & preparing orders (POS queue screen)

**Response:**
```json
[
  {
    "order_id": 15,
    "beeper_number": 7,
    "total_amount": 240.00,
    "final_amount": 240.00,
    "status": "pending",
    "payment_status": "unpaid",
    "item_count": 2,
    "created_at": "2024-01-01T10:00:00.000Z"
  }
]
```

### GET /api/orders/ready
Get ready orders (Ready orders screen)

### GET /api/orders/completed
Get completed orders (with filter)

**Query Params:** `?filter=today` (today | yesterday | week | month)

### GET /api/orders/:id
Get order details with items

**Response:**
```json
{
  "order_id": 15,
  "beeper_number": 7,
  "total_amount": 240.00,
  "discount_name": "Senior Citizen",
  "discount_percentage": 20.00,
  "final_amount": 192.00,
  "cash_tendered": 200.00,
  "change_due": 8.00,
  "status": "completed",
  "items": [
    {
      "order_item_id": 1,
      "item_id": 1,
      "item_name": "Cappuccino",
      "quantity": 2,
      "price": 120.00
    }
  ]
}
```

### POST /api/orders/:id/payment
Process payment (Cashier)

**Request:**
```json
{
  "discount_id": 1,
  "cash_tendered": 200.00,
  "change_due": 8.00,
  "final_amount": 192.00
}
```

### PUT /api/orders/:id/status
Update order status (Barista/Kitchen)

**Request:**
```json
{
  "status": "ready"
}
```

### POST /api/orders/:id/complete
Mark order as completed

---

## 📚 Library Management

### GET /api/library/seats
Get all 24 seats with status

**Response:**
```json
[
  {
    "seat_id": 1,
    "table_number": 1,
    "seat_number": 1,
    "status": "available",
    "session_id": null,
    "customer_name": null,
    "start_time": null,
    "elapsed_minutes": null,
    "amount_due": null
  },
  {
    "seat_id": 2,
    "table_number": 1,
    "seat_number": 2,
    "status": "occupied",
    "session_id": 5,
    "customer_name": "John Doe",
    "start_time": "2024-01-01T10:00:00.000Z",
    "elapsed_minutes": 45,
    "amount_due": 100.00
  }
]
```

### POST /api/library/checkin
Check-in to a seat

**Request:**
```json
{
  "seat_id": 1,
  "customer_name": "John Doe"
}
```

**Response:**
```json
{
  "message": "Check-in successful",
  "session_id": 5
}
```

### POST /api/library/extend
Extend session

**Request:**
```json
{
  "session_id": 5,
  "minutes": 30
}
```

**Response:**
```json
{
  "message": "Session extended successfully",
  "new_amount": 150.00
}
```

### POST /api/library/checkout
Checkout from seat

**Request:**
```json
{
  "session_id": 5
}
```

**Response:**
```json
{
  "message": "Checkout successful",
  "total_minutes": 150,
  "final_fee": 150.00
}
```

### GET /api/library/sessions/:id
Get session details

---

## 👥 User Management

### GET /api/users
Get all users (with optional search)

**Query Params:** `?search=john`

**Response:**
```json
[
  {
    "user_id": 1,
    "username": "admin",
    "full_name": "Admin User",
    "role_name": "Admin",
    "status": "active",
    "created_at": "2024-01-01T00:00:00.000Z"
  }
]
```

### GET /api/users/:id
Get user by ID

### POST /api/users
Create user (Admin only)

**Request:**
```json
{
  "full_name": "New User",
  "username": "newuser",
  "password": "password123",
  "role_id": 2,
  "status": "active"
}
```

### PUT /api/users/:id
Update user (Admin only)

### DELETE /api/users/:id
Delete user (Admin only)

### POST /api/users/:id/reset-password
Reset user password (Admin only)

**Request:**
```json
{
  "new_password": "newpassword123"
}
```

### GET /api/users/meta/roles
Get all roles (for dropdown)

**Response:**
```json
[
  { "role_id": 1, "role_name": "Admin" },
  { "role_id": 2, "role_name": "Cashier" },
  { "role_id": 3, "role_name": "Barista" }
]
```

---

## 📊 Reports & Analytics

### GET /api/reports/sales-summary
Get sales summary

**Query Params:** `?startDate=2024-01-01&endDate=2024-01-31`

**Response:**
```json
{
  "total_orders": 150,
  "total_sales": 25000.00,
  "average_order_value": 166.67,
  "total_discounts": 2500.00
}
```

### GET /api/reports/sales-trend
Get sales trend

**Query Params:** `?period=daily` (daily | weekly | monthly)

**Response:**
```json
[
  {
    "date_label": "2024-01-01",
    "order_count": 25,
    "total_sales": 4500.00
  }
]
```

### GET /api/reports/top-products
Get top selling products

**Query Params:** `?limit=10`

**Response:**
```json
[
  {
    "product_name": "Cappuccino",
    "category_name": "Coffee-Based Drinks",
    "order_count": 45,
    "total_quantity": 68,
    "total_revenue": 8160.00
  }
]
```

### GET /api/reports/category-performance
Get category performance

### GET /api/reports/library-stats
Get library usage statistics

**Response:**
```json
{
  "total_sessions": 120,
  "total_minutes": 14400,
  "avg_session_duration": 120,
  "total_revenue": 12000.00
}
```

### GET /api/reports/hourly-sales
Get hourly sales (peak hours)

---

## 🔌 Socket.IO Events

Connect to: `http://localhost:3000`

### Client → Server

#### Join Rooms
```javascript
socket.emit('join:pos');
socket.emit('join:library');
```

#### Order Events
```javascript
socket.emit('order:new', orderData);
socket.emit('order:status-change', orderData);
socket.emit('order:payment', orderData);
```

#### Library Events
```javascript
socket.emit('library:checkin', seatData);
socket.emit('library:checkout', seatData);
```

### Server → Client

#### Order Updates
```javascript
socket.on('order:queue-update', (data) => {
  // Refresh order queue
});
```

#### Library Updates
```javascript
socket.on('library:seats-update', (data) => {
  // Refresh seat grid
});
```

---

## 🔒 Role-Based Access

| Endpoint | Admin | Cashier | Barista |
|----------|-------|---------|---------|
| Auth (login/verify) | ✅ | ✅ | ✅ |
| Menu Management | ✅ | ❌ | ❌ |
| Discounts | ✅ | ❌ | ❌ |
| POS (payment) | ✅ | ✅ | ❌ |
| Order Status | ✅ | ✅ | ✅ |
| Library | ✅ | ✅ | ❌ |
| Users | ✅ | ❌ | ❌ |
| Reports | ✅ | ❌ | ❌ |

---

## 🚀 Quick Start

1. Install dependencies:
```bash
npm install
```

2. Setup database:
```bash
mysql -u root -p < config/coffee_db.sql
mysql -u root -p < config/seed.sql
node config/seed_users.js
```

3. Start server:
```bash
npm run dev
```

4. Test login:
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"password123"}'
```

---

**🎉 API is ready for integration with your React frontend!**
