// Furgón SK410 (Chile): volante a la izquierda (−z), furgón ciego (sin vidrios en los costados de carga; portalón con vidrio).
// Un solo modelo: el motor F10A completo va montado bajo los asientos.
import * as THREE from 'three';
import { WB, TF, TR, RW, TILT, ENG } from './geom.js';
import { buildEngine } from './engine3d.js';
import { buildBody, buildWheel, BODY, sideSheet, onSide, FUEL_LID } from './body3d.js';
import { PARTS } from './data.js';
import { buildBrakes, hangingPedal } from './brakes3d.js';
import { buildHeater } from './heater3d.js';
import { buildFuel } from './fuel3d.js';
import { buildDrive } from './drive3d.js';

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
    I(rbox(0.50, 0.10, 0.44, 0.045), 'seat', [-0.20, 0.845, s * 0.33], { part: 'asientos' });      // el cojín llega al frente de la caja (foto con la puerta abierta)
    I(rbox(0.44, 0.035, 0.40, 0.01), 'trim', [-0.20, 0.79, s * 0.33], { part: 'asientos' });
    I(rbox(0.10, 0.56, 0.45, 0.05), 'seat', [-0.555, 1.13, s * 0.33], { part: 'asientos', r: [0, 0, 0.17] });
    I(rbox(0.09, 0.19, 0.31, 0.05), 'seat', [-0.612, 1.475, s * 0.33], { part: 'asientos', r: [0, 0, 0.17] });
    I(rbox(0.70, 0.24, 0.18, 0.06), 'floorp', [-WB, 0.745, s * 0.585]);                  // caja de rueda
    // forro azul de los costados de carga: sigue la pared, que se cierra hacia el techo
    I(sideSheet([[-0.64, 0.66], [-1.47, 0.66], [-1.47, 0.885], [-2.20, 0.885], [-2.20, 0.66], [-2.36, 0.66], [-2.33, 1.56], [-0.64, 1.60]], s, -0.014), 'felt', [0, 0, 0], { double: true });
  }
  I(rbox(1.76, 0.012, 1.34, 0.004), 'floorp', [-1.51, 0.624, 0]);                         // piso de carga
  for (let k = -4; k <= 4; k++) I(rbox(1.68, 0.008, 0.034, 0.003), 'floorp', [-1.52, 0.633, k * 0.105]);
  I(rbox(0.022, 0.17, 1.34, 0.006), 'floorp', [-0.62, 0.70, 0]);                          // escalón tras los asientos
  I(rbox(0.735, 0.012, 1.30, 0.004), 'floorp', [-0.2475, 0.784, 0]);                        // plataforma de los asientos (tapa del motor)
  I(rbox(0.022, 0.32, 1.30, 0.006), 'floorp', [0.125, 0.625, 0]);                         // frente de la caja de los asientos: unos 10 cm delante de las torres (foto)
  I(rbox(0.014, 0.085, 0.30, 0.006), 'floorp', [-0.606, 0.715, -0.02]);                  // tapa atornillada en el escalón: acceso a la parte de atrás del motor (foto del piso de carga)
  for (const [dy, dz] of [[-0.03, -0.13], [-0.03, 0.13], [0.03, -0.13], [0.03, 0.13]]) I(cylX(0.005, 0.004, 6), 'chrome', [-0.613, 0.715 + dy, -0.02 + dz]);
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
  for (const [x, y] of [[0.42, 0.33], [0.0, 0.18], [-0.96, 0.33], [-1.52, 0.42], [-2.3, 0.42]]) A('bastidor', rbox(0.06, 0.07, 0.78, 0.01), 'steel', { p: [x, y, 0] });

  // ════════ RUEDAS ════════
  for (const [x, z, s] of [[0, TF / 2, 1], [0, -TF / 2, -1], [-WB, TR / 2, 1], [-WB, -TR / 2, -1]]) {
    const w = group('ruedas', root, [x, RW, z], [0, 0, s * 0.5]);
    out.wheels.push(buildWheel(ctx, w, s));
  }

  // ════════ SUSPENSIÓN DELANTERA McPherson ════════
  const helix = ctx.helix;
  for (const s of [1, -1]) {
    const ex = [0, 0, s * 0.3];
    // el puntal sube inclinado hacia adentro y hacia atrás: su apoyo de arriba queda bajo cada asiento, unos 10 cm detrás del eje
    // (en las fotos bajo los asientos la torre está a media caja; inclinación estimada a partir de ellas)
    const SL = 0.207, sx = y => -(y - 0.3) * Math.tan(SL);
    A('susp_del', cylY(0.022, 0.42, 16), 'steel', { p: [sx(0.6), 0.6, s * 0.485], r: [-s * 0.08, 0, SL], ex });
    A('susp_del', cylY(0.032, 0.2, 16), 'dark', { p: [sx(0.47), 0.47, s * 0.495], r: [-s * 0.08, 0, SL], ex });
    A('susp_del', helix(0.058, 0.2, 5.5, 0.008), 'steel', { p: [sx(0.66), 0.66, s * 0.48], r: [-s * 0.08, 0, SL], ex });
    A('susp_del', cylY(0.075, 0.02, 20), 'dark', { p: [sx(0.775), 0.775, s * 0.475], r: [-s * 0.08, 0, SL], ex });
    A('susp_del', cylY(0.042, 0.03, 20), 'rubber', { p: [sx(0.795), 0.795, s * 0.473], r: [-s * 0.08, 0, SL], ex });          // apoyo de goma y tuerca (lo que se ve bajo el asiento)
    A('susp_del', cylY(0.008, 0.03, 6), 'machined', { p: [sx(0.815), 0.815, s * 0.471], r: [-s * 0.08, 0, SL], ex });
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
  // columna: del volante baja casi vertical entre los pedales de embrague y freno hasta un fuelle en el piso (fotos);
  // bajo el piso, un eje intermedio con crucetas va al piñón de la cremallera
  A('direccion', tube([[0.283, 1.07, DZ], [0.33, 0.93, DZ], [0.385, 0.70, DZ], [0.43, 0.475, DZ]], 0.016, false, 30), 'dark');
  A('direccion', tube([[0.31, 0.99, DZ], [0.36, 0.80, DZ]], 0.03, false, 6), 'plastic');                       // funda de la columna
  A('direccion', rbox(0.05, 0.03, 0.09, 0.006), 'steel', { p: [0.372, 0.80, DZ], r: [0, 0, -0.22] });           // abrazadera bajo el tablero
  A('direccion', new THREE.ConeGeometry(0.04, 0.05, 18), 'rubber', { p: [0.433, 0.478, DZ] });                  // fuelle en el piso
  A('direccion', tube([[0.432, 0.45, DZ], [0.36, 0.40, -0.30], [0.22, 0.345, -0.26], [0.165, 0.33, -0.25]], 0.011, false, 24), 'steel');
  for (const q of [[0.42, 0.44, -0.325], [0.2, 0.34, -0.256]]) A('direccion', new THREE.SphereGeometry(0.018, 10, 8), 'steel', { p: q });   // crucetas
  { const sw = A('direccion', new THREE.TorusGeometry(0.19, 0.016, 10, 40), 'dark', { p: [0.29, 1.09, DZ] }); sw.lookAt(V(0.29 - 0.42, 1.09 + 0.9, DZ));
    const hub = A('direccion', cylZ(0.04, 0.05, 16), 'dark', { p: [0.29, 1.085, DZ] }); hub.lookAt(V(0.29 - 0.42, 1.085 + 0.9, DZ));
    for (const a of [0, 2.1, 4.2]) { const sp = A('direccion', rbox(0.17, 0.018, 0.012, 0.005), 'dark', { p: [0.29, 1.09, DZ] }); sp.lookAt(V(0.29 - 0.42, 1.09 + 0.9, DZ)); sp.rotateZ(a); sp.translateX(0.085); } }

  // (los pedales van más abajo: el de freno en brakes3d.js, el de embrague tras montar el motor y el acelerador en fuel3d.js)

  // ════════ MOTOR F10A COMPLETO (el mismo de la vista Motor) ════════
  const eng = new THREE.Group(); eng.position.set(...ENG); eng.rotation.x = TILT; root.add(eng); eng.updateMatrixWorld(true);
  ctx.setLevel && ctx.setLevel('eng');
  const E = buildEngine(ctx, eng);
  ctx.setLevel && ctx.setLevel('van');
  const EL = (x, y, z) => eng.localToWorld(V(x, y, z));
  const ELv = v => eng.localToWorld(v.clone());
  out.engine = E;

  // embrague, caja, cardán y puente: en drive3d.js (vista Transmisión)
  ctx.setLevel('tra');
  // interruptor de retroceso y toma del velocímetro (en la caja)
  { const a = PARTS.s_retro.sensor.at.eng;
    A('s_retro', cylZ(0.012, 0.008, 6), 'brass', { parent: eng, p: [a[0], a[1], 0.084], ex: EXV.s_retro });
    A('s_retro', cylZ(0.008, 0.014, 14), 'steel', { parent: eng, p: [a[0], a[1], 0.095], ex: EXV.s_retro });
    A('s_retro', cylZ(0.0045, 0.01, 10), 'rubber', { parent: eng, p: [a[0], a[1], 0.106], ex: EXV.s_retro }); }
  { const a = PARTS.s_veloc.sensor.at.eng;
    A('s_veloc', cylZ(0.011, 0.02, 12), 'alu', { parent: eng, p: [a[0], a[1], 0.045], ex: EXV.s_veloc });
    A('s_veloc', cylZ(0.008, 0.012, 6), 'brass', { parent: eng, p: [a[0], a[1], 0.058], ex: EXV.s_veloc }); }
  eng.updateMatrixWorld(true);

  // ════════ PEDAL Y PIOLA DEL EMBRAGUE (fotos de los pedales; manual secc. 11) ════════
  // Pedal colgante a la izquierda de la columna. Junto al eje lleva una palanquita hacia adelante: al pisar, sube y tira de la
  // piola, que baja por el soporte con la tuerca de regulación, cruza el piso y va por el bastidor hasta la palanca de
  // desembrague, en la campana. La palanca gira la horquilla, que empuja el collarín.
  // El eje de la horquilla cruza la campana por arriba del eje de entrada; su palanca queda al lado del conductor, hacia abajo,
  // y la piola la tira hacia adelante (marco de la caja, que va derecha; posición aproximada).
  const relS = [-0.468, 0.085, -0.128], relL = 0.092, relB = V(-0.345, relS[1] - relL + 0.004, relS[2] - 0.016);
  const DR = buildDrive(ctx, { eng, E, relS }), GB = DR.gb;
  ctx.setLevel('tra');
  const CZ = -0.425, CPIV = V(0.505, 0.915, CZ), CEX = [0.3, 0.25, 0], JP = [0.05, -0.012], JZ = -0.014;
  const cg = group('pedal_embrague', root, CPIV.toArray(), CEX);
  const C = (geo, kind, o = {}) => add('pedal_embrague', geo, kind, { parent: cg, ...o });
  C(cylZ(0.008, 0.06, 12), 'machined');
  for (const dz of [-0.024, 0.024]) C(rbox(0.07, 0.11, 0.004, 0.002), 'steel', { p: [0.005, -0.015, dz] });
  C(rbox(0.08, 0.006, 0.052, 0.002), 'steel', { p: [0.01, 0.042, 0] });
  const cpedal = new THREE.Group(); cg.add(cpedal);
  hangingPedal(ctx, 'pedal_embrague', cpedal, { side: -1 });
  add('pedal_embrague', rbox(0.056, 0.014, 0.005, 0.002), 'steel', { parent: cpedal, p: [JP[0] / 2, JP[1] / 2 - 0.002, JZ] });       // palanquita de la piola
  add('pedal_embrague', cylZ(0.004, 0.016, 10), 'machined', { parent: cpedal, p: [JP[0], JP[1], JZ] });                              // pasador
  const cjoint = new THREE.Group(); cg.add(cjoint);                                                                                   // unión de la piola: cuelga del pasador
  add('pedal_embrague', rbox(0.012, 0.034, 0.014, 0.003), 'steel', { parent: cjoint, p: [0, -0.014, 0] });
  add('pedal_embrague', cylY(0.0028, 0.05, 8), 'machined', { parent: cjoint, p: [0, -0.055, 0] });
  const BRK = [JP[0], -0.115, JZ];                                                                                                    // soporte con la regulación (foto: tuerca de bronce)
  C(rbox(0.05, 0.005, 0.03, 0.002), 'dark', { p: [BRK[0] + 0.012, BRK[1], BRK[2]] });
  C(rbox(0.005, 0.04, 0.03, 0.002), 'dark', { p: [BRK[0] + 0.036, BRK[1] + 0.018, BRK[2]] });
  C(cylY(0.0052, 0.05, 10), 'steel', { p: [BRK[0], BRK[1] - 0.004, BRK[2]] });
  C(cylY(0.0088, 0.008, 6), 'brass', { p: [BRK[0], BRK[1] + 0.008, BRK[2]] });
  C(cylY(0.0088, 0.007, 6), 'steel', { p: [BRK[0], BRK[1] - 0.008, BRK[2]] });
  const cwire = add('pedal_embrague', cylY(0.0016, 1, 6), 'machined', { parent: cg }); cwire.userData.dyn = true;                    // alma de la piola, a la vista
  // funda: del soporte al piso y por el bastidor izquierdo hasta el soporte de la campana (recorrido según el manual, espejado)
  { const b0 = CPIV.clone().add(V(BRK[0], BRK[1] - 0.03, BRK[2])), e = GB.localToWorld(relB.clone());
    A('pedal_embrague', tube([b0, [0.565, 0.62, CZ - 0.02], [0.555, 0.47, CZ - 0.015], [0.5, 0.39, -0.415], [0.25, 0.36, -0.345], [0.02, 0.36, -0.33], [-0.2, 0.34, -0.3], [e.x + 0.1, e.y + 0.004, e.z - 0.03], e], 0.0052, false, 110), 'rubber');
    A('pedal_embrague', cylY(0.011, 0.008, 14), 'rubber', { p: [0.553, 0.456, CZ - 0.015] }); }                                    // pasa-piso
  // en la campana: soporte de la funda, alma, palanca de desembrague y eje de la horquilla
  const CE = (geo, kind, o = {}) => add('pedal_embrague', geo, kind, { parent: GB, ex: null, ...o });
  CE(rbox(0.006, 0.03, 0.022, 0.002), 'steel', { p: [relB.x, relB.y + 0.008, relB.z] });
  CE(rbox(0.03, 0.006, 0.022, 0.002), 'steel', { p: [relB.x - 0.012, relB.y + 0.024, relB.z + 0.004] });
  CE(cylZ(0.0075, 0.05, 12), 'machined', { p: [relS[0], relS[1], relS[2] + 0.012] });                                                // eje de la horquilla
  const rel = new THREE.Group(); rel.position.set(...relS); GB.add(rel);
  add('pedal_embrague', rbox(0.016, relL + 0.016, 0.006, 0.003), 'steel', { parent: rel, p: [0, -relL / 2, -0.016] });
  add('pedal_embrague', cylZ(0.0045, 0.014, 10), 'machined', { parent: rel, p: [0, -relL, -0.016] });
  add('pedal_embrague', cylZ(0.011, 0.012, 14), 'steel', { parent: rel, p: [0, 0, -0.016] });
  const rwire = add('pedal_embrague', cylX(0.0016, 1, 6), 'machined', { parent: GB, ex: null }); rwire.userData.dyn = true;
  { const sp = add('pedal_embrague', ctx.helix(0.005, 0.05, 8, 0.001).rotateZ(Math.PI / 2), 'steel', { parent: GB, p: [relS[0] - 0.03, relS[1] - relL * 0.6, relS[2] - 0.016], ex: null }); sp.userData.dyn = true; }
  function poseClutch(k) {
    const a = 0.30 * k, c = Math.cos(a), sn = Math.sin(a);
    cpedal.rotation.z = a;
    const px = JP[0] * c - JP[1] * sn, py = JP[0] * sn + JP[1] * c;
    cjoint.position.set(px, py, JZ);
    const top = py - 0.08, bot = BRK[1] + 0.02;                                           // alma entre la unión y la regulación
    cwire.position.set((px + BRK[0]) / 2, (top + bot) / 2, JZ); cwire.scale.y = Math.max(0.002, Math.hypot(px - BRK[0], top - bot)); cwire.rotation.z = Math.atan2(BRK[0] - px, top - bot);
    const pull = py - JP[1];                                                              // lo que sube el pasador es lo que avanza la palanca de desembrague
    rel.rotation.z = DR.clutchPose(k);                                                    // mismo eje que la horquilla: el giro lo fija el recorrido del collarín
    const tx = relS[0] + Math.sin(rel.rotation.z) * relL, x0 = relB.x - 0.003;
    rwire.position.set((tx + x0) / 2, relB.y - 0.004, relB.z); rwire.scale.x = Math.max(0.002, x0 - tx);
  }
  poseClutch(0); DR.bindClutch(poseClutch);
  ctx.setLevel('van');

  // ════════ FRENOS (detalle en brakes3d.js; vista Frenos) ════════
  const BR = buildBrakes(ctx, { ELv, E });

  // ════════ REFRIGERACIÓN ════════
  // Radiador: justo detrás del frente de la caja de los asientos, algo corrido a la derecha, con la tapa al lado del conductor
  // y la entrada de la manguera superior al lado del copiloto (fotos bajo los dos asientos). Inclinación: supuesta.
  const fanW = EL(0.088, 0.115, 0);
  const RAD = V(0.068, fanW.y + 0.01, 0.03), RL = -0.12;                // centro e inclinación (arriba hacia adelante)
  const rg = group('radiador', root, RAD.toArray(), EXV.radiador); rg.rotation.z = RL;
  const RA = (geo, kind, o = {}) => add('radiador', geo, kind, { parent: rg, ...o });
  RA(rbox(0.035, 0.34, 0.38, 0.01), 'copper');
  RA(rbox(0.05, 0.05, 0.4, 0.01), 'dark', { p: [0, 0.19, 0] });
  RA(rbox(0.05, 0.05, 0.4, 0.01), 'dark', { p: [0, -0.19, 0] });
  RA(cylY(0.017, 0.03, 14), 'steel', { p: [0, 0.225, -0.13] });                               // boca de llenado
  RA(cylY(0.024, 0.012, 20), 'chrome', { p: [0, 0.244, -0.13] });                             // tapa (lado conductor)
  RA(cylX(0.016, 0.04, 14), 'dark', { p: [-0.04, 0.19, 0.12] });                              // entrada de la manguera superior (lado copiloto)
  RA(cylX(0.016, 0.04, 14), 'dark', { p: [-0.04, -0.19, -0.12] });                            // salida inferior
  rg.updateMatrixWorld(true);
  const rIn = rg.localToWorld(V(-0.06, 0.19, 0.12)), rOut = rg.localToWorld(V(-0.06, -0.19, -0.12)), rCap = rg.localToWorld(V(0.018, 0.236, -0.13));
  // cubierta del ventilador: del marco del radiador al aro que rodea las aspas
  A('radiador', new THREE.TorusGeometry(0.165, 0.008, 8, 40), 'plastic', { p: [fanW.x + 0.035, fanW.y, fanW.z], r: [0, Math.PI / 2, 0] });
  { const g = new THREE.CylinderGeometry(0.168, 0.2, 0.05, 28, 1, true); g.rotateZ(Math.PI / 2); A('radiador', g, 'plastic', { p: [fanW.x + 0.058, fanW.y, fanW.z + 0.03], double: true, op: 0.9 }); }
  const th = ELv(E.pts.thermOut), wpIn = ELv(E.pts.wpIn), hOut = ELv(E.pts.heaterOut);
  A('mangueras', tube([[th.x, th.y, th.z], [th.x + 0.05, th.y + 0.05, th.z + 0.03], [rIn.x - 0.06, rIn.y + 0.03, rIn.z + 0.02], rIn], 0.016), 'hose');
  A('mangueras', tube([rOut, [rOut.x - 0.05, rOut.y - 0.02, rOut.z], [wpIn.x + 0.06, wpIn.y - 0.06, wpIn.z], [wpIn.x, wpIn.y, wpIn.z]], 0.016), 'hose');
  // depósito de expansión: entre la torre izquierda y el motor, adelante (foto bajo el asiento del conductor)
  const DEP = V(-0.055, 0.585, -0.33);
  A('deposito', rbox(0.095, 0.13, 0.085, 0.022), 'ceramic', { p: DEP.toArray(), op: 0.78 });
  A('deposito', cylY(0.026, 0.016, 18), 'ceramic', { p: [DEP.x, DEP.y + 0.073, DEP.z] });
  A('deposito', cylY(0.005, 0.012, 8), 'ceramic', { p: [DEP.x - 0.012, DEP.y + 0.085, DEP.z + 0.004] });
  A('deposito', tube([[DEP.x - 0.012, DEP.y + 0.09, DEP.z + 0.004], [DEP.x - 0.03, DEP.y + 0.085, DEP.z + 0.03], [rCap.x - 0.07, rCap.y - 0.04, rCap.z - 0.07], [rCap.x - 0.02, rCap.y - 0.012, rCap.z - 0.02]], 0.0045), 'hose');
  // depósito del limpiaparabrisas: detrás del anterior, también por dentro de la torre (misma foto)
  const LAV = V(-0.275, 0.60, -0.34);
  A('deposito_limpia', rbox(0.21, 0.13, 0.115, 0.03), 'ceramic', { p: LAV.toArray(), op: 0.8 });
  A('deposito_limpia', cylY(0.03, 0.014, 18), 'ceramic', { p: [LAV.x + 0.03, LAV.y + 0.07, LAV.z - 0.012] });
  A('deposito_limpia', cylY(0.016, 0.05, 12), 'dark', { p: [LAV.x - 0.075, LAV.y - 0.08, LAV.z - 0.01] });
  A('deposito_limpia', tube([[LAV.x - 0.075, LAV.y - 0.1, LAV.z - 0.01], [0.0, 0.45, -0.58], [0.40, 0.62, -0.58], [0.55, 1.10, -0.40], [0.58, 1.15, 0.0]], 0.003), 'hose');
  const CAN = V(-0.21, 0.64, 0.415);   // cánister: tras la torre derecha, sobre el borde del paso de rueda (foto bajo el asiento del copiloto)

  // ════════ CALEFACCIÓN (detalle en heater3d.js; vista Calefacción) ════════
  const HT = buildHeater(ctx, { hOut, wpIn });
  out.fans.push(HT.fan);

  // ════════ ALIMENTACIÓN (detalle en fuel3d.js; vista Alimentación) ════════
  const FU = buildFuel(ctx, { E, eng, CAN });
  A('controlador', rbox(0.12, 0.03, 0.09, 0.008), 'dark', { p: [0.50, 0.86, 0.40] });

  // ════════ ELÉCTRICO ════════
  // batería: bajo el piso de carga, a mitad del furgón y un poco hacia el lado del conductor (dato del dueño)
  const BAT = V(-1.37, 0.505, -0.19);   // bajo la tapa que se ve abierta en la foto del piso de carga
  A('bateria', rbox(0.2, 0.17, 0.13, 0.012), 'plastic', { p: BAT.toArray() });
  A('bateria', rbox(0.21, 0.012, 0.14, 0.004), 'dark', { p: [BAT.x, BAT.y + 0.088, BAT.z] });
  A('bateria', cylY(0.012, 0.025, 10), 'red', { p: [BAT.x + 0.06, BAT.y + 0.105, BAT.z + 0.03] });
  A('bateria', cylY(0.012, 0.025, 10), 'dark', { p: [BAT.x - 0.06, BAT.y + 0.105, BAT.z + 0.03] });
  A('bateria', rbox(0.24, 0.012, 0.03, 0.003), 'steel', { p: [BAT.x, BAT.y - 0.088, BAT.z - 0.05] });                          // bandeja y fijación
  { const st = EL(-0.465, -0.06, 0.134);   // cable positivo al motor de partida y masa al bastidor
    A('bateria', tube([[BAT.x + 0.06, BAT.y + 0.12, BAT.z + 0.03], [BAT.x + 0.14, BAT.y + 0.10, BAT.z + 0.05], [-0.95, 0.45, -0.12], [st.x - 0.03, st.y + 0.04, st.z - 0.02], st.toArray()], 0.006), 'red');
    A('bateria', tube([[BAT.x - 0.06, BAT.y + 0.12, BAT.z + 0.03], [BAT.x - 0.12, BAT.y + 0.06, BAT.z - 0.06], [BAT.x - 0.14, 0.40, -0.40]], 0.005), 'dark'); }
  A('bobina', cylY(0.03, 0.11, 16), 'dark', { p: [-0.78, 0.5, 0.2] });
  const dc = ELv(E.pts.distCenter), dAx = E.pts.distAxis.clone().applyQuaternion(eng.quaternion), dc1 = dc.clone().addScaledVector(dAx, 0.04);
  A('bobina', tube([[-0.78, 0.565, 0.2], [-0.77, 0.6, 0.12], [dc1.x - 0.02, dc1.y + 0.02, dc1.z + 0.06], dc1.toArray(), [dc.x, dc.y, dc.z]], 0.004), 'lead');
  A('interior', rbox(0.36, 0.008, 0.29, 0.004), 'floorp', { p: [BAT.x, 0.638, BAT.z], body: 'int' });   // tapa del piso de carga sobre la batería (foto)
  A('interior', rbox(0.38, 0.006, 0.31, 0.004), 'trim', { p: [BAT.x, 0.633, BAT.z], body: 'int' });

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
    if (!DR.active) DR.kin(theta, setWheels);
  }
  // líneas de la carrocería: contorno (rayos X) y juntas de puertas (sólida)
  function setLines(mode, focusBody) {
    const solid = mode === 'solid', hidden = mode === 'hidden';
    BD.outline.visible = !hidden && !solid; BD.outline.material.opacity = focusBody ? 0.75 : 0.42;
    BD.seams.visible = !hidden; BD.seams.material.color.set(solid ? '#5c6468' : '#2f6f7b'); BD.seams.material.opacity = solid ? 0.7 : (focusBody ? 0.6 : 0.4);
  }
  // al elegir un pedal en el modelo, se pisa solo y muestra qué mueve (ciclo: pisar, sostener, soltar, pausa)
  const cyc = t => { const u = t % 3.2; return u < 0.8 ? u / 0.8 : u < 1.5 ? 1 : u < 2.3 ? 1 - (u - 1.5) / 0.8 : 0; };
  const ease = k => k * k * (3 - 2 * k);
  const demos = [
    { ids: ['pedal_embrague', 'embrague', 'emb_collarin', 'emb_disco'], k: 0, t: 0, pose: poseClutch, skip: m => m === 'tra' },
    { ids: ['pedal_freno', 's_freno'], k: 0, t: 0, pose: k => BR.demoPedal(k), skip: m => m === 'brk' },
    { ids: ['pedal_acel'], k: 0, t: 0, pose: k => FU.demo('pedal', k), skip: m => m === 'ali' },
    { ids: ['ahogador'], k: 0, t: 0, pose: k => FU.demo('choke', k), skip: m => m === 'ali' },
  ];
  function tick(dt, sel, mode) {
    let active = false;
    for (const d of demos) {
      if (d.skip && d.skip(mode)) { d.t = 0; d.k = 0; continue; }
      if (d.ids.includes(sel)) { d.t += dt; d.k = ease(cyc(d.t)); d.pose(d.k); active = true; }
      else if (d.k > 0 || d.t > 0) { d.t = 0; d.k = Math.max(0, d.k - dt * 3); d.pose(d.k); active = d.k > 0; }
    }
    return active;
  }
  // ruedas con sus discos y tambores; adelante y atrás por separado (una rueda bloqueada no gira)
  function setWheels(aF, aR, aRL = aR) { out.wheels.forEach((w, i) => { w.rotation.z = i < 2 ? aF : i === 2 ? aR : aRL; }); BR.spinRotors(aF, aR, aRL); }   // traseras por separado: derecha, izquierda
  return { update, tick, demos, eng, engine: E, setLines, ground: out.ground, brakes: BR, heater: HT, fuel: FU, drive: DR, setWheels };
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
