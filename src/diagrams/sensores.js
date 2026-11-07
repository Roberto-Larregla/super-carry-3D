// Mapa de sensores: planta y costado izquierdo (conductor), con las mismas coordenadas del modelo 3D.
// La silueta del costado es la misma curva con que se construye la carrocería 3D (body3d.js).
import { s, svg, t } from '../svgkit.js';
import { PARTS, SENSORS, STATUS } from '../data.js';
import { engToWorld, WB, RW } from '../geom.js';
import { sideProfile, BODY, TIRE as TIRE_D, FUEL_LID } from '../body3d.js';

const K = 170;                                   // px por metro
const X = x => 39 + (0.842 - x) * K;             // adelante a la izquierda (parachoques delantero en x = 39)
const YT = z => 170 - z * K;                     // planta: lado derecho arriba, izquierdo (conductor) abajo
const YS = y => 720 - y * K;                     // costado
const W = 640, H = 774;
const TIRE = TIRE_D.R;                           // radio exterior del 175/70 R13
export const sensorWorld = id => { const at = PARTS[id].sensor.at; return at.w || engToWorld(at.eng); };

function hull(pts) {
  const p = pts.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = [], up = [];
  for (const q of p) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
  for (let i = p.length - 1; i >= 0; i--) { const q = p[i]; while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop(); up.push(q); }
  lo.pop(); up.pop(); return lo.concat(up);
}
const boxPts = (x0, x1, y0, y1, z0, z1) => { const o = []; for (const x of [x0, x1]) for (const y of [y0, y1]) for (const z of [z0, z1]) o.push([x, y, z]); return o; };
const polyD = pts => 'M' + pts.map(p => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join('L') + 'Z';
const f1 = v => v.toFixed(1);
// rectángulo en coordenadas del furgón (x adelante; v = z en planta o y en costado)
const wrect = (g, x0, x1, v0, v1, Yf, cls, r = 0, extra = {}) => s('rect', { x: f1(X(Math.max(x0, x1))), y: f1(Math.min(Yf(v0), Yf(v1))), width: f1(Math.abs(x1 - x0) * K), height: f1(Math.abs(v1 - v0) * K), rx: r ? f1(r * K) : null, class: cls, ...extra }, g);
const wpath = (pts, Yf, close) => 'M' + pts.map(p => f1(X(p[0])) + ',' + f1(Yf(p[1]))).join('L') + (close ? 'Z' : '');
// parachoques en planta: cara redondeada hacia afuera (d = +1 adelante, −1 atrás)
function bumperPlan(xFace, back, zh, rr) {
  const d = Math.sign(xFace - back), xc = xFace - d * rr;
  return `M${f1(X(back))},${f1(YT(-zh))}L${f1(X(xc))},${f1(YT(-zh))}Q${f1(X(xFace))},${f1(YT(-zh))} ${f1(X(xFace))},${f1(YT(-zh + rr))}` +
    `L${f1(X(xFace))},${f1(YT(zh - rr))}Q${f1(X(xFace))},${f1(YT(zh))} ${f1(X(xc))},${f1(YT(zh))}L${f1(X(back))},${f1(YT(zh))}Z`;
}

export function sensorMap(host, { onPick } = {}) {
  const root = svg(W, H, 'Mapa de sensores del Super Carry: vista desde arriba y costado izquierdo');
  root.classList.add('smap');
  host.append(root);
  const g = s('g', {}, root);

  // ——— volúmenes de referencia (proyectados desde el modelo) ———
  const engPts = [...boxPts(-0.375, 0, -0.105, 0.178, -0.09, 0.09), ...boxPts(-0.375, 0, 0.178, 0.345, -0.1, 0.1), ...boxPts(-0.47, -0.375, 0.24, 0.31, -0.045, 0.045)].map(engToWorld);
  const gbPts = [...boxPts(-0.92, -0.39, -0.09, 0.09, -0.085, 0.085)].map(engToWorld);
  const proj = (pts, view) => hull(pts.map(p => view === 'top' ? [X(p[0]), YT(p[2])] : [X(p[0]), YS(p[1])]));

  // ════════ PLANTA ════════
  t(g, 24, 24, 'Vista desde arriba', 'lbl-s strong');
  t(g, 182, 24, '← adelante', 'lbl-xs muted');
  t(g, 616, 24, 'derecha (acompañante) ↑', 'lbl-xs muted', 'end');
  t(g, 616, 318, 'izquierda (conductor) ↓', 'lbl-xs muted', 'end');
  s('path', { d: bumperPlan(0.842, 0.52, 0.735, 0.15), class: 'm-trim' }, g);
  s('path', { d: bumperPlan(-2.465, -2.225, 0.735, 0.12), class: 'm-trim' }, g);
  wrect(g, BODY.REAR, BODY.FRONT, -BODY.HW, BODY.HW, YT, 'm-body', 0.06);
  wrect(g, 0.259, 0.569, -0.55, 0.55, YT, 'm-glass', 0.03);                         // parabrisas (inclinado)
  s('line', { x1: X(-0.62), y1: YT(0.68), x2: X(-0.62), y2: YT(-0.68), class: 'm-line dash' }, g);   // fin de la cabina
  for (const [x, z] of [[0, 0.605], [0, -0.605], [-WB, 0.6], [-WB, -0.6]]) wrect(g, x - TIRE, x + TIRE, z - 0.0875, z + 0.0875, YT, 'm-wheel', 0.025);
  for (const zs of [1, -1]) wrect(g, -0.52, -0.06, zs * 0.33 - 0.22, zs * 0.33 + 0.22, YT, 'm-seat', 0.035);
  s('ellipse', { cx: X(0.30), cy: YT(-0.33), rx: 0.05 * K, ry: 0.19 * K, class: 'm-wheelsteer' }, g);
  t(g, X(0.235), YT(-0.33) + 4, 'volante', 'lbl-xs muted', 'start');
  s('path', { d: polyD(proj(engPts, 'top')), class: 'm-eng' }, g);
  s('path', { d: polyD(proj(gbPts, 'top')), class: 'm-gb' }, g);
  wrect(g, -1.58, -1.10, 0.05, 0.35, YT, 'm-tank', 0.03);
  s('line', { x1: X(-0.92), y1: YT(0.02), x2: X(-1.66), y2: YT(0), class: 'm-prop' }, g);
  wrect(g, FUEL_LID.x - 0.058, FUEL_LID.x + 0.058, BODY.HW - 0.01, BODY.HW + 0.012, YT, 'm-amber', 0.004);  // tapa de bencina (lado copiloto)
  t(g, X(FUEL_LID.x), YT(BODY.HW) - 6, 'tapa de bencina', 'lbl-xs muted', 'middle');
  t(g, X(-0.20), YT(-0.17) + 4, 'motor', 'lbl-xs m-tag', 'middle');
  t(g, X(-0.66), YT(0.22) + 3, 'caja', 'lbl-xs m-tag', 'middle');
  t(g, X(-1.34), YT(0.20) + 4, 'estanque', 'lbl-xs m-tag', 'middle');
  // tablero y controlador (destino de las señales)
  wrect(g, 0.36, 0.45, -0.49, -0.17, YT, 'm-dash', 0.018);
  wrect(g, 0.44, 0.56, 0.355, 0.445, YT, 'm-ctrl', 0.018);

  // ════════ COSTADO IZQUIERDO ════════
  t(g, 24, 348, 'Costado izquierdo (lado conductor)', 'lbl-s strong');
  // parachoques (detrás de la silueta)
  wrect(g, 0.585, BODY.BUMPF, 0.395, 0.713, YS, 'm-trim', 0.03);
  wrect(g, BODY.BUMPR, -2.356, 0.385, 0.57, YS, 'm-trim', 0.025);
  // casco: la misma silueta que la carrocería 3D (con los pasos de rueda)
  const prof = sideProfile().map(p => [p.x, p.y]);
  s('path', { d: wpath(prof, YS, true), class: 'm-body' }, g);
  // puertas, paneles estampados y detalles (medidos en la foto de costado)
  s('path', { d: wpath([[0.533, 1.157], [0.580, 0.979], [0.582, 0.88], [0.575, 0.682], [0.558, 0.483], [0.534, 0.393]], YS), class: 'm-line' }, g);
  s('path', { d: wpath([[-0.196, 0.640], [-0.442, 0.640], [-0.467, 0.66], [-0.467, 1.163], [-0.420, 1.184], [-0.426, 1.644], [0.090, 1.651], [0.291, 1.471], [0.533, 1.157]], YS), class: 'm-line' }, g);
  s('path', { d: wpath([[0.404, 1.195], [0.090, 1.617], [-0.396, 1.610], [-0.390, 1.184]], YS, true), class: 'm-glass' }, g);
  s('path', { d: wpath([[-0.514, 0.38], [-0.520, 1.648], [-1.474, 1.648], [-1.462, 0.38]], YS), class: 'm-line' }, g);   // corredera
  s('path', { d: wpath([[-0.59, 1.13], [-0.59, 1.618], [-1.415, 1.618], [-1.415, 1.13]], YS, true), class: 'm-panel' }, g);
  s('path', { d: wpath([[-1.507, 1.142], [-1.507, 1.609], [-2.152, 1.600], [-2.249, 1.475], [-2.277, 1.336], [-2.284, 1.142]], YS, true), class: 'm-panel' }, g);
  s('line', { x1: X(0.0), y1: YS(1.662), x2: X(-2.16), y2: YS(1.662), class: 'm-line' }, g);              // canaleta
  wrect(g, -2.27, -1.481, 0.81, 0.865, YS, 'm-trim', 0.01);                                                // riel de la corredera
  for (const [y, x0] of [[0.548, -0.262], [0.581, -0.238], [0.617, -0.213]]) s('line', { x1: X(x0), y1: YS(y), x2: X(-1.364), y2: YS(y), class: 'm-line faint' }, g);
  wrect(g, -0.519, -0.439, 1.353, 1.588, YS, 'm-trim');                                                    // placa del pilar B
  wrect(g, -0.51, -0.447, 1.369, 1.437, YS, 'm-amber');                                                    // marcador lateral
  wrect(g, -0.358, -0.22, 1.024, 1.052, YS, 'm-trim', 0.006);                                              // manilla
  wrect(g, -0.708, -0.682, 0.917, 1.061, YS, 'm-trim', 0.006);                                             // manilla corredera
  wrect(g, 0.585, 0.645, 0.748, 0.962, YS, 'm-trim', 0.012);                                               // foco que envuelve la esquina
  for (const [cls, y0, y1] of [['m-amber', 0.927, 1.036], ['m-red', 0.818, 0.927], ['m-clear', 0.748, 0.818]]) wrect(g, -2.475, -2.40, y0, y1, YS, cls, 0.008);
  s('path', { d: wpath([[0.42, 1.19], [0.445, 1.215], [0.452, 1.25]], YS), class: 'm-line thick' }, g);  // espejo
  wrect(g, 0.414, 0.491, 1.175, 1.325, YS, 'm-trim', 0.012);
  wrect(g, -0.409, -0.401, 0.167, 0.395, YS, 'm-trim');                                                    // guardabarros
  // parrilla de techo (foto): pletina con ranuras y 4 patas cónicas
  for (const x of [-0.075, -0.72, -1.25, -1.775]) s('path', { d: wpath([[x - 0.075, 1.662], [x - 0.032, 1.817], [x + 0.032, 1.817], [x + 0.075, 1.662]], YS, true), class: 'm-trim' }, g);
  wrect(g, -1.936, -0.003, 1.817, 1.918, YS, 'm-trim', 0.03);
  for (let k = 0; k < 8; k++) { const c = -0.003 - 0.06 - (1.933 - 0.12) / 8 * (k + 0.5); wrect(g, c - 0.082, c + 0.082, 1.851, 1.886, YS, 'm-slot', 0.017); }
  // interior y sistemas
  s('line', { x1: X(-0.62), y1: YS(0.63), x2: X(BODY.REAR), y2: YS(0.63), class: 'm-line dash' }, g);
  t(g, X(-2.25), YS(0.655), 'piso de carga', 'lbl-xs muted', 'end');
  s('line', { x1: 24, y1: YS(0), x2: W - 24, y2: YS(0), class: 'm-ground' }, g);
  for (const x of [0, -WB]) { s('circle', { cx: f1(X(x)), cy: f1(YS(RW)), r: f1(TIRE * K), class: 'm-wheel' }, g); s('circle', { cx: f1(X(x)), cy: f1(YS(RW)), r: f1(0.17 * K), class: 'm-hub' }, g); }
  s('path', { d: polyD(proj(engPts, 'side')), class: 'm-eng' }, g);
  s('path', { d: polyD(proj(gbPts, 'side')), class: 'm-gb' }, g);
  wrect(g, -1.58, -1.10, 0.19, 0.39, YS, 'm-tank m-far', 0.024);
  wrect(g, -0.52, -0.06, 0.795, 0.895, YS, 'm-seat', 0.03);                              // cojín
  { const c = [-0.555, 1.13], a = 0.17, hw = 0.05, hh = 0.28;                            // respaldo inclinado
    const pts = [[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]].map(([u, v]) => [c[0] + u * Math.cos(a) - v * Math.sin(a), c[1] + u * Math.sin(a) + v * Math.cos(a)]);
    s('path', { d: wpath(pts, YS, true), class: 'm-seat' }, g); }
  wrect(g, 0.36, 0.45, 1.01, 1.12, YS, 'm-dash', 0.012);
  t(g, X(0.30), YS(1.31), 'tablero', 'lbl-xs muted', 'middle');
  t(g, X(-0.22), YS(0.13), 'motor', 'lbl-xs m-tag', 'middle');
  t(g, X(-1.34), YS(0.10), 'estanque', 'lbl-xs m-tag', 'middle');
  t(g, X(-0.82), YS(1.33), 'corredera', 'lbl-xs muted', 'middle');
  t(g, X(-1.76), YS(1.33), 'sin vidrios (ciego)', 'lbl-xs muted', 'middle');
  t(g, X(0.842) + 2, YS(0.0) + 14, '← adelante', 'lbl-xs muted', 'start');

  // ════════ SENSORES ════════
  const marks = {};
  const items = { top: [], side: [] };
  for (const id of SENSORS) {
    const w = sensorWorld(id), sn = PARTS[id].sensor;
    items.top.push({ id, n: sn.n, x0: X(w[0]), y0: YT(w[2]), st: sn.status });
    items.side.push({ id, n: sn.n, x0: X(w[0]), y0: YS(w[1]), st: sn.status });
  }
  const R = 9.5;
  for (const view of ['top', 'side']) {
    const L = items[view];
    const yb = view === 'top' ? [36, 300] : [360, 712];
    L.forEach((o, i) => { o.x = o.x0 + (i % 2 ? 10 : -10); o.y = o.y0 - 18; });
    for (let it = 0; it < 220; it++) {
      for (let i = 0; i < L.length; i++) for (let j = i + 1; j < L.length; j++) {
        const a = L[i], b = L[j]; let dx = b.x - a.x, dy = b.y - a.y; let d = Math.hypot(dx, dy) || 0.01;
        const min = 2 * R + 4; if (d < min) { const k = (min - d) / 2 / d; dx *= k; dy *= k; a.x -= dx; a.y -= dy; b.x += dx; b.y += dy; }
      }
      for (const o of L) {
        // los números no tapan los puntos de los otros sensores
        for (const q of L) { const dx = o.x - q.x0, dy = o.y - q.y0, d = Math.hypot(dx, dy) || 0.01; if (d < R + 5) { o.x += dx / d * (R + 5 - d) * 0.5; o.y += dy / d * (R + 5 - d) * 0.5; } }
        o.x += (o.x0 - o.x) * 0.02; o.y += (o.y0 - 20 - o.y) * 0.02;
        o.x = Math.max(16, Math.min(W - 16, o.x)); o.y = Math.max(yb[0], Math.min(yb[1], o.y));
      }
    }
    for (const o of L) {
      const mg = s('g', { class: 'smark', 'data-id': o.id, tabindex: 0, role: 'button', 'aria-label': `${o.n}. ${PARTS[o.id].name}` }, g);
      mg.style.setProperty('--c', STATUS[o.st].color);
      if (Math.hypot(o.x - o.x0, o.y - o.y0) > R + 1) s('line', { x1: o.x0, y1: o.y0, x2: o.x, y2: o.y, class: 'sm-lead' }, mg);
      s('circle', { cx: o.x0, cy: o.y0, r: 2.6, class: 'sm-dot' }, mg);
      s('circle', { cx: o.x, cy: o.y, r: R, class: 'sm-badge' }, mg);
      t(mg, o.x, o.y + 3.8, String(o.n), 'sm-num', 'middle');
      (marks[o.id] ||= []).push(mg);
      const pick = () => onPick && onPick(o.id);
      mg.addEventListener('click', pick);
      mg.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(); } });
    }
  }
  // leyenda
  const lg = s('g', {}, root);
  let lx = 24;
  for (const k of ['activo', 'sin_uso']) {
    s('circle', { cx: lx + 6, cy: H - 18, r: 6, fill: STATUS[k].color }, lg);
    t(lg, lx + 17, H - 14, STATUS[k].label, 'lbl muted'); lx += 30 + STATUS[k].label.length * 5.6;
  }
  t(lg, W - 24, H - 14, 'Punto = posición · número = sensor', 'lbl-xs muted', 'end');

  return {
    highlight(id) {
      for (const k in marks) marks[k].forEach(m => m.classList.toggle('on', k === id));
      root.classList.toggle('has-sel', !!id);
    },
  };
}
