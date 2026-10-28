"use client"

import * as React from "react"
import { cn } from "cn"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Empty, EmptyDescription, EmptyHeader } from "@/components/ui/empty"
import { TriangleAlertIcon, CircleAlertIcon, InfoIcon, ChevronLeftIcon, ChevronRightIcon } from "lucide-react"

export type Medication = {
  id: string
  name: string
  /** Shown after the name, such as "500 mg". */
  dose?: string
  /** Shown under the name, such as "With food". */
  instructions?: string
  /** Local 24-hour dosing times, "HH:MM". */
  times: readonly string[]
  /** Weekdays to dose on, 0 for Sunday to 6 for Saturday. Defaults to all. */
  days?: readonly number[]
  /** First dosing date, "YYYY-MM-DD", inclusive. */
  start?: string
  /** Last dosing date, "YYYY-MM-DD", inclusive. */
  end?: string
  /** A CSS color for the medication's swatch and timeline markers. */
  color?: string
}
export type InteractionSeverity = "minor" | "moderate" | "major"
export type MedicationInteraction = {
  id: string
  /** Two or more medication IDs. Shown when all of them dose that day. */
  medicationIds: readonly string[]
  severity: InteractionSeverity
  summary: string
  /** Doses of these medications closer than this many hours are flagged. */
  separationHours?: number
}
export type DoseStatus = "taken" | "skipped"
export type ScheduledDose = {
  /** `${medication.id}@${date}T${time}`, the key used in dose status. */
  key: string
  medication: Medication
  date: string
  time: string
  minutes: number
}
export type DoseConflict = {
  interaction: MedicationInteraction
  doses: readonly [ScheduledDose, ScheduledDose]
}
export type MedicationScheduleProps = React.ComponentProps<"div"> & {
  /** The medications, each with its dose times and days. */
  medications: readonly Medication[]
  /** Interactions come from your own data source; none are bundled. */
  interactions?: readonly MedicationInteraction[]
  /** The day shown, "YYYY-MM-DD". */
  date: string
  /** Shows previous and next day buttons when set. */
  onDateChange?: (date: string) => void
  /** Missing doses are still to take. */
  doseStatus?: Readonly<Record<string, DoseStatus>>
  /** Makes each dose's status a button that cycles to take, taken, skipped. */
  onDoseStatusChange?: (doseStatus: Record<string, DoseStatus>) => void
  /** The current local time, "HH:MM", drawn as a marker on the timeline. */
  now?: string
  /** Used to format the date heading. Defaults to "en-US". */
  locale?: string
  /** The accessible name of the schedule. */
  label?: string
  /** Shown under the schedule. Pass null to hide it. */
  disclaimer?: React.ReactNode
}

const day = 24 * 60
const severityOrder: Record<InteractionSeverity, number> = {
  major: 0,
  moderate: 1,
  minor: 2,
}
const severityLabel: Record<InteractionSeverity, string> = {
  major: "Major",
  moderate: "Moderate",
  minor: "Minor",
}
const statusLabel = { todo: "To take", taken: "Taken", skipped: "Skipped" }

export function parseTime(time: string): number {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(time)
  if (!match) throw new Error(`Dose times must be "HH:MM": found "${time}"`)
  return Number(match[1]) * 60 + Number(match[2])
}

function parseDate(date: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date)
  const parsed = match
    ? new Date(Date.UTC(+match[1]!, +match[2]! - 1, +match[3]!))
    : null
  if (!parsed || parsed.toISOString().slice(0, 10) !== date)
    throw new Error(`Dates must be "YYYY-MM-DD": found "${date}"`)
  return parsed
}

export function addDays(date: string, days: number): string {
  const parsed = parseDate(date)
  parsed.setUTCDate(parsed.getUTCDate() + days)
  return parsed.toISOString().slice(0, 10)
}

export function medicationIndex(
  medications: readonly Medication[]
): Map<string, Medication> {
  const index = new Map<string, Medication>()
  for (const medication of medications) {
    if (!medication.id || index.has(medication.id))
      throw new Error(
        `Medication IDs must be nonempty and unique: found "${medication.id}"`
      )
    medication.times.forEach(parseTime)
    if (medication.start) parseDate(medication.start)
    if (medication.end) parseDate(medication.end)
    index.set(medication.id, medication)
  }
  return index
}

