import { skeleton } from './confusables'
import { weightedEditDistance, similarity, type EditOp } from './editDistance'
import { findPatterns } from './horspool'
import { decodeHost } from './punycode'
import { registrableParts } from '../data/publicSuffix'
import {
  BRANDS,
  SUSPICIOUS_TLDS,
  LURE_WORDS,
  type Brand,
} from '../data/brands'

export type Level = 'safe' | 'suspicious' | 'dangerous'

export interface Homoglyph {
  orig: string
  canon: string
  script: string
}

export interface Signal {
  label: string
  detail: string
  weight: number
}

export interface Verdict {
  input: string
  host: string
  registrable: string
  sld: string
  tld: string
  skeleton: string
  level: Level
  score: number // 0..100
  brand: Brand | null
  similarity: number
  distance: number
  trace: EditOp[]
  signals: Signal[]
  homoglyphs: Homoglyph[]
  ops: number
}

// Common two-level public suffixes, so a brand on a ccTLD (amazon.co.jp,
export function scriptOf(ch: string): string {
  const c = ch.codePointAt(0) ?? 0
  if (c >= 0x0400 && c <= 0x04ff) return 'Cyrillic'
  if (c >= 0x0370 && c <= 0x03ff) return 'Greek'
  if (c >= 0xff00 && c <= 0xffef) return 'Full-width'
  if (c > 127) return 'Unicode'
  return 'Latin'
}

// The set of letter-scripts present in a label (combining marks ignored, so an
// accented Latin letter like 'ü' counts as Latin, not a separate script). Used
// for UTS #39 mixed-script detection.
export function letterScriptsOf(label: string): Set<string> {
  const scripts = new Set<string>()
  for (const ch of label.normalize('NFD')) {
    if (/\p{M}/u.test(ch)) continue // combining diacritical mark
    if (!/\p{L}/u.test(ch)) continue // digit / hyphen / punctuation
    scripts.add(scriptOf(ch))
  }
  return scripts
}

const ASCII_ONLY = /^[\x00-\x7f]*$/

