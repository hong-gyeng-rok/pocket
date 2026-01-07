
"use client";

import { useEffect, useRef, useCallback } from 'react';
import { useCanvas } from '@/app/hooks/useCanvas';
import { useCameraStore } from '@/app/store/useCameraStore';
import { useDrawing } from '@/app/hooks/useDrawing';
import { useToolStore } from '@/app/store/useToolStore';
import { useCanvasStore } from '@/app/store/useCanvasStore';
import { useKeyboardShortcuts } from '@/app/hooks/useKeyboardShortcuts';

export default function Canvas() {
  const { canvasRef, contextRef, size } = useCanvas();

  // Use Actions (Stable)
  const pan = useCameraStore(state => state.pan);
  const zoomCamera = useCameraStore(state => state.zoomCamera);

    // Zustand State
    const currentTool = useToolStore((state) => state.tool);
    const strokes = useCanvasStore((state) => state.strokes);
    const addMemo = useCanvasStore((state) => state.addMemo);
  
    const { isSpacePressed } = useKeyboardShortcuts();
    const requestRef = useRef<number>(0);
  const isDragging = useRef(false);
  const lastMousePos = useRef({ x: 0, y: 0 });
  const currentMousePos = useRef<{ x: number, y: number } | null>(null);

  // Coordinate conversion: Screen -> World
  const screenToWorld = useCallback((screenX: number, screenY: number) => {
    // Access store directly to avoid dependency on changing state
    const { x, y, zoom } = useCameraStore.getState();
    return {
      x: x + screenX / zoom,
      y: y + screenY / zoom
    };
  }, []);

  // Use Drawing Hook
  const {
    isDrawing,
    currentStrokePoints,
    startDrawing,
    continueDrawing,
    endDrawing,
    renderStroke
  } = useDrawing(screenToWorld);

  // Drawing Loop
  const drawStrokes = useCallback((ctx: CanvasRenderingContext2D) => {
    // Direct store access
    const { x, y, zoom } = useCameraStore.getState();

    ctx.save();
    ctx.scale(zoom, zoom);
    ctx.translate(-x, -y);

    // 1. Draw already finished strokes
    strokes.forEach(stroke => renderStroke(ctx, stroke));

    // 2. Draw currently drawing stroke
    if (isDrawing.current && currentStrokePoints.current.length > 1) {
      const toolState = useToolStore.getState();
      renderStroke(ctx, {
        points: currentStrokePoints.current,
        color: toolState.color,
        size: toolState.strokeWidth,
        tool: toolState.tool
      });
    }

    ctx.restore();
  }, [strokes, isDrawing, currentStrokePoints, renderStroke]);

  // Background Drawing Logic
  const drawBackground = useCallback((ctx: CanvasRenderingContext2D, width: number, height: number) => {
    // Background (White)
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
  }, []);

  // Render Single Frame
  const render = useCallback(() => {
    const context = contextRef.current;
    if (!context || size.width === 0 || size.height === 0) return;

    // Clear Screen
    context.clearRect(0, 0, size.width, size.height);

    // Draw Background
    drawBackground(context, size.width, size.height);

    // Draw Strokes (World Coordinates)
    drawStrokes(context);

    // Draw Custom Cursor (Screen Coordinates)
    const toolState = useToolStore.getState();
    // Only show custom cursor if space is NOT pressed (meaning we are not in temporary pan mode)
    if (currentMousePos.current && toolState.tool !== 'NONE' && !isSpacePressed) {
      const { x, y } = currentMousePos.current;
      const { color, strokeWidth, tool } = toolState;

      context.save();
      context.beginPath();

      if (tool === 'PEN') {
        context.fillStyle = color;
        const radius = Math.max(strokeWidth / 2, 2);
        context.arc(x, y, radius, 0, Math.PI * 2);
        context.fill();
      } else if (tool === 'ERASER') {
        context.strokeStyle = '#000000';
        context.lineWidth = 1;
        const radius = 10;
        context.arc(x, y, radius, 0, Math.PI * 2);
        context.stroke();
      }

              context.restore();
          }
        }, [contextRef, size, drawBackground, drawStrokes, isSpacePressed]);
      
        // Start Loop
        useEffect(() => {
          const loop = () => {
              render();
              requestRef.current = requestAnimationFrame(loop);
          };
          
          requestRef.current = requestAnimationFrame(loop);
          return () => cancelAnimationFrame(requestRef.current);
        }, [render]);
        // Event Handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    const tool = useToolStore.getState().tool;

    // If Space is pressed OR current tool is NONE, do Panning
    if (isSpacePressed || tool === 'NONE') {
      isDragging.current = true;
      lastMousePos.current = { x: e.clientX, y: e.clientY };
    } else {
      startDrawing(e.clientX, e.clientY);
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    currentMousePos.current = { x: e.clientX, y: e.clientY };

    if (isDragging.current) {
      const dx = e.clientX - lastMousePos.current.x;
      const dy = e.clientY - lastMousePos.current.y;
      pan(dx, dy);
      lastMousePos.current = { x: e.clientX, y: e.clientY };
    } else {
      continueDrawing(e.clientX, e.clientY);
    }
  };

  const handleMouseUp = () => {
    endDrawing();
    isDragging.current = false;
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    const worldPos = screenToWorld(e.clientX, e.clientY);
    
    addMemo({
        id: crypto.randomUUID(),
        content: "",
        x: worldPos.x - 100, // Center memo
        y: worldPos.y - 75,
        width: 200,
        height: 150,
        color: "#fef3c7", // Amber-100
    });
  };
    const handleWheel = (e: React.WheelEvent) => {
    // Determine zoom direction
    const zoomSensitivity = 0.001;
    const delta = -e.deltaY * zoomSensitivity;
    const zoomFactor = 1 + delta;

    zoomCamera(zoomFactor, e.clientX, e.clientY);
  };

  return (
    <article className="w-screen h-screen overflow-hidden bg-gray-100">
      <canvas
        ref={canvasRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={() => {
          handleMouseUp();
          currentMousePos.current = null; // Hide cursor when leaving canvas
        }}
        onDoubleClick={handleDoubleClick}
        onWheel={handleWheel}
        className={`block touch-none ${(currentTool === 'NONE' || isSpacePressed)
            ? 'cursor-grab active:cursor-grabbing'
            : 'cursor-none'
          }`}
      />
    </article>
  );
}


