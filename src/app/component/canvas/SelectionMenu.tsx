"use client";

import React, { useMemo } from "react";
import { Lock, Unlock, Group, Ungroup, Trash2, Copy } from "lucide-react";
import { useCanvasStore } from "@/app/store/useCanvasStore";
import { useCameraStore } from "@/app/store/useCameraStore";

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

  const zoom = useCameraStore((state) => state.zoom);

  // Calculate Bounding Box of selection
  const bounds = useMemo(() => {
    if (selectedIds.length === 0) return null;

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    let foundAny = false;
    let lockedCount = 0;
    let groupedCount = 0;

    const processItem = (item: any) => {
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

    const processStroke = (stroke: any) => {
        if (!stroke || stroke.points.length === 0) return;
        foundAny = true;
        stroke.points.forEach((p: any) => {
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
      selectedIds.forEach(id => {
          if (shapes.some(s => s.id === id)) removeShape(id);
          if (memos.some(m => m.id === id)) removeMemo(id);
          if (images.some(i => i.id === id)) removeImage(id);
          if (strokes.some(s => s.id === id)) removeStroke(id);
      });
      setSelectedIds([]);
  };

  // Logic to show group/delete section
  const showGroup = bounds.isMultiple || bounds.hasGroup;
  const showDelete = !bounds.isAllLocked;
  const showRightSection = showGroup || showDelete;

  return (
    <div
      className="absolute flex items-center justify-center pointer-events-none"
      style={{
        left: bounds.x + bounds.width / 2,
        top: bounds.y - 15 / zoom, 
        transform: `translate(-50%, -100%) scale(${1 / zoom})`,
        zIndex: 1000, 
      }}
    >
      <div className="bg-white rounded-lg shadow-2xl border border-gray-200 p-1.5 flex items-center gap-1 pointer-events-auto">
        
        {/* Lock / Unlock */}
        <button
          onClick={() => toggleLock(selectedIds)}
          className={`p-2 rounded hover:bg-gray-100 ${bounds.isAllLocked ? 'text-red-500' : 'text-gray-700'}`}
          title={bounds.isAllLocked ? "Unlock" : "Lock"}
        >
          {bounds.isAllLocked ? <Lock size={16} /> : <Unlock size={16} />}
        </button>

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
