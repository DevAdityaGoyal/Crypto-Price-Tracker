// Utils: formatting, DOM helpers, debounce, clamp, safe setText
export const fmtCurrency = (v, cur='USD') =>
  new Intl.NumberFormat(undefined, { style: 'currency', currency: cur, maximumFractionDigits: v < 1 ? 6 : 2 }).format(v);

export const fmtCompact  = (v) =>
  new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 }).format(v ?? 0);

export const fmtPct = (v) => {
  const num = Number(v ?? 0);
  const dir = num > 0 ? 'up' : num < 0 ? 'down' : 'flat';
  const val = Math.abs(num).toFixed(2);
  return { text: `${dir === 'up' ? '↑' : dir === 'down' ? '↓' : ''} ${val}%`, dir };
};

export const timeAgo = (ts) => {
  const diff = Date.now() - ts;
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s/60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m/60);
  return `${h}h ago`;
};

export const el = (tag, props = {}, ...children) => {
  const node = document.createElement(tag);
  Object.entries(props).forEach(([k,v])=>{
    if (k === 'class') node.className = v;
    else if (k === 'dataset') Object.assign(node.dataset, v);
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
    else if (k === 'html') node.innerHTML = v;
    else if (k === 'text') node.textContent = v;
    else node.setAttribute(k, v);
  });
  for (const c of children) {
    if (c == null) continue;
    node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
  }
  return node;
};

export const $ = (sel, root=document) => root.querySelector(sel);
export const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));

export const debounce = (fn, ms=250) => { let t; return (...a)=>{ clearTimeout(t); t=setTimeout(()=>fn(...a), ms);} };
export const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

export const safeText = (node, text) => { node.textContent = text ?? ''; };

// Keyboard helper
export const onKey = (key, handler) => (e) => { if(e.key.toLowerCase() === key) handler(e); };
