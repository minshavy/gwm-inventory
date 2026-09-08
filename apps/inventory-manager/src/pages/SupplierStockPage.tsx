import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { getSupplierSummary } from '@/lib/api-client';
import { Badge } from '@project/components/ui/badge';
import { Skeleton } from '@project/components/ui/skeleton';
import { AlertTriangle, Clock } from 'lucide-react';

export default function SupplierStockPage() {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

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

  const alerts = products.filter(p => p.stockFlag !== 'OK');

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-yellow-600" />
          Stock Alerts
        </h1>
        <p className="text-sm text-muted-foreground">Your products that are low or out of stock.</p>
      </div>

      {loading ? (
        <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-lg" />)}</div>
      ) : alerts.length === 0 ? (
        <div className="border rounded-lg p-8 text-center text-sm text-muted-foreground">
          None of your products are low or out of stock right now. 🎉
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden divide-y">
          {alerts.map(p => (
            <button
              key={p.id}
              onClick={() => navigate(`/?edit=${p.id}`)}
              className="w-full p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-left hover:bg-muted/50 transition-colors"
            >
              <div className="min-w-0">
                <p className="font-medium truncate">{p.name}</p>
                <p className="text-xs text-muted-foreground">{p.category || 'Uncategorized'} · Stock: {p.currentStock} / {p.lowStockThreshold} {p.unit}</p>
                {p.pendingStockRequest && (
                  <p className="text-xs text-amber-600 flex items-center gap-1 mt-1">
                    <Clock className="w-3 h-3" /> Update pending confirmation: {p.pendingStockRequest.previousStock} → {p.pendingStockRequest.requestedStock}
                  </p>
                )}
              </div>
              <Badge variant={p.stockFlag === 'Out of Stock' ? 'destructive' : undefined} className={p.stockFlag !== 'Out of Stock' ? 'bg-amber-500 hover:bg-amber-500 text-white flex-shrink-0 w-fit' : 'flex-shrink-0 w-fit'}>
                {p.stockFlag}
              </Badge>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
