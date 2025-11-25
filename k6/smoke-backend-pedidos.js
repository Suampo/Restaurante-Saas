import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  vus: 3,
  duration: '10s',
};

const BASE_URL_PEDIDOS = __ENV.BASE_URL_PEDIDOS || 'http://localhost:4000';

export default function () {
  const res = http.get(`${BASE_URL_PEDIDOS}/api/health`, {
    tags: { name: 'pedidos_health' },
  });

  check(res, {
    'status 200': (r) => r.status === 200,
  });

  sleep(1);
}
//////////////PARA SABBER SI EL 