import * as React from "react"
import { cn } from "cn"

import { Button } from "@/components/ui/button"
import { XIcon } from "lucide-react"

export type BodyMapView = "front" | "back"
export type BodyMapRegion = {
  id: string
  label: string
  view: BodyMapView
  /** SVG path data in the 200 × 440 body coordinate space. */
  d: string
  /** Reflects the path across the body's midline. */
  mirrored?: boolean
}
export type BodyMapProps = React.ComponentProps<"div"> & {
  /** The selected region ids. */
  value: readonly string[]
  /** Called with the new selection. */
  onValueChange: (value: string[]) => void
  /** Defaults to bodyMapRegions. Replace labels or shapes to customize. */
  regions?: readonly BodyMapRegion[]
  /** Which figures to show, front and back by default. */
  views?: readonly BodyMapView[]
  /** Submits one hidden input per selected region inside a form. */
  name?: string
  /** The accessible name of the map. */
  label?: string
}

const width = 200
const height = 440

// Paired shapes are drawn on the viewer's left. Facing the viewer that is the
// person's right side; seen from behind it is their left.
const shapes = {
  head: "M100 6C114 6 122 18 122 31C122 45 112 55 100 55C88 55 78 45 78 31C78 18 86 6 100 6Z",
  neck: "M91 52C96 56 104 56 109 52L113 72L87 72Z",
  shoulder: "M87 72C74 73 62 76 56 84C52 90 50 98 50 106L68 106L72 86Z",
  chest: "M100 72L87 72L72 86L73 132L100 132Z",
  upperAbdomen: "M100 132L73 132C73 145 74 157 75 168L100 168Z",
  lowerAbdomen: "M100 168L75 168C74 182 72 196 71 210L100 210Z",
  groin: "M71 210L129 210L127 222L100 238L73 222Z",
  thigh:
    "M71 210L73 222L100 238L98 318L77 318C73 292 70 262 69 236C69 226 70 218 71 210Z",
  lowerBack: "M100 132L73 132C73 152 74 172 74 192L100 192Z",
  buttock: "M74 192L100 192L100 240C88 246 76 243 70 236C70 220 72 206 74 192Z",
  thighBack:
    "M70 236C76 243 88 246 100 240L98 318L77 318C73 292 70 262 70 236Z",
  knee: "M77 318L98 318L97 344L78 344Z",
  shin: "M78 344L97 344L95 405L83 405C80 386 77 366 78 344Z",
  foot: "M83 405L95 405L97 428C91 433 80 433 74 430C74 423 78 414 83 405Z",
  upperArm: "M50 106L68 106C67 126 66 146 64 166L46 164C46 144 48 124 50 106Z",
  forearm: "M46 164L64 166C62 186 60 206 58 226L42 224C42 204 44 184 46 164Z",
  hand: "M42 224L58 226C60 236 59 248 55 258C49 263 41 260 38 251C36 241 38 231 42 224Z",
}

function region(
  view: BodyMapView,
  id: string,
  label: string,
  d: string
): BodyMapRegion {
  return { id, label, view, d }
}

// "{side}" in an ID or label becomes "right" or "left".
function pair(
  view: BodyMapView,
  id: string,
  label: string,
  d: string
): BodyMapRegion[] {
  return (["right", "left"] as const).map((side) => {
    const text = label.replace("{side}", side)
    return {
      id: id.replace("{side}", side),
      label: text.charAt(0).toUpperCase() + text.slice(1),
      view,
      d,
      mirrored: (view === "front") === (side === "left"),
    }
  })
}

export const bodyMapRegions: readonly BodyMapRegion[] = [
  region("front", "head", "Head and face", shapes.head),
  region("front", "neck", "Neck", shapes.neck),
  ...pair("front", "{side}-shoulder", "{side} shoulder", shapes.shoulder),
  ...pair("front", "{side}-chest", "{side} chest", shapes.chest),
  ...pair(
    "front",
    "{side}-upper-abdomen",
    "{side} upper abdomen",
    shapes.upperAbdomen
  ),
  ...pair(
    "front",
    "{side}-lower-abdomen",
    "{side} lower abdomen",
    shapes.lowerAbdomen
  ),
  region("front", "groin", "Groin", shapes.groin),
  ...pair("front", "{side}-upper-arm", "{side} upper arm", shapes.upperArm),
  ...pair("front", "{side}-forearm", "{side} forearm", shapes.forearm),
  ...pair("front", "{side}-palm", "{side} palm", shapes.hand),
  ...pair("front", "{side}-thigh", "front of {side} thigh", shapes.thigh),
  ...pair("front", "{side}-knee", "{side} knee", shapes.knee),
  ...pair("front", "{side}-shin", "{side} shin", shapes.shin),
  ...pair("front", "{side}-foot", "top of {side} foot", shapes.foot),
  region("back", "back-of-head", "Back of head", shapes.head),
  region("back", "back-of-neck", "Back of neck", shapes.neck),
  ...pair(
    "back",
    "{side}-shoulder-back",
    "back of {side} shoulder",
    shapes.shoulder
  ),
  ...pair("back", "{side}-upper-back", "{side} upper back", shapes.chest),
  ...pair("back", "{side}-lower-back", "{side} lower back", shapes.lowerBack),
  ...pair("back", "{side}-buttock", "{side} buttock", shapes.buttock),
  ...pair(
    "back",
    "{side}-upper-arm-back",
    "back of {side} upper arm",
    shapes.upperArm
  ),
  ...pair(
    "back",
    "{side}-forearm-back",
    "back of {side} forearm",
    shapes.forearm
  ),
  ...pair("back", "{side}-hand-back", "back of {side} hand", shapes.hand),
  ...pair(
    "back",
    "{side}-thigh-back",
    "back of {side} thigh",
    shapes.thighBack
  ),
  ...pair("back", "{side}-knee-back", "back of {side} knee", shapes.knee),
  ...pair("back", "{side}-calf", "{side} calf", shapes.shin),
  ...pair("back", "{side}-heel", "{side} heel", shapes.foot),
]

