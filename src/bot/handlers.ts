/**
 * SAMI Weekly Reports - Bot Handlers
 * Обробники команд та повідомлень Telegram бота
 */

import { Context, Telegraf } from 'telegraf';
import { message } from 'telegraf/filters';
import { userCrud, reportCrud, statsCrud } from '../database/crud';
import { trelloService } from '../services/trello.service';
import { parsePdfReport, generatePdfReport } from '../services/pdf.service';
import { getTeamWeeklyStats, getUserStats, formatTeamStatsMessage, formatUserStatsMessage } from '../services/stats.service';
import { notifyManagerAboutNewReport, sendMessage, triggerReminders } from '../services/notification.service';
import { getWeekNumber, getCurrentYear, formatDate, formatWorkload, formatPosition, formatTeam } from '../utils/helpers';
import { validateReport } from '../utils/validators';
import { t } from '../utils/i18n';
import logger from '../utils/logger';
import config from '../config';
import keyboards from './keyboards';
import states from './states';
import type { 
    Language, 
    Position, 
    Team, 
    Workload, 
    CompletedTask, 
    NotCompletedTask,
    CreateReportDto 
} from '../types';
import fs from 'fs';
import path from 'path';
import axios from 'axios';

// Extended Context з даними користувача
interface BotContext extends Context {
    user?: {
        userId: number;
        telegramId: number;
        name: string;
        position: Position;
        team: Team;
        isManager: boolean;
        language: Language;
    };
}

/**
 * Перевірка чи є користувач адміном
 */
function isAdmin(telegramId: number): boolean {
    return config.admin.ids.includes(telegramId);
}

/**
 * Налаштування обробників бота
 */
