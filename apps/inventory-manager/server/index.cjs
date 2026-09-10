// Express backend for the GWM Inventory Manager — SQLite via
// better-sqlite3, JWT-based auth with admin/supplier roles, and every
// endpoint the frontend (src/lib/api-client.ts) and auth (src/lib/auth-shim.tsx)
// talk to over /api/*.

const express = require('express');
const cors = require('cors');
const { db, uuid } = require('./db.cjs');
const {
  hashPassword, comparePassword, signToken,
  authenticate, requireAdmin, requireSupplier, JWT_SECRET,
} = require('./auth.cjs');

const app = express();
app.use(cors());
app.use(express.json());

if (JWT_SECRET === 'dev-only-insecure-secret-change-me') {
  console.warn(
    'WARNING: JWT_SECRET is not set — using an insecure built-in default. ' +
    'Set a real JWT_SECRET env var (e.g. in Railway variables) before this app is reachable publicly, ' +
    'or every login token can be forged.'
  );
}

function nextCounter(table, col) {
  const row = db.prepare(`SELECT MAX(${col}) AS m FROM "${table}"`).get();
  return (row.m ?? 0) + 1;
}

// Returns the supplierId a product belongs to (or null), via the
// ProductsSuppliers junction table.
function productSupplierId(productId) {
  const row = db.prepare(`SELECT suppliersId FROM "ProductsSuppliers" WHERE productsId = ? LIMIT 1`).get(productId);
  return row ? row.suppliersId : null;
}

// Total profit (unbounded — no LIMIT) from sales of a supplier's own
// products, and their 1/3 share of it. Used by both the supplier's own
// earnings view and the admin payout ledger, so the two always agree.
function getSupplierEarnings(supplierId) {
  const totalProfit = db.prepare(`
    SELECT COALESCE(SUM(s.profit), 0) AS total
    FROM "Sales" s
    JOIN "ProductsSales" pl ON pl.salesId = s.id
    JOIN "Products" p ON p.id = pl.productsId
    JOIN "ProductsSuppliers" ps ON ps.productsId = p.id
    WHERE ps.suppliersId = ?
  `).get(supplierId).total;

  const monthKey = new Date().toISOString().slice(0, 7);
  const thisMonthProfit = db.prepare(`
    SELECT COALESCE(SUM(s.profit), 0) AS total
    FROM "Sales" s
    JOIN "ProductsSales" pl ON pl.salesId = s.id
    JOIN "Products" p ON p.id = pl.productsId
    JOIN "ProductsSuppliers" ps ON ps.productsId = p.id
    WHERE ps.suppliersId = ? AND substr(s.date, 1, 7) = ?
  `).get(supplierId, monthKey).total;

  const totalPaid = db.prepare(`
    SELECT COALESCE(SUM(amount), 0) AS total FROM "SupplierPayouts" WHERE supplierId = ?
  `).get(supplierId).total;

  const totalShare = totalProfit / 3;
  return {
    totalProfit, totalShare, thisMonthShare: thisMonthProfit / 3,
    totalPaid, balance: totalShare - totalPaid,
  };
}

// ---------- Auth ----------
app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: 'Username and password required' });
  const user = db.prepare(`SELECT * FROM "Users" WHERE username = ?`).get(String(username).trim());
  if (!user || user.status !== 'Active' || !comparePassword(password, user.passwordHash)) {
    return res.status(401).json({ error: 'Invalid username or password' });
  }
  const token = signToken(user);
  res.json({
    token,
    user: { id: user.id, username: user.username, role: user.role, supplierId: user.supplierId || null },
  });
});

// Everything below this line requires a valid login.
app.use('/api', authenticate);

app.post('/api/auth/me', (req, res) => {
  const user = db.prepare(`SELECT id, username, role, supplierId, status FROM "Users" WHERE id = ?`).get(req.user.id);
  if (!user || user.status !== 'Active') return res.status(401).json({ error: 'Session invalid' });
  res.json({ user });
});

app.post('/api/auth/changePassword', (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  const user = db.prepare(`SELECT * FROM "Users" WHERE id = ?`).get(req.user.id);
  if (!user || !comparePassword(currentPassword, user.passwordHash)) {
    return res.status(401).json({ error: 'Current password is incorrect' });
  }
  if (!newPassword || String(newPassword).length < 6) {
    return res.status(400).json({ error: 'New password must be at least 6 characters' });
  }
  db.prepare(`UPDATE "Users" SET passwordHash = ? WHERE id = ?`).run(hashPassword(newPassword), user.id);
  res.json({ success: true });
});

// ---------- Admin: confirm/reject a supplier's stock update ----------
app.post('/api/admin/confirmStockUpdate', requireAdmin, (req, res) => {
  const { requestId } = req.body || {};
  const request = db.prepare(`SELECT * FROM "StockUpdateRequests" WHERE id = ?`).get(requestId);
  if (!request) return res.status(400).json({ error: 'Request not found' });
  if (request.status !== 'pending') return res.status(400).json({ error: 'This request was already handled' });

  db.prepare(`UPDATE "Products" SET currentStock=?, status=? WHERE id=?`)
    .run(request.requestedStock, request.requestedStock <= 0 ? 'Out of Stock' : 'Active', request.productId);

  const delta = request.requestedStock - request.previousStock;
  if (delta !== 0) {
    const moveId = uuid();
    const ref = nextCounter('StockMovements', 'reference');
    db.prepare(`
      INSERT INTO "StockMovements" (id, reference, type, quantity, notes, recordedBy) VALUES (?,?,?,?,?,?)
    `).run(moveId, ref, delta > 0 ? 'Stock In' : 'Stock Out', Math.abs(delta), 'Confirmed supplier restock', req.user.username);
    db.prepare(`INSERT INTO "ProductsStockMovements" (productsId, stockMovementsId) VALUES (?,?)`).run(request.productId, moveId);
    if (request.supplierId) db.prepare(`INSERT INTO "StockMovementsSuppliers" (stockMovementsId, suppliersId) VALUES (?,?)`).run(moveId, request.supplierId);
  }

  db.prepare(`UPDATE "StockUpdateRequests" SET status='confirmed' WHERE id=?`).run(requestId);
  db.prepare(`DELETE FROM "Notifications" WHERE requestId=?`).run(requestId);
  res.json({ success: true });
});

app.post('/api/admin/rejectStockUpdate', requireAdmin, (req, res) => {
  const { requestId } = req.body || {};
  const request = db.prepare(`SELECT * FROM "StockUpdateRequests" WHERE id = ?`).get(requestId);
  if (!request) return res.status(400).json({ error: 'Request not found' });
  if (request.status !== 'pending') return res.status(400).json({ error: 'This request was already handled' });
  db.prepare(`UPDATE "StockUpdateRequests" SET status='rejected' WHERE id=?`).run(requestId);
  db.prepare(`DELETE FROM "Notifications" WHERE requestId=?`).run(requestId);
  res.json({ success: true });
});

// ---------- Notifications (admin only) ----------
app.post('/api/getNotifications', requireAdmin, (req, res) => {
  const rows = db.prepare(`
    SELECT n.*, sur.previousStock, sur.requestedStock, sur.status AS requestStatus, p.name AS productName
    FROM "Notifications" n
    LEFT JOIN "StockUpdateRequests" sur ON sur.id = n.requestId
    LEFT JOIN "Products" p ON p.id = n.productId
    ORDER BY n.created_at DESC LIMIT 50
  `).all();
  const unreadCount = db.prepare(`SELECT COUNT(*) AS c FROM "Notifications" WHERE isRead = 0`).get().c;
  res.json({ notifications: rows, unreadCount });
});

app.post('/api/markNotificationsRead', requireAdmin, (req, res) => {
  const { id, all } = req.body || {};
  if (all) db.prepare(`UPDATE "Notifications" SET isRead = 1 WHERE isRead = 0`).run();
  else if (id) db.prepare(`UPDATE "Notifications" SET isRead = 1 WHERE id = ?`).run(id);
  res.json({ success: true });
});

