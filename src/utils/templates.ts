/**
 * SAMI Weekly Reports - Template Generator
 * Генерація шаблонів звітів у форматах Word та Excel
 */

import { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, BorderStyle, AlignmentType, HeadingLevel } from 'docx';
import ExcelJS from 'exceljs';
import fs from 'fs';
import path from 'path';

const TEMPLATES_DIR = path.join(__dirname, '..', '..', 'templates');

/**
 * Створити директорію для шаблонів
 */
function ensureTemplatesDir(): void {
    if (!fs.existsSync(TEMPLATES_DIR)) {
        fs.mkdirSync(TEMPLATES_DIR, { recursive: true });
    }
}

/**
 * Генерація Word шаблону
 */
export async function generateWordTemplate(): Promise<string> {
    ensureTemplatesDir();

    const doc = new Document({
        sections: [{
            properties: {},
            children: [
                // Заголовок
                new Paragraph({
                    children: [
                        new TextRun({
                            text: "ТИЖНЕВИЙ ЗВІТ СПІВРОБІТНИКА",
                            bold: true,
                            size: 32,
                        }),
                    ],
                    alignment: AlignmentType.CENTER,
                    spacing: { after: 400 },
                }),

                // Інформація про співробітника
                new Paragraph({
                    children: [new TextRun({ text: "ІНФОРМАЦІЯ ПРО СПІВРОБІТНИКА", bold: true, size: 24 })],
                    heading: HeadingLevel.HEADING_2,
                    spacing: { before: 200, after: 200 },
                }),

                createInfoTable([
                    ["ПІБ:", ""],
                    ["Посада:", ""],
                    ["Команда:", ""],
                    ["Тиждень №:", ""],
                    ["Рік:", new Date().getFullYear().toString()],
                    ["Дата заповнення:", ""],
                ]),

                // Навантаження
                new Paragraph({
                    children: [new TextRun({ text: "ОЦІНКА НАВАНТАЖЕННЯ", bold: true, size: 24 })],
                    heading: HeadingLevel.HEADING_2,
                    spacing: { before: 400, after: 200 },
                }),

                new Paragraph({
                    children: [
                        new TextRun({ text: "Оцініть ваше навантаження за тиждень (1-5):", size: 22 }),
                    ],
                    spacing: { after: 100 },
                }),

                new Paragraph({
                    children: [
                        new TextRun({ text: "1 - Низьке   2 - Нижче середнього   3 - Середнє   4 - Високе   5 - Критичне", size: 20, italics: true }),
                    ],
                    spacing: { after: 100 },
                }),

                new Paragraph({
                    children: [
                        new TextRun({ text: "Ваша оцінка: ____", size: 22, bold: true }),
                    ],
                    spacing: { after: 200 },
                }),

                // Виконані задачі
                new Paragraph({
                    children: [new TextRun({ text: "✅ ВИКОНАНІ ЗАДАЧІ", bold: true, size: 24 })],
                    heading: HeadingLevel.HEADING_2,
                    spacing: { before: 400, after: 200 },
                }),

                createTasksTable(5, true),

                // Невиконані задачі
                new Paragraph({
                    children: [new TextRun({ text: "❌ НЕВИКОНАНІ ЗАДАЧІ", bold: true, size: 24 })],
                    heading: HeadingLevel.HEADING_2,
                    spacing: { before: 400, after: 200 },
                }),

                createIncompleteTasksTable(3),

                // Додаткова інформація
                new Paragraph({
                    children: [new TextRun({ text: "ДОДАТКОВА ІНФОРМАЦІЯ", bold: true, size: 24 })],
                    heading: HeadingLevel.HEADING_2,
                    spacing: { before: 400, after: 200 },
                }),

                new Paragraph({
                    children: [new TextRun({ text: "Що вас турбує? (проблеми, блокери):", bold: true, size: 22 })],
                    spacing: { after: 100 },
                }),
                new Paragraph({
                    children: [new TextRun({ text: "_".repeat(80), size: 22 })],
                    spacing: { after: 50 },
                }),
                new Paragraph({
                    children: [new TextRun({ text: "_".repeat(80), size: 22 })],
                    spacing: { after: 200 },
                }),

                new Paragraph({
                    children: [new TextRun({ text: "Пропозиції щодо покращення робочого процесу:", bold: true, size: 22 })],
                    spacing: { after: 100 },
                }),
                new Paragraph({
                    children: [new TextRun({ text: "_".repeat(80), size: 22 })],
                    spacing: { after: 50 },
                }),
                new Paragraph({
                    children: [new TextRun({ text: "_".repeat(80), size: 22 })],
                    spacing: { after: 200 },
                }),

                new Paragraph({
                    children: [new TextRun({ text: "Пріоритети на наступний тиждень:", bold: true, size: 22 })],
                    spacing: { after: 100 },
                }),
                new Paragraph({
                    children: [new TextRun({ text: "_".repeat(80), size: 22 })],
                    spacing: { after: 50 },
                }),
                new Paragraph({
                    children: [new TextRun({ text: "_".repeat(80), size: 22 })],
                    spacing: { after: 200 },
                }),
            ],
        }],
    });

    const outputPath = path.join(TEMPLATES_DIR, 'weekly_report_template.docx');
    const buffer = await Packer.toBuffer(doc);
    fs.writeFileSync(outputPath, buffer);
    
    console.log(`✅ Word шаблон створено: ${outputPath}`);
    return outputPath;
}

