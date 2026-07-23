// Gemini export-only transforms (runs in extension page context: popup.js).
// Keep Gemini-specific HTML/CSS tweaks here so popup.js stays provider-agnostic.
(function initGeminiExport() {
  try {
    const g = (typeof globalThis !== 'undefined') ? globalThis : window;
    g.ACEP = g.ACEP || {};
    g.ACEP.providers = g.ACEP.providers || {};
    g.ACEP.providers.gemini = g.ACEP.providers.gemini || {};
    g.ACEP.providers.gemini.export = g.ACEP.providers.gemini.export || {};

    function getHtmlCss() {
      // NOTE: selectors are scoped under `.acep-provider-gemini` which popup.js
      // conditionally applies to the exported HTML root element.
      return `
        .acep-provider-gemini .katex .katex-html { display: inline !important; }
        .acep-provider-gemini .katex .katex-mathml { display: none !important; }
        .acep-provider-gemini .math-inline { white-space: nowrap; }
        .acep-provider-gemini .math-block,
        .acep-provider-gemini .katex-display {
          line-height: normal;
          margin: 0.8em 0;
          text-align: center;
        }
        /* Gemini: preserve user prompt line breaks (text contains \\n from DOM innerText). */
        .acep-provider-gemini .acep-turn[data-acep-role="user"] .acep-bubble p,
        .acep-provider-gemini .acep-turn[data-acep-role="user"] .acep-bubble div,
        .acep-provider-gemini .acep-turn[data-acep-role="user"] .acep-bubble span,
        .acep-provider-gemini .acep-user-bubble p,
        .acep-provider-gemini .acep-user-bubble div,
        .acep-provider-gemini .acep-user-bubble span {
          white-space: pre-wrap !important;
          word-wrap: break-word !important;
          overflow-wrap: break-word !important;
        }
        /* Gemini: un-collapse/clamp long prompts in exported HTML/PNG */
        .acep-provider-gemini [class*="truncate"],
        .acep-provider-gemini .truncate,
        .acep-provider-gemini [class*="line-clamp"]{
          white-space: pre-wrap !important;
          overflow: visible !important;
          text-overflow: clip !important;
          -webkit-line-clamp: unset !important;
          -webkit-box-orient: initial !important;
          max-height: none !important;
          height: auto !important;
          display: block !important;
        }
        .acep-provider-gemini [style*="max-height"]{ max-height: none !important; overflow: visible !important; }
        .acep-provider-gemini .acep-user-bubble,
        .acep-provider-gemini .acep-turn[data-acep-role="user"] .acep-bubble,
        .acep-provider-gemini .acep-content{ overflow: visible !important; }
        .acep-provider-gemini .acep-user-bubble *,
        .acep-provider-gemini .acep-turn[data-acep-role="user"] .acep-bubble *,
        .acep-provider-gemini .acep-content *{ max-width: 100% !important; }
        .acep-provider-gemini .acep-gemini-citations{
          display:inline-flex !important;
          align-items:center !important;
          gap:4px !important;
          margin:0 3px !important;
          vertical-align:baseline !important;
        }
        .acep-provider-gemini .acep-gemini-citation-chip{
          display:inline-flex !important;
          align-items:center !important;
          max-width:180px !important;
          min-height:18px !important;
          padding:2px 7px !important;
          border-radius:999px !important;
          border:1px solid #d8dee8 !important;
          background:#f1f5f9 !important;
          color:#334155 !important;
          text-decoration:none !important;
          font-size:.78em !important;
          font-weight:700 !important;
          line-height:1.2 !important;
          white-space:nowrap !important;
          overflow:hidden !important;
          text-overflow:ellipsis !important;
        }
      `;
    }

    function processDocxRows(rows = []) {
      try {
        // popup.js calls `ensureKatexLib()` before calling this.
        if (!Array.isArray(rows) || !rows.length) return rows;
        if (!g.katex || typeof g.katex.renderToString !== 'function') return rows;
        return rows.map((row) => {
          if (!row || typeof row.html !== 'string' || !row.html.includes('data-math')) return row;
          try {
            const parser = new DOMParser();
            const doc = parser.parseFromString(row.html, 'text/html');
            const nodes = Array.from(doc.querySelectorAll('[data-math]'));
            if (!nodes.length) return row;
            nodes.forEach((el) => {
              const tex = (el.getAttribute('data-math') || '').trim();
              if (!tex) return;
              const display = el.classList && el.classList.contains('math-block');
              try {
                const rendered = g.katex.renderToString(tex, { throwOnError: false, displayMode: display, output: 'mathml', strict: 'ignore' });
                el.innerHTML = rendered;
                if (display) el.classList.add('katex-display');
              } catch {}
            });
            return { ...row, html: doc.body.innerHTML || row.html };
          } catch {
            return row;
          }
        });
      } catch {
        return rows;
      }
    }

    g.ACEP.providers.gemini.export.getHtmlCss = getHtmlCss;
    g.ACEP.providers.gemini.export.processDocxRows = processDocxRows;

    g.ACEP.providers.gemini.isProtectedAsset = (u) =>
      /googleusercontent\.com|lh3\.google\.com|lh3\.googleusercontent\.com|gstatic\.com/i.test(String(u || ''));

    try { document.documentElement.setAttribute('data-acep-loaded-gemini-export', '1'); } catch {}
  } catch {}
})();