const viewLabels: Record<BodyMapView, string> = {
  front: "Front",
  back: "Back",
}

// The middle of a path's bounding box, close enough for arrow key
// navigation. Paths use absolute coordinate pairs only.
export function regionCenter(region: BodyMapRegion): [number, number] {
  const numbers = region.d.match(/-?\d*\.?\d+/g)?.map(Number) ?? [0, 0]
  const xs = numbers.filter((_, index) => index % 2 === 0)
  const ys = numbers.filter((_, index) => index % 2 === 1)
  const x = (Math.min(...xs) + Math.max(...xs)) / 2
  const y = (Math.min(...ys) + Math.max(...ys)) / 2
  return [region.mirrored ? width - x : x, y]
}

const directions: Record<string, [number, number]> = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
}

/**
 * The nearest region within 45 degrees of an arrow key's direction, favoring
 * straight lines.
 */
export function nextRegion(
  regions: readonly BodyMapRegion[],
  from: BodyMapRegion,
  key: string
): BodyMapRegion | undefined {
  const direction = directions[key]
  if (!direction) return undefined
  const [dx, dy] = direction
  const [fx, fy] = regionCenter(from)
  let best: BodyMapRegion | undefined
  let bestScore = Infinity
  for (const candidate of regions) {
    if (candidate === from) continue
    const [cx, cy] = regionCenter(candidate)
    const along = (cx - fx) * dx + (cy - fy) * dy
    const across = Math.abs((cx - fx) * dy - (cy - fy) * dx)
    if (along <= 1 || across > along) continue
    const score = along + across * 2
    if (score < bestScore) {
      best = candidate
      bestScore = score
    }
  }
  return best
}

/** Toggles an ID, keeping known IDs in selection order. */
export function toggleRegion(
  value: readonly string[],
  id: string,
  regions: readonly BodyMapRegion[] = bodyMapRegions
): string[] {
  const known = new Set(regions.map((region) => region.id))
  const next = value.filter((item) => known.has(item) && item !== id)
  return value.includes(id) ? next : [...next, id]
}

