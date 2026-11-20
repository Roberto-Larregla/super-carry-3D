// Refrigeración del SK410 (manual secc. 6 y 20): bomba, block, culata, múltiple, termostato, radiador, tapa y depósito.
// Del manual: 3,4 L entre motor, radiador y calefacción, más 0,6 L del depósito (4,0 L en total); tapa de 0,9 kg/cm²
// (90 kPa) con válvula de vacío; termostato de cera A (abre a 82 °C, del todo a 95 °C) o B (88 → 100 °C), alzada de
// más de 8 mm; correa con 6–9 mm de flecha bajo 10 kg; bulbo del múltiple 50 °C 133,9–178,9 Ω, 80 °C 47,5–56,8 Ω y
// 100 °C 26,2–29,3 Ω, que mueve un indicador bimetálico. El panal mide 488 × 240 mm (catálogo de repuestos). En este
// furgón la aguja queda a un tercio con el motor caliente (dueño). El calor que entrega el motor, el caudal de la bomba,
// el aire que mueve el ventilador y las masas térmicas son valores típicos: sirven para mostrar proporciones.
// Es el estado del único motor del modelo: todas las vistas leen de aquí la temperatura del agua, y la calefacción y la
// refrigeración comparten sus mandos y sus fallas. Las presiones se calculan en bar y se muestran en kg/cm², como el manual.

import { MOTOR, powerAt, cabinOf, BAR_PER_KG, PUMP_K, beltSlip } from './motor.js';
import { heaterCore } from './heatersim.js';
import { GEARS, FINAL, TIRES } from './data.js';

export const CK = {
  vSys: 3.4, resLow: 0.22, resFull: 0.6, resMax: 0.95, hoseEnd: 0.035,   // L; la manguera llega a 10 mm del fondo del depósito
  capKg: 0.9, cap: 0.9 * BAR_PER_KG, vac: 0.05,                         // tapa: 0,9 kg/cm² (manual) = 0,88 bar; válvula de vacío (bar)
  therm: { A: [82, 95], B: [88, 100] }, lift: 8,                         // °C y mm
  pumpK: PUMP_K,                                                         // bomba y ventilador: ≈ 1,16 vueltas por vuelta del cigüeñal (poleas, motor.js)
  qPump: 0.0135,                                                         // L/min por rpm de la bomba (estimado)
  Ce: 30, Cr: 5,                                                         // kJ/K: motor (fierro, aluminio y agua) y radiador
  cp: 3.6 * 1.04 / 60,                                                   // kW/K por L/min de mezcla 50/50
  area: 0.488 * 0.24,                                                    // m² de panal
  beta: 0.00055,                                                         // dilatación de la mezcla por °C
  stiff: 12,                                                             // bar por litro de más con el circuito lleno
  rc: 10,                                                                // Ω de la bobina del indicador (estimado: deja la aguja a 1/3 a 84 °C)
};

// rpm de cada situación: la velocidad, la marcha, las relaciones de la caja (manual) y los 175/70 R13 de este furgón
export const rpmAt = (kmh, gear) => Math.round(kmh / (TIRES[0].c * 60 / 1000) * GEARS[gear - 1].r * FINAL);
export const SCEN = {
  ralenti:   { name: 'Ralentí, detenido', rpm: MOTOR.idle, load: 0, kmh: 0 },
  ciudad:    { name: 'Ciudad', rpm: rpmAt(35, 3), gear: 3, load: 0.25, kmh: 35 },
  taco:      { name: 'Taco en verano', rpm: MOTOR.idle, load: 0, kmh: 0, amb: 32, stopgo: true },
  subida:    { name: 'Subida con carga', rpm: rpmAt(28, 2), gear: 2, load: 1, kmh: 28, amb: 25 },
  carretera: { name: 'Carretera a 80 km/h', rpm: rpmAt(80, 5), gear: 5, load: 0.43, kmh: 80 },
};

