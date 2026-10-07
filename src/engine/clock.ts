// Clock mode: the local time as live letters; only the characters that change wither and regrow, in place.
import { addCharacter, createLetter, growLetter } from "./letters.ts";
import { relayout } from "./layout.ts";
import type { EngineState } from "./state.ts";

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
