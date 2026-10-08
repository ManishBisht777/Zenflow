// City: a skyline rises behind each letter — towers with lit windows and rooftops — plus street lamps and drifting clouds. Pigeon visitor.
import {
  seededRandom,
  springIn,
  easeOut,
  ellipsePoints,
  hashToUnit,
  withSharpCorners,
} from "../engine/kit.ts";
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

// city palettes carry building shades, window colors and a cloud color
interface CityPalette extends Palette {
  buildings: string[];
  windows: string[];
  cloud: string;
}
const cityColors = (colors: Palette) => colors as CityPalette;

// ---------- generation ----------
type Random = () => number;
const ROOF_STYLES = ["flat", "antenna", "spire", "step", "dome", "flat"];

function createBuilding(
  random: Random,
  nextId: () => number,
  x: number,
  width: number,
  height: number,
  delay: number,
  layer = 0,
): Ornament {
  return {
    kind: "building",
    id: nextId(),
    x,
    y: 0.06,
    width,
    height,
    roof: ROOF_STYLES[Math.floor(random() * ROOF_STYLES.length)],
    shadeSeed: Math.floor(random() * 1e4),
    litShare: 0.35 + random() * 0.45,
    layer,
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
  // tall ones first so shorter ones stand in front of them
  const count =
    1 + (random() < 0.6 * density ? 1 : 0) + (random() < 0.3 * density ? 1 : 0);
  const plans = Array.from({ length: count }, () => ({
    x: (random() - 0.5) * width * 1.3,
    width: 0.12 + random() * 0.18,
    height:
      0.35 + random() * random() * 1.1 + (letter.indexInWord === 0 ? 0.2 : 0),
  }));
  plans
    .sort((a, b) => b.height - a.height)
    .forEach((plan, i) =>
      ornaments.push(
        createBuilding(
          random,
          nextId,
          plan.x,
          plan.width,
          plan.height,
          40 + i * 120,
        ),
      ),
    );
  if (random() < 0.25 * density)
    ornaments.push({
      kind: "lamp",
      id: nextId(),
      x: (random() < 0.5 ? -1 : 1) * width * (0.5 + random() * 0.15),
      y: 0.06,
      height: 0.4 + random() * 0.15,
      side: random() < 0.5 ? -1 : 1,
      layer: 1,
      delay: 300 + random() * 300,
    });
  if (random() < 0.35 * density)
    ornaments.push({
      kind: "cloud",
      id: nextId(),
      x: (random() - 0.5) * width * 1.5,
      y: -1.25 - random() * 0.4,
      radius: 0.08 + random() * 0.08,
      driftSpeed: 0.2 + random() * 0.3,
      driftPhase: random() * 6.28,
      layer: random() < 0.5 ? 0 : 1,
      delay: random() * 600,
    });
  // Small street traffic adds foreground depth beneath the letter baseline.
  if (random() < 0.7 * density)
    ornaments.push({
      kind: "car",
      id: nextId(),
      x: (random() - 0.5) * width * 1.8,
      y: 0.19 + random() * 0.08,
      size: 0.13 + random() * 0.05,
      facing: random() < 0.5 ? -1 : 1,
      tint: random() < 0.5 ? "primary" : "accent",
      layer: 1,
      delay: 260 + random() * 400,
    });
  return { ornaments, tendril: [] };
}

// a word is finished: a landmark tower
function growWordEnd(letter: Letter, startsAfter: number, grow: GrowContext) {
  const random = seededRandom(
      letter.wordSeed +
        letter.indexInWord * 31 +
        Math.floor(grow.random() * 1e6),
    ),
    ornaments: Ornament[] = [];
  let idCounter = 50;
  const nextId = () => letter.id * 100 + idCounter++;
  const width = grow.glyphWidth(letter.char),
    tower = createBuilding(
      random,
      nextId,
      (random() - 0.5) * width * 0.6,
      0.16 + random() * 0.08,
      1.2 + random() * 0.4,
      startsAfter + 40,
    );
  tower.roof = random() < 0.5 ? "spire" : "antenna";
  ornaments.push(tower);
  return ornaments;
}

// ---------- drawing ----------
// axis-aligned rectangle in type units, with sharp corners
const rectangle = (
  drawing: Drawing,
  left: number,
  top: number,
  right: number,
  bottom: number,
) =>
  withSharpCorners([
    drawing.toScreen(left, bottom),
    drawing.toScreen(left, top),
    drawing.toScreen(right, top),
    drawing.toScreen(right, bottom),
  ]);

// ponytail: antenna blink, lamp glow and cloud drift run on age, so poster loops can seam slightly; derive from loop phase if exports must be perfect
const draw: Theme["draw"] = {
  building(painter, building, drawing) {
    const grown =
      springIn((drawing.age - building.delay) / 1000, 5, 9) * drawing.vitality;
    if (grown <= 0) return;
    const colors = cityColors(drawing.colors),
      wallColor =
        colors.buildings[building.shadeSeed % colors.buildings.length];
    const height = building.height * Math.max(0, grown),
      left = building.x! - building.width / 2,
      right = building.x! + building.width / 2,
      bottom = building.y!,
      top = bottom - height;
    painter.fill(rectangle(drawing, left, top, right, bottom), wallColor);
    // windows: a grid, some lit; rows only appear once the tower has grown past them
    const columns = Math.max(1, Math.round(building.width / 0.065)),
      cellWidth = building.width / columns,
      windowWidth = cellWidth * 0.45,
      windowHeight = 0.035;
    for (let row = 0; bottom - 0.06 - (row + 1) * 0.09 > top; row++)
      for (let column = 0; column < columns; column++) {
        const roll = hashToUnit(building.id * 7.13 + column * 13.7 + row * 3.1);
        if (roll > building.litShare) continue;
        const cx = left + cellWidth * (column + 0.5),
          cy = bottom - 0.06 - (row + 0.5) * 0.09;
        painter.fill(
          rectangle(
            drawing,
            cx - windowWidth / 2,
            cy - windowHeight / 2,
            cx + windowWidth / 2,
            cy + windowHeight / 2,
          ),
          colors.windows[Math.floor(roll * 97) % colors.windows.length],
        );
      }
    if (grown < 0.9) return;
    const roofGrown =
      easeOut((drawing.age - building.delay - 500) / 400) * drawing.vitality;
    if (roofGrown <= 0) return;
    const centerX = building.x!,
      lineWidth = Math.max(1, drawing.fontSize * 0.012);
    if (building.roof === "antenna") {
      painter.stroke(
        [
          drawing.toScreen(centerX, top),
          drawing.toScreen(centerX, top - 0.18 * roofGrown),
        ],
        wallColor,
        lineWidth,
      );
      if (Math.sin((drawing.age / 1000) * 3 + building.id) > 0) {
        const tip = drawing.toScreen(centerX, top - 0.18 * roofGrown);
        painter.fill(
          ellipsePoints(tip[0], tip[1], lineWidth * 1.6, lineWidth * 1.6, 8),
          drawing.colors.accent,
        );
      }
    } else if (building.roof === "spire") {
      painter.fill(
        withSharpCorners([
          drawing.toScreen(left + building.width * 0.15, top),
          drawing.toScreen(centerX, top - building.width * 0.9 * roofGrown),
          drawing.toScreen(right - building.width * 0.15, top),
        ]),
        wallColor,
      );
    } else if (building.roof === "step") {
      painter.fill(
        rectangle(
          drawing,
          left + building.width * 0.2,
          top - 0.09 * roofGrown,
          right - building.width * 0.2,
          top + 0.01,
        ),
        wallColor,
      );
    } else if (building.roof === "dome") {
      const base = drawing.toScreen(centerX, top),
        radius = building.width * 0.38 * drawing.fontSize * roofGrown,
        dome: Point[] = [];
      for (let k = 0; k <= 12; k++) {
        const a = Math.PI + (k / 12) * Math.PI;
        dome.push([
          base[0] + Math.cos(a) * radius,
          base[1] + Math.sin(a) * radius,
        ]);
      }
      painter.fill(dome, wallColor);
    }
    if (drawing.offerPerch && drawing.age - building.delay > 900) {
      const roof = drawing.toScreen(centerX, top);
      drawing.offerPerch(
        [roof[0], roof[1] + building.width * drawing.fontSize * 0.2],
        building.width * drawing.fontSize * 0.4,
      );
    }
  },
  lamp(painter, lamp, drawing) {
    const grown = easeOut((drawing.age - lamp.delay) / 500) * drawing.vitality;
    if (grown <= 0) return;
    const lineWidth = Math.max(1, drawing.fontSize * 0.014),
      top = lamp.y! - lamp.height * grown,
      side = lamp.side;
    painter.stroke(
      [
        drawing.toScreen(lamp.x!, lamp.y!),
        drawing.toScreen(lamp.x!, top),
        drawing.toScreen(lamp.x! + side * 0.06, top - 0.04),
        drawing.toScreen(lamp.x! + side * 0.11, top),
      ],
      drawing.colors.text,
      lineWidth,
    );
    if (grown < 1) return;
    const bulb = drawing.toScreen(lamp.x! + side * 0.11, top + 0.03),
      glow = 0.85 + 0.15 * Math.sin((drawing.age / 1000) * 2 + lamp.id);
    painter.fill(
      ellipsePoints(
        bulb[0],
        bulb[1],
        drawing.fontSize * 0.03 * glow,
        drawing.fontSize * 0.03 * glow,
        12,
      ),
      drawing.colors.accent,
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
      [-1, 0.15, 0.7],
      [0, -0.1, 1],
      [1, 0.1, 0.8],
      [0.4, 0.3, 0.7],
      [-0.5, 0.35, 0.6],
    ]) {
      painter.fill(
        ellipsePoints(
          center[0] + dx * radius,
          center[1] + dy * radius,
          radius * scale,
          radius * scale * 0.85,
          14,
        ),
        cityColors(drawing.colors).cloud,
      );
    }
  },
  car(painter, car, drawing) {
    const grown =
      springIn((drawing.age - car.delay) / 1000, 7, 14) * drawing.vitality;
    if (grown <= 0) return;
    const seconds = drawing.age / 1000;
    const center = drawing.toScreen(
      car.x! + Math.sin(seconds * 0.8 + car.id) * 0.025,
      car.y!,
    );
    const size = car.size * drawing.fontSize * grown;
    const mirror = car.facing as number;
    const local = (px: number, py: number): Point => [
      center[0] + px * size * mirror,
      center[1] + py * size,
    ];
    const body = drawing.colors[car.tint as "primary" | "accent"];
    painter.fill(
      [
        local(-0.9, 0.05),
        local(-0.68, -0.25),
        local(-0.25, -0.48),
        local(0.4, -0.45),
        local(0.78, -0.1),
        local(0.92, 0.05),
        local(0.85, 0.38),
        local(-0.78, 0.38),
      ],
      body,
    );
    painter.fill(
      [
        local(-0.48, -0.2),
        local(-0.2, -0.4),
        local(0.27, -0.38),
        local(0.52, -0.12),
      ],
      drawing.colors.background,
    );
    for (const wheelX of [-0.52, 0.52]) {
      const wheel = local(wheelX, 0.35);
      painter.fill(
        ellipsePoints(wheel[0], wheel[1], size * 0.17, size * 0.17, 10),
        drawing.colors.text,
      );
    }
    const headlight = local(0.82, 0.15);
    painter.fill(
      ellipsePoints(headlight[0], headlight[1], size * 0.06, size * 0.06, 8),
      drawing.colors.accent,
    );
  },
};

