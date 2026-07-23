// Shared pdfMake font helpers (PDF export).

function runtimeGetUrl(path) {
  const getURL =
    globalThis?.browser?.runtime?.getURL ||
    globalThis?.chrome?.runtime?.getURL;
  if (typeof getURL !== 'function') {
    throw new Error('runtime.getURL not available');
  }
  return getURL.call(globalThis.browser?.runtime || globalThis.chrome?.runtime, path);
}

function uint8ToBase64(u8) {
  const chunk = 0x8000;
  let binary = '';
  for (let i = 0; i < u8.length; i += chunk) {
    binary += String.fromCharCode.apply(null, u8.subarray(i, i + chunk));
  }
  return btoa(binary);
}

export async function loadFontToVfs(name, path) {
  try {
    const url = runtimeGetUrl(path);
    const resp = await fetch(url);
    if (!resp.ok) return false;
    const buf = await resp.arrayBuffer();
    const base64 = uint8ToBase64(new Uint8Array(buf));
    const pdfMake = globalThis.pdfMake;
    if (!pdfMake) return false;
    const vfs = pdfMake.vfs || (pdfMake.vfs = {});
    if (!vfs[name]) vfs[name] = base64;
    return true;
  } catch {
    return false;
  }
}

export async function ensureNotoSansFont() {
  if (globalThis.NOTO_SANS_FONT_READY) return;
  const ok = await loadFontToVfs('NotoSans_Regular.ttf', 'libs/notosan-font-family/NotoSans_Regular.ttf');
  globalThis.NOTO_SANS_FONT_READY = !!ok;
}

export async function ensureEmojiFont() {
  if (globalThis.NOTO_EMOJI_FONT_READY) return true;
  try {
    const url = runtimeGetUrl('libs/NotoEmoji-Regular.ttf');
    const resp = await fetch(url);
    if (!resp.ok) return false;
    const buf = await resp.arrayBuffer();
    const base64 = uint8ToBase64(new Uint8Array(buf));
    const pdfMake = globalThis.pdfMake;
    if (pdfMake && base64) {
      const vfs = pdfMake.vfs || (pdfMake.vfs = {});
      if (!vfs['NotoEmoji-Regular.ttf']) vfs['NotoEmoji-Regular.ttf'] = base64;
      pdfMake.fonts = {
        ...(pdfMake.fonts || {}),
        NotoEmoji: {
          normal: 'NotoEmoji-Regular.ttf',
          bold: 'NotoEmoji-Regular.ttf',
          italics: 'NotoEmoji-Regular.ttf',
          bolditalics: 'NotoEmoji-Regular.ttf',
        },
      };
      globalThis.NOTO_EMOJI_FONT_READY = true;
      return true;
    }
  } catch {}
  globalThis.NOTO_EMOJI_FONT_READY = false;
  return false;
}

export async function ensureSymbolFont() {
  if (globalThis.NOTO_SYMBOL_FONT_READY) return true;
  try {
    // User-provided: place `NotoSansSymbols-Regular.ttf` under `libs/`.
    const ok = await loadFontToVfs('NotoSansSymbols-Regular.ttf', 'libs/NotoSansSymbols-Regular.ttf');
    const pdfMake = globalThis.pdfMake;
    if (!ok || !pdfMake) return false;
    pdfMake.fonts = {
      ...(pdfMake.fonts || {}),
      NotoSymbols: {
        normal: 'NotoSansSymbols-Regular.ttf',
        bold: 'NotoSansSymbols-Regular.ttf',
        italics: 'NotoSansSymbols-Regular.ttf',
        bolditalics: 'NotoSansSymbols-Regular.ttf',
      },
    };
    globalThis.NOTO_SYMBOL_FONT_READY = true;
    return true;
  } catch {}
  globalThis.NOTO_SYMBOL_FONT_READY = false;
  return false;
}

export async function ensureSymbol2Font() {
  if (globalThis.NOTO_SYMBOL2_FONT_READY) return true;
  try {
    // Optional: place `NotoSansSymbols2-Regular.ttf` under `libs/` for arrow-range glyph coverage.
    const ok = await loadFontToVfs('NotoSansSymbols2-Regular.ttf', 'libs/NotoSansSymbols2-Regular.ttf');
    const pdfMake = globalThis.pdfMake;
    if (!ok || !pdfMake) return false;
    pdfMake.fonts = {
      ...(pdfMake.fonts || {}),
      NotoSymbols2: {
        normal: 'NotoSansSymbols2-Regular.ttf',
        bold: 'NotoSansSymbols2-Regular.ttf',
        italics: 'NotoSansSymbols2-Regular.ttf',
        bolditalics: 'NotoSansSymbols2-Regular.ttf',
      },
    };
    globalThis.NOTO_SYMBOL2_FONT_READY = true;
    return true;
  } catch {}
  globalThis.NOTO_SYMBOL2_FONT_READY = false;
  return false;
}

