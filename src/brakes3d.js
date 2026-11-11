// Frenos del SK410 en detalle: pedal, servofreno, bomba tándem, depósito remoto, cañerías con junta de 5 vías,
// válvula DSP, discos con caliper flotante, tambores con zapatas autoajustables y freno de mano por cable.
// Cotas de discos, tambores, pastillas, balatas y pistón del caliper: manual. Posición del servo, la bomba,
// la junta de 5 vías y la válvula DSP: aproximada (ver la ficha de cada pieza).
import * as THREE from 'three';
import { WB, RW } from './geom.js';
import { BK, solve, wearState, handbrake } from './brakesim.js';

const TH_CAL = 2.70;          // ángulo del caliper (rad, desde adelante): atrás y un poco arriba del eje
const FZ = 0.578;             // plano del disco delantero (|z|)
const RZ = 0.562;             // plano medio del tambor trasero (|z|)
const GAP_PAD = 0.0015, GAP_SHOE = 0.0045;   // holguras exageradas para que se vea el movimiento
const HOT = new THREE.Color('#e8402f'), HOTE = new THREE.Color('#ff3b1f'), GLOW = new THREE.Color('#ff6a1a');

// Pedal colgante como en las fotos: brazo de platina (ancho en el sentido de la marcha, delgado visto de frente) que baja
// pegado a la columna y abajo se abre hacia afuera; pisadera de goma con cubrepedal de aluminio de 5 botones, inclinada
// hacia el pie. `side`: hacia qué lado queda la pisadera respecto del brazo (+1 derecha: freno; −1 izquierda: embrague).
// Coordenadas desde el eje del pedal.
export const PAD = { c: [-0.068, -0.338], tilt: -0.44, off: 0.034 };      // centro e inclinación de la pisadera (rad) y corrimiento lateral
export function hangingPedal(ctx, part, parent, { ex = null, side = 1 } = {}) {
  const { rbox, tube, cylX, add } = ctx;
  const A = (geo, kind, o = {}) => add(part, geo, kind, { parent, ex, ...o });
  // placa de esquinas redondeadas: ancho en z, alto en y, espesor en x (centrada)
  const plate = (th, h, w, r) => { const sh = new THREE.Shape(), x = w / 2, y = h / 2;
    sh.moveTo(-x + r, -y); sh.lineTo(x - r, -y); sh.absarc(x - r, -y + r, r, -Math.PI / 2, 0, false); sh.lineTo(x, y - r); sh.absarc(x - r, y - r, r, 0, Math.PI / 2, false);
    sh.lineTo(-x + r, y); sh.absarc(-x + r, y - r, r, Math.PI / 2, Math.PI, false); sh.lineTo(-x, -y + r); sh.absarc(-x + r, -y + r, r, Math.PI, Math.PI * 1.5, false);
    const g = new THREE.ExtrudeGeometry(sh, { depth: th, bevelEnabled: false, curveSegments: 6 }); g.translate(0, 0, -th / 2); g.rotateY(Math.PI / 2); return g; };
  const t = PAD.tilt, up = [Math.sin(-t), Math.cos(-t)], fr = [Math.cos(-t), -Math.sin(-t)];   // en el plano de la pisadera y hacia adelante
  const [cx, cy] = PAD.c, zc = side * PAD.off, SQ = 0.25;
  const at = (u, k = 0, z = zc) => [cx + up[0] * u + fr[0] * k, cy + up[1] * u + fr[1] * k, z];
  // platina de 26 × 6,5 mm: un tubo aplastado de lado (las cotas en z van divididas por el aplastamiento)
  const zq = z => z / SQ, e = at(0.02, 0.014, side * 0.012);
  const arm = A(tube([[0, 0.014, 0], [0.006, -0.085, 0], [0.004, -0.185, 0], [-0.012, -0.25, zq(side * 0.002)], [e[0] + 0.012, e[1] + 0.03, zq(side * 0.007)], [e[0], e[1], zq(e[2])]], 0.013, false, 72), 'steel');
  arm.scale.set(1, 1, SQ);
  A(rbox(0.005, 0.046, 0.04, 0.002), 'steel', { p: at(0.012, 0.0105, side * 0.02), r: [0, 0, t] });      // placa soldada tras la pisadera
  A(plate(0.012, 0.074, 0.056, 0.009), 'rubber', { p: at(0, 0.002), r: [0, 0, t] });                       // pisadera de goma original
  A(plate(0.004, 0.086, 0.068, 0.012), 'brushed', { p: at(0, -0.0055), r: [0, 0, t] });                    // cubrepedal de aluminio
  for (const [u, w] of [[0.02, -0.017], [0.02, 0.017], [-0.002, 0], [-0.024, -0.017], [-0.024, 0.017]]) {  // botones antideslizantes
    A(cylX(0.0058, 0.0016, 16), 'steel', { p: at(u, -0.0082, zc + w), r: [0, 0, t] });
    A(cylX(0.0036, 0.0012, 12), 'brushed', { p: at(u, -0.0094, zc + w), r: [0, 0, t] });
  }
  A(rbox(0.0008, 0.005, 0.03, 0.0004), 'steel', { p: at(0.036, -0.0078), r: [0, 0, t] });                 // relieve de la marca (sin logo)
  return arm;
}

