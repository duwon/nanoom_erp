# Operations

This document captures the local runbook and quick verification points for the current Nanoom ERP stack.

## 1. Local Start

Start all services:

```bash
docker compose up --build -d
```

Stop all services:

```bash
docker compose down
```

## 2. Local URLs

- Frontend home: `http://localhost:3000/`
- Login: `http://localhost:3000/login`
- Admin: `http://localhost:3000/admin`
- Display: `http://localhost:3000/display`
- Backend docs: `http://localhost:8000/docs`

If port `3000` is already in use on Windows, change `FRONTEND_PORT` in `.env`.

Example:

```env
FRONTEND_PORT=3300
```

Then access the frontend at `http://localhost:3300`.

## 3. Important Environment Variables

- `FRONTEND_PORT`: public frontend port
- `MONGO_URL`: MongoDB connection string
- `MONGO_DB`: MongoDB database name
- `NEXT_PUBLIC_API_BASE_URL`: browser-facing API base URL
- `NEXT_PUBLIC_WS_URL`: browser-facing WebSocket URL
- `UDMS_STORAGE_DIR`: backend container path used for UDMS file storage

`backend/app/config.py` still accepts `UDMS_UPLOAD_ROOT` as a compatibility alias, but new deployments should use `UDMS_STORAGE_DIR`.

## 4. UDMS V2 Checks

Confirm these flows after startup:

- `GET /api/health` returns `{"status":"ok"}`
- `/api/v1/admin/users` responds correctly
- `/api/v1/udms/docs` responds correctly
- `/api/v1/udms/docs/shared` responds correctly
- `/api/v1/udms/policies` responds correctly
- `/api/v1/udms/approval-templates` responds correctly
- `/api/v1/udms/target-types` responds correctly
- document attachment upload and download work
- approval-completed hook and parent-deleted hook respond correctly when invoked

Current Dynamic Target Registry policy:

- `Board` is the only `isEnabled=true` target for create/update/policy writes
- `Approval`, `WorshipOrder`, `WorshipContent`, `SubtitleContent`, `Inventory`, `Broadcast`, `Project`, `User` stay registered but write-disabled
- unregistered target types return `409`

## 5. Frontend Routes

- `/login`
- `/udms/boards`
- `/udms/documents`
- `/udms/documents/{documentId}`
- `/udms/shares`
- `/udms/approvals`
- `/udms/permissions`
- `/worship/orders`
- `/worship/subtitles/input`
- `/worship/subtitles/output`
- `/worship/contents`
- `/admin/users`
- `/admin/boards`
- `/admin/worship-templates`
- `/admin/permissions`
- `/display`

## 6. Verification Commands

- `docker compose ps`
- `python -m pytest`
- `npm.cmd run typecheck`
- `npm.cmd run build`

Container and endpoint checks:

- `GET http://localhost:8000/api/health`
- `GET http://localhost:8000/api/v1/admin/users`
- `GET http://localhost:8000/api/v1/udms/boards`
- `GET http://localhost:8000/api/v1/udms/docs`
- `GET http://localhost:8000/api/v1/udms/approval-templates`
- `GET http://localhost:8000/api/v1/udms/target-types`

The default Compose mount for UDMS files is:

- `./storage/udms:/app/data/storage`

## 7. API Base URL Notes

- `NEXT_PUBLIC_API_BASE_URL` is the public API base URL used by the browser.
- `API_INTERNAL_BASE_URL` is the internal API base URL used by Next.js on the server side. In Docker Compose this should point to `http://backend:8000`.
- `FRONTEND_PORT` only changes the public frontend port. It does not change the backend API address.
- `FRONTEND_APP_URL` is the public frontend URL used by backend redirect flows.
- `CORS_ORIGINS` must include the exact frontend origin that calls the backend with credentials.
- `AUTH_COOKIE_SECURE=true` is required for HTTPS deployments.
- `AUTH_COOKIE_SAMESITE=lax` fits same-site deployments such as `app.example.com` and `api.example.com`. Use `none` only for true cross-site credentialed setups.

Recommended deployment:

- Preferred: expose the frontend on `https://erp.example.com` and reverse proxy `/api` and `/ws` to the backend.
- If the backend is on a separate public origin, align `NEXT_PUBLIC_API_BASE_URL`, `API_INTERNAL_BASE_URL`, `FRONTEND_APP_URL`, `CORS_ORIGINS`, and cookie settings.
