import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/lib/auth-shim';
import { Button } from '@project/components/ui/button';
import { Package, AlertTriangle, Wallet, LogOut } from 'lucide-react';

const tabs = [
  { to: '/', label: 'Products', icon: Package, end: true },
  { to: '/stock', label: 'Stock Alerts', icon: AlertTriangle, end: false },
  { to: '/earnings', label: 'My Earnings', icon: Wallet, end: false },
];

export default function SupplierLayout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const pageTitle = tabs.find(t => (t.end ? location.pathname === t.to : location.pathname.startsWith(t.to)))?.label ?? 'Products';

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b bg-card sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <Package className="w-5 h-5 text-primary flex-shrink-0" />
            <span className="font-semibold text-sm truncate">Supplier Portal</span>
            <span className="text-muted-foreground text-sm hidden sm:inline">/ {pageTitle}</span>
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            <span className="text-sm text-muted-foreground hidden sm:inline truncate max-w-[140px]">{user?.username}</span>
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
            </NavLink>
          ))}
        </nav>
      </header>

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-6">
        <Outlet />
      </main>

      <div className="sm:hidden border-t bg-card p-2 flex items-center justify-between">
        <span className="text-xs text-muted-foreground truncate px-1">{user?.username}</span>
        <Button variant="ghost" size="sm" onClick={logout} className="text-muted-foreground">
          <LogOut className="w-3.5 h-3.5 mr-1.5" /> Log out
        </Button>
      </div>
    </div>
  );
}
