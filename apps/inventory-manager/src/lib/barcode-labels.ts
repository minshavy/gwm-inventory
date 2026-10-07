import JsBarcode from 'jsbarcode';

// Barcode drawing and label printing, all in the browser.
//
// 13-digit codes with a valid check digit print as EAN-13 (what the app
// generates, and what most shop products carry). Anything else (a SKU, a
// shorter or longer code) prints as Code 128, which any scanner reads.

export type LabelItem = { name: string; barcode: string; price?: number | null };
export type LabelLayout = 'a4' | 'roll';

function isValidEan13(code: string) {
  if (!/^\d{13}$/.test(code)) return false;
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += Number(code[i]) * (i % 2 === 0 ? 1 : 3);
  return (10 - (sum % 10)) % 10 === Number(code[12]);
}

export function barcodeFormat(code: string) {
  return isValidEan13(code) ? 'EAN13' : 'CODE128';
}

// Returns the barcode as an SVG string.
export function barcodeSvg(code: string, opts: { height?: number; fontSize?: number; width?: number } = {}) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  try {
    JsBarcode(svg, code, {
      format: barcodeFormat(code),
      height: opts.height ?? 50,
      width: opts.width ?? 2,
      fontSize: opts.fontSize ?? 14,
      margin: 0,
      displayValue: true,
      background: '#ffffff',
      lineColor: '#000000',
    });
  } catch {
    JsBarcode(svg, code, { format: 'CODE128', height: opts.height ?? 50, width: opts.width ?? 2, fontSize: opts.fontSize ?? 14, margin: 0 });
  }
  return new XMLSerializer().serializeToString(svg);
}

const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

const fmtPrice = (n: number) => `MVR ${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function labelsHtml(items: LabelItem[], layout: LabelLayout, copies: number, showPrice: boolean) {
  const labels: string[] = [];
  for (const it of items) {
    if (!it.barcode) continue;
    const svg = barcodeSvg(it.barcode, { height: layout === 'roll' ? 38 : 42, fontSize: 13 });
    const price = showPrice && it.price ? `<div class="price">${esc(fmtPrice(Number(it.price)))}</div>` : '';
    const one = `<div class="label"><div class="name">${esc(it.name)}</div><div class="code">${svg}</div>${price}</div>`;
    for (let i = 0; i < copies; i++) labels.push(one);
  }

  // a4:   A4 sheet, 3 x 8 = 24 labels of 64 x 34 mm (fits Avery L7159-style sheets)
  // roll: one 50 x 30 mm label per page, for thermal label printers
  const css = layout === 'a4'
    ? `@page { size: A4; margin: 12mm 9mm; }
       .sheet { display: grid; grid-template-columns: repeat(3, 64mm); grid-auto-rows: 34mm; gap: 0 2mm; }
       .label { width: 64mm; height: 34mm; padding: 2mm 3mm; }`
    : `@page { size: 50mm 30mm; margin: 0; }
       .label { width: 50mm; height: 30mm; padding: 1.5mm 2mm; page-break-after: always; break-after: page; }`;

  return `<!doctype html><html><head><meta charset="utf-8"><title>Barcode labels</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
  * { box-sizing: border-box; margin: 0; }
  body { font-family: Arial, Helvetica, sans-serif; color: #000; background: #fff; }
  ${css}
  .label { display: flex; flex-direction: column; align-items: center; justify-content: center; overflow: hidden; text-align: center; }
  .name { font-size: 9pt; font-weight: bold; line-height: 1.15; max-height: 2.3em; overflow: hidden; width: 100%; }
  .code { flex: 1; display: flex; align-items: center; justify-content: center; width: 100%; min-height: 0; padding: 1mm 0; }
  .code svg { max-width: 100%; max-height: 100%; height: auto; }
  .price { font-size: 10pt; font-weight: bold; }
  .hint { font-size: 12px; color: #555; padding: 12px; text-align: center; }
  @media print { .hint { display: none; } }
</style></head><body>
<p class="hint">${labels.length} label${labels.length === 1 ? '' : 's'}. In the print dialog, set scale to 100% (or "Actual size") and turn off headers and footers.</p>
<div class="sheet">${labels.join('')}</div>
<script>window.onload = function () { setTimeout(function () { window.print(); }, 300); };</script>
</body></html>`;
}

// Open the print window *synchronously* inside the click handler (browsers
// block pop-ups opened after an await), then fill it once data is ready.
export function openPrintWindow(): Window | null {
  const w = window.open('', '_blank');
  if (w) {
    w.document.write('<p style="font-family:sans-serif;padding:16px">Preparing labels...</p>');
  }
  return w;
}

export function printLabels(
  w: Window | null,
  items: LabelItem[],
  opts: { layout: LabelLayout; copies: number; showPrice: boolean },
) {
  if (!w) throw new Error('Your browser blocked the print window. Allow pop-ups for this site and try again.');
  const usable = items.filter(i => i.barcode);
  if (!usable.length) { w.close(); throw new Error('None of these products has a barcode yet.'); }
  w.document.open();
  w.document.write(labelsHtml(usable, opts.layout, Math.max(1, Math.min(500, Math.floor(opts.copies) || 1)), opts.showPrice));
  w.document.close();
  w.focus();
}
