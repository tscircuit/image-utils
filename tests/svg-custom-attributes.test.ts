import { describe, expect, it } from "bun:test"
import { getTransformedSvgPathRoutes } from "../lib/svg-to-brep-shapes"

const identityTransform = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }

const expectedTriangleVertices = [
  { x: -5, y: 5 },
  { x: 5, y: 5 },
  { x: 5, y: -5 },
  { x: -5, y: 5 },
]

describe("getTransformedSvgPathRoutes attribute handling", () => {
  it("ignores data-d and custom:d attributes preceding the real d attribute", () => {
    const routes = getTransformedSvgPathRoutes({
      svg: '<svg viewBox="0 0 10 10"><path data-d="M0 0 L2 0 L2 2 Z" custom:d="M0 0 L4 0 L4 4 Z" d="M0 0 L10 0 L10 10 Z"/></svg>',
      width: 10,
      height: 10,
      transform: identityTransform,
    })

    expect(routes).toEqual([expectedTriangleVertices])
  })

  it("does not emit geometry when a path has data-d or custom:d but no d attribute", () => {
    const routes = getTransformedSvgPathRoutes({
      svg: '<svg viewBox="0 0 10 10"><path data-d="M0 0 L2 0 L2 2 Z" custom:d="M0 0 L4 0 L4 4 Z"/></svg>',
      width: 10,
      height: 10,
      transform: identityTransform,
    })

    expect(routes).toEqual([])
  })

  it("ignores data-viewBox and custom:viewBox before the real viewBox attribute", () => {
    const routes = getTransformedSvgPathRoutes({
      svg: '<svg data-viewBox="0 0 100 100" custom:viewBox="0 0 50 50" viewBox="0 0 10 10"><path d="M0 0 L10 0 L10 10 Z"/></svg>',
      width: 10,
      height: 10,
      transform: identityTransform,
    })

    expect(routes).toEqual([expectedTriangleVertices])
  })

  it("falls back to default 0 0 1 1 viewBox when only data-viewBox is present", () => {
    const routes = getTransformedSvgPathRoutes({
      svg: '<svg data-viewBox="0 0 100 100"><path d="M0 0 L1 0 L1 1 Z"/></svg>',
      width: 10,
      height: 10,
      transform: identityTransform,
    })

    expect(routes).toEqual([expectedTriangleVertices])
  })

  it("ignores attribute-looking text and > inside quoted attribute values", () => {
    const routes = getTransformedSvgPathRoutes({
      svg: `<svg data-meta='viewBox="0 0 100 100" > header' viewBox="0 0 10 10"><path data-note='d="M0 0 L2 0 L2 2 Z" > body' d="M0 0 L10 0 L10 10 Z"/></svg>`,
      width: 10,
      height: 10,
      transform: identityTransform,
    })

    expect(routes).toEqual([expectedTriangleVertices])
  })

  it("supports single-quoted and multiline d values", () => {
    const routes = getTransformedSvgPathRoutes({
      svg: `<svg viewBox='0 0 10 10'><path d='M0 0\nL10 0\nL10 10\nZ'/></svg>`,
      width: 10,
      height: 10,
      transform: identityTransform,
    })

    expect(routes).toEqual([expectedTriangleVertices])
  })
})
