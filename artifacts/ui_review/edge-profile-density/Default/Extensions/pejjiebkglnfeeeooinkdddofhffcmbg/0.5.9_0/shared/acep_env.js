// Environment helpers shared by all providers.
(function initAcepEnv() {
  try {
    const g = (typeof globalThis !== 'undefined') ? globalThis : window;
    if (!g.ACEP) g.ACEP = {};

    const HOST = (location && location.hostname) ? String(location.hostname) : '';
    const ORIGIN = (location && location.origin) ? String(location.origin) : '';
    const platform = (() => {
      const h = HOST.toLowerCase();
      if (h === 'chatgpt.com' || h === 'chat.openai.com') return 'chatgpt';
      if (h === 'claude.ai') return 'claude';
      if (h === 'grok.com') return 'grok';
      if (h === 'gemini.google.com') return 'gemini';
      if (h === 'deepseek.com' || h === 'chat.deepseek.com') return 'deepseek';
      return 'unknown';
    })();

    g.ACEP.env = {
      HOST,
      ORIGIN,
      PLATFORM: platform,
      isChatGPT: () => platform === 'chatgpt',
      isClaude: () => platform === 'claude',
      isGrok: () => platform === 'grok',
      isGemini: () => platform === 'gemini',
      isDeepSeek: () => platform === 'deepseek',
    };

    // Expose lightweight markers to page context (content scripts are isolated).
    try { document.documentElement.setAttribute('data-acep-loaded-env', '1'); } catch {}
    try { document.documentElement.setAttribute('data-acep-platform', platform); } catch {}
    try { document.documentElement.setAttribute('data-acep-host', HOST); } catch {}
  } catch {}
})();
