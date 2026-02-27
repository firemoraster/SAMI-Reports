/**
 * SAMI Weekly Reports - PDF Service
 * Парсинг та генерація PDF документів
 */

import fs from 'fs';
import path from 'path';
import PDFDocument from 'pdfkit';
import pdfParse from 'pdf-parse';
import QRCode from 'qrcode';
import config from '../config';
import logger from '../utils/logger';
import { formatDate, getWeekNumber, getCurrentYear } from '../utils/helpers';
import type { 
    ParsedPdfData, 
    CompletedTask, 
    NotCompletedTask,
    Position,
    Team,
    Workload,
    PdfGenerationOptions,
    Language 
} from '../types';

// ============================================
// PDF PARSER
// ============================================

/**
 * Парсинг PDF файлу та витягування даних звіту
 */
export async function parsePdfReport(filePath: string): Promise<ParsedPdfData> {
    logger.info(`Parsing PDF: ${filePath}`);

    try {
        const buffer = fs.readFileSync(filePath);
        const data = await pdfParse(buffer);
        const text = data.text;

        // Зберігаємо raw text для дебагу
        const debugDir = path.join(process.cwd(), 'logs');
        if (!fs.existsSync(debugDir)) {
            fs.mkdirSync(debugDir, { recursive: true });
        }
        const debugPath = path.join(debugDir, 'pdf_raw_text.txt');
        fs.writeFileSync(debugPath, text, 'utf8');
        logger.info(`PDF raw text saved to: ${debugPath}`);
        
        // Логуємо перші 2000 символів для дебагу
        console.log('=== PDF RAW TEXT (first 2000 chars) ===');
        console.log(text.substring(0, 2000));
        console.log('=== END RAW TEXT ===');

        // Витягування даних з тексту PDF
        const parsedData = extractDataFromText(text);
        
        logger.info('PDF parsed successfully', {
            name: parsedData.name,
            position: parsedData.position,
            team: parsedData.team,
            weekNumber: parsedData.weekNumber,
            workload: parsedData.workload,
            completedTasks: parsedData.completedTasks.length,
            notCompletedTasks: parsedData.notCompletedTasks.length,
        });

        return parsedData;
    } catch (error) {
        logger.error('Failed to parse PDF:', error);
        throw new Error('Не вдалося прочитати PDF файл');
    }
}

/**
 * Витягування даних з тексту PDF
 * Універсальний парсер для різних форматів PDF звітів
 */
