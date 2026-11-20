// Sistema eléctrico del SK410 (manual secc. 8, 9, 10, 20 y 21), con lo que tiene este furgón: radio Sony MEX-N4150BT con
// un parlante JBL en cada puerta, antena original e iluminación del tablero con LED (dueño).
// Del manual: batería de 12 V, 24 o 38 Ah (5 h) según versión; alternador de 40 A con regulador IC integrado, 14 V sin
// carga a 1.000–1.100 rpm del alternador, 40 A a 5.000 rpm, tensión ajustada 14,4–15,0 V a 25 °C y polea de 65 mm;
// motor de partida de 0,6 kW (0,8 kW según versión), piñón de 8 dientes, interruptor magnético que opera con 8 V como
// máximo; bobina de ≈ 3,4 Ω de primario; punto de 8° antes del PMS a 900 rpm; faros de 60/50 W, señal de giro de 21 W,
// gálibo de 5 W; caja de 9 o 10 fusibles (los de faros, cola y bocina con corriente permanente; radio en ACC; encendido,
// calefacción, limpiaparabrisas, intermitentes y retroceso en IG); limpiaparabrisas de 48–60 y 65–79 ciclos por minuto.
// Lo que el manual no trae (capacidad de la batería de este furgón, resistencias internas, consumos de los motores
// eléctricos, curva de avance, destellos por minuto, consumo de la radio con música) son valores típicos.
// Es el sistema eléctrico del único motor del modelo: lee las rpm, la carga, la temperatura del agua, la correa y el
// ventilador de la calefacción que comparten las demás vistas.
import { MOTOR, ALT_K, beltSlip, oilPressure, OIL } from './motor.js';

const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

export const EK = {
  ah: 35, r0: 0.010,                 // Ah (manual: 24 o 38 Ah; ficha UK: 35) y Ω internos de la batería cargada
  rCab: 0.006,                       // Ω de los cables gruesos: la batería va a mitad del furgón, a ≈ 2,5 m del motor de partida
  altMax: 40, altN0: 1000, altTau: 700,    // A máx.; rpm del alternador desde las que carga; cuánto tarda en llegar al máximo (≈ 50 % a 1.500 rpm)
  vReg: 14.7, vRegHigh: 15.9,        // V del regulador (manual: 14,4–15,0 V a 25 °C); con el regulador malo
  rSt: 0.058, crankI: 170,           // Ω efectivos del motor de partida girando el motor (≈ 170 A con la batería sana)
  solV: 7.2,                         // V bajo los que el interruptor magnético no se sostiene: clic-clic (manual: opera con 8 V máx.)
  nStart: 140,                       // rpm de partida que necesita el motor para arrancar
  ignMin: 6.5,                       // V mínimos para que el módulo de encendido dé chispa
  flash: 85, flashFast: 150,         // destellos por minuto: normal y con una ampolleta menos (valores típicos)
  base: 8,                           // ° antes del PMS a 900 rpm (manual)
};

// fusibles (manual 20-7, circuito de 9 o 10 fusibles; el desempañador trasero es según versión)
export const FUSES = [
  { id: 'faroI', name: 'Faro izquierdo', A: 10, feed: 'bat' },
  { id: 'faroD', name: 'Faro derecho', A: 10, feed: 'bat' },
  { id: 'cola', name: 'Posición, cola, patente, freno e interior', A: 10, feed: 'bat' },
  { id: 'bocina', name: 'Bocina y balizas', A: 15, feed: 'bat' },
  { id: 'radio', name: 'Radio y encendedor', A: 15, feed: 'acc' },
  { id: 'ign', name: 'Bobina, solenoide del carburador y bomba de bencina', A: 15, feed: 'ig' },
  { id: 'calef', name: 'Ventilador de la calefacción', A: 15, feed: 'ig' },
  { id: 'limpia', name: 'Limpiaparabrisas y lavador', A: 15, feed: 'ig' },
  { id: 'giro', name: 'Intermitentes y luz de retroceso', A: 10, feed: 'ig' },
];
export const FEEDNAME = { bat: 'Permanente', acc: 'ACC', ig: 'Contacto (IG)' };

// potencias de las ampolletas (W a 13,2 V): manual secc. 21 y 20
export const LAMPW = { headLo: 50, headHi: 60, pos: 5, tail: 5, plate: 5, stop: 21, turn: 21, side: 5, rev: 21, inner: 5, pilot: 3.4, dash: 0.6 };

