import { expect, it } from "bun:test"
import { svgPathToPoints } from "../lib/svg-path-to-points"

it("treats an arc with rx=0 as a straight line to the endpoint", () => {
  const result = svgPathToPoints("M0 0 A0 5 0 0 1 10 0 Z", 10)

  expect(result).toHaveLength(1)
  const points = result[0]

  // The endpoint of the arc (10, 0) must be present in the sampled path;
  // previously it was silently dropped and the ring collapsed to a single
  // point at the origin. The path closes back to (0, 0) afterwards, so the
  // arc endpoint is the second-to-last point.
  expect(points.length).toBeGreaterThan(1)
  const arcEnd = points[points.length - 2]
  expect(arcEnd.x).toBeCloseTo(10)
  expect(arcEnd.y).toBeCloseTo(0)
})

it("treats an arc with ry=0 as a straight line to the endpoint", () => {
  const result = svgPathToPoints("M0 0 A5 0 0 0 1 10 0 Z", 10)

  expect(result).toHaveLength(1)
  const points = result[0]

  expect(points.length).toBeGreaterThan(1)
  const arcEnd = points[points.length - 2]
  expect(arcEnd.x).toBeCloseTo(10)
  expect(arcEnd.y).toBeCloseTo(0)
})

it("still samples a normal arc with positive radii", () => {
  const result = svgPathToPoints("M0 0 A5 5 0 0 1 10 0 Z", 10)

  expect(result).toHaveLength(1)
  const points = result[0]

  // A real arc should be sampled into multiple intermediate points, not
  // just start/end.
  expect(points.length).toBeGreaterThan(2)
})
