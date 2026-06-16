import { createHash } from 'crypto';
import { mkdir, writeFile } from 'fs/promises';
import path from 'path';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

const ASSET_DIR = path.join(process.cwd(), 'public', 'uploads', 'canvas-assets');
const DATA_URL_PATTERN = /^data:(image\/(?:png|jpe?g|webp|gif|avif));base64,([a-z0-9+/=\s]+)$/i;
const EXTENSIONS: Record<string, string> = {
  'image/avif': 'avif',
  'image/gif': 'gif',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const dataUrl = typeof body?.dataUrl === 'string' ? body.dataUrl : '';
    const match = dataUrl.match(DATA_URL_PATTERN);

    if (!match) {
      return NextResponse.json({ error: 'Invalid image payload' }, { status: 400 });
    }

    const [, mimeType, base64] = match;
    const bytes = Buffer.from(base64.replace(/\s/g, ''), 'base64');
    const extension = EXTENSIONS[mimeType] ?? 'webp';
    const hash = createHash('sha256').update(bytes).digest('hex').slice(0, 24);
    const filename = `${hash}.${extension}`;

    await mkdir(ASSET_DIR, { recursive: true });
    await writeFile(path.join(ASSET_DIR, filename), bytes, { flag: 'wx' }).catch((error: NodeJS.ErrnoException) => {
      if (error.code !== 'EEXIST') throw error;
    });

    return NextResponse.json({ src: `/uploads/canvas-assets/${filename}` });
  } catch (error) {
    console.error('Canvas image asset upload failed:', error);
    return NextResponse.json({ error: 'Failed to store image asset' }, { status: 500 });
  }
}
