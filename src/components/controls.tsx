// Small shared UI pieces: segmented pill switcher, palette swatch, section label.
import { motion } from "framer-motion";
import type { Palette } from "../engine/types.ts";

export const spring = { type: "spring", stiffness: 500, damping: 38 } as const;

export type SegmentOption<T extends string> = [
  value: T,
  label: string,
  style?: React.CSSProperties,
  tooltip?: string,
];

// pill row with a sliding highlight (mode switcher)
export function SegmentedControl<T extends string>({
  highlightId,
  options,
  selected,
  onSelect,
  className = "",
}: {
  highlightId: string;
  options: SegmentOption<T>[];
  selected: T;
  onSelect: (value: T) => void;
  className?: string;
}) {
  return (
    <div
      className={`flex gap-1 rounded-full border border-border bg-accent p-1 ${className}`}
    >
      {options.map(([value, label, style, tooltip]) => (
        <button
          key={value}
          onClick={() => onSelect(value)}
          title={tooltip}
          style={style}
          className={`relative shrink-0 cursor-pointer rounded-full px-3.5 py-[7px] text-xs tracking-[.04em] transition-colors ${selected === value ? "text-background" : "text-muted-foreground hover:text-foreground"}`}
        >
          {selected === value && (
            <motion.span
              layoutId={highlightId}
              transition={spring}
              className="absolute inset-0 rounded-full bg-foreground"
            />
          )}
          <span className="relative">{label}</span>
        </button>
      ))}
    </div>
  );
}

export const SectionLabel = ({ children }: { children: React.ReactNode }) => (
  <div className="text-[11px] uppercase tracking-[.08em] text-[#8C8C8C]">
    {children}
  </div>
);

// round palette button: background with a primary dot, ringed in the current text color when selected
export function PaletteSwatch({
  palette,
  isSelected,
  ringColor,
  onSelect,
}: {
  palette: Palette;
  isSelected: boolean;
  ringColor: string;
  onSelect: () => void;
}) {
  return (
    <motion.button
      onClick={onSelect}
      aria-label={palette.name}
      title={palette.name}
      animate={{ scale: isSelected ? 1.1 : 1 }}
      whileHover={{ scale: 1.15 }}
      whileTap={{ scale: 0.9 }}
      transition={spring}
      className="flex size-[22px] cursor-pointer items-center justify-center rounded-full border-[1.5px] p-0"
      style={{
        background: palette.background,
        borderColor: isSelected
          ? ringColor
          : palette.background === ringColor
            ? "var(--border)"
            : "transparent",
      }}
    >
      <span
        className="size-[46%] rounded-full"
        style={{ background: palette.primary }}
      />
    </motion.button>
  );
}
