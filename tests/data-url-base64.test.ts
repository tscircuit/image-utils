import { expect, it } from "bun:test"
import { loadImageSource } from "../lib/svg-to-brep-shapes"

const svg =
  '<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0H1V1Z"/></svg>'
const svgBase64 = Buffer.from(svg).toString("base64")

it("decodes ASCII case variants of the trailing base64 marker", async () => {
  for (const marker of ["base64", "BASE64", "Base64"]) {
    const source = await loadImageSource(
      `data:image/svg+xml;${marker},${svgBase64}`,
    )
    expect(source.text).toBe(svg)
  }
})

it("decodes a trailing base64 marker with surrounding whitespace", async () => {
  for (const metadata of [
    "image/svg+xml; base64",
    "image/svg+xml ;base64",
    "image/svg+xml;base64 ",
  ]) {
    const source = await loadImageSource(`data:${metadata},${svgBase64}`)
    expect(source.mimetype).toBe("image/svg+xml")
    expect(source.text).toBe(svg)
  }
})

it("does not treat a base64 parameter assignment as the encoding marker", async () => {
  const source = await loadImageSource(
    `data:image/svg+xml;base64=true,${encodeURIComponent(svg)}`,
  )
  expect(source.text).toBe(svg)
})
