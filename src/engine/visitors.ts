// Live-view visitors (butterfly, UFO, …): called by a tap, fly to a perch, flutter, leave.
import type { EngineState, Perch, Visitor } from "./state.ts";
import type { Painter, Palette } from "./types.ts";

const MAX_VISITORS = 6;
// ---------- visitor (butterfly, UFO, …) ----------
export function callVisitor(
  state: EngineState,
  towardsX: number,
  towardsY: number,
) {
  if (state.visitors.length >= MAX_VISITORS) {
    const oldest = state.visitors.find((v) => v.state !== "leaving");
    if (oldest) sendVisitorAway(state, oldest);
  }
  const taken = new Set(
    state.visitors.filter((v) => v.state !== "leaving").map((v) => v.perchId),
  );
  let nearest: Perch | null = null,
    nearestDistance = 1e9;
  for (const perch of state.perches) {
    if (taken.has(perch.id)) continue;
    const distance = Math.hypot(perch.x - towardsX, perch.y - towardsY);
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearest = perch;
    }
  }
  const fromLeft = towardsX < state.width / 2,
    size = Math.max(9, state.fontSize * 0.09);
  state.visitors.push({
    x: fromLeft ? -40 : state.width + 40,
    y: towardsY + (Math.random() - 0.5) * state.height * 0.4,
    velocityX: 0,
    velocityY: 0,
    state: nearest ? "flying" : "wandering",
    perchId: nearest ? nearest.id : null,
    homeX: towardsX,
    homeY: towardsY,
    spawnedAt: performance.now(),
    flutterPhase: Math.random() * 6,
    size,
    seed: Math.random() * 100,
    angle: 0,
    wingOpen: 0,
    exitX: 0,
    exitY: 0,
  });
}
export function sendVisitorAway(state: EngineState, visitor: Visitor) {
  visitor.state = "leaving";
  visitor.perchId = null;
  visitor.exitX = visitor.x < state.width / 2 ? -80 : state.width + 80;
  visitor.exitY = visitor.y - state.height * 0.3;
}
export function updateAndDrawVisitors(
  state: EngineState,
  painter: Painter,
  now: number,
  colors: Palette,
) {
  const dt = Math.min(48, now - (state.lastVisitorFrameAt || now));
  state.lastVisitorFrameAt = now;
  const perchById: Record<number, Perch> = {};
  for (const perch of state.perches) perchById[perch.id] = perch;
  state.visitors = state.visitors.filter((v) => {
    const seconds = (now - v.spawnedAt) / 1000;
    let goalX = 0,
      goalY = 0;
    if (v.state === "perched" || v.state === "flying") {
      const perch = v.perchId != null ? perchById[v.perchId] : null;
      if (!perch)
        sendVisitorAway(state, v); // its perch withered away
      else {
        goalX = perch.x + perch.radius * 0.05;
        goalY = perch.y - perch.radius * 0.55;
      }
    }
    if (v.state === "wandering") {
      goalX = v.homeX + Math.sin(seconds * 1.3 + v.seed) * 70;
      goalY = v.homeY + Math.sin(seconds * 2.1 + v.seed) * 40;
      if (seconds > 3.5) sendVisitorAway(state, v);
    }
    if (v.state === "leaving") {
      goalX = v.exitX;
      goalY = v.exitY;
    }
    if (v.state === "perched") {
      v.x += (goalX - v.x) * 0.35;
      v.y += (goalY - v.y) * 0.35;
      v.angle *= 0.85;
      v.flutterPhase += dt * 0.004;
      const flapBurst = Math.sin((now / 1000) * 0.9 + v.seed) > 0.75;
      v.wingOpen = flapBurst
        ? 0.2 + 0.8 * Math.abs(Math.cos((now / 1000) * 9 + v.seed))
        : 0.25 + 0.15 * Math.sin(v.flutterPhase);
    } else {
      const dx = goalX - v.x,
        dy = goalY - v.y,
        distance = Math.hypot(dx, dy) || 1;
      const speed =
        v.state === "leaving" ? 0.42 : Math.min(0.34, 0.06 + distance * 0.0016);
      const flutter = Math.sin(seconds * 7 + v.seed) * 0.12,
        wobble = Math.cos(seconds * 4.3 + v.seed) * 0.1;
      const steerX = (dx / distance) * speed + wobble - v.velocityX,
        steerY = (dy / distance) * speed + flutter - v.velocityY;
      v.velocityX += (steerX * 0.06 * dt) / 16;
      v.velocityY += (steerY * 0.06 * dt) / 16;
      v.x += v.velocityX * dt;
      v.y += v.velocityY * dt + Math.sin(seconds * 13 + v.seed) * 0.6;
      v.angle +=
        (Math.max(-0.5, Math.min(0.5, v.velocityX * 1.4)) - v.angle) * 0.1;
      v.wingOpen = Math.abs(Math.cos(seconds * 17 + v.seed));
      if (v.state === "flying" && distance < 5) {
        v.state = "perched";
        v.flutterPhase = 0;
      }
      if (
        v.state === "leaving" &&
        (v.x < -60 || v.x > state.width + 60 || v.y < -60)
      )
        return false;
    }
    state.theme.drawVisitor(
      painter,
      v.x,
      v.y,
      v.size,
      v.angle,
      v.wingOpen,
      colors,
    );
    return true;
  });
}
