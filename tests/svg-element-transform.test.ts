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
]) {
  test(`SVG transform matches equivalent explicit coordinates: ${body}`, () => {
    const actual = convert(body)
    const expected = convert('<path d="M2 3H3V4H2Z"/>')
    expect(expected[0]?.[0]).toEqual({ x: -3, y: 2 })
    expect(actual).toEqual(expected)
  })
}

const triangle = "M1 1L2 1L1 2Z"
for (const [attribute, expected] of [
  ["scale(2 3)", "M2 3L4 3L2 6Z"],
  ["rotate(90)", "M-1 1L-1 2L-2 1Z"],
  ["rotate(90 1 1)", "M1 1L1 2L0 1Z"],
  ["skewX(45)", "M2 1L3 1L3 2Z"],
  ["skewY(45)", "M1 2L2 3L1 3Z"],
  ["matrix(2 0 0 3 4 5)", "M6 8L8 8L6 11Z"],
  ["translate(2 3) scale(2)", "M4 5L6 5L4 7Z"],
] as const) {
  test(`preserves SVG transform order: ${attribute}`, () => {
    const actual = convert(`<path transform="${attribute}" d="${triangle}"/>`)
    const reference = convert(`<path d="${expected}"/>`)
    expect(actual.length).toBe(reference.length)
    expect(actual[0].length).toBe(reference[0].length)
    for (let i = 0; i < reference[0].length; i++) {
      expect(actual[0][i].x).toBeCloseTo(reference[0][i].x, 10)
      expect(actual[0][i].y).toBeCloseTo(reference[0][i].y, 10)
    }
  })
}

test("nested group transforms compose without leaking to siblings", () => {
  expect(
    convert(
      `<g transform="translate(2 3)"><g transform="scale(2)"><path d="${triangle}"/></g><path d="${triangle}"/></g><path d="${triangle}"/>`,
    ),
  ).toEqual(
    convert(
      '<path d="M4 5L6 5L4 7Z"/><path d="M3 4L4 4L3 5Z"/><path d="M1 1L2 1L1 2Z"/>',
    ),
  )
})

test("element transform precedes viewBox scaling, Y inversion, and caller transform", () => {
  const options = {
    width: 20,
    height: 30,
    transform: { a: 0, b: 1, c: -1, d: 0, e: 7, f: 9 },
  }
  const actual = getTransformedSvgPathRoutes({
    ...options,
    svg: `<svg viewBox="2 3 10 10"><path transform="translate(2 3)" d="${triangle}"/></svg>`,
  })
  const expected = getTransformedSvgPathRoutes({
    ...options,
    svg: '<svg viewBox="2 3 10 10"><path d="M3 4L4 4L3 5Z"/></svg>',
  })
  expect(actual).toEqual(expected)
  expect(actual[0][0]).toEqual({ x: -5, y: 1 })
})

test("XML comments and quoted delimiters do not become paths", () => {
  expect(
    convert(
      `<!-- <path transform="scale(9)" d="${triangle}"/> --><g data-label="a > b" transform="translate(2&#32;3)"><path d="${triangle}"/></g>`,
    ),
  ).toEqual(convert('<path d="M3 4L4 4L3 5Z"/>'))
})

test("empty and invalid transforms preserve parent coordinates", () => {
  for (const attribute of ["", " ", "nonsense(4)"]) {
    expect(
      convert(
        `<g transform="translate(2 3)"><path transform="${attribute}" d="${triangle}"/></g>`,
      ),
    ).toEqual(convert('<path d="M3 4L4 4L3 5Z"/>'))
  }
})
