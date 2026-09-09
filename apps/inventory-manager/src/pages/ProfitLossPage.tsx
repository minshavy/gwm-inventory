import { useState, useEffect, useCallback } from 'react';
import { getProfitLoss, exportPdf } from '@/lib/api-client';
import { Button } from '@project/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@project/components/ui/select';
import { Skeleton } from '@project/components/ui/skeleton';
import { TrendingUp, TrendingDown, DollarSign, ArrowDown, Minus, FileText, Loader2 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell } from 'recharts';
import { toast } from 'sonner';
import { BackToTopButton } from '@/components/BackToTopButton';

const fmt = (n: number) => `MVR ${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const COLORS = ['hsl(var(--chart-1))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))'];

const MONTHS = [
  { value: '01', label: 'January' }, { value: '02', label: 'February' }, { value: '03', label: 'March' },
  { value: '04', label: 'April' }, { value: '05', label: 'May' }, { value: '06', label: 'June' },
  { value: '07', label: 'July' }, { value: '08', label: 'August' }, { value: '09', label: 'September' },
  { value: '10', label: 'October' }, { value: '11', label: 'November' }, { value: '12', label: 'December' },
];

function getYearOptions() {
  const currentYear = new Date().getFullYear();
  const years: string[] = [];
  for (let y = currentYear; y >= currentYear - 5; y--) years.push(String(y));
  return years;
}

export default function ProfitLossPage() {
  const now = new Date();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState(String(now.getFullYear()));
  const [selectedMonth, setSelectedMonth] = useState(String(now.getMonth() + 1).padStart(2, '0'));
  const isYearly = selectedMonth === 'all';
  const [exporting, setExporting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const y = Number(selectedYear);
      let dateFrom: string;
      let dateTo: string;
      if (isYearly) {
        dateFrom = `${y}-01-01`;
        dateTo = `${y}-12-31`;
      } else {
        const m = Number(selectedMonth);
        dateFrom = `${y}-${selectedMonth}-01`;
        const lastDay = new Date(y, m, 0).getDate();
        dateTo = `${y}-${selectedMonth}-${String(lastDay).padStart(2, '0')}`;
      }
      const res = await getProfitLoss({ dateFrom, dateTo });
      setData(res);
    } finally {
      setLoading(false);
    }
  }, [selectedYear, selectedMonth, isYearly]);

  useEffect(() => { load(); }, [load]);

  if (loading || !data) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Profit & Loss</h1>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-lg" />)}
        </div>
      </div>
    );
  }

  const pnlSteps = [
    { label: 'Revenue (Sales)', value: data.revenue, icon: DollarSign, positive: true },
    { label: 'Cost of Goods Sold', value: data.cogs, icon: ArrowDown, positive: false },
    { label: 'Gross Profit', value: data.grossProfit, icon: data.grossProfit >= 0 ? TrendingUp : TrendingDown, highlight: true },
    { label: 'Operating Expenses', value: data.totalExpenses, icon: ArrowDown, positive: false },
    { label: 'Net Profit', value: data.netProfit, icon: data.netProfit >= 0 ? TrendingUp : TrendingDown, highlight: true, final: true },
  ];

  const periodLabel = isYearly
    ? `Yearly Overview — ${selectedYear}`
    : `${MONTHS.find(m => m.value === selectedMonth)?.label ?? ''} ${selectedYear}`;

  const handleExportPdf = async () => {
    setExporting(true);
    try {
      const y = Number(selectedYear);
      let dateFrom: string;
      let dateTo: string;
      if (isYearly) {
        dateFrom = `${y}-01-01`;
        dateTo = `${y}-12-31`;
      } else {
        const m = Number(selectedMonth);
        dateFrom = `${y}-${selectedMonth}-01`;
        const lastDay = new Date(y, m, 0).getDate();
        dateTo = `${y}-${selectedMonth}-${String(lastDay).padStart(2, '0')}`;
      }
      const res = await exportPdf({ reportType: 'profitLoss', dateFrom, dateTo, periodLabel });
      window.open(res.url, '_blank');
    } catch (e: any) {
      toast.error(e.message || 'Failed to generate PDF');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">Profit & Loss</h1>
        <div className="flex flex-wrap gap-2">
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Yearly Overview</SelectItem>
              {MONTHS.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={selectedYear} onValueChange={setSelectedYear}>
            <SelectTrigger className="w-[90px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {getYearOptions().map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={handleExportPdf} disabled={exporting}>
            {exporting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <FileText className="w-4 h-4 mr-2" />}
            Export PDF
          </Button>
        </div>
      </div>

      {/* P&L Waterfall */}
      <div className="bg-card border rounded-lg divide-y">
        {pnlSteps.map((step, idx) => {
          const Icon = step.icon;
          const isNegative = step.value < 0;
          return (
            <div key={step.label} className={`flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 ${step.highlight ? 'bg-muted/30' : ''}`}>
              <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                {!step.highlight && idx > 0 && <Minus className="w-4 h-4 text-muted-foreground flex-shrink-0" />}
                {step.highlight && <span className="text-lg">=</span>}
                <Icon className={`w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0 ${step.highlight ? (isNegative ? 'text-destructive' : 'text-primary') : 'text-muted-foreground'}`} />
                <span className={`font-medium truncate ${step.final ? 'text-base sm:text-lg' : 'text-sm sm:text-base'}`}>{step.label}</span>
              </div>
              <span className={`text-sm sm:text-lg font-bold flex-shrink-0 ml-2 ${step.highlight ? (isNegative ? 'text-destructive' : 'text-primary') : ''}`}>
                {fmt(step.value)}
              </span>
            </div>
          );
        })}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Monthly P&L chart — especially useful in yearly view */}
        {data.monthlyPnL.length > 0 && (
          <div className={`bg-card border rounded-lg p-4 overflow-hidden ${isYearly ? 'lg:col-span-2' : ''}`}>
            <h3 className="font-semibold mb-4">
              {isYearly ? `Monthly Breakdown — ${selectedYear}` : `${periodLabel} Overview`}
            </h3>
            <div className={isYearly ? 'h-72' : 'h-64'} style={{ marginLeft: '-0.5rem' }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.monthlyPnL}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} width={55} />
                  <Tooltip formatter={(v: number) => fmt(v)} contentStyle={{ borderRadius: '8px', border: '1px solid hsl(var(--border))', background: 'hsl(var(--card))' }} />
                  <Legend wrapperStyle={{ fontSize: '11px' }} />
                  <Bar dataKey="revenue" fill="hsl(var(--chart-1))" name="Revenue" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="cogs" fill="hsl(var(--chart-3))" name="COGS" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="expenses" fill="hsl(var(--chart-4))" name="Expenses" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="netProfit" fill="hsl(var(--chart-2))" name="Net Profit" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Expenses by category */}
        {data.expensesByCategory.length > 0 && (
          <div className="bg-card border rounded-lg p-4 overflow-hidden">
            <h3 className="font-semibold mb-4">Expenses by Category</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={data.expensesByCategory} dataKey="amount" nameKey="category" cx="50%" cy="50%" outerRadius={70} label={({ category, percent }) => `${category} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                    {data.expensesByCategory.map((_: any, i: number) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number) => fmt(v)} contentStyle={{ borderRadius: '8px', border: '1px solid hsl(var(--border))', background: 'hsl(var(--card))' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-card border rounded-lg p-3 sm:p-4">
          <p className="text-xs text-muted-foreground">Total Sales</p>
          <p className="text-base sm:text-lg font-bold">{data.salesCount}</p>
        </div>
        <div className="bg-card border rounded-lg p-3 sm:p-4">
          <p className="text-xs text-muted-foreground">Total Discounts</p>
          <p className="text-base sm:text-lg font-bold truncate">{fmt(data.totalDiscount)}</p>
        </div>
        <div className="bg-card border rounded-lg p-3 sm:p-4">
          <p className="text-xs text-muted-foreground">Gross Margin</p>
          <p className="text-base sm:text-lg font-bold">{data.revenue > 0 ? `${((data.grossProfit / data.revenue) * 100).toFixed(1)}%` : '0%'}</p>
        </div>
        <div className="bg-card border rounded-lg p-3 sm:p-4">
          <p className="text-xs text-muted-foreground">Net Margin</p>
          <p className="text-base sm:text-lg font-bold">{data.revenue > 0 ? `${((data.netProfit / data.revenue) * 100).toFixed(1)}%` : '0%'}</p>
        </div>
      </div>

      <BackToTopButton />
    </div>
  );
}
