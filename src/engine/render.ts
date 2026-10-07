// Rendering shared by the live view, poster and SVG: painter, motion, jitter, ornament passes.
import { hashToUnit, easeOut, traceSmoothPath } from "./kit.ts";
import { cssFont, type Font } from "./config.ts";
import { colorsOf, type EngineState } from "./state.ts";
import { updateAndDrawVisitors } from "./visitors.ts";
import type { Painter, Drawing, Letter, Ornament, Palette, Point } from "./types.ts";

// What one render pass needs: the letters to draw plus how they should move.
export interface SceneState {
  letters: Letter[];
  fontSize: number;
  colors: Palette;
  handDrawnJitter: boolean;
  tendrilRecoil: number;
  speed: number;
  witherMs: number;
  followPointer?: boolean; // live view: growth leans towards the pointer
  drawDeadLetters?: boolean; // poster: keep text visible while its growth withers
  collectPerches?: boolean; // poster "visit": gather landing spots without following the pointer
  warp?: (x: number, y: number, letter: Letter) => Point; // poster motion displacement
  extraRotation?: (ornament: Ornament) => number; // poster motion rotation
}
export const canvasPainter = (
  context: CanvasRenderingContext2D,
  font: Font,
): Painter => ({
  fill: (points, color) => {
    context.beginPath();
    traceSmoothPath(context, points, true);
    context.fillStyle = color;
    context.fill();
  },
  stroke: (points, color, width) => {
    context.beginPath();
    traceSmoothPath(context, points, false);
    context.strokeStyle = color;
    context.lineWidth = width;
    context.lineCap = "round";
    context.lineJoin = "round";
    context.stroke();
  },
  fillRect: (x, y, width, height, color) => {
    context.fillStyle = color;
    context.fillRect(x, y, width, height);
  },
  drawGlyph: (char, x, y, fontSize, color) => {
    context.font = cssFont(font, fontSize);
    context.textAlign = "center";
    context.textBaseline = "alphabetic";
    context.fillStyle = color;
    context.fillText(char, x, y);
  },
});
export function liveSceneState(state: EngineState): SceneState {
  return {
    letters: state.letters,
    fontSize: state.fontSize,
    colors: colorsOf(state),
    handDrawnJitter: state.handDrawnJitter,
    tendrilRecoil: state.tendrilRecoil,
    speed: 1,
    witherMs: 260,
    followPointer: true,
  };
}
export function paintLiveView(
  state: EngineState,
  now: number,
  showCaret: boolean,
) {
  const context = state.context,
    ratio = state.pixelRatio;
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  context.fillStyle = colorsOf(state).background;
  context.fillRect(0, 0, state.width, state.height);
  const painter = canvasPainter(context, state.font),
    scene = liveSceneState(state);
  renderScene(state, painter, now, scene);
  updateAndDrawVisitors(state, painter, now, scene.colors);
  if (showCaret) {
    const fontSize = state.fontSize,
      blinkOn = now - state.lastKeyAt < 500 || Math.floor(now / 530) % 2 === 0,
      growIn = easeOut((now - state.startedAt) / 600);
    if (blinkOn && growIn > 0) {
      const h = 0.8 * fontSize * growIn,
        w = Math.max(2, fontSize * 0.03);
      painter.fillRect(
        state.caretX - w / 2,
        state.caretY - h / 2,
        w,
        h,
        scene.colors.text,
      );
    }
  }
}
// Draws: ornaments behind the type → the type → ornaments in front.
export function renderScene(
  state: EngineState,
  painter: Painter,
  now: number,
  scene: SceneState,
) {
  const fontSize = scene.fontSize,
    letters = scene.letters,
    alive = letters.filter((l) => !l.diedAt),
    speed = scene.speed || 1;
  state.renderTime = now;
  if (scene.followPointer) state.perches = [];
  if (scene.followPointer)
    for (const letter of letters) {
      let pullX = 0,
        pullY = 0;
      if (state.pointerX != null && !letter.diedAt && letter.char !== " ") {
        const dx = state.pointerX - letter.x,
          dy = state.pointerY - (letter.y - fontSize * 0.6),
          distance = Math.hypot(dx, dy),
          reach = Math.max(260, fontSize * 3.2);
        if (distance < reach && distance > 1) {
          const w = 1 - distance / reach,
            strength = w * w * (3 - 2 * w);
          pullX = (dx / distance) * strength;
          pullY = (dy / distance) * strength;
        }
      }
      letter.pointerLean[0] += (pullX - letter.pointerLean[0]) * 0.07;
      letter.pointerLean[1] += (pullY - letter.pointerLean[1]) * 0.07;
    }
  const jitterStep = scene.handDrawnJitter ? Math.floor(now / 120) : 0,
    jitterAmount = scene.handDrawnJitter ? Math.max(0.8, fontSize * 0.01) : 0;
  const vitalityOf = (l: Letter) =>
    l.diedAt ? 1 - easeOut((now - l.diedAt) / scene.witherMs) : 1;
  const drawLayer = (layer: number) => {
    for (const letter of letters) {
      if (letter.char === " ") continue;
      const age = (now - letter.bornAt) * speed,
        vitality = vitalityOf(letter);
      const pass = {
        painter,
        letter,
        age,
        vitality,
        scene,
        jitterStep,
        jitterAmount,
        layer,
      };
      drawOrnaments(state, pass, letter.ornaments, null);
      if (letter.wordEndOrnaments)
        drawOrnaments(state, pass, letter.wordEndOrnaments, null);
      // the tendril shows on a word's last letter, and recoils when a space ends the word
      const index = alive.indexOf(letter),
        next = index >= 0 ? alive[index + 1] : null;
      if (
        letter.tendril.length &&
        (letter.diedAt || !next || next.char === " ")
      ) {
        let grown = easeOut(
          ((now - letter.tendrilStartAt) * speed - 150) / 450,
        );
        if (letter.wordEndedAt != null)
          grown *=
            1 -
            easeOut(((now - letter.wordEndedAt) * speed) / 150) *
              Math.min(0.85, scene.tendrilRecoil / (0.6 * fontSize));
        drawOrnaments(state, pass, letter.tendril, grown * vitality);
      }
    }
  };
  drawLayer(0);
  if (!state.theme.replacesGlyphs)
    for (const l of letters)
      if (l.char !== " " && (scene.drawDeadLetters || !l.diedAt))
        painter.drawGlyph(
          l.char,
          l.x,
          l.y,
          fontSize * (l.scale ?? 1),
          scene.colors.text,
        );
  drawLayer(1);
}
export function drawOrnaments(
  state: EngineState,
  pass: {
    painter: Painter;
    letter: Letter;
    age: number;
    vitality: number;
    scene: SceneState;
    jitterStep: number;
    jitterAmount: number;
    layer: number;
  },
  ornaments: Ornament[],
  growthOverride: number | null,
) {
  const { painter, letter, scene, layer } = pass,
    fontSize = scene.fontSize * (letter.scale ?? 1);
  for (const ornament of ornaments) {
    if (!ornament.segments && ornament.layer !== layer) continue; // path ornaments pick their own segments per layer
    const drawOrnament = state.theme.draw[ornament.kind];
    if (!drawOrnament) continue;
    const jitter = jitterFor(
      state,
      ornament.id,
      pass.jitterStep,
      pass.jitterAmount,
    );
    const drawing: Drawing = {
      fontSize,
      colors: scene.colors,
      age: pass.age,
      vitality: pass.vitality,
      layer,
      growthOverride,
      jitter,
      extraRotation: scene.extraRotation ? scene.extraRotation(ornament) : 0,
      toScreen: (x, y) =>
        applyMotion(
          state,
          scene,
          letter,
          letter.x + x * fontSize + jitter[0],
          letter.y + y * fontSize + jitter[1],
        ),
      pointerTilt: scene.followPointer
        ? (at) => pointerTiltFor(state, ornament.id, at[0], at[1])
        : null,
      offerPerch:
        (scene.followPointer || scene.collectPerches) && !letter.diedAt
          ? (at, radius) => {
              state.perches.push({
                id: ornament.id,
                x: at[0],
                y: at[1],
                radius,
              });
            }
          : null,
    };
    drawOrnament(painter, ornament, drawing);
  }
}
// moves a screen point: springy sway after birth + lean towards the pointer + poster warp
export function applyMotion(
  state: EngineState,
  scene: SceneState,
  letter: Letter,
  x: number,
  y: number,
): Point {
  const seconds =
    ((state.renderTime - letter.bornAt) * (scene.speed || 1)) / 1000;
  if (seconds > 0 && seconds < 2.5) {
    const heightAbove = Math.max(0, (letter.y - y) / scene.fontSize),
      damping = Math.exp(-seconds * 3.2),
      side = letter.id % 2 ? 1 : -1;
    x +=
      scene.fontSize *
      0.07 *
      heightAbove *
      damping *
      Math.sin(seconds * 11) *
      side;
    y +=
      scene.fontSize *
      0.035 *
      heightAbove *
      damping *
      Math.sin(seconds * 11 + 1.2);
  }
  if (scene.followPointer) {
    const heightAbove = Math.min(
        2.5,
        Math.max(0, (letter.y - y) / scene.fontSize),
      ),
      bend = heightAbove * heightAbove * 0.5 + heightAbove * 0.5;
    x += letter.pointerLean[0] * scene.fontSize * 0.1 * bend;
    y += letter.pointerLean[1] * scene.fontSize * 0.05 * bend;
  }
  return scene.warp ? scene.warp(x, y, letter) : [x, y];
}
// smoothed (x, y) lean of one ornament towards the pointer, strongest nearby
export function pointerTiltFor(
  state: EngineState,
  id: number,
  x: number,
  y: number,
): Point {
  let wantX = 0,
    wantY = 0;
  if (state.pointerX != null) {
    const dx = state.pointerX - x,
      dy = state.pointerY - y,
      distance = Math.hypot(dx, dy),
      reach = 300;
    if (distance < reach && distance > 0.001) {
      const w = 1 - distance / reach,
        strength = w * w * (3 - 2 * w) * Math.min(1, distance / 40);
      wantX = (dx / distance) * strength;
      wantY = (dy / distance) * strength;
    }
  }
  const tilt = state.pointerTiltById[id] || [0, 0];
  tilt[0] += (wantX - tilt[0]) * 0.09;
  tilt[1] += (wantY - tilt[1]) * 0.09;
  return (state.pointerTiltById[id] = tilt);
}
// hand-drawn tremble: a new small offset every `step`, same for every frame within it
export function jitterFor(
  state: EngineState,
  id: number,
  step: number,
  amount: number,
): [number, number, number] {
  if (!amount) return [0, 0, 0];
  return [
    (hashToUnit(id * 1.37 + step * 7.13) * 2 - 1) * amount,
    (hashToUnit(id * 2.71 + step * 3.11) * 2 - 1) * amount,
    (hashToUnit(id * 5.3 + step * 1.7) * 2 - 1) * 0.035,
  ];
}
