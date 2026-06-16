import assert from 'node:assert/strict';
import test from 'node:test';
import {
  STROKE_SIMPLIFICATION_TOLERANCE,
  createRectFromPoints,
  createStrokeBounds,
  normalizeRect,
  simplifyStrokePoints,
} from '../src/lib/canvasGeometry.ts';

test('normalizeRect converts negative dimensions into a positive rectangle', () => {
  assert.deepEqual(
    normalizeRect({ x: 20, y: 30, width: -10, height: -15 }),
    { x: 10, y: 15, width: 10, height: 15 }
  );
});

test('createRectFromPoints creates a positive drag rectangle', () => {
  assert.deepEqual(
    createRectFromPoints({ x: 30, y: 10 }, { x: 10, y: 40 }),
    { x: 10, y: 10, width: 20, height: 30 }
  );
});

test('createStrokeBounds caches the stroke bounding box', () => {
  assert.deepEqual(
    createStrokeBounds([
      { x: 10, y: 20 },
      { x: -5, y: 25 },
      { x: 15, y: -10 },
    ]),
    { x: -5, y: -10, width: 20, height: 35 }
  );
});

test('simplifyStrokePoints preserves endpoints and reduces smooth strokes', () => {
  const points = Array.from({ length: 1_000 }, (_, index) => ({
    x: index,
    y: Math.sin(index / 24) * 48 + Math.sin(index / 5) * 2,
  }));

  const simplified = simplifyStrokePoints(points, STROKE_SIMPLIFICATION_TOLERANCE);

  assert.deepEqual(simplified[0], points[0]);
  assert.deepEqual(simplified.at(-1), points.at(-1));
  assert.ok(simplified.length < points.length * 0.3);
});
