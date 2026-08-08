"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import useSWR from "swr";
import type { ProviderModel, ProductModel } from "@/generated/prisma/models";
import { Area } from "@/generated/prisma/enums";
import {
  updateStockAction,
  toggleProcesadoAction,
  resetInventarioAction,
  getStockSnapshotAction,
} from "@/lib/actions/inventario";
import { stepOf, buzz } from "@/lib/client-utils";
import Toast, { useToast } from "@/components/Toast";
import Confetti from "@/components/Confetti";

type Product = ProductModel;
type ProviderWithProducts = ProviderModel & { products: Product[] };
type StockEntryState = { stock: string; procesado: boolean };
type StockState = Record<string, StockEntryState>;
type RachaState = { actual: number; mejor: number; ultimaFecha: string | null };

function toStockState(
  raw: Record<string, { stock: number | null; procesado: boolean }>
): StockState {
  const out: StockState = {};
  for (const [id, v] of Object.entries(raw)) {
    out[id] = { stock: v.stock === null || v.stock === undefined ? "" : String(v.stock), procesado: v.procesado };
  }
  return out;
}

function progMsg(pct: number) {
  if (pct === 0) return "Partamos";
  if (pct < 30) return "Vamos avanzando";
  if (pct < 60) return "Mitad de camino";
  if (pct < 90) return "Ya casi";
  if (pct < 100) return "Último tirón";
  return "Inventario completo";
}

