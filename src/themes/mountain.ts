// Mountain: snow-capped peaks rise behind the type, pines grow along the baseline, clouds drift, a sun per word. Eagle visitor.
import {
  seededRandom,
  springIn,
  ellipsePoints,
  withSharpCorners,
} from "../engine/kit.ts";
import type {
  Painter,
  GrowContext,
  Letter,
  Ornament,
  Palette,
  Point,
  Theme,
} from "../engine/types.ts";

// mountain palettes carry rock faces (lit, shaded), snow, pine, trunk, cloud and sun
interface MountainPalette extends Palette {
  rock: [lit: string, shaded: string];
  snow: string;
  pine: string;
  trunk: string;
  cloud: string;
  sun: string;
}
const mountainColors = (colors: Palette) => colors as MountainPalette;

// ---------- generation ----------
type Random = () => number;

function createPeak(
  random: Random,
  nextId: () => number,
  x: number,
  width: number,
  height: number,
  delay: number,
): Ornament {
  return {
    kind: "peak",
    id: nextId(),
    x,
    y: 0.06,
    width,
    height,
    summitOffset: (random() - 0.5) * 0.25, // summit shifted left/right of centre
    ridgeJitter: Array.from({ length: 4 }, () => (random() - 0.5) * 0.12), // bumps along both ridges
    snowLine: 0.3 + random() * 0.2,
    layer: 0,
    delay,
  };
}
function createPine(
  random: Random,
  nextId: () => number,
  x: number,
  letterWidth: number,
  delay: number,
): Ornament {
  const overLetter = Math.abs(x) < letterWidth * 0.45;
  return {
    kind: "pine",
    id: nextId(),
    x,
    y: 0.07,
    height: 0.18 + random() * 0.3,
    tiers: 3 + (random() < 0.4 ? 1 : 0),
    layer: overLetter ? (random() < 0.2 ? 1 : 0) : random() < 0.7 ? 1 : 0,
    delay,
  };
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
  // tall peaks first so smaller ones sit in front of them
  const peakCount = 1 + (random() < 0.25 * density ? 1 : 0);
  const plans = Array.from({ length: peakCount }, () => ({
    x: (random() - 0.5) * width * 1.1,
    width: 0.42 + random() * 0.5,
    height: 0.32 + random() * 0.58 + (letter.indexInWord === 0 ? 0.12 : 0),
  }));
  plans
    .sort((a, b) => b.height - a.height)
    .forEach((plan, i) =>
      ornaments.push(
        createPeak(
          random,
          nextId,
          plan.x,
          plan.width,
          plan.height,
          30 + i * 150,
        ),
      ),
    );
  const pineCount = Math.round((1 + random() * 2) * density);
  for (let i = 0; i < pineCount; i++)
    ornaments.push(
      createPine(
        random,
        nextId,
        (random() - 0.5) * width * 1.4,
        width,
        350 + i * 120 + random() * 200,
      ),
    );
  if (random() < 0.3 * density)
    ornaments.push({
      kind: "cloud",
      id: nextId(),
      x: (random() - 0.5) * width * 1.5,
      y: -1.05 - random() * 0.45,
      radius: 0.07 + random() * 0.07,
      driftSpeed: 0.2 + random() * 0.3,
      driftPhase: random() * 6.28,
      layer: random() < 0.5 ? 0 : 1,
      delay: random() * 600,
    });
  if (random() < 0.55 * density)
    ornaments.push({
      kind: "bird",
      id: nextId(),
      x: (random() - 0.5) * width * 1.7,
      y: -1.05 - random() * 0.55,
      size: 0.07 + random() * 0.04,
      angle: (random() - 0.5) * 0.3,
      layer: 1,
      delay: 150 + random() * 700,
    });
  const flowerCount = random() < 0.8 * density ? 1 + (random() < 0.35 ? 1 : 0) : 0;
  for (let i = 0; i < flowerCount; i++)
    ornaments.push({
      kind: "wildflower",
      id: nextId(),
      x: (random() - 0.5) * width * 1.25,
      y: 0.12 + random() * 0.14,
      size: 0.07 + random() * 0.04,
      tint: random() < 0.5 ? "sun" : "snow",
      layer: 1,
      delay: 380 + i * 160 + random() * 250,
    });
  if (letter.indexInWord === 0 && random() < 0.45)
    ornaments.push({
      kind: "sun",
      id: nextId(),
      x: (random() - 0.5) * width,
      y: -1.45 - random() * 0.2,
      radius: 0.12 + random() * 0.06,
      layer: 0,
      delay: 0,
    });
  return { ornaments, tendril: [] };
}

