// Un solo motor para todo el modelo: lo que comparten las vistas y sus simulaciones.
// F10A con el carburador no catalítico que tiene este furgón (de una versión anterior): ficha UK de 1986, 75 N·m a
// 3.200 rpm y 44 CV (32 kW) a 5.300 rpm. Ralentí de 900 rpm (manual). La masa es la del furgón vacío de la ficha UK
// (785 kg) más el conductor. La temperatura de la cabina sin calefacción es un valor típico.

export const MOTOR = {
  idle: 900, redline: 5500,
  tq: 75, tqRpm: 3200, tqWidth: 4450, tqFloor: 0.35,   // curva de par: máximo a 3.200 rpm; a 5.300 rpm deja ≈ 32 kW
  mass: 860,                                           // kg
  amb: 18,                                             // °C afuera al abrir el modelo
  cabin: 4,                                            // °C que la cabina queda sobre la temperatura de afuera
};

// par a plena carga (N·m) y potencia (kW)
export const torqueAt = rpm => (rpm <= 0 || rpm > MOTOR.redline ? 0 : MOTOR.tq * Math.max(MOTOR.tqFloor, 1 - ((rpm - MOTOR.tqRpm) / MOTOR.tqWidth) ** 2));
export const powerAt = rpm => torqueAt(rpm) * rpm * 2 * Math.PI / 60 / 1000;
export const cabinOf = amb => amb + MOTOR.cabin;

// presiones: el manual usa kg/cm²; los cálculos van en bar
export const BAR_PER_KG = 0.980665;
export const kgcm2 = bar => bar / BAR_PER_KG;
