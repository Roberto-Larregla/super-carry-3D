// Furgón SK410 (Chile): volante a la izquierda (−z), furgón ciego (sin vidrios en los costados de carga; portalón con vidrio).
// Un solo modelo: el motor F10A completo va montado bajo los asientos.
import * as THREE from 'three';
import { WB, TF, TR, RW, TILT, ENG } from './geom.js';
import { FINAL } from './data.js';
import { buildEngine } from './engine3d.js';
import { buildBody, buildWheel, BODY, sideSheet, onSide, FUEL_LID } from './body3d.js';
import { PARTS } from './data.js';
import { buildBrakes } from './brakes3d.js';

const EXV = {
  carroceria: [0, 1.25, 0], asientos: [0, 0.9, 0], interior: [0, 0.55, 0], radiador: [0.32, 0.05, 0], deposito: [0.32, 0.15, 0.12], calefactor: [0.35, 0.35, 0],
  controlador: [0.3, 0.45, 0.1], bateria: [0, -0.2, -0.3], bobina: [0, 0.3, 0.2], tablero: [0.3, 0.35, 0],
  estanque: [0, -0.12, -0.42], bomba_comb: [0, -0.1, 0.4], filtro_comb: [0, -0.08, 0.38], catalizador: [0, -0.24, 0.05], silenciador: [0, -0.24, 0.05],
  cardan: [0, -0.16, 0], diferencial: [-0.28, 0, 0], susp_tras: [-0.28, 0, 0], frenos_tras: [-0.28, 0, 0], bomba_freno: [0.3, 0.25, 0],
  direccion: [0.32, 0, 0], palanca: [0.25, 0.3, 0], canerias: [0, -0.08, 0], bastidor: [0, -0.22, 0], mangueras: [0, 0, 0],
  s_bencina: [0, 0.06, -0.42], s_freno: [0.3, 0.25, 0],
  calef_ventilador: [0.12, 0.1, -0.2], calef_llave: [0.15, -0.1, 0.12], calef_mando: [-0.12, 0.12, 0], calef_ductos: [0.05, 0.25, 0], calef_mangueras: [0, -0.06, 0],
  calef_tubo: [-0.1, 0.05, -0.1], deposito_limpia: [0.1, 0.18, -0.12], canister: [0, 0.18, 0.15],
  // marco del motor
  volante_c: [-0.06, 0, 0], embrague: [-0.16, 0, 0], caja: [-0.3, 0, 0], s_retro: [-0.3, 0, 0.06], s_veloc: [-0.3, 0, 0],
};

