import { s, svg, t, callout, clamp, h, range, seg, readout } from '../svgkit.js';
import { CK, CFAILS, coolInit, coolStep, coolRead, warmUp, setTemp, applyFail, coolColor, heaterFlows } from '../coolsim.js';

const nf = (n, d = 0) => n.toLocaleString('es-CL', { minimumFractionDigits: d, maximumFractionDigits: d });

// eng (opcional): el motor del modelo, el mismo de las vistas Refrigeración y Calefacción
//   read() → { st, r, on } con el estado y la última lectura de la simulación; set(o) cambia lo mismo que los mandos de la vista.
// Sin modelo 3D, el esquema anda con su propia copia de la misma simulación, en ralentí y a tiempo real.
export function refrigeracion(root, eng) {
  if (!eng) {
    const st = coolInit({ on: true }); warmUp(st); let r = coolRead(st);
    eng = {
      own: true,
      read: () => ({ st, r, on: st.on }),
      set(o) {
        if ('on' in o) st.on = o.on;
        if ('setTemp' in o) setTemp(st, o.setTemp);
        if ('therm' in o) st.therm = o.therm;
        if (o.heat) Object.assign(st.heat, o.heat);
        if ('fail' in o) applyFail(st, o.fail);
        r = coolRead(st);
      },
      step(dt) { r = coolStep(st, dt, 1); },
    };
  }
  const ui = { fanA: 0, drag: false };
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
  // depósito (marcas LOW y FULL a escala) y radiador de calefacción
  s('rect', { x: 2, y: 300, width: 40, height: 30, rx: 5, class: 'node res' }, f);
  const resY = v => 328 - 26 * v / CK.resMax;
  const resLvl = s('rect', { x: 4, y: 316, width: 36, height: 12, class: 'coolant' }, f);
  for (const v of [CK.resLow, CK.resFull]) s('line', { x1: 32, y1: resY(v), x2: 40, y2: resY(v), class: 'tick' }, f);
  s('rect', { x: 340, y: 14, width: 52, height: 48, rx: 4, class: 'heater' }, f);
  for (let x = 346; x < 390; x += 6) s('line', { x1: x, y1: 18, x2: x, y2: 58, class: 'fin' }, f);
  const hv = s('circle', { cx: 360, cy: 76, r: 6, class: 'hvalve' }, f);
  // aire
  const air = [];
  for (let i = 0; i < 26; i++) air.push({ x: Math.random() * 130, y: 80 + Math.random() * 180, k: Math.random(), el: s('circle', { r: 1.6, class: 'p-air' }, f) });
  // etiquetas
  callout(f, 42, 46, 2, 18, `Tapa ${nf(CK.capKg, 1)} kg/cm²`);
  t(f, 48, 168, 'Radiador', 'lbl lbl-s strong halo', 'middle', { transform: 'rotate(-90 48 168)' });
  callout(f, 100, 110, 88, 24, 'Carenado', 'start');
  callout(f, 118, 146, 190, 20, 'Ventilador por correa', 'start');
  callout(f, 152, 238, 150, 326, 'Bomba de agua', 'start');
  callout(f, 156, 70, 176, 46, 'Termostato', 'start');
  t(f, 138, 146, 'Derivación', 'lbl lbl-xs', 'middle', { transform: 'rotate(-90 138 146)' });
  t(f, 366, 10, 'Calefacción', 'lbl lbl-xs', 'middle');
  t(f, 392, 296, 'retorno de la calefacción', 'lbl lbl-xs', 'end');
  t(f, 22, 296, 'Depósito', 'lbl lbl-xs', 'middle');

  const rd = readout();
  const lo = 20, hi = 112;
  const mCtl = seg({ label: 'Motor', options: [{ v: 'off', t: 'Detenido' }, { v: 'on', t: 'En marcha' }], value: 'on', onchange: v => eng.set({ on: v === 'on' }) });
  const tCtl = range({ label: 'Temperatura del agua del motor', min: lo, max: hi, step: 1, value: 80, fmt: v => Math.round(v) + ' °C', oninput: v => eng.set({ setTemp: v }) });
  tCtl.input.addEventListener('pointerdown', () => { ui.drag = true; });
  for (const ev of ['pointerup', 'pointercancel', 'blur']) tCtl.input.addEventListener(ev, () => { ui.drag = false; });
  const oCtl = seg({ label: 'Termostato', options: Object.entries(CK.therm).map(([k, [To]]) => ({ v: k, t: `${To} °C (tipo ${k})` })), value: 'A', onchange: v => eng.set({ therm: v }) });
  const hCtl = seg({ label: 'Llave de la calefacción', options: [{ v: 'on', t: 'Abierta' }, { v: 'off', t: 'Cerrada' }], value: 'on', onchange: v => eng.set({ heat: { temp: v === 'on' ? 1 : 0 } }) });
  const sCtl = seg({ label: 'Carenado del ventilador', options: [{ v: 'ok', t: 'Bien' }, { v: 'roto', t: 'Roto o ausente' }], value: 'ok',
    onchange: v => { const f0 = eng.read().st.fail; if (v === 'roto') eng.set({ fail: 'carenado' }); else if (f0 === 'carenado') eng.set({ fail: 'ok' }); } });
  root.append(
    h('figure', { class: 'fig' }, f, h('figcaption', {}, `Esquema del circuito (4,0 L). La bomba descarga junto al cilindro 1; el agua recorre block, culata y múltiple de admisión, donde está el termostato. Frío: vuelve a la bomba por la derivación y la calefacción. Caliente: pasa además por el radiador, junto al ventilador mecánico. ${eng.own ? 'El esquema simula el motor en ralentí.' : 'Es el mismo motor del modelo: temperatura, termostato, llave de la calefacción y carenado son los de las vistas Refrigeración y Calefacción.'}`)),
    rd,
    h('div', { class: 'controls' }, mCtl, tCtl, oCtl, hCtl, sCtl),
  );

  let rdKey = '';
  function frame(dt) {
    if (eng.step) eng.step(dt);
    const { st, r, on } = eng.read();
    if (!r) return;
    const T = r.Te, run = on && r.rpm > 0;
    const hot = coolColor(T), out = coolColor(r.tOut), ret = coolColor(Math.max(r.amb, T - 8));
    jacketB.style.fill = hot; jacketH.style.fill = coolColor(T + 2);
    radCore.style.fill = coolColor(r.Qr > 0.6 ? (r.tIn + r.tOut) / 2 : r.Tr);
    const open = clamp(r.lift / CK.lift, 0, 1);
    thermo.setAttribute('transform', `translate(0 ${(-open * 8).toFixed(1)})`);
    thermo.setAttribute('class', 'thermo' + (open > 0.01 ? ' open' : ''));
    const rate = (k, q, full, color) => { const p = fl[k], v = run ? clamp(q / full, 0, 1) : 0; p.style.opacity = v > 0.02 ? 1 : 0.08; p.style.stroke = color; p._o = ((p._o || 0) - (20 + v * 50) * dt * (v > 0.02 ? 1 : 0)) % 120; p.setAttribute('stroke-dashoffset', p._o.toFixed(1)); };
    rate('up', r.Qr, 30, hot); rate('low', r.Qr, 30, out); rate('byp', r.Qb, 20, hot);
    rate('heatS', r.Qh, 10, hot); rate('heatR', r.Qh, 10, ret);
    const valveOpen = heaterFlows(st.heat, st.fail);
    hv.setAttribute('class', 'hvalve' + (valveOpen ? ' open' : ''));
    const vent = r.vent > 4e-5, back = r.ret > 4e-5;
    flRes.style.opacity = vent || back ? 1 : 0.05; flRes._o = ((flRes._o || 0) + (back ? 30 : -30) * dt) % 90; flRes.setAttribute('stroke-dashoffset', flRes._o.toFixed(1));
    const ry = resY(clamp(r.res, 0, CK.resMax)); resLvl.setAttribute('y', ry.toFixed(1)); resLvl.setAttribute('height', Math.max(0, 328 - ry).toFixed(1));
    ui.fanA += dt * 14 * clamp(r.wp / 1050, 0, 3);
    blades.forEach((b, i) => b.setAttribute('ry', (6 + Math.abs(Math.sin(ui.fanA + i * 1.57)) * 18).toFixed(1)));
    imp.setAttribute('transform', `rotate(${(ui.fanA * 40 % 360).toFixed(0)} 138 226)`);
    const shroud = st.fail !== 'carenado';
    shroudP.style.opacity = shroud ? 1 : 0; brokenP.style.opacity = shroud ? 0 : 1;
    const av = clamp(r.air, 0.05, 4);
    for (const a of air) {
      a.x += dt * (35 + a.k * 30) * av;
      if (!shroud && a.x > 80 && a.x < 112) { a.y += (a.y < 170 ? -1 : 1) * dt * 60 * av; }
      if (a.x > 140 || a.y < 60 || a.y > 280) { a.x = -6 - Math.random() * 20; a.y = 80 + Math.random() * 180; }
      a.el.setAttribute('cx', a.x.toFixed(1)); a.el.setAttribute('cy', a.y.toFixed(1));
      const inCore = a.x > 18 && a.x < 78; a.el.style.opacity = !shroud && inCore ? 0.25 : 0.7;
    }
    // mandos: muestran el estado del motor (lo pueden cambiar las vistas del modelo)
    mCtl.set(on ? 'on' : 'off');
    if (!ui.drag) tCtl.set(Math.round(clamp(T, lo, hi)));
    oCtl.set(st.therm);
    hCtl.set(st.heat.temp >= 0.98 ? 'on' : st.heat.temp <= 0.02 ? 'off' : '');
    sCtl.set(shroud ? 'ok' : 'roto');
    // lectura
    const key = [on, Math.round(T), Math.round(r.lift * 2), vent, back, st.fail, r.gauge > 0.85, Math.round(r.Qhe * 5), Math.round(st.heat.temp * 20), st.therm].join('|');
    if (key === rdKey) return; rdKey = key;
    const [To, Tf] = CK.therm[st.therm];
    const state = !on ? 'motor detenido: la bomba no gira y el agua no circula'
      : r.lift < 0.05 ? `termostato cerrado (${T < To - 0.5 ? `abre a ${To} °C` : 'justo en su temperatura de apertura'}): el agua vuelve a la bomba por la derivación${valveOpen ? ' y la calefacción' : ''}${T < To - 0.5 ? ', y el motor se calienta rápido' : ''}`
      : r.lift < CK.lift - 0.05 ? `termostato abierto ${nf(r.lift, 1)} mm: parte del agua pasa por el radiador`
      : `termostato abierto del todo (desde ${Tf} °C): todo el caudal que puede pasa por el radiador`;
    const notes = [];
    if (vent) notes.push(`El agua se dilata: la tapa de ${nf(CK.capKg, 1)} kg/cm² deja pasar lo que sobra al depósito.`);
    if (back) notes.push('El agua se contrae: la válvula de vacío de la tapa la devuelve desde el depósito.');
    if (!shroud) notes.push('<b>Sin carenado</b>, el ventilador mueve aire alrededor del radiador y no a través del panal: el motor se recalienta en taco.');
    else if (st.fail !== 'ok') notes.push(`<b>Falla activa:</b> ${CFAILS[st.fail].name}.`);
    if (r.gauge > 0.85) notes.push('<b>Aguja cerca de H:</b> hay que detener el motor; con el motor caliente no se abre la tapa.');
    if (on && r.Qhe > 0.2) notes.push(`La calefacción saca ≈ ${nf(r.Qhe, 1)} kW del motor.`);
    else if (st.heat.temp > 0.02 && st.heat.temp < 0.98) notes.push(`Llave de la calefacción al ${nf(Math.round(st.heat.temp * 100))} %.`);
    rd.innerHTML = `<b>${nf(Math.round(T))} °C, ${state}.</b><span class="sub">${notes.join(' ')}</span>`;
  }
  frame(0.016);
  return { tick(dt) { frame(dt); } };
}
