import { describe, expect, test } from "bun:test"
import { encode } from "fast-png"
import looksSame from "../lib/looks-same"

interface SolidGridSpec {
  width: number
  height: number
  changedPixels: number
}

/**
 * Encode an uncompressed 8-bit RGBA PNG where the first `changedPixels` cells are white and remaining cells are black.
 */
function createTestPng({
  width,
  height,
  changedPixels,
}: SolidGridSpec): Uint8Array {
  const data = new Uint8Array(width * height * 4)
  const total = width * height
  for (let i = 0; i < total; i += 1) {
    const offset = i * 4
    const channel = i < changedPixels ? 255 : 0
    data[offset] = channel
    data[offset + 1] = channel
    data[offset + 2] = channel
    data[offset + 3] = 255
  }
  return encode({
    width,
    height,
    data,
    channels: 4,
    depth: 8,
  })
}

describe("looksSame percentThreshold comparison", () => {
  test("treats images as equal when differing pixel percentage is within percentThreshold", async () => {
    const reference = createTestPng({ width: 2, height: 2, changedPixels: 0 })
    const current = createTestPng({ width: 2, height: 2, changedPixels: 1 })

    const withoutThreshold = await looksSame(reference, current, {
      strict: true,
      ignoreAntialiasing: false,
      ignoreCaret: false,
    })
    expect(withoutThreshold.equal).toBe(false)
    expect(withoutThreshold.differentPixels).toBe(1)
    expect(withoutThreshold.totalPixels).toBe(4)

    const atBoundary = await looksSame(reference, current, {
      strict: true,
      ignoreAntialiasing: false,
      ignoreCaret: false,
      percentThreshold: 25,
    })
    expect(atBoundary.equal).toBe(true)
    expect(atBoundary.differentPixels).toBe(1)
    expect(atBoundary.totalPixels).toBe(4)

    const aboveBoundary = await looksSame(reference, current, {
      strict: true,
      ignoreAntialiasing: false,
      ignoreCaret: false,
      percentThreshold: 30,
    })
    expect(aboveBoundary.equal).toBe(true)
  })

  test("treats images as different when differing pixel percentage exceeds percentThreshold", async () => {
    const reference = createTestPng({ width: 2, height: 2, changedPixels: 0 })
    const current = createTestPng({ width: 2, height: 2, changedPixels: 1 })

    const belowBoundary = await looksSame(reference, current, {
      strict: true,
      ignoreAntialiasing: false,
      ignoreCaret: false,
      percentThreshold: 24.9,
    })
    expect(belowBoundary.equal).toBe(false)
    expect(belowBoundary.differentPixels).toBe(1)
    expect(belowBoundary.totalPixels).toBe(4)

    const zeroThreshold = await looksSame(reference, current, {
      strict: true,
      ignoreAntialiasing: false,
      ignoreCaret: false,
      percentThreshold: 0,
    })
    expect(zeroThreshold.equal).toBe(false)
  })

  test("accepts zero percentThreshold for identical images and rejects negative values", async () => {
    const reference = createTestPng({ width: 2, height: 2, changedPixels: 0 })
    const identical = createTestPng({ width: 2, height: 2, changedPixels: 0 })

    const sameResult = await looksSame(reference, identical, {
      strict: true,
      percentThreshold: 0,
    })
    expect(sameResult.equal).toBe(true)
    expect(sameResult.differentPixels).toBe(0)

    await expect(
      looksSame(reference, identical, { percentThreshold: -1 }),
    ).rejects.toThrow('Expected "percentThreshold" to be a non-negative number')
  })
})
