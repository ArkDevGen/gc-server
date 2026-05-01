-- Migration 011: Add contact_name to customers, then clean up the
-- import-time hack where the organization name was stuffed into the
-- address field as "Organization: <name>".
--
-- The desired final state for B2B customers is:
--   customers.name         = the organization (company / farm / etc.)
--   customers.contact_name = the person to talk to (the original name)
--   customers.address      = an actual mailing address (or null)
--
-- For B2C customers (no organization on the import), we leave name
-- as the individual person and contact_name stays NULL.

ALTER TABLE customers ADD COLUMN contact_name VARCHAR(255);

-- For each row whose address starts with "Organization: ", extract the org
-- name, swap it into customers.name, move the previous name to contact_name,
-- and clear the address (it wasn't a real address).
UPDATE customers
SET
  contact_name = NULLIF(TRIM(name), ''),
  name = TRIM(SUBSTRING(address FROM 'Organization:[[:space:]]*(.*)$')),
  address = NULL
WHERE address ~ '^Organization:[[:space:]]*.+$'
  AND TRIM(SUBSTRING(address FROM 'Organization:[[:space:]]*(.*)$')) <> '';

-- For customers whose original name was "- -" or empty (where the row was
-- effectively just an org with no contact), drop the placeholder contact_name.
UPDATE customers
SET contact_name = NULL
WHERE contact_name IN ('-', '--', '- -', '');
