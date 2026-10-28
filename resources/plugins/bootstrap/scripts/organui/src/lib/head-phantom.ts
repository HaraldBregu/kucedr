type Ellipsoid = {
  /** Semi-axes, centre and rotation about the vertical axis in degrees, in a -1 to 1 cube. */
  axes: [number, number, number]
  center: [number, number, number]
  angle: number
  /** Added to the value of everything inside, in Hounsfield units. */
  value: number
}

const ELLIPSOIDS: readonly Ellipsoid[] = [
  // Skull, then the brain inside it.
  { axes: [0.69, 0.92, 0.81], center: [0, 0, 0], angle: 0, value: 1800 },
  {
    axes: [0.6624, 0.874, 0.78],
    center: [0, -0.0184, 0],
    angle: 0,
    value: -760,
  },
  // Ventricles.
  { axes: [0.11, 0.31, 0.22], center: [0.22, 0, 0], angle: -18, value: -32 },
  { axes: [0.16, 0.41, 0.28], center: [-0.22, 0, 0], angle: 18, value: -32 },
  // Small lesions.
  { axes: [0.21, 0.25, 0.41], center: [0, 0.35, -0.15], angle: 0, value: 22 },
  { axes: [0.046, 0.046, 0.05], center: [0, 0.1, 0.25], angle: 0, value: 30 },
  { axes: [0.046, 0.046, 0.05], center: [0, -0.1, 0.25], angle: 0, value: 30 },
  {
    axes: [0.046, 0.023, 0.05],
    center: [-0.08, -0.605, 0],
    angle: 0,
    value: 30,
  },
  { axes: [0.023, 0.023, 0.02], center: [0, -0.606, 0], angle: 0, value: 30 },
  {
    axes: [0.023, 0.046, 0.02],
    center: [0.06, -0.605, 0],
    angle: 0,
    value: 30,
  },
]

const AIR = -1000

export type HeadPhantomOptions = {
  /** Pixels per side. Defaults to 128. */
  size?: number
  /** Number of axial slices. Defaults to 32. */
  slices?: number
  /** Standard deviation of the added noise in Hounsfield units. Defaults to 6. */
  noise?: number
}

/**
 * Axial slices of the phantom from the top of the head down, as props for
 * the image viewer: raw values in Hounsfield units and their pixel spacing.
 */
export function createHeadPhantom({
  size = 128,
  slices = 32,
  noise = 6,
}: HeadPhantomOptions = {}) {
  // A fixed seed keeps the noise the same on every render and in tests.
  let seed = 0x2f6b
  const random = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0
    return seed / 2 ** 32
  }
  const gaussian = () =>
    Math.sqrt(-2 * Math.log(1 - random())) * Math.cos(2 * Math.PI * random())
  const shapes = ELLIPSOIDS.map(({ axes, center, angle, value }) => ({
    axes,
    center,
    cos: Math.cos((angle * Math.PI) / 180),
    sin: Math.sin((angle * Math.PI) / 180),
    value,
  }))
  const extent = 0.9
  const result = []
  for (let k = 0; k < slices; k++) {
    // From near the vertex (z = 0.75) to below the skull base (z = -0.75).
    const z = slices === 1 ? 0 : 0.75 - (1.5 * k) / (slices - 1)
    const data = new Int16Array(size * size)
    for (let row = 0; row < size; row++) {
      // Rows run anterior (top of the image) to posterior.
      const y = extent - (2 * extent * (row + 0.5)) / size
      for (let column = 0; column < size; column++) {
        const x = -extent + (2 * extent * (column + 0.5)) / size
        let value = AIR
        for (const shape of shapes) {
          const dx = x - shape.center[0]
          const dy = y - shape.center[1]
          const dz = z - shape.center[2]
          const u = (dx * shape.cos + dy * shape.sin) / shape.axes[0]
          const v = (-dx * shape.sin + dy * shape.cos) / shape.axes[1]
          const w = dz / shape.axes[2]
          if (u * u + v * v + w * w <= 1) value += shape.value
        }
        data[row * size + column] = Math.round(
          value + (value > AIR ? noise * gaussian() : 0)
        )
      }
    }
    result.push({
      data,
      width: size,
      height: size,
      label: `Axial ${k + 1}`,
    })
  }
  // The phantom spans about 240 mm across.
  const spacing = 240 / size
  return {
    slices: result,
    pixelSpacing: [spacing, spacing] as [number, number],
    unit: "HU",
  }
}
