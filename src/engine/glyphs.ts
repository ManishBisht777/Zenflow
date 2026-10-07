// Glyph measurement: widths and sampled interior points per character, cached per font.
import { cssFont } from "./config.ts";
import type { EngineState } from "./state.ts";
import type { Point } from "./types.ts";

// width of a character at font size 1
export function glyphWidth(state: EngineState, char: string) {
  if (state.glyphWidthCache[char] != null) return state.glyphWidthCache[char];
  state.context.font = cssFont(state.font, 100);
  let width = state.context.measureText(char).width / 100;
  if (char === " ") width *= 1.4;
  return (state.glyphWidthCache[char] = width);
}
// Points inside a character's shape, in type units (baseline centre = 0,0), on a grid ~0.02 apart.
// Themes that build letters out of ornaments (replacesGlyphs) place them on these.
// `thicken` (type units) widens thin strokes, e.g. so flowers have room along a script font's hairlines.
export function glyphInterior(state: EngineState, char: string, thicken = 0) {
  const key = `${state.font.id}:${char}:${thicken}`;
  if (state.glyphInteriorCache[key]) return state.glyphInteriorCache[key];
  const size = 160,
    originX = size * 1.5,
    baseline = size * 1.4,
    step = 3;
  const canvas =
    state.glyphSamplingCanvas ||
    (state.glyphSamplingCanvas = document.createElement("canvas"));
  canvas.width = size * 3;
  canvas.height = size * 2;
  const context = canvas.getContext("2d", { willReadFrequently: true })!;
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.font = cssFont(state.font, size);
  context.textAlign = "center";
  context.textBaseline = "alphabetic";
  context.fillStyle = "#000";
  context.fillText(char, originX, baseline);
  if (thicken > 0) {
    context.lineWidth = thicken * size;
    context.lineJoin = "round";
    context.strokeStyle = "#000";
    context.strokeText(char, originX, baseline);
  }
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data,
    inside: Point[] = [];
  for (let y = 0; y < canvas.height; y += step)
    for (let x = 0; x < canvas.width; x += step) {
      if (pixels[(y * canvas.width + x) * 4 + 3] > 128)
        inside.push([(x - originX) / size, (y - baseline) / size]);
    }
  return (state.glyphInteriorCache[key] = inside);
}
