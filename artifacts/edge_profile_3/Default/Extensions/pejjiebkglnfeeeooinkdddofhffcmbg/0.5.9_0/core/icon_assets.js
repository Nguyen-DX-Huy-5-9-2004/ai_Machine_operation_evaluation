// Icon loading module
function runtimeGetUrl(path) {
  return (typeof browser !== 'undefined' && browser.runtime) ? browser.runtime.getURL(path) : path;
}

// Get blobToDataURL helper
async function blobToDataURL(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result || '');
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

const ICON_PATHS = {
  user: 'icons/user-purple.png',
  chatgpt: 'icons/chatgpt-purple.png',
  grok: 'icons/grok-purple.png',
  claude: 'icons/Claude-purple.png',
  gemini: 'icons/Gemini-purple.png',
  deepseek: 'icons/deepseek-purple.png',
};

const ICON_CACHE_DATAURL = { user: null, chatgpt: null, grok: null, claude: null, gemini: null, deepseek: null };

export async function loadIconDataUrl(key, path){
  if (ICON_CACHE_DATAURL[key]) return ICON_CACHE_DATAURL[key];
  try {
    const url = runtimeGetUrl(path);
    const resp = await fetch(url);
    if (!resp.ok) return '';
    const blob = await resp.blob();
    const dataUrl = await blobToDataURL(blob);
    ICON_CACHE_DATAURL[key] = dataUrl || '';
    return ICON_CACHE_DATAURL[key];
  } catch { return ''; }
}

export function loadIconDataUrlSync(key){ return ICON_CACHE_DATAURL[key] || ''; }

// Initialize icon loading
(async () => {
  try {
    await Promise.all(Object.entries(ICON_PATHS).map(([k,p]) => loadIconDataUrl(k,p)));
  } catch {}
})();

// Legacy functions for compatibility
const ICON_CANDIDATES = {
  user: ['icons/user-purple.png', 'icons/icon_user.png'],
  assistant: ['icons/chatgpt-purple.png', 'icons/icon_chatgpt.png'],
};

const ICON_CACHE = new Map();

export async function loadIconFromCandidates(candidates = []) {
  const key = `candidates:${(candidates || []).join('|')}`;
  if (ICON_CACHE.has(key)) return ICON_CACHE.get(key);
  for (const candidate of (candidates || [])) {
    try {
      const url = runtimeGetUrl(candidate);
      const resp = await fetch(url);
      if (!resp.ok) continue;
      const blob = await resp.blob();
      const arrayBuffer = await blob.arrayBuffer();
      const binary = new Uint8Array(arrayBuffer);
      const dataUrl = await blobToDataURL(blob);
      const result = { binary, dataUrl };
      ICON_CACHE.set(key, result);
      return result;
    } catch (err) {
      console.warn('Icon load failed', candidate, err);
    }
  }
  ICON_CACHE.set(key, null);
  return null;
}

export async function loadIconAssets(role) {
  const key = role === 'assistant' ? 'assistant' : 'user';
  if (ICON_CACHE.has(key)) return ICON_CACHE.get(key);
  const candidates = ICON_CANDIDATES[key] || [];
  for (const candidate of candidates) {
    try {
      const url = runtimeGetUrl(candidate);
      const resp = await fetch(url);
      if (!resp.ok) continue;
      const blob = await resp.blob();
      const arrayBuffer = await blob.arrayBuffer();
      const binary = new Uint8Array(arrayBuffer);
      const dataUrl = await blobToDataURL(blob);
      const result = { binary, dataUrl };
      ICON_CACHE.set(key, result);
      return result;
    } catch (err) {
      console.warn('Icon load failed for role', role, err);
    }
  }
  ICON_CACHE.set(key, null);
  return null;
}

