"use client"

import * as React from "react"
import { cn } from "cn"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"
import { Toggle } from "@/components/ui/toggle"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { CircleAlertIcon, ContrastIcon, MoveIcon, PlusIcon, MinusIcon, RotateCcwIcon } from "lucide-react"

/**
 * One image of a stack. Pass raw values, such as Hounsfield units, as `data`
 * in row-major order, or an image URL whose luminance (0 to 255) becomes the
 * value. Image URLs must allow CORS so their pixels can be read.
 */
export type ImageSlice =
  | { src: string; label?: string }
  | {
      data: ArrayLike<number>
      width: number
      height: number
      label?: string
    }

/** Display window: values from center - width / 2 to center + width / 2 map to black through white. */
export type ImageWindow = { center: number; width: number }

export type WindowPreset = ImageWindow & { name: string }

/** Common CT windows in Hounsfield units. */
export const ctWindowPresets: readonly WindowPreset[] = [
  { name: "Brain", center: 40, width: 80 },
  { name: "Soft tissue", center: 50, width: 400 },
  { name: "Lung", center: -600, width: 1500 },
  { name: "Bone", center: 400, width: 1800 },
]

export type ImageViewerHandle = {
  setSlice: (index: number) => void
  zoom: (factor: number) => void
  reset: () => void
}

export type ImageViewerTool = "window" | "pan"

export type ImageViewerProps = Omit<React.ComponentProps<"div">, "ref"> & {
  /** The image slices, each with its width, height and pixel values. */
  slices: readonly ImageSlice[]
  /** Zero-based index of the shown slice, when controlled. */
  slice?: number
  /** The slice shown first, when uncontrolled. */
  defaultSlice?: number
  /** Called with the new slice index. */
  onSliceChange?: (index: number) => void
  /** The window centre and width, when controlled. */
  window?: ImageWindow
  /** Defaults to the first preset, or else the first slice's value range. */
  defaultWindow?: ImageWindow
  /** Called with the new window after a drag or preset. */
  onWindowChange?: (window: ImageWindow) => void
  /** Named windows offered in the toolbar, such as `ctWindowPresets`. */
  presets?: readonly WindowPreset[]
  /** Physical [row, column] spacing, as in DICOM Pixel Spacing, so pixels keep their true aspect. */
  pixelSpacing?: readonly [number, number]
  /** Unit shown after pixel values, such as "HU". */
  unit?: string
  /** Shows the toolbar and slice slider. Defaults to true. */
  controls?: boolean
  /** The accessible name of the image. */
  label?: string
  /** Moves through slices, zooms and resets the view from your own controls. */
  ref?: React.Ref<ImageViewerHandle>
}

/**
 * Maps a value to a gray level from 0 to 255 with the DICOM linear window
 * function (PS3.3 C.11.2.1.2).
 */
export function windowLevel(value: number, { center, width }: ImageWindow) {
  const w = Math.max(width, 1)
  const low = center - 0.5 - (w - 1) / 2
  if (value <= low) return 0
  if (value > center - 0.5 + (w - 1) / 2) return 255
  return ((value - (center - 0.5)) / (w - 1) + 0.5) * 255
}

type Pixels = {
  values: ArrayLike<number>
  width: number
  height: number
  min: number
  max: number
}

function range(values: ArrayLike<number>) {
  let min = Infinity
  let max = -Infinity
  for (let i = 0; i < values.length; i++) {
    const value = values[i]!
    if (value < min) min = value
    if (value > max) max = value
  }
  return { min, max }
}

