"use client";

import { useState, useRef, useEffect } from "react";
import { useCanvasStore } from "@/app/store/useCanvasStore";
import type { Memo } from "@/app/store/useCanvasStore";
import { useCameraStore } from "@/app/store/useCameraStore";
import { X, ChevronDown, GripHorizontal } from "lucide-react";

interface MemoProps {
  memo: Memo;
}

const SIZE_LABELS = {
  sm: "S",
  m: "M",
  l: "L",
  xl: "XL"
};

const getMemoRotation = (id: string) => {
  const seed = [...id].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return ((seed % 7) - 3) * 0.35;
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

  useEffect(() => {
    memoRef.current = memo;
  }, [memo]);

  const handleDragStart = (e: React.PointerEvent) => {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    setIsDragging(true);
    dragStart.current = { x: e.clientX, y: e.clientY };
  };

  const handleResizeStart = (e: React.PointerEvent) => {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    setIsResizing(true);
    dragStart.current = { x: e.clientX, y: e.clientY };
    initialSize.current = { w: memo.width, h: memo.height };
  };

  useEffect(() => {
    const handlePointerMove = (e: PointerEvent) => {
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

    const handlePointerUp = () => {
      setIsDragging(false);
      setIsResizing(false);
      if (historyPaused.current) {
        useCanvasStore.temporal.getState().resume();
        historyPaused.current = false;
      }
    };

    if (isDragging || isResizing) {
      window.addEventListener("pointermove", handlePointerMove);
      window.addEventListener("pointerup", handlePointerUp);
      window.addEventListener("pointercancel", handlePointerUp);
    }

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerUp);
      // Safety cleanup
      if (historyPaused.current) {
        useCanvasStore.temporal.getState().resume();
        historyPaused.current = false;
      }
    };
  }, [isDragging, isResizing, moveMemo, resizeMemo, zoom]);

  return (
    <div
      className="absolute flex flex-col overflow-visible rounded-[3px] border border-black/5 shadow-[0_10px_24px_rgba(70,55,30,0.16)] pointer-events-auto transition-shadow hover:shadow-[0_14px_32px_rgba(70,55,30,0.2)] group md:rotate-[var(--memo-rotation)]"
      style={{
        left: memo.x,
        top: memo.y,
        width: memo.width,
        height: memo.height,
        backgroundColor: memo.color,
        zIndex: memo.zIndex ?? 0,
        transform: 'translate(0, 0)',
        ['--memo-rotation' as string]: `${getMemoRotation(memo.id)}deg`,
      }}
    >
      <div className="pointer-events-none absolute inset-0 opacity-40 mix-blend-multiply [background-image:radial-gradient(circle_at_1px_1px,rgba(90,70,35,0.15)_1px,transparent_0)] [background-size:18px_18px]" />
      {(memo.decoration ?? 'tape') === 'tape' && (
        <input
          className="absolute left-1/2 top-0 z-10 h-8 w-[min(180px,76%)] -translate-x-1/2 -translate-y-3 rounded-sm border border-amber-200/60 bg-amber-100/90 px-3 text-center text-[16px] font-semibold text-amber-950 shadow-sm outline-none placeholder:text-amber-800/45 focus:border-amber-300 focus:bg-amber-50 md:h-7 md:text-[12px]"
          value={memo.label ?? ""}
          onChange={(event) => updateMemo(memo.id, { label: event.target.value })}
          onMouseDown={(event) => event.stopPropagation()}
          placeholder="Title"
          maxLength={28}
        />
      )}
      {memo.decoration === 'pin' && (
        <div className="pointer-events-none absolute left-1/2 top-2 h-4 w-4 -translate-x-1/2 rounded-full bg-red-400 shadow-sm ring-2 ring-red-200/70" />
      )}
      {memo.decoration === 'label' && (
        <div className="pointer-events-none absolute left-3 top-2 h-4 w-14 rounded-full bg-white/35" />
      )}

      {/* Header (Drag Handle) */}
      <div
        className="relative flex h-11 shrink-0 cursor-move touch-none items-center justify-between bg-black/5 px-2 md:h-9"
        onPointerDown={handleDragStart}
      >
        <span className="flex items-center gap-1 text-xs font-medium text-stone-600 opacity-100 transition-opacity select-none md:opacity-0 md:group-hover:opacity-100">
          <GripHorizontal size={16} />
          Move
        </span>

        <div className="flex items-center gap-1 opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100">
          {/* Font Size Dropdown */}
          <div className="relative">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsDropdownOpen(!isDropdownOpen);
              }}
              className="flex h-9 min-w-9 items-center justify-center gap-0.5 rounded-full border border-stone-200 bg-white/70 px-2 text-[11px] font-bold text-stone-700 transition-all hover:bg-white md:h-7 md:min-w-0 md:px-1.5 md:text-[10px]"
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
                    className={`px-4 py-2 text-xs font-bold text-left hover:bg-gray-100 md:px-3 md:py-1 md:text-[10px] ${(memo.fontSize || 'm') === size ? 'text-blue-600 bg-blue-50' : 'text-gray-700'
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
            className="grid h-9 w-9 place-items-center rounded-full text-stone-500 transition-colors hover:bg-black/10 hover:text-red-500 md:h-7 md:w-7"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Content Area */}
      <textarea
        className="relative flex-1 w-full h-full p-3 bg-transparent resize-none focus:outline-none text-stone-800 leading-relaxed font-[var(--app-hand-font)]"
        value={memo.content}
        onChange={(e) => updateMemo(memo.id, { content: e.target.value })}
        onMouseDown={(e) => e.stopPropagation()}
        onFocus={(event) => {
          event.currentTarget.scrollIntoView({ block: "center", inline: "center", behavior: "smooth" });
        }}
        placeholder="Type something..."
        style={{
          fontSize: memo.fontSize === 'sm' ? '16px' :
            memo.fontSize === 'l' ? '22px' :
              memo.fontSize === 'xl' ? '28px' : '18px'
        }}
        autoFocus={!memo.content}
      />

      {/* Resize Handle */}
      <div
        className="absolute bottom-0 right-0 flex h-10 w-10 cursor-nwse-resize touch-none items-end justify-end p-2 opacity-100 transition-opacity md:h-4 md:w-4 md:p-0.5 md:opacity-0 md:group-hover:opacity-100"
        onPointerDown={handleResizeStart}
      >
        <div className="h-4 w-4 rounded-br-sm border-b-4 border-r-4 border-gray-500/60 md:h-2 md:w-2 md:border-b-2 md:border-r-2 md:border-gray-400/50"></div>
      </div>
    </div>
  );
}
