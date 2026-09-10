// PDF/HTML report builders (Profit & Loss, etc.), reading from local SQLite.

const escapeHtml = (s) =>
  String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const safeNum = (n) => {
  const v = Number(n);
  return Number.isFinite(v) ? v : 0;
};

const fmtMvr = (n) => `MVR ${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const baseStyle = `
  @page { size: a4; margin: 0.6in 0.5in; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #1a1a2e; font-size: 10pt; }
  h1 { font-size: 18pt; margin: 0 0 4px; font-weight: 700; }
  .subtitle { color: #64748b; font-size: 9pt; margin-bottom: 16px; }
  .summary { display: flex; gap: 16px; margin-bottom: 18px; }
  .summary-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 8px 14px; flex: 1; }
  .summary-card .label { font-size: 8pt; color: #64748b; text-transform: uppercase; letter-spacing: 0.04em; }
  .summary-card .value { font-size: 12pt; font-weight: 700; margin-top: 2px; }
  table { width: 100%; border-collapse: collapse; font-variant-numeric: tabular-nums; }
  th { text-align: left; font-size: 8pt; font-weight: 600; color: #475569; border-bottom: 1.5px solid #cbd5e1; padding: 8px 8px 8px 0; text-transform: uppercase; letter-spacing: 0.03em; }
  td { padding: 7px 8px 7px 0; border-bottom: 1px solid #f1f5f9; font-size: 9pt; }
  td.num, th.num { text-align: right; }
  tfoot td { border-top: 1.5px solid #cbd5e1; font-weight: 700; padding-top: 10px; }
  .highlight { color: #16a34a; }
  .negative { color: #dc2626; }
  .section-title { font-size: 11pt; font-weight: 600; margin: 20px 0 8px; }
  .footer { margin-top: 24px; font-size: 8pt; color: #94a3b8; text-align: center; }
`;

function buildSalesReport(db, input, period, generatedDate) {
  let where = [];
  let params = [];
  if (input.dateFrom) { where.push('s.date >= ?'); params.push(input.dateFrom); }
  if (input.dateTo) { where.push('s.date <= ?'); params.push(input.dateTo); }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const t = db.prepare(`
    SELECT COALESCE(SUM(s.revenue),0) AS revenue, COALESCE(SUM(s.totalCost),0) AS cost,
           COALESCE(SUM(s.profit),0) AS profit, COALESCE(SUM(s.discount),0) AS discount, COUNT(*) AS cnt
    FROM "Sales" s ${whereSql}
  `).get(...params);

  const rows = db.prepare(`
    SELECT s.saleId, s.date, s.quantity, s.sellingPrice, s.revenue, s.totalCost, s.profit, s.discount,
           COALESCE(p.name,'Unknown') AS product, COALESCE(pm.name,'') AS payment
    FROM "Sales" s
    LEFT JOIN "ProductsSales" pl ON pl.salesId = s.id
    LEFT JOIN "Products" p ON p.id = pl.productsId
    LEFT JOIN "PaymentMethodsSales" pml ON pml.salesId = s.id
    LEFT JOIN "PaymentMethods" pm ON pm.id = pml.paymentMethodsId
    ${whereSql}
    ORDER BY s.date DESC, s.created_at DESC LIMIT 500
  `).all(...params);

  const rowsHtml = rows.map(r => `<tr>
    <td>${safeNum(r.saleId)}</td>
    <td>${r.date ? String(r.date).slice(0, 10) : '-'}</td>
    <td>${escapeHtml(r.product)}</td>
    <td class="num">${safeNum(r.quantity)}</td>
    <td class="num">${fmtMvr(safeNum(r.revenue))}</td>
    <td class="num">${fmtMvr(safeNum(r.totalCost))}</td>
    <td class="num">${fmtMvr(safeNum(r.discount))}</td>
    <td class="num ${safeNum(r.profit) >= 0 ? 'highlight' : 'negative'}">${fmtMvr(safeNum(r.profit))}</td>
    <td>${escapeHtml(r.payment)}</td>
  </tr>`).join('');

  return `<!doctype html><html><head><meta charset="utf-8"><style>${baseStyle}</style></head><body>
    <h1>Sales Report</h1>
    <div class="subtitle">Period: ${escapeHtml(period)} · Generated: ${escapeHtml(generatedDate)}</div>
    <div class="summary">
      <div class="summary-card"><div class="label">Revenue</div><div class="value">${fmtMvr(safeNum(t.revenue))}</div></div>
      <div class="summary-card"><div class="label">Cost</div><div class="value">${fmtMvr(safeNum(t.cost))}</div></div>
      <div class="summary-card"><div class="label">Profit</div><div class="value ${safeNum(t.profit) >= 0 ? 'highlight' : 'negative'}">${fmtMvr(safeNum(t.profit))}</div></div>
      <div class="summary-card"><div class="label">Sales</div><div class="value">${safeNum(t.cnt)}</div></div>
    </div>
    <table><thead><tr><th>#</th><th>Date</th><th>Product</th><th class="num">Qty</th><th class="num">Revenue</th><th class="num">Cost</th><th class="num">Disc.</th><th class="num">Profit</th><th>Payment</th></tr></thead>
    <tbody>${rowsHtml}</tbody>
    <tfoot><tr><td colspan="4">Total</td><td class="num">${fmtMvr(safeNum(t.revenue))}</td><td class="num">${fmtMvr(safeNum(t.cost))}</td><td class="num">${fmtMvr(safeNum(t.discount))}</td><td class="num">${fmtMvr(safeNum(t.profit))}</td><td></td></tr></tfoot>
    </table>
    <div class="footer">GWM Inventory · Sales Report</div>
  </body></html>`;
}

function buildExpensesReport(db, input, period, generatedDate) {
  let where = [];
  let params = [];
  if (input.dateFrom) { where.push('e.date >= ?'); params.push(input.dateFrom); }
  if (input.dateTo) { where.push('e.date <= ?'); params.push(input.dateTo); }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const t = db.prepare(`SELECT COALESCE(SUM(amount),0) AS total, COUNT(*) AS cnt FROM "Expenses" e ${whereSql}`).get(...params);

  const rows = db.prepare(`
    SELECT e.expenseId, e.date, e.description, e.amount,
           COALESCE(ec.name,'') AS category, COALESCE(pm.name,'') AS payment
    FROM "Expenses" e
    LEFT JOIN "ExpenseCategoriesExpenses" ecl ON ecl.expensesId = e.id
    LEFT JOIN "ExpenseCategories" ec ON ec.id = ecl.expenseCategoriesId
    LEFT JOIN "ExpensesPaymentMethods" epm ON epm.expensesId = e.id
    LEFT JOIN "PaymentMethods" pm ON pm.id = epm.paymentMethodsId
    ${whereSql}
    GROUP BY e.id
    ORDER BY e.date DESC, e.created_at DESC LIMIT 500
  `).all(...params);

  const rowsHtml = rows.map(r => `<tr>
    <td>${safeNum(r.expenseId)}</td>
    <td>${r.date ? String(r.date).slice(0, 10) : '-'}</td>
    <td>${escapeHtml(r.description)}</td>
    <td>${escapeHtml(r.category)}</td>
    <td class="num">${fmtMvr(safeNum(r.amount))}</td>
    <td>${escapeHtml(r.payment)}</td>
  </tr>`).join('');

  return `<!doctype html><html><head><meta charset="utf-8"><style>${baseStyle}</style></head><body>
    <h1>Expenses Report</h1>
    <div class="subtitle">Period: ${escapeHtml(period)} · Generated: ${escapeHtml(generatedDate)}</div>
    <div class="summary">
      <div class="summary-card"><div class="label">Total Expenses</div><div class="value negative">${fmtMvr(safeNum(t.total))}</div></div>
      <div class="summary-card"><div class="label">Count</div><div class="value">${safeNum(t.cnt)}</div></div>
    </div>
    <table><thead><tr><th>#</th><th>Date</th><th>Description</th><th>Category</th><th class="num">Amount</th><th>Payment</th></tr></thead>
    <tbody>${rowsHtml}</tbody>
    <tfoot><tr><td colspan="4">Total</td><td class="num">${fmtMvr(safeNum(t.total))}</td><td></td></tr></tfoot>
    </table>
    <div class="footer">GWM Inventory · Expenses Report</div>
  </body></html>`;
}

function buildStockReport(db, generatedDate) {
  const rows = db.prepare(`
    SELECT name, sku, category, brand, costPrice, sellingPrice, currentStock, lowStockThreshold, status
    FROM "Products" ORDER BY name ASC LIMIT 500
  `).all();

  let totalValue = 0;
  const rowsHtml = rows.map(r => {
    const stock = safeNum(r.currentStock);
    const cost = safeNum(r.costPrice);
    const value = stock * cost;
    totalValue += value;
    const isLow = stock > 0 && stock <= safeNum(r.lowStockThreshold);
    const isOut = stock <= 0;
    return `<tr>
      <td>${escapeHtml(r.name)}</td>
      <td style="font-family:monospace;font-size:8pt">${escapeHtml(r.sku)}</td>
      <td>${escapeHtml(r.category)}</td>
      <td>${escapeHtml(r.brand)}</td>
      <td class="num">${fmtMvr(cost)}</td>
      <td class="num">${fmtMvr(safeNum(r.sellingPrice))}</td>
      <td class="num" style="color:${isOut ? '#dc2626' : isLow ? '#ca8a04' : '#111'};font-weight:600">${stock}</td>
      <td class="num">${fmtMvr(value)}</td>
      <td>${escapeHtml(r.status)}</td>
    </tr>`;
  }).join('');

  return `<!doctype html><html><head><meta charset="utf-8"><style>${baseStyle}</style></head><body>
    <h1>Stock Report</h1>
    <div class="subtitle">As of ${escapeHtml(generatedDate)}</div>
    <div class="summary">
      <div class="summary-card"><div class="label">Products</div><div class="value">${rows.length}</div></div>
      <div class="summary-card"><div class="label">Total Stock Value</div><div class="value">${fmtMvr(totalValue)}</div></div>
    </div>
    <table><thead><tr><th>Product</th><th>SKU</th><th>Category</th><th>Brand</th><th class="num">Cost</th><th class="num">Sell</th><th class="num">Stock</th><th class="num">Value</th><th>Status</th></tr></thead>
    <tbody>${rowsHtml}</tbody>
    <tfoot><tr><td colspan="7">Total Value</td><td class="num">${fmtMvr(totalValue)}</td><td></td></tr></tfoot>
    </table>
    <div class="footer">GWM Inventory · Stock Report</div>
  </body></html>`;
}

function buildProfitLossReport(db, input, period, generatedDate) {
  let where = [];
  let params = [];
  if (input.dateFrom) { where.push('date >= ?'); params.push(input.dateFrom); }
  if (input.dateTo) { where.push('date <= ?'); params.push(input.dateTo); }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const s = db.prepare(`
    SELECT COALESCE(SUM(revenue),0) AS revenue, COALESCE(SUM(totalCost),0) AS cogs,
           COALESCE(SUM(discount),0) AS discount, COUNT(*) AS cnt
    FROM "Sales" ${whereSql}
  `).get(...params);
  const eTotal = db.prepare(`SELECT COALESCE(SUM(amount),0) AS total FROM "Expenses" ${whereSql}`).get(...params);

  const expByCat = db.prepare(`
    SELECT COALESCE(ec.name,'Uncategorized') AS category, COALESCE(SUM(e.amount),0) AS amount
    FROM "Expenses" e
    LEFT JOIN "ExpenseCategoriesExpenses" ecl ON ecl.expensesId = e.id
    LEFT JOIN "ExpenseCategories" ec ON ec.id = ecl.expenseCategoriesId
    ${whereSql.replace(/date/g, 'e.date')}
    GROUP BY ec.name ORDER BY amount DESC
  `).all(...params);

  const monthlySales = db.prepare(`
    SELECT strftime('%Y-%m', date) AS month, COALESCE(SUM(revenue),0) AS revenue, COALESCE(SUM(totalCost),0) AS cogs
    FROM "Sales" ${whereSql} GROUP BY 1
  `).all(...params);
  const monthlyExpenses = db.prepare(`
    SELECT strftime('%Y-%m', date) AS month, COALESCE(SUM(amount),0) AS expenses
    FROM "Expenses" ${whereSql} GROUP BY 1
  `).all(...params);
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

  const revenue = safeNum(s.revenue);
  const cogs = safeNum(s.cogs);
  const grossProfit = revenue - cogs;
  const totalExpenses = safeNum(eTotal.total);
  const netProfit = grossProfit - totalExpenses;

  const pnlLines = [
    { label: 'Revenue (Sales)', value: revenue, indent: false, bold: false },
    { label: 'Less: Cost of Goods Sold', value: cogs, indent: true, bold: false },
    { label: 'Gross Profit', value: grossProfit, indent: false, bold: true },
    { label: 'Less: Operating Expenses', value: totalExpenses, indent: true, bold: false },
    { label: 'Net Profit', value: netProfit, indent: false, bold: true },
  ];
  const pnlHtml = pnlLines.map(l => `<tr style="${l.bold ? 'font-weight:700;border-top:1.5px solid #cbd5e1;' : ''}">
    <td style="${l.indent ? 'padding-left:24px;color:#64748b' : ''}">${escapeHtml(l.label)}</td>
    <td class="num" style="color:${l.bold ? (l.value >= 0 ? '#16a34a' : '#dc2626') : '#111'}">${fmtMvr(l.value)}</td>
  </tr>`).join('');

  const catHtml = expByCat.map(r => `<tr><td>${escapeHtml(r.category)}</td><td class="num">${fmtMvr(safeNum(r.amount))}</td></tr>`).join('');

  const monthlyHtml = monthlyPnL.map(r => `<tr>
    <td>${escapeHtml(r.month)}</td>
    <td class="num">${fmtMvr(safeNum(r.revenue))}</td>
    <td class="num">${fmtMvr(safeNum(r.cogs))}</td>
    <td class="num">${fmtMvr(safeNum(r.expenses))}</td>
    <td class="num ${safeNum(r.netProfit) >= 0 ? 'highlight' : 'negative'}">${fmtMvr(safeNum(r.netProfit))}</td>
  </tr>`).join('');

  return `<!doctype html><html><head><meta charset="utf-8"><style>${baseStyle}</style></head><body>
    <h1>Profit & Loss Statement</h1>
    <div class="subtitle">Period: ${escapeHtml(period)} · Generated: ${escapeHtml(generatedDate)}</div>
    <div class="summary">
      <div class="summary-card"><div class="label">Revenue</div><div class="value">${fmtMvr(revenue)}</div></div>
      <div class="summary-card"><div class="label">Gross Profit</div><div class="value ${grossProfit >= 0 ? 'highlight' : 'negative'}">${fmtMvr(grossProfit)}</div></div>
      <div class="summary-card"><div class="label">Net Profit</div><div class="value ${netProfit >= 0 ? 'highlight' : 'negative'}">${fmtMvr(netProfit)}</div></div>
      <div class="summary-card"><div class="label">Sales Count</div><div class="value">${safeNum(s.cnt)}</div></div>
    </div>

    <div class="section-title">Income Statement</div>
    <table><thead><tr><th>Item</th><th class="num">Amount</th></tr></thead><tbody>${pnlHtml}</tbody></table>

    ${catHtml ? `<div class="section-title">Expenses by Category</div>
    <table><thead><tr><th>Category</th><th class="num">Amount</th></tr></thead><tbody>${catHtml}</tbody>
    <tfoot><tr><td>Total</td><td class="num">${fmtMvr(totalExpenses)}</td></tr></tfoot></table>` : ''}

    ${monthlyHtml ? `<div class="section-title">Monthly Breakdown</div>
    <table><thead><tr><th>Month</th><th class="num">Revenue</th><th class="num">COGS</th><th class="num">Expenses</th><th class="num">Net Profit</th></tr></thead><tbody>${monthlyHtml}</tbody></table>` : ''}

    <div class="footer">GWM Inventory · Profit & Loss Statement</div>
  </body></html>`;
}

function buildReceipt(db, saleId, generatedDate) {
  const sale = db.prepare(`
    SELECT s.*, p.name AS productName, pm.name AS paymentMethod
    FROM "Sales" s
    LEFT JOIN "ProductsSales" pl ON pl.salesId = s.id
    LEFT JOIN "Products" p ON p.id = pl.productsId
    LEFT JOIN "PaymentMethodsSales" pml ON pml.salesId = s.id
    LEFT JOIN "PaymentMethods" pm ON pm.id = pml.paymentMethodsId
    WHERE s.id = ?
  `).get(saleId);
  if (!sale) return null;

  const lineTotal = safeNum(sale.sellingPrice) * safeNum(sale.quantity);

  return `<!doctype html><html><head><meta charset="utf-8"><style>
    @page { size: A5; margin: 0.4in; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #1a1a2e; font-size: 10pt; }
    .wrap { max-width: 380px; margin: 0 auto; }
    .center { text-align: center; }
    .row { display: flex; justify-content: space-between; }
    h1 { font-size: 16pt; margin: 0 0 2px; font-weight: 700; }
    .muted { color: #64748b; font-size: 8.5pt; }
    .divider { border-top: 1.5px dashed #cbd5e1; margin: 12px 0; }
    table { width: 100%; border-collapse: collapse; margin: 10px 0; }
    th { text-align: left; font-size: 8pt; font-weight: 600; color: #475569; border-bottom: 1px solid #cbd5e1; padding: 4px 4px 4px 0; text-transform: uppercase; letter-spacing: 0.03em; }
    td { padding: 7px 4px 7px 0; font-size: 9.5pt; }
    td.num, th.num { text-align: right; }
    .totals td { padding: 3px 4px 3px 0; font-size: 9.5pt; }
    .totals .grand td { border-top: 1.5px solid #1a1a2e; font-weight: 700; font-size: 12pt; padding-top: 8px; }
    .footer { margin-top: 24px; text-align: center; font-size: 8.5pt; color: #94a3b8; }
  </style></head><body>
    <div class="wrap">
      <div class="center">
        <h1>GWM Inventory</h1>
        <div class="muted">Sales Receipt</div>
      </div>
      <div class="divider"></div>
      <div class="row muted">
        <span>Receipt #${safeNum(sale.saleId)}</span>
        <span>${sale.date ? String(sale.date).slice(0, 10) : ''}</span>
      </div>
      <table>
        <thead><tr><th>Item</th><th class="num">Qty</th><th class="num">Price</th><th class="num">Total</th></tr></thead>
        <tbody>
          <tr>
            <td>${escapeHtml(sale.productName || 'Product')}</td>
            <td class="num">${safeNum(sale.quantity)}</td>
            <td class="num">${fmtMvr(safeNum(sale.sellingPrice))}</td>
            <td class="num">${fmtMvr(lineTotal)}</td>
          </tr>
        </tbody>
      </table>
      <div class="divider"></div>
      <table class="totals">
        <tr><td>Subtotal</td><td class="num">${fmtMvr(lineTotal)}</td></tr>
        ${safeNum(sale.discount) > 0 ? `<tr><td>Discount</td><td class="num">-${fmtMvr(safeNum(sale.discount))}</td></tr>` : ''}
        <tr class="grand"><td>Total</td><td class="num">${fmtMvr(safeNum(sale.revenue))}</td></tr>
      </table>
      ${sale.paymentMethod ? `<div class="muted center" style="margin-top:6px;">Paid via ${escapeHtml(sale.paymentMethod)}</div>` : ''}
      <div class="footer">Thank you for your purchase!<br/>Generated ${escapeHtml(generatedDate)}</div>
    </div>
  </body></html>`;
}

module.exports = { buildSalesReport, buildExpensesReport, buildStockReport, buildProfitLossReport, buildReceipt };
