// Database setup: schema creation + seed data.
//
// Uses libsql (a better-sqlite3-compatible SQLite library). Two modes:
//
//   1. Local file (default) — same as before, data lives in server/data.db.
//      Fine for running on your own computer.
//
//   2. Turso (when TURSO_DATABASE_URL is set) — the local file becomes an
//      "embedded replica": a fast local copy that syncs with your Turso cloud
//      database. Writes go to Turso, so data survives restarts and redeploys
//      even on free hosting with no persistent disk.

const Database = require('libsql');
const path = require('path');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');

const DB_FILE = process.env.DB_PATH || path.join(__dirname, 'data.db');
const TURSO_URL = process.env.TURSO_DATABASE_URL;
const TURSO_TOKEN = process.env.TURSO_AUTH_TOKEN;

let db;
if (TURSO_URL) {
  db = new Database(DB_FILE, {
    syncUrl: TURSO_URL,
    authToken: TURSO_TOKEN,
    // Pull changes from Turso every 60s as a safety net.
    syncPeriod: 60,
  });
  // Pull the latest data from Turso before anything reads it.
  db.sync();
  console.log('Database: Turso (embedded replica synced from cloud)');
} else {
  db = new Database(DB_FILE);
  db.pragma('journal_mode = WAL');
  console.log(`Database: local file (${DB_FILE})`);
}

function uuid() {
  return crypto.randomUUID();
}

// Adds a column to an existing table if it isn't already there. Lets us
// evolve the schema without wiping out data already sitting in a deployed
// Railway volume.
function ensureColumn(table, col, ddl) {
  const cols = db.prepare(`PRAGMA table_info("${table}")`).all();
  if (!cols.some(c => c.name === col)) {
    db.exec(`ALTER TABLE "${table}" ADD COLUMN ${ddl}`);
  }
}

