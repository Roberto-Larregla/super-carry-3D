// Visor 3D: un solo modelo. El motor F10A completo va dentro del furgón; la vista "Motor" lo enfoca en su lugar.
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { PARTS, SYS, QLEV, qual3d } from './data.js';
import { TILT } from './geom.js';
import { buildVan } from './van3d.js';

const KINDS = {
  iron:   { c: '#61676c', m: 0.55, r: 0.5 },
  alu:    { c: '#adb3b7', m: 0.65, r: 0.35 },
  steel:  { c: '#454b50', m: 0.6, r: 0.45 },
  dark:   { c: '#272b2e', m: 0.3, r: 0.6 },
  rubber: { c: '#17191b', m: 0.0, r: 0.92 },
  chrome: { c: '#d8dce0', m: 1.0, r: 0.2 },
  copper: { c: '#b47a4c', m: 0.55, r: 0.45 },
  plastic:{ c: '#2e3337', m: 0.0, r: 0.7 },
  white:  { c: '#e9ecea', m: 0.05, r: 0.5 },
  fabric: { c: '#3d4348', m: 0.0, r: 0.95 },
  hose:   { c: '#1f2224', m: 0.0, r: 0.8 },
  amber:  { c: '#ffb04a', m: 0.1, r: 0.4, e: '#ff9a1a', ei: 0.35 },
  red:    { c: '#d83b3b', m: 0.1, r: 0.4, e: '#ff2a2a', ei: 0.25 },
  lamp:   { c: '#f2efe4', m: 0.1, r: 0.2, e: '#fff1cf', ei: 0.45 },
  ceramic:{ c: '#e7e2d6', m: 0.0, r: 0.6 },
  water:  { c: '#2f93b5', m: 0.0, r: 0.2, e: '#14506a', ei: 0.45 },
  oil:    { c: '#d9a066', m: 0.0, r: 0.3, e: '#5a3410', ei: 0.35 },
  blue:   { c: '#2d5f9e', m: 0.45, r: 0.35 },
  brass:  { c: '#b8953a', m: 0.85, r: 0.35 },
  lead:   { c: '#2a2020', m: 0.0, r: 0.6 },
  sensor: { c: '#c02f9a', m: 0.0, r: 0.5, e: '#c02f9a', ei: 0.55 },
  // carrocería e interior
  paint:  { c: '#dfe2de', m: 0.02, r: 0.42, cc: 0.7, ccr: 0.12 },
  trim:   { c: '#1b1e20', m: 0.05, r: 0.62 },
  glass:  { c: '#6f8e99', m: 0.35, r: 0.04 },
  tint:   { c: '#1a2125', m: 0.4, r: 0.06 },
  rim:    { c: '#25292c', m: 0.7, r: 0.32 },
  floorp: { c: '#e3e5e1', m: 0.05, r: 0.55 },
  felt:   { c: '#3c4f66', m: 0.0, r: 0.95 },
  seat:   { c: '#26292c', m: 0.0, r: 0.9 },
  tire:   { c: '#141618', m: 0.0, r: 0.88 },
  shade:  { c: '#cdd2cf', m: 0.12, r: 0.4 },
  lens:   { c: '#dfe9ee', m: 0.2, r: 0.03 },
  machined: { c: '#cfd4d8', m: 0.85, r: 0.24 },
  bar:    { c: '#b4babf', m: 0.75, r: 0.32 },
  mat:    { c: '#1d2022', m: 0.0, r: 0.92 },
  dash:   { c: '#2b2e31', m: 0.05, r: 0.78 },
  // frenos
  pad:    { c: '#3b302a', m: 0.05, r: 0.85 },
  fluid:  { c: '#d9ad55', m: 0.0, r: 0.25, e: '#7a5212', ei: 0.3 },
  resv:   { c: '#f1ece0', m: 0.0, r: 0.3 },
  hose2:  { c: '#5a524b', m: 0.0, r: 0.75 },
};
const NOTINT = new Set(['water', 'oil', 'sensor', 'fluid']);
const BODYKINDS = new Set(['paint', 'trim', 'glass', 'tint', 'rim', 'floorp', 'felt', 'seat', 'tire', 'shade', 'lens', 'machined', 'bar', 'mat', 'dash']);

