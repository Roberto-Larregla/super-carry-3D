// Motor F10A detallado. Se construye en el marco del motor (ver geom.js) dentro del grupo `parent`.
// ctx.lite = versión liviana para el furgón (sin resortes, balancines, dientes ni pernos).
import * as THREE from 'three';
import { CYL_X, FIRE_OFF, DIR, R, L, CH, DECK, BORE_R, TILT, cyclePhi, phaseOf, PHASES } from './geom.js';
import { PARTS } from './data.js';

export const CAM_Y = 0.275;
const HEAD_TOP = 0.31, B_FRONT = 0, B_REAR = -0.375;
const VDX = 0.010;            // admisión 1 cm adelante del eje del cilindro, escape 1 cm atrás
const VTILT = 0.333;          // válvulas en V: 19° respecto del eje del cilindro
const VLEN = 0.1148;          // asiento → punta del vástago
const SPR_H = 0.04;
const UP = new THREE.Vector3(0, Math.cos(TILT), -Math.sin(TILT)); // "arriba" del furgón visto desde el marco del motor
const WZ = new THREE.Vector3(0, Math.sin(TILT), Math.cos(TILT));  // "derecha" del furgón vista desde el marco del motor
// Mundo (relativo al cigüeñal, [derecha, arriba]) → marco del motor [z, y]
const w2e = ([Z, Y]) => [-Y * Math.sin(TILT) + Z * Math.cos(TILT), Y * Math.cos(TILT) + Z * Math.sin(TILT)];
// Distribuidor (manual SK410, secc. 8): engranaje helicoidal en la punta trasera del árbol de levas, dentro de una caja con
// aceite; el eje del distribuidor queda en ángulo recto con el árbol y gira a su misma velocidad, horario visto desde la tapa.
const DSA = 20 * Math.PI / 180;                                     // inclinación del eje hacia el cigüeñal (aprox., fotos del manual)
const DAX = new THREE.Vector3(0, -Math.sin(DSA), Math.cos(DSA));    // eje del distribuidor: sale hacia el lado admisión
const DNR = new THREE.Vector3(0, -Math.cos(DSA), -Math.sin(DSA));   // x × DAX
const XG = -0.418;                                                   // plano de los engranajes helicoidales
const DOR = new THREE.Vector3(XG, CAM_Y, 0).addScaledVector(DNR, -0.021); // centro del engranaje del distribuidor
const TOWER_A = [45, 315, 135, 225];                                 // borne de la tapa para los cilindros 1..4 (° locales x→z)
const ROTOR_A0 = 45 - 176;                                           // el rotor apunta al borne 1 cuando el cil. 1 está a 352° de su ciclo
const XB = 0.022;             // plano de la correa dentada
const XP = 0.064;             // plano de la correa en V
const MAINS = [[-0.0305, 0.037], [-0.109, 0.036], [-0.187, 0.036], [-0.265, 0.036], [-0.3425, 0.035]];
const PH = [0, Math.PI, Math.PI, 0]; // codos 1-4 arriba, 2-3 abajo

// Desplazamientos de despiece en el marco del motor
const EXE = {
  culata: [0, 0.17, 0], junta_culata: [0, 0.095, 0], tapa_valvulas: [0, 0.37, 0], arbol_levas: [0, 0.3, 0], balancines: [0, 0.265, 0], valvulas: [0, 0.2, 0],
  pistones: [0, 0.06, 0], bielas: [0, -0.04, 0], ciguenal: [0, -0.1, 0], carter: [0, -0.25, 0], chupador: [0, -0.18, 0], bomba_aceite: [0.09, -0.09, 0],
  distribucion: [0.15, 0, 0], tapa_dist: [0.27, 0, 0], tensor: [0.15, 0, 0.04], correa_acc: [0.3, 0, 0], bomba_agua: [0.2, 0, 0], ventilador: [0.42, 0, 0],
  alternador: [0.12, 0, 0.17], mult_adm: [0, 0.06, 0.15], carburador: [0, 0.17, 0.25], filtro_aire: [0, 0.33, 0.36], termostato: [0.05, 0.08, 0.17],
  mult_esc: [0, -0.04, -0.2], sonda: [0, -0.05, -0.27], bujias: [0, 0.03, -0.15], distribuidor: [-0.03, -0.065, 0.18], caja_dist: [-0.11, 0, 0], volante: [-0.13, 0, 0], partida: [-0.1, -0.05, 0.13],
  filtro_aceite: [0, -0.07, -0.085], s_aceite: [0, -0.02, -0.1], s_temp: [0.05, 0.12, 0.2], s_termo: [0.05, 0.12, 0.22], s_senal: [-0.02, -0.035, 0.1], varilla: [0, 0.1, 0.12],
};

