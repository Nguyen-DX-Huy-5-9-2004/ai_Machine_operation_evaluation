/* AI Chat Exporter Pro
 * - All export formats run locally in-browser (no server)
 * - Uses base64 icons for TXT/DOCX, and branding on all pages
 */

import {
  buildPlainTextFromBlocks,
  decodeHtmlEntities,
  extractAsciiTableFromText,
  extractMarkdownPipeTableFromText,
  htmlToPlainTextLocal,
  markdownToHtmlSimple,
  normalizeArtifactMarkdownHtml,
  parseAsciiBoxTable,
  parseHtmlBlocks,
  parseHtmlBlocksForDocx,
  renderMarkdownTableFromBody,
} from './core/html_blocks.js';

import {
  ensureDocx,
  ensureGlobalKatexCss,
  ensureHtml2Canvas,
  ensureHtmlToPdfMake,
  ensureKatexLib,
  ensurePdfMake,
  loadScriptOnce,
} from './core/loaders.js';

import {
  ensureEmojiFont,
  ensureNotoSansFont,
  ensureSymbol2Font,
  ensureSymbolFont,
  ensurePdfMakeFontFamily,
  loadFontToVfs,
} from './core/pdf_fonts.js';

import {
  htmlToCanvas,
  pngBlobSafeFromCanvas,
} from './core/canvas.js';

import {
  loadIconAssets,
  loadIconFromCandidates,
} from './core/icon_assets.js';

import {
  buildHtmlWithHeader,
  hasKatexInHtml,
  highlightCode,
} from './core/exporters/html.js';

import {
  buildDocxParagraphsForRow,
} from './core/exporters/docx.js';

import {
  buildPdfRenderBundle,
  createServerPdfJob,
  getServerPdfDownloadUrl,
  pollServerPdfJob,
} from './core/exporters/server_pdf.js';

import {
  inlineHtmlImagesFromRowsHtml,
  inlineRowHtmlImagesFromRowImgs,
} from './core/exporters/html_inline_images.js';

import {
  getProviderLabelFromUrl,
  getProviderKeyFromUrl,
  isLikelyImageUrl,
  isLikelyImageUrlForLink,
  getProviderIconPaths,
  shouldUseBackgroundFetch,
  detectProvider,
} from './core/provider-helpers.js';

import {
  fetchDataUrlStrong,
  ensureRowImagesData,
  normalizeOctetStreamDataUrl,
  shouldSkipEmbedUrl,
  isSvgDataUrl,
  svgToPngDataUrl,
  dataUrlToPng,
} from './core/image-handler.js';

