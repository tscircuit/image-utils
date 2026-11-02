import { afterEach, expect, spyOn, test } from "bun:test"
import {
  PNG_MIMETYPE,
  SVG_MIMETYPE,
  loadImageSource,
} from "../lib/svg-to-brep-shapes"

const svg =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><path d="M0 0H10V10Z"/></svg>'
let restoreFetch: (() => void) | undefined
afterEach(() => {
  restoreFetch?.()
  restoreFetch = undefined
})

for (const contentType of [
  "image/svg+xml",
  "IMAGE/SVG+XML",
  "Image/Svg+Xml; charset=utf-8",
  "image/svg+xml ; charset=utf-8",
]) {
  test(`loads SVG text for equivalent HTTP media type ${contentType}`, async () => {
    const fetchMock = spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(svg, { headers: { "content-type": contentType } }),
    )
    restoreFetch = () => fetchMock.mockRestore()
    const source = await loadImageSource("https://example.invalid/logo.svg")
    expect(source.mimetype).toBe(SVG_MIMETYPE)
    expect(source.text).toBe(svg)
  })
}

test("case-insensitive octet-stream retains extension-based SVG fallback", async () => {
  const fetchMock = spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(svg, {
      headers: { "content-type": "APPLICATION/OCTET-STREAM" },
    }),
  )
  restoreFetch = () => fetchMock.mockRestore()
  const source = await loadImageSource("https://example.invalid/logo.svg")
  expect(source.mimetype).toBe(SVG_MIMETYPE)
  expect(source.text).toBe(svg)
})

test("normalizes PNG HTTP media type without decoding binary data as text", async () => {
  const fetchMock = spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(new Uint8Array([0, 255, 128]), {
      headers: { "content-type": "IMAGE/PNG" },
    }),
  )
  restoreFetch = () => fetchMock.mockRestore()
  const source = await loadImageSource("https://example.invalid/logo.png")
  expect(source.mimetype).toBe(PNG_MIMETYPE)
  expect(source.text).toBe("")
})

for (const mimetype of ["image/svg+xml", "IMAGE/SVG+XML", "Image/Svg+Xml"]) {
  test(`normalizes inline SVG media type ${mimetype}`, async () => {
    const source = await loadImageSource(
      `data:${mimetype},${encodeURIComponent(svg)}`,
    )
    expect(source.mimetype).toBe(SVG_MIMETYPE)
    expect(source.text).toBe(svg)
  })
}
