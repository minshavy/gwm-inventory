import { useRef, useState } from 'react';
import { parseCSV, downloadCSV } from '@/lib/csv';
import { Button } from '@project/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@project/components/ui/dialog';
import { Badge } from '@project/components/ui/badge';
import { Upload, Download, Loader2, CheckCircle2, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

interface BulkImportDialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  headers: string[];
  sampleRow: Record<string, string>;
  requiredField?: string;
  templateFilename: string;
  onImport: (rows: Record<string, string>[]) => Promise<{ inserted: number; errors?: { row: number; error: string }[] }>;
  onDone?: () => void;
}

export function BulkImportDialog({
  open, onClose, title, headers, sampleRow, requiredField = 'name', templateFilename, onImport, onDone,
}: BulkImportDialogProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [fileName, setFileName] = useState('');
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ inserted: number; errors?: { row: number; error: string }[] } | null>(null);

  const reset = () => {
    setRows([]);
    setFileName('');
    setResult(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleClose = () => { reset(); onClose(); };

  const handleFile = (file: File) => {
    setResult(null);
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      const parsed = parseCSV(String(reader.result || ''));
      if (parsed.length === 0) {
        toast.error("Couldn't find any rows in that file — check it matches the template.");
        setRows([]);
        return;
      }
      setRows(parsed);
    };
    reader.readAsText(file);
  };

  const missingRequired = rows.filter(r => !r[requiredField]?.trim()).length;

  const handleImport = async () => {
    setImporting(true);
    try {
      const res = await onImport(rows);
      setResult(res);
      if (res.inserted > 0) {
        toast.success(`Imported ${res.inserted} product${res.inserted === 1 ? '' : 's'}`);
        onDone?.();
      }
      if (!res.errors?.length) reset();
    } catch (e: any) {
      toast.error(e.message || 'Import failed');
    } finally {
      setImporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={o => !o && handleClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <Button
            variant="outline"
            className="w-full"
            onClick={() => downloadCSV(templateFilename, headers, [headers.map(h => sampleRow[h] ?? '')])}
          >
            <Download className="w-4 h-4 mr-2" /> Download CSV template
          </Button>

          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
            />
            <Button variant="outline" className="w-full" onClick={() => fileInputRef.current?.click()}>
              <Upload className="w-4 h-4 mr-2" /> {fileName || 'Choose CSV file...'}
            </Button>
          </div>

          {rows.length > 0 && !result && (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                Found <span className="font-semibold text-foreground">{rows.length}</span> row{rows.length === 1 ? '' : 's'}.
                {missingRequired > 0 && (
                  <span className="text-destructive"> {missingRequired} {missingRequired === 1 ? 'is' : 'are'} missing a name and will be skipped.</span>
                )}
              </p>
              <div className="border rounded-lg max-h-48 overflow-y-auto divide-y" onWheel={(e) => { e.currentTarget.scrollTop += e.deltaY; }} style={{ touchAction: 'pan-y' }}>
                {rows.slice(0, 8).map((r, i) => (
                  <div key={i} className="px-3 py-2 text-sm flex items-center justify-between gap-2">
                    <span className="truncate">{r[requiredField] || <span className="text-destructive">(missing name)</span>}</span>
                    {r.currentStock && <span className="text-xs text-muted-foreground flex-shrink-0">Stock: {r.currentStock}</span>}
                  </div>
                ))}
                {rows.length > 8 && <div className="px-3 py-2 text-xs text-muted-foreground">+ {rows.length - 8} more</div>}
              </div>
              <Button className="w-full" onClick={handleImport} disabled={importing || rows.length === 0}>
                {importing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                {importing ? 'Importing...' : `Import ${rows.length} product${rows.length === 1 ? '' : 's'}`}
              </Button>
            </div>
          )}

          {result && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>{result.inserted} imported successfully.</span>
              </div>
              {!!result.errors?.length && (
                <>
                  <div className="flex items-center gap-2 text-sm">
                    <AlertTriangle className="w-4 h-4 text-amber-600" />
                    <span>{result.errors.length} row{result.errors.length === 1 ? '' : 's'} had a problem:</span>
                  </div>
                  <div className="border rounded-lg max-h-40 overflow-y-auto divide-y" onWheel={(e) => { e.currentTarget.scrollTop += e.deltaY; }} style={{ touchAction: 'pan-y' }}>
                    {result.errors.map((e, i) => (
                      <div key={i} className="px-3 py-2 text-xs flex items-start gap-2">
                        <Badge variant="outline" className="flex-shrink-0">Row {e.row}</Badge>
                        <span className="text-muted-foreground">{e.error}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
              <Button className="w-full" variant="outline" onClick={handleClose}>Done</Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
