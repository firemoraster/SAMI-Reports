/**
 * SAMI Weekly Reports - Database Initialization
 * Ініціалізація та синхронізація бази даних
 */

import { sequelize, models } from './models';
import logger from '../utils/logger';

/**
 * Ініціалізація бази даних
 */
export async function initDatabase(): Promise<void> {
    try {
        // Перевірка з'єднання
        await sequelize.authenticate();
        logger.info('✅ Database connection established successfully');

        // Синхронізація моделей (створення таблиць)
        // Примітка: використовуємо force: false щоб не видаляти існуючі дані
        // При зміні схеми - видаліть файл reports.db вручну
        await sequelize.sync({ force: false });
        logger.info('✅ Database models synchronized');

        // Створення початкових налаштувань
        await models.Setting.findOrCreate({
            where: { key: 'bot_version' },
            defaults: { key: 'bot_version', value: '1.0.0' },
        });

        await models.Setting.findOrCreate({
            where: { key: 'maintenance_mode' },
            defaults: { key: 'maintenance_mode', value: 'false' },
        });

        logger.info('✅ Default settings created');
        logger.info('🚀 Database initialization complete');
    } catch (error) {
        logger.error('❌ Database initialization failed:', error);
        throw error;
    }
}

/**
 * Закриття з'єднання з БД
 */
export async function closeDatabase(): Promise<void> {
    try {
        await sequelize.close();
        logger.info('Database connection closed');
    } catch (error) {
        logger.error('Error closing database:', error);
    }
}

// Якщо запущено напряму
if (require.main === module) {
    initDatabase()
        .then(() => {
            console.log('Database initialized successfully');
            process.exit(0);
        })
        .catch((error) => {
            console.error('Failed to initialize database:', error);
            process.exit(1);
        });
}

export default { initDatabase, closeDatabase };
