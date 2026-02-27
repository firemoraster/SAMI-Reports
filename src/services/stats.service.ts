/**
 * SAMI Weekly Reports - Statistics Service
 * Розрахунок та аналіз статистики звітів
 */

import { Op } from 'sequelize';
import { Report, User, CompletedTask, NotCompletedTask, sequelize } from '../database/models';
import { getWeekNumber, getCurrentYear, formatDate, roundTo, average } from '../utils/helpers';
import logger from '../utils/logger';
import type { Team, TeamStats, UserStats, PeriodStats, Language } from '../types';

// ============================================
// TEAM STATISTICS
// ============================================

/**
 * Отримати статистику команди за тиждень
 */
export async function getTeamWeeklyStats(team: Team, weekNumber?: number, year?: number): Promise<TeamStats | null> {
    const week = weekNumber || getWeekNumber(new Date());
    const yr = year || getCurrentYear();

    try {
        // Отримати всіх членів команди
        const teamMembers = await User.findAll({
            where: { team },
        });

        if (teamMembers.length === 0) {
            return null;
        }

        const userIds = teamMembers.map(u => u.userId);

        // Отримати звіти за тиждень
        const reports = await Report.findAll({
            where: {
                userId: { [Op.in]: userIds },
                weekNumber: week,
                year: yr,
            },
            include: [
                { model: User, as: 'user' },
                { model: NotCompletedTask, as: 'notCompletedTasks' },
            ],
        });

        if (reports.length === 0) {
            return {
                team,
                totalMembers: teamMembers.length,
                totalReports: 0,
                averageWorkload: 0,
                averageCompletionRate: 0,
                totalBlockers: 0,
                overdueTasksCount: 0,
                topPerformers: [],
                problemReports: [],
            };
        }

        // Розрахунки
        const workloads = reports.map(r => r.workload);
        const completionRates = reports.map(r => r.completionRate);
        const blockerReports = reports.filter(r => r.hasBlockers);

        // Прострочені задачі
        let overdueCount = 0;
        for (const report of reports) {
            const tasks = report.get('notCompletedTasks') as NotCompletedTask[];
            if (tasks) {
                for (const task of tasks) {
                    if (task.eta && new Date(task.eta) < new Date()) {
                        overdueCount++;
                    }
                }
            }
        }

        // Кращі / проблемні звіти
        const sortedByCompletion = [...reports].sort((a, b) => b.completionRate - a.completionRate);
        const topPerformers = sortedByCompletion
            .filter(r => r.completionRate >= 90)
            .slice(0, 3)
            .map(r => {
                const user = r.get('user') as User;
                return user?.name || 'Unknown';
            });

        const problemReports = sortedByCompletion
            .filter(r => r.completionRate < 70 || r.workload >= 4 || r.hasBlockers)
            .slice(0, 5)
            .map(r => {
                const user = r.get('user') as User;
                return user?.name || 'Unknown';
            });

        return {
            team,
            totalMembers: teamMembers.length,
            totalReports: reports.length,
            averageWorkload: roundTo(average(workloads), 1),
            averageCompletionRate: Math.round(average(completionRates)),
            totalBlockers: blockerReports.length,
            overdueTasksCount: overdueCount,
            topPerformers,
            problemReports,
        };
    } catch (error) {
        logger.error('Error getting team stats:', error);
        throw error;
    }
}

/**
 * Отримати статистику всіх команд
 */
export async function getAllTeamsStats(weekNumber?: number, year?: number): Promise<TeamStats[]> {
    const teams: Team[] = ['Core', 'Mobile', 'Web', 'Infra', 'Data', 'Other'];
    const stats: TeamStats[] = [];

    for (const team of teams) {
        const teamStats = await getTeamWeeklyStats(team, weekNumber, year);
        if (teamStats && teamStats.totalReports > 0) {
            stats.push(teamStats);
        }
    }

    return stats;
}

// ============================================
// USER STATISTICS
// ============================================

/**
 * Отримати статистику користувача
 */
