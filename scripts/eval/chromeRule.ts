// Reimplementation of Chrome's lookalike-domain heuristics, used as the paper's
// head-to-head baseline. Source: chromium components/lookalikes/core/
// lookalike_url_util.cc (blob 1859a271886f52cfc7cceb59a3b14d85987a659f) and
// docs/security/lookalikes/lookalike-domains.md, read 2026-11-28.
//
// GENEROUS to Chrome on purpose: every protected brand domain is treated both
// as a "top domain" AND as a site the user has engaged with, so every
// heuristic that only fires for engaged sites fires here too. Differences
// from Chrome that we cannot reproduce offline are marked `ponytail:`.
import { parseHost } from '../../src/algorithms/scoring'
import { skeleton } from '../../src/algorithms/confusables'
import { registrableParts } from '../../src/data/publicSuffix'
import { BRANDS } from '../../src/data/brands'
import { pathToFileURL } from 'node:url'

export type ChromeAction = 'interstitial' | 'tip' | 'none'

interface Target { domain: string; e2ld: string; skel: string; e2ldSkel: string }
const TARGETS: Target[] = []
for (const b of BRANDS) for (const d of [b.domain, ...(b.altDomains ?? [])]) {
  const { sld } = registrableParts(d)
  TARGETS.push({ domain: d, e2ld: sld, skel: skeleton(d), e2ldSkel: skeleton(sld) })
}
const OFFICIAL = new Set(TARGETS.map((t) => t.domain))

// kSkeletonsOfPopularKeywordsForCSQ, plain spelling.
const CSQ_KEYWORDS = ['account', 'activate', 'admin', 'coin', 'crypto', 'login', 'logout', 'password', 'secure', 'security', 'signin', 'signout', 'wallet']
// ponytail: url_formatter::IsEditDistanceCandidate was not read; we assume the
// e2LD must have >= 5 characters. Verify against top_domain_util before citing.
const MIN_EDIT_DISTANCE_E2LD = 5
const MIN_E2LD_TARGET_EMBEDDING = 4 // kMinE2LDLengthForTargetEmbedding
const MIN_BRAND_CSQ = 4 // kMinBrandNameLengthForComboSquatting (brands longer than this)

function editDistanceAtMostOne(a: string, b: string): boolean {
  if (Math.abs(a.length - b.length) > 1) return false
  let i = 0, j = 0, edits = 0
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { i++; j++; continue }
    if (++edits > 1) return false
    if (a.length > b.length) i++
    else if (a.length < b.length) j++
    else { i++; j++ }
  }
  return edits + (a.length - i) + (b.length - j) <= 1
}
function oneSwap(a: string, b: string): boolean {
  if (a.length !== b.length || a === b) return false
  const d: number[] = []
  for (let k = 0; k < a.length; k++) if (a[k] !== b[k]) d.push(k)
  return d.length === 2 && d[1] === d[0] + 1 && a[d[0]] === b[d[1]] && a[d[1]] === b[d[0]]
}
// IsLikelyEditDistanceFalsePositive
function editFalsePositive(nav: string, tgt: string): boolean {
  if (nav === tgt) return true // only the registry differs
  const trim = (s: string) => s.replace(/[0-9]+$/, '')
  if (trim(nav) === trim(tgt)) return true
  if (nav.length === tgt.length && nav.slice(1) === tgt.slice(1)) return true
  if (nav.slice(1) === tgt || tgt.slice(1) === nav) return true
  if (nav.length !== tgt.length) {
    const [lng, sht] = nav.length > tgt.length ? [nav, tgt] : [tgt, nav]
    let k = 0
    while (k < sht.length && lng[k] === sht[k]) k++
    if (lng[k] === '-') return true
  }
  return false
}

