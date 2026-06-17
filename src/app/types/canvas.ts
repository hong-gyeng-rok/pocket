import type { Prisma } from '@prisma/client';

export const CANVAS_CONTENT_VERSION = 1;
export const CANVAS_CHUNK_SIZE = 2048;

export interface Point {
  x: number;
  y: number;
}

export interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type PenStyle = 'pencil' | 'marker' | 'highlighter';

export interface Stroke {
  id: string;
  tool: 'PEN' | 'ERASER';
  color: string;
  size: number;
  points: Point[];
  penStyle?: PenStyle;
  bounds?: Bounds;
  createdAt: number;
}

export interface Memo {
  id: string;
  content: string;
  label?: string;
  zIndex?: number;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  fontSize?: 'sm' | 'm' | 'l' | 'xl';
  decoration?: 'tape' | 'pin' | 'label';
  groupId?: string;
  isLocked?: boolean;
}

export interface ImageElement {
  id: string;
  src: string;
  zIndex?: number;
  x: number;
  y: number;
  width: number;
  height: number;
  alt?: string;
  groupId?: string;
  isLocked?: boolean;
}

export type HandleType = 'top' | 'right' | 'bottom' | 'left';

export interface Shape {
  id: string;
  type: 'RECTANGLE' | 'CIRCLE' | 'TEXT' | 'ARROW';
  label?: string;
  zIndex?: number;
  x: number;
  y: number;
  width: number;
  height: number;
  fillColor: string;
  strokeColor: string;
  strokeWidth: number;
  text?: string;
  textColor?: string;
  fontSize?: 'sm' | 'm' | 'l' | 'xl';
  groupId?: string;
  isLocked?: boolean;
  startId?: string;
  endId?: string;
  startHandle?: HandleType;
  endHandle?: HandleType;
}

export interface CanvasContent {
  version: typeof CANVAS_CONTENT_VERSION;
  strokes: Stroke[];
  memos: Memo[];
  images: ImageElement[];
  shapes: Shape[];
}

export interface CanvasContentInput {
  version?: number;
  strokes?: unknown;
  memos?: unknown;
  images?: unknown;
  shapes?: unknown;
}

export interface CanvasContentChunk {
  id: string;
  x: number;
  y: number;
  strokes: Stroke[];
  memos: Memo[];
  images: ImageElement[];
  shapes: Shape[];
}

const DEFAULT_MEMO_WIDTH = 240;
const DEFAULT_MEMO_HEIGHT = 160;
const DEFAULT_OBJECT_WIDTH = 160;
const DEFAULT_OBJECT_HEIGHT = 100;

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return !!value && typeof value === 'object' && !Array.isArray(value);
};

const asArray = (value: unknown): unknown[] => Array.isArray(value) ? value : [];

const asNumber = (value: unknown, fallback: number): number => {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
};

const asString = (value: unknown, fallback: string): string => {
  return typeof value === 'string' ? value : fallback;
};

const asOptionalString = (value: unknown): string | undefined => {
  return typeof value === 'string' ? value : undefined;
};

const asOptionalBoolean = (value: unknown): boolean | undefined => {
  return typeof value === 'boolean' ? value : undefined;
};

const asFontSize = (value: unknown): Memo['fontSize'] => {
  return value === 'sm' || value === 'm' || value === 'l' || value === 'xl'
    ? value
    : undefined;
};

const asPenStyle = (value: unknown): PenStyle => {
  return value === 'pencil' || value === 'marker' || value === 'highlighter'
    ? value
    : 'marker';
};

const asMemoDecoration = (value: unknown): Memo['decoration'] => {
  return value === 'tape' || value === 'pin' || value === 'label'
    ? value
    : 'tape';
};

const asHandleType = (value: unknown): HandleType | undefined => {
  return value === 'top' || value === 'right' || value === 'bottom' || value === 'left'
    ? value
    : undefined;
};

const asShapeType = (value: unknown): Shape['type'] => {
  return value === 'RECTANGLE' || value === 'CIRCLE' || value === 'TEXT' || value === 'ARROW'
    ? value
    : 'RECTANGLE';
};

const normalizePoint = (point: unknown): Point | undefined => {
  if (!isRecord(point)) return undefined;

  const x = asNumber(point.x, NaN);
  const y = asNumber(point.y, NaN);

  if (!Number.isFinite(x) || !Number.isFinite(y)) return undefined;
  return { x, y };
};

