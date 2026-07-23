/**
 * Provider Detection Registry (IIFE Namespace Pattern)
 * Centralized host detection and provider identification
 * Works in both content script and popup contexts
 */

(function initProviderDetection() {
  const g = (typeof globalThis !== 'undefined') ? globalThis : window;
  if (!g.ACEP) g.ACEP = {};
  if (!g.ACEP.providerRegistry) g.ACEP.providerRegistry = {};

  g.ACEP.providerRegistry = {
    // Trusted domains for resource loading
    TRUSTED_DOMAINS: {
      chatgpt: ['chatgpt.com', 'chat.openai.com'],
      grok: ['grok.com', 'x.ai', 'assets.grok.com'],
      claude: ['claude.ai'],
      deepseek: ['deepseek.com', 'chat.deepseek.com', 'deepseek-api-files.obs.cn-east-3.myhuaweicloud.com'],
      gemini: ['gemini.google.com']
    },

    // Provider aliases mapping host to provider name
    PROVIDER_ALIASES: {
      'chatgpt.com': 'chatgpt',
      'chat.openai.com': 'chatgpt',
      'claude.ai': 'claude',
      'grok.com': 'grok',
      'x.ai': 'grok',
      'assets.grok.com': 'grok',
      'deepseek.com': 'deepseek',
      'chat.deepseek.com': 'deepseek',
      'gemini.google.com': 'gemini'
    },

    /**
     * Detect the current provider from hostname
     * @param {string} hostname - window.location.hostname
     * @returns {string|null} Provider name or null if unsupported
     */
    getProviderFromHost(hostname) {
      hostname = (hostname || '').toLowerCase();
      return this.PROVIDER_ALIASES[hostname] || null;
    },

    /**
     * Check if hostname is a supported AI chat provider
     * @param {string} hostname
     * @returns {boolean}
     */
    isSupportedHost(hostname) {
      const provider = this.getProviderFromHost(hostname);
      return !!provider;
    },

    /**
     * Get list of trusted domains for resource loading
     * @param {string} provider - Provider name
     * @returns {string[]} List of trusted domains for that provider
     */
    getTrustedDomainsForProvider(provider) {
      return this.TRUSTED_DOMAINS[(provider || '').toLowerCase()] || [];
    },

    /**
     * Check if URL is from a trusted domain for the given provider
     * @param {string} url - Full URL to check
     * @param {string} provider - Provider name
     * @returns {boolean}
     */
    isTrustedUrlForProvider(url, provider) {
      const domains = this.getTrustedDomainsForProvider(provider);
      return domains.some(domain => (url || '').includes(domain));
    },

    /**
     * Get provider label for display
     * @param {string} provider - Provider name
     * @returns {string} Display name
     */
    getProviderLabel(provider) {
      const labels = {
        chatgpt: 'ChatGPT',
        claude: 'Claude',
        grok: 'Grok',
        deepseek: 'DeepSeek',
        gemini: 'Gemini'
      };
      return labels[(provider || '').toLowerCase()] || provider;
    }
  };

})();

// Export for use in modules (popup context)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ACEP.providerRegistry;
}
