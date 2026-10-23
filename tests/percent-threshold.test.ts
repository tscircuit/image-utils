import { describe, expect, test } from "bun:test"
import { encode } from "fast-png"
import looksSame from "../lib/looks-same"

describe("percentThreshold", () => {
  const png = (data: Uint8Array) =>
    encode({ width: 10, height: 1, channels: 4, depth: 8, data })

  const referenceData = new Uint8Array(10 * 4)
  for (let i = 3; i < referenceData.length; i += 4) {
    referenceData[i] = 255
  }

  const currentData = referenceData.slice()
  // Differ at first pixel: red channel 255
  currentData[0] = 255

  const reference = png(referenceData)
  const current = png(currentData)

  test("considers images equal when difference percentage is within percentThreshold", async () => {
    // 1 pixel out of 10 differs -> 10% difference
    const resWithin = await looksSame(reference, current, {
      percentThreshold: 15,
      strict: true,
      ignoreAntialiasing: false,
      ignoreCaret: false,
    })

    expect(resWithin.equal).toBe(true)
    expect(resWithin.differentPixels).toBe(1)
    expect(resWithin.totalPixels).toBe(10)

    const resExact = await looksSame(reference, current, {
      percentThreshold: 10,
      strict: true,
      ignoreAntialiasing: false,
      ignoreCaret: false,
    })
    expect(resExact.equal).toBe(true)
  })

  test("considers images unequal when difference percentage exceeds percentThreshold", async () => {
    const resExceeds = await looksSame(reference, current, {
      percentThreshold: 5,
      strict: true,
      ignoreAntialiasing: false,
      ignoreCaret: false,
    })

    expect(resExceeds.equal).toBe(false)
    expect(resExceeds.differentPixels).toBe(1)
    expect(resExceeds.totalPixels).toBe(10)
  })

  test("defaults to exact pixel equality when percentThreshold is omitted", async () => {
    const resDefault = await looksSame(reference, current, {
      strict: true,
      ignoreAntialiasing: false,
      ignoreCaret: false,
    })

    expect(resDefault.equal).toBe(false)
    expect(resDefault.differentPixels).toBe(1)
    expect(resDefault.totalPixels).toBe(10)
  })

  test("returns equal true for identical images even with percentThreshold 0", async () => {
    const resIdentical = await looksSame(reference, reference, {
      percentThreshold: 0,
      strict: true,
    })

    expect(resIdentical.equal).toBe(true)
    expect(resIdentical.differentPixels).toBe(0)
    expect(resIdentical.totalPixels).toBe(10)
  })

  test("rejects invalid percentThreshold values with TypeError", async () => {
    for (const invalid of [-1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(
        looksSame(reference, current, { percentThreshold: invalid }),
      ).rejects.toThrow(TypeError)
    }
  })
})
