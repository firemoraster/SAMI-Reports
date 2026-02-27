const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

// Створюємо директорію якщо не існує
const outputDir = path.join(__dirname, 'temp');
if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
}

const outputPath = path.join(outputDir, 'test_report.pdf');

// Шляхи до шрифтів Windows з підтримкою кирилиці
const FONT_REGULAR = 'C:/Windows/Fonts/arial.ttf';
const FONT_BOLD = 'C:/Windows/Fonts/arialbd.ttf';

// Перевіряємо наявність шрифтів
if (!fs.existsSync(FONT_REGULAR)) {
    console.error('❌ Шрифт Arial не знайдено:', FONT_REGULAR);
    process.exit(1);
}

const doc = new PDFDocument({
    size: 'A4',
    margin: 50,
});

const stream = fs.createWriteStream(outputPath);
doc.pipe(stream);

// ============ ЗАГОЛОВОК ============
doc.fontSize(24)
   .font(FONT_BOLD)
   .text('ТИЖНЕВИЙ ЗВІТ', { align: 'center' });

doc.moveDown(0.5);
doc.fontSize(14)
   .font(FONT_REGULAR)
   .text('Тиждень 09 / 2026', { align: 'center' });

doc.moveDown(1);
doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
doc.moveDown(1);

// ============ ІНФОРМАЦІЯ ПРО СПІВРОБІТНИКА ============
doc.fontSize(12).font(FONT_BOLD).text('ІНФОРМАЦІЯ ПРО СПІВРОБІТНИКА');
doc.moveDown(0.5);
doc.font(FONT_REGULAR);
doc.text('ПІБ: Петренко Олександр Васильович');
doc.text('Посада: Developer');
doc.text('Тиждень №: 9');
doc.text('Рік: 2026');

doc.moveDown(1);

// ============ ВИКОНАНІ ЗАДАЧІ ============
doc.font(FONT_BOLD).text('ВИКОНАНІ ЗАДАЧІ');
doc.moveDown(0.5);
doc.font(FONT_REGULAR);
doc.text('1. Розробка REST API для модуля авторизації | 12');
doc.text('2. Код-рев\'ю pull request\'ів команди | 4');
doc.text('3. Написання unit тестів для сервісу оплат | 6');
doc.text('4. Оновлення документації API | 3');
doc.text('5. Виправлення багів з JIRA-1234 | 5');

doc.moveDown(1);

// ============ НЕВИКОНАНІ ЗАДАЧІ ============
doc.font(FONT_BOLD).text('НЕВИКОНАНІ ЗАДАЧІ');
doc.moveDown(0.5);
doc.font(FONT_REGULAR);
doc.text('1. Інтеграція з платіжною системою | Очікування доступів від партнера | 28.02.2026');
doc.text('2. Рефакторинг legacy коду | Нестача часу | 05.03.2026');

doc.moveDown(1);

// ============ ОЦІНКА НАВАНТАЖЕННЯ ============
doc.font(FONT_BOLD).text('ОЦІНКА НАВАНТАЖЕННЯ');
doc.moveDown(0.5);
doc.font(FONT_REGULAR);
doc.text('Навантаження: 4 / 5');

doc.moveDown(1);

// ============ ДОДАТКОВА ІНФОРМАЦІЯ ============
doc.font(FONT_BOLD).text('ДОДАТКОВА ІНФОРМАЦІЯ');
doc.moveDown(0.5);
doc.font(FONT_REGULAR);
doc.text('Що турбує: Затримки з отриманням доступів до зовнішніх сервісів');
doc.text('Пропозиції: Автоматизувати процес код-рев\'ю за допомогою AI');

doc.moveDown(2);

// ============ FOOTER ============
doc.fontSize(10)
   .fillColor('gray')
   .text('Згенеровано для тестування PDF парсера', { align: 'center' });
doc.text(new Date().toLocaleString('uk-UA'), { align: 'center' });

// Завершуємо документ
doc.end();

stream.on('finish', () => {
    console.log('✅ PDF файл створено:', outputPath);
    console.log('\nТепер надішліть цей файл боту для тестування парсера.');
});
