import { describe, expect, it } from "bun:test"
import { encode } from "fast-png"
import looksSame from "../lib/looks-same"

const createPng = (data: Uint8Array, width = 10, height = 1) =>
  encode({ width, height, channels: 4, depth: 8, data })

describe("percentThreshold in looksSame", () => {
  const referenceData = new Uint8Array(10 * 4)
  for (let i = 3; i < referenceData.length; i += 4) {
    referenceData[i] = 255
  }
  const currentData = referenceData.slice()
  currentData[0] = 255 // 1 out of 10 pixels changed -> 10% difference

  const reference = createPng(referenceData)
  const current = createPng(currentData)

  it("treats any pixel difference as unequal when percentThreshold is omitted or 0", async () => {
    for (const strict of [false, true]) {
      for (const percentThreshold of [undefined, 0, 0.1, 1, 9.99]) {
        const result = await looksSame(reference, current, {
          percentThreshold,
          strict,
          ignoreCaret: false,
          ignoreAntialiasing: false,
        })
        expect(result).toEqual({
          equal: false,
          differentPixels: 1,
          totalPixels: 10,
        })
      }
    }
  })

  it("returns equal=true when percent difference is at or below percentThreshold", async () => {
    for (const strict of [false, true]) {
      for (const percentThreshold of [10, 50, 100]) {
        const result = await looksSame(reference, current, {
          percentThreshold,
          strict,
          ignoreCaret: false,
          ignoreAntialiasing: false,
        })
        expect(result).toEqual({
          equal: true,
          differentPixels: 1,
          totalPixels: 10,
        })
      }
    }
  })

  it("returns equal=true for identical images at percentThreshold=0", async () => {
    const result = await looksSame(reference, reference, {
      percentThreshold: 0,
    })
    expect(result).toEqual({
      equal: true,
      differentPixels: 0,
      totalPixels: 10,
    })
  })

  it("rejects negative, NaN, and infinite percentThreshold values", async () => {
    for (const invalidThreshold of [
      -1,
      Number.NaN,
      Number.POSITIVE_INFINITY,
      Number.NEGATIVE_INFINITY,
    ]) {
      await expect(
        looksSame(reference, current, { percentThreshold: invalidThreshold }),
      ).rejects.toThrow(
        new TypeError('Expected "percentThreshold" to be a non-negative number'),
      )
    }
  })
})
