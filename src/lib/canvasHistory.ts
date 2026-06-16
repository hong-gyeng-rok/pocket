import { applyCanvasOperation, estimateOperationBytes, invertCanvasOperation } from './canvasOperations.ts';
import type { CanvasOperation } from './canvasOperations.ts';
import type { CanvasContent } from '../app/types/canvas.ts';

export const CANVAS_HISTORY_LIMIT = 50;
export const CANVAS_HISTORY_MEMORY_LIMIT_BYTES = 16 * 1024 * 1024;

export interface TemporalState {
  pastStates: CanvasOperation[];
  futureStates: CanvasOperation[];
  isTracking: boolean;
  undo: () => void;
  redo: () => void;
  clear: () => void;
  pause: () => void;
  resume: () => void;
}

export type TemporalListener = (state: TemporalState) => void;

export type TemporalStore = {
  getState: () => TemporalState;
  subscribe: (listener: TemporalListener) => () => void;
};

interface CanvasHistoryOptions {
  getContent: () => CanvasContent;
  applyContent: (content: CanvasContent) => void;
  limit?: number;
  memoryLimitBytes?: number;
}

export const createCanvasHistory = ({
  getContent,
  applyContent,
  limit = CANVAS_HISTORY_LIMIT,
  memoryLimitBytes = CANVAS_HISTORY_MEMORY_LIMIT_BYTES,
}: CanvasHistoryOptions) => {
  const listeners = new Set<TemporalListener>();

  const emit = () => {
    listeners.forEach((listener) => listener(state));
  };

  const pruneToBudget = () => {
    while (state.pastStates.length > 1 && estimateOperationBytes(state.pastStates) > memoryLimitBytes) {
      state.pastStates.shift();
    }
  };

  const state: TemporalState = {
    pastStates: [],
    futureStates: [],
    isTracking: true,
    undo: () => {
      const operation = state.pastStates.at(-1);
      if (!operation) return;

      const previous = applyCanvasOperation(getContent(), invertCanvasOperation(operation));
      state.pastStates = state.pastStates.slice(0, -1);
      state.futureStates = [...state.futureStates, operation];
      applyContent(previous);
      emit();
    },
    redo: () => {
      const operation = state.futureStates.at(-1);
      if (!operation) return;

      const next = applyCanvasOperation(getContent(), operation);
      state.futureStates = state.futureStates.slice(0, -1);
      state.pastStates = [...state.pastStates, operation].slice(-limit);
      pruneToBudget();
      applyContent(next);
      emit();
    },
    clear: () => {
      state.pastStates = [];
      state.futureStates = [];
      emit();
    },
    pause: () => {
      state.isTracking = false;
      emit();
    },
    resume: () => {
      state.isTracking = true;
      emit();
    },
  };

  return {
    temporalStore: {
      getState: () => state,
      subscribe: (listener: TemporalListener) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
    },
    recordOperation: (operation: CanvasOperation) => {
      if (!state.isTracking) return;

      state.pastStates = [...state.pastStates, operation].slice(-limit);
      state.futureStates = [];
      pruneToBudget();
      emit();
    },
  };
};
