const POINTS_PER_STROKE = 24;
const INLINE_IMAGE_BYTES = 180_000;
const STROKE_SIMPLIFICATION_TOLERANCE = 1.5;

function createStroke(id, offset = 0) {
  const points = Array.from({ length: POINTS_PER_STROKE }, (_, index) => ({
    x: offset + index * 4,
    y: offset + Math.sin(index / 3) * 12,
  }));

  return {
    id: `stroke-${id}`,
    points,
    color: "#000000",
    width: 2,
    bounds: {
      x: offset,
      y: offset - 12,
      width: (POINTS_PER_STROKE - 1) * 4,
      height: 24,
    },
  };
}

function squaredDistanceToSegment(point, start, end) {
  const segmentLengthSquared = (start.x - end.x) ** 2 + (start.y - end.y) ** 2;
  if (segmentLengthSquared === 0) {
    return (point.x - start.x) ** 2 + (point.y - start.y) ** 2;
  }

  const projection = (
    (point.x - start.x) * (end.x - start.x) +
    (point.y - start.y) * (end.y - start.y)
  ) / segmentLengthSquared;
  const t = Math.max(0, Math.min(1, projection));
  const projectedX = start.x + t * (end.x - start.x);
  const projectedY = start.y + t * (end.y - start.y);

  return (point.x - projectedX) ** 2 + (point.y - projectedY) ** 2;
}

function simplifySection(points, startIndex, endIndex, toleranceSquared, keep) {
  if (endIndex <= startIndex + 1) return;

  let maxDistance = 0;
  let maxIndex = startIndex;
  const start = points[startIndex];
  const end = points[endIndex];

  for (let index = startIndex + 1; index < endIndex; index++) {
    const distance = squaredDistanceToSegment(points[index], start, end);
    if (distance > maxDistance) {
      maxDistance = distance;
      maxIndex = index;
    }
  }

  if (maxDistance > toleranceSquared) {
    keep[maxIndex] = true;
    simplifySection(points, startIndex, maxIndex, toleranceSquared, keep);
    simplifySection(points, maxIndex, endIndex, toleranceSquared, keep);
  }
}

function simplifyStrokePoints(points, tolerance = STROKE_SIMPLIFICATION_TOLERANCE) {
  if (points.length <= 2) return [...points];

  const keep = Array(points.length).fill(false);
  keep[0] = true;
  keep[points.length - 1] = true;

  simplifySection(points, 0, points.length - 1, tolerance ** 2, keep);

  return points.filter((_, index) => keep[index]);
}

function createMemo(id, offset = 0) {
  return {
    id: `memo-${id}`,
    x: offset,
    y: offset,
    width: 220,
    height: 140,
    text: `Memo ${id}`,
    color: "#FEF08A",
  };
}

function createShape(id, offset = 0) {
  return {
    id: `shape-${id}`,
    type: "RECTANGLE",
    x: offset,
    y: offset,
    width: 180,
    height: 100,
    color: "#BFDBFE",
  };
}

function createInlineImage(id, offset = 0) {
  return {
    id: `image-${id}`,
    src: `data:image/webp;base64,${"a".repeat(INLINE_IMAGE_BYTES)}`,
    x: offset,
    y: offset,
    width: 300,
    height: 200,
    alt: `Image ${id}`,
  };
}

function createUrlImage(id, offset = 0) {
  return {
    id: `image-${id}`,
    src: `/uploads/canvas-assets/image-${id}.webp`,
    x: offset,
    y: offset,
    width: 300,
    height: 200,
    alt: `Image ${id}`,
  };
}

function createCanvasContent({ strokes = 0, memos = 0, shapes = 0, images = 0, urlImages = 0 }) {
  return {
    version: 1,
    strokes: Array.from({ length: strokes }, (_, index) => createStroke(index, index * 8)),
    memos: Array.from({ length: memos }, (_, index) => createMemo(index, index * 32)),
    shapes: Array.from({ length: shapes }, (_, index) => createShape(index, index * 28)),
    images: [
      ...Array.from({ length: images }, (_, index) => createInlineImage(index, index * 40)),
      ...Array.from({ length: urlImages }, (_, index) => createUrlImage(index, index * 40)),
    ],
  };
}

function chunkIdForPoint(x, y, chunkSize = 2048) {
  return `${Math.floor(x / chunkSize)}:${Math.floor(y / chunkSize)}`;
}

