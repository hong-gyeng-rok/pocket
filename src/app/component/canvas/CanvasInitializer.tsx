"use client";

import { useEffect, useRef, useCallback } from "react";
import { useCanvasStore } from "@/app/store/useCanvasStore";
import CanvasLayout from "@/app/layout/canvasLayout";

interface CanvasInitializerProps {
  canvasId: string;
  initialContent: any;
  title: string | null;
}

export default function CanvasInitializer({
  canvasId,
  initialContent,
  title,
}: CanvasInitializerProps) {
  const { setStrokes, strokes, memos, images, shapes } = useCanvasStore();
  const isInitialized = useRef(false); 
  
  // 1. 초기 데이터 로드
  useEffect(() => {
    isInitialized.current = false;
    if (initialContent) {
      const content = initialContent as any;
      
      // Zustand persist rehydration might happen automatically from localStorage.
      // We need to decide strategy: Server vs Local.
      // For now, Server wins on page load to ensure sync across devices.
      // But we could check timestamps if we stored them.
      
      useCanvasStore.setState({
        strokes: content.strokes || [],
        memos: content.memos || [],
        images: content.images || [],
        shapes: content.shapes || [],
      });
      
      setTimeout(() => {
         isInitialized.current = true;
      }, 500); // Slightly longer buffer
    } else {
      isInitialized.current = true;
    }
  }, [canvasId, initialContent]);

  // Save Function (Reusable)
  const saveToBackend = useCallback(async (data: any) => {
      try {
          await fetch('/api/canvas/save', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ id: canvasId, content: data }),
              keepalive: true, // Key for saving on close
          });
          console.log("Saved to backend");
      } catch (err) {
          console.error("Save failed", err);
      }
  }, [canvasId]);

  // 2. 자동 저장 (Debounce + Exit Safety)
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // 최신 상태를 Ref에 담아두어야 Event Listener 안에서 접근 가능 (Closure 문제 해결)
  const stateRef = useRef({ strokes, memos, images, shapes });
  useEffect(() => {
      stateRef.current = { strokes, memos, images, shapes };
  }, [strokes, memos, images, shapes]);

  useEffect(() => {
    if (!isInitialized.current) return;

    // Debounce Save (Background sync)
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    
    saveTimeoutRef.current = setTimeout(() => {
        saveToBackend(stateRef.current);
    }, 2000);

    return () => {
        if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, [strokes, memos, images, shapes, saveToBackend]); // Trigger on change

  // 3. 페이지 종료/숨김 시 즉시 저장 (Safety Net)
  useEffect(() => {
      const handleUnload = () => {
          // Force save current state
          if (isInitialized.current) {
             saveToBackend(stateRef.current);
          }
      };

      const handleVisibilityChange = () => {
          if (document.visibilityState === 'hidden' && isInitialized.current) {
              saveToBackend(stateRef.current);
          }
      };

      window.addEventListener('beforeunload', handleUnload);
      document.addEventListener('visibilitychange', handleVisibilityChange);
      
      return () => {
          window.removeEventListener('beforeunload', handleUnload);
          document.removeEventListener('visibilitychange', handleVisibilityChange);
      };
  }, [saveToBackend]);

  return <CanvasLayout />;
}

