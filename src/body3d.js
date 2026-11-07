// Carrocería del furgón SK410 del usuario (Chile, 1996), medida en sus fotos "de plano" (noviembre de 2026):
//  · costado izquierdo: escala por la distancia entre ejes (1.840 mm), verificada con el aro de 13" y el neumático 175/70 R13;
//    se corrigió un giro de 0,8° de la foto. Error típico ±2 cm en largo y alto.
//  · frente y atrás: escala por la patente (360 × 130 mm) y la trocha; dan los anchos y el "tumblehome" (los costados
//    se cierran hacia el techo) y el estrechamiento de los extremos. Error típico ±2–3 cm.
// Ejes: x adelante, y arriba, z a la derecha (acompañante). Origen: eje delantero, a nivel del suelo.
import * as THREE from 'three';
import { TessellateModifier } from 'three/examples/jsm/modifiers/TessellateModifier.js';
import { WB, RW } from './geom.js';

export const BODY = {
  HW: 0.685,      // medio ancho de los costados bajo la cintura (fotos: 1,34–1,37 m en los extremos; ficha UK: 1,40 m)
  FRONT: 0.640,   // cara delantera bajo los focos
  REAR: -2.442,   // cara trasera bajo los focos traseros
  ROOF: 1.762, SILL: 0.377, BELT: 1.10, GUT: 1.665,
  BUMPF: 0.765, BUMPR: -2.512,   // caras de los parachoques (largo total ≈ 3,28 m; ficha UK 3,29 m)
  R: 0.05,
};
const R_FRONT = 0.095, R_REAR = 0.075;   // radio de las esquinas verticales del frente y de la cola (fotos 3/4)
export const FUEL_LID = { x: -0.40, y: 0.535, z: 1 };   // tapa de bencina (foto 3/4 del lado derecho)
const sst = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// ════════ silueta lateral medida ════════
// cada punto: x, y, tramo (el del tramo que TERMINA en él) y si pertenece a un vano vidriado ('ws' o 'rw')
const WS0 = [0.569, 1.177], WS1 = [0.259, 1.630];          // base y techo del parabrisas (borde del pilar A)
const wsAt = t => [lerp(WS0[0], WS1[0], t), lerp(WS0[1], WS1[1], t)];
export function sideProfile() {
  const pts = [];
  const P = (x, y, tag, open = null) => pts.push({ x, y, tag, open });
  const quad = (p0, c, p1, n, tag) => { for (let i = 1; i <= n; i++) { const t = i / n, a = (1 - t) ** 2, b = 2 * (1 - t) * t, d = t * t; P(a * p0[0] + b * c[0] + d * p1[0], a * p0[1] + b * c[1] + d * p1[1], tag); } };
  P(0.600, 0.378, 'bot');
  quad([0.600, 0.378], [0.640, 0.378], [0.640, 0.418], 3, 'front');
  for (const [x, y] of [[0.640, 0.60], [0.640, 0.748], [0.6385, 0.80], [0.6343, 0.855], [0.6305, 0.91], [0.6257, 0.962], [0.610, 1.039], [0.598, 1.09], [0.588, 1.125]]) P(x, y, 'front');
  P(0.578, 1.152, 'cowl'); P(...WS0, 'cowl');
  for (const t of [0.035, 0.06, 0.09, 0.13, 0.2, 0.32, 0.5, 0.68, 0.8, 0.87, 0.91, 0.94, 0.965]) P(...wsAt(t), 'ws', 'ws');
  P(...WS1, 'roof');
  for (const [x, y] of [[0.209, 1.669], [0.139, 1.707], [0.089, 1.726], [0.029, 1.741], [-0.051, 1.756], [-0.14, 1.762]]) P(x, y, 'roof');
  for (let i = 1; i <= 7; i++) P(lerp(-0.14, -2.10, i / 7), lerp(1.762, 1.756, i / 7), 'roof');
  for (const [x, y] of [[-2.150, 1.748], [-2.190, 1.734], [-2.228, 1.712], [-2.255, 1.688]]) P(x, y, 'roof');
  // vidrio del portalón: de 1,66 a 1,18 m sobre la cara trasera curva
  for (const [x, y] of [[-2.272, 1.664], [-2.281, 1.648], [-2.291, 1.630], [-2.305, 1.592], [-2.320, 1.554], [-2.349, 1.474], [-2.377, 1.394], [-2.396, 1.315], [-2.411, 1.235], [-2.416, 1.208], [-2.420, 1.180]]) P(x, y, 'rw', 'rw');
  P(-2.424, 1.158, 'rear');
  for (const [x, y] of [[-2.432, 1.076], [-2.4365, 1.036], [-2.439, 0.98], [-2.441, 0.927], [-2.4413, 0.872], [-2.4415, 0.818], [-2.442, 0.748], [-2.442, 0.60], [-2.442, 0.47]]) P(x, y, 'rear');
  quad([-2.442, 0.47], [-2.442, 0.410], [-2.40, 0.410], 3, 'rear');
  P(-2.135, 0.411, 'bot');
  // paso de rueda trasero, de atrás hacia adelante (medido)
  for (const [x, y] of [[-2.126, 0.426], [-2.116, 0.465], [-2.101, 0.525], [-2.068, 0.585], [-2.019, 0.625], [-1.96, 0.642], [-1.881, 0.647], [-1.781, 0.645], [-1.722, 0.630], [-1.672, 0.601], [-1.631, 0.561], [-1.601, 0.512], [-1.580, 0.453], [-1.550, 0.400], [-1.505, 0.378]]) P(x, y, 'arch');
  for (const x of [-1.20, -0.90, -0.60, -0.385]) P(x, 0.377, 'bot');
  // paso de rueda delantero: borde trasero recto y diagonal; su techo es el borde inferior de la puerta
  for (const [x, y] of [[-0.330, 0.431], [-0.291, 0.491], [-0.252, 0.551], [-0.214, 0.616], [-0.196, 0.634], [-0.150, 0.637], [-0.095, 0.636], [0.025, 0.634], [0.104, 0.625], [0.144, 0.612], [0.194, 0.587], [0.234, 0.548], [0.265, 0.499], [0.285, 0.439], [0.296, 0.385]]) P(x, y, 'arch');
  P(0.330, 0.378, 'bot');
  return pts; // el tramo de cierre (último → primero) es 'bot'
}

