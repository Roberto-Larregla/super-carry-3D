// Calefacción y ventilación del SK410 (manual secc. 7 + fotos del tablero, los mandos y bajo la guantera).
// Caja de dos mitades al centro, del tablero al piso: arriba el ventilador de jaula (motor al lado conductor),
// abajo el radiador de calefacción; compuertas de salida; llave de agua por cable; caja de admisión con compuerta
// de recirculación bajo la guantera; rejillas de arriba (aire sin calentar), salidas a los pies y desempañador;
// el aire sale de la cabina por las rejillas del pilar central. Cotas internas y recorridos: aproximados.
import * as THREE from 'three';
import { onSide } from './body3d.js';
import { heatSolve, MODES, tempColor } from './heatersim.js';

const HC = new THREE.Vector3(0.47, 0.70, 0.0);
const X0 = 0.385, X1 = 0.555, Y0 = 0.49, ZW = 0.11;     // caja: atrás, adelante, base, medio ancho
const S = new THREE.Vector3(0.47, 0.83, 0.0), SR = 0.085; // centro y radio del caracol del ventilador
const ZC = -0.03;                                         // eje del centro del tablero

export function buildHeater(ctx, { hOut, wpIn }) {
  const { V, rbox, cylX, cylY, cylZ, tube, helix, add, group } = ctx;
  const root = ctx.world.root;
  ctx.setLevel('cal');
  const EXV = {
    calefactor: [0.35, 0.35, 0], calef_radiador: [0.32, 0.05, 0.28], calef_ventilador: [0.12, 0.12, -0.3], calef_resistencia: [0.25, 0, -0.3],
    calef_compuertas: [0.2, 0.3, -0.12], calef_llave: [0.2, -0.12, 0.15], calef_mando: [-0.15, 0.12, 0], calef_ductos: [0.05, 0.28, 0],
    calef_admision: [0.12, 0.2, 0.3], calef_mangueras: [0, -0.06, 0], calef_tubo: [-0.12, 0.05, -0.12], calef_extractor: [0, 0, 0],
  };
  const A = (part, geo, kind, o = {}) => add(part, geo, kind, { ex: 'ex' in o ? o.ex : EXV[part], ...o });
  const dyn = m => { m.userData.dyn = true; return m; };
  const planes = { case: new THREE.Plane(V(0, 1, 0), 1e4) };
  const H = { doors: {}, levers: {} };

  // ════════ CAJA (dos mitades de plástico negro, unidas con grapas; fotos) ════════
  const CASE = { cut: 'case', double: true };
  const side = (holeR) => {
    const s = new THREE.Shape(); s.moveTo(X0, Y0); s.lineTo(X1, Y0); s.lineTo(X1, S.y); s.absarc(S.x, S.y, SR, 0, Math.PI, false); s.lineTo(X0, Y0);
    const h = new THREE.Path(); h.absarc(S.x, S.y, holeR, 0, Math.PI * 2, true); s.holes.push(h);
    const g = new THREE.ExtrudeGeometry(s, { depth: 0.004, bevelEnabled: false, curveSegments: 28 }); g.translate(0, 0, -0.002); return g;
  };
  A('calefactor', side(0.043), 'plastic', { p: [0, 0, -ZW], ...CASE });     // mitad izquierda (lado conductor: motor)
  A('calefactor', side(0.052), 'plastic', { p: [0, 0, ZW], ...CASE });      // mitad derecha (entrada del aire)
  A('calefactor', rbox(0.004, S.y - Y0, 2 * ZW, 0.002), 'plastic', { p: [X1, (S.y + Y0) / 2, 0], ...CASE });
  A('calefactor', rbox(0.004, S.y - Y0, 2 * ZW, 0.002), 'plastic', { p: [X0, (S.y + Y0) / 2, 0], ...CASE });
  A('calefactor', rbox(X1 - X0, 0.004, 2 * ZW, 0.002), 'plastic', { p: [HC.x, Y0, 0], ...CASE });
  { const g = new THREE.CylinderGeometry(SR, SR, 2 * ZW, 44, 1, true, 0, Math.PI * 1.5 + 0.25); g.rotateX(Math.PI / 2);   // caracol con la garganta atrás-abajo
    A('calefactor', g, 'plastic', { p: S.toArray(), ...CASE }); }
  A('calefactor', rbox(X1 - X0 + 0.008, 0.006, 0.006, 0.002), 'dark', { p: [HC.x, 0.70, ZW + 0.003] });           // junta de las mitades
  for (const [x, y] of [[X0 + 0.004, 0.60], [X0 + 0.004, 0.76], [X1 - 0.004, 0.60], [HC.x, Y0 + 0.004]]) A('calefactor', rbox(0.012, 0.018, 0.02, 0.003), 'dark', { p: [x, y, 0] });   // grapas
  // collarines de las salidas
  A('calefactor', rbox(0.02, 0.05, 0.13, 0.006), 'plastic', { p: [X0 - 0.008, 0.765, 0] });                        // a las rejillas (atrás arriba)
  A('calefactor', rbox(0.02, 0.04, 0.11, 0.006), 'plastic', { p: [X1 + 0.008, 0.80, 0] });                         // al desempañador (adelante arriba)
  A('calefactor', rbox(0.06, 0.06, 0.02, 0.006), 'plastic', { p: [0.43, 0.56, ZW + 0.008] });                      // pies del acompañante
  A('calefactor', rbox(0.05, 0.05, 0.02, 0.006), 'plastic', { p: [0.525, 0.83, -ZW - 0.008] });                    // tubo blanco (lado conductor)

  // ════════ VENTILADOR: motor al lado conductor y rotor de jaula dentro del caracol (manual, piezas 5 y 6) ════════
  A('calef_ventilador', cylZ(0.05, 0.006, 32), 'steel', { p: [S.x, S.y, -ZW - 0.006] });
  A('calef_ventilador', cylZ(0.04, 0.07, 28), 'dark', { p: [S.x, S.y, -ZW - 0.045] });
  A('calef_ventilador', cylZ(0.03, 0.012, 20), 'steel', { p: [S.x, S.y, -ZW - 0.085] });
  A('calef_ventilador', cylZ(0.006, 0.02, 8), 'steel', { p: [S.x, S.y, -ZW - 0.095] });
  const fan = group('calef_ventilador', root, S.toArray(), EXV.calef_ventilador); H.fan = fan;
  A('calef_ventilador', cylZ(0.058, 0.004, 36), 'dark', { parent: fan, p: [0, 0, -0.085], ex: null });
  A('calef_ventilador', cylZ(0.012, 0.03, 12), 'steel', { parent: fan, p: [0, 0, -0.07], ex: null });
  A('calef_ventilador', new THREE.TorusGeometry(0.056, 0.0025, 6, 36), 'dark', { parent: fan, p: [0, 0, 0.03], ex: null });
  for (let k = 0; k < 28; k++) { const a = k / 28 * Math.PI * 2; A('calef_ventilador', rbox(0.012, 0.0022, 0.115, 0.0008), 'dark', { parent: fan, p: [Math.cos(a) * 0.052, Math.sin(a) * 0.052, -0.027], r: [0, 0, a + 0.55], ex: null }); }
  // resistencia de 3 velocidades, en el costado conductor de la caja (manual)
  const RZ = V(0.53, 0.68, -ZW - 0.012);
  A('calef_resistencia', rbox(0.045, 0.05, 0.006, 0.004), 'dark', { p: RZ.toArray() });
  A('calef_resistencia', rbox(0.034, 0.036, 0.004, 0.002), 'ceramic', { p: [RZ.x, RZ.y, RZ.z - 0.004] });
  const coil = dyn(A('calef_resistencia', helix(0.004, 0.03, 9, 0.0011).rotateZ(Math.PI / 2), 'copper', { p: [RZ.x, RZ.y + 0.006, RZ.z - 0.008], ex: null }));
  A('calef_resistencia', helix(0.004, 0.03, 9, 0.0011).rotateZ(Math.PI / 2), 'copper', { p: [RZ.x, RZ.y - 0.008, RZ.z - 0.008] });
  A('calef_resistencia', rbox(0.02, 0.016, 0.014, 0.003), 'plastic', { p: [RZ.x, RZ.y - 0.034, RZ.z] });          // conector
  A('calef_resistencia', tube([[RZ.x, RZ.y - 0.042, RZ.z], [RZ.x - 0.03, RZ.y - 0.05, RZ.z - 0.02], [S.x + 0.02, S.y - 0.02, -ZW - 0.06]], 0.0022), 'lead', { ex: null });
  H.coil = coil;

  // ════════ RADIADOR DE CALEFACCIÓN (manual, pieza 3) y tubos a la llave ════════
  const core = new THREE.Group(); core.position.set(0.462, 0.64, 0.0); core.rotation.z = 0.18; root.add(core);
  A('calef_radiador', rbox(0.11, 0.032, 0.19, 0.003), 'copper', { parent: core });
  for (let k = 0; k < 14; k++) A('calef_radiador', rbox(0.004, 0.034, 0.19, 0.0008), 'brass', { parent: core, p: [-0.05 + k * 0.0077, 0, 0] });
  for (const x of [-0.062, 0.062]) A('calef_radiador', rbox(0.016, 0.04, 0.2, 0.004), 'alu', { parent: core, p: [x, 0, 0] });   // tanques
  core.updateMatrixWorld(true);
  const tankF = core.localToWorld(V(0.062, -0.02, 0));
  const PIN = 0.075, POUT = 0.025, XP = 0.545;
  for (const z of [PIN, POUT]) A('calef_radiador', tube([[tankF.x, tankF.y, z], [XP, tankF.y - 0.03, z], [XP, 0.53, z], [XP, 0.44, z]], 0.0075), 'alu');
  for (const z of [PIN, POUT]) A('calef_radiador', cylY(0.013, 0.008, 16), 'rubber', { p: [XP, 0.452, z], ex: null });    // pasa-piso
  H.core = core;

  // ════════ LLAVE DE AGUA (en la entrada del radiador; la mueve la palanca COOL–HOT por cable) ════════
  const VP = V(XP, 0.505, PIN);
  A('calef_llave', rbox(0.03, 0.034, 0.03, 0.006), 'alu', { p: VP.toArray(), cut: 'xray' });
  A('calef_llave', cylX(0.009, 0.036, 12), 'alu', { p: VP.toArray(), cut: 'xray' });
  const plug = dyn(A('calef_llave', rbox(0.006, 0.026, 0.012, 0.002), 'brass', { p: VP.toArray(), ex: null }));
  const vlever = group('calef_llave', root, [VP.x + 0.017, VP.y, VP.z], EXV.calef_llave);
  A('calef_llave', rbox(0.004, 0.006, 0.04, 0.002), 'steel', { parent: vlever, p: [0, 0, 0.02], ex: null });
  H.plug = plug; H.vlever = vlever;

  // ════════ COMPUERTAS (salida a la cara / a los pies y al parabrisas) con su palanca al costado ════════
  const dFace = group('calef_compuertas', root, [X0 + 0.006, 0.735, 0], EXV.calef_compuertas);
  A('calef_compuertas', rbox(0.06, 0.004, 0.2, 0.002), 'steel', { parent: dFace, p: [0.03, 0, 0], ex: null });
  A('calef_compuertas', cylZ(0.004, 0.21, 8), 'steel', { parent: dFace, ex: null });
  const dDef = group('calef_compuertas', root, [X1 - 0.006, 0.57, 0], EXV.calef_compuertas);
  A('calef_compuertas', rbox(0.055, 0.004, 0.2, 0.002), 'steel', { parent: dDef, p: [-0.0275, 0, 0], ex: null });
  A('calef_compuertas', cylZ(0.004, 0.21, 8), 'steel', { parent: dDef, ex: null });
  const mlever = group('calef_compuertas', root, [0.43, 0.70, -ZW - 0.01], EXV.calef_compuertas);
  A('calef_compuertas', rbox(0.008, 0.07, 0.004, 0.002), 'steel', { parent: mlever, p: [0, 0.03, 0], ex: null });
  A('calef_compuertas', rbox(0.06, 0.006, 0.004, 0.002), 'steel', { p: [0.455, 0.735, -ZW - 0.012] });            // varilla a las compuertas
  H.doors = { face: dFace, def: dDef }; H.levers.mode = mlever;

  // ════════ ADMISIÓN: caja bajo la guantera con compuerta exterior/recirculación (fotos) ════════
  const IB = V(0.52, 0.80, 0.52);
  A('calef_admision', rbox(0.12, 0.14, 0.12, 0.02), 'plastic', { p: IB.toArray(), cut: 'xray', double: true });
  for (let k = 0; k < 5; k++) A('calef_admision', rbox(0.004, 0.006, 0.09, 0.002), 'dark', { p: [IB.x - 0.062, IB.y - 0.045 + k * 0.012, IB.z] });   // rejilla de recirculación
  const flap = group('calef_admision', root, [IB.x - 0.04, IB.y + 0.05, IB.z], EXV.calef_admision);
  A('calef_admision', rbox(0.08, 0.004, 0.1, 0.002), 'steel', { parent: flap, p: [0.04, 0, 0], ex: null });
  const rlever = group('calef_admision', root, [0.455, 0.86, 0.50], EXV.calef_admision);
  A('calef_admision', rbox(0.012, 0.09, 0.012, 0.003), 'steel', { parent: rlever, p: [0, -0.04, 0], ex: null });     // palanca metálica (foto)
  // toma de aire exterior: ducto hacia el frente, lado acompañante (posición aprox.; el despiece no trae filtro)
  const FRESH = V(0.625, 0.95, 0.47);
  A('calef_admision', tube([[IB.x + 0.04, IB.y + 0.06, IB.z - 0.01], [0.58, 0.90, 0.49], FRESH], 0.03, false, 30), 'plastic');
  A('calef_admision', rbox(0.006, 0.07, 0.07, 0.004), 'dark', { p: [FRESH.x + 0.004, FRESH.y, FRESH.z] });
  for (let k = 0; k < 5; k++) A('calef_admision', rbox(0.004, 0.004, 0.064, 0.001), 'steel', { p: [FRESH.x + 0.008, FRESH.y - 0.026 + k * 0.013, FRESH.z] });
  // ducto corrugado de la caja de admisión a la entrada del ventilador (foto bajo la guantera)
  const IN = V(S.x, S.y, ZW + 0.008);
  const corr = [IN, V(0.48, 0.85, 0.22), V(0.50, 0.85, 0.36), V(IB.x - 0.01, IB.y + 0.02, IB.z - 0.06)];
  A('calef_admision', tube(corr, 0.034, false, 48), 'rubber');
  { const cv = new THREE.CatmullRomCurve3(corr, false, 'catmullrom', 0.35);
    for (let k = 1; k < 16; k++) { const t = k / 16, p = cv.getPointAt(t), d = cv.getTangentAt(t); const m = A('calef_admision', new THREE.TorusGeometry(0.036, 0.004, 6, 18), 'dark', { p: p.toArray(), ex: null }); m.lookAt(p.clone().add(d)); } }
  H.flap = flap; H.levers.recirc = rlever;

  // ════════ DUCTOS Y SALIDAS ════════
  // rejillas del tablero (2 al centro, 1 en cada extremo): reciben aire que no pasa por el radiador
  const VENTS = [ZC - 0.114, ZC + 0.114, -0.585, 0.585];
  for (const z of VENTS) {
    A('calef_ductos', rbox(0.012, 0.064, 0.060, 0.008), 'dark', { p: [0.372, 1.047, z] });
    for (let k = 0; k < 4; k++) A('calef_ductos', rbox(0.014, 0.004, 0.052, 0.001), 'plastic', { p: [0.369, 1.027 + k * 0.013, z] });
  }
  const FP = V(X0 - 0.02, 0.765, 0);                                         // salida a la cara (atrás arriba)
  const MAN = V(0.41, 0.975, 0);
  A('calef_ductos', tube([FP, V(0.37, 0.84, 0), V(0.385, 0.93, 0), MAN], 0.03, false, 30), 'plastic');
  A('calef_ductos', rbox(0.05, 0.05, 1.12, 0.012), 'plastic', { p: [0.42, 0.985, 0] });                               // distribuidor bajo el tablero
  for (const z of VENTS) A('calef_ductos', tube([V(0.42, 0.99, z * 0.85), V(0.40, 1.03, z), V(0.385, 1.047, z)], 0.018), 'plastic');
  // desempañador: de la salida delantera a la base del parabrisas
  const DP = V(X1 + 0.02, 0.80, 0);
  for (const s of [1, -1]) {
    A('calef_ductos', tube([DP.clone().add(V(0, 0, s * 0.03)), V(0.575, 0.92, s * 0.08), V(0.56, 1.04, s * 0.24), V(0.55, 1.105, s * 0.36)], 0.02), 'plastic');
    A('calef_ductos', rbox(0.07, 0.006, 0.24, 0.004), 'dark', { p: [0.545, 1.126, s * 0.36] });
    for (let k = 0; k < 5; k++) A('calef_ductos', rbox(0.06, 0.004, 0.006, 0.001), 'plastic', { p: [0.545, 1.13, s * 0.36 - 0.08 + k * 0.04] });
  }
  // pies del acompañante: ducto curvo que baja al piso (foto)
  const PF = V(0.40, 0.50, 0.26);
  A('calef_ductos', tube([V(0.43, 0.56, ZW + 0.015), V(0.43, 0.55, 0.17), V(0.41, 0.52, 0.23), PF], 0.034), 'plastic');
  // pies del conductor: tubo blanco desde el costado izquierdo de la caja hasta el codo negro en el piso (fotos y dueño)
  const WT0 = V(0.525, 0.83, -ZW - 0.016), WT1 = V(0.48, 0.93, -0.16), WTB = V(0.33, 0.50, -0.085), ELB = V(0.31, 0.47, -0.08);
  A('calef_tubo', tube([WT0, V(0.52, 0.87, -0.14), WT1.clone().add(V(0.02, 0, 0))], 0.026), 'rubber');
  A('calef_tubo', tube([WT1, V(0.42, 0.74, -0.13), V(0.35, 0.56, -0.095), WTB], 0.034), 'white');
  A('calef_tubo', tube([WTB, V(0.315, 0.475, -0.083), V(0.27, 0.47, -0.10)], 0.04), 'rubber');
  A('calef_tubo', cylX(0.044, 0.012, 20), 'dark', { p: [0.265, 0.47, -0.10] });

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
  // cables: modo → palanca de las compuertas; recirculación → caja de admisión; temperatura → llave de agua
  for (const [dy, dz, to] of [[SL.mode, -0.05, V(0.43, 0.75, -ZW - 0.012)], [SL.air, -0.03, V(0.455, 0.90, 0.50)], [SL.temp, -0.01, V(VP.x + 0.02, VP.y + 0.02, VP.z + 0.03)]])
    A('calef_mando', tube([V(CM.x + 0.01, CM.y + dy, CM.z + dz), V(CM.x + 0.05, CM.y - 0.05, CM.z + dz + 0.04), to.clone().add(V(-0.03, 0.06, 0)), to], 0.0025), 'dark');

  // ════════ MANGUERAS: agua caliente del múltiple de admisión → llave → radiador → vuelve a la bomba ════════
  const hin = V(XP, 0.44, PIN), hrt = V(XP, 0.44, POUT);
  const HIN = [hOut, V(hOut.x + 0.1, hOut.y + 0.06, hOut.z - 0.1), V(-0.12, 0.66, -0.2), V(0.08, 0.60, -0.18), V(0.22, 0.42, -0.06), V(0.40, 0.40, 0.08), V(hin.x - 0.01, 0.41, hin.z), hin];
  const HRT = [hrt, V(hrt.x - 0.02, 0.40, hrt.z), V(0.3, 0.39, 0.03), V(0.08, 0.3, 0.05), V(0.04, 0.17, 0.0), V(-0.14, 0.17, -0.05), V(wpIn.x + 0.03, wpIn.y - 0.03, wpIn.z + 0.01), wpIn];
  A('calef_mangueras', tube(HIN, 0.009, false, 90), 'hose', { press: 'hin' });
  A('calef_mangueras', tube(HRT, 0.009, false, 90), 'hose', { press: 'hout' });

  // ════════ SALIDA DEL AIRE DE LA CABINA: rejillas del pilar central (fotos) ════════
  for (const s of [1, -1]) {
    const c = onSide(-0.479, 1.50, s, 0.012);
    for (let k = 0; k < 6; k++) A('calef_extractor', rbox(0.066, 0.006, 0.006, 0.0015), 'dark', { p: [c.x, c.y - 0.04 + k * 0.016, c.z], noAnchor: s > 0 });
    A('calef_extractor', rbox(0.07, 0.1, 0.012, 0.004), 'trim', { p: [c.x, c.y, c.z - s * 0.012], op: 0.5, noAnchor: s > 0 });
  }

  // ════════ FLUJOS ANIMADOS (aire y agua): partículas sobre recorridos ════════
  const curve = pts => new THREE.CatmullRomCurve3(pts.map(p => (p.isVector3 ? p : V(...p))), false, 'catmullrom', 0.3);
  const throat = V(0.40, 0.745, 0);
  const AIR = {
    exterior: curve([[0.70, 0.98, 0.46], FRESH, [0.58, 0.90, 0.49], IB]),
    recirc:   curve([[0.30, 0.64, 0.50], [0.40, 0.72, 0.52], [IB.x - 0.065, IB.y - 0.02, IB.z], IB]),
    ducto:    curve([IB, [IB.x - 0.01, IB.y + 0.02, IB.z - 0.06], [0.50, 0.85, 0.36], [0.48, 0.85, 0.22], IN, [S.x, S.y, 0.02], [S.x + 0.04, S.y + 0.05, 0], [S.x, S.y + 0.075, 0], [S.x - 0.065, S.y + 0.02, 0], throat]),
    nucleo:   curve([throat, [0.43, 0.70, 0], [0.46, 0.66, 0], [0.47, 0.60, 0], [0.47, 0.54, 0]]),
  };
  const toVent = z => curve([throat, FP, [0.37, 0.84, 0], [0.385, 0.93, 0], MAN, [0.42, 0.99, z * 0.85], [0.40, 1.03, z], [0.37, 1.047, z], [0.22, 1.05, z]]);
  VENTS.forEach((z, i) => { AIR['cara' + i] = toVent(z); });
  AIR.piesD = curve([[0.47, 0.54, 0], [0.45, 0.56, 0.08], [0.43, 0.56, ZW + 0.015], [0.43, 0.55, 0.17], [0.41, 0.52, 0.23], PF, [0.30, 0.47, 0.32]]);
  AIR.piesI = curve([[0.47, 0.54, 0], [0.50, 0.62, -0.07], [0.525, 0.80, -0.09], WT0, [0.52, 0.87, -0.14], WT1, [0.42, 0.74, -0.13], [0.35, 0.56, -0.095], WTB, [0.27, 0.47, -0.10], [0.17, 0.47, -0.16]]);
  for (const s of [1, -1]) AIR['vidrio' + (s > 0 ? 'D' : 'I')] = curve([[0.47, 0.54, 0], [0.54, 0.58, 0], [0.54, 0.72, 0], DP.clone().add(V(0, 0, s * 0.03)), [0.575, 0.92, s * 0.08], [0.56, 1.04, s * 0.24], [0.55, 1.12, s * 0.36], [0.47, 1.26, s * 0.36]]);
  for (const s of [1, -1]) { const c = onSide(-0.479, 1.50, s, 0.012); AIR['salida' + (s > 0 ? 'D' : 'I')] = curve([[0.0, 1.15, s * 0.3], [-0.35, 1.38, s * 0.52], [c.x, c.y, c.z - s * 0.03], [c.x, c.y, c.z + s * 0.08]]); }
  const WATER = { ida: curve(HIN), rad: curve([hin, VP, [XP, 0.53, PIN], [XP, tankF.y - 0.03, PIN], [tankF.x, tankF.y, PIN], [0.40, 0.63, 0.04], [tankF.x, tankF.y, POUT], [XP, tankF.y - 0.03, POUT], [XP, 0.53, POUT], hrt]), vuelta: curve(HRT) };

  const P = [];   // { curve, len, n, kind, key, idx0 }
  let total = 0;
  const addPath = (key, cv, kind, spacing) => { const len = cv.getLength(), n = Math.max(3, Math.round(len / spacing)); P.push({ key, cv, len, n, kind, i0: total }); total += n; };
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
  for (const p of P) { if (p.kind === 'air') { p.j0 = nAir; nAir += p.n; } else { p.j0 = nWat; nWat += p.n; } }
  const small = window.innerWidth < 900;
  const ptsAir = mkPoints(nAir, small ? 4.5 : 6.5), ptsWat = mkPoints(nWat, small ? 3.6 : 5);
  const col = new THREE.Color(), pos = new THREE.Vector3();

  ctx.setLevel('van');

  // ════════ estado, pose y animación ════════
  const st = { mode: 'pies', recirc: true, temp: 1, fan: 2, engine: 'caliente', fail: 'ok', on: false, cut: false, showAir: true, showWater: true, t: 0, fanA: 0, last: null };
  const KPOS = { mode: { cara: 0.05, bi: 0.32, pies: 0.64, vidrio: 0.9 } };
  function pose(r) {
    // mandos
    const zk = k => CM.z - 0.063 + k * 0.086;
    knobs.mode.position.z = zk(KPOS.mode[st.mode]);
    knobs.air.position.z = zk(st.recirc ? 0.04 : 0.92);
    knobs.temp.position.z = zk(0.04 + 0.9 * st.temp);
    fanKnob.rotation.x = [-1.1, -0.35, 0.3, 0.95][st.fan];
    // compuertas: cara (cierra el paso al radiador) · pies/parabrisas (tapa la salida de arriba)
    const M = MODES[st.mode];
    dFace.rotation.z = M.core === 0 ? -0.75 : M.core === 1 ? 1.25 : 0.25;
    dDef.rotation.z = st.mode === 'vidrio' ? 0.75 : st.mode === 'pies' ? -1.1 : -1.3;
    mlever.rotation.z = (KPOS.mode[st.mode] - 0.5) * 1.2;
    flap.rotation.z = st.recirc ? -0.15 : -1.35;
    rlever.rotation.x = st.recirc ? -0.25 : 0.35;
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
    w.piesD = on ? f.pies * 0.55 : 0; w.piesI = on ? f.pies * 0.45 : 0;
    w.vidrioD = w.vidrioI = on ? f.vidrio * 0.6 : 0;
    w.salidaD = w.salidaI = r.exhaust ? Q * 0.7 : 0;
    w.ida = w.rad = w.vuelta = r.waterFlow;
    return w;
  }
  function tempAt(key, u, r) {
    if (key === 'ida') return r.Tw;
    if (key === 'vuelta') return r.Tret;
    if (key === 'rad') return u < 0.45 ? r.Tw : r.Tw + (r.Tret - r.Tw) * Math.min(1, (u - 0.45) / 0.3);
    if (key === 'exterior') return 10;
    if (key === 'recirc' || key === 'salidaD' || key === 'salidaI') return 16;
    if (key === 'ducto' || key.startsWith('cara')) return r.Tin;
    if (key === 'nucleo') return u < 0.55 ? r.Tin : r.Tin + (r.Thot - r.Tin) * Math.min(1, (u - 0.55) / 0.3);
    return r.Thot;
  }
  function animate(dt) {
    const r = st.last; if (!r) return;
    st.t += Math.max(0, dt);
    const w = PATHW(r);
    for (const p of P) {
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
    const r = heatSolve(st); st.last = r; pose(r); return r;
  }
  function setCuts(on) {
    st.cut = on;
    if (on) planes.case.set(V(0, 0, 1), 0.004); else planes.case.set(V(0, 1, 0), 1e4);
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
    groups: { caja: [core, fan, dFace], mandos: [fanKnob, knobs.mode, knobs.temp], admision: [flap, rlever] },
  };
}
