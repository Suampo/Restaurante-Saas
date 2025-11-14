// src/socket.js
import { io } from "socket.io-client";

let socket;

export function getSocket() {
  if (socket?.connected || socket?.connecting) return socket;

  // dbToken emitido por tu backend (RLS), guardado por AuthProvider
  const dbToken = sessionStorage.getItem("dbToken") || localStorage.getItem("dbToken");

  socket = io(import.meta.env.VITE_WS_URL || "http://localhost:4000", {
    transports: ["websocket"],
    withCredentials: true,
    auth: { token: dbToken },
    extraHeaders: dbToken ? { Authorization: `Bearer ${dbToken}` } : {},
  });

  return socket;
}
