// Refrigeración del SK410 (manual secc. 6, fotos bajo los dos asientos y catálogo de repuestos).
// Radiador de flujo descendente, atravesado al centro y justo delante del motor: estanques de plástico negro engrapados
// a un panal de 488 × 240 mm. La tapa va al lado del conductor (se ve levantando su asiento) y las dos mangueras al lado
// del copiloto, como en el dibujo de las mangueras del manual. Entre el radiador y el motor, el carenado lleva el aire al
// ventilador de 4 aspas, apernado a la polea de la bomba. El termostato va en la salida del múltiple de admisión, con su
// tapa y el bulbo del indicador; de ahí salen la manguera superior, la de derivación y la de la calefacción. El agua vuelve
// a la bomba por el tubo de entrada, que recibe la manguera inferior, la derivación y la vuelta de la calefacción.
// El depósito transparente va junto a la torre izquierda (foto). Recorrido de mangueras y tubo de entrada: aproximados.
import * as THREE from 'three';
import { CK, PROC, coolInit, coolStep, coolRead, coolColor, potInit, potStep, applyFail, refill } from './coolsim.js';

const RAD = new THREE.Vector3(0.068, 0.384, 0.03), RL = -0.12;     // centro del radiador e inclinación (arriba hacia adelante)
const CW = 0.488, CHt = 0.24, CD = 0.032;                           // panal
const TH = 0.05, TD = 0.048, TW = CW + 0.026, HP = 0.004;           // estanques y placas de los tubos
const YT = CHt / 2 + HP + TH / 2, YB = -YT;                         // centro de cada estanque
const ZCAP = -0.172, ZIN = 0.192, ZOUT = 0.2, ZDR = 0.1;            // boca (conductor), entrada y salida (copiloto), tapón
const DEP = new THREE.Vector3(-0.055, 0.585, -0.33);                // depósito
const DW = 0.095, DH = 0.15, DZ = 0.085;                            // medidas del depósito
const POTP = new THREE.Vector3(1.0, 0, -0.85);                      // olla de la prueba del termostato, en el piso
const YRES0 = DEP.y - DH / 2 + 0.006, RESK = 1 / (DW * DZ * 1000);  // fondo y metros por litro del depósito

