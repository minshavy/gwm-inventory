import { useState, useEffect, useCallback } from 'react';
import { getSupplierBalances, getSupplierPayouts, recordPayout, deletePayout } from '@/lib/api-client';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { Label } from '@project/components/ui/label';
import { Textarea } from '@project/components/ui/textarea';
import { Skeleton } from '@project/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@project/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@project/components/ui/alert-dialog';
import { Wallet, HandCoins, History, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

const fmt = (n: number) => `MVR ${(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function PayoutsPage() {
  const [balances, setBalances] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [payTarget, setPayTarget] = useState<any | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [payDate, setPayDate] = useState(new Date().toISOString().slice(0, 10));
  const [payNotes, setPayNotes] = useState('');
  const [paying, setPaying] = useState(false);

  const [historyTarget, setHistoryTarget] = useState<any | null>(null);
  const [historyData, setHistoryData] = useState<any | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getSupplierBalances({});
      setBalances(res.balances);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openPayDialog = (supplier: any) => {
    setPayTarget(supplier);
    setPayAmount(supplier.balance > 0 ? supplier.balance.toFixed(2) : '');
    setPayDate(new Date().toISOString().slice(0, 10));
    setPayNotes('');
  };

  const handleRecordPayout = async () => {
    if (!payTarget || !payAmount || Number(payAmount) <= 0) { toast.error('Enter an amount greater than 0'); return; }
    setPaying(true);
    try {
      await recordPayout({ supplierId: payTarget.supplierId, amount: Number(payAmount), date: payDate, notes: payNotes || undefined });
      toast.success(`Marked ${fmt(Number(payAmount))} as paid to ${payTarget.supplierName}`);
      setPayTarget(null);
      load();
      if (historyTarget?.supplierId === payTarget.supplierId) openHistory(payTarget);
    } catch (e: any) {
      toast.error(e.message || 'Failed to record payout');
    } finally {
      setPaying(false);
    }
  };

  const openHistory = async (supplier: any) => {
    setHistoryTarget(supplier);
    setHistoryLoading(true);
    try {
      const res = await getSupplierPayouts({ supplierId: supplier.supplierId });
      setHistoryData(res);
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleDeletePayout = async () => {
    if (!deleteId) return;
    try {
      await deletePayout({ id: deleteId });
      toast.success('Payout removed');
      setDeleteId(null);
      load();
      if (historyTarget) openHistory(historyTarget);
    } catch (e: any) {
      toast.error(e.message || 'Failed to remove');
    }
  };

  const totalOwed = balances.reduce((sum, b) => sum + Math.max(0, b.balance), 0);
  const totalPaidAllTime = balances.reduce((sum, b) => sum + b.totalPaid, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Supplier Payouts</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Each supplier earns 1/3 of the profit on their own products. Track what's owed and mark payouts as you make them.
        </p>
      </div>

      {loading ? (
        <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-lg" />)}</div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="bg-card border rounded-lg p-4 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-amber-500/10 text-amber-600 flex items-center justify-center"><Wallet className="w-4 h-4" /></div>
              <div>
                <p className="text-xs text-muted-foreground">Total currently owed</p>
                <p className="text-base font-bold">{fmt(totalOwed)}</p>
              </div>
            </div>
            <div className="bg-card border rounded-lg p-4 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-emerald-500/10 text-emerald-600 flex items-center justify-center"><HandCoins className="w-4 h-4" /></div>
              <div>
                <p className="text-xs text-muted-foreground">Total paid out (all-time)</p>
                <p className="text-base font-bold">{fmt(totalPaidAllTime)}</p>
              </div>
            </div>
          </div>

          {balances.length === 0 ? (
            <div className="border rounded-lg p-8 text-center text-sm text-muted-foreground">No suppliers yet.</div>
          ) : (
            <div className="border rounded-lg overflow-hidden divide-y">
              {balances.map(b => (
                <div key={b.supplierId} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium truncate">{b.supplierName}</p>
                    <p className="text-xs text-muted-foreground">
                      Earned {fmt(b.totalShare)} · Paid {fmt(b.totalPaid)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Balance owed</p>
                      <p className={`font-bold ${b.balance > 0 ? 'text-destructive' : 'text-emerald-600'}`}>{fmt(b.balance)}</p>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => openHistory(b)}>
                      <History className="w-3.5 h-3.5 mr-1.5" /> History
                    </Button>
                    <Button size="sm" onClick={() => openPayDialog(b)} disabled={b.balance <= 0}>
                      Mark as Paid
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Record payout dialog */}
      <Dialog open={!!payTarget} onOpenChange={open => !open && setPayTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Record payout to {payTarget?.supplierName}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Currently owed: <span className="font-semibold text-foreground">{payTarget && fmt(payTarget.balance)}</span>
            </p>
            <div className="space-y-1.5">
              <Label>Amount paid</Label>
              <Input type="number" value={payAmount} onChange={e => setPayAmount(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Date</Label>
              <Input type="date" value={payDate} onChange={e => setPayDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Notes (optional)</Label>
              <Textarea value={payNotes} onChange={e => setPayNotes(e.target.value)} placeholder="e.g. Bank transfer, partial payment..." />
            </div>
            <Button className="w-full" onClick={handleRecordPayout} disabled={paying}>{paying ? 'Saving...' : 'Mark as Paid'}</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Payout history dialog */}
      <Dialog open={!!historyTarget} onOpenChange={open => !open && setHistoryTarget(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Payout history — {historyTarget?.supplierName}</DialogTitle></DialogHeader>
          {historyLoading || !historyData ? (
            <Skeleton className="h-40 rounded" />
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-muted/40 rounded-lg p-2">
                  <p className="text-[11px] text-muted-foreground">Earned</p>
                  <p className="text-sm font-bold">{fmt(historyData.totalShare)}</p>
                </div>
                <div className="bg-muted/40 rounded-lg p-2">
                  <p className="text-[11px] text-muted-foreground">Paid</p>
                  <p className="text-sm font-bold">{fmt(historyData.totalPaid)}</p>
                </div>
                <div className="bg-muted/40 rounded-lg p-2">
                  <p className="text-[11px] text-muted-foreground">Balance</p>
                  <p className={`text-sm font-bold ${historyData.balance > 0 ? 'text-destructive' : 'text-emerald-600'}`}>{fmt(historyData.balance)}</p>
                </div>
              </div>
              {historyData.payouts.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No payouts recorded yet.</p>
              ) : (
                <div className="max-h-72 overflow-y-auto divide-y border rounded-lg"
                  onWheel={(e) => { e.currentTarget.scrollTop += e.deltaY; }}
                  onTouchStart={(e) => { (e.currentTarget as any)._touchY = e.touches[0].clientY; }}
                  onTouchMove={(e) => {
                    const el = e.currentTarget as any;
                    const y = e.touches[0].clientY;
                    el.scrollTop += el._touchY - y;
                    el._touchY = y;
                  }}
                  style={{ touchAction: 'pan-y' }}
                >
                  {historyData.payouts.map((p: any) => (
                    <div key={p.id} className="p-3 flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-medium">{fmt(p.amount)}</p>
                        <p className="text-xs text-muted-foreground">{p.date}{p.notes ? ` · ${p.notes}` : ''}</p>
                      </div>
                      <Button variant="ghost" size="icon" onClick={() => setDeleteId(p.id)}>
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
              <Button
                className="w-full"
                variant="outline"
                onClick={() => openPayDialog({ supplierId: historyTarget.supplierId, supplierName: historyTarget.supplierName, balance: historyData.balance })}
              >
                Record another payout
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={open => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this payout record?</AlertDialogTitle>
            <AlertDialogDescription>This just removes the record — it won't affect actual money already paid, but the balance owed will go back up.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeletePayout}>Remove</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
