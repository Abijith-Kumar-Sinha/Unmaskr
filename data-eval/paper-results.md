# Paper results — commit 6d679dc+dirty, 2026-11-28

Datasets: Tranco 50000 negatives; controlled 903; dnstwist 6449 (dnstwist44/all.csv, 12 dropped as also in Tranco); red-team 2658. 95 % CIs from 1000 bootstrap resamples.

## Head-to-head — controlled positives vs Tranco

| Detector | Recall % | FPR % | FP | Precision % | F1 % |
|---|---|---|---|---|---|
| Unmaskr (warn) | 91.8 [90.0–93.6] | 0.19 [0.15–0.23] | 94 | 89.8 [88.0–91.7] | 90.8 [89.5–92.2] |
| Unmaskr (block) | 29.9 [27.1–33.2] | 0.00 [0.00–0.00] | 0 | 100.0 [100.0–100.0] | 46.0 [42.7–49.9] |
| Unmaskr LR (warn) | 99.7 [99.2–100.0] | 0.33 [0.28–0.39] | 166 | 84.4 [82.4–86.4] | 91.4 [90.2–92.6] |
| Unmaskr LR (block) | 74.0 [71.1–76.7] | 0.11 [0.08–0.14] | 53 | 92.6 [90.7–94.4] | 82.3 [80.2–84.3] |
| Chrome rule (any UI) | 56.7 [53.5–59.9] | 0.05 [0.03–0.07] | 23 | 95.7 [93.9–97.3] | 71.2 [68.5–73.8] |
| Chrome rule (interstitial) | 12.8 [10.9–15.0] | 0.00 [0.00–0.01] | 2 | 98.3 [95.4–100.0] | 22.7 [19.6–26.0] |
| Levenshtein t=1 | 44.1 [41.0–47.4] | 0.38 [0.33–0.44] | 191 | 67.6 [64.3–71.0] | 53.4 [50.3–56.6] |
| Levenshtein t=2 | 55.1 [51.9–58.4] | 2.30 [2.17–2.42] | 1150 | 30.2 [28.6–32.0] | 39.0 [37.0–41.2] |

## Head-to-head — dnstwist positives vs Tranco

| Detector | Recall % | FPR % | FP | Precision % | F1 % |
|---|---|---|---|---|---|
| Unmaskr (warn) | 79.5 [78.5–80.5] | 0.19 [0.15–0.23] | 94 | 98.2 [97.8–98.6] | 87.9 [87.3–88.5] |
| Unmaskr (block) | 6.6 [6.0–7.2] | 0.00 [0.00–0.00] | 0 | 100.0 [100.0–100.0] | 12.4 [11.3–13.5] |
| Unmaskr LR (warn) | 89.7 [88.9–90.3] | 0.33 [0.28–0.39] | 166 | 97.2 [96.8–97.6] | 93.3 [92.8–93.7] |
| Unmaskr LR (block) | 38.3 [37.1–39.6] | 0.11 [0.08–0.14] | 53 | 97.9 [97.3–98.4] | 55.1 [53.9–56.4] |
| Chrome rule (any UI) | 63.9 [62.7–65.1] | 0.05 [0.03–0.07] | 23 | 99.4 [99.2–99.7] | 77.8 [76.9–78.7] |
| Chrome rule (interstitial) | 6.2 [5.6–6.8] | 0.00 [0.00–0.01] | 2 | 99.5 [98.7–100.0] | 11.6 [10.6–12.7] |
| Levenshtein t=1 | 64.8 [63.7–66.0] | 0.38 [0.33–0.44] | 191 | 95.6 [95.0–96.2] | 77.2 [76.4–78.1] |
| Levenshtein t=2 | 72.0 [70.9–73.1] | 2.30 [2.16–2.43] | 1150 | 80.1 [79.2–81.1] | 75.8 [75.0–76.7] |

## Head-to-head — dnstwistNew positives vs Tranco

