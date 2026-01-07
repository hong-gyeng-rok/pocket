import { useEffect, useState } from 'react';
import { useCanvasStore } from '@/app/store/useCanvasStore';
import { useToolStore } from '@/app/store/useToolStore';

export const useKeyboardShortcuts = () => {
  const [isSpacePressed, setIsSpacePressed] = useState(false);
  
  // Get undo/redo from temporal store
  // useCanvasStore.temporal is a hook that gives access to the temporal state
  const { undo, redo } = useCanvasStore((state) => (useCanvasStore as any).temporal.getState());
  
  const { setTool, setColor, color } = useToolStore();

  const colors = ["#000000", "#EF4444", "#3B82F6"];

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Spacebar
      if (e.code === 'Space' && !isSpacePressed) {
        // Only trigger if not typing in a textarea
        if (document.activeElement?.tagName !== 'TEXTAREA') {
          e.preventDefault();
          setIsSpacePressed(true);
        }
      }

      // Ctrl shortcuts
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
          case 'e':
            e.preventDefault();
            setTool('ERASER');
            break;
          case 'd': // Changed from 'p' to 'd' for easier access
            e.preventDefault();
            setTool('PEN');
            break;
          case 'c':
            e.preventDefault();
            // Cycle color
            const currentIndex = colors.indexOf(color);
            const nextIndex = (currentIndex + 1) % colors.length;
            setColor(colors[nextIndex]);
            break;
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
  }, [isSpacePressed, undo, redo, setTool, setColor, color, colors]);

  return { isSpacePressed };
};
