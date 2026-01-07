import { create } from 'zustand';
import { temporal } from 'zundo';

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

interface CanvasState {
  strokes: Stroke[];
  memos: Memo[];
  
  // Actions
  addStroke: (stroke: Stroke) => void;
  setStrokes: (strokes: Stroke[]) => void;
  clearStrokes: () => void;
  removeStroke: (id: string) => void;
  
  // Memo Actions
  addMemo: (memo: Memo) => void;
  updateMemo: (id: string, content: string) => void;
  moveMemo: (id: string, x: number, y: number) => void;
  resizeMemo: (id: string, width: number, height: number) => void;
  removeMemo: (id: string) => void;
}

export const useCanvasStore = create<CanvasState>()(
  temporal((set) => ({
    strokes: [],
    memos: [],

    addStroke: (stroke) => set((state) => ({
      strokes: [...state.strokes, stroke]
    })),

    setStrokes: (strokes) => set({ strokes }),

    clearStrokes: () => set({ strokes: [] }),

    removeStroke: (id) => set((state) => ({
      strokes: state.strokes.filter((s) => s.id !== id)
    })),

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
  }))
);