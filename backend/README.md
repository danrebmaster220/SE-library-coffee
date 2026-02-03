# 🎯 Library Coffee + Study Backend API

Complete Node.js + Express + MySQL + Socket.IO backend for the Library Coffee + Study POS System.

## 📋 Table of Contents
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Setup Instructions](#setup-instructions)
- [API Documentation](#api-documentation)
- [Testing](#testing)
- [Deployment](#deployment)

---

## ✨ Features

### 🔐 Authentication & Authorization
- JWT-based authentication
- Role-based access control (Admin, Cashier, Barista)
- Secure password hashing with bcrypt
- Token verification middleware

### 📦 Order Management
- Create orders from kiosk
- Automatic beeper assignment (1-20 rotation)
- Order queue management
- Payment processing with discount support
- Order status tracking (pending → preparing → ready → completed)
- Real-time order updates via Socket.IO

### 🍕 Menu Management
- Category CRUD operations
- Menu item CRUD operations
- Station assignment (barista/kitchen)
- Status management (active/inactive, available/sold_out)

### 💰 Discount System
- Multiple discount types (Senior, PWD, Employee, Student)
- Percentage-based discounts
- Active/inactive status management

### 📚 Library Seat Management
- 24-seat grid system (3 tables × 8 seats)
- Check-in/checkout functionality
- Session time tracking
- Automatic fee calculation (₱100 for 2hrs + ₱50 per 30min)
- Session extension support
- Real-time seat availability updates

### 👥 User Management
- User CRUD operations
- Role assignment
- Password reset functionality
- User search and filtering
- Status management (active/inactive)

### 📊 Reports & Analytics
- Sales summary (total orders, revenue, average order value)
- Sales trends (daily/weekly/monthly)
- Top selling products
- Category performance
- Library usage statistics
- Hourly sales analysis (peak hours)

### 🔌 Real-Time Features (Socket.IO)
- Order queue updates
- Library seat availability updates
- Room-based event broadcasting

---

## 🛠 Tech Stack

- **Runtime:** Node.js
- **Framework:** Express.js 5.1.0
- **Database:** MySQL 2
- **Authentication:** JWT (jsonwebtoken)
- **Password Hashing:** bcrypt
- **Real-Time:** Socket.IO 4.8.1
- **Environment:** dotenv
- **CORS:** cors middleware
- **Dev Tool:** nodemon

---

## 📁 Project Structure

```
backend/
├── config/
│   ├── db.js                 # MySQL connection pool
│   ├── coffee_db.sql         # Database schema
│   ├── seed.sql              # Sample data
│   └── seed_users.js         # User seeding script
├── controllers/
│   ├── authController.js     # Login, register, verify
│   ├── discountController.js # Discount CRUD
│   ├── libraryController.js  # Library seat management
│   ├── menuController.js     # Category & item CRUD
│   ├── orderController.js    # Order & POS operations
│   ├── reportsController.js  # Analytics & reports
│   └── userController.js     # User management
├── middleware/
│   └── auth.js               # JWT verification middleware
├── routes/
│   ├── authRoutes.js
│   ├── discountRoutes.js
│   ├── libraryRoutes.js
│   ├── menuRoutes.js
│   ├── orderRoutes.js
│   ├── reportsRoutes.js
│   └── userRoutes.js
├── .env                      # Environment variables
├── server.js                 # Main server file
├── package.json
└── API_DOCUMENTATION.md      # Full API reference
```

---

## 🚀 Setup Instructions

### Prerequisites
- Node.js (v14 or higher)
- MySQL (v8.0 or higher)
- npm or yarn

### 1. Install Dependencies
```bash
cd backend
npm install
```

### 2. Configure Environment
Edit `.env` file:
```env
PORT=3000
DB_HOST=localhost
DB_USER=root
DB_PASS=your_mysql_password
DB_NAME=coffee_db
JWT_SECRET=your-secret-key-change-in-production
```

### 3. Setup Database

**Option A: Import SQL files**
```bash
# Create database and tables
mysql -u root -p < config/coffee_db.sql

# Insert sample data
mysql -u root -p coffee_db < config/seed.sql

# Seed users with hashed passwords
node config/seed_users.js
```

**Option B: Manual setup**
```sql
-- Create database
CREATE DATABASE coffee_db;

-- Import schema
USE coffee_db;
source config/coffee_db.sql;

-- Import seed data
source config/seed.sql;
```

Then run the user seeding script:
```bash
node config/seed_users.js
```

### 4. Verify Database Connection
```bash
npm run dev
```

Visit: `http://localhost:3000/test-db`

You should see a list of users.

### 5. Test Authentication
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"password123"}'
```

You should receive a JWT token.

---

## 📡 API Documentation

See [API_DOCUMENTATION.md](./API_DOCUMENTATION.md) for complete API reference.

### Quick Reference

| Module | Base Route | Auth Required |
|--------|-----------|---------------|
| Authentication | `/api/auth` | No (for login) |
| Menu | `/api/menu` | Yes |
| Orders | `/api/orders` | Partial |
| Discounts | `/api/discounts` | Yes |
| Library | `/api/library` | Yes |
| Users | `/api/users` | Yes (Admin) |
| Reports | `/api/reports` | Yes (Admin) |

### Default User Credentials

| Username | Password | Role |
|----------|----------|------|
| admin | password123 | Admin |
| cashier | password123 | Cashier |
| barista | password123 | Barista |

---

## 🧪 Testing

### Manual Testing with cURL

**Login:**
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"password123"}'
```

**Get Categories (with auth):**
```bash
curl -X GET http://localhost:3000/api/menu/categories \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

**Create Order (no auth required):**
```bash
curl -X POST http://localhost:3000/api/orders \
  -H "Content-Type: application/json" \
  -d '{
    "items": [
      {"item_id": 1, "quantity": 2, "price": 120.00}
    ],
    "total_amount": 240.00
  }'
```

### Testing Socket.IO

Use the React frontend or a Socket.IO client:
```javascript
const socket = io('http://localhost:3000');

socket.emit('join:pos');

socket.on('order:queue-update', (data) => {
  console.log('Order update:', data);
});
```

---

## 🗂️ Database Schema Overview

### Key Tables

**users** - System users with roles
- Admin: Full access
- Cashier: POS & Library
- Barista: Order status updates

**categories** & **items** - Menu structure
- Items have `station` field (barista/kitchen)
- Items have `status` field (available/sold_out)

**orders** & **order_items** - Order management
- Beeper number assignment (1-20)
- Payment status tracking
- Discount support

**discounts** - Discount types
- Percentage-based
- Active/inactive status

**library_seats** & **library_sessions** - Library management
- 24 seats (3 tables × 8 seats)
- Time tracking
- Fee calculation

---

## 🔒 Security Features

1. **JWT Authentication**
   - 8-hour token expiration
   - Secure secret key in .env
   - Token verification middleware

2. **Password Security**
   - bcrypt hashing with 10 salt rounds
   - Never store plain passwords

3. **Role-Based Access Control**
   - Middleware checks user roles
   - Endpoint-level protection

4. **CORS Configuration**
   - Restricted to frontend URL
   - Configurable origins

---

## 🚢 Deployment

### Environment Variables for Production
```env
PORT=3000
DB_HOST=your-production-db-host
DB_USER=your-db-user
DB_PASS=your-secure-password
DB_NAME=coffee_db
JWT_SECRET=your-very-secure-secret-key-min-32-chars
NODE_ENV=production
```

### Production Checklist
- [ ] Change JWT_SECRET to a strong random string
- [ ] Update database credentials
- [ ] Configure CORS for production domain
- [ ] Enable SSL/TLS for database connection
- [ ] Setup PM2 or similar process manager
- [ ] Configure reverse proxy (nginx)
- [ ] Setup database backups
- [ ] Enable error logging
- [ ] Setup monitoring (e.g., PM2 monitoring)

### Start with PM2
```bash
npm install -g pm2
pm2 start server.js --name "coffee-api"
pm2 save
pm2 startup
```

---

## 📝 Scripts

```bash
# Development (with auto-reload)
npm run dev

# Production
npm start

# Seed database
node config/seed_users.js
```

---

## 🐛 Troubleshooting

### Database Connection Issues
1. Check MySQL is running: `mysql -u root -p`
2. Verify credentials in `.env`
3. Ensure database exists: `SHOW DATABASES;`
4. Check user permissions: `SHOW GRANTS FOR 'root'@'localhost';`

### Port Already in Use
```bash
# Find process using port 3000
netstat -ano | findstr :3000

# Kill process (replace PID)
taskkill /PID <PID> /F
```

### JWT Token Invalid
- Token expires after 8 hours
- Login again to get new token
- Check JWT_SECRET matches between sessions

---

## 🤝 Contributing

1. Follow the existing code structure
2. Add JSDoc comments for new functions
3. Test all endpoints before committing
4. Update API_DOCUMENTATION.md for new routes

---

## 📄 License

This project is part of BSIT 3-C System Integration coursework.

---

## 📞 Support

For issues or questions:
- Check API_DOCUMENTATION.md
- Review console logs for errors
- Verify database connection
- Test endpoints with cURL

---

**Built with ☕ for Library Coffee + Study**
