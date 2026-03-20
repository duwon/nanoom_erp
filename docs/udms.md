# Nanoom ERP UDMS V2 구현 계획서

기준일: `2026-03-20`

본 문서는 Nanoom ERP의 UDMS를 V2 재설계 계획 기준으로 정리한 구현 계획서다.  
현재 코드베이스에 이미 반영된 구조와, 이후 확장 시 필요한 목표 구조를 함께 병기한다.  
특히 `targetType`을 둘러싼 현재의 강결합 구조와, 이를 해소하기 위한 `Dynamic Target Registry` 설계를 문서 중심으로 정리한다.

---

## 0. 현재 기준선 (2026-03-20)

현재 코드베이스는 V1의 `board_id + linked version row + shares + board_permissions` 구조에서 벗어나, V2의 핵심 골격인 `Document Root + Revision + ACL + Target Registry` 구조로 이미 전환되었다.

현재 기준 기술 스택:

- 백엔드: `FastAPI + MongoDB`
- 프론트엔드: `Next.js App Router`
- 저장소: `UDMS_STORAGE_DIR` 기반 파일 시스템 저장

현재 회귀 상태:

- `python -m pytest` 통과
- `npm.cmd run typecheck` 통과
- `npm.cmd run build` 통과

현재 반영된 범위:

- 문서 root/revision 분리
- 문서 ACL 및 target policy 분리
- working draft / published revision 동시 보유
- external share 관리
- 파일 업로드/다운로드/삭제
- approval-completed / parent-deleted hook
- legacy V1 데이터의 V2 migration
- `/udms/documents`, `/udms/shares`, `/udms/permissions` 화면의 V2 계약 전환

### 0.1 현재 구조의 핵심 상태: Dynamic Target Registry 1차 전환 완료

현재 구현은 `targetType` 확장 구조를 Enum 중심에서 app bootstrap 시점의 `TargetRegistry` 중심으로 1차 전환했다.

현재 구조의 특징:

- 백엔드는 `targetType: str`를 받고, request 처리 시 registry 등록 여부로 검증한다.
- 백엔드는 app 인스턴스마다 fresh `TargetRegistry`를 만들고, `udms` core와 `worship` 모듈이 bootstrap 단계에서 target을 등록한다.
- 프론트는 `GET /api/v1/udms/target-types` catalog를 읽어 selector와 target metadata를 구성한다.
- 문서 생성/수정/정책 저장은 `isEnabled=true` target만 허용하고, 현재는 `Board`만 write-enabled 상태다.
- Board를 제외한 대부분의 target은 registry 등록과 read-only deep-link metadata까지는 반영되었지만, 실제 parent validation은 아직 없다.

즉, "문서에 targetType만 적는 것"이 아니라 "registry 등록이 선행되어야 한다"는 원칙은 이미 코드에 반영됐다.  
다만 새 모듈을 완전히 열기 위해서는 여전히 아래 항목이 추가로 필요하다.

- 모듈 bootstrap registration
- parent validator 구현
- 정책 resolver 연결
- 실제 사용자 화면과 parent detail 연동

---

# 1. 프로젝트 개요 및 목표

## 1.1 개발 배경

기존 UDMS V1은 문서 엔진이라기보다 게시판 문서 시스템에 가까웠다. 문서가 항상 `board_id`에 종속되었고, 버전은 문서 row 자체를 복제하는 방식이었으며, 권한은 `shares`와 `board_permissions`로 분리되어 있었다. 이 구조는 게시판 외 모듈로 확장하기 어렵고, draft/published 분리나 문서 단위 보안 정책도 자연스럽게 표현하지 못했다.

UDMS V2는 게시판, 결재, 예배, 재고, 방송, 프로젝트, 사용자 문서를 하나의 공용 엔진으로 통합하는 것을 목표로 한다.

## 1.2 주요 목표

- 게시판 중심 문서 모델을 중단하고 공용 문서 엔진으로 전환
- 문서 root와 revision을 분리해 버전 이력과 draft 작업을 명확히 관리
- target 상속 권한과 document ACL을 별도 레이어로 정리
- Approval, Worship 등 여러 모듈에서 동일한 API와 UI 패턴으로 문서를 사용
- 기존 진입 URL은 최대한 유지하면서 내부 계약만 V2로 교체
- 장기적으로는 UDMS 코드를 직접 수정하지 않고도 새 모듈이 target을 등록할 수 있는 구조로 전환

## 1.3 핵심 개념: Atomic Document Root

UDMS V2의 핵심 개념은 "문서 자체는 하나의 독립 엔티티이고, 어느 모듈에 연결되는지는 `link`가 결정한다"는 점이다.

- 문서의 정체성은 `document root`가 가진다.
- 내용의 변화는 `revision`이 가진다.
- 소속 모듈은 `link.targetType + link.targetId`가 가진다.
- 접근 제어는 `target policy + document ACL`의 합성 결과로 결정된다.

즉, Board 공지사항도 같은 문서 엔진을 쓰고, Approval 기안문도 같은 엔진을 쓰며, Worship 자료도 같은 엔진을 쓴다.

---

# 2. 데이터 아키텍처 (Data Modeling)

## 2.1 통합 문서 스키마 상세 설계

현재 UDMS V2는 문서 root와 revision을 분리한 구조를 사용한다.

### 2.1.1 Document Root

문서 root는 문서의 현재 상태와 연결 정보를 보관한다.