// a word is finished: one big peak with a few pines at its foot
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
  ornaments.push(
    createPeak(
      random,
      nextId,
      (random() - 0.3) * width * 0.8,
      0.9 + random() * 0.5,
      0.95 + random() * 0.28,
      startsAfter + 40,
    ),
  );
  for (let i = 0; i < 2; i++)
    ornaments.push(
      createPine(
        random,
        nextId,
        (random() - 0.5) * width * 1.6,
        width,
        startsAfter + 400 + i * 120,
      ),
    );
  return ornaments;
}

// ---------- drawing ----------
const lerpPoint = (a: Point, b: Point, t: number): Point => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
];

// ponytail: clouds drift on age, so poster loops can seam slightly; derive from loop phase if exports must be perfect
const draw: Theme["draw"] = {
  peak(painter, peak, drawing) {
    const grown =
      springIn((drawing.age - peak.delay) / 1000, 3.5, 7) * drawing.vitality;
    if (grown <= 0) return;
    const colors = mountainColors(drawing.colors),
      x = peak.x!,
      base = peak.y!,
      height = peak.height * Math.max(0, grown),
      halfWidth = peak.width / 2,
      jitter = peak.ridgeJitter as number[];
    const at = (dx: number, up: number) => drawing.toScreen(x + dx, base - up); // dx across, up above the base
    const summit = at(peak.summitOffset * peak.width, height),
      leftFoot = at(-halfWidth, 0),
      rightFoot = at(halfWidth, 0);
    const leftLow = at(
        -halfWidth * 0.62 + jitter[0] * peak.width,
        height * (0.38 + jitter[1]),
      ),
      leftHigh = at(
        -halfWidth * 0.3 + peak.summitOffset * peak.width * 0.5,
        height * (0.72 + jitter[2] * 0.5),
      );
    const rightHigh = at(
        halfWidth * 0.3 + peak.summitOffset * peak.width * 0.5,
        height * (0.7 - jitter[2] * 0.5),
      ),
      rightLow = at(
        halfWidth * 0.6 - jitter[3] * peak.width,
        height * (0.4 + jitter[3]),
      );
    painter.fill(
      withSharpCorners([
        leftFoot,
        leftLow,
        leftHigh,
        summit,
        rightHigh,
        rightLow,
        rightFoot,
      ]),
      colors.rock[0],
    );
    // shaded face: from the summit down to a valley a little right of centre
    const valley = at(peak.summitOffset * peak.width + halfWidth * 0.18, 0);
    painter.fill(
      withSharpCorners([
        summit,
        rightHigh,
        rightLow,
        rightFoot,
        valley,
        lerpPoint(summit, valley, 0.55),
      ]),
      colors.rock[1],
    );
    // snow cap with a zigzag lower edge
    if (grown > 0.3) {
      const reach = Math.min(1, peak.snowLine * 1.6),
        snowLeft = lerpPoint(summit, leftHigh, reach),
        snowRight = lerpPoint(summit, rightHigh, reach),
        zigzag: Point[] = [];
      for (let k = 1; k < 6; k++) {
        const m = lerpPoint(snowRight, snowLeft, k / 6);
        zigzag.push([
          m[0],
          m[1] + (k % 2 ? 1 : -0.3) * drawing.fontSize * height * 0.06,
        ]);
      }
      painter.fill(
        withSharpCorners([snowLeft, summit, snowRight, ...zigzag]),
        colors.snow,
      );
    }
    if (drawing.offerPerch && drawing.age - peak.delay > 1200)
      drawing.offerPerch(
        [summit[0], summit[1] + drawing.fontSize * 0.05],
        drawing.fontSize * 0.1,
      );
  },
  pine(painter, pine, drawing) {
    const grown =
      springIn((drawing.age - pine.delay) / 1000, 6, 11) * drawing.vitality;
    if (grown <= 0) return;
    const colors = mountainColors(drawing.colors),
      x = pine.x!,
      base = pine.y!,
      height = pine.height * grown,
      tiers = pine.tiers as number;
    const at = (dx: number, up: number) => drawing.toScreen(x + dx, base - up);
    painter.fill(
      withSharpCorners([
        at(-0.012, -0.01),
        at(-0.012, height * 0.2),
        at(0.012, height * 0.2),
        at(0.012, -0.01),
      ]),
      colors.trunk,
    );
    for (let i = 0; i < tiers; i++) {
      const tierBase = height * (0.15 + (i * 0.8) / tiers),
        tierHalfWidth = height * 0.36 * (1 - i / (tiers + 0.6));
      painter.fill(
        withSharpCorners([
          at(-tierHalfWidth, tierBase),
          at(0, tierBase + height * 0.42),
          at(tierHalfWidth, tierBase),
        ]),
        colors.pine,
      );
    }
    if (
      drawing.offerPerch &&
      drawing.age - pine.delay > 700 &&
      pine.height > 0.3
    ) {
      const top = at(0, height * 1.02);
      drawing.offerPerch(
        [top[0], top[1] + drawing.fontSize * 0.04],
        drawing.fontSize * 0.07,
      );
    }
  },
  bird(painter, bird, drawing) {
    const grown = springIn((drawing.age - bird.delay) / 1000, 7, 14) * drawing.vitality;
    if (grown <= 0) return;
    const center = drawing.toScreen(bird.x!, bird.y!),
      size = bird.size * drawing.fontSize * grown,
      angle = bird.angle + drawing.extraRotation,
      cos = Math.cos(angle),
      sin = Math.sin(angle),
      point = (x: number, y: number): Point => [
        center[0] + (x * cos - y * sin) * size,
        center[1] + (x * sin + y * cos) * size,
      ];
    painter.stroke(
      [point(-1, 0.2), point(-0.45, -0.25), point(0, 0.2), point(0.45, -0.25), point(1, 0.2)],
      mountainColors(drawing.colors).trunk,
      Math.max(1, size * 0.12),
    );
  },
  wildflower(painter, flower, drawing) {
    const grown = springIn((drawing.age - flower.delay) / 1000, 7, 14) * drawing.vitality;
    if (grown <= 0) return;
    const center = drawing.toScreen(flower.x!, flower.y!),
      size = flower.size * drawing.fontSize * grown,
      colors = mountainColors(drawing.colors),
      top = drawing.toScreen(flower.x!, flower.y! - 0.18 * grown);
    painter.stroke(
      [drawing.toScreen(flower.x!, flower.y! + 0.12), top],
      colors.pine,
      Math.max(1, size * 0.1),
    );
    for (let i = 0; i < 5; i++) {
      const angle = (i / 5) * Math.PI * 2;
      painter.fill(
        ellipsePoints(
          top[0] + Math.cos(angle) * size * 0.34,
          top[1] + Math.sin(angle) * size * 0.34,
          size * 0.25,
          size * 0.25,
          10,
        ),
        colors[flower.tint as "sun" | "snow"],
      );
    }
    painter.fill(
      ellipsePoints(top[0], top[1], size * 0.15, size * 0.15, 10),
      colors.sun,
    );
  },
  cloud(painter, cloud, drawing) {
    const grown =
      springIn((drawing.age - cloud.delay) / 1000, 5, 9) * drawing.vitality;
    if (grown <= 0) return;
    const drift =
        Math.sin((drawing.age / 1000) * cloud.driftSpeed + cloud.driftPhase) *
        0.12,
      center = drawing.toScreen(cloud.x! + drift, cloud.y!),
      radius = cloud.radius * drawing.fontSize * grown;
    for (const [dx, dy, scale] of [
      [-1.1, 0.15, 0.6],
      [-0.3, -0.05, 0.85],
      [0.6, 0.05, 0.75],
      [1.3, 0.2, 0.5],
    ]) {
      painter.fill(
        ellipsePoints(
          center[0] + dx * radius,
          center[1] + dy * radius,
          radius * scale * 1.2,
          radius * scale * 0.7,
          14,
        ),
        mountainColors(drawing.colors).cloud,
      );
    }
  },
  sun(painter, sun, drawing) {
    const grown =
      springIn((drawing.age - sun.delay) / 1000, 4, 8) * drawing.vitality;
    if (grown <= 0) return;
    const center = drawing.toScreen(sun.x!, sun.y!),
      radius = sun.radius * drawing.fontSize * grown;
    painter.fill(
      ellipsePoints(center[0], center[1], radius, radius, 28),
      mountainColors(drawing.colors).sun,
    );
  },
};

