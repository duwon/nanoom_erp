# 사용자 로그인 및 계정 체계

이 문서는 Nanoom ERP의 사용자 인증 구조를 `아이디/비밀번호` 기반 데모에서
`소셜 로그인 + 승인 기반 계정 체계`로 전환한 결과를 정리한다.
화면 진입과 정보구조 기준은 [layout.md](layout.md)를 따른다.

## 1. 검토 결과

기존 구조의 문제:

- `username/password` 데모 로그인이라 운영 보안 모델과 맞지 않았다.
- 사용자 저장소가 `InMemoryAppStore`에 묶여 있어 서버 재시작 시 사용자 상태가 유지되지 않았다.
- 세션 토큰이 수제 구현이라 운영용 검증 라이브러리 기반 교체가 필요했다.
- 관리자 사용자 화면이 placeholder 수준이라 승인 대기, 차단, 역할 변경을 처리할 수 없었다.

이번 변경 결과:

- 운영 로그인 방식을 `google | kakao` 소셜 로그인으로 전환했다.
- 사용자 원본 저장소를 Mongo 기반 `users` 컬렉션으로 분리했다.
- 세션 토큰을 `PyJWT` 기반으로 교체했다.
- 최초 로그인 사용자는 `member/pending`으로 생성되고, 프로필 입력 후 관리자 승인 흐름으로 연결된다.
- `master`만 관리자 화면과 관리자 API를 사용할 수 있다.

## 2. 사용자 데이터 모델

기본 사용자 필드:

- `id`
- `email`
- `social_provider`
- `provider_user_id`
- `role`: `master | final_approver | editor | member`
- `status`: `pending | active | blocked`
- `name`
- `position`
- `department`
- `approved_at`
- `approved_by`
- `last_login_at`
- `created_at`
- `updated_at`

설계 원칙:

- `(social_provider, provider_user_id)` 조합을 계정의 유일 식별자로 사용한다.
- 이메일은 필수지만, 이메일만으로 계정을 식별하거나 병합하지 않는다.
- 신규 사용자는 기본값으로 `role=member`, `status=pending`이다.
- 프로필 완성 기준은 `name`, `position`, `department`가 모두 채워진 상태다.

## 3. 상태 전이와 화면 흐름

로그인 흐름:

1. 사용자가 `/login`에서 Google 또는 Kakao 로그인을 시작한다.
2. OAuth callback에서 계정을 조회하거나 신규 생성한다.
3. 프로필이 비어 있으면 `/onboarding`으로 이동한다.
4. 프로필이 채워졌지만 `pending`이면 `/pending`으로 이동한다.
5. `blocked` 사용자는 `/blocked`로 이동한다.
6. `active` 사용자는 일반 사용자면 `/dashboard`, 마스터면 `/admin`으로 이동한다.

목표 레이아웃 기준:

- 비로그인 사용자는 `/` 또는 `/login`으로 들어온다.
- 일반 사용자는 공통 작업 셸의 기본 진입점인 `/dashboard`로 이동한다.
- 관리자는 `/admin`으로 이동한다.
- `display`는 별도 전체화면 송출 화면이므로 로그인 전후 흐름과 분리한다.

상태별 접근 정책:

- `pending`: `GET /api/v1/auth/me`, `POST /api/v1/auth/logout`, `PUT /api/v1/users/me/profile`만 허용
- `active`: 일반 업무 API 접근 허용
- `blocked`: `auth/me`, `logout`만 허용하고 업무 API 차단

관리자 정책:

- `master`만 `/admin/*`와 `/api/v1/admin/*`에 접근 가능
- `editor`는 문서 작성/수정 권한
- `final_approver`는 현재는 `active` 일반 사용자로 취급하고, 향후 승인 모듈에서 확장
- 일반 사용자는 공통 글로벌 헤더와 좌측 컨텍스트 사이드바를 사용하는 워크스페이스를 사용한다.
- 관리자는 같은 헤더 계열을 공유하더라도 관리자 전용 메뉴와 대시보드를 사용한다.

## 4. 인증/API

공개 인증 API:

- `GET /api/v1/auth/oauth/{provider}/start`
- `GET /api/v1/auth/oauth/{provider}/callback`
- `GET /api/v1/auth/me`
- `POST /api/v1/auth/logout`
- `PUT /api/v1/users/me/profile`

관리자 사용자 API:

- `GET /api/v1/admin/users`
- `PUT /api/v1/admin/users/{user_id}`

응답 모델 핵심 필드:

- `email`
- `socialProvider`
- `providerUserId`
- `role`
- `status`
- `name`
- `position`
- `department`

세션 정책:

- 세션은 `httpOnly` 쿠키(`nanoom_access_token`)로 유지한다.
- 토큰 구현은 `PyJWT` 기반 HS256 서명으로 교체했다.
- OAuth 시작 단계의 `state`도 서명된 토큰으로 관리한다.

## 5. 환경 변수

주요 변수:

- `FRONTEND_APP_URL`
- `JWT_SECRET_KEY`
- `GOOGLE_OAUTH_CLIENT_ID`
- `GOOGLE_OAUTH_CLIENT_SECRET`
- `KAKAO_OAUTH_CLIENT_ID`
- `KAKAO_OAUTH_CLIENT_SECRET`
- `AUTH_DEV_SEED_ENABLED`
- `AUTH_DEV_SEED_PROVIDER`
- `AUTH_DEV_SEED_EMAIL`
- `AUTH_DEV_SEED_PROVIDER_USER_ID`
- `AUTH_DEV_SEED_NAME`

로컬 개발 기본 정책:

- Google OAuth가 아직 연결되지 않은 로컬 환경에서는 개발용 seed 마스터 계정을 사용할 수 있다.
- 기본 seed 계정은 `google/dev-master/admin@localhost`로 생성된다.
- 운영 환경에서는 실제 OAuth 앱 등록 정보와 `secure` 쿠키 설정을 적용해야 한다.

## 6. TODO 진행 현황

- [x] `docs/user.md` 작성
- [x] `README.md`에 `docs/user.md` 링크 추가
- [x] 사용자 Mongo 저장소 및 인덱스 설계
- [x] OAuth 시작/콜백 구현
- [x] JWT 세션 구현 교체
- [x] `AuthUser`/`User` 스키마 재정의
- [x] `PUT /api/v1/users/me/profile` 구현
- [x] status/role 기반 dependency 재구성
- [x] `/login` 소셜 버튼 UI 교체
- [x] `/onboarding`, `/pending`, `/blocked` 화면 추가
- [x] `/admin/users` 승인 콘솔 구현
- [x] 백엔드 인증 테스트를 소셜/상태 시나리오로 교체
- [x] 프론트 타입체크 유지
- [ ] 운영용 Google OAuth 앱 등록
- [ ] 운영용 Kakao OAuth 앱 등록
- [ ] 운영 배포 시 `auth_cookie_secure=true` 및 HTTPS 적용
- [x] 레이아웃 셸 적용 후 `/dashboard` 기본 진입 전환
- [x] 모바일 drawer 기반 사이드바 적용
