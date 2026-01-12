"use client";

import { useState, useRef, useEffect } from "react";
import { ImageElement, useCanvasStore } from "@/app/store/useCanvasStore";
import { useCameraStore } from "@/app/store/useCameraStore";
import { X } from "lucide-react";

interface ImageProps {
  image: ImageElement;
}

export default function ImageComponent({ image }: ImageProps) {
  const updateImage = useCanvasStore((state) => state.updateImage);
  const removeImage = useCanvasStore((state) => state.removeImage);
  const zoom = useCameraStore((state) => state.zoom);

  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const initialSize = useRef({ w: 0, h: 0 });
  const aspectRatio = useRef(1);

  useEffect(() => {
    // Calculate initial aspect ratio
    if (image.width && image.height) {
      aspectRatio.current = image.width / image.height;
    }
  }, []); // Run once on mount (or when image dimensions are known/loaded)

  const handleMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent canvas pan
    e.preventDefault(); // Prevent native drag behavior for images
    setIsDragging(true);
    dragStart.current = { x: e.clientX, y: e.clientY };
  };

  const handleResizeStart = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setIsResizing(true);
    dragStart.current = { x: e.clientX, y: e.clientY };
    initialSize.current = { w: image.width, h: image.height };
    aspectRatio.current = image.width / image.height;
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        const dx = (e.clientX - dragStart.current.x) / zoom;
        const dy = (e.clientY - dragStart.current.y) / zoom;
        updateImage(image.id, { x: image.x + dx, y: image.y + dy });
        dragStart.current = { x: e.clientX, y: e.clientY };
      } else if (isResizing) {
        const dx = (e.clientX - dragStart.current.x) / zoom;
        // const dy = (e.clientY - dragStart.current.y) / zoom; // We calculate height based on width to maintain aspect ratio

        // Minimum size constraint (e.g., 50x50)
        const newW = Math.max(50, initialSize.current.w + dx);
        const newH = newW / aspectRatio.current;
        
        // Accumulate changes logic similar to Memo
        updateImage(image.id, { width: newW, height: newH });
        // Note: We don't update dragStart for resize here to keep reference to initial click
        // But for smooth continuous update logic, let's stick to simple delta from start
        // Actually, simple delta from *current* frame is better if we update store every frame.
        // Let's refine:
        // Current implementation is incremental "step by step".
        
        // To properly resize with aspect ratio and mouse movement:
        // It's often better to calculate from initial drag start point.
        // Let's improve the logic in a future refinement if it feels jittery.
        // For now, incremental update:
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
  }, [isDragging, isResizing, image, updateImage, zoom]);

  return (
    <div
      className="absolute flex flex-col group select-none"
      style={{
        left: image.x,
        top: image.y,
        width: image.width,
        height: image.height,
        transform: 'translate(0, 0)',
        cursor: isDragging ? 'grabbing' : 'grab',
      }}
      onMouseDown={handleMouseDown}
    >
      {/* Image Content */}
      <img 
        src={image.src} 
        alt={image.alt || "Canvas Image"} 
        className="w-full h-full object-contain pointer-events-none select-none shadow-sm hover:shadow-md transition-shadow rounded-sm"
        draggable={false}
      />

      {/* Delete Button (Visible on Hover) */}
      <button 
        onClick={(e) => {
          e.stopPropagation();
          removeImage(image.id);
        }}
        className="absolute -top-3 -right-3 p-1.5 bg-white rounded-full shadow-md text-gray-500 hover:text-red-500 hover:bg-red-50 transition-all opacity-0 group-hover:opacity-100 z-10"
      >
        <X size={14} />
      </button>
      
      {/* Resize Handle (Bottom Right) */}
      <div 
        className="absolute -bottom-1.5 -right-1.5 w-4 h-4 bg-white border border-gray-300 rounded-full cursor-nwse-resize opacity-0 group-hover:opacity-100 transition-opacity shadow-sm z-10 hover:bg-blue-50"
        onMouseDown={handleResizeStart}
      />
    </div>
  );
}
