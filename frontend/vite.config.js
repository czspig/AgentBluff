import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  server: {
    // Allow importing ../shared (persona definitions shared with the server).
    fs: { allow: [".."] },
    proxy: {
      "/api": { target: "http://127.0.0.1:8787", changeOrigin: false },
    },
  },
});
