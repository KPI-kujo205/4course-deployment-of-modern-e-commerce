# Підготовка застосунку — Readiness & Standardization

Backend API + Telegram-бот для нагадування про дні народження. Побудований на Node.js 20 з Hono, PostgreSQL (Kysely),
grammY та Pino.

---

## Швидкий старт

```bash
pnpm install
cp .env.example .env  # заповніть змінні оточення
pnpm run db:up        # запустити Postgres у Docker
pnpm run db:migrate   # застосувати міграції
pnpm run dev          # запустити dev-сервер
```

---

## Фаза 1: Обов'язкові вимоги

### 1. Збірка та тести однією командою

```bash
pnpm test             # юніт + інтеграційні тести (послідовно)
pnpm run test:unit    # тільки юніт-тести (без Docker)
pnpm run test:i       # тільки інтеграційні тести (потрібен Docker)

# запустити конкретний файл тестів
pnpm exec vitest run src/utils/assert.test.ts

# запустити конкретний тест за назвою
pnpm exec vitest run --reporter=verbose -t "your test name here"
```

**Юніт-тести** (`src/**/*.test.ts`) — не потребують бази даних:

| Файл                                    | Що тестується          |
|-----------------------------------------|------------------------|
| `src/utils/assert.test.ts`              | утиліта `assert()`     |
| `src/utils/birthday-helpers.test.ts`    | хелпери для дат        |
| `src/services/health.service.test.ts`   | логіка health check    |
| `src/services/birthday.service.test.ts` | сервіс днів народження |
| `src/services/reminder.service.test.ts` | сервіс нагадувань      |

**Інтеграційні тести** (`tests/integration/`) — потребують Docker:

| Файл                                         | Що тестується                            |
|----------------------------------------------|------------------------------------------|
| `tests/integration/user.service.test.ts`     | CRUD користувачів (реальна БД)           |
| `tests/integration/birthday.service.test.ts` | операції з днями народження (реальна БД) |
| `tests/integration/reminders.test.ts`        | логіка нагадувань (реальна БД)           |

Lifecycle інтеграційних тестів повністю автоматизований: `pretest:i` піднімає Docker Postgres, застосовує міграції та
сіди; `posttest:i` зупиняє контейнер. Перед кожним тестом таблиці очищаються та заповнюються заново.

### 2. Конфігурація через змінні оточення

Усі налаштування зчитуються зі змінних оточення. Змінні валідуються на старті за допомогою `zod`. Приклад: [
`.env.example`](./.env.example).

| Змінна         | Опис                                 | Приклад                               |
|----------------|--------------------------------------|---------------------------------------|
| `DB_USER`      | Ім'я користувача PostgreSQL          | `user`                                |
| `DB_PASSWORD`  | Пароль PostgreSQL                    | `password`                            |
| `DB_NAME`      | Назва бази даних                     | `mydatabase`                          |
| `DB_PORT`      | Порт PostgreSQL                      | `5432`                                |
| `DB_HOST`      | Хост PostgreSQL                      | `localhost`                           |
| `PORT`         | Порт HTTP-сервера (за замовч.: 4000) | `4000`                                |
| `NODE_ENV`     | Середовище виконання                 | `development` / `production` / `test` |
| `TG_BOT_TOKEN` | Токен Telegram-бота                  | `123456:ABC-DEF...`                   |
| `BASE_URL`     | Публічна URL-адреса застосунку       | `http://localhost:4000`               |

### 3. Автоматичне керування схемою БД

Міграції реалізовані через `kysely-ctl`. При запуску команди `pnpm run db:migrate` усі наявні міграції застосовуються
автоматично. Файли міграцій знаходяться в `src/db/migrations/`.

```bash
pnpm run db:migrate   # застосувати міграції
pnpm run db:seed      # заповнити тестовими даними
pnpm run db:codegen   # згенерувати типи з поточної схеми БД
```

---

## Фаза 2: Production-Grade фічі

### 1. Health Check

Ендпоінт `GET /health` виконує глибоку перевірку: перевіряє з'єднання з базою даних.

**200 OK — БД доступна:**

```bash
curl -i localhost:4000/health
```

```
HTTP/1.1 200 OK
content-type: application/json

{"status":"ok","db":"ok"}
```

<img width="1158" height="59" alt="image" src="https://github.com/user-attachments/assets/d5e3fc66-a491-4501-b733-7eb41c94c32a" />

**503 Service Unavailable — БД недоступна:**

```
HTTP/1.1 503 Service Unavailable
content-type: application/json

{"status":"error","db":"error"}
```

<img width="1254" height="62" alt="image" src="https://github.com/user-attachments/assets/ff69ecb7-9350-4634-9a4a-21d125dd5aa9" />

### 2. Структуроване JSON-логування

Логування реалізоване через `pino`. У режимі `NODE_ENV=production` логи виводяться як JSON-об'єкти у `stdout`.

Обов'язкові поля: `level`, `time` (timestamp), `msg` (message).

<img width="1144" height="199" alt="image" src="https://github.com/user-attachments/assets/d2be72f1-8e70-4d05-a4a5-20dd988b9b85" />

### 3. Graceful Shutdown

Застосунок перехоплює сигнали `SIGTERM` і `SIGINT`, завершує обробку активних HTTP-запитів, закриває з'єднання з БД та
виходить із кодом `0`.

**Як перевірити:**

```bash
# Знайти PID процесу
lsof -i :4000

# Надіслати SIGTERM
kill <pid>
```

**Очікуваний вивід логів:**

```json
{
  "level": "info",
  "time": "2026-03-02T11:05:00.000Z",
  "pid": 12345,
  "msg": "SIGTERM received. Starting graceful shutdown..."
}
{
  "level": "info",
  "time": "2026-03-02T11:05:00.050Z",
  "pid": 12345,
  "msg": "Graceful shutdown complete"
}
```

<img width="1186" height="286" alt="image" src="https://github.com/user-attachments/assets/6336aa52-f580-45f9-90ca-af4b17a6c849" />
