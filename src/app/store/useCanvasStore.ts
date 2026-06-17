import { create } from 'zustand';
import type { StoreApi, UseBoundStore } from 'zustand';
import type { CanvasOperation } from '../../lib/canvasOperations.ts';
import {
  CANVAS_HISTORY_MEMORY_LIMIT_BYTES,
  createCanvasHistory,
} from '../../lib/canvasHistory.ts';
import type { TemporalStore } from '../../lib/canvasHistory.ts';
import { toCanvasContent } from '../types/canvas.ts';
import type { CanvasContent, ImageElement, Memo, Shape, Stroke } from '../types/canvas.ts';

export type { CanvasContent, HandleType, ImageElement, Memo, Point, Shape, Stroke } from '../types/canvas.ts';
export { CANVAS_HISTORY_MEMORY_LIMIT_BYTES };

export interface CanvasState {
  strokes: Stroke[];
  memos: Memo[];
  images: ImageElement[];
  shapes: Shape[];
  selectedIds: string[];

  // Actions
  addStroke: (stroke: Stroke) => void;
  setStrokes: (strokes: Stroke[]) => void;
  clearStrokes: () => void;
  removeStroke: (id: string) => void;

  // Selection Actions
  setSelectedIds: (ids: string[]) => void;
  addSelectedId: (id: string) => void;
  clearSelection: () => void;

  // Grouping & Locking Actions
  groupObjects: (ids: string[]) => void;
  ungroupObjects: (ids: string[]) => void;
  toggleLock: (ids: string[]) => void;
  moveLayer: (ids: string[], direction: 'front' | 'forward' | 'backward' | 'back') => void;

  // Memo Actions
  addMemo: (memo: Memo) => void;
  updateMemo: (id: string, updates: Partial<Omit<Memo, 'id'>>) => void;
  moveMemo: (id: string, x: number, y: number) => void;
  resizeMemo: (id: string, width: number, height: number) => void;
  removeMemo: (id: string) => void;

  // Image Actions
  addImage: (image: ImageElement) => void;
  updateImage: (id: string, updates: Partial<Omit<ImageElement, 'id'>>) => void;
  removeImage: (id: string) => void;

  // Shape Actions
  addShape: (shape: Shape) => void;
  updateShape: (id: string, updates: Partial<Omit<Shape, 'id'>>) => void;
  removeShape: (id: string) => void;
}

const toStoreState = (content: CanvasContent) => ({
  strokes: content.strokes,
  memos: content.memos,
  images: content.images,
  shapes: content.shapes,
});

let recordOperation: (operation: CanvasOperation) => void = () => {};

const getObjectZIndex = (object: Pick<Shape | Memo | ImageElement, 'zIndex'>) => object.zIndex ?? 0;

const getLayerTargetZIndex = (
  objects: Array<Shape | Memo | ImageElement>,
  selectedIds: string[],
  direction: 'front' | 'forward' | 'backward' | 'back'
) => {
  const selected = objects.filter((object) => selectedIds.includes(object.id));
  if (selected.length === 0) return null;

  const currentValues = selected.map(getObjectZIndex);
  const currentMax = Math.max(...currentValues);
  const currentMin = Math.min(...currentValues);
  const allValues = objects.map(getObjectZIndex);

  if (direction === 'front') return Math.max(...allValues, 0) + 1;
  if (direction === 'back') return Math.min(...allValues, 0) - 1;
  if (direction === 'forward') return currentMax + 1;
  return currentMin - 1;
};

const getNextZIndex = (state: Pick<CanvasState, 'images' | 'shapes' | 'memos'>) => {
  const values = [...state.images, ...state.shapes, ...state.memos].map(getObjectZIndex);
  return Math.max(0, ...values) + 1;
};

const updateLayerValues = <T extends Shape | Memo | ImageElement>(
  objects: T[],
  selectedIds: string[],
  zIndex: number | null,
  kind: 'shape' | 'memo' | 'image'
) => {
  if (zIndex === null) return objects;

  return objects.map((object) => {
    if (!selectedIds.includes(object.id)) return object;

    const after = { ...object, zIndex };
    recordOperation({ type: 'update', kind, id: object.id, before: object, after } as CanvasOperation);
    return after;
  });
};

