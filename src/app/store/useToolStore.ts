import { create } from 'zustand';

// Define the types of tools available
export type ToolType = 'NONE' | 'PEN' | 'ERASER';

interface ToolState {
  tool: ToolType;
  color: string;
  strokeWidth: number;
  
  // Actions
  setTool: (tool: ToolType) => void;
  setColor: (color: string) => void;
  setStrokeWidth: (width: number) => void;
}

export const useToolStore = create<ToolState>((set) => ({
  // Initial State
  tool: 'NONE', // Default to hand tool (NONE)
  color: '#000000', // Default black
  strokeWidth: 2,

  // Actions implementation
  setTool: (tool) => set({ tool }),
  setColor: (color) => set({ color }),
  setStrokeWidth: (strokeWidth) => set({ strokeWidth }),
}));