export function buildBrakes(ctx, { ELv, E }) {
  const { V, rbox, cylX, cylY, cylZ, tube, helix, add, group } = ctx;
  const root = ctx.world.root;
  ctx.setLevel('brk');
  const A = (part, geo, kind, o = {}) => add(part, geo, kind, { ex: null, ...o });
  const dyn = m => { m.userData.dyn = true; return m; };
  const planes = {};
  const plane = id => (planes[id] ||= new THREE.Plane(V(0, 1, 0), 1e4));
  const cutOn = {};                         // id → [normal, constante] cuando el corte está activo

  // ——— geometrías ———
  const shape = (pts) => { const s = new THREE.Shape(); pts.forEach(([x, y], i) => (i ? s.lineTo(x, y) : s.moveTo(x, y))); return s; };
  function sector(r0, r1, a0, a1, seg = 18) {          // corona circular entre a0 y a1, extruida de z=0 a z=1
    const s = new THREE.Shape(); s.absarc(0, 0, r1, a0, a1, false); s.absarc(0, 0, r0, a1, a0, true); s.closePath();
    return new THREE.ExtrudeGeometry(s, { depth: 1, bevelEnabled: false, curveSegments: seg });
  }
  function ringGeo(rOut, rIn, depth, seg = 48) {       // anillo extruido en z, centrado
    const s = new THREE.Shape(); s.absarc(0, 0, rOut, 0, Math.PI * 2, false);
    const h = new THREE.Path(); h.absarc(0, 0, rIn, 0, Math.PI * 2, true); s.holes.push(h);
    const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false, curveSegments: seg }); g.translate(0, 0, -depth / 2); return g;
  }
  const alongX = g => g.rotateY(Math.PI / 2);            // eje z → x
  const latheX = (pts, seg = 40) => new THREE.LatheGeometry(pts.map(([r, x]) => new THREE.Vector2(r, x)), seg).rotateZ(-Math.PI / 2);  // eje y → x
  const helixX = (r, len, turns, wire) => helix(r, len, turns, wire).rotateZ(-Math.PI / 2).translate(len / 2, 0, 0);   // empieza en x = 0
  const slab = (m, a, b) => { const lo = Math.min(a, b), hi = Math.max(a, b); m.position.z = lo; m.scale.z = Math.max(1e-4, hi - lo); };

  const R = { press: [], rotors: [], disc: [], drum: [], pads: [], cal: [], shoes: [], wc: [], mcP: null, leaks: {}, bubbles: [], boxes: {} };

  // ════════ PEDAL (colgante, a la derecha de la columna; fotos) ════════
  // Al pisarlo empuja la varilla del servofreno (horquilla) y se separa del interruptor de la luz de freno, que cierra el circuito.
  const PZ = -0.235;
  const PX = 0.505, PIV = V(PX, 0.915, PZ);   // las pisaderas quedan cerca de la pared delantera, a la altura de la caja de la calefacción (fotos)
  A('pedal_freno', rbox(0.07, 0.11, 0.004, 0.002), 'steel', { p: [PX + 0.005, 0.90, PZ - 0.024], ex: [0.3, 0.25, 0] });
  A('pedal_freno', rbox(0.07, 0.11, 0.004, 0.002), 'steel', { p: [PX + 0.005, 0.90, PZ + 0.024], ex: [0.3, 0.25, 0] });
  A('pedal_freno', rbox(0.08, 0.006, 0.052, 0.002), 'steel', { p: [PX + 0.01, 0.957, PZ], ex: [0.3, 0.25, 0] });
  A('pedal_freno', cylZ(0.008, 0.06, 12), 'machined', { p: PIV.toArray(), ex: [0.3, 0.25, 0] });
  const pedal = group('pedal_freno', root, PIV.toArray(), [0.3, 0.25, 0]);
  hangingPedal(ctx, 'pedal_freno', pedal, { side: 1 });
  A('pedal_freno', rbox(0.012, 0.016, 0.03, 0.003), 'steel', { parent: pedal, p: [-0.006, -0.075, 0] });          // horquilla
  A('pedal_freno', helix(0.006, 0.06, 7, 0.0012), 'steel', { p: [PX + 0.005, 0.885, PZ + 0.015], r: [0, 0, 0.5], ex: [0.3, 0.25, 0] });  // resorte de retorno
  // interruptor de luz de freno (sensor 7), detrás del brazo: en reposo el brazo le mantiene hundido el vástago
  const sw = group('s_freno', root, [PX - 0.037, 0.868, PZ], [0.3, 0.25, 0]);
  A('s_freno', rbox(0.03, 0.022, 0.024, 0.005), 'dark', { parent: sw, ex: null });
  A('s_freno', cylX(0.009, 0.006, 6), 'steel', { parent: sw, p: [0.017, 0, 0], ex: null });
  A('s_freno', rbox(0.004, 0.034, 0.03, 0.002), 'steel', { parent: sw, p: [0.013, 0.012, 0], ex: null });             // soporte en el puente de los pedales
  A('s_freno', rbox(0.05, 0.004, 0.03, 0.002), 'steel', { parent: sw, p: [0.036, 0.03, 0], ex: null });
  const swPin = dyn(A('s_freno', cylX(0.0035, 0.016, 8), 'chrome', { parent: sw, p: [0.022, 0, 0], ex: null }));
  for (const dz of [-0.007, 0.007]) A('s_freno', rbox(0.012, 0.003, 0.005, 0.001), 'brass', { parent: sw, p: [-0.02, 0, dz], ex: null });   // terminales

  // ════════ SERVOFRENO + BOMBA TÁNDEM (posición aprox.: bajo el tablero, delante del pedal) ════════
  const yaw = 1.2, pitch = -0.14;
  const ax = V(Math.cos(pitch) * Math.cos(yaw), Math.sin(pitch), -Math.cos(pitch) * Math.sin(yaw)).normalize();
  const ay = V(0, 1, 0).sub(ax.clone().multiplyScalar(ax.y)).normalize(), az = ax.clone().cross(ay);
  const CLEV = V(PX - 0.006, 0.84, PZ);
  const M = CLEV.clone().addScaledVector(ax, 0.10);
  const mc = group('bomba_freno', root, M.toArray(), [0.35, 0.3, -0.15]);
  mc.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(ax, ay, az));
  // servofreno de 6" (un diafragma): dos carcasas engrapadas
  A('servofreno', latheX([[0.014, -0.002], [0.06, -0.002], [0.080, 0.006], [0.087, 0.024], [0.0905, 0.038], [0.0915, 0.044], [0.0905, 0.050], [0.086, 0.066], [0.074, 0.080], [0.05, 0.087], [0.024, 0.089], [0.012, 0.089]], 48), 'dark', { parent: mc, double: true, cut: 'mc' });
  A('servofreno', new THREE.TorusGeometry(0.0915, 0.0028, 6, 48).rotateY(Math.PI / 2), 'steel', { parent: mc, p: [0.044, 0, 0], cut: 'mc' });
  for (const a of [0.785, 2.356, 3.927, 5.498]) A('servofreno', cylX(0.004, 0.022, 8), 'steel', { parent: mc, p: [-0.012, Math.cos(a) * 0.045, Math.sin(a) * 0.045] });
  const bst = {};
  bst.diaph = dyn(A('servofreno', cylX(0.084, 0.0025, 40), 'hose2', { parent: mc, p: [0.040, 0, 0] }));
  bst.hub = dyn(A('servofreno', cylX(0.032, 0.03, 28), 'ceramic', { parent: mc, p: [0.030, 0, 0] }));
  bst.spring = dyn(A('servofreno', helixX(0.022, 1, 5, 0.0022), 'steel', { parent: mc, p: [0.064, 0, 0] }));
  bst.prod = dyn(A('servofreno', cylX(0.005, 0.06, 10), 'machined', { parent: mc, p: [0.075, 0, 0] }));   // vástago al pistón primario
  A('servofreno', cylX(0.016, 0.05, 20), 'plastic', { parent: mc, p: [-0.02, 0, 0] });                        // cuerpo de la válvula
  for (let k = 0; k < 4; k++) A('servofreno', new THREE.TorusGeometry(0.013 - k * 0.0015, 0.0035, 6, 18).rotateY(Math.PI / 2), 'rubber', { parent: mc, p: [-0.05 - k * 0.008, 0, 0] });  // guardapolvo
  bst.rod = dyn(A('pedal_freno', cylX(0.0052, 0.10, 10), 'steel', { parent: mc, p: [-0.05, 0, 0] }));        // varilla del pedal
  A('servofreno', cylX(0.011, 0.016, 14), 'dark', { parent: mc, p: [0.094, 0.052, 0.012] });                  // válvula de retención (vacío)
  A('servofreno', cylX(0.0042, 0.02, 10), 'steel', { parent: mc, p: [0.110, 0.052, 0.012] });
  // bomba tándem (cilindro maestro): dos pistones, dos cámaras
  A('bomba_freno', rbox(0.008, 0.075, 0.036, 0.004), 'alu', { parent: mc, p: [0.094, 0, 0] });
  A('bomba_freno', alongX(ringGeo(0.021, 0.0106, 0.118, 32)), 'alu', { parent: mc, p: [0.157, 0, 0], double: true, cut: 'mc' });
  A('bomba_freno', cylX(0.021, 0.006, 32), 'alu', { parent: mc, p: [0.219, 0, 0], cut: 'mc' });
  const NIP = [0.118, 0.182], OUT = [0.132, 0.196];
  for (const x of NIP) { A('bomba_freno', cylY(0.0065, 0.022, 12), 'alu', { parent: mc, p: [x, 0.026, 0] }); A('bomba_freno', cylY(0.0095, 0.005, 14), 'rubber', { parent: mc, p: [x, 0.021, 0] }); }
  for (const x of OUT) { A('bomba_freno', cylY(0.0065, 0.014, 12), 'alu', { parent: mc, p: [x, -0.025, 0] }); A('bomba_freno', cylY(0.0078, 0.009, 6), 'steel', { parent: mc, p: [x, -0.034, 0] }); }
  const mp = {};
  mp.p1 = dyn(A('bomba_freno', cylX(0.0104, 0.026, 20), 'machined', { parent: mc, p: [0.112, 0, 0] }));
  mp.s1 = dyn(A('bomba_freno', helixX(0.0075, 1, 5, 0.0012), 'steel', { parent: mc, p: [0.137, 0, 0] }));
  mp.p2 = dyn(A('bomba_freno', cylX(0.0104, 0.022, 20), 'machined', { parent: mc, p: [0.160, 0, 0] }));
  mp.s2 = dyn(A('bomba_freno', helixX(0.0075, 1, 5, 0.0012), 'steel', { parent: mc, p: [0.19, 0, 0] }));
  mp.f1 = dyn(A('bomba_freno', alongX(new THREE.CylinderGeometry(0.0101, 0.0101, 1, 18).rotateX(Math.PI / 2)), 'fluid', { parent: mc, press: 'f', op: 0.85 }));
  mp.f2 = dyn(A('bomba_freno', alongX(new THREE.CylinderGeometry(0.0101, 0.0101, 1, 18).rotateX(Math.PI / 2)), 'fluid', { parent: mc, press: 'rm', op: 0.85 }));
  for (const m of [mp.f1, mp.f2]) m.geometry.translate(0.5, 0, 0);     // desde x hacia +x, largo = escala
  mc.updateMatrixWorld(true);
  const MCW = (x, y, z) => mc.localToWorld(V(x, y, z));

  // ════════ DEPÓSITO REMOTO (extremo izquierdo del tablero, junto al pilar; foto) ════════
  const res = group('deposito_freno', root, [0.425, 0.985, -0.582], [0.3, 0.4, -0.25]);
  res.rotation.x = -0.85;
  A('deposito_freno', rbox(0.07, 0.075, 0.05, 0.012), 'resv', { parent: res, op: 0.45, double: true });
  const fluidRes = dyn(A('deposito_freno', rbox(0.064, 1, 0.044, 0.0005), 'fluid', { parent: res, op: 0.8 }));
  for (const y of [-0.021, 0.019]) for (const x of [-0.0352, 0.0352]) A('deposito_freno', rbox(0.0012, 0.0018, 0.03, 0.0005), 'dark', { parent: res, p: [x, y, 0] });   // MIN y MAX
  A('deposito_freno', cylY(0.019, 0.012, 24), 'resv', { parent: res, p: [0, 0.043, 0], op: 0.7 });
  A('deposito_freno', cylY(0.0245, 0.013, 30), 'dark', { parent: res, p: [0, 0.054, 0] });          // tapa NABCO (foto)
  for (let k = 0; k < 12; k++) { const a = k / 12 * Math.PI * 2; A('deposito_freno', rbox(0.003, 0.011, 0.003, 0.001), 'dark', { parent: res, p: [Math.cos(a) * 0.0248, 0.054, Math.sin(a) * 0.0248] }); }
  for (const x of [-0.016, 0.016]) A('deposito_freno', cylY(0.005, 0.016, 10), 'resv', { parent: res, p: [x, -0.045, 0] });
  res.updateMatrixWorld(true);
  for (const [k, x] of [[0, -0.016], [1, 0.016]]) {
    const a = res.localToWorld(V(x, -0.052, 0)), b = MCW(NIP[k], 0.04, 0);
    A('deposito_freno', tube([a, a.clone().add(V(0.01, -0.05, 0.02)), a.clone().lerp(b, 0.55).add(V(0.02, 0.01, 0.05)), b.clone().add(V(0, 0.03, 0)), b], 0.0048, false, 40), 'hose', { ex: [0.3, 0.35, -0.2] });
  }

  // ════════ CAÑERÍAS: bomba → junta de 5 vías → ruedas ════════
  const LN = (pts, press, kind = 'copper', r = 0.0042, o = {}) => A('canerias', tube(pts.map(p => (Array.isArray(p) ? V(...p) : p)), r, false, Math.max(24, pts.length * 16)), kind, { press, ex: [0, -0.08, 0], noAnchor: true, ...o });
  const J5 = V(0.50, 0.42, -0.40);
  A('canerias', rbox(0.045, 0.03, 0.035, 0.006), 'alu', { p: J5.toArray(), ex: [0, -0.08, 0] });
  for (const [dx, dz] of [[0.022, 0.01], [-0.022, 0.01], [0, 0.018], [0.012, -0.018], [-0.012, -0.018]]) A('canerias', cylY(0.006, 0.012, 6), 'steel', { p: [J5.x + dx, J5.y + 0.02, J5.z + dz], ex: [0, -0.08, 0] });
  const o1 = MCW(OUT[0], -0.04, 0), o2 = MCW(OUT[1], -0.04, 0);
  LN([o1, o1.clone().add(V(0, -0.06, 0)), [0.53, 0.55, -0.40], [J5.x + 0.022, J5.y + 0.03, J5.z + 0.01]], 'f');
  LN([o2, o2.clone().add(V(0, -0.05, 0)), [0.56, 0.52, -0.43], [J5.x + 0.012, J5.y + 0.03, J5.z - 0.018]], 'rm');
  const FB = s => V(-0.06, 0.50, s * 0.44);   // soporte del flexible, junto a la torre del amortiguador
  LN([[J5.x - 0.022, J5.y + 0.01, J5.z + 0.01], [0.40, 0.42, -0.42], [0.28, 0.43, -0.45], [0.06, 0.46, -0.45], FB(-1)], 'f');
  LN([[J5.x, J5.y - 0.01, J5.z + 0.018], [0.42, 0.425, -0.30], [0.36, 0.425, 0.20], [0.12, 0.44, 0.42], FB(1)], 'f');
  // trasero: por el larguero izquierdo hasta la válvula DSP
  const DSP = V(-1.50, 0.50, -0.24);
  LN([[J5.x - 0.012, J5.y - 0.01, J5.z - 0.018], [0.40, 0.395, -0.37], [0.0, 0.395, -0.36], [-0.9, 0.395, -0.36], [-1.2, 0.40, -0.36], [-1.36, 0.46, -0.33], DSP.clone().add(V(0.03, 0, -0.01))], 'rm');
  for (const s of [1, -1]) A('canerias', rbox(0.02, 0.012, 0.03, 0.003), 'steel', { p: FB(s).toArray(), ex: [0, -0.08, 0], noAnchor: true });

  // ════════ VÁLVULA DSP (sensible a la desaceleración; posición aprox.) ════════
  const dspG = group('valvula_dsp', root, DSP.toArray(), [0, -0.12, 0]);
  dspG.rotation.z = 0.17;                                   // inclinada: la bola sube la rampa al frenar fuerte
  A('valvula_dsp', rbox(0.065, 0.04, 0.04, 0.008), 'alu', { parent: dspG, double: true, cut: 'dsp' });
  A('valvula_dsp', cylX(0.013, 0.05, 16), 'alu', { parent: dspG, p: [0, 0, 0], double: true, cut: 'dsp' });
  const ball = dyn(A('valvula_dsp', new THREE.SphereGeometry(0.0095, 16, 12), 'chrome', { parent: dspG, p: [-0.012, 0, 0] }));
  A('valvula_dsp', rbox(0.02, 0.03, 0.05, 0.004), 'steel', { parent: dspG, p: [0, 0.03, 0] });          // soporte
  A('valvula_dsp', cylY(0.003, 0.012, 8), 'steel', { parent: dspG, p: [0.02, 0.024, 0.01] });             // purgador
  dspG.updateMatrixWorld(true);
  const dOut = dspG.localToWorld(V(-0.035, -0.005, 0));
  // flexible al puente y tubos hasta cada cilindro de rueda
  const TEE = V(-WB + 0.05, 0.335, -0.17);
  A('canerias', tube([dOut, dOut.clone().add(V(-0.05, -0.04, 0.02)), V(-1.70, 0.40, -0.18), TEE.clone().add(V(0, 0.02, 0))], 0.0055, false, 40), 'hose', { press: 'r', ex: [0, -0.08, 0], noAnchor: true });
  A('canerias', rbox(0.03, 0.02, 0.03, 0.004), 'steel', { p: TEE.toArray(), ex: [0, -0.08, 0], noAnchor: true });
  const wcIn = s => V(-WB - 0.004, RW + 0.094, s * (RZ - 0.04));
  LN([TEE, [-WB + 0.01, 0.33, -0.38], [-WB, RW + 0.06, -0.49], wcIn(-1)], 'r');
  LN([TEE, [-WB + 0.06, 0.38, -0.10], [-WB + 0.02, 0.405, 0.0], [-WB + 0.01, 0.37, 0.14], [-WB + 0.005, 0.33, 0.38], [-WB, RW + 0.06, 0.49], wcIn(1)], 'r');

  // ════════ FRENOS DELANTEROS: disco macizo + caliper flotante de un pistón ════════
  const padGeo = sector(0.066, 0.104, -0.42, 0.42, 14);
  for (const s of [1, -1]) {
    const na = s > 0;                              // del lado derecho no se anclan etiquetas (se usan las del conductor)
    const C = V(0, RW, s * FZ), ex = [0, 0, s * 0.42];
    const rot = group('frenos_del', root, C.toArray(), ex); R.rotors.push(rot);
    const disc = dyn(A('frenos_del', ringGeo(BK.discR, 0.064, 1, 56), 'iron', { parent: rot, noAnchor: na })); R.disc.push(disc);
    A('frenos_del', ringGeo(BK.discR - 0.004, BK.discR - 0.0055, 0.0108, 56), 'machined', { parent: rot, noAnchor: na });   // canto maquinado
    A('frenos_del', cylZ(0.064, 0.024, 40), 'iron', { parent: rot, p: [0, 0, s * 0.017], noAnchor: na });
    A('frenos_del', cylZ(0.036, 0.022, 24), 'steel', { parent: rot, p: [0, 0, s * 0.036], noAnchor: na });
    for (let k = 0; k < 4; k++) { const a = k / 4 * Math.PI * 2 + 0.4; A('frenos_del', cylZ(0.0055, 0.026, 8), 'chrome', { parent: rot, p: [Math.cos(a) * 0.05, Math.sin(a) * 0.05, s * 0.04], noAnchor: na }); }
    // caliper (marco local: x radial, z axial)
    const cal = group('frenos_del', root, C.toArray(), ex); cal.rotation.z = TH_CAL;
    A('frenos_del', rbox(0.035, 0.13, 0.012, 0.004), 'iron', { parent: cal, p: [0.072, 0, -s * 0.050], noAnchor: na });     // soporte (a la mangueta)
    for (const y of [-0.052, 0.052]) A('frenos_del', cylZ(0.0055, 0.085, 10), 'machined', { parent: cal, p: [0.114, y, -s * 0.02], noAnchor: na });   // pasadores
    const hous = new THREE.Group(); cal.add(hous);
    A('frenos_del', rbox(0.058, 0.075, 0.012, 0.004), 'iron', { parent: hous, p: [0.099, 0, s * 0.028], cut: 'xray', noAnchor: na });     // dedos exteriores
    A('frenos_del', rbox(0.022, 0.07, 0.106, 0.005), 'iron', { parent: hous, p: [0.122, 0, -s * 0.019], cut: 'xray', noAnchor: na });    // puente sobre el disco
    A('frenos_del', ringGeo(0.036, 0.0257, 0.046, 32), 'iron', { parent: hous, p: [BK.rEff, 0, -s * 0.047], cut: 'xray', noAnchor: na }); // cuerpo del pistón
    A('frenos_del', cylZ(0.036, 0.007, 32), 'iron', { parent: hous, p: [BK.rEff, 0, -s * 0.0735], cut: 'xray', noAnchor: na });
    A('frenos_del', new THREE.TorusGeometry(0.0262, 0.0017, 6, 28), 'rubber', { parent: hous, p: [BK.rEff, 0, -s * 0.034], noAnchor: na });                // sello (retrae el pistón)
    A('frenos_del', cylX(0.0042, 0.016, 8), 'steel', { parent: hous, p: [0.124, 0.014, -s * 0.062], noAnchor: na });                                        // purgador
    A('frenos_del', cylX(0.0055, 0.006, 8), 'rubber', { parent: hous, p: [0.134, 0.014, -s * 0.062], noAnchor: na });
    A('frenos_del', cylZ(0.008, 0.012, 6), 'steel', { parent: hous, p: [BK.rEff, -0.018, -s * 0.082], noAnchor: na });                                       // entrada del flexible
    const fluid = dyn(A('frenos_del', cylZ(0.0254, 1, 28).translate(0, 0, 0.5), 'fluid', { parent: hous, press: 'f', op: 0.9, noAnchor: na }));
    const piston = dyn(A('frenos_del', cylZ(0.0255, 0.03, 32).translate(0, 0, -s * 0.015), 'machined', { parent: cal, noAnchor: na }));
    piston.position.x = BK.rEff;
    // pastillas: respaldo de acero + material de fricción (forman parte de "pastillas")
    const pads = { side: s };
    for (const k of ['inB', 'inL', 'outB', 'outL']) {
      const lin = k.endsWith('L');
      pads[k] = dyn(A('pastillas', padGeo.clone(), lin ? 'pad' : 'steel', { parent: cal, noAnchor: na, ex: null }));
    }
    R.cal.push({ s, cal, hous, piston, fluid, pads, disc, rot });
    cal.updateMatrixWorld(true);
    const inlet = cal.localToWorld(V(BK.rEff, -0.018, -s * 0.09));
    A('canerias', tube([FB(s), FB(s).add(V(0.0, -0.06, -s * 0.02)), inlet.clone().add(V(0.02, 0.06, -s * 0.03)), inlet], 0.0055, false, 36), 'hose', { press: 'f', ex: [0, 0, s * 0.3], noAnchor: true });
    // corte: el cuerpo del caliper se vuelve transparente (el caliper está abierto por los lados y se ve mejor así)
  }

  // ════════ FRENOS TRASEROS: tambor con zapatas primaria y secundaria ════════
  const drumProfile = [[0.110, -0.027], [0.123, -0.027], [0.1245, -0.012], [0.123, 0.0], [0.1245, 0.012], [0.122, 0.022], [0.116, 0.029], [0.062, 0.029], [0.058, 0.036], [0.03, 0.036], [0.03, 0.023], [0.104, 0.023], [0.110, 0.017], [0.110, -0.027]];
  const shoeA = 1.15;                                         // media abertura de cada zapata
  const linGeo = (L) => sector(0.1005, 0.1005 + L, -shoeA + 0.07, shoeA - 0.07, 16);
  for (const s of [1, -1]) {
    const na = s > 0;
    const C = V(-WB, RW, s * RZ), ex = [-0.28, 0, s * 0.42];
    const plate = group('frenos_tras', root, C.toArray(), ex);
    A('frenos_tras', cylZ(0.128, 0.004, 48), 'dark', { parent: plate, p: [0, 0, -s * 0.029], noAnchor: na });
    A('frenos_tras', new THREE.TorusGeometry(0.127, 0.004, 6, 48), 'steel', { parent: plate, p: [0, 0, -s * 0.027], noAnchor: na });
    A('frenos_tras', rbox(0.03, 0.02, 0.022, 0.004), 'iron', { parent: plate, p: [0, -0.088, -s * 0.012], noAnchor: na });   // anclaje
    // tambor (gira); el corte le saca la cara exterior
    const rot = group('frenos_tras', root, C.toArray(), ex); R.rotors.push(rot);
    const dg = new THREE.LatheGeometry(drumProfile.map(([r, a]) => new THREE.Vector2(r, a)), 56).rotateX(Math.PI / 2); dg.scale(1, 1, s);
    const drum = dyn(A('frenos_tras', dg, 'iron', { parent: rot, double: true, cut: 'drum' + s, noAnchor: na })); R.drum.push(drum);
    for (let k = 0; k < 4; k++) { const a = k / 4 * Math.PI * 2 + 0.4; A('frenos_tras', cylZ(0.0055, 0.024, 8), 'chrome', { parent: rot, p: [Math.cos(a) * 0.05, Math.sin(a) * 0.05, s * 0.046], cut: 'drum' + s, noAnchor: na }); }
    cutOn['drum' + s] = [V(0, 0, -s), RZ + 0.017];
    // zapatas (se abren contra el tambor; el autoajuste las deja más afuera a medida que se gasta la balata)
    const shoes = [];
    for (const [k, c] of [[0, 0], [1, Math.PI]]) {
      const g = new THREE.Group(); plate.add(g);
      const web = A('zapatas', sector(0.072, 0.0985, c - shoeA, c + shoeA, 16), 'bar', { parent: g, noAnchor: na }); slab(web, -s * 0.009, -s * 0.005);
      const table = A('zapatas', sector(0.0985, 0.1005, c - shoeA, c + shoeA, 16), 'bar', { parent: g, noAnchor: na }); slab(table, -s * 0.022, s * 0.008);
      const lining = dyn(A('zapatas', linGeo(0.005), 'pad', { parent: g, noAnchor: na })); lining.rotation.z = c; slab(lining, -s * 0.021, s * 0.007);
      shoes.push({ g, dir: V(Math.cos(c), Math.sin(c), 0), lining });
    }
    // palanca del freno de mano (sobre la zapata trasera) y puntal con trinquete de autoajuste
    const hbl = new THREE.Group(); hbl.position.set(-0.07, 0.07, -s * 0.013); shoes[1].g.add(hbl);
    A('freno_mano', rbox(0.012, 0.14, 0.003, 0.002), 'steel', { parent: hbl, p: [0, -0.07, 0], noAnchor: true });
    A('zapatas', rbox(0.13, 0.008, 0.003, 0.002), 'steel', { parent: plate, p: [0, 0.058, -s * 0.016], noAnchor: na });
    A('zapatas', sector(0.004, 0.022, -0.6, 0.6, 8), 'steel', { parent: plate, p: [0.038, 0.050, -s * 0.019], s: [1, 1, 0.003], noAnchor: na });
    A('zapatas', helixX(0.0045, 0.075, 10, 0.0012), 'steel', { parent: plate, p: [-0.0375, 0.074, -s * 0.012], noAnchor: na });     // resorte superior
    A('zapatas', helixX(0.0045, 0.07, 9, 0.0012), 'steel', { parent: plate, p: [-0.035, -0.073, -s * 0.012], noAnchor: na });     // resorte inferior
    // cilindro de rueda (arriba): cuerpo cortable, dos pistones y el líquido entre ellos
    const wcY = 0.094;
    A('frenos_tras', alongX(ringGeo(0.0135, 0.0089, 0.052, 24)), 'iron', { parent: plate, p: [0, wcY, -s * 0.006], double: true, cut: 'wc' + s, noAnchor: na });
    A('frenos_tras', cylY(0.0032, 0.016, 8), 'steel', { parent: plate, p: [0.008, wcY + 0.018, -s * 0.006], noAnchor: na });   // purgador
    A('frenos_tras', cylZ(0.006, 0.02, 6), 'steel', { parent: plate, p: [-0.004, wcY, -s * 0.026], noAnchor: na });            // entrada
    const wp = [-1, 1].map(d => dyn(A('frenos_tras', cylX(0.0087, 0.014, 18), 'machined', { parent: plate, noAnchor: na })));
    const wl = [-1, 1].map(d => dyn(A('zapatas', cylX(0.0035, 0.024, 8), 'steel', { parent: plate, noAnchor: na })));          // bielitas a las zapatas
    const wf = dyn(A('frenos_tras', cylX(0.0086, 1, 16), 'fluid', { parent: plate, press: 'r', op: 0.9, noAnchor: na }));
    for (const m of [...wp, ...wl, wf]) { m.position.y = wcY; m.position.z = -s * 0.006; }
    cutOn['wc' + s] = [V(0, -1, 0), RW + wcY];
    R.shoes.push({ s, shoes, hbl, wp, wl, wf, wcY, rot, drum, linGeo, plate });
  }

  // ════════ FRENO DE MANO: palanca entre los asientos, cable al ecualizador y a cada tambor ════════
  const HBP = V(-0.07, 0.80, 0.0);
  A('freno_mano', rbox(0.06, 0.03, 0.03, 0.006), 'dark', { p: [HBP.x - 0.01, HBP.y - 0.012, HBP.z], ex: [0, 0.25, 0] });
  A('freno_mano', sector(0.02, 0.045, 2.2, 3.6, 10), 'steel', { p: [HBP.x, HBP.y, HBP.z - 0.012], s: [1, 1, 0.003], ex: [0, 0.25, 0] });   // trinquete
  const lever = group('freno_mano', root, HBP.toArray(), [0, 0.25, 0]);
  A('freno_mano', rbox(0.20, 0.022, 0.016, 0.005), 'steel', { parent: lever, p: [-0.1, 0.006, 0] });
  A('freno_mano', rbox(0.12, 0.032, 0.026, 0.012), 'rubber', { parent: lever, p: [-0.25, 0.008, 0] });
  A('freno_mano', cylX(0.007, 0.012, 14), 'red', { parent: lever, p: [-0.316, 0.008, 0] });
  const EQ = V(-1.15, 0.31, -0.16);
  A('freno_mano', tube([[HBP.x + 0.005, HBP.y - 0.02, 0], [-0.03, 0.70, 0], [-0.03, 0.46, -0.02], [-0.1, 0.36, -0.20], [-0.6, 0.27, -0.31], [-1.0, 0.29, -0.24], EQ.clone().add(V(0.03, 0, 0))], 0.0028), 'steel', { ex: [0, 0.1, 0], noAnchor: true });
  const eq = group('freno_mano', root, EQ.toArray(), [0, -0.1, 0]);
  A('freno_mano', rbox(0.016, 0.012, 0.07, 0.004), 'dark', { parent: eq, noAnchor: true });
  for (const s of [1, -1]) {
    const end = V(-WB - 0.07, RW - 0.05, s * (RZ - 0.03));
    A('freno_mano', tube([EQ.clone().add(V(0, 0, s * 0.03)), [-1.35, 0.30, s * 0.22], [-1.62, 0.26, s * 0.43], [-1.80, 0.22, s * 0.50], end], 0.0028), 'steel', { ex: [0, -0.1, s * 0.2], noAnchor: true });
  }

  // ════════ VACÍO: manguera del servofreno al múltiple de admisión ════════
  const cv = MCW(0.12, 0.052, 0.012), mani = ELv(E.pts.carbInlet).add(V(0.03, -0.045, -0.03));
  A('servofreno', tube([cv, cv.clone().add(V(0.02, 0.04, 0)), V(0.42, 0.66, -0.25), V(0.22, 0.56, -0.26), V(0.05, 0.63, -0.22), V(-0.1, 0.6, -0.12), mani.clone().add(V(0.04, 0.05, -0.03)), mani], 0.0062, false, 60), 'hose', { press: 'v', ex: [0.2, 0.2, -0.1], noAnchor: true });

  // ════════ marcas de fallas (sólo se ven al simularlas) ════════
  const mark = (part, geo, kind, p) => { const m = dyn(A(part, geo, kind, { p: p.toArray(), pick: false, noAnchor: true })); m.visible = false; return m; };
  R.leaks.del = [mark('canerias', new THREE.SphereGeometry(0.012, 12, 10), 'fluid', FB(-1).add(V(0, -0.11, 0))), mark('canerias', new THREE.TorusGeometry(0.014, 0.003, 6, 20).rotateY(Math.PI / 2), 'red', FB(-1).add(V(0, -0.05, -0.01)))];
  R.leaks.tras = [mark('canerias', new THREE.SphereGeometry(0.012, 12, 10), 'fluid', TEE.clone().add(V(0, -0.07, 0))), mark('canerias', new THREE.TorusGeometry(0.016, 0.003, 6, 20), 'red', TEE.clone().add(V(0, 0.03, 0)))];
  R.leaks.vacio = [mark('servofreno', new THREE.TorusGeometry(0.014, 0.003, 6, 20).rotateY(Math.PI / 2), 'red', cv.clone().add(V(0.012, 0.01, 0)))];
  for (const p of [V(0.33, 0.43, -0.44), V(0.10, 0.455, -0.45), V(0.30, 0.425, 0.0), V(0.0, 0.395, -0.36), V(-0.7, 0.395, -0.36), V(-1.2, 0.40, -0.36), FB(-1).add(V(0, -0.04, 0)), FB(1).add(V(0, -0.04, 0))])
    R.bubbles.push(mark('canerias', new THREE.SphereGeometry(0.0062, 10, 8), 'white', p));

  ctx.setLevel('van');

  // ════════ estado y animación ════════
  const st = { force: 147, on: false, fail: 'ok', wear: 0.25, hb: 0, stretched: false, cut: false,
    pedalF: 0, v: 0, aF: 0, aR: 0, heat: 0, seq: null, last: null, dist: 0 };
  let press = [];                                        // mallas pintadas por presión (después de juntar las estáticas)
  const BASE = new Map();
  function bind(meshes) {
    press = meshes;
    for (const m of meshes) if (!BASE.has(m.material)) BASE.set(m.material, { c: m.material.color.clone() });
  }
  function setCuts(on) {
    st.cut = on;
    for (const id in planes) { const c = cutOn[id]; if (on && c) planes[id].set(c[0].clone(), c[1]); else planes[id].set(V(0, 1, 0), 1e4); }
  }
  // el corte de la bomba y el servo: plano vertical que contiene su eje
  { const n = az.clone(); cutOn.mc = [n, -n.dot(M)]; }
  { const n = V(0, 0, 1); cutOn.dsp = [n, -n.dot(DSP)]; }
  for (const id of Object.keys(cutOn)) plane(id);

  let lastWear = -1;
  function applyWear(w) {
    if (Math.abs(w - lastWear) < 1e-4) return; lastWear = w;
    const ws = wearState(w);
    for (const sh of R.shoes) for (const o of sh.shoes) { o.lining.geometry.dispose(); o.lining.geometry = sh.linGeo(Math.max(0.0002, (ws.lining - 2) / 1000)); }
    const lv = Math.max(0.02, ws.level);
    const h = 0.012 + 0.04 * lv; fluidRes.scale.y = h; fluidRes.position.y = -0.033 + h / 2;
  }

  function pose(r) {
    const ws = r.wear, d = ws.disc / 1000, Lp = Math.max(0, ws.pad - 5.5) / 1000, B = 0.0055;
    const kF = Math.min(1, r.pf / 4), kR = Math.min(1, Math.max(r.pr / 4, hbE));
    // pedal y varilla
    pedal.rotation.z = (r.travel / 1000) / 0.342;
    swPin.position.x = 0.022 + Math.min(0.006, pedal.rotation.z * 0.047);   // el vástago sale apenas el brazo se aleja (0,5–1 mm de juego, manual)
    const rodT = Math.max(0, r.travel - BK.freePlay) / 1000 / BK.pedalRatio;
    bst.rod.position.x = -0.05 + rodT; bst.prod.position.x = 0.075 + rodT;
    const assistK = r.fail === 'vacio' ? 0 : Math.min(1, r.assist / BK.servoMax);
    bst.diaph.position.x = 0.040 + rodT + 0.004 * assistK; bst.hub.position.x = 0.030 + rodT;
    const sp0 = 0.045 + rodT; bst.spring.position.x = sp0; bst.spring.scale.x = 0.084 - sp0;
    // pistones de la bomba
    const gap0 = 0.024;
    let s1 = rodT, s2 = rodT * 0.5;
    if (r.fail === 'del') { s1 = Math.min(rodT * 2.2, gap0 + rodT * 0.3); s2 = Math.max(0, s1 - gap0); }
    if (r.fail === 'tras') { s2 = Math.min(rodT * 1.6, 0.028); s1 = s2 + rodT * 0.4; }
    mp.p1.position.x = 0.112 + s1; mp.p2.position.x = 0.160 + s2;
    const a1 = 0.125 + s1, b1 = 0.149 + s2, a2 = 0.171 + s2, b2 = 0.216;
    mp.s1.position.x = a1; mp.s1.scale.x = Math.max(0.002, b1 - a1); mp.s2.position.x = a2; mp.s2.scale.x = b2 - a2;
    mp.f1.position.x = a1; mp.f1.scale.x = Math.max(0.0005, b1 - a1); mp.f2.position.x = a2; mp.f2.scale.x = b2 - a2;
    // discos y calipers
    const g = GAP_PAD * (1 - kF);
    for (const c of R.cal) {
      const s = c.s, P = c.pads;
      c.disc.scale.z = d;
      const f = d / 2 + g + Lp + B, f0 = 0.005 + GAP_PAD + 0.010 + B;
      c.hous.position.z = s * (f - f0);
      slab(P.outL, s * (d / 2 + g), s * (d / 2 + g + Lp)); slab(P.outB, s * (d / 2 + g + Lp), s * f);
      slab(P.inL, -s * (d / 2 + g), -s * (d / 2 + g + Lp)); slab(P.inB, -s * (d / 2 + g + Lp), -s * f);
      P.outL.visible = P.inL.visible = Lp > 0.0001;
      c.piston.position.z = -s * f;
      const back = -s * (f + 0.03), bottom = -s * 0.070 + c.hous.position.z;     // líquido detrás del pistón
      slab(c.fluid, back - c.hous.position.z, bottom - c.hous.position.z);
    }
    // tambores: zapatas abiertas por presión o por el freno de mano
    const Ll = Math.max(0, ws.lining - 2) / 1000, adj = 0.005 - Ll;
    for (const sh of R.shoes) {
      const open = GAP_SHOE * kR;
      sh.shoes.forEach(o => o.g.position.copy(o.dir).multiplyScalar(adj + open));
      sh.hbl.rotation.z = -0.25 * hbE;
      const ext = adj + open;
      sh.wp.forEach((m, i) => { m.position.x = (i ? 1 : -1) * (0.012 + ext); });
      sh.wl.forEach((m, i) => { m.position.x = (i ? 1 : -1) * (0.030 + ext); });
      const span = 2 * (0.005 + ext); sh.wf.scale.x = span;
    }
    // freno de mano
    lever.rotation.z = -(0.04 + st.hb * 0.05);
    eq.position.x = EQ.x + 0.012 * hbE;
    // válvula DSP: la bola rueda hacia adelante y cierra el paso al frenar fuerte
    ball.position.x = -0.012 + (r.dsp ? 0.022 : Math.min(0.012, r.a / BK.dspG * 0.012));
    // fallas visibles
    for (const k in R.leaks) R.leaks[k].forEach(m => (m.visible = st.fail === k));
    R.bubbles.forEach(m => (m.visible = st.fail === 'aire'));
  }

    function paint(mode, colorMode) {
    const r = st.last; if (!r || !press.length) return;
    const P = { f: r.pf, rm: r.fail === 'tras' ? 0 : r.p, r: r.pr, v: 0 };
    const on = mode === 'brk' && colorMode === 'real';
    if (!on) return;
    for (const m of press) {
      const mt = m.material, ud = mt.userData;
      if (ud.press === 'v') { mt.color.copy(ud.real); if (st.fail === 'vacio') mt.color.lerp(HOT, 0.45); continue; }
      const k = Math.min(1, (P[ud.press] || 0) / 60);
      mt.color.copy(ud.real);
      if (k > 0.003) { mt.color.lerp(HOT, 0.2 + 0.65 * k); mt.emissive.copy(HOTE); mt.emissiveIntensity = 0.1 + 0.5 * k; }
      else if (ud.kEm) { mt.emissive.copy(ud.kEm); mt.emissiveIntensity = ud.kEi; }
      else { mt.emissive.setRGB(0, 0, 0); mt.emissiveIntensity = 0; }
    }
    // discos y tambores calientes después de frenar
    const hk = Math.min(1, st.heat);
    for (const m of [...R.disc, ...R.drum]) {
      if (hk > 0.02) { m.material.emissive.copy(GLOW); m.material.emissiveIntensity = 0.9 * hk; }
      else if (!m.userData.sel) { m.material.emissive.setRGB(0, 0, 0); m.material.emissiveIntensity = 0; }
    }
  }

  let hbE = 0;
  function recompute() {
    applyWear(st.wear);
    const hb = handbrake(st.hb, st.stretched); hbE = hb.e;
    const r = solve({ force: st.pedalF, fail: st.fail, wear: st.wear });
    r.hb = { notches: st.hb, ...hb, stretched: st.stretched };
    r.v = st.v; r.seq = st.seq ? st.seq.phase : null; r.on = st.on; r.target = st.force; r.heat = st.heat; r.stopDist = st.seq ? st.seq.dist : st.dist;
    if (st.seq && st.seq.done) r.result = st.seq.result;
    st.last = r; pose(r); return r;
  }

  // frenada desde 50 km/h: rueda, pisa, se detiene, espera y suelta
  function startStop() {
    st.seq = { phase: 'roll', t: 0, dist: 0, result: null };
    st.v = 50 / 3.6; st.on = false; st.pedalF = 0; st.dist = 0; st.lastResult = null;
  }
  function tick(dt, wheelSpin) {
    let active = false;
    const q = st.seq;
    if (q) {
      q.t += dt; active = true;
      if (q.phase === 'roll' && q.t > 0.9) { q.phase = 'brake'; q.t = 0; }
      if (q.phase === 'brake') {
        st.pedalF = Math.min(st.force, st.pedalF + st.force * dt / 0.3);
        const a = (st.last ? st.last.a : 0) * 9.81;
        const dv = Math.min(st.v, a * dt); q.dist += (st.v - dv / 2) * dt; st.v -= dv;
        st.heat = Math.min(1.2, st.heat + (st.last ? st.last.pf : 0) * st.v * dt * 0.0016);
        if (st.v <= 0.01 || q.t > 9) { q.result = st.v <= 0.01 ? { stopped: true, dist: q.dist } : { stopped: false, dist: q.dist, v: st.v }; st.v = st.v <= 0.01 ? 0 : st.v; q.phase = 'hold'; q.t = 0; }
      } else if (q.phase === 'hold' && q.t > 1.4) { q.phase = 'release'; q.t = 0; }
      else if (q.phase === 'release') {
        st.pedalF = Math.max(0, st.pedalF - st.force * dt / 0.3);
        if (st.v > 0) { st.v = Math.max(0, st.v - 2 * dt); }
        if (st.pedalF <= 0 && st.v <= 0) { st.dist = q.dist; q.done = true; st.seq = null; st.pedalF = st.on ? st.force : 0; st.lastResult = q.result; }
      }
    } else {
      const tgt = st.on ? st.force : 0;
      if (Math.abs(st.pedalF - tgt) > 0.5) { st.pedalF += Math.sign(tgt - st.pedalF) * Math.min(Math.abs(tgt - st.pedalF), 600 * dt); active = true; }
      else st.pedalF = tgt;
    }
    if (st.heat > 0.01) { st.heat *= Math.exp(-dt / 5); active = true; } else st.heat = 0;
    const r = recompute();
    // giro de ruedas, discos y tambores (las bloqueadas no giran)
    if (st.v > 0) {
      const dA = -st.v / BK.tireR * dt;
      if (!(r.lockF && st.pedalF > 0)) st.aF += dA;
      if (!(r.lockR && st.pedalF > 0)) st.aR += dA;
      wheelSpin(st.aF, st.aR);
    }
    return active;
  }
  function spinRotors(aF, aR) { R.rotors.forEach((g, i) => { g.rotation.z = i < 2 ? aF : aR; }); }

  recompute();
  return {
    planes, bind, setCuts, tick, paint, recompute, startStop, spinRotors,
    demoPedal(k) { pedal.rotation.z = 0.2 * k; swPin.position.x = 0.022 + Math.min(0.006, pedal.rotation.z * 0.047); },   // fuera de la vista Frenos: sólo el pedal y el interruptor
    stopSeq() { st.lastResult = null; if (st.seq) { st.seq = null; st.v = 0; st.pedalF = st.on ? st.force : 0; recompute(); } },
    set(o) { Object.assign(st, o); return recompute(); },
    get state() { return st; },
    get result() { return st.last; },
    groups: { fl: [R.cal[1].cal, R.cal[1].rot], rl: [R.shoes[1].rot, R.shoes[1].plate], pedal: [pedal, mc, res], dsp: dspG, lever },
  };
}
