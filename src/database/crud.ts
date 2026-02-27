/**
 * SAMI Weekly Reports - Database CRUD Operations
 * CRUD операції для роботи з базою даних
 */

import { Op } from 'sequelize';
import { User, Report, CompletedTask, NotCompletedTask, Setting, sequelize } from './models';
import type { 
    CreateUserDto, 
    CreateReportDto, 
    CompletedTask as CompletedTaskType, 
    NotCompletedTask as NotCompletedTaskType,
    Position,
    Team,
    Workload
} from '../types';
import { getWeekNumber, getCurrentYear } from '../utils';
import logger from '../utils/logger';

// ============================================
// USER CRUD
// ============================================

export const userCrud = {
    /**
     * Створити нового користувача
     */
    async create(data: CreateUserDto): Promise<User> {
        try {
            const user = await User.create({
                telegramId: data.telegramId,
                name: data.name,
                position: data.position || 'Other',
                team: data.team || 'Other',
                isManager: data.isManager || false,
                managerId: data.managerId || null,
                language: data.language || 'uk',
            });
            logger.info(`User created: ${user.userId} (${user.name})`);
            return user;
        } catch (error) {
            logger.error('Error creating user:', error);
            throw error;
        }
    },

    /**
     * Знайти користувача за Telegram ID
     */
    async findByTelegramId(telegramId: number): Promise<User | null> {
        return User.findOne({
            where: { telegramId },
            include: [{ model: User, as: 'manager' }],
        });
    },

    /**
     * Знайти користувача за ID
     */
    async findById(userId: number): Promise<User | null> {
        return User.findByPk(userId, {
            include: [{ model: User, as: 'manager' }],
        });
    },

    /**
     * Оновити користувача
     */
    async update(userId: number, data: Partial<CreateUserDto>): Promise<User | null> {
        const user = await User.findByPk(userId);
        if (!user) return null;
        
        await user.update(data);
        logger.info(`User updated: ${userId}`);
        return user;
    },

    /**
     * Отримати підлеглих менеджера
     */
    async getSubordinates(managerId: number): Promise<User[]> {
        return User.findAll({
            where: { managerId },
            order: [['name', 'ASC']],
        });
    },

    /**
     * Отримати всіх користувачів команди
     */
    async getTeamMembers(team: Team): Promise<User[]> {
        return User.findAll({
            where: { team },
            order: [['name', 'ASC']],
        });
    },

    /**
     * Отримати всіх менеджерів
     */
    async getManagers(): Promise<User[]> {
        return User.findAll({
            where: { isManager: true },
            order: [['name', 'ASC']],
        });
    },

    /**
     * Отримати або створити користувача
     */
    async findOrCreate(telegramId: number, name: string): Promise<User> {
        const [user] = await User.findOrCreate({
            where: { telegramId },
            defaults: {
                telegramId,
                name,
                position: 'Other',
                team: 'Other',
                isManager: false,
                managerId: null,
                language: 'uk',
            },
        });
        return user;
    },

    /**
     * Отримати всіх користувачів
     */
    async findAll(): Promise<User[]> {
        return User.findAll({
            order: [['name', 'ASC']],
        });
    },

    /**
     * Отримати користувачів без звіту за тиждень
     */
    async getUsersWithoutReports(weekNumber: number, year: number, team?: Team): Promise<User[]> {
        const whereClause: any = {};
        if (team) {
            whereClause.team = team;
        }

        const allUsers = await User.findAll({ where: whereClause });
        const usersWithReports = await Report.findAll({
            where: { weekNumber, year },
            attributes: ['userId'],
            raw: true,
        });

        const usersWithReportIds = new Set(usersWithReports.map((r: any) => r.userId));
        return allUsers.filter(user => !usersWithReportIds.has(user.userId));
    },
};

// ============================================
// REPORT CRUD
// ============================================

