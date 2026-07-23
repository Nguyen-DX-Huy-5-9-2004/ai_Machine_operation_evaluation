// ChatGPT Citation handling functions
// Extracted from content.js during comprehensive refactoring

(function initChatgptCitations() {
  try {
    const g = (typeof globalThis !== 'undefined') ? globalThis : window;
    if (!g.ACEP) g.ACEP = {};
    if (!g.ACEP.providers) g.ACEP.providers = {};
    if (!g.ACEP.providers.chatgpt) g.ACEP.providers.chatgpt = {};

    // Expand citation pills with actual links
    function expandChatgptCitationPills(contentEl) {
      try {
        if (!(/chatgpt\.com$/i.test(location.hostname) || /chat\.openai\.com$/i.test(location.hostname))) return;
        if (!contentEl || !(contentEl instanceof Element)) return;
        const pillCandidates = Array.from(contentEl.querySelectorAll('a,button,span'))
          .filter(el => {
            const txt = (el.textContent || '').trim();
            if (!txt || !/\+\d+/.test(txt)) return false;
            return /[a-z0-9.-]+\.[a-z]{2,}/i.test(txt);
          });
        if (!pillCandidates.length) return;
        const toRemoveAfter = new Set(pillCandidates);
        const isHttp = (h) => /^https?:\/\//i.test(h || '');
        const normalizeHref = (h) => {
          try { return new URL(h).href; } catch { return h || ''; }
        };
        let inserted = false;
        pillCandidates.forEach(pill => {
          if (inserted) return;
          const collected = [];
          const seen = new Set();
          const addLink = (a) => {
            if (!a) return;
            const href = normalizeHref(a.getAttribute('href') || a.href || '');
            if (!isHttp(href)) return;
            if (seen.has(href)) return;
            let text = (a.textContent || a.getAttribute('aria-label') || '').trim();
            if (!text) return;
            text = text.replace(/\s*\+\d+\s*/g, '').trim();
            const domains = text.match(/[a-z0-9.-]+\.[a-z]{2,}/gi);
            if (domains && domains.length > 1) {
              text = domains[0].trim();
            }
            if (!/[a-z0-9.-]+\.[a-z]{2,}/i.test(text) || /[A-Z].*[A-Z]/.test(text)) {
              try {
                const host = new URL(href).hostname;
                if (host) text = host;
              } catch {}
            }
            if (!text) return;
            seen.add(href);
            collected.push({ href, text });
          };
          const containers = [];
          let n = pill;
          for (let i = 0; i < 4 && n; i++) { containers.push(n); n = n.parentElement; }
          const scoped = new Set();
          containers.forEach(c => {
            if (!c) return;
            if (scoped.has(c)) return;
            scoped.add(c);
            Array.from(c.querySelectorAll('a[href]')).forEach(addLink);
            Array.from(c.querySelectorAll('[data-testid*="citation" i] a[href], [data-testid*="source" i] a[href], [class*="citation" i] a[href], [class*="source" i] a[href]')).forEach(addLink);
          });
          Array.from(contentEl.querySelectorAll('[data-testid*="citation" i], [data-testid*="source" i], [class*="citation" i], [class*="source" i], [role="dialog"], [role="menu"], [aria-hidden="true"]')).forEach(c => {
            Array.from(c.querySelectorAll('a[href]')).forEach(addLink);
          });
          const pillHref = normalizeHref(pill.getAttribute && pill.getAttribute('href'));
          if (pillHref && isHttp(pillHref) && !seen.has(pillHref)) {
            const baseText = (pill.textContent || '').replace(/\s*\+\d+\s*/g, '').trim();
            if (baseText) collected.unshift({ href: pillHref, text: baseText });
          }
          if (!collected.length) {
            try { pill.textContent = (pill.textContent || '').replace(/\s*\+\d+\s*/g, '').trim(); } catch {}
            return;
          }
          const wrap = document.createElement('span');
          wrap.className = 'acep-citations';
          collected.forEach((c, idx) => {
            const a = document.createElement('a');
            a.href = c.href;
            a.textContent = c.text;
            a.setAttribute('target', '_blank');
            a.setAttribute('rel', 'noopener');
            wrap.appendChild(a);
            if (idx < collected.length - 1) {
              wrap.appendChild(document.createTextNode(' · '));
            }
          });
          pill.replaceWith(wrap);
          inserted = true;
        });
        try {
          toRemoveAfter.forEach(el => {
            if (!el || !el.parentNode) return;
            const txt = (el.textContent || '').trim();
            if (txt && /\+\d+/.test(txt)) el.remove();
          });
        } catch {}
        try {
          const walker = document.createTreeWalker(contentEl, NodeFilter.SHOW_TEXT, null);
          const toClear = [];
          while (walker.nextNode()) {
            const node = walker.currentNode;
            const txt = (node.nodeValue || '').trim();
            if (!txt) continue;
            if (!/[a-z0-9.-]+\.[a-z]{2,}\s*\+\d+/i.test(txt)) continue;
            const parent = node.parentElement;
            if (parent && parent.querySelector && parent.querySelector('.acep-citations')) {
              toClear.push(node);
            }
          }
          toClear.forEach(n => { try { n.nodeValue = ''; } catch {} });
        } catch {}
      } catch {}
    }

    // Clean "+N" badges from citation links
    function cleanChatgptCitationLinkText(contentEl) {
      try {
        if (!(/chatgpt\.com$/i.test(location.hostname) || /chat\.openai\.com$/i.test(location.hostname))) return;
        if (!contentEl || !(contentEl instanceof Element)) return;
        const anchors = Array.from(contentEl.querySelectorAll('a'));
        anchors.forEach(a => {
          const txt = (a.textContent || '').trim();
          if (!txt) return;
          if (!/\+\d+/.test(txt)) return;
          Array.from(a.querySelectorAll('span')).forEach(s => {
            const st = (s.textContent || '').trim();
            if (/^\+\d+$/.test(st)) { try { s.remove(); } catch {} }
          });
          let clean = (a.textContent || '').replace(/\s*\+\d+\s*/g, '').trim();
          if (!clean) {
            try {
              const host = new URL(a.getAttribute('href') || a.href || '').hostname;
              if (host) clean = host;
            } catch {}
          }
          if (clean) a.textContent = clean;
        });
      } catch {}
    }

    // Collect extra gallery images from performance API
    function collectExtraGalleryImages(existing = [], targetCount = 0) {
      if (!targetCount) return [];
      const normalize = (u = '') => {
        const raw = String(u || '');
        const hash = raw.indexOf('#');
        const noHash = hash >= 0 ? raw.slice(0, hash) : raw;
        return noHash;
      };
      const seen = new Set(existing.map(i => normalize(i.originalSrc || i.src || '')).filter(Boolean));
      const out = [];
      const entries = (performance && typeof performance.getEntriesByType === 'function')
        ? performance.getEntriesByType('resource') : [];
      for (const e of entries) {
        const name = (e && e.name) ? String(e.name) : '';
        if (!name) continue;
        if (!/https?:\/\//i.test(name)) continue;
        const lower = name.toLowerCase();
        const isImageUrl = /\.(png|jpe?g|webp|gif|bmp|svg)(\?|#|$)/i.test(lower);
        const isChatgptImage = /backend-api\/estuary\/content/i.test(lower);
        const isChatgptCdn = /(^|\/\/)(files\.oaiusercontent\.com|[^\/]*oaiusercontent\.com|oaidalleapiprodscus\.blob\.core\.windows\.net)\//i.test(name);
        const hasUtm = /utm_source=chatgpt\.com/i.test(lower);
        if (!isImageUrl && !isChatgptImage && !isChatgptCdn) continue;
        if (!hasUtm && !isChatgptImage && !isChatgptCdn) continue;
        const key = normalize(name);
        if (!key || seen.has(key)) continue;
        seen.add(key);
        out.push({ src: name, originalSrc: name, alt: '' });
        if (existing.length + out.length >= targetCount) break;
      }
      return out;
    }

    // Export API
    g.ACEP.providers.chatgpt.expandChatgptCitationPills = expandChatgptCitationPills;
    g.ACEP.providers.chatgpt.cleanChatgptCitationLinkText = cleanChatgptCitationLinkText;
    g.ACEP.providers.chatgpt.collectExtraGalleryImages = collectExtraGalleryImages;

  } catch (err) {
    console.error('Error initializing ChatGPT citations module:', err);
  }
})();
