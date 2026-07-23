import {
  extractAsciiTableFromText,
  htmlToPlainTextLocal,
  parseHtmlBlocksForDocx,
} from '../html_blocks.js';
import { ensureKatexLib } from '../loaders.js';

let mml2ommlFnCache = undefined;

function runtimeGetUrl(path) {
  const getURL =
    globalThis?.browser?.runtime?.getURL ||
    globalThis?.chrome?.runtime?.getURL;
  if (typeof getURL !== 'function') throw new Error('runtime.getURL not available');
  return getURL.call(globalThis.browser?.runtime || globalThis.chrome?.runtime, path);
}

async function loadMathml2OmmlFn() {
  if (mml2ommlFnCache !== undefined) return mml2ommlFnCache;
  try {
    const mod = await import(runtimeGetUrl('libs/mathml2omml.js'));
    const fn = mod?.mml2omml || mod?.default;
    mml2ommlFnCache = (typeof fn === 'function') ? fn : null;
    return mml2ommlFnCache;
  } catch {
    mml2ommlFnCache = null;
    return null;
  }
}

function sanitizeMathML(mathml = '') {
  try {
    // HTML entities like &nbsp; are valid HTML but not valid XML — replace them with
    // numeric references before parsing as 'application/xml', otherwise DOMParser
    // returns a parsererror and the entire math block falls back to raw TeX text.
    const htmlEntityMap = {
      '&nbsp;': '&#160;', '&ndash;': '&#8211;', '&mdash;': '&#8212;',
      '&hellip;': '&#8230;', '&laquo;': '&#171;', '&raquo;': '&#187;',
      '&ldquo;': '&#8220;', '&rdquo;': '&#8221;', '&lsquo;': '&#8216;', '&rsquo;': '&#8217;',
      '&bull;': '&#8226;', '&middot;': '&#183;', '&times;': '&#215;', '&divide;': '&#247;',
      '&plusmn;': '&#177;', '&infin;': '&#8734;', '&prime;': '&#8242;', '&Prime;': '&#8243;',
    };
    let s = String(mathml || '').trim();
    if (!s) return '';
    s = s.replace(/&[a-zA-Z]+;/g, (m) => htmlEntityMap[m] || m);
    const parser = new DOMParser();
    const doc = parser.parseFromString(s, 'application/xml');
    if (doc.querySelector('parsererror')) return '';
    doc.querySelectorAll('annotation, annotation-xml').forEach((n) => n.remove());
    doc.querySelectorAll('semantics').forEach((sem) => {
      const keep = Array.from(sem.childNodes).find((n) => n.nodeType === 1);
      if (keep) sem.replaceWith(keep);
      else sem.remove();
    });
    const root = doc.querySelector('math') || doc.documentElement;
    return root ? new XMLSerializer().serializeToString(root) : '';
  } catch {
    return '';
  }
}

async function mathmlToOmml(mathml = '') {
  const fn = await loadMathml2OmmlFn();
  if (!fn) return '';
  try {
    const cleaned = sanitizeMathML(extractFirstMathTag(mathml) || mathml);
    if (!cleaned || !/<math[\s>]/i.test(cleaned)) return '';
    const out = fn(cleaned);
    if (typeof out !== 'string') return '';
    if (!/<m:oMath/i.test(out)) return '';
    let normalized = out;
    const match = normalized.match(/<m:oMath[\s\S]*<\/m:oMath>/i);
    if (match) normalized = match[0];
    return normalized;
  } catch {
    return '';
  }
}

function buildDocxMathComponent(docxLib, omml = '') {
  if (!omml || !docxLib?.ImportedXmlComponent) return null;
  try {
    const mathXml = omml.match(/<m:oMath[\s\S]*?<\/m:oMath>/i)?.[0];
    if (!mathXml) return null;
    const imported = docxLib.ImportedXmlComponent.fromXmlString(mathXml);
    if (imported && Array.isArray(imported.root) && imported.root.length === 1) {
      return imported.root[0];
    }
    return imported || null;
  } catch {
    return null;
  }
}

function stripTexWrappers(tex = '') {
  const s = String(tex || '').trim();
  if (!s) return '';
  if (s.startsWith('$$') && s.endsWith('$$')) return s.slice(2, -2).trim();
  if (s.startsWith('$') && s.endsWith('$')) return s.slice(1, -1).trim();
  return s;
}

