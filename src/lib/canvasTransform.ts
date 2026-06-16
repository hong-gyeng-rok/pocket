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
