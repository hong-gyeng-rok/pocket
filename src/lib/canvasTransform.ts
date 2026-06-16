import type { ImageElement, Point, Shape } from '@/app/types/canvas';
import type { Rect } from '@/lib/canvasGeometry';
import type { ObjectHandle } from '@/lib/canvasGeometry';
import type { ResolvedCanvasObject } from '@/lib/canvasSelection';

export const getDelta = (from: Point, to: Point): Point => ({
  x: to.x - from.x,
  y: to.y - from.y,
});

export const createDraftRect = (start: Point, current: Point): Rect => ({
  x: start.x,
  y: start.y,
  width: current.x - start.x,
  height: current.y - start.y,
});

export const createCircleDraftRect = (start: Point, current: Point): Rect => {
  const dx = current.x - start.x;
  const dy = current.y - start.y;
  const size = Math.max(Math.abs(dx), Math.abs(dy));

  return {
    x: start.x,
    y: start.y,
    width: Math.sign(dx || 1) * size,
    height: Math.sign(dy || 1) * size,
  };
};

const isLightShapeFill = (color: string): boolean => {
  const value = color.trim().toLowerCase();
  if (value === 'transparent') return true;
  if (value === '#fff' || value === '#ffffff') return true;

  const hex = value.match(/^#([0-9a-f]{6})$/);
  if (!hex) return false;

  const red = Number.parseInt(hex[1].slice(0, 2), 16);
  const green = Number.parseInt(hex[1].slice(2, 4), 16);
  const blue = Number.parseInt(hex[1].slice(4, 6), 16);
  return (red * 299 + green * 587 + blue * 114) / 1000 > 210;
};

export const getShapeStrokeColor = (fillColor: string): string => (
  isLightShapeFill(fillColor) ? '#4b5563' : fillColor
);

export const createResizeUpdate = (
  object: ResolvedCanvasObject,
  anchor: Point,
  current: Point
): Partial<Omit<Shape | ImageElement, 'id'>> => {
  const width = current.x - anchor.x;
  const height = current.y - anchor.y;

  if (object._type === 'IMAGE') {
    const ratio = object.width / object.height;
    return {
      x: anchor.x,
      y: anchor.y,
      width,
      height: width / ratio,
    };
  }

  return {
    x: anchor.x,
    y: anchor.y,
    width,
    height,
  };
};

export const createArrowTemp = (
  startHandle: ObjectHandle,
  end: Point
) => ({
  x1: startHandle.x,
  y1: startHandle.y,
  x2: end.x,
  y2: end.y,
});

export const createArrowShape = (
  startHandle: ObjectHandle,
  end: Point,
  endId?: string
): Shape => ({
  id: crypto.randomUUID(),
  type: 'ARROW',
  x: startHandle.x,
  y: startHandle.y,
  width: end.x - startHandle.x,
  height: end.y - startHandle.y,
  fillColor: '#000000',
  strokeColor: '#000000',
  strokeWidth: 4,
  startId: startHandle.objectId,
  endId,
});

export const toShapeType = (tool: string): Shape['type'] => {
  if (tool === 'CIRCLE') return 'CIRCLE';
  if (tool === 'ARROW') return 'ARROW';
  return 'RECTANGLE';
};
