import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const server = process.env.PASSBOX_SERVER_URL ?? "http://127.0.0.1:8080";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      "/api": server,
      "/health": server,
    },
  },
  build: {
    target: "es2022",
  },
});