function targetEmbedding(host: string, registrable: string): ChromeAction {
  const tokens = host.split(/[-.]/).filter(Boolean)
  const regE2ld = registrableParts(registrable).sld
  let best: ChromeAction = 'none'
  // Separator-free embedding in the last token ("paypalcom").
  const last = tokens[tokens.length - 1] ?? ''
  for (const t of TARGETS) if (t.e2ld.length > MIN_E2LD_TARGET_EMBEDDING && last === t.domain.replace(/\./g, '')) return 'interstitial'
  for (let end = tokens.length; end >= 1; end--) {
    for (let start = 0; start < end; start++) {
      const cand = tokens.slice(start, end).join('.')
      const t = TARGETS.find((x) => x.domain === cand)
      if (!t || t.e2ld.length <= MIN_E2LD_TARGET_EMBEDDING) continue
      if (t.e2ld === regE2ld) continue // IsCrossTLDMatch / IsEmbeddingItself
      // ponytail: common-word and enterprise-allowlist suppression not modelled.
      const tail = end === tokens.length
      if (!tail) return 'interstitial'
      best = 'tip'
    }
  }
  return best
}

function comboSquat(e2ld: string): boolean {
  const sk = skeleton(e2ld)
  for (const t of TARGETS) {
    const brand = t.e2ldSkel
    if (brand.length <= MIN_BRAND_CSQ || sk === brand) continue
    const bi = sk.indexOf(brand)
    if (bi < 0) continue
    for (const kw of CSQ_KEYWORDS) {
      if (kw.includes(brand) || brand.includes(kw)) continue
      const ki = sk.indexOf(kw)
      if (ki < 0) continue
      const overlap = ki < bi + brand.length && bi < ki + kw.length
      if (!overlap) return true
    }
  }
  return false
}

/** Chrome's action for a navigation to `input`. */
export function chromeAction(input: string): ChromeAction {
  // The browser checks the real host (the part after any '@').
  const { host, registrable, sld } = parseHost(input)
  if (!registrable || OFFICIAL.has(registrable)) return 'none'
  const isIdn = [...host].some((c) => c.charCodeAt(0) > 127)
  const regSkel = skeleton(registrable)
  let best: ChromeAction = 'none'
  const raise = (a: ChromeAction) => { if (a === 'interstitial' || (a === 'tip' && best === 'none')) best = a }

  // 1–2. Skeleton match against engaged / top domains (IDN only).
  if (isIdn && TARGETS.some((t) => t.skel === regSkel)) raise('interstitial')
  // 3. Edit distance / character swap on skeletons (engaged sites -> tip).
  if (best === 'none' && sld.length >= MIN_EDIT_DISTANCE_E2LD) {
    const sldSkel = skeleton(sld)
    for (const t of TARGETS) {
      if (t.e2ld.length < MIN_EDIT_DISTANCE_E2LD) continue
      if (editDistanceAtMostOne(regSkel, t.skel) && !editFalsePositive(sldSkel, t.e2ldSkel)) { raise('tip'); break }
      if (oneSwap(regSkel, t.skel) && sldSkel !== t.e2ldSkel) { raise('tip'); break }
    }
  }
  // 4. Target embedding.
  raise(targetEmbedding(host, registrable))
  // 5. Combo squatting — only when nothing else matched.
  if (best === 'none' && comboSquat(sld)) best = 'tip'
  return best
}

// Self-check: the documented examples behave as Chrome documents them.
if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const cases: [string, ChromeAction][] = [
    ['paypal.com', 'none'],
    ['pаypal.com', 'interstitial'], // Cyrillic а
    ['paypa1.com', 'tip'],
    ['paypal.com.evil.xyz', 'interstitial'],
    ['paypal-com.evil.xyz', 'interstitial'],
    ['paypal-login.xyz', 'tip'],
    ['hdfcbank-kyc.xyz', 'none'],
  ]
  for (const [d, want] of cases) {
    const got = chromeAction(d)
    console.log(d.padEnd(24), got.padEnd(13), got === want ? 'OK' : `EXPECTED ${want}`)
  }
}
