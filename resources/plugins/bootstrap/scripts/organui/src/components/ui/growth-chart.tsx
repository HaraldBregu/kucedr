import * as React from "react"
import { cn } from "cn"

import { Empty, EmptyDescription, EmptyHeader } from "@/components/ui/empty"
import { ageInMonths, formatAge } from "@/lib/age"
import {
  formatPercentile,
  lmsValue,
  lmsZScore,
  percentileToZ,
  zToPercentile,
  type Lms,
} from "@/lib/z-scores"

export {
  ageInMonths,
  formatAge,
  formatPercentile,
  percentileToZ,
  zToPercentile,
}

export type GrowthMeasure = "weight" | "length" | "head"
export type GrowthSex = "female" | "male"
/** LMS parameters: Box-Cox power, median and coefficient of variation. */
export type GrowthLms = Lms
/** LMS parameters by completed month, starting at `start` months. */
export type GrowthTable = { start: number; lms: readonly GrowthLms[] }
export type GrowthStandard = Readonly<Record<GrowthSex, GrowthTable>>
/**
 * The reference tables the chart draws. You supply and license them: see the
 * docs for where to get WHO or CDC tables. `length` is recumbent
 * length, used below 24 months; `height` is standing height, used from 24.
 */
export type GrowthStandards = Readonly<{
  weight?: GrowthStandard
  length?: GrowthStandard
  height?: GrowthStandard
  head?: GrowthStandard
}>
export type GrowthMeasurement = {
  /** Age in months. Use `ageInMonths` to convert dates. */
  ageMonths: number
  /** Kilograms for weight, centimetres for length and head circumference. */
  value: number
}
export type GrowthChartProps = React.ComponentProps<"figure"> & {
  /** The LMS reference tables you supply, such as WHO's. */
  standards: GrowthStandards
  /** weight, length (length or height) or head circumference. */
  measure: GrowthMeasure
  /** female or male; the standards differ by sex. */
  sex: GrowthSex
  /** The child's measurements, by age in months. */
  measurements?: readonly GrowthMeasurement[]
  /** Percentile curves to draw, between 0 and 100. Defaults to WHO's set. */
  percentiles?: readonly number[]
  /** Age range shown, in months. Defaults to 0 to 24. */
  ageRange?: readonly [number, number]
  /** The accessible name of the chart. */
  label?: string
}

export const growthMeasures: Record<
  GrowthMeasure,
  { label: string; unit: string }
> = {
  weight: { label: "Weight-for-age", unit: "kg" },
  length: { label: "Length/height-for-age", unit: "cm" },
  head: { label: "Head circumference-for-age", unit: "cm" },
}
const defaultPercentiles = [3, 15, 50, 85, 97]
const daysPerMonth = 30.4375

function table(
  standards: GrowthStandards,
  measure: GrowthMeasure,
  ageMonths: number
) {
  if (measure !== "length") return standards[measure]
  // Length is measured lying down before 24 months and height standing from
  // 24, so WHO's curve steps down there by about 0.7 cm.
  return ageMonths < 24
    ? (standards.length ?? standards.height)
    : (standards.height ?? standards.length)
}

/**
 * The LMS parameters at an age in months, interpolated linearly between
 * months. Returns null where the standards have no table or row for it.
 */
export function growthLms(
  standards: GrowthStandards,
  measure: GrowthMeasure,
  sex: GrowthSex,
  ageMonths: number
): GrowthLms | null {
  const found = table(standards, measure, ageMonths)?.[sex]
  if (!found || found.lms.length < 2) return null
  const position = ageMonths - found.start
  if (!(position >= 0 && position <= found.lms.length - 1)) return null
  const lower = Math.min(Math.floor(position), found.lms.length - 2)
  const t = position - lower
  const a = found.lms[lower]!
  const b = found.lms[lower + 1]!
  return [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t,
  ]
}

/**
 * The z-score of a measurement. Weight beyond ±3 SD uses WHO's restricted
 * extrapolation, which keeps the skewed tail from compressing extreme values.
 * Returns null where the standards do not cover the age, or for a
 * non-positive value.
 */
export function growthZScore(
  standards: GrowthStandards,
  measure: GrowthMeasure,
  sex: GrowthSex,
  ageMonths: number,
  value: number
) {
  const lms = growthLms(standards, measure, sex, ageMonths)
  if (!lms) return null
  return lmsZScore(value, lms, { restricted: measure === "weight" })
}

/** The measurement at a percentile and age, or null where not covered. */
export function growthValueAt(
  standards: GrowthStandards,
  measure: GrowthMeasure,
  sex: GrowthSex,
  ageMonths: number,
  percentile: number
) {
  const lms = growthLms(standards, measure, sex, ageMonths)
  return lms ? lmsValue(lms, percentileToZ(percentile)) : null
}

