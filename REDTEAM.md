# Unmaskr — Red-Team Assessment (VAPT)

A vulnerability assessment and penetration test of Unmaskr **by its own author**:
attack the detector and the extension the way a phisher would, report what got
through, fix it, then re-run the same attacks to prove each fix.
Target: Unmaskr **v0.2.0** (as shipped for the DAA project). Result: **v0.3.0**.
Date: 2026-11-22.

| | v0.2.0 (shipped) | v0.3.0 (after fixes) |
|---|---|---|
| Fuzzer attacks that bypass the detector | **52.6 %** (541 / 1,028) | **9.2 %** (145 / 1,574) |
| False alarms on legitimate foreign-language (IDN) domains | 33.3 % | **0 %** |
| Page-level attacks caught (lab pages, §4) | **1 / 9** | **9 / 9** |
| Hostile page can hide the block screen | **yes** | no |
| Tranco top-50k: warnings / wrongful blocks | 27 / 0 | 35 / 0 |
| Controlled lookalikes: recall / precision | 99.7 % / 92.5 % | 99.6 % / **93.6 %** |

The case count grew because the brand list grew from 30 to 45 brands (the
fuzzer generates attacks for every brand). Per-family rates are the
apples-to-apples comparison (§3).

---

## 1. Scope and method

**In scope:** the detection engine (`src/algorithms/scoring.ts`), its data
(`src/data/brands.ts`), and the MV3 extension (`src/ext/*`: background
service worker, content script, popup, manifest).
**Out of scope:** Chrome itself, the user's OS, network attacks.

**Attacker model.** A phisher who can register any domain, host any page, and
send any link. They know how Unmaskr works (it is open source). They cannot
modify the extension or its storage.

**Method** — the pen-test loop from the course, run as code:

1. **Recon:** read the engine and extension source; list every trust decision
   (what makes a domain "official", "safe", or "trusted").
2. **Assess:** a fuzzer (`scripts/redteam/fuzz.ts`) generates attack domains,
   one technique per family, for every protected brand, plus a benign control
   set. Research on comparable tools and papers (two literature passes, in the
   VAPT course folder) supplied the page-level attack list.
3. **Exploit:** proof-of-concept attack pages (`scripts/redteam/pages/`) for
   attacks the domain can't reveal.
4. **Report:** findings RT-01 … RT-20 below, rated by impact.
5. **Fix → retest:** each fix is checked by re-running the fuzzer, the 50k
   Tranco false-positive sweep, the lab pages, and a regression test per finding
   (`scripts/test.ts`).

**Severity scale.** *Critical:* a phishing domain gets an explicit "safe /
Official" verdict. *High:* a common attack gets no warning, or a control can be
disabled by the attacker. *Medium:* a less common attack is missed, or the
user's trust settings can be abused. *Low:* false alarms or inconsistent signals.

---

## 2. Findings

| ID | Finding | Severity | Before | After |
|---|---|---|---|---|
| RT-03 | A brand's exact name on a cheap new TLD (`paypal.sbs`, `amazon.bond`, `paytm.cfd`) was labelled **"Official domain"** | Critical | 53.6 % bypass | 0 % (warn or block) |
| RT-04 | A homoglyph **inside the TLD** (`paypal.cоm`, Cyrillic о) was labelled "Official domain" | Critical | 53.6 % bypass | 0 % (block) |
| RT-05 | Brand + ordinary word on `.com`, with no lure word (`hdfcbank-netbanking.com`, `sbi-yono.com`) passed as safe | High | 92.9 % bypass | 20.9 % (see residual R-1) |
| RT-11 | A hostile page could **hide the block screen** with its own CSS or cover it with a higher element | High | page wins | overlay survives 4/4 attacks |
| RT-12 | A login page on an unrelated domain that **names a bank and asks for a password** got no warning (domain-only check) | High | missed | warning bar |
| RT-01 | Username trick `https://hdfcbank.com@evil.xyz` — the manual checker read the wrong host, and the link scanner didn't flag it | High | warn only / missed | block |
| RT-02 | A brand's real address used as a decoy sub-domain (`paypal.com.account-check.xyz`, `paypal.com-secure.net`) only warned | Medium | warn only | block |
| RT-16 | A suspicious domain with a **live password/OTP field** only got a dismissible bar | Medium | warn | block screen |
| RT-13 | **Browser-in-the-browser**: a fake sign-in window drawn inside the page with a fake `accounts.google.com` address bar | Medium | missed | warning bar |
| RT-14 | Link text shows a bank's address but the link goes elsewhere (`<a href="evil.top">www.hdfcbank.com</a>`) | Medium | missed | flagged "fake link" |
| RT-15 | `data:` pages and **blob:** login pages (built inside the browser, invisible to scanners) were never checked | Medium | missed | flagged |
| RT-08 | "Report as safe" could whitelist a **homoglyph spoof** forever after one mis-click | Medium | possible | blocked by design |
| RT-09 | **Trust-on-repeat poisoning:** 3 visits to a lookalike that slipped past the rules made it permanently "official", so later rule fixes could never catch it | Medium | possible | learned sites are targets only |
| RT-06 | Missing high-target Indian brands: Income Tax, UIDAI/Aadhaar, DigiLocker, Parivahan e-challan, NPCI, LIC, more banks, Airtel | Medium | not protected | 15 brands added |
| RT-07 | Legitimate foreign-language domains (`københavn.dk`, `straße.de`, `łódź.pl`) were falsely flagged as homoglyph attacks | Low | 33.3 % FP | 0 % |
| RT-10 | The toolbar badge ignored the user's safe list — a red ✕ on a page the user had marked safe | Low | inconsistent | consistent |
| RT-17 | **Parser differential:** `https://evil.xyz\@hdfcbank.com` was read as "official HDFC", but browsers treat `\` as `/` and go to evil.xyz (manual checker) | Medium | official HDFC | evil.xyz (browser-exact) |
| RT-18 | A brand name on **any** 2-letter country domain (`paypal.ws`, `amazon.cc`) was labelled "Official" and switched off the page checks and link-text checks | Medium | trusted | page checks run; no "Official" label |
| RT-19 | **Trust poisoning, page level:** learned sites skipped the page checks, and visits count per page load, so a fake login that reloads itself twice switched them off | Medium | possible | only official or user-allowlisted sites skip |

| RT-20 | **Fail-open parse:** a malformed `%` in the username (`https://hdfcbank.com%@secure-check.xyz`) made decoding throw after the host was read, so the username — and its decoy signal — was dropped | Medium | safe | block (raw username kept) |

