import { useCallback } from 'react';
import { useCameraStore } from '@/app/store/useCameraStore';

// Adapter hook to maintain compatibility with existing components
// while using the global store.
export const useCamera = () => {
  const x = useCameraStore(state => state.x);
  const y = useCameraStore(state => state.y);
  const zoom = useCameraStore(state => state.zoom);
  const pan = useCameraStore(state => state.pan);
  const zoomCamera = useCameraStore(state => state.zoomCamera);

  // We return a ref-like object for compatibility, 
  // but it's actually getting fresh state from the store.
  // Warning: Accessing .current inside render loop will need direct store access
  // to avoid re-renders, but for now we bridge it.
  
  // Actually, for the requestAnimationFrame loop, we should NOT use this hook's return values
  // if they cause re-renders.
  // But let's keep the signature similar for now.
  
  return {
    cameraRef: { current: { x, y, zoom } }, // Mock ref for compatibility
    pan,
    zoomCamera
  };
};
