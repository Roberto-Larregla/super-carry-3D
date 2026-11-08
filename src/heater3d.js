// Calefacción y ventilación del SK410 (manual secc. 7 + fotos de la caja por el frente, el lado del conductor y el del copiloto).
// Caja de dos mitades unidas al centro, del tablero al piso y algo corrida hacia el copiloto: arriba y adelante el ventilador
// de jaula (motor al lado conductor), al medio el radiador de calefacción y abajo una cámara con salidas a los pies por ambos
// costados y hacia la cabina. Del costado izquierdo salen el tubo blanco al desempañador del conductor y el ducto de la rejilla
// del extremo izquierdo; al derecho, el tubo rígido y la manguera corrugada de la rejilla del extremo derecho, y la caja de
// admisión con la rejilla de recirculación (esponja detrás), que baja hasta la esquina del piso, por donde entra el aire de
// afuera. Cotas internas y ductos ocultos: aproximados.
import * as THREE from 'three';
import { heatSolve, MODES, tempColor } from './heatersim.js';

const ZH = 0.03, ZW = 0.10;                                 // centro y medio ancho de la caja
const X0 = 0.39;                                            // cara de atrás (hacia la cabina)
const S = new THREE.Vector3(0.497, 0.81, ZH), SR = 0.075;  // centro y radio del caracol del ventilador
const X1 = S.x + SR;                                        // cara de adelante
const YB = 0.645, YT = 0.895;                               // techo de la cámara baja · techo de la parte de atrás
const LC = { x0: 0.375, x1: 0.572, y0: 0.552, y1: 0.648, zw: ZW + 0.012 };   // cámara baja (abultada)
const FS = { x0: 0.392, x1: 0.556, y0: 0.49, y1: 0.556, zw: ZW + 0.004 };    // faldón con las salidas a los pies
const ZC = -0.03;                                           // eje del centro del tablero

