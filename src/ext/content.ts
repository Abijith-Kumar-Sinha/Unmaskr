/// <reference types="chrome" />
// The detection engine lives in the background service worker (one copy for the
// whole browser); this script only asks it questions, so each tab stays light.
import type { Verdict } from '../algorithms/scoring'
import { BRANDS, type Brand } from '../data/brands'

// Build-time flag, replaced by esbuild `define`. `true` in dev/demo builds,
// `false` in the published store build (`build:ext:store`) so the demo hook below
// is dead-code-eliminated out of the shipped bundle.
declare const __PG_DEMO__: boolean

// Layers of protection on every page:
//  1. The page's own domain is a dangerous lookalike    -> full-screen block screen.
//  2. It is suspicious                                  -> a top warning bar;
//     suspicious AND asking for a password/OTP          -> block screen.
//  3. Page-level tricks the domain can't reveal (red-team pass):
//     a login that names a brand it isn't, a fake browser window (BitB), a
//     login built in a blob: URL, an embedded lookalike frame -> warning bar.
//  4. Any dangerous/suspicious LINK on the page, or a link whose text shows a
//     brand's address but goes elsewhere -> flagged inline before you click.

const cache = new Map<string, unknown>()
// Re-inject guard state for the block screen (see blockScreen).
let blockGuard: MutationObserver | null = null
let blockDismissed = false
let pageVerdict: Verdict | null = null
let pageWarned = false

// ── Engine RPC (background.ts answers 'pg-engine') ──────────────────────
type Op = 'analyze' | 'official' | 'oauth' | 'allowed'
interface Req { op: Op; input: string }
async function ask(reqs: Req[]): Promise<unknown[]> {
  const key = (r: Req) => r.op + '|' + r.input
  const missing = [...new Map(reqs.filter((r) => !cache.has(key(r))).map((r) => [key(r), r])).values()]
  for (let i = 0; i < missing.length; i += 400) {
    const batch = missing.slice(i, i + 400)
    let res: unknown[] = []
    try {
      res = ((await chrome.runtime.sendMessage({ type: 'pg-engine', items: batch })) as unknown[] | undefined) ?? []
    } catch {
      /* worker restarting / extension reloaded: answer as unknown */
    }
    batch.forEach((r, j) => { if (j < res.length) cache.set(key(r), res[j]) })
  }
  return reqs.map((r) => cache.get(key(r)) ?? null)
}
const check = async (input: string) => ((await ask([{ op: 'analyze', input }]))[0] as Verdict | null)
// The official brand (by name) a host belongs to, or null.
const official = async (host: string) => ((await ask([{ op: 'official', input: host }]))[0] as string | null)

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

// The page's real host. A blob: page (blob:https://evil.xyz/uuid) has no
// hostname of its own — its origin carries the site that generated it.
function pageHost(): string {
  if (location.hostname) return location.hostname
  try {
    return location.protocol === 'blob:' ? new URL(location.origin).hostname : ''
  } catch {
    return ''
  }
}

// ── 1. Full-screen block screen ──────────────────────────────────────────
// Hardened against a hostile page (RT-11): it lives in the browser's top layer
// (popover), so no z-index can cover it; its box styles are inline !important,
// so page CSS can't hide it; and a guard puts it back if the page removes it
// or tampers with its attributes.
const HOST_CSS = 'all:initial!important;position:fixed!important;inset:0!important;display:block!important;' +
  'visibility:visible!important;opacity:1!important;width:100vw!important;height:100vh!important;' +
  'max-width:none!important;max-height:none!important;margin:0!important;padding:0!important;' +
  'border:0!important;background:transparent!important;z-index:2147483647!important;overflow:hidden!important'

