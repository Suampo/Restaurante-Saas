// src/services/inventarioApi.js
import API from "./axiosInstance";
import { withCache, clearCache } from "../utils/cached";

const K = {
  UNIDADES: "inv:unidades",
  ALMACENES: "inv:almacenes",
};

export const inv = {
  /* ========== STOCK ========== */
  async stock(onlyLow = false) {
    const { data } = await API.get("/inventario/stock", {
      params: { low: onlyLow ? 1 : 0 },
    });
    return Array.isArray(data) ? data : [];
  },

  /* ========== INSUMOS ========== */
  async insumos() {
    const { data } = await API.get("/inventario/insumos");
    return Array.isArray(data) ? data : [];
  },

  async crear(p) {
    const { data } = await API.post("/inventario/insumos", p);
    // no invalido nada aquí; stock y alertas ya se recargan cuando hagas movimientos
    return data;
  },

  async unidades() {
    // cache 60s (evita llamadas repetidas al cambiar de pestaña)
    return withCache(K.UNIDADES, 60_000, async () => {
      const { data } = await API.get("/inventario/unidades");
      return Array.isArray(data) ? data : [];
    });
  },

  /* ========== MOVIMIENTOS ========== */
  async movimientos() {
    const { data } = await API.get("/inventario/movimientos");
    return Array.isArray(data) ? data : [];
  },

  async crearMov(p) {
    // p: { insumo_id, almacen_id, tipo:"in"|"out", cantidad, costo_unit?, origen? }
    const { data } = await API.post("/inventario/movimientos", p);
    return data;
  },

  /* ========== ALMACENES ========== */
  async almacenes() {
    // cache 60s
    return withCache(K.ALMACENES, 60_000, async () => {
      const { data } = await API.get("/inventario/almacenes");
      return Array.isArray(data) ? data : [];
    });
  },

  async crearAlmacen(nombre) {
    const { data } = await API.post("/inventario/almacenes", { nombre });
    clearCache(K.ALMACENES);
    return data;
  },

  async renombrarAlmacen(id, nombre) {
    const { data } = await API.put(`/inventario/almacenes/${id}`, { nombre });
    clearCache(K.ALMACENES);
    return data;
  },

  async eliminarAlmacen(id) {
    const { data } = await API.delete(`/inventario/almacenes/${id}`);
    clearCache(K.ALMACENES);
    return data;
  },
};
