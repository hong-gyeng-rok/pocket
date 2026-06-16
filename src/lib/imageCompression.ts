export interface CompressedImage {
  src: string;
  width: number;
  height: number;
}

const MAX_IMAGE_EDGE = 1600;
const IMAGE_QUALITY = 0.82;

const readBlobAsDataUrl = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => resolve(String(reader.result));
    reader.readAsDataURL(blob);
  });
};

const exportCanvas = async (canvas: HTMLCanvasElement): Promise<string> => {
  const preferredTypes = ['image/webp', 'image/png'];

  for (const type of preferredTypes) {
    const dataUrl = await new Promise<string | null>((resolve) => {
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            resolve(null);
            return;
          }

          readBlobAsDataUrl(blob).then(resolve).catch(() => resolve(null));
        },
        type,
        IMAGE_QUALITY
      );
    });

    if (dataUrl?.startsWith(`data:${type};base64,`)) {
      return dataUrl;
    }
  }

  const fallback = canvas.toDataURL('image/png');
  if (!fallback.startsWith('data:image/png;base64,')) {
    throw new Error('Failed to encode image');
  }

  return fallback;
};

const loadImage = (file: File): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const objectUrl = URL.createObjectURL(file);

    const cleanup = () => URL.revokeObjectURL(objectUrl);
    const fail = () => {
      cleanup();
      reject(new Error('Unsupported image format. Please use PNG, JPEG, WebP, GIF, or AVIF.'));
    };

    image.onerror = fail;
    image.onload = async () => {
      try {
        if (typeof image.decode === 'function') {
          await image.decode();
        }

        resolve(image);
      } catch {
        reject(new Error('Failed to decode image'));
      } finally {
        cleanup();
      }
    };

    image.src = objectUrl;
  });
};

export const compressImageFile = async (file: File): Promise<CompressedImage> => {
  const image = await loadImage(file);
  const scale = Math.min(1, MAX_IMAGE_EDGE / Math.max(image.width, image.height));
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext('2d');
  if (!context) {
    return {
      src: image.src,
      width: image.width,
      height: image.height,
    };
  }

  context.drawImage(image, 0, 0, width, height);

  const compressedSrc = await exportCanvas(canvas);

  return {
    src: compressedSrc,
    width,
    height,
  };
};

export const uploadCanvasImageAsset = async (dataUrl: string): Promise<string> => {
  const response = await fetch('/api/canvas/assets', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ dataUrl }),
  });

  if (!response.ok) {
    throw new Error(`Image asset upload failed with ${response.status}`);
  }

  const payload = await response.json();
  if (!payload || typeof payload.src !== 'string') {
    throw new Error('Image asset upload returned an invalid response');
  }

  return payload.src;
};
