// Claude artifact handling functions
// Extracted from content.js during comprehensive refactoring

(function initClaudeArtifacts() {
  try {
    const g = (typeof globalThis !== 'undefined') ? globalThis : window;
    if (!g.ACEP) g.ACEP = {};
    if (!g.ACEP.providers) g.ACEP.providers = {};
    if (!g.ACEP.providers.claude) g.ACEP.providers.claude = {};

    // Global artifact cache
    let ACEP_CLAUDE_ARTIFACTS = null;
    let ACEP_CLAUDE_ARTIFACTS_PROMISE = null;
    let ACEP_CLAUDE_ARTIFACTS_LOADED = false;
    let ACEP_CLAUDE_CHAT_EXPORT_FILES = null;

    // Utility: normalize Claude title for comparison
    function normalizeClaudeTitle(s = '') {
      return String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();
    }

    // Extract chat ID from URL (/chat/uuid or /c/uuid)
    function getClaudeChatIdFromUrl() {
      try {
        const path = String(location.pathname || '');
        // Most common: /chat/<uuid>
        let m = path.match(/\/chat\/([a-f0-9-]{8,})/i);
        if (m && m[1]) return m[1];
        // Alternate short route sometimes used: /c/<uuid>
        m = path.match(/\/c\/([a-f0-9-]{8,})/i);
        if (m && m[1]) return m[1];
        // Fallback: first UUID-like token in the path
        m = path.match(/([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/i);
        if (m && m[1]) return m[1];
        // Last resort: look in query params
        try {
          const u = new URL(location.href);
          const qp = u.searchParams.get('chat') || u.searchParams.get('id') || u.searchParams.get('conversation') || '';
          const mm = String(qp).match(/([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/i);
          if (mm && mm[1]) return mm[1];
        } catch {}
        return '';
      } catch { return ''; }
    }

    // Extract organization ID from multiple sources
    function getClaudeOrgId() {
      const extractOrgIdFromUrl = (u = '') => {
        try {
          const s = String(u || '');
          const m = s.match(/\/api\/organizations\/([a-f0-9-]{8,})\//i);
          return m ? String(m[1] || '').trim() : '';
        } catch { return ''; }
      };
      const findFromPerformance = () => {
        try {
          if (!performance || typeof performance.getEntriesByType !== 'function') return '';
          const entries = performance.getEntriesByType('resource') || [];
          for (const e of entries) {
            const name = e && e.name ? String(e.name) : '';
            if (!name) continue;
            const id = extractOrgIdFromUrl(name);
            if (id) return id;
          }
        } catch {}
        return '';
      };
      try {
        const v = localStorage.getItem('lastActiveOrg') || sessionStorage.getItem('lastActiveOrg');
        if (v) return v;
      } catch {}
      try {
        const cookie = String(document.cookie || '');
        const parts = cookie.split(';');
        for (const part of parts) {
          const [k, v] = part.trim().split('=');
          if (k === 'lastActiveOrg' && v) return v;
        }
      } catch {}
      try {
        const el = document.querySelector('meta[name="anthropic-organization-id"]');
        if (el && el.getAttribute('content')) return el.getAttribute('content');
      } catch {}
      try {
        const id = findFromPerformance();
        if (id) return id;
      } catch {}
      // Last resort: scan inline scripts for org API URLs
      try {
        const scripts = Array.from(document.querySelectorAll('script')).slice(0, 60);
        for (const s of scripts) {
          const txt = (s && (s.textContent || s.innerText)) ? String(s.textContent || s.innerText) : '';
          if (!txt || txt.length > 120000) continue;
          const m = txt.match(/\/api\/organizations\/([a-f0-9-]{8,})\//i);
          if (m && m[1]) return String(m[1] || '').trim();
        }
      } catch {}
      return '';
    }

    // Async version with timeout and message passing
    async function getClaudeOrgIdAsync(timeoutMs = 300) {
      const existing = getClaudeOrgId();
      if (existing) return existing;
      const waitForPerf = (ms = 600) => new Promise((resolve) => {
        const start = Date.now();
        const tick = () => {
          const v = getClaudeOrgId();
          if (v) return resolve(v);
          if (Date.now() - start >= ms) return resolve('');
          setTimeout(tick, 80);
        };
        tick();
      });
      const perfFound = await waitForPerf(Math.max(250, timeoutMs));
      if (perfFound) return perfFound;
      return await new Promise((resolve) => {
        let done = false;
        const finish = (v) => { if (!done) { done = true; resolve(v || ''); } };
        const onMsg = (evt) => {
          try {
            if (evt.origin !== 'https://claude.ai') return;
            const data = evt.data || {};
            if (data.type === 'RspOrgID' && data.orgId) {
              window.removeEventListener('message', onMsg);
              finish(data.orgId);
            }
          } catch {}
        };
        try { window.addEventListener('message', onMsg); } catch {}
        try { window.parent?.postMessage('ReqOrgID', '*'); } catch {}
        setTimeout(() => {
          try { window.removeEventListener('message', onMsg); } catch {}
          finish(getClaudeOrgId());
        }, timeoutMs);
      });
    }

    // Prune messages to leaf node in conversation tree
    function pruneClaudeMessagesToLeaf(convoData = {}, leafId = '') {
      try {
        const msgs = Array.isArray(convoData.chat_messages) ? convoData.chat_messages : [];
        if (!msgs.length || !leafId) return msgs;
        const byId = new Map(msgs.map(m => [m.uuid, m]));
        const out = [];
        let cur = leafId;
        let steps = 0;
        while (cur && byId.has(cur) && steps < msgs.length + 5) {
          const m = byId.get(cur);
          out.unshift(m);
          cur = m.parent_message_uuid;
          steps++;
        }
        return out.length ? out : msgs;
      } catch { return convoData.chat_messages || []; }
    }

    // Parse artifact versions from messages (antArtifact tags, tool_use, tool_result)
    function parseClaudeArtifactsFromMessages(messages = []) {
      const versions = [];
      const findLastById = (id) => {
        for (let i = versions.length - 1; i >= 0; i--) {
          if (versions[i].id === id) return versions[i];
        }
        return null;
      };
      const versionCount = new Map();
      const toStr = (v) => (typeof v === 'string' ? v : (v == null ? '' : String(v)));
      const getExplicitVersion = (input = {}) => {
        const candidates = [
          input.version,
          input.version_number,
          input.version_index,
          input.revision,
        ];
        for (const c of candidates) {
          if (c == null) continue;
          const n = typeof c === 'number' ? c : parseInt(String(c), 10);
          if (Number.isFinite(n) && n > 0) return n;
        }
        return null;
      };
      const bumpVersion = (id, explicit) => {
        const cur = versionCount.get(id) || 0;
        if (explicit && Number.isFinite(explicit)) {
          if (explicit > cur) versionCount.set(id, explicit);
          return explicit;
        }
        const v = cur + 1;
        versionCount.set(id, v);
        return v;
      };
      const parseAntArtifactsFromText = (text = '') => {
        const out = [];
        const re = /<antArtifact\b([^>]*)>([\s\S]*?)<\/antArtifact>/gi;
        let m;
        while ((m = re.exec(text)) !== null) {
          const attrs = m[1] || '';
          const body = (m[2] || '').trim();
          if (!body) continue;
          const getAttr = (name) => {
            const rx = new RegExp(`${name}\\s*=\\s*["']([^"']+)["']`, 'i');
            const mm = rx.exec(attrs);
            return mm ? mm[1] : '';
          };
          const title = getAttr('title');
          const type = getAttr('type');
          const language = getAttr('language');
          out.push({
            id: `ant:${normalizeClaudeTitle(title || body.slice(0, 40))}`,
            title: title || '',
            type: type || '',
            language: language || '',
            content: body,
          });
        }
        return out;
      };
      const extractArtifactsFromToolResult = (part) => {
        const out = [];
        try {
          const items = Array.isArray(part?.content) ? part.content : [];
          for (const it of items) {
            if (!it) continue;
            let payload = null;
            if (it.type === 'text' && typeof it.text === 'string') {
              try { payload = JSON.parse(it.text); } catch {}
            } else if (it.type === 'json' && it.json) {
              payload = it.json;
            } else if (it.type === 'output' && it.output) {
              payload = it.output;
            }
            if (!payload || typeof payload !== 'object') continue;
            const list = payload.artifacts || payload.artifact || payload.data || payload.result;
            const arr = Array.isArray(list) ? list : (list ? [list] : []);
            arr.forEach(a => {
              if (!a || typeof a !== 'object') return;
              const content = a.content || a.text || a.code || a.body || '';
              if (!content) return;
              out.push({
                id: a.id || `tool_result:${normalizeClaudeTitle(a.title || content.slice(0, 40))}`,
                title: a.title || '',
                type: a.type || '',
                language: a.language || '',
                content: String(content),
              });
            });
          }
        } catch {}
        return out;
      };
      try {
        for (const msg of messages) {
          const content = Array.isArray(msg?.content) ? msg.content : [];
          if (!content.length && typeof msg?.content === 'string') {
            const extras = parseAntArtifactsFromText(msg.content);
            extras.forEach(e => versions.push(e));
          }
          for (const part of content) {
            if (!part || part.type !== 'tool_use' || !part.input) continue;
            const input = part.input || {};
            const cmd = input.command || '';
            const id = input.id || '';
            if (!input.id) continue;
            if (cmd === 'create' && (input.content || input.new_str)) {
              const v = bumpVersion(input.id, getExplicitVersion(input));
              versions.push({
                id: input.id,
                title: input.title || '',
                type: input.type || '',
                language: input.language || '',
                content: toStr(input.content || input.new_str),
                _acepVersion: v,
              });
            } else if (cmd === 'update' && (input.old_str || input.new_str || input.content)) {
              const prev = findLastById(input.id);
              const newStr = input.new_str || input.content || '';
              let newContent = '';
              if (input.old_str) {
                newContent = prev
                  ? (prev.content || '').split(input.old_str).join(input.new_str || '')
                  : toStr(newStr);
              } else if (newStr) {
                newContent = toStr(newStr);
              } else if (prev?.content) {
                newContent = prev.content;
              }
              if (!newContent) continue;
              const v = bumpVersion(input.id, getExplicitVersion(input));
              versions.push({
                id: input.id,
                title: input.title || (prev?.title || ''),
                type: input.type || (prev?.type || ''),
                language: input.language || (prev?.language || ''),
                content: newContent,
                _acepVersion: v,
              });
            } else if (cmd === 'rewrite' && (input.content || input.new_str)) {
              const prev = findLastById(input.id);
              const v = bumpVersion(input.id, getExplicitVersion(input));
              versions.push({
                id: input.id,
                title: input.title || (prev?.title || ''),
                type: input.type || (prev?.type || ''),
                language: input.language || (prev?.language || ''),
                content: toStr(input.content || input.new_str),
                _acepVersion: v,
              });
            }
          }
          for (const part of content) {
            if (!part || part.type !== 'text' || !part.text) continue;
            const extras = parseAntArtifactsFromText(part.text);
            extras.forEach(e => versions.push(e));
          }
          for (const part of content) {
            if (!part || part.type !== 'tool_result') continue;
            const extras = extractArtifactsFromToolResult(part);
            if (extras.length) {
              extras.forEach(e => versions.push(e));
            }
          }
        }
      } catch {}
      return versions;
    }

    // Load artifacts from Claude API
    async function loadClaudeArtifactsFromApi() {
      if (!/claude\.ai$/i.test(location.hostname)) return [];
      if (Array.isArray(ACEP_CLAUDE_ARTIFACTS) && ACEP_CLAUDE_ARTIFACTS.length) return ACEP_CLAUDE_ARTIFACTS;
      if (ACEP_CLAUDE_ARTIFACTS_PROMISE) return ACEP_CLAUDE_ARTIFACTS_PROMISE;
      ACEP_CLAUDE_ARTIFACTS_PROMISE = (async () => {
        try {
          let orgId = await getClaudeOrgIdAsync(1500);
          const chatId = getClaudeChatIdFromUrl();
          if (!orgId || !chatId) return [];
          const latestUrl = `https://claude.ai/api/organizations/${orgId}/chat_conversations/${chatId}/latest`;
          const treeUrl = `https://claude.ai/api/organizations/${orgId}/chat_conversations/${chatId}?tree=True&rendering_mode=messages&render_all_tools=true`;
          const [latestResp, treeResp] = await Promise.all([
            fetch(latestUrl, { credentials: 'include' }),
            fetch(treeUrl, { credentials: 'include' }),
          ]);
          if (!latestResp.ok || !treeResp.ok) return [];
          const latest = await latestResp.json().catch(() => ({}));
          const tree = await treeResp.json().catch(() => ({}));
          const leafId = latest?.current_leaf_message_uuid || tree?.current_leaf_message_uuid || '';
          const messages = pruneClaudeMessagesToLeaf(tree, leafId);
          const artifacts = parseClaudeArtifactsFromMessages(messages);
          ACEP_CLAUDE_ARTIFACTS = artifacts || [];
          ACEP_CLAUDE_ARTIFACTS_LOADED = Array.isArray(ACEP_CLAUDE_ARTIFACTS) && ACEP_CLAUDE_ARTIFACTS.length > 0;
          return ACEP_CLAUDE_ARTIFACTS;
        } catch (err) {
          return [];
        } finally {
          ACEP_CLAUDE_ARTIFACTS_PROMISE = null;
        }
      })();
      return ACEP_CLAUDE_ARTIFACTS_PROMISE;
    }

    // Load Claude "Chat export" download cards
    async function loadClaudeChatExportFilesFromApi() {
      try {
        if (!/claude\.ai$/i.test(location.hostname)) return null;
        const cards = Array.from(document.querySelectorAll('.artifact-block-cell')).filter((el) => {
          try {
            const t = (el.innerText || el.textContent || '').trim();
            return /chat\s*export/i.test(t) && /download/i.test(t);
          } catch { return false; }
        });
        if (!cards.length) return null;

        const chatId = getClaudeChatIdFromUrl();
        const orgId = await getClaudeOrgIdAsync(1200);
        if (!chatId || !orgId) return null;

        const filePathByKind = {
          txt: '/mnt/user-data/outputs/chat-export.txt',
          html: '/mnt/user-data/outputs/chat-export.html',
          docx: '/mnt/user-data/outputs/chat-export.docx',
          pdf: '/mnt/user-data/outputs/chat-export.pdf',
        };
        const mkUrl = (kind) => {
          const path = filePathByKind[kind];
          if (!path) return '';
          return `https://claude.ai/api/organizations/${orgId}/conversations/${chatId}/wiggle/download-file?path=${encodeURIComponent(path)}`;
        };

        const kinds = new Set();
        cards.forEach((el) => {
          const t = (el.innerText || el.textContent || '').toUpperCase();
          if (/\bTXT\b/.test(t)) kinds.add('txt');
          if (/\bHTML\b/.test(t)) kinds.add('html');
          if (/\bDOCX\b/.test(t)) kinds.add('docx');
          if (/\bPDF\b/.test(t)) kinds.add('pdf');
        });
        kinds.add('txt');
        kinds.add('html');

        const out = {};
        for (const kind of Array.from(kinds)) {
          const url = mkUrl(kind);
          if (!url) continue;
          if (kind === 'txt' || kind === 'html') {
            try {
              const resp = await fetch(url, { credentials: 'include' });
              if (!resp.ok) {
                out[kind] = { kind, url, ok: false, status: resp.status };
                continue;
              }
              const text = await resp.text().catch(() => '');
              out[kind] = { kind, url, ok: true, text: String(text || '') };
            } catch (e) {
              out[kind] = { kind, url, ok: false, error: String(e && e.message ? e.message : e) };
            }
          } else {
            out[kind] = { kind, url, ok: true, linkOnly: true };
          }
        }
        ACEP_CLAUDE_CHAT_EXPORT_FILES = out;
        return out;
      } catch {
        return null;
      }
    }

    // Apply loaded artifacts to DOM elements
    function applyClaudeArtifactsToDom(artifacts = []) {
      if (!artifacts.length) return;
      const cards = Array.from(document.querySelectorAll('[role="button"][aria-label="Preview contents"], .artifact-block-cell'));
      const roots = Array.from(new Set(cards.map(c => c.closest('[role="button"][aria-label="Preview contents"]') || c))).filter(Boolean);
      if (!roots.length) return;
      const byTitle = new Map();
      const byId = new Map();
      artifacts.forEach(a => {
        if (!a || !a.content) return;
        const key = normalizeClaudeTitle(a.title);
        if (!key) return;
        const list = byTitle.get(key) || [];
        list.push(a);
        byTitle.set(key, list);
        if (a.id) {
          const idList = byId.get(a.id) || [];
          idList.push(a);
          byId.set(a.id, idList);
        }
      });
      const used = new Map();
      roots.forEach(root => {
        if (root?.dataset?.acepArtifactText) return;
        const title = (root.dataset && root.dataset.acepArtifactTitle)
          || (root.querySelector('.leading-tight')?.textContent || '').trim();
        const dataId = root.getAttribute?.('data-acep-artifact-id') || root.dataset?.acepArtifactId || '';
        const key = normalizeClaudeTitle(title);
        let list = key ? (byTitle.get(key) || []) : [];
        if (!list.length && dataId && byId.has(dataId)) list = byId.get(dataId) || [];
        let picked = null;
        if (list.length) {
          const verMatch = String(root.textContent || '').match(/version\s+(\d+)/i);
          const targetVer = verMatch ? parseInt(verMatch[1], 10) : null;
          if (targetVer && Number.isFinite(targetVer)) {
            picked = list.find(a => Number(a._acepVersion) === targetVer) || null;
          }
          if (!picked) {
            const usedKey = dataId || key;
            const idx = used.get(usedKey) || 0;
            if (list[idx]) picked = list[idx];
            used.set(usedKey, idx + 1);
          }
        }
        if (!picked || !picked.content) return;
        if (root?.dataset) {
          root.dataset.acepArtifactText = picked.content;
          if (!root.dataset.acepArtifactTitle && picked.title) root.dataset.acepArtifactTitle = picked.title;
          if (picked._acepVersion) root.dataset.acepArtifactVersion = String(picked._acepVersion);
          if (picked.id) root.dataset.acepArtifactId = picked.id;
        }
      });
    }

    // Find artifact in DOM by title
    function findClaudeArtifactInDomByTitle(title = '') {
      const key = normalizeClaudeTitle(title);
      if (!key) return null;
      const cards = Array.from(document.querySelectorAll('[role="button"][aria-label="Preview contents"], .artifact-block-cell'));
      for (const node of cards) {
        const root = node.closest('[role="button"][aria-label="Preview contents"]') || node;
        const t = (root.dataset && root.dataset.acepArtifactTitle) || (root.querySelector('.leading-tight')?.textContent || '').trim();
        if (normalizeClaudeTitle(t) !== key) continue;
        const body = root.dataset && root.dataset.acepArtifactText;
        const html = root.dataset && root.dataset.acepArtifactHtml;
        const isCode = !!(root.dataset && root.dataset.acepArtifactIsCode === '1');
        if (body || html) return { title: t, content: body || '', html: html || '', isCode };
      }
      return null;
    }

    // Inject artifacts into cloned document
    function injectClaudeArtifactsIntoClone(clone, sanitizeFunc) {
      if (!clone || !clone.querySelector) return;
      const artifacts = Array.isArray(ACEP_CLAUDE_ARTIFACTS) ? ACEP_CLAUDE_ARTIFACTS : [];
      const byTitle = new Map();
      const byId = new Map();
      artifacts.forEach(a => {
        if (!a || !a.content) return;
        const key = normalizeClaudeTitle(a.title);
        if (!key) return;
        const list = byTitle.get(key) || [];
        list.push(a);
        byTitle.set(key, list);
        if (a.id) {
          const idList = byId.get(a.id) || [];
          idList.push(a);
          byId.set(a.id, idList);
        }
      });
      const used = new Map();
      const usedById = new Map();
      let nodes = Array.from(clone.querySelectorAll('[role="button"][aria-label="Preview contents"], .artifact-block-cell, [data-testid*="artifact" i]'));
      if (!nodes.length) {
        nodes = Array.from(clone.querySelectorAll('*')).filter(el => /interactive artifact/i.test((el.textContent || '').trim()));
      }
      if (!nodes.length) return;
      const doc = clone.ownerDocument || document;
      const stripBoxDrawingDecorations = (text = '') => {
        const s = String(text || '').replace(/\r\n/g, '\n');
        const lines = s.split('\n');
        const cleaned = [];
        for (const line of lines) {
          const raw = String(line || '');
          const nonSpace = raw.replace(/\s+/g, '');
          if (nonSpace.length >= 10) {
            const borderOnly = nonSpace.replace(/[\u2500-\u257F\u2580-\u259F\u25A0-\u25FF]/g, '');
            const borderRatio = (nonSpace.length - borderOnly.length) / nonSpace.length;
            if (borderRatio >= 0.9) continue;
          }
          cleaned.push(raw);
        }
        return cleaned.join('\n').trimEnd();
      };
      const isProbablyCode = (meta = {}) => {
        const language = (meta.language || '').toLowerCase();
        const type = (meta.type || '').toLowerCase();
        const title = (meta.title || '').toLowerCase();
        if (/\.(js|ts|tsx|jsx|py|rb|go|rs|java|kt|swift|c|cc|cpp|h|hpp|cs|php|sh|bash|ps1|sql|json|yml|yaml|toml|ini|xml|html|css|scss|less)\b/.test(title)) return true;
        if (language && !['markdown', 'md', 'text', 'plain', 'plaintext'].includes(language)) return true;
        if (type && /(code|snippet|program|source)/i.test(type)) return true;
        const body = String(meta.content || '');
        if (/```/.test(body)) return true;
        if (/^\s*<!doctype\s+html/i.test(body) || /^\s*<html[\s>]/i.test(body)) return true;
        if (/^\s*(import|export|function|class|const|let|var)\b/m.test(body)) return true;
        if (/^\s*(\$|#|>|\w+@[\w.-]+:)/m.test(body) && (body.match(/\n/g) || []).length >= 3) return true;
        const braceCount = (body.match(/[{};]/g) || []).length;
        const lineCount = (body.match(/\n/g) || []).length + 1;
        const indentedLines = (body.match(/^\s{4,}\S/mg) || []).length;
        if (lineCount >= 4 && indentedLines >= 2) return true;
        if (lineCount >= 8 && (braceCount >= 6 || /^\s*\w+\s*[:=]/m.test(body))) return true;
        return (braceCount > 12 && lineCount >= 6) || (indentedLines >= 4 && lineCount >= 6);
      };
      const makeNode = (title, body, version, opts = {}) => {
        const wrap = doc.createElement('div');
        wrap.className = 'acep-artifact';
        if (title) {
          const t = doc.createElement('div');
          t.className = 'acep-artifact-title';
          t.appendChild(doc.createTextNode(title));
          wrap.appendChild(t);
        }
        if (version) {
          const v = doc.createElement('div');
          v.className = 'acep-artifact-version';
          v.appendChild(doc.createTextNode(`Version ${version}`));
          wrap.appendChild(v);
        }
        const html = (opts && opts.html) ? String(opts.html) : '';
        let plainFromHtml = '';
        try {
          if (html && sanitizeFunc) {
            const tmp = doc.createElement('div');
            tmp.innerHTML = sanitizeFunc(html);
            plainFromHtml = String(tmp.innerText || tmp.textContent || '').replace(/\r\n/g, '\n').trim();
          }
        } catch {}
        const safeBody = stripBoxDrawingDecorations(body || plainFromHtml || '');
        const asCode = !!(opts && opts.isCode)
          || /<(pre|code)\b/i.test(html)
          || /\bcode-block__code\b/i.test(html)
          || /\blanguage-[a-z0-9_-]+\b/i.test(html)
          || /\bshiki\b/i.test(html)
          || /```/.test(safeBody);
        if (!asCode && html && /<(p|h\d|ul|ol|blockquote|strong|em|u|a)\b/i.test(html)) {
          const rich = doc.createElement('div');
          rich.className = 'acep-artifact-rich standard-markdown';
          try { rich.innerHTML = sanitizeFunc ? sanitizeFunc(html) : html; } catch { rich.innerHTML = html; }
          wrap.appendChild(rich);
        } else if (asCode) {
          const pre = doc.createElement('pre');
          const code = doc.createElement('code');
          code.appendChild(doc.createTextNode(safeBody));
          pre.appendChild(code);
          wrap.appendChild(pre);
        } else {
          const text = doc.createElement('div');
          text.className = 'acep-artifact-text';
          text.style.whiteSpace = 'pre-wrap';
          text.appendChild(doc.createTextNode(safeBody));
          wrap.appendChild(text);
        }
        return wrap;
      };
      nodes.forEach((node) => {
        const title = (node.querySelector?.('.leading-tight')?.textContent || '').trim();
        const dataText = node.getAttribute?.('data-acep-artifact-text') || node.dataset?.acepArtifactText;
        const dataHtml = node.getAttribute?.('data-acep-artifact-html') || node.dataset?.acepArtifactHtml;
        const dataIsCode = (node.getAttribute?.('data-acep-artifact-is-code') || node.dataset?.acepArtifactIsCode) === '1';
        const dataTitle = node.getAttribute?.('data-acep-artifact-title') || node.dataset?.acepArtifactTitle;
        const dataId = node.getAttribute?.('data-acep-artifact-id') || node.dataset?.acepArtifactId || '';
        const dataVerRaw = node.getAttribute?.('data-acep-artifact-version') || node.dataset?.acepArtifactVersion;
        const dataVer = dataVerRaw ? parseInt(String(dataVerRaw), 10) : null;
        if (dataText) {
          const verText = (dataVer && Number.isFinite(dataVer)) ? dataVer : null;
          node.replaceWith(makeNode(dataTitle || title, dataText, verText, { html: dataHtml || '', isCode: dataIsCode }));
          return;
        }
        if (dataHtml) {
          const verText = (dataVer && Number.isFinite(dataVer)) ? dataVer : null;
          node.replaceWith(makeNode(dataTitle || title, '', verText, { html: dataHtml || '', isCode: dataIsCode }));
          return;
        }
        let picked = null;
        if (dataId && byId.has(dataId)) {
          const list = byId.get(dataId) || [];
          if (dataVer && Number.isFinite(dataVer)) {
            picked = list.find(a => Number(a._acepVersion) === dataVer) || null;
          }
          if (!picked && list.length) {
            const idx = usedById.get(dataId) || 0;
            if (list[idx]) picked = list[idx];
            usedById.set(dataId, idx + 1);
          }
        }
        if (!picked) {
          const key = normalizeClaudeTitle(title);
          const list = key ? (byTitle.get(key) || []) : [];
          if (list.length) {
            const verMatch = String(node.textContent || '').match(/version\s+(\d+)/i);
            const targetVer = verMatch ? parseInt(verMatch[1], 10) : null;
            if (targetVer && Number.isFinite(targetVer)) {
              picked = list.find(a => Number(a._acepVersion) === targetVer) || null;
            }
            if (!picked) {
              const idx = used.get(key) || 0;
              if (list[idx]) picked = list[idx];
              used.set(key, idx + 1);
            }
          }
          if (!picked) {
            const domPicked = findClaudeArtifactInDomByTitle(title);
            if (domPicked && (domPicked.content || domPicked.html)) {
              node.replaceWith(makeNode(domPicked.title, domPicked.content, null, { html: domPicked.html || '', isCode: !!domPicked.isCode }));
              return;
            }
          }
        }
        if (!picked || !picked.content) return;
        const pickedVer = picked._acepVersion ? Number(picked._acepVersion) : null;
        node.replaceWith(makeNode(
          picked.title || title,
          picked.content,
          Number.isFinite(pickedVer) ? pickedVer : null,
          { html: picked.html || '', isCode: isProbablyCode(picked) }
        ));
      });
    }

    // Clean Claude tool blocks and replace with embed content
    function cleanClaudeToolBlocks(html = '', sanitizeFunc) {
      try {
        if (!/claude\.ai$/i.test(location.hostname)) return html;
        if (!html || typeof html !== 'string') return html;
        const tmp = document.createElement('div');
        tmp.innerHTML = html;

        try {
          const exports = ACEP_CLAUDE_CHAT_EXPORT_FILES && typeof ACEP_CLAUDE_CHAT_EXPORT_FILES === 'object'
            ? ACEP_CLAUDE_CHAT_EXPORT_FILES
            : null;
          const cells = Array.from(tmp.querySelectorAll('.artifact-block-cell'));
          cells.forEach((cell) => {
            try {
              const raw = (cell.innerText || cell.textContent || '').trim();
              if (!/chat\s*export/i.test(raw) || !/download/i.test(raw)) return;

              const upper = raw.toUpperCase();
              let kind = '';
              if (/\bTXT\b/.test(upper)) kind = 'txt';
              else if (/\bHTML\b/.test(upper)) kind = 'html';
              else if (/\bDOCX\b/.test(upper)) kind = 'docx';
              else if (/\bPDF\b/.test(upper)) kind = 'pdf';
              if (!kind) kind = 'txt';

              const info = exports && exports[kind] ? exports[kind] : null;
              const url = info && info.url ? String(info.url) : '';

              const outer = tmp.ownerDocument.createElement('div');
              outer.className = 'acep-chat-export-wrap';
              outer.setAttribute('style', 'margin:8px 0;');

              const title = tmp.ownerDocument.createElement('h3');
              title.setAttribute('style', 'font-weight:700;margin:0 0 6px 0;font-size:1.05em;');
              title.textContent = `Chat export (${kind.toUpperCase()})`;
              outer.appendChild(title);

              const box = tmp.ownerDocument.createElement('div');
              box.className = 'acep-chat-export';
              box.setAttribute('style', 'border:1px solid #e5e7eb;border-radius:10px;padding:10px 12px;background:#fafafa;');
              outer.appendChild(box);

              if (info && info.ok && (kind === 'txt' || kind === 'html') && typeof info.text === 'string' && info.text.trim()) {
                const pre = tmp.ownerDocument.createElement('pre');
                pre.setAttribute('style', 'white-space:pre-wrap;word-break:break-word;background:#fff;border:1px solid #eee;border-radius:8px;padding:10px;margin:0;');
                pre.textContent = info.text;
                box.appendChild(pre);
              } else if (url) {
                const p = tmp.ownerDocument.createElement('p');
                p.setAttribute('style', 'color:#555;margin:0;');
                const a = tmp.ownerDocument.createElement('a');
                a.setAttribute('href', url);
                a.setAttribute('target', '_blank');
                a.setAttribute('rel', 'noopener');
                a.textContent = 'Download';
                p.appendChild(tmp.ownerDocument.createTextNode('[Attachment]: '));
                p.appendChild(a);
                box.appendChild(p);
              } else {
                const p = tmp.ownerDocument.createElement('div');
                p.setAttribute('style', 'color:#777;');
                p.textContent = '[Attachment]: Chat export (unavailable)';
                box.appendChild(p);
              }
              cell.replaceWith(outer);
            } catch {}
          });
        } catch {}

        const favs = Array.from(tmp.querySelectorAll('img[alt="favicon" i], img[src*="s2/favicons" i], img[src*="favicon" i]'));
        favs.forEach(img => {
          try { img.remove(); } catch {}
        });
        Array.from(tmp.querySelectorAll('.text-text-300, [class*="text-text-300" i]')).forEach(el => {
          const t = (el.textContent || '').trim();
          if (/^Done$/i.test(t)) { try { el.remove(); } catch {} }
        });
        Array.from(tmp.querySelectorAll('div')).forEach(el => {
          try {
            if (el.querySelector('.standard-markdown, .progressive-markdown')) return;
            const hasImg = !!el.querySelector('img, svg');
            const txt = (el.textContent || '').trim();
            if (!txt && hasImg) { el.remove(); return; }
            if (!txt && !hasImg && el.children.length === 0) { el.remove(); return; }
          } catch {}
        });
        return tmp.innerHTML || html;
      } catch {}
      return html;
    }

    // Export API
    g.ACEP.providers.claude.normalizeClaudeTitle = normalizeClaudeTitle;
    g.ACEP.providers.claude.getClaudeChatIdFromUrl = getClaudeChatIdFromUrl;
    g.ACEP.providers.claude.getClaudeOrgId = getClaudeOrgId;
    g.ACEP.providers.claude.getClaudeOrgIdAsync = getClaudeOrgIdAsync;
    g.ACEP.providers.claude.pruneClaudeMessagesToLeaf = pruneClaudeMessagesToLeaf;
    g.ACEP.providers.claude.parseClaudeArtifactsFromMessages = parseClaudeArtifactsFromMessages;
    g.ACEP.providers.claude.loadClaudeArtifactsFromApi = loadClaudeArtifactsFromApi;
    g.ACEP.providers.claude.loadClaudeChatExportFilesFromApi = loadClaudeChatExportFilesFromApi;
    g.ACEP.providers.claude.applyClaudeArtifactsToDom = applyClaudeArtifactsToDom;
    g.ACEP.providers.claude.findClaudeArtifactInDomByTitle = findClaudeArtifactInDomByTitle;
    g.ACEP.providers.claude.injectClaudeArtifactsIntoClone = injectClaudeArtifactsIntoClone;
    g.ACEP.providers.claude.cleanClaudeToolBlocks = cleanClaudeToolBlocks;

  } catch (err) {
    console.error('Error initializing Claude artifacts module:', err);
  }
})();
