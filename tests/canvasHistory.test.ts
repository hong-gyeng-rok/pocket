import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CANVAS_HISTORY_MEMORY_LIMIT_BYTES,
  useCanvasStore,
} from '../src/app/store/useCanvasStore.ts';

test('canvas history stores operations instead of full snapshots', () => {
  useCanvasStore.setState({ strokes: [], memos: [], images: [], shapes: [], selectedIds: [] });
  useCanvasStore.temporal.getState().clear();

  useCanvasStore.getState().addStroke({
    id: 'stroke-1',
    tool: 'PEN',
    color: '#000000',
    size: 2,
    points: [{ x: 0, y: 0 }],
    bounds: { x: 0, y: 0, width: 0, height: 0 },
    createdAt: 1,
  });

  const [historyEntry] = useCanvasStore.temporal.getState().pastStates;

  assert.ok(historyEntry);
  assert.equal(historyEntry.type, 'add');
  assert.equal(historyEntry.kind, 'stroke');
  assert.equal(historyEntry.value.id, 'stroke-1');
  assert.ok(!('strokes' in historyEntry));
});

test('canvas history exposes a finite memory budget', () => {
  assert.equal(CANVAS_HISTORY_MEMORY_LIMIT_BYTES, 16 * 1024 * 1024);
});
