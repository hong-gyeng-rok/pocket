"use client";

import React, { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { getCanvases, createCanvas } from "@/app/actions/canvas";
import { useRouter } from "next/navigation";
import SidebarItem from "./SidebarItem";

interface CanvasItem {
  id: string;
  title: string | null;
  createdAt: Date;
}

// 날짜 포맷팅 함수 (YYYY.MM.DD.HH.mm)
const formatDateTitle = (date: Date | string) => {
  const d = new Date(date);
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())}.${pad(
    d.getHours()
  )}.${pad(d.getMinutes())}`;
};

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  const [canvases, setCanvases] = useState<CanvasItem[]>([]);
  const router = useRouter();

  // 목록 불러오기
  const fetchCanvases = async () => {
    try {
      const data = await getCanvases();
      setCanvases(data);
    } catch (error) {
      console.error("Failed to fetch canvases:", error);
    }
  };

  useEffect(() => {
    fetchCanvases();
  }, []);

  // 새 캔버스 생성
  const handleCreateCanvas = async () => {
    try {
      const newCanvas = await createCanvas();
      await fetchCanvases();
      router.push(`/canvas/${newCanvas.id}`);
      onClose(); // Close sidebar on mobile after creating a new canvas
    } catch (error) {
      console.error("Failed to create canvas:", error);
    }
  };

  const handleItemClick = () => {
    onClose(); // Close sidebar on mobile when an item is clicked
  };

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-20 md:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside
        className={`
          fixed inset-y-0 left-0 z-30 w-64 h-screen bg-gray-50 border-r border-gray-200 flex flex-col
          transition-transform duration-300 ease-in-out
          ${isOpen ? "translate-x-0" : "-translate-x-full"}
          md:relative md:translate-x-0 md:shrink-0
        `}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <h1 className="text-xl font-bold text-gray-800">Pocket</h1>
          <button
            className="p-1 rounded-md hover:bg-gray-200 transition-colors"
            aria-label="New Canvas"
            onClick={handleCreateCanvas}
          >
            <Plus size={20} className="text-gray-600" />
          </button>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto py-2">
          <div className="px-3 pb-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">
            Recent
          </div>
          <ul className="space-y-0.5" onClick={handleItemClick}>
            {canvases.map((canvas) => (
              <SidebarItem
                key={canvas.id}
                canvas={canvas}
                formatDateTitle={formatDateTitle}
                onUpdate={fetchCanvases}
              />
            ))}
          </ul>
        </div>

        {/* User Profile (Optional placeholder) */}
        <div className="p-4 border-t border-gray-100">
          <div className="text-xs text-gray-400">Log out</div>
        </div>
      </aside>
    </>
  );
}

