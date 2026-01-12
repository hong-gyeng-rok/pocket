"use client";

import React, { useMemo } from "react";
import { Lock, Unlock, Group, Ungroup, Trash2, Copy } from "lucide-react";
import { useCanvasStore } from "@/app/store/useCanvasStore";
import { useCameraStore } from "@/app/store/useCameraStore";

export default function SelectionMenu() {
  const selectedIds = useCanvasStore((state) => state.selectedIds);
  const shapes = useCanvasStore((state) => state.shapes);
  const memos = useCanvasStore((state) => state.memos);
  
  const groupObjects = useCanvasStore((state) => state.groupObjects);
  const ungroupObjects = useCanvasStore((state) => state.ungroupObjects);
  const toggleLock = useCanvasStore((state) => state.toggleLock);
  const removeShape = useCanvasStore((state) => state.removeShape);
  const removeMemo = useCanvasStore((state) => state.removeMemo);
  const setSelectedIds = useCanvasStore((state) => state.setSelectedIds);

  const zoom = useCameraStore((state) => state.zoom);

  // Calculate Bounding Box of selection
  const bounds = useMemo(() => {
    if (selectedIds.length === 0) return null;

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    let hasItems = false;
    let lockedCount = 0;
    let groupedCount = 0;

    const processItem = (item: any) => {
        if (!item) return;
        hasItems = true;
        minX = Math.min(minX, item.x);
        minY = Math.min(minY, item.y);
        maxX = Math.max(maxX, item.x + item.width);
        maxY = Math.max(maxY, item.y + item.height);
        if (item.isLocked) lockedCount++;
        if (item.groupId) groupedCount++;
    };

    selectedIds.forEach(id => {
        processItem(shapes.find(s => s.id === id));
        processItem(memos.find(m => m.id === id));
    });

    if (!hasItems) return null;

    return {
        x: minX,
        y: minY,
        width: maxX - minX,
        height: maxY - minY,
        isAllLocked: lockedCount === selectedIds.length,
        hasGroup: groupedCount > 0, // Simplified check
        isMultiple: selectedIds.length > 1
    };
  }, [selectedIds, shapes, memos]);

  if (!bounds) return null;

  const handleDelete = () => {
      selectedIds.forEach(id => {
          if (shapes.some(s => s.id === id)) removeShape(id);
          if (memos.some(m => m.id === id)) removeMemo(id);
      });
      setSelectedIds([]);
  };

  return (
    <div
      className="absolute flex items-center justify-center pointer-events-auto"
      style={{
        left: bounds.x + bounds.width / 2,
        top: bounds.y - 10 / zoom, // Offset slightly above
        transform: `translate(-50%, -100%) scale(${1 / zoom})`, // Counter-scale to keep UI size constant
        marginBottom: '10px'
      }}
    >
      <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-1 flex items-center gap-1">
        
        {/* Lock / Unlock */}
        <button
          onClick={() => toggleLock(selectedIds)}
          className={`p-2 rounded hover:bg-gray-100 ${bounds.isAllLocked ? 'text-red-500' : 'text-gray-700'}`}
          title={bounds.isAllLocked ? "Unlock" : "Lock"}
        >
          {bounds.isAllLocked ? <Lock size={16} /> : <Unlock size={16} />}
        </button>

        <div className="w-px h-4 bg-gray-200" />

        {/* Group / Ungroup (Only if multiple items or already grouped) */}
        {(bounds.isMultiple || bounds.hasGroup) && (
            <button
                onClick={() => bounds.hasGroup ? ungroupObjects(selectedIds) : groupObjects(selectedIds)}
                className="p-2 rounded hover:bg-gray-100 text-gray-700"
                title={bounds.hasGroup ? "Ungroup" : "Group"}
            >
                {bounds.hasGroup ? <Ungroup size={16} /> : <Group size={16} />}
            </button>
        )}

        {(bounds.isMultiple || bounds.hasGroup) && <div className="w-px h-4 bg-gray-200" />}

        {/* Delete (Only if not locked) */}
        {!bounds.isAllLocked && (
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
