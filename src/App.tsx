import { useMemo, useState } from 'react'
import { analyze, type Verdict, type Level } from './algorithms/scoring'
import type { EditOp } from './algorithms/editDistance'
import Evaluation from './Evaluation'

const EXAMPLES = [
  'paypal.com',
  'pаypal.com',
  'paypa1.com',
  'secure-paypal.xyz',
  'hdfcbank.account-verify.com',
  'аmazon.in',
  'paytm-kyc-update.tk',
]

const LEVEL_META: Record<Level, { label: string; color: string; bg: string; icon: string }> = {
  safe: { label: 'Looks Safe', color: 'var(--color-safe)', bg: 'rgba(76,141,255,0.12)', icon: '✓' },
  suspicious: { label: 'Suspicious', color: 'var(--color-warn)', bg: 'rgba(240,180,41,0.12)', icon: '!' },
  dangerous: { label: 'Likely Phishing', color: 'var(--color-danger)', bg: 'rgba(255,77,109,0.12)', icon: '⚠' },
}

export default function App() {
  const [query, setQuery] = useState('')
  const [submitted, setSubmitted] = useState('')
  const [view, setView] = useState<'check' | 'eval'>('check')

  const verdict = useMemo<Verdict | null>(
    () => (submitted.trim() ? analyze(submitted.trim()) : null),
    [submitted],
  )

  function check(value: string) {
    setQuery(value)
    setSubmitted(value)
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-[#1c2030] bg-panel/60 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-5 py-3">
          <div className="flex items-center gap-2.5">
            <div className="grid h-9 w-9 place-items-center rounded-lg border border-[#20232f] bg-panel-2 text-[var(--color-accent)]">
              <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="10.5" cy="10.5" r="6.5" />
                <path d="M15.5 15.5 L21 21" />
              </svg>
            </div>
            <div>
              <div className="text-base font-bold leading-none tracking-tight">
                Unmask<span className="text-[var(--color-accent)]">r</span>
              </div>
              <div className="text-[11px] text-muted">
                Real-time lookalike-domain detection
              </div>
            </div>
          </div>
          <nav className="flex items-center gap-1 rounded-lg border border-[#222639] p-0.5 text-sm">
            {(['check', 'eval'] as const).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`rounded-md px-3 py-1 transition ${
                  view === v ? 'bg-[#1a1d2e] text-ink' : 'text-muted hover:text-ink'
                }`}
              >
                {v === 'check' ? 'Checker' : 'Evaluation'}
              </button>
            ))}
          </nav>
        </div>
      </header>

      {view === 'eval' && <Evaluation />}
      <main className={`mx-auto max-w-4xl px-5 pb-24 ${view === 'eval' ? 'hidden' : ''}`}>
        <section className="pt-14 text-center">
          <h1 className="bg-gradient-to-br from-white to-[#9fb3ff] bg-clip-text text-4xl font-extrabold tracking-tight text-transparent sm:text-5xl">
            Is this domain a fake?
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-muted">
            Paste a website address. Unmaskr checks it against trusted brands
            using string algorithms — and catches invisible{' '}
            <span className="text-ink">homoglyph</span> disguises that normal
            checks miss.
          </p>

          <form
            className="mx-auto mt-7 flex max-w-2xl items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              check(query)
            }}
          >
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="e.g. paypal.com  or  pаypal.com"
              spellCheck={false}
              autoCapitalize="none"
              className="flex-1 rounded-xl border border-[#262b3d] bg-panel px-4 py-3 font-mono text-ink outline-none transition focus:border-[var(--color-accent)]"
            />
            <button
              type="submit"
              className="rounded-xl bg-[var(--color-accent)] px-6 py-3 font-semibold text-white transition hover:brightness-110"
            >
              Check
            </button>
          </form>

          <div className="mx-auto mt-4 flex max-w-2xl flex-wrap justify-center gap-2">
            {EXAMPLES.map((ex) => (
              <button
                key={ex}
                onClick={() => check(ex)}
                className="rounded-full border border-[#262b3d] bg-panel px-3 py-1 font-mono text-xs text-muted transition hover:border-[#3a4a6b] hover:text-ink"
              >
                {ex}
              </button>
            ))}
          </div>
        </section>

        {verdict ? <VerdictCard key={verdict.input} v={verdict} /> : <HowItWorks />}
      </main>
    </div>
  )
}

