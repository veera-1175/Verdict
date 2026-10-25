import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      // Same data as https://verdict-web.onrender.com — repos, PRs, and reviews.
      "/api": { target: "https://verdict-api-x75u.onrender.com", changeOrigin: true },
      "/health": { target: "https://verdict-api-x75u.onrender.com", changeOrigin: true },
    },
  },
});