export const EFAILS = {
  ok:          { name: 'Todo bien' },
  bateria:     { name: 'Batería gastada' },
  borne:       { name: 'Borne sulfatado o suelto' },
  correa:      { name: 'Correa del alternador y ventilador suelta', shared: true },   // la misma de Refrigeración
  nocarga:     { name: 'Alternador que no carga' },
  sobrecarga:  { name: 'Regulador que sobrecarga' },
  ampolleta:   { name: 'Ampolleta trasera izquierda quemada' },
  destellador: { name: 'Destellador de los intermitentes defectuoso' },
  parlantes:   { name: 'Falso contacto en los parlantes' },
  resistencia: { name: 'Resistencia del ventilador cortada', shared: true },          // la misma de Calefacción
  bujia:       { name: 'Cable de bujía del cilindro 3 cortado' },
};
export const SHARED_FAILS = new Set(Object.keys(EFAILS).filter(k => EFAILS[k].shared));

export const KEYS = ['lock', 'acc', 'on', 'start'];
export const KEYNAME = { lock: 'LOCK', acc: 'ACC', on: 'ON', start: 'START' };
const keyAcc = k => k !== 'lock';
const keyOn = k => k === 'on' || k === 'start';

export function elecInit(o = {}) {
  return {
    key: 'lock', soc: 0.9, fail: 'ok',
    lights: 'off', turn: 0, hazard: false, wipers: 'off', horn: false, inner: false, lighter: 0, brake: false, reverse: false,
    radio: { on: true, vol: 0.35 },
    t: 0, flashT: 0, wipeT: 0, wipeOn: false, mute: 0, muteT: 6, crank: null, last: null, altA: 0,
    ...o,
  };
}

// batería
const ocvOf = soc => 11.9 + 0.8 * clamp(soc, 0, 1);
function battery(st, coldK) {
  const worn = st.fail === 'bateria';
  const ah = EK.ah * (worn ? 0.35 : 1);
  const soc = clamp(st.soc, 0, 1);
  const rb = EK.r0 * (1 + 3 * (1 - soc) ** 3) * (worn ? 4 : 1) * (1 + 0.5 * coldK) * (1 + 30 * clamp((0.05 - soc) / 0.05, 0, 1));   // agotada: el voltaje se cae con cualquier consumo   // descargada o fría, su resistencia sube
  const rx = st.fail === 'borne' ? 0.05 : 0;
  const g = (EK.ah / 35) * (25 * (1 - soc) ** 2 + 0.8) * (worn ? 0.35 : 1);       // A/V que acepta al cargarse
  return { ah, soc, ocv: ocvOf(soc), rb, rx, g };
}
// corriente de la batería al voltaje V del sistema (+ se carga, − se descarga)
const batI = (B, V) => (V >= B.ocv ? (V - B.ocv) / (1 / B.g + B.rb + B.rx) : (V - B.ocv) / (B.rb + B.rx));

// alternador: corriente máxima a sus rpm
export const altMaxAt = nAlt => Math.max(0, EK.altMax * (1 - Math.exp(-(nAlt - EK.altN0) / EK.altTau)));

// avance del encendido (° antes del PMS): base del manual; centrífugo y vacío, valores típicos.
// El avance por vacío empieza a trabajar con la mariposa abierta 5,5° (manual): en ralentí no actúa
export function advanceAt(rpm, vac = 0, pedal = 0) {
  const cent = 18 * clamp((rpm - 1200) / 2800, 0, 1);
  const vacA = pedal > 0.04 ? 14 * clamp((vac - 10) / 30, 0, 1) : 0;
  return { base: EK.base, cent, vac: vacA, total: EK.base + cent + vacA };
}