const normalizeBounds = (bounds: unknown): Bounds | undefined => {
  if (!isRecord(bounds)) return undefined;

  return {
    x: asNumber(bounds.x, 0),
    y: asNumber(bounds.y, 0),
    width: Math.max(0, asNumber(bounds.width, 0)),
    height: Math.max(0, asNumber(bounds.height, 0)),
  };
};

const createBoundsFromPoints = (points: Point[]): Bounds | undefined => {
  if (points.length === 0) return undefined;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const point of points) {
    minX = Math.min(minX, point.x);
    minY = Math.min(minY, point.y);
    maxX = Math.max(maxX, point.x);
    maxY = Math.max(maxY, point.y);
  }

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  };
};

const getChunkCoordinate = (value: number, chunkSize = CANVAS_CHUNK_SIZE): number => {
  return Math.floor(value / chunkSize);
};

const getChunkId = (x: number, y: number, chunkSize = CANVAS_CHUNK_SIZE): string => {
  return `${getChunkCoordinate(x, chunkSize)}:${getChunkCoordinate(y, chunkSize)}`;
};

const getStrokeChunkId = (stroke: Stroke, chunkSize = CANVAS_CHUNK_SIZE): string => {
  const bounds = stroke.bounds ?? createBoundsFromPoints(stroke.points);
  if (!bounds) return getChunkId(0, 0, chunkSize);
  return getChunkId(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2, chunkSize);
};

const getObjectChunkId = (
  object: Pick<Memo | ImageElement | Shape, 'x' | 'y' | 'width' | 'height'>,
  chunkSize = CANVAS_CHUNK_SIZE
): string => {
  return getChunkId(object.x + object.width / 2, object.y + object.height / 2, chunkSize);
};

const createChunk = (id: string): CanvasContentChunk => {
  const [x, y] = id.split(':').map((value) => Number.parseInt(value, 10));

  return {
    id,
    x,
    y,
    strokes: [],
    memos: [],
    images: [],
    shapes: [],
  };
};

const normalizeStroke = (stroke: unknown): Stroke | undefined => {
  if (!isRecord(stroke)) return undefined;

  const points = asArray(stroke.points)
    .map(normalizePoint)
    .filter((point): point is Point => !!point);

  if (points.length === 0) return undefined;

  return {
    id: asString(stroke.id, crypto.randomUUID()),
    tool: stroke.tool === 'ERASER' ? 'ERASER' : 'PEN',
    color: asString(stroke.color, '#000000'),
    size: Math.max(1, asNumber(stroke.size, 2)),
    points,
    penStyle: asPenStyle(stroke.penStyle),
    bounds: normalizeBounds(stroke.bounds) ?? createBoundsFromPoints(points),
    createdAt: asNumber(stroke.createdAt, Date.now()),
  };
};

const normalizeMemo = (memo: unknown): Memo | undefined => {
  if (!isRecord(memo)) return undefined;

  return {
    id: asString(memo.id, crypto.randomUUID()),
    content: asString(memo.content, ''),
    label: asOptionalString(memo.label),
    zIndex: asNumber(memo.zIndex, 0),
    x: asNumber(memo.x, 0),
    y: asNumber(memo.y, 0),
    width: Math.max(1, asNumber(memo.width, DEFAULT_MEMO_WIDTH)),
    height: Math.max(1, asNumber(memo.height, DEFAULT_MEMO_HEIGHT)),
    color: asString(memo.color, '#FEF08A'),
    fontSize: asFontSize(memo.fontSize),
    decoration: asMemoDecoration(memo.decoration),
    groupId: asOptionalString(memo.groupId),
    isLocked: asOptionalBoolean(memo.isLocked),
  };
};

const normalizeImage = (image: unknown): ImageElement | undefined => {
  if (!isRecord(image)) return undefined;

  const src = asString(image.src, '');
  if (!src) return undefined;

  return {
    id: asString(image.id, crypto.randomUUID()),
    src,
    zIndex: asNumber(image.zIndex, 0),
    x: asNumber(image.x, 0),
    y: asNumber(image.y, 0),
    width: Math.max(1, asNumber(image.width, DEFAULT_OBJECT_WIDTH)),
    height: Math.max(1, asNumber(image.height, DEFAULT_OBJECT_HEIGHT)),
    alt: asOptionalString(image.alt),
    groupId: asOptionalString(image.groupId),
    isLocked: asOptionalBoolean(image.isLocked),
  };
};

