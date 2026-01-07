// src/app/api/save/route.ts
import { NextResponse } from "next/server";
import { PrismaClient } from "@/generated/client";

const prisma = new PrismaClient();

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { paths } = body; // 화면에서 보낸 선 데이터(JSON)

    // DB에 저장
    const savedCanvas = await prisma.canvas.create({
      data: {
        content: paths, // JSON 타입으로 통째로 저장
      },
    });

    return NextResponse.json({ success: true, id: savedCanvas.id });
  } catch (error) {
    console.error("저장 실패:", error);
    return NextResponse.json({ success: false, error: "저장 실패" }, { status: 500 });
  }
}
