// The text of a PDF, read on this device with pdf.js (docs/vendor/pdfjs, Apache-2.0, loaded only when needed).
// Lines are rebuilt from the text pieces by their height on the page, top to bottom, left to right. The file never leaves the phone.
let lib = null;
async function pdfjs() {
  if (!lib) {
    lib = await import(new URL('../vendor/pdfjs/pdf.min.js', import.meta.url).href);
    lib.GlobalWorkerOptions.workerSrc = new URL('../vendor/pdfjs/pdf.worker.min.js', import.meta.url).href;
  }
  return lib;
}
/** File | ArrayBuffer → its text (at most `maxPages` pages). */
export async function pdfText(file, { maxPages = 8 } = {}) {
  const P = await pdfjs();
  const data = new Uint8Array(file instanceof ArrayBuffer ? file : await file.arrayBuffer());
  const doc = await P.getDocument({ data, disableFontFace: true, isEvalSupported: false }).promise;
  const out = [];
  try {
    for (let i = 1; i <= Math.min(doc.numPages, maxPages); i++) {
      const tc = await (await doc.getPage(i)).getTextContent();
      const rows = new Map();
      for (const it of tc.items) { if (!it.str?.trim()) continue; const y = Math.round(it.transform[5] / 3); if (!rows.has(y)) rows.set(y, []); rows.get(y).push({ x: it.transform[4], s: it.str }); }
      for (const y of [...rows.keys()].sort((a, b) => b - a)) out.push(rows.get(y).sort((a, b) => a.x - b.x).map(r => r.s).join(' ').replace(/\s+/g, ' ').trim());
    }
  } finally { doc.destroy(); }
  return out.join('\n').normalize('NFKC');
}
