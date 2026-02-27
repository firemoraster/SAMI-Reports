# Deployment Guide / Посібник з розгортання

## Огляд

Ця документація описує різні способи розгортання системи SAMI Weekly Reports.

## Системні вимоги

- **Node.js:** 18.x або вище
- **npm:** 9.x або вище
- **RAM:** мінімум 512MB
- **Disk:** 100MB + місце для бази даних та логів

## Локальний запуск

### 1. Клонування репозиторію

```bash
git clone https://github.com/your-org/sami-reports.git
cd sami-reports
```

### 2. Встановлення залежностей

```bash
npm install
```

### 3. Конфігурація

```bash
# Скопіюйте приклад конфігурації
cp .env.example .env

# Відредагуйте .env файл
nano .env
```

Мінімальна конфігурація:
```env
# Telegram Bot
BOT_TOKEN=123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11

# Trello
TRELLO_API_KEY=your_api_key
TRELLO_TOKEN=your_token

# Admin
ADMIN_IDS=123456789
```

### 4. Запуск

```bash
# Розробка (з hot reload)
npm run dev

# Production
npm run build
npm start
```

## Docker Deployment

### Dockerfile

```dockerfile
FROM node:18-alpine

WORKDIR /app

# Копіюємо package files
COPY package*.json ./

# Встановлюємо залежності
RUN npm ci --only=production

# Копіюємо вихідний код
COPY . .

# Збираємо TypeScript
RUN npm run build

# Відкриваємо порт API
EXPOSE 3000

# Запуск
CMD ["node", "dist/index.js"]
```

### docker-compose.yml

```yaml
version: '3.8'

services:
  sami-reports:
    build: .
    container_name: sami-reports
    restart: unless-stopped
    ports:
      - "3000:3000"
    volumes:
      - ./data:/app/data
      - ./logs:/app/logs
    env_file:
      - .env
    environment:
      - NODE_ENV=production
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3
```

### Запуск з Docker

```bash
# Збірка та запуск
docker-compose up -d

# Перегляд логів
docker-compose logs -f

# Зупинка
docker-compose down
```

## Cloud Deployment

### Railway

1. Підключіть GitHub репозиторій до Railway
2. Додайте змінні середовища
3. Railway автоматично визначить Node.js проєкт

### Render

1. Створіть новий Web Service
2. Підключіть GitHub репозиторій
3. Build Command: `npm install && npm run build`
4. Start Command: `npm start`

### Heroku

```bash
# Створіть додаток
heroku create sami-reports

# Додайте змінні середовища
heroku config:set BOT_TOKEN=your_token
heroku config:set TRELLO_API_KEY=your_key
heroku config:set TRELLO_TOKEN=your_token

# Деплой
git push heroku main
```

### DigitalOcean App Platform

1. Створіть App з GitHub репозиторію
2. Виберіть тип: Web Service
3. Встановіть Environment Variables
4. Deploy

## VPS Deployment (Ubuntu)

### 1. Підготовка сервера

```bash
# Оновлення
sudo apt update && sudo apt upgrade -y

# Встановлення Node.js 18.x
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Перевірка
node --version  # v18.x.x
npm --version   # 9.x.x
```

### 2. Встановлення PM2

```bash
sudo npm install -g pm2
```

### 3. Клонування та налаштування

```bash
cd /var/www
sudo git clone https://github.com/your-org/sami-reports.git
cd sami-reports

# Встановлення залежностей
npm ci --only=production

# Конфігурація
sudo nano .env

# Збірка
npm run build
```

### 4. Запуск з PM2

```bash
# Запуск
pm2 start dist/index.js --name sami-reports

# Автозапуск при перезавантаженні
pm2 startup
pm2 save

# Перегляд статусу
pm2 status
pm2 logs sami-reports
```

### 5. Nginx Reverse Proxy

```bash
sudo apt install nginx -y
```

```nginx
# /etc/nginx/sites-available/sami-reports
server {
    listen 80;
    server_name reports.your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_cache_bypass $http_upgrade;
    }
}
```

```bash
# Активація
sudo ln -s /etc/nginx/sites-available/sami-reports /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 6. SSL з Let's Encrypt

```bash
sudo apt install certbot python3-certbot-nginx -y
sudo certbot --nginx -d reports.your-domain.com
```

## Webhook Mode (Production)

Для production рекомендується webhook замість polling:

### 1. Налаштування

```env
WEBHOOK_URL=https://reports.your-domain.com
```

### 2. Налаштування webhook в Telegram

```bash
curl -X POST "https://api.telegram.org/bot<BOT_TOKEN>/setWebhook" \
  -d "url=https://reports.your-domain.com/webhook"
```

## База даних

### SQLite (за замовчуванням)

- Файл: `./data/database.sqlite`
- Backup: регулярно копіюйте файл

### PostgreSQL (рекомендовано для production)

```env
DATABASE_URL=postgresql://user:pass@host:5432/sami_reports
```

Зміни в коді для PostgreSQL:
```typescript
// src/database/models.ts
const sequelize = new Sequelize(config.database.url, {
  dialect: 'postgres',
  // ...
});
```

## Моніторинг

### Health Check

```bash
curl http://localhost:3000/api/health
```

### PM2 Monitoring

```bash
pm2 monit
pm2 plus  # Веб-панель
```

### Логування

```bash
# Перегляд логів
tail -f logs/app.log
tail -f logs/error.log
```

## Оновлення

### Автоматичне (CI/CD)

GitHub Actions workflow:
```yaml
# .github/workflows/deploy.yml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Deploy to server
        uses: appleboy/ssh-action@v0.1.10
        with:
          host: ${{ secrets.HOST }}
          username: ${{ secrets.USERNAME }}
          key: ${{ secrets.SSH_KEY }}
          script: |
            cd /var/www/sami-reports
            git pull origin main
            npm ci --only=production
            npm run build
            pm2 restart sami-reports
```

### Ручне оновлення

```bash
cd /var/www/sami-reports
git pull origin main
npm ci --only=production
npm run build
pm2 restart sami-reports
```

## Backup

### Скрипт бекапу

```bash
#!/bin/bash
# /var/www/sami-reports/backup.sh

DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR=/var/backups/sami-reports

mkdir -p $BACKUP_DIR
cp /var/www/sami-reports/data/database.sqlite $BACKUP_DIR/database_$DATE.sqlite
cp /var/www/sami-reports/.env $BACKUP_DIR/env_$DATE

# Видалення старих бекапів (старіше 30 днів)
find $BACKUP_DIR -mtime +30 -delete

echo "Backup completed: $DATE"
```

### Cron для автоматичного бекапу

```bash
# crontab -e
0 2 * * * /var/www/sami-reports/backup.sh >> /var/log/sami-backup.log 2>&1
```

## Troubleshooting

### Бот не відповідає
1. Перевірте токен в `.env`
2. Перевірте логи: `pm2 logs sami-reports`
3. Перевірте webhook: `curl https://api.telegram.org/bot<TOKEN>/getWebhookInfo`

### API недоступний
1. Перевірте порт: `netstat -tlnp | grep 3000`
2. Перевірте nginx конфігурацію
3. Перевірте firewall: `sudo ufw status`

### Помилки бази даних
1. Перевірте права доступу до файлу БД
2. Перевірте місце на диску: `df -h`
3. Спробуйте видалити та перестворити БД

## Контакти

При виникненні проблем:
- GitHub Issues: https://github.com/your-org/sami-reports/issues
- Email: support@your-domain.com
