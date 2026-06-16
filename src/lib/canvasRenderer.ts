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

const drawCleanRect = (ctx: CanvasRenderingContext2D, shape: Shape | Rect, fillColor: string, strokeColor?: string, strokeWidth = 0) => {
  const { x, y, width, height } = normalizeDrawableRect(shape);

  ctx.beginPath();
  ctx.rect(x, y, width, height);
  ctx.fillStyle = fillColor;
  ctx.fill();

  if (strokeColor && strokeColor !== 'transparent' && strokeWidth > 0) {
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = strokeWidth;
    ctx.stroke();
  }
};

const drawCleanEllipse = (ctx: CanvasRenderingContext2D, shape: Shape | Rect, fillColor: string, strokeColor?: string, strokeWidth = 0) => {
  const { x, y, width, height } = normalizeDrawableRect(shape);

  ctx.beginPath();
  ctx.ellipse(x + width / 2, y + height / 2, width / 2, height / 2, 0, 0, Math.PI * 2);
  ctx.fillStyle = fillColor;
  ctx.fill();

  if (strokeColor && strokeColor !== 'transparent' && strokeWidth > 0) {
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = strokeWidth;
    ctx.stroke();
  }
};

const drawCleanArrow = (
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  color: string,
  width: number
) => {
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const headLen = Math.max(14, width * 4);

  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(x2, y2);
  ctx.lineTo(x2 - headLen * Math.cos(angle - Math.PI / 6), y2 - headLen * Math.sin(angle - Math.PI / 6));
  ctx.lineTo(x2 - headLen * Math.cos(angle + Math.PI / 6), y2 - headLen * Math.sin(angle + Math.PI / 6));
  ctx.closePath();
  ctx.fill();
  ctx.restore();
};

const drawMaskingTapeLabel = (
  ctx: CanvasRenderingContext2D,
  label: string | undefined,
  bounds: Rect
) => {
  const text = label?.trim();
  if (!text) return;

  const tapeWidth = Math.max(92, Math.min(bounds.width * 0.78, 190));
  const tapeHeight = 26;
  const x = bounds.x + bounds.width / 2 - tapeWidth / 2;
  const y = bounds.y - tapeHeight * 0.55;

  ctx.save();
  ctx.fillStyle = 'rgba(245, 221, 164, 0.9)';
  ctx.strokeStyle = 'rgba(173, 137, 76, 0.28)';
  ctx.lineWidth = 1;
  ctx.shadowColor = 'rgba(70, 55, 30, 0.14)';
  ctx.shadowBlur = 8;
  ctx.shadowOffsetY = 2;
  ctx.fillRect(x, y, tapeWidth, tapeHeight);
  ctx.shadowColor = 'transparent';
  ctx.strokeRect(x + 0.5, y + 0.5, tapeWidth - 1, tapeHeight - 1);

  ctx.fillStyle = 'rgba(90, 66, 28, 0.78)';
  ctx.font = '600 13px Arial, Helvetica, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text.slice(0, 24), x + tapeWidth / 2, y + tapeHeight / 2 + 0.5, tapeWidth - 16);
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
    const fillColor = shape.fillColor || 'transparent';
    const strokeColor = shape.strokeColor !== 'transparent' && shape.strokeColor
      ? shape.strokeColor
      : shape.fillColor || '#000000';
    const strokeWidth = shape.strokeColor === 'transparent' ? 0 : shape.strokeWidth;
    ctx.fillStyle = fillColor;
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = Math.max(strokeWidth || 0, 0);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (shape.type === 'RECTANGLE') {
      drawCleanRect(ctx, shape, fillColor, strokeColor, strokeWidth);
    } else if (shape.type === 'CIRCLE') {
      drawCleanEllipse(ctx, shape, fillColor, strokeColor, strokeWidth);
    } else if (shape.type === 'ARROW') {
      const strokeColor = shape.strokeColor !== 'transparent' && shape.strokeColor
        ? shape.strokeColor
        : shape.fillColor || '#000000';
      drawCleanArrow(ctx, shape.x, shape.y, shape.x + shape.width, shape.y + shape.height, strokeColor, shape.strokeWidth || 4);
    }
    drawMaskingTapeLabel(ctx, shape.label, getObjectBounds(shape));
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
      drawCleanRect(ctx, tempShape, `${currentColor}80`, currentColor, 1);
    } else if (currentTool === 'CIRCLE') {
      drawCleanEllipse(ctx, tempShape, `${currentColor}80`, currentColor, 1);
    } else if (currentTool === 'ARROW') {
      drawCleanArrow(
        ctx,
        tempShape.x,
        tempShape.y,
        tempShape.x + tempShape.width,
        tempShape.y + tempShape.height,
        currentColor,
        4
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
    drawCleanArrow(ctx, tempArrow.x1, tempArrow.y1, tempArrow.x2, tempArrow.y2, '#000000', 4);
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
