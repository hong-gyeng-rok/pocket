"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

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
      content: { strokes: [], memos: [], images: [] }, // 초기 빈 데이터 구조 명시
      title: null,
    },
  });

  revalidatePath("/");
  return newCanvas;
}

export async function getCanvas(id: string) {
  const session = await auth();
  if (!session?.user?.email) return null;

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
  });

  if (!user) return null;

  const canvas = await prisma.canvas.findUnique({
    where: { id },
  });

  // 본인 캔버스인지 확인
  if (!canvas || canvas.userId !== user.id) {
    return null;
  }

  return canvas;
}

export async function saveCanvas(id: string, content: any, title?: string) {
  const session = await auth();
  if (!session?.user?.email) throw new Error("Unauthorized");

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
  });
  
  if (!user) throw new Error("User not found");

  // 소유권 확인은 where 절에 userId를 포함시켜서 한 번에 처리 가능 (updateMany는 id+userId 조건 가능, update는 unique id만 가능하므로 findFirst로 확인 후 업데이트하거나, 그냥 업데이트 시도하고 catch)
  // Prisma update는 unique 키로만 가능. 안전하게 count로 확인하거나 findUnique 후 처리.
  const existing = await prisma.canvas.findUnique({
    where: { id },
  });

  if (!existing || existing.userId !== user.id) {
    throw new Error("Canvas not found or access denied");
  }

  await prisma.canvas.update({
    where: { id },
    data: {
      content,
      ...(title !== undefined && { title }),
    },
  });

  if (title !== undefined) {
    revalidatePath("/"); // 제목이 바뀌었을 때만 목록 갱신
  }
  revalidatePath(`/canvas/${id}`);
}
