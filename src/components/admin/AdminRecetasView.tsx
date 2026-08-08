"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import {
  getRecetasDataAction,
  updateRecetaLineaAction,
  addRecetaLineaAction,
  removeRecetaLineaAction,
} from "@/lib/actions/recetas";

type Linea = { n: string; cant: number | null; u: string };
type Producto = { id: string; nombre: string; ingredientes: Linea[] };

export default function AdminRecetasView() {
  const [productos, setProductos] = useState<Producto[] | null>(null);
  const [ventas, setVentas] = useState<Record<string, number>>({});
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [calcOpen, setCalcOpen] = useState<Record<string, boolean>>({});
  const [calcInput, setCalcInput] = useState<Record<string, string>>({});
  const [newIng, setNewIng] = useState<Record<string, { n: string; cant: string; u: string }>>({});

  const [compraOpen, setCompraOpen] = useState(false);
  const [compraIng, setCompraIng] = useState("");
  const [, startTransition] = useTransition();

  async function load() {
    const data = await getRecetasDataAction();
    setProductos(data.productos);
    setVentas(data.ventas);
  }

  useEffect(() => {
    startTransition(load);
  }, []);

  const nombresIngredientesUnicos = useMemo(() => {
    const set = new Set<string>();
    (productos ?? []).forEach((p) => p.ingredientes.forEach((l) => set.add(l.n)));
    return [...set].sort();
  }, [productos]);

  function unidadesVendidasDe(ingNombre: string): number {
    let total = 0;
    (productos ?? []).forEach((p) => {
      if (p.ingredientes.some((l) => l.n === ingNombre)) total += ventas[p.nombre] || 0;
    });
    return total;
  }

  function desglose(ingNombre: string) {
    const filas: { producto: string; vendidas: number; cant: number | null; u: string; subtotal: number | null }[] = [];
    let total = 0;
    let algunSinDefinir = false;
    (productos ?? []).forEach((p) => {
      p.ingredientes.forEach((l) => {
        if (l.n !== ingNombre) return;
        const vendidas = ventas[p.nombre] || 0;
        if (vendidas === 0) return;
        if (l.cant == null) {
          algunSinDefinir = true;
          filas.push({ producto: p.nombre, vendidas, cant: null, u: l.u, subtotal: null });
          return;
        }
        const subtotal = l.cant * vendidas;
        total += subtotal;
        filas.push({ producto: p.nombre, vendidas, cant: l.cant, u: l.u, subtotal });
      });
    });
    filas.sort((a, b) => (b.subtotal ?? 0) - (a.subtotal ?? 0));
    return { filas, total, algunSinDefinir };
  }

  function calcularCantidadPorPorcion(producto: Producto, idx: number) {
    const key = `${producto.id}||${idx}`;
    const comprado = parseFloat(calcInput[key] ?? "");
    const vendidas = unidadesVendidasDe(producto.ingredientes[idx].n);
    if (!comprado || !vendidas) return null;
    return { resultado: comprado / vendidas, vendidas };
  }

  async function handleUpdateLinea(producto: Producto, idx: number, campo: "cant" | "u", valor: string) {
    setProductos((prev) =>
      prev
        ? prev.map((p) =>
            p.id !== producto.id
              ? p
              : {
                  ...p,
                  ingredientes: p.ingredientes.map((l, i) =>
                    i !== idx ? l : campo === "cant" ? { ...l, cant: valor === "" ? null : parseFloat(valor) } : { ...l, u: valor }
                  ),
                }
          )
        : prev
    );
    await updateRecetaLineaAction({ productoId: producto.id, idx, campo, valor });
  }

  async function handleAplicarCalculo(producto: Producto, idx: number) {
    const r = calcularCantidadPorPorcion(producto, idx);
    if (!r) return;
    await handleUpdateLinea(producto, idx, "cant", r.resultado.toFixed(2));
    setCalcOpen((prev) => ({ ...prev, [`${producto.id}||${idx}`]: false }));
  }

  async function handleAddLinea(producto: Producto) {
    const datos = newIng[producto.id] ?? { n: "", cant: "", u: "gr" };
    if (!datos.n.trim()) return;
    await addRecetaLineaAction({
      productoId: producto.id,
      n: datos.n.trim(),
      cant: datos.cant ? parseFloat(datos.cant) : null,
      u: datos.u || "gr",
    });
    setNewIng((prev) => ({ ...prev, [producto.id]: { n: "", cant: "", u: "gr" } }));
    load();
  }

  async function handleRemoveLinea(producto: Producto, idx: number) {
    await removeRecetaLineaAction({ productoId: producto.id, idx });
    setProductos((prev) =>
      prev
        ? prev.map((p) => (p.id !== producto.id ? p : { ...p, ingredientes: p.ingredientes.filter((_, i) => i !== idx) }))
        : prev
    );
  }

  if (productos === null) return <div className="px-4 py-6 text-center text-xs text-sub">Cargando...</div>;

  const qn = query.trim().toLowerCase();
  const nombresProd = productos.map((p) => p.nombre).filter((n) => !qn || n.toLowerCase().includes(qn));
  const desg = compraIng ? desglose(compraIng) : null;

  return (
    <div className="px-4 pb-8 pt-3">
      <div className="mb-3 border border-dashed border-line bg-paper p-3">
        <div
          className="flex cursor-pointer items-center justify-between"
          onClick={() => setCompraOpen((v) => !v)}
        >
          <div className="text-xs font-bold uppercase tracking-wide">Calculadora de compra</div>
          <span className={`text-[10px] transition-transform ${compraOpen ? "rotate-90" : ""}`}>▶</span>
        </div>
        {compraOpen && (
          <div className="mt-3">
            <label className="mb-1 block text-[10px] uppercase tracking-wide text-sub">Ingrediente a planificar</label>
            <input
              list="lista-ingredientes"
              placeholder="Ej: Hamburguesas, Pechuga pollo ahumada..."
              value={compraIng}
              onChange={(e) => setCompraIng(e.target.value)}
              className="w-full border border-line bg-paper px-2.5 py-2 font-mono text-[13px]"
            />
            <datalist id="lista-ingredientes">
              {nombresIngredientesUnicos.map((n) => (
                <option key={n} value={n} />
              ))}
            </datalist>

            {compraIng && desg && (
              <div className="mt-2">
                {desg.filas.length === 0 ? (
                  <div className="py-2 text-xs text-sub">
                    Ningún producto usa ese ingrediente exacto (revisa mayúsculas/nombre exacto)
                  </div>
                ) : (
                  <>
                    {desg.filas.map((f, i) => (
                      <div key={i} className="flex justify-between border-b border-dotted border-line-soft py-1.5 text-xs">
                        <div>
                          {f.producto} <span className="text-sub">({f.vendidas} vend.)</span>
                        </div>
                        <div className="font-bold">
                          {f.subtotal != null ? `${Math.round(f.subtotal * 100) / 100} ${f.u}` : (
                            <span className="text-warn">sin definir</span>
                          )}
                        </div>
                      </div>
                    ))}
                    <div className="flex justify-between pt-2.5 pb-1 text-sm font-bold">
                      Total sugerido
                      <span className="text-accent">
                        {Math.round(desg.total * 100) / 100} {desg.filas[0]?.u || ""}
                      </span>
                    </div>
                    {desg.algunSinDefinir && (
                      <div className="mt-1 text-[10.5px] text-warn">
                        Algunas recetas de este ingrediente no tienen cantidad definida todavía, el total podría ser
                        mayor.
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <input
        placeholder="Buscar producto de Fudo..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="mb-2.5 w-full border border-line bg-paper px-3 py-2 font-mono text-[13px]"
      />

      {nombresProd.length === 0 && (
        <div className="py-6 text-center text-xs text-sub">Sin recetas cargadas todavía. Usa la herramienta de importación.</div>
      )}

      {productos
        .filter((p) => nombresProd.includes(p.nombre))
        .map((producto) => {
          const open = !!expanded[producto.id];
          const sinDef = producto.ingredientes.filter((l) => l.cant == null).length;

          return (
            <div key={producto.id} className={`border-b border-dashed border-line ${open ? "bg-paper" : ""}`}>
              <div
                className="flex cursor-pointer items-baseline gap-1.5 py-2.5"
                onClick={() => setExpanded((prev) => ({ ...prev, [producto.id]: !prev[producto.id] }))}
              >
                <span className="flex items-baseline gap-1.5 overflow-hidden">
                  {sinDef > 0 && <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-danger" />}
                  <span className="text-xs font-bold uppercase tracking-wide">{producto.nombre}</span>
                </span>
                <span className="mx-1.5 mb-[3px] min-w-[8px] flex-1 border-b border-dotted border-[#b3ac9c]" />
                <span className="text-[11px] font-bold opacity-80">
                  {producto.ingredientes.length} ing.{sinDef > 0 ? ` • ${sinDef} sin def.` : ""}
                </span>
              </div>

              {open && (
                <div className="py-1.5">
                  {producto.ingredientes.map((linea, idx) => {
                    const key = `${producto.id}||${idx}`;
                    const abierto = !!calcOpen[key];
                    const r = calcularCantidadPorPorcion(producto, idx);
                    const vendidas = unidadesVendidasDe(linea.n);
                    return (
                      <div
                        key={idx}
                        className={`border-b border-dotted border-line-soft py-1.5 ${linea.cant == null ? "bg-warn-soft" : ""}`}
                      >
                        <div className="flex items-center gap-1.5">
                          <div className="flex-1 text-xs">
                            {linea.n}
                            {linea.cant == null && <span className="ml-1 text-[10px] text-warn">(sin definir)</span>}
                          </div>
                          <input
                            type="number"
                            step="any"
                            placeholder="cant"
                            defaultValue={linea.cant ?? ""}
                            onBlur={(e) => handleUpdateLinea(producto, idx, "cant", e.target.value)}
                            className="w-13 flex-shrink-0 border border-ink bg-paper px-1 py-1 text-center font-mono text-[12.5px]"
                          />
                          <input
                            type="text"
                            placeholder="u"
                            defaultValue={linea.u || ""}
                            onBlur={(e) => handleUpdateLinea(producto, idx, "u", e.target.value)}
                            className="w-9 flex-shrink-0 border border-ink bg-paper px-1 py-1 text-center font-mono text-[12.5px]"
                          />
                          {linea.cant == null && (
                            <button
                              type="button"
                              onClick={() => setCalcOpen((prev) => ({ ...prev, [key]: !prev[key] }))}
                              className="flex-shrink-0 border border-line bg-paper px-1.5 py-1 text-[10px] font-bold"
                            >
                              Calc.
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleRemoveLinea(producto, idx)}
                            className="flex-shrink-0 border border-danger bg-danger-soft px-1.5 py-1 text-[10px] font-bold text-danger"
                          >
                            X
                          </button>
                        </div>
                        {abierto && (
                          <div className="mt-1.5 border border-dashed border-line bg-paper p-2">
                            <div className="mb-1 text-[10.5px] text-sub">
                              Unidades vendidas de platos con este ingrediente (7 días): <b>{vendidas}</b>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10.5px]">Compraste:</span>
                              <input
                                type="number"
                                step="any"
                                value={calcInput[key] ?? ""}
                                onChange={(e) => setCalcInput((prev) => ({ ...prev, [key]: e.target.value }))}
                                className="w-16 border border-line bg-paper px-1.5 py-1 text-[12px]"
                              />
                              <span className="text-[10.5px]">{linea.u || "gr"}</span>
                            </div>
                            {r ? (
                              <div className="mt-1.5 text-[11.5px]">
                                = <b>{r.resultado.toFixed(2)} {linea.u || "gr"}</b> por porción{" "}
                                <button
                                  type="button"
                                  onClick={() => handleAplicarCalculo(producto, idx)}
                                  className="ml-1 border-[1.5px] border-accent bg-paper px-2.5 py-1 text-[10.5px] font-bold"
                                >
                                  Usar este valor
                                </button>
                              </div>
                            ) : (
                              <div className="mt-1.5 text-[10.5px] text-sub">
                                Ingresa la cantidad comprada{vendidas === 0 ? " (no hay ventas registradas de este producto en el período)" : ""}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}

                  <div className="mt-2 flex gap-1.5">
                    <input
                      placeholder="Nuevo ingrediente"
                      value={newIng[producto.id]?.n ?? ""}
                      onChange={(e) =>
                        setNewIng((prev) => ({
                          ...prev,
                          [producto.id]: { n: e.target.value, cant: prev[producto.id]?.cant ?? "", u: prev[producto.id]?.u ?? "gr" },
                        }))
                      }
                      className="flex-1 border border-line px-2 py-1.5 text-xs"
                    />
                    <input
                      type="number"
                      placeholder="cant"
                      value={newIng[producto.id]?.cant ?? ""}
                      onChange={(e) =>
                        setNewIng((prev) => ({
                          ...prev,
                          [producto.id]: { n: prev[producto.id]?.n ?? "", cant: e.target.value, u: prev[producto.id]?.u ?? "gr" },
                        }))
                      }
                      className="w-12 border border-line px-1 py-1.5 text-xs"
                    />
                    <input
                      placeholder="u"
                      value={newIng[producto.id]?.u ?? "gr"}
                      onChange={(e) =>
                        setNewIng((prev) => ({
                          ...prev,
                          [producto.id]: { n: prev[producto.id]?.n ?? "", cant: prev[producto.id]?.cant ?? "", u: e.target.value },
                        }))
                      }
                      className="w-9 border border-line px-1 py-1.5 text-xs"
                    />
                    <button
                      type="button"
                      onClick={() => handleAddLinea(producto)}
                      className="flex-shrink-0 border-[1.5px] border-accent bg-paper px-3 py-1.5 text-[11px] font-bold"
                    >
                      +
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
