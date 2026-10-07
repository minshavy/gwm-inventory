import { useState, useEffect, useCallback, useRef } from 'react';
import { getSales, recordSale, deleteSale, getLookups, getProducts, printReceipt, getTopSellingProducts, findProductByCode } from '@/lib/api-client';
import { BarcodeScannerDialog, ScanButton } from '@/components/BarcodeScanner';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { Label } from '@project/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@project/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@project/components/ui/dialog';
import { Badge } from '@project/components/ui/badge';
import { Skeleton } from '@project/components/ui/skeleton';
import { undoableDelete } from '@/lib/undoable-delete';
import { Popover, PopoverContent, PopoverTrigger } from '@project/components/ui/popover';
import { DateRangeFilter } from '@/components/DateRangeFilter';
import { Plus, Search, Trash2, ShoppingCart, ChevronsUpDown, Check, Printer, Loader2, ScanBarcode } from 'lucide-react';
import { cn } from '@project/components/lib/utils';
import { toast } from 'sonner';
import NumericInput from '../components/NumericInput';

const fmt = (n: number) => `MVR ${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function SalesPage() {
  const [sales, setSales] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [totals, setTotals] = useState({ revenue: 0, cost: 0, profit: 0, discount: 0 });
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [printingId, setPrintingId] = useState<string | null>(null);

  const handlePrintReceipt = async (saleId: string) => {
    setPrintingId(saleId);
    try {
      const res = await printReceipt({ saleId });
      window.open(res.url, '_blank');
    } catch (e: any) {
      toast.error(e.message || 'Failed to generate receipt');
    } finally {
      setPrintingId(null);
    }
  };
  const [saving, setSaving] = useState(false);
  const [products, setProducts] = useState<any[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<any[]>([]);
  const [topProducts, setTopProducts] = useState<any[]>([]);

  // Form state
  const [form, setForm] = useState({
    productId: '', quantity: 1, sellingPrice: 0, costPrice: 0,
    discount: 0, paymentMethodId: '', date: new Date().toISOString().slice(0, 10), notes: '',
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getSales({ dateFrom: dateFrom || undefined, dateTo: dateTo || undefined, limit: 100 });
      setSales(res.sales);
      setTotal(res.total);
      setTotals(res.totals);
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo]);

  useEffect(() => { load(); }, [load]);

  const [scannerOpen, setScannerOpen] = useState(false);
  const formRef = useRef(form);
  formRef.current = form;

  // Scanning a product picks it and fills its prices. Scanning the same
  // product again adds 1 to the quantity, so 3 beeps = 3 units.
  const handleScan = async (code: string) => {
    try {
      const { product } = await findProductByCode({ code });
      if (!product) {
        toast.error(`No product has barcode or SKU "${code}"`, {
          description: 'Open Products, edit the item, and save this code in its Barcode field.',
        });
        return;
      }
      if (product.status !== 'Active') {
        toast.error(`"${product.name}" is ${product.status.toLowerCase()} and can't be sold`);
        return;
      }
      setProducts(prev => (prev.some((p: any) => p.id === product.id) ? prev : [...prev, product]));
      const added = formRef.current.productId === product.id;
      setForm(f => (f.productId === product.id
        ? { ...f, quantity: f.quantity + 1 }
        : { ...f, productId: product.id, quantity: 1, sellingPrice: product.sellingPrice ?? 0, costPrice: product.costPrice ?? 0 }));
      toast.success(added ? `${product.name}: quantity +1` : `${product.name} (Stock: ${product.currentStock})`);
      if (product.currentStock <= 0) toast.warning(`${product.name} shows 0 in stock`);
    } catch (e: any) {
      toast.error(e.message || 'Lookup failed');
    }
  };

  const openDialog = async (scanFirst = false) => {
    setForm({ productId: '', quantity: 1, sellingPrice: 0, costPrice: 0, discount: 0, paymentMethodId: '', date: new Date().toISOString().slice(0, 10), notes: '' });
    const [prods, pms, top] = await Promise.all([
      getProducts({ limit: 500 }),
      getLookups({ type: 'paymentMethods' }),
      getTopSellingProducts().catch(() => ({ products: [] })),
    ]);
    setProducts(prods.products.filter((p: any) => p.status === 'Active'));
    setPaymentMethods(pms.items.filter((pm: any) => pm.status === 'Active'));
    setTopProducts(top.products || []);
    setDialogOpen(true);
    if (scanFirst) setScannerOpen(true);
  };

  const onProductChange = (productId: string) => {
    const p = products.find((pr: any) => pr.id === productId);
    setForm(f => ({
      ...f,
      productId,
      sellingPrice: p?.sellingPrice ?? 0,
      costPrice: p?.costPrice ?? 0,
    }));
  };

  const [productSearch, setProductSearch] = useState('');
  const [productPopoverOpen, setProductPopoverOpen] = useState(false);

  const filteredProducts = products.filter((p: any) => {
    if (!productSearch) return true;
    const q = productSearch.toLowerCase();
    return (
      (p.name && p.name.toLowerCase().includes(q)) ||
      (p.sku && p.sku.toLowerCase().includes(q)) ||
      (p.barcode && p.barcode === productSearch.trim()) ||
      (p.brand && p.brand.toLowerCase().includes(q)) ||
      (p.category && p.category.toLowerCase().includes(q))
    );
  });

  const selectedProduct = products.find((p: any) => p.id === form.productId);
  const revenue = form.sellingPrice * form.quantity;
  const totalCost = form.costPrice * form.quantity;
  const profit = revenue - totalCost - form.discount;

  const handleSave = async () => {
    if (!form.productId) { toast.error('Please select a product'); return; }
    if (form.quantity <= 0) { toast.error('Quantity must be positive'); return; }
    setSaving(true);
    try {
      const result = await recordSale({
        productId: form.productId,
        quantity: form.quantity,
        sellingPrice: form.sellingPrice,
        costPrice: form.costPrice,
        discount: form.discount,
        paymentMethodId: form.paymentMethodId || undefined,
        date: form.date,
        notes: form.notes || undefined,
      });
      toast.success('Sale recorded', {
        action: { label: 'Print Receipt', onClick: () => handlePrintReceipt(result.id) },
      });
      setDialogOpen(false);
      load();
    } catch (e: any) {
      toast.error(e.message || 'Failed to record sale');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (s: any) => {
    const snapshot = sales;
    undoableDelete({
      itemLabel: `Sale of "${s.productName}"`,
      description: "Stock won't be restored automatically.",
      onRemoveLocally: () => setSales(prev => prev.filter((x: any) => x.id !== s.id)),
      onRestoreLocally: () => setSales(snapshot),
      onConfirmDelete: () => deleteSale({ id: s.id }),
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Sales</h1>
          <p className="text-sm text-muted-foreground">{total} sale{total !== 1 ? 's' : ''} recorded</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => openDialog(true)}><ScanBarcode className="w-4 h-4 mr-2" />Scan &amp; Sell</Button>
          <Button onClick={() => openDialog()}><Plus className="w-4 h-4 mr-2" />Record Sale</Button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Revenue', value: fmt(totals.revenue), color: 'text-primary' },
          { label: 'Cost', value: fmt(totals.cost), color: 'text-muted-foreground' },
          { label: 'Profit', value: fmt(totals.profit), color: totals.profit >= 0 ? 'text-primary' : 'text-destructive' },
          { label: 'Discounts', value: fmt(totals.discount), color: 'text-muted-foreground' },
        ].map(c => (
          <div key={c.label} className="bg-card border rounded-lg p-4">
            <p className="text-xs text-muted-foreground">{c.label}</p>
            <p className={`text-lg font-bold ${c.color}`}>{c.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <DateRangeFilter dateFrom={dateFrom} dateTo={dateTo} onFromChange={setDateFrom} onToChange={setDateTo} />

      {/* Table */}
      {loading ? (
        <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
      ) : sales.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <ShoppingCart className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="font-medium">No sales found</p>
          <p className="text-sm">Record your first sale to get started</p>
        </div>
      ) : (
        <>
          {/* Mobile cards */}
          <div className="md:hidden space-y-2">
            {sales.map(s => (
              <div key={s.id} className="bg-card border rounded-lg p-3 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-sm truncate flex-1">{s.productName}</span>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handlePrintReceipt(s.id)} disabled={printingId === s.id}>
                    {printingId === s.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Printer className="w-3.5 h-3.5" />}
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 -mr-1" onClick={() => handleDelete(s)}>
                    <Trash2 className="w-3.5 h-3.5 text-destructive" />
                  </Button>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Qty: {s.quantity}</span>
                  <span className="font-medium">{fmt(s.revenue)}</span>
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{s.date ? new Date(s.date).toLocaleDateString() : '-'}</span>
                  <span className={s.profit >= 0 ? 'text-primary' : 'text-destructive'}>{fmt(s.profit)} profit</span>
                </div>
                {s.paymentMethod && <Badge variant="secondary" className="text-xs">{s.paymentMethod}</Badge>}
              </div>
            ))}
          </div>

          {/* Desktop table */}
          <div className="border rounded-lg hidden md:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left px-4 py-3 font-medium">#</th>
                  <th className="text-left px-4 py-3 font-medium">Date</th>
                  <th className="text-left px-4 py-3 font-medium">Product</th>
                  <th className="text-right px-4 py-3 font-medium">Qty</th>
                  <th className="text-right px-4 py-3 font-medium">Revenue</th>
                  <th className="text-right px-4 py-3 font-medium">Profit</th>
                  <th className="text-left px-4 py-3 font-medium">Payment</th>
                  <th className="text-right px-4 py-3 font-medium w-12"></th>
                </tr>
              </thead>
              <tbody>
                {sales.map(s => (
                  <tr key={s.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{s.saleId}</td>
                    <td className="px-4 py-3">{s.date ? new Date(s.date).toLocaleDateString() : '-'}</td>
                    <td className="px-4 py-3 font-medium">{s.productName}</td>
                    <td className="px-4 py-3 text-right">{s.quantity}</td>
                    <td className="px-4 py-3 text-right">{fmt(s.revenue)}</td>
                    <td className="px-4 py-3 text-right">
                      <span className={s.profit >= 0 ? 'text-primary' : 'text-destructive'}>{fmt(s.profit)}</span>
                    </td>
                    <td className="px-4 py-3">
                      {s.paymentMethod && <Badge variant="secondary">{s.paymentMethod}</Badge>}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button variant="ghost" size="icon" onClick={() => handlePrintReceipt(s.id)} disabled={printingId === s.id}>
                        {printingId === s.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Printer className="w-4 h-4" />}
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(s)}>
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Record Sale Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Record Sale</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Product</Label>
              <div className="flex gap-2">
              <Popover open={productPopoverOpen} onOpenChange={setProductPopoverOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" role="combobox" className="flex-1 min-w-0 justify-between font-normal">
                    <span className="truncate">{selectedProduct ? `${selectedProduct.name} (Stock: ${selectedProduct.currentStock})` : 'Search or select product...'}</span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                  {topProducts.length > 0 && !productSearch && (
                    <div className="p-2 border-b">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground px-1 mb-1.5">Most sold</p>
                      <div className="flex flex-wrap gap-1.5">
                        {topProducts.map((p: any) => (
                          <button
                            key={p.id}
                            onClick={() => {
                              onProductChange(p.id);
                              setProductPopoverOpen(false);
                              setProductSearch('');
                            }}
                            className={cn(
                              'px-2.5 py-1 rounded-full border text-xs font-medium transition-colors hover:bg-accent',
                              form.productId === p.id && 'bg-accent border-primary'
                            )}
                          >
                            {p.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="p-2 border-b">
                    <div className="flex items-center gap-2 px-2">
                      <Search className="h-4 w-4 text-muted-foreground shrink-0" />
                      <input
                        className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                        placeholder="Search by name, SKU, barcode, brand..."
                        value={productSearch}
                        onChange={e => setProductSearch(e.target.value)}
                        autoFocus
                      />
                    </div>
                  </div>
                  <div
                    className="max-h-60 overflow-y-auto p-1"
                    onWheel={(e) => { e.currentTarget.scrollTop += e.deltaY; }}
                    onTouchStart={(e) => { (e.currentTarget as any)._touchY = e.touches[0].clientY; }}
                    onTouchMove={(e) => {
                      // This list is rendered in a portal outside the dialog's own
                      // DOM tree, so the dialog's scroll-lock blocks native touch
                      // scrolling here even with touch-action set. Drag the
                      // scroll position manually instead, bypassing that lock.
                      const el = e.currentTarget as any;
                      const y = e.touches[0].clientY;
                      el.scrollTop += el._touchY - y;
                      el._touchY = y;
                    }}
                    style={{ touchAction: 'pan-y' }}
                  >
                    {filteredProducts.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">No products found</p>
                    ) : (
                      filteredProducts.map(p => (
                        <button
                          key={p.id}
                          className={cn(
                            "w-full flex items-center gap-2 rounded-md px-2 py-2 text-sm hover:bg-accent text-left",
                            form.productId === p.id && "bg-accent"
                          )}
                          onClick={() => {
                            onProductChange(p.id);
                            setProductPopoverOpen(false);
                            setProductSearch('');
                          }}
                        >
                          <Check className={cn("h-4 w-4 shrink-0", form.productId === p.id ? "opacity-100" : "opacity-0")} />
                          <div className="flex-1 min-w-0">
                            <div className="font-medium truncate">{p.name}</div>
                            <div className="text-xs text-muted-foreground">
                              {p.sku && <span>SKU: {p.sku}</span>}
                              {p.brand && <span> · {p.brand}</span>}
                              <span> · Stock: {p.currentStock}</span>
                            </div>
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                </PopoverContent>
              </Popover>
              <ScanButton onClick={() => setScannerOpen(true)} />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div><Label>Quantity</Label><NumericInput min={1} value={form.quantity} onChange={e => setForm(f => ({ ...f, quantity: Number(e.target.value) }))} /></div>
              <div><Label>Date</Label><Input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} /></div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div><Label>Selling Price</Label><NumericInput min={0} step={0.01} value={form.sellingPrice} onChange={e => setForm(f => ({ ...f, sellingPrice: Number(e.target.value) }))} /></div>
              <div><Label>Cost Price</Label><NumericInput min={0} step={0.01} value={form.costPrice} onChange={e => setForm(f => ({ ...f, costPrice: Number(e.target.value) }))} /></div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div><Label>Discount</Label><NumericInput min={0} step={0.01} value={form.discount} onChange={e => setForm(f => ({ ...f, discount: Number(e.target.value) }))} /></div>
              <div>
                <Label>Payment Method</Label>
                <Select value={form.paymentMethodId} onValueChange={v => setForm(f => ({ ...f, paymentMethodId: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select method" /></SelectTrigger>
                  <SelectContent>
                    {paymentMethods.map(pm => <SelectItem key={pm.id} value={pm.id}>{pm.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div><Label>Notes</Label><Input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Optional notes" /></div>

            {/* Auto-calculated summary */}
            <div className="bg-muted/50 rounded-lg p-3 space-y-1 text-sm">
              <div className="flex justify-between"><span>Revenue:</span><span className="font-medium">{fmt(revenue)}</span></div>
              <div className="flex justify-between"><span>Total Cost:</span><span>{fmt(totalCost)}</span></div>
              {form.discount > 0 && <div className="flex justify-between"><span>Discount:</span><span>-{fmt(form.discount)}</span></div>}
              <div className="flex justify-between border-t pt-1 mt-1">
                <span className="font-semibold">Profit:</span>
                <span className={`font-bold ${profit >= 0 ? 'text-primary' : 'text-destructive'}`}>{fmt(profit)}</span>
              </div>
            </div>

            <Button className="w-full" onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Record Sale'}</Button>
          </div>
        </DialogContent>
      </Dialog>

      <BarcodeScannerDialog
        open={scannerOpen}
        onOpenChange={setScannerOpen}
        onDetected={handleScan}
        title="Scan product to sell"
      />
    </div>
  );
}
