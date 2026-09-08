# GWM Inventory Manager

A full-stack inventory, sales, and expense manager: React + Vite frontend,
Express + SQLite backend, JWT-based login with admin and per-supplier
accounts.

## What's in it
- Dashboard, Products, Stock Movements, Sales, Expenses, Categories,
  Expense Categories, Suppliers, Payment Methods, Profit & Loss, and Reports
  pages.
- A Supplier Portal for logins created per supplier — see below.
- PDF export for reports.
- `server/` — the Express + SQLite backend. Each route in `server/index.cjs`
  handles one piece of the app's data (products, sales, expenses, etc.).
- `src/lib/api-client.ts` — the frontend's single point of contact with the
  backend; every exported function maps to one `/api/*` route.
- `src/lib/auth-shim.tsx` — the login/session context (JWT stored in the
  browser).

## Logins & roles

There are two kinds of accounts:

- **Admin** (you) — full access to everything: Dashboard, Sales, Expenses,
  Reports, Profit & Loss, Categories, Payment Methods, and every supplier's
  products.
- **Supplier** — one login per supplier, created from the **Suppliers**
  page ("Create login"). A supplier can only: add/edit/delete their own
  products, see their own stock levels (including low/out-of-stock flags),
  and see their running profit share — 1/3 of the profit on sales of *their*
  products only, never anyone else's. They set a cost price and starting
  stock when adding a product; you set the selling price afterwards from
  the admin Products page. You'll get a notification on the Dashboard when
  a supplier adds a new product.

On first boot, an admin login is created automatically:
- username: `admin`
- password: `admin123` (or whatever you set `ADMIN_DEFAULT_PASSWORD` to
  before the very first run)

**Log in and change that password immediately** — there's no "forgot
password" flow, so if you lose it you'll need to delete `server/data.db`
(wiping all data) or edit the `Users` table directly.

Set a real `JWT_SECRET` environment variable (any long random string)
before this app is reachable on a public URL — without it, login tokens
are signed with a well-known default and can be forged.

## Running it

```bash
npm install

# Terminal 1 — backend (Express + SQLite, seeds sample data + the admin login on first run)
npm run server

# Terminal 2 — frontend
npm run dev
```

Or run both at once:

```bash
npm run dev:full
```

Then open http://localhost:8080.

The SQLite database file is created at `server/data.db` on first run.
Delete it any time to reset back to the seed data.

## Notes
- Every `/api/*` route requires a valid login (`requireAdmin` /
  `requireSupplier` guards on the Express side).

## Deploying live (e.g. Railway)

This app is a single deployable service: Express serves both the API and
the built frontend from one port.

1. Push this folder to a GitHub repo.
2. On Railway (or Render), create a new project from that GitHub repo.
3. Add a persistent volume mounted at `/data`, and set environment
   variables `DB_PATH=/data/data.db` (so the SQLite file survives
   redeploys) and `JWT_SECRET` to a long random string (so login tokens
   can't be forged). Optionally set `ADMIN_DEFAULT_PASSWORD` too, before
   the very first deploy, to pick your own initial admin password.
4. Railway auto-detects Node, runs `npm install`, then `npm run build`
   (builds the frontend into `dist/`), then `npm start` (Express serves
   `dist/` + the API on `process.env.PORT`).
5. That's it — no separate frontend host needed.
