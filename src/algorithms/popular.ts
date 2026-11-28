// Popularity gate: is this registrable domain one of the most-visited sites?
// A Bloom filter (src/data/popular.ts): no false negatives, and a ~0.1 % chance that
// an unlisted domain reads as popular. Hash must match scripts/gen-popular.mjs.
import { POPULAR } from '../data/popular'

let bits: Uint8Array | null = null
function load(): Uint8Array {
  if (bits) return bits
  const bin = atob(POPULAR.bits)
  bits = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bits[i] = bin.charCodeAt(i)
  return bits
}
function fnv(s: string, seed: number): number {
  let h = seed >>> 0
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0 }
  return h >>> 0
}
export function isPopular(registrable: string): boolean {
  if (!registrable) return false
  const b = load()
  const h1 = fnv(registrable, 2166136261), h2 = fnv(registrable, 0x9747b28c) | 1
  for (let i = 0; i < POPULAR.k; i++) {
    const j = ((h1 + Math.imul(i, h2)) >>> 0) % POPULAR.m
    if (!(b[j >> 3] & (1 << (j & 7)))) return false
  }
  return true
}
