// Utilidades para diagramas SVG y controles
export const NS = 'http://www.w3.org/2000/svg';
export function s(tag, attrs = {}, parent) {
  const e = document.createElementNS(NS, tag);
  for (const k in attrs) { const v = attrs[k]; if (v == null || v === false) continue; if (k === 'text') e.textContent = v; else e.setAttribute(k, v); }
  if (parent) parent.appendChild(e);
  return e;
}
export function svg(w, h, label) { return s('svg', { viewBox: `0 0 ${w} ${h}`, class: 'dsvg', role: 'img', 'aria-label': label, preserveAspectRatio: 'xMidYMid meet' }); }
export function t(parent, x, y, str, cls = 'lbl', anchor = 'start', extra = {}) { return s('text', { x, y, class: cls, 'text-anchor': anchor, text: str, ...extra }, parent); }
// texto con línea guía
export function callout(parent, ax, ay, tx, ty, str, anchor = 'start', cls = 'lbl') {
  const g = s('g', { class: 'callout' }, parent);
  const lines = String(str).split('\n');
  const fs = /lbl-xs/.test(cls) ? 9.6 : /lbl-s/.test(cls) ? 11.5 : 11;
  const w = Math.max(...lines.map(l => l.length)) * fs * 0.5;
  const x0 = anchor === 'start' ? tx : anchor === 'end' ? tx - w : tx - w / 2, x1 = x0 + w;
  const top = ty - fs * 0.8, bot = ty + (lines.length - 1) * 11.5 + 3;
  let ex, ey;
  if (ax < x0 - 2) { ex = x0 - 3; ey = ty - 4; }
  else if (ax > x1 + 2) { ex = x1 + 3; ey = ty - 4; }
  else { ex = ax; ey = ay < ty ? top - 2 : bot + 1; }
  s('path', { d: `M${ax},${ay} L${ex.toFixed(1)},${ey.toFixed(1)}`, class: 'leader' }, g);
  s('circle', { cx: ax, cy: ay, r: 1.8, class: 'leader-dot' }, g);
  lines.forEach((ln, i) => t(g, tx, ty + i * 11.5, ln, cls, anchor));
  return g;
}
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, k) => a + (b - a) * k;
export const smooth = k => k * k * (3 - 2 * k);
export const rad = d => d * Math.PI / 180;
export const pol = (cx, cy, r, a) => [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
export function arc(cx, cy, r, a0, a1) { const [x0, y0] = pol(cx, cy, r, a0), [x1, y1] = pol(cx, cy, r, a1); const large = Math.abs(a1 - a0) > Math.PI ? 1 : 0; const sweep = a1 > a0 ? 1 : 0; return `M${x0.toFixed(2)},${y0.toFixed(2)} A${r},${r} 0 ${large} ${sweep} ${x1.toFixed(2)},${y1.toFixed(2)}`; }
export function gear(cx, cy, r, teeth, depth = 3) {
  let d = ''; const n = teeth * 2;
  for (let i = 0; i <= n; i++) { const a = i / n * Math.PI * 2; const rr = i % 2 ? r : r + depth; const a2 = (i + 1) / n * Math.PI * 2; const [x0, y0] = pol(cx, cy, rr, a); const [x1, y1] = pol(cx, cy, rr, a2); d += (i ? 'L' : 'M') + x0.toFixed(2) + ',' + y0.toFixed(2) + 'L' + x1.toFixed(2) + ',' + y1.toFixed(2); }
  return d + 'Z';
}
// Flujo animado sobre un trazado (raya discontinua que avanza)
export function flow(parent, d, cls, dash = '5 7') { const p = s('path', { d, class: 'flow ' + cls, 'stroke-dasharray': dash }, parent); p._off = 0; return p; }
export function stepFlow(p, speed, dt) { p._off = (p._off - speed * dt) % 1000; p.setAttribute('stroke-dashoffset', p._off.toFixed(2)); }
// Partículas que recorren un path
export function particles(parent, pathEl, n, cls, r = 1.8) {
  const L = pathEl.getTotalLength(); const arr = [];
  for (let i = 0; i < n; i++) arr.push({ u: i / n, el: s('circle', { r, class: cls }, parent) });
  return { L, arr, path: pathEl, step(speed, dt, vis = 1) { for (const q of arr) { q.u = (q.u + speed * dt / L + 1) % 1; const pt = pathEl.getPointAtLength(q.u * L); q.el.setAttribute('cx', pt.x.toFixed(1)); q.el.setAttribute('cy', pt.y.toFixed(1)); q.el.style.opacity = vis; } } };
}

// ——— controles HTML ———
let uid = 0;
export function h(tag, attrs = {}, ...kids) {
  const e = document.createElement(tag);
  for (const k in attrs) { const v = attrs[k]; if (v == null || v === false) continue; if (k === 'class') e.className = v; else if (k === 'html') e.innerHTML = v; else if (k.startsWith('on')) e.addEventListener(k.slice(2), v); else e.setAttribute(k, v === true ? '' : v); }
  for (const c of kids.flat()) if (c != null) e.append(c);
  return e;
}
export function range({ label, min, max, step = 1, value, fmt = v => v, oninput }) {
  const id = 'r' + (++uid);
  const out = h('output', { for: id, class: 'val' }, fmt(value));
  const inp = h('input', { type: 'range', id, min, max, step, value });
  inp.addEventListener('input', () => { const v = parseFloat(inp.value); out.textContent = fmt(v); oninput && oninput(v); });
  const wrap = h('div', { class: 'ctl range' }, h('label', { for: id }, label), inp, out);
  wrap.set = v => { inp.value = v; out.textContent = fmt(+v); };
  wrap.input = inp;
  return wrap;
}
export function seg({ label, options, value, onchange }) {
  const id = 's' + (++uid);
  const btns = options.map(o => h('button', { type: 'button', 'aria-pressed': String(o.v === value), 'data-v': o.v }, o.t));
  const g = h('div', { class: 'segbtns', role: 'group', 'aria-labelledby': id }, btns);
  btns.forEach(b => b.addEventListener('click', () => { set(b.dataset.v); onchange && onchange(b.dataset.v); }));
  function set(v) { btns.forEach(b => b.setAttribute('aria-pressed', String(b.dataset.v === String(v)))); }
  const wrap = h('div', { class: 'ctl seg' }, h('span', { id, class: 'clabel' }, label), g);
  wrap.set = set;
  return wrap;
}
export function button(label, onclick, cls = 'btn') { return h('button', { type: 'button', class: cls, onclick }, label); }
export function readout() { const el = h('div', { class: 'readout', 'aria-live': 'polite' }); return el; }
