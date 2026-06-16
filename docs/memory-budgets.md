# Pocket Memory Budgets

Pocket의 핵심 기준은 "오래 열어두어도 RAM이 작게 증가하는 무한 화이트보드"다.
아래 시나리오는 데이터 구조 변경 전후를 비교하기 위한 최소 기준이다.

## 측정 방법

```bash
npm run measure:canvas-memory
```

이 스크립트는 캔버스 JSON 크기와 Node heap 증가량을 측정한다. 브라우저 실제 RAM과 완전히 같지는 않지만, 데이터 구조가 커지는 속도를 반복 비교하기에 적합하다.

## 기준 시나리오

| 시나리오 | 목적 |
| --- | --- |
| `empty` | 빈 캔버스 기본 오버헤드 확인 |
| `strokes-1k` | 일반 필기량에서 stroke 저장 비용 확인 |
| `strokes-10k` | 장시간 사용 시 stroke 증가 비용 확인 |
| `mixed-1k` | stroke, memo, shape 혼합 보드 비용 확인 |
| `inline-images-10` | 이미지 본문을 JSON에 넣는 현재 방식의 비용 확인 |
| `url-images-10` | 이미지 본문을 분리하고 URL만 JSON에 넣었을 때 비용 확인 |
| `history-50-changed-slices` | undo/redo가 전체 스냅샷 대신 변경 slice만 저장하는지 확인 |
| `history-50-operations` | operation 기반 history로 전환했을 때의 하한 비용 확인 |
| `stroke-simplification-1k` | 1천 point stroke가 저장 시 얼마나 줄어드는지 확인 |
| `chunked-strokes-10k` | 1만 stroke를 chunk로 나눴을 때 가장 큰 chunk 크기 확인 |

## 목표

| 항목 | 1차 목표 |
| --- | --- |
| 빈 캔버스 | JSON 2 KB 이하 |
| stroke 1천 개 | JSON 3 MB 이하 |
| stroke 1만 개 | JSON 30 MB 이하 |
| 이미지 10장 | asset 분리 후 캔버스 JSON 100 KB 이하 |
| undo/redo history | 변경 slice 기준 16 MB 이하 |
| stroke 단순화 | 부드러운 1천 point stroke 기준 70% 이상 point 감소 |
| chunk 저장 | 단일 chunk JSON이 전체 캔버스 JSON보다 작게 유지 |

새로 업로드한 이미지는 `/api/canvas/assets`로 파일 자산에 저장하고, 캔버스 JSON에는 URL만 둔다.
히스토리는 최대 50개를 유지하되, 저장된 변경 slice 합산이 16 MB를 넘으면 오래된 기록부터 버린다.
stroke 입력 중에는 1 world px 이하 이동을 버리고, 저장 시 Ramer-Douglas-Peucker tolerance 1.5를 적용한다.
chunk 기준 크기는 2048 world px이며, 현재는 저장 포맷 전환을 위한 그룹화/복원 유틸부터 검증한다.
