// Clock mode: the local time as live letters; only the characters that change wither and regrow, in place.
import { seededRandom } from "./kit.ts";
import { addCharacter, createLetter, growLetter } from "./letters.ts";
import { relayout } from "./layout.ts";
import type { EngineState } from "./state.ts";
import type { Letter } from "./types.ts";

const MERIDIEM_SCALE = 0.5; // "am"/"pm" sit smaller on the same baseline

// e.g. "5:04 pm"
export const clockText = (date: Date) =>
  date
    .toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    })
    .toLowerCase();

export function syncClock(state: EngineState, now: number) {
  const text = clockText(new Date()),
    alive = state.letters.filter((l) => !l.diedAt);
  if (alive.map((l) => l.char).join("") === text) return;
  if (alive.length !== text.length) {
    // first show, or the hour gained/lost a digit: start over
    for (const l of alive) l.diedAt = now;
    for (const char of text) addCharacter(state, char, now);
  } else
    alive.forEach((old, i) => {
      if (old.char === text[i]) return;
      old.diedAt = now;
      const letter = createLetter(text[i], state.nextLetterId++, now, {
        wordSeed: old.wordSeed,
        indexInWord: old.indexInWord,
        previousInWord: old.previousInWord,
      });
      growLetter(state, letter);
      const next = alive[i + 1];
      if (next?.previousInWord === old) next.previousInWord = letter;
      if (next?.char === " ") {
        letter.wordEndedAt = now + 200;
        letter.wordEndOrnaments = state.theme.growWordEnd(
          letter,
          200,
          state.grow,
        );
      }
      state.letters.splice(state.letters.indexOf(old) + 1, 0, letter);
    });
  state.letters
    .filter((l) => !l.diedAt)
    .slice(-2)
    .forEach((l) => (l.scale = MERIDIEM_SCALE));
  relayout(state);
}

// Still scenery around the window: invisible letters grown by the theme, drawn fully grown and frozen (see render.ts).
// Grounded themes stand in a row along the bottom; the rest scatter through a band along every edge.
export const clockDecorSize = (state: EngineState) =>
  Math.min(state.width, state.height) * 0.13;
export function clockDecor(state: EngineState): Letter[] {
  const { theme, width, height } = state,
    key = [theme.id, state.font.id, width, height].join();
  if (state.clockDecorKey === key) return state.clockDecor;
  const size = clockDecorSize(state),
    random = seededRandom(theme.id.length * 977 + 7), // same scenery every time for a theme
    anchors: [number, number][] = [];
  if (theme.grounded) {
    const count = Math.ceil(width / (size * 0.8)) + 1;
    for (let i = 0; i < count; i++)
      anchors.push([
        (i + random() * 0.5) * (width / (count - 1)),
        height - size * 0.02,
      ]);
  } else {
    const band = size * 1.1,
      count = Math.round(((width + height) * 2) / (size * 1.4));
    // ponytail: rejection sampling, fine for a few dozen anchors
    for (let tries = 0; anchors.length < count && tries < count * 40; tries++) {
      const x = random() * width,
        y = random() * height,
        edge = Math.min(x, width - x, y, height - y),
        nearClock =
          Math.abs(y - height / 2) < height * 0.18 &&
          x > band &&
          x < width - band;
      if (edge < band && !nearClock) anchors.push([x, y]);
    }
  }
  const savedRandom = state.random;
  state.random = random; // the theme draws its randomness through grow.random
  state.clockDecor = anchors.map(([x, y], i) => {
    const letter = createLetter("o", 1e6 + i, -1e9, {
      wordSeed: Math.floor(random() * 1e9),
      indexInWord: theme.grounded && i % 5 ? 1 : 0, // first letters get the showpieces (sun, big planet, flower)
      x,
      y,
    });
    letter.ornaments = theme.growLetter(letter, state.grow).ornaments;
    letter.wordEndOrnaments = theme.growWordEnd(letter, 0, state.grow);
    return letter;
  });
  state.random = savedRandom;
  state.clockDecorKey = key;
  return state.clockDecor;
}
