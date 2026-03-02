# App Readiness & Standardization

## 1. Configuration (Environment Variables)

You can find an .env example file in the [.env.example](../.env.example).
Env file is validated at runtime using `zod`.

| Variable                | Description                               | Example                            |
|-------------------------|-------------------------------------------|------------------------------------|
| `DB_USER`               | PostgreSQL username                       | `user`                             |
| `DB_PASSWORD`           | PostgreSQL password                       | `password`                         |
| `DB_NAME`               | Database name                             | `place2date`                       |
| `DB_PORT`               | PostgreSQL port                           | `5432`                             |
| `DB_HOST`               | PostgreSQL host                           | `localhost`                        |
| `BETTER_AUTH_SECRET`    | Secret key for signing sessions           | `supersecretkey`                   |
| `BETTER_AUTH_URL`       | Better Auth server base URL               | `http://localhost:4000`            |
| `GOOGLE_CLIENT_ID`      | Google OAuth Client ID                    | `xxxxx.apps.googleusercontent.com` |
| `GOOGLE_CLIENT_SECRET`  | Google OAuth Client Secret                | `GOCSPX-xxxxx`                     |
| `GOOGLE_PLACES_API_KEY` | Google Places API key                     | `AIzaSy...`                        |
| `PORT`                  | HTTP server port (default: 4000)          | `4000`                             |
| `NODE_ENV`              | Runtime environment                       | `development` / `production`       |

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
<img width="1118" height="72" alt="image" src="https://github.com/user-attachments/assets/b026efef-3bc3-4290-98fb-bfbe05a73ffa" />


### ❌ 503 — Database unavailable

```
HTTP/1.1 503 Service Unavailable
content-type: application/json

{"status":"error","db":"error"}
```

<img width="1243" height="57" alt="image" src="https://github.com/user-attachments/assets/d8751696-08e9-49a1-9ee3-29745c063925" />


---

## 3. JSON Logs Example

Logging is implemented using `pino`. In production mode (`NODE_ENV=production`) logs are output as JSON to `stdout`:

```json
{"level":"info","time":"2026-03-02T11:00:00.000Z","pid":12345,"msg":"Server is running on http://localhost:4000"}
{"level":"info","time":"2026-03-02T11:00:01.123Z","pid":12345,"method":"GET","path":"/health","status":200,"duration":3,"msg":"HTTP Request"}
{"level":"info","time":"2026-03-02T11:00:02.456Z","pid":12345,"method":"POST","path":"/auth/sign-in/email","status":200,"duration":45,"msg":"HTTP Request"}
{"level":"error","time":"2026-03-02T11:00:03.789Z","pid":12345,"err":{"message":"Connection refused"},"path":"/health","method":"GET","msg":"Connection refused"}
```

<img width="1235" height="330" alt="image" src="https://github.com/user-attachments/assets/250e27d8-df77-44bd-ac2f-e631f3dd2d93" />

---

## 4. Graceful Shutdown

The application intercepts `SIGTERM` and `SIGINT` signals, gracefully closes the HTTP server, and terminates all database connections before exiting.

### How to test

```bash
# Find the process PID
lsof -i :4000

# Send SIGTERM
kill <pid>
```

Expected log output:

```json
{"level":"info","time":"2026-03-02T11:05:00.000Z","pid":12345,"msg":"SIGTERM received. Starting graceful shutdown..."}
{"level":"info","time":"2026-03-02T11:05:00.050Z","pid":12345,"msg":"Graceful shutdown complete"}
```

<img width="872" height="168" alt="image" src="https://github.com/user-attachments/assets/ca8f78ca-64f3-496f-bf23-43f7ed57cd74" />