function drawPigeon(
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
  const shades = cityColors(colors).buildings,
    wingColor = shades[shades.length - 1];
  painter.fill(
    [local(-0.75, 0.05), local(-0.95, -0.05), local(-0.95, 0.2)],
    colors.text,
  ); // tail
  painter.fill(
    ellipsePoints(...local(0, 0.05), size * 0.55, size * 0.32, 18, angle),
    colors.text,
  ); // body
  painter.fill(
    ellipsePoints(...local(0.45, -0.25), size * 0.2, size * 0.2, 12),
    colors.text,
  ); // head
  painter.fill(
    withSharpCorners([
      local(0.62, -0.28),
      local(0.82, -0.22),
      local(0.62, -0.18),
    ]),
    colors.accent,
  ); // beak
  painter.fill(
    ellipsePoints(...local(0.5, -0.29), size * 0.04, size * 0.04, 8),
    wingColor,
  ); // eye
  painter.fill(
    [
      local(-0.3, 0),
      local(0.25, -0.05),
      local(-0.1 + wingOpen * 0.1, -0.1 - wingOpen * 0.75),
    ],
    wingColor,
  ); // flapping wing
}

const palette = (
  name: string,
  background: string,
  buildings: string[],
  windows: string[],
  cloud: string,
  accent: string,
  text: string,
): CityPalette => ({
  name,
  background,
  primary: windows[0],
  secondary: buildings[0],
  accent,
  text,
  buildings,
  windows,
  cloud,
});