export function buildHeater(ctx, { hOut, wpIn }) {
  const { V, rbox, cylX, cylY, cylZ, tube, helix, add, group } = ctx;
  const root = ctx.world.root;
  ctx.setLevel('cal');
  const EXV = {
    calefactor: [0.35, 0.35, 0], calef_radiador: [0.32, 0.05, 0.28], calef_ventilador: [0.12, 0.12, -0.3], calef_resistencia: [0.25, 0, -0.3],
    calef_compuertas: [0.2, 0.3, -0.12], calef_llave: [0.2, -0.12, 0.15], calef_mando: [-0.15, 0.12, 0], calef_ductos: [0.05, 0.28, 0],
    calef_admision: [0.12, 0.2, 0.3], calef_mangueras: [0, -0.06, 0], calef_tubo: [-0.12, 0.05, -0.12],
  };
  const A = (part, geo, kind, o = {}) => add(part, geo, kind, { ex: 'ex' in o ? o.ex : EXV[part], ...o });
  const dyn = m => { m.userData.dyn = true; return m; };
  const P3 = p => (p.isVector3 ? p : V(...p));
  const planes = { case: new THREE.Plane(V(0, 1, 0), 1e4) };
  const H = { doors: {}, levers: {} };
  // ducto corrugado: tubo con anillos
  const corrugated = (part, pts, r, kind, ring, step = 0.018) => {
    const Q = pts.map(P3);
    A(part, tube(Q, r, false, Math.max(24, Q.length * 16)), kind);
    const cv = new THREE.CatmullRomCurve3(Q, false, 'catmullrom', 0.35), n = Math.max(4, Math.round(cv.getLength() / step));
    for (let i = 1; i < n; i++) { const t = i / n, p = cv.getPointAt(t), d = cv.getTangentAt(t); const m = A(part, new THREE.TorusGeometry(r + 0.0012, 0.0034, 6, 18), ring, { p: p.toArray() }); m.lookAt(p.clone().add(d)); }
  };
  // tramo recto de sección rectangular entre dos puntos
  const bar = (part, a, b, w, h, kind, o = {}) => { a = P3(a); b = P3(b); const m = A(part, rbox(w, h, a.distanceTo(b) + 0.01, 0.008), kind, { p: a.clone().lerp(b, 0.5).toArray(), ...o }); m.lookAt(b); return m; };

  // ════════ CAJA (dos mitades de plástico negro unidas al centro con grapas; fotos) ════════
  const CASE = { cut: 'case', double: true };
  const side = (holeR) => {
    const s = new THREE.Shape(); s.moveTo(X0, YB); s.lineTo(X1, YB); s.lineTo(X1, S.y); s.absarc(S.x, S.y, SR, 0, 2.1, false); s.lineTo(0.447, YT); s.lineTo(X0, YT); s.lineTo(X0, YB);
    const h = new THREE.Path(); h.absarc(S.x, S.y, holeR, 0, Math.PI * 2, true); s.holes.push(h);
    const g = new THREE.ExtrudeGeometry(s, { depth: 0.004, bevelEnabled: false, curveSegments: 28 }); g.translate(0, 0, -0.002); return g;
  };
  A('calefactor', side(0.04), 'plastic', { p: [0, 0, ZH - ZW], ...CASE });       // mitad izquierda (lado conductor: motor)
  A('calefactor', side(0.048), 'plastic', { p: [0, 0, ZH + ZW], ...CASE });      // mitad derecha (entrada del aire)
  A('calefactor', rbox(0.004, S.y - YB, 2 * ZW, 0.002), 'plastic', { p: [X1, (S.y + YB) / 2, ZH], ...CASE });
  A('calefactor', rbox(0.004, YT - YB, 2 * ZW, 0.002), 'plastic', { p: [X0, (YT + YB) / 2, ZH], ...CASE });
  A('calefactor', rbox(0.447 - X0, 0.004, 2 * ZW, 0.002), 'plastic', { p: [(X0 + 0.447) / 2, YT, ZH], ...CASE });
  { const g = new THREE.CylinderGeometry(SR, SR, 2 * ZW, 44, 1, true, Math.PI / 2, 2.1); g.rotateX(Math.PI / 2);   // techo curvo del caracol
    A('calefactor', g, 'plastic', { p: S.toArray(), ...CASE });
    const w = new THREE.CylinderGeometry(SR - 0.005, SR - 0.005, 2 * ZW - 0.01, 30, 1, true, Math.PI / 2 - 1.75, 1.75); w.rotateX(Math.PI / 2);   // pared baja del caracol (garganta atrás)
    A('calefactor', w, 'plastic', { p: S.toArray(), ...CASE }); }
  // cámara baja abultada y faldón con las salidas a los pies (a ambos costados y hacia la cabina)
  A('calefactor', rbox(LC.x1 - LC.x0, LC.y1 - LC.y0, 2 * LC.zw, 0.014), 'plastic', { p: [(LC.x0 + LC.x1) / 2, (LC.y0 + LC.y1) / 2, ZH], ...CASE });
  A('calefactor', rbox(FS.x1 - FS.x0, FS.y1 - FS.y0, 2 * FS.zw, 0.008), 'plastic', { p: [(FS.x0 + FS.x1) / 2, (FS.y0 + FS.y1) / 2, ZH], ...CASE });
  const HOLE = { cut: 'case' };
  for (const s of [-1, 1]) {
    A('calefactor', rbox(0.088, 0.036, 0.006, 0.003), 'rubber', { p: [0.448, 0.522, ZH + s * (FS.zw + 0.001)], ...HOLE });
    A('calefactor', rbox(0.004, 0.036, 0.008, 0.001), 'plastic', { p: [0.448, 0.522, ZH + s * (FS.zw + 0.002)], ...HOLE });
    A('calefactor', rbox(0.006, 0.034, 0.064, 0.003), 'rubber', { p: [FS.x0 - 0.001, 0.522, ZH + s * 0.048], ...HOLE });
  }
  for (const [x, z] of [[0.41, ZH - 0.06], [0.54, ZH + 0.06]]) A('calefactor', rbox(0.03, 0.04, 0.012, 0.003), 'dark', { p: [x, 0.471, z] });   // patas al piso
  // costura central (unión de las mitades) y grapas
  A('calefactor', rbox(0.006, YT - LC.y1, 0.008, 0.002), 'dark', { p: [X0 - 0.004, (YT + LC.y1) / 2, ZH] });
  A('calefactor', rbox(0.006, LC.y1 - LC.y0, 0.008, 0.002), 'dark', { p: [LC.x0 - 0.004, (LC.y0 + LC.y1) / 2, ZH] });
  A('calefactor', rbox(0.006, FS.y1 - FS.y0, 0.008, 0.002), 'dark', { p: [FS.x0 - 0.004, (FS.y0 + FS.y1) / 2, ZH] });
  A('calefactor', rbox(LC.x1 - LC.x0, 0.006, 0.008, 0.002), 'dark', { p: [(LC.x0 + LC.x1) / 2, LC.y0 - 0.002, ZH] });
  for (const [x, y] of [[X0 - 0.008, 0.77], [LC.x0 - 0.008, 0.60], [FS.x0 - 0.007, 0.515]]) A('calefactor', rbox(0.012, 0.02, 0.022, 0.003), 'dark', { p: [x, y, ZH] });
  for (const s of [-1, 1]) for (const x of [0.43, 0.53]) A('calefactor', rbox(0.02, 0.016, 0.008, 0.003), 'dark', { p: [x, LC.y1 + 0.004, ZH + s * (LC.zw + 0.002)], ...(s < 0 ? HOLE : {}) });
  // boquilla del desempañador del conductor (abajo a la izquierda, mira arriba-adelante; ahí entra el tubo blanco)
  const SP0 = V(0.537, 0.612, ZH - LC.zw + 0.004), SP1 = V(0.545, 0.645, -0.125);
  A('calefactor', rbox(0.05, 0.05, 0.026, 0.008), 'plastic', { p: [0.535, 0.61, ZH - LC.zw - 0.008] });
  A('calefactor', tube([SP0, SP0.clone().lerp(SP1, 0.5).add(V(0, 0.002, -0.002)), SP1], 0.032, false, 10), 'plastic');
  // collarín delantero: ducto a las salidas del centro y del copiloto del parabrisas
  A('calefactor', rbox(0.02, 0.045, 0.06, 0.006), 'plastic', { p: [LC.x1 + 0.008, 0.615, -0.045] });

  // ════════ VENTILADOR: motor al lado conductor y rotor de jaula dentro del caracol (manual, piezas 5 y 6) ════════
  const ZL = ZH - ZW;                                       // cara izquierda
  A('calef_ventilador', cylZ(0.05, 0.006, 32), 'steel', { p: [S.x, S.y, ZL - 0.006] });
  A('calef_ventilador', cylZ(0.04, 0.07, 28), 'dark', { p: [S.x, S.y, ZL - 0.045] });
  A('calef_ventilador', cylZ(0.03, 0.012, 20), 'steel', { p: [S.x, S.y, ZL - 0.085] });
  A('calef_ventilador', cylZ(0.006, 0.02, 8), 'steel', { p: [S.x, S.y, ZL - 0.095] });
  const fan = group('calef_ventilador', root, S.toArray(), EXV.calef_ventilador); H.fan = fan;
  A('calef_ventilador', cylZ(0.056, 0.004, 36), 'dark', { parent: fan, p: [0, 0, -0.085], ex: null });
  A('calef_ventilador', cylZ(0.012, 0.03, 12), 'steel', { parent: fan, p: [0, 0, -0.07], ex: null });
  A('calef_ventilador', new THREE.TorusGeometry(0.054, 0.0025, 6, 36), 'dark', { parent: fan, p: [0, 0, 0.03], ex: null });
  for (let k = 0; k < 28; k++) { const a = k / 28 * Math.PI * 2; A('calef_ventilador', rbox(0.012, 0.0022, 0.115, 0.0008), 'dark', { parent: fan, p: [Math.cos(a) * 0.05, Math.sin(a) * 0.05, -0.027], r: [0, 0, a + 0.55], ex: null }); }
  // resistencia de 3 velocidades, en el costado conductor de la caja (manual)
  const RZ = V(0.54, 0.70, ZL - 0.012);
  A('calef_resistencia', rbox(0.045, 0.05, 0.006, 0.004), 'dark', { p: RZ.toArray() });
  A('calef_resistencia', rbox(0.034, 0.036, 0.004, 0.002), 'ceramic', { p: [RZ.x, RZ.y, RZ.z - 0.004] });
  const coil = dyn(A('calef_resistencia', helix(0.004, 0.03, 9, 0.0011).rotateZ(Math.PI / 2), 'copper', { p: [RZ.x, RZ.y + 0.006, RZ.z - 0.008], ex: null }));
  A('calef_resistencia', helix(0.004, 0.03, 9, 0.0011).rotateZ(Math.PI / 2), 'copper', { p: [RZ.x, RZ.y - 0.008, RZ.z - 0.008] });
  A('calef_resistencia', rbox(0.02, 0.016, 0.014, 0.003), 'plastic', { p: [RZ.x, RZ.y - 0.034, RZ.z] });          // conector
  A('calef_resistencia', tube([[RZ.x, RZ.y - 0.042, RZ.z - 0.004], [RZ.x - 0.02, RZ.y - 0.03, RZ.z - 0.02], [S.x + 0.03, S.y - 0.045, ZL - 0.03], [S.x + 0.018, S.y - 0.03, ZL - 0.05]], 0.0022), 'lead', { ex: null });
  H.coil = coil;

  // ════════ RADIADOR DE CALEFACCIÓN (manual, pieza 3) y tubos a la llave ════════
  const core = new THREE.Group(); core.position.set(0.478, 0.695, ZH); core.rotation.z = 0.18; root.add(core);
  A('calef_radiador', rbox(0.11, 0.032, 0.17, 0.003), 'copper', { parent: core, p: [0, 0, -0.01] });
  for (let k = 0; k < 14; k++) A('calef_radiador', rbox(0.004, 0.034, 0.17, 0.0008), 'brass', { parent: core, p: [-0.05 + k * 0.0077, 0, -0.01] });
  for (const x of [-0.062, 0.062]) A('calef_radiador', rbox(0.016, 0.04, 0.18, 0.004), 'alu', { parent: core, p: [x, 0, -0.01] });   // tanques
  core.updateMatrixWorld(true);
  const tankF = core.localToWorld(V(0.062, -0.02, 0));
  const PIN = 0.075, POUT = 0.025, XP = 0.588;
  for (const z of [PIN, POUT]) A('calef_radiador', tube([[tankF.x, tankF.y, z], [XP, tankF.y - 0.03, z], [XP, 0.56, z], [XP, 0.44, z]], 0.0075), 'alu');
  for (const z of [PIN, POUT]) A('calef_radiador', cylY(0.013, 0.008, 16), 'rubber', { p: [XP, 0.452, z], ex: null });    // pasa-piso
  H.core = core;

  // ════════ LLAVE DE AGUA (en la entrada del radiador; la mueve la palanca COOL–HOT por cable) ════════
  const VP = V(XP, 0.53, PIN);
  A('calef_llave', rbox(0.03, 0.034, 0.03, 0.006), 'alu', { p: VP.toArray(), cut: 'xray' });
  A('calef_llave', cylX(0.009, 0.036, 12), 'alu', { p: VP.toArray(), cut: 'xray' });
  const plug = dyn(A('calef_llave', rbox(0.006, 0.026, 0.012, 0.002), 'brass', { p: VP.toArray(), ex: null }));
  const vlever = group('calef_llave', root, [VP.x + 0.017, VP.y, VP.z], EXV.calef_llave);
  A('calef_llave', rbox(0.004, 0.006, 0.04, 0.002), 'steel', { parent: vlever, p: [0, 0, 0.02], ex: null });
  H.plug = plug; H.vlever = vlever;

  // ════════ COMPUERTAS (salida a la cara / a los pies y al parabrisas) con su palanca al costado ════════
  const dFace = group('calef_compuertas', root, [X0 + 0.006, 0.73, ZH], EXV.calef_compuertas);
  A('calef_compuertas', rbox(0.06, 0.004, 2 * ZW - 0.01, 0.002), 'steel', { parent: dFace, p: [0.03, 0, 0], ex: null });
  A('calef_compuertas', cylZ(0.004, 2 * ZW, 8), 'steel', { parent: dFace, ex: null });
  const dDef = group('calef_compuertas', root, [LC.x1 - 0.008, 0.60, ZH], EXV.calef_compuertas);
  A('calef_compuertas', rbox(0.055, 0.004, 2 * ZW - 0.01, 0.002), 'steel', { parent: dDef, p: [-0.0275, 0, 0], ex: null });
  A('calef_compuertas', cylZ(0.004, 2 * ZW, 8), 'steel', { parent: dDef, ex: null });
  const mlever = group('calef_compuertas', root, [0.432, 0.755, ZL - 0.01], EXV.calef_compuertas);   // palanca con cable (foto del lado conductor)
  A('calef_compuertas', rbox(0.008, 0.07, 0.004, 0.002), 'steel', { parent: mlever, p: [0, 0.03, 0], ex: null });
  A('calef_compuertas', rbox(0.06, 0.006, 0.004, 0.002), 'steel', { p: [0.456, 0.733, ZL - 0.012] });             // varilla a las compuertas
  H.doors = { face: dFace, def: dDef }; H.levers.mode = mlever;

  // ════════ ADMISIÓN (lado copiloto; fotos y dueño) ════════
  // caja con la rejilla cuadrada de recirculación y una esponja detrás, pegada al costado derecho de la caja
  const ZR = ZH + LC.zw + 0.004;                             // cara derecha de la cámara baja
  const GB = V(0.53, 0.74, ZR + 0.0375);                     // centro de la caja de la rejilla
  const gbox = dyn(A('calef_admision', rbox(0.11, 0.15, 0.075, 0.014), 'plastic', { p: GB.toArray(), cut: 'xray', double: true }));
  A('calef_admision', rbox(0.088, 0.122, 0.004, 0.002), 'foam', { p: [GB.x, GB.y, GB.z + 0.0395] });            // esponja
  for (let k = 0; k <= 4; k++) A('calef_admision', rbox(0.004, 0.128, 0.006, 0.001), 'dark', { p: [GB.x - 0.044 + k * 0.022, GB.y, GB.z + 0.043] });
  for (let k = 0; k <= 5; k++) A('calef_admision', rbox(0.092, 0.004, 0.006, 0.001), 'dark', { p: [GB.x, GB.y - 0.062 + k * 0.0248, GB.z + 0.043] });
  A('calef_admision', rbox(0.1, 0.012, 0.012, 0.004), 'dark', { p: [GB.x, GB.y - 0.07, GB.z + 0.04] });             // borde de abajo de la rejilla
  A('calef_admision', rbox(0.11, 0.115, 0.022, 0.012), 'plastic', { p: [0.51, 0.795, ZH + ZW + 0.011] });         // boca hacia el ventilador
  // parte baja: cámara bajo la rejilla que baja hasta la esquina del piso, adelante; por abajo entra el aire de afuera (dueño; por fuera no se nota)
  A('calef_admision', rbox(0.115, 0.1, 0.075, 0.012), 'plastic', { p: [0.528, 0.615, GB.z], cut: 'xray', double: true });
  const lowIn = dyn(A('calef_admision', rbox(0.06, 0.13, 0.07, 0.012), 'plastic', { p: [0.59, 0.515, GB.z], r: [0, 0, 0.33], cut: 'xray', double: true }));
  A('calef_admision', rbox(0.006, 0.03, 0.085, 0.003), 'dark', { p: [0.617, 0.468, GB.z] });                        // pestaña atornillada
  for (const dz of [-0.03, 0.03]) A('calef_admision', cylX(0.005, 0.008, 8), 'steel', { p: [0.614, 0.468, GB.z + dz] });
  // compuerta exterior/recirculación (bisagra abajo, junto a la rejilla) y su palanca con cable
  const flap = group('calef_admision', root, [GB.x, 0.672, GB.z + 0.029], EXV.calef_admision);
  A('calef_admision', rbox(0.096, 0.004, 0.064, 0.002), 'steel', { parent: flap, p: [0, 0, -0.032], ex: null });
  const rlever = group('calef_admision', root, [0.588, 0.705, GB.z + 0.012], EXV.calef_admision);
  A('calef_admision', rbox(0.004, 0.05, 0.01, 0.002), 'steel', { parent: rlever, p: [0, 0.02, 0], ex: null });
  A('calef_admision', rbox(0.012, 0.03, 0.03, 0.004), 'ceramic', { p: [0.596, 0.79, GB.z + 0.02] });             // grapa del cable (foto)
  H.flap = flap; H.levers.recirc = rlever;

  // ════════ DUCTOS Y SALIDAS ════════
  // rejillas del tablero (2 al centro junto a los mandos y 1 en cada extremo; dueño): aire que no pasa por el radiador
  const VENTS = [ZC - 0.114, ZC + 0.114, -0.585, 0.585];
  for (const z of VENTS) {
    A('calef_ductos', rbox(0.012, 0.064, 0.060, 0.008), 'dark', { p: [0.372, 1.047, z] });
    for (let k = 0; k < 4; k++) A('calef_ductos', rbox(0.014, 0.004, 0.052, 0.001), 'plastic', { p: [0.369, 1.027 + k * 0.013, z] });
  }
  // distribuidor: sale ancho de arriba de la caja (pieza trapezoidal bajo la radio, foto de frente) y reparte bajo el tablero
  { const t = new THREE.Shape(), zt0 = -0.01, zt = 0.215;   // en el plano (−z, y)
    t.moveTo(-(ZH - ZW), YT); t.lineTo(-(ZH + ZW), YT); t.lineTo(-(zt0 + zt), 0.937); t.lineTo(-(zt0 - zt), 0.937); t.lineTo(-(ZH - ZW), YT);
    const g = new THREE.ExtrudeGeometry(t, { depth: 0.07, bevelEnabled: false }); g.rotateY(Math.PI / 2); g.translate(0.388, 0, 0);
    A('calef_ductos', g, 'plastic', { double: true }); }
  A('calef_ductos', rbox(0.05, 0.04, 0.40, 0.012), 'plastic', { p: [0.42, 0.958, ZC] });
  for (const z of VENTS.slice(0, 2)) A('calef_ductos', tube([[0.415, 0.965, z * 0.8], [0.398, 1.015, z], [0.385, 1.047, z]], 0.018), 'plastic');
  // al extremo derecho: tubo rígido que sube por el costado derecho de la caja desde arriba de la salida a los pies (el dueño cree
  // que sale de la caja) y manguera corrugada que pasa sobre la caja del foco y sube por dentro del tablero (fotos y dueño)
  A('calefactor', rbox(0.06, 0.05, 0.06, 0.01), 'plastic', { p: [0.445, 0.582, 0.17] });                           // boca baja del costado derecho
  { const C0 = 0.444, pts = [[0.44, 0.585, 0.186], [0.441, 0.65, 0.204], [0.443, 0.75, 0.215], [0.446, 0.83, 0.211], [0.448, 0.872, 0.206]];
    A('calef_ductos', tube(pts.map(([x, y, z]) => [x - C0, y, z]), 0.029, false, 40), 'plastic', { p: [C0, 0, 0], s: [1.3, 1, 1] }); }
  A('calef_ductos', tube([[0.447, 0.86, 0.206], [0.45, 0.895, 0.212], [0.455, 0.905, 0.235], [0.458, 0.905, 0.252]], 0.032, false, 16), 'plastic');   // codo de arriba
  const RV = [[0.457, 0.905, 0.25], [0.47, 0.895, 0.32], [0.503, 0.895, 0.40], [0.52, 0.925, 0.46], [0.53, 0.975, 0.52], [0.47, 1.02, 0.565], [0.40, 1.042, 0.585], [0.388, 1.047, 0.585]];
  corrugated('calef_ductos', RV, 0.03, 'rubber', 'dark');
  // al extremo izquierdo: ducto negro que sale del costado izquierdo, sobre el motor del ventilador, y sigue corrugado (dueño)
  const L0 = V(0.447, 0.918, -0.16), L1 = V(0.472, 0.962, -0.25);
  bar('calef_ductos', L0, L1, 0.065, 0.035, 'plastic');
  corrugated('calef_ductos', [L1, [0.468, 0.988, -0.33], [0.44, 1.012, -0.45], [0.405, 1.036, -0.545], [0.389, 1.047, -0.585]], 0.026, 'rubber', 'dark');
  // desempañador: 3 salidas en la base del parabrisas (conductor, centro y copiloto; dueño)
  const DEF = [-0.36, ZC, 0.36];
  for (const z of DEF) {
    A('calef_ductos', rbox(0.065, 0.006, 0.18, 0.004), 'dark', { p: [0.545, 1.126, z] });
    for (let k = 0; k < 6; k++) A('calef_ductos', rbox(0.058, 0.004, 0.005, 0.001), 'plastic', { p: [0.545, 1.13, z - 0.075 + k * 0.03] });
  }
  // el centro y el copiloto reciben el aire por un ducto que sube por delante de la caja (recorrido supuesto, no se ve)
  A('calef_ductos', tube([[0.582, 0.615, -0.045], [0.598, 0.66, -0.046], [0.6, 0.80, -0.046], [0.596, 0.92, -0.043], [0.578, 1.02, -0.036], [0.556, 1.09, -0.03], [0.55, 1.108, ZC]], 0.022, false, 60), 'plastic');
  A('calef_ductos', tube([[0.594, 0.95, -0.04], [0.588, 0.99, 0.06], [0.572, 1.05, 0.22], [0.556, 1.095, 0.33], [0.55, 1.108, 0.36]], 0.02, false, 50), 'plastic');
  // el del conductor, por el tubo blanco: sube de la boquilla baja, pasa frente al motor del ventilador y sigue en una manguera beige
  const WT = [SP1.clone().add(V(0, -0.005, 0.005)), [0.556, 0.75, -0.16], [0.567, 0.835, -0.198], [0.575, 0.90, -0.226]];
  A('calef_tubo', tube(WT, 0.026, false, 40), 'white');
  A('calef_tubo', tube([[0.572, 0.876, -0.216], [0.576, 0.906, -0.229]], 0.03, false, 4), 'white');               // campana del tubo
  corrugated('calef_tubo', [[0.575, 0.90, -0.226], [0.574, 0.95, -0.255], [0.567, 1.02, -0.30], [0.556, 1.075, -0.34], [0.55, 1.105, -0.36]], 0.03, 'beige', 'beigeD', 0.016);

  // ════════ MANDOS (foto): salida del aire (4), recirculación/exterior, COOL–HOT y ventilador OFF–3 ════════
  const CM = V(0.369, 1.045, ZC - 0.012);
  A('calef_mando', rbox(0.006, 0.068, 0.138, 0.005), 'dark', { p: CM.toArray() });
  const SL = { mode: 0.022, air: 0.0, temp: -0.022 };
  for (const dy of Object.values(SL)) A('calef_mando', rbox(0.004, 0.004, 0.086, 0.001), 'plastic', { p: [CM.x - 0.004, CM.y + dy, CM.z - 0.02] });
  A('calef_mando', rbox(0.0015, 0.005, 0.04, 0.001), 'blue', { p: [CM.x - 0.004, CM.y - 0.012, CM.z - 0.042] });     // escala COOL
  A('calef_mando', rbox(0.0015, 0.005, 0.04, 0.001), 'red', { p: [CM.x - 0.004, CM.y - 0.012, CM.z + 0.002] });      // escala HOT
  const knobs = {};
  for (const k of Object.keys(SL)) knobs[k] = dyn(A('calef_mando', rbox(0.016, 0.012, 0.012, 0.003), 'dark', { p: [CM.x - 0.01, CM.y + SL[k], CM.z], ex: null }));
  const fanKnob = group('calef_mando', root, [CM.x - 0.012, CM.y + 0.004, CM.z + 0.048], EXV.calef_mando);
  A('calef_mando', cylX(0.016, 0.02, 18), 'dark', { parent: fanKnob, ex: null });
  A('calef_mando', rbox(0.004, 0.022, 0.006, 0.001), 'white', { parent: fanKnob, p: [-0.011, 0.004, 0], ex: null });
  H.knobs = knobs; H.fanKnob = fanKnob; H.CM = CM;
  // cables: modo → palanca de las compuertas; recirculación → compuerta de la admisión; temperatura → llave de agua
  for (const [dy, dz, to] of [[SL.mode, -0.05, V(0.432, 0.80, ZL - 0.012)], [SL.air, -0.03, V(0.596, 0.79, GB.z + 0.02)], [SL.temp, -0.01, V(VP.x + 0.02, VP.y + 0.02, VP.z + 0.03)]])
    A('calef_mando', tube([V(CM.x + 0.01, CM.y + dy, CM.z + dz), V(CM.x + 0.05, CM.y - 0.05, CM.z + dz + 0.04), to.clone().add(V(-0.03, 0.06, 0)), to], 0.0025), 'dark');

  // ════════ MANGUERAS: agua caliente del múltiple de admisión → llave → radiador → vuelve a la bomba ════════
  const hin = V(XP, 0.44, PIN), hrt = V(XP, 0.44, POUT);
  const HIN = [hOut, V(hOut.x + 0.1, hOut.y + 0.06, hOut.z - 0.1), V(-0.12, 0.66, -0.2), V(0.08, 0.60, -0.18), V(0.22, 0.42, -0.06), V(0.40, 0.40, 0.08), V(hin.x - 0.01, 0.41, hin.z), hin];
  const HRT = [hrt, V(hrt.x - 0.02, 0.40, hrt.z), V(0.3, 0.39, 0.03), V(0.08, 0.3, 0.05), V(0.04, 0.17, 0.0), V(-0.14, 0.17, -0.05), V(wpIn.x + 0.03, wpIn.y - 0.03, wpIn.z + 0.01), wpIn];
  A('calef_mangueras', tube(HIN, 0.009, false, 90), 'hose', { press: 'hin' });
  A('calef_mangueras', tube(HRT, 0.009, false, 90), 'hose', { press: 'hout' });

  // ════════ FLUJOS ANIMADOS (aire y agua): partículas sobre recorridos ════════
  const curve = pts => new THREE.CatmullRomCurve3(pts.map(P3), false, 'catmullrom', 0.3);
  const throat = V(0.432, 0.752, ZH), LCC = V(0.475, 0.60, ZH);
  const UP = [throat, [0.41, 0.78, ZH], [0.405, 0.85, ZH], [0.41, 0.905, ZH - 0.02], [0.42, 0.93, -0.01]];
  const out = z => [[0.372, 1.047, z], [0.24, 1.05, z]];
  const AIR = {
    exterior: curve([[0.70, 0.36, 0.22], [0.645, 0.43, 0.205], [0.612, 0.47, GB.z], [0.59, 0.515, GB.z], [0.566, 0.578, GB.z], [0.53, 0.62, GB.z], [0.53, 0.70, GB.z]]),
    recirc: curve([[0.25, 0.74, 0.42], [0.36, 0.74, 0.34], [0.46, 0.742, 0.27], [GB.x, GB.y, GB.z + 0.045], [GB.x, 0.722, GB.z]]),
    ducto: curve([[0.53, 0.70, GB.z], [0.522, 0.775, GB.z - 0.012], [0.505, 0.805, ZH + ZW + 0.012], [S.x, S.y, ZH + 0.05], [S.x + 0.03, S.y + 0.045, ZH], [S.x - 0.01, S.y + 0.062, ZH], [S.x - 0.055, S.y + 0.03, ZH], [S.x - 0.06, S.y - 0.03, ZH], throat]),
    nucleo: curve([throat, [0.44, 0.73, ZH], [0.465, 0.70, ZH], [0.48, 0.67, ZH], [0.477, 0.625, ZH], LCC]),
    cara0: curve([...UP, [0.42, 0.955, -0.10], [0.405, 1.0, VENTS[0]], [0.388, 1.04, VENTS[0]], ...out(VENTS[0])]),
    cara1: curve([...UP, [0.42, 0.955, 0.05], [0.405, 1.0, VENTS[1]], [0.388, 1.04, VENTS[1]], ...out(VENTS[1])]),
    cara2: curve([...UP, [0.43, 0.925, -0.12], L0, L1, [0.468, 0.988, -0.33], [0.44, 1.012, -0.45], [0.405, 1.036, -0.545], [0.389, 1.047, -0.58], ...out(-0.585)]),
    cara3: curve([throat, [0.424, 0.735, ZH + 0.05], [0.43, 0.68, ZH + ZW - 0.006], [0.437, 0.615, ZH + ZW - 0.006], [0.44, 0.588, 0.15], [0.44, 0.60, 0.19], [0.441, 0.65, 0.204], [0.443, 0.75, 0.215], [0.446, 0.83, 0.211], [0.45, 0.893, 0.21], ...RV.slice(0, -1), ...out(0.585)]),
    piesI: curve([LCC, [0.46, 0.55, ZH - 0.05], [0.45, 0.522, ZH - 0.09], [0.44, 0.515, ZH - 0.14], [0.40, 0.50, -0.25], [0.34, 0.49, -0.36]]),
    piesD: curve([LCC, [0.45, 0.55, ZH + 0.05], [0.445, 0.522, ZH + 0.09], [0.43, 0.515, ZH + 0.15], [0.38, 0.50, 0.28], [0.31, 0.49, 0.38]]),
    piesC: curve([LCC, [0.43, 0.55, ZH], [0.40, 0.522, ZH + 0.03], [0.36, 0.515, ZH + 0.04], [0.26, 0.50, ZH + 0.05]]),
    vidrioI: curve([LCC, [0.52, 0.605, ZH - 0.06], [0.537, 0.615, -0.09], SP1, ...WT.slice(1), [0.574, 0.95, -0.255], [0.567, 1.02, -0.30], [0.556, 1.075, -0.34], [0.55, 1.105, -0.36], [0.545, 1.13, -0.36], [0.47, 1.26, -0.36]]),
    vidrioC: curve([LCC, [0.55, 0.61, ZH - 0.04], [0.582, 0.615, -0.045], [0.598, 0.66, -0.046], [0.60, 0.80, -0.046], [0.596, 0.92, -0.043], [0.578, 1.02, -0.036], [0.556, 1.09, -0.03], [0.55, 1.108, ZC], [0.545, 1.13, ZC], [0.47, 1.26, ZC]]),
    vidrioD: curve([LCC, [0.55, 0.61, ZH - 0.04], [0.582, 0.615, -0.045], [0.598, 0.66, -0.046], [0.60, 0.80, -0.046], [0.594, 0.95, -0.04], [0.588, 0.99, 0.06], [0.572, 1.05, 0.22], [0.556, 1.095, 0.33], [0.55, 1.108, 0.36], [0.545, 1.13, 0.36], [0.47, 1.26, 0.36]]),
  };
  const WATER = { ida: curve(HIN), rad: curve([hin, VP, [XP, 0.60, PIN], [XP, tankF.y - 0.03, PIN], [tankF.x, tankF.y, PIN], [0.42, 0.672, ZH + 0.04], [tankF.x, tankF.y, POUT], [XP, tankF.y - 0.03, POUT], [XP, 0.56, POUT], hrt]), vuelta: curve(HRT) };

  const PATHS = [];   // { key, cv, len, n, kind, j0 }
  const addPath = (key, cv, kind, spacing) => { const len = cv.getLength(), n = Math.max(3, Math.round(len / spacing)); PATHS.push({ key, cv, len, n, kind }); };
  for (const k in AIR) addPath(k, AIR[k], 'air', 0.034);
  for (const k in WATER) addPath(k, WATER[k], 'water', 0.03);
  // puntos de tamaño fijo en pantalla (se ven igual de cerca y de lejos) y por encima de cajas y ductos
  const dot = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d');
    x.beginPath(); x.arc(32, 32, 26, 0, Math.PI * 2); x.fillStyle = '#fff'; x.fill(); x.lineWidth = 6; x.strokeStyle = 'rgba(42,36,32,0.55)'; x.stroke();
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
  const pr = Math.min(window.devicePixelRatio || 1, 2);
  const mkPoints = (n, size) => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3).fill(-1000), 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 3).fill(1), 3).setUsage(THREE.DynamicDrawUsage));
    const m = new THREE.Points(g, new THREE.PointsMaterial({ size: size * pr, sizeAttenuation: false, vertexColors: true, map: dot, transparent: true, alphaTest: 0.2, depthTest: false, depthWrite: false }));
    m.frustumCulled = false; m.renderOrder = 3; m.userData.noBox = true; m.visible = false; root.add(m); return m;
  };
  let nAir = 0, nWat = 0;
  for (const p of PATHS) { if (p.kind === 'air') { p.j0 = nAir; nAir += p.n; } else { p.j0 = nWat; nWat += p.n; } }
  const small = window.innerWidth < 900;
  const ptsAir = mkPoints(nAir, small ? 4.5 : 6.5), ptsWat = mkPoints(nWat, small ? 3.6 : 5);
  const col = new THREE.Color(), pos = new THREE.Vector3();

  ctx.setLevel('van');

  // ════════ estado, pose y animación ════════
  const st = { mode: 'pies', recirc: true, temp: 1, fan: 2, engine: 'caliente', fail: 'ok', on: false, cut: false, showAir: true, showWater: true, t: 0, fanA: 0, last: null };
  const KPOS = { mode: { cara: 0.05, bi: 0.32, pies: 0.64, vidrio: 0.9 } };
  function pose() {
    // mandos
    const zk = k => CM.z - 0.063 + k * 0.086;
    knobs.mode.position.z = zk(KPOS.mode[st.mode]);
    knobs.air.position.z = zk(st.recirc ? 0.04 : 0.92);
    knobs.temp.position.z = zk(0.04 + 0.9 * st.temp);
    fanKnob.rotation.x = [-1.1, -0.35, 0.3, 0.95][st.fan];
    // compuertas: cara (cierra el paso al radiador) · pies/parabrisas (con la falla, la de abajo no llega a la posición del parabrisas)
    const M = MODES[st.mode];
    dFace.rotation.z = M.core === 0 ? -0.75 : M.core === 1 ? 1.25 : 0.25;
    dDef.rotation.z = st.mode === 'vidrio' ? (st.fail === 'desempanador' ? -0.95 : 0.75) : st.mode === 'pies' ? -1.1 : -1.3;
    mlever.rotation.z = (KPOS.mode[st.mode] - 0.5) * 1.2;
    // admisión: en recirculación la compuerta tapa la entrada de abajo (aire de afuera); con aire exterior tapa la rejilla
    flap.rotation.x = st.recirc ? 0.06 : 1.5;
    rlever.rotation.x = st.recirc ? -0.3 : 0.35;
    // llave de agua
    vlever.rotation.x = -0.9 * st.temp;
    plug.rotation.x = (st.fail === 'llave' ? 0 : st.temp) * 1.4;
  }
  const PATHW = r => {
    const Q = r.Q, f = r.flows, on = r.on;
    const w = {};
    w.exterior = on && !st.recirc ? Q : 0; w.recirc = on && st.recirc ? Q : 0; w.ducto = on ? Q : 0;
    w.nucleo = on ? Q * MODES[st.mode].core : 0;
    for (let i = 0; i < 4; i++) w['cara' + i] = on ? f.cara / 2 : 0;
    w.piesI = w.piesD = on ? f.pies * 0.45 : 0; w.piesC = on ? f.pies * 0.3 : 0;
    w.vidrioI = w.vidrioC = w.vidrioD = on ? f.vidrio * 0.5 : 0;
    w.ida = w.rad = w.vuelta = r.waterFlow;
    return w;
  };
  function tempAt(key, u, r) {
    if (key === 'ida') return r.Tw;
    if (key === 'vuelta') return r.Tret;
    if (key === 'rad') return u < 0.45 ? r.Tw : r.Tw + (r.Tret - r.Tw) * Math.min(1, (u - 0.45) / 0.3);
    if (key === 'exterior') return 10;
    if (key === 'recirc') return 16;
    if (key === 'ducto' || key.startsWith('cara')) return r.Tin;
    if (key === 'nucleo') return u < 0.55 ? r.Tin : r.Tin + (r.Thot - r.Tin) * Math.min(1, (u - 0.55) / 0.3);
    return r.Thot;
  }
  function animate(dt) {
    const r = st.last; if (!r) return;
    st.t += Math.max(0, dt);
    const w = PATHW(r);
    for (const p of PATHS) {
      const on = p.kind === 'air' ? st.showAir : st.showWater;
      const weight = on ? w[p.key] || 0 : 0;
      const speed = p.kind === 'air' ? 0.08 + 0.32 * r.Q : 0.05 + 0.14 * r.waterFlow;
      const show = Math.round(p.n * Math.min(1, weight * 1.4 + (weight > 0 ? 0.25 : 0)));
      const G = (p.kind === 'air' ? ptsAir : ptsWat).geometry, PA = G.attributes.position.array, CA = G.attributes.color.array;
      for (let j = 0; j < p.n; j++) {
        const k = (p.j0 + j) * 3;
        if (j >= show || weight <= 0) { PA[k] = PA[k + 2] = 0; PA[k + 1] = -1000; continue; }
        const u = (((j / p.n) + st.t * speed / p.len) % 1 + 1) % 1;
        p.cv.getPointAt(u, pos); PA[k] = pos.x; PA[k + 1] = pos.y; PA[k + 2] = pos.z;
        const c = tempColor(tempAt(p.key, u, r)); col.setRGB(c[0] / 255, c[1] / 255, c[2] / 255, THREE.SRGBColorSpace);
        CA[k] = col.r; CA[k + 1] = col.g; CA[k + 2] = col.b;
      }
    }
    for (const o of [ptsAir, ptsWat]) { o.geometry.attributes.position.needsUpdate = true; o.geometry.attributes.color.needsUpdate = true; }
    // ventilador: gira según la velocidad que realmente le llega
    st.fanA -= dt * [0, 9, 16, 26][r.fanEff];
    fan.rotation.z = st.fanA;
  }
  function recompute() {
    const r = heatSolve(st); st.last = r; pose(); return r;
  }
  function setCuts(on) {
    st.cut = on;
    if (on) planes.case.set(V(0, 0, 1), -(ZH - 0.004)); else planes.case.set(V(0, 1, 0), 1e4);   // abre la mitad izquierda
  }
  const pressMats = [];
  function bind(meshes) { pressMats.length = 0; meshes.forEach(m => pressMats.push(m)); }
  function paint(mode, colorMode) {
    const r = st.last; if (!r || mode !== 'cal' || colorMode !== 'real') return;
    for (const m of pressMats) {
      const ud = m.material.userData; if (ud.press !== 'hin' && ud.press !== 'hout') continue;
      const t = ud.press === 'hin' ? r.Tw : r.Tret, k = Math.max(0, Math.min(1, (t - 25) / 60)) * (r.waterFlow > 0.01 || !r.on ? 1 : 0.6);
      const c = tempColor(t);
      m.material.color.copy(ud.real).lerp(col.setRGB(c[0] / 255, c[1] / 255, c[2] / 255, THREE.SRGBColorSpace), 0.25 + 0.55 * k);
    }
    // la resistencia se entibia en las velocidades 1 y 2
    const rc = H.coil.material;
    if (r.resistorOn) { rc.emissive.set('#ff5a1a'); rc.emissiveIntensity = r.fanEff === 1 ? 0.7 : 0.45; }
    else if (!H.coil.userData.sel) { rc.emissive.setRGB(0, 0, 0); rc.emissiveIntensity = 0; }
  }
  function setActive(on) { ptsAir.visible = ptsWat.visible = on; if (!on) { st.on = false; recompute(); } }

  recompute();
  return {
    planes, fan, bind, paint, setCuts, setActive, recompute,
    tick(dt) { if (!st.on) return false; animate(dt); return true; },
    set(o) { Object.assign(st, o); const r = recompute(); animate(0); return r; },
    get state() { return st; },
    get result() { return st.last; },
    groups: { caja: [core, fan, dFace], mandos: [fanKnob, knobs.mode, knobs.temp], admision: [flap, rlever, gbox, lowIn] },
  };
}
