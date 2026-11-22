# Unmaskr — Real-Time Detection of Lookalike Phishing Domains

A Manifest V3 Chrome extension that detects **lookalike phishing domains** — including invisible **Unicode homoglyph** disguises — in real time, using classic string algorithms (no machine learning). Built for the Design & Analysis of Algorithms course.

---

## 1. Project Overview

Attackers register domains that imitate trusted brands (`icic1bank.com`, or `paypal.com` written with a Cyrillic `а`) to steal credentials, OTPs, and payments. The standard defence — edit distance — compares raw character codes and is **blind to homoglyphs**. Unmaskr closes that gap:

1. **Normalises** a domain to a homoglyph-free "skeleton" (Unicode UTS #39).
2. Measures similarity to a protected brand list with a **weighted edit-distance dynamic program**.
3. Finds embedded brands with **Horspool's string matching**.
4. Fuses the signals into an **explainable verdict** — impersonated brand, the exact trick, and a 0–100 risk score.

Delivered as a browser extension that colours the toolbar badge, shows a **full-screen block page** on dangerous sites, flags **dangerous links inline** on any page, and keeps a **local protection dashboard**.

**Algorithms / DAA mapping:** Dynamic Programming (Unit IV) · Horspool string matching (Unit III) · Unicode skeleton normalization (Transform-and-Conquer).

---

## 2. Requirements

**Functional**
- Detect lookalike domains from the string alone (typos, digit-swaps, homoglyphs, sub-domain tricks, brand + lure words).
- Decode `xn--` (Punycode/IDN) domains before analysis.
- Real-time, per-tab verdict shown via toolbar badge.
- Full-screen warning on dangerous sites; top bar on suspicious sites.
- Scan and flag dangerous links **within** a page before the user clicks.
- Explainable output: impersonated brand, transformation, risk score.
- Learn the user's frequently-visited domains and protect lookalikes of those.

**Non-functional**
- Lightweight: a verdict in well under 5 ms.
- Private: all processing on-device; **no network calls**.
- Explainable: every point in the score traces to a named signal.

**Development**
- Node.js 18+ and a Chromium browser (Chrome/Edge/Brave).

---

## 3. Current Implementation

The engine is a 4-stage pipeline, implemented as pure framework-free TypeScript, shared unchanged between the extension and a dev web demo:

| Stage | Module | Technique |
|-------|--------|-----------|
| Host parse + skeleton | `confusables.ts`, `punycode.ts` | UTS #39 normalization, NFKD, IDN decode |
| Similarity to brands | `editDistance.ts` | Weighted Damerau–Levenshtein edit distance (Dynamic Programming) |
| Embedded-brand search | `horspool.ts` | Horspool's string matching |
| Signal fusion | `scoring.ts` | Rule-based risk scoring + explanation |

**Extension layers**
- `background.ts` — service worker: per-tab badge, protection stats, learns history.
- `content.ts` — block screen (dangerous, tamper-resistant top-layer overlay) / top bar (suspicious) / in-page link scanner, plus page-level checks added in v0.3.0: a password/OTP field on a page that names a brand it isn't, fake "browser-in-the-browser" sign-in windows, link text that shows a brand's address but goes elsewhere, and blob:/data: login pages.
- `popup.tsx` — dashboard: stats, current verdict, homoglyph + alignment view, recent threats, manual checker.
- `storage.ts` — visit counts, trusted-site learning, stats, recent threats (`chrome.storage.local`).

---

## 4. File Structure

```
unmaskr/
├── src/
│   ├── algorithms/
│   │   ├── confusables.ts     # skeleton normalization + substitution costs
│   │   ├── editDistance.ts    # weighted edit distance (DP) + trace
│   │   ├── horspool.ts        # Horspool string matching (brand-in-domain)
│   │   ├── punycode.ts        # RFC 3492 IDN decoder (xn-- -> Unicode)
│   │   └── scoring.ts         # analyze(): the risk engine
│   ├── data/
│   │   ├── brands.ts          # protected brands (+ altDomains/ownsName), TLDs, lure words
│   │   ├── confusablesMap.ts  # full UTS #39 confusables table (generated)
│   │   └── publicSuffix.ts    # Public Suffix List rules + registrable parser (generated)
│   ├── ext/
│   │   ├── background.ts      # service worker (badge, stats, learning)
│   │   ├── content.ts         # block screen + top bar + link scanner
│   │   ├── popup.tsx / .css / .html   # popup dashboard
│   │   ├── storage.ts         # chrome.storage helpers
│   │   └── manifest.json      # MV3 manifest
│   ├── App.tsx                # dev web demo (checker)
│   ├── Evaluation.tsx         # dev web demo (results + complexity charts)
│   ├── main.tsx, index.css
├── scripts/                   # test harnesses (test.ts) + data generators (gen-psl.mjs, gen-confusables.mjs)
│   └── eval/                  # real-data evaluation: prep, lookalike generator, evaluate, diagnose
├── icons/                     # extension icons (16/48/128)
├── build-ext.mjs             # esbuild bundler -> extension-dist/
├── demo.html                 # demo "inbox" page for link-scanning
└── extension-dist/           # build output (load this in Chrome)
```

---

## 5. Dependencies

**Runtime:** `react`, `react-dom` (popup + web demo only). The algorithm core has **zero runtime dependencies**.

**Dev / build:** `typescript`, `vite`, `@vitejs/plugin-react`, `tailwindcss`, `@tailwindcss/vite` (web demo), `esbuild` (extension bundling), `@types/chrome`, `@types/react`, `@types/react-dom`, `@types/node`, `tsx`.

---

## 6. APIs Used

**No external/HTTP APIs — everything runs locally.**

- **Chrome Extension APIs:** `chrome.tabs`, `chrome.action` (badge), `chrome.storage.local`, `chrome.runtime`.
- **Web platform APIs:** `String.prototype.normalize('NFKD')`, `URL`, `MutationObserver`, Shadow DOM (`attachShadow`).
- **Reference data (bundled, offline):** a curated subset of the Unicode UTS #39 confusables table, and a hand-curated brand list.

**Build commands**
```bash
npm install
npm run build:ext        # dev build -> extension-dist/ (keeps the #unmaskr-test demo hook)
npm run build:ext:store  # publishable build -> extension-dist/ (demo hook stripped)
npm run dev              # web demo (dev sandbox)
```

---

## 7. Known Bugs / Limitations

- **Finite brand list** — the protected brand list (45, India-focused: banks, UPI apps, government portals) is curated, not exhaustive. (The confusables map and TLD parsing use the full Unicode UTS #39 table and the Public Suffix List respectively.)
- **Mostly lexical** — the verdict comes from the domain string; the v0.3.0 page checks (login fields, fake windows, link text) are heuristics. No TLS-certificate, domain-age or blocklist lookups (a deliberate trade for privacy: nothing leaves the device).
- **Security assessment** — see [`REDTEAM.md`](REDTEAM.md): a red-team pass on v0.2.0 found 20 issues (fuzzer bypass 52.6 % → 9.2 %) and lists the accepted residual risks.
- **Block page is dismissible** — "Continue anyway" lets a determined user proceed (by design).
- **Stats may slightly over-count** on pages that fire multiple navigation events.
- **Local-file scanning** requires enabling "Allow access to file URLs" for the extension.
- **Chrome's own IDN guard** can intercept navigation to famous homoglyph domains before the content script runs (mitigated via Punycode decoding + the popup checker + a `#unmaskr-test=` demo hook).

---

## 9. Future Roadmap

- **Indic-on-Indic spoofing** — only 24 Indic glyphs fold to Latin in UTS #39, so the real gap is Indic-script domains (`.भारत`) imitating each other; import the ICANN Devanagari/Kannada variant sets.
- **Hybrid pipeline** — use the fast string engine as a pre-filter ahead of an optional ML stage. *(Prototyped on the `phase-c-ml` branch: an explainable, dependency-free logistic-regression head over the engine's features — see [`ML.md`](ML.md).)*
- **Registrar-side screening** — flag abusive registrations at creation time.
- **Chrome Web Store publication** of the extension.
- **Conference paper (IEEE format)** on the homoglyph-aware weighted edit-distance method and its evaluation.

---

## License

[MIT](LICENSE) © Abijith Kumar Sinha. Unmaskr runs entirely on-device and makes no
network calls — see [`PRIVACY.md`](PRIVACY.md). Chrome Web Store listing copy and
permission justifications live in [`STORE_LISTING.md`](STORE_LISTING.md).

---

Built by **Abijith Kumar Sinha** (1RV24CY003) · RV College of Engineering · DAA (CD343AI).
