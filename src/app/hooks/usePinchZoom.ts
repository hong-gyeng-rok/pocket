import { useRef, useCallback } from 'react';

interface Point {
  x: number;
  y: number;
}

export const usePinchZoom = (
  zoomCamera: (factor: number, centerX: number, centerY: number) => void,
  pan: (dx: number, dy: number) => void
) => {
  const lastPinchDistance = useRef<number | null>(null);
  const lastPinchCenter = useRef<Point | null>(null);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (e.touches.length !== 2) {
      lastPinchDistance.current = null;
      lastPinchCenter.current = null;
      return;
    }

    const t1 = e.touches[0];
    const t2 = e.touches[1];

    // Current distance between two fingers
    const distance = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
    
    // Current center point between two fingers
    const center = {
      x: (t1.clientX + t2.clientX) / 2,
      y: (t1.clientY + t2.clientY) / 2,
    };

    if (lastPinchDistance.current !== null && lastPinchCenter.current !== null) {
      // 1. Zoom Logic
      const zoomFactor = distance / lastPinchDistance.current;
      // Use a small deadzone or sensitivity for smoother zoom if needed
      if (Math.abs(zoomFactor - 1) > 0.001) {
        zoomCamera(zoomFactor, center.x, center.y);
      }

      // 2. Pan Logic (while pinching)
      const dx = center.x - lastPinchCenter.current.x;
      const dy = center.y - lastPinchCenter.current.y;
      pan(dx, dy);
    }

    lastPinchDistance.current = distance;
    lastPinchCenter.current = center;
  }, [zoomCamera, pan]);

  const handleTouchEnd = useCallback(() => {
    lastPinchDistance.current = null;
    lastPinchCenter.current = null;
  }, []);

  return {
    handleTouchMove,
    handleTouchEnd,
  };
};
