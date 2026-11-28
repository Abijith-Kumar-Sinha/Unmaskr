# Paper results — commit 8cf4331, 2026-11-28

Datasets: Tranco 50000 negatives; controlled 511; dnstwist 579; red-team 1492. 95 % CIs from 1000 bootstrap resamples.

## Head-to-head — controlled positives vs Tranco

| Detector | Recall % | FPR % | FP | Precision % | F1 % |
|---|---|---|---|---|---|
| Unmaskr (warn) | 99.6 [99.0–100.0] | 0.07 [0.05–0.09] | 35 | 93.6 [91.6–95.7] | 96.5 [95.4–97.6] |
| Unmaskr (block) | 30.1 [26.4–34.4] | 0.00 [0.00–0.00] | 0 | 100.0 [100.0–100.0] | 46.3 [41.8–51.2] |
| Unmaskr LR (warn) | 100.0 [100.0–100.0] | 0.07 [0.05–0.10] | 36 | 93.4 [91.4–95.3] | 96.6 [95.5–97.6] |
| Unmaskr LR (block) | 82.4 [79.3–85.7] | 0.01 [0.00–0.03] | 7 | 98.4 [97.1–99.5] | 89.7 [87.6–91.7] |
| Chrome rule (any UI) | 57.1 [53.2–61.4] | 0.04 [0.02–0.06] | 19 | 93.9 [91.2–96.4] | 71.0 [67.7–74.3] |
| Chrome rule (interstitial) | 12.7 [9.8–15.7] | 0.00 [0.00–0.01] | 2 | 97.0 [91.9–100.0] | 22.5 [17.7–27.0] |
| Levenshtein t=1 | 40.5 [36.2–44.4] | 0.32 [0.27–0.37] | 160 | 56.4 [52.0–61.2] | 47.2 [43.2–50.8] |
| Levenshtein t=2 | 50.5 [46.0–54.8] | 1.46 [1.36–1.58] | 732 | 26.1 [24.0–28.1] | 34.4 [31.6–37.0] |

## Head-to-head — dnstwist positives vs Tranco

| Detector | Recall % | FPR % | FP | Precision % | F1 % |
|---|---|---|---|---|---|
| Unmaskr (warn) | 97.4 [95.9–98.6] | 0.07 [0.05–0.09] | 35 | 94.2 [92.3–95.9] | 95.8 [94.6–96.9] |
| Unmaskr (block) | 14.5 [11.6–17.6] | 0.00 [0.00–0.00] | 0 | 100.0 [100.0–100.0] | 25.3 [20.7–30.0] |
| Unmaskr LR (warn) | 97.6 [96.2–98.8] | 0.07 [0.05–0.10] | 36 | 94.0 [92.1–95.9] | 95.8 [94.6–96.9] |
| Unmaskr LR (block) | 48.4 [44.4–52.3] | 0.01 [0.01–0.03] | 7 | 97.6 [95.5–99.2] | 64.7 [60.9–68.2] |
| Chrome rule (any UI) | 82.0 [78.8–85.3] | 0.04 [0.02–0.06] | 19 | 96.2 [94.4–97.8] | 88.5 [86.4–90.5] |
| Chrome rule (interstitial) | 12.3 [9.3–15.0] | 0.00 [0.00–0.01] | 2 | 97.3 [93.1–100.0] | 21.8 [17.0–26.0] |
| Levenshtein t=1 | 76.3 [72.9–79.8] | 0.32 [0.27–0.37] | 160 | 73.4 [70.4–76.8] | 74.9 [72.2–77.6] |
| Levenshtein t=2 | 84.8 [81.9–87.7] | 1.46 [1.36–1.57] | 732 | 40.1 [38.3–42.2] | 54.5 [52.4–56.7] |

## Head-to-head — redteam positives vs Tranco