// ---------- Admin: supplier payout ledger ----------
app.post('/api/admin/getSupplierBalances', requireAdmin, (req, res) => {
  const suppliers = db.prepare(`SELECT id, name FROM "Suppliers" ORDER BY name ASC`).all();
  const balances = suppliers.map(s => ({ supplierId: s.id, supplierName: s.name, ...getSupplierEarnings(s.id) }));
  res.json({ balances });
});

app.post('/api/admin/getSupplierPayouts', requireAdmin, (req, res) => {
  const { supplierId } = req.body || {};
  const supplier = db.prepare(`SELECT id, name FROM "Suppliers" WHERE id = ?`).get(supplierId);
  if (!supplier) return res.status(400).json({ error: 'Supplier not found' });
  const payouts = db.prepare(`
    SELECT * FROM "SupplierPayouts" WHERE supplierId = ? ORDER BY date DESC, created_at DESC
  `).all(supplierId);
  res.json({ supplier, payouts, ...getSupplierEarnings(supplierId) });
});

app.post('/api/admin/recordPayout', requireAdmin, (req, res) => {
  const { supplierId, amount, date, notes } = req.body || {};
  const supplier = db.prepare(`SELECT id FROM "Suppliers" WHERE id = ?`).get(supplierId);
  if (!supplier) return res.status(400).json({ error: 'Supplier not found' });
  if (!amount || Number(amount) <= 0) return res.status(400).json({ error: 'Enter an amount greater than 0' });
  const id = uuid();
  db.prepare(`
    INSERT INTO "SupplierPayouts" (id, supplierId, amount, date, notes, recordedBy) VALUES (?,?,?,?,?,?)
  `).run(id, supplierId, Number(amount), date || new Date().toISOString().slice(0, 10), notes ?? null, req.user.username);
  res.json({ success: true, id });
});

app.post('/api/admin/deletePayout', requireAdmin, (req, res) => {
  const { id } = req.body || {};
  db.prepare(`DELETE FROM "SupplierPayouts" WHERE id = ?`).run(id);
  res.json({ success: true });
});

// ---------- Admin: manage supplier logins ----------
app.post('/api/admin/getUsers', requireAdmin, (req, res) => {
  const rows = db.prepare(`
    SELECT u.id, u.username, u.role, u.supplierId, u.status, u.created_at, sup.name AS supplierName
    FROM "Users" u LEFT JOIN "Suppliers" sup ON sup.id = u.supplierId
    ORDER BY u.role ASC, u.username ASC
  `).all();
  res.json({ users: rows });
});

app.post('/api/admin/createSupplierLogin', requireAdmin, (req, res) => {
  const { supplierId, username, password } = req.body || {};
  if (!supplierId || !username || !password) {
    return res.status(400).json({ error: 'supplierId, username and password are required' });
  }
  if (String(password).length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });
  const supplier = db.prepare(`SELECT * FROM "Suppliers" WHERE id = ?`).get(supplierId);
  if (!supplier) return res.status(400).json({ error: 'Supplier not found' });
  const existing = db.prepare(`SELECT id FROM "Users" WHERE username = ?`).get(String(username).trim());
  if (existing) return res.status(400).json({ error: 'That username is already taken' });

  const id = uuid();
  db.prepare(`
    INSERT INTO "Users" (id, username, passwordHash, role, supplierId, status) VALUES (?,?,?,?,?,?)
  `).run(id, String(username).trim(), hashPassword(password), 'supplier', supplierId, 'Active');
  res.json({ success: true, id });
});

app.post('/api/admin/resetPassword', requireAdmin, (req, res) => {
  const { userId, newPassword } = req.body || {};
  if (!newPassword || String(newPassword).length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }
  const user = db.prepare(`SELECT * FROM "Users" WHERE id = ?`).get(userId);
  if (!user) return res.status(400).json({ error: 'User not found' });
  db.prepare(`UPDATE "Users" SET passwordHash = ? WHERE id = ?`).run(hashPassword(newPassword), userId);
  res.json({ success: true });
});

app.post('/api/admin/setUserStatus', requireAdmin, (req, res) => {
  const { userId, status } = req.body || {};
  if (!['Active', 'Disabled'].includes(status)) return res.status(400).json({ error: 'Invalid status' });
  const user = db.prepare(`SELECT * FROM "Users" WHERE id = ?`).get(userId);
  if (!user) return res.status(400).json({ error: 'User not found' });
  if (user.role === 'admin') return res.status(400).json({ error: "Can't disable the admin account" });
  db.prepare(`UPDATE "Users" SET status = ? WHERE id = ?`).run(status, userId);
  res.json({ success: true });
});

// ---------- Supplier portal ----------
// A supplier's own dashboard: their products (with real stock numbers),
// and their running profit share — 1/3 of the profit on every sale of
// *their* products only, never anyone else's.
app.post('/api/supplier/summary', requireSupplier, (req, res) => {
  const supplierId = req.user.supplierId;

  const products = db.prepare(`
    SELECT p.* FROM "Products" p
    JOIN "ProductsSuppliers" ps ON ps.productsId = p.id
    WHERE ps.suppliersId = ?
    ORDER BY p.name ASC
  `).all(supplierId);

  const salesRows = db.prepare(`
    SELECT s.id, s.date, s.quantity, s.profit, p.name AS productName, p.id AS productId
    FROM "Sales" s
    JOIN "ProductsSales" pl ON pl.salesId = s.id
    JOIN "Products" p ON p.id = pl.productsId
    JOIN "ProductsSuppliers" ps ON ps.productsId = p.id
    WHERE ps.suppliersId = ?
    ORDER BY s.date DESC, s.created_at DESC
    LIMIT 200
  `).all(supplierId);

  const pendingRequests = db.prepare(`
    SELECT productId, requestedStock, previousStock FROM "StockUpdateRequests"
    WHERE supplierId = ? AND status = 'pending'
  `).all(supplierId);
  const pendingByProduct = Object.fromEntries(pendingRequests.map(r => [r.productId, r]));

  const earnings = getSupplierEarnings(supplierId);

  res.json({
    products: products.map(p => ({
      id: p.id, name: p.name || '', sku: p.sku || '', category: p.category || null,
      brand: p.brand || '', description: p.description || '', unit: p.unit || 'Piece',
      costPrice: p.costPrice ?? 0, sellingPrice: p.sellingPrice ?? p.unitPrice ?? null,
      currentStock: p.currentStock ?? 0, lowStockThreshold: p.lowStockThreshold ?? 10,
      status: p.status || 'Active',
      stockFlag: (p.currentStock ?? 0) <= 0 ? 'Out of Stock'
        : (p.currentStock ?? 0) <= (p.lowStockThreshold ?? 10) ? 'Low Stock' : 'OK',
      pendingStockRequest: pendingByProduct[p.id]
        ? { previousStock: pendingByProduct[p.id].previousStock, requestedStock: pendingByProduct[p.id].requestedStock }
        : null,
    })),
    recentSales: salesRows.slice(0, 30).map(s => ({
      id: s.id, date: s.date, productName: s.productName, quantity: s.quantity,
      profit: s.profit ?? 0, share: (s.profit ?? 0) / 3,
    })),
    totalProfit: earnings.totalProfit, totalShare: earnings.totalShare, thisMonthShare: earnings.thisMonthShare,
    totalPaid: earnings.totalPaid, balance: earnings.balance,
  });
});