export function BodyMap({
  value,
  onValueChange,
  regions = bodyMapRegions,
  views = ["front", "back"],
  name,
  label = "Body map",
  className,
  ...props
}: BodyMapProps) {
  const helpId = React.useId()
  const statusId = React.useId()
  const selected = new Set(value)
  const byId = new Map(regions.map((region) => [region.id, region]))
  const chosen = value.flatMap((id) => byId.get(id) ?? [])
  const [hovered, setHovered] = React.useState<string | null>(null)
  const [active, setActive] = React.useState<Record<string, string>>({})
  const [focusRing, setFocusRing] = React.useState<string | null>(null)
  const elements = React.useRef(new Map<string, SVGPathElement>())

  function toggle(id: string) {
    onValueChange(toggleRegion(value, id, regions))
  }

  return (
    <div
      data-slot="body-map"
      role="group"
      aria-label={label}
      className={cn("flex flex-col gap-4", className)}
      {...props}
    >
      <p id={helpId} className="sr-only">
        Each view is one tab stop. Arrow keys move between regions; Space or
        Enter selects or clears the focused region.
      </p>
      <div
        className="grid gap-4"
        style={{
          gridTemplateColumns: `repeat(${views.length}, minmax(0, 1fr))`,
        }}
      >
        {views.map((view) => {
          const items = regions.filter((region) => region.view === view)
          // The tab stop is the last region focused in this view, else the
          // first selected one, else the first region.
          const stop =
            items.find((region) => region.id === active[view]) ??
            items.find((region) => selected.has(region.id)) ??
            items[0]
          const ring = items.find((region) => region.id === focusRing)
          // The pointer's region, else the one keyboard focus is on.
          const hint = (items.find((region) => region.id === hovered) ?? ring)
            ?.label
          // Facing the viewer, the person's right side is on the left.
          const [start, end] = view === "front" ? ["R", "L"] : ["L", "R"]
          return (
            <figure
              key={view}
              className="m-0 flex min-w-0 flex-col items-center gap-2"
            >
              <figcaption className="text-sm font-medium">
                {viewLabels[view]}
              </figcaption>
              <svg
                viewBox={`0 0 ${width} ${height}`}
                role="group"
                aria-label={`${viewLabels[view]} of body`}
                aria-describedby={helpId}
                className="h-auto w-full max-w-48 touch-manipulation overflow-visible"
              >
                <text
                  x={12}
                  y={20}
                  aria-hidden="true"
                  className="fill-muted-foreground text-[11px] font-medium"
                >
                  {start}
                </text>
                <text
                  x={width - 12}
                  y={20}
                  textAnchor="end"
                  aria-hidden="true"
                  className="fill-muted-foreground text-[11px] font-medium"
                >
                  {end}
                </text>
                {items.map((region) => {
                  const checked = selected.has(region.id)
                  return (
                    <path
                      key={region.id}
                      ref={(element) => {
                        if (element) elements.current.set(region.id, element)
                        else elements.current.delete(region.id)
                      }}
                      d={region.d}
                      transform={
                        region.mirrored
                          ? `matrix(-1 0 0 1 ${width} 0)`
                          : undefined
                      }
                      role="checkbox"
                      aria-checked={checked}
                      aria-label={region.label}
                      tabIndex={region === stop ? 0 : -1}
                      className="cursor-pointer fill-muted-foreground/20 stroke-background transition-colors outline-none hover:fill-muted-foreground/40 aria-checked:fill-primary aria-checked:hover:fill-primary/80"
                      strokeWidth={1.5}
                      strokeLinejoin="round"
                      onClick={() => toggle(region.id)}
                      onPointerEnter={() => setHovered(region.id)}
                      onPointerLeave={() =>
                        setHovered((id) => (id === region.id ? null : id))
                      }
                      onFocus={(event) => {
                        setActive((current) => ({
                          ...current,
                          [view]: region.id,
                        }))
                        setFocusRing(
                          event.currentTarget.matches(":focus-visible")
                            ? region.id
                            : null
                        )
                      }}
                      onBlur={() =>
                        setFocusRing((id) => (id === region.id ? null : id))
                      }
                      onKeyDown={(event) => {
                        let target: BodyMapRegion | undefined
                        if (event.key === "Home") target = items[0]
                        else if (event.key === "End") target = items.at(-1)
                        else if (event.key === " " || event.key === "Enter") {
                          event.preventDefault()
                          toggle(region.id)
                          return
                        } else target = nextRegion(items, region, event.key)
                        if (!target && !(event.key in directions)) return
                        event.preventDefault()
                        if (target) elements.current.get(target.id)?.focus()
                      }}
                    />
                  )
                })}
                {/* Drawn last so the outline is not covered by neighbors. */}
                {ring && (
                  <path
                    d={ring.d}
                    transform={
                      ring.mirrored ? `matrix(-1 0 0 1 ${width} 0)` : undefined
                    }
                    aria-hidden="true"
                    className="pointer-events-none fill-none stroke-ring"
                    strokeWidth={3}
                    strokeLinejoin="round"
                  />
                )}
              </svg>
              <p
                aria-hidden="true"
                className="min-h-5 text-center text-xs text-muted-foreground"
              >
                {hint}
              </p>
            </figure>
          )
        })}
      </div>
      <div className="flex flex-col gap-2">
        <p
          id={statusId}
          role="status"
          className="text-sm text-muted-foreground"
        >
          {chosen.length === 0
            ? "No regions selected"
            : `${chosen.length} ${chosen.length === 1 ? "region" : "regions"} selected`}
        </p>
        {chosen.length > 0 && (
          <ul aria-labelledby={statusId} className="flex flex-wrap gap-1.5">
            {chosen.map((region) => (
              <li key={region.id}>
                <Button
                  variant="secondary"
                  size="xs"
                  aria-label={`Remove ${region.label}`}
                  onClick={() => toggle(region.id)}
                >
                  {region.label}
                  <XIcon aria-hidden="true" data-icon="inline-end" />
                </Button>
              </li>
            ))}
            <li>
              <Button
                variant="ghost"
                size="xs"
                onClick={() => onValueChange([])}
              >
                Clear all
              </Button>
            </li>
          </ul>
        )}
      </div>
      {name &&
        chosen.map((region) => (
          <input key={region.id} type="hidden" name={name} value={region.id} />
        ))}
    </div>
  )
}
