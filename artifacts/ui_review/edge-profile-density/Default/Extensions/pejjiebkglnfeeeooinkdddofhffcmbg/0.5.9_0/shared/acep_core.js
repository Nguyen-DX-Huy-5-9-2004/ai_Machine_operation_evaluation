// Shared core utilities for content scripts (non-module) that are safe to run in browser context.
// Loaded before content.js so it can reference globalThis.ACEP.core.
(function initAcepCore() {
  try {
    const g = (typeof globalThis !== 'undefined') ? globalThis : window;
    if (!g.ACEP) g.ACEP = {};
    if (!g.ACEP.core) g.ACEP.core = {};

    const escapeHtml = (s = '') => String(s).replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
    const escapeAttr = (s = '') => escapeHtml(s);
    const blobToDataURL = (blob) => new Promise((res, rej) => {
      try {
        const fr = new FileReader();
        fr.onload = () => res(fr.result);
        fr.onerror = rej;
        fr.readAsDataURL(blob);
      } catch (e) {
        rej(e);
      }
    });

    const getRoleLabel = (role, provider, STATE) => {
      if (role === 'user') return STATE.messages?.role_user?.message || 'You said';
      if (role === 'assistant') {
        const base = STATE.messages?.role_assistant?.message || 'ChatGPT said';
        if (provider === 'ChatGPT') return base;
        return provider + ' said';
      }
      return '';
    };

    g.ACEP.core.dom_utilities = g.ACEP.core.dom_utilities || {};
    g.ACEP.core.dom_utilities.escapeHtml = escapeHtml;
    g.ACEP.core.dom_utilities.escapeAttr = escapeAttr;
    g.ACEP.core.dom_utilities.blobToDataURL = blobToDataURL;

    g.ACEP.core.role_utilities = g.ACEP.core.role_utilities || {};
    g.ACEP.core.role_utilities.getRoleLabel = getRoleLabel;
  } catch {};
})();