async function setSourcePageDebugAttr(tabId, name, value) {
  try {
    if (!tabId || !name) return;
    await browser.tabs.sendMessage(tabId, {
      type: 'ACEP_SET_PAGE_DEBUG_ATTR',
      name,
      value: String(value || ''),
    });
  } catch {}
}
async function inlineFinalHtmlProviderImages(html = '', { tabId = null, providerKey = '' } = {}) {
  try {
    if (!html || typeof DOMParser === 'undefined') return String(html || '');
    const inputWasFullDocument = /<!doctype\s+html|<html[\s>]/i.test(String(html || ''));
    const parser = new DOMParser();
    const doc = parser.parseFromString(String(html || ''), 'text/html');
    const imgs = Array.from(doc.querySelectorAll('img[src]'));
    if (!imgs.length) return html;
    const shouldInline = (src = '') => {
      const s = String(src || '').trim();
      if (!/^https?:\/\//i.test(s)) return false;
      if (/deepseek-api-files|myhuaweicloud|\bobs\.|chat\.deepseek\.com\/api\/|deepseek\.com\/api\//i.test(s)) return true;
      if (providerKey === 'deepseek' && /\/api\/.+\/(preview|content)\b/i.test(s)) return true;
      return false;
    };
    const cache = new Map();
    const audit = [];
    for (const img of imgs) {
      const src = img.getAttribute('src') || '';
      if (!shouldInline(src)) {
        if (providerKey === 'deepseek' && !/^data:image\//i.test(src)) audit.push({ status: 'not-targeted', src: src.slice(0, 240), alt: (img.getAttribute('alt') || '').slice(0, 80) });
        continue;
      }
      const key = (() => { try { const u = new URL(src); u.hash = ''; return u.toString(); } catch { return src.split('#')[0]; } })();
      let dataUrl = cache.has(key) ? cache.get(key) : await fetchDataUrlStrong(src, tabId).catch((err) => ({ __acepError: String(err?.message || err || 'fetch failed') }));
      if (!(typeof dataUrl === 'string' && /^data:image\//i.test(dataUrl))) {
        try {
          const retry = new URL(src);
          if (/deepseek\.com$/i.test(retry.hostname) && /\/api\/v0\/file\/(preview|content)\b/i.test(retry.pathname)) {
            retry.searchParams.delete('message_id');
            if (/\/preview\b/i.test(retry.pathname)) retry.pathname = retry.pathname.replace(/\/preview\b/i, '/content');
            const retryUrl = retry.toString();
            dataUrl = await fetchDataUrlStrong(retryUrl, tabId).catch((err) => ({ __acepError: String(err?.message || err || 'retry failed') }));
          }
        } catch {}
      }
      if (!(typeof dataUrl === 'string' && /^data:image\//i.test(dataUrl))) {
        try {
          let backgroundUrl = src;
          try {
            const resolved = await browser.tabs.sendMessage(tabId, { type: 'ACEP_DEEPSEEK_RESOLVE_PREVIEW_URL', url: src });
            if (resolved && resolved.ok && typeof resolved.url === 'string' && resolved.url) backgroundUrl = resolved.url;
          } catch {}
          const bg = await browser.runtime.sendMessage({ type: 'ACEP_FETCH_DATAURL', url: backgroundUrl, force: true, noCache: true });
          if (bg && bg.ok && typeof bg.dataUrl === 'string') dataUrl = bg.dataUrl;
          else if (bg && bg.error) dataUrl = { __acepError: `background: ${bg.error}` };
          try { if (backgroundUrl !== src) audit.push({ status: 'resolved-obs', src: backgroundUrl.slice(0, 240) }); } catch {}
        } catch (err) { dataUrl = { __acepError: String(err?.message || err || 'background retry failed') }; }
      }
      if (typeof dataUrl === 'string' && /^data:[^;]+;base64,/i.test(dataUrl) && !/^data:image\//i.test(dataUrl)) {
        const normalized = normalizeOctetStreamDataUrl(dataUrl);
        if (normalized) dataUrl = normalized;
      }
      if (!cache.has(key)) cache.set(key, dataUrl || '');
      if (typeof dataUrl === 'string' && /^data:image\//i.test(dataUrl)) {
        img.setAttribute('data-original-src', src);
        img.setAttribute('src', dataUrl);
        img.removeAttribute('srcset');
        audit.push({ status: 'inlined', src: key.slice(0, 240), bytes: dataUrl.length });
      } else {
        audit.push({ status: 'failed', src: key.slice(0, 240), alt: (img.getAttribute('alt') || '').slice(0, 80), error: dataUrl?.__acepError || '' });
      }
    }
    try { globalThis.__acepLastPdfImageInlineAudit = audit; } catch {}
    if (inputWasFullDocument) return '<!doctype html>\n' + (doc.documentElement?.outerHTML || html);
    return doc.body ? doc.body.innerHTML : html;
  } catch {
    return String(html || '');
  }
}
const ASSISTANT_ICON_FALLBACK = ['icons/chatgpt-purple.PNG', 'icons/icon_chatgpt.png'];

(function ensureBrowserPromises(){
  try {
    const api = (typeof globalThis !== 'undefined' && globalThis.browser) ? globalThis.browser : null;
    if (!api) return;
    const p = (obj, method) => {
      const fn = obj && obj[method];
      if (!fn) return;
      obj[method] = function(...args){
        const last = args.length ? args[args.length-1] : undefined;
        if (typeof last === 'function') {
          return fn.apply(this, args);
        }
        try { const r = fn.apply(this, args); if (r && typeof r.then === 'function') return r; } catch {}
        return new Promise((resolve) => fn.apply(this, [...args, resolve]));
      };
    };
    if (api.storage && api.storage.sync) { p(api.storage.sync, 'get'); p(api.storage.sync, 'set'); }
    if (api.storage && api.storage.local) { p(api.storage.local, 'get'); p(api.storage.local, 'set'); }
    if (api.tabs) { p(api.tabs, 'query'); p(api.tabs, 'create'); p(api.tabs, 'sendMessage'); }
    if (api.permissions) { p(api.permissions, 'request'); }
    if (api.runtime) { p(api.runtime, 'sendMessage'); }
  } catch {}
})();

(async () => {
  // ====== DOM ======
  const fileNameEl = document.getElementById('file-name');
  const fileTypeEl = document.getElementById('file-type');
  const exportBtn  = document.getElementById('export-btn');
  const saveBtn    = document.getElementById('save-btn');
  const saveConfirmEl = document.getElementById('save-confirm');
  const networkErrorEl = document.getElementById('network-error');
  const langEl     = document.getElementById('lang');
  const langConfirmEl = document.getElementById('lang-save-confirm');
  const titleInput = document.getElementById('title');

  const settingsOverlay = document.getElementById('settings-overlay');
  const successOverlay  = document.getElementById('success-overlay');
  const readyNameEl     = document.getElementById('ready-file-name');
  const downloadBtn     = document.getElementById('download-btn');
  const closeBtn        = document.getElementById('close-button');

  const removeBrandingEl = document.getElementById('remove-branding');
  const removeIconsEl    = document.getElementById('remove-icons');
  const exportOptionsCard = document.getElementById('export-options-card');
  const muteEl           = document.getElementById('mute-export');
  const muteDownloadEl   = document.getElementById('mute-download');
  const advToggleWrap    = document.getElementById('advanced-toggle');
  const advEnableEl      = document.getElementById('advanced-enable');
  const advSection       = document.getElementById('advanced-section');
  const advPageFormatEl  = document.getElementById('adv-page-format');
  const advOrientationEl = document.getElementById('adv-orientation');
  const advMarginEl      = document.getElementById('adv-margin');
  const advFontEl        = document.getElementById('adv-font');
  const advFontSizeEl    = document.getElementById('adv-fontsize');
  const advThemeEl       = document.getElementById('adv-theme');
  const advTocEl         = document.getElementById('adv-toc');
  const advPagebreakEl   = document.getElementById('adv-pagebreak');
  const advRemovePgNumEl = document.getElementById('adv-remove-pgnum');
  const advUserNameEl    = document.getElementById('adv-user-name');
  const advUserEmailEl   = document.getElementById('adv-user-email');
  const advDateTimeEl    = document.getElementById('adv-include-datetime');
  const advPageFormatWrap  = document.getElementById('adv-page-format-wrap');
  const advOrientationWrap = document.getElementById('adv-orientation-wrap');
  const advMarginWrap      = document.getElementById('adv-margin-wrap');
  const advTocWrap         = document.getElementById('adv-toc-wrap');
  const advPagebreakWrap   = document.getElementById('adv-pagebreak-wrap');
  const advRemovePgnumWrap = document.getElementById('adv-remove-pgnum-wrap');
  const advUserInfoWrap    = document.getElementById('adv-userinfo-wrap');

  // Provider-specific preference checkboxes (Settings page).
  const grokShowMarkdownEl        = document.getElementById('grok-show-markdown-content');
  const chatgptShowDiagramCodeEl  = document.getElementById('chatgpt-show-diagram-code');

  // Tracks whether the user has manually changed any setting before loadExportPrefs() completes.
  // If true, we skip restoring from storage to avoid overwriting the user's explicit choices.
  let _userHasModifiedSettings = false;

  function normalizeLanguageOptionLabels() {
    try {
      if (!langEl) return;
      const labels = {
        en: 'English',
        de: 'Deutsch (German)',
        it: 'Italiano (Italian)',
        id: 'Bahasa Indonesia',
        ru: 'Russian',
        ja: 'Japanese',
        zh_CN: 'Chinese (Simplified)',
        hi: 'Hindi',
        ur: 'Urdu',
        sw: 'Kiswahili (Swahili)',
        pt_BR: 'Portuguese (Brazil)',
        es: 'Spanish',
        ar: 'Arabic',
        fr: 'French',
        tr: 'Turkish',
      };
      Array.from(langEl.options || []).forEach((option) => {
        const label = labels[option.value];
        if (label) option.textContent = label;
      });
    } catch {}
  }
  normalizeLanguageOptionLabels();

  // Confirm modal
  const confirmOverlay   = document.getElementById('confirm-overlay');
  const confirmTitleEl   = document.getElementById('confirm-title');
  const confirmOkBtn     = document.getElementById('confirm-ok');
  const confirmCancelBtn = document.getElementById('confirm-cancel');

  // Share UI
  const makeLinkBtn   = document.getElementById('make-link-btn');
  const shareLinkRow  = document.getElementById('share-link-row');
  const shareLinkA    = document.getElementById('share-link-a');
  const copyLinkBtn   = document.getElementById('copy-link-btn');
  // Refresh share metadata whenever user touches share controls
  makeLinkBtn?.addEventListener('click', () => { loadLastShareMeta().catch(()=>{}); });
  shareLinkRow?.addEventListener('click', () => { loadLastShareMeta().catch(()=>{}); });
  // API base for license + pre-signed uploads
  const API_BASE = 'https://acep-api.workpent.com';

  // Storage helper that works on Firefox (browser.storage.local) and Chrome
  let STORAGE_AREA = null;
  async function getStorageArea(){
    if (STORAGE_AREA) return STORAGE_AREA;
    try {
      if (typeof browser !== 'undefined' && browser.storage?.local) {
        STORAGE_AREA = browser.storage.local;
        return STORAGE_AREA;
      }
    } catch {}
    try {
      const local = chrome?.storage?.local;
      if (local) {
        STORAGE_AREA = {
          get: (keys) => new Promise((res, rej) => local.get(keys, r => { const e = browser.runtime.lastError; if (e) rej(e); else res(r); })),
          set: (items) => new Promise((res, rej) => local.set(items, () => { const e = browser.runtime.lastError; if (e) rej(e); else res(); })),
        };
        return STORAGE_AREA;
      }
    } catch {}
    try {
      const sync = chrome?.storage?.sync;
      if (sync) {
        STORAGE_AREA = {
          get: (keys) => new Promise((res, rej) => sync.get(keys, r => { const e = browser.runtime.lastError; if (e) rej(e); else res(r); })),
          set: (items) => new Promise((res, rej) => sync.set(items, () => { const e = browser.runtime.lastError; if (e) rej(e); else res(); })),
        };
        return STORAGE_AREA;
      }
    } catch {}
    // In-memory fallback
    const mem = {};
    STORAGE_AREA = {
      async get(keys){ if (Array.isArray(keys)) { const out={}; keys.forEach(k=>out[k]=mem[k]); return out; } return { ...mem, ...keys }; },
      async set(items){ Object.assign(mem, items||{}); },
    };
    return STORAGE_AREA;
  }
  // Track last export meta for sharing
  let LAST_PROVIDER_LABEL = 'AI';
  let LAST_PROVIDER_KEY = '';

  async function getLicenseToken(){
    try { const s = await getStorageArea(); const r = await s.get({ licenseToken: '' }); return (r && r.licenseToken) || ''; } catch { return ''; }
  }
  // Server-side PDF offload was removed; all exports are generated locally in the browser.

  // Plan/usage helpers
  async function getPlanFromStorage(){
    try { const s = await getStorageArea(); const r = await s.get({ plan: 'free' }); return (r && r.plan) || 'free'; } catch { return 'free'; }
  }
  async function ensureInstallId(){
    try {
      const s = await getStorageArea();
      const r = await s.get({ installId: '' });
      if (r && r.installId) return r.installId;
      const id = (crypto && crypto.randomUUID) ? crypto.randomUUID() : String(Date.now())+Math.random().toString(36).slice(2);
      await s.set({ installId: id });
      return id;
    } catch { return 'unknown'; }
  }
  async function sha256HexForApi(value = '') {
    const bytes = value instanceof Blob
      ? new Uint8Array(await value.arrayBuffer())
      : new TextEncoder().encode(String(value || ''));
    const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
    return Array.from(digest, (byte) => byte.toString(16).padStart(2, '0')).join('');
  }
  async function signedHeadersForApi(method, urlOrPath, body = '') {
    const resolved = new URL(String(urlOrPath || ''), API_BASE);
    const bodyHash = await sha256HexForApi(body);
    const response = await browser.runtime.sendMessage({
      type: 'ACEP_SIGN_API_REQUEST',
      method: String(method || 'GET').toUpperCase(),
      path: resolved.pathname,
      bodyHash,
    });
    if (!response?.ok || !response?.headers) {
      throw new Error(response?.error || 'Could not authenticate API request');
    }
    return response.headers;
  }
  function getChannel(){
    try { if (typeof browser !== 'undefined' && browser.runtime) return 'firefox'; } catch {}
    try { const ua = navigator.userAgent||''; if (/Edg/i.test(ua)) return 'edge'; if (/Chrome/i.test(ua)) return 'chrome'; } catch {}
    return 'webext';
  }
  function getVersion(){ try { return (browser.runtime.getManifest()?.version) || '0'; } catch { return '0'; } }

  const ANALYTICS_EXPORT_URL = 'https://chatexport.workpent.com/api/extension/analytics/export';
  const ANALYTICS_BACKOFF_KEY = 'acep_analytics_backoff_until_v1';
  const ANALYTICS_BACKOFF_MS = 6 * 60 * 60 * 1000;

  function analyticsFormatFromWant(want = '') {
    switch (String(want || '').toLowerCase()) {
      case 'pdf_text': return 'pdf';
      case 'docx': return 'docx';
      case 'png_plain': return 'png';
      case 'txt': return 'txt';
      case 'md': return 'markdown';
      case 'csv': return 'csv';
      case 'json': return 'json';
      case 'html_linked':
      case 'html_self': return 'html';
      default: return String(want || 'unknown').replace(/[^a-z0-9_-]/gi, '').toLowerCase() || 'unknown';
    }
  }

  function analyticsProviderFromUrl(url = '') {
    const key = getProviderKeyFromUrl(url || '') || '';
    return key || 'unknown';
  }

  function analyticsExportMode(want = '', selectedTurnIds = null, selectionFilter = '') {
    if (Array.isArray(selectedTurnIds) && selectedTurnIds.length) return 'selective';
    const filter = String(selectionFilter || '').trim();
    if (filter && filter !== 'all') return filter;
    if (String(want || '').toLowerCase() === 'html_linked') return 'linked';
    return 'full';
  }

  function analyticsErrorCode(error) {
    const raw = String(error?.message || error || 'unknown_error');
    if (/ACEP_NETWORK_ERROR/i.test(raw)) return 'provider_network_error';
    if (/abort|cancel/i.test(raw)) return 'export_canceled';
    if (/timeout/i.test(raw)) return 'export_timeout';
    if (/pdf/i.test(raw) && /render|job|lambda|server/i.test(raw)) return 'pdf_render_failed';
    return raw.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 80) || 'unknown_error';
  }

  function sendAnalyticsToBackgroundNow(payload) {
    try {
      const marker = {
        at: new Date().toISOString(),
        format: payload?.format || '',
        provider: payload?.provider || '',
        status: payload?.status || '',
        stage: 'popup_send_attempt',
      };
      try { chrome?.storage?.local?.set?.({ acep_last_analytics_popup_attempt: marker }); } catch {}
      try { browser?.storage?.local?.set?.({ acep_last_analytics_popup_attempt: marker }).catch?.(() => {}); } catch {}
    } catch {}

    let sent = false;
    try {
      if (typeof chrome !== 'undefined' && chrome.runtime && typeof chrome.runtime.sendMessage === 'function') {
        sent = true;
        chrome.runtime.sendMessage({ type: 'ACEP_ANALYTICS_EXPORT', payload }, () => {
          try {
            const err = chrome.runtime.lastError ? String(chrome.runtime.lastError.message || chrome.runtime.lastError) : '';
            chrome.storage?.local?.set?.({
              acep_last_analytics_popup_result: {
                at: new Date().toISOString(),
                ok: !err,
                error: err,
              },
            });
          } catch {}
        });
      }
    } catch {}

    try {
      if (!sent && typeof browser !== 'undefined' && browser.runtime && typeof browser.runtime.sendMessage === 'function') {
        sent = true;
        browser.runtime.sendMessage({ type: 'ACEP_ANALYTICS_EXPORT', payload }).catch(() => {});
      }
    } catch {}
    return sent;
  }
  async function sendExportAnalytics(event = {}) {
    try {

      const payload = {
        format: analyticsFormatFromWant(event.want),
        provider: analyticsProviderFromUrl(event.tabUrl),
        status: event.status === 'success' ? 'success' : 'failed',
        duration_ms: Math.max(0, Math.round(Number(event.durationMs) || 0)),
        browser: detectBrowser(),
        extension_version: getVersion(),
        timestamp: new Date().toISOString(),
      };

      if (Number.isFinite(Number(event.bytes)) && Number(event.bytes) >= 0) payload.bytes = Number(event.bytes);
      if (event.adv) {
        payload.font = String(event.adv.font || '').slice(0, 80);
        payload.theme = String(event.adv.theme || '').slice(0, 40);
        payload.page_size = String(event.adv.pageFormat || '').slice(0, 40);
        payload.orientation = String(event.adv.orientation || '').slice(0, 40);
      }
      payload.export_mode = analyticsExportMode(event.want, event.selectedTurnIds, event.selectionFilter);
      if (payload.status === 'failed') payload.error_code = analyticsErrorCode(event.error);

      if (sendAnalyticsToBackgroundNow(payload)) return;

      if (!payload.install_id) payload.install_id = await ensureInstallId();
      const s = await getStorageArea();
      const resp = await fetch(ANALYTICS_EXPORT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        mode: 'cors',
        credentials: 'omit',
        referrerPolicy: 'no-referrer',
        keepalive: true,
      });
      if (!resp.ok) await s.set({ [ANALYTICS_BACKOFF_KEY]: Date.now() + ANALYTICS_BACKOFF_MS });
    } catch {}
  }

  // Cache plan for quick checks
  let CURRENT_PLAN = 'free';
  let CURRENT_TAB_ID = null;
  let SHOULD_PROMPT_AFTER_SUCCESS = false;

  // Limits (configurable via storage)
  async function getLimits(){
    const defaults = { freePageLimit: 1000000 , freeMonthlyLimit: 1000000 };
    try { const s = await getStorageArea(); const r = await s.get(defaults); return { page: Number(r.freePageLimit)||defaults.freePageLimit, monthly: Number(r.freeMonthlyLimit)||defaults.freeMonthlyLimit }; }
    catch { return { page: defaults.freePageLimit, monthly: defaults.freeMonthlyLimit }; }
  }

  // Pro gating helpers
  // Pro gating removed: all features enabled for all users
  function proOnlyPrompt() { return Promise.resolve('ok'); }
  async function applyPlanGating(){
    // Free launch: no gating, keep everything enabled
    try { if (removeBrandingEl) { removeBrandingEl.disabled = false; } } catch {}
    try { if (removeIconsEl) { removeIconsEl.disabled = false; } } catch {}
    try { if (muteEl) { muteEl.disabled = false; } } catch {}
    try {
      setDisplay(exportOptionsCard, true);
      setDisplay(removeBrandingEl?.closest('.check-row') || removeBrandingEl, true);
      setDisplay(removeIconsEl?.closest('.check-row') || removeIconsEl, true);
    } catch {}
    try { if (makeLinkBtn) { makeLinkBtn.title = ''; } } catch {}
  }

  // Page estimation for paginated formats
  function estimatePagesFromRows(rows){
    let totalChars = 0, imageCount = 0;
    for (const r of (rows||[])) {
      const text = (typeof r?.text === 'string' && r.text.trim()) ? r.text : '';
      totalChars += text.length;
      if (Array.isArray(r?.imgs)) imageCount += r.imgs.length;
    }
    const textPages = Math.ceil(totalChars / 1500);
    const imagePages = Math.ceil(imageCount * 0.33);
    return Math.max(1, textPages + imagePages);
  }
  function estimatePagesFromQuick(textLen, imageCount){
    const textPages = Math.ceil((Number(textLen)||0) / 1500);
    const imagePages = Math.ceil((Number(imageCount)||0) * 0.33);
    return Math.max(1, textPages + imagePages);
  }
  async function quickEstimateGateIfNeeded(){ return true; }
  async function preflightPageGateIfNeeded(){ return true; }
  function readAdvancedOptions() {
    return {
      pageFormat: advPageFormatEl?.value || 'A4',
      orientation: advOrientationEl?.value || 'portrait',
      margin: Number(advMarginEl?.value) || 20,
      font: advFontEl?.value || 'TimesNewRoman',
      fontSize: Number(advFontSizeEl?.value) || 14,
      theme: advThemeEl?.value || 'light',
      toc: !!advTocEl?.checked,
      pageBreakPerPrompt: !!advPagebreakEl?.checked,
      removePageNumbers: !!advRemovePgNumEl?.checked,
      userName: advUserNameEl?.value || '',
      userEmail: advUserEmailEl?.value || '',
      includeDateTime: !!advDateTimeEl?.checked,
      // Non-advanced toggles are still needed by exporters (HTML header, icons, branding, etc.).
      removeIcons: !!getRemoveIcons(),
      removeBranding: !!getRemoveBranding(),
      mute: !!getMute(),
      muteDownload: !!getMuteDownload(),
    };
  }

  function buildExportPrefs(want, adv){
    return {
      fileType: want,
      removeIcons: !!getRemoveIcons(),
      removeBranding: !!getRemoveBranding(),
      mute: !!getMute(),
      muteDownload: !!getMuteDownload(),
      adv: {
        pageFormat: adv.pageFormat,
        orientation: adv.orientation,
        margin: adv.margin,
        font: adv.font,
        fontSize: adv.fontSize,
        theme: adv.theme,
        toc: adv.toc,
        pageBreakPerPrompt: adv.pageBreakPerPrompt,
        removePageNumbers: adv.removePageNumbers,
        includeDateTime: adv.includeDateTime,
        userName: adv.userName,
        userEmail: adv.userEmail
      }
    };
  }

  async function saveExportPrefs(want, adv){
    try {
      const prefs = buildExportPrefs(want, adv);
      const s = await getStorageArea();
      if (!want) {
        const r = await s.get({ acep_last_export_prefs: null });
        const previousType = r?.acep_last_export_prefs?.fileType;
        if (previousType) prefs.fileType = previousType;
        else delete prefs.fileType;
      }
      await s.set({ acep_last_export_prefs: prefs });
    } catch {}
  }

  async function saveProviderPrefs() {
    try {
      const s = await getStorageArea();
      await s.set({
        acep_provider_prefs: {
          grok_showMarkdownContent: grokShowMarkdownEl ? !!grokShowMarkdownEl.checked : true,
          chatgpt_showDiagramCode: chatgptShowDiagramCodeEl ? !!chatgptShowDiagramCodeEl.checked : false,
        }
      });
    } catch {}
  }

  async function loadProviderPrefs() {
    try {
      const s = await getStorageArea();
      const r = await s.get({ acep_provider_prefs: null });
      const p = r?.acep_provider_prefs || {};
      if (grokShowMarkdownEl)       grokShowMarkdownEl.checked       = p.grok_showMarkdownContent !== false;
      if (chatgptShowDiagramCodeEl) chatgptShowDiagramCodeEl.checked = !!p.chatgpt_showDiagramCode;
    } catch {}
  }

  async function loadExportPrefs(){
    try {
      const s = await getStorageArea();
      const r = await s.get({ acep_last_export_prefs: null, acep_mute_export_default_v1: false });
      const p = r?.acep_last_export_prefs;
      if (!p) {
        if (muteEl) muteEl.checked = true;
        await s.set({ acep_mute_export_default_v1: true });
        return;
      }
      let needsPrefsMigration = false;
      if (!r.acep_mute_export_default_v1) {
        p.mute = true;
        needsPrefsMigration = true;
      }
      if (!_userHasModifiedSettings && p.fileType && fileTypeEl) fileTypeEl.value = p.fileType;
      if (removeIconsEl) removeIconsEl.checked = !!p.removeIcons;
      if (removeBrandingEl) removeBrandingEl.checked = !!p.removeBranding;
      if (muteEl) muteEl.checked = !!p.mute;
      if (muteDownloadEl) muteDownloadEl.checked = !!p.muteDownload;

      const a = p.adv || {};
      if (Number(a.fontSize) === 11) {
        a.fontSize = 14;
        needsPrefsMigration = true;
      }
      if (advPageFormatEl && a.pageFormat) advPageFormatEl.value = a.pageFormat;
      if (advOrientationEl && a.orientation) advOrientationEl.value = a.orientation;
      if (advMarginEl && Number.isFinite(Number(a.margin))) advMarginEl.value = String(a.margin);
      if (advFontEl && a.font) advFontEl.value = a.font;
      if (advFontSizeEl && Number.isFinite(Number(a.fontSize))) advFontSizeEl.value = String(a.fontSize);
      if (advThemeEl && a.theme) advThemeEl.value = a.theme;
      if (advTocEl) advTocEl.checked = !!a.toc;
      if (advPagebreakEl) advPagebreakEl.checked = !!a.pageBreakPerPrompt;
      if (advRemovePgNumEl) advRemovePgNumEl.checked = !!a.removePageNumbers;
      if (advDateTimeEl) advDateTimeEl.checked = !!a.includeDateTime;
      if (advUserNameEl) advUserNameEl.value = a.userName || '';
      if (advUserEmailEl) advUserEmailEl.value = a.userEmail || '';

      updateAdvancedVisibility();
      try {
        const isAuto = fileNameEl?.dataset?.autofill !== '0';
        if (isAuto && fileNameEl && fileTypeEl) {
          const base = stripExt(fileNameEl.value || 'AI Conversation');
          fileNameEl.value = withExt(base, fileTypeEl.value);
        }
      } catch {}
      if (needsPrefsMigration) {
        try {
          await s.set({ acep_last_export_prefs: p, acep_mute_export_default_v1: true });
        } catch {}
      }
    } catch {}
  }

  function setDisplay(el, show) {
    if (!el) return;
    el.style.display = show ? '' : 'none';
  }
  function updateAdvancedVisibility() {
    const ft = (fileTypeEl?.value || '').toLowerCase();
    const isPaged = ft === 'pdf_text' || ft === 'docx';
    const isHtml = ft === 'html_self' || ft === 'html_linked';
    const isPlain = ft === 'txt' || ft === 'csv' || ft === 'json' || ft === 'md' || ft === 'markdown';
    const isPng = ft === 'png_plain';
    // The settings page has no visible format selector, so hiding controls based on the
    // previously selected format makes options appear to vanish. Keep all settings visible;
    // exporters simply ignore options that do not apply to their format.
    setDisplay(advPageFormatWrap, true);
    setDisplay(advOrientationWrap, true);
    setDisplay(advMarginWrap, true);
    setDisplay(advPagebreakWrap, true);
    setDisplay(advRemovePgnumWrap, true);
    setDisplay(advTocWrap, true);
    setDisplay(advUserInfoWrap, true);
    setDisplay(advFontEl?.closest('.field') || advFontEl, true);
    setDisplay(advFontSizeEl?.closest('.field') || advFontSizeEl, true);
    setDisplay(advThemeEl?.closest('.field') || advThemeEl, true);
    setDisplay(exportOptionsCard, true);
    setDisplay(removeBrandingEl?.closest('.check-row') || removeBrandingEl, true);
    setDisplay(removeIconsEl?.closest('.check-row') || removeIconsEl, true);
    setDisplay(muteEl?.closest('.check-row') || muteEl, true);
    setDisplay(muteDownloadEl?.closest('.check-row') || muteDownloadEl, true);
    setDisplay(advDateTimeEl?.closest('.check-row') || advDateTimeEl, true);
    // Keep shared options (remove branding/icons/mute) always visible
    // and no page-break option for HTML as requested.
    if (isHtml && advPagebreakEl) advPagebreakEl.checked = false;
  }

  // Track last export meta for server hints
  let LAST_ESTIMATED_PAGES = 0;
  let LAST_FORMAT = '';

  // Monthly conversion gating (UX only)
  async function getUsage(){
    const now = new Date();
    const ym = `${now.getUTCFullYear()}-${String(now.getUTCMonth()+1).padStart(2,'0')}`;
    const s = await getStorageArea();
    const { usageMonth = '', usageCount = 0 } = await s.get({ usageMonth: '', usageCount: 0 });
    return { monthKey: ym, count: (usageMonth===ym)? usageCount : 0 };
  }
  async function bumpUsage(){
    const s = await getStorageArea();
    const u = await getUsage();
    const next = { usageMonth: u.monthKey, usageCount: u.count + 1 };
    await s.set(next);
    return next;
  }
  async function monthlyGateIfNeeded(){ return true; }

  // ====== i18n bootstrap ======
  let __t = (k, subs=[]) => browser.i18n.getMessage(k, subs) || k;
  const __esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => (
    c === '&' ? '&amp;' :
    c === '<' ? '&lt;' :
    c === '>' ? '&gt;' :
    c === '"' ? '&quot;' : '&#39;'
  ));
  function decorateHearts() {
    try {
      const el = document.getElementById('modal-subtitle');
      if (!el) return;
      try { if (el.querySelector && el.querySelector('.acep-emoji-heartbeat')) return; } catch {}
      const raw = String(el.textContent || '');
      const candidates = ['\u{1F49C}', '\u2764\uFE0F', '\u2764', '\u2665'];
      let heart = '';
      let idx = -1;
      for (const c of candidates) {
        const i = raw.indexOf(c);
        if (i !== -1) { heart = c; idx = i; break; }
      }
      if (idx === -1) return;
      const before = raw.slice(0, idx);
      const after = raw.slice(idx + heart.length);
      el.innerHTML = `${__esc(before)}<span class="acep-emoji-heartbeat" aria-hidden="true" style="display:inline-flex;align-items:center;justify-content:center;transform-origin:center;animation:acepEmojiHeartBeat .72s cubic-bezier(.2,.9,.25,1) infinite !important;">${__esc(heart)}</span>${__esc(after)}`;
    } catch {}
  }
  function applyI18nDom() {
    const rep = (s)=> s.replace(/__MSG_([A-Za-z0-9_]+)__/g, (_,key)=>__t(key));
    const all = document.querySelectorAll('*');
    for (const el of all) {
      for (const attr of ['title','aria-label','placeholder','value']) {
        const v = el.getAttribute && el.getAttribute(attr);
        if (v && /__MSG_/.test(v)) el.setAttribute(attr, rep(v));
      }
      if (el.childNodes && el.childNodes.length) {
        el.childNodes.forEach(n=>{
          if (n.nodeType===Node.TEXT_NODE && /__MSG_/.test(n.nodeValue)) n.nodeValue = rep(n.nodeValue);
        });
      }
    }
    decorateHearts();
  }

  // Some dialogs are shown after async work; ensure the heart gets wrapped after DOM settles.
  try { setTimeout(decorateHearts, 0); } catch {}
  try { setTimeout(decorateHearts, 250); } catch {}

  // Keep the animated heart intact even if later code re-renders the localized subtitle.
  let __heartObs = null;
  function ensureHeartObserver() {
    try {
      const dlg = document.getElementById('ratingDialog');
      const el = document.getElementById('modal-subtitle');
      if (!dlg || !el || typeof MutationObserver === 'undefined') return;
      const isOpen = String(dlg.getAttribute('aria-hidden') || '') === 'false' || (dlg.style && dlg.style.display === 'flex');
      if (!isOpen) return;
      if (__heartObs) return;
      let pending = false;
      __heartObs = new MutationObserver(() => {
        if (pending) return;
        pending = true;
        setTimeout(() => {
          pending = false;
          try { decorateHearts(); } catch {}
        }, 0);
      });
      __heartObs.observe(el, { childList: true, characterData: true, subtree: true });
    } catch {}
  }
  function stopHeartObserver() {
    try { __heartObs?.disconnect?.(); } catch {}
    __heartObs = null;
  }
  // Expose a readiness promise so other initializers can await localization
  const i18nReady = (async function i18nBootstrap(){
    try {
      const s = await getStorageArea();
      const { lang = 'en' } = await s.get({ lang:'en' });
      let base = null;
      let override = null;
      try {
        const baseUrl = browser.runtime.getURL(`_locales/en/messages.json`);
        const baseResp = await fetch(baseUrl);
        if (baseResp.ok) base = await baseResp.json();
      } catch {}
      if (lang && lang !== 'en') {
        try {
          const url = browser.runtime.getURL(`_locales/${lang}/messages.json`);
          const resp = await fetch(url);
          if (resp.ok) override = await resp.json();
        } catch {}
      }
      __t = (k, subs=[]) => override?.[k]?.message || base?.[k]?.message || browser.i18n.getMessage(k, subs) || k;
    } finally {
      applyI18nDom();
    }
  })();

  // React to locale pack sent from content.js to support instant language changes
  window.addEventListener('message', async (e) => {
    try {
      if (e?.data?.type === 'ACEP_LOCALE_PACK' && e.data?.messages && typeof e.data.messages === 'object') {
        const pack = e.data.messages;
        __t = (k, subs=[]) => pack?.[k]?.message || browser.i18n.getMessage(k, subs) || k;
        applyI18nDom();
        // Re-apply plan gating so tooltips/hints update to the selected language
        try { await applyPlanGating(); } catch {}
        try { initPopupTipsScroller(); } catch {}
      }
    } catch {}
  });
  // Add near the top of popup.js
function askConfirm(title, okText, cancelText){
  return new Promise((resolve) => {
    confirmTitleEl.textContent = title || '';
    confirmOkBtn.textContent = okText || 'OK';
    confirmCancelBtn.textContent = cancelText || 'Cancel';
    confirmOverlay.style.display = 'flex';
    const onOk = ()=>{ cleanup(); resolve('ok'); };
    const onCancel = ()=>{ cleanup(); resolve('cancel'); };
    function cleanup(){
      confirmOverlay.style.display = 'none';
      confirmOkBtn.removeEventListener('click', onOk);
      confirmCancelBtn.removeEventListener('click', onCancel);
    }
    confirmOkBtn.addEventListener('click', onOk);
    confirmCancelBtn.addEventListener('click', onCancel);
  });
}

  // ====== State ======
  const ACEP = { exporting:false, canceled:false, abort:null, autoExport:false, consumedAutoExportSessions:new Set() };
  let LAST_EXPORT = { blob:null, name:"", multi:null, serverUrl:"" };
  let SHARE_URL = "";
  let UPLOADING = false;
  let SELECTED_TURN_IDS = null;
  let SELECTED_FILTER = '';

  function setLocked(v){
    const ctrls = [exportBtn, fileNameEl, fileTypeEl, removeBrandingEl, removeIconsEl, muteEl, closeBtn].filter(Boolean);
    ctrls.forEach(el => { try { el.disabled = v; } catch {} });
  }
  function setBusy(b){
    exportBtn.disabled = b;
    exportBtn.textContent = b ? (__t('progress_reading') || __t('progress_preparing') || 'Reading chat...')
                              : (__t('btn_export_now') || 'Export Now');
  }

  async function requestCloseOverlay(forceClose = false){
    if (successOverlay && window.getComputedStyle(successOverlay).display !== 'none' && !forceClose) {
      return;
    }
    if (ACEP.exporting) {
      const ans = await askConfirm(__t('confirm_stop_title'), __t('confirm_stop_ok'), __t('confirm_stop_cancel'));
      if (ans === 'ok') {
        ACEP.canceled = true;
        try { ACEP.abort?.abort(); } catch {}
        try { parent.postMessage({type:'ACEP_SET_BUSY', busy:false}, '*'); } catch {}
        try { parent.postMessage({type:'ACEP_IFRAME_MUTE', mute:false}, '*'); } catch {}
        setLocked(false);
        setBusy(false);
        try { parent.postMessage('ACEP_POPUP_CLOSE', '*'); } catch {}
      }
      return;
    }
    try {
      if (SHOULD_PROMPT_AFTER_SUCCESS) {
        SHOULD_PROMPT_AFTER_SUCCESS = false;
        triggerSupportPrompt();
      }
    } catch {}
    SELECTED_TURN_IDS = null;
    SELECTED_FILTER = '';
    try { parent.postMessage('ACEP_POPUP_CLOSE', '*'); } catch {}
    // If a support prompt is pending for this cycle, show it now
    try { if (SHOULD_PROMPT_ON_CLOSE) { SHOULD_PROMPT_ON_CLOSE = false; if (SUPPORT_FALLBACK_TIMER) clearTimeout(SUPPORT_FALLBACK_TIMER); triggerSupportPrompt(); } } catch {}
  }
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') requestCloseOverlay(); });
  [settingsOverlay].forEach(ov=>{
    ov?.addEventListener('click', (e)=>{
      try {
        if (e.target && e.target.closest && e.target.closest('[data-no-close]')) return;
      } catch {}
      const m = ov.querySelector('.modal');
      if (m && !m.contains(e.target)) requestCloseOverlay();
    });
  });
  document.getElementById('success-done-btn')?.addEventListener('click', () => requestCloseOverlay(true));
  closeBtn?.addEventListener('click', requestCloseOverlay);

  // Settings: top-level tab switching (General / Providers)
  try {
    document.querySelectorAll('.sp-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        const tab = btn.dataset.tab;
        document.querySelectorAll('.sp-tab').forEach(b => b.classList.toggle('active', b === btn));
        document.querySelectorAll('.sp-content').forEach(pane => {
          pane.style.display = pane.id === `tab-${tab}` ? '' : 'none';
        });
      });
    });
    // Provider sub-tab switching (ChatGPT, Claude, Grok, etc.)
    document.querySelectorAll('.prov-item').forEach(btn => {
      btn.addEventListener('click', () => {
        const prov = btn.dataset.prov;
        document.querySelectorAll('.prov-item').forEach(b => b.classList.toggle('active', b === btn));
        document.querySelectorAll('.prov-pane').forEach(pane => {
          pane.classList.toggle('active', pane.id === `pane-${prov}`);
        });
      });
    });
  } catch {}

  const SETTINGS_TOUR_PENDING_KEY = 'acep_settings_tour_pending';
  const SETTINGS_TOUR_HOST_ID = 'acep-settings-tour-host';
  let ACEP_SETTINGS_TOUR = { step: 0 };
  function settingsTourEscapeHtml(value = '') { return String(value || '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch])); }

  function removeSettingsTour() {
    try { document.getElementById(SETTINGS_TOUR_HOST_ID)?.remove(); } catch {}
  }

  function createSettingsTourHost() {
    let host = document.getElementById(SETTINGS_TOUR_HOST_ID);
    const mount = document.body || document.documentElement;
    if (host) {
      try { mount.appendChild(host); } catch {}
      return host;
    }
    host = document.createElement('div');
    host.id = SETTINGS_TOUR_HOST_ID;
    host.style.position = 'fixed';
    host.style.inset = '0';
    host.style.zIndex = '2147483647';
    host.style.pointerEvents = 'none';
    mount.appendChild(host);
    host.attachShadow({ mode: 'open' });
    return host;
  }

  function settingsTourCss() {
    return `
      :host{all:initial}
      .shade{position:fixed;inset:0;background:rgba(17,24,39,.25);pointer-events:auto;}
      .spot{position:fixed;border:3px solid #a78bfa;border-radius:14px;box-shadow:0 0 0 9999px rgba(17,24,39,.38),0 14px 40px rgba(81,45,168,.26);pointer-events:none;transition:all .16s ease;}
      .card{position:fixed;max-width:370px;width:min(370px,calc(100vw - 28px));background:#fff;color:#1f2937;border:1px solid #ddd6fe;border-radius:16px;box-shadow:0 18px 60px rgba(17,24,39,.24);font-family:"Segoe UI",Inter,Arial,sans-serif;pointer-events:auto;overflow:hidden;}
      .head{padding:14px 16px 8px;font-weight:900;font-size:16px;color:#4c1d95;line-height:1.25;}
      .body{padding:0 16px 14px;font-size:13px;line-height:1.5;color:#374151;}
      .actions{display:flex;gap:8px;justify-content:flex-end;align-items:center;padding:12px 14px;background:#f8f4ff;border-top:1px solid #ede9fe;flex-wrap:wrap;}
      button{border:1px solid #c4b5fd;background:#fff;color:#5b21b6;border-radius:999px;padding:8px 12px;font-weight:800;font-size:12px;cursor:pointer;font-family:inherit;}
      button.primary{background:linear-gradient(135deg,#7E57C2,#512DA8);border-color:#7E57C2;color:#fff;}
      button.ghost{border-color:transparent;background:transparent;color:#6b7280;}
      .progress{margin-right:auto;color:#7c3aed;font-weight:800;font-size:12px;}
      @media(max-width:640px){.card{left:14px!important;right:14px!important;top:auto!important;bottom:18px!important;width:auto}.spot{display:none}.shade{background:rgba(17,24,39,.16)}}
    `;
  }

  function activateSettingsTourTab(tabName) {
    try {
      const btn = document.querySelector(`.sp-tab[data-tab="${tabName}"]`);
      if (btn) btn.click();
    } catch {}
  }

  function getSettingsTourSteps() {
    return [
      { target: '#save-btn', title: __t('tour_settings_saved_title'), body: __t('tour_settings_saved_body') },
      { target: '#settings-tabs-tour-target', title: __t('tour_settings_sections_title'), body: __t('tour_settings_sections_body'), tab: 'general' },
      { target: '#mute-export-tour-row', title: __t('tour_settings_skip_loading_title'), body: __t('tour_settings_skip_loading_body'), tab: 'general' },
      { target: '#mute-download-tour-row', title: __t('tour_settings_skip_download_title'), body: __t('tour_settings_skip_download_body'), tab: 'general' },
      { target: '#language-tour-card', title: __t('tour_settings_language_title'), body: __t('tour_settings_language_body'), tab: 'general' },
      { target: '#remove-branding-tour-row', title: __t('tour_settings_branding_title'), body: __t('tour_settings_branding_body'), tab: 'general' },
      { target: '#providers-tour-layout', title: __t('tour_settings_providers_title'), body: __t('tour_settings_providers_body'), tab: 'providers' },
    ];
  }

  function positionSettingsTourCard(card, rect) {
    try {
      const vw = window.innerWidth || 1024;
      const vh = window.innerHeight || 768;
      const width = Math.min(370, vw - 28);
      let left = rect ? rect.right + 16 : vw - width - 18;
      let top = rect ? rect.top : 90;
      if (!rect || left + width > vw - 14) {
        left = rect ? rect.left : vw - width - 18;
        top = rect ? rect.bottom + 14 : 90;
      }
      if (left + width > vw - 14) left = vw - width - 14;
      if (left < 14) left = 14;
      if (top > vh - 210) top = Math.max(18, (rect ? rect.top : vh - 230) - 190);
      card.style.left = `${Math.round(left)}px`;
      card.style.top = `${Math.round(top)}px`;
    } catch {}
  }

  function showSettingsTourStep(index = 0) {
    const steps = getSettingsTourSteps();
    ACEP_SETTINGS_TOUR.step = Math.max(0, Math.min(index, steps.length - 1));
    const step = steps[ACEP_SETTINGS_TOUR.step];
    if (step.tab) activateSettingsTourTab(step.tab);
    setTimeout(() => {
      const host = createSettingsTourHost();
      const shadow = host.shadowRoot;
      const target = document.querySelector(step.target);
      try { target?.scrollIntoView?.({ block: 'center', inline: 'nearest', behavior: 'auto' }); } catch {}
      const rect = target?.getBoundingClientRect?.();
      const hasRect = rect && rect.width > 0 && rect.height > 0;
      shadow.innerHTML = `
        <style>${settingsTourCss()}</style>
        <div class="shade"></div>
        ${hasRect ? `<div class="spot" id="settings-tour-spot"></div>` : ''}
        <div class="card" id="settings-tour-card" role="dialog" aria-live="polite">
          <div class="head">${settingsTourEscapeHtml(step.title)}</div>
          <div class="body">${settingsTourEscapeHtml(step.body)}</div>
          <div class="actions">
            <span class="progress">${ACEP_SETTINGS_TOUR.step + 1}/${steps.length}</span>
            <button class="ghost" id="settings-tour-close">${settingsTourEscapeHtml(__t('tour_btn_close'))}</button>
            ${ACEP_SETTINGS_TOUR.step > 0 ? `<button id="settings-tour-prev">${settingsTourEscapeHtml(__t('tour_btn_previous'))}</button>` : ''}
            <button class="primary" id="settings-tour-next">${ACEP_SETTINGS_TOUR.step === steps.length - 1 ? settingsTourEscapeHtml(__t('tour_btn_done')) : settingsTourEscapeHtml(__t('tour_btn_next'))}</button>
          </div>
        </div>
      `;
      const spot = shadow.getElementById('settings-tour-spot');
      if (spot && hasRect) {
        spot.style.left = `${Math.max(8, rect.left - 8)}px`;
        spot.style.top = `${Math.max(8, rect.top - 8)}px`;
        spot.style.width = `${Math.max(24, rect.width + 16)}px`;
        spot.style.height = `${Math.max(24, rect.height + 16)}px`;
      }
      positionSettingsTourCard(shadow.getElementById('settings-tour-card'), hasRect ? rect : null);
      shadow.getElementById('settings-tour-close')?.addEventListener('click', async () => {
        try { await browser.storage?.local?.remove?.(SETTINGS_TOUR_PENDING_KEY); } catch {}
        removeSettingsTour();
      });
      shadow.getElementById('settings-tour-prev')?.addEventListener('click', () => showSettingsTourStep(ACEP_SETTINGS_TOUR.step - 1));
      shadow.getElementById('settings-tour-next')?.addEventListener('click', async () => {
        if (ACEP_SETTINGS_TOUR.step >= steps.length - 1) {
          try { await browser.storage?.local?.remove?.(SETTINGS_TOUR_PENDING_KEY); } catch {}
          removeSettingsTour();
          return;
        }
        showSettingsTourStep(ACEP_SETTINGS_TOUR.step + 1);
      });
    }, 120);
  }

  async function maybeStartSettingsTour() {
    try {
      const fromUrl = /[?&]settingsTour=1\b/i.test(String(location.search || ''));
      let fromStorage = false;
      try {
        const result = await browser.storage?.local?.get?.({ [SETTINGS_TOUR_PENDING_KEY]: false });
        fromStorage = !!result?.[SETTINGS_TOUR_PENDING_KEY];
      } catch {}
      try { document.documentElement.setAttribute('data-acep-settings-tour-trigger', JSON.stringify({ fromUrl, fromStorage })); } catch {}
      if (fromUrl || fromStorage) {
        ACEP_SETTINGS_TOUR.requested = true;
        ACEP_SETTINGS_TOUR.closed = false;
        try { await browser.storage?.local?.remove?.(SETTINGS_TOUR_PENDING_KEY); } catch {}
        const startTour = () => {
          try {
            if (ACEP_SETTINGS_TOUR.closed) return;
            if (!document.getElementById(SETTINGS_TOUR_HOST_ID)) showSettingsTourStep(0);
          } catch (e) {
            try { document.documentElement.setAttribute('data-acep-settings-tour-error', String(e?.message || e).slice(0, 500)); } catch {}
          }
        };
        [250, 900, 1600].forEach((delay) => setTimeout(startTour, delay));
      }
    } catch (e) {
      try { document.documentElement.setAttribute('data-acep-settings-tour-error', String(e?.message || e).slice(0, 500)); } catch {}
    }
  }
  try { setTimeout(() => { try { maybeStartSettingsTour(); } catch {} }, 300); } catch {}

  window.addEventListener('message', async (ev) => {
    const data = ev && ev.data;
    try { console.log('[ACEP popup] window.message received', data && data.type); } catch {}
    if (!data) return;
    // Download trigger from the in-page result panel
    if (data.type === 'ACEP_IFRAME_DOWNLOAD') {
      try {
        if (LAST_EXPORT.multi) {
          LAST_EXPORT.multi.trigger();
        } else if (LAST_EXPORT.serverUrl && LAST_EXPORT.name) {
          downloadBlobUrl(LAST_EXPORT.serverUrl, LAST_EXPORT.name);
        } else if (LAST_EXPORT.blob && LAST_EXPORT.name) {
          const u = URL.createObjectURL(LAST_EXPORT.blob);
          downloadBlobUrl(u, LAST_EXPORT.name);
          setTimeout(() => URL.revokeObjectURL(u), 5000);
        }
      } catch {}
      return;
    }
    // Generate Link trigger from the in-page result panel
    if (data.type === 'ACEP_IFRAME_GENERATE_LINK') {
      try { makeLinkBtn?.click(); } catch {}
      return;
    }
    if (data.type !== 'ACEP_SELECTION_SET') return;
    try { console.log('[ACEP popup] ACEP_SELECTION_SET payload', { fileNameBase: data.fileNameBase, selectedTurnIds: Array.isArray(data.selectedTurnIds) ? data.selectedTurnIds.slice(0,10) : null, autoExport: !!data.autoExport }); } catch {}
    try { await _prefsReady; } catch {}
    if (typeof data.mute === 'boolean' && muteEl) muteEl.checked = data.mute;
    if (typeof data.muteDownload === 'boolean' && muteDownloadEl) muteDownloadEl.checked = data.muteDownload;
    SELECTED_TURN_IDS = Array.isArray(data.selectedTurnIds) ? data.selectedTurnIds : null;
    SELECTED_FILTER = typeof data.selectionFilter === 'string' ? data.selectionFilter : '';
    try {
      const pf = String(data.preferredFormat || '').trim();
      if (pf && fileTypeEl) {
        fileTypeEl.value = pf;
        try { fileTypeEl.dispatchEvent(new Event('change', { bubbles: true })); } catch {}
      }
    } catch {}
    try {
      const base = stripExt(String(data.fileNameBase || '').trim());
      if (base && fileNameEl && fileTypeEl) {
        fileNameEl.value = withExt(base, fileTypeEl.value);
        try { fileNameEl.dataset.autofill = '0'; } catch {}
      }
      if (base && titleInput) {
        titleInput.value = base;
        try { titleInput.dataset.autofill = '0'; } catch {}
      }
    } catch {}
    // Auto-export: sidebar Export button sends retry messages while the hidden iframe loads.
    // Consume each exportSessionId once so fast formats do not restart after retry #2/#3/#4.
    ACEP.autoExport = !!data.autoExport;
    if (data.autoExport && exportBtn) {
      const sessionKey = String(data.exportSessionId || data.sourceChatId || '');
      if (sessionKey && ACEP.consumedAutoExportSessions?.has?.(sessionKey)) return;
      if (sessionKey) ACEP.consumedAutoExportSessions.add(sessionKey);
      if (!ACEP.exporting) {
        if (settingsOverlay) settingsOverlay.style.display = 'none';
        if (ACEP.exportBtnReady) {
          try { exportBtn.click(); } catch {}
        } else {
          ACEP.pendingAutoExport = true;
        }
      }
    }
  });

  // Language selector: load current value then save + broadcast on change
  try {
    let _savedLang = 'en';
    try {
      const _s = await getStorageArea();
      const r = await _s.get({ lang: 'en' });
      if (r && r.lang) _savedLang = r.lang;
    } catch {}
    try {
      const r2 = await browser.storage?.sync?.get?.({ lang: _savedLang });
      if (r2 && r2.lang) _savedLang = r2.lang;
    } catch {}
    try {
      const r3 = await browser.storage?.local?.get?.({ lang: _savedLang });
      if (r3 && r3.lang) _savedLang = r3.lang;
    } catch {}
    if (langEl) langEl.value = _savedLang;
  } catch {}
  langEl?.addEventListener('change', async () => {
    try {
      const storage = await getStorageArea();
      await storage.set({ lang: langEl.value });
      try { browser.storage?.local?.set?.({ lang: langEl.value }); } catch {}
      try { browser.storage?.sync?.set?.({ lang: langEl.value }); } catch {}
      // Broadcast to all open chat tabs so their sidebars update
      try {
        const allTabs = await browser.tabs.query({});
        for (const t of allTabs) {
          try {
            browser.tabs.sendMessage(t.id, { type: 'ACEP_SETTINGS_CHANGED', lang: langEl.value }, () => {
              if (browser.runtime?.lastError) return;
            });
          } catch {}
        }
      } catch {}
      // Reload this settings page so i18n re-initialises with the new language
      setTimeout(() => { try { location.reload(); } catch {} }, 120);
    } catch {}
  });

  // Save Preferences button: persists settings without triggering export
  saveBtn?.addEventListener('click', async () => {
    try {
      const adv = readAdvancedOptions();
      await saveExportPrefs(null, adv);
      if (saveConfirmEl) {
        saveConfirmEl.style.display = 'block';
        setTimeout(() => { try { saveConfirmEl.style.display = 'none'; } catch {} }, 2500);
      }
    } catch {}
  });

  function extFor(t){
    switch(t){
      case 'pdf_text': return 'pdf';
      // 'pdf_image' path removed; only text-based PDF supported
      case 'png_plain': return 'png';
      case 'docx': return 'docx';
      case 'txt': return 'txt';
      case 'csv': return 'csv';
      case 'json': return 'json';
      case 'md': return 'md';
      case 'html_linked': return 'html';
      case 'html_self': return 'html';
      default: return t;
    }
  }
  function withExt(base,t){
    const e=extFor(t);
    return (base||'AI Conversation').replace(/\.(pdf|docx|txt|md|markdown|csv|json|png|html)$/i,'')+'.'+e;
  }
  function stripProviderDupesFromTitle(title = '', providerLabel = '') {
    let t = String(title || '').replace(/\s+/g, ' ').trim();
    // Strip leading punctuation sometimes present in document titles.
    t = t.replace(/^[\s.\-\u2013\u2014:|]+/, '').trim();
    const p = String(providerLabel || '').trim();
    if (!p || !t) return t;
    const esc = p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const prefixRe = new RegExp(`^\\s*(?:${esc}\\s*[-\\u2013\\u2014:|]+\\s*)+`, 'i');
    const suffixRe = new RegExp(`\\s*(?:[-\\u2013\\u2014:|]+\\s*${esc})+\\s*$`, 'i');
    let last = null;
    while (t && t !== last) {
      last = t;
      t = t.replace(prefixRe, '').trim();
      t = t.replace(suffixRe, '').trim();
    }
    if (t.toLowerCase() === p.toLowerCase()) return '';
    return t;
  }
  async function queryActiveTab(){
    try {
      if (chrome && browser.tabs && typeof browser.tabs.query === 'function') {
        const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
        return tab;
      }
    } catch {}
    try {
      const resp = await new Promise((res) => browser.runtime.sendMessage({ type: 'ACEP_GET_ACTIVE_TAB' }, res));
      return resp && resp.tab ? resp.tab : null;
    } catch {
      return null;
    }
  }
  async function sendToTab(id,msg){
    if (!id && id !== 0) throw new Error('Missing tab id');
    if (chrome && browser.tabs && typeof browser.tabs.sendMessage === 'function') {
      return await browser.tabs.sendMessage(id, msg);
    }
    return await new Promise((resolve, reject) => {
      browser.runtime.sendMessage({ type: 'ACEP_FORWARD_TO_TAB', tabId: id, payload: msg }, (reply) => {
        const err = browser.runtime.lastError;
        if (err) { reject(new Error(err.message || 'Forward failed')); return; }
        resolve(reply);
      });
    });
  }
  function fetchExportData(tabId, options, { onProgress } = {}, signal) {
    return new Promise((resolve, reject) => {
      const reqId = `req_${Date.now()}_${Math.random().toString(16).slice(2)}`;
      let resolved = false;
      let port;
      const finish = (value, isError = false) => {
        if (resolved) return;
        resolved = true;
        cleanup();
        if (isError) reject(value instanceof Error ? value : new Error(String(value)));
        else resolve(value);
      };
      const cleanup = () => {
        try { port && port.disconnect && port.disconnect(); } catch {}
        if (signal) signal.removeEventListener('abort', onAbort);
      };
      const onAbort = () => {
        try { port && port.postMessage && port.postMessage({ type: 'ACEP_EXPORT_CANCEL', reqId }); } catch {}
        finish(new DOMException('Aborted', 'AbortError'), true);
      };
      // Fallback path for Firefox MV2 iframe popup where browser.tabs is unavailable
      const canUseTabsPort = !!(chrome && browser.tabs && typeof browser.tabs.connect === 'function' && Number.isInteger(tabId));
      if (!canUseTabsPort) {
        // One-shot request/response via runtime messaging
        (async () => {
          try {
            if (signal) { if (signal.aborted) { onAbort(); return; } signal.addEventListener('abort', onAbort, { once:true }); }
            const resp = await new Promise((res, rej) => {
              browser.runtime.sendMessage({ type: 'ACEP_PREPARE_EXPORT_BRIDGE', tabId, options }, (reply) => {
                const err = browser.runtime.lastError;
                if (err) { rej(new Error(err.message || 'Bridge failed')); return; }
                res(reply);
              });
            });
            if (!resp || resp.ok === false) throw new Error(resp?.error || 'Export failed');
            const meta = { title: resp.title || 'AI Conversation', htmlLength: (resp.html||'').length, rowCount: Array.isArray(resp.rows)? resp.rows.length : 0, chunkCount: 1 };
            onProgress?.({ stage: 'meta', meta });
            onProgress?.({ stage: 'html', seq: 0, final: true, meta });
            finish({ title: meta.title, html: resp.html || '', rows: resp.rows || [] });
          } catch (e) { finish(e, true); }
        })();
        return;
      }
      // Normal port streaming path
      try {
        port = browser.tabs.connect(tabId, { name: 'ACEP_EXPORT' });
      } catch (err) {
        finish(err, true);
        return;
      }
      const htmlChunks = [];
      const rows = [];
      const meta = { title: 'AI Conversation', htmlLength: 0, rowCount: 0, chunkCount: 0 };
      if (signal) {
        if (signal.aborted) {
          onAbort();
          return;
        }
        signal.addEventListener('abort', onAbort, { once: true });
      }

      port.onMessage.addListener((msg) => {
        if (!msg || msg.reqId !== reqId) return;
        switch (msg.type) {
          case 'ACEP_EXPORT_META':
            meta.title = msg.title || meta.title;
            meta.htmlLength = msg.htmlLength || 0;
            meta.rowCount = msg.rowCount || 0;
            meta.chunkCount = msg.chunkCount || 0;
            onProgress?.({ stage: 'meta', meta });
            break;
          case 'ACEP_EXPORT_HTML':
            if (typeof msg.seq === 'number') htmlChunks[msg.seq] = msg.chunk || '';
            else htmlChunks.push(msg.chunk || '');
            onProgress?.({ stage: 'html', seq: msg.seq, final: msg.final, meta });
            break;
          case 'ACEP_EXPORT_ROW':
            rows[msg.index] = msg.row;
            onProgress?.({ stage: 'rows', index: msg.index, meta });
            break;
          case 'ACEP_EXPORT_PROGRESS':
            onProgress?.({ stage: msg.stage, completed: msg.completed, total: msg.total, meta });
            break;
          case 'ACEP_EXPORT_DONE': {
            const html = htmlChunks.filter((chunk) => typeof chunk === 'string').join('');
            const orderedRows = rows.filter((row) => row !== undefined);
            finish({ title: meta.title, html, rows: orderedRows });
            break;
          }
          case 'ACEP_EXPORT_ERROR':
            finish(new Error(msg.error || 'Export failed'), true);
            break;
          case 'ACEP_EXPORT_ABORTED':
            finish(new DOMException('Aborted', 'AbortError'), true);
            break;
        }
      });

      port.onDisconnect.addListener(() => {
        if (resolved) return;
        finish(new Error('Export channel disconnected'), true);
      });

      try {
        port.postMessage({ type: 'ACEP_PREPARE_EXPORT', reqId, options });
      } catch (err) {
        finish(err, true);
      }
    });
  }
  function downloadBlobUrl(url,name){
    if (/^https:\/\/acep-api\.workpent\.com\/v1\/pdf\/jobs\/[^/]+\/download(?:[/?#].*)?$/i.test(String(url || ''))) {
      try {
        browser.runtime.sendMessage({
          type: 'ACEP_DOWNLOAD_URL',
          url: String(url),
          filename: String(name || 'AI Conversation.pdf'),
        });
        return;
      } catch {}
    }
    const a=document.createElement('a'); a.href=url; a.download=name; a.target='_blank'; a.rel='noreferrer noopener'; document.body.appendChild(a); a.click(); a.remove();
  }
  function ensureNotCanceled(){ if (ACEP.canceled) throw new Error('Export canceled'); }
  function isExtensionUrl(u = '') {
    return /^(chrome-extension|moz-extension|ms-browser-extension|safari-extension):\/\//i.test(u || '');
  }

  function isBannedExportImageUrl(u = '') {
    if (!u) return true;
    if (isExtensionUrl(u)) return true;
    if (/gstatic\.com\/images\/branding\/productlogos\/youtube\//i.test(u)) return true;
    if (/i\.ytimg\.com\//i.test(u)) return true;
    if (/google\.com\/s2\/favicons/i.test(u)) return true;
    if (/lh3\.google\.com\/u\/\d+\/ogw\//i.test(u)) return true; // Google account profile image
    if (/\/file-icons\//i.test(u)) return true; // Grok file chip icons
    return false;
  }

  function collectImageUrlsFromBlocks(blocks = []) {
    if (!Array.isArray(blocks) || !blocks.length) return [];
    const out = [];
    const seen = new Set();
    const norm = (u = '') => {
      const s = String(u || '').trim();
      if (!s) return '';
      const hash = s.indexOf('#');
      return (hash >= 0 ? s.slice(0, hash) : s).trim();
    };
    blocks.forEach((b) => {
      if (!b || b.type !== 'image' || !b.src) return;
      if (b.katex) return;
      const src = String(b.src || '').trim();
      if (!src) return;
      // Plain exports should never surface giant base64 strings.
      if (/^data:/i.test(src) || /^blob:/i.test(src)) return;
      if (!isLikelyImageUrlForLink(src)) return;
      if (isBannedExportImageUrl(src)) return;
      const key = norm(src);
      if (!key || seen.has(key)) return;
      seen.add(key);
      out.push(key);
    });
    return out;
  }

  function mediaItemToPlainTokens(img, removeIcons = false) {
    const rawUrl = String(img?.originalSrc || img?.src || '').trim();
    const normalizeAttachmentName = (s = '') => String(s || '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
    const alt = normalizeAttachmentName(img?.alt || '');
    const looksLikeFilename = (s = '') => {
      const t = String(s || '').trim();
      if (!t) return false;
      // Avoid dumping placeholder alts like "Uploaded image".
      if (/^uploaded image$/i.test(t)) return false;
      return /\.[a-z0-9]{2,8}(\s|$)/i.test(t);
    };
    // Plain exports should never emit giant base64 strings. Prefer links only.
    // If there's no usable link, still surface a human-readable attachment label when available.
    if (!rawUrl || /^data:/i.test(rawUrl) || /^blob:/i.test(rawUrl)) {
      const safeAlt = alt && !/^uploaded image$/i.test(alt) ? alt : '';
      const attachment = (safeAlt || (looksLikeFilename(alt) ? alt : null)) || null;
      return { imageUrl: null, attachment };
    }
    const isImageUrl = isLikelyImageUrlForLink(rawUrl);
    const banned = isBannedExportImageUrl(rawUrl);
    const imageUrl = (isImageUrl && !banned) ? rawUrl : null;
    const attachment = (!imageUrl && alt) ? alt : null;
    return { imageUrl, attachment };
  }

  // ====== Dynamic loaders ======
  const legacy_scriptCache=new Map();
  function legacy_loadScriptOnce(url){
    if(legacy_scriptCache.has(url)) return legacy_scriptCache.get(url);
    const p=new Promise((res,rej)=>{ const s=document.createElement('script'); s.src=url;
      s.onload=()=>res(); s.onerror=()=>rej(new Error('Failed to load '+url)); document.head.appendChild(s);});
    legacy_scriptCache.set(url,p); return p;
  }
  async function legacy_ensureHtml2Canvas(){
    const pick=()=> (window.html2canvas&&typeof window.html2canvas==='function')?window.html2canvas:
                   (window.html2canvas&&typeof window.html2canvas.default==='function')?window.html2canvas.default:null;
    let fn=pick(); if(fn) return fn;
    await legacy_loadScriptOnce(browser.runtime.getURL('libs/html2canvas.min.js'));
    fn=pick(); if(!fn) throw new Error('html2canvas not available'); return fn;
  }
  function legacy_ensureGlobalKatexCss(){
    if (document.getElementById('acep-katex-css')) return;
    try {
      const link = document.createElement('link');
      link.id = 'acep-katex-css';
      link.rel = 'stylesheet';
      link.href = browser.runtime.getURL('libs/katex.min.css');
      document.head.appendChild(link);
    } catch {}
  }
  // jsPDF path removed to comply with MV3 remote code policy
  async function legacy_ensurePdfMake(){
    if(window.pdfMake) return window.pdfMake;
    await legacy_loadScriptOnce(browser.runtime.getURL('libs/pdfmake.min.js'));
    await legacy_loadScriptOnce(browser.runtime.getURL('libs/pdfmake.vfs_fonts.js'));
    if(!window.pdfMake) throw new Error('pdfMake not available');
    return window.pdfMake;
  }
  async function legacy_ensureHtmlToPdfMake(){
    if(window.htmlToPdfmake) return window.htmlToPdfmake;
    await legacy_loadScriptOnce(browser.runtime.getURL('libs/html-to-pdfmake.min.js'));
    if(!window.htmlToPdfmake) throw new Error('htmlToPdfmake not available');
    return window.htmlToPdfmake;
  }
  async function legacy_ensureDocx(){
    if(window.docx) return window.docx;
    await legacy_loadScriptOnce(browser.runtime.getURL('libs/docx.umd.js'));
    if(!window.docx) throw new Error('docx not available');
    return window.docx;
  }
  async function legacy_ensureKatexLib(){
    if (window.katex && typeof window.katex.renderToString === 'function') return window.katex;
    await legacy_loadScriptOnce(browser.runtime.getURL('libs/katex.min.js'));
    if (!window.katex || typeof window.katex.renderToString !== 'function') {
      throw new Error('katex not available');
    }
    return window.katex;
  }

  async function legacy_htmlToCanvas(processedHtml, { scale: scaleOverride, clampHeight = false } = {}){
    const html2canvas = await legacy_ensureHtml2Canvas();
    const frame = document.createElement('iframe');
    frame.style.cssText='position:fixed;left:0;top:0;width:900px;height:10px;opacity:0;pointer-events:none;z-index:-1;aria-hidden:true;';
    document.body.appendChild(frame);
    await new Promise(res => { frame.onload=()=>res(); frame.srcdoc=processedHtml; });

    const fdoc=frame.contentDocument, root=fdoc.body;
    await Promise.all(Array.from(fdoc.images||[]).map(img => img.complete ? null : new Promise(r=>{
      img.addEventListener('load',r,{once:true}); img.addEventListener('error',r,{once:true});
    })));
    const naturalHeight = Math.max(root.scrollHeight, root.offsetHeight, root.clientHeight) || 1;
    frame.style.height = (naturalHeight + 20) + 'px';

    let scale = typeof scaleOverride === 'number' && scaleOverride > 0 ? scaleOverride : 1.8;
    if (clampHeight) {
      const maxHeightPx = 19000;
      if (naturalHeight * scale > maxHeightPx) {
        const limitedScale = maxHeightPx / naturalHeight;
        if (limitedScale > 0 && limitedScale < scale) {
          scale = Math.max(0.95, limitedScale);
        }
      }
    }

    const canvas = await html2canvas(root,{ useCORS:true, allowTaint:true, backgroundColor:'#ffffff', scale, windowWidth:900 });
    frame.remove(); return canvas;
  }

  function dataUrlToUint8Array(dataUrl = '') {
    const comma = dataUrl.indexOf(',');
    if (comma === -1) return new Uint8Array();
    const meta = dataUrl.slice(0, comma).toLowerCase();
    const payload = dataUrl.slice(comma + 1);
    try {
      if (/;base64/i.test(meta)) {
        const binaryString = atob(payload);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) bytes[i] = binaryString.charCodeAt(i);
        return bytes;
      }
      const text = decodeURIComponent(payload);
      if (typeof TextEncoder !== 'undefined') {
        return new TextEncoder().encode(text);
      }
      const bytes = new Uint8Array(text.length);
      for (let i = 0; i < text.length; i++) bytes[i] = text.charCodeAt(i);
      return bytes;
    } catch {
      return new Uint8Array();
    }
  }

  function dataUrlToBlob(dataUrl = '', fallbackType = 'application/octet-stream') {
    if (!dataUrl) return null;
    const match = /^data:([^;]+);/i.exec(dataUrl);
    const type = match ? match[1] : fallbackType;
    const bytes = dataUrlToUint8Array(dataUrl);
    if (!bytes.length) return null;
    return new Blob([bytes], { type });
  }

  async function dataUrlCoverCrop(dataUrl, outW, outH, objectPosition = '', scaleFactor = 1) {
    if (!dataUrl || !outW || !outH) return '';
    const parsePos = (pos) => {
      const raw = String(pos || '').trim().toLowerCase();
      if (!raw) return { x: 0.5, y: 0.5 };
      const parts = raw.split(/\s+/);
      const mapKeyword = (v, axis) => {
        if (axis === 'x') {
          if (v === 'left') return 0;
          if (v === 'center') return 0.5;
          if (v === 'right') return 1;
        } else {
          if (v === 'top') return 0;
          if (v === 'center') return 0.5;
          if (v === 'bottom') return 1;
        }
        return null;
      };
      const parsePart = (v, axis) => {
        const kw = mapKeyword(v, axis);
        if (kw !== null) return kw;
        if (/%$/.test(v)) {
          const n = parseFloat(v);
          if (Number.isFinite(n)) return Math.max(0, Math.min(1, n / 100));
        }
        return null;
      };
      const x = parsePart(parts[0], 'x');
      const y = parsePart(parts[1] || parts[0], 'y');
      return {
        x: x !== null ? x : 0.5,
        y: y !== null ? y : 0.5,
      };
    };
    return await new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        try {
          const iw = img.naturalWidth || img.width || 1;
          const ih = img.naturalHeight || img.height || 1;
          const scale = Math.max(outW / iw, outH / ih);
          const sw = outW / scale;
          const sh = outH / scale;
          const pos = parsePos(objectPosition);
          const sx = Math.max(0, Math.min(iw - sw, (iw - sw) * pos.x));
          const sy = Math.max(0, Math.min(ih - sh, (ih - sh) * pos.y));
          const outScale = Math.max(1, Number(scaleFactor) || 1);
          const c = document.createElement('canvas');
          c.width = Math.round(outW * outScale);
          c.height = Math.round(outH * outScale);
          const ctx = c.getContext('2d');
          ctx.drawImage(img, sx, sy, sw, sh, 0, 0, c.width, c.height);
          resolve(c.toDataURL('image/png'));
        } catch {
          resolve('');
        }
      };
      img.onerror = () => resolve('');
      img.src = dataUrl;
    });
  }

  async function legacy_ensureNotoSansFont() {
    if (window.NOTO_SANS_FONT_READY) return;
    try {
      const url = browser.runtime.getURL('libs/notosan-font-family/NotoSans_Regular.ttf');
      const resp = await fetch(url);
      if (!resp.ok) { window.NOTO_SANS_FONT_READY = false; return; }
      const buf = await resp.arrayBuffer();
      const base64 = btoa(String.fromCharCode.apply(null, new Uint8Array(buf)));
      const vfs = window.pdfMake?.vfs || (window.pdfMake.vfs = {});
      if (!vfs['NotoSans_Regular.ttf']) vfs['NotoSans_Regular.ttf'] = base64;
      window.NOTO_SANS_FONT_READY = true;
    } catch { window.NOTO_SANS_FONT_READY = false; }
  }
  // loadFontToVfs / uint8ToBase64 / ensureEmojiFont / ensureSymbolFont / ensureSymbol2Font live in `core/pdf_fonts.js`.


function normalizeDimensions(width, height, maxWidth = 480) {
    const safeWidth = width && Number.isFinite(width) && width > 0 ? width : maxWidth;
    const safeHeight = height && Number.isFinite(height) && height > 0 ? height : Math.round(safeWidth * 0.6);
    // Only scale DOWN to maxWidth to avoid enlarging small images.
    const targetWidth = Math.min(safeWidth, Math.max(1, maxWidth));
    const ratio = safeWidth ? targetWidth / safeWidth : 1;
    const targetHeight = Math.max(1, Math.round(safeHeight * ratio));
    return { width: targetWidth, height: targetHeight };
  }
  function getRowText(row, providerKey = '') {
    if (!row) return '';
    const html = row.html || row.rawHtml || '';
    // Prefer HTML-derived text when it contains links (e.g., Claude attachment download links),
    // because `row.text`/innerText will drop `href` values.
    const preferHtml = !!(html && /<a\b[^>]*href=/i.test(html));
    const raw = (!preferHtml && typeof row.text === 'string' && row.text.trim().length)
      ? row.text
      : htmlToPlainTextLocal(html);
    let cleaned = raw.replace(/\u00a0/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
    try {
      const key = String(providerKey || LAST_PROVIDER_KEY || '').toLowerCase().trim();
      const prov = key ? globalThis.ACEP?.providers?.[key] : null;
      const fn = prov && typeof prov.cleanPlainText === 'function' ? prov.cleanPlainText : null;
      if (typeof fn === 'function') {
        const next = fn(cleaned, { row, format: 'plain' });
        if (typeof next === 'string') cleaned = next;
      }
    } catch {}
    return cleaned;
  }
  function splitTextWithEmoji(text = '', extra = {}) {
    if (!text) return [];
    if (!window.NOTO_EMOJI_FONT_READY) {
      return [{ text, ...extra }];
    }
    // Fallbacks for tofu boxes:
    // - Dingbats like check marks and heavy arrows.
    // - Core arrows like left/right/up/down.
    // If the relevant symbol font isn't present, normalize to emoji so NotoEmoji can render reliably.
    try {
      const s = String(text);
      let out = s;
      if (!window.NOTO_SYMBOL_FONT_READY) {
        out = out
          .replace(/\u2713|\u2714/g, '\u2705')
          .replace(/\u27A4/g, '\u27A1\uFE0F');
      }
      if (!window.NOTO_SYMBOL2_FONT_READY) {
        out = out
          .replace(/\u2192/g, '\u27A1\uFE0F')
          .replace(/\u2190/g, '\u2B05\uFE0F')
          .replace(/\u2191/g, '\u2B06\uFE0F')
          .replace(/\u2193/g, '\u2B07\uFE0F');
      }
      text = out;
    } catch {}
    // Capture common emoji sequences, including optional VS16 and ZWJ-joined sequences.
    // Also capture a small set of "symbol" characters that frequently fail on some fonts (e.g. arrows).
    const re = /(\d\uFE0F?\u20E3|(?:[\p{Extended_Pictographic}\u{1F1E6}-\u{1FAFF}\u{1F300}-\u{1F6FF}\u{2600}-\u{27BF}]\uFE0F?)(?:\u200D(?:[\p{Extended_Pictographic}\u{1F1E6}-\u{1FAFF}\u{1F300}-\u{1F6FF}\u{2600}-\u{27BF}]\uFE0F?))*)|([\u2190-\u21FF\u27F0-\u27FF])/gu;
    const parts = [];
    let last = 0;
    let m;
    while ((m = re.exec(text))) {
      if (m.index > last) {
        const chunk = text.slice(last, m.index);
        if (chunk) parts.push({ text: chunk, ...extra });
      }
      if (m[1]) {
        // For true emoji sequences, ensure emoji font wins even when callers pass {font: ...} in extra.
        // Some dingbat symbols render better through the symbol fallback path.
        let font = 'NotoEmoji';
        try {
          const s = String(m[1] || '');
          const isZwjSeq = s.includes('\u200d');
          const hasVs16 = s.includes('\uFE0F');
          // If it's a single code point in Dingbats/Misc Symbols, treat it as a symbol (not emoji).
          const cp = s.codePointAt(0) || 0;
          const single = !isZwjSeq && Array.from(s).length === 1;
          // If the text explicitly requests emoji presentation (VS16), keep emoji font.
          if (!hasVs16) {
            // Most dingbats/misc-symbol codepoints render more reliably via a symbol font than an emoji font.
            // Some emoji-like dingbats should remain text/symbols instead of Twemoji assets.
            if (single && (cp === 0x2705 || cp === 0x274C)) {
              font = 'NotoEmoji';
            } else {
              // Prefer a symbol font when available; fall back to NotoSans.
              const symFont = window.NOTO_SYMBOL_FONT_READY ? 'NotoSymbols' : 'NotoSans';
              if (single && (cp >= 0x2700 && cp <= 0x27BF)) font = symFont;
              if (single && (cp >= 0x2600 && cp <= 0x26FF)) font = symFont;
            }
          }
        } catch {}
        parts.push({ text: m[1], ...extra, font });
      } else if (m[2]) {
        // Arrows: prefer a dedicated symbol font if present.
        parts.push({ text: m[2], ...extra, font: window.NOTO_SYMBOL2_FONT_READY ? 'NotoSymbols2' : 'NotoSans' });
      }
      last = re.lastIndex;
    }
    if (last < text.length) {
      const tail = text.slice(last);
      if (tail) parts.push({ text: tail, ...extra });
    }
    return parts.length ? parts : [{ text, ...extra }];
  }
  function linkifyTextSegments(text = '', extra = {}) {
    const out = [];
    const urlRe = /(https?:\/\/[^\s<>"']+)/gi;
    const bareRe = /\b((?:[a-z0-9-]+\.)+[a-z]{2,})(\/[^\s<>"']*)?\b/gi;
    const linkifyBare = (chunk) => {
      const segs = [];
      let lastBare = 0;
      let mBare;
      while ((mBare = bareRe.exec(chunk))) {
        const full = mBare[0];
        const beforeBare = chunk.slice(lastBare, mBare.index);
        if (beforeBare) segs.push(...splitTextWithEmoji(beforeBare, extra));
        const prevChar = chunk[mBare.index - 1] || '';
        if (prevChar === '@') {
          segs.push(...splitTextWithEmoji(full, extra));
        } else {
          const url = `https://${full}`;
          segs.push(...splitTextWithEmoji(full, { ...extra, link: url, color: '#2563eb', decoration: 'underline' }));
        }
        lastBare = mBare.index + full.length;
      }
      const tailBare = chunk.slice(lastBare);
      if (tailBare) segs.push(...splitTextWithEmoji(tailBare, extra));
      return segs.length ? segs : splitTextWithEmoji(chunk, extra);
    };
    let last = 0;
    let m;
    while ((m = urlRe.exec(text))) {
      const before = text.slice(last, m.index);
      if (before) out.push(...linkifyBare(before));
      const url = m[1];
      out.push(...splitTextWithEmoji(url, { ...extra, link: url, color: '#2563eb', decoration: 'underline' }));
      last = m.index + url.length;
    }
    const tail = text.slice(last);
    if (tail) out.push(...linkifyBare(tail));
    return out.length ? out : splitTextWithEmoji(text, extra);
  }
  function softBreakLongWords(text = '', max = 28) {
    if (!text || typeof text !== 'string') return text;
    // Normalize non-breaking spaces so pdfMake can wrap lines naturally.
    text = text.replace(/[\u00a0\u202f\u2007]/g, ' ');
    const zwsp = '\u200b';
    return text.replace(new RegExp(`(\\S{${max},})`, 'g'), (m) => {
      const parts = [];
      for (let i = 0; i < m.length; i += max) parts.push(m.slice(i, i + max));
      return parts.join(zwsp);
    });
  }
  function htmlToInlineRuns(html = '') {
    if (!html || typeof DOMParser === 'undefined') return [];
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(`<div>${html}</div>`, 'text/html');
      const root = doc.body.firstElementChild || doc.body;
      const collectInlineRuns = (node, fmt = {}, runs = []) => {
        if (!node) return runs;
        if (node.nodeType === 3) {
          const txt = String(node.nodeValue || '').replace(/\u00a0/g, ' ');
          if (txt) runs.push({ text: txt, ...fmt });
          return runs;
        }
        if (node.nodeType !== 1) return runs;
        const el = node;
        const tag = (el.tagName || '').toLowerCase();
        if (tag === 'br') {
          runs.push({ text: '\n' });
          return runs;
        }
        const nextFmt = { ...fmt };
        if (tag === 'strong' || tag === 'b' || /^h[1-6]$/.test(tag)) nextFmt.bold = true;
        if (tag === 'em' || tag === 'i') nextFmt.italics = true;
        if (tag === 'u') nextFmt.underline = true;
        if (tag === 'a') {
          const href = el.getAttribute('href') || '';
          if (href) {
            nextFmt.link = href;
            nextFmt.color = '#2563eb';
            nextFmt.decoration = 'underline';
          }
        }
        el.childNodes.forEach((child) => collectInlineRuns(child, nextFmt, runs));
        return runs;
      };
      const runs = [];
      root.childNodes.forEach((child) => collectInlineRuns(child, {}, runs));
      return runs;
    } catch {
      return [];
    }
  }
  // decodeHtmlEntities / markdownToHtmlSimple / normalizeArtifactMarkdownHtml are provided by `core/html_blocks.js`.

  async function blobToImage(blob) {
    return new Promise((resolve, reject) => {
      try {
        const url = URL.createObjectURL(blob);
        const img = new Image();
        img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
        img.onerror = (e) => { URL.revokeObjectURL(url); reject(e); };
        img.src = url;
      } catch (e) { reject(e); }
    });
  }

  async function mergePagePngsToSingleBlob(pageBlobs) {
    if (!Array.isArray(pageBlobs) || !pageBlobs.length) throw new Error('No pages to merge');
    const images = [];
    for (const b of pageBlobs) {
      // eslint-disable-next-line no-await-in-loop
      const img = await blobToImage(b);
      images.push(img);
    }
    const width = Math.max(...images.map(i => i.naturalWidth || i.width || 0)) || 1;
    const height = images.reduce((sum, i) => sum + (i.naturalHeight || i.height || 0), 0) || 1;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    let y = 0;
    images.forEach(img => {
      const w = img.naturalWidth || img.width || width;
      const h = img.naturalHeight || img.height || 0;
      const x = Math.floor((width - w) / 2);
      ctx.drawImage(img, x, y, w, h);
      y += h;
    });
    const dataUrl = canvas.toDataURL('image/png');
    const blob = dataUrlToBlob(dataUrl, 'image/png');
    return blob || await new Promise(res => canvas.toBlob(res, 'image/png'));
  }

  function legacy_parseAsciiBoxTable(text = '') {
    if (!text || !/[\u250c\u252c\u2510\u2514\u2534\u2518\u251c\u253c\u2524\u2502\u2500]/.test(text)) return null;
    const lines = text.split(/\r?\n/).map(l => l.replace(/\s+$/, ''));
    const rowLines = lines.filter(l => l.indexOf('\u2502') !== -1);
    if (rowLines.length < 2) return null;
    const body = [];
    rowLines.forEach(line => {
      if (/^[\s\u250c\u252c\u2510\u2514\u2534\u2518\u251c\u253c\u2524\u2500]+$/.test(line)) return;
      const parts = line.split('\u2502').slice(1, -1).map(p => p.trim());
      const row = parts.filter(p => p !== '');
      if (row.length >= 2) body.push(row);
    });
    if (body.length < 2) return null;
    const hasHeader = lines.some(l => /[\u251c\u253c\u2524]/.test(l));
    return { body, hasHeader, caption: '' };
  }
  function legacy_extractAsciiTableFromText(text = '') {
    if (!text || !/[\u250c\u252c\u2510\u2514\u2534\u2518\u251c\u253c\u2524\u2502\u2500]/.test(text)) return null;
    const lines = text.split(/\r?\n/);
    let start = -1;
    let end = -1;
    for (let i = 0; i < lines.length; i++) {
      if (/[\u250c\u252c\u2510\u2514\u2534\u2518\u251c\u253c\u2524\u2502\u2500]/.test(lines[i])) {
        if (start === -1) start = i;
        end = i;
      }
    }
    if (start === -1 || end === -1 || end - start < 2) return null;
    const tableLines = lines.slice(start, end + 1).join('\n');
    const table = parseAsciiBoxTable(tableLines);
    if (!table) return null;
    const prefix = lines.slice(0, start).join('\n').trim();
    const suffix = lines.slice(end + 1).join('\n').trim();
    return { table, prefix, suffix };
  }
  function legacy_extractMarkdownPipeTableFromText(text = '') {
    if (!text || text.indexOf('|') === -1) return null;
    const lines = text.split(/\r?\n/);
    let start = -1;
    for (let i = 0; i < lines.length - 1; i++) {
      if (!/\|/.test(lines[i])) continue;
      if (/^\s*\|?[\s:-]+\|/.test(lines[i + 1])) { start = i; break; }
    }
    if (start < 0) return null;
    const rows = [];
    let end = start;
    for (let i = start; i < lines.length; i++) {
      if (!/\|/.test(lines[i])) break;
      rows.push(lines[i]);
      end = i;
    }
    if (rows.length < 2) return null;
    const parseRow = (row) => row
      .trim()
      .replace(/^\|/, '')
      .replace(/\|$/, '')
      .split('|')
      .map(c => c.trim());
    const header = parseRow(rows[0]);
    const body = rows.slice(2).map(parseRow);
    if (!header.length || !body.length) return null;
    const prefix = lines.slice(0, start).join('\n').trim();
    const suffix = lines.slice(end + 1).join('\n').trim();
    return { table: { body: [header, ...body], hasHeader: true, caption: '' }, prefix, suffix };
  }

  function legacy_parseHtmlBlocks(html = '', options = {}) {
    const allowAsciiTables = options.allowAsciiTables !== false;
    html = normalizeArtifactMarkdownHtml(html || '');
    // Returns ordered blocks preserving layout: [{type:'text', text}, {type:'table', body}]
    const blocks = [];
    if (!html || typeof DOMParser === 'undefined') {
      const text = htmlToPlainTextLocal(html || '');
      if (text) blocks.push({ type: 'text', text });
      return blocks;
    }
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      const seenImgSrc = new Set();
      const acc = { text: '' };
      const flush = () => {
        const t = acc.text.replace(/\r?\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
        if (t) blocks.push({ type: 'text', text: t });
        acc.text = '';
      };
      const extractKatexText = (el) => {
        if (!el || !el.querySelectorAll) return '';
        const annos = Array.from(el.querySelectorAll('annotation[encoding="application/x-tex"]'));
        const parts = annos.map((a) => (a.textContent || '').trim()).filter(Boolean);
        if (parts.length) return parts.join(' ');
        const dataTex = el.getAttribute('data-tex') || el.getAttribute('data-texsrc') || el.getAttribute('data-tex-source') || '';
        if (dataTex && dataTex.trim()) return dataTex.trim();
        const aria = el.getAttribute('aria-label') || '';
        if (aria && /\\|[_^]/.test(aria)) return aria.trim();
        const htmlText = (el.querySelector('.katex-html')?.textContent || '').replace(/[\u200b\u2060]/g, '');
        const cleaned = (htmlText || el.textContent || '')
          .replace(/\u00a0/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();
        return cleaned || '';
      };
      const collectInlineRuns = (node, fmt = {}, runs = []) => {
        if (!node) return runs;
        if (node.nodeType === 3) {
          const txt = String(node.nodeValue || '').replace(/\u00a0/g, ' ');
          if (txt) runs.push({ text: txt, ...fmt });
          return runs;
        }
        if (node.nodeType !== 1) return runs;
        const el = node;
        const tag = (el.tagName || '').toLowerCase();
        if (tag === 'br') {
          runs.push({ text: '\n' });
          return runs;
        }
        const nextFmt = { ...fmt };
        if (tag === 'strong' || tag === 'b' || /^h[1-6]$/.test(tag)) nextFmt.bold = true;
        if (/^h[1-6]$/.test(tag)) {
          const lvl = parseInt(tag.replace('h', ''), 10);
          if (Number.isFinite(lvl)) nextFmt.headingLevel = lvl;
        }
        if (tag === 'em' || tag === 'i') nextFmt.italics = true;
        if (tag === 'u') nextFmt.decoration = 'underline';
        if (tag === 'a') {
          const href = el.getAttribute('href') || '';
          if (href) {
            nextFmt.link = href;
            nextFmt.color = '#2563eb';
            nextFmt.decoration = 'underline';
          }
        }
        el.childNodes.forEach((child) => collectInlineRuns(child, nextFmt, runs));
        return runs;
      };
      const pushRunsFrom = (el, listPrefix = '') => {
        let target = el;
        try {
          const clone = el.cloneNode(true);
          // Preserve math by converting KaTeX/MathML nodes into raw TeX text so plain exports (MD/TXT/CSV/JSON) keep formulas.
          const mathNodes = Array.from(clone.querySelectorAll('.katex, mjx-container, math'));
          mathNodes.forEach((n) => {
            try {
              const tex = extractKatexText(n);
              if (!tex) { n.remove(); return; }
              const cls = (n.className || '').toString();
              const display = /katex-display/.test(cls) || (n.getAttribute && (n.getAttribute('display') || '').toLowerCase() === 'block');
              const wrapped = display ? `$$${tex}$$` : `$${tex}$`;
              n.replaceWith(clone.ownerDocument.createTextNode(wrapped));
            } catch {
              try { n.remove(); } catch {}
            }
          });
          target = clone;
        } catch {}
        const runs = collectInlineRuns(target);
        if (!runs.length) return;
        if (listPrefix && runs[0] && typeof runs[0].text === 'string') {
          runs[0].text = listPrefix + runs[0].text.replace(/^\s+/, '');
          blocks.push({ type: 'runs', runs });
          return;
        }
        const prefix = listPrefix ? [{ text: listPrefix }] : [];
        blocks.push({ type: 'runs', runs: prefix.concat(runs) });
      };
      const detectLang = (el) => {
        if (!el) return '';
        const attrs = [];
        if (el.getAttribute) {
          ['data-language', 'data-lang', 'lang'].forEach((attr) => {
            const val = el.getAttribute(attr);
            if (val) attrs.push(val);
          });
        }
        if (el.dataset) {
          if (el.dataset.language) attrs.push(el.dataset.language);
          if (el.dataset.lang) attrs.push(el.dataset.lang);
        }
        const classAttr = (el.className || '').toString();
        const match = classAttr.match(/language-([\w#+-]+)/i) || classAttr.match(/lang-([\w#+-]+)/i);
        if (match && match[1]) attrs.push(match[1]);
        return (attrs[0] || '').toLowerCase();
      };
      const pushCodeBlock = (el) => {
        if (!el) return;
        const raw = (el.textContent || el.innerText || '').replace(/\u00a0/g, ' ');
        const text = raw.replace(/\r?\n/g, '\n').replace(/\n{4,}/g, '\n\n');
        if (!text.trim()) return;
        const asciiTable = allowAsciiTables ? parseAsciiBoxTable(text) : null;
        if (asciiTable) {
          flush();
          blocks.push({ type: 'table', ...asciiTable });
          return;
        }
        flush();
        blocks.push({ type: 'code', text, lang: detectLang(el) });
      };
      const tableToBody = (t) => {
        const body = [];
        const bodyHtml = [];
        const pushRow = (cells = []) => {
          const rowArr = cells.map(cell => (cell.innerText || '').replace(/\u00a0/g, ' ').trim());
          const rowHtml = cells.map(cell => (cell.innerHTML || '').trim());
          if (rowArr.some(cell => cell !== '')) {
            body.push(rowArr);
            bodyHtml.push(rowHtml);
          }
        };
        const rows = Array.from(t.querySelectorAll('tr'));
        if (rows.length) {
          rows.forEach(tr => pushRow(Array.from(tr.querySelectorAll('th,td'))));
        } else {
          const roleRows = Array.from(t.querySelectorAll('[role="row"]'));
          roleRows.forEach(row => {
            const cells = Array.from(row.querySelectorAll('[role="cell"], [role="columnheader"], [role="rowheader"]'));
            if (cells.length) pushRow(cells);
          });
        }
        const hasHeader = !!t.querySelector('th, [role="columnheader"], [role="rowheader"]');
        // Optional caption: previous sibling text (common pattern for ChatGPT tables)
        let caption = '';
        try {
          if (!t.closest('.acep-artifact-body')) {
            const prev = t.previousElementSibling;
            if (prev && /P/i.test(prev.tagName)) {
              const txt = (prev.innerText || '').trim();
              if (txt) caption = txt;
            }
          }
        } catch {}
        return { body, bodyHtml, hasHeader, caption };
      };
      const visit = (node) => {
        if (!node) return;
        if (node.nodeType === 1) {
          const el = node;
          const className = (el.className || '').toString();
          const isKatex = (el.classList && (el.classList.contains('katex') || el.classList.contains('katex-display'))) || /(^|\s)katex(-display)?(\s|$)/.test(className);
          if (isKatex) {
            const tex = extractKatexText(el);
            if (tex) {
              const display = /katex-display/.test(className) || (el.getAttribute && (String(el.getAttribute('display') || '').toLowerCase() === 'block'));
              const wrapped = display ? `$$${tex}$$` : `$${tex}$`;
              if (display) {
                flush();
                blocks.push({ type: 'text', text: wrapped });
              } else {
                acc.text += (acc.text ? ' ' : '') + wrapped;
              }
            }
            return;
          }
          const isRoleTable = el.getAttribute && el.getAttribute('role') === 'table';
          const hasRoleRows = el.querySelector && el.querySelector('[role="row"]');
          if (el.tagName === 'TABLE' || isRoleTable || (hasRoleRows && el.querySelector('[role="cell"], [role="columnheader"], [role="rowheader"]'))) {
            flush();
            const tbl = tableToBody(el);
            if (tbl.body.length) blocks.push({ type: 'table', ...tbl });
            return; // do not descend into table again
          }
          if (el.tagName === 'PRE') {
            const imgsInPre = Array.from(el.querySelectorAll('img'));
            // If the <pre> contains images (e.g., Mermaid/SVG previews), capture only the images in order and ignore header text like "svg".
            if (imgsInPre.length) {
              flush();
              imgsInPre.forEach((im) => {
                const srcPreferred = (im.getAttribute('data-original-src') || '').trim();
                const srcFallback = (im.getAttribute('src') || '').trim();
                const src = (srcPreferred && !/^data:/i.test(srcPreferred)) ? srcPreferred : srcFallback;
                if (src) blocks.push({ type: 'image', src, alt: im.getAttribute('alt') || '' });
              });
              return;
            }
            const codeEl = el.querySelector('code') || el;
            pushCodeBlock(codeEl);
            return;
          }
          // KaTeX nodes are converted to images upstream; no special handling here.
          if (el.tagName === 'IMG') {
            flush();
            const srcPreferred = (el.getAttribute('data-original-src') || '').trim();
            const srcFallback = (el.getAttribute('src') || '').trim();
            const src = (srcPreferred && !/^data:/i.test(srcPreferred)) ? srcPreferred : srcFallback;
            if (src) {
              const key = src.split('#')[0];
              if (seenImgSrc.has(key)) return;
              seenImgSrc.add(key);
              const isKatex = el.getAttribute('data-acep-katex') === '1';
              const isKatexDisplay = el.getAttribute('data-acep-display') === '1';
              const vbW = parseFloat(el.getAttribute('data-acep-vw')) || 0;
              const vbH = parseFloat(el.getAttribute('data-acep-vh')) || 0;
              const svgText = el.getAttribute('data-acep-svg') || '';
              blocks.push({
                type: 'image',
                src,
                alt: el.getAttribute('alt') || '',
                katex: isKatex,
                katexDisplay: isKatexDisplay,
                vbW,
                vbH,
                svgText,
              });
            }
            return;
          }
          if (el.tagName === 'CODE') {
            if (el.closest && el.closest('pre')) return;
            pushCodeBlock(el);
            return;
          }
          // For block elements, if they contain images, traverse children to keep ordering of inline math/images
          if (el.tagName === 'UL' || el.tagName === 'OL') {
            const items = Array.from(el.children).filter(c => c.tagName === 'LI');
            const startAttr = Number(el.getAttribute('start'));
            const start = Number.isFinite(startAttr) && startAttr > 0 ? startAttr : 1;
            items.forEach((li, idx) => {
              let n = start + idx;
              try {
                const liVal = Number(li.getAttribute('value'));
                if (Number.isFinite(liVal) && liVal > 0) n = liVal;
              } catch {}
              const prefix = el.tagName === 'OL' ? (String(n) + '. ') : (String.fromCharCode(8226) + ' ');
              if (li.querySelector && li.querySelector('img')) {
                flush();
                acc.text = prefix;
                li.childNodes.forEach(visit);
                flush();
              } else {
                pushRunsFrom(li, prefix);
              }
            });
            return;
          }
          if (/^(P|LI|PRE|BLOCKQUOTE|H1|H2|H3|H4|H5|H6)$/.test(el.tagName)) {
            if (el.querySelector && el.querySelector('img')) {
              flush();
              el.childNodes.forEach(visit);
              flush();
            } else {
              pushRunsFrom(el);
            }
            return;
          }
          // Otherwise, traverse children (including DIV to allow nested TABLE detection)
          el.childNodes.forEach(visit);
        } else if (node.nodeType === 3) {
          const txt = String(node.nodeValue || '');
          if (txt.trim()) acc.text += (acc.text ? ' ' : '') + txt;
        }
      };
      doc.body.childNodes.forEach(visit);
      flush();
    } catch {
      const text = htmlToPlainTextLocal(html || '');
      if (text) blocks.push({ type: 'text', text });
    }
    const expanded = [];
    const fenceRegex = /```([\w#+-]*)\s*([\s\S]*?)```/g;
    blocks.forEach((block) => {
      if (!block || block.type !== 'text' || !/```/.test(block.text)) {
        if (block) expanded.push(block);
        return;
      }
      let lastIndex = 0;
      const text = block.text;
      let match;
      while ((match = fenceRegex.exec(text))) {
        const leading = text.slice(lastIndex, match.index).trim();
        if (leading) expanded.push({ type: 'text', text: leading });
        const lang = (match[1] || '').trim();
        const code = (match[2] || '').replace(/^\n+|\n+$/g, '');
        if (code) expanded.push({ type: 'code', text: code, lang });
        lastIndex = fenceRegex.lastIndex;
      }
      const trailing = text.slice(lastIndex).trim();
      if (trailing) expanded.push({ type: 'text', text: trailing });
    });
    if (!allowAsciiTables) return expanded;
    const processed = [];
    expanded.forEach((block) => {
      if (!block || block.type !== 'text') { if (block) processed.push(block); return; }
      const mdResult = extractMarkdownPipeTableFromText(block.text || '');
      if (mdResult) {
        const { table, prefix, suffix } = mdResult;
        if (prefix) processed.push({ type: 'text', text: prefix });
        processed.push({ type: 'table', ...table });
        if (suffix) processed.push({ type: 'text', text: suffix });
        return;
      }
      const result = extractAsciiTableFromText(block.text || '');
      if (!result) { processed.push(block); return; }
      const { table, prefix, suffix } = result;
      if (prefix) processed.push({ type: 'text', text: prefix });
      processed.push({ type: 'table', ...table });
      if (suffix) processed.push({ type: 'text', text: suffix });
    });
    return processed;
  }
  function legacy_parseHtmlBlocksForDocx(html = '', options = {}) {
    const allowAsciiTables = options.allowAsciiTables !== false;
    html = normalizeArtifactMarkdownHtml(html || '');
    const blocks = [];
    if (!html || typeof DOMParser === 'undefined') {
      const text = htmlToPlainTextLocal(html || '');
      if (text) blocks.push({ type: 'text', text });
      return blocks;
    }
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      const seenImgSrc = new Set();
      let groupCounter = 0;
      const nextGroup = () => { groupCounter += 1; return groupCounter; };
      const acc = { text: '', groupId: null, inlineContinuation: false };
      const flush = () => {
        const t = acc.text.replace(/\r?\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
        if (t) {
          blocks.push({
            type: 'text',
            text: t,
            groupId: acc.groupId || null,
            inlineContinuation: acc.inlineContinuation === true,
          });
        }
        acc.text = '';
        acc.groupId = null;
        acc.inlineContinuation = false;
      };
      const ensureGroup = (groupId) => {
        if (!groupId) return;
        if (acc.groupId && acc.groupId !== groupId) flush();
        acc.groupId = groupId;
      };
      const collectInlineRuns = (node, fmt = {}, runs = []) => {
        if (!node) return runs;
        if (node.nodeType === 3) {
          const txt = String(node.nodeValue || '').replace(/\u00a0/g, ' ');
          if (txt) runs.push({ text: txt, ...fmt });
          return runs;
        }
        if (node.nodeType !== 1) return runs;
        const el = node;
        const tag = (el.tagName || '').toLowerCase();
        if (tag === 'br') {
          runs.push({ text: '\n' });
          return runs;
        }
        const nextFmt = { ...fmt };
        if (tag === 'strong' || tag === 'b' || /^h[1-6]$/.test(tag)) nextFmt.bold = true;
        if (/^h[1-6]$/.test(tag)) {
          const lvl = parseInt(tag.replace('h', ''), 10);
          if (Number.isFinite(lvl)) nextFmt.headingLevel = lvl;
        }
        if (tag === 'em' || tag === 'i') nextFmt.italics = true;
        if (tag === 'u') nextFmt.underline = true;
        if (tag === 'a') {
          const href = el.getAttribute('href') || '';
          if (href) {
            nextFmt.link = href;
            nextFmt.underline = true;
            nextFmt.color = '2563EB';
          }
        }
        el.childNodes.forEach((child) => collectInlineRuns(child, nextFmt, runs));
        return runs;
      };
      const pushRunsFrom = (el, groupId, listPrefix = '') => {
        let target = el;
        try {
          const clone = el.cloneNode(true);
          clone.querySelectorAll('.katex, mjx-container, math').forEach((n) => n.remove());
          target = clone;
        } catch {}
        const runs = collectInlineRuns(target);
        if (!runs.length) return;
        if (listPrefix && runs[0] && typeof runs[0].text === 'string') {
          runs[0].text = listPrefix + runs[0].text.replace(/^\s+/, '');
          blocks.push({
            type: 'runs',
            runs,
            groupId: groupId || null,
            inlineContinuation: false,
          });
          return;
        }
        const prefix = listPrefix ? [{ text: listPrefix }] : [];
        blocks.push({
          type: 'runs',
          runs: prefix.concat(runs),
          groupId: groupId || null,
          inlineContinuation: false,
        });
      };
      const extractMathml = (el) => {
        if (!el || !el.querySelector) return '';
        const math = el.querySelector('math');
        return math ? math.outerHTML : '';
      };
      const extractDataMath = (el) => {
        if (!el || !el.getAttribute) return '';
        return (el.getAttribute('data-math') || '').trim();
      };
      const detectLang = (el) => {
        if (!el) return '';
        const attrs = [];
        if (el.getAttribute) {
          ['data-language', 'data-lang', 'lang'].forEach((attr) => {
            const val = el.getAttribute(attr);
            if (val) attrs.push(val);
          });
        }
        if (el.dataset) {
          if (el.dataset.language) attrs.push(el.dataset.language);
          if (el.dataset.lang) attrs.push(el.dataset.lang);
        }
        const classAttr = (el.className || '').toString();
        const match = classAttr.match(/language-([\w#+-]+)/i) || classAttr.match(/lang-([\w#+-]+)/i);
        if (match && match[1]) attrs.push(match[1]);
        return (attrs[0] || '').toLowerCase();
      };
      const pushCodeBlock = (el) => {
        if (!el) return;
        const raw = (el.textContent || el.innerText || '').replace(/\u00a0/g, ' ');
        const text = raw.replace(/\r?\n/g, '\n').replace(/\n{4,}/g, '\n\n');
        if (!text.trim()) return;
        const asciiTable = allowAsciiTables ? parseAsciiBoxTable(text) : null;
        if (asciiTable) {
          flush();
          blocks.push({ type: 'table', ...asciiTable });
          return;
        }
        flush();
        blocks.push({ type: 'code', text, lang: detectLang(el) });
      };
      const tableToBody = (t) => {
        const body = [];
        const bodyHtml = [];
        const pushRow = (cells = []) => {
          const rowArr = cells.map(cell => (cell.innerText || '').replace(/\u00a0/g, ' ').trim());
          const rowHtml = cells.map(cell => (cell.innerHTML || '').trim());
          if (rowArr.some(cell => cell !== '')) {
            body.push(rowArr);
            bodyHtml.push(rowHtml);
          }
        };
        const rows = Array.from(t.querySelectorAll('tr'));
        if (rows.length) {
          rows.forEach(tr => pushRow(Array.from(tr.querySelectorAll('th,td'))));
        } else {
          const roleRows = Array.from(t.querySelectorAll('[role="row"]'));
          roleRows.forEach(row => {
            const cells = Array.from(row.querySelectorAll('[role="cell"], [role="columnheader"], [role="rowheader"]'));
            if (cells.length) pushRow(cells);
          });
        }
        const hasHeader = !!t.querySelector('th, [role="columnheader"], [role="rowheader"]');
        let caption = '';
        try {
          const prev = t.previousElementSibling;
          if (prev && /P/i.test(prev.tagName)) {
            const txt = (prev.innerText || '').trim();
            if (txt) caption = txt;
          }
        } catch {}
        return { body, bodyHtml, hasHeader, caption };
      };
      const blockTags = new Set(['P','UL','OL','PRE','BLOCKQUOTE','H1','H2','H3','H4','H5','H6','LI','DIV','TABLE']);
      const isBlockTag = (el) => !!(el && el.tagName && blockTags.has(el.tagName));
      const hasChildBlock = (el) => {
        if (!el || !el.children) return false;
        return Array.from(el.children).some(child => isBlockTag(child));
      };
      const visit = (node, groupId = null) => {
        if (!node) return;
        if (node.nodeType === 1) {
          const el = node;
          const className = (el.className || '').toString();
          // Skip visually hidden / screen-reader-only nodes (ChatGPT often includes hidden
          // table text for accessibility, which would otherwise duplicate real tables in DOCX).
          try {
            const cls = className.toLowerCase();
            const styleAttr = String(el.getAttribute && el.getAttribute('style') || '').toLowerCase();
            const ariaHidden = (el.getAttribute && el.getAttribute('aria-hidden')) ? String(el.getAttribute('aria-hidden') || '').toLowerCase() : '';
            const hiddenAttr = !!(el.hasAttribute && el.hasAttribute('hidden'));
            const isHidden =
              hiddenAttr ||
              ariaHidden === 'true' ||
              /display\s*:\s*none/.test(styleAttr) ||
              /visibility\s*:\s*hidden/.test(styleAttr) ||
              /(^|\s)(sr-only|visually-hidden|screen-reader-only)(\s|$)/.test(cls) ||
              // Tailwind-style hidden utility
              /(^|\s)hidden(\s|$)/.test(cls);
            if (isHidden) return;
          } catch {}
          if (el.tagName === 'BR') {
            ensureGroup(groupId);
            acc.text += '\n';
            return;
          }
          const isKatex = (el.classList && (el.classList.contains('katex') || el.classList.contains('katex-display'))) || /(^|\s)katex(-display)?(\s|$)/.test(className);
          if (isKatex) {
            const mathml = extractMathml(el);
            if (mathml) {
              flush();
              blocks.push({ type: 'math', mathml, display: /katex-display/.test(className), groupId });
            }
            return;
          }
          if (el.getAttribute && el.hasAttribute('data-math')) {
            const display = el.classList && (el.classList.contains('math-block') || el.classList.contains('katex-display'));
            const mathml = extractMathml(el);
            if (mathml) {
              flush();
              blocks.push({ type: 'math', mathml, display, groupId });
              return;
            }
            const tex = extractDataMath(el);
            if (tex) {
              flush();
              blocks.push({ type: 'math', mathml: '', tex, display, groupId });
            }
            return;
          }
          const isRoleTable = el.getAttribute && el.getAttribute('role') === 'table';
          const hasRoleRows = el.querySelector && el.querySelector('[role="row"]');
          if (el.tagName === 'TABLE' || isRoleTable || (hasRoleRows && el.querySelector('[role="cell"], [role="columnheader"], [role="rowheader"]'))) {
            flush();
            const tbl = tableToBody(el);
            if (tbl.body.length) blocks.push({ type: 'table', ...tbl });
            return;
          }
          if (el.tagName === 'PRE') {
            const imgsInPre = Array.from(el.querySelectorAll('img'));
            if (imgsInPre.length) {
              flush();
              imgsInPre.forEach((im) => {
                const src = (im.getAttribute('data-original-src') || im.getAttribute('src') || '').trim();
                if (src) blocks.push({ type: 'image', src, alt: im.getAttribute('alt') || '', groupId });
              });
              return;
            }
            const codeEl = el.querySelector('code') || el;
            pushCodeBlock(codeEl);
            return;
          }
          if (el.tagName === 'IMG') {
            flush();
            const src = (el.getAttribute('data-original-src') || el.getAttribute('src') || '').trim();
            if (src) {
              const key = src.split('#')[0];
              if (seenImgSrc.has(key)) return;
              seenImgSrc.add(key);
              blocks.push({ type: 'image', src, alt: el.getAttribute('alt') || '', groupId });
            }
            return;
          }
          if (el.tagName === 'CODE') {
            if (el.closest && el.closest('pre')) return;
            pushCodeBlock(el);
            return;
          }
          if (isBlockTag(el)) {
            const isList = el.tagName === 'UL' || el.tagName === 'OL';
            const isListItem = el.tagName === 'LI';
            const blockGroup = isListItem ? nextGroup() : (groupId || nextGroup());
            const childGroup = isList ? null : blockGroup;
            if (isList) {
              const items = Array.from(el.children).filter(c => c.tagName === 'LI');
              const startAttr = Number(el.getAttribute('start'));
              const start = Number.isFinite(startAttr) && startAttr > 0 ? startAttr : 1;
              items.forEach((li, idx) => {
                let n = start + idx;
                try {
                  const liVal = Number(li.getAttribute('value'));
                  if (Number.isFinite(liVal) && liVal > 0) n = liVal;
                } catch {}
                const prefix = el.tagName === 'OL' ? (String(n) + '. ') : (String.fromCharCode(8226) + ' ');
                if (li.querySelector && (li.querySelector('img') || li.querySelector('.katex'))) {
                  li.childNodes.forEach((child) => visit(child, childGroup));
                  flush();
                } else {
                  pushRunsFrom(li, blockGroup, prefix);
                }
              });
              return;
            }
            const hasNestedTable = (() => {
              try {
                if (!el.querySelector) return false;
                if (el.querySelector('table')) return true;
                if (el.querySelector('[role="table"]')) return true;
                if (el.querySelector('[role="row"]') && el.querySelector('[role="cell"], [role="columnheader"], [role="rowheader"]')) return true;
              } catch {}
              return false;
            })();
            if (el.querySelector && (el.querySelector('img') || el.querySelector('.katex') || hasNestedTable)) {
              el.childNodes.forEach((child) => visit(child, childGroup));
              flush();
            } else {
              if (hasChildBlock(el)) {
                el.childNodes.forEach((child) => visit(child, childGroup));
              } else {
                pushRunsFrom(el, blockGroup);
              }
              flush();
            }
            return;
          }
          el.childNodes.forEach((child) => visit(child, groupId));
        } else if (node.nodeType === 3) {
          const txt = String(node.nodeValue || '');
          if (txt.trim()) {
            ensureGroup(groupId);
            acc.inlineContinuation = true;
            acc.text += (acc.text ? ' ' : '') + txt;
          }
        }
      };
      doc.body.childNodes.forEach((child) => visit(child, null));
      flush();
      // Gemini occasionally yields only plain text blocks even with inline tags.
      // If we see inline tags but no runs, synthesize a single runs block to preserve bold/italic/links.
      const hasRuns = blocks.some((b) => b && b.type === 'runs' && Array.isArray(b.runs) && b.runs.length);
      const hasInlineTags = /<(b|strong|i|em|u|a)\b/i.test(html || '');
      if (!hasRuns && hasInlineTags) {
        try {
          const runs = collectInlineRuns(doc.body);
          if (Array.isArray(runs) && runs.length) {
            blocks.length = 0;
            blocks.push({ type: 'runs', runs, groupId: null, inlineContinuation: false });
          }
        } catch {}
      }
    } catch {
      const text = htmlToPlainTextLocal(html || '');
      if (text) blocks.push({ type: 'text', text });
    }
    if (!allowAsciiTables) return blocks;
    const processed = [];
    blocks.forEach((block) => {
      if (!block || block.type !== 'text') { if (block) processed.push(block); return; }
      const mdResult = extractMarkdownPipeTableFromText(block.text || '');
      if (mdResult) {
        const { table, prefix, suffix } = mdResult;
        if (prefix) processed.push({ type: 'text', text: prefix, groupId: block.groupId, inlineContinuation: block.inlineContinuation });
        processed.push({ type: 'table', ...table, groupId: block.groupId });
        if (suffix) processed.push({ type: 'text', text: suffix, groupId: block.groupId, inlineContinuation: block.inlineContinuation });
        return;
      }
      const result = extractAsciiTableFromText(block.text || '');
      if (!result) { processed.push(block); return; }
      const { table, prefix, suffix } = result;
      if (prefix) processed.push({ type: 'text', text: prefix, groupId: block.groupId, inlineContinuation: block.inlineContinuation });
      processed.push({ type: 'table', ...table, groupId: block.groupId });
      if (suffix) processed.push({ type: 'text', text: suffix, groupId: block.groupId, inlineContinuation: block.inlineContinuation });
    });
    return processed;
  }
  function legacy_renderMarkdownTableFromBody(body) {
    try {
      if (!Array.isArray(body) || !body.length) return '';
      const rows = body.map(r => (Array.isArray(r) ? r : []) );
      const esc = (s) => String(s == null ? '' : s).replace(/\|/g, '\\|').trim();
      const widths = [];
      rows.forEach(r => r.forEach((c, i) => { const len = esc(c).length; widths[i] = Math.max(widths[i] || 3, len); }));
      const fmtRow = (r) => '| ' + r.map((c, i) => {
        const t = esc(c);
        const pad = widths[i] - t.length;
        return t + ' '.repeat(pad) + ' ';
      }).join('| ') + '|';
      const header = rows[0] || [];
      const sep = '| ' + header.map((_, i) => '-'.repeat(Math.max(3, widths[i] || 3)) + ' ').join('| ') + '|';
      const out = [];
      out.push(fmtRow(header));
      out.push(sep);
      for (let i = 1; i < rows.length; i++) out.push(fmtRow(rows[i]));
      return out.join('\n');
    } catch { return ''; }
  }
  function legacy_buildPlainTextFromBlocks(blocks = []) {
    if (!Array.isArray(blocks) || !blocks.length) return '';
    const parts = [];
    const runsToText = (runs = [], { includeLinks = false } = {}) => {
      if (!Array.isArray(runs) || !runs.length) return '';
      let out = '';
      let curLink = '';
      let curHasText = false;
      const flushLink = () => {
        if (includeLinks && curLink && curHasText) {
          // Keep URLs visible in plain exports (TXT/CSV/JSON) where href is otherwise lost.
          out += (out.endsWith(' ') || out.endsWith('\n') ? '' : ' ') + curLink;
        }
        curLink = '';
        curHasText = false;
      };
      for (const r of runs) {
        const t = (r && typeof r.text === 'string') ? r.text : '';
        const link = (includeLinks && r && r.link) ? String(r.link || '').trim() : '';
        if (curLink && link !== curLink) flushLink();
        if (link && !curLink) curLink = link;
        if (t) {
          out += t;
          if (link && t.replace(/\s+/g, '').length) curHasText = true;
        }
        if (!link && curLink) flushLink();
      }
      flushLink();
      return out
        .replace(/\u00a0/g, ' ')
        .replace(/[ \t]+\n/g, '\n')
        .replace(/\n[ \t]+/g, '\n')
        .replace(/\s{2,}/g, ' ')
        .trim();
    };
    blocks.forEach((b) => {
      if (!b) return;
      if (b.type === 'table' && Array.isArray(b.body) && b.body.length) {
        const md = renderMarkdownTableFromBody(b.body);
        if (md) parts.push(md);
      } else if (b.type === 'code' && b.text && b.text.trim()) {
        parts.push(b.text.trim());
      } else if (b.type === 'text' && b.text && b.text.trim()) {
        parts.push(b.text.trim());
      } else if (b.type === 'runs' && Array.isArray(b.runs) && b.runs.length) {
        const t = runsToText(b.runs, { includeLinks: true });
        if (t) parts.push(t);
      }
    });
    return parts.join('\n\n').replace(/\n{3,}/g, '\n\n').trim();
  }

  async function _legacy_buildHtmlWithHeader(html = '', adv = {}, headerFilename = '', subHeading = '', opts = {}) {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      if (!doc || !doc.documentElement) return html;
      const body = doc.body || doc.documentElement;
      const head = doc.head || doc.createElement('head');
      if (!doc.head) doc.documentElement.insertBefore(head, body);

      // Debug stamp so exported HTML can confirm this post-processing ran.
      try {
        doc.documentElement.setAttribute('data-acep-html-built-by', 'popup.buildHtmlWithHeader');
        doc.documentElement.setAttribute('data-acep-html-built-ts', String(Date.now()));
      } catch {}
      const fontMap = {
        NotoSans: '"Noto Sans", "Segoe UI", Arial, sans-serif',
        ArialBlack: '"Arial Black", Arial, sans-serif',
        TimesNewRoman: '"Times New Roman", Times, serif',
        Roman: 'Roman, "Times New Roman", serif',
        Calibri: 'Calibri, "Segoe UI", sans-serif',
      };
      const isDark = (adv.theme || 'light') === 'dark';
      const bg = isDark ? '#0d0f14' : '#ffffff';
      const text = isDark ? '#e5e7eb' : '#111827';
      const accent = isDark ? '#93c5fd' : '#2563eb';
      const baseFont = fontMap[adv.font || 'TimesNewRoman'] || fontMap.TimesNewRoman || fontMap.NotoSans;
      const baseSize = Math.max(8, Number(adv.fontSize) || 14);
      const forPng = !!opts.forPng;
      const extraCss = String(opts.extraCss || '');
      const providerKey = String(opts.providerKey || '').trim().toLowerCase();
      const getCodeTextWithLineBreaks = (root) => {
        try {
          const blockTags = new Set(['DIV','P','LI','TR']);
          const out = [];
          const pushNewline = () => {
            if (out.length && out[out.length - 1] !== '\n') out.push('\n');
          };
          const walk = (node) => {
            if (!node) return;
            if (node.nodeType === 3) {
              out.push(String(node.nodeValue || ''));
              return;
            }
            if (node.nodeType !== 1) return;
            const tag = String(node.tagName || '').toUpperCase();
            if (tag === 'BR') {
              pushNewline();
              return;
            }
            const isLineLike = blockTags.has(tag) || /\b(line|code-line|cm-line)\b/i.test(String(node.className || ''));
            if (isLineLike) pushNewline();
            Array.from(node.childNodes || []).forEach(walk);
            if (isLineLike) pushNewline();
          };
          walk(root);
          return out.join('').replace(/\n{3,}/g, '\n\n').replace(/^\n+|\n+$/g, '');
        } catch {
          return root?.textContent || '';
        }
      };

      // Legacy HTML builder fallback: apply the same static syntax highlighting as core/exporters/html.js.
      try {
        const SKIP_LANGS = new Set(['mermaid','svg','math','latex','text','plaintext','plain','']);
        doc.querySelectorAll('pre code[class*="language-"]').forEach(codeEl => {
          const cls = Array.from(codeEl.classList).find(c => c.startsWith('language-')) || '';
          const lang = cls.replace('language-', '').toLowerCase();
          if (SKIP_LANGS.has(lang)) return;
          const rawText = getCodeTextWithLineBreaks(codeEl);
          if (!rawText.trim()) return;
          codeEl.innerHTML = highlightCode(rawText, lang);
        });
      } catch {}
      const needsKatex = _legacy_hasKatexInHtml(html, []);
      const katexCss = '';

      try {
        if (providerKey) doc.documentElement.classList.add(`acep-provider-${providerKey}`);
      } catch {}

       // Apply global styling
       // - For HTML exports: use full-width layout so assistant turns sit at the left edge (not a centered column).
       // - For PNG rendering: keep a fixed-width centered column for consistent raster output.
        if (forPng) {
         body.style.margin = '24px auto';
         body.style.maxWidth = '900px';
         body.style.padding = '0 12px 24px';
       } else {
         body.style.margin = '24px 12px';
         body.style.maxWidth = 'none';
         body.style.padding = '0 0 24px';
       }
      body.style.backgroundColor = bg;
      body.style.color = text;
      body.style.setProperty('background-color', bg, 'important');
      body.style.setProperty('color', text, 'important');
       body.style.fontFamily = baseFont;
       body.style.fontSize = `${baseSize}px`;
       // HTML exports need looser typography because many providers rely on utility classes
       // (e.g. Tailwind `leading-*`, `gap-*`) that aren't present in the exported file.
       body.style.lineHeight = forPng ? '1.3' : '1.5';
      doc.documentElement.style.backgroundColor = bg;

      const style = doc.createElement('style');
      style.textContent = `
        body a { color: ${accent}; }
        body h1, body h2, body h3, body h4, body h5, body h6 { margin: 4px 0 8px; color: ${text}; font-size: ${baseSize + 2}px; font-weight: 700; }
        /* Reset baked-in chat bubble backgrounds so dark mode can control them */
        .message-bubble,
        .markdown,
        .prose,
        .content,
        .whitespace-pre-wrap,
        p, li, span {
          background: transparent !important;
          color: ${text} !important;
        }
        /* KaTeX: use standard visual rendering */
        math annotation { display: none !important; }
        .katex-display { display: block; margin: 0.6em 0; }
        /* Tables (consistent for PNG/HTML exports) */
        table { width: 100%; border-collapse: collapse; margin: 10px 0; }
        th, td { border: 1px solid ${isDark ? '#374151' : '#e5e7eb'}; padding: 8px 10px; vertical-align: top; }
        th { background: ${isDark ? '#111827' : '#f3f4f6'}; font-weight: 700; }
        td { background: transparent; }
        pre, code { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace; }
        /* Restore readable spacing when provider utility CSS isn't present */
        .content { line-height: ${forPng ? '1.35' : '1.55'}; }
        .content p, .content ul, .content ol, .content blockquote, .content pre, .content table { margin: 0.75em 0; }
        .content li { margin: 0.25em 0; }
        .content ul, .content ol { padding-left: 1.4em; }
        .content > :first-child { margin-top: 0; }
        .content > :last-child { margin-bottom: 0; }

        /* New provider-split HTML uses .acep-turn without .content wrappers */
        [data-acep-role] { line-height: ${forPng ? '1.35' : '1.55'}; }
        [data-acep-role] p, [data-acep-role] ul, [data-acep-role] ol, [data-acep-role] blockquote, [data-acep-role] pre, [data-acep-role] table { margin: 0.75em 0; }
        [data-acep-role] li { margin: 0.25em 0; }
        [data-acep-role] ul, [data-acep-role] ol { padding-left: 1.4em; }
        [data-acep-role] ul{ list-style-type:disc !important; }
        [data-acep-role] ol{ list-style-type:decimal !important; }
        [data-acep-role] ul > li::marker{ content:normal !important; }
        [data-acep-role] ol > li::marker{ content:normal !important; }
        [data-acep-role] ul > li::before{ content:none !important; display:none !important; }
        [data-acep-role] > :first-child { margin-top: 0; }
        [data-acep-role] > :last-child { margin-bottom: 0; }
        ${isDark ? `
        /* Avoid global background wipes that remove bubble styling. */

        /* Turn layout (provider-split HTML wraps content in .acep-turn > .acep-bubble) */
        .acep-turn{ display:flex; flex-direction:column; width:100%; gap:6px; margin:0 0 18px 0; align-items:flex-start; }
        .acep-turn[data-acep-role="user"]{ align-items:flex-end; }
        .acep-turn[data-acep-role="assistant"]{ align-items:flex-start; }

        /* Bubble styling */
        .acep-turn[data-acep-role="user"] > .acep-bubble{
          background:#0f1622 !important;
          color:#f9fafb !important;
          padding:12px 14px !important;
          border-radius:16px !important;
          max-width:78%;
          border:1px solid #1f2937 !important;
        }
        .acep-turn[data-acep-role="assistant"] > .acep-bubble{
          background:transparent !important;
          color:${text} !important;
          padding:0 !important;
          width:100%;
          max-width:100%;
          box-sizing:border-box;
        }
        .acep-turn[data-acep-role="user"] > .acep-bubble *{
          color:#f9fafb !important;
          background:transparent !important;
        }
        .acep-turn[data-acep-role="assistant"] > .acep-bubble *{
          background:transparent !important;
          color:${text} !important;
          border:0 !important;
        }
        .acep-turn > .acep-bubble .message-bubble,
        .acep-turn > .acep-bubble .markdown,
        .acep-turn > .acep-bubble .prose,
        .acep-turn > .acep-bubble .content,
        .acep-turn > .acep-bubble .whitespace-pre-wrap,
        .acep-turn > .acep-bubble p,
        .acep-turn > .acep-bubble li,
        .acep-turn > .acep-bubble span{
          background:transparent !important;
          color:inherit !important;
        }
        /* Code styling: keep inline code inline; only <pre> is block */
        [data-acep-role] pre{
          background:${isDark ? '#0f1622' : '#f3f4f6'} !important;
          color:${isDark ? '#e5e7eb' : '#0f172a'} !important;
          border-radius:10px !important;
          padding:12px !important;
          display:block;
          overflow-x:auto;
          white-space:pre-wrap;
        }
        [data-acep-role] pre code{
          background:transparent !important;
          padding:0 !important;
          border:0 !important;
          display:inline !important;
          white-space:pre-wrap;
        }
        [data-acep-role] code{
          background:${isDark ? '#0f1622' : '#f3f4f6'} !important;
          color:${isDark ? '#e5e7eb' : '#0f172a'} !important;
          border-radius:6px !important;
          padding:2px 4px !important;
          display:inline !important;
          border:1px solid ${isDark ? '#1f2937' : '#e5e7eb'} !important;
          white-space:pre-wrap;
        }
        [data-acep-role] table{
          width:100% !important;
          min-width:100% !important;
          table-layout:fixed !important;
        }
        .tok-kw{color:${isDark ? '#a78bfa' : '#7c3aed'} !important;font-weight:600;}
        .tok-str{color:${isDark ? '#4ade80' : '#16a34a'} !important;}
        .tok-num{color:${isDark ? '#fb923c' : '#ea580c'} !important;}
        .tok-cmt{color:${isDark ? '#9ca3af' : '#6b7280'} !important;font-style:italic;}
        .tok-fn{color:${isDark ? '#60a5fa' : '#2563eb'} !important;}
        .tok-cls{color:${isDark ? '#34d399' : '#0891b2'} !important;}
        .tok-tag{color:${isDark ? '#f472b6' : '#db2777'} !important;}
        .tok-attr{color:${isDark ? '#34d399' : '#0d9488'} !important;}
        [data-acep-role] th, [data-acep-role] td{
          word-break:break-word !important;
          overflow-wrap:anywhere !important;
        }

        /* Legacy/alternate wrappers (older templates used [data-acep-role] directly). */
        [data-acep-role="user"]:not(.acep-turn){
          background:#0f1622 !important;
          color:#f9fafb !important;
          padding:12px 14px !important;
          border-radius:16px !important;
          max-width:78%;
          margin:0 0 16px auto !important;
          border:1px solid #1f2937 !important;
        }
        [data-acep-role="assistant"]:not(.acep-turn){
          background:transparent !important;
          color:${text} !important;
          padding:0 !important;
          margin:0 0 18px 0 !important;
          width:100%;
          max-width:100%;
          box-sizing:border-box;
        }
        [data-acep-role="assistant"]:not(.acep-turn) *,
        [data-acep-role="user"]:not(.acep-turn) *{
          background:transparent !important;
          color:inherit !important;
        }

        /* Role icons (for the newer .acep-turn structure). */
        .acep-role-head{ display:flex; width:100%; align-items:center; gap:6px; margin-bottom:6px; }
        .acep-turn[data-acep-role="user"] .acep-role-head{ justify-content:flex-end; }
        .acep-turn[data-acep-role="assistant"] .acep-role-head{ justify-content:flex-start; }
        .acep-role-head img.role-icon{ width:18px; height:18px; display:inline-block; border-radius:999px; }
        ` : `
        /* Turn layout */
        .acep-turn{ display:flex; flex-direction:column; width:100%; gap:6px; margin:0 0 18px 0; align-items:flex-start; }
        .acep-turn[data-acep-role="user"]{ align-items:flex-end; }
        .acep-turn[data-acep-role="assistant"]{ align-items:flex-start; }

        /* Bubble styling */
        .acep-turn[data-acep-role="user"] > .acep-bubble{
          background:#f3f4f6 !important;
          color:#111827 !important;
          padding:12px 14px !important;
          border-radius:16px !important;
          max-width:78%;
          border:1px solid #e5e7eb !important;
        }
        .acep-turn[data-acep-role="user"] > .acep-bubble *{
          color:#111827 !important;
          background:transparent !important;
        }
        .acep-turn[data-acep-role="assistant"] > .acep-bubble{
          background:transparent;
          padding:0;
          width:100%;
          max-width:100%;
          box-sizing:border-box;
        }
        .acep-turn > .acep-bubble .message-bubble,
        .acep-turn > .acep-bubble .markdown,
        .acep-turn > .acep-bubble .prose,
        .acep-turn > .acep-bubble .content,
        .acep-turn > .acep-bubble .whitespace-pre-wrap,
        .acep-turn > .acep-bubble p,
        .acep-turn > .acep-bubble li,
        .acep-turn > .acep-bubble span{
          background:transparent !important;
          color:inherit !important;
        }

        /* Legacy/alternate wrappers (older templates used [data-acep-role] directly). */
        [data-acep-role="user"]:not(.acep-turn){
          background:#f3f4f6 !important;
          color:#111827 !important;
          padding:12px 14px !important;
          border-radius:16px !important;
          max-width:78%;
          margin:0 0 16px auto !important;
          border:1px solid #e5e7eb !important;
        }
        [data-acep-role="assistant"]:not(.acep-turn){
          background:transparent !important;
          color:${text} !important;
          padding:0 !important;
          margin:0 0 18px 0 !important;
          width:100%;
          max-width:100%;
          box-sizing:border-box;
        }
        [data-acep-role="assistant"]:not(.acep-turn) *,
        [data-acep-role="user"]:not(.acep-turn) *{
          background:transparent !important;
          color:inherit !important;
        }

        /* Role icons (for the newer .acep-turn structure). */
        .acep-role-head{ display:flex; width:100%; align-items:center; gap:6px; margin-bottom:6px; }
        .acep-turn[data-acep-role="user"] .acep-role-head{ justify-content:flex-end; }
        .acep-turn[data-acep-role="assistant"] .acep-role-head{ justify-content:flex-start; }
        .acep-role-head img.role-icon{ width:18px; height:18px; display:inline-block; border-radius:999px; }
        `}
        ${katexCss}
        ${extraCss}
      `;
      head.appendChild(style);

      const header = doc.createElement('div');
      try { header.setAttribute('data-acep-export-header', '1'); } catch {}
      header.style.textAlign = 'center';
      header.style.margin = '0 auto 18px';

      if (headerFilename) {
        const h1 = doc.createElement('h1');
        h1.textContent = headerFilename;
        h1.style.fontSize = `${Math.min(baseSize + 10, baseSize + 14)}px`;
        h1.style.fontWeight = '700';
        header.appendChild(h1);
      }
      if (subHeading) {
        const h2 = doc.createElement('h2');
        h2.textContent = subHeading;
        h2.style.fontSize = `${baseSize + 2}px`;
        h2.style.fontWeight = '600';
        h2.style.fontStyle = 'italic';
        header.appendChild(h2);
      }

      const infoLines = [];
      const lbl = (key, fallback) => {
        const t = __t(key);
        if (t && t !== key) return t;
        return fallback;
      };
      if (adv.userName) infoLines.push(`${lbl('label_name', 'Name:')} ${adv.userName}`);
      if (adv.userEmail) {
        const a = doc.createElement('a');
        a.href = `mailto:${adv.userEmail}`;
        a.textContent = `${lbl('label_email', 'Email:')} ${adv.userEmail}`;
        a.style.color = accent;
        infoLines.push(a.outerHTML);
      }
      if (adv.includeDateTime) {
        const now = new Date();
        infoLines.push(`${lbl('label_datetime', 'Date exported:')} ${now.toLocaleString()}`);
      }
      if (infoLines.length) {
        const p = doc.createElement('div');
        p.style.marginTop = '8px';
        p.style.fontSize = `${Math.max(8, baseSize - 1)}px`;
        p.style.lineHeight = '1.4';
        p.innerHTML = infoLines.join('<br/>');
        header.appendChild(p);
      }

      body.insertBefore(header, body.firstChild);

      // Add role icons for the newer minimal HTML format (if icons aren't removed).
      // Older templates already contain `img.role-icon` and shouldn't be modified.
      try {
        const removeIcons = !!adv.removeIcons;
        const disableRoleIcons = !!opts.disableRoleIcons;
        try { doc.documentElement.setAttribute('data-acep-remove-icons', removeIcons ? '1' : '0'); } catch {}
        if (removeIcons || disableRoleIcons) {
          // Be liberal here: older templates may have different wrappers, but they generally use `.role-icon`.
          try { doc.querySelectorAll('.acep-role-head, .role-icon, img[alt=\"user-icon\"], img[alt=\"assistant-icon\"]').forEach((n) => n.remove()); } catch {}
          try { doc.documentElement.setAttribute('data-acep-remove-icons-applied', '1'); } catch {}
        } else {
          const iconPaths = getProviderIconPaths(providerKey);
          const assistantCandidates = iconPaths.assistant;
          const iconAssets = {
            user: await loadIconAssets('user'),
            assistant: await loadIconFromCandidates(assistantCandidates),
          };
          const turns = Array.from(doc.querySelectorAll('.acep-turn[data-acep-role]'));
          turns.forEach((turnEl) => {
            try {
              if (turnEl.querySelector('img.role-icon')) return;
              const role = String(turnEl.getAttribute('data-acep-role') || '').toLowerCase();
              const icon = role === 'assistant' ? iconAssets.assistant : iconAssets.user;
              const dataUrl = icon?.dataUrl;
              if (!dataUrl || !/^data:image\/(png|jpe?g);base64,/i.test(dataUrl)) return;
              try { turnEl.setAttribute('data-acep-role-icon', '1'); } catch {}
              const headRow = doc.createElement('div');
              headRow.className = 'acep-role-head';
              const img = doc.createElement('img');
              img.className = 'role-icon';
              img.alt = role === 'assistant' ? 'assistant-icon' : 'user-icon';
              img.src = dataUrl;
              headRow.appendChild(img);
              turnEl.insertBefore(headRow, turnEl.firstChild);
            } catch {}
          });
        }
      } catch {}
      return '<!doctype html>\n' + doc.documentElement.outerHTML;
    } catch (e) {
      // Surface the failure directly in the exported HTML so it's debuggable.
      try {
        const msg = (e && (e.stack || e.message)) ? String(e.stack || e.message) : String(e || 'unknown error');
        const safeMsg = msg.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
        const safeHtml = String(html || '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
        return `<!doctype html><html><head><meta charset="utf-8"><title>ACEP HTML Build Error</title></head><body style="font-family:Segoe UI,Arial,sans-serif;padding:16px;"><h1>ACEP HTML buildHtmlWithHeader failed</h1><pre style="white-space:pre-wrap;border:1px solid #ddd;padding:12px;border-radius:8px;">${safeMsg}</pre><details open style="margin-top:12px;"><summary>Raw HTML (truncated)</summary><pre style="white-space:pre-wrap;border:1px solid #ddd;padding:12px;border-radius:8px;max-height:320px;overflow:auto;">${safeHtml.slice(0, 200000)}</pre></details></body></html>`;
      } catch {}
      return html;
    }
  }

  function _legacy_hasKatexInHtml(html = '', rows = []) {
    if (typeof html === 'string' && /class=["'][^"']*katex/i.test(html)) return true;
    if (typeof html === 'string' && /<math[\s>]/i.test(html)) return true;
    return (rows || []).some((row) => typeof row?.html === 'string' && (/<math[\s>]/i.test(row.html) || /class=["'][^"']*katex/i.test(row.html)));
  }

async function buildPdfMakePayload(rows, adv, headerFilename, subHeading, providerLabel, providerKey, iconAssets, tabId = null) {
    const providerKeyLc = String(providerKey || '').toLowerCase().trim();
    const providerObj = providerKeyLc ? (globalThis.ACEP?.providers?.[providerKeyLc] || null) : null;
    const providerExport = providerObj?.export || null;
    const pageSizesMm = {
      A4: { w: 210, h: 297 },
      Letter: { w: 215.9, h: 279.4 },
      Legal: { w: 215.9, h: 355.6 },
      A3: { w: 297, h: 420 },
      A5: { w: 148, h: 210 },
      Tabloid: { w: 279.4, h: 431.8 },
    };
    const sizeMm = pageSizesMm[adv.pageFormat] || pageSizesMm.A4;
    const isLandscape = (adv.orientation || 'portrait').toLowerCase() === 'landscape';
    const pageWidthMm = isLandscape ? sizeMm.h : sizeMm.w;
    const marginMm = Number(adv.margin ?? 20) || 20;
    const contentWidthPt = mmToPt(pageWidthMm - (marginMm * 2));
    const galleryGapPt = 2;
    const galleryTileWidthPt = Math.max(120, Math.floor((contentWidthPt - (galleryGapPt * 2)) / 3));
    const galleryTileHeightPt = Math.round(galleryTileWidthPt * 0.798);
    const chatgptGalleryTile = { width: galleryTileWidthPt, height: galleryTileHeightPt };
    const pdfMake = await ensurePdfMake();
    const needsKatex = hasKatexInHtml('', rows);
    await ensureEmojiFont();
    await ensureSymbolFont();
    // NotoSymbols2 is optional; don't attempt to load it unless it's bundled to avoid noisy ERR_FILE_NOT_FOUND logs.
    // (If you add `libs/NotoSansSymbols2-Regular.ttf`, you can re-enable this.)
    if (needsKatex) ensureGlobalKatexCss();
    try { window.__acepLastRows = rows || []; } catch {}
    try { window.parent && (window.parent.__acepLastRows = rows || []); } catch {}
    try { await ensureRowImagesData(rows, tabId); } catch {}

    const selectedFontKey = await ensurePdfMakeFontFamily(adv.font);

    const isDarkPdf = (adv.theme || 'light') === 'dark';
    const infoLines = [];
    const lbl = (key, fallback) => {
      const t = __t(key);
      if (t && t !== key) return t;
      return fallback;
    };
    if (adv.userName) infoLines.push(`${lbl('label_name', 'Name:')} ${adv.userName}`);
    if (adv.userEmail) infoLines.push({
      text: `${lbl('label_email', 'Email:')} ${adv.userEmail}`,
      link: `mailto:${adv.userEmail}`,
      color: isDarkPdf ? '#93c5fd' : '#2563eb',
    });
    if (adv.includeDateTime) {
      const now = new Date();
      infoLines.push(`${lbl('label_datetime', 'Date exported:')} ${now.toLocaleString()}`);
    }
    const fileTitleSegs = splitTextWithEmoji(headerFilename || '', {
      bold: true,
      fontSize: 18,
      color: isDarkPdf ? '#f9fafb' : '#111827',
    });
    const subTitleSegs = splitTextWithEmoji(subHeading || '', {
      bold: true,
      italics: true,
      fontSize: 13,
      color: isDarkPdf ? '#e5e7eb' : '#4b5563',
    });
    const headerParts = [
      { text: fileTitleSegs, style: 'fileTitle', alignment: 'center', margin: [0, 0, 0, 6] },
      { text: subTitleSegs, style: 'subTitle', alignment: 'center', margin: [0, infoLines.length ? 0 : 8, 0, infoLines.length ? 6 : 18] },
    ];
    if (infoLines.length) {
      headerParts.push({
        stack: infoLines.map(l => ({ text: l, alignment: 'center', fontSize: (adv.fontSize || 14) - 1 })),
        margin: [0, 0, 0, 18],
      });
    }

    const tocEnabled = !!adv.toc;
    const bodyBlocks = [];
    const tocEntries = [];
      const buildStackForRow = async (row, idx) => {
        const baseFontSize = adv.fontSize || 14;
        const isUser = row.role !== 'assistant';
        let blocks = [];
      let htmlForPdf = (row.html || '');
      try {
        if (providerExport && typeof providerExport.normalizeHtmlForExport === 'function') {
          const next = providerExport.normalizeHtmlForExport(htmlForPdf, { format: 'pdf', row, providerKey: providerKeyLc });
          if (typeof next === 'string') htmlForPdf = next;
        }
      } catch {}
      // Convert attachment markers into visible lines for paginated exports (PDF/DOCX).
      // This avoids relying on `row.imgs` (which can cause duplicates when the filename is also present in text).
      const hasAttachmentMarkers = /data-acep-attachment-name=/i.test(htmlForPdf || '');
      if (hasAttachmentMarkers) {
        try {
          htmlForPdf = htmlForPdf.replace(
            /<div\b[^>]*\bdata-acep-attachment-name\s*=\s*(["'])(.*?)\1[^>]*>\s*<\/div>/gi,
            (_m, _q, name) => `<p>[Attachment]: ${escapeHtmlLocal(String(name || '').trim())}</p>`
          );
        } catch {}
      }
      let messageText = getRowText(row, providerKeyLc);
      try { blocks = parseHtmlBlocks(htmlForPdf, { allowAsciiTables: true }); } catch { blocks = []; }
      try {
        if (providerExport && typeof providerExport.filterPdfBlocks === 'function') {
          const next = providerExport.filterPdfBlocks(blocks, { format: 'pdf', row, providerKey: providerKeyLc });
          if (Array.isArray(next)) blocks = next;
        }
      } catch {}
      // De-duplicate repeated attachment lines within this row (PDF can otherwise show it twice when both
      // a DOM marker and an attachment placeholder are present).
      try {
        const seenAtt = new Set();
        const dedupeAttachmentLines = (text = '') => {
          const lines = String(text || '').replace(/\r\n/g, '\n').split('\n');
          const out = [];
          for (const line of lines) {
            const m = String(line || '').match(/^\s*\[Attachment\]:\s*(.+?)\s*$/i);
            if (!m) { out.push(line); continue; }
            const name = String(m[1] || '').trim();
            if (!name) continue;
            const key = name.toLowerCase();
            if (seenAtt.has(key)) continue;
            seenAtt.add(key);
            out.push(`[Attachment]: ${name}`);
          }
          return out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
        };
        const isAttachmentOnlyRuns = (runs = []) => {
          try {
            const txt = runs.map(r => r?.text || '').join('').replace(/\s+/g, ' ').trim();
            const m = txt.match(/^\s*\[Attachment\]:\s*(.+?)\s*$/i);
            if (!m) return null;
            const name = String(m[1] || '').trim();
            return name || null;
          } catch { return null; }
        };
        blocks = (blocks || []).map((b) => {
          if (!b) return b;
          if (b.type === 'text' && b.text) {
            const t = dedupeAttachmentLines(b.text);
            return t ? { ...b, text: t } : null;
          }
          if (b.type === 'runs' && Array.isArray(b.runs)) {
            const name = isAttachmentOnlyRuns(b.runs);
            if (!name) return b;
            const key = name.toLowerCase();
            if (seenAtt.has(key)) return null;
            seenAtt.add(key);
            // Keep as-is (so PDF keeps underline/link formatting if any), but ensure no duplicates.
            return b;
          }
          return b;
        }).filter(Boolean);
      } catch {}
      if (!blocks.length && messageText) blocks = [{ type: 'text', text: messageText }];
      const hasImageBlocks = blocks.some(b => b && b.type === 'image' && b.src);
      const imgList = row.imgs;
      if (!hasImageBlocks && Array.isArray(imgList) && imgList.length) {
        const seen = new Set();
        imgList.forEach((im) => {
          const s = (im?.originalSrc || im?.src || '').split('#')[0];
          if (!s || seen.has(s)) return;
          // Only add as an image block when the URL is actually an image.
          // (Grok file uploads can expose `assets.grok.com/.../content` which is a file, not an image.)
          if (!isLikelyImageUrlForLink(s)) return;
          seen.add(s);
          blocks.push({ type: 'image', src: s });
        });
      }
      // Provider hook: preserve extra attachment markers for PDF (e.g., file chips that are outside scraped HTML).
      try {
        if (providerExport && typeof providerExport.augmentPdfBlocksForRow === 'function') {
          providerExport.augmentPdfBlocksForRow({ row, blocks, hasAttachmentMarkers, providerKey: providerKeyLc });
        }
      } catch {}
      const icon = getRemoveIcons() ? null : iconAssets[row.role === 'assistant' ? 'assistant' : 'user'];
      const stack = [];
      const iconIsDataUrl = typeof icon?.dataUrl === 'string' && /^data:image\/(png|jpe?g);base64,/i.test(icon.dataUrl);

      const bubbleBody = [];
      const currentRuns = [];
      const flushRuns = () => {
        if (!currentRuns.length) return;
        const hasSvg = currentRuns.some((r) => r.svg);
        if (!hasSvg) {
          bubbleBody.push({
            text: currentRuns.map((r) => ({ ...r })),
            style: 'message',
            margin: [0, 0, 0, 4],
            alignment: 'left',
          });
        } else {
          bubbleBody.push({
            columns: currentRuns.map(run => ({ ...run, width: run.width ?? 'auto' })),
            columnGap: 0,
            style: 'message',
            margin: [0, 0, 0, 4],
            alignment: 'left',
          });
        }
        currentRuns.length = 0;
      };
      const isValidImageDataUrl = (u) => typeof u === 'string' && /^data:image\/[a-z0-9.+-]+;base64,/i.test(u.trim());
      const addImageBlock = (img, src) => {
        const rawSrc = img?.dataUrl || img?.src || src || '';
        let svgText = img?.svgText || '';
        if (!svgText && /^data:image\/svg\+xml;(utf8|charset=utf-8),/i.test(rawSrc)) {
          try {
            const part = rawSrc.replace(/^data:image\/svg\+xml;(utf8|charset=utf-8),/i, '');
            svgText = decodeURIComponent(part || '');
          } catch {}
        }
        if (!svgText && /^data:image\/svg\+xml;base64,/i.test(rawSrc)) {
          try { svgText = atob(rawSrc.split(',')[1] || ''); } catch {}
        }
        const normalizeDataUrl = (u) => {
          if (typeof u !== 'string') return '';
          const trimmed = u.trim();
          if (/^data:application\/octet-stream;base64,/i.test(trimmed)) {
            return trimmed.replace(/^data:application\/octet-stream;base64,/i, 'data:image/png;base64,');
          }
          if (/^data:binary\/octet-stream;base64,/i.test(trimmed)) {
            return trimmed.replace(/^data:binary\/octet-stream;base64,/i, 'data:image/png;base64,');
          }
          if (/^data:image\/svg\+xml;(utf8|charset=utf-8),/i.test(trimmed)) {
            try {
              const part = trimmed.replace(/^data:image\/svg\+xml;(utf8|charset=utf-8),/i, '');
              const decoded = decodeURIComponent(part || '');
              return `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(decoded)))}`;
            } catch {}
            return trimmed;
          }
          if (/^data:image\/[a-z0-9.+-]+;base64,/i.test(trimmed)) return trimmed;
          return '';
        };
        const dataUrlRaw = normalizeDataUrl(rawSrc);
        const dataUrl = (typeof dataUrlRaw === 'string' && /^data:(?:image|application)\/[a-z0-9.+-]+;base64,/i.test(dataUrlRaw)) ? dataUrlRaw : '';
        if (!svgText && /^data:image\/svg\+xml;base64,/i.test(dataUrl)) {
          try { svgText = atob(dataUrl.split(',')[1] || ''); } catch {}
        }
        if (dataUrl && svgText) {
          bubbleBody.push({
            svg: svgText,
            fit: [650, 670],
            alignment: 'left',
            margin: [0, 4, 0, 6],
          });
          return;
        }
        if (img?.pngDataUrl && isValidImageDataUrl(img.pngDataUrl)) {
          bubbleBody.push({
            image: img.pngDataUrl,
            fit: [650, 670],
            alignment: 'left',
            border: [true, true, true, true],
            borderColor: isDarkPdf ? '#16a34a' : '#d1d5db',
            borderWidth: 0.6,
            margin: [0, 4, 0, 6],
          });
          return;
        }
        if (dataUrl && isValidImageDataUrl(dataUrl)) {
          const dimsRaw = normalizeDimensions(img.width, img.height, 300);
          const mainWidth = Math.min(260, Math.max(140, dimsRaw.width || 240));
          bubbleBody.push({
            image: dataUrl,
            width: mainWidth,
            alignment: 'center',
            border: [true, true, true, true],
            borderColor: isDarkPdf ? '#16a34a' : '#d1d5db',
            borderWidth: 0.6,
            margin: [0, 4, 0, 6],
          });
          return;
        }
        const original = src || img?.originalSrc || img?.src || '';
        if (original) {
          bubbleBody.push({
            text: splitTextWithEmoji(`[Image]: ${original}`, { link: original, color: '#2563eb', decoration: 'underline', style: 'imageLink' }),
            margin: [0, 4, 0, 6],
          });
        }
      };

      let hasImageBlock = false;
      // `row.imageCaption` is intended for image captions (ChatGPT generated images).
      // Some ChatGPT "sources" UI also uses `.truncate`, which can leak here; only show captions when the row has images.
      if (row.imageCaption && Array.isArray(row?.imgs) && row.imgs.length) {
        bubbleBody.push({ text: row.imageCaption, bold: true, color: '#16a34a', margin: [0, 0, 0, 4] });
      }

      const dataUrlToPngPdf = async (dataUrl) => {
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
        } catch { return null; }
      };
      const buildImageCell = async (b, meta, opts = {}) => {
        const maxWidth = opts.maxWidth || 170;
        const maxFit = opts.maxFit || [170, 130];
        const fixedSize = opts.fixedSize || null;
        const forceCover = opts.forceCover || false;
        const objectPosition = opts.objectPosition || meta?.objectPosition || '';
        const rawSrc = meta?.dataUrl || meta?.src || b.src || '';
        let svgText = meta?.svgText || '';
        if (!svgText && /^data:image\/svg\+xml;(utf8|charset=utf-8),/i.test(rawSrc || '')) {
          try {
            const part = (rawSrc || '').replace(/^data:image\/svg\+xml;(utf8|charset=utf-8),/i, '');
            svgText = decodeURIComponent(part || '');
          } catch {}
        }
        if (!svgText && /^data:image\/svg\+xml;base64,/i.test(rawSrc || '')) {
          try { svgText = atob((rawSrc || '').split(',')[1] || ''); } catch {}
        }
        const normalizeDataUrl = (u) => {
          if (typeof u !== 'string') return '';
          const trimmed = u.trim();
          if (/^data:application\/octet-stream;base64,/i.test(trimmed)) {
            return trimmed.replace(/^data:application\/octet-stream;base64,/i, 'data:image/png;base64,');
          }
          if (/^data:binary\/octet-stream;base64,/i.test(trimmed)) {
            return trimmed.replace(/^data:binary\/octet-stream;base64,/i, 'data:image/png;base64,');
          }
          if (/^data:image\/svg\+xml;(utf8|charset=utf-8),/i.test(trimmed)) {
            try {
              const part = trimmed.replace(/^data:image\/svg\+xml;(utf8|charset=utf-8),/i, '');
              const decoded = decodeURIComponent(part || '');
              return `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(decoded)))}`;
            } catch {}
            return trimmed;
          }
          if (/^data:image\/[a-z0-9.+-]+;base64,/i.test(trimmed)) return trimmed;
          return '';
        };
        let dataUrlRaw = normalizeDataUrl(rawSrc);
        let dataUrl = (typeof dataUrlRaw === 'string' && /^data:(?:image|application)\/[a-z0-9.+-]+;base64,/i.test(dataUrlRaw)) ? dataUrlRaw : '';
        if (!dataUrl) {
          const fetchSrc = meta?.originalSrc || meta?.src || b.src;
          const fetched = await fetchDataUrlStrong(fetchSrc, tabId).catch(() => null);
          if (fetched && /^data:image\/[a-z0-9.+-]+;base64,/i.test(fetched)) {
            dataUrlRaw = fetched;
            dataUrl = fetched;
            if (meta) meta.dataUrl = fetched;
          }
        }
        if (!svgText && /^data:image\/svg\+xml;base64,/i.test(dataUrl)) {
          try { svgText = atob(dataUrl.split(',')[1] || ''); } catch {}
        }
        if (svgText) {
          return {
            svg: svgText,
            fit: maxFit,
            alignment: 'center',
            margin: [0, 0, 0, 6],
          };
        }
        if (dataUrl && (/^data:image\/webp;base64,/i.test(dataUrl) || /^data:image\/avif;base64,/i.test(dataUrl))) {
          const converted = await dataUrlToPngPdf(dataUrl);
          if (converted) dataUrl = converted;
        }
        if (dataUrl && /^data:image\/[a-z0-9.+-]+;base64,/i.test(dataUrl)) {
          if (fixedSize && fixedSize.width && fixedSize.height) {
            if (forceCover) {
              try {
                const cover = await dataUrlCoverCrop(dataUrl, fixedSize.width, fixedSize.height, objectPosition, 2);
                if (cover) {
                  return {
                    image: cover,
                    width: fixedSize.width,
                    height: fixedSize.height,
                    alignment: opts.align || 'left',
                    margin: [0, 0, 0, 6],
                  };
                }
              } catch {}
            }
            return {
              image: dataUrl,
              width: fixedSize.width,
              height: fixedSize.height,
              alignment: opts.align || 'left',
              margin: [0, 0, 0, 6],
            };
          }
          // Cap at the image's natural pixel width to avoid upscaling small images (causes blur).
          // Only scale down if larger than maxWidth; never scale up.
          let naturalW = 0;
          try {
            await new Promise(res => {
              const t = new Image();
              t.onload = () => { naturalW = t.naturalWidth; res(); };
              t.onerror = res;
              t.src = dataUrl;
            });
          } catch {}
          const mainWidth = Math.max(1, naturalW > 0 ? Math.min(naturalW, maxWidth) : maxWidth);
          return {
            image: dataUrl,
            width: mainWidth,
            alignment: opts.align || 'center',
            margin: [0, 0, 0, 6],
          };
        }
        const original = b.src;
        if (!isLikelyImageUrlForLink(original)) return null;
        return {
          text: splitTextWithEmoji(`[Image]: ${original}`, { link: original, color: '#2563eb', decoration: 'underline', style: 'imageLink' }),
          margin: [0, 0, 0, 6],
        };
      };

      const headingFontSize = (adv.fontSize || 14) + 2;
      const buildPdfSegmentsFromRuns = (runs = [], extra = {}) => {
        const segs = [];
        runs.forEach((r) => {
          const fmt = {
            ...extra,
            bold: extra.bold || !!r.bold,
            italics: !!r.italics,
            decoration: r.decoration || (r.underline ? 'underline' : undefined),
            link: r.link,
            color: r.color || extra.color,
            fontSize: r.headingLevel ? headingFontSize : extra.fontSize,
          };
          const parts = splitTextWithEmoji(softBreakLongWords(r.text || ''), fmt);
          segs.push(...parts);
        });
        return segs;
      };

      for (let bi = 0; bi < blocks.length; bi++) {
        const b = blocks[bi];
        if (!b) continue;
        if (b.type === 'table' && Array.isArray(b.body) && b.body.length) {
          flushRuns();
          if (b.caption) {
            bubbleBody.push({ text: b.caption, bold: true, color: '#16a34a', margin: [0, 0, 0, 4] });
          }
          const tableBody = b.body.map((row, idx) => row.map((cell, cellIdx) => {
            const isHeader = b.hasHeader && idx === 0;
            const headerFill = isDarkPdf ? '#1f2937' : '#e8f5e9';
            const headerColor = isDarkPdf ? '#ffffff' : '#000000';
            const cellHtml = Array.isArray(b.bodyHtml?.[idx]) ? b.bodyHtml[idx][cellIdx] : '';
            let segments = [];
            if (cellHtml && /<[^>]+>/.test(cellHtml)) {
              const runs = htmlToInlineRuns(cellHtml);
              if (runs.length) segments = buildPdfSegmentsFromRuns(runs);
            }
            if (!segments.length) segments = linkifyTextSegments(softBreakLongWords(String(cell || '')));
            if (isHeader) segments = segments.map((seg) => ({ ...seg, bold: true }));
            const text = segments.length ? segments : splitTextWithEmoji(softBreakLongWords(String(cell || '')));
            return { text, fillColor: isHeader ? headerFill : undefined, color: isHeader ? headerColor : undefined };
          }));
          const colCount = b.body[0]?.length || 1;
          const pad = (colCount >= 6) ? 2 : (colCount >= 5 ? 3 : 6);
          const tableFontSize = Math.max(8, (adv.fontSize || 14) - (colCount >= 6 ? 3 : (colCount >= 5 ? 2 : 0)));
          const widths = (colCount >= 5)
            ? Array.from({ length: colCount }, () => Math.max(40, Math.floor((contentWidthPt - 8) / colCount)))
            : Array.from({ length: colCount }, () => '*');
          bubbleBody.push({
            table: {
              widths,
              body: tableBody,
              headerRows: 0,
              keepWithHeaderRows: 0,
              dontBreakRows: true,
            },
            layout: {
              hLineWidth: () => 0.5,
              vLineWidth: () => 0.5,
              hLineColor: () => '#16a34a',
              vLineColor: () => '#16a34a',
              paddingLeft: () => pad,
              paddingRight: () => pad,
              paddingTop: () => 6,
              paddingBottom: () => 6,
            },
            margin: [0, 4, 0, 8],
            alignment: 'left',
            fontSize: tableFontSize,
          });
        } else if (b.type === 'runs' && Array.isArray(b.runs) && b.runs.length) {
          flushRuns();
          const segs = buildPdfSegmentsFromRuns(b.runs, {});
          currentRuns.push(...segs);
          flushRuns();
        } else if (b.type === 'text' && b.text && b.text.trim()) {
          flushRuns();
          const segs = linkifyTextSegments(b.text);
          currentRuns.push(...segs);
          flushRuns();
        } else if (b.type === 'image' && b.src) {
          hasImageBlock = true;
          flushRuns();
          const normalizeImageKey = (s = '') => (s || '').split('#')[0];
          const uniqImageBlocks = (list = []) => {
            const seen = new Set();
            return list.filter((item) => {
              const key = normalizeImageKey(item?.src || '');
              if (!key || seen.has(key)) return false;
              seen.add(key);
              item.src = key;
              return true;
            });
          };
          let imageBlocks = [];
          for (let j = bi; j < blocks.length; j++) {
            const next = blocks[j];
            if (!next || next.type !== 'image' || !next.src) break;
            imageBlocks.push(next);
          }
           imageBlocks = uniqImageBlocks(imageBlocks);
           bi += imageBlocks.length - 1;
           const cells = [];
           const isUserRow = row.role !== 'assistant';
           const isSingleImage = imageBlocks.length === 1;
          const defaultGridSpec = (() => {
            const colCount = isUserRow ? (isSingleImage ? 1 : 2) : (isSingleImage ? 1 : 3);
            const cellOpts = isUserRow
              ? (isSingleImage ? { maxWidth: 300, maxFit: [300, 240], align: 'left' } : { maxWidth: 140, maxFit: [140, 110] })
              : (isSingleImage ? { maxWidth: 420, maxFit: [420, 320], align: 'left' } : { maxWidth: 170, maxFit: [170, 130] });
            return {
              colCount,
              cellOpts,
              widths: Array.from({ length: colCount }, () => '*'),
              padding: { left: 4, right: 4, top: 4, bottom: 6 },
              isGallery: false,
            };
          })();
          let gridSpec = defaultGridSpec;
          try {
            if (providerExport && typeof providerExport.getPdfImageGridSpec === 'function') {
              const next = providerExport.getPdfImageGridSpec({
                format: 'pdf',
                providerKey: providerKeyLc,
                row,
                imageBlocks,
                isUserRow,
                isSingleImage,
                defaultGridSpec,
                adv,
                contentWidthPt,
                chatgptGalleryTile,
              });
              if (next && typeof next === 'object') {
                gridSpec = {
                  ...defaultGridSpec,
                  ...next,
                  padding: { ...defaultGridSpec.padding, ...(next.padding || {}) },
                };
              }
            }
          } catch {}
          const colCount = Math.max(1, Number(gridSpec.colCount || 1));
          const cellOpts = gridSpec.cellOpts || defaultGridSpec.cellOpts;
          for (const imgBlock of imageBlocks) {
            const meta = (row.imgs || []).find((im) => {
              const keyA = (im.originalSrc || im.src || im.dataUrl || '').split('#')[0];
              const keyB = imgBlock.src.split('#')[0];
              return keyA && keyA === keyB;
            }) || {};
          const cell = await buildImageCell(imgBlock, meta, cellOpts);
          if (cell) cells.push(cell);
          }
          if (!cells.length) {
            continue;
          }
          const rows3 = [];
           for (let ci = 0; ci < cells.length; ci += colCount) {
             const slice = cells.slice(ci, ci + colCount);
             while (slice.length < colCount) slice.push({ text: '' });
             rows3.push(slice);
           }
           bubbleBody.push({
             table: {
              widths: Array.isArray(gridSpec.widths) && gridSpec.widths.length === colCount
                ? gridSpec.widths
                : Array.from({ length: colCount }, () => '*'),
               body: rows3,
             },
             layout: {
               hLineWidth: () => 0,
               vLineWidth: () => 0,
              paddingLeft: () => (gridSpec.padding?.left ?? 4),
              paddingRight: () => (gridSpec.padding?.right ?? 4),
              paddingTop: () => (gridSpec.padding?.top ?? 4),
              paddingBottom: () => (gridSpec.padding?.bottom ?? 6),
             },
             margin: [0, 4, 0, 6],
           });
        } else if (b.type === 'code' && b.text && b.text.trim()) {
          flushRuns();
          bubbleBody.push({
            table: {
              widths: ['*'],
              body: [[{ text: splitTextWithEmoji(b.text, { font: adv.font || 'TimesNewRoman' }), style: 'codeBlockText' }]],
            },
            layout: {
              hLineWidth: () => 0,
              vLineWidth: () => 0,
              paddingLeft: () => 10,
              paddingRight: () => 10,
              paddingTop: () => 8,
              paddingBottom: () => 8,
            },
            fillColor: isDarkPdf ? '#1f2937' : '#f3f4f6',
            margin: [0, 2, 0, 6],
            alignment: 'left',
          });
        }
      }

      flushRuns();

      if (iconIsDataUrl) {
        const iconNode = {
          image: icon.dataUrl,
          fit: [22, 22],
          alignment: isUser ? 'right' : 'left',
          margin: [0, 0, 0, 6],
        };
        if (isUser) {
          stack.push({
            columns: [
              { width: '*', text: '' },
              { width: 'auto', stack: [iconNode] },
            ],
            columnGap: 0,
            margin: [0, 0, 0, 0],
          });
        } else {
          stack.push(iconNode);
        }
      }

      if (bubbleBody.length) {
        const bubble = {
          table: { widths: ['*'], body: [[{ stack: bubbleBody, alignment: 'left' }]] },
          layout: {
            hLineWidth: () => 0,
            vLineWidth: () => 0,
            paddingLeft: () => 12,
            paddingRight: () => 12,
            paddingTop: () => 10,
            paddingBottom: () => 10,
          },
          fillColor: isDarkPdf ? '#111827' : '#f4f4f5',
        };
        if (isUser) {
          const userBubble = {
            ...bubble,
            table: { ...bubble.table, widths: ['auto'] },
            width: 'auto',
            alignment: 'right',
          };
          stack.push({
            columns: [
              { width: '*', text: '' },
              { width: 'auto', stack: [userBubble] },
            ],
            columnGap: 12,
            margin: [0, 2, 0, 14],
          });
        } else {
          bubbleBody.forEach(entry => {
            stack.push({
              ...entry,
              margin: entry.margin || [0, 2, 0, 10],
              alignment: 'left',
            });
          });
        }
      }

      return stack;
    };
    const postProcessPdfDocDef = (docDef) => {
      try {
        if (!docDef) return;
        if (providerExport && typeof providerExport.postProcessPdfDocDef === 'function') {
          providerExport.postProcessPdfDocDef(docDef, { format: 'pdf', providerKey: providerKeyLc });
        }
      } catch {}
    };

    for (let idx = 0; idx < rows.length; idx++) {
      ensureNotCanceled();
      const row = rows[idx];
      const isUser = row.role !== 'assistant';
      const stack = await buildStackForRow(row, idx);
      if (!Array.isArray(stack) || stack.length === 0) {
        // Avoid pdfMake "Unrecognized document structure" when a turn ends up with no renderable content.
        // (This can happen with upload/file-chip-only turns if the chip UI is outside the scraped HTML.)
        continue;
      }
      if (tocEnabled) {
        const snippet = getRowText(row, providerKeyLc).split(/\s+/).filter(Boolean).slice(0,10).join(' ');
        const label = `${row.role === 'assistant' ? (providerLabel || 'ChatGPT') : 'User'}${snippet ? ': ' + snippet : ''}`;
        const tocLink = `turn_${idx + 1}`;
        const labelParts = splitTextWithEmoji(label, {
          color: isDarkPdf ? '#93c5fd' : '#2563eb',
          linkToDestination: tocLink,
        });
        tocEntries.push({
          text: [
            { text: `${idx + 1}. `, bold: true },
            ...labelParts,
          ],
          margin: [0, idx === 0 ? 2 : 4, 0, 2],
        });
      }
      const anchor = tocEnabled ? { text: ' ', id: `turn_${idx + 1}`, fontSize: 1, margin: [0,0,0,0] } : null;
      if (anchor) bodyBlocks.push(anchor);
      bodyBlocks.push({
        columns: isUser
          ? [{ width: '100%', stack, alignment: 'right' }]
          : [{ width: '100%', stack, alignment: 'left' }],
        columnGap: 0,
        margin: [0, idx === 0 ? 6 : 12, 0, 10],
        pageBreak: adv.pageBreakPerPrompt ? 'after' : undefined,
        id: undefined,
      });
    }
    const content = [...headerParts];
    if (tocEnabled && tocEntries.length) {
      const sepColor = isDarkPdf ? '#374151' : '#d1d5db';
      content.push(
        { text: 'Table of Contents', style: 'tocHeading', margin: [0, 0, 0, 6] },
        { stack: tocEntries, margin: [0, 0, 0, 8] },
        { canvas: [ { type:'line', x1:0, y1:0, x2:515, y2:0, lineWidth:1, lineColor: sepColor } ], margin: [0, 6, 0, 12] },
      );
    }
    content.push(...bodyBlocks);

    const brandingEnabled = !getRemoveBranding();
    const docDef = {
      content,
      pageMargins: [
        mmToPt(adv.margin ?? 20),
        mmToPt(brandingEnabled ? (adv.margin ?? 24) : (adv.margin ?? 20)),
        mmToPt(adv.margin ?? 20),
        mmToPt(brandingEnabled ? (adv.margin ?? 28) : (adv.margin ?? 20)),
      ],
      pageSize: adv.pageFormat || 'A4',
      pageOrientation: adv.orientation || 'portrait',
      styles: {
        fileTitle: { fontSize: 18, bold: true, color: isDarkPdf ? '#f9fafb' : '#111827' },
        subTitle: { fontSize: 13, italics: true, color: isDarkPdf ? '#e5e7eb' : '#4b5563' },
        roleLabel: { fontSize: adv.fontSize || 14, bold: true, color: isDarkPdf ? '#f9fafb' : '#111827' },
        message: { fontSize: adv.fontSize || 14, lineHeight: 1.35, color: isDarkPdf ? '#f9fafb' : '#111827' },
        imageLink: { fontSize: (adv.fontSize || 14) - 1, italics: true, color: isDarkPdf ? '#93c5fd' : '#2563eb' },
        codeBlockText: { fontSize: (adv.fontSize || 14), font: adv.font || 'TimesNewRoman', color: isDarkPdf ? '#e5e7eb' : '#1f2937' },
        tocHeading: { fontSize: (adv.fontSize || 14) + 1, bold: true, color: isDarkPdf ? '#f9fafb' : '#111827' },
      },
      defaultStyle: {
        font: pdfMake.fonts[adv.font] ? adv.font : 'NotoSans',
        fontSize: adv.fontSize || 14,
        lineHeight: 1.4,
        color: isDarkPdf ? '#f9fafb' : '#111827',
        fallback: ['NotoEmoji', 'NotoSans'],
      },
      background: isDarkPdf
        ? function(currentPage, pageSize) {
            return {
              canvas: [
                { type: 'rect', x: 0, y: 0, w: pageSize.width, h: pageSize.height, color: '#0b1120' },
              ],
            };
          }
        : undefined,
      footer: (brandingEnabled && !adv.removePageNumbers)
        ? (currentPage, pageCount) => ({
            columns: [
              {
                text: 'Powered by: AIChatExporterPro',
                link: 'https://chatexport.workpent.com/',
                alignment: 'left',
                fontSize: 9,
                color: '#2563eb',
                margin: [40, 0, 0, 0],
              },
              {
                text: `${currentPage} / ${pageCount}`,
                alignment: 'right',
                fontSize: 9,
                color: '#888888',
                margin: [0, 0, 40, 0],
              },
            ],
            margin: [0, 0, 0, 24],
          })
        : undefined,
    };
    const invalidImages = [];
    const pruneImages = (node, path = []) => {
      const isObj = (v) => v && typeof v === 'object';
      if (Array.isArray(node)) {
        node.forEach((n, idx) => pruneImages(n, path.concat(`[${idx}]`)));
        return;
      }
      if (isObj(node)) {
        Object.keys(node).forEach((k) => {
          const v = node[k];
          if (k === 'image') {
            const ok = typeof v === 'string' && /^data:image\/[a-z0-9.+-]+;base64,/i.test(v);
            if (!ok) {
              invalidImages.push({ path: path.concat(k).join('.'), value: v });
              delete node[k];
              if (!node.text && !node.svg) node.text = '';
            }
          } else {
            pruneImages(v, path.concat(k));
          }
        });
      }
    };
    try { pruneImages(docDef); if (invalidImages.length) console.warn('ACEP removed invalid images', invalidImages.slice(0,5)); } catch {}

    const payload = {
      docDef,
      pdfMake,
      vfs: pdfMake.vfs || {},
      fonts: pdfMake.fonts || {},
      isDarkPdf,
      brandingEnabled,
    };
    postProcessPdfDocDef(payload.docDef);
    return payload;
  }
  function getRoleLabelForRow(row) {
    if (!row) return '';
    const stripLeadingEmoji = (s = '') => {
      const text = String(s || '').trim();
      if (!text) return '';
      try {
        // Remove leading emoji/pictographs + common joiners/variation selectors, then trim.
        return text.replace(/^[\p{Extended_Pictographic}\p{Emoji_Presentation}\p{Emoji}\u200d\uFE0F]+/gu, '').trim();
      } catch {
        // Fallback: strip a single leading surrogate pair / symbol-like char.
        return text.replace(/^[\uD800-\uDBFF][\uDC00-\uDFFF]\s*/,'').replace(/^[^\w(]+/,'').trim();
      }
    };
    const removeIcons = (() => {
      try { return !!getRemoveIcons(); } catch { return false; }
    })();

    const raw = (row.roleLabel && row.roleLabel.trim())
      || (row.role === 'user'
        ? ((/claude\.ai$/i.test(location.hostname)) ? '' : (__t('role_user') || 'You said'))
        : (row.role === 'assistant' ? (__t('role_assistant') || 'ChatGPT said') : (row.role || '')));

    return removeIcons ? stripLeadingEmoji(raw) : raw;
  }

  // Removed: legacy_buildDocxParagraphsForRow (unused). DOCX generation lives in core/exporters/docx.js.

  const stripExt = (s='') => s.replace(/\.[^.]+$/,'').trim();
  // Image-to-PDF path removed

  async function renderPagedImages(processedHtml, { width = 900, scale = 1.2, forceKatexHtmlLayer = false, forceKatexText = false, signal, onProgress } = {}) {
    const html2canvas = await ensureHtml2Canvas();
    const frame = document.createElement('iframe');
    frame.style.cssText='position:fixed;left:0;top:0;width:900px;height:10px;opacity:0;pointer-events:none;z-index:-1;aria-hidden:true;';
    document.body.appendChild(frame);
    await new Promise(res => { frame.onload=()=>res(); frame.srcdoc=processedHtml; });

    const fdoc = frame.contentDocument;
    const body = fdoc.body;
    body.style.margin = '0';
    body.style.backgroundColor = '#ffffff';

    if (forceKatexHtmlLayer) {
      try {
        const st = fdoc.createElement('style');
        st.textContent = `
          /* html2canvas can't render MathML, so use KaTeX HTML layer for PNG capture */
          .katex .katex-html { display: inline !important; }
          .katex .katex-mathml { display: none !important; }
        `;
        (fdoc.head || fdoc.documentElement).appendChild(st);
      } catch {}
    }

    if (forceKatexText) {
      try {
        const extractTex = (el) => {
          try {
            const ann = el.querySelector && el.querySelector('annotation[encoding=\"application/x-tex\"]');
            const t = (ann?.textContent || '').trim();
            if (t) return t;
          } catch {}
          try {
            const dt = (el.getAttribute && (el.getAttribute('data-math') || el.getAttribute('data-tex') || el.getAttribute('data-texsrc') || '')) || '';
            if (dt && dt.trim()) return dt.trim();
          } catch {}
          return '';
        };
        const replaceWithTex = (el, tex, display = false) => {
          const txt = display ? `$$${tex}$$` : `$${tex}$`;
          const span = fdoc.createElement('span');
          span.textContent = txt;
          span.style.whiteSpace = 'pre-wrap';
          span.style.fontFamily = 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, \"Liberation Mono\", \"Courier New\", monospace';
          span.style.fontSize = '0.98em';
          el.replaceWith(span);
        };

        // Replace known math placeholders first
        Array.from(fdoc.querySelectorAll('[data-math]')).forEach((el) => {
          const tex = extractTex(el);
          if (!tex) return;
          try { if (el.closest && el.closest('pre, code')) return; } catch {}
          const display = el.classList && (el.classList.contains('math-block') || el.classList.contains('katex-display'));
          replaceWithTex(el, tex, display);
        });

        // Replace KaTeX-rendered nodes (ChatGPT often uses this structure)
        Array.from(fdoc.querySelectorAll('.katex')).forEach((el) => {
          const tex = extractTex(el);
          if (!tex) return;
          try { if (el.closest && el.closest('pre, code')) return; } catch {}
          const display = el.classList && el.classList.contains('katex-display');
          replaceWithTex(el, tex, display);
        });
      } catch {}
    }

    await Promise.all(Array.from(body.querySelectorAll('img')).map(img => img.complete ? null : new Promise(r=>{
      img.addEventListener('load',r,{once:true}); img.addEventListener('error',r,{once:true});
    })));
    // Ensure webfonts (KaTeX, custom fonts) are loaded before rendering.
    try {
      if (fdoc.fonts && fdoc.fonts.ready) await fdoc.fonts.ready;
      // A tiny delay helps layout settle after fonts swap.
      await new Promise((r) => setTimeout(r, 50));
    } catch {}

    const clip = fdoc.createElement('div');
    clip.style.position = 'relative';
    clip.style.overflow = 'hidden';
    clip.style.width = `${width}px`;
    clip.style.margin = '0 auto';
    clip.style.background = '#ffffff';
    clip.style.padding = '0';
    clip.style.boxSizing = 'border-box';

    const content = fdoc.createElement('div');
    content.style.position = 'relative';
    content.style.width = 'calc(100% - 96px)';
    content.style.maxWidth = 'calc(100% - 96px)';
    content.style.margin = '0 auto';
    content.style.background = '#ffffff';
    content.style.boxSizing = 'border-box';
    content.style.padding = '0';
    content.style.overflow = 'visible';

    while (body.firstChild) {
      content.appendChild(body.firstChild);
    }
    clip.appendChild(content);
    body.appendChild(clip);

    const totalHeight = Math.max(content.scrollHeight, content.offsetHeight, content.clientHeight);
    const sliceCssHeight = Math.max(1200, Math.floor(2400 / scale));
    const totalPages = Math.max(1, Math.ceil(totalHeight / sliceCssHeight));
    const blobs = [];

    for (let offset = 0, page = 0; offset < totalHeight; offset += sliceCssHeight, page++) {
      ensureNotCanceled();
      if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');

      const pageHeightCss = Math.min(sliceCssHeight, totalHeight - offset);
      clip.style.height = `${pageHeightCss}px`;
      // Avoid CSS transforms here: html2canvas + KaTeX can render misaligned glyph baselines under transforms.
      content.style.top = `-${offset}px`;

      // Prefer html2canvas's normal renderer for PNG slices. foreignObjectRendering can crop
      // the left edge of complex provider DOM; keep it only as a fallback.
      let canvas = null;
      try {
        canvas = await html2canvas(clip, {
          useCORS: true,
          allowTaint: true,
          backgroundColor: '#ffffff',
          scale,
          windowWidth: width,
          removeContainer: true,
        });
      } catch {
        canvas = await html2canvas(clip, {
          useCORS: true,
          allowTaint: true,
          backgroundColor: '#ffffff',
          scale,
          windowWidth: width,
          foreignObjectRendering: true,
          removeContainer: true,
        });
      }

      let blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
      if (!blob) {
        const dataUrlFallback = canvas.toDataURL('image/png');
        blob = dataUrlToBlob(dataUrlFallback, 'image/png');
      }
      if (!blob) throw new Error('Could not create PNG slice');
      blobs.push(blob);

      onProgress?.({ page: page + 1, totalPages });
      await new Promise((resolve) => setTimeout(resolve, 0));
    }

    frame.remove();
    return blobs;
  }
  const mmToPt = (mm) => (Number(mm) || 0) * 72 / 25.4;

  function startProgressCycle(isLong, hasImages, onStep){
    const fallback = '...';
    const short = [__t('progress_reading'), __t('progress_preparing'), __t('progress_composing')].map(s => s || fallback);
    const long = [
      __t('progress_reading'),
      __t('progress_long'),
      hasImages ? (__t('progress_fetching_images') || __t('progress_collecting')) : __t('progress_preparing'),
      __t('progress_composing'),
    ].map(s => s || fallback);
    const steps = isLong ? long : short;
    let i = 0;
    exportBtn.textContent = steps[0];
    try { if (typeof onStep === 'function') onStep(steps[0]); } catch {}
    const timer = setInterval(() => {
      i = Math.min(i + 1, steps.length - 1);
      exportBtn.textContent = steps[i];
      try { if (typeof onStep === 'function') onStep(steps[i]); } catch {}
    }, 1300);
    return () => {
      clearInterval(timer);
      exportBtn.textContent = __t('btn_export_now') || 'Export Now';
    };
  }

  async function refreshAutoFilenameTitle(){
    try {
      const tab = await queryActiveTab();
      if (!tab) return;
      let title = tab?.title || 'AI Conversation';
      try { const r = await sendToTab(tab.id, { type: 'ACEP_GET_TITLE' }); title = r?.title || title; } catch {}
      const providerLabel = getProviderLabelFromUrl(tab?.url || '');
      const cleanTitle = stripProviderDupesFromTitle(title, providerLabel) || title;
      const baseName = (cleanTitle || 'AI Conversation').trim().replace(/\s+/g, ' ');
      if (fileNameEl && fileNameEl.dataset.autofill !== '0') {
        fileNameEl.value = withExt(baseName, fileTypeEl.value);
        try { fileNameEl.dataset.autofill = '1'; } catch {}
      }
      if (titleInput && titleInput.dataset.autofill !== '0') {
        titleInput.value = cleanTitle;
        try { titleInput.dataset.autofill = '1'; } catch {}
      }
    } catch {}
  }

  (async function initFilename(){
    try{
      await refreshAutoFilenameTitle();
    } catch {
      fileNameEl.value = withExt('AI Conversation', fileTypeEl.value);
    }
  })();

  window.addEventListener('focus', () => {
    if ((fileNameEl?.dataset?.autofill !== '0') || (titleInput?.dataset?.autofill !== '0')) {
      refreshAutoFilenameTitle().catch(() => {});
    }
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && ((fileNameEl?.dataset?.autofill !== '0') || (titleInput?.dataset?.autofill !== '0'))) {
      refreshAutoFilenameTitle().catch(() => {});
    }
  });

  const _prefsReady = (async function initExportPrefs(){
    try { await i18nReady; } catch {}
    try { await loadExportPrefs(); } catch {}
    try { await loadProviderPrefs(); } catch {}
  })();

  // Save provider prefs whenever either checkbox changes
  try {
    [grokShowMarkdownEl, chatgptShowDiagramCodeEl].forEach(el => {
      if (el) el.addEventListener('change', () => { saveProviderPrefs().catch(() => {}); });
    });
  } catch {}
  // Initialize plan gating for UI
  (async function initPlanGating(){
    try { await i18nReady; } catch {}
    try { CURRENT_PLAN = await getPlanFromStorage(); } catch { CURRENT_PLAN = 'free'; }
    try { await applyPlanGating(); } catch {}
  })();
  fileTypeEl?.addEventListener('change',()=>{
    _userHasModifiedSettings = true;
    if (fileNameEl && fileTypeEl) fileNameEl.value = withExt(fileNameEl.value || 'AI Conversation', fileTypeEl.value);
    updateAdvancedVisibility();
  });

  // If user edits the name, stop auto-overriding with detected titles
  try {
    fileNameEl?.addEventListener('input', () => { try { fileNameEl.dataset.autofill = '0'; } catch {} });
    fileNameEl?.addEventListener('change', () => { try { fileNameEl.dataset.autofill = '0'; } catch {} });
    titleInput?.addEventListener('input', () => { try { titleInput.dataset.autofill = '0'; } catch {} });
    titleInput?.addEventListener('change', () => { try { titleInput.dataset.autofill = '0'; } catch {} });
    advEnableEl?.addEventListener('change', () => {
      if (advSection) advSection.style.display = advEnableEl.checked ? 'block' : 'none';
    });
    updateAdvancedVisibility();
    try {
      // Ensure advanced options are visible by default in the settings page.
      if (advSection) {
        try { advSection.style.display = 'block'; } catch {}
        // If a hidden control exists, keep its checked state in sync visually
        try { if (advEnableEl) advEnableEl.checked = true; } catch {}
      }
    } catch {}
  } catch {}

  // Mark settings as user-modified on any change so loadExportPrefs() won't overwrite them
  try {
    const _markModified = () => { _userHasModifiedSettings = true; };
    [removeIconsEl, removeBrandingEl, muteEl, advPageFormatEl, advOrientationEl,
     advMarginEl, advFontEl, advFontSizeEl, advThemeEl, advTocEl, advPagebreakEl,
     advRemovePgNumEl, advDateTimeEl, advUserNameEl, advUserEmailEl
    ].forEach(el => { if (el) el.addEventListener('change', _markModified); });
    if (advUserNameEl) advUserNameEl.addEventListener('input', _markModified);
    if (advUserEmailEl) advUserEmailEl.addEventListener('input', _markModified);
    if (advMarginEl) advMarginEl.addEventListener('input', _markModified);
    if (advFontSizeEl) advFontSizeEl.addEventListener('input', _markModified);
  } catch {}

  const getRemoveBranding=()=> !!(removeBrandingEl&&removeBrandingEl.checked);
  const getRemoveIcons   =()=>!!(removeIconsEl&&removeIconsEl.checked);
  const getMute          =()=> !!(muteEl&&muteEl.checked);
  const getMuteDownload  =()=> !!(muteDownloadEl&&muteDownloadEl.checked);

  exportBtn.addEventListener('click', async ()=>{
    if (ACEP.exporting) return;
    ACEP.exporting = true;
    ACEP.canceled  = false;
    ACEP.abort     = new AbortController();
    try { if (networkErrorEl) networkErrorEl.style.display = 'none'; } catch {}

    let blob = null, name = '';
    try {
      LAST_EXPORT = { blob: null, name: '', multi: null, serverUrl: '' };
      SHARE_URL = '';
      if (downloadBtn) downloadBtn.onclick = null;
      if (readyNameEl) readyNameEl.textContent = '';
      if (shareLinkRow) shareLinkRow.style.display = 'none';
      if (shareLinkA) { shareLinkA.textContent = ''; shareLinkA.href = '#'; }
      if (makeLinkBtn) makeLinkBtn.disabled = true;
    } catch {}
    const analyticsStartedAt = Date.now();
    let analyticsContext = null;
    let serverDownloadUrl = '';
    let multiPageImages = null;
    let stopProgress = ()=>{};
    const plan = await getPlanFromStorage();
    CURRENT_PLAN = plan || 'free';
    const muted = getMute();
    const tab = await queryActiveTab();
    try { CURRENT_TAB_ID = tab?.id || CURRENT_TAB_ID; } catch {}

    const setBusyFlag = (v)=> {
      try { parent.postMessage({ type:'ACEP_SET_BUSY', busy:v }, '*'); } catch {}
      if (tab?.id) { sendToTab(tab.id, { type:'ACEP_SET_BUSY', busy:v }).catch(()=>{}); }
    };
    const sendMutedProgress = (message, done = false) => {
      const text = String(message || '');
      const progressPayload = { type: 'ACEP_EXPORT_PROGRESS', message: text, done: !!done };
      try { parent.postMessage(progressPayload, '*'); } catch {}
      if (tab?.id) { sendToTab(tab.id, progressPayload).catch(()=>{}); }
      if (!muted) return;
      const mutedPayload = { type: 'ACEP_MUTED_EXPORT_PROGRESS', message: text, done: !!done };
      try { parent.postMessage(mutedPayload, '*'); } catch {}
      if (tab?.id) { sendToTab(tab.id, mutedPayload).catch(()=>{}); }
    };

    try{
      setBusy(true);
      setLocked(true);
      sendMutedProgress(__t('progress_reading') || 'Reading chat...');

      if ((fileNameEl?.dataset?.autofill !== '0') || (titleInput?.dataset?.autofill !== '0')) {
        await refreshAutoFilenameTitle().catch(() => {});
      }

      if (muted) {
        try { parent.postMessage({ type:'ACEP_IFRAME_MUTE', mute:true }, '*'); } catch {}
        if (tab?.id) { sendToTab(tab.id, { type:'ACEP_IFRAME_MUTE', mute:true }).catch(()=>{}); }
      } else {
        setBusyFlag(true);
      }

      let want = (fileTypeEl.value||'html_self').toLowerCase();
      // Monthly gate (UX only, Free plan)
      const monthlyOk = await monthlyGateIfNeeded();
      if (!monthlyOk) { setBusy(false); setLocked(false); setBusyFlag(false); ACEP.exporting=false; ACEP.abort=null; return; }
      // Early quick gate before heavy scrape (Free plan, paginated formats)
      const quickOk = await quickEstimateGateIfNeeded(tab.id, want);
      if (!quickOk) { setBusy(false); setLocked(false); setBusyFlag(false); ACEP.exporting=false; ACEP.abort=null; return; }

      let exportMode = (want === 'html_linked') ? 'linked' : 'self';
      const adv = readAdvancedOptions();
      analyticsContext = { want, adv, tabUrl: tab?.url || '', selectedTurnIds: Array.isArray(SELECTED_TURN_IDS) ? SELECTED_TURN_IDS : null, selectionFilter: SELECTED_FILTER || '' };
      const res = await fetchExportData(tab.id, {
        removeIcons: getRemoveIcons(),
        branding: !getRemoveBranding(),
        exportMode,
        outputFormat: want,
        wantImageData: (want === 'docx'),
        theme: adv.theme || 'light',
        selectedTurnIds: Array.isArray(SELECTED_TURN_IDS) ? SELECTED_TURN_IDS : null,
        selectionFilter: SELECTED_FILTER || '',
      }, {
        onProgress: (progress) => {
          if (!progress) return;
          if (progress.stage === 'meta') {
            const msg = __t('progress_arranging_turns') || 'Arranging turns...';
            exportBtn.textContent = msg;
            sendMutedProgress(msg);
          } else if (progress.stage === 'html') {
            const msg = ((want === 'pdf_text' || want === 'docx')
              ? (__t('progress_fetching_images') || __t('progress_collecting') || 'Fetching images...')
              : (__t('progress_preparing') || 'Preparing export...'));
            exportBtn.textContent = msg;
            sendMutedProgress(msg);
          } else if (progress.stage === 'rows') {
            const done = Number(progress.completed || progress.index || 0);
            const total = Number(progress.total || progress?.meta?.rowCount || 0);
            const suffix = total > 0 ? ` (${Math.min(done, total)}/${total})` : '';
            const msg = `${__t('progress_arranging_turns') || 'Arranging turns...'}${suffix}`;
            exportBtn.textContent = msg;
            sendMutedProgress(msg);
          }
        },
      }, ACEP.abort?.signal);
      ensureNotCanceled();
      sendMutedProgress(__t('progress_preparing') || 'Preparing export...');

      const baseTitle = res.title || 'AI Conversation';
      const providerLabel = getProviderLabelFromUrl(tab?.url || '');
      LAST_PROVIDER_LABEL = providerLabel || 'AI';
      LAST_PROVIDER_KEY = getProviderKeyFromUrl(tab?.url || '') || '';
      const cleanBaseTitle = stripProviderDupesFromTitle(baseTitle, providerLabel) || baseTitle;
      const userFileName = (fileNameEl?.value || '').trim();
      const headerFilename = stripExt(userFileName) || (cleanBaseTitle || 'AI Conversation').trim();
      const subHeading = (titleInput?.value || '').trim() || cleanBaseTitle;
      const infoBlockPlain = [];
      if (adv.userName) infoBlockPlain.push(`Name: ${adv.userName}`);
      if (adv.userEmail) infoBlockPlain.push(`Email: ${adv.userEmail}`);
      if (adv.includeDateTime) infoBlockPlain.push(`Date exported: ${new Date().toLocaleString()}`);
      if (titleInput && (!titleInput.value || titleInput.dataset.autofill !== '0')) {
        titleInput.value = subHeading;
        try { titleInput.dataset.autofill = '1'; } catch {}
      }
      let htmlProcessed = res.html;
      let rows = res.rows || [];
      const providerKey = getProviderKeyFromUrl(tab?.url || '') || '';
      const _providerPrefs = await (async () => {
        try { const s = await getStorageArea(); const r = await s.get({ acep_provider_prefs: null }); return r?.acep_provider_prefs || {}; } catch { return {}; }
      })();
      const _exportCtx = {
        showArtifactContent: true,
        showGrokMarkdownContent: _providerPrefs.grok_showMarkdownContent !== false,
        chatgpt_showDiagramCode: !!_providerPrefs.chatgpt_showDiagramCode,
        tabUrl: tab?.url || '',
      };
      const normalizeHtmlForProvider = (html, row, format) => {
        try {
          const fn = globalThis?.ACEP?.providers?.[providerKey]?.export?.normalizeHtmlForExport;
          if (typeof fn !== 'function') return html;
          return fn(html, { format: format || '', row, providerKey, ..._exportCtx });
        } catch {
          return html;
        }
      };

      const normalizeBrokenMathHtmlForExport = (html = '') => {
        try {
          const raw = String(html || '');
          if (!/(katex|MathJax|mjx-container|<math\b|data-math=)/i.test(raw)) return raw;
          const parser = new DOMParser();
          const doc = parser.parseFromString(`<div>${raw}</div>`, 'text/html');
          const root = doc.body.firstElementChild || doc.body;
          const readTex = (el) => {
            try {
              const dataMath = String(el.getAttribute?.('data-math') || el.getAttribute?.('data-tex') || el.getAttribute?.('data-texsrc') || el.getAttribute?.('data-tex-source') || '').trim();
              if (dataMath) return dataMath;
              const ann = el.querySelector?.('annotation[encoding="application/x-tex"], annotation[encoding="application/x-latex"]');
              const annText = String(ann?.textContent || '').trim();
              if (annText) return annText;
              const aria = String(el.getAttribute?.('aria-label') || '').trim();
              if (aria && /[\\_^{}=+\-]/.test(aria) && !/^math/i.test(aria)) return aria;
            } catch {}
            return '';
          };
          const mathSelector = '.katex-display, .katex, mjx-container, math, [data-math]';
          const nodes = Array.from(root.querySelectorAll(mathSelector)).filter((el) => {
            try {
              const parentMath = el.parentElement?.closest?.(mathSelector);
              return !parentMath || !root.contains(parentMath);
            } catch { return true; }
          });
          nodes.forEach((el) => {
            try {
              if (el.closest?.('pre, code')) return;
              const tex = readTex(el);
              if (!tex) return;
              const cls = String(el.className || '');
              const display = /katex-display|math-block/i.test(cls)
                || String(el.getAttribute?.('display') || '').toLowerCase() === 'block'
                || String(el.getAttribute?.('data-display') || '').toLowerCase() === 'true';
              const replacement = doc.createElement(display ? 'div' : 'span');
              replacement.className = display ? 'acep-math-text acep-math-display' : 'acep-math-text acep-math-inline';
              replacement.textContent = display ? `$$${tex}$$` : `\\(${tex}\\)`;
              el.replaceWith(replacement);
            } catch {}
          });
          return root.innerHTML || raw;
        } catch {
          return String(html || '');
        }
      };
      const normalizeRowsMathForExport = () => {
        try {
          if (!Array.isArray(rows)) return;
          rows = rows.map((row) => {
            if (!row || typeof row !== 'object') return row;
            const next = { ...row };
            if (typeof next.html === 'string') next.html = normalizeBrokenMathHtmlForExport(next.html);
            if (typeof next.rawHtml === 'string') next.rawHtml = normalizeBrokenMathHtmlForExport(next.rawHtml);
            return next;
          });
        } catch {}
      };
      normalizeRowsMathForExport();
      htmlProcessed = normalizeBrokenMathHtmlForExport(htmlProcessed);
      // Preflight page gate for free users on paginated formats
      LAST_FORMAT = want;
      LAST_ESTIMATED_PAGES = (want === 'pdf_text' || want === 'docx') ? estimatePagesFromRows(rows) : 0;
      const okToProceed = await preflightPageGateIfNeeded(want, rows);
      if (!okToProceed) {
        try { stopProgress(); } catch {}
        ACEP.abort = null; ACEP.exporting = false; setLocked(false); setBusy(false); setBusyFlag(false);
        return;
      }

      const isLong = (htmlProcessed.length > 800_000 && rows.length > 30);
      const hasImages = /<img\s/i.test(htmlProcessed);
      stopProgress = startProgressCycle(isLong, hasImages, sendMutedProgress);


      // Build exported HTML locally (used by both HTML exports and as the base for PNG rendering).
      if (want === 'html_self' || want === 'html_linked') {
        const providerKey = getProviderKeyFromUrl(tab?.url || '');
        const extraCss = (() => {
          try {
            const fn = globalThis?.ACEP?.providers?.[providerKey]?.export?.getHtmlCss;
            if (typeof fn === 'function') return String(fn() || '');
          } catch {}
          return '';
        })();
        const normalizeHtml = (html) => {
          try {
            const fn = globalThis?.ACEP?.providers?.[providerKey]?.export?.normalizeHtmlForExport;
            if (typeof fn === 'function') return fn(html, _exportCtx);
          } catch {}
          return html;
        };
        htmlProcessed = normalizeHtml(htmlProcessed);
        if (hasKatexInHtml(htmlProcessed, [])) { try { await ensureKatexLib(); } catch {} }
        // Pre-render data-math placeholders in the live DOM before buildHtmlWithHeader.
        // DOMParser documents behave differently so we use a scratch div in the real document.
        if (window.katex?.renderToString && /data-math=/i.test(htmlProcessed)) {
          const scratch = document.createElement('div');
          document.body.appendChild(scratch);
          try {
            scratch.innerHTML = htmlProcessed;
            scratch.querySelectorAll('[data-math]').forEach(el => {
              const tex = el.getAttribute('data-math') || '';
              if (!tex) return;
              try { if (el.closest && el.closest('pre, code')) return; } catch {}
              const isDisplay = el.classList.contains('math-block') || el.classList.contains('katex-display');
              try {
                const tmp = document.createElement(isDisplay ? 'div' : 'span');
                tmp.innerHTML = window.katex.renderToString(tex, { displayMode: isDisplay, throwOnError: false, strict: 'ignore' });
                el.replaceWith(tmp.firstChild || tmp);
              } catch {}
            });
            htmlProcessed = scratch.innerHTML;
          } finally { scratch.remove(); }
        }
        htmlProcessed = await buildHtmlWithHeader(htmlProcessed, adv, headerFilename, subHeading, { extraCss, providerKey, inlineKatexFonts: true });
        // Provider hook: allow providers to prefetch/inline images for HTML self-contained.
        if (want === 'html_self') { 
          try { 
            const pre = globalThis?.ACEP?.providers?.[providerKey]?.export?.preProcessRowsForHtmlSelf; 
            if (typeof pre === 'function') { 
              await pre({ 
                tabUrl: tab?.url || '',
                tabId: tab?.id || null,
                rows,
                ensureRowImagesData,
                inlineRowHtmlImagesFromRowImgs,
              }); 
            } 
          } catch {} 
          // Ensure row images are actually fetched to data URLs before HTML self inlining.
          // Without this, providers like Grok can leave generated images as external/bad
          // sources, which render as broken <img> tags in the exported HTML.
          try { await ensureRowImagesData(rows, tab?.id || null); } catch {}
          // Generic: if any row images were fetched into data URLs, embed them into the full HTML. 
          try { htmlProcessed = inlineHtmlImagesFromRowsHtml(htmlProcessed, rows); } catch {} 
        } 
      } 

        // capture share meta (persist so the page-level modal can build a share message)
        LAST_SHARE_META = { provider: providerLabel, format: want, browser: detectBrowserLabel() };
        try { const s = await getStorageArea(); await s.set({ acep_last_share: LAST_SHARE_META }); } catch {}
        updateShareLinks();

      if (want === 'pdf_text') {
        const provider = getProviderKeyFromUrl(tab?.url || '');
        const extraCss = (() => {
          try {
            const fn = globalThis?.ACEP?.providers?.[provider]?.export?.getHtmlCss;
            if (typeof fn === 'function') return String(fn() || '');
          } catch {}
          return '';
        })();
        try { htmlProcessed = normalizeHtmlForProvider(htmlProcessed, null, 'pdf_text'); } catch {}
        if (hasKatexInHtml(htmlProcessed, rows)) { try { await ensureKatexLib(); } catch {} }
        try {
          const pre = globalThis?.ACEP?.providers?.[provider]?.export?.preProcessRowsForHtmlSelf;
          if (typeof pre === 'function') {
            await pre({
              tabUrl: tab?.url || '',
              tabId: tab?.id || null,
              rows,
              ensureRowImagesData,
              inlineRowHtmlImagesFromRowImgs,
            });
          }
        } catch {}
        try { await ensureRowImagesData(rows, tab?.id || null); } catch {}
        try { htmlProcessed = inlineHtmlImagesFromRowsHtml(htmlProcessed, rows); } catch {}

        try {
          const beforeFinalImgs = (String(htmlProcessed || '').match(/<img\b/gi) || []).length;
          const beforeFinalDataImgs = (String(htmlProcessed || '').match(/<img\b[^>]*\bsrc=["']data:image\//gi) || []).length;
          htmlProcessed = await inlineFinalHtmlProviderImages(htmlProcessed, { tabId: tab?.id || null, providerKey: provider });
          const afterFinalImgs = (String(htmlProcessed || '').match(/<img\b/gi) || []).length;
          const afterFinalDataImgs = (String(htmlProcessed || '').match(/<img\b[^>]*\bsrc=["']data:image\//gi) || []).length;
          try {
            const inlineAudit = Array.isArray(globalThis.__acepLastPdfImageInlineAudit) ? globalThis.__acepLastPdfImageInlineAudit : [];
            const auditValue = JSON.stringify({ beforeFinalImgs, beforeFinalDataImgs, afterFinalImgs, afterFinalDataImgs, inlineAudit }).slice(0, 3000);
            document.documentElement.setAttribute('data-acep-pdf-image-audit', auditValue);
            await setSourcePageDebugAttr(tab?.id || null, 'data-acep-pdf-image-audit', auditValue);
          } catch {}
        } catch {}
        const pdfMsg = (stage) => {
          const fallback = stage === 'uploading'
            ? 'Uploading PDF source...'
            : stage === 'submitting'
              ? 'Submitting PDF job...'
              : stage === 'starting'
                ? 'Starting PDF render...'
                : 'Rendering PDF...';
          const key = `progress_pdf_${stage}`;
          const localized = __t(key);
          const msg = localized && localized !== key ? localized : fallback;
          exportBtn.textContent = msg;
          sendMutedProgress(msg);
        };
        pdfMsg('submitting');
        try { await ensureRowImagesData(rows, tab?.id || null); } catch {}
        const bundle = await buildPdfRenderBundle({
          htmlProcessed,
          rows,
          adv,
          headerFilename,
          subHeading,
          providerKey: provider,
          providerLabel,
          extraCss,
          locale: (langEl?.value || ''),
                });
        try {
          const prev = JSON.parse(document.documentElement.getAttribute('data-acep-pdf-image-audit') || '{}');
          const bundleHtml = String(bundle?.document?.html || '');
          const bundleImgs = (bundleHtml.match(/<img\b/gi) || []).length;
          const bundleDataImgs = (bundleHtml.match(/<img\b[^>]*\bsrc=["']data:image\//gi) || []).length;
          const auditValue = JSON.stringify({ ...prev, bundleImgs, bundleDataImgs }).slice(0, 1000);
          document.documentElement.setAttribute('data-acep-pdf-image-audit', auditValue);
          await setSourcePageDebugAttr(tab?.id || null, 'data-acep-pdf-image-audit', auditValue);
        } catch {}
        ensureNotCanceled();
        const installId = await ensureInstallId();
        const pdfJob = await createServerPdfJob({
          apiBase: API_BASE,
          bundle,
          filename: withExt(fileNameEl.value || headerFilename, want),
          installId,
          authHeaders: signedHeadersForApi,
          signal: ACEP.abort?.signal,
          onProgress: (stage) => pdfMsg(stage || 'rendering'),
        });
        const pdfReady = await pollServerPdfJob({
          apiBase: API_BASE,
          job: pdfJob,
          installId,
          authHeaders: signedHeadersForApi,
          signal: ACEP.abort?.signal,
          timeoutMs: 360000,
          onProgress: () => pdfMsg('rendering'),
        });
        serverDownloadUrl = getServerPdfDownloadUrl({
          apiBase: API_BASE,
          job: pdfReady,
        });
      } else if (want === 'png_plain') {
        const selectedHasKatex = hasKatexInHtml(res.html, rows);
        if (isLong) {
          alert(__t('warn_long_png_title') || 'This chat is too long for PNG. Please choose PDF (Text) or DOCX.');
          throw new Error('Export canceled');
        }
        // PNG has no explicit theme toggle in the UI. Force a deterministic light theme so the result
        // doesn't depend on whatever theme was used for the last PDF/DOCX/HTML export.
        const advForPng = { ...(adv || {}), theme: 'light' };
        const providerKey = getProviderKeyFromUrl(tab?.url || '');
        const extraCss = (() => {
          try {
            const fn = globalThis?.ACEP?.providers?.[providerKey]?.export?.getHtmlCss;
            if (typeof fn === 'function') return String(fn() || '');
          } catch {}
          return '';
        })();
        // PNG is rendered from HTML via html2canvas, so apply our export CSS + KaTeX CSS first.
        let pngBaseHtml = htmlProcessed;
        try {
          const fn = globalThis?.ACEP?.providers?.[providerKey]?.export?.normalizeHtmlForExport;
          if (typeof fn === 'function') pngBaseHtml = fn(pngBaseHtml);
        } catch {}
        // Pre-render KaTeX placeholders for PNG too (otherwise users see raw TeX).
        if (selectedHasKatex) {
          try { await ensureKatexLib(); } catch {}
          if (window.katex?.renderToString && /data-math=/i.test(pngBaseHtml || '')) {
            const scratch = document.createElement('div');
            document.body.appendChild(scratch);
            try {
              scratch.innerHTML = pngBaseHtml;
              scratch.querySelectorAll('[data-math]').forEach(el => {
                const tex = el.getAttribute('data-math') || '';
                if (!tex) return;
                try { if (el.closest && el.closest('pre, code')) return; } catch {}
                const isDisplay = el.classList.contains('math-block') || el.classList.contains('katex-display');
                try {
                  const tmp = document.createElement(isDisplay ? 'div' : 'span');
                  tmp.innerHTML = window.katex.renderToString(tex, { displayMode: isDisplay, throwOnError: false, strict: 'ignore' });
                  el.replaceWith(tmp.firstChild || tmp);
                } catch {}
              });
              pngBaseHtml = scratch.innerHTML;
            } finally { scratch.remove(); }
          }
        }
        let htmlForPng = await buildHtmlWithHeader(pngBaseHtml, advForPng, headerFilename, subHeading, { forPng: true, extraCss, providerKey, inlineKatexFonts: true });
        try {
          const pre = globalThis?.ACEP?.providers?.[providerKey]?.export?.preProcessRowsForHtmlSelf;
          if (typeof pre === 'function') {
            await pre({
              tabUrl: tab?.url || '',
              tabId: tab?.id || null,
              rows,
              ensureRowImagesData,
              inlineRowHtmlImagesFromRowImgs,
            });
          }
        } catch {}
        try { htmlForPng = inlineHtmlImagesFromRowsHtml(htmlForPng, rows); } catch {}
        const pageBlobs = await renderPagedImages(htmlForPng, {
          width: 900,
          scale: 1.6,
          signal: ACEP.abort?.signal,
          onProgress: ({ page, totalPages }) => {
            if (totalPages > 1) {
              const msg = `${__t('progress_composing') || 'Composing file...'} (${page}/${totalPages})`;
              exportBtn.textContent = msg;
              sendMutedProgress(msg);
            }
          },
        });
        if (!pageBlobs?.length) throw new Error('Export failed: missing image data');
        if (pageBlobs.length === 1) {
          blob = pageBlobs[0];
        } else {
          // Merge to a single tall PNG so users still get one PNG
          blob = await mergePagePngsToSingleBlob(pageBlobs);
        }
      } else if (want === 'docx') {
        try {
          await ensureKatexLib();
          const providerKey = getProviderKeyFromUrl(tab?.url || '');
          const fn = globalThis?.ACEP?.providers?.[providerKey]?.export?.processDocxRows;
          if (typeof fn === 'function') rows = fn(rows);
        } catch {}
        try {
          const docxProviderKey = getProviderKeyFromUrl(tab?.url || '') || '';
          const pre = globalThis?.ACEP?.providers?.[docxProviderKey]?.export?.preProcessRowsForHtmlSelf;
          if (typeof pre === 'function') {
            await pre({
              tabUrl: tab?.url || '',
              tabId: tab?.id || null,
              rows,
              ensureRowImagesData,
              inlineRowHtmlImagesFromRowImgs,
            });
          }
        } catch {}
        try { await ensureRowImagesData(rows, tab?.id || null); } catch {}
        try { inlineRowHtmlImagesFromRowImgs(rows); } catch {}
        // Pre-render data-math placeholders so DOCX builder sees .katex-mathml sub-elements
        if (window.katex?.renderToString) {
          const scratch = document.createElement('div');
          document.body.appendChild(scratch);
          try {
            for (const row of rows) {
              if (!row.html || !/data-math=/i.test(row.html)) continue;
              scratch.innerHTML = row.html;
              scratch.querySelectorAll('[data-math]').forEach(el => {
                const tex = el.getAttribute('data-math') || '';
                if (!tex) return;
                try { if (el.closest && el.closest('pre, code')) return; } catch {}
                const isDisplay = el.classList.contains('math-block') || el.classList.contains('katex-display');
                try {
                  const tmp = document.createElement(isDisplay ? 'div' : 'span');
                  tmp.innerHTML = window.katex.renderToString(tex, { displayMode: isDisplay, throwOnError: false, strict: 'ignore' });
                  el.replaceWith(tmp.firstChild || tmp);
                } catch {}
              });
              row.html = scratch.innerHTML;
            }
          } finally { scratch.remove(); }
        }
        try { await ensureRowImagesData(rows, tab?.id || null); } catch {}
        try { window.__acepLastRows = rows || []; } catch {}
        try { window.parent && (window.parent.__acepLastRows = rows || []); } catch {}
        const docxLib = await ensureDocx();
        const provider = getProviderKeyFromUrl(tab?.url || '') || 'chatgpt';
        const iconPaths = getProviderIconPaths(provider);
        const assistantCandidates = iconPaths.assistant;
        const iconAssets = getRemoveIcons() ? {}
          : {
              user: await loadIconAssets('user'),
              assistant: await loadIconFromCandidates(assistantCandidates),
            };
        const isDarkDocx = (adv.theme || 'light') === 'dark';
        const mmToTwip = (mm) => Math.round((Number(mm) || 0) * 56.6929); // 1 inch = 1440 twips, 25.4mm
        const pageSizes = {
          A4: { w: 210, h: 297 },
          Letter: { w: 215.9, h: 279.4 },
          Legal: { w: 215.9, h: 355.6 },
          A3: { w: 297, h: 420 },
          A5: { w: 148, h: 210 },
          Tabloid: { w: 279.4, h: 431.8 },
        };
        const sizeMm = pageSizes[adv.pageFormat] || pageSizes.A4;
        const orient = (adv.orientation || 'portrait').toLowerCase();
        const widthTwip = orient === 'landscape' ? mmToTwip(sizeMm.h) : mmToTwip(sizeMm.w);
        const heightTwip = orient === 'landscape' ? mmToTwip(sizeMm.w) : mmToTwip(sizeMm.h);
        const marginTwip = mmToTwip(adv.margin ?? 20);
        const availableTwip = Math.max(0, widthTwip - (marginTwip * 2));
        const availablePx = Math.floor(availableTwip / 15);
        const galleryGapPx = 2;
        const galleryTilePx = Math.max(120, Math.floor((availablePx - (galleryGapPx * 2)) / 3));
        const galleryTile = { width: galleryTilePx, height: Math.round(galleryTilePx * 0.798) };
        const docFont = adv.font || 'Calibri';
        const docSize = Math.max(8, adv.fontSize || 14) * 2; // docx uses half-points
        const docColor = isDarkDocx ? 'FFFFFF' : '000000';
        const pageColor = isDarkDocx ? '0D0F14' : 'FFFFFF';
        const lbl = (key, fallback) => {
          const t = __t(key);
          if (t && t !== key) return t;
          return fallback;
        };
        const children = [];
        const headingOptions = docxLib.HeadingLevel
          ? { heading: docxLib.HeadingLevel.HEADING_1 }
          : {};
        const headerSizeHalfPt = Math.max((adv.fontSize || 14) + 4, 18) * 2; // at least +4pt over base, min 18pt
        const subSizeHalfPt = Math.max((adv.fontSize || 14) + 2, 14) * 2;
        children.push(
          new docxLib.Paragraph({
            alignment: docxLib.AlignmentType ? docxLib.AlignmentType.CENTER : undefined,
            ...headingOptions,
            children: [new docxLib.TextRun({ text: headerFilename, size: headerSizeHalfPt, bold: true, font: docFont, color: docColor })],
            spacing: { after: 120 },
          })
        );
        children.push(
          new docxLib.Paragraph({
            children: [new docxLib.TextRun({ text: subHeading, size: subSizeHalfPt, bold: true, italics: true, font: docFont, color: docColor })],
            italics: true,
            alignment: docxLib.AlignmentType ? docxLib.AlignmentType.CENTER : undefined,
            spacing: { after: 240 },
          })
        );
        const infoParas = [];
        if (adv.userName) {
          infoParas.push(new docxLib.Paragraph({ children: [new docxLib.TextRun({ text: `${lbl('label_name','Name:')} ${adv.userName}`, color: docColor })], alignment: docxLib.AlignmentType ? docxLib.AlignmentType.CENTER : undefined, spacing: { after: 80 } }));
        }
        if (adv.userEmail) {
          const emailRun = docxLib.ExternalHyperlink
            ? new docxLib.ExternalHyperlink({ link: `mailto:${adv.userEmail}`, children: [new docxLib.TextRun({ text: `${lbl('label_email','Email:')} ${adv.userEmail}`, color: isDarkDocx ? '93c5fd' : '2563EB', underline: {} })] })
            : new docxLib.TextRun({ text: `${lbl('label_email','Email:')} ${adv.userEmail}`, color: isDarkDocx ? '93c5fd' : '2563EB', underline: {} });
          infoParas.push(new docxLib.Paragraph({ children: [emailRun], alignment: docxLib.AlignmentType ? docxLib.AlignmentType.CENTER : undefined, spacing: { after: 80 } }));
        }
        if (adv.includeDateTime) {
          const now = new Date();
          infoParas.push(new docxLib.Paragraph({ children: [new docxLib.TextRun({ text: `${lbl('label_datetime','Date exported:')} ${now.toLocaleString()}`, color: docColor })], alignment: docxLib.AlignmentType ? docxLib.AlignmentType.CENTER : undefined, spacing: { after: 120 } }));
        }
        if (infoParas.length) children.push(...infoParas);

        // Build TOC (simple list, non-clickable fallback)
        const tocParas = [];
        const makeAnchorPara = (anchorId) => {
          try {
            if (docxLib.Bookmark) {
              return new docxLib.Paragraph({
                children: [
                  new docxLib.Bookmark({
                    id: anchorId,
                    children: [new docxLib.TextRun({ text: '' })],
                  }),
                ],
                spacing: { after: 0 },
              });
            }
          } catch {}
          return new docxLib.Paragraph({ children: [new docxLib.TextRun({ text: '' })], spacing: { after: 0 } });
        };
        if (adv.toc) {
          tocParas.push(new docxLib.Paragraph({
            text: 'Table of Contents',
            alignment: docxLib.AlignmentType ? docxLib.AlignmentType.LEFT : undefined,
            spacing: { after: 160 },
          }));
        }

        for (let idx = 0; idx < rows.length; idx++) {
          ensureNotCanceled();
          const row = rows[idx];
          const isUser = row.role !== 'assistant';
          const align = docxLib.AlignmentType ? (isUser ? docxLib.AlignmentType.RIGHT : docxLib.AlignmentType.LEFT) : undefined;

          const headerChildren = [];
          if (!getRemoveIcons()) {
            const icon = iconAssets[row.role === 'assistant' ? 'assistant' : 'user'];
            if (icon?.binary) {
              if (isUser) headerChildren.push(new docxLib.TextRun({ text: ' ' }));
              headerChildren.push(new docxLib.ImageRun({ data: icon.binary, transformation: { width: 22, height: 22 } }));
              if (!isUser) headerChildren.push(new docxLib.TextRun({ text: ' ' }));
            }
          }
          if (headerChildren.length) {
            children.push(new docxLib.Paragraph({
              children: headerChildren,
              spacing: { after: 80 },
              alignment: align,
            }));
          }

          if (adv.toc) {
            const snippet = getRowText(row, provider).split(/\s+/).filter(Boolean).slice(0, 10).join(' ');
            const label = `${row.role === 'assistant' ? (provider.charAt(0).toUpperCase()+provider.slice(1)) : 'User'}${snippet ? ': ' + snippet : ''}`;
            const anchorId = `turn_${idx + 1}`;
            let entryPara;
            try {
              if (docxLib.InternalHyperlink) {
                entryPara = new docxLib.Paragraph({
                  children: [
                    new docxLib.TextRun({ text: `${idx + 1}. `, bold: true, color: docColor }),
                    new docxLib.InternalHyperlink({
                      anchor: anchorId,
                      children: [new docxLib.TextRun({ text: label, color: isDarkDocx ? '93c5fd' : '2563EB', underline: {} })],
                    }),
                  ],
                  spacing: { after: 80 },
                });
              }
            } catch {}
            if (!entryPara) {
              entryPara = new docxLib.Paragraph({
                children: [
                  new docxLib.TextRun({ text: `${idx + 1}. `, bold: true, color: docColor }),
                  new docxLib.TextRun({ text: label, color: isDarkDocx ? '93c5fd' : '2563EB' }),
                ],
                spacing: { after: 80 },
              });
            }
            tocParas.push(entryPara);
            // drop an anchor paragraph for this turn
            children.push(makeAnchorPara(anchorId));
          }

          const applyPageBreak = adv.pageBreakPerPrompt && idx > 0;
          if (applyPageBreak) {
            children.push(new docxLib.Paragraph({ pageBreakBefore: true }));
          }

          const bodyParas = await buildDocxParagraphsForRow(docxLib, row, {
            isUser,
            isDark: isDarkDocx,
            galleryTile,
            docFont,
            docSize,
            tabId: tab?.id || null,
            imagesOnly: (SELECTED_FILTER || '') === 'images',
            providerLabel: provider,
            fetchDataUrlStrong,
            suppressHeading: !!getRemoveIcons(),
          });
          if (bodyParas.length) {
            children.push(...bodyParas);
          } else {
            const fallback = getRowText(row, provider);
            if (fallback) {
              children.push(new docxLib.Paragraph({
                children: [new docxLib.TextRun({ text: fallback })],
                spacing: { after: 160 },
                alignment: docxLib.AlignmentType ? docxLib.AlignmentType.LEFT : undefined,
                indent: isUser ? { left: 1440 } : { right: 1440 },
                shading: { type: 'clear', color: 'auto', fill: 'F3F4F6' },
              }));
            }
          }
        }

        let footerDefinition = null;
        if (!getRemoveBranding() && rows.length && docxLib.Footer) {
          const brandRun = new docxLib.TextRun({
            text: 'Powered by: AIChatExporterPro',
            italics: true,
            color: '2563EB',
            underline: {},
          });
          const footerChildren = docxLib.ExternalHyperlink
            ? [
                new docxLib.ExternalHyperlink({
                  link: 'https://chatexport.workpent.com/',
                  children: [brandRun],
                }),
              ]
            : [brandRun];
          footerDefinition = new docxLib.Footer({
            children: [
              new docxLib.Paragraph({
                children: footerChildren,
                spacing: { after: 0 },
                alignment: docxLib.AlignmentType ? docxLib.AlignmentType.LEFT : undefined,
              }),
            ],
          });
        }

        if (!footerDefinition && !getRemoveBranding() && rows.length) {
          const hyperlinkChildFallback = docxLib.ExternalHyperlink
            ? new docxLib.ExternalHyperlink({
                link: 'https://chatexport.workpent.com/',
                children: [
                  new docxLib.TextRun({
                    text: 'Powered by: AIChatExporterPro',
                    italics: true,
                    color: '2563EB',
                    underline: {},
                  }),
                ],
              })
            : new docxLib.TextRun({
                text: 'Powered by: AIChatExporterPro',
                italics: true,
                color: '2563EB',
              });
          children.push(
            new docxLib.Paragraph({
              children: [hyperlinkChildFallback],
              spacing: { before: 240 },
              alignment: docxLib.AlignmentType ? docxLib.AlignmentType.LEFT : undefined,
            })
          );
        }

        if (adv.toc && tocParas.length) {
          // Insert TOC after header/subtitle/info plus a separator line
          const sepColor = isDarkDocx ? '444444' : '888888';
          const separator = new docxLib.Paragraph({
            children: [],
            border: { bottom: { color: sepColor, space: 1, size: 6 } },
            spacing: { after: 160 },
          });
          children.splice(2 + infoParas.length, 0, ...tocParas, separator);
        }

        const doc = new docxLib.Document({
          background: { color: pageColor },
          styles: {
            default: {
              document: {
                run: { size: docSize, font: docFont, color: docColor },
                paragraph: { spacing: { after: 200 } },
              },
            },
          },
          sections: [
            {
              properties: {
                page: {
                  pageColor,
                  size: { width: widthTwip, height: heightTwip, orientation: orient === 'landscape' ? docxLib.PageOrientation.LANDSCAPE : docxLib.PageOrientation.PORTRAIT },
                  margin: { top: marginTwip, right: marginTwip, bottom: marginTwip, left: marginTwip },
                },
              },
              footers: footerDefinition ? { default: footerDefinition } : undefined,
              children,
            },
          ],
        });
        blob = await docxLib.Packer.toBlob(doc);
      } else if (want === 'txt') {
        const lines = [];
        lines.push(headerFilename);
        if (infoBlockPlain.length) lines.push(...infoBlockPlain);
        lines.push('');
        const stripMathDollarWrappersForTxt = (text = '') => {
          // TXT-only readability: remove KaTeX-style $...$ / $$...$$ wrappers, but avoid common false-positives
          // like currency ($5.00) and leave code blocks untouched (code blocks are emitted separately).
          let s = String(text || '');
          if (!s.includes('$')) return s;
          try {
            // Display math: $$...$$ (allow multiline)
            s = s.replace(/\$\$([\s\S]*?)\$\$/g, (_, inner) => String(inner ?? ''));
            // Inline math: $...$ (single-line)
            s = s.replace(/\$([^\n$]{1,800}?)\$/g, (m, inner) => {
              const mid = String(inner ?? '').trim();
              if (!mid) return m;
              // Keep as currency if inner starts with a digit ($5, $100.00, $1,000)
              if (/^\d/.test(mid)) return m;
              // Strip the $..$ wrappers for TXT readability.
              return mid;
            });
          } catch {}
          return s;
        };
        const normalizeAttachmentName = (s = '') =>
          String(s || '')
            .replace(/\u00a0/g, ' ')
            .replace(/[\u200B-\u200D\uFEFF]/g, '')
            .replace(/\s+/g, ' ')
            .trim();
        const collectAttachmentNamesFromBlocks = (blocks = []) => {
          const out = [];
          if (!Array.isArray(blocks) || !blocks.length) return out;
          const addLine = (line = '') => {
            const m = String(line || '').match(/^\s*\[Attachment\]:\s*(.+?)\s*$/i);
            if (!m) return;
            const name = normalizeAttachmentName(m[1] || '');
            if (name) out.push(name);
          };
          blocks.forEach((b) => {
            if (!b) return;
            if (b.type === 'text' && b.text) {
              String(b.text || '').replace(/\r\n/g, '\n').split('\n').forEach(addLine);
              return;
            }
            if (b.type === 'runs' && Array.isArray(b.runs)) {
              const txt = b.runs.map(r => (r && typeof r.text === 'string' ? r.text : '')).join('');
              String(txt || '').replace(/\r\n/g, '\n').split('\n').forEach(addLine);
            }
          });
          return out;
        };
        const dedupeAttachmentLinesInText = (text = '', seenAttachments = new Set()) => {
          const raw = String(text || '').replace(/\r\n/g, '\n');
          if (!raw) return '';
          const out = [];
          raw.split('\n').forEach((line) => {
            const m = String(line || '').match(/^\s*\[Attachment\]:\s*(.+?)\s*$/i);
            if (!m) { out.push(line); return; }
            const name = normalizeAttachmentName(m[1] || '');
            if (!name) return;
            const key = name.toLowerCase();
            if (seenAttachments.has(key)) return;
            seenAttachments.add(key);
            out.push(`[Attachment]: ${name}`);
          });
          return out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
        };
        for (let idx = 0; idx < rows.length; idx++) {
          ensureNotCanceled();
          const row = rows[idx];
          const removeIcons = getRemoveIcons();
          const icon = removeIcons ? '' : (row.role === 'assistant' ? '\uD83E\uDD16 ' : '\uD83D\uDC64 ');
          const label = `${getRoleLabelForRow(row)}:`.replace(/:+$/, ':');
          lines.push(`${icon}${label}`);
          const htmlForBlocks = normalizeHtmlForProvider(row.html || '', row, 'txt');
          const blocks = parseHtmlBlocks(htmlForBlocks) || [];
          const seenAttachments = new Set();
          const seenLinks = new Set();
          try {
            collectAttachmentNamesFromBlocks(blocks).forEach((a) => {
              const k = normalizeAttachmentName(a).toLowerCase();
              if (k) seenAttachments.add(k);
            });
          } catch {}
          if (blocks.length) {
            blocks.forEach(b => {
              if (!b) return;
              if (b.type === 'table' && Array.isArray(b.body) && b.body.length) {
                const mdTable = renderMarkdownTableFromBody(b.body);
                if (mdTable) lines.push(stripMathDollarWrappersForTxt(mdTable));
              } else if (b.type === 'runs' && Array.isArray(b.runs) && b.runs.length) {
                // Preserve link targets in plain TXT (e.g. Claude attachment download links).
                const t = buildPlainTextFromBlocks([b]);
                if (t) {
                  const deduped = dedupeAttachmentLinesInText(t, seenAttachments) || t;
                  lines.push(stripMathDollarWrappersForTxt(deduped));
                }
              } else if (b.type === 'text' && b.text && b.text.trim()) {
                const cleaned = dedupeAttachmentLinesInText(b.text, seenAttachments);
                lines.push(stripMathDollarWrappersForTxt(cleaned || b.text));
              } else if (b.type === 'code' && b.text && b.text.trim()) {
                lines.push(b.text);
              } else if (b.type === 'math' && b.tex) {
                lines.push(stripMathDollarWrappersForTxt(String(b.tex).trim()));
              }
            });
          } else {
            const messageText = getRowText(row);
            if (messageText) lines.push(stripMathDollarWrappersForTxt(messageText));
          }
          const blockImages = collectImageUrlsFromBlocks(blocks);
          const seenMedia = new Set();
          if (Array.isArray(row?.imgs)) {
            row.imgs.forEach((img, imageIndex) => {
              const { imageUrl, attachment } = mediaItemToPlainTokens(img, removeIcons);
              if (imageUrl) {
                const key = String(imageUrl || '').split('#')[0];
                if (key) seenMedia.add(key);
                lines.push(`[Image]: ${imageUrl}`);
              }
              else if (attachment) {
                const key = normalizeAttachmentName(attachment || '').toLowerCase();
                if (key && seenAttachments.has(key)) return;
                if (key) seenAttachments.add(key);
                lines.push(String(attachment || '').trim());
              }
            });
          }
          if (blockImages.length) {
            blockImages.forEach((u) => {
              const key = String(u || '').split('#')[0];
              if (!key || seenMedia.has(key)) return;
              seenMedia.add(key);
              lines.push(`[Image]: ${u}`);
            });
          }
          if (idx < rows.length - 1) lines.push('');
        }
        if (!getRemoveBranding() && rows.length) {
          lines.push('');
          lines.push('Powered by: AIChatExporterPro (https://chatexport.workpent.com/)');
        }
        blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
      } else if (want === 'csv') {
        const rowsOut = [];
        rowsOut.push(['title','name','email','exported_at','role','text','images'].join(','));
        const removeIcons = !!getRemoveIcons();
        const q = (s)=> '"'+String(s||'').replace(/"/g,'""')+'"';
        for (let idx = 0; idx < rows.length; idx++) {
          ensureNotCanceled();
          const row = rows[idx];
          let messageText = '';
          const htmlForBlocks = normalizeHtmlForProvider(row.html || '', row, 'csv');
          const blocks = parseHtmlBlocks(htmlForBlocks) || [];
          if (blocks.length) messageText = buildPlainTextFromBlocks(blocks);
          else messageText = getRowText(row);
          messageText = String(messageText || '').replace(/\r?\n/g,'\\n');
          const mediaTokens = [];
          const seenMedia = new Set();
          if (Array.isArray(row?.imgs)) {
            row.imgs.forEach((img) => {
              const { imageUrl, attachment } = mediaItemToPlainTokens(img, removeIcons);
              if (imageUrl) {
                const key = String(imageUrl || '').split('#')[0];
                if (!key || seenMedia.has(key)) return;
                seenMedia.add(key);
                mediaTokens.push(imageUrl);
              } else if (attachment) {
                const key = `att:${String(attachment || '').toLowerCase()}`;
                if (seenMedia.has(key)) return;
                seenMedia.add(key);
                mediaTokens.push(`attachment:${attachment}`);
              }
            });
          }
          collectImageUrlsFromBlocks(blocks).forEach((u) => {
            const key = String(u || '').split('#')[0];
            if (!key || seenMedia.has(key)) return;
            seenMedia.add(key);
            mediaTokens.push(u);
          });
          const imageLinks = mediaTokens.join(';');
          const isFirst = idx === 0;
          rowsOut.push([
            isFirst ? q(headerFilename) : '""',
            isFirst ? q(adv.userName || '') : '""',
            isFirst ? q(adv.userEmail || '') : '""',
            isFirst ? q(adv.includeDateTime ? new Date().toLocaleString() : '') : '""',
            q(row.role),
            q(messageText),
            q(imageLinks)
          ].join(','));
        }
        if (!getRemoveBranding() && rows.length) {
          rowsOut.push(',,,,,"Powered by: AIChatExporterPro (https://chatexport.workpent.com/)",');
        }
        blob = new Blob(['\uFEFFsep=,\r\n' + rowsOut.join('\r\n')], { type: 'text/csv;charset=utf-8' });
      } else if (want === 'json') {
        const removeIcons = !!getRemoveIcons();
        const out = {
          title: headerFilename,
          exportedAt: adv.includeDateTime ? new Date().toISOString() : '',
          ...(getRemoveBranding() ? {} : { branding: 'https://chatexport.workpent.com/' }),
          messages: [],
        };
        if (adv.userName) out.name = adv.userName;
        if (adv.userEmail) out.email = adv.userEmail;
        for (let idx = 0; idx < rows.length; idx++) {
          ensureNotCanceled();
          const row = rows[idx];
          let text = "";
          const htmlForBlocks = normalizeHtmlForProvider(row.html || "", row, 'json');
          const blocks = parseHtmlBlocks(htmlForBlocks) || [];
          if (blocks.length) {
            text = buildPlainTextFromBlocks(blocks);
          } else {
            text = getRowText(row);
          }
          const images = [];
          const attachments = [];
          const seenMedia = new Set();
          if (Array.isArray(row?.imgs)) {
            row.imgs.forEach((img) => {
              const { imageUrl, attachment } = mediaItemToPlainTokens(img, removeIcons);
              if (imageUrl) {
                const key = String(imageUrl || '').split('#')[0];
                if (!key || seenMedia.has(key)) return;
                seenMedia.add(key);
                images.push(imageUrl);
              } else if (attachment) {
                const key = `att:${String(attachment || '').toLowerCase()}`;
                if (seenMedia.has(key)) return;
                seenMedia.add(key);
                attachments.push(attachment);
              }
            });
          }
          collectImageUrlsFromBlocks(blocks).forEach((u) => {
            const key = String(u || '').split('#')[0];
            if (!key || seenMedia.has(key)) return;
            seenMedia.add(key);
            images.push(u);
          });
          const msg = {
            turnIndex: idx,
            role: row.role,
            text,
            images,
            ...(attachments.length ? { attachments } : {}),
          };
          out.messages.push(msg);
        }
        blob = new Blob([JSON.stringify(out, null, 2)], { type: 'application/json' });
      } else if (want === 'md' || want === 'markdown') {
        const parts = [];
        parts.push(`# ${headerFilename}`);
        if (infoBlockPlain.length) {
          infoBlockPlain.forEach(line => parts.push(`\n${line}`));
        }
        const mdFromRuns = (runs = []) => {
          if (!Array.isArray(runs) || !runs.length) return '';
          // Minimal escaping: over-escaping breaks markdown list markers like `1.` and `-`.
          // Do NOT escape backslashes; Grok/KaTeX content relies on `\frac`, `\rho`, etc.
          // Escape only markdown control chars that commonly break formatting.
          // Do not escape `_` because it is frequently used in LaTeX (e.g., C_1).
          const esc = (s='') => String(s).replace(/([`*])/g, '\\\\$1'); 
          const headingLevel = runs.find(r => Number.isFinite(r?.headingLevel))?.headingLevel || 0;
          const segs = [];
          runs.forEach((r) => {
            if (!r || typeof r.text !== 'string' || !r.text) return;
            let t = r.code ? `\`${r.text}\`` : esc(r.text);
            if (r.link) t = `[${t}](${String(r.link)})`;
            if (r.italics) t = `_${t}_`;
            if (r.bold) t = `**${t}**`;
            segs.push(t);
          });
          const out = segs.join('').replace(/\u00a0/g,' ').replace(/[ \t]+\n/g,'\n').trim();
          if (headingLevel && headingLevel >= 1 && headingLevel <= 6) {
            return `${'#'.repeat(headingLevel)} ${out.replace(/^#+\s+/, '')}`.trim();
          }
          return out;
        };
        const normalizeAttachmentName = (s = '') =>
          String(s || '')
            .replace(/\u00a0/g, ' ')
            .replace(/[\u200B-\u200D\uFEFF]/g, '')
            .replace(/\s+/g, ' ')
            .trim();
        const collectAttachmentNamesFromBlocks = (blocks = []) => {
          const out = [];
          if (!Array.isArray(blocks) || !blocks.length) return out;
          const addLine = (line = '') => {
            const m = String(line || '').match(/^\s*\[Attachment\]:\s*(.+?)\s*$/i);
            if (!m) return;
            const name = normalizeAttachmentName(m[1] || '');
            if (name) out.push(name);
          };
          blocks.forEach((b) => {
            if (!b) return;
            if (b.type === 'text' && b.text) {
              String(b.text || '').replace(/\r\n/g, '\n').split('\n').forEach(addLine);
              return;
            }
            if (b.type === 'runs' && Array.isArray(b.runs)) {
              const txt = b.runs.map(r => (r && typeof r.text === 'string' ? r.text : '')).join('');
              String(txt || '').replace(/\r\n/g, '\n').split('\n').forEach(addLine);
            }
          });
          return out;
        };
        const dedupeAttachmentLinesInText = (text = '', seenAttachments = new Set()) => {
          const raw = String(text || '').replace(/\r\n/g, '\n');
          if (!raw) return '';
          const out = [];
          raw.split('\n').forEach((line) => {
            const m = String(line || '').match(/^\s*\[Attachment\]:\s*(.+?)\s*$/i);
            if (!m) { out.push(line); return; }
            const name = normalizeAttachmentName(m[1] || '');
            if (!name) return;
            const key = name.toLowerCase();
            if (seenAttachments.has(key)) return;
            seenAttachments.add(key);
            out.push(`[Attachment]: ${name}`);
          });
          return out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
        };
        const mdFenceBlock = (lang = '', body = '') => {
          const text = String(body || '').trim();
          if (!text) return '';
          const fence = String.fromCharCode(96, 96, 96);
          const safeText = text;
          return fence + String(lang || '').trim() + String.fromCharCode(10) + safeText + String.fromCharCode(10) + fence;
        };
        const decodeSvgFromMarkdownImageBlock = (b = {}) => {
          try {
            const explicit = String(b?.svgText || '').trim();
            if (explicit) return explicit;
            const src = String(b?.src || '').trim();
            if (/^data:image\/svg\+xml;(?:utf8|charset=utf-8),/i.test(src)) {
              return decodeURIComponent(src.replace(/^data:image\/svg\+xml;(?:utf8|charset=utf-8),/i, '')).trim();
            }
            if (/^data:image\/svg\+xml;base64,/i.test(src)) {
              return atob(src.split(',')[1] || '').trim();
            }
          } catch {}
          return '';
        };
        const collectMarkdownVisualFallbacks = (html = '') => {
          const out = [];
          try {
            if (!/#vis-container|acep-visual-wrap/i.test(String(html || ''))) return out;
            const doc = new DOMParser().parseFromString(String(html || ''), 'text/html');
            const seen = new Set();
            Array.from(doc.querySelectorAll('#vis-container, .acep-visual-wrap')).forEach((node) => {
              try {
                if (node.querySelector?.('[data-acep-svg], .acep-inline-svg-img')) return;
                const source = String(node.outerHTML || '').trim();
                if (!source) return;
                const key = source.replace(/\s+/g, ' ').slice(0, 800);
                if (seen.has(key)) return;
                seen.add(key);
                const fenced = mdFenceBlock('html', source.slice(0, 20000));
                if (fenced) out.push(fenced);
              } catch {}
            });
          } catch {}
          return out;
        };
        for (let idx = 0; idx < rows.length; idx++) {
          ensureNotCanceled();
          const row = rows[idx];
          parts.push(`\n**${getRoleLabelForRow(row)}:**`);
          const htmlForBlocks = normalizeHtmlForProvider(row.html || '', row, 'md');
          const blocks = parseHtmlBlocks(htmlForBlocks) || [];
          const seenAttachments = new Set();
          const seenLinks = new Set();
          try {
            collectAttachmentNamesFromBlocks(blocks).forEach((a) => {
              const k = normalizeAttachmentName(a).toLowerCase();
              if (k) seenAttachments.add(k);
            });
          } catch {}
          if (blocks.length) {
            blocks.forEach(b => {
              if (!b) return;
              if (b.type === 'table' && Array.isArray(b.body) && b.body.length) {
                const md = renderMarkdownTableFromBody(b.body);
                if (md) parts.push('\n' + md);
              } else if (b.type === 'runs' && Array.isArray(b.runs) && b.runs.length) {
                const t = mdFromRuns(b.runs);
                if (t) parts.push('\n' + (dedupeAttachmentLinesInText(t, seenAttachments) || t));
              } else if (b.type === 'text' && b.text && b.text.trim()) {
                const cleaned = dedupeAttachmentLinesInText(b.text, seenAttachments);
                parts.push('\n' + (cleaned || b.text));
              } else if (b.type === 'code' && b.text && b.text.trim()) {
                const fence = b.lang && b.lang.trim() ? b.lang.trim() : '';
                parts.push(`\n\`\`\`${fence}\n${b.text}\n\`\`\``);
              } else if (b.type === 'image' && b.src) {
                const svgText = decodeSvgFromMarkdownImageBlock(b);
                if (svgText) {
                  const mdSvg = mdFenceBlock('svg', svgText);
                  if (mdSvg) parts.push(String.fromCharCode(10) + mdSvg);
                } else {
                  const src = String(b.src || '').trim();
                  const alt = String(b.alt || 'Image').replace(/[\]\n\r]/g, ' ').trim() || 'Image';
                  if (src && !/^data:|^blob:/i.test(src) && isLikelyImageUrlForLink(src) && !isBannedExportImageUrl(src)) {
                    const key = String(src).split('#')[0];
                    if (key && !seenLinks.has(key)) {
                      seenLinks.add(key);
                      parts.push(String.fromCharCode(10) + '![' + alt + '](' + src + ')');
                    }
                  } else if (alt && !/^image$/i.test(alt)) {
                    parts.push(String.fromCharCode(10) + '[Image]: ' + alt);
                  }
                }
              } else if (b.type === 'math' && b.tex) { 
                // Display math -> $$...$$ block; inline math -> $...$
                const texRaw = String(b.tex || '').trim();
                const tex = texRaw
                  // Strip common wrappers if already present to avoid `$$$$...$$$$`
                  .replace(/^\$\$\s*/,'')
                  .replace(/\s*\$\$$/,'')
                  .replace(/^\$\s*/,'')
                  .replace(/\s*\$$/,'')
                  .replace(/^\\\[\s*/,'')
                  .replace(/\s*\\\]$/,'')
                  .replace(/^\\\(\s*/,'')
                  .replace(/\s*\\\)$/,'')
                  .trim();
                if (!tex) return;
                parts.push(b.display ? `\n$$\n${tex}\n$$` : ` $${tex}$`); 
              } 
            }); 
            collectMarkdownVisualFallbacks(htmlForBlocks).forEach((fallback) => {
              if (fallback) parts.push(String.fromCharCode(10) + fallback);
            });
          } else { 
            const text = getRowText(row);
            if (text) parts.push('\n'+text);
          }
          const blockImages = collectImageUrlsFromBlocks(blocks);
          if (Array.isArray(row?.imgs)) {
            row.imgs.forEach((img) => {
              const rawLink = img.originalSrc || img.src || '';
              // Skip data URIs and blob URLs entirely.
              if (/^data:/i.test(rawLink) || /^blob:/i.test(rawLink)) {
                if (img?.alt) {
                  const name = normalizeAttachmentName(String(img.alt || ''));
                  if (!name) return;
                  const key = name.toLowerCase();
                  if (seenAttachments.has(key)) return;
                  seenAttachments.add(key);
                  parts.push(`\n${name}`);
                }
                return;
              }
              const link = rawLink;
              if (link) {
                const key = String(link).split('#')[0];
                if (!key || seenLinks.has(key)) return;
                seenLinks.add(key);
                parts.push(`\n![Image](${link})`);
              } else if (img?.alt) {
                const name = normalizeAttachmentName(String(img.alt || ''));
                if (!name) return;
                const key = name.toLowerCase();
                if (seenAttachments.has(key)) return;
                seenAttachments.add(key);
                parts.push(`\n${name}`);
              }
            });
          }
          if (blockImages.length) {
            blockImages.forEach((u) => {
              const key = String(u || '').split('#')[0];
              if (!key || seenLinks.has(key)) return;
              seenLinks.add(key);
              parts.push(`\n![Image](${u})`);
            });
          }
        }
        if (!getRemoveBranding() && rows.length) {
          parts.push('\n\n---\n');
          parts.push('Powered by: [AIChatExporterPro](https://chatexport.workpent.com/)');
        }
        blob = new Blob([parts.join('\n')], { type: 'text/markdown;charset=utf-8' });
      } else if (want === 'html_self') {
        // Convert attachment markers (invisible empty divs) to visible text labels.
        if (/data-acep-attachment-name=/i.test(htmlProcessed)) {
          htmlProcessed = htmlProcessed.replace(
            /<div\b[^>]*\bdata-acep-attachment-name\s*=\s*(["'])(.*?)\1[^>]*>\s*<\/div>/gi,
            (_m, _q, name) => `<p class="acep-attachment-label">[Attachment]: ${String(name || '').trim().replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</p>`
          );
        }
        blob = new Blob([htmlProcessed], { type: 'text/html;charset=utf-8' });
      } else if (want === 'html_linked') {
        const parser = new DOMParser();
        const docLinked = parser.parseFromString(htmlProcessed, 'text/html');
        if (docLinked) {
          const replaceProtectedImagesWithLinks = (doc) => {
            try {
              const seen = new Set();
              const normalize = (u = '') => {
                const s = String(u || '').trim();
                if (!s) return '';
                const hash = s.indexOf('#');
                return (hash >= 0 ? s.slice(0, hash) : s).trim();
              };
              const activeOrigin = (() => { try { return new URL(tab?.url || '').origin; } catch { return ''; } })();
              const tabProviderKey = getProviderKeyFromUrl(tab?.url || '');
              const toAbsoluteIfKnown = (u = '') => {
                const s = String(u || '').trim();
                if (!s) return '';
                if (/^https?:\/\//i.test(s) || /^data:/i.test(s) || /^blob:/i.test(s)) return s;
                // Some providers emit relative asset URLs (e.g., `/api/...`). Make them absolute using the active tab origin.
                if (activeOrigin && s.startsWith('/')) return `${activeOrigin}${s}`;
                return s;
              };
              const isProtected = (u = '') => {
                try {
                  const providerKey = getProviderKeyFromUrl(u);
                  const p = globalThis.ACEP && globalThis.ACEP.providers && globalThis.ACEP.providers[providerKey];
                  if (p && typeof p.isProtectedAsset === 'function') {
                    if (p.isProtectedAsset(u)) return true;
                  }
                  // Image URL may not share the same domain as the provider (e.g. Grok CDN, ChatGPT file storage).
                  // Fall back to the tab's provider to check if the image is protected.
                  if (tabProviderKey && tabProviderKey !== providerKey) {
                    const tabP = globalThis.ACEP && globalThis.ACEP.providers && globalThis.ACEP.providers[tabProviderKey];
                    if (tabP && typeof tabP.isProtectedAsset === 'function' && tabP.isProtectedAsset(u)) return true;
                  }
                  // Grok CDN images for generated content may not match any domain pattern but can still
                  // Signed/provider URLs can require auth or expire.
                  if (tabProviderKey === 'grok' && /^https?:\/\//i.test(String(u || ''))) return true;
                  // ChatGPT backend-api images (estuary content, file downloads, etc.) always require auth.
                  if (tabProviderKey === 'chatgpt' && /chatgpt\.com\/backend-api\//i.test(String(u || ''))) return true;
                } catch {}
                return false;
              };
              const imgs = Array.from(doc.querySelectorAll('img:not(.role-icon)'));
              imgs.forEach((imgEl) => {
                try {
                  const original = imgEl.getAttribute('data-original-src') || imgEl.getAttribute('src') || '';
                  const url = normalize(toAbsoluteIfKnown(original));
                  if (!url || !isProtected(url)) return;
                  const key = url;
                  if (seen.has(key)) {
                    imgEl.remove();
                    return;
                  }
                  seen.add(key);
                  const altRaw = (imgEl.getAttribute('alt') || '').trim();
                  const label = altRaw && altRaw !== '[Image]' ? altRaw : 'Image';
                  const p = doc.createElement('p');
                  p.className = 'acep-image-link';
                  const a = doc.createElement('a');
                  a.href = url;
                  a.target = '_blank';
                  a.rel = 'noreferrer noopener';
                  a.textContent = `[Image]: ${label}`;
                  p.appendChild(a);
                  imgEl.replaceWith(p);
                } catch {}
              });
            } catch {}
          };
          // Keep role icons intact; only reset content images to their original links
          docLinked.querySelectorAll('img:not(.role-icon)').forEach((imgEl) => {
            const original = imgEl.getAttribute('data-original-src') || '';
            if (original && !/^data:/i.test(original) && !/^blob:/i.test(original)) {
              imgEl.setAttribute('src', original);
            }
            imgEl.removeAttribute('data-original-src');
          });
          // For protected hosts (notably Grok assets), avoid embedding <img> tags at all in linked exports.
          // This prevents offline 403 spam and matches the "linked = click to view" expectation.
          replaceProtectedImagesWithLinks(docLinked);
          // Convert attachment markers (invisible empty divs) to visible text labels in HTML exports.
          docLinked.querySelectorAll('[data-acep-attachment-name]').forEach((el) => {
            try {
              const name = (el.getAttribute('data-acep-attachment-name') || '').trim();
              if (!name) { el.remove(); return; }
              const url = (el.getAttribute('data-acep-attachment-url') || '').trim();
              const p = docLinked.createElement('p');
              p.className = 'acep-attachment-label';
              if (url) {
                const a = docLinked.createElement('a');
                a.href = url;
                a.target = '_blank';
                a.rel = 'noreferrer noopener';
                a.textContent = `[Attachment]: ${name}`;
                p.appendChild(a);
              } else {
                p.textContent = `[Attachment]: ${name}`;
              }
              el.replaceWith(p);
            } catch {}
          });
          docLinked.querySelectorAll('.branding').forEach((el) => el.remove());
          if (!getRemoveBranding()) {
            const brandingDiv = docLinked.createElement('div');
            brandingDiv.className = 'branding';
            brandingDiv.style.cssText = 'margin-top:24px;font-size:12px;color:#888;';
            brandingDiv.appendChild(docLinked.createTextNode((__t('action_powered_by') || 'Powered by') + ': '));
            const link = docLinked.createElement('a');
            link.href = 'https://chatexport.workpent.com/';
            link.textContent = 'AIChatExporterPro';
            link.style.color = '#888';
            link.style.textDecoration = 'none';
            brandingDiv.appendChild(link);
            docLinked.body.appendChild(brandingDiv);
          }
          const serialized = '<!doctype html>\n' + docLinked.documentElement.outerHTML;
          blob = new Blob([serialized], { type: 'text/html;charset=utf-8' });
        } else {
          blob = new Blob([htmlProcessed], { type: 'text/html;charset=utf-8' });
        }
      } else {
        throw new Error('Format not implemented');
      }
      // If filename is still auto-filled, refresh it with the latest detected title
      try {
        const autoDefault = withExt(headerFilename, want);
        const isAuto = fileNameEl?.dataset?.autofill !== '0';
        if (isAuto || !fileNameEl.value) {
          fileNameEl.value = autoDefault;
        }
      } catch {}
      name = withExt(fileNameEl.value || headerFilename, want);
      if (!multiPageImages && !serverDownloadUrl) {
        if (!(blob instanceof Blob)) {
          if (blob && blob.blob instanceof Blob) blob = blob.blob;
          else throw new Error('Export failed: no file generated');
        }
      }
      ensureNotCanceled();

      let url = serverDownloadUrl || null;
      if (!url && blob) {
        url = URL.createObjectURL(blob);
      }
      sendMutedProgress(__t('progress_finishing') || 'Finishing export...');
      try {
        void sendExportAnalytics({ ...(analyticsContext || {}), status: 'success', durationMs: Date.now() - analyticsStartedAt, bytes: (blob instanceof Blob) ? blob.size : 0 });
      } catch {}
      if (muted) {
        try { parent.postMessage({ type:'ACEP_IFRAME_MUTE', mute:false }, '*'); } catch {}
        if (tab?.id) { sendToTab(tab.id, { type:'ACEP_IFRAME_MUTE', mute:false }).catch(()=>{}); }
      }

      try { await saveExportPrefs(want, adv); } catch {}

      setBusyFlag(false);
      if (!ACEP.autoExport) {
        if (successOverlay) successOverlay.style.display = 'flex';
        SHOULD_PROMPT_AFTER_SUCCESS = true;
        void (async () => {
          try {
            const shouldPrompt = await bumpAndMaybePromptAfterExport();
            if (!shouldPrompt) return;
            const tid = CURRENT_TAB_ID || (await queryActiveTab())?.id;
            if (tid) sendToTab(tid, { type: 'ACEP_PROMPT_SCHEDULE', delayMs: 30000 }).catch(() => {});
          } catch {}
        })();
      }

      if (multiPageImages) {
        const baseName = name.replace(/\.png$/i, '') || 'AI Conversation';
        readyNameEl.textContent = `${baseName}-part-*.png`;
        downloadBtn.textContent = __t('btn_download_all') || 'Download All';
        const pages = multiPageImages.map((pngBlob, idx) => ({
          blob: pngBlob,
          name: `${baseName}-part-${String(idx + 1).padStart(3,'0')}.png`,
        }));
        const triggerDownload = () => {
          pages.forEach((item, idx) => {
            const pageUrl = URL.createObjectURL(item.blob);
            setTimeout(() => {
              downloadBlobUrl(pageUrl, item.name);
              setTimeout(() => URL.revokeObjectURL(pageUrl), 5000);
            }, idx * 400);
          });
        };
        downloadBtn.onclick = triggerDownload;
        LAST_EXPORT = { blob: null, name: `${baseName}-part-*.png`, multi: { pages, trigger: triggerDownload }, serverUrl: "" };
        SHARE_URL = "";
        if (makeLinkBtn) {
          makeLinkBtn.style.display = "";
          makeLinkBtn.disabled = true;
          makeLinkBtn.innerHTML = `<i class="fas fa-link"></i><span>${__t('btn_generate_link')}</span>`;
        }
        multiPageImages = null;
      } else {
        readyNameEl.textContent = name;
        downloadBtn.textContent = __t('btn_download_ready') || __t('btn_download_now') || 'Download';
        downloadBtn.onclick = () => downloadBlobUrl(url, name);

        LAST_EXPORT = { blob, name, multi: null, serverUrl: serverDownloadUrl || "" };
        SHARE_URL = "";
        if (makeLinkBtn) {
          makeLinkBtn.style.display = "";
          makeLinkBtn.disabled = !(blob instanceof Blob);
          makeLinkBtn.innerHTML = `<i class="fas fa-link"></i><span>${__t('btn_generate_link')}</span>`;
        }
      }

      if (shareLinkRow) shareLinkRow.style.display = "none";
      if (shareLinkA) { shareLinkA.textContent = ""; shareLinkA.href = "#"; }
      // Notify in-page result panel when running in auto-export mode (both channels)
      if (ACEP.autoExport) {
        if (getMuteDownload() && url) {
          // Mute download UX: auto-download, skip the result/share page, but still show the post-success modal.
          try { downloadBlobUrl(url, name); } catch {}
          try { parent.postMessage({ type: 'ACEP_OPEN_SUPPORT_MODAL' }, '*'); } catch {}
          try { if (tab?.id) sendToTab(tab.id, { type: 'ACEP_OPEN_SUPPORT_MODAL' }).catch(()=>{}); } catch {}
        } else {
          const readyMessage = { type: 'ACEP_EXPORT_READY', fileName: name, format: analyticsFormatFromWant(want) };
          if (url) readyMessage.fileUrl = url;
          try { parent.postMessage(readyMessage, '*'); } catch {}
          try { if (tab?.id) sendToTab(tab.id, readyMessage).catch(()=>{}); } catch {}
        }
        // The result panel delegates Download/Share back to this frame, so keep it alive.
        // Mute-download already completed its automatic download and can close immediately.
        if (getMuteDownload()) {
          try { parent.postMessage('ACEP_POPUP_CLOSE', '*'); } catch {}
          try { if (tab?.id) sendToTab(tab.id, { type: 'ACEP_POPUP_CLOSE' }).catch(()=>{}); } catch {}
        }
      }


    } catch(e) {
      // Send immediately before any await so the loading overlay always clears
      try { parent.postMessage({ type:'ACEP_SET_BUSY', busy:false }, '*'); } catch {}
      try { parent.postMessage({ type:'ACEP_IFRAME_MUTE', mute:false }, '*'); } catch {}
      try { parent.postMessage({ type:'ACEP_MUTED_EXPORT_PROGRESS', done:true }, '*'); } catch {}
      try {
        const tab = await queryActiveTab();
        if (tab?.id) { sendToTab(tab.id, { type:'ACEP_IFRAME_MUTE', mute:false }).catch(()=>{}); }
        if (tab?.id) { sendToTab(tab.id, { type:'ACEP_SET_BUSY', busy:false }).catch(()=>{}); }
        if (tab?.id) { sendToTab(tab.id, { type:'ACEP_MUTED_EXPORT_PROGRESS', done:true }).catch(()=>{}); }
      } catch {}
      try {
        void sendExportAnalytics({ ...(analyticsContext || {}), status: 'failed', error: e, durationMs: Date.now() - analyticsStartedAt, bytes: (blob instanceof Blob) ? blob.size : 0 });
      } catch {}
      const msg = String(e?.message || e);
      const isAbort = msg.startsWith('Export canceled') || (msg === 'Aborted') || (e && e.name === 'AbortError');
      const isNetworkError = msg.includes('ACEP_NETWORK_ERROR');
      if (isNetworkError) {
        // Restore settings overlay so the error message inside it is visible
        if (settingsOverlay) settingsOverlay.style.display = 'flex';
        if (networkErrorEl) { networkErrorEl.style.display = 'block'; }
        console.error(e);
      } else if (!isAbort) {
        const prefix = (typeof __t === 'function' ? __t('notice_failed_prefix') : null)
          || (chrome?.i18n?.getMessage ? browser.i18n.getMessage('notice_failed_prefix') : null)
          || 'Export failed: ';
        alert(prefix + (e?.message || e));
        console.error(e);
      }
    } finally {
      try { stopProgress(); } catch {}
      ACEP.abort = null;
      ACEP.exporting = false;
      setLocked(false);
      setBusy(false);
      // Notify via both channels: parent.postMessage (hidden iframe) + sendToTab (runtime)
      try { sendMutedProgress('', true); } catch {}
      try { parent.postMessage({ type: 'ACEP_SET_BUSY', busy: false }, '*'); } catch {}
      try { setBusyFlag(false); } catch {}
      try { const plan = await getPlanFromStorage(); if (plan==='free' && blob instanceof Blob) await bumpUsage(); } catch {}
    }
  });
  ACEP.exportBtnReady = true;
  if (ACEP.pendingAutoExport && !ACEP.exporting) {
    ACEP.pendingAutoExport = false;
    try { await _prefsReady; } catch {}
    try { if (settingsOverlay) settingsOverlay.style.display = 'none'; } catch {}
    try { exportBtn.click(); } catch {}
  }
  // Storage-based fallback: read pending export written by content.js before iframe was created
  (async () => {
    try {
      const _ps = await getStorageArea();
      const _sessionId = (() => { try { return new URL(location.href).searchParams.get('exportSessionId') || ''; } catch { return ''; } })();
      const _pendingKey = _sessionId ? ('acep_pending_export_' + _sessionId) : 'acep_pending_export';
      const _pendingRead = await _ps.get({ [_pendingKey]: null, acep_pending_export: null });
      const pex = _pendingRead[_pendingKey] || _pendingRead.acep_pending_export;
      if (pex && pex.autoExport && !ACEP.exporting && (Date.now() - (pex.ts || 0)) < 120000) {
        await _ps.set({ [_pendingKey]: null, acep_pending_export: null });
        SELECTED_TURN_IDS = Array.isArray(pex.selectedTurnIds) ? pex.selectedTurnIds : null;
        SELECTED_FILTER = typeof pex.selectionFilter === 'string' ? pex.selectionFilter : '';
        if (pex.preferredFormat && fileTypeEl) {
          fileTypeEl.value = pex.preferredFormat;
          try { fileTypeEl.dispatchEvent(new Event('change', { bubbles: true })); } catch {}
        }
        if (pex.fileNameBase && fileNameEl && fileTypeEl) {
          try {
            const base = stripExt(String(pex.fileNameBase || '').trim());
            if (base) {
              fileNameEl.value = withExt(base, fileTypeEl.value);
              try { fileNameEl.dataset.autofill = '0'; } catch {}
              if (titleInput) {
                titleInput.value = base;
                try { titleInput.dataset.autofill = '0'; } catch {}
              }
            }
          } catch {}
        }
        try { await _prefsReady; } catch {}
        if (typeof pex.mute === 'boolean' && muteEl) muteEl.checked = pex.mute;
        if (typeof pex.muteDownload === 'boolean' && muteDownloadEl) muteDownloadEl.checked = pex.muteDownload;
        if (settingsOverlay) settingsOverlay.style.display = 'none';
        ACEP.autoExport = true;
        try { if (_sessionId) ACEP.consumedAutoExportSessions.add(_sessionId); } catch {}
        try { exportBtn.click(); } catch {}
      }
    } catch {}
  })();

  // ====== Share/Upload wiring ======
  // No-op: legacy check removed. We now use pre-signed upload flow via API.
  async function ensureUploadConfig() { return true; }

  async function generateShareLink() {
    if (UPLOADING) return;
    if (!LAST_EXPORT || !(LAST_EXPORT.blob instanceof Blob)) {
      alert(__t('notice_no_file_to_share') || 'No exported file to share. Please export first.');
      return;
    }
    // Ensure share metadata reflects the latest export before building messages/links
    const freshFormat = LAST_FORMAT || fileTypeEl?.value || 'pdf_text';
    const freshProvider = LAST_PROVIDER_LABEL || getProviderLabelFromUrl((await queryActiveTab())?.url || '');
    LAST_SHARE_META = { provider: freshProvider, format: freshFormat, browser: detectBrowserLabel() };
    updateShareLinks();
    // Quotas: 100MB per file; 3/day; 7/week (client-side UX only)
    const MAX_BYTES = 100 * 1024 * 1024;
    if ((LAST_EXPORT.blob.size || 0) > MAX_BYTES) {
      alert('Maximum file size is 100 MB for link generation.');
      return;
    }
    const todayKey = (()=>{ const d=new Date(); return `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}-${String(d.getUTCDate()).padStart(2,'0')}`; })();
    const weekKey = (function(){
      const d=new Date(); const date=new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
      const dayNum = date.getUTCDay() || 7; if (dayNum!==1) date.setUTCDate(date.getUTCDate() - dayNum + 1);
      const yearStart = new Date(Date.UTC(date.getUTCFullYear(),0,1));
      const weekNo = Math.ceil((((date - yearStart)/86400000)+1)/7);
      return `${date.getUTCFullYear()}-W${String(weekNo).padStart(2,'0')}`;
    })();
    const storage = await getStorageArea();
    const usageDefaults = { upDayKey:'', upDayCount:0, upWeekKey:'', upWeekCount:0 };
    const u = await storage.get(usageDefaults);
    const dayCount = (u.upDayKey===todayKey? u.upDayCount:0);
    const weekCount = (u.upWeekKey===weekKey? u.upWeekCount:0);
    if (dayCount >= 3) {
      const msg = __t('daily_limit_msg') || "You've reached your daily limit.\n\nYou've generated 3 links today. Each link is limited to 100 MB.";
      alert(msg);
      return;
    }
    if (weekCount >= 7) {
      const msg = __t('weekly_limit_msg') || "You've reached your weekly limit (7 links per week). Each link is limited to 100 MB.";
      alert(msg);
      return;
    }
    // Reserve a slot immediately so limits apply even if the upload later fails
    try {
      await storage.set({
        upDayKey: todayKey,
        upDayCount: dayCount + 1,
        upWeekKey: weekKey,
        upWeekCount: weekCount + 1,
      });
    } catch {}
    try {
      UPLOADING = true;
      if (makeLinkBtn) {
        makeLinkBtn.disabled = true;
        makeLinkBtn.innerHTML = `<i class="fas fa-spinner fa-spin"></i><span>${__t('btn_generating_link') || 'Generating link...'}</span>`;
      }

      // API-only anonymous presigned upload flow
      let link = '';
      const name = LAST_EXPORT.name || 'export.bin';
      const contentType = LAST_EXPORT.blob.type || 'application/octet-stream';
      const sizeBytes = LAST_EXPORT.blob.size || 0;
      // 1) init
      const initBody = JSON.stringify({ filename: name, content_type: contentType, estimated_size: sizeBytes });
      const initAuth = await signedHeadersForApi('POST', '/v1/upload/init', initBody);
      const initResp = await fetch(`${API_BASE}/v1/upload/init`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', ...initAuth },
        body: initBody,
        referrerPolicy: 'no-referrer'
      });
      const initJson = await initResp.json().catch(()=>({}));
      if (!initResp.ok) throw new Error(initJson?.detail || initJson?.code || `Init failed (${initResp.status})`);
      const uploadUrl = initJson.upload_url;
      const uploadId = initJson.upload_id;
      const extraHeaders = initJson.headers || {};
      if (!uploadUrl || !uploadId) throw new Error('Bad init response');
      // 2) PUT
      const putHeaders = new Headers();
      if (contentType) putHeaders.set('Content-Type', contentType);
      try { Object.entries(extraHeaders).forEach(([k,v]) => { if (v!=null) putHeaders.set(k, String(v)); }); } catch {}
      const putAuth = await signedHeadersForApi('PUT', uploadUrl, LAST_EXPORT.blob);
      Object.entries(putAuth).forEach(([key, value]) => putHeaders.set(key, String(value)));
      const putResp = await fetch(uploadUrl, { method: 'PUT', headers: putHeaders, body: LAST_EXPORT.blob, mode:'cors', referrerPolicy: 'no-referrer' });
      if (!putResp.ok) {
        const txt = await putResp.text().catch(()=>String(putResp.status));
        throw new Error(`Upload failed (${putResp.status}): ${txt.slice(0,200)}`);
      }
      // 3) complete
      const completeBody = JSON.stringify({ upload_id: uploadId });
      const completeAuth = await signedHeadersForApi('POST', '/v1/upload/complete', completeBody);
      const compResp = await fetch(`${API_BASE}/v1/upload/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', ...completeAuth },
        body: completeBody,
        referrerPolicy: 'no-referrer'
      });
      const compJson = await compResp.json().catch(()=>({}));
      if (!compResp.ok || !compJson?.url) throw new Error(compJson?.detail || `Complete failed (${compResp.status})`);
      link = compJson.url;
      SHARE_URL = link;
      if (shareLinkA) { shareLinkA.textContent = SHARE_URL; shareLinkA.href = SHARE_URL; }
      if (shareLinkRow) shareLinkRow.style.display = '';
      if (ACEP.autoExport) {
        try { parent.postMessage({ type: 'ACEP_SHARE_URL_READY', url: link }, '*'); } catch {}
      }

      // Prompt after link generation: always schedule 30s fallback and show on overlay close
      try { const tid = CURRENT_TAB_ID || (await queryActiveTab())?.id; if (tid) await sendToTab(tid, { type: 'ACEP_PROMPT_SCHEDULE', delayMs: 30000 }); } catch {}
      try { successOverlay?.addEventListener('click', async (e) => { const m = successOverlay.querySelector('.modal'); if (m && !m.contains(e.target)) { try { const tid = CURRENT_TAB_ID || (await queryActiveTab())?.id; if (tid){ await sendToTab(tid, { type: 'ACEP_PROMPT_CANCEL' }); await sendToTab(tid, { type: 'ACEP_OPEN_SUPPORT_MODAL' }); } } catch {} } }, { once:true }); }catch{}
      try { closeBtn?.addEventListener('click', async () => { try { const tid = CURRENT_TAB_ID || (await queryActiveTab())?.id; if (tid){ await sendToTab(tid, { type: 'ACEP_PROMPT_CANCEL' }); await sendToTab(tid, { type: 'ACEP_OPEN_SUPPORT_MODAL' }); } } catch {} }, { once:true }); }catch{}

      // Removed daily askConfirm fallback to always use embedded modal
      // Refresh share buttons now that a new link/export exists
      try { await loadLastShareMeta(); } catch {}
    } catch (err) {
      const msg = String(err?.message || err);
      // Friendly messages for server-enforced limits
      if (/DAILY_LIMIT/i.test(msg) || /429/.test(msg)) {
        const m = __t('daily_limit_msg') || "You've reached your daily limit.\n\nYou've generated 3 links today. Each link is limited to 100 MB.";
        alert(m); return;
      }
      if (/WEEKLY_LIMIT/i.test(msg)) {
        const m = __t('weekly_limit_msg') || "You've reached your weekly limit (7 links per week). Each link is limited to 100 MB.";
        alert(m); return;
      }
      console.error('Generate link error:', err);
      // Improve guidance for common network/CORS failures
      let friendly = msg;
      if (/Failed to fetch/i.test(msg)) {
        if (!navigator.onLine) friendly = 'Network offline: check your internet connection.';
        else friendly = 'Network request failed (possible CORS or server error). Check the extension console for details.';
      }
      alert((__t('notice_share_failed_prefix') || 'Could not generate link: ') + friendly);
    } finally {
      UPLOADING = false;
      if (makeLinkBtn) {
        makeLinkBtn.disabled = false;
        makeLinkBtn.innerHTML = `<i class=\"fas fa-link\"></i><span>${__t('btn_generate_link') || 'Generate Link'}</span>`;
      }
    }
  }

  if (makeLinkBtn) makeLinkBtn.addEventListener('click', generateShareLink);

  function copyTextFallback(text){
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly','');
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(ta);
      return ok;
    } catch { return false; }
  }
  async function copyLinkToClipboard(text){
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch {}
    return copyTextFallback(text);
  }
  if (copyLinkBtn) {
    copyLinkBtn.addEventListener('click', async () => {
      const toCopy = SHARE_URL || (shareLinkA?.href || '').trim();
      if (!toCopy) { alert(__t('share_not_ready') || 'Link not ready'); return; }
      const ok = await copyLinkToClipboard(toCopy);
      if (ok) {
        const prev = copyLinkBtn.innerHTML;
        copyLinkBtn.innerHTML = `<i class="fas fa-check"></i> ${__t('copied') || 'Copied!'}`;
        setTimeout(() => {
          copyLinkBtn.innerHTML = `<i class="fas fa-copy"></i> ${__t('btn_copy_link') || 'Copy link'}`;
        }, 1200);
      } else {
        prompt(__t('share_copy_prompt') || 'Copy this link:', toCopy);
      }
    });
  }

  // Bind embedded support modal from popup.html (no inline scripts allowed under MV3 CSP)
  function initSupportModalBindings() {
    try {
      const dlg = document.getElementById('ratingDialog');
      if (!dlg) return;
      window.openDialog = function(){
        try { dlg.setAttribute('aria-hidden','false'); dlg.style.display='flex'; } catch {}
        try { decorateHearts(); } catch {}
        try { setTimeout(decorateHearts, 0); } catch {}
        try { setTimeout(decorateHearts, 150); } catch {}
        try { ensureHeartObserver(); } catch {}
      };
      window.closeDialog = function(){
        try { dlg.setAttribute('aria-hidden','true'); dlg.style.display='none'; } catch {}
        try { stopHeartObserver(); } catch {}
      };
      try { dlg.querySelectorAll('[data-dlg-close]')?.forEach(el=> el.addEventListener('click', ()=> window.closeDialog())); } catch {}
      try {
        const btnRate = document.getElementById('dlgRate');
        btnRate?.addEventListener('click', ()=>{
          let url = 'https://chatexport.workpent.com';
          const ua = navigator.userAgent || '';
          if (/firefox/i.test(ua)) url = 'https://addons.mozilla.org/en-US/firefox/addon/ai-chat-exporter-pro/';
          else if (/Edg/i.test(ua)) url = 'https://microsoftedge.microsoft.com/addons/detail/ai-chat-exporter-pro/pejjiebkglnfeeeooinkdddofhffcmbg';
          else url = 'https://chromewebstore.google.com/detail/ai-chat-exporter-pro/fbkhenejfmjjakgpmiehogilickgmkhe';
          try { window.open(url, '_blank', 'noopener'); } catch {}
          window.closeDialog();
        });
      } catch {}
      try { document.getElementById('dlgSupport')?.addEventListener('click', ()=>{ try { window.open('https://chatexport.workpent.com/support/','_blank','noopener'); } catch {} window.closeDialog(); }); } catch {}
      try { document.getElementById('dlgLater')?.addEventListener('click', ()=> window.closeDialog()); } catch {}
    } catch {}
  }
  // Run once now and again after i18n applies
  try { initSupportModalBindings(); } catch {}
  try { setTimeout(initSupportModalBindings, 0); } catch {}

  // Ensure support modal is present in DOM; inject inline template if missing
  async function ensureSupportModal() {
    if (document.getElementById('ratingDialog')) return true;
    try {
      const style = document.createElement('style');
      style.textContent = `#ratingDialog.modal{position:fixed;inset:0;display:none;align-items:center;justify-content:center;z-index:9999}
      #ratingDialog[aria-hidden="false"]{display:flex}
      #ratingDialog .modal-backdrop{position:absolute;inset:0;background:rgba(0,0,0,0.55);backdrop-filter:blur(3px)}
      #ratingDialog .modal-content{position:relative;width:min(92vw,520px);background:#fff;border-radius:14px;padding:22px 20px;box-shadow:0 20px 60px rgba(0,0,0,.15),0 5px 15px rgba(0,0,0,.08);border:1px solid rgba(0,0,0,.06)}
      #ratingDialog h3{margin:8px 0 12px;font-size:18px;text-align:center}
      #ratingDialog .actions{display:grid;gap:10px;grid-template-columns:1fr 1fr;margin-top:10px}
      #ratingDialog .btn{display:flex;align-items:center;justify-content:center;gap:8px;border:1px solid rgba(0,0,0,.08);border-radius:10px;padding:12px 14px;font-weight:600;cursor:pointer;background:#fff}
      #ratingDialog .btn.primary{background:#3b82f6;color:#fff;border-color:#3b82f6}
      #ratingDialog .close{position:absolute;top:8px;right:8px;border:0;background:transparent;font-size:18px;cursor:pointer}
      @media (prefers-color-scheme: dark){
        #ratingDialog .modal-content{background:#0f1525;color:#f1f5f9;border-color:rgba(255,255,255,.08)}
        #ratingDialog .btn{background:transparent;color:#f1f5f9;border-color:rgba(255,255,255,.15)}
        #ratingDialog .btn.primary{background:#3b82f6;border-color:#3b82f6}
      }`;
      document.head.appendChild(style);
      const tpl = document.createElement('div');
      tpl.innerHTML = `
      <div id="ratingDialog" class="modal" aria-hidden="true" role="dialog" aria-modal="true" tabindex="-1">
        <div class="modal-backdrop" data-dlg-close="1"></div>
        <div class="modal-content" role="document">
          <button class="close" title="Close" data-dlg-close="1">&times;</button>
          <h3>${__t('post_success_support_msg') || 'Your Support Makes a Difference'}</h3>
          <div class="actions">
            <button id="dlgRate" class="btn primary">${__t('btn_rate_store') || 'Rate in Store'}</button>
            <button id="dlgSupport" class="btn">${__t('btn_support_dev') || 'Support Development'}</button>
          </div>
          <div style="text-align:center;margin-top:12px">
            <button id="dlgLater" class="btn" style="width:100%;">${__t('btn_later') || 'Remind Me Later'}</button>
          </div>
        </div>
      </div>`;
      document.body.appendChild(tpl.firstElementChild);

      // Define helpers
      window.openDialog = function(){ const d=document.getElementById('ratingDialog'); if (d){ d.setAttribute('aria-hidden','false'); d.style.display='flex'; }};
      window.closeDialog = function(){ const d=document.getElementById('ratingDialog'); if (d){ d.setAttribute('aria-hidden','true'); d.style.display='none'; }};
      // Wire buttons
      const dlg = document.getElementById('ratingDialog');
      dlg.querySelectorAll('[data-dlg-close]')?.forEach(el=> el.addEventListener('click', ()=> window.closeDialog()));
      const btnRate = document.getElementById('dlgRate');
      const btnSupport = document.getElementById('dlgSupport');
      const btnLater = document.getElementById('dlgLater');
      btnRate?.addEventListener('click', ()=>{
        let url = 'https://chatexport.workpent.com';
        const ua = navigator.userAgent || '';
        if (/firefox/i.test(ua)) url = 'https://addons.mozilla.org/en-US/firefox/addon/ai-chat-exporter-pro/';
        else if (/Edg/i.test(ua)) url = 'https://microsoftedge.microsoft.com/addons/detail/ai-chat-exporter-pro/pejjiebkglnfeeeooinkdddofhffcmbg';
        else url = 'https://chromewebstore.google.com/detail/ai-chat-exporter-pro/fbkhenejfmjjakgpmiehogilickgmkhe';
        try { window.open(url, '_blank', 'noopener'); } catch {}
        window.closeDialog();
      });
      btnSupport?.addEventListener('click', ()=>{ try { window.open('https://chatexport.workpent.com/support/','_blank','noopener'); } catch {} window.closeDialog(); });
      btnLater?.addEventListener('click', ()=> window.closeDialog());
      return true;
    } catch { return false; }
  }

  // Support dialog helper: ask content script to open page-level modal
  async function triggerSupportPrompt() {
    try {
      const tab = await queryActiveTab();
      if (tab?.id) await sendToTab(tab.id, { type: 'ACEP_OPEN_SUPPORT_MODAL' });
    } catch {}
  }

  // Counters for prompting logic
  async function bumpAndMaybePromptAfterExport() {
    try {
      const s = await getStorageArea();
      const { succExportCount = 0 } = await s.get({ succExportCount: 0 });
      const next = succExportCount + 1;
      await s.set({ succExportCount: next });
      return (next % 3 === 0);
    } catch {
      return false;
    }
  }
  // Share template data
  let LAST_SHARE_META = { provider: 'AI', format: 'pdf_text' };
  function detectBrowserLabel(){
    try { const ua = navigator.userAgent||''; if (/firefox/i.test(ua)) return 'Firefox'; if (/Edg/i.test(ua)) return 'Edge'; if (/Chrome/i.test(ua)) return 'Chrome'; } catch {}
    return 'browser';
  }
  function shareUrlBase() {
    try {
      const ua = navigator.userAgent || '';
      if (/firefox/i.test(ua)) return 'https://addons.mozilla.org/en-US/firefox/addon/ai-chat-exporter-pro/';
      if (/Edg/i.test(ua)) return 'https://microsoftedge.microsoft.com/addons/detail/ai-chat-exporter-pro/pejjiebkglnfeeeooinkdddofhffcmbg';
      return 'https://chromewebstore.google.com/detail/ai-chat-exporter-pro/fbkhenejfmjjakgpmiehogilickgmkhe';
    } catch {
      return 'https://chatexport.workpent.com';
    }
  }
  async function loadLastShareMeta(){
    try {
      const s = await getStorageArea();
      const r = await s.get({ acep_last_share: null });
      if (r && r.acep_last_share && typeof r.acep_last_share === 'object') {
        LAST_SHARE_META = { ...LAST_SHARE_META, ...r.acep_last_share };
      }
    } catch {}
    // Always refresh based on latest session state too
    if (LAST_PROVIDER_LABEL) LAST_SHARE_META.provider = LAST_PROVIDER_LABEL;
    if (LAST_FORMAT) LAST_SHARE_META.format = LAST_FORMAT || LAST_SHARE_META.format;
    updateShareLinks();
  }
  function formatLabelFor(want){
    switch(want){
      case 'pdf_text': return 'PDF';
      case 'docx': return 'DOCX';
      case 'png_plain': return 'PNG';
      case 'txt': return 'TXT';
      case 'md': return 'Markdown';
      case 'csv': return 'CSV';
      case 'json': return 'JSON';
      case 'html_self':
      case 'html_linked': return 'HTML';
      default: return want || 'file';
    }
  }
  function updateShareLinks() {
    // Recompute from the freshest info we have
    const browserLabel = detectBrowserLabel();
    const format = LAST_SHARE_META.format || LAST_FORMAT || fileTypeEl?.value || 'pdf_text';
    const provider = LAST_SHARE_META.provider || LAST_PROVIDER_LABEL || getProviderLabelFromUrl();
    LAST_SHARE_META = { ...LAST_SHARE_META, provider, format, browser: browserLabel };
    const text = `I just exported my ${provider} chat to ${formatLabelFor(format)} with AIChatExporterPro on ${browserLabel}!`;
    const url = shareUrlBase();
    const twitter = document.getElementById('share-twitter');
    const facebook = document.getElementById('share-facebook');
    const linkedin = document.getElementById('share-linkedin');
    const copyBtn = document.getElementById('share-copy');
    if (twitter) twitter.href = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;
    if (facebook) facebook.href = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}&quote=${encodeURIComponent(text)}`;
    if (linkedin) linkedin.href = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}&title=${encodeURIComponent(text)}`;
    if (copyBtn) {
      copyBtn.onclick = async () => {
        try { await navigator.clipboard.writeText(`${text} ${url}`); copyBtn.textContent = 'Copied!'; setTimeout(()=>{ copyBtn.innerHTML = '<i class="fas fa-link"></i> Copy message'; }, 1200); }
        catch { copyBtn.textContent = 'Copy failed'; setTimeout(()=>{ copyBtn.innerHTML = '<i class="fas fa-link"></i> Copy message'; }, 1200); }
      };
    }
    // Footer links placeholders
    const y = document.getElementById('footer-youtube'); if (y) y.href = 'https://www.youtube.com/';
    const c = document.getElementById('footer-coffee'); if (c) c.href = 'https://chatexport.workpent.com/support/';
    const p = document.getElementById('footer-privacy'); if (p) p.href = 'https://chatexport.workpent.com/privacy';
    const r = document.getElementById('footer-rate'); if (r) r.href = url;
  }

      // Load last share meta on startup so share buttons reflect the latest export
        loadLastShareMeta().catch(()=>{});

  let popupTipsScroller = null;
  function collectPopupTipMessages() {
    const messages = {};
    const getTip = (key) => {
      let value = '';
      try {
        if (typeof __t === 'function') value = String(__t(key)).trim();
      } catch {}
      if (!value || value === key) {
        try {
          const msg = STATE.messages?.[key]?.message;
          if (msg) value = String(msg).trim();
        } catch {}
      }
      if (!value || value === key) {
        try { value = String(browser.i18n.getMessage(key) || '').trim(); } catch {}
      }
      return value && value !== key ? value : '';
    };

    for (let i = 1; i <= 10; i++) {
      const key = `tip_${i}`;
      const value = getTip(key);
      if (!value) continue;
      messages[key] = value;
    }
    return messages;
  }
  function initPopupTipsScroller() {
    const tipsContainer = document.getElementById('tips-scroller-container');
    if (!tipsContainer) {
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => initPopupTipsScroller(), { once: true });
      }
      return;
    }
    if (popupTipsScroller) {
      try { popupTipsScroller.destroy?.(); } catch {}
      popupTipsScroller = null;
    }

    const TipsScroller = class {
      constructor(containerId, messages = {}) {
        this.container = document.getElementById(containerId);
        this.messages = messages;
        this.currentTipIndex = 0;
        this.tips = this.extractTips();
        this.rotationInterval = null;
      }
      extractTips() {
        const tips = [];
        let i = 1;
        while (this.messages[`tip_${i}`]) {
          tips.push(this.messages[`tip_${i}`]);
          i++;
        }
        return tips.length > 0 ? tips : ['Tip: Check settings to customize exports'];
      }
      init() {
        if (!this.container || this.tips.length === 0) return;
        this.render();
        this.startRotation();
      }
      updateMessages(messages = {}) {
        this.messages = messages;
        this.tips = this.extractTips();
        if (this.container) {
          this.render();
          this.resetRotationInterval();
        }
      }
      destroy() {
        this.stopRotation();
        if (this.container) {
          this.container.innerHTML = '';
        }
      }
      render() {
        const style = `.acep-tips-scroller{width:100%;overflow:hidden;border-radius:10px;background:linear-gradient(135deg,#f3effe 0%,#e8d7ff 100%);border:1px solid #e0d6f5;position:relative;display:flex;align-items:center;gap:10px;padding:10px 12px}.acep-tips-scroller .bulb{width:28px;height:28px;border-radius:50%;background:rgba(126,87,194,.14);display:flex;align-items:center;justify-content:center;color:#6b46c1;flex:0 0 auto}.acep-tips-scroller .viewport{flex:1;min-width:0;overflow:hidden;position:relative;height:18px}.acep-tips-scroller .marquee{display:inline-block;white-space:nowrap;color:#2d1b69;font-size:12.5px;font-weight:600;will-change:transform;padding-left:100%;animation:acepMarquee 14s linear infinite}@keyframes acepMarquee{0%{transform:translateX(0)}100%{transform:translateX(-100%)}}`;
        const first = this.tips[0] || '';
        const html = `<div class="acep-tips-scroller"><div class="bulb"><i class="fas fa-lightbulb"></i></div><div class="viewport"><div class="marquee" data-tip-index="0">${first}</div></div><style>${style}</style></div>`;
        this.container.innerHTML = html;
      }
      showTip(index) {
        if (index < 0 || index >= this.tips.length) return;
        const marquee = this.container?.querySelector?.('.marquee');
        if (marquee) {
          marquee.textContent = this.tips[index];
          marquee.setAttribute('data-tip-index', String(index));
          // Restart CSS animation so the new tip starts from the right edge.
          try {
            const clone = marquee.cloneNode(true);
            marquee.replaceWith(clone);
          } catch {}
        }
        this.currentTipIndex = index;
      }
      nextTip() {
        const nextIndex = (this.currentTipIndex + 1) % this.tips.length;
        this.showTip(nextIndex);
      }
      startRotation(interval = 15000) {
        this.rotationInterval = setInterval(() => this.nextTip(), interval);
      }
      stopRotation() {
        if (this.rotationInterval) {
          clearInterval(this.rotationInterval);
          this.rotationInterval = null;
        }
      }
      resetRotationInterval(interval = 15000) {
        this.stopRotation();
        this.startRotation(interval);
      }
    };

    const scroller = new TipsScroller('tips-scroller-container', collectPopupTipMessages());
    scroller.init();
    tipsContainer.style.display = 'block';
    popupTipsScroller = scroller;
  }

  // Initialize Tips Scroller (display helpful tips to users)
  (async () => {
    try { await i18nReady; } catch {}
    initPopupTipsScroller();
  })();

      // Load last share meta on startup so share buttons reflect the latest export
        loadLastShareMeta().catch(()=>{});
})();
