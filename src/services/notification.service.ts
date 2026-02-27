/**
 * SAMI Weekly Reports - Notification Service
 * Сповіщення та нагадування
 */

import cron from 'node-cron';
import { Telegraf } from 'telegraf';
import config from '../config';
import { User } from '../database/models';
import { userCrud } from '../database/crud';
import { getUsersWithoutReports } from './stats.service';
import { getWeekNumber, getCurrentYear } from '../utils/helpers';
import { t } from '../utils/i18n';
import logger from '../utils/logger';
import type { Language } from '../types';

// Telegram bot instance (буде встановлено ззовні)
let bot: Telegraf | null = null;

/**
 * Встановити інстанс бота
 */
export function setBotInstance(botInstance: Telegraf): void {
    bot = botInstance;
}

/**
 * Надіслати повідомлення користувачу
 */
export async function sendMessage(
    telegramId: number, 
    message: string, 
    options?: { parse_mode?: 'HTML' | 'Markdown' | 'MarkdownV2' }
): Promise<boolean> {
    if (!bot) {
        logger.warn('Bot instance not set for notifications');
        return false;
    }

    try {
        await bot.telegram.sendMessage(telegramId, message, {
            parse_mode: options?.parse_mode || 'HTML',
        });
        logger.info(`Message sent to ${telegramId}`);
        return true;
    } catch (error) {
        logger.error(`Failed to send message to ${telegramId}:`, error);
        return false;
    }
}

/**
 * Надіслати нагадування про звіт
 */
export async function sendReportReminder(user: User): Promise<boolean> {
    const lang = (user.language as Language) || 'uk';
    const message = t('notification.reminder', lang);
    return sendMessage(user.telegramId, message);
}

/**
 * Надіслати нагадування всім, хто не здав звіт
 */
export async function sendReminderToAll(): Promise<{ sent: number; failed: number }> {
    const weekNumber = getWeekNumber(new Date());
    const year = getCurrentYear();
    
    const usersWithoutReports = await getUsersWithoutReports(weekNumber, year);
    
    let sent = 0;
    let failed = 0;

    for (const user of usersWithoutReports) {
        const success = await sendReportReminder(user);
        if (success) {
            sent++;
        } else {
            failed++;
        }
        
        // Затримка між повідомленнями (уникнення rate limit)
        await new Promise(resolve => setTimeout(resolve, 100));
    }

    logger.info(`Reminders sent: ${sent} success, ${failed} failed`);
    return { sent, failed };
}

/**
 * Надіслати повідомлення менеджеру про новий звіт
 */
export async function notifyManagerAboutNewReport(
    manager: User,
    employee: User,
    reportData: {
        weekNumber: number;
        workload: number;
        completionRate: number;
    }
): Promise<boolean> {
    const lang = (manager.language as Language) || 'uk';
    const message = t('notification.new_report', lang, {
        name: employee.name,
        week: reportData.weekNumber,
        workload: reportData.workload,
        completed: reportData.completionRate,
    });
    
    return sendMessage(manager.telegramId, message);
}

/**
 * Надіслати повідомлення менеджеру про відсутній звіт
 */
export async function notifyManagerAboutMissingReport(
    manager: User,
    employee: User,
    weekNumber: number
): Promise<boolean> {
    const lang = (manager.language as Language) || 'uk';
    const message = t('notification.missing_report', lang, {
        name: employee.name,
        week: weekNumber,
    });
    
    return sendMessage(manager.telegramId, message);
}

/**
 * Надіслати повідомлення всім адмінам
 */
export async function notifyAdmins(message: string): Promise<void> {
    for (const adminId of config.admin.ids) {
        await sendMessage(adminId, message);
    }
}

// ============================================
// CRON JOBS
// ============================================

let reminderJob: cron.ScheduledTask | null = null;
let deadlineJob: cron.ScheduledTask | null = null;

/**
 * Запуск планувальника нагадувань
 */
