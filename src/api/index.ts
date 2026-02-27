/**
 * SAMI Weekly Reports - API Server
 * Express сервер для REST API
 */

import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import routes from './routes';
import logger from '../utils/logger';
import config from '../config';

let app: Express | null = null;

/**
 * Створити Express сервер
 */
export function createApp(): Express {
    if (app) {
        return app;
    }

    app = express();

    // Security middleware
    app.use(helmet());
    
    // CORS
    const allowedOrigins = process.env.CORS_ORIGINS 
        ? process.env.CORS_ORIGINS.split(',').map(s => s.trim())
        : ['http://localhost:3000'];
    app.use(cors({
        origin: process.env.NODE_ENV === 'production' ? allowedOrigins : '*',
        methods: ['GET', 'POST', 'PUT', 'DELETE'],
        allowedHeaders: ['Content-Type', 'X-API-Key', 'Authorization'],
    }));

    // Rate limiting
    const apiLimiter = rateLimit({
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 100, // max 100 requests per window
        standardHeaders: true,
        legacyHeaders: false,
        message: { error: 'Too many requests, please try again later.' },
    });
    app.use('/api', apiLimiter);

    // Compression
    app.use(compression());

    // Body parsing
    app.use(express.json({ limit: '10mb' }));
    app.use(express.urlencoded({ extended: true }));

    // Request logging
    app.use((req: Request, res: Response, next) => {
        logger.debug(`${req.method} ${req.path}`);
        next();
    });

    // Health check (без авторизації)
    app.get('/', (req, res) => {
        res.json({
            name: 'SAMI Weekly Reports API',
            version: '1.0.0',
            status: 'running',
        });
    });

    // API routes
    app.use('/api', routes);

    // 404 handler
    app.use((req, res) => {
        res.status(404).json({ error: 'Not found' });
    });

    logger.info('Express app created');
    return app;
}

/**
 * Запустити сервер
 */
export async function startServer(port?: number): Promise<void> {
    const appInstance = createApp();
    const serverPort = port || config.api.port;

    return new Promise((resolve) => {
        appInstance.listen(serverPort, () => {
            logger.info(`API server running on port ${serverPort}`);
            resolve();
        });
    });
}

/**
 * Отримати Express app
 */
export function getApp(): Express | null {
    return app;
}

export default {
    createApp,
    startServer,
    getApp,
};
