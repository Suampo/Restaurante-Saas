import API from "./axiosInstance";

export const getCombos = async () =>
  (await API.get("/combos")).data;

export const createCombo = async (payload) =>
  (await API.post("/combos", payload)).data;

export const updateCombo = async (id, payload) =>
  (await API.put(`/combos/${id}`, payload)).data;

export const deleteCombo = async (id) => {
  try {
    return (await API.delete(`/combos/${id}`)).data;
  } catch (e) {
    // fallback si tu backend soft-deleta con PUT activo:false
    if (e?.response?.status === 405 || e?.response?.status === 404) {
      return (await API.put(`/combos/${id}`, { activo: false })).data;
    }
    throw e;
  }
};

// Subir portada combo (sin forzar Content-Type)
export const uploadComboCover = async (id, file, field = "image") => {
  const fd = new FormData();
  fd.append(field, file);
  const { data } = await API.put(`/combos/${id}/cover`, fd);
  return data;
};