/**
 * Створити таблицю з інформацією
 */
function createInfoTable(rows: string[][]): Table {
    return new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: rows.map(row => new TableRow({
            children: [
                new TableCell({
                    children: [new Paragraph({ children: [new TextRun({ text: row[0], bold: true, size: 22 })] })],
                    width: { size: 30, type: WidthType.PERCENTAGE },
                }),
                new TableCell({
                    children: [new Paragraph({ children: [new TextRun({ text: row[1], size: 22 })] })],
                    width: { size: 70, type: WidthType.PERCENTAGE },
                }),
            ],
        })),
    });
}

/**
 * Створити таблицю виконаних задач
 */
function createTasksTable(rowCount: number, completed: boolean): Table {
    const headerRow = new TableRow({
        children: [
            new TableCell({
                children: [new Paragraph({ children: [new TextRun({ text: "№", bold: true, size: 20 })] })],
                width: { size: 5, type: WidthType.PERCENTAGE },
            }),
            new TableCell({
                children: [new Paragraph({ children: [new TextRun({ text: "Назва задачі", bold: true, size: 20 })] })],
                width: { size: 45, type: WidthType.PERCENTAGE },
            }),
            new TableCell({
                children: [new Paragraph({ children: [new TextRun({ text: "Проєкт", bold: true, size: 20 })] })],
                width: { size: 30, type: WidthType.PERCENTAGE },
            }),
            new TableCell({
                children: [new Paragraph({ children: [new TextRun({ text: "Години", bold: true, size: 20 })] })],
                width: { size: 20, type: WidthType.PERCENTAGE },
            }),
        ],
    });

    const dataRows = Array.from({ length: rowCount }, (_, i) => new TableRow({
        children: [
            new TableCell({
                children: [new Paragraph({ children: [new TextRun({ text: (i + 1).toString(), size: 20 })] })],
            }),
            new TableCell({
                children: [new Paragraph({ children: [new TextRun({ text: "", size: 20 })] })],
            }),
            new TableCell({
                children: [new Paragraph({ children: [new TextRun({ text: "", size: 20 })] })],
            }),
            new TableCell({
                children: [new Paragraph({ children: [new TextRun({ text: "", size: 20 })] })],
            }),
        ],
    }));

    return new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [headerRow, ...dataRows],
    });
}

/**
 * Створити таблицю невиконаних задач
 */
function createIncompleteTasksTable(rowCount: number): Table {
    const headerRow = new TableRow({
        children: [
            new TableCell({
                children: [new Paragraph({ children: [new TextRun({ text: "№", bold: true, size: 20 })] })],
                width: { size: 5, type: WidthType.PERCENTAGE },
            }),
            new TableCell({
                children: [new Paragraph({ children: [new TextRun({ text: "Назва задачі", bold: true, size: 20 })] })],
                width: { size: 35, type: WidthType.PERCENTAGE },
            }),
            new TableCell({
                children: [new Paragraph({ children: [new TextRun({ text: "Причина", bold: true, size: 20 })] })],
                width: { size: 30, type: WidthType.PERCENTAGE },
            }),
            new TableCell({
                children: [new Paragraph({ children: [new TextRun({ text: "ETA", bold: true, size: 20 })] })],
                width: { size: 15, type: WidthType.PERCENTAGE },
            }),
            new TableCell({
                children: [new Paragraph({ children: [new TextRun({ text: "Блокер", bold: true, size: 20 })] })],
                width: { size: 15, type: WidthType.PERCENTAGE },
            }),
        ],
    });

    const dataRows = Array.from({ length: rowCount }, (_, i) => new TableRow({
        children: [
            new TableCell({
                children: [new Paragraph({ children: [new TextRun({ text: (i + 1).toString(), size: 20 })] })],
            }),
            new TableCell({
                children: [new Paragraph({ children: [new TextRun({ text: "", size: 20 })] })],
            }),
            new TableCell({
                children: [new Paragraph({ children: [new TextRun({ text: "", size: 20 })] })],
            }),
            new TableCell({
                children: [new Paragraph({ children: [new TextRun({ text: "", size: 20 })] })],
            }),
            new TableCell({
                children: [new Paragraph({ children: [new TextRun({ text: "", size: 20 })] })],
            }),
        ],
    }));

    return new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [headerRow, ...dataRows],
    });
}