app.post('/api/supplier/saveProduct', requireSupplier, (req, res) => {
  const b = req.body || {};
  const supplierId = req.user.supplierId;
  if (!b.name || !String(b.name).trim()) return res.status(400).json({ error: 'Name is required' });

  if (b.id) {
    const owner = productSupplierId(b.id);
    if (owner !== supplierId) return res.status(403).json({ error: 'Not your product' });

    const existing = db.prepare(`SELECT currentStock, lowStockThreshold, name FROM "Products" WHERE id=?`).get(b.id);
    const oldStock = existing?.currentStock ?? 0;
    const threshold = existing?.lowStockThreshold ?? 10;
    const wasLowOrOut = oldStock <= threshold; // covers both Low Stock and Out of Stock
    const newStockRequested = b.currentStock !== undefined && b.currentStock !== null ? Number(b.currentStock) : oldStock;
    const stockChanged = newStockRequested !== oldStock;
    const needsConfirmation = wasLowOrOut && stockChanged;

    // Everything except the stock quantity updates immediately. A restock on
    // a product that was low/out of stock is held for the admin to confirm
    // before it takes effect (keeps the supplier's stock update honest).
    db.prepare(`
      UPDATE "Products" SET name=?, sku=?, category=?, brand=?, unit=?, description=?,
        costPrice=?, lowStockThreshold=?
        ${needsConfirmation ? '' : ', currentStock=?'}
      WHERE id=?
    `).run(
      ...(needsConfirmation
        ? [b.name, b.sku ?? null, b.category ?? null, b.brand ?? null, b.unit ?? 'Piece', b.description ?? null, b.costPrice ?? null, b.lowStockThreshold ?? 10, b.id]
        : [b.name, b.sku ?? null, b.category ?? null, b.brand ?? null, b.unit ?? 'Piece', b.description ?? null, b.costPrice ?? null, b.lowStockThreshold ?? 10, newStockRequested, b.id])
    );

    if (!needsConfirmation) {
      db.prepare(`UPDATE "Products" SET status=? WHERE id=?`)
        .run(newStockRequested <= 0 ? 'Out of Stock' : 'Active', b.id);
      return res.json({ success: true, id: b.id, pendingStockUpdate: false });
    }

    const reqId = uuid();
    db.prepare(`
      INSERT INTO "StockUpdateRequests" (id, productId, supplierId, previousStock, requestedStock, status)
      VALUES (?,?,?,?,?,'pending')
    `).run(reqId, b.id, supplierId, oldStock, newStockRequested);

    const supplier = db.prepare(`SELECT name FROM "Suppliers" WHERE id = ?`).get(supplierId);
    db.prepare(`INSERT INTO "Notifications" (id, type, message, productId, requestId) VALUES (?,?,?,?,?)`).run(
      uuid(), 'stock_request',
      `${supplier?.name || 'A supplier'} wants to update stock for "${existing?.name || b.name}" from ${oldStock} to ${newStockRequested} — needs confirmation.`,
      b.id, reqId
    );

    return res.json({ success: true, id: b.id, pendingStockUpdate: true });
  }

  const id = uuid();
  const sku = (b.sku && String(b.sku).trim()) || `SUP-${Date.now().toString(36).toUpperCase()}`;
  db.prepare(`
    INSERT INTO "Products" (id, name, sku, category, brand, unit, description, costPrice, currentStock, lowStockThreshold, status, createdByUserId)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
  `).run(
    id, b.name, sku, b.category ?? null, b.brand ?? null, b.unit ?? 'Piece', b.description ?? null,
    b.costPrice ?? null, b.currentStock ?? 0, b.lowStockThreshold ?? 10,
    (b.currentStock ?? 0) <= 0 ? 'Out of Stock' : 'Active', req.user.id
  );
  db.prepare(`INSERT INTO "ProductsSuppliers" (productsId, suppliersId) VALUES (?,?)`).run(id, supplierId);

  if ((b.currentStock ?? 0) > 0) {
    const moveId = uuid();
    const ref = nextCounter('StockMovements', 'reference');
    db.prepare(`
      INSERT INTO "StockMovements" (id, reference, type, quantity, notes, recordedBy) VALUES (?,?,?,?,?,?)
    `).run(moveId, ref, 'Stock In', b.currentStock, 'Added by supplier', req.user.username);
    db.prepare(`INSERT INTO "ProductsStockMovements" (productsId, stockMovementsId) VALUES (?,?)`).run(id, moveId);
    db.prepare(`INSERT INTO "StockMovementsSuppliers" (stockMovementsId, suppliersId) VALUES (?,?)`).run(moveId, supplierId);
  }

  const supplier = db.prepare(`SELECT name FROM "Suppliers" WHERE id = ?`).get(supplierId);
  db.prepare(`INSERT INTO "Notifications" (id, type, message, productId) VALUES (?,?,?,?)`).run(
    uuid(), 'supplier_product',
    `${supplier?.name || 'A supplier'} added a new product: "${b.name}" — set a selling price to activate it.`,
    id
  );

  res.json({ success: true, id });
});

// Suppliers can add a brand-new category (but not edit/delete existing ones).
app.post('/api/supplier/addCategory', requireSupplier, (req, res) => {
  const { name } = req.body || {};
  if (!name || !String(name).trim()) return res.status(400).json({ error: 'Category name is required' });
  const trimmed = String(name).trim();
  const existing = db.prepare(`SELECT * FROM "Categories" WHERE LOWER(name) = LOWER(?)`).get(trimmed);
  if (existing) return res.json({ success: true, id: existing.id });
  const id = uuid();
  db.prepare(`INSERT INTO "Categories" (id, name, status) VALUES (?,?,?)`).run(id, trimmed, 'Active');
  res.json({ success: true, id });
});

app.post('/api/supplier/bulkImportProducts', requireSupplier, (req, res) => {
  const { rows } = req.body || {};
  const supplierId = req.user.supplierId;
  if (!Array.isArray(rows) || rows.length === 0) return res.status(400).json({ error: 'No rows to import' });
  if (rows.length > 500) return res.status(400).json({ error: 'Max 500 rows per import — split into smaller batches.' });

  const insertProduct = db.prepare(`
    INSERT INTO "Products" (id, name, sku, category, brand, unit, description, costPrice, currentStock, lowStockThreshold, status, createdByUserId)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
  `);
  const linkSupplier = db.prepare(`INSERT INTO "ProductsSuppliers" (productsId, suppliersId) VALUES (?,?)`);
  const insertMove = db.prepare(`INSERT INTO "StockMovements" (id, reference, type, quantity, notes, recordedBy) VALUES (?,?,?,?,?,?)`);
  const linkMove = db.prepare(`INSERT INTO "ProductsStockMovements" (productsId, stockMovementsId) VALUES (?,?)`);
  const linkMoveSupplier = db.prepare(`INSERT INTO "StockMovementsSuppliers" (stockMovementsId, suppliersId) VALUES (?,?)`);

  const results = { inserted: 0, errors: [] };
  rows.forEach((r, idx) => {
    const rowNum = idx + 2;
    const name = (r.name || '').trim();
    if (!name) { results.errors.push({ row: rowNum, error: 'Missing product name — row skipped' }); return; }

    const costPrice = r.costPrice !== undefined && r.costPrice !== '' ? Number(r.costPrice) : null;
    const currentStock = r.currentStock !== undefined && r.currentStock !== '' ? Number(r.currentStock) : 0;
    const lowStockThreshold = r.lowStockThreshold !== undefined && r.lowStockThreshold !== '' ? Number(r.lowStockThreshold) : 10;

    if ([costPrice, currentStock, lowStockThreshold].some(v => v !== null && Number.isNaN(v))) {
      results.errors.push({ row: rowNum, error: 'costPrice, currentStock, or lowStockThreshold is not a valid number — row skipped' });
      return;
    }

    const id = uuid();
    const sku = (r.sku || '').trim() || `SUP-${Date.now().toString(36).toUpperCase()}${idx}`;
    const status = currentStock <= 0 ? 'Out of Stock' : 'Active';

    insertProduct.run(
      id, name, sku, r.category || null, r.brand || null, r.unit || 'Piece', r.description || null,
      costPrice, currentStock, lowStockThreshold, status, req.user.id
    );
    linkSupplier.run(id, supplierId);

    if (currentStock > 0) {
      const moveId = uuid();
      const ref = nextCounter('StockMovements', 'reference');
      insertMove.run(moveId, ref, 'Stock In', currentStock, 'Added by supplier (bulk import)', req.user.username);
      linkMove.run(id, moveId);
      linkMoveSupplier.run(moveId, supplierId);
    }
    results.inserted++;
  });

  if (results.inserted > 0) {
    const supplier = db.prepare(`SELECT name FROM "Suppliers" WHERE id = ?`).get(supplierId);
    db.prepare(`INSERT INTO "Notifications" (id, type, message, productId) VALUES (?,?,?,?)`).run(
      uuid(), 'supplier_bulk_import',
      `${supplier?.name || 'A supplier'} bulk-added ${results.inserted} new product${results.inserted === 1 ? '' : 's'} via CSV import — set selling prices to activate them.`,
      null
    );
  }

  res.json({ success: true, ...results });
});

