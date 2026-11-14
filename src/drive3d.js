// Tren motriz del SK410 en detalle (manual secc. 11 a 15): embrague de diafragma con su collarín y horquilla, caja de 5 marchas
// con los dientes reales de cada par, sincronizadores, horquillas y selector, palanca con sus dos cables, cardán con crucetas
// y puente trasero con piñón y corona hipoides, satélites, planetarios y palieres.
// Del manual: el orden de los engranajes en los ejes, sus dientes y relaciones, los tres sincronizadores (baja, alta y 5.ª-R),
// el mando por dos cables, el cardán de una pieza con yugo deslizante y brida, y el diferencial hipoide en portador desmontable.
// Aproximado: las cotas (entre ejes, anchos, carcasas), el mecanismo del selector por dentro y la posición del puente.
import * as THREE from 'three';
import { WB, RW, TILT, ENG } from './geom.js';
import { gearShape, discX } from './engine3d.js';
import { DK, FINALR, PRIM, gearRatio, clutchLift, clutchCap, driveStep } from './drivesim.js';

const CD = 0.057, D = 0.0078, S = 0.045;      // entre ejes de la caja · carrera de los manguitos · el giro se muestra al 4,5 % de la velocidad real
const SEL = { N: 0, 1: -1, 2: -1, 3: 0, 4: 0, 5: 1, R: 1 }, SHF = { N: 0, 1: 1, 3: 1, 5: 1, 2: -1, 4: -1, R: -1 };   // rejilla en H: 1-3-5 arriba, 2-4-R abajo
const GATE = { '-1,1': 1, '-1,-1': 2, '0,1': 3, '0,-1': 4, '1,1': 5, '1,-1': 'R' };
const RAD = Math.PI / 30;
const X = { in: -0.566, hi: -0.589, g3: -0.612, g2: -0.632, lo: -0.655, g1: -0.678, wallF: -0.541, wallC: -0.698, gR: -0.716, r5: -0.739, g5: -0.762, wallR: -0.782, spd: -0.82, yoke: -0.985, sel: -0.622 };

