// Grok provider logic (content script side).
// This file should contain ONLY Grok-specific DOM logic.
(function initGrokProvider() {
  try {
    const g = (typeof globalThis !== 'undefined') ? globalThis : window;
    if (!/(^|\.)grok\.com$/i.test(String(location?.hostname || ''))) return;
    if (!g.ACEP) g.ACEP = {};
    if (!g.ACEP.providers) g.ACEP.providers = {};
    g.ACEP.providers.grok = g.ACEP.providers.grok || {};

    const env = g.ACEP.env || {};
    const sel = (g.ACEP.providers.grok && g.ACEP.providers.grok.sel) || {};
    const getThreadContainer = (g.ACEP.providers.grok && g.ACEP.providers.grok.getThreadContainer) || (() => (document.querySelector('main') || document.body));
    const ORIGIN = (env && env.ORIGIN) ? env.ORIGIN : (location && location.origin) ? String(location.origin) : '';

    function debugStore(name, value) {
      try {
        g.ACEP.providers.grok.__debug = g.ACEP.providers.grok.__debug || {};
        g.ACEP.providers.grok.__debug[name] = value;
      } catch {}
      try {
        const slugBase = String(name || '').toLowerCase().replace(/[^a-z0-9_-]+/g, '-');
        const k1 = `data-acep-grok-${slugBase}`;
        const v = (typeof value === 'string') ? value : JSON.stringify(value);
        if (typeof v === 'string' && v.length <= 800) document.documentElement.setAttribute(k1, v);
      } catch {}
    }

    function debugSetAttr(key, val, limit = 1200) {
      try {
        const v = (typeof val === 'string') ? val : JSON.stringify(val);
        if (typeof v !== 'string') return;
        const s = v.length > limit ? (v.slice(0, limit) + '…') : v;
        document.documentElement.setAttribute(key, s);
      } catch {}
    }

    const escapeHtml = (s = '') => String(s || '').replace(/[&<>"']/g, (m) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[m]));
    const escapeAttr = (s = '') => escapeHtml(s).replace(/`/g, '&#96;');

    function normalizeAbsUrl(src) {
      try {
        const s = String(src || '').trim();
        if (!s) return '';
        if (/^(https?:|data:|blob:)/i.test(s)) return s;
        if (/^\/?users\/.+\/(?:generated\/.+|[^/]+\/preview-image|[^/]+\/content)(?:[?#].*)?$/i.test(s)) {
          return `https://assets.grok.com/${s.replace(/^\/+/, '')}`;
        }
        if (/^\/?generated\/.+/i.test(s)) {
          return `https://assets.grok.com/${s.replace(/^\/+/, '')}`;
        }
        return new URL(s, ORIGIN).href;
      } catch {
        return String(src || '').trim();
      }
    }

    function extractChipFilename(chip) {
      try {
        const t = (chip?.querySelector?.('span.truncate')?.innerText || chip?.innerText || '')
          .replace(/\u00a0/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();
        if (!t) return '';
        const m = t.match(/(.+?\.(?:pdf|docx?|pptx?|xlsx?|zip|rar|7z|txt|md|csv|json|png|jpe?g|gif|webp|bmp|svg|mp4|mov|avi|mkv))\b/i);
        return (m && m[1]) ? m[1].trim() : '';
      } catch {
        return '';
      }
    }

    function appendFileChipsAsAttachments(scope, userWrap) {
      try {
        if (!scope || !scope.querySelectorAll || !userWrap) return;
        const chips = Array.from(scope.querySelectorAll(sel.fileChipAny || '[class*="group/chip" i], [class*="chip" i]'));
        for (const chip of chips) {
          const fig = chip.querySelector && chip.querySelector('figure[style*="file-icons" i], [style*="file-icons" i]');
          const style = (fig && fig.getAttribute && fig.getAttribute('style')) ? String(fig.getAttribute('style') || '') : '';
          const chipStyle = (chip.getAttribute && chip.getAttribute('style')) ? String(chip.getAttribute('style') || '') : '';
          const hasFileIcon = /file-icons/i.test(style) || /file-icons/i.test(chipStyle);
          if (!hasFileIcon) continue;
          const fname = extractChipFilename(chip);
          if (!fname) continue;
          const marker = document.createElement('div');
          marker.setAttribute('data-acep-attachment-name', fname);
          userWrap.appendChild(marker);
        }
      } catch {}
    }

    function appendImages(scope, wrap) {
      try {
        if (!scope || !scope.querySelectorAll || !wrap) return;
        const nodes = Array.from(scope.querySelectorAll([
          'img',
          'picture source[srcset]',
          'a[href]'
        ].join(', ')));
        const seen = new Set();
        const push = (src, alt = '') => {
          let s = normalizeAbsUrl(src);
          if (!s) return;
          if (!/assets\.grok\.com/i.test(s) && !/\/preview-image\b/i.test(s)) return;
          const key0 = s.split('#')[0];
          const key = key0.includes('?') ? key0.slice(0, key0.indexOf('?')) : key0;
          if (!key || seen.has(key)) return;
          seen.add(key);
          const img = document.createElement('img');
          img.setAttribute('src', s);
          img.setAttribute('data-original-src', s);
          img.setAttribute('alt', alt || '');
          img.style.maxWidth = '100%';
          img.style.display = 'block';
          wrap.appendChild(img);
        };
        nodes.forEach((n) => {
          try {
            if (n.tagName === 'IMG') {
              // Prefer highest-res srcset entry; fall back to currentSrc/src
              const srcset = n.getAttribute('srcset') || '';
              const bestSrc = (() => {
                if (!srcset) return '';
                const entries = srcset.split(',').map(e => e.trim().split(' ')[0]?.trim()).filter(Boolean);
                return entries[entries.length - 1] || '';
              })();
              push(bestSrc || n.currentSrc || n.getAttribute('src') || '', n.getAttribute('alt') || '');
            } else if (n.tagName === 'A') {
              push(n.getAttribute('href') || '', n.getAttribute('aria-label') || '');
            } else if (n.tagName === 'SOURCE') {
              const set = (n.getAttribute('srcset') || '').trim();
              // Take last srcset entry (highest resolution) not first (lowest)
              const entries = set.split(',').map(e => e.trim().split(' ')[0]?.trim()).filter(Boolean);
              const best = entries[entries.length - 1] || entries[0];
              if (best) push(best, '');
            }
          } catch {}
        });
      } catch {}
    }

    function extractSelectableTurnNodes() {
      try {
        if (!env.isGrok || !env.isGrok()) return [];
        const roots = Array.from(document.querySelectorAll(sel.responseRoot || '[id^="response-"]'));
        const out = [];
        roots.forEach(r => {
          if (!r) return;
          const cls = (r.className || '');
          if (/\bitems-end\b/.test(cls)) r.setAttribute('data-acep-role', 'user');
          if (/\bitems-start\b/.test(cls)) r.setAttribute('data-acep-role', 'assistant');
          out.push(r);
        });
        return out;
      } catch {
        return [];
      }
    }

    // --- API-first helpers ---

    function getChatConvId() {
      try {
        const href = String(location?.href || '');
        const fromUrl = (u) => {
          try {
            const url = new URL(String(u || ''), location.origin);
            const path = String(url.pathname || '');
            // Common Grok routes (these have changed a few times):
            // - /chat/{conversationId}
            // - /c/{conversationId}
            // - /conversation/{conversationId}
            const m = path.match(/\/(?:chat|c|conversation)\/([a-zA-Z0-9_-]{6,})/i);
            if (m && m[1]) return m[1];
            // Fallback: allow a bare id after the first segment (e.g., /app/{id})
            const segs = path.split('/').filter(Boolean);
            if (segs.length >= 2 && /^[a-zA-Z0-9_-]{6,}$/.test(segs[1])) return segs[1];
            // Query param fallbacks
            const qp = url.searchParams;
            const keys = ['conversationId', 'conversation', 'convId', 'id'];
            for (const k of keys) {
              const v = (qp.get(k) || '').trim();
              if (v && /^[a-zA-Z0-9_-]{6,}$/.test(v)) return v;
            }
          } catch {}
          return '';
        };

        let id = fromUrl(href);
        if (id) return id;

        // Some pages expose canonical/og URLs with the real conversation id.
        try {
          const canonical = document.querySelector('link[rel="canonical"]')?.getAttribute('href') || '';
          id = fromUrl(canonical);
          if (id) return id;
        } catch {}
        try {
          const og = document.querySelector('meta[property="og:url"], meta[name="og:url"]')?.getAttribute('content') || '';
          id = fromUrl(og);
          if (id) return id;
        } catch {}
      } catch {}
      return '';
    }

    function markdownToHtmlGrok(md = '') {
      if (!md) return '';
      const esc = escapeHtml;
      const normalizeMd = (t0 = '') => {
        let t = String(t0 || '').replace(/\r\n/g, '\n');
        t = t.replace(/[\u200b\u2060\ufeff\u200d]/g, '');
        t = t.replace(/&#96;|&grave;|Â´|´/g, '`');
        t = t.replace(/^[ \t]*[•‣◦⁃–—‑‒]\s+/gm, '- ');
        return t;
      };
      const s = normalizeMd(md);
      const lines = s.split('\n');
      let out = '';
      let i = 0;

      // Pre-normalize: if triple-backtick fences appear "indented" (common in Grok lists),
      // strip leading spaces before the fence so the block parser reliably catches it.
      // Also normalize 4-backtick fences to triple (rare, but shows up in some Grok outputs).
      // We only rewrite when the fence is the first non-space content on the line.
      // Grok sometimes inserts invisible characters between backticks (or uses a "lookalike" backtick).
      // Make fence detection tolerant by allowing zero-width characters between the ticks.
      // We support both ASCII backtick (`) and the acute accent (´) which can appear in some copies.
      // NOTE: fence normalization now happens in `normalizeMd` above; keep fence detection simple.
      const stripZw = (s0 = '') => String(s0 || '').replace(/[\u200b\u2060\ufeff\u200d]/g, '');
      const normTicks = (s0 = '') => stripZw(String(s0 || '')).replace(/´/g, '`');
      const fenceInfo = (line0 = '') => {
        const norm = normTicks(line0).trimStart();
        // Accept fences written as literal backticks or HTML entity forms.
        // Some Grok responses (or intermediary transforms) can emit &#96; sequences.
        const normEnt = norm.replace(/&#96;|&grave;/g, '`');
        if (!normEnt.startsWith('```')) return null;
        const m = normEnt.match(/^`{3,}/);
        if (!m) return null;
        const rest = normEnt.slice(m[0].length);
        return { norm: '```' + rest, rest };
      };
      const isFenceLine = (line0 = '') => !!fenceInfo(line0);
      for (let li = 0; li < lines.length; li++) {
        const info = fenceInfo(lines[li] || '');
        if (!info) continue;
        lines[li] = info.norm;
      }

      // Inline formatting (ONLY for non-code segments).
      // Important: do NOT run $...$ math substitution on raw markdown globally because it breaks code blocks,
      // especially template strings like `${rating}` (common in JS) which look like `$...$`.
      const inline = (s) => {
        // Normalize escaped list markers like `2\.` so ordered lists render correctly.
        s = s.replace(/^(\s*\d+)\s*\\\./g, '$1.');

        // If the entire line is wrapped in backticks, it's almost certainly a "pseudo code line"
        // and should not be treated as inline code. Grok sometimes backticks bullet lines like:
        // `- **Correction**: ...`
        // Rendering that as <code> causes code styling to bleed into normal text.
        const wholeBackticked = (() => {
          const t = String(s || '').trim();
          if (!t.startsWith('`') || !t.endsWith('`') || t.length < 3) return '';
          const inner = t.slice(1, -1).trim();
          // If it looks like markdown/list content, treat it as plain text.
          if (/^[-*+]\s+/.test(inner) || /^\d+(?:\.|\)|\s+-)\s+/.test(inner) || /^#{1,6}\s+/.test(inner) || /^\*\*[^*]+\*\*:/.test(inner)) return inner;
          return '';
        })();
        if (wholeBackticked) s = wholeBackticked;

        s = s.replace(/!\[([^\]]*)\]\((https?:\/\/[^\s)]+|\/[^\s)]+)\)/g, (_m, alt, url) =>
          `<img src="${esc(url)}" data-original-src="${esc(url)}" alt="${esc(alt)}">`);
        s = s.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
        s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
        s = s.replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>');

        // Inline code: `...`
        // Do this BEFORE math substitution, and then run math substitution only outside <code>...</code>.
        // IMPORTANT: if the text contains a fenced code marker (```), do NOT run single-backtick parsing.
        // When fence detection misses, single-backtick parsing will corrupt the fence and split template literals.
        if (!String(s || '').includes('```')) {
          s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
        }

        // Inline math: $...$ (avoid currency false-positives, and avoid JS template `${...}`).
        // IMPORTANT: Never render math inside inline code; it breaks code formatting and can split blocks.
        const applyMathOutsideCode = (htmlish) => {
          const src = String(htmlish || '');
          if (!src.includes('$') || !src.includes('data-math') && !/\$[^$\n]{1,300}\$/.test(src)) return src;
          const parts = src.split(/(<code>[\s\S]*?<\/code>)/g);
          for (let idx = 0; idx < parts.length; idx++) {
            const part = parts[idx];
            if (!part || part.startsWith('<code>')) continue;
            // IMPORTANT: exclude JS template-string markers `${...}`. Those contain `$` and can contain
            // multiple `${...}` in one line, which would otherwise match as a fake "$...$" math span.
            parts[idx] = part.replace(/(?<![\\$\d])\$(?!\{)([^$\n]{1,300})\$(?!\d)/g, (_m, tex) => {
              const t = String(tex || '');
              if (!t.trim()) return '';
              return `<span class="math-inline katex" data-math="${esc(t)}">$${esc(t)}$</span>`;
            });
          }
          return parts.join('');
        };
        s = applyMathOutsideCode(s);
        return s;
      };

      // Grok sometimes outputs "pseudo code blocks" as many lines, each wrapped in single backticks,
      // e.g.:
      // `javascript   import x from 'y';`
      // `const a = 1;`
      // Rendering each line as inline <code> produces the "line-by-line padded boxes" artifact.
      // Detect runs of these and convert them into a single <pre><code>...</code></pre>.
      const isPseudoCodeLine = (l = '') => {
        const t = String(l || '').trim();
        if (!t) return false;
        if (isFenceLine(t)) return false; // real fenced block
        return t.startsWith('`') && t.endsWith('`') && t.length >= 3;
      };
      // Similar issue, but inside list items, where each list item is a single backticked "line":
      // 1) `javascript  ...`
      // 2) `...`
      // - `...`
      const extractBacktickedListLine = (l = '') => {
        const t = String(l || '').trimEnd();
        // ordered list marker
        let m = t.match(/^\s*\d+(?:\.|\)|\s+-)\s+`([\s\S]+)`\s*$/);
        if (m && m[1]) return String(m[1]).trimEnd();
        // unordered bullet marker
        m = t.match(/^\s*(?:[-*+]|â€¢)\s+`([\s\S]+)`\s*$/);
        if (m && m[1]) return String(m[1]).trimEnd();
        return '';
      };
      const stripBackticks = (l = '') => String(l || '').trim().replace(/^`+/, '').replace(/`+$/, '').trimEnd();
      const guessLang = (l = '') => {
        const head = String(l || '').trim().toLowerCase();
        const first = head.split(/\s+/)[0] || '';
        const known = new Set(['js','javascript','ts','typescript','bash','sh','shell','python','py','json','yaml','yml','html','css','sql','go','rust','java','c','cpp','c++','c#','cs','php','ruby','rb']);
        return known.has(first) ? first : '';
      };
      while (i < lines.length) {
        const line = lines[i];
        if (isFenceLine(line)) {
          const norm = fenceInfo(line)?.norm || String(line || '').trimStart();
          const lang = (String(norm).match(/^```(\S*)/) || [, ''])[1];
          let code = '';
          i++;
          while (i < lines.length && !isFenceLine(lines[i])) { code += lines[i] + '\n'; i++; }
          out += `<pre><code${lang ? ` class="language-${esc(lang)}"` : ''}>${esc(code.trimEnd())}</code></pre>`;
          i++; continue;
        }
        // List-backed pseudo code block: many consecutive list items where each item is a single backticked "line".
        // Convert those runs into a single code block so we don't render each as padded inline <code>.
        try {
          const first = extractBacktickedListLine(line);
          if (first) {
            const run = [];
            while (i < lines.length) {
              const v = extractBacktickedListLine(lines[i]);
              if (!v) break;
              run.push(v);
              i++;
            }
            if (run.length >= 2) {
              let lang = guessLang(run[0]);
              let bodyLines = run;
              if (lang && run[0].length <= 30) bodyLines = run.slice(1);
              const body = bodyLines.join('\n').trimEnd();
              if (body) out += `<pre><code${lang ? ` class="language-${esc(lang)}"` : ''}>${esc(body)}</code></pre>`;
              continue;
            } else {
              // Single backticked list item: render as a normal list item (inline code),
              // letting the list parser handle it below.
              i -= run.length;
            }
          }
        } catch {}
        // Pseudo code-block run: N consecutive single-backtick lines
        if (isPseudoCodeLine(line)) {
          const run = [];
          while (i < lines.length && isPseudoCodeLine(lines[i])) {
            run.push(stripBackticks(lines[i]));
            i++;
          }
          if (run.length >= 2) {
            let lang = guessLang(run[0]);
            let bodyLines = run;
            if (lang && run[0].length <= 30) bodyLines = run.slice(1);
            const body = bodyLines.join('\n').trimEnd();
            if (body) out += `<pre><code${lang ? ` class="language-${esc(lang)}"` : ''}>${esc(body)}</code></pre>`;
            continue;
          }
          // Single line: fall through to normal paragraph handling
          i -= run.length;
        }
        // Block math $$...$$ (non-code only). Convert to KaTeX placeholder.
        // We support it line-based here to avoid affecting code blocks.
        if (/^\s*\$\$\s*$/.test(line)) {
          let tex = '';
          i++;
          while (i < lines.length && !/^\s*\$\$\s*$/.test(lines[i])) { tex += lines[i] + '\n'; i++; }
          const t = String(tex || '').trim();
          if (t) out += `<div class="math-block katex-display" data-math="${esc(t)}">$$${esc(t)}$$</div>`;
          i++; continue;
        }
        if (/^\s*#{1,6}\s+/.test(line)) {
          const level = (line.match(/^\s*(#{1,6})\s+/) || [, '#'])[1].length;
          out += `<h${level}>${inline(esc(line.replace(/^\s*#{1,6}\s+/, '').trim()))}</h${level}>`;
          i++; continue;
        }
        if (/^\s*---+\s*$/.test(line)) { out += '<hr>'; i++; continue; }
        // Unordered list bullets:
        // - item
        // * item
        // • item
        if (/^\s*(?:[-*+]|•)\s+/.test(line)) {
          const items = [];
          while (i < lines.length && /^\s*(?:[-*+]|•)\s+/.test(lines[i])) {
            items.push(lines[i].replace(/^\s*(?:[-*+]|•)\s+/, '').trim());
            i++;
          }
          out += `<ul>${items.map(it => `<li>${inline(esc(it))}</li>`).join('')}</ul>`;
          continue;
        }
        // Ordered lists:
        // 1. item
        // 1) item
        // 1 - item
        if (/^\s*\d+(?:\.|\)|\s+-)\s+/.test(line)) {
          // Ordered list: Grok sometimes inserts blank lines between items; keep numbering continuous.
          const items = [];
          const startMatch = line.match(/^\s*(\d+)(?:\.|\)|\s+-)\s+/);
          const start = startMatch ? Number(startMatch[1]) : 1;
          while (i < lines.length) {
            if (/^\s*\d+(?:\.|\)|\s+-)\s+/.test(lines[i])) {
              items.push(lines[i].replace(/^\s*\d+(?:\.|\)|\s+-)\s+/, '').trim());
              i++;
              continue;
            }
            if (!lines[i].trim()) { i++; continue; } // allow blank lines within list
            break;
          }
          const startAttr = Number.isFinite(start) && start > 1 ? ` start="${start}"` : '';
          out += `<ol${startAttr}>${items.map(it => `<li>${inline(esc(it))}</li>`).join('')}</ol>`;
          continue;
        }
        // Markdown pipe tables (basic)
        // | a | b |
        // |---|---|
        // | 1 | 2 |
        try {
          const isPipeRow = (l = '') => {
            const t = String(l || '').trim();
            return t.includes('|') && /^\|?.+\|.+\|?$/.test(t);
          };
          const isSep = (l = '') => /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(String(l || ''));
          if (isPipeRow(line) && i + 1 < lines.length && isSep(lines[i + 1] || '')) {
            const readRow = (l = '') => String(l || '').trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(c => c.trim());
            const head = readRow(line);
            i += 2; // skip header + sep
            const body = [];
            while (i < lines.length && isPipeRow(lines[i])) {
              body.push(readRow(lines[i]));
              i++;
            }
            const cols = Math.max(head.length, ...(body.map(r => r.length))) || head.length || 0;
            const norm = (r) => Array.from({ length: cols }, (_, idx) => (r[idx] == null ? '' : r[idx]));
            const headN = norm(head);
            const bodyN = body.map(norm);
            const th = headN.map(c => `<th>${inline(esc(c))}</th>`).join('');
            const trs = bodyN.map(r => `<tr>${r.map(c => `<td>${inline(esc(c))}</td>`).join('')}</tr>`).join('');
            out += `<table><thead><tr>${th}</tr></thead><tbody>${trs}</tbody></table>`;
            continue;
          }
        } catch {}
        if (!line.trim()) { i++; continue; }
        const buf = [];
        while (i < lines.length && lines[i].trim()) {
          // Stop the paragraph buffer when the next line starts a block element.
          // Otherwise, a bullet line like "- **STT** ..." can swallow a following fenced code block
          // into the same <p> and we end up outputting literal ``` fences.
          if (buf.length) {
            const n = lines[i] || '';
            if (
              isFenceLine(n) ||
              /^\s*#{1,6}\s+/.test(n) ||
              /^\s*---+\s*$/.test(n) ||
              /^\s*\$\$\s*$/.test(n) ||
              /^\s*(?:[-*+]|•)\s+/.test(n) ||
              /^\s*\d+(?:\.|\)|\s+-)\s+/.test(n)
            ) break;
          }
          buf.push(lines[i]);
          i++;
        }
        // Default: preserve explicit newlines. Grok often uses line breaks for readability
        // (especially around numbered steps), and collapsing them into spaces causes
        // "jam-packed" paragraphs in exports.
        const text = buf.join('\n').trim();
        if (text) {
          // Heuristic: sometimes Grok returns "inline lists" like:
          // "Try this: 1. Do X 2. Do Y 3. Do Z"
          // Convert into <p>prefix</p><ol>...</ol> when the line contains multiple ordered markers.
          try {
            const m = text.match(/^(.*?)(\b1(?:\.|\)|\s+-)\s+)/);
            if (m) {
              const prefix = m[1].trim();
              const tail = text.slice(m[1].length).trim();
              const split = tail.split(/\s+(?=\d+(?:\.|\)|\s+-)\s+)/g).filter(Boolean);
              if (split.length >= 2) {
                if (prefix) out += `<p>${inline(esc(prefix))}</p>`;
                const items = split.map(s => s.replace(/^\d+(?:\.|\)|\s+-)\s+/, '').trim());
                out += `<ol>${items.map(it => `<li>${inline(esc(it))}</li>`).join('')}</ol>`;
                continue;
              }
            }
          } catch {}
          // Preserve hard line breaks inside paragraphs as <br>.
          out += `<p>${inline(esc(text)).replace(/\n/g, '<br>')}</p>`;
        }
      }
      return out;
    }

    function mergeDomImageViewersIntoHtml(turnId = '', html = '') {
      try {
        if (!turnId || !html) return html;
        const responseRoot = document.getElementById(`response-${turnId}`);
        if (!responseRoot) return html;
        const viewers = Array.from(responseRoot.querySelectorAll('[data-testid="image-viewer"]'));
        if (!viewers.length) return html;

        const host = document.createElement('div');
        host.innerHTML = html;
        const normalizeText = (value = '') => String(value || '').replace(/\s+/g, ' ').trim();
        const precedingText = (node) => {
          let current = node;
          while (current && current !== responseRoot) {
            let previous = current.previousElementSibling;
            while (previous) {
              const text = normalizeText(previous.textContent || '');
              if (text) return text;
              previous = previous.previousElementSibling;
            }
            current = current.parentElement;
          }
          return '';
        };
        const findInsertionAnchor = (text = '') => {
          const needle = normalizeText(text).slice(-100);
          if (!needle) return null;
          const shortNeedle = needle.slice(-50);
          const candidates = Array.from(host.querySelectorAll('p, li, blockquote, h1, h2, h3, h4, h5, h6, div'));
          let match = null;
          for (const candidate of candidates) {
            const candidateText = normalizeText(candidate.textContent || '');
            if (!candidateText) continue;
            if (candidateText.endsWith(needle) || candidateText.endsWith(shortNeedle) || candidateText.includes(needle)) {
              match = candidate;
            }
          }
          return match;
        };

        viewers.forEach((viewer) => {
          const images = [];
          const seen = new Set();
          Array.from(viewer.querySelectorAll('img[src]')).forEach((img) => {
            const src = normalizeAbsUrl(img.currentSrc || img.getAttribute('src') || '');
            if (!src || /avatar|profile-picture|favicon|\/file-icons\//i.test(src)) return;
            const key = src.split('#')[0];
            if (seen.has(key)) return;
            seen.add(key);
            images.push({ src, alt: img.getAttribute('alt') || 'Grok image result' });
          });
          if (!images.length) return;

          const columns = Math.max(1, Math.min(images.length, 3));
          const gallery = document.createElement('div');
          gallery.className = 'acep-grok-image-gallery acep-chatgpt-image-gallery';
          gallery.setAttribute('data-acep-inline-gallery', '1');
          gallery.style.cssText = `--acep-gallery-columns:${columns};display:grid;grid-template-columns:repeat(${columns},minmax(0,1fr));gap:8px;width:100%;max-width:720px;margin:10px 0 16px;align-items:stretch;`;
          images.forEach((item) => {
            const tile = document.createElement('div');
            tile.className = 'acep-grok-image-tile acep-chatgpt-image-tile';
            tile.style.cssText = 'min-width:0;aspect-ratio:5/4;overflow:hidden;border-radius:10px;';
            const img = document.createElement('img');
            img.src = item.src;
            img.setAttribute('data-original-src', item.src);
            img.alt = item.alt;
            img.style.cssText = 'display:block;width:100%;height:100%;max-width:none;object-fit:cover;object-position:center top;margin:0;border-radius:10px;';
            tile.appendChild(img);
            gallery.appendChild(tile);
          });

          const anchor = findInsertionAnchor(precedingText(viewer));
          if (anchor?.parentNode) anchor.parentNode.insertBefore(gallery, anchor.nextSibling);
          else host.appendChild(gallery);
        });

        return host.innerHTML;
      } catch {
        return html;
      }
    }

    function buildApiTurnNodeGrok({ role = 'assistant', html = '', imgs = [], turnId = '' } = {}) {
      const el = document.createElement('div');
      try {
        el.setAttribute('data-acep-from-api', '1');
        el.setAttribute('data-acep-role', role);
        if (turnId) el.setAttribute('data-acep-turn-id', String(turnId));
        el.setAttribute('data-acep-export-idx', '');
      } catch {}
      const content = document.createElement('div');
      content.className = 'acep-api-content';
      content.innerHTML = html || '';
      el.appendChild(content);
      if (imgs && imgs.length) {
        try { el.setAttribute('data-acep-imgs', JSON.stringify(imgs)); } catch {}
        try {
          const shouldUseGallery =
            role === 'assistant' &&
            imgs.length >= 2 &&
            imgs.every((im) => {
              const src = String(im?.src || im?.originalSrc || '').trim();
              const alt = String(im?.alt || '').trim();
              return /\/generated\//i.test(src) || /^generated image$/i.test(alt);
            });
          const gallery = shouldUseGallery ? document.createElement('div') : null;
          if (gallery) {
            gallery.className = 'acep-grok-generated-grid';
            gallery.style.cssText = 'display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;align-items:start;margin:10px 0 0;';
          }
          imgs.forEach((im) => {
            const src = String(im?.src || im?.originalSrc || '').trim();
            if (!src) return;
            const img = document.createElement('img');
            img.setAttribute('src', src);
            img.setAttribute('data-original-src', src);
            img.setAttribute('data-acep-upload-img', '1');
            if (im?.alt) img.setAttribute('alt', String(im.alt));
            if (gallery) {
              const item = document.createElement('div');
              item.className = 'acep-grok-generated-grid-item';
              item.style.cssText = 'display:block;min-width:0;';
              img.setAttribute('data-acep-grok-generated-img', '1');
              img.style.cssText = 'width:100%;height:auto;display:block;margin:0;border-radius:12px;';
              item.appendChild(img);
              gallery.appendChild(item);
            } else {
              // Uploaded images are often low-res preview thumbnails; render them without forcing
              // full-width to reduce visible blur. The global HTML export CSS still prevents
              // tiny thumbnails from provider inline styles.
              img.style.cssText = 'max-width:100%;height:auto;display:block;margin:8px 0;';
              content.appendChild(img);
            }
          });
          if (gallery && gallery.childElementCount) content.appendChild(gallery);
        } catch {}
      }
      return el;
    }

    async function fetchApiTurnNodesForCurrentChat() {
      try {
        if (!env.isGrok || !env.isGrok()) return null;
        const convId = getChatConvId();
        if (!convId) {
          try { g.ACEP.providers.grok.__apiLastErr = 'no convId'; g.ACEP.providers.grok.__apiLastReason = 'no_conv_id'; } catch {}
          debugStore('apiScrape', { ok: false, reason: 'no convId' });
          return null;
        }

        const prevConvId = g.ACEP?.providers?.grok?.__apiConvId;
        const prevTs = Number(g.ACEP?.providers?.grok?.__apiTs || 0);
        const prevNodes = g.ACEP?.providers?.grok?.__apiTurnNodes;
        if (prevConvId === convId && Array.isArray(prevNodes) && prevNodes.length && (Date.now() - prevTs) < 120000) {
          debugStore('apiScrape', { ok: true, convId, count: prevNodes.length, cached: true });
          return { convId, nodes: prevNodes };
        }

        // Throttle failed retries: don't re-fetch within 15s of a previous failure
        const failTs = Number(g.ACEP?.providers?.grok?.__apiFailTs || 0);
        if (failTs && (Date.now() - failTs) < 15000) {
          try { g.ACEP.providers.grok.__apiLastErr = 'throttled_after_failure'; g.ACEP.providers.grok.__apiLastReason = 'throttled_after_failure'; } catch {}
          debugStore('apiScrape', { ok: false, reason: 'throttled_after_failure' });
          return null;
        }

        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 8000);
        let data;
        try {
          const resp = await fetch(`https://grok.com/rest/app-chat/conversations/${convId}/responses`, {
            credentials: 'include',
            headers: { Accept: 'application/json' },
            signal: controller.signal,
          });
          try { g.ACEP.providers.grok.__apiLastStatus = resp.status; } catch {}
          if (!resp.ok) throw new Error(`Grok API HTTP ${resp.status}`);
          data = await resp.json();
        } finally {
          clearTimeout(timer);
        }

        // Debug snapshot (shape can change)
        try {
          const snap = {
            ok: true,
            convId,
            topKeys: data && typeof data === 'object' ? Object.keys(data).slice(0, 30) : [],
            responsesType: Array.isArray(data?.responses) ? 'array' : typeof data?.responses,
            responsesLen: Array.isArray(data?.responses) ? data.responses.length : 0,
            firstKeys: (Array.isArray(data?.responses) && data.responses[0] && typeof data.responses[0] === 'object')
              ? Object.keys(data.responses[0]).slice(0, 40)
              : [],
            firstMessageType: (() => {
              try {
                const r0 = Array.isArray(data?.responses) ? data.responses[0] : null;
                const m0 = r0 ? r0.message : null;
                return Array.isArray(m0) ? 'array' : (m0 === null ? 'null' : typeof m0);
              } catch { return ''; }
            })(),
            firstOutputChunksLen: (() => {
              try {
                const r0 = Array.isArray(data?.responses) ? data.responses[0] : null;
                return Array.isArray(r0?.outputChunks) ? r0.outputChunks.length : 0;
              } catch { return 0; }
            })(),
            firstOutputChunkKeys: (() => {
              try {
                const r0 = Array.isArray(data?.responses) ? data.responses[0] : null;
                const c0 = Array.isArray(r0?.outputChunks) ? r0.outputChunks[0] : null;
                return (c0 && typeof c0 === 'object') ? Object.keys(c0).slice(0, 40) : [];
              } catch { return []; }
            })(),
          };
          document.documentElement.setAttribute('data-acep-grok-api-shape', JSON.stringify(snap));
        } catch {}

        if (!data?.responses || !Array.isArray(data.responses)) {
          debugStore('apiScrape', { ok: false, reason: 'no responses array' });
          return null;
        }

        const extractTextFromResponse = (r) => {
          try {
            if (!r || typeof r !== 'object') return '';

            const joinChunks = (arr) => {
              try {
                if (!Array.isArray(arr) || !arr.length) return '';
                const parts = [];
                for (const ch of arr) {
                  if (!ch) continue;
                  if (typeof ch === 'string') { if (ch.trim()) parts.push(ch); continue; }
                  if (typeof ch === 'object') {
                    const direct = ch.text ?? ch.content ?? ch.markdown ?? ch.message ?? ch.output;
                    if (typeof direct === 'string' && direct.trim()) { parts.push(direct); continue; }
                    if (direct && typeof direct === 'object') {
                      if (typeof direct.text === 'string' && direct.text.trim()) { parts.push(direct.text); continue; }
                      if (typeof direct.content === 'string' && direct.content.trim()) { parts.push(direct.content); continue; }
                      if (typeof direct.markdown === 'string' && direct.markdown.trim()) { parts.push(direct.markdown); continue; }
                    }
                  }
                }
                return parts.join('\n').trim();
              } catch { return ''; }
            };

            // Newer Grok API shapes: outputChunks/inputChunks often carry the text, while message can be null/object.
            const fromOut = joinChunks(r.outputChunks);
            if (fromOut) return fromOut;
            const fromIn = joinChunks(r.inputChunks);
            if (fromIn) return fromIn;

            const direct = r.message ?? r.query ?? r.text ?? r.markdown ?? r.response ?? r.content ?? r.output;
            if (typeof direct === 'string') return direct;
            if (direct && typeof direct === 'object') {
              if (typeof direct.text === 'string') return direct.text;
              if (typeof direct.markdown === 'string') return direct.markdown;
              if (typeof direct.content === 'string') return direct.content;
              // Some APIs use { parts:[{text:"..."}] }
              if (Array.isArray(direct.parts)) {
                const joined = direct.parts.map(p => (typeof p === 'string') ? p : (p && typeof p.text === 'string' ? p.text : '')).filter(Boolean).join('\n');
                if (joined) return joined;
              }
            }
            // Some shapes: message is array of segments
            if (Array.isArray(r.message)) {
              const joined = r.message.map(p => (typeof p === 'string') ? p : (p && typeof p.text === 'string' ? p.text : '')).filter(Boolean).join('\n');
              if (joined) return joined;
            }

            // Last resort: shallow recursive search for first plausible text string
            const findText = (obj, depth = 0) => {
              if (depth > 3 || obj == null) return '';
              if (typeof obj === 'string') {
                const t = obj.trim();
                if (!t) return '';
                // ignore pure ids/urls
                if (/^https?:\/\//i.test(t)) return '';
                if (/^[a-f0-9-]{16,}$/i.test(t)) return '';
                return t;
              }
              if (Array.isArray(obj)) {
                for (const it of obj) {
                  const hit = findText(it, depth + 1);
                  if (hit) return hit;
                }
                return '';
              }
              if (typeof obj === 'object') {
                const pref = ['text', 'content', 'markdown', 'message', 'output', 'response'];
                for (const k of pref) {
                  if (Object.prototype.hasOwnProperty.call(obj, k)) {
                    const hit = findText(obj[k], depth + 1);
                    if (hit) return hit;
                  }
                }
                for (const k of Object.keys(obj)) {
                  const hit = findText(obj[k], depth + 1);
                  if (hit) return hit;
                }
              }
              return '';
            };
            const fallback = findText(r, 0);
            if (fallback) return fallback;
          } catch {}
          return '';
        };

        const nodes = [];
        // Small debug ring-buffer of raw API text samples so we can diagnose formatting
        // issues without requiring huge DOM pastes.
        try {
          g.ACEP.providers.grok.__apiRawSamples = [];
        } catch {}

        // Best-effort: collect image URLs already present in the DOM in reading order.
        // Grok's API metadata often omits direct URLs for uploads/generated images.
        const collectBestDomImageUrls = (scope) => {
          try {   
            const container = scope || getThreadContainer?.() || document.querySelector('main') || document.body;   
            const nodes = Array.from(container.querySelectorAll('img, picture source[srcset], a[href]'));   
            const bestByBase = new Map();  
            const scoreUrl = (s) => {  
              try {  
                if (!s) return -1e9;  
                let score = 0;  
                if (/\/preview-image\b/i.test(s)) score -= 200; 
                if (/thumb|thumbnail|small|lowres|low-res/i.test(s)) score -= 50; 
                // Prefer explicit image extensions 
                if (/\.(png|jpe?g|gif|webp|bmp|svg)(\?|#|$)/i.test(s)) score += 30; 
                // Prefer larger width/size query params if present 
                const qIdx = s.indexOf('?'); 
                if (qIdx >= 0) { 
                  const q = s.slice(qIdx + 1); 
                  const mW = q.match(/(?:^|[&?])(w|width|maxwidth|mw)=(\d{2,5})(?:&|$)/i); 
                  if (mW) score += Math.min(300, Number(mW[2]) || 0) / 5; 
                  const mS = q.match(/(?:^|[&?])(s|size)=(\d{2,5})(?:&|$)/i); 
                  if (mS) score += Math.min(300, Number(mS[2]) || 0) / 8; 
                } 
                return score; 
              } catch { 
                return 0; 
              } 
            }; 
            const push = (src, allowPublic = false) => { 
              const s = normalizeAbsUrl(src); 
              if (!s) return; 
              if (/avatar|profile-picture|favicon|\/file-icons\//i.test(s)) return;
              if (!/^https?:\/\//i.test(s) && !/^data:image\//i.test(s)) return;
              // Only image-ish URLs 
              const key0 = s.split('#')[0]; 
              if (
                !allowPublic &&
                !/\.(png|jpe?g|gif|webp|bmp|svg|avif)(\?|#|$)/i.test(key0) &&
                !/\/preview-image\b/i.test(key0) &&
                !/\/generated\//i.test(key0)
              ) return; 
              const base = key0.includes('?') ? key0.slice(0, key0.indexOf('?')) : key0; 
              if (!base) return; 
              const nextScore = scoreUrl(key0); 
              const prev = bestByBase.get(base); 
              if (!prev || nextScore > prev.score) bestByBase.set(base, { url: key0, score: nextScore }); 
            }; 
            for (const n of nodes) { 
              try { 
                if (n.tagName === 'IMG') { 
                  const srcset = n.getAttribute('srcset') || ''; 
                  const bestSrc = (() => { 
                    if (!srcset) return ''; 
                    const parts = srcset.split(',').map(e => e.trim()).filter(Boolean); 
                    let bestUrl = ''; 
                    let bestW = -1; 
                    for (const p of parts) { 
                      const m = p.match(/^(\S+)\s+(\d+)(w|x)\s*$/i); 
                      if (m) { 
                        const u = m[1]; 
                        const n = Number(m[2]) || 0; 
                        const w = m[3].toLowerCase() === 'x' ? n * 1000 : n; 
                        if (w > bestW) { bestW = w; bestUrl = u; } 
                      } else { 
                        const u = p.split(' ')[0]?.trim(); 
                        if (u) bestUrl = u; 
                      } 
                    } 
                    return bestUrl; 
                  })(); 
                  const isImageViewer = !!n.closest?.('[data-testid="image-viewer"]');
                  push(bestSrc || n.currentSrc || n.getAttribute('src') || '', isImageViewer); 
                } else if (n.tagName === 'SOURCE') { 
                  const set = (n.getAttribute('srcset') || '').trim(); 
                  const parts = set.split(',').map(e => e.trim()).filter(Boolean); 
                  let best = ''; 
                  let bestW = -1; 
                  for (const p of parts) { 
                    const m = p.match(/^(\S+)\s+(\d+)(w|x)\s*$/i); 
                    if (m) { 
                      const u = m[1]; 
                      const n = Number(m[2]) || 0; 
                      const w = m[3].toLowerCase() === 'x' ? n * 1000 : n; 
                      if (w > bestW) { bestW = w; best = u; } 
                    } else { 
                      const u = p.split(' ')[0]?.trim(); 
                      if (u) best = u; 
                    } 
                  } 
                  if (best) push(best, !!n.closest?.('[data-testid="image-viewer"]')); 
                } else if (n.tagName === 'A') { 
                  push(n.getAttribute('href') || '', false); 
                } 
              } catch {} 
            } 
            return Array.from(bestByBase.values()).map(x => x.url);  
          } catch {  
            return [];  
          }  
        };
        // Best-effort: collect uploaded image URLs already present in the DOM in reading order. 
        // Grok's API metadata often includes filenames but not always direct URLs for user uploads. 
        // We remain API-first for turns, but use DOM as an image source to embed images instead of 
        // showing only "[Attachment]" for uploaded images. 
        const domUploadImages = collectBestDomImageUrls();  
        let domUploadIdx = 0; 
        // Better mapping: collect upload image URLs within each response wrapper so we don't 
        // accidentally shift uploads into the next turn (virtualized DOM / mixed content). 
        const domAllImagesByTurnId = (() => {
          try {
            const main = getThreadContainer?.() || document.querySelector('main') || document.body;
            const roots = Array.from(main.querySelectorAll(sel.responseRoot || '[id^="response-"]'));
            const map = new Map();
            roots.forEach((r) => {
              try {
                const id = String(r?.id || '').trim();
                const m = id.match(/^response-(.+)$/i);
                if (!m || !m[1]) return;
                const tid = String(m[1]);
                const imgs = collectBestDomImageUrls(r);
                if (imgs && imgs.length) map.set(tid, imgs);
              } catch {}
            });
            return map;
          } catch {
            return new Map();
          }
        })();
        const domUploadByTurnId = (() => { 
          try { 
            const main = getThreadContainer?.() || document.querySelector('main') || document.body; 
            const roots = Array.from(main.querySelectorAll(sel.responseRoot || '[id^="response-"]')); 
            const map = new Map(); 
            const bestFromSrcset = (srcset = '') => {
              try {
                const parts = String(srcset || '').split(',').map(e => e.trim()).filter(Boolean);
                let best = '';
                let bestW = -1;
                for (const p of parts) {
                  const m = p.match(/^(\S+)\s+(\d+)(w|x)\s*$/i); 
                  if (m) {
                    const u = m[1];
                    const n = Number(m[2]) || 0;
                    const w = m[3].toLowerCase() === 'x' ? n * 1000 : n;
                    if (w > bestW) { bestW = w; best = u; }
                  } else {
                    const u = p.split(' ')[0]?.trim();
                    if (u) best = u;
                  }
                }
                return best;
              } catch { return ''; }
            };
            const collect = (scope) => {
              try {
                const out = [];
                const seen = new Set();
                const push = (src) => {
                  const s = normalizeAbsUrl(src);
                  if (!s) return;
                  if (!/assets\.grok\.com/i.test(s) && !/\/preview-image\b/i.test(s)) return; 
                  const key0 = s.split('#')[0];
                  const key = key0.includes('?') ? key0.slice(0, key0.indexOf('?')) : key0;
                  if (!key || seen.has(key)) return;
                  seen.add(key);
                  out.push(key0);
                };
                Array.from(scope.querySelectorAll('img, picture source[srcset], a[href]')).forEach((n) => {
                  try {
                    if (n.tagName === 'IMG') {
                      const best = bestFromSrcset(n.getAttribute('srcset') || '');
                      push(best || n.currentSrc || n.getAttribute('src') || '');
                    } else if (n.tagName === 'SOURCE') {
                      const best = bestFromSrcset(n.getAttribute('srcset') || '');
                      push(best);
                    } else if (n.tagName === 'A') {
                      push(n.getAttribute('href') || '');
                    }
                  } catch {}
                });
                return out;
              } catch { return []; }
            };
            roots.forEach((r) => {
              try {
                const id = String(r?.id || '').trim();
                const m = id.match(/^response-(.+)$/i);
                if (!m || !m[1]) return;
                const tid = String(m[1]);
                const imgs = collect(r);
                if (imgs && imgs.length) map.set(tid, imgs);
              } catch {}
            });
            return map;
          } catch {
            return new Map();
          }
        })();
        try { 
          debugSetAttr('data-acep-grok-dom-upload-images-count', String(domUploadImages.length || 0), 20); 
          debugSetAttr('data-acep-grok-dom-upload-images-head', domUploadImages.slice(0, 3).join('\n'), 550); 
          try { 
            const n = (domUploadByTurnId && typeof domUploadByTurnId.size === 'number') ? domUploadByTurnId.size : 0; 
            debugSetAttr('data-acep-grok-dom-upload-byturn-count', String(n), 20); 
          } catch {} 
          try {
            const n2 = (domAllImagesByTurnId && typeof domAllImagesByTurnId.size === 'number') ? domAllImagesByTurnId.size : 0;
            debugSetAttr('data-acep-grok-dom-all-byturn-count', String(n2), 20);
          } catch {}
        } catch {} 

        // Track uploaded image URLs we've already associated with a user turn, so we can
        // skip any stray assistant "image-only" responses that duplicate the same uploads.
        const seenUploadImgKeys = new Set();
 
        const responses = Array.isArray(data?.responses) ? data.responses : [];
        for (let responseIndex = 0; responseIndex < responses.length; responseIndex++) {  
          const response = responses[responseIndex];
          try {  
            let sender = String(response.sender || response.senderType || response.sender_role || response.role || '').toLowerCase(); 
            // Skip control/transport responses (not user-visible turns)
            try { if (response.isControl) continue; } catch {}
            // Some API shapes omit `sender` for certain items; infer a role from available fields.
            if (!sender) {
              const hasQuery = typeof response.query === 'string' && response.query.trim();
              const hasIn = Array.isArray(response.inputChunks) && response.inputChunks.length;
              const hasOut = Array.isArray(response.outputChunks) && response.outputChunks.length;
              sender = (hasQuery || hasIn) ? 'human' : (hasOut ? 'assistant' : '');
            }
            if (!sender) continue;
            const role = (sender === 'human' || sender === 'user') ? 'user' : 'assistant';
            const turnId = String(response.responseId || '');
            let rawText = String(extractTextFromResponse(response) || '').trim();
            // Strip Grok inline citation render tags that sometimes leak in API text.
            rawText = rawText.replace(/<grok:render\b[\s\S]*?<\/grok:render>/gi, '');
            // Drop transient cancellation stubs (the UI usually doesn't show these as a standalone turn).
            if (/^\s*request cancelled\s*$/i.test(rawText)) continue;
            // Debug: store raw API text samples (head only) so we can inspect the problematic turns.
            try {
              const wantId = (() => {
                try { return String(document.documentElement.getAttribute('data-acep-grok-debug-id') || '').trim(); } catch { return ''; }
              })();
              const wantNeedle = (() => {
                try { return String(document.documentElement.getAttribute('data-acep-grok-debug-needle') || '').trim(); } catch { return ''; }
              })();
              const wantNeedleWin = (() => {
                try {
                  const raw = String(document.documentElement.getAttribute('data-acep-grok-debug-needle-win') || '').trim();
                  const n = raw ? Number(raw) : 0;
                  return Number.isFinite(n) && n > 0 ? Math.min(2500, Math.max(200, Math.floor(n))) : 1200;
                } catch { return 1200; }
              })();
              const wantMode = wantId.toLowerCase() === 'last-assistant' || wantId.toLowerCase() === 'last';
              const sample = {
                id: turnId,
                role,
                hasBackticks: rawText.includes('`'),
                hasNewlines: rawText.includes('\n'),
                head: rawText.slice(0, 220),
              };
              const arr = g.ACEP.providers.grok.__apiRawSamples || [];
              arr.push(sample);
              // Keep at most 60 items
              while (arr.length > 60) arr.shift();
              g.ACEP.providers.grok.__apiRawSamples = arr;
              const idCandidates = (() => {
                const out = [];
                const add = (v) => { if (!v) return; const s = String(v).trim(); if (s && !out.includes(s)) out.push(s); };
                try { add(turnId); } catch {}
                try { add(response.responseId); } catch {}
                try { add(response.id); } catch {}
                try { add(response.messageId); } catch {}
                try { add(response.response_id); } catch {}
                try { add(response.message?.id); } catch {}
                return out;
              })();
              const isWanted = !!(wantId && idCandidates.includes(wantId));
              // If a specific turnId is requested (or "last assistant"), expose a larger raw sample.
              if ((wantId && isWanted) || (wantMode && role === 'assistant')) {
                const targetId = wantMode ? (turnId || idCandidates[0] || '') : wantId;
                debugSetAttr('data-acep-grok-apiraw-target-id', targetId, 120);
                debugSetAttr('data-acep-grok-apiraw-target-role', role, 30);
                debugSetAttr('data-acep-grok-apiraw-target-len', String(rawText.length || 0), 30);
                debugSetAttr('data-acep-grok-apiraw-target', rawText.slice(0, 4200), 4300);
                // NOTE: content scripts run in an isolated world, so page console cannot read `globalThis.ACEP`.
                // For debugging, we expose targeted slices via DOM attributes (size-limited) instead.
                try {
                  const firstBt = rawText.indexOf('`');
                  debugSetAttr('data-acep-grok-apiraw-target-firstbt', String(firstBt), 30);
                  if (firstBt >= 0) {
                    const from = Math.max(0, firstBt - 300);
                    const to = Math.min(rawText.length, firstBt + 900);
                    const slice = rawText.slice(from, to);
                    debugSetAttr('data-acep-grok-apiraw-target-aroundbt', slice, 1400);
                    // Visible debug: replace backticks so it’s obvious where they are in the slice.
                    debugSetAttr('data-acep-grok-apiraw-target-aroundbt_vis', slice.replace(/`/g, '<BT>'), 1400);
                  } else {
                    debugSetAttr('data-acep-grok-apiraw-target-aroundbt', '', 10);
                    debugSetAttr('data-acep-grok-apiraw-target-aroundbt_vis', '', 10);
                  }
                  const btLines = rawText.split('\n').filter(l => {
                    const t = String(l || '').trim();
                    return t.startsWith('`') && t.endsWith('`') && t.length >= 3;
                  }).length;
                  debugSetAttr('data-acep-grok-apiraw-target-btlines', String(btLines), 30);
                  try {
                    const btList = rawText
                      .split('\n')
                      .map(l => String(l || '').trim())
                      .filter(t => t.startsWith('`') && t.endsWith('`') && t.length >= 3)
                      .slice(0, 20)
                      .join('\n');
                    debugSetAttr('data-acep-grok-apiraw-target-btlist', btList, 1800);
                  } catch {}
                } catch {}
              }

              // Needle-based slice debug: lets us grab the exact region inside a long assistant message
              // without relying on reading isolated-world variables.
              try {
                if (wantNeedle && role === 'assistant') {
                  const idx = rawText.indexOf(wantNeedle);
                  debugSetAttr('data-acep-grok-apiraw-needle', wantNeedle.slice(0, 140), 160);
                  debugSetAttr('data-acep-grok-apiraw-needle-index', String(idx), 40);
                  if (idx >= 0) {
                    const from = Math.max(0, idx - Math.floor(wantNeedleWin / 3));
                    const to = Math.min(rawText.length, idx + wantNeedleWin);
                    const slice = rawText.slice(from, to);
                    debugSetAttr('data-acep-grok-apiraw-needle-slice', slice, 1600);
                    debugSetAttr('data-acep-grok-apiraw-needle-slice_vis', slice.replace(/`/g, '<BT>'), 1600);
                    // Also show whether any $...$ inline math patterns exist in this slice.
                    const hasDollarMath = /(?<![\\$\d])\$(?!\{)([^$\n]{1,300})\$(?!\d)/.test(slice);
                    debugSetAttr('data-acep-grok-apiraw-needle-has-dollar-math', hasDollarMath ? '1' : '0', 10);
                  } else {
                    debugSetAttr('data-acep-grok-apiraw-needle-slice', '', 10);
                    debugSetAttr('data-acep-grok-apiraw-needle-slice_vis', '', 10);
                    debugSetAttr('data-acep-grok-apiraw-needle-has-dollar-math', '0', 10);
                  }
                }
              } catch {}
              // Also expose the most recent assistant sample via DOM attributes (quick copy/paste)
              if (role === 'assistant') {
                debugSetAttr('data-acep-grok-apiraw-head', sample.head, 950);
                debugSetAttr('data-acep-grok-apiraw-has-backticks', sample.hasBackticks ? '1' : '0', 10);
                debugSetAttr('data-acep-grok-apiraw-has-newlines', sample.hasNewlines ? '1' : '0', 10);
              }
            } catch {}

            const html = rawText ? markdownToHtmlGrok(rawText) : '';

            // Debug: show rendered HTML slice around a needle (helps determine whether splitting
            // happens in markdownToHtmlGrok or later in popup/html exporter styling).
            try {
              const wantNeedle = String(document.documentElement.getAttribute('data-acep-grok-debug-needle') || '').trim();
              if (wantNeedle && role === 'assistant') {
                const idxH = String(html || '').indexOf(wantNeedle);
                debugSetAttr('data-acep-grok-html-needle-index', String(idxH), 40);
                if (idxH >= 0) {
                  const from = Math.max(0, idxH - 500);
                  const to = Math.min(String(html || '').length, idxH + 1600);
                  const sliceH = String(html || '').slice(from, to);
                  debugSetAttr('data-acep-grok-html-needle-slice', sliceH, 1600);
                  const preCount = (sliceH.match(/<pre\b/gi) || []).length;
                  const codeCount = (sliceH.match(/<code\b/gi) || []).length;
                  debugSetAttr('data-acep-grok-html-needle-precount', String(preCount), 20);
                  debugSetAttr('data-acep-grok-html-needle-codecount', String(codeCount), 20);
                } else {
                  debugSetAttr('data-acep-grok-html-needle-slice', '', 10);
                  debugSetAttr('data-acep-grok-html-needle-precount', '0', 20);
                  debugSetAttr('data-acep-grok-html-needle-codecount', '0', 20);
                }
              }
            } catch {}

            const imgs = []; 
            const pushImg = (u, alt) => { 
              let src = normalizeAbsUrl(String(u || '').trim()); 
              if (!src) return; 
              // Reject non-image data URLs; these produce broken <img> tags like
              // `data:text/html;base64,...` in exported HTML.
              if (/^data:/i.test(src) && !/^data:image\//i.test(src)) return;
              // NOTE: Keep `preview-image` URLs. The `/content` endpoint often returns 403 
              // when fetched from the extension export pipeline, which would break image 
              // inlining for offline exports. 
              if (imgs.some(x => String(x?.originalSrc || x?.src || '') === src)) return; 
              imgs.push({ src, originalSrc: src, alt: String(alt || '').trim() || 'uploaded image' }); 
            };
            // Uploaded files: show as attachment labels rather than img elements.
            // assets.grok.com URLs require Grok session auth; the extension download path
            // hangs waiting for them, causing HTML/PDF/DOCX exports to freeze.
            let attachmentHtml = '';
            try {
              const attachments = Array.isArray(response.fileAttachmentsMetadata) ? response.fileAttachmentsMetadata : [];
              for (const att of attachments) {
                const fname = String(att.fileName || att.fileMetadataId || '').trim();
                if (!fname) continue;
                const isImgName = /\.(png|jpe?g|gif|webp|bmp|svg|heic|heif)(\?|#|$)/i.test(fname);
                // Grok user uploads can show numeric ids as filenames (no extension).
                // Only bind DOM upload preview images to USER turns. Assistant turns should
                // rely on generatedImageUrls instead; otherwise the same uploaded previews can
                // leak into assistant responses and duplicate the turn.
                const turnImgs = (turnId && domUploadByTurnId && typeof domUploadByTurnId.get === 'function') ? (domUploadByTurnId.get(turnId) || []) : [];
                const looksNumericId = !isImgName && /^[0-9]{6,}$/.test(fname);
                const allowUploadPreviewBinding = role === 'user';
                if (allowUploadPreviewBinding && (isImgName || (looksNumericId && Array.isArray(turnImgs) && turnImgs.length))) {
                  let url = '';
                  try {
                    const candidates = [att?.url, att?.src, att?.downloadUrl, att?.fileUrl, att?.uri, att?.fileUri, att?.contentUri, att?.previewUrl, att?.thumbnailUrl];
                    for (const c of candidates) {
                      const u = String(c || '').trim();
                      if (!u) continue;
                      if (/^https?:\/\//i.test(u) || /^\/\//.test(u)) { url = u; break; }
                    }
                  } catch {}
                  if (!url) {
                    try {
                      if (Array.isArray(turnImgs) && turnImgs.length) {
                        url = String(turnImgs.shift() || '').trim();
                        if (turnId) domUploadByTurnId.set(turnId, turnImgs);
                      } else if (Array.isArray(domUploadImages) && domUploadIdx < domUploadImages.length) {
                        url = String(domUploadImages[domUploadIdx++] || '').trim();
                      }
                    } catch {}
                  }
                  if (url) {
                    pushImg(url, fname);
                    continue;
                  }
                }
                // Assistant turns often expose generated images as generic file names like
                // `image.jpg`. We don't want those labels when the image itself is rendered.
                const skipAssistantImageLabel =
                  role === 'assistant' &&
                  (isImgName || looksNumericId || /^generated image$/i.test(fname) || /^image\.[a-z0-9]+$/i.test(fname));
                if (skipAssistantImageLabel) continue;
                attachmentHtml += `<div data-acep-attachment-name="${escapeAttr(fname)}"></div>`; 
              } 
            } catch {} 
            // AI-generated images are public CDN URLs — safe to download
            // Uploaded images: embed when possible (instead of attachment-only).
            try { 
              const imageAtt = Array.isArray(response.imageAttachments) ? response.imageAttachments : []; 
              for (const im of imageAtt) { 
                const alt = String(im?.fileName || im?.name || 'uploaded image').trim(); 
                const candidates = [im?.url, im?.src, im?.downloadUrl, im?.fileUrl, im?.uri, im?.fileUri, im?.contentUri, im?.previewUrl, im?.thumbnailUrl]; 
                for (const c of candidates) { 
                  const url = String(c || '').trim(); 
                  if (!url) continue; 
                  if (!/^https?:\/\//i.test(url) && !/^\/\//.test(url) && !/^data:image\//i.test(url)) continue;
                  if (role === 'assistant' && /assets\.grok\.com/i.test(url) && /\/preview-image\b/i.test(url)) {
                    const s = String(url).split('#')[0];
                    const key = s.includes('?') ? s.slice(0, s.indexOf('?')) : s;
                    if (key && seenUploadImgKeys.has(key)) continue;
                  }
                  pushImg(url, alt); 
                  break;  
                }  
              }  
              const uris = Array.isArray(response.fileUris) ? response.fileUris : []; 
              for (const u of uris) {
                const url = String(u || '').trim();
                if (!url) continue;
                if (!/\.(png|jpe?g|gif|webp|bmp|svg)(\?|#|$)/i.test(url)) continue;
                pushImg(url, 'uploaded image');
              }
            } catch {}

            try {  
              const genUrls = Array.isArray(response.generatedImageUrls) ? response.generatedImageUrls : [];  
              for (const url of genUrls) {  
                const src = normalizeAbsUrl(String(url || '').trim());  
                if (!src) continue; 
                if (/^data:/i.test(src) && !/^data:image\//i.test(src)) continue;
                if (
                  !/\.(png|jpe?g|gif|webp|bmp|svg)(\?|#|$)/i.test(src) &&
                  !/^data:image\//i.test(src) &&
                  !/\/preview-image\b/i.test(src) &&
                  !/\/content\b/i.test(src) &&
                  !/\/generated\//i.test(src)
                ) continue; 
                pushImg(src, 'generated image');  
              }  
            } catch {}  
            // Fallback: for assistant turns, if API image fields are incomplete/bad, pull
            // the rendered image URLs from the matching DOM response wrapper.
            try {
              if (role === 'assistant' && turnId && !imgs.length) {
                const domImgs = (domAllImagesByTurnId && typeof domAllImagesByTurnId.get === 'function') ? (domAllImagesByTurnId.get(turnId) || []) : [];
                domImgs.forEach((src) => {
                  const s = String(src || '').trim();
                  if (!s) return;
                  const key = s.split('#')[0].includes('?') ? s.split('#')[0].slice(0, s.split('#')[0].indexOf('?')) : s.split('#')[0];
                  if (key && seenUploadImgKeys.has(key)) return;
                  pushImg(s, 'Grok image result');
                });
              }
            } catch {}

            // Grok image generation can emit an intermediate assistant response like
            // "I generated images with the prompt: ..." before the final assistant turn
            // that actually owns the generated image outputs. Keep the final one and drop
            // the prompt-only/tool-step variant.
            try {
              const isImageGenAssistantText = role === 'assistant' && /^I generated images with the prompt:/i.test(String(rawText || '').trim());
              if (isImageGenAssistantText) {
                let hasLaterAssistantImageGenInRun = false;
                for (let j = responseIndex + 1; j < responses.length; j++) {
                  const next = responses[j];
                  if (!next || next.isControl) continue;
                  let nextSender = String(next.sender || next.senderType || next.sender_role || next.role || '').toLowerCase();
                  if (!nextSender) {
                    const hasQuery = typeof next.query === 'string' && next.query.trim();
                    const hasIn = Array.isArray(next.inputChunks) && next.inputChunks.length;
                    const hasOut = Array.isArray(next.outputChunks) && next.outputChunks.length;
                    nextSender = (hasQuery || hasIn) ? 'human' : (hasOut ? 'assistant' : '');
                  }
                  const nextRole = (nextSender === 'human' || nextSender === 'user') ? 'user' : (nextSender ? 'assistant' : '');
                  if (nextRole === 'user') break;
                  if (nextRole !== 'assistant') continue;
                  const nextText = String(extractTextFromResponse(next) || '').trim().replace(/<grok:render\b[\s\S]*?<\/grok:render>/gi, '');
                  if (/^I generated images with the prompt:/i.test(nextText)) {
                    hasLaterAssistantImageGenInRun = true;
                  }
                }
                if (hasLaterAssistantImageGenInRun) continue;
              }
            } catch {}
 
            // Grok sometimes emits an assistant "image-only" response that just mirrors the 
            // user-upload preview images. That creates a duplicate extra assistant turn in HTML 
            // self export. Drop those responses outright. 
            try {
              const hasText = !!(rawText && rawText.trim());
              const hasAttachments = !!(attachmentHtml && attachmentHtml.trim());
              if (!hasText && !hasAttachments && role === 'assistant' && imgs.length) {
                const isUploadPreview = (u = '') => /assets\.grok\.com/i.test(String(u || '')) && /\/preview-image\b/i.test(String(u || ''));
                const allAreUploads = imgs.every(im => isUploadPreview(im?.src || im?.originalSrc || ''));
                if (allAreUploads) {
                  continue;
                }
              }
              // Mark uploaded previews used on the user turn as "seen".
              if (role === 'user' && imgs.length) {
                imgs.forEach((im) => {
                  const s = String(im?.src || im?.originalSrc || '').split('#')[0];
                  const key = s.includes('?') ? s.slice(0, s.indexOf('?')) : s;
                  if (key) seenUploadImgKeys.add(key);
                });
              }
            } catch {}
 
            let fullHtml = html + attachmentHtml;
            if (role === 'assistant' && turnId) {
              fullHtml = mergeDomImageViewersIntoHtml(turnId, fullHtml);
            }
            if (!fullHtml && !imgs.length) continue; 
            nodes.push(buildApiTurnNodeGrok({ role, html: fullHtml, imgs, turnId })); 
          } catch {} 
        } 

        debugStore('apiScrape', { ok: true, convId, count: nodes.length });
        // Expose a compact preview of raw samples (DOM attribute) for debugging in DevTools console.
        try {
          const arr = Array.isArray(g.ACEP.providers.grok.__apiRawSamples) ? g.ACEP.providers.grok.__apiRawSamples : [];
          const interesting = arr
            .filter(x => x && (x.hasBackticks || x.hasNewlines))
            .slice(-20);
          // Keep it small enough to fit in an attribute.
          const compact = interesting.map(x => ({
            id: x.id,
            role: x.role,
            bt: !!x.hasBackticks,
            nl: !!x.hasNewlines,
            head: String(x.head || '').slice(0, 160),
          }));
          debugSetAttr('data-acep-grok-apiraw-samples', compact, 1100);
        } catch {}
        try {
          if (!nodes.length && Array.isArray(data?.responses) && data.responses.length) {
            g.ACEP.providers.grok.__apiLastErr = 'api_parse_empty';
            g.ACEP.providers.grok.__apiLastReason = 'api_parse_empty';
          } else {
            g.ACEP.providers.grok.__apiLastErr = '';
            g.ACEP.providers.grok.__apiLastReason = '';
          }
        } catch {}
        try {
          const snap2 = {
            ok: true,
            convId,
            nodesLen: nodes.length,
            sampleTextHead: nodes[0]?.querySelector?.('.acep-api-content')?.textContent?.slice?.(0, 120) || '',
          };
          document.documentElement.setAttribute('data-acep-grok-api-parse', JSON.stringify(snap2));
        } catch {}
        return { convId, nodes };
      } catch (e) {
        try { g.ACEP.providers.grok.__apiFailTs = Date.now(); } catch {}
        try { g.ACEP.providers.grok.__apiLastErr = String(e?.message || e); g.ACEP.providers.grok.__apiLastReason = 'exception'; } catch {}
        debugStore('apiScrape', { ok: false, err: String(e?.message || e) });
        return null;
      }
    }

    function getTurnsForExport() {
      try {
        const apiNodes = g.ACEP?.providers?.grok?.__apiTurnNodes;
        if (Array.isArray(apiNodes) && apiNodes.length) return apiNodes;
        // API-first: if API failed, do not fall back to DOM (avoids partial/virtualized exports).
        try {
          if (g.ACEP?.providers?.grok?.__apiFailed || g.ACEP?.providers?.grok?.__apiNetworkFailed) return [];
        } catch {}
        if (!env.isGrok || !env.isGrok()) return [];
        const main = getThreadContainer() || document.body;
        const responseRoots = Array.from(main.querySelectorAll(sel.responseRoot || '[id^="response-"]'));
        if (!responseRoots.length) return [];

        const bubbleSel = sel.bubbleAny || 'div[class*="message-bubble" i], [class*="MessageBubble" i], [data-testid*="bubble" i]';
        const contentSel = sel.contentAny || '.response-content-markdown, [data-testid="message-content"], .markdown, [class*="prose" i]';
        const artifactSel = sel.artifactCard || '[id^="artifact_card_"]';

        const isUserRoot = (el) => /\bitems-end\b/i.test(el.className || '');
        const isAsstRoot = (el) => /\bitems-start\b/i.test(el.className || '');

        const turns = [];
        for (const resp of responseRoots) {
          try {
            if (isUserRoot(resp)) {
              const bubbleEl = resp.querySelector(bubbleSel);
              if (!bubbleEl) continue;
              const userWrap = document.createElement('div');
              userWrap.setAttribute('data-acep-role', 'user');
              try { if (resp.id) userWrap.setAttribute('data-acep-resp-id', resp.id); } catch {}
              userWrap.appendChild(bubbleEl.cloneNode(true));
              appendFileChipsAsAttachments(resp, userWrap);
              appendImages(resp, userWrap);
              turns.push(userWrap);
              continue;
            }
            if (isAsstRoot(resp)) {
              const content = resp.querySelector(contentSel) || resp.querySelector(artifactSel) || resp;
              const asstWrap = document.createElement('div');
              asstWrap.setAttribute('data-acep-role', 'assistant');
              try { if (resp.id) asstWrap.setAttribute('data-acep-resp-id', resp.id); } catch {}
              const holder = document.createElement('div');
              // Prefer full response content; include artifact cards if present.
              try {
                const parts = [];
                const seen = new Set();
                const nodesRaw = Array.from(resp.querySelectorAll(`${contentSel}, ${artifactSel}`));
                // Avoid duplicating nested matches (e.g., `.response-content-markdown` contains `.markdown`).
                const nodes = nodesRaw.filter((n) => {
                  try {
                    return !nodesRaw.some((m) => m && m !== n && m.contains && m.contains(n));
                  } catch {
                    return true;
                  }
                });
                nodes.forEach((n) => {
                  if (!n || seen.has(n)) return;
                  seen.add(n);
                  parts.push(n.outerHTML);
                });
                holder.innerHTML = parts.length ? parts.join('') : (content?.innerHTML || '');
              } catch {
                holder.innerHTML = content?.innerHTML || '';
              }
              asstWrap.appendChild(holder);
              appendImages(resp, asstWrap);
              turns.push(asstWrap);
              continue;
            }
          } catch {}
        }
        debugStore('turnCount', turns.length);
        return turns;
      } catch {
        return [];
      }
    }

    function innerHTMLFromTurn(turn) {
      try {
        if (turn?.getAttribute?.('data-acep-from-api') === '1') {
          const c = turn.querySelector?.('.acep-api-content');
          return c ? (c.innerHTML || '') : (turn.innerHTML || '');
        }
        if (!env.isGrok || !env.isGrok()) return '';
        return (turn && turn.innerHTML) ? String(turn.innerHTML) : '';
      } catch {
        return '';
      }
    }

    function getChatTitle() {
      try {
        if (!env.isGrok || !env.isGrok()) return (document.title || 'AI Conversation').trim();
        const h = document.querySelector('header h1');
        return (h?.textContent || document.title || 'AI Conversation').trim();
      } catch {
        return (document.title || 'AI Conversation').trim();
      }
    }

    function getSelectionRoleQueues(exportKeys = []) {
      try {
        if (!env.isGrok || !env.isGrok()) return null;
        const out = { user: [], assistant: [] };
        (exportKeys || []).forEach(k => {
          if (!k || !k.role) return;
          if (k.role === 'user' || k.role === 'assistant') out[k.role].push(k.idx);
        });
        return out;
      } catch {
        return null;
      }
    }

    async function loadArtifactsFromApi() {
      try {
        if (!env.isGrok || !env.isGrok()) return [];
        const cards = Array.from(document.querySelectorAll(sel.artifactCard || '[id^="artifact_card_"]'));
        if (!cards.length) return [];
        const results = [];
        for (const card of cards) {
          try {
            const id = String(card.id || '').replace(/^artifact_card_/, '').trim();
            if (!id) continue;
            if (card.dataset?.acepArtifactText && card.dataset?.acepArtifactTitle) {
              results.push({ id, title: card.dataset.acepArtifactTitle, text: card.dataset.acepArtifactText });
              continue;
            }
            const url = `https://grok.com/rest/app-chat/artifact_content/${id}`;
            const resp = await fetch(url, { credentials: 'include' });
            if (!resp.ok) continue;
            const json = await resp.json().catch(() => null);
            const full = (json && json.fullArtifact) ? String(json.fullArtifact) : '';
            if (!full) continue;
            const m = /<xaiArtifact\b[^>]*title="([^"]*)"[^>]*contentType="([^"]*)"[^>]*>([\s\S]*?)<\/xaiArtifact>/i.exec(full);
            const title = m && m[1] ? m[1] : '';
            const body = m && m[3] ? m[3] : '';
            if (card.dataset) {
              if (title) card.dataset.acepArtifactTitle = title;
              card.dataset.acepArtifactText = body || '';
              card.dataset.acepArtifactVersion = id;
            }
            try { card.setAttribute('data-acep-artifact-version', id); } catch {}
            try { if (title) card.setAttribute('data-acep-artifact-title', title); } catch {}
            try { if (body) card.setAttribute('data-acep-artifact-text', body); } catch {}
            results.push({ id, title, text: body });
          } catch {}
        }
        debugStore('artifactsLoaded', { ok: true, count: results.length });
        return results;
      } catch {
        return [];
      }
    }

    async function preScrape() {
      try {
        g.ACEP.providers.grok.__apiNetworkFailed = false;
        g.ACEP.providers.grok.__apiFailed = false;
      } catch {}
      // Fetch conversation turns from Grok API first
      try {
        const res = await fetchApiTurnNodesForCurrentChat();
        if (res && Array.isArray(res.nodes) && res.nodes.length) {
          g.ACEP.providers.grok.__apiTurnNodes = res.nodes;
          g.ACEP.providers.grok.__apiConvId = res.convId || '';
          g.ACEP.providers.grok.__apiTs = Date.now();
          debugStore('prescrape', { ok: true, mode: 'api', count: res.nodes.length });
        } else {
          // API returned empty/null — flag it so content.js can show proper error
          try { g.ACEP.providers.grok.__apiFailed = true; } catch {}
          debugStore('prescrape', { ok: true, mode: 'api_failed' });
        }
      } catch (e) {
        debugStore('prescrape_api_err', String(e?.message || e));
        try { g.ACEP.providers.grok.__apiFailed = true; } catch {}
        if (e instanceof TypeError || /failed to fetch|networkerror|network error/i.test(String(e?.message || ''))) {
          g.ACEP.providers.grok.__apiNetworkFailed = true;
        }
      }
      // Expose a small debug blob for quick user-side verification (no console digging required).
      try {
        const nodeCount = (() => {
          try {
            const n = g.ACEP?.providers?.grok?.__apiTurnNodes;
            return Array.isArray(n) ? n.length : 0;
          } catch { return 0; }
        })();
        const dbg = {
          href: String(location.href || ''),
          convId: String(g.ACEP.providers.grok.__apiConvId || getChatConvId() || ''),
          nodeCount,
          apiFailed: !!g.ACEP.providers.grok.__apiFailed,
          networkFailed: !!g.ACEP.providers.grok.__apiNetworkFailed,
          lastStatus: g.ACEP.providers.grok.__apiLastStatus || 0,
          lastErr: String(g.ACEP.providers.grok.__apiLastErr || ''),
          lastReason: String(g.ACEP.providers.grok.__apiLastReason || ''),
        };
        document.documentElement.setAttribute('data-acep-grok-api-dbg', JSON.stringify(dbg));
      } catch {}
      // Also load artifact contents so they can be inlined in exports
      await loadArtifactsFromApi().catch(() => {});
    }

    function postProcessExportRows({ rows, rowTurnMap, host, origin, effectiveFilter }) {
      try {
        if (!env.isGrok || !env.isGrok()) return;
        const hasSelectionFilter = !!(effectiveFilter || (window.__acepSelectedTurnIds && window.__acepSelectedTurnIds.length));
        const usingApiNodes = !!(g.ACEP?.providers?.grok?.__apiTurnNodes?.length);
        // If provider has weak role hints (DOM mode only), force a user/assistant alternation so bubbles line up correctly.
        // Skip when API nodes are in use (roles already correct) or when a selection filter is active.
        if (rows.length >= 2 && !hasSelectionFilter && !usingApiNodes) {
          for (let i = 0; i < rows.length; i++) {
            rows[i].role = (i % 2 === 0) ? 'user' : 'assistant';
          }
          // After forcing roles, refresh role labels so UI and PDF Text match the new roles
          rows.forEach(r => { r.roleLabel = getRoleLabel(r.role); });
        }
        for (const row of rows) {
          if (!row.html || !Array.isArray(row.imgs) || !row.imgs.length) continue;
          if (/data-acep-attachment-name=/i.test(row.html)) continue;
          const uniq = new Set();
          const normalizeName = (s = '') => String(s || '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
          const isLikelyFilename = (s = '') =>
            /\.(pdf|docx?|pptx?|xlsx?|zip|rar|7z|txt|md|csv|json|html?)(\b|$)/i.test(String(s || '').trim());
          const isGrokFileContentUrl = (u = '') => {
            try {
              const parsed = new URL(String(u || ''), origin);
              if (!/assets\.grok\.com$/i.test(parsed.hostname)) return false;
              const p = parsed.pathname || '';
              if (!/\/content$/i.test(p)) return false;
              if (/\.(png|jpe?g|gif|webp|avif|svg)(\?|#|$)/i.test(p)) return false;
              if (/\/generated\//i.test(p)) return false;
              if (/\/preview-image\b/i.test(p)) return false;
              return true;
            } catch { return false; }
          };
          const markers = row.imgs
            .map((im) => ({
              name: normalizeName(im?.alt || ''),
              src: String(im?.originalSrc || im?.src || '').trim(),
            }))
            .filter((x) => x.name && isLikelyFilename(x.name))
            .filter((x) => !x.src || isGrokFileContentUrl(x.src));
          for (const m of markers) {
            const key = m.name.toLowerCase();
            if (uniq.has(key)) continue;
            uniq.add(key);
            row.html += `<div data-acep-attachment-name="${escapeAttr(m.name)}"></div>`;
          }
        }
      } catch {}
    }

    // Provider API: roleFromTurn - determine if turn is user or assistant
    function roleFromTurn(turn) {
      try {
        const preset = turn?.getAttribute?.('data-acep-role');
        if (preset) return preset;
        // Grok: check CSS classes for items-end (user) vs items-start (assistant)
        const cls = (turn?.className || '').toLowerCase();
        if (/\bitems-end\b/.test(cls)) return 'user';
        if (/\bitems-start\b/.test(cls)) return 'assistant';
        return '';
      } catch {
        return '';
      }
    }

    // Provider API: getImageCaptionFromTurn - extract image caption
    function getImageCaptionFromTurn(turn) {
      try {
        if (!turn) return '';
        // Grok: captions are typically not exposed
        return '';
      } catch {
        return '';
      }
    }

    // Provider API: hasImages - check if turn contains images
    function hasImages(turn) {
      try {
        if (!turn || !turn.querySelector) return false;
        // Check for img elements
        if (turn.querySelector('img[src]:not([src*="avatar"]):not([src*="profile-picture"]):not([src*="favicon"])')) return true;
        // Check for source[srcset]
        if (turn.querySelector('source[srcset]')) return true;
        // Check for background images
        const allEls = turn.querySelectorAll('*');
        for (let el of allEls) {
          const bg = el.style?.backgroundImage || getComputedStyle(el)?.backgroundImage || '';
          if (/url\(/i.test(bg)) return true;
        }
        return false;
      } catch {
        return false;
      }
    }

    // Provider API: getImagesFromTurn - extract all images from turn
    function getImagesFromTurn(turn) { 
      try { 
        if (!turn || !turn.querySelectorAll) return []; 
        const images = []; 
        const seen = new Set(); 
        const isRenderableImageSrc = (src = '') => {
          const s = String(src || '').trim();
          if (!s) return false;
          if (/^data:image\//i.test(s)) return true;
          if (/^data:/i.test(s)) return false;
          if (/^https?:\/\//i.test(s) || /^\/\//.test(s) || s.startsWith('/')) return true;
          return false;
        };
        // Collect img elements 
        turn.querySelectorAll('img[src]').forEach(img => { 
          let src = img.currentSrc || img.getAttribute('src') || ''; 
          if (!src || /avatar|profile-picture|favicon/i.test(src)) return; 
          if (!isRenderableImageSrc(src)) return;
          // Skip link-card site icons: sole img inside an anchor with no alt text = favicon/site icon 
          const parentAnchor = img.closest('a[href]'); 
          if (parentAnchor && !img.getAttribute('alt') && parentAnchor.querySelectorAll('img[src]').length === 1) return; 
          const key = src.split('#')[0]; 
          if (!seen.has(key)) { 
            seen.add(key);
            images.push({ src, alt: img.getAttribute('alt') || '' });
          }
        });
        // Collect from source[srcset]
        turn.querySelectorAll('source[srcset]').forEach(s => { 
          const srcset = (s.getAttribute('srcset') || '').trim(); 
          if (!srcset) return; 
          const first = srcset.split(',')[0].trim().split(' ')[0].trim(); 
          if (first && isRenderableImageSrc(first)) { 
            const key = first.split('#')[0]; 
            if (!seen.has(key)) { 
              seen.add(key); 
              images.push({ src: first, alt: '' }); 
            } 
          } 
        });
        return images;
      } catch {
        return [];
      }
    }

    // Provider API: getGalleryCountFromTurn - count images in a turn
    function getGalleryCountFromTurn(turn) {
      try {
        if (!turn || !turn.querySelectorAll) return 0;
        const seen = new Set();
        let count = 0;
        turn.querySelectorAll('img[src]').forEach(img => {
          const src = (img.currentSrc || img.getAttribute('src') || '').split('#')[0];
          if (/avatar|profile-picture|favicon/i.test(src)) return;
          if (!seen.has(src)) {
            seen.add(src);
            count++;
          }
        });
        return count;
      } catch {
        return 0;
      }
    }

    g.ACEP.providers.grok.extractSelectableTurnNodes = extractSelectableTurnNodes;
    g.ACEP.providers.grok.isProtectedAsset = (u) => /^https?:\/\/assets\.grok\.com\//i.test(String(u || ''));
    g.ACEP.providers.grok.getTurnsForExport = getTurnsForExport;
    g.ACEP.providers.grok.fetchApiTurnNodesForCurrentChat = fetchApiTurnNodesForCurrentChat;
    g.ACEP.providers.grok.getChatConvId = getChatConvId;
    g.ACEP.providers.grok.roleFromTurn = roleFromTurn;
    g.ACEP.providers.grok.innerHTMLFromTurn = innerHTMLFromTurn;
    g.ACEP.providers.grok.getChatTitle = getChatTitle;
    g.ACEP.providers.grok.getImageCaptionFromTurn = getImageCaptionFromTurn;
    g.ACEP.providers.grok.hasImages = hasImages;
    g.ACEP.providers.grok.getImagesFromTurn = getImagesFromTurn;
    g.ACEP.providers.grok.getGalleryCountFromTurn = getGalleryCountFromTurn;
    g.ACEP.providers.grok.getSelectionRoleQueues = getSelectionRoleQueues;
    g.ACEP.providers.grok.loadArtifactsFromApi = loadArtifactsFromApi;
    g.ACEP.providers.grok.preScrape = preScrape;
    g.ACEP.providers.grok.postProcessExportRows = postProcessExportRows;

    debugStore('loaded', true);
    try { document.documentElement.setAttribute('data-acep-loaded-grok-provider', '1'); } catch {}
    // Version marker + default API debug blob (updated in preScrape).
    try {
          document.documentElement.setAttribute('data-acep-grok-scrape-rev', '2026-06-02k');
      if (!document.documentElement.getAttribute('data-acep-grok-api-dbg')) {
        document.documentElement.setAttribute('data-acep-grok-api-dbg', JSON.stringify({ ok: false, note: 'not_prescraped_yet' }));
      }
    } catch {}
  } catch (e) {
    console.error('[ACEP] Grok provider init error:', e);
  }
})();
