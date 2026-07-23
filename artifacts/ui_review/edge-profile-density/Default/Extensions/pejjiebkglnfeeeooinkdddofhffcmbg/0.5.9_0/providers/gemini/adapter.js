/**
 * Gemini Provider Adapter - All Gemini-specific logic (gemini.google.com)
 * Handles: user-query & response-container selectors, user image detection, protected fetch
 */

import { BaseProviderAdapter } from '../shared/base-adapter.js';

export default class GeminiAdapter extends BaseProviderAdapter {
  constructor() {
    super('gemini', [/gemini\.google\.com$/i]);
  }

  // ===== CONTENT.JS INTERFACE =====

  extractTurnNodes(scope = document) {
    if (!scope) return [];

    const turns = [];

    // Gemini: user queries
    const userQueries = this.queryAll('div[class*="user-query" i], [data-testid*="user" i]', scope);
    userQueries.forEach(el => {
      if (el && el.closest && !turns.includes(el)) turns.push(el);
    });

    // Gemini: assistant responses
    const responses = this.queryAll('.response-container, [class*="response" i], [role="article"]', scope);
    responses.forEach(el => {
      if (el && el.closest && !turns.includes(el)) {
        // Skip non-message responses
        if (el.querySelector('.markdown, [data-message-author-role], article, figure img')) {
          turns.push(el);
        }
      }
    });

    return turns;
  }

  getChatTitle() {
    // Gemini: title in header
    const h = this.query('header h1, [data-testid*="title" i]');
    const t = h?.textContent?.trim() || document.title?.trim() || 'Gemini Conversation';
    return t.replace(/\s+/g, ' ').slice(0, 140);
  }

  getRoleFromTurn(turnEl) {
    const preset = this.getAttr(turnEl, 'data-acep-role');
    if (preset) return preset;

    // Gemini: user queries have specific class
    if (this.matches(turnEl, '[class*="user-query" i], [data-testid*="user" i]')) {
      return 'user';
    }

    // Gemini: responses are assistant
    if (this.matches(turnEl, '.response-container, [class*="response" i]')) {
      return 'assistant';
    }

    const attr = turnEl.getAttribute('data-message-author-role');
    if (attr) return attr;

    if (turnEl.querySelector('[data-message-author-role="user"]')) return 'user';
    if (turnEl.querySelector('[data-message-author-role="assistant"]')) return 'assistant';

    return turnEl.querySelector('.markdown') ? 'assistant' : 'user';
  }

  getInnerHTMLFromTurn(turnEl) {
    if (!turnEl) return '';

    const md = turnEl.querySelector('.markdown');
    if (md) return md.innerHTML;

    const article = turnEl.querySelector('article');
    if (article) return article.innerHTML;

    return turnEl.innerHTML || '';
  }

  getImagesFromTurn(turnEl) {
    if (!turnEl) return [];

    const seen = new Set();
    const out = [];

    // Gemini: user message images often have direct SRC attributes
    const isGeminiUser = this.matches(turnEl, '[class*="user-query" i], [data-testid*="user" i]');

    const imgs = this.queryAll('img', turnEl);
    for (const img of imgs) {
      if (img.closest('nav, header, footer, [data-testid="composer"]')) continue;

      let srcRaw = (img.currentSrc || img.src || '').trim();
      if (!srcRaw) continue;

      // Skip Google branding/favicons
      if (/google\.com\/s2\/favicons/i.test(srcRaw)) continue;
      if (/gstatic\.com\/images\/branding\/productlogos/.test(srcRaw)) continue;
      if (/i\.ytimg\.com\//.test(srcRaw)) continue;

      const key = srcRaw;
      if (seen.has(key)) continue;
      seen.add(key);

      out.push({
        src: srcRaw,
        alt: this.getAttr(img, 'alt'),
        originalSrc: srcRaw,
        pngDataUrl: '',
        dataUrl: '',
      });
    }

    return out;
  }

  getImageCaptionFromTurn(turnEl) {
    // Default: no caption
    return '';
  }

  hasImages(turnEl) {
    if (!turnEl) return false;
    return this.queryAll('img', turnEl).length > 0;
  }

  // ===== POPUP.JS INTERFACE =====

  formatRowsForExport(rows) {
    if (!Array.isArray(rows)) return rows;
    // Default formatting is fine for Gemini
    return rows;
  }

  // ===== IMAGE HANDLING =====

  isProtectedAsset(url) {
    if (!url) return false;
    return /googleusercontent\.com|lh3\.google\.com|lh3\.googleusercontent\.com|gstatic\.com/.test(url);
  }

  getImageFetchCredentials() {
    return {
      credentials: 'include', // Google endpoints need cookies
      origin: 'https://gemini.google.com',
    };
  }
}
