import type {
  Painter,
  Drawing,
  Ornament,
  Point,
  WeaveSegment,
} from "./types.ts";

// Shared math + shape helpers. Used by the engine and by every theme.
// Coordinates inside a letter are in "type units": 1 = font size, origin at the letter's baseline centre, y up is negative.

export const hashToUnit = (n: number) => {
  const x = Math.sin(n) * 43758.5453;
  return x - Math.floor(x);
};
// damped spring 0 → 1 (overshoots a little); t in seconds
export const springIn = (t: number, damping = 7, frequency = 16) =>
  t <= 0 ? 0 : 1 - Math.exp(-t * damping) * Math.cos(t * frequency);
// ease-out cubic, clamped to 0..1
export const easeOut = (t: number) =>
  t <= 0 ? 0 : t >= 1 ? 1 : 1 - Math.pow(1 - t, 3);

// seeded random generator (mulberry32): same seed, same sequence
export const seededRandom = (seed: number) => {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

export const cubicBezier = (
  a: Point,
  b: Point,
  c: Point,
  d: Point,
  steps: number,
) => {
  const points: Point[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps,
      u = 1 - t;
    points.push([
      u * u * u * a[0] +
        3 * u * u * t * b[0] +
        3 * u * t * t * c[0] +
        t * t * t * d[0],
      u * u * u * a[1] +
        3 * u * u * t * b[1] +
        3 * u * t * t * c[1] +
        t * t * t * d[1],
    ]);
  }
  return points;
};

// point + direction (radians) at fraction `along` of a polyline
export const pointAlong = (path: Point[], along: number): [Point, number] => {
  const n = path.length,
    i = Math.min(n - 2, Math.max(1, Math.round(along * (n - 1))));
  return [
    path[i],
    Math.atan2(
      path[i + 1][1] - path[i - 1][1],
      path[i + 1][0] - path[i - 1][0],
    ),
  ];
};

// a wiggly line growing from `start` in `direction`
export const wigglyPath = (
  start: Point,
  direction: number,
  length: number,
  wiggle: number,
  waves: number,
  phase: number,
  bend: number,
  steps = 40,
) => {
  const path: Point[] = [[start[0], start[1]]],
    step = length / steps;
  let x = start[0],
    y = start[1];
  for (let i = 1; i <= steps; i++) {
    const u = i / steps,
      angle =
        direction +
        bend * u +
        wiggle * Math.sin(u * Math.PI * waves + phase) * Math.min(1, u * 3);
    x += Math.cos(angle) * step;
    y += Math.sin(angle) * step;
    path.push([x, y]);
  }
  return path;
};

// spiral the end of a polyline (turn = ±1 for clockwise / anticlockwise)
export const curlEnd = (path: Point[], turn: number, radius: number) => {
  const n = path.length,
    end = path[n - 1],
    heading = Math.atan2(end[1] - path[n - 2][1], end[0] - path[n - 2][0]);
  const centre: Point = [
    end[0] - Math.sin(heading) * turn * radius,
    end[1] + Math.cos(heading) * turn * radius,
  ];
  const startAngle = Math.atan2(end[1] - centre[1], end[0] - centre[0]);
  for (let i = 1; i <= 14; i++) {
    const u = i / 14,
      t = startAngle + turn * u * Math.PI * 1.6,
      r = radius * (1 - 0.5 * u);
    path.push([centre[0] + Math.cos(t) * r, centre[1] + Math.sin(t) * r]);
  }
  return path;
};

// split a path into segments that alternate behind (0) / in front of (1) the type, sometimes with a small gap
export const weaveSegments = (random: () => number, startLayer: number) => {
  const cuts: number[] = [];
  const cutCount = 1 + Math.floor(random() * 3);
  for (let i = 0; i < cutCount; i++) cuts.push(0.15 + random() * 0.7);
  cuts.sort((a, b) => a - b);
  const segments: WeaveSegment[] = [];
  let start = 0,
    layer = startLayer;
  for (const cut of cuts) {
    if (cut <= start) continue;
    segments.push({ start, end: cut, layer });
    if (random() < 0.3) {
      const gap = 0.02 + random() * 0.03;
      start = Math.min(0.98, cut + gap);
    } else start = cut;
    layer = 1 - layer;
  }
  segments.push({ start, end: 1, layer });
  return segments;
};
export const layerAtFraction = (segments: WeaveSegment[], along: number) => {
  for (const s of segments)
    if (along >= s.start && along <= s.end) return s.layer;
  return segments[segments.length - 1].layer;
};

// closed ellipse outline (petals, planets, bubbles…)
export const ellipsePoints = (
  cx: number,
  cy: number,
  radiusX: number,
  radiusY: number,
  steps = 20,
  rotation = 0,
) => {
  const points: Point[] = [],
    c = Math.cos(rotation),
    s = Math.sin(rotation);
  for (let k = 0; k < steps; k++) {
    const t = (k / steps) * Math.PI * 2,
      x = Math.cos(t) * radiusX,
      y = Math.sin(t) * radiusY;
    points.push([cx + x * c - y * s, cy + x * s + y * c]);
  }
  return points;
};

// smooth curve through points (quadratic midpoints) onto anything with moveTo/lineTo/quadraticCurveTo
export interface PathSink {
  moveTo(x: number, y: number): void;
  lineTo(x: number, y: number): void;
  quadraticCurveTo(cx: number, cy: number, x: number, y: number): void;
  closePath(): void;
}
export const traceSmoothPath = (
  sink: PathSink,
  points: Point[],
  closed: boolean,
) => {
  const n = points.length;
  if (n < 2) return;
  const mid = (a: Point, b: Point): Point => [
    (a[0] + b[0]) / 2,
    (a[1] + b[1]) / 2,
  ];
  if (closed) {
    const start = mid(points[n - 1], points[0]);
    sink.moveTo(start[0], start[1]);
    for (let i = 0; i < n; i++) {
      const m = mid(points[i], points[(i + 1) % n]);
      sink.quadraticCurveTo(points[i][0], points[i][1], m[0], m[1]);
    }
    sink.closePath();
  } else {
    sink.moveTo(points[0][0], points[0][1]);
    for (let i = 1; i < n - 1; i++) {
      const m = mid(points[i], points[i + 1]);
      sink.quadraticCurveTo(points[i][0], points[i][1], m[0], m[1]);
    }
    sink.lineTo(points[n - 1][0], points[n - 1][1]);
  }
};

// stroke only the [from, to] fraction of a polyline (for "drawing on" animations)
export const strokePartial = (
  painter: Painter,
  path: Point[],
  from: number,
  to: number,
  color: string,
  width: number,
) => {
  const n = path.length - 1,
    fromIndex = from * n,
    toIndex = to * n;
  const lerpAt = (t: number): Point => {
    const i = Math.min(n - 1, Math.floor(t)),
      f = t - i;
    return [
      path[i][0] + (path[i + 1][0] - path[i][0]) * f,
      path[i][1] + (path[i + 1][1] - path[i][1]) * f,
    ];
  };
  const points = [lerpAt(fromIndex)];
  for (let i = Math.floor(fromIndex) + 1; i < toIndex; i++)
    points.push(path[i]);
  points.push(lerpAt(toIndex));
  if (points.length >= 2) painter.stroke(points, color, width);
};

// Draw a growing, layer-woven path ornament ({ path, segments, delay, growDuration }).
// Returns its screen points plus how far it has grown, or null if it hasn't started.
export const drawGrowingPath = (
  painter: Painter,
  ornament: Ornament,
  drawing: Drawing,
  color: string,
  width: number,
) => {
  const grown =
    drawing.growthOverride != null
      ? drawing.growthOverride
      : easeOut((drawing.age - ornament.delay) / (ornament.growDuration || 1)) *
        drawing.vitality;
  if (grown <= 0) return null;
  const screenPath = ornament.path!.map((p) =>
    drawing.toScreen(p[0], p[1]),
  ) as Point[] & { grown: number };
  for (const segment of ornament.segments!) {
    if (segment.layer !== drawing.layer) continue;
    const end = Math.min(segment.end, grown);
    if (end <= segment.start) continue;
    strokePartial(painter, screenPath, segment.start, end, color, width);
  }
  screenPath.grown = grown;
  return screenPath;
};

// fills are smoothed through midpoints; doubling every point keeps corners sharp (buildings, rays…)
export const withSharpCorners = (points: Point[]) =>
  points.flatMap((p) => [p, p]);