export async function getUserStats(userId: number, weeksCount: number = 12): Promise<UserStats | null> {
    try {
        const user = await User.findByPk(userId);
        if (!user) return null;

        // Останні N тижнів звітів
        const reports = await Report.findAll({
            where: { userId },
            order: [['year', 'DESC'], ['weekNumber', 'DESC']],
            limit: weeksCount,
        });

        if (reports.length === 0) {
            return {
                userId,
                name: user.name,
                totalReports: 0,
                averageWorkload: 0,
                averageCompletionRate: 0,
                totalBlockers: 0,
                weeklyTrend: [],
            };
        }

        const workloads = reports.map(r => r.workload);
        const completionRates = reports.map(r => r.completionRate);
        const blockerReports = reports.filter(r => r.hasBlockers);

        return {
            userId,
            name: user.name,
            totalReports: reports.length,
            averageWorkload: roundTo(average(workloads), 1),
            averageCompletionRate: Math.round(average(completionRates)),
            totalBlockers: blockerReports.length,
            weeklyTrend: reports.map(r => r.completionRate).reverse(),
        };
    } catch (error) {
        logger.error('Error getting user stats:', error);
        throw error;
    }
}

// ============================================
// PERIOD STATISTICS
// ============================================

/**
 * Отримати статистику за період
 */
