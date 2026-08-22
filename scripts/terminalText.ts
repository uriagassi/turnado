// Terminal output can mangle bidi text — a Hebrew title printed next to
// LTR punctuation (quotes, brackets, parens) often gets its direction
// reordered wrong, especially on Windows' legacy console host (plain
// cmd.exe/PowerShell windows use it; Windows Terminal has meaningfully
// better Unicode bidi support). This can't be fully fixed from here — it's
// a terminal capability — but wrapping free-text values in a directional
// isolate (rather than leaving them to bleed into surrounding ASCII) gives
// terminals that do implement bidi correctly something to work with.
//
// Built via fromCodePoint rather than embedding the actual (invisible)
// characters in the source, so this file stays legible/diff-safe: U+2068
// FIRST STRONG ISOLATE and U+2069 POP DIRECTIONAL ISOLATE. FSI auto-detects
// direction from the wrapped text's own first strong character, so this
// works whether a title/name turns out to be Hebrew, English, or mixed.
const FIRST_STRONG_ISOLATE = String.fromCodePoint(0x2068);
const POP_DIRECTIONAL_ISOLATE = String.fromCodePoint(0x2069);

/** Wraps free-text (a document/doctor title that may be Hebrew, English, or mixed) so its direction doesn't bleed into adjacent ASCII punctuation when printed to a terminal (see module doc). */
export function isolate(text: string): string {
  return `${FIRST_STRONG_ISOLATE}${text}${POP_DIRECTIONAL_ISOLATE}`;
}
