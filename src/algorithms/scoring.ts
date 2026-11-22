import { skeleton } from './confusables'
import { weightedEditDistance, similarity, type EditOp } from './editDistance'
import { findPatterns } from './horspool'
import { decodeHost } from './punycode'
import { registrableParts } from '../data/publicSuffix'
import {
  BRANDS,
  SUSPICIOUS_TLDS,
  COMMON_TLDS,
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

// Real Unicode Script property (not code-point ranges), so legitimate Latin
// letters outside ASCII — 'ø', 'ł', 'ß', 'æ' — count as Latin. The old range
// check called them 'Unicode', which made københavn.dk / straße.de look
// mixed-script and raised false homoglyph warnings (red-team finding RT-07).
// Han/Hiragana/Katakana/Hangul share one 'CJK' group: Japanese and Korean
// names legitimately mix them.
const SCRIPTS: [string, RegExp][] = [
  ['Latin', /\p{Script=Latin}/u], ['Cyrillic', /\p{Script=Cyrillic}/u], ['Greek', /\p{Script=Greek}/u],
  ['Armenian', /\p{Script=Armenian}/u], ['Hebrew', /\p{Script=Hebrew}/u], ['Arabic', /\p{Script=Arabic}/u],
  ['Devanagari', /\p{Script=Devanagari}/u], ['Bengali', /\p{Script=Bengali}/u], ['Gurmukhi', /\p{Script=Gurmukhi}/u],
  ['Gujarati', /\p{Script=Gujarati}/u], ['Oriya', /\p{Script=Oriya}/u], ['Tamil', /\p{Script=Tamil}/u],
  ['Telugu', /\p{Script=Telugu}/u], ['Kannada', /\p{Script=Kannada}/u], ['Malayalam', /\p{Script=Malayalam}/u],
  ['Thai', /\p{Script=Thai}/u], ['Georgian', /\p{Script=Georgian}/u], ['Cherokee', /\p{Script=Cherokee}/u],
  ['CJK', /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u],
]

export function scriptOf(ch: string): string {
  const c = ch.codePointAt(0) ?? 0
  if (c <= 127) return 'Latin'
  if (c >= 0xff00 && c <= 0xffef) return 'Full-width' // full-width 'ａ' is Script=Latin, but a disguise
  for (const [name, re] of SCRIPTS) if (re.test(ch)) return name
  return 'Unicode'
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

const SCHEME = /^[a-z][a-z0-9+.-]*:\/\//i

export function parseHost(input: string) {
  let host = input.trim().toLowerCase()
  let userinfo = ''
  // A full URL, or anything with a username part or a backslash, is parsed by
  // the browser's own WHATWG URL parser, so we read the same host the browser
  // will visit. A hand-rolled split disagreed on 'https://evil.xyz\@bank.com'
  // (browsers treat '\' as '/', so that goes to evil.xyz) — a parser differential.
  let parsed = false
  if (SCHEME.test(host) || /[@\\]/.test(host)) {
    try {
      const u = new URL(SCHEME.test(host) ? host : 'http://' + host)
      if (u.hostname) {
        // Fail closed (RT-20): a malformed %-escape in the username must not
        // throw us out of this branch with the userinfo lost — keep it raw.
        const raw = u.username + (u.password ? ':' + u.password : '')
        let decoded = raw
        try {
          decoded = decodeURIComponent(raw)
        } catch {
          /* malformed escape: judge the raw text */
        }
        host = u.hostname
        userinfo = decoded
        parsed = true
      }
    } catch {
      /* not a valid URL: fall back to the manual split below */
    }
  }
  if (!parsed) {
    host = host.replace(SCHEME, '') // strip scheme
    host = host.split(/[/\\?#]/)[0]
    // Userinfo trick (RT-01): in https://paypal.com@evil.xyz everything before
    // the last '@' is a throwaway username — the browser really goes to evil.xyz.
    const at = host.lastIndexOf('@')
    userinfo = at >= 0 ? host.slice(0, at) : ''
    host = host.slice(at + 1)
    host = host.replace(/:\d+$/, '') // strip port
  }
  // Browsers drop invisible code points from hostnames (UTS #46 'ignored'),
  // so 'pay<ZWSP>pal.com' really is paypal.com — strip them the same way.
  host = host.replace(/\p{Default_Ignorable_Code_Point}/gu, '')
  host = decodeHost(host) // xn--pypal-4ve.com -> the real Unicode domain
  const labels = host.split('.').filter(Boolean)
  // Split off the registrable label using the full Public Suffix List, so a
  // brand on any ccTLD (amazon.co.jp, google.com.ua) is read correctly.
  const { sld, suffix: tld, subdomains, registrable } = registrableParts(host)
  const lastLabel = labels[labels.length - 1] ?? ''
  return { host, labels, tld, sld, subdomains, lastLabel, registrable, userinfo }
}

const STRICT_COMBO = new Set(['Bank', 'Payments', 'Government', 'Finance', 'Insurance', 'Telecom', 'Logistics', 'Travel'])

// TLDs where a global brand that `ownsName` plausibly holds its own name:
// mainstream gTLDs + 2-letter ccTLDs. Before RT-03 *any* TLD outside the
// suspicious list counted, so paypal.sbs / amazon.bond read as "official".
function mainstreamTld(lastLabel: string): boolean {
  return ASCII_ONLY.test(lastLabel) && !SUSPICIOUS_TLDS.has(lastLabel) &&
    (COMMON_TLDS.has(lastLabel) || /^[a-z]{2}$/.test(lastLabel))
}

// Country domains of large markets where global brands really run their sites
// and sign-in pages (amazon.de, google.co.in, apple.com.au). Brand-on-ccTLD
// outside this set (paypal.ws, amazon.cc) is left un-flagged — Google alone
// owns ~200 ccTLDs — but is NOT trusted enough to switch off the page checks.
const MAJOR_CC = new Set([
  'uk', 'de', 'fr', 'jp', 'ca', 'au', 'in', 'it', 'es', 'br', 'mx', 'nl', 'se', 'pl', 'tr', 'ae',
  'sa', 'sg', 'eg', 'be', 'ie', 'at', 'ch', 'cn', 'kr', 'tw', 'hk', 'za', 'nz', 'ar', 'cl', 'id',
  'my', 'ph', 'th', 'vn', 'pk', 'ng', 'ru', 'ua', 'cz', 'dk', 'fi', 'no', 'pt', 'gr', 'il', 'us', 'eu',
])

// ownsName: a global brand holds its exact name on mainstream TLDs. Match the
// RAW label (not its skeleton) so a confusable look-alike is never official.
// `strict` = only major-market ccTLDs (used for trust decisions).
function ownsHere(b: Brand, sld: string, lastLabel: string, strict: boolean): boolean {
  return b.ownsName === true && sld === b.core && mainstreamTld(lastLabel) &&
    (!strict || COMMON_TLDS.has(lastLabel) || MAJOR_CC.has(lastLabel))
}

function isOfficial(b: Brand, registrable: string, sld: string, lastLabel: string, strict = false): boolean {
  return registrable === b.domain || !!b.altDomains?.includes(registrable) || ownsHere(b, sld, lastLabel, strict)
}

/** The curated brand this host officially belongs to, or null. Strict: used by
 *  the page-level checks (link text, fake windows, brand-named logins), so a
 *  brand name on an obscure ccTLD (paypal.ws) never switches them off. */
export function officialBrandOf(input: string): Brand | null {
  const { registrable, sld, lastLabel } = parseHost(input)
  return BRANDS.find((b) => isOfficial(b, registrable, sld, lastLabel, true)) ?? null
}

/** On an OAuth sign-in / consent page, the address the app will send you (and
 *  the authorization code) to: the `redirect_uri` parameter, also looked up
 *  inside nested `continue`-style URLs (Google wraps it). Null elsewhere.
 *  Consent phishing runs on the REAL Google/Microsoft page, so the page's own
 *  domain looks fine — the redirect target is the part worth checking. */
export function oauthRedirectTarget(href: string, depth = 0): string | null {
  let u: URL
  try {
    u = new URL(href)
  } catch {
    return null
  }
  if (depth === 0 && !/oauth|authori[sz]e|consent/i.test(u.pathname)) return null
  const r = u.searchParams.get('redirect_uri')
  if (r) {
    try {
      const t = new URL(r)
      return t.protocol === 'http:' || t.protocol === 'https:' ? t.href : null
    } catch {
      return null
    }
  }
  if (depth < 2) {
    for (const k of ['continue', 'return_to', 'next']) {
      const c = u.searchParams.get(k)
      const t = c ? oauthRedirectTarget(c, depth + 1) : null
      if (t) return t
    }
  }
  return null
}

export function analyze(input: string, extraBrands: Brand[] = [], allow?: Set<string>): Verdict {
  const { host, tld, sld, subdomains, lastLabel, registrable, userinfo } = parseHost(input)
  // Learned ("your site") brands are lookalike *targets* only — never a pass
  // for the domain itself. Otherwise 3 visits to a lookalike that slipped past
  // the rules would make it permanently "official" (RT-09, trust poisoning).
  const learned = extraBrands.filter((b) => b.domain !== registrable && !b.altDomains?.includes(registrable))
  const allBrands = learned.length ? [...BRANDS, ...learned] : BRANDS
  const substrBrands = allBrands.filter((b) => b.core.length >= 4)
  const sldSkel = skeleton(sld)

  // Confusable-character analysis (UTS #39). `mixedScript`: the label mixes
  // Latin with another script (Latin 'p' + Cyrillic 'а' in 'pаypal') — always a
  // homoglyph attack. `confusableFold`: it carries a non-ASCII character that
  // folds to a *different* ASCII letter (Cyrillic 'а'→a, roman-numeral 'ⅿ'→m,
  // decorated 'ṗ'→p). Whether a fold is an attack is decided below, once we know
  // the de-confused label actually lands on a brand — so a legitimate accented
  // IDN like 'münchen' (which imitates no brand) is left alone.
  const sldScripts = letterScriptsOf(sld)
  // Latin + CJK is an allowed mix under UTS #39 "Highly Restrictive" (Japanese
  // and Korean brand names do it); any other mix with Latin is a disguise.
  const mixedScript = sldScripts.size > 1 && [...sldScripts].some((s) => s !== 'Latin' && s !== 'CJK')
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

  const officialByDomain = allBrands.find((b) => isOfficial(b, registrable, sld, lastLabel))
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
  // Homoglyph in the TLD itself (paypal.cоm, Cyrillic 'о') — RT-04.
  const tldSkel = skeleton(lastLabel)
  const tldDisguised = !ASCII_ONLY.test(lastLabel) && ASCII_ONLY.test(tldSkel) && tldSkel !== lastLabel
  const homoglyphUsed = mixedScript || (confusableFold && brandProximate) || tldDisguised
  const homoglyphs: Homoglyph[] = []
  if (homoglyphUsed) {
    for (const ch of sld + (tldDisguised ? lastLabel : '')) {
      if (ch.charCodeAt(0) <= 127) continue
      const canon = skeleton(ch)
      if (canon !== ch && ASCII_ONLY.test(canon)) homoglyphs.push({ orig: ch, canon, script: scriptOf(ch) })
    }
  }

  // User-reported false positive: trust it — unless the domain is disguised
  // with look-alike characters. A homoglyph spoof can't be allowlisted, so one
  // mis-click on "Report as safe" can't whitelist pаypal.com forever (RT-08).
  if (allow?.has(registrable) && !homoglyphUsed) {
    return {
      input, host, registrable, sld, tld, skeleton: skeleton(host),
      level: 'safe', score: 0, brand: null, similarity: 1,
      distance: 0, trace: [], homoglyphs: [], ops,
      signals: [{ label: 'Marked safe by you', detail: `You reported ${registrable} as legitimate, so Unmaskr won't flag it.`, weight: 0 }],
    }
  }

  const signals: Signal[] = []
  let risk = 0
  const add = (label: string, detail: string, weight: number) => {
    signals.push({ label, detail, weight })
    risk += weight
  }

  // ── Legitimate official domain (and not disguised) → safe ──
  if (officialByDomain && !homoglyphUsed && !userinfo) {
    // Don't claim "official" for a brand name on an obscure country domain —
    // it is probably the brand's defensive registration, but unconfirmed.
    const confirmed = isOfficial(officialByDomain, registrable, sld, lastLabel, true)
    return {
      input, host, registrable, sld, tld, skeleton: skeleton(host),
      level: 'safe', score: 2, brand: officialByDomain, similarity: 1,
      distance: 0, trace: [], homoglyphs: [], ops,
      signals: [confirmed
        ? { label: 'Official domain', detail: `Exact match for ${officialByDomain.name}'s real domain (${officialByDomain.domain}).`, weight: 0 }
        : { label: 'Brand name on a country domain', detail: `${officialByDomain.name} usually owns its name on country domains, so ${registrable} is probably theirs — but Unmaskr can't confirm it. Check the address before you sign in.`, weight: 0 }],
    }
  }

  // ── Identify the impersonated brand explicitly, per signal ──
  let impersonated: Brand | null = null

  if (homoglyphUsed) {
    const list = homoglyphs.map((h) => `'${h.orig}'→'${h.canon}' (${h.script})`).join(', ')
    add('Homoglyph characters', `Disguised look-alike characters: ${list}.`, 0.45)
  }

  // A brand's real address used as bait in front of the real one: in the URL's
  // username (paypal.com@evil.xyz, RT-01) or as a sub-domain prefix
  // (paypal.com.evil.xyz / paypal.com-secure.net, RT-02). No legitimate use.
  const hostSkel = skeleton(host)
  const userSkel = skeleton(userinfo)
  const decoy = allBrands.find((b) =>
    (userinfo && (userSkel.includes(b.domain) || (b.core.length >= 4 && userSkel.includes(b.core)))) ||
    (!officialByDomain && (hostSkel.startsWith(b.domain + '.') || hostSkel.startsWith(b.domain + '-') ||
      hostSkel.includes('.' + b.domain + '.') || hostSkel.includes('.' + b.domain + '-'))))
  if (decoy) {
    impersonated = decoy
    add(userinfo ? 'Fake address before an @' : 'Real address used as a decoy',
      userinfo
        ? `The link starts with '${userinfo}', but everything before '@' is ignored — it really goes to ${registrable}.`
        : `'${decoy.domain}' is glued onto the front of ${registrable} to make it look official.`, 0.65)
  }

  if (impersonated) {
    // decoy already pinned the brand; the lexical checks below are not needed
  } else if (skelCoreBrand && !exactCoreBrand) {
    impersonated = skelCoreBrand
    add('Skeleton matches a brand', `'${sld}' normalises to '${skelCoreBrand.core}' — a disguised copy of ${skelCoreBrand.name}.`, 0.4)
  } else if (exactCoreBrand && !officialByDomain) {
    // A learned ("your site") brand often spans several legitimate TLDs
    // (github.com, github.io, github.community). For those, only flag a
    // different-TLD match when corroborated (throwaway TLD / lure / homoglyph) —
    // otherwise it is almost certainly the same company's other domain, not an
    // impersonation. Curated brands (e.g. banks) keep the strict behaviour.
    const isLearned = exactCoreBrand.category === 'Your site'
    if (!isLearned || tldSuspicious || lure.length > 0 || homoglyphUsed) {
      impersonated = exactCoreBrand
      // Regional brands (banks, gov) never own their name on a throwaway TLD →
      // block. Global brands sometimes register those defensively (google.tk
      // is Google's), so they stay at warn level.
      const w = tldSuspicious ? (exactCoreBrand.ownsName ? 0.5 : 0.55) : 0.32
      add('Brand name on a non-official domain', `Uses '${exactCoreBrand.core}' but the domain ${registrable} is not the official ${exactCoreBrand.domain}.`, w)
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
    // Combosquat (RT-05): a money/government brand as a whole hyphen-separated
    // word (hdfcbank-netbanking.com, paytm-upi.com) is a warning even with no
    // lure — banks, payment apps and government portals don't hyphenate their
    // name onto other words. Big tech/media/shopping brands do
    // (apple-cloudkit.com, microsoft-int.com), so they still need corroboration.
    // Warn-level only.
    const asWord = b ? STRICT_COMBO.has(b.category) && tokens.includes(b.core) : false
    if (b && sld !== b.core && (corroborated || asWord)) {
      impersonated = b
      add(asWord && !corroborated ? 'Brand name combined with other words' : 'Brand hidden in a longer name',
        `'${b.core}' (${b.name}) is embedded inside '${sld}', which is not the official ${b.domain}.`, corroborated ? 0.4 : 0.32)
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
