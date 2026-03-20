# UDMS V1 구현 기준

이 문서는 현재 코드베이스에 반영된 UDMS V1 구현 기준을 정리한다.  
상위 라우팅과 셸 구조는 [layout.md](layout.md), 시스템 구조는 [architecture.md](architecture.md), 운영 기준은 [operations.md](operations.md)를 따른다.

## 1. 구현 범위

- Mongo 기반 `UDMS repository + service` 계층을 사용한다.
- 문서는 `linked versioning` 방식으로 관리한다.
- 첨부 파일은 실제 파일 업로드와 다운로드를 지원한다.
- 보드 권한과 문서 공유를 분리한다.
- 결재는 이번 단계에서 `approval_template_id` 저장과 템플릿 조회까지만 구현한다.

제외 범위:

- 실제 다단 결재 엔진
- 승인/반려 액션
- 결재 이력 상태 머신

## 2. 데이터 모델

### 2.1 Boards

- `id`
- `name`
- `description`
- `is_active`
- `created_at`
- `updated_at`

### 2.2 Documents

- `id`
- `origin_doc_id`
- `prev_doc_id`
- `version_number`
- `board_id`
- `title`
- `content`
- `status`: `draft | published | superseded`
- `approval_template_id`
- `created_by`
- `updated_by`
- `created_at`
- `updated_at`

규칙:

- 신규 문서는 항상 `draft`로 생성한다.
- 첫 문서는 `origin_doc_id=self`, `prev_doc_id=null`, `version_number=1`이다.
- 게시된 문서에서만 새 버전을 생성할 수 있다.
- 새 버전 생성 시 이전 문서의 본문, 템플릿, shares, attachment rows를 복제한다.

### 2.3 Shares

- `id`
- `doc_id`
- `target_type`: `user | department`
- `target_id`
- `permission`: `read | edit`
- `created_by`
- `created_at`
- `updated_at`

규칙:

- 문서 share는 문서 작성자와 `master`가 관리한다.
- 새 버전 생성 시 share 레코드를 새 `doc_id`로 복제한다.

### 2.4 Attachments

- `id`
- `doc_id`
- `storage_key`
- `file_name`
- `mime_type`
- `size_bytes`
- `created_by`
- `created_at`
- `updated_at`

규칙:

- 실제 파일은 `UDMS_UPLOAD_ROOT` 아래에 저장한다.
- 새 버전 생성 시 파일 자체는 복사하지 않고, attachment row만 복제해 같은 `storage_key`를 참조한다.
- 마지막 참조 row가 삭제될 때만 물리 파일을 제거한다.

### 2.5 Board Permissions

- `id`
- `board_id`
- `subject_type`: `role | department | user`
- `subject_id`
- `actions`: `read | create | manage`
- `created_at`
- `updated_at`

규칙:

- `master`는 모든 보드에 대해 우회 접근한다.
- `manage`는 `read/create`를 포함한다.
- `member`, `final_approver`는 기본적으로 `read` 권한만 가진다.

### 2.6 Approval Templates

- `id`
- `name`
- `description`
- `is_active`
- `created_at`
- `updated_at`

현재는 seed 데이터만 제공하고 읽기 전용으로 사용한다.

## 3. 문서 상태 흐름

### 3.1 생성

1. 사용자가 보드, 제목, 결재 템플릿, 본문을 입력한다.
2. 서비스는 본문 HTML을 sanitize한 뒤 `draft` 문서를 생성한다.
3. 문서 상세 화면으로 이동한다.

### 3.2 게시

1. 작성자 또는 `master`가 `draft` 문서를 게시한다.
2. 해당 체인의 기존 `published` 문서는 `superseded`로 전환된다.
3. 현재 문서는 `published`가 된다.

### 3.3 새 버전 생성

1. 작성자 또는 `master`가 `published` 문서에서 `새 버전 생성`을 실행한다.
2. 새 문서가 `draft`로 생성된다.
3. `prev_doc_id`, `origin_doc_id`, `version_number`가 연결된다.
4. shares와 attachment rows가 복제된다.

## 4. API 계약

모든 경로는 `/api/v1/udms` 하위에 위치한다.

### 4.1 Boards

