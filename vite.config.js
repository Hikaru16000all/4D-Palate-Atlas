// vite.config.js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/Palate-3D-Mapping/',
  build: {
    outDir: 'dist',
    sourcemap: false,
    // 添加构建优化选项
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          deckgl: ['@deck.gl/core', '@deck.gl/layers', '@deck.gl/react']
        }
      }
    }
  },
  server: {
    watch: {
      // 忽略 public/data/binary 目录下的所有文件
      ignored: ['**/public/data/binary/**']
    },
    // 可选：添加热重载配置
    hmr: {
      overlay: false
    }
  },
  // 可选：优化预览服务器
  preview: {
    port: 4173
  }
})