export function buildCooling(ctx, { eng, E, HT }) {
  const { V, rbox, cylX, cylY, cylZ, tube, helix, add, group } = ctx;
  const root = ctx.world.root;
  const EL = (x, y, z) => eng.localToWorld(V(x, y, z));
  const ELa = a => EL(a[0], a[1], a[2]);
  const P3 = p => (p.isVector3 ? p : V(...p));
  const dyn = m => { m.userData.dyn = true; return m; };
  const planes = { rad: new THREE.Plane(V(0, 1, 0), 1e4), resv: new THREE.Plane(V(0, 1, 0), 1e4) };
  const EXV = { radiador: [0.3, 0.02, 0], tapa_radiador: [0.3, 0.28, -0.04], carenado: [0.16, 0.02, 0], mangueras: [0.18, 0.12, 0.05], deposito: [0.2, 0.18, -0.12] };
  const A = (part, geo, kind, o = {}) => add(part, geo, kind, { ex: 'ex' in o ? o.ex : EXV[part], ...o });
  const pts = E.pts;
  const fanW = EL(0.088, 0.115, 0);
  const press = [];

  // ════════ RADIADOR (marco propio: x a través del panal, y hacia arriba, z a lo ancho) ════════
  ctx.setLevel('ref');
  const rg = group('radiador', root, RAD.toArray(), EXV.radiador); rg.rotation.z = RL; rg.updateMatrixWorld(true);
  const R = (geo, kind, o = {}) => add(o.part || 'radiador', geo, kind, { parent: rg, ex: null, ...o });
  const RW = (x, y, z) => rg.localToWorld(V(x, y, z));
  // panal: tubos planos verticales y aletas onduladas entre ellos
  const PITCH = 0.0125, NT = Math.floor(CW / PITCH), TT = 0.0022;
  const tz = i => -CW / 2 + PITCH / 2 + i * PITCH;
  { const tubes = [];
    for (let i = 0; i < NT; i++) { const g = new THREE.BoxGeometry(CD - 0.002, CHt + 0.004, TT); g.translate(0, 0, tz(i)); tubes.push(g); }
    R(mergeGeos(tubes), 'dark', { cut: 'rad', double: true, press: 'c_core' });
    const pos = [], FP = 0.005;
    for (let i = 0; i < NT - 1; i++) {
      const z0 = tz(i) + TT / 2, z1 = tz(i + 1) - TT / 2; let left = true;
      for (let y = -CHt / 2; y < CHt / 2 - 1e-6; y += FP) {
        const y1 = Math.min(CHt / 2, y + FP), za = left ? z0 : z1, zb = left ? z1 : z0, x0 = -CD / 2 + 0.002, x1 = CD / 2 - 0.002;
        pos.push(x0, y, za, x0, y1, zb, x1, y1, zb, x0, y, za, x1, y1, zb, x1, y, za); left = !left;
      }
    }
    const fg = new THREE.BufferGeometry(); fg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); fg.computeVertexNormals();
    R(fg, 'fin', { cut: 'rad', double: true, press: 'c_core' });
    // marco lateral del panal
    for (const s of [-1, 1]) R(rbox(CD + 0.004, CHt + 0.01, 0.006, 0.002), 'steel', { p: [0, 0, s * (CW / 2 + 0.003)], cut: 'rad' }); }
  // placas de los tubos y estanques de plástico engrapados (fotos: dientes de metal a lo largo del borde)
  for (const [y, s] of [[CHt / 2 + HP / 2, 1], [-CHt / 2 - HP / 2, -1]]) {
    R(rbox(TD + 0.006, HP, TW, 0.0015), 'steel', { p: [0, y, 0], cut: 'rad' });
    const tabs = [];
    for (let z = -TW / 2 + 0.008; z < TW / 2 - 0.004; z += 0.0125) for (const x of [-1, 1]) { const g = new THREE.BoxGeometry(0.0012, 0.005, 0.004); g.translate(x * (TD / 2 + 0.0032), y + s * 0.0035, z); tabs.push(g); }
    R(mergeGeos(tabs), 'steel', { cut: 'rad' });
  }
  for (const [y, k] of [[YT, 'c_top'], [YB, 'c_bot']]) {
    R(rbox(TD, TH, TW, 0.009), 'plastic', { p: [0, y, 0], cut: 'rad', double: true, press: k });
    const ribs = [];
    for (let z = -TW / 2 + 0.04; z < TW / 2 - 0.02; z += 0.055) for (const x of [-1, 1]) { const g = new THREE.BoxGeometry(0.004, TH - 0.012, 0.004); g.translate(x * (TD / 2 + 0.0015), y, z); ribs.push(g); }
    R(mergeGeos(ribs), 'plastic', { cut: 'rad' });
    for (const s of [-1, 1]) R(cylZ(0.009, 0.016, 12), 'plastic', { p: [0, y, s * (TW / 2 + 0.007)], cut: 'rad' });   // pasadores de los costados
  }
  // agua adentro de los estanques (se ve con el corte)
  const wTop = dyn(R(new THREE.BoxGeometry(TD - 0.008, TH - 0.008, TW - 0.012), 'coolant', { p: [0, YT, 0], op: 0.75, cut: 'rad', double: true, noAnchor: true, pick: false }));
  const wBot = dyn(R(new THREE.BoxGeometry(TD - 0.008, TH - 0.008, TW - 0.012), 'coolant', { p: [0, YB, 0], op: 0.75, cut: 'rad', double: true, noAnchor: true, pick: false }));
  // boca de llenado (lado conductor) con el tubito al depósito, entrada arriba y salida abajo (lado copiloto)
  const yTop = CHt / 2 + HP + TH;
  R(cylY(0.0165, 0.03, 20), 'brass', { p: [0, yTop + 0.012, ZCAP], cut: 'rad', double: true });
  R(cylY(0.021, 0.004, 22), 'brass', { p: [0, yTop + 0.028, ZCAP], cut: 'rad' });
  const ovA = V(0.0, yTop + 0.02, ZCAP - 0.016), ovB = V(-0.022, yTop + 0.018, ZCAP - 0.04);
  R(tube([ovA, ovA.clone().lerp(ovB, 0.5).add(V(0, 0.002, 0)), ovB], 0.003), 'brass', {});
  const wNeck = dyn(R(cylY(0.0145, 0.026, 18), 'coolant', { p: [0, yTop + 0.011, ZCAP], op: 0.8, cut: 'rad', double: true, noAnchor: true, pick: false }));
  R(cylY(0.016, 0.034, 20), 'plastic', { p: [0, yTop + 0.015, ZIN], press: 'c_top' });                       // entrada, hacia arriba
  R(cylY(0.018, 0.006, 20), 'plastic', { p: [0, yTop + 0.031, ZIN] });
  const outDir = V(-1, -0.25, 0).normalize();
  { const m = R(cylY(0.016, 0.036, 20), 'plastic', { p: [-TD / 2 - 0.012, YB - 0.006, ZOUT], press: 'c_bot' }); m.quaternion.setFromUnitVectors(V(0, 1, 0), outDir); }
  // tapón de vaciado (abajo, hacia el copiloto) con su aleta
  const drainG = new THREE.Group(); drainG.position.set(0.004, -yTop - 0.008, ZDR); rg.add(drainG);
  add('radiador', cylY(0.011, 0.014, 16), 'white', { parent: drainG, ex: null });
  add('radiador', rbox(0.004, 0.012, 0.024, 0.0015), 'white', { parent: drainG, ex: null, p: [0, -0.012, 0] });
  dyn(drainG.children[0]); dyn(drainG.children[1]);
  // soportes: arriba un pasador con goma en una ménsula; abajo, pasadores en gomas sobre la traviesa
  for (const s of [-1, 1]) {
    R(rbox(0.05, 0.004, 0.03, 0.0015), 'steel', { p: [-0.006, yTop + 0.004, s * (TW / 2 - 0.02)] });
    R(cylY(0.008, 0.012, 12), 'rubber', { p: [-0.006, yTop + 0.012, s * (TW / 2 - 0.02)] });
    R(cylY(0.0035, 0.024, 8), 'steel', { p: [-0.006, yTop + 0.012, s * (TW / 2 - 0.02)] });
    R(cylY(0.01, 0.014, 12), 'rubber', { p: [0, -yTop - 0.007, s * (TW / 2 - 0.05)] });
  }
  rg.updateMatrixWorld(true);
  const neckW = RW(0, yTop + 0.03, ZCAP), inTopW = RW(0, yTop + 0.034, ZIN), outEndW = rg.localToWorld(V(-TD / 2 - 0.012, YB - 0.006, ZOUT).addScaledVector(outDir, 0.018));
  const ovEndW = RW(ovB.x, ovB.y, ovB.z);

  // ════════ TAPA DEL RADIADOR (0,9 kg/cm²): válvula de presión con resorte y de vacío al centro ════════
  const capG = group('tapa_radiador', rg, [0, yTop + 0.034, ZCAP], [0, 0.28, -0.04]);
  const CA = (geo, kind, o = {}) => add('tapa_radiador', geo, kind, { parent: capG, ex: null, cut: 'rad', ...o });
  CA(new THREE.SphereGeometry(0.024, 24, 10, 0, Math.PI * 2, 0, Math.PI / 2.4), 'chrome', { p: [0, -0.001, 0], s: [1, 0.42, 1], double: true });
  CA(cylY(0.0245, 0.004, 26), 'chrome', { p: [0, -0.001, 0] });
  CA(new THREE.CircleGeometry(0.0145, 20).rotateX(-Math.PI / 2), 'label', { p: [0, 0.0095, 0] });            // advertencia amarilla
  CA(rbox(0.012, 0.004, 0.006, 0.0015), 'chrome', { p: [-0.026, 0.001, 0] });                               // oreja: se alinea con el tubito
  CA(cylY(0.013, 0.012, 18), 'steel', { p: [0, -0.01, 0], double: true });                                    // cuerpo que entra en la boca
  const pv = new THREE.Group(); pv.position.set(0, -0.019, 0); capG.add(pv);                                  // válvula de presión
  add('tapa_radiador', cylY(0.0135, 0.003, 20), 'rubber', { parent: pv, ex: null, cut: 'rad' });
  add('tapa_radiador', cylY(0.009, 0.0012, 18), 'steel', { parent: pv, ex: null, cut: 'rad', p: [0, 0.002, 0] });
  const pspr = add('tapa_radiador', helix(0.0065, 0.012, 4, 0.0007), 'spring', { parent: capG, ex: null, cut: 'rad', p: [0, -0.0115, 0] });
  const vv = add('tapa_radiador', cylY(0.004, 0.002, 12), 'brass', { parent: pv, ex: null, cut: 'rad', p: [0, -0.003, 0] });   // válvula de vacío
  [pv, pspr, vv].forEach(dyn);
  const capHome = capG.position.clone();

  // ════════ CARENADO: del borde del panal al aro alrededor del ventilador ════════
  { const fl = rg.worldToLocal(fanW.clone());
    const xf = -TD / 2 - 0.003, xt = fl.x + 0.024, xb = fl.x - 0.012, Rr = 0.158;
    const ry = CHt / 2 + 0.008, rz = CW / 2 + 0.004, N = 56, M = 6;
    const rectAt = th => { const dy = Math.cos(th), dz = Math.sin(th); let t = Infinity;
      if (dy > 1e-6) t = Math.min(t, (ry - fl.y) / dy); if (dy < -1e-6) t = Math.min(t, (-ry - fl.y) / dy);
      if (dz > 1e-6) t = Math.min(t, (rz - fl.z) / dz); if (dz < -1e-6) t = Math.min(t, (-rz - fl.z) / dz);
      return [fl.y + dy * t, fl.z + dz * t]; };
    const pos = [], idx = [];
    for (let j = 0; j <= M; j++) {
      const k = j / M, e = k * k * (3 - 2 * k), x = xf + (xt - xf) * k;
      for (let i = 0; i < N; i++) {
        const th = i / N * Math.PI * 2, [ry0, rz0] = rectAt(th), cy = fl.y + Math.cos(th) * Rr, cz = fl.z + Math.sin(th) * Rr;
        pos.push(x, ry0 + (cy - ry0) * e, rz0 + (cz - rz0) * e);
      }
    }
    for (let i = 0; i < N; i++) pos.push(xb, fl.y + Math.cos(i / N * Math.PI * 2) * Rr, fl.z + Math.sin(i / N * Math.PI * 2) * Rr);
    for (let j = 0; j <= M; j++) for (let i = 0; i < N; i++) { const a = j * N + i, b = j * N + (i + 1) % N, c = a + N, d = b + N; idx.push(a, c, b, b, c, d); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
    add('carenado', g, 'plastic', { parent: rg, ex: EXV.carenado, double: true, op: 0.93 });
    const lip = new THREE.TorusGeometry(Rr, 0.004, 6, 48); lip.rotateY(Math.PI / 2);
    add('carenado', lip, 'plastic', { parent: rg, ex: EXV.carenado, p: [xb, fl.y, fl.z] });
    for (const [y, z] of [[ry, -rz + 0.03], [ry, rz - 0.03], [-ry, -rz + 0.03], [-ry, rz - 0.03]]) add('carenado', cylX(0.0045, 0.012, 6), 'steel', { parent: rg, ex: EXV.carenado, p: [xf - 0.003, y * 0.96, z] });
  }

  // ════════ DEPÓSITO (transparente, con FULL y LOW; la manguera llega a 10 mm del fondo) ════════
  const resG = group('deposito', root, [0, 0, 0], EXV.deposito);
  const RS = (geo, kind, o = {}) => add('deposito', geo, kind, { parent: resG, ex: null, ...o });
  RS(rbox(DW, DH, DZ, 0.02), 'resv', { p: DEP.toArray(), op: 0.5, double: true });
  RS(cylY(0.024, 0.016, 20), 'beige', { p: [DEP.x + 0.012, DEP.y + DH / 2 + 0.008, DEP.z + 0.01] });
  RS(tube([[DEP.x + 0.012, DEP.y + DH / 2 + 0.016, DEP.z + 0.01], [DEP.x + 0.03, DEP.y + DH / 2 + 0.022, DEP.z + 0.03], [DEP.x + 0.05, DEP.y + DH / 2 + 0.022, DEP.z + 0.05]], 0.0035), 'white', {});
  RS(tube([[DEP.x + 0.012, DEP.y + DH / 2, DEP.z + 0.01], [DEP.x + 0.012, DEP.y, DEP.z + 0.01], [DEP.x + 0.012, YRES0 + 0.01, DEP.z + 0.01]], 0.0032), 'hose', { op: 0.7 });
  const resLiq = dyn(RS(new THREE.BoxGeometry(DW - 0.01, 1, DZ - 0.01), 'coolant', { op: 0.72, noAnchor: true, pick: false }));
  // marcas FULL y LOW en la cara de afuera (hacia la puerta del conductor)
  const markTex = txt => { const c = document.createElement('canvas'); c.width = 128; c.height = 40; const x = c.getContext('2d');
    x.fillStyle = 'rgba(20,22,24,0.85)'; x.fillRect(0, 34, 128, 4); x.font = '700 26px Archivo, sans-serif'; x.fillText(txt, 4, 28);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; };
  const marks = [];
  for (const [txt, L] of [['FULL', CK.resFull], ['LOW', CK.resLow]]) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.04, 0.0125), new THREE.MeshBasicMaterial({ map: markTex(txt), transparent: true, depthWrite: false }));
    m.position.set(DEP.x + 0.01, YRES0 + L * RESK + 0.004, DEP.z - DZ / 2 - 0.0008); m.rotation.y = Math.PI; m.userData.noBox = true; m.visible = false; resG.add(m); marks.push(m);
  }
  const resHome = resG.position.clone();

  // ════════ TERMOSTATO EN EL MÚLTIPLE: caja, termostato de cera, tapa con la salida y el bulbo encima ════════
  ctx.setLevel('eng+ref');
  const TC = V(-0.018, 0.25, 0.128);                                                  // asiento del termostato (marco del motor)
  const TP = (part, geo, kind, o = {}) => add(part, geo, kind, { parent: eng, ex: [0.05, 0.08, 0.17], ...o });
  TP('termostato', cylZ(0.025, 0.034, 26), 'alu', { p: [TC.x, TC.y, TC.z - 0.017], double: true, cut: 'xray' });   // caja en el múltiple
  TP('termostato', cylZ(0.025, 0.02, 26), 'alu', { p: [TC.x, TC.y, TC.z + 0.011], double: true, cut: 'xray', press: 'c_up' });   // tapa
  TP('termostato', new THREE.SphereGeometry(0.025, 20, 8, 0, Math.PI * 2, 0, Math.PI / 2).rotateX(Math.PI / 2), 'alu', { p: [TC.x, TC.y, TC.z + 0.021], s: [1, 1, 0.5], double: true, cut: 'xray' });
  for (const s of [-1, 1]) {
    TP('termostato', rbox(0.016, 0.012, 0.006, 0.003), 'alu', { p: [TC.x + s * 0.03, TC.y, TC.z + 0.004] });
    TP('termostato', cylZ(0.0045, 0.014, 6), 'steel', { p: [TC.x + s * 0.03, TC.y, TC.z + 0.01] });
  }
  const thOutA = V(TC.x + 0.012, TC.y + 0.003, TC.z + 0.014), thOutB = V(0.034, 0.256, 0.142);
  TP('termostato', tube([thOutA, V(0.016, 0.255, 0.143), thOutB], 0.0145), 'alu', { press: 'c_up' });
  TP('termostato', cylX(0.016, 0.006, 18), 'alu', { p: [thOutB.x - 0.004, thOutB.y, thOutB.z] });
  // termostato de cera (eje hacia afuera del múltiple): pestaña con la válvula de purga, puente, cápsula, válvula y resorte
  const thermG = new THREE.Group(); thermG.position.copy(TC); thermG.rotation.x = Math.PI / 2; eng.add(thermG);
  const thermo = mkThermostat(thermG, 'termostato'); ctx.reg(thermG, 'termostato', [0.05, 0.08, 0.17]);
  // salida de la derivación (abajo de la caja) y nipple de la calefacción (el tubo que corre por el múltiple)
  const byA = V(TC.x + 0.004, TC.y - 0.026, TC.z - 0.02), byB = V(TC.x + 0.008, TC.y - 0.038, TC.z - 0.022);
  TP('tubo_agua', tube([byA, byB], 0.0075), 'alu', {});

  // ════════ TUBO DE ENTRADA DE AGUA: de la manguera inferior a la bomba; recibe la derivación y la vuelta de la calefacción ════════
  const T0 = pts.pumpPort, T1 = V(0.008, 0.06, 0.072), T2 = V(0.01, 0.025, 0.098), T3 = V(0.012, -0.012, 0.11), T4 = V(0.018, -0.03, 0.114);
  const NIP = V(0.046, -0.032, 0.118), HRN = pts.heaterRet;
  TP('tubo_agua', tube([T0, T1, T2, T3, T4, NIP], 0.0105, false, 60), 'alu', { press: 'c_in' });
  TP('tubo_agua', tube([T2, V(-0.012, 0.024, 0.101), HRN], 0.0075), 'alu', {});
  TP('tubo_agua', tube([T1, V(0.008, 0.07, 0.078), V(0.008, 0.08, 0.082)], 0.0075), 'alu', {});
  TP('tubo_agua', rbox(0.012, 0.016, 0.03, 0.003), 'alu', { p: [0.008, 0.045, 0.086] });                  // pata de fijación al block
  const BY = [byB, V(TC.x + 0.012, 0.19, 0.104), V(0.006, 0.13, 0.093), V(0.008, 0.095, 0.086), V(0.008, 0.08, 0.082)];
  TP('tubo_agua', tube(BY, 0.0078, false, 40), 'hose', { press: 'c_byp' });

  // ════════ MANGUERAS DEL RADIADOR (van y vuelven por el lado del copiloto) ════════
  ctx.setLevel('ref');
  const thOutW = ELa(thOutB.toArray()), nipW = ELa(NIP.toArray());
  const UP = [thOutW, V(thOutW.x + 0.04, thOutW.y + 0.012, thOutW.z + 0.012), V(0.012, 0.612, 0.02), V(0.05, 0.632, 0.13), V(inTopW.x - 0.012, 0.632, inTopW.z), V(inTopW.x, inTopW.y + 0.026, inTopW.z), inTopW];
  const LO = [outEndW, V(outEndW.x - 0.03, outEndW.y - 0.004, outEndW.z), V(-0.012, 0.228, 0.205), V(-0.04, 0.27, 0.19), V(-0.035, 0.33, 0.16), V(nipW.x + 0.03, nipW.y + 0.004, nipW.z + 0.008), nipW];
  A('mangueras', tube(UP, 0.0158, false, 120), 'hose', { press: 'c_up' });
  A('mangueras', tube(LO, 0.0158, false, 120), 'hose', { press: 'c_low' });
  const clamp3 = (part, p, d, r, o = {}) => { const m = A(part, new THREE.TorusGeometry(r, 0.0022, 6, 20), 'steel', { p: p.toArray(), ...o }); m.lookAt(p.clone().add(d)); return m; };
  const dirAt = (Q, end) => (end ? Q[Q.length - 1].clone().sub(Q[Q.length - 2]) : Q[0].clone().sub(Q[1])).normalize();
  for (const [Q, e] of [[UP, 0], [UP, 1], [LO, 0], [LO, 1]]) { const p = (e ? Q[Q.length - 1] : Q[0]).clone().addScaledVector(dirAt(Q, e), -0.012); clamp3('mangueras', p, dirAt(Q, e), 0.0172); }
  // manguera del depósito: del tubito de la boca a la tapa del depósito
  const RH = [ovEndW, V(ovEndW.x - 0.03, ovEndW.y + 0.012, ovEndW.z - 0.04), V(0.0, 0.66, -0.27), V(DEP.x + 0.05, DEP.y + DH / 2 + 0.03, DEP.z + 0.05), V(DEP.x + 0.05, DEP.y + DH / 2 + 0.022, DEP.z + 0.05)];
  A('deposito', tube(RH, 0.0042, false, 60), 'hose', { ex: null, parent: resG });

  // ════════ OLLA PARA PROBAR EL TERMOSTATO (manual 6-3), en el piso junto al furgón ════════
  const potG = new THREE.Group(); potG.position.copy(POTP); potG.visible = false; root.add(potG);
  const PO = (part, geo, kind, o = {}) => add(part, geo, kind, { parent: potG, ex: null, noAnchor: true, pick: false, ...o });
  { const wall = new THREE.CylinderGeometry(0.085, 0.08, 0.115, 40, 1, true);
    PO('olla', wall, 'alu', { p: [0, 0.0775, 0], double: true, op: 0.4 });
    PO('olla', cylY(0.08, 0.004, 40), 'alu', { p: [0, 0.022, 0] });
    PO('olla', new THREE.TorusGeometry(0.085, 0.0035, 6, 40).rotateX(Math.PI / 2), 'alu', { p: [0, 0.135, 0] });
    for (const s of [-1, 1]) PO('olla', new THREE.TorusGeometry(0.02, 0.004, 6, 16, Math.PI).rotateY(Math.PI / 2), 'dark', { p: [0, 0.118, s * 0.09], r: [0, 0, s * Math.PI / 2] });
    PO('olla', cylY(0.079, 0.088, 36), 'water', { p: [0, 0.068, 0], op: 0.28 });
    PO('olla', cylY(0.11, 0.016, 36), 'dark', { p: [0, 0.008, 0] });                                       // anafe
    PO('olla', new THREE.TorusGeometry(0.045, 0.004, 6, 30).rotateX(Math.PI / 2), 'iron', { p: [0, 0.019, 0] }); }
  const flame = dyn(PO('olla', new THREE.TorusGeometry(0.038, 0.005, 6, 30).rotateX(Math.PI / 2), 'flame', { p: [0, 0.02, 0] }));
  PO('olla', cylX(0.003, 0.22, 8), 'iron', { p: [0, 0.142, 0] });                                            // varilla de la que cuelga
  PO('olla', cylY(0.0007, 0.035, 6), 'steel', { p: [0, 0.124, 0] });
  const potTh = new THREE.Group(); potTh.position.set(0, 0.075, 0); potTh.rotation.x = Math.PI; potG.add(potTh);
  const potThermo = mkThermostat(potTh, 'olla', { pick: false, noAnchor: true });
  // termómetro de vidrio con su columna roja
  PO('olla', cylY(0.005, 0.2, 12), 'glassc', { p: [0.052, 0.12, 0.028], op: 0.45 });
  const thermCol = dyn(PO('olla', cylY(0.0022, 1, 8), 'red', { p: [0.052, 0.03, 0.028] }));
  for (let k = 0; k <= 10; k++) PO('olla', rbox(0.005, 0.0008, 0.001, 0.0003), 'dark', { p: [0.0575, 0.045 + k * 0.014, 0.028] });   // 0 a 100 °C cada 10
  const potBox = new THREE.Box3().setFromCenterAndSize(POTP.clone().add(V(0, 0.085, 0)), V(0.2, 0.17, 0.2));

  // ════════ RECORRIDOS DEL AGUA Y DEL AIRE (puntos animados) ════════
  const curve = Q => new THREE.CatmullRomCurve3(Q.map(P3), false, 'catmullrom', 0.35);
  const E3 = a => ELa(a.toArray ? a.toArray() : a);
  const pumpC = E3([0.004, 0.115, 0]);
  const MOTOR = [[0.004, 0.115, 0], [-0.008, 0.104, -0.05], [-0.07, 0.112, -0.057], [-0.148, 0.124, -0.057], [-0.226, 0.13, -0.056], [-0.3, 0.134, -0.05],
    [-0.345, 0.152, 0.0], [-0.33, 0.178, 0.04], [-0.31, 0.2, 0.03], [-0.226, 0.205, 0.02], [-0.148, 0.205, 0.026], [-0.07, 0.206, 0.036], [-0.034, 0.214, 0.064],
    [-0.022, 0.228, 0.094], [TC.x, TC.y - 0.004, TC.z - 0.012]].map(E3);
  const thW = E3(TC);
  const RADIN = [thW, E3([TC.x, TC.y, TC.z + 0.012]), E3(thOutA), ...UP, RW(0, YT + 0.004, ZIN)];
  const LANES = [-0.2, -0.1, 0, 0.1, 0.2].map(z => [RW(0, YT + 0.004, ZIN), RW(0, YT, (ZIN + z) / 2), RW(0, YT - 0.01, z), RW(0, CHt / 2, z), RW(0, 0, z), RW(0, -CHt / 2, z), RW(0, YB + 0.01, z), RW(0, YB, (z + ZOUT) / 2), RW(-TD / 2 + 0.004, YB - 0.004, ZOUT)]);
  const toPump = [E3(NIP), E3(T4), E3(T3), E3(T2), E3(T1), E3(T0), pumpC];
  const RADOUT = [RW(-TD / 2 + 0.004, YB - 0.004, ZOUT), outEndW, ...LO.slice(1), ...toPump.slice(1)];
  const BYP = [E3([TC.x, TC.y - 0.012, TC.z - 0.016]), E3(byA), ...BY.slice(0).map(E3), E3(T1), E3(T0), pumpC];
  const MANI = [E3([TC.x - 0.004, 0.24, 0.13]), E3([-0.18, 0.238, 0.142]), E3([-0.33, 0.236, 0.138]), E3(pts.heaterOut)];
  const RET = [E3(HRN), E3([-0.012, 0.024, 0.101]), E3(T2), E3(T1), E3(T0), pumpC];
  const RES = [neckW.clone().add(V(0, -0.012, 0)), RW(ovA.x, ovA.y, ovA.z), ovEndW, ...RH.slice(1), V(DEP.x + 0.012, DEP.y + DH / 2, DEP.z + 0.01), V(DEP.x + 0.012, YRES0 + 0.01, DEP.z + 0.01)];
  const DRAIN = [RW(0.004, -yTop - 0.02, ZDR), RW(0.004, -yTop - 0.08, ZDR), V(RAD.x + 0.01, 0.06, RAD.z + ZDR), V(RAD.x + 0.012, 0.02, RAD.z + ZDR)];
  const NECKB = [RW(0, yTop - 0.01, ZCAP), RW(0, yTop + 0.03, ZCAP), RW(0, yTop + 0.09, ZCAP), RW(0, yTop + 0.15, ZCAP)];
  const RESB = [V(DEP.x + 0.012, YRES0 + 0.012, DEP.z + 0.01), V(DEP.x + 0.01, DEP.y, DEP.z + 0.005), V(DEP.x + 0.008, DEP.y + DH / 2 - 0.01, DEP.z)];
  const POTB = [V(POTP.x - 0.03, 0.028, POTP.z), V(POTP.x - 0.025, 0.07, POTP.z + 0.015), V(POTP.x - 0.02, 0.11, POTP.z - 0.01)];
  // aire: entra por abajo y por delante, cruza el panal, pasa por el ventilador y sale por encima y por debajo del motor
  const AIRL = [];
  for (const yy of [-0.07, 0.06]) for (const zz of [-0.16, 0.02, 0.19]) {
    const f = RW(0.2, yy, zz), c0 = RW(0.03, yy, zz), c1 = RW(-0.03, yy, zz);
    AIRL.push([V(0.46, 0.12, RAD.z + zz * 0.8), V(0.3, 0.2, RAD.z + zz * 0.9), f, c0, c1, V(fanW.x - 0.01, fanW.y + yy * 0.6, fanW.z + zz * 0.45), V(fanW.x - 0.16, fanW.y + yy * 0.9 + 0.04, fanW.z + zz * 0.8), V(-0.45, 0.22 + (yy + 0.08) * 0.8, RAD.z + zz), V(-0.62, 0.1, RAD.z + zz)]);
  }
  const RECIRC = [-0.15, 0.15].map(zz => [V(fanW.x - 0.06, fanW.y + 0.14, fanW.z + zz), V(fanW.x - 0.02, 0.6, RAD.z + zz * 1.2), V(0.16, 0.6, RAD.z + zz * 1.4), V(0.16, 0.48, RAD.z + zz), RW(0.03, 0.06, zz), RW(-0.03, 0.04, zz)]);
  const PATHS = [];
  const addPath = (key, Q, kind, spacing) => { const cv = curve(Q), len = cv.getLength(), n = Math.max(3, Math.round(len / spacing)); PATHS.push({ key, cv, len, n, kind }); };
  addPath('motor', MOTOR, 'w', 0.022);
  addPath('radin', RADIN, 'w', 0.024);
  LANES.forEach((Q, i) => addPath('lane' + i, Q, 'w', 0.024));
  addPath('radout', RADOUT, 'w', 0.024);
  addPath('byp', BYP, 'w', 0.022);
  addPath('mani', MANI, 'w', 0.024);
  if (HT && HT.water) for (const k of ['ida', 'rad', 'vuelta']) { const cv = HT.water[k]; PATHS.push({ key: 'h_' + k, cv, len: cv.getLength(), n: Math.max(3, Math.round(cv.getLength() / 0.03)), kind: 'w' }); }
  addPath('ret', RET, 'w', 0.022);
  addPath('res', RES, 'w', 0.02);
  addPath('drain', DRAIN, 'w', 0.012);
  addPath('neckb', NECKB, 'b', 0.014);
  addPath('resb', RESB, 'b', 0.012);
  addPath('potb', POTB, 'b', 0.012);
  AIRL.forEach((Q, i) => addPath('air' + i, Q, 'a', 0.06));
  RECIRC.forEach((Q, i) => addPath('rec' + i, Q, 'a', 0.045));
  const dot = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d');
    x.beginPath(); x.arc(32, 32, 26, 0, Math.PI * 2); x.fillStyle = '#fff'; x.fill(); x.lineWidth = 6; x.strokeStyle = 'rgba(20,24,30,0.55)'; x.stroke();
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
  const ring = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d');
    x.beginPath(); x.arc(32, 32, 24, 0, Math.PI * 2); x.lineWidth = 7; x.strokeStyle = '#fff'; x.stroke();
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
  const pr = Math.min(window.devicePixelRatio || 1, 2), small = window.innerWidth < 900;
  const mkPoints = (n, size, tex) => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3).fill(-1000), 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 3).fill(1), 3).setUsage(THREE.DynamicDrawUsage));
    const m = new THREE.Points(g, new THREE.PointsMaterial({ size: size * pr, sizeAttenuation: false, vertexColors: true, map: tex, transparent: true, alphaTest: 0.2, depthTest: false, depthWrite: false }));
    m.frustumCulled = false; m.renderOrder = 3; m.userData.noBox = true; m.visible = false; root.add(m); return m;
  };
  const cnt = { w: 0, a: 0, b: 0 };
  for (const p of PATHS) { p.j0 = cnt[p.kind]; cnt[p.kind] += p.n; }
  const PTS = { w: mkPoints(cnt.w, small ? 3.6 : 5, dot), a: mkPoints(cnt.a, small ? 4.2 : 6, dot), b: mkPoints(cnt.b, small ? 4.2 : 6, ring) };
  const col = new THREE.Color(), pos = new THREE.Vector3();
  ctx.setLevel('van');

  // ════════ termostato de cera (lo usan el motor y la olla) ════════
  function mkThermostat(g, part, extra = {}) {
    const T = (geo, kind, o = {}) => add(part, geo, kind, { parent: g, ex: null, ...extra, ...o });
    T(new THREE.RingGeometry(0.017, 0.026, 28).rotateX(-Math.PI / 2), 'steel', { double: true });              // pestaña
    T(cylY(0.0018, 0.004, 8), 'brass', { p: [0.022, 0.001, 0] });                                               // válvula de purga
    for (const s of [-1, 1]) T(rbox(0.004, 0.016, 0.006, 0.001), 'steel', { p: [s * 0.012, 0.008, 0], r: [0, 0, -s * 0.5] });   // puente
    T(rbox(0.012, 0.003, 0.006, 0.001), 'steel', { p: [0, 0.015, 0] });
    T(cylY(0.0018, 0.022, 8), 'machined', { p: [0, 0.004, 0] });                                               // vástago fijo al puente
    for (const s of [-1, 1]) T(rbox(0.003, 0.03, 0.005, 0.001), 'steel', { p: [s * 0.0165, -0.016, 0] });      // marco de abajo
    T(rbox(0.036, 0.003, 0.005, 0.001), 'steel', { p: [0, -0.031, 0] });
    const mv = new THREE.Group(); g.add(mv);                                                                    // lo que se mueve
    add(part, cylY(0.0172, 0.0025, 26), 'brass', { parent: mv, ex: null, ...extra, p: [0, -0.0015, 0] });     // válvula
    add(part, cylY(0.0085, 0.022, 18), 'copper', { parent: mv, ex: null, ...extra, p: [0, -0.015, 0] });     // cápsula de cera
    const spr = add(part, helix(0.0125, 0.027, 4, 0.0011), 'spring', { parent: g, ex: null, ...extra });
    [mv, spr].forEach(dyn); mv.children.forEach(dyn);
    return { set(mm) { const d = mm / 1000; mv.position.y = -d; const top = -0.003 - d, bot = -0.03, h = Math.max(0.006, top - bot); spr.scale.y = h / 0.027; spr.position.y = (top + bot) / 2; } };
  }
  thermo.set(0); potThermo.set(0);

  // ════════ estado, animación y colores ════════
  const st = coolInit();
  st.active = false; st.cut = false; st.showW = true; st.showA = true; st.tw = 0; st.ta = 0; st.proc = null; st.pt = 0; st.pot = null; st.last = null;
  const fl = (t, a, b) => a + (b - a) * Math.max(0, Math.min(1, t));
  // durante el procedimiento manda el paso, no la simulación
  function procView() {
    const P = PROC[st.proc.step], k = Math.min(1, st.pt / 6), hot = P.hot ? fl(k, P.hot[0], P.hot[1]) : 20;
    const level = fl(k, P.level[0], P.level[1]);
    const open = Math.max(0, Math.min(1, (hot - 82) / 13));
    const q = P.run ? 14 : 0;
    return { proc: true, on: !!P.run, Te: hot, Ts: hot, Tr: P.run ? fl(open, 22, hot - 8) : 20, tIn: hot, tOut: P.run ? fl(open, 22, hot - 10) : 20, lift: open * 8, open,
      P: 0, res: st.proc.res ?? (P.resLevel ?? 0.38), Qp: q * (level > 0.5 ? 1 : 0.3), Qr: q * open * 0.6, Qb: q * (1 - open * 0.6) * 0.75, Qh: 0, rpm: P.run ? 900 : 0,
      air: P.run ? 1 : 0.05, airFan: P.run ? 0.95 : 0, TairIn: 20, TairOut: 20 + open * 10, boil: 0, vent: 0, ret: 0, gas: 0, level, drain: !!P.drain && level > 0.01, bubbles: !!P.bubbles && P.run, fluid: P.fluid,
      cap: P.cap, resOut: P.res === 'out', marks: !!P.marks, k };
  }
  function pose(r) {
    thermo.set(r.lift);
    drainG.rotation.y = r.drain ? 1.4 : 0;
    // tapa: puesta, o levantada y corrida a un lado
    const off = r.cap === false;
    capG.position.set(capHome.x + (off ? -0.02 : 0), capHome.y + (off ? 0.07 : 0), capHome.z + (off ? -0.07 : 0));
    capG.rotation.set(off ? 0.5 : 0, off ? 0 : 0, off ? 0.35 : 0);
    // válvulas de la tapa: la de presión sube cuando sale agua al depósito; la de vacío baja cuando vuelve
    pv.position.y = -0.019 + (r.vent > 4e-5 ? 0.003 : 0); vv.position.y = -0.003 - (r.ret > 4e-5 ? 0.0025 : 0);
    // depósito: nivel del líquido; afuera mientras se lava
    const L = Math.max(0, r.res);
    resLiq.visible = L > 0.004; resLiq.scale.y = Math.max(0.001, L * RESK); resLiq.position.set(DEP.x, YRES0 + L * RESK / 2, DEP.z);
    resG.position.set(resHome.x + (r.resOut ? 0.06 : 0), resHome.y + (r.resOut ? 0.16 : 0), resHome.z + (r.resOut ? -0.14 : 0));
    // agua adentro del radiador (con el corte)
    const lv = r.level ?? 1;
    wTop.visible = lv > 0.82; wTop.scale.y = Math.max(0.05, (lv - 0.82) / 0.18); wTop.position.y = YT - (TH - 0.008) * (1 - wTop.scale.y) / 2;
    wBot.visible = lv > 0.02; wBot.scale.y = Math.min(1, lv / 0.2); wBot.position.y = YB - (TH - 0.008) * (1 - wBot.scale.y) / 2;
    wNeck.visible = lv > 0.97;
    const fc = r.fluid === 'old' ? '#8a7a3c' : r.fluid === 'water' ? '#8fc4d8' : '#3fb04a';
    for (const m of [wTop, wBot, wNeck, resLiq]) { m.material.userData.real.set(fc); if (st.active) m.material.color.set(fc); }
    for (const m of marks) m.material.opacity = r.marks ? 1 : 0.8;
  }
  const PATHW = r => {
    const w = {}, on = r.on;
    w.motor = r.Qp; w.radin = r.Qr; for (let i = 0; i < 5; i++) w['lane' + i] = r.Qr / 5 * 1.6; w.radout = r.Qr; w.byp = r.Qb;
    w.mani = r.Qh; w.h_ida = w.h_rad = w.h_vuelta = r.Qh; w.ret = r.Qh;
    w.res = (r.vent > 4e-5 || r.ret > 4e-5) ? 6 : 0;
    w.drain = r.drain ? 10 : 0; w.neckb = r.bubbles || (r.boil > 0.05 && r.cap === false) ? 8 : 0;
    w.resb = (r.gas > 0.002 && r.on) || (r.gv > 1e-5 && r.res > CK.hoseEnd) || (r.vent > 1e-4 && r.boil > 0) ? 6 : 0; w.potb = st.pot && st.pot.T > 92 ? (st.pot.T - 92) : 0;
    for (let i = 0; i < AIRL.length; i++) w['air' + i] = r.air > 0.12 ? r.air : 0;
    for (let i = 0; i < RECIRC.length; i++) w['rec' + i] = r.rec > 0.2 && on ? r.air * 2 : 0;
    return w;
  };
  // temperatura de cada punto según el tramo
  const Tmix = r => (r.Qp > 0.01 ? (r.Qr * r.tOut + r.Qb * r.Te + r.Qh * (r.Te - 8)) / Math.max(0.01, r.Qr + r.Qb + r.Qh) : r.Te);
  function tempAt(key, u, r) {
    if (key === 'motor') return Tmix(r) + (r.Te - Tmix(r)) * Math.min(1, u * 1.2);
    if (key === 'radin' || key === 'byp' || key === 'mani' || key === 'h_ida') return r.Te;
    if (key.startsWith('lane')) return u < 0.3 ? r.Te : r.Te + (r.tOut - r.Te) * Math.min(1, (u - 0.3) / 0.45);
    if (key === 'radout') return u < 0.75 ? r.tOut : r.tOut + (Tmix(r) - r.tOut) * (u - 0.75) / 0.25;
    if (key === 'h_rad') return r.Te - 8 * u;
    if (key === 'h_vuelta' || key === 'ret') return r.Te - 8;
    if (key === 'res' || key === 'resb') return r.Te;
    if (key === 'drain') return r.Te;
    if (key.startsWith('air')) return u < 0.32 ? r.TairIn : r.TairIn + (r.TairOut - r.TairIn) * Math.min(1, (u - 0.32) / 0.12);
    if (key.startsWith('rec')) return r.TairOut;
    return r.Te;
  }
  const FLUIDC = { old: [138, 122, 60], water: [143, 196, 216], mix: [63, 176, 74] };
  function animate(dt, r) {
    st.tw += Math.max(0, dt); st.ta += Math.max(0, dt);
    const w = PATHW(r);
    for (const p of PATHS) {
      const shown = p.kind === 'a' ? st.showA : st.showW;
      const weight = shown ? w[p.key] || 0 : 0;
      const speed = p.kind === 'a' ? 0.08 + 0.11 * r.air : p.kind === 'b' ? 0.06 : p.key === 'res' ? (r.ret > 4e-5 && !(r.vent > 4e-5) ? -0.05 : 0.05) : p.key === 'drain' ? 0.18 : 0.03 + 0.0045 * Math.max(weight, 2);
      const thr = p.kind === 'w' && p.key !== 'res' && p.key !== 'drain' ? 0.6 : 0.01;
      const show = Math.round(p.n * Math.min(1, weight >= thr ? 0.3 + weight / (p.kind === 'a' ? 3 : 18) : 0));
      const G = PTS[p.kind].geometry, PA = G.attributes.position.array, CA = G.attributes.color.array;
      for (let j = 0; j < p.n; j++) {
        const k = (p.j0 + j) * 3;
        if (j >= show) { PA[k] = PA[k + 2] = 0; PA[k + 1] = -1000; continue; }
        const u = (((j / p.n) + st.tw * speed / p.len) % 1 + 1) % 1;
        p.cv.getPointAt(u, pos); PA[k] = pos.x; PA[k + 1] = pos.y; PA[k + 2] = pos.z;
        let c;
        if (p.kind === 'b') c = [235, 240, 245];
        else if (p.key === 'drain' && r.fluid) c = FLUIDC[r.fluid] || FLUIDC.mix;
        else c = coolColor(tempAt(p.key, u, r));
        col.setRGB(c[0] / 255, c[1] / 255, c[2] / 255, THREE.SRGBColorSpace); CA[k] = col.r; CA[k + 1] = col.g; CA[k + 2] = col.b;
      }
    }
    for (const o of Object.values(PTS)) { o.geometry.attributes.position.needsUpdate = true; o.geometry.attributes.color.needsUpdate = true; }
  }
  function potPose() {
    const p = st.pot; potG.visible = !!p;
    if (!p) return;
    potThermo.set(p.lift);
    thermCol.scale.y = Math.max(0.004, 0.015 + p.T * 0.0014); thermCol.position.y = 0.03 + thermCol.scale.y / 2;
    flame.visible = p.on;
  }
  function recompute() {
    if (st.proc) st.last = procView();
    else { st.last = coolRead(st); st.last.cap = true; st.last.level = Math.max(0, 1 - Math.max(0, (st.void || 0) - 0.12) / 1.2); st.last.fluid = 'mix'; }   // lo primero que falta queda arriba, en la calefacción y la caja del termostato
    pose(st.last); potPose(); return st.last;
  }
  function tick(dt) {
    if (!st.active) return false;
    let busy = false;
    if (st.pot) { potStep(st.pot, st.therm, dt); busy = true; }
    else if (st.proc) { st.pt += dt; busy = true; }
    else if (st.on || st.Te > st.amb + 0.5 || Math.abs(st.gauge - 0) > 0.001) { coolStep(st, dt); busy = st.on || st.Te > st.amb + 0.5; }
    const r = recompute();
    animate(dt, r);
    return busy || r.on || r.drain || r.bubbles || !!st.pot;
  }
  function setCuts(on) {
    st.cut = on;
    if (on) { planes.rad.setFromNormalAndCoplanarPoint(V(-1, 0, 0).applyAxisAngle(V(0, 0, 1), RL), RAD.clone().add(V(0.002, 0, 0))); }   // saca la mitad de adelante
    else planes.rad.set(V(0, 1, 0), 1e4);
  }
  function bind(meshes) { press.length = 0; meshes.forEach(m => press.push(m)); }
  const tmpC = new THREE.Color();
  function paint(mode, colorMode) {
    const r = st.last; if (!r || mode !== 'ref' || colorMode !== 'real') return;
    const flow = r.Qr > 0.3;
    const T = { c_up: flow ? r.Te : Math.min(r.Te, r.Tr + 10), c_top: flow ? r.Te : r.Tr, c_core: (r.Te + r.tOut) / 2 * (flow ? 1 : 0) + (flow ? 0 : r.Tr), c_bot: r.tOut, c_low: r.tOut, c_byp: r.Te, c_in: Tmix(r), c_cam: r.Te };
    for (const m of press) {
      const k = m.material.userData.press, t = T[k]; if (t === undefined) continue;
      const c = coolColor(t), a = Math.max(0, Math.min(1, (t - 25) / 70));
      tmpC.setRGB(c[0] / 255, c[1] / 255, c[2] / 255, THREE.SRGBColorSpace);
      if (k === 'c_cam') { m.material.color.copy(m.material.userData.real).lerp(tmpC, 0.15 + 0.35 * a); continue; }
      m.material.color.copy(m.material.userData.real).lerp(tmpC, 0.12 + 0.5 * a);
    }
  }
  function setActive(on) {
    st.active = on; for (const o of Object.values(PTS)) o.visible = on; for (const m of marks) m.visible = on;
    if (!on) { st.pot = null; st.proc = null; potPose(); }
    recompute(); animate(0, st.last);
  }
  function set(o = {}) {
    if ('fail' in o) applyFail(st, o.fail);
    for (const k of ['on', 'scen', 'amb', 'heater', 'therm', 'speed', 'showW', 'showA']) if (k in o) st[k] = o[k];
    if (o.amb !== undefined && !st.on && Math.abs(st.Te - st.Tr) < 1 && st.t === 0) { st.Te = st.Tr = st.TairOut = o.amb; }
    if (o.reset === 'frio') { const keep = { on: st.on, scen: st.scen, amb: st.amb, heater: st.heater, therm: st.therm, speed: st.speed, fail: st.fail };
      Object.assign(st, coolInit(keep)); applyFail(st, st.fail); }
    if (o.refill) refill(st);
    if ('proc' in o) { st.proc = o.proc ? { step: 0, ...o.proc } : null; st.pt = 0; if (st.proc) st.pot = null; }
    if ('step' in o && st.proc) { st.proc.step = Math.max(0, Math.min(PROC.length - 1, o.step)); st.pt = 0; }
    if ('pot' in o) { st.pot = o.pot ? potInit(o.pot === true ? {} : o.pot) : null; if (st.pot) st.proc = null; }
    if (st.pot && 'potOn' in o) st.pot.on = o.potOn;
    if (st.pot && 'potCond' in o) { st.pot.cond = o.potCond; }
    if (st.pot && o.potReset) { st.pot.T = 20; st.pot.lift = 0; st.pot.on = false; st.pot.openT = null; }
    const r = recompute(); animate(0, r); return r;
  }
  function visOmega() { const r = st.last; return r && r.on ? Math.PI * 2 * (0.55 + r.rpm / 2600) : 0; }
  recompute();
  return {
    planes, bind, paint, setCuts, setActive, tick, set, visOmega,
    get state() { return st; }, get result() { return st.last; },
    get potBox() { return potBox; },
    debug(sec) { for (let t = 0; t < sec; t += 0.5) { if (st.pot) potStep(st.pot, st.therm, 0.5); else if (!st.proc) coolStep(st, 0.5 / st.speed); else st.pt += 0.5; } const r = recompute(); animate(0, r); return r; },   // sec: segundos del modelo
    groups: { radiador: [rg], termostato: [thermG], bomba: [E.A.pump], deposito: [resG], olla: [potG], tapa: [capG] },
  };
}

function mergeGeos(list) {
  let n = 0; for (const g of list) n += g.attributes.position.count;
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3); let o = 0; const idx = []; let base = 0;
  for (const g0 of list) {
    const g = g0.index ? g0 : g0; const p = g.attributes.position.array, nn = g.attributes.normal.array;
    pos.set(p, o * 3); nor.set(nn, o * 3);
    if (g.index) for (const i of g.index.array) idx.push(i + base); else for (let i = 0; i < g.attributes.position.count; i++) idx.push(i + base);
    base += g.attributes.position.count; o += g.attributes.position.count;
  }
  const out = new THREE.BufferGeometry(); out.setAttribute('position', new THREE.BufferAttribute(pos, 3)); out.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); out.setIndex(idx);
  return out;
}
