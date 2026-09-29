import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: process.env.VITE_BASE_PATH || "/",
  build: {
    outDir: "dist/client",
    rollupOptions: {
      input: ["index.html", "ads.html"],
      output: {
        manualChunks(id) {
          if (id.includes("react-router")) return "router";
          if (id.includes("qrcode")) return "qrcode";
          if (id.includes("/node_modules/react-dom/") || id.includes("/node_modules/react/")) return "react";
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
    proxy: {
      "/api/public": "http://127.0.0.1:8787",
    },
  },
  plugins: [
    react(),
    {
      name: "production-build-metadata",
      transformIndexHtml(html) {
        if (!process.env.GITHUB_SHA) return html;
        return html.replace("</head>", `    <meta name="build-commit" content="${process.env.GITHUB_SHA}" />\n    <meta name="build-timestamp" content="${new Date().toISOString()}" />\n  </head>`);
      },
    },
  ],
});