// consumos con el voltaje V: lista de { id, name, fuse, kind, W o A }
function loadList(st, inp, flashOn) {
  const L = [], key = st.key, on = keyOn(key), acc = keyAcc(key), f = st.fail, ef = inp.engFail || 'ok';
  const add = (id, name, fuse, kind, x) => { if (x > 0) L.push({ id, name, fuse, kind, x }); };
  // luces (corriente permanente, con el interruptor de luces)
  if (st.lights !== 'off') {
    add('pos', 'Posición, cola y patente', 'cola', 'lamp', 2 * LAMPW.pos + 2 * LAMPW.tail + LAMPW.plate);
    add('dash', 'Iluminación del tablero (LED)', 'cola', 'const', LAMPW.dash / 13.2);
  }
  if (st.lights === 'baja' || st.lights === 'alta') {
    const w = st.lights === 'alta' ? LAMPW.headHi : LAMPW.headLo;
    add('faroI', 'Faro izquierdo', 'faroI', 'lamp', w); add('faroD', 'Faro derecho', 'faroD', 'lamp', w);
    if (st.lights === 'alta' && on) add('pilotHi', 'Testigo de luz alta', 'faroI', 'lamp', 1.4);
  }
  if (inp.brake) add('stop', 'Luces de freno', 'cola', 'lamp', 2 * LAMPW.stop);
  if (st.inner) add('inner', 'Luz interior', 'cola', 'lamp', LAMPW.inner);
  if (st.horn) add('horn', 'Bocina', 'bocina', 'motor', 3.5);
  // intermitentes y balizas: ampolletas de cada lado (adelante, atrás, costado y testigo del tablero)
  const sideW = s => LAMPW.turn + (f === 'ampolleta' && s < 0 ? 0 : LAMPW.turn) + LAMPW.side + LAMPW.pilot;
  const turnL = st.hazard || (on && st.turn < 0), turnR = st.hazard || (on && st.turn > 0);
  if (flashOn && (turnL || turnR)) add('turn', st.hazard ? 'Balizas' : 'Intermitentes', st.hazard ? 'bocina' : 'giro', 'lamp', (turnL ? sideW(-1) : 0) + (turnR ? sideW(1) : 0));
  // ACC: radio y encendedor
  if (acc && st.radio.on) add('radio', 'Radio Sony', 'radio', 'const', 0.9 + 2.6 * st.radio.vol ** 2);
  else add('radioMem', 'Radio (memoria)', 'radio', 'const', 0.005);
  if (acc && st.lighter > 0) add('lighter', 'Encendedor', 'radio', 'lamp', 120);
  if (!on) return L;
  // IG: encendido, bomba, calefacción, limpiaparabrisas, retroceso, tablero
  const run = inp.run || (st.crank && st.crank.n > 0);
  add('coil', 'Bobina y módulo de encendido', 'ign', 'const', inp.run ? 2.5 * (1 - 0.25 * clamp((inp.rpm - 900) / 4600, 0, 1)) : st.crank ? 3 : 0);
  add('sol', 'Solenoide del carburador', 'ign', 'const', 0.4);
  add('pump', 'Bomba de bencina', 'ign', 'motor', run ? 1.2 : 0.3);
  const fan = inp.fan || 0, fanA = [0, 2.5, 4.5, 8][fan] || 0;
  add('fan', 'Ventilador de la calefacción', 'calef', 'motor', ef === 'resistencia' && fan < 3 ? 0 : fanA);
  if (st.wipers !== 'off' || st.wipeOn) add('wiper', 'Limpiaparabrisas', 'limpia', 'motor', st.wipers === 'rapido' ? 3.5 : 2.5);
  if (st.reverse || inp.reverse) add('rev', 'Luces de retroceso', 'giro', 'lamp', 2 * LAMPW.rev);   // la palanca en R (Transmisión) o el mando
  add('gauges', 'Indicadores del tablero', 'ign', 'const', 0.3);
  return L;
}
const loadI = (l, V) => (l.kind === 'lamp' ? l.x / 13.2 * Math.pow(Math.max(V, 0) / 13.2, 0.55) : l.kind === 'motor' ? l.x * Math.max(V, 0) / 13.2 : l.x);

// motor de partida: corriente, voltajes y rpm de giro con la llave en START
export function crankAt(st, inp) {
  const coldK = clamp((25 - (inp.Te ?? 20)) / 40, 0, 1), kCold = 1 + 0.35 * coldK;
  const B = battery(st, coldK);
  const rm = EK.rSt / kCold;
  const other = 5;                                                        // A: encendido, bomba, solenoide, testigos
  const rTot = B.rb + B.rx + EK.rCab + rm;
  const I = B.ocv / rTot;
  const vBat = B.ocv - (I + other) * (B.rb + B.rx);                       // en los bornes del sistema
  const vSt = I * rm;                                                     // en el motor de partida
  const click = vBat < EK.solV;
  const n = click ? 0 : 240 * clamp((vSt - 5.2) / (9.8 - 5.2), 0, 1.25) / Math.sqrt(kCold);
  const spark = vBat - 0.3 >= EK.ignMin;
  const ok = !click && n >= EK.nStart && spark;
  const why = click ? 'el interruptor magnético no se sostiene: suena clic-clic y el motor de partida no gira'
    : n < EK.nStart ? 'el motor de partida gira muy lento y el motor no alcanza a partir'
    : !spark ? 'con tan poco voltaje el módulo de encendido no da chispa' : '';
  return { I: click ? 0 : I, vBat, vSt: click ? 0 : vSt, n, click, spark, ok, why, coldK, tCatch: 0.6 + 1.6 * coldK };
}

