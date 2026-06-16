"use client";

import { Download, FileJson, MapPinned, Plus, Search, X } from "lucide-react";
import { useMemo, useState } from "react";
import { useCanvasStore } from "@/app/store/useCanvasStore";
import { useCameraStore } from "@/app/store/useCameraStore";
import { toCanvasContent } from "@/app/types/canvas";
import { getObjectBounds, getStrokeBounds } from "@/lib/canvasGeometry";

interface Bookmark {
  id: string;
  label: string;
  x: number;
  y: number;
  zoom: number;
}

const downloadText = (filename: string, content: string, type: string) => {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
};

export default function CanvasUtilityPanel() {
  const [query, setQuery] = useState("");
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  const strokes = useCanvasStore((state) => state.strokes);
  const memos = useCanvasStore((state) => state.memos);
  const images = useCanvasStore((state) => state.images);
  const shapes = useCanvasStore((state) => state.shapes);
  const setSelectedIds = useCanvasStore((state) => state.setSelectedIds);
  const camera = useCameraStore();

  const searchResults = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return [];

    return [
      ...memos
        .filter((memo) => memo.content.toLowerCase().includes(normalized))
        .map((memo) => ({ id: memo.id, label: memo.content.slice(0, 40) || "Memo", x: memo.x, y: memo.y })),
      ...shapes
        .filter((shape) => (shape.text ?? "").toLowerCase().includes(normalized))
        .map((shape) => ({ id: shape.id, label: shape.text?.slice(0, 40) || "Text", x: shape.x, y: shape.y })),
    ].slice(0, 6);
  }, [memos, query, shapes]);

  const minimap = useMemo(() => {
    const rects = [
      ...memos.map((memo) => getObjectBounds(memo)),
      ...images.map((image) => getObjectBounds(image)),
      ...shapes.map((shape) => getObjectBounds(shape)),
      ...strokes.flatMap((stroke) => {
        const bounds = getStrokeBounds(stroke);
        return bounds ? [bounds] : [];
      }),
    ];

    if (rects.length === 0) return null;

    const minX = Math.min(...rects.map((rect) => rect.x));
    const minY = Math.min(...rects.map((rect) => rect.y));
    const maxX = Math.max(...rects.map((rect) => rect.x + rect.width));
    const maxY = Math.max(...rects.map((rect) => rect.y + rect.height));
    const width = Math.max(1, maxX - minX);
    const height = Math.max(1, maxY - minY);

    return { rects, minX, minY, width, height };
  }, [images, memos, shapes, strokes]);

  const jumpTo = (id: string, x: number, y: number) => {
    camera.setCamera(x - 240, y - 160, Math.max(camera.zoom, 0.8));
    setSelectedIds([id]);
  };

  const addBookmark = () => {
    setBookmarks((items) => [
      ...items,
      {
        id: crypto.randomUUID(),
        label: `Spot ${items.length + 1}`,
        x: camera.x,
        y: camera.y,
        zoom: camera.zoom,
      },
    ]);
  };

  const exportJson = () => {
    const content = toCanvasContent({ strokes, memos, images, shapes });
    downloadText("pocket-canvas.json", JSON.stringify(content, null, 2), "application/json");
  };

  const exportPng = () => {
    const canvas = document.querySelector("canvas");
    if (!(canvas instanceof HTMLCanvasElement)) return;

    const link = document.createElement("a");
    link.download = "pocket-canvas.png";
    link.href = canvas.toDataURL("image/png");
    link.click();
  };

  return (
    <section className="fixed right-3 top-20 z-40 flex flex-col items-end gap-2 md:right-4">
      <button
        onClick={() => setIsOpen((value) => !value)}
        className="grid min-h-11 min-w-11 place-items-center rounded-full border border-stone-200 bg-white/90 text-stone-700 shadow-sm backdrop-blur hover:bg-white"
        aria-label="Open canvas utilities"
      >
        {isOpen ? <X size={18} /> : <Search size={18} />}
      </button>

      {isOpen && (
        <div className="w-[min(340px,calc(100vw-24px))] rounded-2xl border border-stone-200 bg-white/95 p-3 shadow-xl backdrop-blur">
          <div className="flex items-center gap-2 rounded-full bg-stone-100 px-3 py-2">
            <Search size={16} className="text-stone-500" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="w-full bg-transparent text-sm outline-none"
              placeholder="Search notes"
            />
          </div>

          {searchResults.length > 0 && (
            <div className="mt-2 space-y-1">
              {searchResults.map((result) => (
                <button
                  key={result.id}
                  onClick={() => jumpTo(result.id, result.x, result.y)}
                  className="w-full rounded-lg px-2 py-2 text-left text-sm text-stone-700 hover:bg-stone-100"
                >
                  {result.label}
                </button>
              ))}
            </div>
          )}

          <div className="mt-3 flex items-center gap-2">
            <button
              onClick={addBookmark}
              className="flex min-h-10 flex-1 items-center justify-center gap-2 rounded-full bg-stone-900 px-3 text-sm font-medium text-white"
            >
              <Plus size={16} />
              Bookmark
            </button>
            <button
              onClick={exportPng}
              className="grid min-h-10 min-w-10 place-items-center rounded-full bg-stone-100 text-stone-700"
              aria-label="Export PNG"
            >
              <Download size={16} />
            </button>
            <button
              onClick={exportJson}
              className="grid min-h-10 min-w-10 place-items-center rounded-full bg-stone-100 text-stone-700"
              aria-label="Export JSON"
            >
              <FileJson size={16} />
            </button>
          </div>

          {bookmarks.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {bookmarks.map((bookmark) => (
                <button
                  key={bookmark.id}
                  onClick={() => camera.setCamera(bookmark.x, bookmark.y, bookmark.zoom)}
                  className="flex items-center gap-1 rounded-full bg-amber-100 px-2 py-1 text-xs font-medium text-stone-700"
                >
                  <MapPinned size={12} />
                  {bookmark.label}
                </button>
              ))}
            </div>
          )}

          {minimap && (
            <button
              onClick={() => camera.setCamera(minimap.minX - 120, minimap.minY - 120, 0.5)}
              className="mt-3 h-24 w-full overflow-hidden rounded-xl border border-stone-200 bg-stone-50"
              aria-label="Jump to canvas overview"
            >
              <svg viewBox={`0 0 ${minimap.width} ${minimap.height}`} className="h-full w-full">
                {minimap.rects.slice(0, 160).map((rect, index) => (
                  <rect
                    key={index}
                    x={rect.x - minimap.minX}
                    y={rect.y - minimap.minY}
                    width={Math.max(rect.width, 8)}
                    height={Math.max(rect.height, 8)}
                    fill="rgba(68,64,60,0.45)"
                  />
                ))}
              </svg>
            </button>
          )}
        </div>
      )}
    </section>
  );
}
