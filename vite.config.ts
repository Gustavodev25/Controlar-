import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import express from 'express';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '.env'), override: true });

console.log('[Vite] PLUGGY_CLIENT_ID loaded:', process.env.PLUGGY_CLIENT_ID ? 'Sim' : 'Não');

const expressPlugin = () => {
  return {
    name: 'express-plugin',
    async configureServer(server) {
      const app = express();

      app.use(express.json({ limit: '50mb' }));
      app.use(express.urlencoded({ extended: true, limit: '50mb' }));

      const apiRoutes = (await import('./api/routes.js')).default;
      app.use('/api', apiRoutes);

      server.middlewares.use(app);
    }
  };
};

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    server: {
      port: 3000,
      host: '0.0.0.0',
      allowedHosts: ['damageable-josephine-nonvexatiously.ngrok-free.dev'],
    },
    plugins: [react(), expressPlugin()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      }
    }
  };
});