function extractDataFromText(text: string): ParsedPdfData {
    // Нормалізація тексту
    const normalizedText = text
        .replace(/\t+/g, ' ')
        .replace(/ {2,}/g, ' ')
        .replace(/\r\n/g, '\n')
        .replace(/_+/g, ' '); // Видаляємо підкреслення (часто використовуються для форматування)
    
    const lines = normalizedText.split('\n').map(l => l.trim()).filter(l => l);
    
    const result: ParsedPdfData = {
        completedTasks: [],
        notCompletedTasks: [],
    };

    // === УНІВЕРСАЛЬНІ ПАТЕРНИ ДЛЯ ПОШУКУ ПОЛІВ ===
    
    // Патерни для імені (ПІБ)
    const namePatterns = [
        /(?:ПІБ|Ім['`']?я|Name|Прізвище|Співробітник|ФІО|Employee|Reporter|Автор|Звітує)\s*[:：]?\s*(.+)/i,
        /^([А-ЯІЇЄҐA-Z][а-яіїєґa-z]+\s+[А-ЯІЇЄҐA-Z][а-яіїєґa-z]+(?:\s+[А-ЯІЇЄҐA-Z][а-яіїєґa-z]+)?)\s*$/im,
    ];
    
    // Патерни для посади
    const positionPatterns = [
        /(?:Посада|Position|Роль|Role|Title|Job)\s*[:：]?\s*(.+)/i,
    ];
    
    // Патерни для тижня
    const weekPatterns = [
        /(?:Тиждень|Week|Номер\s*тижня|Week\s*(?:No|№|#))\s*[:：№#]?\s*(\d+)/i,
        /(?:№|No|#)\s*(\d+)\s*(?:тиждень|week)/i,
        /week\s*(\d+)/i,
    ];
    
    // Патерни для року
    const yearPatterns = [
        /(?:Рік|Year)\s*[:：]?\s*(\d{4})/i,
        /(\d{4})\s*(?:рік|year|р\.)/i,
    ];
    
    // Патерни для навантаження (1-5)
    const workloadPatterns = [
        /(?:Навантаження|Workload|Оцінка|Rate|Rating|Завантаженість|Score)\s*[:\-\s]+(\d)\s*(?:\/\s*\d)?/i,
        /(\d)\s*(?:із|з|of|\/)\s*5/i,
        /(?:рівень|level)\s*[:\s]+(\d)/i,
    ];

    // === ПОШУК ЗНАЧЕНЬ ===
    
    // Функція пошуку по патернах
    const findByPatterns = (patterns: RegExp[], source: string): string | null => {
        for (const pattern of patterns) {
            const match = source.match(pattern);
            if (match && match[1]) {
                const value = match[1].trim();
                // Фільтруємо зайві значення (мінімум 1 символ для чисел)
                if (value.length >= 1 && value.length < 100) {
                    return value;
                }
            }
        }
        return null;
    };
    
    // Функція пошуку значення поля на поточному або наступному рядку
    const findFieldValue = (fieldNames: string[]): string | null => {
        for (let i = 0; i < lines.length; i++) {
            for (const fieldName of fieldNames) {
                // Якщо рядок містить назву поля
                if (lines[i].toLowerCase().includes(fieldName.toLowerCase())) {
                    // Спробувати витягти значення з цього рядка
                    const colonMatch = lines[i].match(new RegExp(`${fieldName}\\s*[:：]?\\s*(.+)`, 'i'));
                    if (colonMatch && colonMatch[1].trim().length > 0) {
                        return colonMatch[1].trim();
                    }
                    // Або з наступного рядка
                    if (i + 1 < lines.length) {
                        const nextLine = lines[i + 1].trim();
                        const isField = /^(ПІБ|Посада|Команда|Тиждень|Рік|Дата|№|No|Навантаження|Виконані|Невиконані)/i.test(nextLine);
                        if (!isField && nextLine.length > 1 && nextLine.length < 100) {
                            return nextLine;
                        }
                    }
                }
            }
        }
        return null;
    };

    // Парсинг ПІБ
    let name = findByPatterns(namePatterns, normalizedText);
    if (!name) {
        name = findFieldValue(['ПІБ', 'Ім\'я', 'Імя', 'Name', 'Співробітник', 'ФІО', 'Прізвище', 'Employee']);
    }
    if (name && name.length > 1) {
        // Очищення імені від зайвих символів
        result.name = name.replace(/[:：]/g, '').trim();
        logger.info(`Parsed name: ${result.name}`);
    }

    // Парсинг посади
    let position = findByPatterns(positionPatterns, normalizedText);
    if (!position) {
        position = findFieldValue(['Посада', 'Position', 'Роль', 'Role', 'Title']);
    }
    if (position) {
        result.position = mapPosition(position);
        logger.info(`Parsed position: ${position} -> ${result.position}`);
    }

    // Парсинг команди
    const team = findFieldValue(['Команда', 'Team', 'Відділ', 'Department', 'Group']);
    if (team) {
        result.team = mapTeam(team);
        logger.info(`Parsed team: ${team} -> ${result.team}`);
    }

    // Парсинг тижня
    const weekMatch = findByPatterns(weekPatterns, normalizedText);
    if (weekMatch) {
        const weekNum = parseInt(weekMatch, 10);
        if (weekNum >= 1 && weekNum <= 53) {
            result.weekNumber = weekNum;
            logger.info(`Parsed week: ${result.weekNumber}`);
        }
    }

    // Парсинг року
    const yearMatch = findByPatterns(yearPatterns, normalizedText);
    if (yearMatch) {
        const year = parseInt(yearMatch, 10);
        if (year >= 2020 && year <= 2100) {
            result.year = year;
            logger.info(`Parsed year: ${result.year}`);
        }
    }

    // Парсинг навантаження
    const workloadMatch = findByPatterns(workloadPatterns, normalizedText);
    logger.info(`Workload match result: ${workloadMatch}`);
    if (workloadMatch) {
        const workload = parseInt(workloadMatch, 10);
        if (workload >= 1 && workload <= 5) {
            result.workload = workload as Workload;
            logger.info(`Parsed workload: ${result.workload}`);
        }
    }

    // === ПАРСИНГ ЗАДАЧ ===
    
    // Парсинг виконаних задач
    const completedSection = extractSection(normalizedText, 
        ['ВИКОНАНІ ЗАДАЧІ', 'ВИКОНАНО', 'COMPLETED', 'Виконані задачі', 'Completed tasks', 'Done', 'Зроблено', 'Finished'],
        ['НЕВИКОНАНІ ЗАДАЧІ', 'НЕ ВИКОНАНО', 'NOT COMPLETED', 'Невиконані', 'ДОДАТКОВА', 'Incomplete', 'Pending', 'In progress']
    );

    if (completedSection) {
        result.completedTasks = parseCompletedTasks(completedSection);
        logger.info(`Parsed ${result.completedTasks.length} completed tasks`);
    }

    // Парсинг невиконаних задач
    const notCompletedSection = extractSection(normalizedText,
        ['НЕВИКОНАНІ ЗАДАЧІ', 'НЕ ВИКОНАНО', 'NOT COMPLETED', 'Невиконані задачі', 'Incomplete tasks', 'Pending', 'In progress', 'Не завершено'],
        ['ДОДАТКОВА ІНФОРМАЦІЯ', 'Що турбує', 'Що вас турбує', 'Concerns', 'Пропозиції', 'Навантаження', 'Workload', 'Additional']
    );

    if (notCompletedSection) {
        result.notCompletedTasks = parseNotCompletedTasks(notCompletedSection);
        logger.info(`Parsed ${result.notCompletedTasks.length} not completed tasks`);
    }

    // === ПАРСИНГ ДОДАТКОВОЇ ІНФОРМАЦІЇ ===
    
    const additionalSection = extractSection(normalizedText,
        ['ДОДАТКОВА ІНФОРМАЦІЯ', 'ADDITIONAL INFO', 'Додаткова', 'Additional', 'Що турбує', 'Concerns'],
        ['---', '===', 'Підпис', 'Signature', 'END']
    );
    
    if (additionalSection) {
        const cleanText = (t: string) => t.replace(/_+/g, ' ').replace(/\s+/g, ' ').trim();
        
        // Что турбує?
        const concernsPatterns = [
            /(?:Що\s+(?:вас\s+)?турбує|Concerns?|Побоювання|Issues?|Problems?)\s*[:：]?\s*([\s\S]*?)(?=Пропозиції|Improvements?|$)/i,
        ];
        for (const pattern of concernsPatterns) {
            const match = additionalSection.match(pattern);
            if (match && match[1].trim()) {
                result.concerns = cleanText(match[1]);
                break;
            }
        }
        
        // Пропозиції
        const improvementsPatterns = [
            /(?:Пропозиції|Improvements?|Suggestions?|Ideas?)\s*[:：]?\s*([\s\S]*?)(?=Пріоритети|Priorities?|$)/i,
        ];
        for (const pattern of improvementsPatterns) {
            const match = additionalSection.match(pattern);
            if (match && match[1].trim()) {
                result.improvements = cleanText(match[1]);
                break;
            }
        }
        
        // Пріоритети
        const prioritiesPatterns = [
            /(?:Пріоритети|Priorities?|Next\s*week|Plans?)\s*[:：]?\s*([\s\S]*?)$/i,
        ];
        for (const pattern of prioritiesPatterns) {
            const match = additionalSection.match(pattern);
            if (match && match[1].trim()) {
                result.priorities = cleanText(match[1]);
                break;
            }
        }
    }

    // Якщо concerns не знайдено в секції, шукаємо в повному тексті
    if (!result.concerns) {
        const globalConcernsMatch = normalizedText.match(/(?:Що\s+(?:вас\s+)?турбує|Concerns?|Побоювання)\s*[:：]?\s*([^\n]+)/i);
        if (globalConcernsMatch && globalConcernsMatch[1].trim().length > 2) {
            result.concerns = globalConcernsMatch[1].trim();
            logger.info(`Global concerns found: ${result.concerns}`);
        }
    }
    
    // Якщо improvements не знайдено в секції, шукаємо в повному тексті
    if (!result.improvements) {
        const globalImprovementsMatch = normalizedText.match(/(?:Пропозиції|Improvements?|Suggestions?)\s*[:：]?\s*([^\n]+)/i);
        if (globalImprovementsMatch && globalImprovementsMatch[1].trim().length > 2) {
            result.improvements = globalImprovementsMatch[1].trim();
            logger.info(`Global improvements found: ${result.improvements}`);
        }
    }

    // Логування результату
    logger.info('Final parsed PDF data:', {
        name: result.name,
        position: result.position,
        team: result.team,
        weekNumber: result.weekNumber,
        year: result.year,
        workload: result.workload,
        completedTasks: result.completedTasks?.length || 0,
        notCompletedTasks: result.notCompletedTasks?.length || 0,
        concerns: result.concerns ? 'yes' : 'no',
        improvements: result.improvements ? 'yes' : 'no'
    });

    return result;
}

/**
 * Парсинг виконаних задач з різних форматів
 */
function parseCompletedTasks(section: string): Array<{ title: string; project?: string; hours: number }> {
    const tasks: Array<{ title: string; project?: string; hours: number }> = [];
    const lines = section.split('\n').filter(l => l.trim());

    // Патерн для рядків з задачами
    const taskPatterns = [
        // "1. Задача | 8" або "1. Задача | Проєкт | 8"
        /^\d+[\.\)\s]+(.+?)\s*[|\t]\s*(\d+(?:[.,]\d+)?)\s*$/,
        /^\d+[\.\)\s]+(.+?)\s*[|\t]\s*(.+?)\s*[|\t]\s*(\d+(?:[.,]\d+)?)\s*$/,
        // "• Задача - 8 год" або "- Задача (8h)"
        /^[•\-\*]\s+(.+?)\s*[-–—]\s*(\d+(?:[.,]\d+)?)\s*(?:год|h|hours?)?/i,
        /^[•\-\*]\s+(.+?)\s*\((\d+(?:[.,]\d+)?)\s*(?:год|h|hours?)?\)/i,
        // "Задача: 8 год"
        /^(.+?)\s*[:：]\s*(\d+(?:[.,]\d+)?)\s*(?:год|h|hours?)?$/i,
        // PDF table: "1 Задача 8" (space-separated, hours at end)
        /^\d+\s+(.+?)\s+(\d+(?:[.,]\d+)?)\s*$/,
    ];

    for (const line of lines) {
        const trimmedLine = line.trim();
        
        // Пропускаємо заголовки секцій та порожні рядки
        if (/^(№|No\b|#|Назва|Title|Задача|Task|Години|Hours|Проєкт|Project|ВИКОНАНІ|НЕВИКОНАНІ|COMPLETED|NOT\s*COMPLETED|Виконано|Done)/i.test(trimmedLine)) continue;
        if (trimmedLine.length < 3) continue;
        // Пропускаємо рядки-заглушки (тільки номер та пробіли)
        if (/^\d+\s*$/.test(trimmedLine)) continue;

        let matched = false;

        // Спробувати кожен патерн
        for (const pattern of taskPatterns) {
            const match = trimmedLine.match(pattern);
            if (match) {
                if (match.length === 4) {
                    // Формат з проєктом
                    tasks.push({
                        title: match[1].trim(),
                        project: match[2].trim(),
                        hours: parseFloat(match[3].replace(',', '.')) || 0,
                    });
                } else if (match.length === 3) {
                    // Формат без проєкту
                    tasks.push({
                        title: match[1].trim(),
                        hours: parseFloat(match[2].replace(',', '.')) || 0,
                    });
                }
                matched = true;
                break;
            }
        }

        // Якщо жоден патерн не спрацював, спробувати розбити по роздільникам
        if (!matched) {
            // Видалити номер якщо є
            const content = trimmedLine.replace(/^\d+[\.\)\s]+/, '').trim();
            const parts = content.split(/[|\t]|\s{2,}/).map(p => p.trim()).filter(p => p);
            
            if (parts.length >= 2) {
                // Остання частина - години (якщо це число)
                const lastPart = parts[parts.length - 1];
                const hoursMatch = lastPart.match(/^(\d+(?:[.,]\d+)?)/);
                
                if (hoursMatch) {
                    if (parts.length === 2) {
                        tasks.push({
                            title: parts[0],
                            hours: parseFloat(hoursMatch[1].replace(',', '.')) || 0,
                        });
                    } else {
                        tasks.push({
                            title: parts[0],
                            project: parts.slice(1, -1).join(' '),
                            hours: parseFloat(hoursMatch[1].replace(',', '.')) || 0,
                        });
                    }
                }
            }
            
            // Останній фолбек: текст що закінчується числом (години)
            if (parts.length < 2 && content.length >= 3) {
                const endMatch = content.match(/^(.+?)\s+(\d+(?:[.,]\d+)?)\s*$/);
                if (endMatch && endMatch[1].trim().length >= 3) {
                    tasks.push({
                        title: endMatch[1].trim(),
                        hours: parseFloat(endMatch[2].replace(',', '.')) || 0,
                    });
                }
            }
        }
    }

    return tasks;
}

/**
 * Парсинг невиконаних задач з різних форматів
 */
function parseNotCompletedTasks(section: string): Array<{ title: string; reason: string; eta?: Date | string; blocker?: string }> {
    const tasks: Array<{ title: string; reason: string; eta?: Date | string; blocker?: string }> = [];
    const lines = section.split('\n').filter(l => l.trim());

    for (const line of lines) {
        const trimmedLine = line.trim();
        
        // Пропускаємо заголовки секцій та службові рядки
        if (/^(№|No\b|#|Назва|Title|Задача|Task|Причина|Reason|ETA|Blocker|НЕВИКОНАНІ|ВИКОНАНІ|NOT\s*COMPLETED|COMPLETED|ОЦІНКА|Pending|In\s*progress)/i.test(trimmedLine)) continue;
        if (trimmedLine.length < 5) continue;
        // Пропускаємо рядки-заглушки (тільки номер та пробіли)
        if (/^\d+\s*$/.test(trimmedLine)) continue;

        // Видалити номер якщо є
        const content = trimmedLine.replace(/^\d+[\.\)\s]+/, '').trim();
        
        // Спробувати розбити по роздільникам (pipe, tab, або 2+ пробіли)
        const parts = content.split(/[|\t]|\s{2,}/).map(p => p.trim()).filter(p => p);
        
        // Потрібно мінімум 2 частини: назва задачі + причина
        if (parts.length >= 2) {
            const task: { title: string; reason: string; eta?: Date | string; blocker?: string } = {
                title: parts[0] || 'Задача',
                reason: parts[1] || 'Не вказано',
            };
            
            // ETA якщо є
            if (parts[2]) {
                const etaDate = parseDate(parts[2]);
                if (etaDate) {
                    task.eta = etaDate;
                } else {
                    task.eta = parts[2]; // Зберігаємо як текст
                }
            }
            
            // Blocker якщо є
            if (parts[3]) {
                task.blocker = parts[3];
            }
            
            tasks.push(task);
        }
    }

    return tasks;
}

/**
 * Витягування секції тексту
 */
function extractSection(text: string, startMarkers: string[], endMarkers: string[]): string | null {
    const lowerText = text.toLowerCase();
    
    let startIndex = -1;
    for (const marker of startMarkers) {
        const idx = lowerText.indexOf(marker.toLowerCase());
        if (idx !== -1 && (startIndex === -1 || idx < startIndex)) {
            startIndex = idx;
        }
    }

    if (startIndex === -1) return null;

    let endIndex = text.length;
    for (const marker of endMarkers) {
        const idx = lowerText.indexOf(marker.toLowerCase(), startIndex + 10);
        if (idx !== -1 && idx < endIndex) {
            endIndex = idx;
        }
    }

    return text.substring(startIndex, endIndex);
}

/**
 * Мапінг позицій
 */
function mapPosition(value: string): Position {
    const map: Record<string, Position> = {
        'pm': 'PM',
        'dev': 'Dev',
        'розробник': 'Dev',
        'developer': 'Dev',
        'design': 'Design',
        'дизайнер': 'Design',
        'designer': 'Design',
        'qa': 'QA',
        'тестувальник': 'QA',
        'tester': 'QA',
        'ba': 'BA',
        'аналітик': 'BA',
        'analyst': 'BA',
        'менеджер': 'PM',
        'manager': 'PM',
        'хелпдеск': 'Helpdesk',
        'helpdesk': 'Helpdesk',
        'support': 'Support',
        'підтримка': 'Support',
    };
    
    const result = map[value.toLowerCase()] || 'Other';
    // Логуємо якщо не знайшли у мапі
    if (!map[value.toLowerCase()]) {
        logger.info(`Position '${value}' not in map, using Other`);
    }
    return result;
}

/**
 * Мапінг команд
 */
function mapTeam(value: string): Team {
    const map: Record<string, Team> = {
        'core': 'Core',
        'mobile': 'Mobile',
        'web': 'Web',
        'frontend': 'Web',
        'фронтенд': 'Web',
        'infra': 'Infra',
        'інфраструктура': 'Infra',
        'data': 'Data',
        'дата': 'Data',
        'backend': 'Core',
        'бекенд': 'Core',
        'sami': 'SAMI',
        'самі': 'SAMI',
    };
    
    const result = map[value.toLowerCase()] || 'Other';
    // Логуємо якщо не знайшли у мапі
    if (!map[value.toLowerCase()]) {
        logger.info(`Team '${value}' not in map, using Other`);
    }
    return result;
}

/**
 * Парсинг дати
 */
function parseDate(dateStr: string): Date | undefined {
    const formats = [
        /(\d{2})\.(\d{2})\.(\d{4})/, // DD.MM.YYYY
        /(\d{4})-(\d{2})-(\d{2})/, // YYYY-MM-DD
        /(\d{2})\/(\d{2})\/(\d{4})/, // DD/MM/YYYY
    ];

    for (const format of formats) {
        const match = dateStr.match(format);
        if (match) {
            const date = new Date(dateStr);
            if (!isNaN(date.getTime())) {
                return date;
            }
        }
    }

    return undefined;
}

// ============================================
// PDF GENERATOR
// ============================================

/**
 * Генерація PDF звіту
 */
export async function generatePdfReport(
    reportData: {
        name: string;
        position: string;
        team: string;
        weekNumber: number;
        year: number;
        workload: number;
        completedTasks: CompletedTask[];
        notCompletedTasks: NotCompletedTask[];
        concerns?: string;
        improvements?: string;
        priorities?: string;
    },
    options: PdfGenerationOptions = {}
): Promise<string> {
    const { includeQrCode = true, language = 'uk' } = options;

    // Створити директорію якщо не існує
    if (!fs.existsSync(config.pdf.tempPath)) {
        fs.mkdirSync(config.pdf.tempPath, { recursive: true });
    }

    const fileName = `report_${reportData.name.replace(/\s+/g, '_')}_week${reportData.weekNumber}_${Date.now()}.pdf`;
    const filePath = path.join(config.pdf.tempPath, fileName);

    return new Promise((resolve, reject) => {
        try {
            const doc = new PDFDocument({
                size: 'A4',
                margin: 50,
                info: {
                    Title: `Weekly Report - ${reportData.name} - Week ${reportData.weekNumber}`,
                    Author: 'SAMI Weekly Reports System',
                },
            });

            const stream = fs.createWriteStream(filePath);
            doc.pipe(stream);

            // Заголовок
            doc.fontSize(24)
               .font('Helvetica-Bold')
               .text('📊 ТИЖНЕВИЙ ЗВІТ', { align: 'center' });
            
            doc.moveDown(0.5);
            doc.fontSize(14)
               .font('Helvetica')
               .text(`Тиждень ${reportData.weekNumber} / ${reportData.year}`, { align: 'center' });

            doc.moveDown(1);
            doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
            doc.moveDown(1);

            // Інформація про співробітника
            doc.fontSize(12).font('Helvetica-Bold').text('ІНФОРМАЦІЯ ПРО СПІВРОБІТНИКА');
            doc.moveDown(0.5);
            doc.font('Helvetica');
            doc.text(`👤 Ім'я: ${reportData.name}`);
            doc.text(`💼 Посада: ${reportData.position}`);
            doc.text(`👥 Команда: ${reportData.team}`);
            doc.text(`📅 Дата: ${formatDate(new Date())}`);

            doc.moveDown(1);

            // Підсумок
            doc.font('Helvetica-Bold').text('📈 ПІДСУМОК');
            doc.moveDown(0.5);
            doc.font('Helvetica');
            
            const totalTasks = reportData.completedTasks.length + reportData.notCompletedTasks.length;
            const completionRate = totalTasks > 0 
                ? Math.round((reportData.completedTasks.length / totalTasks) * 100) 
                : 0;

            doc.text(`• Навантаження: ${reportData.workload}/5`);
            doc.text(`• Виконано задач: ${reportData.completedTasks.length}`);
            doc.text(`• Не виконано: ${reportData.notCompletedTasks.length}`);
            doc.text(`• % виконання: ${completionRate}%`);

            doc.moveDown(1);

            // Виконані задачі
            if (reportData.completedTasks.length > 0) {
                doc.font('Helvetica-Bold').text('✅ ВИКОНАНІ ЗАДАЧІ');
                doc.moveDown(0.5);
                doc.font('Helvetica');

                // Заголовок таблиці
                const tableTop = doc.y;
                doc.text('№', 50, tableTop, { width: 30 });
                doc.text('Задача', 80, tableTop, { width: 350 });
                doc.text('Години', 430, tableTop, { width: 50 });
                
                doc.moveDown(0.3);
                doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
                doc.moveDown(0.3);

                reportData.completedTasks.forEach((task, i) => {
                    const y = doc.y;
                    doc.text(String(i + 1), 50, y, { width: 30 });
                    doc.text(task.title, 80, y, { width: 350 });
                    doc.text(String(task.hours), 430, y, { width: 50 });
                    doc.moveDown(0.5);
                });

                doc.moveDown(1);
            }

            // Невиконані задачі
            if (reportData.notCompletedTasks.length > 0) {
                // Перевірка чи потрібна нова сторінка
                if (doc.y > 650) {
                    doc.addPage();
                }

                doc.font('Helvetica-Bold').text('❌ НЕВИКОНАНІ ЗАДАЧІ');
                doc.moveDown(0.5);
                doc.font('Helvetica');

                reportData.notCompletedTasks.forEach((task, i) => {
                    doc.text(`${i + 1}. ${task.title}`);
                    doc.text(`   Причина: ${task.reason}`, { indent: 20 });
                    if (task.eta) {
                        doc.text(`   ETA: ${formatDate(task.eta)}`, { indent: 20 });
                    }
                    if (task.blocker) {
                        doc.text(`   ⚠️ Блокер: ${task.blocker}`, { indent: 20 });
                    }
                    doc.moveDown(0.5);
                });

                doc.moveDown(0.5);
            }

            // Текстові поля
            if (reportData.concerns) {
                doc.font('Helvetica-Bold').text('😟 ЩО ТУРБУЄ?');
                doc.moveDown(0.3);
                doc.font('Helvetica').text(reportData.concerns);
                doc.moveDown(1);
            }

            if (reportData.improvements) {
                doc.font('Helvetica-Bold').text('💡 ЩО МОЖНА ПОКРАЩИТИ?');
                doc.moveDown(0.3);
                doc.font('Helvetica').text(reportData.improvements);
                doc.moveDown(1);
            }

            if (reportData.priorities) {
                doc.font('Helvetica-Bold').text('🎯 ПРІОРИТЕТИ НА НАСТУПНИЙ ТИЖДЕНЬ');
                doc.moveDown(0.3);
                doc.font('Helvetica').text(reportData.priorities);
                doc.moveDown(1);
            }

            // QR-код (якщо потрібно)
            if (includeQrCode) {
                // Генерація QR-коду буде додана пізніше
            }

            // Футер
            doc.fontSize(10)
               .font('Helvetica')
               .text(
                   'Згенеровано SAMI Weekly Reports System',
                   50,
                   750,
                   { align: 'center' }
               );

            doc.end();

            stream.on('finish', () => {
                logger.info(`PDF generated: ${filePath}`);
                resolve(filePath);
            });

            stream.on('error', reject);
        } catch (error) {
            reject(error);
        }
    });
}

/**
 * Генерація порожнього шаблону PDF
 */
export async function generatePdfTemplate(lang: Language = 'uk'): Promise<string> {
    const fileName = `report_template_${lang}.pdf`;
    const filePath = path.join(config.pdf.templatesPath, fileName);

    // Створити директорію якщо не існує
    if (!fs.existsSync(config.pdf.templatesPath)) {
        fs.mkdirSync(config.pdf.templatesPath, { recursive: true });
    }

    return new Promise((resolve, reject) => {
        try {
            const doc = new PDFDocument({
                size: 'A4',
                margin: 50,
            });

            const stream = fs.createWriteStream(filePath);
            doc.pipe(stream);

            const labels = lang === 'uk' ? {
                title: '📊 ТИЖНЕВИЙ ЗВІТ',
                info: "ІНФОРМАЦІЯ ПРО СПІВРОБІТНИКА",
                name: "Ім'я та прізвище:",
                position: 'Посада:',
                team: 'Команда:',
                date: 'Дата:',
                week: 'Тиждень:',
                completed: '✅ ВИКОНАНІ ЗАДАЧІ',
                notCompleted: '❌ НЕВИКОНАНІ ЗАДАЧІ',
                task: 'Задача',
                hours: 'Години',
                reason: 'Причина',
                eta: 'ETA',
                blocker: 'Блокер',
                workload: '📊 НАВАНТАЖЕННЯ (1-5):',
                concerns: '😟 ЩО ТУРБУЄ?',
            } : {
                title: '📊 WEEKLY REPORT',
                info: 'EMPLOYEE INFORMATION',
                name: 'Full Name:',
                position: 'Position:',
                team: 'Team:',
                date: 'Date:',
                week: 'Week:',
                completed: '✅ COMPLETED TASKS',
                notCompleted: '❌ NOT COMPLETED TASKS',
                task: 'Task',
                hours: 'Hours',
                reason: 'Reason',
                eta: 'ETA',
                blocker: 'Blocker',
                workload: '📊 WORKLOAD (1-5):',
                concerns: '😟 CONCERNS?',
            };

            // Заголовок
            doc.fontSize(24).font('Helvetica-Bold').text(labels.title, { align: 'center' });
            doc.moveDown(2);

            // Інформація
            doc.fontSize(14).font('Helvetica-Bold').text(labels.info);
            doc.moveDown(0.5);
            doc.fontSize(12).font('Helvetica');
            doc.text(`${labels.name} ____________________`);
            doc.text(`${labels.position} ____________________`);
            doc.text(`${labels.team} ____________________`);
            doc.text(`${labels.date} ____________________`);
            doc.text(`${labels.week} ____________________`);

            doc.moveDown(1);

            // Таблиця виконаних задач
            doc.fontSize(14).font('Helvetica-Bold').text(labels.completed);
            doc.moveDown(0.5);
            
            // Таблиця
            drawTable(doc, [
                ['№', labels.task, labels.hours],
                ['1', '', ''],
                ['2', '', ''],
                ['3', '', ''],
                ['4', '', ''],
                ['5', '', ''],
            ], [30, 400, 60]);

            doc.moveDown(1);

            // Таблиця невиконаних задач
            doc.fontSize(14).font('Helvetica-Bold').text(labels.notCompleted);
            doc.moveDown(0.5);

            drawTable(doc, [
                ['№', labels.task, labels.reason, labels.eta, labels.blocker],
                ['1', '', '', '', ''],
                ['2', '', '', '', ''],
                ['3', '', '', '', ''],
            ], [30, 150, 140, 80, 90]);

            // Нова сторінка
            doc.addPage();

            // Навантаження
            doc.fontSize(14).font('Helvetica-Bold').text(labels.workload);
            doc.moveDown(0.5);
            doc.font('Helvetica').fontSize(12);
            doc.text('○ 1 - Дуже низьке / Very Low');
            doc.text('○ 2 - Низьке / Low');
            doc.text('○ 3 - Середнє / Medium');
            doc.text('○ 4 - Високе / High');
            doc.text('○ 5 - Критичне / Critical');

            doc.moveDown(1);

            // Текстові поля
            doc.fontSize(14).font('Helvetica-Bold').text(labels.concerns);
            doc.moveDown(0.5);
            doc.rect(50, doc.y, 495, 120).stroke();

            doc.end();

            stream.on('finish', () => {
                logger.info(`PDF template generated: ${filePath}`);
                resolve(filePath);
            });

            stream.on('error', reject);
        } catch (error) {
            reject(error);
        }
    });
}

/**
 * Малювання таблиці
 */
function drawTable(doc: PDFKit.PDFDocument, rows: string[][], colWidths: number[]): void {
    const startX = 50;
    let startY = doc.y;
    const rowHeight = 25;
    const padding = 5;

    doc.font('Helvetica').fontSize(10);

    rows.forEach((row, rowIndex) => {
        let x = startX;
        const y = startY + rowIndex * rowHeight;

        row.forEach((cell, colIndex) => {
            const width = colWidths[colIndex];
            
            // Малювання комірки
            doc.rect(x, y, width, rowHeight).stroke();
            
            // Текст комірки
            if (rowIndex === 0) {
                doc.font('Helvetica-Bold');
            } else {
                doc.font('Helvetica');
            }
            
            doc.text(cell, x + padding, y + padding, {
                width: width - padding * 2,
                height: rowHeight - padding * 2,
                ellipsis: true,
            });

            x += width;
        });
    });

    doc.y = startY + rows.length * rowHeight;
}

/**
 * Генерація QR-коду
 */
export async function generateQrCode(data: string, outputPath?: string): Promise<string> {
    const fileName = outputPath || path.join(config.pdf.tempPath, `qr_${Date.now()}.png`);
    
    await QRCode.toFile(fileName, data, {
        errorCorrectionLevel: 'M',
        type: 'png',
        width: 150,
        margin: 1,
    });

    return fileName;
}

export default {
    parsePdfReport,
    generatePdfReport,
    generatePdfTemplate,
    generateQrCode,
};
