// Underwater: fish swim around each letter, starfish and shells rest on the baseline, bubbles drift up. Jellyfish visitor.
import { seededRandom, springIn, ellipsePoints } from "../engine/kit.ts";
import type {
  Painter,
  GrowContext,
  Letter,
  Ornament,
  Palette,
  Point,
  Theme,
} from "../engine/types.ts";

// ---------- generation ----------
type Random = () => number;
const pickTint = (random: Random) =>
  random() < 0.55 ? "primary" : random() < 0.6 ? "secondary" : "accent";
// legibility: things over the letter body mostly go behind it
const layerFor = (random: Random, x: number, y: number, letterWidth: number) =>
  y > -0.78 && y < 0.05 && Math.abs(x) < letterWidth * 0.5
    ? random() < 0.2
      ? 1
      : 0
    : random() < 0.6
      ? 1
      : 0;

function addFish(
  random: Random,
  out: Ornament[],
  nextId: () => number,
  letterWidth: number,
  count: number,
  delay: number,
  firstIsBig = false,
) {
  const placed = out.filter((o) => o.kind === "fish");
  for (let i = 0; i < count; i++) {
    const radius =
      firstIsBig && i === 0
        ? 0.16 + random() * 0.08
        : random() < 0.25
          ? 0.12 + random() * 0.08
          : 0.04 + random() * 0.05;
    let x = 0,
      y = 0;
    for (let attempt = 0; attempt < 10; attempt++) {
      x = (random() - 0.5) * letterWidth * 1.8;
      y = -0.5 + (random() - 0.5) * 1.7;
      if (
        placed.every(
          (p) => Math.hypot(p.x! - x, p.y! - y) > (p.radius + radius) * 1.8,
        )
      )
        break;
    }
    const fish: Ornament = {
      kind: "fish",
      id: nextId(),
      x,
      y,
      radius,
      facing: random() < 0.5 ? -1 : 1,
      tint: pickTint(random),
      hasStripe: random() < 0.5,
      swimSpeed: 1.2 + random() * 1.6,
      swimPhase: random() * 6.28,
      layer: layerFor(random, x, y, letterWidth),
      delay: delay + i * (80 + random() * 160),
    };
    out.push(fish);
    placed.push(fish);
  }
}

// starfish + shells sit just under the baseline
function addSeabed(
  random: Random,
  out: Ornament[],
  nextId: () => number,
  letterWidth: number,
  count: number,
  delay: number,
) {
  for (let i = 0; i < count; i++) {
    const isStarfish = random() < 0.5;
    out.push({
      kind: isStarfish ? "starfish" : "shell",
      id: nextId(),
      x: (random() - 0.5) * letterWidth * 1.1,
      y: 0.06 + random() * 0.22,
      radius: isStarfish ? 0.07 + random() * 0.07 : 0.06 + random() * 0.06,
      rotation: (random() - 0.5) * (isStarfish ? 1.2 : 0.7),
      tint: pickTint(random),
      layer: random() < 0.7 ? 1 : 0,
      delay: delay + random() * 400,
    });
  }
}

function addBubbles(
  random: Random,
  out: Ornament[],
  nextId: () => number,
  letterWidth: number,
  count: number,
  delay: number,
) {
  for (let i = 0; i < count; i++) {
    out.push({
      kind: "bubble",
      id: nextId(),
      x: (random() - 0.5) * letterWidth * 2,
      y: -0.2 + (random() - 0.5) * 1.6,
      size: 0.012 + random() * 0.03,
      riseSpeed: 0.15 + random() * 0.3,
      risePhase: random(),
      layer: random() < 0.5 ? 0 : 1,
      delay: delay + random() * 900,
    });
  }
}

function growLetter(letter: Letter, grow: GrowContext) {
  const random = seededRandom(
    (letter.wordSeed ^ Math.imul(letter.indexInWord + 1, 2654435761)) +
      Math.floor(grow.random() * 1e6),
  );
  const ornaments: Ornament[] = [];
  let idCounter = 0;
  const nextId = () => letter.id * 100 + idCounter++;
  const width = grow.glyphWidth(letter.char),
    density = grow.density;
  addFish(
    random,
    ornaments,
    nextId,
    width,
    1 + (random() < 0.5 * density ? 1 : 0) + (random() < 0.2 * density ? 1 : 0),
    40,
    letter.indexInWord === 0,
  );
  if (random() < 0.55 * density)
    addSeabed(
      random,
      ornaments,
      nextId,
      width,
      1 + (random() < 0.3 ? 1 : 0),
      200,
    );
  addBubbles(
    random,
    ornaments,
    nextId,
    width,
    Math.round((2 + random() * 4) * density),
    0,
  );
  return { ornaments, tendril: [] };
}

