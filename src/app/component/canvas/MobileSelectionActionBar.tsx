"use client";

import { Copy, Lock, Palette, Trash2, Unlock } from "lucide-react";
import { useCanvasStore } from "@/app/store/useCanvasStore";

const noteColors = ["#fef3c7", "#fee2e2", "#dbeafe", "#dcfce7", "#fce7f3"];

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

  return (
    <div className="fixed bottom-28 left-1/2 z-50 flex -translate-x-1/2 items-center gap-1 rounded-2xl border border-stone-200 bg-white/95 p-2 shadow-xl backdrop-blur md:hidden">
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
      <div className="flex items-center gap-1 rounded-full bg-stone-100 px-1 py-1">
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
