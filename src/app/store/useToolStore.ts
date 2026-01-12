import { create } from 'zustand';

export type Tool = 'NONE' | 'PEN' | 'ERASER' | 'RECTANGLE' | 'CIRCLE' | 'ARROW' | 'TEXT';
export type Mode = 'DRAWING' | 'OBJECT';

interface ToolState {
  tool: Tool;
  mode: Mode;
  color: string;
  strokeWidth: number;
  setTool: (tool: Tool) => void;
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
  setMode: (mode) => set({ mode, tool: mode === 'DRAWING' ? 'PEN' : 'NONE' }), // 모드 전환 시 기본 도구 설정
  setColor: (color) => set({ color }),
  setStrokeWidth: (strokeWidth) => set({ strokeWidth }),
}));