function blockScreen(v: Verdict, askingForSecrets = false) {
  if (document.getElementById('unmaskr-host')) return
  // Tell the background a block was actually shown, so "Threats blocked" counts it.
  chrome.runtime
    .sendMessage({ type: 'pg-block', host: v.host, brand: v.brand ? v.brand.name : 'a brand', score: v.score })
    .catch(() => {})
  const brand = esc(v.brand ? v.brand.name : 'a trusted site')
  const homo = v.homoglyphs.length
    ? `<div class="pg-note">Disguised with ${v.homoglyphs.length} look-alike character${v.homoglyphs.length > 1 ? 's' : ''}: real address is <b>${esc(v.skeleton)}</b></div>`
    : ''
  const secrets = askingForSecrets ? ' <b>It is asking for your password or OTP right now.</b>' : ''
  const host = document.createElement('div')
  host.id = 'unmaskr-host'
  // Dev build only (stripped from the store build): lets the eval crawler read why.
  if (__PG_DEMO__) host.dataset.reason = `block: ${v.host} ${v.signals.map((x) => x.label).join(' + ')}`
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
    <div class="sub">This page is pretending to be <b>${brand}</b>. Entering your password, OTP or payment details here could hand them to attackers.${secrets}</div>
    <div class="host">${glyphHtml(v.host)}</div>
    ${homo}
    <div class="risk"><span class="dot"></span> Risk score ${v.score}/100</div>
    <div class="btns">
      <button class="safe" id="pg-back">&#8592; Back to safety</button>
      <button class="go" id="pg-go">Continue anyway (not recommended)</button>
    </div>
    <div class="by">Protected by Unmaskr</div>
  </div></div>`
  // The browser re-serialises cssText, so compare against what it stored.
  let wantCss = ''
  const isOpen = () => {
    try {
      return host.matches(':popover-open')
    } catch {
      return true // no popover support: nothing to re-open
    }
  }
  const reattach = () => {
    if (host.getAttribute('popover') !== 'manual') host.setAttribute('popover', 'manual')
    host.style.cssText = HOST_CSS
    wantCss = host.style.cssText
    if (!host.isConnected) document.documentElement.appendChild(host)
    try {
      if (!isOpen()) host.showPopover()
    } catch {
      /* no popover support: inline z-index still applies */
    }
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
  // Re-inject guard: a hostile page can delete our overlay, restyle it, or close
  // its popover. Put it back unless the user chose "Continue anyway" (or paused us).
  blockDismissed = false
  blockGuard?.disconnect()
  blockGuard = new MutationObserver(() => {
    if (blockDismissed) return
    if (!host.isConnected || host.style.cssText !== wantCss || !isOpen()) reattach()
  })
  blockGuard.observe(document.documentElement, { childList: true })
  blockGuard.observe(host, { attributes: true })
  host.addEventListener('toggle', () => {
    if (!blockDismissed && !isOpen()) reattach()
  })
}

// ── 2. Warning bar (suspicious domain, or a page-level trick) ────────────
// `html` must already be escaped by the caller.
function topBar(html: string) {
  if (document.getElementById('unmaskr-bar') || document.getElementById('unmaskr-host')) return
  chrome.runtime.sendMessage({ type: 'pg-warn' }).catch(() => {})
  const el = document.createElement('div')
  el.id = 'unmaskr-bar'
  if (__PG_DEMO__) el.dataset.reason = 'bar: ' + html.replace(/<[^>]+>/g, '').replace(/&#39;/g, "'")
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
  <span>Unmaskr: ${html}</span>
  <button id="x">Dismiss</button></div>`
  document.documentElement.appendChild(el)
  sh.getElementById('x')?.addEventListener('click', () => el.remove())
}

// ── 3. Page-level checks ─────────────────────────────────────────────────
// A visible field that takes a secret: password, OTP, card number, CVV, MPIN.
const SECRET_FIELDS = 'input[type=password],input[autocomplete~="one-time-code"],input[autocomplete~="cc-number"],' +
  'input[autocomplete~="cc-csc"],input[name*="otp" i],input[name*="mpin" i],input[name*="cvv" i]'

function askingForSecrets(root: ParentNode = document): boolean {
  for (const i of root.querySelectorAll<HTMLInputElement>(SECRET_FIELDS)) {
    if (i.type !== 'hidden' && !i.disabled && i.getClientRects().length) return true
  }
  return false
}

const reEscape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const word = (w: string, flags: string) => new RegExp(`(^|[^\\p{L}\\p{N}])${reEscape(w)}($|[^\\p{L}\\p{N}])`, flags)

// A protected brand named in the page's title / og:site_name. 3-letter
// acronyms (SBI, LIC) must appear in capitals, so "sbi" inside a word won't hit.
function brandNamed(): Brand | null {
  const raw = `${document.title} ${document.querySelector('meta[property="og:site_name"]')?.getAttribute('content') ?? ''}`
  for (const b of BRANDS) {
    if (b.name.length >= 4 && word(b.name, 'iu').test(raw)) return b
    if (b.name.length === 3 && word(b.name, 'u').test(raw)) return b
    if (b.core.length >= 5 && word(b.core, 'iu').test(raw)) return b
  }
  return null
}

