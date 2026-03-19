# Nanoom ERP / UDMS 개요

Nanoom ERP는 교회 업무와 예배 운영을 하나의 웹 시스템에서 처리하기 위한 데모 프로젝트다.  
현재 구현은 Next.js 프론트엔드, FastAPI 백엔드, MongoDB 저장소, WebSocket display 출력을 중심으로 구성된다.

상위 화면 구조와 라우팅 규칙은 [layout.md](layout.md)를 따른다.

## 1. 제품 목표

- 로그인과 권한 관리를 통합한다.
- UDMS를 중심으로 게시판, 문서, 공유, 결재, 권한을 다룬다.
- 예배 준비 흐름을 `orders`, `subtitles`, `contents`로 분리한다.
- 관리자 화면에서 사용자와 정책을 관리한다.
- `/display`는 예배 출력 전용 화면으로 유지한다.

## 2. 1차 구현 범위

### 2.1 Auth

- Google / Kakao OAuth 진입점
- httpOnly 쿠키 기반 세션
- onboarding / pending / blocked 상태 페이지

### 2.2 Workspace

- `/dashboard`
- `/udms/documents`
- `/udms/boards`
- `/udms/shares`
- `/udms/approvals`
- `/udms/permissions`
- `/worship/orders`
- `/worship/subtitles/input`
- `/worship/subtitles/output`
- `/worship/contents`

### 2.3 Admin

- `/admin`
- `/admin/users`
- `/admin/permissions`
- `/admin/boards`
- `/admin/worship-templates`

### 2.4 Display

- `/display`
- WebSocket 기반의 발표 전용 화면

## 3. 현재 사용자 흐름

1. 사용자는 `/` 또는 `/login`에서 시작한다.
2. OAuth callback에서 사용자 상태가 확인된다.
3. 프로필이 비어 있으면 `/onboarding`으로 이동한다.
4. 승인 대기 상태면 `/pending`으로 이동한다.
5. 차단 상태면 `/blocked`로 이동한다.
6. 활성 일반 사용자는 `/dashboard`로 이동한다.
7. master는 `/admin`으로 이동한다.

## 4. 현재 구현된 핵심 기능

- 공통 authenticated shell
- dashboard 기본 화면
- UDMS 모듈별 페이지
- 예배 순서 / 자막 입력 / 자막 출력
- 관리자 사용자 관리
- display 전용 화면

## 5. 디렉토리 기준

### 5.1 Frontend

```text
frontend/app/
  layout.tsx
  globals.css
  (public)/
    page.tsx
  (auth)/
    layout.tsx
    login/page.tsx
  (workspace)/
    layout.tsx
    dashboard/page.tsx
    udms/
      layout.tsx
      approvals/page.tsx
      boards/page.tsx
      documents/page.tsx
      permissions/page.tsx
      shares/page.tsx
    worship/
      layout.tsx
      contents/page.tsx
      orders/page.tsx
      subtitles/
        input/page.tsx
        output/page.tsx
  (admin)/
    layout.tsx
    admin/
      page.tsx
      boards/page.tsx
      permissions/page.tsx
      users/page.tsx
      worship-templates/page.tsx
  onboarding/page.tsx
  pending/page.tsx
  blocked/page.tsx
  display/page.tsx

frontend/components/
  authenticated-shell.tsx
  module-page.tsx
  onboarding-form.tsx
  sign-out-button.tsx

frontend/lib/
  api.ts
  api-base-url.ts
  server-auth.ts
  types.ts
```

### 5.2 Backend

```text
backend/app/
  main.py
  api/
    routes.py
    v1/
      router.py
  core/
    permissions.py
    security.py
    store.py
    audit.py
  db/
    repository.py
  dependencies.py
  modules/
    auth/
      router.py
      schemas.py
    users/
      router.py
      schemas.py
    lookups/
      router.py
    udms/
      router.py
      dependencies.py
      boards/
        router.py
        schemas.py
      documents/
        router.py
        schemas.py
      shares/
        router.py
        schemas.py
      approvals/
        router.py
        schemas.py
      permissions/
        router.py
        schemas.py
    admin/
      router.py
      dependencies.py
      boards/
        router.py
      users/
        router.py
      permissions/
        router.py
        schemas.py
      worship_templates/
        router.py
        schemas.py
  schemas/
    display.py
    order_item.py
  services/
    worship_service.py
  storage/
    files.py
  ws/
    connection_manager.py
    subtitles.py
```

## 6. 데이터 모델 방향

현재 코드베이스에서 중심이 되는 데이터는 다음과 같다.

- `User`
- `Board`
- `Document`
- `DocumentVersion`
- `Attachment`
- `Permission`
- `Share`
- `Approval`
- `AuditLog`
- `WorshipTemplate`
- `WorshipOrder`
- `SubtitleContent`
- `DisplayState`

## 7. 라우팅 기준

- public home은 로그인하지 않은 사용자를 위한 진입점이다.
- authenticated shell은 업무 화면만 담는다.
- `/display`는 화면 출력 전용이라 shell에서 분리한다.
- admin은 `master`에게만 노출한다.

## 8. 현재 기술적 판단

- 인증 상태 판정은 서버에서 수행한다.
- 시작 경로는 사용자 상태와 role에 따라 결정한다.
- dashboard는 실시간 지표가 아니라 작업 시작점으로 둔다.
- display는 고정 chrome 없이 화면 자체에 집중한다.

## 9. 관련 문서

- [architecture.md](architecture.md)
- [layout.md](layout.md)
- [operations.md](operations.md)
- [user.md](user.md)
