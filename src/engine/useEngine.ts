// React wiring for the engine: the engine's state lives in a ref (it changes every frame, so it must not trigger
// re-renders), the canvas loop starts in an effect, and the UI gets a stable set of actions.
import { useEffect, useMemo, useRef } from "react";
import type {
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
} from "react";
import type { Font, Mode } from "./config.ts";
import { mount } from "./engine.ts";
import {
  handleClick,
  handlePointerDown,
  applyInputChange,
  refocusTyping,
} from "./input.ts";
import { currentText } from "./letters.ts";
import { currentPreset } from "./poster.ts";
import { exportImage, exportVideo } from "./save.ts";
import { setTheme, setFont, setMode, updatePoster } from "./settings.ts";
import { createEngineState, type EngineState } from "./state.ts";
import type { Theme } from "./types.ts";

export function useEngine(
  initialTheme: Theme,
  onStatus: (status: string, isExporting: boolean) => void,
) {
  const stateRef = useRef<EngineState | null>(null);
  if (!stateRef.current) stateRef.current = createEngineState(initialTheme); // created once, on first render
  const state = stateRef.current;
  state.onStatus = onStatus; // always call the latest handler

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hiddenInputRef = useRef<HTMLInputElement>(null);

  // start the frame loop and listeners once the canvas exists; the returned cleanup stops them
  useEffect(
    () => mount(state, canvasRef.current!, hiddenInputRef.current!),
    [state],
  );

  const actions = useMemo(
    () => ({
      setTheme: (theme: Theme) => setTheme(state, theme),
      setFont: (font: Font) => setFont(state, font),
      setPaletteIndex: (index: number) => {
        state.paletteIndex = index;
      },
      setMode: (mode: Mode) => setMode(state, mode),
      updatePoster: (changes: {
        preset?: string;
        posterText?: string;
        seed?: number;
      }) => updatePoster(state, changes),
      setPosterCanvas: (canvas: HTMLCanvasElement | null) => {
        state.posterCanvas = canvas;
      },
      refocusTyping: () => refocusTyping(state),
      currentText: () => currentText(state),
      currentPreset: () => currentPreset(state),
      applyInputChange: (field: HTMLInputElement) =>
        applyInputChange(state, field),
      handlePointerDown: (e: ReactPointerEvent) => handlePointerDown(state, e),
      handleClick: (e: ReactMouseEvent) => handleClick(state, e),
      exportVideo: () => exportVideo(state),
      exportImage: (width: number, height: number) =>
        exportImage(state, width, height),
    }),
    [state],
  );

  return { state, canvasRef, hiddenInputRef, ...actions };
}