RT-17 to RT-20 were found by automated security reviews of the v0.3.0 commits
(RT-20 in the RT-17 fix itself) and fixed in follow-ups. They show the method
working on its own output: every fix gets re-attacked.

### Root causes and fixes

- **RT-03 / RT-04** — `ownsName` brands were "official" on *any* TLD not on the
  suspicious list. Now only on mainstream gTLDs and 2-letter ccTLDs, with an
  ASCII check (`mainstreamTld()`). 16 abused new gTLDs were added to the
  suspicious list. A homoglyph in the TLD is now a homoglyph signal.
- **RT-05** — a brand embedded in a longer name needed a lure word or a
  throwaway TLD. Now a **money/government brand as a whole hyphen-separated word**
  warns on its own (`STRICT_COMBO` categories). India-specific lure words were
  added (netbanking, yono, aadhaar, ekyc, challan, fastag, parcel, redelivery…).
- **RT-01 / RT-02** — `parseHost()` now strips the userinfo part (everything
  before the last `@`) the way a browser does. A brand's real domain found in
  the userinfo or as a sub-domain prefix is a "decoy" signal (weight 0.65 →
  block).
- **RT-07** — script detection used code-point ranges, so any non-ASCII Latin
  letter (ø, ł, ß) counted as "another script". It now uses the real Unicode
  `Script` property. Latin + CJK is allowed, per UTS #39 "Highly Restrictive".
- **RT-08 / RT-09 / RT-10** — trust logic: the allowlist is ignored when the
  domain uses homoglyphs. Learned sites are excluded from the "official" check
  for their own domain. The background passes the allowlist to the engine.