// ¿parte el motor ahora? (para el botón Encender de cualquier vista)
export function startCheck(st, inp) {
  const c = crankAt(st, inp);
  if (!c.ok) return { ok: false, why: `No parte: ${c.why}.`, crank: c };
  return { ok: true, crank: c };
}

// estado eléctrico completo con las entradas de las demás vistas:
// inp = { run, rpm, load, kmh, pedal, vac, Te, fan, engFail, brake, handbrake, fuel, tempNeedle, fuelOK }
export function elecSolve(st, inp) {
  const key = st.key, on = keyOn(key), acc = keyAcc(key), f = st.fail, ef = inp.engFail || 'ok';
  const coldK = clamp((25 - (inp.Te ?? 20)) / 40, 0, 1);
  const B = battery(st, coldK);
  const run = !!inp.run;
  // alternador: la misma correa que la bomba de agua; si está suelta, patina más mientras más le piden
  const slip = ef === 'correa' ? beltSlip(inp.load || 0, inp.rpm || 0, st.altA || 0) : 0;
  const nAlt = run ? inp.rpm * ALT_K * (1 - slip) : 0;
  const iMax = run && f !== 'nocarga' ? altMaxAt(nAlt) : 0;
  const vSet = f === 'sobrecarga' ? EK.vRegHigh : EK.vReg;
  // intermitentes: el destellador mide la corriente; con menos ampolletas (o con el destellador malo) destella rápido
  const turnL = st.hazard || (on && st.turn < 0), turnR = st.hazard || (on && st.turn > 0);
  const flashing = turnL || turnR;
  const nomSide = 2 * LAMPW.turn + LAMPW.side + LAMPW.pilot;
  const actSide = s => LAMPW.turn + (f === 'ampolleta' && s < 0 ? 0 : LAMPW.turn) + LAMPW.side + LAMPW.pilot;
  const ratio = flashing ? ((turnL ? actSide(-1) : 0) + (turnR ? actSide(1) : 0)) / ((turnL ? nomSide : 0) + (turnR ? nomSide : 0)) : 1;
  const rate = !flashing ? 0 : f === 'destellador' || ratio < 0.75 ? EK.flashFast : EK.flash;
  const flashOn = flashing && (st.flashT % 1) < 0.5;
  // cuánto consume todo con la llave como está
  const crank = key === 'start' && st.crank ? crankAt(st, inp) : null;
  const L = loadList(st, inp, flashOn);
  const sumI = V => L.reduce((a, l) => a + loadI(l, V), 0);
  let V;
  if (crank) V = crank.vBat;
  else {
    const h = v => sumI(v) + batI(B, v) - iMax;
    if (h(vSet) <= 0) V = vSet;
    else { let lo = 4, hi = vSet; for (let i = 0; i < 40; i++) { const m = (lo + hi) / 2; if (h(m) > 0) hi = m; else lo = m; } V = (lo + hi) / 2; }
  }
  const items = L.map(l => ({ id: l.id, name: l.name, fuse: l.fuse, I: loadI(l, V) }));
  const iLoad = items.reduce((a, l) => a + l.I, 0);
  const iBat = crank ? -(crank.I + iLoad) : batI(B, V);
  const iAlt = crank ? 0 : Math.max(0, iLoad + iBat);
  const fuses = FUSES.map(F => ({ ...F, I: items.filter(i => i.fuse === F.id).reduce((a, i) => a + i.I, 0), live: F.feed === 'bat' || (F.feed === 'acc' ? acc : on) }));
  // lo que se ve: brillo de las ampolletas (el flujo sube con V^3,4), testigos e indicadores
  const bright = Math.pow(Math.max(V, 0) / 13.2, 3.4);
  const pres = oilPressure(run ? inp.rpm : 0, (inp.Te ?? 80) < 50);
  const altLow = !run || iMax < 0.5;
  const lamps = {
    head: st.lights === 'baja' || st.lights === 'alta' ? bright : 0, high: st.lights === 'alta',
    pos: st.lights !== 'off' ? bright : 0,
    stop: inp.brake ? bright : 0,
    turnL: turnL && flashOn ? bright : 0, turnR: turnR && flashOn ? bright : 0, rearLout: f === 'ampolleta',
    rev: on && (st.reverse || inp.reverse) ? bright : 0,
    inner: st.inner ? bright : 0,
    dash: st.lights !== 'off' ? 1 : 0,                                  // LED: no cambia con el voltaje
    pilotL: turnL && flashOn, pilotR: turnR && flashOn, pilotHi: on && st.lights === 'alta',
    charge: on && altLow && !crank ? 1 : on && crank ? 1 : 0,
    oil: on && pres < OIL.lamp,
    brake: on && !!inp.handbrake,
  };
  // indicadores (necesitan contacto); la aguja de temperatura es la de la vista Refrigeración
  const gauges = { temp: on ? inp.tempNeedle ?? -0.06 : -0.06, fuel: on ? clamp(inp.fuel ?? 0.6, 0, 1) : -0.06, speed: inp.kmh || 0 };
  // encendido
  const vIgn = on ? V - 0.3 : 0;
  const adv = advanceAt(run ? inp.rpm : 0, inp.vac || 0, inp.pedal || 0);
  const kvAvail = on ? 26 * clamp(vIgn / 13.5, 0, 1.12) : 0;
  const kvNeed = 7 + 5 * (inp.load || 0) + 2 * coldK;
  const dies = run && vIgn < EK.ignMin;
  // radio
  const radioOn = acc && st.radio.on;
  const sound = radioOn && !(f === 'parlantes' && st.mute > 0);
  return {
    key, on, acc, run, rpm: run ? inp.rpm || 0 : 0, V, vIgn, iLoad, iBat, iAlt, iMax, nAlt, slip, vSet, soc: B.soc, ah: B.ah, ocv: B.ocv, charging: iBat > 0.3,
    items, fuses, bright, lamps, gauges, pres, rate, flashOn, flashing, turnFast: flashing && rate > EK.flash + 10, ratio,
    adv, kvAvail, kvNeed, misfire: f === 'bujia', dies, crank,
    radio: { on: radioOn, sound, vol: st.radio.vol, mute: radioOn && !sound, I: radioOn ? 0.9 + 2.6 * st.radio.vol ** 2 : 0.005 },
    wiper: on && st.wipers !== 'off' ? (st.wipers === 'rapido' ? 72 : 54) : 0,
    fail: f, engFail: ef,
    hoursLeft: iBat < -0.05 ? (B.soc - 0.45) * B.ah / -iBat : null,     // hasta quedar sin carga para partir (≈ 45 %)
  };
}

