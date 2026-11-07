import { s, svg, t, callout, clamp, lerp, h, range, seg, readout } from '../svgkit.js';

export function frenos(root) {
  const st = { p: 0, engine: true, leak: 'none', hand: false };
  const f = svg(400, 300, 'Sistema de frenos con servofreno, bomba tándem, discos delanteros y tambores traseros');
  // pedal y servofreno
  const pedalG = s('g', {}, f);
  s('path', { d: 'M40,30 L36,122', class: 'pedalarm' }, pedalG); s('rect', { x: 24, y: 118, width: 22, height: 8, rx: 2, class: 'pad-r' }, pedalG);
  s('circle', { cx: 40, cy: 30, r: 4, class: 'axle' }, f);
  const rodP = s('path', { class: 'link' }, f);
  s('circle', { cx: 112, cy: 100, r: 34, class: 'node servo' }, f);
  const diaph = s('path', { class: 'diaphragm' }, f);
  s('path', { d: 'M112,66 L112,24', class: 'pipe air-pipe' }, f);
  t(f, 112, 18, 'vacío del múltiple', 'lbl lbl-xs', 'middle');
  const vacFlow = s('path', { d: 'M112,24 L112,66', class: 'flow air', 'stroke-dasharray': '3 5' }, f);
  // bomba tándem y depósito
  s('rect', { x: 146, y: 88, width: 104, height: 24, rx: 4, class: 'mc' }, f);
  const fluid1 = s('rect', { y: 91, height: 18, class: 'brakefluid' }, f), fluid2 = s('rect', { y: 91, height: 18, class: 'brakefluid' }, f);
  const pist1 = s('rect', { y: 90, width: 9, height: 20, rx: 2, class: 'mcpiston' }, f), pist2 = s('rect', { y: 90, width: 9, height: 20, rx: 2, class: 'mcpiston' }, f);
  s('rect', { x: 170, y: 58, width: 62, height: 24, rx: 4, class: 'res' }, f);
  s('rect', { x: 172, y: 66, width: 58, height: 14, class: 'brakefluid' }, f);
  t(f, 201, 76, 'DOT 4', 'lbl lbl-xs strong on-fill', 'middle');
  // ruedas
  const FD = [{ x: 300, y: 56 }, { x: 372, y: 56 }], RD = [{ x: 300, y: 246 }, { x: 372, y: 246 }];
  const fronts = FD.map(c => {
    s('rect', { x: c.x - 4, y: c.y - 26, width: 8, height: 52, rx: 2, class: 'disc' }, f);
    s('path', { d: `M${c.x - 14},${c.y - 30} L${c.x + 14},${c.y - 30} L${c.x + 14},${c.y - 4} L${c.x + 10},${c.y - 4} L${c.x + 10},${c.y - 26} L${c.x - 10},${c.y - 26} L${c.x - 10},${c.y - 4} L${c.x - 14},${c.y - 4} Z`, class: 'caliper' }, f);
    const pi = s('rect', { y: c.y - 24, width: 5, height: 18, rx: 1, class: 'padbrake' }, f);
    const po = s('rect', { y: c.y - 24, width: 5, height: 18, rx: 1, class: 'padbrake' }, f);
    return { c, pi, po };
  });
  const rears = RD.map(c => {
    s('circle', { cx: c.x, cy: c.y, r: 27, class: 'drum' }, f);
    const sl = s('path', { class: 'shoe' }, f), sr = s('path', { class: 'shoe' }, f);
    s('rect', { x: c.x - 9, y: c.y - 25, width: 18, height: 7, rx: 2, class: 'wcyl' }, f);
    return { c, sl, sr };
  });
  t(f, 336, 104, 'Discos delanteros 215 × 10 mm', 'lbl lbl-xs', 'middle');
  t(f, 336, 290, 'Tambores traseros 220 mm', 'lbl lbl-xs', 'middle');
  // cañerías
  const c1 = 'M238,88 L238,20 L372,20 L372,26 M300,20 L300,26';
  const c2 = 'M182,112 L182,206 L372,206 L372,214 M300,206 L300,214';
  s('path', { d: c1, class: 'brakeline' }, f); s('path', { d: c2, class: 'brakeline' }, f);
  const l1 = s('path', { d: c1, class: 'brakeline p' }, f), l2 = s('path', { d: c2, class: 'brakeline p' }, f);
  t(f, 246, 13, 'Circuito delantero', 'lbl lbl-xs'); t(f, 188, 200, 'Circuito trasero', 'lbl lbl-xs');
  const dripF = s('g', { style: 'opacity:0' }, f), dripR = s('g', { style: 'opacity:0' }, f);
  for (let i = 0; i < 3; i++) { s('circle', { cx: 252 + i * 6, cy: 26 + i * 6, r: 2.2, class: 'drip' }, dripF); s('circle', { cx: 252 + i * 6, cy: 212 + i * 6, r: 2.2, class: 'drip' }, dripR); }
  // freno de mano
  const hand = s('path', { class: 'pedalarm' }, f); s('circle', { cx: 40, cy: 262, r: 4, class: 'axle' }, f);
  const cableP = s('path', { d: 'M52,262 L190,262 L300,262 M190,262 L372,262', class: 'cable dashed' }, f);
  t(f, 20, 286, 'Freno de mano (cable)', 'lbl lbl-xs');
  callout(f, 112, 112, 112, 156, 'Servofreno', 'middle');
  callout(f, 150, 100, 150, 136, 'Bomba de freno\ntándem', 'start');
  t(f, 26, 140, 'Pedal', 'lbl lbl-xs');

  const rd = readout();
  const pC = range({ label: 'Pedal de freno', min: 0, max: 100, step: 1, value: 0, fmt: v => Math.round(v) + ' %', oninput: v => st.p = v / 100 });
  const eC = seg({ label: 'Motor', options: [{ v: 'on', t: 'En marcha' }, { v: 'off', t: 'Apagado' }], value: 'on', onchange: v => st.engine = v === 'on' });
  const lC = seg({ label: 'Simular falla', options: [{ v: 'none', t: 'Ninguna' }, { v: 'front', t: 'Fuga delantera' }, { v: 'rear', t: 'Fuga trasera' }], value: 'none', onchange: v => st.leak = v });
  const hC = seg({ label: 'Freno de mano', options: [{ v: 'off', t: 'Suelto' }, { v: 'on', t: 'Tirado' }], value: 'off', onchange: v => st.hand = v === 'on' });
  root.append(
    h('figure', { class: 'fig' }, f, h('figcaption', {}, 'Doble circuito dividido con servofreno (desde 1990 en Chile). El esquema muestra la división delantero/trasero, la más común en tracción trasera; confírmala siguiendo las cañerías desde la bomba de este furgón.')),
    rd, h('div', { class: 'controls' }, pC, eC, lC, hC),
  );

  function frame(dt = 0.016) {
    const travel = st.p;
    const assist = st.engine ? 3 : 1;
    const eff = clamp(travel - 0.08, 0, 1);
    let P = eff * assist / 3;
    const p1On = st.leak !== 'front', p2On = st.leak !== 'rear';
    let pushX, x2;
    if (st.leak === 'front') { x2 = Math.min(238, 188 + 50 * travel); pushX = 156 + 30 * travel; }
    else if (st.leak === 'rear') { pushX = 156 + 34 * travel; x2 = Math.max(pushX + 10, 188 + 10 * travel); }
    else { pushX = 156 + 14 * travel; x2 = pushX + 32 - 4 * travel; }
    pist1.setAttribute('x', pushX); pist2.setAttribute('x', x2);
    fluid1.setAttribute('x', pushX + 9); fluid1.setAttribute('width', Math.max(0, x2 - pushX - 9));
    fluid2.setAttribute('x', x2 + 9); fluid2.setAttribute('width', Math.max(0, 247 - x2 - 9));
    // presiones de cada circuito
    const Pfront = p1On ? P : 0, Prear = p2On ? P : 0;
    l1.style.opacity = 0.15 + Pfront * 0.85; l2.style.opacity = 0.15 + Prear * 0.85;
    const handP = st.hand ? 0.8 : 0;
    // discos: pastillas se cierran
    fronts.forEach(({ c, pi, po }) => { const g = 4 * (1 - clamp(Pfront / 0.12, 0, 1)); pi.setAttribute('x', c.x - 4 - 5 - g); po.setAttribute('x', c.x + 4 + g); pi.classList.toggle('on', Pfront > 0.12); po.classList.toggle('on', Pfront > 0.12); });
    rears.forEach(({ c, sl, sr }) => {
      const k = clamp(Math.max(Prear / 0.12, handP), 0, 1); const r = 19 + 4 * k;
      sl.setAttribute('d', `M${c.x - 4},${c.y - 18} A${r},${r} 0 0 0 ${c.x - 4},${c.y + 18}`);
      sr.setAttribute('d', `M${c.x + 4},${c.y - 18} A${r},${r} 0 0 1 ${c.x + 4},${c.y + 18}`);
      sl.classList.toggle('on', k > 0.95); sr.classList.toggle('on', k > 0.95);
    });
    const ang = travel * 22;
    pedalG.setAttribute('transform', `rotate(${-ang} 40 30)`);
    rodP.setAttribute('d', `M${44 + travel * 16},${70} L${78 + travel * 10},100`);
    diaph.setAttribute('d', `M${108 + travel * 8},70 Q${118 + travel * 10},100 ${108 + travel * 8},130`);
    vacFlow.style.opacity = st.engine ? 1 : 0.1; vacFlow._o = ((vacFlow._o || 0) - (st.engine ? 15 : 0) * dt) % 80; vacFlow.setAttribute('stroke-dashoffset', vacFlow._o);
    hand.setAttribute('d', st.hand ? 'M40,262 L20,240' : 'M40,262 L14,262');
    cableP.style.opacity = st.hand ? 1 : 0.35;
    dripF.style.opacity = st.leak === 'front' ? 1 : 0; dripR.style.opacity = st.leak === 'rear' ? 1 : 0;
    const force = !st.engine && travel > 0.1 ? 'Sin vacío el servofreno no ayuda: hay que pisar mucho más fuerte para frenar igual.' : '';
    rd.innerHTML = travel < 0.08 ? '<b>Pedal suelto.</b> Las pastillas y balatas quedan apenas separadas de disco y tambor.' :
      `<b>${st.leak === 'none' ? 'Frenando con ambos circuitos.' : st.leak === 'front' ? 'Fuga delantera: sólo frenan los tambores traseros y el pedal baja más.' : 'Fuga trasera: sólo frenan los discos delanteros y el pedal baja más.'}</b>` +
      `<span class="sub">${force} ${st.leak !== 'none' ? 'El doble circuito existe justamente para que una fuga no deje el vehículo sin frenos.' : 'La bomba tándem tiene dos pistones: el del pedal empuja al segundo a través del líquido.'} ${st.hand ? 'El freno de mano abre las balatas traseras por cable, sin usar el líquido.' : ''}</span>`;
  }
  frame();
  return { tick(dt) { frame(dt); } };
}
