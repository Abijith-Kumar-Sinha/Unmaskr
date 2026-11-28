// Every number in the paper, from one commit, in one run.
//
//   node <tsx> scripts/eval/paper.ts      -> data-eval/paper-results.{json,md}
//
// Detectors : Unmaskr rules (warn / block), Unmaskr LR head (warn / block),
//             Chrome lookalike heuristics (any UI / interstitial, chromeRule.ts),
//             homoglyph-blind Levenshtein t=1, t=2.
// Positives : controlled generator (6 families), dnstwist registered lookalikes,
//             red-team fuzzer (evasion families).   Negatives: Tranco top-50k.
// Adds      : 95 % bootstrap CIs, per-family recall, one-at-a-time ablation,
//             held-out LR calibration (Brier, ECE), latency percentiles.
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { execSync } from 'node:child_process'
import { performance } from 'node:perf_hooks'
import { analyze } from '../../src/algorithms/scoring'
import { predictML } from '../../src/algorithms/mlScore'
import { extractFeatures } from '../../src/algorithms/features'
import { ABLATE, resetAblation, type AblationKey } from '../../src/algorithms/ablation'
import { BRANDS } from '../../src/data/brands'
import { generateLookalikes } from './lookalikes'
import { chromeAction } from './chromeRule'
import { attacks, benign } from '../redteam/fuzz'
import { trainLR, bestF1Threshold, mulberry32, split, fitPlatt, type LRRow } from '../ml/lr'

const ROOT = resolve(import.meta.dirname, '../..')
const DATA = resolve(ROOT, 'data-eval')
const lines = (f: string) => readFileSync(resolve(DATA, f), 'utf8').split(/\r?\n/).filter(Boolean)

// ── Datasets ────────────────────────────────────────────────────────────────
interface Item { d: string; fam: string }
const tranco = lines('tranco-top.txt')
const controlled: Item[] = generateLookalikes().map((s) => ({ d: s.domain, fam: s.family }))
const official = new Set<string>()
for (const b of BRANDS) { official.add(b.domain); for (const a of b.altDomains ?? []) official.add(a) }
const dnstwist: Item[] = []
{
  const seen = new Set<string>()
  for (const line of lines('dnstwist/all.csv')) {
    if (line.startsWith('>>')) continue
    const p = line.split(','); if (p.length < 3) continue
    const fam = p[1].trim(), d = p[2].trim().toLowerCase()
    if (!d || fam === '*original' || fam === 'fuzzer' || official.has(d) || seen.has(d)) continue
    seen.add(d); dnstwist.push({ d, fam })
  }
}
const redteam: Item[] = attacks().filter((c) => !c.family.startsWith('control')).map((c) => ({ d: c.input, fam: c.family }))
const benignCtl: Item[] = benign().map((c) => ({ d: c.input, fam: c.family }))
const POS: Record<string, Item[]> = { controlled, dnstwist, redteam }

