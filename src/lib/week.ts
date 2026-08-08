// Portado 1:1 desde la app original (Index.html) para mantener las mismas
// claves de semana/fecha y no romper la comparación con datos históricos.

export function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function wk(date = new Date()): string {
  const d = new Date(date);
  const w = Math.ceil(d.getDate() / 7);
  return `${d.getFullYear()}-${d.getMonth() + 1}-w${w}`;
}

export function pwk(date = new Date()): string {
  const d = new Date(date);
  d.setDate(d.getDate() - 7);
  return wk(d);
}

// Clave compuesta usada en los Json de cierre/mise (ej: "AREA||tarea")
export function bk(a: string, b: string): string {
  return `${a}||${b}`;
}
