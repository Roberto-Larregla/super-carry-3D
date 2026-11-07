import { s, svg, t, callout, clamp, lerp, h, range, seg, readout } from '../svgkit.js';

// frío azul → tibio gris pizarra → caliente naranjo → excesivo rojo (sin pasar por verde ni caqui)
const STOPS = [[20, [58, 160, 220]], [60, [112, 132, 146]], [88, [240, 150, 60]], [110, [232, 68, 58]]];
function tempColor(T) {
  T = clamp(T, 20, 110);
  for (let i = 0; i < STOPS.length - 1; i++) { const [t0, c0] = STOPS[i], [t1, c1] = STOPS[i + 1]; if (T <= t1) { const k = (T - t0) / (t1 - t0); return `rgb(${c0.map((v, j) => Math.round(lerp(v, c1[j], k))).join(',')})`; } }
  return 'rgb(232,68,58)';
}

export function refrigeracion(root) {
  const st = { T: 65, open: 82, heater: true, shroud: true, fanA: 0 };
  const f = svg(400, 336, 'Circuito de refrigeración con radiador, ventilador, bomba de agua, termostato y calefacción');
  // radiador
  s('rect', { x: 18, y: 72, width: 60, height: 196, rx: 3, class: 'metal-outline' }, f);
  for (let y = 80; y < 262; y += 7) s('line', { x1: 20, y1: y, x2: 76, y2: y, class: 'fin' }, f);
  const radCore = s('rect', { x: 22, y: 76, width: 52, height: 188, class: 'radcore' }, f);
  s('rect', { x: 14, y: 58, width: 68, height: 16, rx: 4, class: 'tank' }, f);
  s('rect', { x: 14, y: 266, width: 68, height: 16, rx: 4, class: 'tank' }, f);
  s('rect', { x: 34, y: 46, width: 16, height: 12, rx: 2, class: 'capk' }, f);
  // carenado y ventilador
  const shroudP = s('path', { d: 'M78,74 L112,134 M78,266 L112,206', class: 'shroud' }, f);
  const brokenP = s('path', { d: 'M78,74 L92,98 M78,266 L90,246', class: 'shroud broken' }, f);
  const blades = [s('ellipse', { cx: 116, cy: 152, rx: 4, ry: 22, class: 'blade' }, f), s('ellipse', { cx: 116, cy: 188, rx: 4, ry: 22, class: 'blade' }, f)];
  s('circle', { cx: 116, cy: 170, r: 6, class: 'axle' }, f);
  // motor
  s('rect', { x: 152, y: 70, width: 182, height: 42, rx: 6, class: 'metal-alu' }, f);
  s('rect', { x: 152, y: 112, width: 182, height: 140, rx: 6, class: 'metal-iron' }, f);
  const jacketH = s('rect', { x: 162, y: 78, width: 162, height: 24, rx: 6, class: 'coolant' }, f);
  const jacketB = s('rect', { x: 162, y: 122, width: 162, height: 118, rx: 8, class: 'coolant' }, f);
  for (const x of [180, 230, 280]) s('rect', { x: x - 4, y: 100, width: 8, height: 24, class: 'coolant link' }, f);
  ['1', '2', '3', '4'].forEach((n, i) => { s('circle', { cx: 190 + i * 36, cy: 180, r: 15, class: 'bore' }, f); t(f, 190 + i * 36, 184, n, 'lbl lbl-xs', 'middle'); });
  t(f, 243, 266, 'Block y culata (camisas de agua)', 'lbl lbl-xs', 'middle');
  // bomba de agua y termostato
  s('circle', { cx: 138, cy: 226, r: 15, class: 'node pump' }, f);
  const imp = s('path', { d: 'M138,214 L138,238 M126,226 L150,226 M130,218 L146,234 M146,218 L130,234', class: 'impeller' }, f);
  s('rect', { x: 132, y: 62, width: 24, height: 24, rx: 4, class: 'node' }, f);
  const thermo = s('rect', { x: 137, y: 72, width: 14, height: 5, rx: 1.5, class: 'thermo' }, f);
  // mangueras
  const up = 'M140,62 C126,34 86,32 64,58';
  const low = 'M48,282 C54,306 104,304 118,276 L130,240';
  const byp = 'M144,86 L144,206';
  const heatS = 'M334,88 L360,88 L360,62';
  const heatR = 'M392,40 L396,40 L396,302 L122,302 L122,276';
  const resv = 'M42,46 L42,30 L8,30 L8,300';
  const pipes = { up, low, byp, heatS, heatR };
  for (const k in pipes) s('path', { d: pipes[k], class: 'hosebg' }, f);
  s('path', { d: resv, class: 'thin-hose' }, f);
  const fl = {};
  for (const k in pipes) fl[k] = s('path', { d: pipes[k], class: 'flow cool', 'stroke-dasharray': '5 7' }, f);
  const flRes = s('path', { d: resv, class: 'flow cool', 'stroke-dasharray': '3 6' }, f);
  // depósito y calefactor
  s('rect', { x: 2, y: 300, width: 40, height: 30, rx: 5, class: 'node res' }, f);
  const resLvl = s('rect', { x: 4, y: 316, width: 36, height: 12, class: 'coolant' }, f);
  s('rect', { x: 340, y: 14, width: 52, height: 48, rx: 4, class: 'heater' }, f);
  for (let x = 346; x < 390; x += 6) s('line', { x1: x, y1: 18, x2: x, y2: 58, class: 'fin' }, f);
  const hv = s('circle', { cx: 360, cy: 76, r: 6, class: 'hvalve' }, f);
  // aire
  const air = [];
  for (let i = 0; i < 26; i++) air.push({ x: Math.random() * 130, y: 80 + Math.random() * 180, k: Math.random(), el: s('circle', { r: 1.6, class: 'p-air' }, f) });
  // etiquetas
  callout(f, 42, 46, 2, 18, 'Tapa 0,9 bar');
  t(f, 48, 168, 'Radiador', 'lbl lbl-s strong halo', 'middle', { transform: 'rotate(-90 48 168)' });
  callout(f, 100, 110, 88, 24, 'Carenado', 'start');
  callout(f, 118, 146, 190, 20, 'Ventilador por correa', 'start');
  callout(f, 152, 238, 150, 326, 'Bomba de agua', 'start');
  callout(f, 156, 70, 176, 46, 'Termostato', 'start');
  t(f, 138, 146, 'Bypass', 'lbl lbl-xs', 'middle', { transform: 'rotate(-90 138 146)' });
  t(f, 366, 10, 'Calefacción', 'lbl lbl-xs', 'middle');
  t(f, 392, 296, 'cañería de calefacción bajo el motor', 'lbl lbl-xs', 'end');
  t(f, 22, 296, 'Depósito', 'lbl lbl-xs', 'middle');

  const rd = readout();
  const tCtl = range({ label: 'Temperatura del motor', min: 20, max: 112, step: 1, value: st.T, fmt: v => Math.round(v) + ' °C', oninput: v => st.T = v });
  const oCtl = seg({ label: 'Termostato', options: [{ v: '82', t: 'Abre a 82 °C' }, { v: '88', t: 'Abre a 88 °C' }], value: '82', onchange: v => st.open = +v });
  const hCtl = seg({ label: 'Calefacción', options: [{ v: 'on', t: 'Abierta' }, { v: 'off', t: 'Cerrada' }], value: 'on', onchange: v => st.heater = v === 'on' });
  const sCtl = seg({ label: 'Carenado del ventilador', options: [{ v: 'ok', t: 'Bien' }, { v: 'roto', t: 'Roto o ausente' }], value: 'ok', onchange: v => st.shroud = v === 'ok' });
  root.append(
    h('figure', { class: 'fig' }, f, h('figcaption', {}, 'Esquema del circuito (4,0 L). La bomba descarga junto al cilindro 1; el agua recorre block, culata y múltiple de admisión, donde está el termostato. Frío: vuelve a la bomba por la derivación y la calefacción. Caliente: pasa además por el radiador, junto al ventilador mecánico. La posición exacta del radiador en este furgón puede variar respecto del modelo 3D.')),
    rd,
    h('div', { class: 'controls' }, tCtl, oCtl, hCtl, sCtl),
  );

  function frame(dt) {
    const T = st.T;
    const open = clamp((T - st.open) / 12, 0, 1);
    const hot = tempColor(T), cool = tempColor(lerp(T, Math.max(20, T - 18), open * (st.shroud ? 1 : 0.35)));
    jacketB.style.fill = hot; jacketH.style.fill = tempColor(T + 2);
    radCore.style.fill = open > 0 ? tempColor(lerp(T, T - 12, 0.5)) : 'var(--panel-2)';
    thermo.setAttribute('transform', `translate(0 ${(-open * 8).toFixed(1)})`);
    thermo.setAttribute('class', 'thermo' + (open > 0 ? ' open' : ''));
    const rate = (k, v, color) => { const p = fl[k]; p.style.opacity = v > 0.02 ? 1 : 0.08; p.style.stroke = color; p._o = ((p._o || 0) - (20 + v * 50) * dt * (v > 0.02 ? 1 : 0)) % 120; p.setAttribute('stroke-dashoffset', p._o.toFixed(1)); };
    rate('up', open, hot); rate('low', open, cool); rate('byp', 1 - open * 0.85, hot);
    rate('heatS', st.heater ? 0.6 : 0, hot); rate('heatR', st.heater ? 0.6 : 0, tempColor(T - 10));
    hv.setAttribute('class', 'hvalve' + (st.heater ? ' open' : ''));
    const expand = T > 92 ? clamp((T - 92) / 16, 0, 1) : 0;
    flRes.style.opacity = expand > 0 ? 1 : 0.05; flRes._o = ((flRes._o || 0) - 30 * dt) % 90; flRes.setAttribute('stroke-dashoffset', flRes._o);
    resLvl.setAttribute('y', 316 - expand * 8); resLvl.setAttribute('height', 12 + expand * 8);
    st.fanA += dt * 14;
    blades.forEach((b, i) => b.setAttribute('ry', (6 + Math.abs(Math.sin(st.fanA + i * 1.57)) * 18).toFixed(1)));
    imp.setAttribute('transform', `rotate(${(st.fanA * 40 % 360).toFixed(0)} 138 226)`);
    shroudP.style.opacity = st.shroud ? 1 : 0; brokenP.style.opacity = st.shroud ? 0 : 1;
    for (const a of air) {
      a.x += dt * (60 + a.k * 40);
      if (!st.shroud && a.x > 80 && a.x < 112) { a.y += (a.y < 170 ? -1 : 1) * dt * 60; }
      if (a.x > 140 || a.y < 60 || a.y > 280) { a.x = -6 - Math.random() * 20; a.y = 80 + Math.random() * 180; }
      a.el.setAttribute('cx', a.x.toFixed(1)); a.el.setAttribute('cy', a.y.toFixed(1));
      const inCore = a.x > 18 && a.x < 78; a.el.style.opacity = !st.shroud && inCore ? 0.25 : 0.7;
    }
    let state = open <= 0 ? 'cerrado: el agua recircula por el bypass (y la calefacción) para calentar rápido el motor' : open < 1 ? 'abriendo: parte del agua pasa por el radiador' : 'abierto: todo el caudal pasa por el radiador';
    rd.innerHTML = `<b>${Math.round(T)} °C · Termostato ${state}.</b>` +
      `<span class="sub">${expand > 0 ? 'El refrigerante se dilata: la tapa de 0,9 bar deja pasar el excedente al depósito y lo recupera al enfriar. ' : ''}${!st.shroud ? '<b>Sin carenado</b>, el ventilador mueve aire alrededor del radiador y no a través del panal: el motor se recalienta en taco. ' : ''}${T > 104 ? '<b>Temperatura excesiva:</b> detén el motor, no abras la tapa en caliente. ' : ''}${st.heater ? 'La calefacción también saca calor del motor.' : ''}</span>`;
  }
  frame(0.016);
  return { tick(dt) { frame(dt); } };
}
