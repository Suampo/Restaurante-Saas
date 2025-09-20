// src/services/safeJson.js
export async function safeJsonFetch(input, init) {
  const res = await fetch(input, init);
  const text = await res.text(); // siempre leemos el texto para poder diagnosticar
  const url = typeof input === "string" ? input : (input?.url || "(request)"); 
  if (!res.ok) {
    const snippet = text.slice(0, 200).replace(/\s+/g, " ").trim();
    throw new Error(`HTTP ${res.status} ${res.statusText} en ${url} → ${snippet}`);
  }
  try {
    return JSON.parse(text);
  } catch {
    const snippet = text.slice(0, 200).replace(/\s+/g, " ").trim();
    throw new Error(`Respuesta no JSON desde ${url} → ${snippet}`);
  }
}
