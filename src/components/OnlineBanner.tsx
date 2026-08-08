"use client";

import { useEffect, useState } from "react";

export default function OnlineBanner() {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    // navigator.onLine solo existe en cliente; el servidor no puede saberlo.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOnline(navigator.onLine);
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  if (online) return null;

  return (
    <div className="bg-warn-soft px-2 py-1.5 text-center text-[11.5px] text-warn">
      Sin conexión: los cambios no se pueden guardar hasta que vuelva el wifi.
    </div>
  );
}
