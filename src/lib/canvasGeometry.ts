import type { ImageElement, Memo, Point, Shape, Stroke } from '@/app/types/canvas';

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ViewportInput {
  x: number;
  y: number;
  zoom: number;
  width: number;
  height: number;
}

export interface ObjectHandle {
  id: 'top' | 'right' | 'bottom' | 'left';
  objectId: string;
  x: number;
  y: number;
}

export type CanvasObject = Shape | Memo | ImageElement;

export const STROKE_POINT_MIN_DISTANCE = 1;
export const STROKE_SIMPLIFICATION_TOLERANCE = 1.5;

export const normalizeRect = (rect: Rect): Rect => {
  const x1 = Math.min(rect.x, rect.x + rect.width);
  const y1 = Math.min(rect.y, rect.y + rect.height);
  const x2 = Math.max(rect.x, rect.x + rect.width);
  const y2 = Math.max(rect.y, rect.y + rect.height);

  return {
    x: x1,
    y: y1,
    width: x2 - x1,
    height: y2 - y1,
  };
};

export const createRectFromPoints = (start: Point, end: Point): Rect => ({
  x: Math.min(start.x, end.x),
  y: Math.min(start.y, end.y),
  width: Math.abs(end.x - start.x),
  height: Math.abs(end.y - start.y),
});

export const getObjectBounds = (object: CanvasObject, padding = 0): Rect => {
  const bounds = normalizeRect({
    x: object.x,
    y: object.y,
    width: object.width,
    height: object.height,
  });

  return {
    x: bounds.x - padding,
    y: bounds.y - padding,
    width: bounds.width + padding * 2,
    height: bounds.height + padding * 2,
  };
};

export const pointInRect = (point: Point, rect: Rect): boolean => {
  const bounds = normalizeRect(rect);
  return (
    point.x >= bounds.x &&
    point.x <= bounds.x + bounds.width &&
    point.y >= bounds.y &&
    point.y <= bounds.y + bounds.height
  );
};

export const rectsIntersect = (a: Rect, b: Rect): boolean => {
  const rectA = normalizeRect(a);
  const rectB = normalizeRect(b);

  return (
    rectA.x < rectB.x + rectB.width &&
    rectA.x + rectA.width > rectB.x &&
    rectA.y < rectB.y + rectB.height &&
    rectA.y + rectA.height > rectB.y
  );
};

export const getViewportBounds = (
  viewport: ViewportInput,
  paddingScreenPx = 96
): Rect => {
  const paddingWorld = paddingScreenPx / viewport.zoom;

  return {
    x: viewport.x - paddingWorld,
    y: viewport.y - paddingWorld,
    width: viewport.width / viewport.zoom + paddingWorld * 2,
    height: viewport.height / viewport.zoom + paddingWorld * 2,
  };
};

export const getObjectHandles = (object: CanvasObject, padding = 10): ObjectHandle[] => {
  const bounds = getObjectBounds(object);
  const { id } = object;

  return [
    { id: 'top', objectId: id, x: bounds.x + bounds.width / 2, y: bounds.y - padding },
    { id: 'right', objectId: id, x: bounds.x + bounds.width + padding, y: bounds.y + bounds.height / 2 },
    { id: 'bottom', objectId: id, x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height + padding },
    { id: 'left', objectId: id, x: bounds.x - padding, y: bounds.y + bounds.height / 2 },
  ];
};

export const getResizeHandlePoint = (object: CanvasObject, padding = 4): Point => {
  const bounds = getObjectBounds(object);

  return {
    x: bounds.x + bounds.width + padding,
    y: bounds.y + bounds.height + padding,
  };
};

export const distanceToSegment = (point: Point, start: Point, end: Point): number => {
  const segmentLengthSquared = (start.x - end.x) ** 2 + (start.y - end.y) ** 2;
  if (segmentLengthSquared === 0) return Math.hypot(point.x - start.x, point.y - start.y);

  const projection = (
    (point.x - start.x) * (end.x - start.x) +
    (point.y - start.y) * (end.y - start.y)
  ) / segmentLengthSquared;

  const t = Math.max(0, Math.min(1, projection));

  return Math.hypot(
    point.x - (start.x + t * (end.x - start.x)),
    point.y - (start.y + t * (end.y - start.y))
  );
};

const squaredDistanceToSegment = (point: Point, start: Point, end: Point): number => {
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
};

const simplifySection = (
  points: Point[],
  startIndex: number,
  endIndex: number,
  toleranceSquared: number,
  keep: boolean[]
) => {
  if (endIndex <= startIndex + 1) return;

  let maxDistance = 0;
  let maxIndex = startIndex;
  const start = points[startIndex];
  const end = points[endIndex];

  for (let i = startIndex + 1; i < endIndex; i++) {
    const distance = squaredDistanceToSegment(points[i], start, end);
    if (distance > maxDistance) {
      maxDistance = distance;
      maxIndex = i;
    }
  }

  if (maxDistance > toleranceSquared) {
    keep[maxIndex] = true;
    simplifySection(points, startIndex, maxIndex, toleranceSquared, keep);
    simplifySection(points, maxIndex, endIndex, toleranceSquared, keep);
  }
};

export const simplifyStrokePoints = (
  points: Point[],
  tolerance = STROKE_SIMPLIFICATION_TOLERANCE
): Point[] => {
  if (points.length <= 2) return [...points];

  const keep = Array(points.length).fill(false);
  keep[0] = true;
  keep[points.length - 1] = true;

  simplifySection(points, 0, points.length - 1, tolerance ** 2, keep);

  return points.filter((_, index) => keep[index]);
};

export const getStrokeBounds = (stroke: Stroke, padding = 0): Rect | null => {
  if (stroke.bounds) {
    return {
      x: stroke.bounds.x - padding,
      y: stroke.bounds.y - padding,
      width: stroke.bounds.width + padding * 2,
      height: stroke.bounds.height + padding * 2,
    };
  }

  if (stroke.points.length === 0) return null;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const point of stroke.points) {
    minX = Math.min(minX, point.x);
    minY = Math.min(minY, point.y);
    maxX = Math.max(maxX, point.x);
    maxY = Math.max(maxY, point.y);
  }

  return {
    x: minX - padding,
    y: minY - padding,
    width: maxX - minX + padding * 2,
    height: maxY - minY + padding * 2,
  };
};

export const createStrokeBounds = (points: Point[]): Rect | undefined => {
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

export const strokeIntersectsRect = (stroke: Stroke, rect: Rect): boolean => {
  const bounds = getStrokeBounds(stroke, stroke.size / 2);
  if (!bounds || !rectsIntersect(bounds, rect)) return false;

  return stroke.points.some((point) => pointInRect(point, rect));
};
