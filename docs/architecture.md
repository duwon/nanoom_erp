# Architecture

이 문서는 현재 코드베이스의 구조와, 앞으로 확장 모듈 형태로 유지하기 위한 권장 아키텍처를 정리한다.

상위 목표와 우선순위는 [nanoom_erp.md](nanoom_erp.md)를 기준으로 한다.

## 1. 현재 구조

### 1.1 Frontend

- Next.js App Router 기반
- 현재 주요 라우트는 `/`, `/login`, `/udms/*`, `/worship/*`, `/admin/*`, `/display`
- 일반 사용자는 예배 순서 편집, 자막 입력, 문서 열람을 담당한다.
- 관리자 화면은 사용자, 게시판, 예배 템플릿, 권한 관리 중심으로 동작한다.
- `frontend/app/(workspace)/display/page.tsx`는 WebSocket으로 실시간 상태를 받는다.

### 1.2 Backend

- FastAPI 기반
- 현재 API는 `api/routes.py`와 `api/v1/router.py`를 기준으로 나뉜다.
- `api/routes.py`는 예배 순서와 display 상태를 다루는 공용 API 진입점이다.
- `api/v1/router.py`는 auth, users, lookups, udms, admin 모듈을 묶는다.
- 현재 경로 예시:
  - `GET /api/health`
  - `GET /api/order-items`
  - `PUT /api/order-items/{item_id}`
  - `POST /api/order-items/{item_id}/activate`
  - `GET /api/display-state`
- 현재 WebSocket 경로:
  - `WS /ws/display`

### 1.3 Database

- MongoDB 7 사용
- 현재는 예배 순서와 display 상태를 중심으로 저장한다.
- 향후에는 사용자, 권한, 문서, 이력, 첨부파일, 결재 데이터를 같은 저장소에서 분리된 컬렉션으로 관리한다.

## 2. 권장 모듈 경계

현재 구현은 이미 모듈형으로 분해되는 방향으로 이동했다. 아래 경계를 유지하면 이후 기능 추가 시 리팩터링 비용이 줄어든다.

### 2.1 Auth

- 로그인
- 세션 또는 토큰 발급
- 사용자 식별
- 부서/직분 기반 초기 권한 부여

### 2.2 Users

- 사용자 프로필
- 부서 관리
- 직분 관리
- 관리자용 사용자 조회 및 수정

### 2.3 UDMS

- 게시판
- 문서
- 문서 버전
- 첨부파일
- 공유
- 결재
- 접근 권한

### 2.4 Worship

- 예배 순서 템플릿
- 예배 순서 본문
- 자막 입력
- 자막 콘텐츠
- 자막 출력

설계 구분:

- 템플릿 관리는 관리자 영역이다.
- 순서 편집과 자막 입력은 사용자 작업영역이다.
- 출력은 display와 연결된 송출 영역이다.

### 2.5 Admin

- 시스템 설정
- 게시판 관리
- 템플릿 관리
- 사용자 관리
- 권한 관리

## 3. 권장 코드 구조

### 3.1 Frontend

```text
frontend/app/
  layout.tsx
  (auth)/
    login/page.tsx
  (workspace)/
    page.tsx
    display/page.tsx
    udms/
      approvals/page.tsx
      boards/page.tsx
      documents/page.tsx
      permissions/page.tsx
      shares/page.tsx
    worship/
      contents/page.tsx
      orders/page.tsx
      subtitles/
        input/page.tsx
        output/page.tsx
  (admin)/
    admin/
      page.tsx
      boards/page.tsx
      permissions/page.tsx
      users/page.tsx
      worship-templates/page.tsx
frontend/components/
frontend/lib/
```

원칙:

- 화면별 로직은 `app`에서 시작한다.
- 재사용 UI는 `components`로 올린다.
- API 호출과 공통 타입은 `lib`로 모은다.

### 3.2 Backend

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

원칙:

