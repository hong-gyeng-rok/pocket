"use client";

import { useEffect, useRef, useCallback, useMemo, useState } from 'react';
import { useCanvas } from '@/app/hooks/useCanvas';
import { useCameraStore } from '@/app/store/useCameraStore';
import { useCanvasKeyboard } from '@/app/hooks/useCanvasKeyboard';
import { useDrawing } from '@/app/hooks/useDrawing';
import { useToolStore } from '@/app/store/useToolStore';
import { useCanvasStore } from '@/app/store/useCanvasStore';
import { useKeyboardShortcuts } from '@/app/hooks/useKeyboardShortcuts';
import {
  createRectFromPoints,
  getObjectBounds,
  getResizeHandlePoint,
  getViewportBounds,
  strokeIntersectsRect,
} from '@/lib/canvasGeometry';
import type { ObjectHandle, Rect } from '@/lib/canvasGeometry';
import {
  findCanvasObject,
  findClosestObjectHandle,
  getObjectSelectionIds,
  getResolvedObjectHandles,
  selectionHasLockedObject,
} from '@/lib/canvasSelection';
import {
  createArrowShape,
  createArrowTemp,
  createDraftRect,
  createResizeUpdate,
  getDelta,
  toShapeType,
} from '@/lib/canvasTransform';
import { createSpatialIndex, createSpatialItems, createStrokeSpatialIndex, createStrokeSpatialItems } from '@/lib/spatialIndex';
import {
  drawCanvasBackground,
  drawImagesLayer,
  drawShapesLayer,
  drawStrokesLayer,
  drawToolCursor,
} from '@/lib/canvasRenderer';
import {
  createPointerGestureState,
  getMultiTouchTapAction,
  getTwoPointerGesture,
  resetPointerGesture,
  trackPointerDown,
} from '@/lib/canvasInteraction';
import { getCursorDirtyRect, mergeDirtyRects } from '@/lib/dirtyRegion';

