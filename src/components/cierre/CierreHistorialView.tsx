"use client";

import { useEffect, useState, useTransition } from "react";
import { Area } from "@/generated/prisma/enums";
import { getCierreHistorialAction, deleteCierreHistorialAction } from "@/lib/actions/cierre";

type AreaSnapshot = { n: string; t: string[] };
type HistorialItem = {
  id: string;
  nombre: string;
  fecha: string;
  tareas: Record<string, boolean>;
  areasSnapshot: AreaSnapshot[];
};

export default function CierreHistorialView({ depto }: { depto: Area }) {
  const [items, setItems] = useState<HistorialItem[]>([]);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    startTransition(async () => {
      setItems(await getCierreHistorialAction({ depto }));
    });
  }, [depto]);

  async function handleDelete(id: string) {
    if (!confirm("¿Eliminar este checklist guardado? No se puede deshacer.")) return;
    await deleteCierreHistorialAction({ id, depto });
    setItems((prev) => prev.filter((p) => p.id !== id));
  }

  if (pending) return <div className="px-4 py-6 text-center text-[13px] text-sub">Cargando...</div>;
  if (items.length === 0)
    return <div className="px-4 py-6 text-center text-[13px] text-sub">No hay checklists guardados</div>;

  return (
    <div className="px-4 pb-8 pt-3">
      {items.map((d) => {
        let totTareas = 0;
        let doneTareas = 0;
        const detalle = d.areasSnapshot.map((g) => {
          const doneG = g.t.filter((tk) => d.tareas[`${g.n}||${tk}`]);
          const pend = g.t.filter((tk) => !d.tareas[`${g.n}||${tk}`]);
          totTareas += g.t.length;
          doneTareas += doneG.length;
          const completo = g.t.length > 0 && pend.length === 0;
          return { nombre: g.n, doneG, total: g.t.length, completo, pend };
        });
        const pct = totTareas > 0 ? Math.round((doneTareas / totTareas) * 100) : 0;

        return (
          <div key={d.id} className="mb-3.5 border-b border-line pb-3">
            <div className="mb-1.5 flex items-center justify-between">
              <div>
                <div className="text-[13.5px] font-semibold">{d.nombre}</div>
                <div className="text-[11.5px] text-sub">{d.fecha}</div>
              </div>
              <div className="flex flex-shrink-0 items-center gap-1.5">
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                    pct === 100 ? "bg-ok-soft text-ink" : "bg-warn-soft text-warn"
                  }`}
                >
                  {pct}% ({doneTareas}/{totTareas})
                </span>
                <button
                  type="button"
                  onClick={() => handleDelete(d.id)}
                  className="border border-danger bg-danger-soft px-2 py-1 text-[11px] font-bold text-danger"
                >
                  Eliminar
                </button>
              </div>
            </div>
            {detalle.map((g) => (
              <div key={g.nombre} className="py-0.5 text-xs">
                <b>{g.nombre}</b>: {g.doneG.length}/{g.total} —{" "}
                {g.total === 0 ? (
                  "sin tareas"
                ) : g.completo ? (
                  <span className="text-ink">completo</span>
                ) : (
                  <span className="text-danger">pendiente: {g.pend.join(", ")}</span>
                )}
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}
