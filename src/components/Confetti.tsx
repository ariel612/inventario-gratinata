"use client";

import { useEffect, useState } from "react";

const COLORS = ["#c9971f", "#efe9dc", "#1a1a1a", "#a8402f"];

function makePieces() {
  return Array.from({ length: 44 }, (_, i) => ({
    id: i,
    left: Math.random() * 100,
    color: COLORS[i % COLORS.length],
    duration: 1.5 + Math.random() * 1.4,
    delay: Math.random() * 0.5,
  }));
}

// El padre debe montar este componente con una `key` distinta por cada
// festejo (ej. key={confettiTrigger}) para reiniciar la animación.
export default function Confetti() {
  const [pieces] = useState(makePieces);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setVisible(false), 3600);
    return () => clearTimeout(t);
  }, []);

  if (!visible) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-[300] overflow-hidden">
      {pieces.map((p) => (
        <div
          key={p.id}
          className="absolute h-[7px] w-[7px] animate-[fall_linear_forwards]"
          style={{
            left: `${p.left}%`,
            background: p.color,
            animationDuration: `${p.duration}s`,
            animationDelay: `${p.delay}s`,
          }}
        />
      ))}
      <style>{`
        @keyframes fall {
          0% { transform: translateY(-20px) rotate(0); opacity: 1; }
          100% { transform: translateY(105vh) rotate(600deg); opacity: .9; }
        }
      `}</style>
    </div>
  );
}
