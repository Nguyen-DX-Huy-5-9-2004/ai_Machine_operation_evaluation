// action.js – toolbar popup logic (MV3)
const CHAT_MATCH = /^(https:\/\/(chatgpt\.com|chat\.openai\.com|claude\.ai|gemini\.google\.com|copilot\.microsoft\.com|chat\.deepseek\.com|meta\.ai|grok\.com)\/)/i;

// ===== i18n (matches popup.js approach) =====
let __t = (k, subs=[]) => browser.i18n.getMessage(k, subs) || k;
function applyI18nDom() {
  try {
    const rep = (s)=> String(s || '').replace(/__MSG_([A-Za-z0-9_]+)__/g, (_,key)=>__t(key));
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
  } catch {}
}

// Minimal promise helpers for MV2 callback-style APIs
  function tabsQuery(queryInfo) {
    try {
      const r = browser.tabs.query(queryInfo);
      if (r && typeof r.then === 'function') return r;
    } catch {}
  return new Promise((resolve) => browser.tabs.query(queryInfo, resolve));
  }
function tabsCreate(createProperties) {
  try {
    const r = browser.tabs.create(createProperties);
    if (r && typeof r.then === 'function') return r;
  } catch {}
  return new Promise((resolve) => browser.tabs.create(createProperties, resolve));
}
function tabsSendMessage(tabId, message) {
  try {
    const r = browser.tabs.sendMessage(tabId, message);
    if (r && typeof r.then === 'function') return r;
  } catch {}
  return new Promise((resolve) => browser.tabs.sendMessage(tabId, message, resolve));
}
  async function getStorageArea(){
    try { if (typeof browser !== 'undefined' && browser.storage?.local) return browser.storage.local; } catch {}
    const wrap = (area) => ({
      get:(k)=> new Promise((res,rej)=>area.get(k,r=>{const e=browser.runtime.lastError; if(e) rej(e); else res(r);})),
      set:(v)=> new Promise((res,rej)=>area.set(v,()=>{const e=browser.runtime.lastError; if(e) rej(e); else res();})),
    });
    try { if (chrome?.storage?.local) return wrap(browser.storage.local); } catch {}
    try { if (chrome?.storage?.sync) return wrap(browser.storage.sync); } catch {}
    const mem={}; return { get: async (k)=>({ ...(k||{}), ...mem }), set: async (v)=>Object.assign(mem,v||{}) };
  }
  async function storageGet(keys) { const s = await getStorageArea(); return s.get(keys); }
  async function storageSet(items) { const s = await getStorageArea(); return s.set(items); }

