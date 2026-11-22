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
console.log('red-team regressions: all OK')
