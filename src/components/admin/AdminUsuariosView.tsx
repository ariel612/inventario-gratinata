"use client";

import { useEffect, useState } from "react";
import { Role } from "@/generated/prisma/enums";
import {
  listUsersAction,
  createUserAction,
  resetPasswordAction,
  toggleUserActiveAction,
  getAlertaWaAction,
  updateAlertaWaAction,
} from "@/lib/actions/usuarios";

type UserRow = { id: string; username: string; name: string; role: Role; active: boolean };

const ROLE_LABEL: Record<Role, string> = {
  [Role.COCINA]: "Cocina",
  [Role.RECEPCION]: "Recepción",
  [Role.ADMIN]: "Admin",
};

export default function AdminUsuariosView() {
  const [users, setUsers] = useState<UserRow[] | null>(null);
  const [msg, setMsg] = useState("");

  const [username, setUsername] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<Role>(Role.COCINA);
  const [password, setPassword] = useState("");
  const [formError, setFormError] = useState("");

  const [resetTarget, setResetTarget] = useState<string | null>(null);
  const [resetPassword, setResetPassword] = useState("");

  const [alertaWa, setAlertaWa] = useState("");
  const [alertaMsg, setAlertaMsg] = useState("");

  useEffect(() => {
    listUsersAction().then(setUsers);
    getAlertaWaAction().then(setAlertaWa);
  }, []);

  async function refreshUsers() {
    setUsers(await listUsersAction());
  }

  async function handleCreate() {
    setFormError("");
    try {
      await createUserAction({ username, name, role, password });
      setUsername("");
      setName("");
      setPassword("");
      setRole(Role.COCINA);
      await refreshUsers();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "No se pudo crear el usuario");
    }
  }

  async function handleResetPassword() {
    if (!resetTarget) return;
    await resetPasswordAction({ userId: resetTarget, password: resetPassword });
    setResetTarget(null);
    setResetPassword("");
    setMsg("Contraseña actualizada");
    setTimeout(() => setMsg(""), 2000);
  }

  async function handleToggleActive(userId: string) {
    await toggleUserActiveAction({ userId });
    await refreshUsers();
  }

  async function handleSaveAlerta() {
    await updateAlertaWaAction({ whatsapp: alertaWa });
    setAlertaMsg("Guardado");
    setTimeout(() => setAlertaMsg(""), 2000);
  }

  return (
    <div className="px-4 pb-8 pt-3">
      <div className="mb-4 border border-dashed border-line bg-paper p-3.5">
        <div className="mb-2.5 font-mono text-xs font-bold uppercase tracking-wide">Nuevo usuario</div>
        <div className="mb-2">
          <label className="mb-1 block text-[10px] uppercase tracking-wide text-sub">Usuario</label>
          <input
            className="w-full border border-line bg-paper px-2.5 py-2 font-mono text-[13px]"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
        </div>
        <div className="mb-2">
          <label className="mb-1 block text-[10px] uppercase tracking-wide text-sub">Nombre</label>
          <input
            className="w-full border border-line bg-paper px-2.5 py-2 font-mono text-[13px]"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div className="mb-2">
          <label className="mb-1 block text-[10px] uppercase tracking-wide text-sub">Rol</label>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as Role)}
            className="w-full border border-line bg-paper px-2.5 py-2 font-mono text-[13px]"
          >
            {Object.values(Role).map((r) => (
              <option key={r} value={r}>
                {ROLE_LABEL[r]}
              </option>
            ))}
          </select>
        </div>
        <div className="mb-2.5">
          <label className="mb-1 block text-[10px] uppercase tracking-wide text-sub">Contraseña temporal</label>
          <input
            type="text"
            className="w-full border border-line bg-paper px-2.5 py-2 font-mono text-[13px]"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        {formError && <div className="mb-2 text-[11px] text-danger">{formError}</div>}
        <button
          type="button"
          onClick={handleCreate}
          className="w-full border-[1.5px] border-accent bg-paper py-2.5 text-xs font-bold uppercase tracking-wide"
        >
          Crear usuario
        </button>
      </div>

      {msg && <div className="mb-2 text-[11px] text-accent">{msg}</div>}

      {users === null && <div className="text-[13px] text-sub">Cargando...</div>}
      {users?.map((u) => (
        <div key={u.id} className="flex items-center justify-between border-b border-dotted border-line-soft py-2.5">
          <div className="min-w-0">
            <div className={`text-[13px] font-semibold ${u.active ? "" : "text-sub line-through"}`}>
              {u.name} <span className="text-[11px] font-normal text-sub">({u.username})</span>
            </div>
            <div className="text-[11px] text-accent">{ROLE_LABEL[u.role]}</div>
          </div>
          <div className="flex flex-shrink-0 gap-1.5">
            <button
              type="button"
              onClick={() => setResetTarget(u.id)}
              className="border border-line bg-paper px-2 py-1 text-[11px] font-bold"
            >
              Reset password
            </button>
            <button
              type="button"
              onClick={() => handleToggleActive(u.id)}
              className={`border px-2 py-1 text-[11px] font-bold ${
                u.active ? "border-danger bg-danger-soft text-danger" : "border-line bg-paper"
              }`}
            >
              {u.active ? "Desactivar" : "Activar"}
            </button>
          </div>
        </div>
      ))}

      {resetTarget && (
        <div className="mt-3 border border-dashed border-accent bg-accent-soft p-3">
          <label className="mb-1 block text-[10px] uppercase tracking-wide text-sub">Nueva contraseña</label>
          <input
            className="mb-2 w-full border border-line bg-paper px-2.5 py-2 font-mono text-[13px]"
            value={resetPassword}
            onChange={(e) => setResetPassword(e.target.value)}
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setResetTarget(null)}
              className="flex-1 border border-line bg-paper py-2 text-xs font-bold"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleResetPassword}
              className="flex-1 border-[1.5px] border-accent bg-paper py-2 text-xs font-bold"
            >
              Guardar
            </button>
          </div>
        </div>
      )}

      <div className="mt-5 border border-dashed border-line bg-paper p-3.5">
        <label className="mb-1 block text-[10px] uppercase tracking-wide text-sub">
          WhatsApp para avisos de cierre incompleto
        </label>
        <input
          type="tel"
          inputMode="numeric"
          placeholder="56912345678"
          className="mb-2 w-full border border-line bg-paper px-2.5 py-2 font-mono text-[13px]"
          value={alertaWa}
          onChange={(e) => setAlertaWa(e.target.value.replace(/[^0-9]/g, ""))}
        />
        {alertaMsg && <div className="mb-2 text-[11px] text-accent">{alertaMsg}</div>}
        <button
          type="button"
          onClick={handleSaveAlerta}
          className="w-full border-[1.5px] border-accent bg-paper py-2.5 text-xs font-bold uppercase tracking-wide"
        >
          Guardar
        </button>
      </div>
    </div>
  );
}
