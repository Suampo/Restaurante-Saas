import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [
    react({
      fastRefresh: false, // 👈 si el warning no se va, prueba false
      jsxRuntime: "automatic",
    }),
  ],
  server: { port: 5174, strictPort: true },
  resolve: { dedupe: ["react", "react-dom"] },
  optimizeDeps: { include: ["react", "react-dom"] },
});