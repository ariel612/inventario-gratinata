"use client";

import { useState, useTransition } from "react";
import type { CierreAreaModel, CierreTareaModel } from "@/generated/prisma/models";
import { Area, Role } from "@/generated/prisma/enums";
import {
  getCierreDataAction,
  startTurnoAction,
  cancelTurnoAction,
  toggleTareaAction,
  finalizarTurnoAction,
} from "@/lib/actions/cierre";
import { buzz } from "@/lib/client-utils";
import Toast, { useToast } from "@/components/Toast";
import Confetti from "@/components/Confetti";
import CierreHistorialView from "@/components/cierre/CierreHistorialView";
import CierreAreasView from "@/components/cierre/CierreAreasView";
import CierreRankingView from "@/components/cierre/CierreRankingView";

type CierreAreaWithTareas = CierreAreaModel & { tareas: CierreTareaModel[] };
type AreaSnapshot = { n: string; t: string[] };
type Turno = {
  id: string;
  nombre: string;
  fecha: string;
  tareas: Record<string, boolean>;
  areasSnapshot: AreaSnapshot[];
};

type CierreData = { areas: CierreAreaWithTareas[]; turno: Turno | null };

const DEPTO_LABEL: Record<Area, string> = {
  [Area.COCINA]: "Cocina",
  [Area.RECEPCION]: "Recepción",
};

const SUBTABS = [
  { id: "checklist", label: "Checklist" },
  { id: "historial", label: "Historial" },
  { id: "areas", label: "Areas" },
  { id: "ranking", label: "Ranking" },
] as const;
type SubtabId = (typeof SUBTABS)[number]["id"];

