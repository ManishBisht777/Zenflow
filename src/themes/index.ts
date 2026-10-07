// Theme registry. To add a theme (nature, forest…):
//   1. copy water.ts (no stems) or garden/ (stems) → nature.ts
//   2. change growLetter / growWordEnd (what grows from each letter), draw (one function per ornament kind), palettes, drawVisitor
//   3. import it below and add it to THEMES — it shows up in both switchers automatically
// The Theme contract is documented in src/engine/types.ts; shared shape helpers live in src/engine/kit.ts.
import garden from './garden/index.ts';
import space from './space.ts';
import water from './water.ts';
import city from './city.ts';
import desert from './desert.ts';
import mountain from './mountain.ts';
import floral from './floral.ts';

export const THEMES = [garden, space, water, city, desert, mountain, floral];
