import Canvas from "@component/canvas/canvas"
import Toolbar from "@component/toolbar/toolbar"
import OverlayLayer from "@component/canvas/OverlayLayer"

export default function CanvasLayout() {
  return (
    <>
      <Canvas />
      <OverlayLayer />
      <Toolbar />
    </>
  )
}
