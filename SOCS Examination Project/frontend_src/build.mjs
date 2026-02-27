import { build } from 'vite';
import react from '@vitejs/plugin-react';

async function runBuild() {
    try {
        await build({
            root: process.cwd(),
            plugins: [react()],
            build: {
                outDir: 'dist',
                rollupOptions: {
                    output: {
                        manualChunks: {
                            vendor: ['react', 'react-dom', 'react-router-dom'],
                            flatpickr: ['flatpickr'],
                        }
                    }
                }
            }
        });
        console.log('Build complete');
    } catch (err) {
        console.error('Build failed', err);
        process.exit(1);
    }
}

runBuild();
