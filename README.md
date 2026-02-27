# 📊 SAMI Weekly Reports System

Автоматизована система тижневої звітності співробітників з інтеграцією Telegram-бота, Trello та PDF-шаблонів.

## 🚀 Можливості

- **Telegram Bot** - збір звітів через чат-бот
- **PDF Processing** - парсинг та генерація PDF-форм
- **Trello Integration** - автоматичне створення карток
- **Statistics** - аналітика та звітність
- **REST API** - API для інтеграцій

## 📁 Структура проекту

```
SAMI-Reports/
├── bot/                    # Telegram bot
│   ├── __init__.py
│   ├── handlers.py         # Обробники команд
│   ├── keyboards.py        # Клавіатури
│   ├── states.py           # Стани FSM
│   └── messages.py         # Тексти повідомлень
├── api/                    # REST API
│   ├── __init__.py
│   ├── routes.py           # Ендпоінти
│   └── schemas.py          # Pydantic схеми
├── services/               # Бізнес-логіка
│   ├── __init__.py
│   ├── trello_service.py   # Робота з Trello
│   ├── pdf_service.py      # PDF парсинг/генерація
│   ├── stats_service.py    # Статистика
│   └── notification_service.py  # Сповіщення
├── database/               # База даних
│   ├── __init__.py
│   ├── models.py           # SQLAlchemy моделі
│   ├── crud.py             # CRUD операції
│   └── init_db.py          # Ініціалізація БД
├── templates/              # Шаблони
│   ├── pdf/                # PDF шаблони
│   └── html/               # HTML шаблони (для email)
├── utils/                  # Утиліти
│   ├── __init__.py
│   ├── validators.py       # Валідація даних
│   ├── helpers.py          # Допоміжні функції
│   └── i18n.py             # Багатомовність
├── config/                 # Конфігурація
│   ├── __init__.py
│   └── settings.py         # Налаштування
├── tests/                  # Тести
│   ├── test_bot.py
│   ├── test_api.py
│   └── test_services.py
├── docs/                   # Документація
│   ├── DEPLOYMENT.md       # Розгортання
│   ├── TRELLO_SETUP.md     # Налаштування Trello
│   └── API.md              # API документація
├── main.py                 # Точка входу
├── requirements.txt        # Залежності
├── .env.example            # Приклад змінних оточення
└── docker-compose.yml      # Docker конфігурація
```

## ⚙️ Швидкий старт

### 1. Клонування та встановлення

```bash
cd SAMI-Reports
python -m venv venv
venv\Scripts\activate  # Windows
pip install -r requirements.txt
```

### 2. Конфігурація

```bash
copy .env.example .env
# Відредагуйте .env файл з вашими ключами
```

### 3. Ініціалізація бази даних

```bash
python -c "from database.init_db import init_database; init_database()"
```

### 4. Запуск

```bash
python main.py
```

## 📱 Команди бота

| Команда | Опис |
|---------|------|
| `/start` | Вітання та інструкція |
| `/report` | Почати створення звіту |
| `/sendpdf` | Надіслати заповнений PDF |
| `/myreports` | Останні 5 звітів |
| `/team` | Звіти команди (для керівників) |
| `/stats` | Швидка статистика |
| `/help` | Довідка |

## 🔗 API Endpoints

| Method | Endpoint | Опис |
|--------|----------|------|
| POST | `/api/webhook/telegram` | Webhook Telegram |
| POST | `/api/report/create` | Створити звіт |
| GET | `/api/report/{id}` | Отримати звіт |
| GET | `/api/reports/user/{user_id}` | Звіти користувача |
| GET | `/api/reports/team/{team}` | Звіти команди |
| GET | `/api/stats/{period}` | Статистика за період |
| GET | `/api/export/pdf/{id}` | Експорт в PDF |

## 📊 Trello дошка

### Списки
- 📥 NEW REPORTS
- 👀 IN REVIEW
- ✅ APPROVED
- ⚠️ FOLLOW-UP NEEDED
- 📊 DONE & ARCHIVED

### Мітки
- 🟢 Load: Low (1-2)
- 🟡 Load: Medium (3)
- 🟠 Load: High (4)
- 🔴 Load: Critical (5)
- 🔵 Needs Review
- 🟣 Approved
- ⚪️ Has Blockers
- ⛔ Overdue ETA
- ⚠️ Has Concerns
- 📈 All Tasks Done
- 🏆 High Performance

## 📄 Ліцензія

MIT License

## 👥 Контакти

Для питань та підтримки: @your_telegram_handle