export function parseHost(input: string) {
  let host = input.trim().toLowerCase()
  host = host.replace(/^[a-z][a-z0-9+.-]*:\/\//, '') // strip scheme
  host = host.split('/')[0].split('?')[0].split('#')[0]
  host = host.replace(/:\d+$/, '') // strip port
  host = decodeHost(host) // xn--pypal-4ve.com -> the real Unicode domain
  const labels = host.split('.').filter(Boolean)
  // Split off the registrable label using the full Public Suffix List, so a
  // brand on any ccTLD (amazon.co.jp, google.com.ua) is read correctly.
  const { sld, suffix: tld, subdomains, registrable } = registrableParts(host)
  const lastLabel = labels[labels.length - 1] ?? ''
  return { host, labels, tld, sld, subdomains, lastLabel, registrable }
}

export function analyze(input: string, extraBrands: Brand[] = [], allow?: Set<string>): Verdict {
  const allBrands = extraBrands.length ? [...BRANDS, ...extraBrands] : BRANDS
  const substrBrands = allBrands.filter((b) => b.core.length >= 4)

  const { host, tld, sld, subdomains, lastLabel, registrable } = parseHost(input)
  const sldSkel = skeleton(sld)

  // User-reported false positive: the user vouched for this domain, so trust it
  // outright (even over a homoglyph signal — it's their call, on their device).
  if (allow?.has(registrable)) {
    return {
      input, host, registrable, sld, tld, skeleton: skeleton(host),
      level: 'safe', score: 0, brand: null, similarity: 1,
      distance: 0, trace: [], homoglyphs: [], ops: 0,
      signals: [{ label: 'Marked safe by you', detail: `You reported ${registrable} as legitimate, so Unmaskr won't flag it.`, weight: 0 }],
    }
  }

  // Confusable-character analysis (UTS #39). `mixedScript`: the label mixes
  // Latin with another script (Latin 'p' + Cyrillic 'а' in 'pаypal') — always a
  // homoglyph attack. `confusableFold`: it carries a non-ASCII character that
  // folds to a *different* ASCII letter (Cyrillic 'а'→a, roman-numeral 'ⅿ'→m,
  // decorated 'ṗ'→p). Whether a fold is an attack is decided below, once we know
  // the de-confused label actually lands on a brand — so a legitimate accented
  // IDN like 'münchen' (which imitates no brand) is left alone.
  const sldScripts = letterScriptsOf(sld)
  const mixedScript = sldScripts.size > 1 && [...sldScripts].some((s) => s !== 'Latin')
  let confusableFold = false
  for (const ch of sld) {
    if (ch.charCodeAt(0) <= 127) continue
    const canon = skeleton(ch)
    if (canon !== ch && ASCII_ONLY.test(canon)) { confusableFold = true; break }
  }

  // Nearest brand by weighted edit distance (longer cores only, to avoid
  // 3-letter cores matching everything).
  let nearest: Brand | null = null
  let bestSim = 0
  let bestDist = Infinity
  let ops = 0
  for (const b of allBrands) {
    if (b.core.length < 4) continue
    const r = weightedEditDistance(sldSkel, b.core)
    ops += r.ops
    const sim = similarity(r.distance, sldSkel, b.core)
    if (sim > bestSim) {
      bestSim = sim
      bestDist = r.distance
      nearest = b
    }
  }

  const officialByDomain = allBrands.find(
    (b) =>
      registrable === b.domain ||
      b.altDomains?.includes(registrable) ||
      // Global brand that owns its exact name on any non-throwaway TLD. Match the
      // RAW label (not its skeleton) so a confusable look-alike is never official.
      (b.ownsName === true && sld === b.core && !SUSPICIOUS_TLDS.has(lastLabel)),
  )
  const exactCoreBrand = allBrands.find((b) => b.core === sld)
  const skelCoreBrand = allBrands.find((b) => b.core === sldSkel)
  const subMatches = findPatterns(sldSkel, substrBrands.map((b) => b.core))
  // A brand core appearing as a whole hyphen/underscore-delimited token — even a
  // short one like 'sbi' that is too short for safe substring matching. Exact
  // token only ('sbinary' is NOT a match), and only treated as an attack when
  // corroborated (see the branch below), so it stays precise.
  const tokens = sldSkel.split(/[-_]+/).filter(Boolean)
  const tokenBrand = allBrands.find((b) => b.core.length >= 3 && b.core !== sld && tokens.includes(b.core))
  const tldSuspicious = SUSPICIOUS_TLDS.has(lastLabel)
  const lure = LURE_WORDS.filter(
    (w) => sldSkel.includes(w) || subdomains.some((s) => skeleton(s).includes(w)),
  )

  // Finalise the homoglyph verdict (see confusable-character analysis above): a
  // mixed-script label is always an attack; a confusable fold counts only when
  // the de-confused label resembles a protected brand (exact skeleton match,
  // embedded brand, or >=0.85 similar). This keeps legitimate accented / non-
  // Latin IDNs that imitate no brand off the list.
  const brandProximate = !!skelCoreBrand || subMatches.length > 0 || (nearest !== null && bestSim >= 0.85)
  const homoglyphUsed = mixedScript || (confusableFold && brandProximate)
  const homoglyphs: Homoglyph[] = []
  if (homoglyphUsed) {
    for (const ch of sld) {
      if (ch.charCodeAt(0) <= 127) continue
      const canon = skeleton(ch)
      if (canon !== ch && ASCII_ONLY.test(canon)) homoglyphs.push({ orig: ch, canon, script: scriptOf(ch) })
    }
  }

  const signals: Signal[] = []
  let risk = 0
  const add = (label: string, detail: string, weight: number) => {
    signals.push({ label, detail, weight })
    risk += weight
  }

  // ── Legitimate official domain (and not disguised) → safe ──
  if (officialByDomain && !homoglyphUsed) {
    return {
      input, host, registrable, sld, tld, skeleton: skeleton(host),
      level: 'safe', score: 2, brand: officialByDomain, similarity: 1,
      distance: 0, trace: [], homoglyphs: [], ops,
      signals: [{ label: 'Official domain', detail: `Exact match for ${officialByDomain.name}'s real domain (${officialByDomain.domain}).`, weight: 0 }],
    }
  }

  // ── Identify the impersonated brand explicitly, per signal ──
  let impersonated: Brand | null = null

  if (homoglyphUsed) {
    const list = homoglyphs.map((h) => `'${h.orig}'→'${h.canon}' (${h.script})`).join(', ')
    add('Homoglyph characters', `Disguised look-alike characters: ${list}.`, 0.45)
  }

  if (skelCoreBrand && !exactCoreBrand) {
    impersonated = skelCoreBrand
    add('Skeleton matches a brand', `'${sld}' normalises to '${skelCoreBrand.core}' — a disguised copy of ${skelCoreBrand.name}.`, 0.4)
  } else if (exactCoreBrand && !officialByDomain) {
    // A learned ("your site") brand often spans several legitimate TLDs
    // (github.com, github.io, github.community). For those, only flag a
    // different-TLD match when corroborated (throwaway TLD / lure / homoglyph) —
    // otherwise it is almost certainly the same company's other domain, not an
    // impersonation. Curated brands (e.g. banks) keep the strict behaviour.
    const learned = exactCoreBrand.category === 'Your site'
    if (!learned || tldSuspicious || lure.length > 0 || homoglyphUsed) {
      impersonated = exactCoreBrand
      add('Brand name on a non-official domain', `Uses '${exactCoreBrand.core}' but the domain ${registrable} is not the official ${exactCoreBrand.domain}.`, tldSuspicious ? 0.5 : 0.32)
    }
  } else if (subMatches.length) {
    const longest = subMatches.reduce((a, b) => (b.pattern.length > a.pattern.length ? b : a))
    const b = substrBrands.find((x) => x.core === longest.pattern)
    // A brand embedded in a *longer* label is only an attack when corroborated by
    // a lure word, a throwaway TLD, or a homoglyph — benign brand-owned products
    // and infrastructure embed the name too (amazonvideo.com, googleblog.com).
    // The exception is when the label is the brand plus only a 1–2 char tweak
    // (googlee, appple): that is a typosquat, not a product name, so flag it.
    const typoClose = b ? sldSkel.length - b.core.length <= 2 : false
    const corroborated = lure.length > 0 || tldSuspicious || homoglyphUsed || typoClose
    if (b && sld !== b.core && corroborated) {
      impersonated = b
      add('Brand hidden in a longer name', `'${b.core}' (${b.name}) is embedded inside '${sld}'.`, 0.4)
    }
  } else if (tokenBrand && !officialByDomain && (lure.length > 0 || tldSuspicious)) {
    // Brand used as a standalone word beside a lure / on a throwaway TLD
    // (sbi-rewards.online). Exact-token match + corroboration keeps it precise.
    impersonated = tokenBrand
    add('Brand name combined with other words', `'${tokenBrand.core}' (${tokenBrand.name}) is used as a word in '${sld}', not the official ${tokenBrand.domain}.`, tldSuspicious ? 0.5 : 0.4)
  } else if (nearest && bestDist > 0) {
    const rr = weightedEditDistance(sldSkel, nearest.core)
    const visual = rr.trace.some((o) => o.kind === 'visual')
    const swapped = rr.trace.some((o) => o.type === 'transpose')
    // Short cores (<=5) can't reach 0.8 similarity with even one edit, so accept
    // a single transposition there — a letter swap is a strong typosquat signal
    // and (unlike a substitution) rarely collides with unrelated real words.
    const shortCoreSwap = nearest.core.length <= 5 && bestDist <= 1 && swapped
    if (bestSim >= 0.8 || shortCoreSwap) {
      impersonated = nearest
      const how = visual ? ', via a digit/letter swap' : swapped ? ', via swapped letters' : ''
      add('Look-alike of a brand', `'${sld}' is ${Math.round(bestSim * 100)}% similar to '${nearest.core}' (${nearest.name})${how}.`, visual ? 0.45 : 0.3)
    }
  }

  // ── Brand only in a sub-domain (the real target sits in the sub-domain) ──
  const subBrand = allBrands.find((b) => b.core.length >= 4 && subdomains.some((s) => skeleton(s) === b.core || skeleton(s).includes(b.core)))
  if (subBrand && !officialByDomain) {
    impersonated = impersonated ?? subBrand
    add('Brand in a sub-domain', `'${subBrand.core}' (${subBrand.name}) appears as a sub-domain, but the real owner is '${registrable}'.`, 0.3)
  }

  // Homoglyphs present but no brand pinned yet → attach the nearest if close.
  if (homoglyphUsed && !impersonated && nearest && bestSim >= 0.7) impersonated = nearest

  // ── Secondary signals ──
  if (tldSuspicious) add('Suspicious top-level domain', `.${lastLabel} is frequently used for throwaway phishing sites.`, 0.12)
  if (lure.length && impersonated) add('Urgency / lure keywords', `Contains ${lure.map((w) => `'${w}'`).join(', ')} — classic phishing bait.`, 0.15)

  // ── Aggregate ──
  // Escalate only for an *impersonation* signal (a matched/embedded brand or a
  // homoglyph disguise). A secondary signal on its own — e.g. just a throwaway
  // TLD with no brand resemblance — must not raise a warning, otherwise
  // legitimate sites on .live/.site/.link domains flood the false-positive rate.
  const impersonationSignal = impersonated !== null || homoglyphUsed
  let score = Math.round(Math.min(1, risk) * 100)
  let level: Level = score >= 65 ? 'dangerous' : score >= 30 ? 'suspicious' : 'safe'
  if (homoglyphUsed && impersonated) { level = 'dangerous'; score = Math.max(score, 80) }
  else if (impersonationSignal && level === 'safe') level = 'suspicious'

  if (!signals.length) {
    signals.push({ label: 'No brand impersonation detected', detail: 'The domain does not closely resemble any protected brand.', weight: 0 })
  }

  // Alignment trace against the actually-impersonated brand (for display).
  let trace: EditOp[] = []
  let distance = bestDist
  let simShown = bestSim
  if (impersonated) {
    const rr = weightedEditDistance(sldSkel, impersonated.core)
    trace = rr.trace
    distance = rr.distance
    simShown = similarity(rr.distance, sldSkel, impersonated.core)
  }

  return {
    input, host, registrable, sld, tld, skeleton: skeleton(host),
    level, score, brand: impersonated,
    similarity: simShown, distance, trace,
    signals, homoglyphs, ops,
  }
}