```json
{
  "id": "doc_xxx",
  "header": {
    "title": "주보 초안",
    "category": "BoardPost",
    "tags": ["notice", "weekly"],
    "authorId": "user_xxx"
  },
  "link": {
    "targetType": "Board",
    "targetId": "board-notice",
    "deepLink": "/udms/boards?targetId=board-notice"
  },
  "state": {
    "status": "published"
  },
  "security": {
    "acl": [],
    "externalShares": []
  },
  "metadata": {
    "version": 3,
    "isDeleted": false,
    "archivedAt": null,
    "createdAt": "2026-03-20T00:00:00Z",
    "updatedAt": "2026-03-20T00:00:00Z"
  },
  "publishedRevisionId": "rev_xxx_v2",
  "workingRevisionId": "rev_xxx_v3",
  "moduleData": {}
}
```

### 2.1.2 Document Revision

revision은 문서 본문과 첨부 상태의 immutable snapshot이다.

```json
{
  "id": "rev_xxx_v3",
  "documentId": "doc_xxx",
  "version": 3,
  "header": {
    "title": "주보 수정안",
    "category": "BoardPost",
    "tags": ["notice", "weekly"],
    "authorId": "user_xxx"
  },
  "body": "<p>수정된 본문</p>",
  "summary": "수정된 본문",
  "editorType": "tiptap",
  "attachments": [],
  "moduleData": {},
  "changeLog": "본문 수정",
  "createdBy": "user_xxx",
  "createdAt": "2026-03-20T00:00:00Z"
}
```

### 2.1.3 설계 의도

- root는 "현재 문서의 대표 상태"를 담는다.
- revision은 "특정 시점의 편집 결과"를 담는다.
- 목록 조회는 root + summary projection으로 처리하고, 상세 조회에서만 body를 포함한다.
- `summary`는 HTML을 제거한 plain text로 저장해 목록과 검색에 사용한다.
- 현재 editorType은 `tiptap` 기준으로 동작한다.

## 2.2 다형성 연결 구조 (Polymorphic Linkage)

문서는 특정 모듈의 특정 parent 객체에 연결된다. 이 연결은 현재 코드 기준으로 app bootstrap 시점에 구성되는 동적 `Target Registry`가 관리한다.

### 2.2.1 현재 지원 targetType

현재 코드 기준으로 지원되는 targetType은 아래와 같다.

| targetType | 현재 deep-link | 현재 쓰기 상태 | 현재 parent 검증 상태 | 비고 |
| --- | --- | --- | --- | --- |
| `Board` | `/udms/boards?targetId={id}` | 활성 | 구현 완료 | 실제 board 존재 여부 검증 |
| `Approval` | `/udms/approvals?targetId={id}` | 비활성 | 미구현 | template 연동은 `moduleData.approval.templateId` 사용, read-only metadata만 제공 |
| `WorshipOrder` | `/worship/orders?targetId={id}` | 비활성 | 미구현 | registry와 UI 바인딩 반영, 생성/수정은 차단 |
| `WorshipContent` | `/worship/contents?targetId={id}` | 비활성 | 미구현 | registry와 UI 바인딩 반영, 생성/수정은 차단 |
| `SubtitleContent` | `/worship/subtitles/input?targetId={id}` | 비활성 | 미구현 | registry와 UI 바인딩 반영, 생성/수정은 차단 |
| `Inventory` | `/dashboard?targetType=Inventory&targetId={id}` | 비활성 | 미구현 | placeholder deep-link |
| `Broadcast` | `/dashboard?targetType=Broadcast&targetId={id}` | 비활성 | 미구현 | placeholder deep-link |
| `Project` | `/dashboard?targetType=Project&targetId={id}` | 비활성 | 미구현 | placeholder deep-link |
| `User` | `/dashboard?targetType=User&targetId={id}` | 비활성 | 미구현 | placeholder deep-link |

### 2.2.2 현재 구현 방식: Bootstrap Registry + Catalog 소비

현재 구현은 다음 구조를 사용한다.

- 백엔드 schema: `targetType: str`
- 백엔드 registry: app bootstrap 시점의 `TargetRegistry`
- 프론트 타입: `DocumentTargetType = string`
- 프론트 선택 목록: `GET /api/v1/udms/target-types` catalog 기반

현재 동작 원리:

- 문서는 자신이 어느 모듈에 속하는지 `link.targetType + link.targetId`로 표현한다.
- `list_documents(targetType, targetId)`는 특정 parent에 연결된 문서를 역참조 조회한다.
- deep-link와 storage namespace는 registry descriptor를 기준으로 해석한다.
- 프론트는 `useTargetCatalog()`를 통해 catalog를 읽고 생성/필터/권한 화면을 렌더링한다.
- `DocumentContainer`와 일부 상세/공유 화면은 catalog metadata를 사용해 label과 deep-link를 표시한다.

### 2.2.3 현재 구조의 남은 문제점: 왜 아직 완전히 느슨하지 않은가

현재 구조에서는 "문서에 이름만 적는 것"으로는 충분하지 않다는 점은 여전히 같다. 다만 결합 지점이 Enum에서 bootstrap registration과 모듈 완성도로 이동했다.

이유:

- 스키마 검증
  `targetType`이 문자열이라도 registry에 등록되지 않으면 API 요청 단계에서 거절된다.
- 스토리지 격리
  파일 저장 경로가 `{UDMS_STORAGE_DIR}/{descriptor.namespace}/...` 규칙을 사용하므로, 시스템이 어떤 namespace를 허용하는지 registry가 알고 있어야 한다.
- deep-link 생성
  문서 상세에서 원래 모듈 화면으로 돌아갈 URL 패턴은 여전히 descriptor 등록이 필요하다.
