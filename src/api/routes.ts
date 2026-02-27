/**
 * SAMI Weekly Reports - API Routes
 * REST API для системи звітності
 */

import { Router, Request, Response, NextFunction } from 'express';
import { userCrud, reportCrud, settingsCrud } from '../database/crud';
import { generatePdfReport } from '../services/pdf.service';
import { getTeamWeeklyStats, getUserStats, getPeriodStats, getOverallStats } from '../services/stats.service';
import { validateReport } from '../utils/validators';
import { getWeekNumber, getCurrentYear } from '../utils/helpers';
import logger from '../utils/logger';
import config from '../config';
import fs from 'fs';
import type { Team, Position, CreateReportDto } from '../types';

const router = Router();

// ============================================
// MIDDLEWARE
// ============================================

/**
 * API Key авторизація
 */
function authMiddleware(req: Request, res: Response, next: NextFunction): void {
    const apiKey = req.headers['x-api-key'] || req.query.apiKey;
    
    if (!config.api.enabled) {
        res.status(503).json({ error: 'API is disabled' });
        return;
    }

    // Якщо API key не налаштовано - пропускаємо перевірку
    if (!config.api.apiKey) {
        next();
        return;
    }

    if (apiKey !== config.api.apiKey) {
        res.status(401).json({ error: 'Invalid API key' });
        return;
    }

    next();
}

/**
 * Error wrapper для async handlers
 */
function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) {
    return (req: Request, res: Response, next: NextFunction) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
}

// Застосувати auth middleware до всіх роутів
router.use(authMiddleware);

// ============================================
// HEALTH CHECK
// ============================================

router.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        version: '1.0.0',
    });
});

// ============================================
// USERS
// ============================================

/**
 * GET /api/users - Отримати всіх користувачів
 */
router.get('/users', asyncHandler(async (req, res) => {
    const users = await userCrud.findAll();
    res.json({ data: users, count: users.length });
}));

/**
 * GET /api/users/:id - Отримати користувача по ID
 */
router.get('/users/:id', asyncHandler(async (req, res) => {
    const user = await userCrud.findById(parseInt(req.params.id, 10));
    
    if (!user) {
        res.status(404).json({ error: 'User not found' });
        return;
    }
    
    res.json({ data: user });
}));

/**
 * PUT /api/users/:id - Оновити користувача
 */
router.put('/users/:id', asyncHandler(async (req, res) => {
    const userId = parseInt(req.params.id, 10);
    const updateData = req.body;

    const user = await userCrud.update(userId, updateData);
    
    if (!user) {
        res.status(404).json({ error: 'User not found' });
        return;
    }
    
    res.json({ data: user, message: 'User updated successfully' });
}));

/**
 * DELETE /api/users/:id - Видалити користувача (soft delete через оновлення)
 */
router.delete('/users/:id', asyncHandler(async (req, res) => {
    const userId = parseInt(req.params.id, 10);
    
    const user = await userCrud.findById(userId);
    
    if (!user) {
        res.status(404).json({ error: 'User not found' });
        return;
    }
    
    // Просто позначаємо як видаленого через ім'я
    await userCrud.update(userId, { name: `[DELETED] ${user.name}` });
    
    res.json({ message: 'User deactivated successfully' });
}));

// ============================================
// REPORTS
// ============================================

/**
 * GET /api/reports - Отримати звіти
 */
router.get('/reports', asyncHandler(async (req, res) => {
    const { 
        userId, 
        team, 
        weekNumber, 
        year,
        limit = 50
    } = req.query;

    let reports;

    if (userId) {
        reports = await reportCrud.findByUser(
            parseInt(userId as string, 10),
            parseInt(limit as string, 10)
        );
    } else if (team && weekNumber) {
        reports = await reportCrud.findByTeamAndWeek(
            team as Team,
            parseInt(weekNumber as string, 10),
            parseInt((year as string) || String(getCurrentYear()), 10)
        );
    } else {
        reports = await reportCrud.findAll(parseInt(limit as string, 10));
    }

    res.json({ data: reports, count: reports.length });
}));

/**
 * GET /api/reports/:id - Отримати звіт по ID
 */
router.get('/reports/:id', asyncHandler(async (req, res) => {
    const report = await reportCrud.findById(parseInt(req.params.id, 10));
    
    if (!report) {
        res.status(404).json({ error: 'Report not found' });
        return;
    }
    
    res.json({ data: report });
}));

/**
 * POST /api/reports - Створити звіт
 */
router.post('/reports', asyncHandler(async (req, res) => {
    const reportDto: CreateReportDto = req.body;

    // Валідація
    const validation = validateReport(reportDto);
    if (!validation.isValid) {
        res.status(400).json({ 
            error: 'Validation failed', 
            details: validation.errors 
        });
        return;
    }

    const report = await reportCrud.create(reportDto);
    
    res.status(201).json({ 
        data: report, 
        message: 'Report created successfully' 
    });
}));

/**
 * PUT /api/reports/:id - Оновити звіт
 */
router.put('/reports/:id', asyncHandler(async (req, res) => {
    const reportId = parseInt(req.params.id, 10);
    const updateData = req.body;

    const report = await reportCrud.update(reportId, updateData);
    
    if (!report) {
        res.status(404).json({ error: 'Report not found' });
        return;
    }
    
    res.json({ data: report, message: 'Report updated successfully' });
}));

