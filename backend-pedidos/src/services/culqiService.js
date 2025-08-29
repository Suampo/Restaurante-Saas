import fetch from "node-fetch";

const BASE = "https://api.culqi.com/v2";

function resolveSecretKey(overrideSecret) {
  const k = overrideSecret || process.env.CULQI_SECRET_KEY || process.env.CULQI_SECRET;
  if (!k) throw new Error("Falta CULQI_SECRET_KEY (o overrideSecret)");
  return k;
}

function headers(secretKey) {
  return {
    "Content-Type": "application/json",
    Accept: "application/json",
    Authorization: `Bearer ${secretKey}`,
  };
}

async function handle(res) {
  let data = null;
  try { data = await res.json(); } catch {}
  if (!res.ok) {
    const msg = data?.user_message || data?.merchant_message || data?.message || `HTTP ${res.status}`;
    const err = new Error(msg);
    err.status = res.status;
    err.culqi = data;
    throw err;
  }
  return data;
}

/* ============== CREATE ============== */
export async function createCulqiOrder({ amount, currency="PEN", description, email, metadata={}, paymentMethods, secretKey: overrideSecret }) {
  const secretKey = resolveSecretKey(overrideSecret);
  const body = {
    amount,
    currency_code: currency,
    description,
    metadata,
    expiration_date: Math.floor(Date.now()/1000) + 24*60*60,
  };
  if (paymentMethods && typeof paymentMethods === "object") body.payment_methods = paymentMethods;

  const res = await fetch(`${BASE}/orders`, { method:"POST", headers: headers(secretKey), body: JSON.stringify(body) });
  return handle(res);
}

export async function createCulqiCharge({ amount, currency="PEN", email, tokenId, description, metadata={}, secretKey: overrideSecret }) {
  const secretKey = resolveSecretKey(overrideSecret);
  const res = await fetch(`${BASE}/charges`, {
    method:"POST",
    headers: headers(secretKey),
    body: JSON.stringify({ amount, currency_code: currency, email, source_id: tokenId, description, metadata }),
  });
  return handle(res);
}

/* ============== GET (webhook) ============== */
export async function getCulqiChargeById(chargeId, overrideSecret) {
  const secretKey = resolveSecretKey(overrideSecret);
  const res = await fetch(`${BASE}/charges/${chargeId}`, { headers: headers(secretKey) });
  return handle(res);
}
export async function getCulqiOrderById(orderId, overrideSecret) {
  const secretKey = resolveSecretKey(overrideSecret);
  const res = await fetch(`${BASE}/orders/${orderId}`, { headers: headers(secretKey) });
  return handle(res);
}

/* ============== Heurísticas ============== */
export function paidFromCharge(ch) {
  if (!ch) return false;
  if (ch.paid === true) return true;
  if (ch.capture === true) return true;
  if (["accepted","approved","success","succeeded"].includes(String(ch.status||"").toLowerCase())) return true;
  if (ch.outcome?.type?.toLowerCase?.().includes("exitosa")) return true;
  return false;
}
export function paidFromOrder(ord) {
  if (!ord) return false;
  const st = String(ord.state || ord.status || "").toLowerCase();
  if (["paid","pagado","success","succeeded","approved"].includes(st)) return true;
  if (ord.paid_at) return true;
  if (ord.paid === true) return true;
  return false;
}
