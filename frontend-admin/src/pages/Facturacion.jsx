// src/pages/Facturacion.jsx
import { useEffect, useMemo, useState } from "react";
import {
  Search,
  Filter,
  Calendar,
  Eye,
  Download,
  FileText,
} from "lucide-react";
import API from "../services/axiosInstance";

const FACT_API_BASE = (
  import.meta.env.VITE_FACT_API_URL || "http://localhost:5000"
).replace(/\/$/, "");

const PEN = new Intl.NumberFormat("es-PE", {
  style: "currency",
  currency: "PEN",
  minimumFractionDigits: 2,
});

const fmtMoney = (value, currency = "PEN") =>
  new Intl.NumberFormat("es-PE", {
    style: "currency",
    currency: currency || "PEN",
    minimumFractionDigits: 2,
  }).format(Number(value || 0));

const fmtDate = (value) =>
  value
    ? new Intl.DateTimeFormat("es-PE", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date(value))
    : "";

const tipoLabel = (tipo) => {
  switch (tipo) {
    case "01":
      return "Factura Electrónica";
    case "03":
      return "Boleta Electrónica";
    case "07":
      return "Nota de Crédito";
    case "08":
      return "Nota de Débito";
    default:
      return "Comprobante";
  }
};

const estadoBadgeClass = (estado = "") => {
  const e = estado.toUpperCase();
  if (e === "ACEPTADO" || e === "EMITIDA")
    return "bg-emerald-100 text-emerald-700 border-emerald-200";
  if (e === "OBSERVADO")
    return "bg-amber-100 text-amber-700 border-amber-200";
  if (e === "RECHAZADO" || e === "ANULADO")
    return "bg-rose-100 text-rose-700 border-rose-200";
  if (e === "ENVIADO" || e === "EN_RESUMEN")
    return "bg-sky-100 text-sky-700 border-sky-200";
  return "bg-zinc-100 text-zinc-600 border-zinc-200";
};

/** Construye la URL del endpoint PDF en backend-facturación */
const buildPdfUrl = (row) => {
  if (!row?.id) return null;
  return `${FACT_API_BASE}/api/admin/cpe/${row.id}/pdf`;
};

/** Pide el PDF con Axios (lleva Authorization) y devuelve un Blob */
const fetchCpePdfBlob = async (row) => {
  const url = buildPdfUrl(row);
  if (!url) throw new Error("Sin URL de PDF");

  const res = await API.get(url, {
    responseType: "blob",
  });

  return new Blob([res.data], { type: "application/pdf" });
};

const handleViewPdf = async (row) => {
  try {
    const blob = await fetchCpePdfBlob(row);
    const url = window.URL.createObjectURL(blob);
    window.open(url, "_blank", "noopener,noreferrer");
  } catch (e) {
    console.error("Error abriendo PDF:", e?.response?.data || e);
    alert("No se pudo abrir el PDF.");
  }
};

const handleDownloadPdf = async (row) => {
  try {
    const blob = await fetchCpePdfBlob(row);
    const url = window.URL.createObjectURL(blob);

    const filename = `${row.serie || "CPE"}-${String(
      row.correlativo || ""
    ).padStart(8, "0")}.pdf`;

    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  } catch (e) {
    console.error("Error descargando PDF:", e?.response?.data || e);
    alert("No se pudo descargar el PDF.");
  }
};

