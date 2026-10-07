// Poster mode: a seeded, square, looping scene; each preset changes timing or adds a warp.
import { easeOut, seededRandom } from "./kit.ts";
import { PRESETS, POSTER_SIZE } from "./config.ts";
import { createLetter, growLetter } from "./letters.ts";
import { layoutLetters } from "./layout.ts";
import { canvasPainter, renderScene, type SceneState } from "./render.ts";
import { colorsOf, type EngineState, type PosterScene } from "./state.ts";
import type { Painter, Letter, Palette, Point } from "./types.ts";

// ---------- poster ----------
export function currentPreset(state: EngineState) {
  return PRESETS.find((p) => p.id === state.preset) || PRESETS[0];
}
// Builds a separate, seeded set of letters for the square poster and fits the whole scene into it.
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
  const birthStep =
    preset.id === "grow"
      ? Math.min(110, 3000 / count)
      : preset.id === "typed"
        ? Math.min(85, 3600 / count)
        : 0;
  const firstBirth =
    preset.id === "grow" ? 200 : preset.id === "typed" ? 300 : 0;
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
  const layout = layoutLetters(state, letters, POSTER_SIZE, POSTER_SIZE, false);
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
  const half = POSTER_SIZE * 0.44,
    typeCentreX = (typeLeft + typeRight) / 2,
    typeCentreY = (typeTop + typeBottom) / 2;
  const scale = Math.min(
    1.25,
    half / Math.max(1, typeCentreX - left, right - typeCentreX),
    half / Math.max(1, typeCentreY - top, bottom - typeCentreY),
  );
  letters.forEach((l) => {
    l.targetX = POSTER_SIZE / 2 + (l.targetX - typeCentreX) * scale;
    l.targetY = POSTER_SIZE / 2 + (l.targetY - typeCentreY) * scale;
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
// scripted flight for the "visit" preset: in → first perch → second perch → out
export function drawPosterVisitor(
  state: EngineState,
  painter: Painter,
  loopTime: number,
  poster: PosterScene,
  colors: Palette,
) {
  const byX = state.perches.slice().sort((a, b) => a.x - b.x);
  if (!byX.length) return;
  const first = byX[Math.floor(byX.length * 0.25)],
    second = byX[Math.min(byX.length - 1, Math.floor(byX.length * 0.75))];
  const enter: Point = [-80, 300],
    seat1: Point = [first.x, first.y - first.radius * 0.55],
    seat2: Point = [second.x, second.y - second.radius * 0.55],
    exit: Point = [1160, 260];
  const size = Math.max(12, poster.fontSize * 0.09),
    seconds = loopTime / 1000,
    ease = (v: number) => easeOut(Math.max(0, Math.min(1, v)));
  const flightLeg = (
    from: Point,
    to: Point,
    progress: number,
    arcHeight: number,
  ): Point => {
    const e = ease(progress);
    return [
      from[0] + (to[0] - from[0]) * e,
      from[1] + (to[1] - from[1]) * e - Math.sin(e * Math.PI) * arcHeight,
    ];
  };
  let position: Point,
    isFlying = true,
    direction = 0;
  if (seconds < 1.8) {
    position = flightLeg(enter, seat1, seconds / 1.8, 160);
    direction = 1;
  } else if (seconds < 3.4) {
    position = seat1;
    isFlying = false;
  } else if (seconds < 4.6) {
    position = flightLeg(seat1, seat2, (seconds - 3.4) / 1.2, 140);
    direction = seat2[0] > seat1[0] ? 1 : -1;
  } else if (seconds < 5.8) {
    position = seat2;
    isFlying = false;
  } else {
    position = flightLeg(seat2, exit, (seconds - 5.8) / 1.2, 60);
    direction = 1;
  }
  let wingOpen, angle;
  if (isFlying) {
    wingOpen = Math.abs(Math.cos(seconds * 17));
    position = [
      position[0] + Math.sin(seconds * 7) * 6,
      position[1] + Math.sin(seconds * 13) * 4,
    ];
    angle = direction * 0.3;
  } else {
    const flapBurst =
      (seconds > 2.4 && seconds < 2.8) || (seconds > 5 && seconds < 5.3);
    wingOpen = flapBurst
      ? 0.2 + 0.8 * Math.abs(Math.cos(seconds * 9))
      : 0.3 + 0.1 * Math.sin(seconds * 3);
    angle = 0;
  }
  state.theme.drawVisitor(
    painter,
    position[0],
    position[1],
    size,
    angle,
    wingOpen,
    colors,
  );
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
  context.fillRect(0, 0, POSTER_SIZE, POSTER_SIZE);
  const loopTime = ((timeMs % poster.loopMs) + poster.loopMs) % poster.loopMs,
    letters = poster.letters,
    painter = canvasPainter(context, state.font),
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
  const fullyGrown = -1e5; // born long ago
  // wind gust profile at distance d from the front: a decaying ripple behind it, a bump at it
  const gustAt = (d: number) =>
    d < 0 ? Math.exp(d * 2.2) * Math.cos(-d * 9) : Math.exp(-d * d * 30);
  if (poster.preset === "breathe") {
    setBirths(fullyGrown);
    const phase = (loopTime / poster.loopMs) * Math.PI * 2;
    scene.warp = (x, y, l) => {
      const h = Math.max(0, (l.y - y) / fontSize);
      return [
        x + Math.sin(phase + l.x * 0.004 + h * 1.1) * fontSize * 0.03 * h,
        y + Math.cos(phase + x * 0.003) * fontSize * 0.008 * h,
      ];
    };
    scene.extraRotation = (o) => Math.sin(phase + o.id * 0.7) * 0.12;
  } else if (poster.preset === "grow" || poster.preset === "scatter") {
    setBirths(0);
    letters.forEach((l) => {
      if (loopTime >= l.posterDeathAt) l.diedAt = l.posterDeathAt;
    });
  } else if (poster.preset === "wind") {
    setBirths(fullyGrown);
    const front = -0.35 + (loopTime / poster.loopMs) * 1.9;
    scene.warp = (x, y, l) => {
      const heightAbove = Math.max(0, (l.y - y) / fontSize),
        gust = gustAt(l.x / POSTER_SIZE - front);
      const idle = Math.sin((loopTime / 1000) * 1.6 + l.x * 0.01) * 0.012;
      return [
        x +
          (gust * 0.13 + idle) * fontSize * heightAbove * heightAbove * 0.6 +
          (gust * 0.13 + idle) * fontSize * heightAbove * 0.4,
        y + Math.abs(gust) * 0.02 * fontSize * heightAbove,
      ];
    };
    scene.extraRotation = (o) =>
      gustAt((o.x || 0) / POSTER_SIZE - front) * 0.35;
  } else if (poster.preset === "reach") {
    setBirths(fullyGrown);
    const phase = (loopTime / poster.loopMs) * Math.PI * 2,
      lightX = 540 + Math.sin(phase) * 430,
      lightY = 540 + Math.sin(phase * 2) * 260;
    state.reachLight = [lightX, lightY];
    scene.warp = (x, y, l) => {
      const dx = lightX - l.x,
        dy = lightY - (l.y - fontSize * 0.6),
        distance = Math.hypot(dx, dy) || 1,
        w = Math.max(0, 1 - distance / 560),
        strength = w * w * (3 - 2 * w);
      const heightAbove = Math.min(2.5, Math.max(0, (l.y - y) / fontSize)),
        bend = heightAbove * heightAbove * 0.5 + heightAbove * 0.5;
      return [
        x + (dx / distance) * strength * fontSize * 0.12 * bend,
        y + (dy / distance) * strength * fontSize * 0.06 * bend,
      ];
    };
    scene.extraRotation = (o) =>
      Math.sin(Math.atan2(lightY - (o.y || 0), lightX - (o.x || 0))) * 0.15;
  } else if (poster.preset === "visit") {
    setBirths(fullyGrown);
    scene.collectPerches = true;
    state.perches = [];
    const phase = (loopTime / poster.loopMs) * Math.PI * 2;
    scene.warp = (x, y, l) => {
      const heightAbove = Math.max(0, (l.y - y) / fontSize);
      return [
        x +
          Math.sin(phase + l.x * 0.004 + heightAbove) *
            fontSize *
            0.015 *
            heightAbove,
        y,
      ];
    };
  } else {
    // typed
    if (loopTime >= 4400) return;
    setBirths(0);
    scene.letters = letters.filter((l) => loopTime >= l.bornAt);
    scene.drawDeadLetters = false;
  }
  renderScene(state, painter, loopTime, scene);
  if (poster.preset === "reach") {
    const [lightX, lightY] = state.reachLight,
      radius = fontSize * 0.09,
      points: Point[] = [];
    for (let k = 0; k < 20; k++) {
      const a = (k / 20) * Math.PI * 2;
      points.push([
        lightX + Math.cos(a) * radius,
        lightY + Math.sin(a) * radius,
      ]);
    }
    painter.fill(points, colors.accent);
  }
  if (poster.preset === "visit")
    drawPosterVisitor(state, painter, loopTime, poster, colors);
  if (poster.preset === "typed") {
    const shown = scene.letters,
      last = shown[shown.length - 1];
    if (
      Math.floor(loopTime / 400) % 2 === 0 ||
      (last && loopTime - last.bornAt < 300)
    ) {
      const x = last ? last.targetX + last.width / 2 + 0.07 * fontSize : 540,
        y = last ? last.targetY - 0.33 * fontSize : 540,
        w = Math.max(2, fontSize * 0.03),
        h = 0.8 * fontSize;
      painter.fillRect(x - w / 2, y - h / 2, w, h, colors.text);
    }
  }
}
