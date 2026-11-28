import { analyze, officialBrandOf, oauthRedirectTarget } from '../src/algorithms/scoring'
import { predictML } from '../src/algorithms/mlScore'

const cases = [
  'paypal.com', // legit
  'google.com', // legit
  'hdfcbank.com', // legit
  'pаypal.com', // Cyrillic 'а' homoglyph
  'paypa1.com', // digit 1 for l
  'g00gle.com', // zeros for o
  'secure-paypal.xyz', // brand + suspicious tld
  'paypal-login.tk', // brand + lure + suspicious tld
  'hdfcbank.account-verify.com', // brand in subdomain
  'amazon-kyc-update.xyz', // brand + lure
  'аmazon.in', // Cyrillic 'а' at start
  'paytm.xyz', // brand on throwaway tld
  'microsoft.com', // legit
  'randomblog.dev', // unrelated
]

const w = 32
for (const c of cases) {
  const v = analyze(c)
  const brand = v.brand ? v.brand.name : '-'
  console.log(
    c.padEnd(w),
    v.level.toUpperCase().padEnd(11),
    ('score ' + v.score).padEnd(10),
    ('brand: ' + brand).padEnd(22),
    v.homoglyphs.length ? `homoglyphs:${v.homoglyphs.length}` : '',
  )
}

// User allowlist (reported false positives) forces a domain to 'safe'.
const fp = 'secure-paypal.xyz'
if (analyze(fp).level === 'safe') throw new Error('setup: ' + fp + ' should flag without allowlist')
const allowed = analyze(fp, [], new Set([fp]))
if (allowed.level !== 'safe' || allowed.score !== 0) throw new Error('allowlist gate failed for ' + fp)
console.log('\nallowlist: ' + fp + ' -> ' + allowed.level + ' when reported  OK')

// Red-team regressions (REDTEAM.md). Each line is a bypass or false alarm the
// fuzzer found in v0.2.0; it must never come back.
const expect = (input: string, want: 'safe' | 'flag' | 'dangerous', why: string, extra: Parameters<typeof analyze>[1] = [], allow?: Set<string>) => {
  const lvl = analyze(input, extra, allow).level
  const ok = want === 'flag' ? lvl !== 'safe' : lvl === want
  if (!ok) throw new Error(`${why}: ${input} -> ${lvl}, expected ${want}`)
}
expect('https://hdfcbank.com@secure-check.xyz/login', 'dangerous', 'RT-01 userinfo trick')
expect('paypal.com.account-check.xyz', 'dangerous', 'RT-02 official domain as decoy')
expect('paypal.com-secure.net', 'dangerous', 'RT-02 glued decoy')
expect('hdfcbank.sbs', 'dangerous', 'RT-03 bank on abused TLD')
expect('paypal.bond', 'flag', 'RT-03 ownsName brand on abused TLD')
expect('paypal.cоm', 'dangerous', 'RT-04 homoglyph in TLD')
expect('hdfcbank-netbanking.com', 'flag', 'RT-05 bank combosquat')
expect('paytm-upi.com', 'flag', 'RT-05 payments combosquat')
for (const d of ['københavn.dk', 'straße.de', 'łódź.pl']) expect(d, 'safe', 'RT-07 legit IDN')
expect('pаypal.com', 'dangerous', 'RT-08 allowlist must not clear a homoglyph', [], new Set(['pаypal.com']))
const poisoned = [{ name: 'x', core: 'hdfcbank-netbanking', domain: 'hdfcbank-netbanking.com', category: 'Your site' }]
expect('hdfcbank-netbanking.com', 'flag', 'RT-09 learned site must not become official', poisoned)
expect('github.com', 'safe', 'learned site itself stays safe', [{ name: 'github', core: 'github', domain: 'github.com', category: 'Your site' }])
for (const d of ['google.com', 'paypal.co.uk', 'amazon.de', 'google.tk']) expect(d, d === 'google.tk' ? 'flag' : 'safe', 'official / defensive registration')
// Post-push security review (REDTEAM.md RT-17..RT-19).
// Browsers read '\' as '/', so these go to evil.xyz — never "official HDFC".
for (const x of [String.raw`https://evil.xyz\@hdfcbank.com/login`, String.raw`evil.xyz\@hdfcbank.com`]) {
  const v = analyze(x)
  if (v.host !== 'evil.xyz' || v.brand?.name === 'HDFC Bank') throw new Error(`RT-17 backslash parser differential: ${x} -> ${v.host}`)
}
expect('https://hdfcbank.com@secure-check.xyz/login', 'dangerous', 'RT-01 still caught via URL parser')
expect('https://hdfcbank.com%@secure-check.xyz/login', 'dangerous', 'RT-20 malformed % in userinfo must fail closed')
expect('https://hdfcbank.com%zz@secure-check.xyz/', 'dangerous', 'RT-20 malformed % in userinfo must fail closed')
if (officialBrandOf('paypal.ws') !== null) throw new Error('RT-18: obscure ccTLD must not be trusted for page checks')
if (officialBrandOf('www.amazon.de')?.name !== 'Amazon') throw new Error('RT-18: major ccTLD stays trusted')
if (analyze('paypal.ws').signals[0].label === 'Official domain') throw new Error('RT-18: must not claim official on obscure ccTLD')
// RT-21 OAuth consent: find redirect_uri on IdP pages, including Google's
// nested continue= URL; ignore pages that aren't OAuth flows.
const evilCb = 'https://paypal.com.account-check.xyz/cb'
const gAuth = `https://accounts.google.com/o/oauth2/v2/auth?client_id=1&redirect_uri=${encodeURIComponent(evilCb)}&scope=mail`
if (oauthRedirectTarget(gAuth) !== evilCb) throw new Error('RT-21: redirect_uri not found')
const nested = `https://accounts.google.com/signin/oauth/consent?continue=${encodeURIComponent(gAuth)}`
if (oauthRedirectTarget(nested) !== evilCb) throw new Error('RT-21: nested continue redirect_uri not found')
if (oauthRedirectTarget('https://www.google.com/search?redirect_uri=https://x.y/') !== null) throw new Error('RT-21: non-OAuth page must be ignored')
if (analyze(evilCb).level !== 'dangerous') throw new Error('RT-21: lookalike redirect target must be flagged')
// The ML path must not miss the userinfo trick either (paper eval found 0 %).
if (predictML('https://hdfcbank.com@secure-check.xyz/login').level !== 'dangerous') throw new Error('ML: userinfo trick not blocked')
if (predictML('paypal.com').level !== 'safe') throw new Error('ML: official domain flagged')
console.log('red-team regressions: all OK')
