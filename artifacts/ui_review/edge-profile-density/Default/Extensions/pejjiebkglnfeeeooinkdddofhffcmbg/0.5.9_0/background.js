// background.js (MV2 background page)
if (typeof globalThis.browser === "undefined" && typeof globalThis.chrome !== "undefined") {
  globalThis.browser = globalThis.chrome;
}

// Promise-ify callback APIs when needed (MV2 compatibility)
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

// When the user changes settings in action.html, we:
//  - persist them (action.js does that via storage.sync)
//  - broadcast to all ChatGPT tabs so content.js can react (show/hide button, update lang)

async function getChatTabs() {
  const queries = [
    "https://chat.openai.com/*",
    "https://chatgpt.com/*",
    "https://claude.ai/*",
    "https://gemini.google.com/*",
    "https://copilot.microsoft.com/*",
    "https://chat.deepseek.com/*",
    "https://meta.ai/*",
    "https://grok.com/*"
  ];
  const results = await Promise.all(queries.map((url) => browser.tabs.query({ url })));
  return results.flat();
}

// Send a message to all ChatGPT tabs (fire-and-forget)
async function broadcastToChatGPT(msg) {
  const tabs = await getChatTabs();
  for (const t of tabs) {
    try { browser.tabs.sendMessage(t.id, msg); } catch {}
  }
}

// Set uninstall feedback URL so users see the survey on removal
try {
  const uninstallUrl = 'https://chatexport.workpent.com/feedback/uninstall';
  if (typeof browser !== 'undefined' && browser.runtime?.setUninstallURL) {
    browser.runtime.setUninstallURL(uninstallUrl);
  } else if (browser.runtime?.setUninstallURL) {
    browser.runtime.setUninstallURL(uninstallUrl);
  }
} catch {}

// If storage changes (lang / enabled), notify all ChatGPT tabs.
// content.js will decide whether to reload or just update UI.
browser.storage.onChanged.addListener((changes, area) => {
  if (area !== "sync") return;
  const payload = {};
  if (changes.lang)    payload.lang = changes.lang.newValue;
  if (changes.enabled !== undefined) payload.enabled = changes.enabled.newValue;
  if (Object.keys(payload).length) {
    broadcastToChatGPT({ type: "ACEP_SETTINGS_CHANGED", ...payload });
  }
});

const ACEP_API_BASE = 'https://acep-api.workpent.com';
const ACEP_PROXY_PATH = '/v1/proxy/image';
const ACEP_PROXY_TTL_MS = 5 * 60 * 1000;
const ACEP_ANALYTICS_EXPORT_URL = 'https://chatexport.workpent.com/api/extension/analytics/export';
const ACEP_ANALYTICS_BACKOFF_KEY = 'acep_bg_analytics_backoff_until_v1';
const ACEP_ANALYTICS_BACKOFF_MS = 6 * 60 * 60 * 1000;
const ACEP_INSTALL_REGISTRATION_TTL_MS = 60 * 60 * 1000;
const acepProxyCache = new Map();
const acepProxyInflight = new Map();
let acepProxyTimeOffsetMs = 0;
let acepRegistrationPromise = null;

function arrayBufferToBase64(buffer) {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    const slice = bytes.subarray(i, i + chunk);
    binary += String.fromCharCode(...slice);
  }
  return btoa(binary);
}

async function directFetchImageDataUrl(urlStr, referrer = '', credentials = 'omit') {
  const opts = { cache: 'no-store', credentials, redirect: 'follow' };
  if (referrer && /^https?:\/\//i.test(referrer)) {
    opts.referrer = referrer;
    opts.referrerPolicy = 'origin';
  }
  opts.headers = { 'Accept': 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8' };
  const resp = await fetch(urlStr, opts);
  if (!resp.ok) return null;
  const ab = await resp.arrayBuffer();
  const normalizeContentType = (ctRaw, buf) => {
    const clean = String(ctRaw || '').split(';')[0].trim().toLowerCase();
    const looksOctet = !clean || /octet-stream/.test(clean) || /^binary\//i.test(clean) || clean === 'application/octet-stream';
    if (!looksOctet && /^image\//i.test(clean)) return clean;

    // 1) Infer from magic bytes
    try {
      const b = new Uint8Array(buf.slice(0, 16));
      const isPng = b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4E && b[3] === 0x47 && b[4] === 0x0D && b[5] === 0x0A && b[6] === 0x1A && b[7] === 0x0A;
      if (isPng) return 'image/png';
      const isJpg = b.length >= 3 && b[0] === 0xFF && b[1] === 0xD8 && b[2] === 0xFF;
      if (isJpg) return 'image/jpeg';
      const isGif = b.length >= 4 && b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x38;
      if (isGif) return 'image/gif';
      const isWebp = b.length >= 12 && b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50;
      if (isWebp) return 'image/webp';
      // SVG: check initial text for <svg
      try {
        const head = new TextDecoder('utf-8', { fatal: false }).decode(buf.slice(0, 256));
        if (/<svg[\s>]/i.test(head)) return 'image/svg+xml';
      } catch {}
    } catch {}

    // 2) Infer from filename in URL query
    try {
      const u = new URL(urlStr);
      const qp = u.searchParams;
      let filename = qp.get('filename') || qp.get('fileName') || '';
      if (!filename) {
        const disp = qp.get('response-content-disposition') || '';
        const m = /filename\s*=\s*"?([^";]+)"?/i.exec(disp);
        if (m) filename = decodeURIComponent(m[1]);
      }
      const ext = (String(filename).toLowerCase().split('.').pop() || '').trim();
      if (ext === 'png') return 'image/png';
      if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg';
      if (ext === 'gif') return 'image/gif';
      if (ext === 'webp') return 'image/webp';
      if (ext === 'svg') return 'image/svg+xml';
      if (ext === 'avif') return 'image/avif';
    } catch {}

    // Default: prefer png (works well for exports)
    return 'image/png';
  };
  const contentType = normalizeContentType(resp.headers.get('content-type'), ab) || 'image/png';
  const b64 = arrayBufferToBase64(ab);
  return { dataUrl: `data:${contentType};base64,${b64}`, contentType };
}

