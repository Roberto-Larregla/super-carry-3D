import { s, svg, t, callout, clamp, lerp, rad, h, range, seg, button, readout } from '../svgkit.js';

export function combustible(root) {
  const st = { T: 4, choke: false, contact: true, mode: 'actual', squirt: 0, level: 0 };

  // ═══ Recorrido de la bencina ═══
  const f0 = svg(400, 92, 'Recorrido de la bencina desde el estanque al carburador');
  const boxes = [
    { x: 8, w: 84, t1: 'Estanque', t2: '37 L, bajo el piso' },
    { x: 112, w: 70, t1: 'Filtro', t2: 'cartucho' },
    { x: 202, w: 92, t1: 'Bomba eléctrica', t2: 'larguero derecho' },
    { x: 306, w: 86, t1: 'Carburador', t2: 'cuba con flotador' },
  ];
  boxes.forEach(b => { s('rect', { x: b.x, y: 18, width: b.w, height: 46, rx: 6, class: 'node' }, f0); t(f0, b.x + b.w / 2, 38, b.t1, 'lbl strong', 'middle'); t(f0, b.x + b.w / 2, 53, b.t2, 'lbl lbl-xs', 'middle'); });
  const fl0 = [];
  for (let i = 0; i < 3; i++) { const x0 = boxes[i].x + boxes[i].w, x1 = boxes[i + 1].x; s('path', { d: `M${x0},41 L${x1},41`, class: 'pipe fuel-pipe' }, f0); fl0.push(s('path', { d: `M${x0},41 L${x1},41`, class: 'flow fuel', 'stroke-dasharray': '4 6' }, f0)); }
  t(f0, 200, 82, 'La cuba mantiene el nivel: la aguja deja entrar sólo lo que se consume.', 'lbl lbl-xs', 'middle');

  // ═══ Carburador en corte ═══
  const f = svg(400, 410, 'Carburador monocuerpo en corte con sus circuitos');
  // cuerpo
  s('path', { d: 'M150,24 L150,330 L250,330 L250,24 Z', class: 'metal-alu' }, f);
  s('rect', { x: 26, y: 138, width: 104, height: 162, rx: 6, class: 'metal-alu' }, f); // cuba
  s('rect', { x: 256, y: 186, width: 52, height: 60, rx: 6, class: 'metal-alu' }, f); // bomba
  // conducto de aire (venturi)
  const bore = 'M160,24 C160,60 168,80 166,92 C166,118 182,134 182,146 C182,160 168,182 168,206 L168,330 L232,330 L232,206 C232,182 218,160 218,146 C218,134 234,118 234,92 C232,80 240,60 240,24 Z';
  s('path', { d: bore, class: 'bore' }, f);
  // cuba: bencina
  const fuelBowl = s('rect', { x: 30, y: 182, width: 96, height: 114, class: 'fuel-fill' }, f);
  const floatG = s('g', {}, f);
  s('rect', { x: 44, y: 172, width: 56, height: 22, rx: 9, class: 'float' }, floatG);
  s('path', { d: 'M100,183 L114,166', class: 'stem' }, floatG);
  s('circle', { cx: 114, cy: 166, r: 3, class: 'axle' }, f);
  const needle = s('path', { class: 'needle' }, f);
  s('path', { d: 'M4,128 L92,128 L92,142', class: 'pipe fuel-pipe' }, f);
  const inletFlow = s('path', { d: 'M4,128 L92,128 L92,142', class: 'flow fuel', 'stroke-dasharray': '4 6' }, f);
  // circuito principal: chicler principal → pozo emulsor → surtidor en el venturi
  s('path', { d: 'M100,292 L138,292 L138,152 L192,148', class: 'pass' }, f);
  const mainFlow = s('path', { d: 'M100,292 L138,292 L138,152 L192,148', class: 'flow fuel', 'stroke-dasharray': '3 5' }, f);
  s('rect', { x: 94, y: 286, width: 12, height: 12, rx: 2, class: 'jet' }, f);
  s('rect', { x: 133, y: 118, width: 10, height: 10, rx: 2, class: 'jet air' }, f);
  s('path', { d: 'M138,128 L138,152', class: 'pass air' }, f);
  // enriquecedor (válvula de potencia)
  s('path', { d: 'M74,296 L74,306 L118,306 L118,292', class: 'pass' }, f);
  const pvFlow = s('path', { d: 'M74,296 L74,306 L118,306 L118,292', class: 'flow fuel', 'stroke-dasharray': '3 5' }, f);
  const pv = s('rect', { x: 68, y: 288, width: 12, height: 10, rx: 2, class: 'valvebox' }, f);
  // circuito de ralentí: desde el pozo → chicler de ralentí (con solenoide) → bajada al orificio bajo la mariposa
  s('path', { d: 'M138,232 L160,232 L160,276 L168,276', class: 'pass' }, f);
  s('path', { d: 'M160,252 L168,252 M160,244 L168,244', class: 'pass' }, f);
  const idleFlow = s('path', { d: 'M138,232 L160,232 L160,276 L168,276', class: 'flow fuel', 'stroke-dasharray': '3 4' }, f);
  const progFlow = s('path', { d: 'M160,252 L168,252 M160,244 L168,244', class: 'flow fuel', 'stroke-dasharray': '2 3' }, f);
  const sol = s('g', {}, f);
  s('rect', { x: 143, y: 238, width: 16, height: 22, rx: 3, class: 'solenoid' }, sol);
  const plunger = s('rect', { x: 148, y: 230, width: 6, height: 9, rx: 1.5, class: 'plunger' }, f);
  s('path', { d: 'M150,282 L163,278', class: 'screw-line' }, f);
  // bomba de aceleración
  s('path', { d: 'M40,300 L40,318 L282,318 L282,246', class: 'pass' }, f);
  s('path', { d: 'M282,186 L282,104 L240,104', class: 'pass' }, f);
  const pumpFlow = s('path', { d: 'M282,186 L282,104 L240,104', class: 'flow fuel', 'stroke-dasharray': '3 3' }, f);
  const diaph = s('path', { class: 'diaph' }, f);
  s('circle', { cx: 282, cy: 150, r: 4, class: 'check' }, f);
  const pumpLink = s('path', { class: 'link' }, f);
  // mariposas
  const choke = s('line', { class: 'plate' }, f); s('circle', { cx: 200, cy: 52, r: 3.2, class: 'axle' }, f);
  const thr = s('line', { class: 'plate' }, f); s('circle', { cx: 200, cy: 262, r: 3.2, class: 'axle' }, f);
  // partículas de aire y de bencina
  const air = [];
  for (let i = 0; i < 34; i++) air.push({ y: 20 + Math.random() * 320, l: Math.random() * 2 - 1, el: s('circle', { r: 1.6, class: 'p-air' }, f) });
  const drops = [];
  for (let i = 0; i < 46; i++) drops.push({ alive: false, x: 0, y: 0, vx: 0, vy: 0, el: s('circle', { r: 1.7, class: 'p-fuel', style: 'opacity:0' }, f) });
  // etiquetas
  t(f, 200, 16, 'Aire desde el filtro', 'lbl lbl-s', 'middle');
  callout(f, 225, 50, 262, 40, 'Mariposa del cebador\n(cable, manual)');
  callout(f, 218, 146, 262, 132, 'Venturi: el aire acelera\ny su presión baja');
  callout(f, 190, 148, 262, 80, 'Surtidor principal', 'start');
  callout(f, 230, 266, 262, 290, 'Mariposa de aceleración');
  callout(f, 282, 212, 386, 172, 'Bomba de\naceleración', 'end');
  callout(f, 138, 123, 14, 104, 'Chicler de aire (emulsión)');
  callout(f, 92, 138, 14, 62, 'Entrada de bencina\n(aguja y asiento)');
  t(f, 72, 187, 'Flotador', 'lbl lbl-xs on-fill', 'middle');
  const solLbl = callout(f, 151, 256, 14, 366, 'Solenoide de corte del ralentí');
  callout(f, 100, 294, 14, 384, 'Chicler principal');
  callout(f, 74, 296, 14, 402, 'Enriquecedor: abre con poco vacío');
  callout(f, 166, 247, 386, 366, 'Orificios de progresión', 'end');
  callout(f, 166, 276, 386, 386, 'Orificio de ralentí y\ntornillo de mezcla', 'end');
  t(f, 200, 345, '↓ al múltiple de admisión → 4 cilindros', 'lbl lbl-s', 'middle');

  // ═══ Lazo de control original ═══
  const f2 = svg(400, 132, 'Control de mezcla de la versión catalítica original');
  const n2 = [
    { x: 10, y: 14, w: 92, t1: 'Sensor O₂', t2: 'en el escape' },
    { x: 154, y: 14, w: 92, t1: 'Controlador', t2: '33920-85720' },
    { x: 298, y: 14, w: 92, t1: 'Solenoide', t2: 'del carburador' },
    { x: 154, y: 82, w: 92, t1: 'Interruptor', t2: 'temp. de agua' },
  ];
  n2.forEach(b => { s('rect', { x: b.x, y: b.y, width: b.w, height: 38, rx: 6, class: 'node' }, f2); t(f2, b.x + b.w / 2, b.y + 17, b.t1, 'lbl lbl-s strong', 'middle'); t(f2, b.x + b.w / 2, b.y + 30, b.t2, 'lbl lbl-xs', 'middle'); });
  const loopFlows = [
    s('path', { d: 'M102,33 L154,33', class: 'flow elec', 'stroke-dasharray': '4 5' }, f2),
    s('path', { d: 'M246,33 L298,33', class: 'flow elec', 'stroke-dasharray': '4 5' }, f2),
    s('path', { d: 'M200,82 L200,52', class: 'flow elec', 'stroke-dasharray': '4 5' }, f2),
    s('path', { d: 'M344,52 L344,104 L262,104', class: 'flow exh', 'stroke-dasharray': '2 6' }, f2),
    s('path', { d: 'M138,104 L56,104 L56,52', class: 'flow exh', 'stroke-dasharray': '2 6' }, f2),
  ];
  t(f2, 300, 122, 'mezcla → motor → gases', 'lbl lbl-xs', 'middle');
  const loopNote = t(f2, 100, 122, '', 'lbl lbl-xs strong', 'middle');
  const o2 = s('rect', { x: 14, y: 56, width: 0, height: 6, rx: 2, class: 'o2bar' }, f2);

  // ═══ Indicador de mezcla ═══
  const f3 = svg(400, 56, 'Indicador de mezcla');
  const gx0 = 40, gx1 = 360;
  s('rect', { x: gx0, y: 22, width: gx1 - gx0, height: 10, rx: 5, class: 'mixbar' }, f3);
  t(f3, gx0, 48, 'Pobre', 'lbl lbl-xs'); t(f3, 200, 48, 'Correcta', 'lbl lbl-xs', 'middle'); t(f3, gx1, 48, 'Rica', 'lbl lbl-xs', 'end');
  t(f3, 40, 13, 'Mezcla (cualitativa)', 'lbl lbl-xs');
  const mixNeedle = s('path', { class: 'mixneedle' }, f3);

  // ═══ Controles ═══
  const rd = readout();
  const thrCtl = range({ label: 'Acelerador', min: 0, max: 100, step: 1, value: st.T, fmt: v => Math.round(v) + ' %', oninput: v => st.T = v });
  const chokeCtl = seg({ label: 'Cebador', options: [{ v: 'off', t: 'Abierto' }, { v: 'on', t: 'Tirado' }], value: 'off', onchange: v => st.choke = v === 'on' });
  const contactCtl = seg({ label: 'Contacto', options: [{ v: 'on', t: 'Puesto' }, { v: 'off', t: 'Apagado' }], value: 'on', onchange: v => st.contact = v === 'on' });
  const modeCtl = seg({ label: 'Carburador', options: [{ v: 'actual', t: 'Actual: no catalítico' }, { v: 'orig', t: 'Original: catalítico' }], value: 'actual', onchange: v => { st.mode = v; } });
  const kick = button('Pisar a fondo de golpe', () => { st.squirt = 0.9; st.T = Math.max(st.T, 88); thrCtl.set(st.T); });
  const back = button('Soltar', () => { st.T = 3; thrCtl.set(3); });
  root.append(
    h('figure', { class: 'fig' }, f0),
    h('figure', { class: 'fig' }, f, h('figcaption', {}, 'Esquema de un carburador monocuerpo dibujado en vertical para que se lean sus circuitos. El de este motor (Mikuni, según el manual) es de tiro horizontal: el venturi va acostado, el aire baja del filtro por un codo y entra de costado, y la mezcla sale de lado al múltiple. Los chicleres tienen orificios calibrados: cualquier suciedad cambia la mezcla.')),
    h('figure', { class: 'fig slim' }, f3),
    rd,
    h('div', { class: 'controls' }, thrCtl, h('div', { class: 'ctl btnrow' }, kick, back), chokeCtl, contactCtl, modeCtl),
    h('figure', { class: 'fig' }, f2, h('figcaption', {}, 'Así funcionaba el sistema de fábrica chileno con catalizador (piezas confirmadas en el catálogo de repuestos). Con el carburador no catalítico la mezcla ya no se corrige sola: depende de los chicleres y del ajuste del tornillo de mezcla.')),
  );

  const halfW = y => y < 92 ? lerp(40, 34, (y - 24) / 68) : y < 146 ? lerp(34, 18, (y - 92) / 54) : y < 206 ? lerp(18, 32, (y - 146) / 60) : 32;
  let time = 0;
  function spawn(x, y, vx, vy, n) { for (let i = 0; i < n; i++) { const d = drops.find(q => !q.alive); if (!d) return; d.alive = true; d.x = x; d.y = y; d.vx = vx + (Math.random() - 0.5) * 18; d.vy = vy + Math.random() * 20; d.life = 0; } }

  function frame(dt) {
    time += dt;
    const T = st.T / 100;
    const thrAng = lerp(10, 88, Math.pow(T, 0.8));
    const chokeAng = st.choke ? 12 : 90;
    const flowAir = clamp(Math.pow(T, 0.9) * (st.choke ? 0.45 : 1) + 0.06, 0, 1);
    const running = st.contact;
    const idleOn = running && T < 0.3;
    const progOn = running && T > 0.06 && T < 0.35;
    const mainOn = running && (T > 0.18 || st.choke);
    const powerOn = running && T > 0.75;
    const pumpOn = st.squirt > 0;
    const vac = 1 - T; // vacío del múltiple (cualitativo)
    // mariposas
    const tc = Math.cos(rad(thrAng)) * 31, ts = Math.sin(rad(thrAng)) * 31;
    thr.setAttribute('x1', 200 - tc); thr.setAttribute('y1', 262 - ts); thr.setAttribute('x2', 200 + tc); thr.setAttribute('y2', 262 + ts);
    const cc = Math.cos(rad(chokeAng)) * 36, cs = Math.sin(rad(chokeAng)) * 36;
    choke.setAttribute('x1', 200 - cc); choke.setAttribute('y1', 52 + cs); choke.setAttribute('x2', 200 + cc); choke.setAttribute('y2', 52 - cs);
    // nivel de cuba y aguja
    const use = running ? (mainOn ? 0.3 + T * 0.7 : 0.15) : 0;
    st.level = lerp(st.level, use, Math.min(1, dt * 2));
    const lvl = 182 + st.level * 8;
    fuelBowl.setAttribute('y', lvl); fuelBowl.setAttribute('height', 296 - lvl);
    floatG.setAttribute('transform', `rotate(${(st.level * -6).toFixed(2)} 114 166)`);
    const nOpen = st.level * 6;
    needle.setAttribute('d', `M88,${132 + nOpen} L96,${132 + nOpen} L92,${142 + nOpen} Z`);
    // solenoide
    sol.setAttribute('class', 'sol ' + (running ? 'on' : 'off'));
    plunger.setAttribute('y', running ? 238 : 228);
    // bomba de aceleración
    st.squirt = Math.max(0, st.squirt - dt);
    const dpush = pumpOn ? 10 : 0;
    diaph.setAttribute('d', `M260,${236 - dpush} Q282,${226 - dpush * 1.5} 304,${236 - dpush}`);
    pumpLink.setAttribute('d', `M${200 + tc * 0.6},${262 + ts * 0.6} L282,${244 - dpush}`);
    // flujos de bencina
    const fl = (p, on, sp) => { p.style.opacity = on ? 1 : 0.12; if (on) { p._o = ((p._o || 0) - sp * dt) % 100; p.setAttribute('stroke-dashoffset', p._o.toFixed(1)); } };
    fl(mainFlow, mainOn, 20 + T * 40); fl(idleFlow, idleOn, 14); fl(progFlow, progOn, 16); fl(pvFlow, powerOn, 30); fl(pumpFlow, pumpOn, 80);
    fl(inletFlow, running && st.level > 0.05, 10 + st.level * 40);
    fl0.forEach(p => fl(p, running, 20));
    pv.setAttribute('class', 'valvebox ' + (powerOn ? 'open' : ''));
    // aire
    const vAir = 40 + flowAir * 260;
    for (const a of air) {
      a.y += vAir * dt * (a.y > 120 && a.y < 175 ? 1.6 : 1);
      if (a.y > 344) { a.y = 20; a.l = Math.random() * 2 - 1; }
      let x = 200 + a.l * halfW(a.y) * 0.85;
      if (a.y > 250 && a.y < 274) { const gap = Math.max(0.12, Math.cos(rad(thrAng))); x = 200 + Math.sign(a.l || 1) * (halfW(a.y) * 0.85 - (1 - gap) * 4) * Math.max(Math.abs(a.l), 1 - (1 - Math.sin(rad(thrAng))) * 0.2); }
      a.el.setAttribute('cx', x.toFixed(1)); a.el.setAttribute('cy', a.y.toFixed(1));
      a.el.style.opacity = 0.25 + flowAir * 0.65;
    }
    // gotas
    if (mainOn && Math.random() < dt * (12 + T * 50)) spawn(193, 148, -40 + Math.random() * 20, vAir * 0.8, 1);
    if (idleOn && Math.random() < dt * 10) spawn(169, 276, 30, 40 + vAir * 0.3, 1);
    if (progOn && Math.random() < dt * 8) spawn(169, 248, 25, 40 + vAir * 0.3, 1);
    if (pumpOn && Math.random() < dt * 90) spawn(238, 104, -110, 70, 2);
    if (st.choke && running && Math.random() < dt * 25) spawn(193, 148, -30, vAir * 0.9, 1);
    for (const d of drops) {
      if (!d.alive) { d.el.style.opacity = 0; continue; }
      d.life += dt; d.vy += 220 * dt; d.vx *= 0.97; d.x += d.vx * dt; d.y += d.vy * dt;
      const hw = halfW(d.y) * 0.9; d.x = clamp(d.x, 200 - hw, 200 + hw);
      if (d.y > 345 || d.life > 2.5) { d.alive = false; d.el.style.opacity = 0; continue; }
      d.el.setAttribute('cx', d.x.toFixed(1)); d.el.setAttribute('cy', d.y.toFixed(1)); d.el.style.opacity = 0.95;
    }
    // modo original / actual
    const orig = st.mode === 'orig';
    solLbl.querySelector('text').textContent = orig ? 'Solenoide (lo gobernaba el controlador)' : 'Solenoide de corte del ralentí';
    f2.classList.toggle('dim', !orig);
    loopFlows.forEach(p => fl(p, orig && running, 22));
    const o2v = orig && running ? 0.5 + 0.4 * Math.sin(time * 5) : 0;
    o2.setAttribute('width', (o2v * 84).toFixed(1));
    loopNote.textContent = orig ? (running ? 'señal O₂ oscilando: rica ↔ pobre' : 'contacto apagado') : 'hoy: sin función';
    // mezcla
    let rich = 0;
    if (!running) rich = 0;
    else {
      if (idleOn && !progOn) rich = 0.25; else if (progOn) rich = 0.05; else rich = -0.12;
      if (powerOn) rich = 0.48;
      if (st.choke) rich = Math.max(rich, 0.82);
      if (pumpOn) rich = Math.max(rich, 0.6);
      if (orig && !st.choke && !powerOn) rich = 0.08 * Math.sin(time * 5);
    }
    const mx = 200 + rich * 150;
    mixNeedle.setAttribute('d', `M${mx},18 l-6,-9 l12,0 Z M${mx},20 L${mx},36`);
    mixNeedle.style.opacity = running ? 1 : 0.2;
    // lectura
    const circ = [];
    if (!running) circ.push('Contacto apagado: el solenoide cierra el ralentí y el motor se detiene sin autoencendido');
    else {
      if (idleOn) circ.push('ralentí');
      if (progOn) circ.push('progresión');
      if (mainOn) circ.push('principal');
      if (powerOn) circ.push('enriquecedor (poco vacío)');
      if (pumpOn) circ.push('bomba de aceleración');
      if (st.choke) circ.push('cebador (mezcla muy rica para partir en frío)');
    }
    rd.innerHTML = running ? `<b>Circuitos activos:</b> ${circ.join(' + ')}.<span class="sub">Vacío en el múltiple: ${vac > 0.7 ? 'alto' : vac > 0.3 ? 'medio' : 'bajo'} · Mariposa ${Math.round(st.T)} % · ${orig ? 'El controlador corrige la mezcla con la señal del sensor de oxígeno.' : 'Mezcla fija por chicleres y tornillo de mezcla.'}</span>` : `<b>${circ[0]}.</b><span class="sub">El solenoide necesita 12 V con el contacto puesto: si no llegan, el motor acelera pero se apaga al soltar el pedal.</span>`;
  }
  frame(0.016);
  return { tick(dt) { frame(dt); } };
}
