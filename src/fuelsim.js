// Alimentación del SK410: del pedal a la mezcla que entra al motor.
// Carburador de un cuerpo y tiro horizontal (manual secc. 4): cuba con flotador y válvula de aguja, circuito lento (ralentí)
// con solenoide de corte, circuito principal con venturi y tubo de emulsión, enriquecedor por vacío, bomba de aceleración
// y ahogador manual por piola. La bomba de bencina es eléctrica y lo que sobra vuelve al estanque por el retorno.
// Las cifras (rpm, vacío, mezcla, consumo) son valores típicos para mostrar proporciones; el ralentí (900 rpm), el vacío en
// ralentí (45–50 cmHg) y el caudal de la bomba (más de 500 cm³/min) son del manual.

export const FK = {
  idle: 900, redline: 5500,
  vacIdle: 48,                 // cmHg en ralentí (manual: 45–50)
  disp: 0.97,                  // litros
  pump: 500,                   // cm³/min que entrega la bomba (manual: más de 500)
  tank: 37,                    // litros
  afr: { ideal: 14.7, idle: 13.5, cruise: 15.2, power: 12.6 },
  dens: 745,                   // g/L de bencina
};

export const FFAILS = {
  ok: { name: 'Todo bien' },
  filtro: { name: 'Filtro de bencina tapado' },
  bomba: { name: 'Bomba de bencina débil' },
  aguja: { name: 'Aguja del flotador que no cierra' },
  aire: { name: 'Entrada de aire falsa' },
  solenoide: { name: 'Solenoide de corte sin corriente' },
  filtroaire: { name: 'Filtro de aire sucio' },
};

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const sst = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

// pedal 0–1 · choke 0–1 (perilla tirada) · engine 'frio' | 'caliente' · on: contacto puesto y motor en marcha
export function fuelSolve({ pedal = 0, choke = 0, engine = 'caliente', fail = 'ok', on = true, level = 0.6 }) {
  const cold = engine === 'frio';
  const fast = choke > 0.05 ? 0.035 + 0.05 * choke : 0;          // la leva de ralentí rápido entreabre la mariposa
  const throttle = clamp(0.015 + fast + 0.985 * pedal, 0, 1);    // apertura de la mariposa (0–1)
  // circuitos: cuánto aporta cada uno
  const idleOpen = fail !== 'solenoide';                          // el solenoide abre el circuito lento con el contacto puesto
  const slow = (1 - sst(0.1, 0.35, pedal)) * (idleOpen ? 1 : 0);
  const main = sst(0.06, 0.3, pedal);
  let vac = on ? 4 + (FK.vacIdle - 4) * Math.pow(1 - pedal, 1.6) : 0;
  if (fail === 'aire') vac *= 0.82;
  const power = on ? sst(14, 8, vac) : 0;                         // el enriquecedor abre cuando cae el vacío
  // ¿se mantiene en marcha?
  let stall = null;
  if (on && !idleOpen && pedal < 0.08) stall = 'solenoide';
  if (on && level <= 0.005) stall = 'estanque';
  const running = on && !stall;
  let rpm = running ? FK.idle + (FK.redline - FK.idle) * Math.pow(pedal, 0.85) + (choke > 0.05 ? 500 * choke : 0) : 0;
  if (fail === 'aire' && running) rpm += 250 * (1 - pedal);
  // aire y bencina
  const map = 1 - vac / 76;
  let air = running ? 0.5 * FK.disp * (rpm / 60) * 1.2 * map * (0.55 + 0.3 * pedal) : 0;   // g/s
  if (fail === 'filtroaire') air *= 1 - 0.22 * pedal;
  let afr = FK.afr.idle + (FK.afr.cruise - FK.afr.idle) * sst(0.08, 0.3, pedal) - (FK.afr.cruise - FK.afr.power) * power;
  const chokeRich = 0.42 * choke;                                 // el ahogador tapa el aire: la depresión saca más bencina
  afr *= 1 - chokeRich;
  if (cold) afr *= 1.22;                                          // en frío la bencina se pega a las paredes: llega menos al cilindro
  if (fail === 'aire') afr *= 1 + 0.26 * (1 - pedal);
  if (fail === 'filtroaire') afr *= 1 - 0.16 * (0.3 + 0.7 * pedal);
  if (fail === 'aguja') afr *= 0.78;
  // suministro: lo que la bomba alcanza a traer contra lo que el motor pide
  const demand = running ? air / afr : 0;                         // g/s de bencina
  const supplyMax = (FK.pump / 60 / 1000) * FK.dens * (fail === 'bomba' ? 0.16 : fail === 'filtro' ? 0.22 : 1) * (on ? 1 : 0);   // g/s
  const starve = running ? clamp((demand - supplyMax) / Math.max(demand, 1e-6), 0, 1) : 0;
  if (starve > 0) afr /= 1 - 0.75 * starve;
  const bowl = !on ? 0.5 : fail === 'aguja' ? 0.95 : clamp(0.5 - 0.42 * sst(0, 0.5, starve), 0.05, 0.6);   // nivel de la cuba (0–1; 0,5 = correcto)
  const used = running ? Math.min(demand, supplyMax) : 0;
  const ret = on ? Math.max(0, supplyMax - used) * (fail === 'aguja' ? 0.5 : 1) : 0;
  const lph = used / FK.dens * 3600;
  // diagnóstico de la mezcla
  const state = !running ? 'off' : afr < 10.5 ? 'muyrica' : afr < 12.3 ? 'rica' : afr <= 15.6 ? 'ok' : afr <= 17.5 ? 'pobre' : 'muypobre';
  const powerK = running ? clamp(1 - Math.abs(afr - 12.8) / 9, 0.2, 1) * (1 - 0.6 * starve) * (fail === 'filtroaire' ? 1 - 0.2 * pedal : 1) : 0;
  return { pedal, choke, engine, fail, on, cold, running, stall, throttle, fast, slow: running ? slow : 0, main: running ? main : 0, power: running ? power : 0,
    vac: running ? vac : 0, rpm, air, afr: running ? afr : null, state, demand, used, supplyMax, ret, starve, bowl, lph, powerK, level,
    pumpOn: on, feed: on ? Math.min(1, (used + ret) / ((FK.pump / 60 / 1000) * FK.dens)) : 0 };
}

export const MIXTXT = { off: 'Motor detenido', muyrica: 'Muy rica', rica: 'Rica', ok: 'Correcta', pobre: 'Pobre', muypobre: 'Muy pobre' };
