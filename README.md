# GWM Inventory Manager

A full-stack inventory, sales, and expense manager: React + Vite frontend,
Express + SQLite backend, JWT-based login with an admin account and
per-supplier accounts.

## What's in it

**Admin side**
- **Dashboard** — revenue/profit/stock stats, a 30-day sales trend chart,
  expenses-by-category and best-selling-products charts, a Stock Alerts
  section (low/out-of-stock products), and a Supplier Activity panel for
  anything needing your attention (see Notifications below).
- **Products** — add/edit/delete, stock movements (Stock In/Out/Returned/
  Adjustment), and **Bulk Import** from a CSV file (with a downloadable
  template).
- **Sales** — record a sale, filter by date, and print a one-page PDF
  receipt for any sale.
- **Expenses**, **Categories**, **Expense Categories**, **Payment
  Methods** — standard CRUD pages.
- **Suppliers** — manage suppliers and create/reset/disable a login for
  each one.
- **Payouts** — tracks what each supplier has earned vs what you've
  actually paid them, with a "Mark as Paid" ledger and per-supplier
  payout history.
- **Profit & Loss** and **Reports** — P&L statement, CSV/PDF export per
  report, and a one-click **full database backup** download.
- **Help & Guide** — plain-language explanations of every figure and
  term in the app (Revenue, COGS, Gross/Net Profit, Stock Value, profit
  share, etc.).
- **Dark mode** toggle (remembered per browser).

**Supplier portal** (`/`, separate nav from admin)
- **Products** — a supplier can add/edit their own products only, with
  the same Bulk Import CSV flow. They set cost price and starting stock;
  the admin sets the selling price before a product can be sold, and
  can't delete products themselves (ask the admin).
- **Stock Alerts** — their own low/out-of-stock products.
- **My Earnings** — their running profit share (1/3 of profit on sales of
  *their* products only), what's been paid to them, and the balance owed.
- **Help** — a supplier-focused version of the Help page.

**Everything else**
- `server/` — the Express + SQLite backend. Each route in
  `server/index.cjs` handles one piece of the app's data.
- `src/lib/api-client.ts` — the frontend's single point of contact with
  the backend; every exported function maps to one `/api/*` route.
- `src/lib/auth-shim.tsx` — the login/session context (JWT in the browser).
- `src/lib/theme-provider.tsx` — the light/dark mode context.
- Mobile-friendly throughout (touch scrolling, responsive dialogs), with
  a home-screen icon/PWA manifest so it can be "installed" from a phone.

## Logins & roles

- **Admin** (you) — full access to everything.
- **Supplier** — one login per supplier, created from the **Suppliers**
  page ("Create login"). Scoped to their own products and earnings only,
  as described above.

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

## Notifications

The Dashboard's Supplier Activity panel and the sidebar nav badges cover:
- A supplier added a new product (needs a selling price before it can sell).
- A supplier bulk-imported products via CSV.
- A supplier wants to update stock on a low/out-of-stock product — needs
  your **Confirm/Reject** (their change doesn't apply until you do).
- **Sales** nav badge — how many products have no selling price set yet.
- **Payouts** nav badge — how many suppliers are currently owed money.

On mobile, a red dot on the hamburger menu means at least one of the
above needs a look, without having to open the menu first. The supplier
portal has its own equivalents: a Stock Alerts badge, a pending-stock-
confirmation badge on Products, and an owed-payout badge on My Earnings.

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
Delete it any time to reset back to the seed data — or use the
**Download Backup** button on the Reports page to save a copy first.

## Environment variables

| Variable | Purpose | Default |
|---|---|---|
| `JWT_SECRET` | Signs login tokens — set a real one before going public | insecure built-in value |
| `ADMIN_DEFAULT_PASSWORD` | Initial admin password, only used on a brand-new database | `admin123` |
| `DB_PATH` | Where the SQLite file lives — set this on a host with a persistent volume | `server/data.db` |
| `PORT` | What port Express listens on in production | provided by the host |

## Notes

- Every `/api/*` route requires a valid login (`requireAdmin` /
  `requireSupplier` guards on the Express side).
- PDF export (reports, receipts) uses Puppeteer (headless Chrome) — it
  needs a bit more memory than the rest of the app, so keep that in mind
  if you're on a very small hosting plan.
- The stock-count math throughout the app is based on `currentStock` vs
  `lowStockThreshold`, not the `status` text column — treat `status` as
  informational only.

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
