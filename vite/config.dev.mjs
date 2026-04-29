import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
    base: './',
    plugins: [
        react(),
    ],
    server: {
        port: 8080,
        proxy: {
            '/api': {
                target: `http://localhost:${process.env.API_PORT ?? '8787'}`,
                changeOrigin: true,
            },
        },
    }
})
