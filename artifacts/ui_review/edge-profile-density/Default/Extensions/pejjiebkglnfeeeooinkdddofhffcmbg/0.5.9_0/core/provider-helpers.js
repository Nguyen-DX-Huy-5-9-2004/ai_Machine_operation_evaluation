/**
 * Provider-specific Helper Functions
 * Centralizes provider detection, URL handling, and icon selection logic
 * Used by popup.js and provider export modules
 */

/**
 * Get provider label from URL
 * @param {string} url - Full URL or hostname
 * @returns {string} Display label (ChatGPT, Claude, Grok, DeepSeek, Gemini, etc.)
 */
export function getProviderLabelFromUrl(u = '') {
  try {
    const url = new URL(u);
    const host = url.hostname || '';
    if (/grok\.com$/i.test(host)) return 'Grok';
    if (/claude\.ai$/i.test(host)) return 'Claude';
    if (/gemini\.google\.com$/i.test(host)) return 'Gemini';
    if (/deepseek\.com$/i.test(host)) return 'DeepSeek';
    if (/copilot\.microsoft\.com$/i.test(host)) return 'Copilot';
    return 'ChatGPT';
  } catch {
    return 'ChatGPT';
  }
}

/**
 * Get provider key from URL
 * @param {string} url - Full URL or hostname
 * @returns {string} Provider key (chatgpt, claude, grok, deepseek, gemini)
 */
export function getProviderKeyFromUrl(u = '') {
  try {
    const url = new URL(u);
    const host = url.hostname || '';
    if (/grok\.com$/i.test(host)) return 'grok';
    if (/claude\.ai$/i.test(host)) return 'claude';
    if (/gemini\.google\.com$/i.test(host)) return 'gemini';
    if (/deepseek\.com$/i.test(host)) return 'deepseek';
    if (/copilot\.microsoft\.com$/i.test(host)) return 'copilot';
    return 'chatgpt';
  } catch {
    return 'chatgpt';
  }
}

/**
 * Check if URL is likely an image URL with provider-specific rules
 * @param {string} url
 * @returns {boolean}
 */
export function isLikelyImageUrl(url = '') {
  if (!url) return false;
  if (/^data:image\//i.test(url) || /^blob:/i.test(url)) return true;
  if (/\.(png|jpe?g|gif|webp|avif|svg)(\?|#|$)/i.test(url)) return true;
  try {
    const parsed = new URL(url);
    const host = parsed.hostname;
    const path = parsed.pathname || '';

    // ChatGPT: Estuary API for uploaded files
    if (host === 'chatgpt.com' && /\/backend-api\/estuary\/content/i.test(path)) return true;
    // ChatGPT: file download API (returns JSON { download_url } â†’ CDN URL, resolved by content script)
    if (host === 'chatgpt.com' && /\/backend-api\/files\/(?:download\/[^/?#]+|[^/]+\/download)/i.test(path)) return true;
    if (/(\.|^)oaiusercontent\.com$/i.test(host)) return true;
    if (host === 'oaidalleapiprodscus.blob.core.windows.net') return true;

    // Claude: File preview API
    if (/claude\.ai$/i.test(host) && /\/api\/.+\/files\/.+\/preview/i.test(path)) return true;

    // DeepSeek: in-app file preview endpoints can be images but often have no extension.
    // These URLs usually appear directly in <img src="...">, so treat them as images.
    if (/deepseek\.com$/i.test(host)) {
      if (/\/api\/.+\/preview\b/i.test(path)) return true;
      if (/\/api\/.+\/content\b/i.test(path)) return true;
      if (/\/api\/.+\/files\/.+/i.test(path)) return true;
    }

    // Grok: Asset server (generated/uploaded images often use extensionless endpoints)
    if (/assets\.grok\.com$/i.test(host)) {
      if (/\.(png|jpe?g|gif|webp|avif|svg)(\?|#|$)/i.test(path)) return true;
      if (/\/generated\//i.test(path)) return true;
      if (/\/preview-image\b/i.test(path)) return true;
      if (/\/content\b/i.test(path)) return true;
      return false;
    }

    // DeepSeek: Huawei Cloud OBS
    if (/deepseek-api-files|myhuaweicloud|\bobs\./i.test(host)) return true;

    // Gemini: Google cloud storage
    if (host === 'lh3.googleusercontent.com' || host === 'lh3.google.com' || host.endsWith('.googleusercontent.com')) return true;
  } catch {}
  return false;
}

/**
 * Check if URL is likely an image URL for use in links
 * (Same as isLikelyImageUrl but with different naming for clarity)
 * @param {string} url
 * @returns {boolean}
 */
export function isLikelyImageUrlForLink(url = '') {
  return isLikelyImageUrl(url);
}

/**
 * Get provider-specific icon paths
 * @param {string} providerKey - Provider key (chatgpt, claude, grok, deepseek, gemini)
 * @returns {Object} Icon path configuration
 */
export function getProviderIconPaths(providerKey = 'chatgpt') {
  const ASSISTANT_ICON_FALLBACK = ['icons/chatgpt-purple.png'];

  const iconsByProvider = {
    grok: {
      assistant: ['icons/grok-purple.png', 'icons/chatgpt-purple.png'],
      user: 'icons/user-purple.png'
    },
    claude: {
      assistant: ['icons/Claude-purple.png', 'icons/chatgpt-purple.png'],
      user: 'icons/user-purple.png'
    },
    gemini: {
      assistant: ['icons/Gemini-purple.png', 'icons/chatgpt-purple.png'],
      user: 'icons/user-purple.png'
    },
    deepseek: {
      assistant: ['icons/deepseek-purple.png', 'icons/chatgpt-purple.png'],
      user: 'icons/user-purple.png'
    },
    chatgpt: {
      assistant: ASSISTANT_ICON_FALLBACK,
      user: 'icons/user-purple.png'
    }
  };

  return iconsByProvider[(providerKey || 'chatgpt').toLowerCase()] || iconsByProvider.chatgpt;
}

/**
 * Check if URL should be fetched via background worker (not page context)
 * Helps with CORS and protected assets
 * @param {string} url
 * @returns {boolean}
 */
export function shouldUseBackgroundFetch(url = '') {
  if (!url) return false;
  
  // Google userContent CORS blocks; use background fetch instead
  if (/^https?:\/\/[^\/]*googleusercontent\.com\//i.test(url)) return true;
  
  // DeepSeek OBS URLs must use background fetch
  if (/deepseek-api-files|myhuaweicloud|\bobs\./i.test(url)) return true;
  
  return false;
}

/**
 * Detect provider from rows or origin info
 * @param {Array} rows - Message rows
 * @param {string} providerLabel - Provider label for fallback
 * @returns {Object} Detection results {isDeepSeek, isChatGPT, isClaude, isGrok, isGemini}
 */
export function detectProvider(rows = [], providerLabel = 'ChatGPT') {
  const origin = (rows?.[0]?.origin || '').toLowerCase();
  
  return {
    isDeepSeek: providerLabel === 'DeepSeek' || origin.includes('deepseek'),
    isChatGPT: (providerLabel || 'ChatGPT') === 'ChatGPT' || origin.includes('openai') || origin.includes('chatgpt'),
    isClaude: providerLabel.toLowerCase() === 'claude' || origin.includes('claude.ai'),
    isGrok: providerLabel.toLowerCase() === 'grok' || origin.includes('grok'),
    isGemini: providerLabel.toLowerCase() === 'gemini' || origin.includes('gemini')
  };
}