export const CFAILS = {
  ok:       { name: 'Todo bien' },
  cerrado:  { name: 'Termostato pegado cerrado' },
  abierto:  { name: 'Termostato pegado abierto' },
  correa:   { name: 'Correa del alternador y ventilador suelta' },
  carenado: { name: 'Sin carenado del ventilador' },
  panal:    { name: 'Panal del radiador tapado' },
  tapa:     { name: 'Tapa del radiador vencida' },
  bomba:    { name: 'Bomba de agua gastada' },
  aire:     { name: 'Aire en el circuito' },
  fuga:     { name: 'Fuga: falta agua' },
  culata:   { name: 'Empaquetadura de culata soplada' },
  llave:    { name: 'Llave de agua trabada' },
  radiador: { name: 'Radiador de calefacción tapado' },
  resistencia: { name: 'Resistencia del ventilador cortada' },
  desempanador: { name: 'Compuerta del parabrisas desajustada' },
};
// mandos de la calefacción (los mismos para todas las vistas): llave 0–1, ventilador 0–3, salida y recirculación
export const HEAT0 = { temp: 1, fan: 2, mode: 'pies', recirc: true };
export const heaterFlows = (heat, fail) => (fail === 'llave' ? 0 : heat.temp) > 0.02;

const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const PATM = 1.013;   // bar

// ——— bulbo e indicador ———
const RT = [[50, Math.log(156.4)], [80, Math.log(52.15)], [100, Math.log(27.75)]];   // centro de cada rango del manual
export function senderR(T) {
  const [a, b] = T <= 80 ? [RT[0], RT[1]] : [RT[1], RT[2]];
  return Math.exp(a[1] + (b[1] - a[1]) * (T - a[0]) / (b[0] - a[0]));
}
// el indicador es bimetálico: la aguja sigue a la corriente, que crece cuando baja la resistencia del bulbo
const G = T => 1 / (senderR(T) + CK.rc);
const G0 = G(50), G1 = G(120);
export const needleOf = T => clamp((G(T) - G0) / (G1 - G0), -0.06, 1.06);   // 0 = C, 1 = H
export const NEEDLE_OFF = -0.06;                                              // aguja sin corriente (bajo la C)
// la mezcla 50/50 hierve a ~106 °C sin presión y a ~123 °C con la tapa de 0,9
export const boilAt = P => 106 + 19 * clamp(P, 0, 1.3);   // P en bar

// frío azul → tibio gris → caliente naranjo → excesivo rojo (la misma escala del esquema del panel)
const STOPS = [[20, [58, 160, 220]], [60, [112, 132, 146]], [88, [240, 150, 60]], [110, [232, 68, 58]]];
export function coolColor(T) {
  T = clamp(T, 20, 110);
  for (let i = 0; i < STOPS.length - 1; i++) {
    const [t0, c0] = STOPS[i], [t1, c1] = STOPS[i + 1];
    if (T <= t1) { const k = (T - t0) / (t1 - t0); return c0.map((v, j) => Math.round(v + (c1[j] - v) * k)); }
  }
  return STOPS[STOPS.length - 1][1];
}

export function coolInit(o = {}) {
  const amb = o.amb ?? MOTOR.amb;
  return {
    on: false, scen: 'ralenti', amb, heat: { ...HEAT0 }, therm: 'A', fail: 'ok', speed: 60, capOn: true, ext: null,
    Te: amb, Tr: amb, TairOut: amb, lift: 0, m: CK.vSys, res: 0.38, lost: 0, gas: 0, air: 0, top: 0, soak: 0, P: 0, gauge: needleOf(amb),
    t: 0, boil: 0, vent: 0, ret: 0, phase: 0, void: 0, ...o,
  };
}

// condiciones de manejo en el instante t (el taco alterna 45 s detenido y 15 s avanzando despacio en 1.ª).
// Fuera de la vista Refrigeración manda la vista activa (st.ext): el acelerador de Alimentación, la marcha de
// Transmisión o el ralentí en las demás.
export function condAt(st) {
  if (st.ext) return st.ext;
  const S = SCEN[st.scen] || SCEN.ralenti;
  if (S.stopgo && st.on) { const k = (st.t % 60) >= 45; return k ? { ...S, rpm: rpmAt(8, 1), load: 0.18, kmh: 8, moving: true } : { ...S, moving: false }; }
  return S;
}

