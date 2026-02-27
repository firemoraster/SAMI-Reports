/**
 * SAMI Weekly Reports - Bot Keyboards
 * Клавіатури для Telegram бота
 */

import { Markup } from 'telegraf';
import type { Language, Position, Team, Workload } from '../types';

/**
 * Головне меню для звичайних користувачів
 */
export function mainMenu(lang: Language = 'uk', isAdmin: boolean = false) {
    const labels = lang === 'uk' ? {
        report: '📝 Створити звіт',
        sendPdf: '📄 Надіслати PDF',
        myReports: '📊 Мої звіти',
        stats: '📈 Статистика',
        userStats: '👥 Статистика користувачів',
        templates: '📋 Шаблони',
        help: '❓ Допомога',
    } : {
        report: '📝 Create Report',
        sendPdf: '📄 Send PDF',
        myReports: '📊 My Reports',
        stats: '📈 Statistics',
        userStats: '👥 User Statistics',
        templates: '📋 Templates',
        help: '❓ Help',
    };

    // Для звичайних користувачів - створення, перегляд звітів та статистика
    if (!isAdmin) {
        return Markup.keyboard([
            [labels.report, labels.sendPdf],
            [labels.myReports, labels.stats],
            [labels.templates, labels.help],
        ]).resize();
    }

    // Для адмінів - повне меню з статистикою користувачів і додаванням юзерів
    return Markup.keyboard([
        [labels.report, labels.sendPdf],
        [labels.myReports, labels.stats],
        [labels.userStats, '➕ Додати користувача'],
        ['📢 Розсилка', '✉️ Написати юзеру'],
        [labels.templates, labels.help],
    ]).resize();
}

/**
 * Клавіатура вибору шаблону (тільки Word)
 */
export function templatesKeyboard(lang: Language = 'uk') {
    const labels = lang === 'uk' ? {
        word: '📝 Шаблон Word',
        back: '◀️ Назад',
    } : {
        word: '📝 Word Template',
        back: '◀️ Back',
    };

    return Markup.keyboard([
        [labels.word],
        [labels.back],
    ]).resize();
}

/**
 * Клавіатура Так/Ні
 */
export function yesNoKeyboard(lang: Language = 'uk') {
    const labels = lang === 'uk' ? {
        yes: '✅ Так',
        no: '❌ Ні',
    } : {
        yes: '✅ Yes',
        no: '❌ No',
    };

    return Markup.keyboard([
        [labels.yes, labels.no],
    ]).resize().oneTime();
}

/**
 * Клавіатура для оновлення звіту
 */
export function updateReportKeyboard(lang: Language = 'uk') {
    const labels = lang === 'uk' ? {
        append: '➕ Доповнити',
        replace: '🔄 Замінити',
        cancel: '❌ Скасувати',
    } : {
        append: '➕ Append',
        replace: '🔄 Replace',
        cancel: '❌ Cancel',
    };

    return Markup.keyboard([
        [labels.append, labels.replace],
        [labels.cancel],
    ]).resize().oneTime();
}

/**
 * Клавіатура з кнопкою пропуску
 */
export function skipKeyboard(lang: Language = 'uk') {
    const label = lang === 'uk' ? '⏭ Пропустити' : '⏭ Skip';
    return Markup.keyboard([[label]]).resize().oneTime();
}

/**
 * Клавіатура скасування
 */
export function cancelKeyboard(lang: Language = 'uk') {
    const label = lang === 'uk' ? '❌ Скасувати' : '❌ Cancel';
    return Markup.keyboard([[label]]).resize().oneTime();
}

/**
 * Клавіатура для вибору позиції
 */
