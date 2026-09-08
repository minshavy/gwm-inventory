import { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@project/components/ui/dialog';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { Label } from '@project/components/ui/label';
import { Textarea } from '@project/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@project/components/ui/select';
import { Loader2, AlertTriangle, PackagePlus, PlusCircle } from 'lucide-react';
import { saveProduct, getProducts, recordStockMovement, getLookups, saveLookup, getSuppliers } from '@/lib/api-client';
import { toast } from 'sonner';
import { useDebouncedCallback } from 'use-debounce';

interface Product {
  id: string;
  name: string;
  sku: string;
  category: string | null;
  brand: string;
  unit: string;
  description: string;
  costPrice: number;
  sellingPrice: number;
  currentStock: number;
  lowStockThreshold: number;
  status: string;
}

type Category = { id: string; name: string; prefix: string };
type Supplier = { id: string; name: string };

interface Props {
  open: boolean;
  onClose: () => void;
  product: Product | null;
  onSaved: () => void;
}

function generateSku(prefix: string, productName: string): string {
  const nameAbbr = productName.trim().split(/\s+/).filter(Boolean).map(w => w[0].toUpperCase()).slice(0, 3).join('');
  const num = String(Math.floor(Math.random() * 9000) + 1000);
  return `${prefix}-${nameAbbr || 'X'}${num}`;
}

export default function ProductDialog({ open, onClose, product, onSaved }: Props) {
  const [name, setName] = useState('');
  const [sku, setSku] = useState('');
  const [category, setCategory] = useState('');
  const [brand, setBrand] = useState('');
  const [unit, setUnit] = useState('Piece');
  const [description, setDescription] = useState('');
  const [costPrice, setCostPrice] = useState('');
  const [sellingPrice, setSellingPrice] = useState('');
  const [currentStock, setCurrentStock] = useState('0');
  const [lowStockThreshold, setLowStockThreshold] = useState('20');
  const [supplierId, setSupplierId] = useState('');
  const [saving, setSaving] = useState(false);
  const skuManuallyEdited = useRef(false);

  const [categories, setCategories] = useState<Category[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [showNewCat, setShowNewCat] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [addingCat, setAddingCat] = useState(false);

  const [matchedProduct, setMatchedProduct] = useState<Product | null>(null);
  const [mode, setMode] = useState<'form' | 'restock'>('form');
  const [restockQty, setRestockQty] = useState('');
  const [restockNotes, setRestockNotes] = useState('');

  useEffect(() => {
    if (open) {
      getLookups({ type: 'categories' }).then(res => setCategories(res.items as any)).catch(() => {});
      getSuppliers({ limit: 200 }).then(res => setSuppliers(res.suppliers)).catch(() => {});
    }
  }, [open]);

  useEffect(() => {
    skuManuallyEdited.current = false;
    setMatchedProduct(null);
    setMode('form');
    setRestockQty(''); setRestockNotes('');
    setShowNewCat(false); setNewCatName('');
    if (product) {
      setName(product.name); setSku(product.sku); setCategory(product.category ?? '');
      setBrand(product.brand ?? ''); setUnit(product.unit ?? 'Piece');
      setDescription(product.description);
      setCostPrice(String(product.costPrice ?? '')); setSellingPrice(String(product.sellingPrice ?? ''));
      setCurrentStock(String(product.currentStock)); setLowStockThreshold(String(product.lowStockThreshold));
      setSupplierId('');
      skuManuallyEdited.current = true;
    } else {
      setName(''); setSku(''); setCategory(''); setBrand(''); setUnit('Piece');
      setDescription(''); setCostPrice(''); setSellingPrice('');
      setCurrentStock('0'); setLowStockThreshold('20'); setSupplierId('');
    }
  }, [product, open]);

  useEffect(() => {
    if (product || skuManuallyEdited.current) return;
    if (category && name.trim()) {
      const cat = categories.find(c => c.name === category);
      const prefix = cat?.prefix || category.slice(0, 3).toUpperCase();
      setSku(generateSku(prefix, name));
    }
  }, [category, name, product, categories]);

  const checkExisting = useDebouncedCallback(async (searchName: string) => {
    if (product || !searchName.trim() || searchName.trim().length < 2) { setMatchedProduct(null); return; }
    try {
      const res = await getProducts({ search: searchName.trim(), limit: 5 });
      const exactMatch = res.products.find((p: any) => p.name.toLowerCase() === searchName.trim().toLowerCase());
      setMatchedProduct(exactMatch ? exactMatch as Product : null);
    } catch { setMatchedProduct(null); }
  }, 400);

  const handleNameChange = (v: string) => { setName(v); setMode('form'); checkExisting(v); };
  const handleSkuChange = (v: string) => { skuManuallyEdited.current = true; setSku(v); };

  const handleAddCategory = async () => {
    if (!newCatName.trim()) return;
    setAddingCat(true);
    try {
      await saveLookup({ type: 'category', name: newCatName.trim() });
      const res = await getLookups({ type: 'categories' });
      setCategories(res.items as any);
      setCategory(newCatName.trim());
      setShowNewCat(false); setNewCatName('');
      toast.success(`Category "${newCatName.trim()}" added`);
    } catch { toast.error('Failed to add category'); }
    finally { setAddingCat(false); }
  };

  const handleRestock = async () => {
    if (!matchedProduct) return;
    const qty = Number(restockQty);
    if (!qty || qty <= 0) { toast.error('Enter a valid quantity'); return; }
    setSaving(true);
    try {
      const res = await recordStockMovement({ productId: matchedProduct.id, type: 'Stock In', quantity: qty, notes: restockNotes.trim() || 'Restocked via Add Product' });
      toast.success(`${matchedProduct.name} restocked — new level: ${res.newStock}`);
      onSaved();
    } catch { toast.error('Failed to restock'); }
    finally { setSaving(false); }
  };

  const profitPerUnit = (Number(sellingPrice) || 0) - (Number(costPrice) || 0);
  const profitMargin = Number(sellingPrice) > 0 ? (profitPerUnit / Number(sellingPrice)) * 100 : 0;

  const handleSave = async () => {
    if (!name.trim()) { toast.error('Product name is required'); return; }
    setSaving(true);
    try {
      await saveProduct({
        id: product?.id,
        name: name.trim(),
        sku: sku.trim() || undefined,
        category: category || undefined,
        brand: brand.trim() || undefined,
        unit: unit.trim() || undefined,
        description: description.trim() || undefined,
        costPrice: costPrice ? Number(costPrice) : undefined,
        sellingPrice: sellingPrice ? Number(sellingPrice) : undefined,
        currentStock: currentStock ? Number(currentStock) : 0,
        lowStockThreshold: lowStockThreshold ? Number(lowStockThreshold) : 20,
        supplierId: supplierId || undefined,
      });
      toast.success(product ? 'Product updated' : 'Product added');
      onSaved();
    } catch { toast.error('Failed to save product'); }
    finally { setSaving(false); }
  };

  if (mode === 'restock' && matchedProduct) {
    return (
      <Dialog open={open} onOpenChange={v => !v && onClose()}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><PackagePlus className="w-5 h-5 text-primary" />Restock Product</DialogTitle>
            <DialogDescription>
              Adding stock to <strong className="text-foreground">{matchedProduct.name}</strong> — current stock: <strong className="tabular-nums text-foreground">{matchedProduct.currentStock}</strong>
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-1.5"><Label>Quantity to Add</Label><Input type="number" min="1" value={restockQty} onChange={e => setRestockQty(e.target.value)} autoFocus /></div>
            <div className="grid gap-1.5"><Label>Notes (optional)</Label><Textarea value={restockNotes} onChange={e => setRestockNotes(e.target.value)} rows={2} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMode('form')} disabled={saving}>Back</Button>
            <Button onClick={handleRestock} disabled={saving}>{saving && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />}{saving ? 'Restocking…' : 'Add Stock'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{product ? 'Edit Product' : 'Add Product'}</DialogTitle></DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid gap-1.5">
            <Label>Name <span className="text-destructive">*</span></Label>
            <Input value={name} onChange={e => handleNameChange(e.target.value)} placeholder="Product name" />
          </div>

          {!product && matchedProduct && (
            <div className="flex items-start gap-3 p-3 rounded border border-primary/30 bg-primary/5">
              <AlertTriangle className="w-4 h-4 text-primary shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">"{matchedProduct.name}" already exists</p>
                <p className="text-xs text-muted-foreground mt-0.5">Stock: <strong>{matchedProduct.currentStock}</strong></p>
                <Button size="sm" variant="outline" className="mt-2 h-7 text-xs" onClick={() => { setMode('restock'); setRestockQty(''); }}>
                  <PackagePlus className="w-3.5 h-3.5 mr-1" />Add stock to existing product
                </Button>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>Category</Label>
              {showNewCat ? (
                <div className="flex gap-1.5">
                  <Input value={newCatName} onChange={e => setNewCatName(e.target.value)} placeholder="New category" className="h-9" autoFocus onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddCategory(); } }} />
                  <Button size="sm" className="h-9 px-2.5 shrink-0" onClick={handleAddCategory} disabled={addingCat || !newCatName.trim()}>{addingCat ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Add'}</Button>
                  <Button size="sm" variant="ghost" className="h-9 px-2 shrink-0" onClick={() => { setShowNewCat(false); setNewCatName(''); }}>✕</Button>
                </div>
              ) : (
                <Select value={category || 'none'} onValueChange={v => { if (v === '__new__') { setShowNewCat(true); return; } setCategory(v === 'none' ? '' : v); }}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {categories.map(c => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}
                    <SelectItem value="__new__"><span className="flex items-center gap-1.5"><PlusCircle className="w-3.5 h-3.5" /> New Category</span></SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>
            <div className="grid gap-1.5">
              <Label>SKU {!product && <span className="text-muted-foreground text-xs font-normal">(auto)</span>}</Label>
              <Input value={sku} onChange={e => handleSkuChange(e.target.value)} className="font-mono" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5"><Label>Brand</Label><Input value={brand} onChange={e => setBrand(e.target.value)} placeholder="e.g. Samsung" /></div>
            <div className="grid gap-1.5"><Label>Unit</Label><Input value={unit} onChange={e => setUnit(e.target.value)} placeholder="e.g. Piece, Box, Kg" /></div>
          </div>

          <div className="grid gap-1.5"><Label>Description</Label><Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Optional description" rows={2} /></div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5"><Label>Cost Price (MVR)</Label><Input type="number" min="0" step="0.01" value={costPrice} onChange={e => setCostPrice(e.target.value)} placeholder="0.00" /></div>
            <div className="grid gap-1.5"><Label>Selling Price (MVR)</Label><Input type="number" min="0" step="0.01" value={sellingPrice} onChange={e => setSellingPrice(e.target.value)} placeholder="0.00" /></div>
          </div>

          {(Number(costPrice) > 0 || Number(sellingPrice) > 0) && (
            <div className="bg-muted/50 rounded-lg p-3 flex gap-6 text-sm">
              <div><span className="text-muted-foreground">Profit/Unit:</span> <span className={`font-semibold ${profitPerUnit >= 0 ? 'text-primary' : 'text-destructive'}`}>MVR {profitPerUnit.toFixed(2)}</span></div>
              <div><span className="text-muted-foreground">Margin:</span> <span className={`font-semibold ${profitMargin >= 0 ? 'text-primary' : 'text-destructive'}`}>{profitMargin.toFixed(1)}%</span></div>
            </div>
          )}

          <div className="grid grid-cols-3 gap-3">
            <div className="grid gap-1.5"><Label>Stock</Label><Input type="number" min="0" value={currentStock} onChange={e => setCurrentStock(e.target.value)} /></div>
            <div className="grid gap-1.5"><Label>Low Threshold</Label><Input type="number" min="0" value={lowStockThreshold} onChange={e => setLowStockThreshold(e.target.value)} /></div>
            <div className="grid gap-1.5">
              <Label>Supplier</Label>
              <Select value={supplierId || 'none'} onValueChange={v => setSupplierId(v === 'none' ? '' : v)}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {suppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>{saving && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />}{saving ? 'Saving…' : product ? 'Update' : 'Add Product'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
