import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@project/components/ui/dialog';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { Label } from '@project/components/ui/label';
import { Textarea } from '@project/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@project/components/ui/select';
import { Loader2 } from 'lucide-react';
import { recordStockMovement, getSuppliers } from '@/lib/api-client';
import { toast } from 'sonner';

interface Product { id: string; name: string; currentStock: number; }
interface Props { open: boolean; onClose: () => void; product: Product | null; onSaved: () => void; }

export default function StockMovementDialog({ open, onClose, product, onSaved }: Props) {
  const [type, setType] = useState<'Stock In' | 'Stock Out' | 'Adjustment' | 'Stock Returned'>('Stock In');
  const [quantity, setQuantity] = useState('');
  const [purchasePrice, setPurchasePrice] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [invoiceReference, setInvoiceReference] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [suppliers, setSuppliers] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    if (open) {
      getSuppliers({ limit: 200 }).then(res => setSuppliers(res.suppliers)).catch(() => {});
      setType('Stock In'); setQuantity(''); setPurchasePrice(''); setSupplierId(''); setInvoiceReference(''); setNotes('');
    }
  }, [open]);

  const handleSave = async () => {
    if (!product) return;
    const qty = Number(quantity);
    if (!qty || qty <= 0) { toast.error('Enter a valid quantity'); return; }
    setSaving(true);
    try {
      const res = await recordStockMovement({
        productId: product.id, type, quantity: qty,
        purchasePrice: purchasePrice ? Number(purchasePrice) : undefined,
        supplierId: supplierId || undefined,
        invoiceReference: invoiceReference.trim() || undefined,
        notes: notes.trim() || undefined,
      });
      toast.success(`Stock updated — new level: ${res.newStock}`);
      onSaved(); onClose();
    } catch { toast.error('Failed to record movement'); }
    finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Record Stock Movement</DialogTitle>
          {product && <DialogDescription><span className="font-medium text-foreground">{product.name}</span> — current stock: <strong className="tabular-nums">{product.currentStock}</strong></DialogDescription>}
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>Movement Type</Label>
              <Select value={type} onValueChange={v => setType(v as typeof type)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Stock In">Stock In</SelectItem>
                  <SelectItem value="Stock Out">Stock Out</SelectItem>
                  <SelectItem value="Stock Returned">Stock Returned</SelectItem>
                  <SelectItem value="Adjustment">Adjustment (set level)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5"><Label>Quantity</Label><Input type="number" min="1" value={quantity} onChange={e => setQuantity(e.target.value)} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5"><Label>Purchase Price (MVR)</Label><Input type="number" min="0" step="0.01" value={purchasePrice} onChange={e => setPurchasePrice(e.target.value)} placeholder="0.00" /></div>
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
          <div className="grid gap-1.5"><Label>Invoice / Reference</Label><Input value={invoiceReference} onChange={e => setInvoiceReference(e.target.value)} placeholder="e.g. INV-001" /></div>
          <div className="grid gap-1.5"><Label>Notes (optional)</Label><Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="e.g. Received from supplier" rows={2} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>{saving && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />}{saving ? 'Recording…' : 'Record'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
