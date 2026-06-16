import { getObjectHandles } from '@/lib/canvasGeometry';
import type { ObjectHandle } from '@/lib/canvasGeometry';
import type { ImageElement, Memo, Shape } from '@/app/types/canvas';

export type ResolvedCanvasObject =
  | (Shape & { _type: 'SHAPE' })
  | (Memo & { _type: 'MEMO' })
  | (ImageElement & { _type: 'IMAGE' });

export interface CanvasObjectCollections {
  shapes: Shape[];
  memos: Memo[];
  images: ImageElement[];
}

export const findCanvasObject = (
  collections: CanvasObjectCollections,
  id: string
): ResolvedCanvasObject | null => {
  const shape = collections.shapes.find((item) => item.id === id);
  if (shape) return { ...shape, _type: 'SHAPE' };

  const memo = collections.memos.find((item) => item.id === id);
  if (memo) return { ...memo, _type: 'MEMO' };

  const image = collections.images.find((item) => item.id === id);
  if (image) return { ...image, _type: 'IMAGE' };

  return null;
};

export const getGroupMemberIds = (
  collections: CanvasObjectCollections,
  groupId: string
) => [
  ...collections.shapes.filter((shape) => shape.groupId === groupId).map((shape) => shape.id),
  ...collections.memos.filter((memo) => memo.groupId === groupId).map((memo) => memo.id),
  ...collections.images.filter((image) => image.groupId === groupId).map((image) => image.id),
];

export const getObjectSelectionIds = (
  collections: CanvasObjectCollections,
  objectId: string
) => {
  const object = findCanvasObject(collections, objectId);
  if (!object?.groupId) return [objectId];

  return getGroupMemberIds(collections, object.groupId);
};

export const selectionHasLockedObject = (
  collections: CanvasObjectCollections,
  ids: string[]
) => {
  return ids.some((id) => findCanvasObject(collections, id)?.isLocked);
};

export const findClosestObjectHandle = (
  object: ResolvedCanvasObject,
  point: { x: number; y: number }
): ObjectHandle | null => {
  const handles = getObjectHandles(object);
  if (handles.length === 0) return null;

  let closest = handles[0];
  let minDistance = Infinity;

  handles.forEach((handle) => {
    const distance = Math.hypot(handle.x - point.x, handle.y - point.y);
    if (distance < minDistance) {
      minDistance = distance;
      closest = handle;
    }
  });

  return closest;
};

export const getResolvedObjectHandles = (object: ResolvedCanvasObject): ObjectHandle[] => {
  return getObjectHandles(object);
};
