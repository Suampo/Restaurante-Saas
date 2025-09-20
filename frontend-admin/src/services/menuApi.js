// src/services/menuApi.js
import api from "./axiosInstance";

/** Lista de items (admin) -> devuelve siempre array */
export async function getMenuItems(params = {}) {
  const { data } = await api.get("/menu-items", { params });
  return Array.isArray(data) ? data : data?.data ?? [];
}

/** Crear item */
export async function createMenuItem({ nombre, precio, descripcion, categoriaId }) {
  const { data } = await api.post("/menu-items", {
    nombre,
    precio,
    descripcion,
    categoria_id: categoriaId ?? null,
  });
  return data;
}

/** Actualizar item */
export async function updateMenuItem(id, payload) {
  const { data } = await api.put(`/menu-items/${id}`, payload);
  return data;
}

/** Eliminar item */
export async function deleteMenuItemApi(id) {
  const { data } = await api.delete(`/menu-items/${id}`);
  return data;
}

/** Subir imagen (campo 'image' por defecto) */
export async function uploadMenuItemImage(id, file, fieldName = "image") {
  const fd = new FormData();
  fd.append(fieldName, file);
  const { data } = await api.post(`/menu-item/${id}/upload-image`, fd);
  return data;
}
