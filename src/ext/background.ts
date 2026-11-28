/// <reference types="chrome" />
import { analyze, officialBrandOf, oauthRedirectTarget, parseHost, type Level } from '../algorithms/scoring'
import { getTrustedBrands, recordVisit, bumpScanned, recordBlock, getEnabled, getAllow, ENABLED_KEY } from './storage'

const BADGE: Record<Level, { text: string; color: string }> = {
  safe: { text: '', color: '#4c8dff' },
  suspicious: { text: '!', color: '#f0b429' },
  dangerous: { text: '✕', color: '#ff4d6d' },
}

// Tabs currently showing a block overlay. While a tab is in here, a routine
// re-scan (e.g. the demo hook blocks on example.com, whose own domain is safe)
// must not paint over the red block badge. Cleared when the tab loads afresh.
const blockedTabs = new Set<number>()

function hostFromUrl(url: string): string | null {
  try {
    let u = new URL(url)
    // blob:https://evil.xyz/uuid — judge the site that generated the page.
    if (u.protocol === 'blob:' && u.origin !== 'null') u = new URL(u.origin)
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null
    return u.hostname
  } catch {
    return null
  }
}

async function checkTab(tabId: number, url: string | undefined, count: boolean) {
  if (!url) return
  // Master switch: when paused, clear the badge and do nothing else.
  if (!(await getEnabled())) {
    chrome.action.setBadgeText({ tabId, text: '' }).catch(() => {})
    return
  }
  const host = hostFromUrl(url)
  if (!host) {
    chrome.action.setBadgeText({ tabId, text: '' }).catch(() => {})
    return
  }

  const trusted = await getTrustedBrands()
  // Pass the allowlist too, so the badge agrees with the page (RT-10: a
  // reported-safe site used to keep a red ✕ badge while the page showed nothing).
  const v = analyze(host, trusted, new Set(await getAllow()))

  const b = BADGE[v.level]
  // Don't downgrade a tab that's actively showing a block screen (the overlay's
  // red badge is authoritative) unless this scan is itself dangerous.
  if (!(blockedTabs.has(tabId) && v.level !== 'dangerous')) {
    chrome.action.setBadgeText({ tabId, text: b.text }).catch(() => {})
    chrome.action.setBadgeBackgroundColor({ tabId, color: b.color }).catch(() => {})
  }

  if (count) {
    // Count every page scanned. "Threats blocked" is counted separately, when
    // the content script actually shows a block screen (see onMessage below).
    await bumpScanned(false)
    if (v.level === 'safe') {
      const registrable = v.sld + (v.tld ? '.' + v.tld : '')
      await recordVisit(registrable, v.sld)
    }
  }
}

chrome.tabs.onUpdated.addListener((tabId, info, tab) => {
  // A fresh load starting clears any prior block state for this tab.
  if (info.status === 'loading') blockedTabs.delete(tabId)
  if (info.status === 'complete') checkTab(tabId, tab.url, true)
  else if (info.url) checkTab(tabId, info.url, false)
})

chrome.tabs.onRemoved.addListener((tabId) => blockedTabs.delete(tabId))

chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  try {
    const tab = await chrome.tabs.get(tabId)
    checkTab(tabId, tab.url, false)
  } catch {
    /* tab gone */
  }
})

chrome.runtime.onInstalled.addListener(() => {
  chrome.action.setBadgeTextColor?.({ color: '#0a0b12' }).catch(() => {})
})

// The content script reports each block screen it shows → count it + record it.
// (Only the extension's own contexts can reach this; web pages cannot. We still
// validate + clamp the payload as defense-in-depth.)
chrome.runtime.onMessage.addListener((msg, sender) => {
  // A page-level warning (fake login, BitB window, …) → amber badge, unless the
  // tab is already showing a block screen.
  if (msg?.type === 'pg-warn') {
    const tabId = sender.tab?.id
    if (tabId != null && !blockedTabs.has(tabId)) {
      chrome.action.setBadgeText({ tabId, text: BADGE.suspicious.text }).catch(() => {})
      chrome.action.setBadgeBackgroundColor({ tabId, color: BADGE.suspicious.color }).catch(() => {})
    }
    return
  }
  if (msg?.type !== 'pg-block') return
  const host = typeof msg.host === 'string' ? msg.host.slice(0, 253) : ''
  if (!host) return
  const brand = typeof msg.brand === 'string' ? msg.brand.slice(0, 60) : 'a brand'
  const score = Number.isFinite(msg.score) ? Math.max(0, Math.min(100, msg.score)) : 0
  recordBlock({ host, brand, score, ts: Date.now() })
  // Turn the toolbar badge red on the tab that showed the block (so the badge
  // signal matches the overlay, including the demo test hook).
  const tabId = sender.tab?.id
  if (tabId != null) {
    blockedTabs.add(tabId)
    chrome.action.setBadgeText({ tabId, text: BADGE.dangerous.text }).catch(() => {})
    chrome.action.setBadgeBackgroundColor({ tabId, color: BADGE.dangerous.color }).catch(() => {})
  }
})

// Re-evaluate the active tab's badge immediately when the switch is toggled.
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local' || !changes[ENABLED_KEY]) return
  chrome.tabs
    .query({ active: true, currentWindow: true })
    .then(([tab]) => {
      if (tab?.id != null) checkTab(tab.id, tab.url, false)
    })
    .catch(() => {})
})

// ── Engine RPC for content scripts ───────────────────────────────────────
// The detection engine (confusables table, Public Suffix List, popularity
// filter) is loaded once here instead of into every tab. Content scripts send a
// batch of questions; only the extension's own scripts can reach this listener,
// but every item is still validated and capped.
let engineCtx: { trusted: Awaited<ReturnType<typeof getTrustedBrands>>; allow: Set<string> } | null = null
chrome.storage.onChanged.addListener((_c, area) => { if (area === 'local') engineCtx = null })

async function answer(op: unknown, input: unknown): Promise<unknown> {
  if (typeof input !== 'string' || input.length > 2048) return null
  engineCtx ??= { trusted: await getTrustedBrands(), allow: new Set(await getAllow()) }
  switch (op) {
    case 'analyze': return analyze(input, engineCtx.trusted, engineCtx.allow)
    case 'official': return officialBrandOf(input)?.name ?? null
    case 'oauth': return oauthRedirectTarget(input)
    case 'allowed': return engineCtx.allow.has(parseHost(input).registrable)
    default: return null
  }
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.type !== 'pg-engine' || sender.id !== chrome.runtime.id || !Array.isArray(msg.items)) return
  const items = (msg.items as { op?: unknown; input?: unknown }[]).slice(0, 500)
  Promise.all(items.map((it) => answer(it?.op, it?.input))).then(sendResponse, () => sendResponse([]))
  return true // answer asynchronously
})
