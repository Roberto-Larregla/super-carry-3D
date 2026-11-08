// Física simple del freno del SK410: del pie a la desaceleración.
// Las cotas del manual (pistón del caliper, disco, tambor, pedal) son exactas; las marcadas "est." son valores típicos
// de un furgón de esta época y sirven para que las proporciones se vean bien, no para calcular un frenado real.

export const BK = {
  pedalRatio: 3.2,          // est.: palanca del pedal
  servoRatio: 2.5,          // est.: servofreno de 6" de un diafragma
  servoMax: 1100,           // N, est.: ayuda máxima con ≈0,6 bar de vacío sobre el diafragma de 6,0" (manual)
  mcBore: 0.02064,          // m, est.: bomba de 13/16"
  calBore: 0.0511,          // m: pistón del caliper 51,1 mm (manual)
  wcBore: 0.01746,          // m, est.: cilindro de rueda de 11/16"
  discR: 0.1075, rEff: 0.085,   // m: disco de 215 mm (manual); radio efectivo de las pastillas (est.)
  drumR: 0.110,             // m: tambor de 220 mm (manual)
  shoeFactor: 2.0,          // est.: zapatas primaria y secundaria
  muPad: 0.38, muTire: 0.8, muSlide: 0.65,
  tireR: 0.28,              // m: 175/70 R13 bajo carga
  mass: 860,                // kg, est.: furgón vacío con conductor
  cgH: 0.65, frontShare: 0.48, wb: 1.84,
  dspG: 0.40, dspSlope: 0.3,   // válvula DSP (est.): sobre ~0,4 g la presión trasera sube a un 30 %
  pedalHeight: 165,         // mm, est.: del piso a la pisadera
  freePlay: 4,              // mm: juego libre 1–8 (manual)
  reserveMin: 95,           // mm: con 30 kg debe quedar a 95 mm o más del piso (manual)
  pad: [15.5, 6.5], lining: [7.0, 3.0], disc: [10, 8.5],   // nuevo / límite (manual)
  hbMax: 2300,              // N, est.: fuerza del freno de mano en las ruedas traseras
};
const G = 9.81, area = d => Math.PI * d * d / 4;
const A_MC = area(BK.mcBore), A_CAL = area(BK.calBore), A_WC = area(BK.wcBore);
// fuerza de frenado (N en el suelo) por bar de presión, por eje
const KF = 2 * (2 * BK.muPad * A_CAL * BK.rEff) / BK.tireR * 1e5;
const KR = 2 * (A_WC * BK.shoeFactor * BK.drumR) / BK.tireR * 1e5;

export const FAILS = {
  ok:    { name: 'Todo bien' },
  del:   { name: 'Circuito delantero cortado' },
  tras:  { name: 'Circuito trasero cortado' },
  aire:  { name: 'Aire en las cañerías' },
  vacio: { name: 'Servofreno sin vacío' },
};

// Desgaste: w = 0 nuevo, 1 en el límite del manual, hasta 1,15 (bajo el mínimo)
export function wearState(w) {
  const lerp = ([a, b]) => a + (b - a) * w;
  const pad = lerp(BK.pad), lining = lerp(BK.lining), disc = lerp(BK.disc);
  // los pistones avanzan lo que se gasta y el líquido baja en el depósito (manual: un descenso leve es normal)
  const calVol = 2 * A_CAL * ((BK.pad[0] - pad) * 2 + (BK.disc[0] - disc)) / 1000 * 1e6;   // mL, dos calipers
  const wcVol = 2 * A_WC * (BK.lining[0] - lining) * 2 / 1000 * 1e6;
  const drop = calVol + wcVol;                     // mL
  const level = Math.max(0, 1 - drop / 95);        // 1 = MAX, 0 = MIN (≈95 mL entre marcas, est.)
  return { pad, lining, disc, drop, level, padLow: pad < BK.pad[1] + 0.5, liningLow: lining < BK.lining[1] + 0.3, discLow: disc < BK.disc[1] + 0.2, metal: w > 1.02 };
}

