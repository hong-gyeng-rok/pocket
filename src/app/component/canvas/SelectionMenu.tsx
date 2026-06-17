"use client";

import React, { useMemo } from "react";
import { Lock, Unlock, Group, Ungroup, Trash2, Copy, Palette, Pin, StickyNote, Tag } from "lucide-react";
import { useCanvasStore } from "@/app/store/useCanvasStore";
import { useCameraStore } from "@/app/store/useCameraStore";
import type { ImageElement, Memo, Point, Shape, Stroke } from "@/app/types/canvas";

type BoundedCanvasObject = Shape | Memo | ImageElement;

const selectionColors = ["#fef3c7", "#fee2e2", "#dbeafe", "#dcfce7", "#fce7f3", "#ffffff"];

export default function SelectionMenu() {
  const selectedIds = useCanvasStore((state) => state.selectedIds);
  const shapes = useCanvasStore((state) => state.shapes);
  const memos = useCanvasStore((state) => state.memos);
  const images = useCanvasStore((state) => state.images);
  const strokes = useCanvasStore((state) => state.strokes);
  
  const groupObjects = useCanvasStore((state) => state.groupObjects);
  const ungroupObjects = useCanvasStore((state) => state.ungroupObjects);
  const toggleLock = useCanvasStore((state) => state.toggleLock);
  const removeShape = useCanvasStore((state) => state.removeShape);
  const removeMemo = useCanvasStore((state) => state.removeMemo);
  const removeImage = useCanvasStore((state) => state.removeImage);
  const removeStroke = useCanvasStore((state) => state.removeStroke);
  const setSelectedIds = useCanvasStore((state) => state.setSelectedIds);
  const addMemo = useCanvasStore((state) => state.addMemo);
  const addImage = useCanvasStore((state) => state.addImage);
  const addShape = useCanvasStore((state) => state.addShape);
  const updateMemo = useCanvasStore((state) => state.updateMemo);
  const updateShape = useCanvasStore((state) => state.updateShape);

  const zoom = useCameraStore((state) => state.zoom);

  // Calculate Bounding Box of selection
  const bounds = useMemo(() => {
    if (selectedIds.length === 0) return null;

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    let foundAny = false;
    let lockedCount = 0;
    let groupedCount = 0;

    const processItem = (item: BoundedCanvasObject) => {
        if (!item) return;
        foundAny = true;
        
        const width = item.width || 0;
        const height = item.height || 0;
        
        const x1 = Math.min(item.x, item.x + width);
        const x2 = Math.max(item.x, item.x + width);
        const y1 = Math.min(item.y, item.y + height);
        const y2 = Math.max(item.y, item.y + height);

        minX = Math.min(minX, x1);
        minY = Math.min(minY, y1);
        maxX = Math.max(maxX, x2);
        maxY = Math.max(maxY, y2);

        if (item.isLocked) lockedCount++;
        if (item.groupId) groupedCount++;
    };

    const processStroke = (stroke: Stroke) => {
        if (!stroke || stroke.points.length === 0) return;
        foundAny = true;
        stroke.points.forEach((p: Point) => {
            minX = Math.min(minX, p.x);
            minY = Math.min(minY, p.y);
            maxX = Math.max(maxX, p.x);
            maxY = Math.max(maxY, p.y);
        });
    };

    selectedIds.forEach(id => {
        const shape = shapes.find(s => s.id === id);
        if (shape) processItem(shape);
        
        const memo = memos.find(m => m.id === id);
        if (memo) processItem(memo);
        
        const image = images.find(i => i.id === id);
        if (image) processItem(image);
        
        const stroke = strokes.find(s => s.id === id);
        if (stroke) processStroke(stroke);
    });

    if (!foundAny || minX === Infinity) return null;

    return {
        x: minX,
        y: minY,
        width: maxX - minX,
        height: maxY - minY,
        isAllLocked: lockedCount === selectedIds.length && lockedCount > 0,
        hasGroup: groupedCount > 0, 
        isMultiple: selectedIds.length > 1,
    };
  }, [selectedIds, shapes, memos, images, strokes]);

  if (!bounds) return null;

  const handleDelete = () => {
      if (!window.confirm("Delete selected objects?")) return;
      selectedIds.forEach(id => {
          if (shapes.some(s => s.id === id)) removeShape(id);
          if (memos.some(m => m.id === id)) removeMemo(id);
          if (images.some(i => i.id === id)) removeImage(id);
          if (strokes.some(s => s.id === id)) removeStroke(id);
      });
      setSelectedIds([]);
  };

  const handleDuplicate = () => {
      const nextIds: string[] = [];
      selectedIds.forEach(id => {
          const shape = shapes.find(s => s.id === id);
          const memo = memos.find(m => m.id === id);
          const image = images.find(i => i.id === id);
          const nextId = crypto.randomUUID();
          if (shape) {
              addShape({ ...shape, id: nextId, x: shape.x + 28, y: shape.y + 28, startId: undefined, endId: undefined, isLocked: false });
              nextIds.push(nextId);
          }
          if (memo) {
              addMemo({ ...memo, id: nextId, x: memo.x + 28, y: memo.y + 28, isLocked: false });
              nextIds.push(nextId);
          }
          if (image) {
              addImage({ ...image, id: nextId, x: image.x + 28, y: image.y + 28, isLocked: false });
              nextIds.push(nextId);
          }
      });
      if (nextIds.length > 0) setSelectedIds(nextIds);
  };

  const hasMemoSelection = selectedIds.some(id => memos.some(memo => memo.id === id));
  const hasColorSelection = selectedIds.some(id => (
      memos.some(memo => memo.id === id) ||
      shapes.some(shape => shape.id === id && shape.type !== 'ARROW')
  ));
  const hasTapeTargetSelection = selectedIds.some(id => (
      memos.some(memo => memo.id === id) ||
      shapes.some(shape => shape.id === id && shape.type !== 'ARROW')
  ));
  const applyDecoration = (decoration: NonNullable<Memo["decoration"]>) => {
      selectedIds.forEach(id => {
          if (memos.some(memo => memo.id === id)) updateMemo(id, { decoration });
      });
  };
  const applyColor = (color: string) => {
      selectedIds.forEach(id => {
          if (memos.some(memo => memo.id === id)) updateMemo(id, { color });
          if (shapes.some(shape => shape.id === id && shape.type !== 'ARROW')) updateShape(id, { fillColor: color });
      });
  };
  const editTapeLabel = () => {
      const current =
          memos.find(memo => selectedIds.includes(memo.id))?.label ??
          shapes.find(shape => selectedIds.includes(shape.id))?.label ??
          "";
      const label = window.prompt("Tape title", current);
      if (label === null) return;

      selectedIds.forEach(id => {
          if (memos.some(memo => memo.id === id)) updateMemo(id, { label, decoration: "tape" });
          if (shapes.some(shape => shape.id === id && shape.type !== 'ARROW')) updateShape(id, { label });
      });
  };

  // Logic to show group/delete section
  const showGroup = bounds.isMultiple || bounds.hasGroup;
  const showDelete = !bounds.isAllLocked;
  const showRightSection = showGroup || showDelete;

  return (
    <div
      className="pointer-events-none absolute hidden items-center justify-center md:flex"
      style={{
        left: bounds.x + bounds.width / 2,
        top: bounds.y - 15 / zoom, 
        transform: `translate(-50%, -100%) scale(${1 / zoom})`,
        zIndex: 1000, 
      }}
    >
      <div className="pointer-events-auto flex max-w-[calc(100vw-24px)] flex-wrap items-center justify-center gap-1 rounded-lg border border-gray-200 bg-white p-1.5 shadow-2xl">
        
        {/* Lock / Unlock */}
        <button
          onClick={() => toggleLock(selectedIds)}
          className={`p-2 rounded hover:bg-gray-100 ${bounds.isAllLocked ? 'text-red-500' : 'text-gray-700'}`}
          title={bounds.isAllLocked ? "Unlock" : "Lock"}
        >
          {bounds.isAllLocked ? <Lock size={16} /> : <Unlock size={16} />}
        </button>
        <button
          onClick={handleDuplicate}
          className="p-2 rounded hover:bg-gray-100 text-gray-700"
          title="Duplicate"
        >
          <Copy size={16} />
        </button>

        {hasColorSelection && (
          <>
            <div className="w-px h-4 bg-gray-200" />
            <Palette size={16} className="mx-1 text-stone-500" />
            {selectionColors.map((color) => (
              <button
                key={color}
                onClick={() => applyColor(color)}
                className="h-6 w-6 rounded-full border border-stone-300 hover:scale-110"
                style={{ backgroundColor: color }}
                title={`Set color ${color}`}
              />
            ))}
          </>
        )}

        {hasTapeTargetSelection && (
          <>
            <div className="w-px h-4 bg-gray-200" />
            <button
              onClick={editTapeLabel}
              className="p-2 rounded hover:bg-amber-50 text-amber-700"
              title="Tape title"
            >
              <Tag size={16} />
            </button>
          </>
        )}

        {hasMemoSelection && (
          <>
            {!hasTapeTargetSelection && <div className="w-px h-4 bg-gray-200" />}
            <button
              onClick={() => applyDecoration("tape")}
              className="p-2 rounded hover:bg-amber-50 text-amber-700"
              title="Masking tape"
            >
              <StickyNote size={16} />
            </button>
            <button
              onClick={() => applyDecoration("pin")}
              className="p-2 rounded hover:bg-amber-50 text-amber-700"
              title="Pin"
            >
              <Pin size={16} />
            </button>
            <button
              onClick={() => applyDecoration("label")}
              className="px-2 py-1 rounded hover:bg-amber-50 text-[11px] font-bold text-amber-700"
              title="Label"
            >
              Label
            </button>
          </>
        )}

        {/* Separator only if right section exists */}
        {showRightSection && <div className="w-px h-4 bg-gray-200" />}

        {/* Group / Ungroup */}
        {showGroup && (
            <button
                onClick={() => bounds.hasGroup ? ungroupObjects(selectedIds) : groupObjects(selectedIds)}
                className="p-2 rounded hover:bg-gray-100 text-gray-700"
                title={bounds.hasGroup ? "Ungroup" : "Group"}
            >
                {bounds.hasGroup ? <Ungroup size={16} /> : <Group size={16} />}
            </button>
        )}

        {/* Separator between Group and Delete if both exist */}
        {showGroup && showDelete && <div className="w-px h-4 bg-gray-200" />}

        {/* Delete */}
        {showDelete && (
            <button
                onClick={handleDelete}
                className="p-2 rounded hover:bg-red-50 text-red-500"
                title="Delete"
            >
                <Trash2 size={16} />
            </button>
        )}
      </div>
    </div>
  );
}
