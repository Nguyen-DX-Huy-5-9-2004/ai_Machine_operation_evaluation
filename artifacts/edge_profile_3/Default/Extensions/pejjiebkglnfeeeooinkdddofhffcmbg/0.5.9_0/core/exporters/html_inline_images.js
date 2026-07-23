// For HTML self-contained exports, prefer embedding images using already-fetched data URLs
// (e.g. fetched from page context via sendToTab) instead of relying on worker/proxy.
export function inlineRowHtmlImagesFromRowImgs(rows = []) {
  try {
    if (!Array.isArray(rows) || typeof DOMParser === 'undefined') return;
    const normalize = (u = '') => {
      const s = String(u || '').trim();
      if (!s) return '';
      const hash = s.indexOf('#');
      const noHash = hash >= 0 ? s.slice(0, hash) : s;
      return noHash;
    };
    for (const row of rows) {
      if (!row || !row.html || !Array.isArray(row.imgs) || !row.imgs.length) continue;
      const srcToData = new Map();
      row.imgs.forEach((im) => {
        if (!im) return;
        const dataUrl = String(im.dataUrl || im.pngDataUrl || '').trim();
        if (!/^data:image\//i.test(dataUrl)) return;
        const keys = [im.originalSrc, im.src].map(normalize).filter(Boolean);
        keys.forEach((k) => { if (k && !srcToData.has(k)) srcToData.set(k, dataUrl); });
      });
      if (!srcToData.size) continue;
      const parser = new DOMParser();
      const doc = parser.parseFromString(String(row.html), 'text/html');
      if (!doc) continue;
      const imgs = Array.from(doc.querySelectorAll('img'));
      imgs.forEach((imgEl) => {
        try {
          const srcRaw = imgEl.getAttribute('src') || '';
          if (!srcRaw || /^data:/i.test(srcRaw)) return;
          const key = normalize(srcRaw);
          const dataUrl = srcToData.get(key) || null;
          if (!dataUrl) return;
          imgEl.setAttribute('data-original-src', srcRaw);
          imgEl.setAttribute('src', dataUrl);
        } catch {}
      });
      row.html = doc.body ? doc.body.innerHTML : row.html;
    }
  } catch {}
}

// Inline images in a full HTML document string using the row image dataUrls (HTML self-contained).
export function inlineHtmlImagesFromRowsHtml(html = '', rows = []) {
  try {
    if (!html || typeof html !== 'string' || !Array.isArray(rows) || typeof DOMParser === 'undefined') return String(html || '');
    const inputWasFullDocument = /<!doctype\s+html|<html[\s>]/i.test(String(html || ''));
    const normalize = (u = '') => {
      const s = String(u || '').trim();
      if (!s) return '';
      const hash = s.indexOf('#');
      return (hash >= 0 ? s.slice(0, hash) : s).trim();
    };
    const srcToData = new Map();
    rows.forEach((row) => {
      if (!row || !Array.isArray(row.imgs)) return;
      row.imgs.forEach((im) => {
        if (!im) return;
        const dataUrl = String(im.dataUrl || im.pngDataUrl || '').trim();
        if (!/^data:image\//i.test(dataUrl)) return;
        const keys = [im.originalSrc, im.src].map(normalize).filter(Boolean);
        keys.forEach((k) => { if (k && !srcToData.has(k)) srcToData.set(k, dataUrl); });
      });
    });
    if (!srcToData.size) return html;
    const parser = new DOMParser();
    const doc = parser.parseFromString(String(html), 'text/html');
    if (!doc) return html;
    Array.from(doc.querySelectorAll('img[src]')).forEach((imgEl) => {
      try {
        const srcRaw = imgEl.getAttribute('src') || '';
        if (!srcRaw || /^data:/i.test(srcRaw)) return;
        const key = normalize(srcRaw);
        const dataUrl = srcToData.get(key);
        if (!dataUrl) return;
        imgEl.setAttribute('data-original-src', srcRaw);
        imgEl.setAttribute('src', dataUrl);
      } catch {}
    });
    if (inputWasFullDocument) {
      return '<!doctype html>\n' + (doc.documentElement?.outerHTML || doc.body?.outerHTML || html);
    }
    return doc.body ? doc.body.innerHTML : String(html || '');
  } catch {
    return String(html || '');
  }
}
