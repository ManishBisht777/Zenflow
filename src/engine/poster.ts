// Poster (export) mode: a seeded, 4:5, looping scene; each preset changes letter timing.
import { seededRandom } from "./kit.ts";
import { PRESETS, POSTER_WIDTH, POSTER_HEIGHT } from "./config.ts";
import { createLetter, growLetter } from "./letters.ts";
import { layoutLetters } from "./layout.ts";
import { canvasPainter, renderScene, type SceneState } from "./render.ts";
import { colorsOf, type EngineState } from "./state.ts";
import type { Letter } from "./types.ts";

// ---------- poster ----------
export function currentPreset(state: EngineState) {
  return PRESETS.find((p) => p.id === state.preset) || PRESETS[0];
}
// Builds a separate, seeded set of letters for the poster and fits the whole scene into it.
export function buildPoster(state: EngineState) {
  if (!state.context) return;
  const preset = currentPreset(state),
    text = (state.posterText || "").slice(0, 40) || " ";
  state.random = seededRandom(state.seed * 7919 + 1);
  const letters: Letter[] = [];
  let previous: Letter | null = null,
    nextId = 1;
  for (const char of text) {
    if (char === " ") {
      const space = createLetter(" ", 9000 + nextId++, 0);
      letters.push(space);
      previous = space;
      continue;
    }
    const sameWord = !!previous && previous.char !== " ";
    const letter = createLetter(char, 9000 + nextId++, 0, {
      wordSeed: sameWord
        ? previous!.wordSeed
        : Math.floor(state.random() * 1e9),
      indexInWord: sameWord ? previous!.indexInWord + 1 : 0,
      previousInWord: sameWord ? previous : null,
    });
    growLetter(state, letter);
    letters.push(letter);
    previous = letter;
  }
  // timing: when each letter is born and dies within the loop
  const count = letters.length;
  const birthStep = preset.id === "typed" ? Math.min(85, 3600 / count) : 0;
  const firstBirth = preset.id === "typed" ? 300 : 0;
  letters.forEach((l, i) => {
    l.posterBirthOffset = firstBirth + i * birthStep;
  });
  if (preset.id === "scatter") {
    const random = seededRandom(state.seed * 31 + 5);
    letters.forEach((l) => {
      l.posterBirthOffset = 150 + random() * 2400;
    });
  }
  const deathStep = Math.min(60, 900 / count);
  letters.forEach((letter, i) => {
    letter.posterDeathAt =
      preset.id === "scatter"
        ? 4700 + i * 8
        : 4200 + (count - 1 - i) * deathStep;
    const next = letters[i + 1];
    letter.posterWordEndOffset = null;
    if (
      preset.id !== "scatter" &&
      letter.char !== " " &&
      next &&
      next.char === " "
    ) {
      letter.posterWordEndOffset = Math.max(
        30,
        next.posterBirthOffset - letter.posterBirthOffset,
      );
      letter.wordEndOrnaments = state.theme.growWordEnd(
        letter,
        letter.posterWordEndOffset,
        state.grow,
      );
    }
  });
  state.random = Math.random;
  const layout = layoutLetters(state, letters, POSTER_WIDTH, POSTER_HEIGHT, false);
  // bounding box of the whole scene (type + every ornament)
  const fontSize = layout.fontSize;
  let left = 1e9,
    top = 1e9,
    right = -1e9,
    bottom = -1e9;
  const include = (letter: Letter, x: number, y: number, radius = 0) => {
    const px = letter.targetX + x * fontSize,
      py = letter.targetY + y * fontSize,
      r = radius * fontSize;
    left = Math.min(left, px - r);
    right = Math.max(right, px + r);
    top = Math.min(top, py - r);
    bottom = Math.max(bottom, py + r);
  };
  for (const letter of letters) {
    if (letter.char === " ") continue;
    include(letter, -letter.width / fontSize / 2, -0.75);
    include(letter, letter.width / fontSize / 2, 0.1);
    for (const ornament of [
      ...letter.ornaments,
      ...(letter.wordEndOrnaments || []),
    ]) {
      if (ornament.path)
        ornament.path.forEach((p) => include(letter, p[0], p[1], 0.02));
      else
        include(
          letter,
          ornament.x || 0,
          ornament.y || 0,
          state.theme.ornamentRadius(ornament),
        );
    }
  }
  // centre on the type itself; shrink just enough for the scene to clear the margins on every side
  let typeLeft = 1e9,
    typeRight = -1e9,
    typeTop = 1e9,
    typeBottom = -1e9;
  for (const l of letters)
    if (l.char !== " ") {
      typeLeft = Math.min(typeLeft, l.targetX - l.width / 2);
      typeRight = Math.max(typeRight, l.targetX + l.width / 2);
      typeTop = Math.min(typeTop, l.targetY - 0.72 * fontSize);
      typeBottom = Math.max(typeBottom, l.targetY);
    }
  const halfX = POSTER_WIDTH * 0.44,
    halfY = POSTER_HEIGHT * 0.44,
    typeCentreX = (typeLeft + typeRight) / 2,
    typeCentreY = (typeTop + typeBottom) / 2;
  const scale = Math.min(
    1.25,
    halfX / Math.max(1, typeCentreX - left, right - typeCentreX),
    halfY / Math.max(1, typeCentreY - top, bottom - typeCentreY),
  );
  letters.forEach((l) => {
    l.targetX = POSTER_WIDTH / 2 + (l.targetX - typeCentreX) * scale;
    l.targetY = POSTER_HEIGHT / 2 + (l.targetY - typeCentreY) * scale;
    l.width *= scale;
    l.x = l.targetX;
    l.y = l.targetY;
  });
  state.poster = {
    letters,
    fontSize: fontSize * scale,
    loopMs: preset.loopMs,
    preset: preset.id,
  };
  state.posterStartedAt = performance.now();
}
// Draws the poster at `timeMs` (wraps around the loop). Each preset only changes timing or adds a warp.
export function drawPosterFrame(
  state: EngineState,
  context: CanvasRenderingContext2D,
  timeMs: number,
) {
  const poster = state.poster;
  if (!poster) return;
  const colors = colorsOf(state);
  context.setTransform(1, 0, 0, 1, 0, 0);
  context.fillStyle = colors.background;
  context.fillRect(0, 0, POSTER_WIDTH, POSTER_HEIGHT);
  const painter = canvasPainter(context, state.font);
  const loopTime = ((timeMs % poster.loopMs) + poster.loopMs) % poster.loopMs,
    letters = poster.letters,
    fontSize = poster.fontSize;
  const scene: SceneState = {
    letters,
    fontSize,
    colors,
    handDrawnJitter: state.handDrawnJitter,
    tendrilRecoil: state.tendrilRecoil,
    speed: 1,
    witherMs: 600,
    drawDeadLetters: true,
  };
  letters.forEach((l) => {
    l.x = l.targetX;
    l.y = l.targetY;
    l.diedAt = null;
  });
  const setBirths = (base: number) =>
    letters.forEach((l) => {
      l.bornAt = base + l.posterBirthOffset;
      l.tendrilStartAt = l.bornAt;
      l.wordEndedAt =
        l.posterWordEndOffset != null ? l.bornAt + l.posterWordEndOffset : null;
    });
  if (poster.preset === "scatter") {
    setBirths(0);
    letters.forEach((l) => {
      if (loopTime >= l.posterDeathAt) l.diedAt = l.posterDeathAt;
    });
  } else {
    // typed
    if (loopTime >= 4400) return;
    setBirths(0);
    scene.letters = letters.filter((l) => loopTime >= l.bornAt);
    scene.drawDeadLetters = false;
  }
  renderScene(state, painter, loopTime, scene);
  if (poster.preset === "typed") {
    const shown = scene.letters,
      last = shown[shown.length - 1];
    if (
      Math.floor(loopTime / 400) % 2 === 0 ||
      (last && loopTime - last.bornAt < 300)
    ) {
      const x = last ? last.targetX + last.width / 2 + 0.07 * fontSize : POSTER_WIDTH / 2,
        y = last ? last.targetY - 0.33 * fontSize : POSTER_HEIGHT / 2,
        w = Math.max(2, fontSize * 0.03),
        h = 0.8 * fontSize;
      painter.fillRect(x - w / 2, y - h / 2, w, h, colors.text);
    }
  }
}
