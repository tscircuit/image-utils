import { expect, test } from "bun:test"
import { svgPathToPoints } from "../lib/svg-path-to-points"
import { getTransformedSvgPathRoutes } from "../lib/svg-to-brep-shapes"

const cases = [
  {
    name: "cubic reflection after C and chained S commands",
    shorthand: "M0 0 C0 10 10 10 10 0 S20 -10 20 0 S30 10 30 0",
    explicit: "M0 0 C0 10 10 10 10 0 C10 -10 20 -10 20 0 C20 10 30 10 30 0",
  },
  {
    name: "quadratic reflection after Q and chained T commands",
    shorthand: "M0 0 Q5 10 10 0 T20 0 T30 0",
    explicit: "M0 0 Q5 10 10 0 Q15 -10 20 0 Q25 10 30 0",
  },
  {
    name: "relative smooth curves",
    shorthand: "m5 5 q5 10 10 0 t10 0 c0 10 10 10 10 0 s10 -10 10 0",
    explicit:
      "M5 5 Q10 15 15 5 Q20 -5 25 5 C25 15 35 15 35 5 C35 -5 45 -5 45 5",
  },
  {
    name: "line commands reset reflected control points",
    shorthand: "M0 0 Q5 10 10 0 L15 0 T25 0 C25 10 35 10 35 0 H40 S50 -10 50 0",
    explicit:
      "M0 0 Q5 10 10 0 L15 0 Q15 0 25 0 C25 10 35 10 35 0 L40 0 C40 0 50 -10 50 0",
  },
  {
    name: "moveto starts a fresh subpath",
    shorthand: "M0 0 Q5 10 10 0 M20 0 T30 0",
    explicit: "M0 0 Q5 10 10 0 M20 0 Q20 0 30 0",
  },
  {
    name: "cubic and quadratic commands do not share control points",
    shorthand: "M0 0 Q5 10 10 0 S20 10 20 0 T30 0",
    explicit: "M0 0 Q5 10 10 0 C10 0 20 10 20 0 Q20 0 30 0",
  },
]

for (const { name, shorthand, explicit } of cases) {
  test(name, () => {
    const actual = svgPathToPoints(shorthand, 1)
    const expected = svgPathToPoints(explicit, 1)
    expect(actual).toEqual(expected)
  })
}

test("smooth quadratic curves retain their bulge in transformed SVG routes", () => {
  const [route] = getTransformedSvgPathRoutes({
    svg: '<svg viewBox="0 -10 20 20"><path d="M0 0 Q5 10 10 0 T20 0"/></svg>',
    width: 20,
    height: 20,
    transform: { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 },
  })
  // The reflected second curve bulges upward after converting SVG's y axis.
  expect(route.some((point) => point.x > 0 && point.y > 4)).toBe(true)
  expect(route.at(-1)).toEqual({ x: 10, y: 0 })
})
