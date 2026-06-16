import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createPointerGestureState,
  getMultiTouchTapAction,
  getTwoPointerGesture,
  resetPointerGesture,
  trackPointerDown,
} from '../src/lib/canvasInteraction.ts';

test('trackPointerDown initializes single pointer gesture state', () => {
  const state = createPointerGestureState();
  const count = trackPointerDown(state, 1, { x: 10, y: 20 }, 100);

  assert.equal(count, 1);
  assert.equal(state.touchStartTimestamp, 100);
  assert.equal(state.maxPointersDuringTouch, 1);
  assert.equal(state.hasMovedSignificantly, false);
});

test('trackPointerDown keeps max pointer count for multi-touch gestures', () => {
  const state = createPointerGestureState();

  trackPointerDown(state, 1, { x: 0, y: 0 }, 100);
  trackPointerDown(state, 2, { x: 10, y: 0 }, 110);
  trackPointerDown(state, 3, { x: 20, y: 0 }, 120);
  state.activePointers.delete(3);

  assert.equal(state.activePointers.size, 2);
  assert.equal(state.maxPointersDuringTouch, 3);
});

test('getTwoPointerGesture calculates pinch distance and center', () => {
  assert.deepEqual(
    getTwoPointerGesture([{ x: 0, y: 0 }, { x: 6, y: 8 }]),
    { distance: 10, center: { x: 3, y: 4 } }
  );
});

test('resetPointerGesture clears gesture metadata but keeps active pointers', () => {
  const state = createPointerGestureState();
  trackPointerDown(state, 1, { x: 0, y: 0 }, 100);
  state.hasMovedSignificantly = true;
  state.isUndoRedoTriggered = true;
  state.lastPinchDistance = 10;
  state.lastPinchCenter = { x: 5, y: 5 };

  resetPointerGesture(state);

  assert.equal(state.activePointers.size, 1);
  assert.equal(state.maxPointersDuringTouch, 0);
  assert.equal(state.hasMovedSignificantly, false);
  assert.equal(state.isUndoRedoTriggered, false);
  assert.equal(state.lastPinchDistance, null);
  assert.equal(state.lastPinchCenter, null);
});

test('getMultiTouchTapAction maps quick two and three pointer taps to undo redo', () => {
  const undoState = createPointerGestureState();
  trackPointerDown(undoState, 1, { x: 0, y: 0 }, 100);
  trackPointerDown(undoState, 2, { x: 10, y: 0 }, 110);

  assert.equal(getMultiTouchTapAction(undoState, 200), 'undo');

  const redoState = createPointerGestureState();
  trackPointerDown(redoState, 1, { x: 0, y: 0 }, 100);
  trackPointerDown(redoState, 2, { x: 10, y: 0 }, 110);
  trackPointerDown(redoState, 3, { x: 20, y: 0 }, 120);

  assert.equal(getMultiTouchTapAction(redoState, 200), 'redo');
});

test('getMultiTouchTapAction ignores moved or slow gestures', () => {
  const movedState = createPointerGestureState();
  trackPointerDown(movedState, 1, { x: 0, y: 0 }, 100);
  trackPointerDown(movedState, 2, { x: 10, y: 0 }, 110);
  movedState.hasMovedSignificantly = true;

  assert.equal(getMultiTouchTapAction(movedState, 200), null);

  const slowState = createPointerGestureState();
  trackPointerDown(slowState, 1, { x: 0, y: 0 }, 100);
  trackPointerDown(slowState, 2, { x: 10, y: 0 }, 110);

  assert.equal(getMultiTouchTapAction(slowState, 500), null);
});
