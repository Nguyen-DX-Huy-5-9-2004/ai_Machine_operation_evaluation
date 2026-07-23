import { buildHtmlWithHeader } from './html.js';

function byteSize(value = '') {
  try { return new Blob([String(value || '')]).size; } catch { return String(value || '').length; }
}

function countHtmlImages(html = '') {
  return (String(html || '').match(/<img\b/gi) || []).length;
}

function makeJsonBlob(value) {
  return new Blob([JSON.stringify(value)], { type: 'application/json;charset=utf-8' });
}

function normalizePaper(value) {
  const paper = String(value || 'A4').trim();
  const allowed = new Set(['A3', 'A4', 'A5', 'Legal', 'Letter', 'Tabloid']);
  return allowed.has(paper) ? paper : 'A4';
}

function normalizeMarginMm(value) {
  const margin = Number(value);
  const safe = Number.isFinite(margin) ? margin : 20;
  return Math.min(50, Math.max(5, Math.round(safe)));
}

function escapeHtml(value = '') {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[ch]));
}

function textSnippet(value = '', maxWords = 10) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean)
    .slice(0, maxWords)
    .join(' ');
}

function injectServerPdfToc(html = '', rows = [], adv = {}, providerLabel = '') {
  if (!adv?.toc || !Array.isArray(rows) || !rows.length || typeof DOMParser === 'undefined') return html;
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(String(html || ''), 'text/html');
    const body = doc.body;
    if (!body) return html;
    const turns = Array.from(body.querySelectorAll('.acep-turn[data-acep-role], [data-acep-role]'))
      .filter((el) => !el.hasAttribute('data-acep-export-header'));
    if (!turns.length) return html;
    turns.forEach((turn, idx) => { if (!turn.id) turn.id = `turn_${idx + 1}`; });
    const toc = doc.createElement('section');
    toc.className = 'acep-pdf-toc';
    const heading = doc.createElement('h2');
    heading.textContent = 'Table of Contents';
    toc.appendChild(heading);
    const list = doc.createElement('ol');
    rows.slice(0, turns.length).forEach((row, idx) => {
      const li = doc.createElement('li');
      const a = doc.createElement('a');
      const role = row?.role === 'assistant' ? (providerLabel || 'Assistant') : 'User';
      const snippet = textSnippet(row?.text || row?.html || '');
      a.href = `#turn_${idx + 1}`;
      a.textContent = `${role}${snippet ? ': ' + snippet : ''}`;
      li.appendChild(a);
      list.appendChild(li);
    });
    toc.appendChild(list);
    const header = body.querySelector('[data-acep-export-header]');
    if (header?.nextSibling) body.insertBefore(toc, header.nextSibling);
    else body.insertBefore(toc, body.firstChild);
    return '<!doctype html>\n' + doc.documentElement.outerHTML;
  } catch {
    return html;
  }
}

