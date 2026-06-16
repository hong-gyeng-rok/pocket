import { NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  chunkCanvasContent,
  createEmptyCanvasContent,
  normalizeCanvasContent,
  toCanvasContent,
  toPrismaJson,
} from "@/app/types/canvas";
import { prisma } from "@/lib/prisma";

const isMissingCanvasChunkTableError = (error: unknown) => {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "P2021"
  );
};

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id, content } = await request.json();

    if (!id || !content) {
      return NextResponse.json({ error: "Missing data" }, { status: 400 });
    }

    // Check ownership
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const canvas = await prisma.canvas.findUnique({
        where: { id },
        select: { userId: true }
    });

    if (!canvas || canvas.userId !== user.id) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

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

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Save error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
