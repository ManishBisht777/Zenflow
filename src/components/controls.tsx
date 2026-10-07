// Small shared UI pieces: segmented pill switcher, palette swatch, section label.
import { motion } from 'framer-motion';
import type { Palette } from '../engine/types.ts';

export const spring = { type: 'spring', stiffness: 500, damping: 38 } as const;

export type SegmentOption<T extends string> = [value: T, label: string, style?: React.CSSProperties, tooltip?: string];

// pill row with a sliding highlight (theme, font and mode switchers)
export function SegmentedControl<T extends string>({ highlightId, options, selected, onSelect, className = '' }: {
  highlightId: string; options: SegmentOption<T>[]; selected: T; onSelect: (value: T) => void; className?: string;
}) {
  return (
    <div className={`z-10 flex gap-1 rounded-full border border-[#2A2A2A] bg-black p-1 ${className}`}>
      {options.map(([value, label, style, tooltip]) => (
        <button key={value} onClick={() => onSelect(value)} title={tooltip} style={style}
          className={`relative shrink-0 cursor-pointer rounded-full px-3.5 py-[7px] text-xs tracking-[.04em] transition-colors ${selected === value ? 'text-black' : 'text-[#BDBDBD] hover:text-white'}`}>
          {selected === value && <motion.span layoutId={highlightId} transition={spring} className="absolute inset-0 rounded-full bg-white" />}
          <span className="relative">{label}</span>
        </button>
      ))}
    </div>
  );
}

export function PaletteSwatch({ palette, isSelected, ringColor, onSelect }: { palette: Palette; isSelected: boolean; ringColor: string; onSelect: (e: React.MouseEvent) => void }) {
  return (
    <motion.button onClick={onSelect} aria-label={palette.name} title={palette.name}
      animate={{ scale: isSelected ? 1.1 : 1 }} whileHover={{ scale: 1.15 }} whileTap={{ scale: 0.9 }} transition={spring}
      className="flex size-[22px] cursor-pointer items-center justify-center rounded-full border-[1.5px] p-0 max-[600px]:size-[clamp(13px,calc((100vw_-_183px)/10),22px)]"
      style={{ background: palette.background, borderColor: isSelected ? ringColor : palette.background === ringColor ? '#3A3A3A' : 'transparent' }}>
      <span className="size-[46%] rounded-full" style={{ background: palette.primary }} />
    </motion.button>
  );
}

export const SectionLabel = ({ children }: { children: React.ReactNode }) => <div className="text-[11px] uppercase tracking-[.08em] text-[#8C8C8C]">{children}</div>;
