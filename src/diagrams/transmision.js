import { s, svg, t, callout, clamp, lerp, h, range, seg, button, readout } from '../svgkit.js';
import { GEARS, REV, FINAL, TIRES, kmh } from '../data.js';

const SERIES = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4']; // validado para fondo claro (con leyenda y tabla)
const fmt1 = v => v.toFixed(1).replace('.', ',');
const fmt2 = v => v.toFixed(2).replace('.', ',');

export function transmision(root) {
  const st = { pedal: 0, gear: '2', rpm: 2500, tire: TIRES[0], curve: 0, a: 0, inA: 0, cA: 0, oA: 0, wl: 0, wr: 0 };
  const ratioOf = g => g === 'N' ? 0 : g === 'R' ? REV : GEARS[+g - 1].r;

  // ═══ Embrague ═══
  const fc = svg(400, 214, 'Embrague: volante, disco, plato de presión, collarín y horquilla');
  s('path', { d: 'M104,20 L170,14 L250,40 L250,196 L170,222 L104,216', class: 'housing' }, fc);
  t(fc, 252, 206, 'Campana', 'lbl lbl-xs');
  const engShaft = s('line', { x1: 0, y1: 118, x2: 112, y2: 118, class: 'shaft' }, fc);
  const engStripe = s('line', { x1: 0, y1: 118, x2: 112, y2: 118, class: 'stripe', 'stroke-dasharray': '4 8' }, fc);
  s('rect', { x: 112, y: 30, width: 16, height: 176, rx: 3, class: 'flywheel' }, fc);
  const fwStripe = s('line', { x1: 120, y1: 30, x2: 120, y2: 206, class: 'stripe', 'stroke-dasharray': '6 10' }, fc);
  const disc = s('g', {}, fc);
  s('rect', { x: 129, y: 46, width: 10, height: 144, rx: 2, class: 'facing' }, disc);
  s('rect', { x: 131, y: 104, width: 8, height: 28, rx: 2, class: 'hub' }, disc);
  const plate = s('rect', { x: 141, y: 40, width: 14, height: 156, rx: 3, class: 'pplate' }, fc);
  const diaph = s('path', { class: 'diaphragm' }, fc);
  const bearing = s('rect', { y: 104, width: 14, height: 28, rx: 3, class: 'bearing' }, fc);
  const inShaft = s('line', { x1: 135, y1: 118, x2: 396, y2: 118, class: 'shaft' }, fc);
  const inStripe = s('line', { x1: 140, y1: 118, x2: 396, y2: 118, class: 'stripe', 'stroke-dasharray': '4 8' }, fc);
  s('rect', { x: 300, y: 70, width: 96, height: 96, rx: 8, class: 'node' }, fc); t(fc, 348, 92, 'Caja', 'lbl lbl-s strong', 'middle');
  const fork = s('path', { class: 'fork' }, fc); s('circle', { cx: 214, cy: 70, r: 4, class: 'axle' }, fc);
  const cable = s('path', { class: 'cable' }, fc);
  const pedal = s('path', { class: 'pedalarm' }, fc); s('circle', { cx: 30, cy: 12, r: 4, class: 'axle' }, fc);
  t(fc, 4, 108, 'motor →', 'lbl lbl-xs');
  callout(fc, 120, 40, 60, 160, 'Volante', 'middle');
  callout(fc, 134, 190, 96, 204, 'Disco 180 mm', 'end');
  callout(fc, 150, 196, 160, 210, 'Plato de presión', 'start');
  callout(fc, 191, 104, 236, 90, 'Collarín');
  callout(fc, 226, 46, 262, 46, 'Horquilla');
  t(fc, 112, 12, 'Cable al pedal', 'lbl lbl-xs');

  // ═══ Caja ═══
  const fg = svg(400, 250, 'Caja de cambios de 5 velocidades: eje primario, secundario y eje intermedio');
  const YM = 86, YC = 166, D = 80, K = 1.5;
  const pairs = [
    { id: 'in', x: 48, q: 1 / K, lbl: 'Entrada' },
    { id: '3', x: 118, q: 1.42 / K, lbl: '3.ª' },
    { id: '2', x: 178, q: 1.95 / K, lbl: '2.ª' },
    { id: '1', x: 238, q: 3.652 / K, lbl: '1.ª' },
    { id: '5', x: 318, q: 0.8 / K, lbl: '5.ª' },
  ].map(p => ({ ...p, rm: D * p.q / (1 + p.q), rc: D / (1 + p.q) }));
  s('line', { x1: 0, y1: YM, x2: 60, y2: YM, class: 'shaft' }, fg);
  const mainShaft = s('line', { x1: 62, y1: YM, x2: 398, y2: YM, class: 'shaft' }, fg);
  const cShaft = s('line', { x1: 28, y1: YC, x2: 384, y2: YC, class: 'shaft' }, fg);
  const pathMain = s('line', { x1: 62, y1: YM, x2: 398, y2: YM, class: 'flow power', 'stroke-dasharray': '5 7' }, fg);
  const pathIn = s('line', { x1: 0, y1: YM, x2: 60, y2: YM, class: 'flow power', 'stroke-dasharray': '5 7' }, fg);
  const pathC = s('line', { x1: 28, y1: YC, x2: 384, y2: YC, class: 'flow power', 'stroke-dasharray': '5 7' }, fg);
  const gearEls = {};
  pairs.forEach(p => {
    const gm = s('rect', { x: p.x - 9, y: YM - p.rm, width: 18, height: p.rm * 2, rx: 3, class: 'gearbox-g' }, fg);
    const gc = s('rect', { x: p.x - 9, y: YC - p.rc, width: 18, height: p.rc * 2, rx: 3, class: 'gearbox-g' }, fg);
    for (let y = YM - p.rm + 4; y < YM + p.rm - 2; y += 5) s('line', { x1: p.x - 9, y1: y, x2: p.x + 9, y2: y, class: 'gtooth' }, fg);
    for (let y = YC - p.rc + 4; y < YC + p.rc - 2; y += 5) s('line', { x1: p.x - 9, y1: y, x2: p.x + 9, y2: y, class: 'gtooth' }, fg);
    t(fg, p.x, 242, p.lbl, 'lbl lbl-xs strong', 'middle');
    gearEls[p.id] = [gm, gc];
  });
  // retroceso con piñón loco
  const rm = s('rect', { x: 359, y: YM - 30, width: 18, height: 60, rx: 3, class: 'gearbox-g' }, fg);
  const rc = s('rect', { x: 359, y: YC - 20, width: 18, height: 40, rx: 3, class: 'gearbox-g' }, fg);
  const idler = s('rect', { x: 381, y: 108, width: 12, height: 38, rx: 3, class: 'gearbox-g idler' }, fg);
  t(fg, 372, 242, 'R', 'lbl lbl-xs strong', 'middle');
  gearEls.R = [rm, rc, idler];
  // sincronizadores
  const syn = { '34': { x: 83, l: '3', r: 'in' }, '12': { x: 208, l: '2', r: '1' }, '5R': { x: 343, l: '5', r: 'R' } };
  for (const k in syn) syn[k].el = s('rect', { x: syn[k].x - 6, y: YM - 16, width: 12, height: 32, rx: 2, class: 'sync' }, fg);
  t(fg, 4, 40, '← del embrague', 'lbl lbl-xs');
  t(fg, 398, 40, 'al cardán →', 'lbl lbl-xs', 'end');
  t(fg, 398, 206, 'Eje intermedio', 'lbl lbl-xs', 'end');
  t(fg, 200, 14, 'Engranajes locos en el eje principal; el sincronizador elegido los une al eje', 'lbl lbl-xs', 'middle');

  // ═══ Diferencial ═══
  const fd = svg(400, 204, 'Diferencial trasero visto desde arriba');
  s('line', { x1: 0, y1: 102, x2: 112, y2: 102, class: 'shaft' }, fd);
  const propStripe = s('line', { x1: 0, y1: 102, x2: 112, y2: 102, class: 'stripe', 'stroke-dasharray': '4 8' }, fd);
  s('path', { d: 'M112,92 L130,84 L130,120 L112,112 Z', class: 'pinion-g' }, fd);
  s('rect', { x: 132, y: 54, width: 120, height: 96, rx: 14, class: 'carrier' }, fd);
  for (let y = 60; y < 146; y += 6) s('line', { x1: 132, y1: y, x2: 140, y2: y, class: 'gtooth' }, fd);
  s('line', { x1: 156, y1: 102, x2: 226, y2: 102, class: 'shaft thin' }, fd);
  const spiders = [s('g', {}, fd), s('g', {}, fd)];
  [[168, 102], [214, 102]].forEach(([x, y], i) => { s('circle', { cx: x, cy: y, r: 11, class: 'spider' }, spiders[i]); s('line', { x1: x - 9, y1: y, x2: x + 9, y2: y, class: 'spoke' }, spiders[i]); spiders[i].c = [x, y]; });
  s('rect', { x: 171, y: 70, width: 40, height: 9, rx: 2, class: 'sidegear' }, fd);
  s('rect', { x: 171, y: 125, width: 40, height: 9, rx: 2, class: 'sidegear' }, fd);
  s('line', { x1: 191, y1: 70, x2: 191, y2: 26, class: 'shaft' }, fd);
  s('line', { x1: 191, y1: 134, x2: 191, y2: 178, class: 'shaft' }, fd);
  s('rect', { x: 166, y: 2, width: 50, height: 24, rx: 5, class: 'tire' }, fd);
  s('rect', { x: 166, y: 178, width: 50, height: 24, rx: 5, class: 'tire' }, fd);
  // vista desde arriba con el frente a la izquierda: la rueda derecha queda arriba y la izquierda abajo
  const treadR = s('line', { x1: 168, y1: 14, x2: 214, y2: 14, class: 'stripe', 'stroke-dasharray': '3 5' }, fd);
  const treadL = s('line', { x1: 168, y1: 190, x2: 214, y2: 190, class: 'stripe', 'stroke-dasharray': '3 5' }, fd);
  const wrT = t(fd, 226, 18, '', 'lbl lbl-s'), wlT = t(fd, 226, 194, '', 'lbl lbl-s');
  t(fd, 4, 92, 'cardán', 'lbl lbl-xs');
  callout(fd, 136, 70, 60, 50, 'Corona (piñón y\ncorona 5,125 : 1)', 'middle');
  callout(fd, 214, 112, 300, 120, 'Satélites', 'start');
  callout(fd, 211, 74, 300, 74, 'Planetarios', 'start');
  t(fd, 4, 196, 'adelante ←', 'lbl lbl-xs');

  // ═══ Gráfico: velocidad por marcha ═══
  const fch = svg(400, 278, 'Velocidad en cada marcha según las rpm del motor');
  const PL = 40, PR = 356, PT = 26, PB = 236, XMAX = 5500, YMAX = 140;
  const X = r => PL + r / XMAX * (PR - PL), Y = v => PB - v / YMAX * (PB - PT);
  for (let v = 0; v <= YMAX; v += 20) { s('line', { x1: PL, y1: Y(v), x2: PR, y2: Y(v), class: v ? 'grid' : 'axis' }, fch); t(fch, PL - 6, Y(v) + 3.5, String(v), 'lbl lbl-xs tnum', 'end'); }
  for (let r = 0; r <= 5000; r += 1000) { s('line', { x1: X(r), y1: PB, x2: X(r), y2: PB + 4, class: 'axis' }, fch); t(fch, X(r), PB + 16, r === 0 ? '0' : (r / 1000) + '.000', 'lbl lbl-xs tnum', 'middle'); }
  t(fch, PR, PB + 30, 'rpm del motor', 'lbl lbl-xs', 'end');
  t(fch, PL - 6, PT - 10, 'km/h', 'lbl lbl-xs', 'end');
  s('line', { x1: PL, y1: Y(105), x2: PR, y2: Y(105), class: 'refline' }, fch);
  t(fch, PL + 4, Y(105) - 4, 'Velocidad máxima declarada: 105 km/h', 'lbl lbl-xs');
  s('line', { x1: X(5300), y1: PT, x2: X(5300), y2: PB, class: 'refline' }, fch);
  t(fch, X(5300) - 4, PB - 6, 'Potencia máx. 5.300 rpm (UK 1986)', 'lbl lbl-xs', 'end');
  const lines = GEARS.map((g, i) => s('path', { class: 'series', stroke: SERIES[i] }, fch));
  const ends = GEARS.map((g, i) => { const gg = s('g', {}, fch); s('circle', { r: 3.5, fill: SERIES[i], class: 'enddot' }, gg); t(gg, 7, 3.5, g.g, 'lbl lbl-xs strong'); return gg; });
  const cur = s('circle', { r: 5, class: 'curdot' }, fch);
  const hover = s('g', { class: 'hover', style: 'opacity:0' }, fch);
  const hl = s('line', { y1: PT, y2: PB, class: 'crosshair' }, hover);
  const hd = GEARS.map((g, i) => s('circle', { r: 4, fill: SERIES[i], class: 'hdot' }, hover));
  const tip = s('g', {}, hover); const tipBg = s('rect', { width: 104, height: 92, rx: 6, class: 'tip' }, tip);
  const tipT = [t(tip, 8, 15, '', 'lbl lbl-xs strong')].concat(GEARS.map((g, i) => { const y = 30 + i * 13; s('circle', { cx: 11, cy: y - 3.5, r: 3, fill: SERIES[i] }, tip); return t(tip, 20, y, '', 'lbl lbl-xs tnum'); }));
  const hit = s('rect', { x: PL, y: PT, width: PR - PL, height: PB - PT, class: 'hit' }, fch);
  function drawChart() {
    GEARS.forEach((g, i) => {
      const v1 = kmh(XMAX, g.r, st.tire);
      lines[i].setAttribute('d', `M${X(0)},${Y(0)} L${X(XMAX)},${Y(v1)}`);
      lines[i].classList.toggle('active', st.gear === String(i + 1));
      ends[i].setAttribute('transform', `translate(${X(XMAX)} ${Y(v1)})`);
    });
    const r = ratioOf(st.gear);
    if (st.gear !== 'N' && st.gear !== 'R') { cur.style.opacity = 1; cur.setAttribute('cx', X(st.rpm)); cur.setAttribute('cy', Y(kmh(st.rpm, r, st.tire))); } else cur.style.opacity = 0;
  }
  function showHover(evt) {
    const pt = fch.createSVGPoint(); pt.x = evt.clientX; pt.y = evt.clientY;
    const p = pt.matrixTransform(fch.getScreenCTM().inverse());
    const rpm = clamp((p.x - PL) / (PR - PL) * XMAX, 0, XMAX);
    const rr = Math.round(rpm / 50) * 50;
    hover.style.opacity = 1; hl.setAttribute('x1', X(rr)); hl.setAttribute('x2', X(rr));
    GEARS.forEach((g, i) => { const v = kmh(rr, g.r, st.tire); hd[i].setAttribute('cx', X(rr)); hd[i].setAttribute('cy', Y(v)); tipT[i + 1].textContent = `${g.g}  ${Math.round(v)} km/h`; });
    tipT[0].textContent = rr.toLocaleString('es-CL') + ' rpm';
    const tx = X(rr) + 10 + 104 > PR ? X(rr) - 114 : X(rr) + 10; tip.setAttribute('transform', `translate(${tx} ${PT + 4})`);
  }
  hit.addEventListener('pointermove', showHover); hit.addEventListener('pointerdown', showHover);
  hit.addEventListener('pointerleave', () => hover.style.opacity = 0);
  const legend = h('div', { class: 'legend' }, GEARS.map((g, i) => h('span', { class: 'key' }, h('i', { class: 'sw', style: `background:${SERIES[i]}` }), `${g.g} (${fmt2(g.r)})`)));
  const tableWrap = h('div', { class: 'tablewrap', hidden: true });
  function drawTable() {
    const rows = [1000, 2000, 3000, 4000, 5000].map(r => `<tr><th scope="row">${r.toLocaleString('es-CL')}</th>${GEARS.map(g => `<td>${Math.round(kmh(r, g.r, st.tire))}</td>`).join('')}</tr>`).join('');
    tableWrap.innerHTML = `<table class="data"><caption>km/h según rpm y marcha, neumático ${st.tire.label}</caption><thead><tr><th scope="col">rpm</th>${GEARS.map(g => `<th scope="col">${g.g}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table>`;
  }
  const tblBtn = button('Ver como tabla', () => { tableWrap.hidden = !tableWrap.hidden; tblBtn.textContent = tableWrap.hidden ? 'Ver como tabla' : 'Ocultar tabla'; drawTable(); });

  // ═══ Controles ═══
  const rdC = readout(), rdG = readout(), rdD = readout();
  const pedC = range({ label: 'Pedal de embrague', min: 0, max: 100, step: 1, value: 0, fmt: v => Math.round(v) + ' %', oninput: v => st.pedal = v });
  const gearC = seg({ label: 'Marcha', options: ['N', '1', '2', '3', '4', '5', 'R'].map(v => ({ v, t: v === 'N' ? 'N' : v === 'R' ? 'R' : v + '.ª' })), value: st.gear, onchange: v => { st.gear = v; drawChart(); } });
  const rpmC = range({ label: 'Motor', min: 900, max: 5500, step: 50, value: st.rpm, fmt: v => Math.round(v).toLocaleString('es-CL') + ' rpm', oninput: v => { st.rpm = v; drawChart(); } });
  const tireSel = h('select', { id: 'tiresel' }, TIRES.map(tt => h('option', { value: tt.id }, tt.label)));
  tireSel.addEventListener('change', () => { st.tire = TIRES.find(x => x.id === tireSel.value); drawChart(); if (!tableWrap.hidden) drawTable(); });
  const tireC = h('div', { class: 'ctl' }, h('label', { for: 'tiresel' }, 'Neumático (mira el flanco)'), tireSel);
  const curveC = range({ label: 'Curva', min: -100, max: 100, step: 1, value: 0, fmt: v => v === 0 ? 'recto' : (v < 0 ? 'izquierda ' : 'derecha ') + Math.abs(Math.round(v)) + ' %', oninput: v => st.curve = v / 100 });

  root.append(
    h('h4', { class: 'subh' }, 'Embrague'),
    h('figure', { class: 'fig' }, fc), rdC, h('div', { class: 'controls' }, pedC),
    h('h4', { class: 'subh' }, 'Caja de cambios'),
    h('figure', { class: 'fig' }, fg, h('figcaption', {}, 'Esquema de principio con las relaciones de fábrica (UK). La 4.ª es directa: el sincronizador une la entrada con el eje principal y el eje intermedio gira en vacío. El tamaño de los engranajes está dibujado en proporción a cada relación.')),
    rdG, h('div', { class: 'controls' }, gearC, rpmC, tireC),
    h('h4', { class: 'subh' }, 'Velocidad en cada marcha'),
    h('figure', { class: 'fig chart' }, legend, fch, h('figcaption', {}, 'Velocidad = rpm ÷ (relación × 5,125) × circunferencia del neumático. Con sus 175/70 R13 da unos 25,9 km/h cada 1.000 rpm en 5.ª; con el 155 R12 de fábrica, 24,9 (la prueba de 1986 midió 24,8). Toca el gráfico para leer valores.'), tblBtn, tableWrap),
    h('h4', { class: 'subh' }, 'Diferencial'),
    h('figure', { class: 'fig' }, fd, h('figcaption', {}, 'Los planetarios mueven los palieres (semiflotantes) de cada rueda.')), rdD, h('div', { class: 'controls' }, curveC),
  );
  drawChart();

  function frame(dt) {
    // embrague
    const p = st.pedal / 100;
    const travel = clamp((p - 0.12) / 0.88, 0, 1);
    const clamp1 = 1 - clamp((p - 0.25) / 0.33, 0, 1);
    const gap = (1 - clamp1) * 5;
    disc.setAttribute('transform', `translate(${gap * 0.4} 0)`);
    plate.setAttribute('x', 141 + gap);
    const bx = 196 - travel * 12;
    bearing.setAttribute('x', bx);
    diaph.setAttribute('d', `M${156 + gap},48 L${bx},110 M${156 + gap},188 L${bx},126`);
    fork.setAttribute('d', `M${bx + 12},118 L214,70 L${236 + travel * 10},${22 - travel * 2}`);
    cable.setAttribute('d', `M${236 + travel * 10},${20 - travel * 2} L92,${22} L${46 - travel * 4},${30 + travel * 6}`);
    pedal.setAttribute('d', `M30,12 L${40 - travel * 10},${74 - travel * 6} M${32 - travel * 10},${74 - travel * 6} L${50 - travel * 10},${74 - travel * 6}`);
    const engV = 60, inV = engV * clamp1;
    st.a = (st.a - engV * dt) % 1000; st.inA = (st.inA - inV * dt) % 1000;
    engStripe.setAttribute('stroke-dashoffset', st.a); fwStripe.setAttribute('stroke-dashoffset', st.a);
    inStripe.setAttribute('stroke-dashoffset', st.inA);
    rdC.innerHTML = p < 0.12 ? '<b>Pedal suelto: embragado.</b> El plato aprieta el disco contra el volante y el motor mueve la caja.<span class="sub">Los primeros centímetros del pedal son juego libre: se regulan en el cable.</span>' :
      clamp1 > 0.02 && clamp1 < 0.98 ? '<b>Punto de contacto: el disco patina.</b> Es la zona que se usa para partir; mantenerla mucho tiempo calienta y gasta el disco.' :
      clamp1 >= 0.98 ? '<b>Recorrido libre:</b> el collarín todavía no empuja el diafragma.' :
      '<b>Pedal a fondo: desembragado.</b> El collarín empuja los dedos del diafragma, el plato se retira y el disco queda libre: se puede cambiar de marcha.';
    // caja
    const g = st.gear, r = ratioOf(g);
    for (const id in gearEls) gearEls[id].forEach(el => el.classList.remove('active'));
    for (const k in syn) { syn[k].el.setAttribute('transform', ''); syn[k].el.classList.remove('active'); }
    if (g !== 'N') {
      gearEls.in.forEach(el => el.classList.add('active'));
      if (g === '4') { syn['34'].el.setAttribute('transform', 'translate(-10 0)'); syn['34'].el.classList.add('active'); }
      else {
        (gearEls[g] || []).forEach(el => el.classList.add('active'));
        const k = g === '3' ? '34' : (g === '1' || g === '2') ? '12' : '5R';
        const dir = (g === syn[k].l) ? -10 : 10;
        syn[k].el.setAttribute('transform', `translate(${dir} 0)`); syn[k].el.classList.add('active');
      }
    }
    const inSp = 40 * clamp1, cSp = inSp / K, outSp = g === 'N' ? 0 : inSp / r * (g === 'R' ? -1 : 1);
    st.cA = (st.cA - cSp * dt) % 1000; st.oA = (st.oA - outSp * dt) % 1000;
    pathIn.setAttribute('stroke-dashoffset', st.inA); pathC.setAttribute('stroke-dashoffset', st.cA); pathMain.setAttribute('stroke-dashoffset', st.oA);
    pathC.style.opacity = g === '4' ? 0.35 : 1; pathMain.style.opacity = g === 'N' ? 0.15 : 1;
    const v = r ? kmh(st.rpm, r, st.tire) : 0;
    rdG.innerHTML = g === 'N' ? '<b>Neutro.</b> Los engranajes giran locos sobre el eje principal: ningún sincronizador los une, no sale fuerza al cardán.' :
      `<b>${g === 'R' ? 'Retroceso' : g + '.ª'}: relación ${fmt2(r)} × diferencial 5,125 = ${fmt2(r * FINAL)} : 1.</b> A ${Math.round(st.rpm).toLocaleString('es-CL')} rpm: ${g === 'R' ? '' : '≈'}${Math.round(v)} km/h${g === 'R' ? ' hacia atrás' : ''} (${fmt1(kmh(1000, r, st.tire))} km/h cada 1.000 rpm).` +
      `<span class="sub">${g === '4' ? 'Directa: entrada y salida giran igual.' : g === '5' ? 'Sobremarcha: la salida gira más rápido que el motor (0,795), baja las rpm en carretera.' : g === 'R' ? 'Un piñón loco invierte el sentido de giro.' : 'La fuerza pasa por el eje intermedio y vuelve al eje principal por el par elegido.'}</span>`;
    // diferencial
    const propRpm = g === 'N' ? 0 : st.rpm / r * clamp1;
    const crown = propRpm / FINAL;
    const c = st.curve * 0.6 / 4.5; // trocha/2 ÷ radio mínimo aprox.
    const wl = crown * (1 + c), wr = crown * (1 - c);
    st.wl = (st.wl - wl / 30 * dt * 10) % 1000; st.wr = (st.wr - wr / 30 * dt * 10) % 1000;
    treadL.setAttribute('stroke-dashoffset', st.wl); treadR.setAttribute('stroke-dashoffset', st.wr);
    propStripe.setAttribute('stroke-dashoffset', st.oA);
    spiders.forEach((sp, i) => sp.setAttribute('transform', `rotate(${(((st.wl - st.wr) * 8 * (i ? -1 : 1)) % 360).toFixed(1)} ${sp.c[0]} ${sp.c[1]})`));
    wlT.textContent = `Rueda izquierda: ${Math.round(wl).toLocaleString('es-CL')} rpm`; wrT.textContent = `Rueda derecha: ${Math.round(wr).toLocaleString('es-CL')} rpm`;
    rdD.innerHTML = g === 'N' ? 'Pon una marcha para ver el reparto.' : `<b>El cardán gira a ${Math.round(propRpm).toLocaleString('es-CL')} rpm y la corona a ${Math.round(crown).toLocaleString('es-CL')} rpm (÷ 5,125).</b> ` +
      (st.curve === 0 ? 'En recta ambas ruedas giran igual y los satélites no giran sobre su eje.' : `En la curva la rueda exterior gira más rápido: los satélites giran sobre su eje para permitirlo.`);
  }
  frame(0.016);
  return { tick(dt) { frame(dt); } };
}
