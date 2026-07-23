/**
 * Grok artifact extraction and handling
 * Platform-specific artifact functions for Grok AI
 */

(function() {
  // Safely define functions in ACEP namespace
  if (!globalThis.ACEP) globalThis.ACEP = {};
  if (!globalThis.ACEP.grok) globalThis.ACEP.grok = {};

  // Load artifact content from Grok API
  globalThis.ACEP.grok.loadArtifactsFromApi = async function loadGrokArtifactsFromApi() {
    const cards = Array.from(document.querySelectorAll('[id^="artifact_card_"]'));
    if (!cards.length) return [];
    const results = [];
    for (const card of cards) {
      try {
        const id = String(card.id || '').replace(/^artifact_card_/, '').trim();
        if (!id) continue;
        if (card.dataset?.acepArtifactText && card.dataset?.acepArtifactTitle) {
          results.push({ id, title: card.dataset.acepArtifactTitle, text: card.dataset.acepArtifactText });
          continue;
        }
        const url = `https://grok.com/rest/app-chat/artifact_content/${id}`;
        const resp = await fetch(url, { credentials: 'include' });
        if (!resp.ok) continue;
        const json = await resp.json().catch(() => null);
        const full = (json && json.fullArtifact) ? String(json.fullArtifact) : '';
        if (!full) continue;
        const m = /<xaiArtifact\b[^>]*title="([^"]*)"[^>]*contentType="([^"]*)"[^>]*>([\s\S]*?)<\/xaiArtifact>/i.exec(full);
        const title = m && m[1] ? m[1] : '';
        const body = m && m[3] ? m[3] : '';
        if (card.dataset) {
          if (title) card.dataset.acepArtifactTitle = title;
          card.dataset.acepArtifactText = body || '';
          card.dataset.acepArtifactVersion = id;
        }
        card.setAttribute('data-acep-artifact-version', id);
        if (title) card.setAttribute('data-acep-artifact-title', title);
        if (body) card.setAttribute('data-acep-artifact-text', body);
        results.push({ id, title, text: body });
      } catch {}
    }
    return results;
  };

  // Normalize Grok image URLs
  globalThis.ACEP.grok.normalizeImageUrl = function normalizeGrokImageUrl(u) {
    try {
      const url = new URL(u, ORIGIN || window.location.origin);
      if (url.hostname === 'assets.grok.com' && /\/preview-image\b/i.test(url.pathname)) {
        url.pathname = url.pathname.replace(/\/preview-image\b/i, '/content');
        return url.toString();
      }
    } catch {}
    return u;
  };

})();
