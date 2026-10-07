// Floral script: each letter is drawn out of small watercolor flowers packed along its stroke (no solid text),
// with a few loose blooms, leaves and sprigs scattered around. Bee visitor.
import { seededRandom, springIn, ellipsePoints } from "../engine/kit.ts";
import type {
  Painter,
  Drawing,
  GrowContext,
  Letter,
  Ornament,
  Palette,
  Point,
  Theme,
} from "../engine/types.ts";

// floral palettes: paper, a set of petal colors, plus the small supporting colors
interface FloralPalette extends Palette {
  petals: string[];
  forgetMeNot: string;
  leaf: string;
  lavender: string;
  flowerCenter: string;
  rose: string;
  breath: string;
  breathOutline: string;
}
const floralColors = (colors: Palette) => colors as FloralPalette;
// soft, slightly see-through fills so overlapping petals read like watercolor
const wash = (color: string, alpha = "D9") =>
  color.length === 7 ? color + alpha : color;

// ---------- generation ----------
type Random = () => number;
const FLOWER_SPACING = 0.04; // type units between flower centres along the stroke
const STROKE_THICKEN = 0.03; // widen the letter shape so flowers have a band to follow
// what sits on the stroke, by chance; drawn back to front in this order
const STROKE_MIX: [kind: string, chance: number][] = [
  ["leaf", 0.1],
  ["lavender", 0.05],
  ["babysBreath", 0.06],
  ["forgetMeNot", 0.2],
  ["blossom", 0.47],
  ["rose", 0.12],
];
const DRAW_ORDER = [
  "leaf",
  "lavender",
  "babysBreath",
  "forgetMeNot",
  "blossom",
  "rose",
];

const pickKind = (random: Random) => {
  let roll = random();
  for (const [kind, chance] of STROKE_MIX) {
    if (roll < chance) return kind;
    roll -= chance;
  }
  return "blossom";
};

function createFlower(
  random: Random,
  nextId: () => number,
  kind: string,
  x: number,
  y: number,
  delay: number,
  scale = 1,
): Ornament {
  const radius =
    (kind === "rose"
      ? 0.032 + random() * 0.012
      : kind === "forgetMeNot"
        ? 0.03
        : kind === "leaf"
          ? 0.032 + random() * 0.016
          : kind === "lavender"
            ? 0.06 + random() * 0.025
            : kind === "babysBreath"
              ? 0.032
              : 0.026 + random() * 0.016) * scale;
  return {
    kind,
    id: nextId(),
    x,
    y,
    radius,
    rotation: random() * Math.PI * 2,
    colorSeed: Math.floor(random() * 1e4),
    layer: 1,
    delay,
  };
}

// Fills the letter's shape: walks its interior points in random order and keeps those far enough from every kept one
// (a cheap Poisson-disk), then blooms them left to right so the letter looks hand-lettered.
function growLetter(letter: Letter, grow: GrowContext) {
  const random = seededRandom(
    (letter.wordSeed ^ Math.imul(letter.indexInWord + 1, 2654435761)) +
      Math.floor(grow.random() * 1e6),
  );
  let idCounter = 0;
  const nextId = () => letter.id * 100 + idCounter++;
  const interior = grow.glyphInterior(letter.char, STROKE_THICKEN).slice();
  for (let i = interior.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [interior[i], interior[j]] = [interior[j], interior[i]];
  }
  const centres: Point[] = [];
  for (const p of interior)
    if (
      centres.every(
        (c) => Math.hypot(c[0] - p[0], c[1] - p[1]) >= FLOWER_SPACING,
      )
    )
      centres.push(p);
  centres.sort((a, b) => a[0] + a[1] * 0.25 - (b[0] + b[1] * 0.25)); // writing order: left to right, slightly top first
  const writeDuration = 650;
  const onStroke = centres.map((c, i) =>
    createFlower(
      random,
      nextId,
      pickKind(random),
      c[0],
      c[1],
      20 + (i * writeDuration) / Math.max(1, centres.length),
    ),
  );

  // a loose bloom or sprig floating near the letter, kept clear of the stroke
  const loose: Ornament[] = [];
  const width = grow.glyphWidth(letter.char);
  if (random() < 0.55 * grow.density) {
    for (let attempt = 0; attempt < 8; attempt++) {
      const x = (random() - 0.5) * width * 2,
        y = -0.4 + (random() - 0.5) * 1.5;
      if (
        interior.some(
          (p, i) => i % 4 === 0 && Math.hypot(p[0] - x, p[1] - y) < 0.16,
        )
      )
        continue;
      const roll = random(),
        kind =
          roll < 0.5
            ? "blossom"
            : roll < 0.75
              ? "leaf"
              : roll < 0.9
                ? "lavender"
                : "rose";
      loose.push(
        createFlower(
          random,
          nextId,
          kind,
          x,
          y,
          writeDuration + random() * 300,
          kind === "lavender" ? 1.6 : 1.4,
        ),
      );
      break;
    }
  }
  const ornaments = [...onStroke, ...loose].sort(
    (a, b) => DRAW_ORDER.indexOf(a.kind) - DRAW_ORDER.indexOf(b.kind),
  );
  return { ornaments, tendril: [] };
}

