// Sistema eléctrico del SK410 en el furgón (manual secc. 8, 9, 10 y 20, fotos del dueño):
// caja de fusibles café bajo el tablero, a la izquierda de la columna (foto de los pedales); chapa de contacto en la
// cubierta de la columna; radio Sony MEX-N4150BT de 1 DIN en la consola (foto); un parlante JBL abajo y adelante en cada
// puerta (foto con la puerta abierta); antena de mástil en el pilar del parabrisas del lado conductor (foto); luz interior
// en el techo, sobre el parabrisas (foto). Destellador, bocina, motor del limpiaparabrisas, fusible principal y recorrido
// de los arneses: ubicaciones estimadas (falta confirmarlas con fotos). El tablero de instrumentos es esquemático (F8).
// Las ampolletas son las de la carrocería (body3d.js): las enciende esta vista según la simulación (elecsim.js), que
// corre siempre: lo que se deja encendido aquí sigue encendido en las demás vistas y descarga la batería.
import * as THREE from 'three';
import { BODY } from './body3d.js';
import { elecInit, elecStep, elecSolve, crankAt, startCheck, FUSES } from './elecsim.js';

const FB = new THREE.Vector3(0.405, 0.82, -0.52);          // caja de fusibles (foto)
const KEYP = new THREE.Vector3(0.322, 0.958, -0.277);      // chapa, en el costado derecho de la cubierta de la columna
const FLASH = new THREE.Vector3(0.44, 0.875, -0.43);       // destellador (est.)
const HORN = new THREE.Vector3(0.615, 0.525, 0.27);        // bocina, tras el parachoques (est.)
const WMOT = new THREE.Vector3(0.6, 1.07, -0.2);           // motor del limpiaparabrisas (est.)
const RADIO = new THREE.Vector3(0.3605, 0.972, -0.03);     // frente de la radio (consola, foto)
const SPK = [new THREE.Vector3(0.2, 0.62, -0.632), new THREE.Vector3(0.2, 0.62, 0.632)];   // parlantes en las puertas (foto)
const ANT0 = new THREE.Vector3(0.556, 1.21, -0.668), ANT1 = new THREE.Vector3(0.07, 2.03, -0.725);   // antena (foto)
const DOME = new THREE.Vector3(0.17, 1.672, 0);            // luz interior (foto)
const KEYANG = { lock: 0, acc: 0.55, on: 1.05, start: 1.55 };

