"use server";

import { auth } from "@/auth";
import {
  chunkCanvasContent,
  createEmptyCanvasContent,
  flattenCanvasChunks,
  isCanvasContentEmpty,
  normalizeCanvasContent,
  toCanvasContent,
  toPrismaJson,
} from "@/app/types/canvas";
import type { CanvasContentChunk } from "@/app/types/canvas";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

type CanvasWithOptionalChunks = {
  id: string;
  title: string | null;
  content: unknown;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
  chunks?: { chunkKey: string; x: number; y: number; content: unknown }[];
};

const isMissingCanvasChunkTableError = (error: unknown) => {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "P2021"
  );
};

export async function getCanvases() {
  const session = await auth();
  if (!session?.user?.email) {
    return [];
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
  });

  if (!user) return [];

  const canvases = await prisma.canvas.findMany({
    where: {
      userId: user.id,
    },
    orderBy: {
      createdAt: "desc",
    },
    select: {
      id: true,
      title: true,
      createdAt: true,
    },
  });

  return canvases;
}

export async function createCanvas() {
  const session = await auth();
  if (!session?.user?.email) {
    throw new Error("Unauthorized");
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
  });

  if (!user) throw new Error("User not found");

  const newCanvas = await prisma.canvas.create({
    data: {
      userId: user.id,
      content: toPrismaJson(createEmptyCanvasContent()),
      title: null,
    },
  });

  revalidatePath("/");
  return newCanvas;
}

const saveCanvasChunks = async (id: string, content: unknown) => {
  const normalizedContent = normalizeCanvasContent(content);
  const chunks = chunkCanvasContent(normalizedContent);

  try {
    await prisma.$transaction([
      prisma.canvas.update({
        where: { id },
        data: { content: toPrismaJson(toCanvasContent(createEmptyCanvasContent())) },
      }),
      prisma.canvasChunk.deleteMany({
        where: { canvasId: id },
      }),
      ...(chunks.length > 0
        ? [
            prisma.canvasChunk.createMany({
              data: chunks.map((chunk) => ({
                canvasId: id,
                chunkKey: chunk.id,
                x: chunk.x,
                y: chunk.y,
                content: toPrismaJson(toCanvasContent(chunk)),
              })),
            }),
          ]
        : []),
    ]);
  } catch (error) {
    if (!isMissingCanvasChunkTableError(error)) throw error;

    await prisma.canvas.update({
      where: { id },
      data: { content: toPrismaJson(normalizedContent) },
    });
  }
};

const getChunkedCanvasContent = (
  fallbackContent: unknown,
  chunks: { chunkKey: string; x: number; y: number; content: unknown }[]
) => {
  if (chunks.length === 0) return normalizeCanvasContent(fallbackContent);

  const normalizedChunks: CanvasContentChunk[] = chunks.map((chunk) => {
    const content = normalizeCanvasContent(chunk.content);

    return {
      id: chunk.chunkKey,
      x: chunk.x,
      y: chunk.y,
      strokes: content.strokes,
      memos: content.memos,
      images: content.images,
      shapes: content.shapes,
    };
  });

  return flattenCanvasChunks(normalizedChunks);
};

export async function importLocalCanvas(content: unknown) {
  const session = await auth();
  if (!session?.user?.email) throw new Error("Unauthorized");

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
  });

  if (!user) throw new Error("User not found");

  const normalizedContent = normalizeCanvasContent(content);
  if (isCanvasContentEmpty(normalizedContent)) {
    return null;
  }

  const canvas = await prisma.canvas.create({
    data: {
      userId: user.id,
      content: toPrismaJson(createEmptyCanvasContent()),
      title: "Imported local canvas",
    },
  });

  await saveCanvasChunks(canvas.id, normalizedContent);
  revalidatePath("/");

  return { id: canvas.id };
}

export async function getCanvas(id: string) {
  const session = await auth();
  if (!session?.user?.email) return null;

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
  });

  if (!user) return null;

  let canvas: CanvasWithOptionalChunks | null;

  try {
    canvas = await prisma.canvas.findUnique({
      where: { id },
      include: {
        chunks: {
          orderBy: [{ x: "asc" }, { y: "asc" }],
        },
      },
    });
  } catch (error) {
    if (!isMissingCanvasChunkTableError(error)) throw error;

    canvas = await prisma.canvas.findUnique({
      where: { id },
    });
  }

  // 본인 캔버스인지 확인
  if (!canvas || canvas.userId !== user.id) {
    return null;
  }

  return {
    ...canvas,
    content: Array.isArray(canvas.chunks)
      ? getChunkedCanvasContent(canvas.content, canvas.chunks)
      : normalizeCanvasContent(canvas.content),
  };
}

export async function saveCanvas(id: string, content: unknown, title?: string) {
  const session = await auth();
  if (!session?.user?.email) throw new Error("Unauthorized");

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
  });
  
  if (!user) throw new Error("User not found");

  const existing = await prisma.canvas.findUnique({
    where: { id },
  });

  if (!existing || existing.userId !== user.id) {
    throw new Error("Canvas not found or access denied");
  }

  await saveCanvasChunks(id, content);

  if (title !== undefined) {
    await prisma.canvas.update({
      where: { id },
      data: { title },
    });
  }

  if (title !== undefined) {
    revalidatePath("/"); 
  }
  revalidatePath(`/canvas/${id}`);
}

export async function renameCanvas(id: string, title: string) {
  const session = await auth();
  if (!session?.user?.email) throw new Error("Unauthorized");

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
  });

  if (!user) throw new Error("User not found");

  const canvas = await prisma.canvas.findUnique({ where: { id } });
  if (!canvas || canvas.userId !== user.id) throw new Error("Forbidden");

  await prisma.canvas.update({
    where: { id },
    data: { title },
  });

  revalidatePath("/");
  revalidatePath(`/canvas/${id}`);
}

export async function deleteCanvas(id: string) {
  const session = await auth();
  if (!session?.user?.email) throw new Error("Unauthorized");

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
  });

  if (!user) throw new Error("User not found");

  const canvas = await prisma.canvas.findUnique({ where: { id } });
  if (!canvas || canvas.userId !== user.id) throw new Error("Forbidden");

  await prisma.canvas.delete({
    where: { id },
  });

  revalidatePath("/");
}
