# Canvas Asset Storage

현재 개발 환경은 `/api/canvas/assets`가 업로드 이미지를 `public/uploads/canvas-assets`에 저장한다.
이 방식은 로컬 개발과 단일 서버에서는 단순하지만, 운영 환경에서는 파일 시스템이 휘발되거나 인스턴스마다 달라질 수 있다.

## Production Target

운영 환경에서는 이미지 본문을 캔버스 JSON이나 DB JSON에 넣지 않는다.
권장 구조는 다음과 같다.

- 이미지 원본: S3, R2, GCS 같은 object storage
- 캔버스 JSON: asset URL, 위치, 크기, alt 정보만 저장
- 업로드 API: 압축된 webp를 받아 object storage에 쓰고 public URL 또는 signed URL을 반환
- 삭제/정리: 캔버스 삭제 시 연결 asset을 비동기 정리

## Memory Rule

캔버스 데이터는 장시간 열린 상태에서도 작게 유지되어야 한다.
이미지 10장 기준 캔버스 JSON 목표는 `100 KB` 이하이며, 현재 `url-images-10` 측정은 약 `1.2 KB`다.

## Migration Rule

기존 data URL 이미지가 로드되면 저장 시점에 asset 업로드 API를 통과시켜 URL로 바꾸는 마이그레이션을 둔다.
운영 object storage가 연결되기 전까지는 local asset URL을 유지한다.