export default function Canvas() {
  const { canvasRef, contextRef, size } = useCanvas();

  // Use Actions (Stable)
  const pan = useCameraStore(state => state.pan);
  const zoomCamera = useCameraStore(state => state.zoomCamera);

  // Zustand State
  const currentTool = useToolStore((state) => state.tool);
  const currentColor = useToolStore((state) => state.color);
  const currentBackground = useToolStore((state) => state.background);
  const currentTheme = useToolStore((state) => state.theme);
  const readOnly = useToolStore((state) => state.readOnly);

  const strokes = useCanvasStore((state) => state.strokes);
  const shapes = useCanvasStore((state) => state.shapes);
  const selectedIds = useCanvasStore((state) => state.selectedIds);
  const addMemo = useCanvasStore((state) => state.addMemo);
  const addShape = useCanvasStore((state) => state.addShape);
  const setSelectedIds = useCanvasStore((state) => state.setSelectedIds);
  const updateShape = useCanvasStore((state) => state.updateShape);
  const updateImage = useCanvasStore((state) => state.updateImage);

  // Memo related
  const memos = useCanvasStore((state) => state.memos);
  const moveMemo = useCanvasStore((state) => state.moveMemo);
  const images = useCanvasStore((state) => state.images);

  const { isSpacePressed } = useKeyboardShortcuts();
  const requestRef = useRef<number>(0);
  const renderRef = useRef<(dirtyRect?: Rect | null) => void>(() => {});
  const pendingDirtyRect = useRef<Rect | null>(null);
  const isDragging = useRef(false);
  const lastMousePos = useRef({ x: 0, y: 0 });
  const currentMousePos = useRef<{ x: number, y: number } | null>(null);

  // Interaction Refs
  const isCreatingShape = useRef(false);
  const shapeStartPos = useRef({ x: 0, y: 0 });
  const [tempShape, setTempShape] = useState<Rect | null>(null);

  const isResizingShape = useRef(false);
  const resizingShapeId = useRef<string | null>(null);
  const resizeAnchor = useRef({ x: 0, y: 0 }); // The fixed opposite corner (Visual Top-Left)
  const [isHoveringResizeHandle, setIsHoveringResizeHandle] = useState(false);

  const isSelecting = useRef(false);
  const selectionStartPos = useRef({ x: 0, y: 0 });
  const [selectionBox, setSelectionBox] = useState<Rect | null>(null);

  const isMovingObjects = useRef(false);

  // Multi-touch Gesture State
  const pointerGesture = useRef(createPointerGestureState());

  // Hover Handles (Quick Connect)
  const [hoverHandles, setHoverHandles] = useState<ObjectHandle[]>([]);
  const isCreatingArrow = useRef(false); // Creating arrow from handle
  const arrowStartHandle = useRef<ObjectHandle | null>(null);
  const [tempArrow, setTempArrow] = useState<{ x1: number, y1: number, x2: number, y2: number } | null>(null);
  const snapTarget = useRef<ObjectHandle | null>(null); // To store snap handle
  const historyPaused = useRef(false);
  const longPressTimer = useRef<number | null>(null);
  const longPressWorldPos = useRef<{ x: number; y: number } | null>(null);
  const [gestureToast, setGestureToast] = useState<string | null>(null);

  const imageCache = useRef<Map<string, HTMLImageElement>>(new Map());

  useCanvasKeyboard();

  const clearLongPressTimer = useCallback(() => {
    if (longPressTimer.current !== null) {
      window.clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    longPressWorldPos.current = null;
  }, []);

  const showGestureToast = useCallback((message: string) => {
    setGestureToast(message);
    window.setTimeout(() => setGestureToast(null), 1100);
  }, []);

  const requestRender = useCallback((dirtyRect?: Rect | null) => {
    if (dirtyRect === undefined || dirtyRect === null) {
      pendingDirtyRect.current = null;
    } else if (pendingDirtyRect.current !== null) {
      pendingDirtyRect.current = mergeDirtyRects(pendingDirtyRect.current, dirtyRect);
    } else if (!requestRef.current) {
      pendingDirtyRect.current = dirtyRect;
    }

    if (requestRef.current) return;

    requestRef.current = requestAnimationFrame(() => {
      const dirtyRect = pendingDirtyRect.current;
      pendingDirtyRect.current = null;
      requestRef.current = 0;
      renderRef.current(dirtyRect);
    });
  }, []);

  const spatialIndex = useMemo(() => {
    return createSpatialIndex([
      ...createSpatialItems(shapes, 'SHAPE', 0),
      ...createSpatialItems(memos, 'MEMO', shapes.length),
      ...createSpatialItems(images, 'IMAGE', shapes.length + memos.length),
    ]);
  }, [images, memos, shapes]);

  const strokeSpatialIndex = useMemo(() => {
    return createStrokeSpatialIndex(createStrokeSpatialItems(strokes));
  }, [strokes]);



  // Helper: Get Mouse Position relative to Canvas Element
  const getMousePos = useCallback((e: React.PointerEvent | React.MouseEvent) => {
    if (!canvasRef.current) return { x: e.clientX, y: e.clientY };
    const rect = canvasRef.current.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
  }, [canvasRef]);

  // Coordinate conversion: Screen (Canvas Relative) -> World
  const screenToWorld = useCallback((screenX: number, screenY: number) => {
    const { x, y, zoom } = useCameraStore.getState();
    return {
      x: x + screenX / zoom,
      y: y + screenY / zoom
    };
  }, []);

  // Helper: Find object by ID (generic)
  const findObject = useCallback((id: string) => {
    const { shapes, memos, images } = useCanvasStore.getState();
    return findCanvasObject({ shapes, memos, images }, id);
  }, []);

  // Helper: Hit Test (Includes Memos & Images)
  const hitTest = useCallback((x: number, y: number, ignoreArrows = false): { id: string, type: 'SHAPE' | 'MEMO' | 'IMAGE' } | null => {
    const candidates = spatialIndex.queryPoint(x, y);
    const hit = candidates.find((candidate) => {
      const isIgnoredArrow = ignoreArrows && candidate.type === 'SHAPE' && 'type' in candidate.item && candidate.item.type === 'ARROW';
      return !isIgnoredArrow;
    });
    if (hit) return { id: hit.id, type: hit.type };
    return null;
  }, [spatialIndex]);

  // Use Drawing Hook
  const {
    isDrawing,
    currentStrokePoints,
    startDrawing,
    continueDrawing,
    endDrawing
  } = useDrawing(screenToWorld);

  // Render Frame
  const render = useCallback((dirtyRect?: Rect | null) => {
    const context = contextRef.current;
    if (!context || size.width === 0 || size.height === 0) return;

    context.save();
    if (dirtyRect) {
      context.beginPath();
      context.rect(dirtyRect.x, dirtyRect.y, dirtyRect.width, dirtyRect.height);
      context.clip();
      context.clearRect(dirtyRect.x, dirtyRect.y, dirtyRect.width, dirtyRect.height);
    } else {
      context.clearRect(0, 0, size.width, size.height);
    }

    const camera = useCameraStore.getState();
    const toolState = useToolStore.getState();
    drawCanvasBackground(context, {
      background: toolState.background,
      theme: toolState.theme,
      camera,
      size,
    });

    const viewportBounds = getViewportBounds({ ...camera, width: size.width, height: size.height });
    const visibleStrokes = strokeSpatialIndex.queryRect(viewportBounds).map((item) => item.stroke);

    // Layer Priority Order:
    // 1. Images (Bottom)
    drawImagesLayer(context, {
      images,
      selectedIds,
      camera,
      size,
      imageCache: imageCache.current,
      onImageLoad: requestRender,
    });
    // 2. Shapes
    drawShapesLayer(context, {
      shapes,
      selectedIds,
      camera,
      size,
      tempShape,
      currentTool,
      currentColor,
      isCreatingShape: isCreatingShape.current,
      selectionBox,
      isSelecting: isSelecting.current,
      hoverHandles,
      tempArrow,
      isCreatingArrow: isCreatingArrow.current,
    });
    // 3. Strokes (Pen) - Top
    drawStrokesLayer(context, {
      strokes: visibleStrokes,
      selectedIds,
      camera,
      size,
      draftStroke: isDrawing.current && currentStrokePoints.current.length > 1
        ? {
            points: currentStrokePoints.current,
            color: toolState.color,
            size: toolState.strokeWidth,
            tool: toolState.tool,
            penStyle: toolState.penStyle,
          }
        : null,
      penStyle: toolState.penStyle,
    });

    drawToolCursor(context, {
      position: currentMousePos.current,
      tool: toolState.tool,
      color: toolState.color,
      strokeWidth: toolState.strokeWidth,
      isSpacePressed,
    });
    context.restore();
  }, [
    contextRef,
    currentColor,
    currentStrokePoints,
    currentTool,
    hoverHandles,
    images,
    isDrawing,
    isSpacePressed,
    requestRender,
    selectedIds,
    selectionBox,
    shapes,
    size,
    strokeSpatialIndex,
    tempArrow,
    tempShape,
  ]);

  useEffect(() => {
    renderRef.current = render;
    requestRender();
  }, [render, requestRender]);

  useEffect(() => {
    requestRender();
  }, [currentBackground, currentTheme, requestRender]);

  useEffect(() => {
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, []);

  // Event Handlers
  const handlePointerDown = (e: React.PointerEvent) => {
    const tool = useToolStore.getState().tool;
    const isReadOnly = useToolStore.getState().readOnly;
    const { x: mouseX, y: mouseY } = getMousePos(e);
    const worldPos = screenToWorld(mouseX, mouseY);
    clearLongPressTimer();

    // 1. Update Active Pointers
    trackPointerDown(pointerGesture.current, e.pointerId, { x: mouseX, y: mouseY });

    // 2. Track Multi-touch Gestures
    if (pointerGesture.current.activePointers.size === 2) {
      // Initialize pinch state
      const { distance, center } = getTwoPointerGesture(Array.from(pointerGesture.current.activePointers.values()));
      pointerGesture.current.lastPinchDistance = distance;
      pointerGesture.current.lastPinchCenter = center;

      // Cancel drawing if more than 1 finger
      if (isDrawing.current) endDrawing();
      requestRender();
      return;
    }

    if (pointerGesture.current.activePointers.size > 1) {
      requestRender();
      return;
    }

    if (isReadOnly) {
      isDragging.current = true;
      lastMousePos.current = { x: e.clientX, y: e.clientY };
      requestRender();
      return;
    }

    if (
      e.pointerType === 'touch' &&
      (tool === 'SELECT' || tool === 'HAND') &&
      !hitTest(worldPos.x, worldPos.y)
    ) {
      longPressWorldPos.current = worldPos;
      longPressTimer.current = window.setTimeout(() => {
        const position = longPressWorldPos.current;
        if (!position || pointerGesture.current.hasMovedSignificantly) return;

        addMemo({
          id: crypto.randomUUID(),
          content: "",
          x: position.x - 110,
          y: position.y - 80,
          width: 240,
          height: 180,
          color: "#fef3c7",
        });
        showGestureToast("New note");
        clearLongPressTimer();
        requestRender();
      }, 560);
    }

    // 1. Check Handle Click first (Priority)
    const clickedHandle = hoverHandles.find(h => {
      const dist = Math.sqrt(Math.pow(h.x - worldPos.x, 2) + Math.pow(h.y - worldPos.y, 2));
          return dist <= 20;
    });

    if (clickedHandle) {
      isCreatingShape.current = false;
      isCreatingArrow.current = true;
      arrowStartHandle.current = clickedHandle;
      setTempArrow({ x1: clickedHandle.x, y1: clickedHandle.y, x2: worldPos.x, y2: worldPos.y });
      requestRender();
      return;
    }

    // Check Resize Handle (Only if in Select mode and something is selected)
    if (tool === 'SELECT' && selectedIds.length > 0) {
      for (const id of selectedIds) {
        const obj = findObject(id);
        if (!obj || obj.isLocked) continue;
        if (obj._type === 'SHAPE' && obj.type === 'ARROW') continue;
        if (obj._type === 'MEMO') continue;

        const bounds = getObjectBounds(obj);
        const handlePoint = getResizeHandlePoint(obj);

        const dist = Math.hypot(handlePoint.x - worldPos.x, handlePoint.y - worldPos.y);
        if (dist <= (e.pointerType === 'touch' ? 18 : 8)) {
          isResizingShape.current = true;
          resizingShapeId.current = id;
          resizeAnchor.current = { x: bounds.x, y: bounds.y };
          requestRender();
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
        const collections = { shapes, memos, images };
        const idsToSelect = getObjectSelectionIds(collections, hitResult.id);

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

        const hasLocked = selectionHasLockedObject(collections, effectiveSelection);

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
    requestRender();
  };

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    const { x: mouseX, y: mouseY } = getMousePos(e);
    const worldPos = screenToWorld(mouseX, mouseY);
    const previousMousePos = currentMousePos.current;
    currentMousePos.current = { x: mouseX, y: mouseY };
    if (
      previousMousePos &&
      Math.hypot(previousMousePos.x - mouseX, previousMousePos.y - mouseY) > 8
    ) {
      clearLongPressTimer();
    }
    const isCursorOnlyMove = (
      !isDragging.current &&
      !isCreatingShape.current &&
      !isSelecting.current &&
      !isMovingObjects.current &&
      !isCreatingArrow.current &&
      !isResizingShape.current &&
      !isDrawing.current
    );

    if (isCursorOnlyMove) {
      const strokeWidth = useToolStore.getState().strokeWidth;
      const previousCursorRect = getCursorDirtyRect(previousMousePos, strokeWidth);
      const nextCursorRect = getCursorDirtyRect(currentMousePos.current, strokeWidth);
      if (previousCursorRect && nextCursorRect) {
        requestRender(mergeDirtyRects(previousCursorRect, nextCursorRect));
      } else {
        requestRender(previousCursorRect ?? nextCursorRect);
      }
    } else {
      requestRender();
    }

    // 1. Update Active Pointers
    pointerGesture.current.activePointers.set(e.pointerId, { x: mouseX, y: mouseY });

    // 2. Handle Multi-touch (Pinch & Pan)
    if (pointerGesture.current.activePointers.size === 2) {
      clearLongPressTimer();
      const { distance, center } = getTwoPointerGesture(Array.from(pointerGesture.current.activePointers.values()));

      // Pinch to Zoom
      if (pointerGesture.current.lastPinchDistance !== null) {
        const factor = distance / pointerGesture.current.lastPinchDistance;
        if (Math.abs(factor - 1) > 0.002) {
          zoomCamera(factor, center.x, center.y);
          pointerGesture.current.hasMovedSignificantly = true;
        }
      }

      // Two Finger Pan
      if (pointerGesture.current.lastPinchCenter !== null) {
        const dx = center.x - pointerGesture.current.lastPinchCenter.x;
        const dy = center.y - pointerGesture.current.lastPinchCenter.y;
        if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) {
          pan(dx, dy);
          pointerGesture.current.hasMovedSignificantly = true;
        }
      }

      pointerGesture.current.lastPinchDistance = distance;
      pointerGesture.current.lastPinchCenter = center;
      requestRender();
      return;
    }

    if (pointerGesture.current.activePointers.size > 1) {
      clearLongPressTimer();
      requestRender();
      return;
    }

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

          const handlePoint = getResizeHandlePoint(obj);

          if (Math.hypot(handlePoint.x - worldPos.x, handlePoint.y - worldPos.y) <= 8) {
            hoveringResize = true;
            break;
          }
        }
      }
      setIsHoveringResizeHandle(hoveringResize);

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
        setHoverHandles(getResolvedObjectHandles(targetObj));
      } else if (!keepHandles) {
        setHoverHandles([]);
      }
    }

    if (isDragging.current) {
      const dx = e.clientX - lastMousePos.current.x;
      const dy = e.clientY - lastMousePos.current.y;
      pan(dx, dy);
      lastMousePos.current = { x: e.clientX, y: e.clientY };
      pointerGesture.current.hasMovedSignificantly = true;
    }
    else if (isResizingShape.current && resizingShapeId.current) {
      // Resize Logic
      const obj = findObject(resizingShapeId.current);
      if (obj) {
        const resizeUpdate = createResizeUpdate(obj, resizeAnchor.current, worldPos);

        if (obj._type === 'IMAGE') {
          updateImage(obj.id, resizeUpdate);
        } else {
          updateShape(resizingShapeId.current, resizeUpdate);
        }

        if (!historyPaused.current) {
          useCanvasStore.temporal.getState().pause();
          historyPaused.current = true;
        }
        pointerGesture.current.hasMovedSignificantly = true;
      }
    }
    else if (isMovingObjects.current) {
      const { shapes, memos, images, selectedIds } = useCanvasStore.getState();
      const delta = getDelta(lastMousePos.current, worldPos);

      selectedIds.forEach(id => {
        const shape = shapes.find(s => s.id === id);
        const memo = memos.find(m => m.id === id);
        const image = images.find(i => i.id === id);

        if (shape) {
          updateShape(id, { x: shape.x + delta.x, y: shape.y + delta.y });
        } else if (memo) {
          moveMemo(id, memo.x + delta.x, memo.y + delta.y);
        } else if (image) {
          updateImage(id, { x: image.x + delta.x, y: image.y + delta.y });
        }
      });
      lastMousePos.current = { x: worldPos.x, y: worldPos.y };

      if (!historyPaused.current) {
        useCanvasStore.temporal.getState().pause();
        historyPaused.current = true;
      }
      pointerGesture.current.hasMovedSignificantly = true;
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
          const closest = findClosestObjectHandle(obj, worldPos);

          if (closest) {
            setHoverHandles([closest]);
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
        ...createArrowTemp(arrowStartHandle.current, { x: targetX, y: targetY })
      });
      pointerGesture.current.hasMovedSignificantly = true;
    }
    else if (isSelecting.current) {
      const currentBox = createRectFromPoints(selectionStartPos.current, worldPos);
      setSelectionBox(currentBox);
      pointerGesture.current.hasMovedSignificantly = true;
    }
    else if (isCreatingShape.current) {
      setTempShape(createDraftRect(shapeStartPos.current, worldPos));
      pointerGesture.current.hasMovedSignificantly = true;
    }
    else {
      continueDrawing(mouseX, mouseY);
      if (isDrawing.current) pointerGesture.current.hasMovedSignificantly = true;
    }
  }, [
    continueDrawing,
    findObject,
    getMousePos,
    hitTest,
    hoverHandles,
    isDrawing,
    clearLongPressTimer,
    moveMemo,
    pan,
    screenToWorld,
    tempArrow,
    updateImage,
    updateShape,
    requestRender,
    zoomCamera,
  ]);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    const tool = useToolStore.getState().tool;
    const color = useToolStore.getState().color;
    const isReadOnly = useToolStore.getState().readOnly;
    const { x: mouseX, y: mouseY } = getMousePos(e);
    const worldPos = screenToWorld(mouseX, mouseY);

    const wasMultiTouch = pointerGesture.current.maxPointersDuringTouch > 1;

    // 1. Multi-touch Gesture Detection (Tap for Undo/Redo)
    if (wasMultiTouch) {
      const tapAction = getMultiTouchTapAction(pointerGesture.current);
      if (tapAction) {
        useCanvasStore.temporal.getState()[tapAction]();
        pointerGesture.current.isUndoRedoTriggered = true;
        showGestureToast(tapAction === 'undo' ? 'Undo' : 'Redo');
      }
    }

    // 2. Cleanup
      pointerGesture.current.activePointers.delete(e.pointerId);
      clearLongPressTimer();
    if (pointerGesture.current.activePointers.size === 0) {
      resetPointerGesture(pointerGesture.current);
    } else if (pointerGesture.current.activePointers.size === 1) {
      pointerGesture.current.lastPinchDistance = null;
      pointerGesture.current.lastPinchCenter = null;
    }

    if (wasMultiTouch) {
      isDragging.current = false;
      isSelecting.current = false;
      isCreatingShape.current = false;
      isMovingObjects.current = false;
      isCreatingArrow.current = false;
      isResizingShape.current = false;
      setTempShape(null);
      setSelectionBox(null);
      setTempArrow(null);
      endDrawing();
      requestRender();
      return;
    }

    if (isReadOnly) {
      isDragging.current = false;
      requestRender();
      return;
    }

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
      let endId = undefined;
      let endX = worldPos.x;
      let endY = worldPos.y;

      if (snapTarget.current) {
        endId = snapTarget.current.objectId;
        endX = snapTarget.current.x;
        endY = snapTarget.current.y;
      } else {
        const hitResult = hitTest(worldPos.x, worldPos.y, true);
        if (hitResult && hitResult.id !== arrowStartHandle.current.objectId) {
          endId = hitResult.id;
          const obj = findObject(endId);
          if (obj) {
            const closestHandle = findClosestObjectHandle(obj, worldPos);
            if (closestHandle) {
              endX = closestHandle.x;
              endY = closestHandle.y;
            }
          }
        }
      }

      addShape(createArrowShape(arrowStartHandle.current, { x: endX, y: endY }, endId));

      isCreatingArrow.current = false;
      setTempArrow(null);
      arrowStartHandle.current = null;
      snapTarget.current = null;
      setHoverHandles([]);
    }
    else if (isSelecting.current && selectionBox) {
      const selectedObjects = spatialIndex.queryRect(selectionBox);
      const selectedStrokes = strokeSpatialIndex.queryRect(selectionBox);
      const newSelectedIds = [
        ...selectedObjects.map((object) => object.id),
        ...selectedStrokes
          .filter((item) => strokeIntersectsRect(item.stroke, selectionBox))
          .map((item) => item.id)
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
          type: toShapeType(tool),
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
    else if (tool === 'TEXT' && !isDragging.current && !pointerGesture.current.hasMovedSignificantly) {
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
    requestRender();
  }, [screenToWorld, getMousePos, hitTest, findObject, addShape, setSelectedIds, addMemo, endDrawing, selectionBox, tempShape, tempArrow, spatialIndex, strokeSpatialIndex, requestRender, clearLongPressTimer, showGestureToast]);

  const handlePointerLeave = (e: React.PointerEvent) => {
    pointerGesture.current.activePointers.delete(e.pointerId);
    if (pointerGesture.current.activePointers.size === 0) {
      isDragging.current = false;
      isResizingShape.current = false;
      resizingShapeId.current = null;
      isCreatingArrow.current = false;
      setTempArrow(null);
      arrowStartHandle.current = null;
      snapTarget.current = null;
      setHoverHandles([]);
      if (historyPaused.current) {
        useCanvasStore.temporal.getState().resume();
        historyPaused.current = false;
      }
      endDrawing();
      currentMousePos.current = null;
      resetPointerGesture(pointerGesture.current);
      requestRender();
    }
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
    requestRender();
  };

  const handleWheel = (e: React.WheelEvent) => {
    const zoomSensitivity = 0.001;
    const delta = -e.deltaY * zoomSensitivity;
    const zoomFactor = 1 + delta;
    if (canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      zoomCamera(zoomFactor, e.clientX - rect.left, e.clientY - rect.top);
      requestRender();
    }
  };

  return (
    <article className="w-screen h-screen overflow-hidden bg-gray-100 touch-none select-none">
      {readOnly && (
        <div className="pointer-events-none absolute right-4 top-4 z-40 rounded-full border border-stone-200 bg-white/85 px-3 py-2 text-xs font-semibold text-stone-700 shadow-sm backdrop-blur">
          Read only
        </div>
      )}
      {gestureToast && (
        <div className="pointer-events-none absolute left-1/2 top-5 z-40 -translate-x-1/2 rounded-full bg-stone-900/80 px-4 py-2 text-sm font-medium text-white shadow-lg">
          {gestureToast}
        </div>
      )}
      <canvas
        ref={canvasRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerLeave}
        onDoubleClick={handleDoubleClick}
        onWheel={handleWheel}
        className={`block touch-none ${(currentTool === 'HAND' || isSpacePressed)
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
