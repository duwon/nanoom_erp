# Nanoom ERP / UDMS 개요

이 문서는 Nanoom ERP의 목표 구조와 현재 구현 방향을 정리한 문서다.
초기에는 간단한 업무 화면으로 시작하되, 이후에는 모듈 단위로 분리 가능한 구조를 유지하는 것을 목표로 한다.

현재 구현은 아직 시작 단계지만, 다음과 같은 분리 원칙을 지키는 방향으로 정리하고 있다.

## 1. 제품 목표

- 교회가 사용할 수 있는 로그인과 권한 관리 기능을 제공한다.
- UDMS를 중심으로 게시판, 문서, 첨부파일, 공유, 결재 흐름을 다룬다.
- 수정 이력, 문서 공유, 문서 결재, 묵상 권한 같은 공통 기능을 포함한다.
- 관리자 페이지에서 게시판, 예배 템플릿, 권한을 관리할 수 있어야 한다.
- 이후에는 예배 순서 입력, 예배 순서 출력, 자막 콘텐츠까지 확장한다.

## 2. 1차 구현 범위

### 2.1 사용자 로그인

로그인 사용자는 최소한 다음 분류를 가진다.

- 부목사
- 전도사
- 집사
- 권사
- 장로
- 성도
- 학생
- 기타

방향성:

- 부서와 직분은 단순 문자가 아니라 관리 가능한 기준 데이터로 본다.
- 로그인 이후 권한은 메뉴 단위가 아니라 기능 단위로도 확장할 수 있어야 한다.
- 향후 사용자 그룹, 해당 부서, 직분 조합에 따라 다른 메뉴를 제공할 수 있어야 한다.

### 2.2 UDMS

UDMS는 다음 영역을 포함한다.

- 게시판
- 문서
- 문서 버전
- 첨부파일
- 공유
- 결재
- 묵상 권한

추가로 포함할 기능은 다음과 같다.

- 수정 이력 관리
- 문서 검색
- 파일 권한 관리

권장 방향:

- 문서와 첨부파일은 분리해서 관리한다.
- 같은 문서라도 버전이 누적될 수 있어야 한다.
- 결재 상태는 보기, 승인, 반려, 완료 같은 형태로 확장할 수 있어야 한다.

### 2.3 관리자 페이지

관리자 페이지는 "관리만 하는 공간"이다.
사용자가 문서를 편집하거나 자막을 입력하는 화면이 아니라, 관리용 설정을 다루는 페이지다.

관리자 페이지에서 다룰 항목은 다음과 같다.

- 게시판 관리
- 예배 템플릿 관리
- 사용자 관리
- 권한 관리
- 향후 예배 콘텐츠 등록 및 기본값 관리

### 2.4 예배 기능

예배 기능은 이후 확장 모듈이다.

- 예배 순서 입력
- 예배 순서 출력
- 자막 콘텐츠

## 3. 확장 모듈 방향

초기 구현 이후에는 아래 모듈을 분리해서 확장한다.

### 3.1 예배 순서 입력

- 사용자가 예배 순서를 직접 편집할 수 있어야 한다.
- 입력 화면은 예배 순서 선택과 연동된다.
- 작성자는 자신의 영역만 입력할 수 있어야 한다.

### 3.2 예배 순서 출력

- 입력한 예배 순서를 별도 출력 화면에 보여준다.
- 출력 화면은 기존 문서 열람과 분리한다.
- 예배 진행 중 실시간 반영이 가능해야 한다.

### 3.3 자막 콘텐츠

자막 콘텐츠는 예배 입력과는 분리된 실시간 화면용 자료다.

예시:

- 찬양 가사
- 성경 본문
- 배경 영상
- PPT
- 기타 출력 자료

이 모듈은 문서 첨부나 일반 파일과는 다르게, "실시간으로 보여줄 콘텐츠"라는 점이 중요하다.

### 3.4 결재 시스템

- 문서 단위 또는 문서 그룹 단위 결재를 지원한다.
- 결재 상태는 초안, 검토중, 반려, 완료로 확장 가능해야 한다.
- 이후에는 문서 유형에 따라 결재 규칙을 나눌 수 있어야 한다.

## 4. 설계 원칙

