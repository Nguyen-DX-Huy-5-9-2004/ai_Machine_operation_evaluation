// Claude DOM contract: selectors + container picking.
// Goal: keep Claude extraction resilient by centralizing selectors and invariants here.
(function initClaudeContract() {
  try {
    const g = (typeof globalThis !== 'undefined') ? globalThis : window;
    if (!g.ACEP) g.ACEP = {};
    if (!g.ACEP.providers) g.ACEP.providers = {};

    const sel = {
      // Primary content container candidates. We still compute a score (below) to avoid selecting sidebar/history panes.
      threadContainerCandidates: 'main, .max-w-3xl.mx-auto.w-full, [class*="max-w-3xl" i]',
      // Turn-level wrapper that contains a single user prompt or assistant response.
      // Claude frequently nests message content; using a per-turn wrapper avoids accidentally capturing sidebar/history.
      turnRootAny: 'div.mb-1.mt-6.group, div[data-test-render-count]',
      artifactButton: '[role="button"][aria-label="Preview contents"]',
      userMessage: '[data-testid="user-message"]',
      userMessageText: '[data-testid="user-message"] p.whitespace-pre-wrap.break-words, [class*="font-user-message" i] p.whitespace-pre-wrap',
      asstMessage: '.font-claude-response, .standard-markdown, .progressive-markdown',
      // Thumbnails use Tailwind-style class tokens like `group/thumbnail` (slash must be escaped for class selectors).
      // Some Claude variants omit `data-testid="file-thumbnail"`, so we also match by class substring.
      thumbAny: '[data-testid="file-thumbnail"], .group\\/thumbnail, .group\\/thumbnail *, [class*="group/thumbnail" i], [class*="group/thumbnail" i] *',
      thumbRoot: '[data-testid="file-thumbnail"], .group\\/thumbnail, [class*="group/thumbnail" i]',
      ratingDialogAny: '#ratingDialog,[id="ratingDialog"]',
    };

    function getThreadContainer() {
      try {
        const root = document.querySelector('main') || document.body;
        const candidates = new Set();
        candidates.add(root);
        Array.from(document.querySelectorAll(sel.threadContainerCandidates)).forEach((el) => candidates.add(el));

        // If Claude changes container classnames, fall back to "who contains the most per-turn wrappers".
        const turnSel = sel.turnRootAny || 'div.mb-1.mt-6.group, div[data-test-render-count]';
        try {
          Array.from(document.querySelectorAll(turnSel)).forEach((turn) => {
            let p = turn && turn.parentElement;
            for (let i = 0; i < 6 && p; i++) {
              if (p === document.body) break;
              candidates.add(p);
              p = p.parentElement;
            }
          });
        } catch {}

        let best = root;
        let bestScore = -1;
        candidates.forEach((el) => {
          try {
            if (!el || !el.querySelectorAll) return;
            const turnCount = el.querySelectorAll(turnSel).length;
            const msgCount = el.querySelectorAll(`${sel.asstMessage}, ${sel.userMessage}`).length;
            const thumbCount = el.querySelectorAll(sel.thumbRoot).length;
            // Prefer containers that clearly look like the conversation thread.
            const score = (turnCount * 1000) + (msgCount * 10) + thumbCount;
            if (score > bestScore) { bestScore = score; best = el; }
          } catch {}
        });

        return best || root;
      } catch {
        return document.querySelector('main') || document.body;
      }
    }

    function contractCounts(container = null) {
      try {
        const c = container || getThreadContainer();
        if (!c) return { ok: false };
        const userCount = c.querySelectorAll(sel.userMessage).length;
        const asstCount = c.querySelectorAll(sel.asstMessage).length;
        const thumbCount = c.querySelectorAll(sel.thumbRoot).length;
        const artifactCount = document.querySelectorAll(sel.artifactButton).length;
        return { ok: true, userCount, asstCount, thumbCount, artifactCount };
      } catch {
        return { ok: false };
      }
    }

    g.ACEP.providers.claude = g.ACEP.providers.claude || {};
    g.ACEP.providers.claude.sel = sel;
    g.ACEP.providers.claude.getThreadContainer = getThreadContainer;
    g.ACEP.providers.claude.contractCounts = contractCounts;

    try { document.documentElement.setAttribute('data-acep-loaded-claude-contract', '1'); } catch {}
  } catch {}
})();
