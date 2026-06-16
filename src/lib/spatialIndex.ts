import { getObjectBounds, getStrokeBounds, pointInRect, rectsIntersect } from './canvasGeometry.ts';
import type { CanvasObject, Rect } from './canvasGeometry.ts';
import type { Stroke } from '@/app/types/canvas';

export type SpatialItemType = 'SHAPE' | 'MEMO' | 'IMAGE';

export interface SpatialItem {
  id: string;
  type: SpatialItemType;
  item: CanvasObject;
  bounds: Rect;
  order: number;
}

export interface SpatialIndex {
  queryPoint: (x: number, y: number) => SpatialItem[];
  queryRect: (rect: Rect) => SpatialItem[];
}

export interface StrokeSpatialItem {
  id: string;
  stroke: Stroke;
  bounds: Rect;
  order: number;
}

export interface StrokeSpatialIndex {
  queryRect: (rect: Rect) => StrokeSpatialItem[];
}

const DEFAULT_CELL_SIZE = 512;
const QUADTREE_ITEM_THRESHOLD = 256;
const QUADTREE_NODE_CAPACITY = 16;
const QUADTREE_MAX_DEPTH = 8;

type IndexedItem = { bounds: Rect };

interface QuadtreeNode<T extends IndexedItem> {
  bounds: Rect;
  items: T[];
  children: QuadtreeNode<T>[] | null;
  depth: number;
}

const getCellRange = (rect: Rect, cellSize: number) => {
  const minCellX = Math.floor(rect.x / cellSize);
  const minCellY = Math.floor(rect.y / cellSize);
  const maxCellX = Math.floor((rect.x + rect.width) / cellSize);
  const maxCellY = Math.floor((rect.y + rect.height) / cellSize);

  return { minCellX, minCellY, maxCellX, maxCellY };
};

const getCellKey = (x: number, y: number) => `${x}:${y}`;

const createWorldBounds = <T extends IndexedItem>(items: T[]): Rect => {
  if (items.length === 0) return { x: 0, y: 0, width: 1, height: 1 };

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const item of items) {
    minX = Math.min(minX, item.bounds.x);
    minY = Math.min(minY, item.bounds.y);
    maxX = Math.max(maxX, item.bounds.x + item.bounds.width);
    maxY = Math.max(maxY, item.bounds.y + item.bounds.height);
  }

  const width = Math.max(1, maxX - minX);
  const height = Math.max(1, maxY - minY);

  return {
    x: minX,
    y: minY,
    width,
    height,
  };
};

const createQuadtreeNode = <T extends IndexedItem>(bounds: Rect, depth: number): QuadtreeNode<T> => ({
  bounds,
  items: [],
  children: null,
  depth,
});

const containsRect = (outer: Rect, inner: Rect): boolean => {
  return (
    inner.x >= outer.x &&
    inner.y >= outer.y &&
    inner.x + inner.width <= outer.x + outer.width &&
    inner.y + inner.height <= outer.y + outer.height
  );
};

const createChildren = <T extends IndexedItem>(node: QuadtreeNode<T>): QuadtreeNode<T>[] => {
  const halfWidth = node.bounds.width / 2;
  const halfHeight = node.bounds.height / 2;
  const nextDepth = node.depth + 1;

  return [
    createQuadtreeNode({ x: node.bounds.x, y: node.bounds.y, width: halfWidth, height: halfHeight }, nextDepth),
    createQuadtreeNode({ x: node.bounds.x + halfWidth, y: node.bounds.y, width: halfWidth, height: halfHeight }, nextDepth),
    createQuadtreeNode({ x: node.bounds.x, y: node.bounds.y + halfHeight, width: halfWidth, height: halfHeight }, nextDepth),
    createQuadtreeNode({ x: node.bounds.x + halfWidth, y: node.bounds.y + halfHeight, width: halfWidth, height: halfHeight }, nextDepth),
  ];
};

const findContainingChild = <T extends IndexedItem>(node: QuadtreeNode<T>, item: T) => {
  if (!node.children) return null;
  return node.children.find((child) => containsRect(child.bounds, item.bounds)) ?? null;
};

const insertQuadtreeItem = <T extends IndexedItem>(node: QuadtreeNode<T>, item: T) => {
  if (node.children) {
    const child = findContainingChild(node, item);
    if (child) {
      insertQuadtreeItem(child, item);
      return;
    }
  }

  node.items.push(item);

  if (
    node.items.length <= QUADTREE_NODE_CAPACITY ||
    node.depth >= QUADTREE_MAX_DEPTH ||
    node.children
  ) {
    return;
  }

  node.children = createChildren(node);
  const itemsToRedistribute = node.items;
  node.items = [];

  for (const existingItem of itemsToRedistribute) {
    const child = findContainingChild(node, existingItem);
    if (child) {
      insertQuadtreeItem(child, existingItem);
    } else {
      node.items.push(existingItem);
    }
  }
};

const queryQuadtreeRect = <T extends IndexedItem>(
  node: QuadtreeNode<T>,
  rect: Rect,
  result: T[]
) => {
  if (!rectsIntersect(node.bounds, rect)) return;

  for (const item of node.items) {
    if (rectsIntersect(item.bounds, rect)) result.push(item);
  }

  node.children?.forEach((child) => queryQuadtreeRect(child, rect, result));
};