// cambia de falla: las que no son de agua parten con el circuito lleno y purgado
export function applyFail(st, f) {
  const prev = st.fail; st.fail = f;
  if (f === 'fuga') { const m0 = st.m; st.m = Math.min(st.m, CK.vSys - 0.32); st.top += m0 - st.m; st.void = Math.max(st.void || 0, m0 - st.m); st.res = Math.min(st.res, 0.02); return; }
  if (f === 'aire') { const m0 = st.m; st.m = Math.min(st.m, CK.vSys - 0.22); st.air += m0 - st.m; st.void = Math.max(st.void || 0, m0 - st.m); return; }
  if (prev !== f && (st.air + st.top + st.gas > 0.005 || st.res < CK.resLow || st.res > CK.resFull)) refill(st);
}

// rellena y purga: circuito lleno, sin aire, depósito entre las marcas
export function refill(st) { st.m = CK.vSys / (1 + CK.beta * Math.max(0, (st.Te ?? 20) - 20) * 0.8); st.res = 0.38; st.lost = 0; st.gas = 0; st.air = 0; st.top = 0; st.void = 0; }

function sub(st, h) {
  const S = condAt(st), f = st.fail;
  const n = st.on ? S.rpm : 0, run = n > 0;   // motor girando
  // correa: patina más con carga y con muchas vueltas
  const slip = f === 'correa' ? beltSlip(S.load, n, st.altA || 0) : 0;   // la misma correa mueve el alternador (vista Eléctrico)
  const wp = n * CK.pumpK * (1 - slip);
  // lo que no ocupa el agua (aire, gases o vapor, del paso anterior): la bomba cavita y la calefacción (el punto alto) se llena de aire
  const pocket = st.void || 0;
  const short = Math.max(0, CK.vSys - st.m);                    // agua que falta en el circuito (también la que se fue al depósito al dilatarse)
  const airF = clamp(1 - 2.4 * Math.max(0, pocket - 0.06) - (f === 'aire' ? 0.42 : 0), 0.06, 1);
  const Qp = CK.qPump * wp * (f === 'bomba' ? 0.45 : 1) * airF;
  // termostato: la cera tarda en derretirse; la válvula de purga deja pasar un hilo con la válvula cerrada
  const [To, Tf] = CK.therm[st.therm];
  let target = clamp((st.Te - To) / (Tf - To), 0, 1.12) * CK.lift;
  if (f === 'cerrado') target = 0; if (f === 'abierto') target = CK.lift;
  st.lift += (target - st.lift) * Math.min(1, h / 16);
  const fo = st.lift / CK.lift;
  // calefacción: la llave (por cable desde la palanca COOL–HOT) deja pasar más o menos agua; casi todo el efecto está
  // en la última parte del recorrido, como en las llaves de este tipo
  const valve = f === 'llave' ? 0 : st.heat.temp;
  let Gh = 0.001 + 0.219 * valve * valve;
  if (pocket > 0.12 || f === 'aire') Gh = Math.min(Gh, 0.03);   // con aire, el radiador de calefacción (el punto alto) se llena de aire
  if (f === 'radiador') Gh *= 0.35;
  const Gr = 0.004 + 1.0 * fo, Gb = 0.32;
  const Gt = Gr + Gb + Gh, Qr = Qp * Gr / Gt, Qb = Qp * Gb / Gt, Qh = Qp * Gh / Gt;
  // calor del motor: roce y bombeo más la parte de la potencia que se va al agua (la misma curva del motor de todas las vistas)
  const Pmax = powerAt(n);
  if (run) st.soak = Math.max(st.soak * Math.exp(-h / 600), Math.min(4, 0.25 * ((2 + n / 1000) + 0.95 * S.load * Pmax)));   // calor guardado en el fierro
  else st.soak *= Math.exp(-h / 120);
  let Qin = run ? (2 + n / 1000) + 0.95 * S.load * Pmax : st.soak;   // al apagar, el fierro caliente sigue entregando calor
  if (f === 'culata' && run) Qin *= 1.12;
  // aire por el panal: ventilador (con el carenado) más lo que entra al avanzar, por debajo del piso
  const vf = 0.9e-3 * wp * (f === 'carenado' ? 0.22 : 1), vr = 0.06 * S.kmh / 3.6;
  const v = vf + vr + 0.05;
  const Ca = 1.2 * CK.area * v * 1.005;
  const UA = 0.46 * Math.pow(v, 0.6) * (f === 'panal' ? 0.5 : 1);
  const Ka = (1 - Math.exp(-UA / Ca)) * Ca;
  const rec = (f === 'carenado' ? 0.45 : 0.08) * (S.kmh > 20 ? 0.4 : 1);   // sin carenado el ventilador traga aire caliente del motor
  const Tin = st.amb + rec * Math.max(0, st.TairOut - st.amb);
  const Qrad = Ka * (st.Tr - Tin);
  st.TairOut = Tin + Qrad / Ca;
  // calefacción: el mismo radiador de calefacción que calcula la vista Calefacción (aire del ventilador y agua que le llega)
  const H = st.heat, TinH = H.recirc ? cabinOf(st.amb) : st.amb;
  const Qhe = run ? heaterCore({ Tw: st.Te, Tin: TinH, fan: H.fan, mode: H.mode, fail: f, flowW: Qh }).kW : 0;
  const Ql = (0.008 + 0.0002 * S.kmh) * (st.Te - st.amb);
  // ebullición: el vapor sube la presión; si pasa la de la tapa (o no hay tapa) empuja agua y se lleva calor
  const Pcap = !st.capOn ? 0 : f === 'tapa' ? 0.15 : CK.cap;
  const Psat = (st.Te - 106) / 19;
  st.boil = clamp((Psat - Pcap) * 19 / 6, 0, 1);
  const vapor = Psat > Pcap ? 0.004 * (1 + 4 * st.boil) * (run ? 1 : 0.4) : 0;   // L/s de agua desplazada
  const Qlat = vapor * 1130;
  const Tb = boilAt(Pcap);
  // menos agua: menos masa que calentar
  const Ce = CK.Ce - 3.6 * Math.min(1.2, short);
  const Qx = Qr * CK.cp * (st.Te - st.Tr) * clamp(1 - 1.5 * Math.max(0, pocket - 0.15), 0.15, 1);   // con bolsas de vapor el agua ya no saca el calor del fierro
  st.Te += h * (Qin - Qx - Qhe - Ql - Qlat) / Ce;
  st.Tr += h * (Qx - Qrad) / CK.Cr;
  if (st.Tr < Math.min(st.amb, st.Te) - 0.5) st.Tr = Math.min(st.amb, st.Te);
  // presión: la mezcla se dilata; con aire adentro hay espacio antes de que suba
  const Tavg = 0.62 * st.Te + 0.26 * st.Tr + 0.12 * (heaterFlows(st.heat, f) ? st.Te : (st.Te + st.amb) / 2);
  if (f === 'culata' && run) st.gas += h * 0.0016 * (0.4 + S.load) * (n / 2000);   // gases de la combustión entran al agua
  else if (run) st.gas *= Math.exp(-h / 240);                // andando, la circulación lleva los gases a la tapa; detenido quedan arriba
  // el agua casi no se comprime (las mangueras ceden un poco); el aire y los gases sí: P·V constante
  const kT = 1 + CK.beta * (Tavg - 20), Vliq = st.m * kT, s = CK.stiff, a = Vliq - CK.vSys;
  const nG = (st.air + st.top + st.gas) * PATM;
  const gasVol = Pg => nG / (PATM + Pg);
  let P = !st.capOn ? 0 : nG > 1e-7 ? ((a * s - PATM) + Math.sqrt((a * s + PATM) ** 2 + 4 * s * nG)) / 2 : a * s;
  if (st.capOn) P = Math.max(-0.9, P, Math.min(Pcap, Psat));
  st.vent = 0; st.ret = 0; st.gv = 0;
  if (!st.capOn) { P = 0; }
  else if (P > Pcap || vapor > 0) {                      // abre la válvula de presión
    let E = Math.max(0, Vliq + gasVol(Pcap) - CK.vSys - Pcap / s) + vapor * h;   // L que tienen que salir para quedar en la presión de la tapa
    const kP = PATM / (PATM + Pcap);
    const t1 = Math.min(st.top * kP, E); st.top -= t1 / kP; E -= t1;          // primero el aire que quedó bajo la tapa
    const g = Math.min(st.gas * kP, E * 0.5); st.gas -= g / kP; E -= g;       // los gases de la combustión salen revueltos con agua
    const dv = clamp(E, 0, (st.m - 1.2) * kT);
    st.m -= dv / kT; st.res += dv; st.vent = (dv + g + t1) / Math.max(h, 1e-6); st.gv = (g + t1) / Math.max(h, 1e-6); P = Pcap;
  } else if (P < -CK.vac && f !== 'tapa') {             // abre la de vacío: vuelve agua del depósito; si se secó, la manguera chupa aire
    const D = Math.max(0, CK.vSys - CK.vac / s - Vliq - gasVol(-CK.vac));
    const dv = Math.min(D, Math.max(0, st.res - CK.hoseEnd));
    st.m += dv / kT; st.res -= dv; st.ret = dv / Math.max(h, 1e-6);
    if (D - dv > 1e-9) st.top += (D - dv) * (PATM - CK.vac) / PATM;
    P = -CK.vac;
  } else if (P < -0.3 && f === 'tapa') {                 // la de vacío quedó pegada: el vacío termina metiendo aire por el sello gastado
    const D = Math.max(0, CK.vSys - 0.3 / s - Vliq - gasVol(-0.3));
    st.top += D * (PATM - 0.3) / PATM; P = -0.3;
  }
  st.P = P;
  st.void = st.capOn ? Math.max(0, CK.vSys + P / s - st.m * kT) : Math.max(0, CK.vSys - st.m * kT);
  if (st.res > CK.resMax) { st.lost += st.res - CK.resMax; st.res = CK.resMax; }   // rebalsa por el respiradero
  // fugas: por una manguera o por el agujero de alivio de la bomba (sello gastado)
  const leak = f === 'fuga' ? 0.0011 * (0.35 + Math.max(0, st.P)) * (run ? 1 : 0.5) : f === 'bomba' && run ? 0.00006 * (1 + Math.max(0, st.P)) : 0;
  if (leak > 0 && st.m > 1.2) { st.m -= leak * h; st.lost += leak * h; }
  // bulbo: en el múltiple; si queda en aire o vapor marca de menos
  const dry = pocket > 0.45 || (f === 'aire' && run);
  st.Ts = dry ? st.Te - Math.min(f === 'aire' ? 10 + 9 * Math.sin(st.t / 23) : Math.min(40, (pocket - 0.45) * 90), 0.6 * Math.max(0, st.Te - st.amb)) : st.Te;
  const nt = st.ign === false ? NEEDLE_OFF : needleOf(st.Ts);   // el indicador necesita contacto (llave en ON): sin él vuelve a C
  st.gauge += (nt - st.gauge) * Math.min(1, h / 9);
  st.t += h;
  return { S, n, slip, wp, Qp, Qr, Qb, Qh, Qin, Qrad, Qhe, Ql, v, vf, vr, Tin, Ka, Tb, vapor, missing: pocket, rec, airF, valve };
}

