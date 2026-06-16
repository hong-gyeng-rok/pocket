import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createCircleDraftRect,
  getShapeStrokeColor,
} from '../src/lib/canvasTransform.ts';

test('createCircleDraftRect keeps circle dimensions square while preserving drag direction', () => {
  assert.deepEqual(
    createCircleDraftRect({ x: 10, y: 20 }, { x: 70, y: 50 }),
    { x: 10, y: 20, width: 60, height: 60 }
  );

  assert.deepEqual(
    createCircleDraftRect({ x: 10, y: 20 }, { x: -30, y: 80 }),
    { x: 10, y: 20, width: -60, height: 60 }
  );
});

test('getShapeStrokeColor keeps light fills visible', () => {
  assert.equal(getShapeStrokeColor('#ffffff'), '#4b5563');
  assert.equal(getShapeStrokeColor('#FEF08A'), '#4b5563');
  assert.equal(getShapeStrokeColor('#000000'), '#000000');
});
