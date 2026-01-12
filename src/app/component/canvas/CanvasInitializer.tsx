"use client";

import { useEffect, useRef } from "react";
import { useCanvasStore } from "@/app/store/useCanvasStore";
import { saveCanvas } from "@/app/actions/canvas";
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
  const { setStrokes, strokes, memos, images } = useCanvasStore();
  const isInitialized = useRef(false); // 초기화 여부 추적
  
  // 1. 초기 데이터 로드 (마운트 시 한 번만, 또는 canvasId가 바뀔 때)
  useEffect(() => {
    isInitialized.current = false; // 캔버스 ID 변경 시 초기화 플래그 리셋
    if (initialContent) {
      // DB 데이터 구조에 맞게 복원
      const content = initialContent as any;
      
      useCanvasStore.setState({
        strokes: content.strokes || [],
        memos: content.memos || [],
        images: content.images || [],
      });
      // 상태 업데이트 후 약간의 지연 뒤에 초기화 완료 처리 (useEffect 실행 순서 고려)
      setTimeout(() => {
         isInitialized.current = true;
      }, 100);
    } else {
      isInitialized.current = true;
    }
  }, [canvasId, initialContent]);

  // 2. 자동 저장 (Autosave)
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  useEffect(() => {
    // 초기화가 아직 안 끝났으면 저장하지 않음
    if (!isInitialized.current) return;

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(async () => {
      const currentContent = {
        strokes,
        memos,
        images,
      };
      
      try {
        await saveCanvas(canvasId, currentContent);
        console.log("Canvas auto-saved");
      } catch (error) {
        console.error("Auto-save failed:", error);
      }
    }, 2000); // 2초 후 저장

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [strokes, memos, images, canvasId]);

  return <CanvasLayout />;
}
