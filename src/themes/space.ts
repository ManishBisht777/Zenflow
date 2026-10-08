// Space: no stems — planets and stars float freely around each letter. UFO visitor.
import { seededRandom, springIn, ellipsePoints } from "../engine/kit.ts";
import type {
  Painter,
  GrowContext,
  Letter,
  Ornament,
  Palette,
  Point,
  Drawing,
  Theme,
} from "../engine/types.ts";

// ---------- generation ----------
type Random = () => number;
const PLANET_STYLES = ["plain", "ring", "bands", "crater", "moon"] as const;
const SPACECRAFT = ["rocket", "ship", "astronaut"] as const;

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
      layer: overLetter ? 0 : random() < 0.6 ? 1 : 0,
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

function addTravelers(
  random: Random,
  out: Ornament[],
  nextId: () => number,
  letterWidth: number,
  count: number,
  delay: number,
) {
  for (let i = 0; i < count; i++) {
    const kind = SPACECRAFT[Math.floor(random() * SPACECRAFT.length)];
    out.push({
      kind,
      id: nextId(),
      x: (random() - 0.5) * letterWidth * 1.9,
      y: -0.35 + (random() - 0.5) * 2.1,
      size: kind === "astronaut" ? 0.12 + random() * 0.04 : 0.11 + random() * 0.08,
      angle: (random() - 0.5) * 1.1,
      tint: random() < 0.5 ? "primary" : "secondary",
      layer: 0,
      delay: delay + i * (120 + random() * 180),
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
    2 +
      (random() < 0.6 * density ? 1 : 0) +
      (random() < 0.45 * density ? 1 : 0) +
      (random() < 0.2 * density ? 1 : 0),
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
  addTravelers(
    random,
    ornaments,
    nextId,
    width,
    1 + (random() < 0.38 * density ? 1 : 0),
    180,
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
  addPlanets(random, ornaments, nextId, width, 2 + (random() < 0.55 ? 1 : 0), startsAfter + 40);
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
  rocket(painter, item, drawing) { drawRocket(painter, item, drawing); },
  ship(painter, item, drawing) { drawShip(painter, item, drawing); },
  astronaut(painter, item, drawing) { drawAstronaut(painter, item, drawing); },
};

function withLocal(
  painter: Painter,
  item: Ornament,
  drawing: Drawing,
  paint: (p: Painter, x: number, y: number, size: number, angle: number, colors: Palette) => void,
) {
  const grown = springIn((drawing.age - item.delay) / 1000, 7, 14) * drawing.vitality;
  if (grown <= 0) return;
  const [x, y] = drawing.toScreen(item.x!, item.y!);
  paint(painter, x, y, item.size * drawing.fontSize * grown, item.angle, drawing.colors);
}

function localPoint(x: number, y: number, size: number, angle: number, px: number, py: number): Point {
  const cos = Math.cos(angle), sin = Math.sin(angle);
  return [x + (px * cos - py * sin) * size, y + (px * sin + py * cos) * size];
}

function drawRocket(painter: Painter, item: Ornament, drawing: Drawing) {
  withLocal(painter, item, drawing, (p, x, y, size, angle, colors) => {
    const poly = (points: Point[]) => points.map(([px, py]) => localPoint(x, y, size, angle, px, py));
    p.fill(poly([[-0.28, 0.5], [0, -0.65], [0.28, 0.5], [0, 0.34]]), colors[item.tint as "primary" | "secondary"]);
    p.fill(poly([[-0.23, 0.27], [-0.55, 0.62], [-0.12, 0.49]]), colors.accent);
    p.fill(poly([[0.23, 0.27], [0.55, 0.62], [0.12, 0.49]]), colors.accent);
    const window = localPoint(x, y, size, angle, 0, -0.12);
    p.fill(ellipsePoints(window[0], window[1], size * 0.12, size * 0.12, 12), colors.background);
    p.fill(poly([[-0.13, 0.48], [0, 0.95], [0.13, 0.48]]), colors.primary);
  });
}

function drawShip(painter: Painter, item: Ornament, drawing: Drawing) {
  withLocal(painter, item, drawing, (p, x, y, size, angle, colors) => {
    const pt = ([px, py]: Point) => localPoint(x, y, size, angle, px, py);
    p.fill([pt([-0.8, 0.1]), pt([-0.35, -0.23]), pt([0.1, -0.63]), pt([0.58, -0.15]), pt([0.76, 0.16]), pt([0.2, 0.36]), pt([-0.53, 0.3])], colors[item.tint as "primary" | "secondary"]);
    const window = pt([0.14, -0.14]);
    p.fill(ellipsePoints(window[0], window[1], size * 0.14, size * 0.14, 12), colors.accent);
    p.fill([pt([-0.35, 0.26]), pt([-0.05, 0.43]), pt([-0.52, 0.76])], colors.primary);
  });
}

function drawAstronaut(painter: Painter, item: Ornament, drawing: Drawing) {
  withLocal(painter, item, drawing, (p, x, y, size, angle, colors) => {
    const pt = ([px, py]: Point) => localPoint(x, y, size, angle, px, py);
    const suit = colors[item.tint as "primary" | "secondary"];
    let center = pt([0, -0.3]);
    p.fill(ellipsePoints(center[0], center[1], size * 0.34, size * 0.36, 16), suit);
    center = pt([0, -0.32]);
    p.fill(ellipsePoints(center[0], center[1], size * 0.2, size * 0.19, 16), colors.accent);
    p.fill([pt([-0.23, -0.02]), pt([0.23, -0.02]), pt([0.3, 0.47]), pt([-0.3, 0.47])], suit);
    const width = Math.max(1, size * 0.12);
    p.stroke([pt([-0.29, 0.08]), pt([-0.48, 0.33]), pt([-0.35, 0.48])], colors.accent, width);
    p.stroke([pt([0.29, 0.08]), pt([0.48, 0.33]), pt([0.35, 0.48])], colors.accent, width);
    p.stroke([pt([-0.17, 0.42]), pt([-0.28, 0.72])], colors.accent, width);
    p.stroke([pt([0.17, 0.42]), pt([0.28, 0.72])], colors.accent, width);
  });
}

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
    palette("Deep Space", "#090B24", "#FF9F68", "#6685FF", "#8FE8E1", "#F1ECFF"),
    palette("Nebula", "#170923", "#FF5DA2", "#55D6F5", "#FFE18A", "#F7EAFE"),
    palette("Aurora", "#071A2A", "#55E0BD", "#A27BFF", "#FFCA72", "#EAF5FF"),
  ],
  growLetter,
  growWordEnd,
  draw,
  ornamentRadius: (o) => (o.kind === "planet" ? o.radius * 1.8 : o.size * 1.5),
  drawVisitor: drawUfo,
};
export default space;
