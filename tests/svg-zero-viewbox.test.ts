import { expect, test } from "bun:test"
import {
  getSvgBRepShapes,
  getTransformedSvgPathRoutes,
} from "../lib/svg-to-brep-shapes"

const transform = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }

test.each([
  "0 0 0 10",
  "0 0 10 0",
  "0 0 0 0",
  "5 -3 0 10",
])("viewBox %s disables SVG routes and filled geometry", (viewBox) => {
  const input = {
    svg: `<svg viewBox="${viewBox}"><path d="M0 0 L10 0 L10 10 Z"/></svg>`,
    width: 10,
    height: 10,
    transform,
  }

  expect(getTransformedSvgPathRoutes(input)).toEqual([])
  expect(getSvgBRepShapes(input)).toEqual([])
})

test("a positive viewBox still produces finite routes and a filled shape", () => {
  const input = {
    svg: '<svg viewBox="5 -3 10 20"><path d="M5 -3 L15 -3 L15 17 Z"/></svg>',
    width: 10,
    height: 20,
    transform,
  }

  expect(getTransformedSvgPathRoutes(input)).toEqual([
    [
      { x: -5, y: 10 },
      { x: 5, y: 10 },
      { x: 5, y: -10 },
      { x: -5, y: 10 },
    ],
  ])
  const shapes = getSvgBRepShapes(input)
  expect(shapes).toHaveLength(1)
  expect(shapes[0].outer_ring.vertices).toHaveLength(3)
  expect(shapes[0].inner_rings).toEqual([])
})