// ════════ ancho: costados que se cierran hacia el techo y extremos más angostos ════════
const PROF = sideProfile();
function chain(list) { // [[x, y]...] monótono en y → función y → x
  const a = list.slice().sort((p, q) => p[1] - q[1]);
  return y => {
    if (y <= a[0][1]) return a[0][0];
    if (y >= a[a.length - 1][1]) return a[a.length - 1][0];
    let i = 1; while (a[i][1] < y) i++;
    const p = a[i - 1], q = a[i], t = (y - p[1]) / ((q[1] - p[1]) || 1);
    return p[0] + (q[0] - p[0]) * t;
  };
}
const iRoof0 = PROF.findIndex(p => p.tag === 'roof' && p.x < -0.10), iRoof1 = PROF.findIndex(p => p.x < -2.12);
const xFront = chain(PROF.slice(1, iRoof0 + 1).map(p => [p.x, p.y]));
const xRear = chain(PROF.slice(iRoof1, PROF.findIndex(p => p.tag === 'bot' && p.x < -2.0)).map(p => [p.x, p.y]));
const L_END = 0.45;
const wMid = y => BODY.HW - 0.115 * Math.pow(clamp((y - BODY.BELT) / (BODY.GUT - BODY.BELT), 0, 1.06), 1.3);
const tEnd = y => 0.02 + 0.055 * sst(1.10, 1.70, y);
export function halfW(x, y) {
  const df = xFront(y) - x, dr = x - xRear(y);
  const ff = df < L_END ? (1 - Math.max(0, df) / L_END) ** 2 : 0;
  const fr = dr < L_END ? (1 - Math.max(0, dr) / L_END) ** 2 : 0;
  return wMid(y) - tEnd(y) * Math.max(ff, fr);
}
const H = 0.003;
const dwdx = (x, y) => (halfW(x + H, y) - halfW(x - H, y)) / (2 * H);
const dwdy = (x, y) => (halfW(x, y + H) - halfW(x, y - H)) / (2 * H);
// normal hacia afuera del costado s (±1) en (x, y)
const sideN = (x, y, s) => new THREE.Vector3(-dwdx(x, y), -dwdy(x, y), 1).normalize().multiply(new THREE.Vector3(1, 1, s));
export const onSide = (x, y, s, out = 0) => new THREE.Vector3(x, y, s * (halfW(x, y) + out));
const tiltX = (x, y, s) => -s * Math.atan(-dwdy(x, y));    // giro en x para alinear una pieza con el costado inclinado

// ancho de los vanos vidriados (gomas incluidas) según las fotos de frente y de atrás
const wsHalf = y => halfW(xFront(y), y) - lerp(0.07, 0.035, sst(1.18, 1.55, y));
const rwHalf = y => halfW(xRear(y), y) - 0.066;

// ——— utilidades 2D ———
function roundedPoly(pts, r) { // polígono con esquinas redondeadas → THREE.Path
  const path = new THREE.Path(), n = pts.length;
  for (let i = 0; i < n; i++) {
    const p = pts[i], a = pts[(i - 1 + n) % n], b = pts[(i + 1) % n];
    const ri = Array.isArray(r) ? r[i] : r;
    const da = Math.hypot(a[0] - p[0], a[1] - p[1]), db = Math.hypot(b[0] - p[0], b[1] - p[1]);
    const k1 = Math.min(ri, da / 2.1) / da, k2 = Math.min(ri, db / 2.1) / db;
    const p1 = [p[0] + (a[0] - p[0]) * k1, p[1] + (a[1] - p[1]) * k1], p2 = [p[0] + (b[0] - p[0]) * k2, p[1] + (b[1] - p[1]) * k2];
    if (i === 0) path.moveTo(...p1); else path.lineTo(...p1);
    path.quadraticCurveTo(p[0], p[1], ...p2);
  }
  path.closePath();
  return path;
}
const rrect = (x0, y0, x1, y1, r) => roundedPoly([[x1, y0], [x1, y1], [x0, y1], [x0, y0]], r);
const toShape = path => { const s = new THREE.Shape(); s.curves = path.curves; s.currentPoint = path.currentPoint; return s; };
const tess = (geo, len = 0.06) => new TessellateModifier(len, 14).modify(geo.index ? geo.toNonIndexed() : geo);
function flipWinding(geo) {
  const p = geo.attributes.position, uv = geo.attributes.uv;
  for (let i = 0; i < p.count; i += 3) {
    for (const at of [p, uv].filter(Boolean)) { const sz = at.itemSize; for (let c = 0; c < sz; c++) { const t = at.array[(i + 1) * sz + c]; at.array[(i + 1) * sz + c] = at.array[(i + 2) * sz + c]; at.array[(i + 2) * sz + c] = t; } }
  }
  p.needsUpdate = true; return geo;
}
// lleva una geometría plana (x, y) al costado s: z = s·(ancho + out + h·uv.x)
function mapToSide(geo, s, out = 0, h = 0) {
  if (s < 0) flipWinding(geo);
  const p = geo.attributes.position, uv = geo.attributes.uv, nrm = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), t = uv && h ? uv.getX(i) : 0;
    p.setZ(i, s * (halfW(x, y) + out + h * t));
    const n = sideN(x, y, s); nrm[i * 3] = n.x; nrm[i * 3 + 1] = n.y; nrm[i * 3 + 2] = n.z;
  }
  geo.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
  p.needsUpdate = true; return geo;
}

// lámina que sigue el costado (para forros interiores): contorno (x, y) → geometría a `out` metros del costado
export function sideSheet(pts, s, out = -0.012, len = 0.08) {
  return mapToSide(tess(new THREE.ShapeGeometry(new THREE.Shape(pts.map(p => new THREE.Vector2(p[0], p[1]))), 2), len), s, out);
}

