"use client";

import { useState, useTransition } from "react";
import type { ProviderModel, ProductModel } from "@/generated/prisma/models";
import { Area } from "@/generated/prisma/enums";
import { getAdminVerDataAction } from "@/lib/actions/adminVer";
import AdminVerView from "@/components/admin/AdminVerView";
import AdminEditarView from "@/components/admin/AdminEditarView";
import AdminAgregarView from "@/components/admin/AdminAgregarView";
import AdminUsuariosView from "@/components/admin/AdminUsuariosView";
import AdminRecetasView from "@/components/admin/AdminRecetasView";

type ProviderWithProducts = ProviderModel & { products: ProductModel[] };

type VerData = {
  providers: ProviderWithProducts[];
  currentStock: Record<string, { stock: number | null; procesado: boolean }>;
  currentPedido: Record<string, number | null>;
  prevStock: Record<string, number | null>;
};

const AREA_LABEL: Record<Area, string> = {
  [Area.COCINA]: "Cocina",
  [Area.RECEPCION]: "Recepción",
};

const SUBTABS = [
  { id: "ver", label: "Ver" },
  { id: "editar", label: "Editar" },
  { id: "agregar", label: "Agregar" },
  { id: "usuarios", label: "Usuarios" },
  { id: "recetas", label: "Recetas" },
] as const;

type SubtabId = (typeof SUBTABS)[number]["id"];

export default function AdminShell({ initialArea, initialData }: { initialArea: Area; initialData: VerData }) {
  const [area, setArea] = useState<Area>(initialArea);
  const [data, setData] = useState<VerData>(initialData);
  const [subtab, setSubtab] = useState<SubtabId>("ver");
  const [pending, startTransition] = useTransition();

  function loadArea(next: Area) {
    startTransition(async () => {
      const fresh = await getAdminVerDataAction({ area: next });
      setData(fresh);
    });
  }

  function switchArea(next: Area) {
    if (next === area) return;
    setArea(next);
    loadArea(next);
  }

  function refreshCatalog() {
    loadArea(area);
  }

  return (
    <div>
      <div className="flex border-b border-line" style={{ margin: "0 16px 10px" }}>
        {(Object.values(Area) as Area[]).map((a) => (
          <button
            key={a}
            type="button"
            onClick={() => switchArea(a)}
            className={`flex-1 py-2 text-[11px] font-bold uppercase tracking-wide ${
              area === a ? "bg-ink text-on-ink" : "text-sub"
            }`}
          >
            {AREA_LABEL[a]}
          </button>
        ))}
      </div>

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

      {pending && <div className="px-4 pt-2 text-[11px] text-sub">Cargando {AREA_LABEL[area]}...</div>}

      {!pending && subtab === "ver" && (
        <AdminVerView
          area={area}
          providers={data.providers}
          currentStock={data.currentStock}
          prevStock={data.prevStock}
          pedidoInitial={data.currentPedido}
        />
      )}
      {!pending && subtab === "editar" && (
        <AdminEditarView area={area} providers={data.providers} onChanged={refreshCatalog} />
      )}
      {!pending && subtab === "agregar" && (
        <AdminAgregarView area={area} providers={data.providers} onChanged={refreshCatalog} />
      )}
      {!pending && subtab === "usuarios" && <AdminUsuariosView />}
      {!pending && subtab === "recetas" && <AdminRecetasView />}
    </div>
  );
}