// Load chosen language pack (stored `lang`) and apply __MSG_* placeholders.
const i18nReady = (async function i18nBootstrap(){
  try {
    const s = await getStorageArea();
    const { lang = 'en' } = await s.get({ lang: 'en' });
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

async function getAllChatTabs() {
  const tabs = await tabsQuery({});
  return tabs.filter(t => t.url && CHAT_MATCH.test(t.url));
}

async function ensureOneChatTab() {
  // If there is an active ChatGPT tab in current window, use it.
  const [active] = await tabsQuery({ active: true, currentWindow: true });
  if (active && active.id && active.url && CHAT_MATCH.test(active.url)) {
    return active.id;
  }
  // Otherwise find any ChatGPT tab
  const chats = await getAllChatTabs();
  if (chats.length) return chats[0].id;

  // Otherwise open one (default to ChatGPT)
  const created = await tabsCreate({ url: "https://chatgpt.com" });
  // wait until it's complete
  await new Promise(resolve => {
    function onUpdated(tabId, info) {
      if (tabId === created.id && info.status === "complete") {
        browser.tabs.onUpdated.removeListener(onUpdated);
        resolve();
      }
    }
    browser.tabs.onUpdated.addListener(onUpdated);
  });
  return created.id;
}

async function openOverlayOnChatTab() {
  const tabId = await ensureOneChatTab();
  // poke content script to open overlay
  try {
    await tabsSendMessage(tabId, { type: "ACEP_OPEN_POPUP" });
  } catch (e) {
    // If the content script hasn't injected yet (very first load), give it a moment.
    await new Promise(r => setTimeout(r, 600));
    await tabsSendMessage(tabId, { type: "ACEP_OPEN_POPUP" });
  }
}

// Try to open overlay on the current active tab first (to show a toast on unsupported providers);
// if that fails, fall back to opening on a supported ChatGPT tab.
async function openOverlayOnActiveTab() {
  try {
    const [active] = await tabsQuery({ active: true, currentWindow: true });
    if (active && active.id) {
      try {
        await tabsSendMessage(active.id, { type: "ACEP_OPEN_POPUP" });
        return; // success on current tab (toast or overlay handled by content.js)
      } catch {}
    }
  } catch {}
  // Fallback to opening on ChatGPT
  await openOverlayOnChatTab();
}

// ---- UI wiring ----
document.addEventListener("DOMContentLoaded", async () => {
  console.log('[ACEP action] action.html DOMContentLoaded');
  try { await i18nReady; } catch {}
  const versionEl = document.getElementById("ver");
  try {
    const man = browser.runtime.getManifest();
    versionEl.textContent = "v" + (man.version || "0.0.0");
  } catch {}

  const langSel = document.getElementById("lang");
  const enabledChk = document.getElementById("enabled");

  // load saved
  let lang = 'en';
  let enabled = true;
  try {
    const r = await storageGet({ lang: "en", enabled: true });
    if (r) { if (r.lang) lang = r.lang; if (typeof r.enabled === 'boolean') enabled = r.enabled; }
  } catch {}
  try {
    const r2 = await browser.storage?.sync?.get?.({ lang, enabled });
    if (r2) { if (r2.lang) lang = r2.lang; if (typeof r2.enabled === 'boolean') enabled = r2.enabled; }
  } catch {}
  try {
    const r3 = await browser.storage?.local?.get?.({ lang, enabled });
    if (r3) { if (r3.lang) lang = r3.lang; if (typeof r3.enabled === 'boolean') enabled = r3.enabled; }
  } catch {}
  langSel.value = lang;
  enabledChk.checked = !!enabled;
  document.getElementById("toggleSwitch").classList.toggle("active", !!enabled);

  // save language → tell all chat tabs
  async function applyLangNow(lang) {
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
      __t = (k, subs=[]) => override?.[k]?.message || base?.[k]?.message || browser.i18n.getMessage(k, subs) || k;
    } catch {}
    applyI18nDom();
  }

  langSel.addEventListener("change", async () => {
    await storageSet({ lang: langSel.value });
    try { browser.storage?.local?.set?.({ lang: langSel.value }); } catch {}
    try { browser.storage?.sync?.set?.({ lang: langSel.value }); } catch {}
    await applyLangNow(langSel.value);
    const chatTabs = await getAllChatTabs();
    for (const t of chatTabs) {
      try {
        browser.tabs.sendMessage(t.id, { type: "ACEP_SETTINGS_CHANGED", lang: langSel.value }, () => {
          if (browser.runtime?.lastError) return; // ignore missing receivers
        });
      } catch {}
    }
  });

  // enable toggle (no full reload needed)
  document.getElementById("toggleSwitch").addEventListener("click", async () => {
    enabledChk.checked = !enabledChk.checked;
    document.getElementById("toggleSwitch").classList.toggle("active", enabledChk.checked);
    await storageSet({ enabled: enabledChk.checked });
    try { browser.storage?.local?.set?.({ enabled: enabledChk.checked }); } catch {}
    try { browser.storage?.sync?.set?.({ enabled: enabledChk.checked }); } catch {}
    const chatTabs = await getAllChatTabs();
    for (const t of chatTabs) {
      try {
        browser.tabs.sendMessage(t.id, { type: "ACEP_SETTINGS_CHANGED", enabled: enabledChk.checked }, () => {
          if (browser.runtime?.lastError) return;
        });
      } catch {}
    }
  });

  // Shortcuts
  document.getElementById("coffee").onclick  = () => browser.tabs.create({ url: "https://chatexport.workpent.com/support/" });
  document.getElementById("home").onclick    = () => browser.tabs.create({ url: "https://chatexport.workpent.com" });
  document.getElementById("faqs").onclick    = () => browser.tabs.create({ url: "https://chatexport.workpent.com/faq" });
  const rateBtn = document.getElementById("rate");
  rateBtn?.addEventListener('click', () => {
    let url = 'https://chatexport.workpent.com';
    try {
      const ua = navigator.userAgent || '';
      if (/firefox/i.test(ua)) url = 'https://addons.mozilla.org/en-US/firefox/addon/ai-chat-exporter-pro/';
      else if (/Edg/i.test(ua)) url = 'https://microsoftedge.microsoft.com/addons/detail/ai-chat-exporter-pro/pejjiebkglnfeeeooinkdddofhffcmbg';
      else url = 'https://chromewebstore.google.com/detail/ai-chat-exporter-pro/fbkhenejfmjjakgpmiehogilickgmkhe';
    } catch {}
    browser.tabs.create({ url });
  });

  // Settings gear → open popup.html as a dedicated settings tab
  document.getElementById("settingsButton").onclick = () => {
    try { browser.tabs.create({ url: browser.runtime.getURL('popup.html') }); } catch {}
  };

  // Link sharing settings UI removed in production build

  // ===== License wiring =====
  const apiBase = "https://acep-api.workpent.com";
  const verifyBtn = document.getElementById("verifyBtn");
  const manageBtn = document.getElementById("manageBtn");
  const statusEl = document.getElementById("licenseStatus");
  const detachBtn = document.getElementById("detachBtn");
  const devicesBtn = document.getElementById("devicesBtn");

  function getChannel() {
    try { if (typeof browser !== 'undefined' && browser.runtime) return 'firefox'; } catch {}
    try { const ua = navigator.userAgent||''; if (/Edg/i.test(ua)) return 'edge'; if (/Chrome/i.test(ua)) return 'chrome'; } catch {}
    return 'webext';
  }
  async function ensureInstallId(){
    try {
      const r = await storageGet({ installId: '' });
      if (r && r.installId) return r.installId;
      const id = (crypto && crypto.randomUUID) ? crypto.randomUUID() : String(Date.now())+Math.random().toString(36).slice(2);
      await storageSet({ installId: id });
      return id;
    } catch { return 'unknown'; }
  }
  function getVersion(){ try { return (browser.runtime.getManifest()?.version) || '0'; } catch { return '0'; } }

  async function renderStatusFromStorage() {
    let licenseToken = '';
    let plan = 'free';
    try {
      const r = await storageGet({ licenseToken: '', plan: 'free' });
      if (r) { licenseToken = r.licenseToken || ''; plan = r.plan || 'free'; }
    } catch {}
    const isPro = !!licenseToken && plan && plan !== 'free';
    try { if (verifyBtn) verifyBtn.style.display = isPro ? 'none' : ''; } catch {}
    try { if (manageBtn) manageBtn.style.display = isPro ? '' : 'none'; } catch {}
    try { if (detachBtn) detachBtn.style.display = 'none'; if (devicesBtn) devicesBtn.style.display = 'none'; } catch {}
    try { if (statusEl) statusEl.textContent = isPro ? `Plan: ${String(plan).toUpperCase()}` : 'Already purchased Pro?'; } catch {}
  }
  await renderStatusFromStorage();

  async function startVerifyFlow() {
    const installId = await ensureInstallId();
    const channel = getChannel();
    const ver = getVersion();
    const redirectUri = browser.identity.getRedirectURL('provider_cb');
    const startUrl = `https://verify.chatexport.workpent.com/start?install_id=${encodeURIComponent(installId)}&channel=${encodeURIComponent(channel)}&version=${encodeURIComponent(ver)}&redirect_uri=${encodeURIComponent(redirectUri)}`;
    verifyBtn.disabled = true;
    verifyBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Verifying';
    try {
      const finalUrl = await new Promise((resolve, reject) => {
        browser.identity.launchWebAuthFlow({ url: startUrl, interactive: true }, (responseUrl) => {
          if (browser.runtime.lastError) return reject(new Error(browser.runtime.lastError.message));
          if (!responseUrl) return reject(new Error('No response URL'));
          resolve(responseUrl);
        });
      });
      // Expect either ?token=... or ?code=...
      const u = new URL(finalUrl);
      const tokenParam = u.searchParams.get('token') || u.searchParams.get('license_token');
      const code = u.searchParams.get('code');
      let token = tokenParam;
      if (!token && code) {
        const resp = await fetch(`${apiBase}/v1/auth/exchange`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code, install_id: installId, channel, version: ver })
        });
        const data = await resp.json().catch(()=>({}));
        if (!resp.ok || !data?.token) throw new Error(data?.detail || 'Exchange failed');
        token = data.token;
      }
      if (!token) throw new Error('No token returned');
      // Validate + persist
      const v = await fetch(`${apiBase}/v1/auth/validate`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ install_id: installId, channel, version: ver })
      });
      const vd = await v.json().catch(()=>({}));
      if (!v.ok || vd?.ok === false) throw new Error(vd?.detail || 'Validation failed');
      await browser.storage.sync.set({ licenseToken: token, plan: vd.plan || 'pro', email: vd.email || '' });
      await renderStatusFromStorage();
    } catch (e) {
      alert(`Verify failed: ${e?.message || e}`);
    } finally {
      verifyBtn.disabled = false;
      verifyBtn.innerHTML = '<i class="fas fa-check-circle"></i> Verify';
    }
  }
  verifyBtn?.addEventListener('click', startVerifyFlow);

  manageBtn?.addEventListener('click', () => {
    browser.tabs.create({ url: 'https://verify.chatexport.workpent.com/manage' });
  });

  detachBtn?.addEventListener('click', async () => {
    const { licenseToken = '' } = await browser.storage.sync.get({ licenseToken: '' });
    if (!licenseToken) { alert('No license token saved'); return; }
    const body = { channel: getChannel() };
    try {
      const resp = await fetch(`${apiBase}/v1/license/detach`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${licenseToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await resp.json().catch(()=>({}));
      if (!resp.ok) { alert(`Detach failed: ${data?.detail || resp.statusText}`); return; }
      // After detaching, we keep token but user might be free until re-validate; reflect UI
      await renderStatusFromStorage();
      alert('Disconnected for this browser/channel. Click Validate to attach again.');
    } catch (e) {
      alert(`Detach error: ${e?.message || e}`);
    }
  });

  devicesBtn?.addEventListener('click', async () => {
    const { licenseToken = '' } = await browser.storage.sync.get({ licenseToken: '' });
    if (!licenseToken) { alert('No license token saved'); return; }
    try {
      const resp = await fetch(`${apiBase}/v1/license/devices`, { headers: { 'Authorization': `Bearer ${licenseToken}` } });
      const data = await resp.json().catch(()=>({}));
      if (!resp.ok) { alert(`Devices failed: ${data?.detail || resp.statusText}`); return; }
      const list = Array.isArray(data?.devices) ? data.devices.map(d => `${d.channel}: ${d.install_id}`).join('\n') : JSON.stringify(data);
      alert(list || 'No devices');
    } catch (e) {
      alert(`Devices error: ${e?.message || e}`);
    }
  });
});

// Promise-ify callback APIs when needed (MV2/MV3 compatibility)
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
