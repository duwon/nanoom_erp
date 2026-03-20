# Worship 모듈 구현 기준

## 개요
- 인증 워크스페이스의 예배 모듈 기본 진입은 `/worship`이다.
- 예배 운영 데이터는 `worship_services` aggregate와 `presentation_state` projection을 기준으로 관리한다.
- 기존 `/api/order-items*`, `/api/display-state`, `/ws/display`는 새 worship 출력 상태를 읽는 호환 계층으로 유지한다.

## 프론트 구조
- `/worship`: 예배 운영 대시보드
- `/worship/assignees`: 담당자 진행 현황과 게스트 입력 링크 발급
- `/worship/songs`: 찬양 / 특송 입력과 가사 분할
- `/worship/message`: 성경 본문 / 말씀 / 공지 입력
- `/worship/review`: 검수와 송출
- `/worship/input/[token]`: 로그인 없는 게스트 입력 화면

기존 경로는 다음과 같이 리다이렉트한다.
- `/worship/orders` -> `/worship`
- `/worship/contents` -> `/worship`
- `/worship/subtitles/input` -> `/worship/songs`
- `/worship/subtitles/output` -> `/worship/review`

## 백엔드 구조
- 라우터: `/api/v1/worship`
- 핵심 서비스: `backend/app/services/worship_service.py`
- 저장소: `backend/app/modules/worship/repository.py`
- 스키마: `backend/app/modules/worship/schemas.py`
- 어댑터: `backend/app/modules/worship/adapters.py`

### 주요 API
- `GET /api/v1/worship/calendar`
- `GET /api/v1/worship/services/{serviceId}`
- `PATCH /api/v1/worship/services/{serviceId}`
- `PATCH /api/v1/worship/services/{serviceId}/sections/{sectionId}`
- `POST /api/v1/worship/services/{serviceId}/sections/reorder`
- `POST /api/v1/worship/services/{serviceId}/tasks/{taskId}/guest-link`
- `GET /api/v1/worship/input/{token}`
- `PUT /api/v1/worship/input/{token}`
- `GET /api/v1/worship/lookups/songs`
- `GET /api/v1/worship/lookups/scripture`
- `POST /api/v1/worship/services/{serviceId}/sections/{sectionId}/lyrics:parse`
- `GET /api/v1/worship/services/{serviceId}/review`
- `POST /api/v1/worship/services/{serviceId}/presentation/activate`

## 템플릿 seed
기본 seed 템플릿은 다음 6종이다.
- 새벽기도
- 주일 1부 예배
- 주일 2부 예배
- 오후예배
- 수요 예배
- 금요 기도회

## UDMS 연동
- `WorshipOrder`는 활성 타겟이며 `serviceId`를 부모로 검증한다.
- 딥링크는 `/worship?serviceId={target_id}`를 사용한다.
- `WorshipContent`, `SubtitleContent`는 read-only 등록 상태로 비활성 유지한다.

## 검증 명령
- 백엔드: `python -m pytest`
- 프론트 타입: `npm run typecheck`
- 프론트 빌드: `npm run build`
