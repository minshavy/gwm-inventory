import { useState, useEffect, useCallback } from 'react';
import { getSales, recordSale, deleteSale, getLookups, getProducts } from '@/lib/api-client';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { Label } from '@project/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@project/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@project/components/ui/dialog';
import { Badge } from '@project/components/ui/badge';
import { Skeleton } from '@project/components/ui/skeleton';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@project/components/ui/alert-dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@project/components/ui/popover';
import { Plus, Search, Trash2, ShoppingCart, ChevronsUpDown, Check } from 'lucide-react';
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
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [products, setProducts] = useState<any[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<any[]>([]);

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

  const openDialog = async () => {
    setForm({ productId: '', quantity: 1, sellingPrice: 0, costPrice: 0, discount: 0, paymentMethodId: '', date: new Date().toISOString().slice(0, 10), notes: '' });
    const [prods, pms] = await Promise.all([
      getProducts({ limit: 500 }),
      getLookups({ type: 'paymentMethods' }),
    ]);
    setProducts(prods.products.filter((p: any) => p.status === 'Active'));
    setPaymentMethods(pms.items.filter((pm: any) => pm.status === 'Active'));
    setDialogOpen(true);
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
      await recordSale({
        productId: form.productId,
        quantity: form.quantity,
        sellingPrice: form.sellingPrice,
        costPrice: form.costPrice,
        discount: form.discount,
        paymentMethodId: form.paymentMethodId || undefined,
        date: form.date,
        notes: form.notes || undefined,
      });
      toast.success('Sale recorded');
      setDialogOpen(false);
      load();
    } catch (e: any) {
      toast.error(e.message || 'Failed to record sale');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteSale({ id: deleteId });
      toast.success('Sale deleted');
      setDeleteId(null);
      load();
    } catch (e: any) {
      toast.error(e.message || 'Failed to delete');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Sales</h1>
          <p className="text-sm text-muted-foreground">{total} sale{total !== 1 ? 's' : ''} recorded</p>
        </div>
        <Button onClick={openDialog}><Plus className="w-4 h-4 mr-2" />Record Sale</Button>
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
      <div className="flex flex-wrap gap-3 items-end">
        <div className="w-full sm:w-auto">
          <label className="text-xs font-medium text-muted-foreground mb-1 block">From:</label>
          <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="w-full sm:w-40" />
        </div>
        <div className="w-full sm:w-auto">
          <label className="text-xs font-medium text-muted-foreground mb-1 block">To:</label>
          <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="w-full sm:w-40" />
        </div>
      </div>

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
                  <Button variant="ghost" size="icon" className="h-7 w-7 -mr-1" onClick={() => setDeleteId(s.id)}>
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
                      <Button variant="ghost" size="icon" onClick={() => setDeleteId(s.id)}>
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
              <Popover open={productPopoverOpen} onOpenChange={setProductPopoverOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" role="combobox" className="w-full justify-between font-normal">
                    {selectedProduct ? `${selectedProduct.name} (Stock: ${selectedProduct.currentStock})` : 'Search or select product...'}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                  <div className="p-2 border-b">
                    <div className="flex items-center gap-2 px-2">
                      <Search className="h-4 w-4 text-muted-foreground shrink-0" />
                      <input
                        className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                        placeholder="Search by name, SKU, brand..."
                        value={productSearch}
                        onChange={e => setProductSearch(e.target.value)}
                        autoFocus
                      />
                    </div>
                  </div>
                  <div className="max-h-60 overflow-y-auto p-1">
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
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Quantity</Label><NumericInput min={1} value={form.quantity} onChange={e => setForm(f => ({ ...f, quantity: Number(e.target.value) }))} /></div>
              <div><Label>Date</Label><Input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Selling Price</Label><NumericInput min={0} step={0.01} value={form.sellingPrice} onChange={e => setForm(f => ({ ...f, sellingPrice: Number(e.target.value) }))} /></div>
              <div><Label>Cost Price</Label><NumericInput min={0} step={0.01} value={form.costPrice} onChange={e => setForm(f => ({ ...f, costPrice: Number(e.target.value) }))} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
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

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={open => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Sale</AlertDialogTitle>
            <AlertDialogDescription>This will permanently delete this sale record. Stock will not be restored automatically.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
