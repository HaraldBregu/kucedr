import * as React from "react"
import { cn } from "cn"

import { Button } from "@/components/ui/button"
import { toggleVariants } from "@/components/ui/toggle"

export type DermatomeView = "front" | "back"
export type DermatomeRegion = "Cervical" | "Thoracic" | "Lumbar" | "Sacral"

/**
 * The 28 sensory levels of the International Standards for Neurological
 * Classification of Spinal Cord Injury (ISNCSCI), C2 to S4-5. The key point is
 * where the standards test each level.
 */
export const dermatomes = [
  {
    id: "C2",
    region: "Cervical",
    area: "Back of the scalp and the angle of the jaw",
    keyPoint: "At least 1 cm lateral to the occipital protuberance",
  },
  {
    id: "C3",
    region: "Cervical",
    area: "Neck, down to the collarbone",
    keyPoint: "Supraclavicular fossa, at the midclavicular line",
  },
  {
    id: "C4",
    region: "Cervical",
    area: "Top of the shoulder and upper chest",
    keyPoint: "Over the acromioclavicular joint",
  },
  {
    id: "C5",
    region: "Cervical",
    area: "Outer upper arm",
    keyPoint:
      "Lateral side of the antecubital fossa, just above the elbow crease",
  },
  {
    id: "C6",
    region: "Cervical",
    area: "Outer forearm and thumb",
    keyPoint: "Thumb, dorsal surface of the proximal phalanx",
  },
  {
    id: "C7",
    region: "Cervical",
    area: "Middle finger and the middle of the back of the forearm",
    keyPoint: "Middle finger, dorsal surface of the proximal phalanx",
  },
  {
    id: "C8",
    region: "Cervical",
    area: "Little finger and the inner side of the hand and wrist",
    keyPoint: "Little finger, dorsal surface of the proximal phalanx",
  },
  {
    id: "T1",
    region: "Thoracic",
    area: "Inner forearm and elbow",
    keyPoint:
      "Medial side of the antecubital fossa, just above the medial epicondyle",
  },
  {
    id: "T2",
    region: "Thoracic",
    area: "Inner upper arm, armpit and upper chest",
    keyPoint: "Apex of the axilla",
  },
  {
    id: "T3",
    region: "Thoracic",
    area: "Chest band below the T2 level",
    keyPoint: "Third intercostal space, midclavicular line",
  },
  {
    id: "T4",
    region: "Thoracic",
    area: "Chest band at the nipples",
    keyPoint: "Fourth intercostal space (nipple line), midclavicular line",
  },
  {
    id: "T5",
    region: "Thoracic",
    area: "Chest band between the nipples and the xiphoid",
    keyPoint: "Fifth intercostal space, midclavicular line",
  },
  {
    id: "T6",
    region: "Thoracic",
    area: "Band at the xiphoid process",
    keyPoint: "Level of the xiphisternum, midclavicular line",
  },
  {
    id: "T7",
    region: "Thoracic",
    area: "Upper abdomen band",
    keyPoint: "Midway between T6 and T8, midclavicular line",
  },
  {
    id: "T8",
    region: "Thoracic",
    area: "Upper abdomen band",
    keyPoint: "Midway between T6 and T10, midclavicular line",
  },
  {
    id: "T9",
    region: "Thoracic",
    area: "Abdomen band above the navel",
    keyPoint: "Midway between T8 and T10, midclavicular line",
  },
  {
    id: "T10",
    region: "Thoracic",
    area: "Band at the navel",
    keyPoint: "Umbilicus, midclavicular line",
  },
  {
    id: "T11",
    region: "Thoracic",
    area: "Lower abdomen band",
    keyPoint: "Midway between T10 and T12, midclavicular line",
  },
  {
    id: "T12",
    region: "Thoracic",
    area: "Lower abdomen, down to the groin crease",
    keyPoint: "Midpoint of the inguinal ligament",
  },
  {
    id: "L1",
    region: "Lumbar",
    area: "Groin and the top of the thigh",
    keyPoint: "Half the distance between T12 and L2",
  },
  {
    id: "L2",
    region: "Lumbar",
    area: "Front and inner thigh",
    keyPoint:
      "Anterior medial thigh, halfway from the inguinal ligament to the medial femoral condyle",
  },
  {
    id: "L3",
    region: "Lumbar",
    area: "Lower thigh and the inner knee",
    keyPoint: "Medial femoral condyle, just above the knee",
  },
  {
    id: "L4",
    region: "Lumbar",
    area: "Inner leg and the medial ankle",
    keyPoint: "Medial malleolus",
  },
  {
    id: "L5",
    region: "Lumbar",
    area: "Outer leg and the top of the foot",
    keyPoint: "Dorsum of the foot at the third metatarsophalangeal joint",
  },
  {
    id: "S1",
    region: "Sacral",
    area: "Outer edge of the foot, heel and back of the calf",
    keyPoint: "Lateral heel (calcaneus)",
  },
  {
    id: "S2",
    region: "Sacral",
    area: "Back of the thigh and the knee",
    keyPoint: "Midpoint of the popliteal fossa",
  },
  {
    id: "S3",
    region: "Sacral",
    area: "Inner buttock",
    keyPoint: "Ischial tuberosity or infragluteal fold",
  },
  {
    id: "S4-5",
    region: "Sacral",
    area: "Around the anus",
    keyPoint:
      "Perianal area, less than 1 cm lateral to the mucocutaneous junction",
  },
] as const satisfies readonly {
  id: string
  region: DermatomeRegion
  area: string
  keyPoint: string
}[]