| Detector | Recall % | FPR % | FP | Precision % | F1 % |
|---|---|---|---|---|---|
| Unmaskr (warn) | 77.4 [76.4–78.4] | 0.19 [0.15–0.23] | 94 | 98.0 [97.5–98.4] | 86.5 [85.8–87.1] |
| Unmaskr (block) | 5.9 [5.3–6.6] | 0.00 [0.00–0.00] | 0 | 100.0 [100.0–100.0] | 11.1 [10.0–12.3] |
| Unmaskr LR (warn) | 89.3 [88.5–90.0] | 0.33 [0.28–0.38] | 166 | 96.9 [96.5–97.4] | 92.9 [92.4–93.4] |
| Unmaskr LR (block) | 38.1 [36.8–39.3] | 0.11 [0.08–0.14] | 53 | 97.7 [97.0–98.3] | 54.8 [53.5–56.1] |
| Chrome rule (any UI) | 63.2 [62.1–64.5] | 0.05 [0.03–0.07] | 23 | 99.4 [99.1–99.6] | 77.3 [76.4–78.3] |
| Chrome rule (interstitial) | 5.6 [5.0–6.2] | 0.00 [0.00–0.01] | 2 | 99.4 [98.4–100.0] | 10.7 [9.6–11.7] |
| Levenshtein t=1 | 65.0 [63.8–66.2] | 0.38 [0.33–0.44] | 191 | 95.2 [94.5–95.9] | 77.3 [76.3–78.2] |
| Levenshtein t=2 | 72.1 [70.9–73.3] | 2.30 [2.17–2.43] | 1150 | 78.5 [77.5–79.5] | 75.2 [74.3–76.1] |

## Head-to-head — redteam positives vs Tranco

| Detector | Recall % | FPR % | FP | Precision % | F1 % |
|---|---|---|---|---|---|
| Unmaskr (warn) | 96.7 [96.0–97.3] | 0.19 [0.15–0.23] | 94 | 96.5 [95.8–97.1] | 96.6 [96.1–97.1] |
| Unmaskr (block) | 28.8 [26.9–30.6] | 0.00 [0.00–0.00] | 0 | 100.0 [100.0–100.0] | 44.7 [42.4–46.8] |
| Unmaskr LR (warn) | 87.1 [85.9–88.4] | 0.33 [0.28–0.38] | 166 | 93.3 [92.4–94.2] | 90.1 [89.3–90.9] |
| Unmaskr LR (block) | 47.4 [45.4–49.4] | 0.11 [0.08–0.14] | 53 | 96.0 [94.9–97.0] | 63.4 [61.6–65.2] |
| Chrome rule (any UI) | 13.6 [12.4–15.0] | 0.05 [0.03–0.07] | 23 | 94.0 [91.5–96.3] | 23.8 [21.9–25.8] |
| Chrome rule (interstitial) | 9.6 [8.5–10.6] | 0.00 [0.00–0.01] | 2 | 99.2 [98.0–100.0] | 17.4 [15.6–19.2] |
| Levenshtein t=1 | 51.4 [49.5–53.3] | 0.38 [0.33–0.44] | 191 | 87.7 [86.1–89.3] | 64.8 [63.1–66.5] |
| Levenshtein t=2 | 51.4 [49.6–53.2] | 2.30 [2.17–2.44] | 1150 | 54.3 [52.6–56.0] | 52.8 [51.2–54.4] |

## Recall by family — controlled

| Family | n | Unmaskr (warn) | Unmaskr (block) | Unmaskr LR (warn) | Chrome rule (any UI) | Chrome rule (interstitial) | Levenshtein t=1 |
|---|---|---|---|---|---|---|---|
| homoglyph | 152 | 100.0 | 99.3 | 100.0 | 94.1 | 76.3 | 42.8 |
| typo | 296 | 84.1 | 0.0 | 99.0 | 80.1 | 0.0 | 64.9 |
| digit-swap | 151 | 82.1 | 0.0 | 100.0 | 39.7 | 0.0 | 43.0 |
| combosquat | 152 | 100.0 | 50.0 | 100.0 | 47.4 | 0.0 | 0.0 |
| tld-swap | 76 | 100.0 | 56.6 | 100.0 | 0.0 | 0.0 | 100.0 |
| subdomain | 76 | 100.0 | 0.0 | 100.0 | 0.0 | 0.0 | 0.0 |

## Recall by family — dnstwist

| Family | n | Unmaskr (warn) | Unmaskr (block) | Unmaskr LR (warn) | Chrome rule (any UI) | Chrome rule (interstitial) | Levenshtein t=1 |
|---|---|---|---|---|---|---|---|
| addition | 701 | 93.0 | 0.0 | 93.0 | 73.3 | 0.0 | 92.9 |
| bitsquatting | 671 | 82.7 | 0.0 | 88.8 | 75.6 | 0.0 | 95.7 |
| dictionary | 1202 | 41.7 | 0.0 | 78.9 | 12.4 | 0.0 | 0.0 |
| homoglyph | 772 | 88.7 | 54.9 | 92.2 | 75.4 | 50.9 | 24.0 |
| hyphenation | 66 | 86.4 | 0.0 | 97.0 | 0.0 | 0.0 | 97.0 |
| insertion | 1183 | 89.6 | 0.0 | 96.6 | 82.8 | 0.0 | 96.9 |
| omission | 286 | 89.2 | 0.0 | 92.0 | 71.0 | 0.0 | 97.6 |
| repetition | 125 | 93.6 | 0.0 | 97.6 | 76.0 | 0.0 | 97.6 |
| replacement | 900 | 85.9 | 0.0 | 92.8 | 77.9 | 0.0 | 95.7 |
| transposition | 208 | 92.3 | 0.0 | 97.6 | 95.2 | 0.0 | 0.0 |
| vowel-swap | 170 | 82.9 | 0.0 | 90.0 | 89.4 | 0.0 | 98.2 |
| subdomain | 93 | 98.9 | 0.0 | 23.7 | 0.0 | 0.0 | 23.7 |
| various | 34 | 38.2 | 0.0 | 94.1 | 8.8 | 8.8 | 11.8 |
| cyrillic | 3 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 0.0 |
| plural | 35 | 94.3 | 0.0 | 100.0 | 97.1 | 0.0 | 97.1 |

