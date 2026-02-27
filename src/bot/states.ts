/**
 * SAMI Weekly Reports - Bot State Management
 * Управління станом користувача для FSM
 */

import type { 
    ReportFormState, 
    ReportFormStep, 
    CompletedTask, 
    NotCompletedTask,
    Workload 
} from '../types';

// Зберігання станів користувачів
const userStates: Map<number, ReportFormState> = new Map();

/**
 * Створити початковий стан форми
 */
export function createInitialState(): ReportFormState {
    return {
        step: 'start',
        data: {},
        completedTasks: [],
        notCompletedTasks: [],
        currentTask: undefined,
    };
}

/**
 * Отримати стан користувача
 */
export function getState(userId: number): ReportFormState | undefined {
    return userStates.get(userId);
}

/**
 * Встановити стан користувача
 */
export function setState(userId: number, state: ReportFormState): void {
    userStates.set(userId, state);
}

/**
 * Оновити стан користувача (модифікує на місці)
 */
export function updateState(
    userId: number, 
    updates: Partial<ReportFormState>
): ReportFormState {
    let currentState = userStates.get(userId);
    if (!currentState) {
        currentState = createInitialState();
        userStates.set(userId, currentState);
    }
    // Модифікуємо на місці замість створення нового об'єкта
    Object.assign(currentState, updates);
    return currentState;
}

/**
 * Перейти до наступного кроку
 */
export function nextStep(userId: number, step: ReportFormStep): ReportFormState {
    return updateState(userId, { step });
}

/**
 * Додати виконану задачу
 */
export function addCompletedTask(userId: number, task: CompletedTask): void {
    const state = getState(userId);
    if (state) {
        state.completedTasks.push(task);
        state.currentTask = undefined;
    }
}

/**
 * Додати невиконану задачу
 */
export function addNotCompletedTask(userId: number, task: NotCompletedTask): void {
    const state = getState(userId);
    if (state) {
        state.notCompletedTasks.push(task);
        state.currentTask = undefined;
    }
}

/**
 * Очистити стан користувача
 */
export function clearState(userId: number): void {
    userStates.delete(userId);
}

/**
 * Перевірити чи є активний стан
 */
export function hasActiveState(userId: number): boolean {
    const state = userStates.get(userId);
    return !!state && state.step !== 'done';
}

/**
 * Отримати всіх користувачів з активним станом
 */
export function getActiveUsers(): number[] {
    return Array.from(userStates.keys()).filter(hasActiveState);
}

export default {
    createInitialState,
    getState,
    setState,
    updateState,
    nextStep,
    addCompletedTask,
    addNotCompletedTask,
    clearState,
    hasActiveState,
    getActiveUsers,
};
