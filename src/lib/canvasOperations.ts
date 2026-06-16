import type { CanvasContent, ImageElement, Memo, Shape, Stroke } from '../app/types/canvas.ts';

export type CanvasObjectKind = 'stroke' | 'memo' | 'image' | 'shape';

export type CanvasOperation =
  | { type: 'add'; kind: 'stroke'; value: Stroke }
  | { type: 'add'; kind: 'memo'; value: Memo }
  | { type: 'add'; kind: 'image'; value: ImageElement }
  | { type: 'add'; kind: 'shape'; value: Shape }
  | { type: 'remove'; kind: 'stroke'; value: Stroke }
  | { type: 'remove'; kind: 'memo'; value: Memo }
  | { type: 'remove'; kind: 'image'; value: ImageElement }
  | { type: 'remove'; kind: 'shape'; value: Shape }
  | { type: 'update'; kind: 'memo'; id: string; before: Memo; after: Memo }
  | { type: 'update'; kind: 'image'; id: string; before: ImageElement; after: ImageElement }
  | { type: 'update'; kind: 'shape'; id: string; before: Shape; after: Shape };

const replaceById = <T extends { id: string }>(items: T[], value: T) => {
  return items.map((item) => item.id === value.id ? value : item);
};

const removeById = <T extends { id: string }>(items: T[], id: string) => {
  return items.filter((item) => item.id !== id);
};

export const invertCanvasOperation = (operation: CanvasOperation): CanvasOperation => {
  switch (operation.type) {
    case 'add':
      return { type: 'remove', kind: operation.kind, value: operation.value } as CanvasOperation;
    case 'remove':
      return { type: 'add', kind: operation.kind, value: operation.value } as CanvasOperation;
    case 'update':
      return {
        type: 'update',
        kind: operation.kind,
        id: operation.id,
        before: operation.after,
        after: operation.before,
      } as CanvasOperation;
  }
};

export const applyCanvasOperation = (
  content: CanvasContent,
  operation: CanvasOperation
): CanvasContent => {
  if (operation.kind === 'stroke') {
    return {
      ...content,
      strokes: operation.type === 'add'
        ? [...content.strokes, operation.value]
        : removeById(content.strokes, operation.value.id),
    };
  }

  if (operation.kind === 'memo') {
    if (operation.type === 'add') return { ...content, memos: [...content.memos, operation.value] };
    if (operation.type === 'remove') return { ...content, memos: removeById(content.memos, operation.value.id) };
    return { ...content, memos: replaceById(content.memos, operation.after) };
  }

  if (operation.kind === 'image') {
    if (operation.type === 'add') return { ...content, images: [...content.images, operation.value] };
    if (operation.type === 'remove') return { ...content, images: removeById(content.images, operation.value.id) };
    return { ...content, images: replaceById(content.images, operation.after) };
  }

  if (operation.type === 'add') return { ...content, shapes: [...content.shapes, operation.value] };
  if (operation.type === 'remove') return { ...content, shapes: removeById(content.shapes, operation.value.id) };
  return { ...content, shapes: replaceById(content.shapes, operation.after) };
};

export const estimateOperationBytes = (operations: CanvasOperation[]) => {
  return new Blob([JSON.stringify(operations)]).size;
};
