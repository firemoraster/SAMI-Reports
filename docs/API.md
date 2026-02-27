# API Documentation / Документація API

## Огляд

SAMI Weekly Reports API надає REST endpoints для управління звітами, користувачами та статистикою.

**Base URL:** `http://localhost:3000/api`

## Автентифікація

API використовує API Key автентифікацію. Додайте заголовок до всіх запитів:

```
X-API-Key: your-api-key-here
```

Або як query parameter: `?apiKey=your-api-key-here`

---

## Endpoints

### Health Check

#### GET /api/health
Перевірка статусу API.

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "version": "1.0.0"
}
```

---

### Users / Користувачі

#### GET /api/users
Отримати список користувачів.

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| team | string | Фільтр по команді (Dev, QA, Design, PM, Other) |
| position | string | Фільтр по посаді |
| active | boolean | Тільки активні/неактивні |

**Response:**
```json
{
  "data": [
    {
      "userId": 1,
      "telegramId": 123456789,
      "name": "Іван Петренко",
      "position": "Developer",
      "team": "Dev",
      "isManager": false,
      "isActive": true
    }
  ],
  "count": 1
}
```

#### GET /api/users/:id
Отримати користувача по ID.

#### PUT /api/users/:id
Оновити дані користувача.

**Request Body:**
```json
{
  "name": "Нове Ім'я",
  "position": "Senior Developer",
  "team": "Dev",
  "isManager": true
}
```

#### DELETE /api/users/:id
Деактивувати користувача (soft delete).

---

### Reports / Звіти

#### GET /api/reports
Отримати список звітів.

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| userId | number | Фільтр по користувачу |
| team | string | Фільтр по команді |
| weekNumber | number | Номер тижня |
| year | number | Рік |
| status | string | Статус звіту |
| limit | number | Ліміт (default: 50) |
| offset | number | Зміщення |

**Response:**
```json
{
  "data": [
    {
      "reportId": 1,
      "userId": 1,
      "weekNumber": 3,
      "year": 2024,
      "workload": 4,
      "tasksCompleted": 5,
      "tasksNotCompleted": 1,
      "completionRate": 83.3,
      "hasBlockers": false,
      "concerns": "Багато зустрічей",
      "trelloUrl": "https://trello.com/c/xxx"
    }
  ],
  "count": 1
}
```

#### GET /api/reports/:id
Отримати звіт по ID.

#### POST /api/reports
Створити новий звіт.

**Request Body:**
```json
{
  "userId": 1,
  "weekNumber": 3,
  "year": 2024,
  "workload": 4,
  "completedTasks": [
    {
      "title": "Реалізувати API",
      "project": "SAMI-Reports",
      "hours": 16
    }
  ],
  "notCompletedTasks": [
    {
      "title": "Написати тести",
      "reason": "Не вистачило часу",
      "eta": "2024-01-22"
    }
  ],
  "concerns": "Багато зустрічей",
  "improvements": "Автоматизувати деплоймент",
  "priorities": "Завершити тести"
}
```

#### PUT /api/reports/:id
Оновити звіт.

#### DELETE /api/reports/:id
Видалити звіт.

---

### PDF Export

#### GET /api/reports/:id/pdf
Завантажити звіт у форматі PDF.

**Response:** PDF file download

---

### Statistics / Статистика

#### GET /api/stats/user/:userId
Статистика користувача.

**Response:**
```json
{
  "data": {
    "userId": 1,
    "totalReports": 10,
    "averageWorkload": 3.5,
    "averageTasksCompleted": 6.2,
    "averageCompletionRate": 87.5,
    "lastWeekNumber": 3
  }
}
```

#### GET /api/stats/team/:team
Статистика команди за тиждень.

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| week | number | Номер тижня (default: поточний) |
| year | number | Рік (default: поточний) |

**Response:**
```json
{
  "data": {
    "team": "Dev",
    "weekNumber": 3,
    "totalMembers": 5,
    "reportsSubmitted": 4,
    "averageWorkload": 3.8,
    "averageCompletionRate": 85.2,
    "usersWithoutReport": ["Олена Коваль"]
  }
}
```

#### GET /api/stats/period
Статистика за період.

**Query Parameters:**
| Parameter | Type | Required |
|-----------|------|----------|
| startWeek | number | Yes |
| endWeek | number | Yes |
| year | number | No |

#### GET /api/stats/overall
Загальна статистика системи.

---

### Missing Reports

#### GET /api/missing
Список користувачів без звіту.

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| week | number | Номер тижня |
| year | number | Рік |
| team | string | Фільтр по команді |

**Response:**
```json
{
  "data": [
    {
      "userId": 2,
      "name": "Олена Коваль",
      "team": "Dev"
    }
  ],
  "count": 1,
  "weekNumber": 3,
  "year": 2024
}
```

---

### Settings / Налаштування

#### GET /api/settings
Отримати всі налаштування.

#### PUT /api/settings/:key
Оновити налаштування.

**Request Body:**
```json
{
  "value": "new-value",
  "description": "Опис налаштування"
}
```

---

## Error Responses

Всі помилки повертаються у форматі:

```json
{
  "error": "Error message",
  "details": ["Detail 1", "Detail 2"]
}
```

**HTTP Status Codes:**
| Code | Description |
|------|-------------|
| 200 | OK |
| 201 | Created |
| 400 | Bad Request (validation error) |
| 401 | Unauthorized (invalid API key) |
| 404 | Not Found |
| 500 | Internal Server Error |
| 503 | Service Unavailable (API disabled) |

---

## Rate Limiting

API не має вбудованого rate limiting. Рекомендується налаштувати на рівні reverse proxy (nginx, cloudflare).

---

## Examples

### cURL

```bash
# Отримати всі звіти
curl -X GET "http://localhost:3000/api/reports" \
  -H "X-API-Key: your-api-key"

# Створити звіт
curl -X POST "http://localhost:3000/api/reports" \
  -H "X-API-Key: your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": 1,
    "weekNumber": 3,
    "year": 2024,
    "workload": 4,
    "completedTasks": [{"title": "Task 1", "project": "Project", "hours": 8}],
    "notCompletedTasks": []
  }'

# Експорт PDF
curl -X GET "http://localhost:3000/api/reports/1/pdf" \
  -H "X-API-Key: your-api-key" \
  -o report.pdf
```

### JavaScript/Node.js

```javascript
const axios = require('axios');

const api = axios.create({
  baseURL: 'http://localhost:3000/api',
  headers: { 'X-API-Key': 'your-api-key' }
});

// Отримати статистику команди
const response = await api.get('/stats/team/Dev?week=3');
console.log(response.data);
```

### Python

```python
import requests

headers = {'X-API-Key': 'your-api-key'}
base_url = 'http://localhost:3000/api'

# Отримати всіх користувачів команди Dev
response = requests.get(f'{base_url}/users?team=Dev', headers=headers)
print(response.json())
```