const city: Theme = {
  id: "city",
  name: "City",
  visitorName: "Pigeon",
  grounded: true,
  typingHint: "type to build",
  palettes: [
    palette(
      "Night",
      "#0B1026",
      ["#1E2A4A", "#27365E", "#33467A"],
      ["#FFD166", "#FFE8A3"],
      "#1A2340",
      "#FFD166",
      "#E4EAFF",
    ),
    palette(
      "Dusk",
      "#2D1B3D",
      ["#4A2C5A", "#5E3A70", "#3A2347"],
      ["#FFB86B", "#FF8FA3"],
      "#7A3E66",
      "#FFB86B",
      "#FBE9F5",
    ),
    palette(
      "Neon",
      "#08060F",
      ["#1A1033", "#22143F", "#120B24"],
      ["#FF2E97", "#00F0FF", "#F9F871"],
      "#1A1230",
      "#FF2E97",
      "#F2EDFF",
    ),
  ],
  growLetter,
  growWordEnd,
  draw,
  ornamentRadius: (o) =>
    o.kind === "building"
      ? o.height + 0.2
      : o.kind === "lamp"
        ? o.height
        : o.kind === "car"
          ? o.size * 1.2
          : o.radius * 1.6,
  drawVisitor: drawPigeon,
};
export default city;
