# 🗺️ Application Routes Map

## Frontend Routes (React Router)

```
Library Coffee + Study POS System
│
├── / (Login)
│   └── Login.jsx
│       - Username input
│       - Password input
│       - Login button
│       - JWT authentication
│
└── Protected Routes (After Login)
    │
    ├── /dashboard
    │   └── Dashboard.jsx
    │       - Order statistics (4 cards)
    │       - Order list with status
    │       - Popular orders sidebar
    │
    ├── /pos
    │   └── POS.jsx
    │       - Order queue list
    │       - Search by beeper
    │       - View order details
    │       - Payment modal
    │       - Discount selection
    │       - Cash tendered & change
    │
    ├── /ready-orders
    │   └── ReadyOrders.jsx
    │       - Ready orders grid
    │       - Complete order button
    │       - Auto-refresh
    │
    ├── /completed-orders
    │   └── CompletedOrders.jsx
    │       - Order history
    │       - Date filter
    │       - Reprint receipt
    │
    ├── /menu
    │   └── ManageMenu.jsx
    │       ├── View: Categories
    │       │   - Add category
    │       │   - Edit category
    │       │   - Delete category
    │       │   - View items button
    │       │
    │       └── View: Items (per category)
    │           - Add item
    │           - Edit item
    │           - Delete item
    │           - Station assignment
    │
    ├── /discounts
    │   └── Discounts.jsx
    │       - Discount list
    │       - Add discount
    │       - Edit discount
    │       - Delete discount
    │       - Status toggle
    │
    ├── /library
    │   └── Library.jsx
    │       - 24-seat grid (3 tables × 8 seats)
    │       - Check-in modal
    │       - Session details modal
    │       - Extend modal
    │       - Checkout modal
    │
    ├── /users
    │   └── Users.jsx
    │       - User list table
    │       - Search users
    │       - Add user
    │       - Edit user
    │       - Delete user
    │       - Reset password
    │
    ├── /reports
    │   └── Reports.jsx
    │       - Date filters
    │       - Summary cards
    │       - Sales trend chart
    │       - Category performance
    │       - Top products table
    │       - Export button
    │
    └── /config
        └── Config.jsx
            - System settings (placeholder)
```

## Navigation Flow

```
┌─────────────┐
│   LOGIN     │
│  (Public)   │
└──────┬──────┘
       │ Login Success
       ↓
┌─────────────────────────────┐
│      SIDEBAR LAYOUT         │
│  (Protected - All Pages)    │
├─────────────────────────────┤
│                             │
│  ┌──────────────────────┐   │
│  │   Dashboard (/)       │   │
│  └──────────────────────┘   │
│                             │
│  ┌──────────────────────┐   │
│  │   POS Section        │   │
│  ├──────────────────────┤   │
│  │  - Order Queue       │   │
│  │  - Ready Orders      │   │
│  │  - Completed Orders  │   │
│  └──────────────────────┘   │
│                             │
│  ┌──────────────────────┐   │
│  │  Menu Management     │   │
│  └──────────────────────┘   │
│                             │
│  ┌──────────────────────┐   │
│  │   Discounts          │   │
│  └──────────────────────┘   │
│                             │
│  ┌──────────────────────┐   │
│  │  Library Mgmt        │   │
│  └──────────────────────┘   │
│                             │
│  ┌──────────────────────┐   │
│  │   Users              │   │
│  └──────────────────────┘   │
│                             │
│  ┌──────────────────────┐   │
│  │   Reports            │   │
│  └──────────────────────┘   │
│                             │
│  ┌──────────────────────┐   │
│  │   Settings           │   │
│  └──────────────────────┘   │
│                             │
│  [ Logout Button ]          │
│                             │
└─────────────────────────────┘
```

## Modal Flow

