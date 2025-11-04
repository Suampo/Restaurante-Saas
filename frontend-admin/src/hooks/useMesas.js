// src/hooks/useMesas.js
import { useEffect, useMemo, useState } from "react";
import { getMesas, createMesa, deleteMesa, getMesaQR } from "../services/mesasApi";

function useMesas() {
  const [mesas, setMesas] = useState([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(false);

  // Mapas para QR
  const [qrData, setQrData] = useState({}); // { [mesaId]: dataUrlPng }
  const [qrLink, setQrLink] = useState({}); // { [mesaId]: url }

  const load = async () => {
    setLoading(true);
    try {
      const data = await getMesas();
      setMesas(Array.isArray(data) ? data : []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const q = (query || "").trim().toLowerCase();
    if (!q) return mesas;
    return mesas.filter(
      (m) =>
        String(m.codigo || "").toLowerCase().includes(q) ||
        String(m.descripcion || "").toLowerCase().includes(q)
    );
  }, [mesas, query]);

  const addMesa = async ({ codigo, descripcion }) => {
    const cod = (codigo || "").trim();
    if (!cod) {
      alert("Ingresa un código para la mesa");
      return;
    }
    setAdding(true);
    try {
      await createMesa({ codigo: cod, descripcion: descripcion || "" });
      await load();
    } catch (e) {
      console.error("❌ createMesa:", e?.response?.data || e.message);
      alert(e?.response?.data?.error || "Error creando mesa");
    } finally {
      setAdding(false);
    }
  };

  const removeMesa = async (id) => {
    await deleteMesa(id);
    setQrData((prev) => { const c = { ...prev }; delete c[id]; return c; });
    setQrLink((prev) => { const c = { ...prev }; delete c[id]; return c; });
    await load();
  };

  // === QR ===
  const generarQR = async (mesaId) => {
    const data = await getMesaQR(mesaId);      // { ok, url, png }
    setQrData((m) => ({ ...m, [mesaId]: data.png }));
    setQrLink((m) => ({ ...m, [mesaId]: data.url }));
  };

  const copiarQR = async (mesaId) => {
    const link = qrLink[mesaId];
    if (!link) return;
    await navigator.clipboard.writeText(link);
  };

  return {
    mesas,
    filtered,
    loading,
    query, setQuery,
    adding, addMesa,
    removeMesa,
    qrData, generarQR, copiarQR,
  };
}

export default useMesas;
export { useMesas };
