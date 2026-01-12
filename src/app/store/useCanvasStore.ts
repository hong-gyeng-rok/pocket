import { create } from 'zustand';
import { temporal } from 'zundo';
import { persist, createJSONStorage } from 'zustand/middleware';

export interface Point {
  x: number;
  y: number;
}

export interface Stroke {
  id: string;
  tool: 'PEN' | 'ERASER';
  color: string;
  size: number;
  points: Point[];
  createdAt: number;
}

export interface Memo {
  id: string;
  content: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
}

export interface ImageElement {
  id: string;
  src: string;
  x: number;
  y: number;
  width: number;
  height: number;
  alt?: string;
}

export interface Shape {
  id: string;
  type: 'RECTANGLE' | 'CIRCLE' | 'TEXT';
  x: number;
  y: number;
  width: number;
  height: number;
  fillColor: string;
  strokeColor: string;
  strokeWidth: number;
  text?: string; // 도형 안의 텍스트 또는 텍스트 객체 내용
  textColor?: string;
}

interface CanvasState {
  strokes: Stroke[];
  memos: Memo[]; // Legacy support (can be migrated to shapes later)
  images: ImageElement[];
  shapes: Shape[];
  selectedIds: string[]; // List of selected object IDs
  
  // Actions
  addStroke: (stroke: Stroke) => void;
  setStrokes: (strokes: Stroke[]) => void;
  clearStrokes: () => void;
  removeStroke: (id: string) => void;
  
  // Selection Actions
  setSelectedIds: (ids: string[]) => void;
  addSelectedId: (id: string) => void;
  clearSelection: () => void;
  
  // Memo Actions
  addMemo: (memo: Memo) => void;
  updateMemo: (id: string, content: string) => void;
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

export const useCanvasStore = create<CanvasState>()(
  persist(
    temporal((set) => ({
      strokes: [],
      memos: [],
      images: [],
      shapes: [],
      selectedIds: [],

      addStroke: (stroke) => set((state) => ({
        strokes: [...state.strokes, stroke]
      })),

      setStrokes: (strokes) => set({ strokes }),

      clearStrokes: () => set({ strokes: [] }),

      removeStroke: (id) => set((state) => ({
        strokes: state.strokes.filter((s) => s.id !== id)
      })),

      setSelectedIds: (ids) => set({ selectedIds: ids }),
      
      addSelectedId: (id) => set((state) => ({
        selectedIds: state.selectedIds.includes(id) ? state.selectedIds : [...state.selectedIds, id]
      })),
      
      clearSelection: () => set({ selectedIds: [] }),

      addMemo: (memo) => set((state) => ({
        memos: [...state.memos, memo]
      })),

      updateMemo: (id, content) => set((state) => ({
        memos: state.memos.map((m) => m.id === id ? { ...m, content } : m)
      })),

      moveMemo: (id, x, y) => set((state) => ({
        memos: state.memos.map((m) => m.id === id ? { ...m, x, y } : m)
      })),

      resizeMemo: (id, width, height) => set((state) => ({
        memos: state.memos.map((m) => m.id === id ? { ...m, width, height } : m)
      })),

      removeMemo: (id) => set((state) => ({
        memos: state.memos.filter((m) => m.id !== id)
      })),

      addImage: (image) => set((state) => ({
        images: [...state.images, image]
      })),

      updateImage: (id, updates) => set((state) => ({
        images: state.images.map((img) => img.id === id ? { ...img, ...updates } : img)
      })),

      removeImage: (id) => set((state) => ({
        images: state.images.filter((img) => img.id !== id)
      })),

      addShape: (shape) => set((state) => ({
        shapes: [...state.shapes, shape]
      })),

      updateShape: (id, updates) => set((state) => ({
        shapes: state.shapes.map((s) => s.id === id ? { ...s, ...updates } : s)
      })),

      removeShape: (id) => set((state) => ({
        shapes: state.shapes.filter((s) => s.id !== id)
      })),
    })),
    {
      name: 'pocket-canvas-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ 
        strokes: state.strokes, 
        memos: state.memos, 
        images: state.images,
        shapes: state.shapes
      }),
    }
  )
);