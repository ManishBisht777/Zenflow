import type { Theme } from "../../engine/types.ts";
import { growLetter, growWordEnd } from "./grow.ts";
import { palettes } from "./palettes.ts";
import { draw } from "./draw.ts";
import { drawButterfly } from "./butterfly.ts";

const garden: Theme = {
  id: "garden",
  name: "Garden",
  visitorName: "Butterfly",
  typingHint: "type to grow",
  palettes,
  growLetter,
  growWordEnd,
  draw,
  ornamentRadius: (o) =>
    o.kind === "leaf"
      ? o.length
      : o.radius * (o.kind === "bluebell" ? 1.8 : 1.2),
  drawVisitor: drawButterfly,
};
export default garden;
