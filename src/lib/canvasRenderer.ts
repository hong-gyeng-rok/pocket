import type { ImageElement, Point, Shape, Stroke } from '@/app/types/canvas';
import type { PenStyle } from '@/app/types/canvas';
import type { CanvasBackground, CanvasTheme, ToolType } from '@/app/store/useToolStore';
import {
  getObjectBounds,
  getStrokeBounds,
  getViewportBounds,
  rectsIntersect,
} from '@/lib/canvasGeometry';
import type { ObjectHandle, Rect } from '@/lib/canvasGeometry';

export interface CanvasSize {
  width: number;
  height: number;
}

export interface CameraView {
  x: number;
  y: number;
  zoom: number;
}

export interface DraftStroke {
  points: Point[];
  color: string;
  size: number;
  tool: ToolType;
  penStyle: PenStyle;
}

export interface DrawImagesOptions {
  images: ImageElement[];
  selectedIds: string[];
  camera: CameraView;
  size: CanvasSize;
  imageCache: Map<string, HTMLImageElement>;
  onImageLoad?: () => void;
}

export interface DrawShapesOptions {
  shapes: Shape[];
  selectedIds: string[];
  camera: CameraView;
  size: CanvasSize;
  tempShape: Rect | null;
  currentTool: ToolType;
  currentColor: string;
  isCreatingShape: boolean;
  selectionBox: Rect | null;
  isSelecting: boolean;
  hoverHandles: ObjectHandle[];
  tempArrow: { x1: number; y1: number; x2: number; y2: number } | null;
  isCreatingArrow: boolean;
}

export interface DrawStrokesOptions {
  strokes: Stroke[];
  selectedIds: string[];
  camera: CameraView;
  size: CanvasSize;
  draftStroke: DraftStroke | null;
  penStyle: PenStyle;
}

export interface DrawCursorOptions {
  position: Point | null;
  tool: ToolType;
  color: string;
  strokeWidth: number;
  isSpacePressed: boolean;
}

export interface DrawBackgroundOptions {
  background: CanvasBackground;
  theme: CanvasTheme;
  camera: CameraView;
  size: CanvasSize;
}

const applyCameraTransform = (ctx: CanvasRenderingContext2D, camera: CameraView) => {
  ctx.scale(camera.zoom, camera.zoom);
  ctx.translate(-camera.x, -camera.y);
};

const seededNoise = (seed: string, index: number) => {
  let hash = 2166136261;
  const value = `${seed}:${index}`;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return ((hash >>> 0) / 4294967295) * 2 - 1;
};

const jitter = (seed: string, index: number, amount: number) => seededNoise(seed, index) * amount;

const normalizeDrawableRect = (shape: Shape | Rect): Rect => {
  const x = Math.min(shape.x, shape.x + shape.width);
  const y = Math.min(shape.y, shape.y + shape.height);
  return {
    x,
    y,
    width: Math.abs(shape.width),
    height: Math.abs(shape.height),
  };
};

const drawSketchLine = (
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  seed: string,
  amount = 1.8
) => {
  ctx.moveTo(x1 + jitter(seed, 1, amount), y1 + jitter(seed, 2, amount));
  const midX = (x1 + x2) / 2 + jitter(seed, 3, amount * 1.4);
  const midY = (y1 + y2) / 2 + jitter(seed, 4, amount * 1.4);
  ctx.quadraticCurveTo(midX, midY, x2 + jitter(seed, 5, amount), y2 + jitter(seed, 6, amount));
};

const drawSketchRect = (ctx: CanvasRenderingContext2D, shape: Shape | Rect, seed: string) => {
  const { x, y, width, height } = normalizeDrawableRect(shape);

  ctx.beginPath();
  drawSketchLine(ctx, x, y, x + width, y, `${seed}:top`);
  drawSketchLine(ctx, x + width, y, x + width, y + height, `${seed}:right`);
  drawSketchLine(ctx, x + width, y + height, x, y + height, `${seed}:bottom`);
  drawSketchLine(ctx, x, y + height, x, y, `${seed}:left`);
  ctx.closePath();
};

