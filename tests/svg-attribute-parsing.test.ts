import { expect, it, describe } from "bun:test"
import { getSvgViewBox, getSvgPathDataList } from "../lib/svg-to-brep-shapes"

describe("SVG attribute parsing", () => {
  it("does not allow data-viewBox to override viewBox", () => {
    const svg = `<svg data-viewBox="0 0 999 999" viewBox="0 0 100 200"></svg>`
    const vb = getSvgViewBox(svg)
    expect(vb).toEqual({ x: 0, y: 0, width: 100, height: 200 })
  })

  it("does not allow data-d to override path d attribute", () => {
    const svg = `<svg><path data-d="M 999 999" d="M 0 0 L 10 10" /></svg>`
    const paths = getSvgPathDataList(svg)
    expect(paths).toEqual(["M 0 0 L 10 10"])
  })

  it("ignores paths with only data-d and no real d attribute", () => {
    const svg = `<svg><path data-d="M 999 999" /></svg>`
    const paths = getSvgPathDataList(svg)
    expect(paths).toEqual([])
  })

  it("handles path tags with attributes containing '>' character", () => {
    const svg = `<svg><path data-note="x > y" d="M 1 1 L 2 2" /></svg>`
    const paths = getSvgPathDataList(svg)
    expect(paths).toEqual(["M 1 1 L 2 2"])
  })
})
