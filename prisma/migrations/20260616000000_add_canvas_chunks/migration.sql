CREATE TABLE "CanvasChunk" (
  "id" TEXT NOT NULL,
  "canvasId" TEXT NOT NULL,
  "chunkKey" TEXT NOT NULL,
  "x" INTEGER NOT NULL,
  "y" INTEGER NOT NULL,
  "content" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "CanvasChunk_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CanvasChunk_canvasId_chunkKey_key" ON "CanvasChunk"("canvasId", "chunkKey");
CREATE INDEX "CanvasChunk_canvasId_x_y_idx" ON "CanvasChunk"("canvasId", "x", "y");

ALTER TABLE "CanvasChunk"
  ADD CONSTRAINT "CanvasChunk_canvasId_fkey"
  FOREIGN KEY ("canvasId") REFERENCES "Canvas"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