const normalizeShape = (shape: unknown): Shape | undefined => {
  if (!isRecord(shape)) return undefined;

  return {
    id: asString(shape.id, crypto.randomUUID()),
    type: asShapeType(shape.type),
    label: asOptionalString(shape.label),
    zIndex: asNumber(shape.zIndex, 0),
    x: asNumber(shape.x, 0),
    y: asNumber(shape.y, 0),
    width: asNumber(shape.width, DEFAULT_OBJECT_WIDTH),
    height: asNumber(shape.height, DEFAULT_OBJECT_HEIGHT),
    fillColor: asString(shape.fillColor, '#ffffff'),
    strokeColor: asString(shape.strokeColor, '#000000'),
    strokeWidth: Math.max(0, asNumber(shape.strokeWidth, 1)),
    text: asOptionalString(shape.text),
    textColor: asOptionalString(shape.textColor),
    fontSize: asFontSize(shape.fontSize),
    groupId: asOptionalString(shape.groupId),
    isLocked: asOptionalBoolean(shape.isLocked),
    startId: asOptionalString(shape.startId),
    endId: asOptionalString(shape.endId),
    startHandle: asHandleType(shape.startHandle),
    endHandle: asHandleType(shape.endHandle),
  };
};

export const migrateCanvasContent = (input: CanvasContentInput): CanvasContentInput => {
  switch (input.version) {
    case undefined:
    case CANVAS_CONTENT_VERSION:
      return input;
    default:
      return input;
  }
};

export const createEmptyCanvasContent = (): CanvasContent => ({
  version: CANVAS_CONTENT_VERSION,
  strokes: [],
  memos: [],
  images: [],
  shapes: [],
});

export const normalizeCanvasContent = (input: unknown): CanvasContent => {
  if (!input || typeof input !== 'object') {
    return createEmptyCanvasContent();
  }

  const content = migrateCanvasContent(input as CanvasContentInput);

  return {
    version: CANVAS_CONTENT_VERSION,
    strokes: asArray(content.strokes).map(normalizeStroke).filter((stroke): stroke is Stroke => !!stroke),
    memos: asArray(content.memos).map(normalizeMemo).filter((memo): memo is Memo => !!memo),
    images: asArray(content.images).map(normalizeImage).filter((image): image is ImageElement => !!image),
    shapes: asArray(content.shapes).map(normalizeShape).filter((shape): shape is Shape => !!shape),
  };
};

export const toCanvasContent = (
  content: Pick<CanvasContent, 'strokes' | 'memos' | 'images' | 'shapes'>
): CanvasContent => ({
  version: CANVAS_CONTENT_VERSION,
  strokes: content.strokes,
  memos: content.memos,
  images: content.images,
  shapes: content.shapes,
});

export const isCanvasContentEmpty = (
  content: Pick<CanvasContent, 'strokes' | 'memos' | 'images' | 'shapes'>
): boolean => {
  return (
    content.strokes.length === 0 &&
    content.memos.length === 0 &&
    content.images.length === 0 &&
    content.shapes.length === 0
  );
};

export const chunkCanvasContent = (
  content: CanvasContent,
  chunkSize = CANVAS_CHUNK_SIZE
): CanvasContentChunk[] => {
  const chunks = new Map<string, CanvasContentChunk>();
  const getOrCreateChunk = (id: string) => {
    const existing = chunks.get(id);
    if (existing) return existing;

    const chunk = createChunk(id);
    chunks.set(id, chunk);
    return chunk;
  };

  for (const stroke of content.strokes) {
    getOrCreateChunk(getStrokeChunkId(stroke, chunkSize)).strokes.push(stroke);
  }

  for (const memo of content.memos) {
    getOrCreateChunk(getObjectChunkId(memo, chunkSize)).memos.push(memo);
  }

  for (const image of content.images) {
    getOrCreateChunk(getObjectChunkId(image, chunkSize)).images.push(image);
  }

  for (const shape of content.shapes) {
    getOrCreateChunk(getObjectChunkId(shape, chunkSize)).shapes.push(shape);
  }

  return Array.from(chunks.values()).sort((a, b) => a.id.localeCompare(b.id));
};

export const flattenCanvasChunks = (chunks: CanvasContentChunk[]): CanvasContent => ({
  version: CANVAS_CONTENT_VERSION,
  strokes: chunks.flatMap((chunk) => chunk.strokes),
  memos: chunks.flatMap((chunk) => chunk.memos),
  images: chunks.flatMap((chunk) => chunk.images),
  shapes: chunks.flatMap((chunk) => chunk.shapes),
});

export const toPrismaJson = (content: CanvasContent): Prisma.InputJsonObject => {
  return JSON.parse(JSON.stringify(content)) as Prisma.InputJsonObject;
};
