import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react';

const serveGzRaw = (): Plugin => ({
    name: 'serve-gz-raw',
    configureServer(server) {
        server.middlewares.use((req, res, next) => {
            if (req.url?.match(/\.gz(\?|$)/)) {
                const orig = res.setHeader.bind(res);
                (res as any).setHeader = (name: string, value: unknown) => {
                    if (name.toLowerCase() === 'content-encoding') return res;
                    return orig(name, value as any);
                };
            }
            next();
        });
    },
});

export default defineConfig({
    plugins: [react(), serveGzRaw()],
    build: {
        rollupOptions: {
            output: {
                manualChunks: {
                    echarts: ['echarts', 'echarts-for-react'],
                },
            },
        },
    },
});
