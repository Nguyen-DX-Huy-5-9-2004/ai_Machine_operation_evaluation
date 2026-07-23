// Shared HTML exporter helpers.
// This module is used by popup.js to post-process the scraped HTML and inject:
// - header/title/subtitle/user info
// - theme + typography CSS
// - optional role icons for the minimal `.acep-turn` structure

import { loadIconAssets, loadIconFromCandidates } from '../icon_assets.js';

const ASSISTANT_ICON_FALLBACK = ['icons/chatgpt-purple.PNG', 'icons/icon_chatgpt.png'];

function runtimeGetUrl(path) {
  const getURL =
    globalThis?.browser?.runtime?.getURL ||
    globalThis?.chrome?.runtime?.getURL;
  if (typeof getURL !== 'function') throw new Error('runtime.getURL not available');
  return getURL.call(globalThis.browser?.runtime || globalThis.chrome?.runtime, path);
}

function arrayBufferToBase64(buf) {
  let binary = '';
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

async function loadKatexCssText() {
  if (globalThis.__ACEP_KATEX_CSS__) return globalThis.__ACEP_KATEX_CSS__;
  try {
    const resp = await fetch(runtimeGetUrl('libs/katex.min.css'));
    if (resp.ok) {
      const txt = await resp.text();
      globalThis.__ACEP_KATEX_CSS__ = txt;
      return txt;
    }
  } catch {}
  globalThis.__ACEP_KATEX_CSS__ = '';
  return '';
}

async function loadKatexCssTextInlineFonts() {
  if (globalThis.__ACEP_KATEX_CSS_INLINE__) return globalThis.__ACEP_KATEX_CSS_INLINE__;
  const css = await loadKatexCssText();
  if (!css) return '';
  const fontUrlRe = /url\((fonts\/[^)]+\.woff2)\)/g;
  const fontPaths = new Set();
  let m;
  while ((m = fontUrlRe.exec(css))) fontPaths.add(m[1]);
  const replacements = {};
  for (const relPath of fontPaths) {
    try {
      const resp = await fetch(runtimeGetUrl(`libs/${relPath}`));
      if (!resp.ok) continue;
      const buf = await resp.arrayBuffer();
      const b64 = arrayBufferToBase64(buf);
      replacements[relPath] = `data:font/woff2;base64,${b64}`;
    } catch {}
  }
  let out = css;
  for (const relPath of Object.keys(replacements)) {
    const safe = relPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    out = out.replace(new RegExp(`url\\(${safe}\\)`, 'g'), `url(${replacements[relPath]})`);
  }
  globalThis.__ACEP_KATEX_CSS_INLINE__ = out;
  return out;
}

