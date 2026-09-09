import { Input } from '@project/components/ui/input';

interface DateRangeFilterProps {
  dateFrom: string;
  dateTo: string;
  onFromChange: (v: string) => void;
  onToChange: (v: string) => void;
  className?: string;
}

// Shared "From: [date]  To: [date]" filter row used on Sales, Expenses, and
// Reports. Labels sit inline next to their input (not stacked above it) so
// this row lines up with a search bar or buttons placed alongside it.
export function DateRangeFilter({ dateFrom, dateTo, onFromChange, onToChange, className }: DateRangeFilterProps) {
  return (
    <div className={`flex flex-wrap items-center gap-x-4 gap-y-2 ${className ?? ''}`}>
      <div className="flex items-center gap-2">
        <label className="text-xs font-medium text-muted-foreground whitespace-nowrap">From:</label>
        <Input type="date" value={dateFrom} onChange={e => onFromChange(e.target.value)} className="w-[9.5rem]" />
      </div>
      <div className="flex items-center gap-2">
        <label className="text-xs font-medium text-muted-foreground whitespace-nowrap">To:</label>
        <Input type="date" value={dateTo} onChange={e => onToChange(e.target.value)} className="w-[9.5rem]" />
      </div>
    </div>
  );
}
