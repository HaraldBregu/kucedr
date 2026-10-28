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

export type ProblemCode = {
  /** The code system, such as "SNOMED CT" or "ICD-10". */
  system: string
  value: string
}

export type Problem = {
  id: string
  /** The condition or problem, such as "Type 2 diabetes". */
  name: string
  code?: ProblemCode
  /** Active problems list first; resolved and inactive ones under Past. */
  status?: "active" | "inactive" | "resolved"
  /** A major problem is bold and leads its group. */
  significance?: "major" | "minor"
  /** An ISO 8601 date, or text such as "2015" or "Childhood". */
  onset?: string
  /** An ISO 8601 date, or text. */
  resolved?: string
}

export type ProblemListProps = React.ComponentProps<"div"> & {
  /** The problems, active and past, in any order. */
  problems: readonly Problem[]
  /** Names the table for assistive technology and shows below it. */
  caption?: React.ReactNode
  /** Shows each problem's code beneath its name. Defaults to true. */
  showCodes?: boolean
  /** Formats full ISO dates. Defaults to a UTC date such as "Oct 1, 2026". */
  formatDate?: (date: string) => string
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

/** Active problems, then past ones, the major ones first in each. */
export function groupProblems(problems: readonly Problem[]) {
  const byWeight = (a: Problem, b: Problem) =>
    Number(b.significance === "major") - Number(a.significance === "major")
  const active = problems.filter(({ status = "active" }) => status === "active")
  const past = problems.filter(({ status = "active" }) => status !== "active")
  return { active: active.sort(byWeight), past: past.sort(byWeight) }
}

function Dates({
  problem,
  formatDate,
}: {
  problem: Problem
  formatDate: (date: string) => string
}) {
  // Only a full date is reformatted; "2015" or "Childhood" reads as written.
  const format = (value: string) =>
    /^\d{4}-\d{2}-\d{2}/.test(value) ? formatDate(value) : value
  const { onset, resolved, status = "active" } = problem
  if (status === "active") return onset ? <>Since {format(onset)}</> : null
  if (onset && resolved)
    return (
      <>
        {format(onset)} – {format(resolved)}
      </>
    )
  if (resolved) return <>Until {format(resolved)}</>
  return onset ? <>From {format(onset)}</> : null
}

export function ProblemList({
  problems,
  caption,
  showCodes = true,
  formatDate = defaultFormatDate,
  className,
  ...props
}: ProblemListProps) {
  const { active, past } = groupProblems(problems)
  const groups = [
    { id: "active", title: "Active", rows: active },
    { id: "past", title: "Past", rows: past },
  ].filter(({ rows }) => rows.length)
  return (
    <div
      data-slot="problem-list"
      className={cn("@container w-full min-w-0", className)}
      {...props}
    >
      <Table>
        {caption && <TableCaption>{caption}</TableCaption>}
        <TableHeader>
          <TableRow>
            <TableHead scope="col">Problem</TableHead>
            <TableHead scope="col" className="text-right">
              Dates
            </TableHead>
          </TableRow>
        </TableHeader>
        {groups.length === 0 && (
          <TableBody>
            <TableRow>
              <TableCell
                colSpan={2}
                className="h-16 text-center text-muted-foreground"
              >
                No problems recorded.
              </TableCell>
            </TableRow>
          </TableBody>
        )}
        {groups.map((group) => (
          <TableBody key={group.id} data-group={group.id}>
            <TableRow className="hover:bg-transparent">
              <TableHead
                scope="rowgroup"
                colSpan={2}
                className="h-8 text-xs font-medium text-muted-foreground"
              >
                {group.title}{" "}
                <span className="tabular-nums">· {group.rows.length}</span>
              </TableHead>
            </TableRow>
            {group.rows.map((problem) => (
              <TableRow
                key={problem.id}
                data-status={problem.status ?? "active"}
                data-significance={problem.significance}
                className={cn(group.id === "past" && "text-muted-foreground")}
              >
                <TableHead
                  scope="row"
                  className="h-auto py-2 font-normal whitespace-normal"
                >
                  <span
                    className={cn(
                      problem.significance === "major" && "font-semibold",
                      group.id === "active" && "text-foreground"
                    )}
                  >
                    {problem.name}
                  </span>
                  {showCodes && problem.code && (
                    <span className="block text-xs text-muted-foreground tabular-nums">
                      {problem.code.system} {problem.code.value}
                    </span>
                  )}
                </TableHead>
                <TableCell className="text-right whitespace-normal text-muted-foreground tabular-nums">
                  <Dates problem={problem} formatDate={formatDate} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        ))}
      </Table>
    </div>
  )
}
