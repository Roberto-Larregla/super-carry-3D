// Tren motriz del SK410: dientes y relaciones del manual (secc. 13 y 15) y un modelo simple de motor, embrague y furgón
// para la vista Transmisión. Las relaciones son exactas; par, masa, roce y capacidad del embrague son valores típicos.
import { TIRES } from './data.js';

export const DK = {
  prim: [23, 35],                                                          // engranaje de mando (eje de entrada) → contraeje: 35/23 = 1,521
  pair: { 1: [15, 36], 2: [25, 32], 3: [31, 29], 5: [44, 23], R: [18, 41] },   // [contraeje, eje principal]
  idler: 20,                                                               // piñón loco de marcha atrás (dientes supuestos: no cambia la relación)
  final: [8, 41],                                                          // piñón / corona: 41/8 = 5,125
  side: [10, 14],                                                          // satélite / planetario (supuestos)
  idle: 900, redline: 5500, tq: 73.5, mass: 950, eta: 0.9,
  rw: TIRES[0].c / (2 * Math.PI),                                          // radio de rodadura del 175/70 R13
  travel: 0.014, gap: 0.0025, push: 0.0062,                                // collarín: recorrido total, luz en reposo y lo que hunde el diafragma para soltar (m, a escala del modelo)
  cap: 115,                                                                // par que aguanta el embrague sano (N·m)
  pedalMM: 135,                                                            // recorrido del pedal (mm, aprox.)
};
export const FINALR = DK.final[1] / DK.final[0];
export const PRIM = DK.prim[1] / DK.prim[0];
// relación total de la caja; la marcha atrás va con signo negativo
export const gearRatio = g => (g === 'N' ? 0 : g === 4 ? 1 : PRIM * DK.pair[g][1] / DK.pair[g][0] * (g === 'R' ? -1 : 1));
export const GNAME = { N: 'Punto muerto', 1: '1.ª', 2: '2.ª', 3: '3.ª', 4: '4.ª', 5: '5.ª', R: 'Marcha atrás' };
export const DFAILS = {
  ok: { name: 'Todo bien' },
  disco: { name: 'Disco de embrague gastado' },
  juego0: { name: 'Piola sin juego libre' },
  estirada: { name: 'Piola con demasiado juego' },
  sincro: { name: 'Sincronizador de 2.ª gastado' },
  cruceta: { name: 'Cruceta con juego' },
};

// pedal (0 suelto … 1 a fondo) → cuánto avanza el collarín y cuánto levanta la prensa (0 apretada … 1 suelta)
export function clutchLift(k, fail) {
  const slack = fail === 'estirada' ? 0.45 : 0, gap = fail === 'juego0' ? -0.0026 : DK.gap;
  const travel = DK.travel * Math.max(0, k - slack);
  return { travel, gap, slack, lift: Math.min(1, Math.max(0, (travel - gap) / DK.push)), free: Math.min(1, slack + Math.max(0, gap) / DK.travel) };
}
export const clutchCap = (k, fail) => DK.cap * (fail === 'disco' ? 0.42 : 1) * Math.pow(1 - clutchLift(k, fail).lift, 1.5);

const engTq = (t, rpm) => (rpm > DK.redline ? 0 : t * DK.tq * Math.max(0.35, 1 - Math.pow((rpm - 3000) / 4300, 2)));
const fric = rpm => (rpm > 1 ? 5 + rpm * 0.0026 : 0);
const RAD = Math.PI / 30;

// Avanza el estado s = { on, rpm, v, vs, wIn, gear, clutch, throttle, fail, noGrip, brake } en dt segundos.
// v: velocidad del furgón (m/s, negativa hacia atrás) · vs: velocidad de la rueda que patina cuando no hay agarre.
export function driveStep(s, dt) {
  const n = 8, h = dt / n, G = gearRatio(s.gear) * FINALR, cap = clutchCap(s.clutch, s.fail);
  let tc = 0, slip = 0;
  for (let i = 0; i < n; i++) {
    const we = s.rpm * RAD;
    const te = s.on ? Math.max(s.throttle, Math.min(0.5, Math.max(0, (DK.idle + 40 - s.rpm) / 250))) : 0;
    const Te = engTq(te, s.rpm) - fric(s.rpm);
    if (!s.noGrip) s.vs = s.v;
    if (G) {
      const wi = (s.noGrip ? s.vs : s.v) / DK.rw * G;
      tc = Math.max(-cap, Math.min(cap, (we - wi) * 12));
      slip = we - wi;
      const F = tc * G * DK.eta / DK.rw;
      if (s.noGrip) s.vs += F / 320 * h; else s.v += F / DK.mass * h;       // la rueda suelta pesa poco; 320 kg equivalentes mantienen estable el cálculo
      s.wIn = wi;
    } else {
      tc = 0; slip = 0;
      s.wIn += ((cap > 4 ? we : 0) - s.wIn) * Math.min(1, h * (cap > 4 ? 9 : 0.8));   // en punto muerto el eje de entrada sigue al motor, o se va frenando en el aceite
    }
    s.rpm = Math.max(0, s.rpm + (Te - tc) / 0.13 * h / RAD);
    // resistencias: rodadura, aire y freno
    const dec = (v, a) => { const d = a * h; return Math.abs(v) <= d ? 0 : v - Math.sign(v) * d; };
    s.v = dec(s.v, 0.015 * 9.81 + 0.6 * s.v * s.v / DK.mass + (s.brake ? 3.2 : 0));
    if (s.noGrip) s.vs = dec(s.vs, 0.4);
  }
  if (s.on && s.rpm < 380) { s.on = false; s.stalled = true; }
  const vv = s.noGrip ? s.vs : s.v, lift = clutchLift(s.clutch, s.fail);
  const state = !G ? (cap > 4 ? 'neutro' : 'libre') : lift.lift >= 0.999 || cap < 0.5 ? 'libre' : Math.abs(tc) >= cap - 0.01 && Math.abs(slip) > 1.5 ? 'patina' : 'acoplado';   // patina cuando pide más par del que aguanta
  return {
    on: s.on, stalled: !!s.stalled, gear: s.gear, rpm: s.rpm, kmh: s.v * 3.6, throttle: s.throttle, clutch: s.clutch, fail: s.fail, noGrip: !!s.noGrip,
    rpmIn: s.wIn / RAD, rpmCounter: s.wIn / RAD / PRIM, rpmOut: vv / DK.rw * FINALR / RAD, rpmWheel: vv / DK.rw / RAD,
    ratio: gearRatio(s.gear), total: G, tc, cap, lift: lift.lift, free: lift.free, state, slip: slip / RAD,
    wheelTq: tc * Math.abs(G) * DK.eta,
  };
}
