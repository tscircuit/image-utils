import { expect, test } from "bun:test"
import { encode } from "fast-png"
import looksSame from "../lib/looks-same"

const png = (width: number, changedPixels = 0) => {
  const data = new Uint8Array(width * 4)
  for (let pixel = 0; pixel < width; pixel += 1) {
    data[pixel * 4] = pixel < changedPixels ? 255 : 0
    data[pixel * 4 + 3] = 255
  }
  return encode({ width, height: 1, channels: 4, depth: 8, data })
}

for (const strict of [false, true]) {
  test(`percentThreshold preserves rounding-sensitive boundaries (strict=${strict})`, async () => {
    for (const [changedPixels, percentThreshold, equal] of [
      [7, 6.999, false],
      [7, 7, true],
      [7, 7.001, true],
      [8, 7, false],
      [29, 29, true],
    ] as const) {
      expect(
        await looksSame(png(100), png(100, changedPixels), {
          strict,
          percentThreshold,
          ignoreCaret: false,
          ignoreAntialiasing: false,
        }),
      ).toEqual({ equal, differentPixels: changedPixels, totalPixels: 100 })
    }
  })

  test(`percentThreshold uses inclusive percentages (strict=${strict})`, async () => {
    const reference = png(10)
    const current = png(10, 1)
    for (const [percentThreshold, equal] of [
      [undefined, false],
      [0, false],
      [0.1, false],
      [9.99, false],
      [10, true],
      [50, true],
      [100, true],
    ] as const) {
      expect(
        await looksSame(reference, current, {
          strict,
          percentThreshold,
          ignoreCaret: false,
          ignoreAntialiasing: false,
        }),
      ).toEqual({ equal, differentPixels: 1, totalPixels: 10 })
    }
  })
}

test("fractional percentages preserve raw difference counts", async () => {
  expect(
    await looksSame(png(200), png(200, 1), {
      strict: true,
      ignoreCaret: false,
      ignoreAntialiasing: false,
      percentThreshold: 0.5,
    }),
  ).toEqual({ equal: true, differentPixels: 1, totalPixels: 200 })
})

test("identical images still match with a zero threshold", async () => {
  expect(await looksSame(png(10), png(10), { percentThreshold: 0 })).toEqual({
    equal: true,
    differentPixels: 0,
    totalPixels: 10,
  })
})

test("dimension differences count against the same percentage threshold", async () => {
  for (const [percentThreshold, equal] of [
    [9, false],
    [10, true],
  ] as const) {
    expect(await looksSame(png(9), png(10), { percentThreshold })).toEqual({
      equal,
      differentPixels: 1,
      totalPixels: 10,
    })
  }
})

test("invalid percentages remain rejected", async () => {
  for (const percentThreshold of [-1, Number.NaN, Number.POSITIVE_INFINITY]) {
    await expect(
      looksSame(png(10), png(10), { percentThreshold }),
    ).rejects.toThrow('Expected "percentThreshold" to be a non-negative number')
  }
})
