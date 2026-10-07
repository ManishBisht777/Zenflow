// Space: no stems — planets and stars float freely around each letter. UFO visitor.
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
const PLANET_STYLES = ["plain", "ring", "bands", "crater", "moon"] as const;

// scatter planets around a letter, avoiding overlaps with ones already placed
function addPlanets(
  random: Random,
  out: Ornament[],
  nextId: () => number,
  letterWidth: number,
  count: number,
  delay: number,
  firstIsBig = false,
) {
  const placed = out.filter((o) => o.kind === "planet");
  for (let i = 0; i < count; i++) {
    const radius =
      firstIsBig && i === 0
        ? 0.17 + random() * 0.08
        : 0.04 + random() * random() * 0.2; // mostly small, sometimes big
    let x = 0,
      y = 0;
    for (let attempt = 0; attempt < 10; attempt++) {
      x = (random() - 0.5) * letterWidth * 1.7;
      y = -0.4 + (random() - 0.5) * 1.9;
      if (
        placed.every(
          (p) => Math.hypot(p.x! - x, p.y! - y) > (p.radius + radius) * 1.4,
        )
      )
        break;
    }
    // legibility: a planet over the letter body mostly goes behind it
    const overLetter = y > -0.78 && y < 0.05 && Math.abs(x) < letterWidth * 0.5;
    const planet: Ornament = {
      kind: "planet",
      id: nextId(),
      x,
      y,
      radius,
      style: PLANET_STYLES[Math.floor(random() * PLANET_STYLES.length)],
      tint: random() < 0.6 ? "primary" : "secondary",
      tilt: (random() - 0.5) * 1.2,
      moonAngle: random() * 6.28,
      craterAngle: random() * 6.28,
      layer: overLetter ? (random() < 0.2 ? 1 : 0) : random() < 0.6 ? 1 : 0,
      delay: delay + i * (80 + random() * 160),
    };
    out.push(planet);
    placed.push(planet);
  }
}

