// ChatGPT DOM contract: selectors + container picking.
// Goal: keep ChatGPT extraction resilient by centralizing selectors and invariants here.
(function initChatGPTContract() {
  try {
    const g = (typeof globalThis !== 'undefined') ? globalThis : window;
    if (!g.ACEP) g.ACEP = {};
    if (!g.ACEP.providers) g.ACEP.providers = {};

    const sel = {
      threadRoot: 'main',
      turnAny: '[data-testid^="conversation-turn-"]',
      messageAny: '[data-message-author-role]',
      messageContent: '.markdown, [data-testid="message-content"], .prose, .markdown-new-styling',
      convoTitle: 'header h1, [data-testid="conversation-title"]',
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
        const turnCount = c.querySelectorAll(sel.turnAny).length;
        const msgCount = c.querySelectorAll(sel.messageAny).length;
        return { ok: true, turnCount, msgCount };
      } catch {
        return { ok: false };
      }
    }

    g.ACEP.providers.chatgpt = g.ACEP.providers.chatgpt || {};
    g.ACEP.providers.chatgpt.sel = sel;
    g.ACEP.providers.chatgpt.getThreadContainer = getThreadContainer;
    g.ACEP.providers.chatgpt.contractCounts = contractCounts;

    try { document.documentElement.setAttribute('data-acep-loaded-chatgpt-contract', '1'); } catch {}
  } catch {}
})();