// ——— utilidades geométricas ———
function extrudeX(shape, x0, x1, bevel = 0.003, seg = 10) {
  const depth = Math.max(0.001, (x0 - x1) - 2 * bevel);
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, curveSegments: seg });
  g.rotateY(-Math.PI / 2); g.translate(x0 - bevel, 0, 0);
  return g;
}
function poly(pts) { const s = new THREE.Shape(); s.moveTo(...pts[0]); pts.slice(1).forEach(p => s.lineTo(...p)); s.closePath(); return s; }
function gearShape(r, teeth, depth = 0.003, hole = 0) {
  const s = new THREE.Shape(); const n = teeth * 4;
  for (let i = 0; i <= n; i++) {
    const a = i / n * Math.PI * 2, k = i % 4;
    const rr = (k === 0 || k === 3) ? r - depth : r;
    const x = Math.cos(a) * rr, y = Math.sin(a) * rr; i ? s.lineTo(x, y) : s.moveTo(x, y);
  }
  if (hole) { const hp = new THREE.Path(); hp.absarc(0, 0, hole, 0, Math.PI * 2, true); s.holes.push(hp); }
  return s;
}
// disco dentado / perfil extruido a lo largo de x (centrado)
function discX(shape, w, seg = 8) { const g = new THREE.ExtrudeGeometry(shape, { depth: w, bevelEnabled: false, curveSegments: seg }); g.rotateY(-Math.PI / 2); g.translate(w / 2, 0, 0); return g; }
function camShape(rb = 0.0145, lift = 0.006) {
  const s = new THREE.Shape();
  for (let i = 0; i <= 72; i++) {
    const g = (i / 72) * 360 - 180; const t = Math.abs(g) < 62 ? Math.cos(g / 62 * Math.PI / 2) ** 2 : 0;
    const r = rb + lift * t, a = (g + 90) * Math.PI / 180; // nariz hacia +Y
    const x = Math.cos(a) * r, y = Math.sin(a) * r; i ? s.lineTo(x, y) : s.moveTo(x, y);
  }
  return s;
}
function webShape() {
  const s = new THREE.Shape();
  s.moveTo(0.024, R); s.absarc(0, R, 0.024, 0, Math.PI, false); s.lineTo(-0.03, 0);
  s.absarc(0, 0, 0.052, Math.PI * 193 / 180, Math.PI * 347 / 180, false); s.lineTo(0.03, 0); s.closePath();
  return s;
}
// correa: envolvente convexa de poleas en el plano (y, z), remuestreada por largo de arco
function hullBelt(circles, N = 260) {
  const pts = [];
  for (const c of circles) for (let i = 0; i < 90; i++) { const a = i / 90 * Math.PI * 2; pts.push([c.y + Math.cos(a) * c.r, c.z + Math.sin(a) * c.r]); }
  pts.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = [], up = [];
  for (const p of pts) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p); }
  for (let i = pts.length - 1; i >= 0; i--) { const p = pts[i]; while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], p) <= 0) up.pop(); up.push(p); }
  lo.pop(); up.pop(); const hull = lo.concat(up); // antihorario en (y, z)
  const cum = [0]; for (let i = 1; i <= hull.length; i++) { const a = hull[i - 1], b = hull[i % hull.length]; cum.push(cum[i - 1] + Math.hypot(b[0] - a[0], b[1] - a[1])); }
  const len = cum[cum.length - 1];
  const at = s => { s = ((s % len) + len) % len; let j = 1; while (cum[j] < s) j++; const a = hull[j - 1], b = hull[j % hull.length], t = (s - cum[j - 1]) / (cum[j] - cum[j - 1] || 1); return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]; };
  const S = []; for (let i = 0; i < N; i++) S.push(at(i / N * len));
  const frame = s => { const p = at(s), q = at(s + 0.002), m = at(s - 0.002); let ty = q[0] - m[0], tz = q[1] - m[1]; const l = Math.hypot(ty, tz) || 1; ty /= l; tz /= l; return { p, t: [ty, tz], o: [tz, -ty] }; };
  return { len, S, frame };
}
function bandGeo(belt, x, w, th) {
  const N = belt.S.length, pos = [], idx = [];
  for (let i = 0; i < N; i++) {
    const s = i / N * belt.len, f = belt.frame(s);
    const iy = f.p[0], iz = f.p[1], oy = iy + f.o[0] * th, oz = iz + f.o[1] * th;
    pos.push(x - w / 2, iy, iz, x + w / 2, iy, iz, x + w / 2, oy, oz, x - w / 2, oy, oz);
  }
  for (let i = 0; i < N; i++) {
    const a = i * 4, b = ((i + 1) % N) * 4;
    for (const [p, q] of [[0, 1], [1, 2], [2, 3], [3, 0]]) idx.push(a + p, b + p, b + q, a + p, b + q, a + q);
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
  return g;
}

export function buildEngine(ctx, parent) {
  const { V, rbox, cylX, cylY, cylZ, tube, helix, add, group, lite } = ctx;
  const exk = ctx.exk ?? 1;
  const ex = id => (EXE[id] || [0, 0, 0]).map(v => v * exk);
  const A = { pistons: [], rods: [], valves: [], rockers: [], springs: [], gas: [], sparks: [], spin: [], teeth: null, belt: null };
  const P = (part, geo, kind, o = {}) => add(part, geo, kind, { parent: parent, ...o, ex: 'ex' in o ? o.ex : ex(part) });
  const carrier = (part, p = [0, 0, 0], exOverride) => group(part, parent, p, exOverride || ex(part));
  const orientY = (m, d) => { m.quaternion.setFromUnitVectors(V(0, 1, 0), V(...d).normalize()); return m; };

  // ════════ BLOCK ════════
  const blockShape = poly([[-0.088, -0.035], [0.088, -0.035], [0.088, 0.03], [0.068, 0.078], [0.068, DECK], [-0.068, DECK], [-0.068, 0.078], [-0.088, 0.03]]);
  P('bloque', extrudeX(blockShape, B_FRONT, B_REAR, 0.004), 'iron', { casing: true, double: true });
  CYL_X.forEach(cx => P('bloque', new THREE.CylinderGeometry(BORE_R, BORE_R, DECK - 0.055, 32, 1, true), 'steel', { p: [cx, (DECK + 0.055) / 2, 0], casing: true, double: true }));
  if (!lite) {
    for (const [xm] of MAINS) for (const s of [1, -1]) P('bloque', rbox(0.008, 0.06, 0.006, 0.002), 'iron', { p: [xm, 0.0, s * 0.089], casing: true });
    [-0.11, -0.19, -0.27].forEach(x => P('bloque', cylZ(0.012, 0.004, 20), 'steel', { p: [x, 0.125, -0.069], casing: true }));
    // camisas de agua (visibles en corte o rayos X)
    CYL_X.forEach(cx => P('camisas', new THREE.CylinderGeometry(0.047, 0.047, 0.088, 28, 1, true), 'water', { p: [cx, 0.13, 0], op: 0.42, casing: true, double: true }));
    P('camisas', rbox(0.35, 0.012, 0.13, 0.004), 'water', { p: [-0.188, 0.19, 0], op: 0.38, casing: true, ex: ex('culata') });
  }

  // ════════ CIGÜEÑAL ════════
  const crankC = carrier('ciguenal');
  const crank = new THREE.Group(); crankC.add(crank); A.crank = crank;
  const ck = (geo, kind, p, r) => add('ciguenal', geo, kind, { parent: crank, p, r, ex: null });
  MAINS.forEach(([x, w]) => ck(cylX(0.025, w, 28), 'steel', [x, 0, 0]));
  ck(cylX(0.016, 0.09, 20), 'steel', [0.033, 0, 0]);
  ck(cylX(0.032, 0.012, 28), 'steel', [-0.366, 0, 0]);
  const webG = discX(webShape(), 0.011, 14);
  CYL_X.forEach((cx, i) => {
    ck(cylX(0.019, 0.02, 22), 'chrome', [cx, Math.cos(PH[i]) * R, Math.sin(PH[i]) * R]);
    for (const d of [-0.0155, 0.0155]) ck(webG, 'steel', [cx + d, 0, 0], [PH[i], 0, 0]);
  });

  // ════════ BIELAS ════════
  const rodC = carrier('bielas');
  CYL_X.forEach((cx, i) => {
    const g = new THREE.Group(); rodC.add(g);
    const rk = (geo, kind, p) => add('bielas', geo, kind, { parent: g, p, ex: null });
    rk(cylX(0.0265, 0.018, 24), 'steel', [0, 0, 0]);
    rk(rbox(0.007, L - 0.04, 0.012, 0.002), 'steel', [0, L / 2, 0]);
    if (!lite) {
      for (const s of [1, -1]) rk(rbox(0.016, L - 0.042, 0.0035, 0.001), 'steel', [0, L / 2, s * 0.0058]);
      for (const s of [1, -1]) rk(cylY(0.0042, 0.03, 8), 'dark', [0, -0.012, s * 0.0195]);
    }
    rk(cylX(0.0125, 0.016, 18), 'steel', [0, L, 0]);
    A.rods.push({ g, cx, ph: PH[i] });
  });

  // ════════ PISTONES ════════
  const pistC = carrier('pistones');
  CYL_X.forEach((cx, i) => {
    const g = new THREE.Group(); pistC.add(g);
    const pk = (geo, kind, p) => add('pistones', geo, kind, { parent: g, p, ex: null });
    pk(cylY(BORE_R - 0.0004, 0.05, 32), 'alu', [0, -0.001, 0]);
    pk(cylY(BORE_R - 0.0012, 0.003, 32), 'chrome', [0, CH - 0.0015, 0]);
    if (!lite) {
      [0.0215, 0.0175, 0.0125].forEach((y, k) => pk(cylY(BORE_R, k === 2 ? 0.0026 : 0.0015, 32), 'dark', [0, y, 0]));
      pk(cylX(0.008, 0.052, 16), 'steel', [0, 0, 0]);
    }
    A.pistons.push({ g, cx, ph: PH[i], i });
    if (!lite) {
      const gm = new THREE.MeshBasicMaterial({ color: PHASES[0].color, transparent: true, opacity: 0.4, depthWrite: false });
      ctx.clipAll && ctx.clipAll(gm);
      const gas = new THREE.Mesh(new THREE.CylinderGeometry(BORE_R - 0.0008, BORE_R - 0.0008, 1, 28), gm);
      gas.position.x = cx; gas.visible = false; parent.add(gas); A.gas.push(gas);
    }
  });

  // ════════ CULATA, EMPAQUETADURA Y TAPA ════════
  const headShape = poly([[-0.072, DECK + 0.0015], [0.072, DECK + 0.0015], [0.072, 0.196], [0.1, 0.199], [0.1, 0.246], [0.07, 0.252], [0.066, HEAD_TOP], [-0.066, HEAD_TOP], [-0.07, 0.252], [-0.1, 0.246], [-0.1, 0.199], [-0.072, 0.196]]);
  P('culata', extrudeX(headShape, B_FRONT - 0.002, B_REAR + 0.002, 0.003), 'alu', { casing: true, double: true });
  P('junta_culata', rbox(0.372, 0.0016, 0.146, 0.0006), 'copper', { p: [-0.1875, DECK + 0.0008, 0], casing: true });
  if (!lite) {
    CYL_X.forEach(cx => {
      P('culata', rbox(0.03, 0.044, 0.006, 0.002), 'alu', { p: [cx + VDX, 0.222, 0.103], casing: true });
      P('culata', rbox(0.026, 0.04, 0.006, 0.002), 'alu', { p: [cx - 0.012, 0.222, -0.103], casing: true });
    });
    MAINS.forEach(([x]) => { for (const s of [1, -1]) P('culata', cylY(0.0075, 0.007, 6), 'chrome', { p: [x, HEAD_TOP + 0.0035, s * 0.056] }); });
  }
  const cvr = P('tapa_valvulas', rbox(0.36, 0.036, 0.134, 0.012), 'alu', { p: [-0.188, HEAD_TOP + 0.018, 0], casing: true, double: true });
  P('tapa_valvulas', cylY(0.017, 0.012, 24), 'dark', { p: [-0.06, HEAD_TOP + 0.042, 0.026] });
  if (!lite) {
    for (const zz of [-0.035, 0, 0.035]) P('tapa_valvulas', rbox(0.3, 0.004, 0.006, 0.002), 'alu', { p: [-0.2, HEAD_TOP + 0.037, zz], casing: true });
    P('tapa_valvulas', cylZ(0.006, 0.02, 12), 'alu', { p: [-0.26, HEAD_TOP + 0.024, 0.073] });
    [-0.03, -0.13, -0.24, -0.34].forEach(x => { for (const s of [1, -1]) P('tapa_valvulas', cylY(0.005, 0.005, 6), 'chrome', { p: [x, HEAD_TOP + 0.038, s * 0.058] }); });
  }

  // ════════ ÁRBOL DE LEVAS ════════
  const camC = carrier('arbol_levas');
  const cam = new THREE.Group(); cam.position.set(0, CAM_Y, 0); camC.add(cam); A.cam = cam;
  const cm = (geo, kind, p, r) => add('arbol_levas', geo, kind, { parent: cam, p, r, ex: null });
  cm(cylX(0.011, 0.445, 16), 'steel', [-0.18, 0, 0]);
  [-0.025, -0.109, -0.187, -0.265, -0.347].forEach(x => cm(cylX(0.0135, 0.012, 20), 'chrome', [x, 0, 0]));
  const lobeG = discX(camShape(0.015, 0.00615), 0.011, 6);
  const D2R = Math.PI / 180;
  CYL_X.forEach((cx, i) => {
    cm(lobeG, 'chrome', [cx + VDX, 0, 0], [-DIR * (110 + FIRE_OFF[i]) / 2 * D2R, 0, 0]);
    cm(lobeG, 'chrome', [cx - VDX, 0, 0], [-DIR * (610 + FIRE_OFF[i]) / 2 * D2R, 0, 0]);
  });
  cm(rbox(0.012, 0.004, 0.016, 0.001), 'steel', [-0.405, 0, 0]);
  cm(cylX(0.0075, 0.024, 12), 'steel', [-0.414, 0, 0]);

  // ════════ VÁLVULAS, RESORTES Y BALANCINES ════════
  if (!lite) {
    const valC = carrier('valvulas');
    const rockC = carrier('balancines');
    for (const s of [1, -1]) add('balancines', cylX(0.0075, 0.37, 14), 'steel', { parent: rockC, p: [-0.19, 0.300, s * 0.026], ex: null });
    CYL_X.forEach((cx, i) => {
      for (const zs of [1, -1]) {
        const xv = cx + zs * VDX, rh = zs > 0 ? 0.0136 : 0.0118;
        // válvula
        const fr = new THREE.Group(); fr.position.set(xv, DECK + 0.0035, zs * 0.0125); fr.rotation.x = zs * VTILT; valC.add(fr);
        const vm = new THREE.Group(); fr.add(vm);
        const vk = (geo, kind, p, g = vm) => add('valvulas', geo, kind, { parent: g, p, ex: null });
        vk(cylY(rh, 0.0022, 24), 'chrome', [0, 0.0011, 0]);
        vk(cylY(rh * 0.62, 0.012, 16, 0.003), 'chrome', [0, 0.0082, 0]);
        vk(cylY(0.0035, VLEN - 0.014, 8), 'chrome', [0, 0.014 + (VLEN - 0.014) / 2, 0]);
        vk(cylY(0.0105, 0.003, 18), 'steel', [0, VLEN - 0.0105, 0]);
        vk(cylY(0.0045, 0.004, 8, 0.0034), 'dark', [0, VLEN - 0.007, 0]);
        vk(cylY(0.0048, 0.03, 10), 'steel', [0, 0.052, 0], fr);
        const sg = helix(0.0092, SPR_H, 6, 0.0015); sg.translate(0, SPR_H / 2, 0);
        const spring = vk(sg, 'steel', [0, VLEN - 0.012 - SPR_H, 0], fr); spring.userData.dyn = true;
        A.valves.push({ vm, spring, i, zs });
        // balancín (pivote en el eje)
        const rg = new THREE.Group(); rg.position.set(xv, 0.300, zs * 0.026); rockC.add(rg);
        const rk = (geo, kind, p, r) => add('balancines', geo, kind, { parent: rg, p, r, ex: null });
        rk(cylX(0.0095, 0.012, 16), 'steel', [0, 0, 0]);
        const arm = (dy, dz, w) => { const len = Math.hypot(dy, dz); rk(rbox(0.009, len, w, 0.002), 'steel', [0, dy / 2, dz / 2], [Math.atan2(dz, dy), 0, 0]); };
        arm(-0.0105, -zs * 0.022, 0.007);
        rk(rbox(0.010, 0.004, 0.008, 0.0015), 'chrome', [0, -0.0085, -zs * 0.022]);
        arm(-0.006, zs * 0.024, 0.0075);
        const sc = rk(cylY(0.0028, 0.016, 8), 'chrome', [0, -0.0015, zs * 0.0258]); sc.rotation.x = zs * VTILT;
        const nut = rk(cylY(0.0055, 0.0035, 6), 'dark', [0, 0.004, zs * 0.0275]); nut.rotation.x = zs * VTILT;
        A.rockers.push({ rg, i, zs });
      }
    });
  }

  // ════════ DISTRIBUCIÓN (correa dentada) ════════
  const distC = carrier('distribucion');
  const crankSp = new THREE.Group(); crankSp.position.set(XB, 0, 0); distC.add(crankSp); A.spin.push({ g: crankSp, k: 1 });
  const camSp = new THREE.Group(); camSp.position.set(XB, CAM_Y, 0); distC.add(camSp); A.spin.push({ g: camSp, k: 0.5 });
  add('distribucion', lite ? cylX(0.029, 0.021, 24) : discX(gearShape(0.029, 20, 0.0028, 0.012), 0.021), 'steel', { parent: crankSp, ex: null });
  add('distribucion', lite ? cylX(0.058, 0.021, 32) : discX(gearShape(0.058, 40, 0.0028, 0.013), 0.021), 'alu', { parent: camSp, ex: null });
  if (!lite) {
    add('distribucion', cylX(0.04, 0.022, 28), 'alu', { parent: camSp, ex: null, p: [0.0005, 0, 0] });
    add('distribucion', cylX(0.0075, 0.03, 12), 'chrome', { parent: camSp, ex: null, p: [0.004, 0, 0] });
  }
  // marca del piñón: arriba cuando el cilindro 1 está en PMS de compresión
  add('distribucion', rbox(0.024, 0.008, 0.006, 0.002), 'red', { parent: camSp, ex: null, p: [0.001, Math.cos(-DIR * Math.PI) * 0.05, Math.sin(-DIR * Math.PI) * 0.05] });
  add('distribucion', rbox(0.006, 0.008, 0.008, 0.002), 'white', { parent: distC, ex: null, p: [0.004, CAM_Y + 0.066, 0] });
  const belt = hullBelt([{ y: 0, z: 0, r: 0.0295 }, { y: CAM_Y, z: 0, r: 0.0585 }]);
  add('distribucion', bandGeo(belt, XB, 0.019, 0.0035), 'rubber', { parent: distC, ex: null, double: true });
  if (!lite) {
    const N = 88, tg = new THREE.BoxGeometry(0.019, 0.0026, 0.0048);
    const mat = ctx.makeMat('distribucion', 'rubber');
    const inst = new THREE.InstancedMesh(tg, mat, N); inst.position.set(0, 0, 0);
    ctx.regMesh(inst, 'distribucion', distC);
    A.teeth = { inst, N, belt, r: 0.0295 };
  }
  // tensor sobre el lado flojo
  const tens = group('tensor', parent, [0, 0, 0], ex('tensor'));
  const tz = 0.0295 + (0.12 / CAM_Y) * 0.029 + 0.0035 + 0.0158;
  add('tensor', cylX(0.0158, 0.02, 24), 'chrome', { parent: tens, p: [XB, 0.12, tz], ex: null });
  if (!lite) {
    add('tensor', rbox(0.006, 0.07, 0.022, 0.003), 'steel', { parent: tens, p: [XB - 0.014, 0.135, tz], ex: null });
    const sp = helix(0.004, 0.035, 7, 0.0009); add('tensor', sp, 'steel', { parent: tens, p: [XB - 0.016, 0.175, tz + 0.006], ex: null });
  }
  // tapa de distribución (plástico translúcido)
  const cHull = hullBelt([{ y: 0, z: 0, r: 0.043 }, { y: CAM_Y, z: 0, r: 0.072 }], 120);
  const coverShape = new THREE.Shape(cHull.S.map(([y, z]) => new THREE.Vector2(z, y)));
  P('distribucion', extrudeX(coverShape, 0.043, 0.004, 0.002, 6), 'plastic', { op: 0.3, casing: true, double: true, ex: ex('tapa_dist') });

  // ════════ CORREA EN V, BOMBA DE AGUA, VENTILADOR, ALTERNADOR ════════
  const accC = carrier('correa_acc');
  const pul = new THREE.Group(); pul.position.set(XP, 0, 0); accC.add(pul); A.spin.push({ g: pul, k: 1 });
  add('correa_acc', cylX(0.058, 0.018, 36), 'steel', { parent: pul, ex: null });
  add('correa_acc', cylX(0.05, 0.02, 32), 'dark', { parent: pul, ex: null });
  add('correa_acc', cylX(0.013, 0.024, 6), 'chrome', { parent: pul, ex: null, p: [0.004, 0, 0] });
  add('correa_acc', rbox(0.02, 0.006, 0.004, 0.001), 'white', { parent: pul, ex: null, p: [0, 0.056, 0] });
  const ALT = [0.095, 0.155];
  const vbelt = hullBelt([{ y: 0, z: 0, r: 0.052 }, { y: 0.115, z: 0, r: 0.045 }, { y: ALT[0], z: ALT[1], r: 0.026 }]);
  add('correa_acc', bandGeo(vbelt, XP, 0.011, 0.007), 'rubber', { parent: accC, ex: null, double: true });

  P('bomba_agua', cylX(0.037, 0.012, 28), 'alu', { p: [0.006, 0.115, 0] });
  P('bomba_agua', tube([[0.004, 0.09, -0.03], [0.012, 0.075, -0.07], [0.03, 0.065, -0.095]], 0.012), 'alu', {});
  const wp = group('bomba_agua', parent, [XP, 0.115, 0], ex('bomba_agua')); const wpS = new THREE.Group(); wp.add(wpS); A.spin.push({ g: wpS, k: 0.058 / 0.05 });
  add('bomba_agua', cylX(0.05, 0.016, 32), 'steel', { parent: wpS, ex: null });
  add('bomba_agua', cylX(0.043, 0.018, 28), 'dark', { parent: wpS, ex: null });
  add('bomba_agua', cylX(0.008, 0.06, 10), 'steel', { parent: wpS, ex: null, p: [-0.03, 0, 0] });
  const fanG = group('ventilador', parent, [XP + 0.024, 0.115, 0], ex('ventilador')); const fanS = new THREE.Group(); fanG.add(fanS); A.spin.push({ g: fanS, k: 0.058 / 0.05 }); A.fan = fanS;
  add('ventilador', cylX(0.028, 0.02, 20), 'plastic', { parent: fanS, ex: null });
  for (let b = 0; b < 5; b++) { const a = b / 5 * Math.PI * 2; add('ventilador', rbox(0.006, 0.115, 0.05, 0.006), 'ceramic', { parent: fanS, ex: null, p: [0, Math.cos(a) * 0.085, Math.sin(a) * 0.085], r: [a, 0.35, 0] }); }

  const altC = carrier('alternador');
  add('alternador', cylX(0.054, 0.095, 28), 'alu', { parent: altC, p: [0, ALT[0], ALT[1]], ex: null });
  const altP = new THREE.Group(); altP.position.set(XP, ALT[0], ALT[1]); altC.add(altP); A.spin.push({ g: altP, k: 0.058 / 0.03 });
  add('alternador', cylX(0.03, 0.014, 22), 'steel', { parent: altP, ex: null });
  if (!lite) {
    add('alternador', cylX(0.046, 0.006, 24), 'dark', { parent: altP, ex: null, p: [-0.013, 0, 0] });
    for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2; add('alternador', rbox(0.07, 0.006, 0.004, 0.001), 'dark', { parent: altC, ex: null, p: [0.0, ALT[0] + Math.cos(a) * 0.054, ALT[1] + Math.sin(a) * 0.054], r: [a, 0, 0] }); }
    add('alternador', cylX(0.05, 0.02, 24), 'dark', { parent: altC, ex: null, p: [-0.057, ALT[0], ALT[1]] });
    add('alternador', cylX(0.005, 0.016, 8), 'copper', { parent: altC, ex: null, p: [-0.074, ALT[0] + 0.02, ALT[1] + 0.01] });
    add('alternador', rbox(0.03, 0.05, 0.016, 0.004), 'alu', { parent: altC, ex: null, p: [-0.02, ALT[0] - 0.045, 0.095] });
    add('alternador', rbox(0.008, 0.07, 0.01, 0.002), 'steel', { parent: altC, ex: null, p: [0.03, ALT[0] + 0.05, 0.11], r: [0.7, 0, 0] });
  }

  // ════════ VOLANTE Y MOTOR DE PARTIDA ════════
  const flyC = carrier('volante');
  const fly = new THREE.Group(); fly.position.set(-0.394, 0, 0); flyC.add(fly); A.spin.push({ g: fly, k: 1 });
  add('volante', cylX(0.127, 0.018, 48), 'steel', { parent: fly, ex: null });
  add('volante', lite ? cylX(0.135, 0.011, 48) : discX(gearShape(0.135, 110, 0.0035, 0.122), 0.011), 'iron', { parent: fly, ex: null, p: [0.003, 0, 0] });
  if (!lite) {
    for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2; add('volante', cylX(0.005, 0.006, 6), 'chrome', { parent: fly, ex: null, p: [-0.011, Math.cos(a) * 0.036, Math.sin(a) * 0.036] }); }
    for (let k = 0; k < 3; k++) { const a = (k - 1) * 0.06; add('volante', rbox(0.004, 0.012, 0.0025, 0.0005), 'white', { parent: fly, ex: null, p: [-0.0095, Math.cos(a) * 0.118, Math.sin(a) * 0.118], r: [a, 0, 0] }); }
  }
  const stC = carrier('partida');
  add('partida', cylX(0.04, 0.12, 24), 'dark', { parent: stC, p: [-0.465, -0.06, 0.134], ex: null });
  add('partida', cylX(0.022, 0.08, 18), 'dark', { parent: stC, p: [-0.455, -0.012, 0.162], ex: null });
  add('partida', cylX(0.012, 0.02, 14), 'steel', { parent: stC, p: [-0.398, -0.06, 0.134], ex: null });
  if (!lite) {
    add('partida', rbox(0.016, 0.06, 0.04, 0.004), 'alu', { parent: stC, p: [-0.39, -0.04, 0.105], ex: null });
    add('partida', cylX(0.004, 0.014, 8), 'copper', { parent: stC, p: [-0.5, -0.002, 0.18], ex: null });
  }

  // ════════ LUBRICACIÓN ════════
  const opC = carrier('bomba_aceite');
  add('bomba_aceite', rbox(0.012, 0.085, 0.11, 0.012), 'alu', { parent: opC, p: [0.006, -0.008, 0], ex: null, casing: true, double: true });
  if (!lite) {
    const rIn = new THREE.Group(); rIn.position.set(0.006, 0, 0); opC.add(rIn); A.spin.push({ g: rIn, k: 1 });
    add('bomba_aceite', discX(gearShape(0.021, 4, 0.006, 0.016), 0.009, 6), 'chrome', { parent: rIn, ex: null });
    const rOut = new THREE.Group(); rOut.position.set(0.006, -0.004, 0); opC.add(rOut); A.spin.push({ g: rOut, k: 0.8 });
    add('bomba_aceite', discX(gearShape(0.033, 5, 0.006, 0.026), 0.009, 6), 'steel', { parent: rOut, ex: null });
    add('bomba_aceite', cylY(0.008, 0.024, 12), 'alu', { parent: opC, p: [0.006, -0.046, 0.036], ex: null });
  }
  // Cárter propio del Carry (corte transversal del manual): asimétrico, con el fondo horizontal cuando el motor va inclinado.
  // Puntos en [derecha, arriba] del furgón, relativos al cigüeñal → marco del motor.
  const PAN_W = [[0.112, 0.0], [0.124, -0.05], [0.127, -0.096], [0.124, -0.109], [0.116, -0.117], [0.104, -0.121], [0.088, -0.122], [-0.012, -0.122], [-0.025, -0.118], [-0.031, -0.108]];
  const panPts = [[0.091, -0.035], ...PAN_W.map(w2e), [-0.091, -0.035]];
  P('carter', extrudeX(poly(panPts), B_FRONT - 0.003, B_REAR + 0.003, 0.003), 'steel', { casing: true, double: true });
  P('carter', rbox(0.38, 0.006, 0.192, 0.002), 'steel', { p: [-0.1875, -0.037, 0], casing: true });
  { const [dz, dy] = w2e([0.03, -0.126]); orientY(P('carter', cylY(0.008, 0.008, 6), 'chrome', { p: [-0.33, dy, dz] }), UP.toArray()); } // tapón de vaciado
  // aceite: su superficie queda horizontal (cambia según el motor esté inclinado o derecho)
  const panC = panPts.reduce((a, q) => [a[0] + q[0] / panPts.length, a[1] + q[1] / panPts.length], [0, 0]);
  const panIn = panPts.map(([z, y]) => [z + (panC[0] - z) * 0.06, y + (panC[1] - y) * 0.06]);
  const clipBelow = (pl, f, lvl) => { const o = []; for (let i = 0; i < pl.length; i++) { const a = pl[i], b = pl[(i + 1) % pl.length], fa = f(a) - lvl, fb = f(b) - lvl; if (fa <= 0) o.push(a); if ((fa < 0) !== (fb < 0) && fa !== fb) { const t = fa / (fa - fb); o.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]); } } return o; };
  const areaOf = pl => { let a = 0; for (let i = 0; i < pl.length; i++) { const p0 = pl[i], p1 = pl[(i + 1) % pl.length]; a += p0[0] * p1[1] - p1[0] * p0[1]; } return Math.abs(a) / 2; };
  const hTilt = ([z, y]) => y * Math.cos(TILT) - z * Math.sin(TILT), hUp = ([, y]) => y;
  const oilTilt = clipBelow(panIn, hTilt, -0.072), oilA = areaOf(oilTilt);
  let lo = -0.17, hi = -0.03; for (let k = 0; k < 32; k++) { const m = (lo + hi) / 2; if (areaOf(clipBelow(panIn, hUp, m)) < oilA) lo = m; else hi = m; }
  const oilUp = clipBelow(panIn, hUp, (lo + hi) / 2);
  const oilGeo = pl => extrudeX(poly(pl), B_FRONT - 0.009, B_REAR + 0.009, 0, 4);
  const oilMesh = lite ? null : P('carter', oilGeo(oilTilt), 'oil', { op: 0.62 }); // el motor va montado: aceite a nivel del furgón
  if (oilMesh) oilMesh.userData.dyn = true;
  // chupador: de la bomba (adelante) al punto más bajo del cárter inclinado; colador horizontal
  { const [sz, sy] = w2e([0.057, -0.108]), sp = V(-0.1, sy, sz), top = sp.clone().addScaledVector(UP, 0.012);
    P('chupador', tube([[0.003, -0.05, 0.03], [-0.035, -0.085, 0.012], [-0.078, top.y + 0.004, top.z + 0.012], top.toArray()], 0.0065), 'steel', {});
    orientY(P('chupador', cylY(0.026, 0.008, 24), 'steel', { p: sp.toArray() }), UP.toArray());
    if (!lite) orientY(P('chupador', cylY(0.0235, 0.0012, 24), 'dark', { p: sp.clone().addScaledVector(UP, -0.0045).toArray() }), UP.toArray()); }
  // filtro de aceite: soporte en el costado del block que queda hacia abajo (lado escape); el filtro cuelga vertical
  { const M = V(-0.10, 0.032, -0.112), dn = UP.clone().negate();
    P('filtro_aceite', rbox(0.04, 0.036, 0.03, 0.006), 'alu', { p: [-0.10, 0.04, -0.097] });
    orientY(P('filtro_aceite', cylY(0.024, 0.026, 20), 'alu', { p: M.clone().addScaledVector(dn, -0.002).toArray() }), UP.toArray());
    orientY(P('filtro_aceite', cylY(0.036, 0.072, 28), 'blue', { p: M.clone().addScaledVector(dn, 0.012 + 0.036).toArray() }), UP.toArray());
    if (!lite) for (let k = 0; k < 5; k++) orientY(P('filtro_aceite', cylY(0.0367, 0.002, 28), 'blue', { p: M.clone().addScaledVector(dn, 0.024 + k * 0.012).toArray() }), UP.toArray()); }
  P('varilla', tube([[-0.29, 0.0, 0.086], [-0.29, 0.0 + UP.y * 0.16, 0.086 + UP.z * 0.16], [-0.29, 0.0 + UP.y * 0.3, 0.086 + UP.z * 0.3]], 0.004), 'steel', {});
  { const hd = P('varilla', new THREE.TorusGeometry(0.012, 0.0035, 8, 20), 'amber', { p: [-0.29, UP.y * 0.315, 0.086 + UP.z * 0.315] }); hd.rotation.y = Math.PI / 2; }

  // ════════ ADMISIÓN, TERMOSTATO Y CARBURADOR ════════
  const XPL = -0.19, PLEN = V(XPL, 0.285, 0.195);
  CYL_X.forEach(cx => {
    const xv = cx + VDX;
    P('mult_adm', tube([[xv, 0.222, 0.098], [xv, 0.236, 0.134], [xv + (XPL - xv) * 0.55, 0.262, 0.174], [XPL + (xv - XPL) * 0.25, 0.282, 0.19]], 0.0125), 'alu', {});
  });
  P('mult_adm', rbox(0.15, 0.032, 0.05, 0.012), 'alu', { p: PLEN.toArray(), r: [-TILT, 0, 0] });
  orientY(P('mult_adm', cylY(0.02, 0.05, 20), 'alu', { p: PLEN.clone().addScaledVector(WZ, 0.03).toArray() }), WZ.toArray());
  orientY(P('mult_adm', cylY(0.031, 0.006, 24), 'alu', { p: PLEN.clone().addScaledVector(WZ, 0.052).toArray() }), WZ.toArray());
  P('mult_adm', tube([[-0.02, 0.24, 0.13], [-0.18, 0.238, 0.142], [-0.33, 0.236, 0.138], [-0.355, 0.236, 0.13]], 0.007), 'alu', {});
  // termostato en el frente del lado admisión
  P('termostato', cylZ(0.024, 0.04, 24), 'alu', { p: [-0.018, 0.25, 0.122], casing: true, double: true });
  P('termostato', cylX(0.013, 0.04, 16), 'alu', { p: [0.006, 0.255, 0.13] });
  P('termostato', cylZ(0.018, 0.004, 20), 'copper', { p: [-0.018, 0.25, 0.118] });
  // sensores del motor
  const at = id => V(...PARTS[id].sensor.at.eng);
  { // bulbo de presión de aceite: en el block, junto al soporte del filtro (costado que queda hacia abajo)
    const a = at('s_aceite'), d = V(0, -0.18, -0.984).normalize(), b = a.clone().addScaledVector(d, -0.012);
    orientY(P('s_aceite', cylY(0.0105, 0.008, 6), 'brass', { p: b.toArray() }), d.toArray());
    orientY(P('s_aceite', cylY(0.0075, 0.014, 16), 'steel', { p: b.clone().addScaledVector(d, 0.011).toArray() }), d.toArray());
    orientY(P('s_aceite', cylY(0.004, 0.012, 10), 'rubber', { p: b.clone().addScaledVector(d, 0.024).toArray() }), d.toArray());
  }
  { // bulbo de temperatura (caja del termostato)
    const a = at('s_temp');
    P('s_temp', cylY(0.009, 0.006, 6), 'brass', { p: [a.x, 0.278, a.z] });
    P('s_temp', cylY(0.0062, 0.01, 14), 'brass', { p: [a.x, 0.286, a.z] });
    P('s_temp', rbox(0.0025, 0.007, 0.006, 0.001), 'steel', { p: [a.x, a.y - 0.001, a.z] });
  }
  { // interruptor térmico (sistema catalítico original)
    const a = at('s_termo'), d = [0, 0.6, 0.8];
    const b = a.clone().addScaledVector(V(...d), -0.018);
    orientY(P('s_termo', cylY(0.0085, 0.006, 6), 'brass', { p: b.toArray() }), d);
    orientY(P('s_termo', cylY(0.006, 0.012, 14), 'dark', { p: b.clone().addScaledVector(V(...d), 0.01).toArray() }), d);
    P('mult_adm', cylY(0.011, 0.012, 16), 'alu', { p: b.clone().addScaledVector(V(...d), -0.004).toArray(), r: [0.927, 0, 0] });
  }

  // Carburador Mikuni de un cuerpo y tiro horizontal (manual, secc. 4 y 21): el aire entra de costado desde el filtro, que va encima
  const carbG = group('carburador', parent, PLEN.clone().addScaledVector(WZ, 0.058).toArray(), ex('carburador'));
  carbG.rotation.x = -TILT; // ejes del grupo = ejes del furgón; el venturi apunta a la derecha (+z)
  const cb = (geo, kind, p, o = {}) => add('carburador', geo, kind, { parent: carbG, p, ex: null, ...o });
  cb(rbox(0.062, 0.062, 0.008, 0.003), 'dark', [0, 0, 0.004]);
  cb(rbox(0.056, 0.05, 0.064, 0.008), 'alu', [0, 0.002, 0.04]);
  cb(cylZ(0.0175, 0.003, 24), 'dark', [0, 0.002, 0.0735]);
  cb(rbox(0.052, 0.036, 0.05, 0.006), 'alu', [0, -0.04, 0.044]);
  cb(cylX(0.0035, 0.072, 10), 'chrome', [0, 0.002, 0.017]);
  cb(rbox(0.004, 0.034, 0.012, 0.0015), 'steel', [0.037, 0.014, 0.017], { r: [0.45, 0, 0] });
  cb(cylX(0.009, 0.026, 12), 'dark', [-0.037, -0.046, 0.04]);
  cb(cylX(0.0035, 0.016, 8), 'chrome', [0.033, -0.036, 0.03]);
  if (!lite) {
    cb(rbox(0.054, 0.004, 0.052, 0.001), 'steel', [0, -0.0215, 0.044]);
    cb(cylX(0.014, 0.008, 18), 'alu', [-0.032, -0.008, 0.052]);
    cb(cylX(0.012, 0.012, 16), 'dark', [0.034, 0.02, 0.06]);
    cb(cylX(0.003, 0.012, 8), 'chrome', [0.033, -0.036, 0.056]);
    cb(cylY(0.0025, 0.012, 8), 'chrome', [0.012, 0.032, 0.022]);
  }
  cb(tube([[0, 0.002, 0.066], [0, 0.002, 0.094]], 0.024), 'plastic');                    // boca del carburador
  // filtro de aire de este furgón (foto bajo el asiento del copiloto): cilindro negro horizontal con abrazadera,
  // montado de costado en la boca del carburador y apuntando hacia el lado derecho
  const afG = group('filtro_aire', carbG, [0, 0.004, 0], [0, 0.05 * exk, 0.2 * exk]);
  add('filtro_aire', new THREE.CylinderGeometry(0.082, 0.027, 0.03, 36, 1, false).rotateX(Math.PI / 2), 'plastic', { parent: afG, p: [0, 0, 0.108], ex: null, casing: true });  // cuello cónico
  add('filtro_aire', cylZ(0.082, 0.20, 44), 'plastic', { parent: afG, p: [0, 0, 0.223], ex: null, double: true, casing: true });                                     // cuerpo
  add('filtro_aire', cylZ(0.0845, 0.016, 44), 'steel', { parent: afG, p: [0, 0, 0.300], ex: null });                                                            // abrazadera
  add('filtro_aire', rbox(0.03, 0.022, 0.026, 0.004), 'steel', { parent: afG, p: [0, 0.086, 0.300], ex: null });                                                // tensor de la abrazadera
  add('filtro_aire', cylZ(0.084, 0.012, 44), 'plastic', { parent: afG, p: [0, 0, 0.326], ex: null, casing: true });                                             // tapa
  if (!lite) add('filtro_aire', new THREE.CylinderGeometry(0.068, 0.068, 0.17, 32, 1, true).rotateX(Math.PI / 2), 'amber', { parent: afG, p: [0, 0, 0.223], ex: null, double: true });  // elemento seco
  add('filtro_aire', cylZ(0.011, 0.012, 6), 'chrome', { parent: afG, p: [0, 0, 0.334], ex: null });

  // ════════ ESCAPE: doble puerto (manual): un conducto para los cilindros 1 y 4, otro para el 2 y 3 ════════
  const XA = -0.168, ZA = -0.183, XB2 = -0.212, ZB = -0.158;
  CYL_X.forEach((cx, i) => {
    const xe = cx - 0.012, outer = i === 0 || i === 3, X = outer ? XA : XB2, Z = outer ? ZA : ZB;
    P('mult_esc', tube([[xe, 0.222, -0.098], [xe, 0.206, outer ? -0.14 : -0.128], [xe + (X - xe) * 0.55, outer ? 0.158 : 0.172, outer ? -0.18 : -0.15], [X + (xe - X) * 0.14, 0.128, Z], [X, 0.108, Z]], 0.0125), 'iron', { side: 'ex' });
  });
  for (const [X, Z] of [[XA, ZA], [XB2, ZB]]) P('mult_esc', cylY(0.019, 0.034, 20), 'iron', { p: [X, 0.1, Z], side: 'ex' });
  P('mult_esc', rbox(0.095, 0.008, 0.07, 0.003), 'iron', { p: [(XA + XB2) / 2, 0.082, (ZA + ZB) / 2], side: 'ex' });
  P('mult_esc', rbox(0.31, 0.105, 0.004, 0.002), 'steel', { p: [-0.19, 0.19, -0.172], r: [0.728, 0, 0], op: 0.55, side: 'ex', casing: true }); // cubierta del múltiple
  { // sensor de oxígeno (versión catalítica) en la salida 1-4
    const a = at('sonda'), d = [0, -0.3, -0.954];
    const b = a.clone().addScaledVector(V(...d), -0.016);
    orientY(P('sonda', cylY(0.0095, 0.008, 6), 'chrome', { p: b.toArray(), side: 'ex' }), d);
    orientY(P('sonda', cylY(0.0065, 0.022, 12), 'steel', { p: b.clone().addScaledVector(V(...d), 0.014).toArray(), side: 'ex' }), d);
  }

  // ════════ ENCENDIDO: CAJA DE ENGRANAJES, DISTRIBUIDOR, BUJÍAS Y CABLES ════════
  const dQ = new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), DAX);
  const onAxis = (g) => { g.position.copy(DOR); g.quaternion.copy(dQ); return g; };
  const dPt = (lx, ly, lz) => DOR.clone().add(V(lx, ly, lz).applyQuaternion(dQ)); // local del distribuidor → motor
  // caja de engranajes en el extremo trasero de la culata (con aceite de motor adentro)
  const gcC = carrier('caja_dist');
  add('caja_dist', rbox(0.006, 0.072, 0.084, 0.003), 'alu', { parent: gcC, p: [-0.3765, CAM_Y + 0.008, 0.004], ex: null });
  add('caja_dist', rbox(0.05, 0.06, 0.064, 0.012), 'alu', { parent: gcC, p: [-0.403, CAM_Y + 0.008, 0.006], ex: null, casing: true, double: true });
  { const g = onAxis(new THREE.Group()); gcC.add(g);
    add('caja_dist', cylY(0.021, 0.046, 24), 'alu', { parent: g, p: [0, 0.023, 0], ex: null, casing: true, double: true });
    add('caja_dist', cylY(0.026, 0.005, 24), 'alu', { parent: g, p: [0, 0.0435, 0], ex: null }); }
  if (!lite) for (const [yy, zz] of [[0.03, -0.034], [0.03, 0.044], [-0.016, 0.006]]) add('caja_dist', cylX(0.0045, 0.006, 6), 'chrome', { parent: gcC, p: [-0.373, CAM_Y + yy, zz], ex: null });
  // engranaje helicoidal en la punta del árbol de levas (gira con el árbol)
  add('caja_dist', lite ? cylX(0.0105, 0.012, 16) : discX(gearShape(0.0105, 13, 0.0022), 0.012, 4), 'steel', { parent: cam, p: [XG, 0, 0], ex: null });

  const dsC = carrier('distribuidor');
  const dg = onAxis(new THREE.Group()); dsC.add(dg);
  const dk = (geo, kind, p, o = {}) => add('distribuidor', geo, kind, { parent: dg, p, ex: null, ...o });
  dk(cylY(0.0275, 0.054, 28), 'alu', [0, 0.072, 0], { casing: true, double: true });       // carcasa
  dk(cylY(0.031, 0.006, 28), 'alu', [0, 0.048, 0]);                                         // brida
  dk(rbox(0.016, 0.006, 0.022, 0.002), 'alu', [0.034, 0.048, 0]);                            // oreja del perno de fijación
  dk(cylY(0.0405, 0.03, 32), 'plastic', [0, 0.112, 0], { casing: true, double: true });      // tapa
  dk(cylY(0.036, 0.008, 32), 'plastic', [0, 0.131, 0]);
  dk(cylY(0.0075, 0.016, 12), 'plastic', [0, 0.142, 0]);                                     // borne central (a la bobina)
  TOWER_A.forEach(a => dk(cylY(0.0062, 0.016, 10), 'plastic', [Math.cos(a * Math.PI / 180) * 0.024, 0.141, Math.sin(a * Math.PI / 180) * 0.024]));
  dk(cylX(0.017, 0.018, 18), 'dark', [-0.044, 0.074, 0]);                                    // cápsula de avance por vacío
  dk(cylX(0.003, 0.014, 8), 'chrome', [-0.06, 0.074, 0]);
  if (!lite) dk(rbox(0.012, 0.004, 0.004, 0.001), 'steel', [-0.03, 0.074, 0]);
  const dShaft = new THREE.Group(); dg.add(dShaft); A.dShaft = dShaft;                       // eje: engranaje, rotor
  const ds = (geo, kind, p) => add('distribuidor', geo, kind, { parent: dShaft, p, ex: null });
  ds(lite ? cylY(0.0105, 0.012, 16) : (() => { const g = new THREE.ExtrudeGeometry(gearShape(0.0105, 13, 0.0022), { depth: 0.012, bevelEnabled: false, curveSegments: 4 }); g.rotateX(-Math.PI / 2); g.translate(0, -0.006, 0); return g; })(), 'steel', [0, 0, 0]);
  ds(cylY(0.0048, 0.1, 10), 'steel', [0, 0.05, 0]);
  ds(rbox(0.026, 0.006, 0.008, 0.002), 'dark', [0.011, 0.108, 0]);
  ds(rbox(0.006, 0.008, 0.009, 0.001), 'copper', [0.023, 0.111, 0]);
  // generador de señal (sensor): rotor de 4 puntas en el eje + bobina captadora
  const relC = group('s_senal', parent, [0, 0, 0], ex('s_senal'));
  const relD = onAxis(new THREE.Group()); relC.add(relD);
  const rel = new THREE.Group(); rel.position.set(0, 0.084, 0); relD.add(rel); A.reluctor = rel;
  add('s_senal', (() => { const g = new THREE.ExtrudeGeometry(gearShape(0.0115, 4, 0.0045), { depth: 0.006, bevelEnabled: false, curveSegments: 4 }); g.rotateX(-Math.PI / 2); g.translate(0, -0.003, 0); return g; })(), 'steel', { parent: rel, ex: null });
  add('s_senal', rbox(0.009, 0.01, 0.009, 0.002), 'copper', { parent: relD, p: [0.0185, 0.084, 0], ex: null });
  { // manguera de vacío: cápsula del distribuidor → toma del carburador
    carbG.updateMatrix(); const port = V(0.012, 0.038, 0.022).applyMatrix4(carbG.matrix), nip = dPt(-0.067, 0.074, 0);
    P('distribuidor', tube([nip.toArray(), [nip.x - 0.012, nip.y + 0.03, nip.z + 0.03], [(nip.x + port.x) / 2, Math.max(nip.y, port.y) + 0.05, (nip.z + port.z) / 2 + 0.03], [port.x, port.y + 0.03, port.z], port.toArray()], 0.003), 'rubber', {});
  }
  const UPL = [0, 0.62, -0.785];
  CYL_X.forEach((cx, i) => {
    const x = cx + 0.014, P0 = V(x, DECK + 0.004, -0.024), u = V(...UPL);
    const pg = group('bujias', parent, P0.toArray(), ex('bujias'));
    pg.quaternion.setFromUnitVectors(V(0, 1, 0), u);
    const bk = (geo, kind, p, o = {}) => add('bujias', geo, kind, { parent: pg, p, ex: null, ...o });
    bk(cylY(0.0055, 0.09, 10), 'steel', [0, 0.046, 0]);
    bk(cylY(0.0095, 0.009, 6), 'chrome', [0, 0.1, 0], { side: 'ex' });
    bk(cylY(0.0055, 0.03, 12), 'ceramic', [0, 0.12, 0], { side: 'ex' });
    bk(cylY(0.0085, 0.028, 12), 'lead', [0, 0.148, 0], { side: 'ex' });
    const sp = new THREE.Mesh(new THREE.SphereGeometry(lite ? 0.024 : 0.011, 12, 10), new THREE.MeshBasicMaterial({ color: '#ffd36a', transparent: true, opacity: 0, depthWrite: false }));
    ctx.clipAll && ctx.clipAll(sp.material);
    sp.position.set(0, -0.001, 0); sp.visible = false; pg.add(sp); A.sparks.push(sp);
    // cable de alta tensión desde su borne de la tapa (orden 1-3-4-2), por encima de la tapa de válvulas
    const ta = TOWER_A[i] * Math.PI / 180, T = dPt(Math.cos(ta) * 0.024, 0.149, Math.sin(ta) * 0.024), T1 = T.clone().addScaledVector(DAX, 0.028);
    const end = P0.clone().addScaledVector(u, 0.162), B = end.clone().addScaledVector(u, 0.028), k = i * 0.0065;
    P('bujias', tube([T.toArray(), T1.toArray(), [T1.x + 0.004, 0.292 + k, 0.158], [-0.392 + k, 0.358 + k, 0.08], [-0.37 + k, 0.369 + k, 0.03], [x + 0.012, 0.366 + k * 0.5, 0.012], [x + 0.004, 0.352, -0.05], [x, 0.33, -0.1], B.toArray(), end.toArray()], 0.0038), 'lead', { side: 'ex' });
  });

  // ════════ ANIMACIÓN ════════
  const tmp = new THREE.Matrix4(), xA = V(1, 0, 0), yA = V(0, 0, 0), zA = V(0, 0, 0);
  const bump = (phi, a, b) => { const t = (((phi - a) % 720) + 720) % 720, w = b - a; return t < w ? Math.sin(Math.PI * t / w) ** 1.5 : 0; };
  const col = new THREE.Color();
  function update(theta) {
    const deg = theta * 180 / Math.PI;
    A.crank.rotation.x = DIR * theta;
    A.cam.rotation.x = DIR * theta / 2;
    A.spin.forEach(s => { s.g.rotation.x = DIR * theta * s.k; });
    const beta = -(ROTOR_A0 + deg / 2) * Math.PI / 180;
    if (A.dShaft) A.dShaft.rotation.y = beta;
    if (A.reluctor) A.reluctor.rotation.y = beta;
    for (const P of A.pistons) {
      const psi = P.ph + DIR * theta;
      const py = R * Math.cos(psi), pz = R * Math.sin(psi);
      const ys = py + Math.sqrt(L * L - pz * pz);
      P.g.position.set(P.cx, ys, 0);
      const rod = A.rods[P.i]; rod.g.position.set(P.cx, py, pz); rod.g.rotation.x = Math.atan2(-pz, ys - py);
      const gas = A.gas[P.i];
      if (gas) {
        const phi = cyclePhi(deg, P.i), crown = ys + CH, h = Math.max(0.002, DECK + 0.002 - crown);
        gas.scale.y = h; gas.position.y = crown + h / 2;
        const ph = phaseOf(phi), ign = phi >= 350 && phi < 430 ? 1 - (phi - 350) / 80 : 0;
        col.set(PHASES[ph].color); if (ign > 0) col.lerp(new THREE.Color('#fff1a0'), ign * 0.8);
        gas.material.color.copy(col); gas.material.opacity = 0.32 + ign * 0.4;
      }
    }
    for (const v of A.valves) {
      const phi = cyclePhi(deg, v.i);
      const k = v.zs > 0 ? bump(phi, -10, 230) : bump(phi, 490, 730);
      const s = 0.0066 * k;
      v.vm.position.y = -s; v.spring.scale.y = (SPR_H - s) / SPR_H;
      const rk = A.rockers.find(r => r.i === v.i && r.zs === v.zs); if (rk) rk.rg.rotation.x = v.zs * (0.006 * k) / 0.022;
    }
    A.sparks.forEach((s, i) => {
      const d = cyclePhi(deg, i) - 352; const on = d > 0 && d < 40 ? 1 - d / 40 : 0;
      s.material.opacity = on * 0.95; s.scale.setScalar(0.6 + on * 1.1);
    });
    if (A.teeth) {
      const { inst, N, belt, r } = A.teeth, pitch = belt.len / N;
      for (let i = 0; i < N; i++) {
        const f = belt.frame(i * pitch + DIR * r * theta);
        yA.set(0, f.o[0], f.o[1]); zA.set(0, -f.o[1], f.o[0]);
        tmp.makeBasis(xA, yA, zA); tmp.setPosition(XB, f.p[0] - f.o[0] * 0.0012, f.p[1] - f.o[1] * 0.0012);
        inst.setMatrixAt(i, tmp);
      }
      inst.instanceMatrix.needsUpdate = true;
    }
  }

  // puntos de conexión para el furgón (marco del motor)
  carbG.updateMatrix();
  const pts = {
    carbInlet: V(0.041, -0.036, 0.03).applyMatrix4(carbG.matrix), carbReturn: V(0.039, -0.036, 0.056).applyMatrix4(carbG.matrix),
    thermOut: V(0.026, 0.255, 0.13), wpIn: V(0.03, 0.065, -0.095), heaterOut: V(-0.355, 0.236, 0.13),
    collA: V(XA, 0.079, ZA), collB: V(XB2, 0.079, ZB), distCenter: dPt(0, 0.15, 0), distAxis: DAX.clone(),
  };
  function setTilt(on) { if (oilMesh) { oilMesh.geometry.dispose(); oilMesh.geometry = oilGeo(on ? oilTilt : oilUp); } }
  return { update, A, pts, setTilt };
}