// avanza dtReal segundos de reloj; en la vista Refrigeración el tiempo del modelo va st.speed veces más rápido
export function coolStep(st, dtReal, scale = st.speed) {
  let left = Math.max(0, dtReal) * scale, r = null;
  if (left <= 0) return coolRead(st);
  while (left > 1e-9) { const h = Math.min(0.5, left); r = sub(st, h); left -= h; }
  return coolRead(st, r);
}

// deja el motor caliente: lo que pasaría andando en ciudad hasta que el termostato regula (o 25 min si no llega,
// por ejemplo con el termostato pegado abierto) y un minuto en ralentí, con la calefacción, la falla y la
// temperatura de afuera que haya
export function warmUp(st) {
  const keep = { on: st.on, ext: st.ext }, [To] = CK.therm[st.therm];
  st.on = true; st.ext = { ...SCEN.ciudad, moving: true };
  for (let t = 0; t < 1500 && st.Te < To + 0.3; t += 0.5) sub(st, 0.5);
  st.ext = { ...SCEN.ralenti };
  for (let t = 0; t < 60; t += 0.5) sub(st, 0.5);
  st.on = keep.on; st.ext = keep.ext;
  st.gauge = st.ign === false ? NEEDLE_OFF : needleOf(st.Ts ?? st.Te);
}
// pone el agua del motor a una temperatura (el esquema del panel): el resto del circuito sigue desde ahí
export function setTemp(st, T) {
  st.Te = T; st.Ts = T; st.TairOut = Math.min(st.TairOut, T);
  if (st.Tr > T) st.Tr = T;
  st.gauge = st.ign === false ? NEEDLE_OFF : needleOf(T);
}

