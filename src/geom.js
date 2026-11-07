// Geometría común del modelo (metros). Ejes del furgón: x hacia adelante, y hacia arriba,
// z hacia la DERECHA (+z = lado acompañante; −z = lado izquierdo = conductor en Chile).
// Marco del motor: x = eje del cigüeñal (+x = polea, adelante), y = eje de los cilindros,
// +z = lado admisión (carburador), −z = lado escape (bujías). El cigüeñal está en (0, 0, 0).
export const WB = 1.84, TF = 1.21, TR = 1.20, RW = 0.28;   // RW: radio bajo carga del 175/70 R13 (Ø libre 575 mm)
export const TILT = -0.87;              // ≈ 50°: culata hacia la izquierda, admisión arriba (ilustrativo)
export const ENG = [-0.24, 0.30, 0.03];  // posición del eje del cigüeñal (cara delantera del block) en el furgón
export const CYL_X = [-0.07, -0.148, -0.226, -0.304]; // cilindros 1..4 (1 = lado polea)
export const FIRE_OFF = [0, 540, 180, 360];           // desfase del ciclo (°) → orden 1-3-4-2
export const DIR = -1;                  // giro horario visto desde la polea

// Cinemática (m): radio de codo = carrera/2; biela y altura de compresión aproximadas
export const R = 0.036, L = 0.115, CH = 0.026, DECK = 0.178, BORE_R = 0.03275;

export function engToWorld([x, y, z]) {
  const c = Math.cos(TILT), s = Math.sin(TILT);
  return [ENG[0] + x, ENG[1] + y * c - z * s, ENG[2] + y * s + z * c];
}

// Ciclo de 4 tiempos: φ = 0 inicio de admisión (PMS)
export const PHASES = [
  { id: 0, name: 'Admisión', color: '#66bdff' },
  { id: 1, name: 'Compresión', color: '#f2c94c' },
  { id: 2, name: 'Explosión', color: '#ff6a3d' },
  { id: 3, name: 'Escape', color: '#9aa2a8' },
];
export const cyclePhi = (thetaDeg, i) => (((thetaDeg - FIRE_OFF[i]) % 720) + 720) % 720;
export const phaseOf = phi => Math.floor(phi / 180) % 4;
