export type RangeFlag =
  | "critical-low"
  | "low"
  | "normal"
  | "high"
  | "critical-high"
  | "abnormal"
  | "unflagged"

export type ReferenceRange = {
  /** Lowest normal value, inclusive. */
  low?: number
  /** Highest normal value, inclusive. */
  high?: number
  /** Values below this are flagged critical low. */
  criticalLow?: number
  /** Values above this are flagged critical high. */
  criticalHigh?: number
  /** Shown instead of the generated range, such as "Negative". */
  text?: string
}

/**
 * Flags a value against its reference range. Critical limits come first;
 * text and missing ranges are not flagged.
 */
export function flagValue(
  value: number | string,
  range: ReferenceRange = {}
): RangeFlag {
  if (typeof value !== "number" || Number.isNaN(value)) return "unflagged"
  const { low, high, criticalLow, criticalHigh } = range
  if (criticalLow !== undefined && value < criticalLow) return "critical-low"
  if (criticalHigh !== undefined && value > criticalHigh) return "critical-high"
  if (low !== undefined && value < low) return "low"
  if (high !== undefined && value > high) return "high"
  if (low === undefined && high === undefined) return "unflagged"
  return "normal"
}

export const rangeFlagLabels: Record<RangeFlag, string> = {
  "critical-low": "Critical low",
  low: "Low",
  normal: "Normal",
  high: "High",
  "critical-high": "Critical high",
  abnormal: "Abnormal",
  unflagged: "Not flagged",
}

function formatNumber(value: number, decimals?: number) {
  return decimals === undefined ? String(value) : value.toFixed(decimals)
}

/** The range as printed on a report, such as "70–99" or "≤ 200". */
export function formatReferenceRange(
  range: ReferenceRange | undefined,
  decimals?: number
): string | null {
  if (!range) return null
  if (range.text) return range.text
  const { low, high } = range
  if (low !== undefined && high !== undefined)
    return `${formatNumber(low, decimals)}–${formatNumber(high, decimals)}`
  if (high !== undefined) return `≤ ${formatNumber(high, decimals)}`
  if (low !== undefined) return `≥ ${formatNumber(low, decimals)}`
  return null
}
