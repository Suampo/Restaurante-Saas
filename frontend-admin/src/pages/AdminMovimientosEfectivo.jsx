import { useEffect, useState } from "react";
import { listarMovimientosEfectivo } from "../services/cashApi";

const PEN = new Intl.NumberFormat("es-PE", {
  style: "currency",
  currency: "PEN",
  minimumFractionDigits: 2,
});
const toDateInputValue = (d) => {
  const off = d.getTimezoneOffset();
  const local = new Date(d.getTime() - off * 60 * 1000);
  return local.toISOString().slice(0, 10);
};

function AdminMovimientosEfectivo() {
  const [start, setStart] = useState(toDateInputValue(new Date()));
  const [end, setEnd] = useState(toDateInputValue(new Date()));
  const [estado, setEstado] = useState("all"); // approved|pending|all
  const [userId, setUserId] = useState("");    // opcional filtrar por mozo
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState([]);
  const [stats, setStats] = useState({ totalEfectivo: 0 });

  const fetchRows = async () => {
    setLoading(true);
    try {
      const data = await listarMovimientosEfectivo({
        start,
        end,
        estado: estado || "all",
        userId: userId || undefined,
      });
      setRows(data.rows || []);
      setStats(data.stats || { totalEfectivo: 0 });
    } catch (e) {
      alert(e?.response?.data?.error || e.message);
      setRows([]);
      setStats({ totalEfectivo: 0 });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRows();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="p-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Movimientos de efectivo</h1>
          <p className="text-sm text-zinc-500">Control diario, por mozo y estado</p>
        </div>
        <div className="text-right">
          <div className="text-xs text-zinc-500">Total efectivo (aprobado)</div>
          <div className="text-xl font-bold">{PEN.format(stats.totalEfectivo || 0)}</div>
        </div>
      </div>

      <div className="mb-3 grid gap-2 sm:grid-cols-2 md:grid-cols-4">
        <div>
          <label className="mb-1 block text-sm">Desde</label>
          <input
            type="date"
            className="w-full rounded border px-3 py-2"
            value={start}
            onChange={(e) => setStart(e.target.value)}
          />
        </div>
        <div>
          <label className="mb-1 block text-sm">Hasta</label>
          <input
            type="date"
            className="w-full rounded border px-3 py-2"
            value={end}
            onChange={(e) => setEnd(e.target.value)}
          />
        </div>
        <div>
          <label className="mb-1 block text-sm">Estado</label>
          <select
            className="w-full rounded border px-3 py-2"
            value={estado}
            onChange={(e) => setEstado(e.target.value)}
          >
            <option value="all">Todos</option>
            <option value="approved">Aprobado</option>
            <option value="pending">Pendiente</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm">Mozo (userId, opcional)</label>
          <input
            className="w-full rounded border px-3 py-2"
            placeholder="uuid"
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
          />
        </div>
      </div>

      <div className="mb-3 flex gap-2">
        <button
          onClick={fetchRows}
          disabled={loading}
          className="rounded bg-green-600 px-4 py-2 text-white disabled:opacity-50"
        >
          {loading ? "Cargando..." : "Actualizar"}
        </button>
      </div>

      <div className="overflow-auto rounded border">
        <table className="min-w-full text-sm">
          <thead className="bg-zinc-50">
            <tr>
              <th className="px-3 py-2 text-left">Pedido</th>
              <th className="px-3 py-2 text-left">Monto efectivo</th>
              <th className="px-3 py-2 text-left">Recibido</th>
              <th className="px-3 py-2 text-left">Vuelto</th>
              <th className="px-3 py-2 text-left">Estado</th>
              <th className="px-3 py-2 text-left">Aprobado por</th>
              <th className="px-3 py-2 text-left">Fecha/Hora</th>
              <th className="px-3 py-2 text-left">Observación</th>
            </tr>
          </thead>
          <tbody>
            {(rows || []).map((r) => (
              <tr key={r.id} className="border-t">
                <td className="px-3 py-2">#{r.pedido_id}</td>
                <td className="px-3 py-2">{PEN.format(r.monto || 0)}</td>
                <td className="px-3 py-2">
                  {r.cash_received != null ? PEN.format(r.cash_received) : "-"}
                </td>
                <td className="px-3 py-2">{PEN.format(r.cash_change || 0)}</td>
                <td className="px-3 py-2">{String(r.estado || "").toUpperCase()}</td>
                <td className="px-3 py-2">
                  {r.approved_by_user_id ? r.approved_by_user_id : r.approved_by || "-"}
                </td>
                <td className="px-3 py-2">
                  {r.approved_at
                    ? new Date(r.approved_at).toLocaleString()
                    : new Date(r.created_at).toLocaleString()}
                </td>
                <td className="px-3 py-2">{r.cash_note || "-"}</td>
              </tr>
            ))}
            {(!rows || rows.length === 0) && (
              <tr>
                <td className="px-3 py-4 text-center text-zinc-500" colSpan={8}>
                  Sin resultados
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default AdminMovimientosEfectivo;
