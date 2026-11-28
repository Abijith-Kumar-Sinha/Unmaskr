"""What does a real user see? Load the DEV extension build into Chromium, visit real
pages, and record every warning Unmaskr shows (block screen, warning bar, flagged links).

    python scripts/eval/pagecrawl.py [N]        # N = Tranco top-N homepages (default 300)

Writes data-eval/pagecrawl.json and prints a summary. Needs `pip install playwright`
and the dev build in extension-dist/ (npm run build:ext) for the reason attributes.
"""
import asyncio, json, sys, time
from pathlib import Path
from playwright.async_api import async_playwright

ROOT = Path(__file__).resolve().parents[2]
EXT = str(ROOT / "extension-dist")
N = int(sys.argv[1]) if len(sys.argv) > 1 else 300
EXTRA = ["https://www.hdfcbank.com", "https://www.icicibank.com", "https://www.sbi.co.in", "https://www.irctc.co.in",
         "https://www.flipkart.com", "https://www.amazon.in", "https://www.myntra.com", "https://www.zomato.com",
         "https://www.swiggy.com", "https://www.paytm.com", "https://www.phonepe.com", "https://www.makemytrip.com",
         "https://www.ndtv.com", "https://timesofindia.indiatimes.com", "https://www.thehindu.com", "https://www.moneycontrol.com",
         "https://support.google.com", "https://support.microsoft.com", "https://support.apple.com", "https://www.zendesk.com",
         "https://help.netflix.com", "https://www.reddit.com/r/india", "https://stackoverflow.com/questions", "https://medium.com",
         "https://github.com/trending", "https://news.ycombinator.com", "https://en.wikipedia.org/wiki/Phishing"]

COLLECT = """() => {
  const out = {block: null, bar: null, links: []}
  const h = document.getElementById('unmaskr-host'); if (h) out.block = h.dataset.reason || 'block'
  const b = document.getElementById('unmaskr-bar'); if (b) out.bar = b.dataset.reason || 'bar'
  for (const a of document.querySelectorAll('a[data-pg]')) {
    const f = a.nextElementSibling
    out.links.push({kind: a.dataset.pg, label: f ? f.textContent : '', why: f ? f.title : '', href: a.href.slice(0, 200), text: (a.textContent || '').trim().slice(0, 80)})
  }
  return out
}"""

async def visit(ctx, url, results, sem):
    async with sem:
        page = await ctx.new_page()
        rec = {"url": url}
        try:
            await page.goto(url, timeout=25000, wait_until="domcontentloaded")
            await page.wait_for_timeout(4500)  # content script + MutationObserver rescans
            rec.update(await page.evaluate(COLLECT))
            rec["final"] = page.url
        except Exception as e:
            rec["error"] = type(e).__name__
        finally:
            await page.close()
        results.append(rec)
        flag = rec.get("block") or rec.get("bar") or (f"{len(rec.get('links', []))} links" if rec.get("links") else "")
        print(f"{len(results):4} {url[:60]:60} {flag}", flush=True)

async def main():
    rows = (ROOT / "data-eval/raw/top-1m.csv").read_text(encoding="utf-8").splitlines()
    urls = [f"https://{r.split(',')[1]}" for r in rows[:N]] + EXTRA
    results = []
    async with async_playwright() as p:
        ctx = await p.chromium.launch_persistent_context(
            "", channel="chromium", headless=True,
            args=[f"--disable-extensions-except={EXT}", f"--load-extension={EXT}"])
        sem = asyncio.Semaphore(5)
        t0 = time.time()
        await asyncio.gather(*(visit(ctx, u, results, sem) for u in urls))
        await ctx.close()
    ok = [r for r in results if "error" not in r]
    warned = [r for r in ok if r.get("block") or r.get("bar") or r.get("links")]
    summary = {"visited": len(results), "loaded": len(ok), "pagesWithAnyWarning": len(warned),
               "blocks": sum(1 for r in ok if r.get("block")), "bars": sum(1 for r in ok if r.get("bar")),
               "flaggedLinks": sum(len(r.get("links", [])) for r in ok), "seconds": round(time.time() - t0)}
    (ROOT / "data-eval/pagecrawl.json").write_text(json.dumps({"summary": summary, "pages": results}, indent=1), encoding="utf-8")
    print(json.dumps(summary, indent=1))

asyncio.run(main())
