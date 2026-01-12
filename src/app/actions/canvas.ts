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
