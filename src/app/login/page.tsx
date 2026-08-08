"use client";

import { useState, useTransition } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    startTransition(async () => {
      const res = await signIn("credentials", { username, password, redirect: false });
      if (!res || res.error) {
        setError("Usuario o contraseña incorrectos");
        return;
      }
      router.push("/");
      router.refresh();
    });
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-cream px-6 text-text">
      <div className="text-center">
        <div className="text-lg font-bold tracking-wide">GRATINATA</div>
        <div className="text-xs text-sub">Cocina Artesanal</div>
      </div>
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-[300px] border-2 border-accent bg-paper p-6 text-center outline outline-1 outline-offset-4 outline-accent"
      >
        <div className="mb-3 text-[11px] uppercase tracking-wide text-sub">Ingresa tus datos</div>
        <input
          className="mb-2.5 w-full border border-ink bg-cream px-2 py-2 text-center font-mono text-base"
          placeholder="Usuario"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoFocus
          autoComplete="username"
        />
        <input
          className="mb-3 w-full border border-ink bg-cream px-2 py-2 text-center font-mono text-base"
          placeholder="Contraseña"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
        />
        {error && <div className="mb-2.5 text-[11px] text-danger">{error}</div>}
        <button
          type="submit"
          disabled={pending}
          className="w-full border-[1.5px] border-ink bg-paper py-2.5 text-xs font-bold uppercase tracking-wide disabled:opacity-60"
        >
          {pending ? "Entrando..." : "Entrar"}
        </button>
      </form>
    </div>
  );
}
