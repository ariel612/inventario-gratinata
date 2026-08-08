"use client";

import { useEffect, useState, useTransition } from "react";
import { getMiseHistorialAction } from "@/lib/actions/mise";

type Item = { n: string; linea: string; repuesto: string; producir: string; hecho: boolean };
type HistorialItem = { id: string; fecha: string; items: Item[] };

export default function MiseHistorialView() {
  const [items, setItems] = useState<HistorialItem[]>([]);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    startTransition(async () => {
      setItems(await getMiseHistorialAction());
    });
  }, []);

  if (pending) return <div className="px-4 py-6 text-center text-xs text-sub">Cargando...</div>;
  if (items.length === 0)
    return <div className="px-4 py-6 text-center text-xs text-sub">No hay historial guardado</div>;

  return (
    <div className="px-4 pb-8 pt-3">
      {items.map((d) => {
        const done = d.items.filter((i) => i.hecho);
        return (
          <div key={d.id} className="mb-3.5 border-b border-dashed border-line pb-3">
            <div className="mb-1.5 flex items-center justify-between">
              <div className="text-[12.5px] font-bold">{d.fecha}</div>
              <span className="text-[11px] font-bold text-accent">
                {done.length}/{d.items.length}
              </span>
            </div>
            {d.items.map((i, idx) => (
              <div
                key={idx}
                className={`py-0.5 text-[11.5px] ${i.hecho ? "text-sub line-through" : "text-text"}`}
              >
                {i.hecho ? "[X] " : "[ ] "}
                {i.n}
                {i.producir ? ` — producir:${i.producir}` : ""}
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}
