import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';

import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import BillingPage from './pages/BillingPage';
import SalesPage from './pages/SalesPage';
import SaleDetailPage from './pages/SaleDetailPage';
import CustomersPage from './pages/CustomersPage';
import CustomerDetailPage from './pages/CustomerDetailPage';
import SuppliersPage from './pages/SuppliersPage';
import SupplierDetailPage from './pages/SupplierDetailPage';
import PurchasesPage from './pages/PurchasesPage';
import PurchaseDetailPage from './pages/PurchaseDetailPage';
import InventoryPage from './pages/InventoryPage';
import PaymentsPage from './pages/PaymentsPage';
import TransactionsPage from './pages/TransactionsPage';
import ReportsPage from './pages/ReportsPage';
import FinancePage from './pages/FinancePage';
import SettingsPage from './pages/SettingsPage';
import ExpensePage from './pages/ExpensePage';

function AppRoutes() {
  const { user } = useAuth();
  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <LoginPage />} />
      <Route path="/" element={<ProtectedRoute><Layout><DashboardPage /></Layout></ProtectedRoute>} />
      <Route path="/billing" element={<ProtectedRoute><Layout><BillingPage /></Layout></ProtectedRoute>} />
      <Route path="/sales" element={<ProtectedRoute><Layout><SalesPage /></Layout></ProtectedRoute>} />
      <Route path="/sales/:id" element={<ProtectedRoute><Layout><SaleDetailPage /></Layout></ProtectedRoute>} />
      <Route path="/customers" element={<ProtectedRoute><Layout><CustomersPage /></Layout></ProtectedRoute>} />
      <Route path="/customers/:id" element={<ProtectedRoute><Layout><CustomerDetailPage /></Layout></ProtectedRoute>} />
      <Route path="/suppliers" element={<ProtectedRoute><Layout><SuppliersPage /></Layout></ProtectedRoute>} />
      <Route path="/suppliers/:id" element={<ProtectedRoute><Layout><SupplierDetailPage /></Layout></ProtectedRoute>} />
      <Route path="/purchases" element={<ProtectedRoute><Layout><PurchasesPage /></Layout></ProtectedRoute>} />
      <Route path="/purchases/:id" element={<ProtectedRoute><Layout><PurchaseDetailPage /></Layout></ProtectedRoute>} />
      <Route path="/inventory" element={<ProtectedRoute><Layout><InventoryPage /></Layout></ProtectedRoute>} />
      <Route path="/payments" element={<ProtectedRoute><Layout><PaymentsPage /></Layout></ProtectedRoute>} />
      <Route path="/transactions" element={<ProtectedRoute><Layout><TransactionsPage /></Layout></ProtectedRoute>} />
      <Route path="/reports" element={<ProtectedRoute><Layout><ReportsPage /></Layout></ProtectedRoute>} />
      <Route path="/expenses" element={<ProtectedRoute><Layout><ExpensePage /></Layout></ProtectedRoute>} />
      <Route path="/finance" element={<ProtectedRoute adminOnly><Layout><FinancePage /></Layout></ProtectedRoute>} />
      <Route path="/settings" element={<ProtectedRoute adminOnly><Layout><SettingsPage /></Layout></ProtectedRoute>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return <AppRoutes />;
}
