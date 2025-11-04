import React, { useMemo, useState } from "react";

const ChevronRight = (p) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" {...p}>
    <path d="M9 6l6 6-6 6" />
  </svg>
);

function resolveComboImg(absolute, combo, fallbackImg) {
  const candidates = [combo?.imagen_url, combo?.imagen, combo?.image_url, combo?.image, combo?.foto_url, combo?.foto].filter(Boolean);
  for (const u of candidates) {
    const s = String(u);
    if (/^(https?:)?\/\//i.test(s) || s.startsWith("data:")) return s;
    if (absolute) return absolute(s);
  }
  return fallbackImg || null;
}

export default function ComboCard({ combo, onChoose, absolute, fallbackImg, formatPEN }) {
  const title = combo?.nombre || "MENÚ";
  const imgUrl = useMemo(() => resolveComboImg(absolute, combo, fallbackImg), [absolute, combo, fallbackImg]);
  const price = (formatPEN && formatPEN(combo?.precio)) || `S/ ${Number(combo?.precio || 0).toFixed(2)}`;
  const [ok, setOk] = useState(true);

  return (
    <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/5">
      <div className="relative aspect-[16/9] w-full">
        {ok && imgUrl ? (
          <img
            src={imgUrl}
            alt={title}
            className="absolute inset-0 h-full w-full object-cover"
            loading="lazy"
            decoding="async"
            onError={() => setOk(false)}
          />
        ) : (
          <div
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(800px 320px at -10% -10%, rgba(255,255,255,.16) 0%, transparent 60%)," +
                "radial-gradient(600px 300px at 120% -15%, rgba(255,255,255,.12) 0%, transparent 55%)," +
                "linear-gradient(135deg,#059669 0%,#047857 50%,#0ea5e9 100%)",
            }}
          />
        )}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/0 via-black/10 to-black/25" />
        <div className="absolute right-2 top-2 rounded-full bg-emerald-600/95 px-2.5 py-1 text-[12px] font-semibold text-white shadow">
          {price}
        </div>
      </div>

      <button
        type="button"
        onClick={onChoose}
        className="flex w-full items-center justify-between rounded-2xl rounded-t-none bg-white px-4 py-3 text-left transition hover:bg-neutral-50"
      >
        <div>
          <div className="text-[15px] font-semibold text-neutral-900 uppercase">{title}</div>
          <div className="text-[12px] text-neutral-600">Elige 1 entrada + 1 fondo</div>
        </div>
        <ChevronRight className="h-5 w-5 text-neutral-400" />
      </button>
    </div>
  );
}
