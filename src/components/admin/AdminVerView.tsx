"use client";

import { useMemo, useRef, useState } from "react";
import type { ProviderModel, ProductModel } from "@/generated/prisma/models";
import { Area } from "@/generated/prisma/enums";
import { updateStockAction } from "@/lib/actions/inventario";
import {
  updatePedidoAction,
  savePedidoAction,
  getPedidosHistorialAction,
  deletePedidoAction,
} from "@/lib/actions/pedidos";
import Modal from "@/components/Modal";

type Product = ProductModel;
type ProviderWithProducts = ProviderModel & { products: Product[] };
type EntryState = { stock: string; pedido: string };
type EntryMap = Record<string, EntryState>;

type WaEntry = { name: string; wa: string; items: { name: string; cantidad: string }[] };
type HistorialPedido = {
  id: string;
  fecha: string;
  items: { provider: string; product: string; cantidad: string }[];
};

function toEntryMap(
  currentStock: Record<string, { stock: number | null; procesado: boolean; pedido?: number | null }>
): EntryMap {
  const out: EntryMap = {};
  for (const [id, v] of Object.entries(currentStock)) {
    out[id] = {
      stock: v.stock === null || v.stock === undefined ? "" : String(v.stock),
      pedido: "",
    };
  }
  return out;
}