export default function CierreShell({
  role,
  initialDepto,
  initialData,
}: {
  role: Role;
  initialDepto: Area;
  initialData: CierreData;
}) {
  const isAdmin = role === Role.ADMIN;
  const [depto, setDepto] = useState(initialDepto);
  const [data, setData] = useState<CierreData>(initialData);
  const [subtab, setSubtab] = useState<SubtabId>("checklist");
  const [nombreInput, setNombreInput] = useState("");
  const [msg, setMsg] = useState("");
  const [confettiTrigger, setConfettiTrigger] = useState(0);
  const { toast, show: showToast } = useToast();
  const [pending, startTransition] = useTransition();

  function loadDepto(next: Area) {
    startTransition(async () => {
      setData(await getCierreDataAction({ depto: next }));
    });
  }

  function switchDepto(next: Area) {
    if (next === depto) return;
    setDepto(next);
    loadDepto(next);
  }

  function refresh() {
    loadDepto(depto);
  }

  async function handleStart() {
    if (!nombreInput.trim()) return;
    await startTurnoAction({ depto, nombre: nombreInput });
    setNombreInput("");
    refresh();
  }

  async function handleCancel() {
    if (!confirm("¿Cancelar este checklist? Se perderá todo el progreso marcado.")) return;
    await cancelTurnoAction({ depto });
    refresh();
  }

  async function handleToggle(areaNombre: string, tarea: string) {
    if (!data.turno) return;
    buzz(10);
    const key = `${areaNombre}||${tarea}`;
    const nextTareas = { ...data.turno.tareas, [key]: !data.turno.tareas[key] };
    setData((prev) => (prev.turno ? { ...prev, turno: { ...prev.turno, tareas: nextTareas } } : prev));
    await toggleTareaAction({ depto, area: areaNombre, tarea });

    const totTareas = data.turno.areasSnapshot.reduce((a, g) => a + g.t.length, 0);
    const doneTareas = Object.values(nextTareas).filter(Boolean).length;
    if (totTareas > 0 && doneTareas === totTareas) {
      buzz([20, 80, 20, 80, 20]);
      setConfettiTrigger((t) => t + 1);
      showToast("¡Cierre completo!");
    }
  }

  async function handleFinalizar() {
    setMsg("Guardando...");
    try {
      const result = await finalizarTurnoAction({ depto });
      if (result.alerta) {
        window.open(
          `https://wa.me/${result.alerta.alertaWa}?text=${encodeURIComponent(result.alerta.mensaje)}`,
          "_blank"
        );
        setMsg("Guardado, aviso enviado");
      } else {
        setMsg("Checklist guardado");
      }
      setTimeout(() => setMsg(""), 2500);
      refresh();
      setTimeout(() => {
        if (result.nivelSubio) {
          buzz([15, 50, 15, 50, 15, 50, 15]);
          setConfettiTrigger((t) => t + 1);
          showToast(`¡Subiste a ${result.nivelAhora}!`);
        } else {
          buzz(10);
          showToast(`${result.nombre.split(" ")[0]}: ${result.cantidadCierres} cierres (${result.nivelAhora})`);
        }
      }, 1200);
    } catch {
      setMsg("Error");
    }
  }

  const turno = data.turno;
  const cierreTot = data.areas.reduce((a, g) => a + g.tareas.length, 0);
  const cierreFil = turno ? Object.values(turno.tareas).filter(Boolean).length : 0;

  return (
    <div className="pb-8">
      {isAdmin && (
        <div className="mx-4 mb-2.5 flex border-b border-line">
          {(Object.values(Area) as Area[]).map((a) => (
            <button
              key={a}
              type="button"
              onClick={() => switchDepto(a)}
              className={`flex-1 py-2 text-[11px] font-bold uppercase tracking-wide ${
                depto === a ? "bg-ink text-on-ink" : "text-sub"
              }`}
            >
              {DEPTO_LABEL[a]}
            </button>
          ))}
        </div>
      )}

      <div className="flex border-b border-dashed border-line px-4">
        {SUBTABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setSubtab(t.id)}
            className={`flex-1 py-2 text-[10.5px] font-bold uppercase tracking-wide ${
              subtab === t.id ? "bg-ink text-on-ink" : "text-sub"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {pending && <div className="px-4 pt-2 text-[11px] text-sub">Cargando...</div>}

      {!pending && subtab === "checklist" && (
        <div className="px-4 pt-3">
          {msg && <div className="pb-2 text-right text-[10px] text-accent">{msg}</div>}
          {!turno ? (
            <div className="border border-dashed border-line bg-paper p-3.5">
              <label className="mb-1 block text-[10px] uppercase tracking-wide text-sub">
                ¿Quién realizará el checklist?
              </label>
              <input
                placeholder="Nombre y apellido"
                value={nombreInput}
                onChange={(e) => setNombreInput(e.target.value)}
                className="mb-2.5 w-full border border-line bg-paper px-2.5 py-2 font-mono text-[13px]"
              />
              <button
                type="button"
                onClick={handleStart}
                className="w-full border-[1.5px] border-accent bg-paper py-2.5 text-xs font-bold uppercase tracking-wide"
              >
                Comenzar
              </button>
            </div>
          ) : (
            <>
              <div className="mb-3 flex items-center justify-between border border-line-soft bg-paper p-2.5">
                <div>
                  <div className="text-[13px] font-bold">{turno.nombre}</div>
                  <div className="text-[11px] text-sub">{turno.fecha}</div>
                </div>
                <button
                  type="button"
                  onClick={handleCancel}
                  className="border border-line bg-paper px-3 py-1.5 text-xs font-bold"
                >
                  Cancelar checklist
                </button>
              </div>

              {data.areas.map((g) => {
                const done = g.tareas.filter((tk) => turno.tareas[`${g.nombre}||${tk.texto}`]).length;
                const allDone = g.tareas.length > 0 && done === g.tareas.length;
                return (
                  <div
                    key={g.id}
                    className={`mb-2 border border-dashed border-line ${allDone ? "bg-ok-soft" : "bg-paper"}`}
                  >
                    <div className="flex items-baseline gap-1.5 px-2 py-2">
                      <span className={`text-xs font-bold uppercase tracking-wide ${allDone ? "text-sub" : ""}`}>
                        {allDone && <span className="mr-1">✓</span>}
                        {g.nombre}
                      </span>
                      <span className="mx-1.5 mb-[3px] min-w-[8px] flex-1 border-b border-dotted border-[#b3ac9c]" />
                      <span className="text-[11px] font-bold opacity-80">
                        {done}/{g.tareas.length}
                      </span>
                    </div>
                    {g.tareas.length === 0 && (
                      <div className="px-2 pb-2.5 text-[12.5px] text-sub">
                        Esta área no tiene tareas configuradas. Agregalas en &quot;Areas&quot;.
                      </div>
                    )}
                    {g.tareas.map((t) => {
                      const on = !!turno.tareas[`${g.nombre}||${t.texto}`];
                      return (
                        <div
                          key={t.id}
                          onClick={() => handleToggle(g.nombre, t.texto)}
                          className="flex cursor-pointer items-center gap-2 border-t border-dotted border-line-soft px-2 py-2"
                        >
                          <div
                            className={`flex h-[18px] w-[18px] flex-shrink-0 items-center justify-center rounded-full border-[1.5px] border-ink ${
                              on ? "bg-ink" : "bg-paper"
                            }`}
                          >
                            {on && <span className="h-1.5 w-1.5 rounded-full bg-on-ink" />}
                          </div>
                          <div className={`text-[12.5px] ${on ? "text-[#a39c8c] line-through" : "text-text"}`}>
                            {t.texto}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })}

              <button
                type="button"
                onClick={handleFinalizar}
                className="mt-3 w-full border-[1.5px] border-accent bg-paper py-2.5 text-xs font-bold uppercase tracking-wide"
              >
                Finalizar y guardar checklist
              </button>
              <div className="mt-2 text-center text-[11px] text-sub">
                {cierreFil}/{cierreTot} tareas
              </div>
            </>
          )}
        </div>
      )}

      {!pending && subtab === "historial" && <CierreHistorialView depto={depto} />}
      {!pending && subtab === "areas" && (
        <CierreAreasView depto={depto} areas={data.areas} onChanged={refresh} />
      )}
      {!pending && subtab === "ranking" && <CierreRankingView depto={depto} />}

      {toast && <Toast key={toast.id} text={toast.text} />}
      {confettiTrigger > 0 && <Confetti key={confettiTrigger} />}
    </div>
  );
}
