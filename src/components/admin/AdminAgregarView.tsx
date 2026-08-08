"use client";

import { useState } from "react";
import type { ProviderModel, ProductModel } from "@/generated/prisma/models";
import { Area } from "@/generated/prisma/enums";
import { addProductAction } from "@/lib/actions/catalogo";

type ProviderWithProducts = ProviderModel & { products: ProductModel[] };

const NUEVO = "__nuevo__";

export default function AdminAgregarView({
  area,
  providers,
  onChanged,
}: {
  area: Area;
  providers: ProviderWithProducts[];
  onChanged: () => void;
}) {
  const [providerId, setProviderId] = useState("");
  const [newProviderName, setNewProviderName] = useState("");
  const [newProviderWa, setNewProviderWa] = useState("");
  const [productName, setProductName] = useState("");
  const [min, setMin] = useState("");
  const [msg, setMsg] = useState("");

  async function handleAdd() {
    if (!productName.trim()) return;
    if (!providerId && !newProviderName.trim()) return;

    await addProductAction({
      area,
      providerId: providerId && providerId !== NUEVO ? providerId : undefined,
      newProviderName: providerId === NUEVO ? newProviderName.trim() : undefined,
      newProviderWa: providerId === NUEVO ? newProviderWa : undefined,
      productName: productName.trim(),
      min: parseFloat(min) || 0,
    });

    setProductName("");
    setMin("");
    if (providerId === NUEVO) {
      setNewProviderName("");
      setNewProviderWa("");
    }
    setMsg("Agregado");
    setTimeout(() => setMsg(""), 1500);
    onChanged();
  }

  return (
    <div className="border border-dashed border-line bg-paper p-3.5 mx-4 mt-3">
      <div className="mb-2.5">
        <label className="mb-1 block text-[10px] uppercase tracking-wide text-sub">Proveedor</label>
        <select
          value={providerId}
          onChange={(e) => setProviderId(e.target.value)}
          className="w-full border border-line bg-paper px-2.5 py-2 font-mono text-[13px]"
        >
          <option value="">Seleccionar</option>
          {providers.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
          <option value={NUEVO}>+ Nuevo</option>
        </select>
      </div>

      {providerId === NUEVO && (
        <>
          <div className="mb-2.5">
            <label className="mb-1 block text-[10px] uppercase tracking-wide text-sub">Nuevo proveedor</label>
            <input
              className="w-full border border-line bg-paper px-2.5 py-2 font-mono text-[13px]"
              value={newProviderName}
              onChange={(e) => setNewProviderName(e.target.value.toUpperCase())}
            />
          </div>
          <div className="mb-2.5">
            <label className="mb-1 block text-[10px] uppercase tracking-wide text-sub">
              WhatsApp del proveedor (opcional)
            </label>
            <input
              type="tel"
              inputMode="numeric"
              placeholder="56912345678"
              className="w-full border border-line bg-paper px-2.5 py-2 font-mono text-[13px]"
              value={newProviderWa}
              onChange={(e) => setNewProviderWa(e.target.value.replace(/[^0-9]/g, ""))}
            />
          </div>
        </>
      )}

      <div className="mb-2.5">
        <label className="mb-1 block text-[10px] uppercase tracking-wide text-sub">Nombre producto</label>
        <input
          className="w-full border border-line bg-paper px-2.5 py-2 font-mono text-[13px]"
          value={productName}
          onChange={(e) => setProductName(e.target.value)}
        />
      </div>
      <div className="mb-2.5">
        <label className="mb-1 block text-[10px] uppercase tracking-wide text-sub">Mínimo</label>
        <input
          type="number"
          min={0}
          step={0.5}
          className="w-full border border-line bg-paper px-2.5 py-2 font-mono text-[13px]"
          value={min}
          onChange={(e) => setMin(e.target.value)}
        />
      </div>

      {msg && <div className="mb-2 text-[11px] text-accent">{msg}</div>}

      <button
        type="button"
        onClick={handleAdd}
        className="w-full border-[1.5px] border-accent bg-paper py-2.5 text-xs font-bold uppercase tracking-wide"
      >
        + Agregar
      </button>
    </div>
  );
}
