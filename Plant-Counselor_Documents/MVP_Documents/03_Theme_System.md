# 03. 테마 시스템

Plant Counselor의 테마는 **두 축**을 가집니다.

| 축 | 옵션 | 데이터 속성 |
|----|------|-------------|
| 모드 | light · dark · system | `data-theme="light"` 또는 `"dark"` |
| 강조색 | emerald · sapphire · violet · sunset | `data-accent="<key>"` (emerald은 미설정) |

두 속성은 `<html>` 루트에 부여되며, CSS는 attribute 셀렉터로 토큰을 덮어씁니다.

## 1. 토큰 (`app/globals.css`)

### 1.1 코어 토큰 (light)

- **표면**: `--bg`, `--bg-elevated`, `--bg-subtle`, `--bg-muted`, `--bg-hover`
- **테두리**: `--border`, `--border-strong`
- **텍스트**: `--fg`, `--fg-secondary`, `--fg-muted`, `--fg-subtle`, `--fg-inverse`
- **강조**: `--accent`, `--accent-hover`, `--accent-soft`, `--accent-muted`, `--accent-fg`, `--accent-contrast`
- **시맨틱**: `--positive`, `--warning`, `--danger`, `--info`
- **상태(봉우리)**: `--st-seed`, `--st-bud`, `--st-flower`, `--st-fruit`, `--st-harvest`, `--st-wilting`, `--st-rot`
- **shadow**: xs/sm/md/lg (모두 검정 기반, alpha 다름)
- **radius**: xs(4) sm(6) md(8) lg(12) xl(16) pill(999)

### 1.2 다크 모드 오버라이드

`[data-theme="dark"] { ... }` 블록이 같은 변수를 어두운 값으로 재선언. `color-scheme: dark` 도 함께 설정해 폼 컨트롤·스크롤바도 어두운 톤이 됩니다.

### 1.3 강조색 오버라이드

```css
[data-accent="sapphire"]            { --accent: #2563EB; ... }
[data-theme="dark"][data-accent="sapphire"] { --accent: #3B82F6; ... }
```

라이트/다크 각각에 대해 강조색을 별도로 정의해, **다크에서 좀 더 밝게**·**라이트에서 좀 더 짙게** 자연스럽게 보이도록 합니다.

## 2. 적용 메커니즘

### 2.1 Pre-hydration paint (`public/theme-init.js`)

`public/theme-init.js` 가 다음을 수행:

1. `localStorage["pc-theme"]` 에서 저장된 mode/accent를 읽고
2. mode가 system이면 `matchMedia("(prefers-color-scheme: dark)")` 로 해석
3. `document.documentElement` 에 `data-theme` / `data-accent` 속성 부여

- **언제**: HTML `<head>`에서 `<Script strategy="beforeInteractive">`로 React 마운트 전에 실행.
- **왜**: React 렌더 이전에 속성을 박아넣어야 첫 페인트에서 깜빡임(FOUC)이 없음.
- **보안**: 인라인 스크립트 주입 방식을 피하고 `/public` 의 정적 파일을 외부 스크립트로 로드 — 사용자 입력이 끼어들 여지 자체가 없어 안전.

### 2.2 Zustand store (`lib/store/themeStore.ts`)

- **persist 미들웨어**: `localStorage["pc-theme"]` 에 `{mode, accent, resolved}` 저장.
- **`setMode(m)` / `setAccent(a)`**: 즉시 DOM 속성 반영 + 스토어 갱신.
- **`apply()`**: 마운트 시 1회 호출 — store와 DOM을 동기화 (저장된 모드가 system인 경우 OS 상태로 재해석).
- **`attachThemeListener()`**: `prefers-color-scheme` change 이벤트 구독. `mode === "system"` 일 때만 재적용.

### 2.3 React 부트스트랩 (`app/providers.tsx`)

```tsx
useEffect(() => {
  apply();
  return attachThemeListener();
}, [apply]);
```

QueryClient와 함께 1회 마운트되어 테마 listener를 부착합니다. 페이지 라우팅 사이엔 재실행되지 않습니다.

## 3. 사용 가이드

### 컴포넌트에서

```tsx
<div style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)" }} />
```

또는 클래스 프리미티브 활용:

```tsx
<div className="card card-hover">...</div>
<button className="btn btn-primary btn-sm">저장</button>
<span className="pill pill-flower"><span className="pill-dot" />꽃</span>
```

### 새 컴포넌트를 만들 때

1. 직접 hex 값 쓰지 말 것 — 항상 `var(--*)` 사용.
2. 강조색이 필요한 자리에는 `var(--accent)` 와 `var(--accent-contrast)` (글자색) 같이 사용.
3. 상태 색은 `STATUS_COLOR_VAR[status]` 또는 `pill pill-<status>` 클래스로 통일.

## 4. 검증

- `mvp-home-light.png` — 라이트 + emerald
- `mvp-home-dark-sapphire.png` — 다크 + sapphire (홈 모든 영역이 자연스럽게 변경됨)
- `mvp-settings-theme.png` — 테마 탭 UI

사용자 시각 테스트(시스템 테스트 7장 `UI-1` ~ `UI-4`)와 함께 회귀 검증 권장.
