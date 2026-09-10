import { useState, useEffect, useCallback } from 'react';
import { getSuppliers, saveSupplier, deleteSupplier, getUsers, createSupplierLogin, resetPassword, setUserStatus } from '@/lib/api-client';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { Label } from '@project/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@project/components/ui/dialog';
import { Badge } from '@project/components/ui/badge';
import { Skeleton } from '@project/components/ui/skeleton';
import { Textarea } from '@project/components/ui/textarea';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@project/components/ui/alert-dialog';
import { Plus, Search, Trash2, Pencil, Truck, Phone, Mail, KeyRound, UserPlus, Ban, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [editId, setEditId] = useState<string | undefined>();

  const [form, setForm] = useState({ name: '', phone: '', email: '', address: '', notes: '' });

  const [users, setUsers] = useState<any[]>([]);
  const loadUsers = useCallback(async () => {
    try { setUsers((await getUsers()).users); } catch { /* ignore */ }
  }, []);

  const [loginSupplier, setLoginSupplier] = useState<any | null>(null);
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [loginSaving, setLoginSaving] = useState(false);

  const [resetUser, setResetUser] = useState<any | null>(null);
  const [resetPasswordValue, setResetPasswordValue] = useState('');
  const [resetSaving, setResetSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getSuppliers({ search: search || undefined, limit: 100 });
      setSuppliers(res.suppliers);
      setTotal(res.total);
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { loadUsers(); }, [loadUsers]);

  const openDialog = (supplier?: any) => {
    if (supplier) {
      setEditId(supplier.id);
      setForm({ name: supplier.name, phone: supplier.phone, email: supplier.email, address: supplier.address, notes: supplier.notes });
    } else {
      setEditId(undefined);
      setForm({ name: '', phone: '', email: '', address: '', notes: '' });
    }
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error('Name is required'); return; }
    setSaving(true);
    try {
      await saveSupplier({ id: editId, name: form.name, phone: form.phone || undefined, email: form.email || undefined, address: form.address || undefined, notes: form.notes || undefined });
      toast.success(editId ? 'Supplier updated' : 'Supplier added');
      setDialogOpen(false);
      load();
    } catch (e: any) {
      toast.error(e.message || 'Failed');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteSupplier({ id: deleteId });
      toast.success('Supplier deleted');
      setDeleteId(null);
      load();
    } catch (e: any) {
      toast.error(e.message || 'Failed');
    }
  };

  const openLoginDialog = (supplier: any) => {
    setLoginSupplier(supplier);
    setLoginForm({ username: supplier.name.toLowerCase().replace(/[^a-z0-9]+/g, '.').replace(/^\.|\.$/g, ''), password: '' });
  };

  const handleCreateLogin = async () => {
    if (!loginSupplier || !loginForm.username.trim() || loginForm.password.length < 6) {
      toast.error('Username required and password must be at least 6 characters'); return;
    }
    setLoginSaving(true);
    try {
      await createSupplierLogin({ supplierId: loginSupplier.id, username: loginForm.username.trim(), password: loginForm.password });
      toast.success(`Login created for ${loginSupplier.name}`);
      setLoginSupplier(null);
      load();
      loadUsers();
    } catch (e: any) {
      toast.error(e.message || 'Failed to create login');
    } finally {
      setLoginSaving(false);
    }
  };

  const handleResetPassword = async () => {
    if (!resetUser || resetPasswordValue.length < 6) { toast.error('Password must be at least 6 characters'); return; }
    setResetSaving(true);
    try {
      await resetPassword({ userId: resetUser.id, newPassword: resetPasswordValue });
      toast.success('Password reset');
      setResetUser(null);
      setResetPasswordValue('');
    } catch (e: any) {
      toast.error(e.message || 'Failed');
    } finally {
      setResetSaving(false);
    }
  };

  const toggleUserStatus = async (u: any) => {
    try {
      await setUserStatus({ userId: u.id, status: u.status === 'Active' ? 'Disabled' : 'Active' });
      toast.success(u.status === 'Active' ? 'Login disabled' : 'Login re-enabled');
      loadUsers();
    } catch (e: any) {
      toast.error(e.message || 'Failed');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Suppliers</h1>
          <p className="text-sm text-muted-foreground">{total} supplier{total !== 1 ? 's' : ''}</p>
        </div>
        <Button onClick={() => openDialog()}><Plus className="w-4 h-4 mr-2" />Add Supplier</Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input className="pl-9" placeholder="Search suppliers..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-32 w-full rounded-lg" />)}</div>
      ) : suppliers.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Truck className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="font-medium">No suppliers found</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {suppliers.map(s => (
            <div key={s.id} className="bg-card border rounded-lg p-4 space-y-2">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold">{s.name}</h3>
                  <Badge variant="secondary" className="mt-1">{s.status}</Badge>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" onClick={() => openDialog(s)}><Pencil className="w-4 h-4" /></Button>
                  <Button variant="ghost" size="icon" onClick={() => setDeleteId(s.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                </div>
              </div>
              {s.phone && <div className="flex items-center gap-2 text-sm text-muted-foreground"><Phone className="w-3.5 h-3.5" />{s.phone}</div>}
              {s.email && <div className="flex items-center gap-2 text-sm text-muted-foreground"><Mail className="w-3.5 h-3.5" />{s.email}</div>}
              {s.address && <p className="text-xs text-muted-foreground line-clamp-2">{s.address}</p>}
              {(() => {
                const u = users.find((x: any) => x.role === 'supplier' && x.supplierId === s.id);
                if (!u) {
                  return (
                    <Button variant="outline" size="sm" className="w-full mt-1" onClick={() => openLoginDialog(s)}>
                      <UserPlus className="w-3.5 h-3.5 mr-1.5" /> Create login
                    </Button>
                  );
                }
                return (
                  <div className="flex items-center justify-between gap-2 pt-1 border-t mt-2">
                    <div className="text-xs">
                      <span className="font-medium">{u.username}</span>{' '}
                      <Badge variant={u.status === 'Active' ? 'secondary' : 'destructive'} className="ml-1">{u.status}</Badge>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" title="Reset password" onClick={() => { setResetUser(u); setResetPasswordValue(''); }}>
                        <KeyRound className="w-3.5 h-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" title={u.status === 'Active' ? 'Disable login' : 'Enable login'} onClick={() => toggleUserStatus(u)}>
                        {u.status === 'Active' ? <Ban className="w-3.5 h-3.5" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                      </Button>
                    </div>
                  </div>
                );
              })()}
            </div>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editId ? 'Edit Supplier' : 'Add Supplier'}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Name</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Supplier name" /></div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div><Label>Phone</Label><Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="+960..." /></div>
              <div><Label>Email</Label><Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="email@example.com" /></div>
            </div>
            <div><Label>Address</Label><Textarea value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} placeholder="Address" rows={2} /></div>
            <div><Label>Notes</Label><Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Optional notes" rows={2} /></div>
            <Button className="w-full" onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : (editId ? 'Update Supplier' : 'Add Supplier')}</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!loginSupplier} onOpenChange={open => !open && setLoginSupplier(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Create login for {loginSupplier?.name}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              They'll be able to sign in and add/edit/delete their own products, see their stock levels, and see their profit share — nothing else.
            </p>
            <div><Label>Username</Label><Input value={loginForm.username} onChange={e => setLoginForm(f => ({ ...f, username: e.target.value }))} /></div>
            <div><Label>Password</Label><Input type="password" value={loginForm.password} onChange={e => setLoginForm(f => ({ ...f, password: e.target.value }))} placeholder="At least 6 characters" /></div>
            <Button className="w-full" onClick={handleCreateLogin} disabled={loginSaving}>{loginSaving ? 'Creating...' : 'Create login'}</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!resetUser} onOpenChange={open => !open && setResetUser(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Reset password for {resetUser?.username}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>New password</Label><Input type="password" value={resetPasswordValue} onChange={e => setResetPasswordValue(e.target.value)} placeholder="At least 6 characters" /></div>
            <Button className="w-full" onClick={handleResetPassword} disabled={resetSaving}>{resetSaving ? 'Saving...' : 'Reset password'}</Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={open => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Supplier</AlertDialogTitle>
            <AlertDialogDescription>This will permanently delete this supplier.</AlertDialogDescription>
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
