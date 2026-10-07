// Everything the engine knows, in one object. Lives in a React ref (see useEngine.ts); engine functions read and mutate it.
import { FONTS, INPUT_SENTINEL, type Font, type Mode } from "./config.ts";
import { glyphWidth, glyphInterior } from "./glyphs.ts";
import type { GrowContext, Letter, Palette, Point, Theme } from "./types.ts";

export type VisitorState = "flying" | "wandering" | "perched" | "leaving";
export interface Visitor {
  x: number;
  y: number;
  velocityX: number;
  velocityY: number;
  state: VisitorState;
  perchId: number | null;
  homeX: number;
  homeY: number; // where it was called to (used while wandering)
  spawnedAt: number;
  flutterPhase: number;
  size: number;
  seed: number;
  angle: number;
  wingOpen: number;
  exitX: number;
  exitY: number;
}
export interface Perch {
  id: number;
  x: number;
  y: number;
  radius: number;
}
export interface PosterScene {
  letters: Letter[];
  fontSize: number;
  loopMs: number;
  preset: string;
}
// Everything the engine knows. Lives in a React ref (see useEngine.ts); every function below reads and mutates it.
export interface EngineState {
  // ---- settings (mirrored in React state) ----
  theme: Theme;
  font: Font;
  paletteIndex: number;
  mode: Mode;
  preset: string;
  posterText: string;
  seed: number;
  density: number;
  handDrawnJitter: boolean;
  tendrilRecoil: number;
  isExporting: boolean;
  onStatus: (status: string, isExporting: boolean) => void;
  videoMimeType: string | null;
  grow: GrowContext; // what themes see while growing letters (backed by this state)

  // ---- live view ----
  canvas: HTMLCanvasElement;
  context: CanvasRenderingContext2D;
  hiddenInput: HTMLInputElement;
  posterCanvas: HTMLCanvasElement | null;
  width: number;
  height: number;
  pixelRatio: number;
  letters: Letter[];
  nextLetterId: number;
  glyphWidthCache: Record<string, number>;
  glyphInteriorCache: Record<string, Point[]>;
  glyphSamplingCanvas: HTMLCanvasElement | null;
  fontSize: number;
  targetFontSize: number;
  isWrapped: boolean;
  caretX: number;
  caretY: number;
  targetCaretX: number;
  targetCaretY: number;
  startedAt: number;
  lastKeyAt: number;
  random: () => number;
  pointerTiltById: Record<number, Point>;
  pointerX: number | null;
  pointerY: number;
  visitors: Visitor[];
  perches: Perch[];
  isTouchDevice: boolean;
  lastPointerType: string;
  isComposing: boolean;
  mirroredInputValue: string;
  handledByKeydown: boolean;
  visualViewport: VisualViewport | null;
  maxViewportHeight: number;
  viewportWidth: number;
  keyboardWasOpen: boolean;
  animationFrame: number;
  lastFrameAt: number;
  lastVisitorFrameAt: number;
  renderTime: number;
  poster: PosterScene | null;
  posterStartedAt: number;
  clockDecor: Letter[]; // still scenery around the clock
  clockDecorKey: string;
}

export function createEngineState(theme: Theme): EngineState {
  const state: EngineState = {
    theme,
    font: FONTS[0],
    paletteIndex: 0,
    mode: "type",
    preset: "scatter",
    posterText: "Zenflow",
    seed: 7,
    density: 1,
    handDrawnJitter: true,
    tendrilRecoil: 20,
    isExporting: false,
    onStatus: () => {},
    videoMimeType:
      typeof MediaRecorder !== "undefined"
        ? [
            "video/mp4;codecs=avc1.42E01E",
            "video/mp4",
            "video/webm;codecs=vp9",
            "video/webm",
          ].find((m) => MediaRecorder.isTypeSupported(m)) || null
        : null,
    grow: null!,
    canvas: null!,
    context: null!,
    hiddenInput: null!,
    posterCanvas: null, // set by mount()
    width: 0,
    height: 0,
    pixelRatio: 1,
    letters: [],
    nextLetterId: 1,
    glyphWidthCache: {},
    glyphInteriorCache: {},
    glyphSamplingCanvas: null,
    fontSize: 0,
    targetFontSize: 0,
    isWrapped: false,
    caretX: 0,
    caretY: 0,
    targetCaretX: 0,
    targetCaretY: 0,
    startedAt: performance.now(),
    lastKeyAt: 0,
    random: Math.random,
    pointerTiltById: {},
    pointerX: null,
    pointerY: 0,
    visitors: [],
    perches: [],
    isTouchDevice: false,
    lastPointerType: "mouse",
    isComposing: false,
    mirroredInputValue: INPUT_SENTINEL,
    handledByKeydown: false,
    visualViewport: null,
    maxViewportHeight: 0,
    viewportWidth: 0,
    keyboardWasOpen: false,
    animationFrame: 0,
    lastFrameAt: 0,
    lastVisitorFrameAt: 0,
    renderTime: 0,
    poster: null,
    posterStartedAt: 0,
    clockDecor: [],
    clockDecorKey: "",
  };
  state.grow = {
    glyphWidth: (char) => glyphWidth(state, char),
    glyphInterior: (char, thicken) => glyphInterior(state, char, thicken),
    random: () => state.random(), // swapped for a seeded generator while the poster is built
    get density() {
      return state.density;
    },
  };
  return state;
}

export const colorsOf = (state: EngineState): Palette =>
  state.theme.palettes[state.paletteIndex] || state.theme.palettes[0];