export default function Facturacion() {
  const [items, setItems] = useState([]);
  const [summary, setSummary] = useState({
    total: 0,
    totalAmount: 0,
    facturas: 0,
    boletas: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [tipo, setTipo] = useState("all"); // all | 01 | 03 | 07 | 08
  const [estado, setEstado] = useState("all"); // all | ACEPTADO | RECHAZADO...
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const fetchData = async () => {
    try {
      setLoading(true);
      setError("");

      const params = {
        q: search || undefined,
        tipo: tipo !== "all" ? tipo : undefined,
        estado: estado !== "all" ? estado : undefined,
        from: from || undefined,
        to: to || undefined,
      };

      const res = await API.get(
        `${FACT_API_BASE}/api/admin/cpe-documents`,
        { params }
      );

      setItems(res.data.items || []);
      setSummary(res.data.summary || {});
    } catch (e) {
      console.error("Error cargando facturación:", e?.response?.data || e);
      setError(
        e?.response?.data?.error ||
          e?.message ||
          "No se pudo cargar la facturación"
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const totalEmitted = summary?.total || 0;
  const totalAmount = summary?.totalAmount || 0;
  const totalFacturas = summary?.facturas || 0;
  const totalBoletas = summary?.boletas || 0;

  const hasFilters =
    search || from || to || tipo !== "all" || estado !== "all";

  const clearFilters = () => {
    setSearch("");
    setTipo("all");
    setEstado("all");
    setFrom("");
    setTo("");
    fetchData();
  };

  const handleSubmitFilters = (e) => {
    e.preventDefault();
    fetchData();
  };

  const rows = useMemo(() => items || [], [items]);

  return (
    <div className="relative mx-auto w-full max-w-7xl space-y-6 px-3 py-4 sm:px-4 md:px-6 md:py-6 lg:px-8">
      {/* Fondo claro */}
      <div className="pointer-events-none absolute inset-0 -z-10 bg-slate-50" />

      {/* Header */}
      <header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            <FileText className="h-7 w-7 text-sky-500" />
            <span>Facturación</span>
          </h1>
          <p className="mt-1 max-w-xl text-sm text-slate-500">
            Gestiona y visualiza todos los comprobantes electrónicos
            emitidos.
          </p>
        </div>
        <button
          type="button"
          onClick={fetchData}
          className="inline-flex w-full items-center justify-center rounded-lg bg-sky-600 px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-700 md:w-auto"
        >
          Actualizar
        </button>
      </header>

      {/* Cards resumen */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Total emitidos
          </p>
          <p className="mt-2 text-2xl font-bold text-slate-900 sm:text-3xl">
            {loading ? "…" : totalEmitted}
          </p>
          <p className="mt-1 text-xs text-slate-400">Comprobantes</p>
        </div>

        <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Monto total
          </p>
          <p className="mt-2 text-2xl font-bold text-slate-900 sm:text-3xl">
            {loading ? "…" : PEN.format(totalAmount)}
          </p>
          <p className="mt-1 text-xs text-slate-400">Ventas totales</p>
        </div>

        <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Facturas
          </p>
          <p className="mt-2 text-2xl font-bold text-slate-900 sm:text-3xl">
            {loading ? "…" : totalFacturas}
          </p>
          <p className="mt-1 text-xs text-slate-400">Electrónicas (01)</p>
        </div>

        <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Boletas
          </p>
          <p className="mt-2 text-2xl font-bold text-slate-900 sm:text-3xl">
            {loading ? "…" : totalBoletas}
          </p>
          <p className="mt-1 text-xs text-slate-400">Electrónicas (03)</p>
        </div>
      </section>

      {/* Filtros */}
      <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
        <form
          onSubmit={handleSubmitFilters}
          className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between"
        >
          {/* Buscador */}
          <div className="flex-1">
            <label className="text-xs font-medium text-slate-600">
              Buscar comprobante
            </label>
            <div className="relative mt-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Serie, correlativo o nombre del cliente…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-sky-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-sky-500"
              />
            </div>
          </div>

          {/* Otros filtros */}
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end lg:justify-end">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-2">
              <select
                value={tipo}
                onChange={(e) => setTipo(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-medium text-slate-700 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500 sm:w-auto"
              >
                <option value="all">Todos los tipos</option>
                <option value="01">Facturas</option>
                <option value="03">Boletas</option>
                <option value="07">Notas de crédito</option>
                <option value="08">Notas de débito</option>
              </select>

              <select
                value={estado}
                onChange={(e) => setEstado(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-medium text-slate-700 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500 sm:w-auto"
              >
                <option value="all">Todos los estados</option>
                <option value="ACEPTADO">Aceptado</option>
                <option value="ENVIADO">Enviado</option>
                <option value="EN_RESUMEN">En resumen</option>
                <option value="OBSERVADO">Observado</option>
                <option value="RECHAZADO">Rechazado</option>
                <option value="ANULADO">Anulado</option>
              </select>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-2">
              <div className="flex w-full flex-col rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 sm:inline-flex sm:w-auto sm:flex-row sm:items-center sm:gap-2">
                <div className="mb-1 flex items-center gap-1 sm:mb-0">
                  <Calendar className="h-3.5 w-3.5 text-slate-400" />
                  <span className="text-[11px] font-medium text-slate-600">
                    Fecha
                  </span>
                </div>
                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-2">
                  <input
                    type="date"
                    value={from}
                    onChange={(e) => setFrom(e.target.value)}
                    className="w-full rounded border px-2 py-1 text-xs focus:outline-none sm:w-auto"
                  />
                  <span className="hidden text-slate-300 sm:inline">—</span>
                  <input
                    type="date"
                    value={to}
                    onChange={(e) => setTo(e.target.value)}
                    className="w-full rounded border px-2 py-1 text-xs focus:outline-none sm:w-auto"
                  />
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  type="submit"
                  className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-slate-800 sm:flex-none"
                >
                  <Filter className="h-3.5 w-3.5" />
                  Aplicar
                </button>

                {hasFilters && (
                  <button
                    type="button"
                    onClick={clearFilters}
                    className="flex-1 text-xs font-medium text-slate-500 hover:text-slate-700 sm:flex-none"
                  >
                    Limpiar
                  </button>
                )}
              </div>
            </div>
          </div>
        </form>
      </section>

      {/* Tabla */}
      <section className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
        <div className="w-full overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-xs sm:text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  Tipo
                </th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  Serie - Correlativo
                </th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  Cliente
                </th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  Fecha
                </th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  Moneda
                </th>
                <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  Subtotal
                </th>
                <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  IGV
                </th>
                <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  Total
                </th>
                <th className="px-4 py-3 text-center text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  Estado
                </th>
                <th className="px-4 py-3 text-center text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {loading ? (
                <tr>
                  <td
                    colSpan={10}
                    className="px-4 py-10 text-center text-sm text-slate-500"
                  >
                    Cargando comprobantes…
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td
                    colSpan={10}
                    className="px-4 py-10 text-center text-sm text-rose-600"
                  >
                    {error}
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={10}
                    className="px-4 py-10 text-center text-sm text-slate-500"
                  >
                    No se encontraron comprobantes con los filtros
                    seleccionados.
                  </td>
                </tr>
              ) : (
                rows.map((row) => {
                  const client = row.client || {};
                  const clienteNombre =
                    client.razon_social ||
                    client.nombre ||
                    client.name ||
                    "Cliente general";
                  const clienteDoc =
                    client.num_doc || client.ruc || client.dni || "";

                  const serieCorrelativo = `${row.serie || ""}-${String(
                    row.correlativo || ""
                  ).padStart(8, "0")}`;

                  const hasPdf = !!buildPdfUrl(row);

                  return (
                    <tr key={row.id} className="hover:bg-slate-50/80">
                      <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                        <div className="flex flex-col">
                          <span className="font-medium">
                            {tipoLabel(row.tipo_doc)}
                          </span>
                          <span className="mt-0.5 text-[11px] text-slate-400">
                            SUNAT
                          </span>
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                        {serieCorrelativo}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col">
                          <span className="font-medium text-slate-800">
                            {clienteNombre}
                          </span>
                          {clienteDoc && (
                            <span className="text-[11px] text-slate-400">
                              Doc: {clienteDoc}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                        {fmtDate(row.fecha_emision)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                        <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-medium text-slate-700">
                          {row.moneda || "PEN"}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right text-slate-700">
                        {fmtMoney(row.subtotal, row.moneda)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right text-slate-700">
                        {fmtMoney(row.igv, row.moneda)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right font-semibold text-slate-900">
                        {fmtMoney(row.total, row.moneda)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-center">
                        <span
                          className={
                            "inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium " +
                            estadoBadgeClass(row.estado)
                          }
                        >
                          {row.estado || "—"}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-2">
                          {/* Ver PDF */}
                          <button
                            type="button"
                            disabled={!hasPdf}
                            onClick={() => handleViewPdf(row)}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 text-slate-500 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
                            title="Ver PDF"
                          >
                            <Eye className="h-4 w-4" />
                          </button>

                          {/* Descargar PDF */}
                          <button
                            type="button"
                            disabled={!hasPdf}
                            onClick={() => handleDownloadPdf(row)}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 text-slate-500 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
                            title="Descargar PDF"
                          >
                            <Download className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
