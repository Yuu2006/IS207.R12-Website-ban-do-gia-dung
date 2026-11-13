import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // Docker trên Windows/macOS không chuyển sự kiện đổi file qua bind mount, nên phải quét định kỳ để HMR chạy.
    watch: process.env.VITE_USE_POLLING === "true" ? { usePolling: true, interval: 300 } : undefined,
  },
});
