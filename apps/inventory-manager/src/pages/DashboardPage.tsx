import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { getDashboard, getNotifications, markNotificationsRead, confirmStockUpdate, rejectStockUpdate } from '@/lib/api-client';
import { Skeleton } from '@project/components/ui/skeleton';
import { Button } from '@project/components/ui/button';
import { Badge } from '@project/components/ui/badge';
import {
  Package, DollarSign, TrendingUp, TrendingDown, AlertTriangle,
  XCircle, ShoppingCart, ArrowDown, Bell, ArrowRight, Check, X, Loader2,
} from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts';

const fmt = (n: number) => `MVR ${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtShort = (n: number) => {
  if (n >= 1000000) return `MVR ${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `MVR ${(n / 1000).toFixed(1)}K`;
  return fmt(n);
};

const COLORS = ['hsl(var(--chart-1))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))'];

function StatCard({ label, value, icon: Icon, color, sub, onClick }: { label: string; value: string | number; icon: any; color: string; sub?: string; onClick?: () => void }) {
  const Comp: any = onClick ? 'button' : 'div';
  return (
    <Comp
      onClick={onClick}
      className={`bg-card border rounded-lg p-3 sm:p-4 flex items-start gap-2 sm:gap-3 overflow-hidden w-full text-left ${onClick ? 'cursor-pointer hover:border-primary/50 transition-colors' : ''}`}
    >
      <div className={`w-8 h-8 sm:w-9 sm:h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${color}`}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] sm:text-xs text-muted-foreground truncate">{label}</p>
        <p className="text-xs sm:text-base font-bold truncate">{value}</p>
        {sub && <p className="text-[10px] sm:text-xs text-muted-foreground truncate">{sub}</p>}
      </div>
    </Comp>
  );
}

