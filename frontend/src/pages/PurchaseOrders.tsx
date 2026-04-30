import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';
import { ShoppingCart } from 'lucide-react';
import Pagination from '../components/ui/Pagination';
import FilterBar from '../components/ui/FilterBar';
import SortHeader, { SortDir, toggleSort } from '../components/ui/SortHeader';

const statusColors: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700',
  pending: 'bg-blue-100 text-blue-700',
  sent_to_qbo: 'bg-purple-100 text-purple-700',
  partially_received: 'bg-amber-100 text-amber-700',
  received: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
};

export default function PurchaseOrders() {
  const [pos, setPOs] = useState<any[]>([]);
  const [vendors, setVendors] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, limit: 25, total: 0, totalPages: 0 });
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [vendorFilter, setVendorFilter] = useState('');
  const [locationFilter, setLocationFilter] = useState('');
  const [sortBy, setSortBy] = useState('created_at');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const fetchPOs = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const params: any = { page, limit: 25, sort_by: sortBy, sort_dir: sortDir };
      if (search) params.search = search;
      if (statusFilter) params.status = statusFilter;
      if (vendorFilter) params.vendor_id = vendorFilter;
      if (locationFilter) params.location_id = locationFilter;
      const res = await api.get('/purchase-orders', { params });
      setPOs(res.data.data);
      setPagination(res.data.pagination);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, [search, statusFilter, vendorFilter, locationFilter, sortBy, sortDir]);

  useEffect(() => { fetchPOs(); }, [statusFilter, vendorFilter, locationFilter, sortBy, sortDir]);

  useEffect(() => {
    Promise.all([
      api.get('/vendors'),
      api.get('/items/locations/list'),
    ]).then(([v, l]) => { setVendors(v.data); setLocations(l.data); }).catch(() => {});
  }, []);

  const hasFilters = !!(statusFilter || vendorFilter || locationFilter || search);
  const clearFilters = () => { setSearch(''); setStatusFilter(''); setVendorFilter(''); setLocationFilter(''); };
  const onToggleSort = (col: string) => toggleSort(col, sortBy, sortDir, setSortBy, setSortDir);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Purchase Orders</h1>
      </div>

      <FilterBar
        search={search}
        onSearchChange={setSearch}
        onSearchSubmit={() => fetchPOs(1)}
        searchPlaceholder="Search by PO number or vendor name..."
        hasFilters={hasFilters}
        onClearFilters={clearFilters}
      >
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-1.5 border rounded-lg text-sm bg-white">
          <option value="">All Statuses</option>
          <option value="draft">Draft</option>
          <option value="pending">Pending</option>
          <option value="sent_to_qbo">Sent to QBO</option>
          <option value="partially_received">Partially Received</option>
          <option value="received">Received</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <select value={vendorFilter} onChange={(e) => setVendorFilter(e.target.value)}
          className="px-3 py-1.5 border rounded-lg text-sm bg-white">
          <option value="">All Vendors</option>
          {vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
        </select>
        <select value={locationFilter} onChange={(e) => setLocationFilter(e.target.value)}
          className="px-3 py-1.5 border rounded-lg text-sm bg-white">
          <option value="">All Locations</option>
          {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
        </select>
      </FilterBar>

      <div className="bg-white rounded-xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b">
              <SortHeader col="po_number" label="PO #" sortBy={sortBy} sortDir={sortDir} onToggle={onToggleSort} />
              <SortHeader col="vendor" label="Vendor" sortBy={sortBy} sortDir={sortDir} onToggle={onToggleSort} />
              <SortHeader col="location" label="Location" sortBy={sortBy} sortDir={sortDir} onToggle={onToggleSort} />
              <SortHeader col="date" label="Date" sortBy={sortBy} sortDir={sortDir} onToggle={onToggleSort} />
              <SortHeader col="total" label="Total" sortBy={sortBy} sortDir={sortDir} onToggle={onToggleSort} align="right" />
              <SortHeader col="status" label="Status" sortBy={sortBy} sortDir={sortDir} onToggle={onToggleSort} align="center" />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-500">Loading...</td></tr>
            ) : pos.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                <ShoppingCart size={32} className="mx-auto mb-2 text-gray-300" />
                No purchase orders found
              </td></tr>
            ) : pos.map((po) => (
              <tr key={po.id} className="border-b hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-primary-600">{po.po_number}</td>
                <td className="px-4 py-3">{po.vendor_name}</td>
                <td className="px-4 py-3">{po.location_name}</td>
                <td className="px-4 py-3 text-gray-500">{new Date(po.order_date).toLocaleDateString()}</td>
                <td className="px-4 py-3 text-right font-mono">${parseFloat(po.total).toFixed(2)}</td>
                <td className="px-4 py-3 text-center">
                  <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[po.status] || ''}`}>
                    {po.status.replace(/_/g, ' ')}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <Pagination page={pagination.page} totalPages={pagination.totalPages} total={pagination.total} limit={pagination.limit} onPageChange={(p) => fetchPOs(p)} />
      </div>
    </div>
  );
}