export type DermatomeId = (typeof dermatomes)[number]["id"]
export type Dermatome = (typeof dermatomes)[number]

export type DermatomeMapProps = React.ComponentProps<"div"> & {
  /** The selected dermatome, such as L4, or null. */
  selectedId: DermatomeId | null
  /** Called with the dermatome a reader selects, or null. */
  onSelectionChange: (id: DermatomeId | null) => void
  /** Defaults to both views, front first. */
  views?: readonly DermatomeView[]
  /** CSS colors by level, for example to show sensory test results. */
  colors?: Partial<Record<DermatomeId, string>>
  /** Defaults to true. Labels show once a figure is at least 16rem wide. */
  showLabels?: boolean
  /** The accessible name of the map. */
  label?: string
}

type Shape = {
  d: string
  label?: readonly [number, number]
  point?: readonly [number, number]
}
type ViewShapes = {
  outline: string
  /** The face and crown, supplied by the trigeminal nerve. */
  unassigned: string
  regions: Partial<Record<DermatomeId, Shape>>
}

const regionHues: Record<DermatomeRegion, number> = {
  Cervical: 245,
  Thoracic: 170,
  Lumbar: 75,
  Sacral: 350,
}

/** The default fill: one hue per region, alternating lightness by level. */
export function dermatomeColor(id: DermatomeId) {
  const index = dermatomes.findIndex((dermatome) => dermatome.id === id)
  const { region } = dermatomes[index]!
  return `oklch(${index % 2 ? 0.8 : 0.68} 0.11 ${regionHues[region]})`
}

const viewNames: Record<DermatomeView, string> = {
  front: "Front",
  back: "Back",
}
const regions: DermatomeRegion[] = ["Cervical", "Thoracic", "Lumbar", "Sacral"]
// Shapes cover the viewer's right half of each figure; the left half mirrors it.
const mirror = "matrix(-1 0 0 1 220 0)"

