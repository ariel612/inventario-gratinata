"use client";

import { useEffect } from "react";

// Independiente del resto de la app: si el registro falla, la instalabilidad
// de la PWA no bloquea nada más.
export default function ServiceWorkerRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch((e) => console.warn("SW no registrado:", e));
    }
  }, []);
  return null;
}