- 프론트 렌더링
  selector는 동적으로 바뀌었지만, 실제로 쓰기 가능한 target을 늘리려면 backend registration + validator + 모듈 UI가 함께 준비되어야 한다.

즉, 현재는 "Enum 수정"은 사라졌지만, 여전히 "새 모듈을 실제로 열기 위해서는 bootstrap registration과 parent contract 구현이 필요한 구조"다.

### 2.2.4 목표 구조: Dynamic Target Registry

아래 원칙 중 1차 전환 범위는 현재 코드에 반영되어 있다. 남은 과제는 write-enabled target 확대와 parent/policy contract의 실제 연결이다.

핵심 원칙:

- `targetType`은 더 이상 UDMS 내부 Enum에 고정하지 않는다.
- UDMS는 문자열 `targetType`을 받되, registry에 등록된 값인지 확인한다.
- 각 모듈은 자기 초기화 시점에 자기 target을 UDMS에 등록한다.
- 프론트는 백엔드가 제공하는 target catalog를 조회해 동적으로 target selector를 렌더링한다.

즉, 장기 목표는 "새 모듈 추가 시 UDMS 코드를 직접 수정하지 않고, registry 등록 또는 설정 등록만으로 연결 가능"한 구조다.

### 2.2.5 Target Descriptor 계약

동적 registry로 전환할 경우, 각 target은 아래와 같은 descriptor를 제공해야 한다.

```ts
type TargetDescriptor = {
  targetType: string;
  label: string;
  namespace: string;
  deepLinkTemplate: string;
  requiresExistingParent: boolean;
  parentValidator?: string;
  policyResolver?: string;
  documentTitleHint?: string;
  isEnabled: boolean;
};
```

필드 설명:

- `targetType`
  문서가 연결될 parent 타입의 식별자
- `label`
  프론트 UI에서 보여줄 이름
- `namespace`
  파일 저장 경로와 운영 분류에 사용할 storage namespace
- `deepLinkTemplate`
  모듈 상세/목록으로 복귀할 URL 패턴
- `requiresExistingParent`
  targetId가 실제 parent entity여야 하는지 여부
- `parentValidator`
  parent 존재 여부를 확인하는 resolver 식별자 또는 validator 명칭
- `policyResolver`
  target 상속 권한을 계산하는 resolver 식별자
- `documentTitleHint`
  문서 생성 화면에서 기본 제목/문서 유형 힌트를 제공하기 위한 메타데이터
- `isEnabled`
  현재 운영 환경에서 활성화된 target인지 여부

### 2.2.6 등록 흐름: module bootstrap -> `udms.register_target(...)`

목표 구조에서 새 모듈은 UDMS 엔진 소스를 직접 수정하지 않고, 자기 모듈 부트스트랩 단계에서 target을 등록한다.

백엔드 내부 계약:

```python
udms.register_target(
    target_type="WorshipOrder",
    descriptor={
        "label": "Worship Order",
        "namespace": "worship-order",
        "deepLinkTemplate": "/worship/orders?targetId={target_id}",
        "requiresExistingParent": True,
        "parentValidator": "worship.order.exists",
        "policyResolver": "worship.order.policy",
        "documentTitleHint": "예배 순서 문서",
        "isEnabled": True,
    },
)
```

선택적 계약:

```python
udms.unregister_target("WorshipOrder")
```

`unregister_target()`는 운영 중 동적 제거가 필요한 경우를 위한 선택 기능으로 두되, 기본 계획에서는 optional이다.

### 2.2.7 fallback 정책: 미등록 targetType 거부 방식

동적 registry 구조에서도 아무 문자열이나 허용하는 것은 아니다.

정책:

- registry에 없는 `targetType`은 생성/수정 시 즉시 거부
- 에러 메시지는 "허용되지 않은 targetType"이 아니라 "등록되지 않은 targetType"으로 명확히 반환
- 비활성화된 `isEnabled=false` target은 조회는 허용할 수 있어도 신규 생성은 차단하는 방식으로 정책 분리 가능

즉, 문서에 targetType만 적는 것이 아니라, registry 또는 설정 등록이 선행되어야 한다.

### 2.2.8 공개 조회 API: `GET /api/v1/udms/target-types`

프론트가 target selector를 동적으로 렌더링하도록, 현재 사용 가능한 target 목록은 백엔드 catalog API가 내려준다.

현재 API:

- `GET /api/v1/udms/target-types`

현재 응답 예시:

```json
[
  {
    "targetType": "Board",
    "label": "Board",
    "namespace": "board",
    "deepLinkTemplate": "/udms/boards?targetId={target_id}",
    "requiresExistingParent": true,
    "documentTitleHint": "Board document",
    "isEnabled": true
  },
  {
    "targetType": "Approval",
    "label": "Approval",
    "namespace": "approval",
    "deepLinkTemplate": "/udms/approvals?targetId={target_id}",
    "requiresExistingParent": false,
    "documentTitleHint": "Approval document",
    "isEnabled": false
  }
]
```

이 API의 목적:

- 문서 생성 폼의 target selector 구성
- 권한 화면의 target selector 구성
- 모듈별 deep-link 정보 전달
- 비활성 target과 read-only target의 구분 전달

현재 정책:

- catalog에는 등록된 모든 target이 내려간다.
- selector는 `isEnabled=true` target만 노출한다.
- 현재 write-enabled target은 `Board`만 열려 있다.

### 2.2.9 프론트 구현 상태: Dynamic Target Rendering

현재 반영 사항:

- 문서 생성 화면은 `GET /api/v1/udms/target-types` 응답을 받아 selector를 구성한다.
- 권한 화면도 같은 catalog를 사용한다.
- `/udms/documents` 필터 화면도 같은 catalog를 사용해 활성 target만 보여준다.
- `DocumentContainer(targetType, targetId)`와 일부 상세/공유 화면은 registry metadata를 참고해 label과 deep-link를 구성한다.
- `DocumentTargetType`는 고정 union type이 아니라 `string` 기반 "registry-fed string domain"으로 전환되었다.

현재 남은 과제:

- 문서 상세 전반에서 `documentTitleHint`를 더 적극적으로 활용
- disabled target을 실제 parent detail 화면과 더 구체적으로 연결

## 2.3 버전 관리 전략 (Versioning)

UDMS V2는 V1의 row 복제 방식 대신 "revision snapshot + pointer 갱신" 구조를 사용한다.

### 2.3.1 현재 버전 관리 방식

1. 문서 생성 시 root 1개와 revision 1개를 만든다.
2. 아직 publish되지 않은 문서는 `workingRevisionId`만 가진다.
3. publish 시 `publishedRevisionId`를 working revision으로 옮기고, working pointer를 비운다.
4. published 문서에서 편집이 필요하면 working copy를 생성한다.
5. working copy 수정은 새로운 revision을 계속 누적한다.
6. rollback은 과거 revision을 그대로 되살리는 것이 아니라, 대상 revision을 기반으로 새 working revision을 만든다.

### 2.3.2 현재 상태 머신

- `draft`
- `published`
- `locked`
- `archived`

상태 전이 개념:

- `draft -> published`
- `published -> published + working draft`
- `published -> locked`
- `published/locked -> archived`

### 2.3.3 설계 의도

- published 문서를 읽는 사용자와 draft를 편집하는 사용자의 관점을 분리한다.
- revision은 immutable로 유지해 이력 추적과 rollback 근거를 보존한다.
- `locked`는 결재 완료 문서나 확정 문서의 수정 금지를 표현한다.

## 2.4 권한 및 보안 모델

UDMS V2는 권한 계산을 두 레이어로 나눈다.

### 2.4.1 Target Policy

target 단위 정책은 `udms_target_policies`에서 관리한다.

- action: `read | create | manage`
- subjectType: `role | department | user`

현재 역할:

- target에 대한 기본 읽기/생성/관리 권한 정의
- 문서 생성 가능 여부 결정
- published 문서의 기본 읽기 권한 상속

목표 방향:

- 현재는 target policy가 targetType 문자열과 targetId를 직접 사용하지만, 장기적으로는 `policyResolver`를 통해 모듈별 상속 권한 계산과 연결될 수 있어야 한다.

### 2.4.2 Document ACL

문서 단위 ACL은 `security.acl`에서 관리한다.

- action: `read | edit | manage | publish`
- effect: `allow | deny`

현재 규칙:

- 작성자는 기본적으로 문서에 대한 편집/관리 권한을 가진다.
- `deny`가 `allow`보다 우선한다.
- `manage`는 `read/edit/publish`를 포함한다.
- `publish`는 `read/edit`를 포함한다.

### 2.4.3 현재 권한 해석 순서

1. master 여부 확인
2. target policy 계산
3. 작성자 기본 권한 부여
4. document ACL allow/deny 반영
5. `locked` / `archived` 상태에 따른 권한 축소

### 2.4.4 외부 공유

현재 문서는 `security.externalShares`에 외부 공유 링크를 저장한다.

- `label`
- `token`
- `expiresAt`
- `canDownload`
- `createdBy`
- `createdAt`

현재는 내부 사용자 기준으로 링크 생성/삭제만 구현되어 있고, token 기반 익명 조회 endpoint는 아직 없다.

## 2.5 마이그레이션 전략 (V1 -> V2)

Mongo repository는 시작 시 legacy V1 자료를 V2로 이관할 수 있다.

### 2.5.1 현재 이관 규칙

- legacy `origin_doc_id` 체인은 1개의 root와 여러 revision으로 변환
- legacy `board_id`는 `link.targetType=Board`, `link.targetId=board_id`로 매핑
- legacy shares는 document ACL rule로 변환
- legacy board permissions는 `Board` target policy로 변환
- legacy attachments는 revision attachment snapshot으로 변환
- approval template은 `moduleData.approval.templateId`로 이동

### 2.5.2 컷오버 방향

- 새 엔드포인트는 `/api/v1/udms/docs`, `/api/v1/udms/policies`, `/api/v1/udms/hooks/*`
- 기존 `/documents*`, `/shares`, `/boards/{boardId}/permissions` 중심 계약은 active contract에서 제거
- 프론트 진입 경로는 유지하되 내부 타입과 API만 V2로 교체

### 2.5.3 Dynamic Registry 전환 시 추가 고려사항

Dynamic Registry로 전환할 경우 migration 자체는 크게 바뀌지 않지만, 아래 사항이 추가된다.

- 기존 Enum 기반 targetType 값이 새 registry에서 유효한지 확인
- registry가 비어 있는 상태에서 migration이 먼저 실행되지 않도록 bootstrap 순서 정의
- 운영 배포 시 "target catalog 등록 -> migration -> 생성 허용" 순서를 문서화

---

# 3. 저장소 및 인프라 (Storage & Infrastructure)

## 3.1 파일 저장 규칙

현재 파일 저장 루트는 `UDMS_STORAGE_DIR`다.

경로 규칙:

