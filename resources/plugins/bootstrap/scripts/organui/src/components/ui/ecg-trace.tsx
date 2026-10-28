"use client"

import * as React from "react"
import { cn } from "cn"

import { Button } from "@/components/ui/button"

export type EcgWave = "P" | "QRS" | "T"
/** A labelled wave, at its peak, in seconds from the first sample. */
export type EcgAnnotation = { wave: EcgWave; time: number }
/** Live samples in millivolts, delivered in chunks as they arrive. */
export type EcgStream = {
  subscribe(listener: (samples: readonly number[]) => void): () => void
}
export type EcgTraceProps = React.ComponentProps<"figure"> & {
  /** A recorded trace in millivolts. Ignored when `stream` is set. */
  samples?: readonly number[]
  /** A live source, drawn as a monitor sweep. */
  stream?: EcgStream
  /** Samples per second. Defaults to 250. */
  sampleRate?: number
  /**
   * Seconds shown across the strip. Defaults to the whole recording, or 6
   * seconds for a stream.
   */
  duration?: number
  /** Paper speed in mm/s. Defaults to the standard 25. */
  speed?: number
  /** Gain in mm/mV. Defaults to the standard 10. */
  gain?: number
  /** Lowest and highest millivolts shown. Defaults to -1.5 to 2. */
  range?: readonly [number, number]
  /** The lead name shown in the caption. Defaults to II. */
  lead?: string
  /**
   * Wave labels. Detected from the signal unless given; pass false to hide
   * them. Streams are always detected.
   */
  annotations?: readonly EcgAnnotation[] | false
  /** Draws the 1 mV calibration pulse before the trace. Defaults to true. */
  calibration?: boolean
  /** The accessible name of the strip. Defaults to "ECG". */
  label?: string
}

const calibrationPulse = 0.2 // seconds, the standard 1 mV pulse
const sweepGap = 0.2 // seconds blanked ahead of a live write head
const minPxPerMm = 3 // below this the strip scrolls instead of shrinking

// A regular synthetic beat: P, Q, R, S and T as Gaussians in mV, with times
// in seconds from the R peak. T moves with the RR interval, as QT does.
function beat(offset: number, rr: number) {
  const waves = [
    [0.15, -0.16, 0.025],
    [-0.12, -0.025, 0.01],
    [1.2, 0, 0.012],
    [-0.3, 0.03, 0.012],
    [0.32, 0.3 * Math.sqrt(rr), 0.045],
  ] as const
  let value = 0
  for (const [amplitude, center, width] of waves)
    value += amplitude * Math.exp(-((offset - center) ** 2) / (2 * width ** 2))
  return value
}

/** The synthetic rhythm in mV at `time` seconds. The first R peak is at 0.3 s. */
export function syntheticEcgValue(time: number, heartRate = 72) {
  const rr = 60 / heartRate
  const index = Math.round((time - 0.3) / rr)
  let value = 0
  for (let k = index - 1; k <= index + 1; k++)
    if (k >= 0) value += beat(time - 0.3 - k * rr, rr)
  return value
}

/**
 * An original, synthetic sinus rhythm for demos and tests. It is not a
 * recording and models no pathology.
 */
export function syntheticEcg({
  heartRate = 72,
  duration = 10,
  sampleRate = 250,
}: { heartRate?: number; duration?: number; sampleRate?: number } = {}) {
  return Array.from({ length: Math.round(duration * sampleRate) }, (_, i) =>
    syntheticEcgValue(i / sampleRate, heartRate)
  )
}

/**
 * A live stream of the synthetic rhythm, paced by the clock. Each subscriber
 * gets its own trace starting at time 0.
 */
export function syntheticEcgStream({
  heartRate = 72,
  sampleRate = 250,
  interval = 40,
}: {
  heartRate?: number
  sampleRate?: number
  /** Milliseconds between chunks. */
  interval?: number
} = {}): EcgStream {
  return {
    subscribe(listener) {
      const start = Date.now()
      let sent = 0
      const timer = setInterval(() => {
        const due = Math.floor(((Date.now() - start) / 1000) * sampleRate)
        if (due <= sent) return
        const chunk: number[] = []
        for (; sent < due; sent++)
          chunk.push(syntheticEcgValue(sent / sampleRate, heartRate))
        listener(chunk)
      }, interval)
      return () => clearInterval(timer)
    },
  }
}

function median(values: readonly number[]) {
  if (!values.length) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const middle = sorted.length >> 1
  return sorted.length % 2
    ? sorted[middle]!
    : (sorted[middle - 1]! + sorted[middle]!) / 2
}

// The index of the largest deviation from baseline in [from, to).
function peak(
  samples: readonly number[],
  baseline: number,
  from: number,
  to: number
) {
  let best = -1
  let size = 0
  for (let i = Math.max(0, from); i < Math.min(samples.length, to); i++) {
    const deviation = Math.abs(samples[i]! - baseline)
    if (deviation > size) [best, size] = [i, deviation]
  }
  return { index: best, size }
}

