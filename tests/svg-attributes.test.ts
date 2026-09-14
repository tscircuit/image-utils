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

const metadataAttributeNames = ["data-info", "说明", "data-说明", "a\u0300"]
const triangle = [
  { x: -5, y: 5 },
  { x: 5, y: 5 },
  { x: 5, y: -5 },
  { x: -5, y: 5 },
]

const getRoutes = (svg: string) =>
  getTransformedSvgPathRoutes({
    svg,
    width: 10,
    height: 10,
    transform: { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 },
  })

test.each(
  metadataAttributeNames,
)("quoted path text inside %s does not override d", (name) => {
  const svg = `<svg viewBox="0 0 10 10"><path ${name}="ignore > d='M0 0 L2 0 L2 2 Z'" d="M0 0 L10 0 L10 10 Z"/></svg>`
  expect(getRoutes(svg)).toEqual([triangle])
})

test.each(
  metadataAttributeNames,
)("quoted path text inside %s creates no geometry without d", (name) => {
  const svg = `<svg viewBox="0 0 10 10"><path ${name}='ignore > d="M0 0 L2 0 L2 2 Z"'/></svg>`
  expect(getRoutes(svg)).toEqual([])
})

test.each(
  metadataAttributeNames,
)("quoted viewport text inside %s does not override viewBox", (name) => {
  const svg = `<svg ${name}="ignore > viewBox='0 0 100 100'" viewBox="0 0 10 10"><path d="M0 0 L10 0 L10 10 Z"/></svg>`
  expect(getRoutes(svg)).toEqual([triangle])
})

test.each(
  metadataAttributeNames,
)("quoted viewport text inside %s preserves the default viewBox", (name) => {
  const svg = `<svg ${name}='ignore > viewBox="0 0 100 100"'><path d="M0 0 L1 0 L1 1 Z"/></svg>`
  expect(getRoutes(svg)).toEqual([triangle])
})

test("custom path element names create no geometry", () => {
  const svg =
    '<svg viewBox="0 0 10 10" xmlns:path="urn:test"><path-extra d="M0 0 L2 0 L2 2 Z"/><path:extra d="M0 0 L3 0 L3 3 Z"/><path d="M0 0 L10 0 L10 10 Z"/></svg>'
  expect(getRoutes(svg)).toEqual([triangle])
})

test("custom svg element names do not supply a viewBox", () => {
  const svg =
    '<svg-extra viewBox="0 0 100 100"><path d="M0 0 L1 0 L1 1 Z"/></svg-extra>'
  expect(getRoutes(svg)).toEqual([triangle])
})

test("only the root SVG viewBox supplies the viewport", () => {
  const svg =
    '<svg xmlns:custom="urn:test" data-viewBox="0 0 100 100" custom:viewBox="0 0 100 100"><path viewBox="0 0 100 100" d="M0 0 L1 0 L1 1 Z"/></svg>'
  expect(getRoutes(svg)).toEqual([triangle])
})
