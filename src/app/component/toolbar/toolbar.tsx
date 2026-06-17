"use client";

import { useToolStore } from "@/app/store/useToolStore";
import type { CanvasBackground, CanvasTheme } from "@/app/store/useToolStore";
import type { PenStyle } from "@/app/types/canvas";
import { useCanvasStore } from "@/app/store/useCanvasStore";
import { useCameraStore } from "@/app/store/useCameraStore";
import { 
  Hand, Pen, Eraser, Undo2, Redo2, Image as ImageIcon, LogIn,
  Square, Circle, Type, MousePointer2, RefreshCw, Minus, MoreHorizontal,
  LayoutGrid, NotebookTabs, Brush, Eye, EyeOff
} from "lucide-react";
import { useEffect, useState, useRef, ReactNode } from "react";
import { useSession, signIn, signOut } from "next-auth/react";
import { compressImageFile, uploadCanvasImageAsset } from "@/lib/imageCompression";

// Tooltip Component for better reusability and clean code
interface TooltipProps {
  children: ReactNode;
  label: string;
  shortcut?: string;
}

interface TemporalSnapshot {
  pastStates: unknown[];
  futureStates: unknown[];
}

interface TemporalStore {
  subscribe: (listener: (state: TemporalSnapshot) => void) => () => void;
  getState: () => {
    undo: () => void;
    redo: () => void;
  };
}

