import { useEffect, useState } from 'react';
import { useCanvasStore } from '@/app/store/useCanvasStore';
import { useToolStore } from '@/app/store/useToolStore';

interface TemporalStore {
  getState: () => {
    undo: () => void;
    redo: () => void;
  };
}

const getTemporalStore = () => {
  return (useCanvasStore as unknown as { temporal?: TemporalStore }).temporal;
};

const DRAWING_COLORS = ["#000000", "#ef4444", "#3b82f6"];
const OBJECT_COLORS = [
  "#000000", "#ffffff", "#FECACA", "#FED7AA", "#FEF08A", "#BBF7D0", "#BFDBFE", "#E9D5FF", "#FBCFE8"
];

export const useKeyboardShortcuts = () => {
  const [isSpacePressed, setIsSpacePressed] = useState(false);

  const { setTool, setMode, mode, setColor, color } = useToolStore();

  useEffect(() => {
    const temporal = getTemporalStore();
    const undo = temporal ? temporal.getState().undo : () => {};
    const redo = temporal ? temporal.getState().redo : () => {};

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore inputs
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || (e.target as HTMLElement).isContentEditable) {
        return;
      }

      // Space
      if (e.code === 'Space' && !isSpacePressed) {
        e.preventDefault();
        setIsSpacePressed(true);
      }

      // Tab (Mode Toggle)
      if (e.key === 'Tab') {
          e.preventDefault();
          setMode(mode === 'DRAWING' ? 'OBJECT' : 'DRAWING');
      }

      // Ctrl Shortcuts
      if (e.ctrlKey || e.metaKey) {
        switch (e.key.toLowerCase()) {
          case 'z':
            e.preventDefault();
            undo();
            break;
          case 'y':
            e.preventDefault();
            redo();
            break;
          // Ctrl+C is Copy (handled in Canvas), don't use here
        }
      } else {
          // Single Key Shortcuts
          const key = e.key.toLowerCase();
          
          // Color Cycle (C)
          if (key === 'c') {
              const activeColors = mode === 'DRAWING' ? DRAWING_COLORS : OBJECT_COLORS;
              const currentIndex = activeColors.indexOf(color);
              let nextIndex = 0;
              
              if (currentIndex !== -1) {
                  nextIndex = (currentIndex + 1) % activeColors.length;
              } else {
                  // If current color is not in the active palette (e.g. custom color or switched mode),
                  // start from the beginning (Black)
                  nextIndex = 0;
              }
              setColor(activeColors[nextIndex]);
          }

          // Tool Switching
          if (mode === 'DRAWING') {
              if (key === 'd') setTool('PEN');
              if (key === 'e') setTool('ERASER');
              if (key === 'h') setTool('HAND');
              if (key === 'v') setTool('SELECT');
          } else {
              if (key === 'v') setTool('SELECT');
              if (key === 'h') setTool('HAND');
              if (key === 'r') setTool('RECTANGLE');
              if (key === 'o') setTool('CIRCLE');
              if (key === 'a') setTool('ARROW');
              if (key === 't') setTool('TEXT');
          }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        setIsSpacePressed(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [mode, isSpacePressed, setTool, setMode, setColor, color]);

  return { isSpacePressed };
};
