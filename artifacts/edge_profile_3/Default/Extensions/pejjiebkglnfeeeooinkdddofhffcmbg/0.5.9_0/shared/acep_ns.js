// Shared namespace for content scripts (classic scripts; no ES modules).
// Loaded before any provider/core scripts via manifest `content_scripts[].js` order.
(function initAcepNamespace() {
  try {
    const g = (typeof globalThis !== 'undefined') ? globalThis : window;
    if (!g.ACEP) g.ACEP = {};
    if (!g.ACEP.providers) g.ACEP.providers = {};
    if (!g.ACEP.shared) g.ACEP.shared = {};
    try { document.documentElement.setAttribute('data-acep-loaded-ns', '1'); } catch {}
  } catch {}
})();
