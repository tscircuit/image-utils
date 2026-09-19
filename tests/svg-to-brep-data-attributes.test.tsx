import { expect, test } from "bun:test"
import { identity } from "transformation-matrix"
import { getTransformedSvgPathRoutes } from "../lib/svg-to-brep-shapes"

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10">
  <rect data-viewBox="0 0 100 100" x="0" y="0" width="10" height="10"/>
  <path data-d="M0 0 L100 100" d="M0 0 L10 0 L10 10 L0 10 Z"/>
</svg>`

test("data-d and data-viewBox attributes do not override real geometry", () => {
  const routes = getTransformedSvgPathRoutes({
    svg,
    width: 10,
    height: 10,
    transform: identity(),
  })
  expect(routes).toHaveLength(1)
  const points = routes[0].map((p: any) => ({
    x: Math.round(p.x),
    y: Math.round(p.y),
  }))
  expect(points).toEqual([
    { x: -5, y: 5 },
    { x: 5, y: 5 },
    { x: 5, y: -5 },
    { x: -5, y: -5 },
    { x: -5, y: 5 },
  ])
})

const svgWithQuotedViewBox = `<svg xmlns="http://www.w3.org/2000/svg" aria-label="viewBox='0 0 100 100'" viewBox="0 0 10 10">
  <path d="M0 0 L10 0 L10 10 L0 10 Z"/>
</svg>`

test("viewBox-like text inside quoted attribute values is ignored", () => {
  const routes = getTransformedSvgPathRoutes({
    svg: svgWithQuotedViewBox,
    width: 10,
    height: 10,
    transform: identity(),
  })
  expect(routes).toHaveLength(1)
  const points = routes[0].map((p: any) => ({
    x: Math.round(p.x),
    y: Math.round(p.y),
  }))
  expect(points).toEqual([
    { x: -5, y: 5 },
    { x: 5, y: 5 },
    { x: 5, y: -5 },
    { x: -5, y: -5 },
    { x: -5, y: 5 },
  ])
})
