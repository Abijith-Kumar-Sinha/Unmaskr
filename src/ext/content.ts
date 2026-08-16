/// <reference types="chrome" />
import { analyze, type Verdict } from '../algorithms/scoring'
import { getAllow } from './storage'
import type { Brand } from '../data/brands'

// Build-time flag, replaced by esbuild `define`. `true` in dev/demo builds,
// `false` in the published store build (`build:ext:store`) so the demo hook below
// is dead-code-eliminated out of the shipped bundle.
declare const __PG_DEMO__: boolean

// Three layers of protection on every page:
//  1. If the page itself is a dangerous lookalike  -> full-screen block screen.
//  2. If it is suspicious                          -> a top warning bar.
//  3. Any dangerous/suspicious LINK on the page    -> flagged inline before you click.

let TRUSTED: Brand[] = []
let ALLOW = new Set<string>()
const cache = new Map<string, Verdict>()
// Re-inject guard state for the block screen (see blockScreen).
let blockGuard: MutationObserver | null = null
let blockDismissed = false

async function loadTrusted(): Promise<Brand[]> {
  try {
    const r = await chrome.storage.local.get('pg_visits')
    const v = (r['pg_visits'] ?? {}) as Record<string, { count: number; sld: string }>
    const out: Brand[] = []
    for (const [registrable, info] of Object.entries(v)) {
      if (info.count >= 3 && info.sld.length >= 4)
        out.push({ name: info.sld, core: info.sld, domain: registrable, category: 'Your site' })
    }
    return out
  } catch {
    return []
  }
}

function check(host: string): Verdict {
  let v = cache.get(host)
  if (!v) {
    v = analyze(host, TRUSTED, ALLOW)
    cache.set(host, v)
  }
  return v
}

// Escape every HTML metacharacter — used for ANY value interpolated into the
// shadow-DOM innerHTML below, so a hostile hostname/skeleton can never inject markup.
const ESC: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }
function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ESC[c])
}

function glyphHtml(host: string): string {
  let s = ''
  for (const ch of host) {
    if (ch.charCodeAt(0) > 127) s += `<span class="pg-bad">${esc(ch)}</span>`
    else s += esc(ch)
  }
  return s
}

