// Core HTML/Markdown block parsing helpers shared across export formats.
// This runs in the extension page context (popup.js).
//
// Intentionally provider-agnostic: any provider-specific cleanup should happen before calling this.

export function htmlToPlainTextLocal(html = '') {
  if (!html) return '';
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  try {
    // Keep attachment/download links usable in plain exports (TXT/MD/JSON/CSV) without showing raw URLs in HTML/PDF/DOCX.
    // Only expand links for attachment-like blocks.
    Array.from(tmp.querySelectorAll('a[href]')).forEach((a) => {
      try {
        const href = (a.getAttribute('href') || '').trim();
        if (!href) return;
        const text = (a.textContent || '').trim() || 'Link';
        const inAttachment = !!(a.closest('.acep-chat-export') || /\[Attachment\]:/i.test(a.parentElement?.textContent || ''));
        if (!inAttachment) return;
        a.replaceWith(document.createTextNode(`${text} ${href}`));
      } catch {}
    });
  } catch {}
  return tmp.innerText.replace(/\r?\n/g, '\n');
}

export function decodeHtmlEntities(str = '') {
  if (!str) return '';
  return str
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&');
}

export function markdownToHtmlSimple(md = '') {
  if (!md) return '';
  const escapeHtmlLocal = (s = '') =>
    s.replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
  const lines = md.replace(/\r\n/g, '\n').split('\n');
  let out = '';
  let i = 0;
  const inlineFmt = (s) => {
    s = s.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
    s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    s = s.replace(/(^|[^\*])\*([^*]+)\*/g, '$1<em>$2</em>');
    s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
    return s;
  };
  const flushParagraph = (buf) => {
    const text = buf.join(' ').trim();
    if (!text) return '';
    return `<p>${inlineFmt(escapeHtmlLocal(text))}</p>`;
  };
  const parseTable = (start) => {
    const rows = [];
    let j = start;
    while (j < lines.length && /\|/.test(lines[j])) {
      rows.push(lines[j]);
      j++;
    }
    if (rows.length < 2) return null;
    const sep = rows[1];
    if (!/^\s*\|?[\s:-]+\|/.test(sep)) return null;
    const parseRow = (row) => row
      .trim()
      .replace(/^\|/, '')
      .replace(/\|$/, '')
      .split('|')
      .map(c => inlineFmt(escapeHtmlLocal(c.trim())));
    const header = parseRow(rows[0]);
    const body = rows.slice(2).map(parseRow);
    const thead = `<thead><tr>${header.map(h => `<th>${h}</th>`).join('')}</tr></thead>`;
    const tbody = `<tbody>${body.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody>`;
    return { html: `<table>${thead}${tbody}</table>`, next: start + rows.length };
  };
  while (i < lines.length) {
    const line = lines[i];
    if (/^\s*```/.test(line)) {
      let code = '';
      i++;
      while (i < lines.length && !/^\s*```/.test(lines[i])) { code += lines[i] + '\n'; i++; }
      out += `<pre><code>${escapeHtmlLocal(code.trimEnd())}</code></pre>`;
      i++;
      continue;
    }
    const tbl = parseTable(i);
    if (tbl) {
      out += tbl.html;
      i = tbl.next;
      continue;
    }
    if (/^\s*#{1,6}\s+/.test(line)) {
      const level = (line.match(/^\s*(#{1,6})\s+/) || [, '#'])[1].length;
      const text = line.replace(/^\s*#{1,6}\s+/, '').trim();
      out += `<h${level}>${inlineFmt(escapeHtmlLocal(text))}</h${level}>`;
      i++;
      continue;
    }
    // Horizontal rule lines: --- or *** or ___ (optionally with spaces), or long underscore lines
    if (/^\s*(?:(-\s*){3,}|(\*\s*){3,}|(_\s*){3,}|_{8,})\s*$/.test(line)) {
      out += '<hr>';
      i++;
      continue;
    }
    if (/^\s*[-*+]\s+/.test(line)) {
      const items = [];
      let j = i;
      while (j < lines.length && /^\s*[-*+]\s+/.test(lines[j])) {
        items.push(lines[j].replace(/^\s*[-*+]\s+/, '').trim());
        j++;
      }
      if (items.length > 1) {
        while (i < j) i++;
        out += `<ul>${items.map(it => `<li>${inlineFmt(escapeHtmlLocal(it))}</li>`).join('')}</ul>`;
        continue;
      }
    }
    if (/^\s*\d+\.\s+/.test(line)) {
      const items = [];
      let j = i;
      while (j < lines.length && /^\s*\d+\.\s+/.test(lines[j])) {
        items.push(lines[j].replace(/^\s*\d+\.\s+/, '').trim());
        j++;
      }
      if (items.length > 1) {
        while (i < j) i++;
        out += `<ol>${items.map(it => `<li>${inlineFmt(escapeHtmlLocal(it))}</li>`).join('')}</ol>`;
        continue;
      }
    }
    if (!line.trim()) { i++; continue; }
    const isHrLine = (ln) => /^\s*(?:(-\s*){3,}|(\*\s*){3,}|(_\s*){3,}|_{8,})\s*$/.test(ln);
    const buf = [];
    while (i < lines.length && lines[i].trim()) {
      if (isHrLine(lines[i])) break;
      buf.push(lines[i]);
      i++;
    }
    out += flushParagraph(buf);
  }
  return out;
}

export function normalizeArtifactMarkdownHtml(html = '') {
  if (!html || typeof DOMParser === 'undefined') return html;
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(`<div>${html}</div>`, 'text/html');
    const root = doc.body.firstElementChild || doc.body;
    const bodies = Array.from(root.querySelectorAll('.acep-artifact-body, pre.acep-artifact-body, pre.acep-artifact'));
    bodies.forEach((pre) => {
      const isPre = pre.tagName === 'PRE';
      if (isPre && pre.querySelector('code')) return;
      const hasStructured = !!pre.querySelector('table,h1,h2,h3,h4,h5,h6,ul,ol,pre,code,blockquote');
      if (!isPre && hasStructured) return;
      const raw = decodeHtmlEntities(pre.textContent || '');
      if (!raw) return;
      const rendered = markdownToHtmlSimple(raw);
      if (!rendered) return;
      const holder = doc.createElement('div');
      holder.className = 'acep-artifact-body';
      holder.innerHTML = rendered;
      pre.replaceWith(holder);
    });
    return root.innerHTML || html;
  } catch {
    return html;
  }
}

export function parseAsciiBoxTable(text = '') {
  if (!text || !/[\u250c\u252c\u2510\u2514\u2534\u2518\u251c\u253c\u2524\u2502\u2500]/.test(text)) return null;
  const lines = text.split(/\r?\n/).map(l => l.replace(/\s+$/, ''));
  const rowLines = lines.filter(l => l.indexOf('\u2502') !== -1);
  if (rowLines.length < 2) return null;
  const body = [];
  rowLines.forEach(line => {
    if (/^[\s\u250c\u252c\u2510\u2514\u2534\u2518\u251c\u253c\u2524\u2500]+$/.test(line)) return;
    const parts = line.split('\u2502').slice(1, -1).map(p => p.trim());
    const row = parts.filter(p => p !== '');
    if (row.length >= 2) body.push(row);
  });
  if (body.length < 2) return null;
  const hasHeader = lines.some(l => /[\u252c\u253c]/.test(l));
  return { body, hasHeader, caption: '' };
}

export function extractAsciiTableFromText(text = '') {
  try {
    if (!text) return null;
    const tbl = parseAsciiBoxTable(text);
    if (tbl && tbl.body && tbl.body.length) return { table: tbl, prefix: '', suffix: '' };
    const lines = text.split(/\r?\n/);
    let start = -1;
    let end = -1;
    for (let i = 0; i < lines.length; i++) {
      if (/[\u250c\u2514]\u2500/.test(lines[i])) { start = i; break; }
    }
    if (start === -1) return null;
    for (let i = start + 1; i < lines.length; i++) {
      if (/[\u2514]\u2500/.test(lines[i])) { end = i; break; }
    }
    if (end === -1) return null;
    const chunk = lines.slice(start, end + 1).join('\n');
    const parsed = parseAsciiBoxTable(chunk);
    if (!parsed) return null;
    const prefix = lines.slice(0, start).join('\n').trim();
    const suffix = lines.slice(end + 1).join('\n').trim();
    return { table: parsed, prefix, suffix };
  } catch {
    return null;
  }
}

export function extractMarkdownPipeTableFromText(text = '') {
  try {
    if (!text || !/\|/.test(text)) return null;
    const lines = text.split(/\r?\n/);
    const isSep = (l) => /^\s*\|?[\s:-]+\|/.test(l);
    let start = -1;
    for (let i = 0; i < lines.length - 1; i++) {
      if (/\|/.test(lines[i]) && isSep(lines[i + 1])) { start = i; break; }
    }
    if (start === -1) return null;
    let end = start + 1;
    for (let i = start + 2; i < lines.length; i++) {
      if (!/\|/.test(lines[i])) break;
      end = i;
    }
    const rows = lines.slice(start, end + 1);
    if (rows.length < 2) return null;
    const parseRow = (row) => row
      .trim()
      .replace(/^\|/, '')
      .replace(/\|$/, '')
      .split('|')
      .map(c => c.trim());
    const header = parseRow(rows[0]);
    const body = rows.slice(2).map(parseRow);
    if (!header.length || !body.length) return null;
    const prefix = lines.slice(0, start).join('\n').trim();
    const suffix = lines.slice(end + 1).join('\n').trim();
    return { table: { body: [header, ...body], hasHeader: true, caption: '' }, prefix, suffix };
  } catch {
    return null;
  }
}

export function parseHtmlBlocks(html = '', options = {}) {
  const allowAsciiTables = options.allowAsciiTables !== false;
  html = normalizeArtifactMarkdownHtml(html || '');
  const blocks = [];
  if (!html || typeof DOMParser === 'undefined') {
    const text = htmlToPlainTextLocal(html || '');
    if (text) blocks.push({ type: 'text', text });
    return blocks;
  }
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const seenImgSrc = new Set();
    const acc = { text: '' };
      const flush = () => {
        const t = acc.text.replace(/\r?\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
        if (t) blocks.push({ type: 'text', text: t });
        acc.text = '';
      };
    const extractKatexText = (el) => {
      if (!el || !el.querySelectorAll) return '';
      const annos = Array.from(el.querySelectorAll('annotation[encoding="application/x-tex"]'));
      const parts = annos.map((a) => (a.textContent || '').trim()).filter(Boolean);
      if (parts.length) return parts.join(' ');
      const dataTex = el.getAttribute('data-tex') || el.getAttribute('data-texsrc') || el.getAttribute('data-tex-source') || '';
      if (dataTex && dataTex.trim()) return dataTex.trim();
      const aria = el.getAttribute('aria-label') || '';
      if (aria && /\\|[_^]/.test(aria)) return aria.trim();
      const htmlText = (el.querySelector('.katex-html')?.textContent || '').replace(/[\u200b\u2060]/g, '');
      const cleaned = (htmlText || el.textContent || '')
        .replace(/\u00a0/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      return cleaned || '';
    };
    const collectInlineRuns = (node, fmt = {}, runs = []) => {
      if (!node) return runs;
      if (node.nodeType === 3) {
        const txt = String(node.nodeValue || '').replace(/\u00a0/g, ' ');
        if (txt) runs.push({ text: txt, ...fmt });
        return runs;
      }
      if (node.nodeType !== 1) return runs;
      const el = node;
      if (el.getAttribute && el.hasAttribute && el.hasAttribute('data-math')) {
        const tex = el.getAttribute('data-math') || '';
        if (tex) runs.push({ text: tex });
        return runs;
      }
      const tag = (el.tagName || '').toLowerCase();
      if (tag === 'br') {
        runs.push({ text: '\n' });
        return runs;
      }
      const nextFmt = { ...fmt };
      if (tag === 'strong' || tag === 'b' || /^h[1-6]$/.test(tag)) nextFmt.bold = true;
      if (/^h[1-6]$/.test(tag)) {
        const lvl = parseInt(tag.replace('h', ''), 10);
        if (Number.isFinite(lvl)) nextFmt.headingLevel = lvl;
      }
      if (tag === 'em' || tag === 'i') nextFmt.italics = true;
      if (tag === 'u') nextFmt.decoration = 'underline';
      if (tag === 'a') {
        const href = el.getAttribute('href') || '';
        if (href) {
          nextFmt.link = href;
          nextFmt.color = '#2563eb';
          nextFmt.decoration = 'underline';
        }
      }
      el.childNodes.forEach((child) => collectInlineRuns(child, nextFmt, runs));
      return runs;
    };
    const pushRunsFrom = (el, listPrefix = '') => {
      let target = el;
      try {
        const clone = el.cloneNode(true);
        // Preserve math by converting KaTeX/MathML nodes into raw TeX text so plain exports (MD/TXT/CSV/JSON) keep formulas.
        const mathNodes = Array.from(clone.querySelectorAll('.katex, mjx-container, math'));
        mathNodes.forEach((n) => {
          try {
            const tex = extractKatexText(n);
            if (!tex) { n.remove(); return; }
            const cls = (n.className || '').toString();
            const display = /katex-display/.test(cls) || (n.getAttribute && (n.getAttribute('display') || '').toLowerCase() === 'block');
            const wrapped = display ? `$$${tex}$$` : `$${tex}$`;
            n.replaceWith(clone.ownerDocument.createTextNode(wrapped));
          } catch {
            try { n.remove(); } catch {}
          }
        });
        target = clone;
      } catch {}
      const runs = collectInlineRuns(target);
      if (!runs.length) return;
      if (listPrefix && runs[0] && typeof runs[0].text === 'string') {
        runs[0].text = listPrefix + runs[0].text.replace(/^\s+/, '');
        blocks.push({ type: 'runs', runs });
        return;
      }
      const prefix = listPrefix ? [{ text: listPrefix }] : [];
      blocks.push({ type: 'runs', runs: prefix.concat(runs) });
    };
    const detectLang = (el) => {
      if (!el) return '';
      const attrs = [];
      if (el.getAttribute) {
        ['data-language', 'data-lang', 'lang'].forEach((attr) => {
          const val = el.getAttribute(attr);
          if (val) attrs.push(val);
        });
      }
      if (el.dataset) {
        if (el.dataset.language) attrs.push(el.dataset.language);
        if (el.dataset.lang) attrs.push(el.dataset.lang);
      }
      const classAttr = (el.className || '').toString();
      const match = classAttr.match(/language-([\w#+-]+)/i) || classAttr.match(/lang-([\w#+-]+)/i);
      if (match && match[1]) attrs.push(match[1]);
      return (attrs[0] || '').toLowerCase();
    };
    const pushCodeBlock = (el) => {
      if (!el) return;
      const raw = (el.textContent || el.innerText || '').replace(/\u00a0/g, ' ');
      const text = raw.replace(/\r?\n/g, '\n').replace(/\n{4,}/g, '\n\n');
      if (!text.trim()) return;
      const asciiTable = allowAsciiTables ? parseAsciiBoxTable(text) : null;
      if (asciiTable) {
        flush();
        blocks.push({ type: 'table', ...asciiTable });
        return;
      }
      flush();
      blocks.push({ type: 'code', text, lang: detectLang(el) });
    };
    const tableToBody = (t) => {
      const body = [];
      const bodyHtml = [];
      const pushRow = (cells = []) => {
        const rowArr = cells.map(cell => (cell.innerText || '').replace(/\u00a0/g, ' ').trim());
        const rowHtml = cells.map(cell => (cell.innerHTML || '').trim());
        if (rowArr.some(cell => cell !== '')) {
          body.push(rowArr);
          bodyHtml.push(rowHtml);
        }
      };
      const rows = Array.from(t.querySelectorAll('tr'));
      if (rows.length) {
        rows.forEach(tr => pushRow(Array.from(tr.querySelectorAll('th,td'))));
      } else {
        const roleRows = Array.from(t.querySelectorAll('[role="row"]'));
        roleRows.forEach(row => {
          const cells = Array.from(row.querySelectorAll('[role="cell"], [role="columnheader"], [role="rowheader"]'));
          if (cells.length) pushRow(cells);
        });
      }
      const hasHeader = !!t.querySelector('th, [role="columnheader"], [role="rowheader"]');
      // Optional caption: previous sibling text (common pattern for ChatGPT tables)
      let caption = '';
      try {
        if (!t.closest('.acep-artifact-body')) {
          const prev = t.previousElementSibling;
          if (prev && /P/i.test(prev.tagName)) {
            const txt = (prev.innerText || '').trim();
            if (txt) caption = txt;
          }
        }
      } catch {}
      return { body, bodyHtml, hasHeader, caption };
    };
    const visit = (node) => {
      if (!node) return;
      if (node.nodeType === 1) {
        const el = node;
        const className = (el.className || '').toString();
        const isKatex = (el.classList && (el.classList.contains('katex') || el.classList.contains('katex-display'))) || /(^|\s)katex(-display)?(\s|$)/.test(className);
        if (isKatex) {
          const tex = extractKatexText(el);
          if (tex) {
            const display = /katex-display/.test(className) || (el.getAttribute && (String(el.getAttribute('display') || '').toLowerCase() === 'block'));
            const wrapped = display ? `$$${tex}$$` : `$${tex}$`;
            if (display) {
              flush();
              blocks.push({ type: 'text', text: wrapped });
            } else {
              acc.text += (acc.text ? ' ' : '') + wrapped;
            }
          }
          return;
        }
        if (el.getAttribute && el.hasAttribute && el.hasAttribute('data-math')) {
          const tex = (el.getAttribute('data-math') || '').trim();
          if (tex) {
            const isDisplayEl = el.tagName === 'DIV' || (el.classList && (el.classList.contains('math-block') || el.classList.contains('katex-display')));
            if (isDisplayEl) {
              flush();
              blocks.push({ type: 'math', tex, display: true, mathml: '', groupId: null });
            } else {
              acc.text += (acc.text ? ' ' : '') + tex;
            }
          }
          return;
        }
        if (el.tagName === 'HR') {
          flush();
          blocks.push({ type: 'hr' });
          return;
        }
        const isRoleTable = el.getAttribute && el.getAttribute('role') === 'table';
        const hasRoleRows = el.querySelector && el.querySelector('[role="row"]');
        if (el.tagName === 'TABLE' || isRoleTable || (hasRoleRows && el.querySelector('[role="cell"], [role="columnheader"], [role="rowheader"]'))) {
          flush();
          const tbl = tableToBody(el);
          if (tbl.body.length) blocks.push({ type: 'table', ...tbl });
          return; // do not descend into table again
        }
        if (el.tagName === 'PRE') {
          const imgsInPre = Array.from(el.querySelectorAll('img'));
          // If the <pre> contains images (e.g., Mermaid/SVG previews), capture only the images in order and ignore header text like "svg".
          if (imgsInPre.length) {
            flush();
            imgsInPre.forEach((im) => {
              const srcPreferred = (im.getAttribute('data-original-src') || '').trim();
              const srcFallback = (im.getAttribute('src') || '').trim();
              const src = (srcPreferred && !/^data:/i.test(srcPreferred)) ? srcPreferred : srcFallback;
              if (src) blocks.push({ type: 'image', src, alt: im.getAttribute('alt') || '' });
            });
            return;
          }
          const codeEl = el.querySelector('code') || el;
          pushCodeBlock(codeEl);
          return;
        }
        if (el.tagName === 'HR') {
          flush();
          blocks.push({ type: 'hr' });
          return;
        }
        // KaTeX nodes are converted to images upstream; no special handling here.
        if (el.tagName === 'IMG') {
          flush();
          const srcPreferred = (el.getAttribute('data-original-src') || '').trim();
          const srcFallback = (el.getAttribute('src') || '').trim();
          const src = (srcPreferred && !/^data:/i.test(srcPreferred)) ? srcPreferred : srcFallback;
          if (src) {
            const key = src.split('#')[0];
            if (seenImgSrc.has(key)) return;
            seenImgSrc.add(key);
            const isKatexImg = el.getAttribute('data-acep-katex') === '1';
            const isKatexDisplayImg = el.getAttribute('data-acep-display') === '1';
            const vbW = parseFloat(el.getAttribute('data-acep-vw')) || 0;
            const vbH = parseFloat(el.getAttribute('data-acep-vh')) || 0;
            const svgText = el.getAttribute('data-acep-svg') || '';
            blocks.push({
              type: 'image',
              src,
              alt: el.getAttribute('alt') || '',
              katex: isKatexImg,
              katexDisplay: isKatexDisplayImg,
              vbW,
              vbH,
              svgText,
            });
          }
          return;
        }
        if (el.tagName === 'HR') {
          flush();
          blocks.push({ type: 'hr', groupId: null, inlineContinuation: false });
          return;
        }
        if (el.tagName === 'CODE') {
          if (el.closest && el.closest('pre')) return;
          pushCodeBlock(el);
          return;
        }
        if (el.tagName === 'UL' || el.tagName === 'OL') {
          const items = Array.from(el.children).filter(c => c.tagName === 'LI');
          const startAttr = Number(el.getAttribute('start'));
          const start = Number.isFinite(startAttr) && startAttr > 0 ? startAttr : 1;
          items.forEach((li, idx) => {
            let n = start + idx;
            try {
              const liVal = Number(li.getAttribute('value'));
              if (Number.isFinite(liVal) && liVal > 0) n = liVal;
            } catch {}
            const prefix = el.tagName === 'OL' ? (String(n) + '. ') : (String.fromCharCode(8226) + ' ');
            if (li.querySelector && li.querySelector('img')) {
              flush();
              acc.text = prefix;
              li.childNodes.forEach(visit);
              flush();
            } else {
              pushRunsFrom(li, prefix);
            }
          });
          return;
        }
        if (/^(P|LI|PRE|BLOCKQUOTE|H1|H2|H3|H4|H5|H6)$/.test(el.tagName)) {
          if (el.querySelector && el.querySelector('img')) {
            flush();
            el.childNodes.forEach(visit);
            flush();
          } else {
            pushRunsFrom(el);
          }
          return;
        }
        el.childNodes.forEach(visit);
      } else if (node.nodeType === 3) {
        const txt = String(node.nodeValue || '');
        if (txt.trim()) acc.text += (acc.text ? ' ' : '') + txt;
      }
    };
    doc.body.childNodes.forEach(visit);
    flush();
  } catch {
    const text = htmlToPlainTextLocal(html || '');
    if (text) blocks.push({ type: 'text', text });
  }
  const expanded = [];
  const fenceRegex = /```([\w#+-]*)\s*([\s\S]*?)```/g;
  blocks.forEach((block) => {
    if (!block || block.type !== 'text' || !/```/.test(block.text)) {
      if (block) expanded.push(block);
      return;
    }
    let lastIndex = 0;
    const text = block.text;
    let match;
    while ((match = fenceRegex.exec(text))) {
      const leading = text.slice(lastIndex, match.index).trim();
      if (leading) expanded.push({ type: 'text', text: leading });
      const lang = (match[1] || '').trim();
      const code = (match[2] || '').replace(/^\n+|\n+$/g, '');
      if (code) expanded.push({ type: 'code', text: code, lang });
      lastIndex = fenceRegex.lastIndex;
    }
    const trailing = text.slice(lastIndex).trim();
    if (trailing) expanded.push({ type: 'text', text: trailing });
  });
  if (!allowAsciiTables) return expanded;
  const processed = [];
  expanded.forEach((block) => {
    if (!block || block.type !== 'text') { if (block) processed.push(block); return; }
    const mdResult = extractMarkdownPipeTableFromText(block.text || '');
    if (mdResult) {
      const { table, prefix, suffix } = mdResult;
      if (prefix) processed.push({ type: 'text', text: prefix });
      processed.push({ type: 'table', ...table });
      if (suffix) processed.push({ type: 'text', text: suffix });
      return;
    }
    const result = extractAsciiTableFromText(block.text || '');
    if (!result) { processed.push(block); return; }
    const { table, prefix, suffix } = result;
    if (prefix) processed.push({ type: 'text', text: prefix });
    processed.push({ type: 'table', ...table });
    if (suffix) processed.push({ type: 'text', text: suffix });
  });
  return processed;
}

export function parseHtmlBlocksForDocx(html = '', options = {}) {
  const allowAsciiTables = options.allowAsciiTables !== false;
  html = normalizeArtifactMarkdownHtml(html || '');
  const blocks = [];
  if (!html || typeof DOMParser === 'undefined') {
    const text = htmlToPlainTextLocal(html || '');
    if (text) blocks.push({ type: 'text', text });
    return blocks;
  }
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const seenImgSrc = new Set();
    let groupCounter = 0;
    const nextGroup = () => { groupCounter += 1; return groupCounter; };
    const acc = { text: '', groupId: null, inlineContinuation: false };
    const flush = () => {
      const t = acc.text.replace(/\r?\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
      if (t) {
        blocks.push({
          type: 'text',
          text: t,
          groupId: acc.groupId || null,
          inlineContinuation: acc.inlineContinuation === true,
        });
      }
      acc.text = '';
      acc.groupId = null;
      acc.inlineContinuation = false;
    };
    const ensureGroup = (groupId) => {
      if (!groupId) return;
      if (acc.groupId && acc.groupId !== groupId) flush();
      acc.groupId = groupId;
    };
    const collectInlineRuns = (node, fmt = {}, runs = []) => {
      if (!node) return runs;
      if (node.nodeType === 3) {
        const txt = String(node.nodeValue || '').replace(/\u00a0/g, ' ');
        if (txt) runs.push({ text: txt, ...fmt });
        return runs;
      }
      if (node.nodeType !== 1) return runs;
      const el = node;
      try {
        const cls = String(el.className || '');
        const isKatex = (el.classList && (el.classList.contains('katex') || el.classList.contains('katex-display'))) || /(^|\s)katex(-display)?(\s|$)/.test(cls);
        if (isKatex) return runs;
        if ((el.tagName || '').toLowerCase() === 'math') return runs;
        if (el.getAttribute && el.hasAttribute && el.hasAttribute('data-math')) {
          const tex = el.getAttribute('data-math') || '';
          if (tex) runs.push({ text: tex });
          return runs;
        }
      } catch {}
      const tag = (el.tagName || '').toLowerCase();
      if (tag === 'br') {
        runs.push({ text: '\n' });
        return runs;
      }
      const nextFmt = { ...fmt };
      if (tag === 'strong' || tag === 'b' || /^h[1-6]$/.test(tag)) nextFmt.bold = true;
      if (/^h[1-6]$/.test(tag)) {
        const lvl = parseInt(tag.replace('h', ''), 10);
        if (Number.isFinite(lvl)) nextFmt.headingLevel = lvl;
      }
      if (tag === 'em' || tag === 'i') nextFmt.italics = true;
      if (tag === 'u') nextFmt.underline = true;
      if (tag === 'code') nextFmt.code = true;
      if (tag === 'a') {
        const href = el.getAttribute('href') || '';
        if (href) {
          nextFmt.link = href;
          nextFmt.underline = true;
          nextFmt.color = '2563EB';
        }
      }
      el.childNodes.forEach((child) => collectInlineRuns(child, nextFmt, runs));
      return runs;
    };
    const pushRunsFrom = (el, groupId, listPrefix = '') => {
      let target = el;
      try {
        const clone = el.cloneNode(true);
        clone.querySelectorAll('.katex, mjx-container, math').forEach((n) => n.remove());
        target = clone;
      } catch {}
      const runs = collectInlineRuns(target);
      if (!runs.length) return;
      if (listPrefix && runs[0] && typeof runs[0].text === 'string') {
        runs[0].text = listPrefix + runs[0].text.replace(/^\s+/, '');
        blocks.push({
          type: 'runs',
          runs,
          groupId: groupId || null,
          inlineContinuation: false,
        });
        return;
      }
      const prefix = listPrefix ? [{ text: listPrefix }] : [];
      blocks.push({
        type: 'runs',
        runs: prefix.concat(runs),
        groupId: groupId || null,
        inlineContinuation: false,
      });
    };
    const extractMathml = (el) => {
      if (!el || !el.querySelector) return '';
      const math = el.querySelector('math');
      return math ? math.outerHTML : '';
    };
    const extractDataMath = (el) => {
      if (!el || !el.getAttribute) return '';
      return (el.getAttribute('data-math') || '').trim();
    };

    const isKatexNode = (el) => {
      if (!el) return false;
      try {
        const cls = String(el.className || '');
        return (el.classList && (el.classList.contains('katex') || el.classList.contains('katex-display')))
          || /(^|\s)katex(-display)?(\s|$)/.test(cls)
          || ((el.tagName || '').toLowerCase() === 'math')
          || (el.getAttribute && el.hasAttribute && el.hasAttribute('data-math'));
      } catch {
        return false;
      }
    };

    const pushRunsAndMathFrom = (el, groupId, listPrefix = '') => {
      let runs = [];
      let prefix = String(listPrefix || '');
      const flushRuns = () => {
        if (!runs.length) return;
        if (prefix && runs[0] && typeof runs[0].text === 'string') {
          runs[0].text = prefix + runs[0].text.replace(/^\s+/, '');
          prefix = '';
        } else if (prefix) {
          runs = [{ text: prefix }, ...runs];
          prefix = '';
        }
        blocks.push({
          type: 'runs',
          runs,
          groupId: groupId || null,
          inlineContinuation: false,
        });
        runs = [];
      };

      const pushMathFromNode = (n) => {
        try {
          const className = String(n.className || '');
          const display = /katex-display/.test(className) || (n.getAttribute && (String(n.getAttribute('display') || '').toLowerCase() === 'block'));
          let mathml = '';
          if ((n.tagName || '').toLowerCase() === 'math') mathml = n.outerHTML || '';
          if (!mathml) mathml = extractMathml(n);
          if (!mathml && n.getAttribute && n.hasAttribute && n.hasAttribute('data-math')) {
            const tex = extractDataMath(n);
            if (tex) blocks.push({ type: 'math', mathml: '', tex, display, groupId });
            return;
          }
          if (mathml) blocks.push({ type: 'math', mathml, display, groupId });
        } catch {}
      };

      const walk = (node, fmt = {}) => {
        if (!node) return;
        if (node.nodeType === 3) {
          const txt = String(node.nodeValue || '').replace(/\u00a0/g, ' ');
          if (txt) runs.push({ text: txt, ...fmt });
          return;
        }
        if (node.nodeType !== 1) return;
        const childEl = node;
        if (isKatexNode(childEl)) {
          const isDisplay = (childEl.tagName || '').toLowerCase() === 'div'
            || (childEl.classList && (childEl.classList.contains('katex-display') || childEl.classList.contains('math-block')));
          if (isDisplay) {
            flushRuns();
            pushMathFromNode(childEl);
          } else {
            // Inline math: emit as a separate math block (same groupId) so docx.js
            // can render it as OMML alongside the surrounding text runs.
            flushRuns();
            pushMathFromNode(childEl);
          }
          return;
        }
        const tag = (childEl.tagName || '').toLowerCase();
        if (tag === 'br') {
          runs.push({ text: '\n' });
          return;
        }
        // Some providers wrap KaTeX in extra spans; detect it early.
        try {
          const katexInside = childEl.querySelector && (childEl.querySelector('.katex, .katex-display, math, [data-math]'));
          if (katexInside) {
            childEl.childNodes.forEach((c) => walk(c, fmt));
            return;
          }
        } catch {}
        collectInlineRuns(childEl, fmt, runs);
      };

      (el.childNodes || []).forEach((c) => walk(c, {}));
      flushRuns();
    };
    const detectLang = (el) => {
      if (!el) return '';
      const attrs = [];
      if (el.getAttribute) {
        ['data-language', 'data-lang', 'lang'].forEach((attr) => {
          const val = el.getAttribute(attr);
          if (val) attrs.push(val);
        });
      }
      if (el.dataset) {
        if (el.dataset.language) attrs.push(el.dataset.language);
        if (el.dataset.lang) attrs.push(el.dataset.lang);
      }
      const classAttr = (el.className || '').toString();
      const match = classAttr.match(/language-([\w#+-]+)/i) || classAttr.match(/lang-([\w#+-]+)/i);
      if (match && match[1]) attrs.push(match[1]);
      return (attrs[0] || '').toLowerCase();
    };
    const pushCodeBlock = (el) => {
      if (!el) return;
      const raw = (el.textContent || el.innerText || '').replace(/\u00a0/g, ' ');
      const text = raw.replace(/\r?\n/g, '\n').replace(/\n{4,}/g, '\n\n');
      if (!text.trim()) return;
      const asciiTable = allowAsciiTables ? parseAsciiBoxTable(text) : null;
      if (asciiTable) {
        flush();
        blocks.push({ type: 'table', ...asciiTable });
        return;
      }
      flush();
      blocks.push({ type: 'code', text, lang: detectLang(el) });
    };
    const tableToBody = (t) => {
      const body = [];
      const bodyHtml = [];
      const pushRow = (cells = []) => {
        const rowArr = cells.map(cell => (cell.innerText || '').replace(/\u00a0/g, ' ').trim());
        const rowHtml = cells.map(cell => (cell.innerHTML || '').trim());
        if (rowArr.some(cell => cell !== '')) {
          body.push(rowArr);
          bodyHtml.push(rowHtml);
        }
      };
      const rows = Array.from(t.querySelectorAll('tr'));
      if (rows.length) {
        rows.forEach(tr => pushRow(Array.from(tr.querySelectorAll('th,td'))));
      } else {
        const roleRows = Array.from(t.querySelectorAll('[role="row"]'));
        roleRows.forEach(row => {
          const cells = Array.from(row.querySelectorAll('[role="cell"], [role="columnheader"], [role="rowheader"]'));
          if (cells.length) pushRow(cells);
        });
      }
      const hasHeader = !!t.querySelector('th, [role="columnheader"], [role="rowheader"]');
      let caption = '';
      try {
        const prev = t.previousElementSibling;
        if (prev && /P/i.test(prev.tagName)) {
          const txt = (prev.innerText || '').trim();
          if (txt) caption = txt;
        }
      } catch {}
      return { body, bodyHtml, hasHeader, caption };
    };
    const blockTags = new Set(['P', 'UL', 'OL', 'PRE', 'BLOCKQUOTE', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'LI', 'DIV', 'TABLE']);
    const isBlockTag = (el) => !!(el && el.tagName && blockTags.has(el.tagName));
    const hasChildBlock = (el) => {
      if (!el || !el.children) return false;
      return Array.from(el.children).some(child => isBlockTag(child));
    };
      const visit = (node, groupId = null) => {
        if (!node) return;
        if (node.nodeType === 1) {
          const el = node;
        const className = (el.className || '').toString();
        // Skip visually hidden / screen-reader-only nodes (ChatGPT often includes hidden
        // table text for accessibility, which would otherwise duplicate real tables in DOCX).
        try {
          const cls = className.toLowerCase();
          const styleAttr = String(el.getAttribute && el.getAttribute('style') || '').toLowerCase();
          const ariaHidden = (el.getAttribute && el.getAttribute('aria-hidden')) ? String(el.getAttribute('aria-hidden') || '').toLowerCase() : '';
          const hiddenAttr = !!(el.hasAttribute && el.hasAttribute('hidden'));
          const isHidden =
            hiddenAttr ||
            ariaHidden === 'true' ||
            /display\s*:\s*none/.test(styleAttr) ||
            /visibility\s*:\s*hidden/.test(styleAttr) ||
            /(^|\s)(sr-only|visually-hidden|screen-reader-only)(\s|$)/.test(cls) ||
            // Tailwind-style hidden utility
            /(^|\s)hidden(\s|$)/.test(cls);
          if (isHidden) return;
        } catch {}
        if (el.tagName === 'BR') {
          ensureGroup(groupId);
          acc.text += '\n';
          return;
        }
        if ((el.tagName || '').toLowerCase() === 'iframe') {
          try {
            const carrier = el.closest?.('[data-acep-artifact-html]') || null;
            const artifactHtml = String(carrier?.getAttribute?.('data-acep-artifact-html') || '').trim();
            if (artifactHtml && !/claudemcpcontent\.com\/mcp_apps/i.test(artifactHtml)) {
              const nested = parseHtmlBlocksForDocx(artifactHtml, options) || [];
              if (nested.length) {
                flush();
                nested.forEach((block) => blocks.push({ ...block, groupId: block.groupId || groupId || null }));
                return;
              }
            }
          } catch {}
          try {
            flush();
            const title = String(el.getAttribute('title') || el.getAttribute('aria-label') || '').replace(/^visualize:\s*/i, '').trim();
            const src = String(el.getAttribute('src') || '').trim();
            const isClaudeVisual = /claudemcpcontent\.com|mcp_apps/i.test(src) || /^visualize:/i.test(String(el.getAttribute('title') || ''));
            const label = title || (isClaudeVisual ? 'Claude visualization' : 'Embedded iframe');
            blocks.push({
              type: 'text',
              text: `[Visualization]: ${label}\nInteractive iframe visualizations cannot be embedded in DOCX.`,
              groupId,
            });
          } catch {}
          return;
        }
        if (el.getAttribute && el.hasAttribute('data-acep-svg')) {
          try {
            flush();
            const svgText = String(el.getAttribute('data-acep-svg') || '').trim();
            if (svgText && /<svg[\s>]/i.test(svgText)) {
              const dataUrl = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgText);
              blocks.push({ type: 'image', src: dataUrl, alt: el.getAttribute('aria-label') || el.getAttribute('title') || 'svg visual', groupId });
            }
          } catch {}
          return;
        }
        if ((el.tagName || '').toLowerCase() === 'svg') {
          try {
            flush();
            const svgText = el.outerHTML || '';
            if (svgText && /<svg[\s>]/i.test(svgText)) {
              const dataUrl = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgText);
              blocks.push({ type: 'image', src: dataUrl, alt: el.getAttribute('aria-label') || el.getAttribute('role') || 'svg visual', groupId });
            }
          } catch {}
          return;
        }

        const isKatex = (el.classList && (el.classList.contains('katex') || el.classList.contains('katex-display'))) || /(^|\s)katex(-display)?(\s|$)/.test(className);
        if (isKatex) {
          const mathml = extractMathml(el);
          if (mathml) {
            flush();
            blocks.push({ type: 'math', mathml, display: /katex-display/.test(className), groupId });
          }
          return;
        }
        // Some providers render dividers as plain text lines (e.g. "__________") inside a paragraph.
        // Convert those into explicit HR blocks so DOCX export preserves them.
        try {
          if (el.tagName === 'P' || el.tagName === 'DIV') {
            const txt = String(el.textContent || '').replace(/\u00a0/g, ' ').trim();
            const compact = txt.replace(/\s+/g, '');
            if (compact && !el.querySelector('img, table, pre, code, .katex, .katex-display, math, [data-math]') &&
              /^(_{8,}|-{3,}|\*{3,}|={8,})$/.test(compact)) {
              flush();
              blocks.push({ type: 'hr', groupId: null, inlineContinuation: false });
              return;
            }
          }
        } catch {}
        if (el.getAttribute && el.hasAttribute('data-math')) {
          const display = el.classList && (el.classList.contains('math-block') || el.classList.contains('katex-display'));
          const mathml = extractMathml(el);
          if (mathml) {
            flush();
            blocks.push({ type: 'math', mathml, display, groupId });
            return;
          }
          const tex = extractDataMath(el);
          if (tex) {
            flush();
            blocks.push({ type: 'math', mathml: '', tex, display, groupId });
          }
          return;
        }
        const isRoleTable = el.getAttribute && el.getAttribute('role') === 'table';
        const hasRoleRows = el.querySelector && el.querySelector('[role="row"]');
        if (el.tagName === 'TABLE' || isRoleTable || (hasRoleRows && el.querySelector('[role="cell"], [role="columnheader"], [role="rowheader"]'))) {
          flush();
          const tbl = tableToBody(el);
          if (tbl.body.length) blocks.push({ type: 'table', ...tbl });
          return;
        }
        if (el.tagName === 'PRE') {
          const imgsInPre = Array.from(el.querySelectorAll('img'));
          if (imgsInPre.length) {
            flush();
            imgsInPre.forEach((im) => {
              const src = (im.getAttribute('data-original-src') || im.getAttribute('src') || '').trim();
              if (src) blocks.push({ type: 'image', src, alt: im.getAttribute('alt') || '', groupId });
            });
            return;
          }
          const codeEl = el.querySelector('code') || el;
          pushCodeBlock(codeEl);
          return;
        }
        // Grok: code blocks are often wrapped in a DIV with data-testid="code-block" and a nested <pre>.
        // Treat the whole wrapper as a code block so DOCX preserves formatting even if the nested <pre>
        // is transformed or styled by the app.
        try {
          const testId = (el.getAttribute && el.getAttribute('data-testid')) ? String(el.getAttribute('data-testid') || '') : '';
          if (testId === 'code-block') {
            const pre = el.querySelector && el.querySelector('pre');
            const codeEl = pre ? (pre.querySelector('code') || pre) : (el.querySelector('code') || null);
            if (codeEl) {
              pushCodeBlock(codeEl);
              return;
            }
          }
        } catch {}
        if (el.tagName === 'IMG') {
          flush();
          const src = (el.getAttribute('data-original-src') || el.getAttribute('src') || '').trim();
          if (src) {
            const key = src.split('#')[0];
            if (seenImgSrc.has(key)) return;
            seenImgSrc.add(key);
            blocks.push({ type: 'image', src, alt: el.getAttribute('alt') || '', groupId });
          }
          return;
        }
        if (el.tagName === 'HR') {
          flush();
          blocks.push({ type: 'hr', groupId: null, inlineContinuation: false });
          return;
        }
        if (el.tagName === 'CODE') {
          if (el.closest && el.closest('pre')) return;
          pushCodeBlock(el);
          return;
        }
        if (isBlockTag(el)) {
          const isList = el.tagName === 'UL' || el.tagName === 'OL';
          const isListItem = el.tagName === 'LI';
          // Important: block-level elements must get a fresh groupId.
          // If we reuse an ancestor groupId (e.g. DIV -> P -> inline content),
          // the DOCX exporter will merge multiple paragraphs into one, making
          // the whole turn look jampacked/squeezed.
          const blockGroup = nextGroup();
          const childGroup = isList ? null : blockGroup;
          if (isList) {
            const items = Array.from(el.children).filter(c => c.tagName === 'LI');
            const startAttr = Number(el.getAttribute('start'));
            const start = Number.isFinite(startAttr) && startAttr > 0 ? startAttr : 1;
            items.forEach((li, idx) => {
              let n = start + idx;
              try {
                const liVal = Number(li.getAttribute('value'));
                if (Number.isFinite(liVal) && liVal > 0) n = liVal;
              } catch {}
              const prefix = el.tagName === 'OL' ? (String(n) + '. ') : (String.fromCharCode(8226) + ' ');
              const hasImages = li.querySelector && !!li.querySelector('img');
              const hasMath = li.querySelector && !!li.querySelector('.katex, .katex-display, math, [data-math]');
              // Each li gets its own group so the DOCX exporter creates a separate paragraph
              // per item rather than merging them all into one (which caused cramped lists).
              const liGroup = nextGroup();
              if (!hasImages && hasMath && !hasChildBlock(li)) {
                flush();
                pushRunsAndMathFrom(li, liGroup, prefix);
                flush();
              } else if (li.querySelector && (hasImages || hasMath)) {
                li.childNodes.forEach((child) => visit(child, childGroup));
                flush();
              } else {
                pushRunsFrom(li, liGroup, prefix);
              }
            });
            return;
          }
          const hasNestedTable = (() => {
            try {
              if (!el.querySelector) return false;
              if (el.querySelector('table')) return true;
              if (el.querySelector('[role="table"]')) return true;
              if (el.querySelector('[role="row"]') && el.querySelector('[role="cell"], [role="columnheader"], [role="rowheader"]')) return true;
            } catch {}
            return false;
          })();
          const hasImages = el.querySelector && !!el.querySelector('img');
          const hasMath = el.querySelector && !!el.querySelector('.katex, .katex-display, math, [data-math]');
          if (!hasImages && hasMath && !hasNestedTable && !hasChildBlock(el)) {
            flush();
            pushRunsAndMathFrom(el, blockGroup);
            flush();
          } else if (el.querySelector && (hasImages || hasMath || hasNestedTable)) {
            el.childNodes.forEach((child) => visit(child, childGroup));
            flush();
          } else {
            if (hasChildBlock(el)) {
              // Mixed block/inline children: group consecutive inline nodes so their
              // formatting context (bold, italic, link) is preserved in runs blocks.
              const pendingInline = [];
              const flushPendingInline = () => {
                if (!pendingInline.length) return;
                try {
                  const container = doc.createElement('div');
                  pendingInline.forEach((n) => { try { container.appendChild(n.cloneNode(true)); } catch {} });
                  if (container.textContent && container.textContent.trim()) {
                    flush();
                    pushRunsAndMathFrom(container, blockGroup);
                    flush();
                  }
                } catch {}
                pendingInline.length = 0;
              };
              Array.from(el.childNodes).forEach((child) => {
                if (child.nodeType === 3) {
                  if (String(child.nodeValue || '').trim()) pendingInline.push(child);
                } else if (child.nodeType === 1 && !isBlockTag(child)) {
                  pendingInline.push(child);
                } else {
                  flushPendingInline();
                  visit(child, childGroup);
                }
              });
              flushPendingInline();
            } else {
              pushRunsFrom(el, blockGroup);
            }
            flush();
          }
          return;
        }
        el.childNodes.forEach((child) => visit(child, groupId));
      } else if (node.nodeType === 3) {
        // Preserve author-intent newlines that come through as literal text nodes.
        // Some providers include line breaks as actual "\n" characters rather than <br>.
        const txt = String(node.nodeValue || '').replace(/\u00a0/g, ' ');
        if (txt.trim()) {
          ensureGroup(groupId);
          acc.inlineContinuation = true;
          // If the text node contains a newline, avoid forcing a space join (keeps "line by line" lists).
          const joiner = (acc.text && !acc.text.endsWith('\n') && !txt.startsWith('\n') && !txt.includes('\n')) ? ' ' : '';
          acc.text += (acc.text ? joiner : '') + txt;
        }
      }
    };
    doc.body.childNodes.forEach((child) => visit(child, null));
    flush();
    // Gemini occasionally yields only plain text blocks even with inline tags.
    // If we see inline tags but no runs, synthesize a single runs block to preserve bold/italic/links.
    const hasRuns = blocks.some((b) => b && b.type === 'runs' && Array.isArray(b.runs) && b.runs.length);
    const hasInlineTags = /<(b|strong|i|em|u|a)\b/i.test(html || '');
    if (!hasRuns && hasInlineTags) {
      try {
        const runs = collectInlineRuns(doc.body);
        if (Array.isArray(runs) && runs.length) {
          blocks.length = 0;
          blocks.push({ type: 'runs', runs, groupId: null, inlineContinuation: false });
        }
      } catch {}
    }
  } catch {
    const text = htmlToPlainTextLocal(html || '');
    if (text) blocks.push({ type: 'text', text });
  }
  if (!allowAsciiTables) return blocks;
  const processed = [];
  blocks.forEach((block) => {
    if (!block || block.type !== 'text') { if (block) processed.push(block); return; }
    const mdResult = extractMarkdownPipeTableFromText(block.text || '');
    if (mdResult) {
      const { table, prefix, suffix } = mdResult;
      if (prefix) processed.push({ type: 'text', text: prefix, groupId: block.groupId, inlineContinuation: block.inlineContinuation });
      processed.push({ type: 'table', ...table, groupId: block.groupId });
      if (suffix) processed.push({ type: 'text', text: suffix, groupId: block.groupId, inlineContinuation: block.inlineContinuation });
      return;
    }
    const result = extractAsciiTableFromText(block.text || '');
    if (!result) { processed.push(block); return; }
    const { table, prefix, suffix } = result;
    if (prefix) processed.push({ type: 'text', text: prefix, groupId: block.groupId, inlineContinuation: block.inlineContinuation });
    processed.push({ type: 'table', ...table, groupId: block.groupId });
    if (suffix) processed.push({ type: 'text', text: suffix, groupId: block.groupId, inlineContinuation: block.inlineContinuation });
  });
  return processed;
}

export function renderMarkdownTableFromBody(body) {
  try {
    if (!Array.isArray(body) || !body.length) return '';
    const rows = body.map(r => (Array.isArray(r) ? r : []));
    const esc = (s) => String(s == null ? '' : s).replace(/\|/g, '\\|').trim();
    const widths = [];
    rows.forEach(r => r.forEach((c, i) => { const len = esc(c).length; widths[i] = Math.max(widths[i] || 3, len); }));
    const fmtRow = (r) => '| ' + r.map((c, i) => {
      const t = esc(c);
      const pad = widths[i] - t.length;
      return t + ' '.repeat(pad) + ' ';
    }).join('| ') + '|';
    const header = rows[0] || [];
    const sep = '| ' + header.map((_, i) => '-'.repeat(Math.max(3, widths[i] || 3)) + ' ').join('| ') + '|';
    const out = [];
    out.push(fmtRow(header));
    out.push(sep);
    for (let i = 1; i < rows.length; i++) out.push(fmtRow(rows[i]));
    return out.join('\n');
  } catch { return ''; }
}

export function buildPlainTextFromBlocks(blocks = []) {
  if (!Array.isArray(blocks) || !blocks.length) return '';
  const parts = [];
  const runsToText = (runs = [], { includeLinks = false } = {}) => {
    if (!Array.isArray(runs) || !runs.length) return '';
    let out = '';
    let curLink = '';
    let curHasText = false;
    const flushLink = () => {
      if (includeLinks && curLink && curHasText) {
        out += (out.endsWith(' ') || out.endsWith('\n') ? '' : ' ') + curLink;
      }
      curLink = '';
      curHasText = false;
    };
    for (const r of runs) {
      const t = (r && typeof r.text === 'string') ? r.text : '';
      const link = (includeLinks && r && r.link) ? String(r.link || '').trim() : '';
      if (curLink && link !== curLink) flushLink();
      if (link && !curLink) curLink = link;
      if (t) {
        out += t;
        if (link && t.replace(/\s+/g, '').length) curHasText = true;
      }
      if (!link && curLink) flushLink();
    }
    flushLink();
    return out
      .replace(/\u00a0/g, ' ')
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\n[ \t]+/g, '\n')
      .replace(/\s{2,}/g, ' ')
      .trim();
  };
  blocks.forEach((b) => {
    if (!b) return;
    if (b.type === 'table' && Array.isArray(b.body) && b.body.length) {
      const md = renderMarkdownTableFromBody(b.body);
      if (md) parts.push(md);
    } else if (b.type === 'code' && b.text && b.text.trim()) {
      parts.push(b.text.trim());
    } else if (b.type === 'text' && b.text && b.text.trim()) {
      parts.push(b.text.trim());
    } else if (b.type === 'runs' && Array.isArray(b.runs) && b.runs.length) {
      const t = runsToText(b.runs, { includeLinks: true });
      if (t) parts.push(t);
    } else if (b.type === 'math' && b.tex) {
      parts.push(String(b.tex).trim());
    } else if (b.type === 'hr') {
      parts.push('---');
    }
  });
  return parts.join('\n\n').replace(/\n{3,}/g, '\n\n').trim();
}