// a word is finished: a couple of loose blooms drift in around its last letter
function growWordEnd(letter: Letter, startsAfter: number, grow: GrowContext) {
  const random = seededRandom(
    letter.wordSeed + letter.indexInWord * 31 + Math.floor(grow.random() * 1e6),
  );
  let idCounter = 60;
  const nextId = () => letter.id * 100 + idCounter++;
  const width = grow.glyphWidth(letter.char),
    ornaments: Ornament[] = [];
  for (let i = 0; i < 2; i++) {
    const roll = random(),
      kind = roll < 0.55 ? "blossom" : roll < 0.8 ? "leaf" : "lavender";
    ornaments.push(
      createFlower(
        random,
        nextId,
        kind,
        width * (0.5 + random() * 0.6),
        -0.2 - random() * 1.0,
        startsAfter + 80 + i * 140,
        kind === "lavender" ? 1.6 : 1.4,
      ),
    );
  }
  return ornaments;
}

// ---------- drawing ----------
// shared setup: screen position, size (springs in, shrinks while withering), rotation, perch for the visitor
function basics(ornament: Ornament, drawing: Drawing, perchable = false) {
  const grown =
    springIn((drawing.age - ornament.delay) / 1000, 7, 13) * drawing.vitality;
  if (grown <= 0) return null;
  const center = drawing.toScreen(ornament.x!, ornament.y!),
    radius = ornament.radius * drawing.fontSize * grown;
  const tilt = drawing.pointerTilt ? drawing.pointerTilt(center) : null;
  if (
    perchable &&
    drawing.offerPerch &&
    drawing.age - ornament.delay > 700 &&
    ornament.radius > 0.05
  )
    drawing.offerPerch(center, radius);
  return {
    center,
    radius,
    grown,
    rotation:
      ornament.rotation +
      drawing.jitter[2] +
      drawing.extraRotation +
      (tilt ? tilt[0] * 0.3 : 0),
  };
}
const petalColor = (colors: Palette, ornament: Ornament) => {
  const options = floralColors(colors).petals;
  return options[ornament.colorSeed % options.length];
};

// five round petals around a centre (blossoms and forget-me-nots)
function fivePetals(
  painter: Painter,
  [x, y]: Point,
  radius: number,
  rotation: number,
  color: string,
  centerColor: string,
) {
  for (let k = 0; k < 5; k++) {
    const angle = rotation + (k / 5) * Math.PI * 2;
    painter.fill(
      ellipsePoints(
        x + Math.cos(angle) * radius * 0.52,
        y + Math.sin(angle) * radius * 0.52,
        radius * 0.5,
        radius * 0.42,
        14,
        angle,
      ),
      color,
    );
  }
  painter.fill(
    ellipsePoints(x, y, radius * 0.2, radius * 0.2, 10),
    centerColor,
  );
}

