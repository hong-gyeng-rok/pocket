"use client";

import { Copy, Lock, Palette, Pin, StickyNote, Tag, Trash2, Unlock } from "lucide-react";
import { useCanvasStore } from "@/app/store/useCanvasStore";
import type { Memo } from "@/app/types/canvas";

const noteColors = ["#fef3c7", "#fee2e2", "#dbeafe", "#dcfce7", "#fce7f3"];
const decorations: { value: NonNullable<Memo["decoration"]>; label: string }[] = [
  { value: "tape", label: "Tape" },
  { value: "pin", label: "Pin" },
  { value: "label", label: "Label" },
];

export default function MobileSelectionActionBar() {
  const selectedIds = useCanvasStore((state) => state.selectedIds);
  const shapes = useCanvasStore((state) => state.shapes);
  const memos = useCanvasStore((state) => state.memos);
  const images = useCanvasStore((state) => state.images);
  const strokes = useCanvasStore((state) => state.strokes);
  const addMemo = useCanvasStore((state) => state.addMemo);
  const addImage = useCanvasStore((state) => state.addImage);
  const addShape = useCanvasStore((state) => state.addShape);
  const updateMemo = useCanvasStore((state) => state.updateMemo);
  const updateShape = useCanvasStore((state) => state.updateShape);
  const toggleLock = useCanvasStore((state) => state.toggleLock);
  const removeShape = useCanvasStore((state) => state.removeShape);
  const removeMemo = useCanvasStore((state) => state.removeMemo);
  const removeImage = useCanvasStore((state) => state.removeImage);
  const removeStroke = useCanvasStore((state) => state.removeStroke);
  const setSelectedIds = useCanvasStore((state) => state.setSelectedIds);

  if (selectedIds.length === 0) return null;

  const selectedObjects = [
    ...memos.filter((memo) => selectedIds.includes(memo.id)),
    ...images.filter((image) => selectedIds.includes(image.id)),
    ...shapes.filter((shape) => selectedIds.includes(shape.id)),
  ];
  const isAllLocked = selectedObjects.length > 0 && selectedObjects.every((item) => item.isLocked);

  const duplicateSelection = () => {
    const nextIds: string[] = [];

    for (const memo of memos.filter((item) => selectedIds.includes(item.id))) {
      const id = crypto.randomUUID();
      addMemo({ ...memo, id, x: memo.x + 28, y: memo.y + 28, isLocked: false });
      nextIds.push(id);
    }

    for (const image of images.filter((item) => selectedIds.includes(item.id))) {
      const id = crypto.randomUUID();
      addImage({ ...image, id, x: image.x + 28, y: image.y + 28, isLocked: false });
      nextIds.push(id);
    }

    for (const shape of shapes.filter((item) => selectedIds.includes(item.id))) {
      const id = crypto.randomUUID();
      addShape({ ...shape, id, x: shape.x + 28, y: shape.y + 28, startId: undefined, endId: undefined, isLocked: false });
      nextIds.push(id);
    }

    if (nextIds.length > 0) setSelectedIds(nextIds);
  };

  const deleteSelection = () => {
    if (!window.confirm("Delete selected objects?")) return;

    selectedIds.forEach((id) => {
      if (shapes.some((shape) => shape.id === id)) removeShape(id);
      if (memos.some((memo) => memo.id === id)) removeMemo(id);
      if (images.some((image) => image.id === id)) removeImage(id);
      if (strokes.some((stroke) => stroke.id === id)) removeStroke(id);
    });
    setSelectedIds([]);
  };

  const applyColor = (color: string) => {
    selectedIds.forEach((id) => {
      if (memos.some((memo) => memo.id === id)) updateMemo(id, { color });
      if (shapes.some((shape) => shape.id === id)) updateShape(id, { fillColor: color });
    });
  };

  const applyDecoration = (decoration: NonNullable<Memo["decoration"]>) => {
    selectedIds.forEach((id) => {
      if (memos.some((memo) => memo.id === id)) updateMemo(id, { decoration });
    });
  };
  const editTapeLabel = () => {
    const current =
      memos.find((memo) => selectedIds.includes(memo.id))?.label ??
      shapes.find((shape) => selectedIds.includes(shape.id))?.label ??
      "";
    const label = window.prompt("Tape title", current);
    if (label === null) return;

    selectedIds.forEach((id) => {
      if (memos.some((memo) => memo.id === id)) updateMemo(id, { label, decoration: "tape" });
      if (shapes.some((shape) => shape.id === id && shape.type !== "ARROW")) updateShape(id, { label });
    });
  };
  const hasTapeTargetSelection = selectedIds.some((id) => (
    memos.some((memo) => memo.id === id) ||
    shapes.some((shape) => shape.id === id && shape.type !== "ARROW")
  ));

  return (
    <div className="pointer-events-auto fixed bottom-28 left-1/2 z-[70] flex max-w-[calc(100vw-16px)] -translate-x-1/2 flex-nowrap items-center gap-1 overflow-x-auto rounded-2xl border border-stone-200 bg-white/95 p-2 shadow-xl backdrop-blur md:hidden">
      <button
        onClick={duplicateSelection}
        className="grid min-h-11 min-w-11 place-items-center rounded-full text-stone-700 hover:bg-stone-100"
        aria-label="Duplicate selection"
      >
        <Copy size={18} />
      </button>
      <button
        onClick={() => toggleLock(selectedIds)}
        className="grid min-h-11 min-w-11 place-items-center rounded-full text-stone-700 hover:bg-stone-100"
        aria-label="Toggle lock"
      >
        {isAllLocked ? <Lock size={18} /> : <Unlock size={18} />}
      </button>
      <div className="flex shrink-0 items-center gap-1 rounded-full bg-stone-100 px-1 py-1">
        <Palette size={16} className="text-stone-500" />
        {noteColors.map((color) => (
          <button
            key={color}
            onClick={() => applyColor(color)}
            className="h-8 w-8 rounded-full border border-stone-300"
            style={{ backgroundColor: color }}
            aria-label={`Set color ${color}`}
          />
        ))}
      </div>
      {hasTapeTargetSelection && (
        <button
          onClick={editTapeLabel}
          className="grid min-h-11 min-w-11 place-items-center rounded-full text-amber-700 hover:bg-amber-50"
          aria-label="Edit tape title"
        >
          <Tag size={18} />
        </button>
      )}
      {memos.some((memo) => selectedIds.includes(memo.id)) && (
        <div className="flex shrink-0 items-center gap-1 rounded-full bg-amber-50 px-1 py-1">
          <StickyNote size={16} className="text-amber-700" />
          {decorations.map((decoration) => (
            <button
              key={decoration.value}
              onClick={() => applyDecoration(decoration.value)}
              className="grid h-8 min-w-8 place-items-center rounded-full px-2 text-[11px] font-semibold text-amber-800 hover:bg-white"
              aria-label={`Set ${decoration.label}`}
            >
              {decoration.value === "pin" ? <Pin size={14} /> : decoration.label[0]}
            </button>
          ))}
        </div>
      )}
      <button
        onClick={deleteSelection}
        className="grid min-h-11 min-w-11 place-items-center rounded-full text-red-500 hover:bg-red-50"
        aria-label="Delete selection"
      >
        <Trash2 size={18} />
      </button>
    </div>
  );
}
