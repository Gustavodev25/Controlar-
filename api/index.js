import express from 'express';
import cors from 'cors';
import routes from './routes.js';
import dotenv from 'dotenv';

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: false, limit: '50mb' }));

// Mount routes
// Note: In Vercel, the path usually comes stripped or we need to be careful with mounting.
// If we rewrite /api/(.*) -> /api/index.js, the request URL might still start with /api
app.use('/api', routes);

// Fallback for root or direct calls to the function
app.use('/', routes);

export default app;
