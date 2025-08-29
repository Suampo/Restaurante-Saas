// backend-facturacion/server.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors({ origin: true }));

app.get('/', (_, res) => res.send('backend-facturacion OK'));

// IMPORTA routers explícitamente (así evitamos pasar un objeto a app.use)
const debugApisPeru  = require('./src/routes/debug.apisperu');
const debugCpe       = require('./src/routes/debug.cpe');        // ESTE ARCHIVO ya define rutas que empiezan con /debug/...
const debugPedidos   = require('./src/routes/debug.pedidos');    // NUEVO: /debug/pedidos/attach-cpe
const pedidos        = require('./src/routes/pedidos');
const culqiWebhook   = require('./src/routes/culqi');
const publicRestaurants = require('./src/routes/public.restaurants');
// const pspCulqi    = require('./src/routes/psp.culqi');         // ⚠️ usa esto SOLO si realmente exporta un router

// MONTA routers
app.use('/', debugApisPeru);   // /debug/apisperu/me
app.use('/', debugCpe);        // /debug/cpe/by-pedido/:pedidoId   (no lo montes en /debug o quedará /debug/debug/...)
app.use('/debug', debugPedidos); // /debug/pedidos/attach-cpe
app.use('/', publicRestaurants); // -> /public/restaurants/:id/settings
app.use('/api', pedidos);        // POST /api/pedidos
app.use('/webhooks', culqiWebhook); // POST /webhooks/culqi

// app.use('/', pspCulqi); // ← comenta si ese archivo no exporta `router`

const port = process.env.PORT || 5000;
app.listen(port, () => console.log(`Server on :${port}`));