export async function ensurePdfMakeFontFamily(advFont) {
  const pdfMake = globalThis.pdfMake;
  if (!pdfMake) throw new Error('pdfMake not available');

  const fontsMap = {
    NotoSans: {
      normal: 'NotoSans_Regular.ttf',
      bold: 'NotoSans_Bold.ttf',
      italics: 'NotoSans_Italic.ttf',
      bolditalics: 'NotoSans_BoldItalic.ttf',
    },
    TimesNewRoman: {
      normal: 'timesnewroman_Regular.ttf',
      bold: 'timesnewroman_Bold.ttf',
      italics: 'timesnewroman_Italic.ttf',
      bolditalics: 'timesnewroman_Bold Italic.ttf',
    },
    Calibri: {
      normal: 'calibri-regular.ttf',
      bold: 'calibri-bold.ttf',
      italics: 'calibri-italic.ttf',
      bolditalics: 'calibri-bold-italic.ttf',
    },
  };
  const fontFiles = {
    NotoSans: {
      normal: 'libs/notosan-font-family/NotoSans_Regular.ttf',
      bold: 'libs/notosan-font-family/NotoSans_Bold.ttf',
      italics: 'libs/notosan-font-family/NotoSans_Italic.ttf',
      bolditalics: 'libs/notosan-font-family/NotoSans_BoldItalic.ttf',
    },
    TimesNewRoman: {
      normal: 'libs/timesnewroman-font-family/timesnewroman_Regular.ttf',
      bold: 'libs/timesnewroman-font-family/timesnewroman_Bold.ttf',
      italics: 'libs/timesnewroman-font-family/timesnewroman_Italic.ttf',
      bolditalics: 'libs/timesnewroman-font-family/timesnewroman_Bold Italic.ttf',
    },
    Calibri: {
      normal: 'libs/calibri-font-family/calibri-regular.ttf',
      bold: 'libs/calibri-font-family/calibri-bold.ttf',
      italics: 'libs/calibri-font-family/calibri-italic.ttf',
      bolditalics: 'libs/calibri-font-family/calibri-bold-italic.ttf',
    },
  };

  const selectedFontKey = fontsMap[advFont || 'TimesNewRoman'] ? (advFont || 'TimesNewRoman') : 'NotoSans';
  const selectedFont = fontsMap[selectedFontKey] || fontsMap.NotoSans;
  const selectedFiles = fontFiles[selectedFontKey] || fontFiles.NotoSans;

  if (selectedFiles) {
    await loadFontToVfs(selectedFont.normal, selectedFiles.normal);
    await loadFontToVfs(selectedFont.bold, selectedFiles.bold);
    await loadFontToVfs(selectedFont.italics, selectedFiles.italics);
    await loadFontToVfs(selectedFont.bolditalics, selectedFiles.bolditalics);
  } else {
    await ensureNotoSansFont();
  }

  pdfMake.fonts = {
    ...(pdfMake.fonts || {}),
    [selectedFontKey]: { ...selectedFont },
  };

  // Always register NotoSans as a fallback font, even when the selected font is different (e.g., Calibri).
  // We use NotoSans explicitly in some runs (symbol/emoji fallbacks), so missing this mapping can hang PDF export.
  try {
    if (!pdfMake.fonts?.NotoSans) {
      const noto = fontsMap.NotoSans;
      const notoFiles = fontFiles.NotoSans;
      await loadFontToVfs(noto.normal, notoFiles.normal);
      await loadFontToVfs(noto.bold, notoFiles.bold);
      await loadFontToVfs(noto.italics, notoFiles.italics);
      await loadFontToVfs(noto.bolditalics, notoFiles.bolditalics);
      pdfMake.fonts = {
        ...(pdfMake.fonts || {}),
        NotoSans: { ...noto },
      };
    }
  } catch {}

  if (!pdfMake.fonts.Roboto && pdfMake.vfs && pdfMake.vfs['Roboto-Regular.ttf']) {
    pdfMake.fonts = {
      ...(pdfMake.fonts || {}),
      Roboto: {
        normal: 'Roboto-Regular.ttf',
        bold: 'Roboto-Medium.ttf',
        italics: 'Roboto-Italic.ttf',
        bolditalics: 'Roboto-MediumItalic.ttf',
      },
    };
  }

  return selectedFontKey;
}
