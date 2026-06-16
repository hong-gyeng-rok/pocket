"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import CanvasLayout from "@/app/layout/canvasLayout";
import { isCanvasContentEmpty, normalizeCanvasContent, toCanvasContent } from "@/app/types/canvas";
import type { CanvasContent } from "@/app/types/canvas";
import type { SaveStatus } from "@/app/types/saveStatus";
import { useCanvasStore } from "@/app/store/useCanvasStore";
import { importLocalCanvas } from "@/app/actions/canvas";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

const LOCAL_CANVAS_KEY = "pocket-local-canvas";

const readLocalCanvasContent = () => {
  try {
    const localContent = localStorage.getItem(LOCAL_CANVAS_KEY);
    return normalizeCanvasContent(localContent ? JSON.parse(localContent) : null);
  } catch (error) {
    console.error("Local canvas load failed:", error);
    return normalizeCanvasContent(null);
  }
};

export default function LocalCanvasInitializer() {
  const router = useRouter();
  const { status } = useSession();
  const { strokes, memos, images, shapes } = useCanvasStore();
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("saved");
  const isInitialized = useRef(false);
  const isImporting = useRef(false);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const stateRef = useRef(toCanvasContent({ strokes, memos, images, shapes }));

  useEffect(() => {
    const content = readLocalCanvasContent();

    useCanvasStore.setState({
      strokes: content.strokes,
      memos: content.memos,
      images: content.images,
      shapes: content.shapes,
      selectedIds: [],
    });

    isInitialized.current = true;
  }, []);

  useEffect(() => {
    stateRef.current = toCanvasContent({ strokes, memos, images, shapes });
  }, [strokes, memos, images, shapes]);

  const saveLocalCanvas = useCallback((content: CanvasContent) => {
    if (isImporting.current) return;

    try {
      setSaveStatus("saving");
      localStorage.setItem(LOCAL_CANVAS_KEY, JSON.stringify(content));
      setSaveStatus("saved");
    } catch (error) {
      setSaveStatus("error");
      console.error("Local canvas save failed:", error);
    }
  }, []);

  useEffect(() => {
    if (status !== "authenticated" || !isInitialized.current || isImporting.current) return;

    const content = stateRef.current;
    if (isCanvasContentEmpty(content)) return;

    isImporting.current = true;
    queueMicrotask(() => setSaveStatus("saving"));

    importLocalCanvas(content)
      .then((canvas) => {
        localStorage.removeItem(LOCAL_CANVAS_KEY);
        if (canvas?.id) router.push(`/canvas/${canvas.id}`);
      })
      .catch((error) => {
        isImporting.current = false;
        setSaveStatus("error");
        console.error("Local canvas import failed:", error);
      });
  }, [router, status]);

  useEffect(() => {
    if (!isInitialized.current) return;
    queueMicrotask(() => setSaveStatus("pending"));

    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      saveLocalCanvas(stateRef.current);
    }, 500);

    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, [strokes, memos, images, shapes, saveLocalCanvas]);

  useEffect(() => {
    const handleBeforeUnload = () => {
      if (isInitialized.current) saveLocalCanvas(stateRef.current);
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [saveLocalCanvas]);

  return <CanvasLayout saveStatus={saveStatus} />;
}
