import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // During local dev, proxy /api calls to Flask running on port 5000
  // In production (Vercel), VITE_API_URL env var points to Render URL
  server: {
    proxy: {
      "/api": {
        target: "http://localhost:5000",
        changeOrigin: true,
      },
    },
  },
});