function xhrFetchArrayBuffer(urlStr, { withCredentials = false, accept = '' } = {}) {
  return new Promise((resolve) => {
    try {
      const xhr = new XMLHttpRequest();
      xhr.open('GET', urlStr, true);
      xhr.responseType = 'arraybuffer';
      try { xhr.withCredentials = !!withCredentials; } catch {}
      try { if (accept) xhr.setRequestHeader('Accept', accept); } catch {}
      xhr.onload = () => {
        try {
          const status = xhr.status || 0;
          const ct = xhr.getResponseHeader('content-type') || '';
          const ab = xhr.response || null;
          resolve({ ok: status >= 200 && status < 300 && !!ab, status, contentType: ct, arrayBuffer: ab });
        } catch {
          resolve({ ok: false, status: 0, contentType: '', arrayBuffer: null });
        }
      };
      xhr.onerror = () => resolve({ ok: false, status: xhr.status || 0, contentType: '', arrayBuffer: null });
      xhr.send();
    } catch {
      resolve({ ok: false, status: 0, contentType: '', arrayBuffer: null });
    }
  });
}

function generateUuid() {
  try {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  } catch {}
  const rand = () => Math.floor((1 + Math.random()) * 0x10000).toString(16).slice(1);
  return `${rand()}${rand()}-${rand()}-${rand()}-${rand()}-${rand()}${rand()}${rand()}`;
}

function generateSecretBase64(bytes = 32) {
  try {
    const arr = new Uint8Array(bytes);
    crypto.getRandomValues(arr);
    let bin = '';
    arr.forEach(b => { bin += String.fromCharCode(b); });
    return btoa(bin);
  } catch {
    return '';
  }
}

async function storageGet(obj) {
  const store = browser.storage?.local || browser.storage?.sync;
  if (!store) return obj || {};
  try { return await store.get(obj); } catch { return obj || {}; }
}

async function storageSet(obj) {
  const store = browser.storage?.local || browser.storage?.sync;
  if (!store) return;
  try { await store.set(obj); } catch {}
}

async function sendExtensionExportAnalytics(payload = {}) {
  const startedAt = Date.now();
  const debugBase = {
    at: new Date().toISOString(),
    format: payload?.format || '',
    provider: payload?.provider || '',
    status: payload?.status || '',
  };
  try { await storageSet({ acep_last_analytics_attempt: { ...debugBase, stage: 'received' } }); } catch {}
  try {
    if (!payload.install_id) {
      const { installId } = await ensureInstallIdentity();
      if (installId) payload.install_id = installId;
    }
    if (!payload.timestamp) payload.timestamp = new Date().toISOString();
    if (!payload.extension_version) payload.extension_version = (browser.runtime.getManifest?.()?.version || '0');
    const resp = await fetch(ACEP_ANALYTICS_EXPORT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload || {}),
      mode: 'cors',
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
    });
    const result = { ok: resp.ok, status: resp.status };
    if (!resp.ok) await storageSet({ [ACEP_ANALYTICS_BACKOFF_KEY]: Date.now() + ACEP_ANALYTICS_BACKOFF_MS });
    try { await storageSet({ acep_last_analytics_result: { ...debugBase, ...result, elapsed_ms: Date.now() - startedAt } }); } catch {}
    return result;
  } catch (e) {
    const result = { ok: false, error: String(e?.message || e) };
    try { await storageSet({ acep_last_analytics_result: { ...debugBase, ...result, elapsed_ms: Date.now() - startedAt } }); } catch {}
    return result;
  }
}
async function ensureInstallIdentity() {
  const defaults = { acepInstallId: '', acepInstallSecret: '' };
  const existing = await storageGet(defaults);
  let installId = existing.acepInstallId || '';
  let secret = existing.acepInstallSecret || '';
  let changed = false;
  if (!installId) { installId = generateUuid(); changed = true; }
  if (!secret) { secret = generateSecretBase64(32); changed = true; }
  if (changed) await storageSet({ acepInstallId: installId, acepInstallSecret: secret });
  return { installId, secret };
}

