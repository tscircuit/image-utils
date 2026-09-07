import { expect, test } from "bun:test"
import { decode, encode, type BitDepth } from "fast-png"
import looksSame from "../lib/looks-same"

const options = { strict: true, ignoreCaret: false, ignoreAntialiasing: false }

for (const depth of [8, 16] as const) {
  for (const channels of [1, 2, 3, 4]) {
    test(`compares ${depth}-bit ${channels}-channel PNGs by pixels`, async () => {
      const samples = [0, 51, 102, 153, 204, 255].flatMap((gray) =>
        Array.from({ length: channels }, (_, channel) =>
          (channels === 2 || channels === 4) && channel === channels - 1
            ? 255
            : gray,
        ),
      )
      const image = encode({
        width: 3,
        height: 2,
        channels,
        depth,
        data:
          depth === 16
            ? new Uint16Array(samples.map((value) => value * 257))
            : new Uint8Array(samples),
      })
      const rgb = encode({
        width: 3,
        height: 2,
        channels: 3,
        data: new Uint8Array(
          [0, 51, 102, 153, 204, 255].flatMap((v) => [v, v, v]),
        ),
        text: { Description: "Different encoding, same pixels" },
      })
      expect(await looksSame(image, rgb, options)).toEqual({
        equal: true,
        totalPixels: 6,
        differentPixels: 0,
      })
    })
  }
}

const packRows = (rows: number[][], depth: BitDepth) => {
  const stride = Math.ceil((rows[0].length * depth) / 8)
  const data = new Uint8Array(stride * rows.length)
  for (let y = 0; y < rows.length; y++) {
    for (let x = 0; x < rows[y].length; x++) {
      data[y * stride + Math.floor((x * depth) / 8)] |=
        rows[y][x] << (8 - depth - ((x * depth) % 8))
    }
  }
  return data
}

for (const depth of [1, 2, 4] as const) {
  test(`unpacks ${depth}-bit grayscale rows without treating padding as pixels`, async () => {
    const max = 2 ** depth - 1
    const rows = [
      [0, 1, max],
      [max, max - 1, 0],
    ]
    const image = encode({
      width: 3,
      height: 2,
      channels: 1,
      depth,
      data: packRows(rows, depth),
    })
    const rgb = encode({
      width: 3,
      height: 2,
      channels: 3,
      data: new Uint8Array(
        rows.flat().flatMap((v) => Array(3).fill((v * 255) / max)),
      ),
    })
    expect(await looksSame(image, rgb, options)).toEqual({
      equal: true,
      totalPixels: 6,
      differentPixels: 0,
    })
  })
}

for (const depth of [1, 2, 4, 8] as const) {
  test(`expands ${depth}-bit indexed colors before comparison and diff creation`, async () => {
    const palette = [
      [255, 0, 0],
      [0, 0, 255],
    ]
    const rows = [
      [0, 1, 0],
      [1, 0, 1],
    ]
    const image = encode({
      width: 3,
      height: 2,
      channels: 1,
      depth,
      palette,
      data: packRows(rows, depth),
    })
    const rgb = encode({
      width: 3,
      height: 2,
      channels: 3,
      data: new Uint8Array(rows.flat().flatMap((v) => palette[v])),
    })
    expect(await looksSame(image, rgb, options)).toEqual({
      equal: true,
      totalPixels: 6,
      differentPixels: 0,
    })
    const different = encode({
      width: 3,
      height: 2,
      channels: 1,
      depth,
      palette,
      data: packRows(
        [
          [1, 1, 0],
          [1, 0, 1],
        ],
        depth,
      ),
    })
    expect(await looksSame(image, different, options)).toEqual({
      equal: false,
      totalPixels: 6,
      differentPixels: 1,
    })
    const diff = decode(
      await looksSame.createDiff({
        reference: image,
        current: different,
        ...options,
      }),
    )
    expect(diff.channels).toBe(4)
    expect(Array.from(diff.data.slice(0, 8))).toEqual([
      255, 0, 255, 255, 0, 0, 255, 255,
    ])
  })
}

test("grayscale diff highlights a changed pixel instead of returning the input", async () => {
  const reference = encode({
    width: 2,
    height: 1,
    channels: 1,
    data: new Uint8Array([0, 128]),
  })
  const current = encode({
    width: 2,
    height: 1,
    channels: 1,
    data: new Uint8Array([255, 128]),
  })
  const diff = decode(
    await looksSame.createDiff({ reference, current, ...options }),
  )
  expect(diff.channels).toBe(4)
  expect(Array.from(diff.data)).toEqual([255, 0, 255, 255, 128, 128, 128, 255])
})
