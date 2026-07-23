// DeepSeek DOM contract: selectors + container picking.
// Goal: keep DeepSeek extraction resilient by centralizing selectors and invariants here.
(function initDeepSeekContract() {
  try {
    const g = (typeof globalThis !== 'undefined') ? globalThis : window;
    if (!g.ACEP) g.ACEP = {};
    if (!g.ACEP.providers) g.ACEP.providers = {};

    const sel = {
      threadRoot: 'main',
      // DeepSeek DOM can change; keep selectors broad but anchored to the thread container.
      msgAny: '.ds-message, div.ds-message, [class*="ds-message" i], [class*="message" i], [data-message-author-role], [data-testid*="message" i]',
      asstMarkdown: '.ds-markdown, [class*="ds-markdown" i], [class*="markdown" i]',
      userTextAny: '.fbb737a4, [class*="fbb737a4" i], p.whitespace-pre-wrap.break-words, [class*="whitespace-pre-wrap" i][class*="break-words" i]',
      // Upload chips / attachment rows. `_5cadb25` is a stable-ish container seen in older builds and backups.
      fileChipAny: 'div._5cadb25, [class*="_5cadb25" i], .f3a54b52, [class*="f3a54b52" i], [data-testid*="file" i], [class*="file" i][class*="chip" i], [class*="upload" i], [class*="attachment" i]',
      // Upload URLs can be on Huawei OBS, or as DeepSeek in-app `/api/.../(preview|content)` endpoints.
      uploadUrlAny:
        'a[href*="myhuaweicloud" i], a[href*="deepseek-api-files" i], a[href*="obs." i], ' +
        'img[src*="myhuaweicloud" i], img[src*="deepseek-api-files" i], img[src*="obs." i], ' +
        '[data-original-src*="myhuaweicloud" i], [data-original-src*="deepseek-api-files" i], [data-original-src*="obs." i], ' +
        'a[href^="/api/" i], img[src^="/api/" i], [data-original-src^="/api/" i], [data-src^="/api/" i], ' +
        'a[href*="/api/" i], img[src*="/api/" i], [data-original-src*="/api/" i], [data-src*="/api/" i]',
    };

    function getThreadContainer() {
      try {
        const main = document.querySelector(sel.threadRoot);
        if (main) {
          try {
            const msgCount = main.querySelectorAll(sel.msgAny).length;
            const mdCount = main.querySelectorAll(sel.asstMarkdown).length;
            if (msgCount + mdCount >= 2) return main;
          } catch {}
        }
        // Fallback: pick a container with the most message-like nodes (bounded scan).
        const candidates = [
          main,
          document.querySelector('#root'),
          document.querySelector('[role="main"]'),
          document.querySelector('main'),
          document.body,
        ].filter(Boolean);
        let best = document.body;
        let bestScore = -1;
        for (const c of candidates) {
          try {
            const msgCount = c.querySelectorAll(sel.msgAny).length;
            const mdCount = c.querySelectorAll(sel.asstMarkdown).length;
            const score = msgCount * 2 + mdCount;
            if (score > bestScore) { bestScore = score; best = c; }
          } catch {}
        }
        return best || document.body;
      } catch {
        return document.body;
      }
    }

    function contractCounts(container = null) {
      try {
        const c = container || getThreadContainer();
        if (!c) return { ok: false };
        const msgCount = c.querySelectorAll(sel.msgAny).length;
        const asstCount = c.querySelectorAll(sel.asstMarkdown).length;
        return { ok: true, msgCount, asstCount };
      } catch {
        return { ok: false };
      }
    }

    g.ACEP.providers.deepseek = g.ACEP.providers.deepseek || {};
    g.ACEP.providers.deepseek.sel = sel;
    g.ACEP.providers.deepseek.getThreadContainer = getThreadContainer;
    g.ACEP.providers.deepseek.contractCounts = contractCounts;

    try { document.documentElement.setAttribute('data-acep-loaded-deepseek-contract', '1'); } catch {}
  } catch {}
})();
