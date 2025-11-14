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
    // Fallback por si el backend usa PUT activo:false
    if (e?.response?.status === 405 || e?.response?.status === 404) {
      return (await API.put(`/combos/${id}`, { activo: false })).data;
    }
    throw e;
  }
};

// Subir portada combo
export const uploadComboCover = async (id, file, field = "image") => {
  const fd = new FormData();
  fd.append(field, file);
  return (await API.put(`/combos/${id}/cover`, fd)).data;
};

// V2 (N grupos)
export const createComboV2  = async (payload) => (await API.post("/combos/v2", payload)).data;
export const updateComboV2  = async (id, payload) => (await API.put(`/combos/v2/${id}`, payload)).data;
