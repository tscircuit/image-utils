import { Polygon, point as flattenPoint } from "@flatten-js/core"
import { applyToPoint, type Matrix } from "transformation-matrix"
import { svgPathToPoints, type Point } from "./svg-path-to-points"

export const SVG_MIMETYPE = "image/svg+xml"
export const PNG_MIMETYPE = "image/png"

export interface BRepShape {
  outer_ring: {
    vertices: Point[]
  }
  inner_rings: Array<{
    vertices: Point[]
  }>
}

export async function loadImageSource(imageUrl: string): Promise<{
  mimetype: string
  text: string
  dataUrl: string
  projectRelativePath: string
}> {
  if (imageUrl.startsWith("data:")) {
    return loadDataUrlImageSource(imageUrl)
  }

  let response: Response
  try {
    response = await fetch(imageUrl)
  } catch (cause) {
    throw new Error(
      `Failed to fetch image "${imageUrl}". Pass a data URL or a fetchable URL.`,
      { cause },
    )
  }

  if (!response.ok) {
    throw new Error(
      `Failed to fetch image "${imageUrl}": ${response.status} ${response.statusText}`,
    )
  }

  const responseMimetype = response.headers.get("content-type")?.split(";")[0]
  const mimetype =
    responseMimetype && responseMimetype !== "application/octet-stream"
      ? responseMimetype
      : getImageMimeTypeFromPath(imageUrl)

  return {
    mimetype,
    text: mimetype === SVG_MIMETYPE ? await response.text() : "",
    dataUrl: imageUrl,
    projectRelativePath: imageUrl,
  }
}

export function getSvgBRepShapes({
  svg,
  width,
  height,
  transform,
}: {
  svg: string
  width: number
  height: number
  transform: Matrix
}): BRepShape[] {
  const rings = getTransformedSvgPathEntries({
    svg,
    width,
    height,
    transform,
  })
    .map(({ vertices: rawVertices, fillRule }) => ({
      vertices: stripClosingPoint(rawVertices),
      fillRule,
    }))
    .filter((route) => route.vertices.length >= 3)
    .map(({ vertices, fillRule }) => {
      const polygon = createFlattenPolygon(vertices)
      const signedArea = [...polygon.faces][0].signedArea()
      return {
        vertices,
        fillRule,
        polygon,
        samplePoint: getPolygonCentroid(vertices),
        area: polygon.area(),
        winding: signedArea >= 0 ? 1 : -1,
      }
    })
    .filter((ring) => ring.area > 1e-9)

  const classifiedRings = rings.map((ring) => {
    const containingRings = rings.filter(
      (candidate) =>
        candidate !== ring &&
        candidate.area > ring.area &&
        candidate.polygon.contains(
          flattenPoint(ring.samplePoint.x, ring.samplePoint.y),
        ),
    )

    if (ring.fillRule === "evenodd") {
      return {
        ...ring,
        isOuterRing: containingRings.length % 2 === 0,
        isHoleRing: containingRings.length % 2 === 1,
      }
    }

    const outsideWinding = containingRings.reduce(
      (sum, candidate) => sum + candidate.winding,
      0,
    )
    const insideWinding = outsideWinding + ring.winding

    return {
      ...ring,
      isOuterRing: outsideWinding === 0 && insideWinding !== 0,
      isHoleRing: outsideWinding !== 0 && insideWinding === 0,
    }
  })

  const outerRings = classifiedRings.filter((ring) => ring.isOuterRing)
  const holeRings = classifiedRings.filter((ring) => ring.isHoleRing)

  return outerRings.map((outerRing) => {
    const innerRings = holeRings
      .filter(
        (ring) =>
          ring !== outerRing &&
          ring.area < outerRing.area &&
          outerRing.polygon.contains(
            flattenPoint(ring.samplePoint.x, ring.samplePoint.y),
          ) &&
          !outerRings.some(
            (otherOuterRing) =>
              otherOuterRing !== outerRing &&
              otherOuterRing.area < outerRing.area &&
              otherOuterRing.area > ring.area &&
              otherOuterRing.polygon.contains(
                flattenPoint(ring.samplePoint.x, ring.samplePoint.y),
              ),
          ),
      )
      .map((ring) => ({
        vertices: ensureCounterClockwise(ring.vertices),
      }))

    return {
      outer_ring: {
        vertices: ensureClockwise(outerRing.vertices),
      },
      inner_rings: innerRings,
    }
  })
}

