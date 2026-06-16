import Canvas from "@component/canvas/canvas"
import Toolbar from "@component/toolbar/toolbar"
import OverlayLayer from "@component/canvas/OverlayLayer"
import CanvasUtilityPanel from "@component/canvas/CanvasUtilityPanel"
import type { SaveStatus } from "@/app/types/saveStatus"

interface CanvasLayoutProps {
  saveStatus?: SaveStatus
}

export default function CanvasLayout({ saveStatus = "saved" }: CanvasLayoutProps) {
  return (
    <>
      <Canvas />
      <OverlayLayer saveStatus={saveStatus} />
      <CanvasUtilityPanel />
      <Toolbar />
    </>
  )
}
