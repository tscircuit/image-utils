import { describe, expect, test } from "bun:test"
import { identity } from "transformation-matrix"
import { svgPathToPoints } from "../lib/svg-path-to-points"
import { getSvgBRepShapes } from "../lib/svg-to-brep-shapes"

describe("degenerate elliptical arcs (rx=0 or ry=0) (#35)", () => {
  test("treats arc with rx=0 as a straight line segment to the endpoint", () => {
    expect(svgPathToPoints("M0 0 A0 5 0 0 1 10 0 Z", 10)).toEqual([
      [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 0, y: 0 },
      ],
    ])
  })

  test("treats arc with ry=0 as a straight line segment to the endpoint", () => {
    expect(svgPathToPoints("M0 0 A5 0 0 0 1 10 0 Z", 10)).toEqual([
      [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 0, y: 0 },
      ],
    ])
  })

  test("treats arc with both rx=0 and ry=0 as a straight line segment", () => {
    expect(svgPathToPoints("M1 2 A0 0 0 0 0 6 8", 10)).toEqual([
      [
        { x: 1, y: 2 },
        { x: 6, y: 8 },
      ],
    ])
  })

  test("preserves closed polygon BRep shape when an edge uses a degenerate arc", () => {
    const shapes = getSvgBRepShapes({
      svg: '<svg viewBox="0 0 10 10"><path d="M0 0 A0 5 0 0 1 10 0 L10 10 Z"/></svg>',
      width: 10,
      height: 10,
      transform: identity(),
    })

    expect(shapes).toHaveLength(1)
    expect(shapes[0]?.outer_ring.vertices).toEqual([
      { x: 5, y: -5 },
      { x: 5, y: 5 },
      { x: -5, y: 5 },
    ])
  })
})
