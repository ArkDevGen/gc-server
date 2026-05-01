import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';
import {
  Package, AlertTriangle, ShoppingCart, Receipt, Hammer,
  DollarSign, Recycle, ArrowRight, FileText, ArrowLeftRight
} from 'lucide-react';

interface Stats {
  total_items: number;
  low_stock_items: number;
  active_builds: number;
  open_pos: number;
  unpaid_invoices: number;
  surplus_value: number;
  inventory_value: number;
  accounts_receivable: number;
  accounts_payable: number;
}

export default function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/reports/dashboard-stats')
      .then((res) => setStats(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const fmt = (n: number) => `$${n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

  const cards = [
    { label: 'Total Items', value: stats?.total_items ?? '--', icon: Package, color: 'bg-blue-500', link: '/inventory' },
    { label: 'Low Stock Alerts', value: stats?.low_stock_items ?? '--', icon: AlertTriangle, color: 'bg-amber-500', link: '/reports?tab=low-stock' },
    { label: 'Active Builds', value: stats?.active_builds ?? '--', icon: Hammer, color: 'bg-green-500', link: '/builds' },
    { label: 'Open POs', value: stats?.open_pos ?? '--', icon: ShoppingCart, color: 'bg-purple-500', link: '/purchase-orders' },
    { label: 'Unpaid Invoices', value: stats?.unpaid_invoices ?? '--', icon: Receipt, color: 'bg-red-500', link: '/invoices' },
    { label: 'Accounts Receivable', value: stats ? fmt(stats.accounts_receivable) : '--', icon: DollarSign, color: 'bg-emerald-500', link: '/reports?tab=accounts-receivable' },
    { label: 'Accounts Payable', value: stats ? fmt(stats.accounts_payable) : '--', icon: DollarSign, color: 'bg-rose-500', link: '/reports?tab=accounts-payable' },
    { label: 'Inventory Value', value: stats ? fmt(stats.inventory_value) : '--', icon: DollarSign, color: 'bg-cyan-500', link: '/reports?tab=inventory-value' },
    { label: 'Surplus Value', value: stats ? fmt(stats.surplus_value) : '--', icon: Recycle, color: 'bg-amber-600', link: '/surplus' },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Dashboard</h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <Link key={card.label} to={card.link}
              className="bg-white rounded-xl border p-5 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-3">
                <div className={`w-10 h-10 rounded-lg ${card.color} text-white flex items-center justify-center`}>
                  <Icon size={20} />
                </div>
              </div>
              <p className="text-2xl font-bold text-gray-900">{loading ? '...' : card.value}</p>
              <p className="text-sm text-gray-500 mt-1">{card.label}</p>
            </Link>
          );
        })}
      </div>

      <div className="bg-white rounded-xl border p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {[
            { to: '/quotes?new=1', icon: FileText, label: 'Create Quote' },
            { to: '/inventory', icon: Package, label: 'Manage Inventory' },
            { to: '/builds', icon: Hammer, label: 'View Builds' },
            { to: '/transfers', icon: ArrowLeftRight, label: 'Transfer Inventory' },
            { to: '/surplus', icon: Recycle, label: 'View Surplus' },
            { to: '/reports', icon: DollarSign, label: 'View Reports' },
          ].map((action) => (
            <Link key={action.to} to={action.to}
              className="flex items-center justify-between p-4 rounded-lg border hover:bg-gray-50 transition-colors">
              <div className="flex items-center gap-3">
                <action.icon size={18} className="text-primary-600" />
                <span className="font-medium">{action.label}</span>
              </div>
              <ArrowRight size={16} className="text-gray-400" />
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
