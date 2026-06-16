"use client";

import { useState, useRef, useEffect, type ReactNode } from "react";
import { useCanvasStore } from "@/app/store/useCanvasStore";
import type { Memo } from "@/app/store/useCanvasStore";
import { useCameraStore } from "@/app/store/useCameraStore";
import { X, ChevronDown, Bold, List, ListChecks } from "lucide-react";

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

const renderInlineMarkdown = (text: string) => {
  const parts = text.split(/(\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\))/g);

  return parts.map((part, index) => {
    const bold = part.match(/^\*\*([^*]+)\*\*$/);
    if (bold) return <strong key={`${part}-${index}`}>{bold[1]}</strong>;

    const link = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (link) {
      return (
        <a
          key={`${part}-${index}`}
          href={link[2]}
          target="_blank"
          rel="noreferrer"
          className="underline decoration-stone-500 decoration-wavy underline-offset-2"
          onPointerDown={(event) => event.stopPropagation()}
        >
          {link[1]}
        </a>
      );
    }

    return part;
  });
};

const renderMarkdownPreview = (content: string): ReactNode => {
  if (!content.trim()) {
    return <span className="text-stone-500/70">Type something...</span>;
  }

  return content.split('\n').map((line, index) => {
    if (line.startsWith('# ')) {
      return <h3 key={index} className="mb-2 text-lg font-bold leading-snug">{renderInlineMarkdown(line.slice(2))}</h3>;
    }

    const checkbox = line.match(/^- \[([ xX])\] (.*)$/);
    if (checkbox) {
      const checked = checkbox[1].toLowerCase() === 'x';
      return (
        <div key={index} className="flex items-start gap-2">
          <span className={`mt-1 grid h-4 w-4 shrink-0 place-items-center rounded border border-stone-600/50 ${checked ? 'bg-stone-700 text-white' : 'bg-white/50'}`}>
            {checked ? '✓' : ''}
          </span>
          <span className={checked ? 'line-through opacity-70' : ''}>{renderInlineMarkdown(checkbox[2])}</span>
        </div>
      );
    }

    if (line.startsWith('- ')) {
      return (
        <div key={index} className="flex items-start gap-2">
          <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-stone-600/70" />
          <span>{renderInlineMarkdown(line.slice(2))}</span>
        </div>
      );
    }

    if (!line.trim()) return <div key={index} className="h-3" />;
    return <p key={index}>{renderInlineMarkdown(line)}</p>;
  });
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
  const [isEditing, setIsEditing] = useState(!memo.content);

  const dragStart = useRef({ x: 0, y: 0 });
  const initialSize = useRef({ w: 0, h: 0 });
  const historyPaused = useRef(false);

  // Keep latest memo in ref to avoid effect re-runs
  const memoRef = useRef(memo);

  useEffect(() => {
    memoRef.current = memo;
  }, [memo]);

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

  const insertMarkdown = (prefix: string, suffix = "") => {
    updateMemo(memo.id, { content: `${memo.content}${memo.content ? '\n' : ''}${prefix}${suffix}` });
    setIsEditing(true);
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
      className="absolute flex flex-col overflow-hidden rounded-[3px] border border-black/5 shadow-[0_10px_24px_rgba(70,55,30,0.16)] pointer-events-auto transition-shadow hover:shadow-[0_14px_32px_rgba(70,55,30,0.2)] group md:rotate-[var(--memo-rotation)]"
      style={{
        left: memo.x,
        top: memo.y,
        width: memo.width,
        height: memo.height,
        backgroundColor: memo.color,
        transform: 'translate(0, 0)',
        ['--memo-rotation' as string]: `${getMemoRotation(memo.id)}deg`,
      }}
    >
      <div className="pointer-events-none absolute inset-0 opacity-40 mix-blend-multiply [background-image:radial-gradient(circle_at_1px_1px,rgba(90,70,35,0.15)_1px,transparent_0)] [background-size:18px_18px]" />
      {(memo.decoration ?? 'tape') === 'tape' && (
        <div className="pointer-events-none absolute left-1/2 top-0 h-5 w-20 -translate-x-1/2 -translate-y-2 rotate-[-2deg] rounded-sm bg-amber-100/65 shadow-sm" />
      )}
      {memo.decoration === 'pin' && (
        <div className="pointer-events-none absolute left-1/2 top-2 h-4 w-4 -translate-x-1/2 rounded-full bg-red-400 shadow-sm ring-2 ring-red-200/70" />
      )}
      {memo.decoration === 'label' && (
        <div className="pointer-events-none absolute left-3 top-2 h-4 w-14 rounded-full bg-white/35" />
      )}

      {/* Header (Drag Handle) */}
      <div
        className="h-9 bg-black/5 cursor-move flex items-center justify-between px-2 shrink-0 relative"
        onMouseDown={handleMouseDown}
      >
        <span className="text-xs text-stone-500 opacity-0 group-hover:opacity-100 transition-opacity select-none">Drag</span>

        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={(e) => {
              e.stopPropagation();
              insertMarkdown("**bold**");
            }}
            className="grid h-7 w-7 place-items-center rounded-full bg-white/45 text-stone-600 hover:bg-white"
            aria-label="Insert bold markdown"
          >
            <Bold size={13} />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              insertMarkdown("- ");
            }}
            className="grid h-7 w-7 place-items-center rounded-full bg-white/45 text-stone-600 hover:bg-white"
            aria-label="Insert list markdown"
          >
            <List size={13} />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              insertMarkdown("- [ ] ");
            }}
            className="grid h-7 w-7 place-items-center rounded-full bg-white/45 text-stone-600 hover:bg-white"
            aria-label="Insert checklist markdown"
          >
            <ListChecks size={13} />
          </button>
          {/* Font Size Dropdown */}
          <div className="relative">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsDropdownOpen(!isDropdownOpen);
              }}
              className="h-7 px-1.5 flex items-center gap-0.5 text-[10px] font-bold text-stone-600 bg-white/45 hover:bg-white rounded-full border border-transparent hover:border-stone-200 transition-all"
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
                    className={`px-3 py-1 text-[10px] font-bold text-left hover:bg-gray-100 ${(memo.fontSize || 'm') === size ? 'text-blue-600 bg-blue-50' : 'text-gray-700'
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
            className="grid h-7 w-7 place-items-center rounded-full hover:bg-black/10 text-stone-500 hover:text-red-500 transition-colors"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Content Area */}
      {isEditing ? (
        <textarea
          className="relative flex-1 w-full h-full p-3 bg-transparent resize-none focus:outline-none text-stone-800 leading-relaxed font-[var(--app-hand-font)]"
          value={memo.content}
          onChange={(e) => updateMemo(memo.id, { content: e.target.value })}
          onMouseDown={(e) => e.stopPropagation()}
          onFocus={(event) => {
            event.currentTarget.scrollIntoView({ block: "center", inline: "center", behavior: "smooth" });
          }}
          onBlur={() => {
            if (memo.content.trim()) setIsEditing(false);
          }}
          placeholder="Type something..."
          style={{
            fontSize: memo.fontSize === 'sm' ? '12px' :
              memo.fontSize === 'l' ? '18px' :
                memo.fontSize === 'xl' ? '24px' : '14px'
          }}
          autoFocus={!memo.content}
        />
      ) : (
        <div
          className="relative flex-1 overflow-auto p-3 text-stone-800 leading-relaxed font-[var(--app-hand-font)]"
          onDoubleClick={(event) => {
            event.stopPropagation();
            setIsEditing(true);
          }}
          onPointerDown={(event) => event.stopPropagation()}
          style={{
            fontSize: memo.fontSize === 'sm' ? '12px' :
              memo.fontSize === 'l' ? '18px' :
                memo.fontSize === 'xl' ? '24px' : '14px'
          }}
        >
          <div className="space-y-1.5">{renderMarkdownPreview(memo.content)}</div>
        </div>
      )}

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
