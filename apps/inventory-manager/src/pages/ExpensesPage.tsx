import { useState, useEffect, useCallback } from 'react';
import { getExpenses, saveExpense, deleteExpense, getLookups } from '@/lib/api-client';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { Label } from '@project/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@project/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@project/components/ui/dialog';
import { Badge } from '@project/components/ui/badge';
import { Skeleton } from '@project/components/ui/skeleton';
import { DateRangeFilter } from '@/components/DateRangeFilter';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@project/components/ui/alert-dialog';
import { Plus, Search, Trash2, Pencil, Receipt } from 'lucide-react';
import { toast } from 'sonner';
import NumericInput from '../components/NumericInput';

const fmt = (n: number) => `MVR ${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [totalAmount, setTotalAmount] = useState(0);
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [categories, setCategories] = useState<any[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<any[]>([]);
  const [editId, setEditId] = useState<string | undefined>();

  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0, 10), categoryId: '',
    description: '', amount: 0, paymentMethodId: '', notes: '',
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getExpenses({
        search: search || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        limit: 100,
      });
      setExpenses(res.expenses);
      setTotal(res.total);
      setTotalAmount(res.totalAmount);
    } finally {
      setLoading(false);
    }
  }, [search, dateFrom, dateTo]);

  useEffect(() => { load(); }, [load]);

  const openDialog = async (expense?: any) => {
    const [cats, pms] = await Promise.all([
      getLookups({ type: 'expenseCategories' }),
      getLookups({ type: 'paymentMethods' }),
    ]);
    setCategories(cats.items);
    setPaymentMethods(pms.items.filter((pm: any) => pm.status === 'Active'));

    if (expense) {
      setEditId(expense.id);
      setForm({
        date: expense.date?.slice(0, 10) ?? new Date().toISOString().slice(0, 10),
        categoryId: cats.items.find((c: any) => c.name === expense.categoryName)?.id ?? '',
        description: expense.description,
        amount: expense.amount,
        paymentMethodId: pms.items.find((pm: any) => pm.name === expense.paymentMethod)?.id ?? '',
        notes: expense.notes,
      });
    } else {
      setEditId(undefined);
      setForm({ date: new Date().toISOString().slice(0, 10), categoryId: '', description: '', amount: 0, paymentMethodId: '', notes: '' });
    }
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.description) { toast.error('Description is required'); return; }
    if (form.amount <= 0) { toast.error('Amount must be positive'); return; }
    setSaving(true);
    try {
      await saveExpense({
        id: editId,
        date: form.date,
        categoryId: form.categoryId || undefined,
        description: form.description,
        amount: form.amount,
        paymentMethodId: form.paymentMethodId || undefined,
        notes: form.notes || undefined,
      });
      toast.success(editId ? 'Expense updated' : 'Expense added');
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
      await deleteExpense({ id: deleteId });
      toast.success('Expense deleted');
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
          <h1 className="text-2xl font-bold">Expenses</h1>
          <p className="text-sm text-muted-foreground">{total} expense{total !== 1 ? 's' : ''} · Total: {fmt(totalAmount)}</p>
        </div>
        <Button onClick={() => openDialog()}><Plus className="w-4 h-4 mr-2" />Add Expense</Button>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search expenses..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <DateRangeFilter dateFrom={dateFrom} dateTo={dateTo} onFromChange={setDateFrom} onToChange={setDateTo} />
      </div>

      {loading ? (
        <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
      ) : expenses.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Receipt className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="font-medium">No expenses found</p>
        </div>
      ) : (
        <>
          {/* Mobile cards */}
          <div className="md:hidden space-y-2">
            {expenses.map(ex => (
              <div key={ex.id} className="bg-card border rounded-lg p-3 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-sm truncate flex-1">{ex.description}</span>
                  <div className="flex gap-0.5 ml-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openDialog(ex)}><Pencil className="w-3.5 h-3.5" /></Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setDeleteId(ex.id)}><Trash2 className="w-3.5 h-3.5 text-destructive" /></Button>
                  </div>
                </div>
                <div className="flex items-center justify-between text-sm">
                  {ex.categoryName && <Badge variant="secondary" className="text-xs">{ex.categoryName}</Badge>}
                  <span className="font-medium ml-auto">{fmt(ex.amount)}</span>
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{ex.date ? new Date(ex.date).toLocaleDateString() : '-'}</span>
                  {ex.paymentMethod && <Badge variant="outline" className="text-[10px]">{ex.paymentMethod}</Badge>}
                </div>
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
                  <th className="text-left px-4 py-3 font-medium">Description</th>
                  <th className="text-left px-4 py-3 font-medium">Category</th>
                  <th className="text-right px-4 py-3 font-medium">Amount</th>
                  <th className="text-left px-4 py-3 font-medium">Payment</th>
                  <th className="text-right px-4 py-3 font-medium w-20"></th>
                </tr>
              </thead>
              <tbody>
                {expenses.map(ex => (
                  <tr key={ex.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{ex.expenseId}</td>
                    <td className="px-4 py-3">{ex.date ? new Date(ex.date).toLocaleDateString() : '-'}</td>
                    <td className="px-4 py-3 font-medium">{ex.description}</td>
                    <td className="px-4 py-3">{ex.categoryName && <Badge variant="secondary">{ex.categoryName}</Badge>}</td>
                    <td className="px-4 py-3 text-right font-medium">{fmt(ex.amount)}</td>
                    <td className="px-4 py-3">{ex.paymentMethod && <Badge variant="outline">{ex.paymentMethod}</Badge>}</td>
                    <td className="px-4 py-3 text-right flex gap-1 justify-end">
                      <Button variant="ghost" size="icon" onClick={() => openDialog(ex)}><Pencil className="w-4 h-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => setDeleteId(ex.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editId ? 'Edit Expense' : 'Add Expense'}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div><Label>Date</Label><Input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} /></div>
              <div>
                <Label>Category</Label>
                <Select value={form.categoryId} onValueChange={v => setForm(f => ({ ...f, categoryId: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div><Label>Description</Label><Input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="What was this expense for?" /></div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div><Label>Amount (MVR)</Label><NumericInput min={0} step={0.01} value={form.amount} onChange={e => setForm(f => ({ ...f, amount: Number(e.target.value) }))} /></div>
              <div>
                <Label>Payment Method</Label>
                <Select value={form.paymentMethodId} onValueChange={v => setForm(f => ({ ...f, paymentMethodId: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    {paymentMethods.map(pm => <SelectItem key={pm.id} value={pm.id}>{pm.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div><Label>Notes</Label><Input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Optional notes" /></div>
            <Button className="w-full" onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : (editId ? 'Update Expense' : 'Add Expense')}</Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={open => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Expense</AlertDialogTitle>
            <AlertDialogDescription>This will permanently delete this expense record.</AlertDialogDescription>
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