const drawSketchEllipse = (ctx: CanvasRenderingContext2D, shape: Shape | Rect, seed: string) => {
  const { x, y, width, height } = normalizeDrawableRect(shape);
  const cx = x + width / 2;
  const cy = y + height / 2;
  const rx = width / 2;
  const ry = height / 2;

  ctx.beginPath();
  for (let i = 0; i <= 32; i++) {
    const angle = (i / 32) * Math.PI * 2;
    const wobble = 1 + jitter(seed, i, 0.035);
    const x = cx + Math.cos(angle) * rx * wobble;
    const y = cy + Math.sin(angle) * ry * wobble;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
};

const drawFillTexture = (ctx: CanvasRenderingContext2D, shape: Shape, seed: string) => {
  if (!shape.fillColor || shape.fillColor === 'transparent') return;

  const bounds = normalizeDrawableRect(shape);
  const gap = 13;
  ctx.save();
  ctx.clip();
  ctx.globalAlpha = 0.13;
  ctx.strokeStyle = '#5f5142';
  ctx.lineWidth = 1;
  for (let x = bounds.x - bounds.height; x < bounds.x + bounds.width + bounds.height; x += gap) {
    ctx.beginPath();
    ctx.moveTo(x + jitter(seed, Math.floor(x), 2), bounds.y + bounds.height);
    ctx.lineTo(x + bounds.height + jitter(seed, Math.floor(x) + 1, 2), bounds.y);
    ctx.stroke();
  }
  ctx.restore();
};

const drawSketchArrow = (
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  color: string,
  width: number,
  seed: string
) => {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  drawSketchLine(ctx, x1, y1, x2, y2, `${seed}:shaft`, 2.1);

  const headLen = 20;
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const hx1 = x2 - headLen * Math.cos(angle - Math.PI / 6);
  const hy1 = y2 - headLen * Math.sin(angle - Math.PI / 6);
  const hx2 = x2 - headLen * Math.cos(angle + Math.PI / 6);
  const hy2 = y2 - headLen * Math.sin(angle + Math.PI / 6);
  drawSketchLine(ctx, x2, y2, hx1, hy1, `${seed}:head-a`, 1.5);
  drawSketchLine(ctx, x2, y2, hx2, hy2, `${seed}:head-b`, 1.5);
  ctx.stroke();
  ctx.restore();
};

const getScreenOffset = (cameraValue: number, zoom: number, step: number) => {
  const scaledStep = step * zoom;
  return -((cameraValue * zoom) % scaledStep);
};

export const drawCanvasBackground = (
  ctx: CanvasRenderingContext2D,
  { background, theme, camera, size }: DrawBackgroundOptions
) => {
  const baseColor = theme === 'dark-chalkboard'
    ? '#1f2a24'
    : background === 'plain'
      ? '#ffffff'
      : theme === 'clean-paper'
        ? '#fffdf7'
        : '#fbf7ed';
  ctx.fillStyle = baseColor;
  ctx.fillRect(0, 0, size.width, size.height);

  if (background === 'plain') return;

  const isCompact = size.width < 768;
  const alpha = isCompact ? 0.28 : 0.42;

  if (background === 'paper' || background === 'notebook') {
    ctx.save();
    ctx.globalAlpha = isCompact ? 0.18 : 0.25;
    ctx.fillStyle = theme === 'dark-chalkboard' ? '#496154' : '#d9cdb8';
    for (let y = 0; y < size.height; y += 17) {
      for (let x = (y % 34) / 2; x < size.width; x += 31) {
        ctx.fillRect(x, y, 1, 1);
      }
    }
    ctx.globalAlpha = isCompact ? 0.1 : 0.16;
    ctx.strokeStyle = theme === 'dark-chalkboard' ? '#5c786a' : '#cdbf9f';
    ctx.lineWidth = 1;
    for (let y = getScreenOffset(camera.y, camera.zoom, 96); y < size.height; y += 96 * camera.zoom) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(size.width, y + 0.8);
      ctx.stroke();
    }
    ctx.restore();
  }

  if (background === 'dotted') {
    const step = 28;
    const scaledStep = step * camera.zoom;
    const radius = Math.max(0.8, Math.min(1.5, camera.zoom));
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = theme === 'dark-chalkboard' ? '#6c897a' : '#b8ad98';
    for (let x = getScreenOffset(camera.x, camera.zoom, step); x < size.width; x += scaledStep) {
      for (let y = getScreenOffset(camera.y, camera.zoom, step); y < size.height; y += scaledStep) {
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  if (background === 'grid' || background === 'notebook') {
    const step = background === 'notebook' ? 32 : 40;
    const scaledStep = step * camera.zoom;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = theme === 'dark-chalkboard'
      ? '#526f61'
      : background === 'notebook' ? '#adc6dd' : '#d4cab8';
    ctx.lineWidth = 1;
    for (let x = getScreenOffset(camera.x, camera.zoom, step); x < size.width; x += scaledStep) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, size.height);
      ctx.stroke();
    }
    for (let y = getScreenOffset(camera.y, camera.zoom, step); y < size.height; y += scaledStep) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(size.width, y);
      ctx.stroke();
    }
    ctx.restore();
  }
};

