// middlewares/requireWaiter.js
module.exports = function requireWaiter(req, res, next) {
  const role = req.user?.role || req.get("x-user-role");
  const restaurantId = req.user?.restaurant_id || req.get("x-restaurant-id");
  if (role !== "waiter") return res.status(401).json({ error: "Solo mozos" });
  // opcional: asocia al req para validaciones posteriores
  req.sessionRestaurantId = restaurantId;
  next();
};
