// Alimentación del SK410 en detalle (manual secc. 4 y 5 + fotos de los pedales y bajo el asiento del copiloto):
// estanque con su aforador, filtro y bomba eléctrica en el larguero derecho, líneas de alimentación, retorno y vapores,
// cánister, carburador de tiro horizontal abierto en corte (cuba, flotador y aguja, surtidores, mariposas, bomba de
// aceleración, solenoide de corte), pedal del acelerador con su piola y ahogador con la suya.
// Del manual: el orden estanque → filtro → bomba → carburador, el retorno al estanque, la bomba y el filtro en el larguero
// derecho y los circuitos del carburador. De las fotos: el pedal, el filtro de aire y el cánister. El estanque, el recorrido
// de las líneas bajo el piso y el interior del carburador (cotas) son aproximados.
import * as THREE from 'three';
import { onSide, FUEL_LID } from './body3d.js';
import { fuelSolve } from './fuelsim.js';

const COL = { fuel: [226, 150, 40], air: [150, 196, 226], mix: [236, 214, 150], vap: [170, 190, 150], ret: [200, 128, 60] };

export function buildFuel(ctx, { E, eng, CAN }) {
  const { V, rbox, cylX, cylY, cylZ, tube, helix, add, group } = ctx;
  const root = ctx.world.root, carbG = E.carbG;
  const dyn = m => { m.userData.dyn = true; return m; };
  const P3 = p => (p.isVector3 ? p : V(...p));
  const planes = { carb: new THREE.Plane(V(0, 1, 0), 1e4), tank: new THREE.Plane(V(0, 1, 0), 1e4) };
  const EXV = { estanque: [0, -0.12, 0.3], bomba_comb: [0, -0.1, 0.4], filtro_comb: [0, -0.08, 0.38], lineas_comb: [0, -0.05, 0.2], canister: [0, 0.18, 0.15], pedal_acel: [0.25, 0.2, 0], ahogador: [-0.1, 0.1, -0.1], s_bencina: [0, 0.06, 0.3] };
  ctx.setLevel('ali');
  const A = (part, geo, kind, o = {}) => add(part, geo, kind, { ex: 'ex' in o ? o.ex : EXV[part], ...o });

  // ════════ ESTANQUE (bajo el piso de carga, al lado derecho; posición supuesta) ════════
  const TK = V(-1.35, 0.335, 0.19), TS = [0.54, 0.22, 0.28], TTOP = TK.y + TS[1] / 2;
  A('estanque', rbox(TS[0], TS[1], TS[2], 0.035), 'steel', { p: TK.toArray(), cut: 'xray', double: true });
  for (const dx of [-0.16, 0.16]) A('estanque', rbox(0.03, 0.006, TS[2] + 0.03, 0.002), 'dark', { p: [TK.x + dx, TK.y - TS[1] / 2 - 0.003, TK.z] });   // cintas
  for (const dx of [-0.12, 0.12]) A('estanque', rbox(0.004, TS[1] - 0.05, TS[2] - 0.05, 0.002), 'steel', { p: [TK.x + dx, TK.y, TK.z], cut: 'xray' });   // rompeolas
  const fuelLvl = dyn(A('estanque', rbox(TS[0] - 0.016, 1, TS[2] - 0.016, 0.004), 'fluid', { p: [TK.x, TK.y, TK.z], ex: null, op: 0.82 }));
  // boca de llenado: de la tapa (foto) al estanque, con su respiradero
  { const f = onSide(FUEL_LID.x, FUEL_LID.y, 1, -0.012);
    A('estanque', tube([f.toArray(), [f.x - 0.03, f.y - 0.03, f.z - 0.07], [-0.64, 0.47, 0.50], [-0.93, 0.455, 0.40], [TK.x + 0.2, TTOP + 0.01, TK.z + 0.09]], 0.022, false, 60), 'rubber');
    A('estanque', tube([[f.x - 0.02, f.y + 0.005, f.z - 0.04], [-0.62, 0.50, 0.48], [-0.93, 0.48, 0.37], [TK.x + 0.12, TTOP + 0.012, TK.z + 0.05]], 0.006, false, 50), 'hose'); }
  // unidad de la tapa: aforador con flotador (sensor 6) y tubo de toma con colador
  const SU = V(TK.x + 0.11, TTOP, TK.z - 0.03);
  A('s_bencina', cylY(0.04, 0.012, 24), 'steel', { p: [SU.x, SU.y + 0.004, SU.z] });
  A('s_bencina', cylY(0.012, 0.012, 12), 'dark', { p: [SU.x, SU.y + 0.016, SU.z] });
  A('s_bencina', rbox(0.014, 0.05, 0.03, 0.003), 'ceramic', { p: [SU.x, SU.y - 0.035, SU.z] });                 // resistencia
  const sender = group('s_bencina', root, [SU.x, SU.y - 0.045, SU.z], EXV.s_bencina);
  A('s_bencina', cylX(0.0018, 0.15, 6), 'machined', { parent: sender, p: [-0.075, 0, 0], ex: null });
  A('s_bencina', cylZ(0.016, 0.03, 14), 'beige', { parent: sender, p: [-0.15, 0, 0], ex: null });
  const PICK = V(TK.x - 0.02, TTOP, TK.z + 0.06);
  A('estanque', cylY(0.004, TS[1] - 0.03, 8), 'steel', { p: [PICK.x, TK.y + 0.01, PICK.z] });
  A('estanque', cylY(0.012, 0.02, 12), 'brass', { p: [PICK.x, TK.y - TS[1] / 2 + 0.03, PICK.z] });               // colador

  // ════════ FILTRO Y BOMBA ELÉCTRICA (larguero derecho, por dentro; manual) ════════
  const RZ = 0.35, RY = 0.335;
  A('filtro_comb', cylX(0.021, 0.07, 18), 'ceramic', { p: [-1.04, RY, RZ], op: 0.85 });
  A('filtro_comb', cylX(0.016, 0.05, 14), 'beige', { p: [-1.04, RY, RZ] });                                       // elemento
  for (const dx of [-0.042, 0.042]) A('filtro_comb', cylX(0.004, 0.016, 8), 'plastic', { p: [-1.04 + dx, RY, RZ] });
  A('filtro_comb', rbox(0.02, 0.05, 0.006, 0.002), 'steel', { p: [-1.04, RY + 0.01, RZ + 0.022] });               // abrazadera al larguero
  const PU = V(-0.86, RY, RZ - 0.004);
  A('bomba_comb', cylX(0.026, 0.07, 20), 'dark', { p: PU.toArray(), cut: 'xray' });                               // bobina
  A('bomba_comb', cylX(0.03, 0.016, 20), 'steel', { p: [PU.x - 0.042, PU.y, PU.z], cut: 'xray' });                // tapa de las válvulas
  A('bomba_comb', cylX(0.022, 0.014, 18), 'steel', { p: [PU.x + 0.04, PU.y, PU.z] });                             // tapa del contactor
  for (const dy of [-0.014, 0.014]) A('bomba_comb', cylX(0.004, 0.02, 8), 'brass', { p: [PU.x - 0.058, PU.y + dy, PU.z] });
  A('bomba_comb', rbox(0.07, 0.012, 0.03, 0.003), 'steel', { p: [PU.x, PU.y + 0.03, PU.z + 0.012] });             // soporte
  A('bomba_comb', tube([[PU.x + 0.047, PU.y + 0.008, PU.z], [PU.x + 0.08, PU.y + 0.04, PU.z - 0.01], [PU.x + 0.2, PU.y + 0.05, PU.z - 0.02]], 0.0025), 'lead');   // cable (con el contacto puesto)
  const plunger = dyn(A('bomba_comb', cylX(0.008, 0.03, 12), 'machined', { p: PU.toArray(), ex: null }));
  const diaph = dyn(A('bomba_comb', cylX(0.022, 0.003, 18), 'hose2', { p: [PU.x - 0.03, PU.y, PU.z], ex: null }));

  // ════════ LÍNEAS: alimentación, retorno y vapores (manual: tres líneas; recorrido aprox.) ════════
  carbG.updateMatrixWorld(true);
  const CW = (x, y, z) => carbG.localToWorld(V(x, y, z));
  const cIn = CW(-0.01, -0.03, 0.074), cRet = CW(-0.024, -0.03, 0.074);
  const FEED1 = [[PICK.x, TTOP + 0.012, PICK.z], [PICK.x + 0.02, TTOP + 0.03, PICK.z + 0.06], [-1.2, 0.44, RZ - 0.02], [-1.12, RY + 0.02, RZ], [-1.082, RY, RZ]];
  const FEED2 = [[-0.998, RY, RZ], [-0.95, RY - 0.014, RZ], [PU.x - 0.068, PU.y - 0.014, PU.z]];
  const FEED3 = [[PU.x - 0.068, PU.y + 0.014, PU.z], [PU.x - 0.08, PU.y + 0.05, PU.z + 0.012], [-0.78, 0.39, RZ + 0.012], [-0.6, 0.39, RZ + 0.012], [-0.47, 0.42, 0.33], [cIn.x - 0.02, cIn.y - 0.1, cIn.z + 0.12], [cIn.x, cIn.y - 0.02, cIn.z + 0.03], cIn];
  const RETL = [cRet, [cRet.x, cRet.y - 0.03, cRet.z + 0.03], [cRet.x - 0.03, cRet.y - 0.12, cRet.z + 0.12], [-0.5, 0.41, 0.345], [-0.62, 0.405, RZ + 0.02], [-1.14, 0.405, RZ + 0.02], [-1.26, 0.47, TK.z + 0.1], [TK.x + 0.03, TTOP + 0.012, TK.z + 0.02]];
  const VAP1 = [[TK.x - 0.12, TTOP + 0.012, TK.z - 0.04], [TK.x - 0.1, TTOP + 0.04, TK.z + 0.08], [-1.2, 0.47, RZ + 0.03], [-0.7, 0.47, RZ + 0.03], [-0.42, 0.5, 0.40], [CAN.x - 0.02, CAN.y - 0.1, CAN.z + 0.02], [CAN.x - 0.02, CAN.y - 0.075, CAN.z + 0.02]];
  const purge = CW(0.012, 0.03, 0.03);
  const VAP2 = [[CAN.x + 0.02, CAN.y + 0.118, CAN.z - 0.02], [CAN.x + 0.0, CAN.y + 0.14, CAN.z - 0.08], [purge.x + 0.03, purge.y + 0.06, purge.z + 0.1], purge];
  A('lineas_comb', tube(FEED1, 0.0045, false, 60), 'hose', { press: 'feed' });
  A('lineas_comb', tube(FEED2, 0.0045, false, 20), 'hose', { press: 'feed' });
  A('lineas_comb', tube(FEED3, 0.0045, false, 110), 'hose', { press: 'feed' });
  A('lineas_comb', tube(RETL, 0.0035, false, 110), 'hose2', { press: 'ret' });
  A('lineas_comb', tube(VAP1, 0.0035, false, 100), 'hose');
  A('lineas_comb', tube(VAP2, 0.0035, false, 40), 'hose');
  for (const x of [-0.7, -0.95, -1.15]) A('lineas_comb', rbox(0.014, 0.1, 0.006, 0.002), 'steel', { p: [x, 0.43, RZ + 0.024] });   // grapas al larguero
  // cánister (foto bajo el asiento del copiloto)
  A('canister', rbox(0.105, 0.15, 0.12, 0.012), 'dark', { p: CAN.toArray(), cut: 'xray', double: true });
  A('canister', rbox(0.09, 0.1, 0.105, 0.008), 'rubber', { p: [CAN.x, CAN.y - 0.015, CAN.z] });                   // carbón activado
  A('canister', cylY(0.03, 0.03, 18), 'dark', { p: [CAN.x + 0.02, CAN.y + 0.09, CAN.z - 0.02] });
  A('canister', cylY(0.012, 0.014, 12), 'rubber', { p: [CAN.x + 0.02, CAN.y + 0.112, CAN.z - 0.02] });
  A('canister', rbox(0.006, 0.12, 0.05, 0.002), 'steel', { p: [CAN.x - 0.056, CAN.y, CAN.z] });                   // soporte

  // ════════ PEDAL DEL ACELERADOR (fotos): placa de acero con bisagra en el piso; su eje entra en la tapa blanca,
  // donde una palanca tira de la piola que va por debajo del piso hasta el carburador ════════
  const AZ = -0.085, AH = V(0.345, 0.468, AZ), AEX = EXV.pedal_acel;
  A('pedal_acel', rbox(0.05, 0.006, 0.075, 0.002), 'steel', { p: [AH.x + 0.005, 0.462, AZ] });                    // base apernada
  for (const dz of [-0.03, 0.03]) A('pedal_acel', rbox(0.012, 0.022, 0.004, 0.001), 'steel', { p: [AH.x, 0.474, AZ + dz] });
  A('pedal_acel', cylZ(0.004, 0.2, 8), 'machined', { p: [AH.x, AH.y + 0.012, AZ + 0.07] });                       // eje hacia la tapa
  const apedal = group('pedal_acel', root, [AH.x, AH.y + 0.012, AZ], AEX);
  { const pl = (geo, kind, o) => add('pedal_acel', geo, kind, { parent: apedal, ex: null, ...o });
    pl(rbox(0.007, 0.19, 0.054, 0.012), 'steel', { p: [0, 0.098, 0] });
    for (const dz of [-0.014, 0.014]) pl(rbox(0.003, 0.15, 0.007, 0.002), 'machined', { p: [-0.0045, 0.1, dz] });   // nervios
    pl(rbox(0.012, 0.028, 0.05, 0.004), 'steel', { p: [0.003, 0.01, 0] }); }
  apedal.rotation.z = -0.36;
  // tapa blanca (foto) y, adentro, la palanca del eje
  const CV = V(0.352, 0.487, AZ + 0.135);
  A('pedal_acel', rbox(0.105, 0.06, 0.17, 0.014), 'floorp', { p: CV.toArray(), cut: 'xray', double: true, r: [0, -0.25, 0] });
  const alever = group('pedal_acel', root, [AH.x, AH.y + 0.012, AZ + 0.15], AEX);
  A('pedal_acel', rbox(0.008, 0.045, 0.006, 0.002), 'steel', { parent: alever, p: [0, 0.02, 0], ex: null });
  alever.rotation.z = -0.36;
  const tLever = CW(-0.036, 0.002, 0.018);                    // eje de la mariposa, por atrás del carburador
  const ACAB = [[AH.x + 0.04, AH.y + 0.03, AZ + 0.15], [AH.x + 0.06, 0.455, AZ + 0.17], [0.34, 0.40, 0.2], [0.14, 0.39, 0.30], [-0.1, 0.40, 0.31], [-0.3, 0.47, 0.25], [tLever.x - 0.05, tLever.y + 0.05, tLever.z + 0.12], [tLever.x - 0.02, tLever.y + 0.03, tLever.z + 0.05]];
  A('pedal_acel', tube(ACAB, 0.004, false, 110), 'rubber');
  const awire = dyn(A('pedal_acel', cylY(0.0012, 1, 6), 'machined', { ex: null }));
  // ahogador: perilla bajo el tablero, a la izquierda del volante (foto), y piola hasta la palanca del carburador
  const KN = V(0.368, 0.935, -0.47);
  A('ahogador', cylX(0.012, 0.012, 16), 'dash', { p: [KN.x + 0.006, KN.y, KN.z] });
  const knob = group('ahogador', root, KN.toArray(), EXV.ahogador);
  A('ahogador', cylX(0.015, 0.014, 20), 'dark', { parent: knob, p: [-0.008, 0, 0], ex: null });
  A('ahogador', cylX(0.003, 0.05, 8), 'machined', { parent: knob, p: [0.02, 0, 0], ex: null });
  const cLever = CW(-0.036, 0.004, 0.066);
  const CCAB = [[KN.x + 0.03, KN.y, KN.z], [KN.x + 0.12, KN.y - 0.06, KN.z + 0.01], [0.56, 0.6, -0.43], [0.52, 0.42, -0.40], [0.3, 0.37, -0.31], [0.0, 0.36, -0.28], [-0.25, 0.36, -0.1], [-0.42, 0.45, 0.02], [cLever.x - 0.07, cLever.y + 0.06, cLever.z + 0.1], [cLever.x - 0.02, cLever.y + 0.028, cLever.z + 0.05]];
  A('ahogador', tube(CCAB, 0.0035, false, 120), 'rubber');
  const cwire = dyn(A('ahogador', cylY(0.001, 1, 6), 'machined', { ex: null }));

  // ════════ CARBURADOR EN DETALLE (en su lugar, ejes del furgón: el aire entra por +z desde el filtro y sale por −z al múltiple) ════════
  ctx.setLevel('eng+ali');
  const cb = (part, geo, kind, o = {}) => add(part, geo, kind, { parent: carbG, ex: null, ...o });
  const CUT = { cut: 'carb', double: true };
  const BY = 0.002;                                           // eje del conducto
  // conducto con venturi (perfil de revolución alrededor de z)
  { const pf = [[0.0215, 0.008], [0.0215, 0.07], [0.0148, 0.07], [0.0146, 0.062], [0.0106, 0.046], [0.0138, 0.03], [0.014, 0.008], [0.0215, 0.008]].map(([r, z]) => new THREE.Vector2(r, z));
    const g = new THREE.LatheGeometry(pf, 40); g.rotateX(Math.PI / 2);
    cb('carburador', g, 'alu', { p: [0, BY, 0], ...CUT }); }
  cb('carburador', rbox(0.062, 0.062, 0.008, 0.003), 'dark', { p: [0, 0, 0.004], ...CUT });                         // aislador contra el múltiple
  cb('carburador', rbox(0.058, 0.01, 0.062, 0.003), 'alu', { p: [0, BY + 0.024, 0.039], ...CUT });                  // lomo de arriba
  // cuba: caja abierta por el corte, con su tapa de junta
  const BW = { x: 0.05, y0: -0.068, y1: -0.022, z0: 0.02, z1: 0.07 };
  const bmy = (BW.y0 + BW.y1) / 2, bmz = (BW.z0 + BW.z1) / 2, bh = BW.y1 - BW.y0, bl = BW.z1 - BW.z0;
  cb('carb_cuba', rbox(BW.x, 0.003, bl, 0.001), 'alu', { p: [0, BW.y0, bmz], ...CUT });
  cb('carb_cuba', rbox(BW.x, bh, 0.003, 0.001), 'alu', { p: [0, bmy, BW.z0], ...CUT });
  cb('carb_cuba', rbox(BW.x, bh, 0.003, 0.001), 'alu', { p: [0, bmy, BW.z1], ...CUT });
  for (const s of [-1, 1]) cb('carb_cuba', rbox(0.003, bh, bl, 0.001), 'alu', { p: [s * BW.x / 2, bmy, bmz], ...CUT });
  cb('carb_cuba', rbox(BW.x + 0.004, 0.003, bl + 0.004, 0.001), 'steel', { p: [0, BW.y1, bmz], ...CUT });          // junta
  const bowlFuel = dyn(cb('carb_cuba', rbox(BW.x - 0.005, 1, bl - 0.005, 0.001), 'fluid', { p: [0, BW.y0, bmz], op: 0.8, ...CUT }));
  // flotador con su brazo y válvula de aguja en la entrada de bencina (atrás-derecha de la cuba)
  const FP = [0, -0.03, BW.z1 - 0.006];                       // eje del flotador
  const floatG = new THREE.Group(); floatG.position.set(...FP); carbG.add(floatG);
  cb('carb_cuba', rbox(0.03, 0.016, 0.026, 0.005), 'dark', { parent: floatG, p: [0, -0.008, -0.026] });             // flotador de plástico (manual)
  cb('carb_cuba', rbox(0.006, 0.002, 0.03, 0.0008), 'brass', { parent: floatG, p: [0, 0, -0.014] });
  cb('carb_cuba', cylX(0.0015, 0.034, 6), 'machined', { p: FP });
  const needle = dyn(cb('carb_cuba', new THREE.ConeGeometry(0.0028, 0.01, 10).rotateX(Math.PI), 'machined', { p: [0, -0.026, BW.z1 - 0.012] }));
  cb('carb_cuba', cylY(0.0045, 0.008, 10), 'brass', { p: [0, -0.02, BW.z1 - 0.012] });                              // asiento de la aguja
  cb('carb_cuba', tube([[0, -0.018, BW.z1 - 0.012], [-0.004, -0.02, BW.z1 + 0.002], [-0.01, -0.03, 0.074]], 0.0032, false, 12), 'brass');   // niple de entrada
  cb('carb_cuba', tube([[-0.014, -0.024, BW.z1 - 0.004], [-0.02, -0.027, BW.z1 + 0.002], [-0.024, -0.03, 0.074]], 0.0026, false, 12), 'brass');   // niple de retorno
  // circuito principal: surtidor principal al fondo, tubo de emulsión y salida en la garganta del venturi
  cb('carb_surtidores', cylY(0.0034, 0.006, 8), 'brass', { p: [0, BW.y0 + 0.008, 0.046] });
  cb('carb_surtidores', cylY(0.0022, 0.05, 8), 'brass', { p: [0, -0.036, 0.046] });
  cb('carb_surtidores', cylY(0.0028, 0.006, 8), 'brass', { p: [0, -0.008, 0.046] });
  // circuito lento: surtidor lento y conducto hasta los orificios junto a la mariposa; tornillo de mezcla de ralentí
  cb('carb_surtidores', cylY(0.0018, 0.036, 8), 'brass', { p: [0.006, -0.038, 0.034] });
  cb('carb_surtidores', tube([[0.006, -0.02, 0.034], [0.006, -0.0185, 0.028], [0.004, -0.0175, 0.021], [0.002, -0.0168, 0.0165]], 0.0012, false, 14), 'brass');
  cb('carb_surtidores', cylY(0.0026, 0.02, 8), 'brass', { p: [0.002, -0.026, 0.0145] });                            // tornillo de mezcla
  cb('carb_surtidores', helix(0.0034, 0.008, 5, 0.0006), 'steel', { p: [0.002, -0.036, 0.0145] });
  cb('carb_surtidores', cylY(0.0045, 0.003, 10), 'steel', { p: [0.002, -0.0415, 0.0145] });
  cb('carb_surtidores', tube([[0, BY + 0.016, 0.066], [0, BY + 0.02, 0.05], [0, BY + 0.02, 0.036], [0, BY + 0.0145, 0.03]], 0.001, false, 12), 'brass');   // aire del circuito lento
  // enriquecedor por vacío (cápsula arriba) y su manguera al múltiple
  cb('carb_surtidores', cylY(0.011, 0.008, 16), 'alu', { p: [0.012, BY + 0.033, 0.03] });
  cb('carb_surtidores', tube([[0.012, BY + 0.038, 0.03], [0.012, BY + 0.046, 0.02], [0.012, BY + 0.03, 0.006]], 0.002, false, 10), 'hose');
  // solenoide de corte del circuito lento (costado de atrás), con su aguja
  cb('carb_solenoide', cylX(0.009, 0.028, 14), 'dark', { p: [-0.042, -0.04, 0.034] });
  cb('carb_solenoide', cylX(0.0055, 0.006, 6), 'steel', { p: [-0.027, -0.04, 0.034] });
  const solPin = dyn(cb('carb_solenoide', cylX(0.0013, 0.03, 6), 'machined', { p: [-0.012, -0.04, 0.034] }));
  cb('carb_solenoide', tube([[-0.056, -0.04, 0.034], [-0.066, -0.03, 0.04], [-0.08, -0.01, 0.07]], 0.0016, false, 10), 'lead');
  // bomba de aceleración: cámara con diafragma bajo el conducto, palanca al eje de la mariposa y boquilla en el venturi
  cb('carb_bomba', cylY(0.011, 0.012, 16), 'alu', { p: [0, -0.034, 0.012], ...CUT });
  const pumpD = dyn(cb('carb_bomba', cylY(0.0095, 0.0016, 16), 'hose2', { p: [0, -0.034, 0.012] }));
  cb('carb_bomba', tube([[0, -0.029, 0.012], [0.004, -0.024, 0.02], [0.006, -0.018, 0.04], [0.004, BY - 0.012, 0.056]], 0.0011, false, 14), 'brass');   // a la boquilla
  cb('carb_bomba', cylZ(0.0016, 0.006, 6), 'brass', { p: [0.004, BY - 0.011, 0.054] });
  const pumpRod = dyn(cb('carb_bomba', cylY(0.0012, 0.03, 6), 'machined', { p: [-0.034, -0.02, 0.014] }));
  // mariposa del acelerador y del ahogador, con sus ejes y palancas (por atrás)
  cb('carb_mariposas', cylX(0.0022, 0.075, 8), 'machined', { p: [-0.002, BY, 0.018] });
  const thr = new THREE.Group(); thr.position.set(0, BY, 0.018); carbG.add(thr);
  dyn(cb('carb_mariposas', cylZ(0.0134, 0.0012, 28), 'brass', { parent: thr }));
  const thrLever = new THREE.Group(); thrLever.position.set(-0.036, BY, 0.018); carbG.add(thrLever);
  dyn(cb('carb_mariposas', rbox(0.003, 0.03, 0.008, 0.001), 'steel', { parent: thrLever, p: [0, 0.011, 0] }));
  dyn(cb('carb_mariposas', cylX(0.003, 0.006, 8), 'machined', { parent: thrLever, p: [-0.003, 0.024, 0] }));
  cb('carb_mariposas', cylX(0.0022, 0.075, 8), 'machined', { p: [-0.002, BY + 0.002, 0.066] });
  const chk = new THREE.Group(); chk.position.set(0, BY + 0.002, 0.066); carbG.add(chk);
  dyn(cb('carb_mariposas', cylZ(0.0142, 0.0012, 28), 'steel', { parent: chk }));
  const chkLever = new THREE.Group(); chkLever.position.set(-0.036, BY + 0.002, 0.066); carbG.add(chkLever);
  dyn(cb('carb_mariposas', rbox(0.003, 0.024, 0.007, 0.001), 'steel', { parent: chkLever, p: [0, 0.009, 0] }));
  cb('carb_mariposas', rbox(0.003, 0.012, 0.046, 0.001), 'steel', { p: [-0.034, BY - 0.012, 0.042] });              // varilla de ralentí rápido entre los dos ejes
  cb('carb_mariposas', cylY(0.0018, 0.014, 6), 'brass', { p: [-0.03, BY - 0.02, 0.006] });                          // tornillo de ralentí
  cb('carb_mariposas', rbox(0.012, 0.004, 0.03, 0.001), 'steel', { p: [-0.05, BY + 0.045, 0.03] });                 // soporte de las piolas
  carbG.updateMatrixWorld(true);
  ctx.setLevel('van');

  // ════════ recorridos animados ════════
  const curve = pts => new THREE.CatmullRomCurve3(pts.map(P3), false, 'catmullrom', 0.3);
  const cw = pts => pts.map(p => CW(...p));
  const fEnd = CW(0, BY, 0.36), fIn = CW(0.03, BY + 0.03, 0.42);
  const PLW = CW(0, BY, -0.05), RUN = [CW(0.1, BY - 0.02, -0.09), CW(-0.1, BY - 0.02, -0.09)];
  const PATHS = [];
  const addPath = (key, pts, kind, col, spacing, micro) => { const cv = curve(pts), len = cv.getLength(); PATHS.push({ key, cv, len, n: Math.max(3, Math.round(len / spacing)), kind, col, micro: !!micro }); };
  addPath('aire', [fIn, fEnd, CW(0, BY, 0.2), CW(0, BY, 0.09), CW(0, BY + 0.004, 0.05), CW(0, BY, 0.02)], 'air', COL.air, 0.02);
  addPath('aire2', cw([[0, BY - 0.004, 0.09], [0, BY - 0.003, 0.05], [0, BY - 0.002, 0.02]]), 'air', COL.air, 0.008, true);
  for (const [i, r] of RUN.entries()) addPath('mezcla' + i, [CW(0, BY, 0.02), CW(0, BY, 0.0), PLW, r, r.clone().add(V(0, -0.04, -0.05))], 'air', COL.mix, 0.016);
  addPath('ida1', FEED1, 'fuel', COL.fuel, 0.03); addPath('ida2', FEED2, 'fuel', COL.fuel, 0.03); addPath('ida3', FEED3, 'fuel', COL.fuel, 0.03);
  addPath('cuba', cw([[-0.01, -0.03, 0.074], [-0.004, -0.02, BW.z1 + 0.002], [0, -0.018, BW.z1 - 0.012], [0, -0.03, BW.z1 - 0.012], [0, -0.045, 0.05]]), 'fuel', COL.fuel, 0.004, true);
  addPath('retorno', RETL, 'fuel', COL.ret, 0.034);
  addPath('vapor1', VAP1, 'fuel', COL.vap, 0.05); addPath('vapor2', VAP2, 'fuel', COL.vap, 0.03);
  addPath('principal', cw([[0, BW.y0 + 0.012, 0.046], [0, -0.03, 0.046], [0, -0.008, 0.046], [0, -0.003, 0.04], [0, BY, 0.028], [0.006, BY + 0.004, 0.012], [0, BY, -0.004]]), 'fuel', COL.fuel, 0.0035, true);
  addPath('lento', cw([[0.006, -0.05, 0.034], [0.006, -0.02, 0.034], [0.004, -0.0175, 0.021], [0.002, -0.0145, 0.0155], [0.002, -0.011, 0.01], [0.001, -0.008, -0.002]]), 'fuel', COL.fuel, 0.0035, true);
  addPath('pique', cw([[0, -0.029, 0.012], [0.006, -0.018, 0.04], [0.004, BY - 0.011, 0.054], [0.003, BY - 0.006, 0.04], [0.002, BY - 0.002, 0.02], [0, BY, 0.0]]), 'fuel', COL.fuel, 0.003, true);
  const dot = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d');
    x.beginPath(); x.arc(32, 32, 26, 0, Math.PI * 2); x.fillStyle = '#fff'; x.fill(); x.lineWidth = 6; x.strokeStyle = 'rgba(42,36,32,0.55)'; x.stroke();
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
  const pr = Math.min(window.devicePixelRatio || 1, 2), small = window.innerWidth < 900;
  const mkPoints = (n, size) => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3).fill(-1000), 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 3).fill(1), 3).setUsage(THREE.DynamicDrawUsage));
    const m = new THREE.Points(g, new THREE.PointsMaterial({ size: size * pr, sizeAttenuation: false, vertexColors: true, map: dot, transparent: true, alphaTest: 0.2, depthTest: false, depthWrite: false }));
    m.frustumCulled = false; m.renderOrder = 3; m.userData.noBox = true; m.visible = false; root.add(m); return m;
  };
  const cnt = { big: 0, micro: 0 };
  for (const p of PATHS) { const k = p.micro ? 'micro' : 'big'; p.j0 = cnt[k]; cnt[k] += p.n; }
  const ptsBig = mkPoints(cnt.big, small ? 4.2 : 6), ptsMicro = mkPoints(cnt.micro, small ? 2.6 : 3.4);
  const col = new THREE.Color(), pos = new THREE.Vector3();

  // ════════ estado, pose y animación ════════
  const st = { pedal: 0, target: 0, choke: 0, engine: 'caliente', fail: 'ok', on: false, level: 0.6, cut: false, showFuel: true, showAir: true, showVap: true, t: 0, shot: 0, pumpT: 0, last: null, far: true };
  const wire = (m, a, b) => { const d = b.clone().sub(a), l = d.length(); m.position.copy(a).addScaledVector(d, 0.5); m.scale.y = Math.max(1e-4, l); m.quaternion.setFromUnitVectors(V(0, 1, 0), d.normalize()); };
  const tmpA = new THREE.Vector3(), tmpB = new THREE.Vector3();
  function pose(r) {
    const p = st.pedal;
    apedal.rotation.z = -0.36 + 0.3 * p; alever.rotation.z = apedal.rotation.z;
    const ta = -(0.16 + 1.26 * r.throttle);                    // mariposa: casi cerrada → paralela al aire
    thr.rotation.x = ta; thrLever.rotation.x = -0.25 + 1.0 * r.throttle;   // la palanca gira hacia el final de la funda: la piola la tira
    const ca = -(Math.PI / 2 - 1.38 * st.choke);               // ahogador: abierto (paralelo) → cerrado al tirar la perilla
    chk.rotation.x = ca; chkLever.rotation.x = ca + Math.PI / 2 - 0.5;
    knob.position.x = KN.x - 0.03 * st.choke;
    // piolas: alma a la vista entre el final de la funda y cada palanca
    thrLever.updateMatrixWorld(true); chkLever.updateMatrixWorld(true);
    tmpA.set(-0.003, 0.024, 0).applyMatrix4(thrLever.matrixWorld); wire(awire, P3(ACAB[ACAB.length - 1]), tmpA);
    tmpB.set(0, 0.02, 0).applyMatrix4(chkLever.matrixWorld); wire(cwire, P3(CCAB[CCAB.length - 1]), tmpB);
    // cuba: nivel, flotador y aguja
    const lv = 0.012 + 0.03 * r.bowl;
    bowlFuel.scale.y = lv; bowlFuel.position.y = BW.y0 + 0.0015 + lv / 2;
    const fa = (r.bowl - 0.5) * 0.9;                           // el flotador sube con el nivel y empuja la aguja contra su asiento
    floatG.rotation.x = fa;
    needle.position.y = -0.0265 + (r.fail === 'aguja' ? -0.003 : Math.min(0.0035, Math.max(-0.003, fa * 0.012 + 0.002)));
    solPin.position.x = -0.012 + (r.on && r.fail !== 'solenoide' ? -0.006 : 0.004);   // con corriente se retira y deja pasar la bencina
    // bomba de aceleración: el diafragma sube al abrir la mariposa
    pumpD.position.y = -0.037 + 0.006 * p; pumpRod.position.y = -0.022 + 0.008 * p; pumpRod.scale.y = 1;
    // estanque y aforador
    const h = (TS[1] - 0.02) * Math.max(0.02, st.level);
    fuelLvl.scale.y = h; fuelLvl.position.y = TK.y - TS[1] / 2 + 0.008 + h / 2;
    sender.rotation.z = -0.5 + 1.0 * st.level;
  }
  function weights(r) {
    const w = {}, f = st.showFuel, a = st.showAir, on = r.on, run = r.running;
    const q = run ? 0.25 + 0.75 * Math.min(1, r.air / 22) : 0;
    w.aire = a ? q : 0; w.aire2 = a ? q : 0; w.mezcla0 = w.mezcla1 = a ? q : 0;
    w.ida1 = w.ida2 = w.ida3 = f && on ? Math.max(0.12, r.feed) : 0;
    w.cuba = f && on ? Math.max(0.15, Math.min(1, r.used * 0.7)) : 0;
    w.retorno = f && on ? Math.min(1, r.ret / 4.5) : 0;
    w.vapor1 = st.showVap && on ? 0.35 : 0; w.vapor2 = st.showVap && run ? 0.4 : 0;
    w.principal = f ? r.main * (0.5 + 0.5 * r.power) * (1 - 0.7 * r.starve) : 0;
    w.lento = f ? r.slow * 0.8 : 0;
    w.pique = f && on ? st.shot : 0;
    return w;
  }
  function animate(dt) {
    const r = st.last; if (!r) return;
    st.t += Math.max(0, dt);
    const w = weights(r);
    for (const p of PATHS) {
      const weight = w[p.key] || 0;
      const speed = p.kind === 'air' ? 0.1 + 0.9 * Math.min(1, r.air / 22) : p.micro ? 0.02 + 0.05 * (p.key === 'pique' ? 1.5 : 1) : 0.05 + 0.2 * r.feed;
      const show = Math.round(p.n * Math.min(1, weight * 1.3 + (weight > 0 ? 0.2 : 0)));
      const G = (p.micro ? ptsMicro : ptsBig).geometry, PA = G.attributes.position.array, CA = G.attributes.color.array;
      for (let j = 0; j < p.n; j++) {
        const k = (p.j0 + j) * 3;
        if (j >= show || weight <= 0) { PA[k] = PA[k + 2] = 0; PA[k + 1] = -1000; continue; }
        const u = (((j / p.n) + st.t * speed / p.len) % 1 + 1) % 1;
        p.cv.getPointAt(u, pos); PA[k] = pos.x; PA[k + 1] = pos.y; PA[k + 2] = pos.z;
        const c = p.col; col.setRGB(c[0] / 255, c[1] / 255, c[2] / 255, THREE.SRGBColorSpace);
        CA[k] = col.r; CA[k + 1] = col.g; CA[k + 2] = col.b;
      }
    }
    for (const o of [ptsBig, ptsMicro]) { o.geometry.attributes.position.needsUpdate = true; o.geometry.attributes.color.needsUpdate = true; }
    // bomba eléctrica: el émbolo late mientras hay contacto
    if (r.pumpOn) { st.pumpT += dt * (4 + 6 * r.feed); const k = Math.sin(st.pumpT * 6.28) * 0.5 + 0.5; plunger.position.x = PU.x + 0.006 * k; diaph.position.x = PU.x - 0.03 + 0.004 * k; }
  }
  function recompute() { const r = fuelSolve(st); st.last = r; pose(r); return r; }
  function tick(dt) {
    let active = st.on;
    // el pedal sigue al mando; si se pisa rápido, la bomba de aceleración da su chorro
    if (Math.abs(st.target - st.pedal) > 1e-4) {
      const d = Math.sign(st.target - st.pedal) * Math.min(Math.abs(st.target - st.pedal), dt * 2.6);
      if (d > 0 && st.on) st.shot = Math.min(1, st.shot + d * 4);
      st.pedal += d; active = true; recompute();
    }
    if (st.shot > 0) { st.shot = Math.max(0, st.shot - dt * 1.3); active = true; }
    if (st.on && st.last && st.last.running && st.level > 0) { st.level = Math.max(0, st.level - dt * st.last.lph / 3600 / 37 * 40); }   // el estanque baja muy lento (acelerado 40×)
    if (st.on) animate(dt);
    return active;
  }
  function setCuts(on) {
    st.cut = on;
    const x0 = CW(0, 0, 0).x;
    if (on) planes.carb.set(V(-1, 0, 0), x0 - 0.0005); else planes.carb.set(V(0, 1, 0), 1e4);   // quita la mitad de adelante: se mira desde el frente
  }
  function setActive(on) { ptsBig.visible = ptsMicro.visible = on; if (!on) { st.on = false; st.target = 0; st.pedal = 0; st.shot = 0; recompute(); } }
  const pressMats = [];
  function bind(meshes) { pressMats.length = 0; meshes.forEach(m => pressMats.push(m)); }
  function paint(mode, colorMode) {
    const r = st.last; if (!r || mode !== 'ali' || colorMode !== 'real') return;
    for (const m of pressMats) {
      const ud = m.material.userData, c = ud.press === 'feed' ? COL.fuel : COL.ret, k = r.on ? (ud.press === 'feed' ? 0.25 + 0.4 * r.feed : Math.min(0.6, 0.15 + r.ret / 6)) : 0;
      m.material.color.copy(ud.real).lerp(col.setRGB(c[0] / 255, c[1] / 255, c[2] / 255, THREE.SRGBColorSpace), k);
    }
  }
  // demostración al elegir el pedal o el ahogador fuera de la vista Alimentación
  function demo(what, k) { if (what === 'pedal') { st.pedal = st.target = k; } else st.choke = k; recompute(); }

  recompute();
  return {
    planes, bind, paint, setCuts, setActive, recompute, tick, demo,
    set(o) { if ('pedal' in o) { st.target = o.pedal; delete o.pedal; } Object.assign(st, o); const r = recompute(); if (st.on) animate(0); return r; },
    get state() { return st; },
    get result() { return st.last; },
    groups: { carb: [thr, chk, floatG, bowlFuel], estanque: [fuelLvl, sender, plunger], pedal: [apedal, alever, knob], bomba: [plunger, diaph] },
  };
}
