// src/services/takeawayApi.js
import API from "./axiosInstance";

export const ensureTakeaway = async () =>
  (await API.post("/takeaway/ensure")).data;

export const getTakeawayInfo = async () =>
  (await API.get("/takeaway/info")).data;     // { mesaId, codigo }

export const getTakeawayQR = async () =>
  (await API.get("/takeaway/qr")).data;       // { ok, url, png, mesaId }