function init() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS "Suppliers" (
      id TEXT PRIMARY KEY,
      name TEXT, phone TEXT, email TEXT, address TEXT, notes TEXT,
      status TEXT DEFAULT 'Active',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS "Products" (
      id TEXT PRIMARY KEY,
      name TEXT, sku TEXT, category TEXT, description TEXT,
      unitPrice REAL, currentStock REAL DEFAULT 0, lowStockThreshold REAL DEFAULT 10,
      status TEXT DEFAULT 'Active', image TEXT, brand TEXT, unit TEXT DEFAULT 'Piece',
      costPrice REAL, sellingPrice REAL,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS "ProductsSuppliers" (productsId TEXT, suppliersId TEXT);

    CREATE TABLE IF NOT EXISTS "StockMovements" (
      id TEXT PRIMARY KEY,
      reference INTEGER,
      type TEXT, quantity REAL, notes TEXT,
      purchasePrice REAL, invoiceReference TEXT, recordedBy TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS "ProductsStockMovements" (productsId TEXT, stockMovementsId TEXT);
    CREATE TABLE IF NOT EXISTS "StockMovementsSuppliers" (stockMovementsId TEXT, suppliersId TEXT);

    CREATE TABLE IF NOT EXISTS "Categories" (
      id TEXT PRIMARY KEY, name TEXT, prefix TEXT, description TEXT, status TEXT DEFAULT 'Active'
    );

    CREATE TABLE IF NOT EXISTS "PaymentMethods" (
      id TEXT PRIMARY KEY, name TEXT, status TEXT DEFAULT 'Active'
    );

    CREATE TABLE IF NOT EXISTS "ExpenseCategories" (
      id TEXT PRIMARY KEY, name TEXT, description TEXT, status TEXT DEFAULT 'Active'
    );

    CREATE TABLE IF NOT EXISTS "Sales" (
      id TEXT PRIMARY KEY,
      saleId INTEGER,
      date TEXT,
      quantity REAL, sellingPrice REAL, costPrice REAL, discount REAL DEFAULT 0,
      revenue REAL, totalCost REAL, profit REAL,
      notes TEXT, recordedBy TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS "ProductsSales" (productsId TEXT, salesId TEXT);
    CREATE TABLE IF NOT EXISTS "PaymentMethodsSales" (paymentMethodsId TEXT, salesId TEXT);

    CREATE TABLE IF NOT EXISTS "Expenses" (
      id TEXT PRIMARY KEY,
      expenseId INTEGER,
      date TEXT,
      description TEXT, amount REAL,
      receipt TEXT, notes TEXT, recordedBy TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS "ExpenseCategoriesExpenses" (expenseCategoriesId TEXT, expensesId TEXT);
    CREATE TABLE IF NOT EXISTS "ExpensesPaymentMethods" (expensesId TEXT, paymentMethodsId TEXT);

    CREATE TABLE IF NOT EXISTS "Users" (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE,
      passwordHash TEXT,
      role TEXT,          -- 'admin' | 'supplier'
      supplierId TEXT,    -- set for role='supplier', links to Suppliers.id
      status TEXT DEFAULT 'Active',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS "Notifications" (
      id TEXT PRIMARY KEY,
      type TEXT,
      message TEXT,
      productId TEXT,
      isRead INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS "StockUpdateRequests" (
      id TEXT PRIMARY KEY,
      productId TEXT,
      supplierId TEXT,
      previousStock INTEGER,
      requestedStock INTEGER,
      status TEXT DEFAULT 'pending', -- pending | confirmed | rejected
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS "SupplierPayouts" (
      id TEXT PRIMARY KEY,
      supplierId TEXT,
      amount REAL,
      date TEXT,
      notes TEXT,
      recordedBy TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS "ActivityLog" (
      id TEXT PRIMARY KEY,
      actorUsername TEXT,
      actorRole TEXT,
      message TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);

  // Migration: notifications about a stock request carry the request id so
  // the Dashboard can render Confirm/Reject actions inline.
  ensureColumn('Notifications', 'requestId', 'requestId TEXT');

  // Migration: track which product came from a supplier login (vs admin).
  ensureColumn('Products', 'createdByUserId', 'createdByUserId TEXT');

  // Migration: recurring monthly expenses.
  //   repeatsMonthly      1 on the "template" expense you ticked "Repeats monthly" on
  //   recurringLastMonth  last month (YYYY-MM) a copy was made for, so a copy you
  //                       delete on purpose is never re-created
  //   recurringSourceId   on each auto-created copy, points back to its template
  ensureColumn('Expenses', 'repeatsMonthly', 'repeatsMonthly INTEGER DEFAULT 0');
  ensureColumn('Expenses', 'recurringLastMonth', 'recurringLastMonth TEXT');
  ensureColumn('Expenses', 'recurringSourceId', 'recurringSourceId TEXT');

  // Migration: product barcodes (EAN/UPC etc.) for camera scanning.
  ensureColumn('Products', 'barcode', 'barcode TEXT');

  // Monthly sales goals. One row per month (YYYY-MM). A month with no row
  // falls back to the most recent earlier goal, so you set it once.
  db.exec(`
    CREATE TABLE IF NOT EXISTS "SalesTargets" (
      month TEXT PRIMARY KEY,
      revenueTarget REAL DEFAULT 0,
      profitTarget REAL DEFAULT 0,
      updated_at TEXT DEFAULT (datetime('now'))
    );
  `);

  // Data fix: an earlier version of the Payment Methods form saved
  // lowercase 'active'/'disabled' instead of 'Active'/'Disabled', which
  // silently hid those payment methods from the Record Sale and Expense
  // dropdowns (they filter on the capitalized value). Normalize any that
  // slipped through. Safe to run every boot — a no-op once already fixed.
  db.prepare(`UPDATE "PaymentMethods" SET status = 'Active' WHERE LOWER(status) = 'active' AND status != 'Active'`).run();
  db.prepare(`UPDATE "PaymentMethods" SET status = 'Disabled' WHERE LOWER(status) = 'disabled' AND status != 'Disabled'`).run();

  // Seed the admin login exactly once, whether or not this is a brand new
  // database. Runs unconditionally (unlike the demo-data seed below) so it
  // still fires on an already-deployed Railway volume that predates logins.
  const userCount = db.prepare('SELECT COUNT(*) AS c FROM "Users"').get().c;
  if (userCount === 0) {
    const adminId = uuid();
    const defaultPassword = process.env.ADMIN_DEFAULT_PASSWORD || 'admin123';
    db.prepare(`
      INSERT INTO "Users" (id, username, passwordHash, role, status) VALUES (?,?,?,?,?)
    `).run(adminId, 'admin', bcrypt.hashSync(defaultPassword, 10), 'admin', 'Active');
    console.log('============================================================');
    console.log(' Created default admin login — username: admin');
    console.log(`                              password: ${defaultPassword}`);
    console.log(' Log in and change this password right away (Settings).');
    console.log(' Set ADMIN_DEFAULT_PASSWORD before first boot to pick your own.');
    console.log('============================================================');
  }

  const productCount = db.prepare('SELECT COUNT(*) AS c FROM "Products"').get().c;
  if (productCount > 0) return; // real data already exists — never touch it

  // Only a starter set of expense categories is seeded on a fresh install —
  // everything else (products, categories, payment methods, sales, stock
  // movements, suppliers) starts empty so the app is a blank slate. Gated on
  // ExpenseCategories itself (not productCount, which is always 0 now that
  // no products are seeded) so this doesn't re-insert duplicates on restart.
  const expenseCategoryCount = db.prepare('SELECT COUNT(*) AS c FROM "ExpenseCategories"').get().c;
  if (expenseCategoryCount === 0) {
    ['Rent', 'Utilities', 'Salaries', 'Transport', 'Supplies', 'Other'].forEach(name => {
      db.prepare(`INSERT INTO "ExpenseCategories" (id, name, status) VALUES (?,?,'Active')`).run(uuid(), name);
    });
  }
}

init();

module.exports = { db, uuid, DB_FILE, USING_TURSO: !!TURSO_URL };
