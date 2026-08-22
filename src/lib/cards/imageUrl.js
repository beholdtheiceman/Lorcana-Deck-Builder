export function encodeImageURL(u) {
  if (typeof u !== 'string') return u;
  try {
    // encodeURI keeps protocol and slashes but encodes spaces, etc.
    let enc = encodeURI(u);
    // Also encode apostrophes explicitly (encodeURI leaves them)
    enc = enc.replace(/'/g, '%27');
    return enc;
  } catch {
    return u;
  }
}

export function asUrl(v) {
  if (!v) return null;
  if (typeof v === 'string') return v;
  // tolerate different shapes - extract URL from common object patterns
  return v.url ?? v.href ?? v.src ?? v.toString?.() ?? null;
}

export function lorcanaImageProxyUrl(src){
  if (!src) return null;
  const srcStr = String(src);
  return `https://images.weserv.nl/?url=${encodeURIComponent(srcStr)}&output=jpg`;
}
