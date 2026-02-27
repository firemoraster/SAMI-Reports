/**
 * SAMI Weekly Reports - Main Entry Point
 * Головний модуль системи автоматизації тижневої звітності
 * 
 * @author SAMI Team
 * @version 1.0.0
 */

import 'dotenv/config';
import { initDatabase, closeDatabase } from './database';
import { startPolling, startWebhook, getWebhookCallback, getBot } from './bot';
import { createApp, startServer } from './api';
import logger from './utils/logger';
import config from './config';

/**
 * Головна функція запуску
 */
async function main(): Promise<void> {
    logger.info('==============================================');
    logger.info('  SAMI Weekly Reports System Starting...');
    logger.info('==============================================');
    logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
    logger.info(`Language: ${config.language.default}`);

    try {
        // 1. Ініціалізація бази даних
        logger.info('Initializing database...');
        await initDatabase();
        logger.info('✓ Database initialized');

        // 2. Запуск API сервера (якщо увімкнено)
        if (config.api.enabled) {
            logger.info('Starting API server...');
            
            // Якщо webhook режим - інтегрувати бота в Express
            if (process.env.WEBHOOK_URL) {
                const app = createApp();
                
                // Додати webhook endpoint для бота
                app.use('/webhook', getWebhookCallback());
                
                await startServer();
                
                // Налаштувати webhook
                await startWebhook(
                    process.env.WEBHOOK_URL,
                    config.api.port,
                    '/webhook'
                );
            } else {
                await startServer();
                logger.info(`✓ API server running on port ${config.api.port}`);
            }
        }

        // 3. Запуск Telegram бота (polling режим, якщо не webhook)
        if (config.telegram.botToken && !process.env.WEBHOOK_URL) {
            logger.info('Starting Telegram bot in polling mode...');
            await startPolling();
            logger.info('✓ Telegram bot started');

            // Health-check: перевірка з'єднання бота кожні 60 секунд
            setInterval(async () => {
                try {
                    const bot = getBot();
                    if (bot) {
                        await bot.telegram.getMe();
                    }
                } catch (error) {
                    logger.error('Bot health-check failed:', error);
                }
            }, 60 * 1000);
        }

        // Інформація про систему
        logger.info('');
        logger.info('==============================================');
        logger.info('  System is ready!');
        logger.info('==============================================');
        logger.info('');
        
        if (config.telegram.botToken) {
            logger.info(`📱 Bot: @${process.env.BOT_USERNAME || 'YourBot'}`);
        }
        if (config.api.enabled) {
            logger.info(`🌐 API: http://localhost:${config.api.port}`);
        }
        if (config.trello.apiKey) {
            logger.info(`📋 Trello: Integration enabled`);
        }
        
        logger.info('');
        logger.info('Press Ctrl+C to stop');

    } catch (error) {
        logger.error('Failed to start application:', error);
        process.exit(1);
    }
}

/**
 * Graceful shutdown
 */
function setupGracefulShutdown(): void {
    const signals: NodeJS.Signals[] = ['SIGINT', 'SIGTERM'];

    signals.forEach((signal) => {
        process.on(signal, async () => {
            logger.info(`\nReceived ${signal}, shutting down gracefully...`);
            
            try {
                // Зупинити бота
                const bot = getBot();
                if (bot) {
                    bot.stop(signal);
                    logger.info('✓ Bot stopped');
                }

                // Закрити з'єднання з БД
                await closeDatabase();
                logger.info('✓ Database connection closed');

                logger.info('Cleanup complete. Goodbye!');
                process.exit(0);
            } catch (error) {
                logger.error('Error during shutdown:', error);
                process.exit(1);
            }
        });
    });
}

/**
 * Обробка необроблених помилок
 */
function setupErrorHandlers(): void {
    process.on('uncaughtException', (error) => {
        logger.error('Uncaught Exception:', error);
        process.exit(1);
    });

    process.on('unhandledRejection', (reason, promise) => {
        logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
    });
}

// ============================================
// ENTRY POINT
// ============================================

setupErrorHandlers();
setupGracefulShutdown();
main().catch((error) => {
    logger.error('Fatal error:', error);
    process.exit(1);
});
