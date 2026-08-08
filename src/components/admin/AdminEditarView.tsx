"use client";

import { useState } from "react";
import type { ProviderModel, ProductModel } from "@/generated/prisma/models";
import { Area } from "@/generated/prisma/enums";
import {
  updateProviderWhatsappAction,
  editProductAction,
  deleteProductAction,
} from "@/lib/actions/catalogo";
import Modal from "@/components/Modal";

type ProviderWithProducts = ProviderModel & { products: ProductModel[] };

export default function AdminEditarView({
  providers,
  onChanged,
}: {
  area: Area;
  providers: ProviderWithProducts[];
  onChanged: () => void;
}) {
  const [waEdits, setWaEdits] = useState<Record<string, string>>(() =>
    Object.fromEntries(providers.map((p) => [p.id, p.whatsapp || ""]))
  );
  const [modal, setModal] = useState<{ productId: string; name: string; min: string } | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [query, setQuery] = useState("");
  const [msg, setMsg] = useState("");

  async function saveWa(providerId: string) {
    await updateProviderWhatsappAction({ providerId, whatsapp: waEdits[providerId] || "" });
    setMsg("Guardado");
    setTimeout(() => setMsg(""), 1500);
  }

  async function handleDelete(productId: string, name: string, providerName: string) {
    if (!confirm(`¿Eliminar "${name}" del proveedor ${providerName}? Esta acción no se puede deshacer.`)) return;
    await deleteProductAction({ productId });
    onChanged();
  }

  async function handleSaveEdit() {
    if (!modal) return;
    await editProductAction({ productId: modal.productId, name: modal.name, min: parseFloat(modal.min) || 0 });
    setModal(null);
    onChanged();
  }

  const qn = query.trim().toLowerCase();

  return (
    <div className="pb-8">
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
        {providers.map((provider) => {
          const items = qn
            ? provider.products.filter((it) => it.name.toLowerCase().includes(qn))
            : provider.products;
          if (items.length === 0) return null;
          const open = qn ? true : !!expanded[provider.id];

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
                <span className="text-[11px] font-bold opacity-80">{items.length}</span>
              </div>

              {open && (
                <div className="py-0.5">
                  <div className="flex items-center gap-2 border-b border-dashed border-line py-2">
                    <label className="flex-shrink-0 text-[11px] text-sub">WhatsApp</label>
                    <input
                      type="tel"
                      inputMode="numeric"
                      placeholder="56912345678"
                      value={waEdits[provider.id] ?? ""}
                      onChange={(e) =>
                        setWaEdits((prev) => ({
                          ...prev,
                          [provider.id]: e.target.value.replace(/[^0-9]/g, ""),
                        }))
                      }
                      onBlur={() => saveWa(provider.id)}
                      className="flex-1 border border-line bg-paper px-2 py-1.5 font-mono text-[13px] text-text"
                    />
                  </div>
                  {items.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center gap-2 border-b border-dotted border-line-soft py-2 last:border-none"
                    >
                      <div className="min-w-0 flex-1 text-[12.5px]">{item.name}</div>
                      <div className="flex flex-shrink-0 gap-1.5">
                        <button
                          type="button"
                          onClick={() => setModal({ productId: item.id, name: item.name, min: String(item.minStock) })}
                          className="border border-line bg-paper px-2 py-1 text-[11px] font-bold"
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(item.id, item.name, provider.name)}
                          className="border border-danger bg-danger-soft px-2 py-1 text-[11px] font-bold text-danger"
                        >
                          Eliminar
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {modal && (
        <Modal title="Editar producto" onClose={() => setModal(null)}>
          <div className="mb-2.5">
            <label className="mb-1 block text-[10px] uppercase tracking-wide text-sub">Nombre</label>
            <input
              className="w-full border border-line bg-paper px-2.5 py-2 font-mono text-[13px]"
              value={modal.name}
              onChange={(e) => setModal({ ...modal, name: e.target.value })}
            />
          </div>
          <div className="mb-2.5">
            <label className="mb-1 block text-[10px] uppercase tracking-wide text-sub">Mínimo</label>
            <input
              type="number"
              min={0}
              step={0.5}
              className="w-full border border-line bg-paper px-2.5 py-2 font-mono text-[13px]"
              value={modal.min}
              onChange={(e) => setModal({ ...modal, min: e.target.value })}
            />
          </div>
          <button
            type="button"
            onClick={handleSaveEdit}
            className="w-full border-[1.5px] border-accent bg-paper py-2.5 text-xs font-bold uppercase tracking-wide"
          >
            Guardar
          </button>
        </Modal>
      )}
    </div>
  );
}