export function getTransformedSvgPathRoutes({
  svg,
  width,
  height,
  transform,
}: {
  svg: string
  width: number
  height: number
  transform: Matrix
}): Point[][] {
  return getTransformedSvgPathEntries({ svg, width, height, transform }).map(
    (entry) => entry.vertices,
  )
}

function getTransformedSvgPathEntries({
  svg,
  width,
  height,
  transform,
}: {
  svg: string
  width: number
  height: number
  transform: Matrix
}): Array<{ vertices: Point[]; fillRule: "nonzero" | "evenodd" }> {
  const viewBox = getSvgViewBox(svg)
  const scaleX = width / viewBox.width
  const scaleY = height / viewBox.height

  return getSvgPathDataEntries(svg).flatMap(({ d, fillRule }) =>
    svgPathToPoints(d, 0.03).map((pointList) => ({
      fillRule,
      vertices: pointList
        .map((point) =>
          applyToPoint(transform, {
            x: (point.x - viewBox.x - viewBox.width / 2) * scaleX,
            y: -(point.y - viewBox.y - viewBox.height / 2) * scaleY,
          }),
        )
        .filter(
          (point, index, points) =>
            index === 0 ||
            Math.abs(point.x - points[index - 1].x) > 1e-6 ||
            Math.abs(point.y - points[index - 1].y) > 1e-6,
        ),
    })),
  )
}

export function ensureClockwise(points: Point[]) {
  return getFlattenSignedArea(points) > 0 ? [...points].reverse() : points
}

function loadDataUrlImageSource(imageUrl: string) {
  const commaIndex = imageUrl.indexOf(",")
  if (!imageUrl.startsWith("data:") || commaIndex === -1) {
    throw new Error(`Invalid data URL for image source`)
  }

  const metadata = imageUrl.slice("data:".length, commaIndex)
  const encodedData = imageUrl.slice(commaIndex + 1)
  const mimetype = metadata.split(";")[0] || SVG_MIMETYPE
  const text = metadata.includes(";base64")
    ? new TextDecoder().decode(
        Uint8Array.from(atob(encodedData), (char) => char.charCodeAt(0)),
      )
    : decodeURIComponent(encodedData)

  return {
    mimetype,
    text,
    dataUrl: imageUrl,
    projectRelativePath: "inline",
  }
}

function getImageMimeTypeFromPath(path: string): string {
  const lowercasePath = path.toLowerCase()
  if (lowercasePath.endsWith(".svg")) return SVG_MIMETYPE
  if (lowercasePath.endsWith(".png")) return PNG_MIMETYPE
  return "application/octet-stream"
}

function stripClosingPoint(points: Point[]) {
  if (points.length < 2) return points
  const first = points[0]
  const last = points[points.length - 1]
  if (Math.abs(first.x - last.x) < 1e-6 && Math.abs(first.y - last.y) < 1e-6) {
    return points.slice(0, -1)
  }
  return points
}

function ensureCounterClockwise(points: Point[]) {
  return getFlattenSignedArea(points) < 0 ? [...points].reverse() : points
}

function getPolygonCentroid(points: Point[]) {
  let x = 0
  let y = 0
  for (const point of points) {
    x += point.x
    y += point.y
  }
  return { x: x / points.length, y: y / points.length }
}