function VerdictCard({ v }: { v: Verdict }) {
  const meta = LEVEL_META[v.level]
  return (
    <section className="animate-rise mt-10 overflow-hidden rounded-2xl border border-[#1e2233] bg-panel">
      <div
        className="flex flex-wrap items-center gap-4 px-6 py-5"
        style={{ background: meta.bg, borderBottom: '1px solid #1e2233' }}
      >
        <div
          className="grid h-14 w-14 shrink-0 place-items-center rounded-xl text-2xl font-bold"
          style={{ background: meta.color, color: '#0a0b12' }}
        >
          {meta.icon}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-xl font-bold" style={{ color: meta.color }}>
            {meta.label}
          </div>
          <div className="truncate font-mono text-sm text-muted">{v.host}</div>
        </div>
        <RiskGauge score={v.score} color={meta.color} />
      </div>

      <div className="grid gap-6 p-6 md:grid-cols-2">
        <div className="space-y-5">
          {v.brand && (
            <div>
              <Lbl>Impersonated brand</Lbl>
              <div className="mt-1 flex items-center gap-2">
                <span className="text-lg font-bold text-ink">{v.brand.name}</span>
                <span className="rounded-full bg-panel-2 px-2 py-0.5 text-xs text-muted">
                  {v.brand.category}
                </span>
              </div>
              <div className="font-mono text-xs text-muted">
                real domain: {v.brand.domain}
              </div>
            </div>
          )}

          <div>
            <Lbl>The domain, character by character</Lbl>
            <HostGlyphs v={v} />
            {v.homoglyphs.length > 0 && (
              <div className="mt-1.5 text-xs text-muted">
                Skeleton (disguise removed):{' '}
                <span className="font-mono text-[var(--color-accent-2)]">
                  {v.skeleton}
                </span>
              </div>
            )}
          </div>

          {v.brand && v.trace.length > 0 && (
            <div>
              <Lbl>Alignment to “{v.brand.core}”</Lbl>
              <Alignment trace={v.trace} />
              <Legend />
            </div>
          )}
        </div>

        <div className="space-y-5">
          <div>
            <Lbl>Why — detection signals</Lbl>
            <ul className="mt-2 space-y-2">
              {v.signals.map((s, i) => (
                <li key={i} className="rounded-lg border border-[#222639] bg-panel-2 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-ink">{s.label}</span>
                    {s.weight > 0 && (
                      <span className="font-mono text-[11px] text-muted">
                        +{Math.round(s.weight * 100)}
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 text-xs leading-relaxed text-muted">
                    {s.detail}
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <Lbl>Algorithms used</Lbl>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <Stat k="Skeleton norm." val="UTS #39" />
              <Stat k="Edit distance" val={v.distance.toFixed(2)} />
              <Stat k="Similarity" val={`${Math.round(v.similarity * 100)}%`} />
              <Stat k="DP operations" val={v.ops.toLocaleString()} />
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

function HostGlyphs({ v }: { v: Verdict }) {
  return (
    <div className="mt-1.5 break-all rounded-lg border border-[#222639] bg-panel-2 p-3 font-mono text-lg">
      {[...v.host].map((ch, i) => {
        const bad = ch.charCodeAt(0) > 127
        return (
          <span
            key={i}
            className={bad ? 'rounded px-0.5' : ''}
            style={
              bad
                ? { background: 'rgba(255,77,109,0.22)', color: 'var(--color-danger)', outline: '1px solid var(--color-danger)' }
                : undefined
            }
            title={bad ? `look-alike character (U+${ch.codePointAt(0)!.toString(16).toUpperCase().padStart(4, '0')})` : undefined}
          >
            {ch}
          </span>
        )
      })}
    </div>
  )
}

function Alignment({ trace }: { trace: EditOp[] }) {
  const colOf = (op: EditOp): string => {
    if (op.type === 'match') return 'var(--color-safe)'
    if (op.type === 'sub') {
      if (op.kind === 'visual') return 'var(--color-warn)'
      if (op.kind === 'keyboard') return '#fb923c'
      return 'var(--color-danger)'
    }
    return 'var(--color-muted)'
  }
  return (
    <div className="mt-1.5 overflow-x-auto rounded-lg border border-[#222639] bg-panel-2 p-3">
      <div className="flex gap-1 font-mono text-lg">
        {trace.map((op, i) => (
          <div key={i} className="flex flex-col items-center">
            <span style={{ color: colOf(op) }}>{op.a ?? '–'}</span>
            <span className="my-0.5 h-px w-4" style={{ background: colOf(op) }} />
            <span className="text-muted">{op.b ?? '–'}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function Legend() {
  const items: [string, string][] = [
    ['var(--color-safe)', 'match'],
    ['var(--color-warn)', 'look-alike swap'],
    ['var(--color-danger)', 'real change'],
    ['var(--color-muted)', 'insert / delete'],
  ]
  return (
    <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-muted">
      {items.map(([c, l]) => (
        <span key={l} className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full" style={{ background: c }} />
          {l}
        </span>
      ))}
    </div>
  )
}

function RiskGauge({ score, color }: { score: number; color: string }) {
  const r = 26
  const circ = 2 * Math.PI * r
  return (
    <div className="relative h-16 w-16 shrink-0">
      <svg viewBox="0 0 64 64" className="h-16 w-16 -rotate-90">
        <circle cx="32" cy="32" r={r} fill="none" stroke="#222639" strokeWidth="6" />
        <circle
          cx="32" cy="32" r={r} fill="none" stroke={color} strokeWidth="6"
          strokeLinecap="round" strokeDasharray={circ}
          strokeDashoffset={circ * (1 - score / 100)}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center">
        <span className="font-mono text-sm font-bold" style={{ color }}>
          {score}
        </span>
      </div>
    </div>
  )
}

function Lbl({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[11px] font-semibold uppercase tracking-wider text-muted">
      {children}
    </div>
  )
}

function Stat({ k, val }: { k: string; val: string }) {
  return (
    <div className="rounded-lg border border-[#222639] bg-panel-2 p-2.5">
      <div className="text-[10px] uppercase tracking-wider text-muted">{k}</div>
      <div className="font-mono text-sm text-ink">{val}</div>
    </div>
  )
}

function HowItWorks() {
  const steps = [
    ['1 · Skeleton normalization', 'Map every look-alike character to its standard form (Cyrillic “а” → “a”), so disguises collapse.'],
    ['2 · Weighted edit distance', 'Measure closeness to each brand with dynamic programming — visual/keyboard swaps cost less.'],
    ['3 · Horspool matching', 'Scan for a brand hidden inside the name, using bad-character shifts to skip ahead fast.'],
    ['4 · Risk verdict', 'Combine the signals into an explainable score — brand, trick, and risk.'],
  ]
  return (
    <section className="mt-12 grid gap-3 sm:grid-cols-2">
      {steps.map(([t, d]) => (
        <div key={t} className="rounded-xl border border-[#1e2233] bg-panel p-4">
          <div className="text-sm font-bold text-[var(--color-accent-2)]">{t}</div>
          <div className="mt-1 text-sm text-muted">{d}</div>
        </div>
      ))}
    </section>
  )
}
