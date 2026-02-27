/**
 * SAMI Weekly Reports - Helper Functions
 * Допоміжні функції для роботи з датами, форматуванням тощо
 */

import { format, getISOWeek, getYear, startOfWeek, endOfWeek, parseISO, isValid } from 'date-fns';
import { uk, enUS } from 'date-fns/locale';
import type { Position, Team, Workload, Language } from '../types';

// ============================================
// DATE HELPERS
// ============================================

/**
 * Отримати номер тижня для дати
 */
export function getWeekNumber(date: Date = new Date()): number {
    return getISOWeek(date);
}

/**
 * Отримати поточний рік
 */
export function getCurrentYear(): number {
    return getYear(new Date());
}

/**
 * Отримати початок тижня
 */
export function getWeekStart(date: Date = new Date()): Date {
    return startOfWeek(date, { weekStartsOn: 1 }); // Понеділок
}

/**
 * Отримати кінець тижня
 */
export function getWeekEnd(date: Date = new Date()): Date {
    return endOfWeek(date, { weekStartsOn: 1 });
}

/**
 * Форматування дати
 */
export function formatDate(date: Date | string, formatStr: string = 'dd.MM.yyyy', lang: Language = 'uk'): string {
    const d = typeof date === 'string' ? parseISO(date) : date;
    if (!isValid(d)) return 'Invalid date';
    
    const locale = lang === 'uk' ? uk : enUS;
    return format(d, formatStr, { locale });
}

/**
 * Форматування дати та часу
 */
export function formatDateTime(date: Date | string, lang: Language = 'uk'): string {
    return formatDate(date, 'dd.MM.yyyy HH:mm', lang);
}

/**
 * Парсинг дати з рядка
 */
export function parseDate(dateStr: string): Date | null {
    const parsed = parseISO(dateStr);
    return isValid(parsed) ? parsed : null;
}

// ============================================
// STRING HELPERS
// ============================================

/**
 * Обрізати текст до максимальної довжини
 */
export function truncate(text: string, maxLength: number = 100, suffix: string = '...'): string {
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength - suffix.length) + suffix;
}

/**
 * Екранування HTML
 */