function extractTexFromMathml(mathml = '') {
  const m = String(mathml || '').match(/<annotation[^>]+encoding=(["'])application\/x-tex\1[^>]*>([\s\S]*?)<\/annotation>/i);
  if (!m) return '';
  const raw = String(m[2] || '').trim();
  if (!raw) return '';
  try {
    const t = document.createElement('textarea');
    t.innerHTML = raw;
    return (t.value || raw).trim();
  } catch {
    return raw;
  }
}

function extractFirstMathTag(markup = '') {
  const s = String(markup || '').trim();
  if (!s) return '';
  if (/^<math[\s>]/i.test(s)) return s;
  if (!/<math[\s>]/i.test(s)) return '';
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(s, 'text/html');
    const math = doc.querySelector('math');
    return math ? math.outerHTML : '';
  } catch {
    const m = s.match(/<math[\s\S]*?<\/math>/i);
    return m ? m[0] : '';
  }
}

async function svgDataUrlToPng(svgDataUrl = '') {
  try {
    const s = String(svgDataUrl || '').trim();
    if (!s || !/^data:image\/svg/i.test(s)) return '';
    const svgText = s.startsWith('data:image/svg+xml;base64,')
      ? atob(s.slice('data:image/svg+xml;base64,'.length))
      : decodeURIComponent(s.replace(/^data:image\/svg\+xml[^,]*,/, ''));
    const blob = new Blob([svgText], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
      img.src = url;
    });
    URL.revokeObjectURL(url);

    const parseViewBox = () => {
      try {
        const rootAttrs = String(svgText.match(/<svg\b([^>]*)>/i)?.[1] || '');
        const m = rootAttrs.match(/(?:^|\s)viewBox=["']([^"']+)["']/i);
        if (!m) return null;
        const nums = String(m[1] || '').trim().split(/[\s,]+/).map(Number).filter(Number.isFinite);
        if (nums.length >= 4 && nums[2] > 0 && nums[3] > 0) return { width: nums[2], height: nums[3] };
      } catch {}
      return null;
    };
    const naturalW = Number(img.naturalWidth || img.width || 0);
    const naturalH = Number(img.naturalHeight || img.height || 0);
    const vb = parseViewBox();
    const baseW = naturalW || vb?.width || 1200;
    const baseH = naturalH || vb?.height || 800;
    const scale = Math.max(2, Math.min(4, 2200 / Math.max(1, Math.max(baseW, baseH))));
    const w = Math.max(1, Math.round(baseW * scale));
    const h = Math.max(1, Math.round(baseH * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';
    ctx.clearRect(0, 0, w, h);
    ctx.imageSmoothingEnabled = true;
    try { ctx.imageSmoothingQuality = 'high'; } catch {}
    ctx.drawImage(img, 0, 0, w, h);
    return canvas.toDataURL('image/png');
  } catch {
    return '';
  }
}
function dataUrlToUint8Array(dataUrl = '') {
  try {
    const s = String(dataUrl || '');
    const idx = s.indexOf(',');
    if (idx < 0) return new Uint8Array();
    const b64 = s.slice(idx + 1);
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
  } catch {
    return new Uint8Array();
  }
}

async function measureDataUrlDimensions(dataUrl = '') {
  try {
    const s = String(dataUrl || '').trim();
    if (!s || !/^data:image\//i.test(s)) return null;
    const img = new Image();
    const loaded = new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
    });
    img.src = s;
    await loaded;
    const width = Number(img.naturalWidth || img.width || 0);
    const height = Number(img.naturalHeight || img.height || 0);
    if (!width || !height) return null;
    return { width, height };
  } catch {
    return null;
  }
}


function imageDedupeKey(meta = {}, dataUrl = '') {
  const srcKey = String(meta?.originalSrc || meta?.src || '').split('#')[0].trim();
  if (srcKey) return srcKey;
  const data = String(dataUrl || '');
  if (!data) return '';
  return 'data:' + data.length + ':' + data.slice(0, 160) + ':' + data.slice(-160);
}

function normalizeDimensions(width, height, maxWidth = 480, maxHeight = 0) {
  const safeWidth = width && Number.isFinite(width) && width > 0 ? width : maxWidth;
  const safeHeight = height && Number.isFinite(height) && height > 0 ? height : Math.round(safeWidth * 0.6);
  const targetWidth = Math.max(1, maxWidth);
  const ratio = safeWidth ? targetWidth / safeWidth : 1;
  let targetHeight = Math.max(1, Math.round(safeHeight * ratio));
  if (maxHeight && Number.isFinite(maxHeight) && maxHeight > 0 && targetHeight > maxHeight) {
    const r2 = maxHeight / targetHeight;
    return { width: Math.max(1, Math.round(targetWidth * r2)), height: Math.max(1, Math.round(targetHeight * r2)) };
  }
  return { width: targetWidth, height: targetHeight };
}

export async function buildDocxParagraphsForRow(docxLib, row, {
  isUser,
  isDark,
  galleryTile,
  docFont,
  docSize,
  tabId = null,
  imagesOnly = false,
  providerLabel = '',
  fetchDataUrlStrong = null,
  suppressHeading = false,
} = {}) {
  // NOTE: This implementation was extracted from `popup.js` to keep DOCX export logic centralized.
  // Keep it provider-agnostic; provider-specific tweaks should be supplied via provider hooks.
  const {
    Paragraph,
    TextRun,
    ImageRun,
    Table,
    TableRow,
    TableCell,
    WidthType,
    AlignmentType,
    ShadingType,
    BorderStyle,
    VerticalAlign,
  } = docxLib || {};

  const providerKey = String(providerLabel || '').toLowerCase().trim();
  const providerObj = providerKey ? (globalThis.ACEP?.providers?.[providerKey] || null) : null;
  const providerExport = providerObj?.export || null;
  const cleanPlainText = (txt = '') => {
    let out = String(txt || '');
    try {
      if (providerObj && typeof providerObj.cleanPlainText === 'function') {
        const next = providerObj.cleanPlainText(out, { row, format: 'docx' });
        if (typeof next === 'string') out = next;
      }
    } catch {}
    return out;
  };

  const roleLabel = isUser ? 'User' : (row?.roleLabel || (providerLabel || 'Assistant'));
  const roleIcon = isUser ? (row?.iconUserDataUrl || '') : (row?.iconAssistantDataUrl || '');
  const heading = roleLabel;

  const asColor = (hex = '') => String(hex || '').replace(/^#/, '').toUpperCase();
  const docColor = isDark ? 'FFFFFF' : '000000';
  const bubbleFill = isDark ? '111827' : 'F3F4F6';
  const codeFill = isDark ? '1F2937' : 'F3F4F6';
  const paragraphAlign = AlignmentType ? AlignmentType.LEFT : undefined;
  const indent = isUser ? { left: 1152, right: 0 } : undefined;

  const usedImageKeys = new Set();

  const decodeHtmlEntitiesLocal = (s = '') => {
    if (!s || !String(s).includes('&')) return s;
    try {
      const t = document.createElement('textarea');
      t.innerHTML = s;
      return t.value || s;
    } catch {
      return s;
    }
  };

  const rawForDocx = row.rawHtml || row.html || '';
  let htmlForDocx = (row.html && /<(b|strong|em|i|u|a)\b/i.test(row.html))
    ? row.html
    : rawForDocx;

  const escapeHtmlForDocx = (s = '') =>
    String(s || '').replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));

  // Convert attachment markers into visible lines for DOCX.
  const hasAttachmentMarkersForDocx = /data-acep-attachment-name=/i.test(htmlForDocx || '');
  if (hasAttachmentMarkersForDocx) {
    try {
      htmlForDocx = htmlForDocx.replace(
        /<div\b[^>]*\bdata-acep-attachment-name\s*=\s*(["'])(.*?)\1[^>]*>\s*<\/div>/gi,
        (_m, _q, name) => `<p>[Attachment]: ${escapeHtmlForDocx(String(name || '').trim())}</p>`
      );
    } catch {}
  }

  // If HTML looks entity-encoded, decode before parsing so tags like <b>/<a> are preserved.
  if (htmlForDocx && !/<[a-z][\s\S]*>/i.test(htmlForDocx) && /&lt;[a-z]/i.test(htmlForDocx)) {
    htmlForDocx = decodeHtmlEntitiesLocal(htmlForDocx);
  }

  try {
    if (providerExport && typeof providerExport.normalizeHtmlForExport === 'function') {
      const next = providerExport.normalizeHtmlForExport(htmlForDocx, { format: 'docx', row, providerKey });
      if (typeof next === 'string') htmlForDocx = next;
    }
  } catch {}

  let blocks = parseHtmlBlocksForDocx(htmlForDocx, { allowAsciiTables: true }) || [];

  if (imagesOnly) {
    try {
      const isAttachmentLine = (s = '') => /^\s*\[Attachment\]\s*:\s*/i.test(String(s || '').trim());
      blocks = (blocks || []).filter((b) => {
        if (!b) return false;
        if (b.type === 'image') return !!b.src;
        if (b.type === 'text') return isAttachmentLine(b.text || '');
        if (b.type === 'runs' && Array.isArray(b.runs)) {
          const txt = b.runs.map(r => r?.text || '').join('');
          return isAttachmentLine(txt);
        }
        return false;
      });
    } catch {}
  }

  // ASCII box tables sometimes arrive as plain text; upgrade them to structured tables.
  if (!blocks.some((b) => b && b.type === 'table')) {
    const plain = htmlToPlainTextLocal(htmlForDocx || row.html || '');
    if (/[\u250c\u252c\u2510\u2514\u2534\u2518\u251c\u253c\u2524\u2502\u2500]/.test(plain)) {
      const result = extractAsciiTableFromText(plain);
      if (result && result.table) {
        blocks.length = 0;
        if (result.prefix) blocks.push({ type: 'text', text: result.prefix });
        blocks.push({ type: 'table', ...result.table });
        if (result.suffix) blocks.push({ type: 'text', text: result.suffix });
      }
    }
  }

  // Images from row metadata (already embedded where possible by the main export flow).
  const isUploadedImageMeta = (meta) => {
    try {
      return !!(meta?.acepUpload || /uploaded image|image\.png|file\/preview/i.test(String(meta?.alt || '') + ' ' + String(meta?.src || meta?.originalSrc || '')));
    } catch {
      return false;
    }
  };

  const rowRealImagesForDocx = (() => {
    try {
      const list = Array.isArray(row?.imgs) ? row.imgs : [];
      return list.filter((im) => {
        if (!im) return false;
        const s = String(im.dataUrl || im.pngDataUrl || im.originalSrc || im.src || '').trim();
        return !!s;
      });
    } catch {
      return [];
    }
  })();
  let rowImageCursorForDocx = 0;
  const renderedImageKeysForDocx = new Set();
  const imageSourceKeyForDocx = (meta = {}) => String(meta?.originalSrc || meta?.src || meta?.dataUrl || meta?.pngDataUrl || '').split('#')[0].trim();

  const toDataUrl = async (meta) => {
    const raw = String(meta?.dataUrl || meta?.pngDataUrl || '').trim();
    if (raw && /^data:image\//i.test(raw)) {
      if (/^data:image\/svg/i.test(raw)) return await svgDataUrlToPng(raw) || '';
      return raw;
    }
    const fallback = String(meta?.originalSrc || meta?.src || '').trim();
    if (fallback && /^data:image\//i.test(fallback)) {
      if (/^data:image\/svg/i.test(fallback)) return await svgDataUrlToPng(fallback) || '';
      return fallback;
    }
    if (typeof fetchDataUrlStrong === 'function' && fallback) {
      try {
        const fetched = await fetchDataUrlStrong(fallback, tabId);
        if (fetched && /^data:image\//i.test(fetched)) {
          if (/^data:image\/svg/i.test(fetched)) return await svgDataUrlToPng(fetched) || '';
          return fetched;
        }
      } catch {}
    }
    return '';
  };

  const paras = [];
  let lastInlineParagraph = null;
  let lastInlineGroup = null;

  const resetInline = () => {
    lastInlineParagraph = null;
    lastInlineGroup = null;
  };

  const appendToParagraph = (p, child) => {
    if (!p || !child) return false;
    try {
      if (!p.options) p.options = {};
      if (!Array.isArray(p.options.children)) p.options.children = [];
      p.options.children.push(child);
      return true;
    } catch {
      return false;
    }
  };

  const buildTextRuns = (text, { bold = false, italics = false, underline = false } = {}) => {
    const s = String(text || '').replace(/\u00a0/g, ' ');
    const parts = s.split('\n');
    const out = [];
    parts.forEach((part, idx) => {
      if (idx > 0) out.push(new TextRun({ text: '', break: 1 }));
      out.push(new TextRun({
        text: part,
        bold,
        italics,
        underline: underline ? {} : undefined,
        font: docFont,
        size: docSize,
        color: docColor,
      }));
    });
    return out;
  };

  const buildChildrenFromInlineRuns = (runs = []) => {
    const out = [];
    (runs || []).forEach((r, idx) => {
      if (!r) return;
      const text = String(r.text || '').replace(/\u00a0/g, ' ');
      if (!text) return;
      const link = r.link ? String(r.link || '').trim() : '';
      const isCode = !!r.code;
      const parts = text.split('\n');
      parts.forEach((part, pIdx) => {
        if (pIdx > 0) out.push(new TextRun({ text: '', break: 1 }));
        // Inline code: avoid injecting padding spaces, which can create odd per-line "padding" when a run breaks.
        const codePad = isCode ? String(part) : part;
        const baseRun = new TextRun({
          text: codePad,
          bold: !!r.bold,
          italics: !!r.italics,
          underline: r.underline ? {} : undefined,
          font: isCode ? 'Consolas' : docFont,
          size: docSize,
          color: link ? (String(r.color || '') || '2563EB') : docColor,
          ...(isCode && !link ? { shading: { type: ShadingType?.CLEAR, color: docColor, fill: codeFill } } : {}),
        });
        if (link && docxLib?.ExternalHyperlink) {
          out.push(new docxLib.ExternalHyperlink({
            link,
            children: [baseRun],
          }));
        } else {
          out.push(baseRun);
        }
      });
    });
    return out;
  };

  const createInlineParagraph = (groupId = null, { alignmentOverride } = {}) => {
    const p = new Paragraph({
      alignment: alignmentOverride ?? paragraphAlign,
      indent,
      spacing: { after: 160 },
      shading: isUser ? { type: ShadingType?.CLEAR, color: docColor, fill: bubbleFill } : undefined,
      children: [],
    });
    paras.push(p);
    lastInlineParagraph = p;
    lastInlineGroup = groupId || null;
    return p;
  };

  // Header line (role) — suppressed when popup.js already added an icon header
  if (!suppressHeading) {
    try {
      paras.push(new Paragraph({
        alignment: paragraphAlign,
        indent,
        spacing: { before: 180, after: 120 },
        children: [
          new TextRun({ text: heading, bold: true, font: docFont, size: Math.max(18, docSize + 4), color: docColor }),
        ],
      }));
    } catch {}
  }

  const pushTextParagraph = (text, { bold = false, italics = false, underline = false, link = '' } = {}) => {
    const raw = String(text || '').replace(/\u00a0/g, ' ');
    if (!raw.trim()) return;
    // Split on double newlines so each logical paragraph gets its own DOCX paragraph with spacing.
    const parts = raw.split(/\n\n+/);
    resetInline();
    for (const part of parts) {
      const cleaned = part.replace(/\s+$/g, '');
      if (!cleaned.trim()) continue;
      try {
        const runs = buildTextRuns(cleaned, { bold, italics, underline });
        paras.push(new Paragraph({
          alignment: paragraphAlign,
          indent,
          spacing: { after: 160 },
          shading: isUser ? { type: ShadingType?.CLEAR, color: docColor, fill: bubbleFill } : undefined,
          children: runs,
        }));
      } catch {}
    }
  };

  const pushCodeParagraph = (code) => {
    const cleaned = String(code || '').replace(/\u00a0/g, ' ').replace(/\r?\n/g, '\n').trimEnd();
    if (!cleaned.trim()) return;
    try {
      resetInline();
      const codeLines = cleaned.split('\n');
      const codeRuns = [];
      const preserveIndent = (line = '') => {
        const s = String(line || '').replace(/\t/g, '    ');
        const m = s.match(/^\s+/);
        if (!m) return s;
        const lead = m[0].replace(/ /g, '\u00A0');
        return lead + s.slice(m[0].length);
      };
      codeLines.forEach((line, i) => {
        if (i > 0) codeRuns.push(new TextRun({ text: '', break: 1 }));
        codeRuns.push(new TextRun({ text: preserveIndent(line), font: 'Consolas', size: docSize, color: docColor }));
      });
      // Render code blocks in a 1-cell table to get consistent "padding" regardless of line breaks.
      // (Paragraph shading doesn't provide real padding; Word will visually shift lines based on run breaks.)
      // DOCX does not support true border-radius. Use a soft bordered box with generous
      // padding to approximate the HTML "rounded code bubble" feel.
      const borderColor = isDark ? '374151' : 'E5E7EB';
      const borders = { 
        top: { style: BorderStyle?.SINGLE, size: 2, color: borderColor }, 
        bottom: { style: BorderStyle?.SINGLE, size: 2, color: borderColor }, 
        left: { style: BorderStyle?.SINGLE, size: 2, color: borderColor }, 
        right: { style: BorderStyle?.SINGLE, size: 2, color: borderColor }, 
      }; 
      paras.push(new Table({
        width: { size: 100, type: WidthType?.PERCENTAGE },
        rows: [
          new TableRow({
            children: [
              new TableCell({
                verticalAlign: VerticalAlign?.TOP,
                shading: { type: ShadingType?.CLEAR, color: docColor, fill: codeFill },
                borders,
                // cell margins are in twips; ~8px ≈ 120 twips
                margins: { top: 180, bottom: 180, left: 220, right: 220 }, 
                children: [
                  new Paragraph({
                    spacing: { before: 0, after: 0 },
                    children: codeRuns,
                  }),
                ],
              }),
            ],
          }),
        ],
      }));
      paras.push(new Paragraph({ text: '' }));
    } catch {}
  };

  const pushMathParagraph = async (b) => {
    try {
      let mathml = String(b?.mathml || '').trim();
      if (!mathml && b?.tex) {
        try {
          const katex = await ensureKatexLib();
          const rendered = String(katex.renderToString(stripTexWrappers(b.tex), { throwOnError: false, displayMode: !!b.display, output: 'mathml', strict: 'ignore' }) || '');
          mathml = extractFirstMathTag(rendered) || '';
        } catch {}
      }
      const omml = mathml ? await mathmlToOmml(mathml) : '';
      const mathComp = omml ? buildDocxMathComponent(docxLib, omml) : null;
      if (!mathComp) {
        const fallback = stripTexWrappers(b?.tex || '') || extractTexFromMathml(mathml);
        if (fallback) pushTextParagraph(fallback);
        return;
      }
      resetInline();
      paras.push(new Paragraph({
        alignment: b?.display && AlignmentType ? AlignmentType.CENTER : paragraphAlign,
        indent,
        spacing: { after: 160 },
        shading: isUser ? { type: ShadingType?.CLEAR, color: docColor, fill: bubbleFill } : undefined,
        children: [mathComp],
      }));
    } catch {}
  };

  const pushHrParagraph = () => {
    try {
      resetInline();
      const style = BorderStyle ? BorderStyle.SINGLE : 'single';
      paras.push(new Paragraph({
        alignment: paragraphAlign,
        indent,
        spacing: { before: 80, after: 160 },
        border: {
          bottom: { style, size: 6, color: isDark ? '374151' : 'D1D5DB' },
        },
        children: [new TextRun({ text: ' ' })],
      }));
    } catch {}
  };

  const pushImageParagraph = async (meta, { maxWidth = 480, maxHeight = 520, align = 'center' } = {}) => {
    try {
      resetInline();
      const dataUrl = await toDataUrl(meta);
      if (!dataUrl) return false;
      const isUploadedImage = isUploadedImageMeta(meta);
      const key = imageDedupeKey(meta, dataUrl);
      if (!isUploadedImage && key && usedImageKeys.has(key)) return false;
      if (!isUploadedImage && key) usedImageKeys.add(key);
      const measured = await measureDataUrlDimensions(dataUrl);
      const sourceWidth = isUploadedImage ? (meta?.w || meta?.width || maxWidth) : (meta?.w || meta?.width || measured?.width);
      const sourceHeight = isUploadedImage ? (meta?.h || meta?.height || Math.round((sourceWidth || maxWidth) * 0.65)) : (meta?.h || meta?.height || measured?.height);
      const dims = normalizeDimensions(
        sourceWidth,
        sourceHeight,
        maxWidth,
        maxHeight
      );
      const bytes = dataUrlToUint8Array(dataUrl);
      if (!bytes || !bytes.length) return false;
      const alignment = (align === 'right')
        ? (AlignmentType ? AlignmentType.RIGHT : undefined)
        : (align === 'left')
          ? (AlignmentType ? AlignmentType.LEFT : undefined)
          : (AlignmentType ? AlignmentType.CENTER : undefined);
      paras.push(new Paragraph({
        alignment,
        indent,
        spacing: { after: 160 },
        children: [new ImageRun({ data: bytes, transformation: dims })],
      }));
      return true;
    } catch {
      return false;
    }
  };

  const pushImageGalleryParagraph = async (items = [], { maxWidth = 480, maxHeight = 520, align = 'left' } = {}) => {
    try {
      resetInline();
      const prepared = [];
      for (const meta of (items || [])) {
        const dataUrl = await toDataUrl(meta);
        if (!dataUrl) continue;
        const isUploadedImage = isUploadedImageMeta(meta);
        const key = imageDedupeKey(meta, dataUrl);
        if (!isUploadedImage && key && usedImageKeys.has(key)) continue;
        const measured = await measureDataUrlDimensions(dataUrl);
        const sourceWidth = isUploadedImage ? (meta?.w || meta?.width || maxWidth) : (meta?.w || meta?.width || measured?.width);
        const sourceHeight = isUploadedImage ? (meta?.h || meta?.height || Math.round((sourceWidth || maxWidth) * 0.65)) : (meta?.h || meta?.height || measured?.height);
        const dims = normalizeDimensions(
          sourceWidth,
          sourceHeight,
          maxWidth,
          maxHeight
        );
        const bytes = dataUrlToUint8Array(dataUrl);
        if (!bytes || !bytes.length) continue;
        if (!isUploadedImage && key) usedImageKeys.add(key);
        prepared.push({ bytes, dims });
      }
      if (!prepared.length) return;
      if (prepared.length === 1) {
        paras.push(new Paragraph({
          alignment: (align === 'right')
            ? (AlignmentType ? AlignmentType.RIGHT : undefined)
            : (align === 'left')
              ? (AlignmentType ? AlignmentType.LEFT : undefined)
              : (AlignmentType ? AlignmentType.CENTER : undefined),
          indent,
          spacing: { after: 160 },
          children: [new ImageRun({ data: prepared[0].bytes, transformation: prepared[0].dims })],
        }));
        return;
      }
      const cells = prepared.slice(0, 2).map(({ bytes, dims }) => new TableCell({
        verticalAlign: VerticalAlign?.TOP,
        borders: {
          top: { style: BorderStyle?.NONE, size: 0, color: 'FFFFFF' },
          bottom: { style: BorderStyle?.NONE, size: 0, color: 'FFFFFF' },
          left: { style: BorderStyle?.NONE, size: 0, color: 'FFFFFF' },
          right: { style: BorderStyle?.NONE, size: 0, color: 'FFFFFF' },
        },
        margins: { top: 0, bottom: 0, left: 0, right: 0 },
        children: [
          new Paragraph({
            alignment: AlignmentType ? AlignmentType.LEFT : undefined,
            spacing: { after: 0 },
            children: [new ImageRun({ data: bytes, transformation: dims })],
          }),
        ],
      }));
      paras.push(new Table({
        width: { size: 100, type: WidthType?.PERCENTAGE },
        rows: [new TableRow({ children: cells })],
      }));
      paras.push(new Paragraph({ text: '' }));
    } catch {}
  };

  const pushTable = (tbl) => {
    try {
      resetInline();
      const body = Array.isArray(tbl?.body) ? tbl.body : [];
      if (!body.length) return;
      const rows = body.map((rowArr, rIdx) => new TableRow({
        children: (rowArr || []).map((cellText) => new TableCell({
          verticalAlign: VerticalAlign?.TOP,
          shading: rIdx === 0 && tbl.hasHeader ? { type: ShadingType?.CLEAR, color: docColor, fill: isDark ? '111827' : 'F3F4F6' } : undefined,
          borders: {
            top: { style: BorderStyle?.SINGLE, size: 1, color: isDark ? '374151' : 'E5E7EB' },
            bottom: { style: BorderStyle?.SINGLE, size: 1, color: isDark ? '374151' : 'E5E7EB' },
            left: { style: BorderStyle?.SINGLE, size: 1, color: isDark ? '374151' : 'E5E7EB' },
            right: { style: BorderStyle?.SINGLE, size: 1, color: isDark ? '374151' : 'E5E7EB' },
          },
          children: [
            new Paragraph({
              children: [new TextRun({ text: String(cellText ?? '').replace(/\u00a0/g, ' ').trim(), font: docFont, size: docSize, color: docColor, bold: rIdx === 0 && tbl.hasHeader })],
            }),
          ],
        })),
      }));
      paras.push(new Table({
        width: { size: 100, type: WidthType?.PERCENTAGE },
        rows,
      }));
      paras.push(new Paragraph({ text: '' }));
    } catch {}
  };

  const buildMathComponent = async (b) => {
    let mathml = String(b?.mathml || '').trim();
    if (!mathml && b?.tex) {
      try {
        const katex = await ensureKatexLib();
        const rendered = String(katex.renderToString(stripTexWrappers(b.tex), { throwOnError: false, displayMode: !!b.display, output: 'mathml', strict: 'ignore' }) || '');
        mathml = extractFirstMathTag(rendered) || '';
      } catch {}
    }
    const omml = mathml ? await mathmlToOmml(mathml) : '';
    const mathComp = omml ? buildDocxMathComponent(docxLib, omml) : null;
    if (mathComp) return mathComp;
    const fallback = stripTexWrappers(b?.tex || '') || extractTexFromMathml(mathml);
    return fallback ? buildTextRuns(fallback) : null;
  };

  let inlineGroupId = null;
  let inlineChildren = [];
  const isGeneratedImageMeta = (meta) => {
    try {
      const src = String(meta?.originalSrc || meta?.src || '').trim();
      const alt = String(meta?.alt || '').trim();
      return /\/generated\//i.test(src) || /^generated image$/i.test(alt);
    } catch {
      return false;
    }
  };
  const assistantTwoImageGallery =
    !isUser &&
    Array.isArray(rowRealImagesForDocx) &&
    rowRealImagesForDocx.length === 2 &&
    rowRealImagesForDocx.every((meta) => isGeneratedImageMeta(meta));
  let assistantTwoImageGalleryDone = false;
  const flushInlineGroup = () => {
    if (!inlineChildren.length) { inlineGroupId = null; return; }
    try {
      paras.push(new Paragraph({
        alignment: paragraphAlign,
        indent,
        spacing: { after: 160 },
        shading: isUser ? { type: ShadingType?.CLEAR, color: docColor, fill: bubbleFill } : undefined,
        children: inlineChildren,
      }));
    } catch {}
    inlineChildren = [];
    inlineGroupId = null;
  };
  const ensureInlineGroup = (gid) => {
    if (!gid) return false;
    if (inlineGroupId && inlineGroupId !== gid) flushInlineGroup();
    if (!inlineGroupId) {
      inlineGroupId = gid;
      inlineChildren = [];
    }
    return true;
  };

  for (const b of blocks) {
    if (!b) continue;

    if (b.type === 'text') {
      const txt = String(b.text || '');
      const gid = b.groupId || null;
      if (gid && ensureInlineGroup(gid)) {
        try { inlineChildren.push(...buildTextRuns(txt)); } catch {}
      } else {
        flushInlineGroup();
        pushTextParagraph(txt);
      }
      continue;
    }

    if (b.type === 'runs' && Array.isArray(b.runs)) {
      const gid = b.groupId || null;
      const children = buildChildrenFromInlineRuns(b.runs);
      if (gid && ensureInlineGroup(gid)) {
        inlineChildren.push(...children);
      } else {
        flushInlineGroup();
        resetInline();
        try {
          paras.push(new Paragraph({
            alignment: paragraphAlign,
            indent,
            spacing: { after: 160 },
            shading: isUser ? { type: ShadingType?.CLEAR, color: docColor, fill: bubbleFill } : undefined,
            children,
          }));
        } catch {}
      }
      continue;
    }

    if (b.type === 'math') {
      const gid = b.groupId || null;
      if (b.display) {
        flushInlineGroup();
        // eslint-disable-next-line no-await-in-loop
        await pushMathParagraph(b);
        continue;
      }
      if (gid && ensureInlineGroup(gid)) {
        // eslint-disable-next-line no-await-in-loop
        const comp = await buildMathComponent(b);
        if (Array.isArray(comp)) inlineChildren.push(...comp);
        else if (comp) inlineChildren.push(comp);
      } else {
        flushInlineGroup();
        // eslint-disable-next-line no-await-in-loop
        await pushMathParagraph(b);
      }
      continue;
    }

    flushInlineGroup();

    if (b.type === 'hr') {
      pushHrParagraph();
      continue;
    }
    if (b.type === 'code') {
      pushCodeParagraph(b.text || '');
      continue;
    }
    if (b.type === 'table') {
      pushTable(b);
      continue;
    }
    if (b.type === 'image') {
      if (assistantTwoImageGallery) {
        if (!assistantTwoImageGalleryDone) {
          assistantTwoImageGalleryDone = true;
          rowImageCursorForDocx = rowRealImagesForDocx.length;
          await pushImageGalleryParagraph(rowRealImagesForDocx, {
            maxWidth: galleryTile?.width || 240,
            maxHeight: 360,
            align: 'left',
          });
        }
        continue;
      }
      const blockKey = imageSourceKeyForDocx(b);
      const rowMeta = rowRealImagesForDocx[rowImageCursorForDocx];
      const rowKey = imageSourceKeyForDocx(rowMeta);
      const isGallery = typeof row?.galleryCount === 'number' && row.galleryCount > 1;
      const maxWidth = isUser ? (isGallery ? (galleryTile?.width || 480) : 480) : 480;
      const candidates = [];
      if (isUploadedImageMeta(b)) candidates.push(b);
      if (rowMeta) candidates.push(rowMeta);
      if (!isUploadedImageMeta(b)) candidates.push(b);
      let rendered = false;
      let renderedKey = '';
      for (const candidate of candidates) {
        const candidateKey = imageSourceKeyForDocx(candidate);
        if (candidateKey && renderedImageKeysForDocx.has(candidateKey)) continue;
        // eslint-disable-next-line no-await-in-loop
        rendered = await pushImageParagraph(candidate, { maxWidth, maxHeight: 520, align: isUser ? 'right' : 'left' });
        if (rendered) {
          renderedKey = candidateKey;
          break;
        }
      }
      if (rowKey && blockKey && rowKey === blockKey) rowImageCursorForDocx += 1;
      else if (rendered && rowMeta && renderedKey && renderedKey === rowKey) rowImageCursorForDocx += 1;
      if (rendered && renderedKey) renderedImageKeysForDocx.add(renderedKey);
      continue;
  }
}
flushInlineGroup();

  // If there are leftover images in the row metadata, append them (common when HTML is text-only but imgs exist).
  while (rowImageCursorForDocx < rowRealImagesForDocx.length) {
    const meta = rowRealImagesForDocx[rowImageCursorForDocx++];
    const leftoverKey = imageSourceKeyForDocx(meta);
    if (leftoverKey && renderedImageKeysForDocx.has(leftoverKey)) continue;
    const isGalleryOverflow = typeof row?.galleryCount === 'number' && row.galleryCount > 1;
    // eslint-disable-next-line no-await-in-loop
    await pushImageParagraph(meta, {
      maxWidth: isUser ? (isGalleryOverflow ? (galleryTile?.width || 480) : 480) : 480,
      maxHeight: 520,
      align: isUser ? 'right' : 'left'
    });
  }

  // If no blocks produced but we have plain text, emit it.
  if (!paras.length) {
    const fallbackText = cleanPlainText(String(row.text || '').trim());
    if (fallbackText) pushTextParagraph(fallbackText);
  }

  // Very small compatibility note: the original popup implementation includes additional Gemini table de-dup
  // heuristics and math blocks. Those can be migrated later if needed.
  return paras;
}
