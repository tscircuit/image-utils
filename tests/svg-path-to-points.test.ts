import { expect, test } from "bun:test"
import { svgPathToPoints } from "../lib/svg-path-to-points"

test("degenerate elliptical arcs (rx=0 or ry=0) are treated as straight line segments", () => {
  // rx = 0: should emit endpoint (10, 0)
  const pointsRx0 = svgPathToPoints("M0 0 A0 5 0 0 1 10 0 Z", 10)
  expect(pointsRx0).toBeDefined()
  expect(pointsRx0.length).toBeGreaterThan(0)
  const ringRx0 = pointsRx0[0]
  expect(ringRx0).toEqual([
    { x: 0, y: 0 },
    { x: 10, y: 0 },
    { x: 0, y: 0 },
  ])

  // ry = 0: should emit endpoint (10, 0)
  const pointsRy0 = svgPathToPoints("M0 0 A5 0 0 0 1 10 0 Z", 10)
  expect(pointsRy0).toBeDefined()
  expect(pointsRy0.length).toBeGreaterThan(0)
  const ringRy0 = pointsRy0[0]
  expect(ringRy0).toEqual([
    { x: 0, y: 0 },
    { x: 10, y: 0 },
    { x: 0, y: 0 },
  ])
})

test("non-degenerate elliptical arcs are sampled with intermediate curve points", () => {
  const points = svgPathToPoints("M0 0 A10 10 0 0 1 20 0", 1)
  expect(points.length).toBe(1)
  const ring = points[0]
  // Non-degenerate arc will have more than 2 points due to curve sampling
  expect(ring.length).toBeGreaterThan(2)
  expect(ring[0]).toEqual({ x: 0, y: 0 })
  expect(ring[ring.length - 1]).toEqual({ x: 20, y: 0 })
})