/**
 * Finds P, QRS and T peaks with a simple slope and amplitude heuristic tuned
 * for clean sinus rhythms. It is a labelling aid, not a clinical detector:
 * pass your own annotations for real recordings.
 */
export function detectEcgWaves(
  samples: readonly number[],
  sampleRate = 250
): EcgAnnotation[] {
  const at = (seconds: number) => Math.round(seconds * sampleRate)
  const baseline = median(samples)
  // QRS complexes are where the signal is steepest.
  const slope = samples.map((_, i) =>
    i && i < samples.length - 1 ? (samples[i + 1]! - samples[i - 1]!) ** 2 : 0
  )
  const threshold = 0.3 * slope.reduce((a, b) => Math.max(a, b), 0)
  const peaks: number[] = []
  for (let i = 0; i < samples.length; i++) {
    if (slope[i]! <= threshold || !threshold) continue
    const r = peak(samples, baseline, i - at(0.05), i + at(0.05))
    if (r.size < 0.25) continue
    const last = peaks.at(-1)
    if (last !== undefined && r.index - last < at(0.25)) {
      if (r.size > Math.abs(samples[last]! - baseline))
        peaks[peaks.length - 1] = r.index
    } else peaks.push(r.index)
    i += at(0.05)
  }
  const annotations: EcgAnnotation[] = []
  // Where the previous beat's T wave ends; a P wave starts after it.
  let previous = -Infinity
  peaks.forEach((r, n) => {
    // Skip complexes cut off by either end of the data.
    if (r < at(0.05) || r + at(0.08) >= samples.length) return
    const start = Math.max(r - at(0.3), previous)
    const p = peak(samples, baseline, start, r - at(0.08))
    if (r - at(0.3) >= 0 && p.size > 0.05)
      annotations.push({ wave: "P", time: p.index / sampleRate })
    annotations.push({ wave: "QRS", time: r / sampleRate })
    const end = Math.min(r + at(0.5), (peaks[n + 1] ?? Infinity) - at(0.2))
    const t = peak(samples, baseline, r + at(0.12), end)
    if (end <= samples.length && t.size > 0.05) {
      annotations.push({ wave: "T", time: t.index / sampleRate })
      previous = t.index + at(0.1)
    } else previous = r + at(0.12)
  })
  return annotations
}

/** The median heart rate in beats per minute, or null under two beats. */
export function ecgHeartRate(annotations: readonly EcgAnnotation[]) {
  const beats = annotations
    .filter(({ wave }) => wave === "QRS")
    .map(({ time }) => time)
    .sort((a, b) => a - b)
  const intervals = beats.slice(1).map((time, i) => time - beats[i]!)
  return intervals.length ? Math.round(60 / median(intervals)) : null
}

// Grid lines as one path each: every 1 mm and every 5 mm. ECG paper is red;
// set --ecg-grid in your theme to change it without editing this file.
function gridPath(width: number, height: number, step: number) {
  let d = ""
  for (let x = 0; x <= width + 1e-6; x += step) d += `M${x} 0V${height}`
  for (let y = 0; y <= height + 1e-6; y += step) d += `M0 ${y}H${width}`
  return d
}

type Point = { position: number; value: number } | null

function tracePath(
  points: readonly Point[],
  x: (position: number) => number,
  y: (value: number) => number
) {
  let d = ""
  let pen = false
  for (const point of points) {
    if (!point || !Number.isFinite(point.value)) {
      pen = false
      continue
    }
    d += `${pen ? "L" : "M"}${x(point.position).toFixed(2)} ${y(point.value).toFixed(2)}`
    pen = true
  }
  return d
}

// A live sweep: a fixed window that the write head overwrites in place.
type Sweep = { values: Float32Array; head: number; stream: EcgStream }

