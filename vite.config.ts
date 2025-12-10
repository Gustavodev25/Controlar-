import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import express from 'express';
import apiRoutes from './api/routes.js';

const expressPlugin = () => {
  return {
    name: 'express-plugin',
    configureServer(server) {
      const app = express();

      // Middleware needed for API parsing
      app.use(express.json({ limit: '50mb' }));
      app.use(express.urlencoded({ extended: true, limit: '50mb' }));

      // Mount API routes
      app.use('/api', apiRoutes);

      // Attach Express app to Vite's middleware stack
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
      allowedHosts: ['schematically-oscitant-herbert.ngrok-free.dev'],
      proxy: {
        // Proxies to external services only
        '/api/asaas': {
          target: 'https://www.asaas.com/api/v3',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/asaas/, ''),
          secure: false,
          headers: {
            'access_token': process.env.ASAAS_API_KEY || ''
          }
        }
      }
    },
    plugins: [react(), expressPlugin()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      }
    }
  };
});
