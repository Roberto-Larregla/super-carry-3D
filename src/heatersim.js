// Calefacción del SK410: de los mandos a la temperatura de cada salida.
// Tipo agua caliente (manual secc. 7): la palanca COOL–HOT abre por cable la llave de agua del radiador de calefacción;
// el ventilador tiene 3 velocidades (1 y 2 por la resistencia, 3 con 12 V directos). En este furgón el aire que pasa
// por el radiador sale a los pies (y al parabrisas) y las rejillas de arriba reciben aire que no pasa por él (dueño).
// En modo parabrisas casi no sale aire por el vidrio (dueño): se puede simular con la falla de la compuerta.
// El agua es la del único motor del modelo (coolsim.js): su temperatura, el caudal que llega a la llave y las fallas
// del circuito vienen de ahí, y el calor que saca este radiador es el mismo que pierde el motor.
// Temperaturas, caudales y potencias son valores típicos para mostrar proporciones.

import { cabinOf } from './motor.js';

export const HK = {
  fan: [0, 0.38, 0.65, 1], // caudal relativo por velocidad
  qMax: 200,               // m³/h en la 3 (estimado)
  cpW: 3.6 * 1.04 / 60,    // kW/K por L/min de mezcla 50/50
};

export const MODES = {
  cara:  { name: 'Cara', icon: 'cara', core: 0, foot: 0, def: 0 },
  bi:    { name: 'Cara y pies', icon: 'bi', core: 0.5, foot: 1, def: 0 },
  pies:  { name: 'Pies', icon: 'pies', core: 1, foot: 0.85, def: 0.15 },
  vidrio:{ name: 'Parabrisas', icon: 'vidrio', core: 1, foot: 0.25, def: 0.75 },
};
// fallas que se eligen en la vista Calefacción (los nombres están en coolsim.js: son las mismas del circuito de agua)
export const HFAIL_IDS = ['ok', 'abierto', 'aire', 'llave', 'radiador', 'resistencia', 'desempanador'];

// radiador de calefacción: el aire que cruza las aletas y el agua que pasa por los tubos, en serie.
// Lo usan las dos vistas: Calefacción para las salidas de aire y Refrigeración para el calor que pierde el motor.
export function heaterCore({ Tw, Tin, fan, mode, fail = 'ok', flowW }) {
  const fanEff = fail === 'resistencia' && fan > 0 && fan < 3 ? 0 : fan;
  const Q = HK.fan[fanEff] || 0, M = MODES[mode] || MODES.pies;
  const Cair = Q * HK.qMax / 3600 * 1.2 * 1.005 * M.core;              // kW/K del aire que pasa por el radiador
  const eps = (0.8 - 0.22 * Q) * (fail === 'radiador' ? 0.38 : 1);    // más eficaz con poco aire; tapado, mucho menos
  const Cw = Math.max(0, flowW || 0) * HK.cpW;                         // kW/K del agua que llega
  const dT = Math.max(0, Tw - Tin);
  const kW = Cair > 1e-6 && Cw > 1e-6 ? dT / (1 / (Cair * eps) + 1 / (0.9 * Cw)) : 0;
  return { fanEff, Q, Cair, kW, Thot: Cair > 1e-6 ? Tin + kW / Cair : Tin, Tret: Cw > 1e-6 ? Tw - kW / Cw : Tw };
}

// Tw: agua del motor (°C); flowW: L/min que pasan por la llave; amb: °C afuera; on: motor en marcha
export function heatSolve({ mode = 'pies', recirc = true, temp = 1, fan = 2, fail = 'ok', on = false, ign, Tw = 20, flowW = 0, amb = 18 }) {
  const fanOn = ign ?? on;   // el ventilador va con el contacto (fusible IG); el agua caliente, con el motor en marcha
  const M = MODES[mode];
  const valve = fail === 'llave' ? 0 : temp;                      // apertura de la llave
  const Tin = recirc ? cabinOf(amb) : amb;
  const core = heaterCore({ Tw, Tin, fan: fanOn ? fan : 0, mode, fail, flowW: on ? flowW : 0 });
  const { fanEff, Q, kW, Thot } = core;
  const flowCore = Q * M.core, flowFace = Q * (1 - M.core);
  // con la compuerta desajustada no llega a la posición del parabrisas: casi todo sigue saliendo a los pies
  const def = fail === 'desempanador' ? Math.min(M.def, 0.08) : M.def, foot = M.foot + (M.def - def);
  const out = {
    cara: flowFace > 0.001 ? Tin + 0.6 * Q : null,                // el motor del ventilador entibia un poco el aire
    pies: flowCore * foot > 0.001 ? Thot : null,
    vidrio: flowCore * def > 0.001 ? Thot : null,
  };
  const flows = { cara: flowFace, pies: flowCore * foot, vidrio: flowCore * def };
  const waterFlow = on ? Math.min(1.6, flowW / 6) : 0;           // relativo, para dibujar el agua (≈ 1 con la llave abierta en ralentí)
  return { mode, recirc, temp, fan, fanEff, fail, on, Tw, Tret: core.Tret, valve, flowW: on ? flowW : 0, waterFlow, Q, m3h: Q * HK.qMax, Tin, Thot, out, flows, kW,
    amb, ign: fanOn, resistorOn: fanOn && (fanEff === 1 || fanEff === 2) };
}

// color de una temperatura del aire: azul frío → crema → rojo caliente (el agua usa la escala de coolsim.js)
export function tempColor(t) {
  const st = [[5, [61, 143, 209]], [22, [214, 222, 226]], [40, [235, 168, 92]], [65, [217, 72, 43]]];
  if (t <= st[0][0]) return st[0][1];
  for (let i = 1; i < st.length; i++) if (t <= st[i][0]) { const [a, ca] = st[i - 1], [b, cb] = st[i], k = (t - a) / (b - a); return ca.map((v, j) => Math.round(v + (cb[j] - v) * k)); }
  return st[st.length - 1][1];
}
