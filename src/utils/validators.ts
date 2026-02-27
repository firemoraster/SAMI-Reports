/**
 * SAMI Weekly Reports - Validators
 * Функції валідації даних
 */

import type { 
    CreateReportDto, 
    CreateUserDto, 
    CompletedTask, 
    NotCompletedTask,
    ParsedPdfData 
} from '../types';
import { isValidPosition, isValidTeam, isValidWorkload } from './helpers';

export interface ValidationResult {
    isValid: boolean;
    errors: string[];
}

/**
 * Валідація даних користувача
 */
export function validateUser(data: Partial<CreateUserDto>): ValidationResult {
    const errors: string[] = [];

    if (!data.telegramId || typeof data.telegramId !== 'number') {
        errors.push('Telegram ID is required and must be a number');
    }

    if (!data.name || data.name.trim().length < 2) {
        errors.push('Name is required and must be at least 2 characters');
    }

    if (data.position && !isValidPosition(data.position)) {
        errors.push('Invalid position. Must be one of: PM, Dev, Design, QA, BA, Other');
    }

    if (data.team && !isValidTeam(data.team)) {
        errors.push('Invalid team. Must be one of: Core, Mobile, Web, Infra, Data, Other');
    }

    return {
        isValid: errors.length === 0,
        errors,
    };
}

/**
 * Валідація звіту
 */
export function validateReport(data: Partial<CreateReportDto>): ValidationResult {
    const errors: string[] = [];

    if (!data.userId || typeof data.userId !== 'number') {
        errors.push('User ID is required');
    }

    if (!data.weekNumber || data.weekNumber < 1 || data.weekNumber > 53) {
        errors.push('Week number must be between 1 and 53');
    }

    if (!data.year || data.year < 2020 || data.year > 2100) {
        errors.push('Year must be between 2020 and 2100');
    }

    if (!data.workload || !isValidWorkload(data.workload)) {
        errors.push('Workload is required and must be between 1 and 5');
    }

    if (!data.completedTasks || !Array.isArray(data.completedTasks)) {
        errors.push('Completed tasks must be an array');
    } else {
        data.completedTasks.forEach((task, index) => {
            const taskValidation = validateCompletedTask(task);
            if (!taskValidation.isValid) {
                errors.push(`Completed task ${index + 1}: ${taskValidation.errors.join(', ')}`);
            }
        });
    }

    if (!data.notCompletedTasks || !Array.isArray(data.notCompletedTasks)) {
        errors.push('Not completed tasks must be an array');
    } else {
        data.notCompletedTasks.forEach((task, index) => {
            const taskValidation = validateNotCompletedTask(task);
            if (!taskValidation.isValid) {
                errors.push(`Not completed task ${index + 1}: ${taskValidation.errors.join(', ')}`);
            }
        });
    }

    // Перевірка що є хоча б одна задача
    const totalTasks = (data.completedTasks?.length || 0) + (data.notCompletedTasks?.length || 0);
    if (totalTasks === 0) {
        errors.push('At least one task (completed or not completed) is required');
    }

    return {
        isValid: errors.length === 0,
        errors,
    };
}

/**
 * Валідація виконаної задачі
 */
export function validateCompletedTask(task: Partial<CompletedTask>): ValidationResult {
    const errors: string[] = [];

    if (!task.title || task.title.trim().length < 3) {
        errors.push('Task title is required and must be at least 3 characters');
    }

    if (task.hours === undefined || task.hours < 0 || task.hours > 168) {
        errors.push('Hours must be between 0 and 168');
    }

    return {
        isValid: errors.length === 0,
        errors,
    };
}

/**
 * Валідація невиконаної задачі
 */
export function validateNotCompletedTask(task: Partial<NotCompletedTask>): ValidationResult {
    const errors: string[] = [];

    if (!task.title || task.title.trim().length < 3) {
        errors.push('Task title is required and must be at least 3 characters');
    }

    if (!task.reason || task.reason.trim().length < 3) {
        errors.push('Reason is required and must be at least 3 characters');
    }

    if (task.eta) {
        const etaDate = new Date(task.eta);
        if (isNaN(etaDate.getTime())) {
            errors.push('Invalid ETA date format');
        }
    }

    return {
        isValid: errors.length === 0,
        errors,
    };
}

/**
 * Валідація даних з PDF
 */
export function validatePdfData(data: ParsedPdfData): ValidationResult {
    const errors: string[] = [];

    if (!data.name || data.name.trim().length < 2) {
        errors.push('Name is required in PDF');
    }

    if (!data.workload || !isValidWorkload(data.workload)) {
        errors.push('Workload is required in PDF (1-5)');
    }

    const totalTasks = data.completedTasks.length + data.notCompletedTasks.length;
    if (totalTasks === 0) {
        errors.push('At least one task must be filled in PDF');
    }

    // Валідація виконаних задач
    data.completedTasks.forEach((task, index) => {
        if (!task.title || task.title.trim().length < 3) {
            errors.push(`Completed task ${index + 1}: title is required`);
        }
    });

    // Валідація невиконаних задач
    data.notCompletedTasks.forEach((task, index) => {
        if (!task.title || task.title.trim().length < 3) {
            errors.push(`Not completed task ${index + 1}: title is required`);
        }
        if (!task.reason || task.reason.trim().length < 3) {
            errors.push(`Not completed task ${index + 1}: reason is required`);
        }
    });

    return {
        isValid: errors.length === 0,
        errors,
    };
}

/**
 * Санітизація тексту
 */
export function sanitizeText(text: string): string {
    return text
        .replace(/<[^>]*>/g, '') // Видалити HTML теги
        .replace(/[<>]/g, '') // Видалити залишкові < >
        .trim();
}

/**
 * Валідація числа
 */
export function validateNumber(value: any, min: number, max: number): boolean {
    const num = Number(value);
    return !isNaN(num) && num >= min && num <= max;
}

/**
 * Валідація email
 */
export function validateEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

/**
 * Валідація дати
 */
export function validateDate(dateStr: string): boolean {
    const date = new Date(dateStr);
    return !isNaN(date.getTime());
}

export default {
    validateUser,
    validateReport,
    validateCompletedTask,
    validateNotCompletedTask,
    validatePdfData,
    sanitizeText,
    validateNumber,
    validateEmail,
    validateDate,
};
