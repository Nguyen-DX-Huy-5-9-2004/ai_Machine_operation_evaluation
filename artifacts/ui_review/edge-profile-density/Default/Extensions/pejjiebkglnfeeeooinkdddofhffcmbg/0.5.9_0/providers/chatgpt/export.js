// ChatGPT export-only transforms (runs in extension page context: popup.js).
// Keep ChatGPT-specific sanitizers and layout tweaks here so popup.js stays provider-agnostic.
(function initChatGptExport() {
  try {
    const g = (typeof globalThis !== 'undefined') ? globalThis : window;
    g.ACEP = g.ACEP || {};
    g.ACEP.providers = g.ACEP.providers || {};
    g.ACEP.providers.chatgpt = g.ACEP.providers.chatgpt || {};
    g.ACEP.providers.chatgpt.export = g.ACEP.providers.chatgpt.export || {};

    function getHtmlCss() {
      // NOTE: selectors are scoped under `.acep-provider-chatgpt` which popup.js applies

      // to the exported HTML root element.
      return `
        .acep-provider-chatgpt .acep-chatgpt-citations{
          display:inline-flex !important;
          align-items:center !important;
          gap:4px !important;
          margin:0 3px !important;
          vertical-align:baseline !important;
        }
        .acep-provider-chatgpt .acep-chatgpt-citation-chip{
          display:inline-flex !important;
          align-items:center !important;
          max-width:180px !important;
          min-height:18px !important;
          padding:2px 7px !important;
          border-radius:999px !important;
          border:1px solid #d9dde6 !important;
          background:#f4f4f5 !important;
          color:#111827 !important;
          text-decoration:none !important;
          font-size:11px !important;
          font-weight:600 !important;
          line-height:1.2 !important;
          white-space:nowrap !important;
          overflow:hidden !important;
          text-overflow:ellipsis !important;
        }
        /* ChatGPT: generated images and some UI thumbnails can be absolutely positioned in-app.
           In exports, force them back into normal flow to avoid huge blank gaps. */
        .acep-provider-chatgpt img.absolute,
        .acep-provider-chatgpt [style*="position: absolute"] img,
        .acep-provider-chatgpt img[style*="position:absolute"]{
          position: static !important;
          inset: auto !important;
          top: auto !important;
          left: auto !important;
          right: auto !important;
          bottom: auto !important;
          transform: none !important;
        }

        /* ChatGPT: keep inline images responsive */
        .acep-provider-chatgpt img{
          max-width: 100% !important;
          height: auto !important;
        }

        .acep-provider-chatgpt .acep-chatgpt-textdoc{
          margin: 10px 0 14px;
          padding: 14px 16px;
          border: 1px solid #d7dbe3;
          border-radius: 16px;
          background: rgba(248,250,252,.9);
          overflow-x: auto;
        }
        .acep-provider-chatgpt .acep-chatgpt-textdoc > h2:first-child{
          margin-top: 0;
        }
      `;
    }

    g.ACEP.providers.chatgpt.export.getHtmlCss = getHtmlCss;
    function stripCitationJunk(html = '') {
      return String(html || '')
        .replace(/\uE200(?:file)?cite\uE202[\s\S]*?\uE201/g, '')
        .replace(/(?:&#x?e200;?|&#57344;)(?:file)?cite(?:&#x?e202;?|&#57346;)[\s\S]*?(?:&#x?e201;?|&#57345;)/gi, '')
        .replace(/îˆ€(?:file)?citeîˆ‚[^<\n\r]*(?:îˆ)?/g, '')
        .replace(/\s*filecite[^\s<]*/gi, '')
        .replace(/\s*citeturn[^\s<]*/gi, '');
    }

    g.ACEP.providers.chatgpt.export.normalizeHtmlForExport = function normalizeHtmlForExport(html = '', ctx = {}) {
      html = stripCitationJunk(html);
      if (!html || !html.includes('acep-diagram-wrap')) return html;
      const showCode = ctx?.chatgpt_showDiagramCode === true;
      // Non-HTML formats: data URI images are useless — always show code block instead
      const fmt = String(ctx?.format || '').toLowerCase();
      const forceCode = fmt === 'md' || fmt === 'txt' || fmt === 'csv' || fmt === 'json';
      try {
        const tmp = document.createElement('div');
        tmp.innerHTML = html;
        tmp.querySelectorAll('.acep-diagram-wrap').forEach(wrap => {
          const preview = wrap.querySelector('.acep-diagram-preview');
          const code    = wrap.querySelector('.acep-diagram-code');
          if ((showCode || forceCode) && code) {
            if (preview) preview.remove();
            wrap.replaceWith(code);
          } else {
            if (code) code.remove();
            if (preview) wrap.replaceWith(preview);
            else wrap.remove();
          }
        });
        return tmp.innerHTML;
      } catch { return html; }
    };

    // PDF: render multi-image prompts as a cropped 3-up gallery (to match the in-app tiles).
    g.ACEP.providers.chatgpt.export.getPdfImageGridSpec = function getPdfImageGridSpec(ctx = {}) {
      try {
        const row = ctx.row || {};
        const imageBlocks = Array.isArray(ctx.imageBlocks) ? ctx.imageBlocks : [];
        const tile = ctx.chatgptGalleryTile || null;
        const isGallery = (Number(row.galleryCount || 0) >= 2) || (imageBlocks.length >= 2);
        if (!isGallery || !tile || !tile.width || !tile.height) return null;
        return {
          isGallery: true,
          colCount: 3,
          widths: Array.from({ length: 3 }, () => tile.width),
          cellOpts: {
            maxWidth: tile.width,
            maxFit: [tile.width, tile.height],
            align: 'left',
            fixedSize: tile,
            forceCover: true,
            objectPosition: '50% 0%',
          },
          padding: { left: 1, right: 1, top: 1, bottom: 2 },
        };
      } catch {
        return null;
      }
    };

    g.ACEP.providers.chatgpt.isProtectedAsset = (u) =>
      /backend-api\/estuary\/content|files\.oaiusercontent\.com/i.test(String(u || ''));

    try { document.documentElement.setAttribute('data-acep-loaded-chatgpt-export', '1'); } catch {}
  } catch {}
})();