// Suppliers can no longer delete their own products — only edit them.
// If a product genuinely needs to go, the admin discontinues/removes it.
app.post('/api/supplier/deleteProduct', requireSupplier, (req, res) => {
  res.status(403).json({ error: "Suppliers can't delete products — ask the admin to remove it for you." });
});

// ---------- Products (admin only — suppliers use /api/supplier/*) ----------
app.post('/api/getProducts', requireAdmin, (req, res) => {
  const { search, category, status, id, offset = 0, limit = 50 } = req.body || {};
  let where = [];
  let params = [];
  if (id) { where.push(`id = ?`); params.push(id); }
  if (search) {
    where.push(`(LOWER(name) LIKE ? OR LOWER(sku) LIKE ? OR LOWER(brand) LIKE ?)`);
    const q = `%${search.toLowerCase()}%`;
    params.push(q, q, q);
  }
  if (category) { where.push(`category = ?`); params.push(category); }
  if (status) { where.push(`status = ?`); params.push(status); }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const total = db.prepare(`SELECT COUNT(*) AS c FROM "Products" ${whereSql}`).get(...params).c;
  const rows = db.prepare(`
    SELECT * FROM "Products" ${whereSql} ORDER BY name ASC LIMIT ? OFFSET ?
  `).all(...params, limit, offset);

  res.json({
    products: rows.map(r => ({
      id: r.id, name: r.name || '', sku: r.sku || '', category: r.category || null,
      brand: r.brand || '', unit: r.unit || 'Piece', description: r.description || '',
      costPrice: r.costPrice ?? 0, sellingPrice: r.sellingPrice ?? r.unitPrice ?? 0,
      currentStock: r.currentStock ?? 0, lowStockThreshold: r.lowStockThreshold ?? 20,
      status: r.status || 'Active', image: r.image ? JSON.parse(r.image) : undefined,
    })),
    hasMore: offset + limit < total,
    total,
  });
});

app.post('/api/saveProduct', requireAdmin, (req, res) => {
  const b = req.body || {};
  if (b.id) {
    db.prepare(`
      UPDATE "Products" SET name=?, sku=?, category=?, brand=?, unit=?, description=?,
        costPrice=?, sellingPrice=?, unitPrice=?, currentStock=?, lowStockThreshold=?, status=?
      WHERE id=?
    `).run(
      b.name, b.sku ?? null, b.category ?? null, b.brand ?? null, b.unit ?? 'Piece',
      b.description ?? null, b.costPrice ?? null, b.sellingPrice ?? null, b.sellingPrice ?? null,
      b.currentStock ?? 0, b.lowStockThreshold ?? 20, b.status ?? 'Active', b.id
    );
    if (b.supplierId) {
      db.prepare(`DELETE FROM "ProductsSuppliers" WHERE productsId=?`).run(b.id);
      db.prepare(`INSERT INTO "ProductsSuppliers" (productsId, suppliersId) VALUES (?,?)`).run(b.id, b.supplierId);
    }
    // Once a selling price is set, the thing the notification was nudging
    // you to do is done — clear it instead of leaving it sitting there read.
    if (b.sellingPrice) {
      db.prepare(`DELETE FROM "Notifications" WHERE productId = ?`).run(b.id);
    }
    return res.json({ success: true, id: b.id });
  }
  const id = uuid();
  db.prepare(`
    INSERT INTO "Products" (id, name, sku, category, brand, unit, description, costPrice, sellingPrice, unitPrice, currentStock, lowStockThreshold, status)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
  `).run(
    id, b.name, b.sku ?? null, b.category ?? null, b.brand ?? null, b.unit ?? 'Piece',
    b.description ?? null, b.costPrice ?? null, b.sellingPrice ?? null, b.sellingPrice ?? null,
    b.currentStock ?? 0, b.lowStockThreshold ?? 20, b.status ?? 'Active'
  );
  if (b.supplierId) db.prepare(`INSERT INTO "ProductsSuppliers" (productsId, suppliersId) VALUES (?,?)`).run(id, b.supplierId);
  res.json({ success: true, id });
});

app.post('/api/deleteProduct', requireAdmin, (req, res) => {
  const { id } = req.body || {};
  const hasSales = db.prepare(`SELECT COUNT(*) AS c FROM "ProductsSales" WHERE productsId = ?`).get(id).c;
  if (hasSales > 0) return res.status(400).json({ error: "Can't delete a product that already has recorded sales." });
  db.prepare(`DELETE FROM "ProductsSuppliers" WHERE productsId=?`).run(id);
  db.prepare(`DELETE FROM "ProductsStockMovements" WHERE productsId=?`).run(id);
  db.prepare(`DELETE FROM "Notifications" WHERE productId=?`).run(id);
  db.prepare(`DELETE FROM "Products" WHERE id=?`).run(id);
  res.json({ success: true });
});

app.post('/api/bulkImportProducts', requireAdmin, (req, res) => {
  const { rows } = req.body || {};
  if (!Array.isArray(rows) || rows.length === 0) return res.status(400).json({ error: 'No rows to import' });
  if (rows.length > 500) return res.status(400).json({ error: 'Max 500 rows per import — split into smaller batches.' });

  const suppliersByName = new Map(
    db.prepare(`SELECT id, name FROM "Suppliers"`).all().map(s => [s.name.trim().toLowerCase(), s.id])
  );
  const insertProduct = db.prepare(`
    INSERT INTO "Products" (id, name, sku, category, brand, unit, description, costPrice, sellingPrice, unitPrice, currentStock, lowStockThreshold, status)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
  `);
  const linkSupplier = db.prepare(`INSERT INTO "ProductsSuppliers" (productsId, suppliersId) VALUES (?,?)`);

  const results = { inserted: 0, errors: [] };
  rows.forEach((r, idx) => {
    const rowNum = idx + 2; // +2 accounts for the header row the person sees in their spreadsheet
    const name = (r.name || '').trim();
    if (!name) { results.errors.push({ row: rowNum, error: 'Missing product name — row skipped' }); return; }

    const costPrice = r.costPrice !== undefined && r.costPrice !== '' ? Number(r.costPrice) : null;
    const sellingPrice = r.sellingPrice !== undefined && r.sellingPrice !== '' ? Number(r.sellingPrice) : null;
    const currentStock = r.currentStock !== undefined && r.currentStock !== '' ? Number(r.currentStock) : 0;
    const lowStockThreshold = r.lowStockThreshold !== undefined && r.lowStockThreshold !== '' ? Number(r.lowStockThreshold) : 20;

    if ([costPrice, sellingPrice, currentStock, lowStockThreshold].some(v => v !== null && Number.isNaN(v))) {
      results.errors.push({ row: rowNum, error: 'costPrice, sellingPrice, currentStock, or lowStockThreshold is not a valid number — row skipped' });
      return;
    }

    const id = uuid();
    const sku = (r.sku || '').trim() || `AUTO-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;

    insertProduct.run(
      id, name, sku, r.category || null, r.brand || null, r.unit || 'Piece', r.description || null,
      costPrice, sellingPrice, sellingPrice, currentStock, lowStockThreshold, 'Active'
    );

    const supplierName = (r.supplierName || '').trim();
    if (supplierName) {
      const supplierId = suppliersByName.get(supplierName.toLowerCase());
      if (supplierId) linkSupplier.run(id, supplierId);
      else results.errors.push({ row: rowNum, error: `Added, but supplier "${supplierName}" wasn't found — left unassigned` });
    }
    results.inserted++;
  });

  res.json({ success: true, ...results });
});

