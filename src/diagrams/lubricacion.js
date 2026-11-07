import { s, svg, t, callout, clamp, lerp, rad, pol, h, range, seg, readout } from '../svgkit.js';

export function lubricacion(root) {
  const st = { rpm: 900, cold: false, clog: false, low: false, a: 0, flick: 0 };
  const f = svg(400, 330, 'Circuito de lubricación del motor F10A');
  // estructura
  s('rect', { x: 120, y: 30, width: 266, height: 52, rx: 6, class: 'metal-alu' }, f); // culata
  s('rect', { x: 120, y: 82, width: 266, height: 176, rx: 6, class: 'metal-iron' }, f); // block
  s('path', { d: 'M100,262 L396,262 L380,320 L116,320 Z', class: 'metal-alu' }, f); // cárter
  const oil = s('path', { class: 'oilfill' }, f);
  // árbol de levas y ejes de balancines
  s('line', { x1: 130, y1: 62, x2: 380, y2: 62, class: 'shaft' }, f);
  for (const x of [140, 200, 260, 320, 372]) s('rect', { x: x - 7, y: 56, width: 14, height: 12, rx: 3, class: 'journal-b' }, f);
  s('line', { x1: 130, y1: 44, x2: 380, y2: 44, class: 'shaft thin' }, f);
  t(f, 254, 40, 'Ejes de balancines', 'lbl lbl-xs', 'middle');
  t(f, 254, 77, 'Árbol de levas (5 apoyos)', 'lbl lbl-xs', 'middle');
  // cigüeñal y bancadas
  s('line', { x1: 130, y1: 226, x2: 384, y2: 226, class: 'shaft' }, f);
  const mains = [140, 196, 252, 308, 364];
  mains.forEach(x => s('rect', { x: x - 8, y: 218, width: 16, height: 16, rx: 3, class: 'journal-b' }, f));
  [168, 224, 280, 336].forEach(x => s('circle', { cx: x, cy: 238, r: 7, class: 'journal-b' }, f));
  t(f, 254, 252, 'Cigüeñal: 5 bancadas y 4 muñones de biela', 'lbl lbl-xs', 'middle');
  // bomba, chupador, alivio, filtro
  s('circle', { cx: 76, cy: 214, r: 20, class: 'node pump' }, f);
  const inner = s('path', { class: 'rotor-in' }, f), outer = s('path', { class: 'rotor-out' }, f);
  const P = {
    pick: 'M150,310 L150,300 L76,300 L76,234',
    out: 'M76,194 L76,150 L96,150',
    filt: 'M124,150 L134,150 L134,124 L392,124',
    relief: 'M76,176 L44,176 L44,290 L104,290',
    bypass: 'M100,140 L100,132 L120,132',
    feeds: mains.map(x => `M${x},124 L${x},218`).join(' '),
    crank: [168, 224, 280, 336].map((x, i) => `M${mains[i]},226 L${x},238`).join(' '),
    riser: 'M372,124 L372,62',
    rocker: 'M372,56 L372,44 L130,44',
    drain: 'M390,44 L390,200 M392,210 L392,262',
    drain2: 'M126,90 L126,250',
  };
  const flows = {};
  for (const k in P) { s('path', { d: P[k], class: 'oilbg' }, f); flows[k] = s('path', { d: P[k], class: 'flow oil', 'stroke-dasharray': k.startsWith('drain') ? '2 8' : '4 6' }, f); }
  s('rect', { x: 96, y: 136, width: 28, height: 40, rx: 6, class: 'filter' }, f);
  const byp = s('circle', { cx: 110, cy: 132, r: 4, class: 'check' }, f);
  const relief = s('rect', { x: 66, y: 170, width: 20, height: 12, rx: 3, class: 'valvebox' }, f);
  s('path', { d: 'M138,310 L162,310 L162,300 L138,300 Z', class: 'strainer' }, f);
  // bulbo y luz
  s('rect', { x: 286, y: 112, width: 14, height: 12, rx: 2, class: 'term' }, f);
  s('path', { d: 'M293,112 L293,100', class: 'wire' }, f);
  const lamp = s('circle', { cx: 293, cy: 96, r: 6, class: 'lampon oil' }, f);
  // etiquetas
  callout(f, 76, 214, 14, 252, 'Bomba de rotores\n(movida por cigüeñal)');
  callout(f, 140, 306, 14, 300, 'Chupador\ny colador');
  callout(f, 110, 146, 14, 118, 'Filtro (con válvula\nde paso interna)');
  callout(f, 76, 176, 14, 160, 'Alivio');
  callout(f, 252, 124, 220, 108, 'Galería principal', 'end');
  t(f, 304, 100, 'Luz de aceite', 'lbl lbl-xs');
  t(f, 262, 308, 'Cárter: 3,5 L de aceite', 'lbl lbl-s strong on-fill', 'middle');

  // manómetro
  const g = svg(400, 132, 'Manómetro de presión de aceite (simulación)');
  const G = { x: 112, y: 112, r: 86 };
  const a0 = rad(180), a1 = rad(360), maxBar = 6;
  const ang = v => a0 + (a1 - a0) * clamp(v / maxBar, 0, 1);
  const arcD = (v0, v1, r) => { const [x0, y0] = pol(G.x, G.y, r, ang(v0)), [x1, y1] = pol(G.x, G.y, r, ang(v1)); return `M${x0},${y0} A${r},${r} 0 0 1 ${x1},${y1}`; };
  s('path', { d: arcD(0, 6, G.r), class: 'gauge-track' }, g);
  s('path', { d: arcD(2.9, 4.4, G.r), class: 'gauge-spec' }, g);
  for (let v = 0; v <= 6; v++) { const [x0, y0] = pol(G.x, G.y, G.r - 10, ang(v)), [x1, y1] = pol(G.x, G.y, G.r + 2, ang(v)); s('line', { x1: x0, y1: y0, x2: x1, y2: y1, class: 'tick' }, g); const [tx, ty] = pol(G.x, G.y, G.r - 20, ang(v)); t(g, tx, ty + 4, String(v), 'lbl lbl-xs', 'middle'); }
  const needle = s('line', { x1: G.x, y1: G.y, class: 'gauge-needle' }, g);
  s('circle', { cx: G.x, cy: G.y, r: 5, class: 'axle' }, g);
  t(g, G.x, G.y - 30, 'bar', 'lbl lbl-xs', 'middle');
  const pv = t(g, 222, 52, '', 'num');
  t(g, 222, 72, 'Banda verde: 3,0–4,5 kg/cm² (2,9–4,4 bar) a 3.000 rpm', 'lbl lbl-xs');
  t(g, 222, 86, '(especificación con aceite caliente)', 'lbl lbl-xs');
  t(g, 222, 106, 'Aguja: simulación aproximada', 'lbl lbl-xs muted');

  const rd = readout();
  const rpmC = range({ label: 'Régimen', min: 800, max: 5500, step: 50, value: st.rpm, fmt: v => Math.round(v) + ' rpm', oninput: v => st.rpm = v });
  const tempC = seg({ label: 'Aceite', options: [{ v: 'hot', t: 'Caliente' }, { v: 'cold', t: 'Frío' }], value: 'hot', onchange: v => st.cold = v === 'cold' });
  const clogC = seg({ label: 'Filtro', options: [{ v: 'ok', t: 'Nuevo' }, { v: 'clog', t: 'Tapado' }], value: 'ok', onchange: v => st.clog = v === 'clog' });
  const lowC = seg({ label: 'Nivel', options: [{ v: 'ok', t: 'Correcto' }, { v: 'low', t: 'Bajo' }], value: 'ok', onchange: v => st.low = v === 'low' });
  root.append(
    h('figure', { class: 'fig' }, f, h('figcaption', {}, 'La bomba de engranaje interno, al frente y movida por el cigüeñal, aspira por el chupador y empuja el aceite al filtro (en el costado de abajo del block, colgando vertical). Después se divide en dos caminos: bancadas y bielas por un lado, culata por el otro, donde los ejes de balancines lo reparten al árbol de levas y a los balancines; luego cae de vuelta al cárter.')),
    h('figure', { class: 'fig slim' }, g), rd,
    h('div', { class: 'controls' }, rpmC, tempC, clogC, lowC),
  );

  function frame(dt) {
    st.a += dt * (0.6 + st.rpm / 900) * 2;
    let p = 4.4 * (1 - Math.exp(-st.rpm / 1650));
    if (st.cold) p *= 1.3;
    let reliefOpen = false; if (p > 5.2) { p = 5.2; reliefOpen = true; }
    if (st.low) { st.flick -= dt; if (st.flick < 0) st.flick = Math.random() * 0.8; if (st.flick < 0.18) p *= 0.25; }
    const lampOn = p < 0.4;
    const lvl = st.low ? 300 : 284;
    oil.setAttribute('d', `M${102 + (lvl - 262) * 0.27},${lvl} L${394 - (lvl - 262) * 0.27},${lvl} L380,320 L116,320 Z`);
    const sp = 20 + st.rpm / 60;
    for (const k in flows) {
      const pth = flows[k];
      let on = true, v = sp;
      if (k === 'relief') on = reliefOpen;
      if (k === 'bypass') on = st.clog;
      if (k === 'filt' && st.clog) v = sp;
      if (st.low && p < 1) v *= 0.3;
      pth.style.opacity = on ? 1 : 0.08;
      pth.classList.toggle('dirty', st.clog && (k !== 'pick' && k !== 'out' && k !== 'relief'));
      pth._o = ((pth._o || 0) - v * dt * (on ? 1 : 0)) % 100; pth.setAttribute('stroke-dashoffset', pth._o.toFixed(1));
    }
    byp.setAttribute('class', 'check' + (st.clog ? ' open' : ''));
    relief.setAttribute('class', 'valvebox' + (reliefOpen ? ' open' : ''));
    lamp.style.opacity = lampOn ? 1 : 0.08;
    // rotores
    const lobes = (n, r1, r2, ph) => { let d = ''; for (let i = 0; i <= 60; i++) { const a = i / 60 * Math.PI * 2; const r = r1 + (r2 - r1) * (0.5 + 0.5 * Math.cos(n * a)); const [x, y] = pol(76 + 2, 214, r, a + ph); d += (i ? 'L' : 'M') + x.toFixed(1) + ',' + y.toFixed(1); } return d + 'Z'; };
    inner.setAttribute('d', lobes(4, 6, 10, st.a)); outer.setAttribute('d', lobes(5, 12, 15.5, st.a * 0.8));
    const [nx, ny] = pol(G.x, G.y, G.r - 14, ang(p)); needle.setAttribute('x2', nx); needle.setAttribute('y2', ny);
    pv.textContent = p.toFixed(1).replace('.', ',') + ' bar';
    rd.innerHTML = `<b>${Math.round(st.rpm)} rpm, aceite ${st.cold ? 'frío' : 'caliente'}.</b> La presión sube con las rpm porque la bomba la mueve directamente el cigüeñal.` +
      `<span class="sub">${reliefOpen ? 'La válvula de alivio abre y devuelve aceite al cárter para no pasar la presión máxima. ' : ''}${st.clog ? '<b>Filtro tapado:</b> la válvula de paso deja pasar aceite sin filtrar para que el motor no quede seco. ' : ''}${st.low ? '<b>Nivel bajo:</b> el chupador aspira aire en curvas o frenadas y la luz parpadea. Detén el motor y rellena. ' : ''}${lampOn && !st.low ? 'Luz de aceite encendida. ' : ''}</span>`;
  }
  frame(0.016);
  return { tick(dt) { frame(dt); } };
}
