/**
 * DeepSeek artifact extraction and handling
 * Platform-specific upload and image capture functions for DeepSeek AI
 */

(function() {
  // Safely define functions in ACEP namespace
  if (!globalThis.ACEP) globalThis.ACEP = {};
  if (!globalThis.ACEP.deepseek) globalThis.ACEP.deepseek = {};

  // Auto-reveal and capture DeepSeek uploads
  globalThis.ACEP.deepseek.autoRevealUploads = async function autoRevealDeepseekUploads() {
    const root = document.querySelector('main') || document.body;
    if (!root) return;
    // DeepSeek groups multiple upload "items" under a single container (e.g. `._5cadb25`).
    // We must process each file item separately, otherwise multi-image uploads collapse to one.
    const chipItems = (() => {
      try {
        const candidates = Array.from(root.querySelectorAll('[tabindex][class*="_76cd190" i], [tabindex][class*="_0004e59" i]'))
          .filter(el => el && el.querySelector && el.querySelector('.f3a54b52, [class*="f3a54b52" i]'));
        if (candidates.length) return candidates;
      } catch {}
      try {
        const nameEls = Array.from(root.querySelectorAll('.f3a54b52, [class*="f3a54b52" i]'));
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
        if (!Number.isFinite(exp) || !exp) return true; // no expiry param => treat as usable
        // Consider "fresh" if it expires more than 90s from now
        return (exp - nowSec()) > 90;
      } catch {
        return true;
      }
    };
    const getAllCandidateUrls = () => {
      const els = Array.from(document.querySelectorAll(
        'a[href*="myhuaweicloud" i], a[href*="deepseek-api-files" i], ' +
        'img[src*="myhuaweicloud" i], img[src*="deepseek-api-files" i], ' +
        '[data-original-src*="myhuaweicloud" i], [data-original-src*="deepseek-api-files" i]'
      ));
      return els.map(el => {
        try {
          const href = el.getAttribute && el.getAttribute('href');
          const src = el.getAttribute && (el.getAttribute('src') || el.getAttribute('data-original-src'));
          return (href || src || el.href || el.currentSrc || el.src || '').trim();
        } catch {
          return (el.href || el.currentSrc || el.src || '').trim();
        }
      }).filter(Boolean);
    };
    const extractFilenameFromContentDisposition = (v = '') => {
      try {
        const s = String(v || '').trim();
        if (!s) return '';
        // DeepSeek often uses response-content-disposition=attachment; filename="image.png"
        // which may already be URL-encoded when read via searchParams.
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
        // Sometimes the name appears in the full URL as a quoted/encoded segment
        if (String(u || '').toLowerCase().includes(encodeURIComponent(nameNorm))) return true;
        return false;
      } catch {
        return !nameNorm;
      }
    };

    // Track URLs per-message so multi-image uploads inside the same prompt don't collapse,
    // without blocking legitimate reuse across different turns.
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
        const msg = chip.closest('.ds-message, div.ds-message') || chip;
        const usedUrls = getUsedForMsg(msg);
        const nameEl = chip.querySelector('.f3a54b52, [class*="f3a54b52" i]');
        const fileName = (nameEl?.textContent || '').trim();
        if (!fileName || !imageExtRe.test(fileName)) continue;
        const nameNorm = fileName.toLowerCase().replace(/\s+/g, ' ').trim();

        // If THIS upload item already has a concrete DeepSeek URL in the DOM (even if hidden),
        // prefer it and avoid opening the preview (which can trigger large downloads and slow export).
        // Important: only search within this chip item to avoid cross-item leakage when multiple
        // uploads share the same filename (e.g. "image.png").
        try {
          const candidates = Array.from(chip.querySelectorAll('img[src], img[data-original-src], a[href]'))
            .map(n => (n.getAttribute ? (n.getAttribute('href') || n.getAttribute('src') || n.getAttribute('data-original-src') || '') : '') || n.href || n.src || '')
            .map(s => String(s || '').trim())
            .filter(Boolean)
            .filter(u => /myhuaweicloud|deepseek-api-files/i.test(u) && urlLooksFresh(u));
          const matching = candidates.filter(u => urlMatchesName(u, nameNorm));
          const existingReal = matching.find(u => !usedUrls.has(u)) || '';
          if (existingReal) {
            // Replace any stale injected URL and store the real one as temp for collectors.
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

        // If we already have a non-expired injected URL for this chip, keep it (don't delete it),
        // because synthetic clicks may fail to open the preview on some builds.
        const existingTemp = Array.from(chip.querySelectorAll('img[data-acep-temp="1"][src]'))
          .map(n => (n.getAttribute('src') || '').trim())
          .filter(Boolean);
        const freshTemp = existingTemp.find(u => urlLooksFresh(u));
        if (freshTemp) {
          usedUrls.add(freshTemp);
          continue;
        }

        const before = new Set(getAllCandidateUrls());

        try { chip.scrollIntoView({ block: 'center', inline: 'nearest' }); } catch {}
        // Click the chip item itself. Clicking a descendant sometimes triggers the first item in the group
        // (which causes "first image repeats" across a multi-upload).
        const clickTargets = [chip];
        for (const target of clickTargets) {
          try { target.focus && target.focus(); } catch {}
          // Dispatch a more complete pointer/click sequence (some frameworks ignore synthetic plain clicks)
          const events = [
            new PointerEvent('pointerdown', { bubbles: true, cancelable: true, pointerType: 'mouse' }),
            new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window }),
            new PointerEvent('pointerup', { bubbles: true, cancelable: true, pointerType: 'mouse' }),
            new MouseEvent('mouseup', { bubbles: true, cancelable: true, view: window }),
            new MouseEvent('click', { bubbles: true, cancelable: true, view: window }),
          ];
          events.forEach(ev => { try { target.dispatchEvent(ev); } catch {} });
          await new Promise(r => setTimeout(r, 50));
        }

        const start = Date.now();
        let picked = '';
        // Observe DOM mutations for faster detection
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
        // DeepSeek image downloads can be slow; wait longer so we can capture the real URL
        // before export finishes (otherwise you get only "[Attachment]" placeholders).
        while (Date.now() - start < 8000 && !picked) {
          await new Promise(r => setTimeout(r, 120));
          // Prefer URLs from the active preview overlay (most reliable).
          const overlayUrls = (() => {
            try { return (globalThis.ACEP && globalThis.ACEP.deepseek && globalThis.ACEP.deepseek.captureOverlayImages ? globalThis.ACEP.deepseek.captureOverlayImages() : []).map(o => o && o.src).filter(Boolean); } catch { return []; }
          })();
          const nowAll = (overlayUrls.length
            ? overlayUrls
            : (found.length
              ? [...found]
              : getAllCandidateUrls().filter(u => !before.has(u))));
          // Prefer a URL that matches this chip's filename AND isn't already used by another chip.
          for (const u of nowAll) {
            if (!u) continue;
            if (!urlMatchesName(u, nameNorm)) continue;
            if (usedUrls.has(u)) continue;
            picked = u;
            break;
          }
          if (!picked && !nameNorm) {
            const fallback = nowAll.find(u => u && !usedUrls.has(u)) || '';
            if (fallback) picked = fallback;
          }
        }
        try { stopObs && stopObs(); } catch {}
        if (!picked) {
          // Timeout fallback
          try {
            const nowNew = getAllCandidateUrls().filter(u => !before.has(u));
            picked = nowNew.find(u => u && urlMatchesName(u, nameNorm) && !usedUrls.has(u)) || '';
          } catch {}
        }

        if (picked) {
          // Replace any existing injected URLs now that we have a fresh one
          try { chip.querySelectorAll('img[data-acep-temp="1"]').forEach(n => n.remove()); } catch {}
          // Inject a hidden <img> into the chip so later collectors can see it reliably
          const img = document.createElement('img');
          img.setAttribute('src', picked);
          img.setAttribute('data-original-src', picked);
          img.setAttribute('data-acep-temp', '1');
          if (fileName) img.setAttribute('alt', fileName);
          img.style.cssText = 'display:none;max-width:100%';
          chip.appendChild(img);
          usedUrls.add(picked);
        }

        // Try to close the viewer gently
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
  };

  // Capture URLs from the open DeepSeek preview overlay (if present)
  globalThis.ACEP.deepseek.captureOverlayImages = function captureDeepseekOverlayImages() {
    if (!/deepseek\.com$/i.test(HOST || (typeof window !== 'undefined' ? window.location.hostname : ''))) return [];
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
          if (!/myhuaweicloud|deepseek-api-files/i.test(s)) continue;
          try { urls.push({ src: new URL(s, ORIGIN || window.location.origin).href, alt: altName || (im.getAttribute('alt') || '') }); }
          catch { urls.push({ src: s, alt: altName || (im.getAttribute('alt') || '') }); }
        }
      }
    } catch {}
    // dedupe
    const seen = new Set();
    return urls.filter(u => {
      const key = (u.src || '').split('#')[0];
      if (!key || seen.has(key)) return false;
      seen.add(key); return true;
    });
  };

})();
