import { useState, useEffect, useCallback } from 'react';
import { getSales, getExpenses, getProducts, exportPdf } from '@/lib/api-client';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { Badge } from '@project/components/ui/badge';
import { Skeleton } from '@project/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@project/components/ui/tabs';
import { DateRangeFilter } from '@/components/DateRangeFilter';
import { Download, BarChart3, FileText, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const fmt = (n: number) => `MVR ${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function downloadCSV(data: any[], filename: string) {
  if (!data.length) return;
  const headers = Object.keys(data[0]);
  const csv = [headers.join(','), ...data.map(r => headers.map(h => {
    const v = r[h];
    return typeof v === 'string' && v.includes(',') ? `"${v}"` : v;
  }).join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `${filename}.csv`; a.click();
  URL.revokeObjectURL(url);
}

export default function ReportsPage() {
  const [tab, setTab] = useState('sales');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [salesData, setSalesData] = useState<any[]>([]);
  const [expenseData, setExpenseData] = useState<any[]>([]);
  const [stockData, setStockData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [totals, setTotals] = useState({ revenue: 0, cost: 0, profit: 0 });
  const [expenseTotal, setExpenseTotal] = useState(0);
  const [exporting, setExporting] = useState(false);

  const loadReport = useCallback(async () => {
    setLoading(true);
    try {
      if (tab === 'sales') {
        const res = await getSales({ dateFrom: dateFrom || undefined, dateTo: dateTo || undefined, limit: 500 });
        setSalesData(res.sales);
        setTotals(res.totals);
      } else if (tab === 'expenses') {
        const res = await getExpenses({ dateFrom: dateFrom || undefined, dateTo: dateTo || undefined, limit: 500 });
        setExpenseData(res.expenses);
        setExpenseTotal(res.totalAmount);
      } else if (tab === 'stock') {
        const res = await getProducts({ limit: 500 });
        setStockData(res.products);
      }
    } finally {
      setLoading(false);
    }
  }, [tab, dateFrom, dateTo]);

  useEffect(() => { loadReport(); }, [loadReport]);

  const exportSales = () => downloadCSV(salesData.map(s => ({
    'Sale ID': s.saleId, Date: s.date, Product: s.productName, Qty: s.quantity,
    'Selling Price': s.sellingPrice, 'Cost Price': s.costPrice, Revenue: s.revenue,
    Cost: s.totalCost, Discount: s.discount, Profit: s.profit, Payment: s.paymentMethod,
  })), 'sales-report');

  const exportExpenses = () => downloadCSV(expenseData.map(e => ({
    'ID': e.expenseId, Date: e.date, Description: e.description, Category: e.categoryName,
    Amount: e.amount, Payment: e.paymentMethod,
  })), 'expenses-report');

  const exportStock = () => downloadCSV(stockData.map(p => ({
    Name: p.name, SKU: p.sku, Category: p.category, Brand: p.brand,
    'Cost Price': p.costPrice, 'Selling Price': p.sellingPrice, Stock: p.currentStock,
    'Low Stock Threshold': p.lowStockThreshold, Status: p.status,
  })), 'stock-report');

  const handleExportPdf = async () => {
    setExporting(true);
    try {
      const reportType = tab as 'sales' | 'expenses' | 'stock';
      const res = await exportPdf({
        reportType,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        periodLabel: dateFrom || dateTo ? `${dateFrom || '...'} to ${dateTo || '...'}` : undefined,
      });
      window.open(res.url, '_blank');
    } catch (e: any) {
      toast.error(e.message || 'Failed to generate PDF');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Reports</h1>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="sales">Sales</TabsTrigger>
          <TabsTrigger value="expenses">Expenses</TabsTrigger>
          <TabsTrigger value="stock">Stock</TabsTrigger>
        </TabsList>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mt-4 mb-4">
          {tab !== 'stock' ? (
            <DateRangeFilter dateFrom={dateFrom} dateTo={dateTo} onFromChange={setDateFrom} onToChange={setDateTo} />
          ) : <div />}
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => {
              if (tab === 'sales') exportSales();
              else if (tab === 'expenses') exportExpenses();
              else exportStock();
            }}>
              <Download className="w-4 h-4 mr-2" />Export CSV
            </Button>
            <Button variant="outline" size="sm" onClick={handleExportPdf} disabled={exporting}>
              {exporting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <FileText className="w-4 h-4 mr-2" />}
              Export PDF
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
        ) : (
          <>
            <TabsContent value="sales" className="mt-0">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
                <div className="bg-card border rounded-lg p-3"><p className="text-xs text-muted-foreground">Revenue</p><p className="font-bold truncate">{fmt(totals.revenue)}</p></div>
                <div className="bg-card border rounded-lg p-3"><p className="text-xs text-muted-foreground">Cost</p><p className="font-bold truncate">{fmt(totals.cost)}</p></div>
                <div className="bg-card border rounded-lg p-3"><p className="text-xs text-muted-foreground">Profit</p><p className="font-bold text-primary truncate">{fmt(totals.profit)}</p></div>
              </div>
              {salesData.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground"><BarChart3 className="w-8 h-8 mx-auto mb-2 opacity-40" /><p>No sales in this period</p></div>
              ) : (
                <>
                  {/* Mobile cards */}
                  <div className="md:hidden space-y-2">
                    {salesData.map(s => (
                      <div key={s.id} className="bg-card border rounded-lg p-3 space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-sm truncate">{s.productName}</span>
                          <span className="text-sm font-medium ml-2">{fmt(s.revenue)}</span>
                        </div>
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>{s.date ? new Date(s.date).toLocaleDateString() : '-'} · Qty: {s.quantity}</span>
                          <span className={s.profit >= 0 ? 'text-primary' : 'text-destructive'}>{fmt(s.profit)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                  {/* Desktop table */}
                  <div className="border rounded-lg hidden md:block">
                    <table className="w-full text-sm">
                      <thead><tr className="border-b bg-muted/50">
                        <th className="text-left px-3 py-2">#</th><th className="text-left px-3 py-2">Date</th><th className="text-left px-3 py-2">Product</th>
                        <th className="text-right px-3 py-2">Qty</th><th className="text-right px-3 py-2">Revenue</th><th className="text-right px-3 py-2">Cost</th><th className="text-right px-3 py-2">Profit</th>
                        <th className="text-left px-3 py-2">Payment</th>
                      </tr></thead>
                      <tbody>{salesData.map(s => (
                        <tr key={s.id} className="border-b last:border-0">
                          <td className="px-3 py-2 font-mono text-xs">{s.saleId}</td>
                          <td className="px-3 py-2">{s.date ? new Date(s.date).toLocaleDateString() : '-'}</td>
                          <td className="px-3 py-2">{s.productName}</td>
                          <td className="px-3 py-2 text-right">{s.quantity}</td>
                          <td className="px-3 py-2 text-right">{fmt(s.revenue)}</td>
                          <td className="px-3 py-2 text-right">{fmt(s.totalCost)}</td>
                          <td className="px-3 py-2 text-right">{fmt(s.profit)}</td>
                          <td className="px-3 py-2">{s.paymentMethod}</td>
                        </tr>
                      ))}</tbody>
                    </table>
                  </div>
                </>
              )}
            </TabsContent>

            <TabsContent value="expenses" className="mt-0">
              <div className="bg-card border rounded-lg p-3 mb-4"><p className="text-xs text-muted-foreground">Total Expenses</p><p className="font-bold">{fmt(expenseTotal)}</p></div>
              {expenseData.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground"><BarChart3 className="w-8 h-8 mx-auto mb-2 opacity-40" /><p>No expenses in this period</p></div>
              ) : (
                <>
                  {/* Mobile cards */}
                  <div className="md:hidden space-y-2">
                    {expenseData.map(e => (
                      <div key={e.id} className="bg-card border rounded-lg p-3 space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-sm truncate">{e.description}</span>
                          <span className="text-sm font-medium ml-2">{fmt(e.amount)}</span>
                        </div>
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>{e.date ? new Date(e.date).toLocaleDateString() : '-'}</span>
                          {e.categoryName && <Badge variant="secondary" className="text-[10px]">{e.categoryName}</Badge>}
                        </div>
                      </div>
                    ))}
                  </div>
                  {/* Desktop table */}
                  <div className="border rounded-lg hidden md:block">
                    <table className="w-full text-sm">
                      <thead><tr className="border-b bg-muted/50">
                        <th className="text-left px-3 py-2">#</th><th className="text-left px-3 py-2">Date</th><th className="text-left px-3 py-2">Description</th>
                        <th className="text-left px-3 py-2">Category</th><th className="text-right px-3 py-2">Amount</th><th className="text-left px-3 py-2">Payment</th>
                      </tr></thead>
                      <tbody>{expenseData.map(e => (
                        <tr key={e.id} className="border-b last:border-0">
                          <td className="px-3 py-2 font-mono text-xs">{e.expenseId}</td>
                          <td className="px-3 py-2">{e.date ? new Date(e.date).toLocaleDateString() : '-'}</td>
                          <td className="px-3 py-2">{e.description}</td>
                          <td className="px-3 py-2">{e.categoryName}</td>
                          <td className="px-3 py-2 text-right">{fmt(e.amount)}</td>
                          <td className="px-3 py-2">{e.paymentMethod}</td>
                        </tr>
                      ))}</tbody>
                    </table>
                  </div>
                </>
              )}
            </TabsContent>

            <TabsContent value="stock" className="mt-0">
              {stockData.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground"><p>No products</p></div>
              ) : (
                <>
                  {/* Mobile cards */}
                  <div className="md:hidden space-y-2">
                    {stockData.map(p => {
                      const isLow = p.currentStock > 0 && p.currentStock <= p.lowStockThreshold;
                      const isOut = p.currentStock <= 0;
                      return (
                        <div key={p.id} className="bg-card border rounded-lg p-3 space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="font-medium text-sm truncate">{p.name}</span>
                            <Badge variant={p.status === 'Active' ? 'default' : p.status === 'Out of Stock' ? 'destructive' : 'secondary'} className="text-[10px] ml-2">{p.status}</Badge>
                          </div>
                          <div className="flex items-center justify-between text-xs text-muted-foreground">
                            {p.sku && <span className="font-mono">{p.sku}</span>}
                            {p.category && <span>{p.category}</span>}
                          </div>
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">Stock: <span className={`font-semibold ${isOut ? 'text-destructive' : isLow ? 'text-yellow-600' : 'text-foreground'}`}>{p.currentStock}</span></span>
                            <span className="text-muted-foreground text-xs">Value: {fmt(p.costPrice * p.currentStock)}</span>
                          </div>
                          <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <span>Cost: {fmt(p.costPrice)}</span>
                            <span>Sell: {fmt(p.sellingPrice)}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {/* Desktop table */}
                  <div className="border rounded-lg hidden md:block">
                    <table className="w-full text-sm">
                      <thead><tr className="border-b bg-muted/50">
                        <th className="text-left px-3 py-2">Product</th><th className="text-left px-3 py-2">SKU</th><th className="text-left px-3 py-2">Category</th>
                        <th className="text-right px-3 py-2">Cost</th><th className="text-right px-3 py-2">Selling</th><th className="text-right px-3 py-2">Stock</th>
                        <th className="text-right px-3 py-2">Value</th><th className="text-left px-3 py-2">Status</th>
                      </tr></thead>
                      <tbody>{stockData.map(p => {
                        const isLow = p.currentStock > 0 && p.currentStock <= p.lowStockThreshold;
                        const isOut = p.currentStock <= 0;
                        return (
                          <tr key={p.id} className="border-b last:border-0">
                            <td className="px-3 py-2 font-medium">{p.name}</td>
                            <td className="px-3 py-2 font-mono text-xs">{p.sku}</td>
                            <td className="px-3 py-2">{p.category || '-'}</td>
                            <td className="px-3 py-2 text-right">{fmt(p.costPrice)}</td>
                            <td className="px-3 py-2 text-right">{fmt(p.sellingPrice)}</td>
                            <td className={`px-3 py-2 text-right font-medium ${isOut ? 'text-destructive' : isLow ? 'text-yellow-600' : ''}`}>{p.currentStock}</td>
                            <td className="px-3 py-2 text-right">{fmt(p.costPrice * p.currentStock)}</td>
                            <td className="px-3 py-2">{p.status}</td>
                          </tr>
                        );
                      })}</tbody>
                    </table>
                  </div>
                </>
              )}
            </TabsContent>
          </>
        )}
      </Tabs>

    </div>
  );
}