// Browser-in-the-browser: a fake pop-up drawn inside the page, with a fake
// address bar showing a brand's sign-in address above an iframe that actually
// loads the attacker's form. Heuristic: inside a fixed/absolute box that holds
// a visible iframe, an "address bar" — a non-link element whose whole text (or
// an input's value) is a protected brand's address — sits before the iframe,
// while neither the page nor the iframe belongs to that brand. (A genuine
// embed — a YouTube player captioned "youtube.com" — has the iframe on the
// brand's own domain, so it is skipped.)
function addressBarIn(box: Element, frame: Element): string | null {
  const els = box.querySelectorAll('div,span,p,input,b,strong')
  for (let i = 0; i < els.length && i < 300; i++) {
    const el = els[i]
    if (el.contains(frame) || el.closest('a')) continue
    if (!(el.compareDocumentPosition(frame) & Node.DOCUMENT_POSITION_FOLLOWING)) continue
    const text = (el instanceof HTMLInputElement ? el.value : el.children.length ? '' : el.textContent ?? '').trim()
    const m = text.match(ADDRESS_TEXT)
    if (m) return m[1].toLowerCase()
  }
  return null
}

async function fakeBrowserWindow(): Promise<{ shown: string; brand: string } | null> {
  const pageBrand = await official(pageHost())
  for (const f of document.querySelectorAll('iframe')) {
    if (!f.getClientRects().length) continue
    let frameBrand: string | null = null
    try {
      frameBrand = await official(new URL(f.src, location.href).hostname)
    } catch {
      /* srcdoc / about:blank */
    }
    let el = f.parentElement
    for (let i = 0; el && i < 5; i++, el = el.parentElement) {
      const pos = getComputedStyle(el).position
      if (pos !== 'fixed' && pos !== 'absolute') continue
      const shown = addressBarIn(el, f)
      const b = shown ? await official(shown) : null
      if (shown && b && b !== pageBrand && b !== frameBrand) return { shown, brand: b }
    }
  }
  return null
}

async function pageChecks() {
  if (pageWarned || document.getElementById('unmaskr-host')) return
  const v = pageVerdict
  const host = pageHost()
  const secrets = askingForSecrets()

  // Suspicious domain + a live password/OTP field → escalate to a block.
  if (v && v.level === 'suspicious' && secrets) {
    document.getElementById('unmaskr-bar')?.remove()
    pageWarned = true
    return blockScreen(v, true)
  }

  // OAuth consent phishing: the page is the real Google/Microsoft one, so check
  // where the app will send you and your account access (redirect_uri).
  // Runs before the official-site skip below on purpose.
  const target = (await ask([{ op: 'oauth', input: location.href }]))[0] as string | null
  if (target === 'pg:too-long') {
    pageWarned = true
    return topBar('this sign-in address is padded to an unusual length, a trick used to hide where it sends you. Don&#39;t approve it unless you are sure.')
  }
  if (target) {
    const rv = await check(target)
    if (rv && rv.level !== 'safe') {
      pageWarned = true
      return topBar(`this sign-in will send you, and access to your account, to <b>${esc(rv.host)}</b>, which looks like a fake of <b>${esc(rv.brand?.name ?? 'a trusted site')}</b>. Don&#39;t approve it.`)
    }
  }

  // Everything below is for pages whose domain itself looked fine. Skip only an
  // official brand site or one the user explicitly reported as safe — NOT a
  // "learned" site: visits are counted per page load, so a phishing page that
  // reloads itself would get learned and switch these checks off (trust poisoning).
  const [offi, allowed] = await ask([{ op: 'official', input: host }, { op: 'allowed', input: host }])
  if (offi || allowed) return
  const registrable = v?.registrable ?? host

  const warn = (html: string) => {
    pageWarned = true
    topBar(html)
  }

  // A blob: page that asks for a password: phishing kits build the login inside
  // the browser so email scanners and URL blocklists never see a server.
  if (location.protocol === 'blob:' && secrets) {
    return warn('this login page was <b>generated inside your browser</b> (a blob: address), a trick phishing kits use to hide from scanners. Don&#39;t enter your password here.')
  }

  // A login that names a brand it isn't.
  if (secrets) {
    const b = brandNamed()
    if (b) {
      return warn(`this page calls itself <b>${esc(b.name)}</b> and asks for your password, but <b>${esc(registrable || host)}</b> is not ${esc(b.name)}&#39;s site (${esc(b.domain)}).`)
    }
  }

  // A fake browser window (BitB).
  const bitb = await fakeBrowserWindow()
  if (bitb) {
    return warn(`this page shows a <b>fake sign-in window</b> pretending to be <b>${esc(bitb.shown)}</b> (${esc(bitb.brand)}). A real sign-in opens in its own browser window with its own address bar.`)
  }

  // An embedded frame from a lookalike domain.
  for (const f of document.querySelectorAll<HTMLIFrameElement>('iframe[src]')) {
    try {
      const u = new URL(f.src, location.href)
      if ((u.protocol !== 'http:' && u.protocol !== 'https:') || u.hostname === host) continue
      const fv = await check(u.hostname)
      if (fv?.level === 'dangerous') {
        return warn(`this page embeds content from <b>${esc(fv.host)}</b>, a lookalike of ${esc(fv.brand?.name ?? 'a trusted site')}.`)
      }
    } catch {
      /* bad URL */
    }
  }
}

