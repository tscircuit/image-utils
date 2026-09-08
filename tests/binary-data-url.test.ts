import { expect, test } from "bun:test"
import { encode } from "fast-png"
import { loadImageSource } from "../lib/svg-to-brep-shapes"

const png = encode({
  width: 1,
  height: 1,
  data: new Uint8Array([0, 0, 0, 255]),
  channels: 4,
})
const percent = Array.from(
  png,
  (byte) => `%${byte.toString(16).padStart(2, "0")}`,
).join("")
for (const url of [
  `data:image/png,${percent}`,
  `data:image/png;base64,${Buffer.from(png).toString("base64")}`,
]) {
  test(`binary image data URL ${url.includes("base64") ? "base64" : "percent"}`, async () => {
    const bytes = new Uint8Array(await (await fetch(url)).arrayBuffer())
    expect(Array.from(bytes)).toEqual(Array.from(png))
    const result = await loadImageSource(url)
    expect(result.mimetype).toBe("image/png")
    expect(result.text).toBe("")
    expect(result.dataUrl).toBe(url)
    expect(result.projectRelativePath).toBe("inline")
  })
}

const svg =
  '<svg xmlns="http://www.w3.org/2000/svg"><title>日本語</title></svg>'
for (const url of [
  `data:image/svg+xml,${encodeURIComponent(svg)}`,
  `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`,
]) {
  test(`SVG text remains decoded ${url.includes("base64") ? "base64" : "percent"}`, async () => {
    expect((await loadImageSource(url)).text).toBe(svg)
  })
}
