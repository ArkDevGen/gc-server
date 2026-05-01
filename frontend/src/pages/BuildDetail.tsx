import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../api/client';
import { ArrowLeft, Play, ClipboardCheck, CheckCircle } from 'lucide-react';
import { useToast } from '../components/ui/Toast';
import { useConfirm } from '../components/ui/ConfirmDialog';

const statusColors: Record<string, string> = {
  planned: 'bg-gray-100 text-gray-700',
  allocated: 'bg-blue-100 text-blue-700',
  used: 'bg-green-100 text-green-700',
  returned_surplus: 'bg-amber-100 text-amber-700',
};

export default function BuildDetail() {
  const { id } = useParams<{ id: string }>();
  const toast = useToast();
  const confirm = useConfirm();
  const [build, setBuild] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState('');
  const [showUsage, setShowUsage] = useState(false);

  const fetchBuild = async () => {
    try {
      const res = await api.get(`/builds/${id}`);
      setBuild(res.data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchBuild(); }, [id]);

  const handleAllocate = async () => {
    setActionLoading('allocate');
    try {
      await api.post(`/builds/${id}/allocate`);
      await fetchBuild();
      toast.success('Materials allocated. Build is now active.');
    } catch (err: any) { toast.error(err.response?.data?.error || 'Failed to allocate materials'); }
    finally { setActionLoading(''); }
  };

  const handleCloseOut = async () => {
    const ok = await confirm({
      title: 'Close out build?',
      message: 'Material leftovers (allocated minus used) will be captured into the surplus pool. The build status will flip to Complete and can no longer be edited.',
      confirmText: 'Close Out',
    });
    if (!ok) return;
    setActionLoading('closeout');
    try {
      const res = await api.post(`/builds/${id}/close-out`, {});
      await fetchBuild();
      toast.success(`Build closed. Actual: $${res.data.actual_total}. ${res.data.surplus_items} surplus item${res.data.surplus_items === 1 ? '' : 's'} captured.`);
    } catch (err: any) { toast.error(err.response?.data?.error || 'Failed to close out'); }
    finally { setActionLoading(''); }
  };

  if (loading) return <div className="text-center py-12 text-gray-500">Loading...</div>;
  if (!build) return <div className="text-center py-12 text-gray-500">Build not found</div>;

  return (
    <div>
      <Link to="/builds" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4">
        <ArrowLeft size={14} /> Back to Builds
      </Link>

      {/* Header */}
      <div className="bg-white rounded-xl border p-6 mb-4">
        <div className="flex flex-col sm:flex-row justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-gray-900">{build.name}</h1>
            <div className="flex flex-wrap gap-3 mt-2 text-sm text-gray-500">
              <span className="font-mono">{build.build_number}</span>
              {build.customer_name && <span>{build.customer_name}</span>}
              <span>{build.location_name}</span>
              {build.foreman_name && <span>Foreman: {build.foreman_name}</span>}
              <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium
                ${build.status === 'active' ? 'bg-blue-100 text-blue-700' :
                  build.status === 'complete' ? 'bg-green-100 text-green-700' :
                  'bg-gray-100 text-gray-700'}`}>
                {build.status.replace('_', ' ')}
              </span>
            </div>
          </div>
          <div className="flex gap-2">
            {build.status === 'planning' && (
              <button onClick={handleAllocate} disabled={!!actionLoading}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium disabled:opacity-50">
                <Play size={14} /> {actionLoading === 'allocate' ? 'Allocating...' : 'Allocate & Start'}
              </button>
            )}
            {build.status === 'active' && (
              <>
                <button onClick={() => setShowUsage(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm font-medium">
                  <ClipboardCheck size={14} /> Record Usage
                </button>
                <button onClick={handleCloseOut} disabled={!!actionLoading}
                  className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 text-sm font-medium disabled:opacity-50">
                  <CheckCircle size={14} /> {actionLoading === 'closeout' ? 'Closing...' : 'Close Out'}
                </button>
              </>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-6 border-t">
          <div>
            <p className="text-sm text-gray-500">Budget</p>
            <p className="text-2xl font-bold">${parseFloat(build.budget_total).toFixed(2)}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Actual</p>
            <p className="text-2xl font-bold">${(build.actual_total_calc || 0).toFixed(2)}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Variance</p>
            <p className={`text-2xl font-bold ${(build.variance || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              ${(build.variance || 0).toFixed(2)}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Surplus Value</p>
            <p className="text-2xl font-bold text-amber-600">${(build.surplus_value || 0).toFixed(2)}</p>
          </div>
        </div>
      </div>

      {/* Materials */}
      <h2 className="text-lg font-semibold text-gray-900 mb-3">Materials</h2>
      <div className="bg-white rounded-xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b">
              <th className="text-left px-4 py-3 font-medium text-gray-600">Item</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Source</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Planned</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Allocated</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Used</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Surplus</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Unit Cost</th>
              <th className="text-center px-4 py-3 font-medium text-gray-600">Status</th>
            </tr>
          </thead>
          <tbody>
            {(!build.materials || build.materials.length === 0) ? (
              <tr><td colSpan={8} className="px-4 py-6 text-center text-gray-500">No materials</td></tr>
            ) : build.materials.map((m: any) => (
              <tr key={m.id} className="border-b last:border-0">
                <td className="px-4 py-3">
                  <span className="font-medium">{m.item_name}</span>
                  {m.item_sku && <span className="text-xs text-gray-400 ml-2">{m.item_sku}</span>}
                </td>
                <td className="px-4 py-3 text-gray-600">{m.source_location_name}</td>
                <td className="px-4 py-3 text-right font-mono">{parseFloat(m.qty_planned).toLocaleString()}</td>
                <td className="px-4 py-3 text-right font-mono">{parseFloat(m.qty_allocated).toLocaleString()}</td>
                <td className="px-4 py-3 text-right font-mono">{parseFloat(m.qty_used).toLocaleString()}</td>
                <td className="px-4 py-3 text-right font-mono text-amber-600">
                  {parseFloat(m.qty_surplus) > 0 ? parseFloat(m.qty_surplus).toLocaleString() : '--'}
                </td>
                <td className="px-4 py-3 text-right font-mono">${parseFloat(m.unit_cost).toFixed(2)}</td>
                <td className="px-4 py-3 text-center">
                  <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[m.status] || ''}`}>
                    {m.status.replace('_', ' ')}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Record Usage Modal */}
      {showUsage && (
        <RecordUsageModal
          buildId={build.id}
          materials={build.materials.filter((m: any) => m.status === 'allocated' || m.status === 'used')}
          onClose={() => setShowUsage(false)}
          onRecorded={() => { setShowUsage(false); fetchBuild(); }}
        />
      )}
    </div>
  );
}

function RecordUsageModal({ buildId, materials, onClose, onRecorded }: {
  buildId: string; materials: any[]; onClose: () => void; onRecorded: () => void;
}) {
  const toast = useToast();
  const [lines, setLines] = useState(
    materials.map((m: any) => ({ build_material_id: m.id, qty_used: 0, name: m.item_name, allocated: parseFloat(m.qty_allocated), used: parseFloat(m.qty_used) }))
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const toSubmit = lines.filter((l) => l.qty_used > 0);
    if (toSubmit.length === 0) { setError('Enter a usage amount on at least one line.'); return; }
    setSaving(true);
    setError('');
    try {
      await api.post(`/builds/${buildId}/record-usage`, {
        lines: toSubmit.map((l) => ({ build_material_id: l.build_material_id, qty_used: l.qty_used })),
      });
      toast.success(`Usage recorded for ${toSubmit.length} material${toSubmit.length === 1 ? '' : 's'}.`);
      onRecorded();
    } catch (err: any) { setError(err.response?.data?.error || 'Failed to record usage'); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">Record Material Usage</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 space-y-3">
          {error && <div className="bg-red-50 text-red-700 text-sm px-3 py-2 rounded-lg">{error}</div>}
          {lines.map((line, idx) => (
            <div key={line.build_material_id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
              <div className="flex-1">
                <p className="text-sm font-medium">{line.name}</p>
                <p className="text-xs text-gray-500">Allocated: {line.allocated} | Already used: {line.used}</p>
              </div>
              <input type="number" step="0.01" min="0" max={line.allocated - line.used}
                value={line.qty_used || ''} placeholder="0"
                onChange={(e) => {
                  const updated = [...lines];
                  updated[idx] = { ...updated[idx], qty_used: parseFloat(e.target.value) || 0 };
                  setLines(updated);
                }}
                className="w-24 px-2 py-1.5 border rounded text-sm text-right" />
            </div>
          ))}
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 border rounded-lg hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={saving} className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-50">
              {saving ? 'Saving...' : 'Record Usage'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
