-- Migration 004: Quotes and Build Tracker

CREATE TYPE quote_status AS ENUM ('draft', 'sent', 'accepted', 'rejected', 'expired', 'converted');
CREATE TYPE build_status AS ENUM ('planning', 'active', 'on_hold', 'complete', 'cancelled');
CREATE TYPE build_line_status AS ENUM ('planned', 'allocated', 'picked', 'used', 'returned_surplus');

-- Quotes
CREATE TABLE quotes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  quote_number VARCHAR(50) UNIQUE NOT NULL,
  customer_id UUID NOT NULL REFERENCES customers(id),
  status quote_status NOT NULL DEFAULT 'draft',
  quote_date DATE DEFAULT CURRENT_DATE,
  valid_until DATE,
  subtotal DECIMAL(12,2) DEFAULT 0,
  tax DECIMAL(12,2) DEFAULT 0,
  total DECIMAL(12,2) DEFAULT 0,
  margin_pct DECIMAL(5,2),
  notes TEXT,
  converted_to_po UUID REFERENCES purchase_orders(id),
  converted_to_build UUID,
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE quote_lines (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  quote_id UUID NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  line_number INT NOT NULL,
  item_id UUID REFERENCES items(id),
  description VARCHAR(500) NOT NULL,
  qty DECIMAL(12,4) NOT NULL,
  unit_cost DECIMAL(12,4) NOT NULL DEFAULT 0,
  unit_price DECIMAL(12,4) NOT NULL,
  line_total DECIMAL(12,2) GENERATED ALWAYS AS (ROUND(qty * unit_price, 2)) STORED,
  is_surplus BOOLEAN NOT NULL DEFAULT false,
  surplus_location_id UUID REFERENCES locations(id)
);

-- Builds
CREATE TABLE builds (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  build_number VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  customer_id UUID REFERENCES customers(id),
  location_id UUID NOT NULL REFERENCES locations(id),
  quote_id UUID REFERENCES quotes(id),
  status build_status NOT NULL DEFAULT 'planning',
  start_date DATE,
  target_end_date DATE,
  actual_end_date DATE,
  budget_total DECIMAL(12,2) DEFAULT 0,
  actual_total DECIMAL(12,2) DEFAULT 0,
  foreman_id UUID REFERENCES users(id),
  notes TEXT,
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add FK from quotes to builds
ALTER TABLE quotes ADD CONSTRAINT fk_quotes_build FOREIGN KEY (converted_to_build) REFERENCES builds(id);

-- Add FK from invoices to builds
ALTER TABLE invoices ADD CONSTRAINT fk_invoices_build FOREIGN KEY (build_id) REFERENCES builds(id);

-- Build Materials
CREATE TABLE build_materials (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  build_id UUID NOT NULL REFERENCES builds(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES items(id),
  source_location_id UUID NOT NULL REFERENCES locations(id),
  qty_planned DECIMAL(12,4) NOT NULL DEFAULT 0,
  qty_allocated DECIMAL(12,4) NOT NULL DEFAULT 0,
  qty_used DECIMAL(12,4) NOT NULL DEFAULT 0,
  qty_surplus DECIMAL(12,4) NOT NULL DEFAULT 0,
  unit_cost DECIMAL(12,4) NOT NULL,
  status build_line_status NOT NULL DEFAULT 'planned',
  po_line_id UUID REFERENCES purchase_order_lines(id),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Surplus Pool
CREATE TABLE surplus_pool (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  item_id UUID NOT NULL REFERENCES items(id),
  location_id UUID NOT NULL REFERENCES locations(id),
  build_id UUID REFERENCES builds(id),
  qty_available DECIMAL(12,4) NOT NULL,
  original_cost DECIMAL(12,4),
  condition_notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  captured_by UUID REFERENCES users(id),
  captured_at TIMESTAMPTZ DEFAULT NOW(),
  consumed_at TIMESTAMPTZ,
  consumed_by_quote UUID REFERENCES quotes(id),
  consumed_by_build UUID REFERENCES builds(id)
);

CREATE INDEX idx_quotes_customer ON quotes(customer_id);
CREATE INDEX idx_quotes_status ON quotes(status);
CREATE INDEX idx_builds_customer ON builds(customer_id);
CREATE INDEX idx_builds_status ON builds(status);
CREATE INDEX idx_builds_foreman ON builds(foreman_id);
CREATE INDEX idx_build_materials_build ON build_materials(build_id);
CREATE INDEX idx_build_materials_item ON build_materials(item_id);
CREATE INDEX idx_surplus_item ON surplus_pool(item_id);
CREATE INDEX idx_surplus_active ON surplus_pool(is_active) WHERE is_active = true;

CREATE TRIGGER trg_quotes_updated_at BEFORE UPDATE ON quotes FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_builds_updated_at BEFORE UPDATE ON builds FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_build_materials_updated_at BEFORE UPDATE ON build_materials FOR EACH ROW EXECUTE FUNCTION update_updated_at();
