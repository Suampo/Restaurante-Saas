import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '20s', target: 5 },
    { duration: '40s', target: 20 },
    { duration: '20s', target: 0 },
  ],
};

const BASE_URL_FACT = __ENV.BASE_URL_FACT || 'http://localhost:5000';

// Estos headers simulan que ya hiciste auth a nivel de gateway
// ajusta según cómo valides en backend-facturacion (x-user-id, x-restaurant-id, etc.)
const RESTAURANT_ID = __ENV.RESTAURANT_ID || '1';
const USER_ID       = __ENV.USER_ID || 'test-user-id';

export default function () {
  const params = {
    headers: {
      'x-restaurant-id': RESTAURANT_ID,
      'x-user-id': USER_ID,
    },
    tags: { name: 'cpe_list' },
  };

  const res = http.get(
    `${BASE_URL_FACT}/api/admin/cpe-documents?q=&tipo=all&estado=all`,
    params
  );

  check(res, {
    '200 OK': (r) => r.status === 200,
    'tiene summary': (r) => !!r.json('summary'),
  });

  sleep(1);
}
