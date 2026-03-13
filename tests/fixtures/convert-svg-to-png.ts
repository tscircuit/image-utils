import { Canvg, presets } from "canvg"

const DEFAULT_SIZE = { width: 300, height: 150 }

const parseSvgSize = (svg: string) => {
  const viewBoxMatch = svg.match(
    /viewBox=["']\s*[-+\d.]+\s+[-+\d.]+\s+([-+\d.]+)\s+([-+\d.]+)\s*["']/i,
  )
  if (viewBoxMatch) {
    const width = Number.parseFloat(viewBoxMatch[1]!)
    const height = Number.parseFloat(viewBoxMatch[2]!)
    if (
      Number.isFinite(width) &&
      Number.isFinite(height) &&
      width > 0 &&
      height > 0
    ) {
      return { width: Math.ceil(width), height: Math.ceil(height) }
    }
  }

  const widthMatch = svg.match(/width=["']\s*([-+\d.]+)/i)
  const heightMatch = svg.match(/height=["']\s*([-+\d.]+)/i)
  const width = widthMatch ? Number.parseFloat(widthMatch[1]!) : Number.NaN
  const height = heightMatch ? Number.parseFloat(heightMatch[1]!) : Number.NaN

  if (
    Number.isFinite(width) &&
    Number.isFinite(height) &&
    width > 0 &&
    height > 0
  ) {
    return { width: Math.ceil(width), height: Math.ceil(height) }
  }

  return DEFAULT_SIZE
}

export const convertSvgToPng = async (svg: string): Promise<Buffer> => {
  const { width, height } = parseSvgSize(svg)

  if (
    typeof OffscreenCanvas !== "undefined" &&
    typeof DOMParser !== "undefined"
  ) {
    const canvas = new OffscreenCanvas(width, height)
    const ctx = canvas.getContext("2d")
    if (!ctx) throw new Error("Failed to create 2D context")

    const renderer = Canvg.fromString(
      ctx as any,
      svg,
      presets.offscreen() as any,
    )
    await renderer.render()

    const blob = await canvas.convertToBlob({ type: "image/png" })
    return Buffer.from(await blob.arrayBuffer())
  }

  const [{ DOMParser: XmldomParser }, canvas] = await Promise.all([
    import("@xmldom/xmldom"),
    import("@napi-rs/canvas"),
  ])

  const nodeCanvas = canvas.createCanvas(width, height)
  const ctx = nodeCanvas.getContext("2d")
  const renderer = Canvg.fromString(
    ctx as any,
    svg,
    presets.node({ DOMParser: XmldomParser, canvas, fetch }) as any,
  )
  await renderer.render()

  return nodeCanvas.toBuffer("image/png")
}
