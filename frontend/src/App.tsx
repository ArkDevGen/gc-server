import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import AppLayout from './layouts/AppLayout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Inventory from './pages/Inventory';
import InventoryDetail from './pages/InventoryDetail';
import Settings from './pages/Settings';
import Placeholder from './pages/Placeholder';

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
        <Route path="/quotes" element={<Placeholder title="Quotes" phase="Phase 3" />} />
        <Route path="/builds" element={<Placeholder title="Builds" phase="Phase 3" />} />
        <Route path="/purchase-orders" element={<Placeholder title="Purchase Orders" phase="Phase 2" />} />
        <Route path="/invoices" element={<Placeholder title="Invoices" phase="Phase 2" />} />
        <Route path="/transfers" element={<Placeholder title="Transfers" phase="Phase 5" />} />
        <Route path="/surplus" element={<Placeholder title="Surplus" phase="Phase 5" />} />
        <Route path="/reports" element={<Placeholder title="Reports" phase="Phase 5" />} />
        <Route path="/settings" element={<Settings />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
