import { create } from 'zustand';

export type ToolType = 'SELECT' | 'HAND' | 'PEN' | 'ERASER' | 'RECTANGLE' | 'CIRCLE' | 'ARROW' | 'TEXT' | 'NONE'; 
// NONE is kept for backward compatibility but effectively means SELECT in logic usually.
// Let's migrate logic: NONE -> SELECT.

export type Mode = 'DRAWING' | 'OBJECT';

interface ToolState {
  tool: ToolType;
  mode: Mode;
  color: string;
  strokeWidth: number;
  setTool: (tool: ToolType) => void;
  setMode: (mode: Mode) => void;
  setColor: (color: string) => void;
  setStrokeWidth: (width: number) => void;
}

export const useToolStore = create<ToolState>((set) => ({
  tool: 'PEN',
  mode: 'DRAWING',
  color: '#000000',
  strokeWidth: 5,
  setTool: (tool) => set({ tool }),
  setMode: (mode) => set({ mode, tool: mode === 'DRAWING' ? 'PEN' : 'SELECT' }), 
  setColor: (color) => set({ color }),
  setStrokeWidth: (strokeWidth) => set({ strokeWidth }),
}));
