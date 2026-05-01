-- Migration 012: Add quote-level discount support
--
-- Two columns so we can support either a percent-off or a flat-dollar
-- discount. Exactly one is used at a time (the UI toggles between them);
-- both default to NULL meaning "no discount".
--
-- Discount applies to the subtotal — total = subtotal - discount + tax.

ALTER TABLE quotes ADD COLUMN discount_pct DECIMAL(5,2);
ALTER TABLE quotes ADD COLUMN discount_amount DECIMAL(12,2);
