"use client";

import type { ReactNode } from "react";

export default function Modal({
  title,
  children,
  onClose,
  maxWidth = 380,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  maxWidth?: number;
}) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[rgba(20,16,10,.55)] p-4">
      <div
        className="max-h-[80vh] w-full overflow-auto border-2 border-accent bg-paper p-5 outline outline-1 outline-offset-4 outline-accent"
        style={{ maxWidth }}
      >
        <div className="mb-3.5 font-mono text-sm font-bold uppercase tracking-wide">{title}</div>
        {children}
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="w-full border border-line bg-paper py-2.5 font-mono text-xs font-bold uppercase tracking-wide"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