export function positionKeyboard(lang: Language = 'uk') {
    const positions: Array<{ value: Position; label: string }> = lang === 'uk' ? [
        { value: 'PM', label: '👔 Project Manager' },
        { value: 'Dev', label: '💻 Розробник' },
        { value: 'Design', label: '🎨 Дизайнер' },
        { value: 'QA', label: '🔍 Тестувальник' },
        { value: 'BA', label: '📊 Бізнес-аналітик' },
        { value: 'Other', label: '📁 Інше' },
    ] : [
        { value: 'PM', label: '👔 Project Manager' },
        { value: 'Dev', label: '💻 Developer' },
        { value: 'Design', label: '🎨 Designer' },
        { value: 'QA', label: '🔍 QA Engineer' },
        { value: 'BA', label: '📊 Business Analyst' },
        { value: 'Other', label: '📁 Other' },
    ];

    return Markup.keyboard(
        positions.map(p => [p.label])
    ).resize().oneTime();
}

/**
 * Клавіатура для вибору команди
 */
export function teamKeyboard(lang: Language = 'uk') {
    const teams: Array<{ value: Team; label: string }> = [
        { value: 'Core', label: '🏛️ Core' },
        { value: 'Mobile', label: '📱 Mobile' },
        { value: 'Web', label: '🌐 Web' },
        { value: 'Infra', label: '⚙️ Infra' },
        { value: 'Data', label: '📊 Data' },
        { value: 'Other', label: '📁 Other' },
    ];

    return Markup.keyboard([
        [teams[0].label, teams[1].label, teams[2].label],
        [teams[3].label, teams[4].label, teams[5].label],
    ]).resize().oneTime();
}

/**
 * Клавіатура для вибору навантаження
 */
export function workloadKeyboard(lang: Language = 'uk') {
    const labels = lang === 'uk' ? [
        '1️⃣ Дуже низьке',
        '2️⃣ Низьке',
        '3️⃣ Середнє',
        '4️⃣ Високе',
        '5️⃣ Критичне',
    ] : [
        '1️⃣ Very Low',
        '2️⃣ Low',
        '3️⃣ Medium',
        '4️⃣ High',
        '5️⃣ Critical',
    ];

    return Markup.keyboard([
        [labels[0], labels[1]],
        [labels[2]],
        [labels[3], labels[4]],
    ]).resize().oneTime();
}

/**
 * Клавіатура для додавання ще задачі
 */
export function addMoreKeyboard(lang: Language = 'uk') {
    const labels = lang === 'uk' ? {
        add: '➕ Додати ще',
        done: '✅ Готово',
        cancel: '❌ Скасувати',
    } : {
        add: '➕ Add more',
        done: '✅ Done',
        cancel: '❌ Cancel',
    };

    return Markup.keyboard([
        [labels.add, labels.done],
        [labels.cancel],
    ]).resize().oneTime();
}

/**
 * Клавіатура підтвердження звіту
 */
export function confirmReportKeyboard(lang: Language = 'uk') {
    const labels = lang === 'uk' ? {
        confirm: '✅ Підтвердити і надіслати',
        edit: '✏️ Редагувати',
        cancel: '❌ Скасувати',
    } : {
        confirm: '✅ Confirm and send',
        edit: '✏️ Edit',
        cancel: '❌ Cancel',
    };

    return Markup.keyboard([
        [labels.confirm],
        [labels.edit, labels.cancel],
    ]).resize().oneTime();
}

/**
 * Inline клавіатура для звітів
 */
export function reportInlineKeyboard(reportId: number, trelloUrl?: string, lang: Language = 'uk') {
    const buttons = [];

    if (trelloUrl) {
        buttons.push([
            Markup.button.url(
                lang === 'uk' ? '📋 Відкрити в Trello' : '📋 Open in Trello',
                trelloUrl
            ),
        ]);
    }

    buttons.push([
        Markup.button.callback(
            lang === 'uk' ? '📄 Експорт PDF' : '📄 Export PDF',
            `export_pdf:${reportId}`
        ),
    ]);

    return Markup.inlineKeyboard(buttons);
}

/**
 * Inline клавіатура для статистики команди
 */
