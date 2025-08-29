const axios = require('axios');

const { PEDIDOS_URL, PEDIDOS_TOKEN } = process.env;

async function getOrder(orderId) {
  if (!PEDIDOS_URL) return null;
  const headers = PEDIDOS_TOKEN ? { Authorization: `Bearer ${PEDIDOS_TOKEN}` } : {};
  const r = await axios.get(`${PEDIDOS_URL}/api/pedidos/${orderId}`, {
    headers,
    timeout: 15000,
  });
  return r.data;
}

module.exports = { getOrder };
