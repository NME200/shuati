import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// 云托管后端地址：本地开发代理到 localhost，部署时改为云托管公网域名
const API_TARGET = process.env.VITE_API_TARGET || 'http://localhost:8080'

export default defineConfig({
  plugins: [vue()],
  base: './',
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: API_TARGET,
        changeOrigin: true
      }
    }
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets'
  }
})
