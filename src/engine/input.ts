// Input: keyboard, the hidden text field (phone keyboards), pointer and the phone's visible area.
import type {
  PointerEvent as ReactPointerEvent,
  MouseEvent as ReactMouseEvent,
} from "react";
import { INPUT_SENTINEL } from "./config.ts";
import { addCharacter, witherLastLetter } from "./letters.ts";
import { relayout, resize } from "./layout.ts";
import { callVisitor } from "./visitors.ts";
import type { EngineState } from "./state.ts";

// ---------- keyboard ----------
export function handleKeyDown(state: EngineState, e: KeyboardEvent) {
  if (state.mode !== "type") return;
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const target = e.target as HTMLElement | null;
  if (target?.closest('[role="dialog"]')) return; // settings modal is open
  if (
    target &&
    target.tagName === "BUTTON" &&
    (e.key === "Enter" || e.key === " ")
  )
    return;
  const now = performance.now();
  if (e.key === "Backspace") {
    e.preventDefault();
    markKeyHandled(state);
    witherLastLetter(state, now);
    return;
  }
  if (e.key === "Enter") {
    e.preventDefault();
    markKeyHandled(state);
    state.letters = [];
    relayout(state);
    return;
  }
  if (e.key.length !== 1) return;
  e.preventDefault();
  markKeyHandled(state);
  addCharacter(state, e.key, now);
}
// the same keystroke may also reach the hidden field; ignore that echo for this tick
export function markKeyHandled(state: EngineState) {
  state.lastKeyAt = performance.now();
  state.handledByKeydown = true;
  setTimeout(() => {
    state.handledByKeydown = false;
  }, 0);
}
// phone keyboards often skip real key events and write into the field instead, rewriting whole words while
// they predict: mirror the field and apply the difference, new letters grow and removed ones wither
export function applyInputChange(state: EngineState, field: HTMLInputElement) {
  if (state.mode !== "type" || state.handledByKeydown) {
    state.mirroredInputValue = state.isComposing ? field.value : INPUT_SENTINEL;
    if (!state.isComposing) field.value = INPUT_SENTINEL;
    return;
  }
  const before = state.mirroredInputValue,
    after = field.value;
  let common = 0;
  while (
    common < before.length &&
    common < after.length &&
    before[common] === after[common]
  )
    common++;
  let deleted = before.length - common;
  if (common === 0 && before[0] === INPUT_SENTINEL && before.length > 1)
    deleted -= 1; // the sentinel is not a letter
  const now = performance.now();
  state.lastKeyAt = now;
  for (let i = 0; i < deleted; i++) witherLastLetter(state, now);
  for (const char of after.slice(common)) {
    if (char === INPUT_SENTINEL) continue;
    if (char.charCodeAt(0) === 10) {
      state.letters = [];
      relayout(state);
    } else addCharacter(state, char, now);
  }
  if (state.isComposing) state.mirroredInputValue = after;
  else {
    field.value = INPUT_SENTINEL;
    state.mirroredInputValue = INPUT_SENTINEL;
  }
}
export function refocusTyping(state: EngineState) {
  if (state.lastPointerType === "mouse" && state.mode === "type")
    state.hiddenInput.focus({ preventScroll: true });
}
// ---------- pointer (wired from React) ----------
export function handlePointerDown(state: EngineState, e: ReactPointerEvent) {
  if (state.mode === "poster") return;
  const isTouch = e.pointerType && e.pointerType !== "mouse",
    onCanvas = e.target === state.canvas;
  if (state.mode === "clock") {
    if (onCanvas) callVisitor(state, e.clientX, e.clientY); // nothing to type into
    return;
  }
  // touch: leave focus (and the keyboard) where it is while tapping; the tap's click opens the keyboard
  if (isTouch) {
    if (
      e.cancelable &&
      (onCanvas || (e.target as HTMLElement).closest("button"))
    )
      e.preventDefault();
  } else state.hiddenInput.focus({ preventScroll: true });
  if (onCanvas) callVisitor(state, e.clientX, e.clientY);
}
export function handleClick(state: EngineState, e: ReactMouseEvent) {
  if (
    state.mode === "type" &&
    state.lastPointerType !== "mouse" &&
    e.target === state.canvas
  )
    state.hiddenInput.focus({ preventScroll: true });
}
// growth relaxes when the finger lifts
export function releasePointer(state: EngineState, e: PointerEvent) {
  if (e.pointerType && e.pointerType !== "mouse") state.pointerX = null;
}
// ---------- phone: keyboard + visible area ----------
export function syncToVisualViewport(state: EngineState) {
  const viewport = state.visualViewport;
  if (!viewport) return;
  const width = Math.round(viewport.width);
  if (state.viewportWidth !== width) {
    state.viewportWidth = width;
    state.maxViewportHeight = 0;
  } // rotated: measure again
  state.maxViewportHeight = Math.max(state.maxViewportHeight, viewport.height);
  const keyboardOpen = state.maxViewportHeight - viewport.height > 120,
    root = document.documentElement;
  root.style.setProperty("--tg-top", viewport.offsetTop + "px");
  root.style.setProperty("--tg-h", viewport.height + "px");
  if (keyboardOpen) root.setAttribute("data-kb", "");
  else root.removeAttribute("data-kb");
  // keyboard put away while the field kept focus (Android back gesture): let go, so the next tap brings it back
  if (
    !keyboardOpen &&
    state.keyboardWasOpen &&
    document.activeElement === state.hiddenInput
  )
    state.hiddenInput.blur();
  state.keyboardWasOpen = keyboardOpen;
  resize(state);
}
