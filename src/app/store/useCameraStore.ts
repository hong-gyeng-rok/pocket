import { create } from 'zustand';

interface CameraState {
  x: number;
  y: number;
  zoom: number;
  
  // Actions
  setCamera: (x: number, y: number, zoom: number) => void;
  pan: (dx: number, dy: number) => void;
  zoomCamera: (factor: number, centerX: number, centerY: number) => void;
}

export const useCameraStore = create<CameraState>((set, get) => ({
  x: 0,
  y: 0,
  zoom: 1,

  setCamera: (x, y, zoom) => set({ x, y, zoom }),

  pan: (dx, dy) => {
    const { x, y, zoom } = get();
    // dx, dy are screen pixels. 
    // We need to move the camera in World Units.
    // Screen Delta / Zoom = World Delta
    set({ 
      x: x - dx / zoom, 
      y: y - dy / zoom 
    });
  },

  zoomCamera: (factor, centerX, centerY) => {
    const { x, y, zoom } = get();
    
    // Calculate world coordinates of the center point before zoom
    const worldX = x + centerX / zoom;
    const worldY = y + centerY / zoom;

    // Update zoom level
    const newZoom = Math.max(0.1, Math.min(zoom * factor, 10)); // Limit zoom range
    
    // Update camera position to keep the world point at the same screen position
    // NewCameraX = WorldX - ScreenX / NewZoom
    const newX = worldX - centerX / newZoom;
    const newY = worldY - centerY / newZoom;

    set({
      x: newX,
      y: newY,
      zoom: newZoom,
    });
  },
}));
