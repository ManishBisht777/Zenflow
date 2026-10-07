// Garden palettes carry extra colors: leaves, thorns and a set of flower colors (each flower picks one).
import type { Ornament, Palette } from "../../engine/types.ts";

export interface GardenPalette extends Palette {
  leaf: string;
  thorn: string;
  flowers: string[];
}
export const gardenColors = (colors: Palette) => colors as GardenPalette;
export const flowerColor = (colors: Palette, ornament: Ornament, shift = 0) => {
  const options = gardenColors(colors).flowers;
  return options[((ornament.colorSeed || 0) + shift) % options.length];
};

const palette = (
  name: string,
  background: string,
  stem: string,
  leaf: string,
  thorn: string,
  petalLine: string,
  text: string,
  flowers: string[],
): GardenPalette => ({
  name,
  background,
  primary: flowers[0],
  secondary: stem,
  accent: petalLine,
  text,
  leaf,
  thorn,
  flowers,
});

export const palettes: GardenPalette[] = [
  palette(
    "Paper",
    "#F3EEE4",
    "#2E7D32",
    "#1B4D20",
    "#6B4226",
    "#FFE5D9",
    "#111111",
    ["#FF3B1F", "#FF9F1C", "#F15BB5", "#7B2CBF", "#FFC300"],
  ),
  palette(
    "Citrus",
    "#0E1A12",
    "#1FA463",
    "#0F6B3A",
    "#7A5230",
    "#FFF1D6",
    "#FFF6E8",
    ["#FF8A00", "#FFD23F", "#FF4D4D", "#FF9ECF"],
  ),
  palette(
    "Orchid",
    "#140A1F",
    "#2FB86A",
    "#1A7A44",
    "#7C4E33",
    "#FBE3FF",
    "#FFFFFF",
    ["#E63CFF", "#FF5FA2", "#8B5CF6", "#FFD166", "#FF7B54"],
  ),
  palette(
    "Moss",
    "#133A2A",
    "#7FD18B",
    "#4CA35E",
    "#9C6B45",
    "#FFFFFF",
    "#F6F1E7",
    ["#FFB7C5", "#FFD6A5", "#FFFFFF", "#FF8FAB", "#CDB4DB"],
  ),
  palette(
    "Blush",
    "#FAD4D8",
    "#2E7D4F",
    "#1B5E3A",
    "#6B4226",
    "#FFF0F2",
    "#1A1A1A",
    ["#C8102E", "#FF6F00", "#8E44AD", "#E91E63", "#F9A825"],
  ),
  palette(
    "Mono",
    "#000000",
    "#6E6E6E",
    "#4A4A4A",
    "#8A8A8A",
    "#000000",
    "#FFFFFF",
    ["#F2F2F2", "#BDBDBD"],
  ),
];