const shapes: Record<DermatomeView, ViewShapes> = {
  front: {
    outline:
      "M127.9 31.7 126.5 24.7 123.3 18.5 121.4 16.2 118.9 14 113.9 11.5 110.9 11 108.2 11.1 103.1 12.7 100.4 14.6 98.2 16.6 94.6 22.2 92.4 29 92 32.9 92.1 36.8 93.2 42.3 95 46.8 97.6 50.7 101 53.9 100.3 62.5 99.1 67.6 97.7 70.3 94.7 72.8 75.5 79.2 71.2 81.1 67.9 84.1 66.1 86.6 64.7 89.2 63.9 93.7 58 107.3 53.8 120.5 42.1 180 32.3 221.9 28.8 233.5 22.3 247.9 21 254 21 257.6 22.1 265.8 26 283 39 284 42.9 268.2 45 257 45.2 250.9 44.6 242.2 44.6 235.7 46.6 223.4 55.3 189.3 70.6 139.5 72.6 131.1 74.5 117.6 75 140 80.5 179.4 81 190 80.4 195.5 78.8 203.9 69.9 239.7 70.5 242.9 69.2 260.8 69 270 70.1 285.8 72.6 306.5 76.1 330.2 77 340 77 349.6 75.7 369.1 76 380 77.7 392.8 82.7 420.8 84 432 83.4 440 82.7 443.1 79.9 450.5 79 455 79.1 457.4 80 461.9 83 470 101 470 103.9 461.9 104.9 457.4 104.9 452.7 102.4 443.1 101.3 436.3 101 426.8 103 380 105 302 106.5 281.4 108.4 265.7 110 266 111.6 265.7 113.8 284.3 115.2 306.2 117 380 119 426.8 118.7 436.3 117.6 443.1 115.1 452.7 115.1 457.4 116.1 461.9 119 470 137 470 140.5 459.7 141 455 140.7 452.7 136.6 440 136 432 137.3 420.8 142.3 392.8 144 380 144.3 369.1 143 349.6 143 340 143.9 330.2 147.4 306.5 149.9 285.8 151 270 150.8 260.8 149.5 242.9 150.1 239.7 141.2 203.9 139.6 195.5 139 190 139.5 179.4 145 140 145.5 117.6 147.4 131.1 149.4 139.5 164.7 189.3 173.4 223.4 175.4 235.7 175.4 242.2 174.8 250.9 175 257 177.1 268.2 181 284 194 283 197.1 270 198.6 261.6 199 254 198.6 250.8 196.7 245.2 191.2 233.5 188.9 226.1 185.4 212.9 176.9 175.2 166.2 120.5 162 107.3 156.1 93.7 155.3 89.2 153.9 86.6 152.1 84.1 148.8 81.1 144.5 79.2 125.3 72.8 122.3 70.3 120.9 67.6 119.7 62.5 119 53.9 123 49.9 126.1 44.3 127.7 38.5Z",
    unassigned:
      "M128 33.4 127.6 29 126.6 25.2 125 21.2 122.7 17.7 120 14.9 116.9 12.8 113.5 11.4 110 11 110 57 113.5 56.6 116.9 55.2 120 53.1 122.7 50.3 125 46.8 126.6 42.8 127.7 37.9Z",
    regions: {
      C2: { d: "M119.6 62 119 53.9 114.8 56.2 110 57 110 62Z" },
      C3: {
        d: "M138.4 77.2 128.6 74.1 124 72 122.2 70.4 121.2 68.6 119.6 62 110 62 110 80Z",
        label: [116.3, 72.9],
        point: [128, 76],
      },
      C4: {
        d: "M153 87 145 113 145.1 113.9 151 102.3 156 93.7 155.2 92 155.5 92.6 156 92.5 155.7 90.6 153.9 86.6 151.1 83 148.8 81.1 146 79.8 138.4 77.2 110 80 110 96 151.2 92.9Z",
        label: [137.2, 85.6],
        point: [148, 84],
      },
      C5: {
        d: "M156 93.7 149.7 105 155.7 126 160.1 144.6 161 144.2 165.9 164.4 165 164.5 174.6 163.6 166.2 120.5 162 107.3Z",
        label: [159.2, 117],
        point: [169.1, 150.7],
      },
      C6: {
        d: "M174.6 163.6 165 164.5 177.1 208.8 182.5 231 184.6 230.7 190.4 255.1 189.3 283.4 194 283 197.1 270 198.6 261.6 199 254 198.5 250.8 196.7 245.2 191.2 233.5 188.9 226.1 181 194Z",
        label: [170.9, 168.6],
      },
      C7: {
        d: "M184.6 230.7 179.8 231.4 182.7 256 185.2 283.7 189.3 283.4 190.4 255.1Z",
      },
      C8: {
        d: "M177.1 208.8 170 209.2 173.4 223.4 175.4 235.7 174.8 253.9 175.5 260.5 181 284 185.2 283.7 182.7 256 179.8 231.4 182.5 231Z",
        label: [178.9, 257.1],
      },
      T1: {
        d: "M161 144.2 152.1 148.5 163.3 184.6 170 209.2 176.8 208.8 165 164.5 165.9 164.4Z",
        label: [157.7, 150.9],
        point: [156.6, 153.7],
      },
      T2: {
        d: "M110 108 147.1 106.1 151.2 92.9 110 96ZM145.1 113.9 148 134 152.1 148.5 160.1 144.6 155.7 125.9 149.7 105 145.9 112.1Z",
        label: [142.3, 100],
        point: [146.2, 112.6],
      },
      T3: {
        d: "M145.5 117.2 145 113 147.1 106.1 110 108 110 119Z",
        label: [128.6, 112.6],
        point: [130, 113],
      },
      T4: {
        d: "M145.3 128.2 145.5 117.2 110 119 110 130Z",
        label: [127.8, 123.6],
        point: [130, 124],
      },
      T5: {
        d: "M145.1 138.2 145.3 128.2 110 130 110 140Z",
        label: [127.7, 134.1],
        point: [130, 135],
      },
      T6: {
        d: "M144 148.3 145.1 138.2 110 140 110 150Z",
        label: [127.6, 144.1],
        point: [130, 145],
      },
      T7: {
        d: "M142.4 158.4 144 148.3 110 150 110 160Z",
        label: [127, 154.2],
        point: [130, 155],
      },
      T8: {
        d: "M140.9 168.5 142.4 158.4 110 160 110 170Z",
        label: [126.2, 164.2],
        point: [130, 165],
      },
      T9: {
        d: "M139.7 177.8 140.9 168.5 110 170 110 180Z",
        label: [116.4, 174.6],
        point: [130, 175],
      },
      T10: {
        d: "M139 190.4 139 184.6 139.7 177.8 110 180 110 194Z",
        label: [117.5, 186.2],
        point: [130, 186],
      },
      T11: {
        d: "M140.7 201.9 139 190.4 110 194 110 208Z",
        label: [117.1, 199.8],
        point: [130, 196],
      },
      T12: {
        d: "M144 216.1 140.7 201.9 110 208 110 228Z",
        label: [119.2, 215.3],
        point: [131, 211],
      },
      L1: {
        d: "M112.2 265.6 111.6 265.7 112.8 274.6 121.4 270 131.2 262.9 140.9 253.9 149.7 244.3 149.5 242.9 149 244 150.1 241 149.9 238.4 144 216.1 110 228 110 266 110.6 265.9 111.3 265.7Z",
        label: [128.1, 240.9],
        point: [130, 224],
      },
      L2: {
        d: "M126.3 266.6 121.4 270 112.8 274.6 114.6 294.4 115.5 317.1 131.5 302 149.6 288.9 150.6 278 151 270 150.8 260.8 149.7 244.3 140.9 253.9 136 258.6Z",
        label: [130.1, 283.3],
        point: [128.2, 289.2],
      },
      L3: {
        d: "M131.5 302 115.5 317.1 116.3 352 129.5 340 144 328.9 147.4 306.4 149.6 288.9Z",
        label: [130.9, 321.3],
        point: [119.3, 342],
      },
      L4: {
        d: "M135.3 335.4 116.3 352 117 380 118.9 420.8 119 432 118.2 440 115.6 450.5 115 455 116.1 461.9 119 470 122.6 470 120.5 457 120.4 452.7 122 436.6 125.5 432 128.2 404.4 131.5 377.6 134.2 342.3Z",
        label: [124.7, 355.8],
        point: [120.2, 432],
      },
      L5: {
        d: "M144 328.9 135.3 335.4 134.2 342.3 131.5 377.6 128.2 404.4 125.5 432 122 436.6 120.4 452.7 120.5 457 122.6 470 133.4 470 135.5 457 135.5 452.7 133.2 436.6 136 435.1 136.4 426.8 137.3 420.8 142.3 392.8 144 380 144.2 369.1 142.9 344.8Z",
        label: [128.1, 456.4],
        point: [128, 461],
      },
      S1: {
        d: "M133.2 436.6 135.5 452.7 135.5 457 133.4 470 137 470 140 461.9 141 455 140.1 450.5 137.3 443.1 136.5 440 136 435.1Z",
      },
    },
  },
  back: {
    outline:
      "M127.9 31.7 126.5 24.7 123.3 18.5 121.4 16.2 118.9 14 113.9 11.5 110.9 11 108.2 11.1 103.1 12.7 100.4 14.6 98.2 16.6 94.6 22.2 92.4 29 92 32.9 92.1 36.8 93.2 42.3 95 46.8 97.6 50.7 101 53.9 100.3 62.5 99.1 67.6 97.7 70.3 94.7 72.8 75.5 79.2 71.2 81.1 67.9 84.1 66.1 86.6 64.7 89.2 63.9 93.7 58 107.3 53.8 120.5 42.1 180 32.3 221.9 28.8 233.5 22.3 247.9 21 254 21 257.6 22.1 265.8 26 283 39 284 42.9 268.2 45 257 45.2 250.9 44.6 242.2 44.6 235.7 46.6 223.4 55.3 189.3 70.6 139.5 72.6 131.1 74.5 117.6 75 140 80.5 179.4 81 190 79.4 201.1 72.4 229.9 71 238 69.2 261.2 69.1 274 70.5 289.6 72.6 306.5 76.2 330.2 77 340 76.7 349.6 74.9 369.1 75 380 76.7 392.9 84 432 84.7 439.3 85 452 86.4 459 89 468 96 468 100 456.7 101.2 449.9 101 432 103.2 374.4 105 302 105.9 287.5 107.6 271.3 108.6 264.7 110 264 111.4 264.7 112.4 271.3 114.1 287.5 115 302 116.8 374.4 119 432 118.8 449.9 120 456.7 124 468 131 468 133.6 459 135 452 135.3 439.3 136 432 143.3 392.9 145 380 145.1 369.1 143.3 349.6 143 340 143.8 330.2 147.4 306.5 149.5 289.6 150.9 274 150.8 261.2 149 238 147.6 229.9 140.6 201.1 139 190 139.5 179.4 145 140 145.5 117.6 147.4 131.1 149.4 139.5 164.7 189.3 173.4 223.4 175.4 235.7 175.4 242.2 174.8 250.9 175 257 177.1 268.2 181 284 194 283 197.9 265.8 199 257.6 199 254 197.7 247.9 192.6 236.7 190 230 184.3 208.2 176.9 175.2 166.2 120.5 162 107.3 156.1 93.7 155.3 89.2 153.9 86.6 152.1 84.1 148.8 81.1 144.5 79.2 125.3 72.8 122.3 70.3 120.9 67.6 119.7 62.5 119 53.9 123 49.9 126.1 44.3 127.7 38.5Z",
    unassigned: "M120 14.9 115.2 12 110 11 110 15Z",
    regions: {
      C2: {
        d: "M127.9 31.7 127.2 27.3 125.7 22.7 123.6 19 120.7 15.5 120.1 15 110 15 110 58 119.3 58 118.9 54 121.4 51.8 123.6 49 126.6 42.8 127.8 37.4Z",
        label: [118.9, 36.5],
        point: [124, 22],
      },
      C3: {
        d: "M121.1 68 119.7 62.5 119.3 58 110 58 110 68Z",
        label: [114.9, 63.1],
      },
      C4: {
        d: "M156.1 93.7 155.3 89.2 153.1 85.3 150 82 147.5 80.4 125.3 72.8 122.2 70.4 121.1 68 110 68 110 88 150.8 94.1 145 113 145.1 113.9 151 102.3Z",
        label: [119.5, 80.1],
      },
      C5: {
        d: "M156 93.7 149.7 105 156.3 128.6 167 171.9 176.1 171.2 166.2 120.5 162 107.3Z",
        label: [159.4, 117.6],
      },
      C6: {
        d: "M176.1 171.2 169.8 171.7 190.4 255.1 189.3 283.4 194 283 197.1 270 198.6 261.6 199 254 198.5 250.8 196.7 245.2 191.2 233.5 188.9 226.1 183.2 203.4Z",
        label: [194.2, 251.7],
        point: [195, 263],
      },
      C7: {
        d: "M169.8 171.7 165.8 171.9 172.3 196.5 180.7 231.2 179.8 231.4 182.7 256 185.2 283.7 189.3 283.4 190.4 255.1Z",
        point: [187, 272.3],
      },
      C8: {
        d: "M169.2 205.4 173.4 223.4 175 232 175.5 239.1 174.8 253.9 176.2 264.2 181 284 185.2 283.7 182.7 256 179.8 231.4 180.7 231.2 174.4 205.2Z",
        label: [178.8, 256.1],
        point: [181, 272.9],
      },
      T1: {
        d: "M110 96 148.5 101.8 150.8 94.1 110 88ZM152.1 148.5 163.3 184.6 169.1 205.4 174.4 205.2 165.8 171.9 167 171.9 160.1 144.6Z",
        label: [157.3, 151],
      },
      T2: {
        d: "M110 104 146.1 109.4 148.5 101.8 110 96ZM145.1 113.9 147.4 131.1 149.4 139.5 152.1 148.5 160.1 144.6 154.9 123.4 149.7 105Z",
        label: [153.1, 135.4],
      },
      T3: {
        d: "M145.5 117.3 145 113 146.1 109.4 110 104 110 112Z",
        label: [133.4, 111.5],
      },
      T4: {
        d: "M145.3 125.3 145.5 117.3 110 112 110 120Z",
        label: [136.9, 120],
      },
      T5: {
        d: "M145.3 133.3 145.3 125.3 110 120 110 128Z",
        label: [127.7, 126.6],
      },
      T6: {
        d: "M144.9 141.2 145.3 133.3 110 128 110 136Z",
        label: [139.4, 136.4],
      },
      T7: {
        d: "M143.9 149.1 144.9 141.2 110 136 110 144Z",
        label: [122.4, 141.9],
      },
      T8: {
        d: "M142.6 156.9 143.9 149.1 110 144 110 152Z",
        label: [135.1, 151.8],
      },
      T9: {
        d: "M141.4 164.7 142.6 156.9 110 152 110 160Z",
        label: [134.2, 159.6],
      },
      T10: {
        d: "M140.4 172.6 141.4 164.7 110 160 110 168Z",
        label: [129.3, 166.9],
      },
      T11: {
        d: "M139.4 180.4 140.4 172.6 110 168 110 176Z",
        label: [128.6, 174.8],
      },
      T12: {
        d: "M139 189.8 139.4 180.4 110 176 110 184Z",
        label: [134, 184.2],
      },
      L1: {
        d: "M140.6 201.2 139 189.8 110 184 110 192Z",
        label: [133.8, 193.9],
      },
      L2: {
        d: "M143.7 215.2 140.6 201.2 110 192 110 200ZM138.8 286.9 149.9 286 150.9 274 151 265.8 149 238 148.7 247 147.5 253.1 144.9 257.4 138.9 263 139.5 274.3Z",
        label: [145.1, 266.8],
      },
      L3: {
        d: "M147.7 230.6 143.7 215.2 110 200 110 208ZM123.8 268.1 118.5 267.8 115.5 266.8 111.4 264.7 113 276 114.8 298.1 116 340 124.1 340 124.9 303.3 124.5 278.8ZM143.8 330.2 147.4 306.4 149.9 286 138.8 286.9 138.1 302 135.2 336.2 135.3 340 143 340Z",
        label: [118.5, 273.8],
      },
      L4: {
        d: "M124.1 340 116 340 117 380 119 432 118.8 449.9 119 452 123.8 452 125.4 380Z",
        label: [121.1, 378.1],
      },
      L5: {
        d: "M143 340 134.9 340 136.5 377.3 136.3 382.6 134.3 400.8 141.9 400.8 144.3 386.1 145.2 374.4 144.7 364 143.3 349.6Z",
        label: [140.6, 368.9],
      },
      S1: {
        d: "M148.5 248.8 149 238.5 147.7 230.6 110 208 110 218ZM141.9 400.8 134.3 400.8 135.5 390.4 125.1 390.4 123.8 452 119 452 120.7 459 124 468 131 468 134.6 454.3 135.2 449.9 135.3 439.3 136 432Z",
        label: [132.5, 408.4],
        point: [127.8, 466.4],
      },
      S2: {
        d: "M112.2 240.1 117.5 241.5 122 244.4 125.2 248.4 126.9 253 126.8 257.4 125.2 261.6 122.4 265.3 118.8 267.8 125 268 123.8 268.1 124.5 278.8 124.9 303.3 124.2 336.2 125.4 380 125.1 390.4 135.5 390.4 136.2 370.7 134.9 340 135.3 340 135.2 336.2 138 303.3 138.7 289.9 139.3 276.8 138.9 263 142.2 260.2 146 256 147.5 253.1 148.5 248.8 110 218 110 240Z",
        label: [136.6, 251.9],
        point: [129.5, 340],
      },
      S3: {
        d: "M126.7 252.1 124.7 247.5 123.1 245.5 120.8 243.4 116 241 110 240 110 252 112.1 252.4 114 253.7 115.3 255.7 115.9 258.1 115.9 260.4 115.3 262.3 114.1 264.1 112.6 265.3 118.8 267.8 122.4 265.3 124.7 262.5 126.3 259.4 127 256Z",
        label: [118.6, 249.7],
        point: [123, 258],
      },
      "S4-5": {
        d: "M115.9 257.9 115.2 255.5 113.8 253.6 111.9 252.4 110 252 110 264 112.6 265.3 114 264.3 115.6 261.5Z",
        point: [114, 259],
      },
    },
  },
}

