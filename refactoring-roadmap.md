# Pocket 개선 목표: 저RAM 무한 화이트보드

Pocket의 핵심 정체성은 "Figma/FigJam보다 RAM을 적게 쓰는 무한 화이트보드 웹앱"이다.
기능 추가보다 오래 열어두어도 가벼운 데이터 구조, 렌더링, 저장 흐름을 우선한다.

## 우선순위 높음

1. [x] Canvas 데이터 구조 최적화
   - `strokes`, `memos`, `images`, `shapes` 전체 배열 중심 구조를 viewport/chunk 기반으로 발전시킨다.
   - [x] 도형, 메모, 이미지 hit test/selection에 grid spatial index를 도입한다.
   - [x] stroke bounds를 저장 데이터에 캐시한다.
   - [x] stroke 렌더링/선택 후보를 spatial index로 줄인다.
   - [x] chunk 기반 그룹화/복원 유틸을 추가한다.
   - [x] DB 저장을 chunk 단위로 분리한다.
2. [x] Undo/Redo 메모리 제한
   - 전체 상태 스냅샷 대신 operation 기반 history로 전환한다.
   - [x] 최대 history 개수 제한을 둔다.
   - [x] 변경된 slice만 history에 저장한다.
   - [x] 최대 메모리 사용량 기준을 둔다.
   - [x] operation 기반 history 모델과 측정 기준을 추가한다.
   - [x] store undo/redo 적용 경로를 operation 기반으로 전환한다.
3. [x] 이미지 저장 방식 개선
   - base64 data URL을 캔버스 JSON에 직접 보관하지 않는다.
   - [x] 업로드 이미지를 저장 전에 webp로 리사이즈/압축한다.
   - [x] 이미지 본문은 asset 파일로 분리하고, 캔버스에는 URL과 배치 정보만 둔다.
   - [x] 운영 환경용 외부 object storage 연동을 검토한다.
4. [x] 렌더링 최적화
   - [x] 이미지, 도형, stroke 렌더링에 viewport culling을 적용한다.
   - [x] 화면 밖 이미지는 `Image()` 캐시에 올리지 않는다.
   - [x] 유휴 상태에서 매 프레임 전체 repaint하지 않고 변경 시점에만 렌더링한다.
   - [x] dirty region rendering을 적용한다.
   - 필요 시 OffscreenCanvas를 검토한다.
5. [x] 거대 Canvas 파일 분리
   - [x] bounds, hit test, handle, stroke geometry 계산을 `src/lib/canvasGeometry.ts`로 분리한다.
   - [x] 객체 조회, 그룹 선택, 잠금 판정, handle 선택 계산을 `src/lib/canvasSelection.ts`로 분리한다.
   - [x] 이동/리사이즈/화살표/도형 draft 계산을 `src/lib/canvasTransform.ts`로 분리한다.
   - [x] 이미지, 도형, stroke, cursor 렌더링을 `src/lib/canvasRenderer.ts`로 분리한다.
   - [x] 키보드 입력 로직을 `src/app/hooks/useCanvasKeyboard.ts`로 분리한다.
   - [x] 멀티터치/포인터 gesture 상태 계산을 `src/lib/canvasInteraction.ts`로 분리한다.
   - [x] 포인터 입력, 선택, 변형, 히스토리 로직을 추가 분리한다.

## 중간 우선순위

6. [x] 저장 API 정리
   - `/api/canvas/save`를 canonical 저장 경로로 유지한다.
   - 오래된 `/api/save`는 제거하거나 명확히 deprecated 처리한다.
7. [x] LocalStorage와 서버 저장 전략 정리
   - [x] 로그인 캔버스는 서버 저장을 기준으로 삼고, 캔버스 본문을 LocalStorage에 중복 저장하지 않는다.
   - [x] 이전 LocalStorage 캔버스 캐시를 초기화한다.
   - [x] 비로그인 로컬 캔버스 전략은 별도 기능으로 설계한다.
8. [x] 메모리 측정 기준 추가
   - [x] 빈 캔버스, stroke 1천/1만 개, 이미지 10장 시나리오별 RAM 기준을 만든다.
   - [x] `npm run measure:canvas-memory`로 데이터 크기와 heap 증가량을 비교한다.
9. [x] Stroke 단순화
   - [x] 입력 중 거리 기반 point 필터링을 적용한다.
   - [x] 저장 시점에 선 단순화 알고리즘을 적용한다.
   - [x] 사용자 체감 품질 기준에 맞춰 tolerance를 조정한다.
10. [x] Hit test 최적화
    - [x] 공통 bounds 계산과 stroke bounding box 선검사를 추가한다.
    - [x] 도형, 메모, 이미지용 grid index를 적용한다.
    - [x] stroke bounds 재계산을 줄이기 위해 bounds 캐시를 추가한다.
    - [x] stroke index를 렌더링/drag selection 후보 조회에 적용한다.
    - [x] quadtree 등으로 확장한다.

## 제품 방향 개선

11. [x] 기능 우선순위 재정의
    - [x] 저RAM 핵심 기능과 고급 기능을 분리한다.
12. [x] 툴바 단순화
    - [x] 기본 도구는 최소화하고 고급 기능은 접힌 메뉴로 이동한다.
13. [x] 로그인 없는 기본 사용성
    - [x] 비로그인 로컬 캔버스를 지원한다.
    - [x] 로그인 시 로컬 캔버스를 서버 캔버스로 동기화한다.
14. [x] 캔버스 목록/사이드바 UX 정리
    - [x] 생성, 이름 변경, 삭제, 최근 항목 흐름을 안정화한다.
    - [x] 비로그인 상태에서 로컬 캔버스 항목을 표시한다.
15. [x] 에러/저장 상태 표시
    - [x] 저장 대기, 저장 중, 저장됨, 저장 실패 상태를 작게 표시한다.
    - [x] 오프라인 상태를 별도로 감지한다.

## 개발 품질 개선

16. [x] 타입 안정성 강화
    - [x] `CanvasContent` 타입을 정의한다.
    - [x] 저장 payload를 `CanvasContent` 형태로 정규화한다.
    - [x] 객체별 runtime 검증을 강화한다.
17. [x] 캔버스 데이터 버전 관리
    - [x] `{ version, strokes, memos, shapes, images }` 형태로 저장한다.
    - [x] v2 이후를 위한 migration 함수를 둔다.
18. [x] 테스트 부족 개선
    - [x] 좌표/geometry 유틸 테스트를 추가한다.
    - [x] 저장 데이터 정규화 테스트를 추가한다.
    - [x] undo/redo history 메모리 구조 테스트를 추가한다.
    - [x] spatial index와 pointer gesture 유틸 테스트를 추가한다.
    - [x] canvas pointer interaction 회귀 테스트를 추가한다.
19. [x] 로드맵 최신화
    - [x] 구현 상태와 TODO 문서를 동기화한다.
20. [x] 불필요/중복 코드 정리
    - [x] 이전 저장 API를 deprecated 처리한다.
    - [x] Canvas 컴포넌트의 미사용 store 구독과 import를 정리한다.
    - [x] 남은 미사용 import, 죽은 코드, 낡은 주석을 정리한다.

## 리팩토링 단계

1. 저장 데이터 타입/버전과 canonical 저장 경로 정리
2. `canvas.tsx` 책임 분리
3. Undo/Redo 메모리 제한
4. 이미지 base64 제거
5. viewport culling과 stroke bounding box 도입
6. 메모리 측정 시나리오 추가
