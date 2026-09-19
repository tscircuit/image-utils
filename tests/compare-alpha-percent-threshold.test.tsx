import { expect, it } from "bun:test"
import { encode } from "fast-png"
import looksSame from "../lib/looks-same"

const makePng = (pixels: number[][], width: number) =>
  encode({
    width,
    height: pixels.length / width,
    channels: 4,
    depth: 8,
    data: new Uint8Array(pixels.flat()),
  })

it("detects alpha-only differences, including in strict mode", async () => {
  const opaqueBlack = makePng([[0, 0, 0, 255]], 1)
  const transparentBlack = makePng([[0, 0, 0, 0]], 1)

  const strictResult = await looksSame(opaqueBlack, transparentBlack, {
    strict: true,
    ignoreCaret: false,
    ignoreAntialiasing: false,
  })
  expect(strictResult.equal).toBe(false)
  expect(strictResult.differentPixels).toBe(1)

  const nonStrictResult = await looksSame(opaqueBlack, transparentBlack, {
    ignoreCaret: false,
    ignoreAntialiasing: false,
  })
  expect(nonStrictResult.equal).toBe(false)
  expect(nonStrictResult.differentPixels).toBe(1)
})

it("honors percentThreshold in equal computation", async () => {
  const white = [255, 255, 255, 255]
  const img1 = makePng(Array(10).fill(white), 10)
  const img2Pixels = Array(10).fill(white)
  img2Pixels[0] = [0, 0, 0, 255]
  const img2 = makePng(img2Pixels, 10)

  const noThreshold = await looksSame(img1, img2, {
    strict: true,
    ignoreCaret: false,
    ignoreAntialiasing: false,
  })
  expect(noThreshold).toMatchObject({
    equal: false,
    differentPixels: 1,
    totalPixels: 10,
  })

  const under = await looksSame(img1, img2, {
    strict: true,
    ignoreCaret: false,
    ignoreAntialiasing: false,
    percentThreshold: 9,
  })
  expect(under.equal).toBe(false)

  const at = await looksSame(img1, img2, {
    strict: true,
    ignoreCaret: false,
    ignoreAntialiasing: false,
    percentThreshold: 10,
  })
  expect(at.equal).toBe(true)

  const over = await looksSame(img1, img2, {
    strict: true,
    ignoreCaret: false,
    ignoreAntialiasing: false,
    percentThreshold: 50,
  })
  expect(over.equal).toBe(true)
})