// ── Detectors ───────────────────────────────────────────────────────────────
const cores = BRANDS.filter((b) => b.core.length >= 4).map((b) => b.core)
function lev(a: string, b: string): number {
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j), cur = new Array(b.length + 1).fill(0)
  for (let i = 1; i <= a.length; i++) {
    cur[0] = i
    for (let j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
    ;[prev, cur] = [cur, prev]
  }
  return prev[b.length]
}
function levFlag(input: string, t: number): boolean {
  const host = input.toLowerCase().replace(/^[a-z]+:\/\//, '').split(/[/?#]/)[0].split('@').pop() ?? ''
  const labels = host.split('.').filter(Boolean)
  if (official.has(labels.slice(-2).join('.'))) return false
  const sld = labels.length >= 2 ? labels[labels.length - 2] : labels[0] ?? ''
  return cores.some((c) => lev(sld, c) <= t)
}
type Det = (d: string) => boolean
const DETECTORS: Record<string, Det> = {
  'Unmaskr (warn)': (d) => analyze(d).level !== 'safe',
  'Unmaskr (block)': (d) => analyze(d).level === 'dangerous',
  'Unmaskr LR (warn)': (d) => predictML(d).level !== 'safe',
  'Unmaskr LR (block)': (d) => predictML(d).level === 'dangerous',
  'Chrome rule (any UI)': (d) => chromeAction(d) !== 'none',
  'Chrome rule (interstitial)': (d) => chromeAction(d) === 'interstitial',
  'Levenshtein t=1': (d) => levFlag(d, 1),
  'Levenshtein t=2': (d) => levFlag(d, 2),
}

// ── Metrics with bootstrap CIs ──────────────────────────────────────────────
const rng = mulberry32(20261128)
const B = 1000
const mean = (a: boolean[]) => a.reduce((s, x) => s + (x ? 1 : 0), 0) / (a.length || 1)
function resampleMean(a: boolean[]) { let s = 0; for (let i = 0; i < a.length; i++) if (a[Math.floor(rng() * a.length)]) s++; return s / (a.length || 1) }
function ci(fn: () => number) { const v = Array.from({ length: B }, fn).sort((x, y) => x - y); return [v[Math.floor(0.025 * B)], v[Math.floor(0.975 * B)]] as [number, number] }
function metrics(pos: boolean[], neg: boolean[]) {
  const f = (r: number, fpr: number) => {
    const tp = r * pos.length, fp = fpr * neg.length
    const p = tp + fp ? tp / (tp + fp) : 0
    return { precision: p, f1: p + r ? (2 * p * r) / (p + r) : 0 }
  }
  const recall = mean(pos), fpr = mean(neg), { precision, f1 } = f(recall, fpr)
  const boots = Array.from({ length: B }, () => { const r = resampleMean(pos), q = resampleMean(neg); return { r, q, ...f(r, q) } })
  const pick = (k: 'r' | 'q' | 'precision' | 'f1') => { const v = boots.map((b) => b[k]).sort((x, y) => x - y); return [v[Math.floor(0.025 * B)], v[Math.floor(0.975 * B)]] as [number, number] }
  return { n: pos.length, recall, recallCI: pick('r'), fpr, fprCI: pick('q'), fp: Math.round(fpr * neg.length), precision, precisionCI: pick('precision'), f1, f1CI: pick('f1') }
}
const pct = (x: number, dp = 1) => (100 * x).toFixed(dp)
const withCI = (x: number, c: [number, number], dp = 1) => `${pct(x, dp)} [${pct(c[0], dp)}–${pct(c[1], dp)}]`

// ── 1. Head-to-head ─────────────────────────────────────────────────────────
console.log(`controlled ${controlled.length} | dnstwist ${dnstwist.length} | redteam ${redteam.length} | Tranco ${tranco.length}`)
const preds: Record<string, Record<string, boolean[]>> = {}
for (const [name, det] of Object.entries(DETECTORS)) {
  preds[name] = { tranco: tranco.map(det), benign: benignCtl.map((i) => det(i.d)) }
  for (const [set, items] of Object.entries(POS)) preds[name][set] = items.map((i) => det(i.d))
  console.log('  scored', name)
}
const headToHead: Record<string, Record<string, ReturnType<typeof metrics>>> = {}
for (const name of Object.keys(DETECTORS)) {
  headToHead[name] = {}
  for (const set of Object.keys(POS)) headToHead[name][set] = metrics(preds[name][set], preds[name].tranco)
}

// ── 2. Per-family recall ────────────────────────────────────────────────────
const perFamily: Record<string, Record<string, Record<string, { n: number; recall: number }>>> = {}
for (const [set, items] of Object.entries(POS)) {
  perFamily[set] = {}
  const fams = [...new Set(items.map((i) => i.fam))]
  for (const fam of fams) {
    perFamily[set][fam] = {}
    const idx = items.map((it, k) => (it.fam === fam ? k : -1)).filter((k) => k >= 0)
    for (const name of Object.keys(DETECTORS)) perFamily[set][fam][name] = { n: idx.length, recall: idx.filter((k) => preds[name][set][k]).length / idx.length }
  }
}

// ── 3. Ablation (Unmaskr warn + block, one component removed at a time) ─────
const ablation: Record<string, Record<string, number>> = {}
const runUnmaskr = () => {
  const out: Record<string, number> = {}
  for (const [set, items] of Object.entries(POS)) {
    const lv = items.map((i) => analyze(i.d).level)
    out[`${set} warn`] = lv.filter((l) => l !== 'safe').length / lv.length
    out[`${set} block`] = lv.filter((l) => l === 'dangerous').length / lv.length
  }
  const tl = tranco.map((d) => analyze(d).level)
  out['Tranco warn FP'] = tl.filter((l) => l !== 'safe').length
  out['Tranco block FP'] = tl.filter((l) => l === 'dangerous').length
  return out
}
for (const key of ['full', ...Object.keys(ABLATE)] as ('full' | AblationKey)[]) {
  resetAblation()
  if (key !== 'full') ABLATE[key] = true
  ablation[key] = runUnmaskr()
  console.log('  ablation', key)
}
resetAblation()

// ── 4. LR calibration on a held-out split (same seed/split as train-real.ts) ─
interface Row extends LRRow { src: string }
const rows: Row[] = [
  ...dnstwist.map((i) => ({ x: extractFeatures(i.d).values, y: 1 as const, src: 'real' })),
  ...controlled.map((i) => ({ x: extractFeatures(i.d).values, y: 1 as const, src: 'synth' })),
  ...tranco.map((d) => ({ x: extractFeatures(d).values, y: 0 as const, src: 'neg' })),
]
const srng = mulberry32(7)
const parts = ['real', 'synth', 'neg'].map((s) => split(rows.filter((r) => r.src === s), srng))
const trainRows = parts.flatMap((p) => p.tr), testRows = parts.flatMap((p) => p.te)
const lr = trainLR(trainRows)
const thr = bestF1Threshold(trainRows, lr.prob)
// Platt scaling fitted on the TRAIN split's logits, judged on the held-out split.
const platt = fitPlatt(trainRows.map(lr.logit), trainRows.map((r) => r.y))
function calStats(p: number[]) {
  const brier = testRows.reduce((s, r, k) => s + (p[k] - r.y) ** 2, 0) / testRows.length
  const bins = Array.from({ length: 10 }, (_, b) => ({ lo: b / 10, hi: (b + 1) / 10, n: 0, meanP: 0, frac: 0 }))
  testRows.forEach((r, k) => { const b = bins[Math.min(9, Math.floor(p[k] * 10))]; b.n++; b.meanP += p[k]; b.frac += r.y })
  for (const b of bins) if (b.n) { b.meanP /= b.n; b.frac /= b.n }
  const ece = bins.reduce((s, b) => s + (b.n / testRows.length) * Math.abs(b.meanP - b.frac), 0)
  return { brier, ece, bins }
}
const raw = calStats(testRows.map((r) => lr.prob(r)))
const platted = calStats(testRows.map((r) => 1 / (1 + Math.exp(-(platt.a * lr.logit(r) + platt.b)))))
const { brier, ece, bins } = raw
// Same split for the posterior predictive of a positive-only subset: real-data recall at the train threshold.
const realTe = parts[0].te, negTe = parts[2].te
const calibration = {
  train: trainRows.length, test: testRows.length, threshold: thr, brier, ece, bins, platt, calibrated: platted,
  heldOutRealRecall: realTe.filter((r) => lr.prob(r) >= thr).length / realTe.length,
  heldOutFPR: negTe.filter((r) => lr.prob(r) >= thr).length / negTe.length,
  baseRate: testRows.filter((r) => r.y).length / testRows.length,
}

// ── 5. Latency ──────────────────────────────────────────────────────────────
function lat(fn: (d: string) => unknown) {
  for (let i = 0; i < 2000; i++) fn(tranco[i]) // warm up
  const t: number[] = []
  for (const d of tranco) { const t0 = performance.now(); fn(d); t.push(performance.now() - t0) }
  t.sort((a, b) => a - b)
  const q = (p: number) => t[Math.min(t.length - 1, Math.floor(p * t.length))]
  return { mean: t.reduce((a, b) => a + b, 0) / t.length, p50: q(0.5), p95: q(0.95), p99: q(0.99), max: t[t.length - 1] }
}
const latency = { unmaskr: lat(analyze), lr: lat(predictML), chrome: lat(chromeAction) }

// ── Persist ─────────────────────────────────────────────────────────────────
let commit = 'unknown'
try { commit = execSync('git rev-parse --short HEAD', { cwd: ROOT }).toString().trim() + (execSync('git status --porcelain src', { cwd: ROOT }).toString().trim() ? '+dirty' : '') } catch { /* not a repo */ }
const results = {
  generatedAt: new Date().toISOString(), commit, bootstrap: B,
  datasets: { tranco: tranco.length, controlled: controlled.length, dnstwist: dnstwist.length, redteam: redteam.length, benignControls: benignCtl.length },
  headToHead, perFamily, ablation, calibration, latency,
  benignControlFP: Object.fromEntries(Object.keys(DETECTORS).map((n) => [n, preds[n].benign.filter(Boolean).length])),
}
writeFileSync(resolve(DATA, 'paper-results.json'), JSON.stringify(results, null, 2))

// Markdown tables for the paper.
const md: string[] = [`# Paper results — commit ${commit}, ${results.generatedAt.slice(0, 10)}`, '',
  `Datasets: Tranco ${tranco.length} negatives; controlled ${controlled.length}; dnstwist ${dnstwist.length}; red-team ${redteam.length}. 95 % CIs from ${B} bootstrap resamples.`, '']
for (const set of Object.keys(POS)) {
  md.push(`## Head-to-head — ${set} positives vs Tranco`, '', '| Detector | Recall % | FPR % | FP | Precision % | F1 % |', '|---|---|---|---|---|---|')
  for (const name of Object.keys(DETECTORS)) {
    const m = headToHead[name][set]
    md.push(`| ${name} | ${withCI(m.recall, m.recallCI)} | ${withCI(m.fpr, m.fprCI, 2)} | ${m.fp} | ${withCI(m.precision, m.precisionCI)} | ${withCI(m.f1, m.f1CI)} |`)
  }
  md.push('')
}
const short = ['Unmaskr (warn)', 'Unmaskr (block)', 'Unmaskr LR (warn)', 'Chrome rule (any UI)', 'Chrome rule (interstitial)', 'Levenshtein t=1']
for (const set of Object.keys(POS)) {
  md.push(`## Recall by family — ${set}`, '', `| Family | n | ${short.join(' | ')} |`, `|---|---|${short.map(() => '---').join('|')}|`)
  for (const [fam, r] of Object.entries(perFamily[set])) md.push(`| ${fam} | ${r[short[0]].n} | ${short.map((s) => pct(r[s].recall)).join(' | ')} |`)
  md.push('')
}
const ak = Object.keys(ablation.full)
md.push('## Ablation (Unmaskr rules; recall % or FP count)', '', `| Removed | ${ak.join(' | ')} |`, `|---|${ak.map(() => '---').join('|')}|`)
for (const [k, v] of Object.entries(ablation)) md.push(`| ${k} | ${ak.map((c) => (c.includes('FP') ? String(v[c]) : pct(v[c]))).join(' | ')} |`)
md.push('', '## LR calibration (held-out 30 %)', '',
  `Raw (class-weighted LR): Brier ${brier.toFixed(4)}, ECE ${ece.toFixed(4)}. Platt-scaled (fit on train split): Brier ${platted.brier.toFixed(4)}, ECE ${platted.ece.toFixed(4)}. Base rate ${pct(calibration.baseRate, 2)} %, threshold ${calibration.threshold.toFixed(2)}, held-out real recall ${pct(calibration.heldOutRealRecall)} %, held-out FPR ${pct(calibration.heldOutFPR, 2)} %.`, '',
  '| Bin | raw n | raw mean p | raw observed | Platt n | Platt mean p | Platt observed |', '|---|---|---|---|---|---|---|',
  ...bins.map((b, i) => { const c = platted.bins[i]; const f = (x: { n: number; meanP: number; frac: number }) => `${x.n} | ${x.n ? x.meanP.toFixed(3) : '-'} | ${x.n ? x.frac.toFixed(3) : '-'}`; return `| ${b.lo.toFixed(1)}–${b.hi.toFixed(1)} | ${f(b)} | ${f(c)} |` }),
  '', '## Latency (ms per verdict, Tranco sweep)', '', '| Detector | mean | p50 | p95 | p99 | max |', '|---|---|---|---|---|---|',
  ...Object.entries(latency).map(([k, l]) => `| ${k} | ${l.mean.toFixed(3)} | ${l.p50.toFixed(3)} | ${l.p95.toFixed(3)} | ${l.p99.toFixed(3)} | ${l.max.toFixed(2)} |`),
  '', '## Benign controls (IDNs, official + popular domains) flagged', '', ...Object.entries(results.benignControlFP).map(([k, v]) => `- ${k}: ${v} / ${benignCtl.length}`))
writeFileSync(resolve(DATA, 'paper-results.md'), md.join('\n') + '\n')
console.log(md.join('\n'))
