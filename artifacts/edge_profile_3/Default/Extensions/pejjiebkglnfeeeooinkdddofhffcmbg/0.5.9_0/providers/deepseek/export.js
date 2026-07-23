// DeepSeek export-only transforms (runs in extension page context: popup.js).
// Keep DeepSeek-specific layout tweaks here so popup.js stays provider-agnostic.
(function initDeepSeekExport() {
  try {
    const g = (typeof globalThis !== 'undefined') ? globalThis : window;
    g.ACEP = g.ACEP || {};
    g.ACEP.providers = g.ACEP.providers || {};
    g.ACEP.providers.deepseek = g.ACEP.providers.deepseek || {};
    g.ACEP.providers.deepseek.export = g.ACEP.providers.deepseek.export || {};

    g.ACEP.providers.deepseek.export.normalizeHtmlForExport = function normalizeHtmlForExport(html = '') {
      try {
        const doc = new DOMParser().parseFromString(String(html || ''), 'text/html');
        const scopes = Array.from(doc.querySelectorAll('.acep-turn, [data-acep-role], .acep-bubble'));
        (scopes.length ? scopes : [doc.body]).forEach((scope) => {
          const seen = new Set();
          Array.from(scope.querySelectorAll('img[src]')).forEach((img) => {
            try {
              if (img.classList?.contains('role-icon')) return;
              const src = String(img.getAttribute('data-original-src') || img.getAttribute('src') || '').split('#')[0].trim();
              if (!src || /^data:image\/(?:svg|png|jpe?g);base64,/i.test(src) && /role-icon|assistant-icon|user-icon/i.test(img.getAttribute('alt') || '')) return;
              if (seen.has(src)) { img.remove(); return; }
              seen.add(src);
              if (/uploaded image|image\.png|file\/preview/i.test(String(img.getAttribute('alt') || '') + ' ' + src)) {
                img.setAttribute('data-acep-upload-img', '1');
              }
            } catch {}
          });
        });
        return '<!doctype html>\n' + doc.documentElement.outerHTML;
      } catch {
        return html;
      }
    };

    // PDF: DeepSeek user image uploads look better stacked (single column), not in a multi-column grid.
    g.ACEP.providers.deepseek.export.getPdfImageGridSpec = function getPdfImageGridSpec(ctx = {}) {
      try {
        const isUserRow = !!ctx.isUserRow;
        const imageBlocks = Array.isArray(ctx.imageBlocks) ? ctx.imageBlocks : [];
        if (!isUserRow) return null;
        if (imageBlocks.length <= 1) return null;
        return {
          colCount: 1,
          widths: ['*'],
          cellOpts: { maxWidth: 420, maxFit: [420, 320], align: 'left' },
        };
      } catch {
        return null;
      }
    };

    g.ACEP.providers.deepseek.isProtectedAsset = (u) =>
      /\.obs\..*\.huaweicloud\.com\/|\.obs-.*\.huaweicloud\.ru\//i.test(String(u || ''));

    try { document.documentElement.setAttribute('data-acep-loaded-deepseek-export', '1'); } catch {}
  } catch {}
})();

