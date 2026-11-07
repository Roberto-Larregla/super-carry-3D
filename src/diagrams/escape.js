import { s, svg, t, callout, clamp, lerp, h, range, seg, readout } from '../svgkit.js';

const ORDER = [0, 2, 3, 1]; // índices de cilindro 1,3,4,2
export function escape(root) {
  const st = { rpm: 900, hot: true, rich: false, ph: 0 };
  const f = svg(400, 232, 'Sistema de escape con múltiple, catalizador y silenciador');
  const runnerX = [26, 56, 86, 116];
  const runners = runnerX.map(x => `M${x},14 C${x},60 ${lerp(x, 76, 0.6)},80 76,104`);
  runners.forEach((d, i) => { s('path', { d, class: 'exh-pipe' }, f); t(f, runnerX[i], 10, String(i + 1), 'lbl lbl-xs strong', 'middle'); });
  const main = 'M76,104 L76,140 Q76,150 90,150 L146,150 M238,150 L270,150 M372,150 L398,150';
  s('path', { d: 'M76,104 L76,140 Q76,150 90,150 L398,150', class: 'exh-pipe' }, f);
  // catalizador
  s('rect', { x: 146, y: 122, width: 92, height: 56, rx: 18, class: 'cat' }, f);
  const mono = s('g', { class: 'mono' }, f);
  for (let x = 160; x < 228; x += 8) for (let y = 132; y < 172; y += 8) s('rect', { x, y, width: 6, height: 6, class: 'cell' }, mono);
  // sensor O2
  s('rect', { x: 104, y: 132, width: 8, height: 14, rx: 2, class: 'o2' }, f);
  // silenciador
  s('rect', { x: 270, y: 120, width: 102, height: 60, rx: 22, class: 'muffler' }, f);
  s('path', { d: 'M282,136 L360,136 M282,164 L360,164 M300,124 L300,176 M340,124 L340,176', class: 'baffle' }, f);
  for (let x = 286; x < 358; x += 8) { s('circle', { cx: x, cy: 136, r: 1.4, class: 'perf' }, f); s('circle', { cx: x + 4, cy: 164, r: 1.4, class: 'perf' }, f); }
  // partículas de gases
  const mol = [];
  const path = s('path', { d: 'M76,104 L76,140 Q76,150 90,150 L398,150', class: 'none' }, f);
  const runnerEls = runners.map(d => s('path', { d, class: 'none' }, f));
  for (let i = 0; i < 70; i++) mol.push({ alive: false, el: s('circle', { r: 2.3, class: 'm-co' }, f) });
  // etiquetas
  callout(f, 50, 40, 140, 26, 'Múltiple de escape (4 tubos)', 'start');
  callout(f, 108, 146, 58, 192, 'Sensor O₂ (original)', 'middle');
  callout(f, 192, 178, 192, 204, 'Catalizador: monolito\ncerámico con metales nobles', 'middle');
  callout(f, 321, 180, 330, 204, 'Silenciador', 'middle');
  t(f, 398, 172, 'cola →', 'lbl lbl-xs', 'end');

  const chem = svg(400, 80, 'Reacciones en el catalizador');
  const rows = [['2 CO + O₂', '2 CO₂', 'monóxido de carbono → dióxido de carbono'], ['HC + O₂', 'CO₂ + H₂O', 'hidrocarburos sin quemar → CO₂ y vapor de agua']];
  rows.forEach((r, i) => { const y = 24 + i * 32; t(chem, 14, y, r[0], 'chem'); t(chem, 110, y, '→', 'chem'); t(chem, 132, y, r[1], 'chem'); t(chem, 14, y + 13, r[2], 'lbl lbl-xs'); });
  const chemNote = t(chem, 386, 24, '', 'lbl lbl-xs strong', 'end');

  const legend = h('div', { class: 'legend' },
    h('span', { class: 'key' }, h('i', { class: 'sw co' }), 'CO / HC (contaminantes)'),
    h('span', { class: 'key' }, h('i', { class: 'sw co2' }), 'CO₂ / H₂O'),
    h('span', { class: 'key' }, h('i', { class: 'sw o2' }), 'O₂ sobrante'));
  const rd = readout();
  const rpmC = range({ label: 'Régimen', min: 800, max: 5000, step: 50, value: 900, fmt: v => Math.round(v) + ' rpm', oninput: v => st.rpm = v });
  const hotC = seg({ label: 'Catalizador', options: [{ v: 'hot', t: 'Caliente' }, { v: 'cold', t: 'Frío (recién partido)' }], value: 'hot', onchange: v => st.hot = v === 'hot' });
  const richC = seg({ label: 'Mezcla', options: [{ v: 'ok', t: 'Bien ajustada' }, { v: 'rich', t: 'Rica' }], value: 'ok', onchange: v => st.rich = v === 'rich' });
  root.append(
    h('figure', { class: 'fig' }, f, legend, h('figcaption', {}, 'Los pulsos de gases salen de cada cilindro en orden 1-3-4-2. El múltiple y el tubo son de doble puerto (manual): los cilindros 1 y 4 por un conducto y el 2 y 3 por otro, para que el pulso de uno no frene la salida del siguiente. Las posiciones del catalizador y del silenciador bajo el piso son aproximadas.')),
    rd, h('div', { class: 'controls' }, rpmC, hotC, richC),
    h('figure', { class: 'fig slim' }, chem, h('figcaption', {}, 'Un catalizador de dos vías (como describe Wikipedia al Super Carry chileno) oxida CO y HC; necesita oxígeno sobrante y temperatura, que suele alcanzar unos 250–300 °C (valor general).')),
  );

  let acc = 0, k = 0;
  function frame(dt) {
    const pulsesPerSec = clamp(st.rpm / 60 / 2 * 4 / 6, 1.5, 9); // en cámara lenta
    acc += dt * pulsesPerSec;
    while (acc > 1) {
      acc -= 1; const cyl = ORDER[k++ % 4];
      const n = st.rich ? 7 : 5;
      for (let i = 0; i < n; i++) {
        const m = mol.find(q => !q.alive); if (!m) break;
        m.alive = true; m.stage = 0; m.u = -i * 0.025; m.cyl = cyl;
        const r = Math.random(); m.type = st.rich ? (r < 0.75 ? 'co' : 'n2') : (r < 0.45 ? 'co' : r < 0.75 ? 'o2' : 'n2');
        m.y0 = (Math.random() - 0.5) * 14;
      }
    }
    const conv = st.hot;
    let o2Left = 0, coLeft = 0, conv1 = 0;
    for (const m of mol) {
      if (!m.alive) { m.el.style.opacity = 0; continue; }
      m.u += dt * (st.rpm / 900 * 0.35 + 0.25);
      let x, y;
      if (m.stage === 0) {
        const el = runnerEls[m.cyl], L = el.getTotalLength();
        if (m.u < 0) { m.el.style.opacity = 0; continue; }
        if (m.u >= 1) { m.stage = 1; m.u = 0; }
        const p = el.getPointAtLength(clamp(m.u, 0, 1) * L); x = p.x; y = p.y;
      } else {
        const L = path.getTotalLength();
        if (m.u >= 1) { m.alive = false; m.el.style.opacity = 0; continue; }
        const p = path.getPointAtLength(m.u * L); x = p.x; y = p.y + (p.x > 90 ? m.y0 : 0);
        if (p.x > 150 && p.x < 234 && conv && m.type === 'co' && !m.done) {
          // convertir si queda oxígeno disponible
          if (!st.rich || Math.random() < 0.35) { m.type = 'co2'; } m.done = true;
        }
        if (p.x > 240) { if (m.type === 'co') coLeft++; if (m.type === 'o2') o2Left++; if (m.type === 'co2') conv1++; }
      }
      m.el.setAttribute('cx', x.toFixed(1)); m.el.setAttribute('cy', y.toFixed(1));
      m.el.setAttribute('class', 'm-' + m.type); m.el.style.opacity = 1;
    }
    mol.forEach(m => { if (!m.alive) m.done = false; });
    f.classList.toggle('cat-hot', st.hot);
    chemNote.textContent = st.hot ? (st.rich ? 'falta O₂: conversión parcial' : 'convirtiendo') : 'frío: casi sin conversión';
    rd.innerHTML = `<b>${st.hot ? (st.rich ? 'Mezcla rica: el catalizador no tiene oxígeno suficiente.' : 'Catalizador caliente y mezcla correcta: CO y HC se oxidan.') : 'Catalizador frío: los gases pasan casi sin tratar.'}</b>` +
      `<span class="sub">${st.rich ? 'Con el carburador no catalítico la mezcla depende sólo del ajuste: si queda rica, el catalizador se recalienta, puede taparse y aumentan CO y HC en la revisión técnica. ' : ''}${!st.hot ? 'Los trayectos cortos en ciudad hacen que el catalizador pase mucho tiempo frío. ' : ''}El motor va bajo los asientos: cualquier fuga antes del silenciador puede meter monóxido en la cabina.</span>`;
  }
  frame(0.016);
  return { tick(dt) { frame(dt); } };
}