- `GET /boards`
- `POST /boards`
- `GET /boards/{boardId}`
- `PUT /boards/{boardId}`

### 4.2 Documents

- `GET /documents?boardId=&status=&q=`
- `POST /documents`
- `GET /documents/{documentId}`
- `PUT /documents/{documentId}`
- `POST /documents/{documentId}/publish`
- `POST /documents/{documentId}/versions`
- `GET /documents/{documentId}/versions`

### 4.3 Shares

- `GET /shares`
- `GET /documents/{documentId}/shares`
- `PUT /documents/{documentId}/shares`

### 4.4 Attachments

- `POST /documents/{documentId}/attachments`
- `GET /attachments/{attachmentId}/download`
- `DELETE /attachments/{attachmentId}`

### 4.5 Policies / Templates

- `GET /permissions`
- `PUT /boards/{boardId}/permissions`
- `GET /approval-templates`

## 5. 화면 기준

### 5.1 `/udms/documents`

- 보드 필터
- 상태 필터
- 검색
- 문서 목록
- `새 문서` 액션

### 5.2 `/udms/documents/new`

- 제목 입력
- 보드 선택
- 결재 템플릿 선택
- TipTap 본문 편집

### 5.3 `/udms/documents/[documentId]`

- 문서 메타 정보
- 본문 출력
- 게시 액션
- 새 버전 생성 액션
- 첨부 업로드 / 다운로드 / 삭제
- 공유 설정 편집
- 버전 히스토리

### 5.4 `/udms/documents/[documentId]/edit`

- draft 전용 편집 화면
- 문서 메타와 본문 수정

### 5.5 `/udms/shares`

- 공유받은 문서 목록
- 내가 공유한 문서 목록

### 5.6 `/udms/approvals`

- 활성 결재 템플릿 목록
- 템플릿이 연결된 문서 목록
- 실제 승인 엔진은 후속 단계임을 명시

### 5.7 `/udms/permissions`

- 보드 선택
- 권한 규칙 편집
- `role | department | user` 기준 정책 저장

## 6. 운영 기준

- 백엔드 환경 변수:
  - `UDMS_UPLOAD_ROOT`
  - `UDMS_MAX_UPLOAD_BYTES`
- 로컬 `docker-compose` 기본 마운트:
  - `./storage/uploads:/app/data/uploads`
- 운영 환경에서는 호스트 경로를 NAS 경로로 교체한다.

## 7. 검증 기준

- `python -m pytest`
- `npm.cmd run typecheck`
- `npm.cmd run build`

핵심 시나리오:

- `editor`가 문서를 생성하고 게시한 뒤 새 버전을 만든다.
- 새 버전에서 `prev_doc_id`, `origin_doc_id`, `version_number`가 올바르게 유지된다.
- share가 새 버전에 자동 복제된다.
- `member`는 읽기만 가능하고 보드 `create` 권한이 없으면 문서를 만들 수 없다.
- 첨부는 다운로드 가능하며 삭제 시 참조 수에 따라 파일이 정리된다.

## 8. TODO 상태

- [x] Mongo 기반 UDMS repository / service 계층 추가
- [x] 보드, 문서, 공유, 첨부, 보드 권한, 결재 템플릿 스키마 반영
- [x] linked versioning 생성 / 게시 / 히스토리 로직 구현
- [x] 보드 권한 평가와 문서 share 평가 로직 구현
- [x] 실제 첨부 업로드 / 다운로드 / 삭제 구현
- [x] `approval_template_id`와 `GET /approval-templates` 반영
- [x] board-level permissions API로 교체
- [x] `/udms/documents` 목록, 상세, 생성, 편집 화면 구현
- [x] TipTap 에디터 반영
- [x] `/udms/shares`, `/udms/approvals`, `/udms/permissions` 구현
- [x] 관리자 게시판 화면을 새 권한 구조와 정합되게 갱신
- [x] 기본 backend/frontend 검증 통과
- [ ] 첨부 업로드 / 다운로드 / 파일 정리까지 포함하는 추가 pytest 보강
- [ ] 결재 템플릿 관리용 관리자 화면
- [ ] 실제 결재 단계 / 승인자 액션 / 상태 전이 구현
