import { useEffect, useState, useCallback } from 'react';
import { getMovements, GetMovementsOutputType } from '@/lib/api-client';
import { Badge } from '@project/components/ui/badge';
import { Button } from '@project/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@project/components/ui/select';
import { Skeleton } from '@project/components/ui/skeleton';
import { ArrowLeftRight } from 'lucide-react';
import { format } from 'date-fns';

type Movement = GetMovementsOutputType['movements'][0];

const fmt = (n: number) => `MVR ${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function MovementsPage() {
  const [movements, setMovements] = useState<Movement[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState('');
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 25;

  const fetchMovements = useCallback(async (type: string, pg: number) => {
    setLoading(true);
    try {
      const res = await getMovements({ type: type || undefined, offset: pg * PAGE_SIZE, limit: PAGE_SIZE });
      setMovements(res.movements);
      setTotal(res.total);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchMovements(typeFilter, page); }, [page]);

  const handleTypeChange = (v: string) => {
    const val = v === 'all' ? '' : v;
    setTypeFilter(val);
    setPage(0);
    fetchMovements(val, 0);
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const badgeVariant = (type: string) => {
    if (type === 'Stock In' || type === 'Stock Returned') return 'default' as const;
    if (type === 'Stock Out') return 'destructive' as const;
    return 'secondary' as const;
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Stock Movements</h2>
          {!loading && <p className="text-sm text-muted-foreground mt-0.5">{total} movement{total !== 1 ? 's' : ''} recorded</p>}
        </div>
        <Select value={typeFilter || 'all'} onValueChange={handleTypeChange}>
          <SelectTrigger className="w-full sm:w-44"><SelectValue placeholder="All Types" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="Stock In">Stock In</SelectItem>
            <SelectItem value="Stock Out">Stock Out</SelectItem>
            <SelectItem value="Stock Returned">Stock Returned</SelectItem>
            <SelectItem value="Adjustment">Adjustment</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-20 w-full rounded-lg" />)}
        </div>
      ) : movements.length === 0 ? (
        <div className="border rounded bg-card flex flex-col items-center justify-center py-16">
          <div className="p-3 rounded-full bg-muted mb-3"><ArrowLeftRight className="w-6 h-6 text-muted-foreground" /></div>
          <p className="text-base font-medium">No stock movements yet</p>
          <p className="text-sm text-muted-foreground mt-1">Record your first stock movement from the Products page.</p>
        </div>
      ) : (
        <>
          {/* Mobile cards */}
          <div className="md:hidden space-y-2">
            {movements.map((m: any) => (
              <div key={m.id} className="bg-card border rounded-lg p-3 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-sm truncate flex-1">{m.productName}</span>
                  <Badge variant={badgeVariant(m.type)} className="ml-2">{m.type}</Badge>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Qty: <span className="font-semibold text-foreground">{m.quantity}</span></span>
                  {m.purchasePrice != null && <span className="text-muted-foreground text-xs">{fmt(m.purchasePrice)}</span>}
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>#{m.reference}</span>
                  <span>{m.date ? format(new Date(m.date), 'MMM d, yyyy') : '—'}</span>
                </div>
                {(m.supplierName || m.invoiceReference) && (
                  <div className="text-xs text-muted-foreground">
                    {m.supplierName && <span>Supplier: {m.supplierName}</span>}
                    {m.invoiceReference && <span>{m.supplierName ? ' · ' : ''}Inv: {m.invoiceReference}</span>}
                  </div>
                )}
                {m.notes && <p className="text-xs text-muted-foreground truncate">{m.notes}</p>}
              </div>
            ))}
          </div>

          {/* Desktop table */}
          <div className="border rounded overflow-hidden bg-card hidden md:block">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left px-4 py-2.5 font-medium w-[72px]">Ref #</th>
                    <th className="text-left px-4 py-2.5 font-medium">Product</th>
                    <th className="text-left px-4 py-2.5 font-medium w-[120px]">Type</th>
                    <th className="text-right px-4 py-2.5 font-medium w-[72px]">Qty</th>
                    <th className="text-right px-4 py-2.5 font-medium">Price</th>
                    <th className="text-left px-4 py-2.5 font-medium hidden lg:table-cell">Supplier</th>
                    <th className="text-left px-4 py-2.5 font-medium hidden lg:table-cell">Invoice</th>
                    <th className="text-left px-4 py-2.5 font-medium hidden lg:table-cell">Notes</th>
                    <th className="text-right px-4 py-2.5 font-medium w-[150px]">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {movements.map((m: any) => (
                    <tr key={m.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">#{m.reference}</td>
                      <td className="px-4 py-3 font-medium">{m.productName}</td>
                      <td className="px-4 py-3">
                        <Badge variant={badgeVariant(m.type)} className="w-[100px] justify-center">{m.type}</Badge>
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-semibold tabular-nums">{m.quantity}</td>
                      <td className="px-4 py-3 text-right font-mono text-xs">
                        {m.purchasePrice != null ? fmt(m.purchasePrice) : '—'}
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell text-muted-foreground">{m.supplierName || '—'}</td>
                      <td className="px-4 py-3 hidden lg:table-cell font-mono text-xs text-muted-foreground">{m.invoiceReference || '—'}</td>
                      <td className="px-4 py-3 text-muted-foreground truncate max-w-[200px] hidden lg:table-cell">{m.notes || '—'}</td>
                      <td className="px-4 py-3 text-right text-muted-foreground text-xs tabular-nums">
                        {m.date ? format(new Date(m.date), 'MMM d, yyyy h:mm a') : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground tabular-nums">
                Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} of {total}
              </span>
              <div className="flex gap-1">
                <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>Previous</Button>
                <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>Next</Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
