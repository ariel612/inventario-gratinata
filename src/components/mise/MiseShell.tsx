"use client";

import { useMemo, useState, useTransition } from "react";
import type { MiseItemModel } from "@/generated/prisma/models";
import {
  updateMiseFieldAction,
  toggleMiseSelAction,
  toggleMiseHechoAction,
  addMiseItemAction,
  removeMiseItemAction,
  editMiseMinAction,
  finalizarMiseAction,
} from "@/lib/actions/mise";
import { buzz } from "@/lib/client-utils";
import Toast, { useToast } from "@/components/Toast";
import Confetti from "@/components/Confetti";
import MiseHistorialView from "@/components/mise/MiseHistorialView";

type DiaState = {
  linea: Record<string, string>;
  repuesto: Record<string, string>;
  producir: Record<string, string>;
  sel: Record<string, boolean>;
  hecho: Record<string, boolean>;
};

const SUBTABS = [
  { id: "hoy", label: "Hoy" },
  { id: "productos", label: "Productos" },
  { id: "historial", label: "Historial" },
] as const;
type SubtabId = (typeof SUBTABS)[number]["id"];

export default function MiseShell({
  initialCat,
  initialDia,
}: {
  initialCat: MiseItemModel[];
  initialDia: DiaState;
}) {
  const [cat, setCat] = useState(initialCat);
  const [dia, setDia] = useState<DiaState>(initialDia);
  const [subtab, setSubtab] = useState<SubtabId>("hoy");
  const [query, setQuery] = useState("");
  const [msg, setMsg] = useState("");
  const [confettiTrigger, setConfettiTrigger] = useState(0);
  const { toast, show: showToast } = useToast();

  const [newName, setNewName] = useState("");
  const [newMin, setNewMin] = useState("");
  const [, startTransition] = useTransition();

  function scheduleUpdate(name: string, field: "linea" | "repuesto" | "producir", value: string) {
    setDia((prev) => ({ ...prev, [field]: { ...prev[field], [name]: value } }));
    startTransition(async () => {
      await updateMiseFieldAction({ name, field, value });
    });
  }

  async function handleToggleSel(name: string) {
    buzz(10);
    setDia((prev) => {
      const nuevo = !prev.sel[name];
      return {
        ...prev,
        sel: { ...prev.sel, [name]: nuevo },
        hecho: nuevo ? prev.hecho : { ...prev.hecho, [name]: false },
      };
    });
    await toggleMiseSelAction({ name });
  }

  async function handleToggleHecho(name: string) {
    if (!dia.sel[name]) return;
    buzz(10);
    const result = await toggleMiseHechoAction({ name });
    setDia((prev) => ({ ...prev, hecho: { ...prev.hecho, [name]: !prev.hecho[name] } }));
    if (result.allDone) {
      buzz([20, 80, 20, 80, 20]);
      setConfettiTrigger((t) => t + 1);
      showToast("¡Mise en place completa!");
    }
  }

  async function handleAddItem() {
    if (!newName.trim()) return;
    try {
      await addMiseItemAction({ nombre: newName.trim(), min: parseFloat(newMin) || 0 });
      setCat((prev) => [...prev, { id: crypto.randomUUID(), nombre: newName.trim(), min: parseFloat(newMin) || 0, orden: prev.length }]);
      setNewName("");
      setNewMin("");
    } catch (e) {
      alert(e instanceof Error ? e.message : "No se pudo agregar");
    }
  }

  async function handleRemoveItem(itemId: string, nombre: string) {
    if (!confirm(`¿Eliminar "${nombre}" de Mise en Place?`)) return;
    await removeMiseItemAction({ itemId });
    setCat((prev) => prev.filter((i) => i.id !== itemId));
  }

  async function handleEditMin(itemId: string, min: string) {
    const value = parseFloat(min) || 0;
    setCat((prev) => prev.map((i) => (i.id === itemId ? { ...i, min: value } : i)));
    await editMiseMinAction({ itemId, min: value });
  }

  async function handleFinalizar() {
    try {
      await finalizarMiseAction();
      setMsg("Guardado en historial");
      setTimeout(() => setMsg(""), 2000);
    } catch (e) {
      alert(e instanceof Error ? e.message : "No se pudo guardar");
    }
  }

  const selKeys = Object.keys(dia.sel).filter((k) => dia.sel[k]);
  const doneKeys = selKeys.filter((k) => dia.hecho[k]);

  const qn = query.trim().toLowerCase();
  const itemsOrdered = useMemo(() => {
    const filtered = qn ? cat.filter((i) => i.nombre.toLowerCase().includes(qn)) : cat;
    return filtered
      .map((item, idx) => {
        const sel = !!dia.sel[item.nombre];
        const done = !!dia.hecho[item.nombre];
        const grupo = sel ? (done ? 1 : 0) : 2;
        return { item, idx, grupo };
      })
      .sort((a, b) => a.grupo - b.grupo || a.idx - b.idx)
      .map((o) => o.item);
  }, [cat, dia, qn]);

  return (
    <div className="pb-8">
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

      {subtab === "hoy" && (
        <div className="px-4 pt-3">
          <div className="mb-3 flex items-center justify-between border border-line-soft bg-paper p-2.5">
            <div>
              <div className="text-[10px] uppercase tracking-wide text-sub">Seleccionados hoy</div>
              <div className="font-mono text-xl font-bold">
                {doneKeys.length}
                <span className="text-sm font-normal text-sub">/{selKeys.length}</span>
              </div>
            </div>
          </div>

          <input
            placeholder="Buscar producto..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="mb-2.5 w-full border border-line bg-paper px-3 py-2 font-mono text-[13px]"
          />

          {itemsOrdered.length === 0 && <div className="py-6 text-center text-xs text-sub">Sin resultados</div>}

          {itemsOrdered.map((item) => {
            const selected = !!dia.sel[item.nombre];
            const hecho = !!dia.hecho[item.nombre];
            return (
              <div
                key={item.id}
                className={`mb-1.5 border-b border-dashed border-line-soft py-2 ${
                  selected ? (hecho ? "bg-ok-soft" : "bg-accent-soft") : ""
                }`}
              >
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleToggleSel(item.nombre)}
                    className={`flex-shrink-0 border px-1.5 py-1 text-[9.5px] font-bold ${
                      selected ? "border-ink bg-ink text-on-ink" : "border-line bg-paper text-sub"
                    }`}
                  >
                    MEP
                  </button>
                  <div className="min-w-0 flex-1">
                    <div
                      onClick={() => handleToggleHecho(item.nombre)}
                      className={`text-[12.5px] ${selected ? "cursor-pointer" : ""} ${
                        hecho ? "text-[#a39c8c] line-through" : "text-text"
                      }`}
                    >
                      {item.nombre}
                    </div>
                    <div className="text-[10px] text-sub">min:{item.min}</div>
                  </div>
                  {selected && (
                    <div
                      onClick={() => handleToggleHecho(item.nombre)}
                      className={`flex h-[18px] w-[18px] flex-shrink-0 cursor-pointer items-center justify-center rounded-full border-[1.5px] border-ink ${
                        hecho ? "bg-ink" : "bg-paper"
                      }`}
                    >
                      {hecho && <span className="h-1.5 w-1.5 rounded-full bg-on-ink" />}
                    </div>
                  )}
                </div>
                <div className="ml-10 mt-1.5 flex gap-2.5">
                  <div className="flex items-center gap-1">
                    <span className="text-[9px] text-sub">L</span>
                    <input
                      value={dia.linea[item.nombre] ?? ""}
                      onChange={(e) => scheduleUpdate(item.nombre, "linea", e.target.value)}
                      className="w-14 border border-ink bg-paper px-1 py-1 text-center font-mono text-[12.5px]"
                    />
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-[9px] text-sub">R</span>
                    <input
                      value={dia.repuesto[item.nombre] ?? ""}
                      onChange={(e) => scheduleUpdate(item.nombre, "repuesto", e.target.value)}
                      className="w-14 border border-ink bg-paper px-1 py-1 text-center font-mono text-[12.5px]"
                    />
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-[9px] text-sub">P</span>
                    <input
                      value={dia.producir[item.nombre] ?? ""}
                      onChange={(e) => scheduleUpdate(item.nombre, "producir", e.target.value)}
                      className="w-14 border border-warn bg-warn-soft px-1 py-1 text-center font-mono text-[12.5px]"
                    />
                  </div>
                </div>
              </div>
            );
          })}

          {selKeys.length > 0 && (
            <>
              {msg && <div className="mt-2 text-right text-[11px] text-accent">{msg}</div>}
              <button
                type="button"
                onClick={handleFinalizar}
                className="mt-3 w-full border-[1.5px] border-accent bg-paper py-2.5 text-xs font-bold uppercase tracking-wide"
              >
                Guardar en historial
              </button>
            </>
          )}
        </div>
      )}

      {subtab === "productos" && (
        <div className="px-4 pt-3">
          <div className="mb-3 border border-dashed border-line bg-paper p-3">
            <label className="mb-1 block text-[10px] uppercase tracking-wide text-sub">Nuevo producto</label>
            <div className="flex gap-2">
              <input
                placeholder="Nombre"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="flex-1 border border-line bg-paper px-2.5 py-2 font-mono text-[13px]"
              />
              <input
                type="number"
                placeholder="Min"
                value={newMin}
                onChange={(e) => setNewMin(e.target.value)}
                className="w-16 border border-line bg-paper px-2 py-2 font-mono text-[13px]"
              />
            </div>
            <button
              type="button"
              onClick={handleAddItem}
              className="mt-2 w-full border-[1.5px] border-accent bg-paper py-2.5 text-xs font-bold uppercase tracking-wide"
            >
              + Agregar
            </button>
          </div>

          {cat.map((item) => (
            <div key={item.id} className="flex items-center gap-2 border-b border-dotted border-line-soft py-2">
              <div className="min-w-0 flex-1 text-[12.5px]">{item.nombre}</div>
              <input
                type="number"
                defaultValue={item.min}
                onBlur={(e) => handleEditMin(item.id, e.target.value)}
                className="w-11 flex-shrink-0 border border-ink bg-paper px-1 py-1 text-center font-mono text-[12.5px]"
              />
              <button
                type="button"
                onClick={() => handleRemoveItem(item.id, item.nombre)}
                className="flex-shrink-0 border border-danger bg-danger-soft px-2 py-1 text-[11px] font-bold text-danger"
              >
                Eliminar
              </button>
            </div>
          ))}
        </div>
      )}

      {subtab === "historial" && <MiseHistorialView />}

      {toast && <Toast key={toast.id} text={toast.text} />}
      {confettiTrigger > 0 && <Confetti key={confettiTrigger} />}
    </div>
  );
}