## Recall by family — dnstwistNew

| Family | n | Unmaskr (warn) | Unmaskr (block) | Unmaskr LR (warn) | Chrome rule (any UI) | Chrome rule (interstitial) | Levenshtein t=1 |
|---|---|---|---|---|---|---|---|
| addition | 650 | 92.5 | 0.0 | 92.5 | 71.8 | 0.0 | 92.3 |
| bitsquatting | 598 | 80.6 | 0.0 | 87.6 | 74.7 | 0.0 | 95.2 |
| dictionary | 1101 | 36.3 | 0.0 | 79.3 | 13.0 | 0.0 | 0.0 |
| homoglyph | 665 | 87.4 | 51.3 | 91.4 | 72.9 | 48.6 | 25.6 |
| hyphenation | 58 | 84.5 | 0.0 | 96.6 | 0.0 | 0.0 | 96.6 |
| insertion | 1107 | 88.9 | 0.0 | 96.4 | 82.5 | 0.0 | 96.7 |
| omission | 241 | 87.1 | 0.0 | 90.5 | 71.4 | 0.0 | 97.1 |
| repetition | 113 | 92.9 | 0.0 | 97.3 | 75.2 | 0.0 | 97.3 |
| replacement | 817 | 84.5 | 0.0 | 92.0 | 77.2 | 0.0 | 95.2 |
| transposition | 181 | 91.2 | 0.0 | 97.2 | 94.5 | 0.0 | 0.0 |
| vowel-swap | 153 | 81.0 | 0.0 | 88.9 | 88.2 | 0.0 | 98.0 |
| subdomain | 78 | 98.7 | 0.0 | 23.1 | 0.0 | 0.0 | 21.8 |
| various | 32 | 34.4 | 0.0 | 93.8 | 9.4 | 9.4 | 12.5 |
| cyrillic | 2 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 0.0 |
| plural | 33 | 93.9 | 0.0 | 100.0 | 97.0 | 0.0 | 97.0 |

## Recall by family — redteam

| Family | n | Unmaskr (warn) | Unmaskr (block) | Unmaskr LR (warn) | Chrome rule (any UI) | Chrome rule (interstitial) | Levenshtein t=1 |
|---|---|---|---|---|---|---|---|
| userinfo-trick | 76 | 100.0 | 100.0 | 100.0 | 0.0 | 0.0 | 0.0 |
| domain-as-subdomain | 152 | 100.0 | 100.0 | 100.0 | 94.7 | 94.7 | 0.0 |
| combosquat-com | 1064 | 96.6 | 0.0 | 76.6 | 3.0 | 0.0 | 0.0 |
| brand-on-abused-tld | 760 | 99.5 | 50.9 | 95.7 | 0.0 | 0.0 | 100.0 |
| homoglyph-in-tld | 76 | 100.0 | 100.0 | 56.6 | 71.1 | 71.1 | 100.0 |
| bitsquat | 456 | 89.3 | 0.0 | 94.1 | 16.7 | 0.0 | 100.0 |
| indic-zero | 74 | 100.0 | 100.0 | 100.0 | 75.7 | 75.7 | 100.0 |

## Ablation (Unmaskr rules; recall % or FP count)

