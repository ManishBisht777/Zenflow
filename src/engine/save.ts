// Saving: PNG/SVG of the live view, video/frames of the poster loop.
import { traceSmoothPath, type PathSink } from "./kit.ts";
import {
  exportVideo as recordVideo,
  exportFrames as renderFramesZip,
  download,
} from "./export.ts";
import { POSTER_SIZE } from "./config.ts";
import { drawPosterFrame } from "./poster.ts";
import { liveSceneState, paintLiveView, renderScene } from "./render.ts";
import { colorsOf, type EngineState } from "./state.ts";
import type { Painter } from "./types.ts";

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
export function savePNG(state: EngineState) {
  paintLiveView(state, performance.now(), false);
  state.canvas.toBlob(
    (blob) => blob && download(blob, `${state.theme.id}.png`),
  );
}
// ponytail: letters export as <text> (font must be installed to view); outline glyphs via opentype.js if needed
export function saveSVG(state: EngineState) {
  const parts: string[] = [],
    round = (v: number) => Math.round(v * 100) / 100;
  const pathData = (): PathSink & { d: string } => ({
    d: "",
    moveTo(x, y) {
      this.d += `M${round(x)} ${round(y)}`;
    },
    lineTo(x, y) {
      this.d += `L${round(x)} ${round(y)}`;
    },
    quadraticCurveTo(cx, cy, x, y) {
      this.d += `Q${round(cx)} ${round(cy)} ${round(x)} ${round(y)}`;
    },
    closePath() {
      this.d += "Z";
    },
  });
  const escapeXml = (s: string) =>
    s
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  const svgPainter: Painter = {
    fill: (points, color) => {
      const p = pathData();
      traceSmoothPath(p, points, true);
      parts.push(`<path d="${p.d}" fill="${color}"/>`);
    },
    stroke: (points, color, width) => {
      const p = pathData();
      traceSmoothPath(p, points, false);
      parts.push(
        `<path d="${p.d}" fill="none" stroke="${color}" stroke-width="${round(width)}" stroke-linecap="round" stroke-linejoin="round"/>`,
      );
    },
    fillRect: () => {},
    drawGlyph: (char, x, y, fontSize, color) => {
      parts.push(
        `<text x="${round(x)}" y="${round(y)}" text-anchor="middle" font-family="${escapeXml(state.font.family)}" font-weight="${state.font.weight}" font-size="${round(fontSize)}" fill="${color}">${escapeXml(char)}</text>`,
      );
    },
  };
  renderScene(state, svgPainter, performance.now(), liveSceneState(state));
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${round(state.width)}" height="${round(state.height)}" viewBox="0 0 ${round(state.width)} ${round(state.height)}"><rect width="100%" height="100%" fill="${colorsOf(state).background}"/>${parts.join("")}</svg>`;
  download(new Blob([svg], { type: "image/svg+xml" }), `${state.theme.id}.svg`);
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
      "Video export isn’t supported in this browser — use PNG frames.",
    );
    return;
  }
  reportStatus(state, "Recording…", true);
  const result = await recordVideo(
    (context, t) => drawPosterFrame(state, context, t),
    state.poster.loopMs,
    POSTER_SIZE,
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
export async function exportFrames(state: EngineState) {
  if (!state.poster || state.isExporting) return;
  reportStatus(state, "Rendering frames…", true);
  const frameCount = await renderFramesZip(
    (context, t) => drawPosterFrame(state, context, t),
    state.poster.loopMs,
    POSTER_SIZE,
    (percent) => reportStatus(state, `Rendering ${percent}%`),
    exportFileName(state),
  );
  reportStatus(state, `Saved ${frameCount} PNG frames · 30 fps`, false);
}
