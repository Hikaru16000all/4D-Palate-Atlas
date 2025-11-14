// vite.config.js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/4D-Palate-Atlas/', // 重要：替换为你的仓库名
  build: {
    outDir: 'dist',
    sourcemap: false
  }
})
