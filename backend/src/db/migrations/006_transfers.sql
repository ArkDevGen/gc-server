-- Migration 006: Transfers + Pick Tickets

CREATE TYPE transfer_status AS ENUM ('requested', 'approved', 'in_transit', 'received', 'cancelled');

CREATE TABLE transfers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  transfer_number VARCHAR(50) UNIQUE NOT NULL,
  from_location_id UUID NOT NULL REFERENCES locations(id),
  to_location_id UUID NOT NULL REFERENCES locations(id),
  status transfer_status NOT NULL DEFAULT 'requested',
  requested_by UUID NOT NULL REFERENCES users(id),
  approved_by UUID REFERENCES users(id),
  received_by UUID REFERENCES users(id),
  requested_at TIMESTAMPTZ DEFAULT NOW(),
  approved_at TIMESTAMPTZ,
  shipped_at TIMESTAMPTZ,
  received_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE transfer_lines (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  transfer_id UUID NOT NULL REFERENCES transfers(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES items(id),
  qty_requested DECIMAL(12,4) NOT NULL,
  qty_shipped DECIMAL(12,4) NOT NULL DEFAULT 0,
  qty_received DECIMAL(12,4) NOT NULL DEFAULT 0,
  from_bin_label VARCHAR(50),
  to_bin_aisle VARCHAR(10),
  to_bin_shelf VARCHAR(10),
  to_bin_position VARCHAR(10)
);

CREATE INDEX idx_transfers_status ON transfers(status);
CREATE INDEX idx_transfers_from ON transfers(from_location_id);
CREATE INDEX idx_transfers_to ON transfers(to_location_id);

CREATE TRIGGER trg_transfers_updated_at BEFORE UPDATE ON transfers FOR EACH ROW EXECUTE FUNCTION update_updated_at();
