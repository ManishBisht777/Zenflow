// Saving: video of the poster loop.
import { exportVideo as recordVideo } from "./export.ts";
import { POSTER_WIDTH, POSTER_HEIGHT } from "./config.ts";
import { buildPoster, drawPosterFrame } from "./poster.ts";
import type { EngineState } from "./state.ts";

// ---------- export ----------
export function exportFileName(state: EngineState) {
  return (
    `${state.theme.id}-` +
    (state.posterText || "loop")
      .trim()
      .replace(/[^a-z0-9]+/gi, "-")
      .toLowerCase()
      .slice(0, 24) +
    "-" +
    state.preset
  );
}
export function reportStatus(
  state: EngineState,
  status: string,
  isExporting = state.isExporting,
) {
  state.isExporting = isExporting;
  state.onStatus(status, isExporting);
}
export async function exportImage(
  state: EngineState,
  width: number,
  height: number,
) {
  if (!state.poster || state.isExporting) return;
  const safeWidth = Math.max(1, Math.min(4096, Math.round(width)));
  const safeHeight = Math.max(1, Math.min(4096, Math.round(height)));
  const canvas = document.createElement("canvas");
  canvas.width = safeWidth;
  canvas.height = safeHeight;
  const context = canvas.getContext("2d");
  if (!context) {
    reportStatus(state, "Couldn’t prepare image export.");
    return;
  }
  const previousPoster = state.poster;
  try {
    buildPoster(state, safeWidth, safeHeight);
    drawPosterFrame(state, context, 4000, safeWidth, safeHeight);
  } finally {
    state.poster = previousPoster;
  }
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/png"),
  );
  if (!blob) {
    reportStatus(state, "Couldn’t save PNG.");
    return;
  }
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `${exportFileName(state)}-${safeWidth}x${safeHeight}.png`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 0);
  reportStatus(state, `Saved PNG · ${safeWidth} × ${safeHeight}`);
}
export async function exportVideo(state: EngineState) {
  if (!state.poster || state.isExporting) return;
  if (!state.videoMimeType) {
    reportStatus(
      state,
      "Video export isn’t supported in this browser.",
    );
    return;
  }
  reportStatus(state, "Recording…", true);
  const result = await recordVideo(
    (context, t) => drawPosterFrame(state, context, t),
    state.poster.loopMs,
    POSTER_WIDTH,
    POSTER_HEIGHT,
    state.videoMimeType,
    (percent) => reportStatus(state, `Recording ${percent}%`),
    exportFileName(state),
  );
  reportStatus(
    state,
    `Saved ${result.extension.toUpperCase()} · ${result.frameCount} frames`,
    false,
  );
}
