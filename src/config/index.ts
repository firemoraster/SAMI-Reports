/**
 * SAMI Weekly Reports - Configuration
 * Завантаження та валідація конфігурації з .env
 */

import dotenv from 'dotenv';
import path from 'path';

// Завантаження .env файлу
dotenv.config();

/**
 * Отримання змінної оточення з перевіркою
 */
function getEnv(key: string, defaultValue?: string): string {
    const value = process.env[key] || defaultValue;
    if (value === undefined) {
        throw new Error(`Environment variable ${key} is required but not set`);
    }
    return value;
}

/**
 * Отримання числової змінної
 */
function getEnvNumber(key: string, defaultValue?: number): number {
    const value = process.env[key];
    if (value === undefined) {
        if (defaultValue !== undefined) return defaultValue;
        throw new Error(`Environment variable ${key} is required but not set`);
    }
    const num = parseInt(value, 10);
    if (isNaN(num)) {
        throw new Error(`Environment variable ${key} must be a number`);
    }
    return num;
}

/**
 * Отримання списку ID
 */
function getEnvArray(key: string, defaultValue: string[] = []): number[] {
    const value = process.env[key];
    if (!value) return defaultValue.map(Number);
    return value.split(',').map(id => parseInt(id.trim(), 10)).filter(id => !isNaN(id));
}

/**
 * Конфігурація системи
 */
export const config = {
    // Telegram
    telegram: {
        botToken: getEnv('TELEGRAM_BOT_TOKEN', ''),
        webhookUrl: getEnv('TELEGRAM_WEBHOOK_URL', ''),
        mode: getEnv('TELEGRAM_MODE', 'polling') as 'webhook' | 'polling',
    },

    // Trello
    trello: {
        apiKey: getEnv('TRELLO_API_KEY', ''),
        apiSecret: getEnv('TRELLO_API_SECRET', ''),
        token: getEnv('TRELLO_TOKEN', ''),
        boardId: getEnv('TRELLO_BOARD_ID', ''),
    },

    // Database
    database: {
        path: getEnv('DATABASE_PATH', './data/reports.db'),
    },

    // Admin
    admin: {
        ids: getEnvArray('ADMIN_IDS'),
        defaultManagerId: getEnvNumber('DEFAULT_MANAGER_ID', 0),
    },

    // Report settings
    report: {
        reminderDay: getEnvNumber('REPORT_REMINDER_DAY', 5),
        reminderTime: getEnv('REPORT_REMINDER_TIME', '15:00'),
        deadlineDay: getEnvNumber('REPORT_DEADLINE_DAY', 5),
        deadlineTime: getEnv('REPORT_DEADLINE_TIME', '18:00'),
    },

    // Language
    language: {
        default: getEnv('DEFAULT_LANGUAGE', 'uk') as 'uk' | 'en',
    },

    // Logging
    logging: {
        level: getEnv('LOG_LEVEL', 'info'),
        file: getEnv('LOG_FILE', './logs/app.log'),
    },

    // API
    api: {
        enabled: getEnv('API_ENABLED', 'true') === 'true',
        host: getEnv('API_HOST', '0.0.0.0'),
        port: getEnvNumber('API_PORT', 3000),
        secretKey: getEnv('SECRET_KEY', 'default-secret-key'),
        apiKey: getEnv('API_KEY', ''),
    },

    // PDF
    pdf: {
        templatesPath: getEnv('PDF_TEMPLATES_PATH', './templates/pdf'),
        tempPath: getEnv('PDF_TEMP_PATH', './temp/pdf'),
    },

    // Paths
    paths: {
        root: path.resolve(__dirname, '..', '..'),
        data: path.resolve(__dirname, '..', '..', 'data'),
        logs: path.resolve(__dirname, '..', '..', 'logs'),
        temp: path.resolve(__dirname, '..', '..', 'temp'),
    },
};

export type Config = typeof config;
export default config;
