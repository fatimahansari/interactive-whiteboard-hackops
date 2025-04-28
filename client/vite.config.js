import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],

  optimizeDeps: {
    include: ["fabric"],
  },

  server: {
    host: "192.168.111.236",
    port: 4080
  }
});