function buildServerPdfCss(adv = {}, extraCss = '') {
  const css = [];
  const isDark = String(adv?.theme || 'light') === 'dark';
  const pageBg = isDark ? '#0d0f14' : '#ffffff';
  const marginMm = normalizeMarginMm(adv?.margin);
  const bodyFontSizePx = Math.max(8, Math.min(28, Number(adv?.fontSize) || 14));
  const fontMap = {
    NotoSans: '"Noto Sans", "Segoe UI", Arial, sans-serif',
    TimesNewRoman: '"Times New Roman", Times, serif',
    Arial: 'Arial, Helvetica, sans-serif',
    Georgia: 'Georgia, serif',
    CourierNew: '"Courier New", Courier, monospace',
  };
  const bodyFontFamily = fontMap[adv?.font || 'TimesNewRoman'] || fontMap.TimesNewRoman;
  css.push(`
    @page {
      background: ${pageBg};
      margin: ${marginMm}mm;
    }
    html, body {
      margin: 0 !important;
      padding: 0 !important;
      background: ${pageBg} !important;
      font-size: ${bodyFontSizePx}px !important;
      font-family: ${bodyFontFamily} !important;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    html, body, body * {
      letter-spacing: normal !important;
      word-spacing: normal !important;
      text-align-last: auto !important;
      text-rendering: optimizeLegibility;
      font-kerning: normal;
    }
    pre, code, pre *, code * {
      letter-spacing: normal !important;
      word-spacing: normal !important;
      text-align: left !important;
      text-align-last: auto !important;
    }
    @media print {
      .branding { display: none !important; }
      .acep-citation-link,
      .acep-citation-chip,
      .acep-citation-link *,
      .acep-citation-chip *,
      .ds-markdown-cite,
      .ds-markdown-cite * {
        background: #f8fafc !important;
        color: #111827 !important;
        border-color: #cbd5e1 !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      .acep-citation-link,
      .acep-citation-chip,
      .ds-markdown-cite {
        border: 1px solid #cbd5e1 !important;
      }
      .acep-citation-link {
        text-decoration: none !important;
      }
      html, body, body * {
        letter-spacing: normal !important;
        word-spacing: normal !important;
        text-align-last: auto !important;
      }
      .acep-turn,
      .acep-turn > .acep-bubble,
      [data-acep-role],
      [data-acep-role] > * {
        break-inside: auto !important;
        page-break-inside: auto !important;
      }
      .acep-turn,
      .acep-turn > .acep-bubble {
        display: block !important;
        overflow: visible !important;
      }
      .acep-turn[data-acep-role="user"] > .acep-bubble,
      body > [data-acep-role="user"]:not(.acep-turn) {
        width: fit-content !important;
        max-width: 78% !important;
        margin-left: auto !important;
        margin-right: 0 !important;
      }
      .acep-turn img.role-icon,
      img.role-icon {
        display: inline-block !important;
        clear: none !important;
        float: none !important;
        position: static !important;
        vertical-align: middle !important;
        margin-left: 0 !important;
      }
      .acep-turn[data-acep-role="assistant"] > .acep-bubble,
      body > [data-acep-role="assistant"]:not(.acep-turn) {
        margin-left: 0 !important;
        margin-right: auto !important;
      }
      [data-acep-role] table,
      table {
        break-inside: auto !important;
        page-break-inside: auto !important;
      }
      thead { display: table-header-group; }
      tfoot { display: table-footer-group; }
      tr {
        break-inside: avoid !important;
        page-break-inside: avoid !important;
      }
      p, li, blockquote {
        orphans: 2;
        widows: 2;
      }
      h1, h2, h3, h4 {
        break-after: avoid;
        page-break-after: avoid;
      }
      figure,
      img,
      svg,
      canvas,
      .katex-display,
      .acep-chatgpt-image-gallery {
        break-inside: avoid;
        page-break-inside: avoid;
      }
      pre,
      pre code,
      .acep-generated-file-card,
      .acep-artifact,
      .acep-artifact-card,
      .acep-artifact-body,
      [data-acep-artifact],
      [data-artifact-id] {
        break-inside: auto !important;
        page-break-inside: auto !important;
        max-width: 100% !important;
        overflow: visible !important;
        white-space: pre-wrap !important;
        overflow-wrap: anywhere !important;
        word-break: break-word !important;
        box-sizing: border-box !important;
      }
      pre {
        width: 100% !important;
        min-width: 0 !important;
      }
      .acep-pdf-toc {
        break-after: page;
        page-break-after: always;
        margin: 12px 0 18px;
      }
      .acep-pdf-toc h2 { margin: 0 0 10px; }
      .acep-pdf-toc ol { margin: 0; padding-left: 1.5em; }
      .acep-pdf-toc li { margin: 4px 0; }
      .acep-pdf-toc a { color: inherit; text-decoration: none; }
    }
  `);
  if (adv?.pageBreakPerPrompt) {
    css.push(`
      @media print {
        .acep-turn { break-before: page; page-break-before: always; }
        [data-acep-export-header] + .acep-turn,
        .acep-turn:first-of-type { break-before: auto; page-break-before: auto; }
      }
    `);
  }
  if (extraCss) css.push(String(extraCss));
  css.push(`
    @media print {
      html[data-acep-server-pdf="1"] .acep-turn[data-acep-role="user"],
      html[data-acep-server-pdf="1"] body > [data-acep-role="user"]:not(.acep-turn) {
        text-align: right !important;
      }
      html[data-acep-server-pdf="1"] .acep-turn[data-acep-role="assistant"],
      html[data-acep-server-pdf="1"] body > [data-acep-role="assistant"]:not(.acep-turn) {
        text-align: left !important;
      }
      html[data-acep-server-pdf="1"] .acep-turn[data-acep-role="user"] > .acep-bubble,
      html[data-acep-server-pdf="1"] body > [data-acep-role="user"]:not(.acep-turn) {
        display: inline-block !important;
        width: auto !important;
        min-width: 0 !important;
        max-width: 78% !important;
        margin-left: auto !important;
        margin-right: 0 !important;
        text-align: left !important;
      }
      html[data-acep-server-pdf="1"] .acep-turn[data-acep-role="assistant"] > .acep-bubble,
      html[data-acep-server-pdf="1"] body > [data-acep-role="assistant"]:not(.acep-turn) {
        display: block !important;
        width: 100% !important;
        max-width: 100% !important;
        margin-left: 0 !important;
        margin-right: auto !important;
        text-align: left !important;
      }
      html[data-acep-server-pdf="1"] .acep-turn[data-acep-role="user"] > img.role-icon,
      html[data-acep-server-pdf="1"] .acep-turn[data-acep-role="user"] > .acep-role-head,
      html[data-acep-server-pdf="1"] body > [data-acep-role="user"]:not(.acep-turn) > img.role-icon {
        display: block !important;
        clear: none !important;
        float: none !important;
        margin-left: auto !important;
        margin-right: 0 !important;
        text-align: right !important;
      }
      html[data-acep-server-pdf="1"] .acep-bubble img.role-icon,
      html[data-acep-server-pdf="1"] img.role-icon {
        display: inline-block !important;
        clear: none !important;
        float: none !important;
        position: static !important;
        vertical-align: middle !important;
      }
      html[data-acep-server-pdf="1"] [data-acep-role] ul,
      html[data-acep-server-pdf="1"] .acep-bubble ul {
        list-style: disc outside !important;
        padding-left: 1.6em !important;
      }
      html[data-acep-server-pdf="1"] [data-acep-role] ol,
      html[data-acep-server-pdf="1"] .acep-bubble ol {
        list-style: decimal outside !important;
        padding-left: 1.6em !important;
      }
      html[data-acep-server-pdf="1"] [data-acep-role] li,
      html[data-acep-server-pdf="1"] .acep-bubble li {
        display: list-item !important;
      }
      html[data-acep-server-pdf="1"] [data-acep-role] ul > li::marker,
      html[data-acep-server-pdf="1"] .acep-bubble ul > li::marker { content: normal !important; }
      html[data-acep-server-pdf="1"] [data-acep-role] ul > li::before,
      html[data-acep-server-pdf="1"] .acep-bubble ul > li::before { content: none !important; display: none !important; }      html[data-acep-server-pdf="1"] pre,
      html[data-acep-server-pdf="1"] pre code,
      html[data-acep-server-pdf="1"] pre code *,
      html[data-acep-server-pdf="1"] .code-block__code,
      html[data-acep-server-pdf="1"] .code-block__code *,
      html[data-acep-server-pdf="1"] .acep-generated-file-card,
      html[data-acep-server-pdf="1"] .acep-artifact,
      html[data-acep-server-pdf="1"] .acep-artifact-card,
      html[data-acep-server-pdf="1"] .acep-artifact-body,
      html[data-acep-server-pdf="1"] [data-acep-artifact],
      html[data-acep-server-pdf="1"] [data-artifact-id] {
        max-width: 100% !important;
        min-width: 0 !important;
        width: auto !important;
        overflow: visible !important;
        white-space: pre-wrap !important;
        overflow-wrap: anywhere !important;
        word-break: break-word !important;
        break-inside: auto !important;
        page-break-inside: auto !important;
        box-sizing: border-box !important;
      }
      html[data-acep-server-pdf="1"] pre,
      html[data-acep-server-pdf="1"] .code-block__code {
        width: 100% !important;
      }
    }
  `);
  return css.join('\n');
}

