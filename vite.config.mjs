import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  if (mode === "production" && !env.VITE_PLATFORM_API_URL) {
    throw new Error("VITE_PLATFORM_API_URL is required for production builds");
  }
  return ({
  base: process.env.VITE_BASE_PATH || "/",
  build: {
    outDir: "dist/client",
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("@phosphor-icons")) return "icons";
          if (id.includes("react-router")) return "router";
          if (id.includes("qrcode")) return "qrcode";
          if (id.includes("react-dom") || id.includes("/react/")) return "react";
          return undefined;
        },
      },
    },
  },
  optimizeDeps: {
    include: ["react", "react-dom/client"],
  },
  server: {
    host: "0.0.0.0",
    allowedHosts: ["terminal.local"],
    warmup: {
      clientFiles: ["./src/main.tsx"],
    },
  },
  plugins: [react()],
  });
});
