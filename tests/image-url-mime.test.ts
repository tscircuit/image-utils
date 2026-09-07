import { expect, spyOn, test } from "bun:test"
import { loadImageSource } from "../lib/svg-to-brep-shapes"

const svg = '<svg viewBox="0 0 1 1"><path d="M0 0H1V1Z"/></svg>'

for (const url of [
  "https://example.com/logo.svg?v=2",
  "https://example.com/logo.svg#icon",
  "https://example.com/logo.SVG?token=abc#icon",
]) {
  test(`loads SVG text from a generic response at ${url}`, async () => {
    const fetchMock = spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(svg, {
        headers: { "content-type": "application/octet-stream" },
      }),
    )
    try {
      expect(await loadImageSource(url)).toEqual({
        mimetype: "image/svg+xml",
        text: svg,
        dataUrl: url,
        projectRelativePath: url,
      })
      // Keep the original query (including signed parameters) in the request.
      expect(fetchMock).toHaveBeenCalledWith(url)
    } finally {
      fetchMock.mockRestore()
    }
  })
}

test("uses the path extension when Content-Type is absent", async () => {
  const fetchMock = spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(new TextEncoder().encode(svg)),
  )
  try {
    const result = await loadImageSource("https://example.com/logo.svg?rev=1")
    expect(result.mimetype).toBe("image/svg+xml")
    expect(result.text).toBe(svg)
  } finally {
    fetchMock.mockRestore()
  }
})

for (const contentType of [
  "IMAGE/SVG+XML; charset=utf-8",
  "image/svg+xml ; charset=utf-8",
]) {
  test(`normalizes the media type ${contentType}`, async () => {
    const fetchMock = spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(svg, { headers: { "content-type": contentType } }),
    )
    try {
      const result = await loadImageSource("https://example.com/download/123")
      expect(result.mimetype).toBe("image/svg+xml")
      expect(result.text).toBe(svg)
    } finally {
      fetchMock.mockRestore()
    }
  })
}

for (const [url, expected] of [
  ["https://example.com/image.png?v=1", "image/png"],
  ["https://example.com/download?file=image.svg", "application/octet-stream"],
  ["https://example.com/photo.jpg#image.png", "application/octet-stream"],
]) {
  test(`does not use the query or fragment as a file extension: ${url}`, async () => {
    const fetchMock = spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(null, {
        headers: { "content-type": "application/octet-stream" },
      }),
    )
    try {
      const result = await loadImageSource(url)
      expect(result.mimetype).toBe(expected)
      expect(result.text).toBe("")
    } finally {
      fetchMock.mockRestore()
    }
  })
}

test("an explicit response type takes precedence over a URL extension", async () => {
  const fetchMock = spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(null, { headers: { "content-type": "image/png" } }),
  )
  try {
    expect(
      (await loadImageSource("https://example.com/logo.svg?rev=1")).mimetype,
    ).toBe("image/png")
  } finally {
    fetchMock.mockRestore()
  }
})
