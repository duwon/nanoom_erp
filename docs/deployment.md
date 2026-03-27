# Deployment

이 문서는 Nanoom ERP의 NAS 배포 구조와 GitLab CI/CD 기준 운영 방법을 정리한다.

## 1. 전체 흐름

```text
개발자 PC
  -> git push
  -> GitLab
  -> CI/CD pipeline
  -> NAS Docker engine
```

- `main` 브랜치: 프로덕션 배포
- `dev` 브랜치: 개발 서버 배포

권장 공개 주소:

- 프로덕션: `https://erp.nanoom.org`
- 개발 서버: `http://erp.nanoom.org:3300`

프로덕션은 NAS 리버스 프록시가 `80/443`을 점유하고, 앱 컨테이너는 루프백 포트만 사용한다.

## 2. NAS 디렉토리 구조

```text
/volume1/docker/
  nanoom-project/
    .env.prod
    .env.dev
    docker-compose.deploy.yml

  nanoom-prod/
    mongo/
    udms/

  nanoom-dev/
    mongo/
    udms/
```

- `/volume1/docker/nanoom-project`는 최초 1회 수동 생성한다.
- `.env.prod`, `.env.dev`는 NAS에서 직접 생성한다.
- `docker-compose.deploy.yml`은 CI가 매 배포마다 복사한다.
- `nanoom-prod`, `nanoom-dev` 데이터 디렉토리는 CI가 자동 생성한다.

## 3. GitLab Runner

Runner는 NAS Docker 위에서 직접 Docker 명령을 실행하는 구조를 전제로 한다.

```toml
[[runners]]
  executor = "docker"
  [runners.docker]
    volumes = [
      "/cache",
      "/var/run/docker.sock:/var/run/docker.sock",
      "/volume1/docker:/volume1/docker",
    ]
```

핵심 포인트:

- SSH 배포가 아니라 Docker socket 공유 방식이다.
- 컨테이너 내부 `/volume1/docker` 경로와 NAS 호스트 경로를 동일하게 맞춘다.
- GitLab Container Registry 없이 같은 NAS에서 빌드 후 바로 배포한다.

## 4. 브랜치별 공개 구조

| 브랜치 | 용도 | 외부 URL | 컨테이너 바인딩 |
| --- | --- | --- | --- |
| `main` | 프로덕션 | `https://erp.nanoom.org` | frontend `127.0.0.1:3400`, backend `127.0.0.1:8000` |
| `dev` | 개발 서버 | `http://erp.nanoom.org:3300` | frontend `0.0.0.0:3300`, backend `0.0.0.0:8001` |

프로덕션은 컨테이너가 직접 `0.0.0.0:80`을 잡지 않는다. `80` 포트 충돌은 대부분 DSM, Web Station, 기존 Nginx, NAS 리버스 프록시 중 하나가 이미 점유하고 있어서 발생한다.

## 5. docker-compose.deploy.yml

배포용 Compose는 두 네트워크를 사용한다.

- `edge_net`: 외부 또는 리버스 프록시가 접근하는 네트워크
- `internal_net`: MongoDB 포함 내부 통신 전용 네트워크

서비스별 노출 정책:

- `mongo`: `internal_net`만 사용, 외부 포트 미노출
- `backend`: `edge_net`, `internal_net` 모두 사용
- `frontend`: `edge_net`, `internal_net` 모두 사용

배포 포트는 env 파일에서 결정한다.

- 프로덕션: `BACKEND_BIND_IP=127.0.0.1`, `FRONTEND_BIND_IP=127.0.0.1`
- 개발 서버: `BACKEND_BIND_IP=0.0.0.0`, `FRONTEND_BIND_IP=0.0.0.0`

## 6. GitLab CI/CD

### Build stage

- backend 이미지는 `docker build --target prod`
- frontend 이미지는 `docker build --target prod`
- `NEXT_PUBLIC_*` 값은 frontend 빌드 시점에 번들에 고정된다.

브랜치별 빌드 URL:

- `main`
  - `NEXT_PUBLIC_API_BASE_URL=https://erp.nanoom.org`
  - `NEXT_PUBLIC_WS_URL=wss://erp.nanoom.org/ws/display`
- `dev`
  - `NEXT_PUBLIC_API_BASE_URL=http://erp.nanoom.org:8001`
  - `NEXT_PUBLIC_WS_URL=ws://erp.nanoom.org:8001/ws/display`

### Deploy stage

- 최신 `docker-compose.deploy.yml`을 `/volume1/docker/nanoom-project/`로 복사
- 데이터 디렉토리 자동 생성
- `/volume1/docker/nanoom-project/.env.prod` 또는 `.env.dev` 사용
- `docker compose up -d --pull missing` 실행

추가 안전장치:

- 프로덕션 `.env.prod`에 `FRONTEND_PORT=80`이 들어 있으면 CI가 명확한 메시지와 함께 실패한다.
- 이 경우 `FRONTEND_PORT=3400`으로 바꾸고 NAS 리버스 프록시를 사용해야 한다.

## 7. 프로덕션 리버스 프록시

NAS에서 다음 규칙을 잡는 구성을 권장한다.

1. `https://erp.nanoom.org/` -> `http://127.0.0.1:3400/`
2. `https://erp.nanoom.org/api` -> `http://127.0.0.1:8000/api`
3. `https://erp.nanoom.org/ws` -> `http://127.0.0.1:8000/ws`

주의:

- `/ws` 프록시에는 WebSocket 업그레이드 지원이 필요하다.
- `AUTH_COOKIE_SECURE=true`를 사용하려면 퍼블릭 URL도 반드시 HTTPS여야 한다.
- 만약 HTTP만 사용할 계획이면 `AUTH_COOKIE_SECURE=false`로 바꿔야 하지만, 운영 환경에서는 권장하지 않는다.

## 8. NAS 초기 세팅

최초 1회:

```bash
mkdir -p /volume1/docker/nanoom-project
cd /volume1/docker/nanoom-project
cp /path/to/repo/.env.prod.example .env.prod
cp /path/to/repo/.env.dev.example .env.dev
```

그 다음 실제 시크릿 값으로 수정한다.

- `JWT_SECRET_KEY`
- OAuth client ID / secret
- 쿠키 및 도메인 설정

## 9. 현재 Runner 에러 원인

에러 메시지:

```text
listen tcp4 0.0.0.0:80: bind: address already in use
```

원인:

- 프로덕션 frontend 컨테이너가 NAS 호스트의 `80` 포트를 직접 열려고 시도했다.
- 하지만 NAS에서 이미 다른 서비스가 `80`을 사용 중이었다.

정리:

- 이 문제는 Docker 이미지 문제가 아니라 호스트 포트 충돌이다.
- 프로덕션은 `80/443`을 NAS 리버스 프록시에 맡기고, 앱 컨테이너는 내부 포트로만 띄우는 구조가 안전하다.
