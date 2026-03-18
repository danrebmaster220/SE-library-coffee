import { Routes, Route, Navigate } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import CashierTopBar from './components/CashierTopBar';
import Dashboard from './pages/Dashboard';
import POS from './pages/POS';
import OrderQueue from './pages/OrderQueue';
import ReadyOrders from './pages/ReadyOrders';
import CompletedOrders from './pages/CompletedOrders';
import VoidTransactions from './pages/VoidTransactions';
import ManageMenu from './pages/ManageMenu';
import MenuCategories from './pages/MenuCategories';
import MenuItems from './pages/MenuItems';
import Customizations from './pages/Customizations';
import Discounts from './pages/Discounts';
import Beepers from './pages/Beepers';
import LibraryTables from './pages/LibraryTables';
import LibraryTransactions from './pages/LibraryTransactions';
import Users from './pages/Users';
import Reports from './pages/Reports';
import Config from './pages/Config';
import ActiveShifts from './pages/ActiveShifts';
import ShiftHistory from './pages/ShiftHistory';
import Login from './pages/Login';
import './App.css';
import './styles/global.css';
import './styles/cashier.css';

// Get user role from localStorage
function getUserRole() {
  const storedUser = localStorage.getItem('user');
  if (storedUser) {
    const userData = JSON.parse(storedUser);
    return userData.role?.toLowerCase() || 'cashier';
  }
  return null;
}

// Admin Layout - with Sidebar
function AdminLayout({ children }) {
  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content-wrapper">
        {children}
      </main>
    </div>
  );
}

// Admin Full Screen Layout - with Sidebar but full width content
function AdminFullScreenLayout({ children }) {
  return (
    <div className="app-layout fullscreen">
      <Sidebar />
      {children}
    </div>
  );
}

// Cashier Layout - with Top Bar, full width
function CashierLayout({ children }) {
  return (
    <div className="cashier-layout">
      <CashierTopBar />
      <main className="cashier-main-content">
        {children}
      </main>
    </div>
  );
}

// Protected Route Component - checks role and redirects if unauthorized
function ProtectedRoute({ children, allowedRoles = ['admin', 'cashier'] }) {
  const role = getUserRole();
  
  if (!role) {
    return <Navigate to="/login" replace />;
  }
  
  if (!allowedRoles.includes(role)) {
    return <Navigate to="/pos" replace />;
  }
  
  return children;
}

// Role-based Layout wrapper
function RoleBasedLayout({ children, fullScreen = false }) {
  const role = getUserRole();
  
  if (!role) {
    return <Navigate to="/login" replace />;
  }
  
  if (role === 'cashier') {
    return <CashierLayout>{children}</CashierLayout>;
  }
  
  // Admin role
  if (fullScreen) {
    return <AdminFullScreenLayout>{children}</AdminFullScreenLayout>;
  }
  return <AdminLayout>{children}</AdminLayout>;
}

function App() {
  return (
    <Routes>
      {/* Public Routes */}
      <Route path="/" element={<Login />} />
      <Route path="/login" element={<Login />} />
      
      {/* Shared Routes (Admin + Cashier) */}
      <Route path="/pos" element={
        <ProtectedRoute allowedRoles={['admin', 'cashier']}>
          <RoleBasedLayout fullScreen={true}><POS /></RoleBasedLayout>
        </ProtectedRoute>
      } />
      <Route path="/orders" element={
        <ProtectedRoute allowedRoles={['admin', 'cashier']}>
          <RoleBasedLayout><OrderQueue /></RoleBasedLayout>
        </ProtectedRoute>
      } />
      <Route path="/orders/ready" element={
        <ProtectedRoute allowedRoles={['admin', 'cashier']}>
          <RoleBasedLayout><ReadyOrders /></RoleBasedLayout>
        </ProtectedRoute>
      } />
      <Route path="/orders/completed" element={
        <ProtectedRoute allowedRoles={['admin', 'cashier']}>
          <RoleBasedLayout><CompletedOrders /></RoleBasedLayout>
        </ProtectedRoute>
      } />
      
      {/* Admin Only Routes */}
      <Route path="/dashboard" element={
        <ProtectedRoute allowedRoles={['admin']}>
          <AdminLayout><Dashboard /></AdminLayout>
        </ProtectedRoute>
      } />
      <Route path="/orders/void" element={
        <ProtectedRoute allowedRoles={['admin']}>
          <AdminLayout><VoidTransactions /></AdminLayout>
        </ProtectedRoute>
      } />
      <Route path="/menu" element={
        <ProtectedRoute allowedRoles={['admin']}>
          <AdminLayout><ManageMenu /></AdminLayout>
        </ProtectedRoute>
      } />
      <Route path="/menu/categories" element={
        <ProtectedRoute allowedRoles={['admin']}>
          <AdminLayout><MenuCategories /></AdminLayout>
        </ProtectedRoute>
      } />
      <Route path="/menu/items" element={
        <ProtectedRoute allowedRoles={['admin']}>
          <AdminLayout><MenuItems /></AdminLayout>
        </ProtectedRoute>
      } />
      <Route path="/menu/customizations" element={
        <ProtectedRoute allowedRoles={['admin']}>
          <AdminLayout><Customizations /></AdminLayout>
        </ProtectedRoute>
      } />
      <Route path="/discounts" element={
        <ProtectedRoute allowedRoles={['admin']}>
          <AdminLayout><Discounts /></AdminLayout>
        </ProtectedRoute>
      } />
      <Route path="/beepers" element={
        <ProtectedRoute allowedRoles={['admin']}>
          <AdminLayout><Beepers /></AdminLayout>
        </ProtectedRoute>
      } />
      <Route path="/library" element={<Navigate to="/library/transactions" replace />} />
      <Route path="/library/tables" element={
        <ProtectedRoute allowedRoles={['admin']}>
          <AdminLayout><LibraryTables /></AdminLayout>
        </ProtectedRoute>
      } />
      <Route path="/library/transactions" element={
        <ProtectedRoute allowedRoles={['admin', 'cashier']}>
          <RoleBasedLayout><LibraryTransactions /></RoleBasedLayout>
        </ProtectedRoute>
      } />
      <Route path="/users" element={
        <ProtectedRoute allowedRoles={['admin']}>
          <AdminLayout><Users /></AdminLayout>
        </ProtectedRoute>
      } />
      <Route path="/reports" element={
        <ProtectedRoute allowedRoles={['admin']}>
          <AdminLayout><Reports /></AdminLayout>
        </ProtectedRoute>
      } />
      <Route path="/config" element={
        <ProtectedRoute allowedRoles={['admin']}>
          <AdminLayout><Config /></AdminLayout>
        </ProtectedRoute>
      } />
      <Route path="/cash/active" element={
        <ProtectedRoute allowedRoles={['admin']}>
          <AdminLayout><ActiveShifts /></AdminLayout>
        </ProtectedRoute>
      } />
      <Route path="/cash/history" element={
        <ProtectedRoute allowedRoles={['admin']}>
          <AdminLayout><ShiftHistory /></AdminLayout>
        </ProtectedRoute>
      } />
    </Routes>
  );
}

export default App;