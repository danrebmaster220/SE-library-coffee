# Library Coffee + Study - POS Web System

## 🎯 Overview
A comprehensive Point of Sale (POS) system for a café with integrated library management. Built with React.js, Node.js/Express, MySQL, and Socket.IO for real-time updates.

## ✨ Features

### 🛒 POS & Order Management
- **Order Queue**: Real-time order tracking with beeper system (1-20)
- **Payment Processing**: Cash payment with discount support (PWD, Senior, Employee)
- **Order Status Tracking**: Pending → Preparing → Ready → Completed
- **Multi-Print System**: Customer receipt, Barista ticket, Kitchen ticket

### 📋 Menu Management
- **Categories**: Add, edit, delete menu categories
- **Items**: Full CRUD operations with station assignment (Barista/Kitchen)
- **Add-ons**: Manage optional item add-ons
- **Availability Toggle**: Mark items as available/sold out

### 📚 Library Management
- **24-Seat Grid**: 3 tables × 8 seats with visual availability (Green/Red)
- **Check-in System**: Customer ID tracking
- **Timer Tracking**: Automatic time monitoring
- **Extension System**: +30 mins (₱50) or +60 mins (₱100)
- **Checkout with Receipt**: Automatic fee calculation

### 🎫 Discount Management
- **Flexible Discounts**: Senior Citizen, PWD, Employee, custom
- **Percentage-based**: Configurable discount rates
- **Active/Inactive Toggle**: Enable or disable discounts

### 👥 User Management
- **Role-Based Access**: Admin, Cashier, Barista
- **User CRUD**: Add, edit, deactivate users
- **Password Management**: Reset user passwords

### 📊 Reports & Analytics
- **Sales Reports**: Daily, Weekly, Monthly
- **Top Products**: Best-selling items tracking
- **Category Performance**: Sales by category
- **Export to CSV**: Download reports

## 🚀 Getting Started

### Installation
```bash
npm install
npm run dev
```

### Build for Production
```bash
npm run build
```

## 🎨 Design System

### Color Palette
- **Coffee Dark**: `#3e2723`
- **Coffee Light**: `#8d6e63`
- **Cream**: `#f5f0e8`
- **Caramel**: `#a1887f`

### Typography
- **Headings**: Playfair Display
- **Body**: Poppins

## 🔐 Default Login
- **Admin**: `admin` / `admin123`
- **Cashier**: `cashier` / `cashier123`

---
**Developed for BSIT 3-C System Project**
