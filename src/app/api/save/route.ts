import { NextResponse } from "next/server";

export async function POST(request: Request) {
  await request.text();

  return NextResponse.json(
    {
      error: "Deprecated endpoint. Use /api/canvas/save with { id, content }.",
    },
    { status: 410 }
  );
}