function addStars(
  random: Random,
  out: Ornament[],
  nextId: () => number,
  letterWidth: number,
  count: number,
  delay: number,
) {
  for (let i = 0; i < count; i++) {
    const roll = random(),
      shape = roll < 0.45 ? "sparkle" : roll < 0.8 ? "dot" : "cross";
    const size =
      shape === "sparkle"
        ? 0.03 + random() * 0.05
        : shape === "dot"
          ? 0.008 + random() * 0.014
          : 0.02 + random() * 0.03;
    out.push({
      kind: "star",
      id: nextId(),
      shape,
      x: (random() - 0.5) * letterWidth * 2.1,
      y: -0.45 + (random() - 0.5) * 2.4,
      size,
      twinklePhase: random() * 6.28,
      twinkleSpeed: 1.5 + random() * 3.5,
      rotation: random() * 0.8,
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
  addPlanets(
    random,
    ornaments,
    nextId,
    width,
    1 +
      (random() < 0.6 * density ? 1 : 0) +
      (random() < 0.25 * density ? 1 : 0),
    40,
    letter.indexInWord === 0,
  );
  addStars(
    random,
    ornaments,
    nextId,
    width,
    Math.round((3 + random() * 5) * density),
    0,
  );
  return { ornaments, tendril: [] };
}

// a word is finished: one more planet and a few extra stars
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
  addPlanets(random, ornaments, nextId, width, 1, startsAfter + 40);
  addStars(
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
// star outline alternating outer and inner points
const starPoints = (
  x: number,
  y: number,
  radius: number,
  innerRatio = 0.22,
  pointCount = 8,
  rotation = 0,
) => {
  const points: Point[] = [];
  for (let k = 0; k < pointCount; k++) {
    const angle = (k / pointCount) * Math.PI * 2 - Math.PI / 2 + rotation,
      r = k % 2 ? radius * innerRatio : radius;
    points.push([x + Math.cos(angle) * r, y + Math.sin(angle) * r]);
  }
  return points;
};
// half of a tilted ring: back = upper half (behind the planet), front = lower half
const ringHalf = (
  x: number,
  y: number,
  radius: number,
  tilt: number,
  front: boolean,
) => {
  const points: Point[] = [],
    c = Math.cos(tilt),
    s = Math.sin(tilt);
  for (let k = 0; k <= 20; k++) {
    const t = (front ? 0 : Math.PI) + (k / 20) * Math.PI,
      rx = Math.cos(t) * radius * 1.7,
      ry = Math.sin(t) * radius * 0.45;
    points.push([x + rx * c - ry * s, y + rx * s + ry * c]);
  }
  return points;
};

// ponytail: twinkle and moon orbit run on age, so poster loops can seam slightly; derive from loop phase if exports must be perfect
const draw: Theme["draw"] = {
  star(painter, star, drawing) {
    const grown =
      springIn((drawing.age - star.delay) / 1000, 7, 15) * drawing.vitality;
    if (grown <= 0) return;
    const center = drawing.toScreen(star.x!, star.y!),
      twinkle =
        0.7 +
        0.3 *
          Math.sin(
            (drawing.age / 1000) * star.twinkleSpeed + star.twinklePhase,
          );
    const radius = star.size * drawing.fontSize * grown * twinkle;
    if (star.shape === "dot")
      painter.fill(
        ellipsePoints(center[0], center[1], radius, radius, 10),
        drawing.colors.text,
      );
    else if (star.shape === "cross")
      painter.fill(
        starPoints(center[0], center[1], radius, 0.12, 8, star.rotation),
        drawing.colors.accent,
      );
    else
      painter.fill(
        starPoints(center[0], center[1], radius),
        drawing.colors.accent,
      );
  },
  planet(painter, planet, drawing) {
    const grown =
      springIn((drawing.age - planet.delay) / 1000, 6, 12) * drawing.vitality;
    if (grown <= 0) return;
    const colors = drawing.colors,
      bodyColor = colors[planet.tint as "primary" | "secondary"],
      center = drawing.toScreen(planet.x!, planet.y!),
      radius = planet.radius * drawing.fontSize * grown;
    const pointerTilt = drawing.pointerTilt
        ? drawing.pointerTilt(center)
        : null,
      tilt =
        planet.tilt +
        drawing.extraRotation +
        (pointerTilt ? pointerTilt[0] * 0.3 : 0),
      lineWidth = Math.max(1, radius * 0.08);
    const [x, y] = center;
    if (drawing.offerPerch && drawing.age - planet.delay > 700)
      drawing.offerPerch(center, radius);
    if (planet.style === "ring")
      painter.stroke(
        ringHalf(x, y, radius, tilt, false),
        colors.accent,
        lineWidth,
      );
    painter.fill(ellipsePoints(x, y, radius, radius, 24), bodyColor);
    if (planet.style === "bands")
      for (const offset of [-0.45, 0.05, 0.5]) {
        const halfWidth = radius * Math.sqrt(1 - offset * offset) * 0.92;
        painter.fill(
          ellipsePoints(
            x,
            y + offset * radius,
            halfWidth,
            radius * 0.08,
            16,
            tilt * 0.3,
          ),
          colors.accent,
        );
      }
    if (planet.style === "crater")
      for (let k = 0; k < 3; k++) {
        const angle = planet.craterAngle + k * 2.1,
          distance = radius * (0.25 + 0.2 * k);
        painter.fill(
          ellipsePoints(
            x + Math.cos(angle) * distance,
            y + Math.sin(angle) * distance,
            radius * (0.2 - k * 0.04),
            radius * (0.16 - k * 0.03),
            12,
          ),
          colors.background,
        );
      }
    if (planet.style === "plain")
      painter.fill(
        ellipsePoints(
          x - radius * 0.3,
          y - radius * 0.25,
          radius * 0.18,
          radius * 0.14,
          12,
        ),
        colors.background,
      );
    if (planet.style === "ring")
      painter.stroke(
        ringHalf(x, y, radius, tilt, true),
        colors.accent,
        lineWidth,
      );
    if (planet.style === "moon") {
      const angle = planet.moonAngle + (drawing.age / 1000) * 0.6,
        moonRadius = radius * 0.28;
      painter.fill(
        ellipsePoints(
          x + Math.cos(angle) * radius * 1.6,
          y + Math.sin(angle) * radius * 0.6,
          moonRadius,
          moonRadius,
          12,
        ),
        colors.accent,
      );
    }
  },
};

function drawUfo(
  painter: Painter,
  x: number,
  y: number,
  size: number,
  angle: number,
  wingOpen: number,
  colors: Palette,
) {
  const cos = Math.cos(angle),
    sin = Math.sin(angle),
    local = (px: number, py: number): Point => [
      x + (px * cos - py * sin) * size,
      y + (px * sin + py * cos) * size,
    ];
  const dome: Point[] = [];
  for (let k = 0; k <= 12; k++) {
    const t = Math.PI + (k / 12) * Math.PI;
    dome.push(local(Math.cos(t) * 0.38, -0.08 + Math.sin(t) * 0.42));
  }
  painter.fill(dome, colors.accent);
  const saucer: Point[] = [];
  for (let k = 0; k < 24; k++) {
    const t = (k / 24) * Math.PI * 2;
    saucer.push(local(Math.cos(t) * 0.95, Math.sin(t) * 0.24));
  }
  painter.fill(saucer, colors.secondary);
  // three lights blink in sequence, driven by the visitor's flap cycle
  for (let i = -1; i <= 1; i++)
    if ((wingOpen + i * 0.33 + 1) % 1 > 0.4) {
      const light = local(i * 0.5, 0.02);
      painter.fill(
        ellipsePoints(light[0], light[1], size * 0.09, size * 0.09, 10),
        colors.primary,
      );
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

const space: Theme = {
  id: "space",
  name: "Space",
  visitorName: "UFO",
  typingHint: "type to launch",
  palettes: [
    palette("Deep", "#05060F", "#FFB84D", "#6C7BFF", "#FFFFFF", "#FFFFFF"),
    palette("Nebula", "#1A0B2E", "#FF5DA2", "#7AE7FF", "#FFF3B0", "#FFFFFF"),
    palette("Mono", "#000000", "#F2F2F2", "#6E6E6E", "#FFFFFF", "#FFFFFF"),
  ],
  growLetter,
  growWordEnd,
  draw,
  ornamentRadius: (o) => (o.kind === "planet" ? o.radius * 1.8 : o.size),
  drawVisitor: drawUfo,
};
export default space;
