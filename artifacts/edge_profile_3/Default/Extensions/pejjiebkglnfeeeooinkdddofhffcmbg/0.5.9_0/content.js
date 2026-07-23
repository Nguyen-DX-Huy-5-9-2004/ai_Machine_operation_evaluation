
/* AI Chat Exporter Pro - content script (MV2/MV3 compatible)
 * - Returns CLEAN HTML + Title, with role labels/icons if requested
 * - Inlines uploaded/generated images to data URLs for "self" mode
 * - Uses base64 icons for export (no broken images)
 */
if (typeof globalThis.browser === "undefined" && typeof globalThis.chrome !== "undefined") {
  globalThis.browser = globalThis.chrome;
}


  // Show loading placeholder immediately ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¾Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¦ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â turns arrive after preScrape resolves
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
    if (api.storage && api.storage.local) { p(api.storage.local, 'get'); p(api.storage.local, 'set'); p(api.storage.local, 'remove'); }
    if (api.tabs) { p(api.tabs, 'query'); p(api.tabs, 'get'); p(api.tabs, 'create'); p(api.tabs, 'sendMessage'); }
    if (api.permissions) { p(api.permissions, 'request'); }
    if (api.runtime) { p(api.runtime, 'sendMessage'); }
  } catch {}
})();

(() => {
  if (globalThis.__ACEP_CONTENT_SCRIPT_BOOTED__) {
    return;
  }
  globalThis.__ACEP_CONTENT_SCRIPT_BOOTED__ = true;

  const BTN_ID = 'acep-export-btn';
  const IFRAME_ID = 'acep-popup-frame';
  const SELECT_STYLE_ID = 'acep-select-style';
  const SELECT_TOOLBAR_ID = 'acep-select-toolbar';
  const SIDEBAR_ID = 'acep-export-sidebar';
  const SIDEBAR_HOST_ID = `${SIDEBAR_ID}-host`;
  const SIDEBAR_WIDTH = 380;
  const SIDEBAR_MIN_WIDTH = 300;
  const SIDEBAR_MAX_WIDTH = 720;
  const EXPORT_BUTTON_POS_KEY = 'acep_export_button_position';
  const SIDEBAR_WIDTH_KEY = 'acep_sidebar_width';
  const ORIGIN = location.origin;
  const HOST = location.hostname || '';
  const SUPPORTED_HOST = /(chatgpt\.com|chat\.openai\.com|claude\.ai|grok\.com|deepseek\.com|gemini\.google\.com)$/i.test(HOST);
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  async function getLocalSetting(key, fallback) {
    try {
      const result = await browser.storage?.local?.get?.({ [key]: fallback });
      return result && Object.prototype.hasOwnProperty.call(result, key) ? result[key] : fallback;
    } catch {
      return fallback;
    }
  }
  async function setLocalSetting(key, value) {
    try { await browser.storage?.local?.set?.({ [key]: value }); } catch {}
  }
  async function getSidebarWidth() {
    const stored = Number(await getLocalSetting(SIDEBAR_WIDTH_KEY, SIDEBAR_WIDTH));
    const viewportMax = Math.max(SIDEBAR_MIN_WIDTH, Math.min(SIDEBAR_MAX_WIDTH, Math.floor((window.innerWidth || 1024) * 0.92)));
    return clamp(Number.isFinite(stored) ? stored : SIDEBAR_WIDTH, SIDEBAR_MIN_WIDTH, viewportMax);
  }
  async function applyStoredExportButtonPosition(host) {
    try {
      const pos = await getLocalSetting(EXPORT_BUTTON_POS_KEY, null);
      if (!host || !pos || !Number.isFinite(Number(pos.left)) || !Number.isFinite(Number(pos.top))) return;
      const left = clamp(Number(pos.left), 8, Math.max(8, (window.innerWidth || 800) - 96));
      const top = clamp(Number(pos.top), 8, Math.max(8, (window.innerHeight || 600) - 48));
      host.style.left = `${left}px`;
      host.style.top = `${top}px`;
      host.style.right = 'auto';
      host.style.bottom = 'auto';
    } catch {}
  }
  async function getStoredAuthToken() {
    try {
      const keys = ['chatgptpal/accessToken','acep_access_token','accessToken','access_token','chatgptpal/access_token'];
      const stored = await browser.storage?.local?.get?.(keys) || {};
      for (const k of keys) {
        const v = stored[k];
        if (typeof v === 'string' && v.trim()) {
          let token = v.trim();
          if (!/^Bearer\s+/i.test(token)) token = 'Bearer ' + token;
          return token;
        }
      }
    } catch (e) {
      // ignore
    }
    return '';
  }
  async function getRawStoredAuthToken() {
    try {
      const keys = ['chatgptpal/accessToken','acep_access_token','accessToken','access_token','chatgptpal/access_token'];
      const stored = await browser.storage?.local?.get?.(keys) || {};
      for (const k of keys) {
        const v = stored[k];
        if (typeof v === 'string' && v.trim()) return v.trim();
      }
    } catch (e) {}
    return '';
  }
  // Inject a main-world fetch hook to capture Authorization if needed
  (function injectAcepFetchHook(){
    try {
      if (document.documentElement.dataset.acepFetchInjected) return;
      document.documentElement.dataset.acepFetchInjected = '1';
      const s = document.createElement('script');
      s.src = browser.runtime.getURL('content/injected_capture.js');
      s.type = 'text/javascript';
      (document.head || document.documentElement).appendChild(s);
      s.remove();
    } catch (e) {}
  })();

  // Listen for messages from the page hook and persist token
  window.addEventListener('message', (event) => {
    if (event.source !== window) return;
    const data = event.data || {};
    if (data.source !== 'acep') return;
    try {
      if (data.type === 'authToken' && typeof data.token === 'string' && data.token) {
        try {
          browser.storage.local.set({ acep_access_token: data.token }).catch(e=>{ console.warn('[ACEP] failed to store captured token', e); });
          try { console.log('[ACEP] captured auth token length=', String(data.token).length, 'startsWithBearer=', /^Bearer\s+/i.test(data.token)); } catch(e){}
        } catch (e) { console.warn('[ACEP] failed to store captured token', e); }
      }
      if (data.type === 'conversations' && Array.isArray(data.items)) {
        try { browser.storage.local.set({ acep_apiConversations: data.items }).catch(e=>{ console.warn('[ACEP] failed to store conversations', e); }); } catch (e) { console.warn('[ACEP] failed to store conversations', e); }
        try { console.log('[ACEP] captured conversations count=', (data.items && data.items.length) || 0); } catch(e){}
      }
      if (data.type === 'projects' && Array.isArray(data.items)) {
        try { browser.storage.local.set({ acep_projects: data.items }).catch(e=>{ console.warn('[ACEP] failed to store projects', e); }); } catch (e) { console.warn('[ACEP] failed to store projects', e); }
        try { console.log('[ACEP] captured projects count=', (data.items && data.items.length) || 0); } catch(e){}
      }
    } catch (e) {}
  });

  // On load, log known token keys so debugging is easier (content script context)
  (async function debugDumpTokens(){
    try {
      const keys = ['acep_access_token','chatgptpal/accessToken','accessToken','access_token'];
      const stored = await browser.storage.local.get(keys);
      const out = {};
      for (const k of keys) {
        const v = stored[k];
        if (typeof v === 'string' && v) {
          out[k] = ('<masked> length=' + String(v).length + ' startsWithBearer=' + (/^Bearer\s+/i.test(v)));
        } else if (Array.isArray(v)) {
          out[k] = '[array] length=' + v.length;
        } else {
          out[k] = null;
        }
      }
      console.log('[ACEP] stored token keys:', out);
    } catch (e) { console.warn('[ACEP] debug dump tokens failed', e); }
  })();
  // Role icons: embed as data URLs immediately to avoid CSP blocks on extension URLs
  const ICON_PATHS = {
    user: 'icons/user-purple.png',
    chatgpt: 'icons/chatgpt-purple.png',
    grok: 'icons/grok-purple.png',
    claude: 'icons/Claude-purple.png',
    gemini: 'icons/Gemini-purple.png',
    deepseek: 'icons/deepseek-purple.png',
  };
  const ICON_CACHE_DATAURL = { user: null, chatgpt: null, grok: null, claude: null, gemini: null, deepseek: null };
  async function loadIconDataUrl(key, path){
    if (ICON_CACHE_DATAURL[key]) return ICON_CACHE_DATAURL[key];
    try {
      const url = browser.runtime.getURL(path);
      const resp = await fetch(url);
      if (!resp.ok) return '';
      const blob = await resp.blob();
      const dataUrl = await blobToDataURL(blob);
      ICON_CACHE_DATAURL[key] = dataUrl || '';
      return ICON_CACHE_DATAURL[key];
    } catch { return ''; }
  }
  function loadIconDataUrlSync(key){ return ICON_CACHE_DATAURL[key] || ''; }
  (async () => {
    try {
      await Promise.all(Object.entries(ICON_PATHS).map(([k,p]) => loadIconDataUrl(k,p)));
    } catch {}
  })();
  const REMOTE_IMAGE_HOSTS = [
    'files.oaiusercontent.com',
    'cdn.openai.com',
    'images.openai.com',
    'oaidalleapiprodscus.blob.core.windows.net',
    'chatgpt.com',
    'oaiusercontent.com',
    'assets.grok.com',
    'claude.ai',
    'deepseek.com',
    // DeepSeek uploaded images (Huawei Cloud OBS)
    'deepseek-api-files.obs.cn-east-3.myhuaweicloud.com',
    'obs.cn-east-3.myhuaweicloud.com',
    'myhuaweicloud.com',
    // Gemini images
    'googleusercontent.com',
    'lh3.googleusercontent.com',
    'gstatic.com',
    'lh3.google.com'
  ];
  const STATE = { enabled: true, lang: 'en', busy: false, messages: null };
  let ACEP_RENDER_BUSY = false;
  let ACEP_SUPPORT_TIMER = null;
  let ACEP_LAST_AUTOSCROLL_AT = 0;
  let ACEP_LAST_AUTOSCROLL_EL = null;
  let ACEP_SELECT_SCROLL_EL = null;
  let ACEP_SELECT_SCROLL_HANDLER = null;
  let ACEP_MODAL_LOADED = false;
  let ACEP_CLAUDE_ARTIFACTS = null;
  let ACEP_CLAUDE_ARTIFACTS_LOADED = false;
  let ACEP_CLAUDE_ARTIFACTS_PROMISE = null;
  let SELECT_MODE_ACTIVE = false;
  const ACEP_DEBUG = true;

  const env = (globalThis.ACEP && globalThis.ACEP.env) ? globalThis.ACEP.env : null;
  const isChatGPT = () => !!(env && env.isChatGPT && env.isChatGPT());
  const isClaude = () => !!(env && env.isClaude && env.isClaude());
  const isGrok = () => !!(env && env.isGrok && env.isGrok());
  const isGemini = () => !!(env && env.isGemini && env.isGemini());
  const isDeepSeek = () => !!(env && env.isDeepSeek && env.isDeepSeek());
  const getProviderKey = () => {
    try {
      const k = (env && env.PLATFORM) ? String(env.PLATFORM) : '';
      return k.trim().toLowerCase();
    } catch { return ''; }
  };
  const getProvider = () => {
    try {
      const k = getProviderKey();
      return (globalThis.ACEP && globalThis.ACEP.providers && k) ? (globalThis.ACEP.providers[k] || null) : null;
    } catch { return null; }
  };
  // Provider-only mode: do not fall back to legacy per-site scraping in content.js.
  const STRICT_PROVIDER_ONLY = true;
  const requireProvider = () => {
    const p = getProvider();
    if (p) return p;
    if (!STRICT_PROVIDER_ONLY) return null;
    try {
      document.documentElement.setAttribute('data-acep-provider-only', '1');
      document.documentElement.setAttribute('data-acep-provider-missing', JSON.stringify({
        host: HOST,
        platform: getProviderKey(),
        ts: Date.now(),
      }));
    } catch {}
    return null;
  };
  function acepLog(...args) {
    if (!ACEP_DEBUG) return;
    try { console.log('[ACEP]', ...args); } catch {}
  }
  function acepDebugStore(name, value) {
    if (!ACEP_DEBUG) return;
    try {
      window.__acepClaudeDebug = window.__acepClaudeDebug || {};
      window.__acepClaudeDebug[name] = value;
    } catch {}
    // Content scripts run in an isolated world; expose small debug signals via DOM attributes too.
    try {
      const k = `data-acep-debug-${String(name || '').toLowerCase().replace(/[^a-z0-9_-]+/g, '-')}`;
      const v = (typeof value === 'string') ? value : JSON.stringify(value);
      if (typeof v === 'string' && v.length <= 500) {
        document.documentElement.setAttribute(k, v);
      }
    } catch {}
  }

  async function ensureModalFromTemplate() {
    let dlg = document.getElementById('ratingDialog');
    if (dlg) return dlg;
    try {
      // Fetch modal.html once and extract style + #ratingDialog
      const url = browser.runtime.getURL('modal.html');
      const resp = await fetch(url);
      if (!resp.ok) throw new Error('modal fetch failed');
      let html = await resp.text();
      try {
        const t = (k,d)=> (STATE.messages?.[k]?.message) || browser.i18n.getMessage(k) || d || '';
        html = html.replace(/__MSG_([A-Za-z0-9_]+)__/g, (_, key) => t(key, ''));
      } catch {}
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');

      // Append styles (first <style> in head)
      const style = doc.querySelector('style');
      if (style && !document.getElementById('acep-modal-style')) {
        const s = document.createElement('style');
        s.id = 'acep-modal-style';
        s.textContent = style.textContent || '';
        document.documentElement.appendChild(s);
      }

      // Take the dialog markup
      const tplDlg = doc.getElementById('ratingDialog');
      if (!tplDlg) throw new Error('modal template missing dialog');
      // Clone node so we don't move it out of parsed document
      dlg = tplDlg.cloneNode(true);

      // Remove inline handlers to satisfy CSP and avoid undefined function errors
      try {
        dlg.querySelectorAll('[onclick], [onClick]').forEach(el => { try { el.removeAttribute('onclick'); el.removeAttribute('onClick'); } catch {} });
      } catch {}
      // Also scrub any inline handlers from backdrop/close specifically
      try { const bd = dlg.querySelector('.modal-backdrop'); bd && bd.removeAttribute('onclick'); } catch {}
      try { const mc = dlg.querySelector('.modal-close'); mc && mc.removeAttribute('onclick'); } catch {}

      // Insert into page DOM
      document.documentElement.appendChild(dlg);
      // Ensure any literal heart emoji inserted as text becomes a pulsing heart
      const wrapHearts = (root) => {
        if (!root) return;
        const nodes = root.querySelectorAll('p, h2, span, div');
        nodes.forEach(el => {
          try {
            if (!el.querySelector('.acep-heart') && el.innerHTML && el.innerHTML.includes('ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¾Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚ÂÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¤ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¾Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¯ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â')) {
              el.innerHTML = el.innerHTML.replace(/ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¾Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚ÂÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¤ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¾Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¯ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â/g, '<span class="acep-heart">ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¾Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚ÂÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¤ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¾Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¯ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â</span>');
            }
          } catch (e) {}
        });
      };
      wrapHearts(dlg);

      // Wire close actions
      const close = ()=>{ try { dlg.setAttribute('aria-hidden','true'); dlg.style.display='none'; } catch {} };
      try { dlg.querySelectorAll('[data-dlg-close]')?.forEach(el=> el.addEventListener('click', close)); } catch {}
      // Wire share copy with a fixed message
      try {
        const copyBtn = dlg.querySelector('#shareCopy');
        if (copyBtn) copyBtn.addEventListener('click', async () => {
          const t = (k,d)=> (STATE.messages?.[k]?.message) || browser.i18n.getMessage(k) || d || '';
          const msg = `${t('modal_share_msg','I just exported my chat with AI Chat Exporter Pro (Firefox)!')} https://addons.mozilla.org/en-US/firefox/addon/ai-chat-exporter-pro/`;
          try {
            await navigator.clipboard.writeText(msg);
            copyBtn.textContent = t('modal_copied','Copied!');
            setTimeout(()=>{ copyBtn.textContent = t('modal_copy_btn','Copy'); }, 1200);
          } catch {}
        });
      } catch {}
      try {
        const backdrop = dlg.querySelector('.modal-backdrop');
        backdrop?.addEventListener('click', close);
      } catch {}

      // Wire buttons (fallback to classes if ids are missing in template)
      try {
        let rateBtn = dlg.querySelector('#dlgRate') || dlg.querySelector('.btn.primary');
        let supportBtn = dlg.querySelector('#dlgSupport') || dlg.querySelector('.btn.outline');
        let laterBtn = dlg.querySelector('#dlgLater') || dlg.querySelector('.btn.ghost,[data-dlg-close]');
        try { if (rateBtn && !rateBtn.id) rateBtn.id = 'dlgRate'; } catch {}
        try { if (supportBtn && !supportBtn.id) supportBtn.id = 'dlgSupport'; } catch {}
        try { if (laterBtn && !laterBtn.id && laterBtn.classList.contains('btn')) laterBtn.id = 'dlgLater'; } catch {}
        const getStoreUrl = () => {
          let url = 'https://addons.mozilla.org/en-US/firefox/addon/ai-chat-exporter-pro/';
          const ua = navigator.userAgent || '';
          if (/firefox/i.test(ua)) return 'https://addons.mozilla.org/en-US/firefox/addon/ai-chat-exporter-pro/';
          if (/Edg/i.test(ua)) return 'https://microsoftedge.microsoft.com/addons/detail/ai-chat-exporter-pro/pejjiebkglnfeeeooinkdddofhffcmbg';
          return 'https://chromewebstore.google.com/detail/ai-chat-exporter-pro/fbkhenejfmjjakgpmiehogilickgmkhe';
        };
        if (rateBtn) rateBtn.addEventListener('click', ()=>{ try { window.open(getStoreUrl(), '_blank', 'noopener'); } catch {} close(); });
        if (supportBtn) supportBtn.addEventListener('click', ()=>{ try { window.open('https://chatexport.workpent.com/support/','_blank','noopener'); } catch {} close(); });
        if (laterBtn) laterBtn.addEventListener('click', close);
      } catch {}

      // Localize strings, links, and share text
      try {
        const t = (k,d)=> (STATE.messages?.[k]?.message) || browser.i18n.getMessage(k) || d;
        const h3 = dlg.querySelector('#ratingDialogTitle');
        const desc = dlg.querySelector('#ratingDialogDesc');
        const body1 = dlg.querySelector('#ratingDialogBody');
        const feedbackLink = dlg.querySelector('#modalFeedbackLink');
        const shareTitle = dlg.querySelector('#ratingDialogShareTitle');
        const rateBtn = dlg.querySelector('#dlgRate');
        const supportBtn = dlg.querySelector('#dlgSupport');
        const laterBtn = dlg.querySelector('#dlgLater');
        if (h3) h3.textContent = t('modal_title','Export Success!');
        if (desc) desc.textContent = t('modal_subtitle','Built with love just for you. Thanks for using.');
        if (feedbackLink) feedbackLink.textContent = t('modal_feedback_text','reach out');
        if (feedbackLink) feedbackLink.href = t('modal_feedback_url','https://chatexport.workpent.com/feedback/ideas');
        if (body1) {
          const prefix = t('modal_body_prefix','If you have any issues or ideas,');
          const suffix = t('modal_body_suffix',"and weÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¾Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¦ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¦ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¾ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ll fix it. A quick rating or a coffee keeps updates coming.");
          const href = feedbackLink ? feedbackLink.href : '#';
          const text = feedbackLink ? feedbackLink.textContent : t('modal_feedback_text','reach out');
          body1.innerHTML = `${prefix} <a id="modalFeedbackLink" href="${href}" target="_blank" rel="noopener">${text}</a> ${suffix}`;
        }
        if (shareTitle) shareTitle.textContent = t('modal_share_title','Promote us: Share the word');
        if (rateBtn) rateBtn.textContent = t('modal_rate_btn','Rate in Store');
        if (supportBtn) supportBtn.textContent = t('modal_support_btn','Buy Me A Coffee');
        if (laterBtn) laterBtn.textContent = t('btn_later','Close');

        // Update link labels/urls
        const storeUrl = (()=>{ const ua=navigator.userAgent||''; if(/firefox/i.test(ua)) return t('modal_url_rate_firefox','https://addons.mozilla.org/en-US/firefox/addon/ai-chat-exporter-pro/'); if(/Edg/i.test(ua)) return t('modal_url_rate_edge','https://microsoftedge.microsoft.com/addons/detail/ai-chat-exporter-pro/pejjiebkglnfeeeooinkdddofhffcmbg'); return t('modal_url_rate_chrome','https://chromewebstore.google.com/detail/ai-chat-exporter-pro/fbkhenejfmjjakgpmiehogilickgmkhe');})();
        const linkRate = dlg.querySelector('#linkRate'); const fr = dlg.querySelector('#footerRate');
        if (linkRate) { linkRate.href = storeUrl; }
        if (fr) { fr.href = storeUrl; }
        const ly = dlg.querySelector('#linkYoutube'); const fy = dlg.querySelector('#footerYoutube');
        if (ly) { ly.href = t('modal_url_youtube','https://www.youtube.com/@AIChatExporterPro'); }
        if (fy) { fy.href = ly?.href || t('modal_url_youtube','https://www.youtube.com/@AIChatExporterPro'); }
        const lc = dlg.querySelector('#linkCoffee'); const fc = dlg.querySelector('#footerCoffee');
        if (lc) { lc.href = t('modal_url_coffee','https://chatexport.workpent.com/support/'); }
        if (fc) { fc.href = lc?.href || t('modal_url_coffee','https://chatexport.workpent.com/support/'); }
        const lp = dlg.querySelector('#linkPrivacy'); const fp = dlg.querySelector('#footerPrivacy');
        if (lp) { lp.href = t('modal_url_privacy','https://chatexport.workpent.com/privacy/'); }
        if (fp) { fp.href = lp?.href || t('modal_url_privacy','https://chatexport.workpent.com/privacy/'); }

        // Build share text using last meta (provider/format/browser) if available
        const formatLabel = (fmt) => {
          switch(fmt){
            case 'pdf_text': return 'PDF';
            case 'docx': return 'DOCX';
            case 'png_plain': return 'PNG';
            case 'txt': return 'TXT';
            case 'md': return 'Markdown';
            case 'csv': return 'CSV';
            case 'json': return 'JSON';
            case 'html_self':
            case 'html_linked': return 'HTML';
            default: return fmt || 'file';
          }
        };
        const browserLabel = (()=>{ const ua=navigator.userAgent||''; if(/firefox/i.test(ua)) return 'Firefox'; if(/Edg/i.test(ua)) return 'Edge'; if(/Chrome/i.test(ua)) return 'Chrome'; return 'browser'; })();
        let lastMeta = { provider: 'AI', format: 'pdf_text', browser: browserLabel };
        try {
          const loadMeta = async () => {
            try { if (typeof browser !== 'undefined' && browser.storage?.local) { const r = await browser.storage.local.get('acep_last_share'); return r?.acep_last_share; } } catch {}
            try { if (chrome?.storage?.local?.get) { const r = await browser.storage.local.get('acep_last_share'); return r?.acep_last_share; } } catch {}
            try { if (chrome?.storage?.sync?.get) { const r = await browser.storage.sync.get('acep_last_share'); return r?.acep_last_share; } } catch {}
            return null;
          };
          const meta = await loadMeta();
          if (meta) lastMeta = { ...lastMeta, ...meta };
        } catch {}
        const shareText = `I just exported my ${lastMeta.provider} chat to ${formatLabel(lastMeta.format)} with AI Chat Exporter Pro on ${lastMeta.browser}!`;

        // update share links
        try {
          const twitter = dlg.querySelector('#shareTwitter');
          const facebook = dlg.querySelector('#shareFacebook');
          const linkedin = dlg.querySelector('#shareLinkedin');
          const copyBtn = dlg.querySelector('#shareCopy');
          if (twitter) twitter.href = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(storeUrl)}`;
          if (facebook) facebook.href = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(storeUrl)}&quote=${encodeURIComponent(shareText)}`;
          if (linkedin) linkedin.href = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(storeUrl)}&title=${encodeURIComponent(shareText)}`;
          if (copyBtn) copyBtn.textContent = t('modal_copy_btn','Copy');
          if (copyBtn) copyBtn.onclick = async ()=>{ try { await navigator.clipboard.writeText(`${shareText} ${storeUrl}`); copyBtn.textContent = t('modal_copied','Copied!'); setTimeout(()=>{ copyBtn.textContent = t('modal_copy_btn','Copy'); }, 1200); } catch {} };
        } catch {}
      } catch {}

      ACEP_MODAL_LOADED = true;
      return dlg;
    } catch (e) {
      console.warn('ensureModalFromTemplate failed', e);
      const fallback = buildInlineSupportDialog();
      if (fallback) return fallback;
      return null;
    }
  }

  function buildInlineSupportDialog() {
    try {
      let dlg = document.getElementById('ratingDialog');
      if (dlg) return dlg;
      const styleId = 'acep-inline-support-style';
      if (!document.getElementById(styleId)) {
        const style = document.createElement('style');
        style.id = styleId;
        style.textContent = `#ratingDialog.modal{position:fixed;inset:0;display:none;align-items:center;justify-content:center;z-index:2147483647;font-family:system-ui,-apple-system,Segoe UI,Roboto,Inter,sans-serif}
#ratingDialog.modal[aria-hidden="false"]{display:flex}
#ratingDialog .modal-backdrop{position:absolute;inset:0;background:rgba(0,0,0,.1)}
#ratingDialog .modal-content{position:relative;width:min(92vw,520px);max-height:90vh;overflow:auto;background:#fff;color:#0f172a;border-radius:18px;padding:28px;border:1px solid rgba(15,23,42,.08);box-shadow:0 20px 60px rgba(15,23,42,.15)}
#ratingDialog h2{margin:0 0 8px;font-size:20px}
#ratingDialog p{margin:0 0 16px;color:#475569}
#ratingDialog .actions{display:flex;flex-wrap:wrap;gap:10px}
#ratingDialog .actions button{flex:1 1 45%;padding:12px;border-radius:10px;border:1px solid rgba(15,23,42,.12);font-weight:600;cursor:pointer;background:#fff}
#ratingDialog .actions button.primary{background:#3b82f6;color:#fff;border-color:#3b82f6}
#ratingDialog .closer{margin-top:12px;width:100%;padding:11px;border-radius:10px;border:1px solid rgba(15,23,42,.12);background:#f8fafc;cursor:pointer}
#ratingDialog .footer-links{margin-top:10px;font-size:12px;color:#475569;display:flex;flex-wrap:wrap;gap:8px}
#ratingDialog .footer-links span{pointer-events:none}
.acep-heart{display:inline-block;animation:acepHeartBeat 1.2s ease-in-out infinite}
@keyframes acepHeartBeat{0%,100%{transform:scale(1)}14%{transform:scale(1.35)}28%{transform:scale(1)}42%{transform:scale(1.35)}70%{transform:scale(1)}}
@media (prefers-color-scheme:dark){#ratingDialog .modal-content{background:#0b1021;color:#f8fafc;border-color:rgba(255,255,255,.15)}#ratingDialog .actions button{background:#101828;color:#f4f4f5;border-color:rgba(255,255,255,.12)}#ratingDialog .actions button.primary{background:#3b82f6;color:#fff}}`;
        document.head.appendChild(style);
      }
      const wrapper = document.createElement('div');
      wrapper.innerHTML = `
        <div id="ratingDialog" class="modal" aria-hidden="true" role="dialog" aria-modal="true" tabindex="-1">
          <div class="modal-backdrop" data-acep-close="1"></div>
          <div class="modal-content">
            <button data-acep-close="1" style="position:absolute;top:12px;right:12px;border:0;background:transparent;font-size:22px;cursor:pointer" aria-label="Close">&times;</button>
            <h2>Export Success!</h2>
            <p>Built just for you. Thanks for using.</p>
            <div class="actions">
              <button data-acep-rate="1" class="primary">Rate in Store</button>
              <button data-acep-support="1">Buy Me A Coffee</button>
            </div>
            <p style="margin-top:12px;">If you have any issues or ideas, reach out and we'll fix it.</p>
            <div class="footer-links" style="margin-top:10px;">
              <span>YouTube | Buy us a coffee | Privacy Policy | Rate in store</span>
            </div>
            <button class="closer" data-acep-close="1">Maybe later</button>
          </div>
        </div>`;
      dlg = wrapper.firstElementChild;
      document.documentElement.appendChild(dlg);
      const close = () => {
        try {
          dlg.setAttribute('aria-hidden', 'true');
          dlg.style.display = 'none';
        } catch {}
      };
      dlg.querySelectorAll('[data-acep-close]')?.forEach(el => el.addEventListener('click', close));
      const rateBtn = dlg.querySelector('[data-acep-rate]');
      rateBtn?.addEventListener('click', () => {
        try {
          const ua = navigator.userAgent || '';
          let url = 'https://chatexport.workpent.com';
          if (/firefox/i.test(ua)) url = 'https://addons.mozilla.org/en-US/firefox/addon/ai-chat-exporter-pro/';
          else if (/Edg/i.test(ua)) url = 'https://microsoftedge.microsoft.com/addons/detail/ai-chat-exporter-pro/pejjiebkglnfeeeooinkdddofhffcmbg';
          else url = 'https://chromewebstore.google.com/detail/AI%20Chat%20Exporter%20Pro/fbkhenejfmjjakgpmiehogilickgmkhe';
          window.open(url, '_blank', 'noopener');
        } catch {}
        close();
      });
      const supportBtn = dlg.querySelector('[data-acep-support]');
      supportBtn?.addEventListener('click', () => {
        try { window.open('https://chatexport.workpent.com/support/','_blank','noopener'); } catch {}
        close();
      });
      dlg.setAttribute('aria-hidden', 'true');
      dlg.style.display = 'none';
      return dlg;
    } catch (err) {
      console.warn('buildInlineSupportDialog failed', err);
      return null;
    }
  }
  async function readSettings() {
    let enabled = true;
    let lang = 'en';
    try {
      const fromSync = await browser.storage?.sync?.get?.({ enabled: true, lang: 'en' });
      if (fromSync) {
        if (typeof fromSync.enabled === 'boolean') enabled = fromSync.enabled;
        if (typeof fromSync.lang === 'string' && fromSync.lang) lang = fromSync.lang;
      }
    } catch {}
    try {
      // Prefer local if present (action/popup UI often writes to local).
      const fromLocal = await browser.storage?.local?.get?.({ enabled: enabled, lang: lang });
      if (fromLocal) {
        if (typeof fromLocal.enabled === 'boolean') enabled = fromLocal.enabled;
        if (typeof fromLocal.lang === 'string' && fromLocal.lang) lang = fromLocal.lang;
      }
    } catch {}
    STATE.enabled = !!enabled;
    STATE.lang = lang || 'en';
  }
  async function loadMessagesFor(lang) {
    try {
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
      // Merge: selected language overrides English; ensures *every* key exists.
      STATE.messages = { ...(base || {}), ...(override || {}) };
    } catch {
      STATE.messages = null;
    }
  }
  function currentLabelExport() {
    const m = STATE.messages?.export_fab?.message;
    if (m) return m;
    return browser.i18n.getMessage('export_fab') || 'Export';
  }
  function onDomReady(fn) {
    if (!fn) return;
    if (document.readyState === 'complete' || document.readyState === 'interactive') {
      try { fn(); } catch {}
      return;
    }
    document.addEventListener('DOMContentLoaded', () => { try { fn(); } catch {} }, { once: true });
  }
  function injectSelectionStyles() {
    if (document.getElementById(SELECT_STYLE_ID)) return;
    try {
      if (/chatgpt\.com$/i.test(HOST) || /chat\.openai\.com$/i.test(HOST)) {
        document.documentElement.classList.add('acep-host-chatgpt');
      } else {
        document.documentElement.classList.remove('acep-host-chatgpt');
      }
      if (/(claude\.ai|grok\.com|gemini\.google\.com)$/i.test(HOST)) {
        document.documentElement.classList.add('acep-host-claude');
      } else {
        document.documentElement.classList.remove('acep-host-claude');
      }
    } catch {}
    const style = document.createElement('style');
    style.id = SELECT_STYLE_ID;
    style.textContent = `
      .acep-turn-check {
        position:absolute; top:8px; right:-85px; left:auto; z-index:2147483000;
        display:flex; align-items:center; gap:6px; padding:4px 6px;
        background:rgba(126,87,194,0.12); border:1px solid rgba(126,87,194,0.35);
        border-radius:8px; font:12px/1.2 "Segoe UI", Arial, sans-serif; color:#0f172a;
      }
      .acep-host-chatgpt .acep-turn-check { right:10px; top:6px; }
      .acep-host-claude .acep-turn-check {
        right:-19px; top:-6px;
        background:rgba(255,255,255,0.92);
        color:#111827;
        border:1px solid rgba(17,24,39,0.15);
        box-shadow:0 6px 18px rgba(0,0,0,0.12);
      }
      .acep-turn-check input { width:14px; height:14px; accent-color:#7E57C2; }
      .acep-host-claude label.acep-turn-check { z-index:2147483600 !important; }
      .acep-turn-unchecked { opacity:0.45; transition:opacity .15s ease; }
      #${SELECT_TOOLBAR_ID} {
        position:fixed; left:50%; bottom:18px; transform:translateX(-50%);
        background:#1f1b2e; color:#f8fafc; border-radius:14px; padding:10px 12px;
        z-index:2147483647; box-shadow:0 12px 30px rgba(0,0,0,.25);
        display:flex; align-items:center; gap:10px; flex-wrap:wrap;
        font:13px/1.2 "Segoe UI", Arial, sans-serif;
      }
      #${SELECT_TOOLBAR_ID} .acep-title { font-weight:700; margin-right:4px; }
      #${SELECT_TOOLBAR_ID} select {
        background:#120f1a; color:#e2e8f0; border:1px solid rgba(148,163,184,.25);
        border-radius:8px; padding:6px 8px; font-size:12px;
        min-width:140px; max-width:220px;
      }
      #${SELECT_TOOLBAR_ID} button {
        background:#7E57C2; color:#fff; border:0; border-radius:8px; padding:7px 10px;
        font-weight:600; cursor:pointer;
      }
      #${SELECT_TOOLBAR_ID} button.ghost {
        background:transparent; border:1px solid rgba(148,163,184,.35); color:#e2e8f0;
      }
      #${SELECT_TOOLBAR_ID} #acep-settings {
        padding:7px 9px; font-size:15px;
      }
      @media (max-width:640px){
        #${SELECT_TOOLBAR_ID} { width:92vw; justify-content:center; }
      }
    `;
    document.documentElement.appendChild(style);
  }
  function applyGlobalFilter(mode, turns = []) {
    const want = (mode === 'artifacts') ? 'all' : (mode || 'all');
    try { window.__acepSelectionFilter = want; } catch {}
    let anyAllowed = false;
    let claudeUserImgSet = null;
    if (want === 'images' && /claude\.ai$/i.test(HOST)) {
      try {
        const userMsgs = Array.from(document.querySelectorAll('[data-testid="user-message"]'));
        const imgs = Array.from(document.querySelectorAll('img[src*="/files/"]'));
        const set = new Set();
        const entries = [];
        userMsgs.forEach(user => entries.push({ type: 'user', node: user }));
        imgs.forEach(img => entries.push({ type: 'img', node: img.closest('button') || img }));
        entries.sort((a, b) => {
          if (a.node === b.node) return 0;
          const pos = a.node.compareDocumentPosition(b.node);
          if (pos & Node.DOCUMENT_POSITION_FOLLOWING) return -1;
          if (pos & Node.DOCUMENT_POSITION_PRECEDING) return 1;
          return 0;
        });
        for (let i = 0; i < entries.length; i++) {
          if (entries[i].type !== 'img') continue;
          let nextUser = null;
          for (let j = i + 1; j < entries.length; j++) {
            if (entries[j].type === 'user') { nextUser = entries[j].node; break; }
          }
          if (!nextUser) {
            for (let j = i - 1; j >= 0; j--) {
              if (entries[j].type === 'user') { nextUser = entries[j].node; break; }
            }
          }
          if (nextUser) set.add(nextUser);
        }
        claudeUserImgSet = set;
      } catch {}
    }
    const isClaudeArtifactNode = (turn) => {
      if (!/claude\.ai$/i.test(HOST) || !turn) return false;
      if (turn.getAttribute && turn.getAttribute('data-acep-role') === 'artifact') return true;
      try {
        if (turn.matches && turn.matches('[role="button"][aria-label="Preview contents"]')) return true;
        if (turn.querySelector) {
          if (turn.querySelector('[role="button"][aria-label="Preview contents"]')) return true;
          if (turn.querySelector('[data-acep-artifact-id],[data-acep-artifact-title],[data-acep-artifact-version]')) return true;
        }
      } catch {}
      return false;
    };
    turns.forEach(turn => {
      const chk = turn.querySelector('input[data-acep-turn-check="1"]');
      if (!chk) return;
      const role = turn.getAttribute('data-acep-role') || '';
      const isArtifact = isClaudeArtifactNode(turn);
      let hasImages = turn.getAttribute('data-acep-has-images') === '1';
      if (want === 'images' && !hasImages) {
        try {
          hasImages = !!turn.querySelector('img, source[srcset], [data-inline-src], [data-original-src], [data-acep-full], [style*="background-image"]');
          if (!hasImages && claudeUserImgSet && /claude\.ai$/i.test(HOST)) {
            const host = turn.closest && turn.closest('[data-testid="user-message"]') || turn;
            if (claudeUserImgSet.has(host)) hasImages = true;
          }
        } catch {}
      }
      let allowed = true;
      if (want === 'user') allowed = role === 'user';
      if (want === 'assistant') allowed = role === 'assistant' || role === 'artifact';
      if (want === 'images') allowed = hasImages;
      chk.checked = !!allowed;
      chk.disabled = (want !== 'all' && !allowed);
      turn.classList.toggle('acep-turn-unchecked', !chk.checked);
      if (allowed) anyAllowed = true;
    });
    if (want === 'images' && !anyAllowed) {
      turns.forEach(turn => {
        const chk = turn.querySelector('input[data-acep-turn-check="1"]');
        if (!chk) return;
        chk.checked = false;
        chk.disabled = true;
        turn.classList.add('acep-turn-unchecked');
      });
    }
  }
  function collectSelectedTurnIds(turns = []) {
    const ids = [];
    turns.forEach(turn => {
      const chk = turn.querySelector('input[data-acep-turn-check="1"]');
      if (!chk || !chk.checked) return;
      const exportIdx = turn.getAttribute('data-acep-export-idx');
      const id = exportIdx !== null ? String(exportIdx) : turn.getAttribute('data-acep-turn-id');
      if (id) ids.push(id);
    });
    return ids;
  }
  function getProviderExtraSelectableNodes() {
    try {
      const p = getProvider();
      if (p && typeof p.getArtifactNodes === 'function') return p.getArtifactNodes();
    } catch {}
    return [];
  }
  function getSelectableTurnNodes() {
    try {
      const p = requireProvider();
      if (!p) return [];
      const fn = p.getTurnsForExport || p.extractSelectableTurnNodes;
      if (typeof fn === 'function') {
        const list = fn();
        return Array.isArray(list) ? list : [];
      }
    } catch {}
    return [];
  }
  async function enterSelectionMode() {
    if (SELECT_MODE_ACTIVE || !STATE.enabled || !SUPPORTED_HOST) return;
    injectSelectionStyles();
    // DeepSeek uses a virtual list; scrolling before the toolbar is slow and visually confusing,
    // and selection is filter-driven (no per-turn IDs). Keep the page in-place and let the provider
    // do any heavy pre-scrape work during the actual export.
    if (!/deepseek\.com$/i.test(HOST)) {
      // API-first providers (Claude, Grok, Gemini, ChatGPT) fetch turns directly from the API
      // and don't need DOM pre-scrolling to load lazy turns. Skip the 5-30s scroll for them.
      const prov = getProvider();
      const isApiFirst = typeof prov?.fetchApiTurnNodesForCurrentChat === 'function';
      if (!isApiFirst) {
        try { await autoScrollForExport({ minMs: 5000, maxMs: 30000 }); } catch {}
      }
    }
    const turns = getSelectableTurnNodes();
    if (!turns.length) {
      showToast((STATE.messages?.selection_no_turns?.message) || 'No chat turns found on this page.');
      return;
    }
    SELECT_MODE_ACTIVE = true;
    const normKey = (txt = '') => String(txt || '').replace(/\s+/g, ' ').trim().toLowerCase().slice(0, 200);
    const exportTurns = getTurnNodes();
    const exportKeys = exportTurns.map((t, idx) => {
      let html = '';
      try { html = innerHTMLFromTurn(t) || ''; } catch {}
      const text = normKey(htmlToPlainText(html || ''));
      const role = roleFromTurn(t) || '';
      const topIdx = t?.getAttribute ? t.getAttribute('data-acep-top-idx') : null;
      return { node: t, idx, role, text, topIdx: topIdx !== null ? String(topIdx) : null };
    });
    const usedExport = new Set();
      const roleQueues = (() => {
        try {
          const p = getProvider();
          if (p && typeof p.getSelectionRoleQueues === 'function') {
            const q = p.getSelectionRoleQueues(exportKeys);
            if (q && Array.isArray(q.user) && Array.isArray(q.assistant)) return q;
          }
        } catch {}
        return null;
      })();
      const rolePos = { user: 0, assistant: 0 };
      const mapSelectableId = (turn, idx) => {
        const role = roleFromTurn(turn) || '';
        if (role === 'artifact' || turn.getAttribute('data-acep-role') === 'artifact') return;
        if (roleQueues && (role === 'user' || role === 'assistant')) {
          const queue = roleQueues[role] || [];
          let pos = rolePos[role] || 0;
          while (pos < queue.length && usedExport.has(queue[pos])) pos++;
          if (pos < queue.length) {
            const hitIdx = queue[pos];
            rolePos[role] = pos + 1;
            usedExport.add(hitIdx);
            try { turn.setAttribute('data-acep-export-idx', String(hitIdx)); } catch {}
            try { turn.setAttribute('data-acep-role', role); } catch {}
            return;
          }
          // If provider gave role queues, do not attempt fuzzy matching (prevents dupes).
          return;
        }
      const text = normKey(turn.innerText || turn.textContent || '');
      let match = null;
      if (turn && turn.isConnected) {
        match = exportKeys.find((k) => {
          if (!k.node || !k.node.isConnected) return false;
          if (usedExport.has(k.idx)) return false;
          try {
            if (k.node === turn) return true;
            if (k.node.contains && k.node.contains(turn)) return true;
            if (turn.contains && turn.contains(k.node)) return true;
          } catch {}
          return false;
        });
      }
      if (role || text) {
        match = match || exportKeys.find((k) => {
          if (usedExport.has(k.idx)) return false;
          if (role && k.role && k.role !== role) return false;
          if (!text || !k.text) return false;
          return k.text === text;
        });
      }
      if (!match && idx < exportKeys.length && !usedExport.has(idx)) {
        match = exportKeys[idx];
      }
      if (match) {
        usedExport.add(match.idx);
        try { turn.setAttribute('data-acep-export-idx', String(match.idx)); } catch {}
        try { turn.setAttribute('data-acep-role', role || match.role || turn.getAttribute('data-acep-role') || ''); } catch {}
      }
    };
    const decorateTurn = (turn, idx) => {
      try {
        if (!(turn instanceof Element)) return;
        mapSelectableId(turn, idx);
        if (!turn.getAttribute('data-acep-turn-id')) turn.setAttribute('data-acep-turn-id', String(idx));
        const role = roleFromTurn(turn) || 'assistant';
        turn.setAttribute('data-acep-role', role);
        if (role !== 'artifact' && !turn.getAttribute('data-acep-export-idx')) {
          turn.setAttribute('data-acep-export-idx', String(idx));
        }
        let hasImages = false;
        try { hasImages = imagesFromTurn(turn).length > 0; } catch {}
        turn.setAttribute('data-acep-has-images', hasImages ? '1' : '0');
        if (!turn.querySelector('input[data-acep-turn-check="1"]')) {
          const prevPos = (turn.style && turn.style.position) || '';
          if (!prevPos) turn.setAttribute('data-acep-prev-pos', '');
          if (getComputedStyle(turn).position === 'static') {
            turn.setAttribute('data-acep-prev-pos', prevPos);
            turn.style.position = 'relative';
          }
          // Some sites (notably DeepSeek) wrap turns in overflow-hidden containers, which can clip our checkbox label.
          try {
            const prevOverflow = (turn.style && turn.style.overflow) || '';
            if (!prevOverflow) turn.setAttribute('data-acep-prev-overflow', '');
            const cs = getComputedStyle(turn);
            if ((cs.overflow || '').toLowerCase() === 'hidden' || (cs.overflowY || '').toLowerCase() === 'hidden') {
              turn.setAttribute('data-acep-prev-overflow', prevOverflow);
              turn.style.overflow = 'visible';
            }
          } catch {}
          const wrap = document.createElement('label');
          wrap.className = 'acep-turn-check';
          try { wrap.style.zIndex = '2147483647'; } catch {}
          const input = document.createElement('input');
          input.type = 'checkbox';
          input.checked = true;
          input.setAttribute('data-acep-turn-check', '1');
          input.addEventListener('change', () => {
            turn.classList.toggle('acep-turn-unchecked', !input.checked);
          });
          const span = document.createElement('span');
          const labelKey = role === 'user' ? 'selection_label_prompt' : 'selection_label_response';
          span.textContent = (STATE.messages?.[labelKey]?.message) || (role === 'user' ? 'Prompt' : 'Response');
          wrap.appendChild(input);
          wrap.appendChild(span);
          turn.appendChild(wrap);
        }
      } catch {}
    };
    const decorateArtifact = (node, idx) => {
      try {
        if (!(node instanceof Element)) return;
        if (!node.getAttribute('data-acep-turn-id')) node.setAttribute('data-acep-turn-id', `artifact-${idx}`);
        node.setAttribute('data-acep-role', 'artifact');
        if (!node.querySelector('input[data-acep-turn-check="1"]')) {
          let offsetTop = '';
          try {
            const asst = node.closest('[data-acep-role="assistant"]');
            if (asst) {
              // If the assistant turn is only the artifact card, remove its checkbox to avoid overlap.
              const clone = asst.cloneNode(true);
              clone.querySelectorAll('[role="button"][aria-label="Preview contents"], .artifact-block-cell, [data-testid*="artifact" i]').forEach(n => n.remove());
              clone.querySelectorAll('label.acep-turn-check').forEach(n => n.remove());
              const remainingText = (clone.innerText || clone.textContent || '').trim();
              if (!remainingText) {
                asst.querySelectorAll('label.acep-turn-check').forEach(n => n.remove());
              } else {
                offsetTop = '34px';
              }
            }
          } catch {}
          const prevPos = (node.style && node.style.position) || '';
          if (!prevPos) node.setAttribute('data-acep-prev-pos', '');
          if (getComputedStyle(node).position === 'static') {
            node.setAttribute('data-acep-prev-pos', prevPos);
            node.style.position = 'relative';
          }
          const wrap = document.createElement('label');
          wrap.className = 'acep-turn-check';
          if (offsetTop) {
            wrap.style.top = offsetTop;
            wrap.style.right = '10px';
          }
          const input = document.createElement('input');
          input.type = 'checkbox';
          input.checked = true;
          input.setAttribute('data-acep-turn-check', '1');
          input.addEventListener('change', () => {
            node.classList.toggle('acep-turn-unchecked', !input.checked);
          });
          const span = document.createElement('span');
          span.textContent = (STATE.messages?.selection_label_artifact?.message) || 'Artifact';
          wrap.appendChild(input);
          wrap.appendChild(span);
          node.appendChild(wrap);
        }
      } catch {}
    };
    turns.forEach((turn, idx) => decorateTurn(turn, idx));
    if (/claude\.ai$/i.test(HOST)) {
      const artifacts = getProviderExtraSelectableNodes();
      artifacts.forEach((node, idx) => decorateArtifact(node, idx));
      turns.push(...artifacts);
    }
    let bar = document.getElementById(SELECT_TOOLBAR_ID);
    if (bar) bar.remove();
    bar = document.createElement('div');
    bar.id = SELECT_TOOLBAR_ID;
    const t = (k, d) => (STATE.messages?.[k]?.message) || browser.i18n.getMessage(k) || d || '';
    const title = document.createElement('span');
    title.className = 'acep-title';
    title.textContent = t('selection_toolbar_title', 'Select messages');
    const filterSel = document.createElement('select');
    filterSel.id = 'acep-filter';
    [
      { value: 'all', label: t('selection_filter_all', 'All messages') },
      { value: 'user', label: t('selection_filter_prompts', 'Prompts only') },
      { value: 'assistant', label: t('selection_filter_responses', 'Responses only') },
      { value: 'images', label: t('selection_filter_images', 'Images only') },
    ].forEach((opt) => {
      const option = document.createElement('option');
      option.value = opt.value;
      option.textContent = opt.label;
      filterSel.appendChild(option);
    });
    const exportBtn = document.createElement('button');
    exportBtn.id = 'acep-export';
    exportBtn.textContent = t('selection_export_btn', 'Export');
    const settingsBtn = document.createElement('button');
    settingsBtn.id = 'acep-settings';
    settingsBtn.className = 'ghost';
    settingsBtn.title = t('sidebar_settings', 'Settings');
    settingsBtn.innerHTML = '&#9881;';
    const cancelBtn = document.createElement('button');
    cancelBtn.id = 'acep-cancel';
    cancelBtn.className = 'ghost';
    cancelBtn.textContent = t('selection_cancel_btn', 'Cancel');
    bar.append(title, filterSel, exportBtn, settingsBtn, cancelBtn);
    document.documentElement.appendChild(bar);
    filterSel?.addEventListener('change', () => {
      const mode = filterSel.value;
      try { window.__acepSelectionFilter = mode; } catch {}
      applyGlobalFilter(mode, turns);
    });
    cancelBtn?.addEventListener('click', () => exitSelectionMode());

    // Settings button: opens popup in settings-only mode (no auto-export)
    settingsBtn?.addEventListener('click', () => {
      exitSelectionMode(true);
      openPopupOverlay();
    });

    exportBtn?.addEventListener('click', async () => {
      const isDeepSeekHost = /deepseek\.com$/i.test(HOST);
      const selectedIds = isDeepSeekHost ? null : collectSelectedTurnIds(turns);
      if (!isDeepSeekHost && !selectedIds.length) {
        showToast(t('selection_none', 'Select at least one message to export.'));
        return;
      }
      try {
        window.__acepSelectedTurnIds = isDeepSeekHost ? null : selectedIds.slice();
        window.__acepSelectionFilter = filterSel?.value || 'all';
      } catch {}
      exitSelectionMode(true);
      const source = await getExportSourceContext();
      const frame = openPopupOverlay();
      const sendSelection = () => {
        try {
          try { console.log('[ACEP content] sending ACEP_SELECTION_SET to iframe', { exportSessionId: source.exportSessionId, autoExport: true }); } catch {}
          frame.contentWindow.postMessage({
            type: 'ACEP_SELECTION_SET',
            ...source,
            selectedTurnIds: isDeepSeekHost ? null : selectedIds,
            selectionFilter: filterSel?.value || 'all',
            autoExport: true,
          }, '*');
        } catch {}
      };
      if (frame && frame.contentWindow) {
        if (frame.dataset.ready === '1') sendSelection();
        else frame.addEventListener('load', sendSelection, { once: true });
      }
    });
    applyGlobalFilter('all', turns);
    const refreshSelection = async () => {
      try {
        const isDeepSeekHost = /deepseek\.com$/i.test(HOST);
        // DeepSeek uses a virtual list that recycles nodes; prune disconnected nodes and re-decorate
        // currently mounted turns on every refresh (not only newly discovered nodes).
        if (isDeepSeekHost) {
          for (let i = turns.length - 1; i >= 0; i--) {
            const t = turns[i];
            if (!t || !t.isConnected) turns.splice(i, 1);
          }
        }
        const existing = new Set(turns);
        const fresh = getSelectableTurnNodes();
        let added = false;
        fresh.forEach((t, i) => {
          if (!t) return;
          if (isDeepSeekHost) {
            if (!t.querySelector || !t.querySelector('input[data-acep-turn-check="1"]')) {
              decorateTurn(t, i);
            }
            if (!existing.has(t)) {
              turns.push(t);
              added = true;
            }
            return;
          }
          if (existing.has(t)) return;
          turns.push(t);
          decorateTurn(t, i);
          added = true;
        });
        if (/claude\.ai$/i.test(HOST)) {
          const artifacts = getProviderExtraSelectableNodes();
          artifacts.forEach((node, idx) => {
            if (!node || existing.has(node)) return;
            turns.push(node);
            decorateArtifact(node, idx);
            added = true;
          });
        }
        if (added || isDeepSeekHost) {
          const currentMode = filterSel?.value || 'all';
          applyGlobalFilter(currentMode, turns);
        }
      } catch {}
    };
    if (/deepseek\.com$/i.test(HOST)) {
      try {
        if (ACEP_SELECT_SCROLL_EL && ACEP_SELECT_SCROLL_HANDLER) {
          ACEP_SELECT_SCROLL_EL.removeEventListener('scroll', ACEP_SELECT_SCROLL_HANDLER);
        }
      } catch {}
      try {
        // DeepSeek scrolls inside a virtual-list container; documentElement scroll events won't fire.
        // Prefer the virtual list itself, then the last autoscroll target, then the document scroller.
        ACEP_SELECT_SCROLL_EL =
          document.querySelector('.ds-virtual-list') ||
          ACEP_LAST_AUTOSCROLL_EL ||
          document.scrollingElement ||
          document.documentElement;
        let t = null;
        ACEP_SELECT_SCROLL_HANDLER = () => {
          if (t) return;
          t = setTimeout(() => {
            t = null;
            refreshSelection();
          }, 120);
        };
        ACEP_SELECT_SCROLL_EL?.addEventListener?.('scroll', ACEP_SELECT_SCROLL_HANDLER, { passive: true });
        // Initial refresh bursts to pick up turns that mount slightly after the toolbar shows.
        setTimeout(() => { try { refreshSelection(); } catch {} }, 120);
        setTimeout(() => { try { refreshSelection(); } catch {} }, 420);
        setTimeout(() => { try { refreshSelection(); } catch {} }, 900);
      } catch {}
    }
    setTimeout(() => { refreshSelection(); }, 900);
    setTimeout(() => { refreshSelection(); }, 1800);
  }
  function exitSelectionMode(keepSelection = false) {
    SELECT_MODE_ACTIVE = false;
    try {
      if (ACEP_SELECT_SCROLL_EL && ACEP_SELECT_SCROLL_HANDLER) {
        ACEP_SELECT_SCROLL_EL.removeEventListener('scroll', ACEP_SELECT_SCROLL_HANDLER);
      }
    } catch {}
    ACEP_SELECT_SCROLL_EL = null;
    ACEP_SELECT_SCROLL_HANDLER = null;
    if (!keepSelection) {
      try { window.__acepSelectedTurnIds = null; } catch {}
      try { window.__acepSelectionFilter = null; } catch {}
    }
    const bar = document.getElementById(SELECT_TOOLBAR_ID);
    if (bar) bar.remove();
    const turns = getSelectableTurnNodes().concat(getProviderExtraSelectableNodes());
    turns.forEach(turn => {
      try {
        turn.querySelectorAll('label.acep-turn-check').forEach(el => el.remove());
        turn.classList.remove('acep-turn-unchecked');
        const prevPos = turn.getAttribute('data-acep-prev-pos');
        if (prevPos !== null) {
          turn.style.position = prevPos;
          turn.removeAttribute('data-acep-prev-pos');
        }
        const prevOverflow = turn.getAttribute('data-acep-prev-overflow');
        if (prevOverflow !== null) {
          turn.style.overflow = prevOverflow;
          turn.removeAttribute('data-acep-prev-overflow');
        }
      } catch {}
    });
  }
  const ONBOARDING_VERSION_KEY = 'acep_onboarding_seen_version';
  const ONBOARDING_REMIND_KEY = 'acep_onboarding_remind_after';
  const ONBOARDING_CURRENT_VERSION = (() => {
    try { return browser.runtime?.getManifest?.()?.version || '2026-07-walkthrough'; } catch { return '2026-07-walkthrough'; }
  })();
  const ONBOARDING_HOST_ID = 'acep-onboarding-host';
  let ACEP_TOUR = { active: false, step: 0, returning: false };

  function getAcepTourStrings() {
    const tr = (key, fallback) => {
      try { return (STATE.messages?.[key]?.message) || browser.i18n.getMessage(key) || fallback || key; } catch { return fallback || key; }
    };
    return {
      updateTitle: tr('tour_welcome_update_title', 'Thanks for sticking with AIChatExporterPro'),
      updateBody: tr('tour_welcome_update_body', 'AIChatExporterPro has a cleaner export flow, better sidebar controls, stronger PDF/HTML handling, and many fixes since the previous version. Thanks for your patience.'),
      newTitle: tr('tour_welcome_new_title', 'Welcome to AIChatExporterPro'),
      newBody: tr('tour_welcome_new_body', 'Export your AI chats by opening the export sidebar, choosing messages, editing the file name, selecting a format, and starting the export.'),
      start: tr('tour_btn_show_me', 'Show me'),
      walk: tr('tour_btn_walk_me_through', 'Walk me through'),
      later: tr('tour_btn_remind_later', 'Remind me later'),
      skip: tr('tour_btn_do_not_show_again', 'Do not show again'),
      next: tr('tour_btn_next', 'Next'),
      prev: tr('tour_btn_previous', 'Previous'),
      done: tr('tour_btn_done', 'Done'),
      close: tr('tour_btn_close', 'Close'),
      settingsPromptTitle: tr('tour_settings_prompt_title', 'Want a quick settings tour?'),
      settingsPromptBody: tr('tour_settings_prompt_body', 'You can also learn where language, loading-screen behavior, branding, page options, and provider controls live.'),
      settingsPromptOpen: tr('tour_settings_prompt_open', 'Open settings tour'),
      steps: [
        { target: 'exportButton', title: tr('tour_main_start_title', 'Start here'), body: tr('tour_main_start_body', 'Use this Export button to open the export sidebar. You can drag it anywhere on the page.') },
        { target: 'fileName', title: tr('tour_main_filename_title', 'Edit the file name'), body: tr('tour_main_filename_body', 'The file name comes from the chat title. You can edit it before exporting.') },
        { target: 'rows', title: tr('tour_main_messages_title', 'Choose messages'), body: tr('tour_main_messages_body', 'Select the exact messages you want to export. The selected counter shows how many will be included.') },
        { target: 'tabs', title: tr('tour_main_filters_title', 'Filter faster'), body: tr('tour_main_filters_body', 'Use All, Response, Prompt, Images, or None to quickly control what is selected.') },
        { target: 'format', title: tr('tour_main_format_title', 'Pick a format'), body: tr('tour_main_format_body', 'Choose PDF, HTML, PNG, DOCX, Markdown, JSON, TXT, or CSV depending on what you need.') },
        { target: 'exportNow', title: tr('tour_main_export_title', 'Run the export'), body: tr('tour_main_export_body', 'Click Export when you are ready. Large chats and image-heavy PDFs may take longer because images are prepared safely.') },
        { target: 'settings', title: tr('tour_main_settings_title', 'More options'), body: tr('tour_main_settings_body', 'Open Settings for language, loading-screen behavior, branding, page options, and provider-specific controls.') },
      ],
    };
  }
  async function getStorageSnapshot() {
    try { return await browser.storage?.local?.get?.(null) || {}; } catch { return {}; }
  }

  function hasPriorAcepState(snapshot = {}) {
    try {
      return Object.keys(snapshot || {}).some((key) => /^acep_|^(enabled|lang|removeBranding|muteExport|muteDownload|advancedOptions)$/i.test(key) && key !== ONBOARDING_VERSION_KEY && key !== ONBOARDING_REMIND_KEY);
    } catch { return false; }
  }

  async function markOnboardingSeen() {
    try { await browser.storage?.local?.set?.({ [ONBOARDING_VERSION_KEY]: ONBOARDING_CURRENT_VERSION }); } catch {}
  }

  async function remindOnboardingLater() {
    try { await browser.storage?.local?.set?.({ [ONBOARDING_REMIND_KEY]: Date.now() + 24 * 60 * 60 * 1000 }); } catch {}
  }

  function removeOnboardingHost() {
    try { document.getElementById(ONBOARDING_HOST_ID)?.remove(); } catch {}
    ACEP_TOUR.active = false;
  }

  function createOnboardingHost() {
    let host = document.getElementById(ONBOARDING_HOST_ID);
    const mount = document.body || document.documentElement;
    if (host) {
      try { mount.appendChild(host); } catch {}
      try { host.style.zIndex = '2147483647'; } catch {}
      return host;
    }
    host = document.createElement('div');
    host.id = ONBOARDING_HOST_ID;
    host.style.position = 'fixed';
    host.style.inset = '0';
    host.style.zIndex = '2147483647';
    host.style.pointerEvents = 'none';
    mount.appendChild(host);
    host.attachShadow({ mode: 'open' });
    return host;
  }

  function onboardingBaseCss() {
    return `
      :host{all:initial}
      .shade{position:fixed;inset:0;background:rgba(17,24,39,.30);pointer-events:auto;}
      .spot{position:fixed;border:3px solid #a78bfa;border-radius:14px;box-shadow:0 0 0 9999px rgba(17,24,39,.42),0 14px 40px rgba(81,45,168,.28);pointer-events:none;transition:all .16s ease;}
      .card{position:fixed;max-width:360px;width:min(360px,calc(100vw - 28px));background:#fff;color:#1f2937;border:1px solid #ddd6fe;border-radius:16px;box-shadow:0 18px 60px rgba(17,24,39,.24);font-family:"Segoe UI",Inter,Arial,sans-serif;pointer-events:auto;overflow:hidden;}
      .head{padding:14px 16px 8px;font-weight:900;font-size:16px;color:#4c1d95;line-height:1.25;}
      .body{padding:0 16px 14px;font-size:13px;line-height:1.5;color:#374151;}
      .actions{display:flex;gap:8px;justify-content:flex-end;align-items:center;padding:12px 14px;background:#f8f4ff;border-top:1px solid #ede9fe;flex-wrap:wrap;}
      button{border:1px solid #c4b5fd;background:#fff;color:#5b21b6;border-radius:999px;padding:8px 12px;font-weight:800;font-size:12px;cursor:pointer;font-family:inherit;}
      button.primary{background:linear-gradient(135deg,#7E57C2,#512DA8);border-color:#7E57C2;color:#fff;}
      button.ghost{border-color:transparent;background:transparent;color:#6b7280;}
      .progress{margin-right:auto;color:#7c3aed;font-weight:800;font-size:12px;}
      @media(max-width:640px){.card{left:14px!important;right:14px!important;top:auto!important;bottom:18px!important;width:auto}.spot{display:none}.shade{background:rgba(17,24,39,.18)}}
    `;
  }

  function getTourTarget(step) {
    try {
      const name = step?.target;
      if (name === 'exportButton') return document.getElementById(`${BTN_ID}-host`) || null;
      const sidebarHost = document.getElementById(SIDEBAR_HOST_ID);
      const shadow = sidebarHost?.shadowRoot;
      if (!shadow) return null;
      if (name === 'fileName') return shadow.getElementById('acep-filename');
      if (name === 'rows') return shadow.getElementById('acep-rows');
      if (name === 'tabs') return shadow.querySelector('.tabs');
      if (name === 'format') return shadow.getElementById('acep-format');
      if (name === 'exportNow') return shadow.getElementById('acep-export');
      if (name === 'settings') return shadow.getElementById('acep-settings');
    } catch {}
    return null;
  }

  function positionTourCard(card, rect) {
    try {
      const vw = window.innerWidth || 1024;
      const vh = window.innerHeight || 768;
      const width = Math.min(360, vw - 28);
      let left = rect ? rect.left : vw - width - 18;
      let top = rect ? rect.bottom + 14 : 90;
      if (rect && rect.right + width + 18 < vw) {
        left = rect.right + 16;
        top = Math.max(18, rect.top);
      }
      if (left + width > vw - 14) left = vw - width - 14;
      if (left < 14) left = 14;
      if (top > vh - 210) top = Math.max(18, (rect ? rect.top : vh - 230) - 190);
      card.style.left = `${Math.round(left)}px`;
      card.style.top = `${Math.round(top)}px`;
    } catch {}
  }

  async function showTourStep(index = 0) {
    const strings = getAcepTourStrings();
    const steps = strings.steps;
    ACEP_TOUR.active = true;
    ACEP_TOUR.step = clamp(index, 0, steps.length - 1);
    const step = steps[ACEP_TOUR.step];
    if (ACEP_TOUR.step > 0 && !isSidebarOpen()) {
      try { await openExportSidebar(); } catch {}
      await new Promise((resolve) => setTimeout(resolve, 260));
    }
    const host = createOnboardingHost();
    const shadow = host.shadowRoot;
    const target = getTourTarget(step);
    const rect = target?.getBoundingClientRect?.();
    const hasRect = rect && rect.width > 0 && rect.height > 0;
    shadow.innerHTML = `
      <style>${onboardingBaseCss()}</style>
      <div class="shade" id="tour-shade"></div>
      ${hasRect ? `<div class="spot" id="tour-spot"></div>` : ''}
      <div class="card" id="tour-card" role="dialog" aria-live="polite">
        <div class="head">${escapeHtml(step.title)}</div>
        <div class="body">${escapeHtml(step.body)}</div>
        <div class="actions">
          <span class="progress">${ACEP_TOUR.step + 1}/${steps.length}</span>
          <button class="ghost" id="tour-skip">${escapeHtml(strings.close)}</button>
          ${ACEP_TOUR.step > 0 ? `<button id="tour-prev">${escapeHtml(strings.prev)}</button>` : ''}
          <button class="primary" id="tour-next">${escapeHtml(ACEP_TOUR.step === steps.length - 1 ? strings.done : strings.next)}</button>
        </div>
      </div>
    `;
    const spot = shadow.getElementById('tour-spot');
    if (spot && hasRect) {
      spot.style.left = `${Math.max(8, rect.left - 8)}px`;
      spot.style.top = `${Math.max(8, rect.top - 8)}px`;
      spot.style.width = `${Math.max(24, rect.width + 16)}px`;
      spot.style.height = `${Math.max(24, rect.height + 16)}px`;
    }
    const card = shadow.getElementById('tour-card');
    positionTourCard(card, hasRect ? rect : null);
    shadow.getElementById('tour-skip')?.addEventListener('click', async () => {
      await markOnboardingSeen();
      removeOnboardingHost();
    });
    shadow.getElementById('tour-prev')?.addEventListener('click', () => { showTourStep(ACEP_TOUR.step - 1); });
    shadow.getElementById('tour-next')?.addEventListener('click', async () => {
      if (ACEP_TOUR.step >= steps.length - 1) {
        await showSettingsTourPrompt();
        return;
      }
      showTourStep(ACEP_TOUR.step + 1);
    });
  }

  async function showOnboardingWelcome(returningUser = false) {
    const strings = getAcepTourStrings();
    const host = createOnboardingHost();
    const shadow = host.shadowRoot;
    const title = returningUser ? strings.updateTitle : strings.newTitle;
    const body = returningUser ? strings.updateBody : strings.newBody;
    shadow.innerHTML = `
      <style>${onboardingBaseCss()}</style>
      <div class="shade"></div>
      <div class="card" id="welcome-card" role="dialog" aria-live="polite">
        <div class="head">${escapeHtml(title)}</div>
        <div class="body">${escapeHtml(body)}</div>
        <div class="actions">
          <button class="ghost" id="welcome-skip">${escapeHtml(strings.skip)}</button>
          <button id="welcome-later">${escapeHtml(strings.later)}</button>
          <button class="primary" id="welcome-start">${escapeHtml(returningUser ? strings.start : strings.walk)}</button>
        </div>
      </div>
    `;
    const card = shadow.getElementById('welcome-card');
    try {
      card.style.right = '18px';
      card.style.bottom = '18px';
    } catch {}
    shadow.getElementById('welcome-start')?.addEventListener('click', () => showTourStep(0));
    shadow.getElementById('welcome-later')?.addEventListener('click', async () => {
      await remindOnboardingLater();
      removeOnboardingHost();
    });
    shadow.getElementById('welcome-skip')?.addEventListener('click', async () => {
      await markOnboardingSeen();
      removeOnboardingHost();
    });
  }

  async function showSettingsTourPrompt() {
    const host = createOnboardingHost();
    const shadow = host.shadowRoot;
    shadow.innerHTML = `
      <style>${onboardingBaseCss()}</style>
      <div class="shade"></div>
      <div class="card" id="settings-tour-card" role="dialog" aria-live="polite">
        <div class="head">Want a quick Settings walkthrough?</div>
        <div class="body">Settings contains language, loading-screen behavior, branding, provider options, and the Save button. You can continue there now or finish here.</div>
        <div class="actions">
          <button class="ghost" id="settings-tour-done">${escapeHtml(strings.done)}</button>
          <button class="primary" id="settings-tour-open">${escapeHtml(strings.settingsPromptOpen)}</button>
        </div>
      </div>
    `;
    const card = shadow.getElementById('settings-tour-card');
    try { card.style.right = '18px'; card.style.bottom = '18px'; } catch {}
    shadow.getElementById('settings-tour-done')?.addEventListener('click', async () => {
      await markOnboardingSeen();
      removeOnboardingHost();
    });
    shadow.getElementById('settings-tour-open')?.addEventListener('click', async () => {
      try { await browser.storage?.local?.set?.({ acep_settings_tour_pending: true }); } catch {}
      await markOnboardingSeen();
      removeOnboardingHost();
      try { browser.runtime.sendMessage({ type: 'ACEP_OPEN_SETTINGS', settingsTour: true }); } catch {}
    });
  }
  async function maybeShowOnboarding() {
    try {
      if (!STATE.enabled || !SUPPORTED_HOST) return;
      if (document.getElementById(ONBOARDING_HOST_ID)) return;
      const snapshot = await getStorageSnapshot();
      if (snapshot?.[ONBOARDING_VERSION_KEY] === ONBOARDING_CURRENT_VERSION) return;
      const remindAfter = Number(snapshot?.[ONBOARDING_REMIND_KEY] || 0);
      if (remindAfter && Date.now() < remindAfter) return;
      await showOnboardingWelcome(hasPriorAcepState(snapshot));
    } catch {}
  }
  function injectExportButton() {
    if (!STATE.enabled || !SUPPORTED_HOST) { removeExportButton(); return; }
    const mount = document.body || document.documentElement;
    if (!mount) return;
    // Render inside a shadow host to avoid React hydration issues on the page
    const hostId = `${BTN_ID}-host`;
    let host = document.getElementById(hostId);
    if (!host) {
      host = document.createElement('div');
      host.id = hostId;
      host.style.position = 'fixed';
      host.style.right = '18px';
      host.style.bottom = '18px';
      host.style.zIndex = '2147483647';
      host.style.pointerEvents = 'none';
      mount.appendChild(host);
    }
    try { applyStoredExportButtonPosition(host); } catch {}
    const shadow = host.shadowRoot || host.attachShadow({ mode: 'open' });
    shadow.innerHTML = '';

    const style = document.createElement('style');
    style.textContent = `
      :host { all: initial; }
      button {
        pointer-events: auto;
        padding: 10px 14px;
        border-radius: 10px;
        background: #7E57C2;
        color: #fff;
        font-weight: 600;
        border: none;
        box-shadow: 0 6px 16px rgba(0,0,0,.15);
        cursor: pointer;
        font-family: "Segoe UI", Arial, sans-serif;
        font-size: 13px;
        opacity: 0.92;
        transition: opacity .15s ease, transform .15s ease;
        user-select: none;
        touch-action: none;
      }
      button:hover { opacity: 1; transform: translateY(-1px); }
      button:active { transform: translateY(0); }
      button:focus { outline: 2px solid rgba(255,255,255,.6); outline-offset: 2px; }
      button[disabled] { opacity: 0.65; cursor: not-allowed; transform: none; }
    `;

    const btn = document.createElement('button');
    btn.id = BTN_ID;
    btn.textContent = currentLabelExport();
    let dragState = null;
    btn.addEventListener('pointerdown', (event) => {
      try {
        if (event.button !== 0) return;
        const rect = host.getBoundingClientRect();
        dragState = {
          startX: event.clientX,
          startY: event.clientY,
          left: rect.left,
          top: rect.top,
          moved: false,
        };
        host.style.left = `${rect.left}px`;
        host.style.top = `${rect.top}px`;
        host.style.right = 'auto';
        host.style.bottom = 'auto';
        btn.setPointerCapture?.(event.pointerId);
        event.preventDefault();
      } catch {}
    });
    btn.addEventListener('pointermove', (event) => {
      try {
        if (!dragState) return;
        const dx = event.clientX - dragState.startX;
        const dy = event.clientY - dragState.startY;
        if (Math.abs(dx) > 3 || Math.abs(dy) > 3) dragState.moved = true;
        const rect = host.getBoundingClientRect();
        const maxLeft = Math.max(8, (window.innerWidth || 800) - (rect.width || 90) - 8);
        const maxTop = Math.max(8, (window.innerHeight || 600) - (rect.height || 40) - 8);
        host.style.left = `${clamp(dragState.left + dx, 8, maxLeft)}px`;
        host.style.top = `${clamp(dragState.top + dy, 8, maxTop)}px`;
        event.preventDefault();
      } catch {}
    });
    btn.addEventListener('pointerup', async (event) => {
      try {
        if (!dragState) return;
        const moved = !!dragState.moved;
        dragState = null;
        btn.releasePointerCapture?.(event.pointerId);
        if (moved) {
          const rect = host.getBoundingClientRect();
          btn.dataset.acepSuppressClick = '1';
          setTimeout(() => { try { delete btn.dataset.acepSuppressClick; } catch {} }, 80);
          await setLocalSetting(EXPORT_BUTTON_POS_KEY, { left: Math.round(rect.left), top: Math.round(rect.top) });
          event.preventDefault();
        }
      } catch {
        dragState = null;
      }
    });
    btn.addEventListener('pointercancel', () => { dragState = null; });
    btn.addEventListener('click', async (event) => {
      if (btn.dataset.acepSuppressClick === '1') {
        event.preventDefault();
        return;
      }
      if (ACEP_RENDER_BUSY) {
        alert(
          (STATE.messages?.busy_alert?.message) ||
          browser.i18n.getMessage('busy_alert') ||
          'Export in progressÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¾Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¦ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¦ Please wait.'
        );
        return;
      }
      // Sidebar-first UX: always open the sidebar (no on-page checkbox toolbar).
      try { await openExportSidebar(); } catch {}
    });

    shadow.appendChild(style);
    shadow.appendChild(btn);
  }

  function closeExportSidebar() {
    try {
      const host = document.getElementById(SIDEBAR_HOST_ID);
      if (host) host.remove();
    } catch {}
  }

  function isSidebarOpen() {
    try { return !!document.getElementById(SIDEBAR_HOST_ID); } catch { return false; }
  }

  function getSidebarStrings() {
    const t = (k, d) => (STATE.messages?.[k]?.message) || browser.i18n.getMessage(k) || d || '';
    return {
      title: t('selection_toolbar_title', 'Select messages'),
      feedback: t('sidebar_feedback', 'Support'),
      tabAll: t('selection_filter_all', 'All'),
      tabUser: t('selection_filter_prompts', 'Prompt'),
      tabAsst: t('selection_filter_responses', 'Response'),
      tabImages: t('selection_filter_images', 'Images only'),
      tabArtifacts: t('selection_filter_artifacts', 'Artifacts'),
      selected: t('sidebar_selected', 'selected'),
      loadingTurns: t('sidebar_loading_turns', 'Loading turns'),
      fileNameLabel: t('label_file_name', 'File name'),
      cancel: t('selection_cancel_btn', 'Cancel'),
      export: t('selection_export_btn', 'Export'),
      settings: t('sidebar_settings', 'Settings'),
      tabNone: t('selection_filter_none', 'None'),
      resize: t('sidebar_resize', 'Resize'),
      progressIdle: t('sidebar_progress_idle', 'Ready'),
      pillUser: t('sidebar_pill_user', 'Question'),
      pillAsst: t('sidebar_pill_asst', 'Answer'),
      pillMsg: t('sidebar_pill_msg', 'Message'),
      pillArtifact: t('sidebar_pill_artifact', 'Artifact'),
      noneSelected: t('selection_none', 'Select at least one message to export.'),
      chatgptApiFailedTitle: t('chatgpt_api_failed_title', 'ChatGPT export unavailable'),
      chatgptApiFailedBodyGeneric: t('chatgpt_api_failed_body_generic', 'The ChatGPT API request failed. Reload this page and try again.'),
      chatgptApiFailedReload: t('chatgpt_api_failed_reload', 'Reload page'),
      chatgptApiFailedClose: t('chatgpt_api_failed_close', 'Close'),
      chatgptApiFailedToast: t('chatgpt_api_failed_toast', 'ChatGPT API failed. Reload the page and try again.'),
      chatgptApiFailedProgress: t('chatgpt_api_failed_progress', 'ChatGPT API failed'),
      deepseekApiFailedTitle: t('deepseek_api_failed_title', 'DeepSeek export unavailable'),
      apiFailedBodyNetwork: t('api_failed_body_network', 'The API request failed. Reload this page and try again.'),
      deepseekApiFailedBodyNetwork: t('api_failed_body_network', 'The API request failed. Reload this page and try again.'),
      deepseekApiFailedBodyGeneric: t('deepseek_api_failed_body_generic', 'The DeepSeek API request failed. Reload this page and try again. (We do not fall back to DOM on DeepSeek to avoid partial exports.)'),
      deepseekApiFailedReload: t('deepseek_api_failed_reload', 'Reload page'),
      deepseekApiFailedClose: t('deepseek_api_failed_close', 'Close'),
      deepseekApiFailedToast: t('deepseek_api_failed_toast', 'DeepSeek API failed. Reload the page and try again.'),
      deepseekApiFailedProgress: t('deepseek_api_failed_progress', 'DeepSeek API failed'),
      geminiApiFailedTitle: t('gemini_api_failed_title', 'Gemini export unavailable'),
      geminiApiFailedBodyNetwork: t('api_failed_body_network', 'The API request failed. Reload this page and try again.'),
      geminiApiFailedBodyGeneric: t('gemini_api_failed_body_generic', 'The Gemini API request failed. Reload this page and try again. (We do not fall back to DOM on Gemini to avoid partial exports.)'),
      geminiApiFailedReload: t('gemini_api_failed_reload', 'Reload page'),
      geminiApiFailedClose: t('gemini_api_failed_close', 'Close'),
      geminiApiFailedToast: t('gemini_api_failed_toast', 'Gemini API failed. Reload the page and try again.'),
      geminiApiFailedProgress: t('gemini_api_failed_progress', 'Gemini API failed'),
      claudeApiFailedTitle: t('claude_api_failed_title', 'Claude export unavailable'),
      claudeApiFailedBodyNetwork: t('api_failed_body_network', 'The API request failed. Reload this page and try again.'),
      claudeApiFailedBodyGeneric: t('claude_api_failed_body_generic', 'The Claude API request failed. Reload this page and try again. (We do not fall back to DOM on Claude to avoid partial exports.)'),
      claudeApiFailedReload: t('claude_api_failed_reload', 'Reload page'),
      claudeApiFailedClose: t('claude_api_failed_close', 'Close'),
      claudeApiFailedToast: t('claude_api_failed_toast', 'Claude API failed. Reload the page and try again.'),
      claudeApiFailedProgress: t('claude_api_failed_progress', 'Claude API failed'),
      grokApiFailedTitle: t('grok_api_failed_title', 'Grok export unavailable'),
      grokApiFailedBodyNetwork: t('api_failed_body_network', 'The API request failed. Reload this page and try again.'),
      grokApiFailedBodyGeneric: t('grok_api_failed_body_generic', 'The Grok API request failed. Reload this page and try again. (We do not fall back to DOM on Grok to avoid partial exports.)'),
      grokApiFailedReload: t('grok_api_failed_reload', 'Reload page'),
      grokApiFailedClose: t('grok_api_failed_close', 'Close'),
      grokApiFailedToast: t('grok_api_failed_toast', 'Grok API failed. Reload the page and try again.'),
      grokApiFailedProgress: t('grok_api_failed_progress', 'Grok API failed'),
    };
  }

  function getProviderKeyForHost() {
    try { return (document.documentElement.getAttribute('data-acep-platform') || '').trim(); } catch {}
    return '';
  }

  function ensureTurnMeta(turns = []) {
    try {
      const provKey = getProviderKeyForHost();
      const prov = provKey ? (globalThis.ACEP && globalThis.ACEP.providers && globalThis.ACEP.providers[provKey]) : null;
      const roleQueues = prov && typeof prov.getRoleQueuesForExport === 'function' ? prov.getRoleQueuesForExport() : null;
      const rolePos = { user: 0, assistant: 0 };
      const usedExport = new Set();

      const mapSelectableId = (turn, idx) => {
        const role = roleFromTurn(turn) || '';
        if (role === 'artifact' || turn.getAttribute('data-acep-role') === 'artifact') return;
        if (roleQueues && (role === 'user' || role === 'assistant')) {
          const queue = roleQueues[role] || [];
          let pos = rolePos[role] || 0;
          while (pos < queue.length && usedExport.has(queue[pos])) pos++;
          if (pos < queue.length) {
            const hitIdx = queue[pos];
            rolePos[role] = pos + 1;
            usedExport.add(hitIdx);
            try { turn.setAttribute('data-acep-export-idx', String(hitIdx)); } catch {}
            try { turn.setAttribute('data-acep-role', role); } catch {}
            return;
          }
          return;
        }
        // fallback: just ensure an export idx exists so selection works
        if (!turn.getAttribute('data-acep-export-idx')) {
          try { turn.setAttribute('data-acep-export-idx', String(idx)); } catch {}
        }
      };

      turns.forEach((turn, idx) => {
        try {
          if (!(turn instanceof Element)) return;
          mapSelectableId(turn, idx);
          if (!turn.getAttribute('data-acep-turn-id')) turn.setAttribute('data-acep-turn-id', String(idx));
          const role = roleFromTurn(turn) || 'assistant';
          turn.setAttribute('data-acep-role', role);
          let hasImages = false;
          try { hasImages = (imagesFromTurn(turn) || []).length > 0; } catch {}
          turn.setAttribute('data-acep-has-images', hasImages ? '1' : '0');
        } catch {}
      });
    } catch {}
  }

  function getTurnPreviewText(turn) {
    try {
      const pastedPreviewLabel =
        (STATE.messages?.sidebar_pasted_content_export?.message) ||
        browser.i18n.getMessage('sidebar_pasted_content_export') ||
        '{Pasted Content}';
      const imagePreviewLabel =
        (STATE.messages?.sidebar_image_content_export?.message) ||
        browser.i18n.getMessage('sidebar_image_content_export') ||
        'Image';
      if (/claude\.ai$/i.test(HOST)) {
        const role = roleFromTurn(turn) || turn.getAttribute?.('data-acep-role') || '';
        const hasDomPaste =
          !!turn.matches?.('[data-acep-full], .acep-pasted-text, .acep-pasted-content') ||
          !!turn.querySelector?.('[data-acep-full], .acep-pasted-text, .acep-pasted-content');
        const needsPasteFallback =
          String(turn.getAttribute?.('data-acep-needs-dom-fallback') || '') === '1' ||
          String(turn.getAttribute?.('data-acep-has-pasted-file') || '') === '1';
        const hasThumb =
          !!turn.matches?.('[data-testid="file-thumbnail"], .group\\/thumbnail, [class*="group/thumbnail" i]') ||
          !!turn.querySelector?.('[data-testid="file-thumbnail"], .group\\/thumbnail, [class*="group/thumbnail" i]');
        if (role === 'user' && (hasDomPaste || needsPasteFallback || hasThumb)) {
          const ttClaude = (turn.innerText || turn.textContent || '').replace(/\s+/g, ' ').trim();
          if (!ttClaude) return pastedPreviewLabel;
          if (!ttClaude.includes(pastedPreviewLabel)) return `${ttClaude} ${pastedPreviewLabel}`.trim();
        }
      }
      const tt = (turn.innerText || turn.textContent || '').replace(/\s+/g, ' ').trim();
      if (!tt) {
        let hasImages = false;
        try { hasImages = String(turn.getAttribute?.('data-acep-has-images') || '') === '1' || (imagesFromTurn(turn) || []).length > 0; } catch {}
        if (hasImages) return imagePreviewLabel;
      }
      return tt.slice(0, 220);
    } catch {
      return '';
    }
  }

  async function openExportSidebar() {
    if (!STATE.enabled || !SUPPORTED_HOST) return;
    if (isSidebarOpen()) { closeExportSidebar(); return; }

    // Ensure any legacy selection mode UI is removed.
    try { if (SELECT_MODE_ACTIVE) exitSelectionMode(); } catch {}

    const mount = document.body || document.documentElement;
    if (!mount) return;

    try {
      window.__acepSelectedTurnIds = null;
      window.__acepSelectionFilter = null;
    } catch {}

    const host = document.createElement('div');
    host.id = SIDEBAR_HOST_ID;
    // Full-screen dialog root (like ChatGPT Exporter) so the panel doesn't feel "stuck" to the page.
    host.style.position = 'fixed';
    host.style.inset = '0';
    host.style.zIndex = '2147483647';
    host.style.pointerEvents = 'none';
    mount.appendChild(host);

    const shadow = host.attachShadow({ mode: 'open' });
    const s = getSidebarStrings();
    const sidebarWidth = await getSidebarWidth();

    const style = document.createElement('style');
    style.textContent = `
      :host { all: initial; }
      .root{ pointer-events:none; position:fixed; inset:0; }
      .panel{
        pointer-events:auto;
        position:fixed;
        top:0;
        right:0;
        height:100vh;
        width:var(--acep-sidebar-width, ${sidebarWidth}px);
        transform: translateX(0);
        animation: acepSlideIn .18s ease-out;
      }
      @keyframes acepSlideIn { from { transform: translateX(20px); opacity:.5; } to { transform: translateX(0); opacity:1; } }
      .wrap{
        pointer-events:auto;
        height:100vh;
        width:var(--acep-sidebar-width, ${sidebarWidth}px);
        background: #F0EEFA;
        color:#2D1B69;
        font-family: "Segoe UI", Inter, Arial, sans-serif;
        display:flex;
        flex-direction:column;
        box-shadow:-12px 0 48px rgba(126,87,194,.28);
        border-left: 1px solid #D1B8FF;
      }
      .resizeHandle{
        pointer-events:auto;
        position:absolute;
        left:-5px;
        top:0;
        width:10px;
        height:100vh;
        cursor:ew-resize;
        z-index:5;
      }
      .resizeHandle::before{
        content:"";
        position:absolute;
        left:4px;
        top:0;
        width:2px;
        height:100%;
        background:transparent;
        transition:background .12s ease;
      }
      .resizeHandle:hover::before{ background:rgba(126,87,194,.45); }
      .panel.resizing, .panel.resizing *{ user-select:none; }
      .top{
        display:flex;
        flex-direction:column;
        gap:10px;
        padding:16px 14px 14px;
        background: linear-gradient(135deg, #7E57C2 0%, #512DA8 100%);
        flex-shrink:0;
      }
      .topRow{ display:flex; align-items:flex-start; justify-content:space-between; gap:10px; }
      .topLeft{ display:flex; align-items:flex-start; gap:10px; min-width:0; flex:1 1 auto; }
      .close{
        pointer-events:auto;
        cursor:pointer;
        border:1px solid rgba(255,255,255,.25);
        background:rgba(255,255,255,.12);
        border-radius:10px;
        width:30px; height:30px;
        display:flex; align-items:center; justify-content:center;
        color:#fff;
        font-weight:900; font-size:16px;
        flex-shrink:0;
      }
      .close:hover{ background:rgba(255,255,255,.22); }
      .top .title{ font-weight:800; font-size:14px; letter-spacing:.2px; color:#fff; }
      .titleBlock{ display:flex; flex-direction:column; gap:2px; min-width:0; }
      .topSub{ width:100%; padding-left:0; }
      .titleSubInput{
        margin-top:0;
        width:100%;
        max-width:100%;
        background:rgba(255,255,255,.10);
        border:1px solid rgba(255,255,255,.22);
        border-radius:10px;
        padding:7px 10px;
        font-weight:900;
        font-size:12px;
        color:#fff;
        outline:none;
        pointer-events:auto;
      }
      .titleSubInput::placeholder{ color:rgba(255,255,255,.78); font-weight:800; }
      .titleSubInput:hover{ background:rgba(255,255,255,.15); }
      .titleSubInput:focus{ background:rgba(255,255,255,.18); border-color:rgba(255,255,255,.55); box-shadow:0 0 0 3px rgba(255,255,255,.14); }
      .btn{
        display:flex;
        align-items:center;
        gap:6px;
        border:1px solid rgba(255,255,255,.25);
        background:rgba(255,255,255,.14);
        color:#fff;
        border-radius:999px;
        padding:7px 12px;
        cursor:pointer;
        font-weight:700;
        font-size:12px;
        font-family:inherit;
      }
      #acep-feedback{ flex:0 0 auto; align-self:flex-start; }
      #acep-feedback .supportCup{ font-size:13px; line-height:1; margin-right:2px; }
      .btn:hover{ background:rgba(255,255,255,.24); }
      .btn.primary{
        background: linear-gradient(135deg,#7E57C2,#512DA8);
        border-color:#7E57C2; color:#fff;
      }
      .btn.primary:hover{ filter:brightness(1.08); }
      .btn.ghost{ background:#fff; border:1px solid #D1B8FF; color:#7E57C2; }
      .btn.ghost:hover{ background:#F3EFFE; }

      .marquee{
        border-bottom:1px solid #E0D6F5;
        padding:9px 14px;
        background:#F8F4FF;
        flex-shrink:0;
      }
      .marqueeBox{
        position:relative; width:100%; overflow:hidden;
        border-radius:10px;
        border:1px solid #D1B8FF;
        background:#EDE7F6;
      }
      .marqueeInner{
        display:flex; align-items:center; white-space:nowrap;
        gap:18px; padding:7px 12px;
        font-size:12px; font-weight:600; color:#512DA8;
      }
      .marqueeInner .tipBulb{ display:inline-block; margin-right:6px; line-height:1; }
       .marqueeInner.scrolling .tipText{
          display:inline-block;
          padding-left:100%;
          animation: acepMarquee 47s linear infinite;
        }
      @keyframes acepMarquee { from { transform: translateX(0); } to { transform: translateX(-100%); } }

      .tabs{
        display:flex; gap:6px;
        padding:10px 12px;
        border-bottom:1px solid #E0D6F5;
        background:#F8F4FF;
        flex-shrink:0;
      }
      .tab{
        flex:1; text-align:center;
        padding:7px 4px;
        border-radius:10px; cursor:pointer;
        font-weight:700; font-size:11px;
        color:#7E57C2; background:#fff;
        border:1px solid #D1B8FF;
        transition:background .12s,color .12s;
      }
      .tab.active{
        background: linear-gradient(135deg,#7E57C2,#512DA8);
        color:#fff; border-color:#7E57C2;
      }
      .list{ padding:10px 12px 6px; overflow:auto; flex:1; }
      .rows{ display:flex; flex-direction:column; gap:0; border:1px solid #E0D6F5; border-radius:12px; overflow:hidden; background:#fff; }
      .row{
        display:flex; align-items:center; gap:10px;
        padding:9px 10px;
        border-bottom:1px solid #F0EEFA;
        background:#fff;
        transition:background .12s;
      }
      .row:last-child{ border-bottom:none; }
      .row:hover{ background:#F3EFFE; }
      .row input{ width:15px; height:15px; accent-color:#7E57C2; flex:0 0 auto; }
      .rowIcon{ width:18px; height:18px; border-radius:50%; flex:0 0 auto; opacity:.9; }
      .rowText{
        flex:1 1 auto; min-width:0;
        font-size:12px; font-weight:600; color:#37474F;
        white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
      }
      .pill{
        font-size:10px; padding:3px 7px;
        border-radius:999px;
        background:#EDE7F6; color:#7E57C2;
        border:1px solid #D1B8FF; font-weight:600;
      }
      .check{
        display:flex; align-items:center; gap:6px;
        font-size:11px; color:#78909C; user-select:none;
      }
      .check input{ width:14px; height:14px; accent-color:#7E57C2; }

      .footerTop{
        display:flex; align-items:center; justify-content:space-between;
        padding:9px 14px; border-top:1px solid #E0D6F5;
        background:#F8F4FF; flex-shrink:0;
      }
      .selectedBtn{
        border:none; background:transparent;
        color:#7E57C2; font-weight:800; font-size:12px;
        cursor:pointer; padding:0; font-family:inherit;
      }
      .selectedBtn:hover{ text-decoration:underline; text-decoration-color:#7E57C2; }
      .gear{
        cursor:pointer;
        border:1px solid #D1B8FF; background:#EDE7F6;
        border-radius:10px; width:30px; height:30px;
        display:flex; align-items:center; justify-content:center;
        color:#7E57C2; font-size:15px; transition:background .12s;
      }
      .gear:hover{ background:#D1B8FF; }
      .footerBottom{
        display:flex; align-items:center; gap:8px;
        padding:10px 12px 14px;
        background:#F8F4FF; border-top:1px solid #E0D6F5; flex-shrink:0;
      }
      select{
        flex:1; background:#fff; color:#37474F;
        border:1px solid #D1B8FF; border-radius:10px;
        padding:9px 10px; font-weight:700; font-size:12px; font-family:inherit;
      }
      select:focus{ outline:2px solid #7E57C2; border-color:#7E57C2; }
      option{ color:#37474F; }

      /* title/filename live in header via .titleBlock/.titleSub */

      .preview{
        pointer-events:none; position:fixed;
        right:calc(var(--acep-sidebar-width, ${sidebarWidth}px) + 16px); top:86px;
        width:520px; max-width: calc(100vw - var(--acep-sidebar-width, ${sidebarWidth}px) - 28px);
        max-height:60vh; overflow:auto;
        background:#fff; border:1px solid #D1B8FF;
        border-radius:14px; box-shadow:0 12px 48px rgba(126,87,194,.20);
        padding:12px; display:none;
        color:#2D1B69; font-size:12px; line-height:1.45; white-space:pre-wrap;
      }
      @media (max-width: 860px){
        .preview{ display:none !important; }
        .panel{ width: min(var(--acep-sidebar-width, ${sidebarWidth}px), 92vw); }
        .wrap{ width:100%; }
      }
      .loading-state{
        display:flex; flex-direction:column; align-items:center;
        padding:40px 16px; gap:14px;
      }
      .loading-spinner{
        width:30px; height:30px;
        border:3px solid #EDE7F6; border-top-color:#7E57C2;
        border-radius:50%; animation:acepSpin .75s linear infinite;
      }
      @keyframes acepSpin{ to{ transform:rotate(360deg); } }
      .loading-text{
        color:#7E57C2; font-size:13px; font-weight:700;
        font-family:"Segoe UI",Inter,Arial,sans-serif;
      }
      .error-state{
        display:flex; flex-direction:column; align-items:flex-start;
        padding:18px 14px;
        border:1px solid #E0D6F5;
        border-radius:12px;
        background:#fff;
        gap:10px;
      }
      .error-title{ font-weight:900; color:#512DA8; font-size:13px; }
      .error-body{ color:#37474F; font-size:12px; line-height:1.5; }
      .error-actions{ display:flex; gap:8px; flex-wrap:wrap; }
      .btnDanger{
        border:1px solid #E53935;
        background:#FFEBEE;
        color:#C62828;
        border-radius:999px;
        padding:7px 12px;
        cursor:pointer;
        font-weight:800;
        font-size:12px;
        font-family:inherit;
      }
      .btnDanger:hover{ filter:brightness(0.98); }
      .loading-dots span{
        display:inline-block; animation:acepDot 1.4s infinite; opacity:0;
      }
      .loading-dots span:nth-child(2){ animation-delay:.2s; }
      .loading-dots span:nth-child(3){ animation-delay:.4s; }
      @keyframes acepDot{ 0%,80%,100%{opacity:0;} 40%{opacity:1;} }
    `;

    const root = document.createElement('div');
    root.className = 'root';
    root.style.setProperty('--acep-sidebar-width', `${sidebarWidth}px`);
    root.innerHTML = `
      <div class="panel">
        <div class="resizeHandle" id="acep-resize" title="${escapeHtml(s.resize || 'Resize')}"></div>
        <div class="wrap">
          <div class="top">
            <div class="topRow">
              <div class="topLeft">
                <button class="close" id="acep-close" aria-label="Close">&#215;</button>
                <div class="titleBlock">
                  <div class="title">${escapeHtml(s.title)}:</div>
                </div>
              </div>
              <button class="btn" id="acep-feedback"><span class="supportCup" aria-hidden="true">&#9749;</span>${escapeHtml(s.feedback)}</button>
            </div>
            <div class="topSub">
              <input class="titleSubInput" id="acep-filename" type="text" inputmode="text" spellcheck="false" autocomplete="off"
                aria-label="${escapeHtml(s.fileNameLabel)}" placeholder="${escapeHtml(s.fileNameLabel)}" />
            </div>
          </div>
      <div class="marquee">
        <div class="marqueeBox">
          <div class="marqueeInner" id="acep-progress"><span class="tipText" id="acep-progress-text">${escapeHtml(s.progressIdle)}</span></div>
        </div>
      </div>
      <div class="tabs">
        <div class="tab active" data-mode="all">${escapeHtml(s.tabAll)}</div>
        <div class="tab" data-mode="assistant">${escapeHtml(s.tabAsst)}</div>
        <div class="tab" data-mode="user">${escapeHtml(s.tabUser)}</div>
        <div class="tab" data-mode="images">${escapeHtml(s.tabImages)}</div>
        ${/claude\.ai$/i.test(HOST) ? `<div class="tab" data-mode="artifacts">${escapeHtml(s.tabArtifacts)}</div>` : ''}
        <div class="tab" data-mode="none">${escapeHtml(s.tabNone)}</div>
      </div>
      <div class="list">
        <div class="rows" id="acep-rows"></div>
      </div>
      <div class="footerTop">
        <button class="selectedBtn" id="acep-selected">0/0 ${escapeHtml(s.selected)}</button>
        <div class="gear" id="acep-settings" title="${escapeHtml(s.settings)}">&#9881;</div>
      </div>
      <div class="footerBottom">
        <button class="btn ghost" id="acep-cancel">${escapeHtml(s.cancel)}</button>
        <select id="acep-format">
          <option value="pdf_text">PDF</option>
          <option value="docx">DOCX</option>
          <option value="html_self">HTML (self)</option>
          <option value="html_linked">HTML (linked)</option>
          <option value="md">MD</option>
          <option value="json">JSON</option>
          <option value="txt">TXT</option>
          <option value="csv">CSV</option>
          <option value="png_plain">PNG</option>
        </select>
        <button class="btn primary" id="acep-export">${escapeHtml(s.export)}</button>
      </div>
          <div class="preview" id="acep-preview"></div>
        </div>
      </div>
    `;

    shadow.appendChild(style);
    shadow.appendChild(root);

    const rowsEl = shadow.getElementById('acep-rows');
    const preview = shadow.getElementById('acep-preview');
    const selectedEl = shadow.getElementById('acep-selected');
    const progressEl = shadow.getElementById('acep-progress');
    const progressTextEl = shadow.getElementById('acep-progress-text');
    const formatEl = shadow.getElementById('acep-format');
    const exportBtn = shadow.getElementById('acep-export');
    const fileNameEl = shadow.getElementById('acep-filename');
    const panelEl = shadow.querySelector('.panel');
    const resizeHandleEl = shadow.getElementById('acep-resize');

    try {
      let resizeState = null;
      resizeHandleEl?.addEventListener?.('pointerdown', (event) => {
        try {
          if (event.button !== 0) return;
          resizeState = {
            startX: event.clientX,
            startWidth: Number.parseInt(root.style.getPropertyValue('--acep-sidebar-width'), 10) || sidebarWidth,
          };
          panelEl?.classList?.add('resizing');
          resizeHandleEl.setPointerCapture?.(event.pointerId);
          event.preventDefault();
        } catch {}
      });
      resizeHandleEl?.addEventListener?.('pointermove', (event) => {
        try {
          if (!resizeState) return;
          const viewportMax = Math.max(SIDEBAR_MIN_WIDTH, Math.min(SIDEBAR_MAX_WIDTH, Math.floor((window.innerWidth || 1024) * 0.92)));
          const nextWidth = clamp(resizeState.startWidth + (resizeState.startX - event.clientX), SIDEBAR_MIN_WIDTH, viewportMax);
          root.style.setProperty('--acep-sidebar-width', `${Math.round(nextWidth)}px`);
          event.preventDefault();
        } catch {}
      });
      resizeHandleEl?.addEventListener?.('pointerup', async (event) => {
        try {
          if (!resizeState) return;
          const finalWidth = Number.parseInt(root.style.getPropertyValue('--acep-sidebar-width'), 10) || sidebarWidth;
          resizeState = null;
          panelEl?.classList?.remove('resizing');
          resizeHandleEl.releasePointerCapture?.(event.pointerId);
          await setLocalSetting(SIDEBAR_WIDTH_KEY, Math.round(finalWidth));
          event.preventDefault();
        } catch {
          resizeState = null;
          panelEl?.classList?.remove('resizing');
        }
      });
      resizeHandleEl?.addEventListener?.('pointercancel', () => {
        resizeState = null;
        panelEl?.classList?.remove('resizing');
      });
    } catch {}

    // Prevent host page hotkeys / focus stealing while typing in the filename field
    try {
      const stop = (e) => { try { e.stopPropagation(); e.stopImmediatePropagation(); } catch {} };
      fileNameEl?.addEventListener?.('keydown', stop, true);
      fileNameEl?.addEventListener?.('keypress', stop, true);
      fileNameEl?.addEventListener?.('keyup', stop, true);
      fileNameEl?.addEventListener?.('click', stop, true);
      fileNameEl?.addEventListener?.('mousedown', stop, true);
      fileNameEl?.addEventListener?.('mouseup', stop, true);
    } catch {}

    const cleanBaseFileName = (name) => {
      const fallback = (typeof getChatTitle === 'function' ? getChatTitle() : (document.title || 'AI Conversation'));
      const raw = String(name || '').trim() || String(fallback || 'AI Conversation').trim();
      const noExt = raw.replace(/\.(pdf|docx|txt|md|markdown|csv|json|png|html)$/i, '');
      return (noExt
        .replace(/[\\/:*?"<>|]+/g, '-')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 120)) || 'AI Conversation';
    };

    // Default filename should come from the current chat title each time (not from a previous export).
    try {
      const base = cleanBaseFileName(typeof getChatTitle === 'function' ? getChatTitle() : '');
      if (fileNameEl) {
        fileNameEl.value = base;
        fileNameEl.title = base;
      }
    } catch {}

    // Keep tooltip in sync while typing
    try { fileNameEl?.addEventListener?.('input', () => { try { fileNameEl.title = fileNameEl.value || ''; } catch {} }); } catch {}

    const setProgress = (txt) => {
      const t = String(txt || '');
      try { if (progressTextEl) progressTextEl.textContent = t; } catch {}
      try {
        if (!progressEl) return;
        const shouldScroll = t.length > 42;
        progressEl.classList.toggle('scrolling', shouldScroll);
      } catch {}
      try {
        const idle = (getSidebarStrings().progressIdle || 'Ready');
        if (t === idle) updateSidebarTips();
      } catch {}
    };
    try { globalThis.__acepSidebarSetProgress = setProgress; } catch {}

    // Populate the sidebar marquee with localized tip messages when available
    function updateSidebarTips() {
      try {
        if (!progressEl) return;
        const tips = [];
        for (let i = 1; i <= 10; i++) {
          try {
            const key = `tip_${i}`;
            const v = (STATE.messages && STATE.messages[key] && STATE.messages[key].message) || (browser.i18n && browser.i18n.getMessage ? browser.i18n.getMessage(key) : '') || '';
            if (v && String(v).trim()) tips.push(String(v).trim());
          } catch {}
        }
        if (tips.length === 0) {
          progressEl.classList.remove('scrolling');
          if (progressTextEl) progressTextEl.textContent = (getSidebarStrings().progressIdle || 'Ready');
          return;
        }
        const sep = '  |  ';
        const text = tips.map(t => `<span class="tipBulb" aria-hidden="true">&#128161;</span>${escapeHtml(t)}`).join(escapeHtml(sep));
        const inner = `${text}${escapeHtml(sep)}${text}`;
        progressEl.classList.add('scrolling');
        if (progressTextEl) progressTextEl.innerHTML = inner;
      } catch {}
    }

    // Render tips now (and re-render once i18n messages are ready).
    try { updateSidebarTips(); } catch {}
    try { (async () => { try { await i18nReady; } catch {} updateSidebarTips(); })(); } catch {}

    // Show loading placeholder immediately ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¾Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¦ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â turns arrive after preScrape resolves
    const selected = new Set();
    const turnItems = [];

    if (rowsEl) rowsEl.innerHTML = `
      <div class="loading-state">
        <div class="loading-spinner"></div>
        <div class="loading-text">${s.loadingTurns}<span class="loading-dots"><span>.</span><span>.</span><span>.</span></span></div>
      </div>`;

    const updateSelectedLabel = () => {
      try {
        const total = turnItems.length;
        const sel = selected.size;
        if (selectedEl) selectedEl.textContent = `${sel}/${total} ${s.selected}`;
      } catch {}
    };

    const providerKey = getProviderKeyForHost();
    const iconForRole = (role) => {
      try {
        if (role === 'user') return loadIconDataUrlSync('user') || '';
        if (providerKey && loadIconDataUrlSync(providerKey)) return loadIconDataUrlSync(providerKey);
      } catch {}
      return '';
    };

    // Rebuild rows from current `selected` state without touching selection
    const rebuildRows = () => {
      if (!rowsEl) return;
      rowsEl.innerHTML = '';
      turnItems.forEach((it) => {
        const row = document.createElement('div');
        row.className = 'row';
        const icon = iconForRole(it.role);
        row.innerHTML = `
          <input type="checkbox" />
          ${icon ? `<img class="rowIcon" alt="" src="${icon}">` : `<span class="rowIcon"></span>`}
          <div class="rowText"></div>
        `;
        const textEl = row.querySelector('.rowText');
        const input = row.querySelector('input');
        if (textEl) textEl.textContent = it.previewText || '';
        if (input) {
          input.checked = selected.has(it.id);
          input.addEventListener('change', () => {
            if (input.checked) selected.add(it.id);
            else selected.delete(it.id);
            updateSelectedLabel();
          });
        }
        row.addEventListener('mouseenter', () => {
          try {
            const full = (it.turn?.innerText || it.turn?.textContent || '').trim();
            if (preview) {
              const pastedPreviewLabel =
                (STATE.messages?.sidebar_pasted_content_export?.message) ||
                browser.i18n.getMessage('sidebar_pasted_content_export') ||
                '{Pasted Content}';
              preview.textContent = full || it.previewText || (it.role === 'user' && /claude\.ai$/i.test(HOST) ? pastedPreviewLabel : '');
              preview.style.display = 'block';
            }
          } catch {}
        });
        row.addEventListener('mouseleave', () => {
          try { if (preview) preview.style.display = 'none'; } catch {}
        });
        rowsEl.appendChild(row);
      });
      updateSelectedLabel();
    };

    const render = (mode) => {
      const want = String(mode || 'all');
      // Update the selected set to match the tab first
      if (want === 'all') {
        turnItems.forEach(it => selected.add(it.id));
      } else if (want === 'none') {
        selected.clear();
      } else if (want === 'user') {
        selected.clear();
        turnItems.forEach(it => { if (it.role === 'user') selected.add(it.id); });
      } else if (want === 'assistant') {
        selected.clear();
        turnItems.forEach(it => { if (it.role === 'assistant') selected.add(it.id); });
      } else if (want === 'artifacts') {
        selected.clear();
        turnItems.forEach(it => { if (it.hasArtifact) selected.add(it.id); });
      } else if (want === 'images') {
        selected.clear();
        turnItems.forEach(it => { if (it.hasImg) selected.add(it.id); });
      }
      rebuildRows();
    };

    // Async: fetch turns via API (preScrape), then populate and render
    (async () => {
      try {
        const p = getProvider();
        if (p && typeof p.preScrape === 'function') {
          await p.preScrape({ purpose: 'selection' });
          // Claude still needs an export-phase preScrape for generated-file resolution.
          if (getProviderKeyForHost() !== 'claude') {
            try {
              globalThis.__acepPreScrapeMemo = {
                platform: getProviderKeyForHost() || '',
                href: String(location.href || ''),
                chatId: (typeof p.getCurrentChatId === 'function') ? String(p.getCurrentChatId() || '') : '',
                ts: Date.now(),
              };
            } catch {}
          }
        }
      } catch {}

      const apiFailState = (() => {
        try {
          const key = getProviderKeyForHost();
          if (key !== 'chatgpt' && key !== 'claude' && key !== 'deepseek' && key !== 'gemini' && key !== 'grok') return null;
          const prov = globalThis.ACEP?.providers?.[key];
          const apiFailed = !!prov?.__apiFailed;
          const networkFailed = !!prov?.__apiNetworkFailed;
          if (!apiFailed && !networkFailed) return null;
          return { key, apiFailed, networkFailed };
        } catch {
          return null;
        }
      })();
      const allTurns = (() => {
        const t = getTurnNodes();
        const extra = getProviderExtraSelectableNodes();
        const list = (t || []).concat(extra || []);
        ensureTurnMeta(list);
        return list;
      })();

      if (!allTurns.length && apiFailState && rowsEl) {
        const offline = (() => {
          try { return navigator && navigator.onLine === false; } catch { return false; }
        })();
        const isChatGPT = apiFailState.key === 'chatgpt';
        const isClaude = apiFailState.key === 'claude';
        const isDeepSeek = apiFailState.key === 'deepseek';
        const isGemini = apiFailState.key === 'gemini';
        const isGrok = apiFailState.key === 'grok';
        const title = isChatGPT
          ? (s.chatgptApiFailedTitle || 'ChatGPT export unavailable')
          : isClaude
          ? (s.claudeApiFailedTitle || 'Claude export unavailable')
          : isDeepSeek
          ? (s.deepseekApiFailedTitle || 'DeepSeek export unavailable')
          : (isGemini ? (s.geminiApiFailedTitle || 'Gemini export unavailable') : (s.grokApiFailedTitle || 'Grok export unavailable'));
        const body = apiFailState.networkFailed || offline
          ? (isChatGPT
            ? (s.apiFailedBodyNetwork || 'The API request failed. Reload this page and try again.')
            : (isClaude
            ? (s.claudeApiFailedBodyNetwork || s.apiFailedBodyNetwork || 'The Claude API request failed. Reload this page and try again.')
            : (isDeepSeek
            ? (s.deepseekApiFailedBodyNetwork || s.apiFailedBodyNetwork || 'The API request failed. Reload this page and try again.')
            : (isGemini
              ? (s.geminiApiFailedBodyNetwork || s.apiFailedBodyNetwork || 'The API request failed. Reload this page and try again.')
              : (s.grokApiFailedBodyNetwork || s.apiFailedBodyNetwork || 'The API request failed. Reload this page and try again.')))))
          : (isChatGPT
            ? (s.chatgptApiFailedBodyGeneric || 'The ChatGPT API request failed. Reload this page and try again.')
            : (isClaude
            ? (s.claudeApiFailedBodyGeneric || 'The Claude API request failed. Reload this page and try again. (We do not fall back to DOM on Claude to avoid partial exports.)')
            : (isDeepSeek
            ? (s.deepseekApiFailedBodyGeneric || 'The DeepSeek API request failed. Reload this page and try again. (We do not fall back to DOM on DeepSeek to avoid partial exports.)')
            : (isGemini
              ? (s.geminiApiFailedBodyGeneric || 'The Gemini API request failed. Reload this page and try again. (We do not fall back to DOM on Gemini to avoid partial exports.)')
              : (s.grokApiFailedBodyGeneric || 'The Grok API request failed. Reload this page and try again. (We do not fall back to DOM on Grok to avoid partial exports.)')))));
        rowsEl.innerHTML = `
          <div class="error-state">
            <div class="error-title">${escapeHtml(title)}</div>
            <div class="error-body">${escapeHtml(body)}</div>
            <div class="error-actions">
              <button class="btnDanger" id="acep-reload">${escapeHtml((isChatGPT ? s.chatgptApiFailedReload : (isClaude ? s.claudeApiFailedReload : (isDeepSeek ? s.deepseekApiFailedReload : (isGemini ? s.geminiApiFailedReload : s.grokApiFailedReload)))) || 'Reload page')}</button>
              <button class="btn ghost" id="acep-close2">${escapeHtml((isChatGPT ? s.chatgptApiFailedClose : (isClaude ? s.claudeApiFailedClose : (isDeepSeek ? s.deepseekApiFailedClose : (isGemini ? s.geminiApiFailedClose : s.grokApiFailedClose)))) || 'Close')}</button>
            </div>
          </div>`;
        try {
          const failedLabel = (isChatGPT ? s.chatgptApiFailedProgress : (isClaude ? s.claudeApiFailedProgress : (isDeepSeek ? s.deepseekApiFailedProgress : (isGemini ? s.geminiApiFailedProgress : s.grokApiFailedProgress))))
            || (isChatGPT ? 'ChatGPT API failed' : (isClaude ? 'Claude API failed' : (isDeepSeek ? 'DeepSeek API failed' : (isGemini ? 'Gemini API failed' : 'Grok API failed'))));
          setProgress(failedLabel);
          if (selectedEl) selectedEl.textContent = failedLabel;
        } catch {}
        try { if (exportBtn) exportBtn.disabled = true; } catch {}
        try {
          shadow.getElementById('acep-reload')?.addEventListener('click', () => {
            try { location.reload(); } catch {}
          });
          shadow.getElementById('acep-close2')?.addEventListener('click', () => closeExportSidebar());
        } catch {}
        try {
          showToast((isChatGPT ? s.chatgptApiFailedToast : (isClaude ? s.claudeApiFailedToast : (isDeepSeek ? s.deepseekApiFailedToast : (isGemini ? s.geminiApiFailedToast : s.grokApiFailedToast))))
            || (isChatGPT ? 'ChatGPT API failed. Reload the page and try again.' : (isClaude ? 'Claude API failed. Reload the page and try again.' : (isDeepSeek ? 'DeepSeek API failed. Reload the page and try again.' : (isGemini ? 'Gemini API failed. Reload the page and try again.' : 'Grok API failed. Reload the page and try again.')))));
        } catch {}
        return;
      }
      allTurns.forEach((turn, idx) => {
        // IMPORTANT: For Claude (API-first), `buildCleanHTML()` selection expects export-index IDs.
        // Using `data-acep-turn-id` here can desync the sidebar selection from the exported rows and
        // cause missing generated-file links / artifacts in the final export.
        const preferredId = (() => {
          try {
            const exp = turn.getAttribute('data-acep-export-idx');
            if (exp !== null && exp !== '') return exp;
          } catch {}
          try {
            const tid = turn.getAttribute('data-acep-turn-id');
            if (tid !== null && tid !== '') return tid;
          } catch {}
          return String(idx);
        })();
        const id = String(preferredId);
        const role = String(turn.getAttribute('data-acep-role') || roleFromTurn(turn) || '');
        const hasImg = String(turn.getAttribute('data-acep-has-images') || '') === '1';
        const hasArtifact = String(turn.getAttribute('data-acep-has-artifact') || '') === '1'
          || !!(turn.querySelector?.('[role="button"][aria-label="Preview contents"]'));
        const previewText = getTurnPreviewText(turn);
        selected.add(id);
        turnItems.push({ id, role, hasImg, hasArtifact, previewText, turn });
      });
      const activeMode = shadow.querySelector('.tab.active')?.getAttribute('data-mode') || 'all';
      render(activeMode);
    })();

    shadow.querySelectorAll('.tab').forEach((el) => {
      el.addEventListener('click', () => {
        shadow.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        el.classList.add('active');
        const mode = el.getAttribute('data-mode') || 'all';
        try { window.__acepSelectionFilter = mode; } catch {}
        render(mode);
      });
    });

    const acepSupportButton = shadow.getElementById('acep-feedback');
    const acepSettingsButton = shadow.getElementById('acep-settings');
    const acepExportButton = shadow.getElementById('acep-export');

    if (!acepSupportButton) console.warn('[ACEP content] missing acep-feedback button');
    if (!acepSettingsButton) console.warn('[ACEP content] missing acep-settings button');
    if (!acepExportButton) console.warn('[ACEP content] missing acep-export button');

    async function openUrlInTab(url) {
      try {
        return await browser.tabs.create({ url });
      } catch (e) {
        console.warn('[ACEP content] browser.tabs.create failed', e, url);
        return null;
      }
    }

    acepSupportButton?.addEventListener('click', async () => {
      const url = 'https://chatexport.workpent.com/support/';
      try {
        console.log('[ACEP content] sidebar support clicked');
        let resp = null;
        try {
          resp = await browser.runtime.sendMessage({ type: 'ACEP_OPEN_URL', url });
          console.log('[ACEP content] support sendMessage response', resp);
        } catch (e) {
          console.warn('[ACEP content] support sendMessage failed', e);
        }
        if (!resp || !resp.ok) {
          console.log('[ACEP content] support fallback opening URL directly');
          await openUrlInTab(url);
        }
      } catch (e) {
        console.warn('ACEP support open failed', e);
      }
    });

    acepSettingsButton?.addEventListener('click', async () => {
      const url = browser.runtime.getURL('popup.html');
      try {
        console.log('[ACEP content] sidebar settings clicked');
        let resp = null;
        try {
          resp = await browser.runtime.sendMessage({ type: 'ACEP_OPEN_SETTINGS' });
          console.log('[ACEP content] settings sendMessage response', resp);
        } catch (e) {
          console.warn('[ACEP content] settings sendMessage failed', e);
        }
        if (!resp || !resp.ok) {
          console.log('[ACEP content] settings fallback opening popup directly', url);
          await openUrlInTab(url);
        }
      } catch (e) {
        console.warn('[ACEP content] settings handler failed', e);
      }
    });


    shadow.getElementById('acep-cancel')?.addEventListener('click', () => closeExportSidebar());

    shadow.getElementById('acep-export')?.addEventListener('click', async () => {
      try {
        const selectedIds = Array.from(selected);
        if (!selectedIds.length) {
          showToast(s.noneSelected);
          return;
        }
        const mode = shadow.querySelector('.tab.active')?.getAttribute('data-mode') || 'all';
        try { window.__acepSelectedTurnIds = selectedIds.slice(); } catch {}
        try { window.__acepSelectionFilter = mode; } catch {}
        try { window.__acepPreferredFormat = String(formatEl?.value || 'pdf_text'); } catch {}
        const baseFileName = cleanBaseFileName(fileNameEl?.value || (typeof getChatTitle === 'function' ? getChatTitle() : ''));
        try { window.__acepFileNameBase = baseFileName; } catch {}
        const source = await getExportSourceContext();

        // Claude pasted content is exported as a placeholder to avoid exposing pasted bodies.
        if (/claude\.ai$/i.test(HOST)) {
          try { window.__acepClaudePastedMode = 'placeholder'; } catch {}
        }

        // Show the full loading overlay only when we are sure mute is off.
        // If prefs are stale/unavailable, keep the page quiet; the hidden popup sends the small muted progress toast.
        let exportMuteFlags = { mute: true, muteDownload: false };
        try {
          const _p = await browser.storage.local.get({ acep_last_export_prefs: null, mute: true, muteDownload: false });
          const prefs = _p?.acep_last_export_prefs || {};
          const muteFlag = typeof prefs.mute === 'boolean' ? prefs.mute : !!_p.mute;
          const muteDownloadFlag = typeof prefs.muteDownload === 'boolean' ? prefs.muteDownload : !!_p.muteDownload;
          if (!muteFlag) showExportLoadingOverlay();
          exportMuteFlags = { mute: !!muteFlag, muteDownload: !!muteDownloadFlag };
          globalThis.__acepMuteFlags = exportMuteFlags;
        } catch {
          globalThis.__acepMuteFlags = exportMuteFlags;
        }

        // Store this export under a unique session key so another chat tab cannot overwrite it.
        try {
          await browser.storage.local.set({
            [`acep_pending_export_${source.exportSessionId}`]: {
              ...source,
              selectedTurnIds: selectedIds,
              selectionFilter: mode,
              preferredFormat: String(formatEl?.value || 'pdf_text'),
              fileNameBase: baseFileName,
              mute: exportMuteFlags.mute,
              muteDownload: exportMuteFlags.muteDownload,
              autoExport: true,
              ts: Date.now(),
            }
          });
        } catch {}

        const frame = ensureHiddenExportFrame(source);
        const selectionPayload = {
          type: 'ACEP_SELECTION_SET',
          ...source,
          selectedTurnIds: selectedIds,
          selectionFilter: mode,
          preferredFormat: String(formatEl?.value || 'pdf_text'),
          fileNameBase: baseFileName,
          mute: exportMuteFlags.mute,
          muteDownload: exportMuteFlags.muteDownload,
          autoExport: true,
        };
        const sendSelection = () => {
          try { frame?.contentWindow?.postMessage(selectionPayload, '*'); } catch {}
        };
        if (frame && frame.contentWindow) {
          if (frame.dataset.ready === '1') sendSelection();
          else frame.addEventListener('load', sendSelection, { once: true });
          [80, 350, 900, 1800].forEach((delay) => setTimeout(sendSelection, delay));
        }
        closeExportSidebar();
      } catch (e) {
        console.error('ACEP sidebar export failed', e);
      }
    });

    updateSelectedLabel();
  }

  // --- Bulk export helpers & UI (ChatGPT only) ---
  async function fetchConversationsForBulk({ limit = 200 } = {}) {
    try {
      const items = [];
      let offset = 0;
      const pageSize = 100;
      while (items.length < limit) {
        const url = `${location.origin}/backend-api/conversations?offset=${offset}&limit=${pageSize}&order=updated&is_archived=false&is_starred=false`;
        let res = await fetch(url, { credentials: 'include' });
        if (!res.ok) {
          try {
            const raw = await getRawStoredAuthToken();
            const attempts = [];
            if (raw) {
              attempts.push(raw);
              if (!/^Bearer\s+/i.test(raw)) attempts.push('Bearer ' + raw);
              if (/^Bearer\s+/i.test(raw)) attempts.push(raw.replace(/^Bearer\s+/i, ''));
            } else {
              const token = await getStoredAuthToken();
              if (token) attempts.push(token);
            }
            for (const a of attempts) {
              try { console.log('[ACEP] retrying conversations fetch with token mask=', (a ? (a.slice(0,16) + '...') : '<none>')); } catch(e){}
              res = await fetch(url, { credentials: 'include', headers: { Authorization: a } });
              if (res.ok) break;
            }
          } catch(e) { console.warn('[ACEP] token retry error', e); }
        }
        if (!res.ok) {
          try {
            const body = await res.text().catch(()=>'<no-body>');
            console.warn('fetchConversationsForBulk failed', url, res.status, body);
          } catch(e) { console.warn('fetchConversationsForBulk failed and body unreadable', e); }
          break;
        }
        const json = await res.json();
        const pageItems = Array.isArray(json.items) ? json.items : [];
        items.push(...pageItems.filter(i => { const giz=i?.gizmo_id||''; const tmpl=i?.conversation_template_id||''; if(String(giz).startsWith('g-p-')) return false; if(String(tmpl).startsWith('g-p-')) return false; return true; }));
        if (!pageItems.length || pageItems.length < pageSize) break;
        offset += pageItems.length;
        if (offset >= (json.total || 1e9)) break;
      }
      try { console.log('[ACEP] fetchConversationsForBulk returning', items.length); } catch(e){}
      return items.slice(0, limit);
    } catch (e) { return []; }
  }

  // fallback: read stored conversations captured by injected hook or ChatgptPal
  async function readStoredConversationsFallback() {
    try {
      const keys = ['acep_apiConversations','chatgptpal/apiConversations','apiConversations'];
      const stored = await browser.storage.local.get(keys);
      try { console.log('[ACEP] readStoredConversationsFallback stored keys:', Object.keys(stored)); } catch(e){}
      for (const k of keys) {
        const v = stored[k];
        if (Array.isArray(v) && v.length) {
          try { console.log('[ACEP] using stored conversations from', k, 'count=', v.length); } catch(e){}
          return v;
        }
      }
    } catch (e) { console.warn('[ACEP] readStoredConversationsFallback failed', e); }
    return [];
  }

  async function fetchProjectsForBulk() {
    try {
      const all = [];
      let cursor = null; let page = 0;
      do {
        const url = new URL(`${location.origin}/backend-api/gizmos/snorlax/sidebar`);
        url.searchParams.set('conversations_per_gizmo', '0');
        if (cursor) url.searchParams.set('cursor', cursor);
        let res = await fetch(url.toString(), { credentials: 'include' });
        if (!res.ok) {
          try {
            const raw = await getRawStoredAuthToken();
            const attempts = [];
            if (raw) {
              attempts.push(raw);
              if (!/^Bearer\s+/i.test(raw)) attempts.push('Bearer ' + raw);
              if (/^Bearer\s+/i.test(raw)) attempts.push(raw.replace(/^Bearer\s+/i, ''));
            } else {
              const token = await getStoredAuthToken();
              if (token) attempts.push(token);
            }
            for (const a of attempts) {
              try { console.log('[ACEP] retrying projects fetch with token mask=', (a ? (a.slice(0,16) + '...') : '<none>')); } catch(e){}
              res = await fetch(url.toString(), { credentials: 'include', headers: { Authorization: a } });
              if (res.ok) break;
            }
          } catch(e) { console.warn('[ACEP] token retry error', e); }
        }
        if (!res.ok) {
          try {
            const body = await res.text().catch(()=>'<no-body>');
            console.warn('fetchProjectsForBulk failed', url.toString(), res.status, body);
          } catch(e) { console.warn('fetchProjectsForBulk failed and body unreadable', e); }
          break;
        }
        const json = await res.json();
        const pageItems = Array.isArray(json?.items) ? json.items : (Array.isArray(json?.gizmos) ? json.gizmos : []);
        all.push(...pageItems);
        cursor = json?.cursor || json?.next_cursor || null;
        page += 1;
      } while (cursor && page < 20);
      try { console.log('[ACEP] fetchProjectsForBulk returning', all.length); } catch(e){}
      return all;
    } catch (e) { return []; }
  }

  // fallback: read stored projects captured by ChatgptPal or injected hook
  async function readStoredProjectsFallback() {
    try {
      const keys = ['acep_projects','chatgptpal/projects','projects'];
      const stored = await browser.storage.local.get(keys);
      for (const k of keys) {
        const v = stored[k];
        if (Array.isArray(v) && v.length) {
          try { console.log('[ACEP] using stored projects from', k, 'count=', v.length); } catch(e){}
          return v;
        }
      }
    } catch (e) { console.warn('[ACEP] readStoredProjectsFallback failed', e); }
    return [];
  }

  function buildZip(files) {
    // Minimal ZIP (no compression) builder
    function crc32(buf) {
      const table = (function() { let c; const t = new Uint32Array(256); for (let n=0;n<256;n++){ c=n; for(let k=0;k<8;k++) c = ((c&1)? (0xEDB88320 ^ (c>>>1)) : (c>>>1)); t[n]=c>>>0;} return t; })();
      let crc = 0 ^ -1;
      for (let i=0;i<buf.length;i++) crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xFF];
      return (crc ^ -1) >>> 0;
    }
    const encoder = (s) => new TextEncoder().encode(s);
    const localHeaders = [];
    const centralDirs = [];
    let offset = 0;
    files.forEach((f) => {
      const nameBuf = encoder(f.path.replace(/\\/g,'/'));
      const dataBuf = (f.content instanceof Uint8Array) ? f.content : encoder(String(f.content || ''));
      const crc = crc32(dataBuf);
      const compressedSize = dataBuf.length;
      const uncompressedSize = dataBuf.length;
      const localHeader = new Uint8Array(30 + nameBuf.length);
      const dv = new DataView(localHeader.buffer);
      dv.setUint32(0, 0x04034b50, true); // local sig
      dv.setUint16(4, 20, true); // version
      dv.setUint16(6, 0, true); // flags
      dv.setUint16(8, 0, true); // method 0
      dv.setUint16(10, 0, true); // mod time
      dv.setUint16(12, 0, true); // mod date
      dv.setUint32(14, crc, true);
      dv.setUint32(18, compressedSize, true);
      dv.setUint32(22, uncompressedSize, true);
      dv.setUint16(26, nameBuf.length, true);
      dv.setUint16(28, 0, true);
      localHeader.set(nameBuf, 30);
      localHeaders.push({header: localHeader, data: dataBuf, offset});
      const cdh = new Uint8Array(46 + nameBuf.length);
      const cdv = new DataView(cdh.buffer);
      cdv.setUint32(0, 0x02014b50, true);
      cdv.setUint16(4, 20, true);
      cdv.setUint16(6, 20, true);
      cdv.setUint16(8, 0, true);
      cdv.setUint16(10, 0, true);
      cdv.setUint16(12, 0, true);
      cdv.setUint32(14, crc, true);
      cdv.setUint32(18, compressedSize, true);
      cdv.setUint32(22, uncompressedSize, true);
      cdv.setUint16(26, nameBuf.length, true);
      cdv.setUint16(28, 0, true);
      cdv.setUint16(30, 0, true);
      cdv.setUint16(32, 0, true);
      cdv.setUint32(34, 0, true);
      cdv.setUint32(38, 0, true);
      cdv.setUint32(42, offset, true);
      cdh.set(nameBuf, 46);
      centralDirs.push({cd: cdh});
      offset += localHeader.length + dataBuf.length;
    });
    const centralSize = centralDirs.reduce((s, c) => s + c.cd.length, 0);
    const centralOffset = offset;
    const totalSize = offset + centralSize + 22;
    const out = new Uint8Array(totalSize);
    let ptr = 0;
    localHeaders.forEach((lh) => { out.set(lh.header, ptr); ptr += lh.header.length; out.set(lh.data, ptr); ptr += lh.data.length; });
    centralDirs.forEach((c) => { out.set(c.cd, ptr); ptr += c.cd.length; });
    const dv = new DataView(out.buffer);
    dv.setUint32(ptr, 0x06054b50, true); ptr +=4; // end sig
    dv.setUint16(ptr, 0, true); ptr+=2; dv.setUint16(ptr, 0, true); ptr+=2; // disk numbers
    dv.setUint16(ptr, centralDirs.length, true); ptr+=2; dv.setUint16(ptr, centralDirs.length, true); ptr+=2;
    dv.setUint32(ptr, centralSize, true); ptr+=4; dv.setUint32(ptr, centralOffset, true); ptr+=4;
    dv.setUint16(ptr, 0, true); ptr+=2;
    return new Blob([out], { type: 'application/zip' });
  }

  function downloadBlob(blob, name) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }

  async function openBulkSidebar() {
    if (!SUPPORTED_HOST) return;
    if (document.getElementById('acep-bulk-host')) { document.getElementById('acep-bulk-host').remove(); return; }
    const host = document.createElement('div'); host.id = 'acep-bulk-host'; host.style.position='fixed'; host.style.inset='0'; host.style.zIndex='2147483648'; host.style.pointerEvents='auto';
    const shadow = host.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = `:host{all:initial}.panel{position:fixed;right:0;top:0;width:${SIDEBAR_WIDTH}px;height:100vh;background:#fff;border-left:1px solid #ddd;padding:0;display:flex;flex-direction:column;font-family:Inter,Segoe UI,Arial}
    .top{display:flex;align-items:center;justify-content:space-between;padding:12px;background:#512DA8;color:#fff}
    .tabs{display:flex;gap:8px;padding:8px}
    .tabs button{padding:8px 10px;border-radius:8px;border:1px solid #ddd;background:#fafafa;cursor:pointer}
    .tabs button.active{background:#512DA8;color:#fff;border-color:#512DA8}
    .list{flex:1;overflow:auto;padding:10px}
    .row{display:flex;align-items:center;gap:8px;padding:8px;border-bottom:1px solid #f2f2f2}
    .footer{padding:10px;border-top:1px solid #eee;display:flex;gap:8px;align-items:center}
    `;
    shadow.appendChild(style);
    const panel = document.createElement('div'); panel.className='panel';
    panel.innerHTML = `<div class="top"><div style="font-weight:800">Bulk Export (ChatGPT)</div><button id="bulk-close" style="background:transparent;border:0;color:#fff;cursor:pointer">&times;</button></div>
      <div class="tabs"><button data-tab="chats" class="active">Chats</button><button data-tab="projects">Projects</button></div>
      <div class="list" id="bulk-list">Loading...</div>
      <div class="footer"><div id="bulk-selected">0 selected</div><select id="bulk-format"><option value="json">JSON</option><option value="html">HTML (stub)</option></select><button id="bulk-export" class="btn">Export (ZIP)</button></div>`;
    shadow.appendChild(panel);
    document.body.appendChild(host);

    const listEl = shadow.getElementById('bulk-list');
    const tabs = shadow.querySelectorAll('.tabs button');
    let mode = 'chats';
    let items = [];
    let selected = new Set();
    let displayedCount = 0;
    const PAGE_SIZE = 20;
    const updateSelected = () => { shadow.getElementById('bulk-selected').textContent = `${selected.size} selected`; };

    function getProjectName(item) {
      try {
        const gizmo = item?.gizmo?.gizmo || item?.resource?.gizmo || item?.gizmo || item;
        const candidates = [
          gizmo?.display?.name,
          gizmo?.display?.short_name,
          gizmo?.display?.name_localized,
          gizmo?.display?.title,
          gizmo?.display?.title_localized,
          gizmo?.title,
          gizmo?.name,
          gizmo?.short_name,
          item?.display?.name,
          item?.display?.title,
          item?.title,
          item?.name,
          item?.project?.name,
          item?.project?.title,
          item?.metadata?.title
        ];
        for (const v of candidates) if (typeof v === 'string' && v.trim()) return v.trim();
      } catch(e){}
      return '(project)';
    }

    function getProjectCountLabel(item) {
      try {
        const gizmo = item?.gizmo?.gizmo || item?.resource?.gizmo || item?.gizmo || item;
        const countCandidates = [
          item?.conversations?.total,
          item?.conversations?.count,
          item?.conversation_count,
          item?.num_conversations,
          gizmo?.vanity_metrics?.num_conversations,
          gizmo?.conversation_count,
          gizmo?.conversationTotal,
          item?.conversations?.items?.length
        ];
        // accept numeric strings as well
        const explicitCount = countCandidates.find(v => (typeof v === 'number') || (typeof v === 'string' && /^\d+$/.test(v)));
        let totalCount = null;
        if (explicitCount !== undefined && explicitCount !== null) {
          if (typeof explicitCount === 'number') totalCount = explicitCount;
          else if (typeof explicitCount === 'string' && /^\d+$/.test(explicitCount)) totalCount = parseInt(explicitCount, 10);
        }
        const listCount = Array.isArray(item?.conversations?.items) ? item.conversations.items.length : null;
        if (totalCount === null) totalCount = listCount;
        if (totalCount === null || totalCount === undefined) return '0';
        return String(totalCount);
      } catch(e) { return '0'; }
    }

    tabs.forEach(b => b.addEventListener('click', async () => {
      tabs.forEach(x=>x.classList.toggle('active', x===b)); mode = b.dataset.tab; listEl.innerHTML = 'LoadingÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¾Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¦ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¦'; selected.clear(); updateSelected();
      // reset pagination when switching tabs
      displayedCount = 0;
      if (mode==='chats') {
        items = await fetchConversationsForBulk();
        try { console.log('[ACEP] bulk mode=chats fetched items count=', (items && items.length)); } catch(e){}
        if (!items || !items.length) items = await readStoredConversationsFallback();
        try { console.log('[ACEP] bulk mode=chats after fallback items count=', (items && items.length)); } catch(e){}
        renderItems();
      } else {
        items = await fetchProjectsForBulk();
        try { console.log('[ACEP] bulk mode=projects fetched items count=', (items && items.length)); } catch(e){}
        if (!items || !items.length) items = await readStoredProjectsFallback();
        try { console.log('[ACEP] bulk mode=projects after fallback items count=', (items && items.length)); } catch(e){}
        // log a sample project for debugging
        try { if (items && items.length) console.log('[ACEP] sample project:', JSON.parse(JSON.stringify(items[0]))); } catch(e){}
        renderItems(true);
      }
    }));

    function renderItems(projectMode=false) {
      listEl.innerHTML = '';
      if (!items || !items.length) { listEl.textContent = 'No items found.'; return; }
      if (displayedCount <= 0) displayedCount = Math.min(PAGE_SIZE, items.length);
      const slice = items.slice(0, displayedCount);
      slice.forEach(it => {
        const row = document.createElement('div'); row.className='row';
        const cb = document.createElement('input'); cb.type='checkbox';
        const title = document.createElement('div'); title.style.flex='1';
        if (projectMode) title.textContent = getProjectName(it);
        else title.textContent = (it?.title || it?.id || it?.conversation_id || '(untitled)');
        row.appendChild(cb); row.appendChild(title);
        listEl.appendChild(row);
        cb.addEventListener('change', () => {
          if (cb.checked) {
            if (selected.size >= 20) { cb.checked = false; alert('Maximum 20 chats can be selected for bulk export.'); return; }
            selected.add(it);
          } else selected.delete(it);
          updateSelected();
        });
        if (projectMode) {
          const countLabel = getProjectCountLabel(it);
          const sub = document.createElement('div'); sub.style.padding='6px 10px'; sub.style.fontSize='12px'; sub.style.color='#666'; sub.textContent = `${countLabel} chats`;
          row.appendChild(sub);
        }
      });
      // Load more control
      if (displayedCount < items.length) {
        const more = document.createElement('div'); more.style.padding = '10px'; more.style.textAlign = 'center';
        const btn = document.createElement('button'); btn.textContent = 'Load more'; btn.style.padding='6px 10px'; btn.style.cursor='pointer';
        btn.addEventListener('click', () => { displayedCount = Math.min(displayedCount + PAGE_SIZE, items.length); renderItems(projectMode); });
        more.appendChild(btn); listEl.appendChild(more);
      }
      updateSelected();
    }

    items = await fetchConversationsForBulk();
    try { console.log('[ACEP] bulk initial fetched chats count=', (items && items.length)); } catch(e){}
    if (!items || !items.length) items = await readStoredConversationsFallback();
    try { console.log('[ACEP] bulk initial after fallback chats count=', (items && items.length)); } catch(e){}
    renderItems();

    shadow.getElementById('bulk-close').addEventListener('click', () => host.remove());

    shadow.getElementById('bulk-export').addEventListener('click', async () => {
      if (!selected.size) { alert('Select at least one chat or project.'); return; }
      try {
        const files = [];
        for (const it of selected) {
          if (mode === 'projects') {
            const projName = (it?.gizmo?.display?.name) || (it?.title) || (`project-${it?.id||Date.now()}`);
            const meta = { id: it?.gizmo?.id || it?.id, title: projName };
            files.push({ path: `${projName}/_project.json`, content: JSON.stringify(meta, null, 2) });
            const convs = Array.isArray(it?.conversations?.items) ? it.conversations.items : [];
            convs.slice(0,20).forEach(c => {
              const content = { id: c.id || c.conversation_id, title: c.title || '', link: `https://chatgpt.com/c/${c.id||c.conversation_id}` };
              files.push({ path: `${projName}/${content.id || 'chat'}.json`, content: JSON.stringify(content, null, 2) });
            });
          } else {
            const content = { id: it.id || it.conversation_id, title: it.title || '', link: `https://chatgpt.com/c/${it.id||it.conversation_id}` };
            files.push({ path: `${content.id || 'chat'}.json`, content: JSON.stringify(content, null, 2) });
          }
        }
        const zip = buildZip(files);
        const now = new Date().toISOString().replace(/[:.]/g,'-');
        downloadBlob(zip, `acep-bulk-${now}.zip`);
      } catch (e) { alert('Bulk export failed: '+String(e)); }
    });
  }

  function removeExportButton() {
    stopExportButtonHeartbeat();
    const host = document.getElementById(`${BTN_ID}-host`);
    if (host && host.parentNode) host.parentNode.removeChild(host);
  }
  let EXPORT_BTN_HEARTBEAT = null;
  function startExportButtonHeartbeat() {
    if (EXPORT_BTN_HEARTBEAT) return;
    EXPORT_BTN_HEARTBEAT = setInterval(() => {
      try {
        if (!STATE.enabled || !SUPPORTED_HOST) return;
        const hostId = `${BTN_ID}-host`;
        const host = document.getElementById(hostId);
        if (!host || !host.isConnected) {
          injectExportButton();
          return;
        }
        const shadowBtn = host.shadowRoot && host.shadowRoot.getElementById(BTN_ID);
        if (!shadowBtn) {
          injectExportButton();
          return;
        }
        host.style.display = 'block';
      } catch {}
    }, 2000);
  }
  function stopExportButtonHeartbeat() {
    if (EXPORT_BTN_HEARTBEAT) {
      clearInterval(EXPORT_BTN_HEARTBEAT);
      EXPORT_BTN_HEARTBEAT = null;
    }
  }
  let EXPORT_BTN_OBS = null;
  function ensureExportButtonWatcher() {
    if (EXPORT_BTN_OBS || typeof MutationObserver === 'undefined') return;
    EXPORT_BTN_OBS = new MutationObserver(() => {
      if (!STATE.enabled || !SUPPORTED_HOST) return;
      if (!document.getElementById(`${BTN_ID}-host`)) {
        try { injectExportButton(); } catch {}
      }
    });
    try {
      EXPORT_BTN_OBS.observe(document.documentElement || document.body, { childList: true, subtree: true });
    } catch {}
  }
  async function getExportSourceContext() {
    const exportSessionId = (globalThis.crypto?.randomUUID?.())
      || `acep-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    let sourceTabId = null;
    try {
      const response = await browser.runtime.sendMessage({ type: 'ACEP_GET_SENDER_TAB' });
      sourceTabId = Number(response?.tab?.id) || null;
    } catch {}
    return {
      exportSessionId,
      sourceTabId,
      sourceChatId: `${HOST}${location.pathname}${location.search}`,
    };
  }

  function ensureHiddenExportFrame(source = {}) {
    try {
      const mount = document.body || document.documentElement;
      if (!mount) return null;
      let frame = document.getElementById(IFRAME_ID);
      const sessionId = String(source.exportSessionId || '');
      const sourceTabId = Number(source.sourceTabId) || '';
      const popupUrl = new URL(browser.runtime.getURL('popup.html'));
      if (sessionId) popupUrl.searchParams.set('exportSessionId', sessionId);
      if (sourceTabId) popupUrl.searchParams.set('sourceTabId', String(sourceTabId));
      const desiredSrc = popupUrl.href;
      if (!frame) {
        frame = document.createElement('iframe');
        frame.id = IFRAME_ID;
        frame.src = desiredSrc;
        mount.appendChild(frame);
        frame.addEventListener('load', () => {
          try { frame.dataset.ready = '1'; } catch {}
          try { frame.contentWindow.postMessage({ type: 'ACEP_LOCALE_PACK', lang: STATE.lang, messages: STATE.messages }, '*'); } catch {}
        });
      } else if (sessionId && frame.dataset.exportSessionId !== sessionId) {
        frame.dataset.ready = '';
        frame.src = desiredSrc;
      }
      if (sessionId) frame.dataset.exportSessionId = sessionId;
      // Keep it invisible ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¾Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¦ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â it only runs the export engine
      Object.assign(frame.style, {
        position: 'fixed', top: '0', left: '0',
        width: '100vw', height: '100vh', border: '0',
        opacity: '0', pointerEvents: 'none', display: 'block', zIndex: '-1',
      });
      try { frame.contentWindow.postMessage({ type: 'ACEP_LOCALE_PACK', lang: STATE.lang, messages: STATE.messages }, '*'); } catch {}
      try { if (!frame.dataset.ready && frame.contentDocument?.readyState === 'complete') frame.dataset.ready = '1'; } catch {}
      return frame;
    } catch (e) {
      console.error('ensureHiddenExportFrame failed', e);
    }
    return null;
  }

  function openPopupOverlay() {
    console.log('[ACEP content] openPopupOverlay() called');
    try {
      const mount = document.body || document.documentElement;
      if (!mount) return null;
      let frame = document.getElementById(IFRAME_ID);
      if (!frame) {
        frame = document.createElement('iframe');
        frame.id = IFRAME_ID;
        frame.src = browser.runtime.getURL('popup.html');
        mount.appendChild(frame);
        frame.addEventListener('load', () => {
          try { frame.dataset.ready = '1'; } catch {}
          try {
            frame.contentWindow.postMessage(
              { type: 'ACEP_LOCALE_PACK', lang: STATE.lang, messages: STATE.messages },
              '*'
            );
          } catch {}
        });
      }
      Object.assign(frame.style, {
        position: 'fixed', inset: '0', width: '100vw', height: '100vh',
        background: 'transparent', border: '0', zIndex: '2147483647',
        opacity: '1', pointerEvents: 'auto', display: 'block'
      });
      try {
        frame.contentWindow.postMessage(
          { type: 'ACEP_LOCALE_PACK', lang: STATE.lang, messages: STATE.messages },
          '*'
        );
      } catch {}
      try {
        if (!frame.dataset.ready && frame.contentDocument?.readyState === 'complete') {
          frame.dataset.ready = '1';
        }
      } catch {}
      return frame;
    } catch (e) {
      console.error('openPopupOverlay failed', e);
    }
    return null;
  }
  const RESULT_PANEL_HOST_ID = 'acep-result-panel-host';
  const LOADING_OVERLAY_HOST_ID = 'acep-loading-overlay-host';
  const MUTED_PROGRESS_HOST_ID = 'acep-muted-progress-host';

  function getExportLoadingMessages() {
    const t = (key) => {
      const val = STATE.messages?.[key]?.message;
      if (val) return val;
      try { return browser?.i18n?.getMessage ? browser.i18n.getMessage(key) : ''; } catch { return ''; }
    };
    const messages = [
      t('progress_reading'),
      t('progress_long'),
      t('progress_preparing'),
      t('progress_composing'),
      t('progress_finishing'),
      t('busy_alert'),
    ].filter(Boolean);
    return messages.length ? Array.from(new Set(messages)) : ['Preparing your exportÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¾Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¦ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¦'];
  }

  function showExportLoadingOverlay() {
    try { document.getElementById(LOADING_OVERLAY_HOST_ID)?.remove(); } catch {}
    const host = document.createElement('div');
    host.id = LOADING_OVERLAY_HOST_ID;
    const shadow = host.attachShadow({ mode: 'open' });
    const messages = getExportLoadingMessages();
    let currentMessageIndex = 0;
    shadow.innerHTML = `
      <style>
        *{box-sizing:border-box;margin:0;padding:0;}
        #ov{position:fixed;inset:0;z-index:2147483646;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.06);animation:ov-in .22s ease;}
        @keyframes ov-in{from{opacity:0}to{opacity:1}}
        #card{background:#fff;border-radius:24px;padding:38px 48px;box-shadow:0 16px 56px rgba(126,87,194,.30),0 4px 12px rgba(0,0,0,.08);display:flex;flex-direction:column;align-items:center;gap:22px;min-width:210px;}
        .spinner{width:48px;height:48px;border:4px solid #EDE7F6;border-top-color:#7E57C2;border-radius:50%;animation:spin .75s linear infinite;}
        @keyframes spin{to{transform:rotate(360deg)}}
        #msg{color:#512DA8;font-size:14px;font-weight:700;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;letter-spacing:.01em;text-align:center;}
      </style>
      <div id="ov"><div id="card"><div class="spinner"></div><div id="msg">${messages[0]}</div></div></div>`;
    (document.body || document.documentElement).appendChild(host);

    if (messages.length > 1) {
      host._acepLoadingRotation = setInterval(() => {
        try {
          if (host._acepPinnedMessageUntil && Date.now() < host._acepPinnedMessageUntil) return;
        } catch {}
        currentMessageIndex = (currentMessageIndex + 1) % messages.length;
        try {
          const msgEl = shadow.getElementById('msg');
          if (msgEl) msgEl.textContent = messages[currentMessageIndex];
        } catch {}
      }, 4500);
    }

    // Keep the overlay visible for long-running exports; normal completion still clears it via ACEP_SET_BUSY.
    host._acepLoadingHideTimer = setTimeout(() => { try { hideExportLoadingOverlay(); } catch {} }, 2 * 60 * 60 * 1000);
  }

  function updateExportLoadingOverlay(message = '', pinMs = 12000) {
    try {
      const text = String(message || '').trim();
      if (!text) return;
      const host = document.getElementById(LOADING_OVERLAY_HOST_ID);
      const shadow = host?.shadowRoot || null;
      const msgEl = shadow?.getElementById?.('msg');
      if (!msgEl) return;
      msgEl.textContent = text;
      host._acepPinnedMessageUntil = Date.now() + Math.max(0, Number(pinMs) || 0);
    } catch {}
  }

  function hideExportLoadingOverlay() {
    try {
      const host = document.getElementById(LOADING_OVERLAY_HOST_ID);
      if (host && host._acepLoadingRotation) clearInterval(host._acepLoadingRotation);
      if (host && host._acepLoadingHideTimer) clearTimeout(host._acepLoadingHideTimer);
      if (host) host.remove();
    } catch {}
  }

  function showMutedExportProgress(message = '') {
    try {
      const text = String(message || '').trim() || getExportLoadingMessages()[0] || 'Preparing your export...';
      let host = document.getElementById(MUTED_PROGRESS_HOST_ID);
      let shadow = host?.shadowRoot || null;
      if (!host) {
        host = document.createElement('div');
        host.id = MUTED_PROGRESS_HOST_ID;
        host.style.cssText = 'position:fixed;top:14px;left:50%;transform:translateX(-50%);z-index:2147483646;pointer-events:none;';
        shadow = host.attachShadow({ mode: 'open' });
        shadow.innerHTML = `
          <style>
            *{box-sizing:border-box;margin:0;padding:0}
            #toast{min-width:220px;max-width:min(520px,calc(100vw - 28px));display:flex;align-items:center;gap:10px;padding:10px 14px;border-radius:999px;background:#ffffff;color:#2D1B69;border:1px solid #D1B8FF;box-shadow:0 10px 32px rgba(81,45,168,.22),0 3px 10px rgba(0,0,0,.08);font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;animation:drop .22s ease-out}
            @keyframes drop{from{opacity:0;transform:translateY(-12px)}to{opacity:1;transform:translateY(0)}}
            .dot{width:9px;height:9px;border-radius:50%;background:#7E57C2;box-shadow:0 0 0 0 rgba(126,87,194,.45);animation:pulse 1.2s ease-in-out infinite;flex:0 0 auto}
            @keyframes pulse{0%,100%{box-shadow:0 0 0 0 rgba(126,87,194,.45)}50%{box-shadow:0 0 0 7px rgba(126,87,194,0)}}
            #msg{font-size:13px;font-weight:800;line-height:1.35;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
          </style>
          <div id="toast"><span class="dot"></span><span id="msg"></span></div>`;
        (document.body || document.documentElement).appendChild(host);
      }
      const msgEl = shadow?.getElementById?.('msg');
      if (msgEl) msgEl.textContent = text;
      if (host._acepMutedProgressTimer) clearTimeout(host._acepMutedProgressTimer);
      host._acepMutedProgressTimer = setTimeout(() => {
        try { hideMutedExportProgress(); } catch {}
      }, 20 * 60 * 1000);
    } catch {}
  }

  function hideMutedExportProgress(delayMs = 0) {
    try {
      const host = document.getElementById(MUTED_PROGRESS_HOST_ID);
      if (!host) return;
      if (host._acepMutedProgressTimer) clearTimeout(host._acepMutedProgressTimer);
      setTimeout(() => {
        try { document.getElementById(MUTED_PROGRESS_HOST_ID)?.remove(); } catch {}
      }, Math.max(0, Number(delayMs) || 0));
    } catch {}
  }

  function showExportResultPanel(fileName) {
    // Remove any existing panel
    try { document.getElementById(RESULT_PANEL_HOST_ID)?.remove(); } catch {}
    const host = document.createElement('div');
    host.id = RESULT_PANEL_HOST_ID;
    host.style.cssText = 'position:fixed;inset:0;z-index:2147483647;display:flex;align-items:center;justify-content:center;pointer-events:none;animation:rph-in .22s ease;';
    const shadow = host.attachShadow({ mode: 'open' });
    const displayName = String(fileName || 'export').slice(0, 60);
    const t = (k, d) => (STATE.messages?.[k]?.message) || (browser?.i18n?.getMessage ? browser.i18n.getMessage(k) : '') || d || '';
    shadow.innerHTML = `
      <style>
        *{box-sizing:border-box;margin:0;padding:0;}
        #rp{width:min(92vw,400px);background:#fff;border-radius:20px;box-shadow:0 20px 60px rgba(126,87,194,.35),0 4px 12px rgba(0,0,0,.08);font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;overflow:hidden;animation:rp-in .28s ease;pointer-events:auto;}
        @keyframes rp-in{from{opacity:0;transform:scale(.94)}to{opacity:1;transform:scale(1)}}
        #rp-head{background:linear-gradient(135deg,#7E57C2,#512DA8);padding:14px 16px;display:flex;align-items:center;gap:10px;}
        #rp-icon{font-size:20px;flex-shrink:0;}
        #rp-titles{flex:1;min-width:0;}
        #rp-title{color:#fff;font-weight:700;font-size:13px;letter-spacing:.01em;}
        #rp-fname{color:rgba(255,255,255,.8);font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:2px;}
        #rp-close{background:none;border:none;color:rgba(255,255,255,.6);font-size:20px;cursor:pointer;padding:2px 4px;line-height:1;border-radius:4px;flex-shrink:0;}
        #rp-close:hover{color:#fff;background:rgba(255,255,255,.15);}
        #rp-body{padding:14px 16px;display:flex;flex-direction:column;gap:10px;}
        #rp-btns{display:flex;gap:8px;}
        .rp-btn-primary{flex:1;background:linear-gradient(135deg,#7E57C2,#512DA8);color:#fff;border:none;border-radius:8px;padding:9px 14px;font-size:13px;font-weight:600;cursor:pointer;transition:opacity .15s;}
        .rp-btn-primary:hover{opacity:.88;}
        .rp-btn-secondary{flex:1;background:#F3EFFE;color:#7E57C2;border:1px solid #D1B8FF;border-radius:8px;padding:9px 14px;font-size:13px;font-weight:600;cursor:pointer;transition:background .15s;}
        .rp-btn-secondary:hover{background:#e8dbff;}
        .rp-btn-secondary:disabled{opacity:.5;cursor:default;}
        #rp-linkrow{display:none;background:#F3EFFE;border-radius:10px;padding:10px 12px;flex-direction:column;gap:8px;}
        #rp-linkrow.visible{display:flex;}
        #rp-linkurl{color:#5E35B1;font-size:11px;word-break:break-all;text-decoration:none;}
        #rp-linkurl:hover{text-decoration:underline;}
        #rp-copylink{background:#7E57C2;color:#fff;border:none;border-radius:6px;padding:5px 14px;font-size:12px;cursor:pointer;align-self:flex-end;transition:opacity .15s;}
        #rp-copylink:hover{opacity:.85;}
        #rp-spinner{font-size:11px;color:#7E57C2;text-align:center;}
      </style>
      <div id="rp">
        <div id="rp-head">
          <span id="rp-icon" aria-hidden="true">OK</span>
          <div id="rp-titles">
            <div id="rp-title">${t('resultpanel_title', 'Export ready!')}</div>
            <div id="rp-fname" title="${displayName}">${displayName}</div>
          </div>
          <button id="rp-close" title="${t('resultpanel_dismiss', 'Dismiss')}">&#x2715;</button>
        </div>
        <div id="rp-body">
          <div id="rp-btns">
            <button class="rp-btn-primary" id="rp-download">&#x2B07; ${t('resultpanel_download', 'Download')}</button>
            <button class="rp-btn-secondary" id="rp-genlink">&#x1F517; ${t('resultpanel_share_link', 'Share Link')}</button>
          </div>
          <div id="rp-linkrow">
            <a id="rp-linkurl" href="#" target="_blank" rel="noopener"></a>
            <button id="rp-copylink">${t('resultpanel_copy_link', 'Copy link')}</button>
          </div>
        </div>
      </div>`;
    const iframe = document.getElementById(IFRAME_ID);
    const dismissResultPanel = () => {
      try { host.remove(); } catch {}
      try { document.getElementById(IFRAME_ID)?.remove(); } catch {}
      try { window.dispatchEvent(new MessageEvent('message', { data: { type: 'ACEP_OPEN_SUPPORT_MODAL' } })); } catch {}
    };
    shadow.getElementById('rp-close').addEventListener('click', dismissResultPanel);
    host.addEventListener('click', (e) => {
      const panel = shadow.getElementById('rp');
      if (panel && e.composedPath().includes(panel)) return;
      dismissResultPanel();
    });
    shadow.getElementById('rp-download').addEventListener('click', () => {
      try { iframe?.contentWindow?.postMessage({ type: 'ACEP_IFRAME_DOWNLOAD' }, '*'); } catch {}
    });
    shadow.getElementById('rp-genlink').addEventListener('click', () => {
      const btn = shadow.getElementById('rp-genlink');
      if (btn) { btn.disabled = true; btn.textContent = t('resultpanel_generating', 'Generating\u2026'); }
      const spinner = shadow.getElementById('rp-spinner');
      if (spinner) spinner.style.display = 'block';
      try { iframe?.contentWindow?.postMessage({ type: 'ACEP_IFRAME_GENERATE_LINK' }, '*'); } catch {}
    });
    shadow.getElementById('rp-copylink').addEventListener('click', () => {
      const url = shadow.getElementById('rp-linkurl')?.href || '';
      if (!url || url === location.href) return;
      try { navigator.clipboard.writeText(url); } catch {
        try {
          const ta = document.createElement('textarea');
          ta.value = url; ta.style.position = 'fixed'; ta.style.left = '-9999px';
          document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove();
        } catch {}
      }
      const btn = shadow.getElementById('rp-copylink');
      if (btn) {
        btn.textContent = t('resultpanel_copied', 'Copied!');
        setTimeout(() => { try { btn.textContent = t('resultpanel_copy_link', 'Copy link'); } catch {} }, 2000);
      }
    });
    (document.body || document.documentElement).appendChild(host);
  }

  function updateExportPanelShareUrl(url) {
    const host = document.getElementById(RESULT_PANEL_HOST_ID);
    if (!host || !host.shadowRoot) return;
    const shadow = host.shadowRoot;
    const linkrow = shadow.getElementById('rp-linkrow');
    const linkurl = shadow.getElementById('rp-linkurl');
    const genBtn  = shadow.getElementById('rp-genlink');
    const t = (k, d) => (STATE.messages?.[k]?.message) || (browser?.i18n?.getMessage ? browser.i18n.getMessage(k) : '') || d || '';
    if (linkurl) { linkurl.textContent = url; linkurl.href = url; }
    if (linkrow) linkrow.classList.add('visible');
    if (genBtn)  { genBtn.disabled = false; genBtn.textContent = `\u{1F517} ${t('resultpanel_share_link', 'Share Link')}`; }
  }

  function normalizeAnalyticsFormat(format = '') {
    const clean = String(format || '').toLowerCase().replace(/[^a-z0-9_-]/g, '');
    return clean || 'unknown';
  }

  function analyticsProviderFromHost() {
    try {
      if (/claude\.ai$/i.test(HOST)) return 'claude';
      if (/(chatgpt\.com|chat\.openai\.com)$/i.test(HOST)) return 'chatgpt';
      if (/gemini\.google\.com$/i.test(HOST)) return 'gemini';
      if (/deepseek\.com$/i.test(HOST)) return 'deepseek';
      if (/grok\.com$/i.test(HOST)) return 'grok';
      if (/meta\.ai$/i.test(HOST)) return 'meta';
    } catch {}
    return 'unknown';
  }

  async function sendContentExportAnalyticsFallback(format = '') {
    try {
      const store = browser?.storage?.local;
      if (store?.get) {
        const recent = await store.get({ acep_last_analytics_attempt: null, acep_last_analytics_popup_attempt: null });
        const latestAt = recent?.acep_last_analytics_attempt?.at || recent?.acep_last_analytics_popup_attempt?.at || '';
        if (latestAt && Date.now() - Date.parse(latestAt) < 10000) return;
        try { await store.set({ acep_last_analytics_content_attempt: { at: new Date().toISOString(), stage: 'content_fallback' } }); } catch {}
      }
      const payload = {
        format: normalizeAnalyticsFormat(format),
        provider: analyticsProviderFromHost(),
        status: 'success',
        duration_ms: 0,
        browser: (() => { try { const ua = navigator.userAgent || ''; if (/Edg/i.test(ua)) return 'edge'; if (/Firefox/i.test(ua)) return 'firefox'; if (/Chrome/i.test(ua)) return 'chrome'; } catch {} return 'unknown'; })(),
        timestamp: new Date().toISOString(),
        export_mode: 'unknown',
      };
      try {
        chrome?.runtime?.sendMessage?.({ type: 'ACEP_ANALYTICS_EXPORT', payload }, () => {});
      } catch {
        try { browser?.runtime?.sendMessage?.({ type: 'ACEP_ANALYTICS_EXPORT', payload })?.catch?.(() => {}); } catch {}
      }
    } catch {}
  }
  let windowMessageHandlerInstalled = false;
  function installWindowMessageHandlerOnce() {
    if (windowMessageHandlerInstalled) return;
    windowMessageHandlerInstalled = true;
    window.addEventListener('message', (ev) => {
      try {
        const data = ev && ev.data;
        if (data === 'ACEP_POPUP_CLOSE') {
          const f = document.getElementById(IFRAME_ID);
          if (f) f.remove();
          return;
        }
        if (data && data.type === 'ACEP_IFRAME_MUTE') {
          const f = document.getElementById(IFRAME_ID);
          if (f) {
            if (data.mute) {
              f.style.opacity = '0';
              f.style.pointerEvents = 'none';
              f.style.display = 'block';
            } else {
              f.style.opacity = '1';
              f.style.pointerEvents = 'auto';
              f.style.display = 'block';
            }
          }
          return;
        }
        if (data && data.type === 'ACEP_SET_BUSY') {
          ACEP_RENDER_BUSY = !!data.busy;
          STATE.busy = !!data.busy;
          if (!data.busy) {
            try { hideExportLoadingOverlay(); } catch {}
            try { hideMutedExportProgress(350); } catch {}
          }
          return;
        }
        if (data && data.type === 'ACEP_MUTED_EXPORT_PROGRESS') {
          try { if (!data.done && data.message) globalThis.__acepSidebarSetProgress?.(data.message); } catch {}
          if (data.done) hideMutedExportProgress(700);
          else showMutedExportProgress(data.message || '');
          return;
        }
        if (data && data.type === 'ACEP_EXPORT_PROGRESS') {
          try { if (!data.done && data.message) globalThis.__acepSidebarSetProgress?.(data.message); } catch {}
          return;
        }
        if (data && data.type === 'ACEP_IFRAME_SET_VIS') {
          const f = document.getElementById(IFRAME_ID);
          if (f) f.style.display = data.show ? 'block' : 'none';
          return;
        }
        if (data && data.type === 'ACEP_EXPORT_READY') {
          try { sendContentExportAnalyticsFallback(data.format || ''); } catch {}
          try {
            hideExportLoadingOverlay();
            hideMutedExportProgress(700);
            const muteFlags = globalThis.__acepMuteFlags || {};
            if (muteFlags.muteDownload) {
              // Mute download UX: skip the result/share panel and show the post-success modal instead.
              try {
                ensureModalFromTemplate().then((dlg) => {
                  try { if (dlg) { dlg.setAttribute('aria-hidden','false'); dlg.style.display='flex'; } } catch {}
                });
              } catch {}
              try { document.getElementById(IFRAME_ID)?.remove(); } catch {}
            } else {
              showExportResultPanel(data.fileName);
            }
          } catch {}
          return;
        }
        if (data && data.type === 'ACEP_SHARE_URL_READY') {
          try { updateExportPanelShareUrl(data.url); } catch {}
          return;
        }
        if (data && data.type === 'ACEP_OPEN_SUPPORT_MODAL') {
          (async () => {
            try {
              const dlg = await ensureModalFromTemplate();
              if (dlg) { dlg.setAttribute('aria-hidden','false'); dlg.style.display='flex'; }
            } catch {}
          })();
          return;
        }
      } catch (err) {
        console.debug('window message ignored:', err);
      }
    });
  }
  installWindowMessageHandlerOnce();

  // Allow popup/background to request a data URL fetch from page context (with cookies)
  browser.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg && msg.type === 'ACEP_DEEPSEEK_RESOLVE_PREVIEW_URL') {
      (async () => {
        try {
          const url = String(msg.url || '');
          const isDeepSeekFileUrl = (value = '') => /myhuaweicloud|deepseek-api-files|\bobs\./i.test(String(value || ''));
          const pickUrl = (value) => {
            if (!value || typeof value !== 'object') return '';
            const direct = value.url || value.download_url || value.downloadUrl || value.preview_url || value.previewUrl || value.file_url || value.fileUrl;
            if (typeof direct === 'string' && direct) return direct;
            for (const key of ['data', 'biz_data', 'bizData', 'result', 'payload']) {
              const nested = pickUrl(value[key]);
              if (nested) return nested;
            }
            return '';
          };

          let resolvedUrl = findDeepSeekObsUrlForPreview(url);
          if (!resolvedUrl && /^https?:/i.test(url)) {
            const provider = getProvider();
            const extra = (provider && typeof provider.getInlineImageFetchOptions === 'function') ? (provider.getInlineImageFetchOptions(url) || null) : null;
            const headers = { ...((extra && extra.headers) || {}) };
            const response = await fetch(url, {
              mode: 'cors',
              credentials: 'omit',
              cache: 'no-store',
              ...(extra || {}),
              ...(Object.keys(headers).length ? { headers } : {}),
              redirect: 'follow',
            });

            if (response && response.url && isDeepSeekFileUrl(response.url)) {
              resolvedUrl = response.url;
            }

            if (!resolvedUrl) {
              const contentType = String(response.headers.get('content-type') || '').toLowerCase();
              if (contentType.includes('application/json')) {
                const json = await response.clone().json();
                const picked = pickUrl(json);
                if (picked) {
                  try {
                    resolvedUrl = new URL(picked, ORIGIN).href;
                  } catch {
                    resolvedUrl = String(picked);
                  }
                }
              }
            }
          }

          sendResponse({ ok: !!resolvedUrl, url: resolvedUrl || '' });
        } catch (e) {
          try { sendResponse({ ok: false, url: '', error: String(e?.message || e) }); } catch {}
        }
      })();
      return true;
    }
    if (msg && msg.type === 'ACEP_SET_PAGE_DEBUG_ATTR') {
      try {
        const name = String(msg.name || '');
        const value = String(msg.value || '');
        if (/^data-acep-[a-z0-9_-]+$/i.test(name)) {
          document.documentElement.setAttribute(name, value.slice(0, 4000));
          sendResponse({ ok: true });
        } else {
          sendResponse({ ok: false, error: 'invalid attribute name' });
        }
      } catch (e) {
        try { sendResponse({ ok: false, error: String(e?.message || e) }); } catch {}
      }
      return true;
    }
    if (!(msg && msg.type === 'ACEP_FETCH_DATAURL' && typeof msg.url === 'string')) return;
    (async () => {
      try {
        const u = String(msg.url || '');
        if (!/^https?:/i.test(u)) {
          sendResponse({ ok: false, error: 'unsupported url' });
          return;
        }
        // ChatGPT file download endpoint returns JSON { download_url: "cdn_url" }.
        // Fetch the JSON with cookies (same-origin), then fetch the CDN URL without credentials
        // (SAS token in the URL provides auth; credentials: include would fail CORS on Azure CDN).
        if (/chatgpt\.com\/backend-api\/files\/(?:download\/[^/?#]+|[^/]+\/download)/i.test(u)) {
          try {
            const dlResp = await fetch(u, { credentials: 'include', mode: 'cors', cache: 'no-store' });
            if (dlResp.ok) {
              const dlJson = await dlResp.json();
              const cdnUrl = dlJson?.download_url || dlJson?.url || '';
              if (cdnUrl && /^https?:\/\//i.test(cdnUrl)) {
                const dataUrl = await fetchAsDataURL(cdnUrl, { credentials: 'omit', mode: 'cors' });
                sendResponse({ ok: true, dataUrl });
                return;
              }
            }
          } catch {}
          sendResponse({ ok: false, error: 'chatgpt-download-resolve-failed' });
          return;
        }
        let creds = 'omit';
        try {
          if (/chat\.deepseek\.com\/api\/v0\/file\/(preview|content)\b/i.test(u) || /deepseek\.com\/api\/v0\/file\/(preview|content)\b/i.test(u)) {
            // DeepSeek file preview may redirect to signed OBS URLs; omit cookies so redirect remains CORS-readable.
            creds = 'omit';
          } else if (sameOrigin(u)) {
            creds = 'include';
          } else if (/chatgpt\.com\/backend-api\/estuary\/content/i.test(u)) {
            creds = 'include';
          } else if (/assets\.grok\.com/i.test(u)) {
            creds = 'include';
          } else if (/deepseek-api-files|myhuaweicloud|\bobs\./i.test(u)) {
            // DeepSeek OBS responds with CORS headers; omit credentials to avoid CORS rejection.
            creds = 'omit';
          }
        } catch {}
        if (/^https?:\/\/[^\/]*googleusercontent\.com\//i.test(u) || /^https?:\/\/[^\/]*lh3\.google\.com\//i.test(u)) {
          sendResponse({ ok: false, error: 'skip-page-fetch' });
          return;
        }

        const dataUrl = await fetchAsDataURL(u, { credentials: creds, mode: 'cors' });
        sendResponse({ ok: true, dataUrl });
      } catch (e) {
        try { sendResponse({ ok: false, error: String(e?.message || e) }); } catch {}
      }
    })();
    return true;
  });

  const sleep = (ms)=>new Promise(r=>setTimeout(r,ms));
  async function gentleScroll() {
    if (Date.now() - ACEP_LAST_AUTOSCROLL_AT < 60000) return;
    ACEP_LAST_AUTOSCROLL_AT = Date.now();
    const scrollable = document.scrollingElement || document.documentElement;
    const h = scrollable.scrollHeight;
    const step = Math.max(300, Math.floor(h / 6));
    let y = 0;
    while (y < h) {
      window.scrollTo(0, y);
      await sleep(60);
      y += step;
    }
    window.scrollTo(0, 0);
  }
  async function autoScrollForExport({ minMs = 5000, maxMs = 30000 } = {}) {
    const findBestScrollable = () => {
      const canScroll = (el) => {
        try {
          if (!el || typeof el.scrollTop !== 'number') return false;
          const before = el.scrollTop;
          el.scrollTop = before + 64;
          const changed = el.scrollTop !== before;
          el.scrollTop = before;
          return changed;
        } catch {
          return false;
        }
      };
      const isScrollable = (el) => {
        if (!el || !(el instanceof HTMLElement)) return false;
        const style = getComputedStyle(el);
        const oy = String(style.overflowY || '');
        if (!/(auto|scroll|overlay)/i.test(oy)) {
          if (!canScroll(el)) return false;
        }
        const diff = (el.scrollHeight || 0) - (el.clientHeight || 0);
        return diff > 200;
      };
      const findScrollableAncestor = (el) => {
        let cur = el;
        while (cur && cur !== document.body && cur !== document.documentElement) {
          if (isScrollable(cur)) return cur;
          cur = cur.parentElement;
        }
        return null;
      };
      // DeepSeek: the chat scrolls inside a virtual-list container; generic tree-walk often picks the wrong scroller.
      if (/deepseek\.com$/i.test(HOST)) {
        try {
          const direct = document.querySelector('.ds-virtual-list');
          if (direct && isScrollable(direct)) return direct;
        } catch {}
        try {
          const p = (typeof getProvider === 'function') ? getProvider() : null;
          const thread = (p && typeof p.getThreadContainer === 'function')
            ? p.getThreadContainer()
            : (document.querySelector('main') || null);
          const hint = thread?.querySelector?.(
            '.ds-virtual-list, [class*="virtual-list" i], [class*="markdown" i], [class*="break-words" i], p.whitespace-pre-wrap'
          ) || thread || null;
          const anc = hint ? findScrollableAncestor(hint) : null;
          if (anc) return anc;
          if (thread && isScrollable(thread)) return thread;
        } catch {}
      }
      // For all platforms: scan elements for the best scrollable
      const docEl = document.scrollingElement || document.documentElement;
      let best = docEl;
      let bestOverflow = (docEl.scrollHeight || 0) - (docEl.clientHeight || 0);
      // Scanning every element is expensive on large pages; sample nodes with a bounded TreeWalker
      // so we don't traverse the entire DOM (querySelectorAll('*') is O(N) and can take minutes).
      try {
        const root = document.body || document.documentElement;
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
        let seen = 0;
        let cur = walker.currentNode;
        while (cur && seen < 1200) {
          const el = cur;
          if (isScrollable(el)) {
            const overflow = (el.scrollHeight || 0) - (el.clientHeight || 0);
            if (overflow > bestOverflow + 200) {
              bestOverflow = overflow;
              best = el;
            }
          }
          seen++;
          cur = walker.nextNode();
        }
      } catch {}
      return best || docEl;
    };
    const scrollable = findBestScrollable();
    ACEP_LAST_AUTOSCROLL_EL = scrollable || null;
    try {
      const desc = {
        tag: scrollable?.tagName || null,
        id: scrollable?.id || null,
        cls: (scrollable?.className || '').toString().slice(0, 180),
        scrollHeight: scrollable?.scrollHeight ?? null,
        clientHeight: scrollable?.clientHeight ?? null,
      };
      document.documentElement.setAttribute('data-acep-autoscroll-target', JSON.stringify(desc));
    } catch {}
    const startScrollTop = (() => { try { return scrollable?.scrollTop ?? 0; } catch { return 0; } })();
    const viewH = () => Math.max(1, scrollable.clientHeight || window.innerHeight || 800);
    const totalFor = () => Math.max(0, (scrollable.scrollHeight || 0) - viewH());
    const duration = Math.min(maxMs, Math.max(2000, Number(minMs) || 5000));
    const stepPx = Math.max(160, Math.round(viewH * 0.4));
    const intervalMs = 70;
    const preId = 'acep-scroll-banner';
    let pre = document.getElementById(preId);
    if (!pre) {
      pre = document.createElement('div');
      pre.id = preId;
      const t = (k,d)=> (STATE.messages?.[k]?.message) || browser.i18n.getMessage(k) || d || '';
      pre.textContent = t('progress_scrolling', 'Loading chat for export...');
      Object.assign(pre.style, {
        position: 'fixed', top: '10px', right: '10px', zIndex: '2147483647',
        background: '#111827', color: '#fff', padding: '8px 10px', borderRadius: '6px',
        font: '12px/1.2 system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
        boxShadow: '0 4px 12px rgba(0,0,0,.2)'
      });
      document.documentElement.appendChild(pre);
    }
    const metricsStart = (() => {
      try {
        return {
          ts: Date.now(),
          host: HOST,
          scrollHeight: scrollable?.scrollHeight ?? null,
          clientHeight: scrollable?.clientHeight ?? null,
          turnCount: (/deepseek\.com$/i.test(HOST) ? (getSelectableTurnNodes()?.length ?? null) : null),
        };
      } catch {
        return { ts: Date.now(), host: HOST };
      }
    })();
    const start = performance.now();
    let lastY = -1;
    let dynamicTotal = totalFor();
    const docEl = document.scrollingElement || document.documentElement;
    const isDocScroll = (scrollable === docEl || scrollable === document.documentElement || scrollable === document.body);
    const maxSteps = 9999;
    let steps = 0;
    while (performance.now() - start < maxMs && steps < maxSteps) {
      dynamicTotal = totalFor();
      let y = lastY < 0 ? 0 : lastY + stepPx;
      if (y > dynamicTotal) y = dynamicTotal;
      if (y !== lastY) {
        try { scrollable.scrollTop = y; } catch {}
        if (isDocScroll) { try { window.scrollTo(0, y); } catch {} }
        lastY = y;
      }
      if (y >= dynamicTotal) break;
      steps++;
      await sleep(intervalMs);
    }
    // Ensure bottom reached at least once.
    dynamicTotal = totalFor();
    try { scrollable.scrollTop = dynamicTotal; } catch {}
    if (isDocScroll) { try { window.scrollTo(0, dynamicTotal); } catch {} }

    // Stabilize: UIs can increase scrollHeight while loading more turns.
    // Wait until scrollHeight stops changing for a short window, then snap to the true bottom again.
    const settleStart = performance.now();
    let lastH = -1;
    let lastChangeAt = performance.now();
    const settleMax = 10000;
    while (performance.now() - settleStart < settleMax) {
      const h = scrollable.scrollHeight || 0;
      if (h !== lastH) {
        lastH = h;
        lastChangeAt = performance.now();
        const t = totalFor();
        try { scrollable.scrollTop = t; } catch {}
        if (isDocScroll) { try { window.scrollTo(0, t); } catch {} }
      }
      if (performance.now() - lastChangeAt > 900) break;
      await sleep(120);
    }

    // Return to start position for most sites. For DeepSeek, keep position near bottom to reduce
    // the chance of virtualized UIs unmounting the latest turns immediately after loading.
    if (/deepseek\.com$/i.test(HOST)) {
      await sleep(600);
    } else {
      try { scrollable.scrollTop = startScrollTop; } catch {}
      try { window.scrollTo(0, startScrollTop); } catch {}
      await sleep(600);
    }
    try {
      const metricsEnd = {
        ms: Math.round(performance.now() - start),
        scrollHeight: scrollable?.scrollHeight ?? null,
        clientHeight: scrollable?.clientHeight ?? null,
        turnCount: (/deepseek\.com$/i.test(HOST) ? (getSelectableTurnNodes()?.length ?? null) : null),
      };
      document.documentElement.setAttribute('data-acep-autoscroll-metrics', JSON.stringify({ start: metricsStart, end: metricsEnd }));
    } catch {}
    try { pre.remove(); } catch {}
    await sleep(800);
    ACEP_LAST_AUTOSCROLL_AT = Date.now();
  }
  // Simple site adapters for alternate UIs (removed; provider-only)
  function getTurnNodes() {
    if (!SUPPORTED_HOST) return [];
    const p = requireProvider();
    if (!p) return [];
    try {
      const fn = p.getTurnsForExport || p.extractSelectableTurnNodes;
      if (typeof fn === 'function') {
        const list = fn();
        return Array.isArray(list) ? list : [];
      }
    } catch {}
    return [];
  }

  function isClaudeThoughtNode(el) {
    try {
      if (!/claude\.ai$/i.test(HOST)) return false;
      if (!el || !el.querySelector) return false;
      const cls = (el.className || '').toString();
      if (/standard-markdown/i.test(cls) && /\bp-3\b/.test(cls) && /\bpt-0\b/.test(cls) && /\bpr-8\b/.test(cls)) return true;
      if (/\btext-text-300\b/.test(cls) && /\bfont-claude-response\b/.test(cls) && /\btext-sm\b/.test(cls)) return true;
      // Avoid invalid selectors like `.group/row` (throws). Use attribute selector.
      if (el.closest && el.closest('button[class*="group/row" i]')) return true;
      const block = el.closest && el.closest('div.ease-out.transition-all');
      if (!block) return false;
      if (!block.querySelector('button[class*="group/row" i]')) return false;
      if (!block.querySelector('div[style*="height:0"], div[style*="height: 0"], div[style*="opacity:0"], div[style*="opacity: 0"]')) return false;
      return !!block.querySelector('.standard-markdown, .progressive-markdown');
    } catch {
      return false;
    }
  }
  function getChatTitle() {
    const stripProviderFromTitle = (title = '') => {
      let out = String(title || '').replace(/\s+/g, ' ').trim();
      const labels = ['ChatGPT', 'Claude', 'Grok', 'DeepSeek', 'Gemini'];
      for (const label of labels) {
        const esc = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const prefixRe = new RegExp(`^\\s*(?:${esc}\\s*[-ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¾Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¯ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¿ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â½ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¾Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¯ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¿ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â½|:]+\\s*)+`, 'i');
        const suffixRe = new RegExp(`\\s*(?:[-ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¾Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¯ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¿ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â½ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¾Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¯ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¿ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â½|:]+\\s*${esc}|\\(${esc}\\))\\s*$`, 'i');
        let prev = null;
        while (out && out !== prev) {
          prev = out;
          out = out.replace(prefixRe, '').replace(suffixRe, '').trim();
        }
      }
      return out || String(title || '').trim();
    };
    try {
      const p = getProvider();
      if (p && typeof p.getChatTitle === 'function') {
        const t = p.getChatTitle();
        if (t) return stripProviderFromTitle(t).slice(0, 140);
      }
    } catch {}
    if (STRICT_PROVIDER_ONLY) {
      const t = (document.title?.trim() || 'AI Conversation');
      return stripProviderFromTitle(t).slice(0, 140);
    }
    const h = document.querySelector('header h1, [data-testid="conversation-title"]');
    const t = h?.textContent?.trim() || document.title?.trim() || 'AI Conversation';
    return stripProviderFromTitle(t).slice(0, 140);
  }
  function roleFromTurn(turn) {
    try {
      const p = requireProvider();
      if (p && typeof p.roleFromTurn === 'function') {
        const r = p.roleFromTurn(turn);
        if (r) return r;
      }
    } catch {}
    const preset = turn?.getAttribute && turn.getAttribute('data-acep-role');
    if (preset) return preset;
    if (STRICT_PROVIDER_ONLY) {
      try {
        document.documentElement.setAttribute('data-acep-provider-role-missing', JSON.stringify({ ts: Date.now(), host: HOST }));
      } catch {}
      return '';
    }
    // Legacy host heuristics (only used when provider-only mode is disabled)
    try {
      if (!getProvider()) {
        // Claude: assistant blocks are often the markdown container itself
        if (/claude\.ai$/i.test(HOST)) {
          if (turn && turn.matches && turn.matches('.font-claude-response, .standard-markdown, .progressive-markdown')) {
            return 'assistant';
          }
        }
        // ChatGPT: image-only "Generated image" responses should be treated as assistant
        if (/chatgpt\.com$/i.test(HOST) || /chat\.openai\.com$/i.test(HOST)) {
          const imgs = turn.querySelectorAll('img');
          for (const img of imgs) {
            const alt = (img.getAttribute('alt') || '').toLowerCase();
            const cls = (img.getAttribute('class') || '').toLowerCase();
            const src = (img.getAttribute('src') || '').toLowerCase();
            const isGenerated = alt.includes('generated image') || cls.includes('absolute top-0') || /backend-api\/estuary\/content/.test(src);
            const isUploaded = alt.includes('uploaded image') || cls.includes('object-cover') || cls.includes('rounded-lg');
            if (isGenerated && !isUploaded) return 'assistant';
          }
        }
      }
    } catch {}
    const attr = turn.getAttribute('data-message-author-role');
    if (attr) return attr;
    if (turn.querySelector('[data-message-author-role="user"]')) return 'user';
    if (turn.querySelector('[data-message-author-role="assistant"]')) return 'assistant';
    return turn.querySelector('.markdown') ? 'assistant' : 'user';
  }
  function imageCaptionFromTurn(turn) {
    try {
      const p = requireProvider();
      if (p && typeof p.getImageCaptionFromTurn === 'function') {
        const t = p.getImageCaptionFromTurn(turn);
        if (t) return String(t);
      }
    } catch {}
    if (STRICT_PROVIDER_ONLY) return '';
    try {
      // ChatGPT image-gen caption lives in a `.truncate` element preceding the image.
      // Other sites (notably Claude) also use `.truncate` for UI-only status headers, which would
      // leak into PDF as a green caption. Keep this ChatGPT-only.
      if (!(/chatgpt\.com$/i.test(HOST) || /chat\.openai\.com$/i.test(HOST))) return '';
      const cand = turn.querySelector('.truncate');
      const txt = (cand?.innerText || '').trim();
      if (txt) return txt;
    } catch {}
    return '';
  }
  function imagesFromTurn(turn) {
    try {
      const p = requireProvider();
      if (p && typeof p.getImagesFromTurn === 'function') {
        const list = p.getImagesFromTurn(turn);
        return Array.isArray(list) ? list : [];
      }
    } catch (err) {
      try { console.warn('[ACEP] imagesFromTurn provider call failed:', err); } catch {}
    }
    if (STRICT_PROVIDER_ONLY) return [];
    return [];
  }
  function getGalleryCountFromTurn(turn) {
    try {
      const p = requireProvider();
      if (p && typeof p.getGalleryCountFromTurn === 'function') {
        const n = Number(p.getGalleryCountFromTurn(turn) || 0);
        return Number.isFinite(n) ? n : 0;
      }
    } catch {}
    if (STRICT_PROVIDER_ONLY) return 0;
    return 0;
  }
  function collectExtraGalleryImages(existing = [], targetCount = 0) {
    try {
      const p = requireProvider();
      if (p && typeof p.collectExtraGalleryImages === 'function') {
        const list = p.collectExtraGalleryImages(existing, targetCount);
        return Array.isArray(list) ? list : [];
      }
    } catch {}
    if (STRICT_PROVIDER_ONLY) return [];
    return [];
  }
  function innerHTMLFromTurn(turn) {
    try {
      const p = requireProvider();
      if (p && typeof p.innerHTMLFromTurn === 'function') {
        const h = p.innerHTMLFromTurn(turn);
        if (typeof h === 'string') return h;
      }
    } catch {}
    if (STRICT_PROVIDER_ONLY) return '';
    try {
      if (/claude\.ai$/i.test(HOST)) {
        const clone = turn.cloneNode(true);
        const thoughtBlocks = Array.from(clone.querySelectorAll('div.ease-out.transition-all'))
          .filter(b =>
            // Avoid invalid selectors like `.group/row` (throws). Use attribute selector.
            b.querySelector('button[class*="group/row" i]')
            && b.querySelector('div[style*="height: 0"], div[style*="opacity: 0"]')
            && b.querySelector('.standard-markdown, .progressive-markdown')
          );
        thoughtBlocks.forEach(b => { try { b.remove(); } catch {} });
        // Claude: remove the visible "status/thinking" heading block (class contains `group/status`) so it doesn't
        // leak into PDF as a green heading before the response.
        try {
          // Avoid invalid selectors like `.group/status` (throws). Use attribute selector.
          Array.from(clone.querySelectorAll('button[class*="group/status" i]')).forEach((btn) => {
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
        } catch {}
        // Claude tool-result blocks (e.g., "Fetched: ...") + favicons should not appear in exports
        try {
          clone.querySelectorAll('img[src*="favicon" i], img[src*="s2/favicons" i], img[alt="favicon" i]').forEach(n => { try { n.remove(); } catch {} });
          // Remove only the exact "Fetched:" elements (avoid removing containers that hold real markdown)
          Array.from(clone.querySelectorAll('button, span, div, p, li')).forEach(el => {
            const txt = (el.textContent || '').trim();
            if (!/^Fetched:/i.test(txt)) return;
            try { el.remove(); } catch {}
          });
        } catch {}
        const md = clone.querySelector('.markdown');
        if (md) return md.innerHTML;
        const article = clone.querySelector('article');
        if (article) return article.innerHTML;
        return clone.innerHTML;
      }
    } catch {}
    const md = turn.querySelector('.markdown');
    const article = turn.querySelector('article');
    const appendExternalAttachmentMarkers = (baseHtml, rootEl) => {
      try {
        if (!turn || !turn.querySelectorAll) return baseHtml;
        const markers = Array.from(turn.querySelectorAll('[data-acep-attachment-name]'));
        if (!markers.length) return baseHtml;
        // If we are returning a subtree's innerHTML, markers may be siblings of that subtree
        // (notably on Grok file chips). Append only the markers that are outside the returned subtree.
        const toAppend = rootEl && rootEl.contains
          ? markers.filter(m => !rootEl.contains(m))
          : markers;
        if (!toAppend.length) return baseHtml;
        return String(baseHtml || '') + toAppend.map(m => m.outerHTML || '').join('');
      } catch {
        return baseHtml;
      }
    };
    try {
      if ((/chatgpt\.com$/i.test(HOST) || /chat\.openai\.com$/i.test(HOST)) && article) {
        const hasImgs = !!article.querySelector('img');
        if (hasImgs) return article.innerHTML;
      }
    } catch {}
    if (md) return appendExternalAttachmentMarkers(md.innerHTML, md);
    if (article) return appendExternalAttachmentMarkers(article.innerHTML, article);
    const roleBlock = turn.querySelector('[data-message-author-role="user"]')
                  || turn.querySelector('[data-message-author-role="assistant"]');
    if (roleBlock) return appendExternalAttachmentMarkers(roleBlock.innerHTML, roleBlock);
    return '';
  }

  const escapeHtml = (s='')=>s.replace(/[&<>"']/g,m=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[m]));
  const escapeAttr = (s='')=>escapeHtml(s);
  const htmlToPlainText = (html='') => {
    if (!html) return '';
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    return tmp.innerText.replace(/\r\n/g, '\n');
  };
  function sanitizeMessageHTML(html='') {
    if (!html) return '';
    // Grok: strip inline citation render tags that leak from DOM/API
    // Example: <grok:render ...> <argument ...>..</argument> </grok:render>
    html = html.replace(/<grok:render\b[\s\S]*?<\/grok:render>/gi, '');
    // Gemini: strip invisible citation markers ([cite_start], [cite: 1, 2]) that leak from DOM
    html = html.replace(/\[cite_start\]/g, '');
    html = html.replace(/\[cite:\s*[\d,\s]+\]/g, '');
    // Gemini: remove tool attribution cards / video previews
    html = html.replace(/<attribution-container[\s\S]*?<\/attribution-container>/gi, '');
    html = html.replace(/<youtube-block[\s\S]*?<\/youtube-block>/gi, '');
    html = html.replace(/<div[^>]+class="[^"]*attachment-container\s+youtube[^"]*"[^>]*>[\s\S]*?<\/div>/gi, '');
    html = html.replace(/<single-video[\s\S]*?<\/single-video>/gi, '');
    html = html.replace(/<default-player[\s\S]*?<\/default-player>/gi, '');
    html = html.replace(/<div[^>]+class="[^"]*(tool-attribution|youtube-block|single-video-container|single-video-thumbnail|single-video-overlay)[^"]*"[^>]*>[\s\S]*?<\/div>/gi, '');
    // Preserve inline images wrapped in buttons (ChatGPT uses button wrappers for images).
    html = html.replace(/<button[^>]*>([\s\S]*?)<\/button>/gi, (match, inner) => {
      return /<img\b/i.test(inner) ? inner : '';
    });
    // Remove extension asset icons that can leak into exports
    html = html.replace(/<img[^>]+src="chrome-extension:\/\/[^"]+\/assets\/(g-docs|word|pdf|markdown)\.svg"[^>]*>/gi, '');
    html = html.replace(/<img[^>]+src="chrome-extension:\/\/[^"]+\/images\/[^"]+\.svg"[^>]*>/gi, '');
    html = html.replace(/<img[^>]+src="moz-extension:\/\/[^"]+\/images\/[^"]+\.svg"[^>]*>/gi, '');
    html = html.replace(/<img[^>]+src="ms-browser-extension:\/\/[^"]+\/images\/[^"]+\.svg"[^>]*>/gi, '');
    // Remove YouTube preview icons/thumbnails that slip through
    html = html.replace(/<img[^>]+data-original-src="https?:\/\/www\.gstatic\.com\/images\/branding\/productlogos\/youtube\/[^"]+"[^>]*>/gi, '');
    html = html.replace(/<img[^>]+data-original-src="https?:\/\/i\.ytimg\.com\/[^"]+"[^>]*>/gi, '');
    // Remove gallery count badges/overlays so they don't become text blocks.
    html = html.replace(/<div[^>]*pointer-events-none[^>]*>[\s\S]*?<\/div>/gi, '');
    // Keep YouTube links (only remove preview blocks elsewhere)
    html = html.replace(/<(button|input|label|textarea|select)[^>]*>.*?<\/\1>/gi, '');
    html = html.replace(/<(button|input|label|textarea|select)[^>]*\/?>/gi, '');
    // Remove ChatGPT file-citation chips via DOM (regex is unsafe ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¾Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¦ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â nested <span> inside the chip
    // causes non-greedy [\s\S]*?</span> to stop early, leaving orphaned </button></span> closing tags
    // that render as visible boxes). DOM querySelectorAll handles nesting correctly.
    // Key distinction: citation chips have aria-haspopup but NO <img> inside (SVG+text only).
    // Image-preview spans DO have <img> inside and must be kept.
    try {
      const _cd = document.createElement('div');
      _cd.innerHTML = html;
      _cd.querySelectorAll('span[aria-haspopup]').forEach(el => {
        if (!el.querySelector('img')) el.remove();
      });
      html = _cd.innerHTML;
    } catch {}
    // Strip any remaining raw filecite text tokens (inline in markdown-sourced HTML)
    if (/filecite/i.test(html) || /ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¾Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â®ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¹ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¦ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬fileciteÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¾Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â®ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¹ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¦ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡/.test(html)) {
      html = html.replace(/<([a-zA-Z]+)[^>]*filecite[^>]*>[^<]*<\/\1>/gi, '');
      html = html.replace(/\s*filecite[\w-]+/gi, '');
      html = html.replace(/ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¾Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â®ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¹ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¦ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬fileciteÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¾Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â®ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¹ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¦ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡[^ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¾Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â®ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¹ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â]+ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¾Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â®ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¹ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â/g, '');
    }
    // DOM TreeWalker pass: catches filecite tokens that survived regex due to HTML entity encoding
    // (e.g. &#116;urn0file0 ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¾Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¦ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â the 't' is entity-encoded so [\w-]+ stops early).
    // Text node .nodeValue always contains decoded text, so the regex matches reliably.
    if (/filecite/i.test(html) || /ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¾Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â®ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¹ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¦ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬fileciteÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¾Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â®ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¹ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¦ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡/.test(html)) {
      try {
        const _div = document.createElement('div');
        _div.innerHTML = html;
        const _walker = document.createTreeWalker(_div, NodeFilter.SHOW_TEXT, null);
        const _nodes = [];
        let _n;
        while ((_n = _walker.nextNode())) {
          if (/filecite/i.test(_n.nodeValue) || /ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¾Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â®ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¹ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¦ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬fileciteÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¾Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â®ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¹ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¦ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡/.test(_n.nodeValue)) _nodes.push(_n);
        }
        _nodes.forEach(_n => {
          _n.nodeValue = _n.nodeValue
            .replace(/ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¾Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â®ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¹ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¦ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬fileciteÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¾Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â®ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¹ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¦ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡[^ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¾Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â®ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¹ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â]+ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¾Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â®ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¹ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â/g, '')
            .replace(/\s*filecite[^\s]*/gi, '');
        });
        html = _div.innerHTML;
      } catch {}
    }
    html = html.replace(/<(p|span)(?![^>]*\bdata-math\b)[^>]*>\s*<\/\1>/gi, '');
    return html;
  }
  function isDataUrl(u){ return /^\s*data:/i.test(u); }
  function isBlobUrl(u){ return /^\s*blob:/i.test(u); }
  function isAbsoluteHttp(u){ return /^\s*https?:/i.test(u); }
  function isExtensionUrl(u){ return /^\s*(chrome-extension|moz-extension):/i.test(u); }
  function sameOrigin(u){
    try { return new URL(u, ORIGIN).origin === ORIGIN; } catch { return false; }
  }
  function allowedRemote(u){
    try {
      const host = new URL(u, ORIGIN).hostname;
      return REMOTE_IMAGE_HOSTS.some(h => host === h || host.endsWith('.'+h));
    } catch { return false; }
  }
  function blobToDataURL(blob){
    return new Promise((res, rej) => {
      const fr = new FileReader();
      fr.onload = () => res(fr.result);
      fr.onerror = rej;
      fr.readAsDataURL(blob);
    });
  }
  function findDeepSeekObsUrlForPreview(previewUrl = '') {
    try {
      const url = new URL(String(previewUrl || ''), ORIGIN);
      if (!/deepseek\.com$/i.test(url.hostname) || !/\/api\/v0\/file\/preview\b/i.test(url.pathname)) return '';
      const fileId = String(url.searchParams.get('file_id') || '').trim();
      if (!fileId) return '';
      const entries = performance?.getEntriesByType ? performance.getEntriesByType('resource') : [];
      for (const entry of entries.slice().reverse().slice(0, 500)) {
        const name = String(entry?.name || '');
        if (!name || name.indexOf(fileId) === -1) continue;
        if (/myhuaweicloud|deepseek-api-files|\bobs\./i.test(name)) return name;
      }
    } catch {}
    return '';
  }
  // Simplified fetchAsDataURL: single fetch attempt to avoid noisy retries.
  async function fetchAsDataURL(u, opts = {}) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 20000);
    try {
      try {
        const deepseekObsUrl = findDeepSeekObsUrlForPreview(u);
        if (deepseekObsUrl) {
          const obsResp = await fetch(deepseekObsUrl, { mode: 'cors', credentials: 'omit', cache: 'no-store', signal: ctrl.signal });
          if (obsResp.ok) {
            const obsBlob = await obsResp.blob();
            return await blobToDataURL(obsBlob);
          }
        }
      } catch {}

      const providerExtra = (() => {
        try {
          const p = getProvider();
          return (p && typeof p.getInlineImageFetchOptions === 'function') ? (p.getInlineImageFetchOptions(u) || null) : null;
        } catch { return null; }
      })();
      const mergedHeaders = {
        ...((providerExtra && providerExtra.headers) || {}),
        ...((opts && opts.headers) || {}),
      };
      const requestOpts = {
        mode: 'cors',
        credentials: 'include',
        cache: 'no-store',
        ...(providerExtra || {}),
        ...opts,
        ...(Object.keys(mergedHeaders).length ? { headers: mergedHeaders } : {}),
        signal: ctrl.signal,
      };
      const resp = await fetch(u, requestOpts);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

      // Some providers return JSON metadata for "preview" endpoints (not the binary).
      // In that case, follow the embedded URL and fetch the actual bytes.
      try {
        const ct = String(resp.headers.get('content-type') || '').toLowerCase();
        if (ct.includes('application/json')) {
          const json = await resp.json();
          const pickUrl = (o) => {
            if (!o || typeof o !== 'object') return '';
            const direct =
              o.url || o.download_url || o.downloadUrl || o.preview_url || o.previewUrl || o.file_url || o.fileUrl;
            if (typeof direct === 'string' && direct) return direct;
            for (const k of ['data', 'biz_data', 'bizData', 'result', 'payload']) {
              const v = o[k];
              const hit = pickUrl(v);
              if (hit) return hit;
            }
            return '';
          };
          const nextUrl = pickUrl(json);
          if (nextUrl) {
            const abs = (() => { try { return new URL(nextUrl, ORIGIN).href; } catch { return String(nextUrl); } })();
            const p = getProvider();
            const extra = (p && typeof p.getInlineImageFetchOptions === 'function') ? (p.getInlineImageFetchOptions(abs) || null) : null;
            try {
              const followCreds = /deepseek-api-files|myhuaweicloud|\bobs\./i.test(abs) ? 'omit' : 'include';
              const r2 = await fetch(abs, { mode: 'cors', credentials: followCreds, cache: 'no-store', ...(extra || {}), signal: ctrl.signal });
              if (!r2.ok) throw new Error(`HTTP ${r2.status}`);
              const blob2 = await r2.blob();
              return await blobToDataURL(blob2);
            } catch {
              try {
                const deepseekObsUrl = findDeepSeekObsUrlForPreview(u);
                if (deepseekObsUrl) {
                  const obsResp = await fetch(deepseekObsUrl, { mode: 'cors', credentials: 'omit', cache: 'no-store', signal: ctrl.signal });
                  if (obsResp.ok) return await blobToDataURL(await obsResp.blob());
                }
              } catch {}
              try {
                const r = await browser.runtime.sendMessage({ type: 'ACEP_FETCH_DATAURL', url: abs });
                if (r && r.ok && typeof r.dataUrl === 'string') return r.dataUrl;
              } catch {}
              throw new Error('preview metadata image fetch failed');
            }
          }
        }
      } catch (e) {
        throw e;
      }

      const ct2 = String(resp.headers.get('content-type') || '').toLowerCase();
      if (ct2 && !ct2.startsWith('image/') && !ct2.includes('application/octet-stream') && !ct2.includes('binary/octet-stream')) {
        throw new Error(`non-image content-type: ${ct2}`);
      }
      const blob = await resp.blob();
      return await blobToDataURL(blob);
    } finally {
      clearTimeout(t);
    }
  }
  async function inlineImagesInHTML(docFrag) {
    const imgs = Array.from(docFrag.querySelectorAll('img'));
    if (!imgs.length) return;
    const CONCURRENCY = 4;
    let idx = 0;
    async function worker(){
      while (idx < imgs.length) {
        const i = idx++;
        const img = imgs[i];
        try {
          let src = img.getAttribute('src') || '';
          if (!src || isDataUrl(src)) continue;
          try { src = new URL(src, ORIGIN).href; } catch {}
          const canInline =
            isBlobUrl(src) ||
            isExtensionUrl(src) ||
            sameOrigin(src) ||
            isAbsoluteHttp(src) || // allow any https/http to attempt inlining for export embeds
            (isAbsoluteHttp(src) && allowedRemote(src));
          if (!canInline) continue;
          img.removeAttribute('srcset');
          img.removeAttribute('loading');
          img.removeAttribute('decoding');
          let dataUrl;
          if (isBlobUrl(src)) {
            const resp = await fetch(src);
            const blob = await resp.blob();
            dataUrl = await blobToDataURL(blob);
          } else {
            // Prefer local/page fetch for same-origin (keeps cookies) and for Claude preview uploads.
            // Avoid sending protected Claude uploads through the worker/proxy.
            const isClaudePreview = /\/\/claude\.ai\/api\/.+\/files\/.+\/preview(\b|\/)?/i.test(src);
            const isGrokProtected = /\/\/assets\.grok\.com\//i.test(src);
            let inlineFetchOpts = null;
            try {
              const p = getProvider();
              if (p && typeof p.getInlineImageFetchOptions === 'function') {
                inlineFetchOpts = p.getInlineImageFetchOptions(src) || null;
              }
            } catch {}
            if (sameOrigin(src) || isClaudePreview) {
              try {
                dataUrl = await fetchAsDataURL(src, { credentials: 'include', ...(inlineFetchOpts || {}) });
              } catch {}
            } else if (!isGrokProtected) {
              // Fallback: background fetch (may use proxy for cross-origin images)
              try {
                const r = await browser.runtime.sendMessage({ type: 'ACEP_FETCH_DATAURL', url: src });
                if (r && r.ok && typeof r.dataUrl === 'string') dataUrl = r.dataUrl;
              } catch {}
            }
          }
          if (dataUrl) {
            img.setAttribute('src', dataUrl);
            img.setAttribute('data-inline-src', '1');
          }
        } catch {
          // If fetch fails, preserve the original URL so linked/self HTML can still show it
          const orig = img.getAttribute('data-original-src') || img.getAttribute('src') || '';
          if (orig) img.setAttribute('src', orig);
          img.setAttribute('alt', img.getAttribute('alt') || '[Image]');
        }
      }
    }
    const workers = Array.from({length: Math.min(CONCURRENCY, imgs.length)}, () => worker());
    await Promise.all(workers);
  }
  // Inline role icons (chrome-extension:// or moz-extension://) regardless of export mode
  async function inlineRoleIcons(docFrag) {
    const icons = Array.from(docFrag.querySelectorAll('img.role-icon'));
    if (!icons.length) return;
    for (const img of icons) {
      try {
        const src = img.getAttribute('src') || '';
        if (!src || !isExtensionUrl(src)) continue;
        const resp = await fetch(src);
        if (!resp.ok) continue;
        const blob = await resp.blob();
        const dataUrl = await blobToDataURL(blob);
        if (dataUrl) img.setAttribute('src', dataUrl);
      } catch {}
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
  // Claude artifact functions moved to providers/claude/artifacts.js
  function normalizeUserTurnMathHtml(html = '') {
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
          if (aria && !/^math/i.test(aria)) return aria;
        } catch {}
        return '';
      };
      Array.from(root.querySelectorAll('.katex-display, mjx-container[display="true"], math[display="block"], .math-block')).forEach((el) => {
        try {
          const tex = readTex(el);
          if (!tex) return;
          const replacement = doc.createElement('div');
          replacement.className = 'acep-math-text acep-math-display';
          replacement.textContent = `$$${tex}$$`;
          el.replaceWith(replacement);
        } catch {}
      });
      Array.from(root.querySelectorAll('.katex, mjx-container, math, [data-math]')).forEach((el) => {
        try {
          if (el.closest?.('.acep-math-text')) return;
          const tex = readTex(el);
          if (!tex) return;
          const replacement = doc.createElement('span');
          replacement.className = 'acep-math-text acep-math-inline';
          replacement.textContent = `\\(${tex}\\)`;
          el.replaceWith(replacement);
        } catch {}
      });
      return root.innerHTML || raw;
    } catch {
      return String(html || '');
    }
  }
  // --- Build HTML with role labels/icons, branding, and export mode ---
  async function buildCleanHTML({
    removeIcons = false,
    branding = false,
    exportMode = "self",
    outputFormat = '',
    wantImageData = false,
    theme = 'light',
    selectedTurnIds = null,
    selectionFilter = '',
  } = {}) {
    console.log('[ACEP] buildCleanHTML called, HOST:', HOST);
    const prov = requireProvider();
    const normalizedOutputFormat = String(outputFormat || '').toLowerCase();
    const shouldEmbedImageData = !!wantImageData || normalizedOutputFormat === 'html_self' || normalizedOutputFormat === 'png_plain';
    // If the sidebar already pre-scraped this exact chat very recently, don't scroll or re-run heavy
    // provider preScrape again (it causes confusing "Loading chat for export..." twice).
    const preScrapeMemo = (() => {
      try { return globalThis.__acepPreScrapeMemo || null; } catch { return null; }
    })();
    const currentChatId = (prov && typeof prov.getCurrentChatId === 'function') ? String(prov.getCurrentChatId() || '') : '';
    const providerMemoRev = String(prov?.__providerRev || '');
    const sameChatRecently = !!(
      preScrapeMemo &&
      preScrapeMemo.platform &&
      preScrapeMemo.href &&
      preScrapeMemo.ts &&
      String(preScrapeMemo.platform) === String(getProviderKeyForHost() || '') &&
      String(preScrapeMemo.href) === String(location.href || '') &&
      String(preScrapeMemo.chatId || '') === currentChatId &&
      String(preScrapeMemo.providerRev || '') === providerMemoRev &&
      (Date.now() - Number(preScrapeMemo.ts || 0)) < 2 * 60 * 1000
    );
    const isApiFirstProvider = !!(prov && typeof prov.fetchApiTurnNodesForCurrentChat === 'function');
    if (!sameChatRecently && !isApiFirstProvider) {
      await gentleScroll();
    }
    try {
      const p = (globalThis.ACEP && globalThis.ACEP.env && globalThis.ACEP.env.PLATFORM) ? globalThis.ACEP.env.PLATFORM : '';
      document.documentElement.setAttribute('data-acep-platform', p);
      // Build marker so we can confirm the active content-script revision and avoid stale-cache confusion.
      document.documentElement.setAttribute('data-acep-content-rev', '2026-06-18-claude-api-pasted-only');
    } catch {}
    if (!prov && STRICT_PROVIDER_ONLY) {
      const msg = `Provider not loaded for ${HOST} (${getProviderKey() || 'unknown'}). Reload the extension/page.`;
      try { acepDebugStore('provider_error', msg); } catch {}
      return {
        title: 'ACEP Export Failed',
        html: `<!doctype html><html><head><meta charset="utf-8"><title>ACEP Export Failed</title></head><body style="font-family:system-ui,Segoe UI,Arial,sans-serif;padding:16px;"><h1>Export failed</h1><pre style="white-space:pre-wrap;border:1px solid #ddd;padding:12px;border-radius:8px;">${escapeHtml(msg)}</pre></body></html>`,
        rows: [],
      };
    }
    // Provider-first: run provider pre-scrape hooks (artifact fetching, upload reveal, etc.).
    try {
      if (prov && typeof prov.preScrape === 'function') {
        if (!sameChatRecently) {
          await prov.preScrape({ removeIcons, branding, exportMode, outputFormat: normalizedOutputFormat, wantImageData: shouldEmbedImageData, theme, selectedTurnIds, selectionFilter, purpose: 'export' });
          try {
            globalThis.__acepPreScrapeMemo = {
              platform: getProviderKeyForHost() || '',
              href: String(location.href || ''),
              chatId: currentChatId,
              providerRev: providerMemoRev,
              ts: Date.now(),
            };
          } catch {}
        }
      }
    } catch {}
    try {
      if (/claude\.ai$/i.test(HOST) && prov && typeof prov.captureGeneratedFileCardsAsLinks === 'function') {
        await prov.captureGeneratedFileCardsAsLinks({ purpose: 'export', fallback: sameChatRecently ? 'memo-skip' : 'post-prescrape' });
      }
    } catch {}

    // Debug: surface Claude contract counts if available.
    try {
      if (/claude\.ai$/i.test(HOST)) {
        const contractCounts = (globalThis.ACEP && globalThis.ACEP.providers && globalThis.ACEP.providers.claude && globalThis.ACEP.providers.claude.contractCounts)
          ? globalThis.ACEP.providers.claude.contractCounts
          : null;
        if (contractCounts) acepDebugStore('claude_contract', contractCounts());
      }
    } catch {}
    const title = getChatTitle();
    let turns = getTurnNodes();
    // For API-first providers (ChatGPT): if the API scrape failed for any reason,
    // the DOM fallback gives empty turns ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¾Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¦ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â show a proper error instead of a broken export.
    if (prov?.__apiFailed) {
      throw new Error('ACEP_NETWORK_ERROR');
    }
    if (!turns.length && prov?.__apiNetworkFailed) {
      throw new Error('ACEP_NETWORK_ERROR');
    }
    if (!sameChatRecently && (!selectedTurnIds || !selectedTurnIds.length)) {
      try { window.__acepSelectedTurnIds = null; } catch {}
      try { window.__acepSelectionFilter = null; } catch {}
    }
    const fallbackSelected = (!selectedTurnIds || !selectedTurnIds.length)
      ? (Array.isArray(window.__acepSelectedTurnIds) ? window.__acepSelectedTurnIds : null)
      : null;
    const fallbackFilter = (!selectedTurnIds || !selectedTurnIds.length)
      ? (typeof window.__acepSelectionFilter === 'string' ? window.__acepSelectionFilter : '')
      : '';
    const effectiveSelected = (selectedTurnIds && selectedTurnIds.length) ? selectedTurnIds : fallbackSelected;
    const effectiveFilter = (typeof selectionFilter === 'string' && selectionFilter)
      ? selectionFilter
      : ((typeof fallbackFilter === 'string' && fallbackFilter)
        ? fallbackFilter
        : ((typeof window.__acepSelectionFilter === 'string' && window.__acepSelectionFilter) ? window.__acepSelectionFilter : ''));
    let selectedSet = Array.isArray(effectiveSelected) && effectiveSelected.length
      ? new Set(effectiveSelected.map(v => String(v)))
      : null;
    const cssEscape = (v = '') => {
      try { return CSS && typeof CSS.escape === 'function' ? CSS.escape(String(v)) : String(v).replace(/["\\]/g, '\\$&'); } catch { return String(v); }
    };
    let selectedIdxSet = null;
    if (selectedSet && selectedSet.size && /claude\.ai$/i.test(HOST)) {
      // selectedSet already holds export idx values for Claude selection
      selectedIdxSet = new Set(Array.from(selectedSet));
    }
    // Keep selectedSet for Grok/Gemini so manual checkbox selection is honored.
    if (fallbackSelected && fallbackSelected.length) {
      try { window.__acepSelectedTurnIds = null; } catch {}
      try { window.__acepSelectionFilter = null; } catch {}
    }
    const rows = [];
    const rowTurnMap = [];
    for (let idx = 0; idx < turns.length; idx++) {
      const t = turns[idx];
      const turnId = t?.getAttribute ? (t.getAttribute('data-acep-turn-id') || String(idx)) : String(idx);
      const allowTurn = !selectedSet
        || (selectedIdxSet && selectedIdxSet.has(String(idx)))
        || selectedSet.has(String(idx))
        || selectedSet.has(String(turnId));
      if (!allowTurn) continue;
      const role = roleFromTurn(t);
      let html = innerHTMLFromTurn(t);
      if (String(role || '').toLowerCase() === 'user') html = normalizeUserTurnMathHtml(html);
      let imgs = imagesFromTurn(t);
      const galleryCount = getGalleryCountFromTurn(t);
      if (galleryCount && imgs.length < galleryCount) {
        const extra = collectExtraGalleryImages(imgs, galleryCount);
        if (extra.length) imgs.push(...extra);
      }
      const originalImgs = imgs.map(i => ({ ...i }));
      const imageCaption = imageCaptionFromTurn(t);
      const hasText = html && html.replace(/<[^>]+>/g, '').trim().length > 0;
      const hasEmbeddedMedia = !!html && /<img\b|<svg\b|<iframe\b|acep-svg-wrap|acep-inline-svg-img|acep-visual-wrap|acep-mcp-frame-wrap|id=["']vis-container["']|claudemcpcontent\.com\/mcp_apps|data-acep-svg|data:image\/svg\+xml/i.test(String(html || ''));
      const hasImg = imgs.length > 0;
      if (!hasText && !hasImg && !hasEmbeddedMedia) continue;
      if (allowTurn) {
       rows.push({ role, rawHtml: html, html, imgs, originalImgs, imageCaption, text: '', roleLabel: '', turnId, galleryCount });
        rowTurnMap.push({ rowIndex: rows.length - 1, turn: t });
      }
    }

    // Provider post-processing hook (preferred).
    try {
      if (prov && typeof prov.postProcessExportRows === 'function') {
        prov.postProcessExportRows({ rows, rowTurnMap, host: HOST, origin: ORIGIN, effectiveFilter });
      }
    } catch {}

    const addImgToRow = (row, src, alt = '') => {
      if (!row || !src) return;
      row.imgs = row.imgs || [];
      const key = (src || '').split('#')[0];
      if (!key) return;
      const seen = new Set(row.imgs.map(i => (i.originalSrc || i.src || '').split('#')[0]));
      if (seen.has(key)) return;
      row.imgs.push({ src, originalSrc: src, alt: alt || '' });
    };

    // If DeepSeek preview overlay is open, attach those image URLs to the last user row
    const captureDeepseekOverlayImages = () => {
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
            try { urls.push({ src: new URL(s, location.origin).href, alt: altName || (im.getAttribute('alt') || '') }); }
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
    };
    try {
      // Provider should handle DeepSeek overlays; keep legacy fallback only when provider is missing.
      if (!prov && /deepseek\.com$/i.test(HOST)) {
        const overlayImgs = captureDeepseekOverlayImages();
        if (overlayImgs.length) {
          overlayImgs.forEach(o => {
            let targetRow = null;
            try {
              const sel = `img[src="${o.src}"], a[href="${o.src}"]`;
              const el = document.querySelector(sel);
              const msg = el?.closest?.('.ds-message, div.ds-message') || null;
              if (msg) {
                const match = rowTurnMap.find(m => m.turn && m.turn.contains && m.turn.contains(msg));
                if (match) targetRow = rows[match.rowIndex];
              }
            } catch {}
            if (targetRow && targetRow.role !== 'user') {
              targetRow = nearestUserRow(rows.indexOf(targetRow));
            }
            if (!targetRow) targetRow = [...rows].reverse().find(r => r.role === 'user') || null;
            if (targetRow) addImgToRow(targetRow, o.src, o.alt || '');
          });
        }
      }
    } catch {}

    // DeepSeek: reveal image URLs by clicking chips, then attach to correct user row
    // This runs for ALL DeepSeek exports since the click-reveal is needed to get URLs
    try {
      if (!prov && /deepseek\.com$/i.test(HOST)) {
        const chips = Array.from(document.querySelectorAll('div._5cadb25, [class*="_5cadb25" i]'));
        console.log('[ACEP DeepSeek] Found chips:', chips.length);
        if (chips.length) {
          const imageExtRe = /\.(png|jpe?g|gif|webp|bmp|svg)(?:[?#].*)?$/i;
          const capturedUrls = new Map(); // filename -> url
          for (const chip of chips) {
            try {
              const nameEl = chip.querySelector('.f3a54b52, [class*="f3a54b52" i]');
              const fname = (nameEl?.textContent || '').trim();
              console.log('[ACEP DeepSeek] Processing chip:', fname);
              if (!fname || !imageExtRe.test(fname)) {
                console.log('[ACEP DeepSeek] Skipping - not an image file');
                continue;
              }
              // Check if URL already visible on chip
              const existingImg = chip.querySelector('img[src*="myhuaweicloud" i], img[src*="deepseek-api-files" i]');
              if (existingImg) {
                const src = existingImg.currentSrc || existingImg.getAttribute('src') || '';
                if (src) { capturedUrls.set(fname, src); continue; }
              }
              // Click to reveal
              const clickable = chip.querySelector('[tabindex]') || chip;
              console.log('[ACEP DeepSeek] Clicking chip to reveal image...');
              clickable.scrollIntoView({ block: 'center' });
              try { clickable.focus(); } catch {}
              try {
                const events = [
                  new PointerEvent('pointerdown', { bubbles: true, cancelable: true, pointerType: 'mouse' }),
                  new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window }),
                  new PointerEvent('pointerup', { bubbles: true, cancelable: true, pointerType: 'mouse' }),
                  new MouseEvent('mouseup', { bubbles: true, cancelable: true, view: window }),
                  new MouseEvent('click', { bubbles: true, cancelable: true, view: window }),
                ];
                events.forEach(ev => { try { clickable.dispatchEvent(ev); } catch {} });
              } catch {}
              await new Promise(r => setTimeout(r, 500));
              // Capture newly revealed URLs
              const overlayContainers = Array.from(document.querySelectorAll('div._519be07, [class*="_519be07" i], .ds-modal-wrapper, [class*="ds-modal-wrapper" i]'));
              console.log('[ACEP DeepSeek] Overlay containers found:', overlayContainers.length);
              let foundUrl = '';
              for (const c of overlayContainers) {
                const imgs = c.querySelectorAll('img[src]');
                for (const im of imgs) {
                  const s = im.currentSrc || im.getAttribute('src') || '';
                  console.log('[ACEP DeepSeek] Found image src:', s.slice(0, 100));
                  if (s && /myhuaweicloud|deepseek-api-files/i.test(s)) {
                    capturedUrls.set(fname, s);
                    foundUrl = s;
                    break;
                  }
                }
                if (foundUrl) break;
              }
              console.log('[ACEP DeepSeek] Captured URL:', foundUrl ? 'YES' : 'NO');
              // Close overlay
              try {
                document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
                document.dispatchEvent(new KeyboardEvent('keyup', { key: 'Escape', bubbles: true }));
              } catch {}
              await new Promise(r => setTimeout(r, 100));
            } catch {}
          }
          // Attach captured URLs to user rows
          console.log('[ACEP DeepSeek] Total captured URLs:', capturedUrls.size);
          console.log('[ACEP DeepSeek] Captured:', [...capturedUrls.entries()]);
          if (capturedUrls.size > 0) {
            const norm = (s='') => String(s).replace(/\s+/g,' ').trim();
            const userRows = rows.map((r,i)=>({
              i, role: r.role,
              text: norm(htmlToPlainText(r.rawHtml || r.html || '')),
            })).filter(x=>x.role==='user');
            for (const [fname, url] of capturedUrls) {
              // Match to user row by finding nearest chip's parent message text
              const chip = [...chips].find(c => {
                const n = c.querySelector('.f3a54b52');
                return n && (n.textContent||'').trim() === fname;
              });
              let target = null;
              if (chip) {
                const msg = chip.closest('.ds-message, div.ds-message');
                if (msg) {
                  const msgText = norm(msg.querySelector('.fbb737a4, p.whitespace-pre-wrap.break-words')?.textContent || '');
                  target = userRows.find(u => u.text && (u.text === msgText || u.text.includes(msgText) || msgText.includes(u.text)));
                }
              }
              if (!target) target = userRows[userRows.length - 1];
              if (target) {
                const row = rows[target.i];
                row.imgs = row.imgs || [];
                const has = row.imgs.some(im => (im.src||'') === url);
                if (!has) row.imgs.push({ src: url, originalSrc: url, alt: fname });
              }
            }
          }
        }
      }
    } catch {}

    // DeepSeek: attach chip filenames to the correct user message (by nearest .ds-message text)
    try {
      if (!prov && /deepseek\.com$/i.test(HOST)) {
        const chips = Array.from(document.querySelectorAll('div._5cadb25, [class*="_5cadb25" i]'));
        if (chips.length) {
          const norm = (s='') => String(s).replace(/\s+/g,' ').trim();
          const userRows = rows.map((r,i)=>({
            i,
            role: r.role,
            text: norm(htmlToPlainText(r.rawHtml || r.html || '')),
          })).filter(x=>x.role==='user');
          for (const chip of chips) {
            const nameEl = chip.querySelector('.f3a54b52, [class*="f3a54b52" i]');
            const fname = norm(nameEl?.textContent || '');
            if (!fname) continue;
            // Find the message container that holds this chip
            const msg = chip.closest('.ds-message, div.ds-message');
            let msgText = '';
            try {
              const t = msg?.querySelector('.fbb737a4, p.whitespace-pre-wrap.break-words');
              msgText = norm(t?.innerText || t?.textContent || '');
            } catch {}
            // Match to user row by exact or contains
            let target = userRows.find(u => u.text && (u.text === msgText));
            if (!target && msgText) target = userRows.find(u => u.text && (u.text.includes(msgText) || msgText.includes(u.text)));
            if (!target) continue;
            const row = rows[target.i];
            row.imgs = row.imgs || [];
            // Avoid duplicates
            const has = row.imgs.some(im => !im.src && String(im.alt||'').toLowerCase() === fname.toLowerCase());
            if (!has) row.imgs.push({ src:'', originalSrc:'', alt: fname, width:0, height:0 });
          }
        }
      }
    } catch {}
    // If DeepSeek: inject globally discovered upload URLs into the nearest user row
    if (!prov && /deepseek\.com$/i.test(HOST)) {
      try {
        const allUrls = Array.from(document.querySelectorAll(
          'a[href*="myhuaweicloud" i], a[href*="deepseek-api-files" i], img[src*="myhuaweicloud" i], img[src*="deepseek-api-files" i]'
        )).map(el => el.href || el.currentSrc || el.src).filter(Boolean);
        // Also pull from Resource Timing (network) in case DOM doesnÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¾Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¦ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¦ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¾ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢t keep anchors
        try {
          const perf = performance.getEntriesByType ? performance.getEntriesByType('resource') : [];
          for (const e of perf) {
            const n = e && (e.name || '');
            if (/myhuaweicloud|deepseek-api-files/i.test(n)) allUrls.push(n);
          }
        } catch {}
        const norm = (u) => {
          try { const url = new URL(u, ORIGIN); url.hash=''; return url.toString(); } catch { return u; }
        };
        const existing = new Set();
        rows.forEach(r => (r.imgs||[]).forEach(i => existing.add(norm(i.originalSrc || i.src || ''))));
        // Prefer mapping URLs found within user turns; fallback to last user.
        const userRows = rowTurnMap.filter(m => rows[m.rowIndex]?.role === 'user');
        userRows.forEach(({ rowIndex, turn }) => {
          const row = rows[rowIndex];
          if (!turn || !turn.querySelectorAll) return;
          const nodes = Array.from(turn.querySelectorAll(
            'a[href*="myhuaweicloud" i], a[href*="deepseek-api-files" i], img[src*="myhuaweicloud" i], img[src*="deepseek-api-files" i]'
          ));
          nodes.forEach(n => {
            const raw = n.href || n.currentSrc || n.src || '';
            if (!raw || /avatar/i.test(raw)) return;
            const key = norm(raw);
            if (!key || existing.has(key)) return;
            existing.add(key);
            addImgToRow(row, raw, n.getAttribute?.('alt') || '');
          });
        });
        const attachTo = [...rows].reverse().find(r => r.role === 'user') || null;
        if (attachTo) {
          for (const raw of allUrls) {
            if (/avatar/i.test(raw)) continue;
            const key = norm(raw);
            if (!key || existing.has(key)) continue;
            existing.add(key);
            addImgToRow(attachTo, raw, '');
          }
        }
      } catch {}
    }
    if (!prov && /deepseek\.com$/i.test(HOST)) {
      rows.forEach(r => {
        if (r.role === 'assistant') {
          r.imgs = [];
          r.html = (r.html || '').replace(/<img\b[^>]*>/gi, '');
        }
      });
    }

    // Provider-aware labels and icons
    const provider = (/grok\.com$/i.test(HOST)) ? 'Grok'
                    : (/claude\.ai$/i.test(HOST)) ? 'Claude'
                    : (/deepseek\.com$/i.test(HOST)) ? 'DeepSeek'
                    : (/gemini\.google\.com$/i.test(HOST)) ? 'Gemini'
                    : 'ChatGPT';
    function getRoleLabel(role) {
      if (role === "user") return STATE.messages?.role_user?.message || "You said";
      if (role === "assistant") {
        // override assistant label per provider
        const base = STATE.messages?.role_assistant?.message || 'ChatGPT said';
        if (provider === 'ChatGPT') return base;
        return provider + ' said';
      }
      return "";
    }
    function getRoleIcon(role) {
      if (removeIcons) return "";
      if (role === 'user') {
        const u = loadIconDataUrlSync('user');
        return u ? `<img src="${u}" alt="user-icon" class="role-icon" style="width:18px;height:18px;vertical-align:middle;margin-right:6px;">` : '';
      }
      if (role === 'assistant') {
        const key = (provider === 'Grok') ? 'grok'
                   : (provider === 'Claude') ? 'claude'
                   : (provider === 'DeepSeek') ? 'deepseek'
                   : (provider === 'Gemini') ? 'gemini'
                   : 'chatgpt';
        const u = loadIconDataUrlSync(key);
        return u ? `<img src="${u}" alt="assistant-icon" class="role-icon" style="width:18px;height:18px;vertical-align:middle;margin-right:6px;">` : '';
      }
      return '';
    }
    rows.forEach(r => { r.roleLabel = getRoleLabel(r.role); });
    // Delay building the HTML until after role/text/img post-processing below
    let wrapper = null;
    // Rebuild final HTML now that roles/text/imgs are stable
    let inferredFilter = '';
    if (!effectiveFilter && selectedSet && selectedSet.size) {
      let seenUser = false;
      let seenAssistant = false;
      for (let i = 0; i < rows.length; i++) {
        const r = rows[i];
        const id = String(i);
        const tid = String(r.turnId || '');
        const allowed = (selectedIdxSet && selectedIdxSet.has(id))
          || selectedSet.has(id)
          || (tid && selectedSet.has(tid));
        if (!allowed) continue;
        if (r.role === 'user') seenUser = true;
        if (r.role === 'assistant') seenAssistant = true;
      }
      if (seenUser && !seenAssistant) inferredFilter = 'user';
      if (seenAssistant && !seenUser) inferredFilter = 'assistant';
    }
    const finalFilter = (effectiveFilter || inferredFilter);
    const imagesOnly = finalFilter === 'images';
    const roleFilter = (finalFilter === 'user' || finalFilter === 'assistant') ? finalFilter : '';
    const roleFromTurnAttr = new Map();
    rowTurnMap.forEach(({ rowIndex, turn }) => {
      if (!turn || rowIndex == null) return;
      const mark = turn.getAttribute && turn.getAttribute('data-acep-role');
      if (mark) roleFromTurnAttr.set(rowIndex, mark);
    });
    const rowsFiltered = rows.filter((r, idx) => {
      if (roleFilter) {
        const mark = roleFromTurnAttr.get(idx);
        const roleToCheck = mark || r.role;
        if (roleToCheck !== roleFilter) return false;
      }
      if (imagesOnly) {
        const hasImgs = Array.isArray(r.imgs) && r.imgs.some(i => (i.src || i.originalSrc || i.alt));
        if (!hasImgs && !/<img\b/i.test(r.html || '')) return false;
      }
      return true;
    });
    const forceDark = String(theme || 'light').toLowerCase() === 'dark';
    const turnHtmlParts = rowsFiltered.map(r => {
      let html = sanitizeMessageHTML(r.html);
      // Render attachment markers as visible lines for HTML/PNG (the PDF/DOCX paths do a similar conversion).
      try {
        if (html && /data-acep-attachment-name=/i.test(html)) {
          html = html.replace(
            /<div\b[^>]*\bdata-acep-attachment-name\s*=\s*(["'])(.*?)\1[^>]*>\s*<\/div>/gi,
            (_m, _q, name) => `<p class="attachment" style="margin:4px 0;color:#555">[Attachment]: ${escapeHtml(String(name || '').trim())}</p>`
          );
        }
      } catch {}
      const hasImgTag = /<img\b/i.test(html);
      let imgs = "";
      let attachLines = "";
      const isBannedExportImage = (u = '') => {
        if (!u) return true;
        if (isExtensionUrl(u)) return true;
        if (/gstatic\.com\/images\/branding\/productlogos\/youtube\//i.test(u)) return true;
        if (/i\.ytimg\.com\//i.test(u)) return true;
        if (/google\.com\/s2\/favicons/i.test(u)) return true;
        if (/lh3\.google\.com\/u\/\d+\/ogw\//i.test(u)) return true;
        if (/\/file-icons\//i.test(u)) return true; // Grok file chip icons
        return false;
      };
      if (Array.isArray(r.imgs) && r.imgs.length) {
        const imgTags = [];
        const attachs = [];
        const seenImgKeys = new Set();
        const hasAttachmentMarkers = /data-acep-attachment-name=/i.test(html);
        const isImageFilename = (name = '') => {
          const s = String(name || '').trim().toLowerCase();
          return /\.(png|jpe?g|gif|webp|bmp|svg|avif)(\?|#|$)/i.test(s);
        };
        const normImgKey = (u = '') => {
          try {
            const s = String(u || '').trim();
            if (!s) return '';
            let k = s.split('#')[0];
            const qm = k.indexOf('?');
            if (qm >= 0) k = k.slice(0, qm);
            return k;
          } catch { return ''; }
        };
        const galleryTagItems = [];
        const missingImgTags = [];
        const htmlHasImageSrc = (candidate = '') => {
          try {
            const raw = String(candidate || '').trim();
            if (!raw) return false;
            const escapedAmp = raw.replace(/&/g, '&amp;');
            const key = normImgKey(raw);
            return html.includes(raw) || html.includes(escapedAmp) || (key && html.includes(key));
          } catch { return false; }
        };
        r.imgs.forEach(i => {
          const s = String(i.src||'');
          const hasSrc = /^https?:/i.test(s) || /^data:/i.test(s) || /^blob:/i.test(s);
          const orig = String(i.originalSrc || s);
          const key = normImgKey(orig || s);
          if (key && seenImgKeys.has(key)) return;
          if (key) seenImgKeys.add(key);
          if (hasSrc && !isBannedExportImage(s) && !isBannedExportImage(orig)) {
            const dataUrl = shouldEmbedImageData ? String(i.dataUrl || '') : '';
            const srcUsed = (dataUrl && /^data:image\//i.test(dataUrl)) ? dataUrl : s;
            // Always emit <img> tags here. Protected images are handled later (popup.js):
            // - HTML self: embedded as data URLs
            // - HTML linked: replaced with a single link placeholder (deduped)
            const item = { srcUsed, orig, alt: String(i.alt || '') };
            galleryTagItems.push(item);
            const tag = `<img src="${escapeAttr(srcUsed)}" data-original-src="${escapeAttr(orig)}" data-acep-api-image="1" alt="${escapeAttr(item.alt)}">`;
            imgTags.push(tag);
            if (hasImgTag && !htmlHasImageSrc(orig) && !htmlHasImageSrc(srcUsed)) missingImgTags.push(tag);
          } else if (!hasAttachmentMarkers && (i.alt||'').trim()) {
            // Avoid duplicate "[Attachment]" lines for image uploads when we already show an <img>.
            // DeepSeek often includes filename/size text in the DOM; adding another line is noisy.
            if (isImageFilename(i.alt) && (hasImgTag || imgTags.length)) return;
            attachs.push(`<p class="attachment" style="margin:4px 0;color:#555">[Attachment]: ${escapeHtml(i.alt.trim())}</p>`);
          }
        });
        if (hasImgTag && missingImgTags.length) {
          imgs = missingImgTags.join('');
        } else if (!hasImgTag && imgTags.length) {
          const shouldGroupChatgptImgs = /chatgpt\.com$/i.test(HOST) && galleryTagItems.length > 1 && galleryTagItems.length <= 4;
          if (shouldGroupChatgptImgs) {
            const columns = Math.max(1, Math.min(galleryTagItems.length, 4));
            imgs = `<div class="acep-chatgpt-image-gallery" style="--acep-gallery-columns:${columns};display:grid;grid-template-columns:repeat(${columns},minmax(0,1fr));gap:4px;margin:8px 0 14px 0;overflow:hidden;width:640px;max-width:100%;align-items:stretch;">${galleryTagItems.map((item, imageIndex) => `<div class="acep-chatgpt-image-tile ${imageIndex === 0 ? 'rounded-s-xl' : ''} ${imageIndex === galleryTagItems.length - 1 ? 'rounded-e-xl' : ''}" style="width:100%;max-width:100%;aspect-ratio:5/4;overflow:hidden;border-radius:12px;min-width:0;margin:0;padding:0;clear:none;position:relative;box-sizing:border-box;"><img src="${escapeAttr(item.srcUsed)}" data-original-src="${escapeAttr(item.orig)}" data-acep-api-image="1" alt="${escapeAttr(item.alt)}" style="width:100%;height:100%;max-width:none;object-fit:cover;display:block;margin:0;padding:0;border-radius:12px;clear:none;"></div>`).join('')}</div>`;
          } else {
            imgs = imgTags.join('');
          }
        }
        if (attachs.length) attachLines = attachs.join('');
      }
      const codeBg = forceDark ? '#0b1220' : '#f3f4f6';
      const codeFg = forceDark ? '#e5e7eb' : '#0f172a';
      const codeBorder = forceDark ? '#1f2937' : '#e2e8f0';
      const codeStyle = `background:${codeBg} !important;color:${codeFg} !important;border:1px solid ${codeBorder} !important;border-radius:12px;padding:12px 14px;display:block;box-sizing:border-box;max-width:100%;white-space:pre;overflow-x:auto;`;
      // Grok uses backticks heavily for UI selectors (e.g. `.prompt-input`) and library names; a full bordered
      // inline-code pill everywhere looks like "code blocks between code blocks". Use a lighter pill on Grok.
      const codeInlineStyle = /grok\.com$/i.test(HOST)
        ? `background:${forceDark ? '#111827' : '#f8fafc'} !important;color:${codeFg} !important;border:1px solid ${forceDark ? '#1f2937' : '#e5e7eb'} !important;border-radius:6px;padding:1px 4px;display:inline-block;font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;`
        : `background:${codeBg} !important;color:${codeFg} !important;border:1px solid ${codeBorder} !important;border-radius:4px;padding:2px 4px;display:inline-block;`;
      const wrap = document.createElement('div');
      wrap.innerHTML = html;

      // Grok/API: sometimes multi-line code arrives as a single <code> element with <br> breaks (not inside <pre>).
      // Treat those as display code blocks by converting them to <pre><code>.
      try {
        if (/grok\.com$/i.test(HOST)) {
          // If a provider accidentally wrapped rich HTML (e.g. <strong>, <a>) inside <code>,
          // unwrap it. Real inline code from our markdown pipeline should be plain text only.
          // This prevents "normal text after code blocks" from inheriting inline code styling.
          try {
            wrap.querySelectorAll('code').forEach((c) => {
              try {
                if (!c || c.closest('pre')) return;
                // Only unwrap when the <code> contains actual rich elements (e.g. <strong>, <a>).
                // Do NOT unwrap when the only children are <br> line breaks, because Grok/API
                // represents multi-line code blocks as <code> with <br> and we promote those to <pre> below.
                const childEls = Array.from(c.children || []);
                const hasNonBrChild = childEls.some((el) => String(el?.tagName || '').toUpperCase() !== 'BR');
                if (!hasNonBrChild) return;
                const parent = c.parentNode;
                if (!parent) return;
                while (c.firstChild) parent.insertBefore(c.firstChild, c);
                c.remove();
              } catch {}
            });
          } catch {}

          wrap.querySelectorAll('code').forEach((c) => {
            try {
              if (!c || c.closest('pre')) return;
              if (c.closest('[data-testid="code-block"]') || c.closest('.code-block__code') || c.closest('.shiki') || c.closest('.hljs')) return;
              const brCount = c.querySelectorAll('br').length;
              if (brCount < 2) return;
              // `innerText` can collapse `<br>` into spaces in some cases; preserve line breaks explicitly.
              const collectWithBr = (node) => {
                const out = [];
                const walk = (n) => {
                  if (!n) return;
                  if (n.nodeType === 3) { out.push(String(n.nodeValue || '')); return; }
                  if (n.nodeType !== 1) return;
                  const tag = String(n.tagName || '').toUpperCase();
                  if (tag === 'BR') { out.push('\n'); return; }
                  // Avoid pulling nested code as raw HTML; just text+BR is enough here.
                  const kids = Array.from(n.childNodes || []);
                  if (!kids.length) return;
                  kids.forEach(walk);
                };
                walk(node);
                return out.join('').replace(/\r\n/g, '\n');
              };
              const txt = collectWithBr(c).trimEnd();
              if (!txt || txt.length < 60) return;
              const codeLike = /[{}();=<>]/.test(txt) || /\b(import|export|const|let|var|function|class|return|if|else|for|while)\b/.test(txt);
              if (!codeLike && txt.length < 140) return;

              const lines = txt.split('\n').map(s => s.trimEnd());
              const first = (lines[0] || '').trim().toLowerCase();
              const known = new Set(['js','javascript','ts','typescript','bash','sh','shell','python','py','json','yaml','yml','html','css','sql','go','rust','java','c','cpp','c++','c#','cs','php','ruby','rb']);
              let lang = known.has(first) ? first : '';
              let bodyLines = lines;
              if (lang && lines.length >= 2 && (lines[0] || '').length <= 30) bodyLines = lines.slice(1);
              const body = bodyLines.join('\n').trimEnd();
              if (!body) return;

              const pre = document.createElement('pre');
              const code = document.createElement('code');
              if (lang) {
                const key = lang.replace(/[^a-z0-9_+-]+/g, '');
                if (key) code.className = `language-${key}`;
              }
              code.textContent = body;
              pre.appendChild(code);
              c.replaceWith(pre);
            } catch {}
          });
        }
      } catch {}

      // Grok DOM: normalize `div[data-testid="code-block"]` widgets into standard <pre><code> blocks.
      // Grok's code widget can contain multiple nested wrappers and sometimes splits content into
      // mixed nodes, which causes some lines to be styled as inline code and others as plain text.
      // Converting to a single <pre><code> preserves line breaks consistently for HTML/DOCX/PDF.
      try {
        if (/grok\.com$/i.test(HOST)) {
          const grokNormDbg = { codeWidget: 0, codeWidgetReplaced: 0, inlineCodeRunsMerged: 0, inlineCodeRunsSkipped: 0, remainingInlineCode: 0, codePromotedToPre: 0, codePromoteSkippedInLi: 0 };
          wrap.querySelectorAll('[data-testid="code-block"]').forEach((block) => {
            try {
              grokNormDbg.codeWidget++;
              const pres = Array.from(block.querySelectorAll('pre'));
              const pre = pres[0] || null;
              if (!pre) return;
              // Some Grok code widgets split content across multiple <pre> elements; merge them.
              const codeText = pres.map(p => (p.innerText || p.textContent || '').replace(/\r\n/g, '\n').trimEnd()).filter(Boolean).join('\n').trimEnd();
              if (!codeText) return;
              const lang = (block.querySelector('span.font-mono')?.textContent || '').trim();
              const preOut = document.createElement('pre');
              const codeOut = document.createElement('code');
              const key = (lang || 'plaintext').toLowerCase().replace(/[^a-z0-9_+-]+/g, '');
              codeOut.className = `language-${key || 'plaintext'}`;
              codeOut.textContent = codeText;
              preOut.appendChild(codeOut);
              block.replaceWith(preOut);
              grokNormDbg.codeWidgetReplaced++;
            } catch {}
          });

          // Grok can also emit "pseudo code blocks" as many consecutive inline <code> elements
          // (often inside <p> or <li>) separated by <br> / whitespace. Styling those as inline code
          // creates the "line-by-line padding boxes" artifact. Merge those runs into one <pre><code>.
          const isInlineCode = (n) => {
            try { return n && n.nodeType === 1 && n.tagName === 'CODE' && !(n.closest && n.closest('pre')); } catch { return false; }
          };
          const isSep = (n) => {
            try {
              if (!n) return false;
              if (n.nodeType === 3) return !String(n.textContent || '').trim();
              if (n.nodeType === 1 && n.tagName === 'BR') return true;
              return false;
            } catch { return false; }
          };
          const isLikelyBlocky = (t = '') => {
            const s = String(t || '').trim();
            if (!s) return false;
            if (s.length >= 60) return true;
            if (/\n/.test(s)) return true;
            if (/[{}();=<>]/.test(s) && s.length >= 18) return true;
            if (/\b(const|let|var|function|import|export|class|return|if|else|for|while)\b/.test(s)) return true;
            return false;
          };
          const guessLang = (t = '') => {
            const s = String(t || '').trim().toLowerCase();
            const head = s.split(/\s+/)[0] || '';
            const known = new Set(['js','javascript','ts','typescript','bash','sh','shell','python','py','json','yaml','yml','html','css','sql','go','rust','java','c','cpp','c++','c#','cs','php','ruby','rb']);
            return known.has(head) ? head : '';
          };
          const parents = Array.from(wrap.querySelectorAll('p, li, div')).slice(0, 5000);
          parents.forEach((parent) => {
            try {
              const nodes = Array.from(parent.childNodes || []);
              for (let i = 0; i < nodes.length; i++) {
                const n = nodes[i];
                if (!isInlineCode(n)) continue;
                const run = [];
                const remove = [];
                let j = i;
                while (j < nodes.length) {
                  const cur = nodes[j];
                  if (isInlineCode(cur)) { run.push(cur); j++; continue; }
                  if (isSep(cur)) { remove.push(cur); j++; continue; }
                  break;
                }
                if (run.length < 2) continue;
                const texts = run.map(c => String(c.textContent || '').replace(/\r\n/g, '\n').trimEnd());
                const joined = texts.join('\n').trimEnd();
                const blockyCount = texts.filter(isLikelyBlocky).length;
                if (blockyCount < Math.ceil(run.length / 2) && joined.length < 140) continue;

                // If the first code token is just a language label, drop it from the body and apply as class.
                let lang = guessLang(texts[0]);
                let bodyTexts = texts;
                if (lang && texts[0].length <= 20) bodyTexts = texts.slice(1);
                const body = bodyTexts.join('\n').trimEnd();
                if (!body) continue;

                const preOut = document.createElement('pre');
                const codeOut = document.createElement('code');
                const key = (lang || 'plaintext').toLowerCase().replace(/[^a-z0-9_+-]+/g, '');
                codeOut.className = `language-${key || 'plaintext'}`;
                codeOut.textContent = body;
                preOut.appendChild(codeOut);

                // Replace first code node, then remove the rest of the run and separators.
                const first = run[0];
                try { first.replaceWith(preOut); } catch { continue; }
                for (let k = 1; k < run.length; k++) { try { run[k].remove(); } catch {} }
                for (const sep of remove) { try { sep.remove(); } catch {} }
                grokNormDbg.inlineCodeRunsMerged++;

                // Refresh node list bounds
                i = j;
              }
            } catch {}
          });

          try {
            grokNormDbg.remainingInlineCode = wrap.querySelectorAll('code:not(pre code)').length;
            document.documentElement.setAttribute('data-acep-grok-code-norm-dbg', JSON.stringify(grokNormDbg));
          } catch {}
        }
      } catch {}

      // DeepSeek DOM: normalize md-code-block widgets into standard <pre><code class="language-..."> blocks
      // so exported HTML (and downstream exporters) don't lose line breaks / styling.
      try {
        if (/deepseek\.com$/i.test(HOST)) {
          const guessDeepseekCodeLang = (code = '') => {
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
          wrap.querySelectorAll('.md-code-block').forEach((block) => {
            try {
              const lang =
                (block.querySelector('.md-code-block-banner-wrap .d813de27')?.textContent || '').trim() ||
                (block.querySelector('.md-code-block-banner-wrap [class*=\"language\" i]')?.textContent || '').trim();
              const pre = block.querySelector('pre');
              if (!pre) return;
              const codeText = (pre.innerText || pre.textContent || '').replace(/\r\n/g, '\n').trimEnd();
              if (!codeText) return;
              const preOut = document.createElement('pre');
              const codeOut = document.createElement('code');
              const key = (lang || guessDeepseekCodeLang(codeText)).toLowerCase().replace(/[^a-z0-9_+-]+/g, '');
              codeOut.className = `language-${key || 'plaintext'}`;
              codeOut.textContent = codeText;
              preOut.appendChild(codeOut);
              block.replaceWith(preOut);
            } catch {}
          });
        }
      } catch {}
      // Code blocks: keep selectors tight. Broad selectors like `[class*="language-"]` can match
      // unrelated UI elements and accidentally style normal text as code.
      const blockSelectors = [
        'pre',
        'pre code',
        '.code-block__code',
        '.shiki',
        '.hljs',
      ];
      wrap.querySelectorAll(blockSelectors.join(',')).forEach(el => {
        // Grok: code blocks are wrapped in a data-testid="code-block" container; style the inner <pre> as the actual block.
        try {
          if (el.getAttribute && el.getAttribute('data-testid') === 'code-block') {
            const pre = el.querySelector && el.querySelector('pre');
            if (pre) el = pre;
          }
        } catch {}
        // Apply block styling to PRE (outer box). Avoid applying the same box styling to inner CODE nodes,
        // which can create nested/double boxes and line-by-line padding artifacts.
        if (el && el.tagName === 'CODE' && el.closest && el.closest('pre')) {
          el.style.cssText = 'padding:0;border:0;background:transparent !important;display:block;white-space:inherit;';
          return;
        }
        el.style.cssText = codeStyle;
        const innerCode = el.querySelector('code');
        if (innerCode) innerCode.style.cssText = 'padding:0; border:0; background:transparent !important; display:block; white-space:inherit;';
      });
      wrap.querySelectorAll('code').forEach(el => {
        // Inline code only: ignore any code inside known code block containers.
        if (el.closest('pre') || el.closest('[data-testid="code-block"]') || el.closest('.code-block__code') || el.closest('.shiki') || el.closest('.hljs')) return;
        const txt = (el.innerText || '').trim();
        // Grok: if we have a run of consecutive inline <code> nodes separated only by <br>/whitespace,
        // treat that as a single code block (this often comes from API markdown like:
        // `line1`\n`line2`\n`line3`).
        if (/grok\.com$/i.test(HOST)) {
          try {
            const parent = el.parentNode;
            if (parent && parent.nodeType === 1) {
              const sibs = Array.from(parent.childNodes || []);
              const idx = sibs.indexOf(el);
              if (idx >= 0) {
                const isInlineCode = (n) => n && n.nodeType === 1 && n.tagName === 'CODE' && !(n.closest && n.closest('pre'));
                const isSep = (n) => {
                  if (!n) return false;
                  if (n.nodeType === 3) return !String(n.textContent || '').trim();
                  if (n.nodeType === 1 && n.tagName === 'BR') return true;
                  return false;
                };
                // Collect a forward run starting at this <code>
                const run = [];
                const remove = [];
                let j = idx;
                while (j < sibs.length) {
                  const cur = sibs[j];
                  if (isInlineCode(cur)) { run.push(cur); j++; continue; }
                  if (isSep(cur)) { remove.push(cur); j++; continue; }
                  break;
                }
                if (run.length >= 3) {
                  const texts = run.map(c => String(c.textContent || '').replace(/\r\n/g, '\n').trimEnd());
                  const joined = texts.join('\n').trimEnd();
                  // Require "code-like" content to avoid merging normal inline snippets.
                  const codeLike = /[{}();=<>]/.test(joined) || /\b(import|export|const|let|var|function|class|return|if|else|for|while)\b/.test(joined);
                  if (codeLike || joined.length >= 120) {
                    const pre = document.createElement('pre');
                    const code = document.createElement('code');
                    code.textContent = joined;
                    pre.appendChild(code);
                    pre.style.cssText = codeStyle;
                    code.style.cssText = 'padding:0;border:0;background:transparent !important;display:block;white-space:inherit;';
                    run[0].replaceWith(pre);
                    for (let k = 1; k < run.length; k++) { try { run[k].remove(); } catch {} }
                    for (const sep of remove) { try { sep.remove(); } catch {} }
                    return;
                  }
                }
              }
            }
          } catch {}
        }
        // Never promote code inside lists/headings into block code; it causes list degradation.
        if (el.closest('li') || el.closest('ul') || el.closest('ol') || el.closest('h1,h2,h3,h4,h5,h6')) {
          try {
            if (/grok\.com$/i.test(HOST)) {
              const dbg = JSON.parse(document.documentElement.getAttribute('data-acep-grok-code-norm-dbg') || '{}');
              dbg.codePromoteSkippedInLi = (dbg.codePromoteSkippedInLi || 0) + 1;
              document.documentElement.setAttribute('data-acep-grok-code-norm-dbg', JSON.stringify(dbg));
            }
          } catch {}
          el.style.cssText = codeInlineStyle;
          return;
        }
        if (txt.includes('\n') || txt.length > 80) {
          // Grok API often uses many inline <code> segments for large blocks; promoting each one to <pre>
          // creates the "split into many boxes" artifact. Prefer keeping them inline on Grok and let the
          // provider-side code-widget normalization handle true blocks.
          if (/grok\.com$/i.test(HOST)) {
            el.style.cssText = codeInlineStyle;
            return;
          }
          // Promote multi-line <code> blocks to <pre><code> so whitespace is preserved consistently.
          try {
            const pre = document.createElement('pre');
            const code = document.createElement('code');
            code.textContent = (el.innerText || el.textContent || '').replace(/\r\n/g, '\n').trimEnd();
            pre.appendChild(code);
            pre.style.cssText = codeStyle;
            code.style.cssText = 'padding:0;border:0;background:transparent !important;';
            el.replaceWith(pre);
            try {
              if (/grok\.com$/i.test(HOST)) {
                const dbg = JSON.parse(document.documentElement.getAttribute('data-acep-grok-code-norm-dbg') || '{}');
                dbg.codePromotedToPre = (dbg.codePromotedToPre || 0) + 1;
                document.documentElement.setAttribute('data-acep-grok-code-norm-dbg', JSON.stringify(dbg));
              }
            } catch {}
            return;
          } catch {}
          el.style.cssText = codeStyle;
        }
        else el.style.cssText = codeInlineStyle;
      });
      try {
        const galleryCount = Number(r.galleryCount || 0);
        if (/chatgpt\.com$/i.test(HOST) && !wrap.querySelector('.acep-chatgpt-image-gallery')) {
          const candidateImgs = Array.from(wrap.querySelectorAll('img')).filter((img) => {
            const src = String(img.getAttribute('src') || img.getAttribute('data-original-src') || '').trim();
            if (!src || isBannedExportImage(src)) return false;
            if (isExtensionUrl(src)) return false;
            return /^https?:/i.test(src) || /^data:image\//i.test(src) || /^blob:/i.test(src);
          });
          const inferredCount = galleryCount > 1 ? galleryCount : ((candidateImgs.length > 1 && candidateImgs.length <= 4) ? candidateImgs.length : 0);
          const selected = inferredCount > 1 ? candidateImgs.slice(0, inferredCount) : [];
          if (selected.length > 1) {
            const columns = Math.max(1, Math.min(selected.length, 4));
            const gallery = document.createElement('div');
            gallery.className = 'acep-chatgpt-image-gallery';
            gallery.style.cssText = `--acep-gallery-columns:${columns};display:grid;grid-template-columns:repeat(${columns},minmax(0,1fr));gap:4px;margin:8px 0 14px 0;overflow:hidden;width:640px;max-width:100%;align-items:stretch;`;
            selected.forEach((sourceImg, imageIndex) => {
              const tile = document.createElement('div');
              tile.className = `acep-chatgpt-image-tile ${imageIndex === 0 ? 'rounded-s-xl' : ''} ${imageIndex === selected.length - 1 ? 'rounded-e-xl' : ''}`.trim();
              tile.style.cssText = 'width:100%;max-width:100%;aspect-ratio:5/4;overflow:hidden;border-radius:12px;min-width:0;margin:0;padding:0;clear:none;position:relative;box-sizing:border-box;';
              const img = sourceImg.cloneNode(true);
              img.removeAttribute('width');
              img.removeAttribute('height');
              img.style.cssText = 'width:100%;height:100%;max-width:none;object-fit:cover;display:block;margin:0;padding:0;border-radius:12px;clear:none;';
              tile.appendChild(img);
              gallery.appendChild(tile);
            });
            const removableWrapper = (img) => {
              const parent = img.parentElement;
              if (!parent || parent === wrap) return img;
              const text = String(parent.textContent || '').replace(/\s+/g, '').trim();
              const imgCount = parent.querySelectorAll('img').length;
              if (!text && imgCount === 1) return parent;
              return img;
            };
            const firstTarget = removableWrapper(selected[0]);
            firstTarget.replaceWith(gallery);
            selected.slice(1).forEach((img) => {
              try { removableWrapper(img).remove(); } catch {}
            });
          }
        }
      } catch {}
      let imageOnlyHtml = '';
      if (imagesOnly) {
        const imgNodes = Array.from(wrap.querySelectorAll('img'));
        if (imgNodes.length) {
          imageOnlyHtml = imgNodes.map(n => n.outerHTML).join('');
        }
        if (!imageOnlyHtml) imageOnlyHtml = imgs + attachLines;
      }
      const processedHtml = imagesOnly ? imageOnlyHtml : (wrap.innerHTML + imgs + attachLines);
      // When selective mode is "Images only", ensure the returned `rows` also contain image-only HTML.
      // Otherwise paged exports (PDF/DOCX) can still pick up the original text from `row.html` even though
      // the generated HTML file correctly shows images only.
      if (imagesOnly) {
        try {
          r.html = processedHtml;
          r.rawHtml = processedHtml;
          r.text = '';
        } catch {}
      }
      const roleAttr = (r.role === 'assistant' || r.role === 'artifact') ? 'assistant' : 'user';
      return `<div class="acep-turn" data-acep-role="${escapeAttr(roleAttr)}" data-acep-turn-id="${escapeAttr(String(r.turnId || ''))}"><div class="acep-bubble">${processedHtml}</div></div>`;
    });
    wrapper = document.createElement('div');
    turnHtmlParts.forEach((turnHtml) => {
      const holder = document.createElement('div');
      holder.innerHTML = String(turnHtml || '');
      const turnElement = holder.querySelector(':scope > .acep-turn');
      if (turnElement) wrapper.appendChild(turnElement);
    });
    // Provider hook: allow platform-specific HTML wrapper tweaks without hardcoding in content.js.
    try {
      if (prov && typeof prov.postProcessHtmlWrapper === 'function') {
        prov.postProcessHtmlWrapper({
          wrapper,
          rows: rowsFiltered,
          exportMode,
          wantImageData: shouldEmbedImageData,
          theme,
          host: HOST,
          origin: ORIGIN,
        });
      }
    } catch {}
    if (/chatgpt\.com$/i.test(HOST) || /chat\.openai\.com$/i.test(HOST)) {
      try {
        const apiImageUrlsByTurnId = new Map();
        const normalizeOwnedImageUrl = (value = '') => String(value || '').trim().replace(/&amp;/g, '&');
        const apiTurnNodes = Array.isArray(prov?.__apiTurnNodes) ? prov.__apiTurnNodes : [];
        apiTurnNodes.forEach((apiNode) => {
          const turnId = String(apiNode?.getAttribute?.('data-acep-turn-id') || '');
          if (!turnId) return;
          const urls = new Set();
          try {
            const metadataImages = JSON.parse(apiNode.getAttribute('data-acep-imgs') || '[]');
            (Array.isArray(metadataImages) ? metadataImages : []).forEach((img) => {
              const url = normalizeOwnedImageUrl(img?.originalSrc || img?.src || '');
              if (url) urls.add(url);
            });
          } catch {}
          apiNode.querySelectorAll?.('img[data-acep-api-image="1"]').forEach((img) => {
            const url = normalizeOwnedImageUrl(img.getAttribute('data-original-src') || img.getAttribute('src') || '');
            if (url) urls.add(url);
          });
          apiImageUrlsByTurnId.set(turnId, urls);
        });
        let removedUnownedImages = 0;
        wrapper.querySelectorAll('.acep-turn').forEach((section) => {
          const turnId = String(section.getAttribute('data-acep-turn-id') || '');
          const allowedUrls = turnId ? (apiImageUrlsByTurnId.get(turnId) || new Set()) : new Set();
          section.querySelectorAll('img:not(.role-icon)').forEach((img) => {
            const original = normalizeOwnedImageUrl(img.getAttribute('data-original-src') || img.getAttribute('src') || '');
            if (original && allowedUrls.has(original)) {
              img.setAttribute('data-acep-api-image', '1');
              return;
            }
            img.remove();
            removedUnownedImages++;
          });
        });
        document.documentElement.setAttribute('data-acep-chatgpt-unowned-images-removed', String(removedUnownedImages));
      } catch {}
    }
    // Stamp data-original-src before inlining
    Array.from(wrapper.querySelectorAll('img')).forEach((img) => {
      const has = img.hasAttribute('data-original-src');
      const s = img.getAttribute('src') || '';
      if (!has && /^https?:\/\//i.test(s)) {
        img.setAttribute('data-original-src', s);
      } else if (!has && !s) {
        // ChatGPT renders images with empty src and the real URL in srcset
        const srcset = img.getAttribute('srcset') || '';
        const firstUrl = srcset.split(',')[0].trim().split(/\s+/)[0];
        if (firstUrl && /^https?:\/\//i.test(firstUrl)) {
          img.setAttribute('data-original-src', firstUrl);
          img.setAttribute('src', firstUrl);
        }
      }
    });
    // Inline images only for formats that need embedded image data (PDF/DOCX/PNG/HTML self).
    if (shouldEmbedImageData) {
      await inlineImagesInHTML(wrapper);
    }
    // Ensure text never overlays large images in HTML exports.
    try {
      const clearAfter = Array.from(wrapper.querySelectorAll('img, [data-inline-src], [data-original-src]'));
      clearAfter.forEach((node) => {
        if (!node || !node.parentNode) return;
        const next = node.nextSibling;
        if (next && next.nodeType === 1 && next.classList.contains('acep-clear')) return;
        const spacer = document.createElement('div');
        spacer.className = 'acep-clear';
        spacer.style.cssText = 'clear:both;height:0;line-height:0;';
        node.parentNode.insertBefore(spacer, node.nextSibling);
      });
    } catch {}
    const sectionEls = Array.from(wrapper.querySelectorAll('.acep-turn'));
    const rowsByTurnId = new Map();
    rowsFiltered.forEach((row) => {
      const turnId = String(row?.turnId || '');
      if (turnId && !rowsByTurnId.has(turnId)) rowsByTurnId.set(turnId, row);
    });
    sectionEls.forEach((sectionEl, idx) => {
      const sectionTurnId = String(sectionEl.getAttribute('data-acep-turn-id') || '');
      const row = (sectionTurnId && rowsByTurnId.get(sectionTurnId)) || rowsFiltered[idx];
      if (!row) return;
      const contentEl = sectionEl;
      // Remove duplicate <img> tags by identical data-original-src (or src) inside this section
      {
        const seen = new Set();
        const imgsAll = Array.from(contentEl.querySelectorAll('img'));
        for (const el of imgsAll) {
          const key = el.getAttribute('data-original-src') || el.getAttribute('src') || '';
          if (!key) continue;
          if (seen.has(key)) {
            el.remove();
          } else {
            seen.add(key);
          }
        }
      }
      const imgEls = Array.from(contentEl.querySelectorAll('img:not(.role-icon)'));
      function imgElToDataUrl(el){
        try {
          if (!el || !el.complete) return null;
          const w = el.naturalWidth || el.width;
          const h = el.naturalHeight || el.height;
          if (!w || !h) return null;
          const c = document.createElement('canvas');
          c.width = w; c.height = h;
          const ctx = c.getContext('2d');
          ctx.drawImage(el, 0, 0, w, h);
          return c.toDataURL('image/png');
        } catch { return null; }
      }
      row.imgs = imgEls.map((imgEl, imageIndex) => {
        const src = imgEl.getAttribute('src') || '';
        const originalAttr = imgEl.getAttribute('data-original-src') || '';
        const fallbackOriginal = row.originalImgs && imageIndex < row.originalImgs.length
          ? row.originalImgs[imageIndex].src || ''
          : '';
        const prior = (row.originalImgs && imageIndex < row.originalImgs.length) ? row.originalImgs[imageIndex] : {};
        let objectPosition = '';
        try {
          objectPosition = (imgEl.style && imgEl.style.objectPosition) || '';
          if (!objectPosition) {
            objectPosition = (getComputedStyle(imgEl).objectPosition || '').trim();
          }
        } catch {}
        const inlineData = shouldEmbedImageData ? (/^data:image\//i.test(src) ? src : imgElToDataUrl(imgEl)) : '';
        const dataUrl = shouldEmbedImageData ? (inlineData || prior?.dataUrl || undefined) : undefined;
        // Ensure HTML "self-contained" actually embeds the data URL in the markup.
        // This mirrors what makes PDF/DOCX succeed when images are already loaded in the page.
        try {
          if (dataUrl && shouldEmbedImageData) {
            imgEl.setAttribute('src', dataUrl);
            imgEl.setAttribute('data-inline-src', '1');
          }
        } catch {}
        return {
          src: dataUrl || src,
          dataUrl: shouldEmbedImageData ? dataUrl : undefined,
          alt: imgEl.getAttribute('alt') || '',
          originalSrc: originalAttr || fallbackOriginal || src,
          width: imgEl.naturalWidth || imgEl.width || 0,
          height: imgEl.naturalHeight || imgEl.height || 0,
          objectPosition,
        };
      });
      // If the HTML ended up with no <img> tags at all, preserve whatever we detected originally
      // (including filename-only placeholders) so PDF/DOCX still know this row has images/attachments.
      try {
        if ((!row.imgs || !row.imgs.length) && Array.isArray(row.originalImgs) && row.originalImgs.length) {
          row.imgs = row.originalImgs.map(i => ({ ...i }));
        }
      } catch {}
      const normalizeAttachmentName = (s = '') =>
        String(s || '')
          .replace(/\u00a0/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();
      // Always merge filename-only placeholders (attachments) back in, even when the HTML contains other <img> tags
      // (e.g., UI icons). Otherwise we can lose uploaded file names (notably Grok file chips).
      try {
        if (Array.isArray(row.originalImgs) && row.originalImgs.length) {
          const existing = new Set(
            (row.imgs || [])
              .filter(im => im && !String(im.originalSrc || im.src || '').trim() && (im.alt || '').trim())
              .map(im => `att:${normalizeAttachmentName(im.alt || '').toLowerCase()}`)
          );
          row.originalImgs.forEach((im) => {
            const alt = (im && im.alt) ? normalizeAttachmentName(im.alt) : '';
            const src = String(im?.originalSrc || im?.src || '').trim();
            if (src) return;
            if (!alt) return;
            const k = `att:${alt.toLowerCase()}`;
            if (existing.has(k)) return;
            existing.add(k);
            row.imgs.push({ src: '', originalSrc: '', alt, width: 0, height: 0 });
          });
        }
      } catch {}
      // Include attachment placeholders (filename-only) as pseudo-images
      const attEls = Array.from(contentEl.querySelectorAll('[data-acep-attachment-name]'));
      {
        const existingAtt = new Set(
          (row.imgs || [])
            .filter(im => im && !String(im.originalSrc || im.src || '').trim() && String(im.alt || '').trim())
            .map(im => normalizeAttachmentName(im.alt || '').toLowerCase())
        );
        for (const att of attEls) {
          const fname = normalizeAttachmentName(att.getAttribute('data-acep-attachment-name') || '');
          if (!fname) continue;
          const k = fname.toLowerCase();
          if (existingAtt.has(k)) continue;
          existingAtt.add(k);
          row.imgs.push({ src: '', originalSrc: '', alt: fname, width: 0, height: 0 });
        }
      }
      // De-duplicate filename-only attachment placeholders within the same row.
      // Note: the generic image de-dupe below ignores empty keys, so attachments can otherwise repeat.
      try {
        const seenAtt = new Set();
        row.imgs = (row.imgs || []).filter((im) => {
          const src = String(im?.originalSrc || im?.src || '').trim();
          const alt = normalizeAttachmentName(im?.alt || '');
          if (src || !alt) return true;
          const k = alt.toLowerCase();
          if (seenAtt.has(k)) return false;
          seenAtt.add(k);
          // Keep normalized attachment name so plain exports can dedupe reliably.
          im.alt = alt;
          return true;
        });
      } catch {}
      // De-duplicate images by originalSrc/src to avoid repeats
      const seenImgs = new Set();
      row.imgs = row.imgs.filter(img => {
        const key0 = img.originalSrc || img.src || '';
        // Normalize Grok image keys to reduce duplicates (strip query/hash)
        let key = key0.split('#')[0];
        const qm = key.indexOf('?');
        if (qm >= 0) key = key.slice(0, qm);
        if (!key) return true;
        if (seenImgs.has(key)) return false;
        seenImgs.add(key);
        return true;
      });
      // Claude: drop favicon/tool-result images
      if (/claude\.ai$/i.test(HOST)) {
        row.imgs = row.imgs.filter(img => {
          const s = String(img.originalSrc || img.src || '').toLowerCase();
          if (!s) return true;
          if (s.includes('s2/favicons') || s.includes('favicon')) return false;
          return true;
        });
      }
      // Expand ChatGPT citation pills (e.g., "domain.com +3") into full link lists when possible
      try { expandChatgptCitationPills(contentEl); } catch {}
      try { cleanChatgptCitationLinkText(contentEl); } catch {}
      // Strip filecite markers AFTER DOM processing ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¾Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¦ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â this is the definitive point where row.html
      // is assigned from the DOM, which may re-introduce markers that survived earlier strips.
      try {
        // Remove elements with "filecite" in class/id
        contentEl.querySelectorAll('[class*="filecite"], [id*="filecite"], [data-filecite]').forEach(el => { try { el.remove(); } catch {} });
        // Remove ChatGPT file-citation chips: <span aria-haspopup="dialog"> renders as "filename (N)"
        // buttons ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¾Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¦ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â no "filecite" text in their markup, only identifiable by aria/type attributes.
        contentEl.querySelectorAll('span[aria-haspopup]').forEach(el => { try { if (!el.querySelector('img')) el.remove(); } catch {} });
      } catch {}
      row.html = contentEl.innerHTML;
      if (row.html && /filecite/i.test(row.html)) {
        row.html = row.html.replace(/<([a-zA-Z]+)[^>]*filecite[^>]*>[^<]*<\/\1>/gi, '').replace(/\s*filecite[\w-]+/gi, '');
      }
      row.text = htmlToPlainText(row.html).replace(/\n{3,}/g, '\n\n').trimEnd();
      if (/claude\.ai$/i.test(HOST)) {
        // Remove Claude tool-result "Fetched:" lines from text exports (PDF/DOCX/MD/TXT)
        row.text = row.text
          .replace(/^\s*Fetched:\s.*$/gim, '')
          .replace(/\n{3,}/g, '\n\n')
          .trimEnd();
      }
      // Capture table bodies for DOCX fallback when HTML parsing fails.
      try {
        const tableEls = Array.from(contentEl.querySelectorAll('table'));
        if (tableEls.length) {
          const tableToBody = (t) => {
            const body = [];
            const pushRow = (cells = []) => {
              const rowArr = cells
                .map(cell => (cell.innerText || '').replace(/\u00a0/g, ' ').trim())
                .filter(cell => cell !== '');
              if (rowArr.length) body.push(rowArr);
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
            return { body, hasHeader, caption: '' };
          };
          const tables = tableEls.map(tableToBody).filter(t => t.body && t.body.length);
          if (tables.length) row.tables = tables;
        }
      } catch {}
    });
    // Post-process helpers
    const norm = (s='') => s.replace(/https?:\/\/\S+/g,' ') // strip URLs
                             .replace(/Powered by:\s*https?:\/\/\S+/ig,' ')
                             .replace(/\s+/g,' ') // collapse spaces
                             .trim()
                             .toLowerCase();
    // 1) De-quote user text echoed inside assistant reply (start or early in reply)
    for (let i = 1; i < rows.length; i++) {
      const prev = rows[i - 1];
      const cur = rows[i];
      if (!prev || !cur) continue;
      const ptxt = norm(prev.text);
      const ctxt = norm(cur.text);
      // If assistant reply begins by repeating user's full/leading text, strip the repeated lead from assistant text
      if (cur.role === 'assistant' && prev.role === 'user' && ptxt) {
        // Remove leading occurrence of prev.text from cur.text only (text path used by PDF Text)
        const lead = prev.text.trim();
        if (lead) {
          if (cur.text.startsWith(lead)) {
            cur.text = cur.text.slice(lead.length).trimStart();
          } else {
            // Also check early substring (e.g., quoted within first 800 chars)
            const idx = norm(cur.text).indexOf(ptxt.slice(0, Math.min(300, ptxt.length)));
            if (idx >= 0 && idx < 800) {
              // Remove the raw segment by approximate slice based on raw lengths
              const rawIdx = Math.max(0, cur.text.toLowerCase().indexOf(prev.text.trim().toLowerCase().slice(0, 40)));
              if (rawIdx >= 0) {
                const rawEnd = rawIdx + prev.text.trim().length;
                cur.text = (cur.text.slice(0, rawIdx) + cur.text.slice(rawEnd)).trim();
              }
            }
          }
        }
      }
    }
    // 2) Deduplicate consecutive rows with identical text (after normalization)
    for (let i = rows.length - 1; i > 0; i--) {
      if (norm(rows[i].text) && norm(rows[i].text) === norm(rows[i - 1].text)) {
        rows.splice(i, 1);
      }
    }
    // 3) Drop later duplicates anywhere (same normalized text appears multiple times)
    const seenTexts = new Set();
    for (let i = 0; i < rows.length; i++) {
      const key = norm(rows[i].text);
      if (key.length > 80) {
        if (seenTexts.has(key)) { rows.splice(i, 1); i--; continue; }
        seenTexts.add(key);
      }
    }
    // Final DOM cleanup: strip surviving filecite text and citation chips from the wrapper
    // before the HTML string is built. Operates on live text nodes (not serialized HTML),
    // so HTML entity encoding cannot prevent the match.
    try {
      wrapper.querySelectorAll('span[aria-haspopup]').forEach(el => { try { if (!el.querySelector('img')) el.remove(); } catch {} });
      wrapper.querySelectorAll('[class*="filecite"], [id*="filecite"], [data-filecite]').forEach(el => { try { el.remove(); } catch {} });
      const _fw = document.createTreeWalker(wrapper, NodeFilter.SHOW_TEXT, null);
      const _fn = [];
      let _fc;
      while ((_fc = _fw.nextNode())) {
        if (/filecite/i.test(_fc.nodeValue)) _fn.push(_fc);
      }
      _fn.forEach(_fc => { _fc.nodeValue = _fc.nodeValue.replace(/\s*filecite[^\s]*/gi, ''); });
    } catch {}
    // Branding
    let brandingHtml = "";
    if (branding) {
      brandingHtml = `<div class="branding" style="margin-top:24px;font-size:12px;color:#7E57C2;">
        <a href="https://chatexport.workpent.com/" target="_blank" style="color:#7E57C2;text-decoration:underline;">Powered by: AiChatExporterPro</a>
      </div>`;
    }
    const doc = `<!doctype html>
 <html>
 <head>
 <meta charset="utf-8">
 <title>${escapeHtml(title)}</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
   img{max-width:100%;height:auto;border-radius:8px;display:block;margin:10px 0;clear:both}
   /* Alignment baseline (popup.js also injects richer theme/bubble styling). */
   .acep-turn{display:flex;flex-direction:column;width:100%;gap:6px;margin:0 0 18px 0;align-items:flex-start}
   .acep-turn[data-acep-role="user"]{align-items:flex-end}
   .acep-turn[data-acep-role="assistant"]{align-items:flex-start}
   .acep-bubble{max-width:90%}
   .acep-turn[data-acep-role="user"]>.acep-bubble{max-width:78%}
   /* Bubble baseline (in case popup.js injected CSS isn't applied) */
   .acep-turn[data-acep-role="user"]>.acep-bubble{background:#f3f4f6;padding:12px 14px;border-radius:16px;border:1px solid #e5e7eb}
   .acep-turn[data-acep-role="assistant"]>.acep-bubble{background:transparent;padding:0;width:100%;max-width:100%;box-sizing:border-box}
   .acep-turn[data-acep-role="assistant"] table{display:table;width:100% !important;min-width:100%;border-collapse:collapse}
   .acep-theme-dark .acep-turn[data-acep-role="user"]>.acep-bubble{background:#0f1622;color:#f9fafb;border:1px solid #1f2937}
   .acep-theme-dark .acep-turn[data-acep-role="user"]>.acep-bubble *{background:transparent;color:#f9fafb}
   .acep-turn img{display:block;clear:both;position:static !important;float:none !important;object-position:50% 0% !important}
   .acep-turn figure,
   .acep-turn picture,
   .acep-turn [class*="image" i]:not(.acep-chatgpt-image-gallery):not(.acep-chatgpt-image-tile),
   .acep-turn [class*="media" i]{display:block !important;position:static !important;float:none !important;clear:both !important;height:auto !important;overflow:visible !important}
   /* Avoid hardcoded thumbnail sizing (breaks Claude uploads + can cause overlap/spacing issues). */
   .acep-turn .no-scrollbar.flex:not(.acep-chatgpt-image-gallery){display:flex !important;gap:8px !important;flex-wrap:wrap !important;overflow:visible !important;min-height:unset !important}
   .acep-turn .no-scrollbar.flex:not(.acep-chatgpt-image-gallery) > div{width:auto !important;max-width:100% !important}
   .acep-turn .no-scrollbar.flex:not(.acep-chatgpt-image-gallery) img{width:auto !important;height:auto !important;max-width:100% !important;object-fit:contain !important;border-radius:8px !important}
    .acep-turn .acep-chatgpt-image-gallery{display:grid !important;grid-template-columns:repeat(var(--acep-gallery-columns, 3), minmax(0, 1fr)) !important;gap:4px !important;margin:8px 0 14px 0 !important;overflow:hidden !important;width:640px !important;max-width:100% !important;min-height:0 !important;clear:both !important;align-items:stretch !important}
    .acep-turn .acep-chatgpt-image-gallery>.acep-chatgpt-image-tile{display:block !important;width:100% !important;max-width:100% !important;aspect-ratio:5/4 !important;overflow:hidden !important;border-radius:12px !important;margin:0 !important;padding:0 !important;height:auto !important;clear:none !important;position:relative !important;box-sizing:border-box !important}
   .acep-turn .acep-chatgpt-image-gallery img{display:block !important;width:100% !important;height:100% !important;max-width:none !important;object-fit:cover !important;border-radius:12px !important;margin:0 !important;padding:0 !important;clear:none !important}
   </style>
  </head>
 <body class="${(String(theme || 'light').toLowerCase() === 'dark') ? 'acep-theme-dark' : 'acep-theme-light'}">
 ${wrapper.innerHTML}
 ${brandingHtml}
 </body></html>`;
    try { window.__acepLastRows = rowsFiltered || []; } catch {}
    try {
      const summary = (rowsFiltered || []).slice(0, 10).map(r => ({
        role: r.role,
        textLen: (r.text || '').length,
        imgCount: (r.imgs || []).length,
        imgSrcs: (r.imgs || []).map(i => i.src || i.originalSrc || '').slice(0, 3)
      }));
      document.documentElement.dataset.acepLastRowsSummary = JSON.stringify({
        count: (rowsFiltered || []).length,
        sample: summary
      });
    } catch {}
    return { title, html: doc, rows: rowsFiltered };
  }
  // ========== Messages from background/manager/popup ==========
  function showToast(message, timeout = 3500) {
    try {
      const id = 'acep-toast';
      const old = document.getElementById(id);
      if (old) old.remove();
      const div = document.createElement('div');
      div.id = id;
      div.textContent = message || 'Coming soon ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¾Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¦ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â try ChatGPT, Claude, or Grok';
      Object.assign(div.style, {
        position: 'fixed', left: '50%', bottom: '24px', transform: 'translateX(-50%)',
        background: '#111827', color: '#fff', padding: '10px 14px', borderRadius: '10px',
        boxShadow: '0 6px 16px rgba(0,0,0,.2)', zIndex: 2147483647, fontSize: '14px',
        maxWidth: '90vw', textAlign: 'center'
      });
      document.documentElement.appendChild(div);
      setTimeout(() => { try { div.remove(); } catch {} }, timeout);
    } catch {}
  }

  browser.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    (async () => {
      if (msg?.type === 'ACEP_PROMPT_SCHEDULE') {
        try {
          const delay = Math.max(0, Number(msg?.delayMs ?? 30000));
          if (ACEP_SUPPORT_TIMER) { try { clearTimeout(ACEP_SUPPORT_TIMER); } catch {} ACEP_SUPPORT_TIMER = null; }
          ACEP_SUPPORT_TIMER = setTimeout(() => {
            try { ACEP_SUPPORT_TIMER = null; } catch {}
            try { const evt = new CustomEvent('acep-support-trigger'); window.dispatchEvent(evt); } catch {}
            try { /* open modal */
              const fakeMsg = { type: 'ACEP_OPEN_SUPPORT_MODAL' };
              browser.runtime.sendMessage(fakeMsg, ()=>{});
              // Also open directly
              const t = document.createElement('span'); // no-op to ensure DOM ready
            } catch {}
            try { /* direct open */
              const pre = document.getElementById('acep-support-overlay');
              if (pre) { pre.style.display = 'flex'; }
              else {
                // Reuse existing handler path
                const ev = new MessageEvent('message', { data: { type: 'ACEP_OPEN_SUPPORT_MODAL' } });
                window.dispatchEvent(ev);
              }
            } catch {}
          }, delay);
          sendResponse && sendResponse({ ok:true });
          return;
        } catch {}
      }
      if (msg?.type === 'ACEP_PROMPT_CANCEL') {
        try { if (ACEP_SUPPORT_TIMER) { clearTimeout(ACEP_SUPPORT_TIMER); ACEP_SUPPORT_TIMER = null; } } catch {}
        sendResponse && sendResponse({ ok:true });
        return;
      }
      if (msg?.type === 'ACEP_OPEN_SUPPORT_MODAL') {
        try {
          const dlg = await ensureModalFromTemplate();
          if (dlg) { dlg.setAttribute('aria-hidden','false'); dlg.style.display='flex'; }
          sendResponse && sendResponse({ ok:true });
          return;
        } catch {}
      }
      if (msg?.type === 'ACEP_OPEN_POPUP') {
        console.log('[ACEP content] received ACEP_OPEN_POPUP (SUPPORTED_HOST=', SUPPORTED_HOST, 'enabled=', STATE.enabled, ')');
        if (SUPPORTED_HOST && STATE.enabled) {
          openPopupOverlay();
        } else {
          const txt = (browser.i18n.getMessage('coming_soon_toast')
                      || 'This provider is coming soon. Please try ChatGPT, Claude, or Grok.');
          showToast(txt);
        }
        sendResponse({ ok: true }); return;
      }
      if (msg?.type === 'ACEP_AUTO_SCROLL') {
        try {
          const minMs = Number(msg?.minMs);
          const maxMs = Number(msg?.maxMs);
          await autoScrollForExport({
            minMs: Number.isFinite(minMs) ? minMs : undefined,
            maxMs: Number.isFinite(maxMs) ? maxMs : undefined,
          });
          sendResponse && sendResponse({ ok: true });
          return;
        } catch (e) {
          sendResponse && sendResponse({ ok: false, error: String(e?.message || e) });
          return;
        }
      }
      if (msg?.type === 'ACEP_SETTINGS_CHANGED') {
        if (typeof msg.enabled === 'boolean') STATE.enabled = msg.enabled;
        if (msg.lang) STATE.lang = msg.lang;
        try {
          if (typeof msg.enabled === 'boolean') {
            try { browser.storage?.local?.set?.({ enabled: msg.enabled }); } catch {}
            try { browser.storage?.sync?.set?.({ enabled: msg.enabled }); } catch {}
          }
          if (msg.lang) {
            try { browser.storage?.local?.set?.({ lang: msg.lang }); } catch {}
            try { browser.storage?.sync?.set?.({ lang: msg.lang }); } catch {}
          }
        } catch {}
        await loadMessagesFor(STATE.lang);
        if (STATE.enabled) { injectExportButton(); ensureExportButtonWatcher(); startExportButtonHeartbeat(); }
        else { stopExportButtonHeartbeat(); removeExportButton(); }
        sendResponse({ ok: true }); return;
      }
      if (msg?.type === 'ACEP_GET_TITLE') {
        sendResponse({ ok: true, title: getChatTitle() }); return;
      }
      if (msg?.type === 'ACEP_QUICK_ESTIMATE') {
        try {
          // Quick, lightweight estimate: sum user/assistant text + inline images found in main content
          let textLen = 0; let imgCount = 0;
          try {
            const nodes = [];
            nodes.push(...document.querySelectorAll('span.whitespace-pre-wrap'));
            nodes.push(...document.querySelectorAll('.ds-markdown'));
            nodes.push(...document.querySelectorAll('[data-message-author-role]'));
            const seen = new Set();
            nodes.forEach(n => {
              if (!n || !n.textContent) return;
              if (seen.has(n)) return; seen.add(n);
              textLen += (n.textContent || '').length;
              try { imgCount += n.querySelectorAll('img').length; } catch {}
            });
          } catch {}
          // Global fallback if selectors miss
          if (textLen === 0) {
            try { textLen = (document.body?.innerText || '').length; } catch {}
          }
          if (imgCount === 0) {
            try { imgCount = document.querySelectorAll('img').length; } catch {}
          }
          sendResponse({ ok: true, textLen, imgCount });
        } catch (e) {
          sendResponse({ ok: false, error: String(e?.message || e) });
        }
        return;
      }
    if (msg?.type === 'ACEP_PREPARE_EXPORT') {
      try {
        // Pass options from popup.js (removeIcons, branding, exportMode)
        const opts = {
          removeIcons: !!msg.removeIcons,
          branding: !!msg.branding,
          exportMode: msg.exportMode || "self",
          outputFormat: typeof msg.outputFormat === 'string' ? msg.outputFormat : '',
          wantImageData: !!msg.wantImageData,
          theme: typeof msg.theme === 'string' ? msg.theme : 'light',
          selectedTurnIds: Array.isArray(msg.selectedTurnIds) ? msg.selectedTurnIds : null,
          selectionFilter: typeof msg.selectionFilter === 'string' ? msg.selectionFilter : '',
        };
        const { title, html, rows } = await buildCleanHTML(opts);
          sendResponse({ ok: true, title, html, rows });
        } catch (e) {
          console.error('ACEP_PREPARE_EXPORT error', e);
          sendResponse({ ok: false, error: String(e?.message || e) });
        }
        return;
      }
      if (msg?.type === 'ACEP_POPUP_CLOSE') {
        const f = document.getElementById(IFRAME_ID);
        if (f) f.remove();
        sendResponse({ ok: true }); return;
      }
      if (msg?.type === 'ACEP_IFRAME_SET_VIS') {
        const f = document.getElementById(IFRAME_ID);
        if (f) f.style.display = msg.show ? 'block' : 'none';
        sendResponse({ ok: true }); return;
      }
      if (msg?.type === 'ACEP_SET_BUSY') {
        ACEP_RENDER_BUSY = !!msg.busy;
        STATE.busy = !!msg.busy;
        if (!msg.busy) {
          try { hideExportLoadingOverlay(); } catch {}
          try { hideMutedExportProgress(350); } catch {}
        }
        sendResponse({ ok: true }); return;
      }
      if (msg?.type === 'ACEP_MUTED_EXPORT_PROGRESS') {
        try { if (!msg.done && msg.message) globalThis.__acepSidebarSetProgress?.(msg.message); } catch {}
        if (msg.done) hideMutedExportProgress(700);
        else showMutedExportProgress(msg.message || '');
        sendResponse({ ok: true }); return;
      }
      if (msg?.type === 'ACEP_EXPORT_PROGRESS') {
        try { if (!msg.done && msg.message) globalThis.__acepSidebarSetProgress?.(msg.message); } catch {}
        sendResponse({ ok: true }); return;
      }
      if (msg?.type === 'ACEP_EXPORT_READY') {
        try { sendContentExportAnalyticsFallback(msg.format || ''); } catch {}
        try {
          hideExportLoadingOverlay();
          hideMutedExportProgress(700);
          const muteFlags = globalThis.__acepMuteFlags || {};
          if (muteFlags.muteDownload) {
            try {
              ensureModalFromTemplate().then((dlg) => {
                try { if (dlg) { dlg.setAttribute('aria-hidden','false'); dlg.style.display='flex'; } } catch {}
              });
            } catch {}
            try { document.getElementById(IFRAME_ID)?.remove(); } catch {}
          } else {
            showExportResultPanel(msg.fileName);
          }
        } catch {}
        sendResponse({ ok: true }); return;
      }
      if (msg?.type === 'ACEP_IFRAME_MUTE') {
        const f = document.getElementById(IFRAME_ID);
        if (f) {
          if (msg.mute) {
            f.style.opacity = '0';
            f.style.pointerEvents = 'none';
            f.style.display = 'block';
          } else {
            f.style.opacity = '1';
            f.style.pointerEvents = 'auto';
            f.style.display = 'block';
          }
        }
        sendResponse({ ok: true }); return;
      }
    })();
    return true;
  });
  let activeExportPortRequestId = null;
  browser.runtime.onConnect.addListener((port) => {
    if (port.name !== 'ACEP_EXPORT') return;
    const requests = new Map();
    async function handleRequest(reqId, options = {}) {
      try {
        const opts = {
          removeIcons: !!options.removeIcons,
          branding: !!options.branding,
          exportMode: options.exportMode || 'self',
          outputFormat: typeof options.outputFormat === 'string' ? options.outputFormat : '',
          wantImageData: !!options.wantImageData,
          theme: typeof options.theme === 'string' ? options.theme : 'light',
          selectedTurnIds: Array.isArray(options.selectedTurnIds) ? options.selectedTurnIds : null,
          selectionFilter: typeof options.selectionFilter === 'string' ? options.selectionFilter : '',
        };
        port.postMessage({ type: 'ACEP_EXPORT_PROGRESS', reqId, stage: 'meta', completed: 0, total: 0 });
        const { title, html, rows } = await buildCleanHTML(opts);
        const state = requests.get(reqId);
        if (!state || state.canceled) {
          port.postMessage({ type: 'ACEP_EXPORT_ABORTED', reqId });
          requests.delete(reqId);
          return;
        }
        const chunkSize = 200_000;
        const totalChunks = Math.ceil(html.length / chunkSize) || 1;
        port.postMessage({
          type: 'ACEP_EXPORT_META',
          reqId,
          title,
          htmlLength: html.length,
          rowCount: rows.length,
          chunkCount: totalChunks,
        });
        for (let i = 0, seq = 0; i < html.length; i += chunkSize, seq++) {
          const cur = requests.get(reqId);
          if (!cur || cur.canceled) {
            port.postMessage({ type: 'ACEP_EXPORT_ABORTED', reqId });
            requests.delete(reqId);
            return;
          }
          const chunk = html.slice(i, i + chunkSize);
          port.postMessage({
            type: 'ACEP_EXPORT_HTML',
            reqId,
            seq,
            chunk,
            final: seq + 1 >= totalChunks,
          });
          port.postMessage({
            type: 'ACEP_EXPORT_PROGRESS',
            reqId,
            stage: 'html',
            completed: seq + 1,
            total: totalChunks,
          });
        }
        for (let idx = 0; idx < rows.length; idx++) {
          const cur = requests.get(reqId);
          if (!cur || cur.canceled) {
            port.postMessage({ type: 'ACEP_EXPORT_ABORTED', reqId });
            requests.delete(reqId);
            return;
          }
          port.postMessage({
            type: 'ACEP_EXPORT_ROW',
            reqId,
            index: idx,
            row: rows[idx],
          });
          port.postMessage({
            type: 'ACEP_EXPORT_PROGRESS',
            reqId,
            stage: 'rows',
            completed: idx + 1,
            total: rows.length,
          });
        }
        port.postMessage({ type: 'ACEP_EXPORT_DONE', reqId });
        requests.delete(reqId);
      } catch (err) {
        port.postMessage({ type: 'ACEP_EXPORT_ERROR', reqId, error: String(err?.message || err) });
        requests.delete(reqId);
      }
    }
    port.onMessage.addListener((msg) => {
      if (!msg || typeof msg !== 'object') return;
      if (msg.type === 'ACEP_PREPARE_EXPORT' && msg.reqId) {
        if (activeExportPortRequestId && activeExportPortRequestId !== msg.reqId) {
          try { port.postMessage({ type: 'ACEP_EXPORT_ERROR', reqId: msg.reqId, error: 'Export already in progress' }); } catch {}
          return;
        }
        activeExportPortRequestId = msg.reqId;
        requests.set(msg.reqId, { canceled: false });
        handleRequest(msg.reqId, msg.options || {}).finally(() => { if (activeExportPortRequestId === msg.reqId) activeExportPortRequestId = null; });
      } else if (msg.type === 'ACEP_EXPORT_CANCEL' && msg.reqId) {
        const state = requests.get(msg.reqId);
        if (state) state.canceled = true;
      }
    });
    port.onDisconnect.addListener(() => {
      requests.clear();
    });
  });
  browser.storage.onChanged.addListener(async (changes, area) => {
    if (area !== 'sync') return;
    if (changes.enabled) {
      STATE.enabled = !!changes.enabled.newValue;
      if (STATE.enabled) onDomReady(() => { injectExportButton(); ensureExportButtonWatcher(); startExportButtonHeartbeat(); }); else { stopExportButtonHeartbeat(); removeExportButton(); }
    }
    if (changes.lang) {
      STATE.lang = changes.lang.newValue || 'en';
      await loadMessagesFor(STATE.lang);
      const host = document.getElementById(`${BTN_ID}-host`);
      const btn = host?.shadowRoot?.getElementById(BTN_ID);
      if (btn) btn.textContent = currentLabelExport();
    }
  });
  (async function boot() {
    await readSettings();
    await loadMessagesFor(STATE.lang);
    if (STATE.enabled) onDomReady(() => {
      setTimeout(() => { injectExportButton(); ensureExportButtonWatcher(); startExportButtonHeartbeat(); setTimeout(() => { try { maybeShowOnboarding(); } catch {} }, 1200); }, 0);
    });
  })();
})();
if (typeof globalThis.browser === "undefined" && typeof globalThis.chrome !== "undefined") {
  globalThis.browser = globalThis.chrome;
}