type AnthroRow = { sex: GrowthSex; age: number; loh: string; lms: GrowthLms }

function anthroRows(text: string): AnthroRow[] {
  const [header = "", ...lines] = text.trim().split(/\r?\n/)
  const columns = header.split("\t")
  const at = (cells: string[], name: string) => cells[columns.indexOf(name)]
  return lines.map((line) => {
    const cells = line.split("\t")
    return {
      sex: at(cells, "sex") === "2" ? "female" : "male",
      age: Number(at(cells, "age")),
      loh: at(cells, "loh") ?? "",
      lms: [
        Number(at(cells, "l")),
        Number(at(cells, "m")),
        Number(at(cells, "s")),
      ],
    }
  })
}

// Samples daily rows at each month (30.4375 days), as WHO's monthly tables
// do, extrapolating from the nearest two days at the ends of a segment.
function monthly(rows: AnthroRow[], sex: GrowthSex, from: number): GrowthTable {
  const byAge = new Map<number, GrowthLms>()
  for (const row of rows) if (row.sex === sex) byAge.set(row.age, row.lms)
  const ages = [...byAge.keys()]
  const first = Math.min(...ages)
  const last = Math.max(...ages)
  const lms: GrowthLms[] = []
  // Month 24 falls half a day past the last length row.
  for (let month = from; month * daysPerMonth <= last + 0.5; month++) {
    const day = month * daysPerMonth
    const lower = Math.min(Math.max(Math.floor(day), first), last - 1)
    const a = byAge.get(lower)
    const b = byAge.get(lower + 1)
    if (!a || !b) break
    const t = day - lower
    lms.push([
      a[0] + (b[0] - a[0]) * t,
      a[1] + (b[1] - a[1]) * t,
      a[2] + (b[2] - a[2]) * t,
    ])
  }
  return { start: from, lms }
}

function standard(rows: AnthroRow[], from = 0): GrowthStandard | undefined {
  if (!rows.length) return undefined
  return {
    female: monthly(rows, "female", from),
    male: monthly(rows, "male", from),
  }
}

/**
 * Builds monthly standards from tables you supply in the layout of WHO's anthro
 * package: tab-separated sex (1 male, 2 female), age in days, l, m, s and, for
 * length, loh. The length table splits into `length` (rows marked L) and
 * `height` (rows marked H, from 24 months). No tables ship with this file.
 */
export function growthStandardsFromAnthro(tables: {
  weight?: string
  length?: string
  head?: string
}): GrowthStandards {
  const length = tables.length ? anthroRows(tables.length) : []
  return {
    weight: tables.weight ? standard(anthroRows(tables.weight)) : undefined,
    length: standard(length.filter(({ loh }) => loh === "L")),
    height: standard(
      length.filter(({ loh }) => loh === "H"),
      24
    ),
    head: tables.head ? standard(anthroRows(tables.head)) : undefined,
  }
}

const number = new Intl.NumberFormat("en", { maximumFractionDigits: 2 })
const formatZ = (z: number) => `${z >= 0 ? "+" : "−"}${Math.abs(z).toFixed(2)}`

function niceStep(span: number, count: number) {
  const raw = span / count
  const power = 10 ** Math.floor(Math.log10(raw))
  const step = [1, 2, 5, 10].find((f) => f * power >= raw)!
  return step * power
}

