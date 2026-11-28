"""Harvest REGISTERED lookalike domains for every protected brand with dnstwist.

    python scripts/eval/harvest.py [brand-domain ...]

Writes one CSV per brand to data-eval/dnstwist44/<domain>.csv (rows:
brand,fuzzer,domain,dns_a,dns_aaaa) and merges them into data-eval/dnstwist44/all.csv.
Resumable: brands that already have a CSV are skipped. Needs `pip install dnstwist`.
The dictionary adds neutral words so dnstwist also emits combosquats
(brand-word / wordbrand); they are deliberately NOT the engine's lure words, so the
detector is not graded on its own vocabulary.
"""
import csv, re, subprocess, sys, time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "data-eval" / "dnstwist44"
OUT.mkdir(parents=True, exist_ok=True)
WORDS = ["app", "online", "india", "cards", "customer", "portal", "web", "mobile", "home",
         "my", "get", "team", "info", "plus", "pro", "hub", "center", "connect", "group",
         "digital", "pay", "net", "now", "direct", "global", "user", "client", "access", "mail", "id"]
DICT = OUT / "_words.txt"
DICT.write_text("\n".join(WORDS) + "\n", encoding="utf-8")

brands_ts = (ROOT / "src" / "data" / "brands.ts").read_text(encoding="utf-8")
domains = re.findall(r"domain:\s*'([^']+)'", brands_ts)
if len(sys.argv) > 1:
    domains = sys.argv[1:]

for d in domains:
    out = OUT / f"{d}.csv"
    if out.exists():
        continue
    t0 = time.time()
    r = subprocess.run([sys.executable, "-m", "dnstwist", "--registered", "--format", "csv",
                        "--threads", "40", "--dictionary", str(DICT), d],
                       capture_output=True, text=True, encoding="utf-8", errors="replace")
    rows = list(csv.DictReader(r.stdout.splitlines()))
    with out.open("w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        for row in rows:
            w.writerow([d, row.get("fuzzer", ""), row.get("domain", ""), row.get("dns_a", ""), row.get("dns_aaaa", "")])
    print(f"{d:28} {len(rows):5} registered  {time.time() - t0:6.0f}s", flush=True)

with (OUT / "all.csv").open("w", newline="", encoding="utf-8") as f:
    for p in sorted(OUT.glob("*.csv")):
        if p.name != "all.csv":
            f.write(p.read_text(encoding="utf-8"))
print("merged ->", OUT / "all.csv")
