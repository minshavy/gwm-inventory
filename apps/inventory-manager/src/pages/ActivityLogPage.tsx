import { useState, useEffect, useCallback } from 'react';
import { getActivityLog } from '@/lib/api-client';
import { Skeleton } from '@project/components/ui/skeleton';
import { Badge } from '@project/components/ui/badge';
import { Button } from '@project/components/ui/button';
import { History, RefreshCw } from 'lucide-react';

function timeAgo(iso: string) {
  const then = new Date(iso.replace(' ', 'T') + 'Z').getTime();
  const diffSec = Math.floor((Date.now() - then) / 1000);
  if (diffSec < 60) return 'just now';
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  if (diffSec < 604800) return `${Math.floor(diffSec / 86400)}d ago`;
  return new Date(then).toLocaleDateString();
}

export default function ActivityLogPage() {
  const [entries, setEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getActivityLog();
      setEntries(res.entries || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <History className="w-6 h-6 text-primary" />
            Activity Log
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Who did what, most recent first — the last 200 actions across your admin and supplier logins.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-1.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </Button>
      </div>

      {loading ? (
        <div className="space-y-2">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-14 rounded-lg" />)}</div>
      ) : entries.length === 0 ? (
        <div className="border rounded-lg p-8 text-center text-sm text-muted-foreground">
          Nothing's happened yet — actions like adding a product or recording a sale will show up here.
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden divide-y">
          {entries.map(e => (
            <div key={e.id} className="p-3 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm">
                  <span className="font-medium">{e.actorUsername}</span>{' '}
                  <Badge variant={e.actorRole === 'admin' ? 'secondary' : 'outline'} className="text-[10px] px-1.5 py-0 align-middle">
                    {e.actorRole}
                  </Badge>
                </p>
                <p className="text-sm text-muted-foreground">{e.message}</p>
              </div>
              <span className="text-xs text-muted-foreground flex-shrink-0 whitespace-nowrap">{timeAgo(e.created_at)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