/** The doses due on a date, in time order. */
export function dosesOn(
  medications: readonly Medication[],
  date: string
): ScheduledDose[] {
  medicationIndex(medications)
  const weekday = parseDate(date).getUTCDay()
  return medications
    .filter(
      ({ days, start, end }) =>
        (!days || days.includes(weekday)) &&
        (!start || start <= date) &&
        (!end || date <= end)
    )
    .flatMap((medication) =>
      [...new Set(medication.times)].map((time) => ({
        key: `${medication.id}@${date}T${time}`,
        medication,
        date,
        time,
        minutes: parseTime(time),
      }))
    )
    .sort(
      (a, b) =>
        a.minutes - b.minutes ||
        a.medication.name.localeCompare(b.medication.name)
    )
}

/** Interactions whose medications all dose on the day, most severe first. */
export function activeInteractions(
  doses: readonly ScheduledDose[],
  interactions: readonly MedicationInteraction[]
): MedicationInteraction[] {
  const scheduled = new Set(doses.map(({ medication }) => medication.id))
  return interactions
    .filter(
      ({ medicationIds }) =>
        new Set(medicationIds).size >= 2 &&
        medicationIds.every((id) => scheduled.has(id))
    )
    .sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity])
}

/** Pairs of same-day doses closer than an interaction's separation. */
export function doseConflicts(
  doses: readonly ScheduledDose[],
  interactions: readonly MedicationInteraction[]
): DoseConflict[] {
  const conflicts: DoseConflict[] = []
  for (const interaction of activeInteractions(doses, interactions)) {
    if (!interaction.separationHours) continue
    const involved = doses.filter(({ medication }) =>
      interaction.medicationIds.includes(medication.id)
    )
    involved.forEach((first, index) => {
      for (const second of involved.slice(index + 1))
        if (
          first.medication.id !== second.medication.id &&
          Math.abs(first.minutes - second.minutes) <
            interaction.separationHours! * 60
        )
          conflicts.push({ interaction, doses: [first, second] })
    })
  }
  return conflicts
}

/** Cycles a dose from to take, to taken, to skipped and back. */
export function nextDoseStatus(
  doseStatus: Readonly<Record<string, DoseStatus>>,
  key: string
): Record<string, DoseStatus> {
  const current = Object.hasOwn(doseStatus, key) ? doseStatus[key] : undefined
  const rest = Object.entries(doseStatus).filter(([entry]) => entry !== key)
  // fromEntries defines keys such as "__proto__" as data, unlike assignment.
  return Object.fromEntries(
    current === "skipped"
      ? rest
      : [...rest, [key, current === "taken" ? "skipped" : "taken"]]
  )
}

function names(ids: readonly string[], index: Map<string, Medication>) {
  const list = ids.map((id) => index.get(id)?.name ?? id)
  return list.length > 1
    ? `${list.slice(0, -1).join(", ")} and ${list.at(-1)}`
    : (list[0] ?? "")
}

function hours(value: number) {
  return `${value} ${value === 1 ? "hour" : "hours"}`
}

// Each severity has its own shape, so warnings read without colour.
function SeverityIcon({ severity }: { severity: InteractionSeverity }) {
  switch (severity) {
    case "major":
      return (
        <TriangleAlertIcon aria-hidden="true" className="text-destructive" />
      )
    case "moderate":
      return (
        <CircleAlertIcon aria-hidden="true" />
      )
    case "minor":
      return (
        <InfoIcon aria-hidden="true" />
      )
  }
}

