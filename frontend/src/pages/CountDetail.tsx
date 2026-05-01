import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../api/client';
import { ArrowLeft, Play, Send, CheckCircle } from 'lucide-react';
import { useToast } from '../components/ui/Toast';
import { useConfirm } from '../components/ui/ConfirmDialog';

export default function CountDetail() {
  const { id } = useParams<{ id: string }>();
  const toast = useToast();
  const confirm = useConfirm();
  const [count, setCount] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState('');
  const [editedLines, setEditedLines] = useState<Record<string, number>>({});

  const fetchCount = () => {
    api.get(`/counts/${id}`).then((res) => setCount(res.data)).catch(() => {}).finally(() => setLoading(false));
  };
  useEffect(() => { fetchCount(); }, [id]);

  const handleStart = async () => {
    setActionLoading('start');
    try { await api.post(`/counts/${id}/start`); toast.success('Count started.'); fetchCount(); }
    catch (err: any) { toast.error(err.response?.data?.error || 'Failed to start count'); }
    finally { setActionLoading(''); }
  };

  const handleSaveCounts = async () => {
    const lines = Object.entries(editedLines).map(([line_id, counted_qty]) => ({ line_id, counted_qty }));
    if (lines.length === 0) { toast.warning('Enter a count on at least one line before saving.'); return; }
    setActionLoading('save');
    try {
      await api.post(`/counts/${id}/record`, { lines });
      toast.success(`Saved ${lines.length} count${lines.length === 1 ? '' : 's'}.`);
      setEditedLines({});
      fetchCount();
    } catch (err: any) { toast.error(err.response?.data?.error || 'Failed to save counts'); }
    finally { setActionLoading(''); }
  };

  const handleComplete = async () => {
    setActionLoading('complete');
    try { await api.post(`/counts/${id}/complete`); toast.success('Count submitted for review.'); fetchCount(); }
    catch (err: any) { toast.error(err.response?.data?.error || 'Failed to complete count'); }
    finally { setActionLoading(''); }
  };

  const handleApply = async () => {
    const ok = await confirm({
      title: 'Apply all variances to inventory?',
      message: 'This adjusts stock levels at the counted location to match what you recorded. Each variance creates an audit row with reason "physical_count".',
      confirmText: 'Apply',
    });
    if (!ok) return;
    setActionLoading('apply');
    try {
      const res = await api.post(`/counts/${id}/apply`);
      toast.success(`Applied: ${res.data.adjustments_made} adjustment${res.data.adjustments_made === 1 ? '' : 's'} made.`);
      fetchCount();
    } catch (err: any) { toast.error(err.response?.data?.error || 'Failed to apply'); }
    finally { setActionLoading(''); }
  };

  if (loading) return <div className="text-center py-12 text-gray-500">Loading...</div>;
  if (!count) return <div className="text-center py-12 text-gray-500">Count not found</div>;

  const progress = count.total_items > 0 ? Math.round((count.items_counted / count.total_items) * 100) : 0;

  return (
    <div>
      <Link to="/counts" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4">
        <ArrowLeft size={14} /> Back to Physical Counts
      </Link>

      <div className="bg-white rounded-xl border p-6 mb-4">
        <div className="flex flex-col sm:flex-row justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-gray-900">{count.count_number}</h1>
            <div className="flex flex-wrap gap-3 mt-2 text-sm text-gray-500">
              <span>{count.location_name}</span>
              {count.assigned_to_name && <span>Assigned: {count.assigned_to_name}</span>}
              {count.description && <span>{count.description}</span>}
            </div>
          </div>
          <div className="flex gap-2">
            {count.status === 'draft' && (
              <button onClick={handleStart} disabled={!!actionLoading}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                <Play size={14} /> Start Counting
              </button>
            )}
            {count.status === 'in_progress' && (
              <>
                <button onClick={handleSaveCounts} disabled={!!actionLoading || Object.keys(editedLines).length === 0}
                  className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50">
                  Save Counts ({Object.keys(editedLines).length})
                </button>
                <button onClick={handleComplete} disabled={!!actionLoading}
                  className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700 disabled:opacity-50">
                  <Send size={14} /> Submit for Review
                </button>
              </>
            )}
            {count.status === 'review' && (
              <button onClick={handleApply} disabled={!!actionLoading}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50">
                <CheckCircle size={14} /> Apply to Inventory
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-4 gap-4 mt-6 pt-6 border-t">
          <div>
            <p className="text-sm text-gray-500">Total Items</p>
            <p className="text-2xl font-bold">{count.total_items}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Counted</p>
            <p className="text-2xl font-bold text-blue-600">{count.items_counted}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Matched</p>
            <p className="text-2xl font-bold text-green-600">{count.items_matched}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Variances</p>
            <p className="text-2xl font-bold text-amber-600">{count.items_variance}</p>
          </div>
        </div>

        <div className="mt-4">
          <div className="flex justify-between text-xs text-gray-500 mb-1">
            <span>Progress</span>
            <span>{progress}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2.5">
            <div className="bg-primary-600 h-2.5 rounded-full transition-all" style={{ width: `${progress}%` }} />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b">
              <th className="text-left px-4 py-3 font-medium text-gray-600">Bin</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Item</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">SKU</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Expected</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Counted</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Variance</th>
              <th className="text-center px-4 py-3 font-medium text-gray-600">Status</th>
            </tr>
          </thead>
          <tbody>
            {!count.lines?.length ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-500">No items to count</td></tr>
            ) : count.lines.map((line: any) => {
              const variance = line.variance !== null ? parseFloat(line.variance) : null;
              return (
                <tr key={line.id} className={`border-b last:border-0 ${line.is_counted && variance !== 0 ? 'bg-amber-50' : ''}`}>
                  <td className="px-4 py-3 font-mono text-xs text-gray-500">{line.bin_label || '--'}</td>
                  <td className="px-4 py-3 font-medium">{line.item_name}</td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-500">{line.sku || '--'}</td>
                  <td className="px-4 py-3 text-right font-mono">{parseFloat(line.expected_qty).toLocaleString()}</td>
                  <td className="px-4 py-3 text-right">
                    {count.status === 'in_progress' ? (
                      <input type="number" step="0.01" min="0"
                        defaultValue={line.counted_qty !== null ? parseFloat(line.counted_qty) : ''}
                        placeholder="--"
                        onChange={(e) => {
                          const val = parseFloat(e.target.value);
                          if (!isNaN(val)) {
                            setEditedLines((prev) => ({ ...prev, [line.id]: val }));
                          }
                        }}
                        className="w-24 px-2 py-1 border rounded text-sm text-right font-mono" />
                    ) : (
                      <span className="font-mono">{line.counted_qty !== null ? parseFloat(line.counted_qty).toLocaleString() : '--'}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {variance !== null ? (
                      <span className={`font-mono font-bold ${variance === 0 ? 'text-green-600' : variance > 0 ? 'text-blue-600' : 'text-red-600'}`}>
                        {variance > 0 ? '+' : ''}{variance.toLocaleString()}
                      </span>
                    ) : '--'}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {line.is_counted ? (
                      variance === 0 ? <span className="text-xs text-green-600 font-medium">Match</span>
                        : <span className="text-xs text-amber-600 font-medium">Variance</span>
                    ) : <span className="text-xs text-gray-400">Pending</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
