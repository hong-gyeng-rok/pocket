import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

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

    // Update
    await prisma.canvas.update({
      where: { id },
      data: { content },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Save error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
