// What grows from each letter: stems with leaves, thorns, flowers, curls; bridges between letters; word-end blooms.
import {
  seededRandom,
  wigglyPath,
  curlEnd,
  weaveSegments,
  layerAtFraction,
  pointAlong,
  cubicBezier,
} from "../../engine/kit.ts";
import type { GrowContext, Letter, Ornament, Point } from "../../engine/types.ts";

type Random = () => number;
// one word's "personality": every letter of the word grows with these
interface WordStyle {
  favoriteFlower: string;
  flowerChance: number; // chance a stem ends in a flower (vs leaves or a curl)
  leafiness: number;
  density: number;
  sizeScale: number;
  curviness: number;
  bridgeChance: number; // chance a letter sends a stem back to the previous letter
  letterWidth: number;
}
interface StemOptions {
  start?: Point;
  direction?: number;
  length?: number;
  path?: Point[]; // use this path instead of generating a wiggly one
  delay: number;
  tip?: string | null; // 'flower' | 'fan' | 'leaf' | 'curl'; random when omitted
  isBranch?: boolean; // side branches are thinner, shorter and don't branch again
  startLayer?: number;
}

const FLOWERS = ["rose", "daisy", "tulip", "poppy", "bluebell"];
const SMALL_FLOWERS = ["daisy", "poppy", "tulip"];
// each word leans towards one flower but mixes in the others
const pickFlower = (random: Random, word: WordStyle) =>
  random() < 0.5
    ? word.favoriteFlower
    : FLOWERS[Math.floor(random() * FLOWERS.length)];

const wordStyle = (wordSeed: number, density: number): WordStyle => {
  const random = seededRandom(wordSeed * 7 + 13);
  const favoriteFlower = FLOWERS[Math.floor(random() * FLOWERS.length)];
  const flowerChance = 0.6 + random() * 0.25;
  const leafiness = (0.35 + random() * 0.45) * density;
  random(); // retired "lean" value — still drawn so existing seeds grow the same gardens
  const sizeScale = 0.85 + random() * 0.45;
  const curviness = 0.8 + random() * 0.6;
  const bridgeChance = Math.min(0.95, (0.15 + random() * 0.25) * density);
  return {
    favoriteFlower,
    flowerChance,
    leafiness,
    density,
    sizeScale,
    curviness,
    bridgeChance,
    letterWidth: 0.5,
  };
};

