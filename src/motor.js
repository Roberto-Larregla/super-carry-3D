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
  miss: -1,                                            // cilindro sin chispa (0–3; −1: los cuatro encienden). Lo fija la vista Eléctrico
};

// un cilindro sin chispa no empuja y además frena (comprime y roza): queda ≈ 70 % del par
export const fireK = () => (MOTOR.miss >= 0 ? 0.7 : 1);
// par a plena carga (N·m) y potencia (kW)
export const torqueAt = rpm => (rpm <= 0 || rpm > MOTOR.redline ? 0 : fireK() * MOTOR.tq * Math.max(MOTOR.tqFloor, 1 - ((rpm - MOTOR.tqRpm) / MOTOR.tqWidth) ** 2));
export const powerAt = rpm => torqueAt(rpm) * rpm * 2 * Math.PI / 60 / 1000;
export const cabinOf = amb => amb + MOTOR.cabin;

// presiones: el manual usa kg/cm²; los cálculos van en bar
export const BAR_PER_KG = 0.980665;
export const kgcm2 = bar => bar / BAR_PER_KG;

// correa en V: una sola correa mueve la bomba de agua (con el ventilador) y el alternador.
// Radios de paso (m): alternador de 65 mm efectivos (manual secc. 10); cigüeñal y bomba, estimados (los del modelo 3D)
export const PULLEY = { crank: 0.052, pump: 0.045, alt: 0.0325 };
export const PUMP_K = PULLEY.crank / PULLEY.pump;    // ≈ 1,16 vueltas de la bomba por vuelta del cigüeñal
export const ALT_K = PULLEY.crank / PULLEY.alt;      // 1,6 vueltas del alternador por vuelta del cigüeñal
// correa suelta: patina más con carga del motor, con muchas vueltas y con lo que pide el alternador (A)
export const beltSlip = (load, rpm, altA = 0) => Math.min(0.65, Math.max(0, 0.05 + 0.15 * load + rpm / 40000 + 0.003 * altA));

// presión de aceite (kg/cm²): la bomba la mueve el cigüeñal; con aceite frío sube; la válvula de alivio la limita.
// Manual: 3,0–4,5 kg/cm² a 3.000 rpm con el motor caliente; el bulbo enciende la luz bajo 0,2–0,4 kg/cm²
export const OIL = { max: 5.3, lamp: 0.3 };
export const oilPressure = (rpm, cold = false) => (rpm > 0 ? Math.min(OIL.max, 4.5 * (1 - Math.exp(-rpm / 1650)) * (cold ? 1.3 : 1)) : 0);