const queryQuadtreePoint = <T extends IndexedItem>(
  node: QuadtreeNode<T>,
  point: { x: number; y: number },
  result: T[]
) => {
  if (!pointInRect(point, node.bounds)) return;

  for (const item of node.items) {
    if (pointInRect(point, item.bounds)) result.push(item);
  }

  node.children?.forEach((child) => queryQuadtreePoint(child, point, result));
};

const createQuadtree = <T extends IndexedItem>(items: T[]) => {
  const root = createQuadtreeNode<T>(createWorldBounds(items), 0);
  items.forEach((item) => insertQuadtreeItem(root, item));
  return root;
};

export const createSpatialItems = (
  items: CanvasObject[],
  type: SpatialItemType,
  orderOffset = 0
): SpatialItem[] => {
  return items.map((item, index) => ({
    id: item.id,
    type,
    item,
    bounds: getObjectBounds(item),
    order: orderOffset + index,
  }));
};

export const createSpatialIndex = (
  items: SpatialItem[],
  cellSize = DEFAULT_CELL_SIZE
): SpatialIndex => {
  if (items.length > QUADTREE_ITEM_THRESHOLD) {
    const root = createQuadtree(items);

    return {
      queryPoint: (x, y) => {
        const result: SpatialItem[] = [];
        queryQuadtreePoint(root, { x, y }, result);
        return result.sort((a, b) => b.order - a.order);
      },
      queryRect: (rect) => {
        const result: SpatialItem[] = [];
        queryQuadtreeRect(root, rect, result);
        return result.sort((a, b) => a.order - b.order);
      },
    };
  }

  const cells = new Map<string, SpatialItem[]>();

  for (const item of items) {
    const range = getCellRange(item.bounds, cellSize);
    for (let cellX = range.minCellX; cellX <= range.maxCellX; cellX++) {
      for (let cellY = range.minCellY; cellY <= range.maxCellY; cellY++) {
        const key = getCellKey(cellX, cellY);
        const cell = cells.get(key);
        if (cell) {
          cell.push(item);
        } else {
          cells.set(key, [item]);
        }
      }
    }
  }

  const collect = (rect: Rect) => {
    const range = getCellRange(rect, cellSize);
    const result = new Map<string, SpatialItem>();

    for (let cellX = range.minCellX; cellX <= range.maxCellX; cellX++) {
      for (let cellY = range.minCellY; cellY <= range.maxCellY; cellY++) {
        const cell = cells.get(getCellKey(cellX, cellY));
        if (!cell) continue;

        for (const item of cell) {
          result.set(`${item.type}:${item.id}`, item);
        }
      }
    }

    return Array.from(result.values());
  };

  return {
    queryPoint: (x, y) => {
      const point = { x, y };
      return collect({ x, y, width: 0, height: 0 })
        .filter((item) => pointInRect(point, item.bounds))
        .sort((a, b) => b.order - a.order);
    },
    queryRect: (rect) => {
      return collect(rect)
        .filter((item) => rectsIntersect(item.bounds, rect))
        .sort((a, b) => a.order - b.order);
    },
  };
};

export const createStrokeSpatialItems = (strokes: Stroke[]): StrokeSpatialItem[] => {
  return strokes.flatMap((stroke, index) => {
    const bounds = getStrokeBounds(stroke, stroke.size / 2);
    if (!bounds) return [];

    return [{
      id: stroke.id,
      stroke,
      bounds,
      order: index,
    }];
  });
};

export const createStrokeSpatialIndex = (
  items: StrokeSpatialItem[],
  cellSize = DEFAULT_CELL_SIZE
): StrokeSpatialIndex => {
  if (items.length > QUADTREE_ITEM_THRESHOLD) {
    const root = createQuadtree(items);

    return {
      queryRect: (rect) => {
        const result: StrokeSpatialItem[] = [];
        queryQuadtreeRect(root, rect, result);
        return result.sort((a, b) => a.order - b.order);
      },
    };
  }

  const cells = new Map<string, StrokeSpatialItem[]>();

  for (const item of items) {
    const range = getCellRange(item.bounds, cellSize);
    for (let cellX = range.minCellX; cellX <= range.maxCellX; cellX++) {
      for (let cellY = range.minCellY; cellY <= range.maxCellY; cellY++) {
        const key = getCellKey(cellX, cellY);
        const cell = cells.get(key);
        if (cell) {
          cell.push(item);
        } else {
          cells.set(key, [item]);
        }
      }
    }
  }

  const collect = (rect: Rect) => {
    const range = getCellRange(rect, cellSize);
    const result = new Map<string, StrokeSpatialItem>();

    for (let cellX = range.minCellX; cellX <= range.maxCellX; cellX++) {
      for (let cellY = range.minCellY; cellY <= range.maxCellY; cellY++) {
        const cell = cells.get(getCellKey(cellX, cellY));
        if (!cell) continue;

        for (const item of cell) {
          result.set(item.id, item);
        }
      }
    }

    return Array.from(result.values());
  };

  return {
    queryRect: (rect) => {
      return collect(rect)
        .filter((item) => rectsIntersect(item.bounds, rect))
        .sort((a, b) => a.order - b.order);
    },
  };
};