export function buildBody(ctx) {
  const { V, rbox, cylX, cylY, cylZ, tube } = ctx;
  const root = ctx.world.root;
  const body = new THREE.Group(); root.add(body); ctx.reg(body, 'carroceria', [0, 1.25, 0]);
  const B = (geo, kind, cat, o = {}) => ctx.add(o.part || 'carroceria', geo, kind, { parent: body, body: cat, ex: null, ...o });
  const n = PROF.length;

  // ——— radio de los bordes redondeados por tramo, suavizado a lo largo de la silueta ———
  const R_TAG = { front: R_FRONT, cowl: 0.09, ws: 0.062, roof: 0.085, rear: R_REAR, rw: 0.07, bot: 0.022, arch: 0.02 };
  let Rr = PROF.map(p => R_TAG[p.tag]);
  const pinned = i => { const p = PROF[i]; return (p.tag === 'front' && p.y > 0.55 && p.y < 1.0) || (p.tag === 'rear' && p.y > 0.62 && p.y < 1.08); };
  for (let pass = 0; pass < 6; pass++) {
    Rr = Rr.map((r, i) => {
      const tg = PROF[i].tag; if (tg === 'bot' || tg === 'arch' || pinned(i)) return r;
      const a = Rr[(i - 1 + n) % n], b = Rr[(i + 1) % n];
      return (a + 2 * r + b) / 4;
    });
  }
  // ——— normales de la silueta y contorno interior (desplazado R hacia adentro) ———
  const en = PROF.map((a, i) => { const b = PROF[(i + 1) % n]; const dx = b.x - a.x, dy = b.y - a.y, l = Math.hypot(dx, dy) || 1; return [dy / l, -dx / l]; });
  const Q = PROF.map((p, i) => {
    const n1 = en[(i - 1 + n) % n], n2 = en[i];
    let bx = n1[0] + n2[0], by = n1[1] + n2[1]; const bl = Math.hypot(bx, by) || 1; bx /= bl; by /= bl;
    const k = Math.min(2.5, 1 / Math.max(0.2, bx * n2[0] + by * n2[1]));
    return { x: p.x - bx * Rr[i] * k, y: p.y - by * Rr[i] * k, nx: bx, ny: by };
  });
  const MID = Q.map((q, i) => Math.max(0.05, halfW(q.x, q.y) - Rr[i]));
  // abombado: el techo sube al centro y el frente y la cola se curvan en planta (fotos 3/4); 0 en los bordes
  const BULGE = { roof: 0.022, ws: 0.010, cowl: 0.016, front: 0.016, rear: 0, rw: 0.010 };
  let Ab = PROF.map(p => BULGE[p.tag] || 0);
  for (let pass = 0; pass < 5; pass++) Ab = Ab.map((a, i) => { const tg = PROF[i].tag; if (tg === 'bot' || tg === 'arch') return 0; return (Ab[(i - 1 + n) % n] + 2 * a + Ab[(i + 1) % n]) / 4; });
  const bulgeAt = (i, z) => { const u = Math.min(1, Math.abs(z) / MID[i]); return Ab[i] * (1 - u * u) * (1 - u * u); };
  const nearI = (x, y) => { let bi = 0, bd = 1e9; for (let i = 0; i < n; i++) { const d = (PROF[i].x - x) ** 2 + (PROF[i].y - y) ** 2; if (d < bd) { bd = d; bi = i; } } return bi; };
  const bulgeOut = (x, y, z) => bulgeAt(nearI(x, y), z);   // cuánto sobresale la superficie abombada en (x, y, z)
  // largo de arco para redondear las esquinas de los vanos
  const arc = [0]; for (let i = 1; i < n; i++) arc.push(arc[i - 1] + Math.hypot(PROF[i].x - PROF[i - 1].x, PROF[i].y - PROF[i - 1].y));
  const span = {}; PROF.forEach((p, i) => { if (p.open) { const s = span[p.open] || (span[p.open] = [Infinity, -Infinity]); s[0] = Math.min(s[0], arc[i]); s[1] = Math.max(s[1], arc[i]); } });
  const RC = { ws: 0.06, rw: 0.07 };
  const openB = (i) => {
    const p = PROF[i], o = p.open; if (!o) return null;
    const base = o === 'ws' ? wsHalf(p.y) : rwHalf(p.y);
    const d = Math.min(arc[i] - span[o][0], span[o][1] - arc[i]), rc = RC[o];
    const shrink = d < rc ? rc - Math.sqrt(Math.max(0, rc * rc - (rc - d) * (rc - d))) : 0;
    return base - shrink;
  };
  // b: borde del vidrio; br: borde exterior de la goma (en z, medido desde el centro)
  const bArr = PROF.map((p, i) => openB(i));
  for (let i = 0; i < n; i++) if (bArr[i] === null) { // los bordes vecinos a un vano copian su ancho (goma recta)
    const a = PROF[(i - 1 + n) % n].open ? bArr[(i - 1 + n) % n] : null, c = PROF[(i + 1) % n].open ? bArr[(i + 1) % n] : null;
    if (a !== null || c !== null) bArr[i] = -(a ?? c);       // negativo = marca de borde (se usa su valor absoluto)
  }
  const cowlB = wsHalf(1.18);
  const rows = []; const BEV = 5;
  for (let k = BEV; k >= 1; k--) rows.push({ f: k / BEV, s: -1 });
  for (const m of ['-M', '-br', '-b', '-h', '0', '+h', '+b', '+br', '+M']) rows.push({ m });
  for (let k = 1; k <= BEV; k++) rows.push({ f: k / BEV, s: 1 });
  const NR = rows.length, J = {}; rows.forEach((r, j) => { if (r.m) J[r.m] = j; });
  const pos = [], nor = [];
  for (let i = 0; i < n; i++) {
    const q = Q[i], R = Rr[i], M = MID[i];
    let b = bArr[i] === null ? (PROF[i].tag === 'cowl' ? cowlB : M * 0.8) : Math.abs(bArr[i]);
    b = Math.min(b, M - 0.014); const br = Math.min(b + 0.022, M - 0.002);
    const zOf = { '-M': -M, '-br': -br, '-b': -b, '-h': -b / 2, '0': 0, '+h': b / 2, '+b': b, '+br': br, '+M': M };
    const wn = [sideN(q.x, q.y, -1), sideN(q.x, q.y, 1)];
    for (const r of rows) {
      if (r.m) { const z = zOf[r.m], k = R + bulgeAt(i, z); pos.push(q.x + q.nx * k, q.y + q.ny * k, z); nor.push(q.nx, q.ny, 0); continue; }
      const ph = r.f * Math.PI / 2, c = Math.cos(ph), sn = Math.sin(ph);
      pos.push(q.x + q.nx * R * c, q.y + q.ny * R * c, r.s * (M + R * sn));
      if (r.f === 1) { const w = wn[r.s > 0 ? 1 : 0]; nor.push(w.x, w.y, w.z); } else nor.push(q.nx * c, q.ny * c, r.s * sn);
    }
  }
  const idx = { paint: [], rubber: [], cowl: [] }, glassTri = [];
  for (let i = 0; i < n; i++) {
    const i2 = (i + 1) % n, tag = PROF[i2].tag;
    const openSeg = PROF[i].open && PROF[i2].open && PROF[i].open === PROF[i2].open;
    const rimSeg = !openSeg && (PROF[i].open || PROF[i2].open);
    for (let j = 0; j < NR - 1; j++) {
      const a = i * NR + j, b = i2 * NR + j, c = i2 * NR + j + 1, d = i * NR + j + 1;
      const inMid = j >= J['-M'] && j < J['+M'];
      if ((tag === 'bot' || tag === 'arch') && inMid) continue;
      let dst = idx.paint;
      if (openSeg) {
        if (j >= J['-b'] && j < J['+b']) { glassTri.push([i, i2, j]); continue; }
        if ((j >= J['-br'] && j < J['-b']) || (j >= J['+b'] && j < J['+br'])) dst = idx.rubber;
      } else if (rimSeg) {
        if (j >= J['-br'] && j < J['+br']) dst = idx.rubber;
      } else if (tag === 'cowl' && j >= J['-br'] && j < J['+br']) dst = idx.cowl;
      dst.push(a, b, c, a, c, d);
    }
  }
  { // normales suaves de toda la superficie (con el abombado), manteniendo la del costado en la fila que lo toca
    const allI = [...idx.paint, ...idx.rubber, ...idx.cowl];
    for (const [i, i2, j] of glassTri) { const a = i * NR + j, b = i2 * NR + j, c = i2 * NR + j + 1, d = i * NR + j + 1; allI.push(a, b, c, a, c, d); }
    const tg = new THREE.BufferGeometry(); tg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); tg.setIndex(allI); tg.computeVertexNormals();
    const nn = tg.attributes.normal.array;
    for (let i = 0; i < n; i++) for (let j = 0; j < NR; j++) {
      const r = rows[j], k = (i * NR + j) * 3;
      if (r.f === 1) continue;                                   // fila del costado: normal analítica
      const l = Math.hypot(nn[k], nn[k + 1], nn[k + 2]); if (l < 1e-6) continue;
      nor[k] = nn[k] / l; nor[k + 1] = nn[k + 1] / l; nor[k + 2] = nn[k + 2] / l;
    }
  }
  const shellGeo = (list) => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); g.setIndex(list); return g; };
  B(shellGeo(idx.paint), 'paint', 'paint', { double: true });
  B(shellGeo(idx.rubber), 'trim', 'trim', { double: true });
  B(shellGeo(idx.cowl), 'trim', 'trim', { double: true });
  { // vidrios del parabrisas y del portalón: misma malla, 5 mm hacia adentro
    const gp = [], gi = [];
    for (const [i, i2, j] of glassTri) {
      const base = gp.length / 3;
      for (const [ii, jj] of [[i, j], [i2, j], [i2, j + 1], [i, j + 1]]) { const k = (ii * NR + jj) * 3, q = Q[ii]; gp.push(pos[k] - q.nx * 0.005, pos[k + 1] - q.ny * 0.005, pos[k + 2]); }
      gi.push(base, base + 1, base + 2, base, base + 2, base + 3);
    }
    const ws = new THREE.BufferGeometry(); ws.setAttribute('position', new THREE.Float32BufferAttribute(gp, 3)); ws.setIndex(gi); ws.computeVertexNormals();
    // el del portalón es polarizado: se separa por la posición
    const gpF = [], giF = [], gpR = [], giR = [];
    for (let t = 0; t < gi.length; t += 6) {
      const isRear = gp[gi[t] * 3] < -1;
      const dstP = isRear ? gpR : gpF, dstI = isRear ? giR : giF, b0 = dstP.length / 3;
      for (let c = 0; c < 4; c++) { const k = (gi[t] + c) * 3; dstP.push(gp[k], gp[k + 1], gp[k + 2]); }
      dstI.push(b0, b0 + 1, b0 + 2, b0, b0 + 2, b0 + 3);
    }
    for (const [P2, I2, kind] of [[gpF, giF, 'glass'], [gpR, giR, 'tint']]) {
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P2, 3)); g.setIndex(I2); g.computeVertexNormals();
      B(g, kind, kind, { double: true });
    }
  }

  // ════════ costados: superficie con ventana de la puerta y paneles estampados en relieve ════════
  const winPts = [[0.404, 1.195], [0.090, 1.617], [-0.396, 1.610], [-0.390, 1.184]];
  const winPath = () => roundedPoly(winPts, [0.035, 0.05, 0.03, 0.03]);
  // paneles de la corredera y del costado trasero: contorno exterior (base) e interior (meseta), en relieve ~8 mm
  const PNL = [
    { o: [[-0.590, 1.130], [-0.590, 1.618], [-1.415, 1.618], [-1.415, 1.130]], i: [[-0.659, 1.204], [-0.659, 1.537], [-1.349, 1.537], [-1.349, 1.204]], ro: 0.06, ri: 0.025 },
    { o: [[-1.507, 1.142], [-1.507, 1.609], [-2.152, 1.600], [-2.249, 1.475], [-2.277, 1.336], [-2.284, 1.142]], i: [[-1.576, 1.218], [-1.576, 1.540], [-2.110, 1.533], [-2.186, 1.437], [-2.210, 1.330], [-2.216, 1.218]], ro: 0.06, ri: 0.025 },
  ];
  const panelPath = (pts, r) => roundedPoly(pts.map(p => [p[0], p[1]]).reverse(), r); // sentido horario → agujero
  const sideShape = new THREE.Shape(Q.map(q => new THREE.Vector2(q.x, q.y)));
  sideShape.holes.push(winPath(), ...PNL.map(p => roundedPoly(p.o, p.ro)));
  const sideBase = tess(new THREE.ShapeGeometry(sideShape, 8), 0.07);
  for (const s of [1, -1]) {
    B(mapToSide(sideBase.clone(), s), 'paint', 'paint');
    for (const p of PNL) {
      // talud: anillo entre el contorno exterior (uv.x = 0) y el interior (uv.x = 1)
      const outer = roundedPoly(p.o, p.ro), inner = roundedPoly(p.i, p.ri);
      const ring = new THREE.ShapeGeometry(Object.assign(toShape(outer), { holes: [inner] }), 8);
      const ip = inner.getPoints(8), uv = ring.attributes.uv, pp = ring.attributes.position;
      for (let k = 0; k < pp.count; k++) { const x = pp.getX(k), y = pp.getY(k); const onInner = ip.some(v => Math.abs(v.x - x) < 1e-5 && Math.abs(v.y - y) < 1e-5); uv.setXY(k, onInner ? 1 : 0, 0); }
      B(mapToSide(tess(ring, 0.05), s, 0, 0.008), 'paint', 'paint');
      const top = new THREE.ShapeGeometry(toShape(inner), 8); const tu = top.attributes.uv; for (let k = 0; k < tu.count; k++) tu.setXY(k, 1, 0);
      B(mapToSide(tess(top, 0.07), s, 0, 0.008), 'paint', 'paint');
    }
    // ventana: vidrio 12 mm hacia adentro, jamba negra y goma
    const glass = tess(new THREE.ShapeGeometry(toShape(winPath()), 8), 0.07);
    B(mapToSide(glass, s, -0.012), 'glass', 'glass', { double: true });
    const wp = winPath().getPoints(8);
    { const jp = [], ji = [];
      wp.forEach((v, k) => { const a = onSide(v.x, v.y, s, 0.0005), b = onSide(v.x, v.y, s, -0.014); jp.push(a.x, a.y, a.z, b.x, b.y, b.z); if (k) ji.push((k - 1) * 2, k * 2, k * 2 + 1, (k - 1) * 2, k * 2 + 1, (k - 1) * 2 + 1); });
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(jp, 3)); g.setIndex(ji); g.computeVertexNormals();
      B(g, 'trim', 'trim', { double: true }); }
    { const c = wp.reduce((a, v) => a.add(v), new THREE.Vector2()).divideScalar(wp.length);
      const grow = v => v.clone().sub(c).multiplyScalar(1.03).add(c);
      const ring = new THREE.ShapeGeometry(Object.assign(new THREE.Shape(wp.map(grow)), { holes: [new THREE.Path(wp)] }), 1);
      B(mapToSide(tess(ring, 0.06), s, 0.0015), 'trim', 'trim'); }
  }

  // ════════ nervaduras en relieve (fotos): cintura de la puerta delantera y línea baja a lo largo de todo el costado ════════
  for (const s of [1, -1]) {
    const bead = (pts2, r = 0.0045, sink = 0.0028) => {
      const pp = [];
      for (let i = 0; i < pts2.length - 1; i++) { const [x0, y0] = pts2[i], [x1, y1] = pts2[i + 1], m = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 0.05)); for (let k = 0; k < m; k++) { const t = k / m; pp.push(onSide(lerp(x0, x1, t), lerp(y0, y1, t), s, -sink)); } }
      const last = pts2[pts2.length - 1]; pp.push(onSide(last[0], last[1], s, -sink));
      B(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pp), pp.length * 2, r, 6, false), 'paint', 'paint');
    };
    bead([[0.512, 1.134], [-0.418, 1.137]]);                       // cintura de la puerta delantera
    bead([[0.578, 0.725], [-0.50, 0.725], [-1.47, 0.725], [-2.405, 0.724]]);   // línea baja de punta a punta
  }

  // ════════ nervios del techo, a lo largo (dato del dueño): siguen el abombado ════════
  { const roofY = (x, z) => lerp(1.762, 1.756, (-0.14 - x) / 1.96) + bulgeOut(x, 1.76, z) + 0.0008;
    const WR = 0.05, HR = 0.009, NXs = 44, NZs = 8;
    for (const zc of [-0.37, -0.13, 0.13, 0.37]) {
      const P2 = [], I2 = [];
      for (let a = 0; a <= NXs; a++) {
        const x = lerp(-0.16, -2.10, a / NXs), taper = Math.min(1, Math.min(a, NXs - a) / 3);
        for (let c = 0; c <= NZs; c++) { const t = c / NZs * 2 - 1, z = zc + t * WR / 2; P2.push(x, roofY(x, z) + HR * taper * (1 - t * t) ** 2, z); }
        if (a) for (let c = 0; c < NZs; c++) { const p0 = (a - 1) * (NZs + 1) + c, p1 = a * (NZs + 1) + c; I2.push(p0, p1 + 1, p0 + 1, p0, p1, p1 + 1); }
      }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P2, 3)); g.setIndex(I2); g.computeVertexNormals();
      B(g, 'paint', 'paint');
    }
  }

  // ════════ líneas: contorno (rayos X) y juntas ════════
  const outlinePts = [], seamPts = [];
  for (const s of [1, -1]) for (let i = 0; i < n; i++) { const a = Q[i], b = Q[(i + 1) % n]; outlinePts.push(onSide(a.x, a.y, s, 0.001), onSide(b.x, b.y, s, 0.001)); }
  const crossAt = [1, PROF.findIndex(p => p.tag === 'cowl'), PROF.findIndex(p => p.open === 'ws'), iRoof0 - 7, iRoof0, iRoof1, PROF.findIndex(p => p.open === 'rw'), PROF.findIndex(p => p.tag === 'rear'), PROF.findIndex(p => p.tag === 'bot' && p.x < -2.0) - 1];
  for (const i of crossAt) { if (i < 0) continue; const q = Q[i], R = Rr[i]; outlinePts.push(V(q.x + q.nx * R, q.y + q.ny * R, -MID[i]), V(q.x + q.nx * R, q.y + q.ny * R, MID[i])); }
  const seam = (pts2, s, step = 0.02) => {
    for (let i = 0; i < pts2.length - 1; i++) {
      const [x0, y0] = pts2[i], [x1, y1] = pts2[i + 1], m = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / step));
      for (let k = 0; k < m; k++) seamPts.push(onSide(lerp(x0, x1, k / m), lerp(y0, y1, k / m), s, 0.0015), onSide(lerp(x0, x1, (k + 1) / m), lerp(y0, y1, (k + 1) / m), s, 0.0015));
    }
  };
  for (const s of [1, -1]) {
    // puerta delantera (medida): canto delantero curvo, borde inferior = techo del paso de rueda, canto trasero escalonado
    seam([[0.533, 1.157], [0.564, 1.078], [0.580, 0.979], [0.582, 0.88], [0.580, 0.781], [0.575, 0.682], [0.570, 0.582], [0.558, 0.483], [0.534, 0.393]], s);
    seam([[-0.196, 0.640], [-0.442, 0.640], [-0.467, 0.66], [-0.467, 1.163], [-0.420, 1.184], [-0.426, 1.644], [0.090, 1.651], [0.17, 1.569], [0.291, 1.471], [0.442, 1.315], [0.533, 1.157]], s);

    // corredera y pliegue bajo
    seam([[-0.514, 0.380], [-0.520, 1.648], [-1.474, 1.648], [-1.462, 0.380]], s);
  }
  { // portalón: costados junto a los focos, borde inferior y borde superior bajo el techo
    const xr = BODY.REAR - 0.0015;
    for (const sz of [1, -1]) for (let y = 0.527; y < 1.10; y += 0.03) seamPts.push(V(xr, y, sz * 0.58), V(xr, Math.min(1.10, y + 0.03), sz * 0.58));
    seamPts.push(V(xr, 0.527, -0.58), V(xr, 0.527, 0.58), V(xr, 1.10, 0.58), V(xr, 1.10, 0.62), V(xr, 1.10, -0.58), V(xr, 1.10, -0.62));
    const top = 1.70, xt = xRear(top) - 0.002; seamPts.push(V(xt, top, -0.40), V(xt, top, 0.40));
    // pliegue de la cara delantera bajo el parabrisas
    const xc = xFront(1.09) + 0.0015; seamPts.push(V(xc, 1.09, -0.60), V(xc, 1.09, 0.60));
  }
  const outline = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(outlinePts), new THREE.LineBasicMaterial({ color: '#9fc6d2', transparent: true, opacity: 0.42 }));
  const seams = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(seamPts), new THREE.LineBasicMaterial({ color: '#c3dbe2', transparent: true, opacity: 0.38 }));
  body.add(outline, seams);
  outline.userData.noBox = seams.userData.noBox = true;

  // piezas que envuelven una esquina: copian el casco (filas del bisel del lado s) `out` metros afuera y siguen `ext` por el costado
  const wrapShell = (tag, y0, y1, s, out, ext, kind, cat, part, caps = false) => {
    const ids = []; for (let i = 0; i < n; i++) if (PROF[i].tag === tag && PROF[i].y >= y0 - 1e-4 && PROF[i].y <= y1 + 1e-4) ids.push(i);
    const jr = [J[s > 0 ? '+M' : '-M']]; rows.forEach((r, j) => { if (r.f !== undefined && r.s === s) jr.push(j); });
    if (s < 0) { const m = jr.shift(); jr.sort((a, b) => b - a); jr.unshift(m); }   // de la cara hacia el costado
    const P2 = [], I2 = [], exts = ext > 0 ? [ext / 3, 2 * ext / 3, ext] : [], cols = jr.length + exts.length;
    const at = (i, j, o) => { const k = (i * NR + j) * 3; return [pos[k] + nor[k] * o, pos[k + 1] + nor[k + 1] * o, pos[k + 2] + nor[k + 2] * o]; };
    ids.forEach((i, a) => {
      for (const j of jr) P2.push(...at(i, j, out));
      const q = Q[i]; for (const d of exts) { const v = onSide(q.x - d, q.y, s, out); P2.push(v.x, v.y, v.z); }
      if (a) for (let c = 0; c < cols - 1; c++) { const p0 = (a - 1) * cols + c, p1 = a * cols + c; I2.push(p0, p1, p1 + 1, p0, p1 + 1, p0 + 1); }
    });
    if (caps) for (const i of [ids[0], ids[ids.length - 1]]) {          // tapas arriba y abajo: del casco a la pieza
      const b0 = P2.length / 3;
      jr.forEach(j => { P2.push(...at(i, j, 0), ...at(i, j, out)); });
      for (let c = 0; c < jr.length - 1; c++) { const p0 = b0 + c * 2; I2.push(p0, p0 + 2, p0 + 3, p0, p0 + 3, p0 + 1); }
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P2, 3)); g.setIndex(I2); g.computeVertexNormals();
    return B(g, kind, cat, { part, double: true });
  };

  // ════════ frente ════════
  const lean = Math.atan(0.072);                          // la cara delantera se recuesta ~4°
  const fx = y => xFront(y);
  const midAt = y => halfW(fx(y) - R_FRONT, y) - R_FRONT; // fin de la parte plana de la cara (antes de la esquina)
  for (const s of [1, -1]) {
    // marco negro de los focos (medido): de |z| 0,297–0,317 hasta la esquina, alto 0,748–0,962, y la vuelta de la esquina
    const zo = midAt(0.855), y0 = 0.748, y1 = 0.962;
    const outer = roundedPoly([[zo, y0], [zo, y1], [0.317, y1], [0.297, y0]], [0.0, 0.0, 0.012, 0.012]);
    const hole = rrect(0.379, 0.810, 0.573, 0.938, 0.018);
    const bz = new THREE.ExtrudeGeometry(Object.assign(toShape(outer), { holes: [hole] }), { depth: 0.007, bevelEnabled: false, curveSegments: 6 });
    bz.applyMatrix4(new THREE.Matrix4().makeBasis(V(0, 0, s), V(0, 1, 0), V(-s, 0, 0)));   // forma (|z|, y) → mundo (rotación pura)
    if (s > 0) bz.translate(0.007, 0, 0);                                                  // queda entre x = 0 y x = 0,007
    B(placeFront(bz, 0.855), 'trim', 'trim', { part: 'luces', double: true });
    // vuelta de la esquina
    wrapShell('front', y0, y1, s, 0.0045, 0.045, 'trim', 'trim', 'luces');          // vuelta de la esquina y 4,5 cm por el costado (foto 3/4)
    // óptica 200×142 mm: reflector cromado, ampolleta y mica
    const zc = s * 0.476, yc = 0.874;
    B(rbox(0.012, 0.118, 0.182, 0.014), 'chrome', 'lamp', { part: 'luces', p: [fx(yc) + 0.004, yc, zc], r: [0, 0, lean] });
    B(cylX(0.016, 0.02, 14), 'lamp', 'lamp', { part: 'luces', p: [fx(yc) + 0.010, yc, zc] });
    B(rbox(0.008, 0.129, 0.194, 0.018), 'lens', 'glass', { part: 'luces', p: [fx(yc) + 0.014, yc, zc], r: [0, 0, lean] });
  }
  function placeFront(geo, yc) { // la forma está en x = 0; se recuesta como la cara delantera alrededor de y = yc
    geo.translate(0, -yc, 0); geo.rotateZ(lean); geo.translate(fx(yc) - 0.002, yc, 0);
    return geo;
  }
  // emblema genérico (sin logo) y plumillas
  B(rbox(0.006, 0.05, 0.05, 0.016), 'alu', 'trim', { p: [fx(0.825) + 0.003 + bulgeOut(fx(0.825), 0.825, 0), 0.825, 0], r: [0, 0, lean] });
  for (const zp of [0.0, -0.48]) {   // pivotes al centro y al lado conductor; estacionadas hacia el copiloto (foto de frente)
    const bo = bulgeOut(0.585, 1.152, zp + 0.2);
    const base = V(0.585 + bulgeOut(0.585, 1.152, zp), 1.152, zp), tip = V(0.552 + bo, 1.205, zp + 0.41);
    B(cylX(0.013, 0.022, 10), 'trim', 'trim', { p: [base.x, base.y, base.z] });
    B(tube([base, base.clone().lerp(tip, 0.5).add(V(0.004, 0.012, 0)), tip], 0.0055), 'trim', 'trim');
    B(rbox(0.012, 0.012, 0.40, 0.004), 'trim', 'trim', { p: [0.548 + bo, 1.212, zp + 0.21] });
  }
  // parachoques delantero alto (0,395–0,713 m): perfil en planta extruido en altura, envuelve las esquinas
  const bumper = (xFace0, back, zO0, zI, xIn, h, y, rr) => {
    const bs = 0.02, bt = 0.03, xFace = xFace0 - bs, zO = zO0 - bs;   // bordes redondeados (fotos): la forma se achica lo que crece el bisel
    const sh = new THREE.Shape();
    sh.moveTo(back, -zO); sh.lineTo(xFace - rr, -zO); sh.quadraticCurveTo(xFace, -zO, xFace, -zO + rr);
    sh.lineTo(xFace, zO - rr); sh.quadraticCurveTo(xFace, zO, xFace - rr, zO); sh.lineTo(back, zO);
    sh.lineTo(back, zI); sh.lineTo(xIn - 0.05, zI); sh.quadraticCurveTo(xIn, zI, xIn, zI - 0.06);
    sh.lineTo(xIn, -zI + 0.06); sh.quadraticCurveTo(xIn, -zI, xIn - 0.05, -zI); sh.lineTo(back, -zI); sh.lineTo(back, -zO);
    const g = new THREE.ExtrudeGeometry(sh, { depth: h - 2 * bt, bevelEnabled: true, bevelThickness: bt, bevelSize: bs, bevelSegments: 5, curveSegments: 10 });
    g.rotateX(-Math.PI / 2); g.translate(0, y - h / 2 + bt, 0);
    return g;
  };
  B(bumper(BODY.BUMPF, 0.585, 0.69, 0.668, BODY.FRONT + 0.002, 0.318, 0.554, 0.13), 'trim', 'trim');
  for (const s of [1, -1]) {
    B(rbox(0.008, 0.05, 0.118, 0.008), 'amber', 'lamp', { part: 'luces', p: [BODY.BUMPF + 0.002, 0.572, s * 0.472] });
    B(rbox(0.008, 0.05, 0.05, 0.008), 'lamp', 'lamp', { part: 'luces', p: [BODY.BUMPF + 0.0, 0.572, s * 0.556] });
  }
  B(rbox(0.006, 0.13, 0.36, 0.006), 'white', 'trim', { p: [BODY.BUMPF + 0.005, 0.545, 0] });         // patente (sin número)
  B(rbox(0.005, 0.138, 0.368, 0.006), 'trim', 'trim', { p: [BODY.BUMPF + 0.002, 0.545, 0] });
  B(rbox(0.006, 0.03, 0.60, 0.008), 'dark', 'trim', { p: [BODY.BUMPF - 0.002, 0.455, 0] });          // ranura inferior
  // espejos negros en la esquina delantera baja de la ventana
  for (const s of [1, -1]) {
    const base = onSide(0.42, 1.19, s), head = V(0.452, 1.25, s * 0.70);
    B(tube([base, V(0.445, 1.215, s * 0.665), head], 0.010), 'trim', 'trim');
    B(rbox(0.077, 0.15, 0.128, 0.02), 'trim', 'trim', { p: head.toArray() });
    B(rbox(0.004, 0.13, 0.11, 0.01), 'chrome', 'trim', { p: [head.x - 0.040, head.y, head.z] });
  }

  // ════════ costados: manillas, pilar B, riel de la corredera, nervios, guardabarros ════════
  for (const s of [1, -1]) {
    const SB = (geo, kind, cat, x, y, out, o = {}) => B(geo, kind, cat, { p: onSide(x, y, s, out).toArray(), r: [tiltX(x, y, s), 0, 0], ...o });
    SB(rbox(0.150, 0.062, 0.006, 0.012), 'shade', 'paint', -0.289, 1.038, 0.0005);                      // nicho de la manilla
    SB(rbox(0.138, 0.027, 0.012, 0.012), 'trim', 'trim', -0.289, 1.040, 0.003);                         // manilla
    SB(cylZ(0.0075, 0.012, 14), 'chrome', 'trim', -0.343, 0.960, 0.003);                                // chapa
    SB(rbox(0.070, 0.180, 0.006, 0.02), 'shade', 'paint', -0.695, 0.989, 0.0005);                       // nicho corredera
    SB(rbox(0.026, 0.144, 0.014, 0.008), 'trim', 'trim', -0.695, 0.989, 0.004);                         // manilla corredera
    SB(rbox(0.080, 0.235, 0.008, 0.006), 'trim', 'trim', -0.479, 1.4705, 0.003);                        // placa negra del pilar B
    SB(rbox(0.063, 0.068, 0.010, 0.012), 'amber', 'lamp', -0.4785, 1.403, 0.006, { part: 'luces' });    // marcador lateral
    SB(rbox(0.789, 0.055, 0.016, 0.01), 'trim', 'trim', -1.876, 0.837, 0.006);                          // cubierta del riel central
    SB(rbox(0.785, 0.006, 0.004, 0.002), 'dark', 'trim', -1.876, 0.838, 0.0145);
    for (const [y, x0] of [[0.548, -0.262], [0.581, -0.238], [0.617, -0.213]]) {                        // nervios bajos
      const len = x0 + 1.364; SB(rbox(len, 0.012, 0.006, 0.003), 'paint', 'paint', x0 - len / 2, y, 0.002);
    }
    // guardabarros de goma tras la rueda delantera
    B(rbox(0.008, 0.228, 0.16, 0.01), 'rubber', 'trim', { p: [-0.405, 0.281, s * 0.585] });
    // canaleta del techo
    const gp = []; for (let x = -0.02; x >= -2.16; x -= 0.12) gp.push(onSide(x, 1.662, s, 0.005));
    B(tube(gp, 0.006, false, 48), 'paint', 'paint');
    // forro oscuro de los pasos de rueda: sigue el borde medido hacia adentro
    for (const [a0, a1] of [[PROF.findIndex(p => p.tag === 'arch' && p.x < -1.4), -1], [PROF.findIndex(p => p.tag === 'arch' && p.x > -0.4 && p.x < 0), 1]]) {
      const lp = [], li = []; let k = 0;
      for (let i = a0 - 1; i < n && (PROF[i].tag === 'arch' || i === a0 - 1); i++) {
        const p = PROF[i], w = halfW(p.x, p.y);
        lp.push(p.x, p.y, s * (w - 0.004), p.x, p.y, s * (w - 0.24));
        if (k) li.push((k - 1) * 2, k * 2, k * 2 + 1, (k - 1) * 2, k * 2 + 1, (k - 1) * 2 + 1);
        k++;
      }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(lp, 3)); g.setIndex(li); g.computeVertexNormals();
      B(g, 'trim', 'trim', { double: true });
      void a1;
    }
  }
  // tapa de bencina: costado del copiloto, detrás de la rueda delantera, cruzada por los nervios bajos (foto 3/4 de este furgón)
  { const x = FUEL_LID.x, y = FUEL_LID.y, s = 1;
    B(rbox(0.121, 0.161, 0.004, 0.024), 'dark', 'trim', { part: 'estanque', p: onSide(x, y, s, 0.0004).toArray() });
    B(rbox(0.115, 0.155, 0.006, 0.021), 'paint', 'paint', { part: 'estanque', p: onSide(x, y, s, 0.0014).toArray() });
    B(rbox(0.012, 0.022, 0.006, 0.005), 'dark', 'trim', { part: 'estanque', p: onSide(x - 0.052, y + 0.02, s, 0.0026).toArray() }); }  // uña para abrirla

  // ════════ atrás ════════
  const xr = BODY.REAR;
  for (const s of [1, -1]) {
    // focos verticales en las esquinas (0,748–1,036 m): ámbar, rojo y retroceso, con la vuelta de la esquina
    const M = halfW(xr + R_REAR, 0.9) - R_REAR;
    const parts = [['amber', 0.927, 1.036], ['red', 0.818, 0.927], ['lamp', 0.748, 0.818]], LO = 0.02;   // la unidad sobresale 2 cm (foto de costado)
    B(rbox(0.016, 0.294, M - 0.581 + 0.012, 0.005), 'trim', 'trim', { part: 'luces', p: [xr - 0.008, 0.892, s * (0.581 + M) / 2] });
    for (const [kind, ya, yb] of parts) {
      B(rbox(0.012, yb - ya - 0.004, M - 0.581, 0.004), kind, 'lamp', { part: 'luces', p: [xr - LO + 0.006, (ya + yb) / 2, s * (0.581 + M) / 2] });
      wrapShell('rear', ya, yb, s, LO, 0.0, kind, 'lamp', 'luces', true);
    }
  }
  B(rbox(0.016, 0.089, 0.61, 0.012), 'trim', 'trim', { p: [xr - 0.006, 1.044, 0] });                       // moldura negra bajo el vidrio
  { // rebaje trapezoidal de la patente
    const sh = new THREE.Shape([new THREE.Vector2(-0.286, 0.999), new THREE.Vector2(0.286, 0.999), new THREE.Vector2(0.233, 0.822), new THREE.Vector2(-0.233, 0.822)]);
    const g = new THREE.ShapeGeometry(sh); g.applyMatrix4(new THREE.Matrix4().makeBasis(V(0, 0, 1), V(0, 1, 0), V(-1, 0, 0)).setPosition(xr - 0.0012, 0, 0));
    B(g, 'shade', 'paint', { double: true });
  }
  B(rbox(0.006, 0.135, 0.36, 0.006), 'white', 'trim', { p: [xr - 0.005, 0.922, 0] });                     // patente (sin número)
  B(rbox(0.004, 0.143, 0.368, 0.006), 'trim', 'trim', { p: [xr - 0.003, 0.922, 0] });
  B(rbox(0.022, 0.073, 0.205, 0.01), 'trim', 'trim', { p: [xr - 0.01, 0.730, 0] });                       // manilla del portalón
  B(cylX(0.009, 0.01, 12), 'chrome', 'trim', { p: [xr - 0.022, 0.730, 0] });
  for (const y of [0.558, 0.593]) B(rbox(0.006, 0.010, 1.10, 0.003), 'paint', 'paint', { p: [xr - 0.002, y, 0] }); // nervios bajos
  { // parachoques trasero: barra (0,385–0,51 m) y esquineros que suben a 0,57 m
    const g = bumper(0.07, -0.086, 0.69, 0.668, 0.002, 0.125, 0.4475, 0.10); g.rotateY(Math.PI); g.translate(xr, 0, 0);
    B(g, 'trim', 'trim');
    for (const s of [1, -1]) B(rbox(0.09, 0.07, 0.06, 0.015), 'trim', 'trim', { p: [xr + 0.02, 0.535, s * 0.655] });
    B(rbox(0.03, 0.03, 1.03, 0.008), 'dark', 'trim', { p: [xr - 0.035, 0.36, -0.045] });                 // travesaño bajo el parachoques
  }

  // ════════ techo: parrilla de las fotos ════════
  const RK = (geo, kind, p, o = {}) => B(geo, kind, 'rack', { part: 'parrilla', p, ...o });
  { // barras laterales planas de 10 cm con ranuras alargadas
    const X0 = -0.003, X1 = -1.936, Y0 = 1.817, Y1 = 1.918, len = X0 - X1;
    const sh = toShape(rrect(-len / 2, Y0, len / 2, Y1, 0.03));
    const nS = 8, pitch = (len - 0.12) / nS;
    for (let k = 0; k < nS; k++) { const c = -len / 2 + 0.06 + pitch * (k + 0.5); sh.holes.push(rrect(c - pitch * 0.36, 1.851, c + pitch * 0.36, 1.886, 0.017)); }
    const bar = new THREE.ExtrudeGeometry(sh, { depth: 0.006, bevelEnabled: false, curveSegments: 6 });
    for (const s of [1, -1]) { const g = bar.clone(); g.translate(0, 0, -0.003); RK(g, 'trim', [(X0 + X1) / 2, 0, s * 0.585], { double: true }); }
    // patas cónicas sobre la canaleta
    const foot = new THREE.Shape([new THREE.Vector2(-0.075, 1.662), new THREE.Vector2(0.075, 1.662), new THREE.Vector2(0.032, 1.817), new THREE.Vector2(-0.032, 1.817)]);
    const fg = new THREE.ExtrudeGeometry(foot, { depth: 0.042, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.004, bevelSegments: 1 });
    fg.translate(0, 0, -0.021);
    for (const x of [-0.075, -0.72, -1.25, -1.775]) for (const s of [1, -1]) {
      RK(fg.clone(), 'trim', [x, 0, s * 0.585]);
      RK(rbox(0.07, 0.022, 0.06, 0.006), 'trim', [x, 1.664, s * 0.590]);
    }
    // travesaños plateados y extremos negros
    for (let k = 0; k < 9; k++) { const x = lerp(-0.07, -1.87, k / 8); RK(cylZ(0.011, 1.17, 12), 'bar', [x, 1.840, 0]); }
    for (const x of [X0 - 0.02, X1 + 0.02]) RK(rbox(0.03, 0.05, 1.17, 0.006), 'trim', [x, 1.845, 0]);
  }
  return { body, outline, seams };
}

