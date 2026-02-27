const pdfParse = require('pdf-parse');
const fs = require('fs');
const path = require('path');

// Знайдемо останній завантажений PDF
const uploadsDir = path.join(__dirname, 'uploads');

if (!fs.existsSync(uploadsDir)) {
    console.log('Папка uploads не існує');
    process.exit(1);
}

const files = fs.readdirSync(uploadsDir)
    .filter(f => f.endsWith('.pdf'))
    .map(f => ({
        name: f,
        time: fs.statSync(path.join(uploadsDir, f)).mtime
    }))
    .sort((a, b) => b.time - a.time);

if (files.length === 0) {
    console.log('Немає PDF файлів в папці uploads');
    process.exit(1);
}

const latestPdf = path.join(uploadsDir, files[0].name);
console.log('Аналізуємо файл:', latestPdf);
console.log('---');

const buffer = fs.readFileSync(latestPdf);

pdfParse(buffer).then(data => {
    console.log('=== RAW TEXT (перші 2000 символів) ===');
    console.log(data.text.substring(0, 2000));
    console.log('\n=== РЯДКИ ===');
    const lines = data.text.split('\n').map((l, i) => `${i}: "${l}"`);
    lines.slice(0, 50).forEach(l => console.log(l));
    
    console.log('\n=== ПОШУК ПІБ ===');
    // Тест різних регулярок
    const text = data.text;
    
    // Варіант 1
    const m1 = text.match(/ПІБ\s*[:：]\s*([А-Яа-яІіЇїЄєҐґA-Za-z'''`\-\s]+?)(?=\s*(?:Посада|Команда|Тиждень|Рік|$|\n))/i);
    console.log('Regex 1 (ПІБ:...):', m1 ? m1[1] : 'НЕ ЗНАЙДЕНО');
    
    // Варіант 2 - просто ПІБ і все що після
    const m2 = text.match(/ПІБ\s*[:：]?\s*(.+)/i);
    console.log('Regex 2 (ПІБ без обмежень):', m2 ? m2[1].substring(0, 50) : 'НЕ ЗНАЙДЕНО');
    
    // Варіант 3 - шукаємо "Плем" в тексті
    const idx = text.indexOf('Плем');
    if (idx >= 0) {
        console.log('Знайдено "Плем" на позиції', idx);
        console.log('Контекст:', JSON.stringify(text.substring(Math.max(0, idx-30), idx+60)));
    } else {
        console.log('"Плем" НЕ ЗНАЙДЕНО в тексті');
    }
    
    // Пошук Посада
    console.log('\n=== ПОШУК ПОСАДИ ===');
    const posMatch = text.match(/Посада\s*[:：]\s*(.+)/i);
    console.log('Посада:', posMatch ? posMatch[1].substring(0, 30) : 'НЕ ЗНАЙДЕНО');
    
    // Пошук Команда
    console.log('\n=== ПОШУК КОМАНДИ ===');
    const teamMatch = text.match(/Команда\s*[:：]\s*(.+)/i);
    console.log('Команда:', teamMatch ? teamMatch[1].substring(0, 30) : 'НЕ ЗНАЙДЕНО');
    
}).catch(err => {
    console.error('Помилка парсингу:', err);
});