async function decode(slice: ImageSlice): Promise<Pixels> {
  if ("data" in slice) {
    const { data, width, height } = slice
    if (data.length !== width * height)
      throw new Error(
        `Slice data has ${data.length} values for a ${width} × ${height} image.`
      )
    return { values: data, width, height, ...range(data) }
  }
  const image = new Image()
  image.crossOrigin = "anonymous"
  image.src = slice.src
  try {
    await image.decode()
  } catch {
    throw new Error(`The image at ${slice.src} could not be loaded.`)
  }
  const { naturalWidth: width, naturalHeight: height } = image
  const canvas = document.createElement("canvas")
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext("2d", { willReadFrequently: true })
  if (!context) throw new Error("Canvas is unavailable in this browser.")
  context.drawImage(image, 0, 0)
  const rgba = context.getImageData(0, 0, width, height).data
  const values = new Uint8Array(width * height)
  for (let i = 0; i < values.length; i++)
    values[i] = Math.round(
      0.299 * rgba[i * 4]! + 0.587 * rgba[i * 4 + 1]! + 0.114 * rgba[i * 4 + 2]!
    )
  return { values, width, height, ...range(values) }
}

const MIN_ZOOM = 0.5
const MAX_ZOOM = 16
// Slices ahead and behind the shown one to decode in the background.
const PRELOAD = 3

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

function formatValue(value: number) {
  return Math.abs(value) >= 10 || Number.isInteger(value)
    ? String(Math.round(value))
    : value.toFixed(2)
}

function ToolbarButton({
  label,
  onClick,
  children,
}: {
  label: string
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            aria-label={label}
            onClick={onClick}
          />
        }
      >
        {children}
      </TooltipTrigger>
      <TooltipContent side="bottom">{label}</TooltipContent>
    </Tooltip>
  )
}

function ToolToggle({
  label,
  pressed,
  onPressedChange,
  children,
}: {
  label: string
  pressed: boolean
  onPressedChange: () => void
  children: React.ReactNode
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Toggle
            aria-label={label}
            pressed={pressed}
            onPressedChange={onPressedChange}
          />
        }
      >
        {children}
      </TooltipTrigger>
      <TooltipContent side="bottom">{label}</TooltipContent>
    </Tooltip>
  )
}

