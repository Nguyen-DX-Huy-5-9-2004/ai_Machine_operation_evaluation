// util.js
export function sanitizeFilename(name, fallback = "AI_Conversation") {
  const n = (name || "").toString().trim() || fallback;
  return n
    .replace(/[\\/:*?"<>|]+/g, '-')     // illegal filename chars
    .replace(/\s+/g, ' ')
    .replace(/^\.+/, '')                // leading dots
    .slice(0, 150);                     // keep it short-ish
}

// util.js
export async function withTimeout(promise, ms, message) {
  let to;
  const timer = new Promise((_, rej) => to = setTimeout(() => rej(new Error(message)), ms));
  try { return await Promise.race([promise, timer]); }
  finally { clearTimeout(to); }
}
export async function dataUrlToBlob(dataUrl) {
  const res = await fetch(dataUrl);
  return await res.blob();
}
