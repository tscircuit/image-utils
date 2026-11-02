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

/**
 * Reproduction for tscircuit/image-utils#58
 * Currently, media types from HTTP headers and data URLs are not normalized
 * (.trim().toLowerCase()), causing uppercase or parameterized SVG Content-Types
 * to mismatch SVG_MIMETYPE ("image/svg+xml") and drop the SVG text.
 */
test("repro: uppercase IMAGE/SVG+XML content-type drops SVG text", async () => {
  const fetchMock = spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(svg, { headers: { "content-type": "IMAGE/SVG+XML" } }),
  )
  restoreFetch = () => fetchMock.mockRestore()
  const source = await loadImageSource("https://example.invalid/logo.svg")

  // Repro: currently preserves uppercase and fails equality check against SVG_MIMETYPE
  expect(source.mimetype).toBe("IMAGE/SVG+XML")
  expect(source.mimetype).not.toBe(SVG_MIMETYPE)
  expect(source.text).toBe("")
})

test("repro: mixed case Image/Svg+Xml with charset drops SVG text", async () => {
  const fetchMock = spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(svg, {
      headers: { "content-type": "Image/Svg+Xml; charset=utf-8" },
    }),
  )
  restoreFetch = () => fetchMock.mockRestore()
  const source = await loadImageSource("https://example.invalid/logo.svg")

  // Repro: currently retains mixed case
  expect(source.mimetype).toBe("Image/Svg+Xml")
  expect(source.mimetype).not.toBe(SVG_MIMETYPE)
  expect(source.text).toBe("")
})

test("repro: media type with whitespace before semicolon retains trailing space", async () => {
  const fetchMock = spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(svg, {
      headers: { "content-type": "image/svg+xml ; charset=utf-8" },
    }),
  )
  restoreFetch = () => fetchMock.mockRestore()
  const source = await loadImageSource("https://example.invalid/logo.svg")

  // Repro: currently retains trailing whitespace
  expect(source.mimetype).toBe("image/svg+xml ")
  expect(source.mimetype).not.toBe(SVG_MIMETYPE)
  expect(source.text).toBe("")
})

test("repro: uppercase APPLICATION/OCTET-STREAM bypasses extension-based fallback", async () => {
  const fetchMock = spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(svg, {
      headers: { "content-type": "APPLICATION/OCTET-STREAM" },
    }),
  )
  restoreFetch = () => fetchMock.mockRestore()
  const source = await loadImageSource("https://example.invalid/logo.svg")

  // Repro: currently does not match lowercase "application/octet-stream" check
  expect(source.mimetype).toBe("APPLICATION/OCTET-STREAM")
  expect(source.text).toBe("")
})

test("repro: uppercase IMAGE/PNG header preserves uppercase MIME type", async () => {
  const fetchMock = spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(new Uint8Array([0, 255, 128]), {
      headers: { "content-type": "IMAGE/PNG" },
    }),
  )
  restoreFetch = () => fetchMock.mockRestore()
  const source = await loadImageSource("https://example.invalid/logo.png")

  // Repro: currently preserves uppercase
  expect(source.mimetype).toBe("IMAGE/PNG")
  expect(source.mimetype).not.toBe(PNG_MIMETYPE)
})

test("repro: data URL with uppercase media type preserves uppercase", async () => {
  const source = await loadImageSource(
    `data:IMAGE/SVG+XML,${encodeURIComponent(svg)}`,
  )

  // Repro: currently preserves uppercase in data URL metadata
  expect(source.mimetype).toBe("IMAGE/SVG+XML")
  expect(source.mimetype).not.toBe(SVG_MIMETYPE)
})