export const reportCrud = {
    /**
     * Створити новий звіт
     */
    async create(data: CreateReportDto): Promise<Report> {
        const transaction = await sequelize.transaction();
        
        try {
            const tasksCompletedCount = data.completedTasks.length;
            const tasksNotCompletedCount = data.notCompletedTasks.length;
            const totalTasks = tasksCompletedCount + tasksNotCompletedCount;
            const completionRate = totalTasks > 0 
                ? Math.round((tasksCompletedCount / totalTasks) * 100) 
                : 0;
            const hasBlockers = data.notCompletedTasks.some(task => task.blocker && task.blocker.trim() !== '');

            // Створити звіт
            const report = await Report.create({
                userId: data.userId,
                weekNumber: data.weekNumber,
                year: data.year,
                workload: data.workload,
                tasksCompleted: tasksCompletedCount,
                tasksNotCompleted: tasksNotCompletedCount,
                completionRate,
                hasBlockers,
                concerns: data.concerns || null,
                improvements: data.improvements || null,
                priorities: data.priorities || null,
            }, { transaction });

            // Створити виконані задачі
            if (data.completedTasks.length > 0) {
                await CompletedTask.bulkCreate(
                    data.completedTasks.map(task => ({
                        reportId: report.reportId,
                        title: task.title,
                        project: task.project || '',
                        hours: task.hours,
                    })),
                    { transaction }
                );
            }

            // Створити невиконані задачі
            if (data.notCompletedTasks.length > 0) {
                await NotCompletedTask.bulkCreate(
                    data.notCompletedTasks.map(task => ({
                        reportId: report.reportId,
                        title: task.title,
                        reason: task.reason,
                        eta: task.eta ? new Date(task.eta) : null,
                        blocker: task.blocker || null,
                    })),
                    { transaction }
                );
            }

            await transaction.commit();
            logger.info(`Report created: ${report.reportId} for user ${data.userId}`);
            return report;
        } catch (error) {
            await transaction.rollback();
            logger.error('Error creating report:', error);
            throw error;
        }
    },

    /**
     * Знайти звіт за ID
     */
    async findById(reportId: number): Promise<Report | null> {
        return Report.findByPk(reportId, {
            include: [
                { model: User, as: 'user' },
                { model: CompletedTask, as: 'completedTasks' },
                { model: NotCompletedTask, as: 'notCompletedTasks' },
            ],
        });
    },

    /**
     * Оновити Trello дані звіту
     */
    async updateTrelloInfo(reportId: number, cardId: string, cardUrl: string): Promise<void> {
        await Report.update(
            { trelloCardId: cardId, trelloCardUrl: cardUrl },
            { where: { reportId } }
        );
        logger.info(`Report ${reportId} updated with Trello card ${cardId}`);
    },

    /**
     * Отримати звіти користувача
     */
    async findByUser(userId: number, limit: number = 5, offset: number = 0): Promise<Report[]> {
        return Report.findAll({
            where: { userId },
            include: [
                { model: CompletedTask, as: 'completedTasks' },
                { model: NotCompletedTask, as: 'notCompletedTasks' },
            ],
            order: [['createdAt', 'DESC']],
            limit,
            offset,
        });
    },

    /**
     * Порахувати кількість звітів користувача
     */
    async countByUser(userId: number): Promise<number> {
        return Report.count({ where: { userId } });
    },

    /**
     * Отримати звіти команди за тиждень
     */
    async findByTeamAndWeek(team: Team, weekNumber: number, year: number): Promise<Report[]> {
        return Report.findAll({
            include: [
                {
                    model: User,
                    as: 'user',
                    where: { team },
                },
                { model: CompletedTask, as: 'completedTasks' },
                { model: NotCompletedTask, as: 'notCompletedTasks' },
            ],
            where: { weekNumber, year },
            order: [['createdAt', 'DESC']],
        });
    },

    /**
     * Отримати звіти за період
     */
    async findByPeriod(startDate: Date, endDate: Date): Promise<Report[]> {
        return Report.findAll({
            where: {
                createdAt: {
                    [Op.between]: [startDate, endDate],
                },
            },
            include: [
                { model: User, as: 'user' },
                { model: CompletedTask, as: 'completedTasks' },
                { model: NotCompletedTask, as: 'notCompletedTasks' },
            ],
            order: [['createdAt', 'DESC']],
        });
    },

    /**
     * Отримати поточний звіт користувача
     */
    async getCurrentReport(userId: number): Promise<Report | null> {
        const weekNumber = getWeekNumber(new Date());
        const year = getCurrentYear();
        
        return Report.findOne({
            where: { userId, weekNumber, year },
            include: [
                { model: CompletedTask, as: 'completedTasks' },
                { model: NotCompletedTask, as: 'notCompletedTasks' },
            ],
        });
    },

    /**
     * Перевірити чи існує звіт за тиждень
     */
    async existsForWeek(userId: number, weekNumber: number, year: number): Promise<boolean> {
        const count = await Report.count({
            where: { userId, weekNumber, year },
        });
        return count > 0;
    },

    /**
     * Знайти звіт за користувачем і тижнем
     */
    async findByUserAndWeek(userId: number, weekNumber: number, year: number): Promise<Report | null> {
        return Report.findOne({
            where: { userId, weekNumber, year },
            include: [
                { model: CompletedTask, as: 'completedTasks' },
                { model: NotCompletedTask, as: 'notCompletedTasks' },
            ],
        });
    },

    /**
     * Оновити звіт (доповнити задачами)
     */
    async updateReport(
        reportId: number, 
        data: {
            workload?: Workload;
            concerns?: string | null;
            newCompletedTasks?: CompletedTaskType[];
            newNotCompletedTasks?: NotCompletedTaskType[];
        }
    ): Promise<Report | null> {
        const transaction = await sequelize.transaction();
        
        try {
            const report = await Report.findByPk(reportId, {
                include: [
                    { model: CompletedTask, as: 'completedTasks' },
                    { model: NotCompletedTask, as: 'notCompletedTasks' },
                ],
            });
            
            if (!report) {
                await transaction.rollback();
                return null;
            }

            // Додати нові виконані задачі
            if (data.newCompletedTasks && data.newCompletedTasks.length > 0) {
                await CompletedTask.bulkCreate(
                    data.newCompletedTasks.map(task => ({
                        reportId: reportId,
                        title: task.title,
                        project: task.project || '',
                        hours: task.hours,
                    })),
                    { transaction }
                );
            }

            // Додати нові невиконані задачі
            if (data.newNotCompletedTasks && data.newNotCompletedTasks.length > 0) {
                await NotCompletedTask.bulkCreate(
                    data.newNotCompletedTasks.map(task => ({
                        reportId: reportId,
                        title: task.title,
                        reason: task.reason,
                        eta: task.eta ? new Date(task.eta) : null,
                        blocker: task.blocker || null,
                    })),
                    { transaction }
                );
            }

            // Підрахувати нові статистики
            const existingCompleted = (report as any).completedTasks?.length || 0;
            const existingNotCompleted = (report as any).notCompletedTasks?.length || 0;
            const newCompleted = data.newCompletedTasks?.length || 0;
            const newNotCompleted = data.newNotCompletedTasks?.length || 0;
            
            const totalCompleted = existingCompleted + newCompleted;
            const totalNotCompleted = existingNotCompleted + newNotCompleted;
            const totalTasks = totalCompleted + totalNotCompleted;
            const completionRate = totalTasks > 0 
                ? Math.round((totalCompleted / totalTasks) * 100) 
                : 0;
            
            const hasBlockers = data.newNotCompletedTasks?.some(task => task.blocker && task.blocker.trim() !== '') 
                || report.hasBlockers;

            // Оновити поля звіту
            await report.update({
                workload: data.workload !== undefined ? data.workload : report.workload,
                concerns: data.concerns !== undefined ? data.concerns : report.concerns,
                tasksCompleted: totalCompleted,
                tasksNotCompleted: totalNotCompleted,
                completionRate,
                hasBlockers,
                updatedAt: new Date(),
            }, { transaction });

            await transaction.commit();
            logger.info(`Report ${reportId} updated with new tasks`);
            
            // Повернути оновлений звіт
            return await this.findById(reportId);
        } catch (error) {
            await transaction.rollback();
            logger.error('Error updating report:', error);
            throw error;
        }
    },

    /**
     * @deprecated Use delete() instead
     */
    async deleteReport(reportId: number): Promise<boolean> {
        return this.delete(reportId);
    },

    /**
     * Отримати статистику команди
     */
    async getTeamStats(team: Team, weekNumber?: number, year?: number): Promise<any> {
        const week = weekNumber || getWeekNumber(new Date());
        const yr = year || getCurrentYear();
        
        const reports = await this.findByTeamAndWeek(team, week, yr);
        
        if (reports.length === 0) {
            return null;
        }

        const totalWorkload = reports.reduce((sum, r) => sum + r.workload, 0);
        const totalCompletionRate = reports.reduce((sum, r) => sum + r.completionRate, 0);
        const totalBlockers = reports.filter(r => r.hasBlockers).length;

        return {
            team,
            weekNumber: week,
            year: yr,
            totalReports: reports.length,
            averageWorkload: (totalWorkload / reports.length).toFixed(1),
            averageCompletionRate: Math.round(totalCompletionRate / reports.length),
            totalBlockers,
            reports,
        };
    },

    /**
     * Отримати всі звіти
     */
    async findAll(limit?: number): Promise<Report[]> {
        return Report.findAll({
            include: [
                { model: User, as: 'user' },
            ],
            order: [['createdAt', 'DESC']],
            limit,
        });
    },

    /**
     * Оновити звіт
     */
    async update(reportId: number, data: Partial<{
        workload: Workload;
        concerns: string;
        improvements: string;
        priorities: string;
        status: string;
    }>): Promise<Report | null> {
        const report = await Report.findByPk(reportId);
        if (!report) return null;
        
        await report.update(data);
        logger.info(`Report ${reportId} updated`);
        return report;
    },

    /**
     * Видалити звіт
     */
    async delete(reportId: number): Promise<boolean> {
        const transaction = await sequelize.transaction();
        try {
            await CompletedTask.destroy({ where: { reportId }, transaction });
            await NotCompletedTask.destroy({ where: { reportId }, transaction });
            const deleted = await Report.destroy({ where: { reportId }, transaction });
            await transaction.commit();
            if (deleted > 0) {
                logger.info(`Report ${reportId} deleted`);
            }
            return deleted > 0;
        } catch (error) {
            await transaction.rollback();
            logger.error('Error deleting report:', error);
            throw error;
        }
    },
};

