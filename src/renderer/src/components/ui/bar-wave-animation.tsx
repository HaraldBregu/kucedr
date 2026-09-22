import { useEffect, useRef } from "react"
import * as THREE from "three"
import { cn } from "@/lib/utils"

const NUM = 140
const MAX_H = 0.132
const CYCLE = 26

const WORDS: [number, number][] = [
  [2.5, 2.0],
  [6.5, 2.8],
  [12, 3.2],
  [17.5, 2.5],
  [22, 2.2],
]

function getAmp(phase: number): number {
  const t = (phase * 0.22) % CYCLE
  let env = 0
  for (const [c, hw] of WORDS) {
    const d = Math.abs(t - c)
    if (d < hw) env = Math.max(env, Math.cos((d / hw) * Math.PI * 0.5))
  }
  if (env < 0.05) return 0.005 + 0.004 * Math.abs(Math.sin(phase * 7.9))
  const micro = 0.25 + 0.75 * Math.abs(Math.sin(phase * 5.1))
  const fine = 0.82 + 0.18 * Math.abs(Math.sin(phase * 11.3 + 0.5))
  return env * micro * fine
}

type BarWaveAnimationProps = {
  active?: boolean
  height?: number
  className?: string
  mediaStream?: MediaStream | null
  analyser?: AnalyserNode | null
}

function readAnalyserAmp(
  analyser: AnalyserNode,
  dataArray: Uint8Array<ArrayBuffer>
): number {
  analyser.getByteTimeDomainData(dataArray)
  let sumSquares = 0

  for (let i = 0; i < dataArray.length; i++) {
    const centered = (dataArray[i] - 128) / 128
    sumSquares += centered * centered
  }

  const rms = Math.sqrt(sumSquares / dataArray.length)
  return rms < 0.015 ? 0.006 : Math.min(1, rms * 5.4)
}

function appendAmp(target: Float32Array, amp: number) {
  target.copyWithin(0, 1)
  target[target.length - 1] = amp
}

function decayAmps(target: Float32Array) {
  for (let i = 0; i < target.length; i++) {
    target[i] = target[i] * 0.82 + 0.006 * 0.18
  }
}

export function BarWaveAnimation({
  active = true,
  height = 80,
  className,
  mediaStream,
  analyser,
}: BarWaveAnimationProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const activeRef = useRef(active)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const dataArrayRef = useRef<Uint8Array<ArrayBuffer> | null>(null)

  useEffect(() => {
    activeRef.current = active
  }, [active])

  useEffect(() => {
    if (analyser) {
      analyserRef.current = analyser
      dataArrayRef.current = new Uint8Array(analyser.fftSize)
      return () => {
        analyserRef.current = null
        dataArrayRef.current = null
      }
    }

    if (!mediaStream) {
      analyserRef.current = null
      dataArrayRef.current = null
      return
    }

    const AudioContextCtor = window.AudioContext
    if (!AudioContextCtor) return

    const audioContext = new AudioContextCtor()
    const source = audioContext.createMediaStreamSource(mediaStream)
    const inputAnalyser = audioContext.createAnalyser()
    inputAnalyser.fftSize = 512
    inputAnalyser.smoothingTimeConstant = 0.72
    source.connect(inputAnalyser)

    analyserRef.current = inputAnalyser
    dataArrayRef.current = new Uint8Array(inputAnalyser.fftSize)
    void audioContext.resume().catch(() => undefined)

    return () => {
      analyserRef.current = null
      dataArrayRef.current = null
      source.disconnect()
      inputAnalyser.disconnect()
      void audioContext.close().catch(() => undefined)
    }
  }, [analyser, mediaStream])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const dpr = Math.min(devicePixelRatio, 2)
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true })
    renderer.setClearColor(0, 0)

    const scene = new THREE.Scene()
    // Fixed Y frustum ±0.15 — larger than MAX_H (0.132) so bars never clip
    const camera = new THREE.OrthographicCamera(-1, 1, 0.15, -0.15, 0.1, 10)
    camera.position.z = 5

    // Center hairline
    const hairGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-1, 0, 0),
      new THREE.Vector3(1, 0, 0),
    ])
    const hairLine = new THREE.Line(
      hairGeo,
      new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.13 })
    )
    scene.add(hairLine)

    // Bars — NUM vertical line segments
    const ampBuf = new Float32Array(NUM).fill(0.007)
    const posArr = new Float32Array(NUM * 6)
    const barGeo = new THREE.BufferGeometry()
    barGeo.setAttribute("position", new THREE.BufferAttribute(posArr, 3))
    const barMesh = new THREE.LineSegments(
      barGeo,
      new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.92 })
    )
    scene.add(barMesh)

    let phase = 0
    let liveAmp = 0.006

    function redraw() {
      const pitch = 2 / NUM
      for (let i = 0; i < NUM; i++) {
        const x = -1 + (i + 0.5) * pitch
        const h = ampBuf[i] * MAX_H
        posArr[i * 6]     = x; posArr[i * 6 + 1] = -h; posArr[i * 6 + 2] = 0
        posArr[i * 6 + 3] = x; posArr[i * 6 + 4] =  h; posArr[i * 6 + 5] = 0
      }
      barGeo.attributes.position.needsUpdate = true
    }

    function resize(w: number) {
      renderer.setSize(w * dpr, height * dpr, false)
    }

    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width
      if (w && w > 0) resize(w)
    })
    ro.observe(canvas)

    const initialW = canvas.getBoundingClientRect().width
    if (initialW > 0) resize(initialW)

    redraw()

    let rafId = 0
    const tick = () => {
      rafId = requestAnimationFrame(tick)
      const analyser = analyserRef.current
      const dataArray = dataArrayRef.current
      if (activeRef.current && analyser && dataArray) {
        const nextAmp = readAnalyserAmp(analyser, dataArray)
        liveAmp = liveAmp * 0.55 + nextAmp * 0.45
        appendAmp(ampBuf, liveAmp)
        redraw()
      } else if (activeRef.current) {
        appendAmp(ampBuf, getAmp(phase))
        phase += 0.22
        redraw()
      } else {
        decayAmps(ampBuf)
        redraw()
      }
      renderer.render(scene, camera)
    }
    rafId = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(rafId)
      ro.disconnect()
      hairGeo.dispose()
      barGeo.dispose()
      renderer.dispose()
    }
  }, [height])

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={cn("block", className)}
      style={{ width: "100%", height }}
    />
  )
}
