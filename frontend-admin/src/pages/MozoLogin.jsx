import { useState } from "react";
import API from "../services/axiosInstance";
import { useNavigate } from "react-router-dom";
import { setAuthIdentity } from "../services/cashApi"; // 👈 importa este helper

export default function MozoLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const nav = useNavigate();

  const onSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await API.post("/auth/login", { email, password });

      if (!data?.token) return alert("Login inválido");

      // Token (compat)
      localStorage.setItem("token", data.token);
      localStorage.setItem("access_token", data.token);
      sessionStorage.setItem("token", data.token);
      sessionStorage.setItem("access_token", data.token);

      // Rol + trazabilidad
      const role = data?.user?.rol || data?.user?.role || "waiter";
      const userEmail = data?.user?.email || email;
      const userId = data?.user?.id; // uuid si usas Supabase/tu backend
      const restaurantId = data?.user?.restaurant_id ?? data?.user?.restaurantId ?? null;

      // Guarda identidad unificada para interceptores/guard
      setAuthIdentity({ email: userEmail, id: userId, role, restaurantId });

      // (compatibilidad con otras partes que leen "role")
      localStorage.setItem("role", role);
      sessionStorage.setItem("role", role);

      nav("/mozo/cobro-efectivo", { replace: true });
    } catch (e) {
      alert(e?.response?.data?.error || e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid place-items-center bg-gray-100">
      <form onSubmit={onSubmit} className="w-full max-w-sm bg-white p-6 rounded shadow">
        <h1 className="text-xl font-bold mb-4">Ingreso de Mozo</h1>

        <label className="block text-sm mb-1">Email</label>
        <input
          className="w-full border rounded px-3 py-2 mb-3"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <label className="block text-sm mb-1">Contraseña</label>
        <input
          type="password"
          className="w-full border rounded px-3 py-2 mb-4"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <button disabled={loading} className="w-full rounded bg-green-600 text-white py-2 disabled:opacity-50">
          {loading ? "Ingresando..." : "Ingresar"}
        </button>
      </form>
    </div>
  );
}
