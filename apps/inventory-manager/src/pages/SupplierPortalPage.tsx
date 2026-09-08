import { useState, useEffect, useCallback, useRef } from 'react';
import { getSupplierSummary, saveSupplierProduct, deleteSupplierProduct, getLookups, addSupplierCategory } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-shim';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { Label } from '@project/components/ui/label';
import { Textarea } from '@project/components/ui/textarea';
import { Badge } from '@project/components/ui/badge';
import { Skeleton } from '@project/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@project/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@project/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@project/components/ui/alert-dialog';
import { Plus, Pencil, Trash2, Package, Wallet, TrendingUp, AlertTriangle, Loader2, PlusCircle } from 'lucide-react';
import { toast } from 'sonner';

const fmt = (n: number) => `MVR ${(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const emptyForm = { name: '', sku: '', category: '', brand: '', unit: 'Piece', description: '', costPrice: '', currentStock: '', lowStockThreshold: '10' };

function generateSku(prefix: string, productName: string): string {
  const nameAbbr = productName.trim().split(/\s+/).filter(Boolean).map(w => w[0].toUpperCase()).slice(0, 3).join('');
  const num = String(Math.floor(Math.random() * 9000) + 1000);
  return `${prefix}-${nameAbbr || 'X'}${num}`;
}

function stockBadge(flag: string) {
  if (flag === 'Out of Stock') return <Badge variant="destructive">Out of Stock</Badge>;
  if (flag === 'Low Stock') return <Badge className="bg-amber-500 hover:bg-amber-500 text-white">Low Stock</Badge>;
  return <Badge variant="secondary">In Stock</Badge>;
}


export default function SupplierPortalPage() {
  const { user, logout } = useAuth();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<any[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | undefined>();
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const skuManuallyEdited = useRef(false);
  const [showNewCat, setShowNewCat] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [addingCat, setAddingCat] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getSupplierSummary({});
      setData(res);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { getLookups({ type: 'categories' }).then(r => setCategories(r.items || [])).catch(() => {}); }, []);

  const openDialog = (product?: any) => {
    skuManuallyEdited.current = !!product;
    setShowNewCat(false); setNewCatName('');
    if (product) {
      setEditId(product.id);
      setForm({
        name: product.name, sku: product.sku || '', category: product.category || '',
        brand: product.brand || '', unit: product.unit || 'Piece', description: product.description || '',
        costPrice: String(product.costPrice ?? ''), currentStock: String(product.currentStock ?? ''),
        lowStockThreshold: String(product.lowStockThreshold ?? '10'),
      });
    } else {
      setEditId(undefined);
      setForm(emptyForm);
    }
    setDialogOpen(true);
  };

  // Auto-generate the SKU from category prefix + product name, same scheme the
  // admin's Add Product dialog uses — unless the supplier typed their own.
  useEffect(() => {
    if (editId || skuManuallyEdited.current || !dialogOpen) return;
    if (form.category && form.name.trim()) {
      const cat = categories.find((c: any) => c.name === form.category);
      const prefix = cat?.prefix || form.category.slice(0, 3).toUpperCase();
      setForm(f => ({ ...f, sku: generateSku(prefix, f.name) }));
    }
  }, [form.category, form.name, editId, dialogOpen, categories]);

  const handleAddCategory = async () => {
    if (!newCatName.trim()) return;
    setAddingCat(true);
    try {
      await addSupplierCategory({ name: newCatName.trim() });
      const res = await getLookups({ type: 'categories' });
      setCategories(res.items || []);
      setForm(f => ({ ...f, category: newCatName.trim() }));
      setShowNewCat(false); setNewCatName('');
      toast.success(`Category "${newCatName.trim()}" added`);
    } catch (e: any) {
      toast.error(e.message || 'Failed to add category');
    } finally {
      setAddingCat(false);
    }
  };

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error('Product name is required'); return; }
    setSaving(true);
    try {
      await saveSupplierProduct({
        id: editId,
        name: form.name.trim(),
        sku: form.sku || undefined,
        category: form.category || undefined,
        brand: form.brand || undefined,
        unit: form.unit || 'Piece',
        description: form.description || undefined,
        costPrice: form.costPrice ? Number(form.costPrice) : undefined,
        currentStock: form.currentStock ? Number(form.currentStock) : 0,
        lowStockThreshold: form.lowStockThreshold ? Number(form.lowStockThreshold) : 10,
      });
      toast.success(editId ? 'Product updated' : 'Product added');
      setDialogOpen(false);
      load();
    } catch (e: any) {
      toast.error(e.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteSupplierProduct({ id: deleteId });
      toast.success('Product deleted');
      setDeleteId(null);
      load();
    } catch (e: any) {
      toast.error(e.message || 'Failed to delete');
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Package className="w-5 h-5 text-primary" />
            <span className="font-semibold text-sm">Supplier Portal</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground hidden sm:inline">{user?.username}</span>
            <Button variant="outline" size="sm" onClick={logout}>Log out</Button>
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {loading || !data ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-lg" />)}
            </div>
            <Skeleton className="h-64 rounded-lg" />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="bg-card border rounded-lg p-4 flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-emerald-500/10 text-emerald-600 flex items-center justify-center"><Wallet className="w-4 h-4" /></div>
                <div>
                  <p className="text-xs text-muted-foreground">Your total share</p>
                  <p className="text-base font-bold">{fmt(data.totalShare)}</p>
                </div>
              </div>
              <div className="bg-card border rounded-lg p-4 flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-blue-500/10 text-blue-600 flex items-center justify-center"><TrendingUp className="w-4 h-4" /></div>
                <div>
                  <p className="text-xs text-muted-foreground">Share this month</p>
                  <p className="text-base font-bold">{fmt(data.thisMonthShare)}</p>
                </div>
              </div>
              <div className="bg-card border rounded-lg p-4 flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-amber-500/10 text-amber-600 flex items-center justify-center"><AlertTriangle className="w-4 h-4" /></div>
                <div>
                  <p className="text-xs text-muted-foreground">Needs restock</p>
                  <p className="text-base font-bold">{data.products.filter((p: any) => p.stockFlag !== 'OK').length} products</p>
                </div>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Your share is 1/3 of the profit earned on sales of your own products only — it never includes other suppliers' sales.
            </p>

            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Your products</h2>
              <Button size="sm" onClick={() => openDialog()}><Plus className="w-4 h-4 mr-1" /> Add product</Button>
            </div>

            <div className="border rounded-lg overflow-hidden">
              {data.products.length === 0 ? (
                <div className="p-8 text-center text-sm text-muted-foreground">No products yet — add your first one.</div>
              ) : (
                <div className="divide-y">
                  {data.products.map((p: any) => (
                    <div key={p.id} className="p-4 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-medium truncate">{p.name}{p.brand && <span className="text-xs text-muted-foreground font-normal ml-1.5">{p.brand}</span>}</p>
                        <p className="text-xs text-muted-foreground truncate">{p.sku ? `SKU ${p.sku} · ` : ''}{p.category || 'Uncategorized'} · Stock: {p.currentStock} {p.unit}</p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {stockBadge(p.stockFlag)}
                        <Button variant="ghost" size="icon" onClick={() => openDialog(p)}><Pencil className="w-4 h-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => setDeleteId(p.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {data.recentSales.length > 0 && (
              <>
                <h2 className="text-lg font-semibold">Recent sales of your products</h2>
                <div className="border rounded-lg overflow-hidden divide-y">
                  {data.recentSales.map((s: any) => (
                    <div key={s.id} className="p-3 flex items-center justify-between text-sm">
                      <div>
                        <p className="font-medium">{s.productName}</p>
                        <p className="text-xs text-muted-foreground">{s.date} · qty {s.quantity}</p>
                      </div>
                      <p className="font-semibold">{fmt(s.share)}</p>
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editId ? 'Edit product' : 'Add product'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Name *</Label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Category</Label>
                {showNewCat ? (
                  <div className="flex gap-1.5">
                    <Input
                      value={newCatName} onChange={e => setNewCatName(e.target.value)}
                      placeholder="New category" autoFocus
                      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddCategory(); } }}
                    />
                    <Button size="sm" className="shrink-0" onClick={handleAddCategory} disabled={addingCat || !newCatName.trim()}>
                      {addingCat ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Add'}
                    </Button>
                    <Button size="sm" variant="ghost" className="shrink-0" onClick={() => { setShowNewCat(false); setNewCatName(''); }}>✕</Button>
                  </div>
                ) : (
                  <Select value={form.category || 'none'} onValueChange={v => { if (v === '__new__') { setShowNewCat(true); return; } setForm(f => ({ ...f, category: v === 'none' ? '' : v })); }}>
                    <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {categories.map((c: any) => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}
                      <SelectItem value="__new__"><span className="flex items-center gap-1.5"><PlusCircle className="w-3.5 h-3.5" /> New Category</span></SelectItem>
                    </SelectContent>
                  </Select>
                )}
              </div>
              <div className="space-y-1.5">
                <Label>SKU {!editId && <span className="text-muted-foreground text-xs font-normal">(auto)</span>}</Label>
                <Input
                  value={form.sku} className="font-mono"
                  onChange={e => { skuManuallyEdited.current = true; setForm(f => ({ ...f, sku: e.target.value })); }}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Brand</Label>
                <Input value={form.brand} onChange={e => setForm(f => ({ ...f, brand: e.target.value }))} placeholder="e.g. Dior" />
              </div>
              <div className="space-y-1.5">
                <Label>Unit</Label>
                <Input value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))} placeholder="e.g. Piece, Box, Kg" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label>Cost price</Label>
                <Input type="number" value={form.costPrice} onChange={e => setForm(f => ({ ...f, costPrice: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Stock qty</Label>
                <Input type="number" value={form.currentStock} onChange={e => setForm(f => ({ ...f, currentStock: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Low stock at</Label>
                <Input type="number" value={form.lowStockThreshold} onChange={e => setForm(f => ({ ...f, lowStockThreshold: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
            </div>
            <p className="text-xs text-muted-foreground">Selling price is set by the admin once they review your product.</p>
            <Button className="w-full" onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save'}</Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={open => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this product?</AlertDialogTitle>
            <AlertDialogDescription>This can't be undone. Products that already have sales recorded can't be deleted — ask the admin to discontinue them instead.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