// ---------- Stock movements (admin only) ----------
app.post('/api/getMovements', requireAdmin, (req, res) => {
  const { productId, type, offset = 0, limit = 50 } = req.body || {};
  let where = [];
  let params = [];
  if (productId) { where.push(`pl.productsId = ?`); params.push(productId); }
  if (type) { where.push(`sm.type = ?`); params.push(type); }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const total = db.prepare(`
    SELECT COUNT(*) AS c FROM "StockMovements" sm
    LEFT JOIN "ProductsStockMovements" pl ON pl.stockMovementsId = sm.id
    ${whereSql}
  `).get(...params).c;

  const rows = db.prepare(`
    SELECT sm.*, COALESCE(p.name,'Unknown') AS productName, p.id AS productId,
           COALESCE(sup.name,'') AS supplierName
    FROM "StockMovements" sm
    LEFT JOIN "ProductsStockMovements" pl ON pl.stockMovementsId = sm.id
    LEFT JOIN "Products" p ON p.id = pl.productsId
    LEFT JOIN "StockMovementsSuppliers" sl ON sl.stockMovementsId = sm.id
    LEFT JOIN "Suppliers" sup ON sup.id = sl.suppliersId
    ${whereSql}
    ORDER BY sm.created_at DESC, sm.reference DESC
    LIMIT ? OFFSET ?
  `).all(...params, limit, offset);

  res.json({
    movements: rows.map(r => ({
      id: r.id, reference: r.reference, type: r.type, quantity: r.quantity,
      notes: r.notes || '', date: r.created_at, productName: r.productName,
      productId: r.productId, purchasePrice: r.purchasePrice ?? null,
      supplierName: r.supplierName || '', invoiceReference: r.invoiceReference || '',
    })),
    hasMore: offset + limit < total,
    total,
  });
});

app.post('/api/recordStockMovement', requireAdmin, (req, res) => {
  const b = req.body || {};
  const product = db.prepare(`SELECT * FROM "Products" WHERE id=?`).get(b.productId);
  if (!product) return res.status(400).json({ error: 'Product not found' });

  let newStock;
  const current = product.currentStock ?? 0;
  if (b.type === 'Stock In' || b.type === 'Stock Returned') newStock = current + b.quantity;
  else if (b.type === 'Stock Out') newStock = Math.max(0, current - b.quantity);
  else newStock = b.quantity;

  const id = uuid();
  const ref = nextCounter('StockMovements', 'reference');
  db.prepare(`
    INSERT INTO "StockMovements" (id, reference, type, quantity, purchasePrice, invoiceReference, notes, recordedBy)
    VALUES (?,?,?,?,?,?,?,?)
  `).run(id, ref, b.type, b.quantity, b.purchasePrice ?? null, b.invoiceReference ?? null, b.notes ?? null, req.user.username);
  db.prepare(`INSERT INTO "ProductsStockMovements" (productsId, stockMovementsId) VALUES (?,?)`).run(b.productId, id);
  if (b.supplierId) db.prepare(`INSERT INTO "StockMovementsSuppliers" (stockMovementsId, suppliersId) VALUES (?,?)`).run(id, b.supplierId);

  db.prepare(`UPDATE "Products" SET currentStock=?, status=? WHERE id=?`)
    .run(newStock, newStock <= 0 ? 'Out of Stock' : 'Active', b.productId);

  res.json({ success: true, newStock });
});

// ---------- Sales (admin only) ----------
app.post('/api/getSales', requireAdmin, (req, res) => {
  const { dateFrom, dateTo, paymentMethodId, offset = 0, limit = 50 } = req.body || {};
  let where = [];
  let params = [];
  if (dateFrom) { where.push(`s.date >= ?`); params.push(dateFrom); }
  if (dateTo) { where.push(`s.date <= ?`); params.push(dateTo); }
  if (paymentMethodId) { where.push(`pml.paymentMethodsId = ?`); params.push(paymentMethodId); }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const total = db.prepare(`
    SELECT COUNT(*) AS c FROM "Sales" s
    LEFT JOIN "PaymentMethodsSales" pml ON pml.salesId = s.id
    ${whereSql}
  `).get(...params).c;

  const totals = db.prepare(`
    SELECT COALESCE(SUM(s.revenue),0) AS revenue, COALESCE(SUM(s.totalCost),0) AS cost,
           COALESCE(SUM(s.profit),0) AS profit, COALESCE(SUM(s.discount),0) AS discount
    FROM "Sales" s
    LEFT JOIN "PaymentMethodsSales" pml ON pml.salesId = s.id
    ${whereSql}
  `).get(...params);

  const rows = db.prepare(`
    SELECT s.*, COALESCE(p.name,'Unknown') AS productName, COALESCE(pm.name,'') AS paymentMethodName
    FROM "Sales" s
    LEFT JOIN "ProductsSales" pl ON pl.salesId = s.id
    LEFT JOIN "Products" p ON p.id = pl.productsId
    LEFT JOIN "PaymentMethodsSales" pml ON pml.salesId = s.id
    LEFT JOIN "PaymentMethods" pm ON pm.id = pml.paymentMethodsId
    ${whereSql}
    ORDER BY s.date DESC, s.created_at DESC
    LIMIT ? OFFSET ?
  `).all(...params, limit, offset);

  res.json({
    sales: rows.map(r => ({
      id: r.id, saleId: r.saleId, date: r.date, productName: r.productName,
      quantity: r.quantity, sellingPrice: r.sellingPrice, costPrice: r.costPrice,
      discount: r.discount ?? 0, revenue: r.revenue, totalCost: r.totalCost, profit: r.profit,
      paymentMethod: r.paymentMethodName || '', notes: r.notes || '',
    })),
    hasMore: offset + limit < total,
    total,
    totals: {
      revenue: totals.revenue ?? 0, cost: totals.cost ?? 0,
      profit: totals.profit ?? 0, discount: totals.discount ?? 0,
    },
  });
});

app.post('/api/recordSale', requireAdmin, (req, res) => {
  const b = req.body || {};
  const product = db.prepare(`SELECT * FROM "Products" WHERE id=?`).get(b.productId);
  if (!product) return res.status(400).json({ error: 'Product not found' });

  const qty = b.quantity;
  const discount = b.discount ?? 0;
  const revenue = b.sellingPrice * qty;
  const totalCost = b.costPrice * qty;
  const profit = revenue - totalCost - discount;

  const id = uuid();
  const saleId = nextCounter('Sales', 'saleId');
  db.prepare(`
    INSERT INTO "Sales" (id, saleId, date, quantity, sellingPrice, costPrice, discount, revenue, totalCost, profit, notes, recordedBy)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
  `).run(id, saleId, b.date || new Date().toISOString().slice(0, 10), qty, b.sellingPrice, b.costPrice,
    discount, revenue, totalCost, profit, b.notes ?? null, req.user.username);
  db.prepare(`INSERT INTO "ProductsSales" (productsId, salesId) VALUES (?,?)`).run(b.productId, id);
  if (b.paymentMethodId) db.prepare(`INSERT INTO "PaymentMethodsSales" (paymentMethodsId, salesId) VALUES (?,?)`).run(b.paymentMethodId, id);

  const newStock = Math.max(0, (product.currentStock ?? 0) - qty);
  db.prepare(`UPDATE "Products" SET currentStock=?, status=? WHERE id=?`)
    .run(newStock, newStock <= 0 ? 'Out of Stock' : 'Active', b.productId);

  const moveId = uuid();
  const ref = nextCounter('StockMovements', 'reference');
  db.prepare(`INSERT INTO "StockMovements" (id, reference, type, quantity, notes, recordedBy) VALUES (?,?,?,?,?,?)`)
    .run(moveId, ref, 'Stock Out', qty, `Sale #${saleId}`, req.user.username);
  db.prepare(`INSERT INTO "ProductsStockMovements" (productsId, stockMovementsId) VALUES (?,?)`).run(b.productId, moveId);

  res.json({ success: true, id, profit });
});

