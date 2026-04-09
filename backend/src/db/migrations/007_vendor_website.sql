-- Migration 007: Add website URL to vendors + preferred vendor to items

ALTER TABLE vendors ADD COLUMN website VARCHAR(500);

-- Link items to their preferred vendor for reordering
ALTER TABLE items ADD COLUMN preferred_vendor_id UUID REFERENCES vendors(id);
