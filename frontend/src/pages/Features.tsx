import {
  Scan, Truck, Bell, Activity, DollarSign, TrendingUp,
  CreditCard, Wrench, Camera, Shield, Globe, Users,
  CheckCircle, ShoppingCart, Lock, Clock
} from 'lucide-react';

const activeFeatures = [
  { icon: CheckCircle, label: 'Inventory Management', desc: 'Multi-location tracking with bin locations and real-time counts' },
  { icon: CheckCircle, label: 'Quote Templates', desc: 'Reusable templates for fast quote creation' },
  { icon: CheckCircle, label: 'Build Tracker', desc: 'Material allocation, usage recording, surplus capture on close-out' },
  { icon: CheckCircle, label: 'Surplus Management', desc: 'Track leftover materials for reuse on future builds' },
  { icon: CheckCircle, label: 'Purchase Orders', desc: 'Create POs with line items, receive inventory with audit trail' },
  { icon: CheckCircle, label: 'Invoices', desc: 'Full line-item invoices with email tracking' },
  { icon: CheckCircle, label: 'Transfers', desc: 'Move inventory between warehouse, stores, and build sites' },
  { icon: CheckCircle, label: 'Physical Counts', desc: 'Structured cycle count workflow with variance tracking' },
  { icon: CheckCircle, label: 'Auto Reorder Suggestions', desc: 'AI-powered reorder points based on usage history' },
  { icon: CheckCircle, label: 'PO Auto-Generation', desc: 'Automatically create POs for low-stock items' },
  { icon: CheckCircle, label: 'Accounts Receivable/Payable', desc: 'Dashboard views with aging buckets' },
  { icon: CheckCircle, label: 'Reports', desc: 'Inventory value, low stock, build variance, surplus aging' },
  { icon: CheckCircle, label: 'CSV Import', desc: 'One-time data migration from existing systems' },
];

const premiumFeatures = [
  {
    icon: Scan,
    label: 'Barcode / QR Scanning',
    desc: 'Scan items with your phone camera for instant lookup, stock adjustments, and physical counts. Generate barcodes for bin locations.',
    category: 'Operations',
  },
  {
    icon: Users,
    label: 'Customer Portal',
    desc: 'Unique link for customers to view quotes, approve them, and check invoice status. No login required.',
    category: 'Customer Experience',
  },
  {
    icon: Truck,
    label: 'Delivery / Dispatch Tracker',
    desc: 'Track deliveries to job sites: what\'s being sent, who\'s driving, when it left, estimated arrival. Foremen know what\'s coming.',
    category: 'Operations',
  },
  {
    icon: Bell,
    label: 'Notifications & Alerts',
    desc: 'Email and push notifications for low stock, PO received, invoice viewed, build close-out, transfer arriving. Never miss a beat.',
    category: 'Productivity',
  },
  {
    icon: Activity,
    label: 'Activity Feed',
    desc: 'Live feed of everything happening across the system. See adjustments, quotes, builds, and transfers in real time.',
    category: 'Visibility',
  },
  {
    icon: DollarSign,
    label: 'Vendor Price Comparison',
    desc: 'Track pricing from multiple vendors per item over time. See who has the best price when creating POs.',
    category: 'Cost Savings',
  },
  {
    icon: TrendingUp,
    label: 'Seasonal Demand Forecasting',
    desc: 'Predict demand spikes based on historical usage patterns. Spring fencing season, fall harvest prep — plan ahead.',
    category: 'Intelligence',
  },
  {
    icon: DollarSign,
    label: 'Job Costing',
    desc: 'Full job cost breakdown: materials, labor, equipment, subcontractors. True profitability per build.',
    category: 'Financial',
  },
  {
    icon: CreditCard,
    label: 'Customer Credit Tracking',
    desc: 'Credit limits, payment history, and slow payer flags. Know who to extend credit to.',
    category: 'Financial',
  },
  {
    icon: Wrench,
    label: 'Equipment / Tool Checkout',
    desc: 'Track company tools and equipment checked out to crews. Know where everything is.',
    category: 'Operations',
  },
  {
    icon: Camera,
    label: 'Photo Attachments',
    desc: 'Attach photos to builds, surplus items, damage reports, and inventory items. Visual documentation.',
    category: 'Documentation',
  },
  {
    icon: Shield,
    label: 'Warranty Tracking',
    desc: 'Track warranties on items sold to customers. Get notified before warranties expire.',
    category: 'Customer Service',
  },
  {
    icon: Globe,
    label: 'Website Sales Channel',
    desc: 'Sync inventory and orders with your e-commerce site (Shopify, WooCommerce, etc.). Online orders auto-deduct stock and flow into the hub as invoices.',
    category: 'Sales Channels',
  },
  {
    icon: Clock,
    label: 'Time Tracking',
    desc: 'Crews clock in/out from their phones, tagged to a build or job site. Hours roll into job costing automatically and feed payroll-ready timesheets.',
    category: 'Workforce',
  },
];

