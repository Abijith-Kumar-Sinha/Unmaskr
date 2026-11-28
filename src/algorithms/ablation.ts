// Ablation switches for the paper's evaluation (scripts/eval/paper.ts).
// All false in the shipped extension — nothing in src/ext ever sets them.
// Each switch removes exactly one component so its contribution can be measured.
export const ABLATE = {
  noSkeleton: false, // compare raw labels: no UTS #39 folding (mixed-script check kept)
  noMixedScript: false, // drop the mixed-script homoglyph test
  uniformCosts: false, // every substitution costs 1 (plain Damerau–Levenshtein)
  noTranspose: false, // Levenshtein: an adjacent swap costs 2, not 1
  noHorspool: false, // no embedded-brand search
  noCorroboration: false, // embedded brand flags without lure / TLD / homoglyph evidence
  noDecoy: false, // no userinfo / brand-domain-as-subdomain signal
  noSecondary: false, // no suspicious-TLD or lure-word weight
}
export type AblationKey = keyof typeof ABLATE
export function resetAblation() {
  for (const k of Object.keys(ABLATE) as AblationKey[]) ABLATE[k] = false
}
