-- Migration 008: Lead times for auto reorder point suggestions

-- Vendor default lead time
ALTER TABLE vendors ADD COLUMN lead_time_days INT DEFAULT 7;

-- Item-level overrides (nullable = use vendor default)
ALTER TABLE items ADD COLUMN lead_time_days INT;
ALTER TABLE items ADD COLUMN safety_stock_days INT DEFAULT 7;
