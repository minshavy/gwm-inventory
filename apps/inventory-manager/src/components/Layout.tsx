import { useState, useEffect } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Package, ArrowLeftRight, ShoppingCart,
  Receipt, TrendingUp, BarChart3, Tags, Tag, Truck, CreditCard,
  Menu, X, ChevronLeft, LogOut,
} from 'lucide-react';
import { cn } from '@project/components/lib/utils';
import { Button } from '@project/components/ui/button';
import { AnimatePresence, motion } from 'framer-motion';
import { useAuth } from '@/lib/auth-shim';
import { getNotifications } from '@/lib/api-client';

const navItems = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/products', label: 'Products', icon: Package },
  { to: '/stock', label: 'Stock', icon: ArrowLeftRight },
  { to: '/sales', label: 'Sales', icon: ShoppingCart },
  { to: '/expenses', label: 'Expenses', icon: Receipt },
  { to: '/profit-loss', label: 'Profit & Loss', icon: TrendingUp },
  { to: '/reports', label: 'Reports', icon: BarChart3 },
  { to: '/categories', label: 'Categories', icon: Tags },
  { to: '/expense-categories', label: 'Expense Categories', icon: Tag },
  { to: '/suppliers', label: 'Suppliers', icon: Truck },
  { to: '/payment-methods', label: 'Payment Methods', icon: CreditCard },
];