```text
{UDMS_STORAGE_DIR}/{targetType}/{targetId}/{documentId}/{fileId}_v{version}{ext}
```

설계 의도:

- target 기준으로 디렉터리를 나눠 운영 추적성을 높인다.
- 동일 문서의 revision별 첨부 상태를 파일명 수준에서 추적 가능하게 한다.
- DB와 파일 시스템의 매핑 규칙을 고정해 migration과 cleanup을 단순화한다.

현재 Dynamic Registry 구현에서는 `targetType` 문자열 자체가 아니라, 등록된 `TargetDescriptor.namespace`가 저장 경로의 기준이 된다.

즉 장기적으로는 아래 규칙으로 해석하는 것이 맞다.

```text
{UDMS_STORAGE_DIR}/{descriptor.namespace}/{targetId}/{documentId}/{fileId}_v{version}{ext}
```

## 3.2 docker-compose 및 환경 변수

현재 compose 기준 반영 내용:

- 환경 변수: `UDMS_STORAGE_DIR`
- 기본 volume: `./storage/udms:/app/data/storage`

하위 호환:

- 백엔드 설정은 `UDMS_UPLOAD_ROOT`도 alias로 허용

## 3.3 파일 lifecycle 계획

현재 구현:

- 업로드
- 다운로드
- attachment delete
- 마지막 storage reference 수 계산

아직 미구현:

- `temp` 영역 운영
- `recycle` 이동 정책
- `archive` 영역 cold storage 정책
- orphan file 정리 배치

---

# 4. 백엔드 코어 서비스 구현 계획

## 4.1 현재 구현 완료 범위

### 4.1.1 문서 엔진

- 문서 생성
- 문서 목록 조회
- 문서 상세 조회
- working copy 생성
- working copy 수정
- publish
- revision 목록 조회
- rollback

### 4.1.2 권한 엔진

- target policy 관리
- document ACL 관리
- external share 생성/삭제
- capabilities projection 반환

### 4.1.3 파일 엔진

- 업로드
- 다운로드
- 삭제
- revision attachment snapshot 갱신

### 4.1.4 lifecycle hook

- `approval-completed`: 문서 잠금
- `parent-deleted`: `cascade | orphan` 처리

### 4.1.5 감사 로그

현재 주요 문서 행위는 `udms_audit_logs`에 append-only 형태로 기록된다.

현재 로그 대상:

- 문서 생성
- working copy 수정
- publish
- rollback
- ACL 변경
- external share 변경
- attachment 변경
- hook 처리

## 4.2 Dynamic Target Registry 전환 계획

현재 백엔드는 `string -> registry lookup` 구조로 1차 전환이 완료되었다. 남은 과제는 disabled target의 실사용 개방과 validator/resolver 확장이다.

### 4.2.1 현재 구조

- app bootstrap에서 fresh `TargetRegistry`를 만들고 `udms` core + `worship` registration 함수를 호출한다.
- schema는 `targetType: str`를 허용하고, 서비스 레이어는 registry 등록 여부로 검증한다.
- `Board`만 `isEnabled=true`이며 실제 parent validation을 수행한다.
- `Approval`, `Worship*`, `Inventory`, `Broadcast`, `Project`, `User`는 registry 등록과 read-path metadata는 반영됐지만 write-disabled 상태다.

### 4.2.2 현재 내부 계약

백엔드 내부 계약:

```python
register_target(target_type: str, descriptor: TargetDescriptor) -> None
unregister_target(target_type: str) -> None  # optional
get_target_descriptor(target_type: str) -> TargetDescriptor
list_registered_targets() -> list[TargetDescriptor]
```

설계 방향:

- schema는 `targetType: str`를 허용한다.
- 유효성 검사는 Enum이 아니라 `registry contains targetType`로 수행한다.
- deep-link 생성은 descriptor의 `deepLinkTemplate`를 사용한다.
- storage namespace도 descriptor의 `namespace`를 사용한다.
- parent validation은 descriptor가 가진 `parentValidator`에 위임한다.
- write path는 descriptor의 `isEnabled`를 확인해 disabled target 생성/수정/정책 저장을 차단한다.

### 4.2.3 공개 API

현재 API:

- `GET /api/v1/udms/target-types`

역할:

- 등록된 target 목록과 enabled 상태 제공
- 프론트 selector 구성
- deep-link / label / namespace 메타데이터 제공

### 4.2.4 현재 호환성 및 정책

- 기존 문서의 targetType 값은 유지 가능해야 한다.
- bootstrap 시 registry 등록이 완료된 뒤 request validation이 동작해야 한다.
- 미등록 targetType은 `409`로 명확한 에러를 반환한다.
- disabled targetType은 read/list/hook에서는 허용하고, create/update/policy save에서는 `409`로 차단한다.

## 4.3 현재 구현의 한계와 다음 단계

### 4.3.1 검색

현재 검색은 `GET /docs?q=`로 title, summary, tags를 단순 contains 방식으로 필터링한다.  
전용 검색 엔드포인트와 relevance 정렬, 인덱스 전략은 아직 없다.

### 4.3.2 target validation

현재는 `Board`만 실제 board 존재 여부를 검증한다.  
나머지 target은 registry만 있고 parent entity 검증은 TODO다.

### 4.3.3 external share public access

현재 external share는 생성/삭제와 목록 노출만 된다.  
token으로 익명 접근하는 public read/download API는 아직 없다.

### 4.3.4 audit log viewer

현재 audit log는 쌓이지만 조회 API와 관리자 모니터링 화면은 아직 없다.

---

# 5. 프론트엔드 공통 위젯 및 화면 구현 계획

