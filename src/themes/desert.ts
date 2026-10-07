// Desert: dunes roll behind the type, saguaros and barrel cacti grow from the baseline, rocks, a sun per word. Bird visitor.
import { seededRandom, springIn, easeOut, ellipsePoints, cubicBezier, strokePartial, withSharpCorners } from '../engine/kit.ts';
import type { Painter, GrowContext, Letter, Ornament, Palette, Point, Theme } from '../engine/types.ts';

// desert palettes carry dune shades, cactus + rib greens, bloom colors, sun and rock
interface DesertPalette extends Palette { dunes: string[]; cactus: string; rib: string; blooms: string[]; sun: string; rock: string }
const desertColors = (colors: Palette) => colors as DesertPalette;
interface CactusArm { at: number; side: number; reach: number; rise: number } // where on the trunk, which side, how far out, how far up

// ---------- generation ----------
type Random = () => number;

function createSaguaro(random: Random, nextId: () => number, x: number, delay: number, layer = 0): Ornament {
  const height = 0.45 + random() * 0.65, arms: CactusArm[] = [];
  const armCount = random() < 0.2 ? 0 : random() < 0.6 ? 1 : 2;
  for (let i = 0; i < armCount; i++) arms.push({ at: 0.35 + random() * 0.3, side: i === 0 ? (random() < 0.5 ? -1 : 1) : -arms[0].side, reach: 0.1 + random() * 0.07, rise: 0.15 + random() * 0.2 });
  return { kind: 'saguaro', id: nextId(), x, y: 0.06, height, trunkWidth: 0.075 + random() * 0.035, arms, hasBloom: random() < 0.5, colorSeed: Math.floor(random() * 1e4), layer, delay };
}

function growLetter(letter: Letter, grow: GrowContext) {
  const random = seededRandom((letter.wordSeed ^ Math.imul(letter.indexInWord + 1, 2654435761)) + Math.floor(grow.random() * 1e6));
  const ornaments: Ornament[] = []; let idCounter = 0; const nextId = () => letter.id * 100 + (idCounter++);
  const width = grow.glyphWidth(letter.char), density = grow.density;
  if (random() < 0.7) ornaments.push({ kind: 'dune', id: nextId(), x: (random() - 0.5) * width * 0.6, y: 0.1, width: width * (1.6 + random() * 1.2), height: 0.12 + random() * 0.22, shadeSeed: Math.floor(random() * 1e4), layer: 0, delay: random() * 200 });
  if (letter.indexInWord === 0 && random() < 0.6) ornaments.push({ kind: 'sun', id: nextId(), x: (random() - 0.5) * width, y: -1.15 - random() * 0.3, radius: 0.16 + random() * 0.1, hasRays: random() < 0.7, layer: 0, delay: 100 });
  if (random() < 0.65 * density) ornaments.push(createSaguaro(random, nextId, (random() - 0.5) * width * 1.1, 80));
  if (random() < 0.35 * density) ornaments.push({ kind: 'barrel', id: nextId(), x: (random() < 0.5 ? -1 : 1) * width * (0.45 + random() * 0.2), y: 0.08, radius: 0.07 + random() * 0.05, hasBloom: random() < 0.7, colorSeed: Math.floor(random() * 1e4), layer: 1, delay: 250 + random() * 300 });
  if (random() < 0.35 * density) {
    const outline = Array.from({ length: 7 }, () => 0.8 + random() * 0.35);  // lumpy radius per corner
    ornaments.push({ kind: 'rock', id: nextId(), x: (random() - 0.5) * width * 1.4, y: 0.09, radius: 0.04 + random() * 0.05, outline, layer: random() < 0.6 ? 1 : 0, delay: 200 + random() * 300 });
  }
  return { ornaments, tendril: [] };
}

// a word is finished: a tall saguaro
function growWordEnd(letter: Letter, startsAfter: number, grow: GrowContext) {
  const random = seededRandom(letter.wordSeed + letter.indexInWord * 31 + Math.floor(grow.random() * 1e6)), ornaments: Ornament[] = [];
  let idCounter = 50; const nextId = () => letter.id * 100 + (idCounter++);
  const saguaro = createSaguaro(random, nextId, grow.glyphWidth(letter.char) * (0.3 + random() * 0.3), startsAfter + 40);
  saguaro.height += 0.3;
  ornaments.push(saguaro);
  return ornaments;
}

