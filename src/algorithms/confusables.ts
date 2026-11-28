import { CONFUSABLES_FULL } from '../data/confusablesMap'
import { ABLATE } from './ablation'

// Unicode skeleton normalization (in the spirit of UTS #39).
//
// A homoglyph attack hides a domain behind characters that LOOK like Latin
// letters but are different code points (Cyrillic 'а', Greek 'ο', full-width
// 'ａ', accented 'á'). Plain string comparison treats them as different, so the
// disguise survives. skeleton() collapses them to a canonical Latin form so the
// disguise is stripped before we compare anything.

// Look-alikes that Unicode NFKD does NOT fold, keyed by the confusable char.
// The bulk is the full Unicode UTS #39 confusables table (CONFUSABLES_FULL,
// 1600+ single-character mappings, auto-generated from confusables.txt). We add
// the separator/dot look-alikes the alphanumeric table omits but that matter for
// faking sub-domains, and they take precedence.
const CONFUSABLES: Record<string, string> = {
  ...CONFUSABLES_FULL,
  // Dot / separator look-alikes (used to fake sub-domains)
  '․': '.', '．': '.', '。': '.', '｡': '.', '·': '.',
}

/**
 * Collapse a string to its homoglyph-free "skeleton":
 *   1. NFKD - folds full-width forms and splits accents into base + mark.
 *   2. Drop the combining marks (so 'á' -> 'a').
 *   3. Map remaining Cyrillic/Greek/etc. look-alikes to Latin.
 */
export function skeleton(input: string): string {
  const decomposed = input.normalize('NFKD').toLowerCase()
  let out = ''
  for (const ch of decomposed) {
    if (/\p{M}/u.test(ch)) continue // combining diacritical mark
    out += CONFUSABLES[ch] ?? ch
  }
  return out
}

/** True if the string contains any non-ASCII (potential homoglyph) character. */
export function hasNonAscii(input: string): boolean {
  for (let i = 0; i < input.length; i++) {
    if (input.charCodeAt(i) > 127) return true
  }
  return false
}

// Cheap-substitution pairs for the weighted edit distance.
// Digit-for-letter and letter look-alikes a scammer swaps in (paypa1 -> paypal,
// g00gle -> google). A swap between these costs far less than a random one.
const VISUAL_PAIRS = [
  ['0', 'o'], ['1', 'l'], ['1', 'i'], ['5', 's'], ['3', 'e'], ['4', 'a'],
  ['7', 't'], ['8', 'b'], ['9', 'g'], ['6', 'g'], ['2', 'z'], ['l', 'i'],
  ['o', 'q'], ['c', 'e'], ['v', 'u'], ['m', 'n'], ['w', 'v'],
]
const visualSet = new Set<string>()
for (const [a, b] of VISUAL_PAIRS) {
  visualSet.add(a + b)
  visualSet.add(b + a)
}

// QWERTY neighbours - a fat-finger typo costs less than an arbitrary edit.
const KEYBOARD_ROWS = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm']
const keyboardSet = new Set<string>()
for (const row of KEYBOARD_ROWS) {
  for (let i = 0; i < row.length - 1; i++) {
    keyboardSet.add(row[i] + row[i + 1])
    keyboardSet.add(row[i + 1] + row[i])
  }
}

export const VISUAL_COST = 0.25
export const KEYBOARD_COST = 0.6
export const NORMAL_COST = 1

/** Cost of substituting character `a` with `b`. */
export function subCost(a: string, b: string): number {
  if (a === b) return 0
  if (ABLATE.uniformCosts) return NORMAL_COST
  if (visualSet.has(a + b)) return VISUAL_COST
  if (keyboardSet.has(a + b)) return KEYBOARD_COST
  return NORMAL_COST
}

/** Classify why two characters were treated as similar (for explanations). */
export function subKind(
  a: string,
  b: string,
): 'same' | 'visual' | 'keyboard' | 'different' {
  if (a === b) return 'same'
  if (visualSet.has(a + b)) return 'visual'
  if (keyboardSet.has(a + b)) return 'keyboard'
  return 'different'
}
