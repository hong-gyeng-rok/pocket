import type { Rect } from '@/lib/canvasGeometry.ts';

export const mergeDirtyRects = (current: Rect | null, next: Rect): Rect => {
  if (!current) return next;

  const x1 = Math.min(current.x, next.x);
  const y1 = Math.min(current.y, next.y);
  const x2 = Math.max(current.x + current.width, next.x + next.width);
  const y2 = Math.max(current.y + current.height, next.y + next.height);

  return { x: x1, y: y1, width: x2 - x1, height: y2 - y1 };
};

export const getCursorDirtyRect = (
  position: { x: number; y: number } | null,
  strokeWidth: number
): Rect | null => {
  if (!position) return null;

  const radius = Math.max(32, strokeWidth * 3);

  return {
    x: position.x - radius,
    y: position.y - radius,
    width: radius * 2,
    height: radius * 2,
  };
};
