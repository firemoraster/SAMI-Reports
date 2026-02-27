/**
 * SAMI Weekly Reports - Type Definitions
 * Типи та інтерфейси для всієї системи
 */

// ============================================
// USER TYPES
// ============================================

export type Position = 'PM' | 'Dev' | 'Design' | 'QA' | 'BA' | 'Helpdesk' | 'Support' | 'Other';
export type Team = 'Core' | 'Mobile' | 'Web' | 'Infra' | 'Data' | 'SAMI' | 'Other';
export type Language = 'uk' | 'en';

export interface User {
    userId: number;
    telegramId: number;
    name: string;
    position: Position;
    team: Team;
    isManager: boolean;
    managerId?: number;
    language: Language;
    createdAt: Date;
    updatedAt: Date;
}

export interface CreateUserDto {
    telegramId: number;
    name: string;
    position?: Position;
    team?: Team;
    isManager?: boolean;
    managerId?: number;
    language?: Language;
}

// ============================================
// REPORT TYPES
// ============================================

export type Workload = 1 | 2 | 3 | 4 | 5;

export interface Report {
    reportId: number;
    userId: number;
    weekNumber: number;
    year: number;
    workload: Workload;
    tasksCompleted: number;
    tasksNotCompleted: number;
    completionRate: number;
    hasBlockers: boolean;
    concerns?: string;
    improvements?: string;
    priorities?: string;
    trelloCardId?: string;
    trelloCardUrl?: string;
    createdAt: Date;
}

export interface CreateReportDto {
    userId: number;
    weekNumber: number;
    year: number;
    workload: Workload;
    completedTasks: CompletedTask[];
    notCompletedTasks: NotCompletedTask[];
    reporterName?: string;
    reporterPosition?: string;
    concerns?: string;
    improvements?: string;
    priorities?: string;
    // Поля для оновлення існуючого звіту
    existingReportId?: number;
    existingTrelloCardId?: string;
    isUpdate?: boolean;
}

export interface UpdateReportDto {
    workload?: Workload;
    concerns?: string;
    improvements?: string;
    priorities?: string;
    status?: string;
}

export interface CompletedTask {
    taskId?: number;
    reportId?: number;
    title: string;
    project?: string;
    hours: number;
}

export interface NotCompletedTask {
    taskId?: number;
    reportId?: number;
    title: string;
    reason: string;
    eta?: Date | string;
    blocker?: string;
}

// ============================================
// TRELLO TYPES
// ============================================

export interface TrelloList {
    id: string;
    name: string;
    pos: number;
}

export interface TrelloLabel {
    id: string;
    name: string;
    color: string;
}

export interface TrelloCard {
    id: string;
    name: string;
    desc: string;
    url: string;
    shortUrl: string;
    idList: string;
    labels: TrelloLabel[];
}

export interface TrelloCustomField {
    id: string;
    name: string;
    type: string;
    options?: TrelloCustomFieldOption[];
}

export interface TrelloCustomFieldOption {
    id: string;
    value: { text: string };
}

export interface CreateTrelloCardDto {
    name: string;
    description: string;
    listId: string;
    labelIds?: string[];
    customFields?: Record<string, any>;
}

// ============================================
// STATISTICS TYPES
// ============================================

export interface TeamStats {
    team: Team;
    totalMembers: number;
    totalReports: number;
    averageWorkload: number;
    averageCompletionRate: number;
    totalBlockers: number;
    overdueTasksCount: number;
    topPerformers: string[];
    problemReports: string[];
}

export interface UserStats {
    userId: number;
    name: string;
    totalReports: number;
    averageWorkload: number;
    averageCompletionRate: number;
    totalBlockers: number;
    weeklyTrend: number[];
}

export interface PeriodStats {
    startDate: Date;
    endDate: Date;
    totalReports: number;
    averageWorkload: number;
    averageCompletionRate: number;
    topReasons: Array<{ reason: string; count: number }>;
    teamComparison: TeamStats[];
}

// ============================================
// PDF TYPES
// ============================================

export interface ParsedPdfData {
    name?: string;
    position?: Position;
    team?: Team;
    date?: Date;
    weekNumber?: number;
    year?: number;
    completedTasks: CompletedTask[];
    notCompletedTasks: NotCompletedTask[];
    workload?: Workload;
    concerns?: string;
    improvements?: string;
    priorities?: string;
}

export interface PdfGenerationOptions {
    includeQrCode?: boolean;
    language?: Language;
}

// ============================================
// BOT TYPES
// ============================================

export interface BotContext {
    userId: number;
    telegramId: number;
    isAdmin: boolean;
    isManager: boolean;
    language: Language;
}

export interface ReportFormState {
    step: ReportFormStep;
    data: Partial<CreateReportDto>;
    completedTasks: CompletedTask[];
    notCompletedTasks: NotCompletedTask[];
    currentTask?: Partial<CompletedTask | NotCompletedTask>;
}

export type ReportFormStep =
    | 'start'
    | 'enter_name'
    | 'enter_position'
    | 'completed_tasks'
    | 'completed_task_title'
    | 'completed_task_project'
    | 'completed_task_hours'
    | 'completed_tasks_more'
    | 'not_completed_tasks'
    | 'not_completed_task_title'
    | 'not_completed_task_reason'
    | 'not_completed_task_eta'
    | 'not_completed_task_blocker'
    | 'not_completed_tasks_more'
    | 'workload'
    | 'concerns'
    | 'improvements'
    | 'priorities'
    | 'confirm'
    | 'done';

// ============================================
// API TYPES
// ============================================

export interface ApiResponse<T = any> {
    success: boolean;
    data?: T;
    error?: string;
    message?: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
}

// ============================================
// SETTINGS TYPES
// ============================================

export interface Setting {
    key: string;
    value: string;
}

export type SettingsKey =
    | 'trello_board_initialized'
    | 'last_reminder_sent'
    | 'bot_version'
    | 'maintenance_mode';