// Freno de mano: muescas de la palanca → fuerza y pendiente que sostiene
export function handbrake(notches, stretched) {
  const n0 = stretched ? 5 : 2, n1 = stretched ? 10 : 6;
  const e = Math.max(0, Math.min(1, (notches - n0) / (n1 - n0)));
  const F = e * BK.hbMax;
  const s = Math.min(1, F / (BK.mass * G));
  const grade = s > 0 ? Math.tan(Math.asin(s)) * 100 : 0;
  return { e, F, grade, full: n1, start: n0, outOfSpec: n1 > 8 };
}

// pie (N) → presiones (bar), desaceleración (g), recorrido del pedal (mm)
export function solve({ force = 0, fail = 'ok', wear = 0 }) {
  const rod = force * BK.pedalRatio;
  const assist = fail === 'vacio' ? 0 : Math.min(rod * (BK.servoRatio - 1), BK.servoMax);
  const out = Math.max(0, rod + assist - 40);       // 40 N: resortes de retorno
  let p = out / A_MC / 1e5;                         // bar
  // recorrido del pedal en la pisadera (mm): juego libre + lo que desplaza el líquido
  const hyd = p => 52 * Math.pow(Math.min(p, 160) / 120, 0.6);
  let travel = force > 0 ? BK.freePlay + hyd(p) : 0;
  let floor = false;
  if (force > 0) {
    if (fail === 'del' || fail === 'tras') travel += 45 * Math.min(1, force / 60);   // un pistón avanza hasta topar
    if (fail === 'aire') travel += 52 * (1 - Math.exp(-force / 80));             // el aire se comprime antes que el líquido
  }
  const maxTravel = BK.pedalHeight - 18;              // la pisadera topa con la alfombra
  if (travel > maxTravel) { p *= Math.max(0, 1 - (travel - maxTravel) / 40); travel = maxTravel; floor = true; }
  let pf = fail === 'del' ? 0 : p, pr = fail === 'tras' ? 0 : p;
  // válvula DSP: sobre cierta desaceleración limita el aumento de presión atrás
  let dsp = false;
  const aLin = (KF * pf + KR * pr) / (BK.mass * G);
  if (pr > 0 && aLin > BK.dspG) {
    const pStar = BK.dspG * BK.mass * G / (KF * (pf > 0 ? 1 : 0) + KR);
    if (pr > pStar) { pr = pStar + BK.dspSlope * (pr - pStar); dsp = true; }
  }
  // pastillas bajo el mínimo: el metal roza y el roce cae
  const wst = wearState(wear);
  const muK = wst.metal ? 0.72 : 1;
  let Ff = KF * pf * muK, Fr = KR * pr;
  // traspaso de peso y bloqueo de ruedas
  const W = BK.mass * G;
  let a = 0, lockF = false, lockR = false;
  for (let i = 0; i < 6; i++) {
    const dN = BK.mass * a * G * BK.cgH / BK.wb;
    const Nf = W * BK.frontShare + dN, Nr = W * (1 - BK.frontShare) - dN;
    const ff = Ff > BK.muTire * Nf ? (lockF = true, BK.muSlide * Nf) : Ff;
    const fr = Fr > BK.muTire * Nr ? (lockR = true, BK.muSlide * Nr) : Fr;
    a = (ff + fr) / W;
  }
  const v = 50 / 3.6;
  const dist = a > 0.005 ? v * v / (2 * a * G) : Infinity;
  const reserve = BK.pedalHeight - travel;
  return { force, kg: force / G, rod, assist, out, p, pf, pr, dsp, a, lockF, lockR, dist, travel, reserve, floor, fail, wear: wst,
    pedal: Math.min(1, travel / maxTravel), runout: fail !== 'vacio' && rod * (BK.servoRatio - 1) > BK.servoMax };
}
