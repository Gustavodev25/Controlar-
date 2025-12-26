import express from 'express';
import cors from 'cors';
import routes from './routes.js';
import pluggyRoutes from './pluggy.js';
import { loadEnv } from './env.js';

// Load environment variables
loadEnv();

const app = express();
const PORT = process.env.PORT || 3001;

// Railway / Production CORS Configuration
const allowedOrigins = [
    'http://localhost:5173',
    'http://localhost:3000',
    'https://www.controlarmais.com.br',
    'https://controlarmais.com.br',
    'https://controlar.vercel.app',
    /\.vercel\.app$/  // Allow all Vercel preview deployments
];

app.use(cors({
    origin: (origin, callback) => {
        // Allow requests with no origin (mobile apps, curl, etc)
        if (!origin) return callback(null, true);

        // Check against allowed origins
        const isAllowed = allowedOrigins.some(allowed => {
            if (allowed instanceof RegExp) {
                return allowed.test(origin);
            }
            return allowed === origin;
        });

        if (isAllowed) {
            callback(null, true);
        } else {
            console.log('[CORS] Blocked origin:', origin);
            callback(null, true); // Allow anyway for now, log for debugging
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// Trust proxy for accurate IP detection
app.set('trust proxy', true);

// Body parsers
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: false, limit: '50mb' }));

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        env: process.env.NODE_ENV || 'development'
    });
});

// Mount routes
app.use('/api', routes);
app.use('/api/pluggy', pluggyRoutes);

// Also mount at root for compatibility
app.use('/', routes);
app.use('/pluggy', pluggyRoutes);

// Error handler
app.use((err, req, res, next) => {
    console.error('[Server Error]', err);
    res.status(500).json({
        error: 'Internal Server Error',
        message: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 API Server running on http://0.0.0.0:${PORT}`);
    console.log(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`✅ CORS enabled for: ${allowedOrigins.filter(o => typeof o === 'string').join(', ')}`);
});
