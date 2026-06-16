import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CANVAS_CONTENT_VERSION,
  chunkCanvasContent,
  flattenCanvasChunks,
  isCanvasContentEmpty,
  normalizeCanvasContent,
  toCanvasContent,
} from '../src/app/types/canvas.ts';

test('normalizeCanvasContent returns a versioned empty canvas for invalid input', () => {
  assert.deepEqual(normalizeCanvasContent(null), {
    version: CANVAS_CONTENT_VERSION,
    strokes: [],
    memos: [],
    images: [],
    shapes: [],
  });
});

test('normalizeCanvasContent removes invalid objects and fills stroke bounds', () => {
  const content = normalizeCanvasContent({
    strokes: [
      {
        id: 'stroke-1',
        tool: 'PEN',
        color: '#000000',
        size: 2,
        points: [
          { x: 10, y: 20 },
          { x: 30, y: 10 },
        ],
        createdAt: 1,
      },
      { id: 'broken-stroke', points: [] },
    ],
    images: [{ id: 'broken-image', src: '' }],
  });

  assert.equal(content.version, CANVAS_CONTENT_VERSION);
  assert.equal(content.strokes.length, 1);
  assert.deepEqual(content.strokes[0].bounds, { x: 10, y: 10, width: 20, height: 10 });
  assert.equal(content.images.length, 0);
});

test('toCanvasContent strips UI-only fields from store-shaped state', () => {
  const storeState = {
    strokes: [],
    memos: [],
    images: [],
    shapes: [],
    selectedIds: ['ignored'],
  };
  const content = toCanvasContent(storeState);

  assert.deepEqual(Object.keys(content).sort(), ['images', 'memos', 'shapes', 'strokes', 'version']);
});

test('chunkCanvasContent groups objects by world-space chunk and flattens back', () => {
  const content = normalizeCanvasContent({
    strokes: [
      {
        id: 'stroke-a',
        tool: 'PEN',
        color: '#000000',
        size: 2,
        points: [{ x: 10, y: 10 }, { x: 20, y: 20 }],
        createdAt: 1,
      },
      {
        id: 'stroke-b',
        tool: 'PEN',
        color: '#000000',
        size: 2,
        points: [{ x: 3000, y: 10 }, { x: 3020, y: 20 }],
        createdAt: 2,
      },
    ],
    memos: [
      { id: 'memo-a', content: '', x: -2000, y: 0, width: 100, height: 100, color: '#fff' },
    ],
  });

  const chunks = chunkCanvasContent(content, 2048);
  const flattened = flattenCanvasChunks(chunks);

  assert.deepEqual(chunks.map((chunk) => chunk.id), ['-1:0', '0:0', '1:0']);
  assert.deepEqual(flattened.strokes.map((stroke) => stroke.id).sort(), ['stroke-a', 'stroke-b']);
  assert.deepEqual(flattened.memos.map((memo) => memo.id), ['memo-a']);
});

test('isCanvasContentEmpty detects whether local import should create a server canvas', () => {
  assert.equal(isCanvasContentEmpty(normalizeCanvasContent(null)), true);
  assert.equal(
    isCanvasContentEmpty(normalizeCanvasContent({
      memos: [{ id: 'memo-a', content: '', x: 0, y: 0, width: 100, height: 100, color: '#fff' }],
    })),
    false
  );
});
