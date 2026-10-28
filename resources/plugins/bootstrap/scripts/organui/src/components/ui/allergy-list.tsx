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
import { TriangleAlertIcon, CheckIcon, CircleHelpIcon } from "lucide-react"

export type AllergySeverity = "mild" | "moderate" | "severe"

export type Allergy = {
  id: string
  /** What the patient reacts to, such as "Penicillin". */
  substance: string
  /** An allergy is immune-mediated; an intolerance, such as nausea, is not. */
  type?: "allergy" | "intolerance"
  /** What happened, such as "Anaphylaxis" or "Rash". */
  reactions?: readonly string[]
  /** How bad the worst reaction was. */
  severity?: AllergySeverity
  /** Whether it has been confirmed, by testing or a clear history. */
  verification?: "confirmed" | "unconfirmed"
  /** An inactive or resolved allergy shows muted, with its status. */
  status?: "active" | "inactive" | "resolved"
  /** An ISO 8601 date. */
  recordedDate?: string
}

/**
 * The allergies, `"none-known"` once "no known allergies" has been recorded,
 * or nothing (or an empty list) when they have not been asked about.
 */
export type AllergyRecord = readonly Allergy[] | "none-known"

export type AllergyListProps = React.ComponentProps<"div"> & {
  /** The allergies, `"none-known"`, or nothing when not recorded. */
  allergies?: AllergyRecord
  /** Names the table for assistive technology and shows below it. */
  caption?: React.ReactNode
  /** Defaults to a UTC date such as "Oct 1, 2026". */
  formatDate?: (date: string) => string
}

export const allergySeverityLabels: Record<AllergySeverity, string> = {
  mild: "Mild",
  moderate: "Moderate",
  severe: "Severe",
}

/**
 * The active allergies for a summary such as the patient banner's: each
 * substance with its first reaction in brackets, `"none-known"` when every
 * recorded allergy has resolved, and nothing when none were recorded.
 */
export function allergySummary(
  allergies?: AllergyRecord
): readonly string[] | "none-known" | undefined {
  if (allergies === "none-known") return allergies
  if (!allergies?.length) return undefined
  const active = allergies.filter(
    ({ status = "active" }) => status === "active"
  )
  if (!active.length) return "none-known"
  return active.map(({ substance, reactions }) =>
    reactions?.length ? `${substance} (${reactions[0]})` : substance
  )
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

function Severity({ severity }: { severity?: AllergySeverity }) {
  if (!severity)
    return (
      <>
        <span aria-hidden className="text-muted-foreground">
          —
        </span>
        <span className="sr-only">Not recorded</span>
      </>
    )
  return (
    <span
      data-slot="allergy-severity"
      data-severity={severity}
      className={cn(
        "inline-flex items-center gap-1",
        severity === "severe" && "font-semibold",
        severity === "mild" && "text-muted-foreground"
      )}
    >
      {severity === "severe" && (
        <TriangleAlertIcon aria-hidden="true" className="size-4 shrink-0" />
      )}
      {allergySeverityLabels[severity]}
    </span>
  )
}

function EmptyRow({
  allergies,
  columns,
}: {
  allergies?: AllergyRecord
  columns: number
}) {
  const noneKnown = allergies === "none-known"
  return (
    <TableRow>
      <TableCell
        colSpan={columns}
        data-slot="allergy-list-empty"
        data-state={noneKnown ? "none-known" : "not-recorded"}
        className={cn(
          "h-16 text-center",
          !noneKnown && "text-muted-foreground"
        )}
      >
        <span className="inline-flex items-center gap-1.5">
          {noneKnown ? (
            <CheckIcon aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
          ) : (
            <CircleHelpIcon aria-hidden="true" className="size-4 shrink-0" />
          )}
          {noneKnown ? "No known allergies" : "Allergies not recorded"}
        </span>
      </TableCell>
    </TableRow>
  )
}

export function AllergyList({
  allergies,
  caption,
  formatDate = defaultFormatDate,
  className,
  ...props
}: AllergyListProps) {
  const rows = Array.isArray(allergies) ? (allergies as readonly Allergy[]) : []
  return (
    <div
      data-slot="allergy-list"
      className={cn("@container w-full min-w-0", className)}
      {...props}
    >
      <Table>
        {caption && <TableCaption>{caption}</TableCaption>}
        <TableHeader>
          <TableRow>
            <TableHead scope="col">Substance</TableHead>
            <TableHead scope="col">Reaction</TableHead>
            <TableHead scope="col">Severity</TableHead>
            <TableHead scope="col" className="hidden @lg:table-cell">
              Recorded
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 && <EmptyRow allergies={allergies} columns={4} />}
          {rows.map((allergy) => {
            const status = allergy.status ?? "active"
            const details = [
              allergy.type === "intolerance" ? "Intolerance" : null,
              allergy.verification === "unconfirmed" ? "Unconfirmed" : null,
              status === "active"
                ? null
                : status === "resolved"
                  ? "Resolved"
                  : "Inactive",
            ].filter(Boolean)
            return (
              <TableRow
                key={allergy.id}
                data-status={status}
                className={cn(status !== "active" && "text-muted-foreground")}
              >
                <TableHead
                  scope="row"
                  className="h-auto py-2 font-normal whitespace-normal"
                >
                  <span
                    className={cn(
                      "font-medium",
                      status !== "active" && "line-through"
                    )}
                  >
                    {allergy.substance}
                  </span>
                  {details.length > 0 && (
                    <span className="block text-xs text-muted-foreground">
                      {details.join(" · ")}
                    </span>
                  )}
                  {allergy.recordedDate && (
                    <span className="block text-xs text-muted-foreground @lg:hidden">
                      Recorded {formatDate(allergy.recordedDate)}
                    </span>
                  )}
                </TableHead>
                <TableCell className="whitespace-normal">
                  {allergy.reactions?.length ? (
                    allergy.reactions.join(", ")
                  ) : (
                    <>
                      <span aria-hidden className="text-muted-foreground">
                        —
                      </span>
                      <span className="sr-only">Not recorded</span>
                    </>
                  )}
                </TableCell>
                <TableCell>
                  <Severity severity={allergy.severity} />
                </TableCell>
                <TableCell className="hidden text-muted-foreground tabular-nums @lg:table-cell">
                  {allergy.recordedDate ? formatDate(allergy.recordedDate) : ""}
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
