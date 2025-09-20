// backend-pasarela/src/utils/http.js
import axios from "axios";

export const culqi = axios.create({
  baseURL: "https://api.culqi.com/v2",
  headers: { "Content-Type": "application/json" }
});

export function authHeaders(secretKey, idemp) {
  return {
    headers: {
      Authorization: `Bearer ${secretKey}`,
      ...(idemp ? { "Idempotency-Key": idemp } : {})
    },
    timeout: 20000
  };
}
