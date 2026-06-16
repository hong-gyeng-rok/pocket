import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createSpatialIndex,
  createSpatialItems,
  createStrokeSpatialIndex,
  createStrokeSpatialItems,
} from '../src/lib/spatialIndex.ts';
import type { Shape, Stroke } from '../src/app/types/canvas.ts';

const createShape = (id: string, x: number, y: number): Shape => ({
  id,
  type: 'RECTANGLE',
  x,
  y,
  width: 20,
  height: 20,
  fillColor: '#ffffff',
  strokeColor: 'transparent',
  strokeWidth: 0,
});

const createStroke = (id: string, x: number, y: number): Stroke => ({
  id,
  tool: 'PEN',
  color: '#000000',
  size: 2,
  points: [{ x, y }, { x: x + 10, y: y + 10 }],
  bounds: { x, y, width: 10, height: 10 },
  createdAt: 1,
});

test('spatial index finds top-most object at a point', () => {
  const items = createSpatialItems([
    createShape('bottom', 0, 0),
    createShape('top', 0, 0),
  ], 'SHAPE');

  const index = createSpatialIndex(items);

  assert.deepEqual(index.queryPoint(10, 10).map((item) => item.id), ['top', 'bottom']);
});

test('spatial index switches to quadtree for large boards', () => {
  const shapes = Array.from({ length: 300 }, (_, index) => (
    createShape(`shape-${index}`, index * 40, index * 40)
  ));

  const index = createSpatialIndex(createSpatialItems(shapes, 'SHAPE'));

  assert.deepEqual(index.queryPoint(40 * 250 + 5, 40 * 250 + 5).map((item) => item.id), ['shape-250']);
  assert.deepEqual(index.queryRect({ x: 0, y: 0, width: 100, height: 100 }).map((item) => item.id), ['shape-0', 'shape-1', 'shape-2']);
});

test('stroke spatial index uses quadtree for large stroke sets', () => {
  const strokes = Array.from({ length: 300 }, (_, index) => (
    createStroke(`stroke-${index}`, index * 30, index * 30)
  ));

  const index = createStrokeSpatialIndex(createStrokeSpatialItems(strokes));

  assert.deepEqual(
    index.queryRect({ x: 30 * 200, y: 30 * 200, width: 20, height: 20 }).map((item) => item.id),
    ['stroke-200']
  );
});
