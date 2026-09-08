import { expect, test } from "bun:test"
import { decode, encode } from "fast-png"
import looksSame from "../lib/looks-same"

const pixel = (alpha: number, red = 0) =>
  encode({
    width: 1,
    height: 1,
    channels: 4,
    depth: 8,
    data: new Uint8Array([red, 0, 0, alpha]),
  })

for (const strict of [false, true]) {
  for (const alpha of [0, 128]) {
    test(`alpha=${alpha}, strict=${strict}`, async () => {
      const opaque = pixel(255)
      const other = pixel(alpha)
      expect(decode(opaque).data[3]).toBe(255)
      expect(decode(other).data[3]).toBe(alpha)
      expect(
        await looksSame(opaque, other, {
          strict,
          ignoreCaret: false,
          ignoreAntialiasing: false,
        }),
      ).toEqual({ equal: false, differentPixels: 1, totalPixels: 1 })
    })
  }
}

test("alpha-only change is highlighted in the diff", async () => {
  const output = await looksSame.createDiff({
    reference: pixel(255),
    current: pixel(0),
    strict: true,
    ignoreCaret: false,
    ignoreAntialiasing: false,
    highlightColor: "#ff00ff",
  })
  expect(Array.from(decode(output).data)).toEqual([255, 0, 255, 255])
})

test("identical pixels and opaque RGB changes remain controls", async () => {
  expect(
    (await looksSame(pixel(255), pixel(255), { strict: true })).equal,
  ).toBe(true)
  expect(
    (await looksSame(pixel(255), pixel(255, 255), { strict: true })).equal,
  ).toBe(false)
})
