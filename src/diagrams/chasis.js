import { s, svg, t, callout, clamp, lerp, h, range, readout } from '../svgkit.js';

export function chasis(root) {
  const st = { steer: 0, bump: 0 };
  // ═══ Dirección (vista superior, adelante arriba) ═══
  const f = svg(400, 236, 'Dirección de piñón y cremallera vista desde arriba');
  t(f, 200, 12, '↑ adelante', 'lbl lbl-xs', 'middle');
  const wheelG = s('g', {}, f);
  s('circle', { cx: 200, cy: 46, r: 30, class: 'swheel' }, wheelG); s('path', { d: 'M170,46 L230,46 M200,46 L200,76', class: 'spoke wide' }, wheelG);
  s('circle', { cx: 200, cy: 46, r: 6, class: 'axle' }, f);
  s('path', { d: 'M200,76 L200,114', class: 'shaft' }, f);
  s('rect', { x: 110, y: 112, width: 180, height: 16, rx: 6, class: 'rackhouse' }, f);
  const rack = s('g', {}, f);
  s('rect', { x: 96, y: 116, width: 208, height: 8, rx: 3, class: 'rack' }, rack);
  for (let x = 176; x < 226; x += 5) s('line', { x1: x, y1: 116, x2: x, y2: 120, class: 'gtooth' }, rack);
  const pin = s('g', {}, f); s('circle', { cx: 200, cy: 120, r: 8, class: 'pinion-g' }, pin); s('line', { x1: 200, y1: 113, x2: 200, y2: 127, class: 'spoke' }, pin);
  const KL = { x: 76, y: 176 }, KR = { x: 324, y: 176 };
  const tieL = s('path', { class: 'tierod' }, f), tieR = s('path', { class: 'tierod' }, f);
  const wl = s('g', {}, f), wr = s('g', {}, f);
  for (const [g, K] of [[wl, KL], [wr, KR]]) { s('rect', { x: K.x - 12, y: K.y - 32, width: 24, height: 64, rx: 7, class: 'tire' }, g); s('line', { x1: K.x, y1: K.y - 26, x2: K.x, y2: K.y + 26, class: 'stripe' }, g); }
  const armL = s('path', { class: 'link' }, f), armR = s('path', { class: 'link' }, f);
  s('circle', { cx: KL.x, cy: KL.y, r: 3.5, class: 'axle' }, f); s('circle', { cx: KR.x, cy: KR.y, r: 3.5, class: 'axle' }, f);
  s('path', { d: `M${KL.x},${KL.y} L${KR.x},${KR.y}`, class: 'axisline' }, f);
  const angT = t(f, 200, 228, '', 'lbl lbl-xs', 'middle');
  callout(f, 228, 52, 300, 40, 'Volante (casi horizontal)', 'start');
  callout(f, 208, 120, 300, 96, 'Piñón y cremallera', 'start');
  callout(f, 128, 136, 96, 92, 'Barra y terminal', 'end');
  t(f, 200, 192, 'eje de las ruedas delanteras', 'lbl lbl-xs', 'middle');

  // ═══ Suspensión ═══
  const g = svg(400, 232, 'Suspensión delantera McPherson y trasera de paquetes de resortes');
  t(g, 100, 14, 'Delantera McPherson (vista de frente)', 'lbl lbl-xs strong', 'middle');
  t(g, 306, 14, 'Trasera de resortes (vista lateral)', 'lbl lbl-xs strong', 'middle');
  s('line', { x1: 200, y1: 22, x2: 200, y2: 226, class: 'divider' }, g);
  // delantera
  s('rect', { x: 92, y: 24, width: 50, height: 8, rx: 2, class: 'bodymount' }, g);
  const tireF = s('rect', { x: 26, width: 26, height: 96, rx: 8, class: 'tire' }, g);
  const hubF = s('line', { x1: 52, x2: 64, class: 'shaft thin' }, g);
  const knuck = s('rect', { width: 14, height: 46, rx: 3, class: 'knuckle' }, g);
  const strut = s('path', { class: 'strut' }, g);
  const rodF = s('path', { class: 'shaft thin' }, g);
  const coil = s('path', { class: 'coilspring' }, g);
  const arm = s('path', { class: 'larm' }, g);
  s('circle', { cx: 170, cy: 196, r: 4, class: 'axle' }, g);
  const sway = s('path', { class: 'link' }, g);
  s('line', { x1: 0, y1: 222, x2: 196, y2: 222, class: 'ground' }, g);
  callout(g, 114, 28, 150, 46, 'Base del\namortiguador', 'start');
  callout(g, 104, 92, 150, 90, 'Espiral', 'start');
  callout(g, 92, 134, 150, 132, 'Amortiguador', 'start');
  callout(g, 130, 192, 150, 176, 'Bandeja', 'start');
  // trasera
  const tireR = s('circle', { r: 44, class: 'tire ghost' }, g);
  s('line', { x1: 214, y1: 44, x2: 398, y2: 44, class: 'frame' }, g);
  s('rect', { x: 234, y: 44, width: 10, height: 18, class: 'hanger' }, g);
  const leafs = [0, 1, 2, 3].map(() => s('path', { class: 'leaf' }, g));
  const axle = s('circle', { r: 10, class: 'axletube' }, g);
  const ubolt = s('path', { class: 'ubolt' }, g);
  const shackle = s('path', { class: 'shackle' }, g);
  const shock = s('path', { class: 'shock' }, g);
  s('line', { x1: 204, y1: 222, x2: 398, y2: 222, class: 'ground' }, g);
  callout(g, 239, 56, 214, 34, 'Ojo fijo', 'start');
  callout(g, 388, 58, 396, 30, 'Gemelo', 'end');
  t(g, 306, 216, 'Puente rígido sobre paquetes semielípticos', 'lbl lbl-xs', 'middle');

  const rdS = readout(), rdQ = readout();
  const sC = range({ label: 'Volante', min: -100, max: 100, step: 1, value: 0, fmt: v => v === 0 ? 'al centro' : (v < 0 ? 'izquierda ' : 'derecha ') + Math.abs(Math.round(v)) + ' %', oninput: v => st.steer = v / 100 });
  const bC = range({ label: 'Bache', min: -100, max: 100, step: 1, value: 0, fmt: v => v === 0 ? 'reposo' : v > 0 ? 'rueda sube ' + Math.round(v) + ' %' : 'rueda baja ' + Math.round(-v) + ' %', oninput: v => st.bump = v / 100 });
  root.append(
    h('h4', { class: 'subh' }, 'Dirección'), h('figure', { class: 'fig' }, f), rdS, h('div', { class: 'controls' }, sC),
    h('h4', { class: 'subh' }, 'Suspensión'), h('figure', { class: 'fig' }, g, h('figcaption', {}, 'Adelante, McPherson con espiral y barra estabilizadora (furgón). Atrás, puente rígido con paquetes de resortes y gemelo; los resortes también ubican el puente.')), rdQ, h('div', { class: 'controls' }, bC),
  );

  function frame() {
    // dirección: ángulo base y Ackermann (entre ejes 1,84 m, trocha 1,21 m)
    const s0 = st.steer;
    wheelG.setAttribute('transform', `rotate(${(s0 * 200).toFixed(1)} 200 46)`);
    pin.setAttribute('transform', `rotate(${(s0 * 540).toFixed(1)} 200 120)`);
    const dx = s0 * 26;
    rack.setAttribute('transform', `translate(${dx.toFixed(1)} 0)`);
    const base = s0 * 0.55; // rad, rueda interior
    let dL, dR;
    if (Math.abs(base) < 1e-4) { dL = dR = 0; } else {
      const inner = Math.abs(base), WB = 1.84, TR = 1.21;
      const outer = Math.atan(WB / (WB / Math.tan(inner) + TR));
      if (base > 0) { dR = inner; dL = outer; } else { dL = -inner; dR = -outer; }
    }
    // giro hacia la derecha = ruedas apuntan a la derecha (ángulo positivo en pantalla)
    wl.setAttribute('transform', `rotate(${(dL * 57.3).toFixed(1)} ${KL.x} ${KL.y})`);
    wr.setAttribute('transform', `rotate(${(dR * 57.3).toFixed(1)} ${KR.x} ${KR.y})`);
    const armEnd = (K, d, side) => { const ax = side * 22, ay = -34; const c = Math.cos(d), sn = Math.sin(d); return [K.x + ax * c - ay * sn, K.y + ax * sn + ay * c]; };
    const aL = armEnd(KL, dL, 1), aR = armEnd(KR, dR, -1);
    armL.setAttribute('d', `M${KL.x},${KL.y} L${aL[0]},${aL[1]}`); armR.setAttribute('d', `M${KR.x},${KR.y} L${aR[0]},${aR[1]}`);
    tieL.setAttribute('d', `M${96 + dx},120 L${aL[0]},${aL[1]}`); tieR.setAttribute('d', `M${304 + dx},120 L${aR[0]},${aR[1]}`);
    angT.textContent = s0 === 0 ? '' : 'La rueda interior gira más que la exterior (geometría de Ackermann)';
    rdS.innerHTML = s0 === 0 ? '<b>Volante al centro.</b> El piñón engrana en el centro de la cremallera.' :
      `<b>El piñón desplaza la cremallera hacia la ${s0 > 0 ? 'derecha' : 'izquierda'} y las ruedas giran a la ${s0 > 0 ? 'derecha' : 'izquierda'}.</b><span class="sub">El radio de giro medido en 1986 fue de unos 8,1 m entre veredas a la izquierda y mayor a la derecha.</span>`;
    // suspensión delantera
    const u = st.bump * 22;
    const ky = 128 - u;
    knuck.setAttribute('x', 64); knuck.setAttribute('y', ky);
    tireF.setAttribute('y', ky - 22); hubF.setAttribute('y1', ky + 26); hubF.setAttribute('y2', ky + 26);
    const topX = 116, topY = 32, botX = 76, botY = ky + 4;
    const len = Math.hypot(topX - botX, topY - botY);
    const ux = (topX - botX) / len, uy = (topY - botY) / len;
    const tubeTop = [botX + ux * 52, botY + uy * 52];
    strut.setAttribute('d', `M${botX},${botY} L${tubeTop[0]},${tubeTop[1]}`);
    rodF.setAttribute('d', `M${tubeTop[0]},${tubeTop[1]} L${topX},${topY}`);
    // espiral entre el platillo inferior (en el tubo) y la base
    const sp0 = [botX + ux * 46, botY + uy * 46], sp1 = [topX - ux * 6, topY - uy * 6];
    const n = 9, nx = -uy, ny = ux; let d = `M${sp0[0]},${sp0[1]}`;
    for (let i = 1; i <= n * 2; i++) { const k = i / (n * 2); const x = lerp(sp0[0], sp1[0], k), y = lerp(sp0[1], sp1[1], k); const w = (i % 2 ? 9 : -9); d += ` L${x + nx * w},${y + ny * w}`; }
    coil.setAttribute('d', d);
    arm.setAttribute('d', `M${72},${ky + 42} L170,196`);
    sway.setAttribute('d', `M140,${lerp(ky + 42, 196, 0.7) + 2} L140,${212}`);
    // trasera: el puente sube, los resortes se aplanan, el gemelo bascula
    // puente bajo el paquete: el centro del paquete descansa sobre el puente
    const camber = 20 - u * 0.75;            // curvatura del paquete (se aplana al subir la rueda)
    const yC = 62 + camber;                  // centro del paquete
    const axY = yC + 12;                     // centro del puente (y de la rueda)
    tireR.setAttribute('cx', 306); tireR.setAttribute('cy', axY);
    axle.setAttribute('cx', 306); axle.setAttribute('cy', axY);
    const rearX = 380 + (20 - camber) * 0.35, rearY = 68;  // ojo del gemelo: se desplaza al alargarse el paquete
    const P0 = [240, 62], P2 = [rearX, rearY], P1 = [306, 2 * yC - (P0[1] + P2[1]) / 2];
    const bez = (k) => [(1 - k) * (1 - k) * P0[0] + 2 * (1 - k) * k * P1[0] + k * k * P2[0], (1 - k) * (1 - k) * P0[1] + 2 * (1 - k) * k * P1[1] + k * k * P2[1]];
    leafs.forEach((lf, i) => { const half = 0.5 - i * 0.1; let d = ''; for (let j = 0; j <= 16; j++) { const k = 0.5 - half + (2 * half) * j / 16; const [x, y] = bez(k); d += (j ? 'L' : 'M') + x.toFixed(1) + ',' + (y + i * 3.6).toFixed(1); } lf.setAttribute('d', d); });
    ubolt.setAttribute('d', `M298,${yC - 4} L298,${axY + 10} M314,${yC - 4} L314,${axY + 10}`);
    shackle.setAttribute('d', `M388,48 L${rearX},${rearY}`);
    shock.setAttribute('d', `M294,${axY} L262,48`);
    rdQ.innerHTML = st.bump === 0 ? '<b>Reposo.</b> El peso comprime el espiral delantero y curva los paquetes traseros.' :
      st.bump > 0 ? '<b>La rueda sube:</b> adelante se comprime el espiral y la bandeja gira en su pivote; atrás el paquete se aplana, se alarga y el gemelo bascula para absorber ese largo extra.' :
      '<b>La rueda baja:</b> el espiral se extiende y el paquete trasero recupera su curva. Los amortiguadores frenan estos movimientos para que el furgón no rebote.';
  }
  frame();
  return { tick() { frame(); } };
}
