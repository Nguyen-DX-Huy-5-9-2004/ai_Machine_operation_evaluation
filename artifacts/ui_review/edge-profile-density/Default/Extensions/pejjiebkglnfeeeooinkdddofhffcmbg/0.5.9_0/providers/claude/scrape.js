// Claude provider logic (content script side).
// This file should contain ONLY Claude-specific DOM logic.
(function initClaudeProvider() {
  try {
    const g = (typeof globalThis !== 'undefined') ? globalThis : window;
    if (!/(^|\.)claude\.ai$/i.test(String(location?.hostname || ''))) return;
    if (!g.ACEP) g.ACEP = {};
    if (!g.ACEP.providers) g.ACEP.providers = {};
    g.ACEP.providers.claude = g.ACEP.providers.claude || {};
    const CLAUDE_PROVIDER_REV = '2026-06-18-claude-api-pasted-only';
    if (g.ACEP.providers.claude.__providerRev !== CLAUDE_PROVIDER_REV) {
      try {
        delete g.ACEP.providers.claude.__apiTurnNodes;
        delete g.ACEP.providers.claude.__apiChatId;
        delete g.ACEP.providers.claude.__apiTs;
      } catch {}
      g.ACEP.providers.claude.__providerRev = CLAUDE_PROVIDER_REV;
    }

    const env = g.ACEP.env || {};
    const sel = (g.ACEP.providers.claude && g.ACEP.providers.claude.sel) || {};
    const getThreadContainer = (g.ACEP.providers.claude && g.ACEP.providers.claude.getThreadContainer) || (() => (document.querySelector('main') || document.body));

    function debugStore(name, value) {
      try {
        g.ACEP.providers.claude.__debug = g.ACEP.providers.claude.__debug || {};
        g.ACEP.providers.claude.__debug[name] = value;
      } catch {}
      try {
        const slugBase = String(name || '').toLowerCase().replace(/[^a-z0-9_-]+/g, '-');
        const k1 = `data-acep-claude-${slugBase}`;
        const k2 = `data-acep-claude-${slugBase.replace(/_/g, '-')}`; // convenience for console lookups
        const v = (typeof value === 'string') ? value : JSON.stringify(value);
        if (typeof v === 'string' && v.length <= 800) {
          document.documentElement.setAttribute(k1, v);
          if (k2 !== k1) document.documentElement.setAttribute(k2, v);
        }
      } catch {}
    }

    function debugClaudePastedApiMessage(msg = {}, meta = {}) {
      try {
        const requested = String(document.documentElement.getAttribute('data-acep-claude-debug-id') || '').trim();
        const turnId = String(meta?.turnId || msg?.uuid || '').trim();
        const shouldEmit =
          requested === 'first-pasted' ||
          (requested && turnId && requested === turnId) ||
          (!requested && meta?.isFirstPasted);
        if (!shouldEmit) return;

        const files = Array.isArray(msg?.files) ? msg.files : [];
        const content = Array.isArray(msg?.content) ? msg.content : [];
        const out = {
          turnId,
          sender: String(msg?.sender || msg?.role || ''),
          contentTypes: content.map((p) => String(p?.type || '')).slice(0, 20),
          textPartLens: content.filter((p) => p?.type === 'text' && p?.text).map((p) => String(p.text || '').length).slice(0, 20),
          contentParts: content.slice(0, 10).map((p) => ({
            type: String(p?.type || ''),
            keys: Object.keys(p || {}).slice(0, 30),
            text_len: String(p?.text || '').length,
            extracted_content_len: String(p?.extracted_content || '').length,
            content_len: String(p?.content || '').length,
            value_len: String(p?.value || '').length,
            preview: String(p?.text || p?.extracted_content || p?.content || p?.value || '').slice(0, 160),
          })),
          files: files.slice(0, 10).map((f) => ({
            file_kind: String(f?.file_kind || ''),
            file_type: String(f?.file_type || ''),
            file_name: String(f?.file_name || ''),
            file_uuid: String(f?.file_uuid || ''),
            preview_url: String(f?.preview_url || ''),
            thumbnail_url: String(f?.thumbnail_url || ''),
            extracted_content_len: String(f?.extracted_content || '').length,
            text_len: String(f?.text || '').length,
            content_len: String(f?.content || '').length,
            snippet: String(f?.extracted_content || f?.text || f?.content || '').slice(0, 160),
            keys: Object.keys(f || {}).slice(0, 40),
          })),
          msgKeys: Object.keys(msg || {}).slice(0, 60),
          attachmentish: {
            attachments_len: Array.isArray(msg?.attachments) ? msg.attachments.length : 0,
            files_len: files.length,
            files_v2_len: Array.isArray(msg?.files_v2) ? msg.files_v2.length : 0,
            uploaded_files_len: Array.isArray(msg?.uploaded_files) ? msg.uploaded_files.length : 0,
          },
        };
        const summary = {
          turnId,
          sender: out.sender,
          contentTypes: out.contentTypes,
          textPartLens: out.textPartLens,
          files: out.files.map((f) => ({
            file_kind: f.file_kind,
            file_type: f.file_type,
            file_name: f.file_name,
            extracted_content_len: f.extracted_content_len,
            text_len: f.text_len,
            content_len: f.content_len,
            snippet: f.snippet,
          })),
          contentParts: out.contentParts.map((p) => ({
            type: p.type,
            text_len: p.text_len,
            extracted_content_len: p.extracted_content_len,
            content_len: p.content_len,
            value_len: p.value_len,
            preview: p.preview,
          })),
          attachmentish: out.attachmentish,
        };
        debugStore('pasted_api_shape', out);
        debugStore('pasted_api_shape_summary', summary);
        try { g.ACEP.providers.claude.__debug = g.ACEP.providers.claude.__debug || {}; g.ACEP.providers.claude.__debug.pastedApiShape = out; } catch {}
      } catch {}
    }

    function emitClaudeExportProgress(message = '', done = false) {
      try {
        window.postMessage({ type: 'ACEP_MUTED_EXPORT_PROGRESS', message: String(message || ''), done: !!done }, '*');
      } catch {}
    }

    function getClaudeThumbPreviewText(root) {
      try {
        const previewNode = root?.querySelector?.('p.break-all, p[class*="break-all" i], p[class*="line-clamp" i]');
        return String(previewNode?.textContent || '').trim();
      } catch {
        return '';
      }
    }

    function isClaudePastedThumbRoot(root) {
      try {
        if (!root) return false;
        const previewText = getClaudeThumbPreviewText(root);
        const looksLikeImageThumb = !!root.querySelector?.('img');
        const looksLikePastedText =
          /\bpasted\b/i.test(String(root.innerText || root.textContent || '')) ||
          (previewText.length >= 60 && /[a-z0-9]/i.test(previewText));
        if (looksLikeImageThumb && !looksLikePastedText) return false;
        return looksLikePastedText;
      } catch {
        return false;
      }
    }

    function getClaudePastedThumbRoots(opts = {}) {
      try {
        const onlyUncaptured = opts?.onlyUncaptured !== false;
        const thumbSel = sel.thumbRoot || '[data-testid="file-thumbnail"], .group\\/thumbnail, [class*="group/thumbnail" i]';
        const ratingSel = sel.ratingDialogAny || '#ratingDialog,[id="ratingDialog"]';
        return Array.from(document.querySelectorAll(thumbSel)).filter((thumb) => {
          try {
            const root = thumb.closest(thumbSel);
            if (!root) return false;
            if (root.closest && root.closest(ratingSel)) return false;
            if (onlyUncaptured && root?.dataset?.acepFull) return false;
            return isClaudePastedThumbRoot(root);
          } catch {
            return false;
          }
        });
      } catch {
        return [];
      }
    }

    function getArtifactNodes() {
      try {
        if (!env.isClaude || !env.isClaude()) return [];
        const btnSel = sel.artifactButton || '[role="button"][aria-label="Preview contents"]';
        const nodes = Array.from(document.querySelectorAll(btnSel));
        const seen = new Set();
        const out = [];
        nodes.forEach((n) => {
          const root = n.closest(btnSel) || n;
          if (!root || seen.has(root)) return;
          seen.add(root);
          out.push(root);
        });
        return out;
      } catch {
        return [];
      }
    }

    function extractSelectableTurnNodes() {
      try {
        if (!env.isClaude || !env.isClaude()) return [];
        const container = getThreadContainer();
        if (!container) return [];

        const artifactSel = sel.artifactButton || '[role="button"][aria-label="Preview contents"]';
        const userSel = sel.userMessage || '[data-testid="user-message"]';
        const asstSel = sel.asstMessage || '.font-claude-response, .standard-markdown, .progressive-markdown';
        const thumbSel = sel.thumbRoot || '[data-testid="file-thumbnail"], .group\\/thumbnail, [class*="group/thumbnail" i]';
        const turnRootSel = sel.turnRootAny || 'div.mb-1.mt-6.group, div[data-test-render-count]';

        // Strategy:
        // 1) Scan candidate "turn roots" within the thread container.
        // 2) Classify each candidate as user/assistant ONLY if it contains exactly one side (user OR assistant),
        //    and optionally thumbnails for user turns.
        // This prevents selecting an overly-broad wrapper that contains both a user prompt and the next assistant reply,
        // which caused "junk" first turns and image/text mis-assignment.
        const candidates = Array.from(container.querySelectorAll(turnRootSel));
        const classified = [];

        const depthOf = (n) => {
          let d = 0;
          let cur = n;
          while (cur && cur !== container && cur.parentElement) {
            d++;
            cur = cur.parentElement;
          }
          return d;
        };

        for (const root of candidates) {
          try {
            if (!root || !root.querySelector) continue;
            // Avoid selecting artifact "preview contents" button containers as turns.
            if (root.matches?.(artifactSel) || root.querySelector?.(artifactSel)) {
              // Still allow assistant/user containers that may contain the button; we'll classify by user/asst markers.
            }

            const hasUser = !!root.querySelector(userSel);
            const hasAsst = !!root.querySelector(asstSel);
            const hasThumb = !!root.querySelector(thumbSel);

            // Too broad: contains both sides.
            if (hasUser && hasAsst) continue;

            let role = '';
            if (hasAsst) role = 'assistant';
            else if (hasUser || hasThumb) role = 'user'; // image-only user prompt: thumbs but no user text
            else continue;

            classified.push({ root, role, depth: depthOf(root) });
          } catch {}
        }

        // Prefer the smallest (deepest) wrappers; drop ancestors of already-selected nodes.
        classified.sort((a, b) => b.depth - a.depth);
        const picked = [];
        for (const item of classified) {
          if (picked.some((p) => item.root.contains(p.root))) continue;
          picked.push(item);
        }

        // Sort by document order for export.
        picked.sort((a, b) => {
          if (a.root === b.root) return 0;
          const pos = a.root.compareDocumentPosition(b.root);
          if (pos & Node.DOCUMENT_POSITION_FOLLOWING) return -1;
          if (pos & Node.DOCUMENT_POSITION_PRECEDING) return 1;
          return 0;
        });

        const out = [];
        let seq = 0;
        for (const e of picked) {
          const idxAttr = String(seq++);
          try {
            e.root.setAttribute('data-acep-role', e.role);
            e.root.setAttribute('data-acep-top-idx', idxAttr);
          } catch {}
          out.push(e.root);
        }

        try {
          const existingUserRoots = out.filter((n) => String(n?.getAttribute?.('data-acep-role') || '') === 'user');
          const orphanThumbs = Array.from(container.querySelectorAll(thumbSel)).filter((thumb) => {
            try {
              if (!isClaudePastedThumbRoot(thumb)) return false;
              return !existingUserRoots.some((root) => root === thumb || root.contains?.(thumb));
            } catch {
              return false;
            }
          });
          for (const thumb of orphanThumbs) {
            try {
              const idxAttr = String(seq++);
              thumb.setAttribute('data-acep-role', 'user');
              thumb.setAttribute('data-acep-top-idx', idxAttr);
              out.push(thumb);
            } catch {}
          }
          out.sort((a, b) => {
            if (a === b) return 0;
            const pos = a.compareDocumentPosition(b);
            if (pos & Node.DOCUMENT_POSITION_FOLLOWING) return -1;
            if (pos & Node.DOCUMENT_POSITION_PRECEDING) return 1;
            return 0;
          });
        } catch {}

        try {
          debugStore('turn_nodes', {
            ok: true,
            count: out.length,
            sample: out.slice(0, 8).map((n) => ({
              role: n.getAttribute('data-acep-role') || '',
              top: n.getAttribute('data-acep-top-idx') || '',
              hasImg: !!n.querySelector?.('img'),
              hasThumb: !!n.querySelector?.(thumbSel),
              hasUserMsg: !!n.querySelector?.(userSel),
              hasAsst: !!n.querySelector?.(asstSel),
            })),
          });
        } catch {}

        return out;
      } catch {
        return [];
      }
    }

    async function waitForValue(fn, timeoutMs = 1500, intervalMs = 80) {
      const start = Date.now();
      while (Date.now() - start < timeoutMs) {
        try {
          const v = fn();
          if (v) return v;
        } catch {}
        await new Promise(r => setTimeout(r, intervalMs));
      }
      return '';
    }

    // Claude pasted thumbnails are intentionally not opened/captured.
    // Export keeps the turn and writes `{Pasted Content}` instead of the pasted body.
    async function captureThumbFullContent(opts = {}) {
      return { ok: true, skipped: true, reason: 'pasted-content-placeholder-mode' };
      try {
        if (!env.isClaude || !env.isClaude()) return { ok: false, reason: 'not-claude' };
        const maxCapture = Math.max(0, parseInt(opts?.maxCapture, 10) || 0);
        const emitProgress = opts?.emitProgress !== false;
        const thumbSel = sel.thumbRoot || '[data-testid="file-thumbnail"], .group\\/thumbnail, [class*="group/thumbnail" i]';
        const ratingSel = sel.ratingDialogAny || '#ratingDialog,[id="ratingDialog"]';
        // Prefer Claude's real side-panel/dialog containers. Avoid overly-broad selectors because our extension
        // also injects a page-level modal (`#ratingDialog`) which can be mistakenly captured.
        const panelSel = '[data-testid*="side-panel"], .side-panel, [role="dialog"], [aria-modal="true"]';

        const thumbs = getClaudePastedThumbRoots({ onlyUncaptured: true });
        const totalTarget = maxCapture > 0 ? Math.min(maxCapture, thumbs.length) : thumbs.length;
        let captured = 0;
        if (emitProgress && totalTarget > 0) {
          emitClaudeExportProgress(`Preparing Claude pasted content... (0/${totalTarget})`);
        }

        for (const thumb of thumbs) {
          try {
            const root = thumb.closest(thumbSel);
            if (!root) continue;
            if (root.closest && root.closest(ratingSel)) continue;
            if (root?.dataset?.acepFull) continue;

            const previewNode = root.querySelector('p.break-all, p[class*="break-all" i], p[class*="line-clamp" i]');
            const previewText = (previewNode?.textContent || '').trim();
            const previewNorm = previewText.replace(/\s+/g, ' ').trim().toLowerCase();

            const clickTarget = root.querySelector('button') || root;
            const baselinePanels = new Set();
            try { document.querySelectorAll(panelSel).forEach(p => baselinePanels.add(p)); } catch {}
            const dlg = document.getElementById('ratingDialog');
            const prevDisplay = dlg ? dlg.style.display : '';
            if (dlg) {
              try { dlg.style.display = 'none'; } catch {}
            }
            try {
              const events = [
                new PointerEvent('pointerdown', { bubbles: true, cancelable: true, pointerType: 'mouse' }),
                new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window }),
                new PointerEvent('pointerup', { bubbles: true, cancelable: true, pointerType: 'mouse' }),
                new MouseEvent('mouseup', { bubbles: true, cancelable: true, view: window }),
                new MouseEvent('click', { bubbles: true, cancelable: true, view: window }),
              ];
              events.forEach(ev => { try { clickTarget.dispatchEvent(ev); } catch {} });
            } catch {}

            await new Promise(r => setTimeout(r, 120));
            let pickedPanel = null;
            const full = await waitForValue(() => {
              const panels = Array.from(document.querySelectorAll(panelSel || '')).filter(Boolean);
              const isExcluded = (p) => {
                try {
                  if (!p) return true;
                  // Extension success modal (injected into the page) must never be captured.
                  if (p.id === 'ratingDialog' || p.matches?.(ratingSel) || p.querySelector?.(ratingSel)) return true;
                  if (p.id === 'acep-support-overlay' || p.querySelector?.('#acep-support-overlay')) return true;
                  return false;
                } catch {
                  return true;
                }
              };
              const cleanPanels = panels.filter(p => !isExcluded(p));

              const scorePanel = (p) => {
                try {
                  const t = (p.innerText || p.textContent || '');
                  const norm = t.replace(/\s+/g, ' ').trim().toLowerCase();
                  const hasPreview = !!(previewNorm && norm.includes(previewNorm));
                  const hasFullNode = !!(p.querySelector && p.querySelector('div.whitespace-pre-wrap.break-all, pre, textarea'));
                  const base = t.length;
                  return (hasPreview ? 1_000_000 : 0) + (hasFullNode ? 100_000 : 0) + base;
                } catch {
                  return 0;
                }
              };

              // Prefer "new" panels created by clicking the thumbnail.
              const newPanels = cleanPanels.filter(p => !baselinePanels.has(p));
              const candidates = (newPanels.length ? newPanels : cleanPanels).slice();
              const panel = candidates.sort((a, b) => scorePanel(b) - scorePanel(a))[0] || null;

              // Primary: find the actual full-text node globally (Claude often renders it outside the immediate panel container).
              const isExcludedNode = (n) => {
                try {
                  if (!n) return true;
                  if (n.closest && (n.closest(ratingSel) || n.closest('#ratingDialog') || n.closest('#acep-support-overlay'))) return true;
                  return false;
                } catch {
                  return true;
                }
              };
              const fullNodes = Array.from(document.querySelectorAll('div.whitespace-pre-wrap.break-all.text-xs, div.whitespace-pre-wrap.break-all'))
                .filter(n => !isExcludedNode(n));
              const minLen = Math.max(120, previewText.length + 40);
              const bestNode = fullNodes
                .map((n) => {
                  const t = (n.textContent || '').trim();
                  const norm = t.replace(/\s+/g, ' ').trim().toLowerCase();
                  const hasPreview = !!(previewNorm && norm.includes(previewNorm));
                  const score = (hasPreview ? 1_000_000 : 0) + t.length;
                  return { n, t, hasPreview, score };
                })
                .filter(x => x.t && (x.hasPreview || x.t.length > minLen))
                .sort((a, b) => b.score - a.score)[0];

              // Fallback: use the best panel candidate.
              const panelForText = panel;
              if (panelForText) pickedPanel = panelForText;
              const fullTextNode = bestNode?.n || panelForText?.querySelector?.('div.whitespace-pre-wrap.break-all.text-xs, div.whitespace-pre-wrap.break-all') || null;
              const pre = panelForText?.querySelector?.('pre, code, textarea') || null;
              const txt = (bestNode?.t || fullTextNode?.textContent || pre?.textContent || panelForText?.textContent || '').trim();
              if (!txt) return '';
              const txtNorm = txt.replace(/\s+/g, ' ').trim().toLowerCase();
              if (previewNorm && txtNorm.includes(previewNorm)) return txt;
              return txt.length > minLen ? txt : '';
            }, 4000, 120);

            let shouldStop = false;
            if (full && root?.dataset) {
              root.dataset.acepFull = full;
              try { root.setAttribute('data-acep-full', full); } catch {}
              captured++;
              try { debugStore('thumb_capture_progress', { captured, maxCapture: maxCapture || null }); } catch {}
              if (emitProgress && totalTarget > 0) {
                emitClaudeExportProgress(`Preparing Claude pasted content... (${Math.min(captured, totalTarget)}/${totalTarget})`);
              }
              if (maxCapture > 0 && captured >= maxCapture) shouldStop = true;
            } else {
              try {
                debugStore('thumb_capture_last', {
                  ok: false,
                  previewLen: previewText.length,
                  previewStart: previewText.slice(0, 80),
                });
              } catch {}
            }

            try {
              const close = pickedPanel?.querySelector?.('[aria-label="Close"], [data-testid*="close" i]') || document.querySelector('[aria-label="Close"], [data-testid*="close" i]');
              if (close) close.click();
              else document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
            } catch {}
            await new Promise(r => setTimeout(r, 120));

            if (dlg) {
              try { dlg.style.display = prevDisplay || ''; } catch {}
            }
            if (shouldStop) break;
          } catch {}
        }

        let dtCount = 0;
        let classCount = 0;
        try {
          dtCount = document.querySelectorAll('[data-testid="file-thumbnail"]').length;
          classCount = document.querySelectorAll('[class*="group/thumbnail" i], .group\\/thumbnail').length;
        } catch {}
        if (emitProgress && totalTarget > 0) {
          emitClaudeExportProgress(`Preparing Claude pasted content... (${Math.min(captured, totalTarget)}/${totalTarget})`);
        }
        return { ok: true, thumbCount: thumbs.length, dtCount, classCount, captured };
      } catch (e) {
        return { ok: false, error: String(e?.message || e) };
      }
    }

    function findReactCarrier(node) {
      try {
        if (!node) return null;
        const k = Object.keys(node).find(x => x.startsWith('__reactFiber$') || x.startsWith('__reactProps$'));
        return k ? node[k] : null;
      } catch {
        return null;
      }
    }
    function collectFiberPropRoots(fiber, maxHops = 10) {
      const out = [];
      try {
        let cur = fiber;
        let hops = 0;
        while (cur && hops < maxHops) {
          try {
            if (cur.memoizedProps) out.push(cur.memoizedProps);
            if (cur.pendingProps) out.push(cur.pendingProps);
            if (cur.memoizedState) out.push(cur.memoizedState);
          } catch {}
          cur = cur.return;
          hops++;
        }
      } catch {}
      return out;
    }
    function collectFiberNeighborhoodRoots(fiber, maxNodes = 120) {
      const out = [];
      try {
        const seen = new Set();
        const q = [];
        const push = (n) => { if (n && typeof n === 'object' && !seen.has(n)) { seen.add(n); q.push(n); } };
        push(fiber);
        push(fiber?.alternate);
        while (q.length && seen.size < maxNodes) {
          const n = q.shift();
          if (!n) continue;
          try {
            if (n.memoizedProps) out.push(n.memoizedProps);
            if (n.pendingProps) out.push(n.pendingProps);
            if (n.memoizedState) out.push(n.memoizedState);
            if (n.stateNode && typeof n.stateNode === 'object') out.push(n.stateNode);
          } catch {}
          // Explore nearby fibers: return chain, child tree, siblings, alternates
          push(n.return);
          push(n.child);
          push(n.sibling);
          push(n.alternate);
          // Some React builds store children in `dependencies` / `memoizedState` graphs too; we already include memoizedState above.
        }
      } catch {}
      return out;
    }
    function deepFindFirstString(obj, predicate, maxDepth = 6) {
      const seen = new Set();
      const stack = [{ v: obj, d: 0 }];
      while (stack.length) {
        const { v, d } = stack.pop();
        if (v == null) continue;
        if (typeof v === 'string') {
          try { if (predicate(v)) return v; } catch {}
          continue;
        }
        if (typeof v !== 'object') continue;
        if (seen.has(v)) continue;
        seen.add(v);
        if (d >= maxDepth) continue;
        if (Array.isArray(v)) {
          for (let i = v.length - 1; i >= 0; i--) stack.push({ v: v[i], d: d + 1 });
          continue;
        }
        try {
          const keys = Object.keys(v);
          for (let i = keys.length - 1; i >= 0; i--) {
            const key = keys[i];
            if (!key) continue;
            stack.push({ v: v[key], d: d + 1 });
          }
        } catch {}
      }
      return '';
    }
    function pickFirstNonEmpty(...vals) {
      for (const v of vals) {
        const s = String(v || '').trim();
        if (s) return s;
      }
      return '';
    }
    function extractDownloadUrlOrPathFromProps(propsRoots = []) {
      const roots = Array.isArray(propsRoots) ? propsRoots.filter(Boolean) : [];
      const wantDownloadUrl = (s) => /\/wiggle\/download-file\b/i.test(String(s || ''));
      const wantOutputsPath = (s) => {
        const x = String(s || '');
        // Claude often encodes file paths as `%2Foutputs%2F...` in query strings.
        return /\/mnt\/user-data\/outputs\//i.test(x)
          || /^\/outputs\//i.test(x)
          || /\/outputs\//i.test(x)
          || /file_path=\/outputs\//i.test(x)
          || /file_path=%2Foutputs%2F/i.test(x)
          || /%2Foutputs%2F/i.test(x);
      };

      // 1) Direct download URL (best)
      for (const r of roots) {
        const dl = deepFindFirstString(r, wantDownloadUrl, 8);
        if (dl) return { downloadUrl: dl, path: '' };
      }

      // 2) Path-like strings
      for (const r of roots) {
        const p = deepFindFirstString(r, wantOutputsPath, 8);
        if (p) return { downloadUrl: '', path: p };
      }

      return { downloadUrl: '', path: '' };
    }
    function normalizeClaudeDownloadUrl(u = '') {
      const s = String(u || '').trim();
      if (!s) return '';
      if (/^https?:\/\//i.test(s)) return s;
      if (s.startsWith('/api/')) return `https://claude.ai${s}`;
      return s;
    }
    function normalizeOutputsPathString(s = '') {
      const raw = String(s || '').trim();
      if (!raw) return '';
      // If it's a URL/query string containing file_path=/outputs/...
      try {
        if (/^https?:\/\//i.test(raw) || raw.startsWith('/api/')) {
          const base = raw.startsWith('/api/') ? `https://claude.ai${raw}` : raw;
          const u = new URL(base);
          const fp = u.searchParams.get('file_path') || '';
          if (fp && /^\/outputs\//i.test(fp)) return fp;
        }
      } catch {}
      // If the string itself contains file_path=/outputs/...
      try {
        const m = raw.match(/file_path=([^&\s]+)/i);
        if (m && m[1]) {
          const decoded = decodeURIComponent(m[1]);
          if (decoded && /^\/outputs\//i.test(decoded)) return decoded;
        }
      } catch {}
      return raw;
    }

    function discoverOutputFilePathsFromPerformance() {
      try {
        if (!performance || typeof performance.getEntriesByType !== 'function') return [];
        const entries = performance.getEntriesByType('resource') || [];
        const out = [];
        const seen = new Set();
        for (const e of entries) {
          const name = e && e.name ? String(e.name) : '';
          if (!name) continue;
          if (!/\/api\/organizations\/[a-f0-9-]{8,}\//i.test(name)) continue;
          if (!/file_path=/i.test(name) && !/%2Foutputs%2F/i.test(name) && !/\/outputs\//i.test(name)) continue;
          let fp = '';
          try {
            const u = new URL(name);
            fp = u.searchParams.get('file_path') || '';
            if (!fp) {
              // Some endpoints include file_path inside a nested query string or as an encoded substring.
              const m = name.match(/file_path=([^&\s]+)/i);
              if (m && m[1]) fp = decodeURIComponent(m[1]);
            }
          } catch {}
          fp = normalizeOutputsPathString(fp || name);
          if (!fp || !/^\/outputs\//i.test(fp)) continue;
          const key = fp.toLowerCase();
          if (seen.has(key)) continue;
          seen.add(key);
          out.push({ filePath: fp, startTime: Number(e.startTime) || 0, name });
        }
        out.sort((a, b) => (b.startTime || 0) - (a.startTime || 0));
        return out;
      } catch {
        return [];
      }
    }

    function inferCardKind(cardText = '') {
      const t = String(cardText || '').toUpperCase();
      if (/\bDOCX\b/.test(t) || /DOCUMENT\s*Ã‚Â·\s*DOCX/.test(t)) return 'docx';
      if (/\bHTML\b/.test(t) || /CODE\s*Ã‚Â·\s*HTML/.test(t)) return 'html';
      if (/\bPDF\b/.test(t)) return 'pdf';
      if (/\bTXT\b/.test(t)) return 'txt';
      return '';
    }

    function decodeURIComponentSafe(s = '') {
      try { return decodeURIComponent(String(s || '')); } catch { return String(s || ''); }
    }
    function extractOutputsFilePathFromPanel(panel) {
      try {
        if (!panel) return '';
        const html = String(panel.innerHTML || '');
        const text = String(panel.textContent || '');
        const hay = `${html}\n${text}`;
        // Prefer explicit file_path params (encoded or decoded)
        let m = hay.match(/file_path=([^&\s"'<>]+)/i);
        if (m && m[1]) {
          const fp = decodeURIComponentSafe(m[1]);
          if (/^\/outputs\//i.test(fp)) return fp;
        }
        m = hay.match(/file_path=%2Foutputs%2F([^&\s"'<>]+)/i);
        if (m && m[1]) return `/outputs/${decodeURIComponentSafe(m[1])}`;
        // Direct /outputs/... occurrence
        m = hay.match(/(\/outputs\/[^?\s"'<>]+?\.(html|docx|pdf|txt))/i);
        if (m && m[1]) return m[1];
        return '';
      } catch {
        return '';
      }
    }

    function requestClaudeArtifactInfoFromMainWorld(idx, timeoutMs = 500) {
      return new Promise((resolve) => {
        try {
          const requestId = `acep-${Date.now()}-${Math.random().toString(16).slice(2)}`;
          const timer = setTimeout(() => {
            try { window.removeEventListener('message', onMessage); } catch {}
            resolve(null);
          }, timeoutMs);
          const onMessage = (event) => {
            try {
              if (event.source !== window || event.origin !== location.origin) return;
              const data = event.data || {};
              if (!data || data.type !== 'ACEP_RSP_CLAUDE_ARTIFACT_INFO' || data.requestId !== requestId) return;
              clearTimeout(timer);
              try { window.removeEventListener('message', onMessage); } catch {}
              resolve(data.atftInfo && typeof data.atftInfo === 'object' ? data.atftInfo : null);
            } catch {}
          };
          window.addEventListener('message', onMessage);
          window.postMessage({ type: 'ACEP_REQ_CLAUDE_ARTIFACT_INFO', requestId, idx }, location.origin);
        } catch {
          resolve(null);
        }
      });
    }
    async function captureGeneratedFileCardsAsLinks() {
      try {
        if (!env.isClaude || !env.isClaude()) return { ok: false, reason: 'not-claude' };

        // Filename-card preservation must not depend on hook install, org/chat IDs, preview clicks, or URL resolution.
        // Download links are deferred; keep the visible Claude card/title in the export first.
        try {
          const debugGeneratedFiles = { at: new Date().toISOString(), stage: 'visible_preserve', visible: 0, preserved: 0, skipped: [] };
          const visibleCards = Array.from(new Set([
            ...Array.from(document.querySelectorAll('.artifact-block-cell, [class*="group/artifact-block" i]'))
          ]));
          debugGeneratedFiles.visible = visibleCards.length;
          let preserved = 0;
          for (const card of visibleCards) {
            try {
              if (card?.dataset?.acepGeneratedFileLinked === '1') continue;
              const preservedCard = buildClaudeGeneratedFileCardFromCell(card);
              if (!preservedCard) {
                if (debugGeneratedFiles.skipped.length < 5) debugGeneratedFiles.skipped.push(String(card.innerText || card.textContent || '').replace(/\\s+/g, ' ').trim().slice(0, 160));
                continue;
              }
              const wrapper = card.closest('[class*="group/artifact-block" i], [role="button"][aria-label*="Preview" i]') || card;
              try { wrapper.replaceWith(preservedCard); } catch { card.replaceWith(preservedCard); }
              try { card.dataset.acepGeneratedFileLinked = '1'; } catch {}
              try { if (wrapper?.dataset) wrapper.dataset.acepGeneratedFileLinked = '1'; } catch {}
              preserved++;
            } catch (e) {
              if (debugGeneratedFiles.skipped.length < 5) debugGeneratedFiles.skipped.push(`error: ${String(e?.message || e).slice(0, 120)}`);
            }
          }
          debugGeneratedFiles.preserved = preserved;
          try { document.documentElement.setAttribute('data-acep-claude-generated-file-scan', JSON.stringify(debugGeneratedFiles).slice(0, 2000)); } catch {}
          try { chrome?.storage?.local?.set?.({ acep_last_claude_generated_file_scan: debugGeneratedFiles }); } catch {}
          if (preserved) return { ok: true, found: visibleCards.length, linked: preserved, filenameOnly: true };
        } catch (e) {
          try { document.documentElement.setAttribute('data-acep-claude-generated-file-scan', JSON.stringify({ at: new Date().toISOString(), stage: 'visible_preserve_error', error: String(e?.message || e) }).slice(0, 2000)); } catch {}
          try { chrome?.storage?.local?.set?.({ acep_last_claude_generated_file_scan: { at: new Date().toISOString(), stage: 'visible_preserve_error', error: String(e?.message || e) } }); } catch {}
        }


        // Install a MAIN-world hook (via background) that captures `file_path=/outputs/...`
        // from the Preview panel requests. This avoids hardcoding any filenames/paths.
        try {
          const api = (typeof globalThis !== 'undefined' && globalThis.browser) ? globalThis.browser : (globalThis.chrome || null);
          const send = api?.runtime?.sendMessage?.bind(api.runtime);
          if (send) {
            await new Promise((resolve) => {
              try {
                send({ type: 'ACEP_INSTALL_CLAUDE_GENFILE_HOOK' }, (resp) => resolve(resp || null));
              } catch {
                resolve(null);
              }
            });
          }
        } catch {}

        const container = getThreadContainer();
        const cards = Array.from(new Set([
          ...Array.from((container || document).querySelectorAll('.artifact-block-cell, [class*="group/artifact-block" i]')),
          ...Array.from(document.querySelectorAll('.artifact-block-cell, [class*="group/artifact-block" i]'))
        ]));
        const candidates = cards.map((el, idx) => ({ el, idx })).filter(({ el }) => {
          try {
            const wrapper = el.closest('[class*="group/artifact-block" i], [role="button"][aria-label*="Preview" i]') || el;
            const text = String(el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim();
            const title = String(el.querySelector?.('.leading-tight')?.textContent || '').replace(/\s+/g, ' ').trim();
            const actionLabel = String(wrapper.getAttribute?.('aria-label') || '') + ' ' + String(wrapper.querySelector?.('button[aria-label*="Download" i], button[aria-label^="View " i], button[aria-label*="Open" i]')?.getAttribute?.('aria-label') || '');
            const hasFileType = /\b(DOCX|HTML|TXT|PDF)\b/i.test(text);
            const hasFileAction = /\b(download|view|open)\b/i.test(`${text} ${actionLabel}`);
            const hasExplicitGeneratedFileType = hasFileType || /\b(Document|Code)\s*[^A-Za-z0-9]*\s*\b(DOCX|HTML|TXT|PDF)\b/i.test(text);
            return !!text && hasExplicitGeneratedFileType && (hasFileAction || !!title);
          } catch { return false; }
        });
        if (!candidates.length) return { ok: true, found: 0, linked: 0 };

        const orgId = await getOrgIdAsync(1200);
        const chatId = getChatIdFromUrl();

        let linked = 0;
        const samples = [];
        for (const candidate of candidates) {
          const card = candidate?.el || candidate;
          const cardIndex = Number.isFinite(candidate?.idx) ? candidate.idx : cards.indexOf(card);
          try {
            if (card?.dataset?.acepGeneratedFileLinked === '1') continue;

            // Try multiple carriers: block cell, artifact wrapper, view/open button, and download button itself.
            const wrapper = card.closest('[class*="group/artifact-block" i], [role="button"][aria-label*="Preview" i]') || card;
            const viewBtn = wrapper.querySelector('button[aria-label^="View " i], button[aria-label*="View" i], button[aria-label*="Open" i]') || null;
            const dlBtn = wrapper.querySelector('button[aria-label="Download"], button[aria-label*="Download" i], button') || null;
            const clickTarget = viewBtn || wrapper;
            const carriers = [card, wrapper, viewBtn, dlBtn].filter(Boolean);

            const cardText = String(card.innerText || card.textContent || '').replace(/\s+/g, ' ').trim();
            const kind = inferCardKind(cardText);


            // Download resolution is deferred. Preserve the visible Claude generated-file card immediately
            // so export timeout/preview fetch failures cannot drop the filename card from the output.
            const preservedCard = buildClaudeGeneratedFileCardFromCell(card);
            if (preservedCard) {
              try {
                const replaceTarget = (wrapper && wrapper.matches && wrapper.matches('[role="button"][aria-label*="Preview" i]'))
                  ? wrapper
                  : card;
                replaceTarget.replaceWith(preservedCard);
              } catch {
                try { card.replaceWith(preservedCard); } catch {}
              }
              try { card.dataset.acepGeneratedFileLinked = '1'; } catch {}
              try { if (wrapper?.dataset) wrapper.dataset.acepGeneratedFileLinked = '1'; } catch {}
              linked++;
              continue;
            }

            const propRoots = [];
            const mainWorldArtifactInfo = await requestClaudeArtifactInfoFromMainWorld(cardIndex, 600);
            if (mainWorldArtifactInfo) propRoots.push(mainWorldArtifactInfo);
            carriers.forEach((n) => {
              const fib = findReactCarrier(n);
              if (fib) {
                propRoots.push(...collectFiberPropRoots(fib, 14));
                propRoots.push(...collectFiberNeighborhoodRoots(fib, 160));
              }
            });

            const { downloadUrl, path: rawPath } = extractDownloadUrlOrPathFromProps(propRoots);
            let url = normalizeClaudeDownloadUrl(downloadUrl);
            let resolvedPath = '';

            // Preferred: open preview and read the MAIN-world captured `file_path` from DOM attributes.
            if (!url) {
              try {
                const count0 = parseInt(document.documentElement.getAttribute('data-acep-claude-generated-file-count') || '0', 10) || 0;
                try { clickTarget.click(); } catch {}

                const hit = await waitForValue(() => {
                  const c1 = parseInt(document.documentElement.getAttribute('data-acep-claude-generated-file-count') || '0', 10) || 0;
                  if (c1 <= count0) return null;
                  const lastRaw = document.documentElement.getAttribute('data-acep-claude-generated-file-last') || '';
                  if (!lastRaw) return null;
                  try {
                    const j = JSON.parse(lastRaw);
                    if (j && typeof j === 'object' && typeof j.filePath === 'string' && /^\/outputs\//i.test(j.filePath)) return j;
                  } catch {}
                  return null;
                }, 2500, 80);

                if (hit && hit.filePath) {
                  const fp = String(hit.filePath);
                  const cardOrg = String(hit.orgId || orgId || '').trim();
                  const cardChat = String(hit.chatId || chatId || '').trim();
                  if (cardOrg && cardChat) {
                    resolvedPath = `/mnt/user-data${fp}`;
                    url = `https://claude.ai/api/organizations/${cardOrg}/conversations/${cardChat}/wiggle/download-file?path=${encodeURIComponent(resolvedPath)}`;
                  }
                }
              } catch {}
              // Close preview
              try {
                const close = document.querySelector('[aria-label="Close"], [data-testid*="close" i]');
                if (close) close.click();
                else document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
              } catch {}
              await new Promise(r => setTimeout(r, 120));
            }

            // DOM fallback: scrape `/outputs/...` from the preview panel DOM (best-effort; no hardcoding, no auto-download).
            if (!url) {
              try {
                try { clickTarget.click(); } catch {}
                const panel = await waitForValue(() => {
                  const p = document.querySelector('[data-testid*="side-panel"], .side-panel, [role="dialog"]');
                  if (!p) return null;
                  const fp = extractOutputsFilePathFromPanel(p);
                  return fp ? { panel: p, fp } : null;
                }, 2200, 120);
                if (panel && panel.fp) {
                  const fp = String(panel.fp);
                  resolvedPath = `/mnt/user-data${fp}`;
                  if (orgId && chatId) url = `https://claude.ai/api/organizations/${orgId}/conversations/${chatId}/wiggle/download-file?path=${encodeURIComponent(resolvedPath)}`;
                }
              } catch {}
              try {
                const close = document.querySelector('[aria-label="Close"], [data-testid*="close" i]');
                if (close) close.click();
                else document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
              } catch {}
              await new Promise(r => setTimeout(r, 120));
            }

            if (!url) {
              // Allow extracting /outputs/... and map to /mnt/user-data/outputs/...
              const p0 = normalizeOutputsPathString(rawPath);
              let p = '';
              if (/^\/mnt\/user-data\/outputs\//i.test(p0)) {
                p = p0;
              } else if (/^\/outputs\//i.test(p0)) {
                p = `/mnt/user-data/outputs/${p0.replace(/^\/outputs\//i, '')}`;
              }
              if (!p) {
                if (samples.length < 2) {
                  samples.push({ text: String(card.innerText || '').trim().slice(0, 160), gotDownloadUrl: !!downloadUrl, gotPath: !!rawPath, preservedCardOnly: true });
                }
              } else {
                resolvedPath = p;
                if (orgId && chatId) url = `https://claude.ai/api/organizations/${orgId}/conversations/${chatId}/wiggle/download-file?path=${encodeURIComponent(p)}`;
              }
            }

            // Build a simple replacement that survives all export formats; add a link only when resolved.
            const titleText = (() => {
              const txt = String(card.innerText || card.textContent || '').replace(/\s+/g, ' ').trim();
              const m = txt.match(/(Document\s*Ã‚Â·\s*DOCX|Code\s*Ã‚Â·\s*HTML|TXT|PDF)/i);
              return m ? `Claude generated file (${m[0].toUpperCase().replace(/\s+/g, ' ')})` : 'Claude generated file';
            })();

            const wrap = document.createElement('div');
            try { wrap.className = 'acep-chat-export'; } catch {}
            wrap.setAttribute('data-acep-generated-file', '1');
            try { if (resolvedPath) wrap.setAttribute('data-acep-generated-file-path', resolvedPath); } catch {}
            try { wrap.setAttribute('data-acep-generated-file-url', url); } catch {}
            try { if (mainWorldArtifactInfo?.id) wrap.setAttribute('data-acep-generated-file-artifact-id', String(mainWorldArtifactInfo.id)); } catch {}
            try { if (mainWorldArtifactInfo?.version_uuid) wrap.setAttribute('data-acep-generated-file-version-id', String(mainWorldArtifactInfo.version_uuid)); } catch {}
            wrap.style.margin = '8px 0';

            const displayTitle = (() => {
              try {
                const leading = (card.querySelector('.leading-tight')?.textContent || '').trim();
                const raw = String(card.innerText || card.textContent || '').replace(/\s+/g, ' ').trim();
                const m = raw.match(/\b(DOCX|HTML|TXT|PDF)\b/i);
                const ext = m ? String(m[1] || '').toUpperCase() : '';
                if (leading && ext) return `${leading} (${ext})`;
                if (leading) return leading;
                if (ext) return `Claude generated file (${ext})`;
              } catch {}
              return titleText;
            })();

            const titleP = document.createElement('p');
            titleP.style.margin = '0 0 4px';
            const strong = document.createElement('strong');
            strong.textContent = displayTitle;
            titleP.append(strong);

            wrap.append(titleP);
            if (url) {
              const a = document.createElement('a');
              a.href = url;
              a.target = '_blank';
              a.rel = 'noopener';
              a.textContent = 'Download';

              const linkP = document.createElement('p');
              linkP.style.margin = '0';
              linkP.append(a);
              wrap.append(linkP);
            }

            // IMPORTANT: replace the whole Preview wrapper so content.js clone cleanup
            // (which removes `[role="button"][aria-label="Preview contents"]`) doesn't delete our link.
            const replaceTarget = (wrapper && wrapper.matches && wrapper.matches('[role="button"][aria-label*="Preview" i]'))
              ? wrapper
              : card;
            try { replaceTarget.replaceWith(wrap); } catch { card.replaceWith(wrap); }
            try { card.dataset.acepGeneratedFileLinked = '1'; } catch {}
            try { if (wrapper?.dataset) wrapper.dataset.acepGeneratedFileLinked = '1'; } catch {}
            linked++;
          } catch {}
        }

        debugStore('generated_file_cards', { found: candidates.length, linked });
        if (samples.length) debugStore('generated_file_cards_samples', samples);
        return { ok: true, found: candidates.length, linked };
      } catch (e) {
        debugStore('generated_file_cards_error', String(e?.message || e));
        return { ok: false, error: String(e?.message || e) };
      }
    }

    function normalizeTitle(s = '') {
      return String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();
    }

    function getChatIdFromUrl() {
      try {
        const path = String(location.pathname || '');
        // Most common: /chat/<uuid>
        let m = path.match(/\/chat\/([a-f0-9-]{8,})/i);
        if (m && m[1]) return m[1];
        // Alternate: /c/<uuid>
        m = path.match(/\/c\/([a-f0-9-]{8,})/i);
        if (m && m[1]) return m[1];
        // Fallback: first UUID-like token in the path
        m = path.match(/([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/i);
        if (m && m[1]) return m[1];
        // Query param fallback
        try {
          const u = new URL(location.href);
          const qp = u.searchParams.get('chat') || u.searchParams.get('id') || u.searchParams.get('conversation') || '';
          const mm = String(qp).match(/([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/i);
          if (mm && mm[1]) return mm[1];
        } catch {}
        return '';
      } catch {
        return '';
      }
    }

    function getOrgId() {
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

    async function getOrgIdAsync(timeoutMs = 300) {
      const existing = getOrgId();
      if (existing) return existing;
      const waitForPerf = (ms = 600) => new Promise((resolve) => {
        const start = Date.now();
        const tick = () => {
          const v = getOrgId();
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
          finish(getOrgId());
        }, timeoutMs);
      });
    }

    function pruneMessagesToLeaf(convoData = {}, leafId = '') {
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
      } catch {
        return convoData.chat_messages || [];
      }
    }

    function parseArtifactsFromMessages(messages = []) {
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
            id: `ant:${normalizeTitle(title || body.slice(0, 40))}`,
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
                id: a.id || `tool_result:${normalizeTitle(a.title || content.slice(0, 40))}`,
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
        let toolUseCount = 0;
        let antCount = 0;
        const toolUseStats = new Map();
        const toolUseSamples = [];
        const toolResultSamples = [];
        let toolResultArtifactCount = 0;
        for (const msg of messages) {
          const content = Array.isArray(msg?.content) ? msg.content : [];
          if (!content.length && typeof msg?.content === 'string') {
            const extras = parseAntArtifactsFromText(msg.content);
            antCount += extras.length;
            extras.forEach(e => versions.push(e));
          }
          for (const part of content) {
            if (!part || part.type !== 'tool_use' || !part.input) continue;
            toolUseCount++;
            const input = part.input || {};
            const cmd = input.command || '';
            const id = input.id || '';
            if (id) {
              const stat = toolUseStats.get(id) || { id, title: input.title || '', create: 0, update: 0, rewrite: 0, other: 0, hasContent: 0 };
              if (cmd === 'create') stat.create++;
              else if (cmd === 'update') stat.update++;
              else if (cmd === 'rewrite') stat.rewrite++;
              else stat.other++;
              if (input.content || input.new_str) stat.hasContent++;
              if (!stat.title && input.title) stat.title = input.title;
              toolUseStats.set(id, stat);
            }
            if (toolUseSamples.length < 6) {
              toolUseSamples.push({ name: part.name, input });
            }
            const artifactId = input.id || part.id || part.tool_use_id || `tool_use:${versions.length + 1}`;
            const genericContent = toStr(input.content || input.new_str || input.widget_code || input.code || input.text || input.body || input.html || input.svg || '');
            if (!input.id && genericContent && /(?:<svg\b|&lt;svg\b)/i.test(genericContent)) {
              const v = bumpVersion(artifactId, getExplicitVersion(input));
              versions.push({
                id: artifactId,
                title: input.title || input.name || part.name || '',
                type: input.type || '',
                language: input.language || '',
                content: genericContent,
                _acepVersion: v,
              });
              continue;
            }
            if (!artifactId) continue;
            if (cmd === 'create' && (input.content || input.new_str)) {
              const v = bumpVersion(artifactId, getExplicitVersion(input));
              versions.push({
                id: artifactId,
                title: input.title || '',
                type: input.type || '',
                language: input.language || '',
                content: toStr(input.content || input.new_str),
                _acepVersion: v,
              });
            } else if (cmd === 'update' && (input.old_str || input.new_str || input.content)) {
              const prev = findLastById(artifactId);
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
              const v = bumpVersion(artifactId, getExplicitVersion(input));
              versions.push({
                id: artifactId,
                title: input.title || (prev?.title || ''),
                type: input.type || (prev?.type || ''),
                language: input.language || (prev?.language || ''),
                content: newContent,
                _acepVersion: v,
              });
            } else if (cmd === 'rewrite' && (input.content || input.new_str)) {
              const prev = findLastById(artifactId);
              const v = bumpVersion(artifactId, getExplicitVersion(input));
              versions.push({
                id: artifactId,
                title: input.title || (prev?.title || ''),
                type: input.type || (prev?.type || ''),
                language: input.language || (prev?.language || ''),
                content: toStr(input.content || input.new_str),
                _acepVersion: v,
              });
            } else if (genericContent && /(?:<svg\b|&lt;svg\b)/i.test(genericContent)) {
              const v = bumpVersion(artifactId, getExplicitVersion(input));
              versions.push({
                id: artifactId,
                title: input.title || input.name || part.name || '',
                type: input.type || '',
                language: input.language || '',
                content: genericContent,
                _acepVersion: v,
              });
            }
          }
          for (const part of content) {
            if (!part || part.type !== 'text' || !part.text) continue;
            const extras = parseAntArtifactsFromText(part.text);
            antCount += extras.length;
            extras.forEach(e => versions.push(e));
          }
          for (const part of content) {
            if (!part || part.type !== 'tool_result') continue;
            const extras = extractArtifactsFromToolResult(part);
            if (extras.length) {
              toolResultArtifactCount += extras.length;
              extras.forEach(e => versions.push(e));
            }
            if (toolResultSamples.length < 3) {
              toolResultSamples.push(part);
            }
          }
        }
        const statsArr = Array.from(toolUseStats.values());
        debugStore('artifacts_scan', { messages: messages.length, toolUseCount, antCount, ids: toolUseStats.size, toolResultArtifactCount });
        debugStore('toolUseStats', statsArr.slice(0, 5));
        debugStore('toolUseSamples', toolUseSamples.slice(0, 3));
        debugStore('toolResultSamples', toolResultSamples.slice(0, 2));
      } catch {}
      return versions;
    }

    const __state = g.ACEP.providers.claude.__state = g.ACEP.providers.claude.__state || {
      artifacts: null,
      artifactsPromise: null,
    };
    async function loadArtifactsFromApi() {
      try {
        if (!env.isClaude || !env.isClaude()) return [];
        if (Array.isArray(__state.artifacts) && __state.artifacts.length) return __state.artifacts;
        if (__state.artifactsPromise) return __state.artifactsPromise;
        __state.artifactsPromise = (async () => {
          try {
            const isUuid = (s = '') =>
              /[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/i.test(String(s || '').trim());

            const fetchOrgIdFromOrganizationsApi = async () => {
              try {
                const url = 'https://claude.ai/api/organizations';
                const resp = await fetch(url, { credentials: 'include' });
                debugStore('orgs_status', resp.status);
                if (!resp.ok) return '';
                const data = await resp.json().catch(() => null);
                const candidates = [];
                const pushAny = (v) => {
                  if (!v) return;
                  if (typeof v === 'string') { candidates.push(v); return; }
                  if (typeof v === 'object') {
                    Object.keys(v).forEach((k) => {
                      try {
                        const val = v[k];
                        if (typeof val === 'string') candidates.push(val);
                      } catch {}
                    });
                  }
                };
                if (Array.isArray(data)) {
                  data.forEach(pushAny);
                } else if (data && typeof data === 'object') {
                  // Common shapes: { organizations:[...] } or { data:[...] }
                  const arr = Array.isArray(data.organizations) ? data.organizations
                    : (Array.isArray(data.data) ? data.data : null);
                  if (arr) arr.forEach(pushAny);
                  pushAny(data);
                }
                const found = candidates.find(isUuid) || '';
                if (found) return found;
              } catch (e) {
                debugStore('orgs_error', String(e?.message || e));
              }
              return '';
            };

            const extractOrgIdFromPerf = () => {
              try {
                if (!performance || typeof performance.getEntriesByType !== 'function') return '';
                const entries = performance.getEntriesByType('resource') || [];
                for (const e of entries) {
                  const name = (e && e.name) ? String(e.name) : '';
                  if (!name) continue;
                  const m = name.match(/\/api\/organizations\/([a-f0-9-]{8,})\//i);
                  if (m && m[1]) return String(m[1] || '').trim();
                }
              } catch {}
              return '';
            };
            let orgId = await getOrgIdAsync(1500);
            if (!orgId) orgId = extractOrgIdFromPerf();
            if (!orgId) orgId = await fetchOrgIdFromOrganizationsApi();
            const chatId = getChatIdFromUrl();
            debugStore('artifacts_ids', { orgId: orgId || '', chatId: chatId || '' });
            if (!orgId || !chatId) return [];

            const latestUrl = `https://claude.ai/api/organizations/${orgId}/chat_conversations/${chatId}/latest`;
            const treeUrl = `https://claude.ai/api/organizations/${orgId}/chat_conversations/${chatId}?tree=True&rendering_mode=messages&render_all_tools=true`;
            const [latestResp, treeResp] = await Promise.all([
              fetch(latestUrl, { credentials: 'include' }),
              fetch(treeUrl, { credentials: 'include' }),
            ]);
            debugStore('artifacts_status', { latest: latestResp.status, tree: treeResp.status });
            if (!latestResp.ok || !treeResp.ok) return [];

            const latest = await latestResp.json().catch(() => ({}));
            const tree = await treeResp.json().catch(() => ({}));
            const leafId = latest?.current_leaf_message_uuid || tree?.current_leaf_message_uuid || '';
            const messages = pruneMessagesToLeaf(tree, leafId);
        debugScanClaudeApiCitations(messages);
            const artifacts = parseArtifactsFromMessages(messages);
            __state.artifacts = artifacts || [];
            debugStore('artifacts_count', __state.artifacts.length || 0);
            return __state.artifacts;
          } catch (e) {
            debugStore('artifacts_error', String(e?.message || e));
            return [];
          } finally {
            __state.artifactsPromise = null;
          }
        })();
        return __state.artifactsPromise;
      } catch {
        return [];
      }
    }

    function applyArtifactsToDom(artifacts = []) {
      try {
        if (!Array.isArray(artifacts) || !artifacts.length) return { ok: true, applied: 0 };
        const cards = Array.from(document.querySelectorAll(`${sel.artifactButton || '[role="button"][aria-label="Preview contents"]'}, .artifact-block-cell`));
        const roots = Array.from(new Set(cards.map(c => c.closest(sel.artifactButton || '[role="button"][aria-label="Preview contents"]') || c))).filter(Boolean);
        const svgArtifactCount = artifacts.filter(a => renderClaudeArtifactBodyHtml(a?.content || '')).length;
        if (!roots.length) {
          debugStore('artifacts_apply_no_roots', { artifacts: artifacts.length, svgArtifactCount });
          return { ok: true, applied: 0, roots: 0, svgArtifactCount };
        }

        const byTitle = new Map();
        const byId = new Map();
        artifacts.forEach(a => {
          if (!a || !a.content) return;
          const key = normalizeTitle(a.title);
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
        let globalIdx = 0;
        let applied = 0;
        const samples = [];
        roots.forEach(root => {
          if (root?.dataset?.acepArtifactText) return;
          // Skip Claude "generated file cards" (they have a Download button) Ã¢â‚¬â€œ those are handled elsewhere.
          try {
            const hasDl = !!(root.querySelector && root.querySelector('button[aria-label="Download"],a[download],button[download]'));
            if (hasDl) return;
          } catch {}

          const title = (root.dataset && root.dataset.acepArtifactTitle)
            || (root.querySelector('.leading-tight')?.textContent || '').trim();
          const dataId = root.getAttribute?.('data-acep-artifact-id') || root.dataset?.acepArtifactId || '';
          // Some Claude artifact cards don't use `.leading-tight`; fall back to first non-empty line of text.
          let title2 = String(title || '').trim();
          if (!title2) {
            try {
              const txt = String(root.textContent || '').replace(/\s+/g, ' ').trim();
              // Avoid selecting generic UI labels.
              const cleaned = txt
                .replace(/\bPreview\s+contents\b/ig, '')
                .replace(/\bClick\s+to\s+preview\b/ig, '')
                .replace(/\bOpen\b/ig, '')
                .trim();
              if (cleaned) title2 = cleaned.slice(0, 120);
            } catch {}
          }
          const key = normalizeTitle(title2);
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
          // If we still can't match by title/id, fall back to DOM order.
          if (!picked || !picked.content) {
            for (let i = globalIdx; i < artifacts.length; i++) {
              const cand = artifacts[i];
              if (!cand || !cand.content) continue;
              picked = cand;
              globalIdx = i + 1;
              break;
            }
          }
          if (!picked || !picked.content) return;
          const applyTo = (el) => {
            try {
              if (!el || !el.dataset) return;
              el.dataset.acepArtifactText = picked.content;
              const renderedSvg = renderClaudeArtifactBodyHtml(picked.content);
              if (renderedSvg) {
                el.dataset.acepArtifactHtml = renderedSvg;
                el.dataset.acepArtifactIsCode = '0';
              }
              if (!el.dataset.acepArtifactTitle && picked.title) el.dataset.acepArtifactTitle = picked.title;
              if (picked._acepVersion) el.dataset.acepArtifactVersion = String(picked._acepVersion);
              if (picked.id) el.dataset.acepArtifactId = picked.id;
              // Ensure attributes exist too (some clones/serializers may drop dataset access patterns).
              try { el.setAttribute('data-acep-artifact-text', picked.content); } catch {}
              try { if (renderedSvg) el.setAttribute('data-acep-artifact-html', renderedSvg); } catch {}
              try { if (renderedSvg) el.setAttribute('data-acep-artifact-is-code', '0'); } catch {}
              try { if (picked.title) el.setAttribute('data-acep-artifact-title', picked.title); } catch {}
              try { if (picked._acepVersion) el.setAttribute('data-acep-artifact-version', String(picked._acepVersion)); } catch {}
              try { if (picked.id) el.setAttribute('data-acep-artifact-id', String(picked.id)); } catch {}
            } catch {}
          };
          applyTo(root);
          // Also stamp the visible cell node that gets moved into the markdown container during export.
          try {
            const cell = root.querySelector?.('.artifact-block-cell') || (root.closest?.('.artifact-block-cell') || null);
            if (cell && cell !== root) applyTo(cell);
          } catch {}
          applied++;
          if (samples.length < 3) {
            samples.push({
              cardText: String(root.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 140),
              title: title2 || '',
              dataId: dataId || '',
              pickedTitle: picked.title || '',
              pickedId: picked.id || '',
            });
          }
        });
        debugStore('artifacts_applied', { applied, roots: roots.length, artifacts: artifacts.length, svgArtifactCount });
        if (samples.length) debugStore('artifacts_applied_samples', samples);
        return { ok: true, applied, roots: roots.length, svgArtifactCount };
      } catch (e) {
        debugStore('artifacts_apply_error', String(e?.message || e));
        return { ok: false, error: String(e?.message || e) };
      }
    }

    // Provider API: roleFromTurn - determine if turn is user or assistant
    function roleFromTurn(turn) {
      try {
        const preset = turn?.getAttribute?.('data-acep-role');
        if (preset) return preset;
        // Claude: check explicit data attributes set during selection
        if (turn?.getAttribute?.('data-acep-role')) return turn.getAttribute('data-acep-role');
        // Claude: user prompts have [data-testid="user-message"]
        if (turn?.matches?.('[data-testid="user-message"]') || turn?.closest?.('[data-testid="user-message"]')) return 'user';
        // Claude: assistant responses have .font-claude-response or .standard-markdown
        if (turn?.matches?.('.font-claude-response, .standard-markdown, .progressive-markdown') 
          || turn?.querySelector?.('.font-claude-response, .standard-markdown, .progressive-markdown')) return 'assistant';
        if (turn?.matches?.('[role="button"][aria-label="Preview contents"]')) return 'artifact';
        return '';
      } catch {
        return '';
      }
    }

    // --- API-first helpers (mirrors DeepSeek provider pattern) ---

    function escapeHtmlApi(s = '') {
      return String(s || '').replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
    }

    function normalizeClaudeUserText(text = '') {
      try {
        let out = String(text || '').replace(/\r\n/g, '\n');
        out = out.replace(/^\s*You said:\s*START THIS AS A FRESH CONVERSATION HERE\s*\n?/i, '');
        out = out.replace(/^\s*You said:\s*/i, '');
        let lines = out.split('\n');
        if (lines.length >= 2) {
          const first = String(lines[0] || '').trim();
          const rest = lines.slice(1).join('\n').trim();
          if (/^You said:\s*/i.test(first)) {
            const firstBody = first.replace(/^You said:\s*/i, '').trim();
            if (!firstBody || rest.startsWith(firstBody) || firstBody.startsWith(rest.slice(0, Math.min(rest.length, firstBody.length)))) {
              lines.shift();
            }
          } else if (rest && rest.startsWith(first) && first.length <= 140) {
            lines.shift();
          }
        }
        return lines.join('\n').replace(/^\s+/, '');
      } catch {
        return text;
      }
    }

    function sanitizeClaudeSvg(svg = '') {
      try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(String(svg || ''), 'image/svg+xml');
        const root = doc && doc.documentElement;
        if (!root || String(root.nodeName || '').toLowerCase() !== 'svg') return '';
        try { root.querySelectorAll('script, foreignObject, iframe, object, embed').forEach(n => n.remove()); } catch {}
        try {
          root.querySelectorAll('*').forEach((el) => {
            for (const attr of Array.from(el.attributes || [])) {
              const name = String(attr.name || '').toLowerCase();
              const val = String(attr.value || '');
              if (name.startsWith('on')) el.removeAttribute(attr.name);
              if ((name === 'href' || name === 'xlink:href') && /^\s*javascript:/i.test(val)) el.removeAttribute(attr.name);
            }
          });
        } catch {}
        try {
          const raw = String(svg || '');
          const needsStandaloneStyles = /\bclass\s*=\s*["'][^"']*\bc-(?:blue|amber|coral|red|teal|pink)\b/i.test(raw)
            || /\bclass\s*=\s*["'][^"']*\b(?:th|ts)\b/i.test(raw)
            || /var\(--t\)/i.test(raw);
          if (needsStandaloneStyles) {
            root.setAttribute('style', `${root.getAttribute('style') || ''}; --t:#64748b; color:#111827; background:transparent;`.trim());
            root.querySelectorAll('[stroke="var(--t)"]').forEach((el) => {
              try { el.setAttribute('stroke', '#64748b'); } catch {}
            });
            root.querySelectorAll('[fill="var(--t)"]').forEach((el) => {
              try { el.setAttribute('fill', '#64748b'); } catch {}
            });
            const style = doc.createElementNS('http://www.w3.org/2000/svg', 'style');
            style.textContent = `
              .node rect,.node ellipse,.node circle{fill:#f8fafc;stroke:#64748b}
              .c-blue rect,.c-blue ellipse,.c-blue circle{fill:#eaf4ff;stroke:#378add}
              .c-amber rect,.c-amber ellipse,.c-amber circle{fill:#fff4df;stroke:#d68a2d}
              .c-coral rect,.c-coral ellipse,.c-coral circle{fill:#fdece7;stroke:#d46a4c}
              .c-red rect,.c-red ellipse,.c-red circle{fill:#fde7e9;stroke:#d4535c}
              .c-teal rect,.c-teal ellipse,.c-teal circle{fill:#e8f8f4;stroke:#1d9e75}
              .c-pink rect,.c-pink ellipse,.c-pink circle{fill:#fdeaf2;stroke:#d4537e}
              text{font-family:Inter,Arial,sans-serif;paint-order:stroke;stroke:#fff;stroke-width:2px;stroke-linejoin:round}
              .th{fill:#1f2937;font-size:14px;font-weight:700}
              .ts{fill:#374151;font-size:12px;font-weight:600}
            `.replace(/\s+/g, ' ').trim();
            const defs = root.querySelector('defs');
            if (defs) defs.insertBefore(style, defs.firstChild);
            else root.insertBefore(style, root.firstChild);
          }
        } catch {}
        try {
          root.setAttribute('class', `${root.getAttribute('class') || ''} acep-inline-svg`.trim());
          if (!root.getAttribute('xmlns')) root.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
        } catch {}
        return new XMLSerializer().serializeToString(root);
      } catch {
        return '';
      }
    }

    function isClaudeContentSvg(svg = '') {
      try {
        const raw = String(svg || '');
        if (!/<svg\b/i.test(raw)) return false;
        if (/\bdata-cds\s*=\s*["']ClaudeLogo["']|aria-label\s*=\s*["']Claude["']/i.test(raw)) return false;
        if (/viewBox\s*=\s*["'](?:0\s+0\s+24\s+24|30\s+0\s+82\s+24)["']/i.test(raw)) return false;
        if (/<(?:title|desc)\b/i.test(raw)) return true;
        if (/\bwidth\s*=\s*["']100%["']/i.test(raw) && /<text\b/i.test(raw)) return true;
        const vb = raw.match(/\bviewBox\s*=\s*["']\s*[-\d.]+\s+[-\d.]+\s+([\d.]+)\s+([\d.]+)\s*["']/i);
        if (vb) {
          const w = Number.parseFloat(vb[1]);
          const h = Number.parseFloat(vb[2]);
          if (Number.isFinite(w) && Number.isFinite(h) && w >= 160 && h >= 100 && /<text\b/i.test(raw)) return true;
        }
        const width = Number.parseFloat((raw.match(/\bwidth\s*=\s*["']?([\d.]+)/i) || [,''])[1]);
        const height = Number.parseFloat((raw.match(/\bheight\s*=\s*["']?([\d.]+)/i) || [,''])[1]);
        return Number.isFinite(width) && Number.isFinite(height) && width >= 160 && height >= 100 && /<text\b/i.test(raw);
      } catch {
        return false;
      }
    }

    function claudeSvgToImageHtml(svg = '') {
      try {
        const safe = sanitizeClaudeSvg(svg);
        if (!safe || !isClaudeContentSvg(safe)) return '';
        const dataUrl = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(safe)))}`;
        return `<div class="acep-svg-wrap"><img class="acep-inline-svg-img" src="${dataUrl}" data-original-src="${dataUrl}" data-acep-svg="${escapeHtmlApi(safe)}" alt="SVG diagram"></div>`;
      } catch {
        return '';
      }
    }

    function renderClaudeCitationLinksFromPart(part = {}) {
      try {
        const citations = [];
        const addCitation = (item) => {
          try {
            if (!item || typeof item !== 'object') return;
            const url = String(item.url || item.href || item.link || item.source_url || item.uri || '').trim();
            if (!/^https?:\/\//i.test(url)) return;
            const rawTitle = String(item.title || item.name || item.source || item.hostname || '').trim();
            let label = rawTitle;
            if (!label) {
              try { label = new URL(url).hostname.replace(/^www\./i, '').split('.')[0].toUpperCase(); } catch { label = 'Source'; }
            }
            const key = url + '|' + label;
            if (citations.some((c) => c.key === key)) return;
            citations.push({ key, url, label });
          } catch {}
        };
        const scan = (value, depth = 0) => {
          try {
            if (!value || depth > 4) return;
            if (Array.isArray(value)) { value.forEach((v) => scan(v, depth + 1)); return; }
            if (typeof value !== 'object') return;
            addCitation(value);
            Object.keys(value).forEach((key) => {
              if (/^(text|content|input|message)$/i.test(key)) return;
              if (/citation|source|reference|url|link|href/i.test(key)) scan(value[key], depth + 1);
            });
          } catch {}
        };
        scan(part?.citations || part?.references || part?.sources || part?.source_references || []);
        if (!citations.length) return '';
        return '<span class="acep-claude-citations">' + citations.map((c) =>
          '<a class="acep-claude-citation-link" href="' + escapeHtmlApi(c.url) + '" target="_blank" rel="noopener noreferrer">' + escapeHtmlApi(c.label) + '</a>'
        ).join(' ') + '</span>';
      } catch {
        return '';
      }
    }


    function renderClaudeTextPartWithApiCitations(part = {}) {
      try {
        let text = String(part?.text || '').trim();
        if (!text) return '';
        const citations = Array.isArray(part?.citations) ? part.citations : [];
        if (!citations.length) return markdownToHtmlClaude(text);
        const tokens = new Map();
        const makeToken = (citation) => {
          const url = String(citation?.url || citation?.sources?.[0]?.url || '').trim();
          if (!/^https?:\/\//i.test(url)) return '';
          const rawTitle = String(citation?.metadata?.site_name || citation?.sources?.[0]?.source || citation?.title || citation?.sources?.[0]?.title || '').replace(/\s+/g, ' ').trim();
          let label = rawTitle || 'Source';
          if (label.length > 42) label = label.slice(0, 39).trim() + '?';
          const token = 'ACEP_CLAUDE_CITATION_TOKEN_' + tokens.size + '_';
          tokens.set(token, '<a class="acep-claude-citation-link" href="' + escapeHtmlApi(url) + '" target="_blank" rel="noopener noreferrer">' + escapeHtmlApi(label) + '</a>');
          return token;
        };
        const grouped = new Map();
        citations.forEach((citation) => {
          const end = Number(citation?.end_index ?? citation?.endIndex ?? citation?.end);
          if (!Number.isFinite(end) || end <= 0 || end > text.length) return;
          const url = String(citation?.url || citation?.sources?.[0]?.url || '').trim();
          if (!/^https?:\/\//i.test(url)) return;
          const list = grouped.get(end) || [];
          if (!list.some((item) => String(item?.url || item?.sources?.[0]?.url || '') === url)) list.push(citation);
          grouped.set(end, list);
        });
        Array.from(grouped.entries()).sort((a, b) => b[0] - a[0]).forEach(([end, list]) => {
          const chips = list.map(makeToken).filter(Boolean);
          if (chips.length) text = text.slice(0, end) + ' ' + chips.join(' ') + text.slice(end);
        });
        let html = markdownToHtmlClaude(text);
        for (const [token, chip] of tokens.entries()) html = html.split(token).join(chip);
        try { document.documentElement.setAttribute('data-acep-claude-citation-audit', JSON.stringify({ count: citations.length, rendered: tokens.size }).slice(0, 1000)); } catch {}
        return html;
      } catch {
        return markdownToHtmlClaude(String(part?.text || '').trim());
      }
    }

    function renderClaudeTextPartWithoutCitations(part = {}) {
      try {
        return markdownToHtmlClaude(String(part?.text || '').trim());
      } catch {
        return '';
      }
    }

    function markdownToHtmlClaude(md = '') {
      if (!md) return '';
      const esc = escapeHtmlApi;
      const svgBlocks = [];
      const svgToken = (idx) => `ACEP_CLAUDE_SVG_BLOCK_${idx}_`;
      const decodeSvgEntityBlock = (block = '') => {
        try {
          const textarea = document.createElement('textarea');
          textarea.innerHTML = String(block || '');
          return textarea.value || String(block || '');
        } catch {
          return String(block || '')
            .replace(/&lt;/gi, '<')
            .replace(/&gt;/gi, '>')
            .replace(/&quot;/gi, '"')
            .replace(/&#39;|&apos;/gi, "'")
            .replace(/&amp;/gi, '&');
        }
      };
      const decodedSource = String(md).replace(/&lt;svg\b[\s\S]*?&lt;\/svg&gt;/gi, (m) => decodeSvgEntityBlock(m));
      const source = decodedSource.replace(/<svg\b[\s\S]*?<\/svg>/gi, (m) => {
        const svgHtml = claudeSvgToImageHtml(m);
        if (!svgHtml) return '';
        const idx = svgBlocks.push(svgHtml) - 1;
        return `\n\n${svgToken(idx)}\n\n`;
      });
      const lines = source.replace(/\r\n/g, '\n').split('\n');
      let out = '';
      let i = 0;
      const inline = (s) => {
        s = s.replace(/!\[([^\]]*)\]\((https?:\/\/[^\s)]+|\/[^\s)]+)\)/g, (_m, alt, url) =>
          `<img src="${esc(url)}" data-original-src="${esc(url)}" alt="${esc(alt)}">`);
        s = s.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
        s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
        s = s.replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>');
        s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
        // Inline math: $...$ (avoid matching lone $ signs for currency)
        s = s.replace(/(?<![\\$\d])\$([^$\n]{1,300})\$(?![\d])/g, (_, tex) =>
          `<span class="math-inline katex" data-math="${esc(tex)}">$${esc(tex)}$</span>`);
        return s;
      };
      while (i < lines.length) {
        const line = lines[i];
        // Block math: $$...$$ (possibly multi-line)
        if (/^\s*\$\$/.test(line)) {
          let math = line.replace(/^\s*\$\$/, '');
          if (/\$\$\s*$/.test(math)) {
            math = math.replace(/\$\$\s*$/, '').trim();
          } else {
            i++;
            while (i < lines.length && !/\$\$/.test(lines[i])) { math += '\n' + lines[i]; i++; }
            if (i < lines.length) math += '\n' + lines[i].replace(/\$\$.*/, '');
          }
          out += `<div class="math-block katex-display" data-math="${esc(math.trim())}">$$${esc(math.trim())}$$</div>`;
          i++; continue;
        }
        if (/^\s*```/.test(line)) {
          const lang = (line.match(/^\s*```(\S*)/) || [, ''])[1];
          let code = '';
          i++;
          while (i < lines.length && !/^\s*```/.test(lines[i])) { code += lines[i] + '\n'; i++; }
          out += `<pre><code${lang ? ` class="language-${esc(lang)}"` : ''}>${esc(code.trimEnd())}</code></pre>`;
          i++; continue;
        }
        if (/^\s*#{1,6}\s+/.test(line)) {
          const level = (line.match(/^\s*(#{1,6})\s+/) || [, '#'])[1].length;
          out += `<h${level}>${inline(esc(line.replace(/^\s*#{1,6}\s+/, '').trim()))}</h${level}>`;
          i++; continue;
        }
        if (/^\s*[-*+]\s+/.test(line)) {
          const items = [];
          while (i < lines.length && /^\s*[-*+]\s+/.test(lines[i])) { items.push(lines[i].replace(/^\s*[-*+]\s+/, '').trim()); i++; }
          out += `<ul>${items.map(it => `<li>${inline(esc(it))}</li>`).join('')}</ul>`;
          continue;
        }
        if (/^\s*\d+\.\s+/.test(line)) {
          const items = [];
          while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) { items.push(lines[i].replace(/^\s*\d+\.\s+/, '').trim()); i++; }
          out += `<ol>${items.map(it => `<li>${inline(esc(it))}</li>`).join('')}</ol>`;
          continue;
        }
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
            out += `<p>${tLines.map((l) => inline(esc(String(l || '').trimEnd()))).join('<br>')}</p>`;
          }
          continue;
        }
        if (!line.trim()) { i++; continue; }
        const buf = [];
        while (i < lines.length && lines[i].trim()) { buf.push(lines[i]); i++; }
        const htmlText = buf.map((l) => inline(esc(String(l || '').trimEnd()))).join('<br>');
        if (htmlText.trim()) out += `<p>${htmlText}</p>`;
      }
      svgBlocks.forEach((svg, idx) => {
        out = out.replace(new RegExp(`<p>\\s*${svgToken(idx)}\\s*</p>|${svgToken(idx)}`, 'g'), svg);
      });
      return out;
    }

    function decodeClaudeHtmlEntities(text = '') {
      try {
        const textarea = document.createElement('textarea');
        textarea.innerHTML = String(text || '');
        return textarea.value || String(text || '');
      } catch {
        return String(text || '')
          .replace(/&lt;/gi, '<')
          .replace(/&gt;/gi, '>')
          .replace(/&quot;/gi, '"')
          .replace(/&#39;|&apos;/gi, "'")
          .replace(/&amp;/gi, '&');
      }
    }

    function sanitizeClaudeVisualizationHtml(html = '') {
      try {
        const raw = decodeClaudeHtmlEntities(html);
        if (/\bclass\s*=\s*["'][^"']*\bmermaid\b/i.test(raw)) {
          return '';
        }
        const hasVisualContainer = /(?:id\s*=\s*["']vis-container["']|<canvas\b|<svg\b)/i.test(raw);
        const hasStyledHtmlArtifact = /^\s*<(?:div|section|article)\b/i.test(raw) && /<table\b/i.test(raw) && /\bstyle\s*=/i.test(raw);
        if (!/<(?:div|section|article)\b/i.test(raw)) return '';
        if (!hasVisualContainer && !hasStyledHtmlArtifact) return '';
        const doc = new DOMParser().parseFromString(raw, 'text/html');
        if (!doc || !doc.body) return '';
        try { doc.body.querySelectorAll('script, iframe, object, embed, link, meta').forEach(n => n.remove()); } catch {}
        try {
          doc.body.querySelectorAll('*').forEach((el) => {
            for (const attr of Array.from(el.attributes || [])) {
              const name = String(attr.name || '').toLowerCase();
              const val = String(attr.value || '');
              if (name.startsWith('on')) el.removeAttribute(attr.name);
              if ((name === 'href' || name === 'src' || name === 'xlink:href') && /^\s*javascript:/i.test(val)) el.removeAttribute(attr.name);
            }
          });
        } catch {}
        const root = doc.body.querySelector('#vis-container') || doc.body.firstElementChild;
        if (!root) return '';
        if (hasVisualContainer) {
          try { root.classList.add('acep-visual-wrap'); } catch {}
        } else if (hasStyledHtmlArtifact) {
          try {
            root.classList.add('acep-html-artifact');
            const readInlineStyle = (el) => {
              const out = {};
              try {
                String(el?.getAttribute?.('style') || '')
                  .split(';')
                  .map((part) => part.trim())
                  .filter(Boolean)
                  .forEach((part) => {
                    const idx = part.indexOf(':');
                    if (idx <= 0) return;
                    const key = part.slice(0, idx).trim().toLowerCase();
                    const value = part.slice(idx + 1).replace(/!important\s*$/i, '').trim();
                    if (key && value) out[key] = value;
                  });
              } catch {}
              return out;
            };
            const nearestInlineValue = (el, prop) => {
              try {
                let cur = el;
                while (cur && cur !== doc.body) {
                  const styles = readInlineStyle(cur);
                  if (styles[prop]) return styles[prop];
                  cur = cur.parentElement;
                }
              } catch {}
              return '';
            };
            const addImportantStyle = (el, prop, value) => {
              try {
                if (!el || !prop || !value) return;
                const styles = readInlineStyle(el);
                styles[prop] = value;
                const next = Object.entries(styles)
                  .map(([key, val]) => `${key}: ${val} !important`)
                  .join('; ');
                if (next) el.setAttribute('style', next);
              } catch {}
            };
            root.querySelectorAll?.('table, thead, tbody, tr, th, td').forEach((el) => {
              try {
                const color = nearestInlineValue(el, 'color');
                const fontFamily = nearestInlineValue(el, 'font-family');
                if (color) addImportantStyle(el, 'color', color);
                if (fontFamily) addImportantStyle(el, 'font-family', fontFamily);
                if (!readInlineStyle(el).background && !readInlineStyle(el)['background-color']) {
                  addImportantStyle(el, 'background', 'transparent');
                }
              } catch {}
            });
            root.querySelectorAll?.('[style]').forEach((el) => {
              try {
                const style = String(el.getAttribute('style') || '').trim();
                if (!style) return;
                const importantStyle = style
                  .split(';')
                  .map((part) => part.trim())
                  .filter(Boolean)
                  .map((part) => /!important\s*$/i.test(part) ? part : `${part} !important`)
                  .join('; ');
                if (importantStyle) el.setAttribute('style', importantStyle);
              } catch {}
            });
            const rootStyle = String(root.getAttribute('style') || '').trim();
            if (rootStyle) {
              const importantRootStyle = rootStyle
                .split(';')
                .map((part) => part.trim())
                .filter(Boolean)
                .map((part) => /!important\s*$/i.test(part) ? part : `${part} !important`)
                .join('; ');
              if (importantRootStyle) root.setAttribute('style', importantRootStyle);
            }
          } catch {}
        }
        return root.outerHTML || '';
      } catch {
        return '';
      }
    }

    function buildClaudeMcpFrameHtml(src = '', title = '') {
      try {
        const url = String(src || '').trim();
        if (!/^https:\/\/[^/]+\.claudemcpcontent\.com\/mcp_apps\b/i.test(url)) return '';
        return '';
      } catch {
        return '';
      }
    }

    function extractClaudeMcpFramesHtmlFromString(html = '') {
      try {
        const raw = String(html || '');
        if (!/claudemcpcontent\.com\/mcp_apps/i.test(raw)) return '';
        const doc = new DOMParser().parseFromString(raw, 'text/html');
        if (!doc || !doc.body) return '';
        const seen = new Set();
        return Array.from(doc.body.querySelectorAll('iframe[src*="claudemcpcontent.com/mcp_apps" i]'))
          .map((frame) => {
            const src = String(frame.getAttribute('src') || '').trim();
            if (!src || seen.has(src)) return '';
            seen.add(src);
            return buildClaudeMcpFrameHtml(src, frame.getAttribute('title') || 'Claude visualization');
          })
          .filter(Boolean)
          .join('');
      } catch {
        return '';
      }
    }

    function renderClaudeArtifactBodyHtml(content = '') {
      try {
        const raw = String(content || '');
        const mcpFrame = extractClaudeMcpFramesHtmlFromString(raw);
        if (mcpFrame) return mcpFrame;
        const visual = sanitizeClaudeVisualizationHtml(raw);
        if (visual) return visual;
        const svgMatches = raw.match(/<svg\b[\s\S]*?<\/svg>/gi) || [];
        if (!svgMatches.length) return '';
        const rendered = svgMatches
          .map((svg) => claudeSvgToImageHtml(svg))
          .filter(Boolean)
          .join('');
        return rendered;
      } catch {
        return '';
      }
    }

    function extractClaudeSvgImageHtmlFromString(input = '') {
      try {
        const raw = String(input || '');
        if (!/(?:<svg\b|&lt;svg\b)/i.test(raw)) return '';
        const decodeEntities = (s = '') => {
          try {
            const textarea = document.createElement('textarea');
            textarea.innerHTML = String(s || '');
            return textarea.value || String(s || '');
          } catch {
            return String(s || '')
              .replace(/&lt;/gi, '<')
              .replace(/&gt;/gi, '>')
              .replace(/&quot;/gi, '"')
              .replace(/&#39;|&apos;/gi, "'")
              .replace(/&amp;/gi, '&');
          }
        };
        const decoded = decodeEntities(raw);
        const matches = decoded.match(/<svg\b[\s\S]*?<\/svg>/gi) || [];
        if (!matches.length) return '';
        const seen = new Set();
        return matches.map((svg) => {
          const safe = sanitizeClaudeSvg(svg);
          if (!safe) return '';
          const key = safe.replace(/\s+/g, ' ').slice(0, 500);
          if (seen.has(key)) return '';
          seen.add(key);
          return claudeSvgToImageHtml(safe);
        }).filter(Boolean).join('');
      } catch {
        return '';
      }
    }

    function collectClaudeContentSvgHtmlDeep(root = document) {
      try {
        const out = [];
        const seen = new Set();
        const addSvg = (svg) => {
          try {
            const html = claudeSvgToImageHtml(svg?.outerHTML || '');
            if (!html) return;
            const key = html.replace(/\s+/g, ' ').slice(0, 800);
            if (seen.has(key)) return;
            seen.add(key);
            out.push(html);
          } catch {}
        };
        const scanRoot = (scope, depth = 0) => {
          try {
            if (!scope || depth > 4) return;
            try { Array.from(scope.querySelectorAll?.('svg') || []).forEach(addSvg); } catch {}
            try {
              Array.from(scope.querySelectorAll?.('*') || []).forEach((el) => {
                try { if (el.shadowRoot) scanRoot(el.shadowRoot, depth + 1); } catch {}
              });
            } catch {}
            try {
              Array.from(scope.querySelectorAll?.('iframe') || []).forEach((frame) => {
                try {
                  const doc = frame.contentDocument || frame.contentWindow?.document || null;
                  if (doc) scanRoot(doc, depth + 1);
                } catch {}
                try {
                  const srcdoc = String(frame.getAttribute?.('srcdoc') || '');
                  const extra = extractClaudeSvgImageHtmlFromString(srcdoc);
                  if (extra) {
                    const key = extra.replace(/\s+/g, ' ').slice(0, 800);
                    if (!seen.has(key)) {
                      seen.add(key);
                      out.push(extra);
                    }
                  }
                } catch {}
              });
            } catch {}
          } catch {}
        };
        scanRoot(root || document, 0);
        return out.join('');
      } catch {
        return '';
      }
    }

    function collectClaudeVisualizationHtmlDeep(root = document) {
      try {
        const out = [];
        const seen = new Set();
        const addNode = (node) => {
          try {
            const html = sanitizeClaudeVisualizationHtml(node?.outerHTML || '');
            if (!html) return;
            const key = html.replace(/\s+/g, ' ').slice(0, 800);
            if (seen.has(key)) return;
            seen.add(key);
            out.push(html);
          } catch {}
        };
        const scanRoot = (scope, depth = 0) => {
          try {
            if (!scope || depth > 4) return;
            try { Array.from(scope.querySelectorAll?.('#vis-container, .acep-visual-wrap') || []).forEach(addNode); } catch {}
            try {
              Array.from(scope.querySelectorAll?.('*') || []).forEach((el) => {
                try { if (el.shadowRoot) scanRoot(el.shadowRoot, depth + 1); } catch {}
              });
            } catch {}
            try {
              Array.from(scope.querySelectorAll?.('iframe') || []).forEach((frame) => {
                try {
                  const doc = frame.contentDocument || frame.contentWindow?.document || null;
                  if (doc) scanRoot(doc, depth + 1);
                } catch {}
                try {
                  const srcdoc = String(frame.getAttribute?.('srcdoc') || '');
                  const html = sanitizeClaudeVisualizationHtml(srcdoc);
                  if (html) {
                    const key = html.replace(/\s+/g, ' ').slice(0, 800);
                    if (!seen.has(key)) {
                      seen.add(key);
                      out.push(html);
                    }
                  }
                } catch {}
              });
            } catch {}
          } catch {}
        };
        scanRoot(root || document, 0);
        return out.join('');
      } catch {
        return '';
      }
    }

    function collectClaudeMcpFramesHtmlDeep(root = document) {
      try {
        const out = [];
        const seen = new Set();
        const addFrame = (frame) => {
          try {
            const src = String(frame?.getAttribute?.('src') || '').trim();
            if (!src || seen.has(src)) return;
            const html = buildClaudeMcpFrameHtml(src, frame.getAttribute?.('title') || 'Claude visualization');
            if (!html) return;
            seen.add(src);
            out.push(html);
          } catch {}
        };
        const scanRoot = (scope, depth = 0) => {
          try {
            if (!scope || depth > 4) return;
            try { Array.from(scope.querySelectorAll?.('iframe[src*="claudemcpcontent.com/mcp_apps" i]') || []).forEach(addFrame); } catch {}
            try {
              Array.from(scope.querySelectorAll?.('*') || []).forEach((el) => {
                try { if (el.shadowRoot) scanRoot(el.shadowRoot, depth + 1); } catch {}
              });
            } catch {}
          } catch {}
        };
        scanRoot(root || document, 0);
        return out.join('');
      } catch {
        return '';
      }
    }

    function buildClaudeGeneratedFileCardFromCell(card) {
      try {
        if (!card || !card.querySelector) return null;
        const rawText = String(card.innerText || card.textContent || '').replace(/\s+/g, ' ').trim();
        const wrapper = card.closest?.('[class*="group/artifact-block" i], [role="button"][aria-label*="Preview" i]') || card;
        const actionLabel = String(wrapper?.getAttribute?.('aria-label') || '') + ' ' + String(wrapper?.querySelector?.('button[aria-label*="Download" i], button[aria-label^="View " i], button[aria-label*="Open" i]')?.getAttribute?.('aria-label') || '');
        const title = String(card.querySelector('.leading-tight')?.textContent || '').replace(/\s+/g, ' ').trim();
        const extMatch = rawText.match(/\b(DOCX|HTML|TXT|PDF|DOCUMENT|CODE)\b/i);
        const hasExplicitGeneratedFileType = /\b(DOCX|HTML|TXT|PDF)\b/i.test(rawText) || /\b(Document|Code)\s*[^A-Za-z0-9]*\s*\b(DOCX|HTML|TXT|PDF)\b/i.test(rawText);
        const looksGeneratedFile = hasExplicitGeneratedFileType && (/\b(download|view|open)\b/i.test(`${rawText} ${actionLabel}`) || !!title);
        if (!looksGeneratedFile) return null;
        const rawExt = extMatch ? String(extMatch[1] || '').toUpperCase() : '';
        const ext = /DOCUMENT|CODE/.test(rawExt) ? '' : rawExt;
        const displayTitle = title && ext ? `${title} (${ext})` : (title || (ext ? `Claude generated file (${ext})` : 'Claude generated file'));
        const wrap = document.createElement('div');
        wrap.className = 'acep-generated-file-card';
        wrap.setAttribute('data-acep-generated-file', '1');
        wrap.style.cssText = 'margin:8px 0;padding:10px 12px;border:1px solid rgba(148,163,184,.45);border-radius:12px;background:rgba(148,163,184,.10);color:inherit;display:flex;align-items:center;justify-content:space-between;gap:12px;';
        const name = document.createElement('span');
        name.className = 'acep-generated-file-name';
        name.style.cssText = 'font-weight:700;word-break:break-word;color:inherit;';
        name.textContent = displayTitle;
        wrap.appendChild(name);
        return wrap;
      } catch {
        return null;
      }
    }

    function buildApiTurnNode({ role = 'assistant', html = '', imgs = [], turnId = '', hasArtifact = false, needsDomFallback = false, hasPastedFile = false } = {}) {
      const el = document.createElement('div');
      try {
        el.setAttribute('data-acep-from-api', '1');
        el.setAttribute('data-acep-role', role);
        if (turnId) el.setAttribute('data-acep-turn-id', String(turnId));
        el.setAttribute('data-acep-export-idx', '');
        if (hasArtifact) el.setAttribute('data-acep-has-artifact', '1');
        if (needsDomFallback) el.setAttribute('data-acep-needs-dom-fallback', '1');
        if (hasPastedFile) el.setAttribute('data-acep-has-pasted-file', '1');
      } catch {}
      const content = document.createElement('div');
      content.className = 'acep-api-content';
      content.innerHTML = `<!-- acep-claude-provider-rev:${CLAUDE_PROVIDER_REV} -->${html || ''}`;
      el.appendChild(content);
      if (imgs && imgs.length) {
        try { el.setAttribute('data-acep-imgs', JSON.stringify(imgs)); } catch {}
        try {
          imgs.forEach((im) => {
            const src = String(im?.src || im?.originalSrc || '').trim();
            if (!src) return;
            const img = document.createElement('img');
            img.setAttribute('src', src);
            img.setAttribute('data-original-src', src);
            if (im?.alt) img.setAttribute('alt', String(im.alt));
            img.style.cssText = 'width:100%;max-width:100%;height:auto;display:block;margin:8px 0;object-fit:contain;margin-left:0;margin-right:auto;';
            content.appendChild(img);
          });
        } catch {}
      }
      return el;
    }

    function debugScanClaudeApiCitations(messages = []) {
      try {
        const hits = [];
        const wantedKey = /citation|cite|source|reference|url|web|attribution|link|href/i;
        const wantedValue = /https?:\/\/|citation|source|reference|web|href|url/i;
        const addHit = ({ path, key = '', value = '', msg = null, parent = null }) => {
          if (hits.length >= 100) return;
          let parentPreview = '';
          try { parentPreview = JSON.stringify(parent); } catch {}
          hits.push({ path, key, sender: msg?.sender || msg?.role || '', uuid: msg?.uuid || msg?.id || '', value: String(value || '').slice(0, 1500), parentKeys: parent && typeof parent === 'object' ? Object.keys(parent).slice(0, 60) : [], parentPreview: String(parentPreview || '').slice(0, 3500) });
        };
        const scan = (value, path = '', msg = null, parent = null, key = '') => {
          if (hits.length >= 100 || value == null) return;
          const keyHit = wantedKey.test(String(key || ''));
          if (typeof value === 'string') {
            if (keyHit || wantedValue.test(value)) addHit({ path, key, value, msg, parent });
            return;
          }
          if (Array.isArray(value)) { value.forEach((item, index) => scan(item, path + '[' + index + ']', msg, value, String(index))); return; }
          if (typeof value === 'object') {
            if (keyHit) addHit({ path, key, value: '[object]', msg, parent: value });
            Object.entries(value).forEach(([childKey, childValue]) => scan(childValue, path ? path + '.' + childKey : childKey, msg, value, childKey));
          }
        };
        (messages || []).forEach((msg, index) => scan(msg, 'messages[' + index + ']', msg, null, 'message'));
        const result = { messageCount: Array.isArray(messages) ? messages.length : 0, hitsCount: hits.length, hits };
        document.documentElement.setAttribute('data-acep-claude-api-citation-scan', JSON.stringify(result).slice(0, 150000));
      } catch (err) {
        try { document.documentElement.setAttribute('data-acep-claude-api-citation-scan', JSON.stringify({ error: String(err?.message || err) })); } catch {}
      }
    }
    async function fetchApiTurnNodesForCurrentChat(ctx = {}) {
      try {
        if (!env.isClaude || !env.isClaude()) return null;
        const chatId = getChatIdFromUrl();
        if (!chatId) { debugStore('apiScrape', { ok: false, reason: 'no chatId' }); return null; }

        const prevChatId = g.ACEP?.providers?.claude?.__apiChatId;
        const prevTs = Number(g.ACEP?.providers?.claude?.__apiTs || 0);
        const prevNodes = g.ACEP?.providers?.claude?.__apiTurnNodes;
        if (prevChatId === chatId && Array.isArray(prevNodes) && prevNodes.length && (Date.now() - prevTs) < 120000) {
          debugStore('apiScrape', { ok: true, chatId, count: prevNodes.length, cached: true });
          return { chatId, nodes: prevNodes };
        }
        // Throttle failed retries: don't re-fetch within 15s of a previous failure
        const failTs = Number(g.ACEP?.providers?.claude?.__apiFailTs || 0);
        if (failTs && (Date.now() - failTs) < 15000) {
          debugStore('apiScrape', { ok: false, reason: 'throttled_after_failure' });
          return null;
        }

        let orgId = await getOrgIdAsync(1500);
        if (!orgId) {
          try {
            const r = await fetch('https://claude.ai/api/organizations', { credentials: 'include' });
            if (r.ok) {
              const d = await r.json().catch(() => null);
              const arr = Array.isArray(d) ? d : (Array.isArray(d?.organizations) ? d.organizations : []);
              orgId = arr.find(o => o?.uuid)?.uuid || '';
            }
          } catch {}
        }
        if (!orgId) { debugStore('apiScrape', { ok: false, reason: 'no orgId' }); return null; }

        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort('acep-claude-timeout'), 20000);
        let tree, latest;
        try {
          const [treeResp, latestResp] = await Promise.all([
            fetch(`https://claude.ai/api/organizations/${orgId}/chat_conversations/${chatId}?tree=True&rendering_mode=messages&render_all_tools=true`,
              { credentials: 'include', signal: controller.signal }),
            fetch(`https://claude.ai/api/organizations/${orgId}/chat_conversations/${chatId}/latest`,
              { credentials: 'include', signal: controller.signal }),
          ]);
          if (!treeResp.ok) throw new Error(`Claude API HTTP ${treeResp.status}`);
          tree = await treeResp.json().catch(() => null);
          latest = latestResp.ok ? await latestResp.json().catch(() => ({})) : {};
        } finally {
          clearTimeout(timer);
        }
        if (!tree) { debugStore('apiScrape', { ok: false, reason: 'null tree' }); return null; }

        const absolutizeClaudeAssetUrl = (url = '') => {
          const raw = String(url || '').trim();
          if (!raw) return '';
          try { return new URL(raw, location.origin).href; } catch { return raw; }
        };

        const leafId = latest?.current_leaf_message_uuid || tree?.current_leaf_message_uuid || '';
        const messages = pruneMessagesToLeaf(tree, leafId);
        debugScanClaudeApiCitations(messages);
        if (!messages.length) { debugStore('apiScrape', { ok: false, reason: 'no messages' }); return null; }
        try {
          const requested = String(document.documentElement.getAttribute('data-acep-claude-debug-id') || '').trim();
          if (requested === 'messages-summary') {
            const summary = messages.slice(0, 24).map((msg, idx) => {
              const sender = String(msg?.sender || msg?.role || '');
              const content = Array.isArray(msg?.content) ? msg.content : [];
              const files = Array.isArray(msg?.files) ? msg.files : [];
              const contentTypes = content.map((p) => String(p?.type || '')).filter(Boolean).slice(0, 6).join('|');
              const textLen = content
                .filter((p) => p?.type === 'text' && p?.text)
                .reduce((sum, p) => sum + String(p.text || '').length, 0);
              const fileKinds = files.map((f) => String(f?.file_kind || f?.file_type || '')).filter(Boolean).slice(0, 4).join('|');
              return `${idx}:${sender}:t${textLen}:f${files.length}:${fileKinds}:c${contentTypes}`;
            }).join(' || ');
            debugStore('messages_summary', summary);
          }
        } catch {}

        const artifacts = parseArtifactsFromMessages(messages);
        const artifactQueuesById = new Map();
        artifacts.forEach(a => {
          if (!a?.id) return;
          const key = String(a.id);
          const queue = artifactQueuesById.get(key) || [];
          queue.push(a);
          artifactQueuesById.set(key, queue);
        });

        const nodes = [];
        let emittedFirstPastedDebug = false;
        const seenApiImageSrcs = new Set();
        const getClaudeMessageFiles = (msg) => {
          const out = [];
          const seen = new Set();
          const add = (file) => {
            if (!file) return;
            const key = String(file.file_uuid || file.uuid || file.file_name || JSON.stringify(file)).trim();
            if (key && seen.has(key)) return;
            if (key) seen.add(key);
            out.push(file);
          };
          const addArray = (value) => {
            try { (Array.isArray(value) ? value : []).forEach(add); } catch {}
          };
          try { (Array.isArray(msg?.files_v2) ? msg.files_v2 : []).forEach(add); } catch {}
          try { (Array.isArray(msg?.files) ? msg.files : []).forEach(add); } catch {}
          addArray(msg?.attachments);
          addArray(msg?.attachments_v2);
          addArray(msg?.uploaded_files);
          addArray(msg?.file_attachments);
          addArray(msg?.files_metadata);
          return out;
        };
        const getClaudeImageFileSrc = (file) => absolutizeClaudeAssetUrl(
          file?.preview_url || file?.url || file?.download_url || file?.thumbnail_url ||
          (file?.file_uuid ? `/api/${orgId}/files/${file.file_uuid}/preview` : '')
        );
        const isClaudeImageFile = (file) => {
          const kind = String(file?.file_kind || '').toLowerCase();
          const type = String(file?.file_type || file?.mime_type || file?.content_type || '').toLowerCase();
          const name = String(file?.file_name || file?.name || '').toLowerCase();
          const hasImageAsset = !!(file?.preview_asset || file?.thumbnail_asset || file?.image_asset || file?.image_asset_pointer);
          const hasPreview = !!(file?.preview_url || file?.thumbnail_url || file?.download_url || file?.url);
          return kind === 'image'
            || /^image\//i.test(type)
            || /\.(png|jpe?g|gif|webp|svg|bmp|avif)(?:[?#].*)?$/i.test(name)
            || hasImageAsset
            || (hasPreview && /image|png|jpe?g|gif|webp|svg|bmp|avif/i.test(`${kind} ${type} ${name}`));
        };
        const allClaudeFiles = [];
        try { messages.forEach((m) => allClaudeFiles.push(...getClaudeMessageFiles(m))); } catch {}
        const claudeFileByUuid = new Map();
        try {
          allClaudeFiles.forEach((file) => {
            const uuid = String(file?.file_uuid || file?.uuid || '').trim();
            if (uuid && !claudeFileByUuid.has(uuid)) claudeFileByUuid.set(uuid, file);
          });
        } catch {}
        const findClaudeImageFile = (msg, fileUuid = '') => {
          const uuid = String(fileUuid || '').trim();
          if (!uuid) return null;
          return getClaudeMessageFiles(msg).find((file) => String(file?.file_uuid || file?.uuid || '').trim() === uuid)
            || claudeFileByUuid.get(uuid)
            || null;
        };
        const scanClaudeImageRefs = (value, msg, imgs, depth = 0) => {
          try {
            if (!value || depth > 5) return;
            if (Array.isArray(value)) {
              value.forEach((item) => scanClaudeImageRefs(item, msg, imgs, depth + 1));
              return;
            }
            if (typeof value !== 'object') return;
            const fileUuid = String(value.file_uuid || value.uuid || value.image_asset_pointer || '').trim();
            const directUrl = value.preview_url || value.url || value.download_url || value.thumbnail_url || '';
            const looksImage = value.type === 'image' || value.file_kind === 'image' || isClaudeImageFile(value);
            if (fileUuid) {
              const file = findClaudeImageFile(msg, fileUuid);
              if (file && isClaudeImageFile(file)) {
                const src = getClaudeImageFileSrc(file);
                if (src) addApiImage(imgs, { src, originalSrc: src, alt: file?.file_name || value.file_name || 'Claude image' });
              }
            } else if (looksImage && directUrl) {
              const src = absolutizeClaudeAssetUrl(directUrl);
              if (src && (/\/files\/[^/]+\/(?:preview|thumbnail)\b/i.test(src) || /^data:image\//i.test(src) || /\.(png|jpe?g|gif|webp|svg|bmp|avif)(?:[?#]|$)/i.test(src))) {
                addApiImage(imgs, { src, originalSrc: src, alt: value.file_name || value.name || 'Claude image' });
              }
            }
            Object.keys(value).forEach((key) => {
              if (/^(text|content|widget_code|code|html|svg)$/i.test(key) && typeof value[key] === 'string') return;
              scanClaudeImageRefs(value[key], msg, imgs, depth + 1);
            });
          } catch {}
        };
        const addApiImage = (imgs, image = {}) => {
          const src = String(image?.src || image?.originalSrc || '').trim();
          if (!src || seenApiImageSrcs.has(src)) return;
          seenApiImageSrcs.add(src);
          imgs.push({ ...image, src, originalSrc: String(image?.originalSrc || src) });
        };
        for (const msg of messages) {
          const senderRaw = String(msg?.sender || msg?.role || '').toLowerCase();
          if (senderRaw === 'system') continue;
          const role = (senderRaw === 'human' || senderRaw === 'user') ? 'user' : 'assistant';
          const turnId = String(msg?.uuid || '');
          const content = Array.isArray(msg?.content) ? msg.content : [];

          const textParts = [];
          const imgs = [];
          const artifactHtmlParts = [];
          const htmlParts = [];

          for (const part of content) {
            if (!part) continue;
            if (part.type === 'text' && part.text) {
              const textPart = String(part.text);
              textParts.push(textPart);
              if (role !== 'user') {
                const textHtml = renderClaudeTextPartWithApiCitations(part);
                if (textHtml) htmlParts.push(textHtml);
              }
            } else if (part.type === 'image') {
              const src = part?.source;
              if (src?.type === 'base64' && src?.data && src?.media_type) {
                const dataUri = `data:${src.media_type};base64,${src.data}`;
                addApiImage(imgs, { src: dataUri, originalSrc: dataUri, alt: 'uploaded image' });
              } else if (src?.type === 'url' && src?.url) {
                const imageUrl = absolutizeClaudeAssetUrl(src.url);
                addApiImage(imgs, { src: imageUrl, originalSrc: imageUrl, alt: 'image' });
              } else if (part?.file_uuid) {
                const file = findClaudeImageFile(msg, part.file_uuid);
                const imageUrl = file ? getClaudeImageFileSrc(file) : '';
                if (imageUrl) addApiImage(imgs, { src: imageUrl, originalSrc: imageUrl, alt: file?.file_name || part.file_name || 'Claude image' });
              }
            } else if (part.type === 'tool_result' && Array.isArray(part.content)) {
              for (const item of part.content) {
                if (item?.type !== 'image') continue;
                const file = findClaudeImageFile(msg, item.file_uuid);
                const imageUrl = file ? getClaudeImageFileSrc(file) : absolutizeClaudeAssetUrl(item.url || item.preview_url || '');
                if (imageUrl) addApiImage(imgs, { src: imageUrl, originalSrc: imageUrl, alt: file?.file_name || item.file_name || 'Claude image' });
              }
            } else if (part.type === 'tool_use') {
              const input = part.input || {};
              const artifactId = input.id || part.id || part.tool_use_id || '';
              const inlineContent = input.content || input.new_str || input.widget_code || input.code || input.html || input.svg || '';
              if (!artifactId) continue;
              const artifactQueue = artifactQueuesById.get(String(artifactId)) || [];
              const queuedArtifact = artifactQueue.length ? artifactQueue.shift() : null;
              // Look up the next pre-parsed artifact occurrence; fall back to inline content on the tool_use input itself.
              const art = queuedArtifact || (inlineContent
                ? { id: artifactId, title: input.title || part.name || '', type: input.type || '',
                    language: input.language || '', content: String(inlineContent || '') }
                : null);
              if (art?.content) {
                const lang = art.language || art.type || '';
                const title = art.title || artifactId || part.name || 'Claude visualization';
                const esc = escapeHtmlApi;
                const renderedArtifact = renderClaudeArtifactBodyHtml(art.content);
                const isVisualizerWidget = String(part.name || '').startsWith('visualize:') || !!input.widget_code;
                const artifactHtmlAttrs = renderedArtifact
                  ? ` data-acep-artifact-html="${esc(renderedArtifact)}" data-acep-artifact-is-code="0"`
                  : '';
                const artifactHtml =
                  `<div class="acep-artifact" data-acep-artifact-id="${esc(art.id)}" data-acep-artifact-title="${esc(title)}"${artifactHtmlAttrs}>` +
                  `<div class="acep-artifact-header">${esc(title)}${lang ? ` <span class="acep-artifact-lang">(${esc(lang)})</span>` : ''}</div>` +
                  (renderedArtifact || `<pre><code${lang ? ` class="language-${esc(lang)}"` : ''}>${esc(art.content)}</code></pre>`) +
                  `</div>`;
                artifactHtmlParts.push(artifactHtml);
                htmlParts.push(artifactHtml);
              }
            }
            scanClaudeImageRefs(part, msg, imgs, 0);
          }
          // Do not attach parsed artifacts by assistant order. Claude visual/tool media must be attached
          // only from the current API message to avoid wrong-position duplicates.

          let hasPastedFile = false;
          let hasNonImageFile = false;
          const messageFiles = getClaudeMessageFiles(msg);
          // Also check msg.files_v2/msg.files for uploaded/generated images and pasted text blobs.
          if (messageFiles.length) {
            for (const f of messageFiles) {
              if (isClaudeImageFile(f)) {
                const src = getClaudeImageFileSrc(f);
                if (src) addApiImage(imgs, { src, originalSrc: src, alt: f?.file_name || 'Claude image' });
              } else if (role === 'user') {
                hasNonImageFile = true;
                hasPastedFile = true;
              }
            }
          }
          const hasAnyFiles = messageFiles.length > 0;
          const hasUnknownContentPart = content.some((part) => {
            const t = String(part?.type || '').toLowerCase();
            return !!t && !['text', 'image', 'tool_use'].includes(t);
          });
          if (role === 'user' && (hasPastedFile || hasNonImageFile || hasUnknownContentPart)) hasPastedFile = true;
          const looksLikePastedCandidate = role === 'user' && (hasPastedFile || hasAnyFiles || hasUnknownContentPart);
          if (looksLikePastedCandidate) {
            debugClaudePastedApiMessage(msg, { turnId, isFirstPasted: !emittedFirstPastedDebug });
            emittedFirstPastedDebug = true;
          }

          const rawText = (role === 'user'
            ? normalizeClaudeUserText(textParts.join('\n\n'))
            : textParts.join('\n\n')).trim();
          const pastedPlaceholderHtml = role === 'user' && hasPastedFile
            ? '<p>{Pasted Content}</p>'
            : '';
          const textHtml = rawText ? markdownToHtmlClaude(rawText) : '';
          const orderedAssistantHtml = htmlParts.length ? htmlParts.join('') : textHtml;
          const html = (role === 'user' ? textHtml : orderedAssistantHtml) + pastedPlaceholderHtml;
          const needsDomFallback = false;
          if (!html && !imgs.length && !needsDomFallback) continue;
          nodes.push(buildApiTurnNode({ role, html, imgs, turnId, hasArtifact: artifactHtmlParts.length > 0, needsDomFallback, hasPastedFile }));
        }

        debugStore('apiScrape', { ok: true, chatId, orgId, count: nodes.length });
        return { chatId, nodes };
      } catch (e) {
        try { g.ACEP.providers.claude.__apiFailTs = Date.now(); } catch {}
        debugStore('apiScrape', { ok: false, err: String(e?.message || e) });
        return null;
      }
    }

    function getTurnsForExport() {
      try {
        if (g.ACEP?.providers?.claude?.__apiFailed) {
          try {
            debugStore('turns_for_export', {
              apiCount: 0,
              domCount: 0,
              mergedCount: 0,
              domFallbackSkipped: true,
              reason: 'api-failed',
            });
          } catch {}
          return [];
        }
        const apiNodes = g.ACEP?.providers?.claude?.__apiTurnNodes;
        if (Array.isArray(apiNodes) && apiNodes.length) {
          const forceDomMerge = String(g.ACEP?.providers?.claude?.__forceDomPastedMerge || '') === '1';
          if (!forceDomMerge) {
            try {
              debugStore('turns_for_export', {
                apiCount: apiNodes.length,
                domCount: 0,
                mergedCount: apiNodes.length,
                domMergeSkipped: true,
                reason: 'api-first-fastpath',
              });
            } catch {}
            return apiNodes;
          }
          const domTurns = extractSelectableTurnNodes();
          if (!Array.isArray(domTurns) || !domTurns.length) return apiNodes;
          const merged = [];
          let apiIdx = 0;
          const thumbSel = sel.thumbRoot || '[data-testid="file-thumbnail"], .group\\/thumbnail, [class*="group/thumbnail" i]';
          const buildClaudeDomPastedPlaceholderTurn = (domTurn) => {
            try {
              const turn = buildApiTurnNode({
                role: 'user',
                html: '<p>{Pasted Content}</p>',
                imgs: [],
                turnId: '',
                hasArtifact: false,
                needsDomFallback: false,
                hasPastedFile: true,
              });
              try { turn.setAttribute('data-acep-from-dom-pasted', '1'); } catch {}
              return turn;
            } catch {
              return null;
            }
          };
          const isPastedDomUser = (turn) => {
            try {
              const role = String(turn?.getAttribute?.('data-acep-role') || roleFromTurn(turn) || '');
              if (role !== 'user') return false;
              if (turn?.matches?.('[data-acep-full], .acep-pasted-text, .acep-pasted-content')) return true;
              if (turn?.querySelector?.('[data-acep-full], .acep-pasted-text, .acep-pasted-content')) return true;
              if (turn?.matches?.(thumbSel)) return true;
              if (turn?.querySelector?.(thumbSel)) return true;
              return false;
            } catch {
              return false;
            }
          };
          const isPastedOnlyDomUser = (turn) => {
            try {
              if (!isPastedDomUser(turn)) return false;
              const hasUserMsg = !!turn?.querySelector?.(sel.userMessage || '[data-testid="user-message"]');
              return !hasUserMsg;
            } catch {
              return false;
            }
          };
          const apiRoleOf = (turn) => String(turn?.getAttribute?.('data-acep-role') || '');
          const ensureApiPastedPlaceholder = (apiTurn) => {
            try {
              const contentEl = apiTurn?.querySelector?.('.acep-api-content') || apiTurn;
              if (!contentEl || contentEl.querySelector?.('.acep-pasted-content-placeholder')) return;
              if (/\{Pasted Content\}/i.test(String(contentEl.innerText || contentEl.textContent || ''))) return;
              const placeholder = document.createElement('p');
              placeholder.className = 'acep-pasted-content-placeholder';
              placeholder.textContent = '{Pasted Content}';
              contentEl.appendChild(placeholder);
              try { apiTurn.setAttribute('data-acep-has-pasted-file', '1'); } catch {}
            } catch {}
          };

          for (const domTurn of domTurns) {
            const domRole = String(domTurn?.getAttribute?.('data-acep-role') || roleFromTurn(domTurn) || '');
            const apiTurn = apiNodes[apiIdx] || null;
            const apiRole = apiRoleOf(apiTurn);
            if (apiTurn && apiRole === domRole) {
              if (domRole === 'user' && isPastedDomUser(domTurn)) ensureApiPastedPlaceholder(apiTurn);
              merged.push(apiTurn);
              apiIdx++;
              continue;
            }
            if (apiTurn && isPastedOnlyDomUser(domTurn)) {
              const placeholderTurn = buildClaudeDomPastedPlaceholderTurn(domTurn);
              if (placeholderTurn) merged.push(placeholderTurn);
            }
          }
          while (apiIdx < apiNodes.length) merged.push(apiNodes[apiIdx++]);
          try {
            debugStore('turns_for_export', {
              apiCount: apiNodes.length,
              domCount: domTurns.length,
              mergedCount: merged.length,
              sample: merged.slice(0, 8).map((t) => ({
                role: String(t?.getAttribute?.('data-acep-role') || ''),
                api: String(t?.getAttribute?.('data-acep-from-api') || ''),
                pasted: !!t?.querySelector?.('[data-testid="file-thumbnail"], [data-acep-full], .acep-pasted-text, .acep-pasted-content'),
              })),
            });
          } catch {}
          return merged.length ? merged : apiNodes;
        }
      } catch {}
      const domOnly = extractSelectableTurnNodes();
      try {
        debugStore('turns_for_export', {
          apiCount: 0,
          domCount: domOnly.length,
          mergedCount: domOnly.length,
          sample: domOnly.slice(0, 8).map((t) => ({
            role: String(t?.getAttribute?.('data-acep-role') || ''),
            api: String(t?.getAttribute?.('data-acep-from-api') || ''),
            pasted: !!t?.querySelector?.('[data-testid="file-thumbnail"], [data-acep-full], .acep-pasted-text, .acep-pasted-content'),
          })),
        });
      } catch {}
      return domOnly;
    }

    function getCapturedPastedThumbGroups() {
      try {
        const container = getThreadContainer();
        if (!container) return [];
        const thumbSel = sel.thumbRoot || '[data-testid="file-thumbnail"], .group\\/thumbnail, [class*="group/thumbnail" i]';
        const readThumbText = (thumb) => {
          try {
            const full = String(thumb?.getAttribute?.('data-acep-full') || '').trim();
            if (full) return full;
            return getClaudeThumbPreviewText(thumb);
          } catch {
            return '';
          }
        };
        const turnRoots = extractSelectableTurnNodes().filter((n) => String(n?.getAttribute?.('data-acep-role') || '') === 'user');
        const turnEntries = turnRoots.map((root) => {
          const thumbs = [
            ...(root?.matches?.(thumbSel) ? [root] : []),
            ...Array.from(root.querySelectorAll?.(thumbSel) || [])
          ]
            .map((th) => readThumbText(th))
            .filter(Boolean);
          return { anchor: root, texts: thumbs };
        }).filter((entry) => entry.texts.length);

        const orphanEntries = Array.from(container.querySelectorAll(thumbSel))
          .filter((thumb) => !turnRoots.some((root) => root === thumb || root.contains?.(thumb)))
          .map((thumb) => ({ anchor: thumb, texts: [readThumbText(thumb)].filter(Boolean) }))
          .filter((entry) => entry.texts.length);

        return turnEntries.concat(orphanEntries).sort((a, b) => {
          if (a.anchor === b.anchor) return 0;
          const pos = a.anchor.compareDocumentPosition(b.anchor);
          if (pos & Node.DOCUMENT_POSITION_FOLLOWING) return -1;
          if (pos & Node.DOCUMENT_POSITION_PRECEDING) return 1;
          return 0;
        });
      } catch {
        return [];
      }
    }

    // Provider API: innerHTMLFromTurn - extract HTML content from turn
    function normalizeClaudeListsForExport(root) {
      try {
        if (!root || !root.querySelectorAll) return 0;
        let changed = 0;
        const hardenList = (list) => {
          try {
            const tag = String(list.tagName || '').toUpperCase();
            if (tag !== 'UL' && tag !== 'OL') return;
            const cls = String(list.getAttribute('class') || '')
              .split(/\s+/)
              .filter(Boolean)
              .filter((token) => !/^(flex|inline-flex|grid|list-none|list-decimal|list-disc|flex-col|gap-\d+|pl-\d+|mb-\d+|mt-\d+|pb-\d+|\[.*\])$/i.test(token))
              .join(' ');
            if (cls) list.setAttribute('class', cls); else list.removeAttribute('class');
            list.style.display = 'block';
            list.style.listStyleType = tag === 'OL' ? 'decimal' : 'disc';
            list.style.listStylePosition = 'outside';
            list.style.paddingLeft = '1.6em';
            list.style.margin = '0.75em 0';
            changed++;
          } catch {}
        };
        Array.from(root.querySelectorAll('ul, ol')).forEach(hardenList);
        Array.from(root.querySelectorAll('li')).forEach((li) => {
          try {
            const cls = String(li.getAttribute('class') || '')
              .split(/\s+/)
              .filter(Boolean)
              .filter((token) => !/^(flex|inline-flex|grid|list-none|pl-\d+|mb-\d+|mt-\d+|gap-\d+|\[.*\])$/i.test(token))
              .join(' ');
            if (cls) li.setAttribute('class', cls); else li.removeAttribute('class');
            li.style.display = 'list-item';
            li.style.paddingLeft = '0.25em';
            li.style.margin = '0.25em 0';
            changed++;
          } catch {}
        });
        Array.from(root.querySelectorAll('p, div')).forEach((el) => {
          try {
            if (el.querySelector?.('ul, ol, table, pre, code')) return;
            const raw = String(el.innerText || el.textContent || '').replace(/\r\n/g, '\n').trim();
            if (!raw || !/^(?:[-*+\u2022]\s+|\d+\.\s+)/m.test(raw)) return;
            const lines = raw.split('\n').map((line) => line.trim()).filter(Boolean);
            if (lines.length < 2) return;
            const unordered = lines.every((line) => /^[-*+\u2022]\s+/.test(line));
            const ordered = lines.every((line) => /^\d+\.\s+/.test(line));
            if (!unordered && !ordered) return;
            const doc = el.ownerDocument || document;
            const list = doc.createElement(ordered ? 'ol' : 'ul');
            lines.forEach((line) => {
              const item = doc.createElement('li');
              item.textContent = line.replace(ordered ? /^\d+\.\s+/ : /^[-*+\u2022]\s+/, '').trim();
              list.appendChild(item);
            });
            el.replaceWith(list);
            hardenList(list);
            changed++;
          } catch {}
        });
        try { document.documentElement.setAttribute('data-acep-claude-list-normalized', String(changed)); } catch {}
        return changed;
      } catch {
        return 0;
      }
    }

    function normalizeClaudeCodeBlocksForExport(root) {
      try {
        if (!root || !root.querySelectorAll) return 0;
        let changed = 0;
        const stylePre = (pre) => {
          try {
            if (!pre || !pre.setAttribute) return false;
            pre.className = 'acep-code-block';
            pre.setAttribute('data-acep-code-block', '1');
            pre.setAttribute('style', 'background:#f3f4f6 !important;color:#0f172a !important;border:1px solid #e5e7eb !important;border-radius:10px !important;padding:14px 16px !important;display:block !important;box-sizing:border-box !important;max-width:100% !important;overflow-x:auto !important;white-space:pre !important;font-family:"Fira Code","Cascadia Code",Consolas,"Courier New",monospace !important;font-size:0.88em !important;line-height:1.6 !important;margin:12px 0 !important;');
            const code = pre.querySelector?.('code');
            if (code) {
              code.setAttribute('style', 'background:transparent !important;color:inherit !important;padding:0 !important;border:0 !important;display:block !important;white-space:pre !important;font-family:inherit !important;');
            }
            return true;
          } catch {
            return false;
          }
        };
        const normalizeWrapper = (wrapper) => {
          try {
            if (!wrapper || !wrapper.querySelector) return;
            const pre = wrapper.matches?.('pre') ? wrapper : wrapper.querySelector('pre');
            if (!pre || pre.getAttribute?.('data-acep-code-block') === '1') return;
            try { wrapper.querySelectorAll?.('button,.sticky,[aria-label*="Copy" i]').forEach((node) => node.remove()); } catch {}
            if (!stylePre(pre)) return;
            if (wrapper !== pre && wrapper.parentNode) wrapper.replaceWith(pre);
            changed++;
          } catch {}
        };
        Array.from(root.querySelectorAll('[role="group"][aria-label*="code" i], [aria-label*="markdown code" i]')).forEach(normalizeWrapper);
        Array.from(root.querySelectorAll('pre.code-block__code, pre[class*="code-block"]')).forEach(normalizeWrapper);
        try { document.documentElement.setAttribute('data-acep-claude-code-normalized', String(changed)); } catch {}
        return changed;
      } catch {
        return 0;
      }
    }
    function innerHTMLFromTurn(turn) {
      try {
        if (turn?.getAttribute?.('data-acep-from-api') === '1') {
          const c = turn.querySelector?.('.acep-api-content');
          try { normalizeClaudeCodeBlocksForExport(c || turn); } catch {}
          try { normalizeClaudeListsForExport(c || turn); } catch {}
          return c ? (c.innerHTML || '') : (turn.innerHTML || '');
        }
        if (!turn || !turn.cloneNode) return (turn && turn.innerHTML) ? String(turn.innerHTML) : '';
        const clone = turn.cloneNode(true);
        try {
          clone.querySelectorAll('h2.sr-only, [data-find-omitted], .sr-only, .avr-play-btn').forEach(node => {
            try { node.remove(); } catch {}
          });
          clone.querySelectorAll('[data-avr-injected="1"], .avr-response-wrap').forEach(node => {
            try {
              const parent = node.parentNode;
              if (!parent) return;
              while (node.firstChild) parent.insertBefore(node.firstChild, node);
              node.remove();
            } catch {}
          });
        } catch {}
        const isUserTurn = String(turn?.getAttribute?.('data-acep-role') || roleFromTurn(turn) || '').toLowerCase() === 'user';
        const pastedThumbSel = sel.thumbRoot || '[data-testid="file-thumbnail"], .group\\/thumbnail, [class*="group/thumbnail" i]';
        const hasPastedThumb = isUserTurn && !!clone.querySelector?.(pastedThumbSel);

        // 1. Remove Claude UI controls (message actions, timestamps, thinking headers)
        try {
          clone.querySelectorAll('[data-testid="message-actions"], button[aria-label="Copy"]').forEach((n) => {
            try { n.remove(); } catch {}
          });
        } catch {}
        try {
          clone.querySelectorAll('[aria-label="Message actions"], [role="group"][aria-label="Message actions"]').forEach((n) => {
            try { n.remove(); } catch {}
          });
        } catch {}
        // Remove small timestamp chips like "Feb 16" / "Dec 2, 2025" that Claude renders under user prompts.
        try {
          const isDateChip = (s = '') => {
            const t = String(s || '').replace(/\s+/g, ' ').trim();
            if (!t) return false;
            if (/^(today|yesterday|tomorrow)$/i.test(t)) return true;
            // e.g. "Feb 16", "Feb 16, 2026"
            if (/^(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)\s+\d{1,2}(,\s*\d{4})?$/i.test(t)) return true;
            // e.g. "Dec 2, 2025"
            if (/^(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)\s+\d{1,2},\s*\d{4}$/i.test(t)) return true;
            return false;
          };
          Array.from(clone.querySelectorAll('span, div, p')).forEach((el) => {
            try {
              const cls = String(el.className || '');
              if (!/(text-xs|text-sm|text-text-500|text-text-400)/i.test(cls)) return;
              const txt = (el.textContent || '').trim();
              if (isDateChip(txt)) el.remove();
            } catch {}
          });
        } catch {}

        // Remove Claude "thinking" blocks / collapsed thought UI
        try {
          const thoughtBlocks = Array.from(clone.querySelectorAll('div.ease-out.transition-all'))
            .filter(b =>
              b.querySelector('button[class*="group/row" i]') &&
              b.querySelector('div[style*="height: 0"], div[style*="opacity: 0"], div[style*="opacity:0"]') &&
              b.querySelector('.standard-markdown, .progressive-markdown')
            );
          thoughtBlocks.forEach(b => { try { b.remove(); } catch {} });
        } catch {}
        // Remove "status/thinking" header rows
        try {
          const statusBtnSel = 'button[class*="group/status" i]';
          Array.from(clone.querySelectorAll(statusBtnSel)).forEach((btn) => {
            try {
              const row = btn.closest('.row-start-1,[class*="row-start-1" i]');
              if (row) { row.remove(); return; }
              let wrap = btn.parentElement;
              while (wrap && wrap !== clone) {
                const hasMd = !!(wrap.querySelector && wrap.querySelector('.standard-markdown, .progressive-markdown, .markdown, .font-claude-response'));
                if (!hasMd) { wrap.remove(); return; }
                wrap = wrap.parentElement;
              }
              btn.remove();
            } catch {
              try { btn.remove(); } catch {}
            }
          });
          Array.from(clone.querySelectorAll('span.truncate.text-sm.font-base')).forEach((s) => {
            try {
              const inStatus = !!(s.closest && s.closest('button[class*="group/status" i]'));
              if (inStatus) { s.remove(); return; }
              const row = s.closest && s.closest('.row-start-1,[class*="row-start-1" i]');
              const hasStatusButton = !!(row && row.querySelector && row.querySelector('button[class*="group/status" i]'));
              if (hasStatusButton) s.remove();
            } catch {}
          });
        } catch {}

        // 2. Unwrap User uploaded images and absolutize URLs (P0-2)
        try {
          // Identify image containers by filename attributes or extensions from the DOM snippet
          const imgLike = clone.querySelectorAll('img, [data-testid*="screenshot" i], [data-testid$=".png" i], [data-testid$=".jpg" i], [data-testid$=".jpeg" i], [data-testid$=".webp" i]');
          imgLike.forEach(el => {
            // Find all images within this suspected container
            const imgs = el.tagName === 'IMG' ? [el] : Array.from(el.querySelectorAll('img'));
            imgs.forEach(img => {
              // 2a. Absolutize URL (Relative URLs like /api/.../preview fail in extension context)
              try {
                const s = img.getAttribute('src');
                if (s && s.startsWith('/')) {
                  img.setAttribute('src', new URL(s, location.origin).href);
                }
              } catch {}
              
              const isFixedThumbWrapper = (node) => {
                try {
                  if (!node || !node.getAttribute) return false;
                  const st = String(node.getAttribute('style') || '');
                  if (!st) return false;
                  const mw = st.match(/(?:^|;)\s*width\s*:\s*(\d+)px/i);
                  const mh = st.match(/(?:^|;)\s*height\s*:\s*(\d+)px/i);
                  const w = mw ? parseInt(mw[1], 10) : 0;
                  const h = mh ? parseInt(mh[1], 10) : 0;
                  const m = Math.max(w || 0, h || 0);
                  return m > 0 && m <= 420;
                } catch {
                  return false;
                }
              };

              // 2b. Unwrap from fixed-size thumbnail wrappers if nested.
              const btn = img.closest('button, [role="button"]');
              let replaceTarget = btn || img;
              try {
                const thumbSel = sel.thumbRoot || '[data-testid="file-thumbnail"], .group\\/thumbnail, [class*="group/thumbnail" i]';
                let p = replaceTarget;
                for (let i = 0; i < 7 && p && p.parentElement; i++) {
                  if (p.matches?.(thumbSel) || isFixedThumbWrapper(p)) replaceTarget = p;
                  p = p.parentElement;
                }
              } catch {}

              if (replaceTarget && replaceTarget.parentNode) {
                const newDiv = document.createElement('div');
                newDiv.className = 'acep-image-wrap';
                const imgClone = img.cloneNode(true);
                try { imgClone.setAttribute('data-acep-claude-upload', '1'); } catch {}
                newDiv.appendChild(imgClone);
                try { replaceTarget.parentNode.replaceChild(newDiv, replaceTarget); } catch {}
              } else if (img.parentElement) {
                // If not in a button, mark the parent for preservation
                img.parentElement.classList.add('acep-image-wrap');
                try { img.setAttribute('data-acep-claude-upload', '1'); } catch {}
              }
            });
          });
        } catch {}

        // 3. Replace pasted content with a privacy-safe placeholder.
        try {
          if (hasPastedThumb) {
            clone.querySelectorAll(pastedThumbSel).forEach(node => {
              try { node.remove(); } catch {}
            });
            const placeholder = document.createElement('p');
            placeholder.className = 'acep-pasted-content-placeholder';
            placeholder.textContent = '{Pasted Content}';
            clone.appendChild(placeholder);
          }
          clone.querySelectorAll('[data-acep-full]').forEach(node => {
            if (hasPastedThumb) {
              try { node.removeAttribute('data-acep-full'); } catch {}
              return;
            }
            const txt = node.getAttribute('data-acep-full');
            if (txt) {
              const pre = document.createElement('pre');
              pre.className = 'acep-pasted-text';
              pre.textContent = txt;
              pre.style.whiteSpace = 'pre-wrap';
              pre.style.background = '#f3f4f6';
              pre.style.padding = '8px';
              pre.style.borderRadius = '6px';
              pre.style.marginTop = '8px';
              if (node.parentNode) node.parentNode.insertBefore(pre, node);

              // Remove the tiny "preview snippet" text from the thumbnail card to avoid duplicating
              // the first few lines in DOCX (the preview is usually a line-clamped <p>).
              try {
                const thumbSel = sel.thumbRoot || '[data-testid="file-thumbnail"], .group\\/thumbnail, [class*="group/thumbnail" i]';
                const thumbRoot = node.closest?.(thumbSel);
                if (thumbRoot && thumbRoot.querySelectorAll) {
                  // Most common: p.break-all.line-clamp-[6] with text-[8px]
                  const previewPs = Array.from(thumbRoot.querySelectorAll('p'))
                    .filter(p => {
                      const cls = String(p.className || '');
                      if (!cls) return false;
                      if (/\bbreak-all\b/i.test(cls)) return true;
                      if (/line-clamp/i.test(cls)) return true;
                      if (/text-\[8px\]/i.test(cls)) return true;
                      return false;
                    });
                  previewPs.forEach(p => { try { p.remove(); } catch {} });
                }
              } catch {}
            }
          });
        } catch {}

        // 4. Extract markdown content for assistant responses
        // Append generated file links and artifacts that sit outside the text container (P0-4, P0-5)
        const content = clone.querySelector('.font-claude-response, .standard-markdown, .progressive-markdown, .markdown, [class*="markdown" i]');
        if (content) {
          try {
            clone.querySelectorAll('.artifact-block-cell, [class*="group/artifact-block" i]').forEach((cell) => {
              try {
                const replacement = buildClaudeGeneratedFileCardFromCell(cell);
                if (replacement && cell.parentNode) cell.parentNode.replaceChild(replacement, cell);
              } catch {}
            });
            clone.querySelectorAll('#vis-container').forEach((node) => {
              try { node.classList.add('acep-visual-wrap'); } catch {}
            });
            try {
              const visualHtml = collectClaudeVisualizationHtmlDeep(turn || clone) || collectClaudeVisualizationHtmlDeep(clone);
              if (visualHtml) {
                const tmp = document.createElement('div');
                tmp.innerHTML = visualHtml;
                while (tmp.firstChild) content.appendChild(tmp.firstChild);
              }
            } catch {}
            clone.querySelectorAll('iframe[src*="claudemcpcontent.com/mcp_apps" i], .acep-mcp-frame-wrap').forEach((node) => {
              try { node.remove(); } catch {}
            });
            // Include images, pasted text, generated file cards, artifacts, and substantial inline SVGs.
            const svgToKeep = Array.from(clone.querySelectorAll('svg')).filter((svg) => {
              try {
                if (svg.closest?.('button, [data-testid="message-actions"], [aria-label="Message actions"]')) return false;
                const hasTitle = !!svg.querySelector?.('title, desc');
                const role = String(svg.getAttribute?.('role') || '').toLowerCase();
                const viewBox = String(svg.getAttribute?.('viewBox') || '').trim();
                const width = String(svg.getAttribute?.('width') || '').trim();
                return hasTitle || role === 'img' || (viewBox && (width === '100%' || Number.parseInt(width, 10) >= 240));
              } catch {
                return false;
              }
            });
            svgToKeep.forEach((svg) => {
              try {
                const svgImgHtml = claudeSvgToImageHtml(svg.outerHTML || '');
                const safeNode = svgImgHtml ? (() => {
                  const tmp = document.createElement('div');
                  tmp.innerHTML = svgImgHtml;
                  return tmp.firstElementChild;
                })() : null;
                if (safeNode && svg.parentNode) svg.parentNode.replaceChild(safeNode, svg);
              } catch {}
            });
            const cardsToKeep = clone.querySelectorAll('.acep-image-wrap, .acep-pasted-text, .acep-pasted-content-placeholder, .acep-svg-wrap, .acep-visual-wrap, #vis-container, .acep-chat-export-wrap, .acep-chat-export, .acep-artifact, [data-acep-generated-file], .artifact-block-cell');
            cardsToKeep.forEach(el => {
              if (!content.contains(el)) {
                el.style.marginTop = '12px';
                content.appendChild(el);
              }
            });
          } catch {}
          try { normalizeClaudeCodeBlocksForExport(content); } catch {}
          try { normalizeClaudeListsForExport(content); } catch {}
          const html = content.innerHTML || '';
          if (html.trim()) return html;
        }

        // 5. Fallback: return entire cloned content

        try { normalizeClaudeCodeBlocksForExport(clone); } catch {}
        try { normalizeClaudeListsForExport(clone); } catch {}

        return clone.innerHTML || '';
      } catch {
        return (turn && turn.innerHTML) ? String(turn.innerHTML) : '';
      }
    }

    // Provider API: getChatTitle - get conversation title
    function getChatTitle() {
      try {
        // Claude: prefer the chat title button in header
        const btn = document.querySelector('button[data-testid="chat-title-button"]');
        if (btn) {
          const titleEl = btn.querySelector('.truncate');
          const title = (titleEl?.textContent || btn?.textContent || '').trim();
          if (title && title.length > 0) return title.replace(/\s+/g, ' ').trim();
        }
        // Fallback: first h1 in header
        const h1 = document.querySelector('header h1, [data-testid="conversation-title"]');
        if (h1 && h1.textContent) return h1.textContent.trim().replace(/\s+/g, ' ');
        // Last resort: document title
        return (document.title || 'AI Conversation').trim();
      } catch {
        return (document.title || 'AI Conversation').trim();
      }
    }

    // Provider API: getImageCaptionFromTurn - extract image caption if present
    function getImageCaptionFromTurn(turn) {
      try {
        if (!turn) return '';
        // Claude: captions are typically not exposed like ChatGPT
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

    // Provider API: getImagesFromTurn - extract imagess from turn
    function getImagesFromTurn(turn) {
      try {
        const out = [];
        const seen = new Set();
        if (!turn || !turn.querySelectorAll) return out;
        const addImage = (src = '', alt = '') => {
          try {
            let s = String(src || '').trim();
            if (!s) return;
            try { if (s.startsWith('/')) s = new URL(s, location.origin).href; } catch {}
            const lower = s.toLowerCase();
            if (lower.includes('s2/favicons') || lower.includes('favicon')) return;
            if (/avatar|claude-logo|\/icons?\//i.test(lower)) return;
            const key = s.split('#')[0];
            if (seen.has(key)) return;
            seen.add(key);
            out.push({ src: s, originalSrc: s, alt: alt || '', dataUrl: null });
          } catch {}
        };
        const bestFromSrcset = (set = '') => {
          try {
            const parts = String(set || '').split(',')
              .map((p) => {
                const bits = p.trim().split(/\s+/);
                const url = bits[0] || '';
                const scoreRaw = bits[1] || '';
                const score = /w$/i.test(scoreRaw) ? parseFloat(scoreRaw) : (/x$/i.test(scoreRaw) ? parseFloat(scoreRaw) * 1000 : 0);
                return { url, score: Number.isFinite(score) ? score : 0 };
              })
              .filter((p) => p.url);
            parts.sort((a, b) => b.score - a.score);
            return parts[0]?.url || '';
          } catch {
            return '';
          }
        };
        
        // Collect from IMG tags
        for (const img of turn.querySelectorAll('img')) {
          const src = img.currentSrc || img.src || img.getAttribute('src') || bestFromSrcset(img.getAttribute('srcset') || '');
          addImage(src, img.alt || img.getAttribute('aria-label') || '');
        }
        
        // Collect from source elements
        for (const s of turn.querySelectorAll('source[srcset]')) {
          addImage(bestFromSrcset(s.getAttribute('srcset') || ''), '');
        }
        // Claude generated images can be rendered as CSS backgrounds or links instead of plain <img>.
        for (const el of turn.querySelectorAll('*')) {
          try {
            const bg = el.style?.backgroundImage || getComputedStyle(el)?.backgroundImage || '';
            const matches = String(bg).matchAll(/url\((["']?)(.*?)\1\)/gi);
            for (const m of matches) addImage(m[2] || '', el.getAttribute?.('aria-label') || '');
          } catch {}
          try {
            const href = el.getAttribute?.('href') || '';
            if (/\.(png|jpe?g|webp|gif|avif|svg)(?:[?#]|$)|\/api\/.*(?:image|file|attachment|artifact)/i.test(href)) {
              addImage(href, el.textContent?.trim() || '');
            }
          } catch {}
        }
        return out;
      } catch {
        return [];
      }
    }

    // Provider API: getGalleryCountFromTurn - count images in turn
    function getGalleryCountFromTurn(turn) {
      try {
        if (!turn || !turn.querySelectorAll) return 0;
        const candidates = Array.from(turn.querySelectorAll('*'));
        for (const el of candidates) {
          const cls = (el.className || '').toString();
          if (!/pointer-events-none/.test(cls)) continue;
          const txt = (el.textContent || '').trim();
          if (/^\d+$/.test(txt)) return parseInt(txt, 10);
        }
        return 0;
      } catch {
        return 0;
      }
    }

    g.ACEP.providers.claude.getArtifactNodes = getArtifactNodes;
    g.ACEP.providers.claude.extractSelectableTurnNodes = extractSelectableTurnNodes;
    g.ACEP.providers.claude.getTurnsForExport = getTurnsForExport;
    g.ACEP.providers.claude.roleFromTurn = roleFromTurn;
    g.ACEP.providers.claude.innerHTMLFromTurn = innerHTMLFromTurn;
    g.ACEP.providers.claude.getChatTitle = getChatTitle;
    g.ACEP.providers.claude.getImageCaptionFromTurn = getImageCaptionFromTurn;
    g.ACEP.providers.claude.hasImages = hasImages;
    g.ACEP.providers.claude.getImagesFromTurn = getImagesFromTurn;
    g.ACEP.providers.claude.getGalleryCountFromTurn = getGalleryCountFromTurn;

    g.ACEP.providers.claude.postProcessExportRows = function postProcessExportRows(ctx = {}) {
      try {
        const rows = Array.isArray(ctx.rows) ? ctx.rows : [];
        if (!rows.length) return;
        // Claude API rows already contain per-message content. Do not append DOM/SVG fallbacks here:
        // they are global/order-based and caused repeated or wrong-position images/visuals.
        const alreadyHasFileCard = rows.some((row) => /acep-generated-file-card|data-acep-generated-file/i.test(String(row?.html || row?.rawHtml || '')));
        if (alreadyHasFileCard) return;
        const domTurns = extractSelectableTurnNodes();
        const domAsstTurns = domTurns.filter((turn) => String(turn?.getAttribute?.('data-acep-role') || '') === 'assistant');
        const assistantRows = rows.filter((row) => String(row?.role || '').toLowerCase() === 'assistant');
        const visibleEntries = domAsstTurns.flatMap((turn, turnIndex) => Array.from(turn.querySelectorAll?.('.acep-generated-file-card, .acep-chat-export[data-acep-generated-file], .artifact-block-cell, [class*="group/artifact-block" i]') || [])
          .map((node) => {
            try {
              const card = node.matches?.('.artifact-block-cell, [class*="group/artifact-block" i]') ? buildClaudeGeneratedFileCardFromCell(node) : node.cloneNode(true);
              if (!card) return null;
              return { card, turnIndex };
            } catch {
              return null;
            }
          }))
          .filter(Boolean);
        if (!visibleEntries.length || !assistantRows.length) return;
        const seen = new Set();
        let attached = 0;
        const perRow = new Map();
        for (const entry of visibleEntries) {
          const text = String(entry.card?.innerText || entry.card?.textContent || '').replace(/\s+/g, ' ').trim();
          if (!text || seen.has(text.toLowerCase())) continue;
          seen.add(text.toLowerCase());
          const rowIndex = Math.max(0, Math.min(assistantRows.length - 1, Number.isFinite(entry.turnIndex) && entry.turnIndex >= 0 ? entry.turnIndex : assistantRows.length - 1));
          if (!perRow.has(rowIndex)) perRow.set(rowIndex, []);
          perRow.get(rowIndex).push(entry.card.outerHTML || '');
        }
        for (const [rowIndex, htmlPartsForRow] of perRow.entries()) {
          const targetRow = assistantRows[rowIndex];
          const addHtml = htmlPartsForRow.join('');
          if (!targetRow || !addHtml) continue;
          targetRow.rawHtml = `${String(targetRow.rawHtml || targetRow.html || '')}${addHtml}`;
          targetRow.html = `${String(targetRow.html || '')}${addHtml}`;
          attached += htmlPartsForRow.length;
        }
        try { document.documentElement.setAttribute('data-acep-claude-generated-file-row-fallback', JSON.stringify({ attached, domAssistantCount: domAsstTurns.length, assistantRowCount: assistantRows.length, mode: 'per-turn' }).slice(0, 700)); } catch {}
      } catch {}
    };

    // Filter out UI-only images that can leak into exports (favicons, tool-result icons, etc.).
    g.ACEP.providers.claude.filterRowImages = function filterRowImages(imgs = []) {
      try {
        return (Array.isArray(imgs) ? imgs : []).filter((img) => {
          const s = String(img?.originalSrc || img?.src || '').toLowerCase();
          if (!s) return true;
          if (s.includes('s2/favicons') || s.includes('favicon')) return false;
          return true;
        });
      } catch {
        return imgs;
      }
    };

    // Remove Claude tool-result artifacts from text exports (PDF/DOCX/MD/TXT/CSV/JSON).
    g.ACEP.providers.claude.cleanPlainText = function cleanPlainText(text = '') {
      try {
        return String(text || '')
          .replace(/^\s*Fetched:\s.*$/gim, '')
          .replace(/\n{3,}/g, '\n\n')
          .trimEnd();
      } catch {
        return text;
      }
    };
    // Provider hook called by content.js before scraping. We'll migrate the real logic into here incrementally.
    g.ACEP.providers.claude.preScrape = async function preScrape(ctx) {
      const ctxObj = (ctx && typeof ctx === 'object') ? ctx : {};
      const isExportPhase = String(ctxObj.purpose || '') === 'export';
      const runGeneratedFileCapture = isExportPhase;
      const pastedMode = 'placeholder';
      g.ACEP.providers.claude.__apiNetworkFailed = false;

      let apiRes = null;
      let thumbRes = {};
      let genFiles = {};
      let artifacts = [];
      let artifactsApplied = { ok: true, applied: 0 };
      apiRes = await fetchApiTurnNodesForCurrentChat(ctxObj).catch(e => {
          debugStore('prescrape_api_err', String(e?.message || e));
          if (e instanceof TypeError || /failed to fetch|networkerror|network error/i.test(String(e?.message || ''))) {
            g.ACEP.providers.claude.__apiNetworkFailed = true;
          }
          return null;
        });

      if (isExportPhase && apiRes && Array.isArray(apiRes.nodes) && apiRes.nodes.length) {
        thumbRes = { ok: true, skipped: true, reason: 'pasted-content-placeholder-mode' };
      } else {
        thumbRes = { ok: true, skipped: true, reason: isExportPhase ? 'api-missing-or-empty' : 'selection-phase' };
      }
      genFiles = runGeneratedFileCapture
        ? await withTimeout(captureGeneratedFileCardsAsLinks({ purpose: 'export' }).catch(() => ({})), 4500, { ok: false, timeout: true })
        : { ok: true, skipped: true, reason: 'selection-phase' };

      if (apiRes && Array.isArray(apiRes.nodes) && apiRes.nodes.length) {
        const apiNodeCount = apiRes.nodes.length;
        try { document.documentElement.setAttribute('data-acep-claude-citation-links-merged', 'api-only'); } catch {}
        const shouldDomAugmentApiNodes = String(g.ACEP?.providers?.claude?.__allowDomAugment || '') === '1';
        if (shouldDomAugmentApiNodes) {
        try {
          const domTurns = extractSelectableTurnNodes();
          const domAsstTurns = domTurns.filter(n => n.getAttribute('data-acep-role') === 'assistant');
          const apiAssistantNodes = [];
          let domAsstIdx = 0;
          for (const apiNode of apiRes.nodes) {
            const nodeRole = apiNode.getAttribute?.('data-acep-role');
            if (nodeRole === 'user') {
              try { apiNode.removeAttribute('data-acep-needs-dom-fallback'); } catch {}
            } else if (nodeRole === 'assistant') {
              apiAssistantNodes.push(apiNode);
              const domTurn = domAsstTurns[domAsstIdx++] || null;
              const exportTurn = domTurn ? domTurn.cloneNode(true) : null;
              const apiContent = apiNode.querySelector?.('.acep-api-content');
              try {
                if (apiContent) {
                  const existing = new Set();
                  try {
                    apiNode.querySelectorAll?.('img[src], img[data-original-src]').forEach((img) => {
                      const src = String(img.getAttribute('data-original-src') || img.getAttribute('src') || '').trim();
                      if (src) existing.add(src.split('#')[0]);
                    });
                  } catch {}
                  const domImages = exportTurn ? getImagesFromTurn(exportTurn)
                    .filter((img) => {
                      const src = String(img?.originalSrc || img?.src || '').trim();
                      if (!src) return false;
                      const key = src.split('#')[0];
                      if (existing.has(key)) return false;
                      if (!/(?:\/api\/[^/]+\/files\/[^/]+\/(?:preview|thumbnail)\b|data:image\/|blob:|files\.claude-uploads\.anthropic\.com|claude\.ai\/api\/[^/]+\/files\/)/i.test(src)) return false;
                      existing.add(key);
                      return true;
                    }) : [];
                  if (domImages.length) {
                    const prior = (() => {
                      try { return JSON.parse(apiNode.getAttribute('data-acep-imgs') || '[]'); } catch { return []; }
                    })();
                    const merged = Array.isArray(prior) ? prior.concat(domImages) : domImages;
                    try { apiNode.setAttribute('data-acep-imgs', JSON.stringify(merged)); } catch {}
                    domImages.forEach((image) => {
                      const src = String(image?.src || image?.originalSrc || '').trim();
                      if (!src) return;
                      const img = document.createElement('img');
                      img.setAttribute('src', src);
                      img.setAttribute('data-original-src', String(image?.originalSrc || src));
                      if (image?.alt) img.setAttribute('alt', String(image.alt));
                      img.style.cssText = 'width:100%;max-width:100%;height:auto;display:block;margin:8px 0;object-fit:contain;margin-left:0;margin-right:auto;';
                      apiContent.appendChild(img);
                    });
                  }
                }
              } catch {}
              try {
                if (apiContent) {
                  const hasVisualBody = !!apiContent.querySelector?.('#vis-container, .acep-visual-wrap, .acep-artifact table, .acep-artifact img, .acep-artifact svg, .acep-artifact .acep-svg-wrap');
                  const visualRoots = Array.from(exportTurn?.querySelectorAll?.('#vis-container, .acep-visual-wrap') || []);
                  if (!hasVisualBody || visualRoots.length) {
                    const visualHtml = [];
                    const seenVisual = new Set();
                    const addVisual = (node) => {
                      try {
                        if (!node) return;
                        const html = sanitizeClaudeVisualizationHtml(node.outerHTML || '');
                        if (!html) return;
                        const key = html.replace(/\s+/g, ' ').slice(0, 600);
                        if (seenVisual.has(key)) return;
                        seenVisual.add(key);
                        visualHtml.push(html);
                      } catch {}
                    };
                    for (const node of visualRoots) {
                      addVisual(node);
                    }
                    const emptyArtifact = Array.from(apiContent.querySelectorAll?.('.acep-artifact') || [])
                      .find((node) => !String(node?.innerHTML || '').replace(/<!--[\s\S]*?-->/g, '').trim());
                    if (visualHtml.length) {
                      const target = emptyArtifact || apiContent.querySelector?.('.acep-artifact') || apiContent;
                      const tmp = document.createElement('div');
                      tmp.innerHTML = visualHtml.join('');
                      try { target.innerHTML = ''; } catch {}
                      while (tmp.firstChild) target.appendChild(tmp.firstChild);
                      try {
                        const filledHtml = String(target.innerHTML || visualHtml.join('')).trim();
                        const artifactRoot = target.closest?.('[data-acep-artifact-title]') || target;
                        if (filledHtml) {
                          artifactRoot.setAttribute('data-acep-artifact-html', filledHtml);
                          artifactRoot.setAttribute('data-acep-artifact-is-code', '0');
                        }
                      } catch {}
                    } else {
                      apiContent.querySelectorAll?.('.acep-artifact-wrap').forEach((wrap) => {
                        try {
                          const body = wrap.querySelector?.('.acep-artifact');
                          if (body && !String(body.innerHTML || '').trim()) wrap.remove();
                        } catch {}
                      });
                    }
                  }
                }
              } catch {}
              try {
                exportTurn?.querySelectorAll?.('[data-acep-generated-file]').forEach((el) => {
                  const href = String(el.getAttribute('href') || '').trim();
                  const name = String(el.getAttribute('data-acep-generated-file') || el.textContent || 'Generated file').trim();
                  if (!href) return;
                  const wrap = document.createElement('div');
                  wrap.className = 'acep-generated-file';
                  wrap.innerHTML = `<a href="${escapeHtmlApi(href)}" target="_blank" rel="noopener">${escapeHtmlApi(name)}</a>`;
                  apiNode.querySelector?.('.acep-api-content')?.appendChild(wrap);
                });
              } catch {}
              try {
                const apiContent = apiNode.querySelector?.('.acep-api-content');
                if (apiContent && !apiContent.querySelector?.('.acep-generated-file-card,[data-acep-generated-file]')) {
                  exportTurn?.querySelectorAll?.('.artifact-block-cell').forEach((cell) => {
                    try {
                      const card = buildClaudeGeneratedFileCardFromCell(cell);
                      if (card) apiContent.appendChild(card);
                    } catch {}
                  });
                }
              } catch {}
              try {
                const domHtml = exportTurn ? innerHTMLFromTurn(exportTurn) : '';
                if (domHtml && /acep-generated-file-card|data-acep-generated-file/i.test(domHtml)) {
                  const tmp = document.createElement('div');
                  tmp.innerHTML = domHtml;
                  const apiContent = apiNode.querySelector?.('.acep-api-content');
                  if (apiContent && !apiContent.querySelector?.('.acep-generated-file-card,[data-acep-generated-file]')) {
                    tmp.querySelectorAll('.acep-generated-file-card,[data-acep-generated-file]').forEach((fileCard) => {
                      apiContent.appendChild(fileCard.cloneNode(true));
                    });
                  }
                }
              } catch {}
            }
          }
          // Do not mutate/apply Claude visual artifacts in API mode.
          // API-sourced artifacts are placed per message during fetchApiTurnNodesForCurrentChat().
        } catch {}
        } else {
          try {
            debugStore('api_dom_augment', {
              skipped: true,
              apiCount: apiNodeCount,
              isExportPhase,
              reason: !isExportPhase ? 'selection-phase' : 'long-chat-fastpath',
            });
          } catch {}
        }

        try {
          if (isExportPhase) {
            const domTurnsForFiles = extractSelectableTurnNodes();
            const domAsstTurnsForFiles = domTurnsForFiles.filter(n => n.getAttribute('data-acep-role') === 'assistant');
            let domFileIdx = 0;
            let attachedGeneratedFiles = 0;
            for (const apiNode of apiRes.nodes) {
              const nodeRole = apiNode.getAttribute?.('data-acep-role');
              if (nodeRole !== 'assistant') continue;
              const domTurn = domAsstTurnsForFiles[domFileIdx++] || null;
              const exportTurn = domTurn ? domTurn.cloneNode(true) : null;
              const apiContent = apiNode.querySelector?.('.acep-api-content');
              if (!exportTurn || !apiContent) continue;
              if (apiContent.querySelector?.('.acep-generated-file-card,[data-acep-generated-file]')) continue;
              let fileCards = Array.from(exportTurn.querySelectorAll?.('.acep-chat-export[data-acep-generated-file], .acep-generated-file-card') || []);
              if (!fileCards.length) {
                fileCards = Array.from(exportTurn.querySelectorAll?.('.artifact-block-cell, [class*="group/artifact-block" i]') || [])
                  .map((cell) => buildClaudeGeneratedFileCardFromCell(cell))
                  .filter(Boolean);
              } else {
                fileCards = fileCards.map((card) => card.cloneNode(true));
              }
              for (const fileCard of fileCards) {
                try {
                  const text = String(fileCard?.innerText || fileCard?.textContent || '').replace(/\s+/g, ' ').trim();
                  if (!text) continue;
                  apiContent.appendChild(fileCard);
                  attachedGeneratedFiles++;
                } catch {}
              }
            }
            try { document.documentElement.setAttribute('data-acep-claude-generated-file-merge', JSON.stringify({ attached: attachedGeneratedFiles, domAssistantCount: domAsstTurnsForFiles.length, apiCount: apiRes.nodes.length }).slice(0, 1000)); } catch {}
            debugStore('generated_file_dom_merge', { attached: attachedGeneratedFiles, domAssistantCount: domAsstTurnsForFiles.length, apiCount: apiRes.nodes.length });
          }
        } catch (e) {
          debugStore('generated_file_dom_merge_error', String(e?.message || e));
        }
        g.ACEP.providers.claude.__apiTurnNodes = apiRes.nodes;
        g.ACEP.providers.claude.__apiChatId = apiRes.chatId || '';
        g.ACEP.providers.claude.__apiTs = Date.now();
        g.ACEP.providers.claude.__apiFailed = false;
        debugStore('prescrape', { ok: true, mode: 'api', count: apiRes.nodes.length, thumbRes, genFiles, artifacts: { count: 0, applied: 0, skipped: 'api-message-placement' } });
        return { ok: true, mode: 'api', count: apiRes.nodes.length, thumbRes, genFiles, artifactsRes: { ok: true, count: 0, applied: 0, skipped: 'api-message-placement' } };
      }

      g.ACEP.providers.claude.__apiFailed = true;
      const summary = {
        ok: false,
        ts: Date.now(),
        note: 'Claude API failed or returned no turns; DOM fallback disabled',
        pastedMode,
        mode: 'api',
        reason: 'api-missing-or-empty',
      };
      debugStore('prescrape', summary);
      debugStore('prescrape_full', summary);
      return { ok: false, mode: 'api', reason: 'api-missing-or-empty' };
    };
    g.ACEP.providers.claude.debugStore = debugStore;
    g.ACEP.providers.claude.fetchApiTurnNodesForCurrentChat = fetchApiTurnNodesForCurrentChat;
    g.ACEP.providers.claude.captureThumbFullContent = captureThumbFullContent;
    g.ACEP.providers.claude.countPastedThumbs = function countPastedThumbs(opts = {}) {
      try { return getClaudePastedThumbRoots(opts).length; } catch { return 0; }
    };
    g.ACEP.providers.claude.loadArtifactsFromApi = loadArtifactsFromApi;
    g.ACEP.providers.claude.applyArtifactsToDom = applyArtifactsToDom;
    g.ACEP.providers.claude.captureGeneratedFileCardsAsLinks = captureGeneratedFileCardsAsLinks;

    try { document.documentElement.setAttribute('data-acep-loaded-claude-provider', '1'); } catch {}
  } catch {}
})();
