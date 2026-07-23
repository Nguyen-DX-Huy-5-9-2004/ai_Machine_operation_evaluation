import { ensureHtml2Canvas } from './loaders.js';

export async function htmlToCanvas(processedHtml, { scale: scaleOverride, clampHeight = false } = {}) {
  const html2canvas = await ensureHtml2Canvas();
  const frame = document.createElement('iframe');
  frame.style.cssText = 'position:fixed;left:-99999px;top:0;width:900px;height:10px;opacity:0;aria-hidden:true;';
  document.body.appendChild(frame);
  await new Promise((res) => { frame.onload = () => res(); frame.srcdoc = processedHtml; });

  const fdoc = frame.contentDocument;
  const root = fdoc.body;
  await Promise.all(Array.from(fdoc.images || []).map((img) => (
    img.complete ? null : new Promise((r) => {
      img.addEventListener('load', r, { once: true });
      img.addEventListener('error', r, { once: true });
    })
  )));

  const naturalHeight = Math.max(root.scrollHeight, root.offsetHeight, root.clientHeight) || 1;
  frame.style.height = (naturalHeight + 20) + 'px';

  let scale = typeof scaleOverride === 'number' && scaleOverride > 0 ? scaleOverride : 1.8;
  if (clampHeight) {
    const maxHeightPx = 19000;
    if (naturalHeight * scale > maxHeightPx) {
      const limitedScale = maxHeightPx / naturalHeight;
      if (limitedScale > 0 && limitedScale < scale) {
        scale = Math.max(0.95, limitedScale);
      }
    }
  }

  const canvas = await html2canvas(root, { useCORS: true, allowTaint: true, backgroundColor: '#ffffff', scale, windowWidth: 900 });
  frame.remove();
  return canvas;
}

export async function pngBlobSafeFromCanvas(canvas) {
  const blob = await new Promise((res) => canvas.toBlob(res, 'image/png'));
  if (blob) return blob;
  const dataUrl = canvas.toDataURL('image/png');
  return (await fetch(dataUrl)).blob();
}

