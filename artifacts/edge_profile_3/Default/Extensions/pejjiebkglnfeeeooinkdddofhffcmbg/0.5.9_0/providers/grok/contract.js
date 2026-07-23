// Grok DOM contract: selectors + container picking.
// Goal: keep Grok extraction resilient by centralizing selectors and invariants here.
(function initGrokContract() {
  try {
    const g = (typeof globalThis !== 'undefined') ? globalThis : window;
    if (!g.ACEP) g.ACEP = {};
    if (!g.ACEP.providers) g.ACEP.providers = {};

    const sel = {
      threadRoot: 'main',
      responseRoot: '[id^="response-"]',
      bubbleAny: 'div[class*="message-bubble" i], [class*="MessageBubble" i], [data-testid*="bubble" i]',
      contentAny: '.response-content-markdown, [data-testid="message-content"], .markdown, [class*="prose" i]',
      artifactCard: '[id^="artifact_card_"]',
      fileChipAny: '[class*="group/chip" i], [class*="chip" i]',
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
        const responseCount = c.querySelectorAll(sel.responseRoot).length;
        const bubbleCount = c.querySelectorAll(sel.bubbleAny).length;
        const artifactCount = c.querySelectorAll(sel.artifactCard).length;
        return { ok: true, responseCount, bubbleCount, artifactCount };
      } catch {
        return { ok: false };
      }
    }

    g.ACEP.providers.grok = g.ACEP.providers.grok || {};
    g.ACEP.providers.grok.sel = sel;
    g.ACEP.providers.grok.getThreadContainer = getThreadContainer;
    g.ACEP.providers.grok.contractCounts = contractCounts;

    try { document.documentElement.setAttribute('data-acep-loaded-grok-contract', '1'); } catch {}
  } catch {}
})();

