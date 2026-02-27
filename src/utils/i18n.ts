
/**
 * SAMI Weekly Reports - Internationalization (i18n)
 * Підтримка багатомовності (українська/англійська)
 */

import type { Language, Position, Team, Workload } from '../types';

type TranslationStrings = {
    [key: string]: {
        uk: string;
        en: string;
    };
};

const translations: TranslationStrings = {
    // ============================================
    // BOT COMMANDS
    // ============================================
    
    // /start
    'bot.start.welcome': {
        uk: '👋 Вітаю, {name}!\n\nЯ бот для збору тижневих звітів команди SAMI.\n\n📋 Мої команди:\n/report - Створити новий звіт\n/sendpdf - Надіслати заповнений PDF\n/myreports - Мої останні звіти\n/stats - Швидка статистика\n/help - Довідка\n\n💡 Щоп\'ятниці не забувайте надсилати звіти!',
        en: '👋 Welcome, {name}!\n\nI am the SAMI team weekly reports bot.\n\n📋 My commands:\n/report - Create a new report\n/sendpdf - Send a filled PDF\n/myreports - My recent reports\n/stats - Quick statistics\n/help - Help\n\n💡 Don\'t forget to send reports every Friday!',
    },

    // /help
    'bot.help.message': {
        uk: '📚 **ДОВІДКА**\n\n**Команди:**\n• /start - Почати роботу\n• /report - Створити звіт через питання\n• /sendpdf - Надіслати заповнений PDF\n• /myreports - Останні 5 звітів\n• /team - Звіти команди (для керівників)\n• /stats - Статистика\n• /settings - Налаштування\n• /help - Ця довідка\n\n**Як створити звіт:**\n1. Використайте /report і дайте відповіді на питання\n2. АБО заповніть PDF-форму і надішліть через /sendpdf\n\n**Підтримка:** @admin',
        en: '📚 **HELP**\n\n**Commands:**\n• /start - Start\n• /report - Create report via questions\n• /sendpdf - Send filled PDF\n• /myreports - Last 5 reports\n• /team - Team reports (for managers)\n• /stats - Statistics\n• /settings - Settings\n• /help - This help\n\n**How to create a report:**\n1. Use /report and answer questions\n2. OR fill the PDF form and send via /sendpdf\n\n**Support:** @admin',
    },

    // /report
    'bot.report.start': {
        uk: '📝 **Створення тижневого звіту**\n\nТиждень {week}/{year}\n\nПочнемо з виконаних задач. Скільки задач ви виконали цього тижня?',
        en: '📝 **Creating Weekly Report**\n\nWeek {week}/{year}\n\nLet\'s start with completed tasks. How many tasks did you complete this week?',
    },

    'bot.report.completed_title': {
        uk: '✅ Введіть назву виконаної задачі #{num}:',
        en: '✅ Enter the title of completed task #{num}:',
    },

    'bot.report.completed_project': {
        uk: '📁 Який проєкт? (для задачі "{task}"):',
        en: '📁 Which project? (for task "{task}"):',
    },

    'bot.report.completed_hours': {
        uk: '⏱ Скільки годин витрачено?',
        en: '⏱ How many hours spent?',
    },

    'bot.report.completed_more': {
        uk: '➕ Додати ще виконану задачу?',
        en: '➕ Add another completed task?',
    },

    'bot.report.not_completed_title': {
        uk: '❌ Введіть назву НЕвиконаної задачі #{num}:',
        en: '❌ Enter the title of NOT completed task #{num}:',
    },

    'bot.report.not_completed_reason': {
        uk: '❓ Причина невиконання:',
        en: '❓ Reason for not completing:',
    },

    'bot.report.not_completed_eta': {
        uk: '📅 Очікувана дата завершення (ETA)?\nВведіть у форматі ДД.ММ.РРРР або натисніть "Пропустити":',
        en: '📅 Expected completion date (ETA)?\nEnter in DD.MM.YYYY format or press "Skip":',
    },

    'bot.report.not_completed_blocker': {
        uk: '🚧 Чи є блокери? Опишіть або натисніть "Пропустити":',
        en: '🚧 Any blockers? Describe or press "Skip":',
    },

    'bot.report.not_completed_more': {
        uk: '➕ Додати ще невиконану задачу?',
        en: '➕ Add another not completed task?',
    },

    'bot.report.workload': {
        uk: '📊 Оцініть ваше навантаження цього тижня (1-5):',
        en: '📊 Rate your workload this week (1-5):',
    },

    'bot.report.concerns': {
        uk: '� Що вас турбує або що варто покращити? (або "Пропустити"):',
        en: '💬 Any concerns or suggestions for improvement? (or "Skip"):',
    },

    'bot.report.improvements': {
        uk: '💡 Що можна покращити? (або "Пропустити"):',
        en: '💡 What can be improved? (or "Skip"):',
    },

    'bot.report.priorities': {
        uk: '🎯 Пріоритети на наступний тиждень (або "Пропустити"):',
        en: '🎯 Priorities for next week (or "Skip"):',
    },

    'bot.report.confirm': {
        uk: '📋 **Перевірте ваш звіт:**\n\n{summary}\n\nВсе вірно?',
        en: '📋 **Review your report:**\n\n{summary}\n\nIs everything correct?',
    },

    'bot.report.success': {
        uk: '✅ **Звіт успішно створено!**\n\nДякую за звіт! До зустрічі наступного тижня 👋',
        en: '✅ **Report created successfully!**\n\nThank you for the report! See you next week 👋',
    },

    'bot.report.cancelled': {
        uk: '❌ Створення звіту скасовано.',
        en: '❌ Report creation cancelled.',
    },

    'bot.report.already_exists': {
        uk: '⚠️ Ви вже надіслали звіт за цей тиждень. Хочете створити новий?',
        en: '⚠️ You already submitted a report for this week. Do you want to create a new one?',
    },

    // /myreports
    'bot.myreports.title': {
        uk: '📊 **Ваші останні звіти:**\n\n',
        en: '📊 **Your recent reports:**\n\n',
    },

    'bot.myreports.empty': {
        uk: '📭 У вас ще немає звітів.',
        en: '📭 You don\'t have any reports yet.',
    },

    'bot.myreports.item': {
        uk: '📋 **Тиждень {week}/{year}**\n• Навантаження: {workload}/5\n• Виконано: {completed} задач\n• % виконання: {rate}%\n',
        en: '📋 **Week {week}/{year}**\n• Workload: {workload}/5\n• Completed: {completed} tasks\n• Completion rate: {rate}%\n',
    },

    // /team
    'bot.team.title': {
        uk: '👥 **Звіти команди {team} - Тиждень {week}**\n\n',
        en: '👥 **Team {team} Reports - Week {week}**\n\n',
    },

    'bot.team.empty': {
        uk: '📭 Звітів команди за цей тиждень ще немає.',
        en: '📭 No team reports for this week yet.',
    },

    'bot.team.not_manager': {
        uk: '⛔ Ця команда доступна тільки для керівників.',
        en: '⛔ This command is only available for managers.',
    },


    // Admin add user
    'bot.admin_add_user.start': {
        uk: 'Введіть Telegram ID нового користувача:',
        en: 'Enter new user Telegram ID:',
    },
    'bot.admin_add_user.name': {
        uk: 'Введіть імʼя користувача:',
        en: 'Enter user name:',
    },
    'bot.admin_add_user.success': {
        uk: '✅ Користувача додано!',
        en: '✅ User added!',
    },
    'bot.admin_add_user.exists': {
        uk: '❗️ Користувач з цим Telegram ID вже існує.',
        en: '❗️ User with this Telegram ID already exists.',
    },
    'bot.admin_add_user.error': {
        uk: '❌ Помилка при додаванні користувача.',
        en: '❌ Error adding user.',
    },
    'bot.admin_add_user.invalid_id': {
        uk: '❌ Некоректний Telegram ID. Спробуйте ще раз:',
        en: '❌ Invalid Telegram ID. Try again:',
    },
    'bot.admin_add_user.invalid_name': {
        uk: '❌ Некоректне імʼя. Спробуйте ще раз:',
        en: '❌ Invalid name. Try again:',
    },

    // /stats
    'bot.stats.title': {
        uk: '📊 **СТАТИСТИКА ЗА ТИЖДЕНЬ {week}**\n\n',
        en: '📊 **STATISTICS FOR WEEK {week}**\n\n',
    },

    'bot.stats.team_header': {
        uk: '**Команда {team}** ({count} співробітників):\n',
        en: '**Team {team}** ({count} employees):\n',
    },

    'bot.stats.avg_workload': {
        uk: '• Середнє навантаження: {value}/5',
        en: '• Average workload: {value}/5',
    },

    'bot.stats.completion_rate': {
        uk: '• % виконання: {value}%',
        en: '• Completion rate: {value}%',
    },

    'bot.stats.blockers': {
        uk: '• Блокерів: {value}',
        en: '• Blockers: {value}',
    },

    'bot.stats.overdue': {
        uk: '• Прострочено: {value} задач',
        en: '• Overdue: {value} tasks',
    },

    // Admin stats
    'bot.admin_stats.title': {
        uk: '📊 **СТАТИСТИКА СИСТЕМИ**\n\n',
        en: '📊 **SYSTEM STATISTICS**\n\n',
    },

    'bot.admin_stats.overall': {
        uk: '**📌 Загальна статистика:**\n• Користувачів: {total} (активних: {active})\n• Всього звітів: {reports}\n• Всього годин: {hours}\n• Середнє навантаження: {workload}/5\n\n',
        en: '**📌 Overall statistics:**\n• Users: {total} (active: {active})\n• Total reports: {reports}\n• Total hours: {hours}\n• Average workload: {workload}/5\n\n',
    },

    'bot.admin_stats.weekly': {
        uk: '**📅 Тиждень {week}/{year}:**\n• Користувачів зі звітами: {with}/{total}\n• Середній % виконання: {rate}%\n• Середнє навантаження: {workload}/5\n• Годин за тиждень: {hours}\n\n',
        en: '**📅 Week {week}/{year}:**\n• Users with reports: {with}/{total}\n• Average completion: {rate}%\n• Average workload: {workload}/5\n• Hours this week: {hours}\n\n',
    },

    'bot.admin_stats.no_report': {
        uk: '**❌ Без звіту цього тижня ({count}):**\n{list}\n\n',
        en: '**❌ No report this week ({count}):**\n{list}\n\n',
    },

    'bot.admin_stats.top_hours': {
        uk: '**🏆 Топ за годинами:**\n{list}',
        en: '**🏆 Top by hours:**\n{list}',
    },

    'bot.admin_stats.users_title': {
        uk: '👥 **СТАТИСТИКА КОРИСТУВАЧІВ**\n\n',
        en: '👥 **USER STATISTICS**\n\n',
    },

    'bot.admin_stats.user_row': {
        uk: '• **{name}** ({position})\n  Звітів: {reports} | Годин: {hours} | Навант.: {workload}/5\n',
        en: '• **{name}** ({position})\n  Reports: {reports} | Hours: {hours} | Workload: {workload}/5\n',
    },

    'bot.admin_stats.access_denied': {
        uk: '🚫 Лише для адміністраторів',
        en: '🚫 Admins only',
    },

    // /sendpdf
    'bot.sendpdf.prompt': {
        uk: '📄 Надішліть заповнений PDF-файл звіту:',
        en: '📄 Send the filled PDF report file:',
    },

    'bot.sendpdf.processing': {
        uk: '⏳ Обробка PDF файлу...',
        en: '⏳ Processing PDF file...',
    },

    'bot.sendpdf.success': {
        uk: '✅ PDF успішно оброблено! Звіт створено.',
        en: '✅ PDF processed successfully! Report created.',
    },

    'bot.sendpdf.error': {
        uk: '❌ Помилка обробки PDF: {error}',
        en: '❌ PDF processing error: {error}',
    },

    'bot.sendpdf.invalid': {
        uk: '❌ Невалідний PDF файл. Перевірте, що всі обов\'язкові поля заповнені.',
        en: '❌ Invalid PDF file. Please check that all required fields are filled.',
    },

    // ============================================
    // COMMON
    // ============================================

    'common.yes': {
        uk: 'Так',
        en: 'Yes',
    },

    'common.no': {
        uk: 'Ні',
        en: 'No',
    },

    'common.skip': {
        uk: 'Пропустити',
        en: 'Skip',
    },

    'common.cancel': {
        uk: 'Скасувати',
        en: 'Cancel',
    },

    'common.confirm': {
        uk: 'Підтвердити',
        en: 'Confirm',
    },

    'common.back': {
        uk: '« Назад',
        en: '« Back',
    },

    'common.next': {
        uk: 'Далі »',
        en: 'Next »',
    },

    'common.done': {
        uk: '✅ Готово',
        en: '✅ Done',
    },

    'common.error': {
        uk: '❌ Сталася помилка. Спробуйте ще раз або зверніться до адміністратора.',
        en: '❌ An error occurred. Please try again or contact the administrator.',
    },

    'common.invalid_input': {
        uk: '⚠️ Невірний формат введення. Спробуйте ще раз.',
        en: '⚠️ Invalid input format. Please try again.',
    },

    // ============================================
    // POSITIONS
    // ============================================

    'position.PM': {
        uk: 'Проджект Менеджер',
        en: 'Project Manager',
    },

    'position.Dev': {
        uk: 'Розробник',
        en: 'Developer',
    },

    'position.Design': {
        uk: 'Дизайнер',
        en: 'Designer',
    },

    'position.QA': {
        uk: 'Тестувальник',
        en: 'QA Engineer',
    },

    'position.BA': {
        uk: 'Бізнес-аналітик',
        en: 'Business Analyst',
    },

    'position.Other': {
        uk: 'Інше',
        en: 'Other',
    },

    // ============================================
    // WORKLOAD
    // ============================================

    'workload.1': {
        uk: '1 - Дуже низьке',
        en: '1 - Very Low',
    },

    'workload.2': {
        uk: '2 - Низьке',
        en: '2 - Low',
    },

    'workload.3': {
        uk: '3 - Середнє',
        en: '3 - Medium',
    },

    'workload.4': {
        uk: '4 - Високе',
        en: '4 - High',
    },

    'workload.5': {
        uk: '5 - Критичне',
        en: '5 - Critical',
    },

    // ============================================
    // NOTIFICATIONS
    // ============================================

    'notification.reminder': {
        uk: '⏰ **Нагадування!**\n\nНе забудьте надіслати тижневий звіт до кінця робочого дня.\n\n📝 /report - Створити звіт',
        en: '⏰ **Reminder!**\n\nDon\'t forget to submit your weekly report by the end of the day.\n\n📝 /report - Create report',
    },

    'notification.missing_report': {
        uk: '⚠️ **{name}** ще не надіслав звіт за тиждень {week}.',
        en: '⚠️ **{name}** hasn\'t submitted report for week {week} yet.',
    },

    'notification.new_report': {
        uk: '📥 **Новий звіт!**\n\n👤 {name}\n📋 Тиждень {week}\n📊 Навантаження: {workload}/5\n✅ Виконано: {completed}%',
        en: '📥 **New Report!**\n\n👤 {name}\n📋 Week {week}\n📊 Workload: {workload}/5\n✅ Completed: {completed}%',
    },
};

/**
 * Отримати переклад за ключем
 */
export function t(key: string, lang: Language = 'uk', params?: Record<string, string | number>): string {
    const translation = translations[key];
    
    if (!translation) {
        console.warn(`Translation missing: ${key}`);
        return key;
    }

    let text = translation[lang] || translation.uk;

    // Заміна параметрів
    if (params) {
        for (const [param, value] of Object.entries(params)) {
            text = text.replace(new RegExp(`{${param}}`, 'g'), String(value));
        }
    }

    return text;
}

/**
 * Отримати позицію на вибраній мові
 */
export function tPosition(position: Position, lang: Language = 'uk'): string {
    return t(`position.${position}`, lang);
}

/**
 * Отримати рівень навантаження на вибраній мові
 */
export function tWorkload(workload: Workload, lang: Language = 'uk'): string {
    return t(`workload.${workload}`, lang);
}

export default {
    t,
    tPosition,
    tWorkload,
    translations,
};
