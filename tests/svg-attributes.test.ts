import { expect, test } from "bun:test"
import { getTransformedSvgPathRoutes } from "../lib/svg-to-brep-shapes"

test("custom data-d attribute does not override d attribute", () => {
  const routes = getTransformedSvgPathRoutes({
    svg: '<svg viewBox="0 0 10 10"><path data-d="M0 0 L2 0 L2 2 Z" d="M0 0 L10 0 L10 10 Z"/></svg>',
    width: 10,
    height: 10,
    transform: { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 },
  })

  expect(routes).toHaveLength(1)
  const pts = routes[0]
  expect(pts[0]).toEqual({ x: -5, y: 5 })
  expect(pts[1]).toEqual({ x: 5, y: 5 })
  expect(pts[2]).toEqual({ x: 5, y: -5 })
  expect(pts[3]).toEqual({ x: -5, y: 5 })
})

test("path with only data-d creates no geometry", () => {
  const routes = getTransformedSvgPathRoutes({
    svg: '<svg viewBox="0 0 10 10"><path data-d="M0 0 L2 0 L2 2 Z"/></svg>',
    width: 10,
    height: 10,
    transform: { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 },
  })

  expect(routes).toHaveLength(0)
})

test("custom data-viewBox attribute does not override viewBox", () => {
  const routes = getTransformedSvgPathRoutes({
    svg: '<svg data-viewBox="0 0 100 100" viewBox="0 0 10 10"><path d="M0 0 L10 0 L10 10 Z"/></svg>',
    width: 10,
    height: 10,
    transform: { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 },
  })

  expect(routes).toHaveLength(1)
  const pts = routes[0]
  expect(pts[0]).toEqual({ x: -5, y: 5 })
  expect(pts[1]).toEqual({ x: 5, y: 5 })
})

test("namespace-prefixed attributes (custom:d, inkscape:d) do not override d", () => {
  const routes = getTransformedSvgPathRoutes({
    svg: '<svg viewBox="0 0 10 10"><path custom:d="M0 0 L1 0 Z" inkscape:d="M0 0 L2 0 Z" d="M0 0 L10 0 L10 10 Z"/></svg>',
    width: 10,
    height: 10,
    transform: { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 },
  })

  expect(routes).toHaveLength(1)
  const pts = routes[0]
  expect(pts[0]).toEqual({ x: -5, y: 5 })
  expect(pts[1]).toEqual({ x: 5, y: 5 })
})

test("multiline d attribute is parsed correctly", () => {
  const routes = getTransformedSvgPathRoutes({
    svg: `<svg viewBox="0 0 10 10">
      <path d="M0 0
               L10 0
               L10 10
               Z"/>
    </svg>`,
    width: 10,
    height: 10,
    transform: { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 },
  })

  expect(routes).toHaveLength(1)
  const pts = routes[0]
  expect(pts[0]).toEqual({ x: -5, y: 5 })
  expect(pts[1]).toEqual({ x: 5, y: 5 })
})

test("quoted '>' character inside another attribute does not break path parsing", () => {
  const routes = getTransformedSvgPathRoutes({
    svg: '<svg viewBox="0 0 10 10"><path title="condition > 5" data-info="a > b" d="M0 0 L10 0 L10 10 Z"/></svg>',
    width: 10,
    height: 10,
    transform: { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 },
  })

  expect(routes).toHaveLength(1)
  const pts = routes[0]
  expect(pts[0]).toEqual({ x: -5, y: 5 })
  expect(pts[1]).toEqual({ x: 5, y: 5 })
})

test("single quotes and arbitrary whitespace around '=' are handled", () => {
  const routes = getTransformedSvgPathRoutes({
    svg: "<svg viewBox = '0 0 10 10'><path d = 'M0 0 L10 0 L10 10 Z'/></svg>",
    width: 10,
    height: 10,
    transform: { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 },
  })

  expect(routes).toHaveLength(1)
  const pts = routes[0]
  expect(pts[0]).toEqual({ x: -5, y: 5 })
  expect(pts[1]).toEqual({ x: 5, y: 5 })
})