export function startScheduler(): void {
    const { reminderDay, reminderTime, deadlineDay, deadlineTime } = config.report;
    const [reminderHour, reminderMinute] = reminderTime.split(':').map(Number);
    const [deadlineHour, deadlineMinute] = deadlineTime.split(':').map(Number);

    // Нагадування (наприклад, щоп'ятниці о 15:00)
    // Формат cron: "minute hour * * dayOfWeek"
    const reminderCron = `${reminderMinute} ${reminderHour} * * ${reminderDay}`;
    
    reminderJob = cron.schedule(reminderCron, async () => {
        logger.info('Running scheduled reminder job');
        try {
            const result = await sendReminderToAll();
            logger.info(`Reminder job completed: ${result.sent} sent, ${result.failed} failed`);
        } catch (error) {
            logger.error('Reminder job failed:', error);
        }
    }, {
        timezone: 'Europe/Kyiv',
    });

    // Перевірка дедлайну
    const deadlineCron = `${deadlineMinute} ${deadlineHour} * * ${deadlineDay}`;
    
    deadlineJob = cron.schedule(deadlineCron, async () => {
        logger.info('Running deadline check job');
        try {
            await checkDeadlineAndNotifyManagers();
        } catch (error) {
            logger.error('Deadline check job failed:', error);
        }
    }, {
        timezone: 'Europe/Kyiv',
    });

    logger.info(`Scheduler started: reminder at ${reminderTime} on day ${reminderDay}, deadline at ${deadlineTime} on day ${deadlineDay}`);
}

/**
 * Зупинка планувальника
 */
export function stopScheduler(): void {
    if (reminderJob) {
        reminderJob.stop();
        reminderJob = null;
    }
    if (deadlineJob) {
        deadlineJob.stop();
        deadlineJob = null;
    }
    logger.info('Scheduler stopped');
}

/**
 * Перевірка дедлайну та повідомлення менеджерів
 */
async function checkDeadlineAndNotifyManagers(): Promise<void> {
    const weekNumber = getWeekNumber(new Date());
    const year = getCurrentYear();
    
    const usersWithoutReports = await getUsersWithoutReports(weekNumber, year);
    
    // Групування за менеджерами
    const managerNotifications: Map<number, User[]> = new Map();
    
    for (const user of usersWithoutReports) {
        if (user.managerId) {
            const existing = managerNotifications.get(user.managerId) || [];
            existing.push(user);
            managerNotifications.set(user.managerId, existing);
        }
    }

    // Надсилання повідомлень менеджерам
    for (const [managerId, employees] of managerNotifications) {
        const manager = await userCrud.findById(managerId);
        if (manager) {
            const lang = (manager.language as Language) || 'uk';
            const employeeList = employees.map(e => e.name).join(', ');
            
            const message = lang === 'uk'
                ? `⚠️ **Дедлайн звітності**\n\nНаступні співробітники не надіслали звіт за тиждень ${weekNumber}:\n${employeeList}`
                : `⚠️ **Report Deadline**\n\nThe following employees haven't submitted reports for week ${weekNumber}:\n${employeeList}`;
            
            await sendMessage(manager.telegramId, message);
        }
    }
}

// ============================================
// MANUAL TRIGGERS
// ============================================

/**
 * Ручне надсилання нагадувань
 */
export async function triggerReminders(): Promise<{ sent: number; failed: number }> {
    logger.info('Manual reminder trigger');
    return sendReminderToAll();
}

/**
 * Тестове повідомлення
 */
export async function sendTestMessage(telegramId: number): Promise<boolean> {
    return sendMessage(telegramId, '✅ Тестове повідомлення від SAMI Reports Bot');
}

/**
 * Ініціалізація планувальника сповіщень з інстансом бота
 */
export function initNotificationScheduler(botInstance: Telegraf): void {
    setBotInstance(botInstance);
    startScheduler();
}

export default {
    setBotInstance,
    sendMessage,
    sendReportReminder,
    sendReminderToAll,
    notifyManagerAboutNewReport,
    notifyManagerAboutMissingReport,
    notifyAdmins,
    startScheduler,
    stopScheduler,
    triggerReminders,
    sendTestMessage,
    initNotificationScheduler,
};