export const drawStrokePath = (
  ctx: CanvasRenderingContext2D,
  stroke: Stroke | DraftStroke,
  penStyle: PenStyle = 'marker'
) => {
  if (stroke.points.length < 2 || stroke.tool === 'ERASER') return;

  ctx.save();
  ctx.beginPath();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = stroke.color;
  ctx.lineWidth = penStyle === 'pencil' ? Math.max(1, stroke.size * 0.65) : stroke.size;
  ctx.globalAlpha = penStyle === 'highlighter' ? 0.36 : penStyle === 'pencil' ? 0.72 : 1;
  ctx.shadowColor = penStyle === 'pencil' ? stroke.color : 'transparent';
  ctx.shadowBlur = penStyle === 'pencil' ? 0.6 : 0;
  ctx.setLineDash(penStyle === 'pencil' ? [1, 2] : []);

  ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
  for (let i = 1; i < stroke.points.length; i++) {
    ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
  }
  ctx.stroke();
  ctx.restore();
};

export const drawImagesLayer = (
  ctx: CanvasRenderingContext2D,
  options: DrawImagesOptions
) => {
  const { images, selectedIds, camera, size, imageCache, onImageLoad } = options;
  const viewportBounds = getViewportBounds({ ...camera, width: size.width, height: size.height });

  ctx.save();
  applyCameraTransform(ctx, camera);

  for (const image of images) {
    if (!rectsIntersect(getObjectBounds(image), viewportBounds)) continue;

    let imageObject = imageCache.get(image.src);
    if (!imageObject) {
      imageObject = new Image();
      if (onImageLoad) imageObject.onload = onImageLoad;
      imageObject.src = image.src;
      imageCache.set(image.src, imageObject);
    }

    if (imageObject.complete) {
      ctx.drawImage(imageObject, image.x, image.y, image.width, image.height);
    }

    if (selectedIds.includes(image.id)) {
      ctx.save();
      ctx.strokeStyle = image.isLocked ? '#ef4444' : '#3b82f6';
      ctx.lineWidth = 2;
      const bounds = getObjectBounds(image, 4);

      ctx.strokeRect(bounds.x, bounds.y, bounds.width, bounds.height);

      if (!image.isLocked) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(bounds.x + bounds.width - 3, bounds.y + bounds.height - 3, 6, 6);
        ctx.strokeRect(bounds.x + bounds.width - 3, bounds.y + bounds.height - 3, 6, 6);
      }
      ctx.restore();
    }
  }

  ctx.restore();
};

