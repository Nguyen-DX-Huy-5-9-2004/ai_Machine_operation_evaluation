// Grok export-only transforms (runs in extension page context: popup.js).
// Keep Grok-specific sanitizers and HTML/CSS tweaks here so popup.js stays provider-agnostic.
(function initGrokExport() {
  try {
    const g = (typeof globalThis !== 'undefined') ? globalThis : window;
    g.ACEP = g.ACEP || {};
    g.ACEP.providers = g.ACEP.providers || {};
    g.ACEP.providers.grok = g.ACEP.providers.grok || {};
    g.ACEP.providers.grok.export = g.ACEP.providers.grok.export || {};

    function normalizeGrokTableHtml(html = '') {
      try {
        if (!html || typeof html !== 'string') return html;
        const tmp = document.createElement('div');
        tmp.innerHTML = html;

        const weightFor = (size = '') => {
          const s = String(size || '').toLowerCase().trim();
          if (s === 'sm') return 1.0;
          if (s === 'md') return 1.4;
          if (s === 'lg') return 1.9;
          if (s === 'xl') return 3.0;
          return 1.3;
        };
        const buildColgroup = (sizes = []) => {
          const weights = sizes.map(weightFor);
          const total = weights.reduce((a, b) => a + b, 0) || sizes.length || 1;
          const colgroup = document.createElement('colgroup');
          sizes.forEach((_s, idx) => {
            const pct = Math.max(5, Math.round((weights[idx] / total) * 1000) / 10);
            const col = document.createElement('col');
            col.style.width = `${pct}%`;
            colgroup.appendChild(col);
          });
          return colgroup;
        };
        const rebuildTable = (srcTable) => {
          try {
            if (!srcTable) return null;
            const firstRow = srcTable.querySelector('thead tr') || srcTable.querySelector('tr');
            const cols = firstRow ? Array.from(firstRow.children || []) : [];
            const sizes = cols.map((c) => c?.getAttribute?.('data-col-size') || c?.dataset?.colSize || '');
            const cloned = srcTable.cloneNode(true);
            const existing = cloned.querySelector('colgroup');
            if (existing) existing.remove();
            if (sizes.length) cloned.insertBefore(buildColgroup(sizes), cloned.firstChild);
            cloned.classList.add('acep-table');
            return cloned;
          } catch {
            return null;
          }
        };

        // Grok wraps tables for horizontal scrolling. Replace wrappers with a simple block wrapper.
        const wrappers = Array.from(tmp.querySelectorAll('[class*="table-container" i], .table-container'));
        wrappers.forEach((wrap) => {
          try {
            const table = wrap.querySelector('table');
            if (!table) return;
            const rebuilt = rebuildTable(table) || table.cloneNode(true);
            const block = document.createElement('div');
            block.className = 'acep-table-block';
            block.appendChild(rebuilt);
            wrap.replaceWith(block);
          } catch {}
        });

        // Fallback: rebuild any remaining tables.
        Array.from(tmp.querySelectorAll('table')).forEach((table) => {
          try {
            if (table.closest && table.closest('.acep-table-block')) return;
            const rebuilt = rebuildTable(table);
            if (!rebuilt) return;
            const block = document.createElement('div');
            block.className = 'acep-table-block';
            block.appendChild(rebuilt);
            table.replaceWith(block);
          } catch {}
        });

        return tmp.innerHTML;
      } catch {
        return html;
      }
    }

    async function preProcessRowsForHtmlSelf({ tabUrl = '', tabId = null, rows = [], ensureRowImagesData = null, inlineRowHtmlImagesFromRowImgs = null } = {}) {
      try {
        const host = (() => { try { return (new URL(tabUrl)).hostname; } catch { return ''; } })();
        if (!/grok\.com$/i.test(host)) return { ok: false, reason: 'not-grok' };
        if (!Array.isArray(rows) || !rows.length) return { ok: true, note: 'no-rows' };
        if (typeof ensureRowImagesData !== 'function' || typeof inlineRowHtmlImagesFromRowImgs !== 'function') {
          return { ok: false, reason: 'missing-fns' };
        }
        await ensureRowImagesData(rows, tabId);
        inlineRowHtmlImagesFromRowImgs(rows);

        // If Grok uploaded images are protected (commonly `assets.grok.com/.../content`), we may not be able to embed
        // them without additional host permissions. Avoid broken 403 images in self-contained HTML by converting any
        // remaining protected Grok image URLs to clickable links.
        try {
          if (typeof DOMParser !== 'undefined') {
            for (const row of rows) {
              if (!row || !row.html || typeof row.html !== 'string') continue;
              const parser = new DOMParser();
              const doc = parser.parseFromString(String(row.html), 'text/html');
              const imgs = Array.from(doc.querySelectorAll('img[src]'));
              let changed = false;
              imgs.forEach((img) => {
                try {
                  const src = String(img.getAttribute('src') || '').trim();
                  if (!src) return;
                  if (/^data:image\//i.test(src)) return;
                  const abs = (() => { try { return new URL(src, 'https://grok.com/').href; } catch { return src; } })();
                  if (!/^https?:\/\/assets\.grok\.com\//i.test(abs)) return;
                  const a = doc.createElement('a');
                  a.setAttribute('href', abs);
                  a.setAttribute('target', '_blank');
                  a.setAttribute('rel', 'noopener noreferrer');
                  a.textContent = `[Image]: ${abs}`;
                  img.replaceWith(a);
                  changed = true;
                } catch {}
              });
              if (changed) row.html = doc.body ? doc.body.innerHTML : row.html;
            }
          }
        } catch {}
        return { ok: true };
      } catch (e) {
        return { ok: false, error: String(e?.message || e) };
      }
    }

    function escapeHtml(s = '') {
      return String(s || '').replace(/[&<>"']/g, (m) => (
        { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m] || m
      ));
    }

    function replaceGrokArtifactCardsInHtml(html = '', ctx = {}) {
      try {
        if (!html || typeof html !== 'string') return html;
        if (!/data-acep-artifact/i.test(html) && !/id="artifact_card_/i.test(html)) return html;
        if (typeof DOMParser === 'undefined') return html;
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        if (!doc || !doc.body) return html;
        const sel = '[data-acep-artifact-title],[data-acep-artifact-text],[data-acep-artifact-id],[id^="artifact_card_"]';
        const roots = Array.from(doc.querySelectorAll(sel))
          .filter(n => !n.parentElement?.closest?.(sel));
        if (!roots.length) return doc.body.innerHTML || html;
        const showFull = !!ctx.showGrokMarkdownContent;
        for (const node of roots) {
          const title = (node.getAttribute('data-acep-artifact-title') || node.dataset?.acepArtifactTitle || '').trim();
          const text  = (node.getAttribute('data-acep-artifact-text')  || node.dataset?.acepArtifactText  || '').trim();
          let replacement;
          if (showFull) {
            const titleSafe = escapeHtml(title || 'Artifact');
            const parts = [];
            if (title) parts.push(`<p><strong>${titleSafe}</strong></p>`);
            if (text)  parts.push(`<pre><code>${escapeHtml(text)}</code></pre>`);
            replacement = parts.length ? `<div class="acep-artifact-wrap">${parts.join('')}</div>` : null;
          } else {
            const titleSafe = escapeHtml(title || 'Artifact');
            replacement = `<p>&#128206; <strong>${titleSafe}</strong></p>`;
          }
          if (!replacement) continue;
          const tmp = doc.createElement('div');
          tmp.innerHTML = replacement;
          const frag = doc.createDocumentFragment();
          while (tmp.firstChild) frag.appendChild(tmp.firstChild);
          try { node.replaceWith(frag); } catch {}
        }
        return doc.body.innerHTML || html;
      } catch {
        return html;
      }
    }

    function wrapLatexInGrokHtml(html = '') {
      try {
        if (!html || typeof html !== 'string') return html;
        // Only run when LaTeX markers exist (keeps DOMParser overhead minimal)
        // Supported: $$...$$, $...$, \[...\], \( ... \)
        const hasLatex =
          /\$\$[\s\S]*?\$\$/.test(html)
          || /(?<![\\$\d])\$[^\n$]{1,300}\$(?!\d)/.test(html)
          || /\\\[[\s\S]*?\\\]/.test(html)
          || /\\\([\s\S]*?\\\)/.test(html);
        if (!hasLatex) return html;
        if (typeof DOMParser === 'undefined') return html;
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        if (!doc || !doc.body) return html;

        const escAttr = (s = '') => String(s || '').replace(/[&<>"']/g, (m) => (
          { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m] || m
        ));
        const shouldSkip = (node) => {
          try {
            const p = node?.parentElement;
            if (!p) return false;
            if (p.closest && p.closest('pre, code, textarea, script, style')) return true;
          } catch {}
          return false;
        };

        const textNodes = [];
        const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT);
        let n;
        while ((n = walker.nextNode())) {
          if (!n || !n.nodeValue) continue;
          if (shouldSkip(n)) continue;
          // Ignore huge blobs (likely code/artifact dumps)
          if (n.nodeValue.length > 4000) continue;
          textNodes.push(n);
        }

        const wrapInFragment = (text = '') => {
          const frag = doc.createDocumentFragment();
          let s = String(text || '');
          // Block math first: $$...$$ and \[...\]
          const blockRe = /(\$\$([\s\S]*?)\$\$|\\\[([\s\S]*?)\\\])/g;
          let lastIdx = 0;
          let m;
          while ((m = blockRe.exec(s))) {
            const before = s.slice(lastIdx, m.index);
            if (before) frag.appendChild(doc.createTextNode(before));
            const tex = String(m[2] || m[3] || '').trim();
            if (tex) {
              const div = doc.createElement('div');
              div.className = 'math-block katex-display';
              div.setAttribute('data-math', escAttr(tex));
              div.textContent = `$$${tex}$$`;
              frag.appendChild(div);
            } else {
              frag.appendChild(doc.createTextNode(m[0]));
            }
            lastIdx = m.index + m[0].length;
          }
          s = s.slice(lastIdx);

          // Inline math: $...$ and \( ... \) (avoid currency false-positives for $...$)
          const inlineRe = /((?<![\\$\d])\$([^\n$]{1,300})\$(?!\d)|\\\(([\s\S]{1,600}?)\\\))/g;
          lastIdx = 0;
          while ((m = inlineRe.exec(s))) {
            const before = s.slice(lastIdx, m.index);
            if (before) frag.appendChild(doc.createTextNode(before));
            const tex = String(m[2] || m[3] || '');
            if (tex.trim()) {
              const span = doc.createElement('span');
              span.className = 'math-inline katex';
              span.setAttribute('data-math', escAttr(tex));
              span.textContent = `$${tex}$`;
              frag.appendChild(span);
            } else {
              frag.appendChild(doc.createTextNode(m[0]));
            }
            lastIdx = m.index + m[0].length;
          }
          const tail = s.slice(lastIdx);
          if (tail) frag.appendChild(doc.createTextNode(tail));
          return frag;
        };

        textNodes.forEach((tn) => {
          const t = tn.nodeValue || '';
          if (
            !/\$\$[\s\S]*?\$\$/.test(t)
            && !/(?<![\\$\d])\$[^\n$]{1,300}\$(?!\d)/.test(t)
            && !/\\\[[\s\S]*?\\\]/.test(t)
            && !/\\\([\s\S]*?\\\)/.test(t)
          ) return;
          try { tn.replaceWith(wrapInFragment(t)); } catch {}
        });

        return doc.body.innerHTML || html;
      } catch {
        return html;
      }
    }

    g.ACEP.providers.grok.export.normalizeGrokTableHtml = normalizeGrokTableHtml;
    // Extra CSS for Grok exports (HTML self/linked + PDF base HTML).
    g.ACEP.providers.grok.export.getHtmlCss = function getHtmlCss() {
      return `
        /* Grok: keep images readable (DOM + API nodes) */
        .acep-provider-grok img { max-width: 100% !important; height: auto !important; }
        .acep-provider-grok .acep-grok-image-gallery {
          display: grid !important;
          gap: 8px !important;
          width: 100% !important;
          max-width: 720px !important;
          margin: 10px 0 16px !important;
        }
        .acep-provider-grok .acep-grok-image-gallery .acep-grok-image-tile {
          min-width: 0 !important;
          aspect-ratio: 5 / 4 !important;
          overflow: hidden !important;
          border-radius: 10px !important;
        }
        .acep-provider-grok .acep-grok-image-gallery img {
          display: block !important;
          width: 100% !important;
          height: 100% !important;
          max-width: none !important;
          object-fit: cover !important;
          object-position: center top !important;
          margin: 0 !important;
          border-radius: 10px !important;
        }
        .acep-provider-grok figure, .acep-provider-grok .image, .acep-provider-grok .img, .acep-provider-grok .media { max-width: 100% !important; }

        /* Grok: preserve author-intent line breaks (Grok often uses pre-wrap in the UI). */
        .acep-provider-grok .acep-bubble { white-space: pre-wrap; }
        .acep-provider-grok pre, .acep-provider-grok code { white-space: pre; }

        /* Grok: KaTeX rendering – prefer HTML layer, hide MathML */
        .acep-provider-grok .katex .katex-html { display: inline !important; }
        .acep-provider-grok .katex .katex-mathml { display: none !important; }
        .acep-provider-grok .katex-display { display: block; margin: 0.6em 0; }
        .acep-provider-grok .katex-display > .katex { display: block; }
      `;
    };
    // Standardized hook: accepts optional ctx so popup.js can pass showGrokMarkdownContent.
    g.ACEP.providers.grok.export.normalizeHtmlForExport = function normalizeHtmlForExport(html = '', ctx = {}) {
      const tableFixed = normalizeGrokTableHtml(html);
      const artifactsFixed = replaceGrokArtifactCardsInHtml(tableFixed, ctx);
      // Grok DOM exports sometimes contain raw $...$ / $$...$$ text (no KaTeX DOM). Wrap into data-math placeholders.
      return wrapLatexInGrokHtml(artifactsFixed);
    };
    g.ACEP.providers.grok.export.preProcessRowsForHtmlSelf = preProcessRowsForHtmlSelf;

    // PDF: preserve Grok file-chip attachments (which can show up as non-image `assets.grok.com/.../content` URLs).
    g.ACEP.providers.grok.export.augmentPdfBlocksForRow = function augmentPdfBlocksForRow({ row, blocks, hasAttachmentMarkers } = {}) {
      try {
        if (!row || !Array.isArray(blocks) || !Array.isArray(row.imgs)) return;
        if (hasAttachmentMarkers) return;

        const already = new Set();
        const addFromLine = (line = '') => {
          const m = String(line || '').match(/^\s*\[Attachment\]:\s*(.+?)\s*$/i);
          if (!m) return;
          const name = String(m[1] || '').trim().toLowerCase();
          if (name) already.add(name);
        };
        blocks.forEach((b) => {
          if (!b) return;
          if (b.type === 'text' && b.text) {
            String(b.text).split(/\r?\n/).forEach(addFromLine);
            return;
          }
          if (b.type === 'runs' && Array.isArray(b.runs)) {
            const txt = b.runs.map(r => r?.text || '').join('').replace(/\s+/g, ' ').trim();
            addFromLine(txt);
          }
        });

        const isGrokFileContentUrl = (u = '') => {
          try {
            const parsed = new URL(String(u || ''), 'https://grok.com/');
            if (!/assets\.grok\.com$/i.test(parsed.hostname)) return false;
            const p = parsed.pathname || '';
            if (!/\/content$/i.test(p)) return false;
            if (/\.(png|jpe?g|gif|webp|avif|svg)(\?|#|$)/i.test(p)) return false;
            if (/\/generated\//i.test(p)) return false;
            if (/\/preview-image\b/i.test(p)) return false;
            return true;
          } catch { return false; }
        };
        const looksLikeFilename = (s = '') =>
          /\.(pdf|docx?|pptx?|xlsx?|zip|rar|7z|txt|md|csv|json|html?)(\b|$)/i.test(String(s || '').trim());

        const seenA = new Set();
        row.imgs.forEach((im) => {
          const src = String(im?.originalSrc || im?.src || '').trim();
          const alt = String(im?.alt || '').trim();
          let name = '';
          if (src && isGrokFileContentUrl(src) && looksLikeFilename(alt)) name = alt;
          else if (!src && looksLikeFilename(alt)) name = alt;
          if (!name) return;
          const key = name.toLowerCase();
          if (already.has(key) || seenA.has(key)) return;
          seenA.add(key);
          blocks.push({ type: 'text', text: `[Attachment]: ${name}` });
        });
      } catch {}
    };
    g.ACEP.providers.grok.isProtectedAsset = (u) =>
      /assets\.grok\.com|\/file-icons\//i.test(String(u || ''));

    try { document.documentElement.setAttribute('data-acep-loaded-grok-export', '1'); } catch {}
  } catch {}
})();
