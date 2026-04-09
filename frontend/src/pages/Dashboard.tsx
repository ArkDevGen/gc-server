import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';
import { Package, AlertTriangle, ShoppingCart, Receipt, Hammer, ArrowRight } from 'lucide-react';

interface DashboardStats {
  totalItems: number;
  lowStockItems: number;
}

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats>({ totalItems: 0, lowStockItems: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/items', { params: { limit: 1 } }),
      api.get('/items', { params: { limit: 1, low_stock: true } }),
    ])
      .then(([allRes, lowRes]) => {
        setStats({
          totalItems: allRes.data.pagination.total,
          lowStockItems: lowRes.data.pagination.total,
        });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const cards = [
    {
      label: 'Total Items',
      value: stats.totalItems,
      icon: Package,
      color: 'bg-blue-500',
      link: '/inventory',
    },
    {
      label: 'Low Stock Alerts',
      value: stats.lowStockItems,
      icon: AlertTriangle,
      color: 'bg-amber-500',
      link: '/inventory?low_stock=true',
    },
    {
      label: 'Purchase Orders',
      value: '--',
      icon: ShoppingCart,
      color: 'bg-purple-500',
      link: '/purchase-orders',
      badge: 'Phase 2',
    },
    {
      label: 'Active Builds',
      value: '--',
      icon: Hammer,
      color: 'bg-green-500',
      link: '/builds',
      badge: 'Phase 3',
    },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Dashboard</h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <Link
              key={card.label}
              to={card.link}
              className="bg-white rounded-xl border p-5 hover:shadow-md transition-shadow"
            >
              <div className="flex items-center justify-between mb-3">
                <div className={`w-10 h-10 rounded-lg ${card.color} text-white flex items-center justify-center`}>
                  <Icon size={20} />
                </div>
                {card.badge && (
                  <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
                    {card.badge}
                  </span>
                )}
              </div>
              <p className="text-2xl font-bold text-gray-900">
                {loading ? '...' : card.value}
              </p>
              <p className="text-sm text-gray-500 mt-1">{card.label}</p>
            </Link>
          );
        })}
      </div>

      <div className="bg-white rounded-xl border p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <Link
            to="/inventory"
            className="flex items-center justify-between p-4 rounded-lg border hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <Package size={18} className="text-primary-600" />
              <span className="font-medium">Manage Inventory</span>
            </div>
            <ArrowRight size={16} className="text-gray-400" />
          </Link>
          <Link
            to="/settings"
            className="flex items-center justify-between p-4 rounded-lg border hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <Receipt size={18} className="text-primary-600" />
              <span className="font-medium">Settings</span>
            </div>
            <ArrowRight size={16} className="text-gray-400" />
          </Link>
        </div>
      </div>
    </div>
  );
}
