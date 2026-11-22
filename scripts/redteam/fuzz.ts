// Unmaskr red-team evasion fuzzer (VAPT layer).
//
// Plays the attacker: for every protected brand it generates domains built with
// one evasion technique each, runs them through the live detector, and reports
// the bypass rate per technique (bypass = verdict 'safe'). A benign control set
// measures the cost side (false positives on legitimate IDNs / official domains).
//
// Deterministic (fixed word lists, no randomness) so before/after runs compare.
//   npx tsx scripts/redteam/fuzz.ts [label]     -> data-eval/redteam-<label>.json
import { writeFileSync, mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { analyze } from '../../src/algorithms/scoring'
import { BRANDS } from '../../src/data/brands'

type Case = { family: string; input: string }

// Non-lure words attackers glue onto a brand (combosquatting). Lure words like
// 'login'/'kyc' are already covered by the engine, so these test the gap beyond.
const COMBO_WORDS = ['netbanking', 'upi', 'cards', 'customer', 'online', 'india', 'payments', 'app', 'portal', 'rewards']
// Cheap, heavily abused new gTLDs that are not "suspicious" in the engine's list.
const ABUSED_TLDS = ['sbs', 'cfd', 'bond', 'cyou', 'autos', 'lol', 'ink', 'beauty', 'quest', 'mom']
// Invisible characters (ZWSP, soft hyphen…) are NOT a hostname attack: browsers drop them
// (UTS #46 "ignored"), so pay<ZWSP>pal.com navigates to the real paypal.com.

function bitsquats(core: string): string[] {
  const out: string[] = []
  for (let i = 0; i < core.length; i++) {
    for (let bit = 0; bit < 8; bit++) {
      const c = String.fromCharCode(core.charCodeAt(i) ^ (1 << bit))
      if (/[a-z0-9]/.test(c)) out.push(core.slice(0, i) + c + core.slice(i + 1))
    }
  }
  return out.slice(0, 6)
}

function attacks(): Case[] {
  const cases: Case[] = []
  const add = (family: string, input: string) => cases.push({ family, input })
  for (const b of BRANDS) {
    if (b.core.length < 4) continue
    const { core, domain } = b
    // 1. Official domain hidden in the URL's username part (https://brand.com@evil.xyz)
    add('userinfo-trick', `https://${domain}@secure-check.xyz/login`)
    // 2. Full official domain used as a sub-domain prefix
    add('domain-as-subdomain', `${domain}.account-check.xyz`)
    add('domain-as-subdomain', `${domain}.verify-portal.com`)
    // 3. Combosquatting on mainstream TLDs, no lure word
    for (const w of COMBO_WORDS) add('combosquat-com', `${core}-${w}.com`)
    for (const w of COMBO_WORDS.slice(0, 4)) add('combosquat-com', `${w}-${core}.in`)
    // 4. Exact brand name on a cheap, abused new gTLD
    for (const t of ABUSED_TLDS) add('brand-on-abused-tld', `${core}.${t}`)
    // 5. Homoglyph inside the TLD instead of the name
    add('homoglyph-in-tld', `${core}.cоm`) // Cyrillic 'о'
    // 7. Bit-flip squats
    for (const s of bitsquats(core)) add('bitsquat', `${s}.com`)
    // 8. Indic digit-zero for 'o' (Kannada ೦ / Devanagari ०) — in the confusables table
    if (core.includes('o')) {
      add('indic-zero', `${core.replace('o', '೦')}.com`)
      add('indic-zero', `${core.replace('o', '०')}.com`)
    }
    // Controls the engine was designed for (should stay ~0% bypass)
    const cyr = core.replace('a', 'а').replace('o', 'о').replace('e', 'е')
    if (cyr !== core) add('control-cyrillic', `${cyr}.com`)
    add('control-typo', `${core.slice(0, -1)}${core.slice(-1) === 'e' ? 'a' : 'e'}.com`)
  }
  return cases
}

// Benign controls: legitimate domains that must NOT be flagged.
function benign(): Case[] {
  const out: Case[] = []
  for (const d of ['københavn.dk', 'straße.de', 'łódź.pl', 'ærø.dk', 'göteborg.se', 'münchen.de', 'zürich.ch', 'españa.com', 'café.fr', 'ελλάδα.gr', 'россия.рф', 'भारत.भारत'])
    out.push({ family: 'benign-idn', input: d })
  for (const b of BRANDS) {
    out.push({ family: 'benign-official', input: b.domain })
    for (const a of b.altDomains ?? []) out.push({ family: 'benign-official', input: a })
  }
  for (const d of ['github.com', 'wikipedia.org', 'stackoverflow.com', 'zerodha.com', 'swiggy.com', 'zomato.com', 'makemytrip.com', 'nykaa.com', 'cred.club', 'groww.in'])
    out.push({ family: 'benign-popular', input: d })
  return out
}

type Row = { family: string; n: number; safe: number; suspicious: number; dangerous: number }
function run(cases: Case[]) {
  const rows = new Map<string, Row>()
  const misses: Record<string, string[]> = {}
  for (const c of cases) {
    const v = analyze(c.input)
    const r = rows.get(c.family) ?? { family: c.family, n: 0, safe: 0, suspicious: 0, dangerous: 0 }
    r.n++
    r[v.level]++
    rows.set(c.family, r)
    const isBenign = c.family.startsWith('benign')
    if ((isBenign && v.level !== 'safe') || (!isBenign && v.level === 'safe')) (misses[c.family] ??= []).push(c.input)
  }
  return { rows: [...rows.values()], misses }
}

const label = process.argv[2] ?? 'latest'
const atk = run(attacks())
const ben = run(benign())
const pct = (x: number, n: number) => `${((100 * x) / n).toFixed(1)}%`.padStart(7)

console.log(`\nUnmaskr red-team fuzz  [${label}]\n`)
console.log('ATTACK FAMILY'.padEnd(22), 'n'.padStart(5), 'BYPASS'.padStart(7), 'warn'.padStart(7), 'block'.padStart(7))
for (const r of atk.rows) console.log(r.family.padEnd(22), String(r.n).padStart(5), pct(r.safe, r.n), pct(r.suspicious, r.n), pct(r.dangerous, r.n))
const tot = atk.rows.reduce((a, r) => ({ n: a.n + r.n, safe: a.safe + r.safe }), { n: 0, safe: 0 })
console.log('ALL ATTACKS'.padEnd(22), String(tot.n).padStart(5), pct(tot.safe, tot.n))
console.log('\nBENIGN CONTROL'.padEnd(23), 'n'.padStart(5), 'FALSE+'.padStart(7))
for (const r of ben.rows) console.log(r.family.padEnd(22), String(r.n).padStart(5), pct(r.n - r.safe, r.n))
for (const [f, m] of Object.entries({ ...atk.misses, ...ben.misses })) console.log(`  ${f}: e.g. ${m.slice(0, 3).map((s) => JSON.stringify(s)).join(', ')}`)

mkdirSync(resolve(import.meta.dirname, '../../data-eval'), { recursive: true })
const out = resolve(import.meta.dirname, `../../data-eval/redteam-${label}.json`)
writeFileSync(out, JSON.stringify({ label, ts: new Date().toISOString(), attacks: atk, benign: ben }, null, 2))
console.log(`\n-> ${out}`)
