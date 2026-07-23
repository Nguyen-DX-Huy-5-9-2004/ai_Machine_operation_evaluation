// DeepSeek provider logic (content script side).
// This file should contain ONLY DeepSeek-specific DOM logic.
(function initDeepSeekProvider() {
  try {
    const g = (typeof globalThis !== 'undefined') ? globalThis : window;
    if (!/(^|\.)deepseek\.com$|(^|\.)chat\.deepseek\.com$/i.test(String(location?.hostname || ''))) return;
    if (!g.ACEP) g.ACEP = {};
    if (!g.ACEP.providers) g.ACEP.providers = {};
    g.ACEP.providers.deepseek = g.ACEP.providers.deepseek || {};

    const env = g.ACEP.env || {};
    const sel = (g.ACEP.providers.deepseek && g.ACEP.providers.deepseek.sel) || {};
    const getThreadContainer = (g.ACEP.providers.deepseek && g.ACEP.providers.deepseek.getThreadContainer) || (() => (document.querySelector('main') || document.body));
    const ORIGIN = (env && env.ORIGIN) ? env.ORIGIN : (location && location.origin) ? String(location.origin) : '';

    function isDeepSeekHost() {
      try {
        if (env && typeof env.isDeepSeek === 'function') return !!env.isDeepSeek();
      } catch {}
      try { return /deepseek\.com$/i.test(String(location && location.hostname)); } catch { return false; }
    }

    function debugStore(name, value) {
      try {
        g.ACEP.providers.deepseek.__debug = g.ACEP.providers.deepseek.__debug || {};
        g.ACEP.providers.deepseek.__debug[name] = value;
      } catch {}
      try {
        const slugBase = String(name || '').toLowerCase().replace(/[^a-z0-9_-]+/g, '-');
        const k1 = `data-acep-deepseek-${slugBase}`;
        const v = (typeof value === 'string') ? value : JSON.stringify(value);
        if (typeof v === 'string' && v.length <= 800) document.documentElement.setAttribute(k1, v);
      } catch {}
    }

    function normalizeAbsUrl(src) {
      try {
        const s = String(src || '').trim();
        if (!s) return '';
        if (/^(https?:|data:|blob:)/i.test(s)) return s;
        return new URL(s, ORIGIN).href;
      } catch {
        return String(src || '').trim();
      }
    }

    function escapeHtml(s = '') {
      return String(s || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    }

    function getAuthToken() {
      try {
        const raw = localStorage.getItem('userToken');
        if (!raw) return '';
        const parsed = JSON.parse(raw);
        const v = parsed && parsed.value;
        return (typeof v === 'string') ? v : '';
      } catch {
        return '';
      }
    }

    async function apiFetch(url, timeoutMs = 0) {
      const token = getAuthToken();
      if (!token) throw new Error('DeepSeek auth token not found. Please log in and try again.');

      const controller = new AbortController();
      const timer = timeoutMs > 0 ? setTimeout(() => controller.abort(), timeoutMs) : null;
      try {
        const resp = await fetch(url, {
          method: 'GET',
          credentials: 'include',
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/json',
          },
          signal: controller.signal,
        });
        if (!resp.ok) throw new Error(`DeepSeek API HTTP ${resp.status}`);
        const json = await resp.json();
        if (json?.code !== 0) throw new Error(`DeepSeek API error: ${json?.msg || 'Unknown error'}`);
        if (json?.data?.biz_code !== 0) throw new Error(`DeepSeek API biz error: ${json?.data?.biz_msg || 'Unknown error'}`);
        return json?.data?.biz_data;
      } finally {
        if (timer) clearTimeout(timer);
      }
    }

    function getChatSessionId() {
      try {
        const href = String(location?.href || '');
        const m =
          href.match(/\/a\/chat\/s\/([0-9a-f-]{6,})/i) ||
          href.match(/\/chat\/s\/([0-9a-f-]{6,})/i) ||
          href.match(/[?&]chat_session_id=([0-9a-f-]{6,})/i);
        if (m && m[1]) return m[1];
      } catch {}
      return '';
    }

    function getCurrentBranch(data) {
      try {
        if (!data?.chat_messages || !data?.chat_session) return [];
        const leafId = data.chat_session.current_message_id;
        const map = new Map();
        (data.chat_messages || []).forEach((msg) => {
          try {
            const id = msg?.message_id;
            if (id) map.set(id, msg);
          } catch {}
        });
        const branch = [];
        let cur = leafId;
        while (cur && map.has(cur)) {
          const msg = map.get(cur);
          branch.unshift(msg);
          cur = msg?.parent_id;
        }
        return branch;
      } catch {
        return [];
      }
    }

    function markdownToHtmlDeepseek(md = '') {
      if (!md) return '';
      const escapeHtmlLocal = (s = '') =>
        String(s || '').replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
      const decodeHtmlEntitiesLocal = (s = '') => {
        let out = String(s || '')
          .replace(/&nbsp;/gi, ' ')
          .replace(/&amp;/gi, '&')
          .replace(/&lt;/gi, '<')
          .replace(/&gt;/gi, '>')
          .replace(/&quot;/gi, '"')
          .replace(/&#39;/gi, "'");
        try {
          if (/&[a-z#0-9]+;/i.test(out)) {
            const txt = document.createElement('textarea');
            txt.innerHTML = out;
            out = txt.value;
          }
        } catch {}
        return out;
      };
      const normalizeDeepSeekHtmlLinks = (input = '') => {
        let out = String(input || '');
        try {
          out = out.replace(/<a\b[^>]*\bhref=(["'])(https?:\/\/[^"']+)\1[^>]*>([\s\S]*?)<\/a>/gi, (_m, _q, url, inner) => {
            const text = decodeHtmlEntitiesLocal(String(inner || '').replace(/<[^>]+>/g, '')).trim() || url;
            return `[${text}](${url})`;
          });
          out = out.replace(/<\/?(?:strong|b|span)\b[^>]*>/gi, '');
        } catch {}
        return out;
      };
      const guessCodeLang = (code = '') => {
        const s = String(code || '').trim();
        if (!s) return 'plaintext';
        if (/^\s*[{[][\s\S]*[}\]]\s*$/.test(s) && /"[^"]+"\s*:/.test(s)) return 'json';
        if (/^\s*<(!doctype|html|head|body|div|span|script|style|[a-z][\w:-]*\s)/i.test(s)) return 'html';
        if (/\b(import|export|const|let|var|function|class|return|async|await)\b|=>/.test(s)) return 'javascript';
        if (/\b(def|class|import|from|print|self|None|True|False)\b/.test(s) && /:\s*(#.*)?$/m.test(s)) return 'python';
        if (/\b(SELECT|INSERT|UPDATE|DELETE|CREATE|ALTER|FROM|WHERE|JOIN)\b/i.test(s)) return 'sql';
        if (/\b(display|position|color|background|font-size|grid-template|border-radius)\s*:/.test(s)) return 'css';
        if (/^\s*(#!\/bin\/|npm\s|pnpm\s|yarn\s|cd\s|echo\s|export\s|curl\s|git\s)/m.test(s)) return 'bash';
        return 'plaintext';
      };

      // DeepSeek sometimes returns pre-rendered HTML for code blocks (md-code-block).
      // Normalize those blocks into standard <pre><code class="language-..."> so our exporters behave consistently.
      try {
        const raw = String(md || '');
        if (/<div[^>]+class=["'][^"']*md-code-block/i.test(raw) && typeof DOMParser !== 'undefined') {
          const parser = new DOMParser();
          const doc = parser.parseFromString(`<div id="acep-root">${raw}</div>`, 'text/html');
          const root = doc.getElementById('acep-root') || doc.body;
          if (root) {
            root.querySelectorAll('.md-code-block').forEach((block) => {
              try {
                const lang = (block.querySelector('.md-code-block-banner-wrap .d813de27')?.textContent || '').trim();
                const pre = block.querySelector('pre');
                if (!pre) return;
                const codeText = (pre.innerText || pre.textContent || '').replace(/\r\n/g, '\n').trimEnd();
                if (!codeText) return;
                const preOut = doc.createElement('pre');
                const codeOut = doc.createElement('code');
                const key = (lang || guessCodeLang(codeText)).toLowerCase().replace(/[^a-z0-9_+-]+/g, '');
                codeOut.className = `language-${key || 'plaintext'}`;
                codeOut.textContent = codeText;
                preOut.appendChild(codeOut);
                block.replaceWith(preOut);
              } catch {}
            });
            // If any pre blocks still contain token spans, flatten to plain text.
            root.querySelectorAll('pre').forEach((pre) => {
              try {
                if (!pre.querySelector('code') && pre.querySelector('span')) {
                  const text = (pre.innerText || pre.textContent || '').replace(/\r\n/g, '\n').trimEnd();
                  const preOut = doc.createElement('pre');
                  const codeOut = doc.createElement('code');
                  codeOut.className = 'language-plaintext';
                  codeOut.textContent = text;
                  preOut.appendChild(codeOut);
                  pre.replaceWith(preOut);
                }
              } catch {}
            });
            return root.innerHTML || '';
          }
        }
      } catch {}

      // DeepSeek also sometimes wraps multi-line code in double-backticks instead of triple-fence:
      // ``bash ...lots of code (may contain `template literals`) ...``
      // Treat these as block code so inner backticks don't break inline parsing.
      try {
        const raw = String(md || '');
        // Only attempt when it looks like a multi-line double-backtick block.
        if (raw.includes('``') && /\n/.test(raw)) {
          const blocks = [];
          let i = 0;
          while (i < raw.length) {
            const open = raw.indexOf('``', i);
            if (open === -1) break;
            const close = raw.indexOf('``', open + 2);
            if (close === -1) break;
            const inside = raw.slice(open + 2, close);
            // Heuristic: only treat as code block when it contains at least one newline OR looks like a shell command.
            if (/\n/.test(inside) || /\b(sudo|cat|cp|sed|bash)\b/i.test(inside)) {
              blocks.push({ open, close: close + 2, inside });
            }
            i = close + 2;
          }
          if (blocks.length) {
            let out = '';
            let pos = 0;
            for (const b of blocks) {
              if (b.open < pos) continue;
              out += raw.slice(pos, b.open);
              // Try to infer language from the first token (e.g., "bash", "sh").
              const trimmed = String(b.inside || '').replace(/^\s+/, '');
              const firstLine = trimmed.split('\n')[0] || '';
              const mLang = firstLine.match(/^(bash|sh|zsh|shell|python|py|js|javascript|ts|typescript|json|html|css)\b/i);
              const lang = mLang ? mLang[1].toLowerCase() : 'plaintext';
              // Remove a leading "lang" marker from the code when present (e.g., "bash\n...")
              let codeBody = trimmed;
              if (mLang) {
                codeBody = trimmed.replace(new RegExp(`^${mLang[1]}\\b\\s*\\n?`, 'i'), '');
              }
              out += `\n\`\`\`${lang}\n${codeBody.replace(/\r\n/g, '\n')}\n\`\`\`\n`;
              pos = b.close;
            }
            out += raw.slice(pos);
            md = out;
          }
        }
      } catch {}

      md = normalizeDeepSeekHtmlLinks(md);

      // Normalize a few DeepSeek-specific markdown quirks before line parsing:
      // - Some models emit "1.. item" (double dot)
      // - Sometimes multiple ordered items appear on one line: "1. a 2. b"
      const symbolListRe = /^\s*(?:[\u2705\u2610\u2611\u2713\u2714]\ufe0f?|[0-9]\ufe0f?\u20e3)\s+/u;
      const inlineSymbolListRe = /(?:^|\s)(?:[\u2705\u2610\u2611\u2713\u2714]\ufe0f?|[0-9]\ufe0f?\u20e3)\s+/u;
      const rawLines = String(md || '').replace(/\r\n/g, '\n').split('\n');
      const lines = [];
      for (const rawLine of rawLines) {
        let line = String(rawLine || '');
        // Fix "1.. item" -> "1. item"
        line = line.replace(/^\s*(\d+)\.\.\s*/g, '$1. ');

        // If ordered items appear mid-line (e.g., "Try this: 1. a 2. b"), force them onto their own lines.
        // This allows the ordered-list parser to kick in instead of treating everything as one paragraph.
        try {
          if (/\d+\.\s+/.test(line) && !/^\s*\d+\.\s+/.test(line)) {
            // Insert newline before any " N. " that is preceded by non-digit/non-newline.
            line = line.replace(/([^\n\d])(\d+)\.\s+/g, (_m, pre, n) => `${pre}\n${n}. `);
          }
        } catch {}

        // Split "1. a 2. b" into separate lines when multiple ordered markers exist.
        try {
          const re = /(^|[^\d])(\d+)\.\s+/g;
          const matches = [];
          let m;
          while ((m = re.exec(line))) {
            const idx = m.index + m[1].length; // start of number
            matches.push({ idx });
            if (matches.length > 12) break;
          }
          if (matches.length >= 2) {
            for (let i = 0; i < matches.length; i++) {
              const start = matches[i].idx;
              const end = (i + 1 < matches.length) ? matches[i + 1].idx : line.length;
              const seg = line.slice(start, end).trim();
              if (seg) lines.push(seg);
            }
            continue;
          }
        } catch {}

        // Split inline symbol/checkmark lists like "âœ… Good â˜ Todo âœ”ï¸ Done".
        try {
          const trimmed = line.trim();
          if (inlineSymbolListRe.test(trimmed)) {
            const parts = trimmed
              .split(/(?<=\S)\s+(?=(?:[\u2705\u2610\u2611\u2713\u2714]\ufe0f?|[0-9]\ufe0f?\u20e3)\s)/u)
              .map(s => s.trim())
              .filter(Boolean);
            if (parts.length >= 2 && parts.every(p => symbolListRe.test(p))) {
              lines.push(...parts);
              continue;
            }
          }
        } catch {}

        lines.push(line);
      }
      let out = '';
      let i = 0;
      const inlineFmt = (raw = '') => {
        // Inline formatter that preserves raw LaTeX and escapes non-markup text safely.
        let s = String(raw || '');
        const safeHtmlTokens = [];
        const makeSafeToken = (html = '') => {
          const token = `\uE120${safeHtmlTokens.length}\uE121`;
          safeHtmlTokens.push(String(html || ''));
          return token;
        };
        try {
          s = s.replace(/<a\b[^>]*\bhref=(["'])(https?:\/\/[^"']+)\1[^>]*>([\s\S]*?)<\/a>/gi, (_m, _q, url, inner) => {
            const stripped = String(inner || '')
              .replace(/<[^>]+>/g, '')
              .trim();
            const text = decodeHtmlEntitiesLocal(stripped) || url;
            return makeSafeToken(`<a href="${escapeHtmlLocal(url)}" target="_blank" rel="noopener noreferrer">${escapeHtmlLocal(text)}</a>`);
          });
          s = s.replace(/<\/?(?:strong|b|span)\b[^>]*>/gi, '');
        } catch {}
        // Auto-link bare URLs/domains (common in DeepSeek responses), but NEVER inside inline code.
        // We only rewrite plain-text segments between backticks.
        const autoLinkPlainText = (seg = '') => {
          let t = String(seg || '');
          // Skip if this segment already contains markdown link syntax.
          if (/\[[^\]]+\]\([^)]+\)/.test(t)) return t;
          try {
            // Absolute URLs
            t = t.replace(/(^|[^\w\[(])((https?:\/\/)[^\s)<>]+)(?=$|[\s.,!?;:])/gi, (_m, pre, url) => {
              return `${pre}[${url}](${url})`;
            });
            // Optional: www.* without scheme
            t = t.replace(/(^|[^\w\[(])(www\.[^\s)<>]+)(?=$|[\s.,!?;:])/gi, (_m, pre, url) => {
              const full = `https://${url}`;
              return `${pre}[${url}](${full})`;
            });
          } catch {}
          return t;
        };
        try {
          const parts = [];
          const reCode = /`[^`]*`/g;
          let last = 0;
          let m;
          while ((m = reCode.exec(s))) {
            parts.push(autoLinkPlainText(s.slice(last, m.index)));
            parts.push(m[0]); // keep code segment intact
            last = m.index + m[0].length;
          }
          parts.push(autoLinkPlainText(s.slice(last)));
          s = parts.join('');
        } catch {}
        const pieces = [];
        let pos = 0;

        const pushText = (t) => { if (t) pieces.push(escapeHtmlLocal(t)); };
        const pushHtml = (h) => { if (h) pieces.push(h); };

        // Tokenize: prefer \(...\), then inline code `...`.
        // NOTE: Do NOT treat $...$ as math: DeepSeek chats often contain shell prompts and code with `$`.
        const re = /\\\((.+?)\\\)|`([^`]+)`/g;
        let m;
        while ((m = re.exec(s))) {
          const start = m.index;
          pushText(s.slice(pos, start));
          if (m[1] != null) {
            const tex = String(m[1] || '').trim();
            pushHtml(`<span data-math="${escapeHtmlLocal(tex)}" class="math-inline"></span>`);
          } else if (m[2] != null) {
            pushHtml(`<code>${escapeHtmlLocal(m[2])}</code>`);
          }
          pos = start + m[0].length;
        }
        pushText(s.slice(pos));
        let outHtml = pieces.join('');

        // Images (markdown) -> <img>
        outHtml = outHtml.replace(/!\[([^\]]*)\]\((https?:\/\/[^\s)]+|\/[^\s)]+)\)/g, (_m, alt, url) => {
          const u = String(url || '').trim();
          const a = String(alt || '').trim();
          return `<img src="${escapeHtmlLocal(u)}" data-original-src="${escapeHtmlLocal(u)}" alt="${escapeHtmlLocal(a)}">`;
        });
        // Links [text](url)
        outHtml = outHtml.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, (_m, text, url) => {
          return `<a href="${escapeHtmlLocal(url)}" target="_blank" rel="noopener">${escapeHtmlLocal(text)}</a>`;
        });
        // Bold / italic (simple)
        // NOTE: at this point, all non-markup text has already been escaped; keep replacements simple.
        outHtml = outHtml.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
        outHtml = outHtml.replace(/(^|[^\*])\*([^*]+)\*/g, '$1<em>$2</em>');
        try {
          outHtml = outHtml.replace(/\uE120(\d+)\uE121/g, (_m, n) => safeHtmlTokens[Number(n)] || '');
        } catch {}
        return outHtml;
      };
      const flushParagraph = (buf) => {
        const text = buf.join(' ').trim();
        if (!text) return '';
        return `<p>${inlineFmt(text)}</p>`;
      };
      const parseTable = (start) => {
        const rows = [];
        let j = start;
        while (j < lines.length && /\|/.test(lines[j])) {
          rows.push(lines[j]);
          j++;
        }
        if (rows.length < 2) return null;
        const sep = rows[1];
        if (!/^\s*\|?[\s:-]+\|/.test(sep)) return null;
        const parseRow = (row) =>
          row
            .trim()
            .replace(/^\|/, '')
            .replace(/\|$/, '')
            .split('|')
            .map((c) => inlineFmt(c.trim()));
        const header = parseRow(rows[0]);
        const body = rows.slice(2).map(parseRow);
        const thead = `<thead><tr>${header.map((h) => `<th>${h}</th>`).join('')}</tr></thead>`;
        const tbody = `<tbody>${body.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody>`;
        return { html: `<table>${thead}${tbody}</table>`, next: start + rows.length };
      };

      while (i < lines.length) {
        const line = lines[i];
        // Horizontal divider lines (DeepSeek users often paste underscore separators)
        if (/^\s*(?:_{8,}|(?:_\s*){3,}|(?:-\s*){3,}|(?:\*\s*){3,})\s*$/.test(line)) {
          out += '<hr>';
          i++;
          continue;
        }
        // Display math $$...$$ (single-line or multi-line block)
        if (/^\s*\$\$/.test(line)) {
          const singleLine = line.replace(/^\s*\$\$/, '').replace(/\$\$\s*$/, '').trim();
          let mathContent = '';
          if (singleLine) {
            mathContent = singleLine;
            i++;
          } else {
            i++;
            while (i < lines.length && !/^\s*\$\$\s*$/.test(lines[i])) {
              mathContent += (mathContent ? '\n' : '') + lines[i];
              i++;
            }
            i++;
          }
          if (mathContent.trim()) out += `<div data-math="${escapeHtmlLocal(mathContent.trim())}" class="math-block"></div>`;
          continue;
        }
        // Display math \[...\]
        if (/^\s*\\\[/.test(line)) {
          const singleLine = line.replace(/^\s*\\\[/, '').replace(/\\\]\s*$/, '').trim();
          let mathContent = '';
          if (singleLine) {
            mathContent = singleLine;
            i++;
          } else {
            i++;
            while (i < lines.length && !/^\s*\\\]\s*$/.test(lines[i])) {
              mathContent += (mathContent ? '\n' : '') + lines[i];
              i++;
            }
            i++;
          }
          if (mathContent.trim()) out += `<div data-math="${escapeHtmlLocal(mathContent.trim())}" class="math-block"></div>`;
          continue;
        }
        if (/^\s*```/.test(line)) {
          const lang = (line.match(/^\s*```(\S*)/) || [, ''])[1];
          let code = '';
          i++;
          while (i < lines.length && !/^\s*```/.test(lines[i])) {
            code += lines[i] + '\n';
            i++;
          }
          const langKey = (lang || guessCodeLang(code)).trim();
          out += `<pre><code class="language-${escapeHtmlLocal(langKey)}">${escapeHtmlLocal(code.trimEnd())}</code></pre>`;
          i++;
          continue;
        }
        // "Explanation:\nNext line..." should become separate paragraphs, not "Explanation: Next line..."
        try {
          const t = String(line || '').trim();
          const next = (i + 1 < lines.length) ? String(lines[i + 1] || '') : '';
          if (t && /:\s*$/.test(t) && next && next.trim()) {
            out += `<p>${inlineFmt(t)}</p>`;
            i++;
            continue;
          }
        } catch {}
        const tbl = parseTable(i);
        if (tbl) {
          out += tbl.html;
          i = tbl.next;
          continue;
        }
        if (/^\s*#{1,6}\s+/.test(line)) {
          const level = (line.match(/^\s*(#{1,6})\s+/) || [, '#'])[1].length;
          const text = line.replace(/^\s*#{1,6}\s+/, '').trim();
          out += `<h${level}>${inlineFmt(text)}</h${level}>`;
          i++;
          continue;
        }
        if (/^\s*[-*+]\s+/.test(line)) {
          const items = [];
          while (i < lines.length && /^\s*[-*+]\s+/.test(lines[i])) {
            items.push(lines[i].replace(/^\s*[-*+]\s+/, '').trim());
            i++;
          }
          out += `<ul>${items.map((it) => `<li>${inlineFmt(it)}</li>`).join('')}</ul>`;
          continue;
        }
        if (symbolListRe.test(line)) {
          const items = [];
          while (i < lines.length && symbolListRe.test(lines[i])) {
            items.push(lines[i].trim());
            i++;
          }
          out += `<ul style="list-style:none;padding-left:0.2em;">${items.map((it) => `<li>${inlineFmt(it)}</li>`).join('')}</ul>`;
          continue;
        }
        if (/^\s*\d+\.\.?\s+/.test(line)) {
          const items = [];
          while (i < lines.length && /^\s*\d+\.\.?\s+/.test(lines[i])) {
            items.push(lines[i].replace(/^\s*\d+\.\.?\s+/, '').trim());
            i++;
          }
          out += `<ol>${items.map((it) => `<li>${inlineFmt(it)}</li>`).join('')}</ol>`;
          continue;
        }
        if (!line.trim()) {
          i++;
          continue;
        }
        // Inline ordered lists sometimes come as a single line:
        // "Try this: 1. a 2. b 3. c"
        // Convert this into a proper <ol> while preserving any leading prefix text.
        try {
          const oneLine = String(line || '');
          const markerRe = /(^|[^\d])(\d+)\.\s+/g;
          const markers = [];
          let mm;
          while ((mm = markerRe.exec(oneLine))) {
            markers.push({ idx: mm.index + (mm[1] ? mm[1].length : 0), n: Number(mm[2]) });
            if (markers.length > 20) break;
          }
          if (markers.length >= 2) {
            const firstIdx = markers[0].idx;
            const prefixRaw = oneLine.slice(0, firstIdx).trim();
            const items = [];
            for (let k = 0; k < markers.length; k++) {
              const start = markers[k].idx;
              const end = (k + 1 < markers.length) ? markers[k + 1].idx : oneLine.length;
              const seg = oneLine.slice(start, end).trim();
              const cleaned = seg.replace(/^\d+\.\s+/, '').trim();
              if (cleaned) items.push(cleaned);
            }
            if (prefixRaw) out += `<p>${inlineFmt(prefixRaw)}</p>`;
            if (items.length) out += `<ol>${items.map((it) => `<li>${inlineFmt(it)}</li>`).join('')}</ol>`;
            i++;
            continue;
          }
        } catch {}
        const buf = [];
        // Paragraph accumulator: stop before block-structured lines (lists, code fences, headings, etc.)
        // so we don't swallow a list that starts on the next line (common in DeepSeek).
        if (i < lines.length) {
          buf.push(lines[i]);
          i++;
        }
        const isBlockStart = (ln = '') => {
          const s = String(ln || '');
          return (
            /^\s*```/.test(s) ||
            /^\s*(#{1,6})\s+/.test(s) ||
            /^\s*[-*+]\s+/.test(s) ||
            symbolListRe.test(s) ||
            /^\s*\d+\.\.?\s+/.test(s) ||
            /^\s*\$\$/.test(s) ||
            /^\s*\\\[/.test(s) ||
            // markdown tables or HTML tables
            (/^\s*\|/.test(s) && /\|/.test(s)) ||
            /<table\b/i.test(s)
          );
        };
        while (i < lines.length && lines[i].trim()) {
          if (buf.length && isBlockStart(lines[i])) break;
          buf.push(lines[i]);
          i++;
        }
        out += flushParagraph(buf);
      }

      return out;
    }

    function extractDeepSeekCitationSources(msg) {
      const sources = [];
      const seen = new Set();
      const addSource = (item, fallbackIndex = 0) => {
        try {
          if (!item || typeof item !== 'object') return;
          const rawUrl =
            item.url || item.link || item.href || item.source_url || item.sourceUrl ||
            item.web_url || item.webUrl || item.page_url || item.pageUrl ||
            item.reference_url || item.referenceUrl || item.site_url || item.siteUrl || '';
          const url = normalizeAbsUrl(rawUrl);
          if (!/^https?:\/\//i.test(url)) return;
          const key = url.replace(/#.*$/, '');
          if (seen.has(key)) return;
          seen.add(key);
          let host = '';
          try { host = new URL(url).hostname.replace(/^www\./i, ''); } catch {}
          const title = String(
            item.title || item.name || item.source || item.site_name || item.siteName ||
            item.publisher || item.display_url || item.displayUrl || host || url
          ).trim();
          const rawIndex = item.index || item.idx || item.num || item.number || item.citation_index || item.citationIndex || item.ref_index || item.refIndex || fallbackIndex;
          const index = Math.max(1, Number(rawIndex) || fallbackIndex || (sources.length + 1));
          sources.push({ index, title: title || url, url });
        } catch {}
      };

      const visit = (value, path = '', depth = 0) => {
        if (!value || depth > 5) return;
        if (Array.isArray(value)) {
          const citationLike = /(^|\.)(citations?|references?|sources?|search_results?|web_results?|websites?|links?)$/i.test(path);
          value.forEach((item, idx) => {
            if (citationLike) addSource(item, idx + 1);
            visit(item, `${path}[${idx}]`, depth + 1);
          });
          return;
        }
        if (typeof value !== 'object') return;
        addSource(value, 0);
        for (const [key, child] of Object.entries(value)) {
          if (/^(content|text|answer|message)$/i.test(key) && typeof child === 'string') continue;
          visit(child, path ? `${path}.${key}` : key, depth + 1);
        }
      };

      try { visit(msg, '', 0); } catch {}
      return sources.sort((a, b) => a.index - b.index);
    }

    function applyDeepSeekCitations(html = '', msg = {}) {
      let out = String(html || '');
      try {
        if (!/\[citation:\s*\d+\]/i.test(out)) return out;
        const protectedBlocks = [];
        out = out.replace(/<(pre|code)\b[\s\S]*?<\/\1>/gi, (block) => {
          const token = `@@ACEP_DEEPSEEK_CODE_${protectedBlocks.length}@@`;
          protectedBlocks.push(block);
          return token;
        });

        const sources = extractDeepSeekCitationSources(msg);
        const byIndex = new Map();
        sources.forEach((source, idx) => {
          const key = Number(source.index || (idx + 1));
          if (!byIndex.has(key)) byIndex.set(key, source);
        });
        out = out.replace(/\[citation:\s*(\d+)\]/gi, (_m, n) => {
          const index = Number(n) || 0;
          const source = byIndex.get(index);
          if (source?.url) {
            const title = escapeHtml(source.title || source.url);
            const url = escapeHtml(source.url);
            return `<a class="acep-citation-link" href="${url}" target="_blank" rel="noopener noreferrer" title="${title}" style="display:inline-flex;align-items:center;justify-content:center;min-width:18px;height:18px;margin:0 2px;padding:0 5px;border-radius:999px;background:#e5e7eb;color:#111827 !important;border:1px solid #cbd5e1;text-decoration:none;font-size:11px;font-weight:700;line-height:18px;vertical-align:baseline;"><span class="ds-markdown-cite acep-citation-chip" style="color:#111827 !important;background:transparent !important;">${index}</span></a>`;
          }
          return `<span class="acep-citation-chip" style="display:inline-flex;align-items:center;justify-content:center;min-width:18px;height:18px;margin:0 2px;padding:0 5px;border-radius:999px;background:#e5e7eb;color:#111827 !important;border:1px solid #cbd5e1;font-size:11px;font-weight:700;line-height:18px;vertical-align:baseline;">${index}</span>`;
        });

        protectedBlocks.forEach((block, index) => {
          out = out.replace(`@@ACEP_DEEPSEEK_CODE_${index}@@`, block);
        });
      } catch {}
      return out;
    }

    function extractFileItemsFromMessage(msg) {
      const out = [];
      const seen = new Set();
      const addItem = (it) => {
        try {
          if (!it || typeof it !== 'object') return;
          const fileId =
            it.file_id || it.fileId || it.id || it.uuid ||
            it.file_uuid || it.fileUuid || it.upload_id || it.uploadId ||
            it.biz_file_id || it.bizFileId || '';
          const name =
            it.file_name || it.fileName || it.name || it.filename ||
            it.original_name || it.originalName || it.display_name || it.displayName || '';
          const mime =
            it.mime_type || it.mime || it.type || it.content_type || it.contentType ||
            it.file_type || it.fileType || '';
          const size = it.file_size || it.size || it.bytes || 0;
          const url = it.url || it.preview_url || it.previewUrl || it.download_url || it.downloadUrl || it.file_url || it.fileUrl || '';
          const key = `${fileId}|${name}|${url}`;
          if ((!fileId && !name && !url) || seen.has(key)) return;
          seen.add(key);
          out.push({ fileId: String(fileId || ''), name: String(name || ''), mime: String(mime || ''), size: Number(size || 0), url: String(url || '') });
        } catch {}
      };
      try {
        const arrays = [
          msg?.files,
          msg?.file_list,
          msg?.attachments,
          msg?.uploads,
          msg?.message_files,
          msg?.file_items,
          msg?.fileInfos,
          msg?.file_infos,
          msg?.files_v2,
          msg?.resources,
          msg?.images,
        ].filter(Array.isArray);
        for (const arr of arrays) {
          for (const it of arr) addItem(it);
        }
        const scan = (value, depth = 0) => {
          if (!value || depth > 3) return;
          if (Array.isArray(value)) {
            value.forEach((item) => scan(item, depth + 1));
            return;
          }
          if (typeof value !== 'object') return;
          const keys = Object.keys(value);
          if (keys.some(k => /^(file_id|fileId|file_uuid|fileUuid|upload_id|uploadId|file_name|fileName|filename|mime_type|content_type)$/i.test(k))) {
            addItem(value);
          }
          for (const [key, child] of Object.entries(value)) {
            if (/^(content|text|answer|message)$/i.test(key) && typeof child === 'string') continue;
            if (/(file|image|upload|attachment|resource)/i.test(key)) scan(child, depth + 1);
          }
        };
        scan(msg, 0);
      } catch {}
      return out;
    }

    function buildApiTurnNode({ role = 'assistant', html = '', imgs = [], turnId = '' } = {}) {
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
        // Also include <img> tags so the core inliner can embed them for PDF/DOCX/HTML self.
        try {
          imgs.forEach((im) => {
            const src = String(im?.src || im?.originalSrc || '').trim();
            if (!src) return;
            const img = document.createElement('img');
            img.setAttribute('src', src);
            img.setAttribute('data-original-src', src);
            if (im?.alt) img.setAttribute('alt', String(im.alt));
            img.style.cssText = 'max-width:100%;height:auto;display:block;margin:8px 0;';
            content.appendChild(img);
          });
        } catch {}
      }
      return el;
    }

    async function fetchApiTurnNodesForCurrentChat(ctx = {}) {
      if (!isDeepSeekHost()) return null;
      const sessionId = getChatSessionId();
      if (!sessionId) {
        debugStore('apiScrape', { ok: false, reason: 'no chat_session_id in URL' });
        return null;
      }
      try {
        const prevId = g.ACEP?.providers?.deepseek?.__apiSessionId || '';
        const prevTs = Number(g.ACEP?.providers?.deepseek?.__apiTs || 0);
        const prevNodes = g.ACEP?.providers?.deepseek?.__apiTurnNodes;
        if (prevId && prevId === sessionId && Array.isArray(prevNodes) && prevNodes.length && (Date.now() - prevTs) < 2 * 60 * 1000) {
          debugStore('apiScrape', { ok: true, sessionId, count: prevNodes.length, cached: true });
          try {
            const prevPreview = String(g.ACEP?.providers?.deepseek?.__apiRawPreview || '');
            if (prevPreview) document.documentElement.setAttribute('data-acep-deepseek-apirawpreview', prevPreview.slice(0, 780));
          } catch {}
          return { sessionId, nodes: prevNodes };
        }
      } catch {}
      const url = new URL('/api/v0/chat/history_messages', ORIGIN);
      url.searchParams.set('chat_session_id', sessionId);
      url.searchParams.set('cache_version', '0');

      let data;
      try {
        data = await apiFetch(url.href);
      } catch (e) {
        debugStore('apiScrape', { ok: false, err: String(e?.message || e), sessionId });
        try { g.ACEP.providers.deepseek.__apiFailed = true; } catch {}
        if (e instanceof TypeError || /failed to fetch|networkerror|network error/i.test(String(e?.message || ''))) {
          try { g.ACEP.providers.deepseek.__apiNetworkFailed = true; } catch {}
        }
        return null;
      }
      const branch = getCurrentBranch(data);
      if (!branch.length) {
        debugStore('apiScrape', { ok: false, reason: 'empty branch', sessionId });
        try { g.ACEP.providers.deepseek.__apiFailed = true; } catch {}
        return null;
      }

      // Debug sample of raw API message content so users can diagnose parsing issues.
      // NOTE: DOM attributes are capped at ~800 chars by debugStore, so keep this very small.
      try {
        const sample = branch.slice(-1).map((m) => {
          const roleRaw = String(m?.role || '').toUpperCase();
          const role = (roleRaw === 'USER' || roleRaw === 'HUMAN') ? 'user' : 'assistant';
          const id = String(m?.message_id || m?.id || '');
          const text = (typeof m?.content === 'string') ? m.content : (typeof m?.text === 'string') ? m.text : '';
          const preview = String(text || '').slice(0, 240);
          return { id, role, preview, length: (text || '').length };
        });
        debugStore('apiRawSample', { ok: true, sessionId, sample });
      } catch {}
      try {
        // Expose last few raw message previews via DOM attributes (easy to copy from DevTools).
        const lastN = branch.slice(Math.max(0, branch.length - 3));
        const previews = lastN.map((m) => {
          const roleRaw = String(m?.role || '').toUpperCase();
          const role = (roleRaw === 'USER' || roleRaw === 'HUMAN') ? 'user' : 'assistant';
          const id = String(m?.message_id || m?.id || '');
          const text = (typeof m?.content === 'string') ? m.content : (typeof m?.text === 'string') ? m.text : '';
          const preview = String(text || '').slice(0, 1200);
          return { id, role, preview };
        });
        const json = JSON.stringify({ sessionId, previews }).slice(0, 3800);
        g.ACEP.providers.deepseek.__apiRawPreview = json;
        document.documentElement.setAttribute('data-acep-deepseek-apirawpreview', json);
      } catch {}

      const nodes = [];
      for (const msg of branch) {
        const roleRaw = String(msg?.role || '').toUpperCase();
        const role = (roleRaw === 'USER' || roleRaw === 'HUMAN') ? 'user' : 'assistant';
        const turnId = String(msg?.message_id || msg?.id || '');
        const text = (typeof msg?.content === 'string') ? msg.content : (typeof msg?.text === 'string') ? msg.text : '';
        let html = markdownToHtmlDeepseek(text);
        html = applyDeepSeekCitations(html, msg);
        // Debug: surface whether the raw text contained inline ordered markers, and whether we produced <ol>.
        try {
          if (role === 'assistant' && /\d+\.\s+/.test(String(text || ''))) {
            debugStore('list-dbg', {
              ok: true,
              id: String(turnId || ''),
              hasOl: /<ol\b/i.test(String(html || '')),
              textHead: String(text || '').slice(0, 260),
              htmlHead: String(html || '').slice(0, 260),
            });
          }
        } catch {}

        const fileItems = extractFileItemsFromMessage(msg);
        const imgs = [];
        const attachments = [];
        for (const f of fileItems) {
          const fileId = String(f?.fileId || '').trim();
          const name = String(f?.name || '').trim();
          const mime = String(f?.mime || '').toLowerCase();
          const isImage = /image\//i.test(mime) || /\.(png|jpe?g|gif|webp|bmp|svg|avif)$/i.test(name);
          if (isImage) {
            let src = String(f?.url || '').trim();
            if (src) {
              try { src = new URL(src, ORIGIN).href; } catch {}
            }
            if (!src) {
              const preview = new URL('/api/v0/file/preview', ORIGIN);
              if (fileId) preview.searchParams.set('file_id', fileId);
              preview.searchParams.set('chat_session_id', sessionId);
              const mid = String(msg?.message_id || msg?.id || '').trim();
              if (/^[0-9a-f]{8}-[0-9a-f-]{20,}$/i.test(mid)) preview.searchParams.set('message_id', mid);
              src = preview.href;
            }
            imgs.push({ src, originalSrc: src, alt: name || 'image', width: 900, height: 620, acepUpload: true });
          } else if (name) {
            attachments.push(name);
          }
        }
        if (attachments.length) {
          const seen = new Set();
          const markers = attachments
            .map((n) => String(n || '').trim())
            .filter(Boolean)
            .filter((n) => {
              const k = n.toLowerCase();
              if (seen.has(k)) return false;
              seen.add(k);
              return true;
            })
            .map((n) => `<div data-acep-attachment-name="${escapeHtml(n)}"></div>`)
            .join('');
          if (markers) html = `${html}${markers}`;
        }

        nodes.push(buildApiTurnNode({ role, html, imgs, turnId }));
      }

      debugStore('apiScrape', { ok: true, sessionId, count: nodes.length });
      return { sessionId, nodes };
    }

    function hasImages(container) {
      try {
        if (!container || !(container instanceof Element)) return false;
        const imageExtRe = /\.(png|jpe?g|gif|webp|bmp|svg)(?:[?#].*)?$/i;
        const urls = [];
        try {
          container.querySelectorAll('img').forEach(im => {
            const s = (im.currentSrc || im.src || '').trim();
            if (s) urls.push(s);
          });
          container.querySelectorAll('source[srcset]').forEach(s => {
            const set = (s.getAttribute('srcset') || '').trim();
            const first = set.split(',')[0]?.trim().split(' ')[0]?.trim();
            if (first) urls.push(first);
          });
          container.querySelectorAll('a[href]').forEach(a => {
            const h = (a.getAttribute('href') || '').trim();
            if (h) urls.push(h);
          });
          const fileNames = [];
          container.querySelectorAll(sel.fileChipAny || '.f3a54b52, [class*="f3a54b52" i], [data-testid*="file" i]').forEach(el => {
            const t = (el.textContent || '').trim();
            if (t) fileNames.push(t);
          });
          if (fileNames.some(n => imageExtRe.test(n))) return true;
          const chipText = (container.textContent || '').toLowerCase();
          if (imageExtRe.test(chipText)) return true;
        } catch {}
        return urls.some(u => {
          if (!u) return false;
          if (/deepseek-api-files|myhuaweicloud|obs\./i.test(u)) return true;
          if (/^data:image\//i.test(u) || /^blob:/i.test(u)) return true;
          return imageExtRe.test(u);
        });
      } catch {
        return false;
      }
    }

    function cssEsc(s) {
      try {
        if (globalThis.CSS && typeof globalThis.CSS.escape === 'function') return globalThis.CSS.escape(String(s || ''));
      } catch {}
      return String(s || '').replace(/["\\]/g, '\\$&');
    }

    function captureOverlayImages() {
      if (!isDeepSeekHost()) return [];
      const urls = [];
      try {
        const containers = Array.from(document.querySelectorAll(
          'div._519be07, [class*="_519be07" i], .ds-modal-wrapper, [class*="ds-modal-wrapper" i]'
        ));
        for (const c of containers) {
          const nameEl = c.querySelector('[role="heading"]');
          const altName = (nameEl?.textContent || '').trim();
          const imgs = Array.from(c.querySelectorAll('img[src]'));
          for (const im of imgs) {
            const s = im.currentSrc || im.getAttribute('src') || '';
            if (!s) continue;
            if (!/myhuaweicloud|deepseek-api-files|\bobs\.|\/api\//i.test(s)) continue;
            try { urls.push({ src: new URL(s, ORIGIN).href, alt: altName || (im.getAttribute('alt') || '') }); }
            catch { urls.push({ src: s, alt: altName || (im.getAttribute('alt') || '') }); }
          }
        }
      } catch {}
      const seen = new Set();
      return urls.filter(u => {
        const key = (u?.src || '').split('#')[0];
        if (!key || seen.has(key)) return false;
        seen.add(key); return true;
      });
    }

    async function autoRevealUploads() {
      if (!isDeepSeekHost()) return;
      const root = getThreadContainer() || document.body;
      if (!root) return;

      const chipItems = (() => {
        try {
          const candidates = Array.from(root.querySelectorAll('[tabindex][class*="_76cd190" i], [tabindex][class*="_0004e59" i]'))
            .filter(el => el && el.querySelector && el.querySelector(sel.fileChipAny || '.f3a54b52, [class*="f3a54b52" i]'));
          if (candidates.length) return candidates;
        } catch {}
        try {
          // Older DeepSeek builds use `_5cadb25` containers for upload chips.
          const chips = Array.from(root.querySelectorAll('div._5cadb25, [class*="_5cadb25" i]'))
            .filter(el => el && (el.querySelector?.(sel.fileChipAny || '.f3a54b52, [class*="f3a54b52" i]') || (el.textContent || '').trim().length));
          if (chips.length) return chips;
        } catch {}
        try {
          const nameEls = Array.from(root.querySelectorAll(sel.fileChipAny || '.f3a54b52, [class*="f3a54b52" i]'));
          const items = [];
          const seen = new Set();
          for (const n of nameEls) {
            const item = n.closest('[tabindex]') || n.closest('div') || null;
            if (!item) continue;
            if (seen.has(item)) continue;
            seen.add(item);
            items.push(item);
          }
          return items;
        } catch {
          return [];
        }
      })();
      if (!chipItems.length) return;

      const imageExtRe = /\.(png|jpe?g|gif|webp|bmp|svg)(?:[?#].*)?$/i;
      const nowSec = () => Math.floor(Date.now() / 1000);
      const urlLooksFresh = (u = '') => {
        try {
          const url = new URL(u, location.origin);
          const exp = Number(url.searchParams.get('Expires') || url.searchParams.get('expires') || '');
          if (!Number.isFinite(exp) || !exp) return true;
          return (exp - nowSec()) > 90;
        } catch {
          return true;
        }
      };

      const isCandidateUploadUrl = (u = '') => {
        try {
          const s = String(u || '').trim();
          if (!s) return false;
          if (/myhuaweicloud|deepseek-api-files|\bobs\./i.test(s)) return true;
          const abs = normalizeAbsUrl(s);
          const url = new URL(abs, ORIGIN);
          const host = url.hostname || '';
          const path = url.pathname || '';
          if (/deepseek\.com$/i.test(host) && (/\/api\/v0\/file\/(preview|content)\b/i.test(path) || /\/api\/.+\/(preview|content)\b/i.test(path))) return true;
        } catch {}
        return false;
      };

      const getAllCandidateUrls = () => {
        const els = Array.from(document.querySelectorAll(
          'a[href*="myhuaweicloud" i], a[href*="deepseek-api-files" i], ' +
          'img[src*="myhuaweicloud" i], img[src*="deepseek-api-files" i], ' +
          '[data-original-src*="myhuaweicloud" i], [data-original-src*="deepseek-api-files" i], ' +
          'a[href^="/api/" i], img[src^="/api/" i], [data-original-src^="/api/" i], [data-src^="/api/" i], ' +
          'a[href*="/api/" i], img[src*="/api/" i], [data-original-src*="/api/" i], [data-src*="/api/" i]'
        ));
        return els.map(el => {
          try {
            const href = el.getAttribute && el.getAttribute('href');
            const src = el.getAttribute && (el.getAttribute('src') || el.getAttribute('data-original-src') || el.getAttribute('data-src'));
            return (href || src || el.href || el.currentSrc || el.src || '').trim();
          } catch {
            return (el.href || el.currentSrc || el.src || '').trim();
          }
        }).filter(Boolean).filter(isCandidateUploadUrl);
      };

      const getPerfCandidateUrls = () => {
        const out = [];
        try {
          const perf = performance.getEntriesByType ? performance.getEntriesByType('resource') : [];
          const slice = perf.slice(Math.max(0, perf.length - 260));
          for (const e of slice) {
            const n = String(e?.name || '').trim();
            if (!n) continue;
            if (isCandidateUploadUrl(n)) out.push(n);
          }
        } catch {}
        return out;
      };

      const extractFilenameFromContentDisposition = (v = '') => {
        try {
          const s = String(v || '').trim();
          if (!s) return '';
          let decoded = s;
          try { decoded = decodeURIComponent(s); } catch {}
          const m1 = decoded.match(/filename\*\s*=\s*([^;]+)/i);
          const m2 = decoded.match(/filename\s*=\s*("?)([^";]+)\1/i);
          const raw = (m1 && m1[1]) ? m1[1] : (m2 && m2[2]) ? m2[2] : '';
          return String(raw || '').trim();
        } catch {
          return '';
        }
      };

      const urlMatchesName = (u = '', nameNorm = '') => {
        try {
          const url = new URL(u, location.origin);
          const qpName = url.searchParams.get('filename') || url.searchParams.get('fileName') || '';
          const rcd = url.searchParams.get('response-content-disposition') || '';
          const cdName = extractFilenameFromContentDisposition(rcd);
          const pathTail = (url.pathname.split('/').pop() || '').toLowerCase();
          const qpNorm = String(qpName || '').toLowerCase().replace(/\s+/g, ' ').trim();
          const cdNorm = String(cdName || '').toLowerCase().replace(/\s+/g, ' ').trim();
          if (!nameNorm) return true;
          if (qpNorm && qpNorm === nameNorm) return true;
          if (cdNorm && cdNorm === nameNorm) return true;
          if (pathTail && pathTail.includes(nameNorm)) return true;
          if (String(u || '').toLowerCase().includes(encodeURIComponent(nameNorm))) return true;
          return false;
        } catch {
          return !nameNorm;
        }
      };

      const usedUrlsByMsg = new WeakMap();
      const getUsedForMsg = (msgEl) => {
        const keyEl = (msgEl && msgEl.nodeType === 1) ? msgEl : root;
        let set = usedUrlsByMsg.get(keyEl);
        if (!set) {
          set = new Set();
          try {
            Array.from(keyEl.querySelectorAll('img[data-acep-temp="1"][src]'))
              .map(n => (n.getAttribute('src') || '').trim())
              .filter(Boolean)
              .forEach(u => set.add(u));
          } catch {}
          usedUrlsByMsg.set(keyEl, set);
        }
        return set;
      };

      for (const chip of chipItems) {
        try {
          const msg = chip.closest(sel.msgAny || '.ds-message, div.ds-message') || chip;
          const usedUrls = getUsedForMsg(msg);
          const nameEl = chip.querySelector(sel.fileChipAny || '.f3a54b52, [class*="f3a54b52" i]');
          const fileNameRaw = (nameEl?.textContent || '').trim();
          const fileName = (() => {
            const s = String(fileNameRaw || '').trim();
            if (!s) return '';
            const m = s.match(/([A-Za-z0-9][A-Za-z0-9._ -]*\.(?:png|jpe?g|gif|webp|bmp|svg))(?!\S)/i);
            if (m && m[1]) return m[1].trim();
            const parts = s.split(/\s+/).filter(Boolean);
            const hit = parts.find(p => imageExtRe.test(p));
            return (hit || parts[0] || s).trim();
          })();
          if (!fileName || !imageExtRe.test(fileName)) continue;
          const nameNorm = fileName.toLowerCase().replace(/\s+/g, ' ').trim();

          try {
            const candidates = Array.from(chip.querySelectorAll('img[src], img[data-original-src], a[href]'))
              .map(n => (n.getAttribute ? (n.getAttribute('href') || n.getAttribute('src') || n.getAttribute('data-original-src') || '') : '') || n.href || n.src || '')
              .map(s => String(s || '').trim())
              .filter(Boolean)
              .filter(u => isCandidateUploadUrl(u) && urlLooksFresh(u));
            const matching = candidates.filter(u => urlMatchesName(u, nameNorm));
            const existingReal = matching.find(u => !usedUrls.has(u)) || '';
            if (existingReal) {
              try { chip.querySelectorAll('img[data-acep-temp="1"]').forEach(n => n.remove()); } catch {}
              const img = document.createElement('img');
              img.setAttribute('src', existingReal);
              img.setAttribute('data-original-src', existingReal);
              img.setAttribute('data-acep-temp', '1');
              img.setAttribute('alt', fileName);
              img.style.cssText = 'display:none;max-width:100%';
              chip.appendChild(img);
              usedUrls.add(existingReal);
              continue;
            }
          } catch {}

          const existingTemp = Array.from(chip.querySelectorAll('img[data-acep-temp="1"][src]'))
            .map(n => (n.getAttribute('src') || '').trim())
            .filter(Boolean);
          const freshTemp = existingTemp.find(u => urlLooksFresh(u));
          if (freshTemp) {
            usedUrls.add(freshTemp);
            continue;
          }

          const before = new Set(getAllCandidateUrls());
          try { getPerfCandidateUrls().forEach(u => before.add(u)); } catch {}
          try { chip.scrollIntoView({ block: 'center', inline: 'nearest' }); } catch {}

          try {
            const events = [
              new PointerEvent('pointerdown', { bubbles: true, cancelable: true, pointerType: 'mouse' }),
              new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window }),
              new PointerEvent('pointerup', { bubbles: true, cancelable: true, pointerType: 'mouse' }),
              new MouseEvent('mouseup', { bubbles: true, cancelable: true, view: window }),
              new MouseEvent('click', { bubbles: true, cancelable: true, view: window }),
            ];
            events.forEach(ev => { try { chip.dispatchEvent(ev); } catch {} });
          } catch {}
          await new Promise(r => setTimeout(r, 50));

          const start = Date.now();
          let picked = '';
          let stopObs = null;
          const found = [];
          try {
            const obs = new MutationObserver(() => {
              try {
                const now = getAllCandidateUrls();
                for (const u of now) if (!before.has(u)) found.push(u);
              } catch {}
            });
            obs.observe(document.documentElement, { childList: true, subtree: true, attributes: true });
            stopObs = () => obs.disconnect();
          } catch {}

          while (Date.now() - start < 2200 && !picked) {
            await new Promise(r => setTimeout(r, 120));
            const overlayUrls = (() => {
              try { return (captureOverlayImages() || []).map(o => o && o.src).filter(Boolean); } catch { return []; }
            })();
            const perfNew = (() => {
              try { return getPerfCandidateUrls().filter(u => u && !before.has(u)); } catch { return []; }
            })();
            const nowAll = (overlayUrls.length
              ? overlayUrls
              : (found.length
                ? [...found]
                : [...getAllCandidateUrls().filter(u => !before.has(u)), ...perfNew]));
            for (const u of nowAll) {
              if (!u) continue;
              if (!urlMatchesName(u, nameNorm)) continue;
              if (usedUrls.has(u)) continue;
              picked = u;
              break;
            }
          }
          try { stopObs && stopObs(); } catch {}
          if (!picked) {
            try {
              const nowNew = [...getAllCandidateUrls(), ...getPerfCandidateUrls()].filter(u => u && !before.has(u));
              picked = nowNew.find(u => u && urlMatchesName(u, nameNorm) && !usedUrls.has(u)) || '';
            } catch {}
          }
          if (!picked) {
            // Final fallback: accept any new candidate URL even if it doesn't contain filename (e.g. /api/v0/file/preview).
            try {
              const nowNew = [...getAllCandidateUrls(), ...getPerfCandidateUrls()].filter(u => u && !before.has(u));
              picked = nowNew.find(u => u && isCandidateUploadUrl(u) && urlLooksFresh(u) && !usedUrls.has(u)) || '';
            } catch {}
          }

          if (picked) {
            try { chip.querySelectorAll('img[data-acep-temp="1"]').forEach(n => n.remove()); } catch {}
            const img = document.createElement('img');
            img.setAttribute('src', picked);
            img.setAttribute('data-original-src', picked);
            img.setAttribute('data-acep-temp', '1');
            if (fileName) img.setAttribute('alt', fileName);
            img.style.cssText = 'display:none;max-width:100%';
            chip.appendChild(img);
            try {
              chip.setAttribute('data-acep-upload-url', picked);
              chip.setAttribute('data-acep-upload-name', fileName || '');
            } catch {}
            usedUrls.add(picked);
          }

          try {
            document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
            document.dispatchEvent(new KeyboardEvent('keyup', { key: 'Escape', bubbles: true }));
          } catch {}
          try {
            const dialogs = Array.from(document.querySelectorAll('[role="dialog"], [class*="modal" i], [class*="overlay" i]'));
            for (const d of dialogs) {
              const btn = d.querySelector('button[aria-label*="close" i], [class*="close" i]');
              if (btn) { btn.click(); break; }
            }
          } catch {}
        } catch {}
      }

      debugStore('autoRevealUploads', { ok: true, chipCount: chipItems.length });
    }

    function htmlToPlainTextLocal(html = '') {
      try {
        const div = document.createElement('div');
        div.innerHTML = String(html || '');
        return (div.innerText || div.textContent || '').trim();
      } catch {
        return String(html || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      }
    }

    function postProcessExportRows(ctx = {}) {
      if (!isDeepSeekHost()) return;
      const rows = Array.isArray(ctx.rows) ? ctx.rows : [];
      const rowTurnMap = Array.isArray(ctx.rowTurnMap) ? ctx.rowTurnMap : [];
      if (!rows.length) return;

      const collectVisibleAnchorMap = () => {
        const map = new Map();
        try {
          document.querySelectorAll('a[href^="http"]').forEach((a) => {
            try {
              const href = normalizeAbsUrl(a.getAttribute('href') || a.href || '');
              if (!/^https?:\/\//i.test(href)) return;
              const text = String(a.innerText || a.textContent || '').replace(/\s+/g, ' ').trim();
              if (!text || text.length > 120) return;
              if (/^\d+$/.test(text)) return;
              const key = text.toLowerCase();
              if (!map.has(key)) map.set(key, { text, href });
            } catch {}
          });
        } catch {}
        return map;
      };

      const restorePlainTextLinks = (html = '', anchorMap = new Map()) => {
        if (!html || !anchorMap.size) return html;
        try {
          const div = document.createElement('div');
          div.innerHTML = String(html || '');
          const entries = Array.from(anchorMap.values())
            .filter(item => item && item.text && item.href)
            .sort((a, b) => b.text.length - a.text.length)
            .slice(0, 80);
          if (!entries.length) return html;
          const escapeRegExp = (s = '') => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const walker = document.createTreeWalker(div, NodeFilter.SHOW_TEXT, {
            acceptNode(node) {
              try {
                const parent = node.parentElement;
                if (!parent) return NodeFilter.FILTER_REJECT;
                if (parent.closest('a, code, pre, script, style')) return NodeFilter.FILTER_REJECT;
                const value = node.nodeValue || '';
                if (!value.trim()) return NodeFilter.FILTER_REJECT;
                return NodeFilter.FILTER_ACCEPT;
              } catch {
                return NodeFilter.FILTER_REJECT;
              }
            }
          });
          const textNodes = [];
          let node;
          while ((node = walker.nextNode())) textNodes.push(node);
          textNodes.forEach((textNode) => {
            let value = textNode.nodeValue || '';
            for (const item of entries) {
              if (!value || value.toLowerCase().indexOf(item.text.toLowerCase()) === -1) continue;
              const parts = value.split(new RegExp(`(${escapeRegExp(item.text)})`, 'i'));
              if (parts.length < 3) continue;
              const frag = document.createDocumentFragment();
              parts.forEach((part) => {
                if (!part) return;
                if (part.toLowerCase() === item.text.toLowerCase()) {
                  const a = document.createElement('a');
                  a.href = item.href;
                  a.target = '_blank';
                  a.rel = 'noopener noreferrer';
                  a.textContent = part;
                  frag.appendChild(a);
                } else {
                  frag.appendChild(document.createTextNode(part));
                }
              });
              textNode.parentNode && textNode.parentNode.replaceChild(frag, textNode);
              value = '';
              break;
            }
          });
          return div.innerHTML;
        } catch {
          return html;
        }
      };

      const isApiMode = (() => {
        try {
          return rowTurnMap.some((m) => m?.turn?.getAttribute?.('data-acep-from-api') === '1');
        } catch {
          return false;
        }
      })();

      // Role forcing for selection filters
      const effectiveFilter = ctx.effectiveFilter;
      if (effectiveFilter === 'user' || effectiveFilter === 'assistant' || effectiveFilter === 'images') {
        const forceRole = (effectiveFilter === 'assistant') ? 'assistant' : 'user';
        rows.forEach(r => { r.role = forceRole; });
      }

      // API mode already includes stable message ordering and preview URLs.
      // Still enrich visible matching user rows with extra upload images because DeepSeek's
      // API can expose only one file preview while the DOM contains multiple uploaded images.
      if (isApiMode) {
        let enrichedImages = 0;
        try {
          const anchorMap = collectVisibleAnchorMap();
          const normText = (s = '') => String(s || '').replace(/\s+/g, ' ').trim();
          const normUrl = (u = '') => {
            try { const url = new URL(String(u || ''), ORIGIN); url.hash = ''; return url.toString(); }
            catch { return String(u || '').split('#')[0]; }
          };
          const addImgToApiRow = (row, src, alt = '') => {
            if (!row || row.role !== 'user') return;
            const key = normUrl(src);
            if (!key) return;
            row.imgs = row.imgs || [];
            const seen = new Set((row.imgs || []).map(i => normUrl(i?.originalSrc || i?.src || '')));
            if (seen.has(key)) return;
            row.imgs.push({ src: key, originalSrc: key, alt: alt || 'uploaded image', width: 900, height: 620, acepUpload: true });
            try {
              const html = String(row.html || '');
              if (html.indexOf(key) === -1) {
                const safeSrc = escapeHtml(key);
                const safeAlt = escapeHtml(alt || 'uploaded image');
                row.html = `${html}<img src="${safeSrc}" data-original-src="${safeSrc}" data-acep-upload-img="1" data-acep-api-img="1" alt="${safeAlt}" style="max-width:100%;height:auto;display:block;margin:8px 0;border-radius:8px;">`;
              }
            } catch {}
            enrichedImages++;
          };
          const imageUrlsFromElement = (el) => {
            const out = [];
            const push = (src = '', alt = '') => {
              const raw = String(src || '').trim();
              if (!raw || /avatar|favicon/i.test(raw)) return;
              if (!/(^data:image\/|myhuaweicloud|deepseek-api-files|\bobs\.|\/api\/)/i.test(raw)) return;
              const abs = normalizeAbsUrl(raw);
              if (!abs) return;
              out.push({ src: abs, alt: alt || '' });
            };
            try {
              el.querySelectorAll('img[src], img[data-original-src], img[data-src]').forEach(img => {
                push(img.currentSrc || img.getAttribute('src') || img.getAttribute('data-original-src') || img.getAttribute('data-src') || '', img.getAttribute('alt') || '');
              });
              el.querySelectorAll('a[href], [data-acep-upload-url]').forEach(node => {
                push(node.getAttribute('data-acep-upload-url') || node.getAttribute('href') || '', node.textContent || '');
              });
            } catch {}
            const seen = new Set();
            return out.filter(item => {
              const key = normUrl(item.src);
              if (!key || seen.has(key)) return false;
              seen.add(key);
              return true;
            });
          };
          const visibleUsers = Array.from(document.querySelectorAll(sel.msgAny || '.ds-message, div.ds-message'))
            .map(msg => {
              const textEl = msg.querySelector(sel.userTextAny || '.fbb737a4, p.whitespace-pre-wrap.break-words') || msg;
              return { msg, text: normText(textEl.innerText || textEl.textContent || ''), images: imageUrlsFromElement(msg) };
            })
            .filter(item => item.text && item.images.length);
          rows.forEach(r => {
            if (r) r.html = restorePlainTextLinks(r.html || '', anchorMap);
            if (r && r.role === 'user') {
              const rowText = normText(htmlToPlainTextLocal(r.rawHtml || r.html || ''));
              const match = rowText ? visibleUsers.find(item => item.text === rowText || item.text.includes(rowText) || rowText.includes(item.text)) : null;
              if (match) match.images.forEach(im => addImgToApiRow(r, im.src, im.alt || ''));
            }
            if (r && r.role === 'assistant') {
              r.imgs = [];
              r.html = (r.html || '').replace(/<img\b[^>]*>/gi, '');
            }
          });
        } catch {}
        debugStore('postProcessRows', { ok: true, rowCount: rows.length, apiMode: true, enrichedImages });
        return;
      }

      const nearestUserRow = (fromIdx) => {
        if (!Number.isFinite(fromIdx)) return null;
        for (let i = fromIdx; i >= 0; i--) if (rows[i] && rows[i].role === 'user') return rows[i];
        for (let i = fromIdx; i < rows.length; i++) if (rows[i] && rows[i].role === 'user') return rows[i];
        return null;
      };
      const addImgToRow = (row, src, alt = '') => {
        if (!row || !src) return;
        row.imgs = row.imgs || [];
        const key = (src || '').split('#')[0];
        if (!key) return;
        const seen = new Set((row.imgs || []).map(i => (i.originalSrc || i.src || '').split('#')[0]));
        if (seen.has(key)) return;
        row.imgs.push({ src, originalSrc: src, alt: alt || 'uploaded image', width: 900, height: 620, acepUpload: true });
      };

      // 1) Overlay images: attach to the owning message (best-effort) or last user row.
      try {
        const overlayImgs = captureOverlayImages();
        if (overlayImgs.length) {
          overlayImgs.forEach(o => {
            let targetRow = null;
            try {
              const s = String(o?.src || '');
              const q = `img[src="${cssEsc(s)}"], a[href="${cssEsc(s)}"]`;
              const el = document.querySelector(q);
              const msg = el?.closest?.(sel.msgAny || '.ds-message, div.ds-message') || null;
              if (msg) {
                const match = rowTurnMap.find(m => m && m.turn && m.turn.contains && m.turn.contains(msg));
                if (match) targetRow = rows[match.rowIndex];
              }
            } catch {}
            if (targetRow && targetRow.role !== 'user') {
              targetRow = nearestUserRow(rows.indexOf(targetRow));
            }
            if (!targetRow) targetRow = [...rows].reverse().find(r => r && r.role === 'user') || null;
            if (targetRow) addImgToRow(targetRow, o.src, o.alt || '');
          });
        }
      } catch {}

      // 2) Chip filename-only attachments: attach to user row by nearest ds-message text match.
      try {
        const chips = Array.from(document.querySelectorAll('div._5cadb25, [class*="_5cadb25" i]'));
        if (chips.length) {
          const norm = (s = '') => String(s).replace(/\s+/g, ' ').trim();
          const userRows = rows.map((r, i) => ({
            i,
            role: r && r.role,
            text: norm(htmlToPlainTextLocal(r?.rawHtml || r?.html || '')),
          })).filter(x => x.role === 'user');
          for (const chip of chips) {
            const nameEl = chip.querySelector(sel.fileChipAny || '.f3a54b52, [class*="f3a54b52" i]');
            const fname = norm(nameEl?.textContent || '');
            if (!fname) continue;
            const msg = chip.closest(sel.msgAny || '.ds-message, div.ds-message');
            let msgText = '';
            try {
              const t = msg?.querySelector(sel.userTextAny || '.fbb737a4, p.whitespace-pre-wrap.break-words');
              msgText = norm(t?.innerText || t?.textContent || '');
            } catch {}
            let target = userRows.find(u => u.text && (u.text === msgText));
            if (!target && msgText) target = userRows.find(u => u.text && (u.text.includes(msgText) || msgText.includes(u.text)));
            if (!target) continue;
            const row = rows[target.i];
            row.imgs = row.imgs || [];
            const has = row.imgs.some(im => !im?.src && String(im?.alt || '').toLowerCase() === fname.toLowerCase());
            if (!has) row.imgs.push({ src: '', originalSrc: '', alt: fname, width: 0, height: 0 });
          }
        }
      } catch {}

      // 3) Inject globally discovered upload URLs (DOM + Resource Timing) into user rows.
      try {
        const uploadSel = sel.uploadUrlAny || 'a[href*="myhuaweicloud" i], a[href*="deepseek-api-files" i], img[src*="myhuaweicloud" i], img[src*="deepseek-api-files" i]';
        const allUrls = Array.from(document.querySelectorAll(uploadSel))
          .map(el => el.href || el.currentSrc || el.src)
          .filter(Boolean);
        try {
          const perf = performance.getEntriesByType ? performance.getEntriesByType('resource') : [];
          for (const e of perf) {
            const n = e && (e.name || '');
            if (/myhuaweicloud|deepseek-api-files/i.test(n)) allUrls.push(n);
          }
        } catch {}
        const normUrl = (u) => {
          try { const url = new URL(u, ORIGIN); url.hash = ''; return url.toString(); } catch { return String(u || ''); }
        };
        const existing = new Set();
        rows.forEach(r => (r.imgs || []).forEach(i => existing.add(normUrl(i.originalSrc || i.src || ''))));

        const userRows = rowTurnMap.filter(m => rows[m.rowIndex]?.role === 'user');
        userRows.forEach(({ rowIndex, turn }) => {
          const row = rows[rowIndex];
          if (!turn || !turn.querySelectorAll) return;
          const nodes = Array.from(turn.querySelectorAll(uploadSel));
          nodes.forEach(n => {
            const raw = n.href || n.currentSrc || n.src || '';
            if (!raw || /avatar/i.test(raw)) return;
            const key = normUrl(raw);
            if (!key || existing.has(key)) return;
            existing.add(key);
            addImgToRow(row, raw, n.getAttribute?.('alt') || '');
          });
        });

        const attachTo = [...rows].reverse().find(r => r && r.role === 'user') || null;
        if (attachTo) {
          for (const raw of allUrls) {
            if (/avatar/i.test(raw)) continue;
            const key = normUrl(raw);
            if (!key || existing.has(key)) continue;
            existing.add(key);
            addImgToRow(attachTo, raw, '');
          }
        }
      } catch {}

      // 4) DeepSeek assistant bubbles can echo images/anchors: strip them (we keep them on user turn only).
      try {
        rows.forEach(r => {
          if (r && r.role === 'assistant') {
            r.imgs = [];
            r.html = (r.html || '').replace(/<img\b[^>]*>/gi, '');
          }
        });
      } catch {}

      debugStore('postProcessRows', { ok: true, rowCount: rows.length });
    }

    function extractSelectableTurnNodes() {
      try {
        if (!env.isDeepSeek || !env.isDeepSeek()) return [];
        const root = getThreadContainer() || document.body;
        if (!root) return [];
        const messages = Array.from(root.querySelectorAll(sel.msgAny || '.ds-message, div.ds-message'));
        const turns = [];
        messages.forEach(msg => {
          const asstEl = msg.querySelector(sel.asstMarkdown || '.ds-markdown');
          if (asstEl) {
            try { asstEl.setAttribute('data-acep-role', 'assistant'); } catch {}
            turns.push(asstEl);
            return;
          }
          const userTextEl = msg.querySelector(sel.userTextAny || '.fbb737a4, p.whitespace-pre-wrap.break-words');
          const hasText = !!((userTextEl?.innerText || userTextEl?.textContent || '').trim());
          const hasImgs = hasImages(msg);
          if (hasText || hasImgs) {
            try { msg.setAttribute('data-acep-role', 'user'); } catch {}
            turns.push(msg);
          }
        });
        debugStore('turnCount', turns.length);
        return turns;
      } catch {
        return [];
      }
    }

    /* Removed: DeepSeek virtual-list sweep/cache (API-first export in preScrape).
    async function buildDeepSeekExportCache({ maxMs = 35000 } = {}) {
      if (!isDeepSeekHost()) return { ok: false, reason: 'not deepseek' };
      const cache = getDeepSeekExportCacheContainer();
      if (!cache) return { ok: false, reason: 'no cache container' };

      const href = (() => { try { return String(location.href || ''); } catch { return ''; } })();
      const now = Date.now();
      const lastHref = cache.getAttribute('data-acep-href') || '';
      const lastTs = Number(cache.getAttribute('data-acep-ts') || '0');
      const lastCount = Number(cache.getAttribute('data-acep-count') || '0');
      if (lastCount > 8 && lastHref === href && (now - lastTs) < 10 * 60 * 1000) {
        return { ok: true, cached: true, count: lastCount };
      }

      const scrollable = findDeepSeekScrollable();
      const root = getThreadContainer() || document.body;
      if (!scrollable || !root) return { ok: false, reason: 'no scrollable/root' };

      const start = performance.now();
      const startTop = (() => { try { return scrollable.scrollTop || 0; } catch { return 0; } })();
      const viewH = () => Math.max(1, scrollable.clientHeight || 800);
      const totalFor = () => Math.max(0, (scrollable.scrollHeight || 0) - viewH());
      const desiredSteps = 200;
      const stepFor = (totalNow) => Math.max(Math.round(viewH() * 0.85), Math.ceil(Math.max(0, totalNow) / desiredSteps));

      const seen = new Set();
      const clones = [];

      const setScrollTop = async (y) => {
        try {
          if (typeof scrollable.scrollTo === 'function') scrollable.scrollTo({ top: y, left: 0, behavior: 'instant' });
          else scrollable.scrollTop = y;
        } catch {
          try { scrollable.scrollTop = y; } catch {}
        }
        try { scrollable.dispatchEvent(new Event('scroll', { bubbles: true })); } catch {}
        await new Promise(r => requestAnimationFrame(() => r()));
      };

      const capture = () => {
        const before = seen.size;
        const vis = collectVisibleExportTurns(root);
        for (const { role, node } of vis) {
          if (!node) continue;
          const txt = normKey(node.innerText || node.textContent || '');
          let img = '';
          try {
            const im = node.querySelector && node.querySelector('img[src]');
            const raw = (im?.currentSrc || im?.getAttribute?.('src') || '').split('#')[0];
            img = normalizeAbsUrl(raw);
          } catch {}
          if (!txt && !img) continue;
          const key = `${role}|${txt}|${img}`;
          if (seen.has(key)) continue;
          seen.add(key);
          try {
            const c = node.cloneNode(true);
            c.setAttribute('data-acep-role', role);
            // If autoRevealUploads tagged chips with resolved URLs, append visible <img> so exporters can inline them.
            try {
              const chips = Array.from(c.querySelectorAll('[data-acep-upload-url]')).slice(0, 12);
              if (chips.length) {
                const seenUrls = new Set();
                chips.forEach(ch => {
                  try {
                    const u = normalizeAbsUrl(ch.getAttribute('data-acep-upload-url') || '');
                    if (!u || seenUrls.has(u)) return;
                    seenUrls.add(u);
                    const name = (ch.getAttribute('data-acep-upload-name') || '').trim();
                    const img = document.createElement('img');
                    img.setAttribute('src', u);
                    img.setAttribute('data-original-src', u);
                    if (name) img.setAttribute('alt', name);
                    img.style.cssText = 'max-width:100%;display:block;margin:10px 0;border-radius:8px;';
                    c.appendChild(img);
                  } catch {}
                });
              }
            } catch {}
            clones.push(c);
          } catch {}
        }
        return seen.size - before;
      };

      // Try to load older items at the top (DeepSeek may lazy-load when you dwell at the top).
      try {
        let lastH = scrollable.scrollHeight || 0;
        for (let i = 0; i < 12 && (performance.now() - start) < (maxMs * 0.45); i++) {
          await setScrollTop(0);
          await new Promise(r => setTimeout(r, 420));
          capture();
          const h = scrollable.scrollHeight || 0;
          if (h <= lastH + 40) break;
          lastH = h;
        }
      } catch {}

      // Sweep from top->bottom capturing the moving viewport (defeats virtualization).
      let noNew = 0;
      let totalNow = totalFor();
      let step = stepFor(totalNow);
      for (let i = 0; i <= (desiredSteps + 12) && (performance.now() - start) < maxMs; i++) {
        totalNow = totalFor();
        step = stepFor(totalNow);
        const y = Math.min(totalNow, i * step);
        await setScrollTop(y);
        await new Promise(r => setTimeout(r, 140));
        const added = capture();
        noNew = added ? 0 : (noNew + 1);
        if (y >= totalNow && noNew >= 4) break;
      }
      // Snap bottom once.
      await setScrollTop(totalFor());
      await new Promise(r => setTimeout(r, 160));
      capture();
      // Restore position.
      try { await setScrollTop(startTop); } catch {}

      try { cache.innerHTML = ''; } catch {}
      clones.forEach((c, i) => {
        try {
          c.setAttribute('data-acep-export-idx', String(i));
          c.setAttribute('data-acep-turn-id', String(i));
          cache.appendChild(c);
        } catch {}
      });
      try {
        cache.setAttribute('data-acep-href', href);
        cache.setAttribute('data-acep-ts', String(Date.now()));
        cache.setAttribute('data-acep-count', String(clones.length));
      } catch {}
      try {
        const sample = (n) => normKey((n?.innerText || n?.textContent || '')).slice(0, 90);
        const s1 = clones[0] ? sample(clones[0]) : '';
        const s2 = clones[1] ? sample(clones[1]) : '';
        const sl = clones.length ? sample(clones[clones.length - 1]) : '';
        debugStore('exportCacheSamples', { first: s1, second: s2, last: sl });
      } catch {}
      debugStore('exportCache', { ok: true, count: clones.length, unique: seen.size, ms: Math.round(performance.now() - start) });
      return { ok: true, count: clones.length };
    }
    */

    function getTurnsForExport() {
      // Prefer API turn nodes when available; DeepSeek uses virtualization so DOM can be incomplete.
      try {
        const apiNodes = g.ACEP?.providers?.deepseek?.__apiTurnNodes;
        if (Array.isArray(apiNodes) && apiNodes.length) return apiNodes;
      } catch {}
      // If API failed, do not silently fall back to a partial DOM export.
      try {
        if (g.ACEP?.providers?.deepseek?.__apiFailed || g.ACEP?.providers?.deepseek?.__apiNetworkFailed) {
          return [];
        }
      } catch {}
      return extractSelectableTurnNodes();
    }

    function innerHTMLFromTurn(turn) {
      try {
        if (!turn) return '';
        try {
          const fromApi = turn.getAttribute && turn.getAttribute('data-acep-from-api') === '1';
          if (fromApi) {
            const c = turn.querySelector && turn.querySelector('.acep-api-content');
            if (c) return c.innerHTML || '';
          }
        } catch {}
        return turn.innerHTML || '';
      } catch {
        return '';
      }
    }

    function getChatTitle() {
      try {
        return (document.title || 'AI Conversation').trim();
      } catch {
        return 'AI Conversation';
      }
    }

    // Provider API: roleFromTurn - determine if turn is user or assistant
    function roleFromTurn(turn) {
      try {
        const preset = turn?.getAttribute?.('data-acep-role');
        if (preset) return preset;
        // DeepSeek: check for assistant markdown
        if (turn?.querySelector?.('.ds-markdown') || turn?.matches?.('.ds-markdown')) return 'assistant';
        // DeepSeek: user turns are .ds-message without markdown
        if (turn?.matches?.('.ds-message') || turn?.closest?.('.ds-message')) return 'user';
        return '';
      } catch {
        return '';
      }
    }

    // Provider API: getImageCaptionFromTurn - extract image caption
    function getImageCaptionFromTurn(turn) {
      try {
        if (!turn) return '';
        // DeepSeek: captions are typically not exposed
        return '';
      } catch {
        return '';
      }
    }

    // Provider API: getImagesFromTurn - extract all images from turn
    function getImagesFromTurn(turn) {
      try {
        if (!turn || !turn.querySelectorAll) return [];
        try {
          const raw = turn.getAttribute && turn.getAttribute('data-acep-imgs');
          if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed) && parsed.length) {
              return parsed.map((im) => ({
                src: im?.src || im?.originalSrc || '',
                originalSrc: im?.originalSrc || im?.src || '',
                alt: im?.alt || '',
                width: im?.width || im?.w || 900,
                height: im?.height || im?.h || 620,
                w: im?.w || im?.width || 900,
                h: im?.h || im?.height || 620,
                acepUpload: !!im?.acepUpload,
              })).filter((im) => String(im.src || im.originalSrc || '').trim());
            }
          }
        } catch {}
        const images = [];
        const seen = new Set();
        // Collect img elements
        turn.querySelectorAll('img[src]').forEach(img => {
          let src = img.currentSrc || img.getAttribute('src') || '';
          if (!src || /avatar|favicon/i.test(src)) return;
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
          if (first) {
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

    async function preScrape() {
      // DeepSeek UI is virtualized; prefer API-first export to avoid missing turns.
      try {
        const ctx = arguments && arguments[0] ? arguments[0] : {};
        // Sidebar selection provides IDs; we can still use API-first export and let buildCleanHTML
        // filter by selectedTurnIds using data-acep-turn-id. Avoid falling back to DOM on DeepSeek,
        // because virtualization can cause missing turns.
        const res = await fetchApiTurnNodesForCurrentChat(ctx);
        if (res && Array.isArray(res.nodes) && res.nodes.length) {
          g.ACEP.providers.deepseek.__apiTurnNodes = res.nodes;
          g.ACEP.providers.deepseek.__apiSessionId = res.sessionId || '';
          g.ACEP.providers.deepseek.__apiTs = Date.now();
          return;
        }
      } catch (e) {
        debugStore('apiScrapeError', { ok: false, err: String(e?.message || e) });
      }
      // Fallback: DOM-only (no caching/sweeping). This may be incomplete on virtualized chats,
      // but avoids confusing UI jumps/hangs.
      try { await autoRevealUploads(); } catch {}
    }

    function getInlineImageFetchOptions(src = '') {
      try {
        const s = String(src || '').trim();
        if (!s) return null;
        const url = new URL(s, ORIGIN);
        // DeepSeek image/file preview endpoints require Bearer auth (same as the UI fetches).
        if (/deepseek\.com$/i.test(url.hostname) && /\/api\/v0\/file\/(preview|content)\b/i.test(url.pathname)) {
          const token = getAuthToken();
          if (!token) return null;
          return { headers: { Authorization: `Bearer ${token}` } };
        }
      } catch {}
      return null;
    }

    function isProtectedAsset(src = '') {
      try {
        const url = new URL(String(src || '').trim(), ORIGIN);
        const host = url.hostname || '';
        const path = url.pathname || '';
        if (/deepseek\.com$/i.test(host) && /\/api\/v0\/file\/(preview|content)\b/i.test(path)) return true;
        if (/deepseek\.com$/i.test(host) && /\/api\/.+\/(preview|content)\b/i.test(path)) return true;
        if (/deepseek-api-files|myhuaweicloud|\bobs\./i.test(host)) return true;
      } catch {}
      return false;
    }

    g.ACEP.providers.deepseek.extractSelectableTurnNodes = extractSelectableTurnNodes;
    g.ACEP.providers.deepseek.isProtectedAsset = isProtectedAsset;
    g.ACEP.providers.deepseek.getTurnsForExport = getTurnsForExport;
    g.ACEP.providers.deepseek.roleFromTurn = roleFromTurn;
    g.ACEP.providers.deepseek.innerHTMLFromTurn = innerHTMLFromTurn;
    g.ACEP.providers.deepseek.getChatTitle = getChatTitle;
    g.ACEP.providers.deepseek.getImageCaptionFromTurn = getImageCaptionFromTurn;
    g.ACEP.providers.deepseek.hasImages = hasImages;
    g.ACEP.providers.deepseek.getImagesFromTurn = getImagesFromTurn;
    g.ACEP.providers.deepseek.getInlineImageFetchOptions = getInlineImageFetchOptions;
    g.ACEP.providers.deepseek.getGalleryCountFromTurn = getGalleryCountFromTurn;
    g.ACEP.providers.deepseek.captureOverlayImages = captureOverlayImages;
    g.ACEP.providers.deepseek.autoRevealUploads = autoRevealUploads;
    g.ACEP.providers.deepseek.postProcessExportRows = postProcessExportRows;
    g.ACEP.providers.deepseek.preScrape = preScrape;

    debugStore('loaded', true);
    try { document.documentElement.setAttribute('data-acep-loaded-deepseek-provider', '1'); } catch {}
  } catch {}
})();