const latheX = (pf, seg = 36) => new THREE.LatheGeometry(pf.map(([r, a]) => new THREE.Vector2(r, a)), seg).rotateZ(-Math.PI / 2);
const latheZ = (pf, seg = 36) => new THREE.LatheGeometry(pf.map(([r, a]) => new THREE.Vector2(r, a)), seg).rotateX(Math.PI / 2);
const spur = (rp, n, w, hole = 0.0105) => discX(gearShape(rp + 0.0011, n, 0.0026, hole), w, 10);
// engranaje cónico: perfil [radio, eje] girado alrededor de y; los tramos de «face» llevan dientes (desplazados a lo largo del eje o del radio)
function bevelGeo(prof, teeth, face, depth, mode = 'a', twist = 0) {
  const n = teeth * 2, m = prof.length, pos = [], idx = [];
  for (let j = 0; j <= n; j++) for (let i = 0; i < m; i++) {
    const f = face.includes(i), d = f ? (j % 2 ? depth : -depth) : 0, [r, a] = prof[i];
    const ang = j / n * Math.PI * 2 + (f ? twist * (i - face[0]) : 0), rr = r + (mode === 'r' ? d : 0);
    pos.push(Math.cos(ang) * rr, a + (mode === 'a' ? d : 0), Math.sin(ang) * rr);
  }
  for (let j = 0; j < n; j++) for (let i = 0; i < m - 1; i++) { const p = j * m + i, q = p + m; idx.push(p, q, p + 1, q, q + 1, p + 1); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals(); return g;
}

export function buildDrive(ctx, { eng, E, relS }) {
  const { V, rbox, cylX, cylY, cylZ, tube, add, group, reg } = ctx;
  const root = ctx.world.root;
  const dyn = m => { m.userData.dyn = true; return m; };
  const planes = { tcase: new THREE.Plane(V(0, 1, 0), 1e4), tdiff: new THREE.Plane(V(0, 1, 0), 1e4) };
  const EXV = { embrague: [-0.16, 0, 0], caja: [-0.3, 0, 0], cardan: [0, -0.16, 0], diferencial: [-0.28, 0, 0], palanca: [0.25, 0.3, 0] };
  const CASE = { cut: 'tcase', double: true, casing: true };
  const K = (part, geo, kind, o = {}) => add(part, geo, kind, { ex: null, ...o });
  const sub = (parent, p = [0, 0, 0]) => { const g = new THREE.Group(); g.position.set(...p); parent.add(g); return g; };
  ctx.setLevel('tra');

  // ════════ EMBRAGUE (marco del motor; la prensa gira con el volante) ════════
  const XF = -0.403;                                                        // cara del volante donde apoya el disco
  const clG = group('embrague', eng, [0, 0, 0], EXV.embrague);
  const clSpin = sub(clG); E.A.spin.push({ g: clSpin, k: 1 });
  K('embrague', latheX([[0.12, XF - 0.001], [0.12, XF - 0.007], [0.108, XF - 0.012], [0.102, XF - 0.036], [0.064, XF - 0.043], [0.05, XF - 0.04]], 44), 'cast', { parent: clSpin, ...CASE });   // cubierta
  for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2; K('embrague', cylX(0.0045, 0.007, 6), 'chrome', { parent: clSpin, p: [XF - 0.009, Math.cos(a) * 0.114, Math.sin(a) * 0.114], cut: 'tcase' }); }
  const pp = sub(clSpin);                                                   // plato de presión
  dyn(K('embrague', latheX([[0.062, XF - 0.0085], [0.092, XF - 0.0085], [0.092, XF - 0.02], [0.081, XF - 0.025], [0.07, XF - 0.025], [0.062, XF - 0.02], [0.062, XF - 0.0085]], 44), 'brushed', { parent: pp, cut: 'tcase', double: true, press: 'p_cl' }));
  const dia = sub(clSpin, [XF - 0.027, 0, 0]);                              // resorte de diafragma: anillo con dedos hacia el centro
  dyn(K('embrague', bevelGeo([[0.088, 0], [0.07, -0.0045], [0.024, -0.016]], 18, [1, 2], 0.0011).rotateZ(-Math.PI / 2), 'spring', { parent: dia, cut: 'tcase', double: true }));
  // collarín (tope de desembrague) sobre la guía de la caja, y horquilla con su eje atravesado en la campana
  const RB0 = XF - 0.043 - DK.gap - 0.008;
  const rb = sub(clG, [RB0, 0, 0]);
  dyn(K('emb_collarin', latheX([[0.0172, -0.006], [0.03, -0.006], [0.03, 0.004], [0.0245, 0.008], [0.0172, 0.008], [0.0172, -0.006]], 28), 'machined', { parent: rb }));
  dyn(K('emb_collarin', latheX([[0.0172, -0.02], [0.022, -0.02], [0.022, -0.006], [0.0172, -0.006]], 20), 'steel', { parent: rb }));
  // ════════ CAJA DE CAMBIOS (ejes del furgón: la caja va derecha aunque el motor esté inclinado; contraeje abajo) ════════
  const gb = group('caja', eng, [0, 0, 0], EXV.caja); gb.rotation.x = -TILT;
  const G = (part, geo, kind, o = {}) => K(part, geo, kind, { parent: gb, ...o });
  G('caja', latheX([[0.152, -0.404], [0.152, -0.43], [0.108, -0.5], [0.086, -0.538]], 44), 'alu', CASE);                       // campana
  G('caja', rbox(0.253, 0.176, 0.122, 0.02), 'alu', { p: [-0.6635, -0.015, 0], ...CASE });                                   // carcasa
  for (const x of [X.wallF, X.wallC, X.wallR]) G('caja', rbox(0.007, 0.166, 0.114, 0.002), 'alu', { p: [x, -0.015, 0], cut: 'tcase' });   // paredes con los rodamientos
  G('caja', rbox(0.1, 0.052, 0.104, 0.012), 'alu', { p: [X.sel, 0.092, 0.01], ...CASE });                                    // caja del selector, arriba
  G('caja', latheX([[0.054, -0.79], [0.052, -0.845], [0.034, -0.88], [0.032, -0.932]], 28), 'alu', CASE);                     // extensión trasera
  G('caja', latheX([[0.0165, -0.45], [0.0165, -0.54]], 20), 'alu', { cut: 'tcase', double: true });                           // guía del collarín
  G('caja', cylX(0.034, 0.008, 20), 'rubber', { p: [-0.934, 0, 0], cut: 'tcase' });                                           // retén de salida
  G('caja', cylZ(0.011, 0.008, 6), 'chrome', { p: [-0.66, -0.035, 0.064] });                                                  // tapón de llenado y nivel
  G('caja', cylY(0.011, 0.008, 6), 'chrome', { p: [-0.67, -0.106, 0] });                                                      // tapón de vaciado
  G('caja', rbox(0.245, 0.06, 0.114, 0.008), 'oil', { p: [-0.6635, -0.07, 0], op: 0.34, cut: 'tcase', double: true, pick: false });   // aceite: 1,3 L
  for (const [x, y, r] of [[X.wallF, 0, 0.024], [X.wallC, 0, 0.024], [X.wallR, 0, 0.022], [X.wallF, -CD, 0.02], [X.wallC, -CD, 0.02], [X.wallR, -CD, 0.019]]) G('caja', cylX(r, 0.011, 20), 'machined', { p: [x, y, 0] });

  const fork = sub(gb, [relS[0], relS[1], 0]);
  dyn(K('emb_collarin', cylZ(0.007, 0.2, 12), 'machined', { parent: fork, p: [0, 0, -0.04] }));
  for (const z of [-0.026, 0.026]) dyn(K('emb_collarin', rbox(0.006, relS[1] + 0.004, 0.007, 0.002), 'cast', { parent: fork, p: [0, -relS[1] / 2, z] }));
  dyn(K('emb_collarin', rbox(0.007, 0.016, 0.06, 0.002), 'cast', { parent: fork, p: [0, -0.012, 0] }));
  const gIn = sub(gb), gC = sub(gb, [0, -CD, 0]), gOut = sub(gb);
  const pr = (nc, nm) => [CD * nc / (nc + nm), CD * nm / (nc + nm)];
  const dogGeo = discX(gearShape(0.0212, 26, 0.0018, 0.0105), 0.0055, 8);
  // eje de entrada: gira con el disco de embrague y lleva el engranaje de mando (23 dientes)
  const [rIn, rCd] = pr(DK.prim[0], DK.prim[1]);
  K('caja_primario', cylX(0.0098, 0.196, 16), 'bar', { parent: gIn, p: [-0.482, 0, 0], press: 'p_in' });
  K('caja_primario', discX(gearShape(0.0112, 18, 0.0013), 0.04, 6), 'bar', { parent: gIn, p: [XF - 0.014, 0, 0], press: 'p_in' });   // estrías del disco
  K('caja_primario', spur(rIn, DK.prim[0], 0.015), 'bar', { parent: gIn, p: [X.in, 0, 0], press: 'p_in' });
  K('caja_primario', dogGeo, 'bar', { parent: gIn, p: [X.in - 0.0112, 0, 0], press: 'p_in' });
  // disco de embrague: forros, alma de acero, cubo estriado y 4 amortiguadores de goma (manual)
  const disc = sub(gIn);
  for (const dx of [-0.0018, -0.0067]) dyn(K('emb_disco', latheX([[0.062, dx + 0.0016], [0.09, dx + 0.0016], [0.09, dx - 0.0016], [0.062, dx - 0.0016], [0.062, dx + 0.0016]], 44), 'copper', { parent: disc, p: [XF, 0, 0], press: 'p_cl' }));
  dyn(K('emb_disco', latheX([[0.02, -0.0036], [0.088, -0.0036], [0.088, -0.0049], [0.02, -0.0049]], 44), 'steel', { parent: disc, p: [XF, 0, 0], press: 'p_cl' }));
  dyn(K('emb_disco', discX(gearShape(0.021, 18, 0.0012, 0.0112), 0.03, 8), 'machined', { parent: disc, p: [XF - 0.012, 0, 0], press: 'p_cl' }));
  for (let k = 0; k < 4; k++) { const a = k / 4 * Math.PI * 2 + 0.6; dyn(K('emb_disco', cylX(0.008, 0.012, 12), 'rubber', { parent: disc, p: [XF - 0.0045, Math.cos(a) * 0.04, Math.sin(a) * 0.04] })); }
  // contraeje (tren fijo): siempre engranado con el eje de entrada
  const CX = [[X.in, rCd, DK.prim[1]], [X.g3, pr(...DK.pair[3])[0], 31], [X.g2, pr(...DK.pair[2])[0], 25], [X.g1, pr(...DK.pair[1])[0], 15], [X.gR, 0.01485, 18], [X.g5, pr(...DK.pair[5])[0], 44]];
  K('caja_intermediario', cylX(0.0115, 0.258, 16), 'steel', { parent: gC, p: [-0.6625, 0, 0], press: 'p_c' });
  for (const [x, r, n] of CX) K('caja_intermediario', spur(r, n, x < X.wallC ? 0.014 : 0.015, 0.011), 'steel', { parent: gC, p: [x, 0, 0], press: 'p_c' });
  // eje principal (salida) con los engranajes locos de 3.ª, 2.ª, 1.ª, marcha atrás y 5.ª
  K('caja_secundario', cylX(0.0105, 0.377, 16), 'bar', { parent: gOut, p: [-0.7665, 0, 0], press: 'p_out' });
  K('caja_secundario', discX(gearShape(0.016, 8, 0.003, 0.0105), 0.016, 8), 'brass', { parent: gOut, p: [X.spd, 0, 0] });      // sinfín del velocímetro
  K('caja_secundario', discX(gearShape(0.0118, 20, 0.0012), 0.07, 6), 'bar', { parent: gOut, p: [-0.905, 0, 0], press: 'p_out' });
  const FREE = {};
  for (const [key, x, side] of [[3, X.g3, 1], [2, X.g2, -1], [1, X.g1, 1], ['R', X.gR, -1], [5, X.g5, 1]]) {
    const g = sub(gb, [x, 0, 0]), [nc, nm] = DK.pair[key], rp = key === 'R' ? 0.0338 : pr(nc, nm)[1];
    K('caja_secundario', spur(rp, nm, x < X.wallC ? 0.014 : 0.015), 'machined', { parent: g, press: 'p_' + key });
    K('caja_secundario', dogGeo, 'machined', { parent: g, p: [side * 0.0112, 0, 0], press: 'p_' + key });
    FREE[key] = { g, k: nc / nm / PRIM * (key === 'R' ? -1 : 1) };
  }
  // piñón loco de marcha atrás: entre el contraeje y el eje principal, invierte el giro
  const IY = -0.0421, IZ = -0.0276;
  const idler = sub(gb, [X.gR, IY, IZ]);
  K('caja_retro', spur(0.0165, DK.idler, 0.014, 0.006), 'machined', { parent: idler, press: 'p_R' });
  G('caja_retro', cylX(0.006, 0.036, 10), 'bar', { p: [X.gR, IY, IZ] });
  // sincronizadores: cubo estriado al eje, anillos de bronce y manguito que se corre hasta los dientes del engranaje
  const HUBS = [X.lo, X.hi, X.r5], sleeves = [];
  HUBS.forEach((x, k) => {
    K('caja_sincros', discX(gearShape(0.0222, 24, 0.0014, 0.0105), 0.013, 8), 'steel', { parent: gOut, p: [x, 0, 0], press: 'p_s' + k });
    for (const s of [-1, 1]) K('caja_sincros', discX(gearShape(0.0226, 26, 0.0016, 0.0185), 0.0028, 8), 'brass', { parent: gOut, p: [x + s * 0.0085, 0, 0] });
    const sl = sub(gOut, [x, 0, 0]);
    dyn(K('caja_sincros', latheX([[0.0228, -0.0075], [0.0305, -0.0075], [0.0305, -0.003], [0.027, -0.003], [0.027, 0.003], [0.0305, 0.003], [0.0305, 0.0075], [0.0228, 0.0075], [0.0228, -0.0075]], 32), 'chrome', { parent: sl, press: 'p_s' + k }));
    sleeves.push(sl);
  });
  // ejes selectores con sus horquillas (1.ª-2.ª, 3.ª-4.ª y 5.ª-R)
  const YR = 0.062, ZR = [-0.016, 0, 0.016], rods = [];
  const arcGeo = new THREE.TorusGeometry(0.02875, 0.0028, 6, 20, Math.PI).rotateY(Math.PI / 2);
  HUBS.forEach((x, k) => {
    const rg = sub(gb); rods.push(rg);
    const R = (geo, kind, p) => dyn(K('caja_horquillas', geo, kind, { parent: rg, p }));
    R(cylX(0.005, 0.236, 10), 'bar', [-0.664, YR, ZR[k]]);
    for (const s of [-1, 1]) R(rbox(0.006, 0.016, 0.011, 0.0015), 'iron', [X.sel + s * 0.0088, YR + 0.008, ZR[k]]);       // muesca donde entra el dedo selector
    R(arcGeo, 'iron', [x, 0, 0]);
    R(tube([[x, 0.031, 0], [x, 0.047, ZR[k] * 0.7], [x, YR, ZR[k]]], 0.0036, false, 10), 'iron', [0, 0, 0]);
  });
  // selector: un eje atravesado que se corre (selección) y gira (cambio); afuera, sus dos palancas con los cables
  const YS = 0.092, selG = sub(gb, [X.sel, YS, 0]);
  dyn(K('caja_horquillas', cylZ(0.0055, 0.19, 10), 'machined', { parent: selG, p: [0, 0, 0.035] }));
  dyn(K('caja_horquillas', rbox(0.0075, 0.03, 0.0075, 0.002), 'iron', { parent: selG, p: [0, -0.013, 0] }));              // dedo selector
  dyn(K('palanca', rbox(0.008, 0.052, 0.006, 0.002), 'steel', { parent: selG, p: [0, 0.022, 0.105] }));                    // palanca del eje de cambio
  dyn(K('palanca', cylZ(0.004, 0.014, 8), 'machined', { parent: selG, p: [0, 0.045, 0.105] }));
  G('caja', cylZ(0.012, 0.02, 12), 'rubber', { p: [X.sel, YS, 0.07] });                                                    // fuelle del eje
  const CRP = [X.sel + 0.03, YS, 0.13], selCr = sub(gb, CRP);                                                              // palanca de selección: escuadra que empuja el eje
  dyn(K('palanca', rbox(0.034, 0.006, 0.008, 0.002), 'steel', { parent: selCr, p: [-0.015, 0, 0] }));
  dyn(K('palanca', rbox(0.008, 0.006, 0.034, 0.002), 'steel', { parent: selCr, p: [0, 0, 0.015] }));
  dyn(K('palanca', cylY(0.005, 0.022, 8), 'machined', { parent: selCr }));
  G('palanca', rbox(0.05, 0.005, 0.03, 0.002), 'steel', { p: [CRP[0] - 0.01, YS - 0.012, 0.115] });                         // soporte de la escuadra
  const BS = V(X.sel + 0.092, YS + 0.045, 0.105), BQ = V(CRP[0] + 0.092, YS, 0.16);                                        // finales de funda de los dos cables
  G('palanca', rbox(0.006, 0.07, 0.02, 0.002), 'steel', { p: [BS.x, YS + 0.02, BS.z] });
  G('palanca', rbox(0.006, 0.02, 0.085, 0.002), 'steel', { p: [BQ.x, YS, 0.125] });
  for (const b of [BS, BQ]) G('palanca', cylX(0.007, 0.022, 10), 'brass', { p: [b.x + 0.006, b.y, b.z] });
  const wSh = dyn(G('palanca', cylY(0.0015, 1, 6), 'machined')), wSe = dyn(G('palanca', cylY(0.0015, 1, 6), 'machined'));
  // yugo deslizante: estriado sobre la salida de la caja, se corre cuando la suspensión trabaja
  K('cardan', cylX(0.019, 0.09, 18), 'steel', { parent: gOut, p: [-0.912, 0, 0], press: 'p_prop' });
  K('cardan', cylX(0.03, 0.01, 18), 'steel', { parent: gOut, p: [X.yoke + 0.03, 0, 0], press: 'p_prop' });
  for (const s of [-1, 1]) K('cardan', rbox(0.042, 0.03, 0.01, 0.003), 'steel', { parent: gOut, p: [X.yoke + 0.006, 0, s * 0.031], press: 'p_prop' });
  eng.updateMatrixWorld(true);

  // ════════ PALANCA Y CABLES (cabina) ════════
  const LP = V(0.235, 0.46, -0.03);
  const lever = group('palanca', root, LP.toArray(), EXV.palanca);
  dyn(K('palanca', tube([[0, 0, 0], [-0.01, 0.24, 0.01], [-0.035, 0.44, 0.01]], 0.009), 'steel', { parent: lever }));       // sale del piso frente a la caja de la calefacción (foto)
  { const m = dyn(K('palanca', new THREE.CapsuleGeometry(0.017, 0.085, 6, 14), 'dark', { parent: lever, p: [-0.041, 0.495, 0.01] })); m.rotation.z = 0.12; }   // empuñadura larga de goma (foto)
  dyn(K('palanca', cylY(0.006, 0.05, 8), 'steel', { parent: lever, p: [0, -0.025, 0] }));
  add('palanca', new THREE.ConeGeometry(0.045, 0.06, 16), 'rubber', { p: [LP.x, 0.485, LP.z], ex: EXV.palanca });           // fuelle
  add('palanca', rbox(0.1, 0.05, 0.08, 0.01), 'dark', { p: [LP.x, 0.43, LP.z], ex: EXV.palanca });                          // caja de la palanca
  [BS, BQ].forEach((b, k) => { const w = gb.localToWorld(b.clone().add(V(0.017, 0, 0)));                                    // fundas: por la derecha del radiador y sobre la caja (recorrido aprox.)
    add('palanca', tube([[0.2 - k * 0.03, 0.42, k * 0.03], [0.14, 0.395 - k * 0.01, 0.2 + k * 0.02], [0.0, 0.385 - k * 0.01, 0.275 + k * 0.02], [-0.3, 0.41, 0.24 + k * 0.02], [w.x + 0.12, w.y + 0.012, w.z + 0.03], w], 0.005, false, 80), 'dark', { ex: EXV.palanca }); });

  // ════════ CARDÁN: tubo con dos crucetas ════════
  const J1 = gb.localToWorld(V(X.yoke, 0, 0)), YP = -0.018, J2 = V(-WB + 0.25, RW + YP, 0), PL = J1.distanceTo(J2);
  const propG = new THREE.Group(); propG.position.copy(J1); propG.lookAt(J2); root.add(propG); reg(propG, 'cardan', EXV.cardan);
  const prop = sub(propG);
  K('cardan', cylZ(0.0265, PL - 0.11, 20), 'steel', { parent: prop, p: [0, 0, PL / 2], press: 'p_prop' });
  for (const z of [0.045, PL - 0.045]) K('cardan', cylZ(0.021, 0.022, 16), 'steel', { parent: prop, p: [0, 0, z], press: 'p_prop' });
  for (const z of [0.008, PL - 0.008]) for (const s of [-1, 1]) K('cardan', rbox(0.03, 0.01, 0.046, 0.003), 'steel', { parent: prop, p: [0, s * 0.031, z + (z < 0.1 ? 0.012 : -0.012)], press: 'p_prop' });
  for (const z of [0, PL]) {
    K('cardan_crucetas', cylY(0.008, 0.07, 10), 'machined', { parent: prop, p: [0, 0, z] });
    K('cardan_crucetas', cylX(0.008, 0.07, 10), 'machined', { parent: prop, p: [0, 0, z] });
    K('cardan_crucetas', new THREE.SphereGeometry(0.0135, 12, 10), 'machined', { parent: prop, p: [0, 0, z] });
    for (const s of [-1, 1]) { K('cardan_crucetas', cylY(0.0115, 0.012, 12), 'bar', { parent: prop, p: [0, s * 0.034, z] }); K('cardan_crucetas', cylX(0.0115, 0.012, 12), 'bar', { parent: prop, p: [s * 0.034, 0, z] }); }
  }

  // ════════ PUENTE TRASERO: carcasa, portador, piñón y corona, satélites, planetarios y palieres ════════
  const axG = group('diferencial', root, [-WB, RW, 0], EXV.diferencial);
  const DC = { cut: 'tdiff', double: true, casing: true };
  const Xd = (part, geo, kind, o = {}) => K(part, geo, kind, { parent: axG, ...o });
  Xd('diferencial', new THREE.SphereGeometry(0.12, 30, 20), 'cast', { s: [0.92, 1, 0.8], ...DC });
  for (const s of [-1, 1]) Xd('diferencial', new THREE.CylinderGeometry(0.036, 0.036, 0.43, 20, 1, true).rotateX(Math.PI / 2), 'cast', { p: [0, 0, s * 0.3], ...DC });
  Xd('diferencial', latheX([[0.1, 0.078], [0.076, 0.13], [0.047, 0.19], [0.042, 0.224]], 30), 'cast', { p: [0, YP, 0], ...DC });           // nariz del portador
  Xd('diferencial', latheX([[0.086, 0.076], [0.113, 0.076], [0.113, 0.088], [0.086, 0.088]], 30), 'cast', { ...DC });                   // brida del portador
  for (let k = 0; k < 8; k++) { const a = (k + 0.5) / 8 * Math.PI * 2; Xd('diferencial', cylX(0.0055, 0.008, 6), 'chrome', { p: [0.093, Math.cos(a) * 0.1, Math.sin(a) * 0.1], cut: 'tdiff' }); }   // 8 pernos (manual)
  for (const a of [0.9, 2.2, 4.1, 5.4]) Xd('diferencial', rbox(0.1, 0.03, 0.005, 0.002), 'cast', { p: [0.14, YP + Math.cos(a) * 0.058, Math.sin(a) * 0.058], r: [a, 0, 0], cut: 'tdiff' });      // nervios
  Xd('diferencial', cylX(0.012, 0.008, 6), 'chrome', { p: [-0.111, 0.012, 0] });                                                         // tapón de llenado
  Xd('diferencial', cylY(0.012, 0.008, 6), 'chrome', { p: [0, -0.121, 0] });                                                             // tapón de vaciado
  for (const s of [-1, 1]) Xd('diferencial', cylZ(0.036, 0.014, 20), 'machined', { p: [0, 0, s * 0.062] });                              // rodamientos laterales
  for (const x of [0.118, 0.192]) Xd('diferencial', cylX(0.027, 0.014, 20), 'machined', { p: [x, YP, 0] });                              // rodamientos del piñón
  // piñón de ataque (8 dientes), algo más abajo que el centro de la corona: engrane hipoide
  const pinG = sub(axG, [0, YP, 0]);
  K('dif_pinon_corona', bevelGeo([[0.008, 0.094], [0.0235, 0.092], [0.013, 0.05], [0.012, 0.046]], DK.final[0], [1, 2], 0.0022, 'r', 0.55).rotateZ(-Math.PI / 2), 'machined', { parent: pinG, double: true, press: 'p_dif' });
  K('dif_pinon_corona', cylX(0.0135, 0.14, 14), 'bar', { parent: pinG, p: [0.162, 0, 0], press: 'p_dif' });
  K('dif_pinon_corona', cylX(0.042, 0.008, 20), 'steel', { parent: pinG, p: [0.229, 0, 0], press: 'p_dif' });                           // brida del piñón
  K('cardan', cylX(0.042, 0.008, 20), 'steel', { parent: pinG, p: [0.237, 0, 0], press: 'p_prop' });                                    // brida del cardán, apernada a la del piñón
  for (let k = 0; k < 4; k++) { const a = k / 4 * Math.PI * 2 + 0.78; K('cardan', cylX(0.005, 0.024, 6), 'chrome', { parent: pinG, p: [0.233, Math.cos(a) * 0.033, Math.sin(a) * 0.033] }); }
  for (const s of [-1, 1]) K('cardan', rbox(0.042, 0.03, 0.01, 0.003), 'steel', { parent: pinG, p: [0.25 - 0.006, 0, s * 0.031], press: 'p_prop' });
  // corona (41 dientes), apernada a la caja de satélites; va a la izquierda del piñón
  const ring = sub(axG);
  K('dif_pinon_corona', bevelGeo([[0.05, -0.04], [0.09, -0.04], [0.09, -0.0262], [0.053, -0.0135], [0.05, -0.04]], DK.final[1], [2, 3], 0.0015, 'a', 0.3).rotateX(Math.PI / 2), 'machined', { parent: ring, double: true, press: 'p_dif' });
  K('dif_satelites', latheZ([[0.03, -0.056], [0.03, -0.042], [0.05, -0.04], [0.05, 0.03], [0.03, 0.044], [0.03, 0.056]], 28), 'iron', { parent: ring, cut: 'tdiff', double: true });   // caja de satélites
  K('dif_satelites', cylX(0.0062, 0.094, 10), 'machined', { parent: ring });                                                             // eje de los satélites
  const spGeo = bevelGeo([[0.007, 0.033], [0.0212, 0.0305], [0.013, 0.0185], [0.007, 0.0185]], DK.side[0], [1, 2], 0.0013, 'r').rotateZ(-Math.PI / 2);
  const spiders = [0, Math.PI].map(ry => { const o = sub(ring); o.rotation.y = ry; const g = sub(o); K('dif_satelites', spGeo, 'brass', { parent: g, double: true }); return g; });
  // palieres semiflotantes, con su planetario estriado en la punta
  const sideGeo = s => bevelGeo([[0.012, 0.04], [0.03, 0.0255], [0.03, 0.0214], [0.018, 0.0128], [0.012, 0.0128]], DK.side[1], [2, 3], 0.0013, 'a').rotateX(s * Math.PI / 2);
  const axles = [1, -1].map(s => { const g = sub(axG);                                                                                    // [derecho, izquierdo]
    K('dif_satelites', sideGeo(s), 'machined', { parent: g, double: true });
    K('palieres', cylZ(0.0125, 0.53, 14), 'bar', { parent: g, p: [0, 0, s * 0.3] });
    K('palieres', discX(gearShape(0.0145, 16, 0.0014), 0.03, 6).rotateY(Math.PI / 2), 'bar', { parent: g, p: [0, 0, s * 0.05] });   // estrías
    K('palieres', cylZ(0.03, 0.016, 18), 'machined', { parent: g, p: [0, 0, s * 0.5] });                                                  // rodamiento de rueda
    return g; });
  ctx.setLevel('van');

  // ════════ estado, cinemática y animación ════════
  const sim = { on: false, rpm: 0, v: 0, vs: 0, wIn: 0, gear: 'N', clutch: 0, throttle: 0, fail: 'ok', noGrip: false, brake: false, stalled: false };
  const st = { active: false, stallMsg: '', held: false, auto: true, clutchT: 0, clRate: 3, throttle: 0, turn: 0, showPath: true, hold: false, grind: 0, grindMsg: '', cut: false, last: null, demo: null };
  const lev = { sel: 0, sh: 0 }, sq = { phase: 'idle', target: 'N', t: 0 };
  const ang = { in: 0, out: 0, ring: 0, L: 0, R: 0, F: 0 };
  let extClutch = null;                                                     // pedal, piola y palanca exterior (van3d.js)
  const tA = new THREE.Vector3(), tB = new THREE.Vector3();
  const wire = (m, a, b) => { const d = tB.copy(b).sub(a), l = d.length(); m.position.copy(a).addScaledVector(d, 0.5); m.scale.y = Math.max(1e-4, l); m.quaternion.setFromUnitVectors(V(0, 1, 0), d.normalize()); };

  function poseSpin() {
    gIn.rotation.x = -ang.in; gC.rotation.x = ang.in / PRIM;
    for (const key in FREE) FREE[key].g.rotation.x = -ang.in * FREE[key].k;
    idler.rotation.x = -ang.in / PRIM * DK.pair.R[0] / DK.idler;
    gOut.rotation.x = -ang.out; prop.rotation.z = ang.out; pinG.rotation.x = -ang.out;
    ring.rotation.z = -ang.ring; axles[0].rotation.z = -ang.R; axles[1].rotation.z = -ang.L;
    const rel = (ang.R - ang.ring) * DK.side[1] / DK.side[0];
    spiders[0].rotation.x = rel; spiders[1].rotation.x = rel;
    const wob = sim.fail === 'cruceta' && st.active ? 0.0035 : 0;           // cruceta con juego: el tubo queda descentrado y vibra
    prop.position.set(Math.cos(ang.out) * wob, Math.sin(ang.out) * wob, 0);
  }
  function poseGear() {
    const { sel, sh } = lev, a = -Math.asin(Math.max(-1, Math.min(1, sh * D / 0.028))), phi = Math.asin(sel * 0.016 / 0.03);
    lever.rotation.z = -0.15 * sh; lever.rotation.x = 0.12 * sel;
    selG.position.z = sel * 0.016; selG.rotation.z = a; selCr.rotation.y = phi;
    const gate = Math.round(sel) + 1;
    for (let k = 0; k < 3; k++) { const off = k === gate && Math.abs(sel - (gate - 1)) < 0.3 ? -sh * D : 0; rods[k].position.x = off; sleeves[k].position.x = HUBS[k] + off; }
    wire(wSh, BS, tA.set(X.sel - 0.045 * Math.sin(a), YS + 0.045 * Math.cos(a), 0.105 + sel * 0.016));
    wire(wSe, BQ, tA.set(CRP[0] + 0.03 * Math.sin(phi), YS, CRP[2] + 0.03 * Math.cos(phi)));
  }
  // embrague: lo que avanza el collarín y cuánto se levanta la prensa (exagerado ×3 para que se vea); devuelve el giro de la horquilla
  function clutchPose(k) {
    const c = clutchLift(k, st.active ? sim.fail : 'ok'), rest = c.gap < DK.gap ? DK.gap - c.gap : 0, a = Math.asin((c.travel + rest) / relS[1]);
    fork.rotation.z = a; rb.position.x = RB0 + c.travel + rest;
    const push = Math.max(0, c.travel - c.gap);
    dia.scale.x = Math.max(0.08, 1 - push / 0.016);
    pp.position.x = -0.0032 * c.lift; disc.position.x = -0.0014 * c.lift;
    return a;
  }
  // fuera de la vista Transmisión: el motor en marcha arrastra todo en 2.ª, como en un elevador
  function kin(theta, setWheels) {
    ang.in = theta; ang.out = theta / gearRatio(2); ang.ring = ang.L = ang.R = ang.F = ang.out / FINALR;
    poseSpin(); setWheels(-ang.F, -ang.R, -ang.L);
  }
  const approach = (v, t, d) => (Math.abs(t - v) <= d ? t : v + Math.sign(t - v) * d);
  const biteK = want => { let lo = 0, hi = 1; for (let i = 0; i < 18; i++) { const m = (lo + hi) / 2; if (clutchCap(m, sim.fail) > want) lo = m; else hi = m; } return hi; };
  function canEnter(g) {
    const lift = clutchLift(sim.clutch, sim.fail).lift, moving = sim.on || Math.abs(sim.v) > 0.3 || Math.abs(sim.wIn) > 12;
    const miss = Math.abs(sim.wIn - (sim.noGrip ? sim.vs : sim.v) / DK.rw * gearRatio(g) * FINALR) / RAD;
    if (!moving || miss < 150) return 'ok';
    if (lift < 0.6) return 'no';
    if (lift < 0.9) return 'rasca';
    if (sim.fail === 'sincro' && g === 2 && miss > 300) return 'rasca';
    return 'ok';
  }
  function stepShift(dt) {
    if (sq.phase === 'idle') return false;
    sq.t += dt;
    const g = sq.target;
    if (sq.phase === 'press') { st.clutchT = 1; st.clRate = 5; st.hold = true; if (sim.clutch > 0.96) sq.phase = 'out'; }
    else if (sq.phase === 'out') { lev.sh = approach(lev.sh, 0, dt * 7); if (lev.sh === 0) sq.phase = 'sel'; }
    else if (sq.phase === 'sel') {
      lev.sel = approach(lev.sel, SEL[g], dt * 8);
      if (lev.sel === SEL[g]) {
        if (g === 'N') sq.phase = 'release';
        else { const c = canEnter(g);
          if (c === 'no') { st.grind = 1.6; st.grindMsg = 'no'; sq.target = 'N'; }
          else { if (c === 'rasca') { st.grind = 1.3; st.grindMsg = sim.fail === 'sincro' && g === 2 ? 'sincro' : 'rasca'; sq.wait = 0.45; } else sq.wait = 0; sq.phase = 'in'; } }
      }
    } else if (sq.phase === 'in') {
      if (sq.wait > 0) { sq.wait -= dt; lev.sh = SHF[g] * (0.3 + 0.08 * Math.sin(sq.t * 60)); }
      else { lev.sh = approach(lev.sh, SHF[g], dt * 7); if (lev.sh === SHF[g]) sq.phase = 'release'; }
    } else if (sq.phase === 'release') {
      if (!st.auto) { st.hold = false; sq.phase = 'idle'; }
      else {
        st.hold = false;
        const launch = g !== 'N' && sim.on && Math.abs(st.last ? st.last.slip : 0) > 90 && sq.t < 9;
        if (launch) { st.clutchT = biteK(20 + 50 * st.throttle); st.clRate = 2.2; }       // sostiene el punto de contacto hasta que las velocidades se igualan
        else { st.clutchT = 0; st.clRate = 1.5; if (sim.clutch < 0.02) sq.phase = 'idle'; }
      }
    }
    const k = lev.sel + ',' + Math.sign(lev.sh);
    sim.gear = Math.abs(lev.sh) > 0.75 && GATE[k] !== undefined ? GATE[k] : 'N';
    poseGear();
    return true;
  }
  function requestGear(g) {
    st.held = false;
    if (!(g in SEL) || (sq.phase === 'idle' && g === sim.gear)) return;
    sq.target = g; sq.t = 0; sq.phase = st.auto ? 'press' : 'out';
  }
  // recorrido automático: parte en 1.ª y pasa los cambios hasta 5.ª
  const DEMO = [
    d => { if (!sim.on) start(); st.auto = true; st.throttle = 0; sim.brake = false; return d.t > 0.9; },
    d => { if (d.t === 0) requestGear(1); return sq.phase === 'idle' && d.t > 0.3; },
    ...[2, 3, 4, 5].map(g => d => { st.throttle = 0.8; if (sq.phase === 'idle' && (sim.rpm > [0, 0, 3600, 3700, 3500, 3100][g] || d.t > 14)) { requestGear(g); return true; } return false; }),
    d => sq.phase === 'idle' && d.t > 0.5, d => { st.throttle = 0.5; return d.t > 5; },
    d => { st.throttle = 0; if (d.t === 0) requestGear('N'); sim.brake = sq.phase === 'idle'; return Math.abs(sim.v) < 0.05 && sq.phase === 'idle'; },
    d => { sim.brake = false; return true; },
  ];
  function stepDemo(dt) {
    const d = st.demo; if (!d) return;
    if (!sim.on && d.i > 0) { st.demo = null; sim.brake = false; return; }   // se caló: se acaba
    const done = DEMO[d.i](d); d.t += dt;
    if (done) { d.i++; d.t = 0; if (d.i >= DEMO.length) st.demo = null; }
  }
  function start() {
    st.stallMsg = '';
    if (sim.gear !== 'N' && Math.abs(sim.v) < 0.5 && clutchCap(sim.clutch, sim.fail) > 10) {
      if (!st.auto) { sim.stalled = true; st.stallMsg = 'marcha'; return; }          // con una marcha puesta y el embrague suelto, el motor de partida no puede con el furgón
      sim.clutch = st.clutchT = 1; sq.target = sim.gear; sq.phase = 'release'; sq.t = 0;   // el modelo pisa el embrague, da partida y sale
    }
    sim.on = true; sim.stalled = false; sim.rpm = Math.max(sim.rpm, 560);
  }
  function tick(dt, setWheels) {
    if (!st.active) return false;
    stepDemo(dt);
    let anim = stepShift(dt);
    // con el embrague automático, el modelo lo pisa antes de que el motor se cale (al frenar con una marcha puesta) y vuelve a salir al acelerar
    if (st.auto && sim.on && sim.gear !== 'N' && sq.phase === 'idle') {
      if (!st.held && sim.rpm < 780 && st.throttle < 0.05 && Math.abs(sim.v) < 4) { st.held = true; st.clutchT = 1; st.clRate = 6; }
      else if (st.held && st.throttle > 0.05) { st.held = false; sq.target = sim.gear; sq.phase = 'release'; sq.t = 0; }
    }
    if (sim.clutch !== st.clutchT) { sim.clutch = approach(sim.clutch, st.clutchT, dt * st.clRate); anim = true; }
    if (extClutch) extClutch(sim.clutch);
    sim.throttle = approach(sim.throttle, st.hold ? 0 : st.throttle, dt * 5);
    if (st.grind > 0) { st.grind = Math.max(0, st.grind - dt); anim = true; }
    const r = driveStep(sim, dt); st.last = r;
    const moving = Math.abs(r.rpmIn) > 1 || Math.abs(r.rpmWheel) > 0.05 || Math.abs(sim.v) > 0.005;
    const wr = r.rpmWheel * RAD * S * dt, wv = sim.v / DK.rw * S * dt;
    ang.in += r.rpmIn * RAD * S * dt; ang.out += r.rpmOut * RAD * S * dt; ang.ring += wr; ang.F += wv;
    if (sim.noGrip) { ang.L += wv; ang.R += 2 * wr - wv; }                  // diferencial abierto: la rueda sin agarre se lleva todo el giro
    else { ang.L += wr * (1 + 0.16 * st.turn); ang.R += wr * (1 - 0.16 * st.turn); }   // en curva, la de afuera gira más (st.turn: −1 izquierda, 1 derecha)
    poseSpin(); setWheels(-ang.F, -ang.R, -ang.L);
    return anim || sim.on || moving || r.rpm > 1;
  }
  function setCuts(on) {
    st.cut = on;
    if (on) { planes.tcase.set(V(0, 0, 1), -ENG[2]); planes.tdiff.set(V(0, -1, 0), RW + 0.004); }   // la caja y el embrague se abren por el lado del conductor; el puente, por arriba
    else { planes.tcase.set(V(0, 1, 0), 1e4); planes.tdiff.set(V(0, 1, 0), 1e4); }
  }
  function setActive(on) {
    st.active = on; st.demo = null; st.grind = 0; sq.phase = 'idle'; st.hold = false; st.held = false; st.stallMsg = '';
    Object.assign(sim, { on: false, rpm: 0, v: 0, vs: 0, wIn: 0, clutch: 0, throttle: 0, brake: false, stalled: false, gear: on ? 'N' : 2 });
    st.clutchT = 0; st.throttle = 0;
    lev.sel = SEL[sim.gear]; lev.sh = SHF[sim.gear]; poseGear();
    if (extClutch) extClutch(0); else clutchPose(0);
    st.last = on ? driveStep(sim, 0) : null;
  }
  const hot = new THREE.Color().setRGB(236 / 255, 150 / 255, 40 / 255, THREE.SRGBColorSpace), pressMats = [];
  function bind(meshes) { pressMats.length = 0; meshes.forEach(m => pressMats.push(m)); }
  // camino de la fuerza: se tiñen de naranjo las piezas que la llevan en la marcha puesta
  function paint(mode, colorMode) {
    const r = st.last; if (!r || mode !== 'tra' || colorMode !== 'real') return;
    const g = sim.gear, flow = st.showPath && g !== 'N' && r.cap > 0.5 && (sim.on || Math.abs(r.tc) > 0.5), k = g === 1 || g === 2 ? 0 : g === 3 || g === 4 ? 1 : 2;
    for (const m of pressMats) {
      const ud = m.material.userData, p = ud.press;
      const on = flow && (p === 'p_cl' || p === 'p_in' || p === 'p_out' || p === 'p_prop' || p === 'p_dif' || (p === 'p_c' && g !== 4) || p === 'p_' + g || p === 'p_s' + k);
      m.material.color.copy(ud.real); if (on) m.material.color.lerp(hot, 0.62);
    }
  }
  setActive(false);
  poseSpin();
  return {
    planes, bind, paint, setCuts, setActive, tick, kin, clutchPose, gb,
    bindClutch(fn) { extClutch = fn; },
    get active() { return st.active; },
    visOmega: () => sim.rpm * RAD * S,
    set(o) {
      if ('on' in o) { if (o.on) start(); else { sim.on = false; sim.stalled = false; st.demo = null; } }
      if ('gear' in o) { st.demo = null; requestGear(o.gear); }
      if ('clutch' in o) { st.held = false; st.clutchT = o.clutch; st.clRate = o.fast ? 30 : 3; if (sq.phase === 'release' || sq.phase === 'press') sq.phase = 'idle'; }
      if ('throttle' in o) st.throttle = o.throttle;
      for (const k of ['auto', 'turn', 'showPath']) if (k in o) st[k] = o[k];
      for (const k of ['fail', 'noGrip', 'brake']) if (k in o) sim[k] = o[k];
      if (o.demo) { st.demo = { i: 0, t: 0 }; }
      if (o.demo === false) st.demo = null;
      if (extClutch) extClutch(sim.clutch);
      return this.result;
    },
    get state() { return { ...st, sim, lev, phase: sq.phase, target: sq.target }; },
    get result() { return st.last ? { ...st.last, stalled: st.last.stalled || !!sim.stalled, stallMsg: st.stallMsg || '', phase: sq.phase, target: sq.target, grind: st.grind, grindMsg: st.grindMsg, auto: st.auto, turn: st.turn, demo: !!st.demo, brake: sim.brake } : null; },
    groups: { embrague: [clG], caja: [gIn, gC, gOut], selector: [selG, selCr, rods[0], rods[2]], palanca: [lever], cardan: [propG], dif: [ring, pinG] },
  };
}