export function setupHandlers(bot: Telegraf<BotContext>): void {
    // Middleware для перевірки доступу — тільки зареєстровані користувачі та адміни
    bot.use(async (ctx, next) => {
        if (ctx.from) {
            try {
                const telegramId = ctx.from.id;
                const admin = isAdmin(telegramId);

                // Шукаємо користувача в БД
                let user = await userCrud.findByTelegramId(telegramId);

                // Адмін, якого ще немає в БД — створюємо автоматично
                if (!user && admin) {
                    user = await userCrud.findOrCreate(
                        telegramId,
                        ctx.from.first_name + (ctx.from.last_name ? ' ' + ctx.from.last_name : '')
                    );
                }

                // Якщо користувача немає в БД і він не адмін — доступ заборонено
                if (!user) {
                    logger.info(`Access denied for unknown user: ${telegramId} (${ctx.from.first_name})`);
                    await ctx.reply(
                        '🚫 У вас немає доступу до цього бота.\nЗверніться до адміністратора для отримання доступу: @vitalii_sami\n\n'
                        + '🚫 You do not have access to this bot.\nContact the administrator to get access: @vitalii_sami'
                    );
                    return; // Не викликаємо next() — блокуємо
                }

                ctx.user = {
                    userId: user.userId,
                    telegramId: user.telegramId,
                    name: user.name,
                    position: user.position as Position,
                    team: user.team as Team,
                    isManager: user.isManager,
                    language: (user.language as Language) || 'uk',
                };
            } catch (error) {
                logger.error('Error in user middleware:', error);
            }
        }
        return next();
    });

    // ============================================
    // КОМАНДИ
    // ============================================

    // /start
    bot.command('start', async (ctx) => {
        const lang = ctx.user?.language || 'uk';
        const name = ctx.user?.name || ctx.from?.first_name || 'User';
        const userIsAdmin = isAdmin(ctx.from!.id);
        
        await ctx.reply(
            t('bot.start.welcome', lang, { name }),
            keyboards.mainMenu(lang, userIsAdmin)
        );
    });

    // /help
    bot.command('help', async (ctx) => {
        const lang = ctx.user?.language || 'uk';
        await ctx.reply(
            t('bot.help.message', lang),
            { parse_mode: 'Markdown' }
        );
    });

    // /report - Почати створення звіту
    bot.command('report', handleReportStart);
    bot.hears(['📝 Створити звіт', '📝 Create Report'], handleReportStart);

    // /sendpdf - Надіслати PDF
    bot.command('sendpdf', handleSendPdf);
    bot.hears(['📄 Надіслати PDF', '📄 Send PDF'], handleSendPdf);

    // /myreports - Мої звіти
    bot.command('myreports', handleMyReports);
    bot.hears(['📊 Мої звіти', '📊 My Reports'], handleMyReports);

    // /stats - Статистика
    bot.command('stats', handleStats);
    bot.hears(['📈 Статистика', '📈 Statistics'], handleStats);


    // /adminstats - Адмін статистика
    bot.command('adminstats', handleAdminStats);
    bot.hears(['👥 Статистика користувачів', '👥 User Statistics'], handleAdminStats);

    // /adduser - Додати користувача (адмін)
    bot.command('adduser', handleAddUserStart);
    bot.hears(['➕ Додати користувача', '➕ Add User'], handleAddUserStart);

    // /broadcast - Розсилка всім (адмін)
    bot.command('broadcast', handleBroadcastStart);
    bot.hears(['📢 Розсилка', '📢 Broadcast'], handleBroadcastStart);

    // /dm - Написати юзеру (адмін)
    bot.command('dm', handleDmStart);
    bot.hears(['✉️ Написати юзеру', '✉️ Message User'], handleDmStart);

    // /remind - Примусово нагадати всім (адмін)
    bot.command('remind', handleManualRemind);
// Стан для додавання користувача (TTL: 10 хвилин)
const ADD_USER_TTL = 10 * 60 * 1000;
const addUserStates = new Map<number, { step: 'idle'|'telegramId'|'name', telegramId?: number, createdAt: number }>();

// Очищення протермінованих станів додавання
setInterval(() => {
    const now = Date.now();
    for (const [key, value] of addUserStates.entries()) {
        if (now - value.createdAt > ADD_USER_TTL) {
            addUserStates.delete(key);
        }
    }
}, 5 * 60 * 1000);

/**
 * Почати діалог додавання користувача (адмін)
 */
async function handleAddUserStart(ctx: BotContext): Promise<void> {
    const lang = ctx.user?.language || 'uk';
    const telegramId = ctx.from?.id;
    if (!telegramId || !isAdmin(telegramId)) {
        await ctx.reply(t('bot.admin_stats.access_denied', lang));
        return;
    }
    addUserStates.set(telegramId, { step: 'telegramId', createdAt: Date.now() });
    await ctx.reply(
        lang === 'uk' ? 'Введіть Telegram ID нового користувача:' : 'Enter new user Telegram ID:'
    );
}

// Обробка тексту для діалогу додавання користувача
// (має бути після основного bot.on(message('text'), ...))
bot.on(message('text'), async (ctx, next) => {
    const adminId = ctx.from?.id;
    if (!adminId || !isAdmin(adminId)) return next();
    const state = addUserStates.get(adminId);
    if (!state || state.step === 'idle') return next();
    const lang = ctx.user?.language || 'uk';
    const text = ctx.message.text.trim();

    if (state.step === 'telegramId') {
        const tgId = Number(text);
        if (!tgId || isNaN(tgId) || tgId < 1) {
            await ctx.reply(lang === 'uk' ? '❌ Некоректний Telegram ID. Спробуйте ще раз:' : '❌ Invalid Telegram ID. Try again:');
            return;
        }
        state.telegramId = tgId;
        state.step = 'name';
        addUserStates.set(adminId, state);
        await ctx.reply(lang === 'uk' ? 'Введіть імʼя користувача:' : 'Enter user name:');
        return;
    }
    if (state.step === 'name') {
        const name = text;
        if (!name || name.length < 2) {
            await ctx.reply(lang === 'uk' ? '❌ Некоректне імʼя. Спробуйте ще раз:' : '❌ Invalid name. Try again:');
            return;
        }
        // Спроба створити користувача
        try {
            const exists = await userCrud.findByTelegramId(state.telegramId!);
            if (exists) {
                await ctx.reply(lang === 'uk' ? '❗️ Користувач з цим Telegram ID вже існує.' : '❗️ User with this Telegram ID already exists.');
                addUserStates.set(adminId, { step: 'idle', createdAt: Date.now() });
                return;
            }
            await userCrud.create({ telegramId: state.telegramId!, name });
            await ctx.reply(lang === 'uk' ? '✅ Користувача додано!' : '✅ User added!');
        } catch (e) {
            await ctx.reply(lang === 'uk' ? '❌ Помилка при додаванні користувача.' : '❌ Error adding user.');
        }
        addUserStates.set(adminId, { step: 'idle', createdAt: Date.now() });
        return;
    }
    return next();
});

// ============================================
// РОЗСИЛКА ПОВІДОМЛЕНЬ (BROADCAST) - адмін
// ============================================

const BROADCAST_TTL = 10 * 60 * 1000;
const broadcastStates = new Map<number, { step: 'message' | 'confirm' | 'idle'; text?: string; createdAt: number }>();

// Очищення протермінованих станів розсилки
setInterval(() => {
    const now = Date.now();
    for (const [key, value] of broadcastStates.entries()) {
        if (now - value.createdAt > BROADCAST_TTL) {
            broadcastStates.delete(key);
        }
    }
}, 5 * 60 * 1000);

/**
 * Початок розсилки (адмін)
 */
async function handleBroadcastStart(ctx: BotContext): Promise<void> {
    const lang = ctx.user?.language || 'uk';
    const telegramId = ctx.from?.id;
    if (!telegramId || !isAdmin(telegramId)) {
        await ctx.reply(t('bot.admin_stats.access_denied', lang));
        return;
    }

    broadcastStates.set(telegramId, { step: 'message', createdAt: Date.now() });
    await ctx.reply(
        lang === 'uk'
            ? '📢 *Розсилка повідомлення всім користувачам*\n\nВведіть текст повідомлення (або /cancel для скасування):'
            : '📢 *Broadcast message to all users*\n\nEnter message text (or /cancel to abort):',
        { parse_mode: 'Markdown', ...keyboards.cancelKeyboard(lang) }
    );
}

// Обробка тексту для розсилки
bot.on(message('text'), async (ctx, next) => {
    const adminId = ctx.from?.id;
    if (!adminId || !isAdmin(adminId)) return next();
    const state = broadcastStates.get(adminId);
    if (!state || state.step === 'idle') return next();
    const lang = ctx.user?.language || 'uk';
    const text = ctx.message.text.trim();

    if (text === '/cancel' || text === '❌ Скасувати' || text === '❌ Cancel') {
        broadcastStates.set(adminId, { step: 'idle', createdAt: Date.now() });
        const userIsAdmin = isAdmin(adminId);
        await ctx.reply(
            lang === 'uk' ? '🏠 Розсилку скасовано' : '🏠 Broadcast cancelled',
            keyboards.mainMenu(lang, userIsAdmin)
        );
        return;
    }

    if (state.step === 'message') {
        state.text = text;
        state.step = 'confirm';
        broadcastStates.set(adminId, state);

        const allUsers = await userCrud.findAll();
        await ctx.reply(
            lang === 'uk'
                ? `📢 *Підтвердження розсилки*\n\nПовідомлення:\n\n${text}\n\n👥 Отримувачі: ${allUsers.length} користувачів\n\nНадіслати?`
                : `📢 *Broadcast confirmation*\n\nMessage:\n\n${text}\n\n👥 Recipients: ${allUsers.length} users\n\nSend?`,
            { parse_mode: 'Markdown', ...keyboards.yesNoKeyboard(lang) }
        );
        return;
    }

    if (state.step === 'confirm') {
        const userIsAdmin = isAdmin(adminId);
        if (text === '✅ Так' || text === '✅ Yes') {
            const allUsers = await userCrud.findAll();
            let sent = 0;
            let failed = 0;

            await ctx.reply(lang === 'uk' ? '⏳ Надсилаю...' : '⏳ Sending...');

            for (const user of allUsers) {
                try {
                    const success = await sendMessage(
                        user.telegramId,
                        `📢 *Повідомлення від адміністратора:*\n\n${state.text}`,
                        { parse_mode: 'Markdown' }
                    );
                    if (success) sent++; else failed++;
                } catch {
                    failed++;
                }
                // Затримка проти rate limit
                await new Promise(r => setTimeout(r, 100));
            }

            await ctx.reply(
                lang === 'uk'
                    ? `✅ Розсилку завершено!\n\n📨 Надіслано: ${sent}\n❌ Помилок: ${failed}`
                    : `✅ Broadcast complete!\n\n📨 Sent: ${sent}\n❌ Failed: ${failed}`,
                keyboards.mainMenu(lang, userIsAdmin)
            );
            logger.info(`Broadcast by admin ${adminId}: sent=${sent}, failed=${failed}`);
        } else {
            await ctx.reply(
                lang === 'uk' ? '🏠 Розсилку скасовано' : '🏠 Broadcast cancelled',
                keyboards.mainMenu(lang, userIsAdmin)
            );
        }
        broadcastStates.set(adminId, { step: 'idle', createdAt: Date.now() });
        return;
    }

    return next();
});

// ============================================
// ОСОБИСТЕ ПОВІДОМЛЕННЯ ЮЗЕРУ (DM) - адмін
// ============================================

const DM_TTL = 10 * 60 * 1000;
const dmStates = new Map<number, { step: 'selectUser' | 'message' | 'idle'; targetUserId?: number; targetName?: string; createdAt: number }>();

// Очищення протермінованих станів DM
setInterval(() => {
    const now = Date.now();
    for (const [key, value] of dmStates.entries()) {
        if (now - value.createdAt > DM_TTL) {
            dmStates.delete(key);
        }
    }
}, 5 * 60 * 1000);

/**
 * Початок надсилання особистого повідомлення (адмін)
 */
async function handleDmStart(ctx: BotContext): Promise<void> {
    const lang = ctx.user?.language || 'uk';
    const telegramId = ctx.from?.id;
    if (!telegramId || !isAdmin(telegramId)) {
        await ctx.reply(t('bot.admin_stats.access_denied', lang));
        return;
    }

    // Показати список користувачів
    const allUsers = await userCrud.findAll();
    if (allUsers.length === 0) {
        await ctx.reply(lang === 'uk' ? '❌ Немає зареєстрованих користувачів.' : '❌ No registered users.');
        return;
    }

    const userList = allUsers.map((u, i) => `${i + 1}. ${u.name} (ID: ${u.telegramId})`).join('\n');

    dmStates.set(telegramId, { step: 'selectUser', createdAt: Date.now() });
    await ctx.reply(
        lang === 'uk'
            ? `✉️ *Надіслати повідомлення користувачу*\n\nОберіть користувача (введіть номер або Telegram ID):\n\n${userList}\n\n/cancel — скасувати`
            : `✉️ *Send message to user*\n\nSelect user (enter number or Telegram ID):\n\n${userList}\n\n/cancel — cancel`,
        { parse_mode: 'Markdown', ...keyboards.cancelKeyboard(lang) }
    );
}

// Обробка тексту для DM
bot.on(message('text'), async (ctx, next) => {
    const adminId = ctx.from?.id;
    if (!adminId || !isAdmin(adminId)) return next();
    const state = dmStates.get(adminId);
    if (!state || state.step === 'idle') return next();
    const lang = ctx.user?.language || 'uk';
    const text = ctx.message.text.trim();

    if (text === '/cancel' || text === '❌ Скасувати' || text === '❌ Cancel') {
        dmStates.set(adminId, { step: 'idle', createdAt: Date.now() });
        const userIsAdmin = isAdmin(adminId);
        await ctx.reply(
            lang === 'uk' ? '🏠 Скасовано' : '🏠 Cancelled',
            keyboards.mainMenu(lang, userIsAdmin)
        );
        return;
    }

    if (state.step === 'selectUser') {
        const allUsers = await userCrud.findAll();
        let targetUser = null;

        // Спробувати за номером у списку
        const num = parseInt(text, 10);
        if (num >= 1 && num <= allUsers.length) {
            targetUser = allUsers[num - 1];
        } else {
            // Спробувати за Telegram ID
            targetUser = allUsers.find(u => u.telegramId === num) || null;
        }

        if (!targetUser) {
            await ctx.reply(
                lang === 'uk'
                    ? '❌ Користувача не знайдено. Введіть номер зі списку або Telegram ID:'
                    : '❌ User not found. Enter number from list or Telegram ID:'
            );
            return;
        }

        state.targetUserId = targetUser.telegramId;
        state.targetName = targetUser.name;
        state.step = 'message';
        dmStates.set(adminId, state);

        await ctx.reply(
            lang === 'uk'
                ? `✉️ Обрано: *${targetUser.name}*\n\nВведіть повідомлення:`
                : `✉️ Selected: *${targetUser.name}*\n\nEnter message:`,
            { parse_mode: 'Markdown' }
        );
        return;
    }

    if (state.step === 'message') {
        const userIsAdmin = isAdmin(adminId);
        try {
            const success = await sendMessage(
                state.targetUserId!,
                `✉️ *Повідомлення від адміністратора:*\n\n${text}`,
                { parse_mode: 'Markdown' }
            );

            if (success) {
                await ctx.reply(
                    lang === 'uk'
                        ? `✅ Повідомлення надіслано користувачу *${state.targetName}*`
                        : `✅ Message sent to *${state.targetName}*`,
                    { parse_mode: 'Markdown', ...keyboards.mainMenu(lang, userIsAdmin) }
                );
                logger.info(`Admin ${adminId} sent DM to ${state.targetUserId} (${state.targetName})`);
            } else {
                await ctx.reply(
                    lang === 'uk'
                        ? `❌ Не вдалося надіслати повідомлення. Можливо, користувач заблокував бота.`
                        : `❌ Failed to send message. User may have blocked the bot.`,
                    keyboards.mainMenu(lang, userIsAdmin)
                );
            }
        } catch {
            await ctx.reply(
                lang === 'uk' ? '❌ Помилка надсилання.' : '❌ Send error.',
                keyboards.mainMenu(lang, userIsAdmin)
            );
        }
        dmStates.set(adminId, { step: 'idle', createdAt: Date.now() });
        return;
    }

    return next();
});

// Примусове нагадування (адмін)
async function handleManualRemind(ctx: BotContext): Promise<void> {
    const lang = ctx.user?.language || 'uk';
    const telegramId = ctx.from?.id;
    if (!telegramId || !isAdmin(telegramId)) {
        await ctx.reply(t('bot.admin_stats.access_denied', lang));
        return;
    }
    try {
        await ctx.reply(lang === 'uk' ? '⏳ Надсилаю нагадування...' : '⏳ Sending reminders...');
        await triggerReminders();
        await ctx.reply(
            lang === 'uk' ? '✅ Нагадування надіслано!' : '✅ Reminders sent!',
            keyboards.mainMenu(lang, true)
        );
    } catch (error) {
        logger.error('Manual remind error:', error);
        await ctx.reply(
            lang === 'uk' ? '❌ Помилка при надсиланні нагадувань.' : '❌ Error sending reminders.',
            keyboards.mainMenu(lang, true)
        );
    }
}

    // /team - Звіти команди (для менеджерів)
    bot.command('team', handleTeamReports);

    // /cancel - Скасувати
    bot.command('cancel', handleCancel);
    bot.hears(['❌ Скасувати', '❌ Cancel'], handleCancel);

    // /template - Шаблони
    bot.command('template', handleTemplates);
    bot.hears(['📋 Шаблони', '📋 Templates'], handleTemplates);

    // Кнопки для завантаження шаблонів
    bot.hears(['📝 Шаблон Word', '📝 Word Template'], handleWordTemplate);
    bot.hears(['◀️ Назад', '◀️ Back'], async (ctx) => {
        const lang = ctx.user?.language || 'uk';
        const userIsAdmin = isAdmin(ctx.from!.id);
        await ctx.reply(
            lang === 'uk' ? '🏠 Головне меню' : '🏠 Main menu',
            keyboards.mainMenu(lang, userIsAdmin)
        );
    });

    // ============================================
    // ОБРОБКА ФОРМИ ЗВІТУ
    // ============================================

    // Обробка текстових повідомлень під час заповнення форми
    bot.on(message('text'), async (ctx, next) => {
        const userId = ctx.from.id;
        const state = states.getState(userId);
        
        if (!state || state.step === 'done') {
            return next();
        }

        const text = ctx.message.text;
        const lang = ctx.user?.language || 'uk';

        try {
            await handleFormInput(ctx, state, text, lang);
        } catch (error) {
            logger.error('Error handling form input:', error);
            await ctx.reply(t('common.error', lang));
        }
    });

    // Обробка PDF файлів
    bot.on(message('document'), async (ctx) => {
        const document = ctx.message.document;
        const fileName = document.file_name?.toLowerCase() || '';
        const lang = ctx.user?.language || 'uk';
        
        if (fileName.endsWith('.pdf')) {
            await handlePdfUpload(ctx, document);
        } else if (fileName.endsWith('.docx') || fileName.endsWith('.xlsx')) {
            await ctx.reply(
                lang === 'uk'
                    ? '📝 Дякую за файл! Наразі система підтримує лише PDF для автоматичного парсингу.\n\n' +
                      'Ви можете:\n' +
                      '• Конвертувати Word/Excel у PDF і надіслати\n' +
                      '• Або створити звіт через бота: /report'
                    : '📝 Thanks for the file! Currently the system only supports PDF for automatic parsing.\n\n' +
                      'You can:\n' +
                      '• Convert Word/Excel to PDF and send\n' +
                      '• Or create a report via bot: /report'
            );
        } else {
            await ctx.reply(
                lang === 'uk' 
                    ? '⚠️ Будь ласка, надішліть PDF файл' 
                    : '⚠️ Please send a PDF file'
            );
        }
    });

    // ============================================
    // CALLBACK QUERIES
    // ============================================

    // PDF update actions
    bot.hears(['➕ Доповнити', '➕ Append'], async (ctx) => {
        await handlePdfUpdateAction(ctx, 'append');
    });
    bot.hears(['🔄 Замінити', '🔄 Replace'], async (ctx) => {
        await handlePdfUpdateAction(ctx, 'replace');
    });

    // Експорт PDF
    bot.action(/^export_pdf:(\d+)$/, async (ctx) => {
        const reportId = parseInt(ctx.match[1], 10);
        await handleExportPdf(ctx, reportId);
    });

    // Статистика команди
    bot.action(/^team_stats:(\w+)$/, async (ctx) => {
        const team = ctx.match[1] as Team;
        await handleTeamStatsCallback(ctx, team);
    });

    // Вибір мови
    bot.action(/^set_lang:(\w+)$/, async (ctx) => {
        const lang = ctx.match[1] as Language;
        await handleSetLanguage(ctx, lang);
    });

    // Пагінація звітів
    bot.action(/^reports_page:(\d+)$/, async (ctx) => {
        const page = parseInt(ctx.match[1], 10);
        await handleReportsPage(ctx, page);
    });

    logger.info('Bot handlers setup complete');
}

