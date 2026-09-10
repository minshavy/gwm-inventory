// Database setup: schema creation + seed data, backed by a local SQLite file.

const Database = require('better-sqlite3');
const path = require('path');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');

const db = new Database(process.env.DB_PATH || path.join(__dirname, 'data.db'));
db.pragma('journal_mode = WAL');

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
  `);

  // Migration: notifications about a stock request carry the request id so
  // the Dashboard can render Confirm/Reject actions inline.
  ensureColumn('Notifications', 'requestId', 'requestId TEXT');

  // Migration: track which product came from a supplier login (vs admin).
  ensureColumn('Products', 'createdByUserId', 'createdByUserId TEXT');

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
  if (productCount > 0) return; // demo data already seeded (or real data exists)

  const musk = uuid();
  const s26 = uuid();
  db.prepare(`
    INSERT INTO "Products" (id, name, sku, category, brand, unit, costPrice, sellingPrice, currentStock, lowStockThreshold, status)
    VALUES (?,?,?,?,?,?,?,?,?,?,?)
  `).run(musk, 'Musk 10ml', 'ITM-M13196', 'Perfume', 'Lathafa', 'Piece', 70, 130, 97, 20, 'Active');
  db.prepare(`
    INSERT INTO "Products" (id, name, sku, category, brand, unit, costPrice, sellingPrice, currentStock, lowStockThreshold, status)
    VALUES (?,?,?,?,?,?,?,?,?,?,?)
  `).run(s26, 'S26 ultra', 'ITM-SU8002', 'Electronics', 'Samsung', 'Piece', 20000, 26000, 21, 20, 'Active');

  db.prepare(`INSERT INTO "Categories" (id, name, prefix) VALUES (?,?,?)`).run(uuid(), 'Perfume', 'ITM');
  db.prepare(`INSERT INTO "Categories" (id, name, prefix) VALUES (?,?,?)`).run(uuid(), 'Electronics', 'ITM');

  ['Rent', 'Utilities', 'Salaries', 'Transport', 'Supplies', 'Other'].forEach(name => {
    db.prepare(`INSERT INTO "ExpenseCategories" (id, name, status) VALUES (?,?,'Active')`).run(uuid(), name);
  });

  const cash = uuid();
  const bank = uuid();
  db.prepare(`INSERT INTO "PaymentMethods" (id, name, status) VALUES (?,?,?)`).run(cash, 'Cash', 'Active');
  db.prepare(`INSERT INTO "PaymentMethods" (id, name, status) VALUES (?,?,?)`).run(bank, 'Bank Transfer', 'Active');

  function addSale(saleId, productId, date, qty, sell, cost, paymentId) {
    const id = uuid();
    const revenue = qty * sell;
    const totalCost = qty * cost;
    const profit = revenue - totalCost;
    db.prepare(`
      INSERT INTO "Sales" (id, saleId, date, quantity, sellingPrice, costPrice, discount, revenue, totalCost, profit, recordedBy)
      VALUES (?,?,?,?,?,?,0,?,?,?,'local-user')
    `).run(id, saleId, date, qty, sell, cost, revenue, totalCost, profit);
    db.prepare(`INSERT INTO "ProductsSales" (productsId, salesId) VALUES (?,?)`).run(productId, id);
    db.prepare(`INSERT INTO "PaymentMethodsSales" (paymentMethodsId, salesId) VALUES (?,?)`).run(paymentId, id);
    return { id, saleId };
  }

  addSale(4, s26, '2026-08-23', 2, 26000, 20000, cash);
  addSale(5, musk, '2026-08-23', 1, 130, 70, bank);
  addSale(6, musk, '2026-08-23', 2, 130, 70, cash);

  function addMovement(ref, productId, type, qty, price, notes) {
    const id = uuid();
    db.prepare(`
      INSERT INTO "StockMovements" (id, reference, type, quantity, purchasePrice, notes, recordedBy)
      VALUES (?,?,?,?,?,?,'local-user')
    `).run(id, ref, type, qty, price ?? null, notes ?? null);
    db.prepare(`INSERT INTO "ProductsStockMovements" (productsId, stockMovementsId) VALUES (?,?)`).run(productId, id);
  }

  addMovement(10, s26, 'Stock Out', 2, null, 'Sale #4');
  addMovement(11, musk, 'Stock Out', 1, null, 'Sale #5');
  addMovement(12, s26, 'Stock In', 7, 20000, null);
  addMovement(13, s26, 'Stock In', 1, 20000, null);
  addMovement(14, musk, 'Stock Out', 2, null, 'Sale #6');
}

init();

module.exports = { db, uuid };
