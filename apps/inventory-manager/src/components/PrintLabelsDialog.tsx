import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@project/components/ui/dialog';
import { Button } from '@project/components/ui/button';
import { Label } from '@project/components/ui/label';
import NumericInput from './NumericInput';
import { Printer, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { LabelItem, LabelLayout, openPrintWindow, printLabels } from '@/lib/barcode-labels';

const PREF_KEY = 'gwm_label_prefs';
function loadPrefs(): { layout: LabelLayout; showPrice: boolean } {
  try {
    const p = JSON.parse(localStorage.getItem(PREF_KEY) || '{}');
    return { layout: p.layout === 'roll' ? 'roll' : 'a4', showPrice: p.showPrice !== false };
  } catch { return { layout: 'a4', showPrice: true }; }
}

export function PrintLabelsDialog({
  open, onOpenChange, items, count, title = 'Print barcode labels',
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // Either the products to print, or a loader (used for "all products").
  items: LabelItem[] | (() => Promise<LabelItem[]>);
  // How many products will print (shown in the description).
  count: number;
  title?: string;
}) {
  const initial = loadPrefs();
  const [layout, setLayout] = useState<LabelLayout>(initial.layout);
  const [showPrice, setShowPrice] = useState(initial.showPrice);
  const [copies, setCopies] = useState(1);
  const [busy, setBusy] = useState(false);

  const handlePrint = async () => {
    try { localStorage.setItem(PREF_KEY, JSON.stringify({ layout, showPrice })); } catch { /* ignore */ }
    const w = openPrintWindow(); // must happen before any await
    setBusy(true);
    try {
      const list = typeof items === 'function' ? await items() : items;
      printLabels(w, list, { layout, copies, showPrice });
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message || 'Could not prepare labels');
    } finally {
      setBusy(false);
    }
  };

  const total = count * Math.max(1, copies || 1);
  const option = (value: LabelLayout, name: string, detail: string) => (
    <button
      type="button"
      onClick={() => setLayout(value)}
      className={`text-left rounded-lg border p-3 transition-colors ${layout === value ? 'border-primary bg-primary/5' : 'hover:bg-muted/40'}`}
    >
      <p className="text-sm font-medium">{name}</p>
      <p className="text-xs text-muted-foreground">{detail}</p>
    </button>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {count} product{count === 1 ? '' : 's'} · {total} label{total === 1 ? '' : 's'}
            {layout === 'a4' ? ` · about ${Math.ceil(total / 24)} A4 sheet${Math.ceil(total / 24) === 1 ? '' : 's'}` : ''}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Paper</Label>
            <div className="grid grid-cols-2 gap-2">
              {option('a4', 'A4 sticker sheet', '24 labels, 64 × 34 mm')}
              {option('roll', 'Label printer', 'One 50 × 30 mm label each')}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Copies of each label</Label>
            <NumericInput min={1} max={500} value={copies} onChange={e => setCopies(Number(e.target.value))} />
            <p className="text-xs text-muted-foreground">Tip: print one per item in stock so every unit gets a sticker.</p>
          </div>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" className="h-4 w-4 accent-[hsl(var(--primary))]" checked={showPrice} onChange={e => setShowPrice(e.target.checked)} />
            Show selling price on the label
          </label>
          <Button className="w-full" onClick={handlePrint} disabled={busy || count === 0}>
            {busy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Printer className="w-4 h-4 mr-2" />}
            Print labels
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
