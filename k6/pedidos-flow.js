// k6/pedidos-flow.js
import http from 'k6/http';
import { check, sleep } from 'k6';
import { randomIntBetween, randomItem } from 'https://jslib.k6.io/k6-utils/1.4.0/index.js';

export const options = {
  stages: [
    { duration: '30s', target: 5 },   // subida suave
    { duration: '1m',  target: 30 },  // pico de 30 usuarios
    { duration: '30s', target: 0 },   // bajada
  ],
  // 👇 Esto hace que el resumen de k6 muestre métricas separadas
  // para cada endpoint (crear vs listar pedidos)
  thresholds: {
    'http_req_duration{endpoint:"pedidos_create"}': [],
    'http_req_duration{endpoint:"pedidos_list"}': [],
  },
};

const BASE_URL_PEDIDOS = __ENV.BASE_URL_PEDIDOS || 'http://localhost:4000';
const RESTAURANT_ID    = Number(__ENV.RESTAURANT_ID || 1);
const MESA_ID          = Number(__ENV.MESA_ID || 1);

const USER_EMAIL    = __ENV.USER_EMAIL || 'admin@demo.com';
const USER_PASSWORD = __ENV.USER_PASSWORD || '123456';

const MENU_ITEM_IDS = (__ENV.MENU_ITEM_IDS || '')
  .split(',')
  .map((s) => Number(s.trim()))
  .filter((n) => !Number.isNaN(n) && n > 0);

if (!MENU_ITEM_IDS.length) {
  throw new Error('Debes definir MENU_ITEM_IDS con IDs de menu_items válidos. Ej: MENU_ITEM_IDS=3,4,5');
}

// 🔹 LOGIN UNA SOLA VEZ ANTES DEL TEST
export function setup() {
  const loginRes = http.post(
    `${BASE_URL_PEDIDOS}/api/auth/login`,
    JSON.stringify({ email: USER_EMAIL, password: USER_PASSWORD }),
    {
      headers: { 'Content-Type': 'application/json' },
      tags: { name: 'auth_login_setup', endpoint: 'auth_login_setup' },
    }
  );

  check(loginRes, {
    'login setup 200': (r) => r.status === 200,
    'login setup token': (r) => !!r.json('token'),
  });

  if (loginRes.status !== 200) {
    throw new Error(`Login en setup falló: ${loginRes.status} ${loginRes.body}`);
  }

  const token = loginRes.json('token');
  return { token };
}

// 🔹 CADA VU REUTILIZA EL TOKEN PARA CREAR PEDIDOS
export default function (data) {
  const token = data.token;

  const idempotencyKey = `${__VU}-${Date.now()}-${Math.random()}`;

  const numLines = randomIntBetween(1, 3);
  const items = [];

  for (let i = 0; i < numLines; i++) {
    const menuItemId = randomItem(MENU_ITEM_IDS);
    const cantidad = randomIntBetween(1, 3);

    items.push({
      menuItemId,
      cantidad,
    });
  }

  const payloadPedido = {
    restaurantId: RESTAURANT_ID,
    mesaId: MESA_ID,
    idempotencyKey,
    items,
  };

  // 🔸 CREAR PEDIDO
  const createRes = http.post(
    `${BASE_URL_PEDIDOS}/api/pedidos`,
    JSON.stringify(payloadPedido),
    {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      tags: { name: 'pedidos_create', endpoint: 'pedidos_create' },
    }
  );

  const okCreate = check(createRes, {
    'crear pedido 2xx': (r) => r.status >= 200 && r.status < 300,
  });

  if (!okCreate) {
    console.log('❌ Error al crear pedido:', createRes.status, createRes.body);
    sleep(1);
    return;
  }

  // 🔸 LISTAR PEDIDOS
  const listRes = http.get(
    `${BASE_URL_PEDIDOS}/api/pedidos?status=all`,
    {
      headers: { Authorization: `Bearer ${token}` },
      tags: { name: 'pedidos_list', endpoint: 'pedidos_list' },
    }
  );

  check(listRes, {
    'listar pedidos 200': (r) => r.status === 200,
  });

  sleep(1);
}
