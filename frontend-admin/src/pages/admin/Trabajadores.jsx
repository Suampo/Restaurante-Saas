// src/pages/admin/Trabajadores.jsx
import { useEffect, useMemo, useState } from "react";
import { listarMovimientosEfectivo } from "../../services/cashApi";
import {
  Users,
  RefreshCw,
  CalendarDays,
  ChevronRight,
  ChevronLeft,
  Loader2,
} from "lucide-react";

const PEN = new Intl.NumberFormat("es-PE", {
  style: "currency",
  currency: "PEN",
  minimumFractionDigits: 2,
});

const toYMD = (d) => {
  const dt = d instanceof Date ? d : new Date(d);
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, "0");
  const day = String(dt.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};
const isYMD = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s || "");
const toEs = (d) =>
  new Date(d).toLocaleDateString("es-PE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
const toEsDateTime = (d) => (d ? new Date(d).toLocaleString("es-PE") : "-");

export default function Trabajadores() {
  const today = new Date();
  const sevenAgo = new Date();
  sevenAgo.setDate(today.getDate() - 6);

  const [startYMD, setStartYMD] = useState(toYMD(sevenAgo));
  const [endYMD, setEndYMD] = useState(toYMD(today));

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const [summary, setSummary] = useState({
    workers: 0,
    movements: 0,
    total: 0,
  });
  const [byWorker, setByWorker] = useState([]);
  const [rangeText, setRangeText] = useState("");

  const [selUser, setSelUser] = useState(null);
  const [loadingUser, setLoadingUser] = useState(false);
  const [movsUser, setMovsUser] = useState([]);

  const fetchUserDetails = async (user) => {
    try {
      setErr("");
      setLoadingUser(true);
      // backend acepta uuid o email en userId
      const data = await listarMovimientosEfectivo({
        start: startYMD,
        end: endYMD,
        estado: "approved",
        userId: user.email,
      });
      setMovsUser(Array.isArray(data?.rows) ? data.rows : []);
    } catch (e) {
      setMovsUser([]);
      setErr(
        e?.response?.data?.error ||
          e.message ||
          "Error cargando detalle"
      );
    } finally {
      setLoadingUser(false);
    }
  };

  const fetchAll = async () => {
    try {
      setErr("");
      setLoading(true);
      setMovsUser([]);

      if (!isYMD(startYMD) || !isYMD(endYMD)) {
        throw new Error("Rango de fechas inválido");
      }

      const data = await listarMovimientosEfectivo({
        start: startYMD,
        end: endYMD,
      });

      setSummary({
        workers: Number(data?.summary?.workers || 0),
        movements: Number(data?.summary?.movements || 0),
        total: Number(data?.summary?.total || 0),
      });

      setByWorker(Array.isArray(data?.byWorker) ? data.byWorker : []);

      const startDisp = data?.range?.start
        ? toEs(data.range.start)
        : startYMD;
      let endDisp = endYMD;
      if (data?.range?.end) {
        const endIso = new Date(data.range.end);
        endIso.setUTCDate(endIso.getUTCDate() - 1); // [start, end)
        endDisp = toEs(endIso);
      }
      setRangeText(`Rango: ${startDisp} a ${endDisp}`);

      if (selUser?.email) await fetchUserDetails(selUser);
    } catch (e) {
      setSummary({ workers: 0, movements: 0, total: 0 });
      setByWorker([]);
      setSelUser(null);
      setErr(
        e?.response?.data?.error ||
          e.message ||
          "Error al cargar"
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
    // eslint-disable-next-line
  }, []);

  const totalGlobal = useMemo(
    () => byWorker.reduce((s, r) => s + Number(r.total || 0), 0),
    [byWorker]
  );

  return (
    <div className="mx-auto w-full max-w-7xl px-3 py-4 sm:px-4 md:px-6 md:py-6">
      {/* Header + filtros */}
      <div className="mb-4 space-y-3 md:flex md:items-center md:justify-between md:space-y-0">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-600 text-white shadow">
            <Users size={18} />
          </div>
          <h1 className="text-xl font-semibold sm:text-2xl">
            Trabajadores
          </h1>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
          {/* Selector de rango de fechas responsive */}
          <div className="flex w-full flex-col gap-2 rounded-xl border bg-white px-3 py-2 text-xs shadow-sm sm:inline-flex sm:w-auto sm:flex-row sm:items-center sm:gap-2 sm:text-sm">
            <div className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-zinc-500" />
              <span className="font-medium text-[11px] text-zinc-600 sm:text-xs">
                Rango
              </span>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-2">
              <input
                type="date"
                value={startYMD}
                onChange={(e) => setStartYMD(e.target.value)}
                className="w-full rounded border px-2 py-1 text-xs sm:w-auto sm:text-sm"
              />
              <span className="hidden text-zinc-400 sm:inline">—</span>
              <input
                type="date"
                value={endYMD}
                onChange={(e) => setEndYMD(e.target.value)}
                className="w-full rounded border px-2 py-1 text-xs sm:w-auto sm:text-sm"
              />
            </div>
          </div>

          <button
            onClick={fetchAll}
            disabled={loading}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow hover:bg-emerald-700 disabled:opacity-60 sm:w-auto"
          >
            <RefreshCw
              className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
            />
            {loading ? "Actualizando…" : "Actualizar"}
          </button>
        </div>
      </div>

      {/* Error */}
      {err && (
        <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {err}
        </div>
      )}

      {/* KPIs */}
      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <div className="text-xs text-zinc-500">
            Trabajadores con movimientos
          </div>
          <div className="mt-1 text-2xl font-semibold">
            {summary.workers}
          </div>
        </div>
        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <div className="text-xs text-zinc-500">
            Movimientos (aprobaciones)
          </div>
          <div className="mt-1 text-2xl font-semibold">
            {summary.movements}
          </div>
        </div>
        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <div className="text-xs text-zinc-500">Total cobrado</div>
          <div className="mt-1 text-2xl font-semibold">
            {PEN.format(summary.total)}
          </div>
        </div>
      </div>

      <div className="mb-3 text-xs text-zinc-500">{rangeText}</div>

      {/* Tablas */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:items-start">
        {/* Izquierda: resumen por trabajador */}
        <div className="min-w-0 rounded-2xl border bg-white shadow-sm">
          <div className="flex flex-col gap-2 border-b px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="font-medium">Actividad por trabajador</div>
            <div className="text-xs text-zinc-500">
              Total en tabla: <b>{PEN.format(totalGlobal)}</b>
            </div>
          </div>

          <div className="w-full overflow-x-auto">
            <table className="min-w-full text-xs sm:text-sm">
              <thead>
                <tr className="bg-zinc-50 text-zinc-600">
                  <th className="px-4 py-2 text-left">Trabajador</th>
                  <th className="px-4 py-2 text-right">
                    Aprobaciones
                  </th>
                  <th className="px-4 py-2 text-right">
                    Total cobrado
                  </th>
                  <th className="px-4 py-2 text-right">Última</th>
                  <th className="px-2 py-2 text-right" />
                </tr>
              </thead>
              <tbody>
                {byWorker.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-4 py-6 text-center text-zinc-500"
                    >
                      Sin movimientos en el rango.
                    </td>
                  </tr>
                ) : (
                  byWorker.map((r, idx) => (
                    <tr
                      key={(r.user_id || r.email || idx).toString()}
                      className="border-t hover:bg-zinc-50"
                    >
                      <td className="px-4 py-2">
                        <div className="font-medium text-zinc-900 break-words">
                          {r.name || r.email || "(desconocido)"}
                        </div>
                        <div className="text-[11px] text-zinc-500 break-all">
                          {r.email || "(sin email)"}
                        </div>
                      </td>
                      <td className="px-4 py-2 text-right">
                        {r.aprobaciones ?? r.count ?? 0}
                      </td>
                      <td className="px-4 py-2 text-right">
                        {PEN.format(Number(r.total || 0))}
                      </td>
                      <td className="px-4 py-2 text-right">
                        {toEsDateTime(r.last)}
                      </td>
                      <td className="px-2 py-2 text-right">
                        <button
                          className="inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-xs hover:bg-zinc-50"
                          onClick={() => {
                            const user = {
                              userId: r.user_id || null,
                              email: r.email || "",
                              name:
                                r.name ||
                                r.email ||
                                "(desconocido)",
                            };
                            setSelUser(user);
                            fetchUserDetails(user);
                          }}
                          title="Ver detalle"
                        >
                          Ver detalle{" "}
                          <ChevronRight className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Derecha: detalle del trabajador */}
        <div className="min-w-0 rounded-2xl border bg-white shadow-sm">
          <div className="flex flex-wrap items-center gap-2 border-b px-4 py-3">
            <button
              onClick={() => {
                setSelUser(null);
                setMovsUser([]);
              }}
              className="rounded border p-1.5 hover:bg-zinc-50 disabled:opacity-50"
              disabled={!selUser}
              title="Volver"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>

            <div className="flex min-w-0 flex-1 flex-col">
              <div className="text-sm font-medium">
                {selUser
                  ? `Detalle de: ${
                      selUser.name || selUser.email
                    }`
                  : "Selecciona un trabajador"}
              </div>
              {selUser && (
                <div className="text-[11px] text-zinc-500 break-all">
                  {selUser.email}
                </div>
              )}
            </div>

            {selUser?.userId && (
              <div className="max-w-[45%] truncate text-[11px] text-zinc-500">
                {selUser.userId}
              </div>
            )}
          </div>

          {!selUser ? (
            <div className="p-4 text-sm text-zinc-500">
              Elige un trabajador de la tabla{" "}
              <span className="inline md:hidden">de arriba</span>
              <span className="hidden md:inline">
                de la izquierda
              </span>{" "}
              para ver sus movimientos.
            </div>
          ) : loadingUser ? (
            <div className="flex items-center gap-2 p-4 text-sm text-zinc-600">
              <Loader2 className="h-4 w-4 animate-spin" /> Cargando
              detalle…
            </div>
          ) : movsUser.length === 0 ? (
            <div className="p-4 text-sm text-zinc-500">
              Sin movimientos para el rango seleccionado.
            </div>
          ) : (
            <div className="w-full overflow-x-auto">
              <table className="min-w-full text-xs sm:text-sm">
                <thead>
                  <tr className="bg-zinc-50 text-zinc-600">
                    <th className="px-4 py-2 text-left">
                      Fecha/Hora
                    </th>
                    <th className="px-4 py-2 text-right">Monto</th>
                    <th className="px-4 py-2 text-left">Pedido</th>
                    <th className="px-4 py-2 text-left">Nota</th>
                  </tr>
                </thead>
                <tbody>
                  {movsUser.map((m, i) => (
                    <tr key={m.id ?? i} className="border-t">
                      <td className="px-4 py-2">
                        {toEsDateTime(
                          m.approved_at ||
                            m.created_at ||
                            m.createdAt
                        )}
                      </td>
                      <td className="px-4 py-2 text-right">
                        {PEN.format(
                          Number(m.monto ?? m.amount ?? 0)
                        )}
                      </td>
                      <td className="px-4 py-2">
                        {m.pedido_numero ??
                          m.pedido_order_no ??
                          m.pedido_id ??
                          m.pedidoId ??
                          "-"}
                      </td>
                      <td className="px-4 py-2 break-words">
                        {m.cash_note || m.note || (
                          <span className="text-zinc-400">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