// One stem plus whatever sits on it (leaves, thorns, a bud, a flower or curl at the tip, maybe a branch).
function growStem(
  random: Random,
  out: Ornament[],
  nextId: () => number,
  word: WordStyle,
  options: StemOptions,
): Point[] {
  const tip =
    options.tip ||
    (random() < word.flowerChance
      ? "flower"
      : random() < 0.45
        ? "fan"
        : random() < 0.6
          ? "leaf"
          : "curl");
  let path =
    options.path ||
    wigglyPath(
      options.start!,
      options.direction!,
      options.length!,
      (0.35 + random() * 0.45) * word.curviness,
      1 + random() * 1.6,
      random() * 6.28,
      (random() - 0.5) * 1.2,
      40,
    );
  if (tip === "curl")
    path = curlEnd(path, random() < 0.5 ? -1 : 1, 0.05 + random() * 0.05);
  const segments = weaveSegments(
    random,
    options.startLayer != null ? options.startLayer : random() < 0.5 ? 0 : 1,
  );
  const growDuration = Math.max(320, (options.length || 0.8) * 620);
  const thorns: { at: number; side: number }[] = [];
  const thornCount = Math.floor(random() * 1.6);
  for (let i = 0; i < thornCount; i++)
    thorns.push({ at: 0.15 + random() * 0.65, side: random() < 0.5 ? -1 : 1 });
  out.push({
    kind: "stem",
    id: nextId(),
    path,
    segments,
    delay: options.delay,
    growDuration,
    widthScale: options.isBranch ? 0.82 : 1,
    thorns,
  });

  // leaves alternate sides along the stem and appear as the stem grows past them
  const leafCount = Math.floor(random() * 2.8 * word.leafiness);
  let side = random() < 0.5 ? -1 : 1;
  for (let i = 0; i < leafCount; i++) {
    const along = 0.25 + random() * 0.6,
      [at, heading] = pointAlong(path, along);
    side = -side;
    out.push({
      kind: "leaf",
      id: nextId(),
      x: at[0],
      y: at[1],
      angle: heading + side * (0.55 + random() * 0.5),
      length: (0.14 + random() * 0.2) * (options.isBranch ? 0.8 : 1),
      bend: (random() - 0.5) * 1.2,
      layer: layerAtFraction(segments, along),
      delay: options.delay + growDuration * along,
    });
  }
  // sometimes a small flower buds partway along the stem — more blooms without more vines
  if (random() < 0.4 * word.density) {
    const along = 0.4 + random() * 0.3,
      [at, heading] = pointAlong(path, along),
      budSide = random() < 0.5 ? -1 : 1,
      offset = 0.05;
    out.push({
      kind: SMALL_FLOWERS[Math.floor(random() * SMALL_FLOWERS.length)],
      id: nextId(),
      x: at[0] + Math.cos(heading + (budSide * Math.PI) / 2) * offset,
      y: at[1] + Math.sin(heading + (budSide * Math.PI) / 2) * offset,
      radius: 0.06 + random() * 0.04,
      angle: heading + budSide * 0.9,
      rotation: (random() - 0.5) * 0.8,
      petalCount: 8 + Math.floor(random() * 4),
      side: budSide,
      phase: random() * 6.28,
      colorSeed: Math.floor(random() * 1e4),
      layer: layerAtFraction(segments, along),
      delay: options.delay + growDuration * along + 100,
    });
  }

  const [tipAt, tipHeading] = pointAlong(path, 1),
    tipDelay = options.delay + growDuration * 0.8,
    tipLayer = layerAtFraction(segments, 1);
  if (tip === "flower") {
    const kind = pickFlower(random, word);
    if (kind !== "rose") {
      const radius =
        (0.12 + random() * 0.12) *
        word.sizeScale *
        (options.isBranch ? 0.75 : 1);
      out.push({
        kind,
        id: nextId(),
        x: tipAt[0],
        y: tipAt[1],
        radius,
        angle: tipHeading,
        rotation: (random() - 0.5) * 0.8,
        petalCount: 9 + Math.floor(random() * 6),
        side: random() < 0.5 ? -1 : 1,
        phase: random() * 6.28,
        colorSeed: Math.floor(random() * 1e4),
        layer: random() < 0.6 ? 1 : tipLayer,
        delay: tipDelay,
      });
      return path;
    }
    const radius =
      (0.13 + random() * 0.15) * word.sizeScale * (options.isBranch ? 0.75 : 1);
    // legibility: a rose sitting over the letter body mostly goes behind it
    const overLetter =
      tipAt[1] > -0.78 &&
      tipAt[1] < 0.05 &&
      Math.abs(tipAt[0]) < word.letterWidth * 0.5;
    const layer = overLetter
      ? random() < 0.22
        ? 1
        : 0
      : random() < 0.6
        ? 1
        : tipLayer;
    out.push({
      kind: "rose",
      id: nextId(),
      x: tipAt[0],
      y: tipAt[1],
      radius,
      rotation: (random() - 0.5) * 1.0,
      phase1: random() * 6.28,
      phase2: random() * 6.28,
      spiralTurns: 1.8 + random() * 1,
      colorSeed: Math.floor(random() * 1e4),
      layer,
      delay: tipDelay,
    });
    if (random() < 0.1) {
      // occasionally a second, smaller rose beside it
      const offsetAngle = tipHeading + (random() < 0.5 ? 1 : -1) * 1.3;
      out.push({
        kind: "rose",
        id: nextId(),
        x: tipAt[0] + Math.cos(offsetAngle) * radius * 1.4,
        y: tipAt[1] + Math.sin(offsetAngle) * radius * 1.4,
        radius: radius * (0.6 + random() * 0.3),
        rotation: (random() - 0.5) * 1.2,
        phase1: random() * 6.28,
        phase2: random() * 6.28,
        spiralTurns: 1.8 + random(),
        colorSeed: Math.floor(random() * 1e4),
        layer,
        delay: tipDelay + 120,
      });
    }
  } else if (tip === "fan") {
    const spread = 0.6 + random() * 0.3;
    for (let j = 0; j < 2; j++)
      out.push({
        kind: "leaf",
        id: nextId(),
        x: tipAt[0],
        y: tipAt[1],
        angle: tipHeading + (j - 0.5) * spread,
        length: 0.2 + random() * 0.2,
        bend: (j - 0.5) * 0.8,
        layer: tipLayer,
        delay: tipDelay + j * 60,
      });
  } else if (tip === "leaf") {
    out.push({
      kind: "leaf",
      id: nextId(),
      x: tipAt[0],
      y: tipAt[1],
      angle: tipHeading + (random() - 0.5) * 0.3,
      length: 0.16 + random() * 0.16,
      bend: random() - 0.5,
      layer: tipLayer,
      delay: tipDelay,
    });
  }
  if (!options.isBranch && random() < 0.15) {
    const along = 0.35 + random() * 0.35,
      [at, heading] = pointAlong(path, along);
    growStem(random, out, nextId, word, {
      start: at,
      direction: heading + (random() < 0.5 ? -1 : 1) * (0.7 + random() * 0.4),
      length: (options.length || 0.8) * (0.35 + random() * 0.2),
      delay: options.delay + growDuration * along,
      isBranch: true,
      startLayer: layerAtFraction(segments, along),
    });
  }
  return path;
}

