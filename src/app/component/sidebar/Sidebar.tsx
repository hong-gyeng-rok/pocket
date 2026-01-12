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

export default function Sidebar() {
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
      // 목록 갱신
      await fetchCanvases();
      // 새 캔버스로 이동
      router.push(`/canvas/${newCanvas.id}`);
    } catch (error) {
      console.error("Failed to create canvas:", error);
    }
  };

  return (
    <aside className="w-64 h-screen bg-gray-50 border-r border-gray-200 flex flex-col shrink-0">
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
        <ul className="space-y-0.5">
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
  );
}
