/// <reference types="chrome" />
import { useEffect, useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { analyze, type Verdict, type Level } from '../algorithms/scoring'
import { predictML, type MLVerdict } from '../algorithms/mlScore'
import type { EditOp } from '../algorithms/editDistance'
import type { Brand } from '../data/brands'
import { getTrustedBrands, trustedCount, getStats, getRecent, getEnabled, setEnabled, getScoreMode, setScoreMode, getAllow, addAllow, removeAllow, type ScoreMode, type Threat } from './storage'
import './popup.css'

const META: Record<Level, { label: string; color: string; icon: string }> = {
  safe: { label: 'Looks Safe', color: '#4c8dff', icon: '✓' },
  suspicious: { label: 'Suspicious', color: '#f0b429', icon: '!' },
  dangerous: { label: 'Likely Phishing', color: '#ff4d6d', icon: '⚠' },
}

/* monoline inspection mark — replaces the emoji logo */
function Logo() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="M15.5 15.5 L21 21" />
    </svg>
  )
}

function Popup() {
  const [tabHost, setTabHost] = useState<string | null>(null)
  const [trusted, setTrusted] = useState<Brand[]>([])
  const [learned, setLearned] = useState(0)
  const [stats, setStats] = useState({ scanned: 0, blocked: 0 })
  const [recent, setRecent] = useState<Threat[]>([])
  const [manual, setManual] = useState('')
  const [override, setOverride] = useState<string | null>(null)
  const [enabled, setEnabledState] = useState(true)
  const [mode, setMode] = useState<ScoreMode>('rules')
  const [allow, setAllow] = useState<string[]>([])

  useEffect(() => {
    ;(async () => {
      setEnabledState(await getEnabled())
      setMode(await getScoreMode())
      setAllow(await getAllow())
      setTrusted(await getTrustedBrands())
      setLearned(await trustedCount())
      setStats(await getStats())
      setRecent(await getRecent())
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
        if (tab?.url) {
          const u = new URL(tab.url)
          if (u.protocol === 'http:' || u.protocol === 'https:') setTabHost(u.hostname)
        }
      } catch {
        /* ignore */
      }
    })()
  }, [])

  const target = override ?? tabHost
  const allowSet = useMemo(() => new Set(allow), [allow])
  const verdict = useMemo<Verdict | null>(
    () => (target ? analyze(target, trusted, allowSet) : null),
    [target, trusted, allowSet],
  )

  const reportSafe = async (registrable: string) => {
    await addAllow(registrable)
    setAllow(await getAllow())
  }
  const undoSafe = async (registrable: string) => {
    await removeAllow(registrable)
    setAllow(await getAllow())
  }
  const mlVerdict = useMemo<MLVerdict | null>(
    () => (target && mode === 'ml' ? predictML(target) : null),
    [target, mode],
  )

  const toggle = async () => {
    const next = !enabled
    setEnabledState(next)
    await setEnabled(next)
  }
  const switchMode = async (m: ScoreMode) => {
    setMode(m)
    await setScoreMode(m)
  }

  return (
    <div>
      <div className="hd">
        <div className="mark"><Logo /></div>
        <div>
          <div className="name">Unmask<span>r</span></div>
          <div className="sub">Lookalike-domain detector</div>
        </div>
        <button
          className={'switch' + (enabled ? ' on' : '')}
          role="switch"
          aria-checked={enabled}
          aria-label="Toggle protection"
          title={enabled ? 'Protection on — click to pause' : 'Protection paused — click to enable'}
          onClick={toggle}
        >
          <span className="knob" />
        </button>
      </div>

      {!enabled && (
        <div className="paused">⏸ Protection paused — sites are not being checked.</div>
      )}

      {/* Stats dashboard */}
      <div className="stats">
        <Stat n={stats.blocked} l="Threats blocked" c="var(--danger)" />
        <Stat n={stats.scanned} l="Sites scanned" c="var(--ink)" />
        <Stat n={learned} l="Sites learned" c="var(--accent)" />
      </div>

      <div className="section">
        <div className="lblrow">
          <div className="lbl">{override ? 'Checked domain' : 'Current tab'}</div>
          <div className="modeseg" role="tablist" aria-label="Scoring engine">
            <button className={mode === 'rules' ? 'active' : ''} onClick={() => switchMode('rules')}>Rules</button>
            <button className={mode === 'ml' ? 'active' : ''} onClick={() => switchMode('ml')}>ML</button>
          </div>
        </div>
        {!target ? (
          <div className="muted" style={{ fontSize: 13, padding: '6px 0' }}>
            Open a website to see its safety verdict, or check any domain below.
          </div>
        ) : mode === 'ml' && mlVerdict ? (
          <MLVerdictBlock v={mlVerdict} />
        ) : verdict ? (
          <VerdictBlock
            v={verdict}
            allowed={allowSet.has(verdict.registrable)}
            onReport={() => reportSafe(verdict.registrable)}
            onUndo={() => undoSafe(verdict.registrable)}
          />
        ) : null}
      </div>

      <div className="divider" />

      <div className="section">
        <div className="lbl">Check any domain</div>
        <form
          className="checkrow"
          onSubmit={(e) => {
            e.preventDefault()
            if (manual.trim()) setOverride(manual.trim())
          }}
        >
          <input value={manual} spellCheck={false} placeholder="e.g. pаypal.com" onChange={(e) => setManual(e.target.value)} />
          <button type="submit">Check</button>
        </form>
        {override && (
          <button className="link" onClick={() => { setOverride(null); setManual('') }}>
            ← back to current tab
          </button>
        )}
      </div>

      {recent.length > 0 && (
        <>
          <div className="divider" />
          <div className="section">
            <div className="lbl">Recent threats blocked</div>
            <ul className="recent">
              {recent.map((t, i) => (
                <li key={i}>
                  <span className="rdot" />
                  <span className="rhost mono">{t.host}</span>
                  <span className="rbrand muted">fake {t.brand}</span>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}

      <div className="disc">
        <span className="ic">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
          </svg>
        </span>
        <p>
          <b>Unmaskr can make mistakes.</b> Treat a verdict as a heads-up, not proof — always check
          the address bar before entering passwords or payments.
        </p>
      </div>
    </div>
  )
}

function Stat({ n, l, c }: { n: number; l: string; c: string }) {
  return (
    <div className="stat">
      <div className="snum" style={{ color: c }}>{n}</div>
      <div className="slab">{l}</div>
    </div>
  )
}

const FRIENDLY: Record<string, string> = {
  bestSim: 'Resembles a brand',
  simUnofficial: 'Looks like a brand, not official',
  homoglyph: 'Homoglyph disguise',
  mixedScript: 'Mixed scripts',
  skelExact: 'Exact brand once un-disguised',
  embedLure: 'Brand + lure word',
  subBrand: 'Brand in a sub-domain',
  subUnofficial: 'Brand sub-domain, not official',
  embedded: 'Brand inside a longer name',
  tldSuspicious: 'Throwaway TLD',
  lureCount: 'Urgency / lure words',
  digitRatio: 'Digits in the name',
  hyphenCount: 'Hyphens in the name',
  nearestTranspose: 'Swapped letters',
  nearestVisual: 'Digit/letter look-alike',
  official: 'Official domain',
  exactCore: 'Brand name on another domain',
  homoglyphCount: 'Disguised characters',
  sldLen: 'Name length',
}

function MLVerdictBlock({ v }: { v: MLVerdict }) {
  const m = META[v.level]
  const top = v.contributions.filter((c) => Math.abs(c.contribution) > 0.05).slice(0, 4)
  const maxAbs = Math.max(...top.map((c) => Math.abs(c.contribution)), 0.01)
  return (
    <div>
      <div className="verdict" style={{ background: `${m.color}1f` }}>
        <div className="vbadge" style={{ background: m.color }}>{m.icon}</div>
        <div style={{ minWidth: 0 }}>
          <div className="vlevel" style={{ color: m.color }}>{m.label}</div>
          <div className="vhost mono muted">{v.host}</div>
        </div>
        <div className="vscore" style={{ color: m.color }}>
          {Math.round(v.probability * 100)}<span style={{ fontSize: 11 }}>%</span>
        </div>
      </div>

      <div className="lbl" style={{ marginTop: 12 }}>Why — top signals</div>
      <div className="contribs">
        {top.map((c, i) => {
          const pos = c.contribution >= 0
          return (
            <div key={i} className="contrib">
              <span className="cname">{FRIENDLY[c.feature] ?? c.feature}</span>
              <span className="cbar">
                <span className="cfill" style={{ width: `${(Math.abs(c.contribution) / maxAbs) * 100}%`, background: pos ? '#ff4d6d' : '#4c8dff' }} />
              </span>
              <span className="cval" style={{ color: pos ? '#ff4d6d' : '#4c8dff' }}>{pos ? '+' : ''}{c.contribution.toFixed(2)}</span>
            </div>
          )
        })}
      </div>
      <div className="muted" style={{ fontSize: 10.5, marginTop: 8 }}>
        Logistic-regression hybrid · red pushes toward phishing, blue toward safe
      </div>
    </div>
  )
}

function VerdictBlock({ v, allowed, onReport, onUndo }: { v: Verdict; allowed: boolean; onReport: () => void; onUndo: () => void }) {
  const m = META[v.level]
  return (
    <div>
      <div className="verdict" style={{ background: `${m.color}1f` }}>
        <div className="vbadge" style={{ background: m.color }}>{m.icon}</div>
        <div style={{ minWidth: 0 }}>
          <div className="vlevel" style={{ color: m.color }}>{m.label}</div>
          <div className="vhost mono muted">{v.host}</div>
        </div>
        <div className="vscore" style={{ color: m.color }}>{v.score}</div>
      </div>

      {v.brand && (
        <div className="brandline">
          {v.level === 'safe' ? 'Matches' : 'Looks like'} <b>{v.brand.name}</b>{' '}
          <span className="muted mono" style={{ fontSize: 11 }}>({v.brand.domain})</span>
        </div>
      )}

      {v.homoglyphs.length > 0 && (
        <div className="reveal">
          <div className="disguise mono">
            {[...v.host].map((ch, i) => (
              <span key={i} className={ch.charCodeAt(0) > 127 ? 'bad' : ''}>{ch}</span>
            ))}
          </div>
          <div className="truth">
            <span>real form</span>
            <span aria-hidden="true">→</span>
            <span className="real mono">{v.skeleton}</span>
          </div>
        </div>
      )}

      {v.brand && v.trace.length > 0 && v.level !== 'safe' && (
        <Alignment trace={v.trace} brand={v.brand.core} />
      )}

      <ul className="sigs">
        {v.signals.slice(0, 3).map((s, i) => (
          <li key={i} className="sig">
            <div className="t">{s.label}</div>
            <div className="d">{s.detail}</div>
          </li>
        ))}
      </ul>

      {allowed ? (
        <div className="fpnote">
          <span>You marked this site as safe.</span>
          <button className="link" onClick={onUndo}>Undo</button>
        </div>
      ) : v.level !== 'safe' ? (
        <button className="report" onClick={onReport}>
          Not a phishing site? Report it as safe
        </button>
      ) : null}
    </div>
  )
}

function Alignment({ trace, brand }: { trace: EditOp[]; brand: string }) {
  const col = (op: EditOp) => {
    if (op.type === 'match') return '#4c8dff'
    if (op.type === 'sub') return op.kind === 'visual' ? '#f0b429' : op.kind === 'keyboard' ? '#fb923c' : '#ff4d6d'
    return '#8b91a3'
  }
  return (
    <div className="align">
      <div className="alabel muted">vs “{brand}”</div>
      <div className="arow mono">
        {trace.map((op, i) => (
          <div key={i} className="acol">
            <span style={{ color: col(op) }}>{op.a ?? '–'}</span>
            <span className="aline" style={{ background: col(op) }} />
            <span className="muted">{op.b ?? '–'}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

createRoot(document.getElementById('root')!).render(<Popup />)
