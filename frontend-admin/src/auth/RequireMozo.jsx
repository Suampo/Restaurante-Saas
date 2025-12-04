// src/auth/RequireMozo.jsx
import { Navigate } from "react-router-dom";

export default function RequireMozo({ children }) {
  // Identidad básica
  const email =
    localStorage.getItem("user_email") ||
    sessionStorage.getItem("user_email");

  const role = (
    localStorage.getItem("user_role") ||
    sessionStorage.getItem("user_role") ||
    ""
  ).toLowerCase();

  // Nadie logueado -> login normal
  if (!email) {
    return <Navigate to="/login" replace />;
  }

  // Acepta:
  // - waiter  (login mozo por PIN en facturación)
  // - staff   (usuario mozo en tabla usuarios)
  // - admin   (puede cobrar también)
  const allowedRoles = ["waiter", "staff", "admin"];
  if (!allowedRoles.includes(role)) {
    return <Navigate to="/login" replace />;
  }

  return children;
}