- **RT-17** — any input with a scheme, `@` or `\` is parsed by the WHATWG `URL`
  parser (the browser's own), so Unmaskr judges exactly the host the browser
  will visit. The manual fallback also splits on `\`.
- **RT-18** — two trust levels. A brand name on a country domain stays
  un-flagged (Google alone owns about 200 ccTLDs, so flagging them would flood
  false alarms). Only **major-market** ccTLDs (`MAJOR_CC`: .de, .co.uk, .co.in…)
  count as official for the page and link checks. Obscure ones get the label
  "Brand name on a country domain", not "Official".
- **RT-19** — the page checks are skipped only for an official brand site or a
  user-allowlisted one, never a learned one.
- **RT-11** — the block screen now lives in the browser's **top layer**
  (`popover`), so no z-index can cover it. Its box styles are inline
  `!important`, and a guard restores it if it is removed, restyled or closed.
- **RT-12 / RT-13 / RT-14 / RT-15 / RT-16** — new page-level checks in the
  content script (re-run when the page changes and after clicks):
  a visible password/OTP/card field + a brand in the title on a non-brand site.
  A fake address bar above an iframe inside a fixed/absolute box. Link text that
  is a brand's address pointing elsewhere. `data:text/html` links, and blob:
  pages with a password field (`match_origin_as_fallback` lets the content
  script run there).

---

## 3. Fuzzer results (per family)

`npx tsx scripts/redteam/fuzz.ts <label>` → `data-eval/redteam-<label>.json`.
Bypass = verdict "safe".

| Attack family | v0.2.0 bypass | v0.3.0 bypass | v0.3.0 block |
|---|---:|---:|---:|
| userinfo trick | 0 % (warn only) | 0 % | 100 % |
| official domain as sub-domain decoy | 0 % (warn only) | 0 % | 100 % |
| combosquat on .com / .in (no lure) | 92.9 % | 20.9 % | 0 % (warn) |
| brand on abused new gTLD | 53.6 % | 0 % | 54.4 % |
| homoglyph in TLD | 53.6 % | 0 % | 100 % |
| bit-flip squat | 6.0 % | 6.2 % | 0 % |
| Indic digit-zero for "o" | 0 % | 0 % | 100 % |
| control: Cyrillic homoglyph | 0 % | 0 % | 100 % |
| control: 1-letter typo | 7.1 % | 7.0 % | 0 % |
| **all attacks** | **52.6 %** | **9.2 %** | |
| benign IDN (false alarm) | 33.3 % | 0 % | |
| benign official / popular | 0 % | 0 % | |

(Invisible characters such as zero-width spaces were dropped as an attack family:
browsers remove them from hostnames, so `pay<ZWSP>pal.com` really is paypal.com.
The engine now strips them the same way.)

---

## 4. Page-level proof-of-concept lab

`scripts/redteam/pages/` — serve the repo root
(`python -m http.server 8137 --bind 127.0.0.1`) and open a page. With the
extension installed, Unmaskr attacks it directly. Add `?harness` to load the
built content script without installing (`?harness=v020` loads the shipped
v0.2.0 build for comparison). Results below are from the harness in Chrome.

| Page | Attack | v0.2.0 | v0.3.0 |
|---|---|---|---|
| `fake-login.html` | HDFC-titled login on an unrelated host | nothing | warning bar |
| `fake-login.html#unmaskr-test=paypal.bond` | suspicious domain + live password field | nothing (read as official) | **block screen** |
| `bitb.html` (click "Sign in") | fake Google sign-in window | nothing | warning bar |
| `links.html` #1 | text `www.hdfcbank.com` → `secure-verify-portal.top` | — | "fake link" |
| `links.html` #2 | `https://hdfcbank.com@secure-check.xyz` | — | "fake" |
| `links.html` #3 | `data:text/html` link | — | "hidden page" |
| `links.html` #4 | `paypal.com.account-check.xyz` | warn | "fake" |
| `links.html` #5 | `hdfcbank-netbanking.com` | — | "risky" |
| `links.html` #6–7 | controls: real PayPal, `google.co.in` | — | — (correct) |
| `tamper.html#unmaskr-test=pаypal.com` | page hides / closes / deletes / covers the block screen | **hidden** (`display:none`) | still attached, open, visible, topmost |

---

## 5. False-positive cost (Tranco top 50,000)

`npx tsx scripts/eval/evaluate.ts`. Warnings went **27 → 35**, and wrongful
**blocks stayed at 0**. Most of the new warnings come from the new brands
colliding with real names (UIDAI ↔ `vidal.fr`, Yes Bank ↔ `tcsbank.ru`,
LinkedIn ↔ `linkcdn.cloud`). Binance was dropped from the list because
`binance` is one letter from the word `finance`. Precision on the controlled set
rose from 92.5 % to 93.6 %, because the new positives (more brands) outweigh the
new false alarms. Verdict latency stays under 2 ms at p99.

---

## 6. Residual risk (accepted, and why)

| ID | Risk | Why it stays |
|---|---|---|
| R-1 | Combosquats of **big tech/media/shopping brands** with no lure (`google-online.com`) still pass (the 20.9 %) | Those brands own hundreds of such names (`apple-cloudkit.com`, `microsoft-int.com`). Flagging them all added ~20 false alarms on the top 50k. Money and government brands, the India phishing targets, are strict. |
| R-2 | 1-letter typos / bit-flips of **4-letter cores** (`gpay → epay.com`) | They collide with real, unrelated sites. Short cores are matched only as whole words. |
| R-3 | Page heuristics can be evaded: no brand in the title, the password field inside a cross-origin iframe, a BitB window with no address text | These are heuristics, not proofs. They raise attacker cost, and the top-level domain checks still apply. |
| R-4 | Sub-frames are not scanned (`all_frames: false`) | An embedded lookalike frame and BitB are caught from the top frame. Full frame scanning would multiply work on ad-heavy pages. |
| R-5 | Domain age, Certificate Transparency, live blocklists and redirect chains are not used | They need a network service or the `webRequest` permission. Unmaskr stays offline and private with the minimum permissions (`storage` only). |
| R-6 | Lab results come from the `?harness` loader, not an installed extension | Chrome removed command-line extension loading for branded builds. Re-run the lab pages once with the unpacked `extension-dist/` installed. |

---

## 7. Reproduce

```bash
npx tsx scripts/test.ts                 # smoke + one regression per finding
npx tsx scripts/redteam/fuzz.ts after   # attack families + benign controls
npx tsx scripts/eval/evaluate.ts        # Tranco 50k + controlled positives
npm run build:ext                       # dev build (demo hook) → extension-dist/
```
