import { useEffect, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@project/components/ui/dialog';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { ScanBarcode, CameraOff, Loader2 } from 'lucide-react';

// Camera barcode scanner.
//
// Uses the browser's built-in BarcodeDetector when it exists (Chrome on
// Android). On browsers without it (Safari on iPhone, Firefox) it loads the
// `barcode-detector` polyfill, whose decoder (a ~1 MB WebAssembly file) is
// bundled with the app and only downloaded the first time you scan.
//
// The camera only works over HTTPS (Render/Railway give you that) or on
// http://localhost. A "type it instead" box is always shown as a fallback,
// and USB/Bluetooth scanners that act as a keyboard can type into it too.

const FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'code_93', 'itf', 'codabar', 'qr_code'];

let detectorPromise: Promise<any> | null = null;
async function getDetector(): Promise<any> {
  if (!detectorPromise) {
    detectorPromise = (async () => {
      const Native = (window as any).BarcodeDetector;
      if (Native) {
        try {
          const supported: string[] = await Native.getSupportedFormats();
          const formats = FORMATS.filter(f => supported.includes(f));
          if (formats.length) return new Native({ formats });
        } catch { /* fall through to the polyfill */ }
      }
      const [{ BarcodeDetector, setZXingModuleOverrides }, wasm] = await Promise.all([
        import('barcode-detector/pure'),
        import('zxing-wasm/reader/zxing_reader.wasm?url'),
      ]);
      setZXingModuleOverrides({
        locateFile: (path: string, prefix: string) => (path.endsWith('.wasm') ? wasm.default : prefix + path),
      });
      return new BarcodeDetector({ formats: FORMATS as any });
    })();
    detectorPromise.catch(() => { detectorPromise = null; });
  }
  return detectorPromise;
}

export function BarcodeScannerDialog({
  open, onOpenChange, onDetected, title = 'Scan barcode',
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDetected: (code: string) => void;
  title?: string;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [status, setStatus] = useState<'starting' | 'scanning' | 'error'>('starting');
  const [error, setError] = useState('');
  const [manual, setManual] = useState('');
  // Always call the latest callbacks, even from the long-running scan loop.
  const onDetectedRef = useRef(onDetected);
  const onOpenChangeRef = useRef(onOpenChange);
  onDetectedRef.current = onDetected;
  onOpenChangeRef.current = onOpenChange;

  useEffect(() => {
    if (!open) return;
    let stream: MediaStream | null = null;
    let timer: number | undefined;
    let cancelled = false;
    setStatus('starting');
    setError('');
    setManual('');

    const finish = (code: string) => {
      cancelled = true;
      if (navigator.vibrate) navigator.vibrate(80);
      onDetectedRef.current(code);
      onOpenChangeRef.current(false);
    };

    (async () => {
      if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
        setStatus('error');
        setError('The camera needs a secure (https://) address. Open the app from its https link, or type the code below.');
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
        if (cancelled) return;
        const video = videoRef.current!;
        video.srcObject = stream;
        await video.play();
        const detector = await getDetector();
        if (cancelled) return;
        setStatus('scanning');
        const tick = async () => {
          if (cancelled) return;
          try {
            if (video.readyState >= 2) {
              const found = await detector.detect(video);
              const code = found?.[0]?.rawValue?.trim();
              if (code) { finish(code); return; }
            }
          } catch { /* a frame failed to decode; try the next one */ }
          timer = window.setTimeout(tick, 200);
        };
        tick();
      } catch (e: any) {
        if (cancelled) return;
        setStatus('error');
        setError(
          e?.name === 'NotAllowedError'
            ? 'Camera permission was blocked. Allow camera access for this site in your browser settings, then try again.'
            : e?.name === 'NotFoundError'
              ? 'No camera was found on this device. Type the code below instead.'
              : `Could not start the camera (${e?.message || 'unknown error'}). Type the code below instead.`
        );
      }
    })();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      stream?.getTracks().forEach(t => t.stop());
    };
  }, [open]);

  const submitManual = () => {
    const code = manual.trim();
    if (!code) return;
    onDetected(code);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>Point the back camera at the barcode and hold steady about 15 cm away.</DialogDescription>
        </DialogHeader>
        <div className="relative aspect-[4/3] w-full overflow-hidden rounded-lg bg-black">
          <video ref={videoRef} className="h-full w-full object-cover" playsInline muted />
          {status === 'scanning' && (
            <div className="pointer-events-none absolute inset-x-8 top-1/2 h-24 -translate-y-1/2 rounded-md border-2 border-white/80">
              <div className="absolute inset-x-0 top-1/2 h-0.5 bg-red-500/80 animate-pulse" />
            </div>
          )}
          {status === 'starting' && (
            <div className="absolute inset-0 flex items-center justify-center gap-2 text-sm text-white/80">
              <Loader2 className="h-4 w-4 animate-spin" /> Starting camera...
            </div>
          )}
          {status === 'error' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-6 text-center text-sm text-white/90">
              <CameraOff className="h-8 w-8 opacity-70" />
              <p>{error}</p>
            </div>
          )}
        </div>
        <div className="flex gap-2">
          <Input
            placeholder="Or type / paste the barcode"
            value={manual}
            onChange={e => setManual(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') submitManual(); }}
            inputMode="text"
          />
          <Button onClick={submitManual} disabled={!manual.trim()}>Use</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Small square button with a barcode icon, for placing next to search boxes.
export function ScanButton({ onClick, label = 'Scan barcode', className = '' }: { onClick: () => void; label?: string; className?: string }) {
  return (
    <Button type="button" variant="outline" size="icon" onClick={onClick} title={label} aria-label={label} className={className}>
      <ScanBarcode className="h-4 w-4" />
    </Button>
  );
}