export default function AdminVerView({
  area,
  providers,
  currentStock,
  prevStock,
  pedidoInitial,
}: {
  area: Area;
  providers: ProviderWithProducts[];
  currentStock: Record<string, { stock: number | null; procesado: boolean }>;
  prevStock: Record<string, number | null>;
  pedidoInitial: Record<string, number | null>;
}) {
  const [entries, setEntries] = useState<EntryMap>(() => {
    const base = toEntryMap(currentStock);
    for (const [id, v] of Object.entries(pedidoInitial)) {
      base[id] = { ...(base[id] ?? { stock: "" }), pedido: v === null || v === undefined ? "" : String(v) };
    }
    return base;
  });
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [msg, setMsg] = useState("");
  const [waPick, setWaPick] = useState<WaEntry[] | null>(null);
  const [historial, setHistorial] = useState<HistorialPedido[] | null | "loading">(null);

  const saveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const allProducts = useMemo(() => providers.flatMap((p) => p.products), [providers]);
  const tot = allProducts.length;
  const fil = allProducts.filter((p) => (entries[p.id]?.stock ?? "") !== "").length;
  const pct = tot > 0 ? Math.round((fil / tot) * 100) : 0;

  const low = allProducts
    .map((p) => {
      const provider = providers.find((pr) => pr.products.some((x) => x.id === p.id))!;
      const s = parseFloat(entries[p.id]?.stock ?? "");
      return { product: p, provider, s };
    })
    .filter(({ product, s }) => !isNaN(s) && product.minStock > 0 && s < product.minStock);

  function scheduleSave(
    kind: "stock" | "pedido",
    productId: string,
    value: string,
    action: (input: { productId: string; area: Area; value: string }) => Promise<void>
  ) {
    const key = `${kind}-${productId}`;
    clearTimeout(saveTimers.current[key]);
    setMsg("Guardando...");
    saveTimers.current[key] = setTimeout(async () => {
      try {
        await action({ productId, area, value });
        setMsg("Guardado");
        setTimeout(() => setMsg(""), 2000);
      } catch {
        setMsg("Error");
      }
    }, 600);
  }

  function updateStock(productId: string, rawValue: string) {
    const value = rawValue.replace(",", ".");
    setEntries((prev) => ({ ...prev, [productId]: { ...(prev[productId] ?? { pedido: "" }), stock: value } }));
    scheduleSave("stock", productId, value, updateStockAction);
  }

  function updatePedido(productId: string, rawValue: string) {
    setEntries((prev) => ({ ...prev, [productId]: { ...(prev[productId] ?? { stock: "" }), pedido: rawValue } }));
    scheduleSave("pedido", productId, rawValue, updatePedidoAction);
  }

  const qn = query.trim().toLowerCase();
  const ordered = useMemo(() => {
    return providers
      .map((p, idx) => ({
        p,
        idx,
        done: p.products.every((pr) => (entries[pr.id]?.stock ?? "") !== ""),
      }))
      .sort((a, b) => Number(a.done) - Number(b.done) || a.idx - b.idx)
      .map((o) => o.p);
  }, [providers, entries]);

  function downloadTxt(filename: string, lines: string[]) {
    const blob = new Blob([lines.join("\n")], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleDownloadInventario() {
    const lines = ["Inventario - Gratinata Pizza", `Semana: ${new Date().toLocaleDateString("es-CL")}`, ""];
    providers.forEach((g) => {
      lines.push(`== ${g.name} ==`);
      g.products.forEach((i) => {
        const e = entries[i.id];
        lines.push(`[ ] ${i.name} | Stock: ${e?.stock || "-"} | Min: ${i.minStock}`);
      });
      lines.push("");
    });
    downloadTxt(`inventario_${new Date().toISOString().slice(0, 10)}.txt`, lines);
  }

  function pedidosPorProveedor(): WaEntry[] {
    return providers
      .map((g) => ({
        name: g.name,
        wa: g.whatsapp || "",
        items: g.products
          .filter((i) => (entries[i.id]?.pedido ?? "") !== "")
          .map((i) => ({ name: i.name, cantidad: entries[i.id]!.pedido })),
      }))
      .filter((g) => g.items.length > 0);
  }

  function handleDownloadPedido() {
    const byProv = pedidosPorProveedor();
    if (byProv.length === 0) {
      alert("No hay pedidos ingresados");
      return;
    }
    const lines: string[] = [];
    byProv.forEach((g) => {
      lines.push(g.name);
      g.items.forEach((i) => lines.push(`* ${i.name} ${i.cantidad}`));
      lines.push("");
    });
    downloadTxt(`pedido_${new Date().toISOString().slice(0, 10)}.txt`, lines);
  }

  function sendProvWA(entry: WaEntry) {
    const lines = [`*${entry.name}*`, ...entry.items.map((i) => `* ${i.cantidad} ${i.name}`)];
    const txt = encodeURIComponent(lines.join("\n"));
    if (!entry.wa) {
      alert(`Falta el número de WhatsApp de "${entry.name}". Agregalo en Editar.`);
      return;
    }
    window.open(`https://wa.me/${entry.wa}?text=${txt}`, "_blank");
  }

  async function handleWhatsApp() {
    const byProv = pedidosPorProveedor();
    if (byProv.length === 0) {
      alert("No hay pedidos ingresados");
      return;
    }
    await savePedidoAction({
      area,
      items: byProv.flatMap((p) => p.items.map((i) => ({ provider: p.name, product: i.name, cantidad: i.cantidad }))),
    });
    if (byProv.length === 1) {
      sendProvWA(byProv[0]);
    } else {
      setWaPick(byProv);
    }
  }

  async function openHistorial() {
    setHistorial("loading");
    const data = await getPedidosHistorialAction({ area });
    setHistorial(data);
  }

  async function handleDeleteHistorial(id: string) {
    if (!confirm("¿Eliminar este registro del historial? No se puede deshacer.")) return;
    await deletePedidoAction({ id, area });
    setHistorial((prev) => (Array.isArray(prev) ? prev.filter((p) => p.id !== id) : prev));
  }

  return (
    <div className="pb-24">
      <div className="grid grid-cols-2 gap-2 px-4 pt-3">
        <div className="border border-line-soft bg-paper p-2.5">
          <div className="mb-1 text-[10px] uppercase tracking-wide text-sub">Bajo mínimo</div>
          <div className={`font-mono text-xl font-bold ${low.length > 0 ? "text-danger" : "text-ink"}`}>
            {low.length}
          </div>
        </div>
        <div className="border border-line-soft bg-paper p-2.5">
          <div className="mb-1 text-[10px] uppercase tracking-wide text-sub">Completado</div>
          <div className="font-mono text-xl font-bold">{pct}%</div>
        </div>
      </div>

      {low.length > 0 && (
        <div className="mx-4 mt-3 border border-dashed border-danger bg-danger-soft p-3">
          <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-danger">Bajo mínimo</div>
          {low.map(({ product, provider, s }) => (
            <div key={product.id} className="py-0.5 text-[11.5px] text-[#7a2c1c]">
              {product.name} stock:{s}/min:{product.minStock} ({provider.name})
            </div>
          ))}
        </div>
      )}

      {msg && <div className="px-4 pt-2 text-right text-[10px] text-accent">{msg}</div>}

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
          const doneCt = items.filter((it) => (entries[it.id]?.stock ?? "") !== "").length;

          return (
            <div key={provider.id} className={`border-b border-dashed border-line ${open ? "bg-paper" : ""}`}>
              <div
                className={`flex cursor-pointer items-baseline gap-1.5 py-2.5 ${
                  open ? "border-b border-dashed border-line-soft" : ""
                }`}
                onClick={() => setExpanded((prev) => ({ ...prev, [provider.id]: !prev[provider.id] }))}
              >
                <span className="text-xs font-bold uppercase tracking-wide text-ink">{provider.name}</span>
                <span className="mx-1.5 mb-[3px] min-w-[8px] flex-1 border-b border-dotted border-[#b3ac9c]" />
                <span className="text-[11px] font-bold opacity-80">
                  {doneCt}/{items.length}
                </span>
              </div>

              {open && (
                <div className="py-0.5">
                  {items.map((item) => {
                    const entry = entries[item.id];
                    const sk = entry?.stock ?? "";
                    const ped = entry?.pedido ?? "";
                    const sn = parseFloat(sk);
                    const bajo = !isNaN(sn) && item.minStock > 0 && sn < item.minStock;
                    const prev = prevStock[item.id];
                    const df = prev !== null && prev !== undefined && sk !== "" ? sn - prev : null;

                    return (
                      <div
                        key={item.id}
                        className={`flex items-center gap-2 border-b border-dotted border-line-soft py-2 last:border-none ${
                          bajo ? "bg-danger-soft" : ""
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="overflow-hidden text-ellipsis whitespace-nowrap text-[12.5px] text-text">
                            {item.name}
                          </div>
                          {item.minStock > 0 && (
                            <div className={`mt-0.5 text-[10px] ${bajo ? "font-bold text-danger" : "text-sub"}`}>
                              min:{item.minStock}
                              {bajo ? " BAJO" : ""}
                            </div>
                          )}
                        </div>
                        {df !== null && (
                          <span className={`flex-shrink-0 text-[10px] font-bold ${df >= 0 ? "text-ink" : "text-danger"}`}>
                            {df >= 0 ? "+" : ""}
                            {df.toFixed(1)}
                          </span>
                        )}
                        <input
                          type="text"
                          inputMode="decimal"
                          value={sk}
                          placeholder="0"
                          onChange={(e) => updateStock(item.id, e.target.value)}
                          className={`w-9 flex-shrink-0 border px-0.5 py-1 text-center font-mono text-[12.5px] ${
                            bajo ? "border-danger bg-danger-soft" : "border-ink bg-paper"
                          }`}
                        />
                        <input
                          type="number"
                          min={0}
                          step={1}
                          value={ped}
                          placeholder="ped"
                          onChange={(e) => updatePedido(item.id, e.target.value)}
                          className="w-10 flex-shrink-0 border border-warn bg-warn-soft px-0.5 py-1 text-center font-mono text-[12.5px] text-text"
                        />
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="fixed bottom-0 left-0 right-0 border-t border-dashed border-line bg-cream px-4 pb-[calc(10px+env(safe-area-inset-bottom))] pt-2.5">
        <div className="mx-auto flex max-w-[480px] gap-1.5">
          <button
            type="button"
            onClick={handleDownloadInventario}
            className="flex-1 border border-line bg-paper py-2 text-xs font-bold"
          >
            Inventario
          </button>
          <button
            type="button"
            onClick={handleDownloadPedido}
            className="flex-1 border border-accent bg-paper py-2 text-[11px] font-bold"
          >
            Pedido
          </button>
          <button
            type="button"
            onClick={handleWhatsApp}
            className="flex-1 border border-[#25d366] bg-[#25d366] py-2 text-[11px] font-bold text-white"
          >
            WhatsApp
          </button>
          <button
            type="button"
            onClick={openHistorial}
            className="flex-1 border border-line bg-cream py-2 text-[11px] font-bold text-ink"
          >
            Historial
          </button>
        </div>
      </div>

      {waPick && (
        <Modal title="Enviar pedido por WhatsApp" onClose={() => setWaPick(null)}>
          {waPick.map((entry) => (
            <div key={entry.name} className="flex items-center justify-between gap-2 border-b border-line py-2.5">
              <span className="text-[13px] font-semibold">
                {entry.name}
                {!entry.wa && <span className="ml-1.5 text-[11px] font-medium text-danger">(sin número)</span>}
              </span>
              <button
                type="button"
                onClick={() => sendProvWA(entry)}
                className="border border-accent bg-paper px-3.5 py-1.5 text-xs font-bold"
              >
                Enviar
              </button>
            </div>
          ))}
        </Modal>
      )}

      {historial !== null && (
        <Modal title="Historial de pedidos" onClose={() => setHistorial(null)} maxWidth={440}>
          {historial === "loading" && <div className="py-2.5 text-center text-[13px] text-sub">Cargando...</div>}
          {Array.isArray(historial) && historial.length === 0 && (
            <div className="py-2.5 text-center text-[13px] text-sub">No hay pedidos guardados</div>
          )}
          {Array.isArray(historial) &&
            historial.map((h) => {
              const byProv = new Map<string, { product: string; cantidad: string }[]>();
              h.items.forEach((i) => {
                if (!byProv.has(i.provider)) byProv.set(i.provider, []);
                byProv.get(i.provider)!.push(i);
              });
              return (
                <div key={h.id} className="mb-3.5">
                  <div className="mb-1.5 flex items-center justify-between">
                    <span className="text-[13px] font-semibold">{h.fecha}</span>
                    <button
                      type="button"
                      onClick={() => handleDeleteHistorial(h.id)}
                      className="border border-danger bg-danger-soft px-2 py-1 text-[11px] font-bold text-danger"
                    >
                      Eliminar
                    </button>
                  </div>
                  {[...byProv.entries()].map(([provider, items]) => (
                    <div key={provider}>
                      <div className="mt-1 text-xs font-semibold text-accent">{provider}</div>
                      {items.map((i, idx) => (
                        <div key={idx} className="py-0.5 text-[13px]">
                          &bull; {i.cantidad} {i.product}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              );
            })}
        </Modal>
      )}
    </div>
  );
}