const comingSoonFeatures = [
  {
    icon: Globe,
    label: 'QuickBooks Online Integration',
    desc: 'Push POs and invoices to QBO, sync customers/vendors, track email delivery status.',
    category: 'Integration',
  },
  {
    icon: ShoppingCart,
    label: 'Square POS Integration',
    desc: 'Real-time inventory sync with Square POS at store locations. Sales automatically deduct stock.',
    category: 'Integration',
  },
];

const premiumCategories = [...new Set(premiumFeatures.map((f) => f.category))];
const comingSoonCategories = [...new Set(comingSoonFeatures.map((f) => f.category))];

export default function Features() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Features</h1>
      <p className="text-gray-500 mb-8">Everything GC Business Hub can do today — plus integrations coming soon and premium features available on request.</p>

      {/* Active Features */}
      <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
        <CheckCircle size={20} className="text-green-600" /> Active Features
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-10">
        {activeFeatures.map((f) => (
          <div key={f.label} className="bg-white border border-green-200 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <f.icon size={18} className="text-green-600 mt-0.5 shrink-0" />
              <div>
                <p className="font-medium text-gray-900 text-sm">{f.label}</p>
                <p className="text-xs text-gray-500 mt-1">{f.desc}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Premium Features */}
      <h2 className="text-lg font-semibold text-gray-900 mb-2 flex items-center gap-2">
        <Lock size={20} className="text-amber-500" /> Premium Features Available
      </h2>
      <p className="text-sm text-gray-500 mb-4">Optional capabilities that can be added to your system — not on the roadmap by default, but ready to build when you are.</p>

      {premiumCategories.map((cat) => (
        <div key={cat} className="mb-6">
          <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-3">{cat}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {premiumFeatures.filter((f) => f.category === cat).map((f) => (
              <div key={f.label} className="bg-white border border-dashed border-gray-300 rounded-xl p-4 opacity-80">
                <div className="flex items-start gap-3">
                  <f.icon size={18} className="text-amber-500 mt-0.5 shrink-0" />
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-gray-900 text-sm">{f.label}</p>
                      <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-medium">Premium</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">{f.desc}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* Coming Soon */}
      <h2 className="text-lg font-semibold text-gray-900 mb-2 mt-4 flex items-center gap-2">
        <Lock size={20} className="text-blue-500" /> Coming Soon
      </h2>
      <p className="text-sm text-gray-500 mb-4">Integrations actively on the roadmap — these will be added to your system as part of the build.</p>

      {comingSoonCategories.map((cat) => (
        <div key={cat} className="mb-6">
          <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-3">{cat}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {comingSoonFeatures.filter((f) => f.category === cat).map((f) => (
              <div key={f.label} className="bg-white border border-dashed border-blue-300 rounded-xl p-4 opacity-80">
                <div className="flex items-start gap-3">
                  <f.icon size={18} className="text-blue-500 mt-0.5 shrink-0" />
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-gray-900 text-sm">{f.label}</p>
                      <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full font-medium">Coming Soon</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">{f.desc}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
