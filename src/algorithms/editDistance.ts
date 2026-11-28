import { subCost, subKind } from './confusables'
import { ABLATE } from './ablation'

// Weighted Damerau–Levenshtein edit distance via dynamic programming.
//
// dp[i][j] = minimum cost to transform a[0..i) into b[0..j). Classic O(n*m)
// table, but the substitution cost is NOT a flat 1: a homoglyph or
// keyboard-neighbour swap is charged far less (see subCost), so a disguised
// brand lands very close to the real one while an unrelated name stays far.
//
// On top of insert/delete/substitute we also model TRANSPOSITION (an adjacent
// character swap, e.g. 'googel' -> 'google'). This is the optimal-string-
// alignment form of Damerau–Levenshtein: a swap costs 1 instead of the 2 a
// plain Levenshtein charges, so common fat-finger typosquats stay within the
// similarity threshold instead of slipping past as "too different".

export type EditOpType = 'match' | 'sub' | 'ins' | 'del' | 'transpose'

export interface EditOp {
  type: EditOpType
  a?: string // character(s) from the candidate
  b?: string // character(s) from the brand
  kind?: 'same' | 'visual' | 'keyboard' | 'different'
}

export interface EditResult {
  distance: number
  ops: number // primitive cell evaluations (for the complexity analysis)
  trace: EditOp[]
}

const INDEL_COST = 1
const TRANSPOSE_COST = 1 // an adjacent swap is one trick, not two edits

export function weightedEditDistance(a: string, b: string): EditResult {
  const n = a.length
  const m = b.length
  const dp: number[][] = Array.from({ length: n + 1 }, () =>
    new Array(m + 1).fill(0),
  )
  let opCount = 0

  for (let i = 1; i <= n; i++) dp[i][0] = i * INDEL_COST
  for (let j = 1; j <= m; j++) dp[0][j] = j * INDEL_COST

  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      opCount++
      const sub = dp[i - 1][j - 1] + subCost(a[i - 1], b[j - 1])
      const del = dp[i - 1][j] + INDEL_COST
      const ins = dp[i][j - 1] + INDEL_COST
      dp[i][j] = Math.min(sub, del, ins)
      // Transposition: a[i-1]a[i-2] reversed matches b[j-2]b[j-1].
      if (!ABLATE.noTranspose && i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        dp[i][j] = Math.min(dp[i][j], dp[i - 2][j - 2] + TRANSPOSE_COST)
      }
    }
  }

  // Backtrack to recover the cheapest sequence of operations (for the
  // human-readable "what trick was used" explanation).
  const trace: EditOp[] = []
  let i = n
  let j = m
  while (i > 0 || j > 0) {
    if (
      !ABLATE.noTranspose && i > 1 && j > 1 &&
      a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1] &&
      dp[i][j] === dp[i - 2][j - 2] + TRANSPOSE_COST
    ) {
      trace.push({ type: 'transpose', a: a[i - 2] + a[i - 1], b: b[j - 2] + b[j - 1] })
      i -= 2
      j -= 2
      continue
    }
    if (i > 0 && j > 0) {
      const c = subCost(a[i - 1], b[j - 1])
      if (dp[i][j] === dp[i - 1][j - 1] + c) {
        trace.push({
          type: c === 0 ? 'match' : 'sub',
          a: a[i - 1],
          b: b[j - 1],
          kind: subKind(a[i - 1], b[j - 1]),
        })
        i--
        j--
        continue
      }
    }
    if (i > 0 && dp[i][j] === dp[i - 1][j] + INDEL_COST) {
      trace.push({ type: 'del', a: a[i - 1] })
      i--
      continue
    }
    trace.push({ type: 'ins', b: b[j - 1] })
    j--
  }
  trace.reverse()

  return { distance: dp[n][m], ops: opCount, trace }
}

/**
 * Similarity in [0,1]: 1 = identical, 0 = nothing in common.
 * Normalised by the longer string so length differences are handled fairly.
 */
export function similarity(distance: number, a: string, b: string): number {
  const len = Math.max(a.length, b.length)
  if (len === 0) return 1
  return Math.max(0, 1 - distance / len)
}