// ============================================
// HANDLER IMPLEMENTATIONS
// ============================================

/**
 * Початок створення звіту
 */
async function handleReportStart(ctx: BotContext): Promise<void> {
    const userId = ctx.from!.id;
    const lang = ctx.user?.language || 'uk';
    const weekNumber = getWeekNumber(new Date());
    const year = getCurrentYear();

    // Перевірка наявності користувача
    if (!ctx.user || !ctx.user.userId) {
        await ctx.reply(
            lang === 'uk' 
                ? '⚠️ Помилка авторизації. Напишіть /start для початку.'
                : '⚠️ Authorization error. Type /start to begin.',
            keyboards.mainMenu(lang, isAdmin(ctx.from!.id))
        );
        return;
    }

    // Перевірити чи є активний стан форми
    const currentState = states.getState(userId);
    if (currentState && currentState.step === 'start') {
        // Користувач вже на етапі підтвердження - нагадати
        await ctx.reply(
            lang === 'uk' 
                ? '⚠️ Оберіть дію: Доповнити, Замінити або Скасувати'
                : '⚠️ Choose action: Append, Replace or Cancel',
            keyboards.updateReportKeyboard(lang)
        );
        return;
    }
    
    // Очистити попередній стан перед початком нової форми
    states.clearState(userId);

    // Перевірити чи вже є звіт за цей тиждень
    const existingReport = await reportCrud.findByUserAndWeek(ctx.user.userId, weekNumber, year);
    if (existingReport) {
        // Показати що вже є в звіті
        const completedTasks = (existingReport as any).completedTasks || [];
        const notCompletedTasks = (existingReport as any).notCompletedTasks || [];
        
        let summary = lang === 'uk' 
            ? `📋 **У вас вже є звіт за тиждень ${weekNumber}/${year}:**\n\n`
            : `📋 **You already have a report for week ${weekNumber}/${year}:**\n\n`;
        
        summary += lang === 'uk' 
            ? `📊 Навантаження: ${existingReport.workload}/5\n`
            : `📊 Workload: ${existingReport.workload}/5\n`;
        
        if (completedTasks.length > 0) {
            summary += lang === 'uk' ? `\n✅ Виконано (${completedTasks.length}):\n` : `\n✅ Completed (${completedTasks.length}):\n`;
            completedTasks.forEach((task: any, i: number) => {
                summary += `  ${i + 1}. ${task.title} - ${task.hours}h\n`;
            });
        }
        
        if (notCompletedTasks.length > 0) {
            summary += lang === 'uk' ? `\n⛔️ Не виконано (${notCompletedTasks.length}):\n` : `\n⛔️ Not completed (${notCompletedTasks.length}):\n`;
            notCompletedTasks.forEach((task: any, i: number) => {
                summary += `  ${i + 1}. ${task.title}\n`;
            });
        }
        
        if (existingReport.concerns) {
            summary += lang === 'uk' ? `\n💬 Коментар: ${existingReport.concerns}\n` : `\n💬 Comment: ${existingReport.concerns}\n`;
        }
        
        summary += lang === 'uk' 
            ? '\n\n**Що бажаєте зробити?**\n➕ Доповнити - додати нові задачі\n🔄 Замінити - почати заново'
            : '\n\n**What would you like to do?**\n➕ Append - add new tasks\n🔄 Replace - start over';
        
        await ctx.reply(summary, { parse_mode: 'Markdown' });
        await ctx.reply(
            lang === 'uk' ? 'Оберіть дію:' : 'Choose action:',
            keyboards.updateReportKeyboard(lang)
        );
        
        states.setState(userId, {
            step: 'start',
            data: { 
                weekNumber, 
                year,
                existingReportId: existingReport.reportId,
                existingTrelloCardId: existingReport.trelloCardId || undefined,
            },
            completedTasks: completedTasks.map((t: any) => ({ title: t.title, hours: t.hours, project: t.project })),
            notCompletedTasks: notCompletedTasks.map((t: any) => ({ 
                title: t.title, 
                reason: t.reason, 
                eta: t.eta,
                blocker: t.blocker 
            })),
        });
        return;
    }

    // Почати нову форму - спершу питаємо ПІБ
    states.setState(userId, {
        step: 'enter_name',
        data: { 
            userId: ctx.user!.userId,
            weekNumber, 
            year 
        },
        completedTasks: [],
        notCompletedTasks: [],
        currentTask: {},
    });

    await ctx.reply(
        t('bot.report.start', lang, { week: weekNumber, year }),
        keyboards.removeKeyboard()
    );

    await ctx.reply(
        lang === 'uk' ? '👤 Введіть ваше ПІБ:' : '👤 Enter your full name:',
        keyboards.cancelKeyboard(lang)
    );
}

