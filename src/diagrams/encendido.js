import { s, svg, t, callout, clamp, rad, pol, h, range, seg, readout } from '../svgkit.js';
import { advanceAt, altMaxAt, EK } from '../elecsim.js';
import { ALT_K } from '../motor.js';

const ORDER = [1, 3, 4, 2];
const nf = (n, d = 0) => n.toLocaleString('es-CL', { minimumFractionDigits: d, maximumFractionDigits: d });
// link: la llave, la batería y el motor del modelo 3D (vista Eléctrico); sin él, el esquema tiene su propia simulación
export function encendido(root, link) {
  const st = { mode: 'run', rpm: 900, load: 0.4, rotor: 0, sparkT: [0, 0, 0, 0] };

  // ═══ Circuito de encendido ═══
  const f = svg(400, 348, 'Circuito de encendido electrónico: chapa, bobina, módulo, distribuidor y bujías');
  // chapa de contacto
  s('circle', { cx: 44, cy: 44, r: 22, class: 'node' }, f);
  const key = s('path', { class: 'keyptr' }, f);
  const keyPos = { off: -160, lock: -160, acc: -118, on: -75, start: -30, run: -75 };
  [['LOCK', -160], ['ACC', -118], ['ON', -75], ['ST', -30]].forEach(([n, a]) => { const [x, y] = pol(44, 44, 32, rad(a)); t(f, x, y + 3, n, 'lbl lbl-xs', 'middle'); });
  t(f, 44, 82, 'Chapa', 'lbl lbl-xs', 'middle');
  // batería
  s('rect', { x: 10, y: 112, width: 64, height: 40, rx: 4, class: 'node bat' }, f);
  t(f, 42, 130, 'Batería', 'lbl lbl-s strong', 'middle'); t(f, 42, 144, '12 V, 24/38 Ah', 'lbl lbl-xs', 'middle');
  s('rect', { x: 14, y: 106, width: 10, height: 6, class: 'term pos' }, f); s('rect', { x: 58, y: 106, width: 10, height: 6, class: 'term neg' }, f);
  s('path', { d: 'M63,152 L63,166 M55,166 L71,166 M58,170 L68,170 M61,174 L65,174', class: 'wire gnd' }, f);
  // bobina
  s('rect', { x: 128, y: 18, width: 44, height: 52, rx: 6, class: 'node coil' }, f);
  for (let i = 0; i < 4; i++) s('path', { d: `M136,${28 + i * 10} q6,-5 12,0 q6,5 12,0`, class: 'coilw' }, f);
  s('rect', { x: 144, y: 70, width: 12, height: 10, rx: 2, class: 'term' }, f);
  t(f, 182, 30, 'Bobina', 'lbl lbl-s strong');
  // módulo + generador de señal (dentro del distribuidor)
  s('rect', { x: 250, y: 16, width: 140, height: 54, rx: 6, class: 'node body' }, f);
  const relG = s('g', {}, f);
  s('path', { d: (() => { let d = ''; for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2; const [x0, y0] = pol(272, 43, 8, a - 0.38); const [x1, y1] = pol(272, 43, 15, a - 0.13); const [x2, y2] = pol(272, 43, 15, a + 0.13); const [x3, y3] = pol(272, 43, 8, a + 0.38); d += `${i ? 'L' : 'M'}${x0},${y0} L${x1},${y1} L${x2},${y2} L${x3},${y3}`; } return d + 'Z'; })(), class: 'reluctor' }, relG);
  s('rect', { x: 290, y: 37, width: 7, height: 12, rx: 2, class: 'pickup' }, f);
  t(f, 344, 34, 'Módulo y', 'lbl lbl-xs strong', 'middle'); t(f, 344, 46, 'generador de señal', 'lbl lbl-xs', 'middle'); t(f, 344, 60, '(en el distribuidor)', 'lbl lbl-xs muted', 'middle');
  s('path', { d: 'M390,62 L396,62 L396,80 M390,80 L402,80', class: 'wire gnd' }, f);
  // tapa del distribuidor y rotor
  const D = { x: 200, y: 162, r: 52 };
  s('circle', { cx: D.x, cy: D.y, r: D.r, class: 'cap' }, f);
  s('circle', { cx: D.x, cy: D.y, r: 7, class: 'term' }, f);
  const TA = { 1: 225, 3: 315, 4: 45, 2: 135 }; // bornes vistos desde la tapa: el rotor gira en sentido horario (manual) y los recorre 1-3-4-2
  const TP = {};
  for (const c of ORDER) { const [x, y] = pol(D.x, D.y, D.r - 7, rad(TA[c])); TP[c] = pol(D.x, D.y, D.r + 2, rad(TA[c])); s('circle', { cx: x, cy: y, r: 6, class: 'term' }, f); const [lx, ly] = pol(D.x, D.y, D.r - 21, rad(TA[c])); t(f, lx, ly + 4, String(c), 'lbl lbl-xs strong', 'middle'); }
  const rotor = s('path', { d: `M${D.x - 6},${D.y + 6} L${D.x - 4},${D.y - D.r + 15} L${D.x + 4},${D.y - D.r + 15} L${D.x + 6},${D.y + 6} Z`, class: 'rotor' }, f);
  callout(f, 226, 113, 262, 86, 'Distribuidor\n(gira en sentido horario)', 'start', 'lbl lbl-xs');
  // motor y bujías (cilindro 1 al lado de la polea, a la izquierda)
  const PX = { 1: 70, 2: 150, 3: 250, 4: 330 };
  s('rect', { x: 34, y: 300, width: 334, height: 40, rx: 6, class: 'metal-alu' }, f);
  const plugs = {};
  for (const c of [1, 2, 3, 4]) {
    s('rect', { x: PX[c] - 5, y: 284, width: 10, height: 18, rx: 2, class: 'plugbody' }, f);
    plugs[c] = s('circle', { cx: PX[c], cy: 312, r: 7, class: 'sparkdot' }, f);
    t(f, PX[c], 332, 'Cil. ' + c, 'lbl lbl-xs on-fill', 'middle');
  }
  // cables de alta tensión
  const wires = {
    1: `M${TP[1][0]},${TP[1][1]} C116,104 70,190 ${PX[1]},284`,
    2: `M${TP[2][0]},${TP[2][1]} C138,228 ${PX[2]},246 ${PX[2]},284`,
    4: `M${TP[4][0]},${TP[4][1]} C268,232 ${PX[4]},236 ${PX[4]},284`,
    3: `M${TP[3][0]},${TP[3][1]} C284,104 318,152 304,200 C294,236 ${PX[3]},244 ${PX[3]},284`,
  };
  const htw = {};
  for (const c of ORDER) { s('path', { d: wires[c], class: 'ht' }, f); htw[c] = s('path', { d: wires[c], class: 'flow spark-flow', 'stroke-dasharray': '6 300' }, f); }
  const lead = `M150,80 L150,104 Q150,120 166,128 L190,152`;
  s('path', { d: lead, class: 'ht' }, f);
  const htc = s('path', { d: lead, class: 'flow spark-flow', 'stroke-dasharray': '6 200' }, f);
  // circuito primario
  const prim1 = 'M19,106 L19,44 L22,44';
  const prim2 = 'M66,44 L128,44';
  const prim3 = 'M172,56 L250,56';
  [prim1, prim2, prim3].forEach(d => s('path', { d, class: 'wire' }, f));
  const pf = [prim1, prim2, prim3].map(d => s('path', { d, class: 'flow elec', 'stroke-dasharray': '4 6' }, f));
  t(f, 97, 38, '12 V', 'lbl lbl-xs', 'middle');
  t(f, 211, 50, 'primario', 'lbl lbl-xs', 'middle');

  // ═══ Avance ═══
  const fa = svg(400, 118, 'Avance del encendido');
  t(fa, 14, 18, 'Punto base: 8° antes del PMS a 900 rpm o menos (manual)', 'lbl lbl-xs strong');
  const advTxt = t(fa, 386, 18, '', 'lbl lbl-xs', 'end');
  const AX0 = 120, AX1 = 386;
  s('line', { x1: AX0, y1: 92, x2: AX1, y2: 92, class: 'tick' }, fa);
  t(fa, AX0, 108, 'PMS', 'lbl lbl-xs', 'middle'); t(fa, AX1, 108, 'más avance (antes del PMS) →', 'lbl lbl-xs', 'end');
  t(fa, 14, 44, 'Base', 'lbl lbl-xs'); t(fa, 14, 62, 'Centrífugo (rpm)', 'lbl lbl-xs'); t(fa, 14, 80, 'Vacío (carga parcial)', 'lbl lbl-xs');
  s('rect', { x: AX0, y: 35, width: 34, height: 12, rx: 3, class: 'adv base' }, fa);
  const bCent = s('rect', { x: AX0 + 34, y: 53, height: 12, rx: 3, class: 'adv cent' }, fa);
  const bVac = s('rect', { x: AX0 + 34, y: 71, height: 12, rx: 3, class: 'adv vac' }, fa);

  // ═══ Carga y partida ═══
  const fc = svg(400, 178, 'Carga de batería y motor de partida');
  s('rect', { x: 14, y: 66, width: 64, height: 40, rx: 4, class: 'node bat' }, fc); t(fc, 46, 84, 'Batería', 'lbl lbl-s strong', 'middle'); const vtxt = t(fc, 46, 98, '12,6 V', 'lbl lbl-xs', 'middle');
  s('circle', { cx: 200, cy: 48, r: 27, class: 'node alt' }, fc); t(fc, 200, 46, 'Alternador', 'lbl lbl-xs strong', 'middle'); t(fc, 200, 59, '40 A', 'lbl lbl-xs', 'middle');
  const altRot = s('path', { d: 'M200,24 L200,30 M178,48 L172,48 M222,48 L228,48 M200,70 L200,76', class: 'spoke' }, fc);
  s('rect', { x: 150, y: 116, width: 102, height: 36, rx: 8, class: 'node starter' }, fc); t(fc, 201, 132, 'Motor de partida', 'lbl lbl-xs strong', 'middle'); t(fc, 201, 145, '0,6–0,8 kW', 'lbl lbl-xs', 'middle');
  const [ax0, ay0] = pol(366, 130, 88, rad(150)), [ax1, ay1] = pol(366, 130, 88, rad(210));
  s('path', { d: `M${ax0},${ay0} A88,88 0 0 1 ${ax1},${ay1}`, class: 'ringgear' }, fc);
  t(fc, 392, 172, 'Corona del volante', 'lbl lbl-xs', 'end');
  const pinion = s('circle', { cy: 134, r: 9, class: 'pinion' }, fc);
  s('circle', { cx: 318, cy: 22, r: 11, class: 'lamp' }, fc);
  const lamp = s('circle', { cx: 318, cy: 22, r: 7, class: 'lampon' }, fc);
  t(fc, 318, 48, 'Luz de carga', 'lbl lbl-xs', 'middle');
  const wB = 'M70,66 L70,48 L173,48';
  const wS = 'M78,98 L118,98 L118,134 L150,134';
  const wL = 'M227,42 L307,24';
  [wB, wS, wL].forEach(d => s('path', { d, class: 'wire' }, fc));
  const fB = s('path', { d: 'M173,48 L70,48 L70,66', class: 'flow elec', 'stroke-dasharray': '4 6' }, fc);
  const fS = s('path', { d: wS, class: 'flow elec heavy', 'stroke-dasharray': '6 5' }, fc);
  t(fc, 122, 42, 'B+ (carga)', 'lbl lbl-xs', 'middle'); t(fc, 16, 124, 'cable grueso', 'lbl lbl-xs');

  // ═══ Controles ═══
  const rd = readout();
  let modeCtl, rpmCtl, loadCtl;
  if (link) {
    // la llave del furgón: START da la partida y vuelve sola a ON; el acelerador es el mismo de las vistas
    modeCtl = seg({ label: 'Llave', options: [{ v: 'lock', t: 'LOCK' }, { v: 'acc', t: 'ACC' }, { v: 'on', t: 'ON' }, { v: 'start', t: 'START' }], value: 'lock', onchange: v => link.set(v === 'start' ? { crank: true } : { key: v }) });
    rpmCtl = range({ label: 'Acelerador', min: 0, max: 100, step: 5, value: 0, fmt: v => Math.round(v) + ' %', oninput: v => link.set({ pedal: v / 100 }) });
  } else {
    rpmCtl = range({ label: 'Régimen', min: 900, max: 5500, step: 50, value: 900, fmt: v => Math.round(v).toLocaleString('es-CL') + ' rpm', oninput: v => st.rpm = v });
    modeCtl = seg({ label: 'Estado', options: [{ v: 'off', t: 'Apagado' }, { v: 'on', t: 'Contacto' }, { v: 'start', t: 'Partida' }, { v: 'run', t: 'En marcha' }], value: 'run', onchange: v => { st.mode = v; } });
    loadCtl = seg({ label: 'Carga', options: [{ v: '0.1', t: 'Ralentí' }, { v: '0.4', t: 'Parcial' }, { v: '1', t: 'A fondo' }], value: '0.4', onchange: v => st.load = +v });
  }
  root.append(
    h('figure', { class: 'fig' }, f, h('figcaption', {}, 'Versión catalítica chilena: distribuidor 33100-85710 con módulo de encendido 33370-85710, sin platinos (el manual de servicio es de la versión con platinos 0,4–0,5 mm). Un engranaje en la punta del árbol de levas lo hace girar a la mitad del cigüeñal, en sentido horario visto desde la tapa, y el rotor reparte 4 chispas cada dos vueltas en orden 1-3-4-2. Punto: 8° APMS a 900 rpm.')),
    rd,
    h('div', { class: 'controls' }, ...[modeCtl, rpmCtl, loadCtl].filter(Boolean)),
    h('figure', { class: 'fig slim' }, fa, h('figcaption', {}, 'Los contrapesos centrífugos adelantan la chispa al subir las rpm y la cápsula de vacío la adelanta a carga parcial, sólo con la mariposa abierta (manual). Las cifras del centrífugo y del vacío son estimadas: la curva exacta no está en las fuentes revisadas.')),
    h('figure', { class: 'fig' }, fc, h('figcaption', {}, 'Con el motor en marcha el alternador carga a 14,4–15,0 V (manual, a 25 °C) y se apaga la luz de carga. En partida, el piñón del motor de partida engrana con la corona del volante y la batería entrega más de cien amperes.')),
  );
  if (link) root.append(h('p', { class: 'muted' }, 'El esquema muestra la misma llave, batería y motor del modelo 3D: lo que se cambia aquí cambia allá.'));

  // el estado a dibujar: del modelo 3D (link) o de los mandos propios
  function state() {
    const L = link && link.read(), r = L && L.r;
    if (r) {
      const cranking = !!r.crank, running = r.run;
      return { m: cranking ? 'start' : running ? 'run' : r.key === 'on' ? 'on' : r.key === 'acc' ? 'acc' : 'off', key: r.key, cranking, running, on: r.on,
        rpm: cranking ? r.crank.n : running ? r.rpm : 0, spark: running || (cranking && r.crank.spark), V: r.V, adv: r.adv, charge: !!r.lamps.charge,
        iAlt: r.iAlt, iCrank: cranking ? r.crank.I : 0, miss: r.misfire ? 3 : 0, pedal: L.pedal, r };
    }
    const m = st.mode, cranking = m === 'start', running = m === 'run', rpm = cranking ? 220 : running ? st.rpm : 0;
    const pedal = running ? (st.load < 0.2 ? 0 : st.load < 0.6 ? 0.25 : 1) : 0, vac = running ? 4 + 44 * Math.pow(1 - pedal, 1.6) : 0;
    const iMax = running ? altMaxAt(rpm * ALT_K) : 0;
    return { m, key: m === 'off' ? 'lock' : m === 'start' ? 'start' : 'on', cranking, running, on: m !== 'off', rpm, spark: running || cranking,
      V: running ? (iMax > 5 ? EK.vReg : 12.9) : cranking ? 10.4 : 12.6, adv: advanceAt(running ? rpm : 0, vac, pedal), charge: m === 'on' || cranking || (running && iMax < 0.5),
      iAlt: running ? Math.min(iMax, 12) : 0, iCrank: cranking ? 170 : 0, miss: 0, pedal };
  }
  let ctlKey = '';
  function frame(dt) {
    const S = state();
    const m = S.m, on = S.on, cranking = S.cranking, running = S.running, rpm = S.rpm;
    if (link) { const k = S.key + '|' + Math.round(S.pedal * 20); if (k !== ctlKey) { ctlKey = k; modeCtl.set(S.key === 'start' ? 'start' : S.key); if (document.activeElement !== rpmCtl.input) rpmCtl.set(Math.round(S.pedal * 100)); } }
    const visual = rpm ? 0.25 + rpm / 900 * 0.4 : 0; // cámara lenta
    st.rotor = (st.rotor + visual * dt * 180) % 360;
    const rot = st.rotor; // horario visto desde la tapa
    rotor.setAttribute('transform', `rotate(${rot.toFixed(1)} ${D.x} ${D.y})`);
    relG.setAttribute('transform', `rotate(${rot.toFixed(1)} 272 43)`);
    const a = ((-90 + rot) % 360 + 360) % 360;
    let near = null;
    for (const c of ORDER) { const d = Math.abs(((a - ((TA[c] + 360) % 360)) + 540) % 360 - 180); if (d < 9) near = c; }
    const sparking = S.spark && near != null;
    for (const c of ORDER) {
      if (sparking && near === c && c !== S.miss) st.sparkT[c - 1] = 0.2;
      st.sparkT[c - 1] = Math.max(0, st.sparkT[c - 1] - dt);
      const v = st.sparkT[c - 1] / 0.2;
      plugs[c].style.opacity = v;
      htw[c].style.opacity = v > 0 ? 1 : 0;
      htw[c].setAttribute('stroke-dashoffset', (-(1 - v) * 320).toFixed(1));
    }
    const mx = Math.max(...st.sparkT);
    htc.style.opacity = mx > 0 ? 1 : 0; htc.setAttribute('stroke-dashoffset', (-(1 - mx / 0.2) * 120).toFixed(1));
    pf.forEach(p => { p.style.opacity = on ? 1 : 0.1; if (on) { p._o = ((p._o || 0) - 30 * dt) % 100; p.setAttribute('stroke-dashoffset', p._o); } });
    { const [x, y] = pol(44, 44, 17, rad(keyPos[S.key] ?? keyPos[m])); key.setAttribute('d', `M44,44 L${x},${y}`); }
    // avance en grados: 34 px = los 8° de base
    const PX = 34 / 8, A = S.adv;
    bCent.setAttribute('width', (A.cent * PX + 0.01).toFixed(1));
    bVac.setAttribute('width', (A.vac * PX + 0.01).toFixed(1)); bVac.setAttribute('x', (AX0 + 34 + A.cent * PX).toFixed(1));
    advTxt.textContent = running ? `${nf(A.total, 1)}° en total` : '';
    lamp.style.opacity = S.charge && on ? 1 : 0;
    fB.style.opacity = running && S.iAlt > 0.5 ? 1 : 0; fS.style.opacity = cranking ? 1 : 0;
    if (running) { fB._o = ((fB._o || 0) - 30 * dt) % 100; fB.setAttribute('stroke-dashoffset', fB._o); }
    if (cranking) { fS._o = ((fS._o || 0) - 60 * dt) % 100; fS.setAttribute('stroke-dashoffset', fS._o); }
    altRot.setAttribute('transform', `rotate(${(st.rotor * 4.4 * (running ? 1 : 0)).toFixed(1)} 200 48)`);
    pinion.setAttribute('cx', cranking ? 269 : 260);
    pinion.setAttribute('class', 'pinion' + (cranking ? ' engaged' : ''));
    vtxt.textContent = (link ? '' : '≈ ') + nf(S.V, 1) + ' V';
    const miss = S.miss ? ' El cable de la bujía del cilindro 3 está cortado: ese cilindro no explota.' : '';
    rd.innerHTML = m === 'off' ? '<b>LOCK.</b> Sin corriente en el primario: no hay chispa ni funciona la bomba de bencina.' :
      m === 'acc' ? '<b>ACC.</b> Tienen corriente la radio y el encendedor; el primario sigue cortado.' :
      m === 'on' ? `<b>Contacto puesto, motor detenido.</b> La luz de carga se enciende porque el alternador no gira. La bobina recibe ${nf(S.V, 1)} V, pero sin giro el generador de señal no avisa y no hay chispa.` :
      cranking ? `<b>Partida.</b> El motor de partida pide ≈ ${nf(Math.round(S.iCrank))} A y la batería baja a ${nf(S.V, 1)} V; el motor gira a ≈ ${nf(Math.round(rpm))} rpm${S.spark ? ' y el giro lento ya da señal y chispa.' : ', pero con tan poco voltaje no hay chispa.'}` :
      `<b>${nf(Math.round(rpm))} rpm.</b> El generador de señal avisa al módulo cuándo cortar el primario; al cortarse, la bobina induce la alta tensión y el rotor la lleva a la bujía que corresponde.${miss}<span class="sub">Avance: ${nf(S.adv.base)}° de base + ${nf(S.adv.cent, 1)}° centrífugo + ${nf(S.adv.vac, 1)}° de vacío. El alternador entrega ${nf(S.iAlt, S.iAlt < 10 ? 1 : 0)} A a ${nf(S.V, 1)} V.</span>`;
  }
  frame(0.016);
  return { tick(dt) { frame(dt); } };
}
