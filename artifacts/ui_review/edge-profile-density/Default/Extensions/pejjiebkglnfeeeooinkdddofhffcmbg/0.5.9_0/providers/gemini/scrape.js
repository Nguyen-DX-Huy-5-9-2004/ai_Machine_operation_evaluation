// Gemini provider logic (content script side).
// This file should contain ONLY Gemini-specific DOM logic.
(function initGeminiProvider() {
  try {
    const g = (typeof globalThis !== 'undefined') ? globalThis : window;
    if (!/(^|\.)gemini\.google\.com$/i.test(String(location?.hostname || ''))) return;
    if (!g.ACEP) g.ACEP = {};
    if (!g.ACEP.providers) g.ACEP.providers = {};
    g.ACEP.providers.gemini = g.ACEP.providers.gemini || {};

    const env = g.ACEP.env || {};
    const sel = (g.ACEP.providers.gemini && g.ACEP.providers.gemini.sel) || {};
    const getThreadContainer = (g.ACEP.providers.gemini && g.ACEP.providers.gemini.getThreadContainer) || (() => (document.querySelector('main') || document.body));
    const ORIGIN = (env && env.ORIGIN) ? env.ORIGIN : (location && location.origin) ? String(location.origin) : '';

    function debugStore(name, value) {
      try {
        g.ACEP.providers.gemini.__debug = g.ACEP.providers.gemini.__debug || {};
        g.ACEP.providers.gemini.__debug[name] = value;
      } catch {}
      try {
        const slugBase = String(name || '').toLowerCase().replace(/[^a-z0-9_-]+/g, '-');
        const k1 = `data-acep-gemini-${slugBase}`;
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

    function escapeHtmlGemini(s) {
      return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    }

    function getChatConvId() {
      try {
        const m = location.pathname.match(/\/app\/([a-f0-9]+)/i);
        return m ? m[1] : '';
      } catch { return ''; }
    }

    function extractGeminiTokens() {
      try {
        const html = document.documentElement.innerHTML;
        const blM = html.match(/boq_assistant-bard-web-server[^"'\s]+/);
        const atM = html.match(/"SNlM0e":"([^"]+)"/);
        const sidM = html.match(/"FdrFJe":"(-?\d+)"/);
        return {
          bl: blM ? blM[0] : '',
          at: atM ? atM[1] : '',
          sid: sidM ? sidM[1] : ''
        };
      } catch { return { bl: '', at: '', sid: '' }; }
    }

    function markdownToHtmlGemini(md, opts = {}) {
      try {
        if (!md) return '';
        let s = String(md);
        // Gemini sometimes escapes list markers like `2\.`; normalize so our list parser and HTML look correct.
        s = s.replace(/^(\s*\d+)\s*\\\./gm, '$1.');
        // Gemini sometimes returns blockquote markers that don't show in the UI; strip them.
        s = s.replace(/^\s*>\s?/gm, '');
        // Gemini API citation markers: replace [cite: 1, 2] inline when API source metadata exists.
        const geminiCitations = Array.isArray(opts.citations) ? opts.citations : [];
        const geminiCitationTokens = new Map();
        const geminiCitationChip = (c) => {
          const label = escapeHtmlGemini(String(c?.title || c?.label || 'Source'));
          const url = String(c?.url || '').trim();
          if (/^https?:\/\//i.test(url)) return '<a class="acep-gemini-citation-chip" href="' + escapeHtmlGemini(url) + '" target="_blank" rel="noopener noreferrer">' + label + '</a>';
          return '<span class="acep-gemini-citation-chip">' + label + '</span>';
        };
        s = s.replace(/\[cite_start\]/g, '');
        s = s.replace(/\[cite:\s*([\d,\s]+)\]/g, (_m, nums) => {
          const chips = String(nums || '').split(',')
            .map((n) => parseInt(String(n || '').trim(), 10))
            .filter((n) => Number.isFinite(n) && n > 0)
            .map((n) => geminiCitations[n - 1])
            .filter(Boolean)
            .map(geminiCitationChip);
          return chips.length ? '<span class="acep-gemini-citations">' + chips.join(' ') + '</span>' : '';
        });
        if (geminiCitations.length && !/acep-gemini-citation-chip/.test(s)) {
          const groups = new Map();
          geminiCitations.forEach((c) => {
            const end = Number(c?.end);
            if (!Number.isFinite(end) || end <= 0 || end > s.length) return;
            const list = groups.get(end) || [];
            if (!list.some((x) => String(x.url || '') === String(c.url || ''))) list.push(c);
            groups.set(end, list);
          });
          Array.from(groups.entries()).sort((a, b) => b[0] - a[0]).forEach(([end, list], idx) => {
            const token = 'ACEP_GEMINI_CITATION_TOKEN_' + idx + '_';
            geminiCitationTokens.set(token, '<span class="acep-gemini-citations">' + list.map(geminiCitationChip).join(' ') + '</span>');
            s = s.slice(0, end) + ' ' + token + s.slice(end);
          });
        }
        // Strip Gemini image-generation placeholder URLs (http://, not real loadable images)
          s = s.replace(/https?:\/\/googleusercontent\.com\/image_generation_content\/[^\s)\]"']*/gi, ''); // Preserve Gemini generated-image URLs so downstream logic can convert them to <img>.
        // Block math $$...$$ → detectable KaTeX placeholder
        s = s.replace(/\$\$([\s\S]*?)\$\$/g, (_, tex) =>
          `<div class="math-block katex-display" data-math="${tex.trim()}">$$${tex.trim()}$$</div>`);
        // Inline math $...$ (avoid currency false-positives)
        s = s.replace(/(?<![\\$\d])\$([^$\n]{1,300})\$(?!\d)/g, (_, tex) =>
          `<span class="math-inline katex" data-math="${tex}">$${tex}$</span>`);
        s = s.replace(/```(\w*)\n?([\s\S]*?)```/g, (_, lang, code) =>
          `<pre><code${lang ? ` class="language-${lang}"` : ''}>${code.replace(/</g,'&lt;').replace(/>/g,'&gt;')}</code></pre>`);
        s = s.replace(/^(#{1,6})\s+(.+)$/gm, (_, h, t) => `<h${h.length}>${t}</h${h.length}>`);
        s = s.replace(/^---+$/gm, '<hr>');
        s = s.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
        s = s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
        s = s.replace(/\*(.+?)\*/g, '<em>$1</em>');
        s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
        s = s.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (m, alt, url) => {
          if (/googleusercontent\.com|lh3\.google\.com|bidi\.plus|googleapis\.com/i.test(url)) {
            try { const pu = new URL(url); if (pu.protocol !== 'https:' || pu.pathname === '/') return ''; } catch {}
          }
          return `<img src="${url}" alt="${alt}" style="max-width:100%">`;
        });
        s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (m, text, url) => {
          // Gemini generated images come as regular [text](url) links; detect and render as <img>
          // Skip stub URLs (bare domain, no path) — these are API placeholders, not real images
          if (/googleusercontent\.com|lh3\.google\.com|bidi\.plus|googleapis\.com/i.test(url)) {
            try {
              const pu = new URL(url);
              if (pu.protocol === 'https:' && pu.pathname !== '/') return `<img src="${url}" alt="${text}" style="max-width:100%;display:block;margin:8px 0">`;
              return ''; // http:// placeholder or stub — suppress entirely
            } catch {}
          }
          return `<a href="${url}">${text}</a>`;
        });
        s = s.replace(/(?:^[ \t]*[-*+] .+(?:\n|$))+/gm, m => {
          const items = m.trim().split('\n').map(l => `<li>${l.replace(/^[ \t]*[-*+] /, '')}</li>`).join('');
          return `<ul>${items}</ul>`;
        });
        s = s.replace(/(?:^[ \t]*\d+\. .+(?:\n|$))+/gm, m => {
          const items = m.trim().split('\n').map(l => `<li>${l.replace(/^[ \t]*\d+\. /, '')}</li>`).join('');
          return `<ol>${items}</ol>`;
        });
        s = s.replace(/^\|(.+)\|\s*\n\|[\s\-:|]+\|\s*\n((?:\|.+\|\s*\n?)+)/gm, (_, hRow, body) => {
          const ths = hRow.split('|').filter(Boolean).map(c => `<th>${c.trim()}</th>`).join('');
          const trs = body.trim().split('\n').map(row => {
            const tds = row.split('|').filter((_, i, a) => i > 0 && i < a.length - 1).map(c => `<td>${c.trim()}</td>`).join('');
            return `<tr>${tds}</tr>`;
          }).join('');
          return `<table><thead><tr>${ths}</tr></thead><tbody>${trs}</tbody></table>`;
        });
        s = s.replace(/\n{2,}/g, '</p><p>');
        s = `<p>${s}</p>`;
        s = s.replace(/(?<!>)\n(?!<)/g, '<br>');
        for (const [token, html] of geminiCitationTokens.entries()) s = s.split(token).join(html);
        return s;
      } catch { return String(md || ''); }
    }

    function buildApiTurnNodeGemini({ role = 'assistant', html = '', turnId = '' } = {}) {
      try {
        const el = document.createElement('div');
        el.setAttribute('data-acep-from-api', '1');
        el.setAttribute('data-acep-role', role);
        if (turnId) el.setAttribute('data-acep-turn-id', turnId);
        const inner = document.createElement('div');
        inner.className = 'acep-api-content';
        inner.innerHTML = html;
        el.appendChild(inner);
        return el;
      } catch { return document.createElement('div'); }
    }

    function parseGeminiChunked(rawText) {
      try {
        const lines = rawText.replace(/^\)\]}'/, '').split('\n');
        let i = 0;
        while (i < lines.length) {
          const line = lines[i].trim();
          if (/^\d+$/.test(line)) {
            const jsonLine = (lines[i + 1] || '').trim();
            if (jsonLine.startsWith('[')) {
              try {
                const outer = JSON.parse(jsonLine);
                const wrbEntry = outer.find(e => Array.isArray(e) && e[0] === 'wrb.fr' && e[1] === 'hNvQHb');
                if (wrbEntry && typeof wrbEntry[2] === 'string') return JSON.parse(wrbEntry[2]);
              } catch {}
            }
            i += 2;
          } else {
            i++;
          }
        }
        return null;
      } catch { return null; }
    }

    function fetchApiTurnNodesForCurrentChat() {
      const gp = g.ACEP.providers.gemini;
      const now = Date.now();
      if (gp.__apiTurnNodes && gp.__apiTs && (now - gp.__apiTs) < 120000) {
        return Promise.resolve(gp.__apiTurnNodes);
      }
      const convId = getChatConvId();
      if (!convId) { try { gp.__apiTitle = ''; gp.__apiFirstPrompt = ''; } catch {} return Promise.resolve([]); }
      const tokens = extractGeminiTokens();
      if (!tokens.at) { try { gp.__apiTitle = ''; gp.__apiFirstPrompt = ''; } catch {} return Promise.resolve([]); }
      try { gp.__apiFailed = false; gp.__apiNetworkFailed = false; } catch {}

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);
      const url = `https://gemini.google.com/_/BardChatUi/data/batchexecute?rpcids=hNvQHb&source-path=/app/${convId}&bl=${encodeURIComponent(tokens.bl)}&f.sid=${encodeURIComponent(tokens.sid)}&hl=en&rt=c`;
      const innerStr = `["c_${convId}",1000,null,1,[0],[4],null,1]`;
      const fReq = `[[["hNvQHb",${JSON.stringify(innerStr)},null,"generic"]]]`;
      const body = `f.req=${encodeURIComponent(fReq)}&at=${encodeURIComponent(tokens.at)}&`;

      return fetch(url, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'content-type': 'application/x-www-form-urlencoded',
          'referer': `https://gemini.google.com/app/${convId}`,
          'x-same-domain': '1',
        },
        body,
        signal: controller.signal
      }).then(res => {
        clearTimeout(timeoutId);
        if (!res.ok) {
          try { gp.__apiFailed = true; } catch {}
          return [];
        }
        return res.text();
      }).then(rawText => {
        if (!rawText || typeof rawText !== 'string') return [];
        const data = parseGeminiChunked(rawText);
        if (!data) return [];

        const extractTitleFromApiData = (root) => {
          try {
            const isBad = (s = '') => {
              const t = String(s || '').replace(/\s+/g, ' ').trim();
              if (!t) return true;
              if (t.length < 3 || t.length > 140) return true;
              if (/^https?:\/\//i.test(t)) return true;
              if (/^\d+$/.test(t)) return true;
              // Exclude ids / resource keys (common in batchexecute payloads)
              if (/^rc_[a-f0-9]{8,}$/i.test(t)) return true;
              if (/^c_[a-f0-9]{8,}$/i.test(t)) return true;
              if (/^[a-f0-9]{16,}$/i.test(t)) return true;
              if (/^[a-z]{0,6}_[a-f0-9]{12,}$/i.test(t)) return true;
              if (/^[a-z0-9_-]{18,}$/i.test(t) && !/[a-z]{2,}/i.test(t.replace(/[_-]/g, ' '))) return true;
              // Exclude obvious model names/pickers.
              if (/^(flash|flash-lite|lite|pro|ultra|gemini|gemini\s+\d+(\.\d+)?)$/i.test(t)) return true;
              if (/model\b/i.test(t) && t.length < 30) return true;
              // If it's extremely long or looks like a full prompt paragraph, ignore.
              if (/[.?!].{30,}/.test(t) && t.length > 90) return true;
              // Prefer human titles (usually contain spaces)
              if (!/\s/.test(t) && t.length < 20) return true;
              return false;
            };
            const score = (s = '') => {
              const t = String(s || '').replace(/\s+/g, ' ').trim();
              if (isBad(t)) return -1;
              let sc = 0;
              sc += Math.min(50, t.length); // prefer medium length
              if (/^[A-Z0-9]/.test(t)) sc += 3;
              if (!/[.?!]$/.test(t)) sc += 3; // titles usually don't end with sentence punctuation
              if (t.split(/\s+/).length <= 10) sc += 4;
              return sc;
            };

            const candidates = [];
            const push = (s) => {
              const t = String(s || '').replace(/\s+/g, ' ').trim();
              if (isBad(t)) return;
              candidates.push({ t, sc: score(t) });
            };

            // Known-ish locations first (best guess based on common batchexecute shapes)
            const paths = [
              [1, 0],
              [1, 1],
              [2, 0],
              [2, 1],
              [3, 0],
            ];
            paths.forEach((p) => {
              try {
                let cur = root;
                for (const idx of p) cur = cur?.[idx];
                if (typeof cur === 'string') push(cur);
              } catch {}
            });

            // Fallback: shallow scan for short strings near the top.
            const walk = (node, depth = 0) => {
              if (depth > 4 || node == null) return;
              if (typeof node === 'string') { push(node); return; }
              if (Array.isArray(node)) {
                for (let i = 0; i < Math.min(node.length, 30); i++) walk(node[i], depth + 1);
              }
            };
            walk(root, 0);

            candidates.sort((a, b) => b.sc - a.sc);
            return candidates[0]?.t || '';
          } catch {
            return '';
          }
        };
        try {
          const apiTitle = extractTitleFromApiData(data);
          if (apiTitle) gp.__apiTitle = apiTitle;
        } catch {}
        const exchanges = Array.isArray(data[0]) ? data[0].slice().reverse() : [];
        // Recursively scan a data structure for Google-hosted image URLs
        const isGeminiImgUrl = (s) =>
          /^https:\/\//i.test(s) &&
          /(googleusercontent\.com|lh3\.google\.com|bidi\.plus|googleapis\.com)/i.test(s);
        const isUiAsset = (s) => /avatar|icon|favicon|profile|\/s\d{1,2}[/-]/i.test(s);
        const isStubUrl = (s) => { try { return new URL(s).pathname === '/'; } catch { return false; } };

        const extractGeminiImageUrls = (data, depth) => {
          if (depth > 6 || !data) return [];
          if (typeof data === 'string') return isGeminiImgUrl(data) ? [data] : [];
          if (Array.isArray(data)) {
            const out = [];
            for (const item of data) out.push(...extractGeminiImageUrls(item, depth + 1));
            return out;
          }
          return [];
        };

        // Deduplicate by base path (strip query/hash — Gemini adds per-request auth tokens)
        const dedupeImgUrls = (urls) => {
          const seen = new Set();
          return urls.filter(u => {
            try {
              const key = new URL(u).pathname;
              if (seen.has(key)) return false;
              seen.add(key);
              return true;
            } catch {
              return !seen.has(u) && seen.add(u);
            }
          });
        };

        const extractGeminiCitations = (root) => {
          const out = [];
          const seen = new Map();
          const isUrl = (value) => /^https?:\/\//i.test(String(value || '').trim());
          const canonicalUrl = (value = '') => {
            try {
              const url = new URL(String(value || '').trim());
              url.hash = '';
              return url.href;
            } catch {
              return String(value || '').trim();
            }
          };
          const cleanTitle = (value = '') => String(value || '').replace(/\s+/g, ' ').trim();
          const isRawUrlLabel = (label = '') => {
            const text = cleanTitle(label);
            return isUrl(text) || /^https?[;:]\/{0,2}/i.test(text) || /^data:image\//i.test(text);
          };
          const findCitationSpan = (value) => {
            try {
              if (!Array.isArray(value)) return null;
              if (typeof value[0] === 'string' && Number.isFinite(Number(value[1])) && Number.isFinite(Number(value[2]))) {
                return { text: String(value[0]), start: Number(value[1]), end: Number(value[2]) };
              }
              for (const child of value) {
                if (!Array.isArray(child)) continue;
                if (typeof child[0] === 'string' && Number.isFinite(Number(child[1])) && Number.isFinite(Number(child[2]))) {
                  return { text: String(child[0]), start: Number(child[1]), end: Number(child[2]) };
                }
              }
            } catch {}
            return null;
          };
          const collectSourceRows = (value, acc = [], depth = 0) => {
            try {
              if (!Array.isArray(value) || depth > 5) return acc;
              if (isUrl(value[0])) {
                const url = String(value[0]).trim();
                const title = value.slice(1)
                  .filter((item) => typeof item === 'string')
                  .map(cleanTitle)
                  .find((item) => item && !isRawUrlLabel(item)) || url;
                acc.push({ url, title });
                return acc;
              }
              value.forEach((child) => collectSourceRows(child, acc, depth + 1));
            } catch {}
            return acc;
          };
          const addSource = (source, span) => {
            try {
              if (!source?.url || !span) return 0;
              const key = canonicalUrl(source.url);
              const next = { url: source.url, title: source.title || source.url, start: span.start, end: span.end, text: span.text };
              const prev = seen.get(key);
              if (!prev) {
                seen.set(key, next);
                out.push(next);
                return 1;
              }
              if (isRawUrlLabel(prev.title) && !isRawUrlLabel(next.title)) prev.title = next.title;
            } catch {}
            return 0;
          };
          const walk = (value, depth = 0) => {
            try {
              if (!Array.isArray(value) || depth > 8) return 0;
              let childAdded = 0;
              for (const child of value) childAdded += walk(child, depth + 1);
              if (childAdded) return childAdded;
              const span = findCitationSpan(value);
              if (!span) return 0;
              const sources = collectSourceRows(value, [], 0)
                .filter((source) => source.url)
                .filter((source, index, arr) => arr.findIndex((x) => canonicalUrl(x.url) === canonicalUrl(source.url)) === index);
              let added = 0;
              sources.forEach((source) => { added += addSource(source, span); });
              return added;
            } catch {
              return 0;
            }
          };
          walk(root, 0);
          return out;
        };

        const nodes = [];
        const assignedImgPaths = new Set();
        let firstUserPrompt = '';
        for (let i = 0; i < exchanges.length; i++) {
          const ex = exchanges[i];
          if (!Array.isArray(ex) || !Array.isArray(ex[2]) || !Array.isArray(ex[2][0])) continue;
          const userText = typeof ex[2][0][0] === 'string' ? ex[2][0][0] : '';
          if (!firstUserPrompt && userText && String(userText).trim()) {
            firstUserPrompt = String(userText).replace(/\s+/g, ' ').trim().slice(0, 80);
          }
          const markdown = (Array.isArray(ex[3]) && Array.isArray(ex[3][0]) &&
            Array.isArray(ex[3][0][0]) && Array.isArray(ex[3][0][0][1]))
            ? (typeof ex[3][0][0][1][0] === 'string' ? ex[3][0][0][1][0] : '')
            : '';

          // User-uploaded images: scan ex[2], within-turn dedup then cross-turn dedup
          const uploadedImgUrls = dedupeImgUrls(
            extractGeminiImageUrls(ex[2], 0).filter(u => !isUiAsset(u) && !isStubUrl(u))
          ).filter(u => {
            try {
              const key = new URL(u).pathname;
              if (assignedImgPaths.has(key)) return false;
              assignedImgPaths.add(key);
              return true;
            } catch {
              if (assignedImgPaths.has(u)) return false;
              assignedImgPaths.add(u);
              return true;
            }
          });

          if (userText || uploadedImgUrls.length) {
            let html = userText ? `<p>${escapeHtmlGemini(userText).replace(/\n/g, '<br>')}</p>` : '';
            uploadedImgUrls.forEach(u => {
              html += `<img src="${escapeHtmlGemini(u)}" alt="uploaded image" data-original-src="${escapeHtmlGemini(u)}" style="max-width:100%;display:block;margin:8px 0">`;
            });
            nodes.push(buildApiTurnNodeGemini({ role: 'user', html, turnId: `${i}_u` }));
          }

          if (markdown !== '' || Array.isArray(ex[3])) {
            const geminiCitations = extractGeminiCitations(ex[3]);
            try { document.documentElement.setAttribute('data-acep-gemini-citation-audit', JSON.stringify({ exchange: i, markerCount: (String(markdown || '').match(/\[cite:\s*[\d,\s]+\]/g) || []).length, sources: geminiCitations.length, sample: geminiCitations.slice(0, 4) }).slice(0, 1000)); } catch {}
            let asstHtml = markdownToHtmlGemini(markdown, { citations: geminiCitations });
            try { asstHtml = String(asstHtml || '').replace(/https?:\/\/googleusercontent\.com\/youtube_content\/\d+/gi, '').trim(); } catch {}
            // Generated images: scan ex[3] for image URLs not already embedded in the markdown HTML
            const genImgUrls = dedupeImgUrls(
              extractGeminiImageUrls(ex[3], 0).filter(u => !isUiAsset(u) && !isStubUrl(u))
            );
            genImgUrls.forEach(u => {
              if (!asstHtml.includes(u)) {
                asstHtml += `<img src="${escapeHtmlGemini(u)}" alt="generated image" data-original-src="${escapeHtmlGemini(u)}" style="max-width:100%;display:block;margin:8px 0">`;
              }
            });
            if (asstHtml) nodes.push(buildApiTurnNodeGemini({ role: 'assistant', html: asstHtml, turnId: `${i}_a` }));
          }
        }
        gp.__apiTurnNodes = nodes;
        gp.__apiConvId = convId;
        gp.__apiFirstPrompt = firstUserPrompt || '';
        gp.__apiTs = Date.now();
        return nodes;
      }).catch((e) => {
        try { clearTimeout(timeoutId); } catch {}
        try { gp.__apiFailed = true; } catch {}
        try {
          if (e instanceof TypeError || /failed to fetch|networkerror|network error/i.test(String(e?.message || ''))) {
            gp.__apiNetworkFailed = true;
          }
        } catch {}
        return [];
      });
    }

    function preScrape() {
      return fetchApiTurnNodesForCurrentChat().catch(() => []).then(async nodes => {
        if (!Array.isArray(nodes) || !nodes.length) return nodes || [];
        try {
          const root = getThreadContainer() || document.body;
          const domAsstEls = Array.from(new Set(
            Array.from(root.querySelectorAll('.response-container'))
              .map(el => el.closest('.response-container') || el)
          ));
          const asstApiNodes = nodes.filter(n => n.getAttribute?.('data-acep-role') === 'assistant');
          const tasks = [];
          asstApiNodes.forEach((apiNode, idx) => {
            const domEl = domAsstEls[idx];
            if (!domEl) return;
            const contentEl = apiNode.querySelector('.acep-api-content');
            if (!contentEl) return;
            Array.from(domEl.querySelectorAll('img[src^="blob:"]')).forEach(img => {
              const blobUrl = img.src;
              tasks.push(
                fetch(blobUrl).then(r => r.blob()).then(blob => new Promise((res) => {
                  const reader = new FileReader();
                  reader.onload = () => res({ contentEl, dataUrl: reader.result });
                  reader.onerror = () => res(null);
                  reader.readAsDataURL(blob);
                })).catch(() => null)
              );
            });
          });
          const results = await Promise.all(tasks);
          for (const r of results) {
            if (!r?.dataUrl) continue;
            const imgEl = document.createElement('img');
            imgEl.src = r.dataUrl;
            imgEl.setAttribute('data-original-src', 'blob:gemini-generated');
            imgEl.setAttribute('alt', 'Generated image');
            imgEl.style.cssText = 'max-width:100%;display:block;margin:8px 0';
            r.contentEl.appendChild(imgEl);
          }
        } catch {}
        return nodes;
      });
    }

    function extractSelectableTurnNodes() {
      try {
        if (!env.isGemini || !env.isGemini()) return [];
        const root = getThreadContainer() || document.body;
        if (!root) return [];

        const userRaw = Array.from(root.querySelectorAll(sel.userTurn || 'user-query, [id^="user-query-content-"], .query-text, [id^="user-query-content-"] .query-text'));
        const userTurns = userRaw.map(el =>
          el.closest('user-query') ||
          el.closest('[id^="user-query-content-"]') ||
          el
        );

        const asstRaw = Array.from(root.querySelectorAll('.response-container, .presented-response-container, .response-container-content, .response-content'));
        const asstTurns = asstRaw.map(el =>
          el.closest('.response-container') ||
          el
        );

        const seen = new Set();
        const merged = [];
        userTurns.forEach(el => {
          if (!el) return;
          if (seen.has(el)) return;
          seen.add(el);
          try { el.setAttribute('data-acep-role', 'user'); } catch {}
          merged.push(el);
        });
        asstTurns.forEach(el => {
          if (!el) return;
          if (seen.has(el)) return;
          seen.add(el);
          try { el.setAttribute('data-acep-role', 'assistant'); } catch {}
          merged.push(el);
        });
        merged.sort((a, b) => {
          if (a === b) return 0;
          const pos = a.compareDocumentPosition(b);
          if (pos & Node.DOCUMENT_POSITION_FOLLOWING) return -1;
          if (pos & Node.DOCUMENT_POSITION_PRECEDING) return 1;
          return 0;
        });
        return merged;
      } catch {
        return [];
      }
    }

    function findMarkdownRoot(rootEl) {
      try {
        const direct = rootEl.querySelector?.(sel.asstMarkdown || '.markdown, .markdown-main-panel');
        if (direct) return direct;
        const sr = rootEl.shadowRoot;
        if (sr) {
          const inSr = sr.querySelector(sel.asstMarkdown || '.markdown, .markdown-main-panel');
          if (inSr) return inSr;
          const all = sr.querySelectorAll('*');
          for (const el of all) {
            try {
              const m = el.shadowRoot?.querySelector(sel.asstMarkdown || '.markdown, .markdown-main-panel');
              if (m) return m;
            } catch {}
          }
        }
      } catch {}
      return rootEl;
    }

    // Export adapter: returns synthetic "turn" wrapper nodes with `data-acep-role`.
    function getTurnsForExport() {
      try {
        const apiNodes = g.ACEP?.providers?.gemini?.__apiTurnNodes;
        if (Array.isArray(apiNodes) && apiNodes.length) return apiNodes;
        // If API failed, do not silently fall back to a partial DOM export.
        try {
          if (g.ACEP?.providers?.gemini?.__apiFailed || g.ACEP?.providers?.gemini?.__apiNetworkFailed) return [];
        } catch {}
        if (!env.isGemini || !env.isGemini()) return [];
        const root = getThreadContainer() || document.body;
        if (!root) return [];

        const userEls = Array.from(root.querySelectorAll(sel.userTurn || 'user-query, [id^="user-query-content-"], .query-text'))
          .map(el => el.closest('user-query') || el.closest('[id^="user-query-content-"]') || el)
          .filter(Boolean);
        const userSeen = new Set();
        const userTurns = userEls.filter(el => {
          if (userSeen.has(el)) return false;
          userSeen.add(el);
          return true;
        });

        let asstEls = Array.from(root.querySelectorAll('.response-container'));
        if (!asstEls.length) {
          const mcSet = new Set(Array.from(root.querySelectorAll('message-content')));
          asstEls = Array.from(mcSet);
          if (!asstEls.length) {
            asstEls = Array.from(root.querySelectorAll('message-content, .model-response-text'))
              .map(el => el.closest('message-content') || el);
            asstEls = Array.from(new Set(asstEls));
          }
        }
        const asstSeen = new Set();
        const asstTurns = asstEls.filter(el => {
          if (!el) return false;
          if (asstSeen.has(el)) return false;
          asstSeen.add(el);
          return true;
        });

        const nodes = [];
        userTurns.forEach(el => nodes.push({ el, role: 'user' }));
        asstTurns.forEach(el => nodes.push({ el, role: 'assistant' }));
        nodes.sort((a, b) => {
          if (a.el === b.el) return 0;
          const pos = a.el.compareDocumentPosition(b.el);
          if (pos & Node.DOCUMENT_POSITION_FOLLOWING) return -1;
          if (pos & Node.DOCUMENT_POSITION_PRECEDING) return 1;
          return 0;
        });

        const turns = [];
        nodes.forEach(n => {
          try {
            const wrap = document.createElement('div');
            wrap.setAttribute('data-acep-role', n.role);
            if (n.role === 'user') {
              const txtLines = Array.from(n.el.querySelectorAll(sel.userTextLines || 'p.query-text-line'))
                .map(p => (p.innerText || '').trim())
                .filter(Boolean);
              const text = txtLines.length ? txtLines.join('\n') : (n.el.innerText || '').trim();
              const p = document.createElement('p');
              p.textContent = text;
              p.className = 'whitespace-pre-wrap break-words';
              wrap.appendChild(p);

              const container = n.el.closest('user-query') || n.el.closest('[id^="user-query-content-"]') || n.el;
              const uploadImgs = Array.from(container.querySelectorAll(sel.uploadedImgAny || '[data-test-id="uploaded-img"], img.preview-image, .preview-image'));
              const seen = new Set();
              uploadImgs.forEach(im => {
                try {
                  let src = im.currentSrc || im.getAttribute('src') || '';
                  if (!src) return;
                  src = normalizeAbsUrl(src);
                  const key0 = src.split('#')[0];
                  const key = key0.includes('?') ? key0.slice(0, key0.indexOf('?')) : key0;
                  if (!key || seen.has(key)) return;
                  seen.add(key);
                  const img = document.createElement('img');
                  img.setAttribute('src', src);
                  img.setAttribute('data-original-src', src);
                  img.setAttribute('data-test-id', 'uploaded-img');
                  img.className = 'preview-image';
                  img.setAttribute('alt', im.getAttribute('alt') || '');
                  img.style.maxWidth = '100%';
                  img.style.display = 'block';
                  wrap.appendChild(img);
                } catch {}
              });
            } else {
              const md = findMarkdownRoot(n.el);
              const holder = document.createElement('div');
              holder.innerHTML = md?.innerHTML || '';
              wrap.appendChild(holder);

              // Append images under assistant scope so they appear in exports.
              try {
                const scope = n.el.shadowRoot || n.el;
                const seen = new Set();
                const urls = [];
                Array.from(scope.querySelectorAll('img')).forEach(im => {
                  let s = im.currentSrc || im.getAttribute('src') || '';
                  if (!s) return;
                  s = normalizeAbsUrl(s);
                  const key0 = s.split('#')[0];
                  const key = key0.includes('?') ? key0.slice(0, key0.indexOf('?')) : key0;
                  if (!key || seen.has(key)) return;
                  seen.add(key);
                  urls.push(s);
                });
                Array.from(scope.querySelectorAll('source[srcset]')).forEach(sr => {
                  const set = (sr.getAttribute('srcset') || '').trim();
                  const first = set.split(',')[0]?.trim().split(' ')[0]?.trim();
                  if (!first) return;
                  let s = normalizeAbsUrl(first);
                  const key0 = s.split('#')[0];
                  const key = key0.includes('?') ? key0.slice(0, key0.indexOf('?')) : key0;
                  if (!key || seen.has(key)) return;
                  seen.add(key);
                  urls.push(s);
                });
                urls.forEach(u => {
                  const img = document.createElement('img');
                  img.setAttribute('src', u);
                  img.setAttribute('data-original-src', u);
                  img.setAttribute('alt', '');
                  img.style.maxWidth = '100%';
                  img.style.display = 'block';
                  wrap.appendChild(img);
                });
              } catch {}
            }
            turns.push(wrap);
          } catch {}
        });
        return turns;
      } catch {
        return [];
      }
    }

    function innerHTMLFromTurn(turn) {
      try {
        if (!env.isGemini || !env.isGemini()) return '';
        if (!turn || !turn.cloneNode) return (turn && turn.innerHTML) ? String(turn.innerHTML) : '';
        if (turn.getAttribute?.('data-acep-from-api') === '1') {
          return turn.querySelector('.acep-api-content')?.innerHTML || turn.innerHTML || '';
        }
        if (turn.getAttribute && turn.getAttribute('data-acep-role') !== 'assistant') return turn.innerHTML || '';

        const clone = turn.cloneNode(true);
        try {
          clone.querySelectorAll(sel.toolAttributionAny || 'attribution-container, youtube-block, single-video, .tool-attribution, .youtube-block, .attachment-container.youtube')
            .forEach(n => { try { n.remove(); } catch {} });
        } catch {}
        // Remove Gemini internal/placeholder youtube_content URLs that sometimes leak into exports.
        try {
          clone.querySelectorAll('a[href*="googleusercontent.com/youtube_content"], a[href*="googleusercontent.com/youtube_content/"]')
            .forEach(n => { try { n.remove(); } catch {} });
        } catch {}
        let html = clone.innerHTML || '';
        // Strip Gemini citation markers that are invisible in the UI but leak into DOM exports
        html = html.replace(/\[cite_start\]/g, '');
        html = html.replace(/\[cite:\s*[\d,\s]+\]/g, '');
        html = html.replace(/(^|\s)https?:\/\/googleusercontent\.com\/youtube_content\/\d+(\s|$)/gi, ' ');
        return html;
      } catch {
        return (turn && turn.innerHTML) ? String(turn.innerHTML) : '';
      }
    }

    function getChatTitle() {
      try {
        if (!env.isGemini || !env.isGemini()) return (document.title || 'AI Conversation').trim();

        const norm = (s = '') => String(s || '')
          .replace(/\u00a0/g, ' ')
          .replace(/[\u200B-\u200D\uFEFF]/g, '')
          .replace(/\s+/g, ' ')
          .trim();
        const modelLabel = (() => {
          try {
            const candidates = [
              '.picker-secondary-text.conversation-title',
              '.picker-secondary-text',
              '[class*="picker-secondary-text" i]',
              '[data-test-id*="model" i] .conversation-title',
              '[data-test-id*="model" i]',
              '[aria-label*="model" i]',
              '[aria-label*="model" i] .conversation-title',
            ];
            for (const sel2 of candidates) {
              const el = document.querySelector(sel2);
              const t = norm(el?.textContent || '');
              if (t) return t;
            }
            return '';
          } catch {
            return '';
          }
        })();
        const apiTitle = (() => {
          try { return norm(g.ACEP?.providers?.gemini?.__apiTitle || ''); } catch { return ''; }
        })();
        const firstPrompt = (() => {
          try { return norm(g.ACEP?.providers?.gemini?.__apiFirstPrompt || ''); } catch { return ''; }
        })();
        const activeSidebar = (() => {
          try {
            const a = document.querySelector('a[aria-current="page"][href^="/app/"], a[aria-current="true"][href^="/app/"]');
            return norm(a?.textContent || '');
          } catch { return ''; }
        })();
        const docTitle = (() => {
          try { return norm(document.title || ''); } catch { return ''; }
        })();
        const isBadTitleText = (s = '') => {
          const t = norm(s);
          if (!t) return true;
          if (t === modelLabel) return true;
          if (t.length < 3 || t.length > 140) return true;
          if (/^https?:\/\//i.test(t)) return true;
          if (/^\d+$/.test(t)) return true;
          if (/^rc_[a-f0-9]{8,}$/i.test(t)) return true;
          if (/^c_[a-f0-9]{8,}$/i.test(t)) return true;
          if (/^[a-f0-9]{16,}$/i.test(t)) return true;
          if (/^[a-z]{0,6}_[a-f0-9]{12,}$/i.test(t)) return true;
          // Exclude obvious model names/pickers.
          if (/^(flash|flash-lite|lite|pro|ultra|gemini|gemini\s+\d+(\.\d+)?|nano banana)$/i.test(t)) return true;
          if (/model\b/i.test(t) && t.length < 30) return true;
          return false;
        };

        const root = getThreadContainer() || document.body;

        const dbg = {
          modelLabel,
          activeSidebar,
          apiTitle,
          firstPrompt,
          docTitle,
          href: String(location.href || ''),
          chosen: '',
          source: '',
        };
        const pick = (val, source) => {
          const t = norm(val);
          if (isBadTitleText(t)) return null;
          dbg.chosen = t;
          dbg.source = source;
          return t;
        };

        // Best source: active conversation item in the left sidebar.
        try {
          const t = pick(activeSidebar, 'sidebar_active');
          if (t) return t;
        } catch {}

        const inMain = root?.querySelector(sel.convoTitleMain || '[data-test-id="conversation-title"]');
        const tMain = (inMain?.textContent || '').trim();
        if (tMain) {
          const t = pick(tMain, 'main_title');
          if (t) return t;
        }

        const isBadTitleNode = (el) => {
          try {
            if (!el || !el.closest) return false;
            // Model picker labels sometimes reuse `conversation-title` class (e.g. "Flash-Lite").
            const cls = String(el.className || '').toLowerCase();
            if (cls.includes('picker-secondary-text')) return true;
            if (el.closest('.picker, [class*="picker" i], [class*="model" i], [data-test-id*="model" i], [aria-label*="model" i]')) return true;
          } catch {}
          return false;
        };
        const h = Array.from(document.querySelectorAll(sel.convoTitleFallback || '.conversation-title, header h1, h1[aria-level="1"], [role="heading"][aria-level="1"]'))
          .find(el => el && !el.closest('nav, aside, [role="navigation"]') && !isBadTitleNode(el));
        let t = (h?.textContent || '').trim();
        if (t) {
          const ht = pick(t, 'heading_fallback');
          if (ht) return ht;
        }

        // NOTE: Do NOT use API-derived "title" for Gemini — in practice it frequently contains
        // model labels (e.g. "Nano Banana", "3.5 Flash") or internal IDs, not the user-visible chat name.

        // Document title usually contains the user-visible chat title.
        try {
          const cleaned = docTitle.replace(/\s*[-|]\s*google gemini$/i, '').replace(/\s*[-|]\s*gemini.*$/i, '').trim();
          const t3 = pick(cleaned, 'document_title');
          if (t3) return t3;
        } catch {}

        // Last resort: first prompt from API.
        try {
          const t4 = pick(firstPrompt, 'api_first_prompt');
          if (t4) return t4;
        } catch {}

        const u = (() => {
          try {
            const all = Array.from(root.querySelectorAll(sel.userFallbackFirst || '.query-text, .query-text.gds-body-l, [id^="user-query-content-"] .query-text'));
            // Prefer the first prompt in the conversation thread (avoid picking a random later prompt).
            const first = all.find(el => el && !el.closest('nav, aside, [role="navigation"]'));
            return first || null;
          } catch {
            return null;
          }
        })();
        const lines = u ? Array.from(u.querySelectorAll(sel.userTextLines || 'p.query-text-line')).map(p => (p.innerText || '').trim()).filter(Boolean) : [];
        const txt = (lines.length ? lines.join(' ') : (u?.innerText || '')).trim();
        if (txt) {
          const lastTxt = norm(txt).slice(0, 80);
          const t5 = pick(lastTxt, 'dom_first_prompt');
          if (t5) return t5;
        }

        try { document.documentElement.setAttribute('data-acep-gemini-title-dbg', JSON.stringify(dbg)); } catch {}
        return (document.title || 'AI Conversation').trim();
      } catch {
        return (document.title || 'AI Conversation').trim();
      }
    }

    function getSelectionRoleQueues(exportKeys = []) {
      try {
        if (!env.isGemini || !env.isGemini()) return null;
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

    // Provider API: roleFromTurn - determine if turn is user or assistant
    function roleFromTurn(turn) {
      try {
        const preset = turn?.getAttribute?.('data-acep-role');
        if (preset) return preset;
        // Gemini: user prompts have user-query
        if (turn?.matches?.('user-query, [id^="user-query-content-"], .query-text')
          || turn?.closest?.('user-query, [id^="user-query-content-"]')) return 'user';
        // Gemini: assistant responses are in .response-container
        if (turn?.matches?.('.response-container, message-content') 
          || turn?.closest?.('.response-container, message-content')) return 'assistant';
        return '';
      } catch {
        return '';
      }
    }

    // Provider API: getImageCaptionFromTurn - extract image caption
    function getImageCaptionFromTurn(turn) {
      try {
        if (!turn) return '';
        // Gemini: captions are typically not exposed
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
        if (turn.querySelector('img[src]:not([src*="avatar"]):not([src*="favicon"])')) return true;
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
        // Collect img elements
        turn.querySelectorAll('img[src]').forEach(img => {
          let src = img.getAttribute('data-original-src') || img.currentSrc || img.getAttribute('src') || '';
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
        // Collect background images (Gemini sometimes uses CSS backgrounds for previews)
        try {
          const allEls = turn.querySelectorAll('*');
          for (let el of allEls) {
            const bg = el.style?.backgroundImage || getComputedStyle(el)?.backgroundImage || '';
            const m = String(bg || '').match(/url\\((['\"]?)(.*?)\\1\\)/i);
            const u = m && m[2] ? String(m[2]).trim() : '';
            if (!u || /avatar|favicon/i.test(u)) continue;
            const key = u.split('#')[0];
            if (!seen.has(key)) {
              seen.add(key);
              images.push({ src: u, alt: '' });
            }
          }
        } catch {}
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

    // Expose provider functions.
    function isProtectedAsset(src = '') {
      try {
        const url = new URL(String(src || '').trim(), ORIGIN);
        const host = url.hostname || '';
        return /googleusercontent\.com$/i.test(host) || /lh3\.google\.com$/i.test(host) || /lh3\.googleusercontent\.com$/i.test(host);
      } catch {}
      return /googleusercontent\.com|lh3\.google\.com|lh3\.googleusercontent\.com/i.test(String(src || ''));
    }

    g.ACEP.providers.gemini.extractSelectableTurnNodes = extractSelectableTurnNodes;
    g.ACEP.providers.gemini.isProtectedAsset = isProtectedAsset;
    g.ACEP.providers.gemini.getTurnsForExport = getTurnsForExport;
    g.ACEP.providers.gemini.roleFromTurn = roleFromTurn;
    g.ACEP.providers.gemini.innerHTMLFromTurn = innerHTMLFromTurn;
    g.ACEP.providers.gemini.getChatTitle = getChatTitle;
    g.ACEP.providers.gemini.getImageCaptionFromTurn = getImageCaptionFromTurn;
    g.ACEP.providers.gemini.hasImages = hasImages;
    g.ACEP.providers.gemini.getImagesFromTurn = getImagesFromTurn;
    g.ACEP.providers.gemini.getGalleryCountFromTurn = getGalleryCountFromTurn;
    g.ACEP.providers.gemini.getSelectionRoleQueues = getSelectionRoleQueues;
    g.ACEP.providers.gemini.getChatConvId = getChatConvId;
    g.ACEP.providers.gemini.fetchApiTurnNodesForCurrentChat = fetchApiTurnNodesForCurrentChat;
    g.ACEP.providers.gemini.preScrape = preScrape;

    debugStore('loaded', true);
    try { document.documentElement.setAttribute('data-acep-loaded-gemini-provider', '1'); } catch {}
  } catch {}
})();
