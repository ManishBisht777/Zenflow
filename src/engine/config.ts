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
    id: "breathe",
    label: "Breathe",
    description: "Slow sway · 3s",
    loopMs: 3000,
  },
  {
    id: "grow",
    label: "Grow & wither",
    description: "Bloom, then back · 6s",
    loopMs: 6000,
  },
  {
    id: "typed",
    label: "Typed",
    description: "Type, cut, repeat · 5s",
    loopMs: 5000,
  },
  {
    id: "wind",
    label: "Gust",
    description: "Wind sweeps through · 4s",
    loopMs: 4000,
  },
  {
    id: "reach",
    label: "Reach",
    description: "Growth follows a light · 6s",
    loopMs: 6000,
  },
  {
    id: "scatter",
    label: "Scatter",
    description: "Random bloom, fade · 6s",
    loopMs: 6000,
  },
  {
    id: "visit",
    label: "Visitor",
    description: "{visitor} drops by · 7s",
    loopMs: 7000,
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
export const POSTER_SIZE = 1080;
