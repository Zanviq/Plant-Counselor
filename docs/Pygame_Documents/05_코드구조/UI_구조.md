# UI 구조

> pygame 기반 화면 구성과 위젯의 책임 분담.

관련 문서: [[홈]], [[식물]], [[설정]], [[공통_AI대화창]], [[클래스_함수_사전]], [[디자인_시스템]], [[픽셀_에셋]]

> 시각 토큰과 컴포넌트 명세는 모두 [[디자인_시스템]]에 분리되어 있다. 이 문서는 Scene과 위젯 트리의 코드 구조만 다룬다.

---

## App 진입점

- [[클래스_함수_사전#App]]가 pygame 초기화, 매니저 인스턴스 생성, [[클래스_함수_사전#SceneManager]] 시작.

## SceneManager

- 현재 Scene을 보유. `switch_scene(name, params)`로 전환.
- 화면 스택을 두지 않고 직접 전환. 모달은 별도 오버레이로 처리.

## Scene 종류

- [[클래스_함수_사전#LoginScene]] — 로그인/회원가입
- [[클래스_함수_사전#HomeScene]] — [[홈]]
- [[클래스_함수_사전#PlantsScene]] — [[식물]] 목록
- [[클래스_함수_사전#PlantDetailScene]] — 식물 상세
- [[클래스_함수_사전#SettingsScene]] — [[설정]]

## 공통 오버레이

- [[클래스_함수_사전#ChatWidget]] — [[공통_AI대화창]]. 어느 Scene 위에서도 열림.
- [[클래스_함수_사전#ToastWidget]] — 알림 토스트.
- [[클래스_함수_사전#ModalWidget]] — 확인 모달.

## 위젯 트리(요점)

- HomeScene
  - SummaryCardsRow
  - BriefingPanel
  - PlantBoard(grid of PlantCard)
  - CalendarWidget(요일 행 + ScheduleLine들)
  - WiltingSection(grid of WiltingCard)
- PlantsScene
  - GardenLayout
    - GrassFloor
    - PlantWidget × N (정원 한 그루 = 화분 + 합성 식물)
    - PlantLabel × N (식물 아래 라벨 카드)
- PlantDetailScene
  - PlantHeader
  - PlantStage(displays BudWidgets on the plant)
  - BudDetailPanel
- SettingsScene
  - TabList
  - FormCard(섹션별)

## 테마와 사운드

- [[클래스_함수_사전#ThemeManager]] — 계절/야간 테마, 컬러 팔레트.
- [[클래스_함수_사전#SoundManager]] — 효과음/BGM.

## 입력 처리

- 모든 키보드/마우스 이벤트는 SceneManager가 가장 위 활성 오버레이(있으면)에 우선 전달.
- ChatWidget이 활성일 때 단축키 가로채기.

---

## 화면 흐름 다이어그램

```
LoginScene → HomeScene ⇄ PlantsScene ⇄ PlantDetailScene
                  ↕              ↕              ↕
              SettingsScene (어디서든 진입 가능)
              ChatWidget 오버레이 (어디서든 호출)
```
