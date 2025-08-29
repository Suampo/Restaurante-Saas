// src/services/combosApi.js
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
    if (e?.response?.status === 405 || e?.response?.status === 404) {
      return (await API.put(`/combos/${id}`, { activo: false })).data;
    }
    throw e;
  }
};

// NUEVO: subir portada de combo
export const uploadComboCover = (id, file) => {
  const form = new FormData();
  form.append("image", file);
  return API.put(`/combos/${id}/cover`, form, {
    headers: { "Content-Type": "multipart/form-data" },
  }).then((r) => r.data);
};

