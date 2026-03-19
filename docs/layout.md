# Layout Baseline

이 문서는 Nanoom ERP의 화면 구조와 라우팅 기준을 정의한다.  
이번 구현 완료 기준으로는 `dashboard` 중심의 authenticated shell, public home, attention state, display exception이 모두 분리되어야 한다.

## 1. 목적

- 사용자의 상태와 역할에 따라 진입 경로를 분리한다.
- 공통 authenticated shell 안에서 업무 화면을 일관되게 제공한다.
- 데스크톱과 모바일 모두에서 동일한 정보 구조를 유지한다.
- `/display`는 발표 전용 full-screen surface로 유지한다.

## 2. 화면 분류

### 2.1 Public View

- `/`
- `/login`

특징:

- 로그인하지 않은 사용자용 진입점이다.
- public home은 authenticated shell을 사용하지 않는다.
- login은 OAuth 시작점만 제공한다.

### 2.2 Attention State View

- `/onboarding`
- `/pending`
- `/blocked`

특징:

- 로그인 이후에도 추가 조치가 필요한 상태를 다룬다.
- authenticated shell을 사용하지 않는다.
- 상태 설명, 최소한의 안내, 로그아웃만 제공한다.

### 2.3 Authenticated Shell

- `/dashboard`
- `/udms/*`
- `/worship/*`
- `/admin/*`

특징:

- 공통 글로벌 헤더와 좌측 내비게이션을 사용한다.
- 데스크톱에서는 고정 sidebar, 모바일에서는 drawer로 동작한다.
- 현재 선택된 모듈과 페이지가 항상 보인다.
- `master`는 `Admin` 섹션을 추가로 본다.

### 2.4 Display Exception

- `/display`

특징:

- authenticated shell을 사용하지 않는다.
- full-screen 발표 화면으로 동작한다.
- WebSocket 기반으로 실시간 상태를 갱신한다.

## 3. 라우팅 규칙

### 3.1 기본 진입

| 사용자 상태 | 기본 진입 경로 | 적용 레이아웃 |
| --- | --- | --- |
| 비로그인 | `/` 또는 `/login` | Public View |
| 프로필 미완성 | `/onboarding` | Attention State View |
| `pending` | `/pending` | Attention State View |
| `blocked` | `/blocked` | Attention State View |
| `active` 일반 사용자 | `/dashboard` | Authenticated Shell |
| `active` `master` | `/admin` | Authenticated Shell |

### 3.2 목표 라우트

- Public: `/`, `/login`
- Attention: `/onboarding`, `/pending`, `/blocked`
- Workspace: `/dashboard`, `/udms/*`, `/worship/*`
- Admin: `/admin/*`
- Display: `/display`

## 4. 구현 완료 보고서

### 4.1 구현 요약

이번 작업에서 다음을 구현했다.

1. authenticated shell 공통 레이아웃
2. `/dashboard` 라우트 및 사용자 대시보드
3. public home 분리
4. `/display` shell 제외
5. auth redirect 기준을 `/dashboard`로 정렬

### 4.2 라우팅 시나리오 테스트 결과

아래 결과는 실제 코드 경로, 빌드 산출물, redirect 로직을 기준으로 검증했다.

| 시나리오 | 기대 결과 | 검증 결과 |
| --- | --- | --- |
| 비로그인 사용자가 `/` 접근 | public home 노출 | 통과 |
| 비로그인 사용자가 `/dashboard` 접근 | `/login`으로 유도 | 통과 |
| active 일반 사용자가 `/` 접근 | `/dashboard`로 이동 | 통과 |
| active 일반 사용자가 `/dashboard` 접근 | dashboard 렌더링 | 통과 |
| master 사용자가 `/` 접근 | `/admin`으로 이동 | 통과 |
| master 사용자가 `/dashboard` 접근 | dashboard shell 사용 | 통과 |
| `/display` 접근 | shell 없이 display 화면 렌더링 | 통과 |

### 4.3 검증 방법

- `npm.cmd run typecheck`
- `npm.cmd run build`
- 빌드 결과에서 `/dashboard`가 별도 route로 생성되는지 확인
- `frontend/lib/server-auth.ts`와 `backend/app/modules/auth/router.py`의 redirect 기준 확인
- `frontend/app/display/page.tsx`가 route group 밖으로 분리되었는지 확인

### 4.4 `/display` 제외 이유

`/display`는 authenticated shell에서 제외했다. 이유는 다음과 같다.

- 발표 화면은 운영자가 대시보드처럼 탐색하는 화면이 아니라, 관객에게 보여주는 단일 목적의 full-screen surface다.
- shell의 sidebar, header, sign-out 같은 chrome은 발표 화면에서 시각적 방해 요소가 된다.
- display는 `worship/subtitles/output`와 연결되어 실시간 갱신되는 화면이므로, 고정 네비게이션보다 렌더링 안정성과 가독성이 우선이다.
- authenticated shell은 로그인 사용자용 작업 공간의 공통 프레임이며, `/display`는 역할상 “작업 공간”이 아니라 “출력 장치”에 가깝다.
- 따라서 `/display`는 인증 여부와 무관하게 별도 route로 두고, WebSocket 연결과 full-screen UX에 집중하도록 분리했다.

## 5. Authenticated Shell 구조

### 5.1 Desktop

- 왼쪽 고정 sidebar
- 상단 global header
- 현재 섹션/페이지 표시
- 우측에는 sign-out과 사용자 정보 노출

### 5.2 Mobile

- header의 `Menu` 버튼으로 drawer를 연다
- drawer는 현재 사용자와 모듈별 contextual menu를 함께 보여준다
- 라우트가 바뀌면 drawer는 자동으로 닫힌다

### 5.3 모듈 순서

1. `Dashboard`
2. `UDMS`
3. `Worship`
4. `Admin` (`master`만 노출)

### 5.4 Dashboard 우선순위

대시보드에서 우선 보여줄 항목:

1. 사용자 식별 정보
2. 계정 상태
3. 핵심 바로가기
4. 다음 작업 카드

## 6. 현재 Next.js 디렉토리 구조

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

## 7. 완료 기준

- [x] `/dashboard` route 구현
- [x] authenticated shell 구현
- [x] public home 분리
- [x] `/display` shell 제외
- [x] auth redirect 기준 `/dashboard`로 정렬
- [x] 모바일 drawer 동작 추가
- [x] layout 문서 기준과 실제 구조 정합

## 8. 관련 문서

- [docs/architecture.md](architecture.md)
- [docs/nanoom_erp.md](nanoom_erp.md)
- [docs/operations.md](operations.md)
- [docs/user.md](user.md)
