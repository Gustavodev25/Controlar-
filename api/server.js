import express from 'express';
import cors from 'cors';

const app = express();
const PORT = process.env.PORT || 3001;

// CORS Configuration
app.use(cors({
    origin: true, // Allow all origins for now
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// Trust proxy for accurate IP detection
app.set('trust proxy', true);

// Body parsers
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: false, limit: '50mb' }));

// Health check endpoint (FIRST - before any other routes)
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        env: process.env.NODE_ENV || 'development'
    });
});

app.get('/', (req, res) => {
    res.json({
        name: 'Controlar API',
        version: '1.0.0',
        status: 'running'
    });
});

// Start server FIRST, then load routes
app.listen(PORT, '0.0.0.0', async () => {
    console.log(`🚀 API Server running on http://0.0.0.0:${PORT}`);
    console.log(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);

    try {
        // Load routes after server is running
        console.log('Loading routes...');
        const { default: routes } = await import('./routes.js');
        const { default: pluggyRoutes } = await import('./pluggy.js');

        // Mount routes
        app.use('/api', routes);
        app.use('/api/pluggy', pluggyRoutes);
        app.use('/', routes);
        app.use('/pluggy', pluggyRoutes);

        console.log('✅ All routes loaded successfully');
    } catch (err) {
        console.error('❌ Error loading routes:', err.message);
        console.error(err.stack);
    }
});