async function readJsonResponse(resp) {
  const text = await resp.text().catch(() => '');
  if (!text) return {};
  try { return JSON.parse(text); } catch { return { detail: text }; }
}

function resolveApiUrl(apiBase, pathOrUrl) {
  const value = String(pathOrUrl || '').trim();
  if (!value) return '';
  if (/^https?:\/\//i.test(value)) return value;
  return `${String(apiBase || '').replace(/\/+$/, '')}/${value.replace(/^\/+/, '')}`;
}

function assertSameApiOrigin(apiBase, pathOrUrl, label = 'URL') {
  try {
    const resolved = new URL(resolveApiUrl(apiBase, pathOrUrl));
    const api = new URL(apiBase);
    if (resolved.origin !== api.origin) throw new Error(`${label} must stay on ${api.origin}`);
  } catch (err) {
    if (err?.message) throw err;
    throw new Error(`${label} is invalid`);
  }
}

export async function buildPdfRenderBundle({
  htmlProcessed = '',
  rows = [],
  adv = {},
  headerFilename = '',
  subHeading = '',
  providerKey = '',
  providerLabel = '',
  extraCss = '',
  locale = '',
} = {}) {
  const marginMm = normalizeMarginMm(adv?.margin);
  const orientation = String(adv?.orientation || 'portrait').toLowerCase();
  const pdfHtml = await buildHtmlWithHeader(
    htmlProcessed,
    adv || {},
    headerFilename || 'AI Conversation',
    subHeading || headerFilename || 'AI Conversation',
    {
      extraCss: buildServerPdfCss(adv, extraCss),
      providerKey,
      inlineKatexFonts: true,
    }
  );
  let finalPdfHtml = injectServerPdfToc(pdfHtml, rows, adv, providerLabel);
  try {
    finalPdfHtml = String(finalPdfHtml || '').replace(/<html(\s|>)/i, '<html data-acep-server-pdf="1"$1');
  } catch {}
  const brandingEnabled = !adv?.removeBranding;
  const pageNumbersEnabled = !adv?.removePageNumbers;
  const footerEnabled = brandingEnabled || pageNumbersEnabled;
  const footerFontSize = Math.max(10, Math.min(12, Math.round((Number(adv?.fontSize) || 14) * 0.78)));
  const isDarkFooter = String(adv?.theme || 'light') === 'dark';
  const footerBg = isDarkFooter ? '#0d0f14' : '#ffffff';
  const footerColor = isDarkFooter ? '#ffffff' : '#6b7280';
  const footerLinkColor = isDarkFooter ? '#60a5fa' : '#2563eb';
  const footerBottomMm = footerEnabled ? 12 : 0;

  return {
    schema_version: 1,
    kind: 'acep_pdf_render_bundle',
    request: {
      format: 'pdf',
      provider: providerKey || '',
      provider_label: providerLabel || '',
      theme: adv?.theme || 'light',
      font: adv?.font || 'TimesNewRoman',
      font_size: Number(adv?.fontSize) || 14,
      locale: locale || '',
      created_at: new Date().toISOString(),
    },
    document: {
      title: headerFilename || 'AI Conversation',
      subtitle: subHeading || '',
      html: finalPdfHtml,
      is_full_document: true,
      dir: 'auto',
    },
    render: {
      paper: normalizePaper(adv?.pageFormat),
      landscape: orientation === 'landscape',
      print_background: true,
      margin: {
        top: `${marginMm}mm`,
        right: `${marginMm}mm`,
        bottom: `${footerBottomMm}mm`,
        left: `${marginMm}mm`,
      },
      content_margin: {
        top: '0mm',
        right: '0mm',
        bottom: '0mm',
        left: '0mm',
      },
      prefer_css_page_size: false,
      display_header_footer: footerEnabled,
      header_template: '<div></div>',
      footer_template: `
        <div style="width:100%;min-height:12mm;background:${footerBg};font-size:${footerFontSize}px;color:${footerColor};padding:0 ${marginMm}mm;font-family:Arial,sans-serif;box-sizing:border-box;display:flex;align-items:flex-end;justify-content:space-between;-webkit-print-color-adjust:exact;print-color-adjust:exact;">
          <span style="line-height:1;">${brandingEnabled ? `Powered by: <a href="https://chatexport.workpent.com/" style="color:${footerLinkColor};text-decoration:none;">AIChatExporterPro</a>` : ''}</span>
          <span style="line-height:1;">${pageNumbersEnabled ? `<span class="pageNumber"></span> / <span class="totalPages"></span>` : ''}</span>
        </div>
      `,
    },
    assets: {
      protected_images_embedded: true,
      public_urls_allowed: true,
      fonts: ['Noto Sans', 'Noto Sans Symbols', 'Noto Color Emoji'],
      math: 'katex',
    },
    limits: {
      source_bytes: byteSize(finalPdfHtml),
      turn_count: Array.isArray(rows) ? rows.length : 0,
      image_count: countHtmlImages(finalPdfHtml),
    },
  };
}

export async function createServerPdfJob({
  apiBase,
  bundle,
  filename = 'export.pdf',
  installId = '',
  authHeaders = null,
  signal = null,
  onProgress = null,
} = {}) {
  if (!apiBase) throw new Error('PDF API base missing');
  if (!bundle) throw new Error('PDF render bundle missing');

  const bundleBlob = makeJsonBlob(bundle);
  const directLimit = 4_000_000;
  const postJson = async (path, body) => {
    const bodyText = JSON.stringify(body || {});
    const signed = (typeof authHeaders === 'function') ? await authHeaders('POST', path, bodyText) : {};
    const headers = {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(installId ? { 'X-Install-Id': installId } : {}),
      ...(signed || {}),
    };
    const resp = await fetch(resolveApiUrl(apiBase, path), {
      method: 'POST',
      headers,
      body: bodyText,
      signal,
      referrerPolicy: 'no-referrer',
    });
    const json = await readJsonResponse(resp);
    if (!resp.ok) throw new Error(json?.detail || json?.code || `PDF API failed (${resp.status})`);
    return json;
  };

  let job;
  if (bundleBlob.size <= directLimit) {
    onProgress?.('submitting');
    job = await postJson('/v1/pdf/jobs', {
      filename,
      mode: 'direct',
      estimated_size: bundleBlob.size,
      content_type: 'application/json',
      bundle,
    });
  } else {
    onProgress?.('submitting');
    job = await postJson('/v1/pdf/jobs', {
      filename,
      mode: 'upload',
      estimated_size: bundleBlob.size,
      content_type: 'application/json',
    });
    if (!job?.upload_url || !job?.job_id) throw new Error('PDF API did not return an upload URL');
    assertSameApiOrigin(apiBase, job.upload_url, 'PDF upload URL');
    onProgress?.('uploading');
    const uploadHeaders = (typeof authHeaders === 'function') ? await authHeaders(job.method || 'PUT', job.upload_url, bundleBlob) : {};
    const uploadResp = await fetch(resolveApiUrl(apiBase, job.upload_url), {
      method: job.method || 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...(installId ? { 'X-Install-Id': installId } : {}),
        ...(uploadHeaders || {}),
      },
      body: bundleBlob,
      signal,
      referrerPolicy: 'no-referrer',
    });
    const uploadJson = await readJsonResponse(uploadResp);
    if (!uploadResp.ok) throw new Error(uploadJson?.detail || uploadJson?.code || `PDF upload failed (${uploadResp.status})`);
    onProgress?.('starting');
    const startPath = job?.start_url || `/v1/pdf/jobs/${encodeURIComponent(job.job_id)}/start`;
    assertSameApiOrigin(apiBase, startPath, 'PDF start URL');
    job = await postJson(startPath, { filename });
  }

  return job;
}