/**
 * Обробка введення форми
 */
async function handleFormInput(
    ctx: BotContext, 
    state: ReturnType<typeof states.getState>,
    text: string,
    lang: Language
): Promise<void> {
    const userId = ctx.from!.id;
    
    // Нормалізуємо текст для порівняння
    const normalizedText = text.trim().toLowerCase();

    // Перевірка на скасування (гнучка перевірка)
    if (text.includes('❌') && (normalizedText.includes('скасувати') || normalizedText.includes('cancel'))) {
        states.clearState(userId);
        await ctx.reply(
            t('bot.report.cancelled', lang),
            keyboards.mainMenu(lang, isAdmin(ctx.from!.id))
        );
        return;
    }

    // Перевірка на пропуск
    const isSkip = text.includes('⏭') || normalizedText.includes('пропустити') || normalizedText.includes('skip');

    switch (state!.step) {
        // Початок - вибір дії якщо звіт вже існує
        case 'start':
            // Логування для дебагу
            logger.info(`[start] User ${userId} input: "${text}", normalized: "${normalizedText}"`);
            
            // Перевіряємо нові опції
            const isAppend = normalizedText.includes('доповнити') || normalizedText.includes('append') || text.includes('➕');
            const isReplace = normalizedText.includes('замінити') || normalizedText.includes('replace') || text.includes('🔄');
            
            logger.info(`[start] isAppend=${isAppend}, isReplace=${isReplace}`);
            
            if (isAppend) {
                // Режим доповнення - зберігаємо існуючі задачі
                state!.data.isUpdate = true;
                states.nextStep(userId, 'enter_name');
                await ctx.reply(
                    lang === 'uk' ? '👤 Введіть ваше ПІБ:' : '👤 Enter your full name:',
                    keyboards.cancelKeyboard(lang)
                );
            } else if (isReplace) {
                // Режим заміни - видаляємо старий звіт
                if (state!.data.existingReportId) {
                    try {
                        await reportCrud.deleteReport(state!.data.existingReportId);
                        logger.info(`Deleted old report ${state!.data.existingReportId} for replacement`);
                    } catch (err) {
                        logger.error('Error deleting old report:', err);
                    }
                }
                // Очищуємо задачі і починаємо заново
                state!.completedTasks = [];
                state!.notCompletedTasks = [];
                state!.data.existingReportId = undefined;
                state!.data.existingTrelloCardId = undefined;
                state!.data.isUpdate = false;
                states.nextStep(userId, 'enter_name');
                await ctx.reply(
                    lang === 'uk' ? '👤 Введіть ваше ПІБ:' : '👤 Enter your full name:',
                    keyboards.cancelKeyboard(lang)
                );
            } else {
                // Невідомий текст - попросити обрати кнопку
                await ctx.reply(
                    lang === 'uk' 
                        ? 'Будь ласка, оберіть дію: ➕ Доповнити, 🔄 Замінити або ❌ Скасувати'
                        : 'Please choose action: ➕ Append, 🔄 Replace or ❌ Cancel',
                    keyboards.updateReportKeyboard(lang)
                );
            }
            break;
        
        // Введення ПІБ
        case 'enter_name':
            state!.data.reporterName = text.trim();
            states.nextStep(userId, 'enter_position');
            await ctx.reply(
                lang === 'uk' ? '💼 Введіть вашу посаду:' : '💼 Enter your position:',
                keyboards.cancelKeyboard(lang)
            );
            break;
        
        // Введення посади
        case 'enter_position':
            state!.data.reporterPosition = text.trim();
            states.nextStep(userId, 'completed_task_title');
            state!.currentTask = {};
            await ctx.reply(
                t('bot.report.completed_title', lang, { num: 1 }),
                keyboards.cancelKeyboard(lang)
            );
            break;

        // Назва виконаної задачі
        case 'completed_task_title':
            if (!state!.currentTask) state!.currentTask = {};
            (state!.currentTask as Partial<CompletedTask>).title = text;
            // Переходимо одразу до годин (без проєкту)
            states.nextStep(userId, 'completed_task_hours');
            await ctx.reply(t('bot.report.completed_hours', lang));
            break;

        // Години виконаної задачі
        case 'completed_task_hours':
            const hours = parseFloat(text.replace(',', '.'));
            if (isNaN(hours) || hours < 0) {
                await ctx.reply(t('common.invalid_input', lang));
                return;
            }
            (state!.currentTask as Partial<CompletedTask>).hours = hours;
            
            // Зберегти задачу
            states.addCompletedTask(userId, state!.currentTask as CompletedTask);
            states.nextStep(userId, 'completed_tasks_more');
            
            await ctx.reply(
                t('bot.report.completed_more', lang),
                keyboards.addMoreKeyboard(lang)
            );
            break;

        // Додати ще виконану задачу?
        case 'completed_tasks_more':
            if (text.includes('Додати') || text.includes('Add')) {
                state!.currentTask = {};
                states.nextStep(userId, 'completed_task_title');
                await ctx.reply(
                    t('bot.report.completed_title', lang, { num: state!.completedTasks.length + 1 })
                );
            } else {
                // Перейти до невиконаних задач
                states.nextStep(userId, 'not_completed_tasks');
                await ctx.reply(
                    lang === 'uk' 
                        ? '❌ Чи є НЕвиконані задачі?' 
                        : '❌ Any NOT completed tasks?',
                    keyboards.yesNoKeyboard(lang)
                );
            }
            break;

        // Чи є невиконані задачі?
        case 'not_completed_tasks': {
            // Перевіряємо чи користувач відмовився
            const hasNoNotCompleted = normalizedText.includes('ні') || normalizedText.includes('no') || 
                                     text.includes('❌') || normalizedText.includes('готово');
            
            if (hasNoNotCompleted) {
                // Перейти до навантаження
                states.nextStep(userId, 'workload');
                await ctx.reply(
                    t('bot.report.workload', lang),
                    keyboards.workloadKeyboard(lang)
                );
            } else {
                // Якщо користувач натиснув "Так" - запитуємо назву задачі
                const confirmedYes = normalizedText.includes('так') || normalizedText.includes('yes') || text.includes('✅');
                if (confirmedYes) {
                    state!.currentTask = {};
                    states.nextStep(userId, 'not_completed_task_title');
                    await ctx.reply(t('bot.report.not_completed_title', lang, { num: 1 }));
                } else {
                    // Якщо введено текст - це вже назва першої задачі
                    state!.currentTask = { title: text };
                    states.nextStep(userId, 'not_completed_task_reason');
                    await ctx.reply(t('bot.report.not_completed_reason', lang));
                }
            }
            break;
        }

        // Назва невиконаної задачі
        case 'not_completed_task_title':
            if (!state!.currentTask) state!.currentTask = {};
            (state!.currentTask as Partial<NotCompletedTask>).title = text;
            states.nextStep(userId, 'not_completed_task_reason');
            await ctx.reply(t('bot.report.not_completed_reason', lang));
            break;

        // Причина невиконання
        case 'not_completed_task_reason':
            (state!.currentTask as Partial<NotCompletedTask>).reason = text;
            states.nextStep(userId, 'not_completed_task_eta');
            await ctx.reply(
                t('bot.report.not_completed_eta', lang),
                keyboards.skipKeyboard(lang)
            );
            break;

        // ETA невиконаної задачі
        case 'not_completed_task_eta':
            if (!isSkip) {
                const etaDate = parseDate(text);
                if (etaDate) {
                    (state!.currentTask as Partial<NotCompletedTask>).eta = etaDate;
                }
            }
            
            // Зберегти задачу (без blocker)
            states.addNotCompletedTask(userId, state!.currentTask as NotCompletedTask);
            states.nextStep(userId, 'not_completed_tasks_more');
            
            await ctx.reply(
                t('bot.report.not_completed_more', lang),
                keyboards.addMoreKeyboard(lang)
            );
            break;

        // Додати ще невиконану задачу?
        case 'not_completed_tasks_more':
            if (text.includes('Додати') || text.includes('Add')) {
                state!.currentTask = {};
                states.nextStep(userId, 'not_completed_task_title');
                await ctx.reply(
                    t('bot.report.not_completed_title', lang, { num: state!.notCompletedTasks.length + 1 })
                );
            } else {
                // Перейти до навантаження
                states.nextStep(userId, 'workload');
                await ctx.reply(
                    t('bot.report.workload', lang),
                    keyboards.workloadKeyboard(lang)
                );
            }
            break;

        // Навантаження
        case 'workload':
            const workloadMatch = text.match(/([1-5])/);
            if (!workloadMatch) {
                await ctx.reply(t('common.invalid_input', lang));
                return;
            }
            state!.data.workload = parseInt(workloadMatch[1], 10) as Workload;
            states.nextStep(userId, 'concerns');
            await ctx.reply(
                t('bot.report.concerns', lang),
                keyboards.skipKeyboard(lang)
            );
            break;

        // Що турбує / що покращити (об'єднано)
        case 'concerns':
            if (!isSkip && text.trim()) {
                state!.data.concerns = text;
            }
            
            // Показати підсумок (без improvements та priorities)
            states.nextStep(userId, 'confirm');
            const summary = formatReportSummary(state!, lang);
            await ctx.reply(
                t('bot.report.confirm', lang, { summary }),
                keyboards.confirmReportKeyboard(lang)
            );
            break;

        // Підтвердження
        case 'confirm':
            if (text.includes('Підтвердити') || text.includes('Confirm')) {
                await submitReport(ctx, state!, lang);
            } else if (text.includes('Редагувати') || text.includes('Edit')) {
                // Повернутися до початку
                states.nextStep(userId, 'completed_task_title');
                state!.completedTasks = [];
                state!.notCompletedTasks = [];
                state!.currentTask = {};
                await ctx.reply(t('bot.report.completed_title', lang, { num: 1 }));
            } else {
                states.clearState(userId);
                await ctx.reply(
                    t('bot.report.cancelled', lang),
                    keyboards.mainMenu(lang, isAdmin(ctx.from!.id))
                );
            }
            break;
    }

    // НЕ оновлюємо стан тут - він вже оновлюється через states.nextStep() та інші функції
}

