// Saving: video of the poster loop.
import { exportVideo as recordVideo } from "./export.ts";
import { POSTER_WIDTH, POSTER_HEIGHT } from "./config.ts";
import { drawPosterFrame } from "./poster.ts";
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
