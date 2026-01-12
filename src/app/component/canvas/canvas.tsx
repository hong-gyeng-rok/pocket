
"use client";

import { useEffect, useRef, useCallback, useState } from 'react';
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
  const currentColor = useToolStore((state) => state.color);
  const currentMode = useToolStore((state) => state.mode);

  const strokes = useCanvasStore((state) => state.strokes);
  const shapes = useCanvasStore((state) => state.shapes);
  const addMemo = useCanvasStore((state) => state.addMemo);
  const addShape = useCanvasStore((state) => state.addShape);

  const { isSpacePressed } = useKeyboardShortcuts();
  const requestRef = useRef<number>(0);
  const isDragging = useRef(false);
  const lastMousePos = useRef({ x: 0, y: 0 });
  const currentMousePos = useRef<{ x: number, y: number } | null>(null);

  // Shape Creation Ref
  const isCreatingShape = useRef(false);
  const shapeStartPos = useRef({ x: 0, y: 0 });
  const [tempShape, setTempShape] = useState<{ x: number, y: number, width: number, height: number } | null>(null);


  // Coordinate conversion: Screen -> World
  const screenToWorld = useCallback((screenX: number, screenY: number) => {
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

  // Draw Shapes
  const drawShapes = useCallback((ctx: CanvasRenderingContext2D) => {
    const { x, y, zoom } = useCameraStore.getState();

    ctx.save();
    ctx.scale(zoom, zoom);
    ctx.translate(-x, -y);

    // 1. Draw Saved Shapes
    shapes.forEach(shape => {
      ctx.beginPath();
      ctx.lineWidth = shape.strokeWidth || 2;
      ctx.strokeStyle = shape.strokeColor || '#000000';
      ctx.fillStyle = shape.fillColor || 'transparent'; // 나중에 채우기 지원 시

      if (shape.type === 'RECTANGLE') {
        ctx.rect(shape.x, shape.y, shape.width, shape.height);
        ctx.stroke();
      } else if (shape.type === 'CIRCLE') {
        ctx.ellipse(
            shape.x + shape.width / 2, 
            shape.y + shape.height / 2, 
            Math.abs(shape.width) / 2, 
            Math.abs(shape.height) / 2, 
            0, 0, 2 * Math.PI
        );
        ctx.stroke();
      } else if (shape.type === 'ARROW') {
        // Simple arrow logic (Start to End)
        // shape.x,y is start, width/height acts as vector to end
        const headLen = 15;
        const endX = shape.x + shape.width;
        const endY = shape.y + shape.height;
        const dx = endX - shape.x;
        const dy = endY - shape.y;
        const angle = Math.atan2(dy, dx);
        
        ctx.moveTo(shape.x, shape.y);
        ctx.lineTo(endX, endY);
        ctx.lineTo(endX - headLen * Math.cos(angle - Math.PI / 6), endY - headLen * Math.sin(angle - Math.PI / 6));
        ctx.moveTo(endX, endY);
        ctx.lineTo(endX - headLen * Math.cos(angle + Math.PI / 6), endY - headLen * Math.sin(angle + Math.PI / 6));
        ctx.stroke();
      }
    });

    // 2. Draw Temp Shape (Dragging)
    if (isCreatingShape.current && tempShape) {
       ctx.beginPath();
       ctx.strokeStyle = currentColor;
       ctx.lineWidth = 2;
       
       if (currentTool === 'RECTANGLE') {
           ctx.rect(tempShape.x, tempShape.y, tempShape.width, tempShape.height);
           ctx.stroke();
       } else if (currentTool === 'CIRCLE') {
           ctx.ellipse(
               tempShape.x + tempShape.width / 2,
               tempShape.y + tempShape.height / 2,
               Math.abs(tempShape.width) / 2,
               Math.abs(tempShape.height) / 2,
               0, 0, 2 * Math.PI
           );
           ctx.stroke();
       } else if (currentTool === 'ARROW') {
           const headLen = 15;
           const endX = tempShape.x + tempShape.width;
           const endY = tempShape.y + tempShape.height;
           const dx = endX - tempShape.x;
           const dy = endY - tempShape.y;
           const angle = Math.atan2(dy, dx);

           ctx.moveTo(tempShape.x, tempShape.y);
           ctx.lineTo(endX, endY);
           ctx.lineTo(endX - headLen * Math.cos(angle - Math.PI / 6), endY - headLen * Math.sin(angle - Math.PI / 6));
           ctx.moveTo(endX, endY);
           ctx.lineTo(endX - headLen * Math.cos(angle + Math.PI / 6), endY - headLen * Math.sin(angle + Math.PI / 6));
           ctx.stroke();
       }
    }

    ctx.restore();
  }, [shapes, tempShape, currentTool, currentColor]);


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
        tool: toolState.tool as any // Type assertion needed as tool can be RECTANGLE etc
      });
    }

    ctx.restore();
  }, [strokes, isDrawing, currentStrokePoints, renderStroke]);

  // Background Drawing Logic
  const drawBackground = useCallback((ctx: CanvasRenderingContext2D, width: number, height: number) => {
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
    
    // Draw Shapes
    drawShapes(context);

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
  }, [contextRef, size, drawBackground, drawStrokes, drawShapes, isSpacePressed]);

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
    const worldPos = screenToWorld(e.clientX, e.clientY);

    // If Space is pressed OR current tool is NONE, do Panning
    if (isSpacePressed || tool === 'NONE') {
      isDragging.current = true;
      lastMousePos.current = { x: e.clientX, y: e.clientY };
    } 
    else if (['RECTANGLE', 'CIRCLE', 'ARROW'].includes(tool)) {
      isCreatingShape.current = true;
      shapeStartPos.current = { x: worldPos.x, y: worldPos.y };
      setTempShape({ x: worldPos.x, y: worldPos.y, width: 0, height: 0 });
    }
    else if (tool === 'TEXT') {
        // Text creation logic (click to add) handled in MouseUp or separate handler
    }
    else {
      startDrawing(e.clientX, e.clientY);
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    currentMousePos.current = { x: e.clientX, y: e.clientY };
    const worldPos = screenToWorld(e.clientX, e.clientY);

    if (isDragging.current) {
      const dx = e.clientX - lastMousePos.current.x;
      const dy = e.clientY - lastMousePos.current.y;
      pan(dx, dy);
      lastMousePos.current = { x: e.clientX, y: e.clientY };
    } 
    else if (isCreatingShape.current) {
        setTempShape({
            x: shapeStartPos.current.x,
            y: shapeStartPos.current.y,
            width: worldPos.x - shapeStartPos.current.x,
            height: worldPos.y - shapeStartPos.current.y
        });
    }
    else {
      continueDrawing(e.clientX, e.clientY);
    }
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    const tool = useToolStore.getState().tool;
    const color = useToolStore.getState().color;

    if (isCreatingShape.current && tempShape) {
        if (Math.abs(tempShape.width) > 5 || Math.abs(tempShape.height) > 5) { // Prevent tiny accidental shapes
            addShape({
                id: crypto.randomUUID(),
                type: tool as 'RECTANGLE' | 'CIRCLE', // Arrow is also handled but TS might complain
                x: tempShape.x,
                y: tempShape.y,
                width: tempShape.width,
                height: tempShape.height,
                fillColor: 'transparent',
                strokeColor: color,
                strokeWidth: 2
            });
        }
        isCreatingShape.current = false;
        setTempShape(null);
    }
    else if (tool === 'TEXT' && !isDragging.current) { // Click to add text
         const worldPos = screenToWorld(e.clientX, e.clientY);
         // For now, create a memo as a text placeholder
         addMemo({
            id: crypto.randomUUID(),
            content: "New Text",
            x: worldPos.x,
            y: worldPos.y,
            width: 150,
            height: 50,
            color: 'transparent' // Transparent background for text-only feel
         });
         // Reset tool to NONE or keep TEXT? Usually keep TEXT.
    }

    endDrawing();
    isDragging.current = false;
  };

  const handleMouseLeave = () => {
      handleMouseUp({ clientX: 0, clientY: 0 } as any); // Dummy event
      currentMousePos.current = null;
  }

  const handleDoubleClick = (e: React.MouseEvent) => {
    // Only in drawing mode or select mode
    const tool = useToolStore.getState().tool;
    if (tool !== 'NONE' && tool !== 'PEN') return;

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
        onMouseLeave={handleMouseLeave}
        onDoubleClick={handleDoubleClick}
        onWheel={handleWheel}
        className={`block touch-none ${(currentTool === 'NONE' || isSpacePressed)
            ? 'cursor-grab active:cursor-grabbing'
            : currentTool === 'TEXT' 
                ? 'cursor-text'
                : 'cursor-crosshair'
          }`}
      />
    </article>
  );
}


