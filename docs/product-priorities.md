# Pocket Product Priorities

Pocket은 저RAM 무한 화이트보드가 핵심이다. 기능의 우선순위는 사용 빈도보다 메모리 증가량과 장시간 안정성을 먼저 본다.

## Core

- pan, zoom, select
- pen, eraser
- rectangle, memo
- save status and recovery feedback

## Advanced

- image upload
- circle, arrow, text
- grouping, locking
- richer color choices

## Deferral Rule

새 기능이 캔버스 JSON 크기, undo/redo 히스토리 크기, 이미지 메모리, 상시 repaint 비용을 크게 늘리면 기본 화면에 노출하지 않는다. 먼저 접힌 도구나 별도 흐름으로 둔 뒤, 메모리 측정 시나리오를 추가한다.