app.post('/api/deleteSale', requireAdmin, (req, res) => {
  db.prepare(`DELETE FROM "Sales" WHERE id=?`).run(req.body.id);
  res.json({ success: true });
});

// ---------- Expenses (admin only) ----------
app.post('/api/getExpenses', requireAdmin, (req, res) => {
  const { search, dateFrom, dateTo, categoryId, offset = 0, limit = 50 } = req.body || {};
  let where = [];
  let params = [];
  if (search) { where.push(`LOWER(e.description) LIKE ?`); params.push(`%${search.toLowerCase()}%`); }
  if (dateFrom) { where.push(`e.date >= ?`); params.push(dateFrom); }
  if (dateTo) { where.push(`e.date <= ?`); params.push(dateTo); }
  if (categoryId) { where.push(`ecl.expenseCategoriesId = ?`); params.push(categoryId); }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const joins = `
    LEFT JOIN "ExpenseCategoriesExpenses" ecl ON ecl.expensesId = e.id
    LEFT JOIN "ExpenseCategories" ec ON ec.id = ecl.expenseCategoriesId
    LEFT JOIN "ExpensesPaymentMethods" epm ON epm.expensesId = e.id
    LEFT JOIN "PaymentMethods" pm ON pm.id = epm.paymentMethodsId
  `;

  const totalsRow = db.prepare(`
    SELECT COUNT(DISTINCT e.id) AS total, COALESCE(SUM(DISTINCT e.amount),0) AS totalAmount
    FROM "Expenses" e ${joins} ${whereSql}
  `).get(...params);

  const rows = db.prepare(`
    SELECT e.*, COALESCE(ec.name,'') AS categoryName, COALESCE(pm.name,'') AS paymentMethodName
    FROM "Expenses" e ${joins} ${whereSql}
    GROUP BY e.id
    ORDER BY e.date DESC, e.created_at DESC
    LIMIT ? OFFSET ?
  `).all(...params, limit, offset);

  res.json({
    expenses: rows.map(r => ({
      id: r.id, expenseId: r.expenseId, date: r.date, description: r.description || '',
      amount: r.amount ?? 0, categoryName: r.categoryName || '',
      paymentMethod: r.paymentMethodName || '', notes: r.notes || '',
    })),
    hasMore: offset + limit < totalsRow.total,
    total: totalsRow.total,
    totalAmount: totalsRow.totalAmount ?? 0,
  });
});

app.post('/api/saveExpense', requireAdmin, (req, res) => {
  const b = req.body || {};
  if (b.id) {
    db.prepare(`UPDATE "Expenses" SET date=?, description=?, amount=?, notes=? WHERE id=?`)
      .run(b.date, b.description, b.amount, b.notes ?? null, b.id);
    db.prepare(`DELETE FROM "ExpenseCategoriesExpenses" WHERE expensesId=?`).run(b.id);
    db.prepare(`DELETE FROM "ExpensesPaymentMethods" WHERE expensesId=?`).run(b.id);
    if (b.categoryId) db.prepare(`INSERT INTO "ExpenseCategoriesExpenses" (expenseCategoriesId, expensesId) VALUES (?,?)`).run(b.categoryId, b.id);
    if (b.paymentMethodId) db.prepare(`INSERT INTO "ExpensesPaymentMethods" (expensesId, paymentMethodsId) VALUES (?,?)`).run(b.id, b.paymentMethodId);
    return res.json({ success: true, id: b.id });
  }
  const id = uuid();
  const expenseId = nextCounter('Expenses', 'expenseId');
  db.prepare(`INSERT INTO "Expenses" (id, expenseId, date, description, amount, notes, recordedBy) VALUES (?,?,?,?,?,?,?)`)
    .run(id, expenseId, b.date, b.description, b.amount, b.notes ?? null, req.user.username);
  if (b.categoryId) db.prepare(`INSERT INTO "ExpenseCategoriesExpenses" (expenseCategoriesId, expensesId) VALUES (?,?)`).run(b.categoryId, id);
  if (b.paymentMethodId) db.prepare(`INSERT INTO "ExpensesPaymentMethods" (expensesId, paymentMethodsId) VALUES (?,?)`).run(id, b.paymentMethodId);
  res.json({ success: true, id });
});

app.post('/api/deleteExpense', requireAdmin, (req, res) => {
  db.prepare(`DELETE FROM "Expenses" WHERE id=?`).run(req.body.id);
  res.json({ success: true });
});