export function growLetter(letter: Letter, grow: GrowContext) {
  const random = seededRandom(
    (letter.wordSeed ^ Math.imul(letter.indexInWord + 1, 2654435761)) +
      Math.floor(grow.random() * 1e6),
  );
  const word = wordStyle(letter.wordSeed, grow.density),
    ornaments: Ornament[] = [];
  let idCounter = 0;
  const nextId = () => letter.id * 100 + idCounter++;
  const width = grow.glyphWidth(letter.char),
    xInsideLetter = () => (random() - 0.5) * width * 0.7;
  word.letterWidth = width;
  const stemCount = 1 + (random() < 0.25 * word.density ? 1 : 0);
  // stems radiate from the letter body in any direction; a second one heads roughly the opposite way
  const firstDirection = random() * Math.PI * 2;
  for (let i = 0; i < stemCount; i++) {
    growStem(random, ornaments, nextId, word, {
      start: [xInsideLetter(), -0.15 - random() * 0.45],
      direction: firstDirection + i * (Math.PI + (random() - 0.5) * 1.6),
      length: 0.6 + random() * 0.5,
      delay: 40 + i * 130,
      tip: letter.indexInWord === 0 && i === 0 ? "flower" : null,
    });
  }
  if (random() < 0.15 * word.density)
    growStem(random, ornaments, nextId, word, {
      start: [xInsideLetter(), -0.1 - random() * 0.35],
      direction: Math.PI / 2 + (random() - 0.5) * 0.8,
      length: 0.35 + random() * 0.35,
      delay: 160,
    });
  // a bridge: a stem arcing back to the previous letter of the word
  if (letter.previousInWord && random() < word.bridgeChance) {
    const previousCentreX =
      -(grow.glyphWidth(letter.previousInWord.char) + width) / 2;
    const from: Point = [xInsideLetter(), -0.05 - random() * 0.55],
      to: Point = [
        previousCentreX + (random() - 0.5) * 0.25,
        -0.05 - random() * 0.55,
      ];
    const bulge = (random() < 0.55 ? -1 : 1) * (0.4 + random() * 0.4),
      dx = to[0] - from[0];
    let path = cubicBezier(
      from,
      [from[0] + dx * 0.15, from[1] + bulge],
      [to[0] - dx * 0.15, to[1] + bulge * 0.9],
      to,
      40,
    );
    if (random() < 0.45)
      path = path.slice(0, Math.floor(path.length * (0.7 + random() * 0.2)));
    growStem(random, ornaments, nextId, word, {
      path,
      length: Math.abs(dx) + Math.abs(bulge),
      delay: 90,
      tip: random() < 0.5 ? "curl" : random() < 0.5 ? "leaf" : "flower",
    });
  }
  if (letter.indexInWord === 0 && random() < 0.5)
    growStem(random, ornaments, nextId, word, {
      start: [-width * 0.3, -0.15 - random() * 0.4],
      direction: Math.PI + (random() - 0.5) * 1.2,
      length: 0.45 + random() * 0.3,
      delay: 120,
      tip: "curl",
    });
  // tendril reaching for the next letter, shown only on the last letter of a word
  const tendrilParts: Ornament[] = [],
    tendrilRandom = seededRandom(
      letter.id * 977 + Math.floor(grow.random() * 1e6),
    );
  growStem(
    tendrilRandom,
    tendrilParts,
    () => letter.id * 100 + 90 + tendrilParts.length,
    word,
    {
      start: [width * 0.25, -0.1 - tendrilRandom() * 0.45],
      direction: (tendrilRandom() - 0.5) * 1.4,
      length: 0.45 + tendrilRandom() * 0.25,
      delay: 0,
      tip: "curl",
      isBranch: true,
    },
  );
  return {
    ornaments,
    tendril: tendrilParts.filter((o) => o.kind === "stem").slice(0, 1),
  };
}

// extra blooms when a word is finished (space typed), fanning out in random directions
export function growWordEnd(letter: Letter, startsAfter: number, grow: GrowContext) {
  const random = seededRandom(
      letter.wordSeed +
        letter.indexInWord * 31 +
        Math.floor(grow.random() * 1e6),
    ),
    word = wordStyle(letter.wordSeed, grow.density),
    ornaments: Ornament[] = [];
  let idCounter = 50;
  const nextId = () => letter.id * 100 + idCounter++;
  const width = grow.glyphWidth(letter.char),
    stemCount = 1 + Math.floor(random() * 1.6);
  word.letterWidth = width;
  const firstDirection = random() * Math.PI * 2;
  for (let i = 0; i < stemCount; i++) {
    const direction =
      firstDirection + (i * Math.PI * 2) / stemCount + (random() - 0.5) * 0.6;
    growStem(random, ornaments, nextId, word, {
      start: [(random() - 0.2) * width * 0.6, -random() * 0.5],
      direction,
      length: 0.4 + random() * 0.45,
      delay: startsAfter + 40 + i * 90,
      isBranch: true,
      tip: i === 0 || random() < 0.5 ? "flower" : "fan",
    });
  }
  return ornaments;
}