export const useCanvasStore = create<CanvasState>()(
  (set) => ({
    strokes: [],
    memos: [],
    images: [],
    shapes: [],
    selectedIds: [],

    addStroke: (stroke) => set((state) => {
      recordOperation({ type: 'add', kind: 'stroke', value: stroke });
      return { strokes: [...state.strokes, stroke] };
    }),

    setStrokes: (strokes) => set({ strokes }),

    clearStrokes: () => set((state) => {
      state.strokes.forEach((stroke) => recordOperation({ type: 'remove', kind: 'stroke', value: stroke }));
      return { strokes: [] };
    }),

    removeStroke: (id) => set((state) => {
      const stroke = state.strokes.find((s) => s.id === id);
      if (stroke) recordOperation({ type: 'remove', kind: 'stroke', value: stroke });
      return { strokes: state.strokes.filter((s) => s.id !== id) };
    }),

    setSelectedIds: (ids) => set({ selectedIds: ids }),

    addSelectedId: (id) => set((state) => ({
      selectedIds: state.selectedIds.includes(id) ? state.selectedIds : [...state.selectedIds, id]
    })),

    clearSelection: () => set({ selectedIds: [] }),

    groupObjects: (ids) => set((state) => {
      const newGroupId = crypto.randomUUID();
      return {
        shapes: state.shapes.map(s => ids.includes(s.id) ? { ...s, groupId: newGroupId } : s),
        memos: state.memos.map(m => ids.includes(m.id) ? { ...m, groupId: newGroupId } : m),
        images: state.images.map(i => ids.includes(i.id) ? { ...i, groupId: newGroupId } : i),
      };
    }),

    ungroupObjects: (ids) => set((state) => ({
      shapes: state.shapes.map(s => ids.includes(s.id) ? { ...s, groupId: undefined } : s),
      memos: state.memos.map(m => ids.includes(m.id) ? { ...m, groupId: undefined } : m),
      images: state.images.map(i => ids.includes(i.id) ? { ...i, groupId: undefined } : i),
    })),

    toggleLock: (ids) => set((state) => ({
      shapes: state.shapes.map(s => ids.includes(s.id) ? { ...s, isLocked: !s.isLocked } : s),
      memos: state.memos.map(m => ids.includes(m.id) ? { ...m, isLocked: !m.isLocked } : m),
      images: state.images.map(i => ids.includes(i.id) ? { ...i, isLocked: !i.isLocked } : i),
    })),

    moveLayer: (ids, direction) => set((state) => {
      const layerObjects = [...state.images, ...state.shapes, ...state.memos];
      const targetZIndex = getLayerTargetZIndex(layerObjects, ids, direction);

      return {
        images: updateLayerValues(state.images, ids, targetZIndex, 'image'),
        shapes: updateLayerValues(state.shapes, ids, targetZIndex, 'shape'),
        memos: updateLayerValues(state.memos, ids, targetZIndex, 'memo'),
      };
    }),

    addMemo: (memo) => set((state) => {
      const value = { ...memo, zIndex: memo.zIndex ?? getNextZIndex(state) };
      recordOperation({ type: 'add', kind: 'memo', value });
      return { memos: [...state.memos, value] };
    }),

    updateMemo: (id, updates) => set((state) => {
      const before = state.memos.find((m) => m.id === id);
      if (!before) return {};

      const after = { ...before, ...updates };
      recordOperation({ type: 'update', kind: 'memo', id, before, after });
      return { memos: state.memos.map((m) => m.id === id ? after : m) };
    }),

    moveMemo: (id, x, y) => set((state) => {
      const oldMemo = state.memos.find(m => m.id === id);
      if (!oldMemo) return {};

      const dx = x - oldMemo.x;
      const dy = y - oldMemo.y;

      const nextMemos = state.memos.map((m) => m.id === id ? { ...m, x, y } : m);
      const afterMemo = nextMemos.find((m) => m.id === id);
      if (afterMemo) recordOperation({ type: 'update', kind: 'memo', id, before: oldMemo, after: afterMemo });

      return {
        memos: nextMemos,
        shapes: state.shapes.map(s => {
           if (s.type === 'ARROW') {
               if (s.startId === id) {
                   return {
                       ...s,
                       x: s.x + dx,
                       y: s.y + dy,
                       width: s.width - dx,
                       height: s.height - dy
                   };
               }
               if (s.endId === id) {
                   return {
                       ...s,
                       width: s.width + dx,
                       height: s.height + dy
                   };
               }
           }
           return s;
        })
      };
    }),

    resizeMemo: (id, width, height) => set((state) => {
      const before = state.memos.find((m) => m.id === id);
      if (!before) return {};

      const after = { ...before, width, height };
      recordOperation({ type: 'update', kind: 'memo', id, before, after });
      return { memos: state.memos.map((m) => m.id === id ? after : m) };
    }),

    removeMemo: (id) => set((state) => {
      const memo = state.memos.find((m) => m.id === id);
      if (memo) recordOperation({ type: 'remove', kind: 'memo', value: memo });
      return { memos: state.memos.filter((m) => m.id !== id) };
    }),

    addImage: (image) => set((state) => {
      const value = { ...image, zIndex: image.zIndex ?? getNextZIndex(state) };
      recordOperation({ type: 'add', kind: 'image', value });
      return { images: [...state.images, value] };
    }),

    updateImage: (id, updates) => set((state) => {
      const before = state.images.find((image) => image.id === id);
      if (!before) return {};

      const after = { ...before, ...updates };
      recordOperation({ type: 'update', kind: 'image', id, before, after });
      return { images: state.images.map((img) => img.id === id ? after : img) };
    }),

    removeImage: (id) => set((state) => {
      const image = state.images.find((img) => img.id === id);
      if (image) recordOperation({ type: 'remove', kind: 'image', value: image });
      return { images: state.images.filter((img) => img.id !== id) };
    }),

    addShape: (shape) => set((state) => {
      const value = { ...shape, zIndex: shape.zIndex ?? getNextZIndex(state) };
      recordOperation({ type: 'add', kind: 'shape', value });
      return { shapes: [...state.shapes, value] };
    }),

    updateShape: (id, updates) => set((state) => {
      const oldShape = state.shapes.find(s => s.id === id);
      if (!oldShape) return {};

      const dx = (updates.x !== undefined) ? updates.x - oldShape.x : 0;
      const dy = (updates.y !== undefined) ? updates.y - oldShape.y : 0;

      const updatedShapes = state.shapes.map((s) => s.id === id ? { ...s, ...updates } : s);
      const afterShape = updatedShapes.find((s) => s.id === id);
      if (afterShape) recordOperation({ type: 'update', kind: 'shape', id, before: oldShape, after: afterShape });

      if (dx !== 0 || dy !== 0) {
           return {
               shapes: updatedShapes.map(s => {
                   if (s.type === 'ARROW') {
                       if (s.startId === id) {
                           return {
                               ...s,
                               x: s.x + dx,
                               y: s.y + dy,
                               width: s.width - dx,
                               height: s.height - dy
                           };
                       }
                       if (s.endId === id) {
                           return {
                               ...s,
                               width: s.width + dx,
                               height: s.height + dy
                           };
                       }
                   }
                   return s;
               })
           };
      }

      return { shapes: updatedShapes };
    }),

    removeShape: (id) => set((state) => {
      const shape = state.shapes.find((s) => s.id === id);
      if (shape) recordOperation({ type: 'remove', kind: 'shape', value: shape });
      return { shapes: state.shapes.filter((s) => s.id !== id) };
    }),
  })
) as UseBoundStore<StoreApi<CanvasState>> & { temporal: TemporalStore };

const history = createCanvasHistory({
  getContent: () => toCanvasContent(useCanvasStore.getState()),
  applyContent: (content) => useCanvasStore.setState(toStoreState(content)),
});

recordOperation = history.recordOperation;
useCanvasStore.temporal = history.temporalStore;
