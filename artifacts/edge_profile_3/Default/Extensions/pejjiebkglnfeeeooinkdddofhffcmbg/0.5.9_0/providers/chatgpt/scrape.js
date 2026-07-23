// ChatGPT provider logic (content script side).
// This file should contain ONLY ChatGPT-specific DOM logic.
(function initChatGPTProvider() {
  try {
    const g = (typeof globalThis !== 'undefined') ? globalThis : window;
    if (!/(^|\.)chatgpt\.com$|(^|\.)chat\.openai\.com$/i.test(String(location?.hostname || ''))) return;
    if (!g.ACEP) g.ACEP = {};
    if (!g.ACEP.providers) g.ACEP.providers = {};
    g.ACEP.providers.chatgpt = g.ACEP.providers.chatgpt || {};

    const env = g.ACEP.env || {};
    const sel = (g.ACEP.providers.chatgpt && g.ACEP.providers.chatgpt.sel) || {};
    const getThreadContainer = (g.ACEP.providers.chatgpt && g.ACEP.providers.chatgpt.getThreadContainer) || (() => (document.querySelector('main') || document.body));

    function debugStore(name, value) {
      try {
        g.ACEP.providers.chatgpt.__debug = g.ACEP.providers.chatgpt.__debug || {};
        g.ACEP.providers.chatgpt.__debug[name] = value;
      } catch {}
      try {
        const slugBase = String(name || '').toLowerCase().replace(/[^a-z0-9_-]+/g, '-');
        const k1 = `data-acep-chatgpt-${slugBase}`;
        const v = (typeof value === 'string') ? value : JSON.stringify(value);
        if (typeof v === 'string' && v.length <= 800) document.documentElement.setAttribute(k1, v);
      } catch {}
    }

    function extractSelectableTurnNodes() {
      try {
        if (!env.isChatGPT || !env.isChatGPT()) return [];
        const root = getThreadContainer() || document.body;
        if (!root) return [];
        const turns = Array.from(root.querySelectorAll(sel.turnAny || '[data-testid^="conversation-turn-"]'));
        // Mark role for downstream selection mapping.
        turns.forEach((t) => {
          try {
            if (t.getAttribute && t.getAttribute('data-acep-role')) return;
            const role = t.getAttribute('data-message-author-role') || t.getAttribute('data-turn') || '';
            if (role === 'user' || role === 'assistant') t.setAttribute('data-acep-role', role);
            else {
              const msg = t.querySelector('[data-message-author-role]');
              const r2 = msg?.getAttribute?.('data-message-author-role') || '';
              if (r2 === 'user' || r2 === 'assistant') t.setAttribute('data-acep-role', r2);
            }
          } catch {}
        });
        debugStore('turnCount', turns.length);
        return turns;
      } catch {
        return [];
      }
    }

    function getTurnsForExport() {
      try {
        const apiNodes = g.ACEP?.providers?.chatgpt?.__apiTurnNodes;
        if (Array.isArray(apiNodes) && apiNodes.length) return apiNodes;
        if (g.ACEP?.providers?.chatgpt?.__apiFailed || g.ACEP?.providers?.chatgpt?.__apiNetworkFailed) return [];
      } catch {}
      return extractSelectableTurnNodes();
    }

    function roleFromTurn(turn) {
      try {
        const preset = turn?.getAttribute?.('data-acep-role');
        if (preset) return preset;
        const attr = turn?.getAttribute?.('data-message-author-role');
        if (attr) return attr;
        const msg = turn?.querySelector?.('[data-message-author-role]');
        const r = msg?.getAttribute?.('data-message-author-role');
        return r || '';
      } catch {
        return '';
      }
    }

    // --- Bearer token capture via page-world fetch intercept ---

    // Listen for token messages posted from the injected page-world script
    try {
      window.addEventListener('message', (ev) => {
        try {
          if (ev.source !== window) return;
          if (ev.data?.type === '__acep_cgpt_tok' && ev.data.t) {
            g.ACEP.providers.chatgpt.__bearerToken = ev.data.t;
          }
        } catch {}
      });
    } catch {}

    // Ask background to inject the page-world fetch interceptor once per page load
    try {
      browser.runtime.sendMessage({ type: 'ACEP_INJECT_CGPT_TOKEN_CAPTURE' }, () => {
        if (browser.runtime?.lastError) { /* tab not ready yet — ok */ }
      });
    } catch {}

    // --- API-first helpers ---

    function getChatConvId() {
      try {
        const href = String(location?.href || '');
        const m = href.match(/\/c\/([a-f0-9-]{6,})/i);
        if (m && m[1]) return m[1];
      } catch {}
      return '';
    }

    function escapeHtmlCGPT(s = '') {
      return String(s || '').replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
    }

    function debugScanApiTextdocs(data) {
      try {
        const pattern = /textdoc|canvas|prosemirror|canmore\.(?:create|update)_textdoc/i;
        const hits = [];
        const seen = new Set();

        const addHit = ({ path, key = '', value = '', msg = null, parent = null }) => {
          if (hits.length >= 12) return;
          const signature = `${msg?.id || ''}|${path}|${key}|${String(value).slice(0, 160)}`;
          if (seen.has(signature)) return;
          seen.add(signature);
          let parentPreview = '';
          try {
            parentPreview = JSON.stringify(parent);
          } catch {}
          hits.push({
            path,
            key,
            role: msg?.author?.role || '',
            msgId: msg?.id || '',
            value: String(value).slice(0, 700),
            parentKeys: parent && typeof parent === 'object' ? Object.keys(parent).slice(0, 30) : [],
            parentPreview: String(parentPreview || '').slice(0, 1800),
          });
        };

        const scan = (value, path = '', msg = null, parent = null, key = '') => {
          if (hits.length >= 12 || value == null) return;
          if (pattern.test(String(key || ''))) addHit({ path, key, value: typeof value === 'string' ? value : `[${typeof value}]`, msg, parent });
          if (typeof value === 'string') {
            if (pattern.test(value)) addHit({ path, key, value, msg, parent });
            return;
          }
          if (Array.isArray(value)) {
            value.forEach((item, index) => scan(item, `${path}[${index}]`, msg, value, String(index)));
            return;
          }
          if (typeof value !== 'object') return;
          Object.entries(value).forEach(([childKey, childValue]) => {
            scan(childValue, path ? `${path}.${childKey}` : childKey, msg, value, childKey);
          });
        };

        Object.entries(data?.mapping || {}).forEach(([nodeId, node]) => {
          const msg = node?.message;
          if (msg) scan(msg, `mapping.${nodeId}.message`, msg, node, 'message');
        });

        const result = {
          mappingCount: Object.keys(data?.mapping || {}).length,
          hitsCount: hits.length,
          hits,
        };
        g.ACEP.providers.chatgpt.__debug = g.ACEP.providers.chatgpt.__debug || {};
        g.ACEP.providers.chatgpt.__debug.apiTextdocScan = result;
        document.documentElement.setAttribute(
          'data-acep-chatgpt-api-textdoc-scan',
          JSON.stringify(result).slice(0, 20000)
        );
        debugStore('apiTextdocScanSummary', { mappingCount: result.mappingCount, hitsCount: result.hitsCount });
      } catch (err) {
        debugStore('apiTextdocScanSummary', { error: String(err?.message || err) });
      }
    }

    function normalizeChatgptAssetId(raw = '') {
      return String(raw || '')
        .replace(/^[a-z][a-z0-9+.-]*:\/\//i, '')
        .split(/[?#]/, 1)[0]
        .trim();
    }

    function buildChatgptFileDownloadUrl(fileId = '', convId = '') {
      const id = String(fileId || '').trim();
      const conversationId = String(convId || '').trim();
      if (!id || !conversationId) return '';
      // Short bare hashes such as sediment://027dbe1bf1bb090 are internal asset
      // pointers, not IDs accepted by /backend-api/files/download/.
      const isDownloadableId = /^(?:file[-_][a-z0-9_-]{12,}|[a-f0-9]{24,})$/i.test(id);
      if (!isDownloadableId) return '';
      return `https://chatgpt.com/backend-api/files/download/${encodeURIComponent(id)}?inline=true&check_context_scopes_for_conversation_id=${encodeURIComponent(conversationId)}`;
    }

    function stripChatgptCitationArtifacts(s = '') {
      let out = String(s || '');
      out = out.replace(/\uE200(?:file)?cite\uE202[\s\S]*?\uE201/g, '');
      out = out.replace(/(?:&#x?e200;?|&#57344;)(?:file)?cite(?:&#x?e202;?|&#57346;)[\s\S]*?(?:&#x?e201;?|&#57345;)/gi, '');
      out = out.replace(/(?:îˆ€|Ã®Ë†â‚¬)(?:file)?cite(?:îˆ‚|Ã®Ë†â€š)[^<\n\r]*(?:îˆ|Ã®Ë†Â)?/g, '');
      out = out.replace(/îˆ€(?:file)?citeîˆ‚[^<\n\r]*(?:îˆ)?/g, '');
      out = out.replace(/\s*filecite[\w-]+/gi, '');
      out = out.replace(/\s*citeturn[\w-]+/gi, '');
      return out;
    }

    function replaceChatgptInlineUrlArtifacts(s = '', linkRefs = null) {
      let out = String(s || '');
      out = out.replace(
        /(?:\uE200|îˆ€|Ã®Ë†â‚¬)url(?:\uE202|îˆ‚|Ã®Ë†â€š)([^\uE202îˆ‚\n\r]+?)(?:\uE202|îˆ‚|Ã®Ë†â€š)([^\uE201îˆ\n\r]+?)(?:\uE201|îˆ|Ã®Ë†Â)/g,
        (_m, label, hrefOrRef) => {
          const cleanLabel = String(label || '').trim();
          const rawRef = String(hrefOrRef || '').trim();
          if (!cleanLabel) return '';
          let href = rawRef;
          if (!/^https?:\/\//i.test(href) && linkRefs && typeof linkRefs === 'object') {
            href = linkRefs.byRef?.[rawRef] || linkRefs.byLabel?.[cleanLabel.toLowerCase()] || '';
          }
          return /^https?:\/\//i.test(href) ? '[' + cleanLabel + '](' + href + ')' : cleanLabel;
        }
      );
      return out;
    }

    function replaceChatgptEntityArtifacts(s = '') {
      const decodePayload = (payload) => {
        try {
          const parsed = JSON.parse(String(payload || ''));
          if (Array.isArray(parsed)) return String(parsed[1] || parsed[0] || '').trim();
          if (parsed && typeof parsed === 'object') return String(parsed.name || parsed.title || parsed.label || parsed.text || '').trim();
        } catch {}
        return '';
      };
      const repl = (_m, payload) => decodePayload(payload);
      let out = String(s || '');
      try {
        out = out.replace(new RegExp(`${String.fromCharCode(0xE200)}entity${String.fromCharCode(0xE202)}([\\s\\S]*?)${String.fromCharCode(0xE201)}`, 'g'), repl);
      } catch {}
      out = out.replace(/(?:&#x?e200;?|&#57344;)entity(?:&#x?e202;?|&#57346;)([\s\S]*?)(?:&#x?e201;?|&#57345;)/gi, repl);
      out = out.replace(/(?:Ã®Ë†â‚¬|ÃƒÂ®Ã‹â€ Ã¢â€šÂ¬|ÃƒÆ’Ã‚Â®Ãƒâ€¹Ã¢â‚¬Â ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬)entity(?:Ã®Ë†â€š|ÃƒÂ®Ã‹â€ Ã¢â‚¬Å¡|ÃƒÆ’Ã‚Â®Ãƒâ€¹Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡)([\s\S]*?)(?:Ã®Ë†Â|ÃƒÂ®Ã‹â€ Ã‚Â|ÃƒÆ’Ã‚Â®Ãƒâ€¹Ã¢â‚¬Â Ãƒâ€šÃ‚Â)/g, repl);
      return out;
    }

    function extractChatgptImageGroupArtifacts(s = '') {
      const groups = [];
      let text = String(s || '').replace(
        /(?:\uE200|Ã®Ë†â‚¬|ÃƒÂ®Ã‹â€ Ã¢â€šÂ¬)image_group(?:\uE202|Ã®Ë†â€š|ÃƒÂ®Ã‹â€ Ã¢â‚¬Å¡)([\s\S]*?)(?:\uE201|Ã®Ë†Â|ÃƒÂ®Ã‹â€ Ã‚Â)/g,
        (_m, payload) => {
          let count = 0;
          try {
            const parsed = JSON.parse(String(payload || ''));
            const queries = Array.isArray(parsed?.query) ? parsed.query : [];
            count = queries.length || 0;
          } catch {}
          groups.push({ count: count || 0 });
          return '';
        }
      );
      text = text.replace(
        /(?:\uE200|&#x?e200;?|&#57344;)image_group(?:\uE202|&#x?e202;?|&#57346;)([\s\S]*?)(?:\uE201|&#x?e201;?|&#57345;)/gi,
        (_m, payload) => {
          let count = 0;
          try {
            const parsed = JSON.parse(String(payload || ''));
            const queries = Array.isArray(parsed?.query) ? parsed.query : [];
            count = queries.length || 0;
          } catch {}
          groups.push({ count: count || 0 });
          return '';
        }
      );
      try {
        text = text.replace(
          new RegExp(`${String.fromCharCode(0xE200)}image_group${String.fromCharCode(0xE202)}([\\s\\S]*?)${String.fromCharCode(0xE201)}`, 'g'),
          (_m, payload) => {
            let count = 0;
            try {
              const parsed = JSON.parse(String(payload || ''));
              const queries = Array.isArray(parsed?.query) ? parsed.query : [];
              count = queries.length || 0;
            } catch {}
            groups.push({ count: count || 0 });
            return '';
          }
        );
      } catch {}
      return { text, groups, count: groups.reduce((sum, group) => sum + (Number(group.count) || 0), 0) };
    }

    function normalizeChatgptContentReferences(msg = {}) {
      const refs = [];
      const pushAll = (value) => {
        if (Array.isArray(value)) refs.push(...value);
      };
      try {
        pushAll(msg?.metadata?.content_references);
        pushAll(msg?.metadata?.contentReferences);
        pushAll(msg?.content?.content_references);
        pushAll(msg?.content?.contentReferences);
      } catch {}
      return refs.filter(ref => ref && typeof ref === 'object');
    }


    function collectChatgptSearchCitationReferences(data = {}) {
      const refs = [];
      const seen = new Set();
      const addEntry = (entry = {}) => {
        try {
          const url = String(entry.url || entry.href || '').trim();
          if (!/^https?:\/\//i.test(url)) return;
          const refId = entry.ref_id || entry.refId || {};
          const turnIndex = Number(refId.turn_index ?? refId.turnIndex);
          const refIndex = Number(refId.ref_index ?? refId.refIndex);
          const refType = String(refId.ref_type || refId.refType || 'search').trim() || 'search';
          const ids = [];
          if (Number.isFinite(turnIndex) && Number.isFinite(refIndex)) {
            ids.push('turn' + turnIndex + refType + refIndex);
            ids.push('turn' + turnIndex + 'view' + refIndex);
          }
          const title = String(entry.title || entry.attribution || entry.domain || '').replace(/\s+/g, ' ').trim() || (() => {
            try { return new URL(url).hostname.replace(/^www\./i, ''); } catch { return 'Source'; }
          })();
          const key = url + '|' + ids.join(',');
          if (seen.has(key)) return;
          seen.add(key);
          refs.push({ url, title, ids });
        } catch {}
      };
      try {
        Object.values(data?.mapping || {}).forEach((node) => {
          const groups = node?.message?.metadata?.search_result_groups;
          if (!Array.isArray(groups)) return;
          groups.forEach((group) => {
            if (Array.isArray(group?.entries)) group.entries.forEach(addEntry);
          });
        });
      } catch {}
      return refs;
    }

    function normalizeChatgptCitationReferences(msg = {}) {
      const refs = [];
      const contentRefs = normalizeChatgptContentReferences(msg);
      const extraArrays = [
        msg?.metadata?.citations,
        msg?.metadata?.sources,
        msg?.metadata?.webpage_citations,
        msg?.metadata?.webpageCitations,
        msg?.content?.citations,
        msg?.content?.sources,
      ];
      const pushCandidate = (ref) => {
        try {
          if (!ref || typeof ref !== 'object') return;
          const type = String(ref.type || ref.content_type || ref.kind || '').toLowerCase();
          if (/image|file|attachment/.test(type)) return;
          const url = String(
            ref.url || ref.href || ref.link || ref.source_url || ref.sourceUrl || ref.web_url || ref.webUrl ||
            ref?.metadata?.url || ref?.metadata?.href || ref?.source?.url || ref?.source?.href || ''
          ).trim();
          if (!/^https?:\/\//i.test(url)) return;
          const rawTitle = String(
            ref.title || ref.name || ref.label || ref.source_title || ref.sourceTitle || ref.display_name ||
            ref?.metadata?.title || ref?.source?.title || ref?.source?.name || ''
          ).trim();
          const title = rawTitle && !/^https?:\/\//i.test(rawTitle) ? rawTitle : (() => {
            try { return new URL(url).hostname.replace(/^www\./i, ''); } catch { return 'Source'; }
          })();
          const ids = new Set();
          const addId = (value) => {
            const text = String(value || '').trim();
            if (!text) return;
            if (/^turn\d+(?:search|view|news|image)\d+$/i.test(text) || /^cite[_-]?\w+/i.test(text)) ids.add(text);
          };
          [ref.id, ref.ref_id, ref.refId, ref.reference_id, ref.referenceId, ref.marker, ref.citation_id, ref.citationId, ref.attribution_id, ref.attributionId].forEach(addId);
          const scanIds = (value, depth = 0) => {
            if (depth > 3 || value == null) return;
            if (typeof value === 'string') { addId(value); return; }
            if (Array.isArray(value)) { value.forEach((item) => scanIds(item, depth + 1)); return; }
            if (typeof value === 'object') Object.values(value).forEach((item) => scanIds(item, depth + 1));
          };
          scanIds(ref);
          const start = Number(ref.start_idx ?? ref.startIndex ?? ref.start ?? ref.from ?? ref?.range?.start);
          const end = Number(ref.end_idx ?? ref.endIndex ?? ref.end ?? ref.to ?? ref?.range?.end);
          refs.push({ url, title, ids: Array.from(ids), start, end, text: String(ref.matched_text || ref.matchedText || ref.text || '').trim() });
        } catch {}
      };
      contentRefs.forEach(pushCandidate);
      extraArrays.forEach((arr) => { if (Array.isArray(arr)) arr.forEach(pushCandidate); });
      const seen = new Set();
      return refs.filter((ref) => {
        const key = ref.url + '|' + (Number.isFinite(ref.end) ? ref.end : '') + '|' + ref.ids.join(',');
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    }

    function renderChatgptCitationChip(ref) {
      const label = escapeHtmlCGPT(String(ref?.title || 'Source').replace(/\s+/g, ' ').trim().slice(0, 80) || 'Source');
      const url = String(ref?.url || '').trim();
      if (!/^https?:\/\//i.test(url)) return '';
      return '<a class="acep-chatgpt-citation-chip" href="' + escapeHtmlCGPT(url) + '" target="_blank" rel="noopener noreferrer">' + label + '</a>';
    }

    function dedupeChatgptCitationReferences(refs = []) {
      const out = [];
      const seen = new Set();
      for (const ref of refs || []) {
        try {
          const url = String(ref?.url || '').trim();
          if (!/^https?:\/\//i.test(url)) continue;
          const ids = Array.isArray(ref.ids) ? ref.ids.map(id => String(id || '').trim()).filter(Boolean).sort() : [];
          const end = Number(ref.end);
          const key = [url, ids.join(','), Number.isFinite(end) ? String(end) : ''].join('|');
          if (seen.has(key)) continue;
          seen.add(key);
          out.push({ ...ref, ids });
        } catch {}
      }
      return out;
    }

    function filterChatgptCitationsForText(refs = [], text = '') {
      const source = String(text || '');
      if (!source) return [];
      const markerIds = new Set(source.match(/turn\d+(?:search|view|news|image)\d+/gi) || []);
      const markerRe = new RegExp(String.fromCharCode(0xE200) + 'cite' + String.fromCharCode(0xE202) + '([\\s\\S]*?)' + String.fromCharCode(0xE201), 'g');
      source.replace(markerRe, (_m, payload) => {
        String(payload || '').split(new RegExp(String.fromCharCode(0xE202) + '|\\s+|,')).forEach((id) => {
          const clean = String(id || '').trim();
          if (clean) markerIds.add(clean);
        });
        return '';
      });
      const filtered = (refs || []).filter((ref) => {
        const ids = Array.isArray(ref?.ids) ? ref.ids : [];
        if (ids.some((id) => markerIds.has(String(id || '').trim()))) return true;
        const end = Number(ref?.end);
        return Number.isFinite(end) && end > 0 && end <= source.length;
      });
      return dedupeChatgptCitationReferences(filtered);
    }
    function applyChatgptApiCitations(md = '', refs = []) {
      let text = String(md || '');
      const citations = dedupeChatgptCitationReferences(refs);
      const tokens = new Map();
      const makeGroup = (list) => {
        const unique = [];
        const seen = new Set();
        (list || []).forEach((ref) => {
          const url = String(ref?.url || '').trim();
          if (!/^https?:\/\//i.test(url) || seen.has(url)) return;
          seen.add(url);
          unique.push(ref);
        });
        if (!unique.length) return '';
        const first = unique[0];
        const collapsed = unique.length > 1
          ? { ...first, title: String(first.title || 'Source').replace(/\s+/g, ' ').trim() + ' +' + (unique.length - 1) }
          : first;
        return '<span class="acep-chatgpt-citations">' + renderChatgptCitationChip(collapsed) + '</span>';
      };
      const tokenFor = (html) => {
        const token = 'ACEP_CHATGPT_CITATION_TOKEN_' + tokens.size + '_';
        tokens.set(token, html);
        return token;
      };
      const byId = new Map();
      citations.forEach((ref) => (ref.ids || []).forEach((id) => {
        const key = String(id || '').trim();
        if (!key) return;
        const list = byId.get(key) || [];
        if (!list.some(x => x.url === ref.url)) list.push(ref);
        byId.set(key, list);
      }));
      let markerRendered = false;
      const markerRe = new RegExp(String.fromCharCode(0xE200) + 'cite' + String.fromCharCode(0xE202) + '([\\s\\S]*?)' + String.fromCharCode(0xE201), 'g');
      text = text.replace(markerRe, (_m, payload) => {
        const ids = String(payload || '').split(new RegExp(String.fromCharCode(0xE202) + '|\\s+|,'))
          .map(x => x.trim()).filter(Boolean);
        const list = [];
        ids.forEach((id) => (byId.get(id) || []).forEach((ref) => {
          if (!list.some(x => x.url === ref.url)) list.push(ref);
        }));
        if (!list.length) return '';
        markerRendered = true;
        return ' ' + tokenFor(makeGroup(list));
      });
      if (!markerRendered && citations.length) {
        const groups = new Map();
        citations.forEach((ref) => {
          const end = Number(ref.end);
          if (!Number.isFinite(end) || end <= 0 || end > text.length) return;
          const list = groups.get(end) || [];
          if (!list.some(x => x.url === ref.url)) list.push(ref);
          groups.set(end, list);
        });
        Array.from(groups.entries()).sort((a, b) => b[0] - a[0]).forEach(([end, list]) => {
          text = text.slice(0, end) + ' ' + tokenFor(makeGroup(list)) + text.slice(end);
        });
      }
      return { text, tokens };
    }

    function imageRefsToImages(refs = []) {
      const out = [];
      const seen = new Set();
      for (const ref of refs || []) {
        try {
          if (String(ref?.type || '') !== 'image_group') continue;
          const urls = Array.isArray(ref.safe_urls) ? ref.safe_urls.slice().reverse() : [];
          for (const url of urls) {
            const src = String(url || '').trim();
            if (!/^https?:\/\//i.test(src)) continue;
            const key = src.split('#')[0];
            if (!key || seen.has(key)) continue;
            seen.add(key);
            out.push({ src, originalSrc: src, alt: ref.title || ref.name || 'image' });
          }
        } catch {}
      }
      return out;
    }

    function replaceChatgptImageGroupsWithPlaceholders(s = '', imageRefs = []) {
      const groups = [];
      let idx = 0;
      const refs = (Array.isArray(imageRefs) ? imageRefs : []).filter(ref => String(ref?.type || '') === 'image_group');
      const usedRefs = new Set();
      const consume = (m, payload) => {
        let count = 0;
        let images = [];
        try {
          const parsed = JSON.parse(String(payload || ''));
          const queries = Array.isArray(parsed?.query) ? parsed.query : [];
          count = queries.length || 0;
        } catch {}
        try {
          let ref = refs.find((candidate, refIndex) => {
            if (usedRefs.has(refIndex)) return false;
            const matched = String(candidate?.matched_text || '');
            return matched && (matched === m || matched.includes(String(payload || '').slice(0, 80)));
          });
          if (!ref) {
            ref = refs.find((candidate, refIndex) => !usedRefs.has(refIndex) && Array.isArray(candidate?.safe_urls) && candidate.safe_urls.length);
          }
          if (ref) {
            const refIndex = refs.indexOf(ref);
            if (refIndex >= 0) usedRefs.add(refIndex);
            images = imageRefsToImages([ref]);
            count = Math.max(count, images.length);
          }
        } catch {}
        const marker = `ACEP_IMAGE_GROUP_PLACEHOLDER_${idx++}`;
        groups.push({ count: count || 0, marker, images });
        return `\n\n${marker}\n\n`;
      };
      let text = String(s || '');
      try {
        text = text.replace(
          new RegExp(`${String.fromCharCode(0xE200)}image_group${String.fromCharCode(0xE202)}([\\s\\S]*?)${String.fromCharCode(0xE201)}`, 'g'),
          consume
        );
      } catch {}
      text = text.replace(
        /(?:\uE200|&#x?e200;?|&#57344;)image_group(?:\uE202|&#x?e202;?|&#57346;)([\s\S]*?)(?:\uE201|&#x?e201;?|&#57345;)/gi,
        consume
      );
      text = text.replace(
        /(?:Ã®Ë†â‚¬|ÃƒÂ®Ã‹â€ Ã¢â€šÂ¬|ÃƒÆ’Ã‚Â®Ãƒâ€¹Ã¢â‚¬Â ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬)image_group(?:Ã®Ë†â€š|ÃƒÂ®Ã‹â€ Ã¢â‚¬Å¡|ÃƒÆ’Ã‚Â®Ãƒâ€¹Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡)([\s\S]*?)(?:Ã®Ë†Â|ÃƒÂ®Ã‹â€ Ã‚Â|ÃƒÆ’Ã‚Â®Ãƒâ€¹Ã¢â‚¬Â Ãƒâ€šÃ‚Â)/g,
        consume
      );
      return { text, groups, count: groups.reduce((sum, group) => sum + (Number(group.count) || 0), 0) };
    }

    function injectChatgptGalleryPlaceholders(html = '', groups = [], images = []) {
      let out = String(html || '');
      let cursor = 0;
      for (const group of groups || []) {
        const count = Number(group?.count || 0);
        const marker = String(group?.marker || '');
        if (!marker) continue;
        const groupImages = Array.isArray(group?.images) ? group.images : [];
        const slice = groupImages.length ? groupImages : images.slice(cursor, count ? cursor + count : images.length);
        if (!groupImages.length) cursor += count || slice.length;
        const galleryHtml = buildChatgptGalleryHtml(slice);
        const markerRe = new RegExp(`<p>\\s*${marker}\\s*<\\/p>|${marker}`, 'g');
        out = out.replace(markerRe, galleryHtml);
      }
      out = out.replace(/<p>\s*ACEP_IMAGE_GROUP_PLACEHOLDER_\d+\s*<\/p>/g, '');
      out = out.replace(/ACEP_IMAGE_GROUP_PLACEHOLDER_\d+/g, '');
      return out;
    }

    function buildChatgptGalleryHtml(images = []) {
      const list = (Array.isArray(images) ? images : []).filter(im => String(im?.src || im?.originalSrc || '').trim());
      if (!list.length) return '';
      const columns = Math.max(1, Math.min(list.length, 4));
      return `<div class="acep-chatgpt-image-gallery" style="--acep-gallery-columns:${columns};display:grid;grid-template-columns:repeat(${columns}, minmax(0, 1fr));gap:4px;margin:8px 0 14px 0;overflow:hidden;width:640px;max-width:100%;align-items:stretch;">${list.map((im, imageIndex) => {
        const src = String(im.src || im.originalSrc || '').trim();
        const alt = escapeHtmlCGPT(im.alt || 'image');
        const rounded = `${imageIndex === 0 ? ' rounded-s-xl' : ''}${imageIndex === list.length - 1 ? ' rounded-e-xl' : ''}`;
        return `<div class="acep-chatgpt-image-tile${rounded}" style="width:100%;max-width:100%;aspect-ratio:5/4;overflow:hidden;border-radius:12px;min-width:0;margin:0;padding:0;clear:none;position:relative;box-sizing:border-box;"><img src="${escapeHtmlCGPT(src)}" data-original-src="${escapeHtmlCGPT(src)}" data-acep-api-image="1" alt="${alt}" style="width:100%;height:100%;max-width:none;object-fit:cover;display:block;margin:0;padding:0;border-radius:12px;clear:none;"></div>`;
      }).join('')}</div>`;
    }

    function extractChatgptTextdocHtml(scope = null) {
      try {
        const root = scope && scope.querySelectorAll ? scope : document;
        const docs = [];
        if (root.matches && root.matches('[id^="textdoc-message-"]')) docs.push(root);
        docs.push(...Array.from(root.querySelectorAll('[id^="textdoc-message-"]')));
        if (!docs.length) return '';
        return docs.map((docEl) => {
          try {
            const title = String(
              docEl.querySelector('.text-token-text-primary.font-semibold')?.textContent ||
              docEl.querySelector('[class*="font-semibold"]')?.textContent ||
              ''
            ).replace(/\s+/g, ' ').trim();
            const body = docEl.querySelector('.ProseMirror') || docEl.querySelector('#prosemirror-editor-container [contenteditable="false"]');
            if (!body) return '';
            const clone = body.cloneNode(true);
            try {
              clone.querySelectorAll('button, svg, [aria-label="Copy"], [aria-label="Edit"], [aria-label="Download"]').forEach(el => el.remove());
              clone.querySelectorAll('[contenteditable]').forEach(el => el.removeAttribute('contenteditable'));
              clone.removeAttribute('contenteditable');
              clone.removeAttribute('translate');
              clone.removeAttribute('style');
            } catch {}
            const bodyHtml = String(clone.innerHTML || '').trim();
            if (!bodyHtml) return '';
            return `<section class="acep-chatgpt-textdoc" data-acep-chatgpt-textdoc="1">${title ? `<h2>${escapeHtmlCGPT(title)}</h2>` : ''}${bodyHtml}</section>`;
          } catch {
            return '';
          }
        }).filter(Boolean).join('');
      } catch {
        return '';
      }
    }

    function extractApiTextdocPayload(msg) {
      try {
        const recipient = String(msg?.recipient || msg?.author?.name || '');
        if (!/canmore\.create_textdoc/i.test(recipient)) return null;
        const candidates = [];
        if (typeof msg?.content?.text === 'string') candidates.push(msg.content.text);
        if (Array.isArray(msg?.content?.parts)) {
          msg.content.parts.forEach((part) => {
            if (typeof part === 'string') candidates.push(part);
            else if (typeof part?.text === 'string') candidates.push(part.text);
          });
        }
        for (const candidate of candidates) {
          try {
            const parsed = JSON.parse(candidate);
            if (!parsed || typeof parsed !== 'object') continue;
            const content = String(parsed.content || parsed.text || '').trim();
            if (!content) continue;
            return {
              title: String(parsed.title || parsed.name || '').replace(/_/g, ' ').trim(),
              type: String(parsed.type || 'document'),
              content,
              callMessageId: String(msg?.id || ''),
              textdocId: '',
            };
          } catch {}
        }
      } catch {}
      return null;
    }

    function buildApiTextdocHtml(textdoc) {
      try {
        const content = String(textdoc?.content || '').trim();
        if (!content) return '';
        const title = String(textdoc?.title || '').trim();
        const sourceId = textdoc?.textdocId ? `textdoc-message-${textdoc.textdocId}` : String(textdoc?.callMessageId || '');
        const bodyHtml = markdownToHtmlCGPT(content);
        if (!bodyHtml) return '';
        return `<section class="acep-chatgpt-textdoc" data-acep-chatgpt-textdoc="1"${sourceId ? ` data-acep-source-textdoc="${escapeHtmlCGPT(sourceId)}"` : ''}>${title ? `<h2>${escapeHtmlCGPT(title)}</h2>` : ''}${bodyHtml}</section>`;
      } catch {
        return '';
      }
    }

    function pickBestChatgptImageSrc(img) {
      try {
        const srcset = String(img?.getAttribute?.('srcset') || img?.srcset || '').trim();
        if (srcset) {
          const parts = srcset.split(',')
            .map(s => s.trim())
            .filter(Boolean)
            .map(s => {
              const bits = s.split(/\s+/);
              const url = bits[0] || '';
              const desc = bits[1] || '';
              const width = desc.match(/^(\d+)w$/i);
              const density = desc.match(/^(\d+(?:\.\d+)?)x$/i);
              return { url, score: width ? Number(width[1]) : (density ? Number(density[1]) * 10000 : 1) };
            })
            .filter(part => part.url)
            .sort((a, b) => b.score - a.score);
          if (parts.length) return parts[0].url;
        }
      } catch {}
      try { return String(img?.currentSrc || img?.getAttribute?.('src') || img?.src || '').trim(); } catch {}
      return '';
    }

    function collectChatgptDomGalleryImages(scope, targetCount = 0) {
      const images = [];
      const seen = new Set();
      try {
        if (!scope?.querySelectorAll) return images;
        scope.querySelectorAll('img').forEach((img) => {
          const src = pickBestChatgptImageSrc(img);
          if (!src || /avatar|favicon/i.test(src)) return;
          const key = src.split('#')[0];
          if (!key || seen.has(key)) return;
          seen.add(key);
          images.push({
            src,
            originalSrc: src,
            alt: img.getAttribute('alt') || 'image',
            className: img.getAttribute('class') || '',
            width: img.naturalWidth || img.width || 0,
            height: img.naturalHeight || img.height || 0,
          });
        });
      } catch {}
      const count = Number(targetCount || 0);
      return count > 0 ? images.slice(0, count) : images;
    }

    function markdownToHtmlCGPT(md = '', opts = {}) {
      if (!md) return '';
      const esc = escapeHtmlCGPT;
      const orderedListRe = /^\s*(\d+)(?:[.)])\s+/;
      const citationResult = applyChatgptApiCitations(md, opts.citationRefs || []);
      const citationTokens = citationResult.tokens || new Map();
      md = citationResult.text;
      // Strip any API citation artifacts that could not be rendered from API metadata.
      md = stripChatgptCitationArtifacts(md);
      md = extractChatgptImageGroupArtifacts(md).text;
      md = replaceChatgptEntityArtifacts(md);
      md = replaceChatgptInlineUrlArtifacts(md, opts.linkRefs || null);
      // Pre-process: split lines like "✅ item1 ✅ item2 ✅ item3" into separate lines
      const emojiItemRe = /(?:\p{Emoji_Presentation}|[\u2713\u2714]\ufe0f?|[0-9]\ufe0f?\u20e3)\s/u;
      const emojiLineRe = /^\s*(?:\p{Emoji_Presentation}|[\u2713\u2714]\ufe0f?|[0-9]\ufe0f?\u20e3)\s+/u;
      const rawLines = String(md).replace(/\r\n/g, '\n').split('\n');
      const lines = [];
      for (const l of rawLines) {
        const t = l.trim();
        if (emojiItemRe.test(t)) {
          // Split at boundaries between a non-space char and an emoji at start of next segment
          const parts = t.split(/(?<=\S)\s+(?=(?:\p{Emoji_Presentation}|[\u2713\u2714]\ufe0f?|[0-9]\ufe0f?\u20e3)\s)/u).map(s => s.trim()).filter(Boolean);
          if (parts.length >= 2 && parts.every(p => emojiItemRe.test(p))) {
            lines.push(...parts); continue;
          }
        }
        lines.push(l);
      }
      let out = '';
      let i = 0;
      let mermaidIdx = 0;
      const inline = (s) => {
        // Display math \[...\] appearing mid-paragraph (not caught by the line-start handler)
        s = s.replace(/\\\[([\s\S]+?)\\\]/g, (m, inner) => {
          const content = inner.trim();
          if (!content) return m;
          return `<div data-math="${content}" class="math-block"></div>`;
        });
        // Inline math \(...\) — ChatGPT API uses this delimiter format
        s = s.replace(/\\\((.+?)\\\)/g, (m, inner) => {
          return `<span data-math="${inner.trim()}" class="math-inline"></span>`;
        });
        // Inline math $...$ — skip currency like $5.00
        s = s.replace(/\$([^$\n]{1,500}?)\$/g, (m, inner) => {
          const mid = inner.trim();
          if (!mid || /^\d[\d.,]*$/.test(mid)) return m;
          return `<span data-math="${mid}" class="math-inline"></span>`;
        });
        s = s.replace(/!\[([^\]]*)\]\((https?:\/\/[^\s)]+|\/[^\s)]+)\)/g, (_m, alt, url) =>
          `<img src="${esc(url)}" data-original-src="${esc(url)}" data-acep-api-image="1" alt="${esc(alt)}">`);
        s = s.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
        s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
        s = s.replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>');
        s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
        return s;
      };
      const isHrLine = (ln) => /^\s*(?:(-\s*){3,}|(\*\s*){3,}|(_\s*){3,}|_{8,})\s*$/.test(String(ln || ''));
      while (i < lines.length) {
        const line = lines[i];
        // Fenced code block
        if (/^\s*```/.test(line)) {
          const lang = (line.match(/^\s*```(\S*)/) || [, ''])[1];
          let code = '';
          i++;
          while (i < lines.length && !/^\s*```/.test(lines[i])) { code += lines[i] + '\n'; i++; }
          const langLower = (lang || '').toLowerCase();
          const codeBlock = `<pre class="acep-diagram-code"><code${lang ? ` class="language-${esc(lang)}"` : ''}>${esc(code.trimEnd())}</code></pre>`;
          if (langLower === 'svg') {
            const svgDataUrl = 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(code.trim());
            // Keep codeBlock in the wrap so markdown/txt exports can use the raw SVG code.
            // normalizeHtmlForExport strips it for HTML (shows image); for md/txt it strips the image instead.
            out += `<div class="acep-diagram-wrap"><div class="acep-diagram-preview"><img src="${svgDataUrl}" data-acep-api-image="1" style="max-width:100%;height:auto;display:block;" alt="SVG diagram"></div>${codeBlock}</div>`;
          } else if (langLower === 'mermaid') {
            // Positional match: Nth mermaid block in API â†’ Nth rendered img captured from DOM
            const previewSrc = (opts.mermaidPreviews || [])[mermaidIdx++] || null;
            if (previewSrc) {
              out += `<div class="acep-diagram-wrap"><div class="acep-diagram-preview"><img src="${esc(previewSrc)}" data-acep-api-image="1" alt="Mermaid diagram" style="max-width:100%;height:auto;display:block;"></div>${codeBlock}</div>`;
            } else {
              out += `<p style="font-size:0.8em;color:#6b7280;margin:0 0 4px 0;">Mermaid diagram</p>${codeBlock}`;
            }
          } else {
            out += `<pre><code${lang ? ` class="language-${esc(lang)}"` : ''}>${esc(code.trimEnd())}</code></pre>`;
          }
          i++; continue;
        }
        // Display math \[...\] — ChatGPT API format (single-line or multi-line)
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
          if (mathContent.trim()) out += `<div data-math="${esc(mathContent.trim())}" class="math-block"></div>`;
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
          if (mathContent.trim()) out += `<div data-math="${esc(mathContent.trim())}" class="math-block"></div>`;
          continue;
        }
        if (isHrLine(line)) {
          out += '<hr>';
          i++; continue;
        }
        // Heading
        if (/^\s*#{1,6}\s+/.test(line)) {
          const level = (line.match(/^\s*(#{1,6})\s+/) || [, '#'])[1].length;
          out += `<h${level}>${inline(esc(line.replace(/^\s*#{1,6}\s+/, '').trim()))}</h${level}>`;
          i++; continue;
        }
        // Blockquote
        if (/^\s*>\s?/.test(line)) {
          const items = [];
          while (i < lines.length && /^\s*>\s?/.test(lines[i])) {
            items.push(lines[i].replace(/^\s*>\s?/, '').trim());
            i++;
          }
          out += `<blockquote>${items.map(l => `<p>${inline(esc(l))}</p>`).join('')}</blockquote>`;
          continue;
        }
        if (/^\s*[-*+•]\s+/.test(line) || emojiLineRe.test(line)) {
          const isEmoji = emojiLineRe.test(line);
          const matchRe = isEmoji ? emojiLineRe : /^\s*[-*+•]\s+/;
          const items = [];
          while (i < lines.length && (isEmoji ? emojiLineRe.test(lines[i]) : /^\s*[-*+•]\s+/.test(lines[i]))) {
            // Keep emoji prefix as content; strip plain markers
            items.push(isEmoji ? lines[i].trim() : lines[i].replace(/^\s*[-*+•]\s+/, '').trim());
            i++;
          }
          const listStyle = isEmoji ? ' style="list-style:none;padding-left:0.2em;"' : '';
          out += `<ul${listStyle}>${items.map(it => `<li>${inline(esc(it))}</li>`).join('')}</ul>`;
          continue;
        }
        // Ordered list
        if (orderedListRe.test(line)) {
          const firstMatch = line.match(orderedListRe);
          const startNum = Math.max(1, parseInt(firstMatch?.[1] || '1', 10) || 1);
          const items = [];
          while (i < lines.length && orderedListRe.test(lines[i])) { items.push(lines[i].replace(orderedListRe, '').trim()); i++; }
          out += `<ol${startNum > 1 ? ` start="${startNum}"` : ''}>${items.map(it => `<li>${inline(esc(it))}</li>`).join('')}</ol>`;
          continue;
        }
        // Table
        if (/^\s*\|/.test(line)) {
          const tLines = [];
          while (i < lines.length && /^\s*\|/.test(lines[i])) { tLines.push(lines[i]); i++; }
          if (tLines.length >= 2 && /^[\s|:\-]+$/.test(tLines[1])) {
            const parseRow = (r) => r.split('|').filter((_, idx, arr) => idx > 0 && idx < arr.length - 1);
            const ths = parseRow(tLines[0]).map(c => `<th>${inline(esc(c.trim()))}</th>`).join('');
            const trs = tLines.slice(2).map(row => {
              const tds = parseRow(row).map(c => `<td>${inline(esc(c.trim()))}</td>`).join('');
              return `<tr>${tds}</tr>`;
            }).join('');
            out += `<table><thead><tr>${ths}</tr></thead><tbody>${trs}</tbody></table>`;
          } else {
            out += `<p>${inline(esc(tLines.join(' ')))}</p>`;
          }
          continue;
        }
        if (!line.trim()) { i++; continue; }
        // Paragraph — stop collecting if the next line starts a structural element
        const buf = [];
        const isStructural = (l) => /^\s*[-*+•]\s+|^\s*\d+(?:[.)])\s+|^\s*#{1,6}\s+|^\s*>\s?|^\s*```|^\s*\||^\s*\\\[|^\s*\$\$/.test(l) || /^\s*\p{Emoji_Presentation}\s+/u.test(l) || isHrLine(l);
        while (i < lines.length && lines[i].trim()) {
          if (buf.length > 0 && isStructural(lines[i])) break;
          buf.push(lines[i]); i++;
        }
        const text = buf.join(' ').trim();
        if (text) out += `<p>${inline(esc(text))}</p>`;
      }
      for (const [token, html] of citationTokens.entries()) out = out.split(token).join(html);
      return out;
    }

    function buildApiTurnNodeCGPT({ role = 'assistant', html = '', imgs = [], turnId = '', galleryCount = 0 } = {}) {
      const el = document.createElement('div');
      try {
        el.setAttribute('data-acep-from-api', '1');
        el.setAttribute('data-acep-role', role);
        if (turnId) el.setAttribute('data-acep-turn-id', String(turnId));
        if (galleryCount) el.setAttribute('data-acep-gallery-count', String(galleryCount));
        el.setAttribute('data-acep-export-idx', '');
      } catch {}
      const content = document.createElement('div');
      content.className = 'acep-api-content';
      content.innerHTML = html || '';
      el.appendChild(content);
      if (imgs && imgs.length) {
        try { el.setAttribute('data-acep-imgs', JSON.stringify(imgs)); } catch {}
        try {
          const htmlHasGallery = /acep-chatgpt-image-gallery/i.test(String(html || ''));
          const gallerySrcImgs = imgs.filter(im => String(im?.src || im?.originalSrc || '').trim());
          if (!htmlHasGallery && galleryCount > 1 && gallerySrcImgs.length > 1) {
            const gallery = document.createElement('div');
            const columns = Math.max(1, Math.min(gallerySrcImgs.length, 4));
            gallery.className = 'acep-chatgpt-image-gallery';
            gallery.style.cssText = `--acep-gallery-columns:${columns};display:grid;grid-template-columns:repeat(${columns},minmax(0,1fr));gap:4px;margin:8px 0 14px 0;overflow:hidden;width:640px;max-width:100%;align-items:stretch;`;
            gallerySrcImgs.forEach((im, imageIndex) => {
              const src = String(im?.src || im?.originalSrc || '').trim();
              const tile = document.createElement('div');
              tile.className = `acep-chatgpt-image-tile ${imageIndex === 0 ? 'rounded-s-xl' : ''} ${imageIndex === gallerySrcImgs.length - 1 ? 'rounded-e-xl' : ''}`.trim();
              tile.style.cssText = 'aspect-ratio:5/4;overflow:hidden;border-radius:12px;min-width:0;';
              const img = document.createElement('img');
               img.setAttribute('src', src);
               img.setAttribute('data-original-src', src);
               img.setAttribute('data-acep-api-image', '1');
              if (im?.alt) img.setAttribute('alt', String(im.alt));
              img.style.cssText = 'width:100%;height:100%;object-fit:cover;display:block;margin:0;padding:0;border-radius:12px;';
              tile.appendChild(img);
              gallery.appendChild(tile);
            });
            content.appendChild(gallery);
          }
          imgs.forEach((im) => {
            const src = String(im?.src || im?.originalSrc || '').trim();
            if (src) {
              if (htmlHasGallery || (galleryCount > 1 && gallerySrcImgs.length > 1)) return;
              const img = document.createElement('img');
               img.setAttribute('src', src);
               img.setAttribute('data-original-src', src);
               img.setAttribute('data-acep-api-image', '1');
              if (im?.alt) img.setAttribute('alt', String(im.alt));
              img.style.cssText = 'max-width:100%;height:auto;display:block;margin:8px 0;';
              content.appendChild(img);
            } else if (im?.isFileAttachment && im?.alt) {
              const p = document.createElement('p');
              p.setAttribute('data-acep-attachment-name', String(im.alt));
              if (im?.attachmentUrl) p.setAttribute('data-acep-attachment-url', String(im.attachmentUrl));
              p.textContent = `📎 ${im.alt}`;
              content.appendChild(p);
            }
          });
        } catch {}
      }
      return el;
    }

    function appendApiTurnNodeCGPT(nodes, nextNode) {
      if (!nextNode) return;
      const nextRole = String(nextNode.getAttribute?.('data-acep-role') || '');
      const previous = nodes[nodes.length - 1] || null;
      const previousRole = String(previous?.getAttribute?.('data-acep-role') || '');
      if (nextRole !== 'assistant' || previousRole !== 'assistant') {
        nodes.push(nextNode);
        return;
      }

      try {
        const previousContent = previous.querySelector('.acep-api-content');
        const nextContent = nextNode.querySelector('.acep-api-content');
        if (previousContent && nextContent) {
          while (nextContent.firstChild) previousContent.appendChild(nextContent.firstChild);
        }

        const readImgs = (node) => {
          try {
            const value = JSON.parse(node.getAttribute('data-acep-imgs') || '[]');
            return Array.isArray(value) ? value : [];
          } catch {
            return [];
          }
        };
        const mergedImgs = [...readImgs(previous), ...readImgs(nextNode)];
        if (mergedImgs.length) previous.setAttribute('data-acep-imgs', JSON.stringify(mergedImgs));

        const galleryCount =
          Number(previous.getAttribute('data-acep-gallery-count') || 0) +
          Number(nextNode.getAttribute('data-acep-gallery-count') || 0);
        if (galleryCount) previous.setAttribute('data-acep-gallery-count', String(galleryCount));
      } catch {
        nodes.push(nextNode);
      }
    }

    function debugScanChatgptApiCitations(data = {}) {
      try {
        const hits = [];
        const wantedKey = /citation|cite|source|reference|url|web|attribution|search/i;
        const wantedValue = /https?:\/\/|turn\d+(?:search|view|news|image)\d+|citation|source|webpage|search_result/i;
        const addHit = ({ path, key = '', value = '', msg = null, parent = null }) => {
          if (hits.length >= 80) return;
          let parentPreview = '';
          try { parentPreview = JSON.stringify(parent); } catch {}
          hits.push({
            path,
            key,
            role: msg?.author?.role || '',
            msgId: msg?.id || '',
            value: String(value || '').slice(0, 1500),
            parentKeys: parent && typeof parent === 'object' ? Object.keys(parent).slice(0, 50) : [],
            parentPreview: String(parentPreview || '').slice(0, 3000),
          });
        };
        const scan = (value, path = '', msg = null, parent = null, key = '') => {
          if (hits.length >= 80 || value == null) return;
          const keyHit = wantedKey.test(String(key || ''));
          if (typeof value === 'string') {
            if (keyHit || wantedValue.test(value)) addHit({ path, key, value, msg, parent });
            return;
          }
          if (Array.isArray(value)) {
            value.forEach((item, index) => scan(item, path + '[' + index + ']', msg, value, String(index)));
            return;
          }
          if (typeof value === 'object') {
            if (keyHit) addHit({ path, key, value: '[object]', msg, parent: value });
            Object.entries(value).forEach(([childKey, childValue]) => {
              scan(childValue, path ? path + '.' + childKey : childKey, msg, value, childKey);
            });
          }
        };
        Object.entries(data?.mapping || {}).forEach(([nodeId, node]) => {
          const msg = node?.message;
          if (msg) scan(msg, 'mapping.' + nodeId + '.message', msg, node, 'message');
        });
        const result = {
          mappingCount: Object.keys(data?.mapping || {}).length,
          hitsCount: hits.length,
          hits,
        };
        document.documentElement.setAttribute('data-acep-chatgpt-api-citation-scan', JSON.stringify(result).slice(0, 120000));
      } catch (err) {
        try { document.documentElement.setAttribute('data-acep-chatgpt-api-citation-scan', JSON.stringify({ error: String(err?.message || err) })); } catch {}
      }
    }
    async function fetchApiTurnNodesForCurrentChat() {
      try {
        if (!env.isChatGPT || !env.isChatGPT()) return null;
        const convId = getChatConvId();
        if (!convId) { debugStore('apiScrape', { ok: false, reason: 'no convId' }); return null; }

        const prevConvId = g.ACEP?.providers?.chatgpt?.__apiConvId;
        const prevTs = Number(g.ACEP?.providers?.chatgpt?.__apiTs || 0);
        const prevNodes = g.ACEP?.providers?.chatgpt?.__apiTurnNodes;
        if (prevConvId === convId && Array.isArray(prevNodes) && prevNodes.length && (Date.now() - prevTs) < 120000) {
          debugStore('apiScrape', { ok: true, convId, count: prevNodes.length, cached: true });
          return { convId, nodes: prevNodes };
        }
        // Throttle failed retries: don't re-fetch within 15s of a previous failure
        const failTs = Number(g.ACEP?.providers?.chatgpt?.__apiFailTs || 0);
        if (failTs && (Date.now() - failTs) < 15000) {
          debugStore('apiScrape', { ok: false, reason: 'throttled_after_failure' });
          return null;
        }

        let data;
        const token = g.ACEP?.providers?.chatgpt?.__bearerToken || '';
        const headers = { Accept: 'application/json' };
        if (token) headers['Authorization'] = `Bearer ${token}`;
        const resp = await fetch(`https://chatgpt.com/backend-api/conversation/${convId}`, {
          credentials: 'include',
          headers,
        });
        if (!resp.ok) throw new Error(`ChatGPT API HTTP ${resp.status}`);
        data = await resp.json();
        debugScanChatgptApiCitations(data);
        if (!data?.mapping || !data?.current_node) {
          debugStore('apiScrape', { ok: false, reason: 'no mapping/current_node' });
          return null;
        }

        // Walk from current_node up to root via parent links, then reverse for chronological order
        const mapping = data.mapping;
        const thread = [];
        let cur = data.current_node;
        let steps = 0;
        const maxSteps = Math.max(1000, Object.keys(mapping || {}).length + 5);
        while (cur && mapping[cur] && steps < maxSteps) {
          thread.unshift(mapping[cur]);
          cur = mapping[cur].parent;
          steps++;
        }
        if (cur && mapping[cur]) {
          debugStore('apiScrapeTruncated', { maxSteps, mappingCount: Object.keys(mapping || {}).length });
        }

        const nodes = [];
        const globalCitationRefs = collectChatgptSearchCitationReferences(data);
        for (const node of thread) {
          const msg = node?.message;
          if (!msg) continue;
          const role = String(msg.author?.role || '').toLowerCase();
          if (role === 'system') continue;
          const parts = Array.isArray(msg.content?.parts) ? msg.content.parts : [];
          const createdTextdoc = extractApiTextdocPayload(msg);
          if (createdTextdoc) {
            const textdocHtml = buildApiTextdocHtml(createdTextdoc);
            if (textdocHtml) {
              appendApiTurnNodeCGPT(nodes, buildApiTurnNodeCGPT({
                role: 'assistant',
                html: textdocHtml,
                imgs: [],
                turnId: String(msg.id || ''),
                galleryCount: 0,
              }));
            }
            continue;
          }
          if (role === 'tool') {
            // Only process tool messages that carry generated images (e.g. DALL-E results)
            const hasImageParts = parts.some(p => p && typeof p === 'object' &&
              /^image/i.test(String(p.content_type || p.type || '')));
            if (!hasImageParts) continue;
          } else {
            // Skip internal tool-call messages: addressed to a specific tool (not 'all'),
            // or explicitly hidden. These are DALL-E prompts, browser tool calls, etc.
            const isToolCall = msg.recipient && msg.recipient !== 'all';
            const isHidden = msg.metadata?.is_visually_hidden_from_conversation === true;
            if (isToolCall || isHidden) continue;
          }
          const exportRole = role === 'user' ? 'user' : 'assistant';
          const turnId = String(msg.id || '');

          const mermaidPreviews = [];
          const linkRefs = { byLabel: {}, byRef: {} };

          const textParts = [];
          const imgs = [];
          for (const part of parts) {
            if (typeof part === 'string') {
              if (part.trim()) textParts.push(part);
            } else if (part && typeof part === 'object') {
              const pt = String(part.content_type || part.type || '');
              if (pt === 'image_asset_pointer' || pt === 'image') {
                if (role !== 'user' && role !== 'tool') continue;
                const assetPtr = String(part.asset_pointer || '');
                const fileId = normalizeChatgptAssetId(assetPtr);
                if (fileId) {
                  const estuaryMap = g.ACEP?.providers?.chatgpt?.__estuaryUrlMap || {};
                  const imgUrl = estuaryMap[fileId] || buildChatgptFileDownloadUrl(fileId, convId);
                  if (imgUrl) imgs.push({ src: imgUrl, originalSrc: imgUrl, alt: 'uploaded image' });
                }
              } else if (pt === 'text' && part.text) {
                textParts.push(String(part.text));
              } else if (part.asset_pointer) {
                // Non-image file upload (PDF, doc, audio, etc.)
                const assetPtr = String(part.asset_pointer || '');
                const fileId = normalizeChatgptAssetId(assetPtr);
                if (fileId) {
                  const meta = part.metadata || {};
                  const fname = String(
                    meta.sanitized_file_name || meta.display_name || meta.name ||
                    meta.file_name || part.name || ''
                  ).trim() || fileId;
                  const downloadUrl = buildChatgptFileDownloadUrl(fileId, convId);
                  imgs.push({ src: '', originalSrc: '', alt: fname, attachmentUrl: downloadUrl, isFileAttachment: true });
                }
              }
            }
          }

          // Handle file uploads stored in msg.metadata.attachments (PDFs, docs, etc.)
          // ChatGPT extracts text into parts but keeps the file reference here only.
          const metaAtts = role === 'user' && Array.isArray(msg.metadata?.attachments) ? msg.metadata.attachments : [];
          for (const att of metaAtts) {
            const fileId = String(att.id || '').trim();
            if (!fileId) continue;
            const fname = String(att.name || att.file_name || att.title || '').trim() || fileId;
            // Dedup: skip if already added by filename OR by fileId in an existing img URL.
            // Image asset pointers get added with alt='uploaded image', so a filename-only
            // check misses them — also check whether the same fileId is in any src URL.
            if (imgs.some(im =>
              (im.alt && im.alt.toLowerCase() === fname.toLowerCase()) ||
              (im.src && im.src.includes(fileId)) ||
              (im.originalSrc && im.originalSrc.includes(fileId))
            )) continue;
            const downloadUrl = buildChatgptFileDownloadUrl(fileId, convId);
            imgs.push({ src: '', originalSrc: '', alt: fname, attachmentUrl: downloadUrl, isFileAttachment: true });
          }

          const contentRefs = normalizeChatgptContentReferences(msg);
          const combinedCitationRefs = dedupeChatgptCitationReferences([...globalCitationRefs, ...normalizeChatgptCitationReferences(msg)]);
          const joinedText = textParts.join('\n');
          const citationRefs = filterChatgptCitationsForText(combinedCitationRefs, joinedText);
          try {
            if (combinedCitationRefs.length || citationRefs.length) document.documentElement.setAttribute('data-acep-chatgpt-citation-audit', JSON.stringify({ turnId, total: combinedCitationRefs.length, count: citationRefs.length, sample: citationRefs.slice(0, 4) }).slice(0, 2000));
          } catch {}
          const imageGroups = replaceChatgptImageGroupsWithPlaceholders(joinedText, contentRefs);
          const galleryCount = imageGroups.count || 0;
          const galleryImagesAll = imageGroups.groups.flatMap(group => Array.isArray(group.images) ? group.images : []);
          try {
            const imageRefCount = contentRefs.filter(ref => String(ref?.type || '') === 'image_group').length;
            if (imageRefCount) document.documentElement.setAttribute('data-acep-chatgpt-imagegroup-ref-count', String(imageRefCount));
          } catch {}
          if (galleryCount) {
            try {
              document.documentElement.setAttribute('data-acep-chatgpt-imagegroup-last-count', String(galleryCount));
              document.documentElement.setAttribute('data-acep-chatgpt-imagegroup-last-images', String(galleryImagesAll.length));
              document.documentElement.setAttribute('data-acep-chatgpt-imagegroup-last-ref-images', String(imageGroups.groups.reduce((sum, group) => sum + (Array.isArray(group.images) ? group.images.length : 0), 0)));
            } catch {}
          }
          const rawText = replaceChatgptEntityArtifacts(imageGroups.text).trim();
          let html = rawText ? markdownToHtmlCGPT(rawText, { mermaidPreviews, linkRefs, citationRefs }) : '';
          html = injectChatgptGalleryPlaceholders(html, imageGroups.groups, galleryImagesAll.length ? galleryImagesAll : imgs);
          if (!html && !imgs.length) continue;
          appendApiTurnNodeCGPT(nodes, buildApiTurnNodeCGPT({ role: exportRole, html, imgs, turnId, galleryCount }));
        }

        debugStore('apiScrape', { ok: true, convId, count: nodes.length });
        return { convId, nodes };
      } catch (e) {
        try { g.ACEP.providers.chatgpt.__apiFailTs = Date.now(); } catch {}
        const errMsg = String(e?.message || e || '');
        debugStore('apiScrape', { ok: false, err: errMsg });
        return null;
      }
    }

    function buildEstuaryUrlMap() {
      // Scan live DOM images and map fileId â†’ estuary URL.
      // Estuary URLs are same-origin and fetchable with credentials; download URLs redirect
      // cross-origin to a CDN that blocks extension fetches.
      const map = {};
      try {
        document.querySelectorAll('img[srcset], img[src]').forEach(img => {
          const candidates = [];
          const srcset = img.getAttribute('srcset') || '';
          if (srcset) {
            srcset.split(',').forEach(s => {
              const u = s.trim().split(/\s+/)[0];
              if (u) candidates.push(u);
            });
          }
          const src = img.getAttribute('src') || img.src || '';
          if (src) candidates.push(src);
          for (const url of candidates) {
            const m = url.match(/[?&]id=(file_[^&\s]+)/);
            if (m) {
              const fileId = decodeURIComponent(m[1]);
              if (!map[fileId]) map[fileId] = url;
            }
          }
        });
      } catch {}
      return map;
    }

    async function preScrape() {
      g.ACEP.providers.chatgpt.__apiNetworkFailed = false;
      g.ACEP.providers.chatgpt.__apiFailed = false;
      g.ACEP.providers.chatgpt.__estuaryUrlMap = buildEstuaryUrlMap();
      try {
        const res = await fetchApiTurnNodesForCurrentChat();
        if (res && Array.isArray(res.nodes) && res.nodes.length) {
          g.ACEP.providers.chatgpt.__apiTurnNodes = res.nodes;
          g.ACEP.providers.chatgpt.__apiConvId = res.convId || '';
          g.ACEP.providers.chatgpt.__apiTs = Date.now();
          debugStore('prescrape', { ok: true, mode: 'api', count: res.nodes.length });
          return;
        }
        // API returned empty/null — flag it so content.js can show proper error
        g.ACEP.providers.chatgpt.__apiTurnNodes = [];
        g.ACEP.providers.chatgpt.__apiConvId = '';
        g.ACEP.providers.chatgpt.__apiTs = 0;
        g.ACEP.providers.chatgpt.__apiFailed = true;
      } catch (e) {
        debugStore('prescrape_api_err', String(e?.message || e));
        g.ACEP.providers.chatgpt.__apiTurnNodes = [];
        g.ACEP.providers.chatgpt.__apiConvId = '';
        g.ACEP.providers.chatgpt.__apiTs = 0;
        g.ACEP.providers.chatgpt.__apiFailed = true;
        if (e instanceof TypeError || /failed to fetch|networkerror|network error/i.test(String(e?.message || ''))) {
          g.ACEP.providers.chatgpt.__apiNetworkFailed = true;
        }
      }
      debugStore('prescrape', { ok: false, mode: 'api', reason: 'api_failed' });
    }

    function innerHTMLFromTurn(turn) {
      const replaceFileReferenceButtons = (root) => {
        try {
          // ChatGPT file reference chip buttons:
          // <button type="button" ...><svg ...></svg><p class="... truncate">filename (N)</p></button>
          const ps = Array.from(root.querySelectorAll('button[type="button"] p.truncate'));
          ps.forEach((p) => {
            try {
              const btn = p.closest('button[type="button"]');
              if (!btn) return;
              const txt = (p.textContent || '').trim();
              if (!txt) return;
              const hasSvg = !!btn.querySelector('svg');
              const cls = String(btn.className || '');
              const looksChip = hasSvg && (cls.includes('rounded') || cls.includes('corner-superellipse') || cls.includes('rounded-xl'));
              if (!looksChip) return;
              const span = document.createElement('span');
              span.className = 'acep-file-ref';
              span.textContent = `📎 ${txt}`;
              btn.replaceWith(span);
            } catch {}
          });
        } catch {}
      };

      const removeFileciteEls = (root) => {
        try {
          // Remove elements with "filecite" in class/id/data-attr
          root.querySelectorAll('[class*="filecite"], [id*="filecite"], [data-filecite]').forEach(el => { try { el.remove(); } catch {} });
          // Remove ChatGPT file-citation chips: <span aria-haspopup="dialog"> (Radix dialog triggers)
          // and <span type="button" aria-haspopup> — these render as "filename (N)" buttons and have
          // NO "filecite" text in their markup, so only structural selectors can catch them.
          root.querySelectorAll('span[aria-haspopup]').forEach(el => { try { if (!el.querySelector('img')) el.remove(); } catch {} });
        } catch {}
      };
      const stripFilecite = (html) => {
        if (!html || typeof html !== 'string') return html || '';
        let s = html.replace(/<([a-zA-Z]+)[^>]*filecite[^>]*>[^<]*<\/\1>/gi, '');
        return stripChatgptCitationArtifacts(s);
      };
      try {
        if (turn?.getAttribute?.('data-acep-from-api') === '1') {
          const c = turn.querySelector?.('.acep-api-content');
          if (c) {
            replaceFileReferenceButtons(c);
            removeFileciteEls(c);
            return stripFilecite(c.innerHTML || '');
          }
          return stripFilecite(turn.innerHTML || '');
        }
        if (!env.isChatGPT || !env.isChatGPT()) return '';
        if (!turn || !turn.cloneNode) return stripFilecite((turn && turn.innerHTML) ? String(turn.innerHTML) : '');
        const clone = turn.cloneNode(true);
        // Remove action bars / UI-only controls that sometimes live inside turns.
        try {
          clone.querySelectorAll('[data-testid$=\"-turn-action-button\"], [data-testid=\"action-bar-copy\"], button[aria-label=\"Copy\"], button[aria-label=\"More actions\"], button[aria-label=\"Good response\"], button[aria-label=\"Bad response\"], button[aria-label=\"Share\"]').forEach((n) => {
            try { n.remove(); } catch {}
          });
        } catch {}
        // Remove file citation chips — removeFileciteEls covers both aria-haspopup spans and filecite-class elements.
        replaceFileReferenceButtons(clone);
        removeFileciteEls(clone);
        const content = clone.querySelector(sel.messageContent || '.markdown, [data-testid=\"message-content\"], .prose, .markdown-new-styling');
        const textdocHtml = extractChatgptTextdocHtml(clone);
        if (content) return stripFilecite(`${content.innerHTML || ''}${textdocHtml || ''}`);
        if (textdocHtml) return stripFilecite(textdocHtml);
        return stripFilecite(clone.innerHTML || '');
      } catch {
        return stripFilecite((turn && turn.innerHTML) ? String(turn.innerHTML) : '');
      }
    }

    function getImageCaptionFromTurn(turn) {
      try {
        if (!env.isChatGPT || !env.isChatGPT()) return '';
        const cand = turn?.querySelector?.('.truncate');
        const txt = (cand?.innerText || '').trim();
        return txt || '';
      } catch {
        return '';
      }
    }

    function getChatTitle() {
      try {
        if (!env.isChatGPT || !env.isChatGPT()) return (document.title || 'AI Conversation').trim();
        const h = document.querySelector(sel.convoTitle || 'header h1, [data-testid=\"conversation-title\"]');
        const t = (h?.textContent || document.title || 'AI Conversation').trim();
        return t.replace(/\s+/g, ' ').trim();
      } catch {
        return (document.title || 'AI Conversation').trim();
      }
    }

    function getSelectionRoleQueues(exportKeys = []) {
      try {
        if (!env.isChatGPT || !env.isChatGPT()) return null;
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

    function postProcessExportRows(ctx = {}) {
      if (!env.isChatGPT || !env.isChatGPT()) return;
      const rows = Array.isArray(ctx.rows) ? ctx.rows : [];
      if (!rows.length) return;
      const rowTurnMap = Array.isArray(ctx.rowTurnMap) ? ctx.rowTurnMap : [];
      const appendVisibleTextdocs = () => {
        try {
          const hasApiTextdoc = rows.some((row) =>
            /data-acep-chatgpt-textdoc=/i.test(String(row?.html || row?.rawHtml || ''))
          );
          if (hasApiTextdoc) return;
          const docs = Array.from(document.querySelectorAll('[id^="textdoc-message-"]'));
          if (!docs.length) return;
          const used = new Set();
          let attachedCount = 0;
          const rowHasTextdoc = (row, id) => {
            const h = String(row?.html || row?.rawHtml || '');
            return h.includes(`data-acep-source-textdoc="${id}"`) || h.includes(`id="${id}"`);
          };
          const findTargetRow = (docEl) => {
            const id = docEl.getAttribute('id') || '';
            for (const mapped of rowTurnMap) {
              const row = rows[Number(mapped?.rowIndex)];
              const turn = mapped?.turn;
              if (!row || row.role !== 'assistant' || !turn || !turn.contains) continue;
              if (turn.contains(docEl)) return row;
              if (id && rowHasTextdoc(row, id)) return row;
            }
            let best = null;
            for (const mapped of rowTurnMap) {
              const row = rows[Number(mapped?.rowIndex)];
              const turn = mapped?.turn;
              if (!row || row.role !== 'assistant' || !turn || !turn.compareDocumentPosition) continue;
              const pos = turn.compareDocumentPosition(docEl);
              if (pos & Node.DOCUMENT_POSITION_FOLLOWING) best = row;
            }
            if (best) return best;
            for (let i = rows.length - 1; i >= 0; i--) {
              if (rows[i]?.role === 'assistant') return rows[i];
            }
            return null;
          };
          docs.forEach((docEl) => {
            try {
              const id = docEl.getAttribute('id') || '';
              if (!id || used.has(id)) return;
              const html = extractChatgptTextdocHtml(docEl);
              if (!html) return;
              let target = findTargetRow(docEl);
              if (target && rowHasTextdoc(target, id)) return;
              const stamped = html.replace(
                '<section class="acep-chatgpt-textdoc"',
                `<section class="acep-chatgpt-textdoc" data-acep-source-textdoc="${escapeHtmlCGPT(id)}"`
              );
              if (!target) {
                target = {
                  role: 'assistant',
                  rawHtml: '',
                  html: '',
                  imgs: [],
                  originalImgs: [],
                  imageCaption: '',
                  text: '',
                  roleLabel: '',
                  turnId: id,
                  galleryCount: 0,
                };
                rows.push(target);
                rowTurnMap.push({ rowIndex: rows.length - 1, turn: docEl });
              }
              target.html = `${target.html || ''}${stamped}`;
              target.rawHtml = `${target.rawHtml || ''}${stamped}`;
              used.add(id);
              attachedCount++;
            } catch {}
          });
          debugStore('textdocPostprocess', { found: docs.length, attached: attachedCount, rows: rows.length });
        } catch {}
      };
      // Strip any lingering filecite markers from every row's HTML (defensive layer
      // in case old cached API nodes or DOM fallback still carry them).
      // Use DOM-based removal so entire elements (e.g. <span class="fileciteturn0file0">text</span>)
      // are removed — not just the attribute value, which would leave the visible text behind.
      const domStripFilecite = (htmlStr) => {
        if (!htmlStr || !/(?:filecite|citeturn|Ã®Ë†â‚¬citeÃ®Ë†â€š|îˆ€citeîˆ‚)/i.test(htmlStr)) return htmlStr;
        try {
          const div = document.createElement('div');
          div.innerHTML = htmlStr;
          div.querySelectorAll('[class*="filecite"], [id*="filecite"], [data-filecite]').forEach(el => { try { el.remove(); } catch {} });
          // TreeWalker on text nodes: catches tokens where HTML entity encoding defeats string regex
          const walker = document.createTreeWalker(div, NodeFilter.SHOW_TEXT, null);
          const tnodes = [];
          let tn;
          while ((tn = walker.nextNode())) {
            if (/(?:filecite|citeturn|Ã®Ë†â‚¬citeÃ®Ë†â€š|îˆ€citeîˆ‚)/i.test(tn.nodeValue)) tnodes.push(tn);
          }
          tnodes.forEach(tn => { tn.nodeValue = stripChatgptCitationArtifacts(tn.nodeValue); });
          let out = div.innerHTML;
          out = stripChatgptCitationArtifacts(out);
          if (/filecite/i.test(out)) out = out.replace(/<([a-zA-Z]+)[^>]*filecite[^>]*>[^<]*<\/\1>/gi, '');
          return out;
        } catch {
          return stripChatgptCitationArtifacts(htmlStr.replace(/<([a-zA-Z]+)[^>]*filecite[^>]*>[^<]*<\/\1>/gi, ''));
        }
      };
      for (const r of rows) {
        try { if (r.html && /(?:filecite|citeturn|Ã®Ë†â‚¬citeÃ®Ë†â€š|îˆ€citeîˆ‚)/i.test(r.html)) r.html = domStripFilecite(r.html); } catch {}
        try { if (r.rawHtml && /(?:filecite|citeturn|Ã®Ë†â‚¬citeÃ®Ë†â€š|îˆ€citeîˆ‚)/i.test(r.rawHtml)) r.rawHtml = domStripFilecite(r.rawHtml); } catch {}
      }
      rows.forEach((r) => {
        try { if (r.html && /entity/i.test(r.html)) r.html = replaceChatgptEntityArtifacts(r.html); } catch {}
        try { if (r.rawHtml && /entity/i.test(r.rawHtml)) r.rawHtml = replaceChatgptEntityArtifacts(r.rawHtml); } catch {}
      });
      rows.forEach((r, rowIndex) => {
        try {
          const sourceHtml = String(r.html || r.rawHtml || '');
          if (!/image_group/i.test(sourceHtml)) return;
          const parsed = replaceChatgptImageGroupsWithPlaceholders(sourceHtml);
          const expected = Number(parsed.count || 0);
          if (!expected) return;
          let galleryImages = [];
          if (!galleryImages.length && Array.isArray(r.imgs) && r.imgs.length) {
            galleryImages = r.imgs
              .filter(im => String(im?.src || im?.originalSrc || '').trim())
              .slice(0, expected);
          }
          if (!galleryImages.length) return;
          r.galleryCount = Math.max(Number(r.galleryCount || 0), expected);
          r.html = replaceChatgptEntityArtifacts(injectChatgptGalleryPlaceholders(parsed.text || '', parsed.groups, galleryImages));
          if (r.rawHtml) {
            const rawParsed = replaceChatgptImageGroupsWithPlaceholders(r.rawHtml);
            r.rawHtml = replaceChatgptEntityArtifacts(injectChatgptGalleryPlaceholders(rawParsed.text || '', rawParsed.groups, galleryImages));
          } else {
            r.rawHtml = r.html;
          }
        } catch {}
      });
      // ChatGPT: if a "user" turn is image-only AND the images look like generated outputs (not uploads), treat it as assistant.
      const looksGeneratedImg = (im = {}) => {
        const s = String(im.src || im.originalSrc || '').toLowerCase();
        return (
          /\/backend-api\/estuary\/content/.test(s) ||
          /oaidalleapiprodscus\.blob\.core\.windows\.net/.test(s) ||
          /files\.oaiusercontent\.com/.test(s)
        );
      };
      const looksUserUpload = (im = {}) => {
        const alt = String(im.alt || '').toLowerCase();
        const cls = String(im.className || '').toLowerCase();
        const hasSize = !!(im.width && im.height);
        return (
          alt.includes('uploaded image') ||
          cls.includes('object-cover') ||
          cls.includes('rounded') ||
          (hasSize && !cls.includes('absolute'))
        );
      };
      for (let i = 0; i < rows.length; i++) {
        const r = rows[i];
        if (r.role !== 'user') continue;
        const hasImg = Array.isArray(r.imgs) && r.imgs.length > 0;
        if (!hasImg) continue;
        const textOnly = (() => {
          const div = document.createElement('div');
          div.innerHTML = r.html || '';
          const t = (div.innerText || '').replace(/\s+/g, '').trim();
          return t;
        })();
        // Only flip if every image looks like a generated output (leave user uploads alone)
        const generatedOnly = r.imgs.every(looksGeneratedImg);
        const hasUserUpload = r.imgs.some(looksUserUpload);
        if (!textOnly && generatedOnly && !hasUserUpload) {
          r.role = 'assistant';
        }
      }
    }

    function postProcessHtmlWrapper(ctx = {}) {
      try {
        if (!env.isChatGPT || !env.isChatGPT()) return;
        const wrapper = ctx && ctx.wrapper;
        if (!wrapper || !wrapper.querySelectorAll) return;

        const galleryImgs = new Set();

        // 1. Fix gallery grids (.no-scrollbar.flex containers)
        const galleries = Array.from(wrapper.querySelectorAll('.no-scrollbar.flex'));
        galleries.forEach((g) => {
          try {
            const tiles = Array.from(g.children);
            const columns = Math.max(3, Math.min(tiles.length || 3, 4));
            const isAcepgallery = g.classList.contains('acep-chatgpt-image-gallery');

            // Force gallery layout to a tight ChatGPT-style grid (override Tailwind-dependent inline gap).
            g.style.cssText += isAcepgallery
              ? `;display:grid;grid-template-columns:repeat(${columns}, minmax(0, 1fr));overflow:hidden;min-height:0;align-items:stretch;justify-content:start;align-content:start;width:640px;max-width:100%;margin:8px 0 14px 0;padding:0;`
              : `;display:grid;grid-template-columns:repeat(${columns}, minmax(0, 1fr));overflow:hidden;min-height:144px;align-items:stretch;justify-content:start;align-content:start;width:640px;max-width:100%;margin:8px 0 14px 0;padding:0;`;
            g.style.setProperty('gap', '4px', 'important');
            g.style.setProperty('column-gap', '4px', 'important');
            g.style.setProperty('row-gap', '4px', 'important');
            g.style.setProperty('--acep-gallery-columns', String(columns));

            tiles.forEach((tile) => {
              if (!(tile instanceof Element)) return;
              tile.style.cssText += ';width:100%;max-width:100%;aspect-ratio:5/4;height:auto;overflow:hidden;border-radius:12px;margin:0;padding:0;flex:initial;box-sizing:border-box;';
              const imgs = Array.from(tile.querySelectorAll('img'));
              if (imgs.length) {
                imgs.forEach((img) => {
                  img.removeAttribute('width');
                  img.removeAttribute('height');
                  img.classList.remove('absolute');
                  const objectPosition = String(img.style?.objectPosition || img.getAttribute('data-acep-object-position') || '').trim() || '50% 0%';
                  img.setAttribute('data-acep-object-position', objectPosition);
                  img.style.cssText += `;position:static;width:100%;height:100%;max-width:none;object-fit:cover;object-position:${objectPosition};border-radius:12px;display:block;margin:0;padding:0;`;
                  galleryImgs.add(img);
                });
                // Flatten: move imgs directly into tile, removing Tailwind-dependent
                // intermediate wrappers (button.h-full, div.group/search-image, etc.)
                // that collapse to zero height without Tailwind CSS loaded.
                tile.innerHTML = '';
                imgs.forEach((img) => tile.appendChild(img));
              } else {
                const bg = tile.getAttribute('data-inline-src') || tile.getAttribute('data-original-src');
                if (bg) {
                  tile.style.cssText += ';background-size:cover;background-position:center;background-repeat:no-repeat;';
                }
              }
            });

            const clear = document.createElement('div');
            clear.style.cssText = 'clear:both;height:0;line-height:0;';
            g.parentNode && g.parentNode.insertBefore(clear, g.nextSibling);
          } catch {}
        });

        // 2. Unwrap images inside <button> elements (ChatGPT wraps upload thumbnails in buttons).
        // Must run after gallery flattening so gallery tiles no longer contain buttons.
        Array.from(wrapper.querySelectorAll('button')).forEach((btn) => {
          try {
            const imgs = Array.from(btn.querySelectorAll('img'));
            if (!imgs.length || !btn.parentElement) return;
            imgs.forEach((img) => btn.parentElement.insertBefore(img, btn));
            btn.parentElement.removeChild(btn);
          } catch {}
        });

        // 3. Fix standalone images outside gallery grids (generated/uploaded).
        // Generated images have large width/height attrs (e.g. 1536x1024) that render
        // at full pixel size and cause layout overflow, and class="absolute" that
        // can cause text overlay. Normalize them to fluid sizing.
        wrapper.querySelectorAll('img').forEach((img) => {
          if (galleryImgs.has(img)) return;
          try {
            const w = parseInt(img.getAttribute('width') || '0', 10);
            const h = parseInt(img.getAttribute('height') || '0', 10);
            if (w > 600 || h > 600) {
              img.removeAttribute('width');
              img.removeAttribute('height');
            }
            if (img.classList.contains('absolute')) {
              img.classList.remove('absolute');
              img.style.cssText += ';position:static;';
            }
            img.style.cssText += ';max-width:100%;height:auto;display:block;margin:8px 0;';
          } catch {}
        });
        try {
          const chatgptProv = globalThis.ACEP?.providers?.chatgpt;
          chatgptProv?.expandChatgptCitationPills?.(wrapper);
          chatgptProv?.cleanChatgptCitationLinkText?.(wrapper);
        } catch {}
      } catch {}
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
          let src = img.currentSrc || img.getAttribute('src') || '';
          if (!src || /avatar|favicon/i.test(src)) return;
          const key = src.split('#')[0];
          if (!seen.has(key)) {
            seen.add(key);
            images.push({ src, alt: img.getAttribute('alt') || '', className: img.getAttribute('class') || '', width: img.naturalWidth || img.width || 0, height: img.naturalHeight || img.height || 0 });
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
        // Collect from background-image styles (inline only — avoids picking up CSS-class favicon icons)
        turn.querySelectorAll('[style*="background-image" i]').forEach(el => {
          const bg = (el.style && el.style.backgroundImage) || '';
          if (!bg) return;
          const m = /url\(("|')?(.*?)\1\)/i.exec(bg);
          if (m && m[2]) {
            const src = m[2].trim();
            const key = src.split('#')[0];
            if (!seen.has(key)) {
              seen.add(key);
              images.push({ src, alt: '' });
            }
          }
        });
        // Collect ChatGPT file tiles from DOM (DOM scrape path — no URL available here)
        turn.querySelectorAll('[role="group"][aria-label]').forEach(el => {
          if (!el.querySelector('[data-default-action]')) return;
          const name = (el.getAttribute('aria-label') || '').trim();
          if (!name || !/\.[a-z0-9]{1,10}$/i.test(name)) return;
          const key = `att:${name.toLowerCase()}`;
          if (!seen.has(key)) {
            seen.add(key);
            images.push({ src: '', originalSrc: '', alt: name, attachmentUrl: '', isFileAttachment: true });
          }
        });
        // Collect file attachment markers injected by buildApiTurnNodeCGPT
        turn.querySelectorAll('[data-acep-attachment-name]').forEach(el => {
          const alt = (el.getAttribute('data-acep-attachment-name') || '').trim();
          const attachmentUrl = (el.getAttribute('data-acep-attachment-url') || '').trim();
          if (!alt) return;
          const key = `att:${alt.toLowerCase()}`;
          if (!seen.has(key)) {
            seen.add(key);
            images.push({ src: '', originalSrc: '', alt, attachmentUrl, isFileAttachment: true });
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
        const declared = Number(turn.getAttribute?.('data-acep-gallery-count') || 0);
        const seen = new Set();
        let count = 0;
        turn.querySelectorAll('img[src]').forEach(img => {
          const src = (img.currentSrc || img.getAttribute('src') || '').split('#')[0];
          if (!seen.has(src)) {
            seen.add(src);
            count++;
          }
        });
        turn.querySelectorAll('source[srcset]').forEach(s => {
          const srcset = (s.getAttribute('srcset') || '').trim();
          if (!srcset) return;
          const first = srcset.split(',')[0].trim().split(' ')[0].trim().split('#')[0];
          if (!seen.has(first)) {
            seen.add(first);
            count++;
          }
        });
        return Math.max(Number.isFinite(declared) ? declared : 0, count);
      } catch {
        return 0;
      }
    }

    g.ACEP.providers.chatgpt.isApiFirst = true;
    g.ACEP.providers.chatgpt.extractSelectableTurnNodes = extractSelectableTurnNodes;
    g.ACEP.providers.chatgpt.isProtectedAsset = (u) =>
      /backend-api\/estuary\/content|backend-api\/files\/download|files\.oaiusercontent\.com/i.test(String(u || ''));
    g.ACEP.providers.chatgpt.getTurnsForExport = getTurnsForExport;
    g.ACEP.providers.chatgpt.roleFromTurn = roleFromTurn;
    g.ACEP.providers.chatgpt.innerHTMLFromTurn = innerHTMLFromTurn;
    g.ACEP.providers.chatgpt.getImageCaptionFromTurn = getImageCaptionFromTurn;
    g.ACEP.providers.chatgpt.getChatTitle = getChatTitle;
    g.ACEP.providers.chatgpt.getSelectionRoleQueues = getSelectionRoleQueues;
    g.ACEP.providers.chatgpt.postProcessExportRows = postProcessExportRows;
    g.ACEP.providers.chatgpt.postProcessHtmlWrapper = postProcessHtmlWrapper;
    g.ACEP.providers.chatgpt.preScrape = preScrape;
    g.ACEP.providers.chatgpt.hasImages = hasImages;
    g.ACEP.providers.chatgpt.getImagesFromTurn = getImagesFromTurn;
    g.ACEP.providers.chatgpt.getGalleryCountFromTurn = getGalleryCountFromTurn;

    debugStore('loaded', true);
    try { document.documentElement.setAttribute('data-acep-loaded-chatgpt-provider', '1'); } catch {}
  } catch {}
})();


