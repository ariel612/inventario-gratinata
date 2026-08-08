"use client";

import { useEffect, useState } from "react";

export default function ThemeToggle() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    // Lee el estado real del DOM (seteado sin flicker por el script inline
    // en <head>) recién al montar en cliente — el servidor no sabe el tema.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDark(document.documentElement.dataset.theme === "dark");
  }, []);

  function toggle() {
    const next = !dark;
    setDark(next);
    document.documentElement.dataset.theme = next ? "dark" : "light";
    try {
      localStorage.setItem("gratinata_theme", next ? "dark" : "light");
    } catch {
      // localStorage no disponible (modo privado, etc.)
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      title={dark ? "Modo claro" : "Modo oscuro"}
      className="border border-line bg-paper px-2 py-1 text-sm"
    >
      {dark ? "☀️" : "🌙"}
    </button>
  );
}
