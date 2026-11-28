// Fast recall / false-alarm check while tuning (full numbers: paper.ts).
import { readFileSync } from 'node:fs'
import { analyze } from '../../src/algorithms/scoring'
import { BRANDS } from '../../src/data/brands'
const official = new Set(BRANDS.flatMap((b) => [b.domain, ...(b.altDomains ?? [])]))
const protectedDomains = new Set(BRANDS.map((b) => b.domain))
const tr = readFileSync('data-eval/tranco-top.txt', 'utf8').split(/\r?\n/).filter(Boolean)
const trSet = new Set(tr)
const ho = readFileSync('data-eval/raw/top-1m.csv', 'utf8').split(/\r?\n/).slice(50000).filter((_, i) => i % 5 === 2).map((r) => r.split(',')[1]).filter(Boolean)
const seen = new Set<string>(); const pos: string[] = []
for (const l of readFileSync('data-eval/dnstwist44/all.csv', 'utf8').split(/\r?\n/)) { const p = l.split(','); if (p.length < 3 || p[1] === '*original' || !protectedDomains.has(p[0]) || official.has(p[2]) || trSet.has(p[2]) || seen.has(p[2])) continue; seen.add(p[2]); pos.push(p[2]) }
const flag = (l: string[]) => l.filter((d) => analyze(d).level !== 'safe').length
console.log(`brands ${BRANDS.length} | dnstwist recall ${(100 * flag(pos) / pos.length).toFixed(1)}% (${pos.length}) | Tranco FP ${flag(tr)} | held-out FP ${flag(ho)} (${(100 * flag(ho) / ho.length).toFixed(3)}%)`)