- 기능이 커질수록 파일 하나에 모든 로직을 넣지 않는다.
- 화면 라우트와 API 라우트를 같은 이름으로 맞춘다.
- 초기에 작게 시작하더라도 모듈이 쪼개지기 쉬운 구조를 유지한다.
- 데이터 변경 이력, 권한, 결재 흐름은 공통 인프라로 분리한다.

## 5. 권장 디렉토리 구조

아래 구조는 현재 코드베이스를 기준으로 정리한 실제 반영 구조다.
`admin`은 사용자, 게시판, 예배 템플릿, 권한 관리를 담당하는 별도 관리 영역으로 분리되어 있다.

### 5.1 Frontend

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
```

설명:

- `(auth)`, `(workspace)`, `(admin)`은 URL을 직접 바꾸지 않는 route group이다.
- 실제 URL은 `/login`, `/udms/...`, `/worship/...`, `/admin/...`, `/display`처럼 단순하게 유지한다.
- `frontend/app/(admin)/admin/*`는 관리 화면이고, 일반 작업 화면과 분리한다.
- `frontend/app/(workspace)/display/page.tsx`는 별도 출력 화면이다.

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

설명:

- 현재 백엔드는 `udms`와 `admin`을 하위 패키지로 더 쪼개서 관리하고 있다.
- `auth`와 `users`는 아직 단일 모듈이지만, schemas를 분리해 확장하기 쉽게 유지한다.
- `api/routes.py`는 예배 순서와 display 상태를 다루는 공용 API 진입점이다.
- 공통 인증, 권한, 상태 저장은 `core`와 `dependencies.py`에 둔다.
- 실시간 기능은 `ws`로 모아 관리한다.
- `modules/lookups`는 부서, 직책 같은 공통 조회 API를 담당한다.

## 6. 권장 라우트 구조

### 6.1 현재 시작 라우트

현재는 다음 경로를 기준으로 시작한다.

- `/`
- `/login`
- `/admin`
- `/display`

### 6.2 향후 확장 라우트

확장 모듈이 붙을 때는 아래 구조를 권장한다.

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

### 6.3 백엔드 API 라우트

권장 API prefix는 다음과 같다.

- `/api/v1/auth/*`
- `/api/v1/users/*`
- `/api/v1/udms/*`
- `/api/v1/worship/*`
- `/api/v1/admin/*`
- `/api/v1/files/*`

실시간 채널은 다음처럼 분리한다.

- `WS /ws/display`
- `WS /ws/worship/subtitles`

## 7. 구현 우선순위

1. 사용자 로그인과 기본 권한 구조를 먼저 만든다.
2. UDMS 문서와 첨부파일 구조를 만든다.
3. 수정 이력과 공유, 결재 데이터 구조를 분리한다.
4. 관리자 페이지에서 템플릿과 권한 관리 화면을 연결한다.
5. 마지막으로 자막 콘텐츠와 예배 출력 모듈을 확장한다.

## 8. 현재 코드와의 연결

- `frontend/app/(admin)/admin/page.tsx`는 관리자 콘솔의 출발점이다.
- `frontend/app/(workspace)/worship/orders/page.tsx`는 예배 순서 관련 진입점이다.
- `frontend/app/(workspace)/worship/subtitles/input/page.tsx`는 자막 입력 화면이다.
- `frontend/app/(workspace)/display/page.tsx`는 실시간 출력 화면이다.
- `backend/app/modules/admin/router.py`는 관리자 기능을 하위 모듈로 조립하는 진입점이다.
- `backend/app/modules/udms/router.py`는 UDMS 기능을 하위 모듈로 조립하는 진입점이다.
- `backend/app/modules/admin/boards/router.py`와 `backend/app/modules/admin/users/router.py`는 관리자 기능을 분리한 예시다.
- `backend/app/modules/udms/boards/router.py`와 `backend/app/modules/udms/documents/router.py`는 UDMS 기능을 분리한 예시다.
- `backend/app/api/routes.py`는 현재 예배 관련 공용 API를 묶는다.
- `backend/app/main.py`는 FastAPI와 WebSocket을 연결한다.

이 구조는 MVP 단계에서는 단순하게 유지하되, 향후에는 모듈 단위로 더 쪼개는 것을 전제로 한다.

## 9. 관련 문서

- 상위 목표 문서: [nanoom_erp.md](nanoom_erp.md)
- 운영 방법과 실행: [operations.md](operations.md)