export default function DashboardPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [notifLoading, setNotifLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const [actingOn, setActingOn] = useState<string | null>(null);
  const navigate = useNavigate();
  const stockAlertsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    getDashboard({}).then(setData).finally(() => setLoading(false));
    getNotifications().then(res => { setNotifications(res.notifications); setUnreadCount(res.unreadCount); }).catch(() => {}).finally(() => setNotifLoading(false));
  }, []);

  const handleMarkAllRead = async () => {
    await markNotificationsRead({ all: true });
    setNotifications(ns => ns.map(n => ({ ...n, isRead: 1 })));
    setUnreadCount(0);
  };

  const handleReviewProduct = async (n: any) => {
    if (!n.isRead) {
      await markNotificationsRead({ id: n.id });
      setNotifications(ns => ns.map(x => x.id === n.id ? { ...x, isRead: 1 } : x));
      setUnreadCount(c => Math.max(0, c - 1));
    }
    if (n.productId) navigate(`/products?edit=${n.productId}`);
  };

  const handleConfirmStock = async (n: any) => {
    setActingOn(n.id);
    try {
      await confirmStockUpdate({ requestId: n.requestId });
      setNotifications(ns => ns.filter(x => x.id !== n.id));
      setUnreadCount(c => Math.max(0, c - (n.isRead ? 0 : 1)));
      getDashboard({}).then(setData);
    } finally {
      setActingOn(null);
    }
  };

  const handleRejectStock = async (n: any) => {
    setActingOn(n.id);
    try {
      await rejectStockUpdate({ requestId: n.requestId });
      setNotifications(ns => ns.filter(x => x.id !== n.id));
      setUnreadCount(c => Math.max(0, c - (n.isRead ? 0 : 1)));
    } finally {
      setActingOn(null);
    }
  };

  const scrollToStockAlerts = () => stockAlertsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  if (loading || !data) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-lg" />)}
        </div>
      </div>
    );
  }

  const stats = [
    { label: 'Total Sales', value: fmt(data.totalSales), icon: ShoppingCart, color: 'bg-primary/10 text-primary' },
    { label: 'COGS', value: fmt(data.totalCogs), icon: ArrowDown, color: 'bg-muted text-muted-foreground' },
    { label: 'Gross Profit', value: fmt(data.grossProfit), icon: TrendingUp, color: 'bg-primary/10 text-primary' },
    { label: 'Net Profit', value: fmt(data.netProfit), icon: data.netProfit >= 0 ? TrendingUp : TrendingDown, color: data.netProfit >= 0 ? 'bg-primary/10 text-primary' : 'bg-destructive/10 text-destructive' },
    { label: 'Total Expenses', value: fmt(data.totalExpenses), icon: DollarSign, color: 'bg-muted text-muted-foreground' },
    { label: 'Stock Value', value: fmt(data.totalStockValue), icon: Package, color: 'bg-accent text-accent-foreground' },
    { label: 'Today\'s Sales', value: fmt(data.todaySales), icon: ShoppingCart, color: 'bg-primary/10 text-primary' },
    { label: 'This Month', value: fmt(data.monthSales), icon: DollarSign, color: 'bg-primary/10 text-primary', sub: `Profit: ${fmtShort(data.monthProfit)}` },
  ];

  const productStats = [
    { label: 'Products', value: data.totalProducts, icon: Package, color: 'bg-accent text-accent-foreground', onClick: () => navigate('/products') },
    { label: 'Low Stock', value: data.lowStockCount, icon: AlertTriangle, color: 'bg-yellow-100 text-yellow-700', onClick: scrollToStockAlerts },
    { label: 'Out of Stock', value: data.outOfStockCount, icon: XCircle, color: 'bg-destructive/10 text-destructive', onClick: scrollToStockAlerts },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>

      <div className="bg-card border rounded-lg p-4">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <h3 className="font-semibold flex items-center gap-2">
            <Bell className="w-4 h-4 text-primary" />
            Supplier Activity
            {unreadCount > 0 && <span className="text-xs font-bold bg-primary text-primary-foreground rounded-full px-2 py-0.5">{unreadCount} new</span>}
          </h3>
          {unreadCount > 0 && <Button variant="ghost" size="sm" onClick={handleMarkAllRead}>Mark all read</Button>}
        </div>
        {notifLoading ? (
          <Skeleton className="h-10 rounded" />
        ) : notifications.length === 0 ? (
          <p className="text-sm text-muted-foreground py-2">You don't have any new notifications from suppliers right now.</p>
        ) : (
          <div className="space-y-1.5">
            {notifications.slice(0, 8).map(n => {
              if (n.type === 'stock_request') {
                return (
                  <div
                    key={n.id}
                    className={`w-full flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-3 p-2.5 rounded border ${!n.isRead ? 'bg-primary/5 border-primary/20' : 'bg-transparent'}`}
                  >
                    <div className="min-w-0">
                      <p className="text-sm">{n.message}</p>
                      <p className="text-xs text-muted-foreground">{new Date(n.created_at).toLocaleString()}</p>
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                      <Button size="sm" className="flex-1 sm:flex-none" disabled={actingOn === n.id} onClick={() => handleConfirmStock(n)}>
                        {actingOn === n.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <><Check className="w-3.5 h-3.5 mr-1" /> Confirm</>}
                      </Button>
                      <Button size="sm" variant="outline" className="flex-1 sm:flex-none" disabled={actingOn === n.id} onClick={() => handleRejectStock(n)}>
                        <X className="w-3.5 h-3.5 mr-1" /> Reject
                      </Button>
                    </div>
                  </div>
                );
              }
              return (
                <button
                  key={n.id}
                  onClick={() => handleReviewProduct(n)}
                  className={`w-full flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-3 p-2.5 rounded border text-left transition-colors hover:bg-muted/50 ${!n.isRead ? 'bg-primary/5 border-primary/20' : 'bg-transparent'}`}
                >
                  <div className="min-w-0">
                    <p className="text-sm break-words">{n.message}</p>
                    <p className="text-xs text-muted-foreground">{new Date(n.created_at).toLocaleString()}</p>
                  </div>
                  <span className="flex items-center gap-1 text-xs text-primary flex-shrink-0 font-medium self-end sm:self-auto">Review <ArrowRight className="w-3.5 h-3.5" /></span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Financial stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {stats.map(s => <StatCard key={s.label} {...s} />)}
      </div>

      {/* Product stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {productStats.map(s => <StatCard key={s.label} {...s} />)}
      </div>

      {/* Charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Sales over time */}
        {data.salesOverTime.length > 0 && (
          <div className="bg-card border rounded-lg p-4">
            <h3 className="font-semibold mb-4">Sales & Profit (Last 30 Days)</h3>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.salesOverTime}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={v => v.slice(5)} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip formatter={(v: number) => fmt(v)} labelFormatter={l => `Date: ${l}`} contentStyle={{ borderRadius: '8px', border: '1px solid hsl(var(--border))', background: 'hsl(var(--card))' }} />
                  <Area type="monotone" dataKey="revenue" stackId="1" stroke="hsl(var(--chart-1))" fill="hsl(var(--chart-1))" fillOpacity={0.3} name="Revenue" />
                  <Area type="monotone" dataKey="profit" stackId="2" stroke="hsl(var(--chart-2))" fill="hsl(var(--chart-2))" fillOpacity={0.3} name="Profit" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Expenses by category */}
        {data.expensesByCategory.length > 0 && (
          <div className="bg-card border rounded-lg p-4">
            <h3 className="font-semibold mb-4">Expenses by Category</h3>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={data.expensesByCategory} dataKey="amount" nameKey="category" cx="50%" cy="50%" outerRadius={70} label={({ category, percent }) => `${category} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                    {data.expensesByCategory.map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v: number) => fmt(v)} contentStyle={{ borderRadius: '8px', border: '1px solid hsl(var(--border))', background: 'hsl(var(--card))' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Top products */}
        {data.topProducts.length > 0 && (
          <div className="bg-card border rounded-lg p-4">
            <h3 className="font-semibold mb-4">Best Selling Products</h3>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.topProducts} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis type="number" tick={{ fontSize: 10 }} />
                  <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v: number) => fmt(v)} contentStyle={{ borderRadius: '8px', border: '1px solid hsl(var(--border))', background: 'hsl(var(--card))' }} />
                  <Bar dataKey="revenue" fill="hsl(var(--chart-1))" radius={[0, 4, 4, 0]} name="Revenue" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Recent sales */}
        {data.recentSales.length > 0 && (
          <div className="bg-card border rounded-lg p-4">
            <h3 className="font-semibold mb-3">Recent Sales</h3>
            <div className="space-y-2">
              {data.recentSales.map((s: any) => (
                <div key={s.id} className="flex items-center justify-between py-2 border-b last:border-0">
                  <div>
                    <p className="text-sm font-medium">{s.productName}</p>
                    <p className="text-xs text-muted-foreground">{s.date ? new Date(s.date).toLocaleDateString() : '-'} · Qty: {s.quantity}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium">{fmt(s.revenue)}</p>
                    <p className="text-xs text-primary">{fmt(s.profit)} profit</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Stock alerts — Low Stock & Out of Stock */}
      <div ref={stockAlertsRef} className="bg-card border rounded-lg p-4 scroll-mt-4">
        <h3 className="font-semibold mb-3 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-yellow-600" />
          Stock Alerts
        </h3>
        {data.stockAlerts.length === 0 ? (
          <p className="text-sm text-muted-foreground py-2">There are no low or out of stock products at the moment.</p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {data.stockAlerts.map((p: any) => (
              <button
                key={p.id}
                onClick={() => navigate(`/products?edit=${p.id}`)}
                className="flex items-center justify-between gap-2 p-2 rounded border bg-muted/30 hover:bg-muted/60 transition-colors text-left"
              >
                <span className="text-sm font-medium truncate">{p.name}</span>
                <span className="flex items-center gap-2 flex-shrink-0">
                  <span className={`text-sm font-bold ${p.stockFlag === 'Out of Stock' ? 'text-destructive' : 'text-yellow-600'}`}>
                    {p.currentStock} / {p.lowStockThreshold}
                  </span>
                  <Badge variant={p.stockFlag === 'Out of Stock' ? 'destructive' : undefined} className={p.stockFlag !== 'Out of Stock' ? 'bg-yellow-500 hover:bg-yellow-500 text-white' : ''}>
                    {p.stockFlag === 'Out of Stock' ? 'Out' : 'Low'}
                  </Badge>
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}
