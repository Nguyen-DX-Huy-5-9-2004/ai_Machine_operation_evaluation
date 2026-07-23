/**
 * Image Handling & Processing Module
 * Centralized functions for fetching, normalizing, and converting images
 * Used by popup.js export flows
 */

import {
  getProviderKeyFromUrl,
  isLikelyImageUrl,
  shouldUseBackgroundFetch,
} from './provider-helpers.js';

const IMAGE_FETCH_CACHE_TTL_MS = 10 * 60 * 1000;
const IMAGE_FETCH_FAILURE_TTL_MS = 2 * 60 * 1000;
const imageFetchCache = new Map();
const imageFetchInflight = new Map();

function normalizedImageCacheKey(url = '') {
  try {
    const parsed = new URL(String(url || '').trim());
    parsed.hash = '';
    return parsed.toString();
  } catch {
    return String(url || '').trim().split('#')[0];
  }
}

/**
 * Fetch image as data URL with fallback to background service worker
 * @param {string} url - Image URL to fetch
 * @param {number} tabId - Tab ID for page context fetch (optional)
 * @returns {Promise<string|null>} Data URL or null
 */
async function fetchDataUrlStrongUncached(url, tabId = null) {
  if (typeof url === 'string' && /^data:image\//i.test(url)) return url;

  if (typeof url === 'string' && /^(chrome|moz)-extension:/i.test(url)) {
    try {
      const resp = await fetch(url);
      if (resp.ok) {
        const b = await resp.blob();
        const dataUrl = await new Promise((res, rej) => {
          const fr = new FileReader();
          fr.onload = () => res(fr.result);
          fr.onerror = rej;
          fr.readAsDataURL(b);
        });
        if (typeof dataUrl === 'string' && /^data:image\//i.test(dataUrl)) return dataUrl;
      }
    } catch {}
  }

  if (typeof url === 'string' && /^https?:\/\//i.test(url) && !isLikelyImageUrl(url)) {
    return null;
  }

  // Try page context (with cookies) first for same-origin/protected assets.
  const isBase64DataUrl = (u) => typeof u === 'string' && /^data:[a-z0-9.+-]+\/[a-z0-9.+-]+;base64,/i.test(u.trim());
  const isProtectedAsset = (() => {
    try {
      const parsed = new URL(String(url || '').trim());
      const host = parsed.hostname || '';
      const path = parsed.pathname || '';
      if (/deepseek\.com$/i.test(host) && /\/api\/.+\/(preview|content)\b/i.test(path)) return true;
      if (/deepseek-api-files|myhuaweicloud|\bobs\./i.test(host)) return false;
      if (/googleusercontent\.com$/i.test(host) || /lh3\.google\.com$/i.test(host) || /lh3\.googleusercontent\.com$/i.test(host)) return true;
      const providerKey = getProviderKeyFromUrl(url);
      const p = globalThis.ACEP && globalThis.ACEP.providers && globalThis.ACEP.providers[providerKey];
      if (p && typeof p.isProtectedAsset === 'function') {
        return p.isProtectedAsset(url);
      }
    } catch {}
    return false;
  })();

  // Use background fetch for public CORS-protected URLs, but keep tab context for protected assets
  // like Gemini uploaded images and DeepSeek preview URLs that need page/session auth.
  if (shouldUseBackgroundFetch(url) && !isProtectedAsset) {
    tabId = null;
  }

  // Grok uploaded images: `.../preview-image` is typically low-res. Try fetching the
  // full binary via `.../content` inside the tab context (cookies apply), then fall
  // back to the preview if it fails. (The exported HTML is offline, so linking to
  // `/content` directly results in 403.)
  const grokContentCandidate = (() => {
    try {
      const s = String(url || '').trim();
      if (!/^https?:\/\//i.test(s)) return '';
      const u = new URL(s);
      if (u.hostname !== 'assets.grok.com') return '';
      if (!/\/preview-image\b/i.test(u.pathname)) return '';
      u.pathname = u.pathname.replace(/\/preview-image\b/i, '/content');
      return u.toString();
    } catch {
      return '';
    }
  })();

  // Public third-party images should go directly through the unified API proxy.
  // Fetching them in the provider tab only produces a noisy CORS failure first.
  if (tabId && isProtectedAsset) {
    try {
      const sendToTab = globalThis.sendToTab || (async (id, msg) => {
        if (typeof browser !== 'undefined' && browser.tabs?.sendMessage) {
          return browser.tabs.sendMessage(id, msg);
        }
      });
      if (grokContentCandidate) {
        try {
          const respTabFull = await Promise.race([
            sendToTab(tabId, { type: 'ACEP_FETCH_DATAURL', url: grokContentCandidate }),
            new Promise((res) => setTimeout(() => res(null), 4500)),
          ]);
          if (respTabFull && respTabFull.ok && isBase64DataUrl(respTabFull.dataUrl)) {
            return respTabFull.dataUrl;
          }
        } catch {}
      }
      const respTab = await sendToTab(tabId, { type: 'ACEP_FETCH_DATAURL', url });
      if (respTab && respTab.ok && isBase64DataUrl(respTab.dataUrl)) {
        return respTab.dataUrl;
      }
      try {
        const deepseekContentCandidate = (() => {
          const parsed = new URL(String(url || '').trim());
          if (!/deepseek\.com$/i.test(parsed.hostname)) return '';
          if (!/\/api\/.+\/preview\b/i.test(parsed.pathname)) return '';
          parsed.pathname = parsed.pathname.replace(/\/preview\b/i, '/content');
          return parsed.toString();
        })();
        if (deepseekContentCandidate && deepseekContentCandidate !== String(url || '').trim()) {
          const respTabContent = await Promise.race([
            sendToTab(tabId, { type: 'ACEP_FETCH_DATAURL', url: deepseekContentCandidate }),
            new Promise((res) => setTimeout(() => res(null), 4500)),
          ]);
          if (respTabContent && respTabContent.ok && isBase64DataUrl(respTabContent.dataUrl)) {
            return respTabContent.dataUrl;
          }
        }
      } catch {}
    } catch {}
  }

  // Same-origin protected app endpoints should not go through the worker/proxy.
  // DeepSeek OBS/CDN URLs are intentionally not protected here so they can fall back to background fetch.
  // If an asset appears protected but we don't have a `tabId` to fetch from page context,
  // allow the background proxy to attempt fetching as a fallback instead of returning null.

  let backgroundError = '';
  try {
    const resp = await browser.runtime.sendMessage({ type: 'ACEP_FETCH_DATAURL', url });
    if (resp && resp.ok && isBase64DataUrl(resp.dataUrl)) {
      return resp.dataUrl;
    }
    backgroundError = String(resp?.error || 'No image data returned');
  } catch (err) {
    backgroundError = String(err?.message || err || 'Background image fetch failed');
  }

  try {
    if (!isProtectedAsset) {
      console.warn('ACEP image embed failed', url, backgroundError);
    }
  } catch {}

  return null;
}

export async function fetchDataUrlStrong(url, tabId = null) {
  if (typeof url === 'string' && /^data:image\//i.test(url)) return url;
  const key = normalizedImageCacheKey(url);
  if (!key) return null;
  const cached = imageFetchCache.get(key);
  if (cached && (Date.now() - cached.ts) < cached.ttl) return cached.value;
  if (imageFetchInflight.has(key)) return imageFetchInflight.get(key);

  const request = fetchDataUrlStrongUncached(url, tabId)
    .then((value) => {
      imageFetchCache.set(key, {
        value: value || null,
        ts: Date.now(),
        ttl: value ? IMAGE_FETCH_CACHE_TTL_MS : IMAGE_FETCH_FAILURE_TTL_MS,
      });
      return value || null;
    })
    .finally(() => imageFetchInflight.delete(key));
  imageFetchInflight.set(key, request);
  return request;
}

/**
 * Normalize base64 data URLs with incorrect mime types
 * Detects image format from magic bytes
 * @param {string} dataUrl
 * @returns {string|null} Corrected data URL
 */
export function normalizeOctetStreamDataUrl(u = '') {
  try {
    const s = String(u || '').trim();
    if (!/^data:[^;]+;base64,/i.test(s)) return null;
    if (/^data:image\//i.test(s)) return s;
    if (!/^data:(application|binary)\/octet-stream;base64,/i.test(s) && !/^data:[^;]*octet-stream;base64,/i.test(s)) {
      return null;
    }

    const b64 = s.split(',')[1] || '';
    if (!b64) return null;

    const bin = atob(b64.slice(0, 64)); // enough for magic bytes
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);

    const isPng = bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47 && bytes[4] === 0x0D && bytes[5] === 0x0A && bytes[6] === 0x1A && bytes[7] === 0x0A;
    if (isPng) return `data:image/png;base64,${b64}`;

    const isJpg = bytes.length >= 3 && bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF;
    if (isJpg) return `data:image/jpeg;base64,${b64}`;

    const isGif = bytes.length >= 4 && bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x38;
    if (isGif) return `data:image/gif;base64,${b64}`;

    const isWebp = bytes.length >= 12 && bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50;
    if (isWebp) return `data:image/webp;base64,${b64}`;
  } catch {}

  return null;
}

/**
 * Filter URLs that should not be embedded
 * @param {string} url
 * @returns {boolean} True if URL should be skipped
 */
export function shouldSkipEmbedUrl(u = '') {
  const s = String(u || '').trim();
  if (!s) return true;
  if (/^(chrome-extension|moz-extension|ms-browser-extension|safari-extension):\/\//i.test(s)) return true;
  if (/gstatic\.com\/images\/branding\/productlogos\/youtube\//i.test(s)) return true;
  if (/i\.ytimg\.com\//i.test(s)) return true;
  if (/google\.com\/s2\/favicons/i.test(s)) return true;
  if (/lh3\.google\.com\/u\/\d+\/ogw\//i.test(s)) return true;
  if (/\/file-icons\//i.test(s)) return true;
  return false;
}

/**
 * Check if data URL is SVG
 * @param {string} dataUrl
 * @returns {boolean}
 */
export function isSvgDataUrl(u = '') {
  return /^data:image\/svg\+xml(;base64|;(utf8|charset=utf-8))?,/i.test((u || '').trim());
}

/**
 * Convert SVG data URL to PNG data URL
 * @param {string} svgDataUrl
 * @returns {Promise<string|null>} PNG data URL
 */
export async function svgToPngDataUrl(svgDataUrl) {
  try {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    const p = new Promise((resolve, reject) => {
      img.onload = () => {
        try {
          const w = img.naturalWidth || img.width || 320;
          const h = img.naturalHeight || img.height || 240;
          const c = document.createElement('canvas');
          c.width = w; c.height = h;
          const ctx = c.getContext('2d');
          ctx.drawImage(img, 0, 0, w, h);
          resolve(c.toDataURL('image/png'));
        } catch (e) { reject(e); }
      };
      img.onerror = reject;
    });
    img.src = svgDataUrl;
    return await p;
  } catch {
    return null;
  }
}

/**
 * Convert any image data URL to PNG format
 * @param {string} dataUrl
 * @returns {Promise<string|null>} PNG data URL
 */
export async function dataUrlToPng(dataUrl) {
  try {
    const img = new Image();
    const p = new Promise((resolve, reject) => {
      img.onload = () => {
        try {
          const w = img.naturalWidth || img.width || 320;
          const h = img.naturalHeight || img.height || 240;
          const c = document.createElement('canvas');
          c.width = w; c.height = h;
          const ctx = c.getContext('2d');
          ctx.drawImage(img, 0, 0, w, h);
          resolve(c.toDataURL('image/png'));
        } catch (e) { reject(e); }
      };
      img.onerror = reject;
    });
    img.src = dataUrl;
    return await p;
  } catch {
    return null;
  }
}

/**
 * Process all images in export rows, converting to data URLs
 * @param {Array} rows - Export rows with img objects
 * @param {number} tabId - Tab ID for page context fetch
 * @returns {Promise<void>}
 */
export async function ensureRowImagesData(rows = [], tabId = null) {
  const fetchCache = new Map();
  for (const row of rows) {
    if (!row?.imgs || !Array.isArray(row.imgs)) continue;

    for (const img of row.imgs) {
      if (!img) continue;

      let src = img.dataUrl || img.pngDataUrl || '';
      if (!src) {
        const orig = String(img.originalSrc || '').trim();
        const s = String(img.src || '').trim();
        const looksUrl = (u = '') => /^(https?:|data:|blob:)/i.test(u) || u.startsWith('/');

        if (s && /^data:image\//i.test(s)) src = s;
        else if (orig && looksUrl(orig)) src = orig;
        else src = s || orig;
      }

      if (!src) continue;
      if (shouldSkipEmbedUrl(src)) continue;

      // Normalize octet-stream data URLs
      const fixed = normalizeOctetStreamDataUrl(src);
      if (fixed) {
        img.dataUrl = fixed;
        img.pngDataUrl = fixed;
        src = fixed;
      }

      const isSvg = isSvgDataUrl(src);
      if (isSvg) {
        img.dataUrl = src;
        if (!img.svgText) {
          try {
            if (/;base64,/i.test(src)) {
              const b64 = src.split(',')[1] || '';
              img.svgText = atob(b64);
            } else if (/;(utf8|charset=utf-8),/i.test(src)) {
              img.svgText = decodeURIComponent(src.split(',')[1] || '');
            }
          } catch {}
        }
        if (!img.pngDataUrl) {
          try { img.pngDataUrl = await svgToPngDataUrl(src); } catch {}
        }
        continue;
      }

      // If already have good image dataUrl, keep it
      if (/^data:image\/[a-z0-9.+-]+;base64,/i.test(src)) {
        if (!/^data:image\/(png|jpe?g);base64,/i.test(src) && !isSvgDataUrl(src)) {
          const converted = await dataUrlToPng(src);
          if (converted) {
            img.dataUrl = converted;
            img.pngDataUrl = converted;
            continue;
          }
          if (/^data:image\/avif;base64,/i.test(src)) {
            img.dataUrl = '';
            continue;
          }
        }
        img.dataUrl = src;
        continue;
      }

      // Otherwise fetch
      const cacheKey = String(src || '').split('#')[0];
      let d = cacheKey && fetchCache.has(cacheKey)
        ? fetchCache.get(cacheKey)
        : await fetchDataUrlStrong(src, tabId);
      if (cacheKey && !fetchCache.has(cacheKey)) fetchCache.set(cacheKey, d || '');
      if (!d) {
        try {
          const root = (typeof document !== 'undefined') ? document.documentElement : null;
          if (root) {
            const prev = Number(root.getAttribute('data-acep-image-fetch-failed') || '0');
            root.setAttribute('data-acep-image-fetch-failed', String(prev + 1));
            root.setAttribute('data-acep-image-fetch-last-failed', String(src || '').slice(0, 500));
          }
        } catch {}
        continue;
      }

      // Normalize octet-stream responses
      if (typeof d === 'string' && /^data:(application|binary)\/octet-stream;base64,/i.test(d.trim())) {
        d = d.trim().replace(/^data:(application|binary)\/octet-stream;base64,/i, 'data:image/png;base64,');
      }

      if (isSvgDataUrl(d)) {
        img.dataUrl = d;
        try {
          if (/;base64,/i.test(d)) {
            const b64 = d.split(',')[1] || '';
            img.svgText = atob(b64);
          } else if (/;(utf8|charset=utf-8),/i.test(d)) {
            img.svgText = decodeURIComponent(d.split(',')[1] || '');
          }
        } catch {}
        if (!img.pngDataUrl) {
          try { img.pngDataUrl = await svgToPngDataUrl(d); } catch {}
        }
        continue;
      }

      if (/^data:image\/(png|jpe?g);base64,/i.test(d)) {
        img.dataUrl = d;
        img.pngDataUrl = d;
        continue;
      }

      // Try to convert unsupported formats to PNG
      if (/^data:image\/[a-z0-9.+-]+;base64,/i.test(d)) {
        const converted = await dataUrlToPng(d);
        if (converted) {
          img.dataUrl = converted;
          img.pngDataUrl = converted;
          continue;
        }
      }

      img.dataUrl = d;
    }
  }
}
