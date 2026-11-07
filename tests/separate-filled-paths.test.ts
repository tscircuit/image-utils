import { expect, test } from "bun:test"
import { Polygon, point } from "@flatten-js/core"
import { identity } from "transformation-matrix"
import { getSvgBRepShapes } from "../lib/svg-to-brep-shapes"

test("a separately filled inner path does not cut a hole in an outer path", () => {
  const svg =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><path fill="black" d="M0 0H10V10H0Z"/><path fill="black" d="M3 3H7V7H3Z"/></svg>'
  const shapes = getSvgBRepShapes({
    svg,
    width: 10,
    height: 10,
    transform: identity(),
  })
  const containsCenter = (vertices: { x: number; y: number }[]) => {
    const polygon = new Polygon()
    polygon.addFace(vertices.map((p) => point(p.x, p.y)))
    return polygon.contains(point(0, 0))
  }
  const centerFilled = shapes.some(
    (shape) =>
      containsCenter(shape.outer_ring.vertices) &&
      !shape.inner_rings.some((ring) => containsCenter(ring.vertices)),
  )
  expect(centerFilled).toBe(true)
  expect(shapes).toHaveLength(2)
  expect(shapes.every((shape) => shape.inner_rings.length === 0)).toBe(true)
})

test("nested subpaths within the same path element still form a hole", () => {
  const svg =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><path fill="black" d="M0 0H10V10H0Z M3 3V7H7V3Z"/></svg>'
  const shapes = getSvgBRepShapes({
    svg,
    width: 10,
    height: 10,
    transform: identity(),
  })
  expect(shapes).toHaveLength(1)
  expect(shapes[0]?.inner_rings).toHaveLength(1)
})
