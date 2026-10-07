// Letters: creating, growing, regrowing and withering them.
import { relayout } from "./layout.ts";
import type { EngineState } from "./state.ts";
import type { Letter } from "./types.ts";

export const createLetter = (
  char: string,
  id: number,
  bornAt: number,
  extra: Partial<Letter> = {},
): Letter => ({
  char,
  id,
  ornaments: [],
  wordEndOrnaments: null,
  tendril: [],
  bornAt,
  tendrilStartAt: bornAt,
  wordSeed: 0,
  indexInWord: 0,
  previousInWord: null,
  diedAt: null,
  wordEndedAt: null,
  hasPosition: false,
  x: 0,
  y: 0,
  targetX: 0,
  targetY: 0,
  width: 0,
  pointerLean: [0, 0],
  posterBirthOffset: 0,
  posterDeathAt: 0,
  posterWordEndOffset: null,
  ...extra,
});
export function growLetter(state: EngineState, letter: Letter) {
  const grown = state.theme.growLetter(letter, state.grow);
  letter.ornaments = grown.ornaments;
  letter.tendril = grown.tendril;
  letter.wordEndOrnaments = null;
}
// regrow what's on screen (new theme, or new glyph shapes), letter by letter
export function regrowLiveLetters(state: EngineState) {
  const theme = state.theme,
    now = performance.now(),
    alive = state.letters.filter((l) => !l.diedAt);
  let order = 0;
  alive.forEach((letter, i) => {
    if (letter.char === " ") return;
    letter.bornAt = letter.tendrilStartAt = now + order++ * 45;
    growLetter(state, letter);
    const next = alive[i + 1];
    if (next && next.char === " ") {
      letter.wordEndedAt = letter.bornAt + 200;
      letter.wordEndOrnaments = theme.growWordEnd(letter, 200, state.grow);
    } else letter.wordEndedAt = null;
  });
}
export function addCharacter(state: EngineState, char: string, now: number) {
  const alive = state.letters.filter((l) => !l.diedAt),
    last = alive[alive.length - 1];
  if (char === " ") {
    if (last && last.char !== " ") {
      last.wordEndedAt = now;
      last.wordEndOrnaments = state.theme.growWordEnd(
        last,
        now - last.bornAt,
        state.grow,
      );
    }
    state.letters.push(createLetter(" ", state.nextLetterId++, now));
    relayout(state);
    return;
  }
  const sameWord = !!last && last.char !== " ";
  const letter = createLetter(char, state.nextLetterId++, now, {
    wordSeed: sameWord ? last.wordSeed : Math.floor(state.random() * 1e9),
    indexInWord: sameWord ? last.indexInWord + 1 : 0,
    previousInWord: sameWord ? last : null,
  });
  growLetter(state, letter);
  state.letters.push(letter);
  relayout(state);
}
export function witherLastLetter(state: EngineState, now: number) {
  const alive = state.letters.filter((l) => !l.diedAt),
    last = alive[alive.length - 1];
  if (!last) return;
  last.diedAt = now;
  // the previous letter is the word's end again: drop its word-end growth and regrow its tendril
  const previous = alive[alive.length - 2];
  if (previous && previous.char !== " ") {
    previous.wordEndedAt = null;
    previous.wordEndOrnaments = null;
    previous.tendrilStartAt = now;
  }
  relayout(state);
}
export function currentText(state: EngineState) {
  return state.letters
    .filter((l) => !l.diedAt)
    .map((l) => l.char)
    .join("")
    .trim();
}
