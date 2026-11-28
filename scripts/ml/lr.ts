// Shared logistic-regression trainer (standardize on train, GD, class-weighted, L2)
// and the seeded stratified split. Used by train-real.ts and eval/paper.ts.
export interface LRRow { x: number[]; y: 0 | 1 }

const sigmoid = (t: number) => 1 / (1 + Math.exp(-t))

export function trainLR(train: LRRow[], epochs = 600) {
  const F = train[0].x.length
  const mean = new Array(F).fill(0), std = new Array(F).fill(0)
  for (const r of train) for (let j = 0; j < F; j++) mean[j] += r.x[j]
  for (let j = 0; j < F; j++) mean[j] /= train.length
  for (const r of train) for (let j = 0; j < F; j++) std[j] += (r.x[j] - mean[j]) ** 2
  for (let j = 0; j < F; j++) std[j] = Math.sqrt(std[j] / train.length) || 1
  const nP = train.filter((r) => r.y === 1).length || 1, nN = train.length - nP || 1
  const wP = train.length / (2 * nP), wN = train.length / (2 * nN)
  const w = new Array(F).fill(0); let b = 0
  for (let e = 0; e < epochs; e++) {
    const gw = new Array(F).fill(0); let gb = 0, ws = 0
    for (const r of train) {
      let t = b; for (let j = 0; j < F; j++) t += w[j] * ((r.x[j] - mean[j]) / std[j])
      const pr = sigmoid(t), cw = r.y ? wP : wN, err = (pr - r.y) * cw
      for (let j = 0; j < F; j++) gw[j] += err * ((r.x[j] - mean[j]) / std[j])
      gb += err; ws += cw
    }
    for (let j = 0; j < F; j++) w[j] -= 0.5 * (gw[j] / ws + 1e-4 * w[j])
    b -= 0.5 * (gb / ws)
  }
  const prob = (r: LRRow) => { let t = b; for (let j = 0; j < F; j++) t += w[j] * ((r.x[j] - mean[j]) / std[j]); return sigmoid(t) }
  return { mean, std, w, b, prob }
}

/** Threshold with the best F1 on `rows`. */
export function bestF1Threshold(rows: LRRow[], prob: (r: LRRow) => number) {
  let thr = 0.5, best = -1
  for (let t = 0.05; t < 0.95; t += 0.01) {
    let tp = 0, fp = 0, fn = 0
    for (const r of rows) { const yp = prob(r) >= t ? 1 : 0; if (r.y && yp) tp++; else if (!r.y && yp) fp++; else if (r.y && !yp) fn++ }
    const pr = tp / (tp + fp || 1), rc = tp / (tp + fn || 1), f1 = 2 * pr * rc / (pr + rc || 1)
    if (f1 > best) { best = f1; thr = t }
  }
  return thr
}

export function mulberry32(s: number) {
  return () => { s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }
}

/** Seeded 70/30 split of one stratum (shuffle in place, then cut). */
export function split<T>(items: T[], rng: () => number, frac = 0.7) {
  const a = [...items]
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]] }
  const cut = Math.floor(a.length * frac)
  return { tr: a.slice(0, cut), te: a.slice(cut) }
}