// ============================================
// TASKS CRUD
// ============================================

export const tasksCrud = {
    /**
     * Отримати виконані задачі звіту
     */
    async getCompletedTasks(reportId: number): Promise<CompletedTask[]> {
        return CompletedTask.findAll({
            where: { reportId },
        });
    },

    /**
     * Отримати невиконані задачі звіту
     */
    async getNotCompletedTasks(reportId: number): Promise<NotCompletedTask[]> {
        return NotCompletedTask.findAll({
            where: { reportId },
        });
    },

    /**
     * Отримати прострочені задачі
     */
    async getOverdueTasks(): Promise<NotCompletedTask[]> {
        return NotCompletedTask.findAll({
            where: {
                eta: {
                    [Op.lt]: new Date(),
                },
            },
            include: [
                {
                    model: Report,
                    as: 'report',
                    include: [{ model: User, as: 'user' }],
                },
            ],
        });
    },

    /**
     * Отримати топ причин невиконання
     */
    async getTopReasons(limit: number = 10): Promise<Array<{ reason: string; count: number }>> {
        const result = await NotCompletedTask.findAll({
            attributes: [
                'reason',
                [sequelize.fn('COUNT', sequelize.col('reason')), 'count'],
            ],
            group: ['reason'],
            order: [[sequelize.fn('COUNT', sequelize.col('reason')), 'DESC']],
            limit,
            raw: true,
        });
        
        return result as unknown as Array<{ reason: string; count: number }>;
    },
};