/**
 * Форматування підсумку звіту
 */
function formatReportSummary(
    state: ReturnType<typeof states.getState>, 
    lang: Language
): string {
    let summary = '';
    
    // ПІБ та посада з форми
    summary += `👤 ${state!.data.reporterName || 'Не вказано'}\n`;
    summary += `💼 ${state!.data.reporterPosition || 'Не вказано'}\n\n`;
    
    summary += `📅 ${lang === 'uk' ? 'Тиждень' : 'Week'}: ${state!.data.weekNumber}/${state!.data.year}\n`;
    summary += `📊 ${lang === 'uk' ? 'Навантаження' : 'Workload'}: ${state!.data.workload}/5\n\n`;
    
    if (state!.completedTasks.length > 0) {
        summary += `✅ ${lang === 'uk' ? 'Виконано' : 'Completed'} (${state!.completedTasks.length}):\n`;
        state!.completedTasks.forEach((task, i) => {
            summary += `  ${i + 1}. ${task.title} - ${task.hours}h\n`;
        });
        summary += '\n';
    }
    
    if (state!.notCompletedTasks.length > 0) {
        summary += `⛔️ ${lang === 'uk' ? 'Не виконано' : 'Not completed'} (${state!.notCompletedTasks.length}):\n`;
        state!.notCompletedTasks.forEach((task, i) => {
            let line = `  ${i + 1}. ${task.title}`;
            if (task.reason) line += ` | ${lang === 'uk' ? 'Причина' : 'Reason'}: ${task.reason}`;
            if (task.eta) {
                const etaDate = task.eta instanceof Date ? task.eta : new Date(task.eta);
                line += ` | ${lang === 'uk' ? 'Термін' : 'ETA'}: ${etaDate.toLocaleDateString('uk-UA')}`;
            }
            summary += line + '\n';
        });
        summary += '\n';
    }
    
    if (state!.data.concerns) {
        summary += `💬 ${lang === 'uk' ? 'Коментар' : 'Comment'}: ${state!.data.concerns}\n`;
    }
    
    return summary;
}

/**
 * Відправка звіту
 */
async function submitReport(
    ctx: BotContext, 
    state: ReturnType<typeof states.getState>,
    lang: Language
): Promise<void> {
    const userId = ctx.from!.id;
    
    try {
        const isUpdate = state!.data.isUpdate && state!.data.existingReportId;
        
        await ctx.reply(
            isUpdate 
                ? (lang === 'uk' ? '⏳ Оновлюємо звіт...' : '⏳ Updating report...')
                : (lang === 'uk' ? '⏳ Зберігаємо звіт...' : '⏳ Saving report...')
        );

        let report: any;
        let trelloUrl = '';

        if (isUpdate) {
            // РЕЖИМ ОНОВЛЕННЯ - додаємо нові задачі до існуючого звіту
            const existingReportId = state!.data.existingReportId!;
            
            // Визначаємо нові задачі (ті, що були додані в цій сесії)
            // При доповненні completedTasks вже містить старі + нові
            // Нам потрібно додати тільки нові (індекси більші за початкову кількість)
            const originalCompletedCount = (await reportCrud.findById(existingReportId))?.tasksCompleted || 0;
            const originalNotCompletedCount = (await reportCrud.findById(existingReportId))?.tasksNotCompleted || 0;
            
            const newCompletedTasks = state!.completedTasks.slice(originalCompletedCount);
            const newNotCompletedTasks = state!.notCompletedTasks.slice(originalNotCompletedCount);
            
            report = await reportCrud.updateReport(existingReportId, {
                workload: state!.data.workload,
                concerns: state!.data.concerns,
                newCompletedTasks: newCompletedTasks,
                newNotCompletedTasks: newNotCompletedTasks,
            });
            
            if (!report) {
                throw new Error('Failed to update report');
            }

            // Оновити картку в Trello
            try {
                if (state!.data.existingTrelloCardId) {
                    const allCompletedTasks = state!.completedTasks;
                    const allNotCompletedTasks = state!.notCompletedTasks;
                    
                    const card = await trelloService.updateReportCard(
                        state!.data.existingTrelloCardId,
                        {
                            name: state!.data.reporterName || ctx.user!.name,
                            weekNumber: state!.data.weekNumber!,
                            year: state!.data.year!,
                            position: state!.data.reporterPosition || ctx.user!.position,
                            team: ctx.user!.team,
                            workload: state!.data.workload!,
                            tasksCompleted: allCompletedTasks.length,
                            tasksNotCompleted: allNotCompletedTasks.length,
                            completionRate: report.completionRate,
                            hasBlockers: report.hasBlockers,
                            concerns: state!.data.concerns,
                            improvements: state!.data.improvements,
                            priorities: state!.data.priorities,
                        },
                        allCompletedTasks,
                        allNotCompletedTasks
                    );
                    trelloUrl = card.shortUrl || card.url;
                } else {
                    // Якщо карткі не було - створити нову
                    const card = await trelloService.createReportCard(
                        {
                            name: state!.data.reporterName || ctx.user!.name,
                            weekNumber: state!.data.weekNumber!,
                            year: state!.data.year!,
                            position: state!.data.reporterPosition || ctx.user!.position,
                            team: ctx.user!.team,
                            workload: state!.data.workload!,
                            tasksCompleted: state!.completedTasks.length,
                            tasksNotCompleted: state!.notCompletedTasks.length,
                            completionRate: report.completionRate,
                            hasBlockers: report.hasBlockers,
                            concerns: state!.data.concerns,
                            improvements: state!.data.improvements,
                            priorities: state!.data.priorities,
                        },
                        state!.completedTasks,
                        state!.notCompletedTasks
                    );
                    trelloUrl = card.shortUrl || card.url;
                    await reportCrud.updateTrelloInfo(report.reportId, card.id, trelloUrl);
                }
            } catch (trelloError) {
                logger.error('Failed to update Trello card:', trelloError);
            }

            logger.info(`Report ${report.reportId} updated by user ${ctx.user!.userId}`);
        } else {
            // РЕЖИМ СТВОРЕННЯ - новий звіт
            const reportDto: CreateReportDto = {
                userId: ctx.user!.userId,
                weekNumber: state!.data.weekNumber!,
                year: state!.data.year!,
                workload: state!.data.workload!,
                completedTasks: state!.completedTasks,
                notCompletedTasks: state!.notCompletedTasks,
                concerns: state!.data.concerns,
                improvements: state!.data.improvements,
                priorities: state!.data.priorities,
            };

            // Валідація
            const validation = validateReport(reportDto);
            if (!validation.isValid) {
                await ctx.reply(
                    `⚠️ ${lang === 'uk' ? 'Помилки валідації' : 'Validation errors'}:\n${validation.errors.join('\n')}`
                );
                return;
            }

            // Створення звіту в БД
            report = await reportCrud.create(reportDto);

            // Створення картки в Trello
            try {
                const card = await trelloService.createReportCard(
                    {
                        name: state!.data.reporterName || ctx.user!.name,
                        weekNumber: reportDto.weekNumber,
                        year: reportDto.year,
                        position: state!.data.reporterPosition || ctx.user!.position,
                        team: ctx.user!.team,
                        workload: reportDto.workload,
                        tasksCompleted: state!.completedTasks.length,
                        tasksNotCompleted: state!.notCompletedTasks.length,
                        completionRate: report.completionRate,
                        hasBlockers: report.hasBlockers,
                        concerns: reportDto.concerns,
                        improvements: reportDto.improvements,
                        priorities: reportDto.priorities,
                    },
                    state!.completedTasks,
                    state!.notCompletedTasks
                );

                trelloUrl = card.shortUrl || card.url;
                await reportCrud.updateTrelloInfo(report.reportId, card.id, trelloUrl);
            } catch (trelloError) {
                logger.error('Failed to create Trello card:', trelloError);
            }

            logger.info(`Report ${report.reportId} created by user ${ctx.user!.userId}`);
        }

        // Очистити стан
        states.clearState(userId);

        // Відповідь користувачу
        const successMessage = isUpdate 
            ? (lang === 'uk' 
                ? `✅ Звіт успішно оновлено!`
                : `✅ Report updated successfully!`)
            : t('bot.report.success', lang);
            
        await ctx.reply(successMessage, keyboards.mainMenu(lang, isAdmin(ctx.from!.id)));

        // Сповістити менеджера (тільки для нових звітів)
        if (!isUpdate) {
            const user = await userCrud.findById(ctx.user!.userId);
            if (user?.managerId) {
                const manager = await userCrud.findById(user.managerId);
                if (manager) {
                    await notifyManagerAboutNewReport(manager as any, user as any, {
                        weekNumber: state!.data.weekNumber!,
                        workload: state!.data.workload!,
                        completionRate: report.completionRate,
                    });
                }
            }
        }
    } catch (error) {
        logger.error('Error submitting report:', error);
        await ctx.reply(t('common.error', lang), keyboards.mainMenu(lang, isAdmin(ctx.from!.id)));
    }
}

