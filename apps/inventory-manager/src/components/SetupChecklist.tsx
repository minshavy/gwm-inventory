import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, Circle, X, Sparkles } from 'lucide-react';

const DISMISS_KEY = 'gwm_setup_dismissed';

interface SetupState {
  hasCategory: boolean;
  hasProduct: boolean;
  hasSale: boolean;
  hasSupplier: boolean;
}

const steps = [
  { key: 'hasCategory' as const, label: 'Add your first category', to: '/categories' },
  { key: 'hasProduct' as const, label: 'Add a product', to: '/products' },
  { key: 'hasSale' as const, label: 'Record a sale', to: '/sales' },
  { key: 'hasSupplier' as const, label: 'Add a supplier', to: '/suppliers' },
];

export function SetupChecklist({ setup }: { setup: SetupState }) {
  const navigate = useNavigate();
  const [dismissed, setDismissed] = useState(() => localStorage.getItem(DISMISS_KEY) === '1');

  const doneCount = steps.filter(s => setup[s.key]).length;
  const allDone = doneCount === steps.length;

  if (dismissed || allDone) return null;

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, '1');
    setDismissed(true);
  };

  return (
    <div className="bg-card border rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-primary" />
          Get started
          <span className="text-xs font-normal text-muted-foreground">{doneCount}/{steps.length}</span>
        </h3>
        <button onClick={dismiss} className="text-muted-foreground hover:text-foreground" aria-label="Dismiss">
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="space-y-1.5">
        {steps.map(step => {
          const done = setup[step.key];
          return (
            <button
              key={step.key}
              onClick={() => navigate(step.to)}
              disabled={done}
              className={`w-full flex items-center gap-2.5 p-2.5 rounded border text-left transition-colors ${
                done ? 'bg-muted/30 border-transparent' : 'hover:bg-muted/50 border-border'
              }`}
            >
              {done ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
              ) : (
                <Circle className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              )}
              <span className={`text-sm ${done ? 'text-muted-foreground line-through' : ''}`}>{step.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
