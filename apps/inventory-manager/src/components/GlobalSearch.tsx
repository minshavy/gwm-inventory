import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { globalSearch } from '@/lib/api-client';
import { Input } from '@project/components/ui/input';
import { Search, Package, Truck, Receipt, ShoppingCart, Loader2 } from 'lucide-react';

const fmt = (n: number) => `MVR ${(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

interface Results {
  products: any[];
  suppliers: any[];
  expenses: any[];
  sales: any[];
}

const EMPTY: Results = { products: [], suppliers: [], expenses: [], sales: [] };

export function GlobalSearch({ onNavigate, autoFocus }: { onNavigate?: () => void; autoFocus?: boolean }) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Results>(EMPTY);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) { setResults(EMPTY); setLoading(false); return; }
    setLoading(true);
    const handle = setTimeout(() => {
      globalSearch({ query: q }).then(res => { setResults(res); setLoading(false); }).catch(() => setLoading(false));
    }, 250);
    return () => clearTimeout(handle);
  }, [query]);

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  const go = (path: string) => {
    navigate(path);
    setQuery('');
    setResults(EMPTY);
    setOpen(false);
    onNavigate?.();
  };

  const hasResults = results.products.length || results.suppliers.length || results.expenses.length || results.sales.length;
  const showDropdown = open && query.trim().length >= 2;

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
        <Input
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder="Search products, sales, suppliers..."
          autoFocus={autoFocus}
          className="pl-8 h-9 text-sm"
        />
      </div>

      {showDropdown && (
        <div
          className="absolute z-50 mt-1 left-0 w-80 max-w-[85vw] bg-popover border rounded-lg shadow-lg max-h-96 overflow-y-auto"
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
          {loading ? (
            <div className="p-4 flex items-center justify-center text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
            </div>
          ) : !hasResults ? (
            <p className="p-4 text-sm text-muted-foreground text-center">No results for "{query}"</p>
          ) : (
            <div className="py-1.5">
              {results.products.length > 0 && (
                <div>
                  <p className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Products</p>
                  {results.products.map((p: any) => (
                    <button key={p.id} onClick={() => go(`/products?edit=${p.id}`)} className="w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-muted/60 transition-colors">
                      <Package className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                      <span className="min-w-0 flex-1">
                        <span className="text-sm block truncate">{p.name}</span>
                        <span className="text-xs text-muted-foreground block truncate">{p.sku} · Stock: {p.currentStock ?? 0}</span>
                      </span>
                    </button>
                  ))}
                </div>
              )}
              {results.suppliers.length > 0 && (
                <div>
                  <p className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Suppliers</p>
                  {results.suppliers.map((s: any) => (
                    <button key={s.id} onClick={() => go('/suppliers')} className="w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-muted/60 transition-colors">
                      <Truck className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                      <span className="min-w-0 flex-1">
                        <span className="text-sm block truncate">{s.name}</span>
                        {(s.phone || s.email) && <span className="text-xs text-muted-foreground block truncate">{s.phone || s.email}</span>}
                      </span>
                    </button>
                  ))}
                </div>
              )}
              {results.expenses.length > 0 && (
                <div>
                  <p className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Expenses</p>
                  {results.expenses.map((e: any) => (
                    <button key={e.id} onClick={() => go('/expenses')} className="w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-muted/60 transition-colors">
                      <Receipt className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                      <span className="min-w-0 flex-1">
                        <span className="text-sm block truncate">{e.description}</span>
                        <span className="text-xs text-muted-foreground block truncate">{fmt(e.amount)} · {e.date}</span>
                      </span>
                    </button>
                  ))}
                </div>
              )}
              {results.sales.length > 0 && (
                <div>
                  <p className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Sales</p>
                  {results.sales.map((s: any) => (
                    <button key={s.id} onClick={() => go('/sales')} className="w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-muted/60 transition-colors">
                      <ShoppingCart className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                      <span className="min-w-0 flex-1">
                        <span className="text-sm block truncate">{s.productName || 'Sale'}</span>
                        <span className="text-xs text-muted-foreground block truncate">{fmt(s.revenue)} · {s.date}</span>
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
