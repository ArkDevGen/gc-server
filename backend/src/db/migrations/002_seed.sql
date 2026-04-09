-- Seed data: admin user (password: admin123), locations, categories
-- Password hash is bcrypt of 'admin123'

INSERT INTO users (username, password_hash, display_name, email, role) VALUES
  ('admin', '$2a$10$rQEY7Gc4wOFKPSTBQQ6h3e3mKXJnGMCPqgJ7TqFY5XqVQKq0V.hXO', 'System Admin', 'admin@gcserver.com', 'admin');

INSERT INTO locations (name, slug, location_type, address) VALUES
  ('Main Warehouse', 'warehouse', 'warehouse', '123 Industrial Pkwy'),
  ('Store A - Greenfield', 'store_a', 'store', '456 Main St, Greenfield'),
  ('Store B - Crawfordsville', 'store_b', 'store', '789 Market St, Crawfordsville');

INSERT INTO categories (name, sort_order) VALUES
  ('Lumber', 1),
  ('Concrete & Masonry', 2),
  ('Fencing', 3),
  ('Pipe & Fittings', 4),
  ('Fasteners', 5),
  ('Electrical', 6),
  ('Plumbing', 7),
  ('Tools & Equipment', 8),
  ('Feed & Seed', 9),
  ('General Supplies', 10);
