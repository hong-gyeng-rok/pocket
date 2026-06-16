import assert from 'node:assert/strict';
import test from 'node:test';
import { getCursorDirtyRect, mergeDirtyRects } from '../src/lib/dirtyRegion.ts';

test('mergeDirtyRects returns a rect covering both dirty regions', () => {
  assert.deepEqual(
    mergeDirtyRects(
      { x: 10, y: 10, width: 20, height: 20 },
      { x: 25, y: 5, width: 10, height: 40 }
    ),
    { x: 10, y: 5, width: 25, height: 40 }
  );
});

test('getCursorDirtyRect creates a minimum 64px cursor repaint area', () => {
  assert.deepEqual(
    getCursorDirtyRect({ x: 100, y: 80 }, 5),
    { x: 68, y: 48, width: 64, height: 64 }
  );
});

test('getCursorDirtyRect expands for large stroke cursors', () => {
  assert.deepEqual(
    getCursorDirtyRect({ x: 100, y: 80 }, 20),
    { x: 40, y: 20, width: 120, height: 120 }
  );
});