| Detector | Recall % | FPR % | FP | Precision % | F1 % |
|---|---|---|---|---|---|
| Unmaskr (warn) | 90.5 [88.9–92.0] | 0.07 [0.05–0.10] | 35 | 97.5 [96.6–98.2] | 93.8 [92.9–94.7] |
| Unmaskr (block) | 29.2 [26.9–31.6] | 0.00 [0.00–0.00] | 0 | 100.0 [100.0–100.0] | 45.2 [42.4–48.1] |
| Unmaskr LR (warn) | 71.7 [69.2–73.9] | 0.07 [0.05–0.10] | 36 | 96.7 [95.6–97.8] | 82.4 [80.7–83.9] |
| Unmaskr LR (block) | 57.6 [55.1–60.2] | 0.01 [0.00–0.03] | 7 | 99.2 [98.5–99.8] | 72.9 [70.8–74.9] |
| Chrome rule (any UI) | 12.3 [10.6–14.0] | 0.04 [0.02–0.06] | 19 | 90.6 [86.4–94.3] | 21.6 [19.0–24.4] |
| Chrome rule (interstitial) | 8.2 [6.8–9.7] | 0.00 [0.00–0.01] | 2 | 98.4 [95.8–100.0] | 15.1 [12.8–17.6] |
| Levenshtein t=1 | 51.0 [48.5–53.4] | 0.32 [0.27–0.37] | 160 | 82.6 [80.3–85.1] | 63.1 [60.7–65.2] |
| Levenshtein t=2 | 51.0 [48.6–53.5] | 1.46 [1.36–1.57] | 732 | 51.0 [49.0–53.2] | 51.0 [49.1–53.0] |

## Recall by family — controlled

| Family | n | Unmaskr (warn) | Unmaskr (block) | Unmaskr LR (warn) | Chrome rule (any UI) | Chrome rule (interstitial) | Levenshtein t=1 |
|---|---|---|---|---|---|---|---|
| homoglyph | 86 | 100.0 | 98.8 | 100.0 | 94.2 | 75.6 | 38.4 |
| typo | 168 | 100.0 | 0.0 | 100.0 | 83.3 | 0.0 | 58.3 |
| digit-swap | 85 | 97.6 | 0.0 | 100.0 | 37.6 | 0.0 | 38.8 |
| combosquat | 86 | 100.0 | 50.0 | 100.0 | 45.3 | 0.0 | 0.0 |
| tld-swap | 43 | 100.0 | 60.5 | 100.0 | 0.0 | 0.0 | 100.0 |
| subdomain | 43 | 100.0 | 0.0 | 100.0 | 0.0 | 0.0 | 0.0 |

## Recall by family — dnstwist

| Family | n | Unmaskr (warn) | Unmaskr (block) | Unmaskr LR (warn) | Chrome rule (any UI) | Chrome rule (interstitial) | Levenshtein t=1 |
|---|---|---|---|---|---|---|---|
| addition | 57 | 100.0 | 0.0 | 100.0 | 89.5 | 0.0 | 100.0 |
| bitsquatting | 82 | 100.0 | 0.0 | 100.0 | 80.5 | 0.0 | 100.0 |
| cyrillic | 1 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 0.0 |
| homoglyph | 110 | 98.2 | 75.5 | 98.2 | 90.0 | 63.6 | 15.5 |
| hyphenation | 8 | 100.0 | 0.0 | 100.0 | 0.0 | 0.0 | 100.0 |
| insertion | 92 | 100.0 | 0.0 | 100.0 | 89.1 | 0.0 | 100.0 |
| omission | 43 | 100.0 | 0.0 | 100.0 | 62.8 | 0.0 | 100.0 |
| repetition | 16 | 100.0 | 0.0 | 100.0 | 75.0 | 0.0 | 100.0 |
| replacement | 103 | 100.0 | 0.0 | 100.0 | 86.4 | 0.0 | 100.0 |
| subdomain | 18 | 33.3 | 0.0 | 38.9 | 0.0 | 0.0 | 38.9 |
| transposition | 31 | 100.0 | 0.0 | 100.0 | 100.0 | 0.0 | 0.0 |
| vowel-swap | 16 | 100.0 | 0.0 | 100.0 | 100.0 | 0.0 | 100.0 |
| various | 1 | 0.0 | 0.0 | 0.0 | 0.0 | 0.0 | 0.0 |
| plural | 1 | 100.0 | 0.0 | 100.0 | 100.0 | 0.0 | 100.0 |

## Recall by family — redteam

