"use client";

import { useEffect, useState } from "react";

export function useToast() {
  const [toast, setToast] = useState<{ id: number; text: string } | null>(null);

  function show(text: string) {
    setToast({ id: Date.now(), text });
  }

  return { toast, show };
}

export default function Toast({ text }: { text: string }) {
  const [out, setOut] = useState(false);

  useEffect(() => {
    const t1 = setTimeout(() => setOut(true), 1900);
    return () => clearTimeout(t1);
  }, []);

  return (
    <div
      className={`fixed left-1/2 bottom-[104px] z-[200] -translate-x-1/2 whitespace-nowrap border border-accent bg-ink px-4 py-2.5 font-mono text-xs font-bold uppercase tracking-wide text-on-ink transition-opacity duration-300 ${
        out ? "opacity-0" : "opacity-100"
      }`}
    >
      {text}
    </div>
  );
}