/**
 * Обробка надсилання PDF
 */
async function handleSendPdf(ctx: BotContext): Promise<void> {
    const lang = ctx.user?.language || 'uk';
    await ctx.reply(
        t('bot.sendpdf.prompt', lang),
        keyboards.cancelKeyboard(lang)
    );
}

// Тимчасове сховище для PDF даних (TTL: 10 хвилин)
const PDF_CACHE_TTL = 10 * 60 * 1000; // 10 minutes
const MAX_PDF_SIZE = 10 * 1024 * 1024; // 10 MB

const pdfDataCache = new Map<number, {
    pdfData: any;
    existingReport: any;
    tempPath?: string;
    createdAt: number;
}>();

// Очищення протермінованих записів кожні 5 хвилин
setInterval(() => {
    const now = Date.now();
    for (const [key, value] of pdfDataCache.entries()) {
        if (now - value.createdAt > PDF_CACHE_TTL) {
            pdfDataCache.delete(key);
        }
    }
}, 5 * 60 * 1000);

/**
 * Обробка завантаженого PDF
 */
async function handlePdfUpload(ctx: BotContext, document: any): Promise<void> {
    const lang = ctx.user?.language || 'uk';

    // Перевірка авторизації
    if (!ctx.user || !ctx.user.userId) {
        await ctx.reply(
            lang === 'uk'
                ? '⚠️ Помилка авторизації. Напишіть /start для початку.'
                : '⚠️ Authorization error. Type /start to begin.',
            keyboards.mainMenu(lang, isAdmin(ctx.from!.id))
        );
        return;
    }

    try {
        await ctx.reply(t('bot.sendpdf.processing', lang));

        // Завантажити файл
        const file = await ctx.telegram.getFile(document.file_id);

        // Перевірка розміру файлу
        if (file.file_size && file.file_size > MAX_PDF_SIZE) {
            await ctx.reply(
                lang === 'uk'
                    ? `❌ Файл занадто великий (максимум 10 МБ)`
                    : `❌ File too large (max 10 MB)`
            );
            return;
        }

        const fileUrl = `https://api.telegram.org/file/bot${config.telegram.botToken}/${file.file_path}`;
        
        // Зберегти файл тимчасово
        const tempDir = config.pdf.tempPath;
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }
        
        const tempPath = path.join(tempDir, `temp_${Date.now()}.pdf`);
        const response = await axios.get(fileUrl, { responseType: 'arraybuffer' });
        fs.writeFileSync(tempPath, response.data);

        // Парсинг PDF
        const pdfData = await parsePdfReport(tempPath);

        // Видалити тимчасовий файл
        fs.unlinkSync(tempPath);

        // Перевірка даних - м'якша валідація
        const hasTasks = pdfData.completedTasks.length > 0 || pdfData.notCompletedTasks.length > 0;
        const hasAnyContent = hasTasks || pdfData.concerns || pdfData.improvements || pdfData.priorities;
        
        if (!hasAnyContent) {
            await ctx.reply(
                lang === 'uk'
                    ? '❌ Не вдалося розпізнати вміст PDF файлу.\n\n' +
                      'Переконайтеся, що файл містить:\n' +
                      '• Виконані або невиконані задачі\n' +
                      '• Або текстову інформацію про тиждень\n\n' +
                      'Спробуйте створити звіт через бота: /report'
                    : '❌ Could not parse PDF content.\n\n' +
                      'Make sure the file contains:\n' +
                      '• Completed or incomplete tasks\n' +
                      '• Or text information about the week\n\n' +
                      'Try creating a report via bot: /report'
            );
            return;
        }

        // Якщо немає workload, встановлюємо середнє значення
        if (!pdfData.workload) {
            pdfData.workload = 3;
        }

        const weekNumber = pdfData.weekNumber || getWeekNumber(new Date());
        const year = pdfData.year || getCurrentYear();

        // Перевірити чи існує звіт за цей тиждень
        const existingReport = await reportCrud.findByUserAndWeek(ctx.user.userId, weekNumber, year);

        if (existingReport) {
            // Зберегти дані в кеш (з TTL)
            pdfDataCache.set(ctx.user.userId, { pdfData, existingReport, createdAt: Date.now() });

            // Показати інформацію про існуючий звіт і запитати дію
            const existingTasks = (existingReport as any).completedTasks || [];
            const existingNotCompleted = (existingReport as any).notCompletedTasks || [];

            const summary = lang === 'uk'
                ? `📋 *Вже існує звіт за тиждень ${weekNumber}/${year}*\n\n` +
                  `✅ Виконано: ${existingTasks.length} задач\n` +
                  `❌ Не виконано: ${existingNotCompleted.length} задач\n` +
                  `📊 Навантаження: ${existingReport.workload}/5\n\n` +
                  `📄 *З PDF витягнуто:*\n` +
                  `✅ Виконано: ${pdfData.completedTasks.length} задач\n` +
                  `❌ Не виконано: ${pdfData.notCompletedTasks.length} задач\n\n` +
                  `Оберіть дію:`
                : `📋 *Report for week ${weekNumber}/${year} already exists*\n\n` +
                  `✅ Completed: ${existingTasks.length} tasks\n` +
                  `❌ Not completed: ${existingNotCompleted.length} tasks\n` +
                  `📊 Workload: ${existingReport.workload}/5\n\n` +
                  `📄 *Extracted from PDF:*\n` +
                  `✅ Completed: ${pdfData.completedTasks.length} tasks\n` +
                  `❌ Not completed: ${pdfData.notCompletedTasks.length} tasks\n\n` +
                  `Choose action:`;

            await ctx.reply(summary, {
                parse_mode: 'Markdown',
                ...keyboards.updateReportKeyboard(lang)
            });
            return;
        }

        // Якщо звіту немає - створюємо новий
        await createReportFromPdf(ctx, pdfData, weekNumber, year, lang);

    } catch (error) {
        logger.error('Error processing PDF:', error);
        await ctx.reply(
            t('bot.sendpdf.error', lang, { error: (error as Error).message }),
            keyboards.mainMenu(lang, isAdmin(ctx.from!.id))
        );
    }
}

/**
 * Обробка вибору дії для PDF оновлення
 */
