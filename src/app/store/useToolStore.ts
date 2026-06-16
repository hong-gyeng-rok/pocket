import { create } from 'zustand';
import type { PenStyle } from '@/app/types/canvas';

export type ToolType = 'SELECT' | 'HAND' | 'PEN' | 'ERASER' | 'RECTANGLE' | 'CIRCLE' | 'ARROW' | 'TEXT' | 'NONE'; 
// NONE is kept for backward compatibility but effectively means SELECT in logic usually.
// Let's migrate logic: NONE -> SELECT.

export type Mode = 'DRAWING' | 'OBJECT';
export type CanvasBackground = 'plain' | 'paper' | 'dotted' | 'grid' | 'notebook';
export type CanvasTheme = 'clean-paper' | 'warm-notebook' | 'dark-chalkboard';

interface ToolState {
  tool: ToolType;
  mode: Mode;
  color: string;
  strokeWidth: number;
  background: CanvasBackground;
  penStyle: PenStyle;
  theme: CanvasTheme;
  readOnly: boolean;
  setTool: (tool: ToolType) => void;
  setMode: (mode: Mode) => void;
  setColor: (color: string) => void;
  setStrokeWidth: (width: number) => void;
  setBackground: (background: CanvasBackground) => void;
  setPenStyle: (penStyle: PenStyle) => void;
  setTheme: (theme: CanvasTheme) => void;
  setReadOnly: (readOnly: boolean) => void;
}

export const useToolStore = create<ToolState>((set) => ({
  tool: 'PEN',
  mode: 'DRAWING',
  color: '#000000',
  strokeWidth: 5,
  background: 'paper',
  penStyle: 'marker',
  theme: 'warm-notebook',
  readOnly: false,
  setTool: (tool) => set({ tool }),
  setMode: (mode) => set({ mode, tool: mode === 'DRAWING' ? 'PEN' : 'SELECT' }), 
  setColor: (color) => set({ color }),
  setStrokeWidth: (strokeWidth) => set({ strokeWidth }),
  setBackground: (background) => set({ background }),
  setPenStyle: (penStyle) => set({ penStyle }),
  setTheme: (theme) => set({ theme }),
  setReadOnly: (readOnly) => set({ readOnly }),
}));
