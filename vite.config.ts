import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  // Em dev, usar "localhost" evita mismatch de cookies com "127.0.0.1".
  // Default para 5000 (se estiver livre). Se não, defina VITE_DEV_BACKEND_URL.
  // Alinhar com .env.development (porta 5050) quando não houver variável.
  const devBackendUrl = env.VITE_DEV_BACKEND_URL || "http://localhost:5050";

  return {
    server: {
      // `localhost` pode resolver para 127.0.0.1 em alguns ambientes enquanto o
      // servidor escuta em ::1 (ou vice-versa), quebrando o websocket do HMR.
      host: true,
      port: 8080,
      hmr: {
        host: "localhost",
        protocol: "ws",
        port: 8080,
        clientPort: 8080,
        overlay: false,
      },
      proxy: {
        "/api": {
          target: devBackendUrl,
          changeOrigin: true,
        },
        "/media": {
          target: devBackendUrl,
          changeOrigin: true,
        },
      },
    },
    plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  };
});