export async function handlePdfUpdateAction(ctx: BotContext, action: 'append' | 'replace' | 'cancel'): Promise<void> {
    const lang = ctx.user?.language || 'uk';
    const userId = ctx.user?.userId;

    if (!userId) return;

    const cached = pdfDataCache.get(userId);
    if (!cached) {
        await ctx.reply(
            lang === 'uk' ? '⚠️ Дані PDF втрачено. Надішліть файл ще раз.' : '⚠️ PDF data lost. Please send the file again.',
            keyboards.mainMenu(lang, isAdmin(ctx.from!.id))
        );
        return;
    }

    const { pdfData, existingReport } = cached;
    pdfDataCache.delete(userId);

    try {
        if (action === 'cancel') {
            await ctx.reply(
                lang === 'uk' ? '❌ Скасовано' : '❌ Cancelled',
                keyboards.mainMenu(lang, isAdmin(ctx.from!.id))
            );
            return;
        }

        if (action === 'replace') {
            // Видалити старий звіт і створити новий
            await reportCrud.deleteReport(existingReport.reportId);
            await createReportFromPdf(ctx, pdfData, existingReport.weekNumber, existingReport.year, lang);
            return;
        }

        if (action === 'append') {
            // Об'єднати дані
            const existingCompleted = (existingReport as any).completedTasks || [];
            const existingNotCompleted = (existingReport as any).notCompletedTasks || [];

            // Оновити звіт - додати нові завдання
            await reportCrud.updateReport(existingReport.reportId, {
                newCompletedTasks: pdfData.completedTasks,
                newNotCompletedTasks: pdfData.notCompletedTasks,
                workload: pdfData.workload || existingReport.workload,
                concerns: pdfData.concerns || existingReport.concerns,
            });

            // Оновити Trello картку якщо є
            if (existingReport.trelloCardId) {
                try {
                    const allCompleted = [...existingCompleted, ...pdfData.completedTasks];
                    const allNotCompleted = [...existingNotCompleted, ...pdfData.notCompletedTasks];

                    await trelloService.updateReportCard(
                        existingReport.trelloCardId,
                        {
                            name: pdfData.name || ctx.user!.name,
                            weekNumber: existingReport.weekNumber,
                            year: existingReport.year,
                            position: pdfData.position || ctx.user!.position,
                            team: ctx.user!.team,
                            workload: pdfData.workload || existingReport.workload,
                            tasksCompleted: allCompleted.length,
                            tasksNotCompleted: allNotCompleted.length,
                            completionRate: allCompleted.length > 0 
                                ? Math.round(allCompleted.length / (allCompleted.length + allNotCompleted.length) * 100)
                                : 0,
                            hasBlockers: allNotCompleted.some((t: any) => t.blocker),
                            concerns: pdfData.concerns || existingReport.concerns,
                        },
                        allCompleted,
                        allNotCompleted
                    );
                } catch (err) {
                    logger.error('Failed to update Trello card:', err);
                }
            }

            const totalCompleted = existingCompleted.length + pdfData.completedTasks.length;
            const totalNotCompleted = existingNotCompleted.length + pdfData.notCompletedTasks.length;

            await ctx.reply(
                lang === 'uk'
                    ? `✅ Звіт оновлено!\n\n` +
                      `📊 Всього виконано: ${totalCompleted} задач\n` +
                      `❌ Всього не виконано: ${totalNotCompleted} задач`
                    : `✅ Report updated!\n\n` +
                      `📊 Total completed: ${totalCompleted} tasks\n` +
                      `❌ Total not completed: ${totalNotCompleted} tasks`,
                keyboards.mainMenu(lang, isAdmin(ctx.from!.id))
            );
        }
    } catch (error) {
        logger.error('Error handling PDF update action:', error);
        await ctx.reply(t('common.error', lang), keyboards.mainMenu(lang, isAdmin(ctx.from!.id)));
    }
}

/**
 * Створити звіт з PDF даних
 */
async function createReportFromPdf(
    ctx: BotContext, 
    pdfData: any, 
    weekNumber: number, 
    year: number, 
    lang: Language
): Promise<void> {
    const reportDto: CreateReportDto = {
        userId: ctx.user!.userId,
        weekNumber,
        year,
        workload: pdfData.workload,
        completedTasks: pdfData.completedTasks,
        notCompletedTasks: pdfData.notCompletedTasks,
        concerns: pdfData.concerns,
        improvements: pdfData.improvements,
        priorities: pdfData.priorities,
    };

    const report = await reportCrud.create(reportDto);

    // Створення картці в Trello
    let trelloUrl = '';
    try {
        const reportName = pdfData.name || ctx.user!.name;
        const reportPosition = pdfData.position || ctx.user!.position;
        const reportTeam = pdfData.team || ctx.user!.team;
        
        const card = await trelloService.createReportCard(
            {
                name: reportName,
                weekNumber,
                year,
                position: reportPosition,
                team: reportTeam,
                workload: pdfData.workload,
                tasksCompleted: pdfData.completedTasks.length,
                tasksNotCompleted: pdfData.notCompletedTasks.length,
                completionRate: report.completionRate,
                hasBlockers: report.hasBlockers,
                concerns: pdfData.concerns,
                improvements: pdfData.improvements,
                priorities: pdfData.priorities,
            },
            pdfData.completedTasks,
            pdfData.notCompletedTasks
        );
        trelloUrl = card.shortUrl;
        await reportCrud.updateTrelloInfo(report.reportId, card.id, trelloUrl);
    } catch (error) {
        logger.error('Failed to create Trello card:', error);
    }

    await ctx.reply(
        t('bot.sendpdf.success', lang),
        keyboards.mainMenu(lang, isAdmin(ctx.from!.id))
    );
}

/**
 * Показати мої звіти
 */
async function handleMyReports(ctx: BotContext): Promise<void> {
    const lang = ctx.user?.language || 'uk';
    const REPORTS_PER_PAGE = 5;

    try {
        const totalReports = await reportCrud.countByUser(ctx.user!.userId);

        if (totalReports === 0) {
            await ctx.reply(t('bot.myreports.empty', lang));
            return;
        }

        const reports = await reportCrud.findByUser(ctx.user!.userId, REPORTS_PER_PAGE, 0);

        let message = t('bot.myreports.title', lang);

        for (const report of reports) {
            message += t('bot.myreports.item', lang, {
                week: report.weekNumber,
                year: report.year,
                workload: report.workload,
                completed: report.tasksCompleted,
                rate: report.completionRate,
            });
            message += '\n';
        }

        const totalPages = Math.ceil(totalReports / REPORTS_PER_PAGE);
        if (totalPages > 1) {
            message += lang === 'uk' 
                ? `\n📄 Сторінка 1/${totalPages}` 
                : `\n📄 Page 1/${totalPages}`;
            await ctx.reply(message, {
                parse_mode: 'Markdown',
                ...keyboards.paginationKeyboard(1, totalPages, lang),
            });
        } else {
            await ctx.reply(message, { parse_mode: 'Markdown' });
        }
    } catch (error) {
        logger.error('Error fetching reports:', error);
        await ctx.reply(t('common.error', lang));
    }
}

/**
 * Показати статистику
 */
async function handleStats(ctx: BotContext): Promise<void> {
    const lang = ctx.user?.language || 'uk';

    try {
        const userStats = await getUserStats(ctx.user!.userId);
        
        if (!userStats) {
            await ctx.reply(lang === 'uk' 
                ? '📭 Недостатньо даних для статистики' 
                : '📭 Not enough data for statistics'
            );
            return;
        }

        const message = formatUserStatsMessage(userStats, lang);
        await ctx.reply(message, { parse_mode: 'Markdown' });

        // Для менеджерів показати кнопки статистики команд
        if (ctx.user?.isManager) {
            await ctx.reply(
                lang === 'uk' ? '👥 Статистика команд:' : '👥 Team statistics:',
                keyboards.teamStatsInlineKeyboard(lang)
            );
        }
    } catch (error) {
        logger.error('Error fetching stats:', error);
        await ctx.reply(t('common.error', lang));
    }
}

/**
 * Показати адмін статистику по користувачам
 */