// ---------- Suppliers (admin only) ----------
app.post('/api/getSuppliers', requireAdmin, (req, res) => {
  const { search, offset = 0, limit = 50 } = req.body || {};
  let where = [];
  let params = [];
  if (search) {
    where.push(`(LOWER(name) LIKE ? OR LOWER(email) LIKE ? OR LOWER(phone) LIKE ?)`);
    const q = `%${search.toLowerCase()}%`;
    params.push(q, q, q);
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const total = db.prepare(`SELECT COUNT(*) AS c FROM "Suppliers" ${whereSql}`).get(...params).c;
  const rows = db.prepare(`SELECT * FROM "Suppliers" ${whereSql} ORDER BY name ASC LIMIT ? OFFSET ?`).all(...params, limit, offset);
  const withLogin = new Set(
    db.prepare(`SELECT DISTINCT supplierId FROM "Users" WHERE role='supplier'`).all().map(r => r.supplierId)
  );
  res.json({
    suppliers: rows.map(r => ({
      id: r.id, name: r.name || '', phone: r.phone || '', email: r.email || '',
      address: r.address || '', notes: r.notes || '', status: r.status || 'Active',
      hasLogin: withLogin.has(r.id),
    })),
    hasMore: offset + limit < total,
    total,
  });
});

app.post('/api/saveSupplier', requireAdmin, (req, res) => {
  const b = req.body || {};
  if (b.id) {
    db.prepare(`UPDATE "Suppliers" SET name=?, phone=?, email=?, address=?, notes=?, status=? WHERE id=?`)
      .run(b.name, b.phone ?? null, b.email ?? null, b.address ?? null, b.notes ?? null, b.status ?? 'Active', b.id);
    return res.json({ success: true, id: b.id });
  }
  const id = uuid();
  db.prepare(`INSERT INTO "Suppliers" (id, name, phone, email, address, notes, status) VALUES (?,?,?,?,?,?,?)`)
    .run(id, b.name, b.phone ?? null, b.email ?? null, b.address ?? null, b.notes ?? null, b.status ?? 'Active');
  res.json({ success: true, id });
});

app.post('/api/deleteSupplier', requireAdmin, (req, res) => {
  db.prepare(`DELETE FROM "Suppliers" WHERE id=?`).run(req.body.id);
  res.json({ success: true });
});

// ---------- Lookups (categories / expense categories / payment methods) ----------
// Read access is shared (suppliers need Categories for the "add product"
// form); write access is admin only.
app.post('/api/getLookups', (req, res) => {
  const { type } = req.body || {};
  if (type === 'paymentMethods') {
    const rows = db.prepare(`SELECT * FROM "PaymentMethods" ORDER BY name ASC LIMIT 100`).all();
    return res.json({ items: rows.map(r => ({ id: r.id, name: r.name || '', status: r.status || 'Active' })) });
  }
  if (type === 'expenseCategories') {
    const rows = db.prepare(`SELECT * FROM "ExpenseCategories" ORDER BY name ASC LIMIT 100`).all();
    return res.json({ items: rows.map(r => ({ id: r.id, name: r.name || '', description: r.description || '', status: r.status || 'Active' })) });
  }
  const rows = db.prepare(`SELECT * FROM "Categories" ORDER BY name ASC LIMIT 100`).all();
  res.json({ items: rows.map(r => ({ id: r.id, name: r.name || '', prefix: r.prefix || '', description: r.description || '', status: r.status || 'Active' })) });
});

app.post('/api/saveLookup', requireAdmin, (req, res) => {
  const b = req.body || {};
  const table = b.type === 'paymentMethod' ? 'PaymentMethods' : b.type === 'expenseCategory' ? 'ExpenseCategories' : 'Categories';
  if (b.id) {
    if (table === 'Categories') {
      db.prepare(`UPDATE "Categories" SET name=?, prefix=?, description=?, status=? WHERE id=?`)
        .run(b.name, b.prefix ?? null, b.description ?? null, b.status ?? 'Active', b.id);
    } else if (table === 'ExpenseCategories') {
      db.prepare(`UPDATE "ExpenseCategories" SET name=?, description=?, status=? WHERE id=?`)
        .run(b.name, b.description ?? null, b.status ?? 'Active', b.id);
    } else {
      db.prepare(`UPDATE "PaymentMethods" SET name=?, status=? WHERE id=?`).run(b.name, b.status ?? 'Active', b.id);
    }
    return res.json({ success: true, id: b.id });
  }
  const id = uuid();
  if (table === 'Categories') {
    db.prepare(`INSERT INTO "Categories" (id, name, prefix, description, status) VALUES (?,?,?,?,?)`)
      .run(id, b.name, b.prefix ?? null, b.description ?? null, b.status ?? 'Active');
  } else if (table === 'ExpenseCategories') {
    db.prepare(`INSERT INTO "ExpenseCategories" (id, name, description, status) VALUES (?,?,?,?)`)
      .run(id, b.name, b.description ?? null, b.status ?? 'Active');
  } else {
    db.prepare(`INSERT INTO "PaymentMethods" (id, name, status) VALUES (?,?,?)`).run(id, b.name, b.status ?? 'Active');
  }
  res.json({ success: true, id });
});

app.post('/api/deleteLookup', requireAdmin, (req, res) => {
  const { type, id } = req.body || {};
  const table = type === 'paymentMethod' ? 'PaymentMethods' : type === 'expenseCategory' ? 'ExpenseCategories' : 'Categories';
  db.prepare(`DELETE FROM "${table}" WHERE id=?`).run(id);
  res.json({ success: true });
});

// ---------- Dashboard ----------
app.post('/api/getDashboard', requireAdmin, (req, res) => {
  const today = new Date().toISOString().slice(0, 10);
  const monthStart = today.slice(0, 7) + '-01';

  const ps = db.prepare(`
    SELECT
      COUNT(*) AS totalProducts,
      COALESCE(SUM(currentStock * COALESCE(costPrice, unitPrice, 0)), 0) AS totalStockValue,
      COUNT(*) FILTER (WHERE currentStock > 0 AND currentStock <= lowStockThreshold) AS lowStockCount,
      COUNT(*) FILTER (WHERE currentStock IS NULL OR currentStock <= 0) AS outOfStockCount
    FROM "Products"
  `).get();

  const ss = db.prepare(`
    SELECT
      COALESCE(SUM(revenue),0) AS totalSales,
      COALESCE(SUM(totalCost),0) AS totalCogs,
      COALESCE(SUM(profit),0) AS grossProfit,
      COALESCE(SUM(revenue) FILTER (WHERE date = ?), 0) AS todaySales,
      COALESCE(SUM(revenue) FILTER (WHERE date >= ?), 0) AS monthSales,
      COALESCE(SUM(profit) FILTER (WHERE date >= ?), 0) AS monthProfit
    FROM "Sales"
  `).get(today, monthStart, monthStart);

  const totalExpenses = db.prepare(`SELECT COALESCE(SUM(amount),0) AS v FROM "Expenses"`).get().v;

  const recentSales = db.prepare(`
    SELECT s.id, s.saleId, s.date, s.revenue, s.profit, s.quantity, COALESCE(p.name,'Unknown') AS productName
    FROM "Sales" s
    LEFT JOIN "ProductsSales" pl ON pl.salesId = s.id
    LEFT JOIN "Products" p ON p.id = pl.productsId
    ORDER BY s.date DESC, s.created_at DESC LIMIT 5
  `).all();

  const stockAlertRows = db.prepare(`
    SELECT id, name, currentStock, lowStockThreshold, category FROM "Products"
    WHERE currentStock IS NULL OR currentStock <= lowStockThreshold
    ORDER BY currentStock ASC LIMIT 30
  `).all();

  const salesByDateRows = db.prepare(`
    SELECT strftime('%Y-%m-%d', date) AS date, COALESCE(SUM(revenue),0) AS revenue, COALESCE(SUM(profit),0) AS profit
    FROM "Sales"
    WHERE date IS NOT NULL AND date >= date('now', '-29 days')
    GROUP BY 1
  `).all();
  const salesByDate = Object.fromEntries(salesByDateRows.map(r => [r.date, r]));
  // Build a full 30-day run (today + the 29 days before it) so the trend
  // line shows every day, including zero-sales days, instead of skipping
  // straight from one sale to the next.
  const salesOverTime = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    const row = salesByDate[key];
    salesOverTime.push({ date: key, revenue: row?.revenue ?? 0, profit: row?.profit ?? 0 });
  }

  const expensesByCategory = db.prepare(`
    SELECT COALESCE(ec.name,'Uncategorized') AS category, COALESCE(SUM(e.amount),0) AS amount
    FROM "Expenses" e
    LEFT JOIN "ExpenseCategoriesExpenses" ecl ON ecl.expensesId = e.id
    LEFT JOIN "ExpenseCategories" ec ON ec.id = ecl.expenseCategoriesId
    GROUP BY ec.name ORDER BY amount DESC LIMIT 8
  `).all();

  const topProducts = db.prepare(`
    SELECT COALESCE(p.name,'Unknown') AS name, COALESCE(SUM(s.revenue),0) AS revenue, COALESCE(SUM(s.quantity),0) AS quantity
    FROM "Sales" s
    LEFT JOIN "ProductsSales" pl ON pl.salesId = s.id
    LEFT JOIN "Products" p ON p.id = pl.productsId
    GROUP BY p.name ORDER BY revenue DESC LIMIT 5
  `).all();

  const grossProfit = ss.grossProfit ?? 0;
  res.json({
    totalProducts: ps.totalProducts ?? 0,
    totalStockValue: ps.totalStockValue ?? 0,
    lowStockCount: ps.lowStockCount ?? 0,
    outOfStockCount: ps.outOfStockCount ?? 0,
    totalSales: ss.totalSales ?? 0,
    totalCogs: ss.totalCogs ?? 0,
    grossProfit,
    totalExpenses,
    netProfit: grossProfit - totalExpenses,
    todaySales: ss.todaySales ?? 0,
    monthSales: ss.monthSales ?? 0,
    monthProfit: ss.monthProfit ?? 0,
    recentSales: recentSales.map(r => ({
      id: r.id, saleId: r.saleId, date: r.date, productName: r.productName,
      revenue: r.revenue ?? 0, profit: r.profit ?? 0, quantity: r.quantity ?? 0,
    })),
    lowStockProducts: stockAlertRows.map(r => ({
      id: r.id, name: r.name, currentStock: r.currentStock ?? 0,
      lowStockThreshold: r.lowStockThreshold ?? 20, category: r.category || null,
    })),
    stockAlerts: stockAlertRows.map(r => ({
      id: r.id, name: r.name, currentStock: r.currentStock ?? 0,
      lowStockThreshold: r.lowStockThreshold ?? 20, category: r.category || null,
      stockFlag: (r.currentStock ?? 0) <= 0 ? 'Out of Stock' : 'Low Stock',
    })),
    salesOverTime: salesOverTime.map(r => ({ date: r.date, revenue: r.revenue, profit: r.profit })),
    expensesByCategory: expensesByCategory.map(r => ({ category: r.category, amount: r.amount })),
    topProducts: topProducts.map(r => ({ name: r.name, revenue: r.revenue, quantity: r.quantity })),
  });
});