// avanza dt segundos: carga de la batería, destellos, limpiaparabrisas, encendedor y el falso contacto de los parlantes
export function elecStep(st, dt, inp, rnd = Math.random) {
  const r = elecSolve(st, inp);
  st.altA = r.iAlt;
  const k = r.iBat > 0 ? 0.92 : 1;                                      // la carga no entra entera
  st.soc = clamp(st.soc + r.iBat * k * dt / 3600 / r.ah, 0, 1);
  if (r.rate) st.flashT += dt * r.rate / 60; else st.flashT = 0;
  if (r.wiper) { st.wipeT += dt * r.wiper / 60; st.wipeOn = true; }
  else if (st.wipeOn) {                                                  // vuelve sola a la posición de reposo (manual)
    const u = st.wipeT % 1; const nu = u + dt * 54 / 60;
    if (nu >= 1) { st.wipeT = Math.floor(st.wipeT) + 1; st.wipeOn = false; } else st.wipeT += dt * 54 / 60;
  }
  if (st.lighter > 0) st.lighter = Math.max(0, st.lighter - dt);
  if (st.fail === 'parlantes' && r.radio.on) {
    st.muteT -= dt * (inp.kmh > 3 ? 2.5 : 1);                           // andando, cada bache lo mueve
    if (st.muteT <= 0) { if (st.mute > 0) { st.mute = 0; st.muteT = 6 + 14 * rnd(); } else { st.mute = 1; st.muteT = 0.8 + 2.4 * rnd(); } }
  } else { st.mute = 0; }
  st.t += dt;
  st.last = r;
  return r;
}