async function handleAdminStats(ctx: BotContext): Promise<void> {
    const lang = ctx.user?.language || 'uk';
    const telegramId = ctx.from?.id;

    // Перевірка прав адміна
    if (!telegramId || !isAdmin(telegramId)) {
        await ctx.reply(t('bot.admin_stats.access_denied', lang));
        return;
    }

    try {
        // Загальна статистика
        const overall = await statsCrud.getOverallStats();
        
        // Статистика за поточний тиждень
        const weekNumber = getWeekNumber(new Date());
        const year = getCurrentYear();
        const weekly = await statsCrud.getWeeklyStats(weekNumber, year);
        
        // Користувачі без звіту
        const noReport = await statsCrud.getUsersWithoutCurrentReport();
        
        // Топ за годинами
        const topHours = await statsCrud.getTopUsersByHours(5);
        
        // Статистика по користувачам
        const usersStats = await statsCrud.getUsersStats(15);

        // Формування повідомлення
        let message = t('bot.admin_stats.title', lang);
        
        // Загальна статистика
        message += t('bot.admin_stats.overall', lang, {
            total: overall.totalUsers,
            active: overall.activeUsers,
            reports: overall.totalReports,
            hours: overall.totalHours,
            workload: overall.avgWorkload.toFixed(1),
        });
        
        // Статистика за тиждень
        message += t('bot.admin_stats.weekly', lang, {
            week: weekly.weekNumber,
            year: weekly.year,
            with: weekly.usersWithReports,
            total: weekly.totalUsers,
            rate: weekly.avgCompletionRate,
            workload: weekly.avgWorkload,
            hours: weekly.totalHours,
        });
        
        // Без звіту
        if (noReport.length > 0) {
            const list = noReport.map(u => `  • ${u.name} (${u.position})`).join('\n');
            message += t('bot.admin_stats.no_report', lang, {
                count: noReport.length,
                list,
            });
        }
        
        // Топ за годинами
        if (topHours.length > 0) {
            const list = topHours.map((u, i) => `  ${i + 1}. ${u.name}: ${u.totalHours} год`).join('\n');
            message += t('bot.admin_stats.top_hours', lang, { list });
        }

        await ctx.reply(message, { parse_mode: 'Markdown' });
        
        // Друге повідомлення з детальною статистикою користувачів
        if (usersStats.length > 0) {
            let usersMessage = t('bot.admin_stats.users_title', lang);
            
            for (const user of usersStats) {
                usersMessage += t('bot.admin_stats.user_row', lang, {
                    name: user.name,
                    position: user.position,
                    reports: user.totalReports,
                    hours: user.totalHours,
                    workload: user.avgWorkload,
                });
            }
            
            await ctx.reply(usersMessage, { parse_mode: 'Markdown' });
        }

    } catch (error) {
        logger.error('Error fetching admin stats:', error);
        await ctx.reply(t('common.error', lang));
    }
}

/**
 * Показати звіти команди
 */
async function handleTeamReports(ctx: BotContext): Promise<void> {
    const lang = ctx.user?.language || 'uk';

    if (!ctx.user?.isManager) {
        await ctx.reply(t('bot.team.not_manager', lang));
        return;
    }

    const weekNumber = getWeekNumber(new Date());
    const teamStats = await getTeamWeeklyStats(ctx.user.team, weekNumber);

    if (!teamStats) {
        await ctx.reply(t('bot.team.empty', lang));
        return;
    }

    const message = formatTeamStatsMessage(teamStats, weekNumber, lang);
    await ctx.reply(message, { parse_mode: 'Markdown' });
}

/**
 * Callback статистики команди
 */
async function handleTeamStatsCallback(ctx: Context, team: Team): Promise<void> {
    const weekNumber = getWeekNumber(new Date());
    const teamStats = await getTeamWeeklyStats(team, weekNumber);

    if (!teamStats) {
        await ctx.answerCbQuery('No data');
        return;
    }

    const message = formatTeamStatsMessage(teamStats, weekNumber, 'uk');
    await ctx.editMessageText(message, { parse_mode: 'Markdown' });
    await ctx.answerCbQuery();
}

/**
 * Експорт в PDF
 */
async function handleExportPdf(ctx: Context, reportId: number): Promise<void> {
    try {
        const report = await reportCrud.findById(reportId);
        if (!report) {
            await ctx.answerCbQuery('Report not found');
            return;
        }

        const user = (report as any).user;
        const completedTasks = (report as any).completedTasks || [];
        const notCompletedTasks = (report as any).notCompletedTasks || [];

        const pdfPath = await generatePdfReport({
            name: user?.name || 'Unknown',
            position: user?.position || 'Other',
            team: user?.team || 'Other',
            weekNumber: report.weekNumber,
            year: report.year,
            workload: report.workload,
            completedTasks,
            notCompletedTasks,
            concerns: report.concerns || undefined,
            improvements: report.improvements || undefined,
            priorities: report.priorities || undefined,
        });

        await ctx.replyWithDocument({ source: pdfPath });
        await ctx.answerCbQuery('PDF готовий');

        // Видалити тимчасовий файл
        fs.unlinkSync(pdfPath);
    } catch (error) {
        logger.error('Error exporting PDF:', error);
        await ctx.answerCbQuery('Error generating PDF');
    }
}

/**
 * Встановити мову
 */
async function handleSetLanguage(ctx: Context, lang: Language): Promise<void> {
    const telegramId = ctx.from!.id;
    const user = await userCrud.findByTelegramId(telegramId);
    
    if (user) {
        await userCrud.update(user.userId, { language: lang });
    }

    const message = lang === 'uk' 
        ? '✅ Мову змінено на українську' 
        : '✅ Language changed to English';
    
    await ctx.editMessageText(message);
    await ctx.answerCbQuery();
}

/**
 * Пагінація звітів
 */
async function handleReportsPage(ctx: Context, page: number): Promise<void> {
    const REPORTS_PER_PAGE = 5;
    const botCtx = ctx as BotContext;
    const lang = botCtx.user?.language || 'uk';

    try {
        const userId = botCtx.user!.userId;
        const totalReports = await reportCrud.countByUser(userId);
        const totalPages = Math.ceil(totalReports / REPORTS_PER_PAGE);
        const safePage = Math.max(1, Math.min(page, totalPages));
        const offset = (safePage - 1) * REPORTS_PER_PAGE;

        const reports = await reportCrud.findByUser(userId, REPORTS_PER_PAGE, offset);

        let message = t('bot.myreports.title', lang);

        for (const report of reports) {
            message += t('bot.myreports.item', lang, {
                week: report.weekNumber,
                year: report.year,
                workload: report.workload,
                completed: report.tasksCompleted,
                rate: report.completionRate,
            });
            message += '\n';
        }

        message += lang === 'uk' 
            ? `\n📄 Сторінка ${safePage}/${totalPages}` 
            : `\n📄 Page ${safePage}/${totalPages}`;

        await ctx.editMessageText(message, {
            parse_mode: 'Markdown',
            ...keyboards.paginationKeyboard(safePage, totalPages, lang),
        });
    } catch (error) {
        logger.error('Error in handleReportsPage:', error);
    }

    await ctx.answerCbQuery();
}

/**
 * Скасування
 */
async function handleCancel(ctx: BotContext): Promise<void> {
    const userId = ctx.from!.id;
    const lang = ctx.user?.language || 'uk';

    states.clearState(userId);
    await ctx.reply(
        t('bot.report.cancelled', lang),
        keyboards.mainMenu(lang, isAdmin(ctx.from!.id))
    );
}

/**
 * Показати меню шаблонів
 */
async function handleTemplates(ctx: BotContext): Promise<void> {
    const lang = ctx.user?.language || 'uk';
    
    const message = lang === 'uk' 
        ? '📋 *Шаблони для заповнення звіту*\n\nНатисніть кнопку нижче, щоб завантажити шаблон Word для ручного заповнення.'
        : '📋 *Report Templates*\n\nPress the button below to download the Word template for manual filling.';
    
    await ctx.reply(message, {
        parse_mode: 'Markdown',
        ...keyboards.templatesKeyboard(lang)
    });
}

/**
 * Надіслати Word шаблон
 */
async function handleWordTemplate(ctx: BotContext): Promise<void> {
    const lang = ctx.user?.language || 'uk';
    const templatePath = path.join(process.cwd(), 'templates', 'weekly_report_template.docx');
    
    try {
        if (!fs.existsSync(templatePath)) {
            await ctx.reply(
                lang === 'uk' 
                    ? '❌ Шаблон Word не знайдено. Зверніться до адміністратора.'
                    : '❌ Word template not found. Contact administrator.'
            );
            return;
        }
        
        await ctx.replyWithDocument(
            { source: templatePath, filename: 'weekly_report_template.docx' },
            {
                caption: lang === 'uk'
                    ? '📝 *Шаблон тижневого звіту (Word)*\n\nЗаповніть та надішліть назад у форматі PDF або просто напишіть звіт через бота.'
                    : '📝 *Weekly Report Template (Word)*\n\nFill in and send back as PDF or just write report via bot.',
                parse_mode: 'Markdown'
            }
        );
    } catch (error) {
        logger.error('Error sending Word template:', error);
        await ctx.reply(
            lang === 'uk' 
                ? '❌ Помилка при надсиланні шаблону'
                : '❌ Error sending template'
        );
    }
}

/**
 * Допоміжна функція для парсингу дати
 */
function parseDate(text: string): Date | undefined {
    // Формати: DD.MM.YYYY, DD/MM/YYYY, YYYY-MM-DD
    const patterns = [
        /^(\d{2})\.(\d{2})\.(\d{4})$/,
        /^(\d{2})\/(\d{2})\/(\d{4})$/,
        /^(\d{4})-(\d{2})-(\d{2})$/,
    ];

    for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match) {
            let day, month, year;
            if (pattern === patterns[2]) {
                [, year, month, day] = match;
            } else {
                [, day, month, year] = match;
            }
            const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
            if (!isNaN(date.getTime())) {
                return date;
            }
        }
    }
    return undefined;
}

export default { setupHandlers };
