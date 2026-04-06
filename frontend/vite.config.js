import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],

  server: {
    port: 5173,
    proxy: {
      "/api": {
        target:       "http://localhost:8000",
        changeOrigin: true,
        rewrite:      (path) => path.replace(/^\/api/, ""),
      },
    },
  },

  build: {
    outDir:          "dist",
    sourcemap:       false,
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        // Smart code splitting for faster loads
        manualChunks: {
          "react-core":  ["react", "react-dom"],
          "react-router": ["react-router-dom"],
          "supabase":    ["@supabase/supabase-js"],
          "markdown":    ["react-markdown"],
          "icons":       ["lucide-react"],
          "http":        ["axios"],
        },
      },
    },
  },

  // Optimize deps for faster cold start
  optimizeDeps: {
    include: [
      "react", "react-dom", "react-router-dom",
      "@supabase/supabase-js", "axios", "lucide-react",
      "react-markdown",
    ],
  },
});
