// Calefacción del SK410: de los mandos a la temperatura de cada salida.
// Tipo agua caliente (manual secc. 7): la palanca COOL–HOT abre por cable la llave de agua del radiador de calefacción;
// el ventilador tiene 3 velocidades (1 y 2 por la resistencia, 3 con 12 V directos). En este furgón el aire que pasa
// por el radiador sale a los pies (y al parabrisas) y las rejillas de arriba reciben aire que no pasa por él (dueño).
// En modo parabrisas casi no sale aire por el vidrio (dueño): se puede simular con la falla de la compuerta.
// Temperaturas, caudales y potencias son valores típicos para mostrar proporciones.

export const HK = {
  amb: 10,                 // °C afuera (un día frío)
  cabin: 16,               // °C en la cabina, para la recirculación
  tw: { caliente: 85, frio: 25, termostato: 55 },   // agua del motor (termostato abre a 82 °C, manual)
  fan: [0, 0.38, 0.65, 1], // caudal relativo por velocidad
  qMax: 200,               // m³/h en la 3 (estimado)
};

export const MODES = {
  cara:  { name: 'Cara', icon: 'cara', core: 0, foot: 0, def: 0 },
  bi:    { name: 'Cara y pies', icon: 'bi', core: 0.5, foot: 1, def: 0 },
  pies:  { name: 'Pies', icon: 'pies', core: 1, foot: 0.85, def: 0.15 },
  vidrio:{ name: 'Parabrisas', icon: 'vidrio', core: 1, foot: 0.25, def: 0.75 },
};
export const HFAILS = {
  ok: { name: 'Todo bien' },
  termostato: { name: 'Termostato pegado abierto' },
  llave: { name: 'Llave de agua trabada' },
  resistencia: { name: 'Resistencia cortada' },
  radiador: { name: 'Radiador de calefacción tapado' },
  desempanador: { name: 'Compuerta del parabrisas desajustada' },
};

export function heatSolve({ mode = 'pies', recirc = true, temp = 1, fan = 2, engine = 'caliente', fail = 'ok', on = true }) {
  const M = MODES[mode];
  const Tw = !on ? HK.amb + 5 : engine === 'frio' ? HK.tw.frio : fail === 'termostato' ? HK.tw.termostato : HK.tw.caliente;
  const valve = fail === 'llave' ? 0 : temp;                      // apertura de la llave
  const fanEff = !on ? 0 : fail === 'resistencia' && fan > 0 && fan < 3 ? 0 : fan;
  const Q = HK.fan[fanEff];
  const Tin = recirc ? HK.cabin : HK.amb;
  // radiador: más eficaz con poco aire; con la llave cerrada casi no calienta
  const eps = (0.8 - 0.22 * Q) * (fail === 'radiador' ? 0.38 : 1) * Math.sqrt(valve);
  const waterFlow = on ? valve * (fail === 'radiador' ? 0.35 : 1) : 0;
  const Thot = Tin + eps * Math.max(0, Tw - Tin);
  const flowCore = Q * M.core, flowFace = Q * (1 - M.core);
  // con la compuerta desajustada no llega a la posición del parabrisas: casi todo sigue saliendo a los pies
  const def = fail === 'desempanador' ? Math.min(M.def, 0.08) : M.def, foot = M.foot + (M.def - def);
  const out = {
    cara: flowFace > 0.001 ? Tin + 0.6 * Q : null,
    pies: flowCore * foot > 0.001 ? Thot : null,
    vidrio: flowCore * def > 0.001 ? Thot : null,
  };
  const flows = { cara: flowFace, pies: flowCore * foot, vidrio: flowCore * def };
  const kW = (Q * HK.qMax / 3600) * 1.2 * 1.005 * M.core * Math.max(0, Thot - Tin);
  const Tret = waterFlow > 0.01 ? Tw - Math.min(14, kW * 4.5 / Math.max(0.15, waterFlow)) : Tw;
  return { mode, recirc, temp, fan, fanEff, engine, fail, on, Tw, Tret, valve, waterFlow, Q, m3h: Q * HK.qMax, Tin, Thot, eps, out, flows, kW,
    resistorOn: fanEff === 1 || fanEff === 2 };
}

// color de una temperatura: azul frío → crema → rojo caliente (en hex)
export function tempColor(t) {
  const st = [[5, [61, 143, 209]], [22, [214, 222, 226]], [40, [235, 168, 92]], [65, [217, 72, 43]]];
  if (t <= st[0][0]) return st[0][1];
  for (let i = 1; i < st.length; i++) if (t <= st[i][0]) { const [a, ca] = st[i - 1], [b, cb] = st[i], k = (t - a) / (b - a); return ca.map((v, j) => Math.round(v + (cb[j] - v) * k)); }
  return st[st.length - 1][1];
}
