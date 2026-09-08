import { expect, test } from "bun:test"
import { decode, encode } from "fast-png"
import looksSame from "../lib/looks-same"

const grayscalePng = (rows: number[][]) =>
  encode({
    width: rows[0].length,
    height: rows.length,
    channels: 3,
    depth: 8,
    data: Uint8Array.from(rows.flatMap((row) => row.flatMap((v) => [v, v, v]))),
  })

const transpose = (rows: number[][]) =>
  rows[0].map((_, x) => rows.map((row) => row[x]))

// The extra column must not wrap into the narrower image's next row when
// antialiasing checks inspect the neighborhood of a shared edge pixel.
const referenceRows = [
  [255, 0],
  [0, 255],
  [255, 128],
]
const currentRows = [
  [128, 255, 0],
  [128, 128, 128],
  [128, 255, 128],
]

for (const transposed of [false, true]) {
  for (const reversed of [false, true]) {
    test(`antialiasing stays inside shared image bounds: transposed=${transposed}, reversed=${reversed}`, async () => {
      const orient = transposed ? transpose : (rows: number[][]) => rows
      const reference = grayscalePng(orient(referenceRows))
      const current = grayscalePng(orient(currentRows))
      const croppedCurrent = grayscalePng(
        orient(currentRows.map((row) => row.slice(0, 2))),
      )
      const options = { ignoreCaret: false, ignoreAntialiasing: true }
      const cropped = await looksSame(reference, croppedCurrent, options)
      const pair = reversed ? [current, reference] : [reference, current]
      const result = await looksSame(pair[0], pair[1], options)

      expect(cropped.differentPixels).toBe(6)
      expect(result).toEqual({
        equal: false,
        differentPixels: 9,
        totalPixels: 9,
      })

      const diff = decode(
        await looksSame.createDiff({
          reference: pair[0],
          current: pair[1],
          ...options,
        }),
      )
      expect(diff.width).toBe(3)
      expect(diff.height).toBe(3)
      expect(Array.from(diff.data)).toEqual(
        Array.from({ length: 9 }, () => [255, 0, 255, 255]).flat(),
      )
    })
  }
}
