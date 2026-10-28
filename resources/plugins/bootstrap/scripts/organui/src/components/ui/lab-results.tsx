import * as React from "react"
import { cn } from "cn"

import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  flagValue,
  formatReferenceRange,
  rangeFlagLabels,
  type RangeFlag,
  type ReferenceRange,
} from "@/lib/reference-ranges"
import { ArrowUpIcon, ArrowDownIcon, TriangleAlertIcon, CheckIcon, MinusIcon } from "lucide-react"

export { formatReferenceRange }
export type LabFlag = RangeFlag
export type LabReferenceRange = ReferenceRange
/** Flags a numeric value against its reference range. */
export const labFlag = flagValue
export const labFlagLabels = rangeFlagLabels

export type LabMeasurement = {
  value: number
  /** An ISO 8601 date or date-time. */
  date: string
}

export type LabResult = {
  id: string
  name: string
  /** A number is flagged against the range; text, such as "Negative", is not. */
  value: number | string
  unit?: string
  /** An ISO 8601 date or date-time. */
  date?: string
  referenceRange?: LabReferenceRange
  /** The flag reported by the laboratory. Overrides the computed flag. */
  flag?: LabFlag
  /** Earlier and current results for the trend sparkline, in any order. */
  history?: readonly LabMeasurement[]
  /** Fixed decimal places for the value, range and trend. */
  decimals?: number
}

export type LabResultsTableProps = Omit<
  React.ComponentProps<"div">,
  "results"
> & {
  /** The results, each with its value, unit, range and history. */
  results: readonly LabResult[]
  /** Names the table for assistive technology and shows below it. */
  caption?: React.ReactNode
  /** Defaults to a UTC date such as "Oct 1, 2026". */
  formatDate?: (date: string) => string
  /** Shows the trend column. Defaults to true. */
  showTrend?: boolean
}

export function resultFlag(result: LabResult): LabFlag {
  return result.flag ?? labFlag(result.value, result.referenceRange)
}

function formatNumber(value: number, decimals?: number) {
  return decimals === undefined ? String(value) : value.toFixed(decimals)
}

function formatValue(value: number | string, decimals?: number) {
  return typeof value === "number" ? formatNumber(value, decimals) : value
}

const dateFormat = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeZone: "UTC",
})

// A fixed locale and time zone render the same on the server and the client.
function defaultFormatDate(date: string) {
  const time = Date.parse(date)
  return Number.isNaN(time) ? date : dateFormat.format(time)
}

function sortedHistory(history: readonly LabMeasurement[]) {
  return [...history].sort((a, b) => Date.parse(a.date) - Date.parse(b.date))
}

/** A sentence describing the trend, used as the sparkline's accessible name. */
export function describeTrend(
  result: LabResult,
  formatDate: (date: string) => string = defaultFormatDate
): string | null {
  if (!result.history || result.history.length < 2) return null
  const points = sortedHistory(result.history)
  const first = points[0]!
  const last = points.at(-1)!
  const unit = result.unit ? ` ${result.unit}` : ""
  const direction =
    last.value > first.value
      ? "rising"
      : last.value < first.value
        ? "falling"
        : "unchanged"
  return `${result.name} trend, ${points.length} results from ${formatDate(
    first.date
  )} to ${formatDate(last.date)}: ${formatNumber(
    first.value,
    result.decimals
  )} to ${formatNumber(last.value, result.decimals)}${unit}, ${direction}`
}

function FlagIcon({ flag }: { flag: LabFlag }) {
  switch (flag) {
    case "high":
      return (
        <ArrowUpIcon aria-hidden="true" className="size-4 shrink-0" />
      )
    case "low":
      return (
        <ArrowDownIcon aria-hidden="true" className="size-4 shrink-0" />
      )
    case "critical-high":
    case "critical-low":
    case "abnormal":
      return (
        <TriangleAlertIcon aria-hidden="true" className="size-4 shrink-0" />
      )
    case "normal":
      return (
        <CheckIcon aria-hidden="true" className="size-4 shrink-0" />
      )
    default:
      return (
        <MinusIcon aria-hidden="true" className="size-4 shrink-0" />
      )
  }
}

function isAbnormal(flag: LabFlag) {
  return flag !== "normal" && flag !== "unflagged"
}

function isCritical(flag: LabFlag) {
  return flag === "critical-low" || flag === "critical-high"
}

export function LabFlagLabel({
  flag,
  className,
}: {
  flag: LabFlag
  className?: string
}) {
  return (
    <span
      data-slot="lab-flag"
      data-flag={flag}
      className={cn(
        "inline-flex items-center gap-1 text-xs font-medium",
        isCritical(flag)
          ? "text-destructive"
          : isAbnormal(flag)
            ? "text-foreground"
            : "text-muted-foreground",
        className
      )}
    >
      <FlagIcon flag={flag} />
      {labFlagLabels[flag]}
    </span>
  )
}

const sparkWidth = 96
const sparkHeight = 28
const sparkPad = 3

