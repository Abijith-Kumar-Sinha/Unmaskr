// False alarms on the long tail: Tranco ranks 50,001–1,000,000 (every 5th site).
//   node <tsx> scripts/eval/longtail.ts
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { analyze } from '../../src/algorithms/scoring'
const ROOT = resolve(import.meta.dirname, '../..')
const rows = readFileSync(resolve(ROOT, 'data-eval/raw/top-1m.csv'), 'utf8').split(/\r?\n/).filter(Boolean)
const sample = rows.slice(50000).filter((_, i) => i % 5 === 0).map((r) => r.split(',')[1])
const bySignal = new Map<string, string[]>()
let warn = 0, block = 0
for (const d of sample) {
  const v = analyze(d)
  if (v.level === 'safe') continue
  warn++; if (v.level === 'dangerous') block++
  const key = v.signals.filter((s) => s.weight > 0).map((s) => s.label).sort().join(' + ')
  const a = bySignal.get(key) ?? []; a.push(`${d}${v.level === 'dangerous' ? '!' : ''}`); bySignal.set(key, a)
}
const out = [`long tail: ${sample.length} sites, warn ${warn} (${(100 * warn / sample.length).toFixed(2)} %), block ${block}`]
for (const [k, v] of [...bySignal].sort((a, b) => b[1].length - a[1].length)) out.push(`${String(v.length).padStart(5)}  ${k}\n        ${v.slice(0, 12).join(', ')}`)
writeFileSync(resolve(ROOT, 'data-eval/longtail.txt'), out.join('\n') + '\n')
console.log(out.slice(0, 30).join('\n'))
