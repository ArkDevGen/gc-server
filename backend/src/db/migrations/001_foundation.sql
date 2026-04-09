-- Migration 001: Foundation
-- Core tables for inventory management

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enum types
CREATE TYPE user_role AS ENUM ('admin', 'office', 'store', 'foreman');
CREATE TYPE location_type AS ENUM ('warehouse', 'store', 'build_site');
CREATE TYPE item_type AS ENUM ('inventory', 'non_inventory', 'service', 'surplus');
CREATE TYPE unit_of_measure AS ENUM ('each', 'ft', 'lft', 'sqft', 'cu_yd', 'ton', 'lb', 'gal', 'bag', 'box', 'pallet', 'roll', 'bundle', 'other');
CREATE TYPE adjustment_reason AS ENUM ('physical_count', 'damage', 'theft', 'correction', 'received', 'returned', 'build_usage', 'sale', 'transfer_in', 'transfer_out', 'surplus_capture', 'other');

-- Users
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  username VARCHAR(50) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  display_name VARCHAR(100) NOT NULL,
  email VARCHAR(255),
  role user_role NOT NULL DEFAULT 'store',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Locations (warehouse, stores, build sites)
CREATE TABLE locations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL,
  slug VARCHAR(50) UNIQUE NOT NULL,
  location_type location_type NOT NULL,
  address TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Categories (with subcategory support)
CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL,
  parent_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Master item catalog
CREATE TABLE items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sku VARCHAR(50) UNIQUE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  item_type item_type NOT NULL DEFAULT 'inventory',
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  unit_of_measure unit_of_measure NOT NULL DEFAULT 'each',
  cost_price DECIMAL(12,4) DEFAULT 0,
  sell_price DECIMAL(12,4) DEFAULT 0,
  reorder_point INT NOT NULL DEFAULT 0,
  reorder_qty INT NOT NULL DEFAULT 0,
  qbo_item_id VARCHAR(50),
  square_catalog_id VARCHAR(100),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_items_sku ON items(sku);
CREATE INDEX idx_items_name ON items(name);
CREATE INDEX idx_items_category ON items(category_id);
CREATE INDEX idx_items_type ON items(item_type);
CREATE INDEX idx_items_qbo ON items(qbo_item_id) WHERE qbo_item_id IS NOT NULL;
CREATE INDEX idx_items_square ON items(square_catalog_id) WHERE square_catalog_id IS NOT NULL;

-- Stock levels per item per location
CREATE TABLE item_locations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  item_id UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  qty_on_hand DECIMAL(12,4) NOT NULL DEFAULT 0,
  qty_reserved DECIMAL(12,4) NOT NULL DEFAULT 0,
  qty_available DECIMAL(12,4) GENERATED ALWAYS AS (qty_on_hand - qty_reserved) STORED,
  bin_aisle VARCHAR(10),
  bin_shelf VARCHAR(10),
  bin_position VARCHAR(10),
  bin_label VARCHAR(50) GENERATED ALWAYS AS (
    CASE
      WHEN bin_aisle IS NOT NULL AND bin_shelf IS NOT NULL AND bin_position IS NOT NULL
        THEN bin_aisle || '-' || bin_shelf || '-' || bin_position
      WHEN bin_aisle IS NOT NULL AND bin_shelf IS NOT NULL
        THEN bin_aisle || '-' || bin_shelf
      WHEN bin_aisle IS NOT NULL
        THEN bin_aisle
      ELSE NULL
    END
  ) STORED,
  last_counted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(item_id, location_id)
);

CREATE INDEX idx_item_locations_item ON item_locations(item_id);
CREATE INDEX idx_item_locations_location ON item_locations(location_id);
CREATE INDEX idx_item_locations_bin ON item_locations(bin_aisle, bin_shelf, bin_position);

-- Inventory adjustment audit log
CREATE TABLE inventory_adjustments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  item_id UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  qty_change DECIMAL(12,4) NOT NULL,
  qty_before DECIMAL(12,4) NOT NULL,
  qty_after DECIMAL(12,4) NOT NULL,
  reason adjustment_reason NOT NULL,
  reference_type VARCHAR(50),
  reference_id UUID,
  notes TEXT,
  adjusted_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_adjustments_item ON inventory_adjustments(item_id);
CREATE INDEX idx_adjustments_location ON inventory_adjustments(location_id);
CREATE INDEX idx_adjustments_ref ON inventory_adjustments(reference_type, reference_id);
CREATE INDEX idx_adjustments_date ON inventory_adjustments(created_at);

-- Customers
CREATE TABLE customers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(50),
  address TEXT,
  qbo_customer_id VARCHAR(50),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Vendors
CREATE TABLE vendors (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(50),
  address TEXT,
  qbo_vendor_id VARCHAR(50),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Auto-update updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_items_updated_at BEFORE UPDATE ON items FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_item_locations_updated_at BEFORE UPDATE ON item_locations FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_customers_updated_at BEFORE UPDATE ON customers FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_vendors_updated_at BEFORE UPDATE ON vendors FOR EACH ROW EXECUTE FUNCTION update_updated_at();
