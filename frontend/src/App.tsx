import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import AppLayout from './layouts/AppLayout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Inventory from './pages/Inventory';
import InventoryDetail from './pages/InventoryDetail';
import Quotes from './pages/Quotes';
import Builds from './pages/Builds';
import BuildDetail from './pages/BuildDetail';
import PurchaseOrders from './pages/PurchaseOrders';
import Invoices from './pages/Invoices';
import Transfers from './pages/Transfers';
import Surplus from './pages/Surplus';
import Reports from './pages/Reports';
import PhysicalCounts from './pages/PhysicalCounts';
import CountDetail from './pages/CountDetail';
import QuoteDetail from './pages/QuoteDetail';
import Features from './pages/Features';
import Settings from './pages/Settings';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { token, isLoading } = useAuth();
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
      </div>
    );
  }
  return token ? <>{children}</> : <Navigate to="/login" replace />;
}

export default function App() {
  const { token, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
      </div>
    );
  }

  return (
    <Routes>
      <Route
        path="/login"
        element={token ? <Navigate to="/" replace /> : <Login />}
      />
      <Route
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/" element={<Dashboard />} />
        <Route path="/inventory" element={<Inventory />} />
        <Route path="/inventory/:id" element={<InventoryDetail />} />
        <Route path="/quotes" element={<Quotes />} />
        <Route path="/quotes/:id" element={<QuoteDetail />} />
        <Route path="/builds" element={<Builds />} />
        <Route path="/builds/:id" element={<BuildDetail />} />
        <Route path="/purchase-orders" element={<PurchaseOrders />} />
        <Route path="/invoices" element={<Invoices />} />
        <Route path="/transfers" element={<Transfers />} />
        <Route path="/counts" element={<PhysicalCounts />} />
        <Route path="/counts/:id" element={<CountDetail />} />
        <Route path="/surplus" element={<Surplus />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/features" element={<Features />} />
        <Route path="/settings" element={<Settings />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
