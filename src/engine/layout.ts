// Layout: canvas size, font size, line wrapping and letter positions.
import { glyphWidth } from "./glyphs.ts";
import type { EngineState } from "./state.ts";
import type { Letter } from "./types.ts";

// ---------- layout ----------
export function resize(state: EngineState) {
  const rect = state.canvas.getBoundingClientRect(),
    ratio = window.devicePixelRatio || 1;
  if (!rect.width) return;
  state.width = rect.width;
  state.height = rect.height;
  state.pixelRatio = ratio;
  state.canvas.width = Math.round(rect.width * ratio);
  state.canvas.height = Math.round(rect.height * ratio);
  relayout(state, true);
}
// Picks a font size and sets targetX/targetY/width on every letter; keeps headroom for growth above and below.
export function layoutLetters(
  state: EngineState,
  letters: Letter[],
  areaWidth: number,
  areaHeight: number,
  wasWrapped: boolean,
) {
  const maxLineWidth = areaWidth * 0.8,
    largestFontSize = areaHeight * 0.28 * (state.theme.typeScale ?? 1),
    lineHeight = 2.1;
  const widths = letters.map((l) => glyphWidth(state, l.char) * (l.scale ?? 1));
  const words: { isSpace?: boolean; indices: number[] }[] = [];
  let word: { indices: number[] } | null = null;
  letters.forEach((letter, i) => {
    if (letter.char === " ") {
      if (word) {
        words.push(word);
        word = null;
      }
      words.push({ isSpace: true, indices: [i] });
    } else {
      if (!word) word = { indices: [] };
      word.indices.push(i);
    }
  });
  if (word) words.push(word);
  const measureLine = (line: number[], fontSize: number) => {
    let end = line.length;
    while (end > 0 && letters[line[end - 1]].char === " ") end--; // trailing spaces don't count
    let total = 0;
    for (let k = 0; k < end; k++) total += widths[line[k]];
    return total * fontSize;
  };
  const wrapIntoLines = (fontSize: number) => {
    const lines: number[][] = [[]];
    let lineWidth = 0;
    for (const w of words) {
      const wordWidth =
        w.indices.reduce((sum, i) => sum + widths[i], 0) * fontSize;
      if (!w.isSpace && lineWidth > 0 && lineWidth + wordWidth > maxLineWidth) {
        lines.push([]);
        lineWidth = 0;
      }
      lines[lines.length - 1].push(...w.indices);
      lineWidth += wordWidth;
    }
    return lines;
  };
  let lines = [letters.map((_, i) => i)];
  const widthAtSize1 = measureLine(lines[0], 1);
  let fontSize =
    widthAtSize1 > 0
      ? Math.min(largestFontSize, maxLineWidth / widthAtSize1)
      : largestFontSize;
  const hasSeveralWords = words.filter((w) => !w.isSpace).length > 1;
  // wrap once a single line gets too small (with hysteresis so it doesn't flicker between the two)
  let isWrapped =
    hasSeveralWords &&
    (fontSize < areaHeight * 0.1 ||
      (wasWrapped && fontSize < areaHeight * 0.14));
  if (isWrapped) {
    // binary-search the largest size where every line fits and the block fits the height
    let low = areaHeight * 0.03,
      high = areaHeight * 0.15;
    for (let k = 0; k < 22; k++) {
      const mid = (low + high) / 2,
        candidate = wrapIntoLines(mid);
      const fits =
        candidate.every((line) => measureLine(line, mid) <= maxLineWidth) &&
        candidate.length * lineHeight * mid <= areaHeight * 0.82;
      if (fits) low = mid;
      else high = mid;
    }
    fontSize = low;
    lines = wrapIntoLines(fontSize);
    if (lines.length < 2) isWrapped = false;
  }
  const lineCount = lines.length,
    lineStep = lineHeight * fontSize;
  lines.forEach((line, row) => {
    let x = areaWidth / 2 - measureLine(line, fontSize) / 2;
    const baseline =
      areaHeight / 2 + (row - (lineCount - 1) / 2) * lineStep + 0.33 * fontSize;
    line.forEach((i) => {
      const letter = letters[i],
        width = widths[i] * fontSize;
      letter.targetX = x + width / 2;
      letter.targetY = baseline;
      letter.width = width;
      x += width;
    });
  });
  return { fontSize, isWrapped };
}
// snapToTarget: jump instead of easing (resize, first layout)
export function relayout(state: EngineState, snapToTarget = false) {
  if (!state.width) return;
  const alive = state.letters.filter((l) => !l.diedAt);
  const result = layoutLetters(
    state,
    alive,
    state.width,
    state.height,
    state.isWrapped,
  );
  state.isWrapped = result.isWrapped;
  alive.forEach((l) => {
    if (!l.hasPosition) {
      l.hasPosition = true;
      l.x = l.targetX;
      l.y = l.targetY;
    }
  });
  const fontSize = result.fontSize,
    last = alive[alive.length - 1];
  state.targetFontSize = fontSize;
  state.targetCaretX = last
    ? last.targetX + last.width / 2 + 0.07 * fontSize
    : state.width / 2;
  state.targetCaretY = last ? last.targetY - 0.33 * fontSize : state.height / 2;
  if (snapToTarget || !state.fontSize) {
    state.fontSize = fontSize;
    state.caretX = state.targetCaretX;
    state.caretY = state.targetCaretY;
    alive.forEach((l) => {
      l.x = l.targetX;
      l.y = l.targetY;
    });
  }
}
