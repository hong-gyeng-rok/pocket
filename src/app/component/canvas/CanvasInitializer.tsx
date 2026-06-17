"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { useCanvasStore } from "@/app/store/useCanvasStore";
import CanvasLayout from "@/app/layout/canvasLayout";
import { createEmptyCanvasContent, normalizeCanvasContent, toCanvasContent } from "@/app/types/canvas";
import type { CanvasContent } from "@/app/types/canvas";
import type { SaveStatus } from "@/app/types/saveStatus";

interface CanvasInitializerProps {
  canvasId: string;
  initialContent: unknown;
  title: string | null;
}

export default function CanvasInitializer({
  canvasId,
  initialContent,
}: CanvasInitializerProps) {
  const { strokes, memos, images, shapes } = useCanvasStore();
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("saved");
  const isInitialized = useRef(false); 
  const saveRequestId = useRef(0);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  // 1. 초기 데이터 로드
  useEffect(() => {
    isInitialized.current = false;
    localStorage.removeItem("pocket-canvas-storage");

    const content = initialContent
      ? normalizeCanvasContent(initialContent)
      : createEmptyCanvasContent();

    useCanvasStore.setState({
      strokes: content.strokes,
      memos: content.memos,
      images: content.images,
      shapes: content.shapes,
      selectedIds: [],
    });

    queueMicrotask(() => {
      isInitialized.current = true;
    });

    return () => {
      isInitialized.current = false;
    };
  }, [canvasId, initialContent]);

  // Save Function (Reusable)
  const saveToBackend = useCallback(async (data: CanvasContent) => {
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        setSaveStatus("offline");
        return;
      }

      const currentRequestId = saveRequestId.current + 1;
      saveRequestId.current = currentRequestId;
      setSaveStatus("saving");

      try {
          const response = await fetch('/api/canvas/save', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ id: canvasId, content: data }),
              keepalive: true, // Key for saving on close
          });

          if (!response.ok) {
            throw new Error(`Save request failed with ${response.status}`);
          }

          if (saveRequestId.current === currentRequestId) {
            setSaveStatus("saved");
          }
      } catch (err) {
          if (saveRequestId.current === currentRequestId) {
            setSaveStatus("error");
          }
          console.error("Save failed", err);
      }
  }, [canvasId]);

  // 2. 자동 저장 (Debounce + Exit Safety)
  // 최신 상태를 Ref에 담아두어야 Event Listener 안에서 접근 가능 (Closure 문제 해결)
  const stateRef = useRef(toCanvasContent({ strokes, memos, images, shapes }));
  useEffect(() => {
      stateRef.current = toCanvasContent({ strokes, memos, images, shapes });
  }, [strokes, memos, images, shapes]);

  const saveWithBeacon = useCallback((data: CanvasContent) => {
      if (typeof navigator === "undefined" || typeof navigator.sendBeacon !== "function") {
          return false;
      }

      const payload = JSON.stringify({ id: canvasId, content: data });
      const blob = new Blob([payload], { type: "application/json" });
      return navigator.sendBeacon("/api/canvas/save", blob);
  }, [canvasId]);

  const flushSave = useCallback((preferBeacon = false) => {
      if (!isInitialized.current) return;
      if (saveTimeoutRef.current) {
          clearTimeout(saveTimeoutRef.current);
          saveTimeoutRef.current = null;
      }

      const content = stateRef.current;
      if (preferBeacon && saveWithBeacon(content)) {
          setSaveStatus("pending");
          return;
      }

      void saveToBackend(content);
  }, [saveToBackend, saveWithBeacon]);

  useEffect(() => {
      const handleOffline = () => setSaveStatus("offline");
      const handleOnline = () => {
          if (isInitialized.current) {
              saveToBackend(stateRef.current);
          } else {
              setSaveStatus("saved");
          }
      };

      if (!navigator.onLine) {
          setSaveStatus("offline");
      }

      window.addEventListener('offline', handleOffline);
      window.addEventListener('online', handleOnline);

      return () => {
          window.removeEventListener('offline', handleOffline);
          window.removeEventListener('online', handleOnline);
      };
  }, [saveToBackend]);

  useEffect(() => {
    if (!isInitialized.current) return;
    setSaveStatus("pending");

    // Debounce Save (Background sync)
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    
    saveTimeoutRef.current = setTimeout(() => {
        saveToBackend(stateRef.current);
    }, 600);

    return () => {
        if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, [strokes, memos, images, shapes, saveToBackend]); // Trigger on change

  // 3. 페이지 종료/숨김 시 즉시 저장 (Safety Net)
  useEffect(() => {
      const handleUnload = () => {
          flushSave(true);
      };

      const handleVisibilityChange = () => {
          if (document.visibilityState === 'hidden' && isInitialized.current) {
              flushSave(true);
          }
      };

      window.addEventListener('beforeunload', handleUnload);
      window.addEventListener('pagehide', handleUnload);
      document.addEventListener('visibilitychange', handleVisibilityChange);
      
      return () => {
          window.removeEventListener('beforeunload', handleUnload);
          window.removeEventListener('pagehide', handleUnload);
          document.removeEventListener('visibilitychange', handleVisibilityChange);
      };
  }, [flushSave]);

  return <CanvasLayout saveStatus={saveStatus} />;
}