export const drawShapesLayer = (
  ctx: CanvasRenderingContext2D,
  options: DrawShapesOptions
) => {
  const {
    shapes,
    selectedIds,
    camera,
    size,
    tempShape,
    currentTool,
    currentColor,
    isCreatingShape,
    selectionBox,
    isSelecting,
    hoverHandles,
    tempArrow,
    isCreatingArrow,
  } = options;
  const viewportBounds = getViewportBounds({ ...camera, width: size.width, height: size.height });

  ctx.save();
  applyCameraTransform(ctx, camera);

  for (const shape of shapes) {
    if (!rectsIntersect(getObjectBounds(shape), viewportBounds)) continue;

    ctx.save();
    ctx.fillStyle = shape.fillColor || 'transparent';
    ctx.strokeStyle = shape.strokeColor !== 'transparent' && shape.strokeColor
      ? shape.strokeColor
      : shape.fillColor || '#000000';
    ctx.lineWidth = Math.max(shape.strokeWidth || 2, 2);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (shape.type === 'RECTANGLE') {
      drawSketchRect(ctx, shape, shape.id);
      ctx.fill();
      drawFillTexture(ctx, shape, shape.id);
      ctx.stroke();
    } else if (shape.type === 'CIRCLE') {
      drawSketchEllipse(ctx, shape, shape.id);
      ctx.fill();
      drawFillTexture(ctx, shape, shape.id);
      ctx.stroke();
    } else if (shape.type === 'ARROW') {
      const strokeColor = shape.strokeColor !== 'transparent' && shape.strokeColor
        ? shape.strokeColor
        : shape.fillColor || '#000000';
      drawSketchArrow(ctx, shape.x, shape.y, shape.x + shape.width, shape.y + shape.height, strokeColor, shape.strokeWidth || 4, shape.id);
    }
    ctx.restore();

    if (selectedIds.includes(shape.id)) {
      ctx.save();
      ctx.strokeStyle = shape.isLocked ? '#ef4444' : '#3b82f6';
      ctx.lineWidth = 2;
      const bounds = getObjectBounds(shape, 4);

      ctx.strokeRect(bounds.x, bounds.y, bounds.width, bounds.height);

      if (!shape.isLocked) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(bounds.x - 3, bounds.y - 3, 6, 6);
        ctx.strokeRect(bounds.x - 3, bounds.y - 3, 6, 6);
        ctx.fillRect(bounds.x + bounds.width - 3, bounds.y + bounds.height - 3, 6, 6);
        ctx.strokeRect(bounds.x + bounds.width - 3, bounds.y + bounds.height - 3, 6, 6);
      } else {
        ctx.fillStyle = '#ef4444';
        ctx.beginPath();
        ctx.arc(bounds.x, bounds.y, 4, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
    }
  }

  if (isCreatingShape && tempShape) {
    ctx.fillStyle = `${currentColor}80`;
    ctx.strokeStyle = currentColor;
    ctx.lineWidth = 1;

    if (currentTool === 'RECTANGLE') {
      drawSketchRect(ctx, tempShape, 'draft');
      ctx.fill();
      ctx.stroke();
    } else if (currentTool === 'CIRCLE') {
      drawSketchEllipse(ctx, tempShape, 'draft');
      ctx.fill();
      ctx.stroke();
    } else if (currentTool === 'ARROW') {
      drawSketchArrow(
        ctx,
        tempShape.x,
        tempShape.y,
        tempShape.x + tempShape.width,
        tempShape.y + tempShape.height,
        currentColor,
        4,
        'draft'
      );
    }
  }

  if (isSelecting && selectionBox) {
    ctx.save();
    ctx.fillStyle = 'rgba(59, 130, 246, 0.1)';
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 1;
    ctx.fillRect(selectionBox.x, selectionBox.y, selectionBox.width, selectionBox.height);
    ctx.strokeRect(selectionBox.x, selectionBox.y, selectionBox.width, selectionBox.height);
    ctx.restore();
  }

  for (const handle of hoverHandles) {
    ctx.beginPath();
    ctx.fillStyle = '#3b82f6';
    ctx.arc(handle.x, handle.y, size.width < 768 ? 10 : 6, 0, Math.PI * 2);
    ctx.fill();
  }

  if (isCreatingArrow && tempArrow) {
    drawSketchArrow(ctx, tempArrow.x1, tempArrow.y1, tempArrow.x2, tempArrow.y2, '#000000', 4, 'temp-arrow');
  }

  ctx.restore();
};

export const drawStrokesLayer = (
  ctx: CanvasRenderingContext2D,
  options: DrawStrokesOptions
) => {
  const { strokes, selectedIds, camera, size, draftStroke, penStyle } = options;
  const viewportBounds = getViewportBounds({ ...camera, width: size.width, height: size.height });

  ctx.save();
  applyCameraTransform(ctx, camera);

  for (const stroke of strokes) {
    const strokeBounds = getStrokeBounds(stroke, stroke.size / 2);
    if (!strokeBounds || !rectsIntersect(strokeBounds, viewportBounds)) continue;

    if (selectedIds.includes(stroke.id)) {
      ctx.save();
      ctx.strokeStyle = '#3b82f6';
      ctx.lineWidth = stroke.size + 4;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      if (stroke.points.length > 0) {
        ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
        stroke.points.forEach((point) => ctx.lineTo(point.x, point.y));
      }
      ctx.stroke();
      ctx.restore();
    }

    drawStrokePath(ctx, stroke, stroke.penStyle ?? penStyle);
  }

  if (draftStroke) {
    drawStrokePath(ctx, draftStroke, draftStroke.penStyle);
  }

  ctx.restore();
};

export const drawToolCursor = (
  ctx: CanvasRenderingContext2D,
  options: DrawCursorOptions
) => {
  const { position, tool, color, strokeWidth, isSpacePressed } = options;
  if (!position || tool === 'HAND' || tool === 'SELECT' || isSpacePressed) return;

  ctx.save();
  ctx.beginPath();
  if (tool === 'PEN') {
    ctx.fillStyle = color;
    ctx.arc(position.x, position.y, Math.max(strokeWidth / 2, 2), 0, Math.PI * 2);
    ctx.fill();
  } else if (tool === 'ERASER') {
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 1;
    ctx.arc(position.x, position.y, 10, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
};
