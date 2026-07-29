"use client";

import { useMemo, useState } from "react";

export function PublicTallerBrand({
  nombre,
  logoUrl,
}: {
  nombre?: string;
  logoUrl?: string;
}) {
  const [logoFallido, setLogoFallido] = useState<string | null>(null);

  const iniciales = useMemo(
    () =>
      (nombre || "Taller")
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((parte) => parte[0])
        .join("")
        .toUpperCase(),
    [nombre],
  );

  return (
    <div className="mb-4 flex items-center gap-3 border-b border-slate-100 pb-4">
      {logoUrl && logoFallido !== logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- URL administrada por cada tenant.
        <img
          src={logoUrl}
          alt={`Logo de ${nombre || "taller"}`}
          className="h-11 w-11 rounded-xl border border-slate-200 bg-white object-contain p-1"
          onError={() => setLogoFallido(logoUrl)}
        />
      ) : (
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-900 text-xs font-black tracking-wider text-white">
          {iniciales || "T"}
        </div>
      )}
      <div className="min-w-0">
        <p className="truncate text-sm font-black text-slate-900">{nombre || "Mi Taller"}</p>
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
          Documento del taller
        </p>
      </div>
    </div>
  );
}