// Lightweight syntax highlighter — runs at export time, no runtime JS needed.
// Produces <span class="tok-*"> elements; CSS is injected by buildHtmlWithHeader.
export function highlightCode(code, lang) {
  const L = (lang || '').toLowerCase();
  const langKey = {
    js:'js', javascript:'js', jsx:'js', mjs:'js', cjs:'js',
    ts:'ts', typescript:'ts', tsx:'ts',
    py:'py', python:'py',
    css:'css', scss:'css', less:'css',
    sql:'sql',
    sh:'sh', bash:'sh', shell:'sh', zsh:'sh',
    java:'java', kotlin:'java', kt:'java',
    go:'go', golang:'go',
    rs:'rs', rust:'rs',
    json:'json',
    html:'html', xml:'html', htm:'html',
    c:'c', cpp:'cpp', 'c++':'cpp', cc:'cpp',
  }[L];
  if (!langKey) return code.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

  const KWS = {
    js:  'var let const function class return if else for while do switch case default break continue new delete typeof instanceof in of import export from async await try catch finally throw this super extends static get set null undefined true false void yield',
    ts:  'var let const function class return if else for while do switch case default break continue new delete typeof instanceof in of import export from async await try catch finally throw this super extends static get set null undefined true false void yield interface type enum namespace declare abstract implements readonly private public protected override any string number boolean never unknown object symbol',
    py:  'def class return if elif else for while break continue import from as with try except finally raise pass in not and or is lambda yield global nonlocal True False None self cls async await del assert print',
    css: 'important auto inherit initial unset revert none block inline flex grid absolute relative fixed sticky static center left right top bottom solid dashed dotted hidden visible normal bold italic',
    sql: 'SELECT FROM WHERE AND OR NOT IN LIKE BETWEEN JOIN LEFT RIGHT INNER OUTER FULL CROSS ON AS ORDER BY GROUP HAVING INSERT INTO VALUES UPDATE SET DELETE CREATE DROP ALTER TABLE INDEX VIEW DATABASE DISTINCT UNION LIMIT OFFSET NULL IS EXISTS COUNT SUM AVG MAX MIN CASE WHEN THEN ELSE END WITH OVER PARTITION',
    sh:  'if then else elif fi for while do done case esac in function return exit export source echo local readonly unset shift true false',
    java:'class interface extends implements import package public private protected static final abstract new return if else for while do switch case default break continue try catch finally throw throws this super null true false void int long double float boolean char byte short',
    go:  'func var const type struct interface map chan go defer select case default if else for range return break continue switch import package nil true false new make len cap append copy delete panic recover',
    rs:  'fn let mut const struct enum trait impl use mod pub crate super self return if else for while loop match break continue in where type as ref move dyn async await true false',
    json:'true false null',
    html:'',
    c:   'auto break case char const continue default do double else enum extern float for goto if inline int long register return short signed sizeof static struct switch typedef union unsigned void volatile while NULL true false',
    cpp: 'auto break case char class const continue default delete do double else enum extern float for goto if inline int long namespace new nullptr operator private protected public register return short signed sizeof static struct switch template this throw try typedef typename union unsigned using virtual void volatile while NULL true false',
  };
  const kwSet = new Set((KWS[langKey] || '').split(' ').filter(Boolean));

  const e = (s) => s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  const sp = (cls, s) => `<span class="tok-${cls}">${e(s)}</span>`;

  const out = [];
  let pos = 0;
  const src = code;
  const hasSLC  = ['js','ts','java','go','rs','c','cpp'].includes(langKey); // //
  const hasHash = ['py','sh'].includes(langKey);                            // #
  const hasDash = langKey === 'sql';                                        // --
  const hasMLC  = ['js','ts','java','go','rs','c','cpp','css'].includes(langKey); // /* */

  while (pos < src.length) {
    const ch = src[pos];

    // Multi-line comment /* ... */
    if (hasMLC && ch === '/' && src[pos+1] === '*') {
      const end = src.indexOf('*/', pos + 2);
      const text = end === -1 ? src.slice(pos) : src.slice(pos, end + 2);
      out.push(sp('cmt', text)); pos += text.length; continue;
    }
    // Single-line comment //
    if (hasSLC && ch === '/' && src[pos+1] === '/') {
      const end = src.indexOf('\n', pos);
      const text = end === -1 ? src.slice(pos) : src.slice(pos, end);
      out.push(sp('cmt', text)); pos += text.length; continue;
    }
    // Hash comment #
    if (hasHash && ch === '#') {
      const end = src.indexOf('\n', pos);
      const text = end === -1 ? src.slice(pos) : src.slice(pos, end);
      out.push(sp('cmt', text)); pos += text.length; continue;
    }
    // SQL comment --
    if (hasDash && ch === '-' && src[pos+1] === '-') {
      const end = src.indexOf('\n', pos);
      const text = end === -1 ? src.slice(pos) : src.slice(pos, end);
      out.push(sp('cmt', text)); pos += text.length; continue;
    }
    // Python / generic triple-quoted strings
    if (langKey === 'py' && (src.startsWith('"""', pos) || src.startsWith("'''", pos))) {
      const q = src.slice(pos, pos + 3);
      const end = src.indexOf(q, pos + 3);
      const text = end === -1 ? src.slice(pos) : src.slice(pos, end + 3);
      out.push(sp('str', text)); pos += text.length; continue;
    }
    // Strings: " ' and ` (backtick for JS/TS)
    if (ch === '"' || ch === "'" || (ch === '`' && (langKey === 'js' || langKey === 'ts'))) {
      let i = pos + 1;
      while (i < src.length) {
        if (src[i] === '\\') { i += 2; continue; }
        if (src[i] === ch)   { i++; break; }
        if (ch !== '`' && src[i] === '\n') break;
        i++;
      }
      out.push(sp('str', src.slice(pos, i))); pos = i; continue;
    }
    // Numbers
    if (/[0-9]/.test(ch) || (ch === '.' && /[0-9]/.test(src[pos+1] || ''))) {
      const m = src.slice(pos).match(/^(0x[\da-fA-F]+|0b[01]+|\d+\.?\d*([eE][+-]?\d+)?|\.\d+)/);
      if (m) { out.push(sp('num', m[0])); pos += m[0].length; continue; }
    }
    // HTML/XML tags
    if (langKey === 'html' && ch === '<') {
      const m = src.slice(pos).match(/^<(!--|\/)?([a-zA-Z][a-zA-Z0-9:-]*)?([\s\S]*?)(\/?>>?)/);
      if (m) {
        // Color tag name + attributes individually
        let raw = m[0], result = '';
        const tagNameM = raw.match(/^<\/?([a-zA-Z][a-zA-Z0-9:-]*)/);
        if (tagNameM) {
          const pre = raw.slice(0, tagNameM.index + (raw[1] === '/' ? 2 : 1));
          result += e(pre);
          result += sp('tag', tagNameM[1]);
          let rest = raw.slice(tagNameM.index + tagNameM[0].length);
          // Color attribute names
          rest = rest.replace(/([a-zA-Z][a-zA-Z0-9:-]*)(?=\s*=)/g, sp('attr', '$1'));
          result += rest.replace(/&/g,'&amp;').replace(/<(?!span)/g,'&lt;');
        } else {
          result = e(raw);
        }
        out.push(result); pos += raw.length; continue;
      }
    }
    // JSON property keys  "key":
    if (langKey === 'json' && ch === '"') {
      let i = pos + 1;
      while (i < src.length && src[i] !== '"') { if (src[i] === '\\') i++; i++; }
      i++;
      const isKey = /\s*:/.test(src.slice(i, i + 3));
      out.push(sp(isKey ? 'attr' : 'str', src.slice(pos, i))); pos = i; continue;
    }
    // CSS @-rules and selectors (basic)
    if (langKey === 'css' && ch === '@') {
      const m = src.slice(pos).match(/^@[a-zA-Z-]+/);
      if (m) { out.push(sp('kw', m[0])); pos += m[0].length; continue; }
    }
    // Identifiers and keywords
    if (/[a-zA-Z_$]/.test(ch)) {
      const m = src.slice(pos).match(/^[a-zA-Z_$][\w$]*/);
      if (m) {
        const word = m[0];
        const isSqlKw = langKey === 'sql' && kwSet.has(word.toUpperCase());
        if (kwSet.has(word) || isSqlKw) {
          out.push(sp('kw', word));
        } else if (src[pos + word.length] === '(') {
          out.push(sp('fn', word));
        } else if (/^[A-Z][a-zA-Z0-9]*$/.test(word) && langKey !== 'json') {
          out.push(sp('cls', word));
        } else {
          out.push(e(word));
        }
        pos += word.length; continue;
      }
    }
    out.push(e(ch)); pos++;
  }
  return out.join('');
}

function getCodeTextWithLineBreaks(root) {
  try {
    const blockTags = new Set(['DIV','P','LI','TR']);
    const out = [];
    const pushNewline = () => {
      if (out.length && out[out.length - 1] !== '\n') out.push('\n');
    };
    const walk = (node) => {
      if (!node) return;
      if (node.nodeType === 3) {
        out.push(String(node.nodeValue || ''));
        return;
      }
      if (node.nodeType !== 1) return;
      const tag = String(node.tagName || '').toUpperCase();
      if (tag === 'BR') {
        pushNewline();
        return;
      }
      const isLineLike = blockTags.has(tag) || /\b(line|code-line|cm-line)\b/i.test(String(node.className || ''));
      if (isLineLike) pushNewline();
      Array.from(node.childNodes || []).forEach(walk);
      if (isLineLike) pushNewline();
    };
    walk(root);
    return out.join('').replace(/\n{3,}/g, '\n\n').replace(/^\n+|\n+$/g, '');
  } catch {
    return root?.textContent || '';
  }
}