// ════════ ruedas: neumático 175/70 R13 (Ø 575 mm) y llanta de aleación de 13" ════════
// llanta de las fotos: 5 rayos en "Y" con caras maquinadas, aro pulido y maza multi-PCD (8 agujeros, 4 tuercas)
export const TIRE = { R: 0.2876, W: 0.175, RIM: 0.1651 };
export function buildWheel(ctx, parent, s) {
  const { rbox, cylZ, add } = ctx;
  const spin = new THREE.Group(); parent.add(spin);
  const W = (geo, kind, p, o = {}) => add('ruedas', geo, kind, { parent: spin, p, ex: null, ...o });
  // perfil del neumático: banda de rodado 0,14 m, flanco abombado hasta el talón en el aro
  const tp = [[0.170, -0.064], [0.190, -0.078], [0.222, -0.0875], [0.252, -0.085], [0.272, -0.074], [0.2835, -0.056], [0.2876, -0.03], [0.2876, 0.03], [0.2835, 0.056], [0.272, 0.074], [0.252, 0.085], [0.222, 0.0875], [0.190, 0.078], [0.170, 0.064]];
  const tire = new THREE.LatheGeometry(tp.map(p => new THREE.Vector2(p[0], p[1])), 64); tire.rotateX(Math.PI / 2);
  W(tire, 'tire', [0, 0, 0]);
  for (let k = 0; k < 36; k++) { const a = k / 36 * Math.PI * 2; W(rbox(0.012, 0.006, 0.13, 0.002), 'tire', [Math.cos(a) * 0.2885, Math.sin(a) * 0.2885, 0], { r: [0, 0, a] }); } // tacos
  W(cylZ(0.166, 0.13, 40), 'rim', [0, 0, -s * 0.006]);                             // barril
  W(new THREE.TorusGeometry(0.172, 0.0085, 8, 56), 'machined', [0, 0, s * 0.064]);  // aro pulido
  W(new THREE.TorusGeometry(0.163, 0.004, 6, 56), 'rim', [0, 0, s * 0.058]);
  W(cylZ(0.160, 0.004, 40), 'dark', [0, 0, s * 0.020]);                            // fondo
  W(cylZ(0.058, 0.03, 28), 'rim', [0, 0, s * 0.050]);                              // maza
  W(cylZ(0.027, 0.012, 20), 'dark', [0, 0, s * 0.068]);                            // tapa central
  for (let k = 0; k < 5; k++) {
    const a = k / 5 * Math.PI * 2 + 0.31;
    const stem = rbox(0.050, 0.030, 0.026, 0.006); stem.translate(0.075, 0, 0);
    W(stem, 'rim', [0, 0, s * 0.054], { r: [0, 0, a] });
    for (const d of [-1, 1]) {                                                       // brazos de la Y con cara maquinada
      const a2 = a + d * 0.19, x0 = 0.095;
      const arm = rbox(0.078, 0.019, 0.022, 0.005); arm.translate(x0 + 0.036, 0, 0);
      W(arm, 'rim', [0, 0, s * 0.052], { r: [0, 0, a2] });
      const face = rbox(0.074, 0.004, 0.004, 0.0015); face.translate(x0 + 0.036, d * 0.0085, 0);
      W(face, 'machined', [0, 0, s * 0.0635], { r: [0, 0, a2] });
    }
    const thin = rbox(0.10, 0.011, 0.016, 0.004); thin.translate(0.112, 0, 0);       // rayo delgado entre las Y
    W(thin, 'rim', [0, 0, s * 0.046], { r: [0, 0, a + Math.PI / 5] });
  }
  for (let k = 0; k < 8; k++) {                                                      // 8 agujeros, 4 con tuerca
    const a = k / 8 * Math.PI * 2 + 0.2, r = k % 2 ? 0.0572 : 0.050;
    if (k % 2 === 0) W(cylZ(0.0075, 0.016, 6), 'chrome', [Math.cos(a) * r, Math.sin(a) * r, s * 0.070]);
    else W(cylZ(0.0065, 0.004, 10), 'dark', [Math.cos(a) * r, Math.sin(a) * r, s * 0.0655]);
  }
  W(cylZ(0.0035, 0.025, 6), 'rubber', [Math.cos(-0.6) * 0.15, Math.sin(-0.6) * 0.15, s * 0.07]);  // válvula
  return spin;
}
