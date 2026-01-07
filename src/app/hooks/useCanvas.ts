import { useEffect, useRef, useState } from 'react';

export const useCanvas = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const contextRef = useRef<CanvasRenderingContext2D | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    contextRef.current = ctx;

    const updateSize = () => {
      const parent = canvas.parentElement;
      if (parent) {
        const { clientWidth, clientHeight } = parent;
        const dpr = window.devicePixelRatio || 1;
        
        canvas.width = clientWidth * dpr;
        canvas.height = clientHeight * dpr;
        
        canvas.style.width = `${clientWidth}px`;
        canvas.style.height = `${clientHeight}px`;
        
        // Context might be reset on resize in some browsers, but scale needs re-applying
        // However, standard 2D context persists. We just need to scale.
        // *Critial Fix*: transform resets on resize.
        ctx.setTransform(1, 0, 0, 1, 0, 0); // Reset transform
        ctx.scale(dpr, dpr);

        setSize({ width: clientWidth, height: clientHeight });
      }
    };

    updateSize();

    const resizeObserver = new ResizeObserver(() => {
        updateSize();
    });
    
    if (canvas.parentElement) {
        resizeObserver.observe(canvas.parentElement);
    }

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  return { canvasRef, contextRef, size };
};
