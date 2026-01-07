import { useRef, useCallback } from 'react';
import { useToolStore } from '@/app/store/useToolStore';
import { useCanvasStore, Stroke, Point } from '@/app/store/useCanvasStore';

// Helper: Calculate distance from point P to line segment AB
const distanceToSegment = (p: Point, a: Point, b: Point) => {
  const l2 = (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
  if (l2 === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  
  let t = ((p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y)) / l2;
  t = Math.max(0, Math.min(1, t));
  
  return Math.hypot(
    p.x - (a.x + t * (b.x - a.x)),
    p.y - (a.y + t * (b.y - a.y))
  );
};

export const useDrawing = (
  screenToWorld: (x: number, y: number) => { x: number, y: number }
) => {
  const isDrawing = useRef(false);
  const currentStrokePoints = useRef<Point[]>([]);
  
  // Access store directly to avoid re-rendering hook on every stroke change
  // We need fresh strokes for collision detection
  const removeStroke = useCanvasStore((state) => state.removeStroke);
  const addStroke = useCanvasStore((state) => state.addStroke);

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
  }, [screenToWorld]);

  const eraseAt = useCallback((x: number, y: number) => {
    const worldPos = screenToWorld(x, y);
    const strokes = useCanvasStore.getState().strokes;
    const eraserRadius = 10; // Eraser effective radius

    // Iterate backwards to delete top-most strokes first (optional UI preference)
    for (let i = strokes.length - 1; i >= 0; i--) {
        const stroke = strokes[i];
        let hit = false;

        // Bounding Box Check (Optimization)
        // If the stroke is far away, don't check every point
        // (Simple implementation skipped for brevity, but recommended for large datasets)

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

        if (hit) {
            removeStroke(stroke.id);
            // Don't break if we want to erase multiple overlapping strokes at once
        }
    }
  }, [screenToWorld, removeStroke]);

  const continueDrawing = useCallback((x: number, y: number) => {
    if (!isDrawing.current) return;

    const tool = useToolStore.getState().tool;

    if (tool === 'PEN') {
        const worldPos = screenToWorld(x, y);
        const lastPoint = currentStrokePoints.current[currentStrokePoints.current.length - 1];
        
        if (lastPoint) {
            const dist = Math.hypot(worldPos.x - lastPoint.x, worldPos.y - lastPoint.y);
            if (dist > 1) {
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
        const newStroke: Stroke = {
            id: crypto.randomUUID(),
            tool: 'PEN',
            color: toolState.color,
            size: toolState.strokeWidth,
            points: [...currentStrokePoints.current],
            createdAt: Date.now(),
        };
        addStroke(newStroke);
    }
    
    isDrawing.current = false;
    currentStrokePoints.current = [];
  }, [addStroke]);

  // Pure rendering logic for a single stroke
  const renderStroke = useCallback((
    ctx: CanvasRenderingContext2D, 
    stroke: Stroke | { points: Point[], color: string, size: number, tool: string }
  ) => {
    if (stroke.points.length < 2) return;
    
    // Skip rendering 'ERASER' strokes because we don't store them anymore 
    // (except potentially the one being drawn, but eraser has no path)
    if (stroke.tool === 'ERASER') return;
        
    ctx.beginPath();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = stroke.color;
    ctx.lineWidth = stroke.size;

    ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
    for (let i = 1; i < stroke.points.length; i++) {
        ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
    }
    ctx.stroke();
  }, []);

  return {
    isDrawing,
    currentStrokePoints,
    startDrawing,
    continueDrawing,
    endDrawing,
    renderStroke
  };
};