const draw: Theme["draw"] = {
  blossom(painter, blossom, drawing) {
    const b = basics(blossom, drawing, true);
    if (!b) return;
    fivePetals(
      painter,
      b.center,
      b.radius,
      b.rotation,
      wash(petalColor(drawing.colors, blossom)),
      floralColors(drawing.colors).flowerCenter,
    );
  },
  rose(painter, rose, drawing) {
    const b = basics(rose, drawing, true);
    if (!b) return;
    const colors = floralColors(drawing.colors),
      [x, y] = b.center;
    // layered cup: outer petals, a deeper inner bud, then a few curved petal edges
    painter.fill(
      ellipsePoints(x, y, b.radius, b.radius * 0.92, 18, b.rotation),
      wash(colors.rose),
    );
    painter.fill(
      ellipsePoints(
        x,
        y - b.radius * 0.05,
        b.radius * 0.55,
        b.radius * 0.5,
        14,
        b.rotation,
      ),
      wash(colors.accent, "55"),
    );
    if (b.radius > 4)
      for (const [r, start] of [
        [0.72, 0.4],
        [0.72, 3.4],
        [0.36, 1.9],
      ]) {
        const arc: Point[] = [];
        for (let i = 0; i <= 8; i++) {
          const angle = b.rotation + start + (i / 8) * 2.2;
          arc.push([
            x + Math.cos(angle) * b.radius * r,
            y + Math.sin(angle) * b.radius * r * 0.9,
          ]);
        }
        painter.stroke(
          arc,
          wash(colors.accent, "AA"),
          Math.max(0.6, b.radius * 0.08),
        );
      }
  },
  forgetMeNot(painter, cluster, drawing) {
    const b = basics(cluster, drawing);
    if (!b) return;
    const colors = floralColors(drawing.colors);
    // a little cluster of three
    for (let k = 0; k < 3; k++) {
      const angle = b.rotation + k * 2.1,
        at: Point = [
          b.center[0] + Math.cos(angle) * b.radius * 0.55,
          b.center[1] + Math.sin(angle) * b.radius * 0.55,
        ];
      fivePetals(
        painter,
        at,
        b.radius * 0.48,
        b.rotation + k,
        wash(colors.forgetMeNot),
        colors.flowerCenter,
      );
    }
  },
  leaf(painter, leaf, drawing) {
    const b = basics(leaf, drawing);
    if (!b) return;
    const cos = Math.cos(b.rotation),
      sin = Math.sin(b.rotation),
      [x, y] = b.center,
      length = b.radius * 1.2;
    const local = (along: number, across: number): Point => [
      x + (along * cos - across * sin) * length,
      y + (along * sin + across * cos) * length,
    ];
    const sideA: Point[] = [],
      sideB: Point[] = [];
    for (let i = 1; i < 10; i++) {
      const u = i / 10,
        w = 0.34 * Math.sin(Math.PI * u);
      sideA.push(local(-1 + 2 * u, w));
      sideB.push(local(-1 + 2 * u, -w));
    }
    painter.fill(
      [
        local(-1, 0),
        local(-1, 0),
        ...sideA,
        local(1, 0),
        local(1, 0),
        ...sideB.reverse(),
      ],
      wash(floralColors(drawing.colors).leaf),
    );
  },
  lavender(painter, sprig, drawing) {
    const b = basics(sprig, drawing);
    if (!b) return;
    const colors = floralColors(drawing.colors),
      cos = Math.cos(b.rotation),
      sin = Math.sin(b.rotation),
      [x, y] = b.center;
    const along = (t: number): Point => [
      x + cos * (t - 0.5) * b.radius * 2,
      y + sin * (t - 0.5) * b.radius * 2,
    ];
    painter.stroke(
      [along(0), along(1)],
      wash(colors.leaf),
      Math.max(0.8, b.radius * 0.06),
    );
    // buds alternate sides along the top two thirds, smaller towards the tip
    for (let i = 0; i < 7; i++) {
      const t = 0.35 + i * 0.1,
        side = i % 2 ? 1 : -1,
        size = b.radius * 0.13 * (1 - i * 0.07),
        p = along(t);
      painter.fill(
        ellipsePoints(
          p[0] - sin * side * size * 0.8,
          p[1] + cos * side * size * 0.8,
          size,
          size * 0.62,
          10,
          b.rotation,
        ),
        wash(colors.lavender),
      );
    }
  },
  babysBreath(painter, sprig, drawing) {
    const b = basics(sprig, drawing);
    if (!b) return;
    const colors = floralColors(drawing.colors),
      [x, y] = b.center;
    for (let k = 0; k < 5; k++) {
      const angle = b.rotation + (k - 2) * 0.5,
        tip: Point = [
          x + Math.cos(angle) * b.radius,
          y + Math.sin(angle) * b.radius,
        ];
      painter.stroke(
        [[x, y], tip],
        wash(colors.leaf, "99"),
        Math.max(0.5, b.radius * 0.04),
      );
      const dot = ellipsePoints(
        tip[0],
        tip[1],
        b.radius * 0.14,
        b.radius * 0.14,
        8,
      );
      painter.fill(dot, colors.breath);
      painter.stroke(
        [...dot, dot[0]],
        colors.breathOutline,
        Math.max(0.5, b.radius * 0.03),
      );
    }
  },
};

