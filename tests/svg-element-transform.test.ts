import { expect, test } from "bun:test"
import { identity } from "transformation-matrix"
import { getTransformedSvgPathRoutes } from "../lib/svg-to-brep-shapes"

const convert = (body: string) =>
  getTransformedSvgPathRoutes({
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10">${body}</svg>`,
    width: 10,
    height: 10,
    transform: identity(),
  })

for (const body of [
  '<path transform="translate(2 3)" d="M0 0H1V1H0Z"/>',
  '<g transform="translate(2 3)"><path d="M0 0H1V1H0Z"/></g>',
  '<g transform="translate(1 1)"><path transform="translate(1 2)" d="M0 0H1V1H0Z"/></g>',
  '<path transform="matrix(1, 0, 0, 1, 2, 3)" d="M0 0H1V1H0Z"/>',
]) {
  test(`SVG transform matches equivalent explicit coordinates: ${body}`, () => {
    const actual = convert(body)
    const expected = convert('<path d="M2 3H3V4H2Z"/>')
    expect(expected[0]?.[0]).toEqual({ x: -3, y: 2 })
    expect(actual).toEqual(expected)
  })
}

test("composed group and path scale + translate transforms match explicit coordinates", () => {
  const actual = convert(
    '<g transform="translate(2 3)"><path transform="scale(2)" d="M0 0H1V1H0Z"/></g>',
  )
  const expected = convert('<path d="M2 3H4V5H2Z"/>')
  expect(actual).toEqual(expected)
})