export function buildVan(ctx) {
  const { V, rbox, cylX, cylY, cylZ, tube, add, group, reg } = ctx;
  const root = ctx.world.root;
  const A = (part, geo, kind, o = {}) => add(part, geo, kind, { ...o, ex: 'ex' in o ? o.ex : EXV[part] });
  const out = { wheels: [], prop: null, fans: [] };
  const lerp3 = (a, b, t) => a + (b - a) * t;

  // ════════ CARROCERÍA (según las fotos) ════════
  const BD = buildBody(ctx);

  // tablero de instrumentos frente al conductor (izquierda)
  A('tablero', rbox(0.09, 0.11, 0.32, 0.02), 'dark', { p: [0.405, 1.065, -0.33] });
  for (const dz of [-0.07, 0.07]) A('tablero', cylX(0.04, 0.006, 28), 'white', { p: [0.358, 1.07, -0.33 + dz], op: 0.9 });

  // ════════ INTERIOR: asientos, piso de carga, cajas de rueda, forros y tablero ════════
  const I = (geo, kind, p, o = {}) => A(o.part || 'interior', geo, kind, { p, body: o.part === 'asientos' ? 'seat' : 'int', ex: 'ex' in o ? o.ex : EXV[o.part || 'interior'], ...o });
  for (const s of [1, -1]) {
    I(rbox(0.46, 0.10, 0.44, 0.045), 'seat', [-0.29, 0.845, s * 0.33], { part: 'asientos' });
    I(rbox(0.40, 0.035, 0.40, 0.01), 'trim', [-0.29, 0.79, s * 0.33], { part: 'asientos' });
    I(rbox(0.10, 0.56, 0.45, 0.05), 'seat', [-0.555, 1.13, s * 0.33], { part: 'asientos', r: [0, 0, 0.17] });
    I(rbox(0.09, 0.19, 0.31, 0.05), 'seat', [-0.612, 1.475, s * 0.33], { part: 'asientos', r: [0, 0, 0.17] });
    I(rbox(0.70, 0.24, 0.18, 0.06), 'floorp', [-WB, 0.745, s * 0.585]);                  // caja de rueda
    // forro azul de los costados de carga: sigue la pared, que se cierra hacia el techo
    I(sideSheet([[-0.64, 0.66], [-1.47, 0.66], [-1.47, 0.885], [-2.20, 0.885], [-2.20, 0.66], [-2.36, 0.66], [-2.33, 1.56], [-0.64, 1.60]], s, -0.014), 'felt', [0, 0, 0], { double: true });
  }
  I(rbox(1.76, 0.012, 1.34, 0.004), 'floorp', [-1.51, 0.624, 0]);                         // piso de carga
  for (let k = -4; k <= 4; k++) I(rbox(1.68, 0.008, 0.034, 0.003), 'floorp', [-1.52, 0.633, k * 0.105]);
  I(rbox(0.022, 0.17, 1.34, 0.006), 'floorp', [-0.62, 0.70, 0]);                          // escalón tras los asientos
  I(rbox(0.56, 0.012, 1.30, 0.004), 'floorp', [-0.335, 0.784, 0]);                       // plataforma de los asientos (tapa del motor)
  I(rbox(0.022, 0.32, 1.30, 0.006), 'floorp', [-0.045, 0.625, 0]);                        // frente de la plataforma
  I(rbox(0.50, 0.012, 1.26, 0.004), 'floorp', [0.36, 0.452, 0]);                          // piso de la cabina
  for (const s of [1, -1]) I(rbox(0.44, 0.008, 0.50, 0.004), 'mat', [0.34, 0.461, s * 0.33]);   // pisos de goma
  // tablero (fotos): plástico gris oscuro; al centro, salidas de aire, mandos, radio 1-DIN y cenicero
  const ZC = -0.03;
  I(rbox(0.20, 0.17, 1.26, 0.03), 'dash', [0.475, 1.02, 0]);
  I(rbox(0.17, 0.025, 1.24, 0.012), 'dash', [0.49, 1.112, 0]);
  I(rbox(0.012, 0.07, 0.44, 0.006), 'dash', [0.372, 0.90, ZC + 0.02]);                      // repisa baja del centro
  I(rbox(0.006, 0.09, 0.165, 0.008), 'dark', [0.373, 1.045, ZC]);                            // nicho de los mandos
  I(rbox(0.006, 0.075, 0.205, 0.008), 'dark', [0.373, 0.972, ZC]);                           // nicho de la radio
  I(rbox(0.012, 0.052, 0.182, 0.004), 'dark', [0.368, 0.972, ZC]);                           // radio 1-DIN (no original)
  I(cylX(0.016, 0.01, 16), 'chrome', [0.362, 0.972, ZC - 0.06]);
  I(rbox(0.008, 0.045, 0.12, 0.006), 'dash', [0.368, 0.915, ZC + 0.035]);                   // cenicero
  I(cylX(0.013, 0.012, 16), 'chrome', [0.366, 0.915, ZC - 0.07]);                           // encendedor
  I(rbox(0.006, 0.032, 0.035, 0.004), 'dark', [0.368, 0.915, ZC - 0.125]);
  for (const z of [0.24, 0.44]) I(rbox(0.006, 0.045, 0.19, 0.006), 'dark', [0.373, 0.962, z]);  // bandejas abiertas
  I(rbox(0.008, 0.10, 0.40, 0.012), 'dash', [0.372, 1.050, 0.34]);                           // tapa de la guantera
  I(rbox(0.11, 0.14, 0.10, 0.02), 'dash', [0.33, 0.95, -0.33]);                              // cubierta de la columna
  I(rbox(0.035, 0.12, 0.08, 0.006), 'brass', [0.47, 0.86, -0.585], { r: [0, 0.3, 0] });     // caja de fusibles (tapa café)

  // ════════ BASTIDOR ════════
  const railShape = new THREE.Shape(); railShape.moveTo(-0.025, -0.05); railShape.lineTo(0.025, -0.05); railShape.lineTo(0.025, 0.05); railShape.lineTo(-0.025, 0.05); railShape.lineTo(-0.025, -0.05);
  for (const s of [1, -1]) {
    const path = new THREE.CatmullRomCurve3([V(0.6, 0.33, s * 0.4), V(-0.2, 0.33, s * 0.4), V(-1.2, 0.33, s * 0.4), V(-1.42, 0.41, s * 0.4), V(-2.32, 0.42, s * 0.4)], false, 'catmullrom', 0.2);
    A('bastidor', new THREE.ExtrudeGeometry(railShape, { steps: 60, extrudePath: path }), 'steel');
  }
  for (const [x, y] of [[0.42, 0.33], [-0.16, 0.33], [-0.96, 0.33], [-1.52, 0.42], [-2.3, 0.42]]) A('bastidor', rbox(0.06, 0.07, 0.78, 0.01), 'steel', { p: [x, y, 0] });

  // ════════ RUEDAS ════════
  for (const [x, z, s] of [[0, TF / 2, 1], [0, -TF / 2, -1], [-WB, TR / 2, 1], [-WB, -TR / 2, -1]]) {
    const w = group('ruedas', root, [x, RW, z], [0, 0, s * 0.5]);
    out.wheels.push(buildWheel(ctx, w, s));
  }

  // ════════ SUSPENSIÓN DELANTERA McPherson ════════
  const helix = ctx.helix;
  for (const s of [1, -1]) {
    const ex = [0, 0, s * 0.3];
    A('susp_del', cylY(0.022, 0.42, 16), 'steel', { p: [-0.02, 0.6, s * 0.485], r: [-s * 0.08, 0, 0], ex });
    A('susp_del', cylY(0.032, 0.2, 16), 'dark', { p: [-0.015, 0.47, s * 0.495], r: [-s * 0.08, 0, 0], ex });
    A('susp_del', helix(0.058, 0.2, 5.5, 0.008), 'steel', { p: [-0.025, 0.66, s * 0.48], r: [-s * 0.08, 0, 0], ex });
    A('susp_del', cylY(0.075, 0.02, 20), 'dark', { p: [-0.03, 0.775, s * 0.475], r: [-s * 0.08, 0, 0], ex });
    A('susp_del', rbox(0.08, 0.16, 0.06, 0.015), 'iron', { p: [0, 0.27, s * 0.5], ex });
    A('susp_del', tube([[0.0, 0.18, s * 0.53], [0.06, 0.2, s * 0.42], [0.12, 0.22, s * 0.32]], 0.016), 'steel', { ex });
    A('susp_del', tube([[0.0, 0.18, s * 0.53], [-0.08, 0.2, s * 0.42], [-0.15, 0.22, s * 0.32]], 0.014), 'steel', { ex });
  }
  A('susp_del', tube([[0.05, 0.19, 0.47], [0.2, 0.21, 0.36], [0.22, 0.22, 0], [0.2, 0.21, -0.36], [0.05, 0.19, -0.47]], 0.011), 'steel');

  // ════════ DIRECCIÓN (volante a la izquierda) ════════
  const DZ = -0.33; // eje del puesto de conducción
  A('direccion', cylZ(0.026, 0.62, 16), 'alu', { p: [0.16, 0.3, 0] });
  for (const s of [1, -1]) {
    A('direccion', cylZ(0.033, 0.07, 12), 'rubber', { p: [0.16, 0.3, s * 0.34] });
    A('direccion', tube([[0.16, 0.3, s * 0.36], [0.15, 0.29, s * 0.45], [0.12, 0.28, s * 0.51]], 0.009), 'steel');
  }
  A('direccion', cylZ(0.034, 0.07, 16), 'alu', { p: [0.165, 0.31, -0.25] }); // caja del piñón
  A('direccion', tube([[0.165, 0.33, -0.25], [0.2, 0.6, -0.29], [0.27, 1.0, DZ], [0.28, 1.06, DZ]], 0.016), 'steel');
  { const sw = A('direccion', new THREE.TorusGeometry(0.19, 0.016, 10, 40), 'dark', { p: [0.29, 1.09, DZ] }); sw.lookAt(V(0.29 - 0.42, 1.09 + 0.9, DZ));
    const hub = A('direccion', cylZ(0.04, 0.05, 16), 'dark', { p: [0.29, 1.085, DZ] }); hub.lookAt(V(0.29 - 0.42, 1.085 + 0.9, DZ));
    for (const a of [0, 2.1, 4.2]) { const sp = A('direccion', rbox(0.17, 0.018, 0.012, 0.005), 'dark', { p: [0.29, 1.09, DZ] }); sp.lookAt(V(0.29 - 0.42, 1.09 + 0.9, DZ)); sp.rotateZ(a); sp.translateX(0.085); } }

  // pedal de embrague (colgante, a la izquierda de la columna; foto) y acelerador de piso. Los frenos van en brakes3d.js
  A('embrague', tube([[0.43, 0.90, -0.44], [0.42, 0.74, -0.44], [0.40, 0.60, -0.44]], 0.01), 'steel');
  A('embrague', rbox(0.012, 0.085, 0.075, 0.01), 'machined', { p: [0.393, 0.575, -0.44], r: [0, 0, 0.25] });
  A('carburador', rbox(0.012, 0.19, 0.06, 0.01), 'steel', { p: [0.385, 0.56, -0.115], r: [0, 0, 0.35] });   // acelerador de piso
  A('carburador', cylZ(0.008, 0.08, 10), 'steel', { p: [0.42, 0.47, -0.115] });

  // ════════ MOTOR F10A COMPLETO (el mismo de la vista Motor) ════════
  const eng = new THREE.Group(); eng.position.set(...ENG); eng.rotation.x = TILT; root.add(eng); eng.updateMatrixWorld(true);
  ctx.setLevel && ctx.setLevel('eng');
  const E = buildEngine(ctx, eng);
  ctx.setLevel && ctx.setLevel('van');
  const EL = (x, y, z) => eng.localToWorld(V(x, y, z));
  const ELv = v => eng.localToWorld(v.clone());
  out.engine = E;

  // embrague, campana, caja (marco del motor)
  A('embrague', cylX(0.09, 0.012, 32), 'copper', { parent: eng, p: [-0.41, 0, 0], ex: EXV.embrague });
  A('embrague', cylX(0.112, 0.022, 32), 'steel', { parent: eng, p: [-0.425, 0, 0], ex: EXV.embrague });
  A('caja', cylX(0.112, 0.13, 32, 0.15), 'alu', { parent: eng, p: [-0.47, 0, 0], op: 0.38, casing: true, ex: EXV.caja });
  A('caja', rbox(0.26, 0.17, 0.16, 0.04), 'alu', { parent: eng, p: [-0.66, 0.0, 0], ex: EXV.caja });
  A('caja', cylX(0.045, 0.12, 20), 'alu', { parent: eng, p: [-0.84, 0, 0], ex: EXV.caja });
  // interruptor de retroceso y toma del velocímetro (en la caja)
  { const a = PARTS.s_retro.sensor.at.eng;
    A('s_retro', cylZ(0.012, 0.008, 6), 'brass', { parent: eng, p: [a[0], a[1], 0.084], ex: EXV.s_retro });
    A('s_retro', cylZ(0.008, 0.014, 14), 'steel', { parent: eng, p: [a[0], a[1], 0.095], ex: EXV.s_retro });
    A('s_retro', cylZ(0.0045, 0.01, 10), 'rubber', { parent: eng, p: [a[0], a[1], 0.106], ex: EXV.s_retro }); }
  { const a = PARTS.s_veloc.sensor.at.eng;
    A('s_veloc', cylZ(0.011, 0.02, 12), 'alu', { parent: eng, p: [a[0], a[1], 0.045], ex: EXV.s_veloc });
    A('s_veloc', cylZ(0.008, 0.012, 6), 'brass', { parent: eng, p: [a[0], a[1], 0.058], ex: EXV.s_veloc }); }
  eng.updateMatrixWorld(true);

  // ════════ FRENOS (detalle en brakes3d.js; vista Frenos) ════════
  const BR = buildBrakes(ctx, { ELv, E });

  // ════════ REFRIGERACIÓN ════════
  const fanW = EL(0.088, 0.115, 0);
  A('radiador', rbox(0.035, 0.34, 0.38, 0.01), 'copper', { p: [fanW.x + 0.075, fanW.y, fanW.z], r: [0, 0, 0.05] });
  A('radiador', rbox(0.05, 0.05, 0.4, 0.01), 'dark', { p: [fanW.x + 0.075, fanW.y + 0.19, fanW.z] });
  A('radiador', rbox(0.05, 0.05, 0.4, 0.01), 'dark', { p: [fanW.x + 0.075, fanW.y - 0.19, fanW.z] });
  A('radiador', cylY(0.02, 0.03, 12), 'chrome', { p: [fanW.x + 0.075, fanW.y + 0.225, fanW.z + 0.12] });
  A('radiador', new THREE.TorusGeometry(0.165, 0.008, 8, 40), 'plastic', { p: [fanW.x + 0.035, fanW.y, fanW.z], r: [0, Math.PI / 2, 0] });
  const th = ELv(E.pts.thermOut), wpIn = ELv(E.pts.wpIn), hOut = ELv(E.pts.heaterOut);
  A('mangueras', tube([[th.x, th.y, th.z], [th.x + 0.08, th.y + 0.04, th.z + 0.02], [fanW.x + 0.075, fanW.y + 0.19, fanW.z + 0.15]], 0.016), 'hose');
  A('mangueras', tube([[fanW.x + 0.075, fanW.y - 0.19, fanW.z - 0.15], [wpIn.x + 0.06, wpIn.y - 0.06, wpIn.z], [wpIn.x, wpIn.y, wpIn.z]], 0.016), 'hose');
  // depósito de expansión tras la torre de la suspensión izquierda (foto bajo el asiento del conductor)
  A('deposito', rbox(0.085, 0.13, 0.085, 0.02), 'ceramic', { p: [-0.04, 0.57, -0.375], op: 0.75 });
  A('deposito', cylY(0.024, 0.016, 16), 'ceramic', { p: [-0.04, 0.643, -0.375] });
  A('deposito', tube([[-0.04, 0.65, -0.375], [-0.02, 0.66, -0.25], [fanW.x + 0.075, fanW.y + 0.24, fanW.z + 0.04], [fanW.x + 0.075, fanW.y + 0.225, fanW.z + 0.12]], 0.004), 'hose');
  // depósito del limpiaparabrisas, junto al anterior y más afuera (misma foto)
  A('deposito_limpia', rbox(0.20, 0.13, 0.12, 0.03), 'ceramic', { p: [-0.18, 0.60, -0.54], op: 0.8 });
  A('deposito_limpia', cylY(0.03, 0.016, 18), 'ceramic', { p: [-0.13, 0.672, -0.55] });
  A('deposito_limpia', cylY(0.016, 0.05, 12), 'dark', { p: [-0.25, 0.52, -0.56] });
  A('deposito_limpia', tube([[-0.25, 0.50, -0.56], [0.0, 0.45, -0.58], [0.40, 0.62, -0.58], [0.55, 1.10, -0.40], [0.58, 1.15, 0.0]], 0.003), 'hose');
  // cánister de vapores de bencina tras la torre derecha (foto bajo el asiento del copiloto; identificación probable)
  A('canister', rbox(0.09, 0.15, 0.12, 0.012), 'dark', { p: [-0.31, 0.64, 0.53] });
  A('canister', cylY(0.032, 0.03, 18), 'dark', { p: [-0.31, 0.73, 0.51] });
  { const ci = ELv(E.pts.carbInlet); A('canister', tube([[-0.31, 0.75, 0.51], [-0.30, 0.76, 0.38], [ci.x + 0.02, ci.y + 0.04, ci.z + 0.06]], 0.004), 'hose'); }
  A('canister', tube([[-0.31, 0.565, 0.56], [-0.45, 0.40, 0.45], [-1.10, 0.33, 0.30], [-1.30, 0.40, 0.24]], 0.004), 'hose');

  // ════════ CALEFACCIÓN (manual secc. 7 + fotos del tablero: caja negra al centro, del tablero al piso) ════════
  const HC = V(0.47, 0.70, 0.0);                                                     // centro de la caja
  const C = (part, geo, kind, p, o = {}) => A(part, geo, kind, { p, ...o });
  C('calefactor', rbox(0.17, 0.42, 0.11, 0.03), 'plastic', [HC.x, HC.y, HC.z + 0.055], { casing: true });  // mitad derecha
  C('calefactor', rbox(0.17, 0.42, 0.11, 0.03), 'plastic', [HC.x, HC.y, HC.z - 0.055], { casing: true });  // mitad izquierda
  C('calefactor', rbox(0.172, 0.40, 0.006, 0.003), 'dark', [HC.x, HC.y, HC.z]);                            // junta vertical con grapas
  for (const dy of [-0.12, 0.10]) C('calefactor', rbox(0.02, 0.026, 0.03, 0.004), 'dark', [HC.x - 0.088, HC.y + dy, HC.z]);
  C('calefactor', rbox(0.045, 0.16, 0.19, 0.006), 'copper', [HC.x + 0.02, HC.y + 0.03, HC.z]);              // radiador de calefacción
  for (const dy of [-0.08, 0.08]) C('calefactor', rbox(0.05, 0.02, 0.20, 0.004), 'alu', [HC.x + 0.02, HC.y + 0.03 + dy, HC.z]);
  for (const dz of [0.03, 0.08]) C('calefactor', cylY(0.009, 0.16, 12), 'alu', [HC.x + 0.055, HC.y - 0.17, HC.z + dz]);   // tubos del radiador (bajan al piso)
  // salida a los pies del acompañante: ducto curvo que baja al piso (foto)
  C('calefactor', tube([[HC.x - 0.03, HC.y - 0.02, HC.z + 0.10], [HC.x - 0.05, HC.y - 0.12, HC.z + 0.18], [0.40, 0.50, 0.26]], 0.035), 'plastic', [0, 0, 0], { casing: true });
  // ventilador: caracol, motor y rotor de jaula (según el dibujo del manual, al lado conductor de la caja)
  const FV = V(HC.x, HC.y + 0.13, HC.z - 0.17);
  C('calef_ventilador', cylZ(0.072, 0.09, 28), 'plastic', FV.toArray(), { casing: true });
  C('calef_ventilador', cylZ(0.042, 0.07, 20), 'dark', [FV.x, FV.y, FV.z - 0.08]);
  C('calef_ventilador', cylZ(0.048, 0.008, 20), 'steel', [FV.x, FV.y, FV.z - 0.047]);
  { const fan = new THREE.Group(); fan.position.copy(FV); root.add(fan); out.fans.push(fan);
    for (let k = 0; k < 18; k++) { const a = k / 18 * Math.PI * 2; add('calef_ventilador', rbox(0.016, 0.004, 0.065, 0.001), 'steel', { parent: fan, p: [Math.cos(a) * 0.05, Math.sin(a) * 0.05, 0], r: [0, 0, a + 0.5], ex: null }); } }
  C('calef_ventilador', rbox(0.05, 0.035, 0.008, 0.003), 'ceramic', [HC.x + 0.05, HC.y + 0.16, HC.z - 0.115]);  // resistencia (3 velocidades)
  C('calef_ventilador', rbox(0.02, 0.02, 0.016, 0.003), 'dark', [HC.x + 0.05, HC.y + 0.185, HC.z - 0.118]);
  // caja con palanca metálica bajo la guantera y ducto corrugado hacia la caja (fotos): probable toma de aire exterior/recirculación
  C('calef_ductos', rbox(0.12, 0.14, 0.12, 0.02), 'plastic', [0.52, 0.80, 0.52], { casing: true });
  C('calef_ductos', rbox(0.012, 0.09, 0.012, 0.003), 'steel', [0.455, 0.86, 0.50], { r: [0.35, 0, 0] });
  C('calef_ductos', tube([[HC.x + 0.03, HC.y + 0.16, HC.z + 0.10], [0.50, 0.88, 0.24], [0.52, 0.86, 0.38], [0.52, 0.82, 0.46]], 0.032, false, 60), 'rubber');
  for (let k = 0; k < 14; k++) { const t = k / 13; C('calef_ductos', new THREE.TorusGeometry(0.034, 0.004, 6, 18), 'dark', [lerp3(HC.x + 0.03, 0.52, t), lerp3(HC.y + 0.16, 0.84, t), lerp3(HC.z + 0.12, 0.46, t)], { r: [0, Math.PI / 2 - 0.4, 0] }); }
  // tubo blanco que baja en diagonal junto al acelerador (fotos; parece ser de la calefacción)
  C('calef_tubo', tube([[0.48, 0.93, -0.16], [0.42, 0.74, -0.13], [0.33, 0.50, -0.085], [0.31, 0.455, -0.08]], 0.034), 'white');
  C('calef_tubo', cylY(0.045, 0.04, 18), 'rubber', [0.31, 0.47, -0.08]);
  // llave de agua en la entrada del radiador, con su cable
  C('calef_llave', rbox(0.035, 0.045, 0.035, 0.006), 'alu', [HC.x + 0.055, HC.y - 0.27, HC.z + 0.08]);
  C('calef_llave', rbox(0.04, 0.006, 0.012, 0.002), 'steel', [HC.x + 0.08, HC.y - 0.26, HC.z + 0.105], { r: [0, 0, 0.5] });
  // ductos del desempañador hacia la base del parabrisas y salidas de aire del tablero (2 al centro, 1 en cada extremo)
  for (const s of [1, -1]) {
    C('calef_ductos', tube([[HC.x + 0.02, HC.y + 0.21, HC.z + s * 0.04], [0.52, 1.02, s * 0.20], [0.55, 1.105, s * 0.36]], 0.02), 'plastic');
    C('calef_ductos', rbox(0.07, 0.006, 0.24, 0.004), 'dark', [0.545, 1.126, s * 0.36]);
    for (let k = 0; k < 5; k++) C('calef_ductos', rbox(0.06, 0.004, 0.006, 0.001), 'plastic', [0.545, 1.13, s * 0.36 - 0.08 + k * 0.04]);
  }
  for (const z of [ZC - 0.114, ZC + 0.114, -0.585, 0.585]) {
    C('calef_ductos', rbox(0.012, 0.064, 0.060, 0.008), 'dark', [0.372, 1.047, z]);
    for (let k = 0; k < 4; k++) C('calef_ductos', rbox(0.014, 0.004, 0.052, 0.001), 'plastic', [0.369, 1.027 + k * 0.013, z]);
  }
  C('calef_ductos', tube([[HC.x, HC.y + 0.21, HC.z], [0.43, 1.02, ZC - 0.05], [0.385, 1.047, ZC - 0.114]], 0.016), 'plastic');
  C('calef_ductos', tube([[HC.x, HC.y + 0.21, HC.z], [0.43, 1.02, ZC + 0.05], [0.385, 1.047, ZC + 0.114]], 0.016), 'plastic');
  // mandos (foto): 3 palancas (salida del aire, recirculación/exterior, frío–calor) y perilla OFF + 3 velocidades
  const CM = V(0.369, 1.045, ZC - 0.012);
  C('calef_mando', rbox(0.006, 0.068, 0.138, 0.005), 'dark', CM.toArray());
  for (const [dy, k] of [[0.022, 0.80], [0.0, 0.05], [-0.022, 0.86]]) {
    C('calef_mando', rbox(0.004, 0.004, 0.086, 0.001), 'plastic', [CM.x - 0.004, CM.y + dy, CM.z - 0.02]);
    C('calef_mando', rbox(0.016, 0.012, 0.012, 0.003), 'dark', [CM.x - 0.01, CM.y + dy, CM.z - 0.063 + k * 0.086]);
  }
  C('calef_mando', rbox(0.004, 0.012, 0.066, 0.001), 'plastic', [CM.x - 0.004, CM.y - 0.012, CM.z - 0.02]);   // escala azul–rojo
  C('calef_mando', cylX(0.016, 0.02, 18), 'dark', [CM.x - 0.012, CM.y + 0.004, CM.z + 0.048]);
  for (const [dy, dz, to] of [[0.022, -0.05, [HC.x - 0.02, HC.y + 0.2, HC.z + 0.06]], [0.0, -0.03, [0.455, 0.90, 0.50]], [-0.022, -0.01, [HC.x + 0.10, HC.y - 0.26, HC.z + 0.105]]])
    C('calef_mando', tube([[CM.x + 0.01, CM.y + dy, CM.z + dz], [CM.x + 0.05, CM.y - 0.05, CM.z + dz + 0.04], to], 0.0025), 'dark');
  // mangueras: entrada caliente desde el múltiple de admisión → llave; salida del radiador → tubo de entrada de agua (bomba)
  const vin = V(HC.x + 0.055, HC.y - 0.295, HC.z + 0.08), vout = V(HC.x + 0.055, HC.y - 0.25, HC.z + 0.03);
  C('calef_mangueras', tube([hOut.toArray(), [hOut.x + 0.1, hOut.y + 0.06, hOut.z - 0.1], [-0.12, 0.66, -0.2], [0.08, 0.62, -0.18], [0.2, 0.43, -0.06], [0.40, 0.40, 0.06], [vin.x, 0.43, vin.z], vin.toArray()], 0.009), 'hose');
  C('calef_mangueras', tube([vout.toArray(), [vout.x, 0.44, vout.z], [vout.x - 0.05, 0.40, vout.z], [0.3, 0.39, 0.04], [0.08, 0.3, 0.05], [0.04, 0.17, 0.0], [-0.14, 0.17, -0.05], [wpIn.x + 0.03, wpIn.y - 0.03, wpIn.z + 0.01], wpIn.toArray()], 0.009), 'hose');

  // ════════ ALIMENTACIÓN ════════
  const carbIn = ELv(E.pts.carbInlet);
  // estanque bajo el piso, del lado de la tapa de bencina (copiloto): posición supuesta
  A('estanque', rbox(0.48, 0.2, 0.3, 0.04), 'steel', { p: [-1.34, 0.29, 0.20] });
  { const f = onSide(FUEL_LID.x, FUEL_LID.y, 1, -0.012);   // cuello de llenado: de la tapa (foto) al estanque (posición supuesta)
    A('estanque', tube([f.toArray(), [f.x - 0.03, f.y - 0.03, f.z - 0.07], [-0.64, 0.45, 0.50], [-0.98, 0.41, 0.40], [-1.14, 0.37, 0.30]], 0.022), 'rubber'); }
  // estanque → filtro → bomba → carburador, por el larguero derecho; retorno por el mismo larguero (manual, secc. 4)
  const RZ = 0.346; // cara interior del larguero derecho
  A('filtro_comb', cylX(0.021, 0.07, 16), 'ceramic', { p: [-1.04, 0.29, RZ], op: 0.85 });
  A('filtro_comb', cylX(0.004, 0.014, 8), 'plastic', { p: [-1.082, 0.29, RZ] });
  A('filtro_comb', cylX(0.004, 0.014, 8), 'plastic', { p: [-0.998, 0.29, RZ] });
  A('bomba_comb', cylX(0.024, 0.09, 16), 'dark', { p: [-0.86, 0.29, RZ] });
  A('bomba_comb', rbox(0.06, 0.012, 0.036, 0.003), 'steel', { p: [-0.86, 0.318, RZ + 0.016] });
  A('bomba_comb', tube([[-1.2, 0.25, 0.20], [-1.16, 0.25, 0.30], [-1.12, 0.27, RZ - 0.01], [-1.089, 0.29, RZ]], 0.004), 'hose');
  A('bomba_comb', tube([[-0.991, 0.29, RZ], [-0.95, 0.29, RZ], [-0.905, 0.29, RZ]], 0.004), 'hose');
  A('bomba_comb', tube([[-0.815, 0.29, RZ], [-0.62, 0.3, RZ - 0.01], [-0.5, 0.42, 0.27], [carbIn.x + 0.03, carbIn.y - 0.04, carbIn.z + 0.04], [carbIn.x, carbIn.y, carbIn.z]], 0.004), 'hose');
  { const cr = ELv(E.pts.carbReturn);
    A('bomba_comb', tube([[cr.x, cr.y, cr.z], [cr.x + 0.03, cr.y - 0.05, cr.z + 0.05], [-0.52, 0.42, 0.29], [-0.64, 0.31, RZ - 0.016], [-1.2, 0.31, RZ - 0.016], [-1.3, 0.35, 0.28], [-1.3, 0.39, 0.12]], 0.003), 'hose'); }
  A('controlador', rbox(0.12, 0.03, 0.09, 0.008), 'dark', { p: [0.50, 0.86, 0.40] });
  { const a = PARTS.s_bencina.sensor.at.w; // aforador en la tapa del estanque
    A('s_bencina', cylY(0.04, 0.012, 24), 'steel', { p: [a[0], a[1] - 0.012, a[2]] });
    A('s_bencina', cylY(0.012, 0.012, 12), 'dark', { p: [a[0], a[1], a[2]] }); }

  // ════════ ELÉCTRICO ════════
  // batería: bajo el piso de carga, a mitad del furgón y un poco hacia el lado del conductor (dato del dueño)
  const BAT = V(-0.95, 0.505, -0.255);
  A('bateria', rbox(0.2, 0.17, 0.13, 0.012), 'plastic', { p: BAT.toArray() });
  A('bateria', rbox(0.21, 0.012, 0.14, 0.004), 'dark', { p: [BAT.x, BAT.y + 0.088, BAT.z] });
  A('bateria', cylY(0.012, 0.025, 10), 'red', { p: [BAT.x + 0.06, BAT.y + 0.105, BAT.z + 0.03] });
  A('bateria', cylY(0.012, 0.025, 10), 'dark', { p: [BAT.x - 0.06, BAT.y + 0.105, BAT.z + 0.03] });
  A('bateria', rbox(0.24, 0.012, 0.03, 0.003), 'steel', { p: [BAT.x, BAT.y - 0.088, BAT.z - 0.05] });                          // bandeja y fijación
  { const st = EL(-0.465, -0.06, 0.134);   // cable positivo al motor de partida y masa al bastidor
    A('bateria', tube([[BAT.x + 0.06, BAT.y + 0.12, BAT.z + 0.03], [BAT.x + 0.14, BAT.y + 0.10, BAT.z + 0.05], [-0.70, 0.46, -0.16], [st.x - 0.03, st.y + 0.04, st.z - 0.02], st.toArray()], 0.006), 'red');
    A('bateria', tube([[BAT.x - 0.06, BAT.y + 0.12, BAT.z + 0.03], [BAT.x - 0.12, BAT.y + 0.06, BAT.z - 0.06], [BAT.x - 0.14, 0.40, -0.40]], 0.005), 'dark'); }
  A('bobina', cylY(0.03, 0.11, 16), 'dark', { p: [-0.78, 0.5, 0.2] });
  const dc = ELv(E.pts.distCenter), dAx = E.pts.distAxis.clone().applyQuaternion(eng.quaternion), dc1 = dc.clone().addScaledVector(dAx, 0.04);
  A('bobina', tube([[-0.78, 0.565, 0.2], [-0.77, 0.6, 0.12], [dc1.x - 0.02, dc1.y + 0.02, dc1.z + 0.06], dc1.toArray(), [dc.x, dc.y, dc.z]], 0.004), 'lead');
  A('interior', rbox(0.17, 0.008, 0.22, 0.004), 'floorp', { p: [dc.x - 0.01, 0.638, dc.z], body: 'int' });   // tapa de acceso al distribuidor
  A('interior', rbox(0.19, 0.006, 0.24, 0.004), 'trim', { p: [dc.x - 0.01, 0.633, dc.z], body: 'int' });

  // ════════ ESCAPE ════════
  const ca = ELv(E.pts.collA), cbx = ELv(E.pts.collB), dn = V(0, -1, 0).applyQuaternion(eng.quaternion), mrg = V(-0.56, 0.14, 0.06);
  for (const [c, dz] of [[ca, -0.012], [cbx, 0.012]]) A('mult_esc', tube([[c.x, c.y, c.z], c.clone().addScaledVector(dn, 0.06).toArray(), [mrg.x + 0.08, mrg.y - 0.005, mrg.z - 0.05 + dz], [mrg.x + 0.02, mrg.y, mrg.z + dz * 0.5], mrg.toArray()], 0.017), 'iron');
  A('mult_esc', tube([mrg.toArray(), [-0.6, 0.15, 0.11], [-0.64, 0.17, 0.17]], 0.022), 'iron');
  A('catalizador', new THREE.CapsuleGeometry(0.065, 0.24, 6, 20).rotateZ(Math.PI / 2), 'chrome', { p: [-0.78, 0.18, 0.18] });
  // silenciador transversal tras el puente; la cola sale atrás a la izquierda (fotos del furgón)
  A('silenciador', tube([[-0.94, 0.18, 0.18], [-1.4, 0.17, 0.2], [-1.84, 0.165, 0.2], [-2.0, 0.22, 0.2], [-2.07, 0.245, 0.205]], 0.022), 'steel');
  A('silenciador', new THREE.CapsuleGeometry(0.072, 0.30, 6, 20).rotateX(Math.PI / 2), 'steel', { p: [-2.13, 0.25, 0.0], s: [1.25, 0.85, 1] });
  A('silenciador', tube([[-2.13, 0.245, -0.2], [-2.2, 0.26, -0.25], [-2.34, 0.30, -0.27], [-2.46, 0.32, -0.27]], 0.02), 'steel');
  A('silenciador', cylX(0.025, 0.06, 18), 'chrome', { p: [-2.46, 0.32, -0.27] });                 // cola: foto de atrás

  // ════════ TREN MOTRIZ ════════
  const gbOut = EL(-0.9, 0, 0);
  const pin = V(-1.66, 0.27, 0.0);
  const prop = new THREE.Group(); prop.position.copy(gbOut); prop.lookAt(pin); root.add(prop); reg(prop, 'cardan', EXV.cardan);
  const plen = gbOut.distanceTo(pin);
  const propSpin = new THREE.Group(); prop.add(propSpin); out.prop = propSpin;
  add('cardan', cylZ(0.024, plen - 0.08, 16), 'steel', { parent: propSpin, p: [0, 0, plen / 2], ex: null });
  add('cardan', new THREE.SphereGeometry(0.034, 12, 10), 'dark', { parent: propSpin, p: [0, 0, 0.03], ex: null });
  add('cardan', new THREE.SphereGeometry(0.034, 12, 10), 'dark', { parent: propSpin, p: [0, 0, plen - 0.03], ex: null });
  A('diferencial', new THREE.SphereGeometry(0.11, 24, 18), 'iron', { p: [-1.8, RW, 0], s: [1, 0.9, 0.8] });
  A('diferencial', cylX(0.05, 0.12, 20), 'iron', { p: [-1.7, RW, 0] });
  A('diferencial', cylZ(0.036, 1.0, 20), 'steel', { p: [-WB, RW, 0] });
  A('palanca', tube([[0.12, 0.46, -0.06], [0.12, 0.7, -0.05], [0.1, 0.92, -0.05]], 0.009), 'steel');
  A('palanca', new THREE.SphereGeometry(0.03, 14, 12), 'dark', { p: [0.1, 0.94, -0.05] });
  A('palanca', rbox(0.1, 0.05, 0.08, 0.01), 'dark', { p: [0.12, 0.44, -0.06] }); // caja de la palanca
  for (const [k, gx] of [[0, -0.585], [1, -0.64]]) {
    const lv = EL(gx, 0.03, 0.084), lv2 = EL(gx, 0.055, 0.1);
    A('palanca', rbox(0.012, 0.05, 0.008, 0.002), 'steel', { p: lv.clone().lerp(lv2, 0.5).toArray(), parent: undefined });
    A('palanca', tube([[0.09 - k * 0.03, 0.43, -0.03 + k * 0.03], [-0.05, 0.39 - k * 0.01, 0.06 + k * 0.025], [-0.3, 0.4, 0.13 + k * 0.02], [lv2.x + 0.06, lv2.y + 0.02, lv2.z + 0.03], lv2.toArray()], 0.005), 'dark');
  }
  const fork = EL(-0.47, 0.06, 0.13);
  A('embrague', tube([[0.43, 0.88, -0.44], [0.41, 0.55, -0.43], [0.36, 0.43, -0.38], [0.0, 0.36, -0.2], [-0.25, 0.36, 0.05], [fork.x, fork.y, fork.z]], 0.004), 'dark');

  // ════════ SUSPENSIÓN TRASERA ════════
  for (const s of [1, -1]) {
    const z = s * 0.42;
    for (let k = 0; k < 4; k++) {
      const half = 0.47 - k * 0.09, yOff = -k * 0.01;
      const path = new THREE.CatmullRomCurve3([V(-WB + half, 0.33 + yOff + k * 0.004, z), V(-WB, 0.225 + yOff, z), V(-WB - half, 0.33 + yOff + k * 0.004, z)], false, 'catmullrom', 0.5);
      const leaf = new THREE.Shape(); leaf.moveTo(-0.004, -0.025); leaf.lineTo(0.004, -0.025); leaf.lineTo(0.004, 0.025); leaf.lineTo(-0.004, 0.025); leaf.lineTo(-0.004, -0.025);
      A('susp_tras', new THREE.ExtrudeGeometry(leaf, { steps: 40, extrudePath: path }), 'steel');
    }
    A('susp_tras', cylZ(0.02, 0.06, 12), 'rubber', { p: [-WB + 0.47, 0.33, z] });
    A('susp_tras', rbox(0.02, 0.09, 0.05, 0.006), 'steel', { p: [-WB - 0.48, 0.37, z], r: [0, 0, 0.15] });
    A('susp_tras', rbox(0.04, 0.05, 0.05, 0.01), 'steel', { p: [-WB + 0.47, 0.375, z] });
    A('susp_tras', cylY(0.02, 0.3, 12), 'dark', { p: [-WB - 0.12, 0.38, s * 0.36], r: [0, 0, 0.35] });
    A('susp_tras', rbox(0.1, 0.03, 0.07, 0.008), 'steel', { p: [-WB, 0.215, z] });
  }

  // ════════ SENSORES DEL CHASIS Y CABLEADO (esquemático) ════════
  // cable del velocímetro (mecánico): caja → tablero
  { const s0 = EL(...PARTS.s_veloc.sensor.at.eng);
    A('s_veloc', tube([[s0.x, s0.y, s0.z], [s0.x + 0.02, s0.y - 0.08, s0.z - 0.08], [-0.9, 0.3, -0.3], [-0.3, 0.36, -0.36], [0.3, 0.42, -0.36], [0.45, 0.75, -0.34], [0.5, 1.03, -0.33]], 0.0045), 'dark', { ex: null }); }
  // mazo esquemático: sólo visible al elegir "Sensores" o un sensor
  const wire = (part, pts) => A(part, tube(pts, 0.0035), 'sensor', { wire: true, pick: false, ex: null });
  const W = id => { const at = PARTS[id].sensor.at; return at.w ? V(...at.w) : EL(...at.eng); };
  const dash = [0.5, 1.0, -0.36], trunkL = z => [[-0.2, 0.42, z], [0.25, 0.44, z], [0.42, 0.62, -0.36], dash];
  { const p = W('s_aceite'); wire('s_aceite', [p.toArray(), [p.x + 0.03, p.y - 0.04, p.z - 0.1], [p.x + 0.08, 0.3, -0.3], [-0.12, 0.36, -0.32], ...trunkL(-0.32)]); }
  { const p = W('s_temp'); wire('s_temp', [p.toArray(), [p.x + 0.05, p.y + 0.05, p.z - 0.1], [-0.1, 0.5, -0.3], [0.25, 0.46, -0.34], [0.42, 0.62, -0.36], dash]); }
  { const p = W('s_termo'); wire('s_termo', [p.toArray(), [p.x + 0.05, p.y + 0.06, p.z + 0.1], [0.0, 0.55, 0.3], [0.35, 0.6, 0.42], [0.6, 0.85, 0.45]]); }
  { const p = W('sonda'); wire('sonda', [p.toArray(), [p.x + 0.04, p.y - 0.04, p.z + 0.08], [-0.2, 0.2, 0.2], [0.2, 0.32, 0.4], [0.45, 0.6, 0.45], [0.6, 0.85, 0.45]]); }
  { const p = W('s_bencina'); wire('s_bencina', [p.toArray(), [-1.24, 0.46, -0.3], [-0.9, 0.42, -0.4], [-0.4, 0.4, -0.4], ...trunkL(-0.4)]); }
  { const p = W('s_freno'); wire('s_freno', [p.toArray(), [0.4, 0.62, -0.45], [0.2, 0.4, -0.45], [-0.8, 0.42, -0.45], [-1.8, 0.48, -0.5], [-2.36, 0.74, -0.6]]);
    wire('s_freno', [[-2.1, 0.5, -0.52], [-2.2, 0.5, 0.2], [-2.36, 0.74, 0.6]]); }
  { const p = W('s_retro'); wire('s_retro', [p.toArray(), [p.x - 0.1, p.y - 0.04, p.z + 0.2], [-1.4, 0.45, 0.45], [-2.2, 0.5, 0.52], [-2.36, 0.68, 0.6]]); }

  // orientación en el piso
  out.ground = groundMarks(ctx);
  { // sombra de contacto suave bajo el furgón
    const c = document.createElement('canvas'); c.width = 256; c.height = 128; const x = c.getContext('2d');
    const gr = x.createRadialGradient(128, 64, 8, 128, 64, 124); gr.addColorStop(0, 'rgba(0,0,0,0.62)'); gr.addColorStop(0.55, 'rgba(0,0,0,0.38)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = gr; x.fillRect(0, 0, 256, 128);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(3.9, 2.05), new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false }));
    m.rotation.x = -Math.PI / 2; m.position.set(-0.88, 0.003, 0); m.renderOrder = 1; m.userData.shadow = 1; out.ground.add(m);
    for (const [x0, z0] of [[0, 0.605], [0, -0.605], [-WB, 0.6], [-WB, -0.6]]) {   // bajo cada neumático
      const w = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.26), new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false, opacity: 0.9 }));
      w.rotation.x = -Math.PI / 2; w.position.set(x0, 0.004, z0); w.renderOrder = 1; w.userData.shadow = 0.9; out.ground.add(w);
    }
  }
  root.add(out.ground);

  function update(theta) {
    E.update(theta);
    out.fans.forEach(f => { f.rotation.z = theta * 0.8; });
    const wheelA = -theta / (1.947 * FINAL);
    setWheels(wheelA, wheelA);
    if (out.prop) out.prop.rotation.z = theta / 1.95;
  }
  // líneas de la carrocería: contorno (rayos X) y juntas de puertas (sólida)
  function setLines(mode, focusBody) {
    const solid = mode === 'solid', hidden = mode === 'hidden';
    BD.outline.visible = !hidden && !solid; BD.outline.material.opacity = focusBody ? 0.75 : 0.42;
    BD.seams.visible = !hidden; BD.seams.material.color.set(solid ? '#5c6468' : '#2f6f7b'); BD.seams.material.opacity = solid ? 0.7 : (focusBody ? 0.6 : 0.4);
  }
  // ruedas con sus discos y tambores; adelante y atrás por separado (una rueda bloqueada no gira)
  function setWheels(aF, aR) { out.wheels.forEach((w, i) => { w.rotation.z = i < 2 ? aF : aR; }); BR.spinRotors(aF, aR); }
  return { update, eng, engine: E, setLines, ground: out.ground, brakes: BR, setWheels };
}

