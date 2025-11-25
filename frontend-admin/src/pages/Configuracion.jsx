// src/pages/Configuracion.jsx
import { useEffect, useState } from "react";
import API from "../services/axiosInstance";

const API_BASE =
  import.meta.env.VITE_API_PEDIDOS ||
  import.meta.env.VITE_API_URL ||
  "http://localhost:4000";

const isAbs = (u = "") =>
  /^https?:\/\//i.test(u) || u.startsWith("data:") || u.startsWith("blob:");
const toAbs = (u = "") =>
  isAbs(u) ? u : `${API_BASE}${u.startsWith("/") ? "" : "/"}${u}`;

export default function Configuracion() {
  const [config, setConfig] = useState({
    nombre: "",
    direccion: "",
    telefono: "",
    cover_url: "",
  });

  const [loading, setLoading] = useState(false);

  // archivo seleccionado y preview local
  const [coverFile, setCoverFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");

  useEffect(() => {
    fetchConfig();
  }, []);

  useEffect(() => {
    // limpieza de objectURL
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const fetchConfig = async () => {
    try {
      const res = await API.get("/restaurant");
      setConfig((prev) => ({ ...prev, ...res.data }));
    } catch (err) {
      console.warn(
        "No se pudo obtener configuración:",
        err.response?.data || err.message
      );
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) {
      setCoverFile(null);
      setPreviewUrl("");
      return;
    }

    // liberamos anterior URL (si existía)
    if (previewUrl) URL.revokeObjectURL(previewUrl);

    setCoverFile(file);
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      // 1) Guardar datos de texto
      await API.put("/restaurant", {
        nombre: config.nombre,
        direccion: config.direccion,
        telefono: config.telefono,
      });

      // 2) Si hay nueva imagen, subirla
      if (coverFile) {
        const fd = new FormData();
        fd.append("cover", coverFile);

        const res = await API.post("/restaurant/cover", fd, {
          headers: { "Content-Type": "multipart/form-data" },
        });

        setConfig((prev) => ({
          ...prev,
          cover_url: res.data.cover_url,
        }));
        setCoverFile(null);
        setPreviewUrl("");
      }

      alert("Configuración guardada");
    } catch (err) {
      console.error(
        "Error guardando configuración:",
        err.response?.data || err.message
      );
      alert("No se pudo guardar la configuración");
    } finally {
      setLoading(false);
    }
  };

  // Prioridad de previsualización:
  // 1) archivo nuevo local
  // 2) cover_url almacenado en el backend
  const finalPreview =
    previewUrl || (config.cover_url ? toAbs(config.cover_url) : "");

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-4">
        Configuración del restaurante
      </h2>

      <form className="space-y-3 max-w-lg" onSubmit={handleSave}>
        {/* NOMBRE */}
        <div>
          <label className="block text-sm font-medium mb-1">
            Nombre del restaurante
          </label>
          <input
            className="w-full border border-gray-300 p-2 rounded"
            placeholder="Nombre del restaurante"
            value={config.nombre || ""}
            onChange={(e) =>
              setConfig({ ...config, nombre: e.target.value })
            }
          />
        </div>

        {/* DIRECCIÓN */}
        <div>
          <label className="block text-sm font-medium mb-1">Dirección</label>
          <input
            className="w-full border border-gray-300 p-2 rounded"
            placeholder="Dirección"
            value={config.direccion || ""}
            onChange={(e) =>
              setConfig({ ...config, direccion: e.target.value })
            }
          />
        </div>

        {/* TELÉFONO */}
        <div>
          <label className="block text-sm font-medium mb-1">Teléfono</label>
          <input
            className="w-full border border-gray-300 p-2 rounded"
            placeholder="Teléfono"
            value={config.telefono || ""}
            onChange={(e) =>
              setConfig({ ...config, telefono: e.target.value })
            }
          />
        </div>

        {/* IMAGEN DE PORTADA */}
        <div>
          <label className="block text-sm font-medium mb-1">
            Imagen de portada (header)
          </label>

          <input
            type="file"
            accept="image/*"
            className="w-full border p-2 rounded"
            onChange={handleFileChange}
          />

          <p className="mt-1 text-xs text-gray-500">
            Sube cualquier imagen (JPG, PNG, etc.). El backend la convertirá a
            WEBP automáticamente.
          </p>

          {finalPreview && (
            <div className="mt-3">
              <div className="text-xs text-gray-500 mb-1">
                Previsualización:
              </div>
              <img
                src={finalPreview}
                alt="Portada"
                className="h-28 w-full max-w-xs rounded-xl object-cover border border-gray-200"
              />
            </div>
          )}
        </div>

        {/* BOTÓN GUARDAR */}
        <button
          className="bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-60"
          disabled={loading}
        >
          {loading ? "Guardando..." : "Guardar"}
        </button>
      </form>
    </div>
  );
}
