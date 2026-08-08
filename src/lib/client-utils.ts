// Utilidades de cliente portadas 1:1 desde la app original.

export function stepOf(min: number): number {
  if (min >= 50) return 10;
  if (min >= 20) return 5;
  return 1;
}

export function buzz(ms: number | number[] = 12) {
  try {
    if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(ms);
  } catch {
    // ignora dispositivos sin soporte
  }
}