## 5.1 현재 반영된 공용 컴포넌트

- `DocumentEditor`
- `DocumentViewer`
- `AttachmentManager`
- `VersionBrowser`
- `AclManager`
- `ExternalShareManager`
- `DocumentContainer`

현재 구조는 "문서 기능은 공용 위젯으로 빼고, 각 모듈 화면은 context만 전달한다"는 방향에 맞춰져 있다.

## 5.2 현재 반영된 주요 화면

### 5.2.1 `/udms/documents`

- targetType / targetId / status / q 필터
- summary projection 기반 목록
- V2 문서 상세로 이동

### 5.2.2 `/udms/documents/[documentId]`

- visible revision 렌더링
- publish / working copy 생성
- attachment 관리
- ACL 관리
- external share 관리
- revision history / rollback

### 5.2.3 `/udms/documents/[documentId]/edit`

- working revision 중심 편집
- target/link/moduleData 수정
- Approval일 경우 template를 `moduleData.approval.templateId`로 저장

### 5.2.4 `/udms/shares`

- ACL을 통해 접근 가능한 문서 목록
- 문서에 발급된 external share 링크 목록

### 5.2.5 `/udms/permissions`

- `TargetPolicyRule` 기반 정책 관리
- 현재는 master 전용

### 5.2.6 모듈 컨텍스트 화면

- `/udms/boards`
- `/udms/approvals`
- `/worship/orders`
- `/worship/contents`
- `/worship/subtitles/input`
- `/worship/subtitles/output`

현재 이 화면들은 `DocumentContainer(targetType, targetId)` 패턴으로 V2 엔진과 연결된다.

## 5.3 프론트 target selector의 현재 구조

현재 프론트는 고정 selector를 제거하고 아래 방식으로 target을 처리한다.

- `DocumentTargetType = string`
- `GET /api/v1/udms/target-types`
- `useTargetCatalog()` 공용 hook

현재 효과:

- 새 target의 label/deep-link/enabled 상태를 백엔드 catalog에서 직접 받는다.
- 문서 생성/목록/권한 화면은 enabled target만 selector에 노출한다.
- 현재 정책상 `Board`만 selector에 나타난다.

## 5.4 현재 반영된 Dynamic Registry 기반 프론트 구조

현재 구조:

- 프론트는 시작 시점 또는 화면 진입 시 `GET /api/v1/udms/target-types`를 호출한다.
- 문서 생성 화면은 응답 기반으로 target selector를 렌더링한다.
- 권한 화면도 동일한 catalog를 사용한다.
- `/udms/documents` 필터 화면도 동일한 catalog를 사용한다.
- `DocumentContainer(targetType, targetId)`는 target metadata를 받아 label, deep-link, title hint 후보를 표시한다.
- `DocumentTargetType`는 고정 union type이 아니라 registry-fed string domain으로 전환되었다.

남은 한계:

- disabled target은 read-only context metadata만 있고, 실제 parent detail 화면과의 구체적 연결은 아직 약하다.
- `documentTitleHint`는 catalog에 포함되지만 UI 활용은 아직 초기 단계다.

## 5.5 프론트엔드 다음 단계

- revision diff UI
- drag-and-drop / 다중 파일 업로드
- saved filter / paging / sort
- audit viewer
- target type별 더 구체적인 컨텍스트 화면
- target catalog metadata 활용 확대 (`documentTitleHint`, disabled target context fallback)

---

# 6. 마이그레이션 및 컷오버 계획

## 6.1 데이터 이관 절차

1. legacy documents를 `origin_doc_id` 기준으로 그룹화
2. 각 체인을 revision snapshot 집합으로 변환
3. latest published / latest draft를 계산해 root pointer 설정
4. legacy shares를 ACL rule로 변환
5. legacy board permissions를 Board target policy로 변환
6. legacy attachment를 revision attachment로 변환
7. migration 성공 후 legacy share/permission/attachment 컬렉션 정리

## 6.2 운영 컷오버 원칙

- URL은 유지하고 내부 계약만 전환
- 새 기준 env는 `UDMS_STORAGE_DIR`
- migration은 앱 초기화 시 자동 실행 가능하지만, 운영에서는 dry-run 문서화가 필요

## 6.3 Dynamic Registry 전환 시 추가 컷오버 포인트

- registry bootstrap 순서 정의
- target catalog API 배포
- 프론트 selector 하드코딩 제거
- 미등록 targetType graceful error 정책 확정

## 6.4 주의사항

- legacy 데이터가 큰 경우 자동 migration만으로는 운영 리스크가 있다.
- 운영 기준 dry-run, 백업, 롤백 절차 문서가 추가로 필요하다.

---

# 7. 테스트 및 검증 계획

## 7.1 현재 통과한 검증

- `python -m pytest`
- `npm.cmd run typecheck`
- `npm.cmd run build`

현재 포함된 테스트 범위:

- OAuth / onboarding / admin activation 흐름
- editor의 문서 생성 / publish / working copy / update / lock
- member의 read/create 제한
- legacy V1 -> V2 migration

## 7.2 추가 검증이 필요한 영역

- external share 만료 / 다운로드 제한
- parent-deleted `cascade | orphan`
- target별 parent validation
- attachment lifecycle과 namespace
- audit log 적재
- deny 우선 ACL 세분화
- `GET /api/v1/udms/target-types` catalog 일관성
- 미등록 targetType 에러 처리

---

# 8. 단계별 구현 로드맵

## 8.1 Phase 1: V2 코어 전환

목표:

- V1 계약 제거
- root/revision/ACL/policy 구조 도입
- 문서 CRUD와 draft/published 분리 완료

현재 상태:

- 완료

산출물:

- V2 schema
- V2 repository / service
- V2 router
- V2 frontend types / pages

## 8.2 Phase 2: Dynamic Target Registry 전환

목표:

- targetType Enum 제거
- registry 기반 문자열 검증
- `GET /api/v1/udms/target-types` 추가
- 프론트 selector 동적화
- target별 parent resolver 분리

현재 상태:

- 1차 구현 완료
- `Board`만 write-enabled, 나머지 target은 disabled/read-only metadata 상태

산출물:

- registry registration 계약
- target catalog API
- 프론트 동적 target selector
- bootstrap registration wiring

## 8.3 Phase 3: 모듈 연결 확장

목표:

- Approval / Worship / 기타 target의 실제 parent contract 연결
- public external share
- 검색 고도화
- audit viewer

현재 상태:

- 진행 전

## 8.4 Phase 4: 운영 안정화

목표:

- archive / recycle / temp lifecycle 완성
- migration dry-run / rollback 문서화
- 운영 스토리지 정책 확정
- 보안/감사 UI 보강

현재 상태:

- 진행 전

---

# 9. 상세 TODO

아래 TODO는 "무엇이 비어 있는가"만 적는 것이 아니라 "왜 필요한가"와 "어떤 방향으로 구현할 것인가"를 함께 적는다.

## 9.1 백엔드 TODO

- [x] `TargetRegistry`를 Enum 의존 구조에서 분리
  `DocumentTargetType Enum + TARGET_REGISTRY` 조합을 제거하고, app bootstrap 시점의 `TargetRegistry` + `register_target(target_type, descriptor)` 구조로 전환했다.

- [x] `GET /api/v1/udms/target-types` 추가
  프론트가 target selector를 동적으로 구성할 수 있도록 target catalog API를 추가했다. 응답에는 `targetType`, `label`, `namespace`, `deepLinkTemplate`, `requiresExistingParent`, `documentTitleHint`, `isEnabled`가 포함된다.

- [x] `targetType` 검증을 Enum이 아닌 registry lookup으로 전환
  schema는 `str`를 허용하고, 서비스 레이어는 "등록된 target인가"를 registry 기준으로 검증한다. 미등록 targetType은 `409`로 반환한다.

- [x] deep-link 생성 로직을 descriptor 기반으로 전환
  고정 mapping 함수 대신 descriptor의 `deepLinkTemplate`를 사용해 deep-link를 계산하도록 바꿨다.

- [ ] Board 외 target parent validation 구현
  현재 `Board`만 실제 존재 검증을 수행한다. Approval, Worship, Inventory, Broadcast, Project, User도 `parentValidator` 계약을 통해 존재 여부를 확인해야 한다.

- [x] `policyResolver` 계약 도입
  descriptor 수준에서 `policyResolver` 메타데이터 계약을 도입했다. 다만 실제 target별 상속 권한 계산을 resolver로 위임하는 로직은 후속 과제다.

- [ ] 전용 검색 엔드포인트 분리
  현재는 `GET /docs?q=`에서 title/summary/tags 단순 필터만 수행한다. V2 계획에 맞게 `/docs/search` 또는 별도 `/search` 엔드포인트를 두고, Mongo text index 또는 별도 검색 전략을 연결해야 한다.

- [ ] public external share read/download API 추가
  현재 token은 생성되지만 외부 사용자가 token으로 문서를 읽는 API는 없다. 만료 시각, 다운로드 허용 여부, 감사 로그까지 포함한 public endpoint가 필요하다.

- [ ] external share revoke/expiry 정책 강화
  단순 create/delete를 넘어, 만료된 링크 차단, 재발급, 수동 revoke 이력, 접속 횟수 기록 등을 추가해야 한다.

- [ ] audit log 조회 API 추가
  현재 `udms_audit_logs`는 append-only로 쌓이지만, 관리자나 문서 상세 UI에서 볼 수 있는 API가 없다. `GET /docs/{documentId}/audit` 또는 `/audit` 계열 엔드포인트가 필요하다.

- [ ] archive / recycle / temp 스토리지 정책 구현
  현재 저장 경로만 표준화되어 있다. 삭제 시 recycle 이동, 보관 문서 archive 이동, 임시 업로드 temp cleanup 배치를 실제 로직으로 만들어야 한다.

- [ ] orphan 문서 처리 모델 정교화
  현재 `orphan` 정책은 `targetId`를 `orphan:{targetId}`로 치환하고 deep-link를 목록으로 돌린다. orphan 상태를 UI와 운영 문서에서 더 명확히 식별할 수 있게 별도 필드 또는 규칙이 필요하다.

- [ ] 운영용 migration dry-run 분리
  현재 migration은 repository 초기화에 녹아 있다. 운영에서는 사전 검증과 보고서 출력을 위해 별도 dry-run 스크립트 또는 management command가 필요하다.

## 9.2 프론트엔드 TODO

- [x] `targetTypeOptions` 하드코딩 제거
  고정 배열을 제거하고 target catalog API 기반 selector로 전환했다.

- [x] `DocumentTargetType`를 registry-fed string domain으로 점진 전환
  `DocumentTargetType`는 고정 union type이 아니라 `string` 기반 domain으로 바뀌었다.

- [x] `/udms/documents`에 dynamic target selector 반영
  목록 필터 화면은 `GET /api/v1/udms/target-types` 응답을 사용해 활성 target만 보여준다.