export async function getPeriodStats(startDate: Date, endDate: Date): Promise<PeriodStats> {
    try {
        const reports = await Report.findAll({
            where: {
                createdAt: {
                    [Op.between]: [startDate, endDate],
                },
            },
            include: [
                { model: User, as: 'user' },
                { model: NotCompletedTask, as: 'notCompletedTasks' },
            ],
        });

        if (reports.length === 0) {
            return {
                startDate,
                endDate,
                totalReports: 0,
                averageWorkload: 0,
                averageCompletionRate: 0,
                topReasons: [],
                teamComparison: [],
            };
        }

        // Збір причин невиконання
        const reasons: Map<string, number> = new Map();
        for (const report of reports) {
            const tasks = report.get('notCompletedTasks') as NotCompletedTask[];
            if (tasks) {
                for (const task of tasks) {
                    const reason = task.reason.toLowerCase().trim();
                    reasons.set(reason, (reasons.get(reason) || 0) + 1);
                }
            }
        }

        const topReasons = Array.from(reasons.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .map(([reason, count]) => ({ reason, count }));

        // Статистика по командах
        const teamComparison = await getAllTeamsStats();

        return {
            startDate,
            endDate,
            totalReports: reports.length,
            averageWorkload: roundTo(average(reports.map(r => r.workload)), 1),
            averageCompletionRate: Math.round(average(reports.map(r => r.completionRate))),
            topReasons,
            teamComparison,
        };
    } catch (error) {
        logger.error('Error getting period stats:', error);
        throw error;
    }
}

// ============================================
// AGGREGATED STATISTICS
// ============================================

/**
 * Загальна статистика системи
 */
export async function getOverallStats(): Promise<{
    totalUsers: number;
    totalReports: number;
    totalCompletedTasks: number;
    totalNotCompletedTasks: number;
    averageCompletionRate: number;
    averageWorkload: number;
}> {
    try {
        const totalUsers = await User.count();
        const totalReports = await Report.count();
        const totalCompletedTasks = await CompletedTask.count();
        const totalNotCompletedTasks = await NotCompletedTask.count();

        const avgStats = await Report.findOne({
            attributes: [
                [sequelize.fn('AVG', sequelize.col('completion_rate')), 'avgCompletion'],
                [sequelize.fn('AVG', sequelize.col('workload')), 'avgWorkload'],
            ],
            raw: true,
        }) as any;

        return {
            totalUsers,
            totalReports,
            totalCompletedTasks,
            totalNotCompletedTasks,
            averageCompletionRate: Math.round(avgStats?.avgCompletion || 0),
            averageWorkload: roundTo(avgStats?.avgWorkload || 0, 1),
        };
    } catch (error) {
        logger.error('Error getting overall stats:', error);
        throw error;
    }
}

/**
 * Користувачі без звітів за тиждень
 */
export async function getUsersWithoutReports(weekNumber?: number, year?: number): Promise<User[]> {
    const week = weekNumber || getWeekNumber(new Date());
    const yr = year || getCurrentYear();

    try {
        // Всі користувачі
        const allUsers = await User.findAll();

        // Користувачі зі звітами
        const reportsThisWeek = await Report.findAll({
            where: { weekNumber: week, year: yr },
            attributes: ['userId'],
        });

        const usersWithReports = new Set(reportsThisWeek.map(r => r.userId));

        // Фільтрація
        return allUsers.filter(u => !usersWithReports.has(u.userId));
    } catch (error) {
        logger.error('Error getting users without reports:', error);
        throw error;
    }
}

// ============================================
// FORMATTED OUTPUT
// ============================================

/**
 * Форматування статистики команди для Telegram
 */
export function formatTeamStatsMessage(stats: TeamStats, weekNumber: number, lang: Language = 'uk'): string {
    const labels = lang === 'uk' ? {
        header: `📊 СТАТИСТИКА ЗА ТИЖДЕНЬ ${String(weekNumber).padStart(2, '0')}`,
        team: `Команда ${stats.team}`,
        members: 'співробітників',
        avgWorkload: 'Середнє навантаження',
        completion: '% виконання',
        blockers: 'Блокерів',
        overdue: 'Прострочено',
        tasks: 'задач',
        problemReports: 'Проблемні звіти',
        topPerformers: 'Кращі результати',
        noReports: 'Звітів за цей тиждень немає',
    } : {
        header: `📊 STATISTICS FOR WEEK ${String(weekNumber).padStart(2, '0')}`,
        team: `Team ${stats.team}`,
        members: 'employees',
        avgWorkload: 'Average workload',
        completion: 'Completion rate',
        blockers: 'Blockers',
        overdue: 'Overdue',
        tasks: 'tasks',
        problemReports: 'Problem reports',
        topPerformers: 'Top performers',
        noReports: 'No reports for this week',
    };

    if (stats.totalReports === 0) {
        return `${labels.header}\n\n${labels.noReports}`;
    }

    let message = `${labels.header}\n\n`;
    message += `**${labels.team}** (${stats.totalMembers} ${labels.members}):\n`;
    message += `• ${labels.avgWorkload}: ${stats.averageWorkload}/5\n`;
    message += `• ${labels.completion}: ${stats.averageCompletionRate}%\n`;
    message += `• ${labels.blockers}: ${stats.totalBlockers}\n`;
    message += `• ${labels.overdue}: ${stats.overdueTasksCount} ${labels.tasks}\n`;

    if (stats.problemReports.length > 0) {
        message += `\n⚠️ ${labels.problemReports}: ${stats.problemReports.join(', ')}\n`;
    }

    if (stats.topPerformers.length > 0) {
        message += `\n🏆 ${labels.topPerformers}: ${stats.topPerformers.join(', ')}\n`;
    }

    return message;
}

/**
 * Форматування статистики користувача для Telegram
 */
export function formatUserStatsMessage(stats: UserStats, lang: Language = 'uk'): string {
    const labels = lang === 'uk' ? {
        header: '📊 ВАША СТАТИСТИКА',
        totalReports: 'Всього звітів',
        avgWorkload: 'Середнє навантаження',
        avgCompletion: 'Середній % виконання',
        blockers: 'Звітів з блокерами',
        trend: 'Тренд виконання',
        noData: 'Недостатньо даних для аналізу',
    } : {
        header: '📊 YOUR STATISTICS',
        totalReports: 'Total reports',
        avgWorkload: 'Average workload',
        avgCompletion: 'Average completion',
        blockers: 'Reports with blockers',
        trend: 'Completion trend',
        noData: 'Not enough data for analysis',
    };

    if (stats.totalReports === 0) {
        return `${labels.header}\n\n${labels.noData}`;
    }

    let message = `${labels.header}\n\n`;
    message += `👤 ${stats.name}\n\n`;
    message += `• ${labels.totalReports}: ${stats.totalReports}\n`;
    message += `• ${labels.avgWorkload}: ${stats.averageWorkload}/5\n`;
    message += `• ${labels.avgCompletion}: ${stats.averageCompletionRate}%\n`;
    message += `• ${labels.blockers}: ${stats.totalBlockers}\n`;

    if (stats.weeklyTrend.length >= 4) {
        const trend = stats.weeklyTrend.slice(-4);
        const trendEmojis = trend.map(v => v >= 80 ? '📈' : v >= 60 ? '➡️' : '📉').join('');
        message += `\n${labels.trend}: ${trendEmojis}\n`;
        message += `(${trend.join('% → ')}%)\n`;
    }

    return message;
}

export default {
    getTeamWeeklyStats,
    getAllTeamsStats,
    getUserStats,
    getPeriodStats,
    getOverallStats,
    getUsersWithoutReports,
    formatTeamStatsMessage,
    formatUserStatsMessage,
};
