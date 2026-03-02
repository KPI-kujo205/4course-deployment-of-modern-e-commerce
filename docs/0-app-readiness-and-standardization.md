# App Readiness & Standardization

## 1. Configuration (Environment Variables)

You can find an .env example file in the [.env.example](../.env.example).
Env file is validated at runtime using `zod`.

| Variable      | Description                      | Example                               |
|---------------|----------------------------------|---------------------------------------|
| `DB_USER`     | PostgreSQL username              | `user`                                |
| `DB_PASSWORD` | PostgreSQL password              | `password`                            |
| `DB_NAME`     | Database name                    | `mydatabase`                          |
| `DB_PORT`     | PostgreSQL port                  | `5432`                                |
| `DB_HOST`     | PostgreSQL host                  | `localhost`                           |
| `PORT`        | HTTP server port (default: 4000) | `4000`                                |
| `NODE_ENV`    | Runtime environment              | `development` / `production` / `test` |

---

## 2. Health Check

The `GET /health` endpoint performs a deep health check by verifying the database connection.

### ✅ 200 — Database connected

```bash
curl -i localhost:4000/health
```

```
HTTP/1.1 200 OK
content-type: application/json

{"status":"ok","db":"ok"}
```

<img width="1158" height="59" alt="image" src="https://github.com/user-attachments/assets/d5e3fc66-a491-4501-b733-7eb41c94c32a" />

### ❌ 503 — Database unavailable

```
HTTP/1.1 503 Service Unavailable
content-type: application/json

{"status":"error","db":"error"}
```

<img width="1254" height="62" alt="image" src="https://github.com/user-attachments/assets/ff69ecb7-9350-4634-9a4a-21d125dd5aa9" />

---

## 3. JSON Logs Example

Logging is implemented using `pino`. In production mode (`NODE_ENV=production`) logs are output as JSON to `stdout`:

<img width="1144" height="199" alt="image" src="https://github.com/user-attachments/assets/d2be72f1-8e70-4d05-a4a5-20dd988b9b85" />

---

## 4. Graceful Shutdown

The application intercepts `SIGTERM` and `SIGINT` signals, gracefully closes the HTTP server, and terminates all
database connections before exiting.

### How to test

```bash
# Find the process PID
lsof -i :4000

# Send SIGTERM
kill <pid>
```

Expected log output:

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
