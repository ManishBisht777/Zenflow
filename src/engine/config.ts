// Static settings: poster presets, fonts and engine constants.

export type Mode = "type" | "poster" | "clock";
export interface Preset {
  id: string;
  label: string;
  description: string;
  loopMs: number;
}

export const PRESETS: Preset[] = [
  {
    id: "scatter",
    label: "Emerge",
    description: "Rise at random, fade · 6s",
    loopMs: 6000,
  },
  {
    id: "typed",
    label: "Keystroke",
    description: "Type, cut, repeat · 5s",
    loopMs: 5000,
  },
];

export interface Font {
  id: string;
  name: string;
  family: string;
  weight: number;
}
// to add a font: add it here and to the Google Fonts link in index.html
export const FONTS: Font[] = [
  {
    id: "geist",
    name: "Geist",
    family: '"Geist",system-ui,sans-serif',
    weight: 700,
  },
  {
    id: "patrick",
    name: "Patrick Hand",
    family: '"Patrick Hand",cursive',
    weight: 400,
  },
  {
    id: "fraunces",
    name: "Fraunces",
    family: '"Fraunces",Georgia,serif',
    weight: 800,
  },
  {
    id: "bricolage",
    name: "Bricolage",
    family: '"Bricolage Grotesque",system-ui,sans-serif',
    weight: 800,
  },
];
export const cssFont = (font: Font, px: number) =>
  `${font.weight} ${px}px ${font.family}`;

export const INPUT_SENTINEL = String.fromCharCode(0x200b); // kept in the hidden field so Backspace on an empty field still reports
export const POSTER_WIDTH = 1080, POSTER_HEIGHT = 1350; // Instagram portrait 4:5
