import type { ImageElement, Point, Shape, Stroke } from '@/app/types/canvas';
import type { ToolType } from '@/app/store/useToolStore';
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
}

export interface DrawCursorOptions {
  position: Point | null;
  tool: ToolType;
  color: string;
  strokeWidth: number;
  isSpacePressed: boolean;
}

const roundRectPath = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
) => {
  ctx.beginPath();
  if (typeof ctx.roundRect === 'function') {
    ctx.roundRect(x, y, width, height, radius);
    return;
  }

  let r = radius;
  if (width < 2 * r) r = width / 2;
  if (height < 2 * r) r = height / 2;
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
};

const applyCameraTransform = (ctx: CanvasRenderingContext2D, camera: CameraView) => {
  ctx.scale(camera.zoom, camera.zoom);
  ctx.translate(-camera.x, -camera.y);
};

const drawArrow = (
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  color: string,
  width: number
) => {
  ctx.beginPath();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  const headLen = 20;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const angle = Math.atan2(dy, dx);

  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.lineTo(x2 - headLen * Math.cos(angle - Math.PI / 6), y2 - headLen * Math.sin(angle - Math.PI / 6));
  ctx.moveTo(x2, y2);
  ctx.lineTo(x2 - headLen * Math.cos(angle + Math.PI / 6), y2 - headLen * Math.sin(angle + Math.PI / 6));
  ctx.stroke();
};

export const drawStrokePath = (
  ctx: CanvasRenderingContext2D,
  stroke: Stroke | DraftStroke
) => {
  if (stroke.points.length < 2 || stroke.tool === 'ERASER') return;

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
        0,
        0,
        2 * Math.PI
      );
      ctx.fill();
    } else if (shape.type === 'ARROW') {
      const strokeColor = shape.strokeColor !== 'transparent' && shape.strokeColor
        ? shape.strokeColor
        : shape.fillColor || '#000000';
      drawArrow(ctx, shape.x, shape.y, shape.x + shape.width, shape.y + shape.height, strokeColor, shape.strokeWidth || 4);
    }

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
        0,
        0,
        2 * Math.PI
      );
      ctx.fill();
      ctx.stroke();
    } else if (currentTool === 'ARROW') {
      drawArrow(
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
    ctx.arc(handle.x, handle.y, 6, 0, Math.PI * 2);
    ctx.fill();
  }

  if (isCreatingArrow && tempArrow) {
    drawArrow(ctx, tempArrow.x1, tempArrow.y1, tempArrow.x2, tempArrow.y2, '#000000', 4);
  }

  ctx.restore();
};

export const drawStrokesLayer = (
  ctx: CanvasRenderingContext2D,
  options: DrawStrokesOptions
) => {
  const { strokes, selectedIds, camera, size, draftStroke } = options;
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

    drawStrokePath(ctx, stroke);
  }

  if (draftStroke) {
    drawStrokePath(ctx, draftStroke);
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
