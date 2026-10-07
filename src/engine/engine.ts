// Theme-agnostic core lifecycle: mounts listeners and runs the frame loop.
// Plain functions over an EngineState object (state.ts); useEngine.ts keeps that state in a ref and wires it to React.
// What grows and how it looks lives in the theme (see src/themes).
import { INPUT_SENTINEL } from "./config.ts";
import { syncClock } from "./clock.ts";
import { applyInputChange, handleKeyDown, releasePointer, syncToVisualViewport } from "./input.ts";
import { resize } from "./layout.ts";
import { buildPoster, drawPosterFrame } from "./poster.ts";
import { paintLiveView } from "./render.ts";
import { remeasureWhenFontLoads } from "./settings.ts";
import type { EngineState } from "./state.ts";

// ---------- lifecycle ----------
export function mount(
  state: EngineState,
  canvas: HTMLCanvasElement,
  hiddenInput: HTMLInputElement,
) {
  state.canvas = canvas;
  state.hiddenInput = hiddenInput;
  state.context = canvas.getContext("2d")!;
  const listen = <K extends keyof WindowEventMap>(
    type: K,
    handler: (e: WindowEventMap[K]) => void,
    capture = false,
  ) => {
    window.addEventListener(type, handler, capture);
    return () => window.removeEventListener(type, handler, capture);
  };
  const unlisten = [
    listen("resize", () => resize(state)),
    listen("keydown", (e) => handleKeyDown(state, e)),
    listen("pointermove", (e) => {
      state.pointerX = e.clientX;
      state.pointerY = e.clientY;
    }),
    listen(
      "pointerdown",
      (e) => {
        state.lastPointerType = e.pointerType || "mouse";
      },
      true,
    ),
    listen("pointerup", (e) => releasePointer(state, e)),
    listen("pointercancel", (e) => releasePointer(state, e)),
  ];
  const onPointerLeave = () => {
    state.pointerX = null;
  };
  document.addEventListener("pointerleave", onPointerLeave);
  // ---------- phone ----------
  state.isTouchDevice = !!matchMedia("(pointer: coarse)").matches;
  if (state.isTouchDevice)
    document.documentElement.setAttribute("data-touch", "");
  hiddenInput.value = INPUT_SENTINEL;
  state.mirroredInputValue = INPUT_SENTINEL;
  const onCompositionStart = () => {
    state.isComposing = true;
  };
  const onCompositionEnd = () => {
    state.isComposing = false;
    setTimeout(() => {
      if (!state.isComposing) applyInputChange(state, hiddenInput);
    }, 0);
  };
  hiddenInput.addEventListener("compositionstart", onCompositionStart);
  hiddenInput.addEventListener("compositionend", onCompositionEnd);
  state.visualViewport = window.visualViewport || null;
  const onViewportChange = () => syncToVisualViewport(state);
  if (state.visualViewport && state.isTouchDevice) {
    state.visualViewport.addEventListener("resize", onViewportChange);
    state.visualViewport.addEventListener("scroll", onViewportChange);
    syncToVisualViewport(state);
  }
  resize(state);
  remeasureWhenFontLoads(state);
  buildPoster(state);
  const loop = () => {
    state.animationFrame = requestAnimationFrame(loop);
    tick(state);
  };
  loop();
  if (!state.isTouchDevice)
    setTimeout(() => hiddenInput.focus({ preventScroll: true }), 50);
  return () => {
    cancelAnimationFrame(state.animationFrame);
    unlisten.forEach((stop) => stop());
    document.removeEventListener("pointerleave", onPointerLeave);
    hiddenInput.removeEventListener("compositionstart", onCompositionStart);
    hiddenInput.removeEventListener("compositionend", onCompositionEnd);
    if (state.visualViewport) {
      state.visualViewport.removeEventListener("resize", onViewportChange);
      state.visualViewport.removeEventListener("scroll", onViewportChange);
    }
  };
}
export function tick(state: EngineState) {
  const now = performance.now(),
    dt = Math.min(64, now - (state.lastFrameAt || now));
  state.lastFrameAt = now;
  if (state.mode === "poster") {
    if (state.posterCanvas && !state.isExporting)
      drawPosterFrame(
        state,
        state.posterCanvas.getContext("2d")!,
        now - state.posterStartedAt,
      );
    return;
  }
  if (state.mode === "clock") syncClock(state, now);
  const ease = 1 - Math.exp(-dt / 80);
  state.fontSize += (state.targetFontSize - state.fontSize) * ease;
  state.caretX += (state.targetCaretX - state.caretX) * ease;
  state.caretY += (state.targetCaretY - state.caretY) * ease;
  for (const l of state.letters)
    if (!l.diedAt) {
      l.x += (l.targetX - l.x) * ease;
      l.y += (l.targetY - l.y) * ease;
    }
  state.letters = state.letters.filter(
    (l) => !(l.diedAt && now - l.diedAt > 300),
  );
  paintLiveView(state, now, state.mode === "type");
}