export function coolRead(st, r) {
  if (!r) { const keep = { ...st }; r = sub(keep, 1e-6); }
  const tOut = r.Qr > 0.05 ? Math.max(st.amb, st.Tr - (st.Te - st.Tr) * 0.35) : st.Tr;
  return {
    on: st.on, scen: st.scen, fail: st.fail, therm: st.therm, amb: st.amb, speed: st.speed, capOn: st.capOn,
    heat: { ...st.heat }, hflow: heaterFlows(st.heat, st.fail), heater: heaterFlows(st.heat, st.fail) && st.heat.fan > 0, valve: r.valve, ext: !!st.ext,
    t: st.t, Te: st.Te, Ts: st.Ts ?? st.Te, Tr: st.Tr, tIn: st.Te, tOut, TairIn: r.Tin, TairOut: st.TairOut,
    lift: st.lift, open: st.lift / CK.lift, P: st.P, res: st.res, m: st.m, lost: st.lost, gas: st.gas, missing: r.missing, gv: st.gv || 0,
    pocket: st.void || 0,
    gauge: st.gauge, R: senderR(st.Ts ?? st.Te), boil: st.boil, Tb: r.Tb, vent: st.vent, ret: st.ret,
    rpm: r.n, wp: r.wp, slip: r.slip, Qp: r.Qp, Qr: r.Qr, Qb: r.Qb, Qh: r.Qh, Qin: r.Qin, Qrad: r.Qrad, Qhe: r.Qhe,
    air: r.v, airFan: r.vf, airRam: r.vr, rec: r.rec, kmh: r.S.kmh, load: r.S.load, moving: !!r.S.moving,
  };
}

