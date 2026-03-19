# Nanoom ERP Demo

FastAPI, Next.js, MongoDB 기반의 실시간 자막 송출 및 관리 데모입니다.

이 저장소의 기준 문서는 아래 5개입니다.

- [README.md](README.md): 빠른 시작과 문서 진입점
- [docs/nanoom_erp.md](docs/nanoom_erp.md): 프로젝트 설계 기준서
- [docs/architecture.md](docs/architecture.md): 현재 구현 구조 요약
- [docs/layout.md](docs/layout.md): 목표 레이아웃과 정보구조 기준서
- [docs/operations.md](docs/operations.md): 로컬 실행, 환경변수, 운영 메모, 장애 대응
- [docs/user.md](docs/user.md): 소셜 로그인, 승인 흐름, 역할/상태 정책

## 빠른 시작

```bash
docker compose up --build
```

현재 이 개발 PC는 Windows 포트 예약 문제 때문에 루트 `.env`에 `FRONTEND_PORT=3300`이 설정되어 있습니다.

주요 접속 경로:

- Frontend Home: `http://localhost:3300/`
- Admin: `http://localhost:3300/admin`
- Display: `http://localhost:3300/display`
- Backend Docs: `http://localhost:8000/docs`

종료:

```bash
docker compose down
```

## 문서 안내

- 프로젝트 목표, NAS 배포 전제, MVP 상세 설계, 후속 확장 방향은 [docs/nanoom_erp.md](docs/nanoom_erp.md)
- 현재 코드 기준의 컴포넌트 구조와 인터페이스 요약은 [docs/architecture.md](docs/architecture.md)
- 실행 방법, 환경변수, 검증 기준, 이번에 확인된 이슈는 [docs/operations.md](docs/operations.md)
- 사용자 인증, 승인 대기, 소셜 로그인 정책은 [docs/user.md](docs/user.md)

## 디렉터리 메모

- `frontend/`: Next.js UI
- `backend/`: FastAPI API, WebSocket, 설정
- `storage/mongo/`: MongoDB 로컬 데이터
- `infra/`: 인프라 관련 메모
- `docs/nanoom_erp.md`: 상위 설계 기준서
- `docs/layout.md`: 레이아웃 기준서
- `docs/user.md`: 사용자 인증 및 승인 흐름 기준서
