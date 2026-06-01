# Manager 클래스들

> 데이터 계층의 핵심 매니저들의 역할 분담 요약. 함수 이름과 책임만 적는다. 상세 시그니처는 [[클래스_함수_사전]] 참고.

관련 문서: [[클래스_함수_사전]], [[Archive/Pygame/05_코드구조/AI_연동]], [[UI_구조]]

---

## UserManager

- 회원가입/로그인/로그아웃, 비밀번호 변경, 닉네임 변경.
- 현재 세션 사용자 보유.
- 키: `signup`, `login`, `logout`, `change_password`, `rename`, `delete_account`, `current`, `list_users`.

## PlantManager

- 식물 CRUD와 매칭.
- 키: `create`, `get`, `list`, `update`, `delete`, `find_matches`, `increment_harvest`, `increment_rot`, `mark_dormant`.

## BudManager

- 봉우리 CRUD, 상태/진행률/마감일 변경, 포기/수확.
- 키: `create`, `get`, `list`, `update_status`, `update_progress`, `set_deadline`, `abandon`, `harvest`, `mark_wilting`, `purge_disappeared`.

## GardenStateManager

- 정원 요약 캐시 관리, 통계 계산, 오늘의 브리핑 빌더.
- 키: `refresh_summary`, `get_summary`, `compute_stats`, `build_briefing`, `mark_opened`.

## ConversationManager

- 대화 로그 누적/조회/검색/삭제.
- 키: `append`, `get_history`, `search`, `clear`.

## NotificationQueue

- 자발 발화/알림 큐 관리.
- 키: `push`, `pop_all`, `recompute_deadlines`, `recompute_wilting`.

## StateTransitionEngine

- 시간 기반 자동 상태 전이.
- 키: `scan`, `check_wilting`, `check_rot_disappear`, `check_deadlines`.

## BackupManager

- 백업/복구/스냅샷.
- 키: `export_zip`, `import_zip`, `make_snapshot`, `restore_snapshot`, `list_snapshots`.

---

매니저들은 [[클래스_함수_사전#PathResolver]]와 [[클래스_함수_사전#FileStore]]에 공통 의존한다. 매니저 간 직접 호출은 최소화하고, 필요한 경우 [[App]]이 중재한다.