export default function InventarioView({
  area,
  areaLabel,
  providers,
  initialStock,
  initialRacha,
  sugerencias = {},
}: {
  area: Area;
  areaLabel: string;
  providers: ProviderWithProducts[];
  initialStock: Record<string, { stock: number | null; procesado: boolean }>;
  initialRacha: RachaState;
  sugerencias?: Record<string, number>;
}) {
  const [stock, setStock] = useState<StockState>(() => toStockState(initialStock));
  const [racha, setRacha] = useState<RachaState>(initialRacha);
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [msg, setMsg] = useState("");
  const [confettiTrigger, setConfettiTrigger] = useState(0);
  const { toast, show: showToast } = useToast();

  const writingUntilRef = useRef(0);
  const saveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const providerRefs = useRef<Record<string, HTMLDivElement | null>>({});
  // Espejo sincrónico de `stock`: los steppers +/- necesitan leer el valor
  // recién commiteado incluso entre dos clicks disparados antes de que React
  // re-renderice, así que no pueden confiar en el closure de `stock`.
  const stockRef = useRef<StockState>(stock);

  const allProducts = useMemo(
    () => providers.flatMap((p) => p.products),
    [providers]
  );
  const tot = allProducts.length;
  const fil = allProducts.filter((p) => (stock[p.id]?.stock ?? "") !== "").length;
  const pct = tot > 0 ? Math.round((fil / tot) * 100) : 0;

  useSWR(
    ["inventario-snapshot", area],
    () => getStockSnapshotAction({ area }),
    {
      refreshInterval: 6000,
      revalidateOnFocus: true,
      onSuccess: (data) => {
        // Callback de SWR tras un fetch resuelto, no ocurre durante el render.
        // eslint-disable-next-line react-hooks/purity
        if (Date.now() < writingUntilRef.current) return;
        const next = toStockState(data.stock);
        stockRef.current = next;
        setStock(next);
        setRacha(data.racha);
      },
    }
  );

  function markWriting() {
    // Solo se llama desde handlers de click/input, nunca durante el render;
    // el timestamp alimenta un ref imperativo (guard anti-sobrescritura del
    // polling SWR), no estado de React.
    // eslint-disable-next-line react-hooks/purity
    writingUntilRef.current = Date.now() + 2500;
  }

  function scheduleSave(productId: string, value: string) {
    clearTimeout(saveTimers.current[productId]);
    setMsg("Guardando...");
    saveTimers.current[productId] = setTimeout(async () => {
      try {
        await updateStockAction({ productId, area, value });
        setMsg("Guardado");
        setTimeout(() => setMsg(""), 2000);
      } catch {
        setMsg("Error");
      }
    }, 600);
  }

  const providerDoneIn = useCallback(
    (provider: ProviderWithProducts, s: StockState) =>
      provider.products.every((pr) => (s[pr.id]?.stock ?? "") !== ""),
    []
  );

  function updateStock(product: Product, provider: ProviderWithProducts, rawValue: string) {
    const value = rawValue.replace(",", ".");
    markWriting();

    setStock((prev) => {
      const next: StockState = {
        ...prev,
        [product.id]: { ...(prev[product.id] ?? { procesado: false, stock: "" }), stock: value },
      };

      const wasProviderDone = providerDoneIn(provider, prev);
      const isProviderDone = providerDoneIn(provider, next);
      const prevFil = allProducts.filter((p) => (prev[p.id]?.stock ?? "") !== "").length;
      const nextFil = allProducts.filter((p) => (next[p.id]?.stock ?? "") !== "").length;

      if (!wasProviderDone && isProviderDone && nextFil !== tot) {
        buzz([14, 60, 14]);
        showToast(`${provider.name} listo`);
      }
      if (prevFil !== tot && tot > 0 && nextFil === tot) {
        buzz([20, 80, 20, 80, 20]);
        setConfettiTrigger((t) => t + 1);
        showToast("¡Inventario completo!");
      }

      stockRef.current = next;
      return next;
    });

    scheduleSave(product.id, value);
  }

  function bump(product: Product, provider: ProviderWithProducts, delta: number) {
    const cur = parseFloat(stockRef.current[product.id]?.stock ?? "");
    const base = isNaN(cur) ? 0 : cur;
    const next = Math.max(0, Math.round((base + delta) * 100) / 100);
    buzz(10);
    updateStock(product, provider, String(next));
  }

  function toggleProcesado(productId: string) {
    markWriting();
    buzz(10);
    setStock((prev) => {
      const cur = prev[productId] ?? { stock: "", procesado: false };
      const next = { ...prev, [productId]: { ...cur, procesado: !cur.procesado } };
      stockRef.current = next;
      return next;
    });
    setMsg("Guardando...");
    toggleProcesadoAction({ productId, area })
      .then(() => {
        setMsg("Guardado");
        setTimeout(() => setMsg(""), 1500);
      })
      .catch(() => setMsg("Error"));
  }

  async function handleReset() {
    if (!confirm(`¿Borrar todo el inventario de ${areaLabel}? Esta acción no se puede deshacer.`)) return;
    stockRef.current = {};
    setStock({});
    setMsg("Inventario borrado");
    await resetInventarioAction({ area });
    setTimeout(() => setMsg(""), 2000);
  }

  function goToNext() {
    const next = providers.find((p) => !providerDoneIn(p, stock));
    if (!next) {
      buzz(10);
      setConfettiTrigger((t) => t + 1);
      return;
    }
    setExpanded({ [next.id]: true });
    setQuery("");
    buzz(10);
    setTimeout(
      () => providerRefs.current[next.id]?.scrollIntoView({ behavior: "smooth", block: "center" }),
      50
    );
  }

  const qn = query.trim().toLowerCase();
  const ordered = useMemo(() => {
    return providers
      .map((p, idx) => ({ p, idx, done: providerDoneIn(p, stock) }))
      .sort((a, b) => Number(a.done) - Number(b.done) || a.idx - b.idx)
      .map((o) => o.p);
  }, [providers, stock, providerDoneIn]);

  const nextPending = providers.find((p) => !providerDoneIn(p, stock));

  return (
    <div className="pb-[140px]">
      <div className="px-4 pt-3">
        <div className="mb-2 flex items-center justify-between text-[10px] uppercase tracking-wide text-sub">
          <span className="font-mono">
            {progMsg(pct)}
            {racha.actual > 1 ? ` · RACHA ${racha.actual}D` : ""}
          </span>
          <span>
            {fil}/{tot}
          </span>
        </div>
        <div className="mb-2 h-[3px] bg-line-soft">
          <div className="h-[3px] bg-accent transition-[width]" style={{ width: `${pct}%` }} />
        </div>
        {msg && <div className="mb-1 text-right text-[10px] text-accent">{msg}</div>}
      </div>

      <div className="px-4 pt-2">
        <input
          className="w-full border border-line bg-paper px-3 py-2 font-mono text-[13px] text-text focus:border-accent focus:outline-none"
          placeholder="Buscar producto..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <div className="px-4 pb-1 pt-1">
        {ordered.map((provider) => {
          const items = qn
            ? provider.products.filter((it) => it.name.toLowerCase().includes(qn))
            : provider.products;
          if (items.length === 0) return null;

          const open = qn ? true : !!expanded[provider.id];
          const doneCt = items.filter((it) => (stock[it.id]?.stock ?? "") !== "").length;
          const hasLow = items.some((it) => {
            const s = parseFloat(stock[it.id]?.stock ?? "");
            return !isNaN(s) && it.minStock > 0 && s < it.minStock;
          });
          const allDone = doneCt === items.length;

          return (
            <div
              key={provider.id}
              ref={(el) => {
                providerRefs.current[provider.id] = el;
              }}
              className={`border-b border-dashed border-line ${open ? "bg-paper" : ""}`}
            >
              <div
                className={`flex cursor-pointer items-baseline gap-1.5 py-2.5 ${
                  open ? "border-b border-dashed border-line-soft" : ""
                }`}
                onClick={() =>
                  setExpanded((prev) => ({ ...prev, [provider.id]: !prev[provider.id] }))
                }
              >
                <span className="flex items-baseline gap-1.5 overflow-hidden">
                  {hasLow && <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-danger" />}
                  <span
                    className={`overflow-hidden text-ellipsis whitespace-nowrap text-xs font-bold uppercase tracking-wide ${
                      allDone ? "text-sub" : "text-ink"
                    }`}
                  >
                    {provider.name}
                  </span>
                </span>
                <span className="mx-1.5 mb-[3px] min-w-[8px] flex-1 border-b border-dotted border-[#b3ac9c]" />
                <span className="flex flex-shrink-0 items-baseline gap-1.5">
                  {allDone && <span className="font-bold text-ink">✓</span>}
                  <span className="text-[11px] font-bold opacity-80">
                    {doneCt}/{items.length}
                  </span>
                  <span
                    className={`text-[9px] opacity-70 transition-transform ${open ? "rotate-90" : ""}`}
                  >
                    ▶
                  </span>
                </span>
              </div>

              {open && (
                <div className="animate-[fadein_.15s_ease] py-0.5">
                  {items.map((item) => {
                    const entry = stock[item.id];
                    const sk = entry?.stock ?? "";
                    const procesado = entry?.procesado ?? false;
                    const sn = parseFloat(sk);
                    const bajo = !isNaN(sn) && item.minStock > 0 && sn < item.minStock;
                    const stp = stepOf(item.minStock);
                    const wide = stp !== 1;

                    return (
                      <div
                        key={item.id}
                        className={`flex items-center gap-2 border-b border-dotted border-line-soft py-2 last:border-none ${
                          bajo ? "bg-danger-soft" : ""
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => toggleProcesado(item.id)}
                          className={`flex h-[18px] w-[18px] flex-shrink-0 items-center justify-center rounded-full border-[1.5px] border-ink ${
                            procesado ? "bg-ink" : "bg-paper"
                          }`}
                        >
                          {procesado && <span className="h-1.5 w-1.5 rounded-full bg-on-ink" />}
                        </button>
                        <div className="min-w-0 flex-1">
                          <div
                            className={`overflow-hidden text-ellipsis whitespace-nowrap text-[12.5px] ${
                              procesado ? "text-[#a39c8c] line-through" : "text-text"
                            }`}
                          >
                            {item.name}
                          </div>
                          {item.minStock > 0 && (
                            <div className={`mt-0.5 text-[10px] ${bajo ? "font-bold text-danger" : "text-sub"}`}>
                              min:{item.minStock}
                              {bajo ? " BAJO" : ""}
                            </div>
                          )}
                          {sugerencias[item.name] != null && (
                            <div className="mt-0.5 text-[10px] text-accent">
                              sugerido: {Math.round(sugerencias[item.name])}
                            </div>
                          )}
                        </div>
                        <div className="flex flex-shrink-0 items-center gap-1">
                          <button
                            type="button"
                            onClick={() => bump(item, provider, -stp)}
                            className={`flex h-7 flex-shrink-0 items-center justify-center border border-ink bg-paper text-sm font-bold ${
                              wide ? "w-[34px] text-[10px]" : "w-7"
                            }`}
                          >
                            −{wide ? stp : ""}
                          </button>
                          <input
                            type="text"
                            inputMode="decimal"
                            value={sk}
                            placeholder="0"
                            onChange={(e) => updateStock(item, provider, e.target.value)}
                            className={`w-9 border px-0.5 py-1 text-center font-mono text-[12.5px] ${
                              bajo ? "border-danger bg-danger-soft" : "border-ink bg-paper"
                            }`}
                          />
                          <button
                            type="button"
                            onClick={() => bump(item, provider, stp)}
                            className={`flex h-7 flex-shrink-0 items-center justify-center border border-ink bg-paper text-sm font-bold ${
                              wide ? "w-[34px] text-[10px]" : "w-7"
                            }`}
                          >
                            +{wide ? stp : ""}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
        {qn && ordered.every((p) => !p.products.some((it) => it.name.toLowerCase().includes(qn))) && (
          <div className="py-6 text-center text-xs text-sub">Sin resultados para &quot;{query}&quot;</div>
        )}
      </div>

      <div className="fixed bottom-0 left-0 right-0 border-t border-dashed border-line bg-cream px-4 pb-[calc(10px+env(safe-area-inset-bottom))] pt-2.5">
        <div className="mx-auto flex max-w-[480px] flex-col gap-2">
          <button
            type="button"
            onClick={goToNext}
            className={`flex w-full items-center justify-center gap-1.5 border-[1.5px] py-2.5 font-mono text-xs font-bold uppercase tracking-wide ${
              nextPending ? "border-accent bg-paper text-ink" : "border-ink bg-ink text-on-ink"
            }`}
          >
            {nextPending ? `Siguiente: ${nextPending.name}` : "Inventario completo"}
          </button>
          <div className="flex w-full items-center gap-1.5">
            <div className="flex-1 text-[10.5px] text-sub">{fil}/{tot} contados</div>
            <button
              type="button"
              onClick={handleReset}
              className="border border-danger bg-danger-soft px-3 py-1.5 text-xs font-bold text-danger"
            >
              Reset
            </button>
          </div>
        </div>
      </div>

      {toast && <Toast key={toast.id} text={toast.text} />}
      {confettiTrigger > 0 && <Confetti key={confettiTrigger} />}
    </div>
  );
}
