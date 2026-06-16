export interface CompressedImage {
  src: string;
  width: number;
  height: number;
}

const MAX_IMAGE_EDGE = 1600;
const IMAGE_QUALITY = 0.82;

const loadImage = (file: File): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => {
      const image = new Image();
      image.onerror = () => reject(new Error('Failed to decode image'));
      image.onload = () => resolve(image);
      image.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
};

export const compressImageFile = async (file: File): Promise<CompressedImage> => {
  const image = await loadImage(file);
  const ratio = image.width / image.height;
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

  const compressedSrc = canvas.toDataURL('image/webp', IMAGE_QUALITY);

  return {
    src: compressedSrc,
    width,
    height: width / ratio,
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
