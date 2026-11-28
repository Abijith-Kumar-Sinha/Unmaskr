"""How much memory does Unmaskr cost? Open the same pages with and without the
extension and compare: total private memory of all browser processes, and the
JS heap of each tab (content scripts live in the tab's renderer heap).

    python scripts/eval/memory.py [extension-dir]     (default extension-dist/)

Writes data-eval/memory.json. Needs playwright + psutil.
"""
import asyncio, json, sys, statistics
from pathlib import Path
import psutil
from playwright.async_api import async_playwright

ROOT = Path(__file__).resolve().parents[2]
EXT = str(Path(sys.argv[1]).resolve()) if len(sys.argv) > 1 else str(ROOT / "extension-dist")
PAGES = ["https://en.wikipedia.org/wiki/Phishing", "https://github.com/trending", "https://news.ycombinator.com",
         "https://stackoverflow.com/questions", "https://www.bbc.com/news", "https://www.amazon.in",
         "https://www.flipkart.com", "https://www.icicibank.com", "https://medium.com", "https://www.reddit.com/r/india"]
ROUNDS = 3

def browser_private_mb(root_pid):
    total = 0
    try:
        procs = [psutil.Process(root_pid)] + psutil.Process(root_pid).children(recursive=True)
    except psutil.NoSuchProcess:
        return 0
    for p in procs:
        try:
            total += p.memory_full_info().private
        except (psutil.NoSuchProcess, psutil.AccessDenied):
            pass
    return total / 2**20

async def run(with_ext):
    async with async_playwright() as pw:
        args = [f"--disable-extensions-except={EXT}", f"--load-extension={EXT}"] if with_ext else ["--disable-extensions"]
        ctx = await pw.chromium.launch_persistent_context("", channel="chromium", headless=True, args=args)
        await asyncio.sleep(2)
        root = None
        for p in psutil.process_iter(["pid", "name", "cmdline", "create_time"]):
            cl = " ".join(p.info["cmdline"] or [])
            if "chrome" in (p.info["name"] or "").lower() and "--type=" not in cl and "ms-playwright" in cl:
                if root is None or p.info["create_time"] > root.info["create_time"]:
                    root = p
        heaps = []
        for url in PAGES:
            page = await ctx.new_page()
            try:
                await page.goto(url, timeout=25000, wait_until="domcontentloaded")
            except Exception:
                pass
            await page.wait_for_timeout(5000)
            cdp = await ctx.new_cdp_session(page)
            await cdp.send("Performance.enable")
            m = {x["name"]: x["value"] for x in (await cdp.send("Performance.getMetrics"))["metrics"]}
            heaps.append(m.get("JSHeapUsedSize", 0) / 2**20)
        await asyncio.sleep(3)
        total = browser_private_mb(root.info["pid"]) if root else 0
        sw = None
        for w in ctx.service_workers:
            sw = w.url
        await ctx.close()
        return {"privateMB": total, "heapMBPerTab": heaps, "serviceWorker": sw}

async def main():
    out = {"ext": [], "noext": []}
    for r in range(ROUNDS):  # alternate to spread out network/cache effects
        out["noext"].append(await run(False))
        out["ext"].append(await run(True))
        print(f"round {r + 1}: no-ext {out['noext'][-1]['privateMB']:.0f} MB, ext {out['ext'][-1]['privateMB']:.0f} MB", flush=True)
    med = lambda k, f: statistics.median(f(x) for x in out[k])
    s = {"pages": len(PAGES), "rounds": ROUNDS, "extension": EXT,
         "medianPrivateMB_noext": med("noext", lambda x: x["privateMB"]), "medianPrivateMB_ext": med("ext", lambda x: x["privateMB"]),
         "medianHeapPerTabMB_noext": med("noext", lambda x: statistics.median(x["heapMBPerTab"])),
         "medianHeapPerTabMB_ext": med("ext", lambda x: statistics.median(x["heapMBPerTab"]))}
    s["extraTotalMB"] = s["medianPrivateMB_ext"] - s["medianPrivateMB_noext"]
    s["extraPerTabHeapMB"] = s["medianHeapPerTabMB_ext"] - s["medianHeapPerTabMB_noext"]
    (ROOT / "data-eval/memory.json").write_text(json.dumps({"summary": s, "runs": out}, indent=1), encoding="utf-8")
    print(json.dumps(s, indent=1))

asyncio.run(main())
