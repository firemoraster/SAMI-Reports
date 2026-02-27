/**
 * SAMI Weekly Reports - Telegram Bot Entry Point
 * Головний модуль Telegram бота
 */

import { Telegraf, Context, session } from 'telegraf';
import { setupHandlers } from './handlers';
import { initNotificationScheduler } from '../services/notification.service';
import config from '../config';
import logger from '../utils/logger';

// Extended Context
interface BotContext extends Context {
    user?: any;
    session?: any;
}

let bot: Telegraf<BotContext> | null = null;

/**
 * Створення та налаштування бота
 */
export function createBot(): Telegraf<BotContext> {
    if (bot) {
        return bot;
    }

    bot = new Telegraf<BotContext>(config.telegram.botToken);

    // Session middleware (опціонально для telegraf-session)
    bot.use(session());

    // Error handling
    bot.catch((err, ctx) => {
        logger.error(`Bot error for ${ctx.updateType}:`, err);
        ctx.reply('😔 Виникла помилка. Спробуйте ще раз пізніше.').catch(() => {});
    });

    // Налаштування обробників
    setupHandlers(bot);

    logger.info('Bot created successfully');
    return bot;
}

/**
 * Запуск бота в режимі polling
 */
export async function startPolling(): Promise<void> {
    const botInstance = createBot();

    // Запустити планувальник сповіщень
    if (config.telegram.botToken) {
        initNotificationScheduler(botInstance);
    }

    // Запустити polling
    await botInstance.launch({
        dropPendingUpdates: true,
    });

    logger.info('Bot started in polling mode');

    // Graceful stop
    process.once('SIGINT', () => {
        logger.info('Stopping bot (SIGINT)...');
        botInstance.stop('SIGINT');
    });
    process.once('SIGTERM', () => {
        logger.info('Stopping bot (SIGTERM)...');
        botInstance.stop('SIGTERM');
    });
}

/**
 * Запуск бота в режимі webhook
 */
export async function startWebhook(
    webhookUrl: string,
    port: number = 3000,
    path: string = '/webhook'
): Promise<void> {
    const botInstance = createBot();

    // Запустити планувальник сповіщень
    initNotificationScheduler(botInstance);

    // Налаштувати webhook
    await botInstance.telegram.setWebhook(`${webhookUrl}${path}`);

    // Запустити сервер
    await botInstance.launch({
        webhook: {
            domain: webhookUrl,
            port,
            hookPath: path,
        },
    });

    logger.info(`Bot started in webhook mode at ${webhookUrl}${path}:${port}`);

    // Graceful stop
    process.once('SIGINT', () => botInstance.stop('SIGINT'));
    process.once('SIGTERM', () => botInstance.stop('SIGTERM'));
}

/**
 * Отримати middleware для Express інтеграції
 */
export function getWebhookCallback(): any {
    const botInstance = createBot();
    return botInstance.webhookCallback('/webhook');
}

/**
 * Отримати екземпляр бота
 */
export function getBot(): Telegraf<BotContext> | null {
    return bot;
}

/**
 * Надіслати повідомлення користувачу
 */
export async function sendMessage(
    telegramId: number,
    message: string,
    options: any = {}
): Promise<void> {
    const botInstance = getBot();
    if (!botInstance) {
        throw new Error('Bot not initialized');
    }

    try {
        await botInstance.telegram.sendMessage(telegramId, message, {
            parse_mode: 'Markdown',
            ...options,
        });
    } catch (error) {
        logger.error(`Failed to send message to ${telegramId}:`, error);
        throw error;
    }
}

/**
 * Надіслати документ користувачу
 */
export async function sendDocument(
    telegramId: number,
    document: string | Buffer,
    caption?: string
): Promise<void> {
    const botInstance = getBot();
    if (!botInstance) {
        throw new Error('Bot not initialized');
    }

    try {
        await botInstance.telegram.sendDocument(telegramId, 
            typeof document === 'string' ? { source: document } : { source: document },
            { caption }
        );
    } catch (error) {
        logger.error(`Failed to send document to ${telegramId}:`, error);
        throw error;
    }
}

export default {
    createBot,
    startPolling,
    startWebhook,
    getWebhookCallback,
    getBot,
    sendMessage,
    sendDocument,
};
