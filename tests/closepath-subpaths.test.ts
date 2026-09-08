import { expect, test } from "bun:test"
import { svgPathToPoints } from "../lib/svg-path-to-points"

for (const continuation of [
  "L 20 10 L 20 20 Z",
  "h 5 v 5 z",
  "v 5 h 5 z",
  "C 11 12 12 13 14 14",
  "S 12 13 14 14",
  "Q 12 13 14 14",
  "T 14 14",
  "A 4 4 0 0 1 14 14",
]) {
  test(`starts a new subpath after Z before ${continuation}`, () => {
    const prefix = "M 10 10 L 6 10 L 6 6 Z"
    const implicit = svgPathToPoints(`${prefix} ${continuation}`, 1)
    const explicit = svgPathToPoints(`${prefix} M 10 10 ${continuation}`, 1)
    expect(implicit).toHaveLength(2)
    expect(implicit).toEqual(explicit)
    expect(implicit[0]).toEqual([
      { x: 10, y: 10 },
      { x: 6, y: 10 },
      { x: 6, y: 6 },
      { x: 10, y: 10 },
    ])
    expect(implicit[1]?.[0]).toEqual({ x: 10, y: 10 })
  })
}

test("does not create extra routes for trailing close or following moveto", () => {
  expect(svgPathToPoints("M 0 0 L 2 0 L 2 2 Z")).toHaveLength(1)
  const paths = svgPathToPoints("M 0 0 L 2 0 L 2 2 Z M 5 5 L 6 6")
  expect(paths).toHaveLength(2)
  expect(paths[1]).toEqual([
    { x: 5, y: 5 },
    { x: 6, y: 6 },
  ])
})