/**
 * DELETE /api/reports/:id - Видалити звіт
 */
router.delete('/reports/:id', asyncHandler(async (req, res) => {
    const reportId = parseInt(req.params.id, 10);
    
    const deleted = await reportCrud.delete(reportId);
    
    if (!deleted) {
        res.status(404).json({ error: 'Report not found' });
        return;
    }
    
    res.json({ message: 'Report deleted successfully' });
}));

// ============================================
// PDF EXPORT
// ============================================

/**
 * GET /api/reports/:id/pdf - Експортувати звіт в PDF
 */
router.get('/reports/:id/pdf', asyncHandler(async (req, res) => {
    const report = await reportCrud.findById(parseInt(req.params.id, 10));
    
    if (!report) {
        res.status(404).json({ error: 'Report not found' });
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

    res.download(pdfPath, `report_${report.reportId}_week${report.weekNumber}.pdf`, (err) => {
        // Видалити тимчасовий файл
        fs.unlinkSync(pdfPath);
        if (err) {
            logger.error('Error sending PDF:', err);
        }
    });
}));

// ============================================
// STATISTICS
// ============================================

/**
 * GET /api/stats/user/:userId - Статистика користувача
 */
router.get('/stats/user/:userId', asyncHandler(async (req, res) => {
    const userId = parseInt(req.params.userId, 10);
    const stats = await getUserStats(userId);
    
    if (!stats) {
        res.status(404).json({ error: 'No data found for user' });
        return;
    }
    
    res.json({ data: stats });
}));

/**
 * GET /api/stats/team/:team - Статистика команди за тиждень
 */
router.get('/stats/team/:team', asyncHandler(async (req, res) => {
    const { team } = req.params;
    const weekNumber = parseInt(req.query.week as string, 10) || getWeekNumber(new Date());
    const year = parseInt(req.query.year as string, 10) || getCurrentYear();

    const stats = await getTeamWeeklyStats(team as Team, weekNumber, year);
    
    if (!stats) {
        res.status(404).json({ error: 'No data found for team' });
        return;
    }
    
    res.json({ data: stats });
}));

/**
 * GET /api/stats/period - Статистика за період
 */
router.get('/stats/period', asyncHandler(async (req, res) => {
    const { startDate, endDate } = req.query;
    
    if (!startDate || !endDate) {
        res.status(400).json({ error: 'startDate and endDate are required (YYYY-MM-DD format)' });
        return;
    }

    const stats = await getPeriodStats(
        new Date(startDate as string),
        new Date(endDate as string)
    );
    
    res.json({ data: stats });
}));

/**
 * GET /api/stats/overall - Загальна статистика
 */
router.get('/stats/overall', asyncHandler(async (req, res) => {
    const stats = await getOverallStats();
    res.json({ data: stats });
}));

// ============================================
// MISSING REPORTS
// ============================================

/**
 * GET /api/missing - Хто не здав звіт
 */
router.get('/missing', asyncHandler(async (req, res) => {
    const weekNumber = parseInt(req.query.week as string, 10) || getWeekNumber(new Date());
    const year = parseInt(req.query.year as string, 10) || getCurrentYear();
    const team = req.query.team as Team | undefined;

    const users = await userCrud.getUsersWithoutReports(weekNumber, year, team);
    
    res.json({ 
        data: users, 
        count: users.length,
        weekNumber,
        year 
    });
}));

// ============================================
// SETTINGS
// ============================================

/**
 * GET /api/settings - Отримати налаштування
 */
router.get('/settings', asyncHandler(async (req, res) => {
    const settings = await settingsCrud.getAll();
    res.json({ data: settings });
}));

/**
 * PUT /api/settings/:key - Оновити налаштування
 */
router.put('/settings/:key', asyncHandler(async (req, res) => {
    const { key } = req.params;
    const { value } = req.body;

    await settingsCrud.set(key, value);
    res.json({ data: { key, value }, message: 'Setting updated successfully' });
}));

// ============================================
// WEBHOOK для Trello (якщо потрібно)
// ============================================

/**
 * POST /api/webhook/trello - Webhook від Trello
 */
router.post('/webhook/trello', asyncHandler(async (req, res) => {
    const payload = req.body;
    
    // Обробка подій Trello
    if (payload.action?.type === 'updateCard') {
        const cardId = payload.action.data.card.id;
        const listName = payload.action.data.listAfter?.name;
        
        // Знайти звіт за trelloCardId і оновити статус
        // Це буде працювати якщо ви налаштуєте webhook в Trello
        logger.info(`Trello webhook: card ${cardId} moved to ${listName}`);
    }
    
    res.json({ ok: true });
}));

/**
 * HEAD /api/webhook/trello - Верифікація webhook Trello
 */
router.head('/webhook/trello', (req, res) => {
    res.status(200).end();
});

// ============================================
// ERROR HANDLER
// ============================================

router.use((err: Error, req: Request, res: Response, next: NextFunction) => {
    logger.error('API Error:', err);
    
    res.status(500).json({
        error: 'Internal server error',
        message: config.api.enabled ? err.message : 'An error occurred',
    });
});

export default router;
