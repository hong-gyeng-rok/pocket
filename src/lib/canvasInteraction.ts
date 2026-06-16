import type { Point } from '@/app/types/canvas';

export interface PointerGestureState {
  activePointers: Map<number, Point>;
  lastPinchDistance: number | null;
  lastPinchCenter: Point | null;
  touchStartTimestamp: number;
  maxPointersDuringTouch: number;
  hasMovedSignificantly: boolean;
  isUndoRedoTriggered: boolean;
}

export const createPointerGestureState = (): PointerGestureState => ({
  activePointers: new Map(),
  lastPinchDistance: null,
  lastPinchCenter: null,
  touchStartTimestamp: 0,
  maxPointersDuringTouch: 0,
  hasMovedSignificantly: false,
  isUndoRedoTriggered: false,
});

export const getTwoPointerGesture = (pointers: Point[]) => {
  const [p1, p2] = pointers;
  const distance = Math.hypot(p1.x - p2.x, p1.y - p2.y);
  const center = {
    x: (p1.x + p2.x) / 2,
    y: (p1.y + p2.y) / 2,
  };

  return { distance, center };
};

export const trackPointerDown = (
  state: PointerGestureState,
  pointerId: number,
  point: Point,
  timestamp = Date.now()
) => {
  state.activePointers.set(pointerId, point);

  if (state.activePointers.size === 1) {
    state.touchStartTimestamp = timestamp;
    state.maxPointersDuringTouch = 1;
    state.hasMovedSignificantly = false;
  } else {
    state.maxPointersDuringTouch = Math.max(
      state.maxPointersDuringTouch,
      state.activePointers.size
    );
  }

  return state.activePointers.size;
};

export const resetPointerGesture = (state: PointerGestureState) => {
  state.maxPointersDuringTouch = 0;
  state.hasMovedSignificantly = false;
  state.isUndoRedoTriggered = false;
  state.lastPinchDistance = null;
  state.lastPinchCenter = null;
};

export const getMultiTouchTapAction = (
  state: PointerGestureState,
  timestamp = Date.now(),
  maxTapDurationMs = 300
): 'undo' | 'redo' | null => {
  if (state.isUndoRedoTriggered) return null;
  if (state.hasMovedSignificantly) return null;
  if (timestamp - state.touchStartTimestamp >= maxTapDurationMs) return null;

  if (state.maxPointersDuringTouch === 2) return 'undo';
  if (state.maxPointersDuringTouch === 3) return 'redo';

  return null;
};