// ---------- Profit & Loss ----------
app.post('/api/getProfitLoss', requireAdmin, (req, res) => {
  const { dateFrom, dateTo } = req.body || {};
  let salesWhere = [];
  let expenseWhere = [];
  let params = [];
  if (dateFrom) { salesWhere.push('date >= ?'); expenseWhere.push('date >= ?'); params.push(dateFrom); }
  if (dateTo) { salesWhere.push('date <= ?'); expenseWhere.push('date <= ?'); params.push(dateTo); }
  const salesWhereSql = salesWhere.length ? `WHERE ${salesWhere.join(' AND ')}` : '';
  const expenseWhereSql = expenseWhere.length ? `WHERE ${expenseWhere.join(' AND ')}` : '';
  const salesParams = dateFrom && dateTo ? [dateFrom, dateTo] : dateFrom || dateTo ? [dateFrom || dateTo] : [];

  const s = db.prepare(`
    SELECT COALESCE(SUM(revenue),0) AS revenue, COALESCE(SUM(totalCost),0) AS cogs,
           COALESCE(SUM(discount),0) AS totalDiscount, COUNT(*) AS salesCount
    FROM "Sales" ${salesWhereSql}
  `).get(...salesParams);

  const totalExpenses = db.prepare(`SELECT COALESCE(SUM(amount),0) AS v FROM "Expenses" ${expenseWhereSql}`).get(...salesParams).v;

  const expensesByCategory = db.prepare(`
    SELECT COALESCE(ec.name,'Uncategorized') AS category, COALESCE(SUM(e.amount),0) AS amount
    FROM "Expenses" e
    LEFT JOIN "ExpenseCategoriesExpenses" ecl ON ecl.expensesId = e.id
    LEFT JOIN "ExpenseCategories" ec ON ec.id = ecl.expenseCategoriesId
    ${expenseWhereSql.replace(/date/g, 'e.date')}
    GROUP BY ec.name ORDER BY amount DESC
  `).all(...salesParams);

  const monthlySales = db.prepare(`
    SELECT strftime('%Y-%m', date) AS month, COALESCE(SUM(revenue),0) AS revenue, COALESCE(SUM(totalCost),0) AS cogs
    FROM "Sales" ${salesWhereSql} GROUP BY 1
  `).all(...salesParams);
  const monthlyExpenses = db.prepare(`
    SELECT strftime('%Y-%m', date) AS month, COALESCE(SUM(amount),0) AS expenses
    FROM "Expenses" ${expenseWhereSql} GROUP BY 1
  `).all(...salesParams);
  const monthMap = new Map();
  for (const m of monthlySales) monthMap.set(m.month, { month: m.month, revenue: m.revenue, cogs: m.cogs, expenses: 0 });
  for (const m of monthlyExpenses) {
    const existing = monthMap.get(m.month) || { month: m.month, revenue: 0, cogs: 0, expenses: 0 };
    existing.expenses = m.expenses;
    monthMap.set(m.month, existing);
  }
  const monthlyPnL = [...monthMap.values()]
    .sort((a, b) => a.month.localeCompare(b.month))
    .map(m => ({ ...m, netProfit: m.revenue - m.cogs - m.expenses }));

  const revenue = s.revenue ?? 0;
  const cogs = s.cogs ?? 0;
  const grossProfit = revenue - cogs;

  res.json({
    revenue, cogs, grossProfit, totalExpenses,
    netProfit: grossProfit - totalExpenses,
    totalDiscount: s.totalDiscount ?? 0,
    salesCount: s.salesCount ?? 0,
    expensesByCategory: expensesByCategory.map(r => ({ category: r.category, amount: r.amount })),
    monthlyPnL,
  });
});

// ---------- PDF Export ----------
const { buildSalesReport, buildExpensesReport, buildStockReport, buildProfitLossReport } = require('./pdf-templates.cjs');
const fsSync = require('fs');
const pathMod = require('path');

const EXPORTS_DIR = pathMod.join(__dirname, 'exports');
if (!fsSync.existsSync(EXPORTS_DIR)) fsSync.mkdirSync(EXPORTS_DIR, { recursive: true });
app.use('/exports', express.static(EXPORTS_DIR));

// ---------- Database backup ----------
// A raw copy of the live SQLite file — the most direct "undo everything
// going wrong" insurance. Restoring is just replacing data.db with this file.
app.post('/api/admin/downloadBackup', requireAdmin, (req, res) => {
  try {
    // Flush any pending WAL-mode writes into the main file first, so the
    // copy is complete and self-contained rather than missing recent writes.
    db.pragma('wal_checkpoint(TRUNCATE)');
  } catch (e) {
    // Best-effort — still proceed with whatever is safely on disk.
  }
  try {
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
    const filename = `gwm-inventory-backup-${stamp}.db`;
    fsSync.copyFileSync(db.name, pathMod.join(EXPORTS_DIR, filename));
    res.json({ url: `/exports/${filename}`, filename });
  } catch (e) {
    res.status(500).json({ error: 'Failed to create backup file' });
  }
});

let puppeteerBrowserPromise = null;
function getBrowser() {
  if (!puppeteerBrowserPromise) {
    const puppeteer = require('puppeteer');
    puppeteerBrowserPromise = puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
  }
  return puppeteerBrowserPromise;
}

app.post('/api/exportPdf', requireAdmin, async (req, res) => {
  try {
    const input = req.body || {};
    const now = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    const period = input.periodLabel || (input.dateFrom && input.dateTo ? `${input.dateFrom} to ${input.dateTo}` : 'All time');

    let html;
    if (input.reportType === 'sales') html = buildSalesReport(db, input, period, now);
    else if (input.reportType === 'expenses') html = buildExpensesReport(db, input, period, now);
    else if (input.reportType === 'stock') html = buildStockReport(db, now);
    else if (input.reportType === 'profitLoss') html = buildProfitLossReport(db, input, period, now);
    else return res.status(400).json({ error: 'Invalid reportType' });

    const browser = await getBrowser();
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const pdfBuffer = await page.pdf({ format: 'a4', printBackground: true });
    await page.close();

    const filename = `${input.reportType}-report-${uuid()}.pdf`;
    fsSync.writeFileSync(pathMod.join(EXPORTS_DIR, filename), pdfBuffer);

    res.json({ url: `/exports/${filename}` });
  } catch (err) {
    console.error('PDF export failed:', err);
    res.status(500).json({ error: 'Failed to generate PDF' });
  }
});

// ---------- Reports (reuses getSales/getExpenses/getProducts shapes; frontend calls those directly) ----------

// ---------- Serve the built frontend (production / hosting) ----------
// In local dev, Vite's dev server runs separately on :8080 and proxies /api
// to this server. When deployed (e.g. Railway), there's no separate Vite
// dev server — this Express server serves the built frontend directly, so
// the whole app is a single deployable service.
const path = require('path');
const fs = require('fs');
const distPath = path.join(__dirname, '..', 'dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`API server running on port ${PORT}`));
