-- Migration 009: Physical Count / Cycle Count tool

CREATE TYPE count_status AS ENUM ('draft', 'in_progress', 'review', 'applied', 'cancelled');

CREATE TABLE physical_counts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  count_number VARCHAR(50) UNIQUE NOT NULL,
  location_id UUID NOT NULL REFERENCES locations(id),
  status count_status NOT NULL DEFAULT 'draft',
  description TEXT,
  assigned_to UUID REFERENCES users(id),
  filter_category_id UUID REFERENCES categories(id),
  filter_aisle VARCHAR(10),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  applied_at TIMESTAMPTZ,
  applied_by UUID REFERENCES users(id),
  total_items INT DEFAULT 0,
  items_counted INT DEFAULT 0,
  items_matched INT DEFAULT 0,
  items_variance INT DEFAULT 0,
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE physical_count_lines (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  count_id UUID NOT NULL REFERENCES physical_counts(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES items(id),
  item_location_id UUID NOT NULL REFERENCES item_locations(id),
  expected_qty DECIMAL(12,4) NOT NULL DEFAULT 0,
  counted_qty DECIMAL(12,4),
  variance DECIMAL(12,4) GENERATED ALWAYS AS (
    CASE WHEN counted_qty IS NOT NULL THEN counted_qty - expected_qty ELSE NULL END
  ) STORED,
  bin_label VARCHAR(50),
  is_counted BOOLEAN NOT NULL DEFAULT false,
  counted_at TIMESTAMPTZ,
  notes TEXT
);

CREATE INDEX idx_counts_location ON physical_counts(location_id);
CREATE INDEX idx_counts_status ON physical_counts(status);
CREATE INDEX idx_count_lines_count ON physical_count_lines(count_id);

CREATE TRIGGER trg_counts_updated_at BEFORE UPDATE ON physical_counts FOR EACH ROW EXECUTE FUNCTION update_updated_at();
