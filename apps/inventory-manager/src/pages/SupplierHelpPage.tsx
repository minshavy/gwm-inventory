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

const terms: Term[] = [
  {
    term: 'Your products',
    explanation: 'Products you added yourself. You can add, edit, and update stock on these any time — but only your own, never another supplier\'s.',
  },
  {
    term: 'Selling price',
    explanation: "When you add a product, you set its cost price and starting stock — the admin sets the selling price afterwards, once they've reviewed it. Until then it just isn't sellable yet.",
  },
  {
    term: 'Current Stock & Low Stock Threshold',
    explanation: 'Current Stock is how many units you have right now. The Low Stock Threshold is the number where the app starts warning that it\'s time to restock.',
  },
  {
    term: 'Low Stock vs Out of Stock',
    explanation: '"Low Stock" means stock is at or below your threshold but still above zero. "Out of Stock" means zero units left — check your Stock Alerts tab any time to see both.',
  },
  {
    term: 'Stock update confirmation',
    explanation: "If you change the stock count on a product that's already Low Stock or Out of Stock, that change is held for the admin to confirm before it takes effect — you'll see \"pending confirmation\" on the product until they do.",
  },
  {
    term: 'Your Profit Share',
    formula: '(Revenue − Cost) ÷ 3, for your own products only',
    explanation: "You earn one third of the profit made whenever one of your products sells. It's never based on other suppliers' products, and it's based on profit (after cost), not the raw sale price.",
  },
  {
    term: 'My Earnings page',
    explanation: 'Shows your total share all-time, your share so far this month, and a list of recent sales of your products with the share earned from each one.',
  },
  {
    term: 'Paid so far & Balance owed',
    formula: 'Balance = Total Share − Paid so far',
    explanation: "\"Paid so far\" is what the admin has actually paid you, logged whenever they mark a payout. \"Balance owed\" is what's left — it updates automatically as you earn more or get paid.",
  },
];

export default function SupplierHelpPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold flex items-center gap-2">
          <HelpCircle className="w-5 h-5 text-primary" />
          Help & Guide
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          What everything in your portal means, in plain language. All amounts are in MVR.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {terms.map(t => <TermCard key={t.term} {...t} />)}
      </div>
    </div>
  );
}
