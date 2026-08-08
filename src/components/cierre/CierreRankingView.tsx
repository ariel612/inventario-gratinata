"use client";

import { useEffect, useState, useTransition } from "react";
import { Area } from "@/generated/prisma/enums";
import { getRankingAction } from "@/lib/actions/cierre";

type RankRow = { nombre: string; cantidad: number; nivel: string };

export default function CierreRankingView({ depto }: { depto: Area }) {
  const [rows, setRows] = useState<RankRow[]>([]);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    startTransition(async () => {
      setRows(await getRankingAction({ depto }));
    });
  }, [depto]);

  if (pending) return <div className="px-4 py-6 text-center text-xs text-sub">Cargando...</div>;
  if (rows.length === 0)
    return <div className="px-4 py-6 text-center text-xs text-sub">Aún no hay cierres registrados</div>;

  return (
    <div className="px-4 pb-8 pt-3">
      {rows.map((r, i) => (
        <div key={r.nombre} className="flex items-center gap-2.5 border-b border-dotted border-line-soft py-2">
          <div className="w-5 text-[13px] font-bold">{i + 1}</div>
          <div className="min-w-0 flex-1">
            <div className="text-[12.5px] font-bold uppercase">{r.nombre}</div>
            <div className="text-[10px] tracking-wide text-accent">{r.nivel}</div>
          </div>
          <div className="text-[13px] font-bold">{r.cantidad}</div>
        </div>
      ))}
    </div>
  );
}
