import { useState, useEffect, useCallback } from 'react';
import { getSupplierSummary } from '@/lib/api-client';
import { Skeleton } from '@project/components/ui/skeleton';
import { Wallet, TrendingUp } from 'lucide-react';

const fmt = (n: number) => `MVR ${(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function SupplierEarningsPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await getSupplierSummary({}));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading || !data) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-lg" />)}
        </div>
        <Skeleton className="h-64 rounded-lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold">My Earnings</h1>
        <p className="text-sm text-muted-foreground">Your share is 1/3 of the profit earned on sales of your own products only — it never includes other suppliers' sales.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
      </div>

      <div>
        <h2 className="text-base font-semibold mb-2">Recent sales of your products</h2>
        {data.recentSales.length === 0 ? (
          <div className="border rounded-lg p-8 text-center text-sm text-muted-foreground">No sales yet.</div>
        ) : (
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
        )}
      </div>
    </div>
  );
}