function createFlattenPolygon(points: Point[]) {
  const polygon = new Polygon()
  polygon.addFace(points.map((p) => flattenPoint(p.x, p.y)))
  return polygon
}

function getFlattenSignedArea(points: Point[]) {
  return [...createFlattenPolygon(points).faces][0].signedArea()
}

function getSvgViewBox(svg: string): {
  x: number
  y: number
  width: number
  height: number
} {
  const viewBoxMatch = svg.match(/\bviewBox\s*=\s*["']([^"']+)["']/i)
  const viewBox = viewBoxMatch?.[1]
    ?.trim()
    .split(/[\s,]+/)
    .map(Number)

  if (viewBox?.length === 4 && viewBox.every(Number.isFinite)) {
    return {
      x: viewBox[0],
      y: viewBox[1],
      width: viewBox[2],
      height: viewBox[3],
    }
  }

  return { x: 0, y: 0, width: 1, height: 1 }
}

function getXmlAttribute(tag: string, attrName: string): string | undefined {
  const attrRegex = /\s+([^\s=/>]+)\s*=\s*(["'])(.*?)\2/gs
  for (const match of tag.matchAll(attrRegex)) {
    if (match[1].toLowerCase() === attrName.toLowerCase()) {
      return match[3]
    }
  }
  return undefined
}

function getStyleProperty(
  styleAttr: string | undefined,
  propName: string,
): string | undefined {
  if (!styleAttr) return undefined
  let result: string | undefined
  for (const decl of styleAttr.split(";")) {
    const colonIndex = decl.indexOf(":")
    if (colonIndex === -1) continue
    const name = decl.slice(0, colonIndex).trim().toLowerCase()
    if (name === propName.toLowerCase()) {
      const value = decl
        .slice(colonIndex + 1)
        .replace(/!important\s*$/i, "")
        .trim()
        .toLowerCase()
      if (value) result = value
    }
  }
  return result
}

function getSvgPathDataEntries(
  svg: string,
): Array<{ d: string; fillRule: "nonzero" | "evenodd" }> {
  const entries: Array<{ d: string; fillRule: "nonzero" | "evenodd" }> = []
  const cleanedSvg = svg
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<!\[CDATA\[[\s\S]*?\]\]>/g, "")
  const tagRegex =
    /<\/?([a-zA-Z_:][\w:.-]*)(?:\s+(?:[^>"']|"[^"]*"|'[^']*')*)?\s*\/?>/gs
  const stateStack: Array<{
    tagName: string
    fillRule: "nonzero" | "evenodd"
  }> = []

  for (const match of cleanedSvg.matchAll(tagRegex)) {
    const fullTag = match[0]
    const rawTagName = match[1].toLowerCase()
    const localTagName = rawTagName.split(":").pop() ?? rawTagName

    if (fullTag.startsWith("</")) {
      for (let i = stateStack.length - 1; i >= 0; i--) {
        if (stateStack[i].tagName === localTagName) {
          stateStack.length = i
          break
        }
      }
      continue
    }

    const parentFillRule =
      stateStack[stateStack.length - 1]?.fillRule ?? "nonzero"
    const styleAttr = getXmlAttribute(fullTag, "style")
    const rawFillRule =
      getStyleProperty(styleAttr, "fill-rule") ??
      getXmlAttribute(fullTag, "fill-rule")?.trim().toLowerCase() ??
      getXmlAttribute(fullTag, "fillRule")?.trim().toLowerCase()
    const fillRule: "nonzero" | "evenodd" =
      rawFillRule === "evenodd"
        ? "evenodd"
        : rawFillRule === "nonzero"
          ? "nonzero"
          : parentFillRule

    if (localTagName === "path") {
      const d = getXmlAttribute(fullTag, "d")
      if (d) entries.push({ d, fillRule })
    }

    if (!fullTag.endsWith("/>")) {
      stateStack.push({ tagName: localTagName, fillRule })
    }
  }

  return entries
}
