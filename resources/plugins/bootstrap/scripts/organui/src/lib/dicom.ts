export type DicomImage = {
  /** Modality values (Hounsfield units for CT): stored values after rescale slope and intercept. */
  data: Float32Array
  width: number
  height: number
  /** [row, column] spacing in millimetres, from Pixel Spacing. */
  pixelSpacing?: [number, number]
  /** The first Window Center and Width stored in the file. */
  window?: { center: number; width: number }
  /** Image Position (Patient), Slice Location and Instance Number, used to order a series. */
  position?: [number, number, number]
  sliceLocation?: number
  instanceNumber?: number
  modality?: string
  label?: string
}

const IMPLICIT_LITTLE = "1.2.840.10008.1.2"
const EXPLICIT_LITTLE = "1.2.840.10008.1.2.1"
// Explicit VRs with a reserved two bytes and a four-byte length.
const LONG_VRS = new Set([
  "OB",
  "OD",
  "OF",
  "OL",
  "OV",
  "OW",
  "SQ",
  "SV",
  "UC",
  "UN",
  "UR",
  "UT",
  "UV",
])
const UNDEFINED = 0xffffffff
const ITEM = 0xfffee000
const ITEM_END = 0xfffee00d
const SEQUENCE_END = 0xfffee0dd

const tag = (group: number, element: number) => ((group << 16) | element) >>> 0

const TAGS = {
  modality: tag(0x0008, 0x0060),
  seriesDescription: tag(0x0008, 0x103e),
  instanceNumber: tag(0x0020, 0x0013),
  position: tag(0x0020, 0x0032),
  sliceLocation: tag(0x0020, 0x1041),
  samplesPerPixel: tag(0x0028, 0x0002),
  photometric: tag(0x0028, 0x0004),
  frames: tag(0x0028, 0x0008),
  rows: tag(0x0028, 0x0010),
  columns: tag(0x0028, 0x0011),
  pixelSpacing: tag(0x0028, 0x0030),
  bitsAllocated: tag(0x0028, 0x0100),
  bitsStored: tag(0x0028, 0x0101),
  pixelRepresentation: tag(0x0028, 0x0103),
  windowCenter: tag(0x0028, 0x1050),
  windowWidth: tag(0x0028, 0x1051),
  intercept: tag(0x0028, 0x1052),
  slope: tag(0x0028, 0x1053),
  pixelData: tag(0x7fe0, 0x0010),
}

type Element = { offset: number; length: number }

function parseElements(view: DataView, start: number, explicit: boolean) {
  const elements = new Map<number, Element>()
  const text = (offset: number) =>
    String.fromCharCode(view.getUint8(offset), view.getUint8(offset + 1))

  // Returns the offset after the element at `offset`, recording top-level ones.
  const read = (offset: number, record: boolean) => {
    const id = tag(
      view.getUint16(offset, true),
      view.getUint16(offset + 2, true)
    )
    let length: number
    let vr: string | null = null
    let cursor = offset + 4
    if (id === ITEM || id === ITEM_END || id === SEQUENCE_END) {
      length = view.getUint32(cursor, true)
      cursor += 4
    } else if (explicit) {
      vr = text(cursor)
      if (LONG_VRS.has(vr)) {
        length = view.getUint32(cursor + 4, true)
        cursor += 8
      } else {
        length = view.getUint16(cursor + 2, true)
        cursor += 4
      }
    } else {
      length = view.getUint32(cursor, true)
      cursor += 4
    }
    if (length === UNDEFINED) {
      if (id === tag(0x7fe0, 0x0010))
        throw new Error(
          "Compressed (encapsulated) pixel data is not supported."
        )
      cursor = skipUndefined(cursor)
      return cursor
    }
    if (record) elements.set(id, { offset: cursor, length })
    return cursor + length
  }

  // Skips an undefined-length sequence or item up to its delimiter.
  const skipUndefined = (offset: number): number => {
    let cursor = offset
    while (cursor + 8 <= view.byteLength) {
      const id = tag(
        view.getUint16(cursor, true),
        view.getUint16(cursor + 2, true)
      )
      if (id === SEQUENCE_END || id === ITEM_END) return cursor + 8
      if (id === ITEM) {
        const length = view.getUint32(cursor + 4, true)
        cursor =
          length === UNDEFINED ? skipUndefined(cursor + 8) : cursor + 8 + length
        continue
      }
      cursor = read(cursor, false)
    }
    throw new Error("The file ends inside a sequence.")
  }

  let cursor = start
  while (cursor + 8 <= view.byteLength) {
    cursor = read(cursor, true)
  }
  return elements
}

