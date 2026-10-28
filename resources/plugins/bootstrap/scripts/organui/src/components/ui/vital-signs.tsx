import * as React from "react"
import { cn } from "cn"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { CheckIcon, ArrowUpIcon, ArrowDownIcon, MinusIcon } from "lucide-react"

/** Inclusive bounds of the normal range. */
export type VitalRange = { low: number; high: number }
export type VitalRanges = {
  /** Beats per minute. */
  heartRate: VitalRange
  /** mmHg. */
  systolic: VitalRange
  /** mmHg. */
  diastolic: VitalRange
  /** Percent. */
  spo2: VitalRange
  /** In the panel's temperature unit. */
  temperature: VitalRange
  /** Breaths per minute. */
  respiratoryRate: VitalRange
}
export type VitalReadings = {
  heartRate?: number | null
  systolic?: number | null
  diastolic?: number | null
  spo2?: number | null
  temperature?: number | null
  respiratoryRate?: number | null
}
export type VitalSign =
  "heartRate" | "bloodPressure" | "spo2" | "temperature" | "respiratoryRate"
export type VitalStatus = "low" | "normal" | "high" | "missing"
export type TemperatureUnit = "celsius" | "fahrenheit"
export type VitalSignsProps = Omit<React.ComponentProps<"div">, "title"> & {
  /** The latest value of each vital; null when not measured. */
  readings: VitalReadings
  /** Merged over `adultVitalRanges`, one vital at a time. */
  ranges?: Partial<VitalRanges>
  /** Which vitals to show, in order. */
  vitals?: readonly VitalSign[]
  /** The unit of `readings.temperature` and `ranges.temperature`. */
  temperatureUnit?: TemperatureUnit
  /** Used to format numbers. */
  locale?: string
  /** The heading above the readings. */
  title?: string
  /** Shown under the title, such as when the readings were taken. */
  description?: React.ReactNode
}

/**
 * Common resting adult ranges, as a starting point rather than clinical
 * guidance. Temperature is in degrees Celsius.
 */
export const adultVitalRanges: VitalRanges = {
  heartRate: { low: 60, high: 100 },
  systolic: { low: 90, high: 120 },
  diastolic: { low: 60, high: 80 },
  spo2: { low: 95, high: 100 },
  temperature: { low: 36.1, high: 37.2 },
  respiratoryRate: { low: 12, high: 20 },
}
export const defaultVitals: readonly VitalSign[] = [
  "heartRate",
  "bloodPressure",
  "spo2",
  "temperature",
]

export function vitalStatus(
  value: number | null | undefined,
  range: VitalRange
): VitalStatus {
  if (value == null || !Number.isFinite(value)) return "missing"
  if (value < range.low) return "low"
  if (value > range.high) return "high"
  return "normal"
}

/** High wins over low, so a reading that is both reads as high. */
export function bloodPressureStatus(
  systolic: VitalStatus,
  diastolic: VitalStatus
): VitalStatus {
  if (systolic === "missing" || diastolic === "missing") return "missing"
  if (systolic === "high" || diastolic === "high") return "high"
  if (systolic === "low" || diastolic === "low") return "low"
  return "normal"
}

function celsiusToFahrenheit({ low, high }: VitalRange): VitalRange {
  const convert = (value: number) =>
    Math.round(((value * 9) / 5 + 32) * 10) / 10
  return { low: convert(low), high: convert(high) }
}

/**
 * Resolves the ranges a panel uses: defaults converted to the temperature
 * unit, then any overrides as given.
 */
export function resolveVitalRanges(
  ranges: Partial<VitalRanges> = {},
  temperatureUnit: TemperatureUnit = "celsius"
): VitalRanges {
  const defaults =
    temperatureUnit === "fahrenheit"
      ? {
          ...adultVitalRanges,
          temperature: celsiusToFahrenheit(adultVitalRanges.temperature),
        }
      : adultVitalRanges
  return { ...defaults, ...ranges }
}

export type VitalAssessment = {
  vital: VitalSign
  label: string
  unit: string
  /** Formatted value, or null without a reading. */
  value: string | null
  /** Formatted normal range. */
  range: string
  status: VitalStatus
  /** Status as text, which never relies on colour. */
  statusLabel: string
}

const statusLabels: Record<VitalStatus, string> = {
  low: "Low",
  normal: "Normal",
  high: "High",
  missing: "No reading",
}

