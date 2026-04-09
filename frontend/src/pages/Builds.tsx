import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';
import { Plus, Hammer } from 'lucide-react';

const statusColors: Record<string, string> = {
  planning: 'bg-gray-100 text-gray-700',
  active: 'bg-blue-100 text-blue-700',
  on_hold: 'bg-amber-100 text-amber-700',
  complete: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
};

export default function Builds() {
  const [builds, setBuilds] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/builds').then((res) => setBuilds(res.data)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Builds</h1>
      </div>

      <div className="bg-white rounded-xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b">
              <th className="text-left px-4 py-3 font-medium text-gray-600">Build #</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Name</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Customer</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Location</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Foreman</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Budget</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Actual</th>
              <th className="text-center px-4 py-3 font-medium text-gray-600">Status</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-500">Loading...</td></tr>
            ) : builds.length === 0 ? (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                <Hammer size={32} className="mx-auto mb-2 text-gray-300" />
                No builds yet. Create a quote and convert it to a build.
              </td></tr>
            ) : builds.map((b) => (
              <tr key={b.id} className="border-b hover:bg-gray-50">
                <td className="px-4 py-3">
                  <Link to={`/builds/${b.id}`} className="font-medium text-primary-600 hover:text-primary-700">
                    {b.build_number}
                  </Link>
                </td>
                <td className="px-4 py-3 font-medium">{b.name}</td>
                <td className="px-4 py-3">{b.customer_name || '--'}</td>
                <td className="px-4 py-3">{b.location_name}</td>
                <td className="px-4 py-3">{b.foreman_name || '--'}</td>
                <td className="px-4 py-3 text-right font-mono">${parseFloat(b.budget_total).toFixed(2)}</td>
                <td className="px-4 py-3 text-right font-mono">
                  {parseFloat(b.actual_total) > 0 ? `$${parseFloat(b.actual_total).toFixed(2)}` : '--'}
                </td>
                <td className="px-4 py-3 text-center">
                  <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[b.status] || ''}`}>
                    {b.status.replace('_', ' ')}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
