// Claude export-only transforms (runs in extension page context: popup.js).
// Keep Claude-specific sanitizers here so popup.js stays provider-agnostic.
(function initClaudeExport() {
  try {
    const g = (typeof globalThis !== 'undefined') ? globalThis : window;
    g.ACEP = g.ACEP || {};
    g.ACEP.providers = g.ACEP.providers || {};
    g.ACEP.providers.claude = g.ACEP.providers.claude || {};
    g.ACEP.providers.claude.export = g.ACEP.providers.claude.export || {};

    function sanitizeClaudeHtmlForExport(html = '', isClaude = false) {
      try {
        if (!isClaude) return html;
        if (!html || typeof html !== 'string' || typeof DOMParser === 'undefined') return html;
        try {
          html = html.replace(
            /<button\b[^>]*\bclass\s*=\s*(["'])[^"']*\bgroup\/status\b[^"']*\1[\s\S]*?<\/button>/gi,
            ''
          );
        } catch {}
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        const normalizeClaudeCitationLinks = () => {
          try {
            Array.from(doc.querySelectorAll('a[href]')).forEach((a) => {
              try {
                const href = String(a.getAttribute('href') || '').trim();
                if (!/^https?:\/\//i.test(href)) return;
                const cls = String(a.getAttribute('class') || '');
                const raw = cls + ' ' + String(a.innerHTML || '');
                const text = String(a.textContent || '').replace(/\s+/g, ' ').trim();
                const looksClaudeChip = /group\/tag|rounded-full|text-text-300|group-hover\/tag/i.test(raw);
                if (!looksClaudeChip) return;
                const label = text || (() => { try { return new URL(href).hostname.replace(/^www\./i, '').split('.')[0].toUpperCase(); } catch { return 'Source'; } })();
                a.className = 'acep-claude-citation-link';
                a.setAttribute('target', '_blank');
                a.setAttribute('rel', 'noopener noreferrer');
                a.textContent = label;
              } catch {}
            });
          } catch {}
        };
        try {
          const escapeCodeForPre = (value = '') => String(value || '').replace(/[&<>]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[ch]));
          const preStyle = 'background:#f3f4f6;color:#0f172a;border:1px solid #e5e7eb;border-radius:10px;padding:14px 16px;display:block;box-sizing:border-box;max-width:100%;overflow-x:auto;white-space:pre;font-family:"Fira Code","Cascadia Code",Consolas,"Courier New",monospace;font-size:0.88em;line-height:1.6;margin:12px 0;';
          const codeStyle = 'background:transparent;color:inherit;padding:0;border:0;display:block;white-space:pre;font-family:inherit;';
          const sanitizeClaudeCodeBlock = (wrapper) => {
            try {
              if (!wrapper || !wrapper.querySelector) return;
              const sourcePre = wrapper.matches?.('pre') ? wrapper : wrapper.querySelector('pre');
              const sourceCode = sourcePre ? (sourcePre.querySelector('code') || sourcePre) : wrapper.querySelector('code');
              const codeText = String((sourceCode && (sourceCode.textContent || sourceCode.innerText)) || '').replace(/\r\n/g, '\n').replace(/\n+$/g, '');
              if (!codeText.trim()) return;
              const langClass = String(sourceCode?.className || sourcePre?.className || '').match(/language-([a-z0-9_-]+)/i)?.[1] || '';
              const pre = doc.createElement('pre');
              pre.className = 'acep-code-block';
              pre.setAttribute('data-acep-code-block', '1');
              pre.setAttribute('style', preStyle);
              const code = doc.createElement('code');
              if (langClass) code.className = `language-${langClass}`;
              code.setAttribute('style', codeStyle);
              code.innerHTML = escapeCodeForPre(codeText);
              pre.appendChild(code);
              wrapper.replaceWith(pre);
            } catch {}
          };
          Array.from(doc.querySelectorAll('[role="group"][aria-label*="code" i], [aria-label*="markdown code" i]')).forEach(sanitizeClaudeCodeBlock);
          Array.from(doc.querySelectorAll('pre.code-block__code, pre[class*="code-block"], pre:has(code[class*="language-"])')).forEach((pre) => {
            if (pre.closest('[role="group"][aria-label*="code" i], [aria-label*="markdown code" i]')) return;
            sanitizeClaudeCodeBlock(pre);
          });
        } catch {}
        normalizeClaudeCitationLinks();
        const isFaviconSrc = (src = '') => /s2\/favicons|favicon/i.test(src);
        Array.from(doc.querySelectorAll('img')).forEach((img) => {
          const alt = (img.getAttribute('alt') || '').trim();
          const src = (img.getAttribute('src') || '').trim();
          if (/^favicon$/i.test(alt) || isFaviconSrc(src)) {
            try { img.remove(); } catch {}
          }
        });
        try {
          const statusBtnSel = 'button[class*="group/status" i]';
          Array.from(doc.querySelectorAll(statusBtnSel)).forEach((btn) => {
            try {
              const row = btn.closest('.row-start-1,[class*="row-start-1" i]');
              if (row) { row.remove(); return; }
              let wrap = btn.parentElement;
              while (wrap && wrap !== doc.body) {
                const hasMd = !!(wrap.querySelector && wrap.querySelector('.standard-markdown, .progressive-markdown, .markdown, .font-claude-response'));
                if (!hasMd) { wrap.remove(); return; }
                wrap = wrap.parentElement;
              }
              btn.remove();
            } catch {
              try { btn.remove(); } catch {}
            }
          });
        } catch {}
        try {
          Array.from(doc.querySelectorAll('span.truncate.text-sm.font-base')).forEach((s) => {
            try {
              const inStatus = !!(s.closest && s.closest('button[class*="group/status" i]'));
              if (inStatus) { s.remove(); return; }
              const row = s.closest && s.closest('.row-start-1,[class*="row-start-1" i]');
              const hasStatusButton = !!(row && row.querySelector && row.querySelector('button[class*="group/status" i]'));
              if (hasStatusButton) s.remove();
            } catch {}
          });
        } catch {}
        try {
          const convertBulletTextBlock = (el) => {
            try {
              if (!el || el.querySelector?.('ul, ol, table, pre, code')) return;
              const raw = String(el.innerText || el.textContent || '').replace(/\r\n/g, '\n').trim();
              if (!raw || !/^(?:[-*+\u2022]\s+|\d+\.\s+)/m.test(raw)) return;
              const lines = raw.split('\n').map((line) => line.trim()).filter(Boolean);
              if (lines.length < 2) return;
              const unordered = lines.every((line) => /^[-*+\u2022]\s+/.test(line));
              const ordered = lines.every((line) => /^\d+\.\s+/.test(line));
              if (!unordered && !ordered) return;
              const list = doc.createElement(ordered ? 'ol' : 'ul');
              lines.forEach((line) => {
                const item = doc.createElement('li');
                item.textContent = line.replace(ordered ? /^\d+\.\s+/ : /^[-*+\u2022]\s+/, '').trim();
                list.appendChild(item);
              });
              el.replaceWith(list);
            } catch {}
          };
          Array.from(doc.querySelectorAll('p, div')).forEach(convertBulletTextBlock);
          const convertSiblingBulletRuns = (parent) => {
            try {
              if (!parent || !parent.children || parent.querySelector?.('ul, ol')) return;
              const children = Array.from(parent.children || []);
              let index = 0;
              while (index < children.length) {
                const run = [];
                let ordered = false;
                let unordered = false;
                let cursor = index;
                while (cursor < children.length) {
                  const child = children[cursor];
                  const tag = String(child.tagName || '').toUpperCase();
                  if (tag !== 'P' && tag !== 'DIV') break;
                  if (child.querySelector?.('ul, ol, table, pre, code')) break;
                  const text = String(child.textContent || '').replace(/\s+/g, ' ').trim();
                  if (/^[-*+\u2022]\s+/.test(text)) { unordered = true; run.push({ child, text: text.replace(/^[-*+\u2022]\s+/, '').trim() }); cursor++; continue; }
                  if (/^\d+\.\s+/.test(text)) { ordered = true; run.push({ child, text: text.replace(/^\d+\.\s+/, '').trim() }); cursor++; continue; }
                  break;
                }
                if (run.length >= 2 && ((unordered && !ordered) || (ordered && !unordered))) {
                  const list = doc.createElement(ordered ? 'ol' : 'ul');
                  run.forEach(({ text }) => {
                    const item = doc.createElement('li');
                    item.textContent = text;
                    list.appendChild(item);
                  });
                  run[0].child.parentNode.insertBefore(list, run[0].child);
                  run.forEach(({ child }) => { try { child.remove(); } catch {} });
                  index = cursor;
                } else {
                  index++;
                }
              }
            } catch {}
          };
          Array.from(doc.querySelectorAll('.standard-markdown, .progressive-markdown, .font-claude-response, .markdown, .acep-bubble, [data-acep-role]')).forEach(convertSiblingBulletRuns);
        } catch {}
        try {
          Array.from(doc.querySelectorAll('ul, ol')).forEach((list) => {
            try {
              const tag = String(list.tagName || '').toUpperCase();
              const cls = String(list.getAttribute('class') || '')
                .split(/\s+/)
                .filter(Boolean)
                .filter((token) => !/^(flex|inline-flex|grid|list-none|list-decimal|list-disc|flex-col|gap-\d+|pl-\d+|mb-\d+|mt-\d+|pb-\d+)$/i.test(token))
                .join(' ');
              if (cls) list.setAttribute('class', cls); else list.removeAttribute('class');
              list.style.display = 'block';
              list.style.listStyleType = tag === 'OL' ? 'decimal' : 'disc';
              list.style.listStylePosition = 'outside';
              list.style.paddingLeft = '1.6em';
              list.style.margin = '0.75em 0';
            } catch {}
          });
          Array.from(doc.querySelectorAll('li')).forEach((li) => {
            try {
              const cls = String(li.getAttribute('class') || '')
                .split(/\s+/)
                .filter(Boolean)
                .filter((token) => !/^(flex|inline-flex|grid|list-none|pl-\d+|mb-\d+|mt-\d+|gap-\d+)$/i.test(token))
                .join(' ');
              if (cls) li.setAttribute('class', cls); else li.removeAttribute('class');
              li.style.display = 'list-item';
              li.style.paddingLeft = '0.25em';
              li.style.margin = '0.25em 0';
            } catch {}
          });
        } catch {}
        const hasMarkdown = (n) => !!(n && n.querySelector && n.querySelector('.standard-markdown, .progressive-markdown'));
        Array.from(doc.querySelectorAll('p, div, span, li, button')).forEach((el) => {
          const txt = (el.textContent || '').trim();
          if (!/^Fetched:/i.test(txt)) return;
          let target = el.closest('button') || el;
          if (hasMarkdown(target)) {
            try { el.remove(); } catch {}
            return;
          }
          let p = target.parentElement;
          while (p && p !== doc.body) {
            if (hasMarkdown(p)) {
              try { el.remove(); } catch {}
              return;
            }
            p = p.parentElement;
          }
          try { target.remove(); } catch {}
        });
        return doc.body.innerHTML || html;
      } catch {
        return html;
      }
    }

    function sanitizePdfDocDefForClaude(docDef) {
      try {
        if (!docDef || typeof docDef !== 'object') return;
        const cleanText = (t) => {
          if (typeof t !== 'string') return t;
          if (/^\s*Fetched:\s/i.test(t)) return '';
          return t;
        };
        const walk = (node) => {
          if (!node || typeof node !== 'object') return;
          if (Array.isArray(node)) {
            for (let i = node.length - 1; i >= 0; i--) {
              const v = node[i];
              walk(v);
              if (v && typeof v === 'object' && v.text === '') node.splice(i, 1);
            }
            return;
          }
          if (typeof node.text === 'string') node.text = cleanText(node.text);
          if (Array.isArray(node.text)) {
            node.text = node.text.map(r => {
              if (typeof r === 'string') return cleanText(r);
              if (r && typeof r.text === 'string') r.text = cleanText(r.text);
              return r;
            }).filter(r => {
              if (typeof r === 'string') return r.trim();
              if (r && typeof r.text === 'string') return r.text.trim();
              return true;
            });
          }
          Object.keys(node).forEach(k => {
            if (k === 'text') return;
            walk(node[k]);
          });
        };
        walk(docDef);
      } catch {}
    }

    g.ACEP.providers.claude.export.sanitizeClaudeHtmlForExport = sanitizeClaudeHtmlForExport;
    g.ACEP.providers.claude.export.sanitizePdfDocDefForClaude = sanitizePdfDocDefForClaude;
    function buildArtifactLinkFromNode(node, ctx = {}) {
      const dataTitle = node?.getAttribute?.('data-acep-artifact-title') || node?.dataset?.acepArtifactTitle || '';
      const titleSafe = escapeHtml(String(dataTitle || 'Artifact').trim());
      // Use the conversation URL from ctx (reliable); artifact tool-use IDs are not shareable URLs.
      const url = ctx.tabUrl ? escapeHtml(String(ctx.tabUrl)) : '';
      if (url) {
        return `<p>&#128206; <a href="${url}" target="_blank" rel="noopener">${titleSafe}</a></p>`;
      }
      return `<p>&#128206; <strong>${titleSafe}</strong></p>`;
    }

    const _artifactSelector = '[data-acep-artifact-text],[data-acep-artifact-html],[data-acep-artifact-id],[data-acep-artifact-title],[data-acep-artifact-version],[data-acep-role="artifact"]';

    function replaceClaudeArtifactCardsInHtml(html = '', ctx = {}) {
      try {
        if (!html || typeof html !== 'string') return html;
        // Fast-path: if no artifact markers exist, skip parsing.
        if (!/data-acep-artifact-(text|html|id|title|version)/i.test(html) &&
            !/data-acep-role="artifact"/i.test(html)) return html;
        if (typeof DOMParser === 'undefined') return html;

        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        if (!doc || !doc.body) return html;

        const candidates = Array.from(doc.querySelectorAll(_artifactSelector));

        // Replace only the outermost artifact nodes (avoid double replacing nested nodes).
        const roots = candidates.filter((n) => !n.parentElement?.closest?.(_artifactSelector));

        if (!roots.length) return doc.body.innerHTML || html;

        // Artifacts-only export always shows full content; otherwise respect the setting.
        const showFull = !!(ctx.isArtifactsOnly || ctx.showArtifactContent);

        for (const node of roots) {
          const artifactHtml = showFull ? buildArtifactHtmlFromNode(node) : buildArtifactLinkFromNode(node, ctx);
          if (!artifactHtml) continue;
          const tmp = doc.createElement('div');
          tmp.innerHTML = artifactHtml;
          // Replace with all nodes from tmp (preserve wrapper structure returned by builder).
          const fragment = doc.createDocumentFragment();
          while (tmp.firstChild) fragment.appendChild(tmp.firstChild);
          try { node.replaceWith(fragment); } catch {}
        }

        return doc.body.innerHTML || html;
      } catch {
        return html;
      }
    }

    // Provider-agnostic hooks used by popup.js
    g.ACEP.providers.claude.export.normalizeHtmlForExport = function normalizeHtmlForExport(html = '', ctx = {}) {
      const cleaned = sanitizeClaudeHtmlForExport(html, true);
      const nextCtx = { ...(ctx || {}) };
      if (String(nextCtx.format || '').toLowerCase() === 'docx') nextCtx.showArtifactContent = true;
      return replaceClaudeArtifactCardsInHtml(cleaned, nextCtx);
    };

    // Extra CSS injected into exported HTML. Keep it scoped to Claude so it doesn't affect other providers.
    // Goal: make user turns (especially image+text) render as a single bubble and avoid "full-width" wrappers
    // that push the bubble too far to the right.
    g.ACEP.providers.claude.export.getHtmlCss = function getHtmlCss() {
      try {
        return `
/* Claude: remove internal UI truncation/overlays so exported HTML shows full text */
.acep-provider-claude [data-testid="user-message"]{
  max-height:none !important;
}
.acep-provider-claude [data-testid="user-message"] .absolute{
  display:none !important;
}

/* Claude: user turns — contain long/pasted content within the bubble, never overflow page. */
.acep-provider-claude .acep-turn[data-acep-role="user"] > .acep-bubble{
  width: auto;
  max-width: 78% !important;
  overflow: hidden !important;
  overflow-wrap: break-word !important;
  word-break: break-word !important;
  box-sizing: border-box !important;
  white-space: normal !important;
}
/* Force ALL descendants inside user bubble to wrap — covers inline white-space:pre-wrap from Claude's DOM */
.acep-provider-claude .acep-turn[data-acep-role="user"] > .acep-bubble *{
  max-width: 100% !important;
  box-sizing: border-box !important;
  overflow-wrap: break-word !important;
  word-break: break-word !important;
  white-space: normal !important;
}
/* Restore pre-wrap for actual code/pre blocks inside user bubble */
.acep-provider-claude .acep-turn[data-acep-role="user"] > .acep-bubble pre,
.acep-provider-claude .acep-turn[data-acep-role="user"] > .acep-bubble pre *{
  white-space: pre-wrap !important;
}
/* pre/code inside user bubble: wrap instead of extending horizontally */
.acep-provider-claude .acep-turn[data-acep-role="user"] > .acep-bubble pre{
  white-space: pre-wrap !important;
  word-break: break-all !important;
  overflow-x: auto !important;
  max-width: 100% !important;
  box-sizing: border-box !important;
}
.acep-provider-claude .acep-turn[data-acep-role="user"] > .acep-bubble code{
  white-space: pre-wrap !important;
  word-break: break-all !important;
  max-width: 100% !important;
}
/* Long URLs in user prompts */
.acep-provider-claude .acep-turn[data-acep-role="user"] > .acep-bubble a{
  word-break: break-all !important;
  overflow-wrap: break-word !important;
}
.acep-provider-claude .acep-claude-citation-link{
  display:inline-flex !important;
  align-items:center !important;
  max-width:180px !important;
  min-height:18px !important;
  padding:2px 7px !important;
  margin:0 2px !important;
  border-radius:999px !important;
  border:1px solid #d8dee8 !important;
  background:#f1f5f9 !important;
  color:#475569 !important;
  text-decoration:none !important;
  font-size:.78em !important;
  font-weight:600 !important;
  line-height:1.2 !important;
  vertical-align:baseline !important;
  white-space:nowrap !important;
  overflow:hidden !important;
  text-overflow:ellipsis !important;
}
.acep-provider-claude .acep-claude-citation-link:hover{
  background:#ede9fe !important;
  border-color:#c4b5fd !important;
  color:#4c1d95 !important;
}
/* Claude: preserve real list markers. Claude often leaves Tailwind flex/flex-col on lists, which breaks native bullets in exports. */
.acep-provider-claude .acep-turn ul,
.acep-provider-claude .acep-turn ol,
.acep-provider-claude .standard-markdown ul,
.acep-provider-claude .standard-markdown ol,
.acep-provider-claude .progressive-markdown ul,
.acep-provider-claude .progressive-markdown ol{
  display: block !important;
  flex-direction: initial !important;
  gap: 0 !important;
  margin: 0.75em 0 !important;
  padding-left: 1.6em !important;
}
.acep-provider-claude .acep-turn ul,
.acep-provider-claude .standard-markdown ul,
.acep-provider-claude .progressive-markdown ul{
  list-style: disc outside !important;
}
.acep-provider-claude .acep-turn ol,
.acep-provider-claude .standard-markdown ol,
.acep-provider-claude .progressive-markdown ol{
  list-style: decimal outside !important;
}
.acep-provider-claude .acep-turn li,
.acep-provider-claude .standard-markdown li,
.acep-provider-claude .progressive-markdown li{
  display: list-item !important;
  margin: 0.25em 0 !important;
  padding-left: 0.25em !important;
}
.acep-provider-claude .acep-turn ul > li::marker,
.acep-provider-claude .standard-markdown ul > li::marker,
.acep-provider-claude .progressive-markdown ul > li::marker{
  content: normal !important;
}
.acep-provider-claude .acep-turn ul > li::before,
.acep-provider-claude .standard-markdown ul > li::before,
.acep-provider-claude .progressive-markdown ul > li::before{
  content: none !important;
  display: none !important;
}

/* Tables in pasted content */
.acep-provider-claude .acep-turn[data-acep-role="user"] > .acep-bubble table{
  table-layout: fixed !important;
  max-width: 100% !important;
  word-break: break-word !important;
  box-sizing: border-box !important;
}
.acep-provider-claude .acep-turn[data-acep-role="user"] .flex.flex-wrap.justify-end{
  width: fit-content !important;
}

/* Claude: uploaded image tiles sometimes use absolutely-positioned <img> that can overlap following text.
   Force images and their wrappers back into normal flow in exports. */
.acep-provider-claude .acep-turn img{
  position: static !important;
  inset: auto !important;
  float: none !important;
  z-index: auto !important;
  display: block !important;
  max-width: 100% !important;
  height: auto !important;
}
.acep-provider-claude .acep-image-wrap{
  position: static !important;
  display: block !important;
  clear: both !important;
  margin: 10px 0 !important;
  width: 100% !important;
}
/* Claude raster-image alignment: keep uploaded/generated photos left-aligned; preserve SVG/diagram centering below. */
.acep-provider-claude .acep-turn .acep-bubble,
.acep-provider-claude .acep-turn .acep-api-content,
.acep-provider-claude .acep-image-wrap,
.acep-provider-claude .acep-turn .no-scrollbar.flex{
  text-align: left !important;
  justify-content: flex-start !important;
  align-items: flex-start !important;
}
.acep-provider-claude .acep-turn img:not(.role-icon):not(.acep-inline-svg-img){
  margin-left: 0 !important;
  margin-right: auto !important;
}
/* Claude: preserve content that Claude intentionally centered, while keeping normal prose left-aligned. */
.acep-provider-claude .text-center,
.acep-provider-claude [class~="text-center"],
.acep-provider-claude [class~="items-center"],
.acep-provider-claude [class~="justify-center"],
.acep-provider-claude [class~="place-items-center"],
.acep-provider-claude [class~="mx-auto"],
.acep-provider-claude [class*="items-center"],
.acep-provider-claude [class*="justify-center"],
.acep-provider-claude [class*="place-items-center"],
.acep-provider-claude [class*="mx-auto"],
.acep-provider-claude [style*="text-align: center"],
.acep-provider-claude [style*="text-align:center"]{
  text-align: center !important;
  justify-content: center !important;
  align-items: center !important;
  margin-left: auto !important;
  margin-right: auto !important;
}
.acep-provider-claude .text-center > *,
.acep-provider-claude [class~="text-center"] > *,
.acep-provider-claude [class~="items-center"] > *,
.acep-provider-claude [class~="justify-center"] > *,
.acep-provider-claude [class~="place-items-center"] > *,
.acep-provider-claude [class~="mx-auto"] > *,
.acep-provider-claude [class*="items-center"] > *,
.acep-provider-claude [class*="justify-center"] > *,
.acep-provider-claude [class*="place-items-center"] > *,
.acep-provider-claude [class*="mx-auto"] > *{
  margin-left: auto !important;
  margin-right: auto !important;
}
.acep-provider-claude .text-center .katex-display,
.acep-provider-claude [class~="text-center"] .katex-display,
.acep-provider-claude [class~="items-center"] .katex-display,
.acep-provider-claude [class~="justify-center"] .katex-display,
.acep-provider-claude [class~="place-items-center"] .katex-display,
.acep-provider-claude [class~="mx-auto"] .katex-display,
.acep-provider-claude [class*="items-center"] .katex-display,
.acep-provider-claude [class*="justify-center"] .katex-display,
.acep-provider-claude [class*="place-items-center"] .katex-display,
.acep-provider-claude [class*="mx-auto"] .katex-display,
.acep-provider-claude [style*="text-align: center"] .katex-display,
.acep-provider-claude [style*="text-align:center"] .katex-display,
.acep-provider-claude .katex-display[style*="text-align: center"],
.acep-provider-claude .katex-display[style*="text-align:center"]{
  text-align: center !important;
  margin-left: auto !important;
  margin-right: auto !important;
}
/* Override any generic gallery sizing rules (some templates set fixed thumbnail dimensions). */
.acep-provider-claude .acep-turn img[data-acep-claude-upload="1"]{
  width: 100% !important;
  height: auto !important;
  max-width: 100% !important;
  object-fit: contain !important;
  border-radius: 8px !important;
}
.acep-provider-claude .acep-turn .no-scrollbar.flex img[data-acep-claude-upload="1"]{
  width: 100% !important;
  height: auto !important;
  max-width: 100% !important;
  object-fit: contain !important;
  border-radius: 8px !important;
}
.acep-provider-claude .acep-turn[data-acep-role="assistant"] .acep-bubble > img:not(.acep-inline-svg-img):not(.role-icon),
.acep-provider-claude .acep-turn[data-acep-role="assistant"] .acep-api-content > img:not(.acep-inline-svg-img):not(.role-icon),
.acep-provider-claude .acep-turn[data-acep-role="assistant"] .acep-image-wrap > img:not(.acep-inline-svg-img):not(.role-icon){
  width: 100% !important;
  max-width: 100% !important;
  height: auto !important;
  object-fit: contain !important;
  margin-left: 0 !important;
  margin-right: auto !important;
}
.acep-provider-claude .acep-image-wrap *{
  position: static !important;
  inset: auto !important;
  transform: none !important;
}
/* Claude: preserve rich inline SVG diagrams/charts from assistant turns. */
.acep-provider-claude{
  --color-border-secondary: #d1d5db;
  --color-border-tertiary: #e5e7eb;
}
.acep-provider-claude .acep-svg-wrap{
  display: block !important;
  width: 100% !important;
  max-width: 100% !important;
  overflow-x: auto !important;
  margin: 12px 0 !important;
}
.acep-provider-claude .acep-svg-wrap svg,
.acep-provider-claude svg.acep-inline-svg,
.acep-provider-claude .acep-svg-wrap img.acep-inline-svg-img{
  display: block !important;
  width: 100% !important;
  max-width: 680px !important;
  height: auto !important;
  margin: 0 auto !important;
}
.acep-provider-claude .acep-svg-wrap text{
  font-family: inherit !important;
}
.acep-provider-claude .acep-visual-wrap,
.acep-provider-claude #vis-container{
  display: block !important;
  max-width: 100% !important;
  overflow-x: auto !important;
  margin: 12px 0 !important;
  box-sizing: border-box !important;
}
.acep-provider-claude .acep-visual-wrap table,
.acep-provider-claude #vis-container table{
  max-width: 100% !important;
}
.acep-provider-claude .acep-turn[data-acep-role="assistant"] table,
.acep-provider-claude .acep-turn[data-acep-role="assistant"] .standard-markdown table,
.acep-provider-claude .acep-turn[data-acep-role="assistant"] .progressive-markdown table{
  width: 100% !important;
  min-width: 100% !important;
  table-layout: auto !important;
}
.acep-provider-claude .acep-turn[data-acep-role="assistant"] .overflow-x-auto:has(table),
.acep-provider-claude .acep-turn[data-acep-role="assistant"] .acep-artifact-body:has(table){
  width: 100% !important;
  max-width: 100% !important;
}
.acep-provider-claude .acep-mcp-frame-wrap{
  display: block !important;
  width: 100% !important;
  max-width: 760px !important;
  margin: 12px 0 !important;
  border: 1px solid rgba(148,163,184,.35) !important;
  border-radius: 12px !important;
  overflow: hidden !important;
  background: rgba(148,163,184,.08) !important;
}
.acep-provider-claude .acep-mcp-frame-title{
  padding: 8px 10px !important;
  font-weight: 700 !important;
}
.acep-provider-claude .acep-mcp-frame{
  display: block !important;
  width: 100% !important;
  min-height: 420px !important;
  border: 0 !important;
  background: transparent !important;
}
.acep-provider-claude .acep-mcp-frame-link{
  margin: 8px 10px 10px !important;
}
.acep-provider-claude .acep-generated-file-card{
  background: rgba(148,163,184,.10) !important;
  border-color: rgba(148,163,184,.45) !important;
  color: inherit !important;
}
.acep-provider-claude .acep-generated-file-name{
  color: inherit !important;
}
/* Tailwind class token "absolute" can remain in the DOM; neutralize it for exports. */
.acep-provider-claude .acep-turn .absolute{
  position: static !important;
  inset: auto !important;
  transform: none !important;
}
/* Last resort: any inline absolute positioning inside turns becomes static. */
.acep-provider-claude .acep-turn [style*="position: absolute"]{
  position: static !important;
  inset: auto !important;
  top: auto !important;
  right: auto !important;
  bottom: auto !important;
  left: auto !important;
  transform: none !important;
}

/* Claude: avoid nested bubble backgrounds/padding inside our own bubble */
.acep-provider-claude .acep-turn[data-acep-role="user"] :is([class*="bg-bg-" i],[class*="bg-surface" i])[class*="rounded" i]{
  background: transparent !important;
}
.acep-provider-claude .acep-turn[data-acep-role="user"] :is([class*="pl-" i],[class*="px-" i],[class*="py-" i]){
  /* keep layout sane but don't let internal padding create "box inside box" visuals */
  box-sizing: border-box;
}

/* Claude artifacts: render exported artifact content as a clean header + padded block.
   This replaces Claude's UI "card" so exports stay readable and consistent across formats. */
.acep-provider-claude .acep-artifact-wrap{
  margin: 10px 0 14px 0;
  max-width: 100%;
  box-sizing: border-box;
  overflow: hidden;
}
.acep-provider-claude .acep-artifact-heading{
  margin: 0 0 6px 0;
}
.acep-provider-claude .acep-artifact-title{
  font-weight: 700;
  font-size: 1.05em;
  line-height: 1.2;
}
.acep-provider-claude .acep-artifact-version{
  font-size: 0.9em;
  opacity: 0.75;
  margin-top: 2px;
}
.acep-provider-claude .acep-artifact{
  display: block;
  width: 100%;
  border: 0;
  border-radius: 0;
  overflow: visible;
  max-width: 100%;
  box-sizing: border-box;
}
.acep-provider-claude .acep-artifact-body{
  margin: 0;
}
.acep-provider-claude pre.acep-artifact-body{
  border: 1px solid rgba(148,163,184,0.35) !important;
  border-radius: 12px !important;
  white-space: pre;
  overflow-x: auto;
  max-width: 100%;
  box-sizing: border-box;
}
        `.trim();
      } catch {
        return '';
      }
    };
    g.ACEP.providers.claude.export.postProcessPdfDocDef = function postProcessPdfDocDef(docDef) {
      sanitizePdfDocDefForClaude(docDef);
    };
    g.ACEP.providers.claude.export.filterPdfBlocks = function filterPdfBlocks(blocks = []) {
      try {
        if (!Array.isArray(blocks)) return blocks;
        return blocks.filter((b) => {
          if (!b) return false;
          if (b.type === 'text' && typeof b.text === 'string') {
            return !/^\s*Fetched:\s/i.test(b.text.trim());
          }
          if (b.type === 'runs' && Array.isArray(b.runs)) {
            const txt = b.runs.map(r => r?.text || '').join('').trim();
            if (/^\s*Fetched:\s/i.test(txt)) return false;
          }
          return true;
        });
      } catch {
        return blocks;
      }
    };

    // Artifact rendering functions
    function escapeHtml(s = '') {
      return String(s || '').replace(/[&<>"']/g, (m) => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      }[m] || m));
    }

    function sanitizeMessageHTML(html = '') {
      try {
        if (!html || typeof html !== 'string' || typeof DOMParser === 'undefined') return String(html || '');
        const parser = new DOMParser();
        const doc = parser.parseFromString(String(html || ''), 'text/html');
        if (!doc) return String(html || '');

        // Remove dangerous/unwanted nodes
        const kill = [
          'script',
          'style',
          'link',
          'meta',
          'iframe',
          'object',
          'embed',
          'noscript',
        ];
        try { doc.querySelectorAll(kill.join(',')).forEach((n) => n.remove()); } catch {}

        // Remove on* handlers + javascript: URLs
        try {
          doc.querySelectorAll('*').forEach((el) => {
            try {
              for (const attr of Array.from(el.attributes || [])) {
                const name = String(attr.name || '').toLowerCase();
                const val = String(attr.value || '');
                if (name.startsWith('on')) el.removeAttribute(attr.name);
                if ((name === 'href' || name === 'src') && /^\s*javascript:/i.test(val)) el.removeAttribute(attr.name);
              }
            } catch {}
          });
        } catch {}

        try { doc.body.querySelectorAll('#action-btns,#copy-toast,.more-item,[id*="popover" i]').forEach((n) => n.remove()); } catch {}
        try {
          const normalizeStyleVars = (value = '') => String(value || '')
            .replace(/var\(--color-background-primary\)/gi, '#111827')
            .replace(/var\(--color-background-secondary\)/gi, '#1f2937')
            .replace(/var\(--color-border-tertiary\)/gi, '#374151')
            .replace(/var\(--color-border-secondary\)/gi, '#4b5563')
            .replace(/var\(--color-text-secondary\)/gi, '#d1d5db')
            .replace(/var\(--color-text-primary\)/gi, '#f9fafb')
            .replace(/var\(--border-radius-lg\)/gi, '12px');
          doc.body.querySelectorAll('[style]').forEach((el) => {
            try { el.setAttribute('style', normalizeStyleVars(el.getAttribute('style') || '')); } catch {}
          });
        } catch {}
        try {
          const escapeCode = (value = '') => String(value || '').replace(/[&<>]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[ch]));
          const codeStyle = 'background:#f3f4f6;color:#0f172a;border:1px solid #e5e7eb;border-radius:10px;padding:14px 16px;display:block;box-sizing:border-box;max-width:100%;overflow-x:auto;white-space:pre;font-family:"Fira Code","Cascadia Code",Consolas,"Courier New",monospace;font-size:0.88em;line-height:1.6;margin:12px 0;';
          const normalizeCodeWrapper = (wrapper) => {
            if (!wrapper || !wrapper.querySelector) return;
            const sourcePre = wrapper.matches?.('pre') ? wrapper : wrapper.querySelector('pre');
            const sourceCode = sourcePre ? (sourcePre.querySelector('code') || sourcePre) : wrapper.querySelector('code');
            const codeText = String((sourceCode && (sourceCode.textContent || sourceCode.innerText)) || '').replace(/\r\n/g, '\n');
            if (!codeText.trim()) return;
            const langClass = String(sourceCode?.className || sourcePre?.className || '').match(/language-([a-z0-9_-]+)/i)?.[1] || '';
            const pre = doc.createElement('pre');
            pre.className = 'acep-code-block';
            pre.setAttribute('style', codeStyle);
            const code = doc.createElement('code');
            if (langClass) code.className = `language-${langClass}`;
            code.setAttribute('style', 'background:transparent;color:inherit;padding:0;border:0;display:block;white-space:pre;font-family:inherit;');
            code.innerHTML = escapeCode(codeText.replace(/\n+$/g, ''));
            pre.appendChild(code);
            wrapper.replaceWith(pre);
          };
          Array.from(doc.body.querySelectorAll('[role="group"][aria-label*="code" i]')).forEach(normalizeCodeWrapper);
          Array.from(doc.body.querySelectorAll('pre.code-block__code, pre[class*="code-block"]')).forEach((pre) => {
            if (pre.closest('[role="group"][aria-label*="code" i]')) return;
            normalizeCodeWrapper(pre);
          });
        } catch {}
        try {
          const visual = doc.body.querySelector('#vis-container, .acep-visual-wrap');
          if (visual) return visual.outerHTML || '';
        } catch {}

        return (doc.body && doc.body.innerHTML) ? doc.body.innerHTML : String(html || '');
      } catch {
        return String(html || '');
      }
    }

    function renderArtifactMarkdownHtml(md = '') {
      const esc = (s='') => s.replace(/[&<>"']/g,m=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[m]));
      const inline = (s='') => {
        s = s.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
        s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
        s = s.replace(/(^|[^\*])\*([^*]+)\*/g, '$1<em>$2</em>');
        s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
        return s;
      };
      const lines = String(md || '').replace(/\r\n/g, '\n').split('\n');
      let out = '';
      let i = 0;
      const parseTable = (start) => {
        const rows = [];
        let j = start;
        while (j < lines.length && /\|/.test(lines[j])) { rows.push(lines[j]); j++; }
        if (rows.length < 2) return null;
        if (!/^\s*\|?[\s:-]+\|/.test(rows[1])) return null;
        const parseRow = (row) => row.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(c => inline(esc(c.trim())));
        const header = parseRow(rows[0]);
        const body = rows.slice(2).map(parseRow);
        const thead = `<thead><tr>${header.map(h => `<th>${h}</th>`).join('')}</tr></thead>`;
        const tbody = `<tbody>${body.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody>`;
        return { html: `<table>${thead}${tbody}</table>`, next: start + rows.length };
      };
      while (i < lines.length) {
        const line = lines[i];
        if (/^\s*```/.test(line)) {
          let code = '';
          i++;
          while (i < lines.length && !/^\s*```/.test(lines[i])) { code += lines[i] + '\n'; i++; }
          out += `<pre><code>${esc(code.trimEnd())}</code></pre>`;
          i++;
          continue;
        }
        const tbl = parseTable(i);
        if (tbl) { out += tbl.html; i = tbl.next; continue; }
        if (/^\s*#{1,6}\s+/.test(line)) {
          const level = (line.match(/^\s*#{1,6}\s+/) || [,'#'])[1].length;
          const text = line.replace(/^\s*#{1,6}\s+/, '').trim();
          out += `<h${level}>${inline(esc(text))}</h${level}>`;
          i++; continue;
        }
        if (/^\s*[-*+\u2022]\s+/.test(line)) {
          const items = [];
          while (i < lines.length && /^\s*[-*+\u2022]\s+/.test(lines[i])) { items.push(lines[i].replace(/^\s*[-*+\u2022]\s+/, '').trim()); i++; }
          out += `<ul>${items.map(it => `<li>${inline(esc(it))}</li>`).join('')}</ul>`;
          continue;
        }
        if (/^\s*\d+\.\s+/.test(line)) {
          const items = [];
          while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) { items.push(lines[i].replace(/^\s*\d+\.\s+/, '').trim()); i++; }
          out += `<ol>${items.map(it => `<li>${inline(esc(it))}</li>`).join('')}</ol>`;
          continue;
        }
        if (!line.trim()) { i++; continue; }
        const buf = [];
        while (i < lines.length && lines[i].trim()) { buf.push(lines[i]); i++; }
        const text = buf.join(' ').trim();
        if (text) out += `<p>${inline(esc(text))}</p>`;
      }
      return out;
    }

    function buildArtifactHtmlFromNode(node) {
      const dataText = node?.getAttribute?.('data-acep-artifact-text') || node?.dataset?.acepArtifactText || '';
      const dataTitle = node?.getAttribute?.('data-acep-artifact-title') || node?.dataset?.acepArtifactTitle || '';
      const dataVer = node?.getAttribute?.('data-acep-artifact-version') || node?.dataset?.acepArtifactVersion || '';
      const dataHtml = node?.getAttribute?.('data-acep-artifact-html') || node?.dataset?.acepArtifactHtml || '';
      const dataIsCode = (node?.getAttribute?.('data-acep-artifact-is-code') || node?.dataset?.acepArtifactIsCode) === '1';
      const isGrok = /grok\.com$/i.test(window.location?.host || '');
      const titleRaw = String(dataTitle || '').trim();
      const verRaw = String(dataVer || '').trim();
      const titleSafe = escapeHtml(titleRaw);
      const verSafe = escapeHtml(verRaw);
      // Fallback for API-path artifacts: content is embedded in <pre><code> children, not in data attributes.
      const _preCodeFallback = (!dataText && !dataHtml && node?.querySelector)
        ? ((node.querySelector('pre code') || node.querySelector('pre'))?.textContent || '').trim()
        : '';
      const _childHtmlFallback = (!dataText && !dataHtml && node?.querySelector)
        ? (() => {
            try {
              const bodyNode = node.matches?.('.acep-artifact') ? node : node.querySelector('.acep-artifact');
              if (!bodyNode) return '';
              const clone = bodyNode.cloneNode(true);
              clone.querySelectorAll?.('.acep-artifact-header,.acep-artifact-heading').forEach(el => el.remove());
              return String(clone.innerHTML || '').trim();
            } catch {
              return '';
            }
          })()
        : '';
      const textRaw = String(dataText || _preCodeFallback || '').trim();
      const htmlRaw = String(dataHtml || _childHtmlFallback || '').trim();
      const headerParts = [];
      const normTitle = titleRaw.replace(/_/g, ' ').replace(/\.md$/i, '').trim().toLowerCase();
      const firstHeading = (textRaw.match(/^#{1,6}\s*(.+)$/m) || [,''])[1].trim().toLowerCase();
      const hasMatchingHeading = !!(normTitle && firstHeading && firstHeading === normTitle);
      // Use semantic tags so PDF/DOCX/MD conversions preserve emphasis.
      // Wrap in <p> so our block parser emits styled runs (MD uses ** / _ via runs).
      if (titleSafe && !(isGrok && hasMatchingHeading)) headerParts.push(`<p class="acep-artifact-title"><strong>${titleSafe}</strong></p>`);
      if (verSafe && !isGrok) headerParts.push(`<p class="acep-artifact-version"><em>${verSafe}</em></p>`);
      const header = headerParts.length ? `<div class="acep-artifact-header">${headerParts.join('')}</div>` : '';
      let body = '';
      let bodyIsRichHtml = false;
      const embeddedSvgHtml = (() => {
        try {
          return Array.from(node?.querySelectorAll?.('.acep-svg-wrap') || [])
            .map((wrap) => wrap.outerHTML || '')
            .filter(Boolean)
            .join('');
        } catch {
          return '';
        }
      })();
      if (embeddedSvgHtml) {
        body = `<div class="acep-artifact-body">${embeddedSvgHtml}</div>`;
        bodyIsRichHtml = true;
      } else if (textRaw || htmlRaw) {
        const htmlLooksSvg = !!(htmlRaw && /acep-svg-wrap|acep-inline-svg-img|data-acep-svg|data:image\/svg\+xml|<svg\b/i.test(htmlRaw));
        const htmlLooksRich = !!(htmlRaw && /<(div|p|h\d|ul|ol|blockquote|strong|em|u|a|table|img|svg)\b/i.test(htmlRaw));
        const htmlLooksCode = !!(htmlRaw && (/<(pre|code)\b/i.test(htmlRaw) || /\bcode-block__code\b/i.test(htmlRaw) || /\blanguage-[a-z0-9_-]+\b/i.test(htmlRaw) || /\bshiki\b/i.test(htmlRaw)));
        const looksLikeCodeText = (s = '') => {
          const t = String(s || '');
          if (!t) return false;
          // Strong signals for HTML/source artifacts
          if (/<!DOCTYPE\s+html/i.test(t)) return true;
          if (/<html[\s>]/i.test(t) && /<\/html>/i.test(t)) return true;
          if (/<(head|body|script|style)[\s>]/i.test(t)) return true;
          // Generic code heuristics: multiple lines + common tokens
          const lines = t.split(/\r?\n/);
          if (lines.length >= 6) {
            const hits =
              (/\b(function|const|let|var|class|import|export|return|async|await)\b/.test(t) ? 1 : 0) +
              ((t.match(/[{};]/g) || []).length >= 6 ? 1 : 0) +
              ((t.match(/<\/?[a-z][a-z0-9-]*[\s>]/gi) || []).length >= 4 ? 1 : 0);
            if (hits >= 2) return true;
          }
          return false;
        };
        const isCode = !!dataIsCode || !!_preCodeFallback || htmlLooksCode || /```/.test(textRaw) || looksLikeCodeText(textRaw);
        if (htmlLooksSvg) {
          body = `<div class="acep-artifact-body">${sanitizeMessageHTML(htmlRaw)}</div>`;
          bodyIsRichHtml = true;
        } else if (!isCode && htmlLooksRich) {
          body = `<div class="acep-artifact-body">${sanitizeMessageHTML(htmlRaw)}</div>`;
          bodyIsRichHtml = true;
        } else if (!isCode) {
          const plain = textRaw || String(htmlToPlainText(htmlRaw) || '').trim();
          // Claude: even when it's not code, render plain-text artifacts inside a padded pre/code block.
          // This makes artifacts easier to scan and prevents "flat" PDF rendering.
          const isClaude = /claude\.ai$/i.test(window.location?.host || '');
          if (isClaude && !htmlLooksRich) {
            body = `<pre class="acep-artifact-body"><code>${escapeHtml(plain)}</code></pre>`;
          } else {
            // Default: preserve formatting via markdown rendering.
            body = `<div class="acep-artifact-body">${renderArtifactMarkdownHtml(plain)}</div>`;
            bodyIsRichHtml = true;
          }
        } else if (textRaw) {
          // Keep code artifacts as code blocks so PDF/DOCX can style them.
          body = `<pre class="acep-artifact-body"><code>${escapeHtml(textRaw)}</code></pre>`;
        } else {
          // Code-like HTML only (no plain text captured); keep sanitized HTML.
          body = `<div class="acep-artifact-body">${sanitizeMessageHTML(htmlRaw)}</div>`;
        }
      }
      // Put title/version outside the body. Rich HTML/table artifacts must not be re-boxed,
      // otherwise Claude visuals and normal tables look like small generated-image cards.
      const outerHeader = header ? `<div class="acep-artifact-heading">${header}</div>` : '';
      if (bodyIsRichHtml) return `${outerHeader}${body || ''}`;
      const boxedBody = body ? `<div class="acep-artifact">${body}</div>` : '';
      return `<div class="acep-artifact-wrap">${outerHeader}${boxedBody}</div>`;
    }

    function getSelectedArtifactNodesInTurn(turnEl, selectedSet) {
      if (!selectedSet || !turnEl?.querySelectorAll) return [];
      const nodes = Array.from(turnEl.querySelectorAll('[data-acep-role="artifact"][data-acep-turn-id]'));
      return nodes.filter(n => selectedSet.has(String(n.getAttribute('data-acep-turn-id') || '')));
    }

    g.ACEP.providers.claude.export.renderArtifactMarkdownHtml = renderArtifactMarkdownHtml;
    g.ACEP.providers.claude.export.buildArtifactHtmlFromNode = buildArtifactHtmlFromNode;
    g.ACEP.providers.claude.export.getSelectedArtifactNodesInTurn = getSelectedArtifactNodesInTurn;

    g.ACEP.providers.claude.isProtectedAsset = (u) =>
      /claude\.ai|files\.claude-uploads\.anthropic\.com/i.test(String(u || ''));

  } catch (e) {
    console.error('[ACEP] Claude export init error:', e);
  }
})();
