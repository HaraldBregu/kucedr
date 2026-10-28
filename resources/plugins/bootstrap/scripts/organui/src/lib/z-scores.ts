export type Lms = readonly [l: number, m: number, s: number]

/** The measurement at a z-score, for LMS parameters. */
export function lmsValue([l, m, s]: Lms, z: number) {
  return l === 0 ? m * Math.exp(s * z) : m * (1 + l * s * z) ** (1 / l)
}

/**
 * The z-score of a measurement for LMS parameters. With `restricted`, values
 * beyond ±3 SD use WHO's restricted extrapolation, which keeps a skewed tail
 * from compressing extreme values; WHO applies it to weight-based indicators.
 * Returns null for a non-positive value.
 */
export function lmsZScore(
  value: number,
  lms: Lms,
  { restricted = false }: { restricted?: boolean } = {}
) {
  if (!(value > 0)) return null
  const [l, m, s] = lms
  const z = l === 0 ? Math.log(value / m) / s : ((value / m) ** l - 1) / (l * s)
  if (!restricted || Math.abs(z) <= 3) return z
  const sd3 = lmsValue(lms, 3 * Math.sign(z))
  const sd2 = lmsValue(lms, 2 * Math.sign(z))
  return 3 * Math.sign(z) + (value - sd3) / Math.abs(sd3 - sd2)
}

/** The standard normal cumulative distribution, as a percentile. */
export function zToPercentile(z: number) {
  // Abramowitz and Stegun 7.1.26, accurate to 1.5e-7.
  const x = Math.abs(z) / Math.SQRT2
  const t = 1 / (1 + 0.3275911 * x)
  const erf =
    1 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) *
      t +
      0.254829592) *
      t *
      Math.exp(-x * x)
  return 50 * (1 + Math.sign(z) * erf)
}

/** The z-score of a percentile between 0 and 100, exclusive. */
export function percentileToZ(percentile: number) {
  let low = -8
  let high = 8
  for (let i = 0; i < 60; i++) {
    const mid = (low + high) / 2
    if (zToPercentile(mid) < percentile) low = mid
    else high = mid
  }
  return (low + high) / 2
}

/** Formats a percentile as "34th", "<0.1st" or ">99.9th". */
export function formatPercentile(percentile: number) {
  if (percentile < 0.1) return "<0.1st"
  if (percentile > 99.9) return ">99.9th"
  const rounded =
    percentile < 1 || percentile > 99
      ? Math.round(percentile * 10) / 10
      : Math.round(percentile)
  const whole = Math.floor(rounded)
  const suffix =
    rounded !== whole || (whole % 100 >= 11 && whole % 100 <= 13)
      ? "th"
      : (["th", "st", "nd", "rd"][whole % 10] ?? "th")
  return `${rounded}${suffix}`
}