// a word is finished: a fish, something on the seabed, more bubbles
function growWordEnd(letter: Letter, startsAfter: number, grow: GrowContext) {
  const random = seededRandom(
      letter.wordSeed +
        letter.indexInWord * 31 +
        Math.floor(grow.random() * 1e6),
    ),
    ornaments: Ornament[] = [];
  let idCounter = 50;
  const nextId = () => letter.id * 100 + idCounter++;
  const width = grow.glyphWidth(letter.char);
  addFish(random, ornaments, nextId, width, 1, startsAfter + 40);
  addSeabed(random, ornaments, nextId, width, 1, startsAfter + 120);
  addBubbles(
    random,
    ornaments,
    nextId,
    width,
    2 + Math.floor(random() * 3),
    startsAfter,
  );
  return ornaments;
}

// ---------- drawing ----------
// shape space (units of `scale`, optionally mirrored) → screen, rotated by `angle`
const localFrame = (
  cx: number,
  cy: number,
  scale: number,
  angle: number,
  mirror = 1,
) => {
  const c = Math.cos(angle),
    s = Math.sin(angle);
  return (px: number, py: number): Point => [
    cx + (px * mirror * c - py * s) * scale,
    cy + (px * mirror * s + py * c) * scale,
  ];
};

// ponytail: swim, bubbles and the jellyfish run on age, so poster loops can seam slightly; derive from loop phase if exports must be perfect
const draw: Theme["draw"] = {
  fish(painter, fish, drawing) {
    const grown =
      springIn((drawing.age - fish.delay) / 1000, 6, 12) * drawing.vitality;
    if (grown <= 0) return;
    const colors = drawing.colors,
      seconds = drawing.age / 1000,
      home = drawing.toScreen(fish.x!, fish.y!),
      radius = fish.radius * drawing.fontSize * grown;
    const pointerTilt = drawing.pointerTilt ? drawing.pointerTilt(home) : null;
    // swims back and forth around its home spot
    const center: Point = [
      home[0] +
        Math.sin(seconds * fish.swimSpeed + fish.swimPhase) * radius * 0.5,
      home[1] +
        Math.sin(seconds * fish.swimSpeed * 1.7 + fish.swimPhase) *
          radius *
          0.15,
    ];
    const heading =
      drawing.extraRotation +
      Math.sin(seconds * fish.swimSpeed + fish.swimPhase + 1.5) * 0.12 +
      (pointerTilt ? pointerTilt[1] * 0.3 * fish.facing : 0);
    const local = localFrame(
      center[0],
      center[1],
      radius,
      heading,
      fish.facing,
    );
    const tailWag =
        Math.sin(seconds * fish.swimSpeed * 6 + fish.swimPhase) * 0.25,
      bodyColor = colors[fish.tint as "primary"],
      finColor = fish.tint === "accent" ? colors.primary : colors.accent;
    painter.fill(
      [
        local(-0.8, 0),
        local(-1.45, -0.5 + tailWag),
        local(-1.3, tailWag * 0.5),
        local(-1.45, 0.5 + tailWag),
      ],
      finColor,
    );
    painter.fill(
      [local(-0.1, -0.45), local(0.2, -0.8), local(0.45, -0.4)],
      finColor,
    );
    const body: Point[] = [];
    for (let k = 0; k < 28; k++) {
      const a = (k / 28) * Math.PI * 2,
        c = Math.cos(a);
      body.push(local(c, Math.sin(a) * 0.55 * (0.62 + 0.38 * c)));
    }
    painter.fill(body, bodyColor);
    if (fish.hasStripe)
      painter.fill(
        ellipsePoints(
          ...local(0.05, 0),
          radius * 0.13,
          radius * 0.42,
          14,
          drawing.extraRotation,
        ),
        finColor,
      );
    painter.fill(
      ellipsePoints(...local(0.58, -0.1), radius * 0.11, radius * 0.11, 10),
      colors.background,
    );
  },
  starfish(painter, starfish, drawing) {
    const grown =
      springIn((drawing.age - starfish.delay) / 1000, 7, 14) * drawing.vitality;
    if (grown <= 0) return;
    const center = drawing.toScreen(starfish.x!, starfish.y!),
      radius = starfish.radius * drawing.fontSize * grown;
    const local = localFrame(
      center[0],
      center[1],
      radius,
      starfish.rotation + drawing.extraRotation + drawing.jitter[2],
    );
    if (drawing.offerPerch && drawing.age - starfish.delay > 700)
      drawing.offerPerch(center, radius);
    const outline: Point[] = [];
    for (let k = 0; k < 10; k++) {
      const angle = (k / 10) * Math.PI * 2 - Math.PI / 2,
        r = k % 2 ? 0.45 : 1;
      outline.push(local(Math.cos(angle) * r, Math.sin(angle) * r));
    }
    painter.fill(outline, drawing.colors[starfish.tint as "primary"]);
    if (radius > 6)
      for (let k = 0; k < 5; k++) {
        const angle = (k / 5) * Math.PI * 2 - Math.PI / 2;
        painter.fill(
          ellipsePoints(
            ...local(Math.cos(angle) * 0.55, Math.sin(angle) * 0.55),
            radius * 0.07,
            radius * 0.07,
            8,
          ),
          drawing.colors.background,
        );
      }
  },
  shell(painter, shell, drawing) {
    const grown =
      springIn((drawing.age - shell.delay) / 1000, 7, 14) * drawing.vitality;
    if (grown <= 0) return;
    const center = drawing.toScreen(shell.x!, shell.y!),
      radius = shell.radius * drawing.fontSize * grown;
    const local = localFrame(
      center[0],
      center[1],
      radius,
      shell.rotation + drawing.extraRotation + drawing.jitter[2],
    );
    if (drawing.offerPerch && drawing.age - shell.delay > 700)
      drawing.offerPerch(center, radius);
    // scallop fan opening upwards from a hinge at (0, 0.35)
    const fan: Point[] = [local(-0.28, 0.45), local(0.28, 0.45)];
    for (let k = 0; k <= 24; k++) {
      const angle = -0.15 - (k / 24) * (Math.PI - 0.3),
        r = 1 + 0.07 * Math.abs(Math.sin((k / 24) * Math.PI * 6));
      fan.push(local(Math.cos(angle) * r, 0.35 + Math.sin(angle) * r));
    }
    painter.fill(fan, drawing.colors[shell.tint as "primary"]);
    if (radius > 6)
      for (let k = 1; k < 6; k++) {
        const angle = -0.15 - (k / 6) * (Math.PI - 0.3);
        painter.stroke(
          [
            local(0, 0.3),
            local(Math.cos(angle) * 0.85, 0.35 + Math.sin(angle) * 0.85),
          ],
          drawing.colors.background,
          Math.max(0.8, radius * 0.05),
        );
      }
  },
  bubble(painter, bubble, drawing) {
    const grown =
      springIn((drawing.age - bubble.delay) / 1000, 7, 14) * drawing.vitality;
    if (grown <= 0) return;
    // rises, wobbles and shrinks, then starts again from the bottom
    const rise =
        ((drawing.age / 1000) * bubble.riseSpeed + bubble.risePhase) % 1,
      center = drawing.toScreen(
        bubble.x! + Math.sin(rise * 12 + bubble.id) * 0.03,
        bubble.y! - rise * 0.5,
      );
    const radius = bubble.size * drawing.fontSize * grown * (1 - rise * rise),
      lineWidth = Math.max(0.8, radius * 0.22);
    if (radius < 0.5) return;
    const ring = ellipsePoints(center[0], center[1], radius, radius, 14);
    painter.stroke([...ring, ring[0]], drawing.colors.text, lineWidth);
  },
};

