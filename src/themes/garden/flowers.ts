// Flowers: rose, daisy, tulip, poppy, bluebell. Each springs open after its delay and shrinks while withering.
import {
  springIn,
  easeOut,
  ellipsePoints,
  strokePartial,
} from "../../engine/kit.ts";
import type {
  Painter,
  Drawing,
  Ornament,
  Palette,
  Point,
  Theme,
} from "../../engine/types.ts";
import { flowerColor, gardenColors } from "./palettes.ts";

// rose petals, back to front: [centreX, centreY, radiusX, radiusY, angle, depth, hasEdgeLine]
const ROSE_PETALS = [
  [0, -0.36, 0.56, 0.54, 0, 0, 0],
  [-0.5, -0.06, 0.6, 0.6, -0.35, 0, 0],
  [0.52, -0.06, 0.6, 0.6, 0.35, 0, 0],
  [-0.42, 0.3, 0.62, 0.48, 0.2, 0.12, 1],
  [0.47, 0.3, 0.62, 0.48, -0.2, 0.12, 1],
  [0.05, 0.42, 0.56, 0.38, 0, 0.14, 0],
];

// petals spring open one by one, then the spiral and scallop lines draw on; `tilt` fakes 3D turning towards the pointer
export function drawRose(
  painter: Painter,
  cx: number,
  cy: number,
  radius: number,
  rotation: number,
  rose: Ornament,
  age: number,
  tilt: Point | null,
  colors: Palette,
) {
  const cosR = Math.cos(rotation),
    sinR = Math.sin(rotation);
  const tiltAmount = tilt ? Math.hypot(tilt[0], tilt[1]) : 0,
    tiltX = tiltAmount ? tilt![0] / tiltAmount : 0,
    tiltY = tiltAmount ? tilt![1] / tiltAmount : 0,
    squash = -0.28 * tiltAmount;
  const toScreen = (x: number, y: number, depth = 0): Point => {
    let dx = x * cosR - y * sinR,
      dy = x * sinR + y * cosR;
    if (tiltAmount) {
      const k = (dx * tiltX + dy * tiltY) * squash;
      dx += k * tiltX + tilt![0] * radius * depth;
      dy += k * tiltY + tilt![1] * radius * depth;
    }
    return [cx + dx, cy + dy];
  };
  const pivotX = 0,
    pivotY = 0.5,
    lineWidth = Math.max(0.8, radius * 0.045),
    petalStagger = 85;
  ROSE_PETALS.forEach((petal, i) => {
    const open = springIn((age - i * petalStagger) / 1000, 8, 14);
    if (open <= 0.001) return;
    const unfold = (1 - Math.min(1, open)) * (petal[0] < 0 ? 0.5 : -0.5),
      angle = petal[4] + unfold,
      cos = Math.cos(angle),
      sin = Math.sin(angle);
    const outline = (theta: number) => {
      const wobble =
        1 +
        0.08 * Math.sin(3 * theta + rose.phase1 + i) +
        0.04 * Math.sin(5 * theta + rose.phase2);
      const lx = Math.cos(theta) * petal[2] * wobble,
        ly = Math.sin(theta) * petal[3] * wobble;
      const px = petal[0] + lx * cos - ly * sin,
        py = petal[1] + lx * sin + ly * cos;
      return toScreen(
        (pivotX + (px - pivotX) * open) * radius,
        (pivotY + (py - pivotY) * open) * radius,
        petal[5],
      );
    };
    const points: Point[] = [];
    for (let k = 0; k < 26; k++) points.push(outline((k / 26) * Math.PI * 2));
    painter.fill(points, flowerColor(colors, rose));
    if (petal[6] && radius >= 12 && open > 0.4) {
      const edge: Point[] = [];
      for (let k = 0; k <= 14; k++)
        edge.push(outline(Math.PI * (1.18 + (0.64 * k) / 14)));
      strokePartial(
        painter,
        edge,
        0,
        Math.min(1, (open - 0.4) / 0.5),
        colors.accent,
        lineWidth * 0.8,
      );
    }
  });
  const linesDrawn = easeOut(
    (age - ROSE_PETALS.length * petalStagger - 80) / 520,
  );
  if (linesDrawn > 0 && radius > 3) {
    const spiral: Point[] = [],
      scallop: Point[] = [];
    const turns =
      radius < 20
        ? Math.min(rose.spiralTurns, 1.3)
        : radius < 32
          ? rose.spiralTurns * 0.8
          : rose.spiralTurns;
    for (let i = 0; i <= 70; i++) {
      const u = i / 70,
        theta = rose.phase1 + u * turns * Math.PI * 2,
        r = radius * (0.08 + 0.57 * u);
      spiral.push(
        toScreen(
          Math.cos(theta) * r * 1.05,
          Math.sin(theta) * r * 0.72 - 0.12 * radius,
          0.34 - 0.24 * u,
        ),
      );
    }
    strokePartial(painter, spiral, 0, linesDrawn, colors.accent, lineWidth);
    if (radius >= 14) {
      for (let i = 0; i <= 36; i++) {
        const u = i / 36;
        scallop.push(
          toScreen(
            (-0.72 + 1.5 * u) * radius,
            0.36 * radius + 0.16 * radius * Math.abs(Math.sin(u * Math.PI * 3)),
            0.18,
          ),
        );
      }
      strokePartial(painter, scallop, 0, linesDrawn, colors.accent, lineWidth);
    }
  }
}

