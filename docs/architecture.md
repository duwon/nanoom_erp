# Architecture

이 문서는 현재 코드베이스의 실제 구조를 기준으로 Nanoom ERP의 프론트엔드, 백엔드, 라우팅, 데이터 흐름을 정리한다.

상위 목표와 화면 기준은 [nanoom_erp.md](nanoom_erp.md)와 [layout.md](layout.md)를 따른다.

## 1. 현재 구조

### 1.1 Frontend

- Next.js App Router 기반
- authenticated shell을 기준으로 workspace/admin을 분리
- public home, login, attention state, display를 역할에 따라 분리

핵심 라우트:

- `/` - public home
- `/login` - OAuth 시작
- `/onboarding` - 프로필 입력
- `/pending` - 승인 대기
- `/blocked` - 차단 상태
- `/dashboard` - 일반 사용자 기본 진입점
- `/udms/*` - 문서 작업 영역
- `/worship/*` - 예배 준비 영역
- `/admin/*` - master 전용 관리 영역
- `/display` - 발표 전용 화면

### 1.2 Backend

- FastAPI 기반
- `/api/routes.py`는 display 및 공용 API를 담당
- `/api/v1/router.py`는 인증/사용자/UDMS/Admin 라우트를 묶는다
- WebSocket은 `/ws/display`를 사용한다

### 1.3 Storage

- MongoDB 기반 저장소
- 사용자, 문서, 게시판, 권한, 승인, 예배 템플릿, 출력 상태를 분리해 다룬다

## 2. 프론트엔드 라우팅 계층

### 2.1 Route Groups

- `(public)` - `/` 같은 비인증 시작 화면
- `(auth)` - 로그인 화면
- `(workspace)` - 인증 사용자 업무 화면
- `(admin)` - master 전용 관리 화면

### 2.2 현재 App Router 구조

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
```

## 3. 인증과 라우팅 정책

### 3.1 인증 기준

- `active` 일반 사용자: `/dashboard`
- `active` `master`: `/admin`
- `pending`: `/pending`
- `blocked`: `/blocked`
- 프로필 미완성: `/onboarding`

### 3.2 redirect 흐름

- 서버 측 인증 판단은 `frontend/lib/server-auth.ts`가 담당한다.
- OAuth callback에서 `backend/app/modules/auth/router.py`가 최종 착지 경로를 결정한다.
- onboarding 완료 시 `frontend/components/onboarding-form.tsx`가 `/dashboard` 또는 `/admin`으로 이동시킨다.

### 3.3 공통 shell 범위

다음은 authenticated shell을 사용한다.

- `/dashboard`
- `/udms/*`
- `/worship/*`
- `/admin/*`

다음은 shell을 사용하지 않는다.

- `/`
- `/login`
- `/onboarding`
- `/pending`
- `/blocked`
- `/display`

## 4. 공통 컴포넌트 계층

### 4.1 Authenticated Shell

`frontend/components/authenticated-shell.tsx`는 다음 역할을 한다.

- 데스크톱 sidebar 렌더링
- 모바일 drawer 렌더링
- 현재 경로 active 상태 표시
- 역할별 메뉴 필터링
- sign-out 노출

### 4.2 Module Page

`frontend/components/module-page.tsx`는 각 모듈의 카드형 소개 페이지를 담당한다.

- `UDMS`
- `Worship`
- `Admin`

shell 안에서 중첩 `<main>`이 생기지 않도록 wrapper를 `section`으로 정리했다.

### 4.3 Session / Auth helpers

`frontend/lib/server-auth.ts`는 서버에서 사용자 상태를 확인하고 다음 경로를 결정한다.

주요 함수:

- `getCurrentUserServer`
- `getAttentionRedirect`
- `getDefaultAuthenticatedPath`
- `requireWorkspaceUser`
- `requireMasterUser`
- `requireOnboardingUser`
- `requirePendingUser`
- `requireBlockedUser`

## 5. Backend 구조

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
    worship/
      __init__.py
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

## 6. 데이터 흐름

### 6.1 Auth

- OAuth provider start URL 생성
- callback에서 access token 쿠키 발급
- `auth/me`로 현재 사용자 조회

### 6.2 Workspace

- `dashboard`는 user 상태와 module shortcut의 시작점
- `udms`는 문서/공유/결재/권한 작업으로 이어진다
- `worship`는 순서와 자막 준비로 이어진다

### 6.3 Display

- `/worship/subtitles/output` 또는 운영 API가 display 상태를 갱신한다
- `/display`는 WebSocket으로 상태를 받아 화면만 렌더링한다

## 7. Display 분리 이유

`/display`는 다음 이유로 authenticated shell 밖에 둔다.

- 발표 장치의 전체 화면을 차지하는 특성상, sidebar와 header가 시각적 방해가 된다.
- shell은 사용자가 탐색하는 업무 공간용 프레임이고, `/display`는 사용자 탐색이 아닌 출력 전용 화면이다.
- WebSocket 기반 상태 갱신은 고정된 경로와 최소 chrome에서 가장 안정적이다.
- 따라서 `/display`는 인증 흐름의 일부가 아니라, 운영 출력 계층으로 분리하는 것이 맞다.

## 8. 현재 구현 상태

다음이 이미 반영되어 있다.

- `frontend/app/(workspace)/dashboard/page.tsx`
- `frontend/app/(workspace)/layout.tsx`
- `frontend/components/authenticated-shell.tsx`
- `frontend/app/(public)/page.tsx`
- `frontend/app/display/page.tsx`
- `backend/app/modules/auth/router.py`

## 9. 관련 문서

- [nanoom_erp.md](nanoom_erp.md)
- [layout.md](layout.md)
- [operations.md](operations.md)