function drawEagle(
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
  const wingLift = (wingOpen - 0.45) * 0.9,
    bodyColor = mountainColors(colors).trunk;
  for (const side of [-1, 1]) {
    // broad wing with fingered tips
    painter.fill(
      [
        local(side * 0.1, -0.05),
        local(side * 0.6, -wingLift - 0.1),
        local(side * 1.15, -wingLift * 1.3 - 0.05),
        local(side * 1.05, -wingLift * 1.2 + 0.08),
        local(side * 1.1, -wingLift * 1.1 + 0.16),
        local(side * 0.55, -wingLift * 0.5 + 0.2),
        local(side * 0.1, 0.15),
      ],
      bodyColor,
    );
  }
  painter.fill(
    ellipsePoints(...local(0, 0.08), size * 0.16, size * 0.4, 14, angle),
    bodyColor,
  ); // body
  painter.fill(
    ellipsePoints(...local(0, -0.32), size * 0.13, size * 0.13, 12),
    mountainColors(colors).snow,
  ); // white head
  painter.fill(
    [local(-0.12, 0.45), local(0, 0.62), local(0.12, 0.45)],
    bodyColor,
  ); // tail
}

const palette = (
  name: string,
  background: string,
  rock: [string, string],
  snow: string,
  pine: string,
  trunk: string,
  cloud: string,
  sun: string,
  text: string,
): MountainPalette => ({
  name,
  background,
  primary: sun,
  secondary: pine,
  accent: sun,
  text,
  rock,
  snow,
  pine,
  trunk,
  cloud,
  sun,
});