// ---------- drawing ----------
// ponytail: sun rays turn on age, so poster loops can seam slightly; derive from loop phase if exports must be perfect
const draw: Theme['draw'] = {
  dune(painter, dune, drawing) {
    const grown = springIn((drawing.age - dune.delay) / 1000, 4, 8) * drawing.vitality; if (grown <= 0) return;
    const colors = desertColors(drawing.colors), outline: Point[] = [], left = dune.x! - dune.width / 2;
    for (let k = 0; k <= 24; k++) { const u = k / 24; outline.push(drawing.toScreen(left + u * dune.width, dune.y! - dune.height * grown * Math.pow(Math.sin(Math.PI * u), 1.6))); }
    // gently curved underside so each dune reads as a mound sitting on the baseline
    for (let k = 23; k >= 1; k--) { const u = k / 24; outline.push(drawing.toScreen(left + u * dune.width, dune.y! + 0.05 * grown * Math.sin(Math.PI * u))); }
    painter.fill(outline, colors.dunes[dune.shadeSeed % colors.dunes.length]);
  },
  sun(painter, sun, drawing) {
    const grown = springIn((drawing.age - sun.delay) / 1000, 5, 9) * drawing.vitality; if (grown <= 0) return;
    const [x, y] = drawing.toScreen(sun.x!, sun.y!), radius = sun.radius * drawing.fontSize * grown, color = desertColors(drawing.colors).sun;
    if (sun.hasRays) for (let k = 0; k < 12; k++) {
      const angle = k / 12 * Math.PI * 2 + drawing.age / 1000 * 0.15, halfSpread = 0.09;
      painter.fill(withSharpCorners([
        [x + Math.cos(angle - halfSpread) * radius * 1.25, y + Math.sin(angle - halfSpread) * radius * 1.25],
        [x + Math.cos(angle) * radius * 1.65, y + Math.sin(angle) * radius * 1.65],
        [x + Math.cos(angle + halfSpread) * radius * 1.25, y + Math.sin(angle + halfSpread) * radius * 1.25]
      ]), color);
    }
    painter.fill(ellipsePoints(x, y, radius, radius, 28), color);
  },
  saguaro(painter, saguaro, drawing) {
    const trunkGrown = easeOut((drawing.age - saguaro.delay) / 800) * drawing.vitality; if (trunkGrown <= 0) return;
    const colors = desertColors(drawing.colors), strokeWidth = saguaro.trunkWidth * drawing.fontSize * Math.min(1, 0.4 + trunkGrown), x = saguaro.x!, base = saguaro.y!;
    const trunk: Point[] = []; for (let k = 0; k <= 10; k++) trunk.push(drawing.toScreen(x, base - saguaro.height * k / 10));
    // arms grow out once the trunk has passed them: out sideways, then up
    const arms = (saguaro.arms as CactusArm[]).map(arm => {
      const y = base - saguaro.height * arm.at, elbowX = x + arm.side * arm.reach;
      return cubicBezier([x, y], [elbowX, y + 0.02], [elbowX, y], [elbowX, y - arm.rise], 12).map(p => drawing.toScreen(p[0], p[1]));
    });
    const armsGrown = easeOut((drawing.age - saguaro.delay - 600) / 600) * drawing.vitality;
    arms.forEach(arm => { if (armsGrown > 0) strokePartial(painter, arm, 0, armsGrown, colors.cactus, strokeWidth * 0.8); });
    strokePartial(painter, trunk, 0, trunkGrown, colors.cactus, strokeWidth);
    if (strokeWidth > 6) { // ribs
      for (const offset of [-0.22, 0.22]) {
        const rib: Point[] = []; for (let k = 1; k < 10; k++) rib.push(drawing.toScreen(x + offset * saguaro.trunkWidth, base - saguaro.height * k / 10));
        strokePartial(painter, rib, 0, Math.max(0, trunkGrown - 0.1), colors.rib, Math.max(0.8, strokeWidth * 0.1));
      }
      arms.forEach(arm => { if (armsGrown > 0.3) strokePartial(painter, arm, 0.25, armsGrown * 0.9, colors.rib, Math.max(0.8, strokeWidth * 0.08)); });
    }
    const top = drawing.toScreen(x, base - saguaro.height);
    if (drawing.offerPerch && trunkGrown >= 1) drawing.offerPerch([top[0], top[1] - strokeWidth * 0.2], strokeWidth * 0.8);
    if (saguaro.hasBloom && trunkGrown >= 1) {
      const open = springIn((drawing.age - saguaro.delay - 1200) / 1000, 7, 12) * drawing.vitality; if (open <= 0) return;
      const color = colors.blooms[saguaro.colorSeed % colors.blooms.length];
      for (let k = 0; k < 5; k++) {
        const angle = -Math.PI / 2 + (k - 2) * 0.45;
        painter.fill(ellipsePoints(top[0] + Math.cos(angle) * strokeWidth * 0.45 * open, top[1] - strokeWidth * 0.35 + Math.sin(angle) * strokeWidth * 0.45 * open, strokeWidth * 0.22 * open, strokeWidth * 0.22 * open, 10), color);
      }
    }
  },
  barrel(painter, barrel, drawing) {
    const grown = springIn((drawing.age - barrel.delay) / 1000, 6, 11) * drawing.vitality; if (grown <= 0) return;
    const colors = desertColors(drawing.colors), [x, y] = drawing.toScreen(barrel.x!, barrel.y! - barrel.radius * 0.85 * grown), radius = barrel.radius * drawing.fontSize * grown;
    painter.fill(ellipsePoints(x, y, radius * 1.05, radius * 0.95, 22), colors.cactus);
    if (radius > 6) for (const offset of [-0.5, 0, 0.5]) {
      const rib: Point[] = []; for (let k = 0; k <= 8; k++) { const t = -Math.PI / 2 + (k / 8 - 0.5) * 2.4; rib.push([x + offset * radius * Math.cos(t) * 1.05, y + Math.sin(t) * radius * 0.85]); }
      painter.stroke(rib, colors.rib, Math.max(0.8, radius * 0.07));
    }
    if (barrel.hasBloom && grown > 0.8) for (let k = 0; k < 5; k++) {
      const angle = k / 5 * Math.PI * 2;
      painter.fill(ellipsePoints(x + Math.cos(angle) * radius * 0.22, y - radius * 0.95 + Math.sin(angle) * radius * 0.22, radius * 0.2, radius * 0.2, 10), colors.blooms[(barrel.colorSeed + 1) % colors.blooms.length]);
    }
  },
  rock(painter, rock, drawing) {
    const grown = springIn((drawing.age - rock.delay) / 1000, 6, 11) * drawing.vitality; if (grown <= 0) return;
    const [x, y] = drawing.toScreen(rock.x!, rock.y! - rock.radius * 0.4), radius = rock.radius * drawing.fontSize * grown, points: Point[] = [];
    const outline = rock.outline as number[];
    // flat-bottomed: the lower half is clamped so it sits on the ground
    outline.forEach((lump, i) => { const angle = i / outline.length * Math.PI * 2; points.push([x + Math.cos(angle) * radius * lump * 1.3, y + Math.min(0.2, Math.sin(angle)) * radius * lump]); });
    painter.fill(points, desertColors(drawing.colors).rock);
  }
};