```
┌─────────────┐
│   POS Page  │
└──────┬──────┘
       │ Click "View Details"
       ↓
┌──────────────────┐
│  Payment Modal   │
│  ┌────────────┐  │
│  │ Items List │  │
│  │ Discount ▼ │  │
│  │ Cash [___] │  │
│  │ Change: ₱_ │  │
│  │            │  │
│  │ [Confirm]  │  │
│  └────────────┘  │
└──────────────────┘
       │
       ↓ Print Receipts
       ↓
┌──────────────────┐
│ ✅ Payment Success│
└──────────────────┘

┌─────────────────┐
│   Menu Page     │
└────────┬────────┘
         │ Click "Add Category"
         ↓
┌──────────────────┐
│ Category Modal   │
│  ┌────────────┐  │
│  │ Name [___] │  │
│  │ Icon [___] │  │
│  │ Status ▼   │  │
│  │ [Save]     │  │
│  └────────────┘  │
└──────────────────┘

┌─────────────────┐
│  Library Page   │
└────────┬────────┘
         │ Click Green Seat
         ↓
┌──────────────────┐
│ Check-in Modal   │
│  ┌────────────┐  │
│  │ Table: 1   │  │
│  │ Seat: 2    │  │
│  │ ID: [____] │  │
│  │ Fee: ₱100  │  │
│  │ [Confirm]  │  │
│  └────────────┘  │
└──────────────────┘
         │
         ↓
┌──────────────────┐
│ Seat turns RED   │
└──────────────────┘
         │ Click Red Seat
         ↓
┌──────────────────┐
│ Session Details  │
│  ┌────────────┐  │
│  │ Time: 45m  │  │
│  │            │  │
│  │ [Extend]   │  │
│  │ [Checkout] │  │
│  └────────────┘  │
└──────────────────┘
```

## User Journey Examples

### 1. Cashier Processing Order
```
Login
  ↓
Dashboard (see overview)
  ↓
POS Order Queue
  ↓
Click Order #3
  ↓
Payment Modal
  ↓
Select Discount (optional)
  ↓
Enter Cash
  ↓
Confirm Payment
  ↓
✅ Print 3 Receipts
```

### 2. Admin Managing Menu
```
Login
  ↓
Menu Management
  ↓
View Categories
  ↓
Click "View Menu" (Coffee-Based)
  ↓
See All Items
  ↓
Click "Add New Item"
  ↓
Fill Form
  ↓
Save Item
  ↓
✅ Item Added
```

### 3. Cashier Library Check-in
```
Login
  ↓
Library Management
  ↓
See 24-Seat Grid
  ↓
Click Green Seat (Available)
  ↓
Check-in Modal
  ↓
Enter Customer ID
  ↓
Confirm
  ↓
✅ Seat turns Red
```

### 4. Admin Viewing Reports
```
Login
  ↓
Reports
  ↓
Select Date Range
  ↓
View Sales Data
  ↓
Check Top Products
  ↓
Export CSV (optional)
  ↓
✅ Report Downloaded
```

## Component Hierarchy

```
App.jsx
│
├── Login.jsx (No Layout)
│
└── Layout (Sidebar + Content)
    │
    ├── Sidebar.jsx
    │   ├── Logo
    │   ├── Navigation Menu
    │   ├── User Info
    │   └── Logout Button
    │
    └── Content Area (Routes)
        │
        ├── Dashboard.jsx
        ├── POS.jsx
        │   └── PaymentModal
        ├── ReadyOrders.jsx
        ├── CompletedOrders.jsx
        ├── ManageMenu.jsx
        │   ├── CategoryModal
        │   └── ItemModal
        ├── Discounts.jsx
        │   └── DiscountModal
        ├── Library.jsx
        │   ├── CheckinModal
        │   ├── ExtendOptionsModal
        │   └── CheckoutModal
        ├── Users.jsx
        │   └── UserModal
        ├── Reports.jsx
        └── Config.jsx
```

## State Management Flow

```
API Calls (api.js)
    ↓
Component State (useState)
    ↓
Render UI
    ↓
User Interaction
    ↓
Update State
    ↓
Re-render
    ↓
Socket.IO Event (optional)
    ↓
Update All Connected Clients
```

## Socket.IO Real-time Flow

```
Frontend                 Backend
    │                       │
    ├──────connect()───────→│
    │←─────connected────────┤
    │                       │
    │                       │
[Order Paid]               │
    ├────emit('order:new')→│
    │                       ├─[Broadcast]
    │←update:order_queue────┤
    │                       │
[All Clients Updated]      │
```

---

## File Locations Quick Reference

```
src/
├── pages/
│   ├── Login.jsx             → /login
│   ├── Dashboard.jsx         → /dashboard
│   ├── POS.jsx               → /pos
│   ├── ReadyOrders.jsx       → /ready-orders
│   ├── CompletedOrders.jsx   → /completed-orders
│   ├── ManageMenu.jsx        → /menu
│   ├── Discounts.jsx         → /discounts
│   ├── Library.jsx           → /library
│   ├── Users.jsx             → /users
│   ├── Reports.jsx           → /reports
│   └── Config.jsx            → /config
│
├── components/
│   └── Sidebar.jsx
│
├── services/
│   └── socketService.js
│
├── styles/
│   ├── sidebar.css
│   ├── login.css
│   ├── pos.css
│   ├── menu.css
│   ├── library.css
│   └── reports.css
│
├── api.js
└── App.jsx
```

---

**Use this map to understand the complete application structure!** 🗺️
