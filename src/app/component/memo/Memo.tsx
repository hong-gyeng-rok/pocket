"use client";

import { useState, useRef, useEffect } from "react";
import { Memo, useCanvasStore } from "@/app/store/useCanvasStore";
import { useCameraStore } from "@/app/store/useCameraStore";
import { X, GripHorizontal } from "lucide-react"; // Import Grip icon if available, or just use CSS

interface MemoProps {
  memo: Memo;
}

export default function MemoComponent({ memo }: MemoProps) {
  const updateMemo = useCanvasStore((state) => state.updateMemo);
  const moveMemo = useCanvasStore((state) => state.moveMemo);
  const resizeMemo = useCanvasStore((state) => state.resizeMemo);
  const removeMemo = useCanvasStore((state) => state.removeMemo);
  const zoom = useCameraStore((state) => state.zoom);

  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const initialSize = useRef({ w: 0, h: 0 });

  const handleMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent canvas pan
    setIsDragging(true);
    dragStart.current = { x: e.clientX, y: e.clientY };
  };

  const handleResizeStart = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsResizing(true);
    dragStart.current = { x: e.clientX, y: e.clientY };
    initialSize.current = { w: memo.width, h: memo.height };
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        const dx = (e.clientX - dragStart.current.x) / zoom;
        const dy = (e.clientY - dragStart.current.y) / zoom;
        moveMemo(memo.id, memo.x + dx, memo.y + dy);
        dragStart.current = { x: e.clientX, y: e.clientY };
      } else if (isResizing) {
        const dx = (e.clientX - dragStart.current.x) / zoom;
        const dy = (e.clientY - dragStart.current.y) / zoom;
        
        // Minimum size constraint (e.g., 100x100)
        const newW = Math.max(100, initialSize.current.w + dx);
        const newH = Math.max(100, initialSize.current.h + dy);
        
        // Since we are updating relative to initial start, we should accumulate
        // But here we update state continuously, so we need to be careful.
        // Actually, cleaner logic for React state updates during drag:
        // Use total delta from start
        
        // Let's stick to the incremental update for simplicity with store actions
        // But incremental accumulates errors. 
        // Better: Store initial mouse pos and initial dimensions.
        
        // Current implementation is incremental "step by step". 
        // To fix drifting: use total delta.
        // But our dragStart updates every frame. 
        // Let's update dragStart every frame for smooth simple delta.
        
        resizeMemo(memo.id, Math.max(100, memo.width + dx), Math.max(100, memo.height + dy));
        dragStart.current = { x: e.clientX, y: e.clientY };
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      setIsResizing(false);
    };

    if (isDragging || isResizing) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    }

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, isResizing, memo, moveMemo, resizeMemo, zoom]);

  return (
    <div
      className="absolute flex flex-col shadow-lg rounded overflow-hidden pointer-events-auto transition-shadow hover:shadow-xl group"
      style={{
        left: memo.x,
        top: memo.y,
        width: memo.width,
        height: memo.height,
        backgroundColor: memo.color,
        transform: 'translate(0, 0)',
      }}
    >
      {/* Header (Drag Handle) */}
      <div
        className="h-8 bg-black/5 cursor-move flex items-center justify-between px-2 shrink-0"
        onMouseDown={handleMouseDown}
      >
        <span className="text-xs text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity select-none">Drag to move</span>
        <button 
          onClick={(e) => {
            e.stopPropagation();
            removeMemo(memo.id);
          }}
          className="p-1 rounded-full hover:bg-black/10 text-gray-500 hover:text-red-500 transition-colors"
        >
          <X size={14} />
        </button>
      </div>

      {/* Content Area */}
      <textarea
        className="flex-1 w-full h-full p-3 bg-transparent resize-none focus:outline-none text-gray-800 leading-relaxed"
        value={memo.content}
        onChange={(e) => updateMemo(memo.id, e.target.value)}
        onMouseDown={(e) => e.stopPropagation()} 
        placeholder="Type something..."
        style={{ fontSize: '14px' }}
        autoFocus={!memo.content}
      />
      
      {/* Resize Handle */}
      <div 
        className="absolute bottom-0 right-0 w-4 h-4 cursor-nwse-resize flex items-end justify-end p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
        onMouseDown={handleResizeStart}
      >
        <div className="w-2 h-2 border-r-2 border-b-2 border-gray-400/50 rounded-br-sm"></div>
      </div>
    </div>
  );
}
