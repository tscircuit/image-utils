import { expect, test } from "bun:test"
import { identity, translate } from "transformation-matrix"
import { getTransformedSvgPathRoutes } from "../lib/svg-to-brep-shapes"

const routes = (attributes: string, path = "M0 0 H96 V48 H0 Z") =>
  getTransformedSvgPathRoutes({
    svg: `<svg xmlns="http://www.w3.org/2000/svg" ${attributes}><path d="${path}"/></svg>`,
    width: 10,
    height: 5,
    transform: identity(),
  })

const expected = [
  { x: -5, y: 2.5 },
  { x: 5, y: 2.5 },
  { x: 5, y: -2.5 },
  { x: -5, y: -2.5 },
  { x: -5, y: 2.5 },
]

for (const [width, height] of [
  ["96", "48"],
  ["96px", "48px"],
  ["1in", "0.5in"],
  ["2.54cm", "1.27cm"],
  ["25.4mm", "12.7mm"],
  ["72pt", "36pt"],
  ["6pc", "3pc"],
  ["101.6Q", "50.8Q"],
  ["9.6e1", "4.8e1"],
]) {
  test(`uses intrinsic ${width} by ${height} viewport without viewBox`, () => {
    const result = routes(`width="${width}" height="${height}"`)[0]
    expect(result).toHaveLength(expected.length)
    for (let i = 0; i < result.length; i++) {
      expect(result[i].x).toBeCloseTo(expected[i].x, 10)
      expect(result[i].y).toBeCloseTo(expected[i].y, 10)
    }
  })
}

test("explicit viewBox still determines source coordinates", () => {
  expect(routes('width="960" height="480" viewBox="0 0 96 48"')).toEqual([
    expected,
  ])
})

test("intrinsic viewport is centered before applying the caller transform", () => {
  expect(
    getTransformedSvgPathRoutes({
      svg: '<svg width="96" height="48"><path d="M0 0 L96 48"/></svg>',
      width: 10,
      height: 5,
      transform: translate(20, 30),
    }),
  ).toEqual([
    [
      { x: 15, y: 32.5 },
      { x: 25, y: 27.5 },
    ],
  ])
})

test("unresolved relative lengths retain the normalized fallback", () => {
  expect(routes('width="100%" height="100%"', "M0 0 H1 V1 H0 Z")).toEqual([
    expected,
  ])
})

test("uses only root viewport attributes, not metadata or child attributes", () => {
  expect(
    routes(
      `data-width="960" data-height="480" data-viewBox="0 0 960 480" aria-label='size > width="960"' width='96' height='48'`,
    ),
  ).toEqual([expected])
  expect(
    getTransformedSvgPathRoutes({
      svg: '<svg width="96" height="48"><defs><symbol viewBox="0 0 960 480"/></defs><path d="M0 0 H96 V48 H0 Z"/></svg>',
      width: 10,
      height: 5,
      transform: identity(),
    }),
  ).toEqual([expected])
})

for (const attributes of [
  "",
  'width="96"',
  'width="0" height="48"',
  'width="-96" height="48"',
  'width="1e999" height="48"',
  'width="96foo" height="48"',
  'width="6em" height="3em"',
]) {
  test(`retains fallback for unresolved dimensions: ${attributes}`, () => {
    expect(routes(attributes, "M0 0 H1 V1 H0 Z")).toEqual([expected])
  })
}
