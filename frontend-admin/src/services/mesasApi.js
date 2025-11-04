// src/services/mesasApi.js
import API from "./axiosInstance";

export const getMesas = async () =>
  (await API.get("/mesas")).data;

export const createMesa = async (payload) =>
  (await API.post("/mesas", payload)).data;

export const deleteMesa = async (id) =>
  (await API.delete(`/mesas/${id}`)).data;

export const getMesaQR = async (id) =>
  (await API.get(`/mesas/${id}/qr`)).data; // { ok, url, png }
