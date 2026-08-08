"use client";

import { useState } from "react";
import type { CierreAreaModel, CierreTareaModel } from "@/generated/prisma/models";
import { Area } from "@/generated/prisma/enums";
import {
  addCierreAreaAction,
  renameCierreAreaAction,
  removeCierreAreaAction,
  addCierreTaskAction,
  removeCierreTaskAction,
} from "@/lib/actions/cierre";

type CierreAreaWithTareas = CierreAreaModel & { tareas: CierreTareaModel[] };

export default function CierreAreasView({
  depto,
  areas,
  onChanged,
}: {
  depto: Area;
  areas: CierreAreaWithTareas[];
  onChanged: () => void;
}) {
  const [newAreaName, setNewAreaName] = useState("");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [newTask, setNewTask] = useState<Record<string, string>>({});

  async function handleAddArea() {
    if (!newAreaName.trim()) return;
    try {
      await addCierreAreaAction({ depto, nombre: newAreaName });
      setNewAreaName("");
      onChanged();
    } catch (e) {
      alert(e instanceof Error ? e.message : "No se pudo agregar el área");
    }
  }

  async function handleRename(areaId: string, current: string) {
    const nuevo = prompt(`Nuevo nombre para "${current}"`, current);
    if (!nuevo || !nuevo.trim() || nuevo.trim().toUpperCase() === current) return;
    await renameCierreAreaAction({ areaId, depto, nombre: nuevo.trim() });
    onChanged();
  }

  async function handleRemoveArea(areaId: string, nombre: string) {
    if (!confirm(`¿Eliminar el área "${nombre}" y todas sus tareas?`)) return;
    await removeCierreAreaAction({ areaId, depto });
    onChanged();
  }

  async function handleAddTask(areaId: string) {
    const texto = newTask[areaId];
    if (!texto || !texto.trim()) return;
    await addCierreTaskAction({ areaId, depto, texto });
    setNewTask((prev) => ({ ...prev, [areaId]: "" }));
    onChanged();
  }

  async function handleRemoveTask(tareaId: string) {
    await removeCierreTaskAction({ tareaId, depto });
    onChanged();
  }

  return (
    <div className="px-4 pb-8 pt-3">
      <div className="mb-3 border border-dashed border-line bg-paper p-3">
        <label className="mb-1 block text-[10px] uppercase tracking-wide text-sub">Nueva área o departamento</label>
        <div className="flex gap-2">
          <input
            placeholder="Ej: BODEGA"
            value={newAreaName}
            onChange={(e) => setNewAreaName(e.target.value)}
            className="flex-1 border border-line bg-paper px-2.5 py-2 font-mono text-[13px]"
          />
          <button
            type="button"
            onClick={handleAddArea}
            className="flex-shrink-0 border-[1.5px] border-accent bg-paper px-4 py-2 text-xs font-bold"
          >
            + Agregar
          </button>
        </div>
      </div>

      {areas.map((a) => {
        const open = !!expanded[a.id];
        return (
          <div key={a.id} className="mt-2 border border-dashed border-line bg-paper">
            <div
              className="flex cursor-pointer items-baseline gap-1.5 px-2 py-2.5"
              onClick={() => setExpanded((prev) => ({ ...prev, [a.id]: !prev[a.id] }))}
            >
              <span className="text-xs font-bold uppercase tracking-wide">{a.nombre}</span>
              <span className="mx-1.5 mb-[3px] min-w-[8px] flex-1 border-b border-dotted border-[#b3ac9c]" />
              <span className="text-[11px] font-bold opacity-80">{a.tareas.length} tareas</span>
            </div>
            {open && (
              <div className="px-2 pb-2.5">
                {a.tareas.map((t) => (
                  <div key={t.id} className="flex items-center justify-between border-b border-line py-1.5">
                    <span className="text-[13px]">{t.texto}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveTask(t.id)}
                      className="border border-danger bg-danger-soft px-2 py-1 text-[11px] font-bold text-danger"
                    >
                      Eliminar
                    </button>
                  </div>
                ))}
                <div className="mt-2 flex gap-1.5">
                  <input
                    placeholder="Nueva tarea"
                    value={newTask[a.id] ?? ""}
                    onChange={(e) => setNewTask((prev) => ({ ...prev, [a.id]: e.target.value }))}
                    className="flex-1 border border-line bg-paper px-2.5 py-2 text-[13px]"
                  />
                  <button
                    type="button"
                    onClick={() => handleAddTask(a.id)}
                    className="flex-shrink-0 border-[1.5px] border-accent bg-paper px-3.5 py-2 text-xs font-bold"
                  >
                    + Tarea
                  </button>
                </div>
                <div className="mt-2.5 flex gap-2">
                  <button
                    type="button"
                    onClick={() => handleRename(a.id, a.nombre)}
                    className="flex-1 border border-line bg-paper py-2 text-xs font-bold"
                  >
                    Renombrar
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRemoveArea(a.id, a.nombre)}
                    className="flex-1 border border-danger bg-paper py-2 text-xs font-bold text-danger"
                  >
                    Eliminar área
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