export function assessVital(
  vital: VitalSign,
  readings: VitalReadings,
  ranges: VitalRanges,
  temperatureUnit: TemperatureUnit = "celsius",
  locale = "en-US"
): VitalAssessment {
  const format = (value: number, digits = 0) =>
    value.toLocaleString(locale, {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    })
  const span = ({ low, high }: VitalRange, digits = 0) =>
    `${format(low, digits)}–${format(high, digits)}`
  if (vital === "bloodPressure") {
    const systolic = vitalStatus(readings.systolic, ranges.systolic)
    const diastolic = vitalStatus(readings.diastolic, ranges.diastolic)
    const status = bloodPressureStatus(systolic, diastolic)
    // Name the out-of-range part when only one is, or when they disagree.
    const parts = [
      systolic !== "normal" ? `${systolic} systolic` : null,
      diastolic !== "normal" ? `${diastolic} diastolic` : null,
    ].filter((part) => part !== null)
    const detail =
      status === "missing" || status === "normal" || systolic === diastolic
        ? statusLabels[status]
        : parts.join(", ").replace(/^./, (letter) => letter.toUpperCase())
    return {
      vital,
      label: "Blood pressure",
      unit: "mmHg",
      value:
        status === "missing"
          ? null
          : `${format(readings.systolic!)}/${format(readings.diastolic!)}`,
      range: `${span(ranges.systolic)} / ${span(ranges.diastolic)}`,
      status,
      statusLabel: detail,
    }
  }
  const meta = {
    heartRate: { label: "Heart rate", unit: "bpm", digits: 0 },
    spo2: { label: "SpO₂", unit: "%", digits: 0 },
    temperature: {
      label: "Temperature",
      unit: temperatureUnit === "fahrenheit" ? "°F" : "°C",
      digits: 1,
    },
    respiratoryRate: { label: "Respiratory rate", unit: "/min", digits: 0 },
  }[vital]
  const value = readings[vital]
  const status = vitalStatus(value, ranges[vital])
  return {
    vital,
    label: meta.label,
    unit: meta.unit,
    value: status === "missing" ? null : format(value!, meta.digits),
    range: span(ranges[vital], meta.digits),
    status,
    statusLabel: statusLabels[status],
  }
}

// Each status has its own shape, so it reads without colour as well as with
// the text beside it.
function StatusIcon({
  status,
  className,
}: {
  status: VitalStatus
  className?: string
}) {
  switch (status) {
    case "normal":
      return (
        <CheckIcon aria-hidden="true" className={cn("size-3.5 shrink-0", className)} />
      )
    case "high":
      return (
        <ArrowUpIcon aria-hidden="true" className={cn("size-3.5 shrink-0", className)} />
      )
    case "low":
      return (
        <ArrowDownIcon aria-hidden="true" className={cn("size-3.5 shrink-0", className)} />
      )
    case "missing":
      return (
        <MinusIcon aria-hidden="true" className={cn("size-3.5 shrink-0", className)} />
      )
  }
}

export function VitalSigns({
  readings,
  ranges,
  vitals = defaultVitals,
  temperatureUnit = "celsius",
  locale = "en-US",
  title = "Vital signs",
  description,
  className,
  ...props
}: VitalSignsProps) {
  const resolved = resolveVitalRanges(ranges, temperatureUnit)
  const heading = React.useId()
  return (
    <Card
      data-slot="vital-signs"
      role="region"
      aria-labelledby={heading}
      className={cn("w-full", className)}
      {...props}
    >
      <CardHeader>
        <CardTitle id={heading}>{title}</CardTitle>
        {description != null && (
          <CardDescription>{description}</CardDescription>
        )}
      </CardHeader>
      <CardContent className="@container">
        {/* Two columns, or one row once every vital fits, so none is left
            alone on a row. */}
        <dl className="grid grid-cols-2 gap-3 @2xl:auto-cols-fr @2xl:grid-flow-col @2xl:grid-cols-none">
          {vitals.map((vital) => {
            const item = assessVital(
              vital,
              readings,
              resolved,
              temperatureUnit,
              locale
            )
            const abnormal = item.status === "low" || item.status === "high"
            return (
              <div
                key={vital}
                data-vital={vital}
                data-status={item.status}
                className="flex min-w-0 flex-col gap-1.5 rounded-lg border p-3"
              >
                <dt className="text-xs font-medium text-muted-foreground">
                  {item.label}
                </dt>
                <dd className="flex items-baseline gap-1">
                  {item.value === null ? (
                    <span
                      aria-hidden="true"
                      className="text-2xl font-semibold text-muted-foreground"
                    >
                      —
                    </span>
                  ) : (
                    <>
                      <span className="text-2xl font-semibold tabular-nums">
                        {item.value}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {item.unit}
                      </span>
                    </>
                  )}
                </dd>
                <dd
                  className={cn(
                    "flex items-center gap-1 text-xs",
                    abnormal
                      ? "font-semibold text-foreground"
                      : "font-medium text-muted-foreground"
                  )}
                >
                  <StatusIcon status={item.status} />
                  {item.statusLabel}
                </dd>
                <dd className="text-xs text-muted-foreground tabular-nums">
                  Normal {item.range} {item.unit}
                </dd>
              </div>
            )
          })}
        </dl>
      </CardContent>
    </Card>
  )
}