/** Reads one DICOM file (Part 10, with its 128-byte preamble) into raw values. */
export function parseDicom(buffer: ArrayBuffer): DicomImage {
  const view = new DataView(buffer)
  const bytes = new Uint8Array(buffer)
  const magic = String.fromCharCode(...bytes.subarray(128, 132))
  if (magic !== "DICM") throw new Error("This is not a DICOM Part 10 file.")

  const decoder = new TextDecoder("latin1")
  const decode = (offset: number, length: number) =>
    decoder
      .decode(bytes.subarray(offset, offset + length))
      .replace(/[\0\s]+$/, "")
      .trim()
  // The meta group (0002) is always explicit little endian and states the
  // transfer syntax of the dataset after it.
  let syntax = EXPLICIT_LITTLE
  let start = 132
  while (start + 8 <= view.byteLength && view.getUint16(start, true) === 2) {
    const vr = String.fromCharCode(bytes[start + 4]!, bytes[start + 5]!)
    const long = LONG_VRS.has(vr)
    const length = long
      ? view.getUint32(start + 8, true)
      : view.getUint16(start + 6, true)
    const value = start + (long ? 12 : 8)
    if (view.getUint16(start + 2, true) === 0x0010)
      syntax = decode(value, length)
    start = value + length
  }
  if (syntax !== IMPLICIT_LITTLE && syntax !== EXPLICIT_LITTLE)
    throw new Error(
      `Transfer syntax ${syntax} is not supported. Only uncompressed little endian files can be read.`
    )
  const elements = parseElements(view, start, syntax === EXPLICIT_LITTLE)

  const string = (id: number) => {
    const element = elements.get(id)
    return element ? decode(element.offset, element.length) : undefined
  }
  const uint16 = (id: number) => {
    const element = elements.get(id)
    return element ? view.getUint16(element.offset, true) : undefined
  }
  const numbers = (id: number) =>
    string(id)
      ?.split("\\")
      .map(Number)
      .filter((value) => Number.isFinite(value))

  const width = uint16(TAGS.columns)
  const height = uint16(TAGS.rows)
  const bitsAllocated = uint16(TAGS.bitsAllocated) ?? 16
  const signed = uint16(TAGS.pixelRepresentation) === 1
  const pixelData = elements.get(TAGS.pixelData)
  if (!width || !height || !pixelData) throw new Error("The file has no image.")
  if ((uint16(TAGS.samplesPerPixel) ?? 1) !== 1)
    throw new Error("Only grayscale images are supported.")
  if (Number(string(TAGS.frames) ?? 1) > 1)
    throw new Error("Multi-frame images are not supported.")
  if (bitsAllocated !== 8 && bitsAllocated !== 16)
    throw new Error(`${bitsAllocated}-bit pixels are not supported.`)

  const count = width * height
  if (pixelData.length < count * (bitsAllocated / 8))
    throw new Error("The pixel data is shorter than the image.")
  const bitsStored = uint16(TAGS.bitsStored) ?? bitsAllocated
  const slope = numbers(TAGS.slope)?.[0] ?? 1
  const intercept = numbers(TAGS.intercept)?.[0] ?? 0
  const photometric = string(TAGS.photometric) ?? "MONOCHROME2"
  if (photometric !== "MONOCHROME1" && photometric !== "MONOCHROME2")
    throw new Error(`${photometric} images are not supported.`)
  // MONOCHROME1 shows low values as white; negate so the viewer's black-to-
  // white window keeps the same appearance.
  const sign = photometric === "MONOCHROME1" ? -1 : 1
  const data = new Float32Array(count)
  const shift = 32 - bitsStored
  for (let i = 0; i < count; i++) {
    let stored =
      bitsAllocated === 8
        ? bytes[pixelData.offset + i]!
        : view.getUint16(pixelData.offset + i * 2, true)
    // Keep only the stored bits, sign-extending when they are signed.
    stored = signed ? (stored << shift) >> shift : (stored << shift) >>> shift
    data[i] = sign * (stored * slope + intercept)
  }

  const image: DicomImage = { data, width, height }
  const spacing = numbers(TAGS.pixelSpacing)
  if (spacing?.length === 2) image.pixelSpacing = [spacing[0]!, spacing[1]!]
  const center = numbers(TAGS.windowCenter)?.[0]
  const windowWidth = numbers(TAGS.windowWidth)?.[0]
  if (center !== undefined && windowWidth !== undefined)
    image.window = { center: sign * center, width: windowWidth }
  const position = numbers(TAGS.position)
  if (position?.length === 3)
    image.position = [position[0]!, position[1]!, position[2]!]
  const location = numbers(TAGS.sliceLocation)?.[0]
  if (location !== undefined) image.sliceLocation = location
  const instance = numbers(TAGS.instanceNumber)?.[0]
  if (instance !== undefined) image.instanceNumber = instance
  const modality = string(TAGS.modality)
  if (modality) image.modality = modality
  const description = string(TAGS.seriesDescription)
  if (description) image.label = description
  return image
}

/**
 * Orders the images of one series from head to foot (or by Slice Location,
 * then Instance Number) and returns props for the image viewer.
 */
export function dicomSeries(images: readonly DicomImage[]) {
  const key = (image: DicomImage) =>
    image.position
      ? -image.position[2]
      : image.sliceLocation !== undefined
        ? -image.sliceLocation
        : (image.instanceNumber ?? 0)
  const slices = [...images].sort((a, b) => key(a) - key(b))
  const first = slices[0]
  return {
    slices,
    pixelSpacing: first?.pixelSpacing,
    window: first?.window,
    unit: first?.modality === "CT" ? "HU" : undefined,
  }
}