export function hasKatexInHtml(html = '', rows = []) { 
  const hasMath = (s) => typeof s === 'string' && ( 
    /class=["'][^"']*katex/i.test(s) || 
    /<math[\s>]/i.test(s) || 
    /data-math=/i.test(s) || 
    // Raw TeX delimiters (common in Grok/Markdown exports before normalization)
    /\$\$[\s\S]{1,2000}?\$\$/.test(s) || 
    /\\\([\s\S]{1,2000}?\\\)/.test(s) || 
    /\\\[[\s\S]{1,2000}?\\\]/.test(s)
  ); 
  if (hasMath(html)) return true; 
  return (rows || []).some((row) => hasMath(row?.html)); 
} 
 
export async function buildHtmlWithHeader(html = '', adv = {}, headerFilename = '', subHeading = '', opts = {}) { 
  try { 
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    if (!doc || !doc.documentElement) return html;

    const body = doc.body || doc.documentElement;
    
    // Remove duplicate title heading if one exists at the start of body
    // (we will add it in the header section instead)
    if (headerFilename && body.firstChild) {
      try {
        const firstHeading = body.querySelector('h1, h2, h3');
        if (firstHeading && firstHeading.parentElement === body) {
          // Only remove if it's the first meaningful child
          let node = body.firstChild;
          while (node) {
            if (node.nodeType === 1) { // Element node
              if (node === firstHeading) firstHeading.remove();
              break;
            }
            node = node.nextSibling;
          }
        }
      } catch {}
    }
    const head = doc.head || doc.createElement('head');
    if (!doc.head) doc.documentElement.insertBefore(head, body);

    // Ensure charset is declared first so browsers don't fall back to Windows-1252
    if (!head.querySelector('meta[charset]')) {
      const charsetMeta = doc.createElement('meta');
      charsetMeta.setAttribute('charset', 'utf-8');
      head.insertBefore(charsetMeta, head.firstChild);
    }

    // Debug stamp so exported HTML can confirm this post-processing ran.
    try {
      doc.documentElement.setAttribute('data-acep-html-built-by', 'core.exporters.html.buildHtmlWithHeader');
      doc.documentElement.setAttribute('data-acep-html-built-ts', String(Date.now()));
    } catch {}

    const fontMap = {
      NotoSans: '"Noto Sans", "Segoe UI", Arial, sans-serif',
      ArialBlack: '"Arial Black", Arial, sans-serif',
      TimesNewRoman: '"Times New Roman", Times, serif',
      Roman: 'Roman, "Times New Roman", serif',
      Calibri: 'Calibri, "Segoe UI", sans-serif',
    };
    const isDark = (adv.theme || 'light') === 'dark';
    const bg = isDark ? '#0d0f14' : '#ffffff';
    const text = isDark ? '#e5e7eb' : '#111827';
    const accent = isDark ? '#93c5fd' : '#2563eb';
    const baseFont = fontMap[adv.font || 'TimesNewRoman'] || fontMap.TimesNewRoman || fontMap.NotoSans;
    const baseSize = Math.max(8, Number(adv.fontSize) || 11);
    const forPng = !!opts.forPng;
    const extraCss = String(opts.extraCss || ''); 
    const providerKey = String(opts.providerKey || '').trim().toLowerCase(); 
    const t = (typeof opts.t === 'function') ? opts.t : (() => '');
    const removeIcons = !!adv.removeIcons;
    const disableRoleIcons = !!opts.disableRoleIcons;

    // Strip any surviving citation chips: spans with aria-haspopup but no <img> inside.
    // These are ChatGPT Radix UI citation pills that render as visible boxes in the export.
    // Runs here as a final safety net after all content.js processing.
    try {
      doc.querySelectorAll('span[aria-haspopup]').forEach(el => {
        if (!el.querySelector('img')) el.remove();
      });
      const citationTextNodes = [];
      const walker = doc.createTreeWalker(body, NodeFilter.SHOW_TEXT, null);
      let node;
      while ((node = walker.nextNode())) {
        if (/\uE200(?:file)?cite\uE202|(?:file)?cite(?:turn|)|îˆ€(?:file)?citeîˆ‚/i.test(node.nodeValue || '')) {
          citationTextNodes.push(node);
        }
      }
      citationTextNodes.forEach((textNode) => {
        textNode.nodeValue = String(textNode.nodeValue || '')
          .replace(/\uE200(?:file)?cite\uE202[\s\S]*?\uE201/g, '')
          .replace(/îˆ€(?:file)?citeîˆ‚[^<\n\r]*(?:îˆ)?/g, '')
          .replace(/\s*(?:file)?citeturn[^\s<]*/gi, '')
          .replace(/\s*filecite[^\s<]*/gi, '');
      });
    } catch {}

    // ChatGPT web-search image galleries can arrive at this final stage as plain
    // adjacent <img> tags (the earlier scrape row metadata is sometimes lost by
    // later HTML/image processing). Re-wrap only public, non-ChatGPT image URLs
    // into a compact gallery so uploaded/generated ChatGPT backend images are not
    // accidentally grouped.
    try {
      if (providerKey === 'chatgpt') {
        const isPublicGalleryImg = (img) => {
          try {
            if (!img || img.closest('.acep-chatgpt-image-gallery')) return false;
            if (img.classList && img.classList.contains('role-icon')) return false;
            const src = String(img.getAttribute('data-original-src') || img.getAttribute('src') || '').trim();
            if (!/^https?:\/\//i.test(src)) return false;
            const url = new URL(src);
            if (/(\.|^)chatgpt\.com$/i.test(url.hostname)) return false;
            if (/(\.|^)openai\.com$/i.test(url.hostname)) return false;
            if (/google\.com\/s2\/favicons/i.test(src)) return false;
            return true;
          } catch {
            return false;
          }
        };
        const removableWrapper = (img) => {
          try {
            const parent = img && img.parentElement;
            if (!parent || parent === body) return img;
            if (parent.classList && parent.classList.contains('acep-bubble')) return img;
            const text = String(parent.textContent || '').replace(/\s+/g, '').trim();
            const imgCount = parent.querySelectorAll('img').length;
            if (!text && imgCount === 1) return parent;
          } catch {}
          return img;
        };
        const scopes = Array.from(body.querySelectorAll('.acep-turn[data-acep-role="assistant"], [data-acep-role="assistant"]'));
        const scanScopes = scopes.length ? scopes : [body];
        scanScopes.forEach((scope) => {
          try {
            if (scope.querySelector('.acep-chatgpt-image-gallery')) return;
            const imgs = Array.from(scope.querySelectorAll('img')).filter(isPublicGalleryImg);
            if (imgs.length < 2 || imgs.length > 4) return;
            const columns = Math.max(1, Math.min(imgs.length, 4));
            const gallery = doc.createElement('div');
            gallery.className = 'acep-chatgpt-image-gallery';
            gallery.style.cssText = `--acep-gallery-columns:${columns};display:grid;grid-template-columns:repeat(${columns},minmax(0,1fr));gap:4px;margin:8px 0 14px 0;overflow:hidden;width:640px;max-width:100%;align-items:stretch;`;
            imgs.forEach((sourceImg, imageIndex) => {
              const tile = doc.createElement('div');
              tile.className = `acep-chatgpt-image-tile ${imageIndex === 0 ? 'rounded-s-xl' : ''} ${imageIndex === imgs.length - 1 ? 'rounded-e-xl' : ''}`.trim();
              tile.style.cssText = 'width:100%;max-width:100%;aspect-ratio:5/4;overflow:hidden;border-radius:12px;min-width:0;margin:0;padding:0;clear:none;position:relative;box-sizing:border-box;';
              const img = sourceImg.cloneNode(true);
              img.removeAttribute('width');
              img.removeAttribute('height');
              img.style.cssText = 'width:100%;height:100%;max-width:none;object-fit:cover;display:block;margin:0;padding:0;border-radius:12px;clear:none;';
              tile.appendChild(img);
              gallery.appendChild(tile);
            });
            const firstTarget = removableWrapper(imgs[0]);
            firstTarget.replaceWith(gallery);
            imgs.slice(1).forEach((img) => {
              try { removableWrapper(img).remove(); } catch {}
            });
          } catch {}
        });
      }
    } catch {}

    // Syntax highlighting — applied before KaTeX so spans don't interfere
    try {
      const SKIP_LANGS = new Set(['mermaid','svg','math','latex','text','plaintext','plain','']);
      doc.querySelectorAll('pre code[class*="language-"]').forEach(codeEl => {
        const cls = Array.from(codeEl.classList).find(c => c.startsWith('language-')) || '';
        const lang = cls.replace('language-', '').toLowerCase();
        if (SKIP_LANGS.has(lang)) return;
        const rawText = getCodeTextWithLineBreaks(codeEl);
        if (!rawText.trim()) return;
        try { codeEl.innerHTML = highlightCode(rawText, lang); } catch {}
      });
    } catch {}

    const needsKatex = hasKatexInHtml(html, []); 
    // Convert raw TeX delimiters ($$...$$, \(..\), \[..]) into data-math placeholders
    // so the KaTeX pre-render step can run for PNG/HTML exports.
    if (needsKatex) { 
      try { 
        const walker = doc.createTreeWalker(body, NodeFilter.SHOW_TEXT, null); 
        const texBlock = /\$\$([\s\S]+?)\$\$/g; 
        const texInline1 = /\\\(([\s\S]+?)\\\)/g; 
        const texInline2 = /\\\[(\s*[\s\S]+?\s*)\\\]/g; 
        const shouldSkip = (n) => { 
          try { 
            const p = n && n.parentElement; 
            if (!p) return true; 
            if (p.closest('pre, code, script, style')) return true; 
            if (p.closest('.katex')) return true; 
            return false; 
          } catch { 
            return true; 
          } 
        }; 
        const toChunks = (text, re, display) => { 
          const out = []; 
          let last = 0; 
          re.lastIndex = 0; 
          let m; 
          while ((m = re.exec(text))) { 
            const idx = m.index; 
            if (idx > last) out.push({ type: 'text', value: text.slice(last, idx) }); 
            out.push({ type: 'math', value: String(m[1] || '').trim(), display }); 
            last = idx + m[0].length; 
          } 
          if (last < text.length) out.push({ type: 'text', value: text.slice(last) }); 
          return out; 
        }; 
        const nodes = []; 
        while (walker.nextNode()) { nodes.push(walker.currentNode); } 
        nodes.forEach((tn) => { 
          try { 
            if (!tn || !tn.nodeValue) return; 
            if (shouldSkip(tn)) return; 
            const raw = String(tn.nodeValue); 
            if (!raw.includes('$$') && !raw.includes('\\(') && !raw.includes('\\[')) return; 
            let chunks = [{ type: 'text', value: raw }]; 
            // Apply block first, then inline
            chunks = chunks.flatMap(c => c.type === 'text' ? toChunks(c.value, texBlock, true) : [c]); 
            chunks = chunks.flatMap(c => c.type === 'text' ? toChunks(c.value, texInline2, true) : [c]); 
            chunks = chunks.flatMap(c => c.type === 'text' ? toChunks(c.value, texInline1, false) : [c]); 
            if (!chunks.some(c => c.type === 'math')) return; 
            const frag = doc.createDocumentFragment(); 
            chunks.forEach((c) => { 
              if (!c || !c.value) return; 
              if (c.type === 'text') { 
                frag.appendChild(doc.createTextNode(c.value)); 
                return; 
              } 
              const el = doc.createElement(c.display ? 'div' : 'span'); 
              el.setAttribute('data-math', c.value); 
              el.className = c.display ? 'math-block' : 'math-inline'; 
              frag.appendChild(el); 
            }); 
            tn.parentNode && tn.parentNode.replaceChild(frag, tn); 
          } catch {} 
        }); 
      } catch {} 
    } 
    // Pre-render data-math placeholder elements (API-scraped content) using KaTeX so the
    // exported HTML contains proper .katex-mathml/.katex-html sub-elements, not raw LaTeX text.
    if (needsKatex) {
      const katex = (typeof window !== 'undefined' && window.katex?.renderToString) ? window.katex : null;
      if (katex) {
        Array.from(doc.querySelectorAll('[data-math]')).forEach(el => {
          const tex = el.getAttribute('data-math') || '';
          if (!tex) return;
          // Safety: never render math inside code blocks, even if a provider accidentally
          // emitted a data-math placeholder there.
          try {
            if (el.closest && el.closest('pre, code')) return;
          } catch {}
          const isDisplay = el.classList.contains('math-block') || el.classList.contains('katex-display');
          try {
            const tmp = doc.createElement(isDisplay ? 'div' : 'span');
            tmp.innerHTML = katex.renderToString(tex, { displayMode: isDisplay, throwOnError: false, strict: 'ignore' });
            if (el.parentNode) el.replaceWith(tmp.firstChild || tmp);
          } catch {}
        });
      }
    }
    // Keep KaTeX styling as close to upstream as possible to avoid breaking layout.
    // Inline KaTeX fonts by default for exported HTML (opened locally), otherwise KaTeX font metrics
    // can differ and equations may "jump" or overlap.
    const inlineKatexFonts = (opts.inlineKatexFonts !== false);
    const katexCss = needsKatex
      ? (inlineKatexFonts ? await loadKatexCssTextInlineFonts() : await loadKatexCssText())
      : '';

    if (needsKatex && inlineKatexFonts) {
      try {
        const preload = doc.createElement('div');
        preload.id = 'acep-katex-font-preload';
        preload.setAttribute('aria-hidden', 'true');
        preload.style.position = 'absolute';
        preload.style.left = '-10000px';
        preload.style.top = '0';
        preload.style.whiteSpace = 'nowrap';
        preload.style.opacity = '0';
        preload.style.fontSize = '32px';
        preload.innerHTML = `
          <span style="font-family:KaTeX_Size1">(</span>
          <span style="font-family:KaTeX_Size2">[</span>
          <span style="font-family:KaTeX_AMS">∂</span>
          <span style="font-family:KaTeX_Size3">{</span>
          <span style="font-family:KaTeX_Size4">|</span>
        `;
        (doc.body || body).appendChild(preload);
      } catch {}
    }

    try {
      if (providerKey) doc.documentElement.classList.add(`acep-provider-${providerKey}`);
    } catch {}

    // Apply global styling
    // - For HTML exports: use full-width layout so assistant turns sit at the left edge (not a centered column).
    // - For PNG rendering: keep a fixed-width centered column for consistent raster output.
    if (forPng) {
      body.style.margin = '24px auto';
      body.style.maxWidth = '900px';
      body.style.padding = '0 12px 24px';
      body.style.boxSizing = 'border-box';
    } else {
      // Keep HTML exports full-width, but preserve some horizontal padding so user bubbles
      // don’t appear flush against the edge of the page.
      body.style.margin = '24px 12px';
      body.style.maxWidth = 'none';
      body.style.padding = '0 12px 24px';
    }
    body.style.backgroundColor = bg;
    body.style.color = text;
    body.style.setProperty('background-color', bg, 'important');
    body.style.setProperty('color', text, 'important');
    body.style.fontFamily = baseFont;
    body.style.fontSize = `${baseSize}px`;
    body.style.lineHeight = forPng ? '1.3' : '1.5';
    doc.documentElement.style.backgroundColor = bg;

    const style = doc.createElement('style');
    style.textContent = `
      body a { color: ${accent}; text-decoration: underline; cursor: pointer; }
      body h1, body h2, body h3, body h4, body h5, body h6 { margin: 4px 0 8px; color: ${text}; font-size: ${baseSize + 2}px; font-weight: 700; }
      /* Reset baked-in chat bubble backgrounds so dark mode can control them */
      .message-bubble,
      .markdown,
      .prose,
      .content,
      .whitespace-pre-wrap,
      p, li {
        background: transparent !important;
        color: ${text} !important;
      }
       /* KaTeX — use standard visual HTML rendering; fonts are base64-inlined so offline works */
       ${needsKatex ? `
       /* Prefer KaTeX HTML layer; hide MathML layer to avoid overlapping/duplicated glyphs */
       .katex .katex-mathml{ display:none !important; }
       .katex .katex-html{ display:inline !important; }
       math annotation { display: none !important; }
       ` : ''}
       /* Images: prevent tiny thumbnails from provider inline styles */
       img{ max-width:100% !important; height:auto !important; }
       /* Exporter-injected uploaded images: make them readable without forcing full-width. */
       img[data-acep-upload-img="1"]{
         width:min(100%, 720px) !important;
         max-width:100% !important;
         height:auto !important;
       }
       img[style*="width:" i]:not([data-acep-upload-img="1"]):not(.acep-chatgpt-image-gallery img){ width:auto !important; }
       img[style*="height:" i]:not(.acep-chatgpt-image-gallery img){ height:auto !important; }
       .acep-chatgpt-image-gallery{ display:grid !important; grid-template-columns:repeat(var(--acep-gallery-columns, 3), minmax(0, 1fr)) !important; gap:4px !important; width:640px !important; max-width:100% !important; margin:8px 0 14px 0 !important; overflow:hidden !important; align-items:stretch !important; }
       .acep-chatgpt-image-gallery > .acep-chatgpt-image-tile{ width:100% !important; max-width:100% !important; aspect-ratio:5/4 !important; overflow:hidden !important; border-radius:12px !important; margin:0 !important; padding:0 !important; box-sizing:border-box !important; }
       .acep-chatgpt-image-gallery img{ width:100% !important; height:100% !important; max-width:none !important; object-fit:cover !important; display:block !important; margin:0 !important; padding:0 !important; border-radius:12px !important; }
       body img:not(.role-icon):not([alt="user-icon"]):not([alt="assistant-icon"]){ object-position:50% 0% !important; }
       /* Contain long display equations within the page (no horizontal overflow into the margin). */
      .katex-display{
        max-width:100%;
        box-sizing:border-box;
        overflow-x:auto;
        overflow-y:hidden;
        -webkit-overflow-scrolling:touch;
        scrollbar-width:none;
      }
       .katex-display::-webkit-scrollbar{ height:0; width:0; }
      /* Tables (consistent for PNG/HTML exports) */
      table { width: 100%; border-collapse: collapse; margin: 10px 0; }
      th, td { border: 1px solid ${isDark ? '#374151' : '#e5e7eb'}; padding: 8px 10px; vertical-align: top; }
      th { background: ${isDark ? '#111827' : '#f3f4f6'}; font-weight: 700; }
      td { background: transparent; }
      pre, code { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace; }
      /* Restore readable spacing when provider utility CSS isn't present */
      .content { line-height: ${forPng ? '1.35' : '1.55'}; }
      .content p, .content ul, .content ol, .content blockquote, .content pre, .content table { margin: 0.75em 0; }
      .content li { margin: 0.25em 0; }
      .content ul, .content ol { padding-left: 1.4em; }
      .content > :first-child { margin-top: 0; }
      .content > :last-child { margin-bottom: 0; }

      /* New provider-split HTML uses .acep-turn without .content wrappers */
      [data-acep-role] { line-height: ${forPng ? '1.35' : '1.55'}; }
      [data-acep-role] p, [data-acep-role] ul, [data-acep-role] ol, [data-acep-role] blockquote, [data-acep-role] pre, [data-acep-role] table { margin: 0.75em 0; }
      [data-acep-role] li { margin: 0.25em 0; }
      [data-acep-role] ul, [data-acep-role] ol { padding-left: 1.4em; }
      [data-acep-role] > :first-child { margin-top: 0; }
      [data-acep-role] > :last-child { margin-bottom: 0; }
      ${isDark ? `
      /* Turn layout (provider-split HTML wraps content in .acep-turn > .acep-bubble) */
      .acep-turn{ display:flex; flex-direction:column; width:100%; gap:8px; margin:0 0 18px 0; overflow:hidden; }
      .acep-turn[data-acep-role="user"]{ align-items:flex-end; }
      .acep-turn[data-acep-role="assistant"]{ align-items:flex-start; }
      /* Bubble styling */
      .acep-turn[data-acep-role="user"] > .acep-bubble{
        background:#0f1622 !important;
        color:#f9fafb !important;
        padding:12px 14px !important;
        border-radius:16px !important;
        max-width:78%;
        box-sizing:border-box;
        overflow-wrap:break-word;
        word-break:break-word;
        border:1px solid #1f2937 !important;
      }
      .acep-turn[data-acep-role="assistant"] > .acep-bubble{
        background:transparent !important;
        color:${text} !important;
        padding:0 !important;
        width:100%;
        max-width:100%;
        box-sizing:border-box;
        overflow-wrap:break-word;
      }
      /* Let bubble text color cascade naturally; avoid wildcard overrides that break code blocks. */
      .acep-turn > .acep-bubble .message-bubble,
      .acep-turn > .acep-bubble .markdown,
      .acep-turn > .acep-bubble .prose,
      .acep-turn > .acep-bubble .content,
      .acep-turn > .acep-bubble .whitespace-pre-wrap,
      .acep-turn > .acep-bubble p,
      .acep-turn > .acep-bubble li{
        background:transparent !important;
        color:inherit !important;
      }

      /* Legacy/alternate wrappers (older templates used [data-acep-role] directly). */
       body > [data-acep-role="user"]:not(.acep-turn){
         background:#0f1622 !important;
         color:#f9fafb !important;
         padding:12px 14px !important;
         border-radius:16px !important;
         max-width:78%;
         margin:0 0 16px auto !important;
         border:1px solid #1f2937 !important;
       }
       body > [data-acep-role="assistant"]:not(.acep-turn){
         background:transparent !important;
         color:${text} !important;
         padding:0 !important;
         margin:0 0 18px 0 !important;
         width:100%;
         max-width:100%;
         box-sizing:border-box;
       }
       /* Legacy wrappers: avoid wildcard overrides (breaks code blocks). */
       body > [data-acep-role="assistant"]:not(.acep-turn) p,
       body > [data-acep-role="assistant"]:not(.acep-turn) li,
       body > [data-acep-role="user"]:not(.acep-turn) p,
       body > [data-acep-role="user"]:not(.acep-turn) li{
         background:transparent !important;
         color:inherit !important;
       }

      /* Role icons — sit above the bubble/content, aligned with the turn side */
      .acep-role-head{ display:flex; flex-shrink:0; align-items:center; margin-bottom:2px; padding-top:0; }
      .acep-role-head img.role-icon{ width:28px; height:28px; display:block; border-radius:999px; object-fit:cover; }
      ` : `
      /* Turn layout */
      .acep-turn{ display:flex; flex-direction:column; width:100%; gap:8px; margin:0 0 18px 0; overflow:hidden; }
      .acep-turn[data-acep-role="user"]{ align-items:flex-end; }
      .acep-turn[data-acep-role="assistant"]{ align-items:flex-start; }
      /* Bubble styling */
      .acep-turn[data-acep-role="user"] > .acep-bubble{
        background:#f3f4f6 !important;
        padding:12px 14px !important;
        border-radius:16px !important;
        max-width:78%;
        box-sizing:border-box;
        overflow-wrap:break-word;
        word-break:break-word;
        border:1px solid #e5e7eb !important;
      }
      .acep-turn[data-acep-role="assistant"] > .acep-bubble{
        background:transparent;
        padding:0;
        width:100%;
        max-width:100%;
        box-sizing:border-box;
        overflow-wrap:break-word;
      }
      .acep-turn > .acep-bubble .message-bubble,
      .acep-turn > .acep-bubble .markdown,
      .acep-turn > .acep-bubble .prose,
      .acep-turn > .acep-bubble .content,
      .acep-turn > .acep-bubble .whitespace-pre-wrap,
      .acep-turn > .acep-bubble p,
      .acep-turn > .acep-bubble li{
        background:transparent !important;
        color:inherit !important;
      }

      /* Legacy/alternate wrappers (older templates used [data-acep-role] directly). */
       body > [data-acep-role="user"]:not(.acep-turn){
         background:#f3f4f6 !important;
         color:#111827 !important;
         padding:12px 14px !important;
         border-radius:16px !important;
         max-width:78%;
         margin:0 0 16px auto !important;
         border:1px solid #e5e7eb !important;
       }
       body > [data-acep-role="assistant"]:not(.acep-turn){
         background:transparent !important;
         color:${text} !important;
         padding:0 !important;
         margin:0 0 18px 0 !important;
         width:100%;
         max-width:100%;
         box-sizing:border-box;
       }
       body > [data-acep-role="assistant"]:not(.acep-turn) *,
       body > [data-acep-role="user"]:not(.acep-turn) *{
         background:transparent !important;
         color:inherit !important;
       }

      /* Role icons — sit above the bubble/content, aligned with the turn side */
      .acep-role-head{ display:flex; flex-shrink:0; align-items:center; margin-bottom:2px; padding-top:0; }
      .acep-role-head img.role-icon{ width:28px; height:28px; display:block; border-radius:999px; object-fit:cover; }
      `}

      ${forPng ? `
      /* PNG capture safety: provider DOM can contain wide/shifted utility wrappers that html2canvas crops. */
      html, body, body *{ box-sizing:border-box !important; }
      body{ overflow-x:hidden !important; }
      .acep-turn,
      [data-acep-role],
      .acep-bubble,
      .content,
      .markdown,
      .prose,
      .standard-markdown,
      .progressive-markdown{
        max-width:100% !important;
        min-width:0 !important;
        transform:none !important;
        left:auto !important;
        right:auto !important;
        translate:none !important;
        overflow-wrap:anywhere !important;
      }
      .acep-turn[data-acep-role="assistant"],
      .acep-turn[data-acep-role="assistant"] > .acep-bubble,
      body > [data-acep-role="assistant"]:not(.acep-turn){
        width:100% !important;
        margin-left:0 !important;
        margin-right:0 !important;
        padding-left:0 !important;
        padding-right:0 !important;
        overflow:visible !important;
      }
      .acep-turn[data-acep-role="assistant"] *{
        max-width:100% !important;
      }
      .acep-turn[data-acep-role="assistant"] [style*="margin-left: -"],
      .acep-turn[data-acep-role="assistant"] [style*="left: -"],
      .acep-turn[data-acep-role="assistant"] [style*="translate"]{
        margin-left:0 !important;
        left:auto !important;
        transform:none !important;
        translate:none !important;
      }
      ` : ''}
      /* Code blocks */
      [data-acep-role] pre{
        background:${isDark ? '#0f1622' : '#f3f4f6'} !important;
        color:${isDark ? '#e5e7eb' : '#0f172a'} !important;
        border-radius:10px !important;
        border:1px solid ${isDark ? '#1f2937' : '#e5e7eb'} !important;
        padding:14px 16px !important;
        display:block !important;
        width:fit-content;
        min-width:min(100%, 200px);
        max-width:100%;
        box-sizing:border-box;
        overflow-x:auto;
        white-space:pre;
        margin:12px 0 !important;
        font-family:"Fira Code","Cascadia Code","Consolas","Courier New",monospace;
        font-size:0.88em;
        line-height:1.6;
      }
      [data-acep-role] pre code{
        background:transparent !important;
        padding:0 !important;
        border:0 !important;
        display:block !important;
        white-space:pre !important;
        font-family:inherit !important;
      }
      pre,
      .code-block__code,
      .standard-markdown pre,
      .progressive-markdown pre,
      .markdown pre,
      .acep-bubble pre,
      .acep-artifact pre,
      [role="group"][aria-label*="code" i] pre{
        background:${isDark ? '#0f1622' : '#f3f4f6'} !important;
        color:${isDark ? '#e5e7eb' : '#0f172a'} !important;
        border-radius:10px !important;
        border:1px solid ${isDark ? '#1f2937' : '#e5e7eb'} !important;
        padding:14px 16px !important;
        display:block !important;
        max-width:100% !important;
        box-sizing:border-box !important;
        overflow-x:auto !important;
        white-space:pre !important;
        margin:12px 0 !important;
        font-family:"Fira Code","Cascadia Code","Consolas","Courier New",monospace !important;
        font-size:0.88em !important;
        line-height:1.6 !important;
      }
      pre code,
      .code-block__code code,
      .standard-markdown pre code,
      .progressive-markdown pre code,
      .markdown pre code,
      .acep-bubble pre code,
      .acep-artifact pre code,
      [role="group"][aria-label*="code" i] pre code{
        background:transparent !important;
        color:inherit !important;
        padding:0 !important;
        border:0 !important;
        display:block !important;
        white-space:pre !important;
        font-family:inherit !important;
      }
      [role="group"][aria-label*="code" i]{
        margin:12px 0 !important;
      }
      [role="group"][aria-label*="code" i] button,
      [role="group"][aria-label*="code" i] [aria-label*="Copy" i],
      [role="group"][aria-label*="code" i] .sticky{
        display:none !important;
      }
      [role="group"][aria-label*="code" i] .overflow-x-auto{
        overflow-x:auto !important;
      }
      /* Inline code */
      [data-acep-role] :not(pre) > code{
        background:${isDark ? '#1e2535' : '#f0f2f5'} !important;
        color:${isDark ? '#93c5fd' : '#be185d'} !important;
        border-radius:5px !important;
        padding:2px 5px !important;
        display:inline !important;
        border:1px solid ${isDark ? '#2d3a4f' : '#dde1e7'} !important;
        font-family:"Fira Code","Cascadia Code","Consolas","Courier New",monospace;
        font-size:0.87em;
        white-space:pre-wrap;
      }

      /* Tables */
      [data-acep-role] table{
        display:table;
        width:100% !important;
        min-width:100%;
        border-collapse:collapse;
        margin:14px 0;
        font-size:0.92em;
        border:1px solid ${isDark ? '#374151' : '#d1d5db'};
        border-radius:8px;
        overflow:hidden;
      }
      [data-acep-role] th{
        background:${isDark ? '#1f2937' : '#f3f4f6'} !important;
        color:${isDark ? '#f9fafb' : '#111827'} !important;
        font-weight:600;
        text-align:left;
        padding:10px 14px;
        border-bottom:2px solid ${isDark ? '#374151' : '#d1d5db'};
        border-right:1px solid ${isDark ? '#374151' : '#d1d5db'};
      }
      [data-acep-role] td{
        padding:9px 14px;
        border-bottom:1px solid ${isDark ? '#1f2937' : '#e5e7eb'};
        border-right:1px solid ${isDark ? '#1f2937' : '#e5e7eb'};
        word-break:break-word;
        overflow-wrap:anywhere;
        vertical-align:top;
      }
      [data-acep-role] tr:last-child td{ border-bottom:0; }
      [data-acep-role] th:last-child, [data-acep-role] td:last-child{ border-right:0; }
      [data-acep-role] tbody tr:nth-child(even) td{
        background:${isDark ? '#0f1622' : '#f9fafb'} !important;
      }

      /* Lists */
      [data-acep-role] ul, [data-acep-role] ol{
        margin:8px 0;
        padding-left:1.6em;
      }
      [data-acep-role] ul{ list-style-type:disc !important; }
      [data-acep-role] ol{ list-style-type:decimal !important; }
      [data-acep-role] ul > li::marker{ content:normal !important; }
      [data-acep-role] ol > li::marker{ content:normal !important; }
      [data-acep-role] ul > li::before{ content:none !important; display:none !important; }
      /* Ensure list layout stays blocky even when provider HTML contains unusual wrappers */
      [data-acep-role] li{ display:list-item; }
      [data-acep-role] li > p{ display:block; margin:0; }
      [data-acep-role] li{
        margin:4px 0;
        line-height:1.6;
      }
      [data-acep-role] li + li{ margin-top:2px; }

      [data-acep-role] hr{
        border:0;
        border-top:1px solid ${isDark ? '#374151' : '#e5e7eb'};
        margin:16px 0;
      }

      /* Syntax highlighting tokens */
      .tok-kw  { color:${isDark ? '#a78bfa' : '#7c3aed'} !important; font-weight:600; }
      .tok-str { color:${isDark ? '#4ade80' : '#16a34a'} !important; }
      .tok-num { color:${isDark ? '#fb923c' : '#ea580c'} !important; }
      .tok-cmt { color:${isDark ? '#9ca3af' : '#6b7280'} !important; font-style:italic; }
      .tok-fn  { color:${isDark ? '#60a5fa' : '#2563eb'} !important; }
      .tok-cls { color:${isDark ? '#34d399' : '#0891b2'} !important; }
      .tok-tag { color:${isDark ? '#f472b6' : '#db2777'} !important; }
      .tok-attr{ color:${isDark ? '#34d399' : '#0d9488'} !important; }

      ${katexCss}
      ${needsKatex ? `
      /* Final KaTeX layout guard: provider inline styles and PDF renderers can otherwise split formulas into vertical columns. */
      .katex{ display:inline-block !important; max-width:100%; white-space:nowrap !important; line-height:1.2 !important; text-indent:0 !important; }
      .katex-display{ display:block !important; max-width:100%; margin:0.7em 0 !important; overflow-x:auto !important; overflow-y:hidden !important; text-align:left !important; }
      .katex .katex-mathml{ display:none !important; }
      .katex .katex-html{ display:inline-block !important; max-width:100%; white-space:nowrap !important; }
      .katex .base{ display:inline-block !important; position:relative !important; white-space:nowrap !important; width:max-content !important; }
      .katex .strut{ display:inline-block !important; }
      .katex .mord,.katex .mop,.katex .mbin,.katex .mrel,.katex .mopen,.katex .mclose,.katex .mpunct,.katex .minner{ display:inline-block !important; }
      ` : ''}
      ${extraCss}
    `;
    head.appendChild(style);

    const header = doc.createElement('div');
    try { header.setAttribute('data-acep-export-header', '1'); } catch {}
    header.style.textAlign = 'center';
    header.style.margin = '0 auto 18px';

    if (headerFilename) {
      const h1 = doc.createElement('h1');
      h1.textContent = headerFilename;
      h1.style.fontSize = `${Math.min(baseSize + 10, baseSize + 14)}px`;
      h1.style.fontWeight = '700';
      header.appendChild(h1);
    }
    if (subHeading) {
      const h2 = doc.createElement('h2');
      h2.textContent = subHeading;
      h2.style.fontSize = `${baseSize + 2}px`;
      h2.style.fontWeight = '600';
      h2.style.fontStyle = 'italic';
      header.appendChild(h2);
    }

    const infoLines = [];
    const lbl = (key, fallback) => {
      const tr = t(key);
      if (tr && tr !== key) return tr;
      return fallback;
    };
    if (adv.userName) infoLines.push(`${lbl('label_name', 'Name:')} ${adv.userName}`);
    if (adv.userEmail) {
      const a = doc.createElement('a');
      a.href = `mailto:${adv.userEmail}`;
      a.textContent = `${lbl('label_email', 'Email:')} ${adv.userEmail}`;
      a.style.color = accent;
      infoLines.push(a.outerHTML);
    }
    if (adv.includeDateTime) {
      const now = new Date();
      infoLines.push(`${lbl('label_datetime', 'Date exported:')} ${now.toLocaleString()}`);
    }
    if (infoLines.length) {
      const p = doc.createElement('div');
      p.style.marginTop = '8px';
      p.style.fontSize = `${Math.max(8, baseSize - 1)}px`;
      p.style.lineHeight = '1.4';
      p.innerHTML = infoLines.join('<br/>');
      header.appendChild(p);
    }

    body.insertBefore(header, body.firstChild);

    // Add or remove role icons for the newer minimal HTML format.
    // Older templates may already contain icons; we remove them when requested.
    try {
      try { doc.documentElement.setAttribute('data-acep-remove-icons', removeIcons ? '1' : '0'); } catch {}
      if (removeIcons || disableRoleIcons) {
        try { doc.querySelectorAll('.acep-role-head, .role-icon, img[alt="user-icon"], img[alt="assistant-icon"]').forEach((n) => n.remove()); } catch {}
        try { doc.documentElement.setAttribute('data-acep-remove-icons-applied', '1'); } catch {}
      } else {
        const assistantCandidates = providerKey === 'grok'
          ? ['icons/grok-purple.png', 'icons/chatgpt-purple.PNG']
          : providerKey === 'claude'
            ? ['icons/Claude-purple.png', 'icons/chatgpt-purple.PNG']
            : providerKey === 'gemini'
              ? ['icons/Gemini-purple.png', 'icons/chatgpt-purple.PNG']
              : providerKey === 'deepseek'
                ? ['icons/deepseek-purple.png', 'icons/chatgpt-purple.PNG']
                : ASSISTANT_ICON_FALLBACK;
        const iconAssets = {
          user: await loadIconAssets('user'),
          assistant: await loadIconFromCandidates(assistantCandidates),
        };
        const turns = Array.from(doc.querySelectorAll('.acep-turn[data-acep-role]'));
        turns.forEach((turnEl) => {
          try {
            if (turnEl.querySelector('img.role-icon')) return;
            const role = String(turnEl.getAttribute('data-acep-role') || '').toLowerCase();
            const icon = role === 'assistant' ? iconAssets.assistant : iconAssets.user;
            const dataUrl = icon?.dataUrl;
            if (!dataUrl || !/^data:image\/(png|jpe?g);base64,/i.test(dataUrl)) return;
            try { turnEl.setAttribute('data-acep-role-icon', '1'); } catch {}
            const headRow = doc.createElement('div');
            headRow.className = 'acep-role-head';
            const img = doc.createElement('img');
            img.className = 'role-icon';
            img.alt = role === 'assistant' ? 'assistant-icon' : 'user-icon';
            img.src = dataUrl;
            headRow.appendChild(img);
            turnEl.insertBefore(headRow, turnEl.firstChild);
          } catch {}
        });
      }
    } catch {}

    try {
      const forceCodeBlockStyle = (pre) => {
        try {
          if (!pre || !pre.style) return;
          pre.classList.add('acep-code-block');
          pre.setAttribute('data-acep-code-block', '1');
          pre.style.setProperty('background', isDark ? '#0f1622' : '#f3f4f6', 'important');
          pre.style.setProperty('color', isDark ? '#e5e7eb' : '#0f172a', 'important');
          pre.style.setProperty('border', `1px solid ${isDark ? '#1f2937' : '#e5e7eb'}`, 'important');
          pre.style.setProperty('border-radius', '10px', 'important');
          pre.style.setProperty('padding', '14px 16px', 'important');
          pre.style.setProperty('display', 'block', 'important');
          pre.style.setProperty('box-sizing', 'border-box', 'important');
          pre.style.setProperty('max-width', '100%', 'important');
          pre.style.setProperty('overflow-x', 'auto', 'important');
          pre.style.setProperty('white-space', 'pre', 'important');
          pre.style.setProperty('font-family', '"Fira Code","Cascadia Code",Consolas,"Courier New",monospace', 'important');
          pre.style.setProperty('font-size', '0.88em', 'important');
          pre.style.setProperty('line-height', '1.6', 'important');
          pre.style.setProperty('margin', '12px 0', 'important');
          const code = pre.querySelector?.('code');
          if (code && code.style) {
            code.style.setProperty('background', 'transparent', 'important');
            code.style.setProperty('color', 'inherit', 'important');
            code.style.setProperty('padding', '0', 'important');
            code.style.setProperty('border', '0', 'important');
            code.style.setProperty('display', 'block', 'important');
            code.style.setProperty('white-space', 'pre', 'important');
            code.style.setProperty('font-family', 'inherit', 'important');
          }
        } catch {}
      };
      body.querySelectorAll('pre, .code-block__code, [role="group"][aria-label*="code" i] pre').forEach(forceCodeBlockStyle);
    } catch {}
    return '<!doctype html>\n' + doc.documentElement.outerHTML;
  } catch (e) {
    // Surface the failure directly in the exported HTML so it's debuggable.
    try {
      const msg = (e && (e.stack || e.message)) ? String(e.stack || e.message) : String(e || 'unknown error');
      const safeMsg = msg.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
      const safeHtml = String(html || '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
      return `<!doctype html><html><head><meta charset="utf-8"><title>ACEP HTML Build Error</title></head><body style="font-family:Segoe UI,Arial,sans-serif;padding:16px;"><h1>ACEP HTML buildHtmlWithHeader failed</h1><pre style="white-space:pre-wrap;border:1px solid #ddd;padding:12px;border-radius:8px;">${safeMsg}</pre><details open style="margin-top:12px;"><summary>Raw HTML (truncated)</summary><pre style="white-space:pre-wrap;border:1px solid #ddd;padding:12px;border-radius:8px;max-height:320px;overflow:auto;">${safeHtml.slice(0, 200000)}</pre></details></body></html>`;
    } catch {}
    return html;
  }
}
