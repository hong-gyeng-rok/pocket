import { useRef, useCallback } from 'react';
import { useToolStore } from '@/app/store/useToolStore';
import { useCanvasStore, Stroke, Point } from '@/app/store/useCanvasStore';
import {
  STROKE_POINT_MIN_DISTANCE,
  createStrokeBounds,
  distanceToSegment,
  getStrokeBounds,
  pointInRect,
  simplifyStrokePoints,
} from '@/lib/canvasGeometry';

export const useDrawing = (
  screenToWorld: (x: number, y: number) => { x: number, y: number }
) => {
  const isDrawing = useRef(false);
  const currentStrokePoints = useRef<Point[]>([]);
  
  // Access store directly to avoid re-rendering hook on every stroke change
  // We need fresh strokes for collision detection
  const removeStroke = useCanvasStore((state) => state.removeStroke);
  const addStroke = useCanvasStore((state) => state.addStroke);

  const eraseAt = useCallback((x: number, y: number) => {
    const worldPos = screenToWorld(x, y);
    const strokes = useCanvasStore.getState().strokes;
    const eraserRadius = 10; // Eraser effective radius
    const eraserBounds = {
      x: worldPos.x - eraserRadius,
      y: worldPos.y - eraserRadius,
      width: eraserRadius * 2,
      height: eraserRadius * 2,
    };

    // Iterate backwards to delete top-most strokes first (optional UI preference)
    for (let i = strokes.length - 1; i >= 0; i--) {
        const stroke = strokes[i];
        let hit = false;

        const strokeBounds = getStrokeBounds(stroke, eraserRadius + stroke.size / 2);
        if (!strokeBounds || !pointInRect(worldPos, strokeBounds)) continue;

        // Point-to-Segment Check
        for (let j = 0; j < stroke.points.length - 1; j++) {
            const p1 = stroke.points[j];
            const p2 = stroke.points[j+1];
            const dist = distanceToSegment(worldPos, p1, p2);
            
            // Check if distance is within eraser radius + half stroke width
            if (dist <= eraserRadius + stroke.size / 2) {
                hit = true;
                break;
            }
        }

        if (!hit && stroke.points.length === 1) {
            hit = pointInRect(stroke.points[0], eraserBounds);
        }

        if (hit) {
            removeStroke(stroke.id);
            // Don't break if we want to erase multiple overlapping strokes at once
        }
    }
  }, [screenToWorld, removeStroke]);

  const startDrawing = useCallback((x: number, y: number) => {
    isDrawing.current = true;
    const tool = useToolStore.getState().tool;

    if (tool === 'PEN') {
      const worldPos = screenToWorld(x, y);
      currentStrokePoints.current = [worldPos];
    } else if (tool === 'ERASER') {
       // Eraser logic is handled in continueDrawing (mousemove)
       // But we can also erase on single click (mousedown)
       eraseAt(x, y);
    }
  }, [screenToWorld, eraseAt]);

  const continueDrawing = useCallback((x: number, y: number) => {
    if (!isDrawing.current) return;

    const tool = useToolStore.getState().tool;

    if (tool === 'PEN') {
        const worldPos = screenToWorld(x, y);
        const lastPoint = currentStrokePoints.current[currentStrokePoints.current.length - 1];
        
        if (lastPoint) {
            const dist = Math.hypot(worldPos.x - lastPoint.x, worldPos.y - lastPoint.y);
            if (dist > STROKE_POINT_MIN_DISTANCE) {
                currentStrokePoints.current.push(worldPos);
            }
        }
    } else if (tool === 'ERASER') {
        eraseAt(x, y);
    }
  }, [screenToWorld, eraseAt]);

  const endDrawing = useCallback(() => {
    if (!isDrawing.current) return;

    const toolState = useToolStore.getState();
    
    // Only save PEN strokes. Eraser just removes existing ones immediately.
    if (toolState.tool === 'PEN' && currentStrokePoints.current.length >= 1) {
        const simplifiedPoints = simplifyStrokePoints(currentStrokePoints.current);
        const newStroke: Stroke = {
            id: crypto.randomUUID(),
            tool: 'PEN',
            color: toolState.color,
            size: toolState.strokeWidth,
            penStyle: toolState.penStyle,
            points: simplifiedPoints,
            bounds: createStrokeBounds(simplifiedPoints),
            createdAt: Date.now(),
        };
        addStroke(newStroke);
    }
    
    isDrawing.current = false;
    currentStrokePoints.current = [];
  }, [addStroke]);

  return {
    isDrawing,
    currentStrokePoints,
    startDrawing,
    continueDrawing,
    endDrawing
  };
};