function drawBird(painter: Painter, x: number, y: number, size: number, angle: number, wingOpen: number, colors: Palette) {
  const cos = Math.cos(angle), sin = Math.sin(angle), local = (px: number, py: number): Point => [x + (px * cos - py * sin) * size, y + (px * sin + py * cos) * size];
  const wingLift = (wingOpen - 0.5) * 1.1, lineWidth = Math.max(1.2, size * 0.14);
  painter.stroke([local(-1, -wingLift), local(-0.5, -wingLift * 0.6 - 0.15), local(0, 0.05)], colors.text, lineWidth);
  painter.stroke([local(1, -wingLift), local(0.5, -wingLift * 0.6 - 0.15), local(0, 0.05)], colors.text, lineWidth);
  painter.fill(ellipsePoints(...local(0, 0.08), size * 0.16, size * 0.12, 10), colors.text);
}

const palette = (name: string, background: string, dunes: string[], cactus: string, rib: string, blooms: string[], sun: string, rock: string, text: string): DesertPalette =>
  ({ name, background, primary: dunes[0], secondary: cactus, accent: sun, text, dunes, cactus, rib, blooms, sun, rock });

const desert: Theme = {
  id: 'desert',
  name: 'Desert',
  visitorName: 'Bird',
  typingHint: 'type to bloom',
  palettes: [
    //       name      background dunes                   cactus     rib        blooms                  sun        rock       text
    palette('Noon', '#F7E7C6', ['#E9B872', '#D69A4E'], '#3E8E4F', '#24613A', ['#FF5DA2', '#FF7A00'], '#FFC93C', '#9C6B45', '#2A1A0A'),
    palette('Sunset', '#FFB38A', ['#E07A3F', '#C8602A'], '#2F6B3A', '#1E4A27', ['#FF4F8B', '#FFD23F'], '#FFE29A', '#8A4B2A', '#2B1206'),
    palette('Mesa', '#9FD3E0', ['#C1502E', '#A43F22'], '#3C7A47', '#24502D', ['#FF4F8B', '#FFD23F'], '#FFF4C2', '#7A2E18', '#1B0F0A'),
    palette('Night', '#141B3A', ['#3B3458', '#2B2546'], '#2E6B4F', '#1C4733', ['#FF7AB6', '#FFE066'], '#F4F1DE', '#4A3F66', '#FFFFFF'),
    palette('Mono', '#000000', ['#2A2A2A', '#1E1E1E'], '#6E6E6E', '#3A3A3A', ['#F2F2F2', '#BDBDBD'], '#D0D0D0', '#4A4A4A', '#FFFFFF')
  ],
  growLetter,
  growWordEnd,
  draw,
  ornamentRadius: o => (o.kind === 'dune' ? o.width / 2 : o.kind === 'saguaro' ? o.height + 0.1 : o.kind === 'sun' ? o.radius * 1.7 : o.radius * 1.3),
  drawVisitor: drawBird
};
export default desert;
