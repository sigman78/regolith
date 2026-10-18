/**
 * A hand-coded 5×7 rectangle font for stencils. Rows are strings, `#` is paint, so it is plain
 * data: the same text always gives the same cells, on every machine (no OS text rasteriser).
 * Only the glyphs a serial needs: the part letters, digits and a dash.
 */
export const GLYPH_COLS = 5;
export const GLYPH_ROWS = 7;

// prettier-ignore
const FONT: Readonly<Record<string, readonly string[]>> = {
  '-': ['.....', '.....', '.....', '#####', '.....', '.....', '.....'],
  '0': ['.###.', '#...#', '#..##', '#.#.#', '##..#', '#...#', '.###.'],
  '1': ['..#..', '.##..', '..#..', '..#..', '..#..', '..#..', '.###.'],
  '2': ['.###.', '#...#', '....#', '...#.', '..#..', '.#...', '#####'],
  '3': ['#####', '...#.', '..#..', '...#.', '....#', '#...#', '.###.'],
  '4': ['...#.', '..##.', '.#.#.', '#..#.', '#####', '...#.', '...#.'],
  '5': ['#####', '#....', '####.', '....#', '....#', '#...#', '.###.'],
  '6': ['..##.', '.#...', '#....', '####.', '#...#', '#...#', '.###.'],
  '7': ['#####', '....#', '...#.', '..#..', '.#...', '.#...', '.#...'],
  '8': ['.###.', '#...#', '#...#', '.###.', '#...#', '#...#', '.###.'],
  '9': ['.###.', '#...#', '#...#', '.####', '....#', '...#.', '.##..'],
  C: ['.####', '#....', '#....', '#....', '#....', '#....', '.####'],
  D: ['####.', '#...#', '#...#', '#...#', '#...#', '#...#', '####.'],
  E: ['#####', '#....', '#....', '####.', '#....', '#....', '#####'],
  H: ['#...#', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  M: ['#...#', '##.##', '#.#.#', '#.#.#', '#...#', '#...#', '#...#'],
  N: ['#...#', '##..#', '#.#.#', '#..##', '#...#', '#...#', '#...#'],
  P: ['####.', '#...#', '#...#', '####.', '#....', '#....', '#....'],
  V: ['#...#', '#...#', '#...#', '#...#', '#...#', '.#.#.', '..#..'],
};

/** True when `char` has a glyph. */
export function hasGlyph(char: string): boolean {
  return char in FONT;
}

/** Every glyph's rows, for tests. */
export function glyphRows(char: string): readonly string[] {
  return FONT[char] ?? [];
}

/** Painted runs of `text`: row, first column and column count, columns counted across the whole line. */
export function textRuns(text: string): { row: number; col: number; cols: number }[] {
  const runs: { row: number; col: number; cols: number }[] = [];
  for (let row = 0; row < GLYPH_ROWS; row++) {
    let start = -1;
    const flush = (end: number): void => {
      if (start >= 0) runs.push({ row, col: start, cols: end - start });
      start = -1;
    };
    let col = 0;
    for (const ch of text) {
      const line = (FONT[ch] ?? FONT['-'])?.[row] ?? '';
      for (let c = 0; c < GLYPH_COLS; c++) {
        if (line[c] === '#') {
          if (start < 0) start = col + c;
        } else flush(col + c);
      }
      flush(col + GLYPH_COLS);
      col += GLYPH_COLS + 1;
    }
  }
  return runs;
}

/** Columns the line takes, including the gap between glyphs but not after the last. */
export function textColumns(text: string): number {
  const n = [...text].length;
  return n === 0 ? 0 : n * (GLYPH_COLS + 1) - 1;
}