// Flecha "adelante" y lados (conductor a la izquierda) dibujados en el piso
function groundMarks(ctx) {
  const g = new THREE.Group();
  const tex = (w, h, draw) => { const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; const paint = () => { x.clearRect(0, 0, w, h); draw(x); t.needsUpdate = true; }; paint(); document.fonts && document.fonts.ready.then(paint); return t; };
  const plane = (t, w, h, p, rz = 0) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false, opacity: 0.9 })); m.rotation.x = -Math.PI / 2; m.rotation.z = rz; m.position.set(...p); m.renderOrder = 2; g.add(m); return m; };
  const font = (px, wt = 600) => `${wt} ${px}px "Barlow Condensed", "Arial Narrow", sans-serif`;
  // flecha hacia +x; el texto se lee desde el lado del conductor (vista 3/4 por defecto)
  const arrow = tex(512, 160, x => {
    x.fillStyle = 'rgba(194,65,45,0.85)'; x.beginPath(); x.moveTo(12, 80); x.lineTo(92, 20); x.lineTo(92, 56); x.lineTo(240, 56); x.lineTo(240, 104); x.lineTo(92, 104); x.lineTo(92, 140); x.closePath(); x.fill();
    x.fillStyle = '#2a2420'; x.font = font(50); x.textBaseline = 'middle'; x.fillText('ADELANTE', 252, 84);
  });
  const ar = plane(arrow, 1.0, 0.31, [1.3, 0.004, 0], Math.PI); ar.userData.noBox = true;
  const side = (txt, sub) => tex(1024, 128, x => {
    x.fillStyle = '#2a2420'; x.font = font(64); x.textBaseline = 'middle'; x.textAlign = 'center'; x.fillText(txt, 512, sub ? 46 : 64);
    if (sub) { x.fillStyle = '#75685b'; x.font = font(40, 500); x.fillText(sub, 512, 102); }
  });
  plane(side('LADO IZQUIERDO', 'conductor · volante'), 1.7, 0.22, [-0.6, 0.004, -1.0], Math.PI);
  plane(side('LADO DERECHO', 'acompañante'), 1.7, 0.22, [-0.6, 0.004, 1.0], 0);
  g.traverse(o => { o.userData.noBox = true; });
  return g;
}
