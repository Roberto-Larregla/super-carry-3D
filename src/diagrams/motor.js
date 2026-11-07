import { s, svg, t, callout, clamp, rad, pol, gear, h, range, seg, button, readout } from '../svgkit.js';

const PHASES = [
  { k: 'ADM', n: 'Admisión', c: 'var(--ph-adm)', d: 'El pistón baja con la válvula de admisión abierta y aspira mezcla de aire y bencina desde el carburador.' },
  { k: 'COMP', n: 'Compresión', c: 'var(--ph-comp)', d: 'Ambas válvulas cerradas: el pistón sube y comprime la mezcla 8,8 veces. 8° antes del punto muerto superior salta la chispa.' },
  { k: 'EXP', n: 'Explosión', c: 'var(--ph-exp)', d: 'La mezcla se quema, la presión empuja el pistón hacia abajo: es el único tiempo que entrega fuerza al cigüeñal.' },
  { k: 'ESC', n: 'Escape', c: 'var(--ph-esc)', d: 'Se abre la válvula de escape y el pistón, al subir, expulsa los gases quemados hacia el múltiple.' },
];
const OFF = [0, 540, 180, 360]; // cilindros 1..4 → orden 1-3-4-2
// alzada de válvulas (0..1) según ángulo de ciclo φ (0 = PMS al inicio de la admisión). Cotas ilustrativas.
function lift(phi, open, dur) { const d = ((phi - open) % 720 + 720) % 720; return d < dur ? Math.sin(Math.PI * d / dur) : 0; }
const inLift = phi => lift(phi, 705, 240);  // abre un poco antes del PMS y cierra después del PMI (ilustrativo)
const exLift = phi => lift(phi, 495, 240);
const phaseOf = phi => Math.floor(((phi % 720) + 720) % 720 / 180);

