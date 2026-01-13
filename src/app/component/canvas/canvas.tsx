"use client";

import { useEffect, useRef, useCallback, useState } from 'react';
import { useCanvas } from '@/app/hooks/useCanvas';
import { useCameraStore } from '@/app/store/useCameraStore';
import { useDrawing } from '@/app/hooks/useDrawing';
import { useToolStore } from '@/app/store/useToolStore';
import { useCanvasStore, Shape, Memo, ImageElement } from '@/app/store/useCanvasStore';
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
  const addImage = useCanvasStore((state) => state.addImage);
  const removeShape = useCanvasStore((state) => state.removeShape);
  const removeStroke = useCanvasStore((state) => state.removeStroke);
  const setSelectedIds = useCanvasStore((state) => state.setSelectedIds);
  const updateShape = useCanvasStore((state) => state.updateShape);
  const updateImage = useCanvasStore((state) => state.updateImage);
  const removeImage = useCanvasStore((state) => state.removeImage);
  
  // Grouping & Locking Actions
  const groupObjects = useCanvasStore((state) => state.groupObjects);
  const ungroupObjects = useCanvasStore((state) => state.ungroupObjects);
  const toggleLock = useCanvasStore((state) => state.toggleLock);
  
  // Memo related
  const memos = useCanvasStore((state) => state.memos);
  const removeMemo = useCanvasStore((state) => state.removeMemo);
  const moveMemo = useCanvasStore((state) => state.moveMemo);
  const images = useCanvasStore((state) => state.images);

  const { isSpacePressed } = useKeyboardShortcuts();
  const requestRef = useRef<number>(0);
  const isDragging = useRef(false);
  const lastMousePos = useRef({ x: 0, y: 0 });
  const currentMousePos = useRef<{ x: number, y: number } | null>(null);

  // Interaction Refs
  const isCreatingShape = useRef(false);
  const shapeStartPos = useRef({ x: 0, y: 0 });
  const [tempShape, setTempShape] = useState<{ x: number, y: number, width: number, height: number } | null>(null);

  const isResizingShape = useRef(false);
  const resizingShapeId = useRef<string | null>(null);
  const resizeAnchor = useRef({ x: 0, y: 0 }); // The fixed opposite corner (Visual Top-Left)
  const [isHoveringResizeHandle, setIsHoveringResizeHandle] = useState(false);

  const isSelecting = useRef(false);
  const selectionStartPos = useRef({ x: 0, y: 0 });
  const [selectionBox, setSelectionBox] = useState<{ x: number, y: number, width: number, height: number } | null>(null);
  
  const isMovingObjects = useRef(false);
  const copiedShapes = useRef<(Shape | Memo | ImageElement)[]>([]); 

  // Hover Handles (Quick Connect)
  const [hoverHandles, setHoverHandles] = useState<{ id: string, objectId: string, x: number, y: number }[]>([]);
  const isCreatingArrow = useRef(false); // Creating arrow from handle
  const arrowStartHandle = useRef<{ id: string, objectId: string, x: number, y: number } | null>(null);
  const [tempArrow, setTempArrow] = useState<{ x1: number, y1: number, x2: number, y2: number } | null>(null);
  const snapTarget = useRef<{ id: string, objectId: string, x: number, y: number } | null>(null); // To store snap handle
  const historyPaused = useRef(false);
  
  const imageCache = useRef<Map<string, HTMLImageElement>>(new Map());

  // Refs for Event Handlers (to avoid re-binding effect)
  const handleMouseMoveRef = useRef<(e: React.MouseEvent) => void>(() => {});
  const handleMouseUpRef = useRef<(e: React.MouseEvent) => void>(() => {});

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
    // Use 'as any' check to avoid TS narrowing 'ctx' to 'never' in the else block
    // if the environment TS definitions include 'roundRect' as a required method.
    if (typeof (ctx as any).roundRect === 'function') {
        (ctx as any).roundRect(x, y, w, h, r);
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

  // Helper: Find object by ID (generic)
  const findObject = useCallback((id: string): ((Shape & { _type: 'SHAPE' }) | (Memo & { _type: 'MEMO' }) | (ImageElement & { _type: 'IMAGE' }) | null) => {
      const { shapes, memos, images } = useCanvasStore.getState();
      const s = shapes.find(s => s.id === id);
      if (s) return { ...s, _type: 'SHAPE' };
      const m = memos.find(m => m.id === id);
      if (m) return { ...m, _type: 'MEMO' };
      const i = images.find(i => i.id === id);
      if (i) return { ...i, _type: 'IMAGE' };
      return null;
  }, []);

  // Helper: Hit Test (Includes Memos & Images)
  const hitTest = useCallback((x: number, y: number, ignoreArrows = false): { id: string, type: 'SHAPE' | 'MEMO' | 'IMAGE' } | null => {
      const { shapes, memos, images } = useCanvasStore.getState();
      // Check shapes (reverse order)
      for (let i = shapes.length - 1; i >= 0; i--) {
          const s = shapes[i];
          if (ignoreArrows && s.type === 'ARROW') continue;
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
      // Check images
      for (let i = images.length - 1; i >= 0; i--) {
          const img = images[i];
          if (x >= img.x && x <= img.x + img.width && y >= img.y && y <= img.y + img.height) {
              return { id: img.id, type: 'IMAGE' };
          }
      }
      return null;
  }, []);

  // Helper: Calculate Object Handles
  const getObjectHandles = useCallback((obj: any) => {
      if (!obj) return [];
      const { x, y, width, height, id } = obj;
      // Handles: top, right, bottom, left
      // Padding ensures handles are slightly outside
      const padding = 10;
      return [
          { id: 'top', objectId: id, x: x + width / 2, y: y - padding },
          { id: 'right', objectId: id, x: x + width + padding, y: y + height / 2 },
          { id: 'bottom', objectId: id, x: x + width / 2, y: y + height + padding },
          { id: 'left', objectId: id, x: x - padding, y: y + height / 2 },
      ];
  }, []);

  // Keyboard Shortcuts (Delete, Copy, Paste)
  const handleKeyDownRef = useRef<(e: KeyboardEvent) => void>(() => {});

  const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.key === 'Delete' || e.key === 'Backspace') {
          const hasLocked = selectedIds.some(id => {
              const obj = findObject(id);
              return obj?.isLocked;
          });
          if (hasLocked) {
              console.log("Cannot delete locked objects");
              return;
          }

          selectedIds.forEach(id => {
              if (shapes.some(s => s.id === id)) removeShape(id);
              if (memos.some(m => m.id === id)) removeMemo(id);
              if (images.some(i => i.id === id)) removeImage(id);
              if (strokes.some(s => s.id === id)) removeStroke(id);
          });
          setSelectedIds([]);
      }

      if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
          const objectsToCopy = [
              ...shapes.filter(s => selectedIds.includes(s.id)),
              ...memos.filter(m => selectedIds.includes(m.id)),
              ...images.filter(i => selectedIds.includes(i.id))
          ];
          if (objectsToCopy.length > 0) {
              copiedShapes.current = objectsToCopy;
          }
      }

      if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
          if (copiedShapes.current.length > 0) {
              const newIds: string[] = [];
              copiedShapes.current.forEach(obj => {
                  const newId = crypto.randomUUID();
                  const offset = { x: obj.x + 20, y: obj.y + 20 };
                  
                  if ('src' in obj) {
                      addImage({ ...obj, ...offset, id: newId });
                  } else if ('content' in obj) {
                      addMemo({ ...obj, ...offset, id: newId });
                  } else {
                      addShape({ ...obj, ...offset, id: newId });
                  }
                  newIds.push(newId);
              });
              setSelectedIds(newIds);
          }
      }
  };

  handleKeyDownRef.current = handleKeyDown;

  useEffect(() => {
      const handler = (e: KeyboardEvent) => handleKeyDownRef.current(e);
      window.addEventListener('keydown', handler);
      return () => window.removeEventListener('keydown', handler);
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

  // Draw Images (Layer 4 - Bottom)
  const drawImages = useCallback((ctx: CanvasRenderingContext2D) => {
      const { images, selectedIds } = useCanvasStore.getState();
      const { x, y, zoom } = useCameraStore.getState();

      ctx.save();
      ctx.scale(zoom, zoom);
      ctx.translate(-x, -y);

      images.forEach(img => {
          let imageObj = imageCache.current.get(img.src);
          if (!imageObj) {
              imageObj = new Image();
              imageObj.src = img.src;
              imageObj.onload = () => {
                  // Trigger re-render (handled by loop)
              };
              imageCache.current.set(img.src, imageObj);
          }

          if (imageObj.complete) {
              ctx.drawImage(imageObj, img.x, img.y, img.width, img.height);
          }

          // Draw Selection Outline for Images
          if (selectedIds.includes(img.id)) {
              ctx.save();
              ctx.strokeStyle = img.isLocked ? '#ef4444' : '#3b82f6'; 
              ctx.lineWidth = 2;
              const padding = 4;
              const bx = img.x - padding;
              const by = img.y - padding;
              const bw = img.width + padding * 2;
              const bh = img.height + padding * 2;
              
              ctx.strokeRect(bx, by, bw, bh);

              // Resize Handle (Bottom-Right)
              if (!img.isLocked) {
                  ctx.fillStyle = '#ffffff';
                  ctx.fillRect(bx + bw - 3, by + bh - 3, 6, 6);
                  ctx.strokeRect(bx + bw - 3, by + bh - 3, 6, 6);
              }
              ctx.restore();
          }
      });
      ctx.restore();
  }, []);

  // Draw Shapes & Selection UI (Layer 3)
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
        ctx.strokeStyle = (shape.strokeColor !== 'transparent' && shape.strokeColor) ? shape.strokeColor : (shape.fillColor || '#000000'); 
        ctx.lineWidth = shape.strokeWidth || 4;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        
        // Smart Arrow Logic
        let sx = shape.x;
        let sy = shape.y;
        let ex = shape.x + shape.width; // Default if not connected
        let ey = shape.y + shape.height;

        // If connected, update coords dynamically (in render loop for smoothness)
        // Note: For best performance, we should update store, but render-time calc is smoother for drag.
        // However, updating store is better for persistence. 
        // Here we just render. 
        
        // Actually, we use x,y,w,h from store. If sticky logic updates store, this is fine.
        
        const headLen = 20;
        const dx = ex - sx;
        const dy = ey - sy;
        const angle = Math.atan2(dy, dx);
        
        ctx.moveTo(sx, sy);
        ctx.lineTo(ex, ey);
        ctx.lineTo(ex - headLen * Math.cos(angle - Math.PI / 6), ey - headLen * Math.sin(angle - Math.PI / 6));
        ctx.moveTo(ex, ey);
        ctx.lineTo(ex - headLen * Math.cos(angle + Math.PI / 6), ey - headLen * Math.sin(angle + Math.PI / 6));
        ctx.stroke();
      }

      // Draw Selection Outline
      if (selectedIds.includes(shape.id)) {
          ctx.save();
          ctx.strokeStyle = shape.isLocked ? '#ef4444' : '#3b82f6'; 
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
          
          if (!shape.isLocked) {
              ctx.fillStyle = '#ffffff';
              ctx.fillRect(bx - 3, by - 3, 6, 6);
              ctx.strokeRect(bx - 3, by - 3, 6, 6);
              ctx.fillRect(bx + bw - 3, by + bh - 3, 6, 6);
              ctx.strokeRect(bx + bw - 3, by + bh - 3, 6, 6);
          } else {
              ctx.fillStyle = '#ef4444';
              ctx.beginPath();
              ctx.arc(bx, by, 4, 0, Math.PI*2);
              ctx.fill();
          }
          
          ctx.restore();
      }
    });

    // 2. Draw Temp Shape
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

    // 4. Draw Hover Handles
    if (hoverHandles.length > 0) {
        hoverHandles.forEach(h => {
            ctx.beginPath();
            ctx.fillStyle = '#3b82f6'; // Blue
            ctx.arc(h.x, h.y, 6, 0, Math.PI * 2);
            ctx.fill();
            // Optional: Plus icon inside?
        });
    }

    // 5. Draw Temp Arrow (Ghost Arrow)
    if (isCreatingArrow.current && tempArrow) {
        ctx.beginPath();
        ctx.strokeStyle = '#000000'; // Ghost arrow black
        ctx.lineWidth = 4;
        ctx.lineCap = 'round';
        
        const headLen = 20;
        const dx = tempArrow.x2 - tempArrow.x1;
        const dy = tempArrow.y2 - tempArrow.y1;
        const angle = Math.atan2(dy, dx);
        
        ctx.moveTo(tempArrow.x1, tempArrow.y1);
        ctx.lineTo(tempArrow.x2, tempArrow.y2);
        ctx.lineTo(tempArrow.x2 - headLen * Math.cos(angle - Math.PI / 6), tempArrow.y2 - headLen * Math.sin(angle - Math.PI / 6));
        ctx.moveTo(tempArrow.x2, tempArrow.y2);
        ctx.lineTo(tempArrow.x2 - headLen * Math.cos(angle + Math.PI / 6), tempArrow.y2 - headLen * Math.sin(angle + Math.PI / 6));
        ctx.stroke();
    }

    ctx.restore();
  }, [shapes, tempShape, currentTool, currentColor, selectedIds, selectionBox, hoverHandles, tempArrow]);

  // Drawing Loop (Strokes) - Layer 2 (Top)
  const drawStrokes = useCallback((ctx: CanvasRenderingContext2D) => {
    const { x, y, zoom } = useCameraStore.getState();
    ctx.save();
    ctx.scale(zoom, zoom);
    ctx.translate(-x, -y);
    strokes.forEach(stroke => {
        // Draw Selection Highlight
        if (selectedIds.includes(stroke.id)) {
             ctx.save();
             ctx.strokeStyle = '#3b82f6'; // Selection Blue
             ctx.lineWidth = stroke.size + 4; // Wider than original
             ctx.lineCap = 'round';
             ctx.lineJoin = 'round';
             ctx.beginPath();
             if (stroke.points.length > 0) {
                ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
                stroke.points.forEach(p => ctx.lineTo(p.x, p.y));
             }
             ctx.stroke();
             ctx.restore();
        }
        renderStroke(ctx, stroke);
    });
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
  }, [strokes, isDrawing, currentStrokePoints, renderStroke, selectedIds]);

  // Render Frame
  const render = useCallback(() => {
    const context = contextRef.current;
    if (!context || size.width === 0 || size.height === 0) return;
    context.clearRect(0, 0, size.width, size.height);
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, size.width, size.height);
    
    // Layer Priority Order:
    // 1. Images (Bottom)
    drawImages(context);
    // 2. Shapes
    drawShapes(context);
    // 3. Strokes (Pen) - Top
    drawStrokes(context);

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
  }, [contextRef, size, drawImages, drawShapes, drawStrokes, isSpacePressed]);

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

    // 1. Check Handle Click first (Priority)
    // Are we clicking on a visible hover handle?
    // We need to check distance to hoverHandles
    // Since hoverHandles are in World Coordinates (calculated below in MouseMove), we check dist.
    
    const clickedHandle = hoverHandles.find(h => {
        const dist = Math.sqrt(Math.pow(h.x - worldPos.x, 2) + Math.pow(h.y - worldPos.y, 2));
        return dist <= 20; // Increased padding for easier clicking (was 10)
    });

    if (clickedHandle) {
        // Start creating arrow
        isCreatingShape.current = false; // Safety
        isCreatingArrow.current = true;
        arrowStartHandle.current = clickedHandle;
        setTempArrow({ x1: clickedHandle.x, y1: clickedHandle.y, x2: worldPos.x, y2: worldPos.y });
        return; // Stop other interactions
    }

    // Check Resize Handle (Only if in Select mode and something is selected)
    if (tool === 'SELECT' && selectedIds.length > 0) {
        for (const id of selectedIds) {
            const obj = findObject(id);
            // Allow resize for Rect/Circle and Image.
            if (!obj || obj.isLocked) continue;
            if (obj._type === 'SHAPE' && obj.type === 'ARROW') continue;
            if (obj._type === 'MEMO') continue; // Memos have their own handles

            // Calculate Visual Bounds
            const minX = Math.min(obj.x, obj.x + obj.width);
            const minY = Math.min(obj.y, obj.y + obj.height);
            const maxX = Math.max(obj.x, obj.x + obj.width);
            const maxY = Math.max(obj.y, obj.y + obj.height);

            const padding = 4;
            // Handle is at visual bottom-right of selection box
            const handleX = maxX + padding;
            const handleY = maxY + padding;
            
            // Check Hit (8px radius)
            const dist = Math.hypot(handleX - worldPos.x, handleY - worldPos.y);
            if (dist <= 8) {
                isResizingShape.current = true;
                resizingShapeId.current = id;
                // Anchor is the Visual Top-Left. 
                resizeAnchor.current = { x: minX, y: minY };
                return;
            }
        }
    }

    if (isSpacePressed || tool === 'HAND') {
      isDragging.current = true;
      lastMousePos.current = { x: e.clientX, y: e.clientY }; 
    } 
    else if (tool === 'SELECT') {
        const hitResult = hitTest(worldPos.x, worldPos.y);
        
        if (hitResult) {
            const clickedObj = findObject(hitResult.id);
            let idsToSelect = [hitResult.id];

            // Auto-select group members
            if (clickedObj && clickedObj.groupId) {
                const groupMembers = [
                    ...shapes.filter(s => s.groupId === clickedObj.groupId).map(s => s.id),
                    ...memos.filter(m => m.groupId === clickedObj.groupId).map(m => m.id),
                    ...images.filter(i => i.groupId === clickedObj.groupId).map(i => i.id)
                ];
                idsToSelect = groupMembers;
            }

            if (e.shiftKey) {
                const newSelection = [...new Set([...selectedIds, ...idsToSelect])];
                setSelectedIds(newSelection);
            } else {
                const isAlreadySelected = selectedIds.includes(hitResult.id);
                if (!isAlreadySelected) {
                    setSelectedIds(idsToSelect);
                }
            }
            
            const effectiveSelection = e.shiftKey 
                ? [...new Set([...selectedIds, ...idsToSelect])]
                : (selectedIds.includes(hitResult.id) ? selectedIds : idsToSelect);

            const hasLocked = effectiveSelection.some(id => {
                const obj = findObject(id);
                return obj?.isLocked;
            });

            if (!hasLocked) {
                isMovingObjects.current = true;
                lastMousePos.current = { x: worldPos.x, y: worldPos.y };
            }
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

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const { x: mouseX, y: mouseY } = getMousePos(e);
    const worldPos = screenToWorld(mouseX, mouseY);
    currentMousePos.current = { x: mouseX, y: mouseY };

    // Update Hover Handles (Only if not dragging/creating)
    if (!isDragging.current && !isCreatingShape.current && !isSelecting.current && !isMovingObjects.current && !isCreatingArrow.current && !isResizingShape.current) {
        const hitResult = hitTest(worldPos.x, worldPos.y, true);
        const { selectedIds } = useCanvasStore.getState();
        
        // Check Resize Handle Hover
        let hoveringResize = false;
        if (selectedIds.length > 0) {
             for (const id of selectedIds) {
                const obj = findObject(id);
                if (!obj || obj.isLocked) continue;
                if (obj._type === 'SHAPE' && obj.type === 'ARROW') continue;
                if (obj._type === 'MEMO') continue; 
                
                const minX = Math.min(obj.x, obj.x + obj.width);
                const minY = Math.min(obj.y, obj.y + obj.height);
                const maxX = Math.max(obj.x, obj.x + obj.width);
                const maxY = Math.max(obj.y, obj.y + obj.height);
                const padding = 4;
                const handleX = maxX + padding;
                const handleY = maxY + padding;
                
                if (Math.hypot(handleX - worldPos.x, handleY - worldPos.y) <= 8) {
                    hoveringResize = true;
                    break;
                }
             }
        }
        setIsHoveringResizeHandle(hoveringResize);

        // Find object under mouse with padding for handle visibility
        let targetObj = null;
        if (hitResult) {
            targetObj = findObject(hitResult.id);
        }
        
        let keepHandles = false;
        if (hoverHandles.length > 0) {
             const isOverHandle = hoverHandles.some(h => {
                 const dist = Math.sqrt(Math.pow(h.x - worldPos.x, 2) + Math.pow(h.y - worldPos.y, 2));
                 return dist <= 25; 
             });
             if (isOverHandle) keepHandles = true;
        }

        if (targetObj) {
            setHoverHandles(getObjectHandles(targetObj));
        } else if (!keepHandles) {
            setHoverHandles([]);
        }
    }

    if (isDragging.current) {
      const dx = e.clientX - lastMousePos.current.x;
      const dy = e.clientY - lastMousePos.current.y;
      pan(dx, dy);
      lastMousePos.current = { x: e.clientX, y: e.clientY };
    }
    else if (isResizingShape.current && resizingShapeId.current) {
        // Resize Logic
        const obj = findObject(resizingShapeId.current);
        if (obj) {
            const newWidth = worldPos.x - resizeAnchor.current.x;
            const newHeight = worldPos.y - resizeAnchor.current.y;
            
            if (obj._type === 'IMAGE') {
                // Maintain Aspect Ratio for Images
                // We use the aspect ratio from the *original* object state?
                // Or current?
                // Ideally, we should have stored aspect ratio on drag start.
                // But for now, let's just calculate from current newWidth and try to match?
                // No, we need original ratio. 
                // Since `obj` is fresh from store (if using findObject inside render/callback correctly), 
                // but resizing updates store every frame. So `obj` changes.
                // Aspect ratio `obj.width / obj.height` should remain constant if we update correctly.
                const ratio = obj.width / obj.height;
                // Use Width to drive Height? Or whichever is larger?
                // Simple: Drive by Width.
                const fixedHeight = newWidth / ratio;
                
                updateImage(obj.id, {
                    x: resizeAnchor.current.x,
                    y: resizeAnchor.current.y,
                    width: newWidth,
                    height: fixedHeight
                });
            } else {
                updateShape(resizingShapeId.current, {
                    x: resizeAnchor.current.x,
                    y: resizeAnchor.current.y,
                    width: newWidth,
                    height: newHeight
                });
            }

            if (!historyPaused.current) {
                useCanvasStore.temporal.getState().pause();
                historyPaused.current = true;
            }
        }
    }
    else if (isMovingObjects.current) {
       const { shapes, memos, images, selectedIds } = useCanvasStore.getState();
       const dx = worldPos.x - lastMousePos.current.x;
       const dy = worldPos.y - lastMousePos.current.y;
       
       selectedIds.forEach(id => {
           const shape = shapes.find(s => s.id === id);
           const memo = memos.find(m => m.id === id);
           const image = images.find(i => i.id === id); 

           if (shape) {
               updateShape(id, { x: shape.x + dx, y: shape.y + dy });
           } else if (memo) {
               moveMemo(id, memo.x + dx, memo.y + dy);
           } else if (image) {
               updateImage(id, { x: image.x + dx, y: image.y + dy });
           }
       });
       lastMousePos.current = { x: worldPos.x, y: worldPos.y };

       if (!historyPaused.current) {
           useCanvasStore.temporal.getState().pause();
           historyPaused.current = true;
       }
    }
    else if (isCreatingArrow.current && tempArrow && arrowStartHandle.current) {
        // Dragging arrow
        const hitResult = hitTest(worldPos.x, worldPos.y, true);
        let targetX = worldPos.x;
        let targetY = worldPos.y;
        let foundSnap = false;

        if (hitResult && hitResult.id !== arrowStartHandle.current.objectId) {
            const obj = findObject(hitResult.id);
            if (obj) {
                const handles = getObjectHandles(obj);
                // Find closest handle
                let closest = handles[0];
                let minD = Infinity;
                handles.forEach(h => {
                     const d = Math.hypot(h.x - worldPos.x, h.y - worldPos.y);
                     if (d < minD) {
                         minD = d;
                         closest = h;
                     }
                });
                
                if (closest) {
                    setHoverHandles([closest]); // Show blue circle
                    targetX = closest.x;
                    targetY = closest.y;
                    snapTarget.current = closest;
                    foundSnap = true;
                }
            }
        }
        
        if (!foundSnap) {
            setHoverHandles([]);
            snapTarget.current = null;
        }

        setTempArrow({ 
            x1: arrowStartHandle.current.x, 
            y1: arrowStartHandle.current.y, 
            x2: targetX, 
            y2: targetY 
        });
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
  }, [screenToWorld, pan, startDrawing, continueDrawing, endDrawing, hitTest, findObject, hoverHandles, tempArrow]);

  const handleMouseUp = useCallback((e: React.MouseEvent) => {
    const tool = useToolStore.getState().tool;
    const color = useToolStore.getState().color;
    const worldPos = screenToWorld(getMousePos(e).x, getMousePos(e).y); // Need fresh pos

    if (historyPaused.current) {
        useCanvasStore.temporal.getState().resume();
        historyPaused.current = false;
    }

    if (isMovingObjects.current) {
        isMovingObjects.current = false;
    }
    else if (isResizingShape.current) {
        isResizingShape.current = false;
        resizingShapeId.current = null;
    }
    else if (isCreatingArrow.current && tempArrow && arrowStartHandle.current) {
        // Finish Arrow Creation
        let endId = undefined;
        let endX = worldPos.x;
        let endY = worldPos.y;
        
        // Use snapped target if available
        if (snapTarget.current) {
             endId = snapTarget.current.objectId;
             endX = snapTarget.current.x;
             endY = snapTarget.current.y;
        } else {
            // Check if dropped on a handle or object (fallback)
            const hitResult = hitTest(worldPos.x, worldPos.y, true);
            if (hitResult && hitResult.id !== arrowStartHandle.current.objectId) {
                endId = hitResult.id;
                const obj = findObject(endId);
                if (obj) {
                    const handles = getObjectHandles(obj);
                    let closestHandle = handles[0];
                    let minDist = Infinity;
                    handles.forEach(h => {
                        const dist = Math.sqrt(Math.pow(h.x - worldPos.x, 2) + Math.pow(h.y - worldPos.y, 2));
                        if (dist < minDist) {
                            minDist = dist;
                            closestHandle = h;
                        }
                    });
                    if (closestHandle) {
                        endX = closestHandle.x;
                        endY = closestHandle.y;
                    }
                }
            }
        }

        // Create Arrow Shape
        addShape({
            id: crypto.randomUUID(),
            type: 'ARROW',
            x: arrowStartHandle.current.x,
            y: arrowStartHandle.current.y,
            width: endX - arrowStartHandle.current.x,
            height: endY - arrowStartHandle.current.y,
            fillColor: '#000000', // Default black
            strokeColor: '#000000',
            strokeWidth: 4,
            startId: arrowStartHandle.current.objectId,
            endId: endId
        });

        isCreatingArrow.current = false;
        setTempArrow(null);
        arrowStartHandle.current = null;
        snapTarget.current = null;
        setHoverHandles([]);
    }
    else if (isSelecting.current && selectionBox) {
        const { shapes, memos, images, strokes } = useCanvasStore.getState();
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
            )).map(m => m.id),
            ...images.filter(i => (
                i.x < selectionBox.x + selectionBox.width &&
                i.x + i.width > selectionBox.x &&
                i.y < selectionBox.y + selectionBox.height &&
                i.y + i.height > selectionBox.y
            )).map(i => i.id),
            ...strokes.filter(stroke => {
                // Simple bounding box check for strokes
                // Check if any point is inside selection box
                return stroke.points.some(p => 
                    p.x >= selectionBox.x && 
                    p.x <= selectionBox.x + selectionBox.width &&
                    p.y >= selectionBox.y &&
                    p.y <= selectionBox.y + selectionBox.height
                );
            }).map(s => s.id)
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
                fillColor: color, 
                strokeColor: isArrow ? color : 'transparent',
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
  }, [screenToWorld, getMousePos, hitTest, findObject, getObjectHandles, addShape, setSelectedIds, addMemo, startDrawing, continueDrawing, endDrawing, selectionBox, tempShape, tempArrow, hoverHandles]);

  const handleMouseLeave = () => {
      if (isDragging.current) {
        endDrawing();
        isDragging.current = false;
      }
      if (isResizingShape.current) {
          isResizingShape.current = false;
          resizingShapeId.current = null;
      }
      if (isCreatingArrow.current) {
          isCreatingArrow.current = false;
          setTempArrow(null);
          arrowStartHandle.current = null;
          snapTarget.current = null;
          setHoverHandles([]);
      }
      if (historyPaused.current) {
          useCanvasStore.temporal.getState().resume();
          historyPaused.current = false;
      }
      currentMousePos.current = null;
  }

  // Update refs on render
  handleMouseMoveRef.current = handleMouseMove;
  handleMouseUpRef.current = handleMouseUp;

  // Global Event Listeners for Interaction (especially over Memos)
  useEffect(() => {
      const handleGlobalMouseMove = (e: MouseEvent) => {
          handleMouseMoveRef.current(e as unknown as React.MouseEvent);
      };
      const handleGlobalMouseUp = (e: MouseEvent) => {
          handleMouseUpRef.current(e as unknown as React.MouseEvent);
      };

      window.addEventListener('mousemove', handleGlobalMouseMove);
      window.addEventListener('mouseup', handleGlobalMouseUp);

      return () => {
          window.removeEventListener('mousemove', handleGlobalMouseMove);
          window.removeEventListener('mouseup', handleGlobalMouseUp);
          // Safety cleanup
          if (historyPaused.current) {
              useCanvasStore.temporal.getState().resume();
              historyPaused.current = false;
          }
      };
  }, [handleMouseMoveRef, handleMouseUpRef]);

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
        onDoubleClick={handleDoubleClick}
        onWheel={handleWheel}
        className={`block touch-none ${
            (currentTool === 'HAND' || isSpacePressed)
            ? 'cursor-grab active:cursor-grabbing'
            : isHoveringResizeHandle
                ? 'cursor-nwse-resize'
                : currentTool === 'SELECT'
                    ? 'cursor-default'
                    : currentTool === 'TEXT' 
                        ? 'cursor-text'
                        : (currentTool === 'PEN' || currentTool === 'ERASER')
                            ? 'cursor-none'
                            : 'cursor-default'
          }`}
      />
    </article>
  );
}
