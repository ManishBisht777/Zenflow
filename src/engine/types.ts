export type Point = [number, number];

// Where drawing goes: the canvas for the live view, poster and PNG; a string builder for SVG export.
export interface Painter {
  fill(points: Point[], color: string): void;
  stroke(points: Point[], color: string, width: number): void;
  fillRect(
    x: number,
    y: number,
    width: number,
    height: number,
    color: string,
  ): void;
  drawGlyph(
    char: string,
    x: number,
    y: number,
    fontSize: number,
    color: string,
  ): void;
}

export interface Palette {
  name: string;
  background: string;
  primary: string;
  secondary: string;
  accent: string;
  text: string;
}

// A stretch of a path that is drawn either behind (layer 0) or in front of (layer 1) the type.
export interface WeaveSegment {
  start: number;
  end: number;
  layer: number;
}

// Something that grows from a letter: a stem, flower, fish, building…
// Positions are in "type units": 1 = the font size, (0, 0) = the letter's baseline centre, negative y = up.
// Path ornaments carry `path` + `segments` and are drawn in both layers; the rest carry x, y and a single `layer`.
// Themes add whatever extra fields they need.
export interface Ornament {
  kind: string; // picks the draw function in theme.draw
  id: number; // stable per ornament: seeds jitter, remembers pointer tilt, names perches
  delay: number; // ms after the letter is born before this starts growing
  path?: Point[];
  segments?: WeaveSegment[];
  growDuration?: number;
  x?: number;
  y?: number;
  layer?: number;
  [field: string]: any;
}

export interface Letter {
  char: string;
  id: number;
  ornaments: Ornament[];
  wordEndOrnaments: Ornament[] | null; // extra growth added once the word is finished
  tendril: Ornament[]; // reaches towards the next letter; shown only on a word's last letter
  bornAt: number;
  tendrilStartAt: number; // the tendril regrows when the following letter is deleted
  wordSeed: number; // shared by every letter of a word, so a word has one "personality"
  indexInWord: number;
  previousInWord: Letter | null;
  diedAt: number | null; // set when deleted; the letter withers, then is removed
  wordEndedAt: number | null; // set when a space finished this letter's word
  hasPosition: boolean;
  x: number;
  y: number; // where the letter is drawn now (eases towards target)
  targetX: number;
  targetY: number; // where layout wants it
  width: number;
  scale?: number; // size relative to the line (clock's am/pm), default 1
  pointerLean: Point; // smoothed pull towards the pointer
  // poster timing
  posterBirthOffset: number;
  posterDeathAt: number;
  posterWordEndOffset: number | null;
}

// Everything a theme's draw function gets for one ornament on one frame.
export interface Drawing {
  fontSize: number; // px
  colors: Palette;
  age: number; // ms since the letter was born
  vitality: number; // 1 while alive, falls to 0 while the letter withers
  layer: number; // pass being drawn: 0 behind the type, 1 in front
  growthOverride: number | null; // forces path growth (tendrils), else derive it from age
  jitter: [number, number, number]; // hand-drawn tremble: dx, dy, rotation
  extraRotation: number; // from poster motion (wind, breathe…)
  toScreen(x: number, y: number): Point; // type units → px, with sway, lean and poster warp
  pointerTilt: ((at: Point) => Point) | null; // smoothed lean towards the pointer
  offerPerch: ((at: Point, radius: number) => void) | null; // lets the visitor land here
}

export interface GrowContext {
  glyphWidth(char: string): number;
  glyphInterior(char: string, thicken?: number): Point[]; // points inside the letter's shape (optionally widened), in type units
  random(): number;
  density: number;
}

export interface Theme {
  id: string;
  name: string;
  visitorName: string;
  typingHint: string;
  palettes: Palette[];
  replacesGlyphs?: boolean; // the ornaments ARE the letters: don't paint the text, regrow when the font changes
  preferredFontId?: string; // font picked automatically when switching to this theme
  typeScale?: number; // >1 allows bigger type when the theme needs less headroom around the letters
  growLetter(
    letter: Letter,
    grow: GrowContext,
  ): { ornaments: Ornament[]; tendril: Ornament[] };
  growWordEnd(
    letter: Letter,
    startsAfter: number,
    grow: GrowContext,
  ): Ornament[];
  draw: Record<
    string,
    (painter: Painter, ornament: Ornament, drawing: Drawing) => void
  >;
  ornamentRadius(ornament: Ornament): number; // size of a non-path ornament, used to fit the poster
  drawVisitor(
    painter: Painter,
    x: number,
    y: number,
    size: number,
    angle: number,
    wingOpen: number,
    colors: Palette,
  ): void;
}
