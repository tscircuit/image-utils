import { describe, expect, test } from "bun:test"
import { identity } from "transformation-matrix"
import {
  getSvgBRepShapes,
  getSvgPathDataList,
  getSvgViewBox,
} from "../lib/svg-to-brep-shapes"

describe("custom SVG attributes should not override standard geometry", () => {
  test("getSvgViewBox ignores data-viewBox and extracts authentic viewBox", () => {
    const svgWithCustomAttr = `
      <svg data-viewBox="99 99 999 999" viewBox="0 0 100 200">
        <path d="M0 0 L10 10 Z" />
      </svg>
    `

    const viewBox = getSvgViewBox(svgWithCustomAttr)
    expect(viewBox).toEqual({
      x: 0,
      y: 0,
      width: 100,
      height: 200,
    })
  })

  test("getSvgPathDataList ignores data-d attribute and extracts authentic path d", () => {
    const svgWithCustomAttr = `
      <svg viewBox="0 0 100 100">
        <path data-d="M99 99 Z" d="M0 0 L10 0 L10 10 Z" />
      </svg>
    `

    const pathDataList = getSvgPathDataList(svgWithCustomAttr)
    expect(pathDataList).toEqual(["M0 0 L10 0 L10 10 Z"])
  })

  test("getSvgBRepShapes correctly parses SVG containing data-viewBox and data-d attributes", () => {
    const svg = `
      <svg data-viewBox="0 0 999 999" viewBox="0 0 100 100">
        <path data-d="M0 0 Z" d="M0 0 L10 0 L10 10 L0 10 Z" />
      </svg>
    `

    const shapes = getSvgBRepShapes({
      svg,
      width: 10,
      height: 10,
      transform: identity(),
    })

    expect(shapes.length).toBeGreaterThan(0)
    expect(shapes[0].outer_ring.vertices.length).toBeGreaterThan(0)
  })
})
