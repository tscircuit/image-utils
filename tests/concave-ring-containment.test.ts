import { expect, test } from "bun:test"
import { identity } from "transformation-matrix"
import { getSvgBRepShapes } from "../lib/svg-to-brep-shapes"

const area = (vertices: { x: number; y: number }[]) =>
  Math.abs(
    vertices.reduce((sum, point, index) => {
      const next = vertices[(index + 1) % vertices.length]
      return sum + point.x * next.y - next.x * point.y
    }, 0),
  ) / 2

const shapesFor = (...paths: string[]) =>
  getSvgBRepShapes({
    svg: `<svg viewBox="0 0 12 12"><path fill-rule="evenodd" d="${paths.join(" ")}"/></svg>`,
    width: 12,
    height: 12,
    transform: identity(),
  })

test("a disjoint U-shaped ring is not a hole of a rectangle in its opening", () => {
  const u = "M0 0 H10 V10 H9 V1 H1 V10 H0 Z"
  const rectangle = "M2 2 H8 V8 H2 Z"
  for (const paths of [
    [u, rectangle],
    [rectangle, u],
  ]) {
    const shapes = shapesFor(...paths)
    expect(shapes).toHaveLength(2)
    expect(shapes.map((shape) => shape.inner_rings.length)).toEqual([0, 0])
    expect(
      shapes.map((shape) => shape.outer_ring.vertices.length).sort(),
    ).toEqual([4, 8])
  }
})

test("a nested U-shaped ring remains a hole when its vertex average is outside its parent", () => {
  const outer = "M0 0 H12 V12 H9 V3 H3 V12 H0 Z"
  const inner = "M1 1 H11 V11 H10 V2 H2 V11 H1 Z"
  const shapes = shapesFor(outer, inner)
  expect(shapes).toHaveLength(1)
  expect(shapes[0].inner_rings).toHaveLength(1)
  expect(shapes[0].inner_rings[0].vertices).toHaveLength(8)
  expect(area(shapes[0].outer_ring.vertices)).toBe(90)
  expect(area(shapes[0].inner_rings[0].vertices)).toBe(28)
})

test("nested hole and island retain their immediate containing rings", () => {
  const shapes = shapesFor(
    "M0 0 H12 V12 H0 Z",
    "M1 1 H11 V11 H1 Z",
    "M2 2 H10 V10 H2 Z",
    "M3 3 H9 V9 H3 Z",
  )
  expect(shapes).toHaveLength(2)
  expect(shapes.map((shape) => shape.inner_rings.length)).toEqual([1, 1])
  expect(
    shapes.map((shape) => [
      area(shape.outer_ring.vertices),
      area(shape.inner_rings[0].vertices),
    ]),
  ).toEqual([
    [144, 100],
    [64, 36],
  ])
})
