"use client";

import { useToolStore } from "@/app/store/useToolStore";
import { useCanvasStore } from "@/app/store/useCanvasStore";
import { Hand, Pen, Eraser, Undo2, Redo2 } from "lucide-react";
import { useEffect, useState, ReactNode } from "react";

// Tooltip Component for better reusability and clean code
interface TooltipProps {
  children: ReactNode;
  label: string;
  shortcut?: string;
}

function Tooltip({ children, label, shortcut }: TooltipProps) {
  return (
    <div className="group relative flex flex-col items-center">
      {children}
      <div className="absolute bottom-full mb-2 flex flex-col items-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
        <div className="bg-gray-900 text-white text-[10px] px-2 py-1 rounded shadow-lg whitespace-nowrap flex gap-2 items-center">
          <span className="font-medium">{label}</span>
          {shortcut && (
            <span className="text-gray-400 border-l border-gray-700 pl-2">
              {shortcut}
            </span>
          )}
        </div>
        {/* Triangle arrow */}
        <div className="w-2 h-2 bg-gray-900 rotate-45 -mt-1" />
      </div>
    </div>
  );
}

export default function Toolbar() {
  const { tool, color, setTool, setColor } = useToolStore();
  
  const [pastStates, setPastStates] = useState<any[]>([]);
  const [futureStates, setFutureStates] = useState<any[]>([]);
  
  useEffect(() => {
    const temporal = (useCanvasStore as any).temporal;
    if (!temporal) return;

    const unsubscribe = temporal.subscribe((state: any) => {
        setPastStates(state.pastStates);
        setFutureStates(state.futureStates);
    });
    
    return () => unsubscribe();
  }, []);

  const handleUndo = () => (useCanvasStore as any).temporal.getState().undo();
  const handleRedo = () => (useCanvasStore as any).temporal.getState().redo();

  const colors = [
    { name: "Black", value: "#000000" },
    { name: "Red", value: "#EF4444" },
    { name: "Blue", value: "#3B82F6" },
  ];

  return (
    <div className="fixed bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-4 p-3 bg-white/90 backdrop-blur-md rounded-full shadow-xl border border-gray-200 z-50">
      
      {/* Tool Group */}
      <div className="flex items-center gap-2 pr-4 border-r border-gray-200">
        <Tooltip label="Hand Tool" shortcut="Space">
          <button
            onClick={() => setTool('NONE')}
            className={`p-3 rounded-full transition-all ${
              tool === 'NONE' 
                ? 'bg-gray-900 text-white shadow-md scale-105' 
                : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'
            }`}
          >
            <Hand size={20} />
          </button>
        </Tooltip>

        <Tooltip label="Pen Tool" shortcut="Ctrl + D">
          <button
            onClick={() => setTool('PEN')}
            className={`p-3 rounded-full transition-all ${
              tool === 'PEN' 
                ? 'bg-gray-900 text-white shadow-md scale-105' 
                : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'
            }`}
          >
            <Pen size={20} />
          </button>
        </Tooltip>

        <Tooltip label="Eraser Tool" shortcut="Ctrl + E">
          <button
            onClick={() => setTool('ERASER')}
            className={`p-3 rounded-full transition-all ${
              tool === 'ERASER' 
                ? 'bg-gray-900 text-white shadow-md scale-105' 
                : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'
            }`}
          >
            <Eraser size={20} />
          </button>
        </Tooltip>
      </div>

      {/* Color Group */}
      <div className="flex items-center gap-2 pr-4 border-r border-gray-200">
        {colors.map((c) => (
          <Tooltip key={c.value} label={c.name} shortcut="Ctrl + C">
            <button
              onClick={() => {
                  setColor(c.value);
                  if (tool === 'NONE') setTool('PEN');
              }}
              className={`w-8 h-8 rounded-full border-2 transition-transform ${
                color === c.value && tool !== 'ERASER'
                  ? 'border-gray-900 scale-110 shadow-sm' 
                  : 'border-transparent hover:scale-105'
              }`}
              style={{ backgroundColor: c.value }}
            />
          </Tooltip>
        ))}
      </div>

      {/* History Group */}
      <div className="flex items-center gap-1">
        <Tooltip label="Undo" shortcut="Ctrl + Z">
          <button
            onClick={handleUndo}
            disabled={pastStates.length === 0}
            className={`p-3 rounded-full transition-all ${
              pastStates.length === 0
                ? 'text-gray-300 cursor-not-allowed' 
                : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
            }`}
          >
            <Undo2 size={20} />
          </button>
        </Tooltip>

        <Tooltip label="Redo" shortcut="Ctrl + Y">
          <button
            onClick={handleRedo}
            disabled={futureStates.length === 0}
            className={`p-3 rounded-full transition-all ${
              futureStates.length === 0
                ? 'text-gray-300 cursor-not-allowed' 
                : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
            }`}
          >
            <Redo2 size={20} />
          </button>
        </Tooltip>
      </div>
    </div>
  );
}
