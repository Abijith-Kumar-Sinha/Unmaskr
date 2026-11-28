// Popularity gate: is this registrable domain one of the most-visited sites?
// Exact membership in a sorted list (src/data/popular.ts), by binary search over
// line offsets — no false positives an attacker could search for.
import { POPULAR_SORTED } from '../data/popular'

let starts: Uint32Array | null = null
function index(): Uint32Array {
  if (starts) return starts
  const s = POPULAR_SORTED
  let n = 1
  for (let i = 0; i < s.length; i++) if (s.charCodeAt(i) === 10) n++
  starts = new Uint32Array(n + 1)
  let k = 1
  for (let i = 0; i < s.length; i++) if (s.charCodeAt(i) === 10) starts[k++] = i + 1
  starts[n] = s.length + 1 // sentinel: end of the last line + 1
  return starts
}

export function isPopular(domain: string): boolean {
  if (!domain) return false
  const st = index(), s = POPULAR_SORTED
  let lo = 0, hi = st.length - 2
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    const line = s.slice(st[mid], st[mid + 1] - 1)
    if (line === domain) return true
    if (line < domain) lo = mid + 1
    else hi = mid - 1
  }
  return false
}