// shared flower setup: screen position, pointer tilt, size (shrinks while withering), perch for the visitor
function bloomBasics(flower: Ornament, drawing: Drawing) {
  const age = drawing.age - flower.delay;
  if (age < 0 || drawing.vitality <= 0.001) return null;
  const center = drawing.toScreen(flower.x!, flower.y!),
    tilt = drawing.pointerTilt ? drawing.pointerTilt(center) : null,
    radius = flower.radius * drawing.fontSize * drawing.vitality;
  if (drawing.offerPerch && age > 700) drawing.offerPerch(center, radius);
  return {
    age,
    center,
    radius,
    tilt,
    rotation:
      flower.rotation +
      drawing.jitter[2] +
      drawing.extraRotation +
      (tilt ? tilt[0] * 0.22 : 0),
  };
}
// local frame: `along` follows `angle`, `across` is perpendicular, both in units of `scale`
const localFrame = (origin: Point, scale: number, angle: number) => {
  const cos = Math.cos(angle),
    sin = Math.sin(angle);
  return (along: number, across: number): Point => [
    origin[0] + (along * cos - across * sin) * scale,
    origin[1] + (along * sin + across * cos) * scale,
  ];
};

export const drawFlower: Theme["draw"] = {
  daisy(painter, daisy, drawing) {
    const bloom = bloomBasics(daisy, drawing);
    if (!bloom) return;
    const { age, center, radius, tilt, rotation } = bloom,
      petalCount = daisy.petalCount as number;
    for (let i = 0; i < petalCount; i++) {
      const open = springIn((age - i * 22) / 1000, 8, 14);
      if (open <= 0.001) continue;
      const angle = rotation + (i / petalCount) * Math.PI * 2,
        local = localFrame(center, radius, angle);
      painter.fill(
        ellipsePoints(
          ...local(0.55 * open, 0),
          radius * 0.42 * open,
          radius * 0.13 * open,
          14,
          angle,
        ),
        flowerColor(drawing.colors, daisy),
      );
    }
    const centerOpen = springIn((age - 200) / 1000, 7, 12);
    if (centerOpen <= 0) return;
    const offset: Point = tilt
      ? [tilt[0] * radius * 0.2, tilt[1] * radius * 0.2]
      : [0, 0];
    painter.fill(
      ellipsePoints(
        center[0] + offset[0],
        center[1] + offset[1],
        radius * 0.28 * centerOpen,
        radius * 0.28 * centerOpen,
        16,
      ),
      flowerColor(drawing.colors, daisy, 1),
    );
  },
  poppy(painter, poppy, drawing) {
    const bloom = bloomBasics(poppy, drawing);
    if (!bloom) return;
    const { age, center, radius, rotation } = bloom;
    for (let i = 0; i < 5; i++) {
      const open = springIn((age - i * 70) / 1000, 7, 12);
      if (open <= 0.001) continue;
      const angle = rotation + (i / 5) * Math.PI * 2,
        local = localFrame(center, radius, angle),
        points: Point[] = [];
      for (let k = 0; k < 22; k++) {
        const t = (k / 22) * Math.PI * 2,
          wobble = 1 + 0.07 * Math.sin(4 * t + poppy.phase + i);
        points.push(
          local(
            (0.42 + Math.cos(t) * 0.48 * wobble) * open,
            Math.sin(t) * 0.44 * wobble * open,
          ),
        );
      }
      painter.fill(points, flowerColor(drawing.colors, poppy));
      painter.stroke(
        points.slice(14, 22),
        drawing.colors.background,
        Math.max(0.8, radius * 0.035),
      );
    }
    const centerOpen = springIn((age - 380) / 1000, 7, 12);
    if (centerOpen <= 0) return;
    painter.fill(
      ellipsePoints(
        center[0],
        center[1],
        radius * 0.24 * centerOpen,
        radius * 0.24 * centerOpen,
        16,
      ),
      gardenColors(drawing.colors).leaf,
    );
    for (let k = 0; k < 7; k++) {
      const angle = rotation + (k / 7) * Math.PI * 2;
      painter.fill(
        ellipsePoints(
          center[0] + Math.cos(angle) * radius * 0.33 * centerOpen,
          center[1] + Math.sin(angle) * radius * 0.33 * centerOpen,
          radius * 0.045,
          radius * 0.045,
          8,
        ),
        drawing.colors.text,
      );
    }
  },
  tulip(painter, tulip, drawing) {
    const bloom = bloomBasics(tulip, drawing);
    if (!bloom) return;
    const open = springIn(bloom.age / 1000, 6, 11);
    if (open <= 0.001) return;
    // the cup opens along the stem's direction
    const local = localFrame(
        bloom.center,
        bloom.radius * 1.25,
        tulip.angle + bloom.rotation * 0.5,
      ),
      widen = 0.75 + 0.25 * open;
    const cup: Point[] = [
      [0, -0.15],
      [0.35, -0.55],
      [1, -0.5],
      [0.78, -0.17],
      [1.1, 0],
      [0.78, 0.17],
      [1, 0.5],
      [0.35, 0.55],
      [0, 0.15],
    ];
    painter.fill(
      cup.map(([along, across]) => local(along * open, across * open * widen)),
      flowerColor(drawing.colors, tulip),
    );
    if (bloom.radius > 8 && open > 0.5)
      painter.stroke(
        [
          local(0.25 * open, 0),
          local(0.5 * open, 0.04 * open),
          local(0.82 * open, 0),
        ],
        drawing.colors.accent,
        Math.max(0.8, bloom.radius * 0.05),
      );
  },
  bluebell(painter, bluebell, drawing) {
    const bloom = bloomBasics(bluebell, drawing);
    if (!bloom) return;
    const { age, center, radius } = bloom,
      sway =
        Math.sin((drawing.age / 1000) * 1.3 + bluebell.phase) * 0.08 +
        drawing.extraRotation;
    // an arching stalk to one side, bells hanging off it
    const local = localFrame(center, radius, sway),
      side = bluebell.side as number,
      stalk: Point[] = [];
    const stalkGrown = Math.min(1, age / 400);
    const stalkPoint = (t: number) =>
      local(
        side * t * 1.5,
        -Math.sin(t * Math.PI * 0.85) * 0.55 + t * t * 0.35,
      );
    for (let k = 0; k <= 12; k++) stalk.push(stalkPoint((k / 12) * stalkGrown));
    painter.stroke(
      stalk,
      drawing.colors.secondary,
      Math.max(0.8, drawing.fontSize * 0.015),
    );
    const bellShape: Point[] = [
      [0, 0],
      [-0.2, 0.06],
      [-0.3, 0.42],
      [-0.42, 0.62],
      [-0.18, 0.55],
      [0, 0.64],
      [0.18, 0.55],
      [0.42, 0.62],
      [0.3, 0.42],
      [0.2, 0.06],
    ];
    for (let i = 0; i < 3; i++) {
      const open = springIn((age - 250 - i * 110) / 1000, 7, 13);
      if (open <= 0.001) continue;
      const hangFrom = stalkPoint(0.35 + i * 0.3),
        size = radius * 0.75 * (1 - i * 0.15) * open;
      const bell = localFrame(
        hangFrom,
        size,
        Math.PI / 2 + sway * 2 - Math.PI / 2,
      );
      painter.fill(
        bellShape.map(([along, across]) => bell(along, across + 0.05)),
        flowerColor(drawing.colors, bluebell),
      );
    }
  },
};