export function teamStatsInlineKeyboard(lang: Language = 'uk') {
    const teams: Team[] = ['Core', 'Mobile', 'Web', 'Infra', 'Data'];

    return Markup.inlineKeyboard([
        teams.slice(0, 3).map(team => Markup.button.callback(team, `team_stats:${team}`)),
        teams.slice(3).map(team => Markup.button.callback(team, `team_stats:${team}`)),
    ]);
}

/**
 * Inline клавіатура для вибору тижня
 */
export function weekSelectorKeyboard(currentWeek: number, lang: Language = 'uk') {
    const weeks = [
        currentWeek - 2,
        currentWeek - 1,
        currentWeek,
        currentWeek + 1,
    ].filter(w => w > 0 && w <= 53);

    return Markup.inlineKeyboard([
        weeks.map(week => 
            Markup.button.callback(
                week === currentWeek ? `📍 ${week}` : String(week),
                `select_week:${week}`
            )
        ),
    ]);
}

/**
 * Inline клавіатура для навігації по звітах
 */
export function reportsNavigationKeyboard(
    page: number, 
    totalPages: number, 
    lang: Language = 'uk'
) {
    const buttons = [];

    if (page > 1) {
        buttons.push(Markup.button.callback('« ' + (lang === 'uk' ? 'Попер.' : 'Prev'), `reports_page:${page - 1}`));
    }

    buttons.push(Markup.button.callback(`${page}/${totalPages}`, 'noop'));

    if (page < totalPages) {
        buttons.push(Markup.button.callback((lang === 'uk' ? 'Наст.' : 'Next') + ' »', `reports_page:${page + 1}`));
    }

    return Markup.inlineKeyboard([buttons]);
}

/**
 * Клавіатура налаштувань
 */
export function settingsKeyboard(lang: Language = 'uk') {
    const labels = lang === 'uk' ? {
        language: '🌐 Мова',
        notifications: '🔔 Сповіщення',
        profile: '👤 Профіль',
        back: '« Назад',
    } : {
        language: '🌐 Language',
        notifications: '🔔 Notifications',
        profile: '👤 Profile',
        back: '« Back',
    };

    return Markup.keyboard([
        [labels.language, labels.notifications],
        [labels.profile],
        [labels.back],
    ]).resize();
}

/**
 * Клавіатура вибору мови
 */
export function languageKeyboard() {
    return Markup.inlineKeyboard([
        [
            Markup.button.callback('🇺🇦 Українська', 'set_lang:uk'),
            Markup.button.callback('🇬🇧 English', 'set_lang:en'),
        ],
    ]);
}

/**
 * Видалити клавіатуру
 */
export function removeKeyboard() {
    return Markup.removeKeyboard();
}

/**
 * Клавіатура пагінації звітів
 */
export function paginationKeyboard(currentPage: number, totalPages: number, lang: Language = 'uk') {
    const buttons: any[] = [];
    
    if (currentPage > 1) {
        buttons.push(Markup.button.callback(
            lang === 'uk' ? '◀️ Назад' : '◀️ Previous',
            `reports_page:${currentPage - 1}`
        ));
    }
    
    if (currentPage < totalPages) {
        buttons.push(Markup.button.callback(
            lang === 'uk' ? 'Далі ▶️' : 'Next ▶️',
            `reports_page:${currentPage + 1}`
        ));
    }
    
    return Markup.inlineKeyboard([buttons]);
}

export default {
    mainMenu,
    yesNoKeyboard,
    updateReportKeyboard,
    skipKeyboard,
    cancelKeyboard,
    positionKeyboard,
    teamKeyboard,
    workloadKeyboard,
    addMoreKeyboard,
    confirmReportKeyboard,
    reportInlineKeyboard,
    teamStatsInlineKeyboard,
    weekSelectorKeyboard,
    reportsNavigationKeyboard,
    settingsKeyboard,
    languageKeyboard,
    removeKeyboard,
    templatesKeyboard,
    paginationKeyboard,
};