export function ImageViewer({
  slices,
  slice: sliceProp,
  defaultSlice = 0,
  onSliceChange,
  window: windowProp,
  defaultWindow,
  onWindowChange,
  presets = [],
  pixelSpacing,
  unit,
  controls = true,
  label = "Medical image",
  className,
  ref,
  ...props
}: ImageViewerProps) {
  const stage = React.useRef<HTMLDivElement>(null)
  const canvas = React.useRef<HTMLCanvasElement>(null)
  const instructions = React.useId()
  const sliceLabel = React.useId()
  const count = slices.length

  const [ownSlice, setOwnSlice] = React.useState(defaultSlice)
  const index = clamp(
    Math.round(sliceProp ?? ownSlice),
    0,
    Math.max(count - 1, 0)
  )
  const changeSlice = React.useCallback(
    (next: number) => {
      const target = clamp(Math.round(next), 0, Math.max(count - 1, 0))
      setOwnSlice(target)
      if (target !== index) onSliceChange?.(target)
    },
    [count, index, onSliceChange]
  )

  // Decoded slices, keyed by the slice objects themselves so new data reloads.
  const cache = React.useRef(new WeakMap<ImageSlice, Promise<Pixels>>())
  const load = React.useCallback((slice: ImageSlice) => {
    let pending = cache.current.get(slice)
    if (!pending) {
      pending = decode(slice)
      pending.catch(() => cache.current.delete(slice))
      cache.current.set(slice, pending)
    }
    return pending
  }, [])
  const [pixels, setPixels] = React.useState<Pixels | null>(null)
  const [attempt, setAttempt] = React.useState(0)
  const [failure, setFailure] = React.useState<{
    slice: ImageSlice
    attempt: number
    message: string
  } | null>(null)
  const [autoWindow, setAutoWindow] = React.useState<ImageWindow | null>(null)
  const current = slices[index]
  const error =
    failure && failure.slice === current && failure.attempt === attempt
      ? failure.message
      : null
  React.useEffect(() => {
    if (!current) return
    let active = true
    load(current).then(
      (result) => {
        if (!active) return
        setPixels(result)
        // Without a window or presets, show the first slice's full range.
        setAutoWindow(
          (previous) =>
            previous ?? {
              center: (result.min + result.max) / 2,
              width: Math.max(result.max - result.min, 1),
            }
        )
        for (let offset = 1; offset <= PRELOAD; offset++)
          for (const neighbour of [
            slices[index + offset],
            slices[index - offset],
          ])
            if (neighbour) load(neighbour).catch(() => {})
      },
      (reason: unknown) => {
        if (active)
          setFailure({
            slice: current,
            attempt,
            message: reason instanceof Error ? reason.message : String(reason),
          })
      }
    )
    return () => {
      active = false
    }
  }, [current, slices, index, load, attempt])

  const [ownWindow, setOwnWindow] = React.useState<ImageWindow | null>(
    defaultWindow ?? presets[0] ?? null
  )
  const shownWindow = windowProp ?? ownWindow ?? autoWindow
  const changeWindow = React.useCallback(
    (next: ImageWindow) => {
      const value = { center: next.center, width: Math.max(next.width, 1) }
      setOwnWindow(value)
      onWindowChange?.(value)
    },
    [onWindowChange]
  )
  const preset =
    presets.find(
      ({ center, width }) =>
        shownWindow &&
        Math.abs(center - shownWindow.center) < 1e-6 &&
        Math.abs(width - shownWindow.width) < 1e-6
    )?.name ?? null

  const [view, setView] = React.useState({ zoom: 1, x: 0, y: 0 })
  const [size, setSize] = React.useState({ width: 0, height: 0 })
  const [tool, setTool] = React.useState<ImageViewerTool>("window")
  const [hover, setHover] = React.useState<{
    x: number
    y: number
    value: number
  } | null>(null)
  const [interacted, setInteracted] = React.useState(false)

  React.useEffect(() => {
    const element = stage.current
    if (!element) return
    const observer = new ResizeObserver(([entry]) => {
      if (entry)
        setSize({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        })
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  // Physical size of a pixel relative to the smaller spacing.
  const [rowSpacing, columnSpacing] = pixelSpacing ?? [1, 1]
  const unitSpacing = Math.min(rowSpacing, columnSpacing)
  const scaleX = columnSpacing / unitSpacing
  const scaleY = rowSpacing / unitSpacing
  const fit = pixels
    ? Math.min(
        size.width / (pixels.width * scaleX),
        size.height / (pixels.height * scaleY)
      )
    : 1

  // The windowed slice, rendered once per slice or window change.
  const bitmap = React.useMemo(() => {
    if (!pixels || !shownWindow || typeof document === "undefined") return null
    const { values, width, height } = pixels
    const element = document.createElement("canvas")
    element.width = width
    element.height = height
    const context = element.getContext("2d")
    if (!context) return null
    const image = context.createImageData(width, height)
    for (let i = 0; i < values.length; i++) {
      const gray = windowLevel(values[i]!, shownWindow)
      image.data[i * 4] = gray
      image.data[i * 4 + 1] = gray
      image.data[i * 4 + 2] = gray
      image.data[i * 4 + 3] = 255
    }
    context.putImageData(image, 0, 0)
    return element
  }, [pixels, shownWindow])

  React.useLayoutEffect(() => {
    const element = canvas.current
    if (!element) return
    const ratio = globalThis.devicePixelRatio || 1
    element.width = Math.round(size.width * ratio)
    element.height = Math.round(size.height * ratio)
    const context = element.getContext("2d")
    if (!context) return
    context.setTransform(1, 0, 0, 1, 0, 0)
    context.fillStyle = "#000"
    context.fillRect(0, 0, element.width, element.height)
    if (!bitmap) return
    const scale = fit * view.zoom
    context.setTransform(
      ratio * scale * scaleX,
      0,
      0,
      ratio * scale * scaleY,
      ratio * (size.width / 2 + view.x),
      ratio * (size.height / 2 + view.y)
    )
    // Show individual pixels once they are large enough to inspect.
    context.imageSmoothingEnabled = scale * Math.min(scaleX, scaleY) < 8
    context.drawImage(bitmap, -bitmap.width / 2, -bitmap.height / 2)
  }, [bitmap, size, fit, view, scaleX, scaleY])

  // Image pixel under a point relative to the stage's top-left corner.
  const pixelAt = (x: number, y: number) => {
    if (!pixels) return null
    const scale = fit * view.zoom
    const column = Math.floor(
      (x - size.width / 2 - view.x) / (scale * scaleX) + pixels.width / 2
    )
    const row = Math.floor(
      (y - size.height / 2 - view.y) / (scale * scaleY) + pixels.height / 2
    )
    if (column < 0 || row < 0 || column >= pixels.width || row >= pixels.height)
      return null
    return {
      x: column,
      y: row,
      value: pixels.values[row * pixels.width + column]!,
    }
  }

  const zoomAt = React.useCallback(
    (factor: number, x = 0, y = 0) =>
      setView((previous) => {
        const zoom = clamp(previous.zoom * factor, MIN_ZOOM, MAX_ZOOM)
        const ratio = zoom / previous.zoom
        return {
          zoom,
          x: x - (x - previous.x) * ratio,
          y: y - (y - previous.y) * ratio,
        }
      }),
    []
  )
  const reset = React.useCallback(() => setView({ zoom: 1, x: 0, y: 0 }), [])

  // Wheel scrolls slices; a pinch or ctrl + wheel zooms at the pointer. React
  // wheel listeners are passive, so this one is added directly.
  const wheel = React.useRef({ changeSlice, index, zoomAt, delta: 0 })
  React.useEffect(() => {
    Object.assign(wheel.current, { changeSlice, index, zoomAt })
  }, [changeSlice, index, zoomAt])
  React.useEffect(() => {
    const element = stage.current
    if (!element) return
    const onWheel = (event: WheelEvent) => {
      event.preventDefault()
      setInteracted(true)
      const state = wheel.current
      const pixels =
        event.deltaMode === WheelEvent.DOM_DELTA_LINE
          ? event.deltaY * 40
          : event.deltaY
      if (event.ctrlKey || event.metaKey) {
        const box = element.getBoundingClientRect()
        state.zoomAt(
          Math.exp(-pixels / 200),
          event.clientX - box.left - box.width / 2,
          event.clientY - box.top - box.height / 2
        )
        return
      }
      state.delta += pixels
      const steps = Math.trunc(state.delta / 40)
      if (steps) {
        state.delta -= steps * 40
        state.changeSlice(state.index + steps)
      }
    }
    element.addEventListener("wheel", onWheel, { passive: false })
    return () => element.removeEventListener("wheel", onWheel)
  }, [])

  const pointers = React.useRef(new Map<number, { x: number; y: number }>())
  const drag = React.useRef<{
    mode: ImageViewerTool | "pinch"
    window: ImageWindow | null
    distance: number
  } | null>(null)

  const local = (event: React.PointerEvent) => {
    const box = event.currentTarget.getBoundingClientRect()
    return { x: event.clientX - box.left, y: event.clientY - box.top }
  }

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    // Only the image itself drags; the toolbar and messages keep their own
    // pointer handling.
    if (
      !pixels ||
      event.target !== canvas.current ||
      (event.pointerType === "mouse" && event.button > 1)
    )
      return
    event.currentTarget.setPointerCapture(event.pointerId)
    pointers.current.set(event.pointerId, local(event))
    setInteracted(true)
    setHover(null)
    const points = [...pointers.current.values()]
    if (points.length === 2) {
      drag.current = {
        mode: "pinch",
        window: null,
        distance: Math.hypot(
          points[0]!.x - points[1]!.x,
          points[0]!.y - points[1]!.y
        ),
      }
      return
    }
    drag.current = {
      mode:
        event.button === 1 || event.shiftKey || tool === "pan"
          ? "pan"
          : "window",
      window: shownWindow,
      distance: 0,
    }
  }

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const point = local(event)
    const previous = pointers.current.get(event.pointerId)
    if (!previous || !drag.current) {
      if (event.pointerType === "mouse") setHover(pixelAt(point.x, point.y))
      return
    }
    pointers.current.set(event.pointerId, point)
    const dx = point.x - previous.x
    const dy = point.y - previous.y
    const state = drag.current
    if (state.mode === "pinch") {
      const points = [...pointers.current.values()]
      if (points.length < 2) return
      const distance = Math.hypot(
        points[0]!.x - points[1]!.x,
        points[0]!.y - points[1]!.y
      )
      if (state.distance > 0)
        zoomAt(
          distance / state.distance,
          (points[0]!.x + points[1]!.x) / 2 - size.width / 2,
          (points[0]!.y + points[1]!.y) / 2 - size.height / 2
        )
      state.distance = distance
    } else if (state.mode === "pan") {
      setView((view) => ({ ...view, x: view.x + dx, y: view.y + dy }))
    } else if (state.window) {
      // Right widens the window and down raises the level, in proportion to
      // the current width so narrow and wide windows both feel responsive.
      const step = Math.max(state.window.width, 1) / 200
      state.window = {
        center: state.window.center + dy * step,
        width: state.window.width * Math.exp(dx / 200),
      }
      changeWindow(state.window)
    }
  }

  const onPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    pointers.current.delete(event.pointerId)
    if (pointers.current.size === 0) drag.current = null
    else if (drag.current?.mode === "pinch")
      drag.current = { mode: "pan", window: null, distance: 0 }
  }

  React.useImperativeHandle(
    ref,
    () => ({ setSlice: changeSlice, zoom: (factor) => zoomAt(factor), reset }),
    [changeSlice, zoomAt, reset]
  )

  const message =
    count === 0
      ? { title: "No images", text: "This series has no slices to show." }
      : error
        ? {
            title: "The image couldn’t load",
            text: `${error} Check your connection and try again.`,
          }
        : null
  const unitText = unit ? ` ${unit}` : ""
  const name = current?.label

  return (
    <div
      data-slot="image-viewer"
      className={cn(
        "flex h-[28rem] w-full flex-col overflow-hidden rounded-xl border bg-background text-sm text-foreground",
        className
      )}
      {...props}
    >
      {/* The stage stays black in both themes, as reading rooms do, so the
          overlays on it are white rather than theme tokens. */}
      <div
        ref={stage}
        role="region"
        aria-label={label}
        aria-describedby={instructions}
        tabIndex={0}
        className="relative min-h-0 flex-1 touch-none overflow-hidden bg-black select-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
        style={{
          cursor: !pixels ? undefined : tool === "pan" ? "grab" : "crosshair",
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onPointerLeave={() => setHover(null)}
        onKeyDown={(event) => {
          if (event.target !== event.currentTarget) return
          const actions: Record<string, () => void> = {
            ArrowUp: () => changeSlice(index - 1),
            ArrowDown: () => changeSlice(index + 1),
            PageUp: () => changeSlice(index - 10),
            PageDown: () => changeSlice(index + 10),
            Home: () => changeSlice(0),
            End: () => changeSlice(count - 1),
            "+": () => zoomAt(1.25),
            "=": () => zoomAt(1.25),
            "-": () => zoomAt(0.8),
            "0": reset,
          }
          const action = actions[event.key]
          if (!action) return
          event.preventDefault()
          setInteracted(true)
          action()
        }}
      >
        <p id={instructions} className="sr-only">
          Use the up and down arrow keys or scroll to move through slices, and
          plus, minus and zero to zoom and reset. Drag to adjust the window, or
          to pan when the pan tool is on.
        </p>
        <canvas
          ref={canvas}
          role="img"
          aria-label={
            count
              ? `${label}, slice ${index + 1} of ${count}${name ? `, ${name}` : ""}`
              : label
          }
          className="absolute inset-0 size-full"
        />
        {message ? (
          <div className="absolute inset-0 flex items-center justify-center p-6">
            <Alert className="max-w-sm">
              <CircleAlertIcon aria-hidden="true" />
              <AlertTitle>{message.title}</AlertTitle>
              <AlertDescription>
                <p>{message.text}</p>
                {error && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setAttempt((n) => n + 1)}
                    className="mt-3 text-foreground"
                  >
                    Try again
                  </Button>
                )}
              </AlertDescription>
            </Alert>
          </div>
        ) : !pixels ? (
          <div
            role="status"
            className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-white/80"
          >
            <Progress
              value={null}
              aria-label="Loading image"
              className="w-40"
            />
            <p>Loading image</p>
          </div>
        ) : null}
        {pixels && (
          <>
            <div
              aria-hidden="true"
              className="pointer-events-none absolute bottom-2 left-3 flex flex-col text-xs text-white/85 tabular-nums [text-shadow:0_1px_2px_#000]"
            >
              <span>
                {name ? `${name} · ` : ""}
                {index + 1} / {count}
              </span>
              {hover && (
                <span>
                  {hover.x}, {hover.y} · {formatValue(hover.value)}
                  {unitText}
                </span>
              )}
              {shownWindow && (
                <span>
                  W {formatValue(shownWindow.width)} · L{" "}
                  {formatValue(shownWindow.center)}
                </span>
              )}
            </div>
            <span
              aria-hidden="true"
              className="pointer-events-none absolute right-3 bottom-2 text-xs text-white/85 tabular-nums [text-shadow:0_1px_2px_#000]"
            >
              {Math.round(view.zoom * 100)}%
            </span>
            {!interacted && (
              <p
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-0 bottom-16 hidden text-center text-xs text-white/70 [text-shadow:0_1px_2px_#000] sm:block"
              >
                Scroll for slices · Drag to window · Ctrl + scroll to zoom
              </p>
            )}
          </>
        )}
        {pixels && controls && (
          <TooltipProvider>
            <div
              role="toolbar"
              aria-label="Image controls"
              className="absolute top-2 right-2 flex max-w-[calc(100%-1rem)] flex-wrap items-center justify-end gap-0.5 rounded-lg border bg-background/90 p-1 shadow-sm backdrop-blur"
            >
              {presets.length > 0 && (
                <Select
                  value={preset}
                  onValueChange={(next) => {
                    const match = presets.find(({ name }) => name === next)
                    if (match)
                      changeWindow({ center: match.center, width: match.width })
                  }}
                >
                  <SelectTrigger
                    aria-label="Window preset"
                    className="border-transparent"
                  >
                    <SelectValue placeholder="Custom" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {presets.map(({ name }) => (
                        <SelectItem key={name} value={name}>
                          {name}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              )}
              <ToolToggle
                label="Window tool"
                pressed={tool === "window"}
                onPressedChange={() => setTool("window")}
              >
                <ContrastIcon aria-hidden="true" />
              </ToolToggle>
              <ToolToggle
                label="Pan tool"
                pressed={tool === "pan"}
                onPressedChange={() => setTool("pan")}
              >
                <MoveIcon aria-hidden="true" />
              </ToolToggle>
              <ToolbarButton label="Zoom in" onClick={() => zoomAt(1.25)}>
                <PlusIcon aria-hidden="true" />
              </ToolbarButton>
              <ToolbarButton label="Zoom out" onClick={() => zoomAt(0.8)}>
                <MinusIcon aria-hidden="true" />
              </ToolbarButton>
              <ToolbarButton label="Reset view" onClick={reset}>
                <RotateCcwIcon aria-hidden="true" />
              </ToolbarButton>
            </div>
          </TooltipProvider>
        )}
      </div>
      {controls && count > 1 && (
        <div className="flex items-center gap-3 border-t px-3 py-2.5">
          <span id={sliceLabel} className="text-xs font-medium">
            Slice
          </span>
          <Slider
            aria-labelledby={sliceLabel}
            min={1}
            max={count}
            // An array, so shadcn's slider renders a single thumb.
            value={[index + 1]}
            onValueChange={(next) =>
              changeSlice((Array.isArray(next) ? next[0]! : next) - 1)
            }
            className="flex-1"
          />
          <span className="min-w-14 text-right text-xs text-muted-foreground tabular-nums">
            {index + 1} / {count}
          </span>
        </div>
      )}
    </div>
  )
}
