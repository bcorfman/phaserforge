import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { buildAssetFileName } from './assetFileNames.mjs';

const phasermsg = () => {
    return {
        name: 'phasermsg',
        buildStart() {
            process.stdout.write(`Building for production...\n`);
        },
        buildEnd() {
            const line = "---------------------------------------------------------";
            const msg = `❤️❤️❤️ Tell us about your game! - games@phaser.io ❤️❤️❤️`;
            process.stdout.write(`${line}\n${msg}\n${line}\n`);

            process.stdout.write(`✨ Done ✨\n`);
        }
    }
}

export default defineConfig({
    base: './',
    define: {
        __PHASER_FORGE_DEPLOY_CHANNEL__: JSON.stringify(process.env.VITE_PHASERFORGE_DEPLOY_CHANNEL ?? ''),
        __PHASER_FORGE_ENABLE_DEV_CLOUD_PERSISTENCE__: JSON.stringify(process.env.VITE_PHASERFORGE_ENABLE_DEV_CLOUD_PERSISTENCE ?? ''),
    },
    plugins: [
        react(),
        phasermsg()
    ],
    logLevel: 'warning',
    build: {
        rollupOptions: {
            output: {
                assetFileNames: buildAssetFileName,
                manualChunks(id) {
                    if (id.includes('/node_modules/phaser/')) {
                        return 'phaser';
                    }
                }
            }
        },
        minify: 'terser',
        terserOptions: {
            compress: {
                passes: 2
            },
            mangle: true,
            format: {
                comments: false
            }
        }
    }
});
