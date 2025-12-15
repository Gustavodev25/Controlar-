import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import express from 'express';
import dotenv from 'dotenv';
import apiRoutes from './api/routes.js';

// Get the directory of the current file
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables for the API from the correct path
dotenv.config({ path: path.resolve(__dirname, '.env'), override: true });

console.log('[Vite] PLUGGY_CLIENT_ID loaded:', process.env.PLUGGY_CLIENT_ID ? 'Yes' : 'No');

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
      allowedHosts: ['semaj-unenlisted-nonintellectually.ngrok-free.dev', 'www.controlarmais.com.br'],
    },
    plugins: [react(), expressPlugin()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      }
    }
  };
});
