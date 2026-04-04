# 리팩토링 로드맵: Pocket Canvas

## 1단계: 도구 및 유틸리티 함수 분리 (현재 진행 중)
- `canvas.tsx` 내의 수학적 계산 및 충돌 판정 로직을 `src/lib/canvas-utils.ts`로 추출
- `useCanvas` 훅의 책임 명확화 (캔버스 초기화 및 리사이즈 전담)

## 2단계: 관심사 기반 커스텀 훅 분리
- `useInteraction.ts`: 마우스/터치 이벤트 핸들링 (MouseDown, Move, Up) 로직 집중
- `useHistory.ts`: Undo/Redo 관련 로직 분리 (Zundo 활용 극대화)
- `useSelection.ts`: 객체 선택 및 그룹화 로직 분리

## 3단계: 컴포넌트 원자화 (Atomic Components)
- `Canvas.tsx`를 렌더링 레이어만 담당하게 축소
- `MemoElement.tsx`, `ShapeElement.tsx`, `ImageElement.tsx` 등으로 개별 객체 컴포넌트화
- 각 요소가 자신의 Zustand 상태만 구독하도록 최적화 (Selective Subscription)

## 4단계: 렌더링 엔진 최적화
- `requestAnimationFrame` 루프를 React 생명주기에서 분리된 외부 클래스/함수로 관리
- 오프스크린 캔버스(Offscreen Canvas) 도입 고려 (대량의 선/도형 렌더링 성능 확보)
