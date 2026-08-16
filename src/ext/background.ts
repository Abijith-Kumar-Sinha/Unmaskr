/// <reference types="chrome" />
import { analyze, type Level } from '../algorithms/scoring'
import { getTrustedBrands, recordVisit, bumpScanned, recordBlock, getEnabled, ENABLED_KEY } from './storage'

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
    const u = new URL(url)
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
  const v = analyze(host, trusted)

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
