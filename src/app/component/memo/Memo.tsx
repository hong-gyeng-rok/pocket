"use client";

import { useState, useRef, useEffect } from "react";
import { Memo, useCanvasStore } from "@/app/store/useCanvasStore";
import { useCameraStore } from "@/app/store/useCameraStore";
import { X, ChevronDown } from "lucide-react";

interface MemoProps {
  memo: Memo;
}

const SIZE_LABELS = {
  sm: "S",
  m: "M",
  l: "L",
  xl: "XL"
};

export default function MemoComponent({ memo }: MemoProps) {
  const updateMemo = useCanvasStore((state) => state.updateMemo);
  const moveMemo = useCanvasStore((state) => state.moveMemo);
  const resizeMemo = useCanvasStore((state) => state.resizeMemo);
  const removeMemo = useCanvasStore((state) => state.removeMemo);
  const zoom = useCameraStore((state) => state.zoom);

  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  
  const dragStart = useRef({ x: 0, y: 0 });
  const initialSize = useRef({ w: 0, h: 0 });
  const historyPaused = useRef(false);
  
  // Keep latest memo in ref to avoid effect re-runs
  const memoRef = useRef(memo);
  memoRef.current = memo;

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
      const currentMemo = memoRef.current;
      
      if (isDragging) {
        const dx = (e.clientX - dragStart.current.x) / zoom;
        const dy = (e.clientY - dragStart.current.y) / zoom;
        moveMemo(currentMemo.id, currentMemo.x + dx, currentMemo.y + dy);
        dragStart.current = { x: e.clientX, y: e.clientY };
      } else if (isResizing) {
        const dx = (e.clientX - dragStart.current.x) / zoom;
        const dy = (e.clientY - dragStart.current.y) / zoom;
        
        resizeMemo(currentMemo.id, Math.max(100, currentMemo.width + dx), Math.max(100, currentMemo.height + dy));
        dragStart.current = { x: e.clientX, y: e.clientY };
      }

      // Pause history AFTER the first move ensures we record the "Start of Move" state
      if (!historyPaused.current) {
          useCanvasStore.temporal.getState().pause();
          historyPaused.current = true;
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      setIsResizing(false);
      if (historyPaused.current) {
          useCanvasStore.temporal.getState().resume();
          historyPaused.current = false;
      }
    };

    if (isDragging || isResizing) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    }

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      // Safety cleanup
      if (historyPaused.current) {
          useCanvasStore.temporal.getState().resume();
          historyPaused.current = false;
      }
    };
  }, [isDragging, isResizing, moveMemo, resizeMemo, zoom]);

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
        className="h-8 bg-black/5 cursor-move flex items-center justify-between px-2 shrink-0 relative"
        onMouseDown={handleMouseDown}
      >
        <span className="text-xs text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity select-none">Drag</span>
        
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {/* Font Size Dropdown */}
            <div className="relative">
                <button 
                    onClick={(e) => {
                        e.stopPropagation();
                        setIsDropdownOpen(!isDropdownOpen);
                    }}
                    className="h-6 px-1.5 flex items-center gap-0.5 text-[10px] font-bold text-gray-600 bg-white/50 hover:bg-white rounded border border-transparent hover:border-gray-200 transition-all"
                >
                    {SIZE_LABELS[memo.fontSize || 'm']}
                    <ChevronDown size={10} />
                </button>
                
                {isDropdownOpen && (
                    <div className="absolute top-full right-0 mt-1 bg-white rounded shadow-lg border border-gray-200 py-1 z-20 flex flex-col min-w-[40px]">
                        {(['sm', 'm', 'l', 'xl'] as const).map((size) => (
                            <button
                                key={size}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    updateMemo(memo.id, { fontSize: size });
                                    setIsDropdownOpen(false);
                                }}
                                className={`px-3 py-1 text-[10px] font-bold text-left hover:bg-gray-100 ${
                                    (memo.fontSize || 'm') === size ? 'text-blue-600 bg-blue-50' : 'text-gray-700'
                                }`}
                            >
                                {SIZE_LABELS[size]}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* Delete Button */}
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
      </div>

      {/* Content Area */}
      <textarea
        className="flex-1 w-full h-full p-3 bg-transparent resize-none focus:outline-none text-gray-800 leading-relaxed"
        value={memo.content}
        onChange={(e) => updateMemo(memo.id, { content: e.target.value })}
        onMouseDown={(e) => e.stopPropagation()} 
        placeholder="Type something..."
        style={{ 
          fontSize: memo.fontSize === 'sm' ? '12px' : 
                    memo.fontSize === 'l' ? '18px' : 
                    memo.fontSize === 'xl' ? '24px' : '14px' 
        }}
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
