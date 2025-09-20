import API from "./axiosInstance";

// Listar (acepta { restaurantId, fresh })
export const getCategories = (opts = {}) => {
  const params = {};
  if (opts.restaurantId) params.restaurantId = opts.restaurantId;
  // 👇 cache-buster opcional para pedir “fresh”
  if (opts.fresh) params._ = Date.now();
  return API.get("/categorias", { params }).then((r) => r.data);
};

// Crear
export const createCategory = (nombre, restaurantId) =>
  API.post("/categorias", restaurantId ? { nombre, restaurantId } : { nombre })
     .then((r) => r.data);

// Renombrar
export const updateCategory = (id, nombre) =>
  API.put(`/categorias/${id}`, { nombre }).then((r) => r.data);

// Eliminar
export const deleteCategory = (id) =>
  API.delete(`/categorias/${id}`).then((r) => r.data);

// Subir portada (NO fijes Content-Type; deja que el browser ponga el boundary)
export const uploadCategoryCover = async (id, file, field = "image") => {
  const fd = new FormData();
  fd.append(field, file);
  const { data } = await API.put(`/categorias/${id}/cover`, fd);
  return data;
};