export function DermatomeMap({
  selectedId,
  onSelectionChange,
  views = ["front", "back"],
  colors,
  showLabels = true,
  label = "Dermatome map",
  className,
  ...props
}: DermatomeMapProps) {
  const [hoveredId, setHoveredId] = React.useState<DermatomeId | null>(null)
  const [activeId, setActiveId] = React.useState<DermatomeId>(
    selectedId ?? dermatomes[0].id
  )
  // Keep keyboard focus on the selection when it changes from outside.
  const [lastSelectedId, setLastSelectedId] = React.useState(selectedId)
  if (selectedId !== lastSelectedId) {
    setLastSelectedId(selectedId)
    if (selectedId) setActiveId(selectedId)
  }
  const options = React.useRef(new Map<DermatomeId, HTMLElement>())
  const id = React.useId()
  const shownId = hoveredId ?? selectedId
  const shown = dermatomes.find((dermatome) => dermatome.id === shownId)
  const fill = (level: DermatomeId) => colors?.[level] ?? dermatomeColor(level)
  const hover = {
    enter: (level: DermatomeId) => setHoveredId(level),
    leave: (level: DermatomeId) =>
      setHoveredId((current) => (current === level ? null : current)),
  }

  function onKeyDown(event: React.KeyboardEvent) {
    const index = dermatomes.findIndex(({ id }) => id === activeId)
    const target = {
      ArrowRight: index + 1,
      ArrowDown: index + 1,
      ArrowLeft: index - 1,
      ArrowUp: index - 1,
      Home: 0,
      End: dermatomes.length - 1,
    }[event.key]
    if (target !== undefined) {
      event.preventDefault()
      const next =
        dermatomes[Math.max(0, Math.min(dermatomes.length - 1, target))]!.id
      setActiveId(next)
      options.current.get(next)?.focus()
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault()
      onSelectionChange(activeId)
    } else if (event.key === "Escape" && selectedId) {
      event.preventDefault()
      onSelectionChange(null)
    }
  }

  return (
    <div
      data-slot="dermatome-map"
      role="group"
      aria-label={label}
      className={cn("@container/dermatome-map", className)}
      {...props}
    >
      <div className="grid gap-6 @2xl/dermatome-map:grid-cols-[minmax(0,1fr)_18rem]">
        <div
          className={cn(
            "grid gap-4",
            views.length > 1 ? "grid-cols-2" : "grid-cols-1"
          )}
        >
          {views.map((view) => (
            <DermatomeFigure
              key={view}
              view={view}
              shownId={shownId}
              selectedId={selectedId}
              fill={fill}
              showLabels={showLabels}
              onHover={hover}
              onSelect={onSelectionChange}
            />
          ))}
        </div>
        <div className="flex flex-col gap-4">
          <div
            role="listbox"
            aria-label="Spinal levels"
            aria-orientation="horizontal"
            onKeyDown={onKeyDown}
            className="flex flex-col gap-3"
          >
            {regions.map((region) => (
              <div
                key={region}
                role="group"
                aria-labelledby={`${id}-${region}`}
                className="flex flex-col gap-1.5"
              >
                <div
                  id={`${id}-${region}`}
                  className="text-xs font-medium text-muted-foreground"
                >
                  {region}
                </div>
                <div className="flex flex-wrap gap-1">
                  {dermatomes
                    .filter((dermatome) => dermatome.region === region)
                    .map((dermatome) => (
                      <div
                        key={dermatome.id}
                        role="option"
                        ref={(element) => {
                          if (element)
                            options.current.set(dermatome.id, element)
                          else options.current.delete(dermatome.id)
                        }}
                        tabIndex={dermatome.id === activeId ? 0 : -1}
                        aria-selected={dermatome.id === selectedId}
                        onClick={() => {
                          setActiveId(dermatome.id)
                          onSelectionChange(dermatome.id)
                        }}
                        onPointerEnter={() => hover.enter(dermatome.id)}
                        onPointerLeave={() => hover.leave(dermatome.id)}
                        // Styled as shadcn's outline Toggle, keeping listbox
                        // semantics. Selection also darkens the border, so it
                        // differs from hover, which shares bg-muted.
                        className={cn(
                          toggleVariants({ variant: "outline", size: "sm" }),
                          "min-w-11 cursor-pointer gap-1.5 text-xs tabular-nums select-none aria-selected:border-foreground aria-selected:bg-muted"
                        )}
                      >
                        <span
                          aria-hidden="true"
                          className="size-2.5 shrink-0 rounded-full"
                          style={{ background: fill(dermatome.id) }}
                        />
                        {dermatome.id}
                      </div>
                    ))}
                </div>
              </div>
            ))}
          </div>
          <div className="flex min-h-36 flex-col gap-1.5 rounded-lg border p-3 text-sm">
            {shown ? (
              <>
                <p className="font-medium">
                  {shown.id}{" "}
                  <span className="font-normal text-muted-foreground">
                    {shown.region}
                  </span>
                </p>
                <p>{shown.area}</p>
                <p className="text-muted-foreground">
                  Key sensory point: {shown.keyPoint}
                </p>
              </>
            ) : (
              <p className="text-muted-foreground">
                Select a level, or a region on the body, to see the skin a
                spinal nerve supplies.
              </p>
            )}
            {selectedId && (
              <Button
                variant="outline"
                size="sm"
                className="mt-auto self-start"
                onClick={() => onSelectionChange(null)}
              >
                Clear selection
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function DermatomeFigure({
  view,
  shownId,
  selectedId,
  fill,
  showLabels,
  onHover,
  onSelect,
}: {
  view: DermatomeView
  shownId: DermatomeId | null
  selectedId: DermatomeId | null
  fill: (id: DermatomeId) => string
  showLabels: boolean
  onHover: {
    enter: (id: DermatomeId) => void
    leave: (id: DermatomeId) => void
  }
  onSelect: (id: DermatomeId) => void
}) {
  const { outline, unassigned, regions } = shapes[view]
  const entries = Object.entries(regions) as [DermatomeId, Shape][]
  const shown = shownId ? regions[shownId] : undefined
  return (
    <figure className="@container flex min-w-0 flex-col items-center gap-2">
      <figcaption className="text-sm font-medium">{viewNames[view]}</figcaption>
      <svg
        viewBox="0 0 220 480"
        role="img"
        aria-label={`${viewNames[view]} view of the dermatomes`}
        className="h-auto w-full max-w-80"
      >
        <path
          d={outline}
          strokeWidth={3}
          className="fill-muted stroke-border"
        />
        {[undefined, mirror].map((transform) => (
          <g key={transform ?? "right"} transform={transform}>
            <path d={unassigned} className="fill-muted" />
            {entries.map(([level, shape]) => (
              <path
                key={level}
                d={shape.d}
                data-dermatome={level}
                fill={fill(level)}
                strokeWidth={0.6}
                onPointerEnter={() => onHover.enter(level)}
                onPointerLeave={() => onHover.leave(level)}
                onClick={() => onSelect(level)}
                className={cn(
                  "cursor-pointer stroke-background transition-opacity",
                  shownId && shownId !== level && "opacity-35"
                )}
              />
            ))}
            {shown && (
              <path
                d={shown.d}
                strokeWidth={shownId === selectedId ? 1.4 : 0.8}
                className="pointer-events-none fill-none stroke-foreground"
              />
            )}
            {shown?.point && (
              <circle
                cx={shown.point[0]}
                cy={shown.point[1]}
                r={2.6}
                strokeWidth={1}
                className="pointer-events-none fill-foreground stroke-background"
              />
            )}
          </g>
        ))}
        {showLabels &&
          entries.map(([level, { label }]) =>
            label ? (
              <text
                key={level}
                x={label[0]}
                y={label[1]}
                fontSize={7}
                textAnchor="middle"
                dominantBaseline="central"
                paintOrder="stroke"
                strokeWidth={1.6}
                className="pointer-events-none hidden fill-foreground stroke-background font-medium select-none @3xs:inline"
              >
                {level}
              </text>
            ) : null
          )}
      </svg>
    </figure>
  )
}
