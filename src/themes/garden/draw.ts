// Draw functions for every garden ornament kind: stems (with thorns), leaves and flowers.
import {
  springIn,
  layerAtFraction,
  pointAlong,
  drawGrowingPath,
} from "../../engine/kit.ts";
import type { Painter, Palette, Point, Theme } from "../../engine/types.ts";
import { gardenColors } from "./palettes.ts";
import { drawFlower, drawRose } from "./flowers.ts";

function drawLeaf(
  painter: Painter,
  baseX: number,
  baseY: number,
  angle: number,
  length: number,
  bend: number,
  colors: Palette,
) {
  if (length < 0.5) return;
  const cos = Math.cos(angle),
    sin = Math.sin(angle),
    normalX = -sin,
    normalY = cos;
  const midrib = (u: number): Point => {
    const b = Math.sin(Math.PI * u) * bend * 0.15 * length;
    return [
      baseX + cos * u * length + normalX * b,
      baseY + sin * u * length + normalY * b,
    ];
  };
  const halfWidth = (u: number) =>
    length * 0.18 * Math.sin(Math.PI * Math.pow(u, 0.8));
  const steps = 12,
    sideA: Point[] = [],
    sideB: Point[] = [];
  for (let i = 0; i <= steps; i++) {
    const u = i / steps,
      c = midrib(u),
      w = halfWidth(u);
    sideA.push([c[0] + normalX * w, c[1] + normalY * w]);
    sideB.push([c[0] - normalX * w, c[1] - normalY * w]);
  }
  const tip = midrib(1),
    base = midrib(0);
  painter.fill(
    [
      base,
      ...sideA.slice(1, steps),
      tip,
      tip,
      ...sideB.slice(1, steps).reverse(),
      base,
    ],
    gardenColors(colors).leaf,
  );
  if (length > 6) {
    const vein: Point[] = [];
    for (let i = 0; i <= 8; i++) vein.push(midrib(0.08 + (0.72 * i) / 8));
    painter.stroke(vein, colors.background, Math.max(0.8, length * 0.03));
  }
}

export const draw: Theme["draw"] = {
  ...drawFlower,
  stem(painter, stem, drawing) {
    const path = drawGrowingPath(
      painter,
      stem,
      drawing,
      drawing.colors.secondary,
      drawing.fontSize * 0.022 * (stem.widthScale || 1),
    );
    if (!path) return;
    for (const thorn of stem.thorns as { at: number; side: number }[])
      if (
        path.grown > thorn.at &&
        layerAtFraction(stem.segments!, thorn.at) === drawing.layer
      ) {
        const [at, heading] = pointAlong(path, thorn.at),
          angle = heading + thorn.side * 2.3,
          length = drawing.fontSize * 0.045;
        painter.stroke(
          [
            at,
            [
              at[0] + Math.cos(angle) * length,
              at[1] + Math.sin(angle) * length,
            ],
          ],
          gardenColors(drawing.colors).thorn,
          drawing.fontSize * 0.022,
        );
      }
  },
  leaf(painter, leaf, drawing) {
    const grown =
      springIn((drawing.age - leaf.delay) / 1000, 7, 15) * drawing.vitality;
    if (grown <= 0) return;
    const base = drawing.toScreen(leaf.x!, leaf.y!);
    drawLeaf(
      painter,
      base[0],
      base[1],
      leaf.angle + drawing.jitter[2] + drawing.extraRotation,
      leaf.length * drawing.fontSize * grown,
      leaf.bend,
      drawing.colors,
    );
  },
  rose(painter, rose, drawing) {
    const age = drawing.age - rose.delay;
    if (age < 0 || drawing.vitality <= 0.001) return;
    const center = drawing.toScreen(rose.x!, rose.y!),
      tilt = drawing.pointerTilt ? drawing.pointerTilt(center) : null,
      radius = rose.radius * drawing.fontSize * drawing.vitality;
    if (drawing.offerPerch && age > 700) drawing.offerPerch(center, radius);
    drawRose(
      painter,
      center[0],
      center[1],
      radius,
      rose.rotation +
        drawing.jitter[2] +
        drawing.extraRotation +
        (tilt ? tilt[0] * 0.22 : 0),
      rose,
      age,
      tilt,
      drawing.colors,
    );
  },
};