function SidebarContent({ onNavigate, unreadCount = 0 }: { onNavigate?: () => void; unreadCount?: number }) {
  const navigate = useNavigate();
  return (
    <div className="flex flex-col h-full">
      <button
        onClick={() => { navigate('/'); onNavigate?.(); }}
        className="flex items-center gap-2 px-4 h-14 border-b text-left hover:bg-muted/50 transition-colors"
      >
        <Package className="w-5 h-5 text-primary flex-shrink-0" />
        <span className="text-base font-semibold tracking-tight">GWM Inventory</span>
      </button>
      <nav className="flex-1 overflow-y-auto py-2 px-2" onWheel={(e) => { e.currentTarget.scrollTop += e.deltaY; }}
        onTouchStart={(e) => { (e.currentTarget as any)._touchY = e.touches[0].clientY; }}
        onTouchMove={(e) => {
          const el = e.currentTarget as any;
          const y = e.touches[0].clientY;
          el.scrollTop += el._touchY - y;
          el._touchY = y;
        }}
        style={{ touchAction: 'pan-y' }}>
        {navItems.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            onClick={onNavigate}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors mb-0.5',
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted'
              )
            }
          >
            <Icon className="w-4 h-4 flex-shrink-0" />
            {label}
            {to === '/' && unreadCount > 0 && (
              <span className="ml-auto text-[10px] font-bold bg-destructive text-destructive-foreground rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}

export default function Layout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  useEffect(() => {
    const poll = () => getNotifications().then(res => setUnreadCount(res.unreadCount)).catch(() => {});
    poll();
    const id = setInterval(poll, 20000);
    return () => clearInterval(id);
  }, [location.pathname]);

  return (
    <div className="min-h-screen bg-background flex">
      {/* Desktop sidebar */}
      <aside
        className={cn(
          'hidden lg:flex flex-col border-r bg-card fixed top-0 left-0 h-screen z-30 transition-all duration-200',
          collapsed ? 'w-16' : 'w-56'
        )}
      >
        {collapsed ? (
          <div className="flex flex-col h-full">
            <button
              onClick={() => navigate('/')}
              className="flex items-center justify-center h-14 border-b hover:bg-muted/50 transition-colors"
              title="GWM Inventory"
            >
              <Package className="w-5 h-5 text-primary" />
            </button>
            <nav className="flex-1 overflow-y-auto py-2 px-2" onWheel={(e) => { e.currentTarget.scrollTop += e.deltaY; }}
        onTouchStart={(e) => { (e.currentTarget as any)._touchY = e.touches[0].clientY; }}
        onTouchMove={(e) => {
          const el = e.currentTarget as any;
          const y = e.touches[0].clientY;
          el.scrollTop += el._touchY - y;
          el._touchY = y;
        }}
        style={{ touchAction: 'pan-y' }}>
              {navItems.map(({ to, label, icon: Icon }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={to === '/'}
                  title={label}
                  className={({ isActive }) =>
                    cn(
                      'relative flex items-center justify-center w-full h-10 rounded-lg transition-colors mb-0.5',
                      isActive
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                    )
                  }
                >
                  <Icon className="w-4 h-4" />
                  {to === '/' && unreadCount > 0 && (
                    <span className="absolute top-1 right-1.5 w-2 h-2 rounded-full bg-destructive" />
                  )}
                </NavLink>
              ))}
            </nav>
            <div className="p-2 border-t">
              <Button variant="ghost" size="icon" className="w-full" onClick={() => setCollapsed(false)}>
                <Menu className="w-4 h-4" />
              </Button>
            </div>
          </div>
        ) : (
          <>
            <SidebarContent unreadCount={unreadCount} />
            <div className="p-2 border-t space-y-1">
              <div className="px-2 py-1 text-xs text-muted-foreground truncate">{user?.username}</div>
              <Button variant="ghost" size="sm" className="w-full justify-start gap-2 text-muted-foreground" onClick={logout}>
                <LogOut className="w-4 h-4" />
                <span className="text-xs">Log out</span>
              </Button>
              <Button variant="ghost" size="sm" className="w-full justify-start gap-2 text-muted-foreground" onClick={() => setCollapsed(true)}>
                <ChevronLeft className="w-4 h-4" />
                <span className="text-xs">Collapse</span>
              </Button>
            </div>
          </>
        )}
      </aside>

      {/* Mobile header */}
      <header className="lg:hidden fixed top-0 left-0 right-0 z-40 bg-card border-b h-14 flex items-center justify-between px-4 gap-3">
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-2 min-w-0"
        >
          <Package className="w-4 h-4 text-primary flex-shrink-0" />
          <span className="font-semibold text-sm truncate">GWM Inventory</span>
        </button>
        <Button variant="ghost" size="icon" onClick={() => setMobileOpen(true)}>
          <Menu className="w-5 h-5" />
        </Button>
      </header>

      {/* Mobile slide-in */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="lg:hidden fixed inset-0 z-50 bg-black/30"
              onClick={() => setMobileOpen(false)}
            />
            <motion.aside
              key="sidebar"
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}
              className="lg:hidden fixed top-0 right-0 bottom-0 z-50 w-64 bg-card/95 backdrop-blur-md border-l"
            >
              <div className="flex items-center justify-between px-4 h-14 border-b">
                <div className="flex items-center gap-2">
                  <Package className="w-5 h-5 text-primary" />
                  <span className="font-semibold text-sm">GWM Inventory</span>
                </div>
                <Button variant="ghost" size="icon" onClick={() => setMobileOpen(false)}>
                  <X className="w-5 h-5" />
                </Button>
              </div>
              <nav className="flex-1 overflow-y-auto py-2 px-2" onWheel={(e) => { e.currentTarget.scrollTop += e.deltaY; }}
        onTouchStart={(e) => { (e.currentTarget as any)._touchY = e.touches[0].clientY; }}
        onTouchMove={(e) => {
          const el = e.currentTarget as any;
          const y = e.touches[0].clientY;
          el.scrollTop += el._touchY - y;
          el._touchY = y;
        }}
        style={{ touchAction: 'pan-y' }}>
                {navItems.map(({ to, label, icon: Icon }) => (
                  <NavLink
                    key={to}
                    to={to}
                    end={to === '/'}
                    onClick={() => setMobileOpen(false)}
                    className={({ isActive }) =>
                      cn(
                        'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors mb-0.5',
                        isActive
                          ? 'bg-primary text-primary-foreground'
                          : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                      )
                    }
                  >
                    <Icon className="w-4 h-4 flex-shrink-0" />
                    {label}
                    {to === '/' && unreadCount > 0 && (
                      <span className="ml-auto text-[10px] font-bold bg-destructive text-destructive-foreground rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                        {unreadCount > 9 ? '9+' : unreadCount}
                      </span>
                    )}
                  </NavLink>
                ))}
              </nav>
              <div className="p-2 border-t">
                <div className="px-2 py-1 text-xs text-muted-foreground truncate">{user?.username}</div>
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
      <main
        className={cn(
          'flex-1 min-h-screen transition-all duration-200',
          'pt-14 lg:pt-0',
          collapsed ? 'lg:ml-16' : 'lg:ml-56'
        )}
      >
        <div className="p-4 sm:p-6 max-w-7xl mx-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