// ── 4. In-page link scanning ─────────────────────────────────────────────
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

function flagLink(a: HTMLAnchorElement, danger: boolean, label: string, title: string) {
  a.dataset.pg = danger ? 'danger' : 'warn'
  const flag = document.createElement('span')
  flag.className = 'pg-flag ' + (danger ? 'd' : 'w')
  flag.textContent = label
  flag.title = title
  a.insertAdjacentElement('afterend', flag)
}

// Link text that is itself an address ("www.hdfcbank.com", "https://paypal.com/x").
const ADDRESS_TEXT = /^(?:https?:\/\/)?((?:[a-z0-9-]+\.)+[a-z]{2,})(?:[/:?#]\S*)?$/i

// Well-known redirect wrappers (webmail, social, safe-link scanners): judge the
// address they forward to, not the wrapper.
const REDIRECTORS: Record<string, string[]> = {
  'www.google.com': ['q', 'url'], 'google.com': ['q', 'url'],
  'l.facebook.com': ['u'], 'lm.facebook.com': ['u'], 'l.instagram.com': ['u'],
  'www.youtube.com': ['q'], 'out.reddit.com': ['url'], 'slack-redir.net': ['url'],
  'www.linkedin.com': ['url'], 'away.vk.com': ['to'],
}
function unwrapRedirect(u: URL): URL {
  const keys = REDIRECTORS[u.hostname] ??
    (u.hostname.endsWith('.safelinks.protection.outlook.com') ? ['url'] : null)
  if (!keys) return u
  // google.com/search?q=… is a search, not a redirect: only /url (and YouTube's /redirect) forward.
  if (/(^|\.)google\.com$/.test(u.hostname) && u.pathname !== '/url') return u
  if (u.hostname === 'www.youtube.com' && u.pathname !== '/redirect') return u
  for (const k of keys) {
    const t = u.searchParams.get(k)
    if (t && /^https?:\/\//i.test(t)) {
      try { return new URL(t) } catch { /* not a URL */ }
    }
  }
  return u
}

// Webmail is where phishing links arrive, so 'risky' (not only 'fake') links get
// a badge there. Elsewhere only clear fakes are badged, so ordinary pages are not
// covered in warnings; a risky site still gets the warning bar if it is opened.
const WEBMAIL = /^(mail\.google\.com|outlook\.(live|office|office365)\.com|mail\.yahoo\.com|mail\.proton\.me)$/

const linkInput = (u: URL) => (u.username ? `${u.protocol}//${u.username}${u.password ? ':' + u.password : ''}@${u.host}/` : u.hostname)

async function scanLinks() {
  ensureLinkStyle()
  const here = pageHost()
  const badgeRisky = WEBMAIL.test(here)
  const anchors = document.querySelectorAll<HTMLAnchorElement>('a[href]')
  let flagged = 0
  // Pass 1: collect the new links; pass 2 (after one batched engine call) flags them.
  const todo: { a: HTMLAnchorElement; u: URL; host: string; shown: string | null }[] = []
  anchors.forEach((a) => {
    if (a.dataset.pgSeen) return
    a.dataset.pgSeen = '1'
    let u: URL
    try {
      u = unwrapRedirect(new URL(a.href, location.href))
    } catch {
      return
    }
    // A data:text/html link opens a page that has no address at all.
    if (u.protocol === 'data:') {
      if (/^data:text\/html/i.test(a.href)) {
        flagLink(a, false, '⚠ hidden page', 'Unmaskr: this link opens a page with no real address (data: URL) — a way to hide a fake login.')
        flagged++
      }
      return
    }
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return
    const shown = (a.textContent ?? '').trim().match(ADDRESS_TEXT)
    todo.push({ a, u, host: u.hostname, shown: shown ? shown[1] : null })
  })
  if (!todo.length) return flagged

  const reqs: Req[] = []
  for (const t of todo) {
    if (t.shown) reqs.push({ op: 'official', input: t.shown }, { op: 'official', input: t.host })
    // The userinfo trick needs the user-info part (https://bank.com@evil.xyz), but
    // not the path, which an attacker could pad to any length.
    if (t.host !== here) reqs.push({ op: 'analyze', input: linkInput(t.u) })
  }
  await ask(reqs)
  const got = (op: Op, input: string) => cache.get(op + '|' + input) ?? null

  for (const { a, u, host, shown } of todo) {
    // Text shows a brand's address, but the link goes somewhere else. (A link back
    // to this same site cannot take you anywhere new — e.g. news sites labelling a
    // story with its source domain.)
    if (shown) {
      const shownBrand = got('official', shown) as string | null
      if (shownBrand && host !== here && got('official', host) !== shownBrand) {
        flagLink(a, true, '⚠ fake link', `Unmaskr: the link text shows ${shown} (${shownBrand}), but it really goes to ${host}.`)
        flagged++
        continue
      }
    }
    if (host === here) continue // same-site links
    const v = got('analyze', linkInput(u)) as Verdict | null
    if (!v || v.level === 'safe') continue
    const danger = v.level === 'dangerous'
    if (!danger && !badgeRisky) continue
    flagLink(a, danger, danger ? '⚠ fake' : '⚠ risky',
      `Unmaskr: ${v.host} ${danger ? 'looks like a fake of' : 'may imitate'} ${v.brand ? v.brand.name : 'a brand'} (risk ${v.score}/100)`)
    flagged++
  }
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
  document.querySelectorAll<HTMLAnchorElement>('a[data-pg], a[data-pg-seen]').forEach((a) => {
    a.removeAttribute('data-pg')
    delete a.dataset.pgSeen
  })
  pageWarned = false
}

// ── Orchestrate ──────────────────────────────────────────────────────────
let observing = false

async function run() {
  if (window.top !== window.self) return
  if (!(await isEnabled())) return // master switch: paused
  cache.clear() // trusted/allow may have changed since the last run

  // Demo hook (#unmaskr-test=<host>) — compiled in for dev/demo builds only.
  // The store build (`build:ext:store`) sets __PG_DEMO__ = false, so esbuild
  // dead-code-eliminates this entire block: the hook and its regex never reach
  // the published bundle. Even in demo builds the value is attacker-controllable,
  // so we accept it ONLY if it is a plausible hostname — never HTML, spaces or
  // scripts (esc() also escapes at render time — defense in depth).
  let target = pageHost()
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
  pageVerdict = target ? await check(target) : null
  const v = pageVerdict

  if (v?.level === 'dangerous') blockScreen(v)
  else if (v && (v.level === 'suspicious' || (demoForced && v.level !== 'safe'))) {
    topBar(`this domain looks suspicious &mdash; possibly imitating <b>${esc(v.brand ? v.brand.name : 'a trusted site')}</b>. Be careful.`)
  }

  // Scan links and run page checks now and again as the page grows
  // (debounced — logins and fake windows often appear after a click). Attach
  // the observer only once, even if run() is re-invoked after re-enabling.
  await scanLinks()
  await pageChecks()
  if (!observing) {
    let t = 0
    let busy = false
    const rescan = () => {
      clearTimeout(t)
      t = window.setTimeout(async () => {
        if (busy) return rescan() // one scan at a time; try again shortly
        busy = true
        try {
          await scanLinks()
          await pageChecks()
        } finally {
          busy = false
        }
      }, 600)
    }
    // New nodes, or a hidden dialog/window being revealed. (Not every style
    // change — animated pages would starve the debounce.)
    new MutationObserver(rescan).observe(document.documentElement, {
      childList: true, subtree: true, attributes: true, attributeFilter: ['hidden', 'open'],
    })
    // Fake sign-in windows usually appear right after the victim clicks
    // "Sign in with…", often by flipping a CSS class — re-check after clicks.
    document.addEventListener('click', rescan, true)
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
