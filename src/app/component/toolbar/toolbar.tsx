"use client";

import { useToolStore } from "@/app/store/useToolStore";
import { useCanvasStore } from "@/app/store/useCanvasStore";
import { useCameraStore } from "@/app/store/useCameraStore";
import { 
  Hand, Pen, Eraser, Undo2, Redo2, Image as ImageIcon, LogIn, LogOut, 
  Square, Circle, Type, MousePointer2, RefreshCw, Minus 
} from "lucide-react";
import { useEffect, useState, useRef, ReactNode } from "react";
import { useSession, signIn, signOut } from "next-auth/react";

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
  const { data: session } = useSession();
  const { tool, mode, color, setTool, setMode, setColor } = useToolStore();
  const addImage = useCanvasStore((state) => state.addImage);
  const cameraX = useCameraStore((state) => state.x);
  const cameraY = useCameraStore((state) => state.y);
  
  const [pastStates, setPastStates] = useState<any[]>([]);
  const [futureStates, setFutureStates] = useState<any[]>([]);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const src = event.target?.result as string;
      const img = new Image();
      img.onload = () => {
        const maxWidth = 300;
        const ratio = img.width / img.height;
        const width = Math.min(img.width, maxWidth);
        const height = width / ratio;
        const x = cameraX + 100;
        const y = cameraY + 100;

        addImage({
          id: crypto.randomUUID(),
          src,
          x,
          y,
          width,
          height,
          alt: file.name,
        });
      };
      img.src = src;
    };
    reader.readAsDataURL(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const drawingColors = [
    { name: "Black", value: "#000000" },
    { name: "Red", value: "#ef4444" },
    { name: "Blue", value: "#3b82f6" },
  ];

  const objectColors = [
    { name: "Black", value: "#000000" },
    { name: "White", value: "#ffffff" },
    { name: "Red", value: "#FECACA" },    // Pastel Red
    { name: "Orange", value: "#FED7AA" }, // Pastel Orange
    { name: "Yellow", value: "#FEF08A" }, // Pastel Yellow
    { name: "Green", value: "#BBF7D0" },  // Pastel Green
    { name: "Blue", value: "#BFDBFE" },   // Pastel Blue
    { name: "Purple", value: "#E9D5FF" }, // Pastel Purple
    { name: "Pink", value: "#FBCFE8" },   // Pastel Pink
  ];

  const activeColors = mode === 'DRAWING' ? drawingColors : objectColors;

  const toggleMode = () => {
    setMode(mode === 'DRAWING' ? 'OBJECT' : 'DRAWING');
  };

  return (
    <div className="fixed bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-4 p-3 bg-white/90 backdrop-blur-md rounded-full shadow-xl border border-gray-200 z-50">
      
      {/* Mode Switcher */}
      <div className="flex items-center gap-2 pr-4 border-r border-gray-200">
        <Tooltip label={mode === 'DRAWING' ? "Switch to Object Mode" : "Switch to Drawing Mode"}>
          <button
            onClick={toggleMode}
            className="p-3 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors"
          >
            <RefreshCw size={20} className={mode === 'OBJECT' ? "rotate-180 transition-transform" : "transition-transform"} />
          </button>
        </Tooltip>
      </div>

      {/* Tool Group (Dynamic based on Mode) */}
      <div className="flex items-center gap-2 pr-4 border-r border-gray-200">
        {mode === 'DRAWING' ? (
          <>
            <Tooltip label="Hand Tool" shortcut="Space">
              <button
                onClick={() => setTool('HAND')}
                className={`p-3 rounded-full transition-all ${
                  tool === 'HAND' 
                    ? 'bg-gray-900 text-white shadow-md scale-105' 
                    : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'
                }`}
              >
                <Hand size={20} />
              </button>
            </Tooltip>

            <Tooltip label="Select Tool" shortcut="V">
              <button
                onClick={() => setTool('SELECT')}
                className={`p-3 rounded-full transition-all ${
                  tool === 'SELECT' 
                    ? 'bg-gray-900 text-white shadow-md scale-105' 
                    : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'
                }`}
              >
                <MousePointer2 size={20} />
              </button>
            </Tooltip>

            <div className="w-px h-6 bg-gray-200 mx-1" />

            <Tooltip label="Pen Tool" shortcut="D">
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

            <Tooltip label="Eraser Tool" shortcut="E">
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
          </>
        ) : (
          <>
            <Tooltip label="Hand Tool" shortcut="Space">
              <button
                onClick={() => setTool('HAND')}
                className={`p-3 rounded-full transition-all ${
                  tool === 'HAND' 
                    ? 'bg-gray-900 text-white shadow-md scale-105' 
                    : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'
                }`}
              >
                <Hand size={20} />
              </button>
            </Tooltip>

            <Tooltip label="Select Tool" shortcut="V">
              <button
                onClick={() => setTool('SELECT')}
                className={`p-3 rounded-full transition-all ${
                  tool === 'SELECT' 
                    ? 'bg-gray-900 text-white shadow-md scale-105' 
                    : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'
                }`}
              >
                <MousePointer2 size={20} />
              </button>
            </Tooltip>

            <div className="w-px h-6 bg-gray-200 mx-1" />

            <Tooltip label="Rectangle" shortcut="R">
              <button
                onClick={() => setTool('RECTANGLE')}
                className={`p-3 rounded-full transition-all ${
                  tool === 'RECTANGLE' 
                    ? 'bg-gray-900 text-white shadow-md scale-105' 
                    : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'
                }`}
              >
                <Square size={20} />
              </button>
            </Tooltip>

            <Tooltip label="Circle" shortcut="O">
              <button
                onClick={() => setTool('CIRCLE')}
                className={`p-3 rounded-full transition-all ${
                  tool === 'CIRCLE' 
                    ? 'bg-gray-900 text-white shadow-md scale-105' 
                    : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'
                }`}
              >
                <Circle size={20} />
              </button>
            </Tooltip>

             <Tooltip label="Arrow" shortcut="A">
              <button
                onClick={() => setTool('ARROW')}
                className={`p-3 rounded-full transition-all ${
                  tool === 'ARROW' 
                    ? 'bg-gray-900 text-white shadow-md scale-105' 
                    : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'
                }`}
              >
                <Minus size={20} className="rotate-45" />
              </button>
            </Tooltip>

            <Tooltip label="Text" shortcut="T">
              <button
                onClick={() => setTool('TEXT')}
                className={`p-3 rounded-full transition-all ${
                  tool === 'TEXT' 
                    ? 'bg-gray-900 text-white shadow-md scale-105' 
                    : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'
                }`}
              >
                <Type size={20} />
              </button>
            </Tooltip>
          </>
        )}

        {/* Image Upload Button (Common) */}
        <Tooltip label="Add Image">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="p-3 rounded-full text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-all"
          >
            <ImageIcon size={20} />
          </button>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleImageUpload}
            accept="image/*"
            className="hidden"
          />
        </Tooltip>
      </div>

      {/* Color Group */}
      <div className="flex items-center gap-2 pr-4 border-r border-gray-200">
        {activeColors.map((c) => (
          <Tooltip key={c.value} label={c.name} shortcut="Ctrl + C">
            <button
              onClick={() => {
                  setColor(c.value);
                  if (mode === 'DRAWING' && tool === 'NONE') setTool('PEN');
              }}
              className={`w-6 h-6 rounded-full border border-gray-200 transition-transform ${
                color === c.value && tool !== 'ERASER'
                  ? 'border-gray-900 scale-125 shadow-sm' 
                  : 'hover:scale-110'
              }`}
              style={{ backgroundColor: c.value }}
            />
          </Tooltip>
        ))}
        {/* Native Color Picker */}
        <Tooltip label="Custom Color">
           <div className="relative w-6 h-6 rounded-full overflow-hidden border border-gray-200 hover:scale-110 transition-transform">
             <input 
               type="color" 
               value={color}
               onChange={(e) => setColor(e.target.value)}
               className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[150%] h-[150%] p-0 border-0 cursor-pointer"
             />
           </div>
        </Tooltip>
      </div>

      {/* History Group */}
      <div className="flex items-center gap-1 border-r border-gray-200 pr-4">
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
      
      {/* Auth Group */}
      <div className="flex items-center pl-2">
        {session ? (
           <Tooltip label={`Sign out (${session.user?.name})`}>
             <button
               onClick={() => signOut()}
               className="p-1 rounded-full overflow-hidden border-2 border-transparent hover:border-gray-300 transition-all"
             >
               {session.user?.image ? (
                 <img src={session.user.image} alt="User Avatar" className="w-8 h-8 rounded-full" />
               ) : (
                 <div className="w-8 h-8 bg-blue-500 text-white rounded-full flex items-center justify-center font-bold">
                    {session.user?.name?.[0] || 'U'}
                 </div>
               )}
             </button>
           </Tooltip>
        ) : (
          <Tooltip label="Sign in with Google">
            <button
              onClick={() => signIn('google')}
              className="p-3 rounded-full text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-all"
            >
              <LogIn size={20} />
            </button>
          </Tooltip>
        )}
      </div>
    </div>
  );
}