| Family | n | Unmaskr (warn) | Unmaskr (block) | Unmaskr LR (warn) | Chrome rule (any UI) | Chrome rule (interstitial) | Levenshtein t=1 |
|---|---|---|---|---|---|---|---|
| userinfo-trick | 43 | 100.0 | 100.0 | 100.0 | 0.0 | 0.0 | 0.0 |
| domain-as-subdomain | 86 | 100.0 | 100.0 | 100.0 | 95.3 | 95.3 | 0.0 |
| combosquat-com | 602 | 79.1 | 0.0 | 36.4 | 4.7 | 0.0 | 0.0 |
| brand-on-abused-tld | 430 | 100.0 | 54.4 | 96.0 | 0.0 | 0.0 | 100.0 |
| homoglyph-in-tld | 43 | 100.0 | 100.0 | 60.5 | 55.8 | 55.8 | 100.0 |
| bitsquat | 258 | 93.8 | 0.0 | 98.1 | 12.8 | 0.0 | 100.0 |
| indic-zero | 30 | 100.0 | 100.0 | 100.0 | 53.3 | 53.3 | 100.0 |

## Ablation (Unmaskr rules; recall % or FP count)

| Removed | controlled warn | controlled block | dnstwist warn | dnstwist block | redteam warn | redteam block | Tranco warn FP | Tranco block FP |
|---|---|---|---|---|---|---|---|---|
| full | 99.6 | 30.1 | 97.4 | 14.5 | 90.5 | 29.2 | 35 | 0 |
| noSkeleton | 98.8 | 21.3 | 90.8 | 0.0 | 90.5 | 24.3 | 35 | 0 |
| noMixedScript | 99.6 | 29.0 | 97.4 | 14.5 | 90.5 | 29.2 | 35 | 0 |
| uniformCosts | 90.6 | 29.9 | 96.0 | 12.3 | 90.3 | 29.2 | 29 | 0 |
| noTranspose | 93.3 | 30.1 | 92.2 | 14.5 | 90.5 | 29.2 | 35 | 0 |
| noHorspool | 99.6 | 30.1 | 97.4 | 14.5 | 73.1 | 29.2 | 30 | 0 |
| noCorroboration | 99.6 | 30.1 | 97.6 | 14.5 | 98.9 | 29.2 | 132 | 0 |
| noDecoy | 99.6 | 30.1 | 97.4 | 14.5 | 87.6 | 20.6 | 35 | 0 |
| noSecondary | 99.6 | 16.6 | 97.4 | 14.5 | 90.5 | 13.5 | 35 | 0 |

## LR calibration (held-out 30 %)

Raw (class-weighted LR): Brier 0.0053, ECE 0.0180. Platt-scaled (fit on train split): Brier 0.0012, ECE 0.0009. Base rate 2.14 %, threshold 0.94, held-out real recall 98.3 %, held-out FPR 0.11 %.

| Bin | raw n | raw mean p | raw observed | Platt n | Platt mean p | Platt observed |
|---|---|---|---|---|---|---|
| 0.0–0.1 | 14466 | 0.008 | 0.000 | 14975 | 0.000 | 0.000 |
| 0.1–0.2 | 268 | 0.136 | 0.000 | 5 | 0.121 | 0.000 |
| 0.2–0.3 | 88 | 0.239 | 0.011 | 3 | 0.244 | 0.000 |
| 0.3–0.4 | 57 | 0.349 | 0.000 | 3 | 0.369 | 0.000 |
| 0.4–0.5 | 29 | 0.450 | 0.000 | 3 | 0.437 | 0.333 |
| 0.5–0.6 | 27 | 0.545 | 0.000 | 6 | 0.549 | 0.667 |
| 0.6–0.7 | 18 | 0.652 | 0.000 | 7 | 0.676 | 0.714 |
| 0.7–0.8 | 20 | 0.747 | 0.050 | 11 | 0.759 | 0.818 |
| 0.8–0.9 | 8 | 0.848 | 0.000 | 22 | 0.863 | 1.000 |
| 0.9–1.0 | 347 | 0.992 | 0.937 | 293 | 0.988 | 0.969 |

## Latency (ms per verdict, Tranco sweep)

| Detector | mean | p50 | p95 | p99 | max |
|---|---|---|---|---|---|
| unmaskr | 0.219 | 0.209 | 0.379 | 0.468 | 1.40 |
| lr | 0.210 | 0.202 | 0.362 | 0.446 | 1.12 |
| chrome | 0.011 | 0.011 | 0.015 | 0.016 | 0.86 |

## Benign controls (IDNs, official + popular domains) flagged

- Unmaskr (warn): 0 / 118
- Unmaskr (block): 0 / 118
- Unmaskr LR (warn): 0 / 118
- Unmaskr LR (block): 0 / 118
- Chrome rule (any UI): 0 / 118
- Chrome rule (interstitial): 0 / 118
- Levenshtein t=1: 0 / 118
- Levenshtein t=2: 0 / 118