function drawJellyfish(
  painter: Painter,
  x: number,
  y: number,
  size: number,
  angle: number,
  wingOpen: number,
  colors: Palette,
) {
  const local = localFrame(x, y, size, angle),
    pulse = 0.85 + 0.15 * wingOpen;
  const bell: Point[] = [];
  for (let k = 0; k <= 16; k++) {
    const a = Math.PI + (k / 16) * Math.PI;
    bell.push(
      local(Math.cos(a) * 0.7 * pulse, -0.1 + (Math.sin(a) * 0.6) / pulse),
    );
  }
  for (let k = 0; k <= 6; k++)
    bell.push(
      local(0.7 * pulse - (k / 6) * 1.4 * pulse, -0.1 + (k % 2 ? 0.1 : 0)),
    );
  painter.fill(bell, colors.text);
  for (let i = -2; i <= 2; i++) {
    const tentacle: Point[] = [];
    for (let k = 0; k <= 6; k++)
      tentacle.push(
        local(
          i * 0.22 + Math.sin(k * 0.9 + wingOpen * 3 + i) * 0.08,
          -0.05 + k * 0.16,
        ),
      );
    painter.stroke(tentacle, colors.accent, Math.max(0.8, size * 0.05));
  }
}

const palette = (
  name: string,
  background: string,
  primary: string,
  secondary: string,
  accent: string,
  text: string,
): Palette => ({ name, background, primary, secondary, accent, text });

const water: Theme = {
  id: "water",
  name: "Water",
  visitorName: "Jellyfish",
  typingHint: "type to dive",
  palettes: [
    palette("Deep sea", "#031B34", "#FF8A3D", "#3DD6D0", "#FFD7A8", "#FFFFFF"),
    palette("Lagoon", "#0A4D68", "#FFD23F", "#FF6B6B", "#E0F7FA", "#FFFFFF"),
    palette("Abyss", "#000814", "#FFC300", "#00B4D8", "#CAF0F8", "#FFFFFF"),
    palette("Coral", "#FF6F59", "#FFF4E0", "#1B3A4B", "#FFD166", "#1B1B1B"),
    palette("Sand", "#F4E9D8", "#E4572E", "#17BEBB", "#2E282A", "#2E282A"),
    palette("Mono", "#000000", "#F2F2F2", "#6E6E6E", "#FFFFFF", "#FFFFFF"),
  ],
  growLetter,
  growWordEnd,
  draw,
  ornamentRadius: (o) =>
    o.kind === "fish"
      ? o.radius * 1.6
      : o.kind === "bubble"
        ? o.size
        : o.radius,
  drawVisitor: drawJellyfish,
};
export default water;
