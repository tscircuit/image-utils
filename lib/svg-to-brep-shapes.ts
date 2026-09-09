import { Polygon, point as flattenPoint } from "@flatten-js/core"
import { DOMParser } from "@xmldom/xmldom"
import { applyToPoint, type Matrix } from "transformation-matrix"
import { svgPathToPoints, type Point } from "./svg-path-to-points"

export const SVG_MIMETYPE = "image/svg+xml"
export const PNG_MIMETYPE = "image/png"

type FillRule = "nonzero" | "evenodd"

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
  return getTransformedSvgPaths({ svg, width, height, transform }).flatMap(
    ({ routes, fillRule }) => getPathBRepShapes(routes, fillRule),
  )
}

function getPathBRepShapes(routes: Point[][], fillRule: FillRule): BRepShape[] {
  const rings = routes
    .map(stripClosingPoint)
    .filter((route) => route.length >= 3)
    .map((vertices) => ({
      vertices,
      polygon: createFlattenPolygon(vertices),
      samplePoint: getPolygonCentroid(vertices),
    }))
    .map((ring) => ({
      ...ring,
      area: ring.polygon.area(),
      winding: Math.sign([...ring.polygon.faces][0].signedArea()),
    }))
    .filter((ring) => ring.area > 1e-9)

  const boundaries = rings.map((ring) => {
    const containingRings = rings.filter(
      (candidate) =>
        candidate !== ring &&
        candidate.area > ring.area &&
        candidate.polygon.contains(
          flattenPoint(ring.samplePoint.x, ring.samplePoint.y),
        ),
    )
    const outside =
      fillRule === "evenodd"
        ? containingRings.length % 2
        : containingRings.reduce((sum, parent) => sum + parent.winding, 0)
    const inside = fillRule === "evenodd" ? 1 - outside : outside + ring.winding
    return {
      ...ring,
      outer: outside === 0 && inside !== 0,
      hole: outside !== 0 && inside === 0,
    }
  })
  const outerRings = boundaries.filter((ring) => ring.outer)

  return outerRings.map((outerRing) => {
    const innerRings = boundaries
      .filter(
        (ring) =>
          ring.hole &&
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
  return getTransformedSvgPaths({ svg, width, height, transform }).flatMap(
    ({ routes }) => routes,
  )
}

function getTransformedSvgPaths({
  svg,
  width,
  height,
  transform,
}: {
  svg: string
  width: number
  height: number
  transform: Matrix
}): Array<{ routes: Point[][]; fillRule: FillRule }> {
  const viewBox = getSvgViewBox(svg)
  const scaleX = width / viewBox.width
  const scaleY = height / viewBox.height

  return getSvgPathDataList(svg).map(({ pathData, fillRule }) => ({
    fillRule,
    routes: svgPathToPoints(pathData, 0.03).map((pointList) =>
      pointList
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
    ),
  }))
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

function getSvgPathDataList(
  svg: string,
): Array<{ pathData: string; fillRule: FillRule }> {
  const pathDataList: Array<{ pathData: string; fillRule: FillRule }> = []
  const document = new DOMParser().parseFromString(svg, SVG_MIMETYPE)
  function visit(element: Element, inherited: FillRule) {
    let value = element.getAttribute("fill-rule")?.trim().toLowerCase()
    let important = false
    const style = (element.getAttribute("style") ?? "").replace(
      /\/\*[\s\S]*?\*\//g,
      " ",
    )
    for (const declaration of style.split(";")) {
      const match = declaration.match(
        /^\s*fill-rule\s*:\s*(nonzero|evenodd|inherit|initial|unset|revert)\s*(!\s*important)?\s*$/i,
      )
      if (match && (!important || match[2])) {
        value = match[1].toLowerCase()
        important = Boolean(match[2])
      }
    }
    const fillRule: FillRule =
      value === "initial"
        ? "nonzero"
        : value === "nonzero" || value === "evenodd"
          ? value
          : inherited
    if (element.localName === "path") {
      const pathData = element.getAttribute("d")
      if (pathData) pathDataList.push({ pathData, fillRule })
    }
    for (let child = element.firstChild; child; child = child.nextSibling) {
      if (child.nodeType === 1) visit(child as Element, fillRule)
    }
  }
  if (document.documentElement) visit(document.documentElement, "nonzero")
  return pathDataList
}
