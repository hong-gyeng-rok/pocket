import { useEffect, useRef } from 'react';
import { useCanvasStore } from '@/app/store/useCanvasStore';
import type { ImageElement, Memo, Shape } from '@/app/store/useCanvasStore';

type CopyableCanvasObject = Shape | Memo | ImageElement;

const isEditableTarget = (target: EventTarget | null) => {
  return target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement;
};

const isLockedObject = (id: string) => {
  const { shapes, memos, images } = useCanvasStore.getState();
  return (
    shapes.some((shape) => shape.id === id && shape.isLocked) ||
    memos.some((memo) => memo.id === id && memo.isLocked) ||
    images.some((image) => image.id === id && image.isLocked)
  );
};

export const useCanvasKeyboard = () => {
  const copiedObjects = useRef<CopyableCanvasObject[]>([]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isEditableTarget(event.target)) return;

      const {
        shapes,
        memos,
        images,
        strokes,
        selectedIds,
        addImage,
        addMemo,
        addShape,
        removeImage,
        removeMemo,
        removeShape,
        removeStroke,
        setSelectedIds,
      } = useCanvasStore.getState();

      if (event.key === 'Delete' || event.key === 'Backspace') {
        if (selectedIds.some(isLockedObject)) return;

        selectedIds.forEach((id) => {
          if (shapes.some((shape) => shape.id === id)) removeShape(id);
          if (memos.some((memo) => memo.id === id)) removeMemo(id);
          if (images.some((image) => image.id === id)) removeImage(id);
          if (strokes.some((stroke) => stroke.id === id)) removeStroke(id);
        });
        setSelectedIds([]);
      }

      if ((event.ctrlKey || event.metaKey) && event.key === 'c') {
        const objectsToCopy = [
          ...shapes.filter((shape) => selectedIds.includes(shape.id)),
          ...memos.filter((memo) => selectedIds.includes(memo.id)),
          ...images.filter((image) => selectedIds.includes(image.id)),
        ];

        if (objectsToCopy.length > 0) {
          copiedObjects.current = objectsToCopy;
        }
      }

      if ((event.ctrlKey || event.metaKey) && event.key === 'v' && copiedObjects.current.length > 0) {
        const newIds: string[] = [];

        copiedObjects.current.forEach((object) => {
          const newId = crypto.randomUUID();
          const offset = { x: object.x + 20, y: object.y + 20 };

          if ('src' in object) {
            addImage({ ...object, ...offset, id: newId });
          } else if ('content' in object) {
            addMemo({ ...object, ...offset, id: newId });
          } else {
            addShape({ ...object, ...offset, id: newId });
          }

          newIds.push(newId);
        });

        setSelectedIds(newIds);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);
};