- `main.py`는 조립만 담당한다.
- `modules/admin`과 `modules/udms`는 하위 기능 패키지를 include 하는 조립용 라우터를 가진다.
- 각 기능은 자기 API와 자기 입력 스키마를 가진다.
- 저장소 접근은 repository 또는 store 계층에서만 담당한다.
- WebSocket은 HTTP API와 분리하되, 같은 도메인 모듈에 귀속시킨다.

## 4. 데이터 경계

현재 구현에서 확장해야 할 핵심 데이터는 다음과 같다.

- `User`
- `Department`
- `Role` 또는 `Position`
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

권장 사항:

- 본문 데이터와 파일 메타데이터를 분리한다.
- 이력은 덮어쓰지 말고 누적한다.
- 접근 권한은 문서 단위와 기능 단위 둘 다 표현할 수 있어야 한다.

## 5. 실시간 구조

초기에는 display 화면만 WebSocket으로 갱신한다.

향후 실시간 채널은 다음처럼 분리하는 것이 좋다.

- `WS /ws/display`
- `WS /ws/worship/subtitles`
- `WS /ws/notifications`

이렇게 분리하면 다음 이점이 있다.

- display와 편집 화면의 책임이 분리된다.
- 예배 자막 입력 사용자가 많아져도 채널을 독립적으로 운영할 수 있다.
- 알림, 승인, 공동 편집 기능을 후속 모듈로 붙이기 쉽다.

## 6. API 라우팅 원칙

- 가능한 한 `/api/v1` 형태로 버전 접두사를 둔다.
- 도메인별 prefix를 명확히 분리한다.
- UI 라우트와 API 라우트의 이름을 최대한 비슷하게 맞춘다.
- 공통 예외 응답 형식을 유지한다.

예시:

- `/api/v1/auth/oauth/{provider}/start`
- `/api/v1/auth/oauth/{provider}/callback`
- `/api/v1/auth/me`
- `/api/v1/users/me/profile`
- `/api/v1/udms/documents`
- `/api/v1/udms/documents/{id}/versions`
- `/api/v1/udms/documents/{id}/attachments`
- `/api/v1/admin/users`
- `/api/v1/admin/worship-templates`

## 7. 구현 순서 제안

1. 인증과 사용자/권한 기준을 만든다.
2. UDMS 문서와 첨부파일 구조를 만든다.
3. 수정 이력과 공유, 결재의 데이터 구조를 분리한다.
4. 관리자 페이지에 템플릿 관리와 권한 관리 화면을 붙인다.
5. 자막 입력과 출력 모듈을 실시간 구조로 확장한다.

## 8. 현재 코드와의 연결

현재 코드는 이미 확장 모듈 방향으로 나뉘어 있다.

- `frontend/app/(admin)/admin/page.tsx`는 관리자 콘솔의 출발점이다.
- `frontend/app/(workspace)/worship/orders/page.tsx`는 사용자 예배 순서 편집의 출발점이다.
- `frontend/app/(workspace)/worship/subtitles/input/page.tsx`는 사용자 자막 입력의 출발점이다.
- `frontend/app/(workspace)/display/page.tsx`는 실시간 출력 화면의 출발점이다.
- `backend/app/modules/admin/router.py`는 관리자 기능을 조립하는 진입점이다.
- `backend/app/modules/udms/router.py`는 UDMS 기능을 조립하는 진입점이다.
- `backend/app/api/routes.py`는 현재 REST 라우트를 모으는 진입점이다.
- `backend/app/main.py`는 FastAPI 앱과 WebSocket을 조립한다.

이 구조는 MVP에는 충분하지만, 확장 단계에서는 현재처럼 기능별 하위 패키지를 유지하는 것이 중요하다.

## 9. 관련 문서

- 상위 목표와 우선순위: [nanoom_erp.md](nanoom_erp.md)
- 실행 방법과 운영 절차: [operations.md](operations.md)