// ============================================
// SETTINGS CRUD
// ============================================

export const settingsCrud = {
    /**
     * Отримати налаштування
     */
    async get(key: string): Promise<string | null> {
        const setting = await Setting.findByPk(key);
        return setting?.value || null;
    },

    /**
     * Встановити налаштування
     */
    async set(key: string, value: string): Promise<void> {
        await Setting.upsert({ key, value });
    },

    /**
     * Видалити налаштування
     */
    async delete(key: string): Promise<void> {
        await Setting.destroy({ where: { key } });
    },

    /**
     * Отримати всі налаштування
     */
    async getAll(): Promise<Setting[]> {
        return Setting.findAll();
    },
};

// ============================================
// STATS CRUD
// ============================================

export interface UserStats {
    userId: number;
    name: string;
    position: string;
    team: string;
    totalReports: number;
    totalCompletedTasks: number;
    totalNotCompletedTasks: number;
    totalHours: number;
    avgWorkload: number;
    lastReportDate: Date | null;
    lastReportWeek: number | null;
}

export interface WeeklyStats {
    weekNumber: number;
    year: number;
    totalReports: number;
    totalUsers: number;
    usersWithReports: number;
    avgCompletionRate: number;
    avgWorkload: number;
    totalHours: number;
}

export const statsCrud = {
    /**
     * Отримати загальну статистику
     */
    async getOverallStats(): Promise<{
        totalUsers: number;
        activeUsers: number;
        totalReports: number;
        avgWorkload: number;
        totalHours: number;
    }> {
        const totalUsers = await User.count();
        const totalReports = await Report.count();
        
        const workloadResult = await Report.findOne({
            attributes: [
                [sequelize.fn('AVG', sequelize.col('workload')), 'avgWorkload'],
            ],
            raw: true,
        }) as any;
        
        const hoursResult = await CompletedTask.findOne({
            attributes: [
                [sequelize.fn('SUM', sequelize.col('hours')), 'totalHours'],
            ],
            raw: true,
        }) as any;

        return {
            totalUsers,
            activeUsers: totalUsers, // Поки що всі користувачі активні
            totalReports,
            avgWorkload: parseFloat(workloadResult?.avgWorkload) || 0,
            totalHours: parseInt(hoursResult?.totalHours) || 0,
        };
    },

    /**
     * Отримати статистику за тиждень
     */
    async getWeeklyStats(weekNumber: number, year: number): Promise<WeeklyStats> {
        const totalUsers = await User.count();
        
        const reports = await Report.findAll({
            where: { weekNumber, year },
            raw: true,
        });

        const totalReports = reports.length;
        const usersWithReports = new Set(reports.map((r: any) => r.userId)).size;
        
        const avgCompletionRate = totalReports > 0
            ? reports.reduce((sum: number, r: any) => sum + (r.completionRate || 0), 0) / totalReports
            : 0;
            
        const avgWorkload = totalReports > 0
            ? reports.reduce((sum: number, r: any) => sum + (r.workload || 0), 0) / totalReports
            : 0;

        // Порахувати години за тиждень
        const reportIds = reports.map((r: any) => r.reportId);
        let totalHours = 0;
        if (reportIds.length > 0) {
            const hoursResult = await CompletedTask.findOne({
                attributes: [
                    [sequelize.fn('SUM', sequelize.col('hours')), 'totalHours'],
                ],
                where: { reportId: { [Op.in]: reportIds } },
                raw: true,
            }) as any;
            totalHours = parseInt(hoursResult?.totalHours) || 0;
        }

        return {
            weekNumber,
            year,
            totalReports,
            totalUsers,
            usersWithReports,
            avgCompletionRate: Math.round(avgCompletionRate),
            avgWorkload: Math.round(avgWorkload * 10) / 10,
            totalHours,
        };
    },

    /**
     * Отримати статистику по користувачам
     */
    async getUsersStats(limit: number = 20): Promise<UserStats[]> {
        const users = await User.findAll({
            order: [['name', 'ASC']],
            limit,
        });

        const result: UserStats[] = [];
        
        for (const user of users) {
            // Отримати звіти користувача
            const reports = await Report.findAll({
                where: { userId: user.userId },
                include: [
                    { model: CompletedTask, as: 'completedTasks' },
                    { model: NotCompletedTask, as: 'notCompletedTasks' },
                ],
                order: [['createdAt', 'DESC']],
            });
            
            const totalReports = reports.length;
            
            let totalCompletedTasks = 0;
            let totalNotCompletedTasks = 0;
            let totalHours = 0;
            let totalWorkload = 0;
            
            reports.forEach((report: any) => {
                totalCompletedTasks += report.completedTasks?.length || 0;
                totalNotCompletedTasks += report.notCompletedTasks?.length || 0;
                totalWorkload += report.workload || 0;
                
                report.completedTasks?.forEach((task: any) => {
                    totalHours += task.hours || 0;
                });
            });

            const lastReport = reports[0];

            result.push({
                userId: user.userId,
                name: user.name,
                position: user.position,
                team: user.team,
                totalReports,
                totalCompletedTasks,
                totalNotCompletedTasks,
                totalHours: Math.round(totalHours),
                avgWorkload: totalReports > 0 ? Math.round((totalWorkload / totalReports) * 10) / 10 : 0,
                lastReportDate: lastReport?.createdAt || null,
                lastReportWeek: lastReport?.weekNumber || null,
            });
        }
        
        return result;
    },

    /**
     * Отримати користувачів без звіту за поточний тиждень
     */
    async getUsersWithoutCurrentReport(): Promise<Array<{ userId: number; name: string; position: string; team: string }>> {
        const weekNumber = getWeekNumber(new Date());
        const year = getCurrentYear();

        const usersWithReports = await Report.findAll({
            where: { weekNumber, year },
            attributes: ['userId'],
            raw: true,
        });
        const userIdsWithReports = new Set(usersWithReports.map((r: any) => r.userId));

        const allUsers = await User.findAll({
            order: [['name', 'ASC']],
        });

        return allUsers
            .filter(user => !userIdsWithReports.has(user.userId))
            .map(user => ({
                userId: user.userId,
                name: user.name,
                position: user.position,
                team: user.team,
            }));
    },

    /**
     * Топ користувачів за кількістю годин
     */
    async getTopUsersByHours(limit: number = 10): Promise<Array<{ name: string; totalHours: number }>> {
        try {
            const result = await sequelize.query(`
                SELECT u.name, SUM(ct.hours) as totalHours
                FROM users u
                JOIN reports r ON u.user_id = r.user_id
                JOIN tasks_completed ct ON r.report_id = ct.report_id
                GROUP BY u.user_id, u.name
                ORDER BY totalHours DESC
                LIMIT :limit
            `, {
                replacements: { limit },
                type: 'SELECT',
            }) as any[];

            return result.map((r: any) => ({
                name: r.name,
                totalHours: Math.round(r.totalHours || 0),
            }));
        } catch (error) {
            // Якщо таблиця порожня або не існує
            return [];
        }
    },
};

export default {
    user: userCrud,
    report: reportCrud,
    tasks: tasksCrud,
    settings: settingsCrud,
    stats: statsCrud,
};
