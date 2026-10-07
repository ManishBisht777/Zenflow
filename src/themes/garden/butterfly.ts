// The garden's visitor.
import type { Painter, Palette, Point } from "../../engine/types.ts";
import { gardenColors } from "./palettes.ts";

export function drawButterfly(
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
  // wingOpen squeezes the wing horizontally (0 = edge-on, 1 = fully open)
  const wing = (
    cx: number,
    cy: number,
    radiusX: number,
    radiusY: number,
    tilt: number,
    side: number,
  ) => {
    const points: Point[] = [],
      c = Math.cos(tilt),
      s = Math.sin(tilt);
    for (let k = 0; k < 22; k++) {
      const theta = (k / 22) * Math.PI * 2,
        wobble = 1 + 0.08 * Math.sin(theta * 3),
        lx = Math.cos(theta) * radiusX * wobble,
        ly = Math.sin(theta) * radiusY * wobble;
      points.push(
        local(
          side * (cx + lx * c - ly * s) * (0.12 + 0.88 * wingOpen),
          cy + lx * s + ly * c,
        ),
      );
    }
    return points;
  };
  for (const side of [-1, 1]) {
    painter.fill(wing(0.46, 0.28, 0.36, 0.3, 0.5, side), colors.text);
    painter.fill(wing(0.55, -0.32, 0.55, 0.36, -0.55, side), colors.text);
    if (wingOpen > 0.35)
      painter.fill(wing(0.66, -0.4, 0.13, 0.11, 0, side), colors.primary);
  }
  const body: Point[] = [];
  for (let k = 0; k < 18; k++) {
    const theta = (k / 18) * Math.PI * 2;
    body.push(local(Math.cos(theta) * 0.08, Math.sin(theta) * 0.48));
  }
  const bodyColor = gardenColors(colors).thorn,
    antennaWidth = Math.max(0.8, size * 0.05);
  painter.fill(body, bodyColor);
  painter.stroke(
    [local(0, -0.42), local(-0.14, -0.72), local(-0.24, -0.86)],
    bodyColor,
    antennaWidth,
  );
  painter.stroke(
    [local(0, -0.42), local(0.14, -0.72), local(0.24, -0.86)],
    bodyColor,
    antennaWidth,
  );
}
