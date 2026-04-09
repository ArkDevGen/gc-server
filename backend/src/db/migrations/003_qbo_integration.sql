-- Migration 003: QBO Integration tables (POs, Invoices, QBO tokens)

CREATE TYPE po_status AS ENUM ('draft', 'pending', 'sent_to_qbo', 'partially_received', 'received', 'cancelled');
CREATE TYPE invoice_status AS ENUM ('draft', 'sent_to_qbo', 'emailed', 'viewed', 'paid', 'overdue', 'voided');
CREATE TYPE email_delivery_status AS ENUM ('not_set', 'need_to_send', 'email_sent', 'viewed', 'bounced', 'unknown');

-- QBO OAuth tokens
CREATE TABLE qbo_tokens (
  id SERIAL PRIMARY KEY,
  realm_id VARCHAR(50) UNIQUE NOT NULL,
  company_name VARCHAR(255),
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  token_type VARCHAR(50) DEFAULT 'bearer',
  expires_at TIMESTAMPTZ NOT NULL,
  refresh_expires_at TIMESTAMPTZ,
  connected_at TIMESTAMPTZ DEFAULT NOW(),
  last_refreshed TIMESTAMPTZ DEFAULT NOW()
);

-- Purchase Orders
CREATE TABLE purchase_orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  po_number VARCHAR(50) UNIQUE NOT NULL,
  vendor_id UUID NOT NULL REFERENCES vendors(id),
  location_id UUID NOT NULL REFERENCES locations(id),
  status po_status NOT NULL DEFAULT 'draft',
  order_date DATE DEFAULT CURRENT_DATE,
  expected_date DATE,
  subtotal DECIMAL(12,2) DEFAULT 0,
  tax DECIMAL(12,2) DEFAULT 0,
  total DECIMAL(12,2) DEFAULT 0,
  qbo_po_id VARCHAR(50),
  qbo_doc_number VARCHAR(50),
  qbo_sync_at TIMESTAMPTZ,
  notes TEXT,
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE purchase_order_lines (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  po_id UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  line_number INT NOT NULL,
  item_id UUID REFERENCES items(id),
  description VARCHAR(500) NOT NULL,
  qty_ordered DECIMAL(12,4) NOT NULL,
  qty_received DECIMAL(12,4) NOT NULL DEFAULT 0,
  unit_cost DECIMAL(12,4) NOT NULL,
  line_total DECIMAL(12,2) GENERATED ALWAYS AS (ROUND(qty_ordered * unit_cost, 2)) STORED,
  qbo_line_id VARCHAR(50)
);

-- PO Receiving
CREATE TABLE po_receipts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  po_id UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  received_date DATE DEFAULT CURRENT_DATE,
  received_by UUID NOT NULL REFERENCES users(id),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE po_receipt_lines (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  receipt_id UUID NOT NULL REFERENCES po_receipts(id) ON DELETE CASCADE,
  po_line_id UUID NOT NULL REFERENCES purchase_order_lines(id),
  item_id UUID REFERENCES items(id),
  qty_received DECIMAL(12,4) NOT NULL,
  location_id UUID NOT NULL REFERENCES locations(id),
  bin_aisle VARCHAR(10),
  bin_shelf VARCHAR(10),
  bin_position VARCHAR(10)
);

-- Invoices
CREATE TABLE invoices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_number VARCHAR(50) UNIQUE NOT NULL,
  customer_id UUID NOT NULL REFERENCES customers(id),
  build_id UUID,
  status invoice_status NOT NULL DEFAULT 'draft',
  invoice_date DATE DEFAULT CURRENT_DATE,
  due_date DATE,
  subtotal DECIMAL(12,2) DEFAULT 0,
  tax DECIMAL(12,2) DEFAULT 0,
  total DECIMAL(12,2) DEFAULT 0,
  qbo_invoice_id VARCHAR(50),
  qbo_doc_number VARCHAR(50),
  qbo_sync_at TIMESTAMPTZ,
  email_status email_delivery_status DEFAULT 'not_set',
  email_sent_at TIMESTAMPTZ,
  email_viewed_at TIMESTAMPTZ,
  customer_email VARCHAR(255),
  notes TEXT,
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE invoice_lines (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  line_number INT NOT NULL,
  item_id UUID REFERENCES items(id),
  description VARCHAR(500) NOT NULL,
  qty DECIMAL(12,4) NOT NULL,
  unit_price DECIMAL(12,4) NOT NULL,
  line_total DECIMAL(12,2) GENERATED ALWAYS AS (ROUND(qty * unit_price, 2)) STORED,
  qbo_line_id VARCHAR(50)
);

CREATE INDEX idx_po_vendor ON purchase_orders(vendor_id);
CREATE INDEX idx_po_status ON purchase_orders(status);
CREATE INDEX idx_invoice_customer ON invoices(customer_id);
CREATE INDEX idx_invoice_status ON invoices(status);
CREATE INDEX idx_invoice_build ON invoices(build_id) WHERE build_id IS NOT NULL;

CREATE TRIGGER trg_po_updated_at BEFORE UPDATE ON purchase_orders FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_invoices_updated_at BEFORE UPDATE ON invoices FOR EACH ROW EXECUTE FUNCTION update_updated_at();