export async function pollServerPdfJob({
  apiBase,
  job,
  installId = '',
  authHeaders = null,
  signal = null,
  timeoutMs = 360000,
  onProgress = null,
} = {}) {
  const jobId = job?.job_id || job?.id;
  if (!apiBase || !jobId) throw new Error('PDF job missing');
  const started = Date.now();
  const statusUrl = job?.status_url || `/v1/pdf/jobs/${encodeURIComponent(jobId)}`;
  assertSameApiOrigin(apiBase, statusUrl, 'PDF status URL');

  while (Date.now() - started < timeoutMs) {
    onProgress?.('rendering');
    const signed = (typeof authHeaders === 'function') ? await authHeaders('GET', statusUrl, '') : {};
    const resp = await fetch(resolveApiUrl(apiBase, statusUrl), {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        ...(installId ? { 'X-Install-Id': installId } : {}),
        ...(signed || {}),
      },
      signal,
      referrerPolicy: 'no-referrer',
    });
    const json = await readJsonResponse(resp);
    if (!resp.ok) throw new Error(json?.detail || json?.code || `PDF status failed (${resp.status})`);
    if (json.status === 'succeeded' || json.ok === true && json.download_url) return json;
    if (json.status === 'failed') throw new Error(json.error || 'PDF render failed');
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }
  throw new Error('PDF render timed out');
}

