-- Migration 010: Add contact_name and mobile_phone columns to vendors

ALTER TABLE vendors ADD COLUMN contact_name VARCHAR(255);
ALTER TABLE vendors ADD COLUMN mobile_phone VARCHAR(50);
