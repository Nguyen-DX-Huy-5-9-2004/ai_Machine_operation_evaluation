// Gemini DOM contract: selectors + container picking.
// Goal: keep Gemini extraction resilient by centralizing selectors and invariants here.
(function initGeminiContract() {
  try {
    const g = (typeof globalThis !== 'undefined') ? globalThis : window;
    if (!g.ACEP) g.ACEP = {};
    if (!g.ACEP.providers) g.ACEP.providers = {};

    const sel = {
      threadRoot: 'main',
      userTurn: 'user-query, [id^="user-query-content-"], .query-text',
      userTextLines: 'p.query-text-line',
      asstTurn: '.response-container, message-content, .model-response-text',
      asstMarkdown: '.markdown, .markdown-main-panel',
      convoTitleMain: '[data-test-id="conversation-title"]',
      convoTitleFallback: '.conversation-title, header h1, h1[aria-level="1"], [role="heading"][aria-level="1"]',
      userFallbackFirst: '.query-text, .query-text.gds-body-l, [id^="user-query-content-"] .query-text',
      // Gemini tool attribution / video preview blocks that should not be exported.
      toolAttributionAny: 'attribution-container, youtube-block, single-video, .tool-attribution, .youtube-block, .attachment-container.youtube',
      // Gemini uploads (varies by experiment).
      uploadedImgAny: '[data-test-id="uploaded-img"], img.preview-image, .preview-image',
    };

    function getThreadContainer() {
      try {
        return document.querySelector(sel.threadRoot) || document.body;
      } catch {
        return document.body;
      }
    }

    function contractCounts(container = null) {
      try {
        const c = container || getThreadContainer();
        if (!c) return { ok: false };
        const userCount = c.querySelectorAll(sel.userTurn).length;
        const asstCount = c.querySelectorAll(sel.asstTurn).length;
        return { ok: true, userCount, asstCount };
      } catch {
        return { ok: false };
      }
    }

    g.ACEP.providers.gemini = g.ACEP.providers.gemini || {};
    g.ACEP.providers.gemini.sel = sel;
    g.ACEP.providers.gemini.getThreadContainer = getThreadContainer;
    g.ACEP.providers.gemini.contractCounts = contractCounts;

    try { document.documentElement.setAttribute('data-acep-loaded-gemini-contract', '1'); } catch {}
  } catch {}
})();

