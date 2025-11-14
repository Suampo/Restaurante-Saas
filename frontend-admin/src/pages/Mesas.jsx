// src/pages/Mesas.jsx
import useMesas from "../hooks/useMesas.js";
import MesasHeader from "../components/MesasHeader";
import MesaCard from "../components/MesaCard";
import TakeawayCard from "../components/TakeawayCard";

export default function Mesas() {
  const {
    filtered, loading, query, setQuery,
    adding, addMesa, removeMesa,
    qrData, generarQR, copiarQR,
  } = useMesas();

  // Ocultamos la mesa LLEVAR del grid normal (tiene su tarjeta especial arriba)
  const mesasNormales = (filtered || []).filter(
    (m) => String(m?.codigo || "").toUpperCase() !== "LLEVAR"
  );

  return (
    <div className="mx-auto w-full max-w-7xl space-y-5">
      <MesasHeader
        onAdd={addMesa}
        adding={adding}
        query={query}
        setQuery={setQuery}
      />

      {/* QR especial para pedidos para llevar */}
      <TakeawayCard />

      {loading ? (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="h-5 w-32 animate-pulse rounded bg-slate-200" />
              <div className="mt-2 h-4 w-48 animate-pulse rounded bg-slate-200" />
              <div className="mt-4 h-8 w-28 animate-pulse rounded bg-slate-200" />
            </div>
          ))}
        </div>
      ) : mesasNormales.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <p className="text-slate-600">
            No hay mesas. Crea una con el formulario de arriba.
          </p>
        </div>
      ) : (
        <div className="grid auto-rows-min grid-cols-1 items-start gap-5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {mesasNormales.map((m) => (
            <MesaCard
              key={m.id}
              mesa={m}
              qr={qrData[m.id]}
              onGenerate={generarQR}
              onDelete={(id) => { if (confirm("¿Eliminar mesa?")) removeMesa(id); }}
              onCopy={async (id) => { await copiarQR(id); alert("Link copiado"); }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