export function escapeHtml(text: string): string {
    const map: Record<string, string> = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;',
    };
    return text.replace(/[&<>"']/g, m => map[m]);
}

/**
 * Екранування Markdown
 */
export function escapeMarkdown(text: string): string {
    return text.replace(/[_*[\]()~`>#+=|{}.!-]/g, '\\$&');
}

// ============================================
// VALIDATION HELPERS
// ============================================

/**
 * Перевірка валідності позиції
 */
export function isValidPosition(position: string): position is Position {
    const validPositions: Position[] = ['PM', 'Dev', 'Design', 'QA', 'BA', 'Other'];
    return validPositions.includes(position as Position);
}

/**
 * Перевірка валідності команди
 */
export function isValidTeam(team: string): team is Team {
    const validTeams: Team[] = ['Core', 'Mobile', 'Web', 'Infra', 'Data', 'Other'];
    return validTeams.includes(team as Team);
}

/**
 * Перевірка валідності навантаження
 */
export function isValidWorkload(workload: number): workload is Workload {
    return [1, 2, 3, 4, 5].includes(workload);
}

// ============================================
// FORMATTING HELPERS
// ============================================

/**
 * Форматування рівня навантаження
 */
export function formatWorkload(workload: Workload, lang: Language = 'uk'): string {
    const labels = {
        uk: {
            1: '🟢 Дуже низьке',
            2: '🟢 Низьке',
            3: '🟡 Середнє',
            4: '🟠 Високе',
            5: '🔴 Критичне',
        },
        en: {
            1: '🟢 Very Low',
            2: '🟢 Low',
            3: '🟡 Medium',
            4: '🟠 High',
            5: '🔴 Critical',
        },
    };
    return labels[lang][workload];
}

/**
 * Форматування відсотка виконання
 */
export function formatCompletionRate(rate: number): string {
    if (rate >= 90) return `📈 ${rate}%`;
    if (rate >= 70) return `✅ ${rate}%`;
    if (rate >= 50) return `⚠️ ${rate}%`;
    return `❌ ${rate}%`;
}

/**
 * Форматування позиції
 */
export function formatPosition(position: Position, lang: Language = 'uk'): string {
    const labels = {
        uk: {
            PM: 'Проджект Менеджер',
            Dev: 'Розробник',
            Design: 'Дизайнер',
            QA: 'Тестувальник',
            BA: 'Бізнес-аналітик',
            Helpdesk: 'Хелпдеск',
            Support: 'Підтримка',
            Other: 'Інше',
        },
        en: {
            PM: 'Project Manager',
            Dev: 'Developer',
            Design: 'Designer',
            QA: 'QA Engineer',
            BA: 'Business Analyst',
            Helpdesk: 'Helpdesk',
            Support: 'Support',
            Other: 'Other',
        },
    };
    return labels[lang][position];
}

/**
 * Форматування команди
 */
export function formatTeam(team: Team): string {
    const emojis: Record<Team, string> = {
        Core: '🏛️',
        Mobile: '📱',
        Web: '🌐',
        Infra: '⚙️',
        Data: '📊',
        SAMI: '🏢',
        Other: '📁',
    };
    return `${emojis[team]} ${team}`;
}

// ============================================
// CALCULATION HELPERS
// ============================================

/**
 * Розрахунок відсотка виконання
 */
export function calculateCompletionRate(completed: number, total: number): number {
    if (total === 0) return 0;
    return Math.round((completed / total) * 100);
}

/**
 * Середнє значення
 */
export function average(numbers: number[]): number {
    if (numbers.length === 0) return 0;
    return numbers.reduce((sum, n) => sum + n, 0) / numbers.length;
}

/**
 * Округлення до N знаків
 */
export function roundTo(num: number, decimals: number = 1): number {
    const factor = Math.pow(10, decimals);
    return Math.round(num * factor) / factor;
}

// ============================================
// TRELLO HELPERS
// ============================================

/**
 * Генерація назви картки Trello
 */
export function generateCardName(name: string, weekNumber: number, year: number): string {
    return `📋 ${name} - Week ${String(weekNumber).padStart(2, '0')}/${year}`;
}

/**
 * Генерація опису картки Trello
 */
export function generateCardDescription(
    user: { name: string; position: string; team: string },
    report: {
        workload: number;
        tasksCompleted: number;
        tasksNotCompleted: number;
        completionRate: number;
        concerns?: string | null;
        improvements?: string | null;
        priorities?: string | null;
    },
    completedTasks: Array<{ title: string; project?: string; hours: number }>,
    notCompletedTasks: Array<{ title: string; reason: string; eta?: Date | string | null; blocker?: string | null }>
): string {
    let desc = `## 📊 Weekly Report\n\n`;
    desc += `**👤 Employee:** ${user.name}\n`;
    desc += `**💼 Position:** ${user.position}\n`;
    desc += `**👥 Team:** ${user.team}\n`;
    desc += `**📅 Date:** ${formatDate(new Date())}\n\n`;

    desc += `---\n\n`;

    desc += `### 📈 Summary\n`;
    desc += `- **Workload:** ${report.workload}/5\n`;
    desc += `- **Completed:** ${report.tasksCompleted} tasks\n`;
    desc += `- **Not Completed:** ${report.tasksNotCompleted} tasks\n`;
    desc += `- **Completion Rate:** ${report.completionRate}%\n\n`;

    if (completedTasks.length > 0) {
        desc += `### ✅ Completed Tasks\n`;
        completedTasks.forEach((task, i) => {
            desc += `${i + 1}. **${task.title}** - ${task.hours}h\n`;
        });
        desc += `\n`;
    }

    if (notCompletedTasks.length > 0) {
        desc += `### ❌ Not Completed Tasks\n`;
        notCompletedTasks.forEach((task, i) => {
            desc += `${i + 1}. **${task.title}**\n`;
            desc += `   - Reason: ${task.reason}\n`;
            if (task.eta) desc += `   - ETA: ${formatDate(task.eta)}\n`;
            if (task.blocker) desc += `   - ⚠️ Blocker: ${task.blocker}\n`;
        });
        desc += `\n`;
    }

    if (report.concerns) {
        desc += `### 😟 Concerns\n${report.concerns}\n\n`;
    }

    if (report.improvements) {
        desc += `### 💡 Improvements\n${report.improvements}\n\n`;
    }

    if (report.priorities) {
        desc += `### 🎯 Next Week Priorities\n${report.priorities}\n\n`;
    }

    desc += `---\n*Generated by SAMI Weekly Reports Bot*`;

    return desc;
}

// ============================================
// OTHER HELPERS
// ============================================

/**
 * Затримка виконання
 */
export function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Генерація UUID
 */
export function generateId(): string {
    return Math.random().toString(36).substring(2, 15) + 
           Math.random().toString(36).substring(2, 15);
}

/**
 * Отримання emoji для навантаження
 */
export function getWorkloadEmoji(workload: Workload): string {
    const emojis: Record<Workload, string> = {
        1: '🟢',
        2: '🟢',
        3: '🟡',
        4: '🟠',
        5: '🔴',
    };
    return emojis[workload];
}