export function MedicationSchedule({
  medications,
  interactions = [],
  date,
  onDateChange,
  doseStatus = {},
  onDoseStatusChange,
  now,
  locale = "en-US",
  label = "Medication schedule",
  disclaimer = "Interaction warnings come only from the data this schedule is given. This is not medical advice.",
  className,
  ...props
}: MedicationScheduleProps) {
  const index = medicationIndex(medications)
  const doses = dosesOn(medications, date)
  const active = activeInteractions(doses, interactions)
  const conflicts = doseConflicts(doses, interactions)
  const nowMinutes = now === undefined ? null : parseTime(now)
  const heading = React.useId()
  const title = new Intl.DateTimeFormat(locale, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(parseDate(date))
  const scheduled = medications.filter(({ id }) =>
    doses.some(({ medication }) => medication.id === id)
  )
  // Every other dose each dose is too close to, for its warning note, and
  // whether any of those interactions is major.
  const conflictsFor = new Map<string, ScheduledDose[]>()
  const majorConflicts = new Set<string>()
  for (const { interaction, doses: pair } of conflicts)
    for (const [dose, other] of [pair, [pair[1], pair[0]]] as const) {
      conflictsFor.set(dose.key, [...(conflictsFor.get(dose.key) ?? []), other])
      if (interaction.severity === "major") majorConflicts.add(dose.key)
    }

  return (
    <Card
      data-slot="medication-schedule"
      role="region"
      aria-labelledby={heading}
      className={cn("w-full", className)}
      {...props}
    >
      <CardHeader>
        <CardDescription>{label}</CardDescription>
        <CardTitle id={heading}>
          <span className="sr-only">{label}, </span>
          {title}
        </CardTitle>
        {onDateChange && (
          <CardAction className="flex gap-1">
            <Button
              variant="outline"
              size="icon-sm"
              aria-label="Previous day"
              onClick={() => onDateChange(addDays(date, -1))}
            >
              <ChevronLeftIcon aria-hidden="true" />
            </Button>
            <Button
              variant="outline"
              size="icon-sm"
              aria-label="Next day"
              onClick={() => onDateChange(addDays(date, 1))}
            >
              <ChevronRightIcon aria-hidden="true" />
            </Button>
          </CardAction>
        )}
      </CardHeader>

      <CardContent className="@container flex flex-col gap-5">
        {active.length > 0 && (
          <div className="flex flex-col gap-2">
            {active.map((interaction) => {
              const close = conflicts.filter(
                (conflict) => conflict.interaction === interaction
              )
              return (
                // shadcn's destructive variant tints the description below
                // AA contrast, so major warnings mark the border and title.
                <Alert
                  key={interaction.id}
                  data-severity={interaction.severity}
                  className={cn(
                    interaction.severity === "major" && "border-destructive"
                  )}
                >
                  <SeverityIcon severity={interaction.severity} />
                  <AlertTitle
                    className={cn(
                      interaction.severity === "major" && "text-destructive"
                    )}
                  >
                    {severityLabel[interaction.severity]} interaction:{" "}
                    {names(interaction.medicationIds, index)}
                  </AlertTitle>
                  <AlertDescription>
                    {interaction.summary}
                    {interaction.separationHours
                      ? ` Keep doses at least ${hours(interaction.separationHours)} apart.`
                      : ""}
                    {close.length > 0 &&
                      ` ${close
                        .map(
                          ({ doses: [a, b] }) =>
                            `${a.medication.name} at ${a.time} and ${b.medication.name} at ${b.time}`
                        )
                        .join(
                          "; "
                        )} ${close.length === 1 ? "is" : "are"} closer than that.`}
                  </AlertDescription>
                </Alert>
              )
            })}
          </div>
        )}

        {doses.length === 0 ? (
          <Empty role="status">
            <EmptyHeader>
              <EmptyDescription>No doses on this day.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <>
            {/* A visual summary; the dose list below carries the same facts. */}
            <div aria-hidden="true" className="flex flex-col gap-2">
              {/* Labels sit on the three gridlines, so they never collide. */}
              <div className="grid @sm:grid-cols-[8.5rem_minmax(0,1fr)] @sm:gap-3">
                <div className="relative h-4 text-xs text-muted-foreground tabular-nums @sm:col-start-2">
                  {[6, 12, 18].map((hour) => (
                    <span
                      key={hour}
                      className="absolute top-0 -translate-x-1/2"
                      style={{ left: `${(hour / 24) * 100}%` }}
                    >
                      {String(hour).padStart(2, "0")}:00
                    </span>
                  ))}
                </div>
              </div>
              {scheduled.map((medication) => (
                <div
                  key={medication.id}
                  className="grid gap-1 @sm:grid-cols-[8.5rem_minmax(0,1fr)] @sm:items-center @sm:gap-3"
                >
                  <span className="truncate text-xs font-medium">
                    {medication.name}
                  </span>
                  <div className="relative h-7 rounded-md bg-muted/50">
                    {[25, 50, 75].map((left) => (
                      <span
                        key={left}
                        className="absolute inset-y-0 w-px bg-border"
                        style={{ left: `${left}%` }}
                      />
                    ))}
                    {nowMinutes !== null && (
                      <span
                        data-now=""
                        className="absolute -inset-y-1 w-0.5 rounded-full bg-foreground"
                        style={{ left: `${(nowMinutes / day) * 100}%` }}
                      />
                    )}
                    {doses
                      .filter((dose) => dose.medication === medication)
                      .map((dose) => {
                        const status = Object.hasOwn(doseStatus, dose.key)
                          ? doseStatus[dose.key]
                          : undefined
                        return (
                          <span
                            key={dose.key}
                            data-dose={dose.key}
                            data-status={status ?? "todo"}
                            className={cn(
                              "absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-background",
                              status === "skipped" && "opacity-40",
                              conflictsFor.has(dose.key) &&
                                (majorConflicts.has(dose.key)
                                  ? "ring-2 ring-destructive"
                                  : "ring-2 ring-foreground")
                            )}
                            style={{
                              left: `${(dose.minutes / day) * 100}%`,
                              background:
                                status === "taken"
                                  ? "var(--color-muted-foreground)"
                                  : (medication.color ?? "currentColor"),
                            }}
                          />
                        )
                      })}
                  </div>
                </div>
              ))}
            </div>

            <ol aria-label="Doses" className="flex flex-col divide-y">
              {doses.map((dose) => {
                const status = Object.hasOwn(doseStatus, dose.key)
                  ? doseStatus[dose.key]
                  : undefined
                const text = statusLabel[status ?? "todo"]
                const close = conflictsFor.get(dose.key)
                const { medication } = dose
                return (
                  <li
                    key={dose.key}
                    className="flex items-center gap-3 py-2 first:pt-0 last:pb-0"
                  >
                    <time className="w-11 shrink-0 text-sm tabular-nums">
                      {dose.time}
                    </time>
                    <span
                      aria-hidden="true"
                      className="size-2.5 shrink-0 rounded-full"
                      style={{ background: medication.color ?? "currentColor" }}
                    />
                    <div className="min-w-0 flex-1">
                      <p
                        className={cn(
                          "text-sm font-medium",
                          status === "skipped" &&
                            "text-muted-foreground line-through"
                        )}
                      >
                        {medication.name}
                        {medication.dose && (
                          <span className="font-normal text-muted-foreground">
                            {" "}
                            {medication.dose}
                          </span>
                        )}
                      </p>
                      {medication.instructions && (
                        <p className="text-xs text-muted-foreground">
                          {medication.instructions}
                        </p>
                      )}
                      {close && (
                        <p
                          className={cn(
                            "text-xs font-medium",
                            majorConflicts.has(dose.key)
                              ? "text-destructive"
                              : "text-foreground"
                          )}
                        >
                          Within the separation window of{" "}
                          {close
                            .map(
                              (other) =>
                                `${other.medication.name} at ${other.time}`
                            )
                            .join(", ")}
                        </p>
                      )}
                    </div>
                    {onDoseStatusChange ? (
                      <Button
                        variant={status ? "secondary" : "outline"}
                        size="sm"
                        className="w-20"
                        aria-label={`${medication.name} at ${dose.time}: ${text}`}
                        onClick={() =>
                          onDoseStatusChange(
                            nextDoseStatus(doseStatus, dose.key)
                          )
                        }
                      >
                        {text}
                      </Button>
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        {text}
                      </span>
                    )}
                  </li>
                )
              })}
            </ol>
          </>
        )}
      </CardContent>

      {disclaimer !== null && (
        <CardFooter>
          <p className="text-xs text-muted-foreground">{disclaimer}</p>
        </CardFooter>
      )}
    </Card>
  )
}