const getTemporalStore = () => {
  return (useCanvasStore as unknown as { temporal?: TemporalStore }).temporal;
};

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
  const {
    tool,
    mode,
    color,
    background,
    penStyle,
    theme,
    readOnly,
    setTool,
    setMode,
    setColor,
    setBackground,
    setPenStyle,
    setTheme,
    setReadOnly,
  } = useToolStore();
  const addImage = useCanvasStore((state) => state.addImage);
  const cameraX = useCameraStore((state) => state.x);
  const cameraY = useCameraStore((state) => state.y);
  
  const [pastStates, setPastStates] = useState<unknown[]>([]);
  const [futureStates, setFutureStates] = useState<unknown[]>([]);
  const [showAdvancedTools, setShowAdvancedTools] = useState(false);
  const [imageUploadState, setImageUploadState] = useState<"idle" | "uploading" | "fallback" | "error">("idle");
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const temporal = getTemporalStore();
    if (!temporal) return;

    const unsubscribe = temporal.subscribe((state) => {
        setPastStates(state.pastStates);
        setFutureStates(state.futureStates);
    });
    
    return () => unsubscribe();
  }, []);

  const handleUndo = () => getTemporalStore()?.getState().undo();
  const handleRedo = () => getTemporalStore()?.getState().redo();

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setImageUploadState("uploading");
      const compressed = await compressImageFile(file);
      let src = compressed.src;

      try {
        src = await uploadCanvasImageAsset(compressed.src);
        setImageUploadState("idle");
      } catch (uploadError) {
        console.warn("Image asset upload fell back to inline data:", uploadError);
        setImageUploadState("fallback");
      }

      const maxDisplayWidth = 300;
      const ratio = compressed.width / compressed.height;
      const width = Math.min(compressed.width, maxDisplayWidth);
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
    } catch (error) {
      console.error("Image upload failed:", error);
      setImageUploadState("error");
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
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
  const isAdvancedToolActive = tool === "CIRCLE" || tool === "ARROW" || tool === "TEXT";
  const backgroundOptions: { name: string; value: CanvasBackground; swatch: string }[] = [
    { name: "Plain", value: "plain", swatch: "#ffffff" },
    { name: "Paper", value: "paper", swatch: "#fbf7ed" },
    { name: "Dots", value: "dotted", swatch: "#f8f0df" },
    { name: "Grid", value: "grid", swatch: "#f7efe1" },
    { name: "Notebook", value: "notebook", swatch: "#f8f2e5" },
  ];
  const penOptions: { name: string; value: PenStyle }[] = [
    { name: "Pencil", value: "pencil" },
    { name: "Marker", value: "marker" },
    { name: "Highlighter", value: "highlighter" },
  ];
  const themeOptions: { name: string; value: CanvasTheme }[] = [
    { name: "Clean", value: "clean-paper" },
    { name: "Warm", value: "warm-notebook" },
    { name: "Chalk", value: "dark-chalkboard" },
  ];
  const showOptionsPanel = showAdvancedTools || isAdvancedToolActive;

  const toggleMode = () => {
    setMode(mode === 'DRAWING' ? 'OBJECT' : 'DRAWING');
  };

  return (
    <div className="fixed bottom-3 left-1/2 z-50 flex w-[calc(100vw-24px)] max-w-[980px] -translate-x-1/2 flex-col items-center gap-y-2 rounded-2xl border border-stone-200 bg-white/[0.92] p-1.5 shadow-xl backdrop-blur-md md:bottom-8 md:p-3">
      {/* Top Row / Left Side */}
      <div className="flex w-full flex-nowrap items-center justify-start gap-x-1.5 overflow-x-auto px-1 py-0.5 md:flex-wrap md:justify-center md:gap-x-3 md:gap-y-2 md:overflow-visible md:px-0 md:py-0">
        {/* Mode Switcher */}
        <div className="flex items-center gap-2 md:border-r md:border-gray-200 md:pr-3">
          <Tooltip
            label={
              mode === "DRAWING"
                ? "Switch to Object Mode"
                : "Switch to Drawing Mode"
            }
          >
            <button
              onClick={toggleMode}
              className="min-h-11 min-w-11 p-3 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors"
            >
              <RefreshCw
                size={20}
                className={
                  mode === "OBJECT"
                    ? "rotate-180 transition-transform"
                    : "transition-transform"
                }
              />
            </button>
          </Tooltip>
        </div>

        {/* Tool Group (Dynamic based on Mode) */}
        <div className="flex flex-nowrap items-center justify-center gap-1.5 md:flex-wrap md:gap-2 md:border-r md:border-gray-200 md:pr-3">
          {mode === "DRAWING" ? (
            <>
              <Tooltip label="Hand Tool" shortcut="Space">
                <button
                  onClick={() => setTool("HAND")}
                  className={`min-h-11 min-w-11 p-3 rounded-full transition-all ${
                    tool === "HAND"
                      ? "bg-gray-900 text-white shadow-md scale-105"
                      : "text-gray-500 hover:bg-gray-100 hover:text-gray-700"
                  }`}
                >
                  <Hand size={20} />
                </button>
              </Tooltip>

              <Tooltip label="Select Tool" shortcut="V">
                <button
                  onClick={() => setTool("SELECT")}
                  className={`min-h-11 min-w-11 p-3 rounded-full transition-all ${
                    tool === "SELECT"
                      ? "bg-gray-900 text-white shadow-md scale-105"
                      : "text-gray-500 hover:bg-gray-100 hover:text-gray-700"
                  }`}
                >
                  <MousePointer2 size={20} />
                </button>
              </Tooltip>

              <div className="w-px h-6 bg-gray-200 mx-1" />

              <Tooltip label="Pen Tool" shortcut="D">
                <button
                  onClick={() => setTool("PEN")}
                  className={`min-h-11 min-w-11 p-3 rounded-full transition-all ${
                    tool === "PEN"
                      ? "bg-gray-900 text-white shadow-md scale-105"
                      : "text-gray-500 hover:bg-gray-100 hover:text-gray-700"
                  }`}
                >
                  <Pen size={20} />
                </button>
              </Tooltip>

              <Tooltip label="Eraser Tool" shortcut="E">
                <button
                  onClick={() => setTool("ERASER")}
                  className={`min-h-11 min-w-11 p-3 rounded-full transition-all ${
                    tool === "ERASER"
                      ? "bg-gray-900 text-white shadow-md scale-105"
                      : "text-gray-500 hover:bg-gray-100 hover:text-gray-700"
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
                  onClick={() => setTool("HAND")}
                  className={`min-h-11 min-w-11 p-3 rounded-full transition-all ${
                    tool === "HAND"
                      ? "bg-gray-900 text-white shadow-md scale-105"
                      : "text-gray-500 hover:bg-gray-100 hover:text-gray-700"
                  }`}
                >
                  <Hand size={20} />
                </button>
              </Tooltip>

              <Tooltip label="Select Tool" shortcut="V">
                <button
                  onClick={() => setTool("SELECT")}
                  className={`min-h-11 min-w-11 p-3 rounded-full transition-all ${
                    tool === "SELECT"
                      ? "bg-gray-900 text-white shadow-md scale-105"
                      : "text-gray-500 hover:bg-gray-100 hover:text-gray-700"
                  }`}
                >
                  <MousePointer2 size={20} />
                </button>
              </Tooltip>

              <div className="w-px h-6 bg-gray-200 mx-1" />

              <Tooltip label="Rectangle" shortcut="R">
                <button
                  onClick={() => setTool("RECTANGLE")}
                  className={`min-h-11 min-w-11 p-3 rounded-full transition-all ${
                    tool === "RECTANGLE"
                      ? "bg-gray-900 text-white shadow-md scale-105"
                      : "text-gray-500 hover:bg-gray-100 hover:text-gray-700"
                  }`}
                >
                  <Square size={20} />
                </button>
              </Tooltip>

              {showOptionsPanel && (
                <>
                  <Tooltip label="Circle" shortcut="O">
                    <button
                      onClick={() => setTool("CIRCLE")}
                      className={`min-h-11 min-w-11 p-3 rounded-full transition-all ${
                        tool === "CIRCLE"
                          ? "bg-gray-900 text-white shadow-md scale-105"
                          : "text-gray-500 hover:bg-gray-100 hover:text-gray-700"
                      }`}
                    >
                      <Circle size={20} />
                    </button>
                  </Tooltip>

                  <Tooltip label="Arrow" shortcut="A">
                    <button
                      onClick={() => setTool("ARROW")}
                      className={`min-h-11 min-w-11 p-3 rounded-full transition-all ${
                        tool === "ARROW"
                          ? "bg-gray-900 text-white shadow-md scale-105"
                          : "text-gray-500 hover:bg-gray-100 hover:text-gray-700"
                      }`}
                    >
                      <Minus size={20} className="rotate-45" />
                    </button>
                  </Tooltip>

                  <Tooltip label="Text" shortcut="T">
                    <button
                      onClick={() => setTool("TEXT")}
                      className={`min-h-11 min-w-11 p-3 rounded-full transition-all ${
                        tool === "TEXT"
                          ? "bg-gray-900 text-white shadow-md scale-105"
                          : "text-gray-500 hover:bg-gray-100 hover:text-gray-700"
                      }`}
                    >
                      <Type size={20} />
                    </button>
                  </Tooltip>
                </>
              )}
            </>
          )}

          <Tooltip label="Advanced Tools">
            <button
              onClick={() => setShowAdvancedTools((value) => !value)}
              className={`min-h-11 min-w-11 p-3 rounded-full transition-all ${
                showOptionsPanel
                  ? "bg-gray-900 text-white shadow-md scale-105"
                  : "text-gray-500 hover:bg-gray-100 hover:text-gray-700"
              }`}
            >
              <MoreHorizontal size={20} />
            </button>
          </Tooltip>

          <Tooltip label="Add Image">
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={imageUploadState === "uploading"}
              className={`min-h-11 min-w-11 p-3 rounded-full transition-all ${
                imageUploadState === "uploading"
                  ? "text-gray-300 cursor-wait"
                  : imageUploadState === "error"
                    ? "text-red-500 hover:bg-red-50"
                    : imageUploadState === "fallback"
                      ? "text-amber-600 hover:bg-amber-50"
                      : "text-gray-500 hover:bg-gray-100 hover:text-gray-700"
              }`}
            >
              <ImageIcon size={20} className={imageUploadState === "uploading" ? "animate-pulse" : ""} />
            </button>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleImageUpload}
              accept="image/png,image/jpeg,image/webp,image/gif,image/avif,image/*"
              className="hidden"
            />
          </Tooltip>
        </div>

        {/* History Group */}
        <div className="hidden items-center gap-1 md:flex md:border-r md:border-gray-200 md:pr-3">
          <Tooltip label="Undo" shortcut="Ctrl + Z">
            <button
              onClick={handleUndo}
              disabled={pastStates.length === 0}
              className={`min-h-11 min-w-11 p-3 rounded-full transition-all ${
                pastStates.length === 0
                  ? "text-gray-300 cursor-not-allowed"
                  : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
              }`}
            >
              <Undo2 size={20} />
            </button>
          </Tooltip>

          <Tooltip label="Redo" shortcut="Ctrl + Y">
            <button
              onClick={handleRedo}
              disabled={futureStates.length === 0}
              className={`min-h-11 min-w-11 p-3 rounded-full transition-all ${
                futureStates.length === 0
                  ? "text-gray-300 cursor-not-allowed"
                  : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
              }`}
            >
              <Redo2 size={20} />
            </button>
          </Tooltip>
        </div>

        {/* Auth Group */}
        <div className="flex items-center md:pl-2">
          {session ? (
            <Tooltip label={`Sign out (${session.user?.name})`}>
              <button
                onClick={() => signOut()}
                className="p-1 rounded-full overflow-hidden border-2 border-transparent hover:border-gray-300 transition-all"
              >
                {session.user?.image ? (
                  <span
                    aria-label="User Avatar"
                    className="block w-8 h-8 rounded-full bg-center bg-cover"
                    style={{ backgroundImage: `url(${session.user.image})` }}
                  />
                ) : (
                  <div className="w-8 h-8 bg-blue-500 text-white rounded-full flex items-center justify-center font-bold">
                    {session.user?.name?.[0] || "U"}
                  </div>
                )}
              </button>
            </Tooltip>
          ) : (
            <Tooltip label="Sign in with Google">
              <button
                onClick={() => signIn("google")}
                className="min-h-11 min-w-11 p-3 rounded-full text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-all"
              >
                <LogIn size={20} />
              </button>
            </Tooltip>
          )}
        </div>
      </div>

      {/* Divider */}
      <div className={`${showOptionsPanel ? "block" : "hidden"} h-px w-full bg-gray-200 md:hidden`} />

      {/* Bottom Row / Right Side */}
      <div className={`${showOptionsPanel ? "flex" : "hidden"} w-full flex-wrap items-center justify-center gap-2 md:flex`}>
        {showOptionsPanel && (
          <div className="flex flex-wrap items-center justify-center gap-1 rounded-2xl bg-stone-100/80 p-1 md:rounded-full">
            <NotebookTabs size={16} className="ml-1 text-stone-500" />
            {backgroundOptions.map((option) => (
              <Tooltip key={option.value} label={`${option.name} background`}>
                <button
                  onClick={() => setBackground(option.value)}
                  className={`grid h-8 w-8 place-items-center rounded-full border transition-all ${
                    background === option.value
                      ? "border-stone-900 bg-white shadow-sm"
                      : "border-transparent hover:bg-white/80"
                  }`}
                  aria-label={`${option.name} background`}
                >
                  <span
                    className="h-5 w-5 rounded-full border border-stone-300"
                    style={{ backgroundColor: option.swatch }}
                  />
                </button>
              </Tooltip>
            ))}
            <span className="mx-1 hidden h-5 w-px bg-stone-300 md:block" />
            <Brush size={16} className="ml-1 text-stone-500" />
            {penOptions.map((option) => (
              <Tooltip key={option.value} label={option.name}>
                <button
                  onClick={() => {
                    setPenStyle(option.value);
                    setMode("DRAWING");
                    setTool("PEN");
                  }}
                  className={`min-h-8 rounded-full px-3 text-[11px] font-semibold transition-all ${
                    penStyle === option.value
                      ? "bg-stone-900 text-white shadow-sm"
                      : "text-stone-600 hover:bg-white/80"
                  }`}
                >
                  {option.name}
                </button>
              </Tooltip>
            ))}
            <span className="mx-1 hidden h-5 w-px bg-stone-300 md:block" />
            {themeOptions.map((option) => (
              <Tooltip key={option.value} label={`${option.name} theme`}>
                <button
                  onClick={() => {
                    setTheme(option.value);
                    if (option.value === "dark-chalkboard") setBackground("grid");
                    if (option.value === "warm-notebook") setBackground("notebook");
                    if (option.value === "clean-paper") setBackground("paper");
                  }}
                  className={`min-h-8 rounded-full px-2 text-[11px] font-semibold transition-all ${
                    theme === option.value
                      ? "bg-stone-900 text-white shadow-sm"
                      : "text-stone-600 hover:bg-white/80"
                  }`}
                >
                  {option.name}
                </button>
              </Tooltip>
            ))}
            <Tooltip label={readOnly ? "Disable read mode" : "Read mode"}>
              <button
                onClick={() => setReadOnly(!readOnly)}
                className={`grid min-h-8 min-w-8 place-items-center rounded-full transition-all ${
                  readOnly ? "bg-stone-900 text-white" : "text-stone-600 hover:bg-white/80"
                }`}
                aria-label="Toggle read mode"
              >
                {readOnly ? <Eye size={16} /> : <EyeOff size={16} />}
              </button>
            </Tooltip>
          </div>
        )}
        {!showOptionsPanel && (
          <Tooltip label="Backgrounds">
            <button
              onClick={() => setShowAdvancedTools(true)}
              className="min-h-11 min-w-11 rounded-full text-stone-500 transition-all hover:bg-stone-100 hover:text-stone-800"
              aria-label="Show background options"
            >
              <LayoutGrid size={20} className="mx-auto" />
            </button>
          </Tooltip>
        )}
        {/* Color Group */}
        <div className="flex items-center justify-center gap-2">
          {activeColors.map((c) => (
            <Tooltip key={c.value} label={c.name}>
              <button
                onClick={() => {
                  setColor(c.value);
                  if (mode === "DRAWING" && tool === "NONE") setTool("PEN");
                }}
                className={`h-7 w-7 rounded-full border border-gray-200 transition-transform md:h-6 md:w-6 ${
                  color === c.value && tool !== "ERASER"
                    ? "scale-110 border-gray-900 shadow-sm md:scale-125"
                    : "hover:scale-110"
                }`}
                style={{ backgroundColor: c.value }}
              />
            </Tooltip>
          ))}
          {/* Native Color Picker */}
          <Tooltip label="Custom Color">
            <div className="relative h-7 w-7 overflow-hidden rounded-full border border-gray-200 transition-transform hover:scale-110 md:h-6 md:w-6">
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="absolute left-1/2 top-1/2 h-[150%] w-[150%] -translate-x-1/2 -translate-y-1/2 cursor-pointer border-0 p-0"
              />
            </div>
          </Tooltip>
        </div>
      </div>
    </div>
  );
}
