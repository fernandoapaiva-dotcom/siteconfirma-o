import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  return {
    plugins: [react()],
    server: {
      port: 5173,
      host: true, // Permite conexões de fora do container Docker
      watch: {
        usePolling: true,
      },
      proxy: {
        // Assim o front chama "/api/..." e o Vite redireciona pro backend
        "/api": {
          target: env.VITE_BACKEND_URL || "http://localhost:3001",
          changeOrigin: true,
        },
      },
    },
  };
});
