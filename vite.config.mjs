import { rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => ({
  base: process.env.VITE_BASE_PATH || "/",
  define: {
    "import.meta.env.VITE_APP_MODE": JSON.stringify(mode === "demo" ? "demo" : process.env.VITE_APP_MODE || ""),
  },
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
  plugins: [
    react(),
    mode === "demo" && {
      name: "baiye-demo-deployment-safety",
      async closeBundle() {
        const output = resolve("dist/client");
        await writeFile(resolve(output, "robots.txt"), "User-agent: *\nDisallow: /\n", "utf8");
        await writeFile(resolve(output, "_headers"), "/*\n  X-Robots-Tag: noindex, nofollow\n", "utf8");
        await rm(resolve(output, "CNAME"), { force: true });
      },
    },
  ].filter(Boolean),
}));