export function buildElectric(ctx, { eng, E, BD, BAT }) {
  const { V, rbox, cylX, cylY, cylZ, tube, add, group } = ctx;
  const root = ctx.world.root;
  const EL = (x, y, z) => eng.localToWorld(V(x, y, z));
  const P3 = p => (p.isVector3 ? p : V(...p));
  const dyn = m => { m.userData.dyn = true; return m; };
  const EXV = { fusibles: [0.06, 0.02, -0.12], chapa: [-0.05, 0.03, 0.06], destellador: [0.04, 0.04, -0.06], bocina: [0.15, 0, 0.05], limpiaparabrisas: [0.05, 0.1, 0],
    radio: [-0.12, 0, 0], parlantes: [0, 0, 0], antena: [0.04, 0.06, -0.06], fusible_principal: [0, 0.1, -0.06], arnes: [0, 0, 0], interruptor_combinado: [-0.05, 0.05, 0] };
  const A = (part, geo, kind, o = {}) => add(part, geo, kind, { ex: 'ex' in o ? o.ex : EXV[part], ...o });
  const press = [];
  const st = elecInit();
  const planes = { fus: new THREE.Plane(V(0, 1, 0), 1e4) };

  ctx.setLevel('ele');
  // ════════ CAJA DE FUSIBLES (foto: café, bajo el tablero a la izquierda de la columna; 9 fusibles, manual 20-7) ════════
  const fg = group('fusibles', root, FB.toArray(), EXV.fusibles);
  A('fusibles', rbox(0.04, 0.118, 0.078, 0.006), 'fusebox', { parent: fg, ex: null, cut: 'fus', double: true });
  A('fusibles', rbox(0.006, 0.112, 0.072, 0.004), 'fusebox', { parent: fg, ex: null, p: [-0.023, 0, 0], cut: 'fus' });   // tapa
  for (const dy of [-0.035, 0, 0.035]) A('fusibles', rbox(0.002, 0.004, 0.05, 0.001), 'dark', { parent: fg, ex: null, p: [-0.0265, dy, 0] });   // nervios de la tapa
  const FUSEPOS = [];
  for (let i = 0; i < 9; i++) {
    const row = i % 3, col = Math.floor(i / 3), p = [-0.008, 0.035 - row * 0.035, -0.022 + col * 0.022];
    FUSEPOS.push(p);
    A('fusibles', rbox(0.016, 0.02, 0.005, 0.0015), FUSES[i].A === 10 ? 'fuseR' : 'fuseB', { parent: fg, ex: null, p, press: 'e_fu' + i });   // 10 A rojo, 15 A azul
  }
  // ════════ CHAPA DE CONTACTO: LOCK, ACC, ON y START ════════
  const kg = group('chapa', root, KEYP.toArray(), EXV.chapa);
  A('chapa', cylZ(0.016, 0.012, 20), 'chrome', { parent: kg, ex: null });
  A('chapa', cylZ(0.011, 0.014, 18), 'dark', { parent: kg, ex: null, p: [0, 0, 0.002] });
  const keyG = new THREE.Group(); keyG.position.set(0, 0, 0.012); kg.add(keyG);
  A('chapa', rbox(0.004, 0.012, 0.03, 0.001), 'steel', { parent: keyG, ex: null, p: [0, 0, 0.012] });
  A('chapa', rbox(0.006, 0.03, 0.024, 0.006), 'dark', { parent: keyG, ex: null, p: [0, 0, 0.036] });
  // ════════ INTERRUPTORES DE LA COLUMNA (luces e intermitentes a la izquierda, limpiaparabrisas a la derecha; est.) ════════
  const stalkL = group('interruptor_combinado', root, [0.302, 1.012, -0.36], EXV.interruptor_combinado);
  A('interruptor_combinado', cylZ(0.005, 0.11, 8), 'dark', { parent: stalkL, ex: null, p: [0, 0, -0.055] });
  A('interruptor_combinado', cylZ(0.009, 0.03, 10), 'plastic', { parent: stalkL, ex: null, p: [0, 0, -0.105] });
  A('interruptor_combinado', cylZ(0.005, 0.1, 8), 'dark', { p: [0.302, 1.012, -0.25] });
  // ════════ DESTELLADOR, BOCINA Y MOTOR DEL LIMPIAPARABRISAS (ubicaciones estimadas) ════════
  A('destellador', cylX(0.014, 0.034, 14), 'plastic', { p: FLASH.toArray() });
  A('destellador', rbox(0.004, 0.01, 0.018, 0.001), 'dark', { p: [FLASH.x + 0.018, FLASH.y, FLASH.z] });
  const hg = group('bocina', root, HORN.toArray(), EXV.bocina);
  A('bocina', cylX(0.045, 0.028, 24), 'dark', { parent: hg, ex: null });
  A('bocina', cylX(0.03, 0.006, 20), 'steel', { parent: hg, ex: null, p: [0.016, 0, 0] });
  A('bocina', rbox(0.004, 0.05, 0.016, 0.002), 'steel', { parent: hg, ex: null, p: [-0.02, 0.03, 0] });
  A('limpiaparabrisas', cylZ(0.03, 0.07, 18), 'dark', { p: WMOT.toArray() });
  A('limpiaparabrisas', rbox(0.05, 0.05, 0.04, 0.008), 'alu', { p: [WMOT.x, WMOT.y, WMOT.z + 0.05] });
  for (const zp of [0, -0.48]) A('limpiaparabrisas', tube([[WMOT.x, WMOT.y + 0.02, WMOT.z + 0.06], [0.585, 1.12, (WMOT.z + zp) / 2], [0.585, 1.14, zp]], 0.004), 'steel');   // varillaje a los pivotes
  // ════════ RADIO SONY MEX-N4150BT (1 DIN, foto) Y PARLANTES JBL EN LAS PUERTAS ════════
  A('radio', rbox(0.16, 0.05, 0.178, 0.004), 'dark', { p: [RADIO.x + 0.083, RADIO.y, RADIO.z] });
  const knob = dyn(A('radio', cylX(0.016, 0.012, 24), 'chrome', { p: [RADIO.x - 0.007, RADIO.y - 0.004, RADIO.z - 0.066] }));   // perilla del volumen
  A('radio', cylX(0.02, 0.004, 24), 'dark', { p: [RADIO.x - 0.002, RADIO.y - 0.004, RADIO.z - 0.066] });
  const spk = SPK.map((p, i) => {
    const s = i ? 1 : -1, g = group('parlantes', root, p.toArray(), [0, 0, 0]);
    A('parlantes', new THREE.TorusGeometry(0.062, 0.006, 8, 32), 'dark', { parent: g, ex: null });                                  // aro de la rejilla
    A('parlantes', cylZ(0.064, 0.004, 32), 'cone', { parent: g, ex: null, p: [0, 0, s * 0.004] });
    const cone = new THREE.Group(); g.add(cone);
    A('parlantes', new THREE.ConeGeometry(0.052, 0.03, 32, 1, true).rotateX(s * Math.PI / 2), 'cone', { parent: cone, ex: null, p: [0, 0, -s * 0.004], double: true });
    A('parlantes', new THREE.SphereGeometry(0.013, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2).rotateX(-s * Math.PI / 2), 'steel', { parent: cone, ex: null, p: [0, 0, -s * 0.01] });   // tweeter coaxial
    A('parlantes', cylZ(0.035, 0.035, 18), 'steel', { parent: g, ex: null, p: [0, 0, s * 0.026] });                                   // imán
    return { g, cone, s };
  });
  // antena de mástil (foto) y su cable a la radio
  A('antena', tube([ANT0, ANT1], 0.0026, false, 4), 'chrome');
  A('antena', cylY(0.012, 0.03, 12), 'dark', { p: [ANT0.x, ANT0.y - 0.005, ANT0.z], r: [0, 0, 0.55] });
  A('antena', new THREE.SphereGeometry(0.005, 8, 6), 'chrome', { p: ANT1.toArray() });
  // fusible principal (eslabón fusible del manual) junto al borne positivo de la batería
  const MF = V(BAT.x + 0.165, BAT.y + 0.07, BAT.z + 0.07);
  A('fusible_principal', rbox(0.05, 0.03, 0.035, 0.005), 'plastic', { p: MF.toArray() });
  A('fusible_principal', rbox(0.04, 0.008, 0.026, 0.003), 'fuseR', { p: [MF.x, MF.y + 0.018, MF.z] });

  // ════════ ARNESES (recorridos estimados) ════════
  root.updateMatrixWorld(true);
  const partBox = id => { const b = new THREE.Box3(); for (const m of ctx.world.meshes) if (m.userData.part === id) b.expandByObject(m); return b; };
  const altBx = partBox('alternador'), stBx = partBox('partida'), distBx = partBox('distribuidor');
  const lampPos = id => { const m = (BD.lamps || []).find(l => l.userData.lamp === id); return m ? m.getWorldPosition(V(0, 0, 0)) : null; };
  const headL = lampPos('headL') || V(0.62, 0.874, -0.476), headR = lampPos('headR') || V(0.62, 0.874, 0.476);
  const tailL = lampPos('tailL') || V(BODY.REAR, 0.87, -0.62), tailR = lampPos('tailR') || V(BODY.REAR, 0.87, 0.62);
  const turnFL = lampPos('turnFL') || V(0.68, 0.572, -0.472), turnFR = lampPos('turnFR') || V(0.68, 0.572, 0.472);
  const fbTop = V(FB.x + 0.005, FB.y + 0.06, FB.z), fbBot = V(FB.x, FB.y - 0.062, FB.z);
  const starter = EL(-0.465, -0.06, 0.134), coil = V(-0.78, 0.565, 0.2);                       // borne del solenoide: donde llega el cable de la batería
  const altB = altBx.isEmpty() ? EL(-0.074, 0.115, 0.165) : altBx.getCenter(V(0, 0, 0)).add(V(-0.03, 0.03, 0.02));   // borne B del alternador (atrás)
  const ROUTES = {
    feed: [MF, V(BAT.x + 0.3, 0.46, -0.42), V(-0.6, 0.43, -0.58), V(0.12, 0.45, -0.6), V(0.36, 0.6, -0.6), V(FB.x, 0.72, FB.z - 0.02), fbBot],
    dashR: [fbTop, V(0.45, 0.93, -0.42), V(0.47, 0.935, -0.05), V(0.47, 0.935, 0.3), V(headR.x - 0.08, headR.y, headR.z - 0.05), headR.clone().add(V(-0.05, 0, 0))],
    dashL: [fbTop, V(0.46, 0.9, -0.5), V(headL.x - 0.08, headL.y, headL.z + 0.05), headL.clone().add(V(-0.05, 0, 0))],
    turnF: [V(0.47, 0.935, 0.3), V(0.6, 0.62, 0.4), turnFR.clone().add(V(-0.03, 0, 0))],
    turnFL: [V(0.46, 0.9, -0.5), V(0.6, 0.62, -0.42), turnFL.clone().add(V(-0.03, 0, 0))],
    horn: [V(0.47, 0.935, 0.1), V(0.58, 0.7, 0.22), HORN.clone().add(V(-0.03, 0, 0))],
    wiper: [V(0.47, 0.935, -0.2), V(0.55, 1.0, -0.2), WMOT.clone().add(V(0, -0.03, 0))],
    rear: [fbBot, V(0.38, 0.5, -0.6), V(-0.4, 0.5, -0.62), V(-1.4, 0.64, -0.63), V(-2.2, 0.66, -0.63), tailL.clone().add(V(0.04, 0, 0.02))],
    rearR: [V(-2.2, 0.66, -0.63), V(-2.3, 0.66, -0.2), V(-2.3, 0.66, 0.4), tailR.clone().add(V(0.04, 0, -0.02))],
    eng: [fbBot, V(0.33, 0.52, -0.42), V(0.15, 0.43, -0.25), V(-0.3, 0.42, 0.05), V(-0.6, 0.48, 0.15), coil.clone().add(V(0, 0.03, 0))],
    alt: [V(-0.3, 0.42, 0.05), V(-0.05, 0.42, 0.18), altB],
    altB: [altB, EL(-0.2, 0.05, 0.2), starter],
    spkL: [V(RADIO.x + 0.17, RADIO.y, RADIO.z - 0.06), V(0.46, 0.84, -0.4), V(0.46, 0.72, -0.62), SPK[0].clone().add(V(0.05, 0, 0.0))],
    spkR: [V(RADIO.x + 0.17, RADIO.y, RADIO.z + 0.06), V(0.46, 0.84, 0.35), V(0.46, 0.72, 0.62), SPK[1].clone().add(V(0.05, 0, 0.0))],
    radio: [fbTop, V(0.45, 0.95, -0.3), V(RADIO.x + 0.17, RADIO.y + 0.01, RADIO.z)],
    ant: [ANT0.clone().add(V(-0.01, -0.02, 0.01)), V(0.5, 1.12, -0.63), V(0.46, 1.0, -0.45), V(RADIO.x + 0.17, RADIO.y - 0.01, RADIO.z - 0.04)],
    bat: [V(BAT.x + 0.06, BAT.y + 0.12, BAT.z + 0.03), V(BAT.x + 0.14, BAT.y + 0.10, BAT.z + 0.05), V(-0.95, 0.45, -0.12), starter.clone().add(V(-0.03, 0.04, -0.02)), starter],   // el cable rojo de van3d.js
  };
  const WIREK = { feed: ['wireR', 0.005, 'e_feed'], dashR: ['wire', 0.006, 'e_dash'], dashL: ['wire', 0.005, 'e_dash'], turnF: ['wire', 0.003, 'e_dash'], turnFL: ['wire', 0.003, 'e_dash'], horn: ['wire', 0.003, 'e_horn'],
    wiper: ['wire', 0.003, 'e_wiper'], rear: ['wire', 0.006, 'e_rear'], rearR: ['wire', 0.004, 'e_rear'], eng: ['wire', 0.006, 'e_eng'], alt: ['wire', 0.003, 'e_eng'], altB: ['wireR', 0.004, 'e_altb'],
    spkL: ['wire', 0.0025, 'e_spk'], spkR: ['wire', 0.0025, 'e_spk'], radio: ['wire', 0.003, 'e_radio'], ant: ['dark', 0.0025, 'e_ant'] };
  for (const [k, [kind, r, pr]] of Object.entries(WIREK)) A('arnes', tube(ROUTES[k].map(P3), r, false, 60), kind, { press: pr });

  // ════════ LUZ INTERIOR, LUZ DE PATENTE Y TABLERO DE INSTRUMENTOS ════════
  ctx.setLevel('van');
  const dome = dyn(A('luces', rbox(0.06, 0.012, 0.11, 0.005), 'lamp', { p: DOME.toArray(), ex: null, body: 'lamp' })); dome.userData.lamp = 'inner';
  const plate = dyn(A('luces', rbox(0.02, 0.016, 0.07, 0.004), 'lamp', { p: [BODY.REAR - 0.012, 1.004, 0], ex: null, body: 'lamp' })); plate.userData.lamp = 'plate';
  const LAMPS = [...(BD.lamps || []), dome, plate];
  ctx.setLevel('ele');

  // caras con pantalla (tablero e iluminación, radio): textura dibujada en un canvas, sin luz de la escena
  const face = (part, w, h, cw, ch, pos, rotY) => {
    const c = document.createElement('canvas'); c.width = cw; c.height = ch;
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: t, toneMapped: false }));
    m.position.copy(pos); m.rotation.y = rotY; ctx.regMesh(m, part); m.userData.face = true; m.userData.dyn = true;
    return { c, x: c.getContext('2d'), t, m };
  };
  const CL = face('tablero', 0.3, 0.1, 600, 200, V(0.3595, 1.065, -0.33), -Math.PI / 2);
  const RF = face('radio', 0.176, 0.048, 528, 144, V(RADIO.x - 0.0005, RADIO.y, RADIO.z), -Math.PI / 2);
  ctx.setLevel('van');

  // ════════ RECORRIDO DE LA CORRIENTE (puntos animados) ════════
  const curve = Q => new THREE.CatmullRomCurve3(Q.map(P3), false, 'catmullrom', 0.3);
  const PATHS = [];
  for (const k of ['feed', 'dashR', 'dashL', 'turnF', 'turnFL', 'horn', 'wiper', 'rear', 'rearR', 'eng', 'alt', 'altB', 'spkL', 'spkR', 'radio', 'bat']) {
    const cv = curve(ROUTES[k]), len = cv.getLength(); PATHS.push({ key: k, cv, len, n: Math.max(4, Math.round(len / 0.055)) });
  }
  const dot = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d');
    const g = x.createRadialGradient(32, 32, 2, 32, 32, 30); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.45, 'rgba(255,255,255,0.9)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.fillRect(0, 0, 64, 64); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
  const pr = Math.min(window.devicePixelRatio || 1, 2), small = window.innerWidth < 900;
  let cnt = 0; for (const p of PATHS) { p.j0 = cnt; cnt += p.n; }
  const pg = new THREE.BufferGeometry();
  pg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(cnt * 3).fill(-1000), 3).setUsage(THREE.DynamicDrawUsage));
  pg.setAttribute('color', new THREE.BufferAttribute(new Float32Array(cnt * 3).fill(1), 3).setUsage(THREE.DynamicDrawUsage));
  // los puntos se achican con la distancia (de lejos no se juntan en una mancha), entre 2,5 y 8 píxeles
  const ptsMat = new THREE.PointsMaterial({ size: 0.05, sizeAttenuation: true, vertexColors: true, map: dot, transparent: true, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending });
  ptsMat.onBeforeCompile = sh => { sh.vertexShader = sh.vertexShader.replace('#include <fog_vertex>', `#include <fog_vertex>\n  gl_PointSize = clamp(gl_PointSize, ${(2.5 * pr).toFixed(1)}, ${((small ? 6.5 : 8) * pr).toFixed(1)});`); };
  const PTS = new THREE.Points(pg, ptsMat);
  PTS.frustumCulled = false; PTS.renderOrder = 4; PTS.userData.noBox = true; PTS.visible = false; root.add(PTS);
  // brillo de las ampolletas encendidas
  const glowTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d');
    const g = x.createRadialGradient(64, 64, 4, 64, 64, 62); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.25, 'rgba(255,255,255,0.55)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.fillRect(0, 0, 128, 128); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
  const LCOL = { head: '#fff4d6', pos: '#fff4d6', turnF: '#ffae3a', side: '#ffae3a', turnR: '#ffae3a', tail: '#ff3b2f', rev: '#f4f6ff', inner: '#fff1cf', plate: '#fff4d6' };
  const LSIZE = { head: 0.42, pos: 0.12, turnF: 0.2, side: 0.14, turnR: 0.24, tail: 0.26, rev: 0.2, inner: 0.22, plate: 0.1 };
  const LDIR = { head: [1, 0, 0], pos: [1, 0, 0], turnF: [1, 0, 0], turnR: [-1, 0, 0], tail: [-1, 0, 0], rev: [-1, 0, 0], plate: [-1, 0, 0], inner: [0, -1, 0] };
  const glows = [], glowGeo = new THREE.PlaneGeometry(1, 1);
  for (const m of LAMPS) {
    const id = m.userData.lamp; if (!id) continue;
    const type = id.replace(/[LR]$/, '');
    if (type === 'head' && m.geometry.type !== 'CylinderGeometry') continue;       // un brillo por faro (en la ampolleta)
    if (m.geometry.type === 'BufferGeometry' && (type === 'turnR' || type === 'tail' || type === 'rev')) continue;   // la vuelta de la esquina no lleva otro brillo
    const n = type === 'side' ? V(0, 0, id.endsWith('L') ? -1 : 1) : V(...(LDIR[type] || [1, 0, 0]));
    const sp = new THREE.Mesh(glowGeo, new THREE.MeshBasicMaterial({ map: glowTex, color: LCOL[type] || '#ffffff', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0, toneMapped: false }));
    const p0 = m.getWorldPosition(V(0, 0, 0)).addScaledVector(n, 0.012);
    sp.position.copy(p0); sp.lookAt(p0.clone().add(n)); sp.scale.setScalar(LSIZE[type] || 0.15); sp.visible = false; sp.userData.noBox = true; sp.renderOrder = 5; root.add(sp);
    glows.push({ sp, id, type });
  }

  // ════════ dibujo del tablero y de la radio ════════
  const nfmt = (x, d = 0) => x.toLocaleString('es-CL', { minimumFractionDigits: d, maximumFractionDigits: d });
  let clKey = '', rfKey = '';
  function drawCluster(r) {
    const g = r.gauges, L = r.lamps, lit = L.dash > 0;
    const key = [Math.round(g.speed), Math.round(g.temp * 100), Math.round(g.fuel * 100), L.charge, L.oil, L.brake, L.pilotL, L.pilotR, L.pilotHi, lit, r.on].join('|');
    if (key === clKey) return; clKey = key;
    const x = CL.x, W = 600, H = 200;
    x.fillStyle = '#121416'; x.fillRect(0, 0, W, H);
    const ink = lit ? '#e8f4ee' : '#8a9096', inkDim = lit ? '#9fb5ab' : '#5d6368';
    const dial = (cx, cy, rr) => { x.beginPath(); x.arc(cx, cy, rr, 0, Math.PI * 2); x.fillStyle = '#0b0c0d'; x.fill(); x.lineWidth = 3; x.strokeStyle = '#2b2f33'; x.stroke(); };
    const needle = (cx, cy, rr, a, col = '#ff6a3c') => { x.save(); x.translate(cx, cy); x.rotate(a); x.beginPath(); x.moveTo(-6, 0); x.lineTo(rr, 0); x.lineWidth = 4; x.strokeStyle = col; x.lineCap = 'round'; x.stroke(); x.restore();
      x.beginPath(); x.arc(cx, cy, 7, 0, Math.PI * 2); x.fillStyle = '#2b2f33'; x.fill(); };
    // velocímetro 0–120 km/h (izquierda)
    const SX = 112, SY = 108, SR = 86, a0 = Math.PI * 0.75, a1 = Math.PI * 2.25;
    dial(SX, SY, SR + 6);
    x.font = 'bold 15px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
    for (let v = 0; v <= 120; v += 10) {
      const a = a0 + (a1 - a0) * v / 120, big = v % 20 === 0;
      x.beginPath(); x.moveTo(SX + Math.cos(a) * (SR - (big ? 12 : 6)), SY + Math.sin(a) * (SR - (big ? 12 : 6))); x.lineTo(SX + Math.cos(a) * SR, SY + Math.sin(a) * SR);
      x.lineWidth = big ? 3 : 1.5; x.strokeStyle = ink; x.stroke();
      if (big) { x.fillStyle = ink; x.fillText(String(v), SX + Math.cos(a) * (SR - 28), SY + Math.sin(a) * (SR - 28)); }
    }
    x.font = '11px sans-serif'; x.fillStyle = inkDim; x.fillText('km/h', SX, SY + 36);
    needle(SX, SY, SR - 8, a0 + (a1 - a0) * Math.min(1, g.speed / 120));
    // combinado: bencina arriba, temperatura abajo (derecha)
    const CX = 488, CY = 108, CR = 86;
    dial(CX, CY, CR + 6);
    const arc = (b0, b1, labels, val, warnHi) => {
      const ccw = b1 < b0;                                                         // la de temperatura va por abajo
      x.lineWidth = 4; x.beginPath(); x.arc(CX, CY, CR - 6, b0, b1, ccw); x.strokeStyle = ink; x.stroke();
      if (warnHi) { x.beginPath(); x.arc(CX, CY, CR - 6, b1 - (b1 - b0) * 0.12, b1, ccw); x.strokeStyle = '#d23a2e'; x.stroke(); }
      x.font = 'bold 15px sans-serif'; x.fillStyle = ink;
      x.fillText(labels[0], CX + Math.cos(b0) * (CR - 24), CY + Math.sin(b0) * (CR - 24)); x.fillText(labels[1], CX + Math.cos(b1) * (CR - 24), CY + Math.sin(b1) * (CR - 24));
      needle(CX, CY, CR - 14, b0 + (b1 - b0) * Math.max(-0.06, Math.min(1.06, val)), '#ff6a3c');
    };
    arc(Math.PI * 1.15, Math.PI * 1.85, ['E', 'F'], g.fuel, false);
    arc(Math.PI * 0.85, Math.PI * 0.15, ['C', 'H'], g.temp, true);
    x.font = '11px sans-serif'; x.fillStyle = inkDim; x.fillText('bencina', CX, CY - 28); x.fillText('temperatura', CX, CY + 30);
    // testigos al centro
    const lamp = (cx, cy, on, col, draw) => { x.save(); x.translate(cx, cy); x.globalAlpha = on ? 1 : 0.16; x.fillStyle = on ? col : '#4a4f54'; x.strokeStyle = on ? col : '#4a4f54'; if (on) { x.shadowColor = col; x.shadowBlur = 14; } draw(); x.restore(); };
    lamp(262, 40, L.pilotL, '#41e07a', () => { x.beginPath(); x.moveTo(-16, 0); x.lineTo(0, -12); x.lineTo(0, -5); x.lineTo(14, -5); x.lineTo(14, 5); x.lineTo(0, 5); x.lineTo(0, 12); x.closePath(); x.fill(); });
    lamp(338, 40, L.pilotR, '#41e07a', () => { x.beginPath(); x.moveTo(16, 0); x.lineTo(0, -12); x.lineTo(0, -5); x.lineTo(-14, -5); x.lineTo(-14, 5); x.lineTo(0, 5); x.lineTo(0, 12); x.closePath(); x.fill(); });
    lamp(300, 40, L.pilotHi, '#4f8cff', () => { x.beginPath(); x.arc(-4, 0, 11, Math.PI / 2, Math.PI * 1.5, true); x.closePath(); x.fill(); for (let k = -2; k <= 2; k++) x.fillRect(-26, k * 5 - 1, 14, 2.4); });
    lamp(262, 112, L.charge, '#ff4b3a', () => { x.fillRect(-15, -9, 30, 19); x.fillRect(-10, -13, 6, 4); x.fillRect(4, -13, 6, 4); x.fillStyle = '#121416'; x.fillRect(-11, -1, 7, 2); x.fillRect(4, -1, 7, 2); x.fillRect(6.5, -3.5, 2, 7); });
    lamp(300, 112, L.oil, '#ff4b3a', () => { x.beginPath(); x.ellipse(0, 3, 15, 7, 0, 0, Math.PI * 2); x.fill(); x.fillRect(10, -4, 10, 3); x.beginPath(); x.moveTo(-14, -2); x.lineTo(-20, -9); x.lineWidth = 3; x.stroke(); });
    lamp(338, 112, L.brake, '#ff4b3a', () => { x.lineWidth = 3; x.beginPath(); x.arc(0, 0, 13, 0, Math.PI * 2); x.stroke(); x.font = 'bold 18px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('!', 0, 1); });
    x.font = '10px sans-serif'; x.fillStyle = inkDim; x.textAlign = 'center';
    x.fillText(r.on ? 'contacto' : 'sin contacto', 300, 170);
    CL.t.needsUpdate = true;
  }
  function drawRadio(r) {
    const R = r.radio;
    const key = [R.on, Math.round(R.vol * 50)].join('|');
    if (key === rfKey) return; rfKey = key;
    const x = RF.x, W = 528, H = 144;
    const g = x.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#24282c'); g.addColorStop(0.5, '#0f1113'); g.addColorStop(1, '#1a1d20');
    x.fillStyle = g; x.fillRect(0, 0, W, H);
    x.fillStyle = '#050607'; x.fillRect(150, 10, 300, 6);                                         // ranura del CD
    x.fillStyle = R.on ? '#0b1a20' : '#08090a'; x.fillRect(160, 36, 250, 58);                        // pantalla
    if (R.on) {
      x.fillStyle = '#8fe3ff'; x.font = 'bold 30px monospace'; x.textAlign = 'left'; x.textBaseline = 'middle';
      x.shadowColor = '#4fd0ff'; x.shadowBlur = 10;
      x.fillText('BT AUDIO', 172, 58); x.font = '18px monospace'; x.fillText('VOL ' + String(Math.round(R.vol * 50)).padStart(2, ' '), 172, 84);
      x.shadowBlur = 0;
    }
    for (let i = 0; i < 6; i++) { x.fillStyle = R.on ? '#3a4a52' : '#22262a'; x.fillRect(160 + i * 42, 108, 34, 18); }   // botones
    x.fillStyle = '#2b3034'; x.fillRect(452, 52, 30, 14);                                              // USB
    RF.t.needsUpdate = true;
  }

  // caja invisible que encierra unos puntos: para encuadrar la cámara
  function boxOf(pts, pad = 0) {
    const b = new THREE.Box3(); pts.forEach(q => b.expandByPoint(q)); b.expandByScalar(pad);
    const m = new THREE.Mesh(new THREE.BoxGeometry(...b.getSize(V(0, 0, 0)).toArray().map(x => Math.max(x, 1e-3))));
    m.position.copy(b.getCenter(V(0, 0, 0))); m.visible = false; m.userData.noBox = true; root.add(m); return m;
  }
  // ════════ pintar: ampolletas, cables y recorrido ════════
  const tmpC = new THREE.Color(), hotC = new THREE.Color('#ffb52e'), redC = new THREE.Color('#ff4b3a');
  const LEMIS = { head: '#fff4d6', pos: '#fff1cf', turnF: '#ff9a1a', side: '#ff9a1a', turnR: '#ff9a1a', tail: '#ff2a2a', rev: '#f6f8ff', inner: '#fff1cf', plate: '#fff4d6' };
  function lampLevel(id, r) {
    const L = r.lamps, type = id.replace(/[LR]$/, ''), side = id.endsWith('L') ? 'L' : id.endsWith('R') ? 'R' : '';
    switch (type) {
      case 'head': return L.head * (L.high ? 1.15 : 1);
      case 'pos': return L.pos;
      case 'turnF': case 'side': return side === 'L' ? L.turnL : L.turnR;
      case 'turnR': return side === 'L' ? (L.rearLout ? 0 : L.turnL) : L.turnR;
      case 'tail': return Math.max(L.stop, L.pos * 0.35);
      case 'rev': return L.rev;
      case 'inner': return L.inner;
      case 'plate': return L.pos;
      default: return 0;
    }
  }
  let mode = 'van', bodyMode = 'solid';
  function paintLamps(base) {
    const r = st.last; if (!r) return;
    const showGlow = mode === 'ele' || (mode === 'van' && bodyMode !== 'hidden');
    for (const m of LAMPS) {
      const id = m.userData.lamp; if (!id) continue;
      const mat = m.material;
      if (base || !m.userData.e0) m.userData.e0 = { c: mat.emissive.clone(), i: mat.emissiveIntensity };
      const v = Math.min(1.4, lampLevel(id, r)), type = id.replace(/[LR]$/, '');
      if (v > 0.02 && m.visible) { mat.emissive.set(LEMIS[type] || '#ffffff'); mat.emissiveIntensity = 0.35 + 0.9 * Math.min(1.2, v); }
      else { mat.emissive.copy(m.userData.e0.c); mat.emissiveIntensity = m.userData.e0.i; }
    }
    for (const gl of glows) {
      const v = Math.min(1.3, lampLevel(gl.id, r));
      gl.sp.visible = showGlow && v > 0.02; gl.sp.material.opacity = Math.min(1, 0.25 + 0.6 * v);
      gl.sp.scale.setScalar((LSIZE[gl.type] || 0.15) * (0.7 + 0.35 * Math.min(1.3, v)));
    }
    CL.m.visible = RF.m.visible = mode === 'ele' || mode === 'van';
    drawCluster(r); drawRadio(r);
  }
  function bind(meshes) { press.length = 0; meshes.forEach(m => press.push(m)); }
  const ACT = r => {
    const has = id => r.items.find(i => i.id === id), I = id => (has(id) ? has(id).I : 0);
    const fuse = id => (r.fuses.find(f => f.id === id) || { I: 0 }).I;
    return {
      e_feed: r.iLoad, e_dash: fuse('faroI') + fuse('faroD') + (r.lamps.turnL || r.lamps.turnR ? 2 : 0) + fuse('radio') * 0.2 + I('pos'),
      e_rear: fuse('cola') + fuse('giro'), e_eng: fuse('ign'), e_altb: r.iAlt, e_spk: r.radio.sound ? 0.6 + 2 * r.radio.vol : 0, e_radio: fuse('radio'),
      e_horn: I('horn'), e_wiper: I('wiper'), e_ant: r.radio.on ? 0.3 : 0,
      ...Object.fromEntries(FUSES.map((F, i) => ['e_fu' + i, fuse(F.id)])),   // cada fusible, según la corriente que pasa
    };
  }
  function paint(m0, colorMode) {
    const r = st.last; if (!r || m0 !== 'ele' || colorMode !== 'real') return;
    const act = ACT(r);
    for (const m of press) {
      const k = m.material.userData.press, a = act[k]; if (a === undefined) continue;
      const kk = Math.min(1, a / 12);
      m.material.color.copy(m.material.userData.real);
      if (a > 0.05) m.material.color.lerp(kk > 0.75 ? redC : hotC, 0.22 + 0.45 * kk);
    }
  }
  const col = new THREE.Color(), pos = new THREE.Vector3();
  let tFlow = 0;
  function animate(dt, r) {
    tFlow += dt;
    // corriente: velocidad y cantidad de puntos según los amperes; el sentido en el cable de la batería según cargue o descargue
    const I = {
      feed: r.iLoad, dashR: (r.items.find(i => i.id === 'faroD') || { I: 0 }).I + (r.lamps.turnR ? 2 : 0) + 0.3, dashL: (r.items.find(i => i.id === 'faroI') || { I: 0 }).I + (r.lamps.turnL ? 2 : 0),
      turnF: r.lamps.turnR ? 1.8 : 0, turnFL: r.lamps.turnL ? 1.8 : 0, horn: (r.items.find(i => i.id === 'horn') || { I: 0 }).I, wiper: (r.items.find(i => i.id === 'wiper') || { I: 0 }).I,
      rear: (r.fuses.find(f => f.id === 'cola') || { I: 0 }).I + (r.fuses.find(f => f.id === 'giro') || { I: 0 }).I * 0.5, rearR: r.lamps.turnR || r.lamps.stop || r.lamps.pos ? 1.2 : 0,
      eng: (r.fuses.find(f => f.id === 'ign') || { I: 0 }).I, alt: r.on ? 0.3 : 0, altB: r.iAlt, spkL: r.radio.sound ? 1 + 2 * r.radio.vol : 0, spkR: r.radio.sound ? 1 + 2 * r.radio.vol : 0,
      radio: (r.fuses.find(f => f.id === 'radio') || { I: 0 }).I, bat: r.crank ? r.crank.I : -r.iBat,
    };
    const PA = pg.attributes.position.array, CA = pg.attributes.color.array;
    let any = false;
    for (const p of PATHS) {
      const a = I[p.key] || 0, mag = Math.abs(a);
      const show = mag < 0.04 ? 0 : Math.round(p.n * Math.min(1, 0.25 + Math.log10(1 + mag) / 2));
      if (show) any = true;
      const dir = p.key === 'bat' ? Math.sign(a) || 1 : 1, speed = dir * (0.05 + 0.035 * Math.sqrt(mag));
      col.set(mag > 60 ? '#ff5a3a' : mag > 8 ? '#ffb52e' : '#ffe08a');
      for (let j = 0; j < p.n; j++) {
        const k = (p.j0 + j) * 3;
        if (j >= show) { PA[k] = PA[k + 2] = 0; PA[k + 1] = -1000; continue; }
        const u = (((j / p.n) + tFlow * speed / p.len) % 1 + 1) % 1;
        p.cv.getPointAt(u, pos); PA[k] = pos.x; PA[k + 1] = pos.y; PA[k + 2] = pos.z;
        CA[k] = col.r; CA[k + 1] = col.g; CA[k + 2] = col.b;
      }
    }
    pg.attributes.position.needsUpdate = true; pg.attributes.color.needsUpdate = true;
    return any;
  }
  // limpiaparabrisas, llave, parlantes y perilla
  let spkT = 0;
  function pose(dt, r) {
    keyG.rotation.z = -(KEYANG[st.key] || 0);
    const u = st.wipeT % 1, ang = -1.65 * (1 - Math.cos(2 * Math.PI * u)) / 2;
    for (const w of BD.wipers || []) w.g.quaternion.setFromAxisAngle(w.n, ang);
    spkT += dt;
    for (const s of spk) { const k = r.radio.sound ? (0.0012 + 0.003 * r.radio.vol) * (0.5 + 0.5 * Math.sin(spkT * 37 + s.s) * Math.sin(spkT * 11.3)) : 0; s.cone.position.z = -s.s * k; }
    knob.rotation.x = -r.radio.vol * 4.5;
  }

  function setActive(on) { st.active = on; PTS.visible = on && st.showI !== false; }
  function setMode(m, bm) { mode = m; bodyMode = bm || bodyMode; if (m !== 'ele') PTS.visible = false; paintLamps(true); }
  function setCuts(on) { if (on) planes.fus.setFromNormalAndCoplanarPoint(V(1, 0, 0), V(FB.x - 0.01, 0, 0)); else planes.fus.set(V(0, 1, 0), 1e4); }
  // avanza la simulación (en todas las vistas, a tiempo real) y anima lo de esta vista
  function step(dt, inp) {
    const r = elecStep(st, Math.min(dt, 2), inp);
    if (dt > 2) { const rest = Math.min(dt - 2, 7200); const k = r.iBat > 0 ? 0.92 : 1; st.soc = Math.max(0, Math.min(1, st.soc + r.iBat * k * rest / 3600 / r.ah)); }   // tiempo fuera: sólo la carga de la batería
    return r;
  }
  // devuelve si sigue habiendo algo que se mueve: destellos, plumillas, encendedor, parlantes o corriente a la vista
  function tick(dt, r) {
    pose(dt, r);
    let act = r.flashing || st.wipeOn || st.lighter > 0 || st.horn;
    if (st.active) { if (r.radio.sound) act = true; if (PTS.visible && animate(dt, r)) act = true; }
    const res = act || st.prevAct; st.prevAct = act;                  // un cuadro más al terminar: que se vea cómo quedó
    return res;
  }
  function setTheFrame(r) { pose(0, r); }
  return {
    st, planes, bind, paint, paintLamps, setActive, setMode, setCuts, step, tick, pose: setTheFrame, solve: inp => (st.last = elecSolve(st, inp)), crankAt: inp => crankAt(st, inp),
    startCheck: inp => startCheck(st, inp),
    get result() { return st.last; }, showFlow(on) { st.showI = on; PTS.visible = on && st.active; },
    fusePos: FUSEPOS, groups: { fusibles: [fg], chapa: [kg], bocina: [hg], puerta: [spk[0].g], tablero: [CL.m], radio: [RF.m],
      antena: [boxOf([ANT0, ANT1], 0.03)], bateria: [boxOf([V(BAT.x - 0.12, BAT.y - 0.09, BAT.z - 0.08), V(BAT.x + 0.19, BAT.y + 0.13, BAT.z + 0.1)])],
      motor: [boxOf([altBx.min, altBx.max, stBx.isEmpty() ? starter : stBx.min, stBx.isEmpty() ? starter : stBx.max, coil, ...(distBx.isEmpty() ? [] : [distBx.min, distBx.max])])],
      delante: [boxOf([headL, headR, turnFL, turnFR, HORN], 0.06)], atras: [boxOf([tailL, tailR, V(BODY.REAR, 1.0, 0)], 0.08)] },
  };
}
