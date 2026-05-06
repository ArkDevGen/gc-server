# GC Business Hub

Centralized business operations system (inventory, quotes, builds, POs, invoices) for an ag/construction company with 2 retail stores + warehouse.

## Architecture

- **Backend**: Node.js + Express + TypeScript (`backend/src/`)
- **Frontend**: React + TypeScript + Tailwind CSS + Vite (`frontend/src/`)
- **Database**: PostgreSQL with migration files in `backend/src/db/migrations/`
- **Integrations**: QuickBooks Online API, Square POS API

## Development

```bash
# Backend
cd backend && npm install && npm run dev

# Frontend (separate terminal)
cd frontend && npm install && npm run dev

# Run migrations
cd backend && npm run migrate
```

Backend runs on port 3001, frontend on 5173 with proxy to backend.

## Key Patterns

- Every stock change goes through `adjustStock()` in `inventory.service.ts` (transactional with audit trail)
- Auth via JWT with role-based middleware (`requireAuth`, `requireRole`)
- Validation via Zod schemas in route handlers
- Database migrations are sequential SQL files, tracked in `_migrations` table
- QBO tokens stored in PostgreSQL `qbo_tokens` table (not JSON files)

## Roles

- `admin` — full access, user management
- `office` — create/edit items, POs, invoices, quotes
- `store` — view inventory, record sales
- `foreman` — view builds, record material usage

## Build Phases

1. Foundation (inventory, auth, locations, categories) - CURRENT
2. QBO Integration (POs, invoices, email tracking)
3. Quoting + Build Tracker (quotes, builds, surplus capture)
4. Square POS Integration (catalog sync, sale webhooks)
5. Transfers + Reports + PWA
