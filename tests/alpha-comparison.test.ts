import { expect, it } from "bun:test"
import { decode, encode } from "fast-png"
import looksSame from "../lib/looks-same"

const opaqueRed = encode({
  width: 2,
  height: 2,
  channels: 4,
  depth: 8,
  data: new Uint8Array([
    255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255,
  ]),
})

const transparentRed = encode({
  width: 2,
  height: 2,
  channels: 4,
  depth: 8,
  data: new Uint8Array([
    255, 0, 0, 0, 255, 0, 0, 0, 255, 0, 0, 0, 255, 0, 0, 0,
  ]),
})

const transparentGreen = encode({
  width: 2,
  height: 2,
  channels: 4,
  depth: 8,
  data: new Uint8Array([
    0, 255, 0, 0, 0, 255, 0, 0, 0, 255, 0, 0, 0, 255, 0, 0,
  ]),
})

const opaqueWhite = encode({
  width: 2,
  height: 2,
  channels: 4,
  depth: 8,
  data: new Uint8Array([
    255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255,
    255,
  ]),
})

const transparentWhite = encode({
  width: 2,
  height: 2,
  channels: 4,
  depth: 8,
  data: new Uint8Array([
    255, 255, 255, 0, 255, 255, 255, 0, 255, 255, 255, 0, 255, 255, 255, 0,
  ]),
})

it("distinguishes opaque and transparent pixels with identical RGB", async () => {
  const result = await looksSame(opaqueRed, transparentRed, {
    ignoreCaret: false,
  })
  expect(result).toEqual({
    equal: false,
    differentPixels: 4,
    totalPixels: 4,
  })

  const defaultResult = await looksSame(opaqueRed, transparentRed)
  expect(defaultResult.equal).toBe(false)
  expect(defaultResult.differentPixels).toBeGreaterThan(0)

  const whiteResult = await looksSame(opaqueWhite, transparentWhite, {
    ignoreCaret: false,
  })
  expect(whiteResult).toEqual({
    equal: false,
    differentPixels: 4,
    totalPixels: 4,
  })
})

it("treats fully transparent pixels with different hidden RGB as equal", async () => {
  const result = await looksSame(transparentRed, transparentGreen)
  expect(result).toEqual({
    equal: true,
    differentPixels: 0,
    totalPixels: 4,
  })

  const strictResult = await looksSame(transparentRed, transparentGreen, {
    strict: true,
  })
  expect(strictResult).toEqual({
    equal: true,
    differentPixels: 0,
    totalPixels: 4,
  })
})

it("preserves source alpha for matching pixels in createDiff", async () => {
  const diffPng = await looksSame.createDiff({
    reference: transparentRed,
    current: transparentGreen,
  })
  const decoded = decode(diffPng)
  expect(decoded.channels).toBe(4)
  for (let i = 3; i < decoded.data.length; i += 4) {
    expect(decoded.data[i]).toBe(0)
  }
})
