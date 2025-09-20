import { io } from "socket.io-client";
let socket;
export function getSocket() {
  if (socket?.connected || socket?.connecting) return socket;
  const token = localStorage.getItem("token") || sessionStorage.getItem("token");
  socket = io(import.meta.env.VITE_WS_URL || "http://localhost:4000", {
    auth: { token },
    transports: ["websocket"],
  });
  return socket;
}
