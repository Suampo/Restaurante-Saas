import API from "./axiosInstance";

// listado, alta, rename y portada quedan igual…

export const getCategories    = async () => (await API.get("/categorias")).data;
export const createCategory   = async (nombre) => (await API.post("/categorias", { nombre })).data;
export const updateCategory   = async (id, nombre) => (await API.put(`/categorias/${id}`, { nombre })).data;
export const uploadCategoryCover = async (id, file, field = "image") => {
  const fd = new FormData();
  fd.append(field, file);
  return (await API.put(`/categorias/${id}/cover`, fd)).data;
};

// ⬇️ ahora admite borrado forzado con ?force=1
export const deleteCategory = async (id, opts = {}) =>
  (await API.delete(`/categorias/${id}`, { params: { force: opts.force ? 1 : 0 } })).data;