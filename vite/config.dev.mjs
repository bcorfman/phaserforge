import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
    base: './',
    define: {
        __PHASER_FORGE_DEPLOY_CHANNEL__: JSON.stringify(process.env.VITE_PHASERFORGE_DEPLOY_CHANNEL ?? ''),
        __PHASER_FORGE_ENABLE_DEV_CLOUD_PERSISTENCE__: JSON.stringify(process.env.VITE_PHASERFORGE_ENABLE_DEV_CLOUD_PERSISTENCE ?? ''),
    },
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
