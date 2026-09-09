import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/lib/auth-shim';
import { Toaster } from '@project/components/ui/sonner';
import Layout from './components/Layout';
import SupplierLayout from './components/SupplierLayout';
import { lazy, Suspense } from 'react';

const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const ProductsPage = lazy(() => import('./pages/ProductsPage'));
const MovementsPage = lazy(() => import('./pages/MovementsPage'));
const SalesPage = lazy(() => import('./pages/SalesPage'));
const ExpensesPage = lazy(() => import('./pages/ExpensesPage'));
const SuppliersPage = lazy(() => import('./pages/SuppliersPage'));
const PayoutsPage = lazy(() => import('./pages/PayoutsPage'));
const ProfitLossPage = lazy(() => import('./pages/ProfitLossPage'));
const ReportsPage = lazy(() => import('./pages/ReportsPage'));
const CategoriesPage = lazy(() => import('./pages/CategoriesPage'));
const ExpenseCategoriesPage = lazy(() => import('./pages/ExpenseCategoriesPage'));
const PaymentMethodsPage = lazy(() => import('./pages/PaymentMethodsPage'));
const HelpPage = lazy(() => import('./pages/HelpPage'));
const LoginPage = lazy(() => import('./pages/LoginPage'));
const SupplierProductsPage = lazy(() => import('./pages/SupplierProductsPage'));
const SupplierStockPage = lazy(() => import('./pages/SupplierStockPage'));
const SupplierEarningsPage = lazy(() => import('./pages/SupplierEarningsPage'));
const SupplierHelpPage = lazy(() => import('./pages/SupplierHelpPage'));

function PageLoader() {
  return (
    <div className="flex items-center justify-center py-20">
      <div className="animate-pulse text-muted-foreground text-sm">Loading...</div>
    </div>
  );
}

function FullPageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="animate-pulse text-muted-foreground font-mono text-sm">Loading...</div>
    </div>
  );
}

function AppRoutes() {
  const { user, isLoading } = useAuth();

  if (isLoading) return <FullPageLoader />;

  if (!user) {
    return (
      <Routes>
        <Route path="/login" element={<Suspense fallback={<PageLoader />}><LoginPage /></Suspense>} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  if (user.role === 'supplier') {
    return (
      <Routes>
        <Route element={<SupplierLayout />}>
          <Route path="/" element={<Suspense fallback={<PageLoader />}><SupplierProductsPage /></Suspense>} />
          <Route path="/stock" element={<Suspense fallback={<PageLoader />}><SupplierStockPage /></Suspense>} />
          <Route path="/earnings" element={<Suspense fallback={<PageLoader />}><SupplierEarningsPage /></Suspense>} />
          <Route path="/help" element={<Suspense fallback={<PageLoader />}><SupplierHelpPage /></Suspense>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={<Navigate to="/" replace />} />
      <Route element={<Layout />}>
        <Route path="/" element={<Suspense fallback={<PageLoader />}><DashboardPage /></Suspense>} />
        <Route path="/products" element={<Suspense fallback={<PageLoader />}><ProductsPage /></Suspense>} />
        <Route path="/stock" element={<Suspense fallback={<PageLoader />}><MovementsPage /></Suspense>} />
        <Route path="/sales" element={<Suspense fallback={<PageLoader />}><SalesPage /></Suspense>} />
        <Route path="/expenses" element={<Suspense fallback={<PageLoader />}><ExpensesPage /></Suspense>} />
        <Route path="/suppliers" element={<Suspense fallback={<PageLoader />}><SuppliersPage /></Suspense>} />
        <Route path="/payouts" element={<Suspense fallback={<PageLoader />}><PayoutsPage /></Suspense>} />
        <Route path="/profit-loss" element={<Suspense fallback={<PageLoader />}><ProfitLossPage /></Suspense>} />
        <Route path="/reports" element={<Suspense fallback={<PageLoader />}><ReportsPage /></Suspense>} />
        <Route path="/categories" element={<Suspense fallback={<PageLoader />}><CategoriesPage /></Suspense>} />
        <Route path="/expense-categories" element={<Suspense fallback={<PageLoader />}><ExpenseCategoriesPage /></Suspense>} />
        <Route path="/payment-methods" element={<Suspense fallback={<PageLoader />}><PaymentMethodsPage /></Suspense>} />
        <Route path="/help" element={<Suspense fallback={<PageLoader />}><HelpPage /></Suspense>} />
        <Route path="/movements" element={<Navigate to="/stock" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Toaster />
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
