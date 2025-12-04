// backend-facturacion/src/routes/split/cash.routes.js
"use strict";

/**
 * Este archivo ahora actúa solo como alias del router principal de split:
 * toda la lógica de efectivo (saldo, crear pago, aprobar con PIN, etc.)
 * vive en src/routes/split.payments.js.
 *
 * De esta forma no hay rutas duplicadas ni dos implementaciones distintas.
 */

module.exports = require("../split.payments");