const mountain: Theme = {
  id: "mountain",
  name: "Mountain",
  visitorName: "Eagle",
  grounded: true,
  typingHint: "type to climb",
  palettes: [
    //       name      background rock lit / shaded         snow       pine       trunk      cloud      sun        text
    palette(
      "Alpine",
      "#CFE8F7",
      ["#8496B0", "#5E6E8A"],
      "#FFFFFF",
      "#1F5E3B",
      "#5B3A21",
      "#FFFFFF",
      "#FFD166",
      "#13233A",
    ),
    palette(
      "Dawn",
      "#FBD3C1",
      ["#B07A8C", "#8A5A70"],
      "#FFF4EC",
      "#3E5B4A",
      "#5B3A21",
      "#FFE9DF",
      "#FF8A5B",
      "#2A1420",
    ),
    palette(
      "Forest",
      "#E7F0E4",
      ["#7D8E78", "#596956"],
      "#FFFFFF",
      "#1E4D2B",
      "#4A2E1A",
      "#FFFFFF",
      "#F2B134",
      "#122017",
    ),
    palette(
      "Night",
      "#0E1430",
      ["#2C3A63", "#1E2848"],
      "#DDE6FF",
      "#1C3B33",
      "#2A1F1A",
      "#1B2346",
      "#F4F1DE",
      "#E6ECFF",
    ),
    palette(
      "Mono",
      "#000000",
      ["#3A3A3A", "#262626"],
      "#F2F2F2",
      "#6E6E6E",
      "#4A4A4A",
      "#1A1A1A",
      "#D0D0D0",
      "#FFFFFF",
    ),
  ],
  growLetter,
  growWordEnd,
  draw,
  ornamentRadius: (o) =>
    o.kind === "peak"
      ? Math.max(o.height, o.width / 2)
      : o.kind === "pine"
        ? o.height
        : o.kind === "wildflower" || o.kind === "bird"
          ? o.size * 1.8
        : o.kind === "cloud"
          ? o.radius * 2
          : o.radius,
  drawVisitor: drawEagle,
};
export default mountain;
