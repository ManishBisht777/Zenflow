import { useState } from "react";
import { Settings } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "./components/ui/sheet.tsx";
import { ScrollArea } from "./components/ui/scroll-area.tsx";
import { AnimatePresence, motion } from "framer-motion";
import { FONTS, PRESETS, type Font, type Mode } from "./engine/config.ts";
import { useEngine } from "./engine/useEngine.ts";
import { THEMES } from "./themes/index.ts";
import type { Theme } from "./engine/types.ts";
import {
  spring,
  SegmentedControl,
  SectionLabel,
} from "./components/controls.tsx";

export default function App() {
  const [exportStatus, setExportStatus] = useState(""),
    [isExporting, setIsExporting] = useState(false);
  const engine = useEngine(THEMES[0], (status, exporting) => {
    setExportStatus(status);
    setIsExporting(exporting);
  });
  const { canvasRef, hiddenInputRef } = engine;
  // React state mirrors the engine's settings so the UI re-renders; the engine is the source of truth for drawing
  const [theme, setTheme] = useState<Theme>(THEMES[0]);
  const [paletteIndex, setPaletteIndex] = useState(0);
  const [font, setFont] = useState<Font>(FONTS[0]);
  const [mode, setMode] = useState<Mode>("type");
  const [presetId, setPresetId] = useState(engine.state.preset);
  const [posterText, setPosterText] = useState(engine.state.posterText);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const colors = theme.palettes[paletteIndex] || theme.palettes[0];
  const selectTheme = (id: string) => {
    const next = THEMES.find((t) => t.id === id)!;
    engine.setTheme(next);
    setTheme(next);
    setPaletteIndex(0);
    if (next.preferredFontId && next.preferredFontId !== font.id)
      selectFont(next.preferredFontId);
    engine.refocusTyping();
  };
  const selectFont = (id: string) => {
    const next = FONTS.find((f) => f.id === id)!;
    engine.setFont(next);
    setFont(next);
    engine.refocusTyping();
  };
  const selectPalette = (index: number) => {
    engine.setPaletteIndex(index);
    setPaletteIndex(index);
    engine.refocusTyping();
  };
  const selectMode = (next: Mode) => {
    // entering poster mode carries over whatever was typed
    if (next === "poster" && mode !== "poster") {
      const text = engine.currentText() || posterText;
      setPosterText(text);
      engine.updatePoster({ posterText: text });
    }
    engine.setMode(next);
    setMode(next);
  };
  const updatePoster = (changes: {
    preset?: string;
    posterText?: string;
    seed?: number;
  }) => {
    engine.updatePoster(changes);
    if (changes.preset) setPresetId(changes.preset);
    if (changes.posterText != null) setPosterText(changes.posterText);
  };
  const videoMimeType = engine.state.videoMimeType;
  const videoButtonLabel = videoMimeType
    ? isExporting
      ? "Exporting…"
      : `Export ${videoMimeType.includes("mp4") ? "MP4" : "WebM"} loop`
    : "Video export unavailable";
  const fontPreviewStyle = (f: Font): React.CSSProperties => ({
    fontFamily: f.family,
    fontWeight: f.weight,
    fontSize: 15,
    letterSpacing: 0,
    lineHeight: 1,
  });

  return (
    <>
      <div
        className="app fixed inset-0 cursor-text font-sans transition-colors duration-500"
        style={{ background: colors.background }}
        onPointerDown={(e) => engine.handlePointerDown(e)}
        onClick={(e) => engine.handleClick(e)}
      >
        <canvas
          ref={canvasRef}
          className="absolute inset-0 size-full"
          style={{ display: mode === "poster" ? "none" : "block" }}
        />
        {/* receives phone keyboard input; desktop typing is read from keydown */}
        <input
          ref={hiddenInputRef}
          onInput={(e) => engine.applyInputChange(e.currentTarget)}
          aria-label="Type to grow"
          autoCapitalize="off"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          className="pointer-events-none fixed top-0 left-0 m-0 size-px border-0 bg-transparent p-0 text-base text-transparent caret-transparent opacity-0"
        />

        <button
          onClick={() => setSettingsOpen(true)}
          aria-label="Settings"
          title="Settings"
          className="absolute top-[calc(16px+env(safe-area-inset-top))] left-[calc(16px+env(safe-area-inset-left))] z-20 flex size-10 cursor-pointer items-center justify-center rounded-full border border-border bg-background text-muted-foreground shadow-sm hover:text-foreground"
        >
          <Settings size={18} />
        </button>

        <AnimatePresence>
          {mode === "poster" && (
            <motion.div
              key="poster"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 grid cursor-default grid-cols-[minmax(280px,340px)_minmax(0,1fr)] bg-black text-xs tracking-[.03em] text-[#EDEDED] max-[720px]:flex max-[720px]:flex-col max-[720px]:overflow-y-auto max-[720px]:touch-pan-y"
            >
              {/* phone: fade under the settings button as the panel scrolls */}
              <div className="pointer-events-none sticky top-0 z-[4] -mb-[calc(60px+env(safe-area-inset-top))] hidden h-[calc(60px+env(safe-area-inset-top))] flex-none bg-linear-to-b from-black from-60% to-transparent max-[720px]:-order-2 max-[720px]:block" />
              <motion.div
                initial={{ x: -32, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ ...spring, delay: 0.05 }}
                className="flex flex-col gap-[26px] overflow-x-hidden overflow-y-auto border-r border-[#1E1E1E] bg-[#0A0A0A] px-[22px] pt-[72px] pb-8 max-[720px]:flex-none max-[720px]:overflow-visible max-[720px]:border-t max-[720px]:border-r-0 max-[720px]:px-4 max-[720px]:pt-5 max-[720px]:pb-[calc(32px+env(safe-area-inset-bottom))]"
              >
                <div className="flex flex-col gap-1">
                  <div className="font-display text-[26px] font-bold text-white">
                    Poster
                  </div>
                  <div className="text-[#8C8C8C]">
                    1:1 · {engine.currentPreset().loopMs / 1000}s loop · 30 fps
                  </div>
                </div>

                <div className="flex flex-col gap-2.5">
                  <SectionLabel>Words</SectionLabel>
                  <input
                    value={posterText}
                    onChange={(e) =>
                      updatePoster({ posterText: e.target.value })
                    }
                    spellCheck={false}
                    style={{ fontFamily: font.family, fontWeight: font.weight }}
                    className="rounded-[10px] border border-[#2A2A2A] bg-black px-3 py-2.5 text-[22px] text-white outline-none focus:border-white"
                  />
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={() =>
                      updatePoster({ seed: Math.floor(Math.random() * 1e6) })
                    }
                    className="cursor-pointer self-start rounded-full border border-[#2A2A2A] px-3 py-2 hover:border-white"
                  >
                    Regrow
                  </motion.button>
                </div>

                <div className="flex flex-col gap-2.5">
                  <SectionLabel>Motion</SectionLabel>
                  <div className="grid grid-cols-2 gap-2">
                    {PRESETS.map((p) => (
                      <motion.button
                        key={p.id}
                        whileHover={{ y: -2 }}
                        whileTap={{ scale: 0.97 }}
                        onClick={() => updatePoster({ preset: p.id })}
                        className="relative flex cursor-pointer flex-col gap-1 rounded-[10px] border border-[#2A2A2A] px-3 py-2.5 text-left text-white"
                      >
                        {presetId === p.id && (
                          <motion.span
                            layoutId="presetHighlight"
                            transition={spring}
                            className="absolute inset-[-1px] rounded-[10px] border border-white bg-[#161616]"
                          />
                        )}
                        <span className="relative text-[13px]">{p.label}</span>
                        <span className="relative text-[11px] text-[#8C8C8C]">
                          {p.description.replace(
                            "{visitor}",
                            theme.visitorName,
                          )}
                        </span>
                      </motion.button>
                    ))}
                  </div>
                </div>

                <div className="flex flex-col gap-2.5 border-t border-[#1E1E1E] pt-5">
                  <SectionLabel>Export · 1080 × 1080 loop</SectionLabel>
                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    onClick={() => engine.exportVideo()}
                    disabled={isExporting}
                    className="cursor-pointer rounded-full bg-white px-3.5 py-3 font-medium text-black disabled:opacity-60"
                  >
                    {videoButtonLabel}
                  </motion.button>
                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    onClick={() => engine.exportFrames()}
                    disabled={isExporting}
                    className="cursor-pointer rounded-full border border-[#3A3A3A] px-3.5 py-[11px] hover:border-white disabled:opacity-60"
                  >
                    PNG frames (.zip)
                  </motion.button>
                  <div className="min-h-4 text-[#8C8C8C]">
                    <AnimatePresence mode="wait">
                      <motion.span
                        key={exportStatus}
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        transition={{ duration: 0.15 }}
                        className="block"
                      >
                        {exportStatus}
                      </motion.span>
                    </AnimatePresence>
                  </div>
                </div>
              </motion.div>

              <div className="flex min-w-0 items-center justify-center px-8 pt-14 pb-8 max-[720px]:-order-1 max-[720px]:flex-none max-[720px]:px-4 max-[720px]:pt-[calc(64px+env(safe-area-inset-top))] max-[720px]:pb-3">
                <motion.canvas
                  ref={engine.setPosterCanvas}
                  width={1080}
                  height={1080}
                  initial={{ scale: 0.94, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ ...spring, delay: 0.1 }}
                  className="block aspect-square h-auto w-[min(100%,calc(100vh-96px))] border border-[#1E1E1E] max-[720px]:w-full max-[720px]:max-w-[520px]"
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* outside the app div so sheet clicks don't bubble (via React) into the engine's handlers */}
      <Sheet open={settingsOpen} onOpenChange={setSettingsOpen}>
        <SheetContent
          onCloseAutoFocus={(e) => {
            e.preventDefault();
            engine.refocusTyping();
          }}
          side="left"
          className="w-[min(380px,calc(100vw-48px))] gap-0 text-xs tracking-[.03em] sm:max-w-none"
        >
          <SheetHeader className="p-5 pb-4">
            <SheetTitle className="font-display text-[22px]">
              Settings
            </SheetTitle>
            <SheetDescription className="text-xs">
              Mode, theme, font and palette.
            </SheetDescription>
          </SheetHeader>

          <ScrollArea className="min-h-0 flex-1">
            <div className="flex flex-col gap-[26px] px-5 pb-[calc(20px+env(safe-area-inset-bottom))]">
              <div className="flex flex-col gap-2.5">
                <SectionLabel>Mode</SectionLabel>
                <SegmentedControl
                  highlightId="modeHighlight"
                  options={[
                    ["type", "Type"],
                    ["poster", "Poster"],
                    ["clock", "Clock"],
                  ]}
                  selected={mode}
                  onSelect={selectMode}
                  className="self-start"
                />
              </div>

              {THEMES.length > 1 && (
                <div className="flex flex-col gap-2.5">
                  <SectionLabel>Theme</SectionLabel>
                  <div className="grid grid-cols-3 gap-2">
                    {THEMES.map((t) => (
                      <motion.button
                        key={t.id}
                        whileHover={{ y: -2 }}
                        whileTap={{ scale: 0.97 }}
                        onClick={() => selectTheme(t.id)}
                        className={`flex cursor-pointer flex-col items-stretch gap-1.5 rounded-[10px] border p-1.5 text-left transition-colors ${theme.id === t.id ? "border-foreground bg-accent" : "border-border hover:border-muted-foreground"}`}
                      >
                        <span
                          className="flex h-6 items-center justify-center gap-1 rounded-md"
                          style={{ background: t.palettes[0].background }}
                        >
                          <span
                            className="size-2.5 rounded-full"
                            style={{ background: t.palettes[0].primary }}
                          />
                          <span
                            className="size-2 rounded-full"
                            style={{ background: t.palettes[0].secondary }}
                          />
                        </span>
                        <span className="px-1 text-[11px]">{t.name}</span>
                      </motion.button>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex flex-col gap-2.5">
                <SectionLabel>Font</SectionLabel>
                <div className="grid grid-cols-3 gap-2">
                  {FONTS.map((f) => (
                    <motion.button
                      key={f.id}
                      whileHover={{ y: -2 }}
                      whileTap={{ scale: 0.97 }}
                      onClick={() => selectFont(f.id)}
                      className={`flex cursor-pointer flex-col items-center gap-1 rounded-[10px] border px-2 py-2 transition-colors ${font.id === f.id ? "border-foreground bg-accent" : "border-border hover:border-muted-foreground"}`}
                    >
                      <span
                        style={{ ...fontPreviewStyle(f), fontSize: 22 }}
                        className="text-foreground"
                      >
                        Aa
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {f.name}
                      </span>
                    </motion.button>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-2.5">
                <SectionLabel>Palette</SectionLabel>
                <div className="grid grid-cols-2 gap-2">
                  {theme.palettes.map((p, i) => (
                    <motion.button
                      key={theme.id + i}
                      whileHover={{ y: -2 }}
                      whileTap={{ scale: 0.97 }}
                      onClick={() => selectPalette(i)}
                      aria-label={p.name}
                      className={`flex cursor-pointer flex-col items-stretch gap-2 rounded-xl border px-1.5 pt-1.5 pb-2 text-left transition-colors ${paletteIndex === i ? "border-foreground" : "border-border hover:border-muted-foreground"}`}
                    >
                      <span
                        className="flex h-11 items-center justify-center rounded-lg"
                        style={{ background: p.background }}
                      >
                        <span
                          className="size-[18px] rounded-full"
                          style={{ background: p.primary }}
                        />
                        <span
                          className="-ml-1 size-3 rounded-full"
                          style={{ background: p.secondary }}
                        />
                        <span
                          className="ml-2 text-lg"
                          style={{
                            color: p.text,
                            fontFamily: font.family,
                            fontWeight: font.weight,
                          }}
                        >
                          Aa
                        </span>
                      </span>
                      <span className="px-1">{p.name}</span>
                    </motion.button>
                  ))}
                </div>
              </div>

              {/* poster mode has its own loop export in the side panel */}
              {mode !== "poster" && (
                <div className="flex flex-col gap-2.5 border-t border-border pt-5">
                  <SectionLabel>Export</SectionLabel>
                  <div className="flex gap-2">
                    {(["PNG", "SVG"] as const).map((format) => (
                      <motion.button
                        key={format}
                        whileTap={{ scale: 0.94 }}
                        onClick={() =>
                          format === "PNG" ? engine.savePNG() : engine.saveSVG()
                        }
                        className="cursor-pointer rounded-full border border-border px-3.5 py-2 text-muted-foreground hover:border-foreground hover:text-foreground"
                      >
                        {format}
                      </motion.button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
        </SheetContent>
      </Sheet>
    </>
  );
}
