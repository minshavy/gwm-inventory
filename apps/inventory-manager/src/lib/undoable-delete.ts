import { toast } from 'sonner';

interface UndoableDeleteOptions {
  itemLabel: string;
  description?: string;
  onRemoveLocally: () => void;
  onRestoreLocally: () => void;
  onConfirmDelete: () => Promise<void>;
  delayMs?: number;
}

// Removes an item from the UI immediately and shows a "Deleted — Undo" toast.
// The actual delete API call is only made once the toast's window closes
// without being undone — so clicking Undo means nothing was ever sent to
// the server, no restore-from-trash logic needed.
export function undoableDelete({
  itemLabel,
  description,
  onRemoveLocally,
  onRestoreLocally,
  onConfirmDelete,
  delayMs = 5000,
}: UndoableDeleteOptions) {
  onRemoveLocally();
  let undone = false;

  const timer = setTimeout(async () => {
    if (undone) return;
    try {
      await onConfirmDelete();
    } catch (e: any) {
      onRestoreLocally();
      toast.error(e.message || `Failed to delete ${itemLabel}`);
    }
  }, delayMs);

  toast(`${itemLabel} deleted`, {
    description,
    duration: delayMs,
    action: {
      label: 'Undo',
      onClick: () => {
        undone = true;
        clearTimeout(timer);
        onRestoreLocally();
      },
    },
  });
}