export async function downloadServerPdfJob({
  apiBase,
  job,
  installId = '',
  authHeaders = null,
  signal = null,
} = {}) {
  const jobId = job?.job_id || job?.id;
  const url = job?.download_url || job?.url || (jobId ? `/v1/pdf/jobs/${encodeURIComponent(jobId)}/download` : '');
  if (!apiBase || !url) throw new Error('PDF download URL missing');
  assertSameApiOrigin(apiBase, url, 'PDF download URL');
  const signed = (typeof authHeaders === 'function') ? await authHeaders('GET', url, '') : {};
  const resp = await fetch(resolveApiUrl(apiBase, url), {
    method: 'GET',
    headers: {
      Accept: 'application/pdf',
      ...(installId ? { 'X-Install-Id': installId } : {}),
      ...(signed || {}),
    },
    signal,
    referrerPolicy: 'no-referrer',
  });
  if (!resp.ok) {
    const json = await readJsonResponse(resp);
    throw new Error(json?.detail || json?.code || `PDF download failed (${resp.status})`);
  }
  return await resp.blob();
}

export function getServerPdfDownloadUrl({
  apiBase,
  job,
} = {}) {
  const jobId = job?.job_id || job?.id;
  const url = job?.download_url || job?.url || (jobId ? `/v1/pdf/jobs/${encodeURIComponent(jobId)}/download` : '');
  if (!apiBase || !url) return '';
  assertSameApiOrigin(apiBase, url, 'PDF download URL');
  return resolveApiUrl(apiBase, url);
}