function useWidth(fallback: number) {
  const ref = React.useRef<HTMLDivElement>(null)
  const [width, setWidth] = React.useState(fallback)
  React.useLayoutEffect(() => {
    const element = ref.current
    if (!element) return
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setWidth(Math.round(entry.contentRect.width))
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [])
  return [ref, width] as const
}

const margin = { top: 12, right: 40, bottom: 40, left: 44 }

export function GrowthChart({
  standards,
  measure,
  sex,
  measurements = [],
  percentiles = defaultPercentiles,
  ageRange = [0, 24],
  label,
  className,
  ...props
}: GrowthChartProps) {
  const id = React.useId()
  const [ref, width] = useWidth(640)
  const [active, setActive] = React.useState<number | null>(null)
  const { unit } = growthMeasures[measure]
  const title =
    label ??
    `${growthMeasures[measure].label}, ${sex === "female" ? "girls" : "boys"}`
  const from = Math.max(0, ageRange[0])
  const to = Math.max(from + 1, ageRange[1])
  const height = Math.round(Math.min(Math.max(width * 0.62, 260), 420))
  const plotWidth = Math.max(width - margin.left - margin.right, 1)
  const plotHeight = height - margin.top - margin.bottom
  const sorted = [...percentiles]
    .filter((p) => p > 0 && p < 100)
    .sort((a, b) => a - b)

  // Length switches to height at 24 months, so each curve has a segment on
  // either side of it.
  const segments: [number, number][] =
    measure !== "length" || from >= 24
      ? [[from, to]]
      : to > 24
        ? [
            [from, 24 - 1e-9],
            [24, to],
          ]
        : // A range ending by 24 months stays on the length standard.
          [[from, Math.min(to, 24 - 1e-9)]]
  const samples = segments.map(([start, end]) => {
    const ages = [start]
    for (let age = Math.floor(start) + 1; age < end; age++) ages.push(age)
    ages.push(end)
    return ages
  })
  const curves = sorted.map((percentile) =>
    samples
      .map((ages) =>
        ages.flatMap((age) => {
          const value = growthValueAt(standards, measure, sex, age, percentile)
          return value === null ? [] : [{ age, value }]
        })
      )
      .filter((line) => line.length > 1)
  )
  const inRange = measurements.filter(
    ({ ageMonths }) => ageMonths >= from && ageMonths <= to
  )
  const points = inRange
    .map((measurement, index) => ({
      ...measurement,
      index,
      z: growthZScore(
        standards,
        measure,
        sex,
        measurement.ageMonths,
        measurement.value
      ),
    }))
    .filter(({ z }) => z !== null)
    .sort((a, b) => a.ageMonths - b.ageMonths)
  // Measurements in view that the standard has no reference for.
  const uncovered = inRange.length - points.length

  const values = [
    ...curves.flat(2).map(({ value }) => value),
    ...points.map(({ value }) => value),
  ]
  const low = Math.min(...values)
  const high = Math.max(...values)
  const step = niceStep(high - low, Math.max(3, Math.round(plotHeight / 48)))
  const yMin = Math.floor((low - (high - low) * 0.04) / step) * step
  const yMax = Math.ceil((high + (high - low) * 0.04) / step) * step
  const x = (age: number) =>
    margin.left + ((age - from) / (to - from)) * plotWidth
  const y = (value: number) =>
    margin.top + (1 - (value - yMin) / (yMax - yMin)) * plotHeight
  // Months read best in steps that divide a year.
  const xRaw = (to - from) / Math.max(2, Math.round(plotWidth / 56))
  const xStep = [1, 2, 3, 6, 12].find((step) => step >= xRaw) ?? 12
  const xTicks: number[] = []
  for (let age = Math.ceil(from / xStep) * xStep; age <= to; age += xStep)
    xTicks.push(age)
  const yTicks: number[] = []
  for (let value = yMin; value <= yMax + step / 2; value += step)
    yTicks.push(Number(value.toFixed(6)))
  const path = (line: { age: number; value: number }[]) =>
    line
      .map(
        ({ age, value }, i) =>
          `${i ? "L" : "M"}${x(age).toFixed(1)},${y(value).toFixed(1)}`
      )
      .join("")
  // Bands pair the outermost curves inwards, such as 3rd–97th and 15th–85th.
  const bands = sorted.slice(0, Math.floor(sorted.length / 2)).map((_, i) =>
    curves[i]!.map((lower, segment) => {
      const upper = curves[sorted.length - 1 - i]![segment]
      if (!upper) return ""
      return `${path(lower)}${path([...upper].reverse()).replace("M", "L")}Z`
    })
  )
  const describe = (point: (typeof points)[number]) =>
    `${formatAge(point.ageMonths)}: ${number.format(point.value)} ${unit}, ${formatPercentile(zToPercentile(point.z!))} percentile`
  const current = points.find(({ index }) => index === active)
  // Without curves there is nothing to read measurements against.
  if (!curves[0]?.length)
    return (
      <figure
        data-slot="growth-chart"
        className={cn("flex flex-col gap-3", className)}
        {...props}
      >
        <figcaption className="text-sm font-medium">{title}</figcaption>
        <Empty className="border">
          <EmptyHeader>
            <EmptyDescription>
              No growth standard covers this measure and age range.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      </figure>
    )

  return (
    <figure
      data-slot="growth-chart"
      className={cn("flex flex-col gap-3", className)}
      {...props}
    >
      <figcaption id={`${id}-title`} className="text-sm font-medium">
        {title}
      </figcaption>
      <div ref={ref} className="relative w-full">
        <svg
          role="group"
          aria-labelledby={`${id}-title`}
          aria-describedby={`${id}-description`}
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          className="block h-auto max-w-full overflow-visible text-[11px] select-none"
          onPointerLeave={() => setActive(null)}
        >
          <desc id={`${id}-description`}>
            Percentile curves from {formatAge(from)} to {formatAge(to)} with{" "}
            {points.length}{" "}
            {points.length === 1 ? "measurement" : "measurements"}. The table
            after the chart lists each one.
          </desc>
          <g aria-hidden="true">
            {yTicks.map((value) => (
              <g key={value}>
                <line
                  x1={margin.left}
                  x2={margin.left + plotWidth}
                  y1={y(value)}
                  y2={y(value)}
                  className="stroke-border"
                />
                <text
                  x={margin.left - 8}
                  y={y(value)}
                  dy="0.32em"
                  textAnchor="end"
                  className="fill-muted-foreground tabular-nums"
                >
                  {number.format(value)}
                </text>
              </g>
            ))}
            {xTicks.map((age) => (
              <g key={age}>
                <line
                  x1={x(age)}
                  x2={x(age)}
                  y1={margin.top}
                  y2={margin.top + plotHeight}
                  className="stroke-border opacity-60"
                />
                <text
                  x={x(age)}
                  y={margin.top + plotHeight + 16}
                  textAnchor="middle"
                  className="fill-muted-foreground tabular-nums"
                >
                  {age}
                </text>
              </g>
            ))}
            <text
              x={margin.left + plotWidth / 2}
              y={height - 4}
              textAnchor="middle"
              className="fill-muted-foreground"
            >
              Age (months)
            </text>
            <text
              transform={`translate(10 ${margin.top + plotHeight / 2}) rotate(-90)`}
              textAnchor="middle"
              className="fill-muted-foreground"
            >
              {unit}
            </text>
            {bands.flat().map((d, i) => (
              <path key={i} d={d} className="fill-primary opacity-[0.07]" />
            ))}
            {curves.map((curve, i) =>
              curve.map((line, segment) => (
                <path
                  key={`${i}-${segment}`}
                  d={path(line)}
                  fill="none"
                  strokeWidth={sorted[i] === 50 ? 1.75 : 1}
                  className="stroke-muted-foreground"
                />
              ))
            )}
            {curves.map((curve, i) => {
              const end = curve.at(-1)!.at(-1)!
              return (
                <text
                  key={sorted[i]}
                  x={margin.left + plotWidth + 6}
                  y={y(end.value)}
                  dy="0.32em"
                  className="fill-muted-foreground tabular-nums"
                >
                  {formatPercentile(sorted[i]!)}
                </text>
              )
            })}
            {points.length > 1 && (
              <path
                d={path(
                  points.map(({ ageMonths, value }) => ({
                    age: ageMonths,
                    value,
                  }))
                )}
                fill="none"
                strokeWidth={2}
                className="stroke-primary"
              />
            )}
            {current && (
              <line
                x1={x(current.ageMonths)}
                x2={x(current.ageMonths)}
                y1={margin.top}
                y2={margin.top + plotHeight}
                className="stroke-primary opacity-40"
                strokeDasharray="3 3"
              />
            )}
          </g>
          {points.map((point) => (
            <circle
              key={point.index}
              cx={x(point.ageMonths)}
              cy={y(point.value)}
              r={active === point.index ? 6 : 4.5}
              tabIndex={0}
              role="img"
              aria-label={describe(point)}
              strokeWidth={2}
              className="cursor-default fill-primary stroke-background outline-none focus-visible:stroke-ring focus-visible:stroke-[3]"
              onPointerEnter={() => setActive(point.index)}
              onFocus={() => setActive(point.index)}
              onBlur={() => setActive(null)}
            />
          ))}
        </svg>
        {current && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute z-10 w-max -translate-x-1/2 -translate-y-full rounded-md border bg-popover px-2.5 py-1.5 text-xs text-popover-foreground shadow-md"
            style={{
              left: Math.min(
                Math.max(x(current.ageMonths), 80),
                Math.max(width - 80, 80)
              ),
              top: y(current.value) - 10,
            }}
          >
            <p className="font-medium">
              {number.format(current.value)} {unit}
            </p>
            <p className="text-muted-foreground">
              {formatAge(current.ageMonths)} ·{" "}
              {formatPercentile(zToPercentile(current.z!))} percentile
            </p>
            <p className="text-muted-foreground">
              z-score {formatZ(current.z!)}
            </p>
          </div>
        )}
      </div>
      {uncovered > 0 && (
        <p className="text-xs text-muted-foreground">
          {uncovered} {uncovered === 1 ? "measurement is" : "measurements are"}{" "}
          not plotted: the standard has no reference at{" "}
          {uncovered === 1 ? "that age" : "those ages"}.
        </p>
      )}
      <table className="sr-only">
        <caption>{title}: measurements</caption>
        <thead>
          <tr>
            <th scope="col">Age</th>
            <th scope="col">Value ({unit})</th>
            <th scope="col">Percentile</th>
            <th scope="col">Z-score</th>
          </tr>
        </thead>
        <tbody>
          {points.map((point) => (
            <tr key={point.index}>
              <td>{formatAge(point.ageMonths)}</td>
              <td>{number.format(point.value)}</td>
              <td>{formatPercentile(zToPercentile(point.z!))}</td>
              <td>{formatZ(point.z!)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  )
}
