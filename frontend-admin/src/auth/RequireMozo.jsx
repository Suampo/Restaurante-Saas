// src/auth/RequireMozo.jsx
import { Navigate } from "react-router-dom";

export default function RequireMozo({ children }) {
  const email = localStorage.getItem("user_email");
  const role  = localStorage.getItem("user_role"); // <- lo setea setAuthIdentity
  if (!email || role !== "waiter") {
    return <Navigate to="/mozo/login" replace />;
  }
  return children;
}
