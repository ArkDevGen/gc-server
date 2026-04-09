-- Migration 005: Quote Templates + Import Log

-- Quote Templates (reusable line item sets)
CREATE TABLE quote_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE quote_template_lines (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  template_id UUID NOT NULL REFERENCES quote_templates(id) ON DELETE CASCADE,
  line_number INT NOT NULL,
  item_id UUID REFERENCES items(id),
  description VARCHAR(500) NOT NULL,
  qty DECIMAL(12,4) NOT NULL DEFAULT 1,
  unit_cost DECIMAL(12,4) NOT NULL DEFAULT 0,
  unit_price DECIMAL(12,4) NOT NULL DEFAULT 0
);

CREATE INDEX idx_templates_active ON quote_templates(is_active) WHERE is_active = true;

CREATE TRIGGER trg_templates_updated_at BEFORE UPDATE ON quote_templates FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Import log (track one-time data imports)
CREATE TABLE import_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  import_type VARCHAR(50) NOT NULL,
  filename VARCHAR(255),
  rows_total INT DEFAULT 0,
  rows_imported INT DEFAULT 0,
  rows_skipped INT DEFAULT 0,
  rows_errored INT DEFAULT 0,
  errors JSONB DEFAULT '[]',
  imported_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
