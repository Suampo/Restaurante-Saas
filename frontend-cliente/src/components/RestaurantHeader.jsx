// src/components/RestaurantHeader.jsx
import React from "react";

const API_BASE =
  import.meta.env.VITE_API_PEDIDOS ||
  import.meta.env.VITE_API_URL ||
  "http://localhost:4000";

const isAbs = (u = "") =>
  /^https?:\/\//i.test(u) || u.startsWith("data:") || u.startsWith("blob:");

const toAbs = (u = "") =>
  isAbs(u) ? u : `${API_BASE}${u.startsWith("/") ? "" : "/"}${u}`;

export default function RestaurantHeader({
  name,
  mesaText,
  loading,
  coverUrl,
}) {
  const displayName = loading ? "Cargando…" : name || "Restaurante demo";
  const fullCover = coverUrl ? toAbs(coverUrl) : null;

  return (
    <div className="mb-5 md:mb-7">
      <div className="relative overflow-hidden rounded-[32px] shadow-card">
        {/* Fondo: imagen + degradado, como en el diseño */}
        {fullCover && (
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: `url("${fullCover}")` }}
          />
        )}
        {!fullCover && (
          <div className="absolute inset-0 bg-gradient-to-r from-[#fdf5ec] via-[#fefaf4] to-[#fde7d0]" />
        )}
        {/* Degradado para que el texto sea legible encima de la foto */}
        <div className="absolute inset-0 bg-gradient-to-r from-white/96 via-white/82 to-white/40" />

        {/* Contenido */}
        <div className="relative px-5 py-4 sm:px-7 sm:py-5 md:px-8 md:py-6 flex flex-col gap-3">
          <div className="space-y-1">
            <div className="text-[11px] font-semibold tracking-[0.22em] text-amber-500 uppercase">
              Restaurante
            </div>
            <h1 className="text-2xl sm:text-[26px] md:text-[28px] font-extrabold tracking-tight text-neutral-900">
              {displayName}
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/92 px-3 py-1 text-xs font-medium text-neutral-800 shadow-sm ring-1 ring-black/5">
              <span className="inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500 shadow-[0_0_0_2px_rgba(16,185,129,.3)]" />
              <span>Servicio a la mesa</span>
            </div>

            <div className="inline-flex items-center gap-2 rounded-full bg-emerald-500 px-3 py-1 text-xs font-semibold text-white shadow-cta">
              <span className="uppercase tracking-wide text-[11px]">
                Mesa
              </span>
              <span>{mesaText}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