async function registerInstall(installId, secret, { force = false } = {}) {
  const registrationKey = `acepInstallRegistered:${installId}`;
  if (!force) {
    const cached = await storageGet({ [registrationKey]: 0 });
    const registeredAt = Number(cached?.[registrationKey] || 0);
    if (registeredAt && (Date.now() - registeredAt) < ACEP_INSTALL_REGISTRATION_TTL_MS) {
      return true;
    }
    if (acepRegistrationPromise) return acepRegistrationPromise;
  }

  const request = (async () => {
  try {
    const resp = await fetch(`${ACEP_API_BASE}/v1/install/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ installId, secret })
    });
    try {
      const serverDate = resp.headers.get('Date');
      if (serverDate) acepProxyTimeOffsetMs = Date.parse(serverDate) - Date.now();
    } catch {}
      if (!resp.ok) return false;
      await storageSet({ [registrationKey]: Date.now() });
      return true;
  } catch {
    return false;
  }
  })();

  if (force) return request;
  acepRegistrationPromise = request;
  try {
    return await request;
  } finally {
    acepRegistrationPromise = null;
  }
}

function base64ToBytes(b64) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

async function signProxyPayload(secretBase64, payload) {
  const keyData = base64ToBytes(secretBase64);
  const key = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
  const sigBytes = new Uint8Array(sig);
  let bin = '';
  sigBytes.forEach(b => { bin += String.fromCharCode(b); });
  return btoa(bin);
}

async function sha256Hex(value = '') {
  const bytes = typeof value === 'string'
    ? new TextEncoder().encode(value)
    : new Uint8Array(value || new ArrayBuffer(0));
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
  return Array.from(digest, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function createSignedApiHeaders(method, path, bodyHash = '') {
  const { installId, secret } = await ensureInstallIdentity();
  if (!installId || !secret) throw new Error('Installation identity unavailable');
  const registered = await registerInstall(installId, secret, { force: true });
  if (!registered) throw new Error('Could not register this extension installation');
  const timestamp = String(Date.now() + acepProxyTimeOffsetMs);
  const nonce = generateUuid();
  const hash = /^[a-f0-9]{64}$/i.test(String(bodyHash || ''))
    ? String(bodyHash).toLowerCase()
    : await sha256Hex('');
  const canonical = [
    String(method || 'GET').toUpperCase(),
    String(path || '/'),
    timestamp,
    nonce,
    hash,
  ].join('\n');
  const signature = await signProxyPayload(secret, canonical);
  return {
    'X-ACEP-Install-Id': installId,
    'X-ACEP-Timestamp': timestamp,
    'X-ACEP-Nonce': nonce,
    'X-ACEP-Signature': signature,
  };
}

// Helper any page can call to "open overlay" on the active ChatGPT tab
browser.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  (async () => {
    if (msg && msg.type === 'ACEP_ANALYTICS_EXPORT') {
      try {
        const result = await sendExtensionExportAnalytics(msg.payload || {});
        sendResponse(result || { ok: true });
      } catch (e) {
        sendResponse({ ok: false, error: String(e?.message || e) });
      }
      return;
    }
    // Disable legacy upload/config paths now that the extension uses API-only flow
    if (msg && (msg.type === 'ACEP_GET_UPLOAD_CFG' || msg.type === 'ACEP_UPLOAD_SHARE')) {
      try { sendResponse({ ok: false, error: 'deprecated' }); } catch {}
      return;
    }
    if (msg && msg.type === "ACEP_OPEN_OVERLAY") {
      const tabs = await getChatTabs();
      let tab = tabs.find(t => t.active && t.highlighted) || tabs[0];
      if (!tab) {
        // open a new ChatGPT tab then try again shortly
        tab = await browser.tabs.create({ url: "https://chatgpt.com/" });
        setTimeout(() => browser.tabs.sendMessage(tab.id, { type: "ACEP_OPEN_POPUP" }), 1200);
      } else {
        browser.tabs.sendMessage(tab.id, { type: "ACEP_OPEN_POPUP" });
      }
      sendResponse({ ok: true });
      return;
    }

    if (msg && msg.type === 'ACEP_INJECT_CGPT_TOKEN_CAPTURE') {
      const tabId = sender?.tab?.id;
      if (!tabId) { sendResponse({ ok: false, error: 'no tab' }); return; }
      function acepInstallCGPTTokenCapture() {
        if (window.__acepCGPTCaptureDone) return;
        window.__acepCGPTCaptureDone = true;
        const orig = window.fetch;
        window.fetch = function() {
          try {
            const url = typeof arguments[0] === 'string' ? arguments[0] : (arguments[0]?.url || '');
            if (url.includes('/backend-api/')) {
              let auth = null;
              const opts = arguments[1];
              if (opts?.headers) {
                const h = opts.headers;
                auth = h instanceof Headers ? h.get('Authorization') : (h.Authorization || h.authorization || null);
              }
              if (!auth && arguments[0] instanceof Request) auth = arguments[0].headers.get('Authorization');
              if (auth && auth.startsWith('Bearer ')) {
                window.postMessage({ type: '__acep_cgpt_tok', t: auth.slice(7) }, '*');
              }
            }
          } catch {}
          return orig.apply(this, arguments);
        };
      }
      try {
        const api = (typeof globalThis.chrome !== 'undefined') ? globalThis.chrome : globalThis.browser;
        if (api?.scripting?.executeScript) {
          await api.scripting.executeScript({ target: { tabId }, world: 'MAIN', func: acepInstallCGPTTokenCapture });
          sendResponse({ ok: true });
        } else {
          sendResponse({ ok: false, error: 'no scripting api' });
        }
      } catch (e) {
        sendResponse({ ok: false, error: String(e?.message || e) });
      }
      return;
    }

    if (msg && msg.type === 'ACEP_GET_ACTIVE_TAB') {
      try {
        const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
        if (tab) {
          sendResponse({ ok: true, tab: { id: tab.id, title: tab.title || '', url: tab.url || '' } });
        } else {
          sendResponse({ ok: false, error: 'No active tab' });
        }
      } catch (e) {
        sendResponse({ ok: false, error: String(e?.message || e) });
      }
      return;
    }

    if (msg && msg.type === 'ACEP_PREPARE_EXPORT_BRIDGE') {
      try {
        const tabId = Number(msg.tabId);
        if (!tabId) throw new Error('Missing tabId');
        const options = msg.options && typeof msg.options === 'object' ? msg.options : {};
        const resp = await new Promise((resolve) => {
          browser.tabs.sendMessage(tabId, { type: 'ACEP_PREPARE_EXPORT', ...options }, (reply) => resolve(reply));
        });
        if (!resp) throw new Error('No response from content script');
        sendResponse(resp);
      } catch (e) {
        sendResponse({ ok: false, error: String(e?.message || e) });
      }
      return;
    }

    if (msg && msg.type === 'ACEP_FORWARD_TO_TAB') {
      try {
        const tabId = Number(msg.tabId);
        if (!tabId) throw new Error('Missing tabId');
        const payload = msg.payload && typeof msg.payload === 'object' ? msg.payload : {};
        const reply = await new Promise((resolve, reject) => {
          browser.tabs.sendMessage(tabId, payload, (resp) => {
            const err = browser.runtime.lastError;
            if (err) { reject(new Error(err.message || 'Forward failed')); return; }
            resolve(resp);
          });
        });
        sendResponse(reply);
      } catch (e) {
        sendResponse({ ok: false, error: String(e?.message || e) });
      }
      return;
    }

    if (msg && msg.type === 'ACEP_OPEN_SETTINGS') {
      try {
        const tour = msg && msg.settingsTour ? '?settingsTour=1' : '';
        const url = browser.runtime.getURL('popup.html' + tour);
        await browser.tabs.create({ url });
        sendResponse({ ok: true });
      } catch (e) {
        sendResponse({ ok: false, error: String(e?.message || e) });
      }
      return;
    }

    if (msg && msg.type === 'ACEP_GET_SENDER_TAB') {
      try {
        const tab = sender?.tab;
        if (!tab?.id) throw new Error('No sender tab');
        sendResponse({
          ok: true,
          tab: { id: tab.id, title: tab.title || '', url: tab.url || '' }
        });
      } catch (e) {
        sendResponse({ ok: false, error: String(e?.message || e) });
      }
      return;
    }

    if (msg && msg.type === 'ACEP_OPEN_URL') {
      try {
        const raw = (msg && msg.url) ? String(msg.url) : '';
        const url = raw.trim();
        if (!/^https?:\/\//i.test(url)) throw new Error('Invalid URL');
        await browser.tabs.create({ url });
        sendResponse({ ok: true });
      } catch (e) {
        sendResponse({ ok: false, error: String(e?.message || e) });
      }
      return;
    }

    if (msg && msg.type === 'ACEP_SIGN_API_REQUEST') {
      try {
        const method = String(msg.method || 'GET').toUpperCase();
        const path = String(msg.path || '/');
        const bodyHash = String(msg.bodyHash || '');
        if (!path.startsWith('/v1/')) throw new Error('Invalid API path');
        const headers = await createSignedApiHeaders(method, path, bodyHash);
        sendResponse({ ok: true, headers });
      } catch (e) {
        sendResponse({ ok: false, error: String(e?.message || e) });
      }
      return;
    }

    if (msg && msg.type === 'ACEP_DOWNLOAD_URL') {
      try {
        const url = String(msg.url || '').trim();
        if (!/^https:\/\/acep-api\.workpent\.com\/v1\/pdf\/jobs\/[^/]+\/download(?:[/?#].*)?$/i.test(url)) {
          throw new Error('Invalid PDF download URL');
        }
        const filename = String(msg.filename || 'AI Conversation.pdf')
          .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_')
          .replace(/[.\s]+$/g, '')
          .slice(0, 180) || 'AI Conversation.pdf';
        const downloadId = await new Promise((resolve, reject) => {
          const options = { url, filename, saveAs: false, conflictAction: 'uniquify' };
          try {
            const maybePromise = browser.downloads.download(options, (id) => {
              const err = browser.runtime.lastError;
              if (err) reject(new Error(err.message || 'Download failed'));
              else resolve(id);
            });
            if (maybePromise && typeof maybePromise.then === 'function') {
              maybePromise.then(resolve, reject);
            }
          } catch (error) {
            reject(error);
          }
        });
        sendResponse({ ok: true, downloadId });
      } catch (e) {
        sendResponse({ ok: false, error: String(e?.message || e) });
      }
      return;
    }

    // Inject a lightweight MAIN-world hook on Claude to capture generated-file `file_path`
    // from the Preview panel requests (manage/storage/info, tools). This avoids hardcoding.
    if (msg && msg.type === 'ACEP_INSTALL_CLAUDE_GENFILE_HOOK') {
      try {
        const tabId = Number(msg.tabId || sender?.tab?.id);
        if (!tabId) throw new Error('Missing tabId');

          function acepInstallClaudeGenFileHook() {
            try {
              const VERSION = 3;
              window.__acepClaudeGenFileHook = window.__acepClaudeGenFileHook || { count: 0, last: null, version: 0 };
              const hook = window.__acepClaudeGenFileHook;
              if (hook.version === VERSION) {
                try {
                  document.documentElement.setAttribute('data-acep-claude-genfile-hook', JSON.stringify({ ok: true, already: true, version: VERSION }));
                } catch {}
                return { ok: true, already: true, version: VERSION };
              }
              // If an older hook was installed, restore originals before re-wrapping.
              try {
                if (hook.origFetch && window.fetch && window.fetch.__acepWrapped) {
                  window.fetch = hook.origFetch;
                }
              } catch {}
              try {
                if (hook.origXHROpen && XMLHttpRequest.prototype.open && XMLHttpRequest.prototype.open.__acepWrapped) {
                  XMLHttpRequest.prototype.open = hook.origXHROpen;
                }
              } catch {}
              hook.version = VERSION;
              try {
                document.documentElement.setAttribute('data-acep-claude-genfile-hook', JSON.stringify({ ok: true, version: VERSION }));
              } catch {}

            // Claude has used multiple generated-file URL shapes over time:
            // - /artifacts/<kind>/<id>/(manage/storage/info|tools)?...&file_path=/outputs/...
            // - /conversations/<chatId>/wiggle/download-file?path=/mnt/user-data/outputs/...
            // Capture both the preview/artifact lookups and the direct download-file requests.
            const artifactRe = /\/api\/organizations\/([^/]+)\/artifacts\/([^/]+)\/([^/]+)\/(manage\/storage\/info|tools)\?[^#]*file_path=([^&]+)/i;
            const directDownloadRe = /\/api\/organizations\/([^/]+)\/conversations\/([^/]+)\/wiggle\/download-file\?[^#]*path=([^&]+)/i;

            const safeJson = (obj) => {
              try { return JSON.stringify(obj); } catch { return ''; }
            };

            const record = (url) => {
              try {
                const u = new URL(String(url), location.origin);
                const rawUrl = String(url || '');
                const artifactMatch = rawUrl.match(artifactRe);
                const directMatch = rawUrl.match(directDownloadRe);
                if (!artifactMatch && !directMatch) return;
                let hit = null;
                if (artifactMatch) {
                  const filePath = decodeURIComponent(u.searchParams.get('file_path') || '');
                  const chatId = u.searchParams.get('chat_conversation_uuid') || '';
                  hit = {
                    source: 'artifact',
                    url: u.pathname + u.search,
                    orgId: artifactMatch[1] || '',
                    artifactKind: artifactMatch[2] || '',
                    artifactId: artifactMatch[3] || '',
                    kind: artifactMatch[4] || '',
                    filePath,
                    chatId,
                    ts: Date.now(),
                  };
                } else if (directMatch) {
                  const path = decodeURIComponent(u.searchParams.get('path') || '');
                  const filePath = path.replace(/^\/mnt\/user-data/i, '');
                  hit = {
                    source: 'direct-download',
                    url: u.pathname + u.search,
                    orgId: directMatch[1] || '',
                    artifactKind: '',
                    artifactId: '',
                    kind: 'download-file',
                    path,
                    filePath,
                    chatId: directMatch[2] || '',
                    ts: Date.now(),
                  };
                }
                if (!hit) return;
                window.__acepClaudeGenFileHook.count = (window.__acepClaudeGenFileHook.count || 0) + 1;
                window.__acepClaudeGenFileHook.last = hit;

                try { document.documentElement.setAttribute('data-acep-claude-generated-file-count', String(window.__acepClaudeGenFileHook.count || 0)); } catch {}
                try {
                  const s = safeJson(hit);
                  if (s && s.length <= 1200) document.documentElement.setAttribute('data-acep-claude-generated-file-last', s);
                } catch {}
              } catch {}
            };


            const sanitizeArtifactInfo = (value) => {
              try {
                if (!value || typeof value !== 'object') return null;
                const out = {};
                [
                  'id', 'uuid', 'artifact_uuid', 'version_uuid', 'title', 'name',
                  'type', 'mime_type', 'mimeType', 'file_name', 'filename',
                  'file_path', 'filePath', 'path', 'download_url', 'downloadUrl'
                ].forEach((key) => {
                  try {
                    const v = value[key];
                    if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') out[key] = String(v);
                  } catch {}
                });
                return Object.keys(out).length ? out : null;
              } catch {
                return null;
              }
            };

            const findArtifactInfoInValue = (root) => {
              const seen = new Set();
              const stack = [{ value: root, depth: 0 }];
              while (stack.length) {
                const item = stack.pop();
                const value = item?.value;
                const depth = item?.depth || 0;
                if (!value || typeof value !== 'object' || seen.has(value) || depth > 6) continue;
                seen.add(value);
                const sanitized = sanitizeArtifactInfo(value);
                if (sanitized && (sanitized.id || sanitized.uuid || sanitized.artifact_uuid) && (sanitized.version_uuid || sanitized.type || sanitized.title || sanitized.name || sanitized.file_path || sanitized.filePath || sanitized.path || sanitized.download_url || sanitized.downloadUrl)) {
                  return sanitized;
                }
                try {
                  if (Array.isArray(value)) {
                    for (let i = value.length - 1; i >= 0; i--) stack.push({ value: value[i], depth: depth + 1 });
                  } else {
                    const keys = Object.keys(value);
                    for (let i = keys.length - 1; i >= 0; i--) stack.push({ value: value[keys[i]], depth: depth + 1 });
                  }
                } catch {}
              }
              return null;
            };

            const getArtifactInfoByIndex = (idx) => {
              try {
                const index = Number(idx);
                if (!Number.isFinite(index) || index < 0) return null;
                const cell = document.querySelectorAll('div.artifact-block-cell')[index];
                if (!cell) return null;
                const key = Object.keys(cell).find((name) => name.startsWith('__reactFiber') || name.startsWith('__reactProps'));
                const carrier = key ? cell[key] : null;
                if (!carrier) return null;
                try {
                  const props = carrier.memoizedProps || carrier.pendingProps || carrier;
                  const direct = props?.children?.flatMap
                    ? props.children.flatMap((child) => child?.props?.properties || []).find((item) => item && item.id)
                    : null;
                  const directInfo = sanitizeArtifactInfo(direct);
                  if (directInfo) return directInfo;
                } catch {}
                return findArtifactInfoInValue(carrier);
              } catch {
                return null;
              }
            };

            if (!hook.artifactInfoListenerInstalled) {
              hook.artifactInfoListenerInstalled = true;
              window.addEventListener('message', (event) => {
                try {
                  if (event.source !== window || event.origin !== location.origin) return;
                  const data = event.data || {};
                  if (!data || data.type !== 'ACEP_REQ_CLAUDE_ARTIFACT_INFO') return;
                  const info = getArtifactInfoByIndex(data.idx);
                  window.postMessage({
                    type: 'ACEP_RSP_CLAUDE_ARTIFACT_INFO',
                    requestId: data.requestId || '',
                    idx: data.idx,
                    atftInfo: info
                  }, location.origin);
                } catch {}
              });
            }
              try {
                const origFetch = window.fetch?.bind(window);
                if (origFetch) {
                  hook.origFetch = origFetch;
                  const wrapped = async (...args) => {
                    const url = (typeof args[0] === 'string') ? args[0] : (args[0]?.url || '');
                    record(url);
                    return origFetch(...args);
                  };
                  try { wrapped.__acepWrapped = true; } catch {}
                  window.fetch = wrapped;
                }
              } catch {}

              try {
                const origOpen = XMLHttpRequest.prototype.open;
                hook.origXHROpen = origOpen;
                const wrappedOpen = function (method, url, ...rest) {
                  record(url);
                  return origOpen.call(this, method, url, ...rest);
                };
                try { wrappedOpen.__acepWrapped = true; } catch {}
                XMLHttpRequest.prototype.open = wrappedOpen;
              } catch {}

              return { ok: true, installed: true, version: VERSION };
            } catch (e) {
              try {
                document.documentElement.setAttribute('data-acep-claude-genfile-hook', JSON.stringify({ ok: false, error: String(e?.message || e) }));
              } catch {}
              return { ok: false, error: String(e?.message || e) };
            }
          }

        // MV3: prefer chrome.scripting (MAIN world). MV2: fallback to tabs.executeScript.
        const api = (typeof globalThis !== 'undefined' && globalThis.chrome) ? globalThis.chrome : (globalThis.browser || {});
        if (api?.scripting?.executeScript) {
          const res = await api.scripting.executeScript({ target: { tabId, allFrames: true }, world: 'MAIN', func: acepInstallClaudeGenFileHook });
          const first = Array.isArray(res) && res.length ? res[0] : null;
          sendResponse({ ok: true, result: first?.result ?? null });
        } else if (browser?.tabs?.executeScript) {
          const code = `(${acepInstallClaudeGenFileHook.toString()})()`;
          const res = await browser.tabs.executeScript(tabId, { code, runAt: 'document_idle', allFrames: true });
          sendResponse({ ok: true, result: Array.isArray(res) ? res[0] : (res ?? null) });
        } else {
          throw new Error('No supported script injection API (need MV3 scripting permission)');
        }
      } catch (e) {
        sendResponse({ ok: false, error: String(e?.message || e) });
      }
      return;
    }

    // Expose whether upload config is present (uses defaults below)
    if (msg && msg.type === "ACEP_GET_UPLOAD_CFG") {
      try {
        const cfgDefaults = {
          uploadUrl: "https://workpent.com/upload",
          uploadKey: "",
          uploadHeader: "authorization",
          uploadMethod: "POST",
          uploadFieldName: "file",
          linkFieldPath: "url",
        };
        const cfg = await browser.storage.sync.get(cfgDefaults);
        sendResponse({ ok: true, hasUrl: !!(cfg.uploadUrl && cfg.uploadUrl.trim()) });
      } catch (e) {
        sendResponse({ ok: false, error: String(e?.message || e) });
      }
      return;
    }

  if (msg && msg.type === "ACEP_UPLOAD_SHARE") {
      try {
        const { name, type, size } = msg.file || {};
        let ab = msg.file?.arrayBuffer; // optional ArrayBuffer
        if (!ab && msg.file?.blobData) {
          ab = msg.file.blobData; // already an ArrayBuffer
        }
        if (!ab) throw new Error("No file data provided");

        // Rehydrate Blob from ArrayBuffer
        const blob = new Blob([ab], { type: type || "application/octet-stream" });

        // Load config
        const cfgDefaults = {
          uploadUrl: "https://workpent.com/upload",
          uploadKey: "",
          uploadHeader: "none", // no secret in client; server should allow anonymous or API should be used
          uploadMethod: "POST", // POST|PUT
          uploadFieldName: "file",
          linkFieldPath: "url", // path to URL in JSON response
        };
        const cfg = await browser.storage.sync.get(cfgDefaults);
        const uploadUrl = cfg.uploadUrl?.trim();
        if (!uploadUrl) throw new Error("Upload URL is not set. Configure in extension settings.");

        // Request optional host permission for the upload origin
        try {
          const urlObj = new URL(uploadUrl);
          const originPattern = urlObj.origin + "/*";
          if (browser.permissions && browser.permissions.request) {
            await new Promise((resolve) => {
              browser.permissions.request({ origins: [originPattern] }, (granted) => resolve(!!granted));
            });
          }
        } catch {}

        // Build request EXACTLY like legacy popup.js
        // - Method: POST multipart/form-data
        // - Fields: file (blob), name (string)
        // - Header: X-ACEP-Key: <key>
        const fd = new FormData();
        fd.append("file", blob, name || "export.bin");
        fd.append("name", name || "export.bin");
        const headers = new Headers();
        // No auth header sent from client. Server must accept anonymous uploads or API presigned should be used.

        // Enrichment headers for server-side metering
        try {
          const man = browser.runtime.getManifest();
          const ver = (man && man.version) ? man.version : '0';
          headers.set('X-Client', `acep/${ver}`);
          if (msg.meta?.channel) headers.set('X-Channel', String(msg.meta.channel));
          if (msg.meta?.installId) headers.set('X-Install-Id', String(msg.meta.installId));
          if (msg.meta?.plan) headers.set('X-Plan', String(msg.meta.plan));
          if (typeof msg.meta?.estimatedPages === 'number') headers.set('X-Estimated-Pages', String(msg.meta.estimatedPages));
          if (msg.meta?.format) headers.set('X-Format', String(msg.meta.format));
        } catch {}

        const resp = await fetch(uploadUrl, { method: "POST", headers, body: fd });
        if (!resp.ok) {
          const txt = await resp.text().catch(() => String(resp.status));
          throw new Error(`Upload failed (${resp.status}): ${txt.slice(0, 300)}`);
        }

        let link = "";
        let json;
        const ct = resp.headers.get("content-type") || "";
        if (/json/i.test(ct)) {
          try { json = await resp.json(); } catch {}
        } else {
          try { json = await resp.clone().json(); } catch {}
        }

        // Helper: first URL anywhere in object
        const findFirstUrl = (obj) => {
          if (!obj || typeof obj !== 'object') return "";
          for (const k of Object.keys(obj)) {
            const v = obj[k];
            if (typeof v === 'string' && /^https?:\/\//i.test(v)) return v;
            if (v && typeof v === 'object') { const deep = findFirstUrl(v); if (deep) return deep; }
          }
          return "";
        };

        if (json) {
          if (json.ok && typeof json.url === 'string' && /^https?:\/\//i.test(json.url)) link = json.url;
          if (!link) {
            const candidates = [json.url, json.link, json.downloadUrl, json.download_url];
            for (const c of candidates) { if (typeof c === 'string' && /^https?:\/\//i.test(c)) { link = c; break; } }
          }
          if (!link) {
            const path = (cfg.linkFieldPath || "url").split('.').map(s => s.trim()).filter(Boolean);
            let cur = json; for (const p of path) { if (cur && typeof cur === 'object') cur = cur[p]; }
            if (typeof cur === 'string' && /^https?:\/\//i.test(cur)) link = cur;
          }
          if (!link) link = findFirstUrl(json);
        }

        // Try Location header
        if (!link) {
          const loc = resp.headers.get('Location') || resp.headers.get('location');
          if (loc && /^https?:\/\//i.test(loc)) link = loc;
        }

        // As a final fallback, scan text body for a URL
        if (!link) {
          try {
            const txt = await resp.clone().text();
            const m = txt.match(/https?:\/\/[^\s"']+/i);
            if (m && m[0]) link = m[0];
          } catch {}
        }

        if (!link) throw new Error("No share URL returned by server.");

        sendResponse({ ok: true, url: link });
      } catch (err) {
        sendResponse({ ok: false, error: String(err?.message || err) });
      }
  return;
    }

    // Cross-origin fetch helper: return image as data URL for embedding (PDF/DOCX/HTML self)
    if (msg && msg.type === "ACEP_FETCH_DATAURL" && typeof msg.url === 'string') {
      try {
        const urlStr = String(msg.url);
        if (/^data:image\//i.test(urlStr)) {
          sendResponse({ ok: true, dataUrl: urlStr, contentType: '' });
          return;
        }

        if (!/^https?:\/\//i.test(urlStr)) {
          throw new Error('Proxy only supports http(s) URLs.');
        }

        const forceRefresh = !!msg.noCache || !!msg.force;
        const cached = forceRefresh ? null : acepProxyCache.get(urlStr);
        if (cached && (Date.now() - cached.ts) < ACEP_PROXY_TTL_MS) {
          sendResponse({ ok: true, dataUrl: cached.dataUrl, contentType: cached.contentType || '' });
          return;
        }

        if (!forceRefresh && acepProxyInflight.has(urlStr)) {
          const inflight = await acepProxyInflight.get(urlStr);
          if (inflight && inflight.dataUrl) {
            sendResponse({ ok: true, dataUrl: inflight.dataUrl, contentType: inflight.contentType || '' });
            return;
          }
        }

        // Direct fetch for ChatGPT estuary images (same-origin, cookies required).
        try {
          const host = new URL(urlStr).hostname;
          if (host === 'chatgpt.com' && /\/backend-api\/estuary\/content/i.test(urlStr)) {
            const direct = await directFetchImageDataUrl(urlStr, 'https://chatgpt.com/', 'include');
            if (direct && direct.dataUrl) {
              acepProxyCache.set(urlStr, { ...direct, ts: Date.now() });
              sendResponse({ ok: true, dataUrl: direct.dataUrl, contentType: direct.contentType || '' });
              return;
            }
          }
        } catch {}

        // Direct fetch for Googleusercontent (Gemini) images to avoid hotlink blocks.
        try {
          const host = new URL(urlStr).hostname;
          if (host === 'lh3.googleusercontent.com' || host === 'lh3.google.com' || host.endsWith('.googleusercontent.com')) {
            const direct = await directFetchImageDataUrl(urlStr, 'https://gemini.google.com/', 'include');
            if (direct && direct.dataUrl) {
              acepProxyCache.set(urlStr, { ...direct, ts: Date.now() });
              sendResponse({ ok: true, dataUrl: direct.dataUrl, contentType: direct.contentType || '' });
              return;
            }
          }
        } catch {}

        // Direct fetch for DeepSeek OBS images (worker blocked by upstream 403).
        try {
          const host = new URL(urlStr).hostname;
          if (/deepseek-api-files|myhuaweicloud|\bobs\./i.test(host)) {
            const direct = await directFetchImageDataUrl(urlStr, 'https://chat.deepseek.com/', 'omit');
            if (direct && direct.dataUrl) {
              acepProxyCache.set(urlStr, { ...direct, ts: Date.now() });
              sendResponse({ ok: true, dataUrl: direct.dataUrl, contentType: direct.contentType || '' });
              return;
            }
          }
        } catch {}

        // Direct fetch for Grok uploaded images (assets.grok.com). These often require cookies + a Grok referrer.
        try {
          const host = new URL(urlStr).hostname;
          if (host === 'assets.grok.com') {
            // First try `fetch` with cookies + referrer.
            const direct = await directFetchImageDataUrl(urlStr, 'https://grok.com/', 'include');
            if (direct && direct.dataUrl) {
              acepProxyCache.set(urlStr, { ...direct, ts: Date.now() });
              sendResponse({ ok: true, dataUrl: direct.dataUrl, contentType: direct.contentType || '' });
              return;
            }
            // Some Grok endpoints may reject `fetch` requests (e.g., due to headers like Origin).
            // Fallback to XHR which more closely matches an image load.
            const accept = 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8';
            const xr = await xhrFetchArrayBuffer(urlStr, { withCredentials: true, accept });
            if (xr && xr.ok && xr.arrayBuffer) {
              const contentType = xr.contentType || 'image/png';
              const b64 = arrayBufferToBase64(xr.arrayBuffer);
              const dataUrl = `data:${contentType};base64,${b64}`;
              acepProxyCache.set(urlStr, { dataUrl, contentType, ts: Date.now() });
              sendResponse({ ok: true, dataUrl, contentType });
              return;
            }
          }
        } catch {}

        // NOTE: Grok assets are fetched via the proxy worker (no host permission required).
        const inflightPromise = (async () => {
          const { installId, secret } = await ensureInstallIdentity();

          const bodyText = JSON.stringify({ url: urlStr });
          const bodyHash = await sha256Hex(bodyText);
          const doFetch = async () => {
            const signed = await createSignedApiHeaders('POST', ACEP_PROXY_PATH, bodyHash);
            const resp = await fetch(`${ACEP_API_BASE}${ACEP_PROXY_PATH}`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                ...signed,
              },
              body: bodyText,
            });
            return resp;
          };

          let resp = null;
          for (let attempt = 0; attempt < 2; attempt++) {
            resp = await doFetch();
            if (resp.ok || ![408, 425, 429, 500, 502, 503, 504].includes(resp.status)) break;
            await new Promise((resolve) => setTimeout(resolve, 400));
          }

          if (resp && resp.status === 401) {
            let errMsg = '';
            try {
              const data = await resp.clone().json();
              errMsg = String(data?.error || '');
            } catch {
              try { errMsg = String(await resp.clone().text()); } catch {}
            }
            if (/timestamp/i.test(errMsg)) {
              const serverDate = resp.headers.get('Date');
              const serverTs = serverDate ? Date.parse(serverDate) : Date.now();
              acepProxyTimeOffsetMs = serverTs - Date.now();
              resp = await doFetch();
            } else if (installId && secret) {
              await registerInstall(installId, secret, { force: true });
              resp = await doFetch();
            }
          }
          if (!resp || !resp.ok) {
                        let detail = '';
            try {
              const body = await resp.clone().json();
              detail = String(body?.error || body?.detail || body?.upstreamStatus || '');
            } catch {
              try { detail = String(await resp.clone().text()); } catch {}
            }
            throw new Error(`Proxy failed (${resp ? resp.status : 'no-response'})${detail ? `: ${detail}` : ''}`);
          }
          const data = await resp.json().catch(() => ({}));
          if (!data || !data.dataUrl || !/^data:image\//i.test(String(data.dataUrl))) {
            throw new Error('Proxy did not return image data.');
          }
          const out = { dataUrl: String(data.dataUrl), contentType: String(data.contentType || '') };
          acepProxyCache.set(urlStr, { ...out, ts: Date.now() });
          return out;
        })();

        acepProxyInflight.set(urlStr, inflightPromise);
        const result = await inflightPromise;
        acepProxyInflight.delete(urlStr);
        sendResponse({ ok: true, dataUrl: result.dataUrl, contentType: result.contentType || '' });
      } catch (e) {
        acepProxyInflight.delete(String(msg.url || ''));
        sendResponse({ ok: false, error: String(e?.message || e) });
      }
      return;
    }
  })();
  return true;
});
if (typeof globalThis.browser === "undefined" && typeof globalThis.chrome !== "undefined") {
  globalThis.browser = globalThis.chrome;
}
