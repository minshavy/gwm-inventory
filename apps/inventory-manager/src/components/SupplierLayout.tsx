import { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useAuth } from '@/lib/auth-shim';
import { useTheme } from '@/lib/theme-provider';
import { getSupplierSummary } from '@/lib/api-client';
import { BackToTopButton } from '@/components/BackToTopButton';
import { Button } from '@project/components/ui/button';
import { cn } from '@project/components/lib/utils';
import { Package, AlertTriangle, Wallet, LogOut, HelpCircle, Sun, Moon, Menu, X } from 'lucide-react';
import { toast } from 'sonner';

const navItems = [
  { to: '/', label: 'Products', icon: Package, end: true },
  { to: '/stock', label: 'Stock Alerts', icon: AlertTriangle, end: false },
  { to: '/earnings', label: 'My Earnings', icon: Wallet, end: false },
  { to: '/help', label: 'Help & Guide', icon: HelpCircle, end: false },
];

function NavList({ badges, onNavigate }: { badges: Record<string, number>; onNavigate?: () => void }) {
  return (
    <nav
      className="flex-1 overflow-y-auto py-2 px-2"
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
      {navItems.map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          onClick={onNavigate}
          className={({ isActive }) =>
            cn(
              'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors mb-0.5',
              isActive ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-muted'
            )
          }
        >
          <Icon className="w-4 h-4 flex-shrink-0" />
          <span className="truncate">{label}</span>
          {!!badges[to] && (
            <span className="ml-auto text-[10px] font-bold bg-destructive text-destructive-foreground rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
              {badges[to] > 9 ? '9+' : badges[to]}
            </span>
          )}
        </NavLink>
      ))}
    </nav>
  );
}

export default function SupplierLayout() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const [alertCount, setAlertCount] = useState(0);
  const [pendingCount, setPendingCount] = useState(0);
  const [owedBadge, setOwedBadge] = useState(0);
  const prevCount = useRef<number | null>(null);
  const prevOwed = useRef<number | null>(null);

  useEffect(() => {
    const poll = () => {
      getSupplierSummary({}).then(res => {
        const products = res.products || [];
        const count = products.filter((p: any) => p.stockFlag !== 'OK').length;
        setAlertCount(count);
        setPendingCount(products.filter((p: any) => p.pendingStockRequest).length);
        if (count > 0 && (prevCount.current === null || count > prevCount.current)) {
          toast.warning(
            count === 1 ? 'One of your products is low or out of stock.' : `${count} of your products are low or out of stock.`,
            { description: 'Check the Stock Alerts tab.' }
          );
        }
        prevCount.current = count;

        const owed = res.balance > 0.005 ? 1 : 0;
        setOwedBadge(owed);
        if (owed && prevOwed.current === 0) {
          toast.success("You're owed a payout.", { description: 'Check the My Earnings tab.' });
        }
        prevOwed.current = owed;
      }).catch(() => {});
    };
    poll();
    const id = setInterval(poll, 20000);
    return () => clearInterval(id);
  }, []);

  const badges = { '/stock': alertCount, '/': pendingCount, '/earnings': owedBadge };

  return (
    <div className="min-h-screen bg-background flex">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex flex-col border-r bg-card fixed top-0 left-0 h-screen w-56 z-30">
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-2 px-4 h-14 border-b text-left hover:bg-muted/50 transition-colors flex-shrink-0"
        >
          <Package className="w-5 h-5 text-primary flex-shrink-0" />
          <span className="text-base font-semibold tracking-tight">GWM Inventory</span>
        </button>
        <NavList badges={badges} />
        <div className="p-2 border-t space-y-1 flex-shrink-0">
          <div className="px-2 py-1 text-xs text-muted-foreground truncate">{user?.username}</div>
          <Button variant="ghost" size="sm" className="w-full justify-start gap-2 text-muted-foreground" onClick={toggleTheme}>
            {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            <span className="text-xs">{theme === 'dark' ? 'Light mode' : 'Dark mode'}</span>
          </Button>
          <Button variant="ghost" size="sm" className="w-full justify-start gap-2 text-muted-foreground" onClick={logout}>
            <LogOut className="w-4 h-4" />
            <span className="text-xs">Log out</span>
          </Button>
        </div>
      </aside>

      {/* Mobile header */}
      <header className="lg:hidden fixed top-0 left-0 right-0 z-40 bg-card border-b h-14 flex items-center justify-between px-4 gap-3">
        <button onClick={() => navigate('/')} className="flex items-center gap-2 min-w-0">
          <Package className="w-4 h-4 text-primary flex-shrink-0" />
          <span className="font-semibold text-sm truncate">GWM Inventory</span>
        </button>
        <div className="flex items-center gap-1 flex-shrink-0">
          <Button variant="ghost" size="icon" onClick={toggleTheme}>
            {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </Button>
          <Button variant="ghost" size="icon" className="relative" onClick={() => setMobileOpen(true)}>
            <Menu className="w-5 h-5" />
            {Object.values(badges).some(v => v > 0) && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-destructive" />
            )}
          </Button>
        </div>
      </header>

      {/* Mobile slide-in drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              key="overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="lg:hidden fixed inset-0 bg-black/40 z-40"
              onClick={() => setMobileOpen(false)}
            />
            <motion.aside
              key="sidebar"
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}
              className="lg:hidden fixed top-0 right-0 bottom-0 z-50 w-64 bg-card/95 backdrop-blur-md border-l flex flex-col"
            >
              <div className="flex items-center justify-between px-4 h-14 border-b flex-shrink-0">
                <div className="flex items-center gap-2">
                  <Package className="w-5 h-5 text-primary" />
                  <span className="font-semibold text-sm">GWM Inventory</span>
                </div>
                <Button variant="ghost" size="icon" onClick={() => setMobileOpen(false)}>
                  <X className="w-5 h-5" />
                </Button>
              </div>
              <NavList badges={badges} onNavigate={() => setMobileOpen(false)} />
              <div className="p-2 border-t space-y-1 flex-shrink-0">
                <div className="px-2 py-1 text-xs text-muted-foreground truncate">{user?.username}</div>
                <Button variant="ghost" size="sm" className="w-full justify-start gap-2 text-muted-foreground" onClick={toggleTheme}>
                  {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                  <span className="text-xs">{theme === 'dark' ? 'Light mode' : 'Dark mode'}</span>
                </Button>
                <Button variant="ghost" size="sm" className="w-full justify-start gap-2 text-muted-foreground" onClick={logout}>
                  <LogOut className="w-4 h-4" />
                  <span className="text-xs">Log out</span>
                </Button>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Main content */}
      <main className="flex-1 min-h-screen pt-14 lg:pt-0 lg:ml-56">
        <div className="p-4 sm:p-6 max-w-5xl mx-auto">
          <Outlet />
        </div>
      </main>

      <BackToTopButton />
    </div>
  );
}
