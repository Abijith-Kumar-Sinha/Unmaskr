import { analyze } from '../src/algorithms/scoring'

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
