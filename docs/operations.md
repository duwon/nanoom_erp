# Operations

이 문서는 로컬 개발 환경에서 현재 코드를 실행하는 방법과, 운영 시 확인해야 할 기본 경로를 정리한다.

## 1. 로컬 실행

기본 실행 명령:

```bash
docker compose up --build -d
```

종료:

```bash
docker compose down
```

## 2. 현재 확인 경로

기본 포트 구성은 다음과 같다.

- Frontend Home: `http://localhost:3000/`
- Login: `http://localhost:3000/login`
- Admin: `http://localhost:3000/admin`
- Display: `http://localhost:3000/display`
- Backend Docs: `http://localhost:8000/docs`

Windows 환경에서 `3000` 포트가 막히는 경우 루트 `.env`의 `FRONTEND_PORT`를 바꿔서 실행한다.

예시:

```env
FRONTEND_PORT=3300
```

이 경우 접속 경로는 다음처럼 바뀐다.

- Frontend Home: `http://localhost:3300/`
- Login: `http://localhost:3300/login`
- Admin: `http://localhost:3300/admin`
- Display: `http://localhost:3300/display`

## 3. 환경 변수

`.env.example` 기준으로 주요 항목은 다음과 같다.

- `FRONTEND_PORT`: 프론트엔드 노출 포트
- `MONGO_URL`: MongoDB 연결 문자열
- `MONGO_DB`: 사용할 데이터베이스 이름
- `NEXT_PUBLIC_API_BASE_URL`: 프론트에서 호출할 백엔드 API 주소
- `NEXT_PUBLIC_WS_URL`: 프론트에서 사용할 WebSocket 주소

운영 환경에서는 프론트 포트와 백엔드 CORS 허용 목록이 일치해야 한다.

## 4. 개발 시점 체크 포인트

- 프론트가 열리는지 확인한다.
- 백엔드 `/api/health`가 `ok`를 반환하는지 확인한다.
- `/admin`에서 목록 조회와 저장이 가능한지 확인한다.
- `/display`가 초기 상태와 실시간 갱신을 받는지 확인한다.
- `/api/v1/admin/users`와 `/api/v1/udms/documents`가 정상 동작하는지 확인한다.

## 5. 향후 확장 라우트

현재는 이미 확장 모듈 구조로 정리되어 있지만, 기능이 추가될 때 다음 경로가 더 늘어날 수 있다.

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

백엔드도 마찬가지로 `/api/v1/*` 기준으로 분리되어 있다.

## 6. 검증 기준

- `docker compose ps`에서 `mongo`, `backend`, `frontend`가 모두 정상이어야 한다.
- `GET http://localhost:8000/api/health` 응답은 `{"status":"ok"}`여야 한다.
- `GET http://localhost:<FRONTEND_PORT>/`는 정상 응답이어야 한다.
- `GET http://localhost:<FRONTEND_PORT>/admin`는 정상 응답이어야 한다.
- `GET http://localhost:<FRONTEND_PORT>/display`는 정상 응답이어야 한다.
- `GET http://localhost:8000/api/v1/admin/users`와 `GET http://localhost:8000/api/v1/udms/boards`는 인증 후 정상 동작해야 한다.

## 7. API Base URL Notes

- `NEXT_PUBLIC_API_BASE_URL` is the public API base URL used by the browser.
- `API_INTERNAL_BASE_URL` is the internal API base URL used by Next.js on the server side. In Docker Compose this should point to `http://backend:8000`.
- `FRONTEND_PORT` only changes the public frontend port, such as `http://localhost:3300`. It is not the backend API address.
- `FRONTEND_APP_URL` is the public frontend URL that the backend uses when it redirects after OAuth login.
- `CORS_ORIGINS` must include the exact frontend origin that will call the backend with credentials.
- `AUTH_COOKIE_SECURE=true` is required for HTTPS deployments.
- `AUTH_COOKIE_SAMESITE=lax` fits same-site deployments such as `app.example.com` and `api.example.com`. Use `none` only when the frontend and backend are truly cross-site and you must allow credentialed cross-site requests.

Recommended deployment:

- Preferred: expose the frontend on `https://erp.example.com` and reverse proxy `/api` and `/ws` to the backend. Then set `NEXT_PUBLIC_API_BASE_URL=https://erp.example.com` and `API_INTERNAL_BASE_URL=http://backend:8000`.
- Separate public backend origin: set `NEXT_PUBLIC_API_BASE_URL` to that backend URL, keep `API_INTERNAL_BASE_URL` on the private service URL, set `FRONTEND_APP_URL` to the frontend URL, and align `CORS_ORIGINS`, `AUTH_COOKIE_SECURE`, and `AUTH_COOKIE_SAMESITE`.
