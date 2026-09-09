import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getSupplierSummary, saveSupplierProduct, getLookups, addSupplierCategory } from '@/lib/api-client';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { Label } from '@project/components/ui/label';
import { Textarea } from '@project/components/ui/textarea';
import { Badge } from '@project/components/ui/badge';
import { Skeleton } from '@project/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@project/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@project/components/ui/select';
import { Plus, Pencil, Loader2, PlusCircle, Clock } from 'lucide-react';
import { toast } from 'sonner';

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

export default function SupplierProductsPage() {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<any[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | undefined>();
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const skuManuallyEdited = useRef(false);
  const [showNewCat, setShowNewCat] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [addingCat, setAddingCat] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getSupplierSummary({});
      setProducts(res.products);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { getLookups({ type: 'categories' }).then(r => setCategories(r.items || [])).catch(() => {}); }, []);

  const openDialog = useCallback((product?: any) => {
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
  }, []);

  // Deep link from the Stock Alerts page: /?edit=<id> opens that product directly.
  useEffect(() => {
    const editParam = searchParams.get('edit');
    if (!editParam || loading || products.length === 0) return;
    const p = products.find(p => p.id === editParam);
    if (p) openDialog(p);
    searchParams.delete('edit');
    setSearchParams(searchParams, { replace: true });
  }, [loading, products]);

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
      const res = await saveSupplierProduct({
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
      if (res.pendingStockUpdate) {
        toast.success('Product updated — the stock change is waiting for admin confirmation.');
      } else {
        toast.success(editId ? 'Product updated' : 'Product added');
      }
      setDialogOpen(false);
      load();
    } catch (e: any) {
      toast.error(e.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Your products</h1>
          <p className="text-sm text-muted-foreground">Add, edit, or remove the products you supply.</p>
        </div>
        <Button size="sm" onClick={() => openDialog()}><Plus className="w-4 h-4 mr-1" /> Add product</Button>
      </div>

      {loading ? (
        <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-lg" />)}</div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          {products.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">No products yet — add your first one.</div>
          ) : (
            <div className="divide-y">
              {products.map((p: any) => (
                <div key={p.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium truncate">{p.name}{p.brand && <span className="text-xs text-muted-foreground font-normal ml-1.5">{p.brand}</span>}</p>
                    <p className="text-xs text-muted-foreground truncate">{p.sku ? `SKU ${p.sku} · ` : ''}{p.category || 'Uncategorized'} · Stock: {p.currentStock} {p.unit}</p>
                    {p.pendingStockRequest && (
                      <p className="text-xs text-amber-600 flex items-center gap-1 mt-1">
                        <Clock className="w-3 h-3" /> Restock pending confirmation: {p.pendingStockRequest.previousStock} → {p.pendingStockRequest.requestedStock}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {stockBadge(p.stockFlag)}
                    <Button variant="ghost" size="icon" onClick={() => openDialog(p)}><Pencil className="w-4 h-4" /></Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

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
            {editId && (
              <p className="text-xs text-muted-foreground">
                If this product is currently low or out of stock, changing the stock quantity will need the admin's confirmation before it takes effect.
              </p>
            )}
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
            </div>
            <p className="text-xs text-muted-foreground">Selling price is set by the admin once they review your product.</p>
            <Button className="w-full" onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save'}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
