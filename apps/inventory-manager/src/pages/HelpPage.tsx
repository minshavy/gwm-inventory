import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@project/components/ui/tabs';
import { HelpCircle } from 'lucide-react';

interface Term {
  term: string;
  formula?: string;
  explanation: string;
}

function TermCard({ term, formula, explanation }: Term) {
  return (
    <div className="bg-card border rounded-lg p-4">
      <h3 className="font-semibold">{term}</h3>
      {formula && (
        <p className="text-xs font-mono text-primary bg-primary/5 inline-block px-2 py-1 rounded mt-1.5 mb-2">
          {formula}
        </p>
      )}
      <p className={`text-sm text-muted-foreground ${formula ? '' : 'mt-1.5'}`}>{explanation}</p>
    </div>
  );
}

const salesTerms: Term[] = [
  {
    term: 'Revenue (Total Sales)',
    formula: 'Quantity × Selling Price, added up over every sale',
    explanation: 'The total money that came in from sales, before subtracting anything. This is the "top line" — not what you actually made, just what came in.',
  },
  {
    term: 'COGS (Cost of Goods Sold)',
    formula: 'Quantity × Cost Price, added up over every sale',
    explanation: "What it cost you to buy or produce everything you've sold. This is your own cost, not the price you sold it for.",
  },
  {
    term: 'Discounts',
    explanation: 'Money taken off the sale price at checkout, recorded per sale.',
  },
  {
    term: 'Gross Profit',
    formula: 'Revenue − COGS − Discounts',
    explanation: "What you made from selling, before counting running-the-business costs like rent, wages, or utilities.",
  },
  {
    term: 'Net Profit',
    formula: 'Gross Profit − Total Expenses',
    explanation: "What's actually left after everything — the real bottom line for the period you're looking at.",
  },
  {
    term: 'Profit & Loss (P&L)',
    explanation: 'A single report that lays out Revenue, COGS, Gross Profit, Expenses, and Net Profit together for a date range you choose.',
  },
];

const stockTerms: Term[] = [
  {
    term: 'Current Stock',
    explanation: 'How many units of a product you have on hand right now.',
  },
  {
    term: 'Low Stock Threshold',
    explanation: 'A number you set per product. Once Current Stock falls to or below this number, the product is flagged "Low Stock" so you know to reorder.',
  },
  {
    term: 'Low Stock vs Out of Stock',
    explanation: '"Low Stock" means stock is at or below the threshold but still above zero. "Out of Stock" means there are zero units left to sell.',
  },
  {
    term: 'Stock Value',
    formula: 'Current Stock × Cost Price, summed across all products',
    explanation: "Roughly what your entire inventory is worth, valued at what you paid for it (not what you'd sell it for).",
  },
  {
    term: 'Stock Movements',
    explanation: 'A running log of every time stock changed: "Stock In" (received/restocked), "Stock Out" (sold or removed), or "Stock Returned".',
  },
];

const expenseTerms: Term[] = [
  {
    term: 'Expenses',
    explanation: "Money spent running the business that isn't the cost of the products themselves — rent, wages, utilities, delivery, and so on.",
  },
  {
    term: 'Expense Categories',
    explanation: 'How you group expenses for reporting, e.g. "Rent", "Utilities", "Wages" — makes the Reports page easier to read at a glance.',
  },
  {
    term: 'Total Expenses',
    explanation: 'The sum of every expense recorded within the date range you have selected.',
  },
  {
    term: 'Payment Methods',
    explanation: 'How a sale or expense was paid — Cash, Bank Transfer, Card, etc. Lets you track how money is actually moving, not just how much.',
  },
];

const supplierTerms: Term[] = [
  {
    term: 'Supplier',
    explanation: "Someone who provides products for you to sell. Each supplier can get their own login to manage their own products directly.",
  },
  {
    term: "A supplier's products",
    explanation: 'Products a supplier added themselves. A supplier can only see, edit, or add to their own products — never another supplier\'s.',
  },
  {
    term: 'Profit Share',
    formula: '(Revenue − Cost) ÷ 3, for that supplier\'s products only',
    explanation: "Suppliers earn one third of the profit made on sales of their own products — never other suppliers' sales, and it's based on profit (after cost), not the raw sale price.",
  },
  {
    term: 'Selling price approval',
    explanation: "When a supplier adds a new product, they set its cost price and starting stock — but not the selling price. You set that from the Products page before it can be sold, and you'll get a Dashboard notification when one is waiting on you.",
  },
  {
    term: 'Stock update confirmation',
    explanation: "If a supplier changes the stock count on a product that's already Low Stock or Out of Stock, that change is held for your confirmation before it takes effect — protects against inaccurate stock claims. You'll see it on the Dashboard as Confirm/Reject.",
  },
  {
    term: 'Stock Alerts (supplier view)',
    explanation: 'Suppliers have their own Stock Alerts tab showing only their own low/out-of-stock products, so they know what to restock.',
  },
];

export default function HelpPage() {
  const [tab, setTab] = useState('sales');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <HelpCircle className="w-6 h-6 text-primary" />
          Help & Guide
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          What everything on this app means, in plain language. All amounts are in MVR.
        </p>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="sales">Sales & Profit</TabsTrigger>
          <TabsTrigger value="stock">Stock & Inventory</TabsTrigger>
          <TabsTrigger value="expenses">Expenses</TabsTrigger>
          <TabsTrigger value="suppliers">Suppliers</TabsTrigger>
        </TabsList>

        <TabsContent value="sales" className="grid gap-3 sm:grid-cols-2 mt-4">
          {salesTerms.map(t => <TermCard key={t.term} {...t} />)}
        </TabsContent>
        <TabsContent value="stock" className="grid gap-3 sm:grid-cols-2 mt-4">
          {stockTerms.map(t => <TermCard key={t.term} {...t} />)}
        </TabsContent>
        <TabsContent value="expenses" className="grid gap-3 sm:grid-cols-2 mt-4">
          {expenseTerms.map(t => <TermCard key={t.term} {...t} />)}
        </TabsContent>
        <TabsContent value="suppliers" className="grid gap-3 sm:grid-cols-2 mt-4">
          {supplierTerms.map(t => <TermCard key={t.term} {...t} />)}
        </TabsContent>
      </Tabs>
    </div>
  );
}