- [x] `/udms/permissions`에 dynamic target selector 반영
  권한 관리 화면도 같은 catalog를 사용해 target 선택지를 구성한다.

- [x] `DocumentContainer(targetType, targetId)`에 registry metadata 사용
  `DocumentContainer`와 일부 상세/공유 화면은 catalog 기반 label/deep-link fallback을 사용한다.

- [ ] 문서 목록 UX 고도화
  현재 `/udms/documents`는 기본 필터만 있다. saved filter, sorting, paging, 최근 본 문서, 상태별 badge 등 실사용 UX를 보강해야 한다.

- [ ] revision diff UI 추가
  현재 history는 버전 목록과 rollback만 제공한다. `publishedRevision`과 `workingRevision`, 혹은 임의의 두 revision 간 diff 비교 화면이 필요하다.

- [ ] audit viewer UI 추가
  문서 상세나 관리자 화면에서 누가 언제 publish/rollback/security change를 했는지 확인할 수 있어야 한다.

- [ ] attachment UX 개선
  drag-and-drop, 다중 업로드, 업로드 progress, 파일 타입 아이콘, 미리보기 기능을 추가해야 한다.

- [ ] external share 화면 개선
  token 복사, 만료 여부, 다운로드 허용 여부, 접속 통계, revoke 상태 등을 더 직관적으로 보여줘야 한다.

- [ ] 실제 parent detail 화면 연결
  현재 `DocumentContainer`는 일부 화면에서 빈 `targetId` 목록 뷰 형태로만 사용된다. 실제 Approval 상세, Worship 상세, Project 상세 같은 parent detail 화면에 직접 연결해야 한다.

- [ ] Inventory / Broadcast / Project / User 진입 화면 추가
  registry에는 있지만 실제 사용자 화면과 문서 연동 흐름은 아직 없다.

## 9.3 Approval / 업무 연동 TODO

- [ ] Approval 실제 상태 엔진과 UDMS lifecycle 계약 확정
  현재는 `approval-completed -> locked` 훅만 있다. 승인, 반려, 재상신, 재검토 등 세부 상태와 문서 상태 전이를 더 구체화해야 한다.

- [ ] approval template 관리 화면 추가
  현재 template는 조회만 가능하다. 관리자용 CRUD와 활성/비활성 정책이 필요하다.

- [ ] 다단 결재 UI 및 결재선 연동
  현재 V2 코어는 문서 엔진 수준까지만 다뤘다. 결재선, confirm task, 승인/반려 액션은 별도 모듈 연동이 필요하다.

- [ ] approval hook 호출 권한과 호출 주체 명문화
  현재 훅은 API로 존재하지만 운영 기준에서는 누가, 언제, 어떤 인증으로 호출하는지 계약이 더 필요하다.

## 9.4 테스트 TODO

- [ ] external share 만료/다운로드 제한 테스트 추가
- [ ] parent-deleted `cascade | orphan` 테스트 강화
- [ ] target type별 parent validation 테스트 추가
- [x] target catalog API 응답 테스트 추가
- [x] 미등록 targetType graceful error 테스트 추가
- [ ] attachment namespace / file reuse / last ref cleanup 테스트 추가
- [ ] deny 우선 ACL 테스트 세분화
- [ ] audit log 적재 검증 테스트 추가
- [ ] 실제 Mongo fixture 기반 migration 회귀 확대

## 9.5 운영 / 문서 TODO

- [x] 모듈별 bootstrap registration 규약 문서화
  본 문서의 `2.2.6`, `4.2`, `8.2`에 app bootstrap -> module registration 흐름과 현재 registration 정책을 반영했다.

- [ ] 운영 migration 체크리스트 문서화
  백업, dry-run, 실제 실행, 결과 확인, legacy collection 정리 절차를 운영 문서로 분리해야 한다.

- [ ] 롤백 체크리스트 문서화
  migration 실패나 cutover 문제 발생 시 어떤 순서로 복구할지 문서가 필요하다.

- [ ] `UDMS_STORAGE_DIR` 운영 스토리지 가이드 보강
  NAS 또는 외부 스토리지와 연결할 때 권한, 백업, snapshot, 용량 모니터링 기준을 정리해야 한다.

- [ ] targetType별 ownership / deep-link 정책 문서화
  개발자와 운영자가 같은 기준으로 target를 다룰 수 있도록 parent ownership과 딥링크 규칙을 명시해야 한다.

---

# 10. 요약

Nanoom ERP의 UDMS는 현재 V2의 핵심 전환을 이미 완료했다.  
즉, 문서는 더 이상 게시판 row의 변형이 아니라 독립적인 `document root`가 되었고, revision은 immutable snapshot으로 누적되며, 권한은 `target policy + document ACL` 구조로 정리되었다.

또한 `targetType` 확장 구조는 Enum 기반 강결합에서 bootstrap 기반 `Dynamic Target Registry`로 1차 전환이 완료되었다.  
따라서 이제 모듈 확장의 기준은 "문서에 targetType 문자열을 적는 것"이 아니라, "registry에 target을 등록하고 해당 target의 parent/policy/UI 계약을 함께 준비하는 것"이다.

다음 단계의 핵심은 아래와 같다.

- Board 외 target의 실제 parent validator 확장
- disabled target의 단계적 write enable 전환
- target별 parent resolver 분리
- public external share
- 검색 엔진 고도화
- audit viewer
- archive/recycle/temp lifecycle
- Approval 실제 워크플로우 연동

이 문서는 앞으로 V2의 세부 구현 우선순위를 정하는 기준 문서로 계속 유지한다.
