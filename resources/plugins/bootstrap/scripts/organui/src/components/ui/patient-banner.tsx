import * as React from "react"
import { cn } from "cn"

import { Badge } from "@/components/ui/badge"
import { CircleHelpIcon, CheckIcon, TriangleAlertIcon, CircleAlertIcon } from "lucide-react"

export type PatientName = {
  /** The family name, shown in capitals. */
  family: string
  /** Given names, in order. */
  given?: readonly string[]
  /** A title such as "Mrs" or "Dr", shown in brackets after the name. */
  prefix?: string
}

export type PatientIdentifier = {
  /** What the number is, such as "NHS number" or "MRN". */
  label: string
  /** The number as it should read; `formatNhsNumber` spaces an NHS number. */
  value: string
}

export type Patient = {
  name: PatientName
  /** An ISO 8601 date. */
  birthDate: string
  /** As recorded, such as "Female". */
  sex?: string
  /** The patient's numbers, the primary one first. */
  identifiers?: readonly PatientIdentifier[]
  /** An ISO 8601 date. Shown in place of the age. */
  deceasedDate?: string
}

/**
 * Recorded allergies: each substance, `"none-known"` once "no known
 * allergies" has been recorded, or nothing (or an empty list) when they
 * have not been asked about. The banner shows the three differently,
 * because "not recorded" is not "none".
 */
export type PatientAllergies = readonly string[] | "none-known"

export type PatientBannerProps = React.ComponentProps<"section"> & {
  /** Name, date of birth, sex, identifiers and any date of death. */
  patient: Patient
  /** Substances, `"none-known"`, or nothing when not recorded. */
  allergies?: PatientAllergies
  /** Warnings to see before anything else, such as "DNACPR" or "Safeguarding". */
  alerts?: readonly string[]
  /** The day age is counted on. Defaults to today. */
  today?: Date
  /** Defaults to an unambiguous UTC date such as "12-Jan-1958". */
  formatDate?: (date: string) => string
}

const months = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
]

/**
 * A date as "12-Jan-1958", in UTC, the form the NHS patient banner uses:
 * day, month and year can't be mistaken for one another in any locale.
 */
export function formatBannerDate(date: string) {
  const time = Date.parse(date)
  if (Number.isNaN(time)) return date
  const day = new Date(time)
  return `${String(day.getUTCDate()).padStart(2, "0")}-${
    months[day.getUTCMonth()]
  }-${day.getUTCFullYear()}`
}

/** "SMITH, Jane Anne (Mrs)": the family name first and in capitals. */
export function formatPatientName({ family, given = [], prefix }: PatientName) {
  const first = given.length ? `, ${given.join(" ")}` : ""
  return `${family.toUpperCase()}${first}${prefix ? ` (${prefix})` : ""}`
}

/**
 * Age as a banner shows it: days under four weeks, months under two years,
 * then completed years.
 */
export function formatPatientAge(birthDate: string, on: Date) {
  const birth = new Date(Date.parse(birthDate))
  const days = Math.floor((on.getTime() - birth.getTime()) / 86_400_000)
  if (Number.isNaN(days) || days < 0) return null
  if (days < 28) return days === 1 ? "1 day" : `${days} days`
  let months =
    (on.getUTCFullYear() - birth.getUTCFullYear()) * 12 +
    on.getUTCMonth() -
    birth.getUTCMonth()
  if (on.getUTCDate() < birth.getUTCDate()) months--
  if (months < 24) return months === 1 ? "1 month" : `${months} months`
  return `${Math.floor(months / 12)} years`
}

/** Checks an NHS number's length and modulus 11 check digit. */
export function isValidNhsNumber(value: string) {
  const digits = value.replace(/\s/g, "")
  if (!/^\d{10}$/.test(digits)) return false
  const sum = [...digits.slice(0, 9)].reduce(
    (total, digit, i) => total + Number(digit) * (10 - i),
    0
  )
  const check = 11 - (sum % 11)
  if (check === 10) return false
  return (check === 11 ? 0 : check) === Number(digits[9])
}

/** Spaces an NHS number 3-3-4, as "943 476 5919", so it is read in groups. */
export function formatNhsNumber(value: string) {
  const digits = value.replace(/\s/g, "")
  return /^\d{10}$/.test(digits)
    ? `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`
    : value
}

function Field({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex items-baseline gap-1.5">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium tabular-nums">{children}</dd>
    </div>
  )
}

function Allergies({ allergies }: { allergies?: PatientAllergies }) {
  if (allergies === undefined || allergies.length === 0)
    return (
      <span
        data-slot="patient-allergies"
        data-state="not-recorded"
        className="inline-flex items-center gap-1.5 text-muted-foreground"
      >
        <CircleHelpIcon aria-hidden="true" className="size-4 shrink-0" />
        Allergies not recorded
      </span>
    )
  if (allergies === "none-known")
    return (
      <span
        data-slot="patient-allergies"
        data-state="none-known"
        className="inline-flex items-center gap-1.5"
      >
        <CheckIcon aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
        No known allergies
      </span>
    )
  return (
    <span
      data-slot="patient-allergies"
      data-state="recorded"
      className="inline-flex items-start gap-1.5 font-semibold"
    >
      <TriangleAlertIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
      <span>
        Allergies: <span className="font-normal">{allergies.join(", ")}</span>
      </span>
    </span>
  )
}

export function PatientBanner({
  patient,
  allergies,
  alerts = [],
  today,
  formatDate = formatBannerDate,
  className,
  ...props
}: PatientBannerProps) {
  const name = formatPatientName(patient.name)
  const age = patient.deceasedDate
    ? null
    : formatPatientAge(patient.birthDate, today ?? new Date())
  return (
    <section
      data-slot="patient-banner"
      aria-label={`Patient: ${name}`}
      className={cn(
        "@container flex w-full min-w-0 flex-col gap-2 rounded-lg border bg-card px-4 py-3 text-sm text-card-foreground",
        className
      )}
      {...props}
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <h2 className="text-base font-semibold tracking-tight">{name}</h2>
        {patient.deceasedDate && (
          <Badge variant="secondary">
            Died {formatDate(patient.deceasedDate)}
          </Badge>
        )}
        {alerts.map((alert) => (
          <Badge key={alert} variant="outline" data-slot="patient-alert">
            <CircleAlertIcon aria-hidden="true" data-icon="inline-start" />
            {alert}
          </Badge>
        ))}
      </div>
      <dl className="flex flex-wrap gap-x-5 gap-y-1">
        <Field label="Born">
          {formatDate(patient.birthDate)}
          {age && (
            <span className="font-normal text-muted-foreground"> ({age})</span>
          )}
        </Field>
        {patient.sex && <Field label="Sex">{patient.sex}</Field>}
        {patient.identifiers?.map((identifier) => (
          <Field key={identifier.label} label={identifier.label}>
            {identifier.value}
          </Field>
        ))}
      </dl>
      <Allergies allergies={allergies} />
    </section>
  )
}
