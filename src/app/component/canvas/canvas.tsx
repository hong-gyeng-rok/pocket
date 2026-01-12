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
  const selectedIds = useCanvasStore((state) => state.selectedIds);
  const addMemo = useCanvasStore((state) => state.addMemo);
  const addShape = useCanvasStore((state) => state.addShape);
  const removeShape = useCanvasStore((state) => state.removeShape);
  const setSelectedIds = useCanvasStore((state) => state.setSelectedIds);
  const updateShape = useCanvasStore((state) => state.updateShape);
  
  // Memo related (for selection/deletion integration)
  const memos = useCanvasStore((state) => state.memos);
  const removeMemo = useCanvasStore((state) => state.removeMemo);
  const moveMemo = useCanvasStore((state) => state.moveMemo);

  const { isSpacePressed } = useKeyboardShortcuts();
  const requestRef = useRef<number>(0);
  const isDragging = useRef(false);
  const lastMousePos = useRef({ x: 0, y: 0 });
  const currentMousePos = useRef<{ x: number, y: number } | null>(null);

  // Interaction Refs
  const isCreatingShape = useRef(false);
  const shapeStartPos = useRef({ x: 0, y: 0 });
  const [tempShape, setTempShape] = useState<{ x: number, y: number, width: number, height: number } | null>(null);

  const isSelecting = useRef(false);
  const selectionStartPos = useRef({ x: 0, y: 0 });
  const [selectionBox, setSelectionBox] = useState<{ x: number, y: number, width: number, height: number } | null>(null);
  
  const isMovingObjects = useRef(false);
  const copiedShapes = useRef<any[]>([]); 

  // Helper: Get Mouse Position relative to Canvas Element
  const getMousePos = (e: React.MouseEvent) => {
    if (!canvasRef.current) return { x: e.clientX, y: e.clientY };
    const rect = canvasRef.current.getBoundingClientRect();
    return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
    };
  };

  // Helper: Round Rect Path
  const roundRectPath = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => {
    ctx.beginPath();
    if ("roundRect" in ctx) {
        // @ts-ignore
        ctx.roundRect(x, y, w, h, r);
    } else {
        if (w < 2 * r) r = w / 2;
        if (h < 2 * r) r = h / 2;
        ctx.moveTo(x + r, y);
        ctx.arcTo(x + w, y, x + w, y + h, r);
        ctx.arcTo(x + w, y + h, x, y + h, r);
        ctx.arcTo(x, y + h, x, y, r);
        ctx.arcTo(x, y, x + w, y, r);
        ctx.closePath();
    }
  };

  // Coordinate conversion: Screen (Canvas Relative) -> World
  const screenToWorld = useCallback((screenX: number, screenY: number) => {
    const { x, y, zoom } = useCameraStore.getState();
    return {
      x: x + screenX / zoom,
      y: y + screenY / zoom
    };
  }, []);

  // Helper: Hit Test (Includes Memos)
  const hitTest = (x: number, y: number): { id: string, type: 'SHAPE' | 'MEMO' } | null => {
      // Check shapes (reverse order)
      for (let i = shapes.length - 1; i >= 0; i--) {
          const s = shapes[i];
          const minX = Math.min(s.x, s.x + s.width);
          const maxX = Math.max(s.x, s.x + s.width);
          const minY = Math.min(s.y, s.y + s.height);
          const maxY = Math.max(s.y, s.y + s.height);
          if (x >= minX && x <= maxX && y >= minY && y <= maxY) {
              return { id: s.id, type: 'SHAPE' };
          }
      }
      // Check memos
      for (let i = memos.length - 1; i >= 0; i--) {
          const m = memos[i];
          if (x >= m.x && x <= m.x + m.width && y >= m.y && y <= m.y + m.height) {
              return { id: m.id, type: 'MEMO' };
          }
      }
      return null;
  };

  // Keyboard Shortcuts (Delete, Copy, Paste)
  useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
          if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

          if (e.key === 'Delete' || e.key === 'Backspace') {
              selectedIds.forEach(id => {
                  if (shapes.some(s => s.id === id)) removeShape(id);
                  if (memos.some(m => m.id === id)) removeMemo(id);
              });
              setSelectedIds([]);
          }

          if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
              const shapesToCopy = shapes.filter(s => selectedIds.includes(s.id));
              if (shapesToCopy.length > 0) {
                  copiedShapes.current = shapesToCopy;
              }
          }

          if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
              if (copiedShapes.current.length > 0) {
                  const newIds: string[] = [];
                  copiedShapes.current.forEach(shape => {
                      const newId = crypto.randomUUID();
                      addShape({
                          ...shape,
                          id: newId,
                          x: shape.x + 20,
                          y: shape.y + 20
                      });
                      newIds.push(newId);
                  });
                  setSelectedIds(newIds);
              }
          }
      };

      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedIds, shapes, memos, removeShape, removeMemo, addShape, setSelectedIds]);

  // Use Drawing Hook
  const {
    isDrawing,
    currentStrokePoints,
    startDrawing,
    continueDrawing,
    endDrawing,
    renderStroke
  } = useDrawing(screenToWorld);

  // Draw Shapes & Selection UI
  const drawShapes = useCallback((ctx: CanvasRenderingContext2D) => {
    const { x, y, zoom } = useCameraStore.getState();

    ctx.save();
    ctx.scale(zoom, zoom);
    ctx.translate(-x, -y);

    // 1. Draw Saved Shapes
    shapes.forEach(shape => {
      ctx.fillStyle = shape.fillColor || 'transparent';
      
      if (shape.type === 'RECTANGLE') {
        roundRectPath(ctx, shape.x, shape.y, shape.width, shape.height, 12);
        ctx.fill();
      } else if (shape.type === 'CIRCLE') {
        ctx.beginPath();
        ctx.ellipse(
            shape.x + shape.width / 2, 
            shape.y + shape.height / 2, 
            Math.abs(shape.width) / 2, 
            Math.abs(shape.height) / 2, 
            0, 0, 2 * Math.PI
        );
        ctx.fill();
      } else if (shape.type === 'ARROW') {
        ctx.beginPath();
        // Use fillColor if strokeColor is transparent/missing, because we save selected color to fillColor by default
        ctx.strokeStyle = (shape.strokeColor !== 'transparent' && shape.strokeColor) ? shape.strokeColor : (shape.fillColor || '#000000'); 
        ctx.lineWidth = shape.strokeWidth || 4;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        
        const headLen = 20;
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

      // Draw Selection Outline
      if (selectedIds.includes(shape.id)) {
          ctx.save();
          ctx.strokeStyle = '#3b82f6';
          ctx.lineWidth = 2;
          const padding = 4;
          let bx = shape.x - padding;
          let by = shape.y - padding;
          let bw = shape.width + padding * 2;
          let bh = shape.height + padding * 2;
          
          if (shape.type === 'ARROW' || shape.width < 0 || shape.height < 0) {
             const minX = Math.min(shape.x, shape.x + shape.width);
             const minY = Math.min(shape.y, shape.y + shape.height);
             const maxX = Math.max(shape.x, shape.x + shape.width);
             const maxY = Math.max(shape.y, shape.y + shape.height);
             bx = minX - padding;
             by = minY - padding;
             bw = maxX - minX + padding * 2;
             bh = maxY - minY + padding * 2;
          }

          ctx.strokeRect(bx, by, bw, bh);
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(bx - 3, by - 3, 6, 6);
          ctx.strokeRect(bx - 3, by - 3, 6, 6);
          ctx.fillRect(bx + bw - 3, by + bh - 3, 6, 6);
          ctx.strokeRect(bx + bw - 3, by + bh - 3, 6, 6);
          ctx.restore();
      }
    });

    // 2. Draw Temp Shape (Dragging)
    if (isCreatingShape.current && tempShape) {
       ctx.fillStyle = currentColor + '80';
       ctx.strokeStyle = currentColor;
       ctx.lineWidth = 1;

       if (currentTool === 'RECTANGLE') {
           roundRectPath(ctx, tempShape.x, tempShape.y, tempShape.width, tempShape.height, 12);
           ctx.fill();
           ctx.stroke();
       } else if (currentTool === 'CIRCLE') {
           ctx.beginPath();
           ctx.ellipse(
               tempShape.x + tempShape.width / 2,
               tempShape.y + tempShape.height / 2,
               Math.abs(tempShape.width) / 2,
               Math.abs(tempShape.height) / 2,
               0, 0, 2 * Math.PI
           );
           ctx.fill();
           ctx.stroke();
       } else if (currentTool === 'ARROW') {
           ctx.beginPath();
           ctx.strokeStyle = currentColor;
           ctx.lineWidth = 4;
           ctx.lineCap = 'round';
           const headLen = 20;
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

    // 3. Draw Selection Box
    if (isSelecting.current && selectionBox) {
        ctx.save();
        ctx.fillStyle = 'rgba(59, 130, 246, 0.1)';
        ctx.strokeStyle = '#3b82f6';
        ctx.lineWidth = 1;
        ctx.fillRect(selectionBox.x, selectionBox.y, selectionBox.width, selectionBox.height);
        ctx.strokeRect(selectionBox.x, selectionBox.y, selectionBox.width, selectionBox.height);
        ctx.restore();
    }

    ctx.restore();
  }, [shapes, tempShape, currentTool, currentColor, selectedIds, selectionBox]);

  // Drawing Loop (Strokes)
  const drawStrokes = useCallback((ctx: CanvasRenderingContext2D) => {
    const { x, y, zoom } = useCameraStore.getState();
    ctx.save();
    ctx.scale(zoom, zoom);
    ctx.translate(-x, -y);
    strokes.forEach(stroke => renderStroke(ctx, stroke));
    if (isDrawing.current && currentStrokePoints.current.length > 1) {
      const toolState = useToolStore.getState();
      renderStroke(ctx, {
        points: currentStrokePoints.current,
        color: toolState.color,
        size: toolState.strokeWidth,
        tool: toolState.tool as any
      });
    }
    ctx.restore();
  }, [strokes, isDrawing, currentStrokePoints, renderStroke]);

  // Render Frame
  const render = useCallback(() => {
    const context = contextRef.current;
    if (!context || size.width === 0 || size.height === 0) return;
    context.clearRect(0, 0, size.width, size.height);
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, size.width, size.height);
    drawStrokes(context);
    drawShapes(context);

    const toolState = useToolStore.getState();
    if (currentMousePos.current && toolState.tool !== 'HAND' && toolState.tool !== 'SELECT' && !isSpacePressed) {
      const { x, y } = currentMousePos.current;
      context.save();
      context.beginPath();
      if (toolState.tool === 'PEN') {
        context.fillStyle = toolState.color;
        const radius = Math.max(toolState.strokeWidth / 2, 2);
        context.arc(x, y, radius, 0, Math.PI * 2);
        context.fill();
      } else if (toolState.tool === 'ERASER') {
        context.strokeStyle = '#000000';
        context.lineWidth = 1;
        context.arc(x, y, 10, 0, Math.PI * 2);
        context.stroke();
      }
      context.restore();
    }
  }, [contextRef, size, drawStrokes, drawShapes, isSpacePressed]);

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
    const { x: mouseX, y: mouseY } = getMousePos(e);
    const worldPos = screenToWorld(mouseX, mouseY);

    if (isSpacePressed || tool === 'HAND') {
      isDragging.current = true;
      lastMousePos.current = { x: e.clientX, y: e.clientY }; 
    } 
    else if (tool === 'SELECT') {
        const hitResult = hitTest(worldPos.x, worldPos.y);
        if (hitResult) {
            if (!selectedIds.includes(hitResult.id)) {
                if (e.shiftKey) setSelectedIds([...selectedIds, hitResult.id]);
                else setSelectedIds([hitResult.id]);
            }
            isMovingObjects.current = true;
            lastMousePos.current = { x: worldPos.x, y: worldPos.y };
        } else {
            if (!e.shiftKey) setSelectedIds([]);
            isSelecting.current = true;
            selectionStartPos.current = { x: worldPos.x, y: worldPos.y };
            setSelectionBox({ x: worldPos.x, y: worldPos.y, width: 0, height: 0 });
        }
    }
    else if (['RECTANGLE', 'CIRCLE', 'ARROW'].includes(tool)) {
      isCreatingShape.current = true;
      shapeStartPos.current = { x: worldPos.x, y: worldPos.y };
      setTempShape({ x: worldPos.x, y: worldPos.y, width: 0, height: 0 });
    }
    else if (['PEN', 'ERASER'].includes(tool)) {
      startDrawing(mouseX, mouseY);
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const { x: mouseX, y: mouseY } = getMousePos(e);
    const worldPos = screenToWorld(mouseX, mouseY);
    currentMousePos.current = { x: mouseX, y: mouseY };

    if (isDragging.current) {
      const dx = e.clientX - lastMousePos.current.x;
      const dy = e.clientY - lastMousePos.current.y;
      pan(dx, dy);
      lastMousePos.current = { x: e.clientX, y: e.clientY };
    }
    else if (isMovingObjects.current) {
       const dx = worldPos.x - lastMousePos.current.x;
       const dy = worldPos.y - lastMousePos.current.y;
       selectedIds.forEach(id => {
           const shape = shapes.find(s => s.id === id);
           if (shape) updateShape(id, { x: shape.x + dx, y: shape.y + dy });
           const memo = memos.find(m => m.id === id);
           if (memo) moveMemo(id, memo.x + dx, memo.y + dy);
       });
       lastMousePos.current = { x: worldPos.x, y: worldPos.y };
    }
    else if (isSelecting.current) {
        const currentBox = {
            x: Math.min(selectionStartPos.current.x, worldPos.x),
            y: Math.min(selectionStartPos.current.y, worldPos.y),
            width: Math.abs(worldPos.x - selectionStartPos.current.x),
            height: Math.abs(worldPos.y - selectionStartPos.current.y)
        };
        setSelectionBox(currentBox);
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
      continueDrawing(mouseX, mouseY);
    }
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    const tool = useToolStore.getState().tool;
    const color = useToolStore.getState().color;

    if (isMovingObjects.current) {
        isMovingObjects.current = false;
    }
    else if (isSelecting.current && selectionBox) {
        const newSelectedIds = [
            ...shapes.filter(s => (
                s.x < selectionBox.x + selectionBox.width &&
                s.x + s.width > selectionBox.x &&
                s.y < selectionBox.y + selectionBox.height &&
                s.y + s.height > selectionBox.y
            )).map(s => s.id),
            ...memos.filter(m => (
                m.x < selectionBox.x + selectionBox.width &&
                m.x + m.width > selectionBox.x &&
                m.y < selectionBox.y + selectionBox.height &&
                m.y + m.height > selectionBox.y
            )).map(m => m.id)
        ];
        setSelectedIds(newSelectedIds);
        isSelecting.current = false;
        setSelectionBox(null);
    }
    else if (isCreatingShape.current && tempShape) {
        if (Math.abs(tempShape.width) > 5 || Math.abs(tempShape.height) > 5) {
            const isArrow = tool === 'ARROW';
            addShape({
                id: crypto.randomUUID(),
                type: tool as any,
                x: tempShape.x,
                y: tempShape.y,
                width: tempShape.width,
                height: tempShape.height,
                // For Arrow, we use fillColor slot to store the main color, 
                // and renderer will use it as stroke. 
                fillColor: color, 
                strokeColor: isArrow ? color : 'transparent', // Explicitly set stroke for arrow if needed
                strokeWidth: isArrow ? 4 : 0
            });
        }
        isCreatingShape.current = false;
        setTempShape(null);
    }
    else if (tool === 'TEXT' && !isDragging.current) {
         const { x: mouseX, y: mouseY } = getMousePos(e);
         const worldPos = screenToWorld(mouseX, mouseY);
         addMemo({
            id: crypto.randomUUID(),
            content: "",
            x: worldPos.x,
            y: worldPos.y,
            width: 250,
            height: 200,
            color: 'transparent'
         });
         useToolStore.getState().setTool('SELECT');
    }

    endDrawing();
    isDragging.current = false;
  };

  const handleMouseLeave = () => {
      if (isDragging.current) {
        endDrawing();
        isDragging.current = false;
      }
      currentMousePos.current = null;
  }

  const handleDoubleClick = (e: React.MouseEvent) => {
    const tool = useToolStore.getState().tool;
    if (tool !== 'SELECT' && tool !== 'PEN') return;
    const { x: mouseX, y: mouseY } = getMousePos(e);
    const worldPos = screenToWorld(mouseX, mouseY);
    addMemo({
        id: crypto.randomUUID(),
        content: "",
        x: worldPos.x - 100,
        y: worldPos.y - 75,
        width: 250,
        height: 200,
        color: "#fef3c7",
    });
  };

  const handleWheel = (e: React.WheelEvent) => {
    const zoomSensitivity = 0.001;
    const delta = -e.deltaY * zoomSensitivity;
    const zoomFactor = 1 + delta;
    if (canvasRef.current) {
        const rect = canvasRef.current.getBoundingClientRect();
        zoomCamera(zoomFactor, e.clientX - rect.left, e.clientY - rect.top);
    }
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
        className={`block touch-none ${
            (currentTool === 'HAND' || isSpacePressed)
            ? 'cursor-grab active:cursor-grabbing'
            : currentTool === 'SELECT'
                ? 'cursor-default'
                : currentTool === 'TEXT' 
                    ? 'cursor-text'
                    : 'cursor-crosshair'
          }`}
      />
    </article>
  );
}