export function motor(root) {
  let theta = 300, playing = !matchMedia('(prefers-reduced-motion: reduce)').matches, speed = 120;

  // ═══ Figura 1: corte de un cilindro ═══
  const f1 = svg(400, 392, 'Corte de un cilindro del motor F10A con válvulas, balancines, pistón, biela y cigüeñal');
  const C = { x: 200, y: 318 }, RC = 44, LR = 141;
  // block y camisas de agua
  s('rect', { x: 138, y: 100, width: 124, height: 150, rx: 4, class: 'metal-iron' }, f1);
  s('rect', { x: 143, y: 106, width: 11, height: 96, rx: 3, class: 'water' }, f1);
  s('rect', { x: 246, y: 106, width: 11, height: 96, rx: 3, class: 'water' }, f1);
  s('rect', { x: 158, y: 100, width: 84, height: 150, class: 'bore' }, f1);
  // cárter (silueta)
  s('path', { d: 'M138,250 L138,262 Q140,290 150,300 L150,378 L250,378 L250,300 Q260,290 262,262 L262,250', class: 'metal-outline' }, f1);
  // culata
  s('path', { d: 'M126,100 L126,60 Q126,54 132,54 L268,54 Q274,54 274,60 L274,100 Z', class: 'metal-alu' }, f1);
  s('path', { d: 'M14,58 L118,62 L168,86 L176,99 L190,99 L182,88 L124,78 L14,76 Z', class: 'port' }, f1);
  s('path', { d: 'M386,58 L282,62 L232,86 L224,99 L210,99 L218,88 L276,78 L386,76 Z', class: 'port' }, f1);
  const pathIn = s('path', { d: 'M14,67 L120,70 L170,89 L183,99', class: 'none' }, f1);
  const pathEx = s('path', { d: 'M217,99 L230,89 L280,70 L386,67', class: 'none' }, f1);
  const gas = s('path', { class: 'gas' }, f1);
  s('path', { d: 'M158,100 Q200,86 242,100', class: 'roof' }, f1);
  // partículas de admisión y escape
  const pin = [], pex = [];
  for (let i = 0; i < 9; i++) { pin.push({ u: i / 9, el: s('circle', { r: 2.2, class: 'p-air' }, f1) }); pex.push({ u: i / 9, el: s('circle', { r: 2.2, class: 'p-exh' }, f1) }); }
  const Lin = pathIn.getTotalLength(), Lex = pathEx.getTotalLength();
  // válvulas
  function valve(hx, hy, tx, ty, cls) {
    const g = s('g', {}, f1);
    const ux = (hx - tx), uy = (hy - ty), L = Math.hypot(ux, uy);
    const nx = -uy / L, ny = ux / L;
    s('line', { x1: tx, y1: ty, x2: hx, y2: hy - 2, class: 'stem' }, g);
    s('path', { d: `M${hx + nx * 11},${hy + ny * 11} L${hx - nx * 11},${hy - ny * 11} L${hx - nx * 5 - ux / L * 6},${hy - ny * 5 - uy / L * 6} L${hx + nx * 5 - ux / L * 6},${hy + ny * 5 - uy / L * 6} Z`, class: 'valve ' + cls }, g);
    const spring = s('path', { class: 'spring' }, f1);
    return { g, ux: ux / L, uy: uy / L, tx, ty, nx, ny, spring };
  }
  const vIn = valve(183, 99, 166, 44, 'v-in'), vEx = valve(217, 99, 234, 44, 'v-ex');
  function springPath(v, l) { // resorte entre la culata y el platillo
    const top = { x: v.tx + v.ux * (6 + l), y: v.ty + v.uy * (6 + l) }, bot = { x: v.tx + v.ux * 26, y: v.ty + v.uy * 26 };
    let d = `M${top.x},${top.y}`; const n = 7;
    for (let i = 1; i <= n; i++) { const k = i / n; const x = top.x + (bot.x - top.x) * k, y = top.y + (bot.y - top.y) * k; const sgn = i % 2 ? 1 : -1; d += ` L${x + v.nx * 6 * sgn},${y + v.ny * 6 * sgn}`; }
    return d + ` L${bot.x},${bot.y}`;
  }
  // árbol de levas y balancines
  const camG = s('g', {}, f1);
  const camIn = s('path', { class: 'cam c-in' }, camG), camEx = s('path', { class: 'cam c-ex' }, camG);
  s('circle', { cx: 200, cy: 40, r: 3, class: 'axle' }, f1);
  function camPath(ang, peakAt) { let d = ''; for (let i = 0; i <= 48; i++) { const a = i / 48 * Math.PI * 2; let dd = Math.atan2(Math.sin(a - peakAt), Math.cos(a - peakAt)); const bump = Math.abs(dd) < 1.05 ? (Math.cos(dd / 1.05 * Math.PI) + 1) / 2 : 0; const r = 9 + 7 * bump; const [x, y] = pol(200, 40, r, a + ang); d += (i ? 'L' : 'M') + x.toFixed(1) + ',' + y.toFixed(1); } return d + 'Z'; }
  const rockIn = s('g', {}, f1), rockEx = s('g', {}, f1);
  s('path', { d: 'M193,30 L182,23 L164,40', class: 'rocker' }, rockIn); s('circle', { cx: 182, cy: 23, r: 3.2, class: 'axle' }, rockIn); s('rect', { x: 161, y: 36, width: 5, height: 8, class: 'screw', transform: 'rotate(-17 163 40)' }, rockIn);
  s('path', { d: 'M207,30 L218,23 L236,40', class: 'rocker' }, rockEx); s('circle', { cx: 218, cy: 23, r: 3.2, class: 'axle' }, rockEx); s('rect', { x: 234, y: 36, width: 5, height: 8, class: 'screw', transform: 'rotate(17 236 40)' }, rockEx);
  // bujía (al costado; se dibuja en línea discontinua)
  s('path', { d: 'M200,93 L189,79 M186,76 L150,32', class: 'plug-ghost' }, f1);
  const sparkEl = s('path', { d: 'M200,94 l-4,6 l6,-1 l-4,7', class: 'spark' }, f1);
  // pistón, biela, cigüeñal
  const crankG = s('g', {}, f1);
  s('path', { d: `M${C.x - 40},${C.y} A40,40 0 0 0 ${C.x + 40},${C.y} Z`, class: 'cweight', transform: '' }, crankG);
  s('path', { d: `M${C.x - 12},${C.y} L${C.x - 11},${C.y - RC} L${C.x + 11},${C.y - RC} L${C.x + 12},${C.y} Z`, class: 'web' }, crankG);
  s('circle', { cx: C.x, cy: C.y, r: 12, class: 'journal' }, crankG);
  s('circle', { cx: C.x, cy: C.y - RC, r: 9, class: 'cpin' }, crankG);
  const rod = s('path', { class: 'rod' }, f1);
  const pistonG = s('g', {}, f1);
  s('rect', { x: 160, y: 0, width: 80, height: 44, rx: 3, class: 'piston' }, pistonG);
  for (const y of [6, 11, 17]) s('line', { x1: 160, y1: y, x2: 240, y2: y, class: 'ring' }, pistonG);
  s('circle', { cx: 200, cy: 22, r: 7, class: 'ppin' }, pistonG);
  // etiquetas
  t(f1, 14, 90, 'Admisión (del carburador)', 'lbl lbl-s');
  t(f1, 386, 90, 'Escape', 'lbl lbl-s', 'end');
  callout(f1, 200, 33, 268, 16, 'Árbol de levas (gira a ½)');
  callout(f1, 170, 33, 14, 18, 'Balancín con\ntornillo de ajuste');
  callout(f1, 176, 74, 14, 116, 'Válvula de\nadmisión');
  callout(f1, 224, 74, 386, 116, 'Válvula de\nescape', 'end');
  callout(f1, 168, 58, 14, 154, 'Bujía (va al costado\nde la culata)');
  callout(f1, 150, 160, 14, 196, 'Camisa de agua');
  callout(f1, 238, 150, 386, 170, 'Pistón: 2 anillos de\ncompresión + 1 de aceite', 'end');
  callout(f1, 218, 262, 386, 246, 'Biela', 'end');
  callout(f1, 230, 330, 386, 334, 'Cigüeñal\n(5 bancadas)', 'end');

  // ═══ Figura 2: los 4 cilindros y diagrama de fases ═══
  const f2 = svg(400, 214, 'Posición y tiempo de los cuatro cilindros, orden de encendido 1-3-4-2');
  t(f2, 14, 26, '← polea', 'lbl lbl-xs');
  const XS = [70, 157, 244, 331];
  const minis = XS.map((x, i) => {
    s('rect', { x: x - 24, y: 30, width: 48, height: 72, rx: 3, class: 'bore' }, f2);
    const g = s('rect', { x: x - 22, y: 30, width: 44, height: 10, class: 'gas' }, f2);
    const p = s('rect', { x: x - 22, y: 40, width: 44, height: 16, rx: 2, class: 'piston' }, f2);
    const sp = s('path', { d: `M${x},${30} l-4,7 l6,-1 l-4,8`, class: 'spark' }, f2);
    const ph = t(f2, x, 118, '', 'lbl lbl-s strong', 'middle');
    t(f2, x, 26, 'Cil. ' + (i + 1), 'lbl lbl-s', 'middle');
    return { g, p, sp, ph, x };
  });
  const GX = 52, GW = 334, GY = 132, RH = 14;
  const gx = deg => GX + deg / 720 * GW;
  for (let i = 0; i < 4; i++) {
    t(f2, GX - 6, GY + i * (RH + 2) + 11, String(i + 1), 'lbl lbl-s', 'end');
    for (let k = 0; k < 4; k++) {
      let a0 = (OFF[i] + k * 180) % 720;
      const segs = a0 + 180 > 720 ? [[a0, 720], [0, a0 + 180 - 720]] : [[a0, a0 + 180]];
      for (const [x0, x1] of segs) s('rect', { x: gx(x0), y: GY + i * (RH + 2), width: gx(x1) - gx(x0) - 0.6, height: RH, class: 'phase ph' + k }, f2);
      if (a0 + 180 <= 720) t(f2, gx(a0 + 90), GY + i * (RH + 2) + 10.5, PHASES[k].k, 'lbl lbl-xs on-fill', 'middle');
    }
  }
  [0, 180, 360, 540, 720].forEach(d => { s('line', { x1: gx(d), y1: GY - 3, x2: gx(d), y2: GY + 4 * (RH + 2), class: 'tick' }, f2); t(f2, gx(d), GY + 4 * (RH + 2) + 11, d + '°', 'lbl lbl-xs', 'middle'); });
  t(f2, GX - 6, GY - 5, 'Cil.', 'lbl lbl-xs', 'end');
  const cursor = s('line', { y1: GY - 6, y2: GY + 4 * (RH + 2) + 2, class: 'cursor' }, f2);

  // ═══ Figura 3: distribución y correa en V ═══
  const f3 = svg(400, 262, 'Correa de distribución y correa del alternador');
  const CS = { x: 110, y: 72, r: 40 }, KS = { x: 110, y: 214, r: 20 };
  s('path', { d: `M70,72 A40,40 0 0 1 150,72 L140,144 L130,214 A20,20 0 0 1 90,214 Z`, class: 'belt-bg' }, f3);
  const beltT = s('path', { d: `M70,72 A40,40 0 0 1 150,72 L140,144 L130,214 A20,20 0 0 1 90,214 Z`, class: 'belt-teeth', 'stroke-dasharray': '2.2 2.2' }, f3);
  const camS = s('g', {}, f3); s('path', { d: gear(CS.x, CS.y, CS.r - 3, 32, 3), class: 'sprocket' }, camS); s('circle', { cx: CS.x, cy: CS.y, r: 7, class: 'axle' }, camS); s('path', { d: `M${CS.x},${CS.y - CS.r + 4} l-4,7 l8,0 Z`, class: 'mark' }, camS);
  const crS = s('g', {}, f3); s('path', { d: gear(KS.x, KS.y, KS.r - 3, 16, 3), class: 'sprocket' }, crS); s('circle', { cx: KS.x, cy: KS.y, r: 5, class: 'axle' }, crS); s('path', { d: `M${KS.x},${KS.y - KS.r + 4} l-3,6 l6,0 Z`, class: 'mark' }, crS);
  s('circle', { cx: 150, cy: 144, r: 10, class: 'idler' }, f3);
  s('path', { d: `M${CS.x},${CS.y - CS.r - 10} l-4,-7 l8,0 Z`, class: 'mark-fixed' }, f3);
  s('path', { d: `M${KS.x},${KS.y - KS.r - 9} l-3,-6 l6,0 Z`, class: 'mark-fixed' }, f3);
  callout(f3, 80, 46, 14, 16, 'Polea del árbol de levas (doble de dientes)', 'start', 'lbl lbl-xs');
  callout(f3, 158, 150, 168, 132, 'Tensor');
  callout(f3, 96, 228, 14, 254, 'Piñón del cigüeñal');
  callout(f3, 78, 140, 14, 120, 'Correa\ndentada\n88 × 19 mm');
  const WP = { x: 300, y: 110, r: 20 }, CP = { x: 300, y: 212, r: 24 }, AL = { x: 364, y: 168, r: 13 };
  const vbelt = 'M276,212 L280,110 A20,20 0 0 1 318,104 L372,158 A13,13 0 0 1 368,181 L320,226 A24,24 0 0 1 276,212 Z';
  s('path', { d: vbelt, class: 'belt-bg' }, f3);
  const vbeltT = s('path', { d: vbelt, class: 'belt-v', 'stroke-dasharray': '6 6' }, f3);
  const fanG = s('g', {}, f3);
  for (let i = 0; i < 5; i++) s('path', { d: `M${WP.x},${WP.y} L${WP.x + 44},${WP.y - 9} Q${WP.x + 49},${WP.y} ${WP.x + 44},${WP.y + 9} Z`, class: 'fanblade', transform: `rotate(${i * 72} ${WP.x} ${WP.y})` }, fanG);
  s('circle', { cx: WP.x, cy: WP.y, r: WP.r, class: 'pulley' }, f3); s('circle', { cx: CP.x, cy: CP.y, r: CP.r, class: 'pulley' }, f3); s('circle', { cx: AL.x, cy: AL.y, r: AL.r, class: 'pulley' }, f3);
  const spokes = [WP, CP, AL].map(P => s('line', { x1: P.x, y1: P.y, x2: P.x, y2: P.y - P.r + 3, class: 'spoke' }, f3));
  callout(f3, 300, 64, 300, 40, 'Bomba de agua + ventilador', 'middle', 'lbl lbl-xs');
  callout(f3, 372, 178, 396, 238, 'Alternador', 'end', 'lbl lbl-xs');
  callout(f3, 300, 236, 300, 254, 'Polea del cigüeñal', 'middle', 'lbl lbl-xs');
  callout(f3, 278, 168, 262, 168, 'Correa en V', 'end', 'lbl lbl-xs');

  // ═══ Controles ═══
  const rd = readout();
  const btnPlay = button('', () => { playing = !playing; syncPlay(); });
  function syncPlay() { btnPlay.textContent = playing ? 'Pausa' : 'Animar'; btnPlay.setAttribute('aria-pressed', String(playing)); }
  syncPlay();
  const spd = seg({ label: 'Velocidad', options: [{ v: '40', t: 'Muy lenta' }, { v: '120', t: 'Lenta' }, { v: '420', t: 'Rápida' }], value: '120', onchange: v => speed = +v });
  const ang = range({ label: 'Ángulo del cigüeñal', min: 0, max: 719, step: 1, value: theta, fmt: v => Math.round(v) + '°', oninput: v => { playing = false; syncPlay(); theta = v; draw(); } });
  const step = (d) => { playing = false; syncPlay(); theta = (theta + d + 720) % 720; draw(); };
  const stepBtns = h('div', { class: 'ctl btnrow' }, button('−10°', () => step(-10)), button('Chispa cil. 1', () => { playing = false; syncPlay(); theta = 352; draw(); }), button('+10°', () => step(10)));

  root.append(
    h('figure', { class: 'fig' }, f1, h('figcaption', {}, 'Corte de un cilindro. El ciclo completo dura dos vueltas de cigüeñal (720°).')),
    rd,
    h('div', { class: 'controls' }, h('div', { class: 'ctl btnrow' }, btnPlay), spd, ang, stepBtns),
    h('figure', { class: 'fig' }, f2, h('figcaption', {}, 'Orden de encendido 1-3-4-2 (cilindro 1 al lado de la polea). Los pistones 1 y 4 suben y bajan juntos, igual que el 2 y el 3: hay una explosión cada 180°.')),
    h('figure', { class: 'fig' }, f3, h('figcaption', {}, 'Izquierda: correa de distribución (la leva gira a la mitad del cigüeñal). Derecha: correa en V. La bomba de agua queda detrás de la correa dentada.')),
  );

  function draw() {
    const th = theta;
    // cilindro 1 en la figura grande
    const phi = ((th - OFF[0]) % 720 + 720) % 720;
    const a = rad(phi);
    const ys = RC * Math.cos(a) + Math.sqrt(LR * LR - (RC * Math.sin(a)) ** 2);
    const pinY = C.y - ys, top = pinY - 22;
    pistonG.setAttribute('transform', `translate(0 ${top.toFixed(2)})`);
    const cpx = C.x + RC * Math.sin(a), cpy = C.y - RC * Math.cos(a);
    const dx = 200 - cpx, dy = pinY - cpy, L = Math.hypot(dx, dy), nx = -dy / L, ny = dx / L;
    rod.setAttribute('d', `M${cpx + nx * 10},${cpy + ny * 10} L${200 + nx * 6},${pinY + ny * 6} L${200 - nx * 6},${pinY - ny * 6} L${cpx - nx * 10},${cpy - ny * 10} Z`);
    crankG.setAttribute('transform', `rotate(${phi.toFixed(2)} ${C.x} ${C.y})`);
    gas.setAttribute('d', `M160,${top} L160,99 Q200,86 240,99 L240,${top} Z`);
    const P = phaseOf(phi);
    let gcls = 'gas g' + P;
    const fire = phi > 352 && phi < 395;
    if (fire) gcls += ' fire';
    gas.setAttribute('class', gcls);
    sparkEl.style.opacity = phi > 350 && phi < 362 ? 1 : 0;
    const li = inLift(phi), le = exLift(phi);
    const LV = 9;
    vIn.g.setAttribute('transform', `translate(${(vIn.ux * LV * li).toFixed(2)} ${(vIn.uy * LV * li).toFixed(2)})`);
    vEx.g.setAttribute('transform', `translate(${(vEx.ux * LV * le).toFixed(2)} ${(vEx.uy * LV * le).toFixed(2)})`);
    vIn.spring.setAttribute('d', springPath(vIn, LV * li)); vEx.spring.setAttribute('d', springPath(vEx, LV * le));
    rockIn.setAttribute('transform', `rotate(${(-li * 16).toFixed(2)} 182 23)`);
    rockEx.setAttribute('transform', `rotate(${(le * 16).toFixed(2)} 218 23)`);
    // levas: el pico apunta al balancín cuando la válvula está más abierta
    const camAng = rad(phi / 2);
    camIn.setAttribute('d', camPath(camAng, rad(-177.5)));
    camEx.setAttribute('d', camPath(camAng, rad(-2.5)));
    // partículas en los conductos
    pin.forEach(q => { const pt = pathIn.getPointAtLength(q.u * Lin); q.el.setAttribute('cx', pt.x); q.el.setAttribute('cy', pt.y); q.el.style.opacity = li > 0.05 ? 1 : 0.15; });
    pex.forEach(q => { const pt = pathEx.getPointAtLength(q.u * Lex); q.el.setAttribute('cx', pt.x); q.el.setAttribute('cy', pt.y); q.el.style.opacity = le > 0.05 ? 1 : 0.15; });
    // 4 cilindros
    minis.forEach((m, i) => {
      const ph = ((th - OFF[i]) % 720 + 720) % 720; const aa = rad(ph);
      const k = (1 - Math.cos(aa)) / 2; // 0 PMS, 1 PMI (aprox.)
      const ptop = 32 + k * 52;
      m.p.setAttribute('y', ptop.toFixed(1));
      m.g.setAttribute('height', Math.max(0, ptop - 30).toFixed(1));
      const pp = phaseOf(ph);
      m.g.setAttribute('class', 'gas g' + pp + (ph > 352 && ph < 395 ? ' fire' : ''));
      m.ph.textContent = PHASES[pp].k; m.ph.setAttribute('class', 'lbl lbl-s strong ph-t' + pp);
      m.sp.style.opacity = ph > 350 && ph < 366 ? 1 : 0;
    });
    const deg = ((th % 720) + 720) % 720;
    cursor.setAttribute('x1', gx(deg)); cursor.setAttribute('x2', gx(deg));
    // distribución
    camS.setAttribute('transform', `rotate(${((deg - 360) / 2).toFixed(2)} ${CS.x} ${CS.y})`);
    crS.setAttribute('transform', `rotate(${deg.toFixed(2)} ${KS.x} ${KS.y})`);
    beltT.setAttribute('stroke-dashoffset', (-deg * Math.PI / 180 * KS.r).toFixed(2));
    vbeltT.setAttribute('stroke-dashoffset', (-deg * Math.PI / 180 * CP.r).toFixed(2));
    fanG.setAttribute('transform', `rotate(${(deg * 1.2).toFixed(1)} ${WP.x} ${WP.y})`);
    [[WP, 1.2], [CP, 1], [AL, 2.2]].forEach(([Pp, k], i) => spokes[i].setAttribute('transform', `rotate(${(deg * k).toFixed(1)} ${Pp.x} ${Pp.y})`));
    const aligned = Math.abs(deg - 360) < 4;
    // lectura
    const firing = [0, 1, 2, 3].find(i => { const ph = ((th - OFF[i]) % 720 + 720) % 720; return ph > 352 && ph < 400; });
    rd.innerHTML = `<b>${Math.round(deg)}°</b> · Cilindro 1 en <b style="color:${PHASES[P].c}">${PHASES[P].n}</b>. ${PHASES[P].d}` +
      `<span class="sub">Válvula de admisión ${li > 0.02 ? 'abierta' : 'cerrada'} · escape ${le > 0.02 ? 'abierta' : 'cerrada'}${firing != null ? ` · <b>explota el cilindro ${firing + 1}</b>` : ''}${aligned ? ' · <b>marcas de distribución alineadas</b>: cilindro 1 en PMS de compresión (en este esquema)' : ''}</span>`;
    ang.set(Math.round(deg));
  }
  draw();
  return {
    tick(dt) {
      if (!playing) return;
      theta = (theta + speed * dt) % 720;
      const kk = speed * dt / 720;
      [...pin, ...pex].forEach(q => q.u = (q.u + kk * 6) % 1);
      draw();
    },
  };
}
