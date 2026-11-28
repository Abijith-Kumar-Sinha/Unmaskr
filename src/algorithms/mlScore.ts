// Tier-1 ML hybrid — inference.
//
// The "model" is ~19 floats bundled in modelWeights.ts. A verdict is just the
// classic feature extractor followed by one dot product:
//     p = sigmoid( bias + Σ wⱼ · (xⱼ − meanⱼ)/stdⱼ )
// No runtime dependency, no network, sub-millisecond. Because the model is
// linear, every prediction decomposes into per-feature contributions, so the
// ML path stays as explainable as the rule path.
import type { Level } from './scoring'
import { extractFeatures } from './features'
import { MODEL } from '../data/modelWeights'
import { parseHost } from './scoring'
import { skeleton } from './confusables'
import { BRANDS } from '../data/brands'

export interface MLContribution {
  feature: string
  value: number // raw feature value
  contribution: number // wⱼ · standardized(value); >0 pushes toward phishing
}

export interface MLVerdict {
  host: string
  probability: number // P(phishing) in [0,1]
  level: Level
  contributions: MLContribution[] // sorted by |contribution|, descending
}

export function predictML(input: string): MLVerdict {
  const { names, values } = extractFeatures(input)
  const contributions: MLContribution[] = values.map((v, j) => {
    const std = MODEL.std[j] || 1
    return { feature: names[j], value: v, contribution: MODEL.weights[j] * ((v - MODEL.mean[j]) / std) }
  })
  let logit = MODEL.bias
  for (const c of contributions) logit += c.contribution
  contributions.sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution))
  // URL-structure guard: the model reads the host, not the throwaway username in
  // https://brand.com@evil.xyz (RT-01), so that trick is caught by the same rule
  // the rule engine uses rather than by a learned weight.
  const { userinfo } = parseHost(input)
  if (userinfo) {
    const u = skeleton(userinfo)
    const decoy = BRANDS.find((b) => u.includes(b.domain) || (b.core.length >= 4 && u.includes(b.core)))
    if (decoy) {
      // Shown as the dominant signal in the popup's contribution bars.
      const top = Math.abs(contributions[0]?.contribution ?? 0) + 1
      contributions.unshift({ feature: 'brandBeforeAt', value: 1, contribution: top })
      return { host: input, probability: 1, level: 'dangerous', contributions }
    }
  }
  // Platt-scaled, so the probability is calibrated (thresholds are on this scale).
  const probability = 1 / (1 + Math.exp(-(MODEL.plattA * logit + MODEL.plattB)))
  const level: Level =
    probability >= MODEL.blockThreshold ? 'dangerous' : probability >= MODEL.warnThreshold ? 'suspicious' : 'safe'
  return { host: input, probability, level, contributions }
}