export function EcgTrace({
  samples,
  stream,
  sampleRate = 250,
  duration,
  speed = 25,
  gain = 10,
  range = [-1.5, 2],
  lead = "II",
  annotations,
  calibration = true,
  label = "ECG",
  className,
  ...props
}: EcgTraceProps) {
  const seconds =
    duration ?? (stream ? 6 : (samples?.length ?? 0) / sampleRate || 10)
  const length = Math.max(1, Math.round(seconds * sampleRate))
  const [paused, setPaused] = React.useState(false)
  const [live, setLive] = React.useState<{
    values: Float32Array
    head: number
  } | null>(null)
  const sweep = React.useRef<Sweep | null>(null)

  React.useEffect(() => {
    if (!stream) return
    if (
      sweep.current?.stream !== stream ||
      sweep.current.values.length !== length
    )
      sweep.current = {
        values: new Float32Array(length).fill(NaN),
        head: 0,
        stream,
      }
    if (paused) return
    const current = sweep.current
    let frame = 0
    const unsubscribe = stream.subscribe((chunk) => {
      for (const value of chunk)
        current.values[current.head++ % current.values.length] = value
      frame ||= requestAnimationFrame(() => {
        frame = 0
        setLive({ values: current.values.slice(), head: current.head })
      })
    })
    return () => {
      unsubscribe()
      cancelAnimationFrame(frame)
    }
  }, [stream, length, paused])

  // The pulse is 0.2 s wide at the paper speed, with 2 mm before it and the
  // space it takes rounded up to whole large boxes.
  const pulse = calibrationPulse * speed
  const offset = calibration ? Math.ceil((pulse + 5) / 5) * 5 : 0
  const width = offset + seconds * speed
  const height = (range[1] - range[0]) * gain
  // Strip positions are sample indexes; x and y are millimetres.
  const x = (position: number) => offset + (position / sampleRate) * speed
  const y = (value: number) =>
    Math.min(height, Math.max(0, (range[1] - value) * gain))

  // Time-ordered data, and where each sample sits on the strip in samples.
  const { history, points, place } = React.useMemo(() => {
    if (!stream) {
      const history = (samples ?? []).slice(0, length)
      return {
        history,
        points: history.map((value, position) => ({ position, value })),
        place: (index: number) => index,
      }
    }
    if (!live) return { history: [], points: [], place: (i: number) => i }
    const { values, head } = live
    const gap = Math.min(values.length - 1, Math.round(sweepGap * sampleRate))
    const kept = Math.min(head, values.length - gap)
    const first = head - kept
    const history = Array.from(
      { length: kept },
      (_, i) => values[(first + i) % values.length]!
    )
    const points: Point[] = Array.from(values, (value, position) => {
      // Positions just ahead of the head are blank, like a monitor's erase bar.
      const ahead =
        (position - (head % values.length) + values.length) % values.length
      return ahead < gap || Number.isNaN(value) ? null : { position, value }
    })
    return {
      history,
      points,
      place: (index: number) => (first + index) % values.length,
    }
  }, [stream, live, samples, length, sampleRate])

  const detected = React.useMemo(
    () =>
      stream || annotations === undefined
        ? detectEcgWaves(history, sampleRate)
        : annotations || [],
    [stream, annotations, history, sampleRate]
  )
  const rate = ecgHeartRate(detected)
  const baseline = median(history)
  const labels =
    annotations === false
      ? []
      : detected.flatMap(({ wave, time }) => {
          const index = Math.round(time * sampleRate)
          const value = history[index]
          if (value === undefined || index >= length) return []
          const position = place(index)
          const above = value >= baseline
          return [
            {
              key: `${wave}-${position}`,
              wave,
              x: x(position),
              y: above
                ? Math.max(4, y(value) - 1.5)
                : Math.min(height - 1, y(value) + 4),
            },
          ]
        })

  const summary = `${label}, lead ${lead}, ${Math.round(seconds * 10) / 10} seconds at ${speed} mm/s and ${gain} mm/mV, ${
    rate === null ? "heart rate not measured" : `about ${rate} beats per minute`
  }${stream ? (paused ? ", paused" : ", live") : ""}`

  return (
    <figure
      data-slot="ecg-trace"
      className={cn("flex min-w-0 flex-col gap-2", className)}
      {...props}
    >
      <figcaption className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-sm">
        <span>
          <span className="font-medium">Lead {lead}</span>
          <span className="text-muted-foreground">
            {" "}
            · {speed} mm/s · {gain} mm/mV
          </span>
        </span>
        <span className="flex items-center gap-3">
          <span className="tabular-nums">
            HR {rate ?? "--"}
            <span className="text-muted-foreground"> bpm</span>
          </span>
          {stream && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPaused((value) => !value)}
            >
              {paused ? "Resume" : "Pause"}
            </Button>
          )}
        </span>
      </figcaption>
      <div
        role="region"
        aria-label={`${label} strip`}
        tabIndex={0}
        className="overflow-x-auto rounded-lg border bg-background outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <svg
          role="img"
          aria-label={summary}
          viewBox={`0 0 ${width} ${height}`}
          className="block h-auto w-full"
          style={{ minWidth: width * minPxPerMm }}
        >
          <path
            d={gridPath(width, height, 1)}
            data-slot="ecg-trace-grid"
            className="stroke-[color:var(--ecg-grid,var(--color-red-500))]/15"
            strokeWidth={0.5}
            vectorEffect="non-scaling-stroke"
          />
          <path
            d={gridPath(width, height, 5)}
            data-slot="ecg-trace-grid"
            className="stroke-[color:var(--ecg-grid,var(--color-red-500))]/35"
            strokeWidth={1}
            vectorEffect="non-scaling-stroke"
          />
          {calibration && (
            <path
              d={`M1 ${y(0)}H3V${y(1)}H${3 + pulse}V${y(0)}H${4 + pulse}`}
              fill="none"
              className="stroke-foreground"
              strokeWidth={1.5}
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
          )}
          <path
            data-slot="ecg-trace-line"
            d={tracePath(points, x, y)}
            fill="none"
            className="stroke-foreground"
            strokeWidth={1.5}
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
          {labels.map(({ key, wave, x, y }) => (
            <text
              key={key}
              x={x}
              y={y}
              textAnchor="middle"
              fontSize={3}
              className="fill-muted-foreground font-medium"
              aria-hidden="true"
            >
              {wave}
            </text>
          ))}
        </svg>
      </div>
      <p className="text-xs text-muted-foreground">Not for diagnostic use.</p>
    </figure>
  )
}
