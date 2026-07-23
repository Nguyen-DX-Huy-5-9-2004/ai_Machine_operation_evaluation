// Core dynamic loaders for extension runtime (popup/content/background safe).
// Keep these centralized so exporters can share script/CSS loading logic.

const scriptCache = new Map();

function runtimeGetUrl(path) {
  const getURL =
    globalThis?.browser?.runtime?.getURL ||
    globalThis?.chrome?.runtime?.getURL;
  if (typeof getURL !== 'function') {
    throw new Error('runtime.getURL not available');
  }
  return getURL.call(globalThis.browser?.runtime || globalThis.chrome?.runtime, path);
}

export function loadScriptOnce(url) {
  if (scriptCache.has(url)) return scriptCache.get(url);
  const promise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = url;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load ' + url));
    document.head.appendChild(script);
  });
  scriptCache.set(url, promise);
  return promise;
}

export async function ensureHtml2Canvas() {
  const pick = () => (
    (globalThis.html2canvas && typeof globalThis.html2canvas === 'function')
      ? globalThis.html2canvas
      : (globalThis.html2canvas && typeof globalThis.html2canvas.default === 'function')
        ? globalThis.html2canvas.default
        : null
  );
  let fn = pick();
  if (fn) return fn;
  await loadScriptOnce(runtimeGetUrl('libs/html2canvas.min.js'));
  fn = pick();
  if (!fn) throw new Error('html2canvas not available');
  return fn;
}

export function ensureGlobalKatexCss() {
  if (document.getElementById('acep-katex-css')) return;
  try {
    const link = document.createElement('link');
    link.id = 'acep-katex-css';
    link.rel = 'stylesheet';
    link.href = runtimeGetUrl('libs/katex.min.css');
    document.head.appendChild(link);
  } catch {}
}

export async function ensurePdfMake() {
  if (globalThis.pdfMake) return globalThis.pdfMake;
  await loadScriptOnce(runtimeGetUrl('libs/pdfmake.min.js'));
  await loadScriptOnce(runtimeGetUrl('libs/pdfmake.vfs_fonts.js'));
  if (!globalThis.pdfMake) throw new Error('pdfMake not available');
  return globalThis.pdfMake;
}

export async function ensureHtmlToPdfMake() {
  if (globalThis.htmlToPdfmake) return globalThis.htmlToPdfmake;
  await loadScriptOnce(runtimeGetUrl('libs/html-to-pdfmake.min.js'));
  if (!globalThis.htmlToPdfmake) throw new Error('htmlToPdfmake not available');
  return globalThis.htmlToPdfmake;
}

export async function ensureDocx() {
  if (globalThis.docx) return globalThis.docx;
  await loadScriptOnce(runtimeGetUrl('libs/docx.umd.js'));
  if (!globalThis.docx) throw new Error('docx not available');
  return globalThis.docx;
}

export async function ensureKatexLib() {
  if (globalThis.katex && typeof globalThis.katex.renderToString === 'function') return globalThis.katex;
  await loadScriptOnce(runtimeGetUrl('libs/katex.min.js'));
  if (!globalThis.katex || typeof globalThis.katex.renderToString !== 'function') {
    throw new Error('katex not available');
  }
  return globalThis.katex;
}