function drawBee(
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
  const floral = floralColors(colors),
    wingLength = 0.35 + 0.25 * wingOpen;
  painter.fill(
    ellipsePoints(
      ...local(-0.1, -0.42),
      size * 0.24,
      size * wingLength,
      12,
      angle - 0.4,
    ),
    "#FFFFFFCC",
  ); // wings
  painter.fill(
    ellipsePoints(
      ...local(0.2, -0.42),
      size * 0.22,
      size * wingLength * 0.9,
      12,
      angle + 0.4,
    ),
    "#FFFFFFCC",
  );
  painter.fill(
    ellipsePoints(...local(0, 0), size * 0.6, size * 0.4, 18, angle),
    floral.flowerCenter,
  ); // body
  for (const stripe of [-0.18, 0.12])
    painter.fill(
      ellipsePoints(...local(stripe, 0), size * 0.08, size * 0.36, 10, angle),
      colors.text,
    );
  painter.fill(
    ellipsePoints(...local(0.62, -0.02), size * 0.2, size * 0.2, 10),
    colors.text,
  ); // head
}

const palette = (
  name: string,
  background: string,
  petals: string[],
  forgetMeNot: string,
  leaf: string,
  lavender: string,
  flowerCenter: string,
  rose: string,
  roseLine: string,
  breath: string,
  breathOutline: string,
  text: string,
): FloralPalette => ({
  name,
  background,
  primary: petals[0],
  secondary: leaf,
  accent: roseLine,
  text,
  petals,
  forgetMeNot,
  leaf,
  lavender,
  flowerCenter,
  rose,
  breath,
  breathOutline,
});

const floral: Theme = {
  id: "floral",
  name: "Floral",
  visitorName: "Bee",
  typingHint: "type a name",
  replacesGlyphs: true,
  preferredFontId: "dancing",
  typeScale: 1.7,
  palettes: [
    //       name           paper      petals                                                    forget-me-not leaf      lavender   centre     rose       rose line  breath     outline    caret/text
    palette(
      "Watercolor",
      "#F8F4EE",
      ["#F6B9A6", "#F2A7BE", "#C9B3E6", "#F7DC8C", "#F9C79A"],
      "#A9CBEB",
      "#9DB59A",
      "#A38BD0",
      "#E8B04A",
      "#EFA3B5",
      "#C9718A",
      "#FFFFFF",
      "#C9C0B6",
      "#5B4B57",
    ),
    palette(
      "Blush",
      "#FBEDEB",
      ["#E98FA6", "#F4B6C2", "#F7CDB5", "#D9A5D3"],
      "#B9D3F0",
      "#8FAE8B",
      "#9C86C8",
      "#F0C05A",
      "#E7849C",
      "#B85A75",
      "#FFFFFF",
      "#D3B9B5",
      "#6B3B4A",
    ),
    palette(
      "Sage",
      "#EEF1E8",
      ["#F3C6A5", "#EBA9B5", "#FFFFFF", "#E9D79A"],
      "#AFC9E4",
      "#6F8F6B",
      "#9A84C4",
      "#D9A441",
      "#E9A0AE",
      "#B9677B",
      "#FFFFFF",
      "#B5BCAA",
      "#3E4A3A",
    ),
    palette(
      "Night garden",
      "#1D2433",
      ["#F6B9A6", "#F2A7BE", "#C9B3E6", "#F7DC8C"],
      "#9EC3EA",
      "#7FA38A",
      "#B49EE0",
      "#F2C14E",
      "#EFA3B5",
      "#B05A74",
      "#F5EFE6",
      "#7D8597",
      "#F5EFE6",
    ),
    palette(
      "Ink",
      "#FFFFFF",
      ["#2B2B2B", "#5A5A5A", "#8A8A8A"],
      "#6E6E6E",
      "#9A9A9A",
      "#4A4A4A",
      "#FFFFFF",
      "#3A3A3A",
      "#FFFFFF",
      "#FFFFFF",
      "#2B2B2B",
      "#111111",
    ),
  ],
  growLetter,
  growWordEnd,
  draw,
  ornamentRadius: (o) => o.radius * 1.2,
  drawVisitor: drawBee,
};
export default floral;
