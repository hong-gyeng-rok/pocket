"use client";

import { useCanvasStore } from "@/app/store/useCanvasStore";
import { useCameraStore } from "@/app/store/useCameraStore";
import MemoComponent from "@/app/component/memo/Memo";
import SelectionMenu from "@/app/component/canvas/SelectionMenu";
import type { SaveStatus } from "@/app/types/saveStatus";

const saveStatusLabel: Record<SaveStatus, string> = {
  pending: "Pending",
  saving: "Saving",
  saved: "Saved",
  offline: "Offline",
  error: "Save failed",
};

const saveStatusStyle: Record<SaveStatus, string> = {
  pending: "bg-amber-400",
  saving: "bg-blue-500 animate-pulse",
  saved: "bg-emerald-500",
  offline: "bg-gray-400",
  error: "bg-red-500",
};

interface OverlayLayerProps {
  saveStatus: SaveStatus;
}

function SaveStatusIndicator({ status }: { status: SaveStatus }) {
  return (
    <div className="fixed right-4 top-4 z-40 flex items-center gap-2 rounded-full border border-gray-200 bg-white/85 px-3 py-1.5 text-xs font-medium text-gray-700 shadow-sm backdrop-blur-md">
      <span className={`h-2 w-2 rounded-full ${saveStatusStyle[status]}`} />
      <span>{saveStatusLabel[status]}</span>
    </div>
  );
}

export default function OverlayLayer({ saveStatus }: OverlayLayerProps) {
  const memos = useCanvasStore((state) => state.memos);
  const x = useCameraStore((state) => state.x);
  const y = useCameraStore((state) => state.y);
  const zoom = useCameraStore((state) => state.zoom);

  return (
    <div 
      className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none"
      style={{ zIndex: 10 }} // Above canvas
    >
      {/* 
        Transform Container 
        This div represents the "World Space".
        It moves and scales exactly like the canvas content.
        Origin must be top-left (0,0) to match canvas coordinate system.
      */}
      <div
        className="absolute top-0 left-0"
        style={{
          transformOrigin: "0 0",
          transform: `scale(${zoom}) translate(${-x}px, ${-y}px)`,
          width: 0, 
          height: 0,
        }}
      >
        {memos.map((memo) => (
          <MemoComponent key={memo.id} memo={memo} />
        ))}
        
        {/* Context Menu for Selection */}
        <SelectionMenu />
      </div>
      <SaveStatusIndicator status={saveStatus} />
    </div>
  );
}