// ── 1. Full-screen block screen ──────────────────────────────────────────
function blockScreen(v: Verdict) {
  if (document.getElementById('unmaskr-host')) return
  // Tell the background a block was actually shown, so "Threats blocked" counts it.
  chrome.runtime
    .sendMessage({ type: 'pg-block', host: v.host, brand: v.brand ? v.brand.name : 'a brand', score: v.score })
    .catch(() => {})
  const brand = esc(v.brand ? v.brand.name : 'a trusted site')
  const homo = v.homoglyphs.length
    ? `<div class="pg-note">Disguised with ${v.homoglyphs.length} look-alike character${v.homoglyphs.length > 1 ? 's' : ''}: real address is <b>${esc(v.skeleton)}</b></div>`
    : ''
  const host = document.createElement('div')
  host.id = 'unmaskr-host'
  const sh = host.attachShadow({ mode: 'closed' })
  sh.innerHTML = `
  <style>
    .wrap{position:fixed;inset:0;z-index:2147483647;
      background:radial-gradient(900px 520px at 50% -8%, rgba(255,77,109,.20), transparent 62%), #05060a;
      color:#eef0f6;font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;
      display:flex;align-items:center;justify-content:center;}
    .card{max-width:520px;width:90%;text-align:center;padding:8px;}
    .badge{width:66px;height:66px;margin:0 auto;border-radius:18px;display:grid;place-items:center;
      background:#ff4d6d;color:#fff;box-shadow:0 10px 34px rgba(255,77,109,.4);}
    .badge svg{width:34px;height:34px;}
    h1{font-size:28px;margin:20px 0 8px;font-weight:800;letter-spacing:-.02em;}
    .sub{font-size:14.5px;color:#b9bfd0;line-height:1.55;max-width:440px;margin:0 auto;}
    .sub b{color:#eef0f6;}
    .host{margin:18px auto 0;font-family:ui-monospace,"SF Mono","Cascadia Code",Menlo,monospace;font-size:17px;
      background:#0c0d11;border:1px solid rgba(255,77,109,.6);border-radius:11px;padding:11px 15px;
      word-break:break-all;display:inline-block;}
    .pg-bad{color:#ff4d6d;background:rgba(255,77,109,.22);outline:1px solid rgba(255,77,109,.7);border-radius:3px;padding:0 2px;}
    .pg-note{font-size:12.5px;color:#9aa0b2;margin-top:10px;}
    .pg-note b{color:#4c8dff;font-family:ui-monospace,"SF Mono",Menlo,monospace;}
    .risk{display:inline-flex;align-items:center;gap:8px;font-size:12.5px;color:#b9bfd0;margin-top:12px;}
    .dot{width:8px;height:8px;border-radius:50%;background:#ff4d6d;box-shadow:0 0 10px #ff4d6d;}
    .btns{display:flex;gap:12px;justify-content:center;margin-top:26px;flex-wrap:wrap;}
    button{font:inherit;font-size:14.5px;font-weight:700;border:0;border-radius:11px;padding:12px 22px;cursor:pointer;}
    .safe{background:#4c8dff;color:#fff;}
    .safe:hover{filter:brightness(1.08);}
    .go{background:transparent;color:#b9bfd0;border:1px solid #2a2f3d;}
    .go:hover{background:rgba(255,255,255,.06);color:#eef0f6;}
    .by{margin-top:22px;font-size:11px;color:#5c6178;letter-spacing:.03em;}
  </style>
  <div class="wrap"><div class="card">
    <div class="badge"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2 4 5v6c0 5 3.4 8.3 8 10 4.6-1.7 8-5 8-10V5l-8-3z"/><path d="M12 8.5v4.5M12 16.5h.01"/></svg></div>
    <h1>Phishing site blocked</h1>
    <div class="sub">This page is pretending to be <b>${brand}</b>. Entering your password, OTP or payment details here could hand them to attackers.</div>
    <div class="host">${glyphHtml(v.host)}</div>
    ${homo}
    <div class="risk"><span class="dot"></span> Risk score ${v.score}/100</div>
    <div class="btns">
      <button class="safe" id="pg-back">&#8592; Back to safety</button>
      <button class="go" id="pg-go">Continue anyway (not recommended)</button>
    </div>
    <div class="by">Protected by Unmaskr</div>
  </div></div>`
  const reattach = () => {
    document.documentElement.appendChild(host)
    document.documentElement.style.overflow = 'hidden'
  }
  reattach()
  sh.getElementById('pg-back')?.addEventListener('click', () => {
    if (history.length > 1) history.back()
    else location.assign('about:blank')
  })
  sh.getElementById('pg-go')?.addEventListener('click', () => {
    blockDismissed = true
    blockGuard?.disconnect()
    blockGuard = null
    host.remove()
    document.documentElement.style.overflow = ''
  })
  // Re-inject guard: a hostile page can delete our overlay from its own DOM.
  // Put it back unless the user explicitly chose "Continue anyway" (or paused us).
  blockDismissed = false
  blockGuard?.disconnect()
  blockGuard = new MutationObserver(() => {
    if (!blockDismissed && !host.isConnected) reattach()
  })
  blockGuard.observe(document.documentElement, { childList: true })
}

// ── 2. Suspicious top bar ────────────────────────────────────────────────
function topBar(v: Verdict) {
  if (document.getElementById('unmaskr-bar')) return
  const brand = esc(v.brand ? v.brand.name : 'a trusted site')
  const el = document.createElement('div')
  el.id = 'unmaskr-bar'
  const sh = el.attachShadow({ mode: 'closed' })
  sh.innerHTML = `
  <style>
    .bar{position:fixed;top:0;left:0;right:0;z-index:2147483646;background:#1b1608;
      color:#f6d99a;font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;
      display:flex;gap:10px;align-items:center;padding:10px 16px;border-bottom:1px solid #4a3a12;
      box-shadow:0 3px 14px rgba(0,0,0,.4);font-size:13.5px;}
    .ic{color:#f0b429;flex:none;display:flex;}
    .ic svg{width:16px;height:16px;}
    b{color:#ffe9b8;}
    button{margin-left:auto;font:inherit;font-size:12px;background:rgba(240,180,41,.14);
      color:#f6d99a;border:1px solid #4a3a12;border-radius:7px;padding:6px 12px;cursor:pointer;}
    button:hover{background:rgba(240,180,41,.24);}
  </style>
  <div class="bar"><span class="ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/></svg></span>
  <span>Unmaskr: this domain looks suspicious &mdash; possibly imitating <b>${brand}</b>. Be careful.</span>
  <button id="x">Dismiss</button></div>`
  document.documentElement.appendChild(el)
  sh.getElementById('x')?.addEventListener('click', () => el.remove())
}

