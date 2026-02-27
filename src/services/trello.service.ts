/**
 * SAMI Weekly Reports - Trello Service
 * Інтеграція з Trello API для створення та управління картками
 */

import axios, { AxiosInstance, AxiosError } from 'axios';
import config from '../config';
import logger from '../utils/logger';
import type { 
    TrelloList, 
    TrelloLabel, 
    TrelloCard, 
    TrelloCustomField,
    CreateTrelloCardDto,
    Workload 
} from '../types';

// ============================================
// CONSTANTS
// ============================================

const TRELLO_API_URL = 'https://api.trello.com/1';

// Назви списків (повинні співпадати з реальними на дошці)
export const LIST_NAMES = {
    NEW_REPORTS: '1. NEW REPORTS',
    IN_REVIEW: '🔍 2. IN REVIEW',
    APPROVED: '✅ 3. APPROVED',
    FOLLOW_UP: '⚠️ 4. FOLLOW-UP NEEDED (Проблемні)',
    ARCHIVED: '📊 5. DONE & ARCHIVED',
};

// Назви міток та їх кольори
export const LABEL_CONFIGS = [
    { name: 'Load: Low (1-2)', color: 'green' },
    { name: 'Load: Medium (3)', color: 'yellow' },
    { name: 'Load: High (4)', color: 'orange' },
    { name: 'Load: Critical (5)', color: 'red' },
    { name: 'Needs Review', color: 'blue' },
    { name: 'Approved', color: 'purple' },
    { name: 'Has Blockers', color: 'black' },
    { name: 'Overdue ETA', color: 'red' },
    { name: 'Has Concerns', color: 'orange' },
    { name: 'All Tasks Done', color: 'green' },
    { name: 'High Performance', color: 'purple' },
];

// Custom Fields
export const CUSTOM_FIELD_CONFIGS = [
    { name: 'Тиждень', type: 'text' },
    { name: 'Ім\'я', type: 'text' },
    { name: 'Посада', type: 'list', options: ['PM', 'Dev', 'Design', 'QA', 'BA', 'Other'] },
    { name: 'Команда', type: 'list', options: ['Core', 'Mobile', 'Web', 'Infra', 'Data', 'Other'] },
    { name: 'Навантаження', type: 'number' },
    { name: 'Всього задач', type: 'number' },
    { name: 'Виконано', type: 'number' },
    { name: '% виконання', type: 'number' },
    { name: 'Є блокери', type: 'checkbox' },
    { name: 'Дата звіту', type: 'date' },
];

// ============================================
// TRELLO SERVICE CLASS
// ============================================

class TrelloService {
    private client: AxiosInstance;
    private boardId: string;
    private lists: Map<string, string> = new Map();
    private labels: Map<string, string> = new Map();
    private customFields: Map<string, TrelloCustomField> = new Map();
    private initialized: boolean = false;