/**
 * Генерація Excel шаблону
 */
export async function generateExcelTemplate(): Promise<string> {
    ensureTemplatesDir();

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'SAMI Reports';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet('Тижневий звіт', {
        pageSetup: { paperSize: 9, orientation: 'portrait' },
    });

    // Встановлення ширини колонок
    sheet.columns = [
        { width: 5 },   // A - №
        { width: 35 },  // B - Назва
        { width: 20 },  // C - Проєкт/Причина
        { width: 12 },  // D - Години/ETA
        { width: 20 },  // E - Блокер
        { width: 15 },  // F - Додатково
    ];

    let currentRow = 1;

    // Заголовок
    sheet.mergeCells(`A${currentRow}:F${currentRow}`);
    const titleCell = sheet.getCell(`A${currentRow}`);
    titleCell.value = 'ТИЖНЕВИЙ ЗВІТ СПІВРОБІТНИКА';
    titleCell.font = { bold: true, size: 16 };
    titleCell.alignment = { horizontal: 'center' };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } };
    titleCell.font = { bold: true, size: 16, color: { argb: 'FFFFFFFF' } };
    currentRow += 2;

    // Інформація про співробітника
    const infoData = [
        ['ПІБ:', ''],
        ['Посада:', ''],
        ['Команда:', ''],
        ['Тиждень №:', ''],
        ['Рік:', new Date().getFullYear().toString()],
        ['Дата заповнення:', ''],
    ];

    infoData.forEach(([label, value]) => {
        const labelCell = sheet.getCell(`A${currentRow}`);
        labelCell.value = label;
        labelCell.font = { bold: true };
        labelCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE7E6E6' } };
        
        sheet.mergeCells(`B${currentRow}:C${currentRow}`);
        const valueCell = sheet.getCell(`B${currentRow}`);
        valueCell.value = value;
        valueCell.border = {
            bottom: { style: 'thin', color: { argb: 'FF000000' } },
        };
        currentRow++;
    });

    currentRow += 1;

    // Навантаження
    sheet.mergeCells(`A${currentRow}:F${currentRow}`);
    const workloadTitle = sheet.getCell(`A${currentRow}`);
    workloadTitle.value = 'ОЦІНКА НАВАНТАЖЕННЯ (1-5)';
    workloadTitle.font = { bold: true, size: 12 };
    workloadTitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFC000' } };
    currentRow++;

    sheet.getCell(`A${currentRow}`).value = '1-Низьке';
    sheet.getCell(`B${currentRow}`).value = '2-Нижче середнього';
    sheet.getCell(`C${currentRow}`).value = '3-Середнє';
    sheet.getCell(`D${currentRow}`).value = '4-Високе';
    sheet.getCell(`E${currentRow}`).value = '5-Критичне';
    currentRow++;

    sheet.getCell(`A${currentRow}`).value = 'Ваша оцінка:';
    sheet.getCell(`A${currentRow}`).font = { bold: true };
    const workloadCell = sheet.getCell(`B${currentRow}`);
    workloadCell.border = {
        top: { style: 'thin' },
        bottom: { style: 'thin' },
        left: { style: 'thin' },
        right: { style: 'thin' },
    };
    workloadCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF99' } };
    // Валідація 1-5
    workloadCell.dataValidation = {
        type: 'whole',
        operator: 'between',
        formulae: [1, 5],
        showErrorMessage: true,
        errorTitle: 'Помилка',
        error: 'Введіть число від 1 до 5',
    };
    currentRow += 2;

    // Виконані задачі
    sheet.mergeCells(`A${currentRow}:F${currentRow}`);
    const completedTitle = sheet.getCell(`A${currentRow}`);
    completedTitle.value = '✅ ВИКОНАНІ ЗАДАЧІ';
    completedTitle.font = { bold: true, size: 12 };
    completedTitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF92D050' } };
    currentRow++;

    // Заголовки таблиці виконаних
    const completedHeaders = ['№', 'Назва задачі', 'Проєкт', 'Години'];
    completedHeaders.forEach((header, i) => {
        const cell = sheet.getCell(currentRow, i + 1);
        cell.value = header;
        cell.font = { bold: true };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9E1F2' } };
        cell.border = {
            top: { style: 'thin' },
            bottom: { style: 'thin' },
            left: { style: 'thin' },
            right: { style: 'thin' },
        };
    });
    currentRow++;

    // Рядки для виконаних задач
    for (let i = 1; i <= 10; i++) {
        sheet.getCell(`A${currentRow}`).value = i;
        ['A', 'B', 'C', 'D'].forEach(col => {
            const cell = sheet.getCell(`${col}${currentRow}`);
            cell.border = {
                top: { style: 'thin' },
                bottom: { style: 'thin' },
                left: { style: 'thin' },
                right: { style: 'thin' },
            };
        });
        currentRow++;
    }

    currentRow += 1;

    // Невиконані задачі
    sheet.mergeCells(`A${currentRow}:F${currentRow}`);
    const incompleteTitle = sheet.getCell(`A${currentRow}`);
    incompleteTitle.value = '❌ НЕВИКОНАНІ ЗАДАЧІ';
    incompleteTitle.font = { bold: true, size: 12 };
    incompleteTitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFF6B6B' } };
    currentRow++;

    // Заголовки таблиці невиконаних
    const incompleteHeaders = ['№', 'Назва задачі', 'Причина', 'ETA', 'Блокер'];
    incompleteHeaders.forEach((header, i) => {
        const cell = sheet.getCell(currentRow, i + 1);
        cell.value = header;
        cell.font = { bold: true };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFCE4D6' } };
        cell.border = {
            top: { style: 'thin' },
            bottom: { style: 'thin' },
            left: { style: 'thin' },
            right: { style: 'thin' },
        };
    });
    currentRow++;

    // Рядки для невиконаних задач
    for (let i = 1; i <= 5; i++) {
        sheet.getCell(`A${currentRow}`).value = i;
        ['A', 'B', 'C', 'D', 'E'].forEach(col => {
            const cell = sheet.getCell(`${col}${currentRow}`);
            cell.border = {
                top: { style: 'thin' },
                bottom: { style: 'thin' },
                left: { style: 'thin' },
                right: { style: 'thin' },
            };
        });
        currentRow++;
    }

    currentRow += 1;

    // Додаткова інформація
    sheet.mergeCells(`A${currentRow}:F${currentRow}`);
    const additionalTitle = sheet.getCell(`A${currentRow}`);
    additionalTitle.value = 'ДОДАТКОВА ІНФОРМАЦІЯ';
    additionalTitle.font = { bold: true, size: 12 };
    additionalTitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFB4C6E7' } };
    currentRow++;

    const additionalFields = [
        'Що вас турбує? (проблеми, блокери):',
        'Пропозиції щодо покращення:',
        'Пріоритети на наступний тиждень:',
    ];

    additionalFields.forEach(field => {
        sheet.getCell(`A${currentRow}`).value = field;
        sheet.getCell(`A${currentRow}`).font = { bold: true };
        currentRow++;
        
        sheet.mergeCells(`A${currentRow}:F${currentRow}`);
        const inputCell = sheet.getCell(`A${currentRow}`);
        inputCell.border = {
            top: { style: 'thin' },
            bottom: { style: 'thin' },
            left: { style: 'thin' },
            right: { style: 'thin' },
        };
        inputCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF2CC' } };
        sheet.getRow(currentRow).height = 40;
        currentRow += 1;
    });

    const outputPath = path.join(TEMPLATES_DIR, 'weekly_report_template.xlsx');
    await workbook.xlsx.writeFile(outputPath);
    
    console.log(`✅ Excel шаблон створено: ${outputPath}`);
    return outputPath;
}

/**
 * Генерація всіх шаблонів
 */
export async function generateAllTemplates(): Promise<{ word: string; excel: string }> {
    const word = await generateWordTemplate();
    const excel = await generateExcelTemplate();
    return { word, excel };
}

// Якщо запущено напряму
if (require.main === module) {
    generateAllTemplates()
        .then(paths => {
            console.log('\n📄 Шаблони створено:');
            console.log(`   Word:  ${paths.word}`);
            console.log(`   Excel: ${paths.excel}`);
        })
        .catch(err => {
            console.error('❌ Помилка:', err);
            process.exit(1);
        });
}

export default {
    generateWordTemplate,
    generateExcelTemplate,
    generateAllTemplates,
};
