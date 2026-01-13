// src/app/api/save/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { paths } = body; // 화면에서 보낸 선 데이터(JSON)

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // DB에 저장
    const savedCanvas = await prisma.canvas.create({
      data: {
        content: paths, // JSON 타입으로 통째로 저장
        userId: user.id,
      },
    });

    return NextResponse.json({ success: true, id: savedCanvas.id });
  } catch (error) {
    console.error("저장 실패:", error);
    return NextResponse.json({ success: false, error: "저장 실패" }, { status: 500 });
  }
}
