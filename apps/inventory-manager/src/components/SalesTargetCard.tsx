import { useState } from 'react';
import { saveSalesTarget } from '@/lib/api-client';
import { Button } from '@project/components/ui/button';
import { Label } from '@project/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@project/components/ui/dialog';
import { Target, Pencil, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import NumericInput from './NumericInput';

const fmt = (n: number) => `MVR ${n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

type SalesTarget = {
  month: string;
  revenueTarget: number;
  profitTarget: number;
  carriedOver: boolean;
  dayOfMonth: number;
  daysInMonth: number;
};

function GoalBar({ label, actual, target, dayOfMonth, daysInMonth }: {
  label: string; actual: number; target: number; dayOfMonth: number; daysInMonth: number;
}) {
  const pct = target > 0 ? (actual / target) * 100 : 0;
  const shown = Math.max(0, Math.min(100, pct));
  // Where you "should" be if sales were spread evenly across the month.
  const expectedPct = (dayOfMonth / daysInMonth) * 100;
  const daysLeft = daysInMonth - dayOfMonth; // days after today
  const remaining = Math.max(0, target - actual);
  const reached = actual >= target;
  const onPace = pct >= expectedPct;

  let note: string;
  if (reached) note = `Goal reached. ${fmt(actual - target)} over.`;
  else if (daysLeft <= 0) note = `${fmt(remaining)} to go today, the last day of the month.`;
  else note = `${fmt(remaining)} to go. About ${fmt(Math.ceil(remaining / (daysLeft + 1)))} a day for the remaining ${daysLeft + 1} days.`;

  const barColor = reached ? 'bg-primary' : onPace ? 'bg-primary/80' : 'bg-yellow-500';

  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm font-medium">{label}</span>
        <span className="text-xs text-muted-foreground truncate">{fmt(actual)} of {fmt(target)}</span>
      </div>
      <div className="relative h-3 w-full rounded-full bg-muted overflow-hidden" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
        <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${shown}%` }} />
        {!reached && (
          <div
            className="absolute top-0 h-full w-0.5 bg-foreground/40"
            style={{ left: `${Math.min(100, expectedPct)}%` }}
            title={`Even pace: ${Math.round(expectedPct)}% by today`}
          />
        )}
      </div>
      <div className="flex items-start justify-between gap-2 text-xs">
        <span className={`font-semibold ${reached ? 'text-primary' : onPace ? 'text-primary' : 'text-yellow-700 dark:text-yellow-500'}`}>
          {reached && <CheckCircle2 className="inline w-3.5 h-3.5 mr-1 -mt-0.5" />}
          {Math.round(pct)}% of this month's goal
          {!reached && <span className="font-normal text-muted-foreground"> · {onPace ? 'on pace' : 'behind pace'}</span>}
        </span>
      </div>
      <p className="text-xs text-muted-foreground">{note}</p>
    </div>
  );
}

export function SalesTargetCard({ target, monthSales, monthProfit, onSaved }: {
  target: SalesTarget | undefined;
  monthSales: number;
  monthProfit: number;
  onSaved: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [revenue, setRevenue] = useState(0);
  const [profit, setProfit] = useState(0);
  const [saving, setSaving] = useState(false);

  if (!target) return null;
  const monthName = new Date(`${target.month}-01T00:00:00`).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  const hasGoal = target.revenueTarget > 0 || target.profitTarget > 0;

  const openEditor = () => {
    setRevenue(target.revenueTarget || 0);
    setProfit(target.profitTarget || 0);
    setOpen(true);
  };

  const handleSave = async () => {
    if (revenue < 0 || profit < 0) { toast.error('Goals cannot be negative'); return; }
    setSaving(true);
    try {
      await saveSalesTarget({ revenueTarget: revenue, profitTarget: profit, month: target.month });
      toast.success(revenue || profit ? `${monthName} goal saved` : 'Goal cleared');
      setOpen(false);
      onSaved();
    } catch (e: any) {
      toast.error(e.message || 'Failed to save goal');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      {hasGoal ? (
        <div className="bg-card border rounded-lg p-4 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-semibold flex items-center gap-2">
              <Target className="w-4 h-4 text-primary" /> {monthName} goal
            </h3>
            <Button variant="ghost" size="sm" onClick={openEditor}><Pencil className="w-3.5 h-3.5 mr-1.5" />Edit</Button>
          </div>
          <div className={`grid gap-5 ${target.revenueTarget > 0 && target.profitTarget > 0 ? 'md:grid-cols-2' : ''}`}>
            {target.revenueTarget > 0 && (
              <GoalBar label="Revenue" actual={monthSales} target={target.revenueTarget} dayOfMonth={target.dayOfMonth} daysInMonth={target.daysInMonth} />
            )}
            {target.profitTarget > 0 && (
              <GoalBar label="Gross profit" actual={monthProfit} target={target.profitTarget} dayOfMonth={target.dayOfMonth} daysInMonth={target.daysInMonth} />
            )}
          </div>
          {target.carriedOver && (
            <p className="text-[11px] text-muted-foreground">Carried over from your last goal. Tap Edit to change it for {monthName}.</p>
          )}
        </div>
      ) : (
        <div className="bg-card border border-dashed rounded-lg p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center flex-shrink-0"><Target className="w-4 h-4" /></div>
            <div>
              <p className="font-medium text-sm">Set a goal for {monthName}</p>
              <p className="text-xs text-muted-foreground">Pick a revenue or profit target and track progress here every day.</p>
            </div>
          </div>
          <Button size="sm" onClick={openEditor}>Set goal</Button>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{monthName} goal</DialogTitle>
            <DialogDescription>Fill in one or both. Leave a box at 0 to skip it. Next month keeps this goal until you change it.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Revenue goal (MVR)</Label>
              <NumericInput min={0} step={100} value={revenue} onChange={e => setRevenue(Number(e.target.value))} placeholder="e.g. 50000" />
              {monthSales > 0 && <p className="text-xs text-muted-foreground">So far this month: {fmt(monthSales)}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Gross profit goal (MVR)</Label>
              <NumericInput min={0} step={100} value={profit} onChange={e => setProfit(Number(e.target.value))} placeholder="e.g. 15000" />
              <p className="text-xs text-muted-foreground">Sales minus product cost, before expenses.{monthProfit > 0 ? ` So far: ${fmt(monthProfit)}` : ''}</p>
            </div>
            <Button className="w-full" onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save goal'}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