function chunkCanvasContent(content, chunkSize = 2048) {
  const chunks = new Map();
  const getChunk = (id) => {
    if (!chunks.has(id)) {
      chunks.set(id, { id, strokes: [], memos: [], images: [], shapes: [] });
    }
    return chunks.get(id);
  };

  for (const stroke of content.strokes) {
    const bounds = stroke.bounds;
    getChunk(chunkIdForPoint(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2, chunkSize)).strokes.push(stroke);
  }
  for (const memo of content.memos) {
    getChunk(chunkIdForPoint(memo.x + memo.width / 2, memo.y + memo.height / 2, chunkSize)).memos.push(memo);
  }
  for (const image of content.images) {
    getChunk(chunkIdForPoint(image.x + image.width / 2, image.y + image.height / 2, chunkSize)).images.push(image);
  }
  for (const shape of content.shapes) {
    getChunk(chunkIdForPoint(shape.x + shape.width / 2, shape.y + shape.height / 2, chunkSize)).shapes.push(shape);
  }

  return Array.from(chunks.values());
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function measureScenario(name, input) {
  global.gc?.();
  const before = process.memoryUsage().heapUsed;
  const content = createCanvasContent(input);
  const json = JSON.stringify(content);
  const parsed = JSON.parse(json);
  global.gc?.();
  const after = process.memoryUsage().heapUsed;

  return {
    name,
    objects: parsed.strokes.length + parsed.memos.length + parsed.shapes.length + parsed.images.length,
    jsonBytes: Buffer.byteLength(json),
    heapDelta: Math.max(after - before, 0),
  };
}

function measureHistoryScenario() {
  const baseContent = createCanvasContent({ strokes: 1_000 });
  const snapshots = Array.from({ length: 50 }, (_, index) => ({
    strokes: baseContent.strokes.slice(0, 1_000 - index),
    memos: baseContent.memos,
    images: baseContent.images,
    shapes: baseContent.shapes,
  }));
  const deltas = Array.from({ length: 50 }, (_, index) => ({
    strokes: baseContent.strokes.slice(1_000 - index - 1, 1_000 - index),
  }));

  return {
    fullSnapshots: Buffer.byteLength(JSON.stringify(snapshots)),
    changedSlices: Buffer.byteLength(JSON.stringify(deltas)),
    operations: Buffer.byteLength(JSON.stringify(
      Array.from({ length: 50 }, (_, index) => ({
        type: "add",
        kind: "stroke",
        id: `stroke-${index}`,
      }))
    )),
  };
}

function measureStrokeSimplificationScenario() {
  const points = Array.from({ length: 1_000 }, (_, index) => ({
    x: index,
    y: Math.sin(index / 24) * 48 + Math.sin(index / 5) * 2,
  }));
  const simplified = simplifyStrokePoints(points);

  return {
    before: points.length,
    after: simplified.length,
    reduction: 1 - simplified.length / points.length,
  };
}

function measureChunkScenario() {
  const content = createCanvasContent({ strokes: 10_000 });
  const chunks = chunkCanvasContent(content);
  const largestChunkBytes = Math.max(
    ...chunks.map((chunk) => Buffer.byteLength(JSON.stringify(chunk))),
    0
  );

  return {
    chunks: chunks.length,
    largestChunkBytes,
    fullCanvasBytes: Buffer.byteLength(JSON.stringify(content)),
  };
}

const scenarios = [
  ["empty", {}],
  ["strokes-1k", { strokes: 1_000 }],
  ["strokes-10k", { strokes: 10_000 }],
  ["mixed-1k", { strokes: 800, memos: 100, shapes: 100 }],
  ["inline-images-10", { images: 10 }],
  ["url-images-10", { urlImages: 10 }],
];

const rows = scenarios.map(([name, input]) => measureScenario(name, input));
const history = measureHistoryScenario();
const strokeSimplification = measureStrokeSimplificationScenario();
const chunkStats = measureChunkScenario();

console.log("Pocket canvas memory baseline");
console.log("Run after data-structure changes and compare json/heap growth.");
console.table(
  rows.map((row) => ({
    scenario: row.name,
    objects: row.objects,
    json: formatBytes(row.jsonBytes),
    heap: formatBytes(row.heapDelta),
  }))
);
console.table([
  {
    scenario: "history-50-full-snapshots",
    json: formatBytes(history.fullSnapshots),
  },
  {
    scenario: "history-50-changed-slices",
    json: formatBytes(history.changedSlices),
  },
  {
    scenario: "history-50-operations",
    json: formatBytes(history.operations),
  },
]);
console.table([
  {
    scenario: "chunked-strokes-10k",
    chunks: chunkStats.chunks,
    largestChunk: formatBytes(chunkStats.largestChunkBytes),
    fullCanvas: formatBytes(chunkStats.fullCanvasBytes),
  },
]);
console.table([
  {
    scenario: "stroke-simplification-1k",
    before: strokeSimplification.before,
    after: strokeSimplification.after,
    reduction: `${Math.round(strokeSimplification.reduction * 100)}%`,
  },
]);