export function createViewer(host, { labelLayer, onSelect, onTick, onBrake }) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.localClippingEnabled = true;
  renderer.domElement.className = 'gl';
  host.prepend(renderer.domElement);

  const scene = new THREE.Scene();
  { // fondo de estudio: crema arriba, arena abajo (como una foto de catálogo)
    const c = document.createElement('canvas'); c.width = 4; c.height = 256; const x = c.getContext('2d');
    const g = x.createLinearGradient(0, 0, 0, 256); g.addColorStop(0, '#f6eee1'); g.addColorStop(0.55, '#efe4d2'); g.addColorStop(1, '#e2d4bd');
    x.fillStyle = g; x.fillRect(0, 0, 4, 256);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; scene.background = t; }
  scene.fog = new THREE.Fog('#e9dcc7', 11, 24);
  const camera = new THREE.PerspectiveCamera(34, 1, 0.02, 60);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true; controls.dampingFactor = 0.09;
  controls.minDistance = 0.6; controls.maxDistance = 12;
  controls.rotateSpeed = 0.8; controls.zoomSpeed = 0.9; controls.panSpeed = 0.8;
  controls.screenSpacePanning = true;

  // luz de ambiente por imagen (reflejos en pintura, vidrios y cromados) + luces direccionales suaves
  { const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture; pm.dispose(); }
  scene.add(new THREE.HemisphereLight('#d6ecff', '#1c1712', 0.42));
  const key = new THREE.DirectionalLight('#fff8ee', 2.6); key.position.set(3, 5.5, -4); scene.add(key);
  const rim = new THREE.DirectionalLight('#c3d3ff', 0.7); rim.position.set(-4, 2.5, 3.5); scene.add(rim);
  const fill = new THREE.DirectionalLight('#eef4ff', 0.75); fill.position.set(2.5, 1.5, 4); scene.add(fill);
  const under = new THREE.DirectionalLight('#ffd7a8', 0.4); under.position.set(0.5, -3, -1); scene.add(under);

  // piso
  const floorShadows = [];
  const shadowTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d'); const g = x.createRadialGradient(64, 64, 4, 64, 64, 64); g.addColorStop(0, 'rgba(0,0,0,0.62)'); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(c); })();
  { const grid = new THREE.GridHelper(12, 48, '#c9b89c', '#d9cbb2'); grid.material.transparent = true; grid.material.opacity = 0.75; grid.position.set(-0.9, 0, 0); scene.add(grid);
    const sh = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 2.2), new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false }));
    sh.rotation.x = -Math.PI / 2; sh.position.set(-0.85, 0.003, 0); sh.userData.shadow = 1; scene.add(sh); floorShadows.push(sh); }

  // ——— geometría ———
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const rbox = (w, h, d, r = 0.012) => new RoundedBoxGeometry(w, h, d, 2, Math.min(r, w / 2.1, h / 2.1, d / 2.1));
  const cylX = (r, len, seg = 24, r2) => { const g = new THREE.CylinderGeometry(r2 ?? r, r, len, seg); g.rotateZ(-Math.PI / 2); return g; };
  const cylY = (r, len, seg = 24, r2) => new THREE.CylinderGeometry(r2 ?? r, r, len, seg);
  const cylZ = (r, len, seg = 24) => { const g = new THREE.CylinderGeometry(r, r, len, seg); g.rotateX(Math.PI / 2); return g; };
  const tube = (pts, r, closed = false, seg) => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map(p => Array.isArray(p) ? V(...p) : p), closed, 'catmullrom', 0.35), seg || Math.max(16, pts.length * 14), r, 8, closed);
  function helix(r, h, turns, wire) {
    class H extends THREE.Curve { getPoint(t, o = new THREE.Vector3()) { const a = t * turns * Math.PI * 2; return o.set(Math.cos(a) * r, t * h - h / 2, Math.sin(a) * r); } }
    return new THREE.TubeGeometry(new H(), Math.ceil(turns * 28), wire, 6, false);
  }

  const sysColor = id => new THREE.Color(SYS[PARTS[id]?.sys]?.color || '#ffffff');
  const GHOST = new THREE.Color('#fffaf0');
  const qcache = {}; const qcol = id => (qcache[id] ||= new THREE.Color(QLEV[qual3d(id)].color));
  function makeMat(part, kind, o = {}) {
    const k = KINDS[kind] || KINDS.steel;
    const Mat = k.cc ? THREE.MeshPhysicalMaterial : THREE.MeshStandardMaterial;   // pintura con barniz: los reflejos muestran las curvas
    const mat = new Mat({ color: k.c, metalness: k.m, roughness: k.r, side: o.double ? THREE.DoubleSide : THREE.FrontSide, envMapIntensity: k.cc ? 0.95 : BODYKINDS.has(kind) ? 0.75 : 0.45 });
    if (k.cc) {
      mat.clearcoat = k.cc; mat.clearcoatRoughness = k.ccr; mat.envMapIntensity = 0.62;
      // sombreado de contacto: la parte baja de la carrocería recibe menos cielo (como en las fotos)
      mat.onBeforeCompile = sh => {
        sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying float vWY;').replace('#include <project_vertex>', '#include <project_vertex>\nvWY = (modelMatrix * vec4(transformed, 1.0)).y;');
        sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vWY;').replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb *= mix(0.72, 1.0, smoothstep(0.32, 1.3, vWY));');
      };
      mat.customProgramCacheKey = () => 'paint-ao';
    }
    if (k.e) { mat.emissive = new THREE.Color(k.e); mat.emissiveIntensity = k.ei; }
    const real = new THREE.Color(k.c), sc = sysColor(part);
    const mixAmt = NOTINT.has(kind) || BODYKINDS.has(kind) ? 0 : ['rubber', 'hose', 'lead'].includes(kind) ? 0.28 : ['dark', 'plastic'].includes(kind) ? 0.5 : 0.72;
    mat.userData = { real, sys: real.clone().lerp(sc, mixAmt), sc, kEm: k.e ? new THREE.Color(k.e) : null, kEi: k.ei || 0, casing: !!o.casing, keep: !!o.keep, op: o.op ?? 1, side: o.side || null, wire: !!o.wire, cut: o.cut || null, press: o.press || null };
    if (o.op != null && o.op < 1) { mat.transparent = true; mat.opacity = o.op; mat.depthWrite = false; }
    return mat;
  }

  // ——— un solo mundo ———
  const W = { root: new THREE.Group(), meshes: [], explodables: [], anchors: {}, partBoxes: {}, allBox: new THREE.Box3(), engBox: new THREE.Box3(), brkBox: new THREE.Box3(), anim: null };
  scene.add(W.root);
  const engParts = new Set(), brkParts = new Set();
  let level = 'van';                         // 'eng' mientras se construye el motor, 'brk' los frenos
  function reg(obj, part, ex) {
    obj.userData.part = part; obj.userData.base = obj.position.clone();
    obj.userData.ex = ex ? V(...ex) : V(0, 0, 0); obj.userData.lvl = level;
    W.explodables.push(obj); return obj;
  }
  function add(part, geo, kind, o = {}) {
    const m = new THREE.Mesh(geo, makeMat(part, kind, o));
    if (o.p) m.position.set(...o.p);
    if (o.r) m.rotation.set(...o.r);
    if (o.s) m.scale.set(...o.s);
    m.userData.part = part; m.userData.pick = o.pick !== false; m.userData.noAnchor = !!o.wire || !!o.noAnchor;
    if (o.body) m.userData.body = o.body;        // pieza de carrocería: paint, trim, glass, tint, lamp, rack, int
    if (level === 'eng') { m.userData.eng = true; engParts.add(part); }
    if (level === 'brk') { m.userData.brk = true; brkParts.add(part); }
    (o.parent || W.root).add(m);
    if (o.ex !== null && o.ex !== undefined) reg(m, part, o.ex);
    W.meshes.push(m);
    return m;
  }
  function group(part, parent, p = [0, 0, 0], ex) { const g = new THREE.Group(); g.position.set(...p); (parent || W.root).add(g); reg(g, part, ex || [0, 0, 0]); return g; }
  function regMesh(mesh, part, parent) { mesh.userData.part = part; mesh.userData.pick = true; mesh.frustumCulled = false; if (level === 'eng') { mesh.userData.eng = true; engParts.add(part); } (parent || W.root).add(mesh); W.meshes.push(mesh); return mesh; }

  const clip = { casing: new THREE.Plane(V(0, 1, 0), 1e4), all: new THREE.Plane(V(0, 1, 0), 1e4) };
  const ctx = { V, rbox, cylX, cylY, cylZ, tube, helix, add, group, reg, regMesh, makeMat, lite: false, mode: 'van', exk: 1, world: W,
    setLevel: l => { level = l; }, clipAll: m => { m.clippingPlanes = [clip.all]; } };
  const VAN = buildVan(ctx); W.anim = VAN;
  VAN.ground && VAN.ground.traverse(o => { if (o.userData.shadow && o !== VAN.ground) floorShadows.push(o); });
  mergeStatic();
  for (const m of W.meshes) if (m.userData.eng) m.material.clippingPlanes = [m.material.userData.casing ? clip.casing : clip.all];
  const BR = VAN.brakes;
  for (const m of W.meshes) { const c = m.material.userData.cut; if (c && BR.planes[c]) m.material.clippingPlanes = [BR.planes[c]]; }
  BR.bind(W.meshes.filter(m => m.material.userData.press));
  W.explodables.forEach(o => o.userData.base.copy(o.position));

  // Junta las mallas estáticas que comparten padre, pieza y material: menos llamadas de dibujo (clave en celulares)
  function mergeStatic() {
    const groups = new Map();
    for (const m of W.meshes) {
      if (m.isInstancedMesh || m.userData.dyn || !m.parent) continue;
      const mat = m.material, ud = mat.userData;
      const exk = m.userData.base ? `${m.userData.ex.x},${m.userData.ex.y},${m.userData.ex.z},${m.userData.lvl}` : '-';
      const key = [m.parent.uuid, m.userData.part, mat.type, mat.color.getHexString(), mat.metalness, mat.roughness, mat.side, mat.emissive.getHexString(), mat.emissiveIntensity, mat.envMapIntensity, ud.op, ud.casing, ud.side, ud.wire, ud.cut || '', ud.press || '', m.userData.body || '', m.userData.pick, m.userData.noAnchor, !!m.userData.eng, !!m.userData.brk, exk].join('|');
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(m);
    }
    const drop = new Set(), added = [];
    for (const list of groups.values()) {
      if (list.length < 2) continue;
      const geos = list.map(m => {
        m.updateMatrix(); let g = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone();
        for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
        if (!g.attributes.normal) g.computeVertexNormals();
        g.applyMatrix4(m.matrix); return g;
      });
      const merged = mergeGeometries(geos, false); if (!merged) continue;
      const first = list[0], mm = new THREE.Mesh(merged, first.material);
      for (const k of ['part', 'pick', 'noAnchor', 'body', 'eng', 'brk']) if (k in first.userData) mm.userData[k] = first.userData[k];
      first.parent.add(mm);
      if (first.userData.base) { mm.userData.base = new THREE.Vector3(); mm.userData.ex = first.userData.ex.clone(); mm.userData.lvl = first.userData.lvl; added.push(mm); }
      for (const m of list) { m.parent.remove(m); m.geometry.dispose(); if (m.material !== first.material) m.material.dispose(); drop.add(m); }
      W.meshes.push(mm);
    }
    W.meshes = W.meshes.filter(m => !drop.has(m));
    W.explodables = W.explodables.filter(o => !drop.has(o)).concat(added);
  }

  // ════════ ESTADO, MATERIALES Y SELECCIÓN ════════
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const state = { mode: 'van', focus: null, sel: null, colorMode: 'real', body: 'solid', labels: false, running: false, theta: 0, cut: 'none', bcut: false, speed: 0.6, rack: true, exVan: 0, exEng: 0 };
  Object.defineProperty(state, 'explode', { get: () => (state.mode === 'eng' ? state.exEng : state.exVan), set: v => { if (state.mode === 'eng') state.exEng = v; else state.exVan = v; }, enumerable: true });
  const xraySys = new Set(['motor', 'electrico', 'lubricacion', 'transmision', 'sensores']);
  const matchFocus = (P, f) => !!P && (P.sys === f || P.serves === f || (P.also || []).includes(f));
  const isEngPart = id => engParts.has(id), isBrkPart = id => brkParts.has(id);
  const inMode = id => (state.mode === 'eng' ? isEngPart(id) : state.mode === 'brk' ? isBrkPart(id) : true);

  function applyMaterials() {
    const isEng = state.mode === 'eng', isBrk = state.mode === 'brk', selP = PARTS[state.sel];
    const xray = isEng ? state.cut === 'xray' : !isBrk && ((state.focus && xraySys.has(state.focus)) || (selP && (xraySys.has(selP.sys) || xraySys.has(selP.serves))));
    const focusBody = !isEng && !isBrk && (state.focus === 'carroceria' || (selP && selP.sys === 'carroceria'));
    const bodyMode = isEng || isBrk ? 'hidden' : ((state.focus && !focusBody) ? (state.body === 'solid' ? 'ghost' : state.body) : state.body);
    const solid = bodyMode === 'solid';
    const dimOp = state.focus === 'sensores' ? 0.16 : 0.07;
    const qmode = state.colorMode === 'qual';
    for (const m of W.meshes) {
      const ud = m.material.userData, part = m.userData.part;
      if (!ud.real) continue;
      const P = PARTS[part];
      const isSel = state.sel === part;
      const inFocus = !state.focus || matchFocus(P, state.focus);
      let op = ud.op;
      const cat = m.userData.body;
      if (cat) {
        const inner = cat === 'int' || cat === 'seat';
        const hide = (bodyMode === 'hidden' && !inner) || (cat === 'rack' && !state.rack) || (isEng && inner);
        m.visible = !hide; if (hide) continue;
        m.material.color.copy(qmode ? qcol(part) : ud.real);
        if (cat === 'int' || cat === 'seat') op = isBrk ? Math.min(op, 0.08) : solid ? 1 : Math.min(op, focusBody || isSel ? 0.7 : 0.38);
        else if (cat === 'paint') op = solid ? 1 : (focusBody ? 0.2 : 0.075);
        else if (cat === 'glass') op = solid ? 0.36 : 0.1;
        else if (cat === 'tint') op = solid ? 0.84 : 0.13;
        else if (cat === 'lamp') op = solid ? 1 : 0.55;
        else op = solid ? 1 : (focusBody ? 0.6 : 0.28);
        if (state.focus && !inFocus && !focusBody && !isSel) op = Math.min(op, solid ? op : 0.05);
      } else {
        m.material.color.copy(qmode ? qcol(part) : state.colorMode === 'sys' ? ud.sys : ud.real);
        if (ud.wire) m.visible = state.focus === 'sensores' || isSel;
        if (isEng && !m.userData.eng && !isSel) op = Math.min(op, inFocus && state.focus ? 0.12 : 0.06);
        else if (isBrk && !m.userData.brk && !isSel) op = Math.min(op, part === 'ruedas' ? (state.bcut ? 0.07 : 0.12) : 0.06);
        else if (!inFocus && !isSel) op = Math.min(op, dimOp);
        else if (ud.casing && xray) op = Math.min(op, isEng ? 0.14 : 0.22);
        if (isEng && state.cut === 'long' && ud.side === 'ex') op = Math.min(op, 0.06);
        if (isBrk && state.bcut && ud.cut === 'xray') op = Math.min(op, 0.2);
      }
      // sobre el fondo claro, lo atenuado se vuelve un fantasma claro (si no, las capas oscuras forman una mancha)
      if (op < 0.13 && !isSel && !(ud.casing && xray)) m.material.color.lerp(GHOST, 0.78);
      const tr = op < 1;
      if (m.material.transparent !== tr) m.material.needsUpdate = true;
      m.material.opacity = op; m.material.transparent = tr; m.material.depthWrite = !tr;
      const sensorGlow = state.focus === 'sensores' && P && P.sys === 'sensores';
      if (isSel) { m.material.emissive.copy(ud.sc); m.material.emissiveIntensity = cat ? 0.28 : 0.55; }
      else if (sensorGlow) { m.material.emissive.copy(ud.sc); m.material.emissiveIntensity = 0.5; }
      else if (inFocus && state.focus && !cat && !isBrk) { m.material.emissive.copy(ud.sc); m.material.emissiveIntensity = 0.12; }
      else if (ud.kEm && !qmode) { m.material.emissive.copy(ud.kEm); m.material.emissiveIntensity = ud.kEi; }
      else { m.material.emissive.setRGB(0, 0, 0); m.material.emissiveIntensity = 0; }
    }
    VAN.setLines(bodyMode, focusBody);
    // la sombra del piso sólo tiene sentido con la carrocería sólida; en rayos X se ve como una mancha
    { const k = bodyMode === 'solid' && !isEng ? 1 : 0.15; for (const o of floorShadows) o.material.opacity = o.userData.shadow * k; }
    const showIn = isEng ? state.cut !== 'none' : !!xray;
    VAN.engine.A.sparks.forEach(s => s.visible = showIn);
    VAN.engine.A.gas.forEach(g => g.visible = isEng && state.cut !== 'none' && state.exEng < 0.04);
    if (isBrk) BR.paint('brk', state.colorMode);
    requestRender();
  }

  // ——— etiquetas HTML ———
  const labelEls = {};
  function computeAnchors() {
    W.root.updateMatrixWorld(true);
    const box = new THREE.Box3(), c = new THREE.Vector3(), byPart = {};
    for (const m of W.meshes) { if (m.userData.noAnchor) continue; if (m.userData.body && m.userData.part === 'carroceria') continue; (byPart[m.userData.part] ||= []).push(m); }
    for (const k in W.anchors) delete W.anchors[k];
    for (const id in byPart) {
      box.makeEmpty();
      byPart[id].forEach(m => { if (m.isInstancedMesh) return; box.expandByObject(m); });
      if (box.isEmpty()) continue;
      box.getCenter(c); W.anchors[id] = c.clone(); W.partBoxes[id] = box.clone();
    }
    W.allBox.makeEmpty(); W.engBox.makeEmpty(); W.brkBox.makeEmpty();
    W.root.traverse(o => {
      if (!o.isMesh || o.isInstancedMesh || o.userData.noBox || !o.material || o.material.userData?.wire) return;
      W.allBox.expandByObject(o);
      if (o.userData.eng) W.engBox.expandByObject(o);
      if (o.userData.brk && o.visible) W.brkBox.expandByObject(o);
    });
    W.partBoxes.carroceria = W.allBox.clone(); W.anchors.carroceria = V(-0.9, 1.8 + state.exVan * 1.25, 0.7);
  }
  const SUMMARY = {
    van: ['bloque', 'caja', 'diferencial', 'radiador', 'estanque', 'catalizador', 'bateria', 'bomba_freno', 'susp_del', 'susp_tras', 'direccion', 'calefactor'],
    solid: ['carroceria', 'luces', 'parrilla', 'ruedas'],
    eng: ['culata', 'tapa_valvulas', 'bloque', 'distribucion', 'carburador', 'mult_esc', 'alternador', 'distribuidor', 'volante', 'carter', 'ventilador', 'filtro_aceite', 'mult_adm'],
    brk: ['pedal_freno', 'servofreno', 'bomba_freno', 'deposito_freno', 'frenos_del', 'frenos_tras', 'canerias', 'valvula_dsp', 'freno_mano'],
  };
  function ensureLabel(id) {
    if (labelEls[id]) return labelEls[id];
    const P = PARTS[id];
    const el = document.createElement('button'); el.type = 'button'; el.className = 'tag' + (P.sensor ? ' sensor' : '');
    el.style.setProperty('--c', SYS[P.sys].color);
    const nm = (P.short || P.name).replace(/\s*\(.*?\)\s*/g, ' ').trim();
    el.innerHTML = P.sensor ? `<b>${P.sensor.n}</b>${nm}` : `<i></i>${nm}`;
    el.addEventListener('click', e => { e.stopPropagation(); select(id); });
    labelLayer.appendChild(el); labelEls[id] = el; return el;
  }
  const tmpV = new THREE.Vector3();
  const visibleIn = id => (state.mode === 'eng' ? isEngPart(id) : state.mode === 'brk' ? isBrkPart(id) : !PARTS[id].deep || state.focus === 'motor' || state.sel === id);
  function updateLabels() {
    let ids = [];
    if (state.labels) {
      if (state.sel) ids = [state.sel];
      if (state.focus) ids = Object.keys(PARTS).filter(id => matchFocus(PARTS[id], state.focus) && W.anchors[id] && visibleIn(id));
      else if (!state.sel) ids = SUMMARY[state.mode === 'van' && state.body === 'solid' ? 'solid' : state.mode];
    }
    const Wd = renderer.domElement.clientWidth, H = renderer.domElement.clientHeight;
    const placed = [], shown = new Set();
    const items = ids.filter(id => W.anchors[id]).map(id => { tmpV.copy(W.anchors[id]).project(camera); return { id, x: (tmpV.x + 1) / 2 * Wd, y: (1 - tmpV.y) / 2 * H, z: tmpV.z }; })
      .filter(o => o.z < 1 && o.x > 4 && o.x < Wd - 4 && o.y > 4 && o.y < H - 4)
      .sort((a, b) => (a.id === state.sel ? -1 : b.id === state.sel ? 1 : (PARTS[a.id].sensor ? -1 : 0) - (PARTS[b.id].sensor ? -1 : 0) || a.y - b.y));
    for (const o of items) {
      const el = ensureLabel(o.id);
      const w = el.offsetWidth || 90, h = 22;
      const x = Math.min(Math.max(o.x - w / 2, 4), Wd - w - 4), y = o.y - h - 6;
      if (placed.some(p => x < p.x + p.w + 3 && x + w + 3 > p.x && y < p.y + p.h + 2 && y + h + 2 > p.y)) { if (o.id !== state.sel) continue; }
      placed.push({ x, y, w, h });
      el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
      el.classList.toggle('on', o.id === state.sel);
      el.hidden = false; shown.add(o.id);
    }
    for (const id in labelEls) if (!shown.has(id)) labelEls[id].hidden = true;
  }

  // ——— selección por toque ———
  const ray = new THREE.Raycaster(); const ptr = new THREE.Vector2();
  let down = null;
  renderer.domElement.addEventListener('pointerdown', e => { down = { x: e.clientX, y: e.clientY, t: performance.now() }; });
  renderer.domElement.addEventListener('pointerup', e => {
    if (!down) return; const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y); const dt = performance.now() - down.t; down = null;
    if (moved > 7 || dt > 600) return;
    const r = renderer.domElement.getBoundingClientRect();
    ptr.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ptr, camera);
    const bodyPick = state.body === 'solid' || state.focus === 'carroceria';
    const cand = W.meshes.filter(m => m.visible && m.userData.pick && m.material.opacity > 0.1 && (!m.userData.body || bodyPick));
    const hits = ray.intersectObjects(cand, false);
    const hit = hits.find(h => { const cp = h.object.material && h.object.material.clippingPlanes; return !cp || !cp.length || cp.every(pl => pl.distanceToPoint(h.point) >= 0); });
    if (hit) select(hit.object.userData.part); else select(null);
  });

  function select(id, { fly = true } = {}) {
    state.sel = id && W.anchors[id] ? id : null;
    applyMaterials();
    if (state.sel && fly && W.partBoxes[state.sel]) {
      const b = W.partBoxes[state.sel].clone(); const sz = b.getSize(new THREE.Vector3()); const m = state.mode === 'eng' || isEngPart(state.sel) ? 0.16 : state.mode === 'brk' ? 0.24 : 0.5;
      b.expandByVector(V(Math.max(0, (m - sz.x) / 2), Math.max(0, (m - sz.y) / 2), Math.max(0, (m - sz.z) / 2)));
      // piezas del motor que sólo se ven desde un lado: su dirección (marco del motor) girada a como va montado
      const lk = PARTS[state.sel] && PARTS[state.sel].look && isEngPart(state.sel);
      const dir = lk ? V(...PARTS[state.sel].look).applyAxisAngle(V(1, 0, 0), TILT).normalize() : viewDir();
      fitTo(b, dir, state.sel === 'carroceria' ? 1.04 : 1.45);
    }
    onSelect && onSelect(state.sel);
  }

  // ——— cámara ———
  const VIEWS = {
    van: { iso: [2.7, 2.0, -3.6], lado: [0, 0.1, -1], frente: [1, 0.12, 0.002], atras: [-1, 0.15, -0.35], arriba: [0, 1, 0.002], abajo: [0, -1, 0.002] },
    eng: { iso: [0.55, 0.85, -0.85], escape: [0.15, -0.7, -0.7], admision: [0.15, 0.75, 0.66], frente: [1, 0.12, 0.002], arriba: [0.002, 1, -0.05], abajo: [0.05, -1, 0.002] },
    brk: { iso: [1.6, 1.25, -2.2], lado: [0, 0.12, -1], ruedadel: { d: [-0.55, 0.6, -0.62], g: 'fl' }, ruedatras: { d: [-0.25, 0.42, -1], g: 'rl' }, pedal: { d: [-0.8, 0.55, -0.6], g: 'pedal' }, arriba: [0.002, 1, -0.04], abajo: [0.05, -1, 0.002] },
  };
  let tween = null;
  const viewDir = () => camera.position.clone().sub(controls.target).normalize();
  function fitTo(box, dir, pad = 1.08, ms = 700) {
    const c = box.getCenter(new THREE.Vector3());
    const fw = dir.clone().negate();
    const r = new THREE.Vector3().crossVectors(fw, camera.up); if (r.lengthSq() < 1e-8) r.set(0, 0, -1); r.normalize();
    const u = new THREE.Vector3().crossVectors(r, fw).normalize();
    const tV = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)), tH = tV * camera.aspect;
    let d = 0; const q = new THREE.Vector3();
    for (let i = 0; i < 8; i++) {
      q.set(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z).sub(c);
      d = Math.max(d, q.dot(dir) + Math.abs(q.dot(r)) / tH, q.dot(dir) + Math.abs(q.dot(u)) / tV);
    }
    d = Math.max(d * pad, controls.minDistance * 1.3);
    animateCam(c.clone().addScaledVector(dir, d), c, reduced ? 0 : ms);
  }
  function setView(name, instant) {
    const v = VIEWS[state.mode][name] || VIEWS[state.mode].iso;
    computeAnchors();
    const dir = Array.isArray(v) ? v : v.d;
    if (!Array.isArray(v) && v.g) { const b = new THREE.Box3(); [].concat(BR.groups[v.g]).forEach(g => b.expandByObject(g)); fitTo(b, V(...dir).normalize(), 1.25, instant ? 0 : 700); return; }
    const box = state.mode === 'eng' ? W.engBox : state.mode === 'brk' ? W.brkBox : W.allBox;
    fitTo(box, V(...dir).normalize(), state.mode === 'eng' ? 0.94 : state.mode === 'brk' ? 0.98 : 1.04, instant ? 0 : 700);
  }
  function animateCam(p, t, ms) {
    if (!ms) { tween = null; camera.position.copy(p); controls.target.copy(t); controls.update(); requestRender(); return; }
    tween = { p0: camera.position.clone(), t0: controls.target.clone(), p, t, start: performance.now(), ms };
    requestRender();
  }

  // ——— cortes del motor (en su lugar, marco del motor) ———
  const LOCAL = { long: new THREE.Plane(V(0, 0, 1), 0), trans: new THREE.Plane(V(-1, 0, 0), -0.134) };
  function updateCutPlanes() {
    VAN.eng.updateMatrixWorld(true);
    const off = p => p.set(V(0, 1, 0), 1e4);
    const cut = state.mode === 'eng' ? state.cut : 'none';
    if (cut === 'long') { clip.casing.copy(LOCAL.long).applyMatrix4(VAN.eng.matrixWorld); off(clip.all); }
    else if (cut === 'trans') { clip.casing.copy(LOCAL.trans).applyMatrix4(VAN.eng.matrixWorld); clip.all.copy(clip.casing); }
    else { off(clip.casing); off(clip.all); }
  }

  // ——— animación ———
  function applyExplodeAll() { for (const o of W.explodables) o.position.copy(o.userData.base).addScaledVector(o.userData.ex, o.userData.lvl === 'eng' ? state.exEng : state.exVan); }
  function applyExplode() { applyExplodeAll(); W.anim.update(state.theta); computeAnchors(); applyMaterials(); requestRender(); }

  let needs = true, visible = true, raf = 0, last = performance.now();
  function requestRender() { needs = true; if (!raf) raf = requestAnimationFrame(loop); }
  function loop(now) {
    raf = 0;
    const prevNow = last;
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    let active = false;
    if (tween) {
      const k = Math.min(1, (now - tween.start) / tween.ms); const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      camera.position.lerpVectors(tween.p0, tween.p, e); controls.target.lerpVectors(tween.t0, tween.t, e);
      if (k >= 1) tween = null; active = true;
    }
    if (state.running && visible) {
      const rps = state.mode === 'eng' ? state.speed : 0.9;
      state.theta += dt * Math.PI * 2 * rps; W.anim.update(state.theta); active = true;
      onTick && onTick(state.theta, state.mode);
    }
    if (state.mode === 'brk' && visible) {
      if (BR.tick(Math.min(0.12, (now - prevNow) / 1000), (aF, aR) => VAN.setWheels(aF, aR))) active = true;   // en equipos lentos la frenada no se alarga tanto
      BR.paint('brk', state.colorMode);
      onBrake && onBrake(BR.result);
    }
    inLoop = true; if (controls.update() && camMoved()) active = true; inLoop = false;
    if (needs || active) { renderer.render(scene, camera); updateLabels(); needs = false; }
    if ((active || tween || (state.running && visible)) && !raf) raf = requestAnimationFrame(loop);   // un solo ciclo a la vez
  }
  // OrbitControls avisa "change" aunque la cámara no se mueva (el objetivo cambia en el último decimal al
  // recortar su largo): sólo cuenta como movimiento si cambian la posición o la orientación de la cámara
  let inLoop = false;
  const lastCam = { p: new THREE.Vector3(), q: new THREE.Quaternion() };
  function camMoved() {
    const m = lastCam.p.distanceToSquared(camera.position) > 1e-12 || 1 - Math.abs(lastCam.q.dot(camera.quaternion)) > 1e-12;
    lastCam.p.copy(camera.position); lastCam.q.copy(camera.quaternion); return m;
  }
  controls.addEventListener('change', () => { if (!inLoop) requestRender(); });
  new IntersectionObserver(es => { visible = es[0].isIntersecting; if (visible) requestRender(); }).observe(host);

  function resize() {
    const w = host.clientWidth, h = host.clientHeight; if (!w || !h) return;
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
    renderer.domElement.style.width = w + 'px'; renderer.domElement.style.height = h + 'px';
    requestRender();
  }
  let touched = false;
  controls.addEventListener('start', () => { touched = true; });
  new ResizeObserver(() => { resize(); if (!touched && !state.focus && !state.sel) setView('iso', true); }).observe(host);
  resize();
  W.anim.update(0); computeAnchors(); updateCutPlanes();
  applyMaterials(); setView('iso', true);

  function setMode(m) {
    if (m === state.mode) return;
    const prev = state.mode;
    state.mode = m;
    const E = m === 'eng', B = m === 'brk';
    controls.minDistance = E ? 0.22 : B ? 0.25 : 0.6; controls.maxDistance = E ? 5 : B ? 8 : 12;
    state.sel = null; state.exVan = 0; state.exEng = 0; applyExplodeAll();
    if (!E) state.cut = 'none';
    if (prev === 'brk') { BR.stopSeq(); BR.set({ on: false, pedalF: 0, v: 0, heat: 0 }); BR.setCuts(false); }
    if (B) { state.running = false; BR.setCuts(state.bcut); }
    if (state.focus && !Object.keys(PARTS).some(id => matchFocus(PARTS[id], state.focus) && W.anchors[id] && inMode(id))) state.focus = null;
    for (const id in labelEls) labelEls[id].hidden = true;
    W.anim.update(state.theta); updateCutPlanes(); computeAnchors();
    if (VAN.ground) VAN.ground.visible = !E;
    applyMaterials(); touched = false; setView('iso', false);
    onSelect && onSelect(null);
  }

  return {
    select,
    setFocus(sys, { fly = true } = {}) {
      state.focus = sys; if (state.sel && sys && !matchFocus(PARTS[state.sel], sys)) state.sel = null; applyMaterials();
      if (!fly) return;
      const E = state.mode === 'eng';
      if (sys) { const b = new THREE.Box3(); Object.keys(PARTS).forEach(id => { if (matchFocus(PARTS[id], sys) && W.partBoxes[id] && inMode(id)) b.union(W.partBoxes[id]); }); if (!b.isEmpty()) fitTo(b, viewDir(), sys === 'carroceria' ? 1.04 : 1.18); }
      else fitTo(E ? W.engBox : state.mode === 'brk' ? W.brkBox : W.allBox, viewDir(), 1.04);
    },
    setColorMode(m) { state.colorMode = m; applyMaterials(); },
    setBody(m) { state.body = m; applyMaterials(); },
    setRack(on) { state.rack = on; applyMaterials(); },
    setExplode(t) { state.explode = t; applyExplode(); },
    setLabels(on) { state.labels = on; requestRender(); },
    setRunning(on) { state.running = on; last = performance.now(); requestRender(); },
    isRunning: () => state.running,
    setView,
    setMode, getMode: () => state.mode,
    has: id => !!W.anchors[id] && inMode(id),
    isEng: isEngPart, isBrk: isBrkPart,
    // frenos
    brake(o) { const r = BR.set(o || {}); last = performance.now(); requestRender(); return r; },
    brakeTest() { BR.startStop(); last = performance.now(); requestRender(); },
    brakeAbort() { BR.stopSeq(); requestRender(); },
    get brakeState() { return BR.state; },
    setBCut(on) { state.bcut = on; BR.setCuts(on && state.mode === 'brk'); applyMaterials(); },
    setCut(c) { state.cut = c; updateCutPlanes(); applyMaterials(); },
    setSpeed(k) { state.speed = k; },
    stepTo(deg) { state.theta = deg * Math.PI / 180; W.anim.update(state.theta); onTick && onTick(state.theta, state.mode); requestRender(); },
    get state() { return state; },
    debugCam(v) { animateCam(new THREE.Vector3(v[0], v[1], v[2]), new THREE.Vector3(v[3], v[4], v[5]), 0); },
    debugLoop() { return { d: +camera.position.distanceTo(controls.target).toFixed(4), p: camera.position.toArray().map(v => +v.toFixed(4)), tween: !!tween, raf: !!raf, running: state.running, brk: BR.state.seq, pedalF: BR.state.pedalF, heat: BR.state.heat, v: BR.state.v }; },
    debugBox(id) { const b = W.partBoxes[id]; return b ? [b.min.toArray(), b.max.toArray()] : null; },
    debugStats() { renderer.render(scene, camera); return { meshes: W.meshes.length, calls: renderer.info.render.calls, tris: renderer.info.render.triangles }; },
    // vista en perspectiva con la cámara estimada de una foto (pos, target, fov vertical en grados)
    debugPersp({ pos, target, fov = 44, w = 1659, h = 2212, bg = '#000000' }) {
      const cam = new THREE.PerspectiveCamera(fov, w / h, 0.05, 60); cam.position.set(...pos); cam.lookAt(...target);
      const old = renderer.getSize(new THREE.Vector2()), oldPR = renderer.getPixelRatio(), oldBg = scene.background;
      renderer.setPixelRatio(1); renderer.setSize(w, h, false); scene.background = new THREE.Color(bg);
      const g = VAN.ground; const gv = g ? g.visible : null; if (g) g.visible = false;
      renderer.render(scene, cam);
      const url = renderer.domElement.toDataURL('image/png');
      if (g) g.visible = gv; scene.background = oldBg; renderer.setPixelRatio(oldPR); renderer.setSize(old.x, old.y, false); needs = true;
      return url;
    },
    // vista ortográfica para comparar con fotos de plano: dir 'left' | 'front' | 'rear'; ppm = píxeles por metro
    debugOrtho({ dir = 'left', ppm = 504, w = 1659, h = 2212, cx = 0, cy = 1.24, bg = '#000000' } = {}) {
      const cam = new THREE.OrthographicCamera(-w / 2 / ppm, w / 2 / ppm, h / 2 / ppm, -h / 2 / ppm, 0.1, 50);
      if (dir === 'left') { cam.position.set(cx, cy, -20); cam.lookAt(cx, cy, 0); }
      else if (dir === 'front') { cam.position.set(20, cy, cx); cam.lookAt(0, cy, cx); }
      else { cam.position.set(-20, cy, cx); cam.lookAt(0, cy, cx); }
      const old = renderer.getSize(new THREE.Vector2()), oldPR = renderer.getPixelRatio(), oldBg = scene.background;
      renderer.setPixelRatio(1); renderer.setSize(w, h, false); scene.background = new THREE.Color(bg);
      const g = VAN.ground; const gv = g ? g.visible : null; if (g) g.visible = false;
      renderer.render(scene, cam);
      const url = renderer.domElement.toDataURL('image/png');
      if (g) g.visible = gv; scene.background = oldBg; renderer.setPixelRatio(oldPR); renderer.setSize(old.x, old.y, false); needs = true;
      return url;
    },
  };
}