// ── 3. In-page link scanning ─────────────────────────────────────────────
function ensureLinkStyle() {
  if (document.getElementById('pg-link-style')) return
  const st = document.createElement('style')
  st.id = 'pg-link-style'
  st.textContent = `
    a[data-pg="danger"]{outline:2px solid #ff4d6d !important;outline-offset:1px;border-radius:3px;}
    a[data-pg="warn"]{outline:2px dashed #f0b429 !important;outline-offset:1px;border-radius:3px;}
    .pg-flag{display:inline-block;font-family:system-ui,-apple-system,sans-serif;font-size:10px;font-weight:700;
      vertical-align:super;margin-left:3px;padding:1px 5px;border-radius:6px;cursor:help;}
    .pg-flag.d{background:#ff4d6d;color:#fff;} .pg-flag.w{background:#f0b429;color:#1a1206;}
  `
  document.documentElement.appendChild(st)
}

function scanLinks() {
  ensureLinkStyle()
  const anchors = document.querySelectorAll<HTMLAnchorElement>('a[href]')
  let flagged = 0
  anchors.forEach((a) => {
    if (a.dataset.pgSeen) return
    a.dataset.pgSeen = '1'
    let host: string
    try {
      const u = new URL(a.href, location.href)
      if (u.protocol !== 'http:' && u.protocol !== 'https:') return
      host = u.hostname
      if (host === location.hostname) return // same-site links
    } catch {
      return
    }
    const v = check(host)
    if (v.level === 'safe') return
    const danger = v.level === 'dangerous'
    a.dataset.pg = danger ? 'danger' : 'warn'
    const flag = document.createElement('span')
    flag.className = 'pg-flag ' + (danger ? 'd' : 'w')
    flag.textContent = danger ? '⚠ fake' : '⚠ risky'
    flag.title = `Unmaskr: ${host} ${danger ? 'looks like a fake of' : 'may imitate'} ${v.brand ? v.brand.name : 'a brand'} (risk ${v.score}/100)`
    a.insertAdjacentElement('afterend', flag)
    flagged++
  })
  return flagged
}

async function isEnabled(): Promise<boolean> {
  try {
    const r = await chrome.storage.local.get('pg_enabled')
    return (r['pg_enabled'] as boolean | undefined) ?? true
  } catch {
    return true
  }
}

// Remove everything Unmaskr injected (used when the user pauses protection).
function teardown() {
  blockDismissed = true
  blockGuard?.disconnect()
  blockGuard = null
  document.getElementById('unmaskr-host')?.remove()
  document.getElementById('unmaskr-bar')?.remove()
  document.documentElement.style.overflow = ''
  document.querySelectorAll('.pg-flag').forEach((e) => e.remove())
  document.querySelectorAll<HTMLAnchorElement>('a[data-pg]').forEach((a) => {
    a.removeAttribute('data-pg')
    delete a.dataset.pgSeen
  })
}

// ── Orchestrate ──────────────────────────────────────────────────────────
let observing = false

async function run() {
  if (window.top !== window.self) return
  if (!(await isEnabled())) return // master switch: paused
  TRUSTED = await loadTrusted()
  ALLOW = new Set(await getAllow())
  cache.clear() // trusted/allow may have changed since the last run

  // Demo hook (#unmaskr-test=<host>) — compiled in for dev/demo builds only.
  // The store build (`build:ext:store`) sets __PG_DEMO__ = false, so esbuild
  // dead-code-eliminates this entire block: the hook and its regex never reach
  // the published bundle. Even in demo builds the value is attacker-controllable,
  // so we accept it ONLY if it is a plausible hostname — never HTML, spaces or
  // scripts (esc() also escapes at render time — defense in depth).
  let target = location.hostname
  let demoForced = false
  if (__PG_DEMO__) {
    const test = location.hash.match(/unmaskr-test=([^&\s]+)/)
    if (test) {
      const cand = decodeURIComponent(test[1]).toLowerCase()
      if (/^[^\s<>"'&/\\]{1,253}$/.test(cand)) {
        target = cand
        demoForced = true
      }
    }
  }
  const v = check(target)

  if (v.level === 'dangerous') blockScreen(v)
  else if (v.level === 'suspicious' || (demoForced && v.level !== 'safe')) topBar(v)

  // Scan links now and again as the page grows (debounced). Attach the
  // observer only once, even if run() is re-invoked after re-enabling.
  scanLinks()
  if (!observing) {
    let t = 0
    const obs = new MutationObserver(() => {
      clearTimeout(t)
      t = window.setTimeout(scanLinks, 600)
    })
    obs.observe(document.documentElement, { childList: true, subtree: true })
    observing = true
  }
}

// React to the master switch flipping without needing a page reload.
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return
  if (changes['pg_enabled']) {
    if (changes['pg_enabled'].newValue === false) return teardown()
    return void run()
  }
  // A site was just reported as safe (or un-reported) from the popup — clear any
  // block/bar we showed for the now-trusted domain and re-evaluate the page.
  if (changes['pg_allow']) {
    teardown()
    run()
  }
})

run()
