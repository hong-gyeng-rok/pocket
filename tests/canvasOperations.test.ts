import assert from 'node:assert/strict';
import test from 'node:test';
import { createEmptyCanvasContent } from '../src/app/types/canvas.ts';
import {
  applyCanvasOperation,
  estimateOperationBytes,
  invertCanvasOperation,
} from '../src/lib/canvasOperations.ts';
import type { Memo, Stroke } from '../src/app/types/canvas.ts';

const stroke: Stroke = {
  id: 'stroke-1',
  tool: 'PEN',
  color: '#000000',
  size: 2,
  points: [{ x: 0, y: 0 }, { x: 10, y: 10 }],
  bounds: { x: 0, y: 0, width: 10, height: 10 },
  createdAt: 1,
};

const memo: Memo = {
  id: 'memo-1',
  content: 'hello',
  x: 0,
  y: 0,
  width: 100,
  height: 100,
  color: '#fff',
};

test('canvas operation add and inverse return to the original content', () => {
  const content = createEmptyCanvasContent();
  const added = applyCanvasOperation(content, { type: 'add', kind: 'stroke', value: stroke });
  const reverted = applyCanvasOperation(added, invertCanvasOperation({ type: 'add', kind: 'stroke', value: stroke }));

  assert.equal(added.strokes.length, 1);
  assert.deepEqual(reverted, content);
});

test('canvas operation update and inverse restore object state', () => {
  const content = applyCanvasOperation(createEmptyCanvasContent(), { type: 'add', kind: 'memo', value: memo });
  const updatedMemo = { ...memo, x: 50, y: 60 };
  const operation = { type: 'update' as const, kind: 'memo' as const, id: memo.id, before: memo, after: updatedMemo };

  const updated = applyCanvasOperation(content, operation);
  const reverted = applyCanvasOperation(updated, invertCanvasOperation(operation));

  assert.deepEqual(updated.memos[0], updatedMemo);
  assert.deepEqual(reverted.memos[0], memo);
});

test('operation history is smaller than full content snapshots for small changes', () => {
  const content = applyCanvasOperation(createEmptyCanvasContent(), { type: 'add', kind: 'stroke', value: stroke });
  const snapshotBytes = new Blob([JSON.stringify([content, content])]).size;
  const operationBytes = estimateOperationBytes([
    { type: 'add', kind: 'stroke', value: stroke },
    { type: 'remove', kind: 'stroke', value: stroke },
  ]);

  assert.ok(operationBytes < snapshotBytes);
});
