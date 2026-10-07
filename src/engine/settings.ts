// Settings changes coming from the UI: theme, font, mode, poster options.
import { cssFont, type Font, type Mode } from "./config.ts";
import { regrowLiveLetters } from "./letters.ts";
import { relayout, resize } from "./layout.ts";
import { buildPoster } from "./poster.ts";
import type { EngineState } from "./state.ts";
import type { Theme } from "./types.ts";

// ---------- settings ----------
export function setTheme(state: EngineState, theme: Theme) {
  state.theme = theme;
  state.paletteIndex = 0;
  state.pointerTiltById = {};
  regrowLiveLetters(state);
  relayout(state); // themes can change the type size
  buildPoster(state);
}
export function setFont(state: EngineState, font: Font) {
  state.font = font;
  onGlyphsChanged(state);
  remeasureWhenFontLoads(state);
}
// glyph widths (and shapes) change once the webfont actually arrives: measure again
export function remeasureWhenFontLoads(state: EngineState) {
  const font = state.font;
  document.fonts
    ?.load(cssFont(font, 100))
    .then(() => {
      if (state.font === font) onGlyphsChanged(state);
    })
    .catch(() => {});
}
export function onGlyphsChanged(state: EngineState) {
  state.glyphWidthCache = {};
  state.glyphInteriorCache = {};
  if (state.theme.replacesGlyphs) regrowLiveLetters(state); // its ornaments trace the old letter shapes
  relayout(state);
  buildPoster(state);
}
export function setMode(state: EngineState, mode: Mode) {
  state.mode = mode;
  if (mode === "type")
    requestAnimationFrame(() => {
      resize(state);
      state.hiddenInput.focus({ preventScroll: true });
    });
}
export function updatePoster(
  state: EngineState,
  changes: { preset?: string; posterText?: string; seed?: number },
) {
  Object.assign(state, changes);
  buildPoster(state);
}
