// backend-facturacion/server.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const crypto = require('crypto');

const splitRoutes       = require('./src/routes/split.payments.js');
const debugApisPeru     = require('./src/routes/debug.apisperu');
const debugCpe          = require('./src/routes/debug.cpe');
const debugPedidos      = require('./src/routes/debug.pedidos');
const pedidos           = require('./src/routes/pedidos');
const culqiWebhook      = require('./src/routes/culqi');
const publicRestaurants = require('./src/routes/public.restaurants');
const pspCulqi          = require('./src/routes/psp.culqi');
const pspMP             = require('./src/routes/psp.mercadopago');
const mpWebhook         = require('./src/routes/webhook.mp');
const checkoutRoutes    = require('./src/routes/checkout.routes');

const app = express();

/* ---------- CORS + parsers ---------- */
// Lista desde .env (CORS_ORIGINS=URL1,URL2) o permitir todos en dev
const allowed = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

const corsOptions = allowed.length
  ? {
      origin(origin, cb) {
        if (!origin) return cb(null, true);
        return allowed.includes(origin) ? cb(null, true) : cb(new Error('CORS not allowed'), false);
      },
      credentials: true,
    }
  : { origin: true, credentials: true };

app.use(cors(corsOptions));
app.use(cookieParser());
// Acepta JSON de Culqi y otros (application/json o */*)
app.use(express.json({ type: '*/*' }));

/* ---------- Ping ---------- */
app.get('/', (_, res) => res.send('backend-facturacion OK'));

/* ---------- CSRF (double-submit cookie) ---------- */
app.get('/api/csrf', (req, res) => {
  let token = req.cookies?.csrf_token;
  if (!token) token = crypto.randomBytes(16).toString('hex');
  res.cookie('csrf_token', token, {
    httpOnly: false,             // legible por JS para comparar con header
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 1000 * 60 * 60 * 12, // 12h
  });
  res.json({ ok: true });
});

// Middleware que exige X-CSRF-Token = cookie csrf_token
function requireCsrf(req, res, next) {
  const cookie = req.cookies?.csrf_token;
  const header = req.get('x-csrf-token');
  if (!cookie || !header || cookie !== header) {
    return res.status(403).json({ error: 'CSRF inválido' });
  }
  return next();
}

/* ---------- Routers ---------- */
// ⚠️ Debug solo en no-producción
if (process.env.NODE_ENV !== 'production') {
  app.use('/', debugApisPeru);
  app.use('/', debugCpe);
  app.use('/debug', debugPedidos);
}

// Público/PSP
app.use('/', publicRestaurants);
app.use('/', pspCulqi);
app.use('/', pspMP);        // => /psp/mp/...
app.use('/', mpWebhook);    // => /webhooks/mp
app.use('/webhooks', culqiWebhook);

// API protegidas
app.use('/api', pedidos);
app.use('/api/split', requireCsrf, splitRoutes);
app.use('/api/checkout', requireCsrf, checkoutRoutes);

/* ---------- Echo para pruebas ---------- */
app.post('/webhooks/echo', (req, res) => {
  console.log('[ECHO]', new Date().toISOString(), req.headers['user-agent'] || '', req.body);
  res.json({ ok: true, got: req.body });
});

/* ---------- Listen ---------- */
const port = process.env.PORT || 5000;
app.listen(port, () => console.log(`Server on :${port}`));
