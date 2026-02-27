/**
 * SAMI Weekly Reports - Logger
 * Логування подій системи з використанням Winston
 */

import winston from 'winston';
import path from 'path';
import fs from 'fs';

// Колір для різних рівнів логування
const colors = {
    error: 'red',
    warn: 'yellow',
    info: 'green',
    debug: 'blue',
};

winston.addColors(colors);

// Формат для консолі
const consoleFormat = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.colorize({ all: true }),
    winston.format.printf(({ timestamp, level, message, ...meta }) => {
        const metaStr = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : '';
        return `[${timestamp}] ${level}: ${message} ${metaStr}`;
    })
);

// Формат для файлу
const fileFormat = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.json()
);

// Створення директорії для логів
const logDir = process.env.LOG_FILE 
    ? path.dirname(process.env.LOG_FILE) 
    : './logs';

if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
}

// Створення логера
const logger = winston.createLogger({
    level: (process.env.LOG_LEVEL || 'info').toLowerCase(),
    transports: [
        // Консоль
        new winston.transports.Console({
            format: consoleFormat,
        }),
        // Файл для всіх логів
        new winston.transports.File({
            filename: path.join(logDir, 'app.log'),
            format: fileFormat,
            maxsize: 5242880, // 5MB
            maxFiles: 5,
        }),
        // Окремий файл для помилок
        new winston.transports.File({
            filename: path.join(logDir, 'error.log'),
            level: 'error',
            format: fileFormat,
            maxsize: 5242880,
            maxFiles: 5,
        }),
    ],
});

export default logger;
