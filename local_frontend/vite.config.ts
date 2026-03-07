import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: "/",
  server: {
    host: '0.0.0.0', // Allow external access
    port: 3030, // Frontend now runs on port 3030
  },
  build: {
    chunkSizeWarningLimit: 3000,
  },
});