    constructor() {
        this.boardId = config.trello.boardId;
        
        this.client = axios.create({
            baseURL: TRELLO_API_URL,
            params: {
                key: config.trello.apiKey,
                token: config.trello.token,
            },
        });

        // Interceptor для логування та retry з exponential backoff
        this.client.interceptors.response.use(
            response => response,
            async (error: AxiosError) => {
                const config = error.config as any;
                if (!config) throw error;

                config.__retryCount = config.__retryCount || 0;
                const MAX_RETRIES = 3;
                const retryableStatuses = [429, 500, 502, 503, 504];

                if (
                    config.__retryCount < MAX_RETRIES &&
                    (!error.response || retryableStatuses.includes(error.response.status))
                ) {
                    config.__retryCount += 1;
                    const delay = Math.pow(2, config.__retryCount) * 1000; // 2s, 4s, 8s
                    logger.warn(`Trello API retry ${config.__retryCount}/${MAX_RETRIES} after ${delay}ms for ${config.url}`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                    return this.client.request(config);
                }

                logger.error('Trello API error:', {
                    url: error.config?.url,
                    status: error.response?.status,
                    data: error.response?.data,
                });
                throw error;
            }
        );
    }

    /**
     * Ініціалізація сервісу - завантаження списків, міток, custom fields
     */
    async initialize(): Promise<void> {
        if (this.initialized) return;

        try {
            logger.info('Initializing Trello service...');

            // Отримати реальний ID дошки (якщо передано shortLink)
            await this.resolveBoardId();

            // Завантажити або створити списки
            await this.initializeLists();

            // Завантажити або створити мітки
            await this.initializeLabels();

            // Завантажити custom fields
            await this.loadCustomFields();

            this.initialized = true;
            logger.info('✅ Trello service initialized');
        } catch (error) {
            logger.error('Failed to initialize Trello service:', error);
            throw error;
        }
    }

    /**
     * Отримати реальний ID дошки з shortLink
     */
    private async resolveBoardId(): Promise<void> {
        try {
            const { data: board } = await this.client.get<{ id: string; name: string }>(
                `/boards/${this.boardId}`
            );
            logger.info(`Resolved board: ${board.name} (${board.id})`);
            this.boardId = board.id;
        } catch (error) {
            logger.error('Failed to resolve board ID:', error);
            throw new Error(`Cannot access board: ${this.boardId}`);
        }
    }

    /**
     * Ініціалізація списків
     */
    private async initializeLists(): Promise<void> {
        // Отримати існуючі списки
        const { data: existingLists } = await this.client.get<TrelloList[]>(
            `/boards/${this.boardId}/lists`
        );

        const existingNames = new Set(existingLists.map(l => l.name));

        // Створити відсутні списки
        for (const listName of Object.values(LIST_NAMES)) {
            if (!existingNames.has(listName)) {
                const { data: newList } = await this.client.post<TrelloList>('/lists', {
                    name: listName,
                    idBoard: this.boardId,
                });
                this.lists.set(listName, newList.id);
                logger.info(`Created list: ${listName}`);
            } else {
                const list = existingLists.find(l => l.name === listName);
                if (list) {
                    this.lists.set(listName, list.id);
                }
            }
        }
    }

    /**
     * Ініціалізація міток
     */
    private async initializeLabels(): Promise<void> {
        // Отримати існуючі мітки
        const { data: existingLabels } = await this.client.get<TrelloLabel[]>(
            `/boards/${this.boardId}/labels`
        );

        const existingNames = new Set(existingLabels.map(l => l.name));

        // Створити відсутні мітки
        for (const labelConfig of LABEL_CONFIGS) {
            if (!existingNames.has(labelConfig.name)) {
                const { data: newLabel } = await this.client.post<TrelloLabel>('/labels', {
                    name: labelConfig.name,
                    color: labelConfig.color,
                    idBoard: this.boardId,
                });
                this.labels.set(labelConfig.name, newLabel.id);
                logger.info(`Created label: ${labelConfig.name}`);
            } else {
                const label = existingLabels.find(l => l.name === labelConfig.name);
                if (label) {
                    this.labels.set(labelConfig.name, label.id);
                }
            }
        }
    }

    /**
     * Завантаження Custom Fields
     */
    private async loadCustomFields(): Promise<void> {
        try {
            const { data: fields } = await this.client.get<TrelloCustomField[]>(
                `/boards/${this.boardId}/customFields`
            );

            for (const field of fields) {
                this.customFields.set(field.name, field);
            }

            logger.info(`Loaded ${fields.length} custom fields`);
        } catch (error) {
            logger.warn('Custom Fields not available (Power-Up may not be enabled)');
        }
    }

    /**
     * Отримати ID списку за назвою
     */
    getListId(name: string): string | undefined {
        return this.lists.get(name);
    }

    /**
     * Отримати ID мітки за назвою
     */
    getLabelId(name: string): string | undefined {
        return this.labels.get(name);
    }

    /**
     * Отримати мітки за навантаженням
     */
    getWorkloadLabelId(workload: Workload): string | undefined {
        const labelNames: Record<Workload, string> = {
            1: 'Load: Low (1-2)',
            2: 'Load: Low (1-2)',
            3: 'Load: Medium (3)',
            4: 'Load: High (4)',
            5: 'Load: Critical (5)',
        };
        return this.getLabelId(labelNames[workload]);
    }

    /**
     * Створити картку
     */
    async createCard(dto: CreateTrelloCardDto): Promise<TrelloCard> {
        await this.initialize();

        try {
            const { data: card } = await this.client.post<TrelloCard>('/cards', {
                name: dto.name,
                desc: dto.description,
                idList: dto.listId,
                idLabels: dto.labelIds?.join(','),
            });

            // Встановити custom fields якщо доступні
            if (dto.customFields && this.customFields.size > 0) {
                await this.setCustomFields(card.id, dto.customFields);
            }

            logger.info(`Created Trello card: ${card.id} - ${card.name}`);
            return card;
        } catch (error) {
            logger.error('Failed to create Trello card:', error);
            throw error;
        }
    }

    /**
     * Створити картку для звіту
     */
    async createReportCard(
        reportData: {
            name: string;
            weekNumber: number;
            year: number;
            position: string;
            team: string;
            workload: Workload;
            tasksCompleted: number;
            tasksNotCompleted: number;
            completionRate: number;
            hasBlockers: boolean;
            concerns?: string | null;
            improvements?: string | null;
            priorities?: string | null;
        },
        completedTasks: Array<{ title: string; project?: string; hours: number }>,
        notCompletedTasks: Array<{ title: string; reason: string; eta?: Date | string | null; blocker?: string | null }>
    ): Promise<TrelloCard> {
        await this.initialize();

        // Генерація назви картки
        const cardName = `📋 ${reportData.name} - Week ${String(reportData.weekNumber).padStart(2, '0')}/${reportData.year}`;

        // Генерація опису
        const description = this.generateCardDescription(reportData, completedTasks, notCompletedTasks);

        // Визначення міток
        const labelIds: string[] = [];

        // Мітка навантаження
        const workloadLabelId = this.getWorkloadLabelId(reportData.workload);
        if (workloadLabelId) labelIds.push(workloadLabelId);

        // Мітка Needs Review
        const needsReviewLabelId = this.getLabelId('Needs Review');
        if (needsReviewLabelId) labelIds.push(needsReviewLabelId);

        // Мітка Has Blockers
        if (reportData.hasBlockers) {
            const blockersLabelId = this.getLabelId('Has Blockers');
            if (blockersLabelId) labelIds.push(blockersLabelId);
        }

        // Мітка All Tasks Done
        if (reportData.completionRate === 100) {
            const allDoneLabelId = this.getLabelId('All Tasks Done');
            if (allDoneLabelId) labelIds.push(allDoneLabelId);
        }

        // Мітка Has Concerns
        if (reportData.concerns && reportData.concerns.trim().length > 0) {
            const concernsLabelId = this.getLabelId('Has Concerns');
            if (concernsLabelId) labelIds.push(concernsLabelId);
        }

        // Визначення списку
        let listId = this.getListId(LIST_NAMES.NEW_REPORTS);
        
        // Якщо критичне навантаження - в FOLLOW-UP
        if (reportData.workload === 5 || reportData.hasBlockers) {
            listId = this.getListId(LIST_NAMES.FOLLOW_UP) || listId;
        }

        if (!listId) {
            throw new Error('Failed to find list ID for card');
        }

        // Створення картки
        const card = await this.createCard({
            name: cardName,
            description,
            listId,
            labelIds,
            customFields: {
                'Тиждень': `${reportData.weekNumber}/${reportData.year}`,
                'Ім\'я': reportData.name,
                'Посада': reportData.position,
                'Команда': reportData.team,
                'Навантаження': reportData.workload,
                'Всього задач': reportData.tasksCompleted + reportData.tasksNotCompleted,
                'Виконано': reportData.tasksCompleted,
                '% виконання': reportData.completionRate,
                'Є блокери': reportData.hasBlockers,
                'Дата звіту': new Date().toISOString(),
            },
        });

        // Додати чеклісти для задач
        if (completedTasks.length > 0) {
            await this.addChecklist(card.id, '✅ Виконані задачі', 
                completedTasks.map(t => `${t.title} (${t.project}) - ${t.hours}h`)
            );
        }

        if (notCompletedTasks.length > 0) {
            await this.addChecklist(card.id, '❌ Невиконані задачі',
                notCompletedTasks.map(t => `${t.title} - ${t.reason}`)
            );
        }

        return card;
    }

    /**
     * Генерація опису картки
     */
    private generateCardDescription(
        reportData: {
            name: string;
            position: string;
            team: string;
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
        desc += `**👤 Співробітник:** ${reportData.name}\n`;
        desc += `**💼 Посада:** ${reportData.position}\n`;
        desc += `** Дата:** ${new Date().toLocaleDateString('uk-UA')}\n\n`;

        desc += `---\n\n`;

        desc += `### 📈 Підсумок\n`;
        desc += `- **Навантаження:** ${reportData.workload}/5\n`;
        desc += `- **Виконано:** ${reportData.tasksCompleted} задач\n`;
        desc += `- **Не виконано:** ${reportData.tasksNotCompleted} задач\n`;
        desc += `- **% виконання:** ${reportData.completionRate}%\n\n`;

        if (completedTasks.length > 0) {
            desc += `### ✅ Виконані задачі\n`;
            completedTasks.forEach((task, i) => {
                desc += `${i + 1}. **${task.title}** - ${task.hours}h\n`;
            });
            desc += `\n`;
        }

        if (notCompletedTasks.length > 0) {
            desc += `### ❌ Невиконані задачі\n`;
            notCompletedTasks.forEach((task, i) => {
                desc += `${i + 1}. **${task.title}**\n`;
                desc += `   - Причина: ${task.reason}\n`;
                if (task.eta) {
                    const etaDate = typeof task.eta === 'string' ? new Date(task.eta) : task.eta;
                    desc += `   - ETA: ${etaDate.toLocaleDateString('uk-UA')}\n`;
                }
                if (task.blocker) desc += `   - ⚠️ Блокер: ${task.blocker}\n`;
            });
            desc += `\n`;
        }

        if (reportData.concerns) {
            desc += `### 😟 Що турбує\n${reportData.concerns}\n\n`;
        }

        if (reportData.improvements) {
            desc += `### 💡 Що покращити\n${reportData.improvements}\n\n`;
        }

        if (reportData.priorities) {
            desc += `### 🎯 Пріоритети на наступний тиждень\n${reportData.priorities}\n\n`;
        }

        desc += `---\n*Згенеровано SAMI Weekly Reports Bot*`;

        return desc;
    }

    /**
     * Встановити custom fields для картки
     */
    private async setCustomFields(cardId: string, fields: Record<string, any>): Promise<void> {
        for (const [fieldName, value] of Object.entries(fields)) {
            const field = this.customFields.get(fieldName);
            if (!field) continue;

            try {
                let fieldValue: any;

                switch (field.type) {
                    case 'text':
                        fieldValue = { value: { text: String(value) } };
                        break;
                    case 'number':
                        fieldValue = { value: { number: String(value) } };
                        break;
                    case 'checkbox':
                        fieldValue = { value: { checked: String(Boolean(value)) } };
                        break;
                    case 'date':
                        fieldValue = { value: { date: value } };
                        break;
                    case 'list':
                        // Знайти option id
                        const option = field.options?.find(o => o.value.text === value);
                        if (option) {
                            fieldValue = { idValue: option.id };
                        }
                        break;
                }

                if (fieldValue) {
                    await this.client.put(
                        `/cards/${cardId}/customField/${field.id}/item`,
                        fieldValue
                    );
                }
            } catch (error) {
                logger.warn(`Failed to set custom field ${fieldName}:`, error);
            }
        }
    }

    /**
     * Додати чеклист до картки
     */
    async addChecklist(cardId: string, name: string, items: string[]): Promise<void> {
        try {
            // Створити чеклист
            const { data: checklist } = await this.client.post('/checklists', {
                idCard: cardId,
                name,
            });

            // Додати елементи
            for (const item of items) {
                await this.client.post(`/checklists/${checklist.id}/checkItems`, {
                    name: item,
                });
            }
        } catch (error) {
            logger.warn(`Failed to add checklist ${name}:`, error);
        }
    }

    /**
     * Перемістити картку в інший список
     */
    async moveCard(cardId: string, listName: string): Promise<void> {
        const listId = this.getListId(listName);
        if (!listId) {
            throw new Error(`List not found: ${listName}`);
        }

        await this.client.put(`/cards/${cardId}`, {
            idList: listId,
        });

        logger.info(`Moved card ${cardId} to ${listName}`);
    }

    /**
     * Додати мітку до картки
     */
    async addLabel(cardId: string, labelName: string): Promise<void> {
        const labelId = this.getLabelId(labelName);
        if (!labelId) {
            throw new Error(`Label not found: ${labelName}`);
        }

        await this.client.post(`/cards/${cardId}/idLabels`, {
            value: labelId,
        });

        logger.info(`Added label ${labelName} to card ${cardId}`);
    }

    /**
     * Архівувати картку
     */
    async archiveCard(cardId: string): Promise<void> {
        await this.client.put(`/cards/${cardId}`, {
            closed: true,
        });

        logger.info(`Archived card ${cardId}`);
    }

    /**
     * Отримати картку за ID
     */
    async getCard(cardId: string): Promise<TrelloCard> {
        const { data } = await this.client.get<TrelloCard>(`/cards/${cardId}`);
        return data;
    }

    /**
     * Отримати всі картки дошки
     */
    async getAllCards(): Promise<TrelloCard[]> {
        const { data } = await this.client.get<TrelloCard[]>(
            `/boards/${this.boardId}/cards`
        );
        return data;
    }

    /**
     * Отримати картки списку
     */
    async getListCards(listName: string): Promise<TrelloCard[]> {
        const listId = this.getListId(listName);
        if (!listId) return [];

        const { data } = await this.client.get<TrelloCard[]>(`/lists/${listId}/cards`);
        return data;
    }

    /**
     * Оновити картку звіту
     */
    async updateReportCard(
        cardId: string,
        reportData: {
            name: string;
            weekNumber: number;
            year: number;
            position: string;
            team: string;
            workload: number;
            tasksCompleted: number;
            tasksNotCompleted: number;
            completionRate: number;
            hasBlockers: boolean;
            concerns?: string | null;
            improvements?: string | null;
            priorities?: string | null;
        },
        completedTasks: Array<{ title: string; project?: string; hours: number }>,
        notCompletedTasks: Array<{ title: string; reason: string; eta?: Date | string | null; blocker?: string | null }>
    ): Promise<TrelloCard> {
        await this.initialize();

        // Оновити назву картки
        const cardName = `📋 ${reportData.name} - Week ${String(reportData.weekNumber).padStart(2, '0')}/${reportData.year}`;

        // Згенерувати новий опис
        const description = this.generateCardDescription(reportData, completedTasks, notCompletedTasks);

        // Визначення міток
        const labelIds: string[] = [];

        // Мітка навантаження
        const workloadLabelId = this.getWorkloadLabelId(reportData.workload as Workload);
        if (workloadLabelId) labelIds.push(workloadLabelId);

        // Мітка Needs Review
        const needsReviewLabelId = this.getLabelId('Needs Review');
        if (needsReviewLabelId) labelIds.push(needsReviewLabelId);

        // Мітка Has Blockers
        if (reportData.hasBlockers) {
            const blockersLabelId = this.getLabelId('Has Blockers');
            if (blockersLabelId) labelIds.push(blockersLabelId);
        }

        // Мітка All Tasks Done
        if (reportData.completionRate === 100) {
            const allDoneLabelId = this.getLabelId('All Tasks Done');
            if (allDoneLabelId) labelIds.push(allDoneLabelId);
        }

        // Мітка Has Concerns
        if (reportData.concerns) {
            const concernsLabelId = this.getLabelId('Has Concerns');
            if (concernsLabelId) labelIds.push(concernsLabelId);
        }

        // Оновити картку
        const { data: card } = await this.client.put<TrelloCard>(`/cards/${cardId}`, {
            name: cardName,
            desc: description,
            idLabels: labelIds,
        });

        logger.info(`Updated Trello card: ${card.id} - ${card.name}`);
        return card;
    }
}

// Export singleton instance
export const trelloService = new TrelloService();
export default trelloService;