// ——— prueba del termostato en una olla (manual 6-3) ———
export const POT = { rate: 1.5, max: 100, lag: 2 };    // °C por segundo de reloj, ebullición, segundos de retardo de la cera
export const POTCOND = { bueno: 'Bueno', tarde: 'Abre tarde', pegado: 'No abre' };
export function potInit(o = {}) { return { on: false, T: 20, lift: 0, cond: 'bueno', openT: null, ...o }; }
export function potStep(p, therm, dt) {
  if (p.on) p.T = Math.min(POT.max, p.T + POT.rate * dt);
  else p.T = Math.max(20, p.T - 0.08 * dt * (p.T - 20) / 20);
  const [To0, Tf0] = CK.therm[therm], d = p.cond === 'tarde' ? 7 : 0;
  const target = p.cond === 'pegado' ? 0 : clamp((p.T - To0 - d) / (Tf0 - To0), 0, 1.06) * 8.4;
  if (p.openT == null && target > 0.2) p.openT = p.T;    // a qué temperatura empezó a abrir (la válvula la sigue con un retardo)
  p.lift += (target - p.lift) * Math.min(1, dt / POT.lag);
  return p;
}

// ——— cambiar y purgar el agua (manual 6-5), paso a paso: qué se ve en el modelo ———
// cap: tapa puesta; drain: tapón de vaciado abierto; run: motor andando; fluid: lo que hay adentro; level: nivel del
// radiador al empezar y al terminar el paso (1 = hasta la base del cuello); res: depósito en su lugar o afuera
export const PROC = [
  { t: 'Sacar la tapa con el motor frío', cap: false, fluid: 'old', level: [1, 1],
    p: 'Con el motor y el radiador fríos se saca la tapa del radiador. Caliente no: el agua está bajo presión sobre los 100 °C y, al soltarla, hierve de golpe y salta.' },
  { t: 'Hacer andar el motor', cap: false, run: true, fluid: 'old', level: [1, 1], hot: [20, 86],
    p: 'Sin la tapa, el motor anda hasta que la manguera superior del radiador queda caliente: eso muestra que el termostato abrió y que el agua ya circula por todo el sistema.' },
  { t: 'Vaciar por el tapón del radiador', cap: false, drain: true, fluid: 'old', level: [1, 0], hot: [86, 60],
    p: 'Con el motor detenido se abre el tapón de vaciado, abajo del radiador. El refrigerante viejo se recibe en un recipiente: es tóxico y no va a la tierra ni al desagüe.' },
  { t: 'Llenar con agua y volver a calentar', cap: false, run: true, fluid: 'water', level: [0, 1], hot: [30, 86],
    p: 'Se cierra el tapón, se llena con agua limpia y el motor anda otra vez hasta que la manguera superior se calienta.' },
  { t: 'Repetir hasta que salga limpia', cap: false, drain: true, fluid: 'water', level: [1, 0], hot: [86, 60],
    p: 'Se vacía y se vuelve a llenar varias veces, hasta que el agua que sale es casi incolora.' },
  { t: 'Vaciar y cerrar firme el tapón', cap: false, fluid: 'none', level: [0, 0],
    p: 'Se vacía por última vez y el tapón de vaciado se cierra firme.' },
  { t: 'Lavar el depósito', cap: false, fluid: 'none', level: [0, 0], res: 'out',
    p: 'Se suelta la manguera del depósito, se saca, se vacía y se lava por dentro con agua y jabón; se enjuaga bien y se vuelve a poner con su manguera.' },
  { t: 'Llenar con la mezcla nueva', cap: false, fluid: 'mix', level: [0, 1], resLevel: CK.resFull,
    p: 'Mezcla 50/50 (2,0 L de anticongelante y 2,0 L de agua, protege hasta −36 °C) o 30/70 (1,2 + 2,8 L, hasta −16 °C). El radiador hasta la base del cuello de llenado y el depósito hasta FULL; se pone la tapa del depósito.' },
  { t: 'Purgar el aire con el motor andando', cap: false, run: true, fluid: 'mix', level: [1, 0.86], bubbles: true, hot: [22, 86], resLevel: CK.resFull,
    p: 'Sin la tapa del radiador, el motor anda hasta que la manguera superior se calienta. El aire atrapado sube y sale en burbujas por la boca; la válvula de purga del termostato deja pasar el que queda en el múltiple, y el nivel baja.' },
  { t: 'Completar y poner la tapa', cap: true, run: true, fluid: 'mix', level: [0.86, 1], hot: [86, 86], resLevel: CK.resFull,
    p: 'Con el motor en ralentí se completa hasta la base del cuello y se pone la tapa del radiador con su oreja alineada con el tubo que va al depósito.' },
  { t: 'Revisar el nivel en frío', cap: true, fluid: 'mix', level: [1, 1], hot: [40, 20], resLevel: 0.42, marks: true,
    p: 'Con el motor frío, el nivel se mira en el depósito, levantando el asiento del conductor: debe quedar entre LOW y FULL. Si está bajo LOW se rellena por la tapa del depósito, nunca por la del radiador.' },
];