| Removed | controlled warn | controlled block | dnstwist warn | dnstwist block | dnstwistNew warn | dnstwistNew block | redteam warn | redteam block | Tranco warn FP | Tranco block FP |
|---|---|---|---|---|---|---|---|---|---|---|
| full | 91.8 | 29.9 | 79.5 | 6.6 | 77.4 | 5.9 | 96.7 | 28.8 | 94 | 0 |
| noSkeleton | 90.8 | 21.4 | 77.2 | 0.0 | 75.5 | 0.0 | 96.3 | 23.1 | 94 | 0 |
| noMixedScript | 91.6 | 28.1 | 79.5 | 6.6 | 77.4 | 5.9 | 96.7 | 28.8 | 94 | 0 |
| uniformCosts | 84.1 | 29.8 | 78.3 | 6.2 | 76.1 | 5.7 | 96.5 | 28.8 | 85 | 0 |
| noTranspose | 86.8 | 29.9 | 77.3 | 6.6 | 75.4 | 5.9 | 96.7 | 28.8 | 94 | 0 |
| noHorspool | 91.7 | 29.9 | 70.5 | 6.6 | 69.2 | 5.9 | 72.6 | 28.8 | 45 | 0 |
| noCorroboration | 91.8 | 29.9 | 89.7 | 6.6 | 88.7 | 5.9 | 98.0 | 28.8 | 242 | 0 |
| noDecoy | 91.8 | 29.9 | 79.5 | 6.6 | 77.4 | 5.9 | 93.8 | 20.2 | 94 | 0 |
| noSecondary | 91.8 | 16.7 | 79.5 | 6.6 | 77.4 | 5.9 | 96.7 | 14.2 | 94 | 0 |
| noGluedStrict | 91.8 | 29.9 | 77.4 | 6.6 | 76.2 | 5.9 | 96.7 | 28.8 | 91 | 0 |
| shortCoreRule | 90.3 | 29.9 | 74.1 | 6.6 | 72.5 | 5.9 | 94.6 | 28.8 | 86 | 0 |
| comboStrictOnly | 91.8 | 29.9 | 75.8 | 6.6 | 73.3 | 5.9 | 86.5 | 28.8 | 66 | 0 |

## LR calibration (held-out 30 %)

Raw (class-weighted LR): Brier 0.0182, ECE 0.0406. Platt-scaled (fit on train split): Brier 0.0105, ECE 0.0062. Base rate 12.82 %, threshold 0.87, held-out real recall 94.9 %, held-out FPR 0.57 %.

| Bin | raw n | raw mean p | raw observed | Platt n | Platt mean p | Platt observed |
|---|---|---|---|---|---|---|
| 0.0–0.1 | 13200 | 0.019 | 0.002 | 14682 | 0.006 | 0.004 |
| 0.1–0.2 | 936 | 0.140 | 0.012 | 181 | 0.142 | 0.072 |
| 0.2–0.3 | 327 | 0.242 | 0.037 | 61 | 0.243 | 0.098 |
| 0.3–0.4 | 188 | 0.350 | 0.048 | 42 | 0.349 | 0.214 |
| 0.4–0.5 | 125 | 0.445 | 0.056 | 33 | 0.442 | 0.182 |
| 0.5–0.6 | 90 | 0.549 | 0.067 | 24 | 0.563 | 0.375 |
| 0.6–0.7 | 57 | 0.649 | 0.105 | 33 | 0.660 | 0.818 |
| 0.7–0.8 | 55 | 0.754 | 0.200 | 67 | 0.753 | 0.881 |
| 0.8–0.9 | 55 | 0.851 | 0.345 | 296 | 0.862 | 0.956 |
| 0.9–1.0 | 2173 | 0.986 | 0.965 | 1787 | 0.971 | 0.971 |

## Latency (ms per verdict, Tranco sweep)

| Detector | mean | p50 | p95 | p99 | max |
|---|---|---|---|---|---|
| unmaskr | 0.485 | 0.449 | 0.848 | 1.144 | 17.92 |
| lr | 0.471 | 0.438 | 0.819 | 1.105 | 15.75 |
| chrome | 0.021 | 0.021 | 0.026 | 0.030 | 3.89 |

## False alarms on held-out sites (Tranco ranks 50,001–1M, 190000 never inspected)

- Unmaskr (warn): 165 (0.087 %)
- Unmaskr (block): 0 (0.000 %)
- Unmaskr LR (warn): 238 (0.125 %)
- Unmaskr LR (block): 69 (0.036 %)
- Chrome rule (any UI): 39 (0.021 %)
- Chrome rule (interstitial): 1 (0.001 %)
- Levenshtein t=1: 123 (0.065 %)
- Levenshtein t=2: 1797 (0.946 %)

## Benign controls (IDNs, official + popular domains) flagged

- Unmaskr (warn): 0 / 212
- Unmaskr (block): 0 / 212
- Unmaskr LR (warn): 0 / 212
- Unmaskr LR (block): 0 / 212
- Chrome rule (any UI): 0 / 212
- Chrome rule (interstitial): 0 / 212
- Levenshtein t=1: 0 / 212
- Levenshtein t=2: 0 / 212
