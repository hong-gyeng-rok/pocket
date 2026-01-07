"use client";

import { useCanvasStore } from "@/app/store/useCanvasStore";
import { useCameraStore } from "@/app/store/useCameraStore";
import MemoComponent from "@/app/component/memo/Memo";

export default function OverlayLayer() {
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
        className="absolute top-0 left-0 w-full h-full"
        style={{
          transformOrigin: "0 0",
          transform: `scale(${zoom}) translate(${-x}px, ${-y}px)`,
          width: '100%', 
          height: '100%',
        }}
      >
        {memos.map((memo) => (
          <MemoComponent key={memo.id} memo={memo} />
        ))}
      </div>
    </div>
  );
}