export function LabSparkline({
  result,
  label,
  className,
}: {
  result: LabResult
  label: string
  className?: string
}) {
  const points = sortedHistory(result.history ?? [])
  const range = result.referenceRange ?? {}
  const values = points.map(({ value }) => value)
  const bounds = [
    ...values,
    ...[range.low, range.high].filter(
      (value): value is number => value !== undefined
    ),
  ]
  let min = Math.min(...bounds)
  let max = Math.max(...bounds)
  if (min === max) {
    min -= 1
    max += 1
  }
  const y = (value: number) =>
    sparkPad + ((max - value) / (max - min)) * (sparkHeight - 2 * sparkPad)
  const x = (index: number) =>
    sparkPad +
    (points.length > 1
      ? (index / (points.length - 1)) * (sparkWidth - 2 * sparkPad)
      : (sparkWidth - 2 * sparkPad) / 2)
  const bandTop = range.high !== undefined ? y(range.high) : 0
  const bandBottom = range.low !== undefined ? y(range.low) : sparkHeight
  const hasBand = range.low !== undefined || range.high !== undefined
  return (
    <svg
      role="img"
      aria-label={label}
      data-slot="lab-sparkline"
      viewBox={`0 0 ${sparkWidth} ${sparkHeight}`}
      width={sparkWidth}
      height={sparkHeight}
      className={cn(
        "h-auto w-12 overflow-visible text-muted-foreground @xs:w-16 @sm:w-24",
        className
      )}
    >
      {hasBand && (
        <rect
          data-slot="lab-sparkline-range"
          x={0}
          y={bandTop}
          width={sparkWidth}
          height={Math.max(bandBottom - bandTop, 0)}
          className="fill-muted"
        />
      )}
      <polyline
        points={points.map((point, i) => `${x(i)},${y(point.value)}`).join(" ")}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {points.map((point, i) => {
        const outside = isAbnormal(labFlag(point.value, range))
        const last = i === points.length - 1
        if (!outside && !last) return null
        return (
          <circle
            key={`${point.date}-${i}`}
            cx={x(i)}
            cy={y(point.value)}
            r={last ? 2.75 : 2}
            className={cn(
              outside ? "fill-background stroke-foreground" : "fill-foreground",
              last && outside && "fill-foreground"
            )}
            strokeWidth={outside ? 1.5 : 0}
          />
        )
      })}
    </svg>
  )
}

export function LabResultsTable({
  results,
  caption,
  formatDate = defaultFormatDate,
  showTrend = true,
  className,
  ...props
}: LabResultsTableProps) {
  return (
    <div
      data-slot="lab-results"
      className={cn("@container w-full min-w-0", className)}
      {...props}
    >
      <Table>
        {caption && <TableCaption>{caption}</TableCaption>}
        <TableHeader>
          <TableRow>
            <TableHead scope="col">Test</TableHead>
            <TableHead scope="col">Result</TableHead>
            <TableHead scope="col" className="hidden @lg:table-cell">
              Reference range
            </TableHead>
            {showTrend && <TableHead scope="col">Trend</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {results.length === 0 && (
            <TableRow>
              <TableCell
                colSpan={showTrend ? 4 : 3}
                className="h-24 text-center text-muted-foreground"
              >
                No results.
              </TableCell>
            </TableRow>
          )}
          {results.map((result) => {
            const flag = resultFlag(result)
            const unit = result.unit ? ` ${result.unit}` : ""
            const range = formatReferenceRange(
              result.referenceRange,
              result.decimals
            )
            const rangeText = range
              ? `${range}${result.referenceRange?.text ? "" : unit}`
              : "Not given"
            const trend = showTrend ? describeTrend(result, formatDate) : null
            return (
              <TableRow key={result.id} data-flag={flag}>
                <TableHead
                  scope="row"
                  className="h-auto py-2 font-normal whitespace-normal"
                >
                  <span className="font-medium">{result.name}</span>
                  {result.date && (
                    <span className="block text-xs text-muted-foreground">
                      {formatDate(result.date)}
                    </span>
                  )}
                  <span className="block text-xs text-muted-foreground @lg:hidden">
                    Range: {rangeText}
                  </span>
                </TableHead>
                <TableCell className="whitespace-normal">
                  <span
                    className={cn(
                      "tabular-nums",
                      isAbnormal(flag) && "font-semibold"
                    )}
                  >
                    {formatValue(result.value, result.decimals)}
                    {unit && (
                      <span className="font-normal text-muted-foreground">
                        {unit}
                      </span>
                    )}
                  </span>
                  <LabFlagLabel flag={flag} className="flex" />
                </TableCell>
                <TableCell className="hidden text-muted-foreground tabular-nums @lg:table-cell">
                  {rangeText}
                </TableCell>
                {showTrend && (
                  <TableCell>
                    {trend ? (
                      <LabSparkline result={result} label={trend} />
                    ) : (
                      <>
                        <span aria-hidden className="text-muted-foreground">
                          —
                        </span>
                        <span className="sr-only">No earlier results</span>
                      </>
                    )}
                  </TableCell>
                )}
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
