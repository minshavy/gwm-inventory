import { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getProducts, GetProductsOutputType, deleteProduct, getLookups, bulkImportProducts, findProductByCode, generateMissingBarcodes } from '@/lib/api-client';
import { PrintLabelsDialog } from '@/components/PrintLabelsDialog';
import { BarcodeScannerDialog, ScanButton } from '@/components/BarcodeScanner';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { Badge } from '@project/components/ui/badge';
import { Skeleton } from '@project/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@project/components/ui/select';
import { Plus, Search, Trash2, Package, Upload, Printer, Wand2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useDebouncedCallback } from 'use-debounce';
import ProductDialog from '../components/ProductDialog';
import StockMovementDialog from '../components/StockMovementDialog';
import { BulkImportDialog } from '@/components/BulkImportDialog';
import { undoableDelete } from '@/lib/undoable-delete';

type Product = GetProductsOutputType['products'][0];

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [stockProduct, setStockProduct] = useState<Product | null>(null);
  const [categoryOptions, setCategoryOptions] = useState<{ id: string; name: string }[]>([]);
  const [searchParams, setSearchParams] = useSearchParams();
  const [scannerOpen, setScannerOpen] = useState(false);
  const [newBarcode, setNewBarcode] = useState<string | undefined>();
  const [missingBarcodes, setMissingBarcodes] = useState(0);
  const [generatingAll, setGeneratingAll] = useState(false);
  const [labelsOpen, setLabelsOpen] = useState(false);
  const PAGE_SIZE = 20;

  useEffect(() => {
    getLookups({ type: 'categories' }).then(res => setCategoryOptions(res.items)).catch(() => {});
  }, []);

  // Deep link from a Dashboard notification: /products?edit=<id> opens that
  // product's edit dialog directly so the admin can set its selling price.
  useEffect(() => {
    const editId = searchParams.get('edit');
    if (!editId) return;
    getProducts({ id: editId, limit: 1 }).then(res => {
      if (res.products?.[0]) setEditProduct(res.products[0]);
    }).finally(() => {
      searchParams.delete('edit');
      setSearchParams(searchParams, { replace: true });
    });
  }, []);

  const fetchProducts = useCallback(async (s: string, cat: string, pg: number) => {
    setLoading(true);
    try {
      const res = await getProducts({
        search: s || undefined,
        category: cat || undefined,
        offset: pg * PAGE_SIZE,
        limit: PAGE_SIZE,
      });
      setProducts(res.products);
      setTotal(res.total);
      setMissingBarcodes(res.missingBarcodes ?? 0);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchProducts(search, category, page); }, [page]);

  const debouncedSearch = useDebouncedCallback((s: string) => {
    setPage(0);
    fetchProducts(s, category, 0);
  }, 300);

  const handleSearchChange = (v: string) => { setSearch(v); debouncedSearch(v); };

  const handleCategoryChange = (v: string) => {
    const val = v === 'all' ? '' : v;
    setCategory(val);
    setPage(0);
    fetchProducts(search, val, 0);
  };

  // Stock check by scan: shows the product's stock straight away and filters
  // the list to it. Unknown code: offer to create the product with it.
  const handleScan = async (code: string) => {
    try {
      const { product } = await findProductByCode({ code });
      if (!product) {
        toast.error(`No product has barcode or SKU "${code}"`, {
          action: { label: 'Add product', onClick: () => { setNewBarcode(code); setShowAdd(true); } },
          duration: 8000,
        });
        return;
      }
      setSearch(code);
      setPage(0);
      fetchProducts(code, '', 0);
      setCategory('');
      const low = product.currentStock > 0 && product.currentStock <= product.lowStockThreshold;
      const msg = `${product.name}: ${product.currentStock} ${product.unit || 'Piece'}${product.currentStock === 1 ? '' : 's'} in stock`;
      const opts = { action: { label: 'Adjust stock', onClick: () => setStockProduct(product) }, duration: 8000 };
      if (product.currentStock <= 0) toast.error(`${product.name} is out of stock`, opts);
      else if (low) toast.warning(`${msg} (low)`, opts);
      else toast.success(msg, opts);
    } catch (e: any) {
      toast.error(e.message || 'Lookup failed');
    }
  };

  const handleGenerateAll = async () => {
    setGeneratingAll(true);
    try {
      const { count } = await generateMissingBarcodes();
      toast.success(`Generated barcodes for ${count} product${count === 1 ? '' : 's'}`, {
        description: 'Tap "Print labels" to print stickers for them.',
      });
      fetchProducts(search, category, page);
    } catch (e: any) {
      toast.error(e.message || 'Failed to generate barcodes');
    } finally {
      setGeneratingAll(false);
    }
  };

  // Labels for every product matching the current search and category.
  const loadLabelItems = async () => {
    const res: any = await getProducts({ search: search || undefined, category: category || undefined, limit: 2000 });
    return res.products.map((p: any) => ({ name: p.name, barcode: p.barcode, price: p.sellingPrice }));
  };

  const handleSaved = () => {
    setNewBarcode(undefined);
    setShowAdd(false);
    setEditProduct(null);
    fetchProducts(search, category, page);
    getLookups({ type: 'categories' }).then(res => setCategoryOptions(res.items)).catch(() => {});
  };

  const handleDelete = (p: Product) => {
    const snapshot = products;
    undoableDelete({
      itemLabel: p.name,
      onRemoveLocally: () => setProducts(prev => prev.filter(x => x.id !== p.id)),
      onRestoreLocally: () => setProducts(snapshot),
      onConfirmDelete: () => deleteProduct({ id: p.id }),
    });
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Products</h2>
          {!loading && <p className="text-sm text-muted-foreground mt-0.5">{total} product{total !== 1 ? 's' : ''} total</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setLabelsOpen(true)} disabled={total === 0}>
            <Printer className="w-4 h-4 mr-1.5" /> Print labels
          </Button>
          <Button variant="outline" onClick={() => setShowBulkImport(true)}>
            <Upload className="w-4 h-4 mr-1.5" /> Bulk Import
          </Button>
          <Button onClick={() => setShowAdd(true)}>
            <Plus className="w-4 h-4 mr-1.5" /> Add Product
          </Button>
        </div>
      </div>

      {missingBarcodes > 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-lg border border-dashed p-3 text-sm">
          <span>
            <span className="font-medium">{missingBarcodes} product{missingBarcodes === 1 ? '' : 's'}</span> {missingBarcodes === 1 ? 'has' : 'have'} no barcode yet.
            <span className="text-muted-foreground"> New products get one automatically.</span>
          </span>
          <Button size="sm" variant="outline" onClick={handleGenerateAll} disabled={generatingAll}>
            {generatingAll ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5 mr-1.5" />}
            Generate barcodes
          </Button>
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search by name, SKU, barcode, or brand..." value={search} onChange={e => handleSearchChange(e.target.value)} className="pl-9" />
        </div>
        <ScanButton onClick={() => setScannerOpen(true)} label="Scan barcode to check stock" className="hidden sm:inline-flex" />
        <Button variant="outline" className="sm:hidden" onClick={() => setScannerOpen(true)}>Scan barcode to check stock</Button>
        <Select value={category || 'all'} onValueChange={handleCategoryChange}>
          <SelectTrigger className="w-full sm:w-44"><SelectValue placeholder="Category" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {categoryOptions.map(c => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="border rounded overflow-hidden bg-card">
          <div className="border-b bg-muted/50 h-10" />
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="border-b last:border-0 px-4 py-3"><Skeleton className="h-5 w-full rounded" /></div>
          ))}
        </div>
      ) : products.length === 0 ? (
        <div className="border rounded bg-card flex flex-col items-center justify-center py-16">
          <div className="p-3 rounded-full bg-muted mb-3"><Package className="w-6 h-6 text-muted-foreground" /></div>
          <p className="text-base font-medium">No products found</p>
          <p className="text-sm text-muted-foreground mt-1">Try adjusting your search or add a new product.</p>
        </div>
      ) : (
        <>
          <div className="border rounded overflow-hidden bg-card">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left px-4 py-2.5 font-medium">Product</th>
                    <th className="text-left px-4 py-2.5 font-medium hidden sm:table-cell">SKU</th>
                    <th className="text-left px-4 py-2.5 font-medium hidden md:table-cell">Category</th>
                    <th className="text-right px-4 py-2.5 font-medium hidden sm:table-cell">Cost</th>
                    <th className="text-right px-4 py-2.5 font-medium hidden sm:table-cell">Selling</th>
                    <th className="text-right px-4 py-2.5 font-medium">Stock</th>
                    <th className="text-left px-4 py-2.5 font-medium hidden lg:table-cell">Status</th>
                    <th className="text-right px-4 py-2.5 font-medium w-[120px]">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((p: any) => {
                    const isLow = p.currentStock <= p.lowStockThreshold && p.currentStock > 0;
                    const isOut = p.currentStock <= 0;
                    return (
                      <tr key={p.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3">
                          <button onClick={() => setEditProduct(p)} className="font-medium hover:underline text-left">
                            {p.name}
                          </button>
                          {p.brand && <span className="text-xs text-muted-foreground ml-1.5">{p.brand}</span>}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-muted-foreground hidden sm:table-cell">{p.sku || '—'}</td>
                        <td className="px-4 py-3 hidden md:table-cell">
                          {p.category ? <Badge variant="outline">{p.category}</Badge> : <span className="text-muted-foreground">—</span>}
                        </td>
                        <td className="px-4 py-3 text-right font-mono tabular-nums text-muted-foreground hidden sm:table-cell">MVR {(p.costPrice ?? 0).toFixed(2)}</td>
                        <td className="px-4 py-3 text-right font-mono tabular-nums hidden sm:table-cell">
                          {p.sellingPrice ? `MVR ${p.sellingPrice.toFixed(2)}` : (
                            <button onClick={() => setEditProduct(p)} className="text-xs font-sans font-semibold text-destructive underline underline-offset-2">Set price</button>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className={`font-mono font-semibold tabular-nums ${isOut ? 'text-destructive' : isLow ? 'text-destructive/70' : ''}`}>
                            {p.currentStock}
                          </span>
                        </td>
                        <td className="px-4 py-3 hidden lg:table-cell">
                          {!p.sellingPrice ? (
                            <Badge variant="outline" className="w-[90px] justify-center border-destructive/50 text-destructive">Needs Price</Badge>
                          ) : (
                            <Badge variant={p.status === 'Active' ? 'default' : p.status === 'Out of Stock' ? 'destructive' : 'secondary'} className="w-[90px] justify-center">
                              {p.status}
                            </Badge>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button size="sm" variant="outline" onClick={() => setStockProduct(p)} className="h-8">Stock</Button>
                            <Button size="sm" variant="ghost" onClick={() => handleDelete(p)} className="h-8 w-8 p-0"><Trash2 className="w-4 h-4 text-destructive" /></Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
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

      <ProductDialog
        open={showAdd || !!editProduct}
        onClose={() => { setShowAdd(false); setEditProduct(null); setNewBarcode(undefined); }}
        product={editProduct as any}
        onSaved={handleSaved}
        initialBarcode={newBarcode}
      />

      <PrintLabelsDialog
        open={labelsOpen}
        onOpenChange={setLabelsOpen}
        count={total}
        title={search || category ? 'Print labels for these products' : 'Print labels for all products'}
        items={loadLabelItems}
      />

      <BarcodeScannerDialog
        open={scannerOpen}
        onOpenChange={setScannerOpen}
        onDetected={handleScan}
        title="Scan to check stock"
      />

      <BulkImportDialog
        open={showBulkImport}
        onClose={() => setShowBulkImport(false)}
        title="Bulk import products"
        headers={['name', 'sku', 'barcode', 'category', 'brand', 'unit', 'description', 'costPrice', 'sellingPrice', 'currentStock', 'lowStockThreshold', 'supplierName']}
        sampleRow={{
          name: 'Sample Perfume 50ml', sku: '', barcode: '', category: 'Perfumes', brand: 'Sample Brand', unit: 'Piece',
          description: 'Optional description', costPrice: '150', sellingPrice: '250', currentStock: '20', lowStockThreshold: '5', supplierName: '',
        }}
        templateFilename="gwm-products-template.csv"
        onImport={rows => bulkImportProducts({ rows })}
        onDone={handleSaved}
      />

      <StockMovementDialog
        open={!!stockProduct}
        onClose={() => setStockProduct(null)}
        product={stockProduct as any}
        onSaved={handleSaved}
      />
    </div>
  );
}
