// split.js
const API_BASE =
  import.meta.env.VITE_API_PEDIDOS ||
  import.meta.env.VITE_API_URL ||
  "http://localhost:4000";

function getCookie(name){const m=document.cookie.match(new RegExp("(^| )"+name+"=([^;]+)"));return m?decodeURIComponent(m[2]):null;}
async function ensureCsrf(){ if(!getCookie("csrf_token")) { try{ await fetch(`${API_BASE}/api/csrf`, {credentials:"include"}); }catch{} } }
function api(p){return `${API_BASE.replace(/\/+$/,"")}${p.startsWith("/")?p:`/${p}`}`;}
function withCsrf(h={}){const t=getCookie("csrf_token"); return t?{...h,"X-CSRF-Token":t}:h;}

// Helper genérico con parseo de error
async function postJson(path, body){
  const r = await fetch(api(path), {
    method:"POST",
    credentials:"include",
    headers: withCsrf({"Content-Type":"application/json"}),
    body: JSON.stringify(body || {})
  });
  const txt = await r.text();
  let data; try{ data = txt ? JSON.parse(txt) : null; } catch { data = { raw: txt }; }
  if(!r.ok){ const e = new Error(JSON.stringify(data || { error: txt || "Error" })); e.status=r.status; e.data=data; throw e; }
  return data;
}

export async function getSaldoPedido(pedidoId){
  const candidates = [
    `/api/split/pedidos/${pedidoId}/saldo`,
    `/api/pedidos/${pedidoId}/saldo`,
  ];
  for(const path of candidates){
    const r = await fetch(api(path), { credentials:"include" });
    if(r.ok) return r.json();
    if(r.status !== 404) throw new Error(await r.text());
  }
  throw new Error(JSON.stringify({ error:"No encontrado", hint:"¿La ruta es /api/pedidos/:id/saldo?" }));
}

export async function crearPagoEfectivoPendiente(pedidoId, amount){
  await ensureCsrf();
  const body = { amount: Number(amount), monto: Number(amount) };
  const candidates = [
    `/api/split/pedidos/${pedidoId}/pagos/efectivo`,
    `/api/pedidos/${pedidoId}/pagos/efectivo`,
  ];
  let lastErr=null;
  for(const path of candidates){
    try { return await postJson(path, body); }
    catch(e){ if(e.status===404){ lastErr=e; continue; } throw e; }
  }
  throw new Error(JSON.stringify({ error: lastErr?.data?.error || "No encontrado", hint:"Verifica la ruta para crear pago en efectivo (¿sin /split?)." }));
}

export async function aprobarPagoEfectivo(pedidoId, pagoId, pin){
  await ensureCsrf();
  const body = { pin };
  // cubrimos variantes comunes
  const candidates = [
    `/api/split/pedidos/${pedidoId}/pagos/${pagoId}/aprobar`,
    `/api/pedidos/${pedidoId}/pagos/${pagoId}/aprobar`,
    `/api/split/pedidos/${pedidoId}/pagos/efectivo/${pagoId}/aprobar`,
    `/api/pedidos/${pedidoId}/pagos/efectivo/${pagoId}/aprobar`,
    // por si el backend usa "approve" en inglés:
    `/api/split/pedidos/${pedidoId}/pagos/${pagoId}/approve`,
    `/api/pedidos/${pedidoId}/pagos/${pagoId}/approve`,
    `/api/split/pedidos/${pedidoId}/pagos/efectivo/${pagoId}/approve`,
    `/api/pedidos/${pedidoId}/pagos/efectivo/${pagoId}/approve`,
  ];
  let lastErr=null;
  for(const path of candidates){
    try { return await postJson(path, body); }
    catch(e){ if(e.status===404){ lastErr=e; continue; } throw e; }
  }
  throw new Error(JSON.stringify({ error: lastErr?.data?.error || "No encontrado", hint:"Verifica la ruta de aprobación (con/sin /efectivo y /split)." }));
}

export async function setCashPin(restaurantId, pin){
  await ensureCsrf();
  return postJson(`/api/split/restaurantes/${restaurantId}/cash-pin`, { pin });
}
