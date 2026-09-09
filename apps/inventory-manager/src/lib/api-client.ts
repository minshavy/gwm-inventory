// Thin fetch wrapper for the local Express API — every function here maps
// 1:1 to a /api/* route in server/index.cjs and attaches the login token.

import { getToken } from './auth-shim';

const BASE = '/api';

async function call<TIn, TOut>(name: string, input: TIn): Promise<TOut> {
  const token = getToken();
  const res = await fetch(`${BASE}/${name}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(input ?? {}),
  });
  if (res.status === 401) {
    // Session expired or was never established — bounce to login.
    localStorage.removeItem('gwm_token');
    if (!location.pathname.startsWith('/login')) location.href = '/login';
    throw new Error('Not authenticated');
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request to ${name} failed`);
  }
  return res.json();
}

export const getProducts = (input: any) => call('getProducts', input);
export const saveProduct = (input: any) => call('saveProduct', input);
export const deleteProduct = (input: any) => call('deleteProduct', input);

export const getMovements = (input: any) => call('getMovements', input);
export const recordStockMovement = (input: any) => call('recordStockMovement', input);

export const getSales = (input: any) => call('getSales', input);
export const recordSale = (input: any) => call('recordSale', input);
export const deleteSale = (input: any) => call('deleteSale', input);

export const getExpenses = (input: any) => call('getExpenses', input);
export const saveExpense = (input: any) => call('saveExpense', input);
export const deleteExpense = (input: any) => call('deleteExpense', input);

export const getSuppliers = (input: any) => call('getSuppliers', input);
export const saveSupplier = (input: any) => call('saveSupplier', input);
export const deleteSupplier = (input: any) => call('deleteSupplier', input);

export const getLookups = (input: any) => call('getLookups', input);
export const saveLookup = (input: any) => call('saveLookup', input);
export const deleteLookup = (input: any) => call('deleteLookup', input);

export const getDashboard = (input: any) => call('getDashboard', input);
export const getProfitLoss = (input: any) => call('getProfitLoss', input);
export const exportPdf = (input: any) => call('exportPdf', input);

// ---- Auth / user management ----
export const changePassword = (input: any) => call('auth/changePassword', input);
export const getUsers = (input: any = {}) => call('admin/getUsers', input);
export const createSupplierLogin = (input: any) => call('admin/createSupplierLogin', input);
export const resetPassword = (input: any) => call('admin/resetPassword', input);
export const setUserStatus = (input: any) => call('admin/setUserStatus', input);

// ---- Supplier portal ----
export const getSupplierSummary = (input: any = {}) => call('supplier/summary', input);
export const saveSupplierProduct = (input: any) => call('supplier/saveProduct', input);
export const addSupplierCategory = (input: any) => call('supplier/addCategory', input);

// ---- Notifications (admin) ----
export const getNotifications = (input: any = {}) => call('getNotifications', input);
export const markNotificationsRead = (input: any) => call('markNotificationsRead', input);
export const confirmStockUpdate = (input: any) => call('admin/confirmStockUpdate', input);
export const rejectStockUpdate = (input: any) => call('admin/rejectStockUpdate', input);

// ---- Supplier payouts (admin) ----
export const getSupplierBalances = (input: any = {}) => call('admin/getSupplierBalances', input);
export const getSupplierPayouts = (input: any) => call('admin/getSupplierPayouts', input);
export const recordPayout = (input: any) => call('admin/recordPayout', input);
export const deletePayout = (input: any) => call('admin/deletePayout', input);

export const api = {
  getProducts, saveProduct, deleteProduct,
  getMovements, recordStockMovement,
  getSales, recordSale, deleteSale,
  getExpenses, saveExpense, deleteExpense,
  getSuppliers, saveSupplier, deleteSupplier,
  getLookups, saveLookup, deleteLookup,
  getDashboard, getProfitLoss, exportPdf,
  changePassword, getUsers, createSupplierLogin, resetPassword, setUserStatus,
  getSupplierSummary, saveSupplierProduct, addSupplierCategory,
  getNotifications, markNotificationsRead, confirmStockUpdate, rejectStockUpdate,
  getSupplierBalances, getSupplierPayouts, recordPayout, deletePayout,
};

// Permissive type aliases so `import { GetProductsOutputType } from '@/lib/api-client'`
// style type-only imports in the original page files keep compiling.
export type GetProductsOutputType = any;
export type GetMovementsOutputType = any;
export type DeleteExpenseInputType = any; export type DeleteExpenseOutputType = any;
export type DeleteLookupInputType = any; export type DeleteLookupOutputType = any;
export type DeleteProductInputType = any; export type DeleteProductOutputType = any;
export type DeleteSaleInputType = any; export type DeleteSaleOutputType = any;
export type DeleteSupplierInputType = any; export type DeleteSupplierOutputType = any;
export type GetDashboardInputType = any; export type GetDashboardOutputType = any;
export type GetExpensesInputType = any; export type GetExpensesOutputType = any;
export type GetLookupsInputType = any; export type GetLookupsOutputType = any;
export type GetMovementsInputType = any;
export type GetProductsInputType = any;
export type GetProfitLossInputType = any; export type GetProfitLossOutputType = any;
export type GetSalesInputType = any; export type GetSalesOutputType = any;
export type GetSuppliersInputType = any; export type GetSuppliersOutputType = any;
export type RecordSaleInputType = any; export type RecordSaleOutputType = any;
export type RecordStockMovementInputType = any; export type RecordStockMovementOutputType = any;
export type SaveExpenseInputType = any; export type SaveExpenseOutputType = any;
export type SaveLookupInputType = any; export type SaveLookupOutputType = any;
export type SaveProductInputType = any; export type SaveProductOutputType = any;
export type SaveSupplierInputType = any; export type SaveSupplierOutputType = any;
export type ExportPdfInputType = any; export type ExportPdfOutputType = any;
