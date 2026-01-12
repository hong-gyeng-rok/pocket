import { getCanvas } from "@/app/actions/canvas";
import CanvasInitializer from "@/app/component/canvas/CanvasInitializer";
import { redirect } from "next/navigation";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function CanvasPage({ params }: PageProps) {
  const { id } = await params;
  const canvas = await getCanvas(id);

  if (!canvas) {
    redirect("/"); // 없거나 권한 없으면 홈으로
  }

  return (
    <CanvasInitializer 
      canvasId={canvas.id} 
      initialContent={canvas.content}
      title={canvas.title}
    />
  );
}
