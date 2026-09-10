import { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/lib/auth-shim';
import { useTheme } from '@/lib/theme-provider';
import { getSupplierSummary } from '@/lib/api-client';
import { BackToTopButton } from '@/components/BackToTopButton';
import { Button } from '@project/components/ui/button';
import { Package, AlertTriangle, Wallet, LogOut, HelpCircle, Sun, Moon } from 'lucide-react';
import { toast } from 'sonner';

const tabs = [
  { to: '/', label: 'Products', icon: Package, end: true },
  { to: '/stock', label: 'Stock Alerts', icon: AlertTriangle, end: false },
  { to: '/earnings', label: 'My Earnings', icon: Wallet, end: false },
  { to: '/help', label: 'Help', icon: HelpCircle, end: false },
];

export default function SupplierLayout() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();
  const pageTitle = tabs.find(t => (t.end ? location.pathname === t.to : location.pathname.startsWith(t.to)))?.label ?? 'Products';

  const [alertCount, setAlertCount] = useState(0);
  const prevCount = useRef<number | null>(null);

  useEffect(() => {
    const poll = () => {
      getSupplierSummary({}).then(res => {
        const count = (res.products || []).filter((p: any) => p.stockFlag !== 'OK').length;
        setAlertCount(count);
        if (count > 0 && (prevCount.current === null || count > prevCount.current)) {
          toast.warning(
            count === 1 ? 'One of your products is low or out of stock.' : `${count} of your products are low or out of stock.`,
            { description: 'Check the Stock Alerts tab.' }
          );
        }
        prevCount.current = count;
      }).catch(() => {});
    };
    poll();
    const id = setInterval(poll, 20000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b bg-card sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <Package className="w-5 h-5 text-primary flex-shrink-0" />
            <span className="font-semibold text-sm truncate">Supplier Portal</span>
            <span className="text-muted-foreground text-sm hidden sm:inline">/ {pageTitle}</span>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="text-sm text-muted-foreground hidden sm:inline truncate max-w-[140px]">{user?.username}</span>
            <Button variant="ghost" size="icon" onClick={toggleTheme}>
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </Button>
            <Button variant="outline" size="sm" onClick={logout}>Log out</Button>
          </div>
        </div>
        <nav className="max-w-5xl mx-auto px-2 sm:px-6 flex gap-1 border-t sm:border-t-0">
          {tabs.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex-1 sm:flex-none flex items-center justify-center sm:justify-start gap-1.5 px-3 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                  isActive
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`
              }
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              <span className="truncate">{label}</span>
              {to === '/stock' && alertCount > 0 && (
                <span className="text-[10px] font-bold bg-destructive text-destructive-foreground rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                  {alertCount > 9 ? '9+' : alertCount}
                </span>
              )}
            </NavLink>
          ))}
        </nav>
      </header>

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-6">
        <Outlet />
      </main>

      <BackToTopButton />

      <div className="sm:hidden border-t bg-card p-2 flex items-center justify-between">
        <span className="text-xs text-muted-foreground truncate px-1">{user?.username}</span>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={toggleTheme} className="text-muted-foreground">
            {theme === 'dark' ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
          </Button>
          <Button variant="ghost" size="sm" onClick={logout} className="text-muted-foreground">
            <LogOut className="w-3.5 h-3.5 mr-1.5" /> Log out
          </Button>
        </div>
      </div>
    </div>
  